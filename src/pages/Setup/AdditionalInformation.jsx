import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Checkbox,
  FormControlLabel,
  Switch,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { additionalFieldService } from '../../services/additionalFieldService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';

// Settings > Additional Information — custom product fields (reference parity,
// Shopfront help art. 360001656532). Field values are edited per product on the
// product edit screen; this page manages the definitions.

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

export const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'select', label: 'Select List' },
  { value: 'multi_select', label: 'Multi-Select List' },
  { value: 'multi_line', label: 'Multi-Line Text' },
  { value: 'checkbox', label: 'Checkbox' },
  { value: 'date', label: 'Date' },
];

const typeLabel = (value) => FIELD_TYPES.find((t) => t.value === value)?.label || value;

// Reference behaviour: the safe name is auto-suggested from the name —
// lowercase letters, numbers and underscores only.
export const suggestSafeName = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const EMPTY_FORM = {
  name: '',
  safeName: '',
  safeNameTouched: false,
  type: 'text',
  optionsText: '',
  defaultValue: '',
  defaultChecked: false,
  defaultList: [],
  required: false,
};

const formatDefault = (field) => {
  if (field.type === 'checkbox') return field.defaultValue === true ? 'On' : 'Off';
  if (Array.isArray(field.defaultValue)) return field.defaultValue.join(', ');
  if (field.defaultValue === null || field.defaultValue === undefined || field.defaultValue === '') return '—';
  return String(field.defaultValue);
};

const AdditionalInformation = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');

  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null); // field being edited, or null = new
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadFields = async () => {
    try {
      setLoading(true);
      const { fields: list } = await additionalFieldService.getFields();
      setFields(list || []);
      setError('');
    } catch (e) {
      console.error('Error loading additional fields:', e);
      setError('Failed to load additional information fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFields(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (field) => {
    setEditing(field);
    setForm({
      name: field.name,
      safeName: field.safeName,
      safeNameTouched: true,
      type: field.type,
      optionsText: (field.options || []).join('\n'),
      defaultValue:
        field.type === 'checkbox' || Array.isArray(field.defaultValue)
          ? ''
          : field.defaultValue ?? '',
      defaultChecked: field.type === 'checkbox' && field.defaultValue === true,
      defaultList: Array.isArray(field.defaultValue) ? field.defaultValue : [],
      required: field.required === true,
    });
    setDialogOpen(true);
  };

  const setField = (patch) => setForm((prev) => ({ ...prev, ...patch }));

  const handleNameChange = (name) =>
    setForm((prev) => ({
      ...prev,
      name,
      // Keep suggesting until the user edits the safe name themselves.
      safeName: prev.safeNameTouched ? prev.safeName : suggestSafeName(name),
    }));

  const options = useMemo(
    () => form.optionsText.split('\n').map((o) => o.trim()).filter(Boolean),
    [form.optionsText]
  );

  const buildDefaultValue = () => {
    if (form.type === 'checkbox') return form.defaultChecked;
    if (form.type === 'multi_select') return form.defaultList.filter((v) => options.includes(v));
    if (form.type === 'select') return options.includes(form.defaultValue) ? form.defaultValue : null;
    if (form.type === 'number') return form.defaultValue === '' ? null : Number(form.defaultValue);
    return form.defaultValue === '' ? null : form.defaultValue;
  };

  const handleSave = async () => {
    const payload = {
      name: form.name,
      safeName: form.safeName || suggestSafeName(form.name),
      type: form.type,
      options: form.type === 'select' || form.type === 'multi_select' ? options : null,
      defaultValue: buildDefaultValue(),
      required: form.required,
    };
    try {
      setSaving(true);
      if (editing) {
        await additionalFieldService.updateField(editing.id, payload);
        notify('Field updated');
      } else {
        await additionalFieldService.createField(payload);
        notify('Field created');
      }
      setDialogOpen(false);
      await loadFields();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to save the field', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field) => {
    const ok = await confirm(
      `Delete "${field.name}"?\n\nThis will remove the field from all products and data will be lost.`,
      { title: 'Delete field', confirmText: 'Delete field', severity: 'warning' }
    );
    if (!ok) return;
    try {
      await additionalFieldService.deleteField(field.id);
      notify('Field deleted');
      await loadFields();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete the field', 'error');
    }
  };

  // The default-value input mirrors the field type, like the product edit screen will.
  const renderDefaultInput = () => {
    switch (form.type) {
      case 'checkbox':
        return (
          <FormControlLabel
            control={<Switch checked={form.defaultChecked} onChange={(e) => setField({ defaultChecked: e.target.checked })} />}
            label="Default value on"
          />
        );
      case 'select':
        return (
          <TextField
            select fullWidth margin="normal" label="Default Value" value={options.includes(form.defaultValue) ? form.defaultValue : ''}
            onChange={(e) => setField({ defaultValue: e.target.value })}
          >
            <MenuItem value="">None</MenuItem>
            {options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </TextField>
        );
      case 'multi_select':
        return (
          <TextField
            select fullWidth margin="normal" label="Default Value"
            SelectProps={{
              multiple: true,
              renderValue: (selected) => (selected || []).join(', '),
            }}
            value={form.defaultList.filter((v) => options.includes(v))}
            onChange={(e) => setField({ defaultList: e.target.value })}
          >
            {options.map((o) => (
              <MenuItem key={o} value={o}>
                <Checkbox checked={form.defaultList.includes(o)} size="small" />
                {o}
              </MenuItem>
            ))}
          </TextField>
        );
      case 'multi_line':
        return (
          <TextField
            fullWidth margin="normal" label="Default Value" multiline minRows={3}
            value={form.defaultValue} onChange={(e) => setField({ defaultValue: e.target.value })}
          />
        );
      case 'number':
        return (
          <TextField
            fullWidth margin="normal" label="Default Value" type="number"
            value={form.defaultValue} onChange={(e) => setField({ defaultValue: e.target.value })}
          />
        );
      case 'date':
        return (
          <TextField
            fullWidth margin="normal" label="Default Value" type="date"
            InputLabelProps={{ shrink: true }}
            value={form.defaultValue} onChange={(e) => setField({ defaultValue: e.target.value })}
          />
        );
      default:
        return (
          <TextField
            fullWidth margin="normal" label="Default Value"
            value={form.defaultValue} onChange={(e) => setField({ defaultValue: e.target.value })}
          />
        );
    }
  };

  const safeNameProblem =
    form.safeName && !/^[a-z0-9_]+$/.test(form.safeName)
      ? 'Only lowercase letters, numbers and the underscore (_) character'
      : '';

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Additional Information
        </Typography>
        {canEdit && (
          <Button variant="contained" disableElevation disableRipple startIcon={<AddIcon />} onClick={openNew} sx={PILL_BUTTON_SX}>
            New Field
          </Button>
        )}
      </Box>

      <Typography sx={{ color: '#676b72', fontSize: 14, mb: 2 }}>
        Custom fields for products. Each field appears on the product edit screen and can be
        used on shelf tickets, product filtering and external integrations.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': { bgcolor: '#5ebbeb', color: '#fff', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px', pl: '20px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px', pr: '20px' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell>Safe Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Default Value</TableCell>
                <TableCell>Required</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { fontSize: 15, color: '#313439' } }}>
              {fields.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4, border: 0 }}>
                    <Typography variant="body1" color="text.secondary">
                      No fields yet. {canEdit && 'Click "New Field" to create your first one.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                fields.map((field) => (
                  <TableRow key={field.id} sx={{ '&:hover': { bgcolor: 'rgb(240,240,240)' }, transition: INSTANT }}>
                    <TableCell sx={{ fontWeight: 600 }}>{field.name}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{field.safeName}</TableCell>
                    <TableCell>{typeLabel(field.type)}</TableCell>
                    <TableCell>{formatDefault(field)}</TableCell>
                    <TableCell>
                      {field.required
                        ? <Chip label="Required" size="small" color="warning" />
                        : <Typography component="span" sx={{ color: '#676b72', fontSize: 14 }}>Optional</Typography>}
                    </TableCell>
                    <TableCell align="right">
                      {canEdit && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                          <Button disableRipple size="small" startIcon={<EditIcon />} onClick={() => openEdit(field)}
                            sx={{ color: '#0084d1', textTransform: 'none', fontWeight: 600 }}>
                            Edit
                          </Button>
                          <Button disableRipple size="small" startIcon={<DeleteIcon />} onClick={() => handleDelete(field)}
                            sx={{ color: '#e33430', textTransform: 'none', fontWeight: 600 }}>
                            Delete
                          </Button>
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? 'Edit Field' : 'New Field'}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth margin="normal" label="Name" required
            value={form.name} onChange={(e) => handleNameChange(e.target.value)}
          />
          <TextField
            fullWidth margin="normal" label="Safe Name" required
            value={form.safeName}
            onChange={(e) => setField({ safeName: e.target.value, safeNameTouched: true })}
            error={Boolean(safeNameProblem)}
            helperText={safeNameProblem
              || 'Lowercase letters, numbers and underscore only. Keep within 8 characters if you export tickets to DesignPro.'}
          />
          <TextField
            select fullWidth margin="normal" label="Field Type" value={form.type}
            onChange={(e) => setField({ type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
          </TextField>

          {(form.type === 'select' || form.type === 'multi_select') && (
            <TextField
              fullWidth margin="normal" label="Options (one per line)" multiline minRows={3}
              value={form.optionsText} onChange={(e) => setField({ optionsText: e.target.value })}
              helperText="The pre-loaded options a product can pick from"
            />
          )}

          {renderDefaultInput()}

          <FormControlLabel
            sx={{ mt: 1 }}
            control={<Switch checked={form.required} onChange={(e) => setField({ required: e.target.checked })} />}
            label="Required — a value must be set before a product can be saved"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disableRipple onClick={() => setDialogOpen(false)} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained" disableElevation disableRipple onClick={handleSave}
            disabled={saving || !form.name.trim() || Boolean(safeNameProblem)}
            sx={PILL_BUTTON_SX}
          >
            {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdditionalInformation;
