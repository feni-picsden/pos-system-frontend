import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  IconButton,
  Paper,
  Popover,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
  AttachMoney as AttachMoneyIcon,
  Delete as DeleteIcon,
  AccountTreeOutlined as AccountTreeOutlinedIcon,
  BuildOutlined as BuildOutlinedIcon,
  Close as CloseIcon,
  SaveOutlined as SaveOutlinedIcon,
  Edit as EditIcon,
  FlipToBackOutlined as FlipToBackIcon,
  FlipToFrontOutlined as FlipToFrontIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  ImageOutlined as ImageOutlinedIcon,
  InfoOutlined as InfoOutlinedIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  Settings as SettingsIcon,
  Slideshow as SlideshowIcon,
  TableChartOutlined as TableChartOutlinedIcon,
  TextFields as TextFieldsIcon,
} from '@mui/icons-material';
import { ChromePicker } from 'react-color';
import { useNavigate, useParams } from 'react-router-dom';
import MediaDialog from '../../components/Common/MediaDialog';
// App-wide toggle look (same as the other Setup pages)
import Switch from '../../components/Common/ShopfrontSwitch';
import { getMediaUrl } from '../../components/Common/mediaCentreUi';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { format as formatDate, isValid as isValidDate } from 'date-fns';

// Calendar popover styled like the Promotions wizard picker.
const PICKER_POPOVER_SX = {
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  border: '1px solid #e5e5e5',
  boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
};
// Slide dates are kept as local "yyyy-MM-ddTHH:mm" strings (what the renderer parses).
const slideDateToDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isValidDate(d) ? d : null;
};
const dateToSlideDate = (date) => (date && isValidDate(date) ? formatDate(date, "yyyy-MM-dd'T'HH:mm") : '');
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import CustomerDisplayRenderer from '../../components/CustomerDisplay/CustomerDisplayRenderer';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import { createDefaultCustomerDisplayTemplate } from '../../utils/customerDisplayDefaults';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import { REF_MENU_PROPS } from '../../components/Common/refMenuProps';

// Columns the renderer draws when a sale table has no saved headers (same order).
const DEFAULT_SALE_TABLE_HEADERS = [
  { key: 'product', label: 'Product', visible: true, align: 'Default' },
  { key: 'quantity', label: 'Quantity', visible: true, align: 'Default' },
  { key: 'price', label: 'Price', visible: true, align: 'Default' },
  { key: 'total', label: 'Total', visible: true, align: 'Default' },
];

// Rows the Totals component can show (reference order; Remaining and Paid start off).
const DEFAULT_TOTALS_LABELS = [
  { key: 'total', label: 'Total:', visible: true },
  { key: 'savings', label: 'Savings:', visible: true },
  { key: 'change', label: 'Change:', visible: true },
  { key: 'approved', label: 'Approved', visible: true },
  { key: 'thank_you', label: 'Thank You', visible: true },
  { key: 'remaining', label: 'Remaining', visible: false },
  { key: 'paid', label: 'Paid', visible: false },
];

const componentTypes = [
  { id: 'slideshow', label: 'Slide Show', icon: SlideshowIcon },
  { id: 'sale-table', label: 'Sale Table', icon: TableChartOutlinedIcon },
  { id: 'totals', label: 'Totals', icon: AttachMoneyIcon },
  { id: 'image', label: 'Image', icon: ImageOutlinedIcon },
  { id: 'text', label: 'Text', icon: TextFieldsIcon },
];

const getDefaultLayoutByMode = (componentMode, type) => {
  if (componentMode === 'sale') {
    if (type === 'sale-table') return { x: 0, y: 0, w: 72, h: 58 };
    if (type === 'totals') return { x: 72, y: 0, w: 28, h: 28 };
    if (type === 'slideshow') return { x: 0, y: 58, w: 72, h: 42 };
    if (type === 'image') return { x: 72, y: 28, w: 28, h: 30 };
    if (type === 'text') return { x: 5, y: 62, w: 28, h: 14 };
    return { x: 5, y: 58, w: 30, h: 30 };
  }

  if (type === 'slideshow') return { x: 5, y: 8, w: 45, h: 70 };
  if (type === 'text') return { x: 52, y: 8, w: 43, h: 18 };
  if (type === 'image') return { x: 52, y: 30, w: 43, h: 48 };
  return { x: 5, y: 5, w: 30, h: 30 };
};

const createComponent = (type, index, componentMode) => ({
  id: `${type}-${Date.now()}-${index}`,
  type,
  ...getDefaultLayoutByMode(componentMode, type),
  zIndex: index + 1,
  settings:
    type === 'text'
      ? { text: 'Text', color: '#ffffff', fontSize: 26, bold: false, italic: false, underline: false }
      : type === 'slideshow'
      ? { slides: [], fallbackText: 'Edit slideshow', backgroundColor: '#000000' }
      : type === 'sale-table'
      ? {
          textColor: '#ffffff',
          backgroundColor: '#000000',
          promotionColor: '#00ff3b',
          showGrid: true,
          gridLineColor: '#000000',
          footerTextColor: '#ffffff',
          footerBackgroundColor: '#000000',
          headers: [
            { key: 'product', label: 'Product', visible: true, align: 'Default' },
            { key: 'quantity', label: 'Quantity', visible: true, align: 'Default' },
            { key: 'price', label: 'Price', visible: true, align: 'Default' },
            { key: 'total', label: 'Total', visible: true, align: 'Default' },
          ],
        }
      : type === 'totals'
      ? {
          textColor: '#ffffff',
          backgroundColor: '#000000',
          promotionColor: '#00ff3b',
          fontSize: 45,
          bold: true,
          italic: false,
          underline: false,
          labels: [
            { key: 'total', label: 'Total:', visible: true },
            { key: 'savings', label: 'Savings:', visible: true },
            { key: 'change', label: 'Change:', visible: true },
            { key: 'approved', label: 'Approved', visible: true },
            { key: 'thank_you', label: 'Thank You', visible: true },
            { key: 'remaining', label: 'Remaining', visible: false },
            { key: 'paid', label: 'Paid', visible: false },
          ],
        }
      : type === 'image'
      ? { src: '', fallbackText: 'Select to Add Image', backgroundColor: '#000000', containWidth: true, containHeight: true, stretchToFill: false }
      : {},
});

const LIST_PATH = '/settings/customer-display';

const isVideoUrl = (url = '') => /\.(mp4|webm|mov|ogg)(\?|#|$)/i.test(String(url));
const slideName = (slide, index) => {
  try {
    const path = String(slide?.url || '').split(/[?#]/)[0];
    return decodeURIComponent(path.split('/').pop() || '') || `Slide ${index + 1}`;
  } catch {
    return `Slide ${index + 1}`;
  }
};

// Slide thumbnail (reference lists thumbnail + filename + "N seconds").
const SlideThumb = ({ url, size = 48 }) => (
  <Box
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      bgcolor: '#000',
      border: '1px solid #9d9d9d',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}
  >
    {url ? (
      isVideoUrl(url) ? (
        <Box component="video" src={getMediaUrl(url)} muted sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Box component="img" src={getMediaUrl(url)} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      )
    ) : (
      <SlideshowIcon sx={{ color: '#fff', fontSize: size * 0.55 }} />
    )}
  </Box>
);

// What Save sends - compared to decide whether there are unsaved changes.
const snapshotOf = (template) => JSON.stringify({
  name: template?.name,
  defaultTextColor: template?.defaultTextColor,
  defaultBackgroundColor: template?.defaultBackgroundColor,
  idle: template?.idle,
  sale: template?.sale,
});

const moveItem = (list, from, to) => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

const CustomerDisplayEditor = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm } = useAppDialogs();
  const gridSize = { rows: 10, cols: 10 };
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(createDefaultCustomerDisplayTemplate());
  // The last saved/loaded state; Cancel asks before throwing away a change.
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState('idle');
  const [selectedId, setSelectedId] = useState('');
  const [componentTab, setComponentTab] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [slideMediaDialogOpen, setSlideMediaDialogOpen] = useState(false);
  // Edit Slideshow works on a draft: Confirm commits it, Cancel throws it away.
  const [slideDraft, setSlideDraft] = useState([]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(-1);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  // Configure Customer Display works on a draft too: Update applies, Cancel reverts.
  const [configDraft, setConfigDraft] = useState({ name: '', defaultTextColor: '#ffffff', defaultBackgroundColor: '#000000' });
  const [configError, setConfigError] = useState('');
  const [colorPickerState, setColorPickerState] = useState({
    anchorEl: null,
    color: '#000000',
    onChange: null,
  });

  const openConfigDialog = (source) => {
    const src = source || template;
    setConfigDraft({
      name: src?.name || '',
      defaultTextColor: src?.defaultTextColor || '#ffffff',
      defaultBackgroundColor: src?.defaultBackgroundColor || '#000000',
    });
    setConfigError('');
    setNameDialogOpen(true);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!templateId || templateId === 'new') {
        const created = createDefaultCustomerDisplayTemplate();
        setTemplate(created);
        setSavedSnapshot('');
        setSelectedId('');
        openConfigDialog(created);
        return;
      }
      setNameDialogOpen(false);
      let existing = null;
      try {
        existing = await customerDisplayTemplateService.getTemplate(templateId);
      } catch (err) {
        console.error(err);
      }
      if (!existing) {
        const all = await customerDisplayTemplateService.listTemplates();
        existing = all.find((item) => String(item.id) === String(templateId)) || null;
      }
      if (cancelled) return;
      if (existing) {
        setTemplate(existing);
        setSavedSnapshot(snapshotOf(existing));
        setSelectedId('');
      } else {
        navigate(LIST_PATH, { replace: true });
      }
    };
    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId, navigate]);

  const activeComponents = useMemo(() => template?.[mode]?.components || [], [template, mode]);
  const selectedComponent = activeComponents.find((item) => item.id === selectedId);
  const isDirty = templateId === 'new' || snapshotOf(template) !== savedSnapshot;

  const saveTemplate = async (override) => {
    if (saving) return false;
    const toSave = override || template;
    if (!String(toSave?.name || '').trim()) {
      alert('Please enter a name for the customer display');
      return false;
    }
    setSaving(true);
    try {
      const { savedId } = await customerDisplayTemplateService.upsertTemplate(toSave);
      setSavedSnapshot(snapshotOf(toSave));
      const replaceHistory = templateId === 'new';
      if (replaceHistory && savedId != null && savedId !== '') {
        navigate(`${LIST_PATH}/${savedId}/edit`, { replace: true });
      } else {
        navigate(LIST_PATH, { replace: replaceHistory });
      }
      return true;
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.message || 'Failed to save customer display template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (isDirty) {
      const ok = await confirm('You have unsaved changes. Leave without saving?', {
        title: 'Unsaved Changes',
        confirmText: 'Leave',
      });
      if (!ok) return;
    }
    navigate(LIST_PATH);
  };

  const handleTemplateDialogPrimaryAction = async () => {
    const name = String(configDraft.name || '').trim();
    if (!name) {
      setConfigError('Please enter a name for the customer display');
      return;
    }
    if (name.length > 100) {
      setConfigError('The name can be at most 100 characters');
      return;
    }
    const next = {
      ...template,
      name,
      defaultTextColor: configDraft.defaultTextColor,
      defaultBackgroundColor: configDraft.defaultBackgroundColor,
    };
    // For new templates, this dialog is the first action users take.
    // Save immediately so the create API is called from here as well.
    if (templateId === 'new') {
      setTemplate(next);
      const ok = await saveTemplate(next);
      if (ok) setNameDialogOpen(false);
      return;
    }
    setTemplate(next);
    setNameDialogOpen(false);
  };

  const handleTemplateDialogCancel = () => {
    setNameDialogOpen(false);
    setConfigError('');
    // A brand-new template that was never named has nothing to keep.
    if (templateId === 'new') navigate(LIST_PATH, { replace: true });
  };

  // Replace one mode's component list WITHOUT mutating the previous state
  // (the old `next[mode].components = ...` wrote into the object the previous
  // state still referenced, so an updater that ran twice compounded itself).
  const withComponents = (prev, components) => ({
    ...prev,
    [mode]: { ...(prev?.[mode] || {}), components },
  });

  const updateSelected = (updater) => {
    if (!selectedComponent) return;
    setTemplate((prev) =>
      withComponents(prev, (prev?.[mode]?.components || []).map((component) =>
        component.id === selectedId ? updater(component) : component
      ))
    );
  };

  const updateSelectedSettings = (settingsUpdate) => {
    updateSelected((item) => ({
      ...item,
      settings: {
        ...(item.settings || {}),
        ...settingsUpdate,
      },
    }));
  };

  const openColorPicker = (event, color, onChange) => {
    setColorPickerState({
      anchorEl: event.currentTarget,
      color: color || '#000000',
      onChange,
    });
  };

  const closeColorPicker = () => {
    setColorPickerState({ anchorEl: null, color: '#000000', onChange: null });
  };

  const renderColorField = (label, value, onChange, sx = {}) => {
    const raw = (value || '').trim();
    const isHex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(raw);
    // No colour set = transparent: show a checkerboard instead of pretending it is black.
    const hex = isHex ? raw : '#000000';
    const transparentSx = isHex
      ? {}
      : {
          backgroundImage:
            'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
          backgroundSize: '12px 12px',
          backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
          bgcolor: '#fff',
        };
    return (
      <Box sx={{ mb: 1.5, ...sx }}>
        <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
          {label}
        </Typography>
        <Box
          onClick={(event) => openColorPicker(event, hex, onChange)}
          role="button"
          tabIndex={0}
          aria-label={`${label}, open colour picker`}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openColorPicker(event, hex, onChange);
            }
          }}
          sx={{
            width: '100%',
            height: 44,
            minHeight: 44,
            bgcolor: hex,
            ...transparentSx,
            border: '5px solid #1a1a1a',
            borderRadius: 0.5,
            cursor: 'pointer',
            boxSizing: 'border-box',
            '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: 2 },
          }}
          title={isHex ? hex : 'Transparent (click to pick a colour)'}
        />
      </Box>
    );
  };

  const updateSelectedById = (componentId, updates) => {
    setTemplate((prev) =>
      withComponents(prev, (prev?.[mode]?.components || []).map((component) =>
        component.id === componentId ? { ...component, ...updates } : component
      ))
    );
  };

  const addComponent = (type) => {
    const findNextAvailablePosition = (list, widthCells = 1, heightCells = 1) => {
      const toCells = (component) => {
        const cellW = 100 / gridSize.cols;
        const cellH = 100 / gridSize.rows;
        const x = Math.max(0, Math.round((component.x || 0) / cellW));
        const y = Math.max(0, Math.round((component.y || 0) / cellH));
        const w = Math.max(1, Math.round((component.w || cellW) / cellW));
        const h = Math.max(1, Math.round((component.h || cellH) / cellH));
        return { x, y, w, h };
      };

      for (let row = 0; row <= gridSize.rows - heightCells; row += 1) {
        for (let col = 0; col <= gridSize.cols - widthCells; col += 1) {
          const occupied = list.some((component) => {
            const c = toCells(component);
            return (
              col < c.x + c.w &&
              col + widthCells > c.x &&
              row < c.y + c.h &&
              row + heightCells > c.y
            );
          });
          if (!occupied) return { x: col, y: row };
        }
      }
      return { x: 0, y: 0 };
    };

    setTemplate((prev) => {
      const list = [...(prev?.[mode]?.components || [])];
      const newItem = createComponent(type, list.length, mode);
      // On top of everything already there: `list.length + 1` collided with an
      // existing zIndex after a delete or a layer swap, so the new component
      // and an old one could not be reordered against each other.
      newItem.zIndex = list.reduce((max, item) => Math.max(max, Number(item.zIndex) || 0), 0) + 1;
      const cellW = 100 / gridSize.cols;
      const cellH = 100 / gridSize.rows;
      const desiredWidthCells = Math.max(1, Math.round((newItem.w || cellW) / cellW));
      const desiredHeightCells = Math.max(1, Math.round((newItem.h || cellH) / cellH));
      const pos = findNextAvailablePosition(list, desiredWidthCells, desiredHeightCells);
      newItem.x = pos.x * cellW;
      newItem.y = pos.y * cellH;
      newItem.w = desiredWidthCells * cellW;
      newItem.h = desiredHeightCells * cellH;
      list.push(newItem);
      return withComponents(prev, list);
    });
    setMenuAnchor(null);
  };

  const moveLayer = (direction) => {
    if (!selectedComponent) return;
    setTemplate((prev) => {
      const list = prev?.[mode]?.components || [];
      const sorted = [...list].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const index = sorted.findIndex((item) => item.id === selectedId);
      if (index === -1) return prev;
      const swapWith = direction === 'up' ? index + 1 : index - 1;
      if (swapWith < 0 || swapWith >= sorted.length) return prev;
      // Swap positions in the stacking ORDER and renumber 1..n. Swapping the two
      // zIndex values did nothing when they were equal (the default template
      // gives every component zIndex 1), so Bring Forwards / Send Backwards had
      // no effect until the user had added components.
      const zIndexById = new Map(moveItem(sorted, index, swapWith).map((item, i) => [item.id, i + 1]));
      return withComponents(prev, list.map((item) => ({ ...item, zIndex: zIndexById.get(item.id) })));
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setTemplate((prev) => withComponents(prev, (prev?.[mode]?.components || []).filter((item) => item.id !== selectedId)));
    setSelectedId('');
    setComponentTab(0);
  };

  // Ref parity: selecting a component auto-opens Settings; clearing selection returns to Components.
  const selectComponent = (id) => {
    setSelectedId(id || '');
    setComponentTab(id ? 1 : 0);
  };

  const switchMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setSelectedId('');
    setComponentTab(0);
  };

  // Delete stays enabled with no selection (template-level delete, like the reference).
  const handleConfirmDelete = async () => {
    if (selectedComponent) {
      deleteSelected();
      setConfirmDeleteOpen(false);
      return;
    }
    try {
      const idNum = Number(template?.id);
      if (Number.isFinite(idNum) && idNum > 0) {
        await customerDisplayTemplateService.removeTemplate(idNum);
      }
      setConfirmDeleteOpen(false);
      setSavedSnapshot(snapshotOf(template));
      navigate(LIST_PATH);
    } catch (err) {
      console.error(err);
      setConfirmDeleteOpen(false);
      alert(err?.response?.data?.error || err?.message || 'Failed to delete customer display template');
    }
  };

  const sortedComponentNames = useMemo(
    () => [...activeComponents].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)),
    [activeComponents]
  );

  return (
    <Box sx={{ p: 1.25, height: 'calc(100vh - 72px)', bgcolor: '#ebebeb' }}>
      <Grid container spacing={1} sx={{ height: '100%' }}>
        <Grid item xs={9.5} sx={{ height: '100%' }}>
          <Paper
            sx={{
              px: 1,
              py: 0.4,
              mb: 0.75,
              borderRadius: 0,
              boxShadow: 'none',
              display: 'flex',
              backgroundSize: '14px 14px',
              alignItems: 'center',
              bgcolor: 'transparent',
              justifyContent: 'space-between',
              minHeight: 52,
            }}
          > 
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5,  px: 0.6, py: 0.2 }}>
              <Typography component="h2" sx={{ fontWeight: 700, mr: 0.1, fontSize: 24, color: '#000' }}>
                {(template?.name || 'Customer Display')} Modify
              </Typography>
              <IconButton
                disableRipple
                aria-label="Configure Customer Display"
                onClick={() => openConfigDialog()}
                sx={{
                  p: 0.5,
                  borderRadius: '8px',
                  bgcolor: 'transparent',
                  transition: 'none',
                  '&:hover': { bgcolor: '#dedede' },
                }}
              >
                <SettingsIcon sx={{ fontSize: 24, color: '#000' }} />
              </IconButton>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              {['idle', 'sale'].map((screen) => (
                <Button
                  key={screen}
                  onClick={() => switchMode(screen)}
                  sx={{
                    minWidth: 59,
                    borderRadius: 0,
                    height: 51,
                    px: 1.5,
                    fontSize: 16,
                    fontWeight: 400,
                    textTransform: 'none',
                    color: '#f8f8f8',
                    bgcolor: mode === screen ? 'rgb(28,158,225)' : 'rgb(49,52,57)',
                    transition: 'background .4s ease, color .2s ease-in-out',
                    '&:hover': {
                      bgcolor: mode === screen ? 'rgb(28,158,225)' : 'rgb(14,78,111)',
                    },
                  }}
                >
                  {screen === 'idle' ? 'Idle' : 'Sale'}
                </Button>
              ))}
              <Button
                startIcon={<DeleteIcon />}
                onClick={() => setConfirmDeleteOpen(true)}
                sx={{
                  minWidth: 111,
                  borderRadius: 0,
                  height: 53,
                  fontSize: 16,
                  fontWeight: 400,
                  textTransform: 'none',
                  color: '#f8f8f8',
                  bgcolor: 'rgb(227,52,47)',
                  border: '1px solid rgb(227,52,47)',
                  transition: 'background 0.2s, color 0.2s',
                  '&:hover': {
                    bgcolor: '#f8f8f8',
                    color: 'rgb(227,52,47)',
                  },
                }}
              >
                Delete
              </Button>
              <Button
                onClick={(e) => setMenuAnchor(menuAnchor ? null : e.currentTarget)}
                sx={{
                  minWidth: 79,
                  borderRadius: 0,
                  height: 50,
                  px: 1,
                  color: '#fff',
                  bgcolor: 'rgb(50,182,67)',
                  transition: 'background 0.2s',
                  '&:hover': { bgcolor: 'rgb(34,122,45)' },
                }}
              >
                <AddIcon sx={{ fontSize: 32 }} />
                {/* Split-button divider, then the arrow (points up while the menu is open) */}
                <Box sx={{ width: '1px', alignSelf: 'stretch', my: 1, mx: 0.75, bgcolor: 'rgba(255,255,255,0.6)' }} />
                <KeyboardArrowDownIcon sx={{ fontSize: 16, transform: menuAnchor ? 'rotate(180deg)' : 'none', transition: 'transform 120ms' }} />
              </Button>
            </Box>
          </Paper>
          <Paper sx={{ height: 'calc(100% - 66px)', borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: template?.defaultBackgroundColor || '#000' }}>
            <CustomerDisplayRenderer
              template={template}
              mode={mode}
              // Reference editor shows example sale data so the Sale layout can be judged.
              data={{
                cartItems: [
                  { id: 'example-1', name: 'Example Item', quantity: 24, unitPrice: 10, totalPrice: 240 },
                  { id: 'example-2', name: 'Example Promotion Item', quantity: 12, unitPrice: 5, totalPrice: 60, isPromotion: true },
                ],
                totals: { total: 10, savings: 2, itemCount: 36 },
              }}
              selectedComponentId={selectedId}
              onSelectComponent={selectComponent}
              onChangeComponent={updateSelectedById}
              editable
              showEditorGrid
              snapToGrid
              gridCols={gridSize.cols}
              gridRows={gridSize.rows}
            />
          </Paper>
        </Grid>

        <Grid item xs={2.5} sx={{ height: '100%' }}>
          <Paper sx={{ height: '100%', borderRadius: 0.5, border: '1px solid #9d9d9d', display: 'flex', flexDirection: 'column' }}>
            <Tabs
              value={componentTab}
              onChange={(_, value) => setComponentTab(value)}
              variant="fullWidth"
              TabIndicatorProps={{ sx: { display: 'none' } }}
              sx={{ minHeight: 64, bgcolor: '#ebebeb' }}
            >
              <Tab
                label="Components"
                icon={<AccountTreeOutlinedIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
                sx={{
                  minHeight: 64,
                  height: 64,
                  fontSize: 18,
                  textTransform: 'none',
                  color: '#000',
                  borderBottom: '4px solid',
                  borderBottomColor: componentTab === 0 ? '#3b82f6' : '#9ca3af',
                  '&.Mui-selected': { color: '#000' },
                }}
              />
              <Tab
                label="Settings"
                icon={<BuildOutlinedIcon sx={{ fontSize: 18 }} />}
                iconPosition="start"
                disabled={!selectedComponent}
                sx={{
                  minHeight: 64,
                  height: 64,
                  fontSize: 18,
                  textTransform: 'none',
                  color: '#000',
                  borderBottom: '4px solid',
                  borderBottomColor: componentTab === 1 ? '#3b82f6' : '#9ca3af',
                  '&.Mui-selected': { color: '#000' },
                  '&.Mui-disabled': { color: 'rgba(16,16,16,.3)', cursor: 'not-allowed', pointerEvents: 'auto' },
                }}
              />
            </Tabs>
            {componentTab === 0 ? (
              <List disablePadding sx={{ overflow: 'auto' }}>
                {sortedComponentNames.map((item) => {
                  const typeDef = componentTypes.find((type) => type.id === item.type);
                  const TypeIcon = typeDef?.icon;
                  return (
                    <ListItemButton
                      key={item.id}
                      selected={item.id === selectedId}
                      onClick={() => selectComponent(item.id)}
                      sx={{
                        height: 80,
                        gap: 1.5,
                        transition: 'none',
                        '&:hover': { bgcolor: '#bfdbfe' },
                        '&.Mui-selected': { bgcolor: '#bfdbfe' },
                        '&.Mui-selected:hover': { bgcolor: '#bfdbfe' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 45,
                          height: 48,
                          flexShrink: 0,
                          bgcolor: '#000',
                          border: '2px solid #000',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          p: '2px',
                        }}
                      >
                        {TypeIcon && <TypeIcon sx={{ color: '#fff', fontSize: 26 }} />}
                      </Box>
                      <ListItemText primary={typeDef?.label || item.type} />
                    </ListItemButton>
                  );
                })}
              </List>
            ) : (
              <Box sx={{ p: 1, overflow: 'auto' }}>
                {!selectedComponent && <Typography variant="body2">Select a component</Typography>}
                {selectedComponent && (
                  <>
                    {/* Reference: two outlined boxes side by side, icon above the label */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                      {[
                        { label: 'Bring Forwards', dir: 'up', icon: <FlipToFrontIcon sx={{ fontSize: 18 }} /> },
                        { label: 'Send Backwards', dir: 'down', icon: <FlipToBackIcon sx={{ fontSize: 18 }} /> },
                      ].map(({ label, dir, icon }) => (
                        <Button
                          key={dir}
                          disableRipple
                          onClick={() => moveLayer(dir)}
                          sx={{
                            flex: 1,
                            flexDirection: 'column',
                            gap: 0.25,
                            py: 1,
                            border: '1px solid #9d9d9d',
                            borderRadius: '4px',
                            bgcolor: '#f8f8f8',
                            color: '#676b72',
                            textTransform: 'none',
                            fontSize: 14,
                            lineHeight: 1.2,
                            '&:hover': { bgcolor: '#ebebeb' },
                          }}
                        >
                          {icon}
                          {label}
                        </Button>
                      ))}
                    </Box>
                    {/* Size stays inside the screen: 1..100 and never past the right/bottom edge.
                        An empty field is ignored (keeps the last size) instead of collapsing to 0. */}
                    <TextField
                      fullWidth
                      label="Width (%)"
                      type="number"
                      inputProps={{ min: 1, max: 100 }}
                      value={selectedComponent.w}
                      onChange={(e) => {
                        if (e.target.value === '') return;
                        const w = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                        updateSelected((item) => ({ ...item, w: Math.min(w, 100 - (Number(item.x) || 0)) }));
                      }}
                      sx={{ mb: 1 }}
                    />
                    <TextField
                      fullWidth
                      label="Height (%)"
                      type="number"
                      inputProps={{ min: 1, max: 100 }}
                      value={selectedComponent.h}
                      onChange={(e) => {
                        if (e.target.value === '') return;
                        const h = Math.max(1, Math.min(100, Number(e.target.value) || 1));
                        updateSelected((item) => ({ ...item, h: Math.min(h, 100 - (Number(item.y) || 0)) }));
                      }}
                      sx={{ mb: 1 }}
                    />
                    {renderColorField(
                      'Background Colour',
                      selectedComponent?.settings?.backgroundColor || '',
                      (nextColor) => updateSelectedSettings({ backgroundColor: nextColor })
                    )}
                    {selectedComponent.type === 'text' && (
                      <>
                        {renderColorField(
                          'Text Colour',
                          selectedComponent?.settings?.color || '#ffffff',
                          (nextColor) => updateSelectedSettings({ color: nextColor })
                        )}
                        <TextField
                          fullWidth
                          multiline
                          minRows={3}
                          label="Text"
                          value={selectedComponent?.settings?.text || ''}
                          onChange={(e) => updateSelectedSettings({ text: e.target.value })}
                          helperText="Use {{customerName}} to show the customer attached to the sale"
                          sx={{ mb: 1 }}
                        />
                        <TextField
                          fullWidth
                          label="Text Size"
                          type="number"
                          value={selectedComponent?.settings?.fontSize || 24}
                          onChange={(e) => updateSelectedSettings({ fontSize: Number(e.target.value) })}
                          sx={{ mb: 1 }}
                        />
                        <Typography variant="body2" sx={{ mb: 0.6, fontWeight: 500 }}>
                          Style
                        </Typography>
                        <Box
                          sx={{
                            mb: 1.2,
                            p: 0.5,
                            bgcolor: '#d0d0d0',
                            borderRadius: 1,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 0.5,
                          }}
                        >
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ bold: !(selectedComponent?.settings?.bold === true) })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.bold ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.bold ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatBold fontSize="small" />
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ italic: !(selectedComponent?.settings?.italic === true) })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.italic ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.italic ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatItalic fontSize="small" />
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ underline: !(selectedComponent?.settings?.underline === true) })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.underline ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.underline ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatUnderlined fontSize="small" />
                          </Button>
                        </Box>
                      </>
                    )}
                    {selectedComponent.type === 'sale-table' && (
                      <>
                        {renderColorField(
                          'Text Colour',
                          selectedComponent?.settings?.textColor || '#ffffff',
                          (nextColor) => updateSelectedSettings({ textColor: nextColor })
                        )}
                        {renderColorField(
                          'Promotion Colour',
                          selectedComponent?.settings?.promotionColor || '#00ff3b',
                          (nextColor) => updateSelectedSettings({ promotionColor: nextColor })
                        )}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography>Show Grid</Typography>
                          <Switch checked={selectedComponent?.settings?.showGrid !== false} onChange={(e) => updateSelectedSettings({ showGrid: e.target.checked })} />
                        </Box>
                        {renderColorField(
                          'Grid Lines Colour',
                          selectedComponent?.settings?.gridLineColor || '#000000',
                          (nextColor) => updateSelectedSettings({ gridLineColor: nextColor })
                        )}
                        {renderColorField(
                          'Footer Text Colour',
                          selectedComponent?.settings?.footerTextColor || '#ffffff',
                          (nextColor) => updateSelectedSettings({ footerTextColor: nextColor })
                        )}
                        {renderColorField(
                          'Footer Background',
                          selectedComponent?.settings?.footerBackgroundColor || '#000000',
                          (nextColor) => updateSelectedSettings({ footerBackgroundColor: nextColor })
                        )}
                        {/* Reference: "Header" list (reorder arrows + name + on/off), then a
                            separate "Column Alignment" block with one select per column.
                            A template saved without headers edits the renderer's defaults. */}
                        {(() => {
                          const headers = selectedComponent?.settings?.headers?.length
                            ? selectedComponent.settings.headers
                            : DEFAULT_SALE_TABLE_HEADERS;
                          const setHeaders = (next) => updateSelectedSettings({ headers: next });
                          const patchHeader = (idx, patch) => setHeaders(headers.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
                          return (
                            <>
                              <Typography variant="body2" sx={{ mb: 0.6, fontWeight: 500 }}>
                                Header
                              </Typography>
                              {headers.map((header, idx) => (
                                <Box key={header.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <IconButton size="small" aria-label="Move header up" disabled={idx === 0} onClick={() => setHeaders(moveItem(headers, idx, idx - 1))} sx={{ p: 0.25 }}>
                                      <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                    <IconButton size="small" aria-label="Move header down" disabled={idx === headers.length - 1} onClick={() => setHeaders(moveItem(headers, idx, idx + 1))} sx={{ p: 0.25 }}>
                                      <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                  </Box>
                                  <TextField
                                    fullWidth
                                    size="small"
                                    value={header.label}
                                    disabled={header.visible === false}
                                    onChange={(e) => patchHeader(idx, { label: e.target.value })}
                                  />
                                  <Switch checked={header.visible !== false} onChange={(e) => patchHeader(idx, { visible: e.target.checked })} />
                                </Box>
                              ))}
                              <Typography variant="body2" sx={{ mt: 1, mb: 0.6, fontWeight: 500 }}>
                                Column Alignment
                              </Typography>
                              {headers.map((header, idx) => (
                                <Box key={`align-${header.key}`} sx={{ mb: 1 }}>
                                  <Typography variant="body2" sx={{ mb: 0.4 }}>{header.label}</Typography>
                                  <FormControl size="small" fullWidth>
                                    <Select
                                      MenuProps={REF_MENU_PROPS}
                                      value={header.align || 'Default'}
                                      onChange={(e) => patchHeader(idx, { align: e.target.value })}
                                    >
                                      <MenuItem value="Default">Default</MenuItem>
                                      <MenuItem value="Left">Left</MenuItem>
                                      <MenuItem value="Center">Centre</MenuItem>
                                      <MenuItem value="Right">Right</MenuItem>
                                    </Select>
                                  </FormControl>
                                </Box>
                              ))}
                            </>
                          );
                        })()}
                      </>
                    )}
                    {selectedComponent.type === 'totals' && (
                      <>
                        {renderColorField(
                          'Text Colour',
                          selectedComponent?.settings?.textColor || '#ffffff',
                          (nextColor) => updateSelectedSettings({ textColor: nextColor })
                        )}
                        {renderColorField(
                          'Promotion Text Colour',
                          selectedComponent?.settings?.promotionColor || '#00ff3b',
                          (nextColor) => updateSelectedSettings({ promotionColor: nextColor })
                        )}
                        <TextField fullWidth label="Text Size" type="number" value={selectedComponent?.settings?.fontSize || 24} onChange={(e) => updateSelectedSettings({ fontSize: Number(e.target.value) })} sx={{ mb: 1 }} />
                        <Typography variant="body2" sx={{ mb: 0.6, fontWeight: 500 }}>
                          Style
                        </Typography>
                        <Box
                          sx={{
                            mb: 1.2,
                            p: 0.5,
                            bgcolor: '#d0d0d0',
                            borderRadius: 1,
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 0.5,
                          }}
                        >
                          {/* Totals are bold unless switched off (reference default) */}
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ bold: selectedComponent?.settings?.bold === false })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.bold !== false ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.bold !== false ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatBold fontSize="small" />
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ italic: !(selectedComponent?.settings?.italic === true) })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.italic ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.italic ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatItalic fontSize="small" />
                          </Button>
                          <Button
                            size="small"
                            onClick={() => updateSelectedSettings({ underline: !(selectedComponent?.settings?.underline === true) })}
                            sx={{
                              minWidth: 0,
                              color: selectedComponent?.settings?.underline ? '#1976d2' : '#4f4f4f',
                              bgcolor: selectedComponent?.settings?.underline ? '#ffffff' : 'transparent',
                            }}
                          >
                            <FormatUnderlined fontSize="small" />
                          </Button>
                        </Box>
                        <Typography variant="body2" sx={{ mb: 0.6, fontWeight: 500 }}>
                          Labels
                        </Typography>
                        {/* Reference rows (Total … Paid) are edited even when the template has
                            none saved yet; a switched-off row's name is greyed. */}
                        {(() => {
                          const labels = selectedComponent?.settings?.labels?.length
                            ? selectedComponent.settings.labels
                            : DEFAULT_TOTALS_LABELS;
                          const setLabels = (next) => updateSelectedSettings({ labels: next });
                          const patchLabel = (idx, patch) => setLabels(labels.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
                          return labels.map((labelRow, idx) => (
                            <Box key={labelRow.key} sx={{ display: 'flex', gap: 0.5, mb: 1, alignItems: 'center' }}>
                              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                <IconButton size="small" aria-label="Move label up" disabled={idx === 0} onClick={() => setLabels(moveItem(labels, idx, idx - 1))} sx={{ p: 0.25 }}>
                                  <ArrowUpwardIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                                <IconButton size="small" aria-label="Move label down" disabled={idx === labels.length - 1} onClick={() => setLabels(moveItem(labels, idx, idx + 1))} sx={{ p: 0.25 }}>
                                  <ArrowDownwardIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Box>
                              <TextField
                                fullWidth
                                size="small"
                                value={labelRow.label}
                                disabled={labelRow.visible === false}
                                onChange={(e) => patchLabel(idx, { label: e.target.value })}
                              />
                              <Switch checked={labelRow.visible !== false} onChange={(e) => patchLabel(idx, { visible: e.target.checked })} />
                            </Box>
                          ));
                        })()}
                      </>
                    )}
                    {(selectedComponent.type === 'image' || selectedComponent.type === 'slideshow') && (
                      <>
                        {selectedComponent.type === 'image' && (
                          <>
                            <Button fullWidth variant="outlined" sx={{ mb: 1 }} onClick={() => setMediaDialogOpen(true)}>
                              Select to Add Image
                            </Button>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Constrain image width</Typography>
                              <Switch checked={selectedComponent?.settings?.containWidth !== false} onChange={(e) => updateSelectedSettings({ containWidth: e.target.checked })} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Constrain image height</Typography>
                              <Switch checked={selectedComponent?.settings?.containHeight !== false} onChange={(e) => updateSelectedSettings({ containHeight: e.target.checked })} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Stretch image to fill</Typography>
                              <Switch checked={selectedComponent?.settings?.stretchToFill === true} onChange={(e) => updateSelectedSettings({ stretchToFill: e.target.checked })} />
                            </Box>
                          </>
                        )}
                        {selectedComponent.type === 'slideshow' && (
                          <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Stretch media to fill</Typography>
                              {/* Fill and cover are rival object-fit modes: turning one on turns the other off */}
                              <Switch checked={selectedComponent?.settings?.stretchToFill === true} onChange={(e) => updateSelectedSettings({ stretchToFill: e.target.checked, ...(e.target.checked ? { stretchToCover: false } : {}) })} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Stretch media to cover</Typography>
                              <Switch checked={selectedComponent?.settings?.stretchToCover === true} onChange={(e) => updateSelectedSettings({ stretchToCover: e.target.checked, ...(e.target.checked ? { stretchToFill: false } : {}) })} />
                            </Box>
                            <Typography variant="body2" sx={{ mb: 0.6, fontWeight: 500 }}>
                              Slides
                            </Typography>
                            <Button
                              fullWidth
                              disableElevation
                              variant="contained"
                              onClick={() => {
                                setSlideDraft((selectedComponent?.settings?.slides || []).map((slide) => ({ ...slide })));
                                setSelectedSlideIndex(-1);
                                setSlideDialogOpen(true);
                              }}
                              sx={{ mb: 1, bgcolor: 'rgb(50,182,67)', textTransform: 'none', borderRadius: 0, '&:hover': { bgcolor: 'rgb(34,122,45)' } }}
                            >
                              Edit Slideshow
                            </Button>
                            <List dense disablePadding>
                              {(selectedComponent?.settings?.slides || []).map((slide, index) => (
                                <ListItemButton key={`${slide.url}-${index}`} disableRipple sx={{ gap: 1, px: 0.5 }}>
                                  <SlideThumb url={slide.url} size={40} />
                                  <ListItemText
                                    primary={slideName(slide, index)}
                                    secondary={`${Number(slide.seconds || 3.5)} seconds`}
                                    primaryTypographyProps={{ noWrap: true, fontSize: 14 }}
                                  />
                                </ListItemButton>
                              ))}
                            </List>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </Box>
            )}
            <Box sx={{ mt: 'auto', p: 0.75, borderTop: '1px solid #d0d0d0', display: 'grid', gap: 0.75 }}>
              {/* Reference: blue Save with a save icon, grey outlined Cancel with an X */}
              <Button
                fullWidth
                variant="contained"
                disableElevation
                disabled={saving}
                onClick={() => saveTemplate()}
                startIcon={<SaveOutlinedIcon sx={{ fontSize: 18 }} />}
                sx={{ height: 36, borderRadius: '4px', textTransform: 'none', fontSize: 16, bgcolor: '#1c86f2', '&:hover': { bgcolor: '#1a73d6' } }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                fullWidth
                onClick={handleCancel}
                startIcon={<CloseIcon sx={{ fontSize: 18 }} />}
                sx={{ height: 36, borderRadius: '4px', textTransform: 'none', fontSize: 16, color: '#676b72', bgcolor: '#f8f8f8', border: '1px solid #d0d0d0', '&:hover': { bgcolor: '#ebebeb' } }}
              >
                Cancel
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        // Reference: wide grey list hanging below the "+" button, right edges
        // aligned, large rows with icons, nothing pre-highlighted.
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        transitionDuration={0}
        autoFocus={false}
        PaperProps={{
          sx: {
            mt: '2px',
            width: 400,
            borderRadius: 0,
            border: '1px solid #000',
            boxShadow: 'none',
            bgcolor: '#f8f8f8',
          },
        }}
      >
        {componentTypes.map((type) => (
          <MenuItem
            key={type.id}
            onClick={() => addComponent(type.id)}
            sx={{
              height: 61,
              px: 2,
              gap: 1.2,
              fontSize: 24,
              color: 'rgb(49,52,57)',
              '& .MuiSvgIcon-root': { fontSize: 28, color: 'inherit' },
              '&:hover': { bgcolor: 'rgb(28,134,242)', color: '#f8f8f8' },
            }}
          >
            <type.icon />
            <Typography sx={{ fontSize: 24, lineHeight: 1.05, color: 'inherit' }}>{type.label}</Typography>
          </MenuItem>
        ))}
      </Menu>

      <MediaDialog
        open={mediaDialogOpen}
        onClose={() => setMediaDialogOpen(false)}
        accept="image/*,video/*"
        onSelect={(url) => {
          updateSelected((item) => ({ ...item, settings: { ...item.settings, src: url } }));
          setMediaDialogOpen(false);
        }}
      />

      <MediaDialog
        open={slideMediaDialogOpen}
        onClose={() => setSlideMediaDialogOpen(false)}
        accept="image/*,video/*"
        multiple
        onSelect={(urls) => {
          // Reference "Add New Slide": each picked media becomes a new slide
          // (5 seconds by default); the last one is selected for editing.
          const picked = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
          if (!picked.length) return;
          setSlideDraft((prev) => {
            const slides = [...prev, ...picked.map((url) => ({ url, seconds: 5, startAt: '', endAt: '' }))];
            setSelectedSlideIndex(slides.length - 1);
            return slides;
          });
          setSlideMediaDialogOpen(false);
        }}
      />

      {/* Edit Slideshow (reference): pencil badge, Add New Slide, reorder arrows +
          thumbnail + name + seconds, slide editor (Seconds / Start At / End At),
          Cancel / Confirm. Works on a draft; only Confirm writes to the component. */}
      <Dialog
        open={slideDialogOpen}
        onClose={() => setSlideDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 0, overflow: 'visible', boxShadow: '0 0 30px rgba(0,0,0,.25), 0 15px 30px rgba(0,0,0,.19)' } }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -34,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 68,
            height: 68,
            borderRadius: '50%',
            bgcolor: '#1c86f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <EditIcon sx={{ color: '#fff', fontSize: 36 }} />
        </Box>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, fontSize: 20, pt: 5, pb: 1 }}>Edit Slideshow</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, minHeight: 360 }}>
            <Box sx={{ width: 320, borderRight: '1px solid #ddd', pr: 1 }}>
              <Button
                fullWidth
                disableElevation
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mb: 1, bgcolor: 'rgb(50,182,67)', textTransform: 'none', borderRadius: 0, '&:hover': { bgcolor: 'rgb(34,122,45)' } }}
                onClick={() => setSlideMediaDialogOpen(true)}
              >
                Add New Slide
              </Button>
              <List dense sx={{ mt: 1, maxHeight: 320, overflow: 'auto' }}>
                {slideDraft.length === 0 && (
                  <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 2 }}>
                    No slides yet. Use Add New Slide.
                  </Typography>
                )}
                {slideDraft.map((slide, index) => (
                  <ListItemButton
                    key={`${slide.url}-${index}`}
                    selected={selectedSlideIndex === index}
                    onClick={() => setSelectedSlideIndex(index)}
                    sx={{ gap: 1, px: 0.5 }}
                  >
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <IconButton
                        size="small"
                        aria-label="Move slide up"
                        disabled={index === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideDraft((prev) => moveItem(prev, index, index - 1));
                          setSelectedSlideIndex((cur) => (cur === index ? index - 1 : cur === index - 1 ? index : cur));
                        }}
                      >
                        <ArrowUpwardIcon fontSize="inherit" />
                      </IconButton>
                      <IconButton
                        size="small"
                        aria-label="Move slide down"
                        disabled={index === slideDraft.length - 1}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSlideDraft((prev) => moveItem(prev, index, index + 1));
                          setSelectedSlideIndex((cur) => (cur === index ? index + 1 : cur === index + 1 ? index : cur));
                        }}
                      >
                        <ArrowDownwardIcon fontSize="inherit" />
                      </IconButton>
                    </Box>
                    <SlideThumb url={slide.url} />
                    <ListItemText
                      primary={slideName(slide, index)}
                      secondary={`${Number(slide.seconds || 5)} seconds`}
                      primaryTypographyProps={{ noWrap: true }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
            <Box sx={{ flex: 1 }}>
              {selectedSlideIndex < 0 || !slideDraft[selectedSlideIndex] ? (
                <Typography sx={{ mt: 12, textAlign: 'center', color: 'text.secondary' }}>Select a slide to edit</Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <SlideThumb url={slideDraft[selectedSlideIndex].url} size={96} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography noWrap sx={{ fontWeight: 600 }}>{slideName(slideDraft[selectedSlideIndex], selectedSlideIndex)}</Typography>
                      <Button
                        size="small"
                        color="error"
                        sx={{ textTransform: 'none', px: 0 }}
                        onClick={() => {
                          setSlideDraft((prev) => prev.filter((_, i) => i !== selectedSlideIndex));
                          setSelectedSlideIndex(-1);
                        }}
                      >
                        Remove Slide
                      </Button>
                    </Box>
                  </Box>
                  <TextField
                    fullWidth
                    label="Seconds"
                    type="number"
                    inputProps={{ min: 1, step: 0.5 }}
                    value={slideDraft[selectedSlideIndex].seconds ?? 5}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSlideDraft((prev) => prev.map((s, i) => (i === selectedSlideIndex ? { ...s, seconds: value } : s)));
                    }}
                    sx={{ mb: 1.5 }}
                  />
                  {/* Same calendar as the rest of the app (Promotions): MUI date-time
                      picker with Clear / Current Day / OK. Stored as "yyyy-MM-ddTHH:mm"
                      local time, the format the renderer already reads. */}
                  <LocalizationProvider dateAdapter={AdapterDateFns}>
                    {[
                      { key: 'startAt', label: 'Start At', help: 'Leave blank to show the slide straight away' },
                      { key: 'endAt', label: 'End At', help: 'Leave blank to keep showing the slide until it is removed' },
                    ].map(({ key, label, help }) => (
                      <DateTimePicker
                        key={key}
                        label={label}
                        value={slideDateToDate(slideDraft[selectedSlideIndex][key])}
                        onChange={(value) => {
                          const next = dateToSlideDate(value);
                          setSlideDraft((prev) => prev.map((s, i) => (i === selectedSlideIndex ? { ...s, [key]: next } : s)));
                        }}
                        format="dd/MM/yyyy HH:mm"
                        ampm={false}
                        localeText={{ todayButtonLabel: 'Current Day' }}
                        slotProps={{
                          textField: { fullWidth: true, helperText: help, sx: { mb: 1.5 } },
                          actionBar: { actions: ['clear', 'today', 'accept'] },
                          desktopPaper: { sx: PICKER_POPOVER_SX },
                          mobilePaper: { sx: PICKER_POPOVER_SX },
                        }}
                      />
                    ))}
                  </LocalizationProvider>
                </>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.5 }}>
          <Button
            onClick={() => setSlideDialogOpen(false)}
            sx={{ flex: 1, height: 48, borderRadius: 0, textTransform: 'none', fontSize: 16, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid currentColor', '&:hover': { bgcolor: '#676b72', color: '#f8f8f8' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (!selectedComponent) return;
              // Seconds must be a positive number; blank dates mean "forever".
              const slides = slideDraft.map((s) => ({
                ...s,
                seconds: Math.max(1, Number(s.seconds) || 5),
                startAt: s.startAt || '',
                endAt: s.endAt || '',
              }));
              updateSelectedSettings({ slides });
              setSlideDialogOpen(false);
            }}
            sx={{ flex: 1, height: 48, borderRadius: 0, textTransform: 'none', fontSize: 16, bgcolor: 'rgb(50,182,67)', color: '#f8f8f8', border: '1px solid rgb(50,182,67)', '&:hover': { bgcolor: '#f8f8f8', color: 'rgb(50,182,67)' } }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={confirmDeleteOpen}
        title="Delete"
        message={
          selectedComponent
            ? 'Are you sure you want to delete this component?'
            : `Are you sure you want to delete "${template?.name || 'Customer Display'}"?`
        }
        onCancel={() => setConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />

      <Dialog
        open={nameDialogOpen}
        onClose={handleTemplateDialogCancel}
        // Translucent backdrop so the canvas stays visible behind the dialog (ref)
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.45)' } } }}
        PaperProps={{
          sx: {
            width: 360,
            maxWidth: '92vw',
            borderRadius: 0,
            overflow: 'visible',
            boxShadow: '0 0 30px rgba(0,0,0,.25), 0 15px 30px rgba(0,0,0,.19)',
          },
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: -34,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 68,
            height: 68,
            borderRadius: '50%',
            bgcolor: '#1c86f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <InfoOutlinedIcon sx={{ color: '#fff', fontSize: 42 }} />
        </Box>
        <DialogTitle sx={{ textAlign: 'center', fontWeight: 700, fontSize: 20, pt: 5, pb: 1 }}>
          Configure Customer Display
        </DialogTitle>
        <DialogContent sx={{ px: 2.5 }}>
          {configError && (
            <Typography sx={{ color: '#e3342f', fontSize: 14, textAlign: 'center', mb: 1 }}>{configError}</Typography>
          )}
          <Typography sx={{ textAlign: 'center', mb: 0.5 }}>Name</Typography>
          <TextField
            fullWidth
            autoFocus
            value={configDraft.name}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setConfigDraft((prev) => ({ ...prev, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleTemplateDialogPrimaryAction(); } }}
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': { borderRadius: 0, height: 53 },
              '& fieldset, &:hover fieldset, & .Mui-focused fieldset': { border: '1px solid #000' },
            }}
          />
          {renderColorField(
            'Default text colour',
            configDraft.defaultTextColor,
            (nextColor) => setConfigDraft((prev) => ({ ...prev, defaultTextColor: nextColor })),
            { textAlign: 'center' }
          )}
          {renderColorField(
            'Default background colour',
            configDraft.defaultBackgroundColor,
            (nextColor) => setConfigDraft((prev) => ({ ...prev, defaultBackgroundColor: nextColor })),
            { mb: 0, textAlign: 'center' }
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2.5, pt: 1 }}>
          <Button
            onClick={handleTemplateDialogCancel}
            sx={{
              width: 121,
              height: 48,
              borderRadius: 0,
              textTransform: 'none',
              fontSize: 16,
              bgcolor: '#f8f8f8',
              color: '#676b72',
              border: '1px solid currentColor',
              transition: 'background 0.2s, color 0.2s',
              '&:hover': { bgcolor: '#676b72', color: '#f8f8f8' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTemplateDialogPrimaryAction}
            disabled={saving}
            sx={{
              width: 121,
              height: 48,
              borderRadius: 0,
              textTransform: 'none',
              fontSize: 16,
              bgcolor: '#1c86f2',
              color: '#f8f8f8',
              border: '1px solid #1c86f2',
              transition: 'background 0.2s, color 0.2s',
              '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2' },
            }}
          >
            {templateId === 'new' ? 'Create' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>

      <Popover
        open={Boolean(colorPickerState.anchorEl)}
        anchorEl={colorPickerState.anchorEl}
        onClose={closeColorPicker}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        <Box sx={{ p: 1 }}>
          <ChromePicker
            color={colorPickerState.color}
            onChange={(next) => {
              const nextHex = next?.hex || '#000000';
              setColorPickerState((prev) => {
                if (typeof prev.onChange === 'function') {
                  prev.onChange(nextHex);
                }
                return { ...prev, color: nextHex };
              });
            }}
            disableAlpha
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
            <Button size="small" variant="contained" onClick={closeColorPicker}>Done</Button>
          </Box>
        </Box>
      </Popover>
    </Box>
  );
};

export default CustomerDisplayEditor;
