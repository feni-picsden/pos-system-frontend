import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, Button, TextField, Alert, CircularProgress } from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import BlockIcon from '@mui/icons-material/Block';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import loyaltyProgramService from '../../services/loyaltyProgramService';
import PageSaveBar from '../../components/Common/PageSaveBar';

// Reference (Setup > Loyalty): one bordered panel per outlet — "<Outlet>  [Customise]
// ............ Enable Loyalty (switch)". Enabled: Name / Loyalty Rate / Redemption Rate
// inputs indented under the heading. Disabled: a grey "⊘ Loyalty disabled for Outlet"
// line instead of the inputs. One Save for every panel on the page.
//
// Outlet-wise rule (ours): with an outlet picked in the navbar only that outlet's panel
// shows; on All Outlets (global admin) every outlet gets a panel. A company-wide (Global)
// program, if one exists, keeps its own panel on All Outlets so it stays editable.

const refFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    height: 53,
    fontSize: 16,
    backgroundColor: 'transparent',
    '& fieldset': { border: '1px solid #000' },
    '&:hover fieldset': { border: '1px solid #000' },
    '&.Mui-focused fieldset': { border: '2px solid #000' },
  },
  // Rates are plain text inputs (reference): no number spinners, blank allowed.
  '& input': { padding: '0 14px', height: 53, boxSizing: 'border-box' },
};
const refFieldLabelSx = { fontSize: 16, color: '#000', mb: 0.5, lineHeight: 1.2 };

// "Customise": light grey outlined, goes dark on hover (reference).
const customiseSx = {
  ml: 2,
  height: 39,
  px: 1.25,
  backgroundColor: '#f8f8f8',
  color: '#676b72',
  fontSize: 24,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #676b72',
  transition: 'background-color 0.15s ease, color 0.15s ease',
  '&:hover': { backgroundColor: '#595959', color: '#f8f8f8', border: '1px solid #595959' },
};

const GLOBAL_KEY = 'global';
const keyOf = (outletId) => (outletId == null ? GLOBAL_KEY : String(outletId));
const toInput = (v) => (v === null || v === undefined ? '' : String(v));
const emptyForm = () => ({ name: 'Loyalty', loyaltyRate: '1', redemptionRate: '100', isEnabled: false });
const formOf = (p) => ({ name: p.name || '', loyaltyRate: toInput(p.loyaltyRate), redemptionRate: toInput(p.redemptionRate), isEnabled: !!p.isEnabled });
const sameForm = (a, b) => a.name === b.name && a.loyaltyRate === b.loyaltyRate && a.redemptionRate === b.redemptionRate && a.isEnabled === b.isEnabled;

const LoyaltySettings = () => {
  const { user } = useAuth();
  const { selectedOutletId, outlets, isAllOutlets, isTrueSuperAdmin } = useSelectedOutlet();
  // Which outlets get a panel (see header comment).
  const panelOutletIds = useMemo(() => {
    if (selectedOutletId != null) return [Number(selectedOutletId)];
    if (isTrueSuperAdmin && isAllOutlets) return (outlets || []).map((o) => o.id);
    return user?.outletId ? [user.outletId] : [];
  }, [selectedOutletId, isAllOutlets, isTrueSuperAdmin, outlets, user]);
  const scopeKey = panelOutletIds.join(',') + (selectedOutletId == null ? ':all' : '');
  return <LoyaltyPanels key={scopeKey} panelOutletIds={panelOutletIds} allOutletsMode={selectedOutletId == null && isTrueSuperAdmin} outlets={outlets || []} userOutletName={user?.outlet?.name} />;
};

// Remounts when the navbar scope changes: old responses cannot overwrite the new forms.
const LoyaltyPanels = ({ panelOutletIds, allOutletsMode, outlets, userOutletName }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [programs, setPrograms] = useState({}); // key -> saved program (or undefined)
  const [forms, setForms] = useState({}); // key -> form
  const [saved, setSaved] = useState({}); // key -> form as last loaded/saved (dirty check)

  const outletName = useCallback((id) => outlets.find((o) => o.id === id)?.name || userOutletName || `Outlet #${id}`, [outlets, userOutletName]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      // All Outlets: unscoped list (every outlet + global). Outlet: that outlet + global.
      const response = await loyaltyProgramService.getLoyaltyPrograms(
        { outletId: panelOutletIds.length === 1 && !allOutletsMode ? panelOutletIds[0] : null },
        { fresh: true }
      );
      const list = response.loyaltyPrograms || [];
      const byKey = {};
      list.forEach((p) => { byKey[keyOf(p.outletId)] = p; });
      const nextForms = {}; const nextSaved = {};
      const keys = panelOutletIds.map(keyOf);
      if (allOutletsMode && byKey[GLOBAL_KEY]) keys.push(GLOBAL_KEY);
      keys.forEach((k) => { const f = byKey[k] ? formOf(byKey[k]) : emptyForm(); nextForms[k] = f; nextSaved[k] = { ...f }; });
      setPrograms(byKey);
      setForms(nextForms);
      setSaved(nextSaved);
      setError('');
    } catch (err) {
      console.error('Error fetching loyalty programs:', err);
      setError(err.response?.data?.error || 'Failed to fetch loyalty settings');
    } finally {
      setLoading(false);
    }
  }, [panelOutletIds, allOutletsMode]);

  useEffect(() => { load(); }, [load]);

  const setField = (key, field, value) => setForms((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));

  const payloadOf = (key, form) => ({
    name: form.name,
    // Blank stays blank (reference: inherit / no default); the API validates numbers.
    loyaltyRate: form.loyaltyRate.trim() === '' ? '' : form.loyaltyRate.trim(),
    redemptionRate: form.redemptionRate.trim() === '' ? '' : form.redemptionRate.trim(),
    isEnabled: form.isEnabled,
    outletId: key === GLOBAL_KEY ? null : Number(key),
  });

  const saveOne = async (key, form) => {
    const existing = programs[key];
    if (existing) return (await loyaltyProgramService.updateLoyaltyProgram(existing.id, payloadOf(key, form))).loyaltyProgram;
    return (await loyaltyProgramService.createLoyaltyProgram(payloadOf(key, form))).loyaltyProgram;
  };

  const handleSave = async () => {
    const dirtyKeys = Object.keys(forms).filter((k) => !saved[k] || !sameForm(forms[k], saved[k]));
    if (dirtyKeys.length === 0) { setSuccess('Loyalty settings saved'); return; }
    try {
      setSaving(true); setError(''); setSuccess('');
      for (const k of dirtyKeys) {
        if (!forms[k].name.trim()) throw new Error(`Name of Loyalty Program is required (${k === GLOBAL_KEY ? 'Global' : outletName(Number(k))})`);
        await saveOne(k, forms[k]);
      }
      setSuccess('Loyalty settings saved');
      await load();
    } catch (err) {
      console.error('Error saving loyalty settings:', err);
      setError(err.response?.data?.error || err.message || 'Failed to save loyalty settings');
    } finally {
      setSaving(false);
    }
  };

  // Customise opens the assign page; a panel without a saved program gets one first
  // (saved as it stands) so its classification rates have somewhere to live.
  const handleCustomise = async (key) => {
    // Reference: with Enable Loyalty off the button does nothing.
    if (!forms[key]?.isEnabled) return;
    try {
      setError('');
      let program = programs[key];
      if (!program || !sameForm(forms[key], saved[key] || {})) program = await saveOne(key, forms[key]);
      navigate(`/settings/loyalty/${program.id}/assign`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open Customise');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const keys = Object.keys(forms);

  return (
    <Box p={2} pb={12}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>
        Loyalty Settings
      </Typography>
      <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
        Please note: The highest earn value will be selected and the lowest redeem value will be selected on conflicts, however values with zero will take highest priority.
      </Typography>

      {keys.length === 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Please select an outlet first. Loyalty programs are outlet-specific.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>
      )}

      {keys.length > 0 && (
        <Box sx={{ border: '1px solid #000', borderRadius: 0 }}>
          {keys.map((key, idx) => {
            const form = forms[key];
            const title = key === GLOBAL_KEY ? 'All Outlets (Global)' : outletName(Number(key));
            return (
              <Box key={key} data-testid={`loyalty-panel-${key}`} sx={{ px: 2, pt: 1.5, pb: 2, borderBottom: idx < keys.length - 1 ? '1px solid #000' : 0 }}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Box display="flex" alignItems="center">
                    <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>{title}</Typography>
                    <Button disableRipple onClick={() => handleCustomise(key)} sx={customiseSx}>
                      Customise
                    </Button>
                  </Box>
                  <Box display="flex" alignItems="center" gap={1}>
                    <Typography sx={{ fontSize: 16, color: '#000' }}>Enable Loyalty</Typography>
                    <ShopfrontSwitch
                      checked={form.isEnabled}
                      onChange={(e) => setField(key, 'isEnabled', e.target.checked)}
                      inputProps={{ 'aria-label': `Enable Loyalty ${title}` }}
                    />
                  </Box>
                </Box>

                {form.isEnabled ? (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, columnGap: '140px', rowGap: 2, pl: { xs: 0, md: '140px' }, pr: { xs: 0, md: '160px' }, mt: 1.5 }}>
                    <Box>
                      <Typography sx={refFieldLabelSx}>Name of Loyalty Program</Typography>
                      <TextField fullWidth value={form.name} onChange={(e) => setField(key, 'name', e.target.value)} sx={refFieldSx} inputProps={{ 'aria-label': `Name of Loyalty Program ${title}` }} />
                    </Box>
                    <Box>
                      <Typography sx={refFieldLabelSx}>Loyalty Rate ($1 = x amount of points)</Typography>
                      <TextField fullWidth value={form.loyaltyRate} onChange={(e) => setField(key, 'loyaltyRate', e.target.value)} sx={refFieldSx} inputProps={{ inputMode: 'decimal', 'aria-label': `Loyalty Rate ${title}` }} />
                    </Box>
                    <Box>
                      <Typography sx={refFieldLabelSx}>Redemption Rate (x points spent = $1)</Typography>
                      <TextField fullWidth value={form.redemptionRate} onChange={(e) => setField(key, 'redemptionRate', e.target.value)} sx={refFieldSx} inputProps={{ inputMode: 'decimal', 'aria-label': `Redemption Rate ${title}` }} />
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 2.5, color: '#c0c0c0' }}>
                    <BlockIcon sx={{ fontSize: 32 }} />
                    <Typography sx={{ fontSize: 32, color: '#c0c0c0', lineHeight: 1 }}>Loyalty disabled for Outlet</Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      )}

      {keys.length > 0 && (
        <PageSaveBar onSave={handleSave} saving={saving} icon={<SaveOutlinedIcon />} />
      )}
    </Box>
  );
};

export default LoyaltySettings;
