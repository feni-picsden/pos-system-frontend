import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  IconButton,
  InputBase,
  Select,
  MenuItem,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  DeleteOutline as DeleteOutlineIcon,
  CheckCircleOutline as TickIcon,
  Close as CloseIcon,
  Check as CheckIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import supplierService from '../../services/supplierService';
import posLocalDb from '../../services/posLocalDb';
import { SHOW_SUPPLIER_MASTER_DATABASE_REF } from '../../utils/featureFlags';
import masterDatabaseService from '../../services/masterDatabaseService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';
import { byMode } from '../../theme/sfPalette';

// Reference (Stock Management > Suppliers > Functions > Merge Suppliers, help-centre
// article 4418122290061, screenshots 19/11/2026): "Supplier Merge" page. A grey
// "Results" column on the left holds the merged supplier (light-blue section cards
// with editable controls), one grey column per added supplier beside it (white
// read-only cards), then a dashed "+ Click to add a new supplier to merge" box.
// Every column has the same sections; a supplier section's "Select Section"
// copies that section into Results, a single value can be picked by clicking it,
// Results fields can be typed, "Clear" empties a select-type value. "Complete
// Merge" under Results asks to confirm with the list of suppliers, then Continue
// runs the merge (backend POST /suppliers/merge: orders, purchases, future costs,
// buying periods and product links move to the surviving supplier, the others are
// trashed). Irreversible. Never runs in All Outlets mode - an outlet is picked first.

export const MERGE_SUPPLIERS_ACTION = 'suppliers.merge';

// Light values measured from the reference PNGs; dark ones are the Product Merge
// counterparts (section blue #0b4f80, columns / white cards #232323, inputs #121212).
const BLUE = '#b8e6fe';
const GREY = '#d4d4d4';
const DARK = '#313439';
const NO_VALUE = 'No Value';
const BLUE_D = '#0b4f80';
const CARD_D = '#232323';
const TEXT = byMode('#000', '#f8f8f8');
const MUTED = byMode('#a1a1a1', '#d4d4d4');
const DARK_ONLY = 'html[data-theme="dark"] &';

// Select options are the Supplier edit page's (SupplierDetails.jsx), so the two agree.
const EMAIL_FORMATS = ['Inline', 'CSV', 'PDF'];
const DISTRIBUTE_FEES = ['Proportionally', 'Evenly'];
const DISTRIBUTE_FREIGHT = ['Items', 'Cases', 'Mixed'];
const ORDER_TAX = ['Including Tax', 'Excluding Tax', 'Excluding WET'];
const TAXES = ['No Tax', 'GST', 'VAT'];

const SECTIONS = [
  { id: 'general', title: 'General', fields: [
    { name: 'name', label: 'Name', required: true },
    { name: 'status', label: 'Status', required: true, kind: 'status' },
    { name: 'businessNumber', label: 'Business Number' },
    { name: 'accountNumber', label: 'Account Number' },
    // Same flag + typeahead as the Supplier edit page (master suppliers, searched as you type).
    ...(SHOW_SUPPLIER_MASTER_DATABASE_REF ? [{ name: 'masterDatabaseRef', label: 'Master Database Reference', kind: 'master', clear: true }] : []),
  ] },
  { id: 'contact', title: 'Contact', fields: [
    { name: 'email', label: 'Emails' },
    { name: 'fax', label: 'Fax' },
    { name: 'phone', label: 'Phone' },
    { name: 'mobile', label: 'Mobile' },
    { name: 'website', label: 'Website' },
    { name: 'twitter', label: 'Twitter' },
    { name: 'facebook', label: 'Facebook' },
  ] },
  { id: 'address', title: 'Address', fields: [
    { name: 'streetAddress1', label: 'Street Address 1' },
    { name: 'streetAddress2', label: 'Street Address 2' },
    { name: 'suburb', label: 'Suburb' },
    { name: 'city', label: 'City' },
    { name: 'postCode', label: 'Post Code' },
    { name: 'region', label: 'Region' },
    { name: 'country', label: 'Country' },
  ] },
  { id: 'additionalContacts', title: 'Additional Contacts', fields: [
    { name: 'additionalContacts', label: 'Additional Contacts', kind: 'contacts', clear: true },
  ] },
  { id: 'ordering', title: 'Ordering', fields: [
    { name: 'orderNotes', label: 'Order Notes' },
    { name: 'internalOrderNotes', label: 'Internal Order Notes' },
    { name: 'emailOrderAutomatically', label: 'Email Order Automatically', kind: 'switch' },
    { name: 'emailFormat', label: 'Email Format', kind: 'select', options: EMAIL_FORMATS, clear: true },
    { name: 'allowOrdersBelowMinimum', label: 'allowOrderBelowMinimum', kind: 'switch' },
    { name: 'minimumOrderValue', label: 'Minimum Order Value', kind: 'money' },
    { name: 'maximumOrderValue', label: 'Maximum Order Value', kind: 'money' },
  ] },
  { id: 'receiving', title: 'Receiving', fields: [
    { name: 'paymentFeePercentage', label: 'Payment Fee Percentage', kind: 'percent' },
    { name: 'distributeFees', label: 'Distribute Fees', kind: 'select', options: DISTRIBUTE_FEES, clear: true },
    { name: 'distributeFreightAcross', label: 'Distribute Freight Across', kind: 'select', options: DISTRIBUTE_FREIGHT, clear: true },
    { name: 'defaultOrderTax', label: 'Default Order Tax', kind: 'select', options: ORDER_TAX, clear: true },
    { name: 'freightTax', label: 'Freight Tax', kind: 'select', options: TAXES, clear: true },
    { name: 'feesTax', label: 'Fees Tax', kind: 'select', options: TAXES, clear: true },
    { name: 'freightIncludedOnInvoices', label: 'Freight included by default on invoices', kind: 'switch' },
  ] },
  // One Authentication section: our suppliers hold one set of credentials
  // (the reference keeps one per outlet).
  { id: 'authentication', title: 'Authentication', fields: [
    { name: 'authAccountNumber', label: 'Account Number' },
    { name: 'authUsername', label: 'Username' },
    { name: 'authPassword', label: 'Password' },
    { name: 'authAdditional', label: 'Additional Authentication' },
  ] },
  { id: 'misc', title: 'Miscellaneous', fields: [
    { name: 'comments', label: 'Comments' },
  ] },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => f.name));
const FIELD_BY_NAME = Object.fromEntries(SECTIONS.flatMap((s) => s.fields.map((f) => [f.name, f])));
const blankForm = () => Object.fromEntries(ALL_FIELDS.map((f) => [f, FIELD_BY_NAME[f].kind === 'switch' ? false : FIELD_BY_NAME[f].kind === 'contacts' ? null : '']));

// What a supplier holds for a Results field (strings; switches as booleans;
// additional contacts as the stored object).
const readValue = (supplier, field) => {
  const kind = FIELD_BY_NAME[field]?.kind;
  const v = supplier[field];
  if (kind === 'switch') return Boolean(v);
  if (kind === 'contacts') {
    if (!v) return null;
    const list = Array.isArray(v) ? v : Object.values(v);
    return list.length ? v : null;
  }
  return v === null || v === undefined ? '' : String(v);
};

const contactsCount = (v) => (!v ? 0 : (Array.isArray(v) ? v : Object.values(v)).length);
const money = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? `$${n.toFixed(2)}` : ''; };
const percent = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? `${n.toFixed(2)}%` : ''; };

// ---------- small building blocks (same chrome as Customer / Product Merge) ----------
const FieldLabel = ({ label, tick, required, action }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', minHeight: 36, mb: 0.5 }}>
    <Typography sx={{ fontSize: 16, color: TEXT }}>{label}{required ? '*' : ''}</Typography>
    {tick && <TickIcon data-testid="field-tick" sx={{ fontSize: 16, color: byMode('#1c86f2', '#74d4ff'), ml: 0.75 }} />}
    <Box sx={{ flex: 1 }} />
    {action}
  </Box>
);
const ValueText = ({ value, onClick, testid }) => (
  <Typography
    data-testid={testid}
    onClick={onClick}
    sx={{ fontSize: 16, color: value ? TEXT : MUTED, px: 1, py: 0.5, mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: onClick ? 'pointer' : 'default', borderRadius: '4px', '&:hover': onClick ? { bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)') } : undefined }}
  >
    {value || NO_VALUE}
  </Typography>
);
// Read-only switch value on a supplier card: red "x Off" / green "tick On" (reference).
const SwitchText = ({ on, onClick, testid }) => (
  <Box data-testid={testid} onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5, mb: 1, fontSize: 16, color: TEXT, cursor: onClick ? 'pointer' : 'default', borderRadius: '4px', '&:hover': onClick ? { bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)') } : undefined }}>
    {on ? <CheckIcon sx={{ fontSize: 16, color: byMode('#32b643', '#7bf1a8') }} /> : <CloseIcon sx={{ fontSize: 16, color: byMode('#e3342f', '#ffa2a2') }} />}
    {on ? 'On' : 'Off'}
  </Box>
);
const inputSx = { width: '100%', border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), borderRadius: '4px', bgcolor: byMode('#fff', '#121212'), px: 1.5, fontSize: 16, minHeight: 50, mb: 1.5, fontFamily: 'inherit', '& input::placeholder': { color: byMode('#9e9e9e', '#757575'), opacity: 1 }, [DARK_ONLY]: { color: '#f8f8f8' } };
const selectSx = { width: '100%', mb: 1.5, bgcolor: byMode('#fff', '#121212'), borderRadius: '8px', fontSize: 16, minHeight: 42, '& .MuiSelect-select': { py: 1 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} .MuiSelect-icon`]: { color: '#f8f8f8' } };
const menuProps = { PaperProps: { sx: { bgcolor: byMode('#fff', '#232323'), color: TEXT, border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), borderRadius: '8px', '& .MuiMenuItem-root:hover': { bgcolor: byMode('rgba(0,0,0,0.06)', '#0084d1') } } } };
const ClearBtn = ({ onClick, testid }) => (
  <Button data-testid={testid} onClick={onClick} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ color: byMode('#676b72', '#d4d4d4'), border: 1, borderStyle: 'solid', borderColor: byMode('#676b72', '#a1a1a1'), borderRadius: '2px', bgcolor: byMode('#f8f8f8', 'transparent'), fontSize: 15, textTransform: 'none', px: 1.25, py: 0.25, minWidth: 0, '&:hover': { bgcolor: byMode('#eee', '#333333') } }}>
    Clear
  </Button>
);
const SectionCard = ({ title, selected, dark, onSelect, children, testid }) => (
  <Box data-testid={testid} data-selected={selected ? '1' : '0'} sx={{ bgcolor: selected ? byMode(BLUE, BLUE_D) : byMode('#fff', CARD_D), p: 2, mb: 2, borderRadius: 0, ...(selected ? {} : { [DARK_ONLY]: { boxShadow: '0 0 0 1px #373737' } }) }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, gap: 1 }}>
      <Typography sx={{ fontSize: 20, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</Typography>
      <Button
        onClick={onSelect}
        sx={{ flexShrink: 0, fontSize: 18, textTransform: 'none', borderRadius: '2px', px: 1.25, py: 0.5, border: 1, borderStyle: 'solid', borderColor: dark ? byMode(DARK, '#f8f8f8') : byMode('#676b72', '#a1a1a1'), bgcolor: dark ? byMode(DARK, '#3a3a3a') : byMode('#f8f8f8', 'transparent'), color: dark ? byMode('#fff', '#f8f8f8') : byMode('#676b72', '#d4d4d4'), fontWeight: 400, '&:hover': { bgcolor: dark ? byMode(DARK, '#4a4a4a') : byMode('#e6e6e6', '#333333') } }}
      >
        Select Section
      </Button>
    </Box>
    {children}
  </Box>
);
const BadgeDialog = ({ open, onClose, title, subtitle, children, actions, testid }) => (
  <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 480, maxWidth: 'calc(100vw - 32px)', overflow: 'visible', borderRadius: 0, mt: 8, bgcolor: byMode('#fff', CARD_D), backgroundImage: 'none' }, 'data-testid': testid }}>
    <Box aria-hidden sx={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 118, height: 118, borderRadius: '50%', bgcolor: byMode('#2d8ff5', '#1c86f2'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 72, fontWeight: 700, lineHeight: 1 }}>?</Box>
    <Box sx={{ pt: 8.5, px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 1 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: 16, color: TEXT, mb: 2 }}>{subtitle}</Typography>}
      {children}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>{actions}</Box>
    </Box>
  </Dialog>
);
const dlgBtn = (primary) => ({ flex: 1, height: 48, fontSize: 24, fontWeight: 400, textTransform: 'none', borderRadius: '4px', boxShadow: 'none', bgcolor: primary ? byMode('#32b643', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#676b72', '#f8f8f8'), border: 1, borderStyle: 'solid', borderColor: primary ? byMode('#32b643', '#7bf1a8') : byMode('#d4d4d4', '#5a5a5a'), '&:hover': { bgcolor: primary ? byMode('#2a9c39', '#8ff5b8') : byMode('#e5e7eb', '#4a4a4a'), boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: primary ? byMode('#a5d9ad', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#bbb', '#757575') } });

// ---------- page ----------
const SupplierMerge = () => {
  const navigate = useNavigate();
  const { globalMode } = useGlobalOutlet();
  const { openOutletPicker, pendingOutletAction, clearPendingOutletAction } = useSelectedRegister();

  const [suppliers, setSuppliers] = useState([]);
  const [merged, setMerged] = useState(blankForm);
  // field -> supplier id the value was picked from (absent = typed / Results)
  const [picks, setPicks] = useState({});
  const [error, setError] = useState('');
  // Master Database Reference options: the edit page's typeahead (server-side search, 300ms).
  const [mdrOptions, setMdrOptions] = useState([]);
  useEffect(() => {
    if (!SHOW_SUPPLIER_MASTER_DATABASE_REF) return undefined;
    let active = true;
    const handle = setTimeout(async () => {
      try {
        const data = await masterDatabaseService.getSuppliers({ search: merged.masterDatabaseRef || '' });
        if (active) setMdrOptions([...new Set((data.suppliers || []).map((s) => s.name || s.reference).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
      } catch { if (active) setMdrOptions([]); }
    }, 300);
    return () => { active = false; clearTimeout(handle); };
  }, [merged.masterDatabaseRef]);
  const [loading, setLoading] = useState(false);

  // add dialog (the outlet-scoped supplier list, filtered as you type)
  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [allSuppliers, setAllSuppliers] = useState([]);
  const [addPicked, setAddPicked] = useState(null);
  const [adding, setAdding] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);

  // The outlet picker was answered from this page: nothing else to do, the
  // navbar switch re-mounted us in that outlet.
  useEffect(() => {
    if (pendingOutletAction === MERGE_SUPPLIERS_ACTION && !globalMode) clearPendingOutletAction();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOutletAction, globalMode]);

  useEffect(() => {
    if (globalMode) return;
    supplierService.getSuppliers()
      .then((r) => setAllSuppliers(r?.suppliers || []))
      .catch(() => setAllSuppliers([]));
  }, [globalMode]);

  const addOptions = useMemo(() => {
    const q = addInput.trim().toLowerCase();
    return allSuppliers
      .filter((s) => !suppliers.some((x) => x.id === s.id))
      .filter((s) => !q || String(s.name || '').toLowerCase().includes(q))
      .slice(0, 50);
  }, [allSuppliers, addInput, suppliers]);

  const openAdd = () => { setAddPicked(null); setAddInput(''); setAddOpen(true); };

  const shown = (s, field) => {
    const kind = FIELD_BY_NAME[field].kind;
    const v = readValue(s, field);
    if (kind === 'contacts') { const n = contactsCount(v); return n ? `${n} Contact${n === 1 ? '' : 's'}` : ''; }
    if (kind === 'money') return money(v);
    if (kind === 'percent') return percent(v);
    return v;
  };

  const applyFields = (fields, supplier) => {
    setMerged((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, readValue(supplier, f)])) }));
    setPicks((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, supplier.id])) }));
  };
  const edit = (patch) => {
    setMerged((prev) => ({ ...prev, ...patch }));
    setPicks((prev) => { const n = { ...prev }; Object.keys(patch).forEach((k) => delete n[k]); return n; });
  };
  const clearField = (field) => edit({ [field]: FIELD_BY_NAME[field].kind === 'contacts' ? null : '' });
  // Results' own "Select Section": the section is Results' again (re-copied from the first supplier).
  const selectResults = (section) => {
    const fields = section.fields.map((f) => f.name);
    if (suppliers[0]) setMerged((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, readValue(suppliers[0], f)])) }));
    setPicks((prev) => { const n = { ...prev }; fields.forEach((f) => delete n[f]); return n; });
  };

  const confirmAdd = async () => {
    if (!addPicked) return;
    try {
      setAdding(true);
      // The list endpoint is a summary; the merge needs every field.
      const r = await supplierService.getSupplier(addPicked.id);
      const full = r?.supplier || r;
      setSuppliers((prev) => {
        if (prev.some((x) => x.id === full.id)) return prev;
        // The first supplier added is the survivor: seed Results from it.
        if (prev.length === 0) applyFields(ALL_FIELDS, full);
        return [...prev, full];
      });
      setAddOpen(false);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load supplier details');
    } finally { setAdding(false); }
  };

  const removeSupplier = (id) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
    // Values picked from the removed card are blanked - no source left behind them.
    const gone = Object.entries(picks).filter(([, sid]) => sid === id).map(([f]) => f);
    const blank = blankForm();
    setMerged((prev) => ({ ...prev, ...Object.fromEntries(gone.map((f) => [f, blank[f]])) }));
    setPicks((prev) => Object.fromEntries(Object.entries(prev).filter(([, sid]) => sid !== id)));
  };

  const isFrom = (section, supplierId) => section.fields.every((f) => picks[f.name] === supplierId);
  const isResults = (section) => section.fields.every((f) => picks[f.name] === undefined || !suppliers.some((s) => s.id === picks[f.name]));
  const fieldFrom = (field, supplierId) => picks[field] === supplierId;

  const canMerge = suppliers.length >= 2 && String(merged.name || '').trim() !== '' && !loading;

  const doMerge = async () => {
    setConfirmOpen(false);
    try {
      setLoading(true); setError('');
      const data = {};
      for (const f of ALL_FIELDS) {
        const kind = FIELD_BY_NAME[f].kind;
        const v = merged[f];
        if (kind === 'switch') data[f] = Boolean(v);
        else if (kind === 'contacts') data[f] = v && contactsCount(v) ? v : null;
        else if (kind === 'money' || kind === 'percent') { const n = parseFloat(v); data[f] = Number.isFinite(n) ? n : null; }
        else data[f] = String(v ?? '').trim();
      }
      data.status = data.status || 'Active';
      const result = await supplierService.mergeSuppliers({
        supplierIds: suppliers.map((s) => s.id),
        survivorId: suppliers[0].id,
        data,
      });
      // The list page serves IndexedDB first: drop the stale rows.
      try { await posLocalDb.invalidateStore('suppliers'); } catch { /* best effort */ }
      navigate('/suppliers', { state: { merged: result?.supplier?.name || data.name } });
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to merge suppliers');
    } finally { setLoading(false); }
  };

  // ---------- renderers ----------
  const colSx = { width: 400, flexShrink: 0, bgcolor: byMode(GREY, CARD_D), p: 2, pt: 1.5, alignSelf: 'flex-start' };

  const resultsField = (f) => {
    const tick = picks[f.name] === undefined;
    const action = f.clear ? <ClearBtn testid={`clear-${f.name}`} onClick={() => clearField(f.name)} /> : undefined;
    const value = merged[f.name];
    let control;
    if (f.kind === 'status') {
      control = (
        <Select displayEmpty value={value || ''} onChange={(e) => edit({ status: e.target.value })} inputProps={{ 'aria-label': 'Status' }} SelectDisplayProps={{ 'data-testid': 'merged-status' }} MenuProps={menuProps} sx={selectSx} renderValue={(v) => (v ? v : <span style={{ color: '#9e9e9e' }}>Select...</span>)}>
          <MenuItem value="Active" sx={{ fontSize: 16 }}>Active</MenuItem>
          <MenuItem value="Inactive" sx={{ fontSize: 16 }}>Inactive</MenuItem>
        </Select>
      );
    } else if (f.kind === 'select') {
      // A picked / typed value reads as text (reference); empty shows "No Value" with the choices behind it.
      control = value ? (
        <ValueText testid={`merged-${f.name}`} value={value} />
      ) : (
        <Select displayEmpty value="" onChange={(e) => edit({ [f.name]: e.target.value })} inputProps={{ 'aria-label': f.label }} SelectDisplayProps={{ 'data-testid': `merged-${f.name}` }} MenuProps={menuProps} sx={selectSx} renderValue={() => <span style={{ color: '#9e9e9e' }}>{NO_VALUE}</span>}>
          <MenuItem value="" sx={{ fontSize: 16 }}>{NO_VALUE}</MenuItem>
          {f.options.map((o) => <MenuItem key={o} value={o} sx={{ fontSize: 16 }}>{o}</MenuItem>)}
        </Select>
      );
    } else if (f.kind === 'master') {
      // Edit page's control: free-text + master-supplier suggestions.
      control = (
        <Autocomplete
          freeSolo
          forcePopupIcon
          options={mdrOptions}
          clearOnBlur={false}
          filterOptions={(x) => x}
          noOptionsText="No options"
          value={value || null}
          onChange={(e, v) => edit({ masterDatabaseRef: v || '' })}
          inputValue={value || ''}
          onInputChange={(e, v) => edit({ masterDatabaseRef: v })}
          componentsProps={{ paper: { sx: menuProps.PaperProps.sx } }}
          sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { ...selectSx, mb: 0, py: 0, minHeight: 42 } }}
          renderInput={(params) => <TextField {...params} placeholder={NO_VALUE} inputProps={{ ...params.inputProps, 'aria-label': f.label, 'data-testid': 'merged-masterDatabaseRef' }} />}
        />
      );
    } else if (f.kind === 'contacts') {
      const n = contactsCount(value);
      control = <ValueText testid="merged-additionalContacts" value={n ? `${n} Contact${n === 1 ? '' : 's'}` : ''} />;
    } else if (f.kind === 'switch') {
      control = (
        <Box sx={{ mb: 1.5, ml: -1 }}>
          <ShopfrontSwitch checked={Boolean(value)} onChange={(e) => edit({ [f.name]: e.target.checked })} inputProps={{ 'aria-label': f.label, 'data-testid': `merged-${f.name}` }} />
        </Box>
      );
    } else if (f.kind === 'money' || f.kind === 'percent') {
      control = (
        <InputBase
          value={value ?? ''}
          onChange={(e) => edit({ [f.name]: e.target.value })}
          inputProps={{ 'aria-label': f.label, 'data-testid': `merged-${f.name}`, inputMode: 'decimal' }}
          startAdornment={f.kind === 'money' ? <Box component="span" data-testid={`adorn-${f.name}`} sx={{ color: MUTED, mr: 1 }}>$</Box> : undefined}
          endAdornment={f.kind === 'percent' ? <Box component="span" data-testid={`adorn-${f.name}`} sx={{ color: MUTED, ml: 1 }}>%</Box> : undefined}
          sx={inputSx}
        />
      );
    } else {
      control = <InputBase value={value ?? ''} onChange={(e) => edit({ [f.name]: e.target.value })} inputProps={{ 'aria-label': f.label, 'data-testid': `merged-${f.name}` }} sx={inputSx} />;
    }
    return (
      <React.Fragment key={f.name}>
        <FieldLabel label={f.label} required={f.required} tick={tick} action={action} />
        {control}
      </React.Fragment>
    );
  };

  const renderResults = () => (
    <Box data-testid="merge-results-column" sx={colSx}>
      <Typography sx={{ fontSize: 20, color: TEXT, mb: 1.5 }}>Results</Typography>
      {SECTIONS.map((s) => (
        <SectionCard key={s.id} testid={`results-${s.id}`} title={s.title} selected={isResults(s)} onSelect={() => selectResults(s)}>
          {s.fields.map(resultsField)}
        </SectionCard>
      ))}
    </Box>
  );

  const renderSupplier = (s) => (
    <Box key={s.id} data-testid="merge-supplier-column" data-supplier-id={s.id} sx={colSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 20, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</Typography>
        <IconButton aria-label={`Remove ${s.name}`} onClick={() => removeSupplier(s.id)} sx={{ color: byMode('#e3342f', '#ffa2a2') }}><DeleteOutlineIcon /></IconButton>
      </Box>
      {SECTIONS.map((sec) => (
        <SectionCard key={sec.id} testid={`supplier-${s.id}-${sec.id}`} title={sec.title} selected={isFrom(sec, s.id)} dark={isFrom(sec, s.id)} onSelect={() => applyFields(sec.fields.map((f) => f.name), s)}>
          {sec.fields.map((f) => (
            <React.Fragment key={f.name}>
              <FieldLabel label={f.label} tick={fieldFrom(f.name, s.id)} />
              {f.kind === 'switch'
                ? <SwitchText testid={`supplier-${s.id}-${f.name}`} on={readValue(s, f.name)} onClick={() => applyFields([f.name], s)} />
                : <ValueText testid={`supplier-${s.id}-${f.name}`} value={shown(s, f.name)} onClick={() => applyFields([f.name], s)} />}
            </React.Fragment>
          ))}
        </SectionCard>
      ))}
    </Box>
  );

  // All Outlets: a merge belongs to one outlet - ask for it first (same prompt as Add Supplier).
  if (globalMode) {
    return (
      <Box sx={{ minHeight: 'calc(100vh - 50px)', bgcolor: byMode('#fff', '#121212'), px: '8px', pb: '8px' }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: TEXT, m: '20px 0 24px' }}>Supplier Merge</Typography>
        <Alert severity="info" data-testid="merge-outlet-prompt" sx={{ mb: 2, maxWidth: 640 }}>
          Suppliers are merged within one outlet. Select an outlet to merge suppliers.
        </Alert>
        <Button onClick={() => openOutletPicker(MERGE_SUPPLIERS_ACTION)} variant="contained" disableElevation sx={{ bgcolor: '#5ebbeb', color: byMode('#fff', '#232323'), height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#4aa9dd' } }}>
          Select Outlet
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: 'calc(100vh - 50px)', bgcolor: byMode('#fff', '#121212'), px: '8px', pb: '8px' }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: TEXT, m: '20px 0 24px' }}>Supplier Merge</Typography>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', pb: 2 }}>
        <Box sx={{ flexShrink: 0 }}>
          {renderResults()}
          <Button
            data-testid="complete-merge"
            disabled={!canMerge}
            onClick={() => setConfirmOpen(true)}
            sx={{ width: 400, height: 42, mt: 1, bgcolor: byMode('#00a6f4', '#0084d1'), color: '#fff', fontSize: 16, fontWeight: 700, textTransform: 'none', borderRadius: '8px', boxShadow: 'none', '&:hover': { bgcolor: byMode('#0090d6', '#0070b8') }, '&.Mui-disabled': { bgcolor: byMode('#00a6f4', '#0084d1'), color: '#fff', opacity: 0.5 } }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: '#fff' }} /> : 'Complete Merge'}
          </Button>
        </Box>
        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: byMode('#e0e0e0', '#333333'), flexShrink: 0 }} />
        {suppliers.map(renderSupplier)}
        <Box
          data-testid="add-supplier-card"
          role="button"
          tabIndex={0}
          onClick={openAdd}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAdd(); } }}
          sx={{ width: 400, minHeight: 760, flexShrink: 0, border: 1, borderStyle: 'dashed', borderColor: byMode('#bdbdbd', '#a1a1a1'), m: '8px', p: '8px', display: 'flex', cursor: 'pointer', '&:hover': { bgcolor: byMode('#fafafa', '#1a1a1a') } }}
        >
          <Box sx={{ flex: 1, border: 1, borderStyle: 'dashed', borderColor: byMode('#e0e0e0', '#555555'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT, fontSize: 16 }}>
            <AddIcon sx={{ fontSize: 20, mr: 0.5 }} /> Click to add a new supplier to merge
          </Box>
        </Box>
      </Box>

      {/* Add Supplier */}
      <BadgeDialog
        open={addOpen}
        onClose={adding ? undefined : () => setAddOpen(false)}
        title="Add Supplier"
        subtitle="Select supplier to add to the merge"
        testid="add-supplier-dialog"
        actions={<>
          <Button onClick={() => setAddOpen(false)} disabled={adding} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={confirmAdd} disabled={adding || !addPicked} data-testid="add-supplier-confirm" sx={dlgBtn(true)}>{adding ? 'Adding...' : 'Add'}</Button>
        </>}
      >
        <Autocomplete
          options={addOptions}
          value={addPicked}
          inputValue={addInput}
          onInputChange={(_, v, reason) => { if (reason !== 'reset') setAddInput(v); }}
          onChange={(_, v) => { setAddPicked(v); if (v) setAddInput(v.name || ''); }}
          getOptionLabel={(o) => o.name || ''}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          noOptionsText={addInput.trim() ? 'No suppliers found' : 'Keep Typing to Search...'}
          renderOption={(props, option) => (
            <li {...props} key={option.id} style={{ fontSize: 16, padding: '12px 16px' }}>{option.name}</li>
          )}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search for suppliers..." inputProps={{ ...params.inputProps, 'aria-label': 'Search for suppliers', 'data-testid': 'add-supplier-search' }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: byMode('#fff', '#121212'), minHeight: 44, py: 0, '& fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused fieldset': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} input::placeholder`]: { color: '#757575', opacity: 1 } } }} />
          )}
          ListboxProps={{ 'data-testid': 'add-supplier-options', style: { maxHeight: 300 } }}
          componentsProps={{ paper: { sx: { borderRadius: '8px', border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), boxShadow: '0 4px 12px rgba(0,0,0,0.15)', mt: 0.5, bgcolor: byMode('#fff', CARD_D), color: TEXT, '& .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: byMode('#6fcbf9', '#0084d1') }, '& .MuiAutocomplete-option.Mui-focused': { bgcolor: byMode('#6fcbf9', '#0084d1') }, [`${DARK_ONLY} .MuiAutocomplete-noOptions`]: { color: '#f8f8f8' } } } }}
          sx={{ textAlign: 'left' }}
        />
      </BadgeDialog>

      {/* Confirm */}
      <BadgeDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Complete Merge?"
        subtitle={`The following suppliers will be merged into "${String(merged.name || '').trim()}". All of their purchase history moves to the merged supplier and the others are removed. This cannot be reversed.`}
        testid="confirm-merge-dialog"
        actions={<>
          <Button onClick={() => setConfirmOpen(false)} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={doMerge} data-testid="confirm-merge-continue" sx={dlgBtn(true)}>Continue</Button>
        </>}
      >
        <Box component="ul" data-testid="confirm-merge-list" sx={{ textAlign: 'left', m: 0, pl: 3, fontSize: 16, color: TEXT }}>
          {suppliers.map((s) => <li key={s.id}>{s.name}</li>)}
        </Box>
      </BadgeDialog>
    </Box>
  );
};

export default SupplierMerge;
