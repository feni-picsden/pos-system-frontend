import React, { useState, useEffect, useRef, useCallback } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box, Typography, Button, IconButton, TextField, Select, MenuItem,
  FormControl, InputLabel, Divider, Paper, Tooltip, Snackbar, Alert,
  ToggleButton, ToggleButtonGroup, Popover, Slider, Switch,
  FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Stack,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  ZoomOutMap as ZoomFitIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  TextFields as TextIcon,
  AttachMoney as PriceIcon,
  QrCode as BarcodeIcon,
  Image as ImageIcon,
  CropSquare as ShapeIcon,
  HorizontalRule as LineIcon,
  FormatBold as BoldIcon,
  FormatItalic as ItalicIcon,
  FormatUnderlined as UnderlineIcon,
  FormatAlignLeft as AlignLeftIcon,
  FormatAlignCenter as AlignCenterIcon,
  FormatAlignRight as AlignRightIcon,
  Lock as LockIcon,
  LockOpen as LockOpenIcon,
  ContentCopy as CopyIcon,
  Print as PrintIcon,
  Preview as PreviewIcon,
  GridOn as GridIcon,
  ArrowUpward as BringForwardIcon,
  ArrowDownward as SendBackwardIcon,
  PermMedia as PermMediaIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import shelfTicketTemplateService from '../../services/shelfTicketTemplateService';
import { handlePrintPreview, renderPrintElement } from '../../utils/shelfTicketPrint.jsx';
import MediaDialog from '../../components/Common/MediaDialog';

// ------- Constants -------

const MM_TO_PX = 3.7795275591; // 96 DPI

const ELEMENT_TYPES = {
  TEXT: 'text',
  PRICE: 'price',
  BARCODE: 'barcode',
  IMAGE: 'image',
  SHAPE: 'shape',
  LINE: 'line',
};

const FIELD_VARIABLES = [
  { key: '{productName}', label: 'Product Name' },
  { key: '{price}', label: 'Regular Price' },
  { key: '{salePrice}', label: 'Sale Price' },
  { key: '{barcode}', label: 'Barcode' },
  { key: '{category}', label: 'Category' },
  { key: '{brand}', label: 'Brand' },
  { key: '{sku}', label: 'SKU' },
  { key: '{description}', label: 'Description' },
  { key: '{unit}', label: 'Unit' },
];

const PREVIEW_VALUES = {
  productName: 'Premium Coffee Blend',
  price: '12.99',
  salePrice: '9.99',
  barcode: '5901234123457',
  category: 'Beverages',
  brand: 'BrandName',
  sku: 'PRD-001',
  description: 'Rich and aromatic blend',
  unit: 'EA',
};

const TICKET_SIZES = [
  { label: 'Small Label (70×40mm)', width: 70, height: 40 },
  { label: 'Standard (100×70mm)', width: 100, height: 70 },
  { label: 'Medium (120×80mm)', width: 120, height: 80 },
  { label: 'Large A6 (148×105mm)', width: 148, height: 105 },
  { label: 'Custom', width: null, height: null },
];

const FONT_FAMILIES = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana', 'Trebuchet MS'];

const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

// ------- Helpers -------

const toPixels = (mm, zoom = 1) => Math.round(mm * MM_TO_PX * zoom * 100) / 100;
const toMM = (px, zoom = 1) => px / (MM_TO_PX * zoom);

const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

const createDefaultElement = (type, canvasWidth = 100, canvasHeight = 70) => {
  const cx = Math.round(canvasWidth / 2 - 30);
  const cy = Math.round(canvasHeight / 2 - 10);
  const base = { id: generateId(), type, x: cx, y: cy, locked: false };

  switch (type) {
    case ELEMENT_TYPES.TEXT:
      return { ...base, x: 5, y: 5, width: 80, height: 12, content: 'Text label', fontSize: 10, fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: '#000000', textAlign: 'left', backgroundColor: 'transparent' };
    case ELEMENT_TYPES.PRICE:
      return { ...base, x: 5, y: 20, width: 50, height: 20, content: '{price}', prefix: '$', suffix: '', fontSize: 20, fontFamily: 'Arial', fontWeight: 'bold', fontStyle: 'normal', textDecoration: 'none', color: '#cc0000', textAlign: 'left', backgroundColor: 'transparent' };
    case ELEMENT_TYPES.BARCODE:
      return { ...base, x: 10, y: 40, width: 70, height: 20, field: 'barcode', format: 'CODE128', showText: true };
    case ELEMENT_TYPES.IMAGE:
      return { ...base, x: 5, y: 5, width: 30, height: 30, src: '', fit: 'contain', backgroundColor: '#f5f5f5' };
    case ELEMENT_TYPES.SHAPE:
      return { ...base, x: 5, y: 5, width: 50, height: 20, shape: 'rectangle', backgroundColor: '#e3f2fd', borderColor: '#1976d2', borderWidth: 1, borderRadius: 0 };
    case ELEMENT_TYPES.LINE:
      return { ...base, x: 5, y: 35, width: 90, height: 0.5, orientation: 'horizontal', color: '#000000', thickness: 0.5 };
    default:
      return base;
  }
};

// ------- Replace variables -------

const replaceVars = (content = '', data = PREVIEW_VALUES) =>
  content
    .replace(/\{productName\}/g, data.productName || '')
    .replace(/\{price\}/g, data.price || '')
    .replace(/\{salePrice\}/g, data.salePrice || '')
    .replace(/\{barcode\}/g, data.barcode || '')
    .replace(/\{category\}/g, data.category || '')
    .replace(/\{brand\}/g, data.brand || '')
    .replace(/\{sku\}/g, data.sku || '')
    .replace(/\{description\}/g, data.description || '')
    .replace(/\{unit\}/g, data.unit || '');

// ------- Render element content -------

const renderContent = (el, zoom, data = PREVIEW_VALUES) => {
  const pxFont = toPixels(el.fontSize / 2.835, zoom); // pt→mm approx

  switch (el.type) {
    case ELEMENT_TYPES.TEXT:
      return (
        <Box sx={{
          width: '100%', height: '100%', overflow: 'hidden',
          fontSize: pxFont, fontFamily: el.fontFamily, fontWeight: el.fontWeight,
          fontStyle: el.fontStyle, textDecoration: el.textDecoration,
          color: el.color, textAlign: el.textAlign,
          backgroundColor: el.backgroundColor !== 'transparent' ? el.backgroundColor : undefined,
          display: 'flex', alignItems: 'center',
          px: `${toPixels(1, zoom)}px`,
          lineHeight: 1.2,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {replaceVars(el.content, data)}
        </Box>
      );

    case ELEMENT_TYPES.PRICE: {
      const val = el.content?.includes('{salePrice}') ? data.salePrice : data.price;
      const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' };
      return (
        <Box sx={{
          width: '100%', height: '100%', overflow: 'hidden',
          fontSize: pxFont, fontFamily: el.fontFamily, fontWeight: el.fontWeight || 'bold',
          fontStyle: el.fontStyle, textDecoration: el.textDecoration,
          color: el.color,
          backgroundColor: el.backgroundColor !== 'transparent' ? el.backgroundColor : undefined,
          display: 'flex', alignItems: 'center',
          justifyContent: justifyMap[el.textAlign] || 'flex-start',
          px: `${toPixels(1, zoom)}px`,
          lineHeight: 1,
        }}>
          {(el.prefix || '')}
          {val}
          {(el.suffix || '')}
        </Box>
      );
    }

    case ELEMENT_TYPES.BARCODE: {
      return renderPrintElement(el, data);
    }

    case ELEMENT_TYPES.IMAGE:
      return el.src
        ? <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.fit || 'contain', display: 'block' }} />
        : (
          <Box sx={{ width: '100%', height: '100%', backgroundColor: el.backgroundColor || '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #bbb' }}>
            <ImageIcon sx={{ color: '#bbb', fontSize: toPixels(8, zoom) }} />
          </Box>
        );

    case ELEMENT_TYPES.SHAPE:
      return (
        <Box sx={{
          width: '100%', height: '100%',
          backgroundColor: el.backgroundColor || 'transparent',
          border: el.borderWidth ? `${el.borderWidth}px solid ${el.borderColor || '#000'}` : 'none',
          borderRadius: el.shape === 'circle' ? '50%' : (el.borderRadius ? `${el.borderRadius}px` : 0),
        }} />
      );

    case ELEMENT_TYPES.LINE:
      return (
        <Box sx={{ width: '100%', height: '100%', backgroundColor: el.color || '#000000' }} />
      );

    default:
      return null;
  }
};

// ------- Resize Handle -------

const getHandleStyle = (handle, zoom) => {
  const s = 8;
  const half = -s / 2;
  const posMap = {
    nw: { top: half, left: half, cursor: 'nw-resize' },
    n:  { top: half, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
    ne: { top: half, right: half, cursor: 'ne-resize' },
    e:  { top: '50%', right: half, transform: 'translateY(-50%)', cursor: 'e-resize' },
    se: { bottom: half, right: half, cursor: 'se-resize' },
    s:  { bottom: half, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
    sw: { bottom: half, left: half, cursor: 'sw-resize' },
    w:  { top: '50%', left: half, transform: 'translateY(-50%)', cursor: 'w-resize' },
  };
  return { position: 'absolute', width: s, height: s, backgroundColor: '#1976d2', border: '2px solid #fff', borderRadius: 1, zIndex: 20, ...posMap[handle] };
};

// ------- Color Picker Button -------

const ColorPickerButton = ({ color, onChange, label }) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const normalizedColor = (!color || color === 'transparent') ? '#000000' : color;
  return (
    <>
      <Box>
        {label && <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>{label}</Typography>}
        <Box
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            width: 36, height: 24, borderRadius: 1, cursor: 'pointer',
            backgroundColor: color || 'transparent',
            border: '2px solid #ccc',
            backgroundImage: !color || color === 'transparent'
              ? 'repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 12px 12px'
              : 'none',
          }}
        />
      </Box>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 1.5, minWidth: 220 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              type="color"
              size="small"
              value={normalizedColor}
              onChange={(e) => onChange(e.target.value)}
              sx={{ width: 72 }}
              inputProps={{ 'aria-label': 'Choose color' }}
            />
            <TextField
              size="small"
              label="Hex"
              value={color || ''}
              placeholder="#000000"
              onChange={(e) => onChange(e.target.value)}
              sx={{ flex: 1 }}
            />
          </Stack>
          <Button
            size="small"
            fullWidth
            onClick={() => { onChange('transparent'); setAnchorEl(null); }}
            sx={{ mt: 1 }}
          >
            Transparent
          </Button>
        </Box>
      </Popover>
    </>
  );
};

// ------- Main Component -------

const ShelfTicketEditor = () => {
  const { templateId } = useParams();
  const navigate = useNavigate();

  const [template, setTemplate] = useState({
    id: null, name: 'New Template', width: 100, height: 70,
    backgroundColor: '#ffffff', elements: [],
  });
  const [selectedId, setSelectedId] = useState(null);
  const [zoom, setZoom] = useState(1.0);
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSize, setGridSize] = useState(5);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [loading, setLoading] = useState(true);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [previewDialog, setPreviewDialog] = useState(false);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [sizeMenuOpen, setSizeMenuOpen] = useState(false);
  const [customSize, setCustomSize] = useState({ width: 100, height: 70 });
  const [nameEdit, setNameEdit] = useState(false);

  const canvasRef = useRef(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragData = useRef({});
  const resizeData = useRef({});
  const zoomRef = useRef(zoom);
  const snapToGridRef = useRef(snapToGrid);
  const gridSizeRef = useRef(gridSize);
  const rafMoveId = useRef(null);
  const lastMoveEvent = useRef(null);
  const unbindGlobalListeners = useRef(null);

  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { snapToGridRef.current = snapToGrid; }, [snapToGrid]);
  useEffect(() => { gridSizeRef.current = gridSize; }, [gridSize]);

  useEffect(() => () => {
    if (unbindGlobalListeners.current) unbindGlobalListeners.current();
    if (rafMoveId.current) cancelAnimationFrame(rafMoveId.current);
  }, []);

  // ---- Load template from API ----
  useEffect(() => {
    const load = async () => {
      try {
        const data = await shelfTicketTemplateService.getTemplate(templateId);
        const t = data.template;
        setTemplate(t);
        setHistory([JSON.stringify(t.elements || [])]);
        setHistoryIndex(0);
      } catch (err) {
        console.error('Failed to load template:', err);
        setSnackbar({ open: true, message: 'Failed to load template', severity: 'error' });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [templateId]);

  const selectedElement = template.elements.find(el => el.id === selectedId);

  // ---- History ----
  const pushHistory = useCallback((elements) => {
    setHistory(prev => {
      const next = prev.slice(0, historyIndex + 1);
      next.push(JSON.stringify(elements));
      return next.slice(-50);
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    const elements = JSON.parse(history[newIndex]);
    setTemplate(t => ({ ...t, elements }));
    setHistoryIndex(newIndex);
    setSelectedId(null);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    const elements = JSON.parse(history[newIndex]);
    setTemplate(t => ({ ...t, elements }));
    setHistoryIndex(newIndex);
    setSelectedId(null);
  };

  // ---- Save to API ----
  const handleSave = useCallback(async () => {
    try {
      await shelfTicketTemplateService.updateTemplate(template.id, {
        name: template.name,
        description: template.description,
        width: template.width,
        height: template.height,
        backgroundColor: template.backgroundColor,
        elements: template.elements,
      });
      setSnackbar({ open: true, message: 'Template saved successfully', severity: 'success' });
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to save template', severity: 'error' });
    }
  }, [template]);

  // ---- Add element ----
  const handleAddElement = (type) => {
    const el = createDefaultElement(type, template.width, template.height);
    const elements = [...template.elements, el];
    setTemplate(t => ({ ...t, elements }));
    setSelectedId(el.id);
    pushHistory(elements);
  };

  // ---- Update element ----
  const updateElement = useCallback((id, changes) => {
    setTemplate(t => ({
      ...t,
      elements: t.elements.map(el => el.id === id ? { ...el, ...changes } : el),
    }));
  }, []);

  const updateElementAndHistory = (id, changes) => {
    const elements = template.elements.map(el => el.id === id ? { ...el, ...changes } : el);
    setTemplate(t => ({ ...t, elements }));
    pushHistory(elements);
  };

  // ---- Delete element ----
  const handleDeleteElement = () => {
    if (!selectedId) return;
    const elements = template.elements.filter(el => el.id !== selectedId);
    setTemplate(t => ({ ...t, elements }));
    setSelectedId(null);
    pushHistory(elements);
  };

  // ---- Duplicate element ----
  const handleDuplicateElement = () => {
    if (!selectedElement) return;
    const dup = { ...selectedElement, id: generateId(), x: selectedElement.x + 5, y: selectedElement.y + 5 };
    const elements = [...template.elements, dup];
    setTemplate(t => ({ ...t, elements }));
    setSelectedId(dup.id);
    pushHistory(elements);
  };

  // ---- Layer order ----
  const bringForward = () => {
    if (!selectedId) return;
    const idx = template.elements.findIndex(el => el.id === selectedId);
    if (idx >= template.elements.length - 1) return;
    const elements = [...template.elements];
    [elements[idx], elements[idx + 1]] = [elements[idx + 1], elements[idx]];
    setTemplate(t => ({ ...t, elements }));
    pushHistory(elements);
  };

  const sendBackward = () => {
    if (!selectedId) return;
    const idx = template.elements.findIndex(el => el.id === selectedId);
    if (idx <= 0) return;
    const elements = [...template.elements];
    [elements[idx], elements[idx - 1]] = [elements[idx - 1], elements[idx]];
    setTemplate(t => ({ ...t, elements }));
    pushHistory(elements);
  };

  // ---- Mouse drag/resize (listeners attached on mousedown; rAF-throttled moves; snap on mouseup) ----
  const snapValue = useCallback((val) => {
    if (!snapToGrid) return val;
    return Math.round(val / gridSize) * gridSize;
  }, [snapToGrid, gridSize]);

  const snapValRef = (v) => {
    if (!snapToGridRef.current) return v;
    const g = gridSizeRef.current || 1;
    return Math.round(v / g) * g;
  };

  const flushMoveFrame = useCallback(() => {
    const e = lastMoveEvent.current;
    if (!e) return;

    if (isDragging.current) {
      const { elementId, startMouseX, startMouseY, startElX, startElY } = dragData.current;
      if (!elementId) return;
      const z = zoomRef.current;
      const dx = toMM(e.clientX - startMouseX, z);
      const dy = toMM(e.clientY - startMouseY, z);
      setTemplate(t => {
        const el = t.elements.find(x => x.id === elementId);
        if (!el) return t;
        const newX = Math.max(0, Math.min(t.width - el.width, startElX + dx));
        const newY = Math.max(0, Math.min(t.height - el.height, startElY + dy));
        return { ...t, elements: t.elements.map(x => x.id === elementId ? { ...x, x: newX, y: newY } : x) };
      });
    } else if (isResizing.current) {
      const { elementId, handle, startMouseX, startMouseY, startEl } = resizeData.current;
      if (!elementId || !startEl) return;
      const z = zoomRef.current;
      const dx = toMM(e.clientX - startMouseX, z);
      const dy = toMM(e.clientY - startMouseY, z);
      setTemplate(t => {
        const el = t.elements.find(x => x.id === elementId);
        if (!el) return t;
        let { x, y, width, height } = { ...startEl };
        const minSize = 2;
        if (handle.includes('e')) width = Math.max(minSize, width + dx);
        if (handle.includes('s')) height = Math.max(minSize, height + dy);
        if (handle.includes('w')) {
          const newW = Math.max(minSize, width - dx);
          x += width - newW;
          width = newW;
        }
        if (handle.includes('n')) {
          const newH = Math.max(minSize, height - dy);
          y += height - newH;
          height = newH;
        }
        x = Math.max(0, x);
        y = Math.max(0, y);
        width = Math.min(width, t.width - x);
        height = Math.min(height, t.height - y);
        return { ...t, elements: t.elements.map(ee => ee.id === elementId ? { ...ee, x, y, width, height } : ee) };
      });
    }
  }, []);

  const scheduleMoveFrame = (ev) => {
    lastMoveEvent.current = ev;
    if (rafMoveId.current != null) return;
    rafMoveId.current = requestAnimationFrame(() => {
      rafMoveId.current = null;
      flushMoveFrame();
    });
  };

  const handleElementMouseDown = (e, elementId) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(elementId);

    const el = template.elements.find(x => x.id === elementId);
    if (!el || el.locked) return;

    if (unbindGlobalListeners.current) {
      unbindGlobalListeners.current();
      unbindGlobalListeners.current = null;
    }
    isDragging.current = true;
    isResizing.current = false;
    dragData.current = {
      elementId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startElX: el.x,
      startElY: el.y,
    };

    const onMove = (ev) => {
      if (!isDragging.current) return;
      ev.preventDefault();
      scheduleMoveFrame(ev);
    };
    const onUp = () => {
      if (rafMoveId.current) {
        cancelAnimationFrame(rafMoveId.current);
        rafMoveId.current = null;
      }
      if (lastMoveEvent.current) {
        flushMoveFrame();
      }
      isDragging.current = false;
      lastMoveEvent.current = null;
      window.removeEventListener('mousemove', onMove, { capture: true });
      window.removeEventListener('mouseup', onUp, { capture: true });
      unbindGlobalListeners.current = null;

      const { elementId: id } = dragData.current;
      setTemplate(t => {
        let elements = t.elements;
        if (id && snapToGridRef.current) {
          elements = t.elements.map(x => (x.id === id ? { ...x, x: snapValRef(x.x), y: snapValRef(x.y) } : x));
        } else {
          elements = t.elements;
        }
        pushHistory(elements);
        return { ...t, elements };
      });
    };

    window.addEventListener('mousemove', onMove, { capture: true, passive: false });
    window.addEventListener('mouseup', onUp, { capture: true });
    unbindGlobalListeners.current = () => {
      window.removeEventListener('mousemove', onMove, { capture: true });
      window.removeEventListener('mouseup', onUp, { capture: true });
    };
  };

  const handleResizeMouseDown = (e, elementId, handle) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(elementId);

    const el = template.elements.find(x => x.id === elementId);
    if (!el || el.locked) return;

    if (unbindGlobalListeners.current) {
      unbindGlobalListeners.current();
      unbindGlobalListeners.current = null;
    }
    isResizing.current = true;
    isDragging.current = false;
    resizeData.current = {
      elementId,
      handle,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startEl: { x: el.x, y: el.y, width: el.width, height: el.height },
    };

    const onMove = (ev) => {
      if (!isResizing.current) return;
      ev.preventDefault();
      scheduleMoveFrame(ev);
    };
    const onUp = () => {
      if (rafMoveId.current) {
        cancelAnimationFrame(rafMoveId.current);
        rafMoveId.current = null;
      }
      if (lastMoveEvent.current) {
        flushMoveFrame();
      }
      isResizing.current = false;
      lastMoveEvent.current = null;
      window.removeEventListener('mousemove', onMove, { capture: true });
      window.removeEventListener('mouseup', onUp, { capture: true });
      unbindGlobalListeners.current = null;

      const { elementId: id } = resizeData.current;
      setTemplate(t => {
        let elements = t.elements;
        if (id && snapToGridRef.current) {
          elements = t.elements.map(x => (x.id === id
            ? {
              ...x,
              x: snapValRef(x.x),
              y: snapValRef(x.y),
              width: Math.max(2, snapValRef(x.width)),
              height: Math.max(0.5, snapValRef(x.height)),
            }
            : x));
        } else {
          elements = t.elements;
        }
        pushHistory(elements);
        return { ...t, elements };
      });
    };

    window.addEventListener('mousemove', onMove, { capture: true, passive: false });
    window.addEventListener('mouseup', onUp, { capture: true });
    unbindGlobalListeners.current = () => {
      window.removeEventListener('mousemove', onMove, { capture: true });
      window.removeEventListener('mouseup', onUp, { capture: true });
    };
  };

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); handleSave(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); handleDuplicateElement(); }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedId) handleDeleteElement();
      }
      if (e.key === 'Escape') setSelectedId(null);

      // Arrow keys to nudge
      if (selectedElement && !selectedElement.locked) {
        const step = e.shiftKey ? 1 : 0.5;
        if (e.key === 'ArrowLeft') updateElement(selectedId, { x: Math.max(0, selectedElement.x - step) });
        if (e.key === 'ArrowRight') updateElement(selectedId, { x: Math.min(template.width - selectedElement.width, selectedElement.x + step) });
        if (e.key === 'ArrowUp') updateElement(selectedId, { y: Math.max(0, selectedElement.y - step) });
        if (e.key === 'ArrowDown') updateElement(selectedId, { y: Math.min(template.height - selectedElement.height, selectedElement.y + step) });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedElement, template, handleSave, undo, redo]);

  // ---- Zoom ----
  const handleZoom = (delta) => {
    setZoom(z => Math.max(0.5, Math.min(3, z + delta)));
  };

  const canvasW = toPixels(template.width, zoom);
  const canvasH = toPixels(template.height, zoom);

  if (loading) return <PageLoader />;

  // ---- Render element on canvas ----
  const renderCanvasElement = (el) => {
    const isSelected = selectedId === el.id;
    const px = toPixels(el.x, zoom);
    const py = toPixels(el.y, zoom);
    const pw = toPixels(el.width, zoom);
    const ph = toPixels(Math.max(el.height, 0.5), zoom);

    return (
      <Box
        key={el.id}
        onMouseDown={(e) => handleElementMouseDown(e, el.id)}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(el.id);
        }}
        sx={{
          position: 'absolute',
          left: px, top: py, width: pw, height: ph,
          cursor: el.locked ? 'default' : 'move',
          userSelect: 'none',
          outline: isSelected ? '2px dashed #1976d2' : 'none',
          outlineOffset: '1px',
          zIndex: isSelected ? 10 : 1,
          '&:hover': { outline: '1px dashed #90caf9', outlineOffset: '1px' },
        }}
      >
        {renderContent(el, zoom)}
        {isSelected && !el.locked && RESIZE_HANDLES.map(handle => (
          <Box
            key={handle}
            onMouseDown={(e) => handleResizeMouseDown(e, el.id, handle)}
            onClick={(e) => e.stopPropagation()}
            sx={getHandleStyle(handle, zoom)}
          />
        ))}
        {isSelected && el.locked && (
          <Box sx={{ position: 'absolute', top: -10, right: -10, backgroundColor: '#ff9800', borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LockIcon sx={{ fontSize: 10, color: '#fff' }} />
          </Box>
        )}
      </Box>
    );
  };

  // ---- Properties Panel ----
  const renderPropertiesPanel = () => {
    if (!selectedElement) {
      return (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2" sx={{ mt: 4 }}>Select an element to edit its properties</Typography>
        </Box>
      );
    }

    const el = selectedElement;
    const updateEl = (changes) => updateElement(el.id, changes);
    const updateElHistory = (changes) => updateElementAndHistory(el.id, changes);

    const textControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Content</Typography>
        <TextField
          fullWidth
          multiline
          minRows={2}
          size="small"
          label="Content"
          value={el.content || ''}
          onChange={(e) => updateEl({ content: e.target.value })}
          onBlur={(e) => updateElHistory({ content: e.target.value })}
          sx={{ mb: 1 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Field variables:
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {FIELD_VARIABLES.map(fv => (
            <Chip
              key={fv.key}
              label={fv.key}
              size="small"
              variant="outlined"
              onClick={() => updateEl({ content: (el.content || '') + fv.key })}
              sx={{ fontSize: 10, cursor: 'pointer' }}
            />
          ))}
        </Box>

        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Typography</Typography>

        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Font Family</InputLabel>
          <Select value={el.fontFamily || 'Arial'} label="Font Family"
            onChange={(e) => updateElHistory({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map(f => <MenuItem key={f} value={f} sx={{ fontFamily: f }}>{f}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            label="Size (pt)"
            type="number"
            inputProps={{ min: 4, max: 72, step: 0.5 }}
            value={el.fontSize || 10}
            onChange={(e) => updateEl({ fontSize: parseFloat(e.target.value) || 10 })}
            onBlur={(e) => updateElHistory({ fontSize: parseFloat(e.target.value) || 10 })}
            sx={{ width: 90 }}
          />
          <ToggleButtonGroup size="small">
            <ToggleButton value="bold" selected={el.fontWeight === 'bold'}
              onClick={() => updateElHistory({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}>
              <BoldIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="italic" selected={el.fontStyle === 'italic'}
              onClick={() => updateElHistory({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}>
              <ItalicIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="underline" selected={el.textDecoration === 'underline'}
              onClick={() => updateElHistory({ textDecoration: el.textDecoration === 'underline' ? 'none' : 'underline' })}>
              <UnderlineIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>

        <ToggleButtonGroup size="small" value={el.textAlign || 'left'}
          exclusive onChange={(_, v) => v && updateElHistory({ textAlign: v })} sx={{ mb: 1 }}>
          <ToggleButton value="left"><AlignLeftIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="center"><AlignCenterIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="right"><AlignRightIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
          <ColorPickerButton label="Text Color" color={el.color} onChange={(c) => updateElHistory({ color: c })} />
          <ColorPickerButton label="Background" color={el.backgroundColor} onChange={(c) => updateElHistory({ backgroundColor: c })} />
        </Box>
      </>
    );

    const priceControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Price Field</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Price Type</InputLabel>
          <Select
            label="Price Type"
            value={el.content?.includes('{salePrice}') ? '{salePrice}' : '{price}'}
            onChange={(e) => updateElHistory({ content: e.target.value })}
          >
            <MenuItem value="{price}">Regular Price</MenuItem>
            <MenuItem value="{salePrice}">Sale Price</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <TextField size="small" label="Prefix" value={el.prefix || ''} onChange={(e) => updateEl({ prefix: e.target.value })} onBlur={(e) => updateElHistory({ prefix: e.target.value })} sx={{ width: '50%' }} />
          <TextField size="small" label="Suffix" value={el.suffix || ''} onChange={(e) => updateEl({ suffix: e.target.value })} onBlur={(e) => updateElHistory({ suffix: e.target.value })} sx={{ width: '50%' }} />
        </Box>
        <Divider sx={{ my: 1 }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Typography</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Font Family</InputLabel>
          <Select value={el.fontFamily || 'Arial'} label="Font Family" onChange={(e) => updateElHistory({ fontFamily: e.target.value })}>
            {FONT_FAMILIES.map(f => <MenuItem key={f} value={f} sx={{ fontFamily: f }}>{f}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
          <TextField size="small" label="Size (pt)" type="number" inputProps={{ min: 4, max: 120, step: 1 }}
            value={el.fontSize || 20} onChange={(e) => updateEl({ fontSize: parseFloat(e.target.value) })}
            onBlur={(e) => updateElHistory({ fontSize: parseFloat(e.target.value) })} sx={{ width: 90 }} />
          <ToggleButtonGroup size="small">
            <ToggleButton value="bold" selected={el.fontWeight === 'bold'} onClick={() => updateElHistory({ fontWeight: el.fontWeight === 'bold' ? 'normal' : 'bold' })}><BoldIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="italic" selected={el.fontStyle === 'italic'} onClick={() => updateElHistory({ fontStyle: el.fontStyle === 'italic' ? 'normal' : 'italic' })}><ItalicIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <ToggleButtonGroup size="small" value={el.textAlign || 'left'} exclusive onChange={(_, v) => v && updateElHistory({ textAlign: v })} sx={{ mb: 1 }}>
          <ToggleButton value="left"><AlignLeftIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="center"><AlignCenterIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="right"><AlignRightIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
        <ColorPickerButton label="Color" color={el.color} onChange={(c) => updateElHistory({ color: c })} />
      </>
    );

    const barcodeControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Barcode Settings</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Data Field</InputLabel>
          <Select value={el.field || 'barcode'} label="Data Field" onChange={(e) => updateElHistory({ field: e.target.value })}>
            <MenuItem value="barcode">Barcode / EAN</MenuItem>
            <MenuItem value="sku">SKU</MenuItem>
            <MenuItem value="productName">Product Name</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Format</InputLabel>
          <Select value={el.format || 'CODE128'} label="Format" onChange={(e) => updateElHistory({ format: e.target.value })}>
            <MenuItem value="CODE128">Code 128</MenuItem>
            <MenuItem value="EAN13">EAN-13</MenuItem>
            <MenuItem value="EAN8">EAN-8</MenuItem>
            <MenuItem value="CODE39">Code 39</MenuItem>
          </Select>
        </FormControl>
        <FormControlLabel control={<Switch checked={el.showText !== false} onChange={(e) => updateElHistory({ showText: e.target.checked })} />} label="Show barcode number" />
      </>
    );

    const shapeControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Shape Style</Typography>
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Shape</InputLabel>
          <Select value={el.shape || 'rectangle'} label="Shape" onChange={(e) => updateElHistory({ shape: e.target.value })}>
            <MenuItem value="rectangle">Rectangle</MenuItem>
            <MenuItem value="circle">Circle / Ellipse</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <ColorPickerButton label="Fill Color" color={el.backgroundColor} onChange={(c) => updateElHistory({ backgroundColor: c })} />
          <ColorPickerButton label="Border Color" color={el.borderColor} onChange={(c) => updateElHistory({ borderColor: c })} />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" label="Border Width (px)" type="number" inputProps={{ min: 0, max: 20, step: 0.5 }}
            value={el.borderWidth || 0} onChange={(e) => updateEl({ borderWidth: parseFloat(e.target.value) })}
            onBlur={(e) => updateElHistory({ borderWidth: parseFloat(e.target.value) })} />
          <TextField size="small" label="Corner Radius" type="number" inputProps={{ min: 0, max: 50, step: 1 }}
            value={el.borderRadius || 0} onChange={(e) => updateEl({ borderRadius: parseFloat(e.target.value) })}
            onBlur={(e) => updateElHistory({ borderRadius: parseFloat(e.target.value) })} />
        </Box>
      </>
    );

    const lineControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Line Style</Typography>
        <ColorPickerButton label="Line Color" color={el.color} onChange={(c) => updateElHistory({ color: c })} />
        <TextField size="small" label="Thickness (mm)" type="number" inputProps={{ min: 0.1, max: 5, step: 0.1 }}
          value={el.height || 0.5} onChange={(e) => updateEl({ height: parseFloat(e.target.value) })}
          onBlur={(e) => updateElHistory({ height: parseFloat(e.target.value) })} sx={{ mt: 1, display: 'block', width: '100%' }} />
      </>
    );

    const imageControls = (
      <>
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Image</Typography>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PermMediaIcon />}
          onClick={() => setMediaDialogOpen(true)}
          sx={{ mb: 1, textTransform: 'none' }}
        >
          Choose from media center
        </Button>
        <TextField
          fullWidth
          size="small"
          label="Or paste image URL"
          value={el.src || ''}
          onChange={(e) => updateEl({ src: e.target.value })}
          onBlur={(e) => updateElHistory({ src: e.target.value })}
          sx={{ mb: 1 }}
        />
        <FormControl fullWidth size="small" sx={{ mb: 1 }}>
          <InputLabel>Fit</InputLabel>
          <Select value={el.fit || 'contain'} label="Fit" onChange={(e) => updateElHistory({ fit: e.target.value })}>
            <MenuItem value="contain">Contain</MenuItem>
            <MenuItem value="cover">Cover</MenuItem>
            <MenuItem value="fill">Stretch</MenuItem>
          </Select>
        </FormControl>
      </>
    );

    return (
      <Box sx={{ p: 2, overflowY: 'auto', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ textTransform: 'capitalize' }}>
            {el.type} Element
          </Typography>
          <Box>
            <Tooltip title={el.locked ? 'Unlock' : 'Lock'}>
              <span>
                <IconButton size="small" onClick={() => updateElHistory({ locked: !el.locked })}>
                  {el.locked ? <LockIcon fontSize="small" color="warning" /> : <LockOpenIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Duplicate">
              <span>
                <IconButton size="small" onClick={handleDuplicateElement}><CopyIcon fontSize="small" /></IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Send Backward">
              <span>
                <IconButton size="small" onClick={sendBackward}><SendBackwardIcon fontSize="small" /></IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Bring Forward">
              <span>
                <IconButton size="small" onClick={bringForward}><BringForwardIcon fontSize="small" /></IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Delete (Del)">
              <span>
                <IconButton size="small" color="error" onClick={handleDeleteElement}><DeleteIcon fontSize="small" /></IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>

        <Divider />

        {/* Position & Size */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 2, mb: 1 }}>Position & Size</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, mb: 1 }}>
          <TextField size="small" label="X (mm)" type="number" inputProps={{ step: 0.5 }}
            value={Math.round(el.x * 10) / 10}
            onChange={(e) => updateEl({ x: parseFloat(e.target.value) || 0 })}
            onBlur={(e) => updateElHistory({ x: parseFloat(e.target.value) || 0 })} />
          <TextField size="small" label="Y (mm)" type="number" inputProps={{ step: 0.5 }}
            value={Math.round(el.y * 10) / 10}
            onChange={(e) => updateEl({ y: parseFloat(e.target.value) || 0 })}
            onBlur={(e) => updateElHistory({ y: parseFloat(e.target.value) || 0 })} />
          <TextField size="small" label="Width (mm)" type="number" inputProps={{ min: 1, step: 0.5 }}
            value={Math.round(el.width * 10) / 10}
            onChange={(e) => updateEl({ width: parseFloat(e.target.value) || 1 })}
            onBlur={(e) => updateElHistory({ width: parseFloat(e.target.value) || 1 })} />
          <TextField size="small" label="Height (mm)" type="number" inputProps={{ min: 0.1, step: 0.5 }}
            value={Math.round(el.height * 10) / 10}
            onChange={(e) => updateEl({ height: parseFloat(e.target.value) || 0.5 })}
            onBlur={(e) => updateElHistory({ height: parseFloat(e.target.value) || 0.5 })} />
        </Box>

        {/* Type-specific controls */}
        {(el.type === ELEMENT_TYPES.TEXT) && textControls}
        {(el.type === ELEMENT_TYPES.PRICE) && priceControls}
        {(el.type === ELEMENT_TYPES.BARCODE) && barcodeControls}
        {(el.type === ELEMENT_TYPES.SHAPE) && shapeControls}
        {(el.type === ELEMENT_TYPES.LINE) && lineControls}
        {(el.type === ELEMENT_TYPES.IMAGE) && imageControls}
      </Box>
    );
  };

  // ---- Print Preview ----
  const PrintPreviewContent = ({ data = PREVIEW_VALUES }) => (
    <Box
      sx={{
        position: 'relative',
        width: `${template.width}mm`,
        height: `${template.height}mm`,
        backgroundColor: template.backgroundColor,
        border: '1px solid #ccc',
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      {template.elements.map(el => (
        <Box
          key={el.id}
          sx={{
            position: 'absolute',
            left: `${el.x}mm`,
            top: `${el.y}mm`,
            width: `${el.width}mm`,
            height: `${el.height}mm`,
            overflow: 'hidden',
          }}
        >
          {renderPrintElement(el, data)}
        </Box>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', backgroundColor: '#f0f2f5' }}>
      {/* Toolbar */}
      <Paper elevation={2} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1, zIndex: 100, borderRadius: 0, flexShrink: 0 }}>
        <Tooltip title="Back to Templates">
          <span>
            <IconButton onClick={() => navigate('/setup/shelf-tickets')}>
              <ArrowBackIcon />
            </IconButton>
          </span>
        </Tooltip>

        {nameEdit ? (
          <TextField
            autoFocus
            size="small"
            value={template.name}
            onChange={(e) => setTemplate(t => ({ ...t, name: e.target.value }))}
            onBlur={() => setNameEdit(false)}
            onKeyDown={(e) => e.key === 'Enter' && setNameEdit(false)}
            sx={{ width: 220 }}
          />
        ) : (
          <Typography
            variant="h6"
            fontWeight={600}
            sx={{ cursor: 'pointer', '&:hover': { color: 'primary.main' }, minWidth: 100 }}
            onClick={() => setNameEdit(true)}
          >
            {template.name}
          </Typography>
        )}

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Undo (Ctrl+Z)">
          <span><IconButton size="small" onClick={undo} disabled={historyIndex <= 0}><UndoIcon /></IconButton></span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Y)">
          <span><IconButton size="small" onClick={redo} disabled={historyIndex >= history.length - 1}><RedoIcon /></IconButton></span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Zoom Out">
          <span>
            <IconButton size="small" onClick={() => handleZoom(-0.25)}><ZoomOutIcon /></IconButton>
          </span>
        </Tooltip>
        <Typography variant="body2" sx={{ minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Typography>
        <Tooltip title="Zoom In">
          <span>
            <IconButton size="small" onClick={() => handleZoom(0.25)}><ZoomInIcon /></IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Fit to screen">
          <span>
            <IconButton size="small" onClick={() => setZoom(1)}><ZoomFitIcon /></IconButton>
          </span>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        <Tooltip title="Toggle grid">
          <span>
            <IconButton size="small" color={showGrid ? 'primary' : 'default'} onClick={() => setShowGrid(s => !s)}>
              <GridIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <Button variant="outlined" startIcon={<PreviewIcon />} onClick={() => setPreviewDialog(true)}>
          Preview
        </Button>
        <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
          Save
        </Button>
      </Paper>

      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Panel - Palette */}
        <Paper elevation={1} sx={{ width: 200, display: 'flex', flexDirection: 'column', borderRadius: 0, overflowY: 'auto', flexShrink: 0, borderRight: '1px solid #e0e0e0' }}>
          <Box sx={{ p: 1.5 }}>
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
              Elements
            </Typography>

            {[
              { type: ELEMENT_TYPES.TEXT, icon: <TextIcon />, label: 'Text' },
              { type: ELEMENT_TYPES.PRICE, icon: <PriceIcon />, label: 'Price' },
              { type: ELEMENT_TYPES.BARCODE, icon: <BarcodeIcon />, label: 'Barcode' },
              { type: ELEMENT_TYPES.IMAGE, icon: <ImageIcon />, label: 'Image' },
              { type: ELEMENT_TYPES.SHAPE, icon: <ShapeIcon />, label: 'Shape' },
              { type: ELEMENT_TYPES.LINE, icon: <LineIcon />, label: 'Line / Divider' },
            ].map(item => (
              <Button
                key={item.type}
                fullWidth
                variant="outlined"
                startIcon={item.icon}
                onClick={() => handleAddElement(item.type)}
                sx={{ mb: 0.75, justifyContent: 'flex-start', textTransform: 'none', py: 0.75, borderStyle: 'dashed' }}
              >
                {item.label}
              </Button>
            ))}

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
              Canvas
            </Typography>

            <FormControl fullWidth size="small" sx={{ mb: 1 }}>
              <InputLabel>Ticket Size</InputLabel>
              <Select
                label="Ticket Size"
                value={TICKET_SIZES.find(s => s.width === template.width && s.height === template.height)?.label || 'Custom'}
                onChange={(e) => {
                  const size = TICKET_SIZES.find(s => s.label === e.target.value);
                  if (size?.width) {
                    setTemplate(t => ({ ...t, width: size.width, height: size.height }));
                  }
                }}
              >
                {TICKET_SIZES.map(s => <MenuItem key={s.label} value={s.label}>{s.label}</MenuItem>)}
              </Select>
            </FormControl>

            <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
              <TextField size="small" label="W (mm)" type="number" inputProps={{ min: 20, max: 400, step: 1 }}
                value={template.width} onChange={(e) => setTemplate(t => ({ ...t, width: parseInt(e.target.value) || 100 }))} />
              <TextField size="small" label="H (mm)" type="number" inputProps={{ min: 20, max: 400, step: 1 }}
                value={template.height} onChange={(e) => setTemplate(t => ({ ...t, height: parseInt(e.target.value) || 70 }))} />
            </Box>

            <ColorPickerButton
              label="Background"
              color={template.backgroundColor}
              onChange={(c) => setTemplate(t => ({ ...t, backgroundColor: c }))}
            />

            <FormControlLabel
              control={<Switch size="small" checked={snapToGrid} onChange={(e) => setSnapToGrid(e.target.checked)} />}
              label={<Typography variant="caption">Snap to grid</Typography>}
              sx={{ mt: 1, display: 'block' }}
            />

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
              Layers
            </Typography>
            <Box sx={{ maxHeight: 200, overflowY: 'auto' }}>
              {[...template.elements].reverse().map(el => (
                <Box
                  key={el.id}
                  onClick={() => setSelectedId(el.id)}
                  sx={{
                    px: 1, py: 0.5, cursor: 'pointer', borderRadius: 1, mb: 0.25,
                    backgroundColor: selectedId === el.id ? 'primary.light' : 'transparent',
                    '&:hover': { backgroundColor: selectedId === el.id ? 'primary.light' : 'action.hover' },
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ textTransform: 'capitalize', color: selectedId === el.id ? 'primary.contrastText' : 'text.primary', fontSize: 11 }}>
                    {el.type}
                  </Typography>
                  <Typography variant="caption" sx={{ color: selectedId === el.id ? 'primary.contrastText' : 'text.secondary', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexGrow: 1 }}>
                    {el.content || el.field || ''}
                  </Typography>
                  {el.locked && <LockIcon sx={{ fontSize: 10, opacity: 0.6 }} />}
                </Box>
              ))}
            </Box>
          </Box>
        </Paper>

        {/* Canvas Area */}
        <Box
          sx={{ flexGrow: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', p: 4, pt: 3 }}
          onClick={() => setSelectedId(null)}
        >
          <Box
            ref={canvasRef}
            sx={{
              position: 'relative',
              width: canvasW,
              height: canvasH,
              backgroundColor: template.backgroundColor || '#ffffff',
              boxShadow: '0 4px 24px rgba(0,0,0,0.25)',
              flexShrink: 0,
              backgroundImage: showGrid
                ? `linear-gradient(rgba(150,150,200,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(150,150,200,0.3) 1px, transparent 1px)`
                : 'none',
              backgroundSize: showGrid ? `${toPixels(gridSize, zoom)}px ${toPixels(gridSize, zoom)}px` : 'auto',
              overflow: 'hidden',
              userSelect: 'none',
            }}
          >
            {template.elements.map(renderCanvasElement)}
          </Box>
        </Box>

        {/* Right Panel - Properties */}
        <Paper elevation={1} sx={{ width: 280, display: 'flex', flexDirection: 'column', borderRadius: 0, overflowY: 'auto', flexShrink: 0, borderLeft: '1px solid #e0e0e0' }}>
          {renderPropertiesPanel()}
        </Paper>
      </Box>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onClose={() => setPreviewDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Ticket Preview
          <Typography variant="body2" color="text.secondary">
            Shown with sample product data at actual size
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Ticket size: {template.width}×{template.height}mm
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box
                sx={{
                  position: 'relative',
                  width: `${template.width}mm`,
                  height: `${template.height}mm`,
                  backgroundColor: template.backgroundColor,
                  border: '1px solid #ccc',
                  overflow: 'hidden',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
                }}
              >
                {template.elements.map(el => (
                  <Box
                    key={el.id}
                    sx={{
                      position: 'absolute',
                      left: `${el.x}mm`,
                      top: `${el.y}mm`,
                      width: `${el.width}mm`,
                      height: `${el.height}mm`,
                      overflow: 'hidden',
                    }}
                  >
                    {renderPrintElement(el, PREVIEW_VALUES)}
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(false)}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => { setPreviewDialog(false); handlePrintPreview(template, [PREVIEW_VALUES]); }}>
            Print Sample
          </Button>
        </DialogActions>
      </Dialog>

      <MediaDialog
        open={mediaDialogOpen}
        onClose={() => setMediaDialogOpen(false)}
        accept="image/*"
        onSelect={(url) => {
          if (selectedId) {
            updateElementAndHistory(selectedId, { src: url });
          }
        }}
      />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(s => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default ShelfTicketEditor;
