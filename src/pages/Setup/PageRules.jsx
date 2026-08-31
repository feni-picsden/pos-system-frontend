import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Chip,
  TextField,
  Divider,
} from '@mui/material';
import {
  Code as CodeIcon,
  RestartAlt as ResetIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import settingsService from '../../services/settingsService';
import { validatePageRule } from '../../utils/pageRuleSandbox';
import { PAGE_RULE_DATABASES } from '../../utils/pageRuleDatabases';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';

// Settings > Page Rules — customise the creation wizards with sandboxed
// JavaScript (reference art. 360021629152). A rule defines entry(context) and
// returns the next Question; an empty rule means the built-in wizard runs.

const INSTANT = 'all 0s ease';

const PILL_BUTTON_SX = {
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  transition: INSTANT,
  backgroundColor: '#22c55e',
  '&:hover': { backgroundColor: '#4ade80', boxShadow: 'none' },
};

export const PAGE_RULES = [
  {
    key: 'page_rule_products',
    label: 'Products',
    description: 'The wizard shown when creating a new product',
  },
  {
    key: 'page_rule_customers',
    label: 'Customers',
    description: 'The wizard shown when creating a new customer',
  },
];

const STARTER = `// Page Rule — define entry(context) and return the next Question.
// context: { user, answers, currentQuestion, currentLocation }
// Elements: text | number | currency | percentage | toggle | calendar | select | custom
// Select 'options' may name an internal database:
//   ${PAGE_RULE_DATABASES.join(', ')}
// ShopfrontAPI: storeVariable, hasVariable, getVariable, setField,
//   back, next, finish, redirect, toast

function entry(context) {
  if (context.currentQuestion === 0) {
    return {
      title: 'New item',
      question: 'What is it called?',
      questionsLeft: 1,
      elements: [
        { type: 'text', field: 'name', placeholder: 'Name', required: true },
      ],
    };
  }
  return {
    question: 'Which category does it belong to?',
    questionsLeft: 0,
    elements: [
      { type: 'select', field: 'categoryId', placeholder: 'Category', options: 'categories' },
    ],
  };
}
`;

const PageRules = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');

  const [statuses, setStatuses] = useState({}); // key -> 'custom' | 'default'
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // rule definition being edited
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const loadStatuses = async () => {
    setLoading(true);
    const next = {};
    for (const rule of PAGE_RULES) {
      try {
        const res = await settingsService.getSetting(rule.key);
        next[rule.key] = res?.setting?.value?.code ? 'custom' : 'default';
      } catch {
        next[rule.key] = 'default';
      }
    }
    setStatuses(next);
    setLoading(false);
  };

  useEffect(() => { loadStatuses(); }, []);

  const openRule = async (rule) => {
    try {
      const res = await settingsService.getSetting(rule.key);
      setCode(res?.setting?.value?.code || STARTER);
    } catch {
      setCode(STARTER);
    }
    setSelected(rule);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Reference behaviour: Save runs a quick validity test. An invalid rule can
      // still be saved — the creation wizard then skips it and shows the full form.
      const result = await validatePageRule(code);
      if (!result.ok) {
        const proceed = await confirm(
          `The Page Rule failed validation:\n\n${result.error}\n\nSave anyway? The creation wizard will skip it and present the full form instead.`,
          { title: 'Page Rule is not valid', confirmText: 'Save anyway', severity: 'warning' }
        );
        if (!proceed) return;
      }
      await settingsService.updateSetting(
        selected.key,
        { code, valid: result.ok, updatedAt: new Date().toISOString() },
        'page_rules',
        `Page Rule for the ${selected.label} creation wizard`
      );
      notify(result.ok ? 'Page Rule saved' : 'Page Rule saved (invalid — wizard will use the full form)');
      setSelected(null);
      await loadStatuses();
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Failed to save the Page Rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const ok = await confirm(
      'Reset this wizard to the built-in default? Your custom Page Rule code will be removed.',
      { title: 'Reset Wizard', confirmText: 'Reset Wizard', severity: 'warning' }
    );
    if (!ok) return;
    try {
      await settingsService.updateSetting(
        selected.key,
        { code: null, updatedAt: new Date().toISOString() },
        'page_rules',
        `Page Rule for the ${selected.label} creation wizard`
      );
      notify('Wizard reset to default');
      setSelected(null);
      await loadStatuses();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to reset the wizard', 'error');
    }
  };

  // ── editor view ─────────────────────────────────────────────────────────────
  if (selected) {
    return (
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
          <Button disableRipple startIcon={<BackIcon />} onClick={() => setSelected(null)} sx={{ textTransform: 'none', color: '#0084d1', fontWeight: 600 }}>
            Page Rules
          </Button>
          <Typography sx={{ color: '#676b72' }}>/</Typography>
          <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700, color: '#000' }}>
            {selected.label}
          </Typography>
        </Box>
        <Typography sx={{ color: '#676b72', fontSize: 14, mb: 2, maxWidth: 720 }}>
          Define a function named <code>entry(context)</code> that returns the next Question
          (or a Promise of one). The code runs in a sandbox with no access to the rest of the
          POS; use the <code>ShopfrontAPI</code> global for wizard control. Select elements can
          load an internal database by name: {PAGE_RULE_DATABASES.join(', ')}.
        </Typography>

        <TextField
          fullWidth
          multiline
          minRows={22}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          spellCheck={false}
          InputProps={{ sx: { fontFamily: 'ui-monospace, Consolas, monospace', fontSize: 13.5, lineHeight: 1.55, bgcolor: '#0f172a', color: '#e2e8f0', '& textarea': { whiteSpace: 'pre' } } }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2.5 }}>
          <Button disableRipple startIcon={<ResetIcon />} onClick={handleReset}
            sx={{ textTransform: 'none', color: '#e33430', fontWeight: 600 }}>
            Reset Wizard
          </Button>
          <Button variant="contained" disableElevation disableRipple onClick={handleSave} disabled={saving} sx={PILL_BUTTON_SX}>
            {saving ? 'Validating…' : 'Save'}
          </Button>
        </Box>
      </Box>
    );
  }

  // ── list view ───────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3 }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>
        Page Rules
      </Typography>
      <Typography sx={{ color: '#676b72', fontSize: 14, mb: 3, maxWidth: 720 }}>
        Customise the creation wizards by running your own JavaScript. A custom rule replaces
        the built-in wizard for everyone; an invalid rule is skipped and the full form is
        shown instead. Programming experience is recommended.
      </Typography>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {PAGE_RULES.map((rule, index) => (
            <React.Fragment key={rule.key}>
              {index > 0 && <Divider />}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <CodeIcon sx={{ color: '#676b72' }} />
                  <Box>
                    <Typography sx={{ fontSize: 17, fontWeight: 600, color: '#313439' }}>{rule.label}</Typography>
                    <Typography sx={{ fontSize: 13.5, color: '#676b72' }}>{rule.description}</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  {statuses[rule.key] === 'custom'
                    ? <Chip label="Custom" size="small" color="info" />
                    : <Chip label="Default" size="small" variant="outlined" />}
                  {canEdit && (
                    <Button disableRipple onClick={() => openRule(rule)}
                      sx={{ textTransform: 'none', color: '#0084d1', fontWeight: 600 }}>
                      Edit
                    </Button>
                  )}
                </Box>
              </Box>
            </React.Fragment>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PageRules;
