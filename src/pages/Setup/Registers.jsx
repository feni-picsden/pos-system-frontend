import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  Grid,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  Alert,
  Snackbar
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import apiClient from '../../services/apiClient';
import registerService from '../../services/registerService';
import paymentMethodService from '../../services/paymentMethodService';
import productService from '../../services/productService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import posLocalDb from '../../services/posLocalDb';
import settingsService from '../../services/settingsService';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// ─── Parity style constants ────────────────────────────────────────────────
const primaryBtnSx = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  borderRadius: '12px',
  height: 42,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  px: 3,
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const inputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    height: 42,
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#404040', borderWidth: 1 },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const fieldLabelSx = { color: '#676b72', fontSize: 14, fontWeight: 600, mb: 0.5 };

const greenLinkSx = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 0.5,
  color: '#32b643',
  fontSize: 16,
  cursor: 'pointer',
  userSelect: 'none',
  transition: 'none',
  '&:hover': { color: 'rgb(109,215,123)' },
};

const tabSx = {
  textTransform: 'none',
  fontSize: 14,
  fontWeight: 700,
  minHeight: 56,
  height: 56,
  borderRadius: '8px 8px 0 0',
  color: '#676b72',
  borderBottom: '4px solid transparent',
  transition: 'color 0.15s',
  '&.Mui-selected': { bgcolor: '#fff', color: '#313439', borderBottom: '4px solid #5ebbeb' },
};

// Register-closure print settings sections (Shopfront: Print Table / Print Total / Don't Print)
const CLOSURE_PRINT_SECTIONS = [
  { key: 'paymentMethod', label: 'Payment Method' },
  { key: 'tax', label: 'Tax' },
  { key: 'movements', label: 'Movements' },
  { key: 'accountSales', label: 'Account Sales' },
  { key: 'accountPayments', label: 'Account Payments' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'discounts', label: 'Discounts' },
  { key: 'soldGiftCards', label: 'Sold Gift Cards' },
  { key: 'redeemedGiftCards', label: 'Redeemed Gift Cards' },
  { key: 'loyalty', label: 'Loyalty' },
];
const FLOAT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRINT_OPTIONS = ['Print Table', 'Print Total', "Don't Print"];

// ponytail: per-register payment-method toggles / invoice number / closure print
// settings have no backend column — persisted per register in localStorage
// (same approach as the statement editor). Move server-side when a settings
// column exists on the Register model.
const settingsKey = (id) => `registerSettings:${id}`;
const loadRegisterSettings = (id) => {
  try {
    return JSON.parse(localStorage.getItem(settingsKey(id))) || {};
  } catch {
    return {};
  }
};

// Payment-method toggles are the exception: the sell screen reads them from the
// server setting register_profile_<id>.payments ({ methodId: enabled }), so they
// must live there - a toggle saved only in this browser would not reach the
// register (reference: "available after the register next synchronises").
const profileKey = (id) => `register_profile_${id}`;
const loadRegisterProfile = async (id) => {
  try {
    const res = await settingsService.getSetting(profileKey(id));
    const value = res?.setting?.value;
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {}; // nothing saved yet - every method stays available
  }
};

const Registers = () => {
  const [registers, setRegisters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Full-page edit surface state
  const [editingRegister, setEditingRegister] = useState(null);
  const [editTab, setEditTab] = useState(0);
  const [editSettings, setEditSettings] = useState({});
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
  const { selectedOutletId } = useSelectedOutlet();
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
      let target = registers.find((r) => r.id === editParam);
      if (!target) {
        try {
          // Unscoped fetch: the cached list may be filtered to the navbar outlet.
          const res = await apiClient.get('/registers?all=true', { skipOutletScope: true, noCache: true });
          target = (res.data?.registers || []).find((r) => r.id === editParam);
        } catch { /* fall through */ }
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

  // Load payment methods + product tags when the edit page opens
  useEffect(() => {
    if (!editingRegister) return;
    let cancelled = false;
    (async () => {
      await posLocalDb.init();
      const cachedPMs = await posLocalDb.getStoreAll('paymentMethods');
      if (!cancelled && cachedPMs.length > 0) {
        setPaymentMethods(cachedPMs);
      } else {
        paymentMethodService.getPaymentMethods()
          .then((r) => { if (!cancelled) setPaymentMethods(r?.paymentMethods || []); })
          .catch(() => {});
      }
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
    // /registers response (2-min TTL) is served back and written into state/IDB.
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
    const saved = loadRegisterSettings(register.id);
    const profile = await loadRegisterProfile(register.id);
    setEditingRegister(register);
    setEditTab(0);
    setInvoiceEditing(false);
    setFormData({
      name: register.name,
      code: register.code,
      outletId: register.outletId,
      isActive: register.isActive,
      isDefault: register.isDefault,
      status: register.status
    });
    setEditSettings({
      // The next invoice number lives on the register row (it drives the sale receipt),
      // not in localStorage like the rest of these settings.
      invoiceNumber: String(register.invoiceNumber ?? saved.invoiceNumber ?? '1'),
      paymentMethods: profile.payments || {},
      // Once this register's toggles have been saved with every method listed,
      // a method missing from the map is one created since - and the reference
      // says a new method "will need to be enabled for each individual
      // register", so it starts OFF. Older profiles (toggled entries only) keep
      // treating a missing method as ON.
      paymentsComplete: profile.paymentsComplete === true,
      closure: {
        print: {},
        notes: true,
        closeTagsEnabled: false,
        paymentSubtypeTotals: false,
        statistics: false,
        closeTags: [],
        ...(saved.closure || {}),
      },
      floats: saved.floats || {},
    });
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
    try {
      if (!formData.name || !formData.code) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
      }
      const { name, code, isActive, isDefault, status } = formData;
      const nextInvoice = parseInt(editSettings.invoiceNumber);
      await registerService.update(editingRegister.id, {
        name, code, isActive, isDefault, status,
        invoiceNumber: nextInvoice > 0 ? nextInvoice : undefined,
      });
      // Payment toggles go to the server profile (merged, so the closure print
      // settings the General > Registers editor keeps there are untouched).
      const profile = await loadRegisterProfile(editingRegister.id);
      // Write an explicit on/off for EVERY method listed, so the sell screen can
      // tell "switched off" from "created after this was saved" (see
      // paymentsComplete above).
      const payments = {};
      for (const method of paymentMethods) payments[method.id] = isMethodEnabled(method);
      await settingsService.updateSetting(
        profileKey(editingRegister.id),
        { ...profile, payments, paymentsComplete: true },
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
      showSnackbar(error.response?.data?.error || 'Failed to save register', 'error');
    }
  };

  if ((loading && registers.length === 0) || (editParam && !editingRegister && !deepLinkDone)) {
    return <PageLoader />;
  }

  // No register to edit: the list is the merged Registers & Outlets page.
  if (!editingRegister) {
    return <Navigate to="/settings/registers-outlets" replace />;
  }

  // ─── Edit page (General | Register Closures) ──────────────────────────────
  if (editingRegister) {
    return (
      <Box sx={{ p: 3, pb: 20 }}>
        {/* Breadcrumb */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography component="span" onClick={closeEditPage} sx={greenLinkSx}>
            Registers
          </Typography>
          <Typography component="span" sx={{ color: '#676b72', fontSize: 16 }}>/</Typography>
          <Typography component="span" sx={{ color: '#313439', fontSize: 16, fontWeight: 700 }}>
            {formData.name || editingRegister.name}
          </Typography>
        </Box>

        <Tabs
          value={editTab}
          onChange={(e, v) => setEditTab(v)}
          sx={{ minHeight: 56, '& .MuiTabs-indicator': { display: 'none' } }}
        >
          <Tab label="General" sx={tabSx} />
          <Tab label="Register Closures" sx={tabSx} />
        </Tabs>

        <Paper elevation={0} sx={{ border: '1px solid #d9d9d9', borderRadius: '0 8px 8px 8px', p: 3 }}>
          {editTab === 0 && (
            <Box>
              <Box sx={{ maxWidth: 764 }}>
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

                <Typography sx={fieldLabelSx}>Status</Typography>
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    sx={{
                      borderRadius: '8px',
                      height: 42,
                      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
                    }}
                  >
                    <MenuItem value="Open">Open</MenuItem>
                    <MenuItem value="Closed">Closed</MenuItem>
                    <MenuItem value="Locked">Locked</MenuItem>
                  </Select>
                </FormControl>

                <Box sx={{ display: 'flex', gap: 4, mb: 1 }}>
                  <FormControlLabel
                    sx={{ ml: 0, gap: 1 }}
                    control={
                      <ShopfrontSwitch
                        checked={Boolean(formData.isActive)}
                        onChange={(e) => handleInputChange('isActive', e.target.checked)}
                      />
                    }
                    label="Active"
                  />
                  <FormControlLabel
                    sx={{ ml: 0, gap: 1 }}
                    control={
                      <ShopfrontSwitch
                        checked={Boolean(formData.isDefault)}
                        onChange={(e) => handleInputChange('isDefault', e.target.checked)}
                      />
                    }
                    label="Default Register"
                  />
                </Box>
              </Box>

              {/* Payment Methods */}
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439', mt: 3, mb: 0.5 }}>
                Payment Methods
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#676b72', mb: 1.5 }}>
                Choose which payment methods can be used on this register. Changes take
                effect after the register next synchronises.
              </Typography>
              {paymentMethods.length === 0 && (
                <Typography sx={{ fontSize: 14, color: '#676b72' }}>
                  No payment methods found.
                </Typography>
              )}
              {paymentMethods.map((method) => {
                const enabled = isMethodEnabled(method);
                return (
                  <Box
                    key={method.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      py: 1.25,
                      borderBottom: '1px solid #ececec',
                      maxWidth: 764,
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontSize: 16, color: '#313439' }}>{method.name}</Typography>
                      <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                        {enabled
                          ? 'This payment method will be available to use on this register'
                          : 'The register will not have access to this payment method'}
                      </Typography>
                    </Box>
                    <ShopfrontSwitch
                      checked={enabled}
                      onChange={(e) => toggleMethod(method, e.target.checked)}
                    />
                  </Box>
                );
              })}
            </Box>
          )}

          {editTab === 1 && (
            <Box>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439', mb: 0.5 }}>
                Print Settings
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#676b72', mb: 2 }}>
                Choose how each section prints on the register closure: Print Table
                (detailed table), Print Total (sum only) or Don&apos;t Print (exclude).
                Sections with no applicable data are omitted from the printout.
              </Typography>
              <Grid container spacing={2} sx={{ maxWidth: 764 + 16 }}>
                {CLOSURE_PRINT_SECTIONS.map(({ key, label }) => (
                  <Grid item xs={12} sm={6} key={key}>
                    <Typography sx={fieldLabelSx}>{label}</Typography>
                    <Autocomplete
                      disableClearable
                      options={PRINT_OPTIONS}
                      value={editSettings.closure?.print?.[key] || 'Print Table'}
                      onChange={(e, value) =>
                        setClosure({ print: { ...(editSettings.closure?.print || {}), [key]: value } })
                      }
                      componentsProps={{
                        paper: {
                          sx: {
                            bgcolor: '#fff',
                            border: '1px solid #404040',
                            borderRadius: '8px',
                            boxShadow: 'none',
                            '& .MuiAutocomplete-option[aria-selected="true"]': { color: '#5ebbeb' },
                          },
                        },
                      }}
                      renderInput={(params) => <TextField {...params} sx={inputSx} />}
                    />
                  </Grid>
                ))}
              </Grid>

              <Box sx={{ maxWidth: 764, mt: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #ececec' }}>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: '#313439' }}>Notes</Typography>
                    <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                      Print any notes recorded against the closure.
                    </Typography>
                  </Box>
                  <ShopfrontSwitch
                    checked={editSettings.closure?.notes !== false}
                    onChange={(e) => setClosure({ notes: e.target.checked })}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #ececec' }}>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: '#313439' }}>Close Register Tags</Typography>
                    <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                      Show accumulated revenue separately per product tag on the closure
                      view and printout. Tags must be applied to products first.
                    </Typography>
                  </Box>
                  <ShopfrontSwitch
                    checked={Boolean(editSettings.closure?.closeTagsEnabled)}
                    onChange={(e) => setClosure({ closeTagsEnabled: e.target.checked })}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25, borderBottom: '1px solid #ececec' }}>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: '#313439' }}>Payment Subtype Totals</Typography>
                    <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                      Print totals for each payment subtype on the closure.
                    </Typography>
                  </Box>
                  <ShopfrontSwitch
                    checked={Boolean(editSettings.closure?.paymentSubtypeTotals)}
                    onChange={(e) => setClosure({ paymentSubtypeTotals: e.target.checked })}
                  />
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.25 }}>
                  <Box>
                    <Typography sx={{ fontSize: 16, color: '#313439' }}>Statistics</Typography>
                    <Typography sx={{ fontSize: 13, color: '#676b72' }}>
                      Print sale statistics on the closure.
                    </Typography>
                  </Box>
                  <ShopfrontSwitch
                    checked={Boolean(editSettings.closure?.statistics)}
                    onChange={(e) => setClosure({ statistics: e.target.checked })}
                  />
                </Box>
              </Box>

              {/* Floats — desired float amount per day of the week */}
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439', mt: 3, mb: 0.5 }}>
                Floats
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#676b72', mb: 1.5 }}>
                Input a desired float amount for each day of the week.
              </Typography>
              <Grid container spacing={2} sx={{ maxWidth: 764 + 16 }}>
                {FLOAT_DAYS.map((day) => (
                  <Grid item xs={12} sm={6} md={3} key={day}>
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
                  </Grid>
                ))}
              </Grid>

              {/* Tags */}
              <Box sx={{ maxWidth: 764, mt: 3 }}>
                <Typography sx={fieldLabelSx}>Tags</Typography>
                <Autocomplete
                  multiple
                  options={tagOptions}
                  value={editSettings.closure?.closeTags || []}
                  onChange={(e, value) => setClosure({ closeTags: value })}
                  renderInput={(params) => (
                    <TextField {...params} placeholder="Select..." sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: '8px',
                        '& fieldset': { borderColor: '#404040', borderWidth: 1 },
                        '&:hover fieldset': { borderColor: '#404040' },
                        '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
                      },
                      '& input::placeholder': { color: '#808080', opacity: 1 },
                    }} />
                  )}
                />
              </Box>
            </Box>
          )}
        </Paper>

        {/* Pinned Save (bottom-right). The page keeps a tall bottom padding so,
            scrolled to the end, the panel's border line sits well above it. */}
        <Button
          onClick={handleSaveEdit}
          startIcon={<SaveOutlinedIcon sx={{ fontSize: 18 }} />}
          disableRipple
          sx={{
            ...primaryBtnSx,
            position: 'fixed',
            bottom: 8,
            right: 24,
            zIndex: 1200,
            height: 36,
            fontSize: 14,
            px: 2.5,
            '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
          }}
        >
          Save
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
  }

  return null;
};

export default Registers;
