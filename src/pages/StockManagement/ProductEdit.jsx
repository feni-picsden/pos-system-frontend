import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  OutlinedInput,
  Checkbox,
  ListItemText,
  Card,
  CardContent,
  Autocomplete,
  FormGroup,
  Chip as MuiChip,
  Avatar,
  Menu,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Add as AddIcon,
  DeleteOutline as DeleteIcon,
  InfoOutlined as InfoIcon,
  Fingerprint as FingerprintIcon,
  CategoryOutlined as CategoryIcon,
  LocalOfferOutlined as LocalOfferIcon,
  AttachMoneyOutlined as MoneyIcon,
  CreditCardOutlined as CreditCardIcon,
  InventoryOutlined as InventoryIcon,
  WarehouseOutlined as WarehouseIcon,
  QrCodeOutlined as BarcodeIcon,
  ViewWeekOutlined as BarcodeLinesIcon,
  LocalShippingOutlined as TruckIcon,
  EmojiEventsOutlined as TrophyIcon,
  ComputerOutlined as ComputerIcon,
  LocationOn as LocationIcon,
  StarBorder as StarBorderIcon,
  Star as StarIcon,
  EditOutlined as EditOutlinedIcon,
  FormatBold as FormatBoldIcon,
  FormatItalic as FormatItalicIcon,
  FormatUnderlined as FormatUnderlinedIcon,
  StrikethroughS as StrikethroughSIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  DataObject as DataObjectIcon,
  FormatListBulleted as FormatListBulletedIcon,
  FormatListNumbered as FormatListNumberedIcon,
  FormatIndentIncrease as FormatIndentIncreaseIcon,
  FormatIndentDecrease as FormatIndentDecreaseIcon,
  FormatAlignLeft as FormatAlignLeftIcon,
  FormatAlignCenter as FormatAlignCenterIcon,
  FormatAlignRight as FormatAlignRightIcon,
  FormatAlignJustify as FormatAlignJustifyIcon,
  Colorize as ColorizeIcon,
  InsertLink as InsertLinkIcon,
  LinkOff as LinkOffIcon,
  ImageOutlined as ImageOutlinedIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import productService from '../../services/productService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import ImageUpload from '../../components/Common/ImageUpload';
import MediaDialog from '../../components/Common/MediaDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import supplierService from '../../services/supplierService';
import { taxRateService } from '../../services/taxRateService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Parity primary button (bg #5ebbeb, radius 12, h42, 700/16, no shadow, none-case)
const primaryButtonSx = {
  backgroundColor: '#5ebbeb',
  border: '1px solid #5ebbeb',
  color: '#ffffff',
  borderRadius: '12px',
  height: 42,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  padding: '8px 32px',
  // Ref swaps the hover colour instantly (transition: all 0s)
  transitionDuration: '0ms',
  '&:hover': { backgroundColor: '#0ea5e9', borderColor: '#0ea5e9', boxShadow: 'none' },
};

// Parity secondary (green) button — ref token-green #22c55e (oklch 0.723 0.219 149.579),
// 1px border in the same green, pure #fff label, pad 8px 32px, hover LIGHTENS
const greenButtonSx = {
  backgroundColor: '#22c55e',
  color: '#ffffff',
  border: '1px solid #22c55e',
  borderRadius: '12px',
  height: 42,
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  padding: '8px 32px',
  transition: 'none',
  '&:hover': { backgroundColor: '#4ade80', borderColor: '#4ade80', boxShadow: 'none' },
};

// Favourited field names, persisted for this browser/login.
// ponytail: localStorage — there is no favourite-field model server side; move to a
// service if favourites ever need to follow the user across devices.
const FAVOURITE_FIELDS_KEY = 'productFieldFavourites';
const readFavouriteFields = () => {
  try {
    return JSON.parse(localStorage.getItem(FAVOURITE_FIELDS_KEY)) || {};
  } catch {
    return {};
  }
};

// Favourite star that follows every field label — outline star, light gray at rest,
// amber + rgba(0,0,0,0.1) bg on hover, 150ms color/background transition (ref pattern).
// Filled amber once the field is favourited.
const FavoriteStar = ({ field }) => {
  const [active, setActive] = useState(() => !!readFavouriteFields()[field]);

  const toggle = () => {
    const next = readFavouriteFields();
    if (active) delete next[field];
    else next[field] = true;
    localStorage.setItem(FAVOURITE_FIELDS_KEY, JSON.stringify(next));
    setActive(!active);
  };

  return (
    <IconButton
      size="small"
      disableRipple
      onClick={toggle}
      aria-label={`${active ? 'Unfavourite' : 'Favourite'} ${field}`}
      aria-pressed={active}
      sx={{
        width: 24,
        height: 24,
        padding: 0,
        borderRadius: '8px',
        color: active ? '#f59e0b' : '#dedede',
        // Ref: instant amber on hover (transition: all 0s) — MUI's SvgIcon defaults to
        // `fill 200ms`, so the glyph transition has to be killed too
        transition: 'none',
        '& .MuiSvgIcon-root': { transition: 'none' },
        '&:hover': { color: '#f59e0b', backgroundColor: 'rgba(0, 0, 0, 0.1)' },
      }}
    >
      {active ? (
        <StarIcon sx={{ fontSize: 20, transition: 'none' }} />
      ) : (
        <StarBorderIcon sx={{ fontSize: 20, transition: 'none' }} />
      )}
    </IconButton>
  );
};

// Flat combobox dropdown surface — field-width panel, 1px border, radius 0, no elevation;
// selected option text renders sky-blue instead of a tinted row background
const ComboPaper = (props) => (
  <Paper
    elevation={0}
    {...props}
    sx={{
      borderRadius: 0,
      boxShadow: 'none',
      border: '1px solid #404040',
      '& .MuiAutocomplete-listbox': { padding: 0 },
      // Ref marks the selected option with sky-blue TEXT only — never a blue-tinted row background.
      // !important is required: MUI's AutocompleteListbox rules tie on specificity and are injected
      // after this paper sx, so without it the default rgba(25,118,210,…) selected tint wins.
      '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: 'transparent !important' },
      '& .MuiAutocomplete-option[aria-selected="true"].Mui-focused': { backgroundColor: 'transparent !important' },
      '& .MuiAutocomplete-option[aria-selected="true"].Mui-focusVisible': { backgroundColor: 'transparent !important' },
      // Real mouse hover keeps the same neutral gray as every other option row (declared last to win the tie)
      '& .MuiAutocomplete-option[aria-selected="true"]:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04) !important' },
    }}
  />
);

// Ref option order + gray description second lines for the Status combobox
// Tab strip: label + icon + the reference's measured pixel width for that tab
const PRODUCT_TABS = [
  { label: 'General', icon: <FingerprintIcon />, width: 115 },
  { label: 'Classifications', icon: <LocalOfferIcon />, width: 169 },
  { label: 'Sell & Cost', icon: <CreditCardIcon />, width: 141 },
  { label: 'Inventory', icon: <WarehouseIcon />, width: 135 },
  { label: 'Barcodes', icon: <BarcodeLinesIcon />, width: 136 },
  { label: 'Suppliers', icon: <TruckIcon />, width: 135 },
  { label: 'Images', icon: <ImageOutlinedIcon />, width: 120 },
  { label: 'Loyalty', icon: <TrophyIcon />, width: 120 },
  { label: 'Additional Info', icon: <ComputerIcon />, width: 168 },
];

const STATUS_OPTIONS = [
  {
    value: 'Active',
    description: 'Active status products will appear in search results for both orders and the sell screen',
  },
  {
    value: 'Not Selling',
    description:
      'Not Selling status products will appear in search results when creating any type of order, but will not be displayed on the sell screen. Can still be added to promotions and found in reports',
  },
  {
    value: 'Not Purchasing',
    description:
      'Not Purchasing status products will appear in search results on the sell screen, but will not be displayed in the search results for any type of orders in Orders & Invoices',
  },
  {
    value: 'Inactive',
    description: 'Inactive status products will not appear in search results',
    // Ref renders this row at 88px (two description lines) like the two above it,
    // even though the shorter text only fills one line.
    descriptionLines: 2,
  },
];

// Presentational react-draft-wysiwyg style toolbar chrome for the Description editor
const rteGroupSx = { display: 'flex', alignItems: 'center', flexWrap: 'wrap', mb: '6px' };

const rteOptionSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: '25px',
  height: '20px',
  padding: '5px',
  margin: '0 4px',
  border: '1px solid #F1F1F1',
  borderRadius: '2px',
  backgroundColor: '#fff',
  cursor: 'pointer',
  '& svg': { fontSize: 16, color: '#333' },
};

const rteDropdownSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  height: '30px',
  margin: '0 3px',
  border: '1px solid #F1F1F1',
  borderRadius: '2px',
  backgroundColor: '#fff',
  cursor: 'pointer',
};

const RTE_BLOCKS = [
  ['Normal', 'div'],
  ['H1', 'h1'],
  ['H2', 'h2'],
  ['H3', 'h3'],
  ['H4', 'h4'],
  ['H5', 'h5'],
  ['H6', 'h6'],
  ['Blockquote', 'blockquote'],
  ['Code', 'pre'],
];

// execCommand fontSize only accepts 1-7; label px -> size index
const RTE_SIZES = [[8, 1], [10, 2], [13, 3], [16, 4], [18, 5], [24, 6], [32, 7]];

const RteToolbar = ({ exec, onImage }) => {
  // In-app dialogs — this shadows window.prompt on purpose.
  const { prompt } = useAppDialogs();
  const [blockAnchor, setBlockAnchor] = useState(null);
  const [sizeAnchor, setSizeAnchor] = useState(null);
  const [blockLabel, setBlockLabel] = useState('Normal');
  const [sizeLabel, setSizeLabel] = useState(16);

  // mousedown preventDefault keeps the text selection inside the editor
  const btn = (icon, cmd, val = null) => (
    <Box sx={rteOptionSx} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd, val)}>
      {icon}
    </Box>
  );

  const promptAnd = async (cmd, message) => {
    const url = await prompt(message, '', { title: message.replace(/:$/, ''), confirmText: 'Insert' });
    if (url) exec(cmd, url);
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        backgroundColor: '#fff',
        // Ref draws a 1px black border around both the toolbar and the body box
        border: '1px solid #000',
        borderRadius: '2px',
        padding: '6px 5px 0',
        marginBottom: '5px',
      }}
    >
      <Box sx={rteGroupSx}>
        {btn(<FormatBoldIcon />, 'bold')}
        {btn(<FormatItalicIcon />, 'italic')}
        {btn(<FormatUnderlinedIcon />, 'underline')}
        {btn(<StrikethroughSIcon />, 'strikeThrough')}
        {btn(<DataObjectIcon />, 'fontName', 'monospace')}
        {btn(<SuperscriptIcon />, 'superscript')}
        {btn(<SubscriptIcon />, 'subscript')}
      </Box>
      <Box sx={rteGroupSx}>
        <Box
          sx={{ ...rteDropdownSx, width: 110 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => setBlockAnchor(e.currentTarget)}
        >
          <Typography sx={{ fontSize: 14, color: '#333', pl: '6px' }}>{blockLabel}</Typography>
          <ArrowDropDownIcon sx={{ fontSize: 20, color: '#333' }} />
        </Box>
        <Menu anchorEl={blockAnchor} open={!!blockAnchor} onClose={() => setBlockAnchor(null)}>
          {RTE_BLOCKS.map(([label, tag]) => (
            <MenuItem
              key={tag}
              onClick={() => {
                exec('formatBlock', `<${tag}>`);
                setBlockLabel(label);
                setBlockAnchor(null);
              }}
            >
              {label}
            </MenuItem>
          ))}
        </Menu>
        <Box
          sx={{ ...rteDropdownSx, minWidth: 48 }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => setSizeAnchor(e.currentTarget)}
        >
          <Typography sx={{ fontSize: 14, color: '#333', pl: '6px' }}>{sizeLabel}</Typography>
          <ArrowDropDownIcon sx={{ fontSize: 20, color: '#333' }} />
        </Box>
        <Menu anchorEl={sizeAnchor} open={!!sizeAnchor} onClose={() => setSizeAnchor(null)}>
          {RTE_SIZES.map(([px, size]) => (
            <MenuItem
              key={px}
              onClick={() => {
                exec('fontSize', String(size));
                setSizeLabel(px);
                setSizeAnchor(null);
              }}
            >
              {px}
            </MenuItem>
          ))}
        </Menu>
      </Box>
      <Box sx={rteGroupSx}>
        {btn(<FormatListBulletedIcon />, 'insertUnorderedList')}
        {btn(<FormatListNumberedIcon />, 'insertOrderedList')}
        {btn(<FormatIndentIncreaseIcon />, 'indent')}
        {btn(<FormatIndentDecreaseIcon />, 'outdent')}
      </Box>
      <Box sx={rteGroupSx}>
        {btn(<FormatAlignLeftIcon />, 'justifyLeft')}
        {btn(<FormatAlignCenterIcon />, 'justifyCenter')}
        {btn(<FormatAlignRightIcon />, 'justifyRight')}
        {btn(<FormatAlignJustifyIcon />, 'justifyFull')}
      </Box>
      <Box sx={rteGroupSx}>
        <Box component="label" sx={{ ...rteOptionSx, position: 'relative' }} onMouseDown={(e) => e.preventDefault()}>
          <ColorizeIcon />
          <input
            type="color"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, border: 0, padding: 0 }}
            onChange={(e) => exec('foreColor', e.target.value)}
          />
        </Box>
      </Box>
      <Box sx={rteGroupSx}>
        <Box sx={rteOptionSx} onMouseDown={(e) => e.preventDefault()} onClick={() => promptAnd('createLink', 'Link URL')}>
          <InsertLinkIcon />
        </Box>
        {btn(<LinkOffIcon />, 'unlink')}
      </Box>
      <Box sx={rteGroupSx}>
        <Box sx={rteOptionSx} onMouseDown={(e) => e.preventDefault()} onClick={onImage}>
          <ImageOutlinedIcon />
        </Box>
      </Box>
      <Box sx={rteGroupSx}>
        {btn(<UndoIcon />, 'undo')}
        {btn(<RedoIcon />, 'redo')}
      </Box>
    </Box>
  );
};

// Parity data-table header (matches ReportTable.jsx)
const dataTableHeadSx = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'none',
    padding: '8px',
    borderBottom: 'none',
  },
};

// Parity zebra row for input tables
const dataTableRowSx = (index) => ({
  bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
  '& td': { fontSize: 16, color: '#000', borderBottom: 'none', padding: '8px 8px 8px 10px' },
});

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`product-tabpanel-${index}`}
    aria-labelledby={`product-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

const ProductEdit = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isSuperAdmin, getOutletId, getOutletName, user } = useAuth();
  // A super admin creates products into the outlet currently selected in the navbar —
  // otherwise the product is saved with outletId null and the outlet-scoped Products
  // list (which filters strictly by outletId for super admins) can never show it again.
  const { selectedOutletId } = useSelectedOutlet();
  const [activeTab, setActiveTab] = useState(0);
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);
  const [caseQtyInvalid, setCaseQtyInvalid] = useState(false);
  const [isNewProduct, setIsNewProduct] = useState(false);
  // Case Quantity is only changed through the confirmation dialog (ref behavior):
  // null = closed, otherwise the draft value being edited
  const [caseQuantityDraft, setCaseQuantityDraft] = useState(null);
  // Cost Percentage repurposes formData.itemCost (dollars -> percent) and forces
  // Request Price on; stash the pair so switching back restores what was there.
  const costPercentageStashRef = useRef(null);
  // Scroll container for the form content — tab clicks reset it to the top (ref behavior)
  const contentScrollRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'Normal Product',
    status: 'Active',
    description: '',
    // Ref: starts EMPTY and is required before save (silently defaulting to 1 hid it)
    caseQuantity: '',
    category: '',
    categoryId: null,
    brand: '',
    brandId: null,
    family: '',
    familyId: null,
    tags: [],
    metcashMsc: '',
    retailTaxRate: 'GST',
    purchaseTaxRate: 'Inherit',
    preventManualDiscounts: false,
    costPercentage: false,
    showCostsIncludingTax: true,
    caseCost: 0,
    itemCost: 0,
    averageCaseCost: 0,
    averageItemCost: 0,
    requestPrice: false,
    requestQuantity: false,
    prices: [{ quantity: 1, price: 0, cost: 0, percentage: 0 }],
    trackInventory: true,
    currentStockCases: 0,
    currentStockItems: 0,
    reorderLevelCases: 0,
    reorderLevelItems: 0,
    reorderAmountCases: 0,
    reorderAmountItems: 0,
    reorderLimitCases: '',
    reorderLimitItems: '',
    maxOnHandCases: '',
    maxOnHandItems: '',
    reorderRounding: 'No Rounding',
    barcodes: [],
    orderNotes: '',
    invoiceNotes: '',
    suppliers: [],
    mainImage: null,
    images: [],
    sellOnShopMyLocal: false,
    loyaltyRows: [],
    outletId: null,
  });

  // Available options
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);
  const [mscOptions, setMscOptions] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [availableSuppliers, setAvailableSuppliers] = useState([]);
  const [taxRates, setTaxRates] = useState([]);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [supplierFormData, setSupplierFormData] = useState({
    supplierId: '',
    code: '',
    minimumOrderQuantity: 0,
    isCoreSupplier: false,
    replacementCost: 'Inherit From Product'
  });

  useEffect(() => {
    if (!id || id === 'new') {
      setIsNewProduct(true);
      setLoading(false);
      // Consume data collected by the Product Creation Wizard (localStorage handoff).
      const wizardRaw = localStorage.getItem('productWizardData');
      let wizard = null;
      if (wizardRaw) {
        try {
          wizard = JSON.parse(wizardRaw);
        } catch (e) {
          console.error('Error parsing wizard data:', e);
        }
        localStorage.removeItem('productWizardData');
      }
      setFormData(prev => ({
        ...prev,
        outletId: isSuperAdmin() ? null : getOutletId(),
        ...(wizard
          ? {
              name: wizard.name || prev.name,
              categoryId: wizard.categoryId ?? prev.categoryId,
              tags: wizard.tagIds || wizard.tags || prev.tags,
              caseQuantity: wizard.caseQuantity || prev.caseQuantity,
              prices: (wizard.prices && wizard.prices.length
                ? wizard.prices.map(p => ({
                    quantity: p.quantity || 1,
                    price: p.price || 0,
                    cost: 0,
                    percentage: 0,
                  }))
                : prev.prices),
              barcodes: (wizard.barcodes || []).map(b =>
                typeof b === 'string' ? { quantity: 1, code: b } : b
              ),
            }
          : {}),
      }));
    } else {
      loadProduct();
    }
    loadOptions();
    loadSuppliers();
  }, [id, isSuperAdmin, getOutletId]);

  // Recost the price rows whenever item cost changes. Must read prev.prices inside the
  // updater: a closure over formData.prices would be stale on mount and clobber rows
  // hydrated by the wizard handoff effect above.
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      prices: prev.prices.map(price => {
        const newBaseCost = calculateBaseCost(prev.itemCost, price.quantity);
        return {
          ...price,
          cost: newBaseCost,
          percentage: calculatePercentageFromPrice(newBaseCost, price.price),
          price: Math.round((price.price || 0) * 100) / 100
        };
      })
    }));
  }, [formData.itemCost]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      if (!id) {
        setIsNewProduct(true);
        setLoading(false);
        return;
      }
      const response = await productService.getProduct(id);
      setProduct(response.product);
      setFormData({
        name: response.product.name || '',
        type: response.product.type || 'Normal Product',
        status: response.product.status || 'Active',
        description: response.product.description || '',
        caseQuantity: response.product.caseQuantity || 1,
        category: response.product.category?.name || response.product.category || '',
        categoryId: response.product.categoryId || null,
        brand: response.product.brand?.name || response.product.brand || '',
        brandId: response.product.brandId || null,
        family: response.product.family?.name || response.product.family || '',
        familyId: response.product.familyId || null,
        tags: (response.product.tags || []).map((pt) => pt.tagId ?? pt.tag?.id).filter(Boolean),
        metcashMsc: response.product.metcashMsc || '',
        retailTaxRate: response.product.retailTaxRate || 'GST',
        purchaseTaxRate: response.product.purchaseTaxRate || 'Inherit',
        preventManualDiscounts: response.product.preventManualDiscounts || false,
        costPercentage: response.product.costPercentage || false,
        showCostsIncludingTax: response.product.showCostsIncludingTax !== false,
        caseCost: response.product.caseCost || 0,
        itemCost: response.product.itemCost || 0,
        // Null average (never received) falls back to the last cost, which is
        // what the reference shows before a product has any purchase history.
        averageCaseCost: response.product.averageCaseCost ?? response.product.caseCost ?? 0,
        averageItemCost: response.product.averageItemCost ?? response.product.itemCost ?? 0,
        requestPrice: response.product.requestPrice || false,
        requestQuantity: response.product.requestQuantity || false,
        prices: response.product.prices || [{ quantity: 1, price: 0, cost: 0, percentage: 0 }],
        trackInventory: response.product.trackInventory !== false,
        currentStockCases: response.product.currentStockCases || 0,
        currentStockItems: response.product.currentStockItems || 0,
        reorderLevelCases: response.product.reorderLevelCases || 0,
        reorderLevelItems: response.product.reorderLevelItems || 0,
        reorderAmountCases: response.product.reorderAmountCases || 0,
        reorderAmountItems: response.product.reorderAmountItems || 0,
        reorderLimitCases: response.product.reorderLimitCases || '',
        reorderLimitItems: response.product.reorderLimitItems || '',
        maxOnHandCases: response.product.maxOnHandCases || '',
        maxOnHandItems: response.product.maxOnHandItems || '',
        reorderRounding: response.product.reorderRounding || 'No Rounding',
        barcodes: (response.product.barcodes || []).map(barcode => 
          typeof barcode === 'string' 
            ? { quantity: 1, code: barcode }
            : barcode
        ),
        orderNotes: response.product.orderNotes || '',
        invoiceNotes: response.product.invoiceNotes || '',
        suppliers: response.product.suppliers || [],
        mainImage: response.product.mainImage || null,
        images: response.product.images || [],
        sellOnShopMyLocal: response.product.sellOnShopMyLocal || false,
        loyaltyRows: response.product.loyaltyRows || [],
        outletId: response.product.outletId || null,
      });
      setError('');
    } catch (err) {
      setError('Failed to load product');
      console.error('Error loading product:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOptions = async () => {
    try {
      const [categoriesResponse, brandsResponse, familiesResponse, tagsResponse, mscResponse, suppliersResponse, taxRatesResponse] = await Promise.all([
        productService.getCategories(),
        productService.getBrands(),
        productService.getFamilies(),
        productService.getTags(),
        productService.getMscMappings(),
        productService.getSuppliers(),
        taxRateService.getTaxRates(),
      ]);

      setCategories(Array.isArray(categoriesResponse) ? categoriesResponse : []);
      setBrands(Array.isArray(brandsResponse) ? brandsResponse : []);
      setFamilies(Array.isArray(familiesResponse) ? familiesResponse : []);
      setTags(Array.isArray(tagsResponse) ? tagsResponse : []);
      setMscOptions(Array.isArray(mscResponse) ? mscResponse : []);
      setSuppliers(Array.isArray(suppliersResponse) ? suppliersResponse : []);
      setTaxRates(Array.isArray(taxRatesResponse.taxRates) ? taxRatesResponse.taxRates : []);
    } catch (error) {
      console.error('Error loading options:', error);
      // Fallback to mock data
      setCategories([
        { id: 1, name: 'Pre Mix / RTDs' },
        { id: 2, name: 'Wine' },
        { id: 3, name: 'Spirits' },
        { id: 4, name: 'Beer' },
        { id: 5, name: 'Non-Alcoholic' },
      ]);
      setBrands([
        { id: 1, name: 'Brand A' },
        { id: 2, name: 'Brand B' },
        { id: 3, name: 'Brand C' },
      ]);
      setFamilies([
        { id: 1, name: 'Family 1' },
        { id: 2, name: 'Family 2' },
        { id: 3, name: 'Family 3' },
      ]);
      setTags([
        { id: 1, name: 'Popular' },
        { id: 2, name: 'New Arrival' },
        { id: 3, name: 'Sale' },
        { id: 4, name: 'Organic' },
        { id: 5, name: 'Premium' },
      ]);
      setSuppliers([
        { id: 1, name: 'Supplier A' },
        { id: 2, name: 'Supplier B' },
        { id: 3, name: 'Supplier C' },
      ]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Description rich text editor (uncontrolled contentEditable; formData.description holds HTML)
  const descEditorRef = useRef(null);
  const seedDescEditor = (node) => {
    descEditorRef.current = node;
    if (node && !node.dataset.seeded) {
      node.dataset.seeded = '1';
      const html = formData.description || '';
      // legacy plain-text descriptions: keep line breaks
      node.innerHTML = html.includes('<') ? html : html.replace(/\n/g, '<br>');
    }
  };
  const execDescCommand = (command, value = null) => {
    descEditorRef.current?.focus();
    document.execCommand(command, false, value);
    if (descEditorRef.current) handleInputChange('description', descEditorRef.current.innerHTML);
  };

  // Image button -> media library popup; caret saved so insert lands where the user was typing
  const [descMediaOpen, setDescMediaOpen] = useState(false);
  const descSelectionRef = useRef(null);
  const openDescMedia = () => {
    const sel = window.getSelection();
    descSelectionRef.current = sel.rangeCount ? sel.getRangeAt(0) : null;
    setDescMediaOpen(true);
  };
  const insertDescImage = (url) => {
    const node = descEditorRef.current;
    if (node) {
      node.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      if (descSelectionRef.current && node.contains(descSelectionRef.current.commonAncestorContainer)) {
        sel.addRange(descSelectionRef.current);
      } else {
        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(false);
        sel.addRange(range);
      }
      document.execCommand('insertImage', false, url);
      handleInputChange('description', node.innerHTML);
    }
    setDescMediaOpen(false);
  };

  // Helper function to get tax rate percentage
  const getTaxRatePercentage = (taxRateName) => {
    if (!taxRateName || taxRateName === 'No Tax') return 0;
    const taxRate = taxRates.find(rate => rate.name === taxRateName);
    return taxRate ? parseFloat(taxRate.amount) : 0;
  };

  // The purchase tax that applies to costs (Inherit falls back to the retail rate)
  const getCostTaxRateName = () =>
    formData.purchaseTaxRate === 'Inherit' ? formData.retailTaxRate : formData.purchaseTaxRate;

  // Helper function to remove tax from tax-inclusive amount: ex = inc / (1 + rate/100)
  const removeTaxFromCost = (taxInclusiveCost, taxRateName) => {
    const taxPercentage = getTaxRatePercentage(taxRateName);
    return (parseFloat(taxInclusiveCost) || 0) / (1 + taxPercentage / 100);
  };

  // ...and back again: costs are always STORED tax-inclusive, so an ex-tax edit has to
  // be re-grossed before it goes into formData / the save payload.
  const addTaxToCost = (exTaxCost, taxRateName) => {
    const taxPercentage = getTaxRatePercentage(taxRateName);
    return (parseFloat(exTaxCost) || 0) * (1 + taxPercentage / 100);
  };

  // Get displayed cost (backend stores tax-inclusive, toggle controls display).
  // The tax-removed figure is a derived display value, so it is rounded to cents here
  // rather than in the JSX — the tax-inclusive passthrough stays raw so typing is free.
  // Any of the four cost fields (last/average × case/item). Stored tax-inclusive;
  // the toggle only changes what is shown.
  const getDisplayedCost = (field) => {
    const stored = formData[field] ?? '';
    if (formData.showCostsIncludingTax) return stored;
    return Math.round(removeTaxFromCost(stored, getCostTaxRateName()) * 100) / 100;
  };

  // Cost inputs show ex-tax while the toggle is off — convert back before storing
  const handleCostChange = (field, value) => {
    const entered = parseFloat(value) || 0;
    const stored = formData.showCostsIncludingTax ? entered : addTaxToCost(entered, getCostTaxRateName());
    // Ref: a case cost drives its item cost live (and the price table's GP% with
    // it) so the numbers update while typing, not only after save/reload.
    const perUnitField = { caseCost: 'itemCost', averageCaseCost: 'averageItemCost' }[field];
    if (perUnitField) {
      const perUnit = stored / (parseInt(formData.caseQuantity, 10) || 1);
      setFormData(prev => ({
        ...prev,
        [field]: stored,
        [perUnitField]: Math.round(perUnit * 100) / 100,
      }));
      return;
    }
    handleInputChange(field, stored);
  };

  const handleSave = async () => {
    // Name is the product's identity — block the save here (covers both /products/new
    // and /products/:id/edit, which share this handler) as well as at the API.
    if (!formData.name?.trim()) {
      setNameInvalid(true);
      setError('Name is required');
      setActiveTab(0);
      return;
    }
    setNameInvalid(false);

    // Ref: Case Quantity is required — save is blocked with the measured wording
    // and the page jumps to the failing field on the General tab.
    if (!(parseInt(formData.caseQuantity, 10) >= 1)) {
      setCaseQtyInvalid(true);
      setError('Please fill in all required details before saving');
      setActiveTab(0);
      return;
    }
    setCaseQtyInvalid(false);

    try {
      setSaving(true);
      
      // Resolve IDs from names if IDs are missing
      const resolvedCategoryId =
        formData.categoryId ??
        (formData.category
          ? (categories || []).find(c => c.name === formData.category)?.id ?? null
          : null);

      const resolvedBrandId =
        formData.brandId ??
        (formData.brand
          ? (brands || []).find(b => b.name === formData.brand)?.id ?? null
          : null);

      const resolvedFamilyId =
        formData.familyId ??
        (formData.family
          ? (families || []).find(f => f.name === formData.family)?.id ?? null
          : null);

      // Build payload with resolved ids
      const payload = {
        ...formData,
        caseQuantity: parseInt(formData.caseQuantity, 10) || 1,
        categoryId: resolvedCategoryId,
        brandId: resolvedBrandId,
        familyId: resolvedFamilyId,
      };

      // New products must carry an outlet, or they land with outletId null and drop out
      // of the outlet-scoped Products list. Resolved at save time so a late-loading
      // outlet context (or an outlet switch made while editing) is still honoured.
      if (isNewProduct || !id) {
        payload.outletId = isSuperAdmin()
          ? (formData.outletId ?? selectedOutletId ?? null)
          : getOutletId();
      }
      
      let savedProduct;
      if (isNewProduct || !id) {
        savedProduct = await productService.createProduct(payload);
        
        // Upload any temporary images for new products
        if (formData.images && formData.images.length > 0) {
          for (const image of formData.images) {
            if (image.file) {
              // This is a temporary image that needs to be uploaded
              try {
                await productService.uploadImage(savedProduct.product.id, image.file, image.altText || '');
              } catch (error) {
                console.error('Error uploading image:', error);
                // Continue with other images even if one fails
              }
            }
          }
        }
      } else {
        savedProduct = await productService.updateProduct(id, payload);
      }
      // Ref: saving lands on the product's View page (with its success context),
      // unless the caller asked to come back somewhere specific.
      const savedId = savedProduct?.product?.id || id;
      navigate(location.state?.returnTo || (savedId ? `/products/${savedId}/view` : '/products'));
    } catch (error) {
      console.error('Error saving product:', error);
      setError('Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  // Image upload handlers
  const handleImageUpload = async (productId, imageFile, altText = '') => {
    try {
      // For new products, store the image locally
      if (productId === 'new' || !productId) {
        // This is a temporary image object from the ImageUpload component
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, imageFile]
        }));
        return { image: imageFile };
      } else {
        // For existing products, upload immediately
        const result = await productService.uploadImage(productId, imageFile, altText);
        
        // Update the form data with the new image
        setFormData(prev => ({
          ...prev,
          images: [...prev.images, result.image]
        }));
        
        return result;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleImageDelete = async (productId, imageId) => {
    try {
      // For existing products, delete from server
      if (productId !== 'new' && productId) {
        await productService.deleteImage(productId, imageId);
      }
      
      // Remove the image from form data (works for both temp and server images)
      setFormData(prev => ({
        ...prev,
        images: prev.images.filter(img => img.id !== imageId)
      }));
      
      return true;
    } catch (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  };

  const handleSetMainImage = async (productId, imageId) => {
    try {
      // For existing products, update on server
      if (productId !== 'new' && productId) {
        await productService.setMainImage(productId, imageId);
      }
      
      // Update the form data to reflect the main image change (works for both temp and server images)
      setFormData(prev => ({
        ...prev,
        images: prev.images.map(img => ({
          ...img,
          isMain: img.id === imageId
        }))
      }));
      
      return true;
    } catch (error) {
      console.error('Error setting main image:', error);
      throw error;
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    // Ref resets the form scroll position to the top on every tab switch
    if (contentScrollRef.current) {
      contentScrollRef.current.scrollTop = 0;
    }
  };

  // Calculate base cost (without percentage markup)
  const calculateBaseCost = (itemCost, quantity) => {
    if (!itemCost || itemCost <= 0) return 0;
    return itemCost * quantity;
  };

  const calculatePrice = (itemCost, quantity, percentage) => {
    if (!itemCost || itemCost <= 0) return 0;
    const baseCost = itemCost * quantity;
    const marginFraction = (typeof percentage === 'number' ? percentage : parseFloat(percentage) || 0) / 100;
    if (marginFraction >= 1) return 0; 
    const rawPrice = baseCost / (1 - marginFraction);
    return Math.round(rawPrice * 100) / 100; 
  };

  // Calculate margin percentage for a given cost and price
  const calculatePercentageFromPrice = (cost, price) => {
    if (!price || price === 0) return 0;
    const margin = 1 - (cost / price);
    const pct = margin * 100;
    return Math.round(pct * 100) / 100; 
  };

  const addPriceRow = () => {
    const baseCost = calculateBaseCost(formData.itemCost, 1);
    const price = calculatePrice(formData.itemCost, 1, 0);
    setFormData(prev => ({
      ...prev,
      prices: [...prev.prices, { quantity: 1, price: price, cost: baseCost, percentage: 0 }]
    }));
  };

  const removePriceRow = (index) => {
    setFormData(prev => ({
      ...prev,
      prices: prev.prices.filter((_, i) => i !== index)
    }));
  };

  const addBarcode = () => {
    setFormData(prev => ({
      ...prev,
      barcodes: [...prev.barcodes, { quantity: 1, code: '' }]
    }));
  };

  const removeBarcode = (index) => {
    setFormData(prev => ({
      ...prev,
      barcodes: prev.barcodes.filter((_, i) => i !== index)
    }));
  };

  const loadSuppliers = async () => {
    try {
      const response = await supplierService.getSuppliers();
      setAvailableSuppliers(response.suppliers || []);
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  const addSupplier = () => {
    setSupplierFormData({
      supplierId: '',
      code: '',
      minimumOrderQuantity: 0,
      isCoreSupplier: false,
      replacementCost: 'Inherit From Product'
    });
    setSelectedSupplier(null);
    setShowSupplierForm(true);
  };

  const handleSupplierSelect = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierFormData(prev => ({
      ...prev,
      supplierId: supplier.id,
      code: supplier.code || ''
    }));
  };

  const handleSupplierFormChange = (field, value) => {
    setSupplierFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddSupplierConfirm = () => {
    if (!selectedSupplier) return;
    
    const newSupplier = {
      supplierId: selectedSupplier.id,
      supplier: selectedSupplier,
      code: supplierFormData.code,
      minimumOrderQuantity: supplierFormData.minimumOrderQuantity,
      isCoreSupplier: supplierFormData.isCoreSupplier,
      replacementCost: supplierFormData.replacementCost,
      notes: ''
    };

    setFormData(prev => ({
      ...prev,
      suppliers: [...prev.suppliers, newSupplier]
    }));

    setShowSupplierForm(false);
    setSelectedSupplier(null);
  };

  const handleCancelSupplierForm = () => {
    setShowSupplierForm(false);
    setSelectedSupplier(null);
    setSupplierFormData({
      supplierId: '',
      code: '',
      minimumOrderQuantity: 0,
      isCoreSupplier: false,
      replacementCost: 'Inherit From Product'
    });
  };

  const removeSupplier = (index) => {
    setFormData(prev => ({
      ...prev,
      suppliers: prev.suppliers.filter((_, i) => i !== index)
    }));
  };

  const addLoyaltyRow = () => {
    setFormData(prev => ({
      ...prev,
      loyaltyRows: [...prev.loyaltyRows, { quantity: 1, earnRate: 0, redeemRate: 0 }]
    }));
  };

  const removeLoyaltyRow = (index) => {
    setFormData(prev => ({
      ...prev,
      loyaltyRows: prev.loyaltyRows.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box
      sx={{
        height: 'calc(100vh - 50px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
      }}
    >
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header band: title block + tab row on the full-width slate-200 strip (pinned) */}
      <Box sx={{ backgroundColor: 'rgb(226, 232, 240)', flexShrink: 0 }}>
        <Box sx={{ maxWidth: '820px', margin: '0 auto', padding: '80px 24px 48px' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700, color: 'rgb(90, 90, 90)' }}>
            {isNewProduct ? 'Creating' : 'Editing'} <Box component="span" sx={{ color: '#000' }}>{formData.name || ''}</Box>
          </Typography>
        </Box>

        {/* Tabs */}
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          TabIndicatorProps={{ sx: { display: 'none' } }}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '14px',
              fontWeight: 400,
              color: '#000',
              minHeight: 56,
              padding: '16px 24px',
              borderRadius: '8px 8px 0 0',
              transition: 'color 0.15s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
            },
            // Ref tabs are ~9px narrower per tab: 18px icon + 5px gap (MUI default is 24px + 8px)
            '& .MuiTab-root .MuiTab-iconWrapper': { fontSize: 18, marginRight: '5px' },
            '& .MuiTab-root:hover:not(.Mui-selected)': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
            },
            '& .MuiTab-root.Mui-selected': {
              color: '#000',
              backgroundColor: '#fff',
              borderRadius: '8px 8px 0 0',
              boxShadow: 'rgba(0, 0, 0, 0.1) 0 10px 15px -3px, rgba(0, 0, 0, 0.1) 0 4px 6px -4px',
            },
          }}
        >
          {/* Ref tab widths are fixed per label (115/169/141/135/136/135/120/120/168 = 1239 strip) */}
          {PRODUCT_TABS.map(({ label, icon, width }) => (
            <Tab
              key={label}
              icon={icon}
              label={label}
              iconPosition="start"
              // Width is fixed, so the label is centred and the padding only acts as a floor —
              // trimmed to 12px so no label wraps inside its measured width
              sx={{ width, minWidth: width, maxWidth: width, flexShrink: 0, padding: '16px 12px', whiteSpace: 'nowrap' }}
            />
          ))}
        </Tabs>
        </Box>
      </Box>

      {/* Scrollable form content (header band stays pinned) */}
      <Box ref={contentScrollRef} sx={{ flex: 1, overflowY: 'auto', backgroundColor: '#fff' }}>
      {/* Tab Content */}
      <Box sx={{
        backgroundColor: 'white',
        maxWidth: '820px',
        margin: '0 auto',
        '& .MuiOutlinedInput-root': { borderRadius: '8px' },
        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
        '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
        '& .MuiOutlinedInput-input': { padding: '9.5px 16px', fontSize: 16 },
        '& .MuiInputBase-multiline': { padding: 0 },
        '& input::placeholder, & textarea::placeholder': { color: '#808080', opacity: 1 },
        '& .MuiTypography-subtitle1': { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#000' },
      }}>
        {/* General Tab */}
        <TabPanel value={activeTab} index={0}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <InfoIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>General</Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Name <FavoriteStar field="Name" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                The name of the product, this will appear throughout Shopfront and will be visible to customers
              </Typography>
              <TextField
                fullWidth
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter product name"
                error={nameInvalid && !formData.name?.trim()}
                helperText={nameInvalid && !formData.name?.trim() ? 'Name is required' : ''}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Type <FavoriteStar field="Type" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                Determines how a product is sold and whether it contains other products. Under most circumstances this should be a{' '}
                <Box component="em">{formData.type}</Box>
              </Typography>
              {/* Ref renders Type read-only on the edit form — type can only be set on creation */}
              <FormControl fullWidth>
                <Select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  disabled={!isNewProduct}
                  sx={{
                    '&.Mui-disabled': { backgroundColor: '#dedede', cursor: 'not-allowed' },
                    '& .MuiSelect-select.Mui-disabled': { WebkitTextFillColor: '#000', cursor: 'not-allowed' },
                  }}
                >
                  <MenuItem value="Normal Product">Normal Product</MenuItem>
                  <MenuItem value="Composite Product">Composite Product</MenuItem>
                  <MenuItem value="Service">Service</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Status <FavoriteStar field="Status" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                Whether this product is a regularly stocked product, one you're removing from the store or one you're unable to sell yet
              </Typography>
              {/* Type-to-filter combobox with flat field-width panel and described options (ref) */}
              <Autocomplete
                fullWidth
                disableClearable
                // Ref shows a plain caret on open, not a blue text-selection highlight
                selectOnFocus={false}
                ListboxProps={{ sx: { maxHeight: 288 } }}
                options={STATUS_OPTIONS}
                getOptionLabel={(option) => (typeof option === 'string' ? option : option.value)}
                isOptionEqualToValue={(option, value) =>
                  option.value === (typeof value === 'string' ? value : value?.value)
                }
                value={STATUS_OPTIONS.find((option) => option.value === formData.status) || STATUS_OPTIONS[0]}
                onChange={(event, newValue) => {
                  if (newValue) handleInputChange('status', newValue.value);
                }}
                PaperComponent={ComboPaper}
                renderOption={(props, option, { selected }) => (
                  // Ref row heights: 72px for a one-line description, 88px for two lines
                  // (16px vertical padding + 24px title + 16px-per-description-line)
                  <Box component="li" {...props} sx={{ display: 'block !important', py: '16px !important' }}>
                    <Typography sx={{ fontSize: 16, lineHeight: '24px', color: selected ? '#3aa6de' : '#000' }}>
                      {option.value}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: 13,
                        lineHeight: '16px',
                        color: '#676b72',
                        minHeight: `${(option.descriptionLines || 1) * 16}px`,
                      }}
                    >
                      {option.description}
                    </Typography>
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Description <FavoriteStar field="Description" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                A large text description of the product, this can be viewed in the sell screen, but is most commonly used when connecting an eCommerce store
              </Typography>
              <RteToolbar exec={execDescCommand} onImage={openDescMedia} />
              <Box sx={{ border: '1px solid #000', borderRadius: '2px' }}>
                <Box
                  ref={seedDescEditor}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={(e) => handleInputChange('description', e.currentTarget.innerHTML)}
                  sx={{
                    minHeight: 170,
                    padding: '12px 14px',
                    fontSize: 16,
                    outline: 'none',
                    overflowWrap: 'break-word',
                    '& img': { maxWidth: '100%' },
                  }}
                />
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Case Quantity <FavoriteStar field="Case Quantity" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                The number of items that come in a case / outer
              </Typography>
              {/* Ref: disabled input + green button share one row; value stays black on #dedede.
                  772 row - 230 button - 24 gap = 518px input (ref measurement) */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <TextField
                  type="number"
                  disabled={!isNewProduct}
                  value={formData.caseQuantity}
                  placeholder="Add Case Quantity..."
                  inputProps={{ min: 1 }}
                  error={caseQtyInvalid && !(parseInt(formData.caseQuantity, 10) >= 1)}
                  onChange={(e) => handleInputChange('caseQuantity',
                    e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                  sx={{
                    flex: 1,
                    '& .MuiOutlinedInput-root.Mui-disabled': { backgroundColor: '#dedede', cursor: 'not-allowed' },
                    '& .MuiOutlinedInput-root.Mui-disabled .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                    '& .MuiOutlinedInput-input.Mui-disabled': { WebkitTextFillColor: '#000', cursor: 'not-allowed' },
                  }}
                />
                <Button
                  variant="contained"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => setCaseQuantityDraft(String(formData.caseQuantity ?? 1))}
                  // Ref: fixed 230px button so the disabled input stretches to 518px
                  sx={{ ...greenButtonSx, width: 230, padding: '8px 16px', flexShrink: 0, whiteSpace: 'nowrap' }}
                >
                  Edit Case Quantity
                </Button>
              </Box>

              {/* Ref: case quantity is only changed through this confirmation, so the
                  draft can be discarded without touching the form */}
              <Dialog open={caseQuantityDraft !== null} onClose={() => setCaseQuantityDraft(null)} maxWidth="xs" fullWidth>
                <DialogTitle sx={{ fontSize: 20, fontWeight: 700 }}>Edit Case Quantity</DialogTitle>
                <DialogContent>
                  <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                    What do you want to change the case quantity to?
                  </Typography>
                  <TextField
                    fullWidth
                    autoFocus
                    type="number"
                    inputProps={{ min: 1 }}
                    value={caseQuantityDraft ?? ''}
                    onChange={(e) => setCaseQuantityDraft(e.target.value)}
                  />
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    Changing the case quantity will affect this product's inventory, cost, prices and promotions.
                  </Alert>
                </DialogContent>
                <DialogActions sx={{ padding: '0 24px 20px' }}>
                  <Button onClick={() => setCaseQuantityDraft(null)} sx={{ textTransform: 'none', color: '#676b72' }}>
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    sx={primaryButtonSx}
                    onClick={() => {
                      handleInputChange('caseQuantity', Math.max(1, parseInt(caseQuantityDraft, 10) || 1));
                      setCaseQuantityDraft(null);
                    }}
                  >
                    Update
                  </Button>
                </DialogActions>
              </Dialog>
            </Grid>

          </Grid>
        </TabPanel>

        {/* Classifications Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <CategoryIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Classifications</Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Category <FavoriteStar field="Category" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                A mid-level name for a like group of products
              </Typography>
              {/* Ref combobox: type-to-filter, x clear inside the field, sky-blue selected option */}
              <Autocomplete
                fullWidth
                options={categories}
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                // Match on id first: the wizard handoff supplies categoryId only, no name.
                value={
                  categories.find((c) => c.id === formData.categoryId) ||
                  categories.find((c) => c.name === formData.category) ||
                  null
                }
                onChange={(event, newValue) => {
                  handleInputChange('category', newValue?.name || '');
                  handleInputChange('categoryId', newValue?.id ?? null);
                }}
                PaperComponent={ComboPaper}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                renderOption={(props, option, { selected }) => (
                  <Box component="li" {...props} sx={{ fontSize: 16, color: selected ? '#3aa6de' : '#000' }}>
                    {option.name}
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Brand <FavoriteStar field="Brand" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                The group name of like products that customers recognise
              </Typography>
              <Autocomplete
                fullWidth
                options={brands}
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={brands.find((b) => b.name === formData.brand) || null}
                onChange={(event, newValue) => {
                  handleInputChange('brand', newValue?.name || '');
                  handleInputChange('brandId', newValue?.id ?? null);
                }}
                PaperComponent={ComboPaper}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                renderOption={(props, option, { selected }) => (
                  <Box component="li" {...props} sx={{ fontSize: 16, color: selected ? '#3aa6de' : '#000' }}>
                    {option.name}
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Family <FavoriteStar field="Family" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                Products that are price-aligned and grouped together
              </Typography>
              <Autocomplete
                fullWidth
                options={families}
                getOptionLabel={(option) => option?.name || ''}
                isOptionEqualToValue={(option, value) => option?.id === value?.id}
                value={families.find((f) => f.name === formData.family) || null}
                onChange={(event, newValue) => {
                  handleInputChange('family', newValue?.name || '');
                  handleInputChange('familyId', newValue?.id ?? null);
                }}
                PaperComponent={ComboPaper}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                renderOption={(props, option, { selected }) => (
                  <Box component="li" {...props} sx={{ fontSize: 16, color: selected ? '#3aa6de' : '#000' }}>
                    {option.name}
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Tags <FavoriteStar field="Tags" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                Used for filtering products into groups
              </Typography>
              <FormControl fullWidth>
                <Select
                  multiple
                  value={formData.tags}
                  onChange={(e) => handleInputChange('tags', e.target.value)}
                  input={<OutlinedInput />}
                  renderValue={(selected) => (selected.length === 0 ? (
                    // Ref shows the same "Select..." placeholder as the other classification selects
                    <Box component="span" sx={{ color: '#808080' }}>Select...</Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selected.map((value) => {
                        const tag = tags.find(t => t.id === value);
                        return <Chip key={value} label={tag?.name || value} />;
                      })}
                    </Box>
                  ))}
                  displayEmpty
                >
                  {tags.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      <Checkbox checked={formData.tags.indexOf(tag.id) > -1} />
                      <ListItemText primary={tag.name} />
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Metcash MSC <FavoriteStar field="Metcash MSC" />
              </Typography>
              <Autocomplete
                fullWidth
                // MSC codes come from the tenant's classifications; keep any code already
                // saved on the product in the list so the current value still renders.
                options={formData.metcashMsc && !mscOptions.includes(formData.metcashMsc)
                  ? [...mscOptions, formData.metcashMsc]
                  : mscOptions}
                value={formData.metcashMsc || null}
                onChange={(event, newValue) => handleInputChange('metcashMsc', newValue || '')}
                PaperComponent={ComboPaper}
                sx={{ '& .MuiAutocomplete-clearIndicator': { visibility: 'visible' } }}
                renderOption={(props, option, { selected }) => (
                  <Box component="li" {...props} sx={{ fontSize: 16, color: selected ? '#3aa6de' : '#000' }}>
                    {option}
                  </Box>
                )}
                renderInput={(params) => <TextField {...params} placeholder="Select..." />}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Sell & Cost Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <MoneyIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Sell & Cost</Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Retail Tax Rate <FavoriteStar field="Retail Tax Rate" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                The tax this product accrues when selling it
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={formData.retailTaxRate}
                  onChange={(e) => handleInputChange('retailTaxRate', e.target.value)}
                >
                  <MenuItem value="No Tax">No Tax</MenuItem>
                  {taxRates.map((tax) => (
                    <MenuItem key={tax.id} value={tax.name}>
                      {tax.name} ({tax.amount}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Purchase Tax Rate <FavoriteStar field="Purchase Tax Rate" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                The tax this product accrues when purchasing it
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={formData.purchaseTaxRate}
                  onChange={(e) => handleInputChange('purchaseTaxRate', e.target.value)}
                >
                  <MenuItem value="Inherit">Inherit</MenuItem>
                  <MenuItem value="No Tax">No Tax</MenuItem>
                  {taxRates.map((tax) => (
                    <MenuItem key={tax.id} value={tax.name}>
                      {tax.name} ({tax.amount}%)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Ref toggle row: bold label + star line, then switch with caption to its RIGHT */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Prevent Manual Discounts <FavoriteStar field="Prevent Manual Discounts" />
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShopfrontSwitch
                  checked={formData.preventManualDiscounts}
                  onChange={(e) => handleInputChange('preventManualDiscounts', e.target.checked)}
                />
                <Typography variant="body2" sx={{ ml: 2, color: '#404040' }}>
                  {formData.preventManualDiscounts
                    ? "This product can't have manual discounts applied"
                    : 'This product can have manual discounts applied'}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Cost Percentage <FavoriteStar field="Cost Percentage" />
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShopfrontSwitch
                  checked={formData.costPercentage}
                  onChange={(e) => {
                    const isChecked = e.target.checked;
                    setFormData(prev => {
                      // ON: itemCost switches meaning (dollars -> percent of sell price) and
                      // Request Price is forced on — keep the old pair to put back on OFF.
                      if (isChecked) {
                        costPercentageStashRef.current = {
                          itemCost: prev.itemCost,
                          requestPrice: prev.requestPrice,
                        };
                        return { ...prev, costPercentage: true, itemCost: 0, requestPrice: true };
                      }
                      const stash = costPercentageStashRef.current;
                      costPercentageStashRef.current = null;
                      return {
                        ...prev,
                        costPercentage: false,
                        itemCost: stash?.itemCost ?? 0,
                        requestPrice: stash?.requestPrice ?? false,
                      };
                    });
                  }}
                />
                <Typography variant="body2" sx={{ ml: 2, color: '#404040' }}>
                  {formData.costPercentage
                    ? "The cost of this product is a percentage of the sell price"
                    : "This product's cost won't be a percentage of the sell price"}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Cost <FavoriteStar field="Cost" />
              </Typography>
              
              {!formData.costPercentage && (
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <ShopfrontSwitch
                    checked={formData.showCostsIncludingTax}
                    onChange={(e) => handleInputChange('showCostsIncludingTax', e.target.checked)}                  />
                  <Typography variant="body1" sx={{ ml: 2 }}>
                    Show Costs Including Tax
                  </Typography>
                </Box>
              )}
            </Grid>
            {formData.costPercentage ? (
              // When cost percentage is ON, show percentage input
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Cost
                </Typography>
                <TextField
                  fullWidth
                  type="number"
                  value={formData.itemCost}
                  onChange={(e) => {
                    handleInputChange('itemCost', parseFloat(e.target.value) || 0);
                  }}
                  InputProps={{
                    endAdornment: <Typography sx={{ ml: 1, color: 'text.secondary' }}>%</Typography>,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#fff',
                    }
                  }}
                  helperText="The cost as a percentage of the sell price"
                />
              </Grid>
            ) : (
              <>
                {/* Reference Sell & Cost (measured 2026-08-14): Last Case Cost and
                    Last Item Cost are READ-ONLY (invoices set them), the Average
                    pair is editable, and every one of the four follows the
                    "Show Costs Including Tax" toggle using the PURCHASE tax rate
                    (Inherit = the retail rate). */}
                {[
                  ['Last Case Cost', 'caseCost', true],
                  ['Last Item Cost', 'itemCost', true],
                  ['Average Case Cost', 'averageCaseCost', false],
                  ['Average Item Cost', 'averageItemCost', false],
                ].map(([label, field, readOnly]) => (
                  <Grid item xs={12} key={field}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                      {label}
                    </Typography>
                    <TextField
                      fullWidth
                      type="number"
                      value={getDisplayedCost(field)}
                      onChange={(e) => handleCostChange(field, e.target.value)}
                      InputProps={{
                        readOnly,
                        startAdornment: <Typography sx={{ mr: 1, color: 'text.secondary' }}>$</Typography>,
                      }}
                      inputProps={{ step: 'any' }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          backgroundColor: readOnly ? '#e0e0e0' : '#fff',
                        },
                      }}
                      helperText={!formData.showCostsIncludingTax
                        ? `Tax-inclusive cost: $${(Number(formData[field]) || 0).toFixed(2)} (includes ${getTaxRatePercentage(getCostTaxRateName()).toFixed(2)}% tax)`
                        : ''}
                    />
                  </Grid>
                ))}
              </>
            )}
            { (
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Request Price <FavoriteStar field="Request Price" />
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <ShopfrontSwitch
                    checked={formData.requestPrice}
                    onChange={(e) => handleInputChange('requestPrice', e.target.checked)}                  />
                  <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                    {formData.requestPrice
                      ? 'The price of this product will be requested when being added to sales'
                      : 'The prices of this product will be defined by the price table below'}
                  </Typography>
                </Box>
              </Grid>
            )}

              
                         
            {/* Request Quantity Section */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Request Quantity <FavoriteStar field="Request Quantity" />
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ShopfrontSwitch
                  checked={formData.requestQuantity}
                  onChange={(e) => handleInputChange('requestQuantity', e.target.checked)}
                />
                <Typography variant="body2" sx={{ ml: 2, color: 'text.secondary' }}>
                  {formData.requestQuantity
                    ? 'This product will request a quantity when being added to sales'
                    : 'This product will add one unit when being added to sales'}
                </Typography>
              </Box>
            </Grid>

            {!formData.requestPrice && !formData.costPercentage && (
              <Grid item xs={12}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Prices <FavoriteStar field="Prices" />
                </Typography>
                <Typography variant="body2" sx={{ mb: 1, fontWeight: 700, color: '#000' }}>
                  Relevant Prices
                </Typography>
                <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={dataTableHeadSx}>
                        <TableCell>Source</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Price</TableCell>
                        <TableCell>Cost</TableCell>
                        <TableCell>%</TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formData.prices.map((price, index) => (
                        <TableRow key={index} sx={dataTableRowSx(index)}>
                          <TableCell>{price.source || 'Product'}</TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={price.quantity}
                              onChange={(e) => {
                                const newPrices = [...formData.prices];
                              const newQty = parseInt(e.target.value) || 1;
                              // Keep current displayed price stable; adjust percentage to match new quantity cost
                              const currentPrice = newPrices[index].price;
                              const newBaseCost = calculateBaseCost(formData.itemCost, newQty);
                              const newPct = calculatePercentageFromPrice(newBaseCost, currentPrice);
                              newPrices[index].quantity = newQty;
                              newPrices[index].cost = newBaseCost;
                              newPrices[index].percentage = newPct;
                              newPrices[index].price = Math.round(currentPrice * 100) / 100;
                                handleInputChange('prices', newPrices);
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={price.price}
                              onChange={(e) => {
                                const newPrices = [...formData.prices];
                              const inputPrice = parseFloat(e.target.value) || 0;
                              const baseCost = calculateBaseCost(formData.itemCost, newPrices[index].quantity);
                              const pct = calculatePercentageFromPrice(baseCost, inputPrice);
                              newPrices[index].price = Math.round(inputPrice * 100) / 100;
                              newPrices[index].percentage = pct;
                                handleInputChange('prices', newPrices);
                              }}
                              size="small"
                              InputProps={{
                                startAdornment: '$',
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            ${(formData.itemCost * price.quantity).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <TextField
                              type="number"
                              value={price.percentage}
                              onChange={(e) => {
                                const newPrices = [...formData.prices];
                                newPrices[index].percentage = parseFloat(e.target.value) || 0;
                                const newPrice = calculatePrice(formData.itemCost, newPrices[index].quantity, newPrices[index].percentage);
                                newPrices[index].price = newPrice;
                                handleInputChange('prices', newPrices);
                              }}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {/* The last price point can't be removed — a sellable
                                product must keep at least one price. */}
                            {formData.prices.length > 1 && (
                              <IconButton
                                onClick={() => removePriceRow(index)}
                                color="error"
                                size="small"
                              >
                                <DeleteIcon />
                              </IconButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addPriceRow}
                  sx={{ ...primaryButtonSx, mt: 2 }}
                >
                   New Price Point
                </Button>
              </Grid>
            )}
            
            {/* Info message when cost percentage is ON */}
            {formData.costPercentage && (
              <Grid item xs={12}>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'info.light', 
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: 'info.main'
                }}>
                  <Typography variant="body2" color="info.contrastText">
                    <strong>Cost Percentage Mode:</strong> The price will be requested when adding to sales, and the cost will be calculated as a percentage of that price.
                  </Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Inventory Tab */}
        <TabPanel value={activeTab} index={3}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <InventoryIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Inventory</Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Track Inventory <FavoriteStar field="Track Inventory" />
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ShopfrontSwitch
                  checked={formData.trackInventory}
                  onChange={(e) => handleInputChange('trackInventory', e.target.checked)}
                />
                <Typography variant="body2" sx={{ ml: 2, color: '#404040' }}>
                  {formData.trackInventory
                    ? 'The inventory changes for this product will be tracked'
                    : "The inventory changes for this product won't be tracked"}
                </Typography>
              </Box>
            </Grid>

            {/* Track Inventory is the master conditional for the stock block (ref) */}
            {formData.trackInventory && (
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                {user?.isSuperAdmin ? 'Global' : (getOutletName() || 'N/A')} <FavoriteStar field="Inventory Outlet" />
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Cases</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="subtitle2">Items</Typography>
                </Grid>
                
                <Grid item xs={6}>
                  <Typography variant="body2">Current Stock</Typography>
                  <TextField
                    type="number"
                    value={formData.currentStockCases}
                    onChange={(e) => handleInputChange('currentStockCases', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Current Stock</Typography>
                  <TextField
                    type="number"
                    value={formData.currentStockItems}
                    onChange={(e) => handleInputChange('currentStockItems', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Level</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderLevelCases}
                    onChange={(e) => handleInputChange('reorderLevelCases', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Level</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderLevelItems}
                    onChange={(e) => handleInputChange('reorderLevelItems', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Amount</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderAmountCases}
                    onChange={(e) => handleInputChange('reorderAmountCases', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Amount</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderAmountItems}
                    onChange={(e) => handleInputChange('reorderAmountItems', parseInt(e.target.value) || 0)}
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Limit</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderLimitCases}
                    onChange={(e) => handleInputChange('reorderLimitCases', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Reorder Limit</Typography>
                  <TextField
                    type="number"
                    value={formData.reorderLimitItems}
                    onChange={(e) => handleInputChange('reorderLimitItems', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={6}>
                  <Typography variant="body2">Max On Hand</Typography>
                  <TextField
                    type="number"
                    value={formData.maxOnHandCases}
                    onChange={(e) => handleInputChange('maxOnHandCases', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="body2">Max On Hand</Typography>
                  <TextField
                    type="number"
                    value={formData.maxOnHandItems}
                    onChange={(e) => handleInputChange('maxOnHandItems', e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12}>
                  <Typography variant="body2">Reorder Rounding</Typography>
                  <FormControl fullWidth size="small">
                    <Select
                      value={formData.reorderRounding}
                      onChange={(e) => handleInputChange('reorderRounding', e.target.value)}
                    >
                      <MenuItem value="No Rounding">No Rounding</MenuItem>
                      <MenuItem value="Round Up to Case">Round Up to Case</MenuItem>
                      <MenuItem value="Round Down to Case">Round Down to Case</MenuItem>
                      <MenuItem value="Round Naturally">Round Naturally</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Grid>
            )}
          </Grid>
        </TabPanel>

        {/* Barcodes Tab */}
        <TabPanel value={activeTab} index={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <BarcodeIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Barcodes</Typography>
          </Box>
          
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Barcodes <FavoriteStar field="Barcodes" />
          </Typography>
          
          <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
            <Table>
              <TableHead>
                <TableRow sx={dataTableHeadSx}>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.barcodes.map((barcode, index) => (
                  <TableRow key={index} sx={dataTableRowSx(index)}>
                    <TableCell>
                      <TextField
                        type="number"
                        value={barcode.quantity}
                        onChange={(e) => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[index].quantity = parseInt(e.target.value) || 1;
                          handleInputChange('barcodes', newBarcodes);
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={barcode.code}
                        onChange={(e) => {
                          const newBarcodes = [...formData.barcodes];
                          newBarcodes[index].code = e.target.value;
                          handleInputChange('barcodes', newBarcodes);
                        }}
                        size="small"
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => removeBarcode(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addBarcode}
            sx={{ ...primaryButtonSx, mt: 2 }}
          >
             New Barcode
          </Button>
        </TabPanel>

        {/* Suppliers Tab */}
        <TabPanel value={activeTab} index={5}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <TruckIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Suppliers</Typography>
          </Box>
          
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Order Notes <FavoriteStar field="Order Notes" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                These will appear when you're placing an order to any supplier, they will also be sent to the supplier if you're emailing an order from within Shopfront.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={formData.orderNotes}
                onChange={(e) => handleInputChange('orderNotes', e.target.value)}
                placeholder="Enter order notes"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Invoice Notes <FavoriteStar field="Invoice Notes" />
              </Typography>
              <Typography variant="body2" sx={{ mb: 2, color: '#404040' }}>
                These will appear when you're receiving an invoice in Shopfront.
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={formData.invoiceNotes}
                onChange={(e) => handleInputChange('invoiceNotes', e.target.value)}
                placeholder="Enter invoice notes"
              />
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Suppliers <FavoriteStar field="Suppliers" />
              </Typography>
              
              {/* Existing Suppliers */}
              {formData.suppliers.map((supplier, index) => (
                <Card key={index} sx={{ mb: 2, borderRadius: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <FormControlLabel
                          control={
                            <ShopfrontSwitch
                              checked={supplier.isCoreSupplier || false}
                              onChange={(e) => {
                                const newSuppliers = [...formData.suppliers];
                                newSuppliers[index].isCoreSupplier = e.target.checked;
                                handleInputChange('suppliers', newSuppliers);
                              }}
                              color="primary"
                            />
                          }
                          label="Is Core Supplier"
                        />
                        <IconButton
                          onClick={() => removeSupplier(index)}
                          color="error"
                          size="small"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                      {/* Ref has no per-card star — the only star is on the Suppliers section header */}
                    </Box>

                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Supplier</InputLabel>
                          <Select
                            value={supplier.supplierId || ''}
                            label="Supplier"
                            disabled
                          >
                            <MenuItem value={supplier.supplierId}>
                              {supplier.supplier?.name || 'Unknown Supplier'}
                            </MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Code"
                          size="small"
                          value={supplier.code || ''}
                          onChange={(e) => {
                            const newSuppliers = [...formData.suppliers];
                            newSuppliers[index].code = e.target.value;
                            handleInputChange('suppliers', newSuppliers);
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          label="Minimum Order Quantity"
                          type="number"
                          size="small"
                          value={supplier.minimumOrderQuantity || 0}
                          onChange={(e) => {
                            const newSuppliers = [...formData.suppliers];
                            newSuppliers[index].minimumOrderQuantity = parseInt(e.target.value) || 0;
                            handleInputChange('suppliers', newSuppliers);
                          }}
                        />
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                          <LocationIcon color="primary" fontSize="small" />
                          <Typography variant="body2" color="text.secondary">
                            {supplier.supplier?.outlet?.name || 'Global Supplier'}
                          </Typography>
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Replacement Cost"
                          size="small"
                          value={supplier.replacementCost || 'Inherit From Product'}
                          onChange={(e) => {
                            const newSuppliers = [...formData.suppliers];
                            newSuppliers[index].replacementCost = e.target.value;
                            handleInputChange('suppliers', newSuppliers);
                          }}
                        />
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ))}

              {/* Add Supplier Form */}
              {showSupplierForm && (
                <Card sx={{ mt: 2, mb: 2, borderRadius: 2, border: '2px dashed #1976d2' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" color="primary">
                        Add New Supplier
                      </Typography>
                      <IconButton onClick={handleCancelSupplierForm} size="small">
                        <DeleteIcon />
                      </IconButton>
                    </Box>

                    {/* Supplier Selection */}
                    <Autocomplete
                      options={availableSuppliers}
                      getOptionLabel={(option) => option.name}
                      value={selectedSupplier}
                      onChange={(event, newValue) => handleSupplierSelect(newValue)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Supplier"
                          placeholder="Search for a supplier..."
                          fullWidth
                          sx={{ mb: 2 }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box component="li" {...props}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                            <Avatar sx={{ width: 32, height: 32 }}>
                              {option.name?.charAt(0)?.toUpperCase() || 'S'}
                            </Avatar>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography variant="body1" fontWeight="medium">
                                {option.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {option.code && `Code: ${option.code}`}
                                {option.outlet?.name && ` • ${option.outlet.name}`}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      )}
                    />

                    {selectedSupplier && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FormControlLabel
                              control={
                                <ShopfrontSwitch
                                  checked={supplierFormData.isCoreSupplier}
                                  onChange={(e) => handleSupplierFormChange('isCoreSupplier', e.target.checked)}
                                  color="primary"
                                />
                              }
                              label="Is Core Supplier"
                            />
                          </Box>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Code"
                              size="small"
                              value={supplierFormData.code}
                              onChange={(e) => handleSupplierFormChange('code', e.target.value)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <TextField
                              fullWidth
                              label="Minimum Order Quantity"
                              type="number"
                              size="small"
                              value={supplierFormData.minimumOrderQuantity}
                              onChange={(e) => handleSupplierFormChange('minimumOrderQuantity', parseInt(e.target.value) || 0)}
                            />
                          </Grid>
                          <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                              <LocationIcon color="primary" fontSize="small" />
                              <Typography variant="body2" color="text.secondary">
                                {selectedSupplier.outlet?.name || 'Global Supplier'}
                              </Typography>
                            </Box>
                          </Grid>
                          <Grid item xs={12}>
                            <TextField
                              fullWidth
                              label="Replacement Cost"
                              size="small"
                              value={supplierFormData.replacementCost}
                              onChange={(e) => handleSupplierFormChange('replacementCost', e.target.value)}
                            />
                          </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                          <Button
                            onClick={handleAddSupplierConfirm}
                            variant="contained"
                            disabled={!selectedSupplier}
                            sx={primaryButtonSx}
                          >
                            Add Supplier
                          </Button>
                          <Button 
                            onClick={handleCancelSupplierForm}
                            variant="outlined"
                          >
                            Cancel
                          </Button>
                        </Box>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={addSupplier}
                sx={{ ...primaryButtonSx, mt: 2 }}
                disabled={showSupplierForm}
              >
                Add Supplier
              </Button>
            </Grid>
          </Grid>
        </TabPanel>

        {/* Images Tab */}
        <TabPanel value={activeTab} index={6}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <ImageOutlinedIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Images</Typography>
          </Box>
          
          <ImageUpload
            productId={id}
            images={formData.images || []}
            onImageUpload={handleImageUpload}
            onImageDelete={handleImageDelete}
            onSetMainImage={handleSetMainImage}
            disabled={false}
            maxImages={10}
          />
        </TabPanel>

        {/* Loyalty Tab */}
        <TabPanel value={activeTab} index={7}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <TrophyIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Loyalty</Typography>
          </Box>
          
          <Typography variant="subtitle1" sx={{ mb: 1 }}>
            {user?.isSuperAdmin ? 'Global' : (getOutletName() || 'N/A')} <FavoriteStar field="Loyalty Outlet" />
          </Typography>
          
          <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
            <Table>
              <TableHead>
                <TableRow sx={dataTableHeadSx}>
                  <TableCell>Quantity</TableCell>
                  <TableCell>Earn Rate</TableCell>
                  <TableCell>Redeem Rate</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.loyaltyRows.map((row, index) => (
                  <TableRow key={index} sx={dataTableRowSx(index)}>
                    <TableCell>
                      <TextField
                        type="number"
                        value={row.quantity}
                        onChange={(e) => {
                          const newRows = [...formData.loyaltyRows];
                          newRows[index].quantity = parseInt(e.target.value) || 1;
                          handleInputChange('loyaltyRows', newRows);
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={row.earnRate}
                        onChange={(e) => {
                          const newRows = [...formData.loyaltyRows];
                          newRows[index].earnRate = parseFloat(e.target.value) || 0;
                          handleInputChange('loyaltyRows', newRows);
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={row.redeemRate}
                        onChange={(e) => {
                          const newRows = [...formData.loyaltyRows];
                          newRows[index].redeemRate = parseFloat(e.target.value) || 0;
                          handleInputChange('loyaltyRows', newRows);
                        }}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => removeLoyaltyRow(index)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={addLoyaltyRow}
            sx={{ ...primaryButtonSx, mt: 2 }}
          >
             Add Loyalty Row
          </Button>
        </TabPanel>

        {/* Additional Info Tab */}
        <TabPanel value={activeTab} index={8}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <ComputerIcon sx={{ mr: 1 }} />
            <Typography variant="h6" sx={{ fontSize: 24, fontWeight: 700 }}>Additional Info</Typography>
          </Box>
          
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Sell on Shop MyLocal <FavoriteStar field="Sell on Shop MyLocal" />
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <ShopfrontSwitch
              checked={formData.sellOnShopMyLocal}
              onChange={(e) => handleInputChange('sellOnShopMyLocal', e.target.checked)}
            />
            <Typography variant="body2" sx={{ ml: 2, color: '#404040' }}>
              {formData.sellOnShopMyLocal
                ? 'This product will be available on Shop MyLocal'
                : "This product won't be available on Shop MyLocal"}
            </Typography>
          </Box>
        </TabPanel>
      </Box>

      {/* Sticky Save — floats bottom-right of the scroll area */}
      <Box
        sx={{
          position: 'sticky',
          bottom: '24px',
          zIndex: 1200,
          display: 'flex',
          justifyContent: 'flex-end',
          pr: '24px',
          pointerEvents: 'none',
        }}
      >
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          sx={{ ...primaryButtonSx, px: '32px', pointerEvents: 'auto' }}
        >
          {saving ? null : 'Save'}
        </Button>
      </Box>
      </Box>

      {/* Media library popup for the Description editor image button */}
      <MediaDialog
        open={descMediaOpen}
        onClose={() => setDescMediaOpen(false)}
        onSelect={insertDescImage}
        accept="image/*"
      />
    </Box>
  );
};

export default ProductEdit;
