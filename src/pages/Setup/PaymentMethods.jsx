import React, { useState, useEffect, useCallback } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Tooltip,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Add as AddIcon,
  Remove as RemoveIcon,
  KeyboardOutlined as KeyboardOutlinedIcon,
  LockOutlined as LockOutlinedIcon,
  ArrowBack as ArrowBackIcon,
  SaveOutlined as SaveOutlinedIcon,
} from '@mui/icons-material';
import PaymentMethodDialog, { TypeCombobox } from '../../components/PaymentMethods/PaymentMethodDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ColorInput from '../../components/Common/ColorInput';
import { BLUE, REF_MENU_PROPS } from '../../components/Common/refMenuProps';
import { useHasPermission } from '../../hooks/usePermissions';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import paymentMethodService from '../../services/paymentMethodService';
import posLocalDb from '../../services/posLocalDb';
import PageSaveBar, { SAVE_BAR_CLEARANCE } from '../../components/Common/PageSaveBar';

// Reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';
const GREEN = '#32b643';
const RED = '#e3342f';

// Same text the reference shows on the keyboard glyph, and the server's 409.
const IN_SALE_KEYS_TEXT = 'This Payment Method is being used in sales keys and cannot be deleted';

// '+ New': white, 1px light-blue border, blue text, ~120x40, 8px radius.
const NEW_BUTTON_SX = {
  bgcolor: '#fff',
  border: '1px solid #5ebbeb',
  color: '#5ebbeb',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '8px',
  fontWeight: 700,
  fontSize: 16,
  height: 40,
  minWidth: 120,
  px: 2,
  transition: INSTANT,
  '&:hover': { bgcolor: '#f3faff', border: '1px solid #5ebbeb', boxShadow: 'none' },
};

// Inline row actions: coloured text + outline glyph; a blocked Delete stays
// visible as a grey pill (ref).
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  height: 36,
  borderRadius: '999px',
  minWidth: 0,
  px: 1.5,
  gap: 1,
  transition: INSTANT,
  '&:hover': { bgcolor: 'transparent', opacity: 0.7 },
  '&.Mui-disabled': { bgcolor: '#e8e8e8', color: '#9e9e9e' },
});

// Outline glyphs (same strokes as TemplateListActions).
const OutlineGlyph = ({ name }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === 'pencil' ? (
      <>
        <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        <path d="m15 5 4 4" />
      </>
    ) : (
      <>
        <path d="M3 6h18" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M10 11v6M14 11v6" />
      </>
    )}
  </svg>
);

// Light tooltip with a rounded border (ref keyboard-glyph tooltip).
const LIGHT_TOOLTIP = {
  tooltip: {
    sx: {
      bgcolor: '#fff', color: '#000', border: '1px solid #d4d4d4', borderRadius: '8px',
      fontSize: 14, fontWeight: 400, px: 1.5, py: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.12)', maxWidth: 320,
    },
  },
};

const FIELD_LABEL_SX = { fontSize: 16, color: '#000', mb: 0.5 };

// Square input, 1px black border (ref edit page).
const SQUARE_INPUT_SX = {
  width: '100%',
  height: 42,
  border: '1px solid #000',
  borderRadius: 0,
  px: 1.5,
  bgcolor: '#fff',
  fontFamily: 'inherit',
  fontSize: 16,
  color: '#000',
  outline: 'none',
  boxSizing: 'border-box',
  '&::placeholder': { color: '#808080', opacity: 1 },
};

// Integration-managed types (Linkly / Tyro tenders) stay undeletable. An
// External "Custom" method is an ordinary record. Same list as the server.
const LOCKED_TYPES = ['Linkly', 'Linkly Value Added Applications', 'Tyro'];

// Close Register's own fallback list (CloseRegister.jsx DEFAULT_DENOMINATIONS):
// a Cash method with nothing saved shows these, so the screens agree.
const DEFAULT_DENOMINATIONS = ['0.05', '0.1', '0.2', '0.5', '1', '2', '5', '10', '20', '50', '100'];

const DEFAULT_SETTINGS = {
  alwaysOpenCashDrawer: false,
  alwaysPrintReceipt: false,
  useRounding: false,
  allowCashOut: false,
  // "Cash Out Method" (shown while Allow Cash Out is on): the Cash-type method
  // the cash handed over comes out of. '' = the Cash method.
  cashOutMethod: '',
  // "Default to Pay Exact" = can this method be used without typing an amount
  // first? On by default for every method, Cash included: pressing a tender with
  // an empty input takes the exact remaining balance. Turn it off per method to
  // force a typed amount (the reference ships Cash that way; we don't).
  // A blanket false here used to stamp "needs an amount first" onto EFTPOS the
  // moment anyone opened a method and pressed Save, disabling its tile.
  defaultToPayExact: true,
  closeRegisterDenominations: '',
  predictionDenominations: '',
  // Colours start UNSET: an untouched method saves none, so its sell-screen tile
  // keeps the theme's own look (and follows dark mode). The swatch shows white.
};

const COLOUR_FIELDS = [
  { key: 'buttonBackgroundColour', label: 'Payment Button Background Colour' },
  { key: 'buttonTextColour', label: 'Payment Button Text Colour' },
  { key: 'buttonBackgroundColourDark', label: 'Payment Button Background Colour (Dark Mode)' },
  { key: 'buttonTextColourDark', label: 'Payment Button Text Colour (Dark Mode)' },
];

// Reference order.
const TOGGLE_FIELDS = [
  { key: 'alwaysOpenCashDrawer', label: 'Always Open Cash Drawer' },
  { key: 'alwaysPrintReceipt', label: 'Always Print Receipt' },
  { key: 'useRounding', label: 'Use Rounding' },
  { key: 'defaultToPayExact', label: 'Default to Pay Exact' },
  { key: 'allowCashOut', label: 'Allow Cash Out' },
];

const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NAME_MAX = 100; // same limit as the server

const parseSettings = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

// '0.10' and '0.1' are one denomination; cents precision like the count screen.
const toAmount = (s) => {
  const t = String(s ?? '').trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
};

/**
 * Normalise a denomination list: drops empty / non-numeric entries and
 * duplicates, sorts ascending. Returns { list, error } — error when any entry
 * is zero or negative (those are refused, not silently dropped).
 */
const normaliseDenominations = (values) => {
  const out = [];
  for (const v of values) {
    const n = toAmount(v);
    if (n === null || Number.isNaN(n)) continue;
    if (n <= 0) return { list: null, error: `Denomination ${String(v).trim()} must be greater than 0` };
    if (!out.includes(n)) out.push(n);
  }
  return { list: out.sort((a, b) => a - b), error: '' };
};

const splitCsv = (csv) => String(csv || '').split(',').map((s) => s.trim()).filter(Boolean);

const ColourSwatch = ({ label, value, onChange }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={FIELD_LABEL_SX}>{label}</Typography>
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: 40,
        border: '5px solid #000',
        boxSizing: 'border-box',
        bgcolor: HEX.test(String(value || '')) ? value : '#ffffff',
      }}
    >
      <ColorInput aria-label={label} value={HEX.test(String(value || '')) ? value : '#ffffff'} onChange={(e) => onChange(e.target.value)} />
    </Box>
  </Box>
);

// 52px square side button of a denomination row.
const denomButtonSx = (kind) => ({
  width: 52,
  minWidth: 52,
  height: 52,
  p: 0,
  border: '1px solid #000',
  borderLeft: 0,
  borderRadius: 0,
  bgcolor: '#f8f8f8',
  color: kind === 'add' ? GREEN : RED,
  boxShadow: 'none',
  transition: INSTANT,
  '&:hover': { bgcolor: kind === 'add' ? GREEN : RED, color: '#fff', boxShadow: 'none' },
});

const DenominationsColumn = ({ values, onChange, error, setError }) => {
  const [draft, setDraft] = useState('');

  const add = () => {
    const n = toAmount(draft);
    if (n === null) return; // empty: ignore
    if (Number.isNaN(n)) { setError(`"${draft.trim()}" is not a number`); return; }
    if (n <= 0) { setError('Denomination must be greater than 0'); return; }
    if (values.some((v) => toAmount(v) === n)) { setDraft(''); setError(`${n} is already in the list`); return; }
    const { list } = normaliseDenominations([...values, String(n)]);
    onChange(list.map(String));
    setDraft('');
    setError('');
  };

  return (
    <Box sx={{ width: 448 }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 2 }}>Close Register Denominations</Typography>
      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
      {values.map((v, i) => (
        <Box key={i} sx={{ display: 'flex', mb: 1.5 }}>
          <Box
            component="input"
            type="text"
            inputMode="decimal"
            aria-label={`Denomination ${i + 1}`}
            value={v}
            onChange={(e) => { const next = [...values]; next[i] = e.target.value; onChange(next); setError(''); }}
            sx={{ ...SQUARE_INPUT_SX, width: 396, height: 52 }}
          />
          <Button
            disableRipple
            aria-label={`Remove denomination ${v}`}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
            sx={denomButtonSx('remove')}
          >
            <RemoveIcon />
          </Button>
        </Box>
      ))}
      <Box sx={{ display: 'flex', mb: 1.5 }}>
        <Box
          component="input"
          type="text"
          inputMode="decimal"
          aria-label="New denomination"
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          sx={{ ...SQUARE_INPUT_SX, width: 396, height: 52 }}
        />
        <Button disableRipple aria-label="Add denomination" onClick={add} sx={denomButtonSx('add')}>
          <AddIcon />
        </Button>
      </Box>
    </Box>
  );
};

/**
 * Edit surface matching the reference "Editing Payment Method" page. Rendered
 * in place of the list — this app has no /settings/payment/:id/edit route.
 */
const EditPaymentMethodView = ({ method, cashMethods = [], onBack, onSaved }) => {
  const stored = parseSettings(method.masterDatabaseRef);
  const foreignRef = Boolean(method.masterDatabaseRef) && !stored;
  const [name, setName] = useState(method.name || '');
  const [type, setType] = useState(method.type || 'Cash');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(stored || {}) });
  const [denoms, setDenoms] = useState(() => {
    const saved = splitCsv(stored?.closeRegisterDenominations);
    return saved.length ? saved : [...DEFAULT_DENOMINATIONS];
  });
  const [denomError, setDenomError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));
  // Cash-type methods this outlet sees (Cash first); a stored name that is no
  // longer among them stays listed so it is not silently replaced.
  const cashOutOptions = [...new Set([
    ...cashMethods.map((m) => m.name).sort((a, b) => (a === 'Cash' ? -1 : b === 'Cash' ? 1 : a.localeCompare(b))),
    ...(settings.cashOutMethod ? [settings.cashOutMethod] : []),
  ])];
  const cashOutValue = settings.cashOutMethod || (cashOutOptions.includes('Cash') ? 'Cash' : cashOutOptions[0] || '');
  // Typing again clears a stale save error (e.g. the rename refusal) so the
  // banner does not outlive the mistake it reported.
  const setNameAndClear = (value) => { setName(value); if (error) setError(''); };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Payment method name is required');
      return;
    }
    if (name.trim().length > NAME_MAX) {
      setError(`Payment method name must be ${NAME_MAX} characters or fewer`);
      return;
    }
    const close = type === 'Cash' ? normaliseDenominations(denoms) : { list: [], error: '' };
    if (close.error) { setDenomError(close.error); return; }
    const predicted = normaliseDenominations(splitCsv(settings.predictionDenominations));
    if (predicted.error) { setError(`Prediction ${predicted.error.charAt(0).toLowerCase()}${predicted.error.slice(1)}`); return; }
    const next = {
      ...settings,
      predictionDenominations: predicted.list.join(','),
    };
    if (settings.allowCashOut) next.cashOutMethod = cashOutValue;
    else if (!next.cashOutMethod) delete next.cashOutMethod;
    // Only a Cash method has a till count; any other type keeps what it had
    // (normally nothing) instead of being stamped with the default list.
    if (type === 'Cash') next.closeRegisterDenominations = close.list.join(',');
    else if (stored?.closeRegisterDenominations !== undefined) next.closeRegisterDenominations = stored.closeRegisterDenominations;
    else delete next.closeRegisterDenominations;
    // Unset (or a legacy bad hex the server would refuse) = no colour saved.
    COLOUR_FIELDS.forEach(({ key }) => { if (!HEX.test(String(next[key] || ''))) delete next[key]; });
    try {
      setSaving(true);
      setError('');
      // ponytail: settings ride in masterDatabaseRef as JSON — schema changes are
      // off-limits; move to dedicated columns if the sell screen ever consumes them.
      await paymentMethodService.updatePaymentMethod(method.id, {
        name: name.trim(),
        type,
        masterDatabaseRef: foreignRef ? method.masterDatabaseRef : JSON.stringify(next),
      });
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment method');
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3, pb: `${SAVE_BAR_CLEARANCE}px` }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          disableRipple
          disableElevation
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{
            bgcolor: BLUE,
            color: '#fff',
            textTransform: 'none',
            borderRadius: 0,
            fontWeight: 700,
            fontSize: 16,
            height: 32,
            px: 1.5,
            boxShadow: 'none',
            transition: INSTANT,
            '&:hover': { bgcolor: '#1574d6', boxShadow: 'none' },
          }}
        >
          Back
        </Button>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>
          Editing Payment Method
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2, maxWidth: 960 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 6, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Box sx={{ width: 450, maxWidth: '100%' }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 2 }}>Payment Method Settings</Typography>

          <Typography sx={FIELD_LABEL_SX}>Name</Typography>
          <Box
            component="input"
            type="text"
            aria-label="Name"
            maxLength={NAME_MAX}
            value={name}
            onChange={(e) => setNameAndClear(e.target.value)}
            sx={{ ...SQUARE_INPUT_SX, mb: 2 }}
          />

          <Typography sx={FIELD_LABEL_SX}>Type</Typography>
          <Box sx={{ mb: 2 }}>
            <TypeCombobox value={type} onChange={setType} borderColor="#000" />
          </Box>

          {COLOUR_FIELDS.map((f) => (
            <ColourSwatch key={f.key} label={f.label} value={settings[f.key]} onChange={(v) => setSetting(f.key, v)} />
          ))}

          {TOGGLE_FIELDS.map((field) => (
            <Box key={field.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography sx={{ fontSize: 16, color: '#000' }}>{field.label}</Typography>
              <ShopfrontSwitch
                checked={Boolean(settings[field.key])}
                onChange={(e) => setSetting(field.key, e.target.checked)}
                inputProps={{ 'aria-label': field.label }}
              />
            </Box>
          ))}

          {/* Reference: appears under the toggles only while Allow Cash Out is on. */}
          {settings.allowCashOut && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={FIELD_LABEL_SX}>Cash Out Method</Typography>
              <Select
                fullWidth
                displayEmpty
                value={cashOutValue}
                onChange={(e) => setSetting('cashOutMethod', e.target.value)}
                MenuProps={REF_MENU_PROPS}
                inputProps={{ 'aria-label': 'Cash Out Method' }}
                sx={{ height: 42, borderRadius: '8px', bgcolor: '#fff', '& fieldset': { borderColor: '#000' } }}
              >
                {cashOutOptions.map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </Select>
            </Box>
          )}

          {/* Not on the reference screenshot, kept because the sell screen's
              predicted-amount row reads it (FinalizeSaleDialog). */}
          <Typography sx={{ ...FIELD_LABEL_SX, mt: 1 }}>Prediction Denominations</Typography>
          <Box
            component="input"
            type="text"
            aria-label="Prediction Denominations"
            placeholder="e.g. 5,10,20,50,100"
            value={settings.predictionDenominations}
            onChange={(e) => setSetting('predictionDenominations', e.target.value)}
            sx={SQUARE_INPUT_SX}
          />
        </Box>

        {/* Reference: only a Cash method has a till count. Other types keep any
            stored list untouched. */}
        {type === 'Cash' && (
          <DenominationsColumn values={denoms} onChange={setDenoms} error={denomError} setError={setDenomError} />
        )}
      </Box>

      <PageSaveBar onSave={handleSave} saving={saving} icon={<SaveOutlinedIcon />} />
    </Box>
  );
};

const PaymentMethods = () => {
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [editingMethod, setEditingMethod] = useState(null);
  const [methodToDelete, setMethodToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Permission checks
  const canAddPaymentMethods = useHasPermission('payment_methods.add');
  const canEditPaymentMethods = useHasPermission('payment_methods.edit');
  const canDeletePaymentMethods = useHasPermission('payment_methods.delete');

  const { selectedOutletId } = useSelectedOutlet();

  // Always a fresh server read: the list's usedInSaleKeys flag (keyboard glyph,
  // greyed Delete) must reflect the sale keys as they are now. apiClient adds the
  // navbar outlet for a global admin, so an outlet pick shows that outlet's
  // methods plus the global ones. Offline: fall back to the cached copy.
  const loadPaymentMethods = useCallback(async () => {
    try {
      const fresh = await paymentMethodService.syncPaymentMethods();
      if (fresh) {
        setPaymentMethods(fresh);
        setError('');
        return;
      }
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('paymentMethods');
      setPaymentMethods(cached || []);
      if (!cached?.length) setError('Failed to load payment methods');
    } catch (err) {
      setError('Failed to load payment methods');
      console.error('Error loading payment methods:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on outlet switch (see Registers.jsx).
  useEffect(() => {
    setLoading(true);
    loadPaymentMethods();
  }, [selectedOutletId, loadPaymentMethods]);

  const handleSavePaymentMethod = async (formData) => {
    try {
      setSaveLoading(true);
      await paymentMethodService.createPaymentMethod(formData);
      await loadPaymentMethods();
      setOpenDialog(false);
    } catch (err) {
      throw new Error(err.response?.data?.error || 'Failed to save payment method');
    } finally {
      setSaveLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!methodToDelete) return;
    try {
      setDeleteLoading(true);
      await paymentMethodService.deletePaymentMethod(methodToDelete.id);
      await loadPaymentMethods();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete payment method');
      console.error('Error deleting payment method:', err);
      // A 409 means the sale keys changed under us: refresh the flags.
      if (err.response?.status === 409) loadPaymentMethods();
    } finally {
      setDeleteLoading(false);
      setMethodToDelete(null);
    }
  };

  // Why Delete is greyed, or '' when it is live. The server enforces the same
  // rules (409 for sale keys, 400 for the rest).
  const deleteBlockReason = (pm) => {
    if (pm.usedInSaleKeys) return IN_SALE_KEYS_TEXT;
    if (pm.isDefault) return 'The default payment method cannot be deleted';
    if (String(pm.name || '').trim().toLowerCase() === 'cash') return 'Cash cannot be deleted';
    if (LOCKED_TYPES.includes(pm.type)) return 'Integration payment methods cannot be deleted';
    return '';
  };
  // Reference lists the methods A-Z by name.
  const sortedMethods = [...paymentMethods].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' }));

  if (loading) {
    return <PageLoader />;
  }

  if (editingMethod) {
    return (
      <EditPaymentMethodView
        key={editingMethod.id}
        method={editingMethod}
        cashMethods={paymentMethods.filter((m) => m.id !== editingMethod.id
          && (m.type === 'Cash' || String(m.name || '').trim().toLowerCase() === 'cash')
          && (editingMethod.outletId == null ? m.outletId == null : (m.outletId == null || m.outletId === editingMethod.outletId)))}
        onBack={() => setEditingMethod(null)}
        onSaved={async () => {
          await loadPaymentMethods();
          setEditingMethod(null);
        }}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header: '+ New' sits inline, right of the H1 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>
          Payment Methods
        </Typography>
        {canAddPaymentMethods && (
          <Button
            variant="outlined"
            disableRipple
            disableElevation
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
            sx={NEW_BUTTON_SX}
          >
            New
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5fb8ea', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '10px', borderBottomLeftRadius: '10px', pl: '20px' },
                '& th:last-of-type': { borderTopRightRadius: '10px', borderBottomRightRadius: '10px', pr: '20px' },
              }}
            >
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              {/* Row actions live in an unlabeled right-edge cell */}
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr': { bgcolor: '#fff', height: 74 },
              '& td': { border: 0, fontSize: 16, color: '#000', py: 0 },
            }}
          >
            {sortedMethods.map((paymentMethod) => {
              const blockReason = deleteBlockReason(paymentMethod);
              return (
                <TableRow key={paymentMethod.id}>
                  <TableCell sx={{ pl: '20px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {paymentMethod.name}
                      {paymentMethod.usedInSaleKeys && (
                        <Tooltip title={IN_SALE_KEYS_TEXT} placement="top" slotProps={LIGHT_TOOLTIP}>
                          <KeyboardOutlinedIcon
                            aria-label={IN_SALE_KEYS_TEXT}
                            sx={{ fontSize: 18, color: '#9e9e9e', cursor: 'default' }}
                          />
                        </Tooltip>
                      )}
                      {/* Not on the reference; kept (existing app feature). */}
                      {LOCKED_TYPES.includes(paymentMethod.type) && (
                        <LockOutlinedIcon sx={{ fontSize: 16, color: '#737373' }} titleAccess="Managed by an integration" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{paymentMethod.type}</TableCell>
                  <TableCell align="right" sx={{ pr: '20px' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                      {canEditPaymentMethods && (
                        <Button
                          disableRipple
                          startIcon={<OutlineGlyph name="pencil" />}
                          onClick={() => setEditingMethod(paymentMethod)}
                          sx={rowActionSx(GREEN)}
                        >
                          Edit
                        </Button>
                      )}
                      {canDeletePaymentMethods && (
                        <Tooltip title={blockReason} placement="top" slotProps={LIGHT_TOOLTIP}>
                          {/* span: a disabled button fires no hover events */}
                          <span>
                            <Button
                              disableRipple
                              startIcon={<OutlineGlyph name="trash" />}
                              disabled={Boolean(blockReason)}
                              onClick={() => setMethodToDelete(paymentMethod)}
                              sx={rowActionSx(RED)}
                            >
                              Delete
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <ConfirmDeleteDialog
        open={Boolean(methodToDelete)}
        title="Delete Payment Method"
        message={`Are you sure you want to delete ${methodToDelete?.name || ''}?`}
        loading={deleteLoading}
        onCancel={() => setMethodToDelete(null)}
        onConfirm={confirmDelete}
      />

      <PaymentMethodDialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        paymentMethod={null}
        onSave={handleSavePaymentMethod}
        loading={saveLoading}
      />
    </Box>
  );
};

export default PaymentMethods;
