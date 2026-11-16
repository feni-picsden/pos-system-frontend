import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  InputBase,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { barcodeTemplateService } from '../../services/barcodeTemplateService';
import settingsService from '../../services/settingsService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import CreatingForOutlet from '../../components/Common/CreatingForOutlet';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// Settings > Barcode Templates (reference: Setup > Barcode Templates, help art.
// 360060962031). Gated by Setup > General > "Use Barcode Templates": while it is
// off the page is the reference's "Barcode Templates Disabled" notice. On, it is
// the grid list (Name | Template (pencil) | Actions), "+ New" (name only) and
// the Template dialog (Template field, Recalculate Quantity, Done).

const INSTANT = 'all 0s ease';
const BLUE = '#2d8ff5';
const GREEN = '#32b643';

const PILL_SX = {
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '8px',
  fontWeight: 400,
  fontSize: 28,
  lineHeight: 1,
  height: 46,
  px: 1.5,
  transition: INSTANT,
};

const LINK_SX = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  px: 1,
  py: 0,
  transition: INSTANT,
  '& .MuiButton-startIcon': { mr: 0.5 },
  '&:hover': { bgcolor: 'transparent', opacity: 0.75 },
  '&.Mui-disabled': { color: '#8a8d91' },
});

const GRID_TABLE_SX = {
  borderCollapse: 'collapse',
  '& th, & td': { border: '1px solid #000', fontSize: 16, color: '#000', padding: '12px 16px' },
  '& th': { fontWeight: 700, textAlign: 'center' },
};

const FIELD_INPUT_SX = {
  width: '100%',
  height: 48,
  border: '1px solid #000',
  borderRadius: '4px',
  px: 1.5,
  fontFamily: 'inherit',
  fontSize: 16,
  color: '#000',
  bgcolor: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
  '&:focus': { border: '2px solid #000' },
};

// Dialog footer buttons: compact, right-aligned (user 16/11/2026).
const DIALOG_BTN_SX = {
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 600,
  lineHeight: 1,
  height: 38,
  minWidth: 88,
  px: 2,
  borderRadius: '8px',
  boxShadow: 'none',
  transition: INSTANT,
};
const DIALOG_ACTIONS_SX = { display: 'flex', justifyContent: 'flex-end', gap: 1.5, mt: 2.5 };

/** Small dialog with the blue question-mark badge (same chrome as Price Sets). */
const BadgeDialog = ({ open, onClose, title, children }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth={false}
    PaperProps={{ sx: { width: 420, maxWidth: 'calc(100vw - 32px)', overflow: 'visible', borderRadius: 0, mt: 6 } }}
  >
    <Box
      sx={{
        position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)',
        width: 118, height: 118, borderRadius: '50%', bgcolor: BLUE,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 72, fontWeight: 700, lineHeight: 1,
      }}
      aria-hidden
    >
      ?
    </Box>
    <Box sx={{ pt: 8.5, px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000', mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  </Dialog>
);

/** The reference's barcode glyph: two rows of bars with a long bar between. */
const BarcodeGlyph = () => {
  const bars = [
    { w: 32 }, { w: 16, gap: 22 }, { w: 16, gap: 14 }, { w: 24, gap: 6 }, { w: 16, gap: 8 },
  ];
  const Row = () => (
    <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 52 }}>
      {bars.map((b, i) => (
        <Box key={i} sx={{ width: b.w, height: 52, bgcolor: '#000', ml: `${b.gap || 0}px` }} />
      ))}
    </Box>
  );
  return (
    <Box sx={{ width: 200, flexShrink: 0 }} aria-hidden>
      <Row />
      <Box sx={{ height: 14, bgcolor: '#000', my: '12px' }} />
      <Row />
    </Box>
  );
};

/** Reference: "Barcode Templates Disabled" notice while the General toggle is off. */
const DisabledNotice = () => (
  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: 3, pt: 4, px: 2 }} data-testid="barcode-templates-disabled">
    <BarcodeGlyph />
    <Box sx={{ pt: 3 }}>
      <Typography component="h1" sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 3 }}>
        Barcode Templates Disabled
      </Typography>
      <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
        You need to enable barcode templates in the general settings to use this feature.
      </Typography>
      <Typography sx={{ fontSize: 16, color: '#000' }}>
        Barcode templates allow you to define price templates for barcodes (e.g. for deli scales or lotto payouts)
      </Typography>
    </Box>
  </Box>
);

/** "+ New": name only (the reference creates the template, then the pencil sets the code). */
const NameDialog = ({ open, onClose, onSubmit, saving }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(''); setError(''); } }, [open]);
  const submit = async () => {
    const n = name.trim();
    if (!n) { setError('Name is required'); return; }
    try {
      await onSubmit(n);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save the barcode template');
    }
  };
  return (
    <BadgeDialog open={open} onClose={saving ? undefined : onClose} title="Create Barcode Template">
      <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Name</Typography>
      <InputBase
        inputProps={{ id: 'barcode-template-name', 'aria-label': 'Name', maxLength: 100 }}
        autoFocus
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        sx={FIELD_INPUT_SX}
      />
      <CreatingForOutlet sx={{ mt: 1, textAlign: 'left' }} />
      {error && <Typography sx={{ mt: 1, fontSize: 14, color: '#dc2626' }}>{error}</Typography>}
      <Box sx={DIALOG_ACTIONS_SX}>
        <Button disableRipple variant="outlined" onClick={onClose} disabled={saving} sx={{ ...DIALOG_BTN_SX, color: '#676b72', borderColor: '#d4d4d4', bgcolor: '#f3f4f6', '&:hover': { bgcolor: '#e5e7eb', borderColor: '#d4d4d4' } }}>
          Cancel
        </Button>
        <Button disableRipple variant="contained" onClick={submit} disabled={saving} sx={{ ...DIALOG_BTN_SX, bgcolor: GREEN, '&:hover': { bgcolor: '#2a9c39' } }}>
          {saving ? 'Creating...' : 'Create'}
        </Button>
      </Box>
    </BadgeDialog>
  );
};

/** Pencil in the Template column: the code + Recalculate Quantity, "Done". */
const TemplateDialog = ({ open, onClose, template, onSubmit, saving }) => {
  const [code, setCode] = useState('');
  const [recalc, setRecalc] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (open) {
      setCode(template?.template || '');
      setRecalc(template?.recalculateQuantity === true);
      setError('');
    }
  }, [open, template]);
  const submit = async () => {
    try {
      await onSubmit({ template: code.trim(), recalculateQuantity: recalc });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save the barcode template');
    }
  };
  return (
    <BadgeDialog open={open} onClose={saving ? undefined : onClose} title={`Template — ${template?.name || ''}`}>
      <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Template</Typography>
      <InputBase
        inputProps={{ id: 'barcode-template-code', 'aria-label': 'Template', maxLength: 100, style: { fontFamily: 'monospace' } }}
        autoFocus
        placeholder="e.g. 2XXXXXX$$$CC"
        value={code}
        disabled={saving}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        sx={FIELD_INPUT_SX}
      />
      <Box sx={{ textAlign: 'left', mt: 1.5, fontSize: 13, color: '#404040', lineHeight: 1.6 }}>
        <Box><b>$</b> dollars (zero filled) &nbsp; <b>C</b> cents &nbsp; <b>Q</b> quantity &nbsp; <b>X</b> product identifier &nbsp; <b>?</b> any character</Box>
        <Box>Any other character is a literal; escape a code letter with <b>\</b> (e.g. <b>\Q</b>).</Box>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
        <ShopfrontSwitch checked={recalc} onChange={(e) => setRecalc(e.target.checked)} disabled={saving} inputProps={{ 'aria-label': 'Recalculate Quantity' }} />
        <Box sx={{ ml: 1.5, textAlign: 'left' }}>
          <Typography sx={{ fontSize: 16, color: '#000' }}>Recalculate Quantity</Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>
            {recalc
              ? 'The quantity is worked out from the scanned price (1 for $4, scanned $8 = quantity 2)'
              : 'The scanned price is charged as is'}
          </Typography>
        </Box>
      </Box>
      {error && <Typography sx={{ mt: 1, fontSize: 14, color: '#dc2626' }}>{error}</Typography>}
      <Box sx={DIALOG_ACTIONS_SX}>
        <Button disableRipple variant="outlined" onClick={onClose} disabled={saving} sx={{ ...DIALOG_BTN_SX, color: '#676b72', borderColor: '#d4d4d4', bgcolor: '#f3f4f6', '&:hover': { bgcolor: '#e5e7eb', borderColor: '#d4d4d4' } }}>
          Cancel
        </Button>
        <Button disableRipple variant="contained" onClick={submit} disabled={saving} sx={{ ...DIALOG_BTN_SX, bgcolor: BLUE, '&:hover': { bgcolor: '#1f7fe0' } }}>
          {saving ? 'Saving...' : 'Done'}
        </Button>
      </Box>
    </BadgeDialog>
  );
};

/** Rename (Edit action). */
const RenameDialog = ({ open, onClose, template, onSubmit, saving }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (open) { setName(template?.name || ''); setError(''); } }, [open, template]);
  const submit = async () => {
    const n = name.trim();
    if (!n) { setError('Name is required'); return; }
    try { await onSubmit(n); } catch (e) { setError(e?.response?.data?.error || 'Failed to save the barcode template'); }
  };
  return (
    <BadgeDialog open={open} onClose={saving ? undefined : onClose} title="Edit Barcode Template">
      <Typography sx={{ fontSize: 16, color: '#000', mb: 0.5 }}>Name</Typography>
      <InputBase
        inputProps={{ id: 'barcode-template-rename', 'aria-label': 'Name', maxLength: 100 }}
        autoFocus
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        sx={FIELD_INPUT_SX}
      />
      {error && <Typography sx={{ mt: 1, fontSize: 14, color: '#dc2626' }}>{error}</Typography>}
      <Box sx={DIALOG_ACTIONS_SX}>
        <Button disableRipple variant="outlined" onClick={onClose} disabled={saving} sx={{ ...DIALOG_BTN_SX, color: '#676b72', borderColor: '#d4d4d4', bgcolor: '#f3f4f6', '&:hover': { bgcolor: '#e5e7eb', borderColor: '#d4d4d4' } }}>
          Cancel
        </Button>
        <Button disableRipple variant="contained" onClick={submit} disabled={saving} sx={{ ...DIALOG_BTN_SX, bgcolor: BLUE, '&:hover': { bgcolor: '#1f7fe0' } }}>
          {saving ? 'Saving...' : 'Update'}
        </Button>
      </Box>
    </BadgeDialog>
  );
};

const BarcodeTemplates = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canModify = useHasPermission('modify_barcode_templates');
  const { selectedOutlet } = useSelectedOutlet() || {};
  const { globalMode, outletNameOf } = useGlobalOutlet();

  const [enabled, setEnabled] = useState(() => settingsService.getCachedGeneralSettings()?.useBarocodeTemplates === true);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // {mode:'create'|'template'|'rename', template}
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    document.title = "Barcode Templates | Crinit's Shop";
    // The cached blob may be stale (toggle flipped in another tab): confirm with the API.
    let cancelled = false;
    (async () => {
      try {
        const res = await settingsService.getGeneralSettings();
        const on = res?.settings?.useBarocodeTemplates;
        if (!cancelled && typeof on === 'boolean') setEnabled(on);
      } catch { /* keep the cached value */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const { templates: list } = await barcodeTemplateService.getTemplates();
      setTemplates(list || []);
      setError('');
    } catch (e) {
      console.error('Error loading barcode templates:', e);
      setError('Failed to load barcode templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (enabled) load(); }, [enabled, selectedOutlet?.id, globalMode]);

  const run = async (fn, okMessage) => {
    setSaving(true);
    try {
      await fn();
      if (okMessage) notify(okMessage, 'success', { position: 'top' });
      setDialog(null);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (t) => {
    const ok = await confirm(`Delete the barcode template "${t.name}"? Product barcodes using it will lose their template.`, { title: 'Delete barcode template', confirmText: 'Delete', severity: 'warning' });
    if (!ok) return;
    setDeletingId(t.id);
    try {
      await barcodeTemplateService.deleteTemplate(t.id);
      notify('Barcode template deleted', 'success', { position: 'top' });
      await load();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete the barcode template', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (!enabled) return <DisabledNotice />;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>Barcode Templates</Typography>
          {canModify && (
            <Button
              disableRipple
              startIcon={<AddIcon sx={{ fontSize: '28px !important' }} />}
              onClick={() => setDialog({ mode: 'create', template: null })}
              sx={{ ...PILL_SX, borderRadius: 0, bgcolor: GREEN, '&:hover': { bgcolor: '#2a9c39' } }}
            >
              New
            </Button>
          )}
        </Box>
        {/* Count block top-right, like the report / Products pages */}
        <Box data-total-count sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>{templates.length}</Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
      </Box>

      {error && <Typography sx={{ color: '#dc2626', mb: 2 }}>{error}</Typography>}

      <Table sx={GRID_TABLE_SX} data-testid="barcode-templates-table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: globalMode ? '30%' : '40%' }}>Name</TableCell>
            {globalMode && <TableCell sx={{ width: '16%' }}>Outlet</TableCell>}
            <TableCell sx={{ width: globalMode ? '30%' : '36%' }}>Template</TableCell>
            <TableCell>Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading && templates.length === 0 && (
            <TableRow>
              <TableCell colSpan={globalMode ? 4 : 3} align="center" sx={{ color: '#676b72' }}>
                No barcode templates yet
              </TableCell>
            </TableRow>
          )}
          {templates.map((t, i) => (
            <TableRow key={t.id} data-testid="barcode-template-row" sx={{ bgcolor: i % 2 ? '#f3f4f6' : '#fff' }}>
              <TableCell>{t.name}</TableCell>
              {globalMode && <TableCell data-testid="barcode-template-outlet">{outletNameOf(t.outletId)}</TableCell>}
              <TableCell>
                {/* Reference: the Template column holds the pencil that opens the code dialog */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Button
                    disableRipple
                    startIcon={<EditIcon />}
                    onClick={() => setDialog({ mode: 'template', template: t })}
                    disabled={!canModify}
                    sx={LINK_SX(GREEN)}
                    aria-label={`Edit template ${t.name}`}
                  >
                    {t.template ? '' : 'Set template'}
                  </Button>
                  <Typography component="code" data-testid="barcode-template-code" sx={{ fontFamily: 'monospace', fontSize: 16, color: '#000' }}>
                    {t.template}
                  </Typography>
                  {t.recalculateQuantity && (
                    <Typography component="span" sx={{ fontSize: 12, color: '#676b72', border: '1px solid #d4d4d4', borderRadius: '10px', px: 1 }}>
                      Recalculate Quantity
                    </Typography>
                  )}
                </Box>
              </TableCell>
              <TableCell align="center">
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Button disableRipple startIcon={<EditIcon />} onClick={() => setDialog({ mode: 'rename', template: t })} disabled={!canModify} sx={LINK_SX(GREEN)}>
                    Edit
                  </Button>
                  <Button
                    disableRipple
                    startIcon={<DeleteIcon />}
                    onClick={() => handleDelete(t)}
                    disabled={!canModify || deletingId != null}
                    sx={LINK_SX('#e33430')}
                  >
                    {deletingId === t.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </Box>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <NameDialog
        open={dialog?.mode === 'create'}
        onClose={() => setDialog(null)}
        saving={saving}
        onSubmit={(name) => run(() => barcodeTemplateService.createTemplate({ name, template: '', recalculateQuantity: false }), 'Barcode template created')}
      />
      <TemplateDialog
        open={dialog?.mode === 'template'}
        template={dialog?.template}
        onClose={() => setDialog(null)}
        saving={saving}
        onSubmit={(data) => run(() => barcodeTemplateService.updateTemplate(dialog.template.id, data), 'Barcode template saved')}
      />
      <RenameDialog
        open={dialog?.mode === 'rename'}
        template={dialog?.template}
        onClose={() => setDialog(null)}
        saving={saving}
        onSubmit={(name) => run(() => barcodeTemplateService.updateTemplate(dialog.template.id, { name }), 'Barcode template updated')}
      />
    </Box>
  );
};

export default BarcodeTemplates;
