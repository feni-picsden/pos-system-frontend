import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button, CircularProgress } from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  Close as CloseIcon,
  SaveOutlined as SaveIcon,
  AutoFixHighOutlined as ResetIcon,
} from '@mui/icons-material';
import settingsService from '../../services/settingsService';
import { validatePageRule } from '../../utils/pageRuleSandbox';
import { PAGE_RULES, isDefaultCode } from '../../utils/pageRuleDefaults';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';
import CodeEditor from '../../components/Common/CodeEditor';

// Setup > Page Rules — customise the creation wizards with sandboxed JavaScript
// (reference art. 360021629152 + live-ref screenshots 13/11/2026). List:
// "Creation Wizards" rows (Customers / Products / Promotions). Editor: the
// wizard's script with line numbers; Reset Wizard (confirm, immediate), Cancel
// (confirm when dirty), Save (validity test; an invalid rule can still be saved
// and is then skipped by the wizard, which shows the full form instead).

const PageRules = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');

  const [selected, setSelected] = useState(null); // rule definition being edited
  const [code, setCode] = useState('');
  const [savedCode, setSavedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = code !== savedCode;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const openRule = async (rule) => {
    setLoading(true);
    let current = rule.defaultCode;
    try {
      const res = await settingsService.getSetting(rule.key);
      if (res?.setting?.value?.code) current = res.setting.value.code;
    } catch {
      /* no custom rule saved: the default script shows */
    }
    setCode(current);
    setSavedCode(current);
    setSelected(rule);
    setLoading(false);
  };

  const closeEditor = () => { setSelected(null); setCode(''); setSavedCode(''); };

  const handleCancel = async () => {
    if (dirtyRef.current) {
      const ok = await confirm('You have unsaved changes to this wizard. Leave without saving?', { title: 'Unsaved changes', confirmText: 'Leave', severity: 'warning' });
      if (!ok) return;
    }
    closeEditor();
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isDefault = isDefaultCode(selected.key, code);
      // Reference: Save runs a quick validity test (syntax + an entry function).
      const result = isDefault ? { ok: true } : await validatePageRule(code);
      if (!result.ok) {
        const proceed = await confirm(
          `The Page Rule failed validation:\n\n${result.error}\n\nSave anyway? The creation wizard will skip it and present the full form instead.`,
          { title: 'Page Rule is not valid', confirmText: 'Save anyway', severity: 'warning' }
        );
        if (!proceed) return;
      }
      await settingsService.updateSetting(
        selected.key,
        { code: isDefault ? null : code, valid: result.ok, updatedAt: new Date().toISOString() },
        'page_rules',
        `Page Rule for the ${selected.label} creation wizard`
      );
      setSavedCode(code);
      notify(result.ok ? 'Page Rule saved' : 'Page Rule saved — it is not valid, so the wizard will show the full form', result.ok ? 'success' : 'warning', { position: 'top' });
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Failed to save the Page Rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Reference dialog: "Reset Wizard — Are you sure you wish to reset this wizard
  // back to the default settings? This is not reversible." Cancel / Reset.
  const handleReset = async () => {
    if (!selected) return;
    const ok = await confirm(
      'Are you sure you wish to reset this wizard back to the default settings?\n\nThis is not reversible.',
      { title: 'Reset Wizard', confirmText: 'Reset', severity: 'error' }
    );
    if (!ok) return;
    try {
      await settingsService.updateSetting(
        selected.key,
        { code: null, updatedAt: new Date().toISOString() },
        'page_rules',
        `Page Rule for the ${selected.label} creation wizard`
      );
      setCode(selected.defaultCode);
      setSavedCode(selected.defaultCode);
      notify('Wizard reset to default', 'success', { position: 'top' });
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to reset the wizard', 'error');
    }
  };

  // ── editor view ─────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', boxSizing: 'border-box' }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}>{selected.title}</Typography>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <CodeEditor value={code} onChange={setCode} readOnly={!canEdit} height="100%" ariaLabel={`${selected.title} code`} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 2 }}>
          <Button disableRipple startIcon={<ResetIcon />} onClick={handleReset} disabled={!canEdit || saving}
            sx={{ textTransform: 'none', color: '#e33430', border: '1px solid #e33430', borderRadius: '6px', px: 2, fontSize: 16, fontWeight: 600, '&:hover': { bgcolor: '#fff0f0', borderColor: '#e33430' } }}>
            Reset Wizard
          </Button>
          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Button disableRipple startIcon={<CloseIcon />} onClick={handleCancel} disabled={saving}
              sx={{ textTransform: 'none', color: '#000', border: '1px solid #c7c7c7', borderRadius: '6px', px: 2, fontSize: 16, fontWeight: 600, '&:hover': { bgcolor: '#f3f3f3' } }}>
              Cancel
            </Button>
            <Button disableRipple variant="contained" disableElevation startIcon={<SaveIcon />} onClick={handleSave} disabled={!canEdit || saving}
              sx={{ textTransform: 'none', bgcolor: '#5ebbeb', color: '#fff', borderRadius: '6px', px: 2.5, fontSize: 16, fontWeight: 600, '&:hover': { bgcolor: '#4aa9dd' }, '&.Mui-disabled': { bgcolor: '#a9dcf3', color: '#fff' } }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }

  // ── list view ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 2 }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}>Page Rules</Typography>
      <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#000', mb: 1.5 }}>Creation Wizards</Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ border: '1px solid #000', borderRadius: '2px' }}>
          {PAGE_RULES.map((rule, i) => (
            <Box key={rule.key} data-testid={`page-rule-${rule.key}`} onClick={() => openRule(rule)} role="button"
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.5, height: 66, cursor: 'pointer', bgcolor: '#f5f5f5',
                borderTop: i > 0 ? '1px solid #000' : 0, '&:hover': { bgcolor: '#e9e9e9' } }}>
              <Typography sx={{ fontSize: 16, color: '#000' }}>{rule.label}</Typography>
              <ChevronRightIcon sx={{ color: '#000' }} />
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PageRules;
