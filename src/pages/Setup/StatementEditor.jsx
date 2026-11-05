import React, { useState, useEffect, useRef } from 'react';
import NumberField from '../../components/Common/NumberField';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid,
  Switch,
  FormControlLabel,
  Slider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Save as SaveIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  Add as AddIcon,
  OpenWithOutlined as MoveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  Close as CloseIcon,
  HelpOutlineOutlined as HelpIcon,
  LinkOffOutlined as LinkOffIcon,
  LinkOutlined as LinkIcon,
  GridOnOutlined as ActionsGridIcon,
  ArrowUpwardOutlined as ArrowUpIcon,
  ArrowDownwardOutlined as ArrowDownIcon,
  FormatBoldOutlined,
  FormatItalicOutlined,
  FormatUnderlinedOutlined,
  StrikethroughSOutlined,
  DataObjectOutlined,
  SuperscriptOutlined,
  SubscriptOutlined,
  FormatListBulletedOutlined,
  FormatListNumberedOutlined,
  FormatIndentIncreaseOutlined,
  FormatIndentDecreaseOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
  FormatAlignJustifyOutlined,
  EditOutlined,
  UndoOutlined,
  RedoOutlined,
  EditNoteOutlined,
  WidgetsOutlined,
  SettingsOutlined,
  AttachMoneyOutlined,
  CalendarTodayOutlined,
  StorefrontOutlined,
  TextFieldsOutlined,
  ImageOutlined,
  ViewColumnOutlined,
  HeightOutlined,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import MediaDialog from '../../components/Common/MediaDialog';
import ColorInput from '../../components/Common/ColorInput';
import SavePromptDialog from '../../components/Common/SavePromptDialog';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';
import BorderSettingsDialog, { REF_MENU_PROPS, BLUE } from '../../components/Common/BorderSettingsDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import StatementRenderer from '../../components/Statement/StatementRenderer';
import {
  renderStatementBlock,
  statementBlockGapSx,
  statementColumnsSx,
  statementColumnCellSx,
  statementColumnInnerSx,
} from '../../components/Statement/statementBlocks';
import {
  buildDefaultStatementComponents,
  getActionColumns,
  statementBorder,
  statementBorderCss,
  defaultTextFor,
  isBlankRichText,
  DEFAULT_STATEMENT_TEXTS,
} from '../../utils/statementDefaults';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import statementTemplateService from '../../services/statementTemplateService';

const COMPONENT_TYPES = {
  OVERVIEW: 'overview',
  ACTIONS: 'actions',
  CREDIT_TERMS: 'credit_terms',
  OUTLET_LOGO: 'outlet_logo',
  TEXT: 'text',
  IMAGE: 'image',
  COLUMNS: 'columns',
  SPACER: 'spacer',
};

const AVAILABLE_COMPONENTS = [
  // Palette glyphs: the receipt editor's outline icons for the types both editors
  // share (Outlet Logo, Text, Image, Columns, Spacer); the statement-only types use
  // the same outline family ($, table grid, calendar).
  { type: COMPONENT_TYPES.OVERVIEW, label: 'Overview', Icon: AttachMoneyOutlined, description: 'Financial overview' },
  { type: COMPONENT_TYPES.ACTIONS, label: 'Actions', Icon: ActionsGridIcon, description: 'Action buttons' },
  { type: COMPONENT_TYPES.CREDIT_TERMS, label: 'Credit Terms', Icon: CalendarTodayOutlined, description: 'Credit terms info' },
  { type: COMPONENT_TYPES.OUTLET_LOGO, label: 'Outlet Logo', Icon: StorefrontOutlined, description: 'Business logo' },
  { type: COMPONENT_TYPES.TEXT, label: 'Text', Icon: TextFieldsOutlined, description: 'Custom text' },
  { type: COMPONENT_TYPES.IMAGE, label: 'Image', Icon: ImageOutlined, description: 'Custom image' },
  { type: COMPONENT_TYPES.COLUMNS, label: 'Columns', Icon: ViewColumnOutlined, description: 'Column layout' },
  { type: COMPONENT_TYPES.SPACER, label: 'Spacer', Icon: HeightOutlined, description: 'Vertical spacing' },
];

// Reference input metrics: square (radius 0), 1px solid black, 16px text.
const squareInputSx = (width, height) => ({
  width,
  '& .MuiOutlinedInput-root': {
    height,
    borderRadius: 0,
    fontSize: 16,
    '& fieldset': { borderColor: '#000000', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#000000' },
    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '1px' },
  },
});

// Both fill the settings panel: the fixed 353px label boxes ran past its right
// edge (cut off, horizontal scrollbar), and the column rows ended short of them.
const ACTION_COLUMN_INPUT_SX = { ...squareInputSx('auto', 37), flex: 1, minWidth: 0 };
const ACTION_LABEL_INPUT_SX = squareInputSx('100%', 53);

// Padding is a pixel offset and must never be negative: coerce empty/NaN/negative to 0.
const clampPad = (v) => Math.max(0, parseInt(v, 10) || 0);

// Padding (px), the receipt editor's layout: Top above, Left / Right either side of a
// grey centre holding the round blue link button, Bottom below. Linked, typing one
// side sets all four. Stores { top, right, bottom, left } in whole pixels.
const PaddingControl = ({ value, onChange }) => {
  const [linked, setLinked] = useState(false);
  const padding = value || {};
  const setSide = (key, raw) => {
    const n = clampPad(raw);
    onChange(linked
      ? { top: n, right: n, bottom: n, left: n }
      : { top: 0, right: 0, bottom: 0, left: 0, ...padding, [key]: n });
  };
  const box = (key) => (
    <TextField
      size="small"
      type="number"
      placeholder="0"
      inputProps={{ min: 0, 'aria-label': `Padding ${key}`, style: { textAlign: 'center' } }}
      // Empty shows the greyed 0 placeholder; a real 0 is still a value.
      value={Number(padding[key]) ? padding[key] : ''}
      onChange={(e) => setSide(key, e.target.value)}
      sx={{ width: 70, '& .MuiOutlinedInput-root': { height: 40 } }}
    />
  );
  return (
    <Box>
      <Typography sx={{ mb: 1, fontSize: 12 }}>Padding (px)</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '70px 70px 70px', gridTemplateRows: 'auto auto auto', gap: 1, justifyContent: 'center', alignItems: 'center', justifyItems: 'center' }}>
        <Box />
        {box('top')}
        <Box />
        {box('left')}
        <Box sx={{ width: 56, height: 40, bgcolor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Tooltip title={linked ? 'Unlink sides' : 'Link all sides'}>
            <IconButton
              size="small"
              aria-pressed={linked}
              onClick={() => setLinked((v) => !v)}
              sx={{
                width: 30,
                height: 30,
                bgcolor: linked ? BLUE : '#fff',
                color: linked ? '#fff' : BLUE,
                border: `1px solid ${BLUE}`,
                '&:hover': { bgcolor: linked ? '#1670d0' : '#e8f1fd' },
              }}
            >
              {linked ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
        {box('right')}
        <Box />
        {box('bottom')}
        <Box />
      </Box>
    </Box>
  );
};

const StatementEditor = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Preview is not a dialog: it swaps the canvas in place for the statement exactly
  // as it prints, and the footer button reads "Edit" (receipt editor / reference).
  const [previewOpen, setPreviewOpen] = useState(false);
  // Reference asks "Save <name>?" (Yes / No / Cancel) when you leave the editor with
  // unsaved edits — same prompt as the receipt editor.
  const [leavePrompt, setLeavePrompt] = useState(false);
  // What the prompt should run once the user answers Yes or No - Cancel, the
  // sidebar and browser Back each leave the editor for a different place.
  const pendingLeaveRef = useRef(null);
  const savedSnapshot = useRef('');
  // The unsaved-changes baseline covers the components AND the header name field,
  // so a rename alone still prompts.
  const snapshotOf = (components, name) =>
    JSON.stringify({ components, name: name ?? '' });

  // Statement design state
  const [statementComponents, setStatementComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [draggedFromPalette, setDraggedFromPalette] = useState(null);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textEditorContent, setTextEditorContent] = useState('');
  const [textEditorRef, setTextEditorRef] = useState(null);
  useEffect(() => {
    if (textEditorOpen && textEditorRef) {
      textEditorRef.innerHTML = textEditorContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditorOpen, textEditorRef]);
  const [textEditorComponentId, setTextEditorComponentId] = useState(null);
  // The open Text block's default wording: saved blank, the block gets it back.
  const textDefaultRef = useRef('');
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkData, setLinkData] = useState({
    title: '',
    target: '',
    openInNewWindow: false
  });
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaDialogFor, setMediaDialogFor] = useState(null); // 'image' or 'outlet_logo'
  // Border Settings dialog: { value, apply } for the component being edited.
  const [borderDialog, setBorderDialog] = useState(null);
  
  // Canvas settings
  const [canvasSettings, setCanvasSettings] = useState({
    width: 210, // mm (A4 width)
    padding: 10, // mm
    fontFamily: 'Arial',
    fontSize: 12,
    backgroundColor: '#ffffff',
  });

  const NESTED_COMPONENT_ID_PREFIX = 'nested::';

  const createNestedComponentId = (parentId, columnId, nestedIndex) =>
    `${NESTED_COMPONENT_ID_PREFIX}${encodeURIComponent(parentId)}::${encodeURIComponent(columnId)}::${nestedIndex}`;

  // When a Text block's wording no longer says which default it was (already
  // overwritten and saved), its place in the seeded layout does: the header's
  // right column is the business block, the body's first column the customer
  // address, a footer Text the terms block.
  const defaultTextByPosition = (componentId) => {
    const nested = parseNestedComponentId(componentId);
    if (nested) {
      const parent = statementComponents.find((c) => c.id === nested.parentId);
      const columns = parent?.properties?.columns || [];
      const colIndex = columns.findIndex((c) => c.id === nested.columnId);
      if (parent?.zone === 'header' && colIndex === columns.length - 1 && colIndex > 0) return DEFAULT_STATEMENT_TEXTS.business;
      if (parent?.zone === 'body' && colIndex === 0) return DEFAULT_STATEMENT_TEXTS.customer;
      return '';
    }
    const comp = statementComponents.find((c) => c.id === componentId);
    if (comp?.type === COMPONENT_TYPES.TEXT && comp.zone === 'footer') return DEFAULT_STATEMENT_TEXTS.terms;
    return '';
  };

  const parseNestedComponentId = (componentId, components = statementComponents) => {
    if (typeof componentId !== 'string') return null;

    if (componentId.startsWith(NESTED_COMPONENT_ID_PREFIX)) {
      const encodedParts = componentId.slice(NESTED_COMPONENT_ID_PREFIX.length).split('::');
      if (encodedParts.length === 3) {
        const [encodedParentId, encodedColumnId, nestedIndexStr] = encodedParts;
        const nestedIndex = Number.parseInt(nestedIndexStr, 10);
        if (!Number.isNaN(nestedIndex)) {
          return {
            parentId: decodeURIComponent(encodedParentId),
            columnId: decodeURIComponent(encodedColumnId),
            nestedIndex,
          };
        }
      }
      return null;
    }

    // Legacy fallback for existing in-memory IDs previously built with hyphen separators.
    for (const parentComp of components) {
      if (parentComp.type !== COMPONENT_TYPES.COLUMNS) continue;
      const columns = parentComp.properties?.columns || [];
      for (const column of columns) {
        const prefix = `${parentComp.id}-${column.id}-`;
        if (!componentId.startsWith(prefix)) continue;
        const nestedIndexStr = componentId.slice(prefix.length);
        if (/^\d+$/.test(nestedIndexStr)) {
          return {
            parentId: parentComp.id,
            columnId: column.id,
            nestedIndex: Number.parseInt(nestedIndexStr, 10),
          };
        }
      }
    }

    return null;
  };

  const getSelectedComponentDetails = (componentId = selectedComponent, components = statementComponents) => {
    if (!componentId) return null;

    const nestedId = parseNestedComponentId(componentId, components);
    if (nestedId) {
      const parentComp = components.find(c => c.id === nestedId.parentId && c.type === COMPONENT_TYPES.COLUMNS);
      const column = parentComp?.properties?.columns?.find(col => col.id === nestedId.columnId);
      const nestedComponent = column?.components?.[nestedId.nestedIndex];
      if (nestedComponent) {
        return {
          component: nestedComponent,
          isNested: true,
          parentId: nestedId.parentId,
          columnId: nestedId.columnId,
          nestedIndex: nestedId.nestedIndex,
        };
      }
    }

    const topLevelComponent = components.find(c => c.id === componentId);
    if (!topLevelComponent) return null;

    return {
      component: topLevelComponent,
      isNested: false,
      parentId: null,
      columnId: null,
      nestedIndex: null,
    };
  };

  // Mock statement data for preview
  const mockStatementData = {
    title: 'Statement',
    business: {
      name: 'Top Drops Rossmore',
      address: 'Shop 1 832-850 Bringelly Road, Rossmore, NSW-2557',
      email: 'rossmoretopdrops@outlook.com',
      // Raw values: the default template supplies the "Ph:" / "ABN:" captions.
      phone: '(02) 9606 6476',
      abn: '69 645 353 886',
    },
    customer: {
      code: '1234',
      name: 'Crinit\'s Shop',
      contact: 'John Smith',
      address: '425 Smith St',
      city: 'Fitzroy 3065 VIC',
    },
    creditTerms: [{ label: '0 days', duration: 'P0D', amount: '$0.00' }, { label: '30 days', duration: 'P30D', amount: '$0.00' }],
    summary: {
      dateRange: '11/04/2012 - 11/05/2012',
      overdue: '$0.00',
      current: '$0.00',
      total: '$0.00',
    },
    rangeEnd: new Date(2012, 4, 11),
    activities: [
      { 
        category: '30 days',
        transactions: [
          { date: new Date(2012, 3, 10), activity: 'Invoice', number: '#00001013', reference: '', total: '$52.00', balance: '$0.00' },
          { date: new Date(2012, 3, 11), activity: 'Payment', number: '#00001013', reference: '', detail: 'Paid in Store', total: '$52.00', balance: '$0.00' },
        ]
      },
      { 
        category: 'Current',
        transactions: [
          { date: new Date(2012, 4, 10), activity: 'Invoice', number: '#00001014', reference: '', total: '$52.00', balance: '$0.00' },
          { date: new Date(2012, 4, 10), activity: 'Payment', number: '#00001014', reference: '', detail: 'Paid in Store', total: '$52.00', balance: '$0.00' },
        ]
      },
    ],
  };

  useEffect(() => {
    if (templateId && templateId !== 'new') {
      loadTemplate();
    } else {
      setTemplate({
        id: null,
        name: 'New Statement Template',
        config: {}
      });
      // Reference parity: a new statement opens with the full default design.
      const seeded = buildDefaultStatementComponents();
      setStatementComponents(seeded);
      savedSnapshot.current = snapshotOf(seeded, 'New Statement Template');
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await statementTemplateService.getTemplate(templateId);
      setTemplate(response.template);
      
      const cfg = response.template.config || {};
      // A saved design (even an empty one made with "Blank") opens as saved;
      // a template nobody designed yet opens with the default layout.
      const loaded = Array.isArray(cfg.components) && (cfg.components.length > 0 || cfg.lastModified)
        ? cfg.components
        : buildDefaultStatementComponents();
      setStatementComponents(loaded);
      // Baseline for the unsaved-changes check: the template as it opened.
      savedSnapshot.current = snapshotOf(loaded, response.template.name);
      
      if (response.template.config && response.template.config.canvas) {
        setCanvasSettings(prev => ({
          ...prev,
          ...response.template.config.canvas
        }));
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load statement template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // A blank name can't be persisted (the server refuses it), so saying so beats
      // saving the layout and silently keeping the old name (receipt editor rule).
      if (template && !String(template.name || '').trim()) {
        setError('Please specify a statement name');
        return false;
      }
      setSaving(true);
      
      // Keep the Configure dialog's email settings: saving the design used to
      // replace the whole config and drop them.
      const configData = {
        ...(template?.config || {}),
        components: statementComponents,
        canvas: canvasSettings,
        lastModified: new Date().toISOString()
      };

      if (templateId && templateId !== 'new') {
        // The header name field is part of the same Save; it used to be dropped
        // (config saved, name unchanged).
        const saved = await statementTemplateService.updateTemplate(templateId, { config: configData, name: template?.name });
        if (saved?.template) setTemplate(saved.template);
        // A successful save is the new baseline (the server trims the name).
        savedSnapshot.current = snapshotOf(statementComponents, saved?.template?.name ?? template?.name);
      } else {
        const newTemplate = await statementTemplateService.createTemplate({
          name: template?.name,
          config: configData
        });
        savedSnapshot.current = snapshotOf(statementComponents, newTemplate?.template?.name ?? template?.name);
        navigate(`/setup/statements/${newTemplate.template.id}/edit`, { replace: true });
      }
      
      setError('');
      return true;
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save statement template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const hasUnsavedChanges = () =>
    savedSnapshot.current !== snapshotOf(statementComponents, template?.name);

  const leaveEditor = () => navigate('/setup/statements');

  // Cancel mirrors the reference: straight out when nothing changed, otherwise the
  // Save? prompt.
  const handleCancel = () => {
    if (!hasUnsavedChanges()) {
      leaveEditor();
      return;
    }
    pendingLeaveRef.current = leaveEditor;
    setLeavePrompt(true);
  };

  // Sidebar navigation and browser Back both raise the same Save? prompt; only a
  // tab close or reload still falls to the browser's own warning, which no site
  // is allowed to replace.
  useUnsavedChangesGuard(hasUnsavedChanges(), (proceed) => {
    pendingLeaveRef.current = proceed;
    setLeavePrompt(true);
  });

  const handleAddComponent = (componentType, zone = 'body') => {
    const newComponent = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      zone,
      properties: getDefaultProperties(componentType),
      visible: true,
    };

    setStatementComponents(prev => [...prev, newComponent]);
    selectComponent(newComponent.id);
  };

  // Selecting a component auto-focuses the Settings/property panel (reference parity);
  // deselecting returns to the Components palette so the disabled Settings tab isn't left active.
  const selectComponent = (id) => {
    setSelectedComponent(id);
    setActiveTab(id ? 1 : 0);
  };

  const handleDragStart = (e, componentType, fromPalette = false) => {
    setIsDragging(true);
    if (fromPalette) {
      setDraggedFromPalette(componentType);
      e.dataTransfer.setData('componentType', componentType);
    } else {
      setDraggedComponent(componentType);
      e.dataTransfer.setData('componentId', componentType);
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedFromPalette(null);
    setDraggedComponent(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const componentType = e.dataTransfer.getData('componentType');
    if (componentType && draggedFromPalette) {
      handleAddComponent(componentType);
    }
    
    handleDragEnd();
  };

  const handleDropInColumn = (e, parentComponentId, columnId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const componentType = e.dataTransfer.getData('componentType');
    if (componentType && draggedFromPalette) {
      const parentComponent = statementComponents.find(comp => comp.id === parentComponentId);
      const targetColumn = parentComponent?.properties?.columns?.find(col => col.id === columnId);
      
      if (targetColumn && targetColumn.components && targetColumn.components.length >= 2) {
        handleDragEnd();
        return;
      }
      
      // Add component to column
      const newComponent = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        properties: getDefaultProperties(componentType),
        visible: true,
      };
      
      setStatementComponents(prev =>
        prev.map(comp => {
          if (comp.id === parentComponentId && comp.type === COMPONENT_TYPES.COLUMNS) {
            const updatedColumns = comp.properties.columns.map(col => {
              if (col.id === columnId) {
                return {
                  ...col,
                  components: [...(col.components || []), newComponent]
                };
              }
              return col;
            });
            
            return {
              ...comp,
              properties: {
                ...comp.properties,
                columns: updatedColumns
              }
            };
          }
          return comp;
        })
      );
    }
    
    handleDragEnd();
  };

  const getDefaultProperties = (componentType) => {
    const baseProperties = {
      backgroundColor: '#ffffff',
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
      border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
    };

    switch (componentType) {
      // Reference: Overview and Credit Terms share one set of settings.
      case COMPONENT_TYPES.OVERVIEW:
        return {
          ...baseProperties,
          fontColor: '#000000',
          fontSize: 12,
          fontWeight: 'normal',
        };
      // Its two boxes carry their own borders; the component itself has none.
      case COMPONENT_TYPES.CREDIT_TERMS:
        return {
          ...baseProperties,
          border: { enabled: false, width: 0, color: '#000000', style: 'solid' },
          fontColor: '#000000',
          fontSize: 12,
          fontWeight: 'normal',
        };
      case COMPONENT_TYPES.ACTIONS:
        return {
          ...baseProperties,
          showButtons: true
        };
      case COMPONENT_TYPES.OUTLET_LOGO:
        return { 
          ...baseProperties,
          width: 'auto', 
          height: 'auto',
          horizontalAlignment: 'center',
          imageUrl: null,
        };
      case COMPONENT_TYPES.TEXT:
        return { 
          ...baseProperties,
          content: 'Text', 
          fontSize: 12, 
          fontWeight: 'normal', 
          textAlign: 'left' 
        };
      case COMPONENT_TYPES.IMAGE:
        return { 
          ...baseProperties,
          imageUrl: null,
          width: 'auto',
          height: '',
          horizontalAlignment: 'center'
        };
      case COMPONENT_TYPES.COLUMNS:
        return { 
          ...baseProperties,
          columnCount: 2, 
          columnWidths: [50, 50],
          columns: [
            { id: `col-${Date.now()}-1`, components: [] },
            { id: `col-${Date.now()}-2`, components: [] }
          ]
        };
      case COMPONENT_TYPES.SPACER:
        return { 
          ...baseProperties,
          height: 30 
        };
      default:
        return baseProperties;
    }
  };

  const handleDeleteComponent = (componentId) => {
    setStatementComponents(prev => prev.filter(comp => comp.id !== componentId));
    if (selectedComponent === componentId) {
      selectComponent(null);
    }
  };

  const updateComponentProperty = (componentId, property, value) => {
    const nestedComponentId = parseNestedComponentId(componentId);

    if (nestedComponentId) {
      // Update nested component in column
      const { parentId, columnId, nestedIndex } = nestedComponentId;
      setStatementComponents(prev =>
        prev.map(comp => {
          if (comp.id === parentId && comp.type === COMPONENT_TYPES.COLUMNS) {
            const updatedColumns = comp.properties.columns.map(col => {
              if (col.id === columnId) {
                const updatedComponents = [...col.components];
                if (!updatedComponents[nestedIndex]) {
                  return col;
                }
                updatedComponents[nestedIndex] = {
                  ...updatedComponents[nestedIndex],
                  properties: {
                    ...updatedComponents[nestedIndex].properties,
                    [property]: value
                  }
                };
                return {
                  ...col,
                  components: updatedComponents
                };
              }
              return col;
            });
            
            return {
              ...comp,
              properties: {
                ...comp.properties,
                columns: updatedColumns
              }
            };
          }
          return comp;
        })
      );
    } else {
      // Update regular component
      setStatementComponents(prev =>
        prev.map(comp =>
          comp.id === componentId
            ? { ...comp, properties: { ...comp.properties, [property]: value } }
            : comp
        )
      );
    }
  };

  // Rich text editor functions
  // Toolbar state at the caret (reference: the active Bold / alignment tool shows a
  // thin box; tools that cannot apply are greyed). Refreshed on every edit, key and
  // click inside the body. Browsers only answer this approximately (undo/redo).
  const [toolState, setToolState] = useState({});
  const refreshToolState = () => {
    const q = (fn, cmd) => { try { return Boolean(document[fn](cmd)); } catch { return false; } };
    setToolState({
      bold: q('queryCommandState', 'bold'),
      italic: q('queryCommandState', 'italic'),
      underline: q('queryCommandState', 'underline'),
      strikeThrough: q('queryCommandState', 'strikeThrough'),
      justifyLeft: q('queryCommandState', 'justifyLeft'),
      justifyCenter: q('queryCommandState', 'justifyCenter'),
      justifyRight: q('queryCommandState', 'justifyRight'),
      justifyFull: q('queryCommandState', 'justifyFull'),
      canUnlink: Boolean(window.getSelection()?.anchorNode?.parentElement?.closest?.('a')),
      canOutdent: Boolean(window.getSelection()?.anchorNode?.parentElement?.closest?.('li, blockquote')),
      canUndo: q('queryCommandEnabled', 'undo'),
      canRedo: q('queryCommandEnabled', 'redo'),
    });
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    refreshToolState();
    if (textEditorRef) {
      setTextEditorContent(textEditorRef.innerHTML);
    }
  };

  const insertText = (text) => {
    if (textEditorRef) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        setTextEditorContent(textEditorRef.innerHTML);
      }
    }
  };

  const insertHTML = (html) => {
    if (textEditorRef) {
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        range.insertNode(tempDiv.firstChild);
        setTextEditorContent(textEditorRef.innerHTML);
      }
    }
  };

  const insertLink = () => {
    setLinkData({ title: '', target: '', openInNewWindow: false });
    setLinkDialogOpen(true);
  };

  const handleLinkSubmit = () => {
    if (linkData.title && linkData.target) {
      const targetAttr = linkData.openInNewWindow ? ' target="_blank" rel="noopener noreferrer"' : '';
      const linkHTML = `<a href="${linkData.target}"${targetAttr}>${linkData.title}</a>`;
      insertHTML(linkHTML);
      setLinkDialogOpen(false);
    }
  };

  // ---- canvas ------------------------------------------------------------------
  // Every block's CONTENT is drawn by statementBlocks.renderStatementBlock — the same
  // code the Preview and the printed statement use — and the editor chrome around it
  // (outlines, toolbars, zone tags, spacer labels) takes no layout space: outlines,
  // not borders; toolbars and tags positioned over the canvas. So a block sits at the
  // same size and position in the editor, the Preview and the print.
  const chromeOutline = (color, style = 'dashed') => ({ outline: `1px ${style} ${color}`, outlineOffset: '-1px' });

  // Editor-only placeholder for a block that prints nothing yet (no image / text).
  const renderEmptyBlock = (component) => {
    const props = component.properties || {};
    const caption = (Icon, text) => (
      <>
        <Icon sx={{ fontSize: '2rem' }} />
        <Typography variant="caption" color="text.secondary">{text}</Typography>
      </>
    );
    if (component.type === COMPONENT_TYPES.OUTLET_LOGO) {
      return (
        <Box sx={{ display: 'flex', justifyContent: props.horizontalAlignment || 'center', alignItems: 'center', minHeight: 60 }}>
          {/* Reference sets the header height with a 319x319 logo — the empty
              placeholder reserves the same square so the header region matches. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 319, height: 319, maxWidth: '100%', color: '#999', fontSize: '0.8rem', gap: 1 }}>
            {caption(ImageIcon, 'Outlet Logo component empty')}
          </Box>
        </Box>
      );
    }
    const Icon = component.type === COMPONENT_TYPES.TEXT ? TextIcon : ImageIcon;
    const label = component.type === COMPONENT_TYPES.TEXT ? 'Text component empty' : 'Image component empty';
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 60, color: '#999', fontSize: '0.8rem', gap: 1 }}>
        {caption(Icon, label)}
      </Box>
    );
  };

  const renderComponentContent = (component) => {
    if (component.type === COMPONENT_TYPES.COLUMNS) return renderColumnsBlock(component);
    if (component.type === COMPONENT_TYPES.SPACER) {
      // The real spacer height, with its size label laid over it (chrome).
      return (
        <Box sx={{ position: 'relative' }}>
          {renderStatementBlock(component, mockStatementData)}
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', ...chromeOutline('#d9d9d9') }}>
            {/* Reference: I-beam marker beside the size */}
            <HeightOutlined sx={{ fontSize: 14, color: '#9e9e9e', mr: 0.25 }} />
            <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1 }}>
              {component.properties?.height || 30}px
            </Typography>
          </Box>
        </Box>
      );
    }
    return renderStatementBlock(component, mockStatementData) || renderEmptyBlock(component);
  };

  // Dark toolbar of the SELECTED block only (reference): 32px, as wide as the block,
  // laid over its top edge so selecting never pushes the block down. Move icon left,
  // type label centred (white 14px), actions right (white 16px icons).
  const toolbarSx = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    bgcolor: '#313439',
    color: 'white',
    px: 1,
    '& .MuiIconButton-root': { color: '#fff', p: '4px' },
    '& .MuiSvgIcon-root': { fontSize: 16 },
  };
  const toolbarLabelSx = { flex: 1, textAlign: 'center', fontSize: 14, color: '#fff', lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

  const renderComponent = (component) => {
    const isSelected = selectedComponent === component.id;

    return (
      <Box
        key={component.id}
        draggable
        onClick={(e) => {
          e.stopPropagation();
          selectComponent(component.id);
        }}
        onDragStart={(e) => {
          e.stopPropagation();
          handleDragStart(e, component.id, false);
        }}
        onDragEnd={handleDragEnd}
        sx={{
          position: 'relative',
          ...statementBlockGapSx,
          cursor: 'pointer',
          ...chromeOutline(isSelected ? '#1976d2' : '#ccc'),
          '&:hover': {
            outlineColor: isSelected ? '#1976d2' : '#999',
          },
        }}
      >
        {isSelected && (
          <Box sx={toolbarSx}>
            <MoveIcon />
            <Typography sx={toolbarLabelSx}>
              {AVAILABLE_COMPONENTS.find(c => c.type === component.type)?.label || component.type}
            </Typography>
            <Box sx={{ display: 'flex' }}>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent(component.id);
                }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteComponent(component.id);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent(null);
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}

        {component.visible !== false && renderComponentContent(component)}
      </Box>
    );
  };

  // Render a canvas region. Header/Footer are 1px boxes with a bold title at the top
  // left (reference); the body flows open between them. Components are placed by
  // `zone`. The box is an outline (no space taken) and the blocks get no extra inset,
  // so they keep their printed width and left edge; only the title line itself sits
  // above a zone's first block.
  const renderZone = (zoneKey, label, boxed) => {
    const items = statementComponents.filter(c => (c.zone || 'body') === zoneKey);

    const onZoneDrop = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const componentType = e.dataTransfer.getData('componentType');
      if (componentType && draggedFromPalette) {
        handleAddComponent(componentType, zoneKey);
      }
      handleDragEnd();
    };

    return (
      <Box
        onDragOver={handleDragOver}
        onDrop={onZoneDrop}
        sx={{
          position: 'relative',
          // Reference Header / Footer box: an even 8px inset on left, right and
          // bottom, so blocks never touch the box edge.
          ...(boxed ? { ...chromeOutline('#333', 'solid'), px: 1, pb: 1 } : {}),
        }}
      >
        {boxed && (
          <Typography sx={{ fontWeight: 700, fontSize: '18.72px', lineHeight: 1.3, color: '#000000', px: 0, pt: 0.5, pb: 0.5 }}>
            {label}
          </Typography>
        )}
        {items.length === 0 ? (
          <Box
            onClick={(e) => { e.stopPropagation(); selectComponent(null); }}
            sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              minHeight: boxed ? 60 : 120, color: '#999',
              border: isDragging ? '2px dashed #1976d2' : '2px dashed #ddd',
              bgcolor: isDragging ? '#f0f8ff' : 'transparent', transition: 'all 0.2s ease',
            }}
          >
            <Typography variant="body2">
              {isDragging ? 'Drop component here' : `Drag components into ${label}`}
            </Typography>
          </Box>
        ) : (
          items.map((component) => {
            const index = statementComponents.indexOf(component);
            return (
              <Box
                key={component.id}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); handleDragOver(e); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const draggedId = e.dataTransfer.getData('componentId');
                  const componentType = e.dataTransfer.getData('componentType');
                  if (componentType && draggedFromPalette) {
                    handleAddComponent(componentType, zoneKey);
                    handleDragEnd();
                    return;
                  }
                  if (draggedId && draggedId !== component.id) {
                    const di = statementComponents.findIndex(c => c.id === draggedId);
                    const ti = index;
                    if (di !== -1 && di !== ti) {
                      const nc = [...statementComponents];
                      const [rm] = nc.splice(di, 1);
                      rm.zone = zoneKey; // moving into this zone
                      nc.splice(ti, 0, rm);
                      setStatementComponents(nc);
                    }
                  }
                  handleDragEnd();
                }}
              >
                {renderComponent(component)}
              </Box>
            );
          })
        )}
      </Box>
    );
  };

  const updateNestedComponents = (component, column, update) => {
    setStatementComponents(prev =>
      prev.map(comp => {
        if (comp.id === component.id && comp.type === COMPONENT_TYPES.COLUMNS) {
          const updatedColumns = comp.properties.columns.map(col => (
            col.id === column.id ? { ...col, components: update(col.components || []) } : col
          ));
          return { ...comp, properties: { ...comp.properties, columns: updatedColumns } };
        }
        return comp;
      })
    );
  };

  // Columns: the shared column geometry (statementBlocks) with the editor's drop
  // targets and nested-block chrome laid over it.
  const renderColumnsBlock = (component) => {
    const props = component.properties || {};
    return (
      <Box sx={statementColumnsSx(props)}>
        {(props.columns || []).map((column, colIndex) => {
          const hasItems = column.components && column.components.length > 0;
          return (
            <Box
              key={column.id}
              sx={{
                ...statementColumnCellSx(props, colIndex),
                position: 'relative',
                ...chromeOutline(isDragging ? '#2196F3' : '#ddd'),
                color: '#999',
                fontSize: '0.8rem',
                backgroundColor: isDragging ? '#f0f8ff' : undefined,
                transition: 'all 0.2s ease',
                // An empty cell is a drop target only; a filled one is its content's height.
                ...(hasItems ? {} : { minHeight: 80 }),
              }}
              onDragOver={(e) => {
                e.stopPropagation();
                handleDragOver(e);
              }}
              onDrop={(e) => {
                e.stopPropagation();
                handleDropInColumn(e, component.id, column.id);
              }}
              onClick={(e) => {
                e.stopPropagation();
                // Allow clicking on empty column areas without deselecting parent
              }}
            >
              {hasItems ? (
                <Box sx={statementColumnInnerSx}>
                  {column.components.map((nestedComp, nestedIndex) => {
                    const nestedComponentId = createNestedComponentId(component.id, column.id, nestedIndex);
                    const isNestedSelected = selectedComponent === nestedComponentId;
                    return (
                      <Box
                        key={nestedIndex}
                        sx={{
                          ...statementBlockGapSx,
                          position: 'relative',
                          cursor: 'pointer',
                          ...chromeOutline(isNestedSelected ? '#1976d2' : '#e0e0e0', 'solid'),
                          '&:hover': {
                            outlineColor: isNestedSelected ? '#1976d2' : '#999',
                          },
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          selectComponent(nestedComponentId);
                        }}
                      >
                        {isNestedSelected && (
                          <Box sx={toolbarSx}>
                            <MoveIcon />
                            <Typography sx={toolbarLabelSx}>
                              {AVAILABLE_COMPONENTS.find(c => c.type === nestedComp.type)?.label || nestedComp.type}
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateNestedComponents(component, column, (list) => list.map((c, i) => (
                                    i === nestedIndex ? { ...c, visible: !(c.visible !== false) } : c
                                  )));
                                }}
                              >
                                {nestedComp.visible !== false ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Remove component from column
                                  updateNestedComponents(component, column, (list) => list.filter((_, i) => i !== nestedIndex));
                                  if (selectedComponent === nestedComponentId) {
                                    selectComponent(null);
                                  }
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Box>
                        )}

                        {nestedComp.visible !== false ? renderComponentContent(nestedComp) : (
                          // A hidden block prints nothing; the editor keeps a slim handle to it.
                          <Typography variant="caption" sx={{ display: 'block', color: '#bbb', fontStyle: 'italic', px: 0.5 }}>
                            Hidden {AVAILABLE_COMPONENTS.find(c => c.type === nestedComp.type)?.label || nestedComp.type}
                          </Typography>
                        )}
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Box sx={{
                  textAlign: 'center',
                  p: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  minHeight: 60
                }}>
                  <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 500 }}>
                    Drop Component here
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#bbb' }}>
                    Column {colIndex + 1} (Max 2 components)
                  </Typography>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    );
  };

  // Reference: 'Name | Enabled' grid — each row is up/down reorder arrows + a
  // rename input + an enable toggle. Writes straight to properties.columns so
  // the canvas table order/labels follow.
  const renderActionColumnConfig = (componentId, props) => {
    const cols = getActionColumns(props);
    const write = (next) => updateComponentProperty(componentId, 'columns', next);
    const move = (from, to) => {
      if (to < 0 || to >= cols.length) return;
      const next = [...cols];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      write(next);
    };
    const patch = (index, changes) => write(cols.map((c, i) => (i === index ? { ...c, ...changes } : c)));

    return (
      <Box>
        <Box sx={{ display: 'flex', mb: 1 }}>
          <Typography variant="subtitle2" sx={{ flex: 1 }}>Name</Typography>
          <Typography variant="subtitle2">Enabled</Typography>
        </Box>
        {cols.map((col, i) => (
          <Box key={col.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1, width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
              <IconButton size="small" disabled={i === 0} onClick={() => move(i, i - 1)} sx={{ p: 0 }}>
                <ArrowUpIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton size="small" disabled={i === cols.length - 1} onClick={() => move(i, i + 1)} sx={{ p: 0 }}>
                <ArrowDownIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <TextField
              size="small"
              value={col.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              sx={ACTION_COLUMN_INPUT_SX}
            />
            <ShopfrontSwitch
              checked={col.enabled !== false}
              onChange={(e) => patch(i, { enabled: e.target.checked })}
            />
          </Box>
        ))}
      </Box>
    );
  };

  const renderPropertiesPanel = () => {
    if (!selectedComponent) {
      return (
        <Box sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="body2">Select a component to edit its properties</Typography>
        </Box>
      );
    }

    const selectedDetails = getSelectedComponentDetails(selectedComponent);
    if (!selectedDetails) return null;


    const { component, isNested } = selectedDetails;

    const props = component.properties || {};
    const componentId = isNested ? selectedComponent : component.id;

    // Reference swatch: full-width colour bar in a thick black frame; click opens the
    // colour picker (ColorInput overlays an invisible button on this box).
    const renderColour = (label, key, fallback) => (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
        <Box sx={{ position: 'relative', width: '100%', height: 40, bgcolor: props[key] || fallback, border: '5px solid #000', boxSizing: 'border-box', cursor: 'pointer' }}>
          <ColorInput
            aria-label={label}
            value={props[key] || fallback}
            onChange={(e) => updateComponentProperty(componentId, key, e.target.value)}
          />
        </Box>
      </Box>
    );

    const renderPadding = () => (
      <PaddingControl
        value={props.padding}
        onChange={(padding) => updateComponentProperty(componentId, 'padding', padding)}
      />
    );

    // Border: a preview of the component's real (per-side) border, then Edit Border,
    // which opens the shared Border Settings dialog. Older templates hold one flat
    // border; statementBorder reads it the way the printed statement always did.
    const borderOptions = { legacyUsesEnabled: component.type === COMPONENT_TYPES.TEXT };
    const renderBorder = () => (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
        {/* Reference: 250x100 grey box with a lighter inner bar showing the border. */}
        <Box sx={{ width: 250, maxWidth: '100%', height: 100, bgcolor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
          <Box sx={{ width: 186, maxWidth: '80%', height: 36, bgcolor: '#f8f8f8', boxSizing: 'border-box', ...statementBorderCss(props.border, borderOptions) }} />
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setBorderDialog({
            value: statementBorder(props.border, borderOptions),
            apply: (border) => updateComponentProperty(componentId, 'border', border),
          })}
          sx={{ textTransform: 'none', borderRadius: 0, color: '#676b72', borderColor: '#676b72', '&:hover': { borderColor: '#676b72', bgcolor: '#f8f8f8' } }}
        >
          Edit Border
        </Button>
      </Box>
    );

    return (
      <Box sx={{ p: 2 }}>
        <Typography component="div" sx={{ mb: 2, fontWeight: 700, fontSize: 24, lineHeight: 1.3, color: '#000' }}>
          {AVAILABLE_COMPONENTS.find(c => c.type === component.type)?.label || 'Component'}
          {isNested && (
            <Typography variant="caption" sx={{ ml: 1, px: 1, py: 0.25, bgcolor: '#e3f2fd', borderRadius: 1 }}>
              In Column
            </Typography>
          )}
        </Typography>
        
        {component.type === COMPONENT_TYPES.TEXT && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Edit Text Button - help icon to the LEFT, compact button (reference parity) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip
                title={
                  <Box sx={{ fontSize: 13, lineHeight: 1.5 }}>
                    Edit the text of this component. These dynamic fields are replaced with real details on each statement:
                    {['customerCode', 'customerCompany', 'customerName', 'customerContact', 'customerAddress', 'customerCity',
                      'businessName', 'businessAddress', 'businessEmail', 'businessPhone', 'businessAbn'].map((f) => (
                      <Box key={f} component="div" sx={{ fontFamily: 'monospace' }}>{`{${f}}`}</Box>
                    ))}
                  </Box>
                }
              >
                <HelpIcon sx={{ color: '#1c86f2', fontSize: 20, cursor: 'help' }} />
              </Tooltip>
              <Button
                variant="contained"
                disableElevation
                startIcon={<EditNoteOutlined />}
                onClick={() => {
                  setTextEditorOpen(true);
                  setTextEditorContent(props.richTextContent || props.content || '');
                  textDefaultRef.current = defaultTextFor(props) || defaultTextByPosition(selectedComponent);
                  // Store the component ID for updating after editing
                  setTextEditorComponentId(selectedComponent);
                }}
                sx={{
                  textTransform: 'none',
                  bgcolor: '#32b643',
                  color: '#fff',
                  fontSize: 16,
                  fontWeight: 400,
                  borderRadius: 0,
                  height: 28,
                  minHeight: 28,
                  py: 0,
                  px: 1.5,
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#2a9d3a', boxShadow: 'none' },
                }}
              >
                Edit Text
              </Button>
            </Box>

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {renderPadding()}

            {renderBorder()}
          </Box>
        )}

        {/* Overview / Credit Terms Component Settings (reference: the same panel) */}
        {(component.type === COMPONENT_TYPES.OVERVIEW || component.type === COMPONENT_TYPES.CREDIT_TERMS) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>
              {component.type === COMPONENT_TYPES.OVERVIEW ? 'Overview' : 'Credit Terms'}
            </Typography>
            
            {renderColour('Font Colour', 'fontColor', '#000000')}

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <FormControl fullWidth size="small">
                <Select
                  MenuProps={REF_MENU_PROPS}
                  value={props.fontSize || 12}
                  onChange={(e) => updateComponentProperty(componentId, 'fontSize', e.target.value)}
                  displayEmpty
                >
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Font Weight */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Weight</Typography>
              <FormControl fullWidth size="small">
                <Select
                  MenuProps={REF_MENU_PROPS}
                  value={props.fontWeight || 'normal'}
                  onChange={(e) => updateComponentProperty(componentId, 'fontWeight', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                  <MenuItem value="lighter">Lighter</MenuItem>
                  <MenuItem value="100">100</MenuItem>
                  <MenuItem value="200">200</MenuItem>
                  <MenuItem value="300">300</MenuItem>
                  <MenuItem value="400">400</MenuItem>
                  <MenuItem value="500">500</MenuItem>
                  <MenuItem value="600">600</MenuItem>
                  <MenuItem value="700">700</MenuItem>
                  <MenuItem value="800">800</MenuItem>
                  <MenuItem value="900">900</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {renderPadding()}

            {renderBorder()}
          </Box>
        )}

        {/* Actions Component Settings */}
        {component.type === COMPONENT_TYPES.ACTIONS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference: single 'Actions' heading — the panel header above owns it. */}

            {/* Column config: reorder / rename / enable (reference parity) */}
            {renderActionColumnConfig(componentId, props)}

            {/* Label overrides */}
            {[
              { key: 'labelPayment', label: 'Payment', fallback: 'Payment' },
              { key: 'labelInvoice', label: 'Invoice', fallback: 'Invoice' },
              { key: 'labelPaidInStore', label: 'Paid in Store', fallback: 'Paid In Store' },
              { key: 'totalDueLabel', label: 'Total Due', fallback: 'Total Due' },
            ].map((f) => (
              <Box key={f.key}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{f.label}</Typography>
                <TextField
                  size="small"
                  value={props[f.key] ?? f.fallback}
                  onChange={(e) => updateComponentProperty(componentId, f.key, e.target.value)}
                  sx={ACTION_LABEL_INPUT_SX}
                />
              </Box>
            ))}

            {renderColour('Font Colour', 'fontColor', '#000000')}

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <FormControl fullWidth size="small">
                <Select
                  MenuProps={REF_MENU_PROPS}
                  value={props.fontSize || 12}
                  onChange={(e) => updateComponentProperty(componentId, 'fontSize', e.target.value)}
                  displayEmpty
                >
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Font Weight */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Weight</Typography>
              <FormControl fullWidth size="small">
                <Select
                  MenuProps={REF_MENU_PROPS}
                  value={props.fontWeight || 'normal'}
                  onChange={(e) => updateComponentProperty(componentId, 'fontWeight', e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="normal">Normal</MenuItem>
                  <MenuItem value="bold">Bold</MenuItem>
                  <MenuItem value="lighter">Lighter</MenuItem>
                  <MenuItem value="100">100</MenuItem>
                  <MenuItem value="200">200</MenuItem>
                  <MenuItem value="300">300</MenuItem>
                  <MenuItem value="400">400</MenuItem>
                  <MenuItem value="500">500</MenuItem>
                  <MenuItem value="600">600</MenuItem>
                  <MenuItem value="700">700</MenuItem>
                  <MenuItem value="800">800</MenuItem>
                  <MenuItem value="900">900</MenuItem>
                </Select>
              </FormControl>
            </Box>

            {renderPadding()}

            {renderBorder()}
          </Box>
        )}

        {/* Spacer Component Settings */}
        {component.type === COMPONENT_TYPES.SPACER && (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Height (px)</Typography>
            <Slider
              value={props.height || 30}
              onChange={(e, value) => updateComponentProperty(componentId, 'height', value)}
              min={10}
              max={200}
              valueLabelDisplay="auto"
            />
          </Box>
        )}

        {/* Image Component Settings */}
        {component.type === COMPONENT_TYPES.IMAGE && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Image Upload Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Image</Typography>
              {props.imageUrl ? (
                <Box sx={{ mb: 2 }}>
                  <img
                    src={props.imageUrl}
                    alt="Preview"
                    style={{
                      width: '100%',
                      maxHeight: '120px',
                      objectFit: 'contain',
                      border: '1px solid #e0e0e0',
                      borderRadius: '4px',
                      backgroundColor: '#f5f5f5'
                    }}
                  />
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => updateComponentProperty(componentId, 'imageUrl', null)}
                    sx={{ mt: 1 }}
                  >
                    Remove Image
                  </Button>
                </Box>
              ) : (
                <Box
                  sx={{
                    border: '2px dashed #ccc',
                    borderRadius: 1,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: '#1976d2',
                      backgroundColor: '#f5f5f5'
                    }
                  }}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          updateComponentProperty(componentId, 'imageUrl', event.target.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    style={{ display: 'none' }}
                    id={`image-upload-${component.id}`}
                  />
                  <Box 
                    onClick={() => {
                      setMediaDialogFor('image');
                      setMediaDialogOpen(true);
                    }}
                    sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, cursor: 'pointer' }}
                  >
                    <ImageIcon sx={{ fontSize: '2rem', color: '#999' }} />
                    <Typography variant="body2" color="text.secondary">
                      Select to Add Image
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>

            {/* Width / Height — reference: label above a square box; Height
                starts blank (blank = natural height). */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Width</Typography>
              <TextField
                size="small"
                value={props.width ?? 'auto'}
                onChange={(e) => updateComponentProperty(componentId, 'width', e.target.value)}
                sx={squareInputSx('100%', 37)}
              />
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Height</Typography>
              <TextField
                size="small"
                value={props.height === 'auto' ? '' : (props.height ?? '')}
                onChange={(e) => updateComponentProperty(componentId, 'height', e.target.value)}
                sx={squareInputSx('100%', 37)}
              />
            </Box>

            {/* Horizontal Alignment */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Horizontal Alignment</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { value: 'flex-start', label: 'Left', icon: '≡' },
                  { value: 'center', label: 'Center', icon: '≡' },
                  { value: 'flex-end', label: 'Right', icon: '≡' }
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant={props.horizontalAlignment === align.value ? 'contained' : 'outlined'}
                    onClick={() => updateComponentProperty(componentId, 'horizontalAlignment', align.value)}
                    sx={{ 
                      flex: 1, 
                      textTransform: 'none',
                      bgcolor: props.horizontalAlignment === align.value ? '#2196F3' : 'transparent',
                      color: props.horizontalAlignment === align.value ? 'white' : 'inherit',
                    }}
                  >
                    {align.icon}
                  </Button>
                ))}
              </Box>
            </Box>

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {renderPadding()}

            {renderBorder()}
          </Box>
        )}

        {/* Outlet Logo Component Settings */}
        {component.type === COMPONENT_TYPES.OUTLET_LOGO && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Remove Image Button */}
            {props.imageUrl && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() => updateComponentProperty(componentId, 'imageUrl', null)}
                sx={{ mb: 1 }}
              >
                Remove Image
              </Button>
            )}

            {/* Image Upload */}
            {!props.imageUrl && (
              <Box>
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setMediaDialogFor('outlet_logo');
                    setMediaDialogOpen(true);
                  }}
                  sx={{ mb: 1 }}
                >
                  Select Image
                </Button>
              </Box>
            )}

            {/* Image Preview */}
            {props.imageUrl && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Preview</Typography>
                <Box
                  sx={{
                    width: '100%',
                    border: '1px solid #ccc',
                    borderRadius: 1,
                    p: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    bgcolor: '#f5f5f5',
                  }}
                >
                  <img
                    src={props.imageUrl}
                    alt="Logo Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 150,
                      objectFit: 'contain',
                    }}
                  />
                </Box>
              </Box>
            )}

            {/* Width */}
            <TextField
              fullWidth
              size="small"
              label="Width"
              value={props.width || 'auto'}
              onChange={(e) => updateComponentProperty(componentId, 'width', e.target.value)}
              placeholder="auto or pixels (e.g. 100)"
            />

            {/* Height */}
            <TextField
              fullWidth
              size="small"
              label="Height"
              value={props.height || 'auto'}
              onChange={(e) => updateComponentProperty(componentId, 'height', e.target.value)}
              placeholder="auto or pixels (e.g. 50)"
            />

            {/* Horizontal Alignment */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Horizontal Alignment</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { value: 'flex-start', label: 'Left', icon: '≡' },
                  { value: 'center', label: 'Center', icon: '≡' },
                  { value: 'flex-end', label: 'Right', icon: '≡' }
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant={props.horizontalAlignment === align.value ? 'contained' : 'outlined'}
                    onClick={() => updateComponentProperty(componentId, 'horizontalAlignment', align.value)}
                    sx={{ 
                      flex: 1, 
                      textTransform: 'none',
                      bgcolor: props.horizontalAlignment === align.value ? '#2196F3' : 'transparent',
                      color: props.horizontalAlignment === align.value ? 'white' : 'inherit',
                    }}
                  >
                    {align.icon}
                  </Button>
                ))}
              </Box>
            </Box>

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {renderPadding()}

            {renderBorder()}
          </Box>
        )}

        {/* Columns Component Settings */}
        {component.type === COMPONENT_TYPES.COLUMNS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Column Widths */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Column Widths</Typography>
              <Grid container spacing={1}>
                {props.columnWidths?.map((width, index) => (
                  <Grid item xs={6} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NumberField
                        int
                        size="small"
                        value={width}
                        onCommit={(n) => {
                          const newWidths = [...(props.columnWidths || [])];
                          newWidths[index] = n;
                          // Ensure total doesn't exceed 100%
                          const total = newWidths.reduce((sum, w) => sum + w, 0);
                          if (total <= 100) {
                            updateComponentProperty(componentId, 'columnWidths', newWidths);
                          }
                        }}
                        inputProps={{ min: 1, max: 99 }}
                        sx={{ flex: 1 }}
                      />
                      <Typography variant="body2">%</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Total: {(props.columnWidths || []).reduce((sum, w) => sum + w, 0)}%
              </Typography>
            </Box>

            {renderPadding()}

            {renderBorder()}

            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}

            {/* Add/Remove Columns */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Manage Columns</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const currentColumns = props.columns || [];
                    const currentWidths = props.columnWidths || [];
                    if (currentColumns.length < 4) { // Max 4 columns
                      const newColumn = { id: `col-${Date.now()}`, components: [] };
                      const newWidth = Math.floor(100 / (currentColumns.length + 1));
                      const newWidths = [...currentWidths, newWidth];
                      // Adjust all widths to maintain equal distribution
                      const adjustedWidths = newWidths.map(() => Math.floor(100 / newWidths.length));
                      updateComponentProperty(componentId, 'columns', [...currentColumns, newColumn]);
                      updateComponentProperty(componentId, 'columnWidths', adjustedWidths);
                    }
                  }}
                  disabled={(props.columns || []).length >= 4}
                  sx={{ flex: 1 }}
                >
                  Add Column
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => {
                    const currentColumns = props.columns || [];
                    const currentWidths = props.columnWidths || [];
                    if (currentColumns.length > 1) { 
                      const newColumns = currentColumns.slice(0, -1);
                      const newWidths = currentWidths.slice(0, -1);
                      const adjustedWidths = newWidths.map(() => Math.floor(100 / newWidths.length));
                      updateComponentProperty(componentId, 'columns', newColumns);
                      updateComponentProperty(componentId, 'columnWidths', adjustedWidths);
                    }
                  }}
                  disabled={(props.columns || []).length <= 1}
                  sx={{ flex: 1 }}
                >
                  Remove Column
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {/* Fallback background for a type with no panel of its own: every type below already
            draws its own Background Colour (Outlet Logo / Overview / Actions showed it twice). */}
        {!['text', 'spacer', 'credit_terms', 'overview', 'actions', 'image', 'outlet_logo', 'columns'].includes(component.type) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderColour('Background Colour', 'backgroundColor', '#ffffff')}
          </Box>
        )}
      </Box>
    );
  };

  const selectedComponentDetails = getSelectedComponentDetails();
  const textEditorProps = (textEditorComponentId && getSelectedComponentDetails(textEditorComponentId)?.component?.properties) || {};

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    // ponytail: subtract DashboardLayout's DrawerHeader spacer (theme.mixins.toolbar:
    // 56px xs / 64px sm+) — plain 100vh here overflows the viewport and pushes the
    // action bar below the fold.
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 50px)',
      overflow: 'hidden',
    }}>
      {/* Top Bar — the receipt editor's: "Statement -" + square name input, centred
          over the canvas column (the 400px panel is discounted). No gear: statements
          have no Configure dialog. */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
          pr: '400px',
          bgcolor: '#f7f7f7',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ color: '#1a1a1a', fontWeight: 500, whiteSpace: 'nowrap' }}>
              Statement -
            </Typography>
            <TextField
              value={template?.name ?? ''}
              onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
              variant="outlined"
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: 'white',
                  borderRadius: 0,
                  height: 37,
                  width: 200,
                  '& fieldset': {
                    borderColor: '#000',
                    borderWidth: '1px',
                  },
                  '&:hover fieldset': {
                    borderColor: '#000',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#000',
                    borderWidth: '1px',
                  },
                },
                '& .MuiInputBase-input': {
                  color: '#000',
                  fontSize: 16,
                  fontWeight: 400,
                },
              }}
            />
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mx: 2, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Statement Canvas */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Receipt editor surround: dark neutral-700, p-8, scrolls; flat paper on it. */}
          <Box sx={{ flex: 1, p: 4, overflow: 'auto', bgcolor: '#404040' }}>
            <Paper
              sx={{
                // Statement paper keeps its own A4 width / height and padding.
                width: `${canvasSettings.width}mm`,
                minHeight: '297mm',
                mx: 'auto',
                p: `${canvasSettings.padding}mm`,
                bgcolor: canvasSettings.backgroundColor,
                border: '1px solid #000',
                borderRadius: 0,
                boxShadow: 'none',
                color: '#000',
                position: 'relative',
                cursor: 'default',
              }}
              onClick={(e) => {
                if (!previewOpen && e.target === e.currentTarget) {
                  selectComponent(null);
                }
              }}
              onDragOver={previewOpen ? undefined : handleDragOver}
              onDrop={previewOpen ? undefined : handleDrop}
            >
              {previewOpen ? (
                // Preview: the same renderer that prints, against the sample data, with
                // none of the editor chrome (zones, outlines, toolbars, drop targets).
                <StatementRenderer
                  statementData={mockStatementData}
                  template={{ config: { components: statementComponents } }}
                />
              ) : (
                <>
                  {/* Reference parity: fixed Header / Footer zones, open body between */}
                  {renderZone('header', 'Header', true)}
                  {renderZone('body', 'Body', false)}
                  {renderZone('footer', 'Footer', true)}
                </>
              )}
            </Paper>
          </Box>
        </Box>

        {/* Sidebar with Tabs — the receipt editor's 400px panel */}
        <Paper sx={{ width: 400, borderRadius: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab Header — receipt: no container rule; active tab black on neutral-200
              with the 4px blue-500 underline, inactive/disabled neutral-500. */}
          <Box sx={{ bgcolor: '#f8f9fa' }}>
            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                minHeight: 64,
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 400,
                  minHeight: 64,
                  py: 2,
                  fontSize: '1.125rem',
                  gap: '8px',
                  color: '#737373',
                  bgcolor: 'transparent',
                  '& .MuiSvgIcon-root': { fontSize: 20, marginBottom: 0 },
                  '&.Mui-selected': {
                    color: '#000',
                    fontWeight: 400,
                    bgcolor: '#e5e5e5',
                  },
                  '&.Mui-disabled': {
                    cursor: 'not-allowed',
                    pointerEvents: 'auto',
                    backgroundColor: 'transparent',
                    color: '#737373',
                    opacity: 1,
                  },
                },
                '& .MuiTabs-indicator': {
                  height: 4,
                  backgroundColor: '#3b82f6',
                }
              }}
            >
              <Tab label="Components" icon={<WidgetsOutlined />} iconPosition="start" />
              <Tab label="Settings" icon={<SettingsOutlined />} iconPosition="start" disabled={!selectedComponent} />
            </Tabs>
          </Box>

          {/* Tab Content — white panel; the tiles are transparent on it. */}
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fff' }}>
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                <Grid container spacing={1.5}>
                  {AVAILABLE_COMPONENTS.map((comp) => (
                    <Grid item xs={4} key={comp.type}>
                      <Card
                        // Visible but inert while previewing: nothing can be added or dragged.
                        draggable={!previewOpen}
                        onClick={() => { if (!previewOpen) handleAddComponent(comp.type); }}
                        onDragStart={(e) => { if (previewOpen) { e.preventDefault(); return; } handleDragStart(e, comp.type, true); }}
                        onDragEnd={handleDragEnd}
                        sx={{
                          cursor: previewOpen ? 'default' : 'pointer',
                          transition: 'none',
                          boxShadow: 'none',
                          '&:hover': {
                            bgcolor: previewOpen ? 'transparent' : '#ebebeb',
                          },
                          // Receipt tile: 96x96 square, transparent, 1px #ddd, radius 4.
                          width: 96,
                          height: 96,
                          mx: 'auto',
                          bgcolor: 'transparent',
                          border: '1px solid #ddd',
                          opacity: draggedFromPalette === comp.type ? 0.5 : 1,
                          borderRadius: 1,
                        }}
                      >
                        <CardContent sx={{
                          p: 0.5,
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          '&:last-child': { pb: 0.5 }
                        }}>
                          <Box sx={{
                            mb: 0.5,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 27,
                            height: 27,
                            color: '#676b72'
                          }}>
                            <comp.Icon sx={{ fontSize: 27 }} />
                          </Box>
                          <Typography variant="caption" sx={{
                            fontSize: '1rem',
                            lineHeight: 1.15,
                            color: '#000',
                            fontWeight: 400
                          }}>
                            {comp.label}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            )}
            {activeTab === 1 && (
              <Box
                sx={{
                  p: 2,
                  // Receipt Settings inputs/selects: radius 8, #404040 1px notch, #000 2px focus.
                  '& .MuiOutlinedInput-root': { borderRadius: '8px' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
                  '& .MuiInputBase-input::placeholder': { color: '#808080', opacity: 1 },
                }}
              >
                {renderPropertiesPanel()}
              </Box>
            )}
          </Box>

          {/* Bottom controls — the receipt's: one right-aligned group (Preview · Cancel ·
              Save) at the foot of the panel, 16px padding, 1px solid black top rule. */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 1,
              p: 2,
              borderTop: '1px solid #000',
            }}
          >
            <Button
              disableRipple
              disableFocusRipple
              // A mouse click must not leave the keyboard focus ring (double blue
              // outline) on the toggle; Tab focus still shows it.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                // Entering Preview drops the selection, so the panel shows Components.
                if (!previewOpen) selectComponent(null);
                setPreviewOpen((v) => !v);
              }}
              sx={{
                borderRadius: 0,
                bgcolor: '#f8f8f8',
                color: '#676b72',
                border: '1px solid #676b72',
                fontSize: 18,
                fontWeight: 400,
                textTransform: 'none',
                minHeight: 32,
                height: 32,
                p: '4px 8px',
                '&:hover': { bgcolor: '#eee' },
              }}
            >
              {previewOpen ? 'Edit' : 'Preview'}
            </Button>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                onClick={handleCancel}
                sx={{
                  borderRadius: 0,
                  bgcolor: '#f8f8f8',
                  color: '#676b72',
                  border: '1px solid #676b72',
                  fontSize: 18,
                  fontWeight: 400,
                  textTransform: 'none',
                  minHeight: 32,
                  height: 32,
                  p: '4px 8px',
                  '&:hover': { bgcolor: '#eee' },
                }}
              >
                Cancel
              </Button>
              <Button
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
                sx={{
                  borderRadius: 0,
                  bgcolor: '#1c86f2',
                  color: '#f8f8f8',
                  border: '1px solid #f8f8f8',
                  fontSize: 18,
                  fontWeight: 400,
                  textTransform: 'none',
                  minHeight: 32,
                  height: 32,
                  p: '4px 8px',
                  '&:hover': { bgcolor: '#1670d0' },
                  '&:disabled': { bgcolor: '#9dc7f5', color: '#f0f0f0' },
                }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Text Editor Dialog — reference statement editor: ~915px square white paper,
          no title, the toolbar is the top row; a plain ~350px body; Cancel / Save as
          two equal full-width square buttons under a thin rule. */}
      {selectedComponentDetails?.component?.type === COMPONENT_TYPES.TEXT && (
        <Dialog
          open={textEditorOpen}
          TransitionProps={{ onEntered: refreshToolState }}
          onClose={() => setTextEditorOpen(false)}
          maxWidth={false}
          PaperProps={{
            // Width follows the content (reference: ~915 / 1047 / 1350px for the
            // Header / Address / Footer blocks): long lines grow the paper, up to 90vw.
            sx: { width: 'auto', minWidth: 900, maxWidth: '90vw', borderRadius: 0, bgcolor: '#fff', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', m: 2 },
          }}
        >
          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar: one flat row of borderless icons (Configure Statement family). */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                flexWrap: 'wrap',
                minHeight: 44,
                px: 1,
                py: '4px',
                borderBottom: '1px solid #000',
                bgcolor: '#fff',
                '& .MuiIconButton-root': { p: '5px', color: '#313439', borderRadius: 0 },
                '& .MuiIconButton-root.Mui-disabled': { color: '#bdbdbd' },
                '& .MuiIconButton-root.tool-active': { outline: '1px solid #9e9e9e', outlineOffset: '-1px' },
                '& .MuiSvgIcon-root': { fontSize: 18 },
              }}
            >
              <IconButton title="Bold" className={toolState.bold ? 'tool-active' : undefined} onClick={() => execCommand('bold')}><FormatBoldOutlined /></IconButton>
              <IconButton title="Italic" onClick={() => execCommand('italic')}><FormatItalicOutlined /></IconButton>
              <IconButton title="Underline" onClick={() => execCommand('underline')}><FormatUnderlinedOutlined /></IconButton>
              <IconButton title="Strikethrough" onClick={() => execCommand('strikeThrough')}><StrikethroughSOutlined /></IconButton>
              <IconButton title="Insert Curly Braces" onClick={() => insertText('{}')}><DataObjectOutlined /></IconButton>
              <IconButton title="Superscript" onClick={() => insertHTML('<sup>2</sup>')}><SuperscriptOutlined /></IconButton>
              <IconButton title="Subscript" onClick={() => insertHTML('<sub>2</sub>')}><SubscriptOutlined /></IconButton>

              <Box sx={{ width: 4 }} />

              <Select
                size="small"
                defaultValue="Normal"
                MenuProps={REF_MENU_PROPS}
                sx={{ width: 110, height: 30, bgcolor: '#fff', borderRadius: 0, fontSize: 14, '& .MuiOutlinedInput-notchedOutline': { borderColor: '#bdbdbd' } }}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'Heading 1') {
                    execCommand('formatBlock', 'h1');
                  } else if (value === 'Heading 2') {
                    execCommand('formatBlock', 'h2');
                  } else {
                    execCommand('formatBlock', 'p');
                  }
                }}
              >
                <MenuItem value="Normal">Normal</MenuItem>
                <MenuItem value="Heading 1">Heading 1</MenuItem>
                <MenuItem value="Heading 2">Heading 2</MenuItem>
              </Select>
              <Select
                size="small"
                defaultValue="5"
                MenuProps={REF_MENU_PROPS}
                sx={{
                  minWidth: 40, height: 30, bgcolor: '#fff', borderRadius: 0, fontSize: 14,
                  '& .MuiSelect-select': { pl: '6px', pr: '20px !important' },
                  '& .MuiSelect-icon': { right: 0 },
                  '& .MuiOutlinedInput-notchedOutline': { border: 0 },
                }}
                onChange={(e) => execCommand('fontSize', e.target.value)}
              >
                <MenuItem value="1">8</MenuItem>
                <MenuItem value="2">10</MenuItem>
                <MenuItem value="3">12</MenuItem>
                <MenuItem value="4">14</MenuItem>
                <MenuItem value="5">16</MenuItem>
                <MenuItem value="6">18</MenuItem>
                <MenuItem value="7">20</MenuItem>
                <MenuItem value="8">24</MenuItem>
              </Select>

              <Box sx={{ width: 4 }} />

              {/* Reference order: lists, then indent, then alignment. */}
              <IconButton title="Bulleted List" onClick={() => execCommand('insertUnorderedList')}><FormatListBulletedOutlined /></IconButton>
              <IconButton title="Numbered List" onClick={() => execCommand('insertOrderedList')}><FormatListNumberedOutlined /></IconButton>
              <IconButton title="Increase Indent" onClick={() => execCommand('indent')}><FormatIndentIncreaseOutlined /></IconButton>
              <IconButton title="Decrease Indent" disabled={!toolState.canOutdent} onClick={() => execCommand('outdent')}><FormatIndentDecreaseOutlined /></IconButton>

              <Box sx={{ width: 4 }} />

              <IconButton title="Align Left" className={toolState.justifyLeft ? 'tool-active' : undefined} onClick={() => execCommand('justifyLeft')}><FormatAlignLeftOutlined /></IconButton>
              <IconButton title="Align Center" className={toolState.justifyCenter ? 'tool-active' : undefined} onClick={() => execCommand('justifyCenter')}><FormatAlignCenterOutlined /></IconButton>
              <IconButton title="Align Right" className={toolState.justifyRight ? 'tool-active' : undefined} onClick={() => execCommand('justifyRight')}><FormatAlignRightOutlined /></IconButton>
              <IconButton title="Justify" className={toolState.justifyFull ? 'tool-active' : undefined} onClick={() => execCommand('justifyFull')}><FormatAlignJustifyOutlined /></IconButton>

              <Box sx={{ width: 4 }} />

              <IconButton
                title="Text Color"
                onClick={async () => {
                  const color = await prompt('Enter colour (e.g. #ff0000 or red):', '#000000', { title: 'Text colour' });
                  if (color) execCommand('foreColor', color);
                }}
              >
                <EditOutlined />
              </IconButton>
              <IconButton title="Insert Link" onClick={insertLink}><LinkIcon /></IconButton>
              <IconButton title="Remove Link" disabled={!toolState.canUnlink} onClick={() => execCommand('unlink')}><LinkOffIcon /></IconButton>
              <IconButton
                title="Insert Image"
                onClick={async () => {
                  const url = await prompt('Enter image URL:', 'https://', { title: 'Insert image', confirmText: 'Insert image' });
                  if (url) insertHTML(`<img src="${url}" alt="Image" style="max-width: 100%; height: auto;" />`);
                }}
              >
                <Box component="span" aria-hidden sx={{ fontSize: 16, lineHeight: 1 }}>🖼️</Box>
              </IconButton>
              <IconButton title="Undo" disabled={!toolState.canUndo} onClick={() => execCommand('undo')}><UndoOutlined /></IconButton>
              <IconButton title="Redo" disabled={!toolState.canRedo} onClick={() => execCommand('redo')}><RedoOutlined /></IconButton>
            </Box>

            {/* Body: plain white, no inner box. Seeded once on open (see the effect
                above) and then left uncontrolled, so typing never resets the caret. */}
            <Box
              ref={setTextEditorRef}
              sx={{
                // Reference: a fixed ~350px body however short the text; longer
                // text scrolls inside it.
                height: 350,
                boxSizing: 'border-box',
                p: 2,
                bgcolor: '#ffffff',
                // The block's own formatting, as it prints on the statement.
                fontSize: `${textEditorProps.fontSize || 16}px`,
                fontWeight: textEditorProps.fontWeight || 'normal',
                color: textEditorProps.fontColor || '#000000',
                textAlign: textEditorProps.textAlign || 'left',
                overflow: 'auto',
                outline: 'none',
              }}
              contentEditable
              suppressContentEditableWarning
              // No red spell-check squiggles under {placeholders} (reference shows none).
              spellCheck={false}
              onInput={(e) => { setTextEditorContent(e.currentTarget.innerHTML); refreshToolState(); }}
              onKeyUp={refreshToolState}
              onMouseUp={refreshToolState}
              onKeyDown={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  switch (e.key) {
                    case 'b':
                      e.preventDefault();
                      execCommand('bold');
                      break;
                    case 'i':
                      e.preventDefault();
                      execCommand('italic');
                      break;
                    case 'u':
                      e.preventDefault();
                      execCommand('underline');
                      break;
                    case 'z':
                      e.preventDefault();
                      if (e.shiftKey) {
                        execCommand('redo');
                      } else {
                        execCommand('undo');
                      }
                      break;
                  }
                }
              }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2, gap: 2, borderTop: '1px solid #000', '& > :not(:first-of-type)': { ml: 0 } }}>
            <Button
              disableRipple
              onClick={() => setTextEditorOpen(false)}
              sx={{
                flex: 1, height: 48, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', borderRadius: 0,
                fontSize: 32, fontWeight: 400, lineHeight: 1, textTransform: 'none', boxShadow: 'none', p: '4px 8px',
                '&:hover': { bgcolor: '#676b72', color: '#f8f8f8', boxShadow: 'none' },
              }}
            >
              Cancel
            </Button>
            <Button
              disableRipple
              onClick={() => {
                if (textEditorComponentId) {
                  // Cleared and saved: the block's default wording comes back.
                  const fallback = textDefaultRef.current;
                  const html = isBlankRichText(textEditorContent) && fallback ? fallback : textEditorContent;
                  updateComponentProperty(textEditorComponentId, 'richTextContent', html);
                  updateComponentProperty(textEditorComponentId, 'content', html.replace(/<[^>]*>/g, ''));
                  // Remember the default so it survives later edits of the wording.
                  if (fallback) updateComponentProperty(textEditorComponentId, 'defaultText', fallback);
                }
                setTextEditorOpen(false);
                setTextEditorComponentId(null);
              }}
              sx={{
                flex: 1, height: 48, bgcolor: '#1c86f2', color: '#f8f8f8', border: '1px solid #f8f8f8', borderRadius: 0,
                fontSize: 32, fontWeight: 400, lineHeight: 1, textTransform: 'none', boxShadow: 'none', p: '4px 8px',
                '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
              }}
            >
              Save
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Link Dialog */}
      {selectedComponentDetails?.component?.type === COMPONENT_TYPES.TEXT && (
        <Dialog
          open={linkDialogOpen}
          onClose={() => setLinkDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: { 
              borderRadius: 2,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
            }
          }}
        >
          <DialogTitle>Insert Link</DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Link Title
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter link title"
                  value={linkData.title}
                  onChange={(e) => setLinkData({ ...linkData, title: e.target.value })}
                />
              </Box>

              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Link Target
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Enter URL (e.g., https://example.com)"
                  value={linkData.target}
                  onChange={(e) => setLinkData({ ...linkData, target: e.target.value })}
                />
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={linkData.openInNewWindow}
                    onChange={(e) => setLinkData({ ...linkData, openInNewWindow: e.target.checked })}
                  />
                }
                label="Open in new window"
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3, pt: 0 }}>
            <Button onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleLinkSubmit}
              disabled={!linkData.title || !linkData.target}
            >
              Insert Link
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Unsaved-changes prompt — shared with the receipt editor: title "Save", body
          "Save <name>?", and Yes / No / Cancel. */}
      <SavePromptDialog
        open={leavePrompt}
        name={template?.name || 'statement'}
        saving={saving}
        onYes={async () => {
          const ok = await handleSave();
          setLeavePrompt(false);
          if (!ok) return;
          pendingLeaveRef.current?.();
          pendingLeaveRef.current = null;
        }}
        onNo={() => {
          setLeavePrompt(false);
          // Discard, so the guard has nothing left to hold on to. Marked clean before
          // proceeding: the guard releases its history trap on the render that follows.
          savedSnapshot.current = snapshotOf(statementComponents, template?.name);
          pendingLeaveRef.current?.();
          pendingLeaveRef.current = null;
        }}
        onCancel={() => setLeavePrompt(false)}
      />

      {/* Edit Border -> Border Settings (Simple / Advanced, per side), shared with the receipt editor. */}
      <BorderSettingsDialog
        open={Boolean(borderDialog)}
        value={borderDialog?.value}
        onCancel={() => setBorderDialog(null)}
        onUpdate={(border) => {
          borderDialog?.apply(border);
          setBorderDialog(null);
        }}
      />

      {/* Media Dialog */}
      <MediaDialog
        open={mediaDialogOpen}
        onClose={() => {
          setMediaDialogOpen(false);
          setMediaDialogFor(null);
        }}
        onSelect={(imageUrl) => {
          if (selectedComponent && mediaDialogFor) {
            updateComponentProperty(selectedComponent, 'imageUrl', imageUrl);
          }
        }}
        accept="image/*"
      />
    </Box>
  );
};

export default StatementEditor;
