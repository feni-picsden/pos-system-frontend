import React, { useState, useEffect, useRef } from 'react';
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
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import customerService from '../../services/customerService';
import customerGroupService from '../../services/customerGroupService';
import { byMode } from '../../theme/sfPalette';

// Reference (Customer Management > Customers > Merge Customers, help-centre
// article 115003820631 "Merging customers", screenshots 17/11/2026): "Customer
// Merge" page. A grey "Results" column on the left holds the merged customer,
// one grey column per added customer beside it, then a dashed "+ Click to add a
// new customer to merge" card. Every column has the same sections; a customer
// section's "Select Section" copies that section into Results (its fields get
// ticks, the Results section goes white), a single value can be picked by
// clicking it, and Results fields can be typed. "Complete Merge" asks to
// confirm with the list of customers being merged, then Continue runs the
// merge (backend POST /customers/merge: sales, invoices, gift cards, loyalty
// and balances move to the surviving customer, the others are removed).

const BLUE = '#b3e5fc';
const GREY = '#d9d9d9';
const DARK = '#313439';
const NO_VALUE = 'No Value';
// Dark-mode counterparts (same as Product Merge): blue section #0b4f80, columns / cards #232323, inputs #121212.
const BLUE_D = '#0b4f80';
const CARD_D = '#232323';
const TEXT = byMode('#000', '#f8f8f8');
const DARK_ONLY = 'html[data-theme="dark"] &';

const SECTIONS = [
  { id: 'general', title: 'General', fields: [
    { name: 'firstName', label: 'First Name', required: true },
    { name: 'lastName', label: 'Last Name', required: true },
    { name: 'company', label: 'Company' },
    { name: 'code', label: 'Code', clear: true },
    { name: 'customerGroupId', label: 'Customer Group', clear: true, kind: 'group' },
  ] },
  { id: 'contact', title: 'Contact', fields: [
    { name: 'emails', label: 'Emails', kind: 'emails' },
    { name: 'phone', label: 'Phone' },
    { name: 'mobile', label: 'Mobile' },
    { name: 'fax', label: 'Fax' },
  ] },
  { id: 'social', title: 'Social Media', fields: [
    { name: 'website', label: 'Website' },
    { name: 'twitter', label: 'Twitter' },
    { name: 'facebook', label: 'Facebook' },
  ] },
  { id: 'billing', title: 'Billing Address', fields: [
    { name: 'billingStreet1', label: 'Street Address 1' },
    { name: 'billingStreet2', label: 'Street Address 2' },
    { name: 'billingSuburb', label: 'Suburb' },
    { name: 'billingPostcode', label: 'Postcode / ZIP Code' },
    { name: 'billingState', label: 'State / Province' },
    { name: 'billingCountry', label: 'Country' },
  ] },
  { id: 'delivery', title: 'Delivery Address', fields: [
    { name: 'deliveryStreet1', label: 'Street Address 1' },
    { name: 'deliveryStreet2', label: 'Street Address 2' },
    { name: 'deliverySuburb', label: 'Suburb' },
    { name: 'deliveryPostcode', label: 'Postcode / ZIP Code' },
    { name: 'deliveryState', label: 'State / Province' },
    { name: 'deliveryCountry', label: 'Country' },
  ] },
  { id: 'misc', title: 'Miscellaneous', fields: [
    { name: 'businessNumber', label: 'Business Number' },
    { name: 'birthday', label: 'Birthday', kind: 'date' },
    { name: 'gender', label: 'Gender', kind: 'gender' },
    { name: 'invoiceMessage', label: 'Invoice and Statement Message' },
    { name: 'internalComments', label: 'Comments (Internal)' },
  ] },
];

const ALL_FIELDS = SECTIONS.flatMap((s) => s.fields.map((f) => f.name));
const blankForm = () => Object.fromEntries(ALL_FIELDS.map((f) => [f, '']));

const GENDER_LABEL = { male: 'Male', female: 'Female', other: 'Other' };
const genderText = (v) => GENDER_LABEL[String(v || '').toLowerCase()] || 'Not Specified';

// ISO (yyyy-mm-dd...) -> dd/mm/yyyy for display / typing; back again on merge.
const isoToDmy = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(v || '');
};
const dmyToIso = (v) => {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\s*$/.exec(String(v || ''));
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : (v || '');
};

// What a customer holds for a Results field (strings; group as id string).
const readValue = (customer, field) => {
  if (field === 'emails') return (customer.emails || []).filter(Boolean).join(', ');
  if (field === 'customerGroupId') return customer.customerGroupId ? String(customer.customerGroupId) : '';
  if (field === 'birthday') return isoToDmy(customer.birthday);
  if (field === 'gender') return String(customer.gender || '').toLowerCase();
  const v = customer[field];
  return v === null || v === undefined ? '' : String(v);
};

const customerLabel = (c) => `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.company || `#${c.id}`;

// ---------- small building blocks (same chrome as Product Merge) ----------
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
    sx={{ fontSize: 16, color: value ? TEXT : byMode('#8a8d91', '#d4d4d4'), px: 1, py: 0.5, mb: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: onClick ? 'pointer' : 'default', borderRadius: '4px', '&:hover': onClick ? { bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)') } : undefined }}
  >
    {value || NO_VALUE}
  </Typography>
);
const inputSx = { width: '100%', border: byMode('1px solid #000', '1px solid #a1a1a1'), borderRadius: '4px', bgcolor: byMode('#fff', '#121212'), px: 1.5, fontSize: 16, minHeight: 50, mb: 1.5, fontFamily: 'inherit', '& input::placeholder': { color: byMode('#9e9e9e', '#757575'), opacity: 1 }, [DARK_ONLY]: { color: '#f8f8f8' } };
const selectSx = { width: '100%', mb: 1.5, bgcolor: byMode('#fff', '#121212'), borderRadius: '8px', fontSize: 16, minHeight: 42, '& .MuiSelect-select': { py: 1 }, '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} .MuiSelect-icon`]: { color: '#f8f8f8' } };
const ClearBtn = ({ onClick, testid }) => (
  <Button data-testid={testid} onClick={onClick} startIcon={<CloseIcon sx={{ fontSize: 16 }} />} sx={{ color: byMode(DARK, '#d4d4d4'), border: byMode('1px solid #313439', '1px solid #a1a1a1'), borderRadius: '2px', bgcolor: byMode('#f8f8f8', 'transparent'), fontSize: 15, textTransform: 'none', px: 1.25, py: 0.25, minWidth: 0, '&:hover': { bgcolor: byMode('#eee', '#333333') } }}>
    Clear
  </Button>
);
const SectionCard = ({ title, selected, dark, onSelect, children, testid }) => (
  <Box data-testid={testid} data-selected={selected ? '1' : '0'} sx={{ bgcolor: selected ? byMode(BLUE, BLUE_D) : byMode('#fff', CARD_D), p: 2, mb: 2, borderRadius: 0, ...(selected ? {} : { [DARK_ONLY]: { boxShadow: '0 0 0 1px #373737' } }) }}>
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <Typography sx={{ fontSize: 20, color: TEXT }}>{title}</Typography>
      <Button
        onClick={onSelect}
        sx={{ fontSize: 18, textTransform: 'none', borderRadius: '2px', px: 1.25, py: 0.5, border: dark ? byMode(`1px solid ${DARK}`, '1px solid #f8f8f8') : byMode('1px solid #9e9e9e', '1px solid #a1a1a1'), bgcolor: dark ? byMode(DARK, '#3a3a3a') : byMode('#f3f3f3', 'transparent'), color: dark ? byMode('#fff', '#f8f8f8') : byMode('#555', '#d4d4d4'), fontWeight: 400, '&:hover': { bgcolor: dark ? byMode(DARK, '#4a4a4a') : byMode('#e6e6e6', '#333333') } }}
      >
        Select Section
      </Button>
    </Box>
    {children}
  </Box>
);
const BadgeDialog = ({ open, onClose, title, subtitle, children, actions, testid }) => (
  <Dialog open={open} onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 480, maxWidth: 'calc(100vw - 32px)', overflow: 'visible', borderRadius: 0, mt: 8 }, 'data-testid': testid }}>
    <Box aria-hidden sx={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 118, height: 118, borderRadius: '50%', bgcolor: byMode('#2d8ff5', '#1c86f2'), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 72, fontWeight: 700, lineHeight: 1 }}>?</Box>
    <Box sx={{ pt: 8.5, px: 2, pb: 2, textAlign: 'center', color: byMode(undefined, '#f8f8f8') }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: TEXT, mb: 1 }}>{title}</Typography>
      {subtitle && <Typography sx={{ fontSize: 16, color: TEXT, mb: 2 }}>{subtitle}</Typography>}
      {children}
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>{actions}</Box>
    </Box>
  </Dialog>
);
const dlgBtn = (primary) => ({ flex: 1, height: 48, fontSize: 24, fontWeight: 400, textTransform: 'none', borderRadius: '4px', boxShadow: 'none', bgcolor: primary ? byMode('#32b643', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#676b72', '#f8f8f8'), border: primary ? byMode('1px solid #32b643', '1px solid #7bf1a8') : byMode('1px solid #d4d4d4', '1px solid #5a5a5a'), '&:hover': { bgcolor: primary ? byMode('#2a9c39', '#8ff5b8') : byMode('#e5e7eb', '#4a4a4a'), boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: primary ? byMode('#a5d9ad', '#7bf1a8') : byMode('#f3f4f6', '#3a3a3a'), color: primary ? byMode('#fff', '#232323') : byMode('#bbb', '#757575') } });

// ---------- page ----------
const CustomerMerge = () => {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [merged, setMerged] = useState(blankForm);
  // field -> customer id the value was picked from (absent = typed / Results)
  const [picks, setPicks] = useState({});
  const [groups, setGroups] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addInput, setAddInput] = useState('');
  const [addOptions, setAddOptions] = useState([]);
  const [addPicked, setAddPicked] = useState(null);
  const [addSearching, setAddSearching] = useState(false);
  const searchTimer = useRef(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    customerGroupService.getCustomerGroups()
      .then((r) => setGroups(Array.isArray(r) ? r : (r?.customerGroups || r?.groups || [])))
      .catch(() => setGroups([]));
  }, []);

  // ---- search (server side, debounced) ----
  useEffect(() => {
    if (!addOpen) return undefined;
    const q = addInput.trim();
    if (!q) { setAddOptions([]); return undefined; }
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      try {
        setAddSearching(true);
        const r = await customerService.getCustomers({ search: q, limit: 50 });
        setAddOptions((r?.customers || []).filter((c) => !customers.some((x) => x.id === c.id)));
      } catch { setAddOptions([]); }
      finally { setAddSearching(false); }
    }, 250);
    return () => clearTimeout(searchTimer.current);
  }, [addInput, addOpen, customers]);

  const openAdd = () => { setAddPicked(null); setAddInput(''); setAddOptions([]); setAddOpen(true); };

  const groupName = (id) => groups.find((g) => String(g.id) === String(id))?.name || '';
  const shown = (c, field) => {
    const v = readValue(c, field);
    if (field === 'customerGroupId') return c.customerGroup?.name || groupName(v);
    if (field === 'gender') return genderText(v);
    return v;
  };

  const applyFields = (fields, customer) => {
    setMerged((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, readValue(customer, f)])) }));
    setPicks((prev) => ({ ...prev, ...Object.fromEntries(fields.map((f) => [f, customer.id])) }));
  };
  const edit = (patch) => {
    setMerged((prev) => ({ ...prev, ...patch }));
    setPicks((prev) => { const n = { ...prev }; Object.keys(patch).forEach((k) => delete n[k]); return n; });
  };
  const clearField = (field) => edit({ [field]: '' });
  const selectResults = (section) => setPicks((prev) => { const n = { ...prev }; section.fields.forEach((f) => delete n[f.name]); return n; });

  const confirmAdd = () => {
    if (!addPicked) return;
    const c = addPicked;
    setCustomers((prev) => {
      if (prev.some((x) => x.id === c.id)) return prev;
      // The first customer added is the survivor: seed Results from it.
      if (prev.length === 0) applyFields(ALL_FIELDS, c);
      return [...prev, c];
    });
    setAddOpen(false);
  };

  const removeCustomer = (id) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    // Values picked from the removed card are blanked - no source left behind them.
    const gone = Object.entries(picks).filter(([, cid]) => cid === id).map(([f]) => f);
    setMerged((prev) => ({ ...prev, ...Object.fromEntries(gone.map((f) => [f, ''])) }));
    setPicks((prev) => Object.fromEntries(Object.entries(prev).filter(([, cid]) => cid !== id)));
  };

  const isFrom = (section, customerId) => section.fields.every((f) => picks[f.name] === customerId);
  const isResults = (section) => section.fields.every((f) => picks[f.name] === undefined || !customers.some((c) => c.id === picks[f.name]));
  const fieldFrom = (field, customerId) => picks[field] === customerId;

  const canMerge = customers.length >= 2 && String(merged.firstName).trim() !== '' && String(merged.lastName).trim() !== '' && !loading;

  const doMerge = async () => {
    setConfirmOpen(false);
    try {
      setLoading(true); setError('');
      const data = {
        ...merged,
        firstName: merged.firstName.trim(),
        lastName: merged.lastName.trim(),
        emails: String(merged.emails || '').split(',').map((e) => e.trim()).filter(Boolean),
        birthday: merged.birthday ? dmyToIso(merged.birthday) : '',
        gender: merged.gender || '',
        customerGroupId: merged.customerGroupId || '',
      };
      const result = await customerService.mergeCustomers({
        customerIds: customers.map((c) => c.id),
        primaryId: customers[0].id,
        data,
      });
      navigate(`/customers/${result.customer.id}/view`);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to merge customers');
    } finally { setLoading(false); }
  };

  // ---------- renderers ----------
  const colSx = { width: 400, flexShrink: 0, bgcolor: byMode(GREY, CARD_D), p: 2, pt: 1.5, alignSelf: 'flex-start' };

  const resultsField = (section, f) => {
    const tick = picks[f.name] === undefined;
    const action = f.clear ? <ClearBtn testid={`clear-${f.name}`} onClick={() => clearField(f.name)} /> : undefined;
    let control;
    if (f.kind === 'emails') {
      control = <ValueText testid="merged-emails" value={merged.emails} />;
    } else if (f.kind === 'group') {
      control = merged.customerGroupId ? (
        <ValueText testid="merged-group" value={groupName(merged.customerGroupId) || customers.find((c) => c.id === picks.customerGroupId)?.customerGroup?.name || ''} />
      ) : (
        <Select displayEmpty value="" onChange={(e) => edit({ customerGroupId: e.target.value ? String(e.target.value) : '' })} inputProps={{ 'aria-label': 'Customer Group' }} sx={selectSx} renderValue={() => <Box component="span" sx={{ color: byMode('#9e9e9e', '#757575') }}>{NO_VALUE}</Box>}>
          <MenuItem value="" sx={{ fontSize: 16 }}>{NO_VALUE}</MenuItem>
          {groups.map((g) => <MenuItem key={g.id} value={g.id} sx={{ fontSize: 16 }}>{g.name}</MenuItem>)}
        </Select>
      );
    } else if (f.kind === 'gender') {
      control = (
        <Select displayEmpty value={merged.gender || ''} onChange={(e) => edit({ gender: e.target.value })} inputProps={{ 'aria-label': 'Gender' }} sx={selectSx} renderValue={(v) => (v ? GENDER_LABEL[v] : <Box component="span" sx={{ color: byMode('#9e9e9e', '#757575') }}>Select...</Box>)}>
          <MenuItem value="male" sx={{ fontSize: 16 }}>Male</MenuItem>
          <MenuItem value="female" sx={{ fontSize: 16 }}>Female</MenuItem>
          <MenuItem value="" sx={{ fontSize: 16 }}>Not Specified</MenuItem>
          {merged.gender === 'other' && <MenuItem value="other" sx={{ fontSize: 16 }}>Other</MenuItem>}
        </Select>
      );
    } else {
      control = <InputBase value={merged[f.name] ?? ''} placeholder={f.kind === 'date' ? 'DD/MM/YYYY' : ''} onChange={(e) => edit({ [f.name]: e.target.value })} inputProps={{ 'aria-label': f.label, 'data-testid': `merged-${f.name}` }} sx={inputSx} />;
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
          {s.fields.map((f) => resultsField(s, f))}
        </SectionCard>
      ))}
    </Box>
  );

  const renderCustomer = (c) => (
    <Box key={c.id} data-testid="merge-customer-column" data-customer-id={c.id} sx={colSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontSize: 20, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customerLabel(c)}</Typography>
        <IconButton aria-label={`Remove ${customerLabel(c)}`} onClick={() => removeCustomer(c.id)} sx={{ color: byMode('#e3342f', '#ffa2a2') }}><DeleteOutlineIcon /></IconButton>
      </Box>
      {SECTIONS.map((s) => (
        <SectionCard key={s.id} testid={`customer-${c.id}-${s.id}`} title={s.title} selected={isFrom(s, c.id)} dark={isFrom(s, c.id)} onSelect={() => applyFields(s.fields.map((f) => f.name), c)}>
          {s.fields.map((f) => (
            <React.Fragment key={f.name}>
              <FieldLabel label={f.label} tick={fieldFrom(f.name, c.id)} />
              <ValueText testid={`customer-${c.id}-${f.name}`} value={shown(c, f.name)} onClick={() => applyFields([f.name], c)} />
            </React.Fragment>
          ))}
        </SectionCard>
      ))}
    </Box>
  );

  return (
    <Box sx={{ minHeight: 'calc(100vh - 50px)', bgcolor: byMode('#f5f5f5', '#121212'), px: '8px', pb: '8px' }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: TEXT, m: '20px 0 24px' }}>Customer Merge</Typography>
      {error && <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: '16px', alignItems: 'flex-start', overflowX: 'auto', pb: 2 }}>
        <Box sx={{ flexShrink: 0 }}>
          {renderResults()}
          <Button
            data-testid="complete-merge"
            disabled={!canMerge}
            onClick={() => setConfirmOpen(true)}
            sx={{ width: 400, height: 42, mt: 1, bgcolor: byMode('#1ea7e8', '#5ebbeb'), color: byMode('#fff', '#232323'), fontSize: 16, fontWeight: 700, textTransform: 'none', borderRadius: '8px', boxShadow: 'none', '&:hover': { bgcolor: byMode('#1890c9', '#4aa9dd') }, '&.Mui-disabled': { bgcolor: byMode('#e0e0e0', '#3a3a3a'), color: byMode('#9e9e9e', '#a0a4aa') } }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: byMode('#fff', '#232323') }} /> : 'Complete Merge'}
          </Button>
        </Box>
        <Box sx={{ width: '1px', alignSelf: 'stretch', bgcolor: byMode('#e0e0e0', '#333333'), flexShrink: 0 }} />
        {customers.map(renderCustomer)}
        <Box
          data-testid="add-customer-card"
          role="button"
          tabIndex={0}
          onClick={openAdd}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openAdd(); } }}
          sx={{ width: 400, minHeight: 760, flexShrink: 0, border: byMode('1px dashed #bdbdbd', '1px dashed #a1a1a1'), m: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: TEXT, fontSize: 16, '&:hover': { bgcolor: byMode('#fafafa', '#1a1a1a') } }}
        >
          <AddIcon sx={{ fontSize: 20, mr: 0.5 }} /> Click to add a new customer to merge
        </Box>
      </Box>

      {/* Add Customer */}
      <BadgeDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add Customer"
        subtitle="Select customer to add to the merge"
        testid="add-customer-dialog"
        actions={<>
          <Button onClick={() => setAddOpen(false)} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={confirmAdd} disabled={!addPicked} data-testid="add-customer-confirm" sx={dlgBtn(true)}>Add</Button>
        </>}
      >
        <Autocomplete
          options={addOptions}
          value={addPicked}
          loading={addSearching}
          inputValue={addInput}
          onInputChange={(_, v, reason) => { if (reason !== 'reset') setAddInput(v); }}
          onChange={(_, v) => { setAddPicked(v); if (v) setAddInput(customerLabel(v)); }}
          getOptionLabel={(o) => customerLabel(o)}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          noOptionsText={addInput.trim() ? (addSearching ? 'Searching...' : 'No customers found') : 'Keep Typing to Search...'}
          renderOption={(props, option) => (
            <li {...props} key={option.id} style={{ fontSize: 16, padding: '12px 16px' }}>{customerLabel(option)}</li>
          )}
          renderInput={(params) => (
            <TextField {...params} placeholder="Search for customer..." inputProps={{ ...params.inputProps, 'aria-label': 'Search for customer', 'data-testid': 'add-customer-search' }} sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px', bgcolor: byMode('#fff', '#121212'), minHeight: 44, py: 0, '& fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&:hover fieldset': { borderColor: byMode('#000', '#a1a1a1') }, '&.Mui-focused fieldset': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 }, [DARK_ONLY]: { color: '#f8f8f8' }, [`${DARK_ONLY} input::placeholder`]: { color: '#757575', opacity: 1 } } }} />
          )}
          ListboxProps={{ 'data-testid': 'add-customer-options', style: { maxHeight: 300 } }}
          componentsProps={{ paper: { sx: { borderRadius: '8px', border: byMode('1px solid #000', '1px solid #a1a1a1'), boxShadow: '0 4px 12px rgba(0,0,0,0.15)', mt: 0.5, '& .MuiAutocomplete-option[aria-selected="true"]': { bgcolor: byMode('#6fcbf9', '#0084d1') }, '& .MuiAutocomplete-option.Mui-focused': { bgcolor: byMode('#6fcbf9', '#0084d1') }, [`${DARK_ONLY} .MuiAutocomplete-option.Mui-focused, ${DARK_ONLY} .MuiAutocomplete-option[aria-selected="true"]`]: { color: '#fafafa' }, [`${DARK_ONLY} .MuiAutocomplete-noOptions, ${DARK_ONLY} .MuiAutocomplete-loading`]: { color: '#f8f8f8' } } } }}
          sx={{ textAlign: 'left' }}
        />
      </BadgeDialog>

      {/* Confirm */}
      <BadgeDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Complete Merge?"
        subtitle="The following customers will be merged into one. Their sales, invoices, gift cards, loyalty points and balances are combined. This cannot be reversed."
        testid="confirm-merge-dialog"
        actions={<>
          <Button onClick={() => setConfirmOpen(false)} sx={dlgBtn(false)}>Cancel</Button>
          <Button onClick={doMerge} data-testid="confirm-merge-continue" sx={dlgBtn(true)}>Continue</Button>
        </>}
      >
        <Box component="ul" data-testid="confirm-merge-list" sx={{ textAlign: 'left', m: 0, pl: 3, fontSize: 16 }}>
          {customers.map((c) => <li key={c.id}>{customerLabel(c)}{c.code ? ` (${c.code})` : ''}</li>)}
        </Box>
      </BadgeDialog>
    </Box>
  );
};

export default CustomerMerge;
