import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteOutlineIcon,
  KeyboardOutlined as KeyboardOutlinedIcon,
  LockOutlined as LockOutlinedIcon,
  ArrowBack as ArrowBackIcon,
  SaveOutlined as SaveOutlinedIcon,
} from '@mui/icons-material';
import PaymentMethodDialog, { TypeCombobox } from '../../components/PaymentMethods/PaymentMethodDialog';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { useHasPermission } from '../../hooks/usePermissions';
import paymentMethodService from '../../services/paymentMethodService';
import saleKeyService from '../../services/saleKeyService';
import posLocalDb from '../../services/posLocalDb';

// Reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

// '+ New': outlined primary, inline with the H1.
const NEW_BUTTON_SX = {
  bgcolor: 'transparent',
  border: '1px solid #5ebbeb',
  color: '#5ebbeb',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)', border: '1px solid #5ebbeb', boxShadow: 'none' },
};

// Inline row action buttons; disabled state stays visible (ref semantics).
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  borderRadius: '12px',
  minWidth: 0,
  px: 1.5,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  '&.Mui-disabled': {
    bgcolor: 'rgba(0,0,0,0.1)',
    color: '#b5b5b5',
    cursor: 'not-allowed',
    pointerEvents: 'auto',
  },
  '&.Mui-disabled:hover': { bgcolor: 'rgba(0,0,0,0.1)' },
});

const FIELD_LABEL_SX = { fontSize: 16, color: '#000', mb: 0.5 };

const INPUT_SX = {
  width: '100%',
  height: 42,
  border: '1px solid #404040',
  borderRadius: '8px',
  px: 1.5,
  bgcolor: '#fff',
  fontFamily: 'inherit',
  fontSize: 16,
  color: '#000',
  outline: 'none',
  boxSizing: 'border-box',
  '&::placeholder': { color: '#808080', opacity: 1 },
};

// Integration/API-locked types get the padlock (ref: e.g. IBA Loyalty).
const LOCKED_TYPES = ['Linkly', 'Linkly Value Added Applications', 'Tyro', 'Custom'];

const DEFAULT_SETTINGS = {
  alwaysOpenCashDrawer: false,
  alwaysPrintReceipt: false,
  useRounding: false,
  allowCashOut: false,
  defaultToPayExact: false,
  closeRegisterDenominations: '',
  predictionDenominations: '',
  buttonBackgroundColour: '#ffffff',
  buttonTextColour: '#000000',
  buttonBackgroundColourDark: '#ffffff',
  buttonTextColourDark: '#000000',
};

const parseSettings = (raw) => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const TOGGLE_FIELDS = [
  { key: 'alwaysOpenCashDrawer', label: 'Always Open Cash Drawer' },
  { key: 'alwaysPrintReceipt', label: 'Always Print Receipt' },
  { key: 'useRounding', label: 'Use Rounding' },
  { key: 'allowCashOut', label: 'Allow Cash Out' },
  { key: 'defaultToPayExact', label: 'Default to Pay Exact' },
];

const ColourField = ({ label, value, onChange }) => (
  <Box>
    <Typography sx={FIELD_LABEL_SX}>{label}</Typography>
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Box
        component="input"
        type="color"
        aria-label={`${label} picker`}
        value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#ffffff'}
        onChange={(e) => onChange(e.target.value)}
        sx={{
          width: 56,
          height: 42,
          p: '4px',
          border: '1px solid #404040',
          borderRadius: '8px',
          bgcolor: '#fff',
          cursor: 'pointer',
        }}
      />
      <Box
        component="input"
        type="text"
        aria-label={`${label} hex code`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={{ ...INPUT_SX, width: 130 }}
      />
    </Box>
  </Box>
);

/**
 * Full edit surface matching the reference edit page (Back button, "Editing
 * <name>" H1, name/type, the 5 documented toggles, denomination fields and the
 * payment button colours). Rendered in place of the list — this app has no
 * /settings/payment/:id/edit route to attach it to.
 */
const EditPaymentMethodView = ({ method, onBack, onSaved }) => {
  const [name, setName] = useState(method.name || '');
  const [type, setType] = useState(method.type || 'Cash');
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS, ...(parseSettings(method.masterDatabaseRef) || {}) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setSetting = (key, value) => setSettings((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Payment method name is required');
      return;
    }
    try {
      setSaving(true);
      setError('');
      // ponytail: settings ride in masterDatabaseRef as JSON — schema changes are
      // off-limits; move to dedicated columns if the sell screen ever consumes them.
      const foreignRef = method.masterDatabaseRef && !parseSettings(method.masterDatabaseRef);
      await paymentMethodService.updatePaymentMethod(method.id, {
        name: name.trim(),
        type,
        masterDatabaseRef: foreignRef ? method.masterDatabaseRef : JSON.stringify(settings),
      });
      await onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment method');
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          disableRipple
          disableElevation
          startIcon={<ArrowBackIcon />}
          onClick={onBack}
          sx={{
            bgcolor: 'rgb(28,134,242)',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 3,
            boxShadow: 'none',
            transition: INSTANT,
            '&:hover': { bgcolor: 'rgb(21,116,214)', boxShadow: 'none' },
          }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Editing {method.name}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ maxWidth: 640 }}>
        <Typography sx={FIELD_LABEL_SX}>Name</Typography>
        <Box
          component="input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          sx={{ ...INPUT_SX, mb: 2.5 }}
        />

        <Typography sx={FIELD_LABEL_SX}>Type</Typography>
        <Box sx={{ mb: 2.5 }}>
          <TypeCombobox value={type} onChange={setType} borderColor="#404040" />
        </Box>

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

        <Typography sx={{ ...FIELD_LABEL_SX, mt: 2.5 }}>Close Register Denominations</Typography>
        <Box
          component="input"
          type="text"
          placeholder="e.g. 0.05,0.10,0.20,0.50,1,2,5,10,20,50,100"
          value={settings.closeRegisterDenominations}
          onChange={(e) => setSetting('closeRegisterDenominations', e.target.value)}
          sx={{ ...INPUT_SX, mb: 2.5 }}
        />

        <Typography sx={FIELD_LABEL_SX}>Prediction Denominations</Typography>
        <Box
          component="input"
          type="text"
          placeholder="e.g. 5,10,20,50,100"
          value={settings.predictionDenominations}
          onChange={(e) => setSetting('predictionDenominations', e.target.value)}
          sx={{ ...INPUT_SX, mb: 2.5 }}
        />

        <Box sx={{ display: 'flex', gap: 4, mb: 2.5 }}>
          <ColourField
            label="Payment Button Background Colour"
            value={settings.buttonBackgroundColour}
            onChange={(v) => setSetting('buttonBackgroundColour', v)}
          />
          <ColourField
            label="Payment Button Text Colour"
            value={settings.buttonTextColour}
            onChange={(v) => setSetting('buttonTextColour', v)}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 4, mb: 3.5 }}>
          <ColourField
            label="Payment Button Background Colour (Dark Mode)"
            value={settings.buttonBackgroundColourDark}
            onChange={(v) => setSetting('buttonBackgroundColourDark', v)}
          />
          <ColourField
            label="Payment Button Text Colour (Dark Mode)"
            value={settings.buttonTextColourDark}
            onChange={(v) => setSetting('buttonTextColourDark', v)}
          />
        </Box>

        <Button
          disableRipple
          disableElevation
          startIcon={<SaveOutlinedIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            bgcolor: '#5ebbeb',
            color: '#fff',
            textTransform: 'none',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            px: 4,
            boxShadow: 'none',
            transition: INSTANT,
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.1)', color: '#b5b5b5' },
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>
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
  const [saleKeySlugs, setSaleKeySlugs] = useState(new Set());

  // Permission checks
  const canAddPaymentMethods = useHasPermission('payment_methods.add');
  const canEditPaymentMethods = useHasPermission('payment_methods.edit');
  const canDeletePaymentMethods = useHasPermission('payment_methods.delete');

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  // Methods wired to a sale key show a keyboard glyph next to their name.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const set = await saleKeyService.getActiveSaleKeySet();
        let keys = set?.config?.saleKeys;
        if (typeof keys === 'string') keys = JSON.parse(keys);
        const slugs = new Set();
        const walk = (node) => {
          if (Array.isArray(node)) {
            node.forEach(walk);
          } else if (node && typeof node === 'object') {
            if (typeof node.paymentMethod === 'string') slugs.add(node.paymentMethod.toLowerCase());
            Object.values(node).forEach(walk);
          }
        };
        walk(keys);
        if (!cancelled) setSaleKeySlugs(slugs);
      } catch {
        // No active sale key set — simply no keyboard icons.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadPaymentMethods = async () => {
    await posLocalDb.init();
    const cached = await posLocalDb.getStoreAll('paymentMethods');
    if (cached.length > 0) {
      setPaymentMethods(cached);
      setLoading(false);
      const stale = await posLocalDb.isStoreStale('paymentMethods');
      if (stale) {
        paymentMethodService.getPaymentMethods()
          .then(async (r) => {
            const items = r.paymentMethods || [];
            await posLocalDb.putStoreAll('paymentMethods', items);
            setPaymentMethods(items);
          })
          .catch(() => {});
      }
      return;
    }
    try {
      setLoading(true);
      const response = await paymentMethodService.getPaymentMethods();
      const items = response.paymentMethods || [];
      await posLocalDb.putStoreAll('paymentMethods', items);
      setPaymentMethods(items);
      setError('');
    } catch (err) {
      setError('Failed to load payment methods');
      console.error('Error loading payment methods:', err);
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    await posLocalDb.invalidateStore('paymentMethods');
    await loadPaymentMethods();
  };

  const handleSavePaymentMethod = async (formData) => {
    try {
      setSaveLoading(true);
      await paymentMethodService.createPaymentMethod(formData);
      await refresh();
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
      await refresh();
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete payment method');
      console.error('Error deleting payment method:', err);
    } finally {
      setDeleteLoading(false);
      setMethodToDelete(null);
    }
  };

  const isLocked = (pm) => LOCKED_TYPES.includes(pm.type);
  const isBoundToSaleKey = (pm) => {
    const slug = (pm.name || '').trim().toLowerCase();
    return saleKeySlugs.has(slug) || saleKeySlugs.has(slug.replace(/\s+/g, '-'));
  };
  // Ref keeps the Delete button visible but disabled for system/locked methods.
  const isDeletable = (pm) => !pm.isDefault && pm.name !== 'Cash' && !isLocked(pm);

  if (loading) {
    return <PageLoader />;
  }

  if (editingMethod) {
    return (
      <EditPaymentMethodView
        key={editingMethod.id}
        method={editingMethod}
        onBack={() => setEditingMethod(null)}
        onSaved={async () => {
          await refresh();
          setEditingMethod(null);
        }}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header: '+ New' sits inline, right of the H1 */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
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
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Payment Methods Table */}
      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: '#f8f8f8', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
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
              '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
              '& tr:nth-of-type(even)': { bgcolor: '#f5f5f5' },
              '& td': { border: 0, fontSize: 16, color: '#000', py: 1 },
            }}
          >
            {paymentMethods.map((paymentMethod) => (
              <TableRow key={paymentMethod.id}>
                <TableCell sx={{ pl: '20px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {paymentMethod.name}
                    {isBoundToSaleKey(paymentMethod) && (
                      <KeyboardOutlinedIcon sx={{ fontSize: 18, color: '#737373' }} titleAccess="Attached to a sale key" />
                    )}
                    {isLocked(paymentMethod) && (
                      <LockOutlinedIcon sx={{ fontSize: 16, color: '#737373' }} titleAccess="Managed by an integration" />
                    )}
                  </Box>
                </TableCell>
                <TableCell>{paymentMethod.type}</TableCell>
                <TableCell align="right" sx={{ pr: '20px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                    {canEditPaymentMethods && (
                      <Button
                        disableRipple
                        startIcon={<EditOutlinedIcon />}
                        onClick={() => setEditingMethod(paymentMethod)}
                        sx={rowActionSx('#16a34a')}
                      >
                        Edit
                      </Button>
                    )}
                    {canDeletePaymentMethods && (
                      <Button
                        disableRipple
                        startIcon={<DeleteOutlineIcon />}
                        disabled={!isDeletable(paymentMethod)}
                        onClick={() => setMethodToDelete(paymentMethod)}
                        sx={rowActionSx('#dc2626')}
                      >
                        Delete
                      </Button>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
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

      {/* Create Payment Method Dialog */}
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
