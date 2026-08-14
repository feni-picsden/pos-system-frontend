import React, { useState, useEffect, useRef, useMemo } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
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
  FormControlLabel,
  Slider,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import {
  Save as SaveIcon,
  Preview as PreviewIcon,
  Cancel as CancelIcon,
  DragIndicator as DragIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  WidgetsOutlined,
  SettingsOutlined,
  ArrowDropUp as ArrowDropUpIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ContentCopy as CopyIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  Edit as EditIcon,
  Close as CloseIcon,
  TitleOutlined,
  ViewWeekOutlined,
  StorefrontOutlined,
  ShoppingBagOutlined,
  PercentOutlined,
  LabelOutlined,
  CreditCardOutlined,
  AttachMoneyOutlined,
  EmojiEventsOutlined,
  PersonOutlineOutlined,
  CalculateOutlined,
  CardGiftcardOutlined,
  DescriptionOutlined,
  TextFieldsOutlined,
  ImageOutlined,
  ViewColumnOutlined,
  HeightOutlined,
  FormatAlignLeftOutlined,
  FormatAlignCenterOutlined,
  FormatAlignRightOutlined,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import receiptTemplateService from '../../services/receiptTemplateService';
import MediaDialog from '../../components/Common/MediaDialog';
import { toEditorComponents, toReferenceComponents, toReferenceComponent, COLUMN_LABELS, isWideTemplate, paperWidthMm, isEmailTemplate, isTextOnlyTemplate, applyReceiptConfig } from '../../utils/receiptTemplateShape';
import ConfigureReceiptDialog from '../../components/Receipt/ConfigureReceiptDialog';
import { renderExpressions, sampleReceiptContext } from '../../utils/receiptExpressions';
import { ReferenceComponent } from '../../components/Receipt/ReferenceReceipt';
import { sampleReferenceData } from '../../utils/referenceReceiptData';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// A block's default column set: the reference's own columns for that type, in
// reference order, each keyed so the storage adapter can match it.
const fieldDefaults = (type) => Object.entries(COLUMN_LABELS[type] || {})
  .map(([key, name], index) => ({ key, name, enabled: true, order: index + 1 }));

// Receipt component types
const COMPONENT_TYPES = {
  HEADER: 'header',
  BARCODE: 'barcode',
  OUTLET_LOGO: 'outlet_logo',
  PRODUCTS: 'products',
  TAX: 'tax',
  INDICATOR: 'indicator',
  PAYMENTS: 'payments',
  SURCHARGE: 'surcharge',
  LOYALTY: 'loyalty',
  ACCOUNT: 'account',
  TOTALS: 'totals',
  GIFT_CARDS: 'gift_cards',
  EXTERNAL_RECEIPT: 'external_receipt',
  TEXT: 'text',
  IMAGE: 'image',
  COLUMNS: 'columns',
  SPACER: 'spacer',
};

// Available components for the palette
const AVAILABLE_COMPONENTS = [
  { type: COMPONENT_TYPES.HEADER, label: 'Header', Icon: TitleOutlined, description: 'Business header info' },
  { type: COMPONENT_TYPES.BARCODE, label: 'Barcode', Icon: ViewWeekOutlined, description: 'Receipt barcode' },
  { type: COMPONENT_TYPES.OUTLET_LOGO, label: 'Outlet Logo', Icon: StorefrontOutlined, description: 'Business logo' },
  { type: COMPONENT_TYPES.PRODUCTS, label: 'Products', Icon: ShoppingBagOutlined, description: 'Product line items' },
  { type: COMPONENT_TYPES.TAX, label: 'Tax', Icon: PercentOutlined, description: 'Tax calculations' },
  { type: COMPONENT_TYPES.INDICATOR, label: 'Tax Indicator', Icon: LabelOutlined, description: 'Status indicators' },
  { type: COMPONENT_TYPES.PAYMENTS, label: 'Payments', Icon: CreditCardOutlined, description: 'Payment methods' },
  { type: COMPONENT_TYPES.SURCHARGE, label: 'Surcharge', Icon: AttachMoneyOutlined, description: 'Additional charges' },
  { type: COMPONENT_TYPES.LOYALTY, label: 'Loyalty', Icon: EmojiEventsOutlined, description: 'Loyalty points' },
  { type: COMPONENT_TYPES.ACCOUNT, label: 'Account', Icon: PersonOutlineOutlined, description: 'Customer account' },
  { type: COMPONENT_TYPES.TOTALS, label: 'Totals', Icon: CalculateOutlined, description: 'Total amounts' },
  { type: COMPONENT_TYPES.GIFT_CARDS, label: 'Gift Cards', Icon: CardGiftcardOutlined, description: 'Gift card info' },
  { type: COMPONENT_TYPES.EXTERNAL_RECEIPT, label: 'External Receipt', Icon: DescriptionOutlined, description: 'External receipt' },
  { type: COMPONENT_TYPES.TEXT, label: 'Text', Icon: TextFieldsOutlined, description: 'Custom text' },
  { type: COMPONENT_TYPES.IMAGE, label: 'Image', Icon: ImageOutlined, description: 'Custom image' },
  { type: COMPONENT_TYPES.COLUMNS, label: 'Columns', Icon: ViewColumnOutlined, description: 'Column layout' },
  { type: COMPONENT_TYPES.SPACER, label: 'Spacer', Icon: HeightOutlined, description: 'Vertical spacing' },
];

// Padding is a pixel offset and must never be negative: coerce empty/NaN/negative to 0.
const clampPad = (v) => Math.max(0, parseInt(v, 10) || 0);

const ReceiptEditor = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Receipt design state
  const [receiptComponents, setReceiptComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedComponent, setDraggedComponent] = useState(null);
  const [draggedFromPalette, setDraggedFromPalette] = useState(null);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textEditorContent, setTextEditorContent] = useState('');
  const [textEditorRef, setTextEditorRef] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Reference asks "Save <name>?" (Yes / No / Cancel) when you leave the editor with
  // unsaved edits — measured 2026-08-06. We used to discard silently.
  const [leavePrompt, setLeavePrompt] = useState(false);
  const savedSnapshot = useRef('');
  // The Configure dialog edits `config` (padding / width / attachments), which the
  // component snapshot cannot see. Set on Confirm, cleared on a successful save.
  const configDirty = useRef(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkData, setLinkData] = useState({
    title: '',
    target: '',
    openInNewWindow: false
  });
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [mediaDialogFor, setMediaDialogFor] = useState(null); // 'image' or 'outlet_logo'
  
  // Seed the contentEditable node ONCE when the dialog opens, then leave it
  // uncontrolled. Binding it via dangerouslySetInnerHTML while updating state on
  // every keystroke rewrote innerHTML each render, resetting the caret to 0 and
  // reversing typed input. onInput still feeds textEditorContent for the Save handler.
  useEffect(() => {
    if (textEditorOpen && textEditorRef) {
      textEditorRef.innerHTML = textEditorContent;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditorOpen, textEditorRef]);

  // Rich text editor functions
  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    if (textEditorRef) {
      setTextEditorContent(textEditorRef.innerHTML);
    }
  };

  const applyFontSize = (size) => {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const selectedText = range.toString();
      
      if (selectedText) {
        // Create a span with the font size
        const span = document.createElement('span');
        span.style.fontSize = size + 'px';
        span.textContent = selectedText;
        
        // Replace the selected text with the styled span
        range.deleteContents();
        range.insertNode(span);
        
        // Update the content
        if (textEditorRef) {
          setTextEditorContent(textEditorRef.innerHTML);
        }
      }
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
  
  // Sidebar tab state
  const [activeTab, setActiveTab] = useState(0);

  // Measured: selecting a component auto-switches to Settings, DESELECTING switches
  // back to Components (and Settings greys out). Driven off the selection itself so
  // every deselect path — X button, canvas click, delete, drop — gets it, instead of
  // the four scattered setActiveTab(1) calls only covering select.
  useEffect(() => {
    setActiveTab(selectedComponent ? 1 : 0);
  }, [selectedComponent]);

  // Template-level "Configure Receipt" dialog — the SAME dialog (and the same save
  // rules) as the list page's Configure action, so padding / width / attachments can
  // all be edited from either entry point.
  const [configOpen, setConfigOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState({
    padding: { top: 5, right: 5, bottom: 5, left: 5 },
    receiptWidth: '',
    attachments: [],
  });
  const [configError, setConfigError] = useState('');
  // Only needed to populate the attachment selects on an Email template.
  const [a4Templates, setA4Templates] = useState([]);

  // Canvas settings
  const [canvasSettings, setCanvasSettings] = useState({
    width: 80, // mm
    padding: 5, // mm (legacy scalar; renderer fallback)
    // px, edited via Configure Receipt. Measured 2026-08-07: `padding` is null on every
    // reference template, and the list page's Configure seeds a missing padding as
    // 0/0/0/0 — so a 5px default here made the gear and the list show different numbers
    // for the same template, and made Confirm write a padding the merchant never typed.
    receiptPadding: { top: 0, right: 0, bottom: 0, left: 0 },
    fontFamily: 'Arial',
    fontSize: 12,
    backgroundColor: '#ffffff',
  });

  const canvasRef = useRef(null);

  useEffect(() => {
    if (templateId && templateId !== 'new') {
      loadTemplate();
    } else {
      // New template
      setTemplate({
        id: null,
        name: 'New Receipt Template',
        type: 'Normal',
        for: 'Sale',
        config: {}
      });
      setLoading(false);
    }
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      setLoading(true);
      const response = await receiptTemplateService.getTemplate(templateId);
      setTemplate(response.template);
      
      // Components are stored in the reference shape ({type, style, value}); the
      // editor works in its own shape and converts back on save.
      const loaded = response.template.config?.components
        ? toEditorComponents(response.template.config.components)
        : [];
      setReceiptComponents(loaded);
      // Baseline for the unsaved-changes check: what the template looked like when it
      // opened. Compared in reference shape so cosmetic editor-state differences
      // (ids, selection) never read as an edit.
      savedSnapshot.current = JSON.stringify(toReferenceComponents(loaded));
      
      // Load canvas settings
      if (response.template.config && response.template.config.canvas) {
        const c = response.template.config.canvas;
        setCanvasSettings(prev => {
          const merged = { ...prev, ...c };
          // Legacy templates stored a single numeric padding; migrate to 4-way px.
          if (!c.receiptPadding) {
            const n = typeof c.padding === 'number' ? c.padding : (prev.receiptPadding?.top ?? 0);
            merged.receiptPadding = { top: n, right: n, bottom: n, left: n };
          }
          return merged;
        });
      }
      // `config.padding` is the canonical field the list page's Configure dialog
      // writes. The editor's gear dialog edits the same paper padding, so seed it
      // from there — otherwise the two dialogs showed different numbers.
      const storedPadding = response.template.config?.padding;
      if (storedPadding && typeof storedPadding === 'object') {
        setCanvasSettings(prev => ({
          ...prev,
          receiptPadding: {
            top: Number(storedPadding.top) || 0,
            right: Number(storedPadding.right) || 0,
            bottom: Number(storedPadding.bottom) || 0,
            left: Number(storedPadding.left) || 0,
          },
        }));
      }
    } catch (err) {
      console.error('Error loading template:', err);
      setError('Failed to load receipt template');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      // A blank name can't be persisted (the rename below is skipped for it), so saying so
      // beats saving the layout and silently keeping the old name.
      if (template && !String(template.name || '').trim()) {
        setError('Please specify a receipt name');
        return false;
      }
      setSaving(true);

      // Emit the 4-way padding as a CSS shorthand string so ReceiptRenderer
      // (which reads canvas.padding as number|string) honours it verbatim.
      const rp = canvasSettings.receiptPadding || { top: 0, right: 0, bottom: 0, left: 0 };
      const configData = {
        // Carry forward config keys this editor does not own (padding + email
        // attachments, both set from the list page's Configure dialog) — the save
        // replaces the whole config column, so omitting them wiped them.
        ...(template?.config || {}),
        // Always persist in the reference shape — that is what the sale receipt renders.
        components: toReferenceComponents(receiptComponents),
        canvas: {
          ...canvasSettings,
          padding: `${rp.top || 0}px ${rp.right || 0}px ${rp.bottom || 0}px ${rp.left || 0}px`,
        },
        // Same paper padding in the canonical field the Configure dialog reads, so the
        // two dialogs stay in agreement whichever one edited it last. Measured: a
        // text-only receipt has NO padding block, so Save must not stamp one in —
        // applyReceiptConfig already skips it and this used to write it back anyway.
        ...(isTextOnlyTemplate(template) ? {} : {
          padding: {
            top: Number(rp.top) || 0,
            right: Number(rp.right) || 0,
            bottom: Number(rp.bottom) || 0,
            left: Number(rp.left) || 0,
          },
        }),
        lastModified: new Date().toISOString()
      };

      if (templateId && templateId !== 'new') {
        await receiptTemplateService.updateTemplateConfig(templateId, configData);
        // The header name field is part of the same Save; without this the rename
        // was silently dropped (config saved, name unchanged).
        if (template?.name) {
          await receiptTemplateService.updateTemplate(templateId, { name: template.name });
        }
      } else {
        const newTemplate = await receiptTemplateService.createTemplate({
          ...template,
          config: configData
        });
        navigate(`/setup/receipts/${newTemplate.template.id}/edit`, { replace: true });
      }
      
      setError('');
      // A successful save is the new baseline for the unsaved-changes check.
      savedSnapshot.current = JSON.stringify(configData.components);
      configDirty.current = false;
      return true;
    } catch (err) {
      console.error('Error saving template:', err);
      setError('Failed to save receipt template');
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Gear: seed the dialog from the template's stored config (the same fields the list
  // page's Configure writes) and load the A4 templates the attachment selects offer.
  const openConfigure = async () => {
    const cfg = template?.config || {};
    setConfigDraft({
      padding: canvasSettings.receiptPadding || { top: 0, right: 0, bottom: 0, left: 0 },
      receiptWidth: cfg.receiptWidth == null ? '' : String(cfg.receiptWidth),
      attachments: Array.isArray(cfg.attachments) ? cfg.attachments : [],
    });
    setConfigError('');
    setConfigOpen(true);
    if (isEmailTemplate(template) && a4Templates.length === 0) {
      try {
        const res = await receiptTemplateService.getTemplates();
        setA4Templates((res.templates || []).filter((t) => t.type === 'A4 Receipt'));
      } catch (err) {
        console.error('Error loading A4 templates:', err);
      }
    }
  };

  // Confirm applies to the in-editor template; the editor's own Save persists it.
  const confirmConfigure = () => {
    const { error: err, config } = applyReceiptConfig(template?.config, {
      template,
      padding: configDraft.padding,
      receiptWidth: configDraft.receiptWidth,
      attachments: configDraft.attachments,
    });
    if (err) {
      setConfigError(err);
      return;
    }
    setTemplate((prev) => ({ ...prev, config }));
    setCanvasSettings((prev) => ({ ...prev, receiptPadding: { ...configDraft.padding } }));
    // Padding / width / attachments live in `config`, not in the component snapshot, so
    // without this Confirm-then-Cancel left the editor with no unsaved changes to prompt
    // about and the edit was dropped silently.
    configDirty.current = true;
    setConfigOpen(false);
  };

  const hasUnsavedChanges = () =>
    configDirty.current ||
    savedSnapshot.current !== JSON.stringify(toReferenceComponents(receiptComponents));

  const leaveEditor = () => navigate('/setup/receipts');

  // Cancel mirrors the reference: straight out when nothing changed, otherwise the
  // Save? prompt.
  const handleCancel = () => {
    if (hasUnsavedChanges()) setLeavePrompt(true);
    else leaveEditor();
  };

  // Closing the tab / reloading with unsaved edits gets the browser's own warning.
  useEffect(() => {
    const warn = (e) => {
      if (!hasUnsavedChanges()) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  });

  const handleAddComponent = (componentType) => {
    try {
      const newComponent = {
        id: `${componentType}-${Date.now()}`,
        type: componentType,
        position: { x: 0, y: receiptComponents.length * 50 },
        properties: getDefaultProperties(componentType),
        visible: true,
      };
      
      setReceiptComponents(prev => [...prev, newComponent]);
      setSelectedComponent(newComponent.id);
      console.log('Component added successfully:', componentType);
    } catch (error) {
      console.error('Error adding component:', error);
    }
  };

  const getDefaultProperties = (componentType) => {
    switch (componentType) {
      case COMPONENT_TYPES.HEADER:
        return {
          completedSale: 'Tax Invoice',
          parkedSale: 'Held Sale',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'normal',
          textAlign: 'center',
          padding: { top: 5, right: 5, bottom: 5, left: 5 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.OUTLET_LOGO:
        return {
          width: 'auto',
          height: 'auto',
          horizontalAlignment: 'center',
          backgroundColor: '#ffffff',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { width: 0, color: '#000000', style: 'solid' },
          imageUrl: null,
        };
      case COMPONENT_TYPES.COLUMNS:
        return {
          columnWidths: [30, 70], // percentages
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { width: 0, color: '#000000', style: 'solid' },
          backgroundColor: '#ffffff',
          columns: [
            { id: 'col-1', components: [] },
            { id: 'col-2', components: [] }
          ],
        };
      case COMPONENT_TYPES.SPACER:
        return {
          // Reference default measured 2026-08-07: the Spacer settings tab is a single
          // Height input seeded with 100.
          height: 100,
        };
      case COMPONENT_TYPES.IMAGE:
        return {
          width: 'auto',
          height: 'auto',
          horizontalAlignment: 'center',
          backgroundColor: '#ffffff',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { width: 0, color: '#000000', style: 'solid' },
          imageUrl: null,
        };
      case COMPONENT_TYPES.EXTERNAL_RECEIPT:
        // Measured 2026-08-07: eftpos offers textAlign + padding + border and nothing
        // else. The colour/background/fontSize/fontWeight/title defaults that used to
        // live here had no controls left, so they were unremovable — the EFT slip
        // printed in a grey 10px box. The mock slip text went with them: the canvas
        // now draws the block with the receipt renderer against the sample sale.
        return {
          textAlign: 'left',
          padding: { top: 5, right: 5, bottom: 5, left: 5 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.GIFT_CARDS:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('gift_cards'),
          showTitle: true,
          title: 'Gift Cards',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'normal',
          textAlign: 'left',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          // key is the data lookup, name is the label the merchant may rename.
          giftCards: [
            {
              id: '12345',
              original: 120.00,
              amountUsed: 20.00,
              current: 100.00,
              expiry: '2025-12-31'
            },
            {
              id: '54321',
              original: 90.00,
              amountUsed: 10.00,
              current: 80.00,
              expiry: '2025-11-30'
            }
          ]
        };
      case COMPONENT_TYPES.TOTALS:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('total'),
          showTitle: false,
          title: '',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'normal',
          textAlign: 'left',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          // key is the data lookup, name is the label the merchant may rename.
          totalsData: {
            rounding: 0.02,
            savings: 2.00,
            discount: 2.00,
            total: 39.96,
            change: 5.00
          }
        };
      case COMPONENT_TYPES.ACCOUNT:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('account'),
          showTitle: true,
          title: 'Account',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'normal',
          textAlign: 'left',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          accountData: {
            startBalance: 80,
            endBalance: 100,
            balanceChanged: 20,
            currentBalance: 100
          }
        };
      case COMPONENT_TYPES.TEXT:
        return {
          showTitle: true,
          title: 'Text',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 16,
          fontWeight: 'normal',
          textAlign: 'left',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          content: '',
          richTextContent: ''
        };
      case COMPONENT_TYPES.PAYMENTS:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('payment'),
          showTitle: false,
          title: '',
          showPaymentNames: true,
          showAmounts: true,
          showChange: true,
          changeLabel: 'Change',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.PRODUCTS:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('product'),
          showTitle: true,
          title: 'Products',
          showDiscountReason: true,
          showProductNote: true,
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 14,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.TAX:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('tax'),
          showTitle: true,
          title: 'Tax',
          showTotal: true,
          totalLabel: 'Total',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          taxItems: [
            { name: 'No Tax', enabled: true },
            { name: 'Test Tax', enabled: true },
            { name: 'Savings', enabled: true },
            { name: 'Discount', enabled: true }
          ]
        };
      case COMPONENT_TYPES.BARCODE:
        return {
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          backgroundColor: '#ffffff',
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.INDICATOR:
        return {
          indicator: '*',
          text: 'Indicates items with',
          tax: 'No Tax',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.SURCHARGE:
        return {
          showTitle: false,
          title: 'Surcharge',
          showTotal: false,
          totalLabel: 'Total',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' }
        };
      case COMPONENT_TYPES.LOYALTY:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns.
          fields: fieldDefaults('loyalty'),
          showTitle: true,
          title: 'Loyalty',
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'Normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
          // key is the data lookup, name is the label the merchant may rename.
          loyaltyItems: [
            { key: 'currentPoints', name: 'Current Points', enabled: true },
            { key: 'earned', name: 'Earned', enabled: true },
            { key: 'spent', name: 'Spent', enabled: true },
            { key: 'beforeSale', name: 'Before Sale', enabled: true },
            { key: 'afterSale', name: 'After Sale', enabled: true }
          ]
        };
      default:
        return {};
    }
  };

  const handleComponentUpdate = (componentId, updates) => {
    setReceiptComponents(prev =>
      prev.map(comp =>
        comp.id === componentId
          ? { ...comp, ...updates }
          : comp
      )
    );
  };

  const handleNestedComponentUpdate = (parentId, columnId, nestedIndex, updates) => {
    setReceiptComponents(prev =>
      prev.map(comp => {
        if (comp.id === parentId && comp.type === COMPONENT_TYPES.COLUMNS) {
          const updatedColumns = comp.properties.columns.map(col => {
            if (col.id === columnId) {
              const updatedComponents = [...col.components];
              updatedComponents[nestedIndex] = { ...updatedComponents[nestedIndex], ...updates };
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
  };

  const handleDeleteComponent = (componentId) => {
    setReceiptComponents(prev => prev.filter(comp => comp.id !== componentId));
    if (selectedComponent === componentId) {
      setSelectedComponent(null);
    }
  };

  const handleAddComponentToColumn = (parentComponentId, columnId, componentType) => {
    const newComponent = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      properties: getDefaultProperties(componentType),
      visible: true,
    };

    setReceiptComponents(prev =>
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

  // Dropping on the paper itself: a palette tile appends a component, an existing
  // component dropped past the end moves to the end. Only column cells used to
  // accept a drop, so dragging from the palette onto the paper did nothing.
  const handleDropOnCanvas = (e) => {
    e.preventDefault();
    const paletteType = e.dataTransfer.getData('componentType');
    const movedId = e.dataTransfer.getData('componentId');
    if (paletteType && draggedFromPalette) {
      handleAddComponent(paletteType);
    } else if (movedId) {
      setReceiptComponents((prev) => {
        const from = prev.findIndex((c) => String(c.id) === String(movedId));
        if (from === -1) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.push(moved);
        return next;
      });
    }
    handleDragEnd();
  };

  // Dropping one component onto another reorders: the dragged block takes the
  // target's position. The drag handle used to be decorative.
  const handleDropOnComponent = (e, targetId) => {
    e.preventDefault();
    e.stopPropagation();
    const paletteType = e.dataTransfer.getData('componentType');
    const movedId = e.dataTransfer.getData('componentId');
    if (paletteType && draggedFromPalette) {
      handleDragEnd();
      return handleAddComponent(paletteType);
    }
    if (movedId && String(movedId) !== String(targetId)) {
      setReceiptComponents((prev) => {
        const from = prev.findIndex((c) => String(c.id) === String(movedId));
        const to = prev.findIndex((c) => String(c.id) === String(targetId));
        if (from === -1 || to === -1) return prev;
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    handleDragEnd();
  };

  const handleDropInColumn = (e, parentComponentId, columnId) => {
    e.preventDefault();
    e.stopPropagation();
    
    const componentType = e.dataTransfer.getData('componentType');
    if (componentType && draggedFromPalette) {
      const parentComponent = receiptComponents.find(comp => comp.id === parentComponentId);
      const targetColumn = parentComponent?.properties?.columns?.find(col => col.id === columnId);
      
      if (targetColumn && targetColumn.components && targetColumn.components.length >= 2) {
        handleDragEnd();
        return;
      }
      
      handleAddComponentToColumn(parentComponentId, columnId, componentType);
    }
    
    handleDragEnd();
  };

  // One sample sale per editor session — stamped once so the canvas doesn't
  // re-resolve {currentTimestamp} on every render.
  const previewContext = useMemo(() => sampleReceiptContext(), []);
  const previewData = useMemo(() => sampleReferenceData(), []);

  const renderComponent = (component) => {
    // Preview on the reference is not a dialog — it strips the editor chrome off the
    // SAME canvas and renders the components against sample data, with the footer
    // button toggling to "Edit" (measured 2026-08-06). An empty component renders as
    // nothing at all, so its "component empty" placeholder must go too.
    if (previewOpen) {
      if (component.visible === false) return null;
      return <Box key={component.id}>{renderComponentContent(component, true)}</Box>;
    }

    const isSelected = selectedComponent === component.id;
    
    return (
      <Box
        key={component.id}
        draggable
        onDragStart={(e) => handleDragStart(e, component.id)}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDropOnComponent(e, component.id)}
        sx={{
          position: 'relative',
          border:'1px dashed #ccc',
          cursor: 'pointer',
          '&:hover': {
            borderColor: isSelected ? '#5ebbeb' : '#999',
          }
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedComponent(component.id);
          setActiveTab(1);
        }}
      >
        {/* Component Header - Overlay on top when selected */}
        {isSelected && (
          <Box
            sx={{
              position: 'absolute',
              top: -32,
              left: 0,
              right: 0,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 32,
              bgcolor: '#313439',
              color: 'white',
              // px: 1,
              // py: 0.5,
              fontSize: '0.875rem',
              // borderRadius: '4px 4px 0 0',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <DragIcon sx={{ fontSize: '1.125rem' }} />
              <Typography variant="caption" sx={{ fontSize: '0.875rem' }}>
                {AVAILABLE_COMPONENTS.find(c => c.type === component.type)?.label || component.type}
              </Typography>
            </Box>
            <Box>
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedComponent(component.id);
                  setActiveTab(1);
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
                  setSelectedComponent(null);
                }}
                sx={{ color: 'inherit', p: 0.25 }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}

        {/* Component Content — matches the renderer: only an explicit false hides it */}
        {component.visible !== false && (
          <Box sx={{ p: 0, minHeight: 20 }}>
            {renderComponentContent(component)}
          </Box>
        )}
      </Box>
    );
  };

  // Blocks whose printed shape is owned by the receipt renderer. The canvas draws
  // them with that same renderer against a sample sale, so what the author sees on
  // the canvas is exactly what the sale prints — the two used to disagree (canvas:
  // "Rounding:" left-aligned; receipt: "Rounding" right-aligned in the money column).
  const RENDERER_OWNED = [
    COMPONENT_TYPES.PRODUCTS,
    COMPONENT_TYPES.TAX,
    COMPONENT_TYPES.TOTALS,
    COMPONENT_TYPES.PAYMENTS,
    COMPONENT_TYPES.SURCHARGE,
    COMPONENT_TYPES.LOYALTY,
    COMPONENT_TYPES.ACCOUNT,
    COMPONENT_TYPES.GIFT_CARDS,
    COMPONENT_TYPES.INDICATOR,
    // The canvas used to draw its own mock EFTPOS slip (bank/terminal/card literals)
    // in a grey box with a bold title — none of which the receipt prints.
    COMPONENT_TYPES.EXTERNAL_RECEIPT,
  ];

  // isPreview: reference preview renders an empty component as nothing, not as a
  // "component empty" placeholder.
  const renderComponentContent = (component, isPreview = false) => {
    if (RENDERER_OWNED.includes(component.type)) {
      return (
        <ReferenceComponent
          component={toReferenceComponent(component)}
          data={previewData}
        />
      );
    }
    switch (component.type) {
      case COMPONENT_TYPES.HEADER:
        return (
          <Box sx={{
            textAlign: component.properties?.textAlign || 'center',
            border: component.properties?.border?.enabled
              ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
              : 'none',
          }}>
            <Typography
              variant="body2"
              sx={{
                color: component.properties?.fontColor || '#000',
                fontSize: `${component.properties?.fontSize || 12}px`,
                fontWeight: component.properties?.fontWeight || 'normal',
              }}
            >
              {component.properties?.completedSale || 'Tax Invoice'}
            </Typography>
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
            ) : isPreview ? null : (
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
                <Box sx={{ fontSize: '2rem' }}>🖼️</Box>
                <Typography variant="caption" color="text.secondary">
                  Outlet Logo component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      case COMPONENT_TYPES.BARCODE:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: 20,
                bgcolor: '#000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              {/* Simple barcode pattern */}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                {[1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1].map((bar, index) => (
                  <Box
                    key={index}
                    sx={{
                      width: bar ? '2px' : '1px',
                      height: '12px',
                      bgcolor: bar ? '#fff' : 'transparent',
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        );
      case COMPONENT_TYPES.INDICATOR:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
            }}
          >
            <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit', fontWeight: 'bold' }}>
              {component.properties?.indicator || '*'}
            </Typography>
            <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
              {component.properties?.text || 'Indicates items with'} {component.properties?.tax || 'No Tax'}
            </Typography>
          </Box>
        );
      case COMPONENT_TYPES.SURCHARGE:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              minHeight: 20,
            }}
          >
            {/* Name */}
            {component.properties?.showTitle !== false && (
              <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                Surcharge
              </Typography>
            )}
            
            {/* Amount */}
            {component.properties?.showTotal !== false && (
              <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                $2.00
              </Typography>
            )}
          </Box>
        );
      case COMPONENT_TYPES.LOYALTY:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
            }}
          >
            {component.properties?.showTitle && (
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1, fontSize: 'inherit', color: 'inherit' }}>
                {component.properties?.title || 'Loyalty'}
              </Typography>
            )}

            {/* Loyalty Items */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {component.properties?.loyaltyItems?.filter(item => item.enabled).map((item, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                    {item.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                    0000
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      case COMPONENT_TYPES.COLUMNS:
        return (
          <Box
            sx={{
              display: 'flex',
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: `${component.properties?.border?.width || 0}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`,
              minHeight: 100,
            }}
          >
            {component.properties?.columns?.map((column, index) => (
              <Box
                key={column.id}
                sx={{
                  width: `${component.properties?.columnWidths?.[index] || 50}%`,
                  border: isDragging ? '2px dashed #2196F3' : '1px dashed #ddd',
                  minHeight: 80,
                  display: 'flex',
                  flexDirection: 'column',
                  color: '#999',
                  fontSize: '0.8rem',
                  position: 'relative',
                  mr: index < component.properties.columns.length - 1 ? 1 : 0,
                  backgroundColor: isDragging ? '#f0f8ff' : 'transparent',
                  transition: 'all 0.2s ease',
                }}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropInColumn(e, component.id, column.id)}
                onClick={(e) => {
                  e.stopPropagation();
                  // Don't deselect when clicking on column drop zones
                }}
              >
                {column.components && column.components.length > 0 ? (
                  // Render nested components
                  <Box sx={{ p: 1, width: '100%' }}>
                    {column.components.map((nestedComp, nestedIndex) => {
                      const nestedComponentId = `${component.id}-${column.id}-${nestedIndex}`;
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
                            '&:hover': {
                              borderColor: isNestedSelected ? '#1976d2' : '#999',
                            }
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedComponent(nestedComponentId);
                            setActiveTab(1);
                          }}
                        >
                          {/* Component Header - Overlay on top when selected */}
                          {isNestedSelected && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: -20,
                                left: -2,
                                right: -2,
                                zIndex: 10,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                bgcolor: '#1976d2',
                                color: 'white',
                                // px: 1,
                                // py: 0.5,
                                fontSize: '0.75rem',
                                // borderRadius: '4px 4px 0 0',
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
                                    setSelectedComponent(nestedComponentId);
                                    setActiveTab(1);
                                  }}
                                  sx={{ color: 'inherit', p: 0.25 }}
                                >
                                  <SettingsIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    nestedComp.visible = !nestedComp.visible;
                                    // Update the component in the column
                                    setReceiptComponents(prev =>
                                      prev.map(comp => {
                                        if (comp.id === component.id && comp.type === COMPONENT_TYPES.COLUMNS) {
                                          const updatedColumns = comp.properties.columns.map(col => {
                                            if (col.id === column.id) {
                                              const updatedComponents = [...col.components];
                                              updatedComponents[nestedIndex] = { ...nestedComp };
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
                                    setReceiptComponents(prev =>
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
                                      setSelectedComponent(null);
                                    }
                                  }}
                                  sx={{ color: 'inherit', p: 0.25 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedComponent(null);
                                  }}
                                  sx={{ color: 'inherit', p: 0.25 }}
                                >
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            </Box>
                          )}

                          {/* Component Content */}
                          {nestedComp.visible !== false && (
                            <Box sx={{ p: 0, minHeight: 30 }}>
                              {renderComponentContent(nestedComp)}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : isPreview ? null : (
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
                      {isDragging ? 'Drop Component here' : 'Drop Component here'}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#bbb' }}>
                      Column {index + 1} (Max 2 components)
                    </Typography>
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        );
      case COMPONENT_TYPES.SPACER:
        return (
          <Box
            sx={{
              // `?? `, not `|| ` — a Spacer set to 0 is 0 high, not 10.
              height: `${component.properties?.height ?? 100}px`,
              borderBottom: isPreview ? 'none' : '1px dashed #ddd',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: '0.7rem',
            }}
          >
            {isPreview ? '' : `Spacer (${component.properties?.height ?? 100}px)`}
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
            ) : isPreview ? null : (
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
                <Box sx={{ fontSize: '2rem' }}>🖼️</Box>
                <Typography variant="caption" color="text.secondary">
                  Image component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      case COMPONENT_TYPES.GIFT_CARDS:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'normal',
              color: component.properties?.fontColor || '#000000',
              textAlign: component.properties?.textAlign || 'left',
            }}
          >
            {component.properties?.showTitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  fontSize: 'inherit',
                  color: 'inherit',
                  textAlign: 'inherit'
                }}
              >
                {component.properties?.title || 'Gift Cards'}
              </Typography>
            )}
            
            {/* Gift Cards List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {component.properties?.giftCards?.map((giftCard, index) => (
                <Box key={giftCard.id || index} sx={{ mb: 1 }}>
                  {/* Gift Card ID */}
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontSize: 'inherit', 
                      color: 'inherit', 
                      fontWeight: 'bold',
                      mb: 0.5
                    }}
                  >
                    Gift Card {giftCard.id}
                  </Typography>
                  
                  {/* Gift Card Details */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {component.properties?.fields
                      ?.filter(field => field.enabled)
                      ?.sort((a, b) => a.order - b.order)
                      ?.map((field) => (
                        <Box key={field.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                            {field.name}:
                          </Typography>
                          <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit', fontWeight: 'bold' }}>
                            {field.name === 'Original' && `$${giftCard.original?.toFixed(2) || '0.00'}`}
                            {field.name === 'Amount Used' && `$${giftCard.amountUsed?.toFixed(2) || '0.00'}`}
                            {field.name === 'Current' && `$${giftCard.current?.toFixed(2) || '0.00'}`}
                            {field.name === 'Expiry' && giftCard.expiry}
                          </Typography>
                        </Box>
                      ))}
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        );
      case COMPONENT_TYPES.TOTALS:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'normal',
              color: component.properties?.fontColor || '#000000',
              textAlign: component.properties?.textAlign || 'left',
            }}
          >
            {component.properties?.showTitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  fontSize: 'inherit',
                  color: 'inherit',
                  textAlign: 'inherit'
                }}
              >
                {component.properties?.title || 'Totals'}
              </Typography>
            )}
            
            {/* Totals List */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {component.properties?.fields
                ?.filter(field => field.enabled)
                ?.sort((a, b) => a.order - b.order)
                ?.map((field) => (
                  <Box key={field.name} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                      {field.name}:
                    </Typography>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontSize: 'inherit', 
                        color: 'inherit', 
                        fontWeight: field.name === 'Total' ? 'bold' : 'inherit'
                      }}
                    >
                      {field.name === 'Rounding' && `$${component.properties?.totalsData?.rounding?.toFixed(2) || '0.00'}`}
                      {field.name === 'Savings' && `$${component.properties?.totalsData?.savings?.toFixed(2) || '0.00'}`}
                      {field.name === 'Discount' && `$${component.properties?.totalsData?.discount?.toFixed(2) || '0.00'}`}
                      {field.name === 'Total' && `$${component.properties?.totalsData?.total?.toFixed(2) || '0.00'}`}
                      {field.name === 'Change' && `$${component.properties?.totalsData?.change?.toFixed(2) || '0.00'}`}
                    </Typography>
                  </Box>
                ))}
            </Box>
          </Box>
        );
      case COMPONENT_TYPES.ACCOUNT:
        const enabledFields = Object.entries(component.properties?.fields || {})
          .filter(([_, field]) => field.enabled)
          .sort(([_, a], [__, b]) => a.order - b.order);

        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'normal',
              color: component.properties?.fontColor || '#000000',
              textAlign: component.properties?.textAlign || 'left',
              minHeight: 60,
            }}
          >
            {component.properties?.showTitle && (
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  marginBottom: 1,
                  fontSize: `${component.properties?.fontSize || 12}px`,
                  color: component.properties?.fontColor || '#000000',
                }}
              >
                {component.properties?.title || 'Account'}
              </Typography>
            )}
            
            <Box>
              {enabledFields.map(([key, field]) => (
                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', marginBottom: 0.5 }}>
                  <Typography sx={{ fontSize: `${component.properties?.fontSize || 12}px` }}>
                    {field.name}:
                  </Typography>
                  <Typography sx={{ fontSize: `${component.properties?.fontSize || 12}px`, fontWeight: 'bold' }}>
                    ${component.properties?.accountData?.[key]?.toFixed(2) || '0.00'}
                  </Typography>
                </Box>
              ))}
            </Box>
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
                  // Preview expressions resolved against a sample sale, like the
                  // reference's editor (docs/parity/receipt-template.md §11.6).
                  __html: renderExpressions(
                    component.properties?.richTextContent || component.properties?.content || '',
                    previewContext,
                  ),
                }}
              />
            ) : isPreview ? null : (
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
                <Box sx={{ fontSize: '2rem' }}>A</Box>
                <Typography variant="caption" color="text.secondary">
                  Text component empty
                </Typography>
              </Box>
            )}
          </Box>
        );
      case COMPONENT_TYPES.PAYMENTS:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
            }}
          >
            {component.properties?.showTitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  fontSize: 'inherit',
                  color: 'inherit'
                }}
              >
                {component.properties?.title || 'Payments'}
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* Sample payment data for preview */}
              {[
                { name: 'Cash', amount: '$5.00' },
                { name: 'EFTPOS', amount: '$20.00' }
              ].map((payment, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {component.properties?.showPaymentNames && (
                    <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                      {payment.name}
                    </Typography>
                  )}
                  {component.properties?.showAmounts && (
                    <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit', ml: 'auto' }}>
                      {payment.amount}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          </Box>
        );
      case COMPONENT_TYPES.PRODUCTS:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 14}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
            }}
          >
            {/* {component.properties?.showTitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  fontSize: 'inherit',
                  color: 'inherit',
                  bgcolor: '#1976d2',
                  // color: 'white',
                  p: 1,
                  textAlign: 'center'
                }}
              >
                {component.properties?.title || 'Products'}
              </Typography>
            )} */}
            
            {/* Table Header */}
            <Box sx={{ display: 'flex', borderBottom: '1px solid #ccc', mb: 1 }}>
              {component.properties?.fields?.filter(f => f.enabled).map((field, index) => (
                <Box key={index} sx={{ flex: 1, p: 0.5, textAlign: 'center', fontWeight: 'bold', fontSize: 'inherit', color: 'inherit' }}>
                  {field.name}
                </Box>
              ))}
            </Box>
            
            {/* Sample Product Rows */}
            {[
              { name: 'Test No Tax', values: ['24', '2', '$9.99', '$1.00', '$19.98', '$239.76', '$20.98', '48', '$1.00'] },
              { name: 'Test Product*', values: ['24', '2', '$9.99', '$1.00', '$19.98', '$239.76', '$20.98', '48', '$1.00'] }
            ].map((product, productIndex) => (
              <Box key={productIndex}>
                <Box sx={{ display: 'flex', borderBottom: '1px solid #eee', py: 0.5 }}>
                  {component.properties?.fields?.filter(f => f.enabled).map((field, fieldIndex) => (
                    <Box key={fieldIndex} sx={{ flex: 1, p: 0.5, textAlign: 'center', fontSize: 'inherit', color: 'inherit' }}>
                      {fieldIndex === 0 ? product.name : product.values[fieldIndex - 1] || ''}
                    </Box>
                  ))}
                </Box>
                
                {/* Product Notes and Discount Reasons */}
                {(component.properties?.showProductNote || component.properties?.showDiscountReason) && (
                  <Box sx={{ pl: 1, pb: 0.5, fontSize: '0.9em', color: 'inherit' }}>
                    {component.properties?.showProductNote && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'inherit' }}>
                        - Test product note
                      </Typography>
                    )}
                    {component.properties?.showDiscountReason && (
                      <Typography variant="caption" sx={{ display: 'block', color: 'inherit' }}>
                        - Test discount reason
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        );
      case COMPONENT_TYPES.TAX:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              border: component.properties?.border?.enabled 
                ? `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`
                : 'none',
              fontSize: `${component.properties?.fontSize || 12}px`,
              fontWeight: component.properties?.fontWeight || 'Normal',
              color: component.properties?.fontColor || '#000000',
            }}
          >
            {/* {component.properties?.showTitle && (
              <Typography 
                variant="body2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mb: 1,
                  fontSize: 'inherit',
                  color: 'white',
                  bgcolor: '#1976d2',
                  p: 1,
                  textAlign: 'center'
                }}
              >
                {component.properties?.title || 'Tax'}
              </Typography>
            )} */}
            
            {/* Tax Items */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {component.properties?.taxItems?.filter(item => item.enabled).map((item, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                    {item.name}
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: 'inherit', color: 'inherit' }}>
                    {item.name === 'No Tax' ? '$0.00' : 
                     item.name === 'Test Tax' ? '$0.50' :
                     item.name === 'Savings' ? '$2.00' :
                     item.name === 'Discount' ? '$2.00' : '$0.00'}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>
        );
      default:
        return (
          <Box sx={{ color: '#666', fontStyle: 'italic', fontSize: '0.8rem' }}>
            {AVAILABLE_COMPONENTS.find(c => c.type === component.type)?.description || 'Component'}
          </Box>
        );
    }
  };

  const renderPropertiesPanel = () => {
    if (!selectedComponent) {
      return (
        <Box sx={{ p: 2, textAlign: 'center', color: '#666' }}>
          <Typography variant="body2">
            Select a component to edit its properties
          </Typography>
        </Box>
      );
    }

    // Locate the selected component by SEARCHING the tree, not by parsing its id.
    // The old code assumed ids looked like "TYPE-timestamp-col-1-0"; components loaded
    // from storage get adapter ids ("component-6-total", cells "col-6-0"), so every
    // nested block — e.g. the Total inside a Columns cell — resolved to nothing and
    // the Settings sidebar rendered empty.
    let component = receiptComponents.find(c => c.id === selectedComponent);
    let isNestedComponent = false;
    let parentComponent = null;
    let columnId = null;
    let nestedIndex = null;

    if (!component) {
      // The canvas selects a nested block by the composite id it builds for it
      // (`${parent.id}-${column.id}-${index}`), so rebuild the same ids from the tree
      // and compare — string-parsing that id assumed a legacy format and failed for
      // every template loaded from storage.
      for (const parent of receiptComponents) {
        if (parent.type !== COMPONENT_TYPES.COLUMNS) continue;
        for (const column of parent.properties?.columns || []) {
          const children = column.components || [];
          const index = children.findIndex((child, childIndex) =>
            `${parent.id}-${column.id}-${childIndex}` === selectedComponent || child.id === selectedComponent);
          if (index !== -1) {
            component = children[index];
            parentComponent = parent;
            columnId = column.id;
            nestedIndex = index;
            isNestedComponent = true;
            break;
          }
        }
        if (component) break;
      }
    }

    if (!component) return null;

    const componentInfo = AVAILABLE_COMPONENTS.find(c => c.type === component.type);

    // Create update function based on component type
    const updateComponent = (updates) => {
      if (isNestedComponent && parentComponent) {
        handleNestedComponentUpdate(parentComponent.id, columnId, nestedIndex, updates);
      } else {
        handleComponentUpdate(selectedComponent, updates);
      }
    };

    // The reference edits every data block through ONE control: a `Name | Enabled`
    // table bound to the component's stored columns — reorder arrows, an editable
    // display name, an enabled toggle (measured 2026-08-06, see
    // docs/parity/receipts-setup-reference.md). Each panel used to roll its own list
    // against invented keys (taxItems, loyaltyItems, showPaymentNames, an object for
    // Account) that the storage adapter dropped, so those controls changed nothing.
    const renderFieldsTable = (labelsForType) => {
      const fields = Array.isArray(component.properties?.fields) && component.properties.fields.length
        ? component.properties.fields
        // A block created before it carried fields: seed the reference column set.
        : Object.entries(labelsForType || {}).map(([key, name], order) => ({ key, name, enabled: true, order: order + 1 }));

      const commit = (next) => updateComponent({
        properties: {
          ...component.properties,
          fields: next.map((field, index) => ({ ...field, order: index + 1 })),
        },
      });
      const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= fields.length) return;
        const next = [...fields];
        [next[index], next[target]] = [next[target], next[index]];
        commit(next);
      };

      return (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ width: 24 }} />
            <Typography sx={{ flex: 1, fontSize: 16, fontWeight: 700 }}>Name</Typography>
            <Typography sx={{ fontSize: 16, fontWeight: 700 }}>Enabled</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {fields.map((field, index) => (
              <Box key={field.key || field.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <IconButton size="small" sx={{ p: 0 }} disabled={index === 0} onClick={() => move(index, -1)}>
                    <ArrowDropUpIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" sx={{ p: 0 }} disabled={index === fields.length - 1} onClick={() => move(index, 1)}>
                    <ArrowDropDownIcon fontSize="small" />
                  </IconButton>
                </Box>
                <TextField
                  size="small"
                  value={field.name}
                  onChange={(e) => commit(fields.map((f, i) => (i === index ? { ...f, name: e.target.value } : f)))}
                  sx={{ flex: 1 }}
                />
                <ShopfrontSwitch
                  checked={field.enabled === true}
                  onChange={(e) => commit(fields.map((f, i) => (i === index ? { ...f, enabled: e.target.checked } : f)))}
                />
              </Box>
            ))}
          </Box>
        </Box>
      );
    };

    // Single shared Font Weight control — one canonical option set (Normal/Bold/Bolder)
    // and consistent lowercase CSS values, used by every component-type panel.
    const renderFontWeight = () => {
      const raw = String(component.properties?.fontWeight ?? 'normal').toLowerCase();
      const value = ['normal', 'bold', 'bolder'].includes(raw) ? raw : 'normal';
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Weight</Typography>
          <Select
            fullWidth
            size="small"
            value={value}
            onChange={(e) =>
              updateComponent({
                properties: { ...component.properties, fontWeight: e.target.value }
              })
            }
          >
            <MenuItem value="normal">Normal</MenuItem>
            <MenuItem value="bold">Bold</MenuItem>
            <MenuItem value="bolder">Bolder</MenuItem>
          </Select>
        </Box>
      );
    };

    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          {componentInfo?.Icon && <componentInfo.Icon sx={{ fontSize: 20, color: '#676b72' }} />}
          {componentInfo?.label}
          {isNestedComponent && (
            <Typography variant="caption" sx={{ ml: 1, px: 1, py: 0.25, bgcolor: '#e3f2fd', borderRadius: 1 }}>
              In Column
            </Typography>
          )}
        </Typography>

        {component.type === COMPONENT_TYPES.HEADER && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth
              size="small"
              label="Completed Sale"
              value={component.properties?.completedSale || ''}
              onChange={(e) => 
                updateComponent({
                  properties: { ...component.properties, completedSale: e.target.value }
                })
              }
            />
            <TextField
              fullWidth
              size="small"
              label="Parked Sale"
              value={component.properties?.parkedSale || ''}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, parkedSale: e.target.value }
                })
              }
            />
            
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: component.properties?.fontColor || '#000000',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.fontColor || '#000000'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, fontColor: e.target.value }
                    })
                  }
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

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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

            <FormControl fullWidth size="small">
              <InputLabel>Font Size</InputLabel>
              <Select
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
                label="Font Size"
              >
                {[8, 10, 12, 14, 16, 18, 20, 24].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {renderFontWeight()}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Text Align</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { value: 'left', Icon: FormatAlignLeftOutlined },
                  { value: 'center', Icon: FormatAlignCenterOutlined },
                  { value: 'right', Icon: FormatAlignRightOutlined },
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant={component.properties?.textAlign === align.value ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateComponent({
                        properties: { ...component.properties, textAlign: align.value }
                      })
                    }
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      bgcolor: component.properties?.textAlign === align.value ? '#1976d2' : 'transparent',
                      color: component.properties?.textAlign === align.value ? 'white' : 'inherit',
                    }}
                  >
                    <align.Icon fontSize="small" />
                  </Button>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.OUTLET_LOGO && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Remove Image Button */}
            {component.properties?.imageUrl && (
              <Button
                fullWidth
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={() =>
                  updateComponent({
                    properties: { ...component.properties, imageUrl: null }
                  })
                }
                sx={{ mb: 1 }}
              >
                Remove Image
              </Button>
            )}

            {/* Image Upload */}
            {!component.properties?.imageUrl && (
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

            {/* Width */}
            <TextField
              fullWidth
              size="small"
              label="Width"
              value={component.properties?.width || 'auto'}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, width: e.target.value }
                })
              }
              placeholder="auto or pixels (e.g. 100)"
            />

            {/* Height */}
            <TextField
              fullWidth
              size="small"
              label="Height"
              value={component.properties?.height || 'auto'}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, height: e.target.value }
                })
              }
              placeholder="auto or pixels (e.g. 50)"
            />

            {/* Horizontal Alignment */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Horizontal Alignment</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {['flex-start', 'center', 'flex-end'].map((align, index) => {
                  const labels = ['Left', 'Center', 'Right'];
                  const icons = ['≡', '≡', '≡'];
                  return (
                    <Button
                      key={align}
                      size="small"
                      variant={component.properties?.horizontalAlignment === align ? 'contained' : 'outlined'}
                      onClick={() =>
                        updateComponent({
                          properties: { ...component.properties, horizontalAlignment: align }
                        })
                      }
                      sx={{ 
                        flex: 1, 
                        textTransform: 'none',
                        bgcolor: component.properties?.horizontalAlignment === align ? '#2196F3' : 'transparent',
                        color: component.properties?.horizontalAlignment === align ? 'white' : 'inherit',
                      }}
                    >
                      {icons[index]}
                    </Button>
                  );
                })}
              </Box>
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  // For now, just toggle border width between 0 and 1
                  const currentWidth = component.properties?.border?.width || 0;
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: {
                        ...component.properties?.border,
                        width: currentWidth > 0 ? 0 : 1
                      }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
              
              {/* Border Color - only show if border width > 0 */}
              {(component.properties?.border?.width || 0) > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Border Color</Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 30,
                      bgcolor: component.properties?.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={component.properties?.border?.color || '#000000'}
                      onChange={(e) =>
                        updateComponent({
                          properties: {
                            ...component.properties,
                            border: { ...component.properties?.border, color: e.target.value }
                          }
                        })
                      }
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

        {component.type === COMPONENT_TYPES.BARCODE && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Padding Visual Control */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>Padding (in pixels)</Typography>
              <Box sx={{ position: 'relative', mb: 2 }}>
                {/* Visual padding control */}
                <Box
                  sx={{
                    width: 120,
                    height: 80,
                    bgcolor: '#e0e0e0',
                    border: '1px solid #999',
                    position: 'relative',
                    mx: 'auto',
                    mb: 2,
                  }}
                >
                  {/* Inner content area */}
                  <Box
                    sx={{
                      position: 'absolute',
                      top: component.properties?.padding?.top || 0,
                      left: component.properties?.padding?.left || 0,
                      right: component.properties?.padding?.right || 0,
                      bottom: component.properties?.padding?.bottom || 0,
                      bgcolor: '#f5f5f5',
                      border: '1px solid #999',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {/* Center dot */}
                    <Box
                      sx={{
                        width: 4,
                        height: 4,
                        bgcolor: '#fff',
                        borderRadius: '50%',
                      }}
                    />
                  </Box>
                  
                  {/* Padding indicators */}
                  {/* Top padding */}
                  {component.properties?.padding?.top > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: component.properties.padding.top,
                        borderTop: '2px dashed #1976d2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box sx={{ width: 8, height: 1, bgcolor: '#fff' }} />
                    </Box>
                  )}
                  
                  {/* Left padding */}
                  {component.properties?.padding?.left > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: component.properties.padding.left,
                        borderLeft: '2px dashed #1976d2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box sx={{ width: 1, height: 8, bgcolor: '#fff' }} />
                    </Box>
                  )}
                  
                  {/* Right padding */}
                  {component.properties?.padding?.right > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bottom: 0,
                        width: component.properties.padding.right,
                        borderRight: '2px dashed #1976d2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box sx={{ width: 1, height: 8, bgcolor: '#fff' }} />
                    </Box>
                  )}
                  
                  {/* Bottom padding */}
                  {component.properties?.padding?.bottom > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: component.properties.padding.bottom,
                        borderBottom: '2px dashed #1976d2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Box sx={{ width: 8, height: 1, bgcolor: '#fff' }} />
                    </Box>
                  )}
                </Box>
                
                {/* Input fields arranged around the visual */}
                <Box sx={{ position: 'relative', width: 200, height: 120, mx: 'auto' }}>
                  {/* Top input */}
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 60,
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        bgcolor: 'white',
                      }
                    }}
                  />
                  
                  {/* Left input */}
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                    sx={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 60,
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        bgcolor: 'white',
                      }
                    }}
                  />
                  
                  {/* Right input */}
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 60,
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        bgcolor: 'white',
                      }
                    }}
                  />
                  
                  {/* Bottom input */}
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                    sx={{
                      position: 'absolute',
                      bottom: 0,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 60,
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        bgcolor: 'white',
                      }
                    }}
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.COLUMNS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Column Widths */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Column Widths</Typography>
              <Grid container spacing={1}>
                {component.properties?.columnWidths?.map((width, index) => (
                  <Grid item xs={6} key={index}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <TextField
                        size="small"
                        type="number"
                        value={width}
                        onChange={(e) => {
                          const newWidths = [...(component.properties?.columnWidths || [])];
                          newWidths[index] = parseInt(e.target.value) || 0;
                          // Ensure total doesn't exceed 100%
                          const total = newWidths.reduce((sum, w) => sum + w, 0);
                          if (total <= 100) {
                            updateComponent({
                              properties: { ...component.properties, columnWidths: newWidths }
                            });
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
                Total: {(component.properties?.columnWidths || []).reduce((sum, w) => sum + w, 0)}%
              </Typography>
            </Box>

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  const currentWidth = component.properties?.border?.width || 0;
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: {
                        ...component.properties?.border,
                        width: currentWidth > 0 ? 0 : 1
                      }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
              
              {/* Border Color - only show if border width > 0 */}
              {(component.properties?.border?.width || 0) > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Border Color</Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 30,
                      bgcolor: component.properties?.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={component.properties?.border?.color || '#000000'}
                      onChange={(e) =>
                        updateComponent({
                          properties: {
                            ...component.properties,
                            border: { ...component.properties?.border, color: e.target.value }
                          }
                        })
                      }
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
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
                    const currentColumns = component.properties?.columns || [];
                    if (currentColumns.length < 4) { // Max 4 columns
                      const newColumn = { id: `col-${Date.now()}`, components: [] };
                      // ponytail: adding a column resets widths to equal, keeping the total <= 100
                      const newWidth = Math.floor(100 / (currentColumns.length + 1));
                      const newWidths = new Array(currentColumns.length + 1).fill(newWidth);
                      updateComponent({
                        properties: {
                          ...component.properties,
                          columns: [...currentColumns, newColumn],
                          columnWidths: newWidths
                        }
                      });
                    }
                  }}
                  disabled={(component.properties?.columns || []).length >= 4}
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
                    const currentColumns = component.properties?.columns || [];
                    const currentWidths = component.properties?.columnWidths || [];
                    if (currentColumns.length > 1) { // Min 1 column
                      const newColumns = currentColumns.slice(0, -1);
                      const newWidths = currentWidths.slice(0, -1);
                      updateComponent({
                        properties: {
                          ...component.properties,
                          columns: newColumns,
                          columnWidths: newWidths
                        }
                      });
                    }
                  }}
                  disabled={(component.properties?.columns || []).length <= 1}
                  sx={{ flex: 1 }}
                >
                  Remove
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.INDICATOR && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Indicator Settings */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Indicator</Typography>
              <TextField
                fullWidth
                size="small"
                value={component.properties?.indicator || '*'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, indicator: e.target.value }
                  })
                }
                placeholder="*"
              />
            </Box>

            {/* Text Settings */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Text</Typography>
              <TextField
                fullWidth
                size="small"
                value={component.properties?.text || 'Indicates items with'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, text: e.target.value }
                  })
                }
                placeholder="Indicates items with"
              />
            </Box>

            {/* Tax Type Dropdown */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Tax</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.tax || 'No Tax'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, tax: e.target.value }
                  })
                }
              >
                <MenuItem value="No Tax">No Tax</MenuItem>
                <MenuItem value="GST">GST</MenuItem>
                <MenuItem value="VAT">VAT</MenuItem>
                <MenuItem value="Sales Tax">Sales Tax</MenuItem>
                <MenuItem value="Custom">Custom</MenuItem>
              </Select>
            </Box>

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ position: 'relative', width: 60, height: 60, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px dashed #999' }} />
                  <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.SURCHARGE && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* The `Name` / `Amount` switches wrote `showTitle` / `showTotal`, keys the
                storage adapter drops, and the Surcharge canvas is renderer-owned, so
                nothing read them either — fully inert, hence removed. The reference's
                surcharge settings fields are UNMEASURED, so nothing replaces them. */}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ position: 'relative', width: 60, height: 60, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px dashed #999' }} />
                  <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.LOYALTY && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.loyalty)}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ position: 'relative', width: 60, height: 60, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px dashed #999' }} />
                  <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.SPACER && (
          <Box>
            <TextField
              fullWidth
              size="small"
              label="Height"
              type="number"
              value={component.properties?.height ?? 100}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, height: parseInt(e.target.value, 10) || 0 }
                })
              }
            />
          </Box>
        )}

        {component.type === COMPONENT_TYPES.IMAGE && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Image Upload Section */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Image</Typography>
              {component.properties?.imageUrl ? (
                <Box sx={{ mb: 2 }}>
                  <img
                    src={component.properties.imageUrl}
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
                    onClick={() =>
                      updateComponent({
                        properties: { ...component.properties, imageUrl: null }
                      })
                    }
                    sx={{ mt: 1 }}
                  >
                    Remove Image
                  </Button>
                </Box>
              ) : (
                <Box
                  onClick={() => {
                    setMediaDialogFor('image');
                    setMediaDialogOpen(true);
                  }}
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ fontSize: '2rem' }}>🖼️</Box>
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
              value={component.properties?.width || 'auto'}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, width: e.target.value }
                })
              }
              placeholder="auto or pixels (e.g. 100)"
            />

            {/* Height */}
            <TextField
              fullWidth
              size="small"
              label="Height"
              value={component.properties?.height || 'auto'}
              onChange={(e) =>
                updateComponent({
                  properties: { ...component.properties, height: e.target.value }
                })
              }
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
                    variant={component.properties?.horizontalAlignment === align.value ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateComponent({
                        properties: { ...component.properties, horizontalAlignment: align.value }
                      })
                    }
                    sx={{ 
                      flex: 1, 
                      textTransform: 'none',
                      bgcolor: component.properties?.horizontalAlignment === align.value ? '#2196F3' : 'transparent',
                      color: component.properties?.horizontalAlignment === align.value ? 'white' : 'inherit',
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
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  const currentWidth = component.properties?.border?.width || 0;
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: {
                        ...component.properties?.border,
                        width: currentWidth > 0 ? 0 : 1
                      }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
              
              {/* Border Color - only show if border width > 0 */}
              {(component.properties?.border?.width || 0) > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="caption" sx={{ mb: 0.5, display: 'block' }}>Border Color</Typography>
                  <Box
                    sx={{
                      width: '100%',
                      height: 30,
                      bgcolor: component.properties?.border?.color || '#000000',
                      border: '1px solid #ccc',
                      borderRadius: 1,
                      cursor: 'pointer',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    <input
                      type="color"
                      value={component.properties?.border?.color || '#000000'}
                      onChange={(e) =>
                        updateComponent({
                          properties: {
                            ...component.properties,
                            border: { ...component.properties?.border, color: e.target.value }
                          }
                        })
                      }
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

        {component.type === COMPONENT_TYPES.EXTERNAL_RECEIPT && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Text Align */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Text Align</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {[
                  { value: 'left', Icon: FormatAlignLeftOutlined },
                  { value: 'center', Icon: FormatAlignCenterOutlined },
                  { value: 'right', Icon: FormatAlignRightOutlined },
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant={component.properties?.textAlign === align.value ? 'contained' : 'outlined'}
                    onClick={() =>
                      updateComponent({
                        properties: { ...component.properties, textAlign: align.value }
                      })
                    }
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      bgcolor: component.properties?.textAlign === align.value ? '#1976d2' : 'transparent',
                      color: component.properties?.textAlign === align.value ? 'white' : 'inherit',
                    }}
                  >
                    <align.Icon fontSize="small" />
                  </Button>
                ))}
              </Box>
            </Box>

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 5}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 5}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 5}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 5}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  border: '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
            </Box>

            {/* The reference registry gives eftpos ONLY textAlign + padding + border and
                `settings: () => null` — measured 2026-08-07. Font size/weight/colour and
                background were ours; the EFT slip is printed verbatim from the pad. */}
          </Box>
        )}

        {component.type === COMPONENT_TYPES.GIFT_CARDS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.gift_cards)}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: component.properties?.fontColor || '#000000',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.fontColor || '#000000'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, fontColor: e.target.value }
                    })
                  }
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
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  border: '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.TOTALS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.total)}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  bgcolor: component.properties?.fontColor || '#000000',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.fontColor || '#000000'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, fontColor: e.target.value }
                    })
                  }
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
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  border: '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.ACCOUNT && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.account)}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="color"
                  value={component.properties?.fontColor || '#000000'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, fontColor: e.target.value }
                    })
                  }
                  style={{ width: 40, height: 40, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <TextField
                  size="small"
                  value={component.properties?.fontColor || '#000000'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, fontColor: e.target.value }
                    })
                  }
                  sx={{ width: 120 }}
                />
              </Box>
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
                  style={{ width: 40, height: 40, border: '1px solid #ccc', borderRadius: 4 }}
                />
                <TextField
                  size="small"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
                  sx={{ width: 120 }}
                />
              </Box>
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={component.properties?.fontSize || 12}
                  onChange={(e) => 
                    updateComponent({
                      properties: { ...component.properties, fontSize: e.target.value }
                    })
                  }
                >
                  {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) => 
                      updateComponent({
                        properties: { 
                          ...component.properties, 
                          padding: { ...component.properties.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) => 
                      updateComponent({
                        properties: { 
                          ...component.properties, 
                          padding: { ...component.properties.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) => 
                      updateComponent({
                        properties: { 
                          ...component.properties, 
                          padding: { ...component.properties.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) => 
                      updateComponent({
                        properties: { 
                          ...component.properties, 
                          padding: { ...component.properties.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box
                sx={{
                  width: '100%',
                  height: 40,
                  border: `${component.properties?.border?.width || 1}px ${component.properties?.border?.style || 'solid'} ${component.properties?.border?.color || '#000000'}`,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#f5f5f5',
                }}
              >
                <Button
                  size="small"
                  variant="outlined"
                  onClick={async () => {
                    const width = await prompt('Border width (px):', component.properties?.border?.width || 1, { title: 'Border' });
                    const color = await prompt('Border colour (hex):', component.properties?.border?.color || '#000000', { title: 'Border' });
                    if (width && color) {
                      updateComponent({
                        properties: { 
                          ...component.properties, 
                          border: { 
                            ...component.properties.border, 
                            width: parseInt(width) || 1,
                            color: color
                          }
                        }
                      });
                    }
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.TEXT && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Edit Text Button */}
            <Box>
              <Button
                fullWidth
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  setTextEditorOpen(true);
                  setTextEditorContent(component.properties?.richTextContent || component.properties?.content || '');
                }}
                sx={{ 
                  textTransform: 'none',
                  bgcolor: '#32b643',
                  '&:hover': { bgcolor: '#2ca03b' }
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
                  bgcolor: component.properties?.backgroundColor || '#ffffff',
                  border: '1px solid #ccc',
                  borderRadius: 1,
                  cursor: 'pointer',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <input
                  type="color"
                  value={component.properties?.backgroundColor || '#ffffff'}
                  onChange={(e) =>
                    updateComponent({
                      properties: { ...component.properties, backgroundColor: e.target.value }
                    })
                  }
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
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
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
                  border: '1px solid #999',
                  borderRadius: 0.5
                }} />
              </Box>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={() => {
                  // Toggle border enabled
                  updateComponent({
                    properties: {
                      ...component.properties,
                      border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                    }
                  });
                }}
                sx={{ textTransform: 'none' }}
              >
                Edit Border
              </Button>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.PAYMENTS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.payment)}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField
                  size="small"
                  label="Top"
                  type="number"
                  value={component.properties?.padding?.top || 0}
                  onChange={(e) =>
                    updateComponent({
                      properties: {
                        ...component.properties,
                        padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                      }
                    })
                  }
                />
                <TextField
                  size="small"
                  label="Right"
                  type="number"
                  value={component.properties?.padding?.right || 0}
                  onChange={(e) =>
                    updateComponent({
                      properties: {
                        ...component.properties,
                        padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                      }
                    })
                  }
                />
                <TextField
                  size="small"
                  label="Bottom"
                  type="number"
                  value={component.properties?.padding?.bottom || 0}
                  onChange={(e) =>
                    updateComponent({
                      properties: {
                        ...component.properties,
                        padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                      }
                    })
                  }
                />
                <TextField
                  size="small"
                  label="Left"
                  type="number"
                  value={component.properties?.padding?.left || 0}
                  onChange={(e) =>
                    updateComponent({
                      properties: {
                        ...component.properties,
                        padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                      }
                    })
                  }
                />
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={component.properties?.border?.enabled || false}
                      onChange={(e) =>
                        updateComponent({
                          properties: {
                            ...component.properties,
                            border: { ...component.properties?.border, enabled: e.target.checked }
                          }
                        })
                      }
                      size="small"
                    />
                  }
                  label="Enable Border"
                />
                {component.properties?.border?.enabled && (
                  <input
                    type="color"
                    value={component.properties?.border?.color || '#000000'}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          border: { ...component.properties?.border, color: e.target.value }
                        }
                      })
                    }
                    style={{
                      width: '100%',
                      height: '30px',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.PRODUCTS && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
              {renderFieldsTable(COLUMN_LABELS.product)}
            </Box>

            {/* Display Options */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Display Options</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={component.properties?.showDiscountReason !== false}
                      onChange={(e) =>
                        updateComponent({
                          properties: { ...component.properties, showDiscountReason: e.target.checked }
                        })
                      }
                      size="small"
                    />
                  }
                  label="Show discount reason"
                />
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={component.properties?.showProductNote !== false}
                      onChange={(e) =>
                        updateComponent({
                          properties: { ...component.properties, showProductNote: e.target.checked }
                        })
                      }
                      size="small"
                    />
                  }
                  label="Show product note"
                />
              </Box>
            </Box>

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 14}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ position: 'relative', width: 60, height: 60, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px dashed #999' }} />
                  <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.TAX && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. */}
            {renderFieldsTable(COLUMN_LABELS.tax)}

            {/* The second `Tax Items` list edited `properties.taxItems`, a key the storage
                adapter drops — renaming or disabling a row there reverted on save. The
                Name|Enabled table above IS the tax component's column set. */}

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <input
                type="color"
                value={component.properties?.fontColor || '#000000'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Background Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Background Colour</Typography>
              <input
                type="color"
                value={component.properties?.backgroundColor || '#ffffff'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, backgroundColor: e.target.value }
                  })
                }
                style={{
                  width: '100%',
                  height: '40px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
            </Box>

            {/* Font Size */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Size</Typography>
              <Select
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {[8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32].map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {/* Padding */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (in pixels)</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ position: 'relative', width: 60, height: 60, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px dashed #999' }} />
                  <Box sx={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 8, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                  <Box sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 8, height: 1, bgcolor: '#999' }} />
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, flex: 1 }}>
                  <TextField
                    size="small"
                    label="Top"
                    type="number"
                    value={component.properties?.padding?.top || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, top: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Left"
                    type="number"
                    value={component.properties?.padding?.left || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, left: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Right"
                    type="number"
                    value={component.properties?.padding?.right || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, right: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                  <TextField
                    size="small"
                    label="Bottom"
                    type="number"
                    value={component.properties?.padding?.bottom || 0}
                    onChange={(e) =>
                      updateComponent({
                        properties: {
                          ...component.properties,
                          padding: { ...component.properties?.padding, bottom: clampPad(e.target.value) }
                        }
                      })
                    }
                  />
                </Box>
              </Box>
            </Box>

            {/* Border */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ position: 'relative', width: '100%', height: 40, border: '1px solid #ccc', bgcolor: '#f5f5f5' }}>
                  <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 8, bgcolor: 'white', border: '1px solid #999' }} />
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<span>✏️</span>}
                  onClick={() => {
                    // Toggle border enabled
                    updateComponent({
                      properties: {
                        ...component.properties,
                        border: { ...component.properties?.border, enabled: !component.properties?.border?.enabled }
                      }
                    });
                  }}
                >
                  Edit Border
                </Button>
              </Box>
            </Box>
          </Box>
        )}

        {component.type === COMPONENT_TYPES.TEXT && (
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
                  bgcolor: '#f5f5f5'
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
                
                {/* Special Characters */}
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
                
                {/* Font Style */}
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
                
                {/* Font Size */}
                <Select 
                  size="small" 
                  defaultValue="16" 
                  sx={{ minWidth: 70 }}
                  onChange={(e) => applyFontSize(e.target.value)}
                >
                  <MenuItem value="8">8px</MenuItem>
                  <MenuItem value="10">10px</MenuItem>
                  <MenuItem value="12">12px</MenuItem>
                  <MenuItem value="14">14px</MenuItem>
                  <MenuItem value="16">16px</MenuItem>
                  <MenuItem value="18">18px</MenuItem>
                  <MenuItem value="20">20px</MenuItem>
                  <MenuItem value="24">24px</MenuItem>
                  <MenuItem value="28">28px</MenuItem>
                  <MenuItem value="32">32px</MenuItem>
                  <MenuItem value="36">36px</MenuItem>
                </Select>
                
                <Divider orientation="vertical" flexItem />
                
                {/* Text Alignment */}
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
                
                {/* Lists */}
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
                
                {/* Indentation */}
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
                
                {/* Other Tools */}
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
              
              {/* Text Content Area */}
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
                  // Handle keyboard shortcuts
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
            <DialogActions sx={{ p: 2 }}>
              <Button onClick={() => setTextEditorOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={() => {
                  updateComponent({
                    properties: {
                      ...component.properties,
                      richTextContent: textEditorContent,
                      content: textEditorContent.replace(/<[^>]*>/g, '') // Strip HTML for plain text fallback
                    }
                  });
                  setTextEditorOpen(false);
                }}
              >
                Save
              </Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Link Dialog */}
        {component.type === COMPONENT_TYPES.TEXT && (
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
            <DialogContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Link Title */}
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
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        '& fieldset': {
                          borderColor: '#e0e0e0',
                        },
                        '&:hover fieldset': {
                          borderColor: '#bdbdbd',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#1976d2',
                        },
                      },
                    }}
                  />
                </Box>

                {/* Link Target */}
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                    Link Target
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="https://example.com"
                    value={linkData.target}
                    onChange={(e) => setLinkData({ ...linkData, target: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 1,
                        '& fieldset': {
                          borderColor: '#e0e0e0',
                        },
                        '&:hover fieldset': {
                          borderColor: '#bdbdbd',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: '#1976d2',
                        },
                      },
                    }}
                  />
                </Box>

                {/* Open in New Window Checkbox */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ShopfrontSwitch
                    checked={linkData.openInNewWindow}
                    onChange={(e) => setLinkData({ ...linkData, openInNewWindow: e.target.checked })}
                    color="primary"
                    size="small"
                  />
                  <Typography variant="body2" sx={{ color: '#666' }}>
                    Open link in new window
                  </Typography>
                </Box>
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1 }}>
              <Button
                onClick={() => setLinkDialogOpen(false)}
                sx={{
                  borderRadius: 1,
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  border: '1px solid #e0e0e0',
                  color: '#666',
                  '&:hover': {
                    backgroundColor: '#f5f5f5',
                    borderColor: '#bdbdbd',
                  },
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleLinkSubmit}
                disabled={!linkData.title || !linkData.target}
                variant="contained"
                sx={{
                  borderRadius: 1,
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  backgroundColor: linkData.title && linkData.target ? '#1976d2' : '#e0e0e0',
                  color: linkData.title && linkData.target ? '#fff' : '#999',
                  '&:hover': {
                    backgroundColor: linkData.title && linkData.target ? '#1565c0' : '#e0e0e0',
                  },
                  '&:disabled': {
                    backgroundColor: '#e0e0e0',
                    color: '#999',
                  },
                }}
              >
                Add
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    );
  };

  if (loading) {
    return <PageLoader />;
  }

  // A template that failed to load must not open as an editable EMPTY canvas —
  // one Save then replaced the real layout with zero components.
  if (error && !template) {
    return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;
  }

  return (
    // The route renders under DashboardLayout's 50px app bar, so a 100vh root made
    // the whole window scroll and pushed Preview/Cancel/Save below the fold. Same
    // sum StatementEditor uses.
    <Box sx={{ height: 'calc(100vh - 50px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Top Bar — name group centred above the paper (reference layout) */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          // Measured: the name group is CENTRED over the canvas column, so the
          // 400px settings panel has to be discounted from the centring box.
          justifyContent: 'center',
          p: 2,
          pr: '400px',
          bgcolor: '#f7f7f7',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" sx={{ color: '#1a1a1a', fontWeight: 500 }}>
              Receipt -
            </Typography>
            <TextField
              // Must be the template's OWN name: the old `|| 'A4 Invoice'` fallback showed
              // a name that was neither in state nor saved (the Save gate skips a blank one).
              value={template?.name ?? ''}
              onChange={(e) => {
                // Handle template name change
                if (template) {
                  setTemplate({ ...template, name: e.target.value });
                }
              }}
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
                  // Measured 16px/400 — size="small" otherwise drops the input to 14px.
                  fontSize: 16,
                  fontWeight: 400,
                },
              }}
            />
            <IconButton
              onClick={openConfigure}
              sx={{
                // Measured: white icon on neutral-500 oklch(0.556 0 0), hover neutral-600.
                bgcolor: '#737373',
                color: 'white',
                borderRadius: 1, // rounded-sm
                width: 41,
                height: 40,
                p: 1.5, // p-3
                '&:hover': {
                  bgcolor: '#525252',
                },
              }}
            >
              {/* 41x40 with p-3 (12px) leaves a 17x16 content box — MUI's default 24px
                  glyph overflowed it on all four sides. */}
              <SettingsIcon sx={{ fontSize: 16 }} />
            </IconButton>
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
        {/* Receipt Canvas */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Measured: dark surround bg-neutral-700 oklch(0.371 0 0), p-8, overflow-auto. */}
          <Box sx={{ flex: 1, p: 4, overflow: 'auto', bgcolor: '#404040' }}>
            <Paper
              ref={canvasRef}
              sx={{
                // Configure > Receipt Width is the paper the merchant designs against;
                // without it the canvas stayed 80mm while the printed receipt was 40mm.
                width: paperWidthMm(template)
                  ? `${paperWidthMm(template)}mm`
                  : isWideTemplate(template) ? '210mm' : `${canvasSettings.width}mm`,
                minHeight: isWideTemplate(template) && !paperWidthMm(template) ? '297mm' : 'auto',
                mx: 'auto',
                pt: `${canvasSettings.receiptPadding?.top ?? 0}px`,
                pr: `${canvasSettings.receiptPadding?.right ?? 0}px`,
                pb: `${canvasSettings.receiptPadding?.bottom ?? 0}px`,
                pl: `${canvasSettings.receiptPadding?.left ?? 0}px`,
                bgcolor: canvasSettings.backgroundColor,
                // Measured paper: `border border-black text-black bg-white`, flat.
                border: '1px solid #000',
                borderRadius: 0,
                boxShadow: 'none',
                color: '#000',
                position: 'relative',
                cursor: 'default',
              }}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedComponent(null);
                }
              }}
              onDragOver={handleDragOver}
              onDrop={handleDropOnCanvas}
            >
              {receiptComponents.map(renderComponent)}
              
              {receiptComponents.length === 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 200,
                    color: '#999',
                    border: '2px dashed #ddd',
                    borderRadius: 1,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedComponent(null);
                  }}
                >
                  <Typography variant="body2">
                    Drop Component here
                  </Typography>
                </Box>
              )}
            </Paper>
          </Box>
        </Box>

        {/* Sidebar with Tabs */}
        <Paper sx={{ width: 400, borderRadius: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab Header — no container rule: measured 5.2 gives the strip as
              `grid grid-cols-2 w-full` and an inactive/disabled tab has NO bottom border. */}
          <Box sx={{ bgcolor: '#f8f9fa' }}>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="fullWidth"
              sx={{
                // Measured 2026-08-07 (viewport 1920, panel 400): tabs 200x64, 18px/400,
                // py-4 border-b-4. ACTIVE = black label + bg-neutral-200 + blue-500
                // underline. INACTIVE/DISABLED = neutral-500 label, NO bottom border and
                // no background of its own. See docs/parity/receipt-editor-measured-2026-08-07.md.
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
                  // Reference active-tab underline is Tailwind blue-500 (#3b82f6), not brand #5ebbeb.
                  backgroundColor: '#3b82f6',
                }
              }}
            >
              <Tab label="Components" icon={<WidgetsOutlined />} iconPosition="start" />
              <Tab label="Settings" icon={<SettingsOutlined />} iconPosition="start" disabled={!selectedComponent} />
            </Tabs>
          </Box>

          {/* Tab Content — reference panel is white; the tiles are transparent so the
              panel colour is what shows between them. */}
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: '#fff' }}>
            {activeTab === 0 && (
              <Box sx={{ p: 2 }}>
                <Grid container spacing={1.5}>
                  {AVAILABLE_COMPONENTS.map((comp) => (
                    <Grid item xs={4} key={comp.type}>
                      <Card
                        draggable
                        sx={{
                          cursor: 'pointer',
                          transition: 'none',
                          boxShadow: 'none',
                          '&:hover': {
                            bgcolor: '#ebebeb',
                          },
                          // Measured reference tile: 96x96 square, transparent, 1px #ddd,
                          // radius 4, centred in a 112-wide grid cell.
                          width: 96,
                          height: 96,
                          mx: 'auto',
                          bgcolor: 'transparent',
                          border: '1px solid #ddd',
                          opacity: draggedFromPalette === comp.type ? 0.5 : 1,
                          borderRadius: 1,
                        }}
                        onClick={() => handleAddComponent(comp.type)}
                        onDragStart={(e) => handleDragStart(e, comp.type, true)}
                        onDragEnd={handleDragEnd}
                      >
                        <CardContent sx={{
                          // Measured reference tile padding is 4px, not 8.
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
                            // Measured reference label: 16px/400 black.
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
                  // Design-system inputs/selects: radius 8, #404040 1px notch, #000 2px focus.
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

          {/* Bottom controls — measured 5.5: all three are ONE right-aligned group at the
              bottom-right of the panel (Preview · Cancel · Save). */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 1,
              // Measured reference footer: 16px padding, 1px SOLID BLACK top rule.
              p: 2,
              borderTop: '1px solid #000',
            }}
          >
            {/* Measured reference: Preview (81) and Cancel (73) are text-only; only Save
                carries an icon. Icons here pushed both past the measured widths. */}
            <Button
              onClick={() => setPreviewOpen((v) => !v)}
              sx={{
                borderRadius: 0,
                bgcolor: '#f8f8f8',
                color: '#676b72',
                border: '1px solid #676b72',
                fontSize: 18,
                fontWeight: 400,
                textTransform: 'none',
                // Measured reference footer buttons: 32px tall, padding 4px 8px.
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
                  // Measured reference footer buttons: 32px tall, padding 4px 8px.
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
                  // Measured reference footer buttons: 32px tall, padding 4px 8px.
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


      {/* Unsaved-changes prompt — the reference's own shape: title "Save", body
          "Save <name>?", and Yes / No / Cancel (measured 2026-08-06). */}
      <Dialog open={leavePrompt} onClose={() => setLeavePrompt(false)} maxWidth="xs">
        <DialogContent sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Save</Typography>
          <Typography variant="body1">Save {template?.name || 'receipt'}?</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'center', gap: 1 }}>
          <Button
            variant="contained"
            onClick={async () => {
              const ok = await handleSave();
              setLeavePrompt(false);
              if (ok) leaveEditor();
            }}
            disabled={saving}
            sx={{ bgcolor: '#1c86f2', color: '#f8f8f8', borderRadius: 0, textTransform: 'none', fontSize: 18, minWidth: 72 }}
          >
            Yes
          </Button>
          <Button
            variant="contained"
            onClick={() => { setLeavePrompt(false); leaveEditor(); }}
            sx={{ bgcolor: '#e3342f', color: '#f8f8f8', borderRadius: 0, textTransform: 'none', fontSize: 18, minWidth: 72, '&:hover': { bgcolor: '#cc2f2a' } }}
          >
            No
          </Button>
          <Button
            onClick={() => setLeavePrompt(false)}
            sx={{ bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', borderRadius: 0, textTransform: 'none', fontSize: 18, minWidth: 88 }}
          >
            Cancel
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
            const component = receiptComponents.find(c => c.id === selectedComponent);
            if (component) {
              handleComponentUpdate(selectedComponent, {
                properties: { ...component.properties, imageUrl: imageUrl }
              });
            }
          }
        }}
        accept="image/*"
      />

      {/* Configure Receipt — the SAME dialog the list page's Configure action opens. */}
      <ConfigureReceiptDialog
        open={configOpen}
        template={template}
        value={configDraft}
        onChange={setConfigDraft}
        onCancel={() => setConfigOpen(false)}
        onConfirm={confirmConfigure}
        a4Templates={a4Templates}
        error={configError}
        onErrorClose={() => setConfigError('')}
      />
    </Box>
  );
};

export default ReceiptEditor;
