import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  MenuItem,
  Checkbox,
  Autocomplete,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DeleteOutline as TrashIcon,
  ChevronRight as ChevronRightIcon,
  SaveOutlined as SaveIcon,
  DragIndicator as DragIcon,
  SortByAlpha as SortIcon,
} from '@mui/icons-material';
import { format, isValid, parseISO } from 'date-fns';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import DateTimeField from '../../components/Common/DateTimeField';
import { additionalFieldService } from '../../services/additionalFieldService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';

// Setup > Additional Information — custom product fields (reference parity,
// Crinit Shop help art. 360001656532 + live-ref screenshots 13/11/2026):
// left list of fields (up/down order, name - safe_name, type, required), right
// editor panel, one Save for every change. Field values are edited per product
// on the product edit screen; this page manages the definitions.

const FIELD_TYPES = [
  { value: 'text', label: 'Text', short: 'Text' },
  { value: 'number', label: 'Number', short: 'Number' },
  { value: 'select', label: 'Select List', short: 'Select' },
  { value: 'multi_select', label: 'Multi-Select List', short: 'Multiselect' },
  { value: 'multi_line', label: 'Multi-Line Text', short: 'Textarea' },
  { value: 'checkbox', label: 'Checkbox', short: 'Toggle' },
  { value: 'date', label: 'Date', short: 'Date' },
];

const typeShort = (value) => FIELD_TYPES.find((t) => t.value === value)?.short || value;

// Reference behaviour: the safe name is auto-suggested from the name —
// lowercase letters, numbers and underscores only.
const suggestSafeName = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const SAFE_NAME_RE = /^[a-z0-9_]+$/;
const HAS_OPTIONS = (type) => type === 'select' || type === 'multi_select';

// Reference field look: white, thin grey border, 8px radius, 42px tall.
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: '#fff',
    borderRadius: '8px',
    minHeight: 42,
    '& fieldset': { borderColor: '#c7c7c7', borderWidth: 1 },
    '&:hover fieldset': { borderColor: '#8a8a8a' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 1 },
  },
  '& .MuiOutlinedInput-input': { py: '9.5px', fontSize: 16 },
  '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
};
const labelSx = { fontSize: 13, color: '#000', mb: 0.25 };

// Reference dropdown: white rounded panel under the box, plain rows, the chosen
// row on a light-blue band with a blue line above and below.
const MENU_PROPS = {
  anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
  transformOrigin: { vertical: 'top', horizontal: 'left' },
  PaperProps: {
    sx: {
      mt: 0,
      borderRadius: '0 0 8px 8px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
      '& .MuiMenuItem-root': { fontSize: 16, color: '#000', minHeight: 36, px: 2, borderTop: '1px solid transparent', borderBottom: '1px solid transparent' },
      '& .MuiMenuItem-root:hover': { bgcolor: '#f1f1f1' },
      '& .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected:hover': { bgcolor: '#e8f3fb', borderTop: '1px solid #5ebbeb', borderBottom: '1px solid #5ebbeb' },
    },
  },
  MenuListProps: { sx: { py: 1.5 } },
};

// Reference: a field's name floats in above the box (smoothly) while it is
// focused or holds a value; otherwise the name is only the placeholder.
const FloatingLabel = ({ show, children }) => (
  <Typography sx={{ ...labelSx, fontSize: 12, height: 18, lineHeight: '18px', opacity: show ? 1 : 0,
    transform: show ? 'translateY(0)' : 'translateY(10px)', transition: 'opacity 150ms ease, transform 150ms ease' }}>
    {children}
  </Typography>
);
const GREEN = '#22c55e';

let tempSeq = 0;
const newField = () => ({
  tempId: `new-${++tempSeq}`,
  name: '',
  safeName: '',
  safeNameTouched: false,
  type: 'text',
  options: [],
  defaultValue: null,
  required: false,
});

const keyOf = (f) => (f.id != null ? `id-${f.id}` : f.tempId);

// Snapshot used for dirty checks and change detection on Save.
const signature = (f) => JSON.stringify([f.name, f.safeName, f.type, f.options || [], f.defaultValue ?? null, f.required === true]);

const fromServer = (f) => ({
  id: f.id,
  name: f.name || '',
  safeName: f.safeName || '',
  safeNameTouched: true,
  type: f.type || 'text',
  options: Array.isArray(f.options) ? f.options : [],
  defaultValue: f.defaultValue ?? null,
  required: f.required === true,
  _sig: signature({ ...f, options: Array.isArray(f.options) ? f.options : [], required: f.required === true }),
});

const validateField = (f) => {
  if (!f.name.trim()) return 'Every field needs a Name';
  const safe = f.safeName || suggestSafeName(f.name);
  if (!SAFE_NAME_RE.test(safe)) return 'Safe Name can only contain lowercase letters, numbers and the underscore (_) character';
  if (HAS_OPTIONS(f.type) && (f.options || []).filter((o) => String(o).trim()).length === 0) return 'A select list needs at least one option';
  return null;
};

const AdditionalInformation = () => {
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');

  const [fields, setFields] = useState([]);
  const [savedOrder, setSavedOrder] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const dragFrom = useRef(null);

  const loadFields = async () => {
    try {
      setLoading(true);
      const { fields: list } = await additionalFieldService.getFields();
      const rows = (list || []).map(fromServer);
      setFields(rows);
      setSavedOrder(rows.map(keyOf).join(','));
      setError('');
      return rows;
    } catch (e) {
      console.error('Error loading additional fields:', e);
      setError('Failed to load additional information fields');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadFields(); }, []);

  const selected = fields.find((f) => keyOf(f) === selectedKey) || null;
  const dirty = useMemo(
    () => fields.some((f) => f.id == null || signature(f) !== f._sig) || fields.map(keyOf).join(',') !== savedOrder,
    [fields, savedOrder]
  );

  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const patchSelected = (patch) =>
    setFields((prev) => prev.map((f) => (keyOf(f) === selectedKey ? { ...f, ...patch } : f)));

  const addField = () => {
    const f = newField();
    setFields((prev) => [...prev, f]);
    setSelectedKey(keyOf(f));
  };

  const move = (index, delta) => {
    setFields((prev) => {
      const next = [...prev];
      const to = index + delta;
      if (to < 0 || to >= next.length) return prev;
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  };

  // Reference: the safe name is suggested when the Name field is LEFT (blur),
  // not per keystroke, and only until the user edits the safe name themselves.
  const handleNameChange = (name) => patchSelected({ name });
  const suggestOnBlur = () => {
    setFocusedName(null);
    if (selected && !selected.safeNameTouched) patchSelected({ safeName: suggestSafeName(selected.name) });
  };

  const changeType = (type) => {
    // The default value only carries over between types that store it the same way.
    const keepText = ['text', 'number', 'multi_line', 'date'];
    const patch = { type };
    if (type === 'checkbox') patch.defaultValue = selected?.defaultValue === true;
    else if (type === 'multi_select') patch.defaultValue = Array.isArray(selected?.defaultValue) ? selected.defaultValue : [];
    else if (type === 'select') patch.defaultValue = typeof selected?.defaultValue === 'string' ? selected.defaultValue : null;
    else if (!keepText.includes(selected?.type) || typeof selected?.defaultValue !== 'string') patch.defaultValue = null;
    if (!HAS_OPTIONS(type)) patch.options = [];
    patchSelected(patch);
  };

  // ---- options (select / multi-select) ----
  const setOptions = (options) => {
    const valid = options.filter((o) => String(o).trim());
    let defaultValue = selected?.defaultValue;
    if (selected?.type === 'select' && !valid.includes(defaultValue)) defaultValue = null;
    if (selected?.type === 'multi_select') defaultValue = (Array.isArray(defaultValue) ? defaultValue : []).filter((v) => valid.includes(v));
    patchSelected({ options, defaultValue });
  };
  // Reference: a new option arrives empty with the "Option N" placeholder and
  // focused; the "Option N" label floats in above the box while it is focused
  // or holds a value.
  const focusOption = useRef(null);
  const [focusedOption, setFocusedOption] = useState(null);
  const [focusedName, setFocusedName] = useState(null);
  const addOption = () => {
    const list = selected?.options || [];
    focusOption.current = list.length;
    setOptions([...list, '']);
  };
  useEffect(() => {
    if (focusOption.current == null) return;
    const el = document.querySelector(`input[aria-label="Option ${focusOption.current + 1}"]`);
    focusOption.current = null;
    if (el) el.focus();
  });
  const changeOption = (i, value) => setOptions((selected?.options || []).map((o, idx) => (idx === i ? value : o)));
  const removeOption = (i) => setOptions((selected?.options || []).filter((_, idx) => idx !== i));
  const autoSort = () => setOptions([...(selected?.options || [])].sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })));
  const dropOption = (to) => {
    const from = dragFrom.current;
    dragFrom.current = null;
    if (from == null || from === to) return;
    const list = [...(selected?.options || [])];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    setOptions(list);
  };

  // ---- delete (reference: immediate, with the data-loss warning) ----
  const handleDelete = async () => {
    if (!selected) return;
    if (selected.id == null) {
      setFields((prev) => prev.filter((f) => keyOf(f) !== selectedKey));
      setSelectedKey(null);
      return;
    }
    const ok = await confirm(
      `Delete "${selected.name || 'Unnamed Field'}"?\n\nThis will remove the field from all products and data will be lost.`,
      { title: 'Delete field', confirmText: 'Delete field', severity: 'warning' }
    );
    if (!ok) return;
    try {
      await additionalFieldService.deleteField(selected.id);
      notify('Field deleted', 'success', { position: 'top' });
      setFields((prev) => {
        const next = prev.filter((f) => keyOf(f) !== selectedKey);
        setSavedOrder(next.filter((f) => f.id != null).map(keyOf).join(','));
        return next;
      });
      setSelectedKey(null);
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete the field', 'error');
    }
  };

  // ---- save everything: new fields, changed fields, then the order ----
  const handleSave = async () => {
    if (!dirty) { notify('No changes to save', 'info', { position: 'top' }); return; }
    for (const f of fields) {
      const problem = validateField(f);
      if (problem) {
        setSelectedKey(keyOf(f));
        alert(`${f.name.trim() || 'Unnamed Field'}: ${problem}`, 'error');
        return;
      }
    }
    try {
      setSaving(true);
      const idByKey = {};
      for (const f of fields) {
        const payload = {
          name: f.name.trim(),
          safeName: f.safeName || suggestSafeName(f.name),
          type: f.type,
          options: HAS_OPTIONS(f.type) ? f.options.map((o) => String(o).trim()).filter(Boolean) : null,
          defaultValue: f.type === 'number' && typeof f.defaultValue === 'string'
            ? (f.defaultValue === '' ? null : Number(f.defaultValue))
            : (f.defaultValue === '' ? null : f.defaultValue),
          required: f.required === true,
        };
        if (f.id == null) {
          const { field } = await additionalFieldService.createField(payload);
          idByKey[keyOf(f)] = field.id;
        } else if (signature(f) !== f._sig) {
          await additionalFieldService.updateField(f.id, payload);
        }
      }
      const ids = fields.map((f) => f.id ?? idByKey[keyOf(f)]).filter((id) => id != null);
      if (ids.length > 0) await additionalFieldService.reorderFields(ids);
      const rows = await loadFields();
      if (selected) {
        const id = selected.id ?? idByKey[selectedKey];
        const again = rows.find((r) => r.id === id);
        setSelectedKey(again ? keyOf(again) : null);
      }
      notify('Additional information saved', 'success', { position: 'top' });
    } catch (e) {
      // A field saved before the failure stays saved; reload so the list is honest.
      const msg = e?.response?.data?.error || 'Failed to save additional information';
      await loadFields();
      alert(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---- default value input per type ----
  const renderDefault = () => {
    if (!selected) return null;
    const dv = selected.defaultValue;
    switch (selected.type) {
      case 'checkbox':
        return (
          <Box>
            <Typography sx={labelSx}>Default Value</Typography>
            <ShopfrontSwitch checked={dv === true} onChange={(e) => patchSelected({ defaultValue: e.target.checked })} inputProps={{ 'aria-label': 'Default Value' }} />
          </Box>
        );
      case 'date': {
        // Stored as YYYY-MM-DD (what the product edit screen reads); shown DD/MM/YYYY.
        const asDate = typeof dv === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dv) ? parseISO(dv) : null;
        return (
          <Box>
            <Typography sx={labelSx}>Default Value</Typography>
            <DateTimeField dateOnly showLabel={false} placeholder="DD/MM/YYYY" value={asDate && isValid(asDate) ? asDate : null}
              onChange={(d) => patchSelected({ defaultValue: d && isValid(d) ? format(d, 'yyyy-MM-dd') : null })}
              disabled={!canEdit} sx={{ '& input': { fontSize: 16 } }} />
          </Box>
        );
      }
      case 'select':
        return (
          <Box>
            {dv ? <Typography sx={labelSx}>Default Value</Typography> : null}
            <Autocomplete
              options={(selected.options || []).filter((o) => String(o).trim())}
              value={dv && (selected.options || []).includes(dv) ? dv : null}
              onChange={(e, v) => patchSelected({ defaultValue: v || null })}
              noOptionsText="No Options"
              size="small"
              renderInput={(params) => <TextField {...params} placeholder="Default Value" inputProps={{ ...params.inputProps, 'aria-label': 'Default Value' }} sx={fieldSx} />}
            />
          </Box>
        );
      case 'multi_select': {
        const opts = (selected.options || []).filter((o) => String(o).trim());
        const val = (Array.isArray(dv) ? dv : []).filter((v) => opts.includes(v));
        return (
          <Box>
            {val.length ? <Typography sx={labelSx}>Default Value</Typography> : null}
            <Autocomplete
              multiple disableCloseOnSelect
              options={opts}
              value={val}
              onChange={(e, v) => patchSelected({ defaultValue: v })}
              noOptionsText="No Options"
              size="small"
              renderOption={(props, option, { selected: on }) => (
                <li {...props}><Checkbox size="small" checked={on} sx={{ mr: 1 }} />{option}</li>
              )}
              renderInput={(params) => <TextField {...params} placeholder={val.length ? '' : 'Default Value'} inputProps={{ ...params.inputProps, 'aria-label': 'Default Value' }} sx={fieldSx} />}
            />
          </Box>
        );
      }
      case 'multi_line':
        return (
          <TextField fullWidth multiline minRows={2} placeholder="Default Value" value={dv ?? ''}
            onChange={(e) => patchSelected({ defaultValue: e.target.value })} inputProps={{ 'aria-label': 'Default Value' }} sx={fieldSx} />
        );
      case 'number':
        return (
          <TextField fullWidth type="number" placeholder="Default Value" value={dv ?? ''}
            onChange={(e) => patchSelected({ defaultValue: e.target.value })} inputProps={{ 'aria-label': 'Default Value' }} sx={fieldSx} />
        );
      default:
        return (
          <TextField fullWidth placeholder="Default Value" value={dv ?? ''}
            onChange={(e) => patchSelected({ defaultValue: e.target.value })} inputProps={{ 'aria-label': 'Default Value' }} sx={fieldSx} />
        );
    }
  };

  const renderOptions = () => {
    if (!selected || !HAS_OPTIONS(selected.type)) return null;
    const options = selected.options || [];
    return (
      <Box sx={{ mt: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000' }}>Select Options</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button disableRipple startIcon={<SortIcon />} onClick={autoSort} disabled={!canEdit}
              sx={{ textTransform: 'none', color: '#000', bgcolor: '#f5f5f5', border: '1px solid #c7c7c7', borderRadius: '6px', px: 1.5, '&:hover': { bgcolor: '#e9e9e9' } }}>
              Auto-sort
            </Button>
            <Button disableRipple startIcon={<AddIcon />} onClick={addOption} disabled={!canEdit}
              sx={{ textTransform: 'none', color: '#fff', bgcolor: GREEN, borderRadius: '6px', px: 1.5, fontWeight: 600, '&:hover': { bgcolor: '#16a34a' } }}>
              New Option
            </Button>
          </Box>
        </Box>
        {options.length === 0 ? (
          <Typography sx={{ textAlign: 'center', color: '#9a9a9a', fontSize: 20, py: 2 }}>No options added</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 4, rowGap: 2 }}>
            {options.map((o, i) => (
              <Box key={i} data-testid="select-option-row"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOption(i)}
                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {/* Only the handle starts a drag (reference); the row is the drop target. */}
                <Box component="span" draggable={canEdit} onDragStart={(e) => { dragFrom.current = i; e.dataTransfer.effectAllowed = 'move'; }}
                  aria-label="Drag option" sx={{ display: 'inline-flex', cursor: 'grab', mt: 2.5 }}>
                  <DragIcon sx={{ color: '#000', fontSize: 22 }} />
                </Box>
                <Box sx={{ flex: 1 }}>
                <FloatingLabel show={focusedOption === i || Boolean(String(o).trim())}>{`Option ${i + 1}`}</FloatingLabel>
                <Box sx={{ display: 'flex' }}>
                  <TextField fullWidth placeholder={`Option ${i + 1}`} value={o} onChange={(e) => changeOption(i, e.target.value)}
                    onFocus={() => setFocusedOption(i)} onBlur={() => setFocusedOption((cur) => (cur === i ? null : cur))}
                    inputProps={{ 'aria-label': `Option ${i + 1}` }}
                    sx={{ ...fieldSx, '& .MuiOutlinedInput-root': { ...fieldSx['& .MuiOutlinedInput-root'], borderTopRightRadius: 0, borderBottomRightRadius: 0 } }} />
                  <IconButton onClick={() => removeOption(i)} aria-label={`Remove option ${i + 1}`} disabled={!canEdit}
                    sx={{ border: '1px solid #c7c7c7', borderLeft: 0, borderRadius: '0 8px 8px 0', bgcolor: '#fff', px: 1.25, '&:hover': { bgcolor: '#f3f3f3' } }}>
                    <TrashIcon sx={{ fontSize: 20, color: '#000' }} />
                  </IconButton>
                </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    );
  };

  return (
    // Fixed to the viewport (reference): the field list scrolls inside the left
    // column with its own scrollbar while Save and the editor panel stay put.
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', boxSizing: 'border-box', overflow: 'hidden' }}>
      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}>
        Edit Additional Information
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, flex: 1, minHeight: 0 }}>
        {/* ---- left: field list ---- */}
        <Box sx={{ width: 500, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1 }} data-testid="field-list">
          {canEdit && (
            <Button variant="contained" disableElevation disableRipple startIcon={<AddIcon />} onClick={addField}
              sx={{ bgcolor: GREEN, color: '#fff', textTransform: 'none', fontWeight: 600, borderRadius: '4px', px: 1.5, py: 0.25, mb: 1.5, '&:hover': { bgcolor: '#16a34a' } }}>
              New Field
            </Button>
          )}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
            ) : fields.map((f, i) => {
              const isSel = keyOf(f) === selectedKey;
              const unnamed = !f.name.trim();
              return (
                <Box key={keyOf(f)} data-testid="field-card" data-selected={isSel ? 'true' : 'false'}
                  onClick={() => setSelectedKey(keyOf(f))}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1.25, mb: 1, borderRadius: '6px', cursor: 'pointer',
                    bgcolor: isSel ? '#d6ecf9' : 'transparent', '&:hover': { bgcolor: isSel ? '#d6ecf9' : '#f1f1f1' } }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <IconButton size="small" aria-label="Move up" disabled={!canEdit || i === 0} onClick={(e) => { e.stopPropagation(); move(i, -1); }} sx={{ p: 0, color: '#000', fontSize: 10 }}>▲</IconButton>
                    <IconButton size="small" aria-label="Move down" disabled={!canEdit || i === fields.length - 1} onClick={(e) => { e.stopPropagation(); move(i, 1); }} sx={{ p: 0, color: '#000', fontSize: 10 }}>▼</IconButton>
                  </Box>
                  <Box sx={{ flex: 1, pl: 1 }}>
                    <Typography sx={{ fontSize: 16, color: unnamed ? '#9a9a9a' : '#000', fontWeight: 600 }}>
                      {unnamed ? 'Unnamed Field' : f.name}
                      <Box component="span" sx={{ color: '#000', fontWeight: 400 }}> - </Box>
                      <Box component="span" sx={{ color: f.safeName ? '#000' : '#9a9a9a', fontWeight: 600 }}>{f.safeName || 'unnamed_field'}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: '#000' }}>{typeShort(f.type)}</Typography>
                    <Typography sx={{ fontSize: 14, color: '#000' }}>{f.required ? 'Required' : 'Not required'}</Typography>
                  </Box>
                  <ChevronRightIcon sx={{ color: isSel ? '#5ebbeb' : '#9a9a9a', fontSize: 30 }} />
                </Box>
              );
            })}
          </Box>
          {canEdit && (
            <Button variant="contained" disableElevation disableRipple startIcon={<SaveIcon />} onClick={handleSave} disabled={saving}
              sx={{ mt: 1.5, bgcolor: '#0e8fe6', color: '#fff', textTransform: 'none', fontWeight: 600, fontSize: 16, borderRadius: '4px', '&:hover': { bgcolor: '#0b7bc7' } }}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </Box>

        {/* ---- right: editor panel ---- */}
        <Box sx={{ flex: 1, bgcolor: '#f5f5f5', borderRadius: '6px', p: 2, minHeight: 0, overflowY: 'auto' }} data-testid="field-panel">
          {!selected ? (
            <Box sx={{ height: '100%', minHeight: 460, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#555' }}>No additional field selected</Typography>
              <Typography sx={{ fontSize: 15, color: '#666', mt: 1 }}>Select an additional field from the left or add a new field to begin editing</Typography>
            </Box>
          ) : (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography sx={{ fontSize: 22, fontWeight: 700, color: '#000' }}>Additional Field</Typography>
                {canEdit && (
                  <Button disableRipple startIcon={<DeleteIcon />} onClick={handleDelete}
                    sx={{ textTransform: 'none', color: '#fff', bgcolor: '#e33430', borderRadius: '4px', px: 1.5, '&:hover': { bgcolor: '#c62828' } }}>
                    Delete
                  </Button>
                )}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 2, rowGap: 1.5 }}>
                <Box>
                  <FloatingLabel show={focusedName === 'name' || Boolean(selected.name)}>Name</FloatingLabel>
                  <TextField fullWidth placeholder="Name" value={selected.name} onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => setFocusedName('name')} onBlur={suggestOnBlur}
                    inputProps={{ 'aria-label': 'Name' }} sx={fieldSx} disabled={!canEdit} />
                </Box>
                <Box>
                  <FloatingLabel show={focusedName === 'safe' || Boolean(selected.safeName)}>Safe Name</FloatingLabel>
                  <TextField fullWidth placeholder="Safe Name" value={selected.safeName}
                    onChange={(e) => patchSelected({ safeName: e.target.value, safeNameTouched: true })}
                    onFocus={() => setFocusedName('safe')} onBlur={() => setFocusedName(null)}
                    error={Boolean(selected.safeName) && !SAFE_NAME_RE.test(selected.safeName)}
                    helperText={Boolean(selected.safeName) && !SAFE_NAME_RE.test(selected.safeName) ? 'Only lowercase letters, numbers and the underscore (_) character' : ''}
                    inputProps={{ 'aria-label': 'Safe Name' }} sx={fieldSx} disabled={!canEdit} />
                </Box>
                <Box>
                  <Typography sx={labelSx}>Field Type</Typography>
                  <TextField select fullWidth value={selected.type} onChange={(e) => changeType(e.target.value)}
                    SelectProps={{ 'aria-label': 'Field Type', MenuProps: MENU_PROPS }} sx={fieldSx} disabled={!canEdit}>
                    {FIELD_TYPES.map((t) => <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>)}
                  </TextField>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pt: 2.5 }}>
                  <ShopfrontSwitch checked={selected.required} onChange={(e) => patchSelected({ required: e.target.checked })} inputProps={{ 'aria-label': 'Required' }} disabled={!canEdit} />
                  <Typography sx={{ fontSize: 16, color: '#000' }}>Required</Typography>
                </Box>
                <Box sx={{ mt: 1 }}>{renderDefault()}</Box>
              </Box>
              {renderOptions()}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
};

export default AdditionalInformation;
