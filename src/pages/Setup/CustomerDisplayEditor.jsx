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
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  AttachMoney as AttachMoneyIcon,
  Delete as DeleteIcon,
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
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import CustomerDisplayRenderer from '../../components/CustomerDisplay/CustomerDisplayRenderer';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import { createDefaultCustomerDisplayTemplate } from '../../utils/customerDisplayDefaults';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

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

const CustomerDisplayEditor = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const gridSize = { rows: 10, cols: 10 };
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(createDefaultCustomerDisplayTemplate());
  const [mode, setMode] = useState('idle');
  const [selectedId, setSelectedId] = useState('');
  const [componentTab, setComponentTab] = useState(0);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [slideDialogOpen, setSlideDialogOpen] = useState(false);
  const [slideMediaDialogOpen, setSlideMediaDialogOpen] = useState(false);
  const [newSlide, setNewSlide] = useState({ url: '', seconds: 3.5, startAt: '', endAt: '' });
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(-1);
  const [nameDialogOpen, setNameDialogOpen] = useState(false);
  const [colorPickerState, setColorPickerState] = useState({
    anchorEl: null,
    color: '#000000',
    onChange: null,
  });

  useEffect(() => {
    const load = async () => {
      if (!templateId || templateId === 'new') {
        const created = createDefaultCustomerDisplayTemplate();
        setTemplate(created);
        setSelectedId('');
        setNameDialogOpen(true);
        return;
      }
      setNameDialogOpen(false);
      const all = await customerDisplayTemplateService.listTemplates();
      const existing = all.find((item) => String(item.id) === String(templateId));
      if (existing) {
        setTemplate(existing);
        setSelectedId('');
      } else {
        navigate('/setup/customer-display', { replace: true });
      }
    };
    load();
  }, [templateId, navigate]);

  const activeComponents = useMemo(() => template?.[mode]?.components || [], [template, mode]);
  const selectedComponent = activeComponents.find((item) => item.id === selectedId);

  const saveTemplate = async () => {
    try {
      const { savedId } = await customerDisplayTemplateService.upsertTemplate(template);
      const replaceHistory = templateId === 'new';
      if (replaceHistory && savedId != null && savedId !== '') {
        navigate(`/setup/customer-display/${savedId}/edit`, { replace: true });
      } else {
        navigate('/setup/customer-display', { replace: replaceHistory });
      }
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.error || err?.message || 'Failed to save customer display template');
    }
  };

  const handleTemplateDialogPrimaryAction = async () => {
    // For new templates, this dialog is the first action users take.
    // Save immediately so the create API is called from here as well.
    if (templateId === 'new') {
      await saveTemplate();
      return;
    }
    setNameDialogOpen(false);
  };

  const updateSelected = (updater) => {
    if (!selectedComponent) return;
    setTemplate((prev) => {
      const updated = { ...prev };
      updated[mode].components = updated[mode].components.map((component) =>
        component.id === selectedId ? updater(component) : component
      );
      return updated;
    });
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
    const raw = (value || '#000000').trim();
    const hex = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(raw) ? raw : '#000000';
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
            border: '5px solid #1a1a1a',
            borderRadius: 0.5,
            cursor: 'pointer',
            boxSizing: 'border-box',
            '&:focus-visible': { outline: '2px solid #1976d2', outlineOffset: 2 },
          }}
        />
      </Box>
    );
  };

  const updateSelectedById = (componentId, updates) => {
    setTemplate((prev) => {
      const next = { ...prev };
      next[mode].components = next[mode].components.map((component) =>
        component.id === componentId ? { ...component, ...updates } : component
      );
      return next;
    });
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
      const next = { ...prev };
      const list = [...next[mode].components];
      const newItem = createComponent(type, list.length, mode);
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
      next[mode].components = list;
      return next;
    });
    setMenuAnchor(null);
  };

  const moveLayer = (direction) => {
    if (!selectedComponent) return;
    setTemplate((prev) => {
      const next = { ...prev };
      const list = [...next[mode].components];
      const sorted = [...list].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      const index = sorted.findIndex((item) => item.id === selectedId);
      if (index === -1) return prev;
      const swapWith = direction === 'up' ? index + 1 : index - 1;
      if (swapWith < 0 || swapWith >= sorted.length) return prev;
      const current = sorted[index];
      const target = sorted[swapWith];
      const temp = current.zIndex || 0;
      current.zIndex = target.zIndex || 0;
      target.zIndex = temp;
      next[mode].components = list.map((item) => {
        if (item.id === current.id) return { ...item, zIndex: current.zIndex };
        if (item.id === target.id) return { ...item, zIndex: target.zIndex };
        return item;
      });
      return next;
    });
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setTemplate((prev) => {
      const next = { ...prev };
      next[mode].components = next[mode].components.filter((item) => item.id !== selectedId);
      return next;
    });
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
      navigate('/setup/customer-display');
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
                onClick={() => setNameDialogOpen(true)}
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
                <KeyboardArrowDownIcon sx={{ fontSize: 16 }} />
              </Button>
            </Box>
          </Paper>
          <Paper sx={{ height: 'calc(100% - 66px)', borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: template?.defaultBackgroundColor || '#000' }}>
            <CustomerDisplayRenderer
              template={template}
              mode={mode}
              data={{ cartItems: [], totals: { total: 0, savings: 0, itemCount: 0 } }}
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
                    <Button fullWidth sx={{ mb: 1 }} onClick={() => moveLayer('up')}>Bring Forwards</Button>
                    <Button fullWidth sx={{ mb: 2 }} onClick={() => moveLayer('down')}>Send Backwards</Button>
                    <TextField fullWidth label="Width (%)" type="number" value={selectedComponent.w} onChange={(e) => updateSelected((item) => ({ ...item, w: Number(e.target.value) }))} sx={{ mb: 1 }} />
                    <TextField fullWidth label="Height (%)" type="number" value={selectedComponent.h} onChange={(e) => updateSelected((item) => ({ ...item, h: Number(e.target.value) }))} sx={{ mb: 1 }} />
                    {renderColorField(
                      'Background Colour',
                      selectedComponent?.settings?.backgroundColor || '#000000',
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
                        {(selectedComponent?.settings?.headers || []).map((header, idx) => (
                          <Box key={header.key} sx={{ mb: 1 }}>
                            <TextField
                              fullWidth
                              label={`Header ${idx + 1}`}
                              value={header.label}
                              onChange={(e) =>
                                updateSelectedSettings({
                                  headers: (selectedComponent?.settings?.headers || []).map((item, i) =>
                                    i === idx ? { ...item, label: e.target.value } : item
                                  ),
                                })
                              }
                              sx={{ mb: 0.5 }}
                            />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                              <FormControl size="small" sx={{ minWidth: 120 }}>
                                <InputLabel>Alignment</InputLabel>
                                <Select
                                  label="Alignment"
                                  value={header.align || 'Default'}
                                  onChange={(e) =>
                                    updateSelectedSettings({
                                      headers: (selectedComponent?.settings?.headers || []).map((item, i) =>
                                        i === idx ? { ...item, align: e.target.value } : item
                                      ),
                                    })
                                  }
                                >
                                  <MenuItem value="Default">Default</MenuItem>
                                  <MenuItem value="Left">Left</MenuItem>
                                  <MenuItem value="Center">Center</MenuItem>
                                  <MenuItem value="Right">Right</MenuItem>
                                </Select>
                              </FormControl>
                              <Switch
                                checked={header.visible !== false}
                                onChange={(e) =>
                                  updateSelectedSettings({
                                    headers: (selectedComponent?.settings?.headers || []).map((item, i) =>
                                      i === idx ? { ...item, visible: e.target.checked } : item
                                    ),
                                  })
                                }
                              />
                            </Box>
                          </Box>
                        ))}
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
                        <TextField fullWidth label="Text Size" type="number" value={selectedComponent?.settings?.fontSize || 45} onChange={(e) => updateSelectedSettings({ fontSize: Number(e.target.value) })} sx={{ mb: 1 }} />
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
                        {(selectedComponent?.settings?.labels || []).map((labelRow, idx) => (
                          <Box key={labelRow.key} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                            <TextField
                              fullWidth
                              value={labelRow.label}
                              onChange={(e) =>
                                updateSelectedSettings({
                                  labels: (selectedComponent?.settings?.labels || []).map((item, i) =>
                                    i === idx ? { ...item, label: e.target.value } : item
                                  ),
                                })
                              }
                            />
                            <Switch
                              checked={labelRow.visible !== false}
                              onChange={(e) =>
                                updateSelectedSettings({
                                  labels: (selectedComponent?.settings?.labels || []).map((item, i) =>
                                    i === idx ? { ...item, visible: e.target.checked } : item
                                  ),
                                })
                              }
                            />
                          </Box>
                        ))}
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
                              <Switch checked={selectedComponent?.settings?.stretchToFill === true} onChange={(e) => updateSelectedSettings({ stretchToFill: e.target.checked })} />
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography>Stretch media to cover</Typography>
                              <Switch checked={selectedComponent?.settings?.stretchToCover === true} onChange={(e) => updateSelectedSettings({ stretchToCover: e.target.checked })} />
                            </Box>
                            <Button fullWidth variant="outlined" onClick={() => setSlideDialogOpen(true)}>
                              Edit Slideshow
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </>
                )}
              </Box>
            )}
            <Box sx={{ mt: 'auto', p: 0.75, borderTop: '1px solid #d0d0d0', display: 'grid', gap: 0.75 }}>
              <Button fullWidth variant="contained" onClick={saveTemplate}>Save</Button>
              <Button fullWidth onClick={() => navigate('/setup/customer-display')}>Cancel</Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        transitionDuration={0}
        PaperProps={{
          sx: {
            mt: 0.6,
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
        onSelect={(url) => {
          if (selectedSlideIndex < 0) {
            const slide = { url, seconds: 3.5, startAt: '', endAt: '' };
            const slides = [...(selectedComponent?.settings?.slides || []), slide];
            updateSelectedSettings({ slides });
            setSelectedSlideIndex(slides.length - 1);
            setNewSlide(slide);
          } else {
            setNewSlide((prev) => ({ ...prev, url }));
          }
          setSlideMediaDialogOpen(false);
        }}
      />

      <Dialog open={slideDialogOpen} onClose={() => setSlideDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Slideshow</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 2, minHeight: 360 }}>
            <Box sx={{ width: 260, borderRight: '1px solid #ddd', pr: 1 }}>
              <Button variant="contained" color="success" fullWidth sx={{ mb: 1 }} onClick={() => setSlideMediaDialogOpen(true)}>
                Add New Slide
              </Button>
              <Button
                variant="contained"
                color="error"
                fullWidth
                disabled={selectedSlideIndex < 0}
                onClick={() => {
                  if (selectedSlideIndex < 0) return;
                  updateSelectedSettings({
                    slides: (selectedComponent?.settings?.slides || []).filter((_, index) => index !== selectedSlideIndex),
                  });
                  setSelectedSlideIndex(-1);
                }}
              >
                Remove Slide
              </Button>
              <List dense sx={{ mt: 1, maxHeight: 280, overflow: 'auto' }}>
                {(selectedComponent?.settings?.slides || []).map((slide, index) => (
                  <ListItemButton key={`${slide.url}-${index}`} selected={selectedSlideIndex === index} onClick={() => {
                    setSelectedSlideIndex(index);
                    setNewSlide(slide);
                  }}>
                    <ListItemText primary={slide.url?.split('/').pop() || `Slide ${index + 1}`} secondary={`${Number(slide.seconds || 3.5).toFixed(2)} seconds`} />
                  </ListItemButton>
                ))}
              </List>
            </Box>
            <Box sx={{ flex: 1 }}>
              {selectedSlideIndex < 0 ? (
                <Typography sx={{ mt: 12, textAlign: 'center', color: 'text.secondary' }}>Select a slide to edit</Typography>
              ) : (
                <>
                  <Button variant="outlined" onClick={() => setSlideMediaDialogOpen(true)} sx={{ mb: 1 }}>
                    Replace Media
                  </Button>
                  <TextField fullWidth label="Selected Media URL" value={newSlide.url} sx={{ mt: 1, mb: 1 }} InputProps={{ readOnly: true }} />
                  <TextField fullWidth label="Seconds" type="number" value={newSlide.seconds} onChange={(e) => setNewSlide((prev) => ({ ...prev, seconds: e.target.value }))} sx={{ mb: 1 }} />
                  <TextField fullWidth label="Start At" type="datetime-local" InputLabelProps={{ shrink: true }} value={newSlide.startAt || ''} onChange={(e) => setNewSlide((prev) => ({ ...prev, startAt: e.target.value }))} sx={{ mb: 1 }} />
                  <TextField fullWidth label="End At" type="datetime-local" InputLabelProps={{ shrink: true }} value={newSlide.endAt || ''} onChange={(e) => setNewSlide((prev) => ({ ...prev, endAt: e.target.value }))} />
                </>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSlideDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedComponent || selectedSlideIndex < 0) return;
              updateSelectedSettings({
                slides: (selectedComponent?.settings?.slides || []).map((slide, index) =>
                  index === selectedSlideIndex ? newSlide : slide
                ),
              });
            }}
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
        onClose={() => setNameDialogOpen(false)}
        PaperProps={{
          sx: {
            width: 291,
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
          <Typography sx={{ textAlign: 'center', mb: 0.5 }}>Name</Typography>
          <TextField
            fullWidth
            value={template.name}
            onChange={(e) => setTemplate((prev) => ({ ...prev, name: e.target.value }))}
            sx={{
              mb: 1.5,
              '& .MuiOutlinedInput-root': { borderRadius: 0, height: 53 },
              '& fieldset, &:hover fieldset, & .Mui-focused fieldset': { border: '1px solid #000' },
            }}
          />
          {renderColorField(
            'Default text colour',
            template.defaultTextColor,
            (nextColor) => setTemplate((prev) => ({ ...prev, defaultTextColor: nextColor })),
            { textAlign: 'center' }
          )}
          {renderColorField(
            'Default background colour',
            template.defaultBackgroundColor,
            (nextColor) => setTemplate((prev) => ({ ...prev, defaultBackgroundColor: nextColor })),
            { mb: 0, textAlign: 'center' }
          )}
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'center', gap: 1, pb: 2.5, pt: 1 }}>
          <Button
            onClick={() => setNameDialogOpen(false)}
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
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
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
