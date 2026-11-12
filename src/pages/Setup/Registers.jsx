import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Typography,
  Alert,
  Snackbar
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';
import PointOfSaleOutlinedIcon from '@mui/icons-material/PointOfSaleOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AttachMoneyOutlinedIcon from '@mui/icons-material/AttachMoneyOutlined';
import apiClient from '../../services/apiClient';
import registerService from '../../services/registerService';
import paymentMethodService from '../../services/paymentMethodService';
import productService from '../../services/productService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import posLocalDb from '../../services/posLocalDb';
import settingsService from '../../services/settingsService';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// ─── Reference register-editor styling ─────────────────────────────────────
const COLUMN_WIDTH = 764;
const HEADER_BG = '#e2e8f0';
const BLUE = '#5ebbeb';

const saveBtnSx = {
  position: 'fixed',
  bottom: 8,
  right: 24,
  zIndex: 1200,
  height: 36,
  px: 2.5,
  bgcolor: BLUE,
  color: '#fff',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 14,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#a9d8f2', color: '#fff' },
  '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
};

const fieldBorder = {
  '& fieldset': { borderColor: '#404040', borderWidth: 1 },
  '&:hover fieldset': { borderColor: '#404040' },
  '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
};

const inputSx = {
  '& .MuiOutlinedInput-root': { borderRadius: '6px', height: 42, backgroundColor: '#fff', ...fieldBorder },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const selectSx = {
  borderRadius: '6px',
  height: 42,
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
};

// Dropdown list: 1px black frame, rounded, ~5 rows then scroll, hover #6fd0ff.
const listPaperSx = {
  bgcolor: '#fff',
  border: '1px solid #000',
  borderRadius: '6px',
  boxShadow: 'none',
  mt: '4px',
  '& .MuiAutocomplete-listbox, & .MuiMenu-list': { maxHeight: 5 * 42, overflowY: 'auto', py: 0 },
  '& .MuiAutocomplete-option, & .MuiMenuItem-root': { minHeight: 42, fontSize: 16 },
  '& .MuiAutocomplete-option.Mui-focused, & .MuiMenuItem-root:hover': { bgcolor: '#6fd0ff !important' },
  '& .MuiAutocomplete-option[aria-selected="true"], & .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent', color: BLUE },
};

const fieldLabelSx = { color: '#313439', fontSize: 16, fontWeight: 700, mb: 0.5 };
const subHeadingSx = { fontSize: 20, fontWeight: 700, color: '#313439', mt: 3, mb: 1 };
const helperSx = { fontSize: 14, color: '#676b72' };

// Section heading: grey icon hanging in the left margin, bold ~24px text,
// a thin rule above every section but the first.
const SectionHeading = ({ icon, children, first = false }) => (
  <Box sx={{ position: 'relative', pt: first ? 0 : 3, mt: first ? 0 : 3, borderTop: first ? 0 : '1px solid #e5e7eb', mb: 2 }}>
    {React.createElement(icon, { sx: { position: 'absolute', left: -40, top: first ? 4 : 28, fontSize: 24, color: '#9ca3af' } })}
    <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#313439' }}>{children}</Typography>
  </Box>
);

// A toggle with the helper text beside it that follows its state.
const ToggleRow = ({ label, checked, onChange, onText, offText }) => (
  <Box sx={{ mb: 2 }}>
    {label && <Typography sx={fieldLabelSx}>{label}</Typography>}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minHeight: 42 }}>
      <ShopfrontSwitch checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <Typography sx={helperSx}>{checked ? onText : offText}</Typography>
    </Box>
  </Box>
);

// Register-closure print settings. Keys, order and defaults are the ones the
// General > Registers editor uses (reference order); the closure printout
// (RegisterClosureView) reads profile.closurePrint by these keys. Surcharges is
// printed by the closure too, so it is offered here as well.
const CLOSURE_PRINT_SECTIONS = [
  { key: 'paymentMethod', label: 'Payment Method', def: 'Print Table' },
  { key: 'tax', label: 'Tax', def: 'Print Table' },
  { key: 'movements', label: 'Movements', def: 'Print Total' },
  { key: 'accountSales', label: 'Account Sales', def: 'Print Total' },
  { key: 'accountPayments', label: 'Account Payments', def: 'Print Total' },
  { key: 'refunds', label: 'Refunds', def: 'Print Total' },
  { key: 'discounts', label: 'Discounts', def: 'Print Total' },
  { key: 'soldGiftCards', label: 'Sold Gift Cards', def: 'Print Total' },
  { key: 'redeemedGiftCards', label: 'Redeemed Gift Cards', def: 'Print Total' },
  { key: 'loyalty', label: 'Loyalty', def: 'Print Total' },
  { key: 'surcharges', label: 'Surcharges', def: 'Print Total' },
];
const DEFAULT_CLOSURE_PRINT = Object.fromEntries(CLOSURE_PRINT_SECTIONS.map(({ key, def }) => [key, def]));
const CLOSURE_TOGGLES = [
  { key: 'notes', label: 'Notes', defaultOn: true },
  { key: 'closeTagsEnabled', label: 'Close Register Tags', defaultOn: false },
  { key: 'paymentSubtypeTotals', label: 'Payment Subtype Totals', defaultOn: false },
  { key: 'statistics', label: 'Statistics', defaultOn: false },
];
const FLOAT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRINT_OPTIONS = ['Print Table', 'Print Total', "Don't Print"];

// ponytail: invoice number lives on the register row; the old browser-only
// copy of closure print settings / floats (localStorage) is read once as a
// fallback for registers edited before those moved to the server profile.
const settingsKey = (id) => `registerSettings:${id}`;
const loadLocalSettings = (id) => {
  try {
    return JSON.parse(localStorage.getItem(settingsKey(id))) || {};
  } catch {
    return {};
  }
};

// Payment toggles, closure print settings and floats live in the server
// setting register_profile_<id>: the sell screen, Close Register and the
// closure printout all read it there.
const profileKey = (id) => `register_profile_${id}`;
// { value, ok }: ok=false means the profile could not be READ (not "none
// saved") - saving then would overwrite whatever is stored.
const loadRegisterProfile = async (id) => {
  try {
    const res = await settingsService.getSetting(profileKey(id));
    const value = res?.setting?.value;
    return { value: value && typeof value === 'object' ? value : {}, ok: true };
  } catch (err) {
    return { value: {}, ok: err?.response?.status === 404 };
  }
};

const Registers = () => {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Full-page edit surface state
  const [editingRegister, setEditingRegister] = useState(null);
  const [editTab, setEditTab] = useState(0);
  const [editSettings, setEditSettings] = useState({});
  // 'loading' | 'ready' | 'failed' - Save only once the saved profile is in.
  const [profileState, setProfileState] = useState('loading');
  const [invoiceEditing, setInvoiceEditing] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [tagOptions, setTagOptions] = useState([]);

  const [formData, setFormData] = useState({
    name: '',
    code: '',
    outletId: '',
    isActive: true,
    isDefault: false,
    status: 'Closed'
  });

  // Refetch on outlet switch: the layout-level remount also covers this, but
  // the page should not depend on that implementation detail.
  const { selectedOutletId, outlets = [] } = useSelectedOutlet();
  useEffect(() => {
    fetchRegisters();
  }, [selectedOutletId]);

  // Deep link from Registers & Outlets: /registers?edit=<id> opens the edit
  // page directly. The list itself lives on the merged page now.
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editParam = parseInt(searchParams.get('edit'), 10);
  const [deepLinkDone, setDeepLinkDone] = useState(false);
  useEffect(() => {
    if (!editParam || deepLinkDone) return;
    let cancelled = false;
    (async () => {
      // Always the server row: the edit page saves status / invoice number
      // back, so a cached copy could write stale values over live ones.
      let target = null;
      try {
        // Unscoped fetch: the cached list may be filtered to the navbar outlet.
        const res = await apiClient.get('/registers?all=true', { skipOutletScope: true, noCache: true });
        target = (res.data?.registers || []).find((r) => r.id === editParam);
      } catch {
        target = registers.find((r) => r.id === editParam);
      }
      if (cancelled) return;
      if (target) {
        // Open the edit page BEFORE marking the deep link done, otherwise the
        // render in between (done but nothing editing) redirects to the list.
        await openEditPage(target);
        if (cancelled) return;
        setLoading(false);
        setDeepLinkDone(true);
      } else {
        setDeepLinkDone(true);
        showSnackbar('Register not found', 'error');
        navigate('/settings/registers-outlets', { replace: true });
      }
    })();
    return () => { cancelled = true; };
  }, [editParam, registers, deepLinkDone]);

  // Payment methods of the REGISTER's outlet (its own + global ones) - the
  // navbar-scoped cache listed another outlet's methods when the admin was
  // pinned elsewhere or on All Outlets. Product tags for the close tags.
  useEffect(() => {
    if (!editingRegister) return;
    let cancelled = false;
    const regOutletId = editingRegister.outletId;
    paymentMethodService
      .getPaymentMethods(
        regOutletId ? { isActive: true, outletId: regOutletId } : { isActive: true },
        regOutletId ? { skipOutletScope: true, noCache: true } : {}
      )
      .then((r) => {
        if (cancelled) return;
        const list = (r?.paymentMethods || []).filter((m) => m.isActive !== false);
        setPaymentMethods(regOutletId
          ? list.filter((m) => m.outletId == null || Number(m.outletId) === Number(regOutletId))
          : list);
      })
      .catch(() => { if (!cancelled) setPaymentMethods([]); });
    (async () => {
      await posLocalDb.init();
      const cachedTags = await posLocalDb.getStoreAll('tags');
      const normalize = (arr) =>
        (Array.isArray(arr) ? arr : [])
          .map((t) => (typeof t === 'string' ? t : t?.name))
          .filter(Boolean);
      if (!cancelled && cachedTags.length > 0) {
        setTagOptions(normalize(cachedTags));
      } else {
        productService.getTags()
          .then((arr) => { if (!cancelled) setTagOptions(normalize(arr)); })
          .catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [editingRegister]);

  const fetchRegisters = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll('registers');
    if (cached.length > 0) {
      setRegisters(cached);
      setLoading(false);
      const stale = await posLocalDb.isStoreStale('registers');
      if (stale) {
        registerService.list()
          .then(async (data) => {
            const items = Array.isArray(data) ? data : [];
            await posLocalDb.putStoreAll('registers', items);
            setRegisters(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      setLoading(true);
      const data = await registerService.list();
      const items = Array.isArray(data) ? data : [];
      await posLocalDb.putStoreAll('registers', items);
      setRegisters(items);
    } catch (error) {
      console.error('Error fetching registers:', error);
      showSnackbar('Failed to fetch registers', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Always hits the network and replaces both state AND the IndexedDB store —
  // used after mutations so a stale cached copy can never resurrect deleted rows.
  const refreshFromServer = async () => {
    // Bust the apiClient in-memory GET cache first, otherwise the pre-mutation
    // /registers response is served back and written into state/IDB.
    apiClient.bustCache('/registers');
    const data = await registerService.list();
    const items = Array.isArray(data) ? data : [];
    await posLocalDb.putStoreAll('registers', items);
    setRegisters(items);
  };

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ open: false, message: '', severity: 'success' });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // ─── Full-page edit surface ────────────────────────────────────────────────
  const openEditPage = async (register) => {
    const saved = loadLocalSettings(register.id);
    setEditingRegister(register);
    setEditTab(0);
    setInvoiceEditing(false);
    setProfileState('loading');
    setFormData({
      name: register.name,
      code: register.code,
      outletId: register.outletId,
      isActive: register.isActive,
      isDefault: register.isDefault,
      status: register.status
    });
    const { value: profile, ok } = await loadRegisterProfile(register.id);
    setEditSettings({
      // The next invoice number lives on the register row (it drives the sale receipt).
      invoiceNumber: String(register.invoiceNumber ?? saved.invoiceNumber ?? '1'),
      paymentMethods: profile.payments || {},
      // Once this register's toggles have been saved with every method listed,
      // a method missing from the map is one created since - and the reference
      // says a new method "will need to be enabled for each individual
      // register", so it starts OFF. Older profiles (toggled entries only) keep
      // treating a missing method as ON.
      paymentsComplete: profile.paymentsComplete === true,
      // Closure print settings + floats come from the server profile. The
      // General > Registers editor writes `closurePrint`, so that copy wins
      // over the nested `closure.print` (which it used to leave stale).
      closure: {
        notes: true,
        closeTagsEnabled: false,
        paymentSubtypeTotals: false,
        statistics: false,
        closeTags: [],
        ...(profile.closure || saved.closure || {}),
        print: {
          ...DEFAULT_CLOSURE_PRINT,
          ...(profile.closure?.print || saved.closure?.print || {}),
          ...(profile.closurePrint || {}),
        },
      },
      floats: profile.floats || saved.floats || {},
    });
    setProfileState(ok ? 'ready' : 'failed');
  };

  const closeEditPage = () => {
    setEditingRegister(null);
    setInvoiceEditing(false);
    navigate('/settings/registers-outlets');
  };

  const isMethodEnabled = (method) =>
    editSettings.paymentMethods?.[method.id]
      ?? (editSettings.paymentsComplete ? false : method.isActive !== false);

  const toggleMethod = (method, checked) => {
    setEditSettings(prev => ({
      ...prev,
      paymentMethods: { ...(prev.paymentMethods || {}), [method.id]: checked },
    }));
  };

  const setClosure = (patch) => {
    setEditSettings(prev => ({ ...prev, closure: { ...(prev.closure || {}), ...patch } }));
  };

  const handleSaveEdit = async () => {
    if (saving) return; // double-click
    if (profileState !== 'ready') {
      showSnackbar(profileState === 'failed'
        ? 'This register\'s settings could not be loaded, so saving is disabled. Reopen the register to retry.'
        : 'Please wait for the register\'s settings to load.', 'error');
      return;
    }
    const name = String(formData.name || '').trim();
    const code = String(formData.code || '').trim();
    if (!name || !code) {
      showSnackbar('Name and Register Code are required', 'error');
      return;
    }
    setSaving(true);
    try {
      const { isActive, isDefault, status } = formData;
      const nextInvoice = parseInt(editSettings.invoiceNumber);
      await registerService.update(editingRegister.id, {
        name, code, isActive, isDefault,
        // Status only when the user changed it here: the value loaded with the
        // page is stale as soon as a cashier opens / closes the register, and
        // echoing it back wiped a live shift (Open -> Closed drops openedAt).
        ...(status !== editingRegister.status ? { status } : {}),
        ...(nextInvoice > 0 && nextInvoice !== editingRegister.invoiceNumber ? { invoiceNumber: nextInvoice } : {}),
      });
      // Payment toggles go to the server profile (merged, so anything else the
      // General > Registers editor keeps there is untouched).
      const { value: profile, ok } = await loadRegisterProfile(editingRegister.id);
      if (!ok) throw new Error('The register\'s saved settings could not be re-read; nothing else was changed.');
      // Write an explicit on/off for EVERY method listed, so the sell screen can
      // tell "switched off" from "created after this was saved" (see
      // paymentsComplete above). Methods of other outlets already in the map stay.
      const payments = { ...(profile.payments || {}) };
      for (const method of paymentMethods) payments[method.id] = isMethodEnabled(method);
      // Floats as numbers; blank = none for that day.
      const floats = {};
      for (const day of FLOAT_DAYS) {
        const v = parseFloat(editSettings.floats?.[day]);
        if (Number.isFinite(v)) floats[day] = v;
      }
      const closure = editSettings.closure || {};
      await settingsService.updateSetting(
        profileKey(editingRegister.id),
        {
          ...profile,
          payments,
          paymentsComplete: true,
          // Register Closures tab, kept server-side so the closure report's
          // print and Close Register's float follow them on every device.
          closure,
          closurePrint: closure.print || {},
          floats,
        },
        'register',
        'Register profile'
      );
      try {
        const { paymentMethods: _unused, ...local } = editSettings;
        localStorage.setItem(settingsKey(editingRegister.id), JSON.stringify(local));
      } catch { /* storage full — register update itself already succeeded */ }
      showSnackbar('Register updated successfully');
      await posLocalDb.invalidateStore('registers');
      closeEditPage();
      await refreshFromServer();
    } catch (error) {
      console.error('Error saving register:', error);
      showSnackbar(error.response?.data?.error || error.message || 'Failed to save register', 'error');
    } finally {
      setSaving(false);
    }
  };

  if ((loading && registers.length === 0) || (editParam && !editingRegister && !deepLinkDone)) {
    return <PageLoader />;
  }

  // No register to edit: the list is the merged Registers & Outlets page.
  if (!editingRegister) {
    return <Navigate to="/settings/registers-outlets" replace />;
  }

  const outletName = outlets.find((o) => Number(o.id) === Number(editingRegister.outletId))?.name
    || editingRegister.outlet?.name || '';
  const tabs = [
    { label: 'General', icon: LocalOfferOutlinedIcon },
    { label: 'Register Closures', icon: PointOfSaleOutlinedIcon },
  ];

  // ─── Edit page (General | Register Closures) ──────────────────────────────
  return (
    <Box sx={{ pb: 20, bgcolor: '#fff', minHeight: '100%' }}>
      {/* Header band: outlet line, title, folder tabs (sticky) */}
      <Box sx={{ bgcolor: HEADER_BG, position: 'sticky', top: 0, zIndex: 10 }}>
        <Box sx={{ maxWidth: 760, mx: 'auto', px: 2, pt: 2 }}>
          <Typography
            component="span"
            onClick={closeEditPage}
            sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 14, fontWeight: 700, color: '#313439', cursor: 'pointer', '&:hover': { color: '#32b643' } }}
          >
            <StorefrontOutlinedIcon sx={{ fontSize: 18 }} />
            {outletName || 'Registers'}
          </Typography>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: '#313439', mt: 0.5, mb: 1.5 }}>
            Editing {formData.name || editingRegister.name}
          </Typography>
          <Box role="tablist" sx={{ display: 'flex', gap: 0.5 }}>
            {tabs.map((tab, index) => {
              const active = editTab === index;
              return (
                <Box
                  key={tab.label}
                  role="tab"
                  aria-selected={active}
                  component="button"
                  type="button"
                  onClick={() => setEditTab(index)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1,
                    height: 48, px: 2.5, border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                    borderRadius: '8px 8px 0 0',
                    bgcolor: active ? '#fff' : 'transparent',
                    color: active ? '#313439' : '#676b72',
                    '&:hover': { color: '#313439' },
                  }}
                >
                  <tab.icon sx={{ fontSize: 20, color: active ? BLUE : 'inherit' }} />
                  {tab.label}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      <Box component="fieldset" disabled={profileState === 'loading'} sx={{ border: 0, m: 0, minWidth: 0, maxWidth: COLUMN_WIDTH, mx: 'auto', px: 2, pt: 3, pl: { xs: 2, md: 2 } }}>
        {profileState === 'loading' && (
          <Typography sx={{ ...helperSx, mb: 2 }}>Loading register settings…</Typography>
        )}
        {profileState === 'failed' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            This register&apos;s settings could not be loaded, so saving is disabled. Reopen the register to retry.
          </Alert>
        )}

        {editTab === 0 && (
          <Box>
            <SectionHeading icon={SettingsOutlinedIcon} first>General</SectionHeading>
            <Typography sx={fieldLabelSx}>Name</Typography>
            <TextField
              fullWidth
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              sx={{ ...inputSx, mb: 2 }}
            />

            <Typography sx={fieldLabelSx}>Register Code</Typography>
            <TextField
              fullWidth
              value={formData.code}
              onChange={(e) => handleInputChange('code', e.target.value)}
              sx={{ ...inputSx, mb: 2 }}
            />

            <Typography sx={fieldLabelSx}>Invoice Number</Typography>
            {invoiceEditing ? (
              <TextField
                fullWidth
                autoFocus
                value={editSettings.invoiceNumber || ''}
                onChange={(e) =>
                  setEditSettings(prev => ({ ...prev, invoiceNumber: e.target.value }))
                }
                onBlur={() => setInvoiceEditing(false)}
                inputProps={{ inputMode: 'numeric' }}
                sx={{ ...inputSx, mb: 2 }}
              />
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, height: 42 }}>
                <Typography sx={{ fontSize: 16, color: '#313439' }}>
                  {editSettings.invoiceNumber || '1'}
                </Typography>
                <EditOutlinedIcon
                  onClick={() => setInvoiceEditing(true)}
                  sx={{ fontSize: 18, color: '#32b643', cursor: 'pointer', '&:hover': { color: 'rgb(109,215,123)' } }}
                />
              </Box>
            )}

            {/* Reference: Payment Methods live on the General tab, right under the
                invoice number (user screenshot 12/11/2026). */}
            <SectionHeading icon={PaymentsOutlinedIcon}>Payment Methods</SectionHeading>
            <Typography sx={{ ...helperSx, mb: 2 }}>
              Choose which payment methods can be used on this register. Changes take
              effect after the register next synchronises.
            </Typography>
            {paymentMethods.length === 0 && (
              <Typography sx={helperSx}>No payment methods found.</Typography>
            )}
            {[...paymentMethods]
              .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
              .map((method) => (
                <ToggleRow
                  key={method.id}
                  label={method.name}
                  checked={isMethodEnabled(method)}
                  onChange={(v) => toggleMethod(method, v)}
                  onText="This payment method will be available to use on this register"
                  offText="The register will not have access to this payment method"
                />
              ))}

            <SectionHeading icon={SettingsOutlinedIcon}>Register</SectionHeading>
            <Typography sx={fieldLabelSx}>Status</Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                sx={selectSx}
                MenuProps={{ PaperProps: { sx: listPaperSx } }}
              >
                <MenuItem value="Open">Open</MenuItem>
                <MenuItem value="Closed">Closed</MenuItem>
                <MenuItem value="Locked">Locked</MenuItem>
              </Select>
            </FormControl>

            <ToggleRow
              label="Active"
              checked={Boolean(formData.isActive)}
              onChange={(v) => handleInputChange('isActive', v)}
              onText="This register can be selected and used"
              offText="This register is hidden from the Location Selector"
            />
            <ToggleRow
              label="Default Register"
              checked={Boolean(formData.isDefault)}
              onChange={(v) => handleInputChange('isDefault', v)}
              onText="This is the outlet's default register"
              offText="This is not the outlet's default register"
            />
          </Box>
        )}

        {editTab === 1 && (
          <Box>
            <SectionHeading icon={PrintOutlinedIcon} first>Register Closures</SectionHeading>
            <Typography sx={{ ...subHeadingSx, mt: 0 }}>Print Settings</Typography>
            <Typography sx={{ ...helperSx, mb: 2 }}>
              Choose how each section prints on the register closure: Print Table
              (detailed table), Print Total (sum only) or Don&apos;t Print (exclude).
              Sections with no applicable data are omitted from the printout.
            </Typography>
            {CLOSURE_PRINT_SECTIONS.map(({ key, label, def }) => (
              <Box key={key} sx={{ mb: 2 }}>
                <Typography sx={fieldLabelSx}>{label}</Typography>
                <FormControl fullWidth>
                  <Select
                    value={editSettings.closure?.print?.[key] || def}
                    onChange={(e) =>
                      setClosure({ print: { ...(editSettings.closure?.print || {}), [key]: e.target.value } })
                    }
                    sx={selectSx}
                    MenuProps={{ PaperProps: { sx: listPaperSx } }}
                  >
                    {PRINT_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </Select>
                </FormControl>
              </Box>
            ))}

            {CLOSURE_TOGGLES.map(({ key, label, defaultOn }) => {
              const checked = defaultOn ? editSettings.closure?.[key] !== false : Boolean(editSettings.closure?.[key]);
              return (
                <ToggleRow
                  key={key}
                  label={label}
                  checked={checked}
                  onChange={(v) => setClosure({ [key]: v })}
                  onText={`The register closure printout will show ${label}`}
                  offText={`The register closure printout will not show ${label}`}
                />
              );
            })}

            <SectionHeading icon={AttachMoneyOutlinedIcon}>Floats</SectionHeading>
            <Typography sx={{ ...helperSx, mb: 2 }}>
              Input a desired float amount for each day of the week.
            </Typography>
            {FLOAT_DAYS.map((day) => (
              <Box key={day} sx={{ mb: 2 }}>
                <Typography sx={fieldLabelSx}>{day}</Typography>
                <TextField
                  fullWidth
                  value={editSettings.floats?.[day] ?? ''}
                  onChange={(e) =>
                    setEditSettings(prev => ({
                      ...prev,
                      floats: { ...(prev.floats || {}), [day]: e.target.value },
                    }))
                  }
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  inputProps={{ inputMode: 'decimal' }}
                  sx={inputSx}
                />
              </Box>
            ))}

            <SectionHeading icon={LocalOfferOutlinedIcon}>Tags</SectionHeading>
            <Autocomplete
              multiple
              disableCloseOnSelect
              options={tagOptions}
              value={editSettings.closure?.closeTags || []}
              onChange={(e, value) => setClosure({ closeTags: value })}
              componentsProps={{ paper: { sx: listPaperSx } }}
              renderOption={(props, option, { selected }) => (
                <li {...props} key={option}>
                  <Checkbox size="small" checked={selected} sx={{ mr: 1, p: 0.5 }} />
                  {option}
                </li>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={(editSettings.closure?.closeTags || []).length ? '' : 'Select...'}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '6px', minHeight: 42, ...fieldBorder }, '& input::placeholder': { color: '#808080', opacity: 1 } }}
                />
              )}
              sx={{ mb: 2 }}
            />
          </Box>
        )}
      </Box>

      {/* Pinned Save (bottom-right). */}
      <Button
        onClick={handleSaveEdit}
        disabled={saving || profileState !== 'ready'}
        startIcon={<SaveOutlinedIcon sx={{ fontSize: 18 }} />}
        disableRipple
        sx={saveBtnSx}
      >
        {saving ? 'Saving...' : 'Save'}
      </Button>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default Registers;
