import React, { useState, useEffect } from 'react';
import {
  Dialog,
  TextField,
  Button,
  Box,
  Typography,
  MenuItem,
  Alert,
  Select,
} from '@mui/material';
import promotionCategoryService from '../../services/promotionCategoryService';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { REF_MENU_PROPS } from '../Common/refMenuProps';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';

// Reference "Create Promotion Category" prompt: blue "?" badge above a narrow centred
// card — Name, Connected Promotion Source (Select...), two switches (both ON for a
// new category), "Outlets to receive promotions" as one switch per outlet, then
// Cancel (grey outlined) / Create (green). Edit shows the same card with "Update".
// Ours keeps: an Outlet (Global / outlet) picker on All Outlets, the "Master
// Database" source list, and an Active switch.

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    height: 53,
    fontSize: 16,
    backgroundColor: '#fff',
    '& fieldset': { borderColor: '#000', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#000' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
  },
  '& input': { padding: '0 14px', height: 53, boxSizing: 'border-box' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};
const SELECT_SX = {
  height: 42,
  borderRadius: '8px',
  fontSize: 16,
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
};
const LABEL_SX = { fontSize: 16, color: '#000', textAlign: 'center', mb: 0.5, lineHeight: 1.2, whiteSpace: 'nowrap' };

const PROMOTION_SOURCES = [
  'Banner Group Promotion', 'Cellar Savers', 'Cellar Select', 'IBA Platinum', "Manager's Special",
  'My Bottle-O Rewards', 'Porters Instore', 'Porters Rewards', 'Super Good Value', 'Super Store',
  'Top 100', 'Top Drop Rewards', 'Top Shelf',
];

const DEFAULTS = { name: '', promotionSource: '', showOnOrder: true, includeInIntegrations: true, outletIds: [], isActive: true, outletId: null };

const PromotionCategoryDialog = ({ open, onClose, onSave, promotionCategory = null, mode = 'create' }) => {
  const { user, isTrueSuperAdmin } = useAuth();
  // Header outlet rule: with an outlet picked in the header the category belongs to
  // that outlet, so the in-form outlet pickers are hidden (shown on All Outlets).
  const { showOutletFilter, headerOutletId } = useHeaderScope();
  const scopedOutletId = headerOutletId ?? user?.outletId ?? null;
  const isEditMode = mode === 'edit' && promotionCategory;

  const [formData, setFormData] = useState(DEFAULTS);
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    loadOutlets();
    if (isEditMode && promotionCategory) {
      const existingOutletIds = promotionCategory.outletIds
        ? (typeof promotionCategory.outletIds === 'string' ? JSON.parse(promotionCategory.outletIds) : promotionCategory.outletIds)
        : [];
      setFormData({
        name: promotionCategory.name || '',
        promotionSource: promotionCategory.promotionSource || '',
        showOnOrder: promotionCategory.showOnOrder ?? false,
        includeInIntegrations: promotionCategory.includeInIntegrations ?? false,
        outletIds: existingOutletIds.map((v) => parseInt(v)),
        isActive: promotionCategory.isActive ?? true,
        outletId: promotionCategory.outletId || null,
      });
    } else {
      // Reference: both switches start ON for a new category.
      setFormData({ ...DEFAULTS, outletId: !isTrueSuperAdmin() && user?.outletId ? user.outletId : null });
    }
    setError('');
  }, [open, isEditMode, promotionCategory, isTrueSuperAdmin, user]);

  const loadOutlets = async () => {
    try {
      const response = await promotionCategoryService.getAvailableOutlets();
      setOutlets(response.outlets || []);
    } catch (err) {
      console.error('Error loading outlets:', err);
      setOutlets([]);
    }
  };

  const set = (field, value) => { setFormData((prev) => ({ ...prev, [field]: value })); setError(''); };
  const toggleReceiveOutlet = (id, on) => set('outletIds', on ? [...new Set([...formData.outletIds, id])] : formData.outletIds.filter((x) => x !== id));
  // An outlet-owned category can only run in that outlet: picking one narrows the
  // receive list to it (switched ON); back to Global clears the selection.
  const changeOutlet = (value) => {
    const outletId = value === '' ? null : parseInt(value);
    setFormData((prev) => ({ ...prev, outletId, outletIds: outletId ? [outletId] : [] }));
    setError('');
  };
  const receiveOutlets = formData.outletId ? outlets.filter((o) => o.id === formData.outletId) : outlets;

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError('');
      if (!formData.name.trim()) { setError('Name is required'); return; }

      const promotionCategoryData = {
        name: formData.name.trim(),
        promotionSource: formData.promotionSource.trim() || null,
        showOnOrder: formData.showOnOrder,
        includeInIntegrations: formData.includeInIntegrations,
        // Picker hidden (header outlet): a new category's promotions go to that
        // outlet; an edited one keeps the outlets it already had.
        outletIds: !showOutletFilter && !isEditMode && scopedOutletId
          ? [parseInt(scopedOutletId)]
          : formData.outletId
            ? [parseInt(formData.outletId)]
            : (formData.outletIds.length > 0 ? formData.outletIds.map((id) => parseInt(id)) : null),
        isActive: formData.isActive,
        // Edit sends the outlet only when the picker is on screen: a null
        // outletId on a PUT is stamped with the header outlet by apiClient, which
        // re-homed a GLOBAL category to that outlet on every edit.
        ...(isEditMode && !showOutletFilter ? {} : { outletId: formData.outletId || null }),
      };

      const response = isEditMode
        ? await promotionCategoryService.updatePromotionCategory(promotionCategory.id, promotionCategoryData)
        : await promotionCategoryService.createPromotionCategory(promotionCategoryData);
      onSave(response.promotionCategory);
      handleClose();
    } catch (err) {
      console.error('Error saving promotion category:', err);
      const data = err.response?.data;
      const detailMsg = Array.isArray(data?.details) && data.details.length > 0 ? data.details.map((d) => d.msg).join('; ') : null;
      setError(detailMsg || data?.error || 'An error occurred while saving the promotion category');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setFormData(DEFAULTS); setError(''); onClose(); };

  const SwitchRow = ({ label, checked, onChange, ariaLabel }) => (
    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ ...LABEL_SX, textAlign: 'left', mb: 0 }}>{label}</Typography>
      <ShopfrontSwitch checked={checked} onChange={(e) => onChange(e.target.checked)} inputProps={{ 'aria-label': ariaLabel || label }} />
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: 560, maxWidth: '94vw', borderRadius: 0, overflow: 'visible', mt: 6 } }}
    >
      {/* Blue "?" badge overlapping the top edge (reference) */}
      <Box sx={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 120, height: 120, borderRadius: '50%', bgcolor: '#1c86f2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 84, fontWeight: 400, lineHeight: 1, pointerEvents: 'none' }}>
        ?
      </Box>
      <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSubmit(); }} sx={{ px: 2, pt: 8, pb: 2 }}>
        <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000', textAlign: 'center', mb: 1 }}>
          {isEditMode ? 'Edit Promotion Category' : 'Create Promotion Category'}
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

        <Typography sx={LABEL_SX}>Name</Typography>
        <TextField autoFocus fullWidth placeholder="Name" value={formData.name} onChange={(e) => set('name', e.target.value)} sx={FIELD_SX} inputProps={{ 'aria-label': 'Name' }} />

        <Typography sx={{ ...LABEL_SX, mt: 1.5 }}>Connected Promotion Source</Typography>
        <Select
          fullWidth
          displayEmpty
          value={formData.promotionSource}
          onChange={(e) => set('promotionSource', e.target.value)}
          MenuProps={REF_MENU_PROPS}
          inputProps={{ 'aria-label': 'Connected Promotion Source' }}
          renderValue={(v) => (v ? v : <span style={{ color: '#808080' }}>Select...</span>)}
          sx={SELECT_SX}
        >
          <MenuItem value="">Select...</MenuItem>
          <MenuItem disabled sx={{ fontWeight: 700, color: '#000', opacity: '1 !important' }}>Master Database</MenuItem>
          {PROMOTION_SOURCES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </Select>

        {/* Outlet (Global / outlet) — All Outlets mode only (outlet-wise rule) */}
        {isTrueSuperAdmin() && showOutletFilter && (
          <>
            <Typography sx={{ ...LABEL_SX, mt: 1.5 }}>Outlet</Typography>
            <Select
              fullWidth
              displayEmpty
              value={formData.outletId ?? ''}
              onChange={(e) => changeOutlet(e.target.value)}
              MenuProps={REF_MENU_PROPS}
              inputProps={{ 'aria-label': 'Outlet' }}
              sx={SELECT_SX}
            >
              <MenuItem value="">Global (All Outlets)</MenuItem>
              {outlets.map((o) => <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>)}
            </Select>
          </>
        )}

        <SwitchRow label="Show a promotional icon for products when creating an order" checked={formData.showOnOrder} onChange={(v) => set('showOnOrder', v)} ariaLabel="Show a promotional icon" />
        <SwitchRow label="Send promotions within this category to integrations" checked={formData.includeInIntegrations} onChange={(v) => set('includeInIntegrations', v)} ariaLabel="Send promotions to integrations" />

        {/* Outlets to receive promotions — one switch per outlet (All Outlets only) */}
        {showOutletFilter && (
          <Box sx={{ mt: 1.5 }}>
            <Typography sx={LABEL_SX}>Outlets to receive promotions</Typography>
            {receiveOutlets.map((o) => (
              <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, py: 0.5 }}>
                <Typography sx={{ fontSize: 16, color: '#000' }}>{o.name}</Typography>
                <ShopfrontSwitch checked={formData.outletIds.includes(o.id)} onChange={(e) => toggleReceiveOutlet(o.id, e.target.checked)} inputProps={{ 'aria-label': `Receive ${o.name}` }} />
              </Box>
            ))}
          </Box>
        )}
        {!showOutletFilter && scopedOutletId && !isEditMode && (
          <Typography sx={{ fontSize: 13, color: '#676b72', textAlign: 'center', mt: 1.5 }}>
            Promotions in this category go to your current outlet.
          </Typography>
        )}

        <SwitchRow label="Active" checked={formData.isActive} onChange={(v) => set('isActive', v)} />

        <Box sx={{ display: 'flex', gap: 2, mt: 2.5 }}>
          <Button
            disableRipple
            onClick={handleClose}
            disabled={loading}
            sx={{ flex: 1, height: 48, fontSize: 28, fontWeight: 400, lineHeight: 1, textTransform: 'none', color: '#555', bgcolor: '#f8f8f8', border: '1px solid #8a8f98', borderRadius: 0, '&:hover': { bgcolor: '#e9e9e9' } }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            type="submit"
            disabled={loading}
            sx={{ flex: 1, height: 48, fontSize: 28, fontWeight: 400, lineHeight: 1, textTransform: 'none', color: '#fff', bgcolor: '#28a745', borderRadius: 0, '&:hover': { bgcolor: '#218838' }, '&.Mui-disabled': { bgcolor: '#9bd2a8', color: '#fff' } }}
          >
            {loading ? (isEditMode ? 'Updating...' : 'Creating...') : (isEditMode ? 'Update' : 'Create')}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default PromotionCategoryDialog;
