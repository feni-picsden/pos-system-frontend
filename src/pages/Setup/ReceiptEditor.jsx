import React, { useState, useEffect, useRef, useMemo } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import NumberField from '../../components/Common/NumberField';
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
  Snackbar,
  Chip,
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
  Edit as EditIcon,
  Close as CloseIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
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
  RequestQuoteOutlined,
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
import { taxRateService } from '../../services/taxRateService';
import MediaDialog from '../../components/Common/MediaDialog';
import ColorInput from '../../components/Common/ColorInput';
import SavePromptDialog from '../../components/Common/SavePromptDialog';
import BorderSettingsDialog, { REF_MENU_PROPS, BLUE, DARK } from '../../components/Common/BorderSettingsDialog';
import { toEditorComponents, toReferenceComponents, toReferenceComponent, COLUMN_LABELS, isWideTemplate, paperWidthMm, isEmailTemplate, isTextOnlyTemplate, applyReceiptConfig, isPaymentTemplate, borderToCss, BORDER_SIDES } from '../../utils/receiptTemplateShape';
import ConfigureReceiptDialog from '../../components/Receipt/ConfigureReceiptDialog';
import { renderExpressions, sampleReceiptContext } from '../../utils/receiptExpressions';
import { ReferenceComponent } from '../../components/Receipt/ReferenceReceipt';
import { sampleReferenceData, samplePaymentReferenceData } from '../../utils/referenceReceiptData';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard';

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
  INVOICES: 'invoices',
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
  { type: COMPONENT_TYPES.INVOICES, label: 'Invoices', Icon: RequestQuoteOutlined, description: 'Invoices paid' },
];

// Reference palettes: a sale receipt offers every block except Invoices; an
// account payment receipt offers only these, in this order (reference Payment
// Receipt editor, 28/10/2026).
const SALE_PALETTE = AVAILABLE_COMPONENTS.filter((c) => c.type !== COMPONENT_TYPES.INVOICES);
const PAYMENT_PALETTE = [
  COMPONENT_TYPES.BARCODE, COMPONENT_TYPES.OUTLET_LOGO, COMPONENT_TYPES.INVOICES,
  COMPONENT_TYPES.TOTALS, COMPONENT_TYPES.PAYMENTS, COMPONENT_TYPES.EXTERNAL_RECEIPT,
  COMPONENT_TYPES.TEXT, COMPONENT_TYPES.IMAGE, COMPONENT_TYPES.COLUMNS, COMPONENT_TYPES.SPACER,
].map((type) => AVAILABLE_COMPONENTS.find((c) => c.type === type));

// Generic / Text Only receipts are for printers that cannot print images, so the
// image-type blocks are not offered there (reference: "Normal Receipt - ... can
// include images", text-only cannot).
const IMAGE_TYPES = [COMPONENT_TYPES.OUTLET_LOGO, COMPONENT_TYPES.IMAGE, COMPONENT_TYPES.BARCODE];

// A Columns cell holds at most this many components.
const MAX_PER_CELL = 2;

// One font-size option list for every panel. A size stored by another editor (the
// adapter reads reference-authored blocks as 11) that is not in the list is kept as
// an option, so the Select never renders blank or snaps the value on first change.
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 24, 30, 36, 48, 60, 72, 96];
const fontSizeOptions = (current) => {
  const n = Number(current);
  return Number.isFinite(n) && n > 0 && !FONT_SIZES.includes(n)
    ? [...FONT_SIZES, n].sort((a, b) => a - b)
    : FONT_SIZES;
};

// Padding is a pixel offset and must never be negative: coerce empty/NaN/negative to 0.
const clampPad = (v) => Math.max(0, parseInt(v, 10) || 0);

const ReceiptEditor = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { prompt, confirm } = useAppDialogs();
  const { templateId } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState(null);
  // "Account Payment Receipt" templates get the payment palette, panels and preview.
  const paymentTemplate = isPaymentTemplate(template);
  // Generic / Text Only templates get no image-type blocks.
  const textOnlyTemplate = isTextOnlyTemplate(template);
  // Short notices (e.g. "column is full") — a drop that is refused must say so.
  const [notice, setNotice] = useState('');
  // Border Settings dialog: { value, apply } for the component being edited.
  const [borderDialog, setBorderDialog] = useState(null);
  // Padding link (centre button): ON = typing one side sets all four.
  const [paddingLinked, setPaddingLinked] = useState(false);
  // Tax Indicator "Tax" options: the store's tax rates (Setup > Tax Rates).
  const [taxNames, setTaxNames] = useState([]);
  // Reference "* Indicates items with GST": a new indicator names the outlet's
  // DEFAULT tax rate (Setup > Tax Rates), not a fixed "No Tax".
  const [defaultTaxName, setDefaultTaxName] = useState('GST');
  useEffect(() => {
    let alive = true;
    taxRateService.getTaxRates()
      .then(({ taxRates }) => {
        if (!alive) return;
        const names = (taxRates || [])
          .filter((t) => t && t.name && t.isActive !== false)
          .map((t) => t.name)
          .filter((name, i, all) => name !== 'No Tax' && all.indexOf(name) === i);
        setTaxNames(names);
        const def = (taxRates || []).find((t) => t && t.isDefault && t.name);
        if (def) setDefaultTaxName(def.name);
      })
      .catch((err) => console.error('Error loading tax rates:', err));
    return () => { alive = false; };
  }, []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Receipt design state
  const [receiptComponents, setReceiptComponents] = useState([]);
  const [selectedComponent, setSelectedComponent] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFromPalette, setDraggedFromPalette] = useState(null);
  const [textEditorOpen, setTextEditorOpen] = useState(false);
  const [textEditorContent, setTextEditorContent] = useState('');
  const [textEditorRef, setTextEditorRef] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Reference asks "Save <name>?" (Yes / No / Cancel) when you leave the editor with
  // unsaved edits — measured 2026-08-06. We used to discard silently.
  const [leavePrompt, setLeavePrompt] = useState(false);
  // What the prompt should run once the user answers Yes or No - Cancel, the
  // sidebar and browser Back each leave the editor for a different place.
  const pendingLeaveRef = useRef(null);
  const savedSnapshot = useRef('');
  // The unsaved-changes baseline covers the components AND the header name field —
  // a rename used to leave through Cancel with no prompt and was lost.
  const snapshotOf = (components, name) =>
    JSON.stringify({ components: toReferenceComponents(components), name: name ?? '' });
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
    // loadTemplate reads templateId itself; re-running on its identity would refetch
    // on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      savedSnapshot.current = snapshotOf(loaded, response.template.name);
      
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
      savedSnapshot.current = snapshotOf(receiptComponents, template?.name);
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
    savedSnapshot.current !== snapshotOf(receiptComponents, template?.name);

  const leaveEditor = () => navigate('/setup/receipts');

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

  // Image-type blocks are not offered on a Generic / Text Only template.
  const isAllowedType = (componentType) => !(textOnlyTemplate && IMAGE_TYPES.includes(componentType));

  // `atIndex` inserts at that position (a palette tile dropped ON a component lands
  // where it was dropped, not at the end); omitted, the block is appended.
  const handleAddComponent = (componentType, atIndex) => {
    if (!isAllowedType(componentType)) return;
    const newComponent = {
      id: `${componentType}-${Date.now()}`,
      type: componentType,
      properties: getDefaultProperties(componentType),
      visible: true,
    };
    setReceiptComponents((prev) => {
      const next = [...prev];
      next.splice(atIndex == null || atIndex < 0 ? next.length : atIndex, 0, newComponent);
      return next;
    });
    setSelectedComponent(newComponent.id);
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
      case COMPONENT_TYPES.INVOICES:
        return {
          fields: fieldDefaults('invoices'),
          fontColor: '#000000',
          backgroundColor: '#ffffff',
          fontSize: 12,
          fontWeight: 'normal',
          padding: { top: 0, right: 0, bottom: 0, left: 0 },
          border: { enabled: false, width: 1, color: '#000000', style: 'solid' },
        };
      case COMPONENT_TYPES.TOTALS:
        return {
          // Columns from the reference set, in reference order, keyed the way the
          // storage adapter matches — so a fresh block saves real columns. A payment
          // template's Totals block carries the payment columns.
          fields: fieldDefaults(paymentTemplate ? 'paymentTotal' : 'total'),
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
        // Text stores background / padding / border only (measured whitelist); its
        // font, size, colour and alignment live in the rich-text HTML. The font keys
        // that used to sit here drew 16px on the canvas while the receipt printed 12px.
        return {
          backgroundColor: '#ffffff',
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
          tax: defaultTaxName,
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

  // ---- component tree helpers (top level + Columns cells) ----------------------
  // A position is { kind: 'top', index } or { kind: 'cell', parentId, columnId, index };
  // a drag source is { kind: 'top', id } or { kind: 'cell', parentId, columnId, index }.
  const findCell = (tree, parentId, columnId) => tree
    .find((c) => c.id === parentId && c.type === COMPONENT_TYPES.COLUMNS)
    ?.properties?.columns?.find((col) => col.id === columnId);

  const mapCell = (tree, parentId, columnId, fn) => tree.map((c) => (
    c.id === parentId && c.type === COMPONENT_TYPES.COLUMNS
      ? {
          ...c,
          properties: {
            ...c.properties,
            columns: c.properties.columns.map((col) => (
              col.id === columnId ? { ...col, components: fn(col.components || []) } : col
            )),
          },
        }
      : c
  ));

  // Insert `comp` at a position. Returns { tree } or { error } (cell full, a Columns
  // block into a cell).
  const insertAt = (tree, comp, target) => {
    if (target.kind === 'top') {
      const next = [...tree];
      next.splice(target.index == null ? next.length : target.index, 0, comp);
      return { tree: next };
    }
    if (comp.type === COMPONENT_TYPES.COLUMNS) return { error: 'Columns cannot be placed inside a column' };
    const cell = findCell(tree, target.parentId, target.columnId);
    if (!cell) return { error: 'Column not found' };
    if ((cell.components || []).length >= MAX_PER_CELL) {
      return { error: `This column is full (max ${MAX_PER_CELL} components)` };
    }
    return {
      tree: mapCell(tree, target.parentId, target.columnId, (list) => {
        const next = [...list];
        next.splice(target.index == null ? next.length : target.index, 0, comp);
        return next;
      }),
    };
  };

  // Move an existing component from `source` to `target`. Pure — returns the new
  // tree, or { error } and the tree unchanged.
  const moveComponent = (tree, source, target) => {
    let comp;
    let rest;
    const to = { ...target };
    if (source.kind === 'top') {
      const from = tree.findIndex((c) => String(c.id) === String(source.id));
      if (from === -1) return { tree };
      comp = tree[from];
      rest = tree.filter((_, i) => i !== from);
      if (to.kind === 'top' && to.index != null && to.index > from) to.index -= 1;
    } else {
      const cell = findCell(tree, source.parentId, source.columnId);
      comp = cell?.components?.[source.index];
      if (!comp) return { tree };
      rest = mapCell(tree, source.parentId, source.columnId, (list) => list.filter((_, i) => i !== source.index));
      if (to.kind === 'cell' && to.parentId === source.parentId && to.columnId === source.columnId
        && to.index != null && to.index > source.index) to.index -= 1;
    }
    // Dropping a Columns block into one of its own cells would delete it.
    if (to.kind === 'cell' && to.parentId === comp.id) return { tree, error: 'Columns cannot be placed inside a column' };
    // Crossing between the top level and a cell gets a fresh id: loaded ids are
    // index-based and can collide between the two levels.
    const crosses = source.kind !== to.kind;
    const moved = crosses ? { ...comp, id: `${comp.type}-${Date.now()}` } : comp;
    const result = insertAt(rest, moved, to);
    return result.error ? { tree, error: result.error } : result;
  };

  const readSource = (e) => {
    try {
      return JSON.parse(e.dataTransfer.getData('componentSource') || 'null');
    } catch {
      return null;
    }
  };

  // Handles every drop: a palette tile is added at `target`, a dragged component is
  // moved there. A refused drop says why instead of doing nothing.
  const dropAt = (e, target) => {
    e.preventDefault();
    e.stopPropagation();
    const paletteType = e.dataTransfer.getData('componentType');
    const source = readSource(e);
    if (paletteType && draggedFromPalette) {
      if (!isAllowedType(paletteType)) {
        setNotice('Images are not printed on text-only receipts');
      } else if (target.kind === 'top') {
        handleAddComponent(paletteType, target.index);
      } else {
        const fresh = {
          id: `${paletteType}-${Date.now()}`,
          type: paletteType,
          properties: getDefaultProperties(paletteType),
          visible: true,
        };
        const result = insertAt(receiptComponents, fresh, target);
        if (result.error) setNotice(result.error);
        else setReceiptComponents(result.tree);
      }
    } else if (source) {
      const result = moveComponent(receiptComponents, source, target);
      if (result.error) {
        setNotice(result.error);
      } else if (result.tree !== receiptComponents) {
        setReceiptComponents(result.tree);
        // Nested selection ids are positional; a move can leave them pointing elsewhere.
        if (source.kind === 'cell' || target.kind === 'cell') setSelectedComponent(null);
      }
    }
    handleDragEnd();
  };

  // `payload`: the palette type when fromPalette, otherwise a drag source.
  const handleDragStart = (e, payload, fromPalette = false) => {
    e.stopPropagation(); // a nested block's drag must not become its Columns parent's
    setIsDragging(true);
    if (fromPalette) {
      setDraggedFromPalette(payload);
      e.dataTransfer.setData('componentType', payload);
    } else {
      e.dataTransfer.setData('componentSource', JSON.stringify(payload));
    }
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
    setDraggedFromPalette(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  // Paper: append / move to the end. A component: take its position. A cell: append
  // to that cell. A nested component: take its position in its cell.
  const handleDropOnCanvas = (e) => dropAt(e, { kind: 'top', index: null });
  const handleDropOnComponent = (e, targetId) =>
    dropAt(e, { kind: 'top', index: receiptComponents.findIndex((c) => String(c.id) === String(targetId)) });
  const handleDropInColumn = (e, parentId, columnId, index = null) =>
    dropAt(e, { kind: 'cell', parentId, columnId, index });

  // Find a component anywhere in the tree by the id the canvas selects it with
  // (top-level id, or `${parent.id}-${column.id}-${index}` for a nested block).
  const locateComponent = (id) => {
    const top = receiptComponents.find((c) => c.id === id);
    if (top) return { component: top };
    for (const parent of receiptComponents) {
      if (parent.type !== COMPONENT_TYPES.COLUMNS) continue;
      for (const column of parent.properties?.columns || []) {
        const children = column.components || [];
        const index = children.findIndex((child, childIndex) =>
          `${parent.id}-${column.id}-${childIndex}` === id || child.id === id);
        if (index !== -1) {
          return { component: children[index], parentId: parent.id, columnId: column.id, nestedIndex: index };
        }
      }
    }
    return null;
  };

  // Update a component wherever it lives (used by the Media Centre pick, which used to
  // look at the top level only and dropped the pick for an image inside a column).
  const updateAnyComponent = (id, updates) => {
    const found = locateComponent(id);
    if (!found) return;
    if (found.parentId) handleNestedComponentUpdate(found.parentId, found.columnId, found.nestedIndex, updates);
    else handleComponentUpdate(id, updates);
  };

  // One sample sale per editor session — stamped once so the canvas doesn't
  // re-resolve {currentTimestamp} on every render.
  // A payment template previews against a sample account payment (reference editor).
  const previewData = useMemo(() => (paymentTemplate ? samplePaymentReferenceData() : sampleReferenceData()), [paymentTemplate]);
  // Text blocks resolve against the same sample as the data blocks: a payment
  // template's {customer.code} / {customer.currentOwing} come from the sample payment.
  const previewContext = useMemo(() => (paymentTemplate ? previewData.text : sampleReceiptContext()), [paymentTemplate, previewData]);

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
        onDragStart={(e) => handleDragStart(e, { kind: 'top', id: component.id })}
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

        {renderTextOnlyWarning(component)}

        {/* Component Content — matches the renderer: only an explicit false hides it */}
        {component.visible !== false && (
          <Box sx={{ p: 0, minHeight: 20 }}>
            {renderComponentContent(component)}
          </Box>
        )}
      </Box>
    );
  };

  // An image-type block already on a Generic / Text Only template (added before the
  // type changed, or authored elsewhere) is flagged rather than silently kept.
  const renderTextOnlyWarning = (component) => (
    textOnlyTemplate && IMAGE_TYPES.includes(component.type) ? (
      <Chip
        size="small"
        color="warning"
        label="Not printed on text-only receipts"
        sx={{ m: 0.5 }}
      />
    ) : null
  );

  // Blocks whose printed shape is owned by the receipt renderer. The canvas draws
  // them with that same renderer against a sample sale, so what the author sees on
  // the canvas is exactly what the sale prints — the two used to disagree (canvas:
  // "Rounding:" left-aligned; receipt: "Rounding" right-aligned in the money column).
  const RENDERER_OWNED = [
    // Heading used to be drawn by hand without its padding or background, so the
    // canvas and the printed heading differed.
    COMPONENT_TYPES.HEADER,
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
    COMPONENT_TYPES.INVOICES,
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
      case COMPONENT_TYPES.OUTLET_LOGO:
        return (
          <Box
            sx={{
              display: 'flex',
              justifyContent: component.properties?.horizontalAlignment || 'center',
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              ...borderToCss(component.properties?.border),
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
              ...borderToCss(component.properties?.border),
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
      case COMPONENT_TYPES.COLUMNS:
        return (
          <Box
            sx={{
              display: 'flex',
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              ...borderToCss(component.properties?.border),
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
                          // A nested block can be dragged out to the paper, into the
                          // other cell, or onto a sibling to reorder.
                          draggable={!isPreview}
                          onDragStart={(e) => handleDragStart(e, { kind: 'cell', parentId: component.id, columnId: column.id, index: nestedIndex })}
                          onDragEnd={handleDragEnd}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDropInColumn(e, component.id, column.id, nestedIndex)}
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
                                {/* No show/hide toggle: the reference has none, and the
                                    `visible` flag it wrote was never saved (the storage
                                    shape has no such key), so it only hid the block until
                                    reload. It also mutated state in place. */}
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

                          {!isPreview && renderTextOnlyWarning(nestedComp)}

                          {/* Component Content */}
                          {nestedComp.visible !== false && (
                            <Box sx={{ p: 0, minHeight: 30 }}>
                              {renderComponentContent(nestedComp, isPreview)}
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
              ...borderToCss(component.properties?.border),
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
      case COMPONENT_TYPES.TEXT:
        return (
          <Box
            sx={{
              backgroundColor: component.properties?.backgroundColor || '#ffffff',
              padding: `${component.properties?.padding?.top || 0}px ${component.properties?.padding?.right || 0}px ${component.properties?.padding?.bottom || 0}px ${component.properties?.padding?.left || 0}px`,
              ...borderToCss(component.properties?.border),
              // Text saves background / padding / border only; size, colour and
              // alignment come from the rich-text HTML. Draw on the printed receipt's
              // base (Roboto 12px black, ReceiptRenderer reference path) so the
              // canvas matches print instead of showing unsaved 16px defaults.
              fontFamily: 'Roboto, sans-serif',
              fontSize: '12px',
              lineHeight: 1.35,
              color: '#000',
            }}
          >
            {component.properties?.content || component.properties?.richTextContent ? (
              <Box
                sx={{ width: '100%' }}
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
          <Select MenuProps={REF_MENU_PROPS}
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

    // Padding (px): four boxes around a centre square holding the round blue link
    // button. Linked, typing one side sets all four (reference control).
    const renderPaddingControl = () => {
      const padding = component.properties?.padding || {};
      const setSide = (key, raw) => {
        const n = clampPad(raw);
        const next = paddingLinked
          ? { top: n, right: n, bottom: n, left: n }
          : { top: 0, right: 0, bottom: 0, left: 0, ...padding, [key]: n };
        updateComponent({ properties: { ...component.properties, padding: next } });
      };
      const box = (key, label) => (
        <TextField
          size="small"
          type="number"
          placeholder="0"
          inputProps={{ min: 0, 'aria-label': `Padding ${label}`, style: { textAlign: 'center' } }}
          // Empty shows the greyed 0 placeholder; a real 0 is still a value.
          value={Number(padding[key]) ? padding[key] : ''}
          onChange={(e) => setSide(key, e.target.value)}
          sx={{ width: 72 }}
        />
      );
      return (
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Padding (px)</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '72px 72px 72px', gridTemplateRows: 'auto auto auto', gap: 1, justifyContent: 'center', alignItems: 'center', justifyItems: 'center' }}>
            <Box />
            {box('top', 'top')}
            <Box />
            {box('left', 'left')}
            <Box sx={{ width: 56, height: 40, bgcolor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tooltip title={paddingLinked ? 'Unlink sides' : 'Link all sides'}>
                <IconButton
                  size="small"
                  aria-pressed={paddingLinked}
                  onClick={() => setPaddingLinked((v) => !v)}
                  sx={{
                    width: 30,
                    height: 30,
                    bgcolor: paddingLinked ? BLUE : '#fff',
                    color: paddingLinked ? '#fff' : BLUE,
                    border: `1px solid ${BLUE}`,
                    '&:hover': { bgcolor: paddingLinked ? '#1670d0' : '#e8f1fd' },
                  }}
                >
                  {paddingLinked ? <LinkIcon fontSize="small" /> : <LinkOffIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Box>
            {box('right', 'right')}
            <Box />
            {box('bottom', 'bottom')}
            <Box />
          </Box>
        </Box>
      );
    };

    // Border: a preview of the component's real (per-side) border, then Edit Border,
    // which opens the Border Settings dialog.
    const renderBorderControl = () => (
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>Border</Typography>
        <Box sx={{ height: 44, bgcolor: '#e5e5e5', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
          <Box sx={{ width: '80%', height: 22, bgcolor: '#fff', ...borderToCss(component.properties?.border) }} />
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<EditIcon />}
          onClick={() => setBorderDialog({
            value: component.properties?.border,
            apply: (border) => updateComponent({ properties: { ...component.properties, border } }),
          })}
          sx={{ textTransform: 'none' }}
        >
          Edit Border
        </Button>
      </Box>
    );

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
                <ColorInput
                  
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
                <ColorInput
                  
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
              <Select MenuProps={REF_MENU_PROPS}
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
                label="Font Size"
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {renderFontWeight()}

            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Text Align</Typography>
              <Box sx={{ display: "flex" }}>
                {[
                  { value: 'left', Icon: FormatAlignLeftOutlined },
                  { value: 'center', Icon: FormatAlignCenterOutlined },
                  { value: 'right', Icon: FormatAlignRightOutlined },
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant="contained"
                    disableElevation
                    onClick={() =>
                      updateComponent({ properties: { ...component.properties, textAlign: align.value } })
                    }
                    // Reference: one segmented control, dark with the selected side blue.
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: 0,
                      bgcolor: component.properties?.textAlign === align.value ? BLUE : DARK,
                      color: "#fff",
                      "&:hover": { bgcolor: component.properties?.textAlign === align.value ? "#1670d0" : "#24272b" },
                    }}
                  >
                    <align.Icon fontSize="small" />
                  </Button>
                ))}
              </Box>
            </Box>

            {renderPaddingControl()}

            {renderBorderControl()}
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
                <ColorInput
                  
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

            {renderPaddingControl()}

            {renderBorderControl()}
          </Box>
        )}

        {component.type === COMPONENT_TYPES.BARCODE && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {renderPaddingControl()}
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
                      <NumberField
                        int
                        size="small"
                        value={width}
                        onCommit={(n) => {
                          const newWidths = [...(component.properties?.columnWidths || [])];
                          newWidths[index] = n;
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

            {renderPaddingControl()}

            {renderBorderControl()}

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
                <ColorInput
                  
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
                  onClick={async () => {
                    const currentColumns = component.properties?.columns || [];
                    const currentWidths = component.properties?.columnWidths || [];
                    // Removing the last cell deletes what is in it — ask first.
                    const removed = currentColumns[currentColumns.length - 1];
                    const lost = removed?.components?.length || 0;
                    if (currentColumns.length > 1 && lost > 0) {
                      const ok = await confirm(
                        `Column ${currentColumns.length} holds ${lost} component${lost === 1 ? '' : 's'}. Remove the column and ${lost === 1 ? 'it' : 'them'}?`,
                        { title: 'Remove column', confirmText: 'Remove' },
                      );
                      if (!ok) return;
                      setSelectedComponent(null);
                    }
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.tax || 'No Tax'}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, tax: e.target.value }
                  })
                }
              >
                {/* "No Tax" then the store's tax rates (Setup > Tax Rates). The saved
                    value is the tax NAME — the renderer finds the sale's tax by name.
                    A stored name no longer in the list stays as an option so the
                    select never renders blank. */}
                {(() => {
                  const stored = component.properties?.tax;
                  const options = ['No Tax', ...taxNames];
                  if (stored && !options.includes(stored)) options.push(stored);
                  return options.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>);
                })()}
              </Select>
            </Box>

            {/* Font Colour */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Font Colour</Typography>
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
                <ColorInput
                  
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

            {renderPaddingControl()}

            {renderBorderControl()}
          </Box>
        )}

        {component.type === COMPONENT_TYPES.EXTERNAL_RECEIPT && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Text Align */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Text Align</Typography>
              <Box sx={{ display: "flex" }}>
                {[
                  { value: 'left', Icon: FormatAlignLeftOutlined },
                  { value: 'center', Icon: FormatAlignCenterOutlined },
                  { value: 'right', Icon: FormatAlignRightOutlined },
                ].map((align) => (
                  <Button
                    key={align.value}
                    size="small"
                    variant="contained"
                    disableElevation
                    onClick={() =>
                      updateComponent({ properties: { ...component.properties, textAlign: align.value } })
                    }
                    // Reference: one segmented control, dark with the selected side blue.
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      borderRadius: 0,
                      bgcolor: component.properties?.textAlign === align.value ? BLUE : DARK,
                      color: "#fff",
                      "&:hover": { bgcolor: component.properties?.textAlign === align.value ? "#1670d0" : "#24272b" },
                    }}
                  >
                    <align.Icon fontSize="small" />
                  </Button>
                ))}
              </Box>
            </Box>

            {renderPaddingControl()}

            {renderBorderControl()}

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
                <ColorInput
                  
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
                <ColorInput
                  
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
          </Box>
        )}

        {(component.type === COMPONENT_TYPES.TOTALS || component.type === COMPONENT_TYPES.INVOICES) && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Reference edits a data block through one Name|Enabled table bound to its
                stored columns — measured 2026-08-06. A payment template's Totals are
                Total Paid / Invoices Paid / Unallocated; Invoices has its own columns. */}
            {renderFieldsTable(
              component.type === COMPONENT_TYPES.INVOICES
                ? COLUMN_LABELS.invoices
                : (paymentTemplate ? COLUMN_LABELS.paymentTotal : COLUMN_LABELS.total),
            )}

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
                <ColorInput
                  
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
                <ColorInput
                  
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
                <ColorInput
                  
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
                <ColorInput
                  
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
                <Select MenuProps={REF_MENU_PROPS}
                  value={component.properties?.fontSize || 12}
                  onChange={(e) => 
                    updateComponent({
                      properties: { ...component.properties, fontSize: e.target.value }
                    })
                  }
                >
                  {fontSizeOptions(component.properties?.fontSize).map(size => (
                    <MenuItem key={size} value={size}>{size}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
                <ColorInput
                  
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

            {renderPaddingControl()}

            {renderBorderControl()}
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
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 14}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
              <ColorInput
                
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
              <ColorInput
                
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
              <Select MenuProps={REF_MENU_PROPS}
                fullWidth
                size="small"
                value={component.properties?.fontSize || 12}
                onChange={(e) =>
                  updateComponent({
                    properties: { ...component.properties, fontSize: e.target.value }
                  })
                }
              >
                {fontSizeOptions(component.properties?.fontSize).map(size => (
                  <MenuItem key={size} value={size}>{size}</MenuItem>
                ))}
              </Select>
            </Box>

            {renderFontWeight()}

            {renderPaddingControl()}

            {renderBorderControl()}
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
                <Select MenuProps={REF_MENU_PROPS} 
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
                <Select MenuProps={REF_MENU_PROPS} 
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
                  {(paymentTemplate ? PAYMENT_PALETTE : SALE_PALETTE)
                    .filter((comp) => isAllowedType(comp.type))
                    .map((comp) => (
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
      <SavePromptDialog
        open={leavePrompt}
        name={template?.name || 'receipt'}
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
          // Discard, so the guard has nothing left to hold on to. Marked
          // clean before proceeding: the guard releases its history trap on
          // the render that follows, once the leave is already under way.
          configDirty.current = false;
          savedSnapshot.current = snapshotOf(receiptComponents, template?.name);
          pendingLeaveRef.current?.();
          pendingLeaveRef.current = null;
        }}
        onCancel={() => setLeavePrompt(false)}
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
            // Tree lookup, so an Image / Outlet Logo inside a Columns cell gets the pick
            // too (a top-level-only find dropped it silently).
            const found = locateComponent(selectedComponent);
            if (found) {
              updateAnyComponent(selectedComponent, {
                properties: { ...found.component.properties, imageUrl },
              });
            }
          }
        }}
        accept="image/*"
      />

      {/* Edit Border -> Border Settings (Simple / Advanced, per side). */}
      <BorderSettingsDialog
        open={Boolean(borderDialog)}
        value={borderDialog?.value}
        onCancel={() => setBorderDialog(null)}
        onUpdate={(border) => {
          borderDialog?.apply(border);
          setBorderDialog(null);
        }}
      />

      {/* Refused drops (full column, image on a text-only receipt) say why. */}
      <Snackbar
        open={Boolean(notice)}
        autoHideDuration={3000}
        onClose={() => setNotice('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="warning" onClose={() => setNotice('')} sx={{ width: '100%' }}>
          {notice}
        </Alert>
      </Snackbar>

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
