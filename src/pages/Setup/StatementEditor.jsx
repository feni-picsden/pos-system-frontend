import React, { useState, useEffect, useRef } from 'react';
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
  Divider,
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  Cancel as CancelIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  Edit as EditIcon,
  Add as AddIcon,
  DragIndicator as DragIcon,
  OpenWithOutlined as MoveIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  AttachMoney as DollarIcon,
  CalendarToday as CalendarIcon,
  Image as ImageIcon,
  TextFields as TextIcon,
  ViewColumn as ColumnsIcon,
  Height as SpacerIcon,
  Close as CloseIcon,
  HelpOutlineOutlined as HelpIcon,
  LinkOffOutlined as LinkOffIcon,
  RedeemOutlined as ComponentsTabIcon,
  GridOnOutlined as ActionsGridIcon,
  ArrowUpwardOutlined as ArrowUpIcon,
  ArrowDownwardOutlined as ArrowDownIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import MediaDialog from '../../components/Common/MediaDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import StatementRenderer from '../../components/Statement/StatementRenderer';
import {
  buildDefaultStatementComponents,
  applyStatementVariables,
  getActionColumns,
  ACTION_COLUMN_WIDTHS,
} from '../../utils/statementDefaults';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

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
  { type: COMPONENT_TYPES.OVERVIEW, label: 'Overview', icon: <DollarIcon />, description: 'Financial overview' },
  { type: COMPONENT_TYPES.ACTIONS, label: 'Actions', icon: <ActionsGridIcon />, description: 'Action buttons' },
  { type: COMPONENT_TYPES.CREDIT_TERMS, label: 'Credit Terms', icon: <CalendarIcon />, description: 'Credit terms info' },
  { type: COMPONENT_TYPES.OUTLET_LOGO, label: 'Outlet Logo', icon: <ImageIcon />, description: 'Business logo' },
  { type: COMPONENT_TYPES.TEXT, label: 'Text', icon: <Box component="span" sx={{ fontSize: '1.3rem', fontWeight: 700, lineHeight: 1 }}>A</Box>, description: 'Custom text' },
  { type: COMPONENT_TYPES.IMAGE, label: 'Image', icon: <ImageIcon />, description: 'Custom image' },
  { type: COMPONENT_TYPES.COLUMNS, label: 'Columns', icon: <ColumnsIcon />, description: 'Column layout' },
  { type: COMPONENT_TYPES.SPACER, label: 'Spacer', icon: <SpacerIcon />, description: 'Vertical spacing' },
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
const ACTION_COLUMN_INPUT_SX = squareInputSx(215, 37);
const ACTION_LABEL_INPUT_SX = squareInputSx(353, 53);

// Reference prints activity/detail through renameable labels.
const actionLabels = (props = {}) => ({
  Invoice: props.labelInvoice || 'Invoice',
  Payment: props.labelPayment || 'Payment',
  'Paid in Store': props.labelPaidInStore || 'Paid in Store',
});

// ponytail: running total = cumulative transaction amount within a group; the
// mock/live rows carry no server-side running column.
const money = (v) => parseFloat(String(v).replace(/[^0-9.-]/g, '')) || 0;

// Mock service - replace with actual API service
const statementTemplateService = {
  getTemplate: async (id) => {
    // Mock implementation - in real app, this would fetch from API
    const stored = localStorage.getItem('statementTemplates');
    if (stored) {
      const templates = JSON.parse(stored);
      const template = templates.find(t => t.id === parseInt(id));
      if (template) {
        return { template };
      }
    }
    return { template: { id: parseInt(id), name: 'Statement', config: {} } };
  },
  updateTemplateConfig: async (id, config) => {
    // Mock implementation - in real app, this would PUT to API
    const stored = localStorage.getItem('statementTemplates');
    if (stored) {
      const templates = JSON.parse(stored);
      const index = templates.findIndex(t => t.id === parseInt(id));
      if (index !== -1) {
        templates[index] = { ...templates[index], config, lastModified: new Date().toISOString() };
        localStorage.setItem('statementTemplates', JSON.stringify(templates));
        return { success: true };
      }
    }
    return { success: true };
  },
  createTemplate: async (data) => {
    // Mock implementation - in real app, this would POST to API
    const newTemplate = { 
      id: Date.now(), 
      ...data,
      config: data.config || { components: [], canvas: {} }
    };
    const stored = localStorage.getItem('statementTemplates');
    const templates = stored ? JSON.parse(stored) : [];
    templates.push(newTemplate);
    localStorage.setItem('statementTemplates', JSON.stringify(templates));
    return { template: newTemplate };
  },
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
  const [previewOpen, setPreviewOpen] = useState(false);

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
  const [textEditorComponentId, setTextEditorComponentId] = useState(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkData, setLinkData] = useState({
    title: '',
    target: '',
    openInNewWindow: false
  });
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaDialogFor, setMediaDialogFor] = useState(null); // 'image' or 'outlet_logo'
  
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
      phone: 'ph: (02) 9606 6476',
      abn: 'ABN: 69 645 353 886',
    },
    customer: {
      code: '1234',
      name: 'Shopfront',
      contact: 'John Smith',
      address: '425 Smith St',
      city: 'Fitzroy 3065 VIC',
    },
    summary: {
      days0: { days: '0 days', amount: '$0.00' },
      days30: { days: '30 days', amount: '$0.00' },
      dateRange: '11/04/2012 - 11/05/2012',
      overdue: '$0.00',
      current: '$0.00',
      total: '$0.00',
    },
    activities: [
      { 
        category: '30 days',
        transactions: [
          { date: '10/04/2012', activity: 'Invoice', reference: '#00001013', total: '$52.00', balance: '$0.00' },
          { date: '11/04/2012', activity: 'Payment', reference: '#00001013', detail: 'Paid in Store', total: '$52.00', balance: '$0.00' },
        ]
      },
      { 
        category: 'Current',
        transactions: [
          { date: '10/05/2012', activity: 'Invoice', reference: '#00001014', total: '$52.00', balance: '$0.00' },
          { date: '10/05/2012', activity: 'Payment', reference: '#00001014', detail: 'Paid in Store', total: '$52.00', balance: '$0.00' },
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
      setStatementComponents(buildDefaultStatementComponents());
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await statementTemplateService.getTemplate(templateId);
      setTemplate(response.template);
      
      if (response.template.config && response.template.config.components && response.template.config.components.length > 0) {
        setStatementComponents(response.template.config.components);
      } else {
        // Reference parity: never open a blank canvas — seed the default design.
        setStatementComponents(buildDefaultStatementComponents());
      }
      
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
      setSaving(true);
      
      const configData = {
        components: statementComponents,
        canvas: canvasSettings,
        lastModified: new Date().toISOString()
      };

      if (templateId && templateId !== 'new') {
        await statementTemplateService.updateTemplateConfig(templateId, configData);
      } else {
        const newTemplate = await statementTemplateService.createTemplate({
          ...template,
          config: configData
        });
        navigate(`/setup/statements/${newTemplate.template.id}/edit`, { replace: true });
      }
      
      setError('');
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save statement template');
    } finally {
      setSaving(false);
    }
  };

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
      case COMPONENT_TYPES.OVERVIEW:
        return { 
          ...baseProperties,
          fontColor: '#000000',
          fontSize: 12,
          fontWeight: 'normal',
          showDays0: true, 
          showDays30: true, 
          showDateRange: true, 
          showTotals: true 
        };
      case COMPONENT_TYPES.ACTIONS:
        return { 
          ...baseProperties,
          showButtons: true 
        };
      case COMPONENT_TYPES.CREDIT_TERMS:
        return { 
          ...baseProperties,
          terms: 'Net 30' 
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
          height: 'auto',
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
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
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

  const renderComponent = (component, index) => {
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
          border: '1px dashed #ccc',
          cursor: 'pointer',
          mb: 1,
          pt: isSelected ? 3 : 0,
          '&:hover': {
            borderColor: isSelected ? '#1976d2' : '#999',
          },
        }}
      >
        {/* Component Header - Overlay on top when selected */}
        {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              bgcolor: '#313439',
              color: 'white',
              fontSize: '0.75rem',
              py: 0.5,
              px: 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <MoveIcon sx={{ fontSize: '1rem' }} />
              <Typography variant="caption">
                {AVAILABLE_COMPONENTS.find(c => c.type === component.type)?.label || component.type}
              </Typography>
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent(component.id);
                }}
                sx={{ color: 'inherit', p: 0.25 }}
              >
                <SettingsIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteComponent(component.id);
                }}
                sx={{ color: 'inherit', p: 0.25 }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  selectComponent(null);
                }}
                sx={{ color: 'inherit', p: 0.25 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}

        {/* Component Content */}
        {component.visible !== false && (
          <Box sx={{ p: 0, minHeight: 20 }}>
            <Box
              sx={{
                bgcolor: component.properties?.backgroundColor || '#ffffff',
                p: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
                border: component.properties?.border?.enabled 
                  ? `${component.properties.border.width || 1}px ${component.properties.border.style || 'solid'} ${component.properties.border.color || '#000000'}`
                  : 'none',
                borderRadius: 1,
              }}
            >
              {renderComponentContent(component, index)}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  // Render a canvas region. Header/Footer are labelled bordered zones (reference
  // parity); the body flows open between them. Components are placed by `zone`.
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
          mb: zoneKey === 'footer' ? 0 : 2,
          ...(boxed ? { border: '1px solid #333', p: 1.5 } : {}),
        }}
      >
        {boxed && (
          <Typography sx={{ fontWeight: 700, fontSize: '18.72px', mb: 1, color: '#000000' }}>
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
                {renderComponent(component, index)}
              </Box>
            );
          })
        )}
      </Box>
    );
  };

  const renderComponentContent = (component, index) => {
    switch (component.type) {
      case COMPONENT_TYPES.OVERVIEW: {
        const s = mockStatementData.summary;
        const font = component.properties?.fontSize || 16;
        const color = component.properties?.fontColor || '#000000';
        // Reference: two stacked boxes with an OUTER border only — no internal
        // vertical dividers and no rule under the date range.
        const cell = (label, value) => (
          <Box key={label} sx={{ flex: 1, textAlign: 'center', px: 0.5, py: 0.5 }}>
            <Typography sx={{ fontSize: `${font}px`, fontWeight: 700, color, lineHeight: 1.4 }}>{label}</Typography>
            <Typography sx={{ fontSize: `${font}px`, color, lineHeight: 1.4 }}>{value}</Typography>
          </Box>
        );
        const row = { display: 'flex' };
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.width ? `${component.properties.border.width}px ${component.properties.border.style || 'solid'} ${component.properties.border.color || '#000000'}` : 'none',
            }}
          >
            <Box sx={{ border: '1px solid #000', mb: '4px', ...row }}>
              {cell(s.days0.days, s.days0.amount)}
              {cell(s.days30.days, s.days30.amount)}
            </Box>
            <Box sx={{ border: '1px solid #000' }}>
              <Typography sx={{ fontSize: `${font}px`, color, textAlign: 'center', py: '3px' }}>
                {s.dateRange}
              </Typography>
              <Box sx={row}>
                {cell('Overdue', s.overdue)}
                {cell('Current', s.current)}
                {cell('Total', s.total)}
              </Box>
            </Box>
          </Box>
        );
      }

      case COMPONENT_TYPES.ACTIONS: {
        // Reference: a PLAIN table — no title bar, no chrome. Header rule only,
        // no vertical gridlines, no fills; ALL columns left-aligned.
        const props = component.properties || {};
        const font = props.fontSize || 14;
        const color = props.fontColor || '#000000';
        const cols = getActionColumns(props).filter((c) => c.enabled !== false);
        const labels = actionLabels(props);
        const cellValue = (key, t, running) => {
          switch (key) {
            case 'date': return t.date;
            case 'activity': return labels[t.activity] || t.activity;
            case 'reference': return `${t.reference}${t.detail ? ` ${labels[t.detail] || t.detail}` : ''}`;
            case 'total': return t.total;
            case 'balance': return t.balance;
            case 'runningTotal': return `$${running.toFixed(2)}`;
            default: return '';
          }
        };
        // Reference row height is ~13-14px (~110px for the whole table).
        const cellSx = { border: 0, py: 0, px: '4px', fontSize: `${font}px`, color, lineHeight: 1.25 };
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.width ? `${component.properties.border.width}px ${component.properties.border.style || 'solid'} ${component.properties.border.color || '#000000'}` : 'none',
            }}
          >
            <TableContainer>
              <Table size="small" sx={{ borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow>
                    {cols.map((h) => (
                      <TableCell
                        key={h.key}
                        align="left"
                        sx={{ ...cellSx, width: ACTION_COLUMN_WIDTHS[h.key], fontWeight: 700, borderBottom: '1px solid #000' }}
                      >
                        {h.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockStatementData.activities.map((category, catIndex) => (
                    <React.Fragment key={catIndex}>
                      <TableRow>
                        <TableCell colSpan={cols.length} sx={{ ...cellSx, fontWeight: 700 }}>
                          {category.category}
                        </TableCell>
                      </TableRow>
                      {category.transactions.map((transaction, transIndex) => {
                        const running = category.transactions
                          .slice(0, transIndex + 1)
                          .reduce((sum, t) => sum + money(t.total), 0);
                        return (
                          <TableRow key={transIndex}>
                            {cols.map((c) => (
                              <TableCell key={c.key} align="left" sx={cellSx}>
                                {cellValue(c.key, transaction, running)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {component.properties?.showTotalDue !== false && (
              <Typography sx={{ textAlign: 'right', fontSize: `${font + 7}px`, color, pr: '4px', py: '1px', lineHeight: 1.2 }}>
                {`${component.properties?.totalDueLabel || 'Total Due'} ${mockStatementData.summary.total}`}
              </Typography>
            )}
          </Box>
        );
      }


      case COMPONENT_TYPES.CREDIT_TERMS:
        return (
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>Credit Terms</Typography>
            <Typography variant="body2">{component.properties?.terms || 'Net 30'}</Typography>
          </Box>
        );
      
      case COMPONENT_TYPES.OUTLET_LOGO:
        return (
          <Box
            sx={{
              display: 'flex',
              justifyContent: component.properties?.horizontalAlignment || 'center',
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: `${component.properties?.border?.width || 0}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`,
              minHeight: 60,
              alignItems: 'center',
            }}
          >
            {component.properties?.imageUrl ? (
              <img
                src={component.properties.imageUrl}
                alt="Outlet Logo"
                style={{
                  width: component.properties?.width === 'auto' ? 'auto' : `${component.properties?.width}px`,
                  height: component.properties?.height === 'auto' ? 'auto' : `${component.properties?.height}px`,
                  maxWidth: '100%',
                  maxHeight: '300px',
                }}
              />
            ) : (
              // Reference sets the header height with a 319x319 logo — the empty
              // placeholder reserves the same square so the header region matches.
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 319,
                  height: 319,
                  maxWidth: '100%',
                  color: '#999',
                  fontSize: '0.8rem',
                  gap: 1,
                }}
              >
                <ImageIcon sx={{ fontSize: '2rem' }} />
                <Typography variant="caption" color="text.secondary">
                  Outlet Logo component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case COMPONENT_TYPES.TEXT:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 16}px`,
              fontWeight: component.properties?.fontWeight || 'normal',
              color: component.properties?.fontColor || '#000000',
              textAlign: component.properties?.textAlign || 'left',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {component.properties?.content || component.properties?.richTextContent ? (
              <Box
                sx={{
                  width: '100%',
                  fontSize: 'inherit',
                  color: 'inherit',
                  textAlign: 'inherit',
                  fontWeight: 'inherit',
                }}
                dangerouslySetInnerHTML={{
                  __html: applyStatementVariables(
                    component.properties?.richTextContent || component.properties?.content || '',
                    mockStatementData.customer,
                    mockStatementData.business
                  ),
                }}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#999',
                  fontSize: '0.8rem',
                  gap: 1,
                  width: '100%',
                }}
              >
                <TextIcon sx={{ fontSize: '2rem' }} />
                <Typography variant="caption" color="text.secondary">
                  Text component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case COMPONENT_TYPES.IMAGE:
        return (
          <Box
            sx={{
              display: 'flex',
              justifyContent: component.properties?.horizontalAlignment || 'center',
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: `${component.properties?.border?.width || 0}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`,
              minHeight: 60,
              alignItems: 'center',
            }}
          >
            {component.properties?.imageUrl ? (
              <img
                src={component.properties.imageUrl}
                alt="Custom Image"
                style={{
                  width: component.properties?.width === 'auto' ? 'auto' : `${component.properties?.width}px`,
                  height: component.properties?.height === 'auto' ? 'auto' : `${component.properties?.height}px`,
                  maxWidth: '100%',
                  maxHeight: '100px',
                }}
              />
            ) : (
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  color: '#999',
                  fontSize: '0.8rem',
                  gap: 1,
                }}
              >
                <ImageIcon sx={{ fontSize: '2rem' }} />
                <Typography variant="caption" color="text.secondary">
                  Image component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      
      case COMPONENT_TYPES.COLUMNS:
        return (
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: `${component.properties?.border?.width || 0}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`,
              minHeight: 100,
            }}
          >
            {component.properties?.columns?.map((column, colIndex) => (
              <Box
                key={column.id}
                sx={{
                  // flex-basis + gap so the columns fill the wrapper exactly;
                  // width:% + margin overflowed it by the gap width.
                  flex: `1 1 ${component.properties?.columnWidths?.[colIndex] || 50}%`,
                  minWidth: 0,
                  border: isDragging ? '2px dashed #2196F3' : '1px dashed #ddd',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#999',
                  fontSize: '0.8rem',
                  position: 'relative',
                  backgroundColor: isDragging ? '#f0f8ff' : 'transparent',
                  transition: 'all 0.2s ease',
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
                {column.components && column.components.length > 0 ? (
                  <Box sx={{ p: 1, width: '100%' }}>
                    {column.components.map((nestedComp, nestedIndex) => {
                      const nestedComponentId = createNestedComponentId(component.id, column.id, nestedIndex);
                      const isNestedSelected = selectedComponent === nestedComponentId;
                      
                      return (
                        <Box 
                          key={nestedIndex} 
                          sx={{ 
                            width: '100%', 
                            mb: 1,
                            border: '1px solid #e0e0e0',
                            borderRadius: 1,
                            bgcolor: isNestedSelected ? '#f0f8ff' : '#fafafa',
                            cursor: 'pointer',
                            position: 'relative',
                            pt: isNestedSelected ? 3 : 0,
                            '&:hover': {
                              borderColor: isNestedSelected ? '#1976d2' : '#999',
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            selectComponent(nestedComponentId);
                          }}
                        >
                          {/* Component Header - Overlay on top when selected */}
                          {isNestedSelected && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: -2,
                                right: -2,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: '#313439',
                                color: 'white',
                                fontSize: '0.75rem',
                                py: 0.5,
                                px: 1,
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <DragIcon sx={{ fontSize: '0.8rem' }} />
                                <Typography variant="caption">
                                  {AVAILABLE_COMPONENTS.find(c => c.type === nestedComp.type)?.label || nestedComp.type}
                                </Typography>
                              </Box>
                              <Box>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setStatementComponents(prev =>
                                      prev.map(comp => {
                                        if (comp.id === component.id && comp.type === COMPONENT_TYPES.COLUMNS) {
                                          const updatedColumns = comp.properties.columns.map(col => {
                                            if (col.id === column.id) {
                                              const updatedComponents = [...col.components];
                                              updatedComponents[nestedIndex] = { 
                                                ...nestedComp, 
                                                visible: !(nestedComp.visible !== false) 
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
                                  }}
                                  sx={{ color: 'inherit', p: 0.25 }}
                                >
                                  {nestedComp.visible !== false ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Remove component from column
                                    setStatementComponents(prev =>
                                      prev.map(comp => {
                                        if (comp.id === component.id && comp.type === COMPONENT_TYPES.COLUMNS) {
                                          const updatedColumns = comp.properties.columns.map(col => {
                                            if (col.id === column.id) {
                                              return {
                                                ...col,
                                                components: col.components.filter((_, i) => i !== nestedIndex)
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
                                    if (selectedComponent === nestedComponentId) {
                                      selectComponent(null);
                                    }
                                  }}
                                  sx={{ color: 'inherit', p: 0.25 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          )}

                          {/* Component Content */}
                          {nestedComp.visible !== false && (
                            <Box sx={{ p: 0, minHeight: 30 }}>
                              {renderComponentContent(nestedComp, nestedIndex)}
                            </Box>
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
            ))}
          </Box>
        );
      
      case COMPONENT_TYPES.SPACER:
        // Reference: dashed outline only, no fill, size centered inside it.
        return (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed #d9d9d9',
              py: 0.5,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              {component.properties?.height || 30}px
            </Typography>
          </Box>
        );
      
      default:
        return <Typography variant="body2">Unknown component</Typography>;
    }
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
          <Box key={col.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
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

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
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
              <Tooltip title="Open the rich text editor to format this component's content.">
                <HelpIcon sx={{ color: '#676b72', fontSize: 20, cursor: 'help' }} />
              </Tooltip>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  setTextEditorOpen(true);
                  setTextEditorContent(props.richTextContent || props.content || '');
                  // Store the component ID for updating after editing
                  setTextEditorComponentId(selectedComponent);
                }}
                sx={{
                  textTransform: 'none',
                  bgcolor: '#32b643',
                  '&:hover': { bgcolor: '#2a9d3a' }
                }}
              >
                Edit Text
              </Button>
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 40, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <Box sx={{ 
                  width: '80%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: props.border?.enabled ? `${props.border.width || 1}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={async () => {
                  const width = await prompt('Border width (px):', props.border?.width || 1, { title: 'Border' });
                  if (width !== null) {
                    const color = await prompt('Border colour (hex):', props.border?.color || '#000000', { title: 'Border' });
                    if (color !== null) {
                      updateComponentProperty(componentId, 'border', {
                        enabled: true,
                        width: parseInt(width) || 1,
                        color: color,
                        style: props.border?.style || 'solid'
                      });
                    }
                  }
                }}
                sx={{ textTransform: 'none', borderRadius: 0, color: '#676b72', borderColor: '#676b72', '&:hover': { borderColor: '#676b72', bgcolor: '#f8f8f8' } }}
              >
                Edit Border
              </Button>
            </Box>
          </Box>
        )}

        {/* Overview Component Settings */}
        {component.type === COMPONENT_TYPES.OVERVIEW && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6" sx={{ mb: 1, fontWeight: 'bold' }}>Overview</Typography>
            
            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.fontColor || '#000000',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.fontColor || '#000000'}
                  onChange={(e) => updateComponentProperty(componentId, 'fontColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <FormControl fullWidth size="small">
                <Select
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

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 40, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <Box sx={{ 
                  width: '80%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponentProperty(componentId, 'border', {
                    ...props.border,
                    width: props.border?.width ? 0 : 1,
                    style: props.border?.style || 'solid',
                    color: props.border?.color || '#000000'
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                {props.border?.width ? 'Disable Border' : 'Enable Border'}
              </Button>
              {props.border?.width && (
                <Box sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Border Width (px)"
                    type="number"
                    value={props.border?.width || 1}
                    onChange={(e) => updateComponentProperty(componentId, 'border', {
                      ...props.border,
                      width: parseInt(e.target.value) || 1
                    })}
                    sx={{ mb: 1 }}
                  />
                  <Box
                    sx={{
                      width: '100%',
                      height: 40,
                      bgcolor: props.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={props.border?.color || '#000000'}
                      onChange={(e) => updateComponentProperty(componentId, 'border', {
                        ...props.border,
                        color: e.target.value
                      })}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0,
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
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
              { key: 'labelPaidInStore', label: 'Paid in Store', fallback: 'Paid in Store' },
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

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.fontColor || '#000000',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.fontColor || '#000000'}
                  onChange={(e) => updateComponentProperty(componentId, 'fontColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <FormControl fullWidth size="small">
                <Select
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

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 40, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <Box sx={{ 
                  width: '80%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  updateComponentProperty(componentId, 'border', {
                    ...props.border,
                    width: props.border?.width ? 0 : 1,
                    style: props.border?.style || 'solid',
                    color: props.border?.color || '#000000'
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                {props.border?.width ? 'Disable Border' : 'Enable Border'}
              </Button>
              {props.border?.width && (
                <Box sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Border Width (px)"
                    type="number"
                    value={props.border?.width || 1}
                    onChange={(e) => updateComponentProperty(componentId, 'border', {
                      ...props.border,
                      width: parseInt(e.target.value) || 1
                    })}
                    sx={{ mb: 1 }}
                  />
                  <Box
                    sx={{
                      width: '100%',
                      height: 40,
                      bgcolor: props.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={props.border?.color || '#000000'}
                      onChange={(e) => updateComponentProperty(componentId, 'border', {
                        ...props.border,
                        color: e.target.value
                      })}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0,
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
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

        {/* Credit Terms Component Settings */}
        {component.type === COMPONENT_TYPES.CREDIT_TERMS && (
          <Box>
            <TextField
              fullWidth
              label="Credit Terms"
              value={props.terms || ''}
              onChange={(e) => updateComponentProperty(componentId, 'terms', e.target.value)}
              sx={{ mb: 2 }}
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

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 40, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <Box sx={{ 
                  width: '80%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: props.border?.enabled ? `${props.border.width || 1}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponentProperty(componentId, 'border', {
                    ...props.border,
                    enabled: !props.border?.enabled
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
            </Box>
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

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 40, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 1
              }}>
                <Box sx={{ 
                  width: '80%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: props.border?.width ? `${props.border.width}px ${props.border.style || 'solid'} ${props.border.color || '#000000'}` : '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponentProperty(componentId, 'border', {
                    ...props.border,
                    width: props.border?.width ? 0 : 1,
                    style: props.border?.style || 'solid',
                    color: props.border?.color || '#000000'
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                {props.border?.width ? 'Disable Border' : 'Enable Border'}
              </Button>
              {props.border?.width && (
                <Box sx={{ mt: 1 }}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Border Width (px)"
                    type="number"
                    value={props.border?.width || 1}
                    onChange={(e) => updateComponentProperty(componentId, 'border', {
                      ...props.border,
                      width: parseInt(e.target.value) || 1
                    })}
                    sx={{ mb: 1 }}
                  />
                  <Box
                    sx={{
                      width: '100%',
                      height: 40,
                      bgcolor: props.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={props.border?.color || '#000000'}
                      onChange={(e) => updateComponentProperty(componentId, 'border', {
                        ...props.border,
                        color: e.target.value
                      })}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0,
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>
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
                      <TextField
                        size="small"
                        type="number"
                        value={width}
                        onChange={(e) => {
                          const newWidths = [...(props.columnWidths || [])];
                          newWidths[index] = parseInt(e.target.value) || 0;
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

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ 
                width: '100%', 
                height: 60, 
                border: '1px solid #ccc', 
                bgcolor: '#f5f5f5',
                borderRadius: 1,
                position: 'relative',
                mb: 1
              }}>
                <Box sx={{ 
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '60%', 
                  height: '60%', 
                  bgcolor: 'white', 
                  border: '1px solid #999',
                }} />
              </Box>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Top"
                    type="number"
                    value={props.padding?.top || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      top: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Left"
                    type="number"
                    value={props.padding?.left || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      left: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Right"
                    type="number"
                    value={props.padding?.right || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      right: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    placeholder="Bottom"
                    type="number"
                    value={props.padding?.bottom || ''}
                    onChange={(e) => updateComponentProperty(componentId, 'padding', {
                      ...props.padding,
                      bottom: parseInt(e.target.value) || 0
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border width between 0 and 1
                  const currentWidth = props.border?.width || 0;
                  updateComponentProperty(componentId, 'border', {
                    ...props.border,
                    width: currentWidth > 0 ? 0 : 1
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
              
              {/* Border Color - only show if border width > 0 */}
              {(props.border?.width || 0) > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Border Color</Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 30,
                      bgcolor: props.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={props.border?.color || '#000000'}
                      onChange={(e) => updateComponentProperty(componentId, 'border', {
                        ...props.border,
                        color: e.target.value
                      })}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: 0,
                      }}
                    />
                  </Box>
                </Box>
              )}
            </Box>

            {/* Background Color */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>

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

        {!['text', 'spacer', 'credit_terms', 'image', 'columns'].includes(component.type) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: props.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={props.backgroundColor || '#ffffff'}
                  onChange={(e) => updateComponentProperty(componentId, 'backgroundColor', e.target.value)}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    cursor: 'pointer',
                    opacity: 0,
                  }}
                />
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  const selectedComponentDetails = getSelectedComponentDetails();

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
      {/* Header — centered "Statement - [name]" above canvas (reference parity) */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        p: 2,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'white'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439', whiteSpace: 'nowrap' }}>
            Statement -
          </Typography>
          <TextField
            value={template?.name || 'Statement'}
            onChange={(e) => setTemplate(prev => ({ ...prev, name: e.target.value }))}
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 0,
                fontSize: 16,
                '& fieldset': { borderColor: '#000', borderWidth: '1px' },
                '&:hover fieldset': { borderColor: '#000' },
                '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: '2px' },
              },
            }}
          />
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
          <Box sx={{ flex: 1, p: 2, overflow: 'auto', bgcolor: '#f9f9f9' }}>
            <Paper
              sx={{
                width: `${canvasSettings.width}mm`,
                minHeight: '297mm',
                mx: 'auto',
                p: `${canvasSettings.padding}mm`,
                bgcolor: canvasSettings.backgroundColor,
                position: 'relative',
                cursor: 'default',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  selectComponent(null);
                }
              }}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* Reference parity: fixed Header / Footer zones, open body between */}
              {renderZone('header', 'Header', true)}
              {renderZone('body', 'Body', false)}
              {renderZone('footer', 'Footer', true)}
            </Paper>
          </Box>
        </Box>

        {/* Sidebar with Tabs */}
        <Paper sx={{ width: 350, borderRadius: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab Header */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: '#f8f9fa' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  minHeight: 48,
                  fontSize: '0.875rem',
                  color: '#666',
                  '& .MuiTab-iconWrapper': { mr: 1, mb: 0 },
                  '&.Mui-selected': {
                    color: '#313439',
                    fontWeight: 600,
                  },
                  '&.Mui-disabled': {
                    color: '#808080',
                    pointerEvents: 'auto',
                    cursor: 'not-allowed'
                  }
                },
                '& .MuiTabs-indicator': {
                  backgroundColor: '#5ebbeb',
                  height: 4
                }
              }}
            >
              <Tab icon={<ComponentsTabIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Components" />
              <Tab icon={<SettingsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Settings" disabled={!selectedComponent} />
            </Tabs>
          </Box>

          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fafafa' }}>
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                <Grid container spacing={1.5}>
                  {AVAILABLE_COMPONENTS.map((comp) => (
                    <Grid item xs={4} key={comp.type}>
                      <Card
                        draggable
                        onClick={() => handleAddComponent(comp.type)}
                        onDragStart={(e) => handleDragStart(e, comp.type, true)}
                        onDragEnd={handleDragEnd}
                        sx={{
                          cursor: 'grab',
                          transition: 'none',
                          '&:hover': {
                            bgcolor: '#e5e5e5',
                          },
                          '&:active': {
                            cursor: 'grabbing',
                          },
                          height: 96,
                          border: '1px solid #d4d4d4',
                          boxShadow: 1,
                          opacity: draggedFromPalette === comp.type ? 0.5 : 1,
                          borderRadius: 1,
                        }}
                      >
                        <CardContent sx={{
                          p: 1,
                          textAlign: 'center',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          '&:last-child': { pb: 1 }
                        }}>
                          <Box sx={{
                            mb: 0.75,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            color: '#313439',
                            '& svg': { fontSize: 28 },
                          }}>
                            {comp.icon}
                          </Box>
                          <Typography variant="caption" sx={{
                            fontSize: '0.8rem',
                            lineHeight: 1.1,
                            color: '#313439',
                            fontWeight: 500
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
              <Box sx={{ p: 2 }}>
                {renderPropertiesPanel()}
              </Box>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Footer action bar (bottom-right) */}
      <Box sx={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 1,
        p: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'white',
      }}>
        <Button
          variant="outlined"
          startIcon={<PreviewIcon />}
          onClick={() => setPreviewOpen(true)}
          sx={{ textTransform: 'none', color: '#676b72', borderColor: '#404040', borderRadius: '8px', fontSize: 16, '&:hover': { borderColor: '#404040', bgcolor: '#f8f8f8' } }}
        >
          Preview
        </Button>
        <Button
          variant="outlined"
          startIcon={<CancelIcon />}
          onClick={() => navigate('/setup/statements')}
          sx={{ textTransform: 'none', color: '#676b72', borderColor: '#404040', borderRadius: '8px', fontSize: 16, '&:hover': { borderColor: '#404040', bgcolor: '#f8f8f8' } }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{
            textTransform: 'none',
            bgcolor: '#5ebbeb',
            color: '#f8f8f8',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
          }}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </Box>

      {/* Text Editor Dialog */}
      {selectedComponentDetails?.component?.type === COMPONENT_TYPES.TEXT && (
        <Dialog
          open={textEditorOpen}
          onClose={() => setTextEditorOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: { height: '80vh' }
          }}
        >
          <DialogTitle>Text</DialogTitle>
          <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Box
              sx={{
                borderBottom: '1px solid #e0e0e0',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap',
                bgcolor: '#f5f5f5',
                // Reference toolbar icons are dark/black, not primary-blue outlined.
                '& .MuiButton-root': { color: '#404040', borderColor: '#d0d0d0' },
                '& .MuiButton-root:hover': { borderColor: '#404040', bgcolor: '#ececec' }
              }}
            >
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('bold')}
                title="Bold"
              >
                <strong>B</strong>
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('italic')}
                title="Italic"
              >
                <em>I</em>
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('underline')}
                title="Underline"
              >
                <u>U</u>
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('strikeThrough')}
                title="Strikethrough"
              >
                <s>S</s>
              </Button>
              
              <Divider orientation="vertical" flexItem />
              
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => insertText('{}')}
                title="Insert Curly Braces"
              >
                {'{}'}
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => insertHTML('<sup>2</sup>')}
                title="Superscript"
              >
                x²
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => insertHTML('<sub>2</sub>')}
                title="Subscript"
              >
                x₂
              </Button>
              
              <Divider orientation="vertical" flexItem />
              
              <Select 
                size="small" 
                defaultValue="Normal" 
                sx={{ minWidth: 80 }}
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
                sx={{ minWidth: 60 }}
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
              
              <Divider orientation="vertical" flexItem />
              
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('justifyLeft')}
                title="Align Left"
              >
                ≡
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('justifyCenter')}
                title="Align Center"
              >
                ≡
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('justifyRight')}
                title="Align Right"
              >
                ≡
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('justifyFull')}
                title="Justify"
              >
                ≡
              </Button>
              
              <Divider orientation="vertical" flexItem />
              
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('insertUnorderedList')}
                title="Bulleted List"
              >
                •
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('insertOrderedList')}
                title="Numbered List"
              >
                1.
              </Button>
              
              <Divider orientation="vertical" flexItem />
              
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('outdent')}
                title="Decrease Indent"
              >
                ←
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('indent')}
                title="Increase Indent"
              >
                →
              </Button>
              
              <Divider orientation="vertical" flexItem />
              
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={async () => {
                  const color = await prompt('Enter colour (e.g. #ff0000 or red):', '#000000', { title: 'Text colour' });
                  if (color) execCommand('foreColor', color);
                }}
                title="Text Color"
              >
                ✏️
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={insertLink}
                title="Insert Link"
              >
                🔗
              </Button>
              <Button
                size="small"
                variant="outlined"
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('unlink')}
                title="Remove Link"
              >
                <LinkOffIcon sx={{ fontSize: 18 }} />
              </Button>
              <Button
                size="small"
                variant="outlined"
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={async () => {
                  const url = await prompt('Enter image URL:', 'https://', { title: 'Insert image', confirmText: 'Insert image' });
                  if (url) insertHTML(`<img src="${url}" alt="Image" style="max-width: 100%; height: auto;" />`);
                }}
                title="Insert Image"
              >
                🖼️
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('undo')}
                title="Undo"
              >
                ↶
              </Button>
              <Button 
                size="small" 
                variant="outlined" 
                sx={{ minWidth: 'auto', p: 0.5 }}
                onClick={() => execCommand('redo')}
                title="Redo"
              >
                ↷
              </Button>
            </Box>
            
            <Box
              ref={setTextEditorRef}
              sx={{
                flex: 1,
                p: 2,
                minHeight: 300,
                border: '1px solid #e0e0e0',
                bgcolor: '#ffffff',
                overflow: 'auto',
                outline: 'none',
                '&:focus': {
                  border: '2px solid #1976d2'
                }
              }}
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setTextEditorContent(e.target.innerHTML)}
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
              dangerouslySetInnerHTML={{ __html: textEditorContent }}
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              variant="outlined"
              onClick={() => setTextEditorOpen(false)}
              sx={{ textTransform: 'none', color: '#676b72', borderColor: '#404040', borderRadius: '8px', fontSize: 16, '&:hover': { borderColor: '#404040', bgcolor: '#f8f8f8' } }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (textEditorComponentId) {
                  updateComponentProperty(textEditorComponentId, 'richTextContent', textEditorContent);
                  updateComponentProperty(textEditorComponentId, 'content', textEditorContent.replace(/<[^>]*>/g, ''));
                }
                setTextEditorOpen(false);
                setTextEditorComponentId(null);
              }}
              sx={{ textTransform: 'none', bgcolor: '#5ebbeb', color: '#f8f8f8', borderRadius: '12px', fontWeight: 700, fontSize: 16, height: 42, boxShadow: 'none', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' } }}
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

      {/* Preview Dialog — read-only statement as it will render (no edit chrome) */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Statement Preview
          <IconButton onClick={() => setPreviewOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ bgcolor: '#f9f9f9' }}>
          <Paper sx={{ width: `${canvasSettings.width}mm`, maxWidth: '100%', minHeight: '200mm', mx: 'auto', p: `${canvasSettings.padding}mm`, bgcolor: canvasSettings.backgroundColor }}>
            {/* Same renderer the live statement uses, so preview == printed/emailed statement */}
            <StatementRenderer
              statementData={mockStatementData}
              template={{ config: { components: statementComponents } }}
            />
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            variant="contained"
            onClick={() => setPreviewOpen(false)}
            sx={{ textTransform: 'none', bgcolor: '#5ebbeb', color: '#f8f8f8', borderRadius: '12px', fontWeight: 700, fontSize: 16, height: 42, boxShadow: 'none', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' } }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

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
