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
  Select,
  MenuItem,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  VisibilityOutlined as ViewIcon,
  ContentCopyOutlined as CloneIcon,
  ArrowBack as BackIcon,
  CloseOutlined as ClearIcon,
} from '@mui/icons-material';
import { priceSetService } from '../../services/priceSetService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { useHasPermission } from '../../hooks/usePermissions';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import CreatingForOutlet from '../../components/Common/CreatingForOutlet';
import { byMode } from '../../theme/sfPalette';

// Settings > Price Sets — named alternative price schedules (reference parity,
// Shopfront help art. 360000040771 + live reference 16/11/2026). Every product's
// normal prices are its "Default Price Set"; sets defined here hold the
// alternative price groups, assigned per price point on the product edit screen.
//
// Reference screens: list (Name | Number of Prices | Actions: View / Edit /
// Delete (greyed while the set still has prices) / Clone), "Create Price Set" /
// "Edit Price Set" dialogs (question-mark badge, Name, Inherit Prices From) and
// a full View page (Back, name, Total Count, Select Group > Category, table
// Product / Quantity / Price (ex. tax) / Price (inc. tax) / Edit).

const INSTANT = 'all 0s ease';
const BLUE = '#2d8ff5';
const GREEN = '#32b643';
// Dark-mode colours (light values = what the page used before).
const TXT = byMode('#000', '#f8f8f8');
const GRID_LINE = byMode('1px solid #000', '1px solid #373737');
const LINK_BLUE = byMode('#2d8ff5', '#74d4ff');
const LINK_GREEN = byMode(GREEN, '#7bf1a8');
const LINK_RED = byMode('#e33430', '#ffa2a2');

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
  '&.Mui-disabled': { color: byMode('#8a8d91', '#a0a4aa') },
});

// Reference list table: black 1px grid, bold black header text, grey striping.
const GRID_TABLE_SX = {
  borderCollapse: 'collapse',
  '& th, & td': { border: GRID_LINE, fontSize: 16, color: TXT, padding: '12px 16px' },
  '& th': { fontWeight: 700, textAlign: 'center', bgcolor: byMode(undefined, '#333333'), color: byMode(undefined, '#5ebbeb') },
};

const DEFAULT_PRICE_VALUE = '';

/** Small dialog with the blue question-mark badge, like the reference. */
const BadgeDialog = ({ open, onClose, title, children }) => (
  <Dialog
    open={open}
    onClose={onClose}
    maxWidth={false}
    PaperProps={{ sx: { width: 420, maxWidth: 'calc(100vw - 32px)', overflow: 'visible', borderRadius: 0, mt: 6 } }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: -60,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 118,
        height: 118,
        borderRadius: '50%',
        bgcolor: BLUE,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: 72,
        fontWeight: 700,
        lineHeight: 1,
      }}
      aria-hidden
    >
      ?
    </Box>
    <Box sx={{ pt: 8.5, px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 16, fontWeight: 700, color: TXT, mb: 1 }}>{title}</Typography>
      {children}
    </Box>
  </Dialog>
);

const FIELD_INPUT_SX = {
  width: '100%',
  height: 48,
  border: byMode('1px solid #000', '1px solid #a1a1a1'),
  borderRadius: '4px',
  px: 1.5,
  fontFamily: 'inherit',
  fontSize: 16,
  color: TXT,
  bgcolor: byMode('#fff', '#121212'),
  outline: 'none',
  boxSizing: 'border-box',
  '&:focus': { border: byMode('2px solid #000', '2px solid #2b7fff') },
};

// Dropdown list look shared by Inherit Prices From + Select Group: compact
// rows, scrolls after ~7 items, light-blue selected row.
const MENU_PAPER_SX = {
  maxHeight: 232, overflowY: 'auto', border: byMode('1px solid #767676', '1px solid #a1a1a1'), borderRadius: '4px',
  boxShadow: byMode('0 2px 6px rgba(0,0,0,0.2)', '0 2px 6px rgba(0,0,0,0.6)'),
  bgcolor: byMode(undefined, '#232323'),
  '& ul': { py: 0 },
  '& li': { fontSize: 14, minHeight: 32, py: 0.5, px: 1.5, color: byMode('#111', '#f8f8f8'), border: 0, outline: 'none' },
  '& li:focus-visible': { outline: 'none' },
  '& li.Mui-selected': { bgcolor: byMode('#dbeafe !important', 'transparent !important'), color: byMode('#111', '#00a6f4') },
  '& li:hover, & li.Mui-focusVisible': { bgcolor: byMode('#eff6ff !important', '#0084d1 !important'), color: byMode(undefined, '#fafafa') },
};
const SELECT_SX = {
  width: '100%',
  height: 40,
  borderRadius: '4px',
  fontSize: 16,
  bgcolor: byMode(undefined, '#121212'),
  '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1'), borderWidth: '1px' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: '2px' },
  '& .MuiSelect-icon': { color: byMode(undefined, '#a1a1a1') },
};

const DIALOG_BTN_SX = {
  textTransform: 'none',
  fontSize: 28,
  fontWeight: 400,
  lineHeight: 1,
  height: 48,
  px: 1.5,
  borderRadius: 0,
  boxShadow: 'none',
  transition: INSTANT,
};

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// ─── Set editor dialog (Create / Edit) ────────────────────────────────────────

const PriceSetDialog = ({ open, mode, initial, sets, onClose, onSubmit, saving }) => {
  const [name, setName] = useState('');
  const [inherit, setInherit] = useState(DEFAULT_PRICE_VALUE);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(initial?.name || '');
    setInherit(initial?.inheritFromId != null ? String(initial.inheritFromId) : DEFAULT_PRICE_VALUE);
    setError('');
  }, [open, initial]);
  const isEdit = mode === 'edit';
  const isClone = mode === 'clone';
  const submit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    try {
      await onSubmit({ name: name.trim(), inheritFromId: inherit === DEFAULT_PRICE_VALUE ? null : Number(inherit) });
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save the price set');
    }
  };
  const title = isEdit ? 'Edit Price Set' : isClone ? 'Clone Price Set' : 'Create Price Set';
  const options = (sets || []).filter((s) => !initial || s.id !== initial.id);
  return (
    <BadgeDialog open={open} onClose={saving ? undefined : onClose} title={title}>
      <Typography component="label" htmlFor="price-set-name" sx={{ display: 'block', fontSize: 16, color: TXT }}>Name</Typography>
      <Box
        component="input"
        id="price-set-name"
        type="text"
        autoFocus
        value={name}
        disabled={saving}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        sx={FIELD_INPUT_SX}
      />
      {/* Which outlet the new set lands in (global admin: picked outlet, or Global). */}
      {!isEdit && <CreatingForOutlet outletId={isClone ? initial?.outletId : undefined} sx={{ mt: 1, textAlign: 'left' }} />}
      {!isClone && (
        <>
          <Typography sx={{ fontSize: 16, color: TXT, mt: 1 }}>Inherit Prices From</Typography>
          <Select
            value={inherit}
            onChange={(e) => setInherit(e.target.value)}
            displayEmpty
            disabled={saving}
            sx={SELECT_SX}
            inputProps={{ 'aria-label': 'Inherit Prices From' }}
            MenuProps={{ PaperProps: { sx: MENU_PAPER_SX } }}
            renderValue={(v) => (v === DEFAULT_PRICE_VALUE
              ? <Box component="span" sx={{ color: '#808080' }}>Default Price</Box>
              : (sets.find((s) => String(s.id) === String(v))?.name || v))}
          >
            <MenuItem value={DEFAULT_PRICE_VALUE}>Default Price</MenuItem>
            {options.map((s) => <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>)}
          </Select>
        </>
      )}
      {error && <Typography sx={{ mt: 1, fontSize: 14, color: byMode('#dc2626', '#ffa2a2') }}>{error}</Typography>}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
        <Button
          disableRipple
          onClick={onClose}
          disabled={saving}
          sx={{ ...DIALOG_BTN_SX, color: byMode('#676b72', '#d4d4d4'), bgcolor: byMode('#f0f0f0', '#3a3a3a'), border: byMode('1px solid #000', '1px solid #a1a1a1'), '&:hover': { bgcolor: byMode('#e4e4e4', '#4a4a4a') } }}
        >
          Cancel
        </Button>
        <Button
          disableRipple
          onClick={submit}
          disabled={saving}
          sx={{
            ...DIALOG_BTN_SX,
            color: '#fff',
            bgcolor: isEdit ? BLUE : GREEN,
            '&:hover': { bgcolor: isEdit ? '#1f7fe3' : '#2aa53a' },
            '&.Mui-disabled': { color: '#fff', bgcolor: isEdit ? BLUE : GREEN, opacity: 0.6 },
          }}
        >
          {saving ? (isEdit ? 'Updating…' : 'Creating…') : isEdit ? 'Update' : isClone ? 'Clone' : 'Create'}
        </Button>
      </Box>
    </BadgeDialog>
  );
};

// ─── View page ────────────────────────────────────────────────────────────────

const GROUP_OPTIONS = [{ value: 'category', label: 'Category' }];

const PriceSetView = ({ id }) => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [group, setGroup] = useState('');

  useEffect(() => {
    let cancelled = false;
    setData(null);
    priceSetService.getPriceSetProducts(id)
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e?.response?.data?.error || 'Failed to load the price set'); });
    return () => { cancelled = true; };
  }, [id]);

  // Rows grouped per category (reference "Select Group" > Category); ungrouped
  // products come first under "No Category", then categories A–Z.
  const groups = useMemo(() => {
    const prices = data?.prices || [];
    if (group !== 'category') return [{ key: 'all', label: null, rows: prices }];
    const map = new Map();
    for (const row of prices) {
      const key = row.categoryId == null ? 'none' : String(row.categoryId);
      if (!map.has(key)) map.set(key, { key, label: row.categoryName || 'No Category', rows: [] });
      map.get(key).rows.push(row);
    }
    const list = [...map.values()];
    list.sort((a, b) => (a.key === 'none' ? -1 : b.key === 'none' ? 1 : a.label.localeCompare(b.label)));
    return list;
  }, [data, group]);

  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!data) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 1, pt: 1.5 }} data-testid="price-set-view">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            disableRipple
            startIcon={<BackIcon sx={{ fontSize: '28px !important' }} />}
            onClick={() => navigate('/settings/pricesets')}
            sx={{ ...PILL_SX, bgcolor: BLUE, borderRadius: 0, '&:hover': { bgcolor: '#1f7fe3' } }}
          >
            Back
          </Button>
          <Typography component="h1" sx={{ fontSize: 28, fontWeight: 700, color: TXT }}>{data.priceSet?.name}</Typography>
        </Box>
        <Typography sx={{ fontSize: 22, fontWeight: 700, color: TXT }}>Total Count: {data.totalCount ?? (data.prices || []).length}</Typography>
      </Box>

      <Select
        value={group}
        onChange={(e) => setGroup(e.target.value)}
        displayEmpty
        sx={{ ...SELECT_SX, width: 230, height: 42, mb: 4, borderRadius: '8px' }}
        inputProps={{ 'aria-label': 'Select Group' }}
        MenuProps={{
          // Sit flush under the box (same 230 width, left edges aligned).
          anchorOrigin: { vertical: 'bottom', horizontal: 'left' },
          transformOrigin: { vertical: 'top', horizontal: 'left' },
          marginThreshold: 0, // the box sits 8px from the page edge; don't push the list right
          PaperProps: { sx: { width: 230, minWidth: 230, mt: '2px', border: byMode('1px solid #000', '1px solid #a1a1a1'), borderRadius: '8px', boxShadow: 'none', '& li': { fontSize: 16, minHeight: 48 }, '& li:focus-visible': { outline: 'none' } } },
        }}
        renderValue={(v) => (v ? GROUP_OPTIONS.find((o) => o.value === v)?.label : <Box component="span" sx={{ color: byMode('#404040', '#757575') }}>Select Group...</Box>)}
        endAdornment={group ? (
          <IconButton size="small" aria-label="Clear group" sx={{ mr: 2 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setGroup(''); }}>
            <ClearIcon fontSize="small" />
          </IconButton>
        ) : null}
      >
        {GROUP_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </Select>

      <TableContainer>
        <Table sx={{ ...GRID_TABLE_SX, '& td': { border: GRID_LINE, fontSize: 16, color: TXT, padding: '8px 8px' } }}>
          <TableHead>
            <TableRow sx={{ '& th': { bgcolor: byMode('#5ebbeb', '#333333'), color: byMode('#fff', '#5ebbeb'), fontWeight: 700, border: GRID_LINE, padding: '8px' } }}>
              <TableCell sx={{ width: '42%' }}>Product</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Price (ex. tax)</TableCell>
              <TableCell>Price (inc. tax)</TableCell>
              <TableCell sx={{ width: '9.5%' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {(data.prices || []).length === 0 && (
              <TableRow><TableCell colSpan={5} align="center" sx={{ color: byMode('#676b72', '#a0a4aa') }}>No prices in this price set.</TableCell></TableRow>
            )}
            {groups.map((g) => (
              <React.Fragment key={g.key}>
                {g.label != null && (
                  <TableRow data-testid="price-set-group">
                    <TableCell colSpan={5} sx={{ fontWeight: 400, color: byMode('#313439', '#f8f8f8') }}>{g.label}</TableCell>
                  </TableRow>
                )}
                {g.rows.map((row, i) => (
                  <TableRow key={row.id} sx={{ bgcolor: byMode(i % 2 === 1 ? '#ebebeb' : '#fff', i % 2 === 1 ? '#2a2a2a' : '#232323') }} data-testid="price-set-row">
                    <TableCell>
                      <Box component={RouterLink} to={`/products/${row.productId}/view`} sx={{ color: LINK_BLUE, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                        {row.productName}
                      </Box>
                    </TableCell>
                    <TableCell align="center">{row.quantity}</TableCell>
                    <TableCell align="center">{money(row.priceExTax)}</TableCell>
                    <TableCell align="center">{money(row.priceIncTax)}</TableCell>
                    <TableCell align="center">
                      <Button disableRipple component={RouterLink} to={`/products/${row.productId}/edit`} startIcon={<EditIcon />} sx={LINK_SX(LINK_BLUE)}>
                        Edit
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ─── List page ────────────────────────────────────────────────────────────────

const PriceSets = () => {
  const { id: viewId } = useParams();
  const navigate = useNavigate();
  const { alert, confirm, notify } = useAppDialogs();
  const canEdit = useHasPermission('settings.edit');
  const { selectedOutlet } = useSelectedOutlet() || {};
  // All Outlets mode (global admin, no outlet picked): every outlet's sets are
  // listed, so each row says which outlet it belongs to ("Global" = shared).
  const { globalMode, outletNameOf } = useGlobalOutlet();

  const [priceSets, setPriceSets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null); // {mode:'create'|'edit'|'clone', set}
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const loadPriceSets = async () => {
    try {
      setLoading(true);
      const { priceSets: list } = await priceSetService.getPriceSets();
      setPriceSets(list || []);
      setError('');
    } catch (e) {
      console.error('Error loading price sets:', e);
      setError('Failed to load price sets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPriceSets(); }, [selectedOutlet?.id, globalMode]);

  const handleSubmit = async ({ name, inheritFromId }) => {
    setSaving(true);
    try {
      if (dialog.mode === 'edit') {
        const res = await priceSetService.updatePriceSet(dialog.set.id, { name, inheritFromId });
        notify(res?.copied ? `Price set updated — ${res.copied} price${res.copied === 1 ? '' : 's'} inherited` : 'Price set updated', 'success', { position: 'top' });
      } else if (dialog.mode === 'clone') {
        const res = await priceSetService.clonePriceSet(dialog.set.id, name);
        notify(`Price set cloned with ${res?.copied ?? 0} price${res?.copied === 1 ? '' : 's'}`, 'success', { position: 'top' });
      } else {
        const res = await priceSetService.createPriceSet({ name, inheritFromId });
        notify(`Price set created with ${res?.copied ?? 0} price${res?.copied === 1 ? '' : 's'}`, 'success', { position: 'top' });
      }
      setDialog(null);
      await loadPriceSets();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ps) => {
    const ok = await confirm(`Delete the price set "${ps.name}"?`, { title: 'Delete price set', confirmText: 'Delete', severity: 'warning' });
    if (!ok) return;
    setDeletingId(ps.id);
    try {
      await priceSetService.deletePriceSet(ps.id);
      notify('Price set deleted', 'success', { position: 'top' });
      await loadPriceSets();
    } catch (e) {
      alert(e?.response?.data?.error || 'Failed to delete the price set', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  if (viewId) return <PriceSetView id={viewId} />;

  return (
    <Box sx={{ p: 1, pt: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: TXT }}>Price Sets</Typography>
        {canEdit && (
          <Button
            disableRipple
            startIcon={<AddIcon sx={{ fontSize: '28px !important' }} />}
            onClick={() => setDialog({ mode: 'create', set: null })}
            sx={{ ...PILL_SX, bgcolor: GREEN, borderRadius: 0, '&:hover': { bgcolor: '#2aa53a' } }}
          >
            New
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table sx={GRID_TABLE_SX}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: globalMode ? '34%' : '46.5%' }}>Name</TableCell>
                {globalMode && <TableCell sx={{ width: '18%' }}>Outlet</TableCell>}
                <TableCell sx={{ width: globalMode ? '24%' : '35%' }}>Number of Prices</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {priceSets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={globalMode ? 4 : 3} align="center" sx={{ color: byMode('#676b72', '#a0a4aa') }}>
                    No price sets yet. {canEdit && 'Click "New" to create your first one.'}
                  </TableCell>
                </TableRow>
              ) : (
                priceSets.map((ps, i) => (
                  <TableRow key={ps.id} sx={{ bgcolor: byMode(i % 2 === 0 ? '#f8f8f8' : '#fff', i % 2 === 0 ? '#2a2a2a' : '#232323') }} data-testid="price-set-row">
                    <TableCell>{ps.name}</TableCell>
                    {globalMode && <TableCell data-testid="price-set-outlet">{outletNameOf(ps.outletId)}</TableCell>}
                    <TableCell>{ps.priceCount}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5 }}>
                        <Button disableRipple startIcon={<ViewIcon />} onClick={() => navigate(`/settings/pricesets/${ps.id}`)} sx={LINK_SX(LINK_BLUE)}>
                          View
                        </Button>
                        {canEdit && (
                          <>
                            <Button disableRipple startIcon={<EditIcon />} onClick={() => setDialog({ mode: 'edit', set: ps })} sx={LINK_SX(LINK_GREEN)}>
                              Edit
                            </Button>
                            {/* Reference: Delete is greyed out while the set still holds prices */}
                            {/* User choice (16/11): keep a tooltip explaining the greyed Delete (ref has none). */}
                            <Tooltip
                              title={ps.priceCount > 0 ? `Cannot delete: this price set still has ${ps.priceCount} price${ps.priceCount === 1 ? '' : 's'} on products. Remove them from the products first.` : ''}
                              arrow
                              placement="top-start"
                              slotProps={{ tooltip: { sx: { maxWidth: 260, fontSize: 12 } } }}
                            >
                              {/* span so the tooltip still works on the disabled button */}
                              <span>
                                <Button
                                  disableRipple
                                  startIcon={<DeleteIcon />}
                                  onClick={() => handleDelete(ps)}
                                  disabled={ps.priceCount > 0 || deletingId != null}
                                  sx={LINK_SX(LINK_RED)}
                                >
                                  {deletingId === ps.id ? 'Deleting...' : 'Delete'}
                                </Button>
                              </span>
                            </Tooltip>
                            <Button disableRipple startIcon={<CloneIcon />} onClick={() => setDialog({ mode: 'clone', set: { ...ps, name: `${ps.name} (Copy)` } })} sx={LINK_SX(LINK_BLUE)}>
                              Clone
                            </Button>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <PriceSetDialog
        open={!!dialog}
        mode={dialog?.mode}
        initial={dialog?.set}
        sets={priceSets}
        saving={saving}
        onClose={() => setDialog(null)}
        onSubmit={handleSubmit}
      />
    </Box>
  );
};

export default PriceSets;
