import React, { useState, useRef, useCallback, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Button,
  Typography,
  Paper,
  Grid,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Divider,
  Chip,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  ToggleButton,
  ToggleButtonGroup,
  CircularProgress,
  Autocomplete,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  ColorLens,
  Image as ImageIcon,
  DragIndicator,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { ChromePicker } from 'react-color';
import { useParams, useNavigate } from 'react-router-dom';
import saleKeyService from '../../services/saleKeyService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { getSaleKeysOutletId } from '../../utils/saleKeysOutlet';
import { productOptionLabel } from '../../utils/productOptionLabel';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import paymentMethodService from '../../services/paymentMethodService';
import priceListService from '../../services/priceListService';
import classificationService from '../../services/classificationService';
import customerService from '../../services/customerService';
import MediaDialog from '../../components/Common/MediaDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import posLocalDb from '../../services/posLocalDb';

// Sale-key actions, ordered A→Z to match the Shopfront reference combobox.
// Values are unchanged (param panels + renderSaleKey key off these); only labels/order match reference.
const ACTION_OPTIONS = [
  { value: 'add-component-to-current', label: 'Add a Component to Currently Selected Package' },
  { value: 'add-gift-card', label: 'Add a Gift Card' },
  { value: 'add-note', label: 'Add a Note' },
  { value: 'add-order-reference', label: 'Add a order reference to the current sale' },
  { value: 'add-product', label: 'Add a Product' },
  { value: 'add-product-case', label: 'Add a Product using Case Quantity' },
  { value: 'add-product-combo', label: 'Add Product Combo' },
  { value: 'add-customer', label: 'Add Customer to the Sale' },
  // IBA Loyalty Rewards integration actions (reference parity). Selectable in the editor;
  // sell-screen execution requires the IBA integration backend (not present locally).
  { value: 'add-iba-loyalty-customer', label: 'Add IBA Loyalty Rewards Customer to Sale' },
  { value: 'remove-iba-loyalty-customer', label: 'Remove IBA Loyalty Rewards Customer from Sale' },
  { value: 'add-quantity', label: 'Add Quantity to the Current Product' },
  { value: 'apply-discount', label: 'Apply Predefined Discount' },
  { value: 'cancel-current-sale', label: 'Cancel the Current Sale' },
  { value: 'change-price-set', label: 'Change Price Set' },
  { value: 'clear-sale', label: 'Clear Sale' },
  { value: 'create-customer', label: 'Create a Customer' },
  { value: 'subtract-quantity-barcode', label: "Decrease the current product's quantity by the originally scanned barcode quantity" },
  { value: 'display-components-add', label: 'Display a List of Components to Add' },
  { value: 'display-components-remove', label: 'Display a List of Components to Remove' },
  { value: 'display-classification-products', label: 'Display all Products in Classification' },
  { value: 'display-classification-products-case', label: 'Display all products with a Classification and Add Case' },
  { value: 'display-product-details', label: 'Display Product Details' },
  { value: 'product-search-input', label: 'Enter a Key Into the Product Search Box' },
  { value: 'flip-sale', label: 'Flip the Sale Quantities' },
  { value: 'add-quantity-barcode', label: "Increase the current product's quantity by the originally scanned barcode quantity" },
  { value: 'make-customer-payment', label: 'Make Customer Payment' },
  { value: 'no-action', label: 'No Action' },
  // Legacy/local key kinds (also selectable in the sell screen's Add Sale Key dialog).
  { value: 'navigation', label: 'Navigation' },
  { value: 'special', label: 'Special Action' },
  { value: 'info', label: 'Information' },
  { value: 'open-drawer', label: 'Open Cash Drawer' },
  { value: 'open-sale-key-folder', label: 'Open Sale Key Folder' },
  { value: 'pay-amount', label: 'Pay a Specified Amount' },
  { value: 'pay-exact-amount', label: 'Pay the Exact Amount' },
  { value: 'pay-loyalty', label: 'Pay using Customer Loyalty' },
  { value: 'remove-component-from-current', label: 'Remove a Component from Currently Selected Package' },
  { value: 'return-item', label: 'Return a Product' },
  { value: 'previous-folder', label: 'Return to the Previous Sale Key Folder' },
  { value: 'search-additional', label: 'Search by Additional Information' },
  { value: 'sale-search', label: 'Search for a Sale' },
  { value: 'show-backorders', label: 'Show Product Backorders' },
  { value: 'subtract-quantity', label: 'Subtract Quantity from Current Product' },
  { value: 'use-case-quantity', label: 'Use Case Quantity' },
  { value: 'view-current-time', label: 'View the Current Time' },
  { value: 'view-promotions', label: 'View the Current Promotions' },
  { value: 'customer-list', label: 'View a List of Customers' },
  { value: 'view-previous-date', label: 'View a Previous Date' },
  { value: 'view-live-profit', label: 'View Live Profit' },
  { value: 'reweigh', label: 'Weigh Again' },
].sort((a, b) => {
  // Case-insensitive code-point order (space sorts low) — matches the reference's strict-alphabetical combobox.
  const x = a.label.toLowerCase();
  const y = b.label.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
});

const SaleKeyEditor = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { getOutletId } = useAuth();
  const { selectedOutletId, isSuperAdmin } = useSelectedOutlet();
  const saleKeysOutletId = () =>
    getSaleKeysOutletId({ isSuperAdmin, getOutletId, selectedOutletId });
  const [saleKeys, setSaleKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  
  const debugSetSelectedKey = (newKey) => {
    setSelectedKey(newKey);
  };
  
  useEffect(() => {
    if (selectedKey &&
        (selectedKey.action === 'display-classification-products' ||
          selectedKey.action === 'display-classification-products-case') &&
        availableClassifications.length === 0) {
      loadClassifications();
    }
  }, [selectedKey]);
  const [gridSize, setGridSize] = useState({ rows: 6, cols: 6 });
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerType, setColorPickerType] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [availableCombos, setAvailableCombos] = useState([]);
  const [loadingCombos, setLoadingCombos] = useState(false);
  const [availableFolders, setAvailableFolders] = useState([]);
  const [availablePaymentMethods, setAvailablePaymentMethods] = useState([]);
  const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(false);
  const [availableClassifications, setAvailableClassifications] = useState([]);
  const [loadingClassifications, setLoadingClassifications] = useState(false);
  const [availableCustomers, setAvailableCustomers] = useState([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [availablePriceSets, setAvailablePriceSets] = useState([]);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeData, setResizeData] = useState(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const [currentSet, setCurrentSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSaleKeyConfig();
  }, [setId]);

  const sanitizeSaleKeys = (keys) => {
    return (keys || []).map((key) => {
      if (!key) return key;
      const { selectedProduct, ...rest } = key;
      return rest;
    });
  };

  const loadSaleKeyConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (setId) {
        const parsedSetId = parseInt(setId, 10);
        if (isNaN(parsedSetId)) {
          try {
            const allSets = await saleKeyService.getSaleKeySets(saleKeysOutletId());
            
            const foundSet = allSets.saleKeySets?.find(set => {
              const setName = set.name.toLowerCase();
              const searchName = setId.toLowerCase();
              
              return setName === searchName || 
                     setName.replace(/\s+/g, '-') === searchName || 
                     setName.replace(/\s+/g, '') === searchName.replace(/-/g, '') ||
                     searchName.replace(/-/g, ' ') === setName; 
            });
            
            if (foundSet) {
              navigate(`/setup/sale-key/${foundSet.id}`, { replace: true });
              return;
            } else {
              setError(`Sale key set "${setId}" not found. Available sets: ${allSets.saleKeySets?.map(s => s.name).join(', ') || 'None'}`);
              setGridSize({ rows: 6, cols: 6 });
              setSaleKeys([]);
              return;
            }
          } catch (lookupError) {
            setError(`Invalid sale key set ID or name: "${setId}". Please check the URL.`);
            setGridSize({ rows: 6, cols: 6 });
            setSaleKeys([]);
            return;
          }
        }
        
        // Load specific sale key set
        const setData = await saleKeyService.getSaleKeySet(parsedSetId);
        setCurrentSet(setData);
        if (setData.config) {
          setGridSize(setData.config.gridSize || { rows: 6, cols: 6 });
          setSaleKeys(setData.config.saleKeys || []);
        } else {
          // Use default config for this set
          const defaultConfig = saleKeyService.getDefaultConfig(setId);
          setGridSize(defaultConfig.gridSize);
          setSaleKeys(defaultConfig.saleKeys);
        }
      } else {
        const activeSet = await saleKeyService.getActiveSaleKeySet(saleKeysOutletId());
        setCurrentSet(activeSet);
        if (activeSet && activeSet.config) {
          setGridSize(activeSet.config.gridSize || { rows: 6, cols: 6 });
          setSaleKeys(activeSet.config.saleKeys || []);
        } else {
          setGridSize({ rows: 6, cols: 6 });
          setSaleKeys([]);
        }
      }
    } catch (error) {
      setError('Failed to load sale key configuration. Please try again.');
      // Use default configuration if loading fails
      setGridSize({ rows: 6, cols: 6 });
      setSaleKeys([]);
    } finally {
      setLoading(false);
    }
  };

  // Default key properties
  const defaultKeyProperties = {
    id: '',
    name: '',
    action: 'no-action',
    amount: '',
    productId: null,
    paymentMethod: 'cash',
    selectedProduct: null,
    requestQuantity: false,
    quantity: '',
    requestCaseQuantity: false,
    caseQuantity: '',
    useProductImage: 'Never', // Never | If Available | Always
    selectedPaymentMethod: null,
    folderId: '',
    folderName: '',
    backgroundColor: '#4CAF50',
    textColor: '#FFFFFF',
    borderColor: '#000000',
    fontSize: 16,
    textStyle: { bold: false, italic: false, underline: false },
    behavior: {
      disableKey: false,
      preventDisable: false,
      preventHover: true,
      preventHoverAnimation: true,
    },
    position: { x: 0, y: 0 },
    size: { width: 1, height: 1 }, // Can be resized to multiple grid cells
    image: null,
    constrainImageWidth: true,
    constrainImageHeight: true,
    fillKeyWithImage: false,
  };

  const handleAddSaleKey = () => {
    // Find the next available position in the grid
    const nextPosition = findNextAvailablePosition();
    if (!nextPosition) {
      setSnackbar({
        open: true,
        message: 'Grid is full — increase Rows or remove a key before adding another',
        severity: 'warning',
      });
      return;
    }
    const newKey = {
      ...defaultKeyProperties,
      id: `key-${Date.now()}`,
      name: 'New Key',
      position: nextPosition,
    };
    setSaleKeys([...saleKeys, newKey]);
    debugSetSelectedKey(newKey);
    setSnackbar({ open: true, message: 'New sale key added', severity: 'success' });
  };

  const findNextAvailablePosition = () => {
    // Find the first empty position in the grid
    for (let row = 0; row < gridSize.rows; row++) {
      for (let col = 0; col < gridSize.cols; col++) {
        const isOccupied = saleKeys.some(key => {
          if (!key || !key.position) return false;
          
          const width = key.size?.width || key.position.w || 1;
          const height = key.size?.height || key.position.h || 1;
          
          return col >= key.position.x && 
                 col < key.position.x + width &&
                 row >= key.position.y && 
                 row < key.position.y + height;
        });
        if (!isOccupied) {
          return { x: col, y: row };
        }
      }
    }
    // Grid is full — null, never (0,0): a valid-looking coordinate stacks the new
    // key on top of an existing one and both render in the same cell.
    return null;
  };

  const handleRemoveSaleKey = () => {
    if (selectedKey) {
      setSaleKeys(saleKeys.filter(key => key.id !== selectedKey.id));
      debugSetSelectedKey(null);
      setSnackbar({ open: true, message: 'Sale key removed', severity: 'info' });
    }
  };

  const handleKeySelect = (key) => {
    
    
    // Ensure the key has all required properties by merging with defaults
    const keyWithDefaults = {
      ...defaultKeyProperties,
      ...key,
      // Preserve existing nested objects but ensure they exist
      textStyle: { ...defaultKeyProperties.textStyle, ...key.textStyle },
      behavior: { ...defaultKeyProperties.behavior, ...key.behavior },
      position: { ...defaultKeyProperties.position, ...key.position },
      size: { ...defaultKeyProperties.size, ...key.size }
    };
    
    
    
    debugSetSelectedKey(keyWithDefaults);
  };

  // Helper function to convert folder name to URL-friendly slug
  const convertToSlug = (name) => {
    if (!name) return '';
    const result = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/[^a-z0-9-]/g, '') // Remove special characters except hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    
    return result;
  };

  const handleKeyClick = (key, event) => {
    
    
    // Prevent event bubbling to avoid interference
    if (event) {
      event.stopPropagation();
    }
    
    // If it's a folder key, just select it for editing in the sidebar
    if (key.action === 'open-sale-key-folder') {
      
      // Just select the key to show its properties in the sidebar
      handleKeySelect(key);
      
      // Show appropriate message based on configuration
      if (!key.folderName && !key.folderId) {
        setSnackbar({ 
          open: true, 
          message: 'Please select a folder for this key in the sidebar.', 
          severity: 'warning' 
        });
      } else {
        setSnackbar({ 
          open: true, 
          message: `Folder key "${key.folderName}" selected. Edit its properties in the sidebar.`, 
          severity: 'info' 
        });
      }
      return;
    }
    
    // Otherwise, just select the key for editing
    
    handleKeySelect(key);
  };

  const handleGridCellClick = (row, col) => {
    const isOccupied = saleKeys.some(key => {
      if (!key || !key.position) return false;
      
      const width = key.size?.width || key.position.w || 1;
      const height = key.size?.height || key.position.h || 1;
      
      return col >= key.position.x && 
             col < key.position.x + width &&
             row >= key.position.y && 
             row < key.position.y + height;
    });
    
    if (!isOccupied) {
      const newKey = {
        ...defaultKeyProperties,
        id: `key-${Date.now()}`,
        name: 'New Key',
        position: { x: col, y: row },
      };
      setSaleKeys([...saleKeys, newKey]);
      debugSetSelectedKey(newKey);
      setSnackbar({ open: true, message: 'New sale key added at selected position', severity: 'success' });
    }
  };

  const getPointerPosition = (e) => {
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    return touch || e;
  };

  const handleResizeStart = (e, key, direction) => {
    if (e.preventDefault) e.preventDefault();
    setIsResizing(true);
    const point = getPointerPosition(e);
    setResizeData({
      keyId: key.id,
      direction,
      startX: point.clientX,
      startY: point.clientY,
      startSize: { ...key.size },
      startPosition: { ...key.position },
    });
  };

  const handleResizeMove = useCallback((e) => {
    if (!isResizing || !resizeData) return;

    const point = getPointerPosition(e);
    if (e.cancelable) {
      e.preventDefault();
    }

    const deltaX = point.clientX - resizeData.startX;
    const deltaY = point.clientY - resizeData.startY;
    
    const cellWidth = 100 / gridSize.cols;
    const cellHeight = 100 / gridSize.rows;
    
    const cellDeltaX = Math.round(deltaX / (window.innerWidth * cellWidth / 100));
    const cellDeltaY = Math.round(deltaY / (window.innerHeight * cellHeight / 100));
    
    const updatedKey = saleKeys.find(k => k.id === resizeData.keyId);
    if (!updatedKey) return;
    
    let newSize = { ...resizeData.startSize };
    let newPosition = { ...resizeData.startPosition };
    
    // Calculate new size and position based on resize direction
    switch (resizeData.direction) {
      case 'se': // Bottom-right corner
        newSize.width = Math.max(1, Math.min(gridSize.cols - newPosition.x, resizeData.startSize.width + cellDeltaX));
        newSize.height = Math.max(1, Math.min(gridSize.rows - newPosition.y, resizeData.startSize.height + cellDeltaY));
        break;
      case 'sw': // Bottom-left corner
        const newWidthSW = Math.max(1, Math.min(newPosition.x + resizeData.startSize.width, resizeData.startSize.width - cellDeltaX));
        const newXSW = newPosition.x + resizeData.startSize.width - newWidthSW;
        newSize.width = newWidthSW;
        newPosition.x = Math.max(0, newXSW);
        newSize.height = Math.max(1, Math.min(gridSize.rows - newPosition.y, resizeData.startSize.height + cellDeltaY));
        break;
      case 'ne': // Top-right corner
        const newHeightNE = Math.max(1, Math.min(newPosition.y + resizeData.startSize.height, resizeData.startSize.height - cellDeltaY));
        const newYNE = newPosition.y + resizeData.startSize.height - newHeightNE;
        newSize.height = newHeightNE;
        newPosition.y = Math.max(0, newYNE);
        newSize.width = Math.max(1, Math.min(gridSize.cols - newPosition.x, resizeData.startSize.width + cellDeltaX));
        break;
      case 'nw': // Top-left corner
        const newWidthNW = Math.max(1, Math.min(newPosition.x + resizeData.startSize.width, resizeData.startSize.width - cellDeltaX));
        const newXNW = newPosition.x + resizeData.startSize.width - newWidthNW;
        newSize.width = newWidthNW;
        newPosition.x = Math.max(0, newXNW);
        const newHeightNW = Math.max(1, Math.min(newPosition.y + resizeData.startSize.height, resizeData.startSize.height - cellDeltaY));
        const newYNW = newPosition.y + resizeData.startSize.height - newHeightNW;
        newSize.height = newHeightNW;
        newPosition.y = Math.max(0, newYNW);
        break;
      case 'e': // Right edge
        newSize.width = Math.max(1, Math.min(gridSize.cols - newPosition.x, resizeData.startSize.width + cellDeltaX));
        break;
      case 'w': // Left edge
        const newWidthW = Math.max(1, Math.min(newPosition.x + resizeData.startSize.width, resizeData.startSize.width - cellDeltaX));
        const newXW = newPosition.x + resizeData.startSize.width - newWidthW;
        newSize.width = newWidthW;
        newPosition.x = Math.max(0, newXW);
        break;
      case 's': // Bottom edge
        newSize.height = Math.max(1, Math.min(gridSize.rows - newPosition.y, resizeData.startSize.height + cellDeltaY));
        break;
      case 'n': // Top edge
        const newHeightN = Math.max(1, Math.min(newPosition.y + resizeData.startSize.height, resizeData.startSize.height - cellDeltaY));
        const newYN = newPosition.y + resizeData.startSize.height - newHeightN;
        newSize.height = newHeightN;
        newPosition.y = Math.max(0, newYN);
        break;
    }
    
    // Update the key
    const updatedKeys = saleKeys.map(k => 
      k.id === resizeData.keyId 
        ? { ...k, size: newSize, position: newPosition }
        : k
    );
    setSaleKeys(updatedKeys);
    
    // Update selected key if it's the one being resized
    if (selectedKey?.id === resizeData.keyId) {
      debugSetSelectedKey({ ...selectedKey, size: newSize, position: newPosition });
    }
  }, [isResizing, resizeData, saleKeys, gridSize, selectedKey]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    setResizeData(null);
  }, []);

  // Add event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.addEventListener('touchmove', handleResizeMove);
      document.addEventListener('touchend', handleResizeEnd);
      document.addEventListener('touchcancel', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
        document.removeEventListener('touchmove', handleResizeMove);
        document.removeEventListener('touchend', handleResizeEnd);
        document.removeEventListener('touchcancel', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // Properties whose change should auto-save the layout to the server.
  const AUTOSAVE_PROPS = [
    'selectedProduct', 'productId', 'selectedPaymentMethod',
    'selectedCombo', 'comboId', 'folderId', 'folderName',
  ];

  // Accepts either (property, value) or a single object of {property: value}.
  // Related properties (e.g. folderId + folderName) MUST be applied in one call:
  // two successive calls both read the same stale selectedKey/saleKeys closures,
  // so the second call silently drops the first one's update (this was why
  // folderId never persisted from the folder picker).
  const handlePropertyChange = (propertyOrUpdates, value) => {
    if (!selectedKey) return;
    const updates = typeof propertyOrUpdates === 'string'
      ? { [propertyOrUpdates]: value }
      : (propertyOrUpdates || {});

    const updatedKey = { ...selectedKey };
    Object.entries(updates).forEach(([property, val]) => {
      if (property.includes('.')) {
        const [parent, child] = property.split('.');
        updatedKey[parent] = { ...updatedKey[parent], [child]: val };
      } else {
        updatedKey[property] = val;
      }
    });

    debugSetSelectedKey(updatedKey);
    const updatedSaleKeys = saleKeys.map(key =>
      key.id === selectedKey.id ? updatedKey : key
    );
    setSaleKeys(updatedSaleKeys);

    // Auto-save to server to prevent data loss
    if (Object.keys(updates).some(p => AUTOSAVE_PROPS.includes(p))) {
      const sanitized = sanitizeSaleKeys(updatedSaleKeys);
      setTimeout(async () => {
        try {
          const config = {
            gridSize,
            saleKeys: sanitized,
          };

          if (currentSet?.id) {
            await saleKeyService.updateSaleKeySet(currentSet.id, { config });
          }
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }, 500);
    }
  };

  const handleTextStyleChange = (style) => {
    if (selectedKey) {
      const updatedKey = { ...selectedKey };
      updatedKey.textStyle[style] = !updatedKey.textStyle[style];
      debugSetSelectedKey(updatedKey);
      setSaleKeys(saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      ));
    }
  };

  const handleColorChange = (color) => {
    if (selectedKey && colorPickerType) {
      const updatedKey = { ...selectedKey };
      updatedKey[colorPickerType] = color.hex;
      debugSetSelectedKey(updatedKey);
      setSaleKeys(saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      ));
    }
  };

  // Inline full-spectrum colour bar (matches reference gradient strip). Click opens the precise picker.
  const renderColorControl = (label, propKey) => (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body2" sx={{ mb: 1 }}>{label}</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box
          sx={{
            width: 24,
            height: 24,
            flexShrink: 0,
            bgcolor: selectedKey?.[propKey],
            border: '1px solid #404040',
            borderRadius: '4px',
          }}
        />
        <Box
          sx={{
            flex: 1,
            height: 20,
            cursor: 'pointer',
            borderRadius: '4px',
            border: '1px solid #404040',
            background:
              'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
          }}
          onClick={() => {
            setColorPickerType(propKey);
            setShowColorPicker(true);
          }}
        />
      </Box>
    </Box>
  );

  const handleSave = async () => {
    try {
      const config = {
        gridSize,
        saleKeys: sanitizeSaleKeys(saleKeys),
      };
      
      if (currentSet?.id) {
        // Update existing sale key set
        await saleKeyService.updateSaleKeySet(currentSet.id, { config });
      } else {
        // Create new sale key set
        const newSet = await saleKeyService.createSaleKeySet({
          name: 'Custom Sale Keys',
          description: 'Custom sale key configuration',
          isActive: true,
          isDefault: false,
          config
        });
        setCurrentSet(newSet);
        // Navigate to the new set's edit page
        navigate(`/setup/sale-key/${newSet.id}`);
      }
      
      setSnackbar({ open: true, message: 'Sale keys saved successfully', severity: 'success' });
    } catch (error) {
      console.error('Error saving sale key config:', error);
      setSnackbar({ open: true, message: 'Failed to save sale keys', severity: 'error' });
    }
  };

  // Load products for product selection
  const loadCombos = async () => {
    setLoadingCombos(true);
    try {
      // Use memory cache from POS catalog if available
      if (posLocalDb.isReady()) {
        const memoryCombos = posLocalDb.getCombos();
        if (memoryCombos.length > 0) {
          setAvailableCombos(memoryCombos);
          setLoadingCombos(false);
          return;
        }
      }
      // Check IDB cache next
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('combos');
      if (cached.length > 0) {
        setAvailableCombos(cached);
        setLoadingCombos(false);
        // Background refresh when stale
        const stale = await posLocalDb.isStoreStale('combos');
        if (stale) {
          productComboService.getProductCombos({ limit: 1000, status: 'Active' })
            .then((r) => { if (r?.combos?.length) setAvailableCombos(r.combos); })
            .catch(() => {});
        }
        return;
      }
      // No cache — fetch from API
      const response = await productComboService.getProductCombos({ limit: 1000, status: 'Active' });
      setAvailableCombos(response.combos || []);
    } catch (error) {
      console.error('Error loading combos:', error);
      setAvailableCombos([]);
    } finally {
      setLoadingCombos(false);
    }
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      // Use memory cache from POS catalog if available
      if (posLocalDb.isReady()) {
        const memoryProducts = posLocalDb.getProducts();
        if (memoryProducts.length > 0) {
          setAvailableProducts(memoryProducts);
          setLoadingProducts(false);
          return;
        }
      }
      // Check IDB cache next
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('products');
      if (cached.length > 0) {
        setAvailableProducts(cached);
        setLoadingProducts(false);
        // Background refresh when stale
        const stale = await posLocalDb.isStoreStale('products');
        if (stale) {
          productService.getProducts({ limit: 500, status: 'Active' })
            .then((r) => { if (r?.products?.length) setAvailableProducts(r.products); })
            .catch(() => {});
        }
        return;
      }
      // No cache — fetch from API
      const response = await productService.getProducts({ limit: 500, status: 'Active' });
      setAvailableProducts(response.products || []);
    } catch (error) {
      console.error('Error loading products:', error);
      setAvailableProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // Load available sale key folders (cached in IDB saleKeySets store)
  const loadFolders = async () => {
    try {
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('saleKeySets');
      if (cached.length > 0) {
        setAvailableFolders(cached.map((s) => ({ id: s.id, name: s.name })));
        // Background refresh when stale
        const stale = await posLocalDb.isStoreStale('saleKeySets');
        if (stale) {
          saleKeyService.getSaleKeySets(saleKeysOutletId())
            .then(async (r) => {
              const sets = r.saleKeySets || [];
              await posLocalDb.putStoreAll('saleKeySets', sets);
              setAvailableFolders(sets.map((s) => ({ id: s.id, name: s.name })));
            })
            .catch(() => {});
        }
        return;
      }
      // No cache — fetch from API
      const response = await saleKeyService.getSaleKeySets(saleKeysOutletId());
      const sets = response.saleKeySets || [];
      await posLocalDb.putStoreAll('saleKeySets', sets);
      setAvailableFolders(sets.map((s) => ({ id: s.id, name: s.name })));
    } catch (error) {
      console.error('Error loading sale key folders:', error);
      setAvailableFolders([]);
    }
  };

  // Load classifications (cached in IDB classifications store)
  const loadClassifications = async () => {
    setLoadingClassifications(true);
    try {
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('classifications');
      if (cached.length > 0) {
        setAvailableClassifications(cached);
        setLoadingClassifications(false);
        // Background refresh when stale
        const stale = await posLocalDb.isStoreStale('classifications');
        if (stale) {
          classificationService.getClassifications({})
            .then(async (r) => {
              const list = r.classifications || [];
              await posLocalDb.putStoreAll('classifications', list);
              setAvailableClassifications(list);
            })
            .catch(() => {});
        }
        return;
      }
      // No cache — fetch from API
      const response = await classificationService.getClassifications({});
      const list = response.classifications || [];
      await posLocalDb.putStoreAll('classifications', list);
      setAvailableClassifications(list);
    } catch (err) {
      console.error('Failed to fetch classifications:', err);
      setAvailableClassifications([]);
    } finally {
      setLoadingClassifications(false);
    }
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      if (posLocalDb.isReady()) {
        const cached = posLocalDb.searchCustomers('', 100);
        if (cached.length > 0) {
          setAvailableCustomers(cached);
          setLoadingCustomers(false);
          return;
        }
      }
      const response = await customerService.getCustomers({ limit: 100 });
      setAvailableCustomers(response.customers || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      setAvailableCustomers([]);
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadPaymentMethods = async () => {
    setLoadingPaymentMethods(true);
    try {
      // Use memory cache from POS catalog if available
      if (posLocalDb.isReady()) {
        const memoryPMs = posLocalDb.getPaymentMethods();
        if (memoryPMs.length > 0) {
          setAvailablePaymentMethods(memoryPMs);
          setLoadingPaymentMethods(false);
          return;
        }
      }
      // Check IDB cache next
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('paymentMethods');
      if (cached.length > 0) {
        setAvailablePaymentMethods(cached);
        setLoadingPaymentMethods(false);
        // Background refresh when stale
        const stale = await posLocalDb.isStoreStale('paymentMethods');
        if (stale) {
          paymentMethodService.getPaymentMethods()
            .then((r) => { if (r?.paymentMethods?.length) setAvailablePaymentMethods(r.paymentMethods); })
            .catch(() => {});
        }
        return;
      }
      // No cache — fetch from API
      const response = await paymentMethodService.getPaymentMethods();
      setAvailablePaymentMethods(response.paymentMethods || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setAvailablePaymentMethods([]);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  const loadPriceSets = async () => {
    try {
      const response = await priceListService.getPriceLists();
      setAvailablePriceSets(response.priceLists || []);
    } catch (error) {
      console.error('Error loading price sets:', error);
      setAvailablePriceSets([]);
    }
  };

  // Load products, folders, and payment methods on component mount
  useEffect(() => {
    loadProducts();
    loadCombos();
    loadFolders();
    loadPaymentMethods();
    loadClassifications();
    loadCustomers();
    loadPriceSets();
    // Mount-only data load by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Use media library to pick an image URL (no base64 conversion)
  const handleImageSelectedFromMedia = (imageUrl) => {
    if (!selectedKey) return;
    const updatedKey = { ...selectedKey, image: imageUrl };
    debugSetSelectedKey(updatedKey);
    setSaleKeys(saleKeys.map(key =>
      key.id === selectedKey.id ? updatedKey : key
    ));
  };

  const handleRemoveImage = () => {
    if (selectedKey) {
      const updatedKey = { ...selectedKey, image: null };
      debugSetSelectedKey(updatedKey);
      setSaleKeys(saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      ));
    }
  };

  const renderSaleKey = (key) => {
    // Add safety checks for key properties
    if (!key || !key.position) {
      return null;
    }
    
    // Handle both old format (separate size) and new format (w,h in position)
    const width = key.size?.width || key.position.w || 1;
    const height = key.size?.height || key.position.h || 1;
    
    const isSelected = selectedKey?.id === key.id;
    const cellWidth = 100 / gridSize.cols;
    const cellHeight = 100 / gridSize.rows;
    
    return (
      <Box
        key={key.id}
        sx={{
          position: 'absolute',
          left: `${(key.position.x || 0) * cellWidth}%`,
          top: `${(key.position.y || 0) * cellHeight}%`,
          width: `${width * cellWidth}%`,
          height: `${height * cellHeight}%`,
          backgroundColor: key.backgroundColor || '#4CAF50',
          color: key.textColor || '#FFFFFF',
          border: `1px solid ${isSelected ? '#1976d2' : (key.borderColor || '#000000')}`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflow: 'hidden', 
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: key.fontSize || 16,
          fontWeight: key.textStyle?.bold ? 'bold' : 'normal',
          fontStyle: key.textStyle?.italic ? 'italic' : 'normal',
          textDecoration: key.textStyle?.underline ? 'underline' : 'none',
          '&:hover': {
            opacity: key.behavior?.preventHover ? 1 : 0.8,
          },
          transition: key.behavior?.preventHoverAnimation ? 'none' : 'all 0.2s ease',
          boxSizing: 'border-box',
          padding: 1,
        }}
        onClick={(e) => handleKeyClick(key, e)}
      >
        {isSelected && (
          <>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                outline: '2px solid #1976d2',
                outlineOffset: 0,
                borderRadius: 2,
                pointerEvents: 'none',
              }}
            />
          </>
        )}
        
        {key.image ? (
          <img
            src={key.image}
            alt={key.name}
            style={{
              width: key.constrainImageWidth !== false ? '100%' : 'auto',
              height: key.constrainImageHeight !== false ? '100%' : 'auto',
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: key.fillKeyWithImage ? 'cover' : 'contain',
              marginBottom: 8,
            }}
          />
        ) : (
          <Box sx={{ fontSize: `${Math.max(key.fontSize || 16, 16)}px`, mb: 1 }}>
            {key.action === 'pay-amount' ? '$' : 
             key.action === 'pay-exact-amount' ? '💳' :
             key.action === 'add-product' ? '🛒' :
             key.action === 'open-sale-key-folder' ? '📁' : '📦'}
          </Box>
        )}
        
        <Typography
          sx={{
            textAlign: 'center',
            fontSize: `${key.fontSize || 16}px`,
            fontWeight: key.textStyle?.bold ? 'bold' : 'normal',
            fontStyle: key.textStyle?.italic ? 'italic' : 'normal',
            textDecoration: key.textStyle?.underline ? 'underline' : 'none',
            lineHeight: 1.2,
          }}
        >
          {key.name}
        </Typography>
        
        {key.amount && (
          <Typography sx={{ 
            mt: 0.5, 
            fontSize: `${Math.max((key.fontSize || 16) - 2, 10)}px`,
            lineHeight: 1.1
          }}>
            ${key.amount}
          </Typography>
        )}
      </Box>
    );
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ display: 'flex', height: '93vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 60,
          bgcolor: '#424242',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          px: 3,
          zIndex: 1000,
        }}
      >
        <IconButton onClick={() => navigate('/setup/sale-key-sets')} sx={{ color: 'white' }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6" sx={{ ml: 2 }}>Modify Sale Key -</Typography>
        <TextField
          variant="standard"
          value={currentSet?.name || ''}
          placeholder="Layout name"
          onChange={(e) => setCurrentSet((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
          onBlur={async () => {
            const name = currentSet?.name?.trim();
            if (currentSet?.id && name) {
              try {
                await saleKeyService.updateSaleKeySet(currentSet.id, { name });
              } catch (err) {
                console.error('Failed to save layout name:', err);
              }
            }
          }}
          sx={{
            ml: 1,
            '& .MuiInput-input': { color: 'white', fontSize: '1.25rem', fontWeight: 500 },
            '& .MuiInput-underline:before': { borderBottomColor: 'rgba(255,255,255,0.4)' },
            '& .MuiInput-underline:hover:before': { borderBottomColor: 'rgba(255,255,255,0.7)' },
            '& .MuiInput-underline:after': { borderBottomColor: 'white' },
          }}
        />
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, mt: 1, p: 3 }}>
        {loading ? null : error ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 120px)' }}>
            <Alert severity="error" sx={{ maxWidth: 600 }}>
              {error}
            </Alert>
          </Box>
        ) : (
          <Paper
            sx={{
              height: 'calc(100vh - 120px)',
              bgcolor: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
          {/* Grid Canvas */}
          <Box
            sx={{
              width: '100%',
              height: '100%',
              backgroundImage: `
                linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
              `,
              backgroundSize: `${100 / gridSize.cols}% ${100 / gridSize.rows}%`,
              position: 'relative',
            }}
            onClick={(e) => {
              // Only clear selection if clicking directly on the canvas background
              if (e.target === e.currentTarget) {
                debugSetSelectedKey(null);
              }
            }}
          >
            {/* Grid cell indicators */}
            {Array.from({ length: gridSize.rows }, (_, row) =>
              Array.from({ length: gridSize.cols }, (_, col) => {
                const isOccupied = saleKeys.some(key => {
                  // Add safety checks for key properties
                  if (!key || !key.position) return false;
                  
                  // Handle both old format (separate size) and new format (w,h in position)
                  const width = key.size?.width || key.position.w || 1;
                  const height = key.size?.height || key.position.h || 1;
                  
                  return col >= key.position.x && 
                         col < key.position.x + width &&
                         row >= key.position.y && 
                         row < key.position.y + height;
                });
                return (
                  <Box
                    key={`${row}-${col}`}
                    sx={{
                      position: 'absolute',
                      left: `${(col / gridSize.cols) * 100}%`,
                      top: `${(row / gridSize.rows) * 100}%`,
                      width: `${100 / gridSize.cols}%`,
                      height: `${100 / gridSize.rows}%`,
                      border: '1px dashed rgba(0,0,0,0.1)',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      color: 'rgba(0,0,0,0.3)',
                      cursor: isOccupied ? 'default' : 'pointer',
                      '&:hover': {
                        backgroundColor: isOccupied ? 'transparent' : 'rgba(0,0,0,0.05)',
                      },
                    }}
                    onClick={() => handleGridCellClick(row, col)}
                  >
                    {/* {isOccupied ? '●' : `${row},${col}`} */}
                  </Box>
                );
              })
            )}
            {saleKeys.map(renderSaleKey)}
            {/* Overlay: fully visible resize handles for selected key */}
            {(() => {
              if (!selectedKey || !selectedKey.position) return null;
              const width = selectedKey.size?.width || selectedKey.position.w || 1;
              const height = selectedKey.size?.height || selectedKey.position.h || 1;
              const cellWidth = 100 / gridSize.cols;
              const cellHeight = 100 / gridSize.rows;
              const left = (selectedKey.position.x || 0) * cellWidth;
              const top = (selectedKey.position.y || 0) * cellHeight;
              const w = width * cellWidth;
              const h = height * cellHeight;
              return (
                <Box sx={{ position: 'absolute', left: `${left}%`, top: `${top}%`, width: `${w}%`, height: `${h}%`, pointerEvents: 'none', zIndex: 200 }}>
                  <Box
                    sx={{ position: 'absolute', top: -6, left: -6, width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'nw-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'nw'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'nw'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', top: -6, right: -6, width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'ne-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'ne'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'ne'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', bottom: -6, right: -6, width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'se-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'se'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'se'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', bottom: -6, left: -6, width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'sw-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'sw'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'sw'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', top: '50%', left: -6, transform: 'translateY(-50%)', width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'w-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'w'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'w'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', top: '50%', right: -6, transform: 'translateY(-50%)', width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'e-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'e'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'e'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 'n-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'n'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 'n'); }}
                  />
                  <Box
                    sx={{ position: 'absolute', left: '50%', bottom: -6, transform: 'translateX(-50%)', width: 12, height: 12, backgroundColor: '#1976d2', borderRadius: '50%', cursor: 's-resize', pointerEvents: 'auto' }}
                    onMouseDown={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 's'); }}
                    onTouchStart={(e) => { e.stopPropagation(); handleResizeStart(e, selectedKey, 's'); }}
                  />
                </Box>
              );
            })()}
          </Box>
        </Paper>
        )}
      </Box>

      {/* Right Sidebar */}
      {!loading && !error && (
        <Box
          sx={{
            width: 350,
            bgcolor: 'white',
            borderLeft: '1px solid #e0e0e0',
            p: 2,
            overflowY: 'auto',
            mt: 2,
          }}
        >
        {/* Grid Configuration */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Grid Configuration</Typography>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Columns"
                type="number"
                value={gridSize.cols}
                onChange={(e) => setGridSize({ ...gridSize, cols: parseInt(e.target.value) || 6 })}
                inputProps={{ min: 1, max: 12 }}
                size="small"
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                fullWidth
                label="Rows"
                type="number"
                value={gridSize.rows}
                onChange={(e) => setGridSize({ ...gridSize, rows: parseInt(e.target.value) || 6 })}
                inputProps={{ min: 1, max: 12 }}
                size="small"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Key Management Buttons */}
        <Box sx={{ mb: 3 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddSaleKey}
            sx={{ mb: 1, bgcolor: '#4CAF50' }}
          >
             Add Sale Key
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={handleRemoveSaleKey}
            disabled={!selectedKey}
            sx={{ mb: 1 }}
          >
            Remove Sale Key
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<DeleteIcon />}
            onClick={() => {
              setSaleKeys([]);
              debugSetSelectedKey(null);
              setSnackbar({ open: true, message: 'Grid cleared', severity: 'info' });
            }}
            sx={{ color: '#d32f2f', borderColor: '#d32f2f', '&:hover': { borderColor: '#b71c1c' } }}
          >
            Clear Grid
          </Button>
        </Box>

        {selectedKey && (
          <>
            {/* Action Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Action</Typography>

              {/* Searchable, clearable Action combobox (matches reference react-select) */}
              <Autocomplete
                fullWidth
                options={ACTION_OPTIONS}
                getOptionLabel={(option) => option.label || ''}
                isOptionEqualToValue={(option, value) => option.value === value?.value}
                value={ACTION_OPTIONS.find((o) => o.value === selectedKey.action) || null}
                onChange={(event, newValue) => handlePropertyChange('action', newValue ? newValue.value : 'no-action')}
                renderInput={(params) => (
                  <TextField {...params} label="Action" placeholder="Search actions..." />
                )}
                sx={{ mb: 2 }}
              />
              
              {selectedKey.action === 'pay-amount' && (
                <TextField
                  fullWidth
                  label="Amount"
                  value={selectedKey.amount}
                  onChange={(e) => handlePropertyChange('amount', e.target.value)}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                  sx={{ mb: 2 }}
                />
              )}
              
              {selectedKey.action === 'pay-amount' && (
                <Autocomplete
                  fullWidth
                  options={availablePaymentMethods}
                  getOptionLabel={(option) => option.name || ''}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  // paymentMethod is stored as the method NAME string (SaleKeyPage's
                  // pay-amount handler reads it directly); match case-insensitively so
                  // legacy 'cash'/'card'/'eftpos' values still resolve.
                  value={
                    availablePaymentMethods.find(
                      (m) => (m.name || '').toLowerCase() === (selectedKey.paymentMethod || '').toLowerCase()
                    ) || null
                  }
                  loading={loadingPaymentMethods}
                  onChange={(event, newValue) =>
                    handlePropertyChange('paymentMethod', newValue ? newValue.name : 'cash')
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Payment Method" placeholder="Select..." />
                  )}
                />
              )}

              {selectedKey.action === 'pay-exact-amount' && (
                <Autocomplete
                  fullWidth
                  options={availablePaymentMethods}
                  getOptionLabel={(option) => option.name}
                  value={availablePaymentMethods.find(method => method.id === selectedKey.selectedPaymentMethod?.id) || null}
                  loading={loadingPaymentMethods}
                  onChange={(event, newValue) => {
                    handlePropertyChange('selectedPaymentMethod', newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Payment Method"
                      placeholder="Choose a payment method..."
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {(selectedKey.action === 'add-product' || selectedKey.action === 'add-product-case') && (
                <Autocomplete
                  fullWidth
                  options={availableProducts}
                  getOptionLabel={productOptionLabel}
                  value={(() => {
                    // Try to find the selected product in available products
                    if (selectedKey.selectedProduct) {
                      // First try to find by ID
                      if (selectedKey.selectedProduct.id) {
                        const foundProduct = availableProducts.find(product => product.id === selectedKey.selectedProduct.id);
                        return foundProduct || null;
                      }
                      // If no ID, try to find by name
                      if (selectedKey.selectedProduct.name) {
                        const foundProduct = availableProducts.find(product => product.name === selectedKey.selectedProduct.name);
                        return foundProduct || null;
                      }
                    }
                    if (selectedKey.productId) {
                      const foundById = availableProducts.find(product => product.id === selectedKey.productId);
                      return foundById || null;
                    }
                    return null;
                  })()}
                  loading={loadingProducts}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    // Single batched update (auto-fills name; price stays live at runtime).
                    handlePropertyChange({
                      selectedProduct: newValue,
                      productId: newValue?.id || null,
                      ...(newValue ? { name: newValue.name, amount: '' } : {}),
                    });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product"
                      placeholder="Choose a product..."
                      helperText={`Available products: ${availableProducts.length}, Selected: ${selectedKey.selectedProduct ? `${selectedKey.selectedProduct.name || ''} (#${selectedKey.productId || selectedKey.selectedProduct.id})` : 'None'}`}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'add-product-combo' && (
                <Autocomplete
                  fullWidth
                  options={availableCombos}
                  getOptionLabel={productOptionLabel}
                  value={(() => {
                    // Try to find the selected combo in available combos
                    if (selectedKey.selectedCombo) {
                      if (selectedKey.selectedCombo.id) {
                        const foundCombo = availableCombos.find(combo => combo.id === selectedKey.selectedCombo.id);
                        return foundCombo || null;
                      }
                      if (selectedKey.selectedCombo.name) {
                        const foundCombo = availableCombos.find(combo => combo.name === selectedKey.selectedCombo.name);
                        return foundCombo || null;
                      }
                    }
                    if (selectedKey.comboId) {
                      const foundById = availableCombos.find(combo => combo.id === selectedKey.comboId);
                      return foundById || null;
                    }
                    return null;
                  })()}
                  loading={loadingCombos}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    // Single batched update — comboId + selectedCombo persist together
                    // and auto-save runs once (fixes the lost-on-first-save selection).
                    handlePropertyChange({
                      selectedCombo: newValue,
                      comboId: newValue?.id || null,
                      ...(newValue ? { name: newValue.name, amount: '' } : {}),
                    });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product Combo"
                      placeholder="Choose a product combo..."
                      helperText={`Available combos: ${availableCombos.length}, Selected: ${selectedKey.selectedCombo ? `${selectedKey.selectedCombo.name || ''} (#${selectedKey.comboId || selectedKey.selectedCombo.id})` : 'None'}`}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'add-product' && (selectedKey.productId || selectedKey.selectedProduct) && (
                <>
                  {/* Use Product Image */}
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Use Product Image</InputLabel>
                    <Select
                      label="Use Product Image"
                      value={selectedKey.useProductImage || 'Never'}
                      onChange={(e) => handlePropertyChange('useProductImage', e.target.value)}
                    >
                      <MenuItem value="Never">Never</MenuItem>
                      <MenuItem value="If Available">If Available</MenuItem>
                      <MenuItem value="Always">Always</MenuItem>
                    </Select>
                  </FormControl>

                  <FormControlLabel
                    control={
                      <ShopfrontSwitch
                        checked={!!selectedKey.requestQuantity}
                        onChange={(e) => handlePropertyChange('requestQuantity', e.target.checked)}
                      />
                    }
                    label="Request Quantity"
                    sx={{ mb: 1 }}
                  />

                  {/* Quantity input shown if requesting fixed quantity */}
                  {!selectedKey.requestQuantity && (
                    <TextField
                      fullWidth
                      label="Quantity"
                      type="number"
                      value={selectedKey.quantity || ''}
                      onChange={(e) => handlePropertyChange('quantity', e.target.value)}
                      size="small"
                      sx={{ mb: 2 }}
                    />
                  )}
                </>
              )}

              {selectedKey.action === 'add-product-case' && (selectedKey.productId || selectedKey.selectedProduct) && (
                <>
                  {/* Use Product Image */}
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Use Product Image</InputLabel>
                    <Select
                      label="Use Product Image"
                      value={selectedKey.useProductImage || 'Never'}
                      onChange={(e) => handlePropertyChange('useProductImage', e.target.value)}
                    >
                      <MenuItem value="Never">Never</MenuItem>
                      <MenuItem value="If Available">If Available</MenuItem>
                      <MenuItem value="Always">Always</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Request Case Quantity toggle */}
                  <FormControlLabel
                    control={
                      <ShopfrontSwitch
                        checked={!!selectedKey.requestCaseQuantity}
                        onChange={(e) => handlePropertyChange('requestCaseQuantity', e.target.checked)}
                      />
                    }
                    label="Request Case Quantity"
                    sx={{ mb: 1 }}
                  />

                  {/* Case Quantity input shown if requesting fixed case quantity */}
                  {!selectedKey.requestCaseQuantity && (
                    <TextField
                      fullWidth
                      label="Case Quantity"
                      type="number"
                      value={selectedKey.caseQuantity || ''}
                      onChange={(e) => handlePropertyChange('caseQuantity', e.target.value)}
                      size="small"
                      sx={{ mb: 2 }}
                      helperText="Number of cases to add"
                    />
                  )}
                </>
              )}
              
              {(selectedKey.action === 'open-sale-key-folder' || selectedKey.action === 'navigation') && (
                <Autocomplete
                  fullWidth
                  options={availableFolders}
                  getOptionLabel={(option) => option.name || ''}
                  value={(() => {
                    if (selectedKey.folderId) {
                      return availableFolders.find(folder => folder.id === selectedKey.folderId) || null;
                    }
                    if (selectedKey.folderName) {
                      return availableFolders.find(folder => folder.name === selectedKey.folderName) || null;
                    }
                    return null;
                  })()}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    // Single call: folderId + folderName must persist together.
                    handlePropertyChange({
                      folderId: newValue ? newValue.id : '',
                      folderName: newValue ? newValue.name : '',
                    });
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Folder"
                      placeholder="Choose a sale key folder..."
                      helperText={`Available folders: ${availableFolders.length}, Selected: ${selectedKey.folderName || selectedKey.folderId || 'None'}`}
                    />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {(selectedKey.action === 'display-classification-products' || selectedKey.action === 'display-classification-products-case') && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel id="classification-type-label">Classification Type</InputLabel>
                    <Select
                      key={`classification-type-${selectedKey.id}`}
                      labelId="classification-type-label"
                      value={selectedKey.classificationType || ''}
                      onChange={(e) => {
                        const newType = e.target.value;
                        if (selectedKey) {
                          const updatedKey = { 
                            ...selectedKey,
                            classificationType: newType || undefined,
                            classificationId: '',
                            classificationName: ''
                          };
                          debugSetSelectedKey(updatedKey);
                          const updatedSaleKeys = saleKeys.map(key => 
                            key.id === selectedKey.id ? updatedKey : key
                          );
                          setSaleKeys(updatedSaleKeys);
                        }
                        
                        if (availableClassifications.length === 0) {
                          loadClassifications();
                        }
                      }}
                      label="Classification Type"
                    >
                      <MenuItem value="BRAND">Brand</MenuItem>
                      <MenuItem value="CATEGORY">Category</MenuItem>
                      <MenuItem value="FAMILY">Family</MenuItem>
                      <MenuItem value="TAG">Tag</MenuItem>
                    </Select>
                  </FormControl>

                  {(() => {
                    if (!selectedKey.classificationType) return null;
                    
                    const filteredOptions = availableClassifications.filter(c => {
                      const classificationType = (c.type || '').toUpperCase();
                      const selectedType = (selectedKey.classificationType || '').toUpperCase();
                      return classificationType === selectedType;
                    });
                    
                    // Dynamic label based on classification type
                    const getClassificationLabel = (type) => {
                      const upperType = (type || '').toUpperCase();
                      switch (upperType) {
                        case 'BRAND': return 'Brands';
                        case 'CATEGORY': return 'Categories';
                        case 'FAMILY': return 'Families';
                        case 'TAG': return 'Tags';
                        default: return 'Classification';
                      }
                    };
                    
                    return (
                      <Autocomplete
                        fullWidth
                        options={filteredOptions}
                        getOptionLabel={(option) => option.name || ''}
                        value={(() => {
                          if (selectedKey.classificationId) {
                            return availableClassifications.find(c => c.id === selectedKey.classificationId) || null;
                          }
                          if (selectedKey.classificationName) {
                            return availableClassifications.find(c => c.name === selectedKey.classificationName) || null;
                          }
                          return null;
                        })()}
                        isOptionEqualToValue={(option, value) => option.id === value?.id}
                        onChange={(event, newValue) => {
                          // Single call: id + name must persist together (stale-closure safe).
                          handlePropertyChange({
                            classificationId: newValue ? newValue.id : '',
                            classificationName: newValue ? newValue.name : '',
                          });
                        }}
                        loading={loadingClassifications}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={getClassificationLabel(selectedKey.classificationType)}
                            placeholder="Select..."
                            helperText={`Available: ${filteredOptions.length}, Selected: ${selectedKey.classificationName || 'None'}`}
                          />
                        )}
                        sx={{ mb: 2 }}
                      />
                    );
                  })()}
                </>
              )}

              {(selectedKey.action === 'add-component-to-current' || selectedKey.action === 'remove-component-from-current') && (
                <Autocomplete
                  fullWidth
                  options={availableProducts}
                  getOptionLabel={productOptionLabel}
                  value={availableProducts.find(p => p.id === (selectedKey.componentProduct?.id || selectedKey.componentProductId)) || null}
                  loading={loadingProducts}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) =>
                    handlePropertyChange('componentProduct', newValue ? { id: newValue.id, name: newValue.name } : null)}
                  renderInput={(params) => (
                    <TextField {...params} label="Component (product)" placeholder="Choose a component..." />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'add-customer' && (
                <Autocomplete
                  fullWidth
                  options={availableCustomers}
                  getOptionLabel={(o) => o?.name || [o?.firstName, o?.lastName].filter(Boolean).join(' ') || o?.email || String(o?.id || '')}
                  value={availableCustomers.find(c => c.id === (selectedKey.customerData?.id || selectedKey.customerId)) || null}
                  loading={loadingCustomers}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    const name = newValue
                      ? (newValue.name || [newValue.firstName, newValue.lastName].filter(Boolean).join(' '))
                      : '';
                    handlePropertyChange('customerData', newValue ? { id: newValue.id, name } : null);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Customer" placeholder="Choose a customer..." />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'add-note' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Apply Note To</InputLabel>
                  <Select
                    value={selectedKey.noteScope || 'Sale'}
                    onChange={(e) => handlePropertyChange('noteScope', e.target.value)}
                    label="Apply Note To"
                  >
                    <MenuItem value="Product">Product</MenuItem>
                    <MenuItem value="Sale">Sale</MenuItem>
                    <MenuItem value="Sale (Internal)">Sale (Internal)</MenuItem>
                  </Select>
                </FormControl>
              )}

              {selectedKey.action === 'apply-discount' && (
                <>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Discount Type</InputLabel>
                    <Select
                      value={selectedKey.discountType || 'discount_percentage'}
                      onChange={(e) => handlePropertyChange('discountType', e.target.value)}
                      label="Discount Type"
                    >
                      <MenuItem value="discount_percentage">Discount Percentage</MenuItem>
                      <MenuItem value="discount_total_amount">Discount Total Amount</MenuItem>
                      <MenuItem value="discount_item_amount">Discount Item Amount</MenuItem>
                      <MenuItem value="total_price_override">Total Price Override</MenuItem>
                      <MenuItem value="item_price_override">Item Price Override</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Discount / Quantity"
                    type="number"
                    value={selectedKey.discountValue || ''}
                    onChange={(e) => handlePropertyChange('discountValue', e.target.value)}
                    helperText="Value meaning depends on the Discount Type"
                    sx={{ mb: 2 }}
                  />
                </>
              )}

              {selectedKey.action === 'product-search-input' && (
                <TextField
                  fullWidth
                  label="Text"
                  value={selectedKey.keyboardText || ''}
                  onChange={(e) => handlePropertyChange('keyboardText', e.target.value)}
                  helperText="Supports [Backspace], [Delete], [Clear]"
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'change-price-set' && (
                <Autocomplete
                  fullWidth
                  options={availablePriceSets}
                  getOptionLabel={(option) => option.name || ''}
                  value={
                    availablePriceSets.find(pl => pl.id === selectedKey.priceSetId) ||
                    availablePriceSets.find(pl => pl.name === selectedKey.priceSetName) ||
                    null
                  }
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    handlePropertyChange({
                      priceSetId: newValue ? newValue.id : '',
                      priceSetName: newValue ? newValue.name : '',
                    });
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Price Set" placeholder="Select..." />
                  )}
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'view-promotions' && (
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={selectedKey.promotionType || 'Current'}
                    onChange={(e) => handlePropertyChange('promotionType', e.target.value)}
                    label="Type"
                  >
                    <MenuItem value="Current">Current</MenuItem>
                    <MenuItem value="Future">Future</MenuItem>
                    <MenuItem value="All">All</MenuItem>
                  </Select>
                </FormControl>
              )}

              {selectedKey.action === 'info' && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Information Text"
                  value={selectedKey.infoText || ''}
                  onChange={(e) => handlePropertyChange('infoText', e.target.value)}
                  helperText="Shown when the key is pressed"
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'special' && (
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label="Message"
                  value={selectedKey.specialText || ''}
                  onChange={(e) => handlePropertyChange('specialText', e.target.value)}
                  helperText="Shown when the key is pressed"
                  sx={{ mb: 2 }}
                />
              )}

              {selectedKey.action === 'view-previous-date' && (
                <TextField
                  fullWidth
                  label="Duration Ago (ISO 8601 Period)"
                  value={selectedKey.durationAgo || ''}
                  onChange={(e) => handlePropertyChange('durationAgo', e.target.value)}
                  placeholder="e.g. P18Y or P21Y"
                  sx={{ mb: 2 }}
                />
              )}

              {(selectedKey.action === 'view-previous-date' || selectedKey.action === 'view-current-time') && (
                <TextField
                  fullWidth
                  label="Format"
                  value={selectedKey.dateFormat || ''}
                  onChange={(e) => handlePropertyChange('dateFormat', e.target.value)}
                  placeholder={selectedKey.action === 'view-current-time' ? 'HH:mm:ss' : 'YYYY-MM-DD'}
                  sx={{ mb: 2 }}
                />
              )}
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Behavior Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Behaviour</Typography>
               <FormControlLabel
                 control={
                   <ShopfrontSwitch
                     checked={selectedKey.behavior?.disableKey || false}
                     onChange={(e) => handlePropertyChange('behavior.disableKey', e.target.checked)}
                   />
                 }
                 label="Disable Key"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <ShopfrontSwitch
                     checked={selectedKey.behavior?.preventDisable || false}
                     onChange={(e) => handlePropertyChange('behavior.preventDisable', e.target.checked)}
                   />
                 }
                 label="Prevent Disable"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <ShopfrontSwitch
                     checked={selectedKey.behavior?.preventHover || false}
                     onChange={(e) => handlePropertyChange('behavior.preventHover', e.target.checked)}
                   />
                 }
                 label="Prevent Hover"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <ShopfrontSwitch
                     checked={selectedKey.behavior?.preventHoverAnimation || false}
                     onChange={(e) => handlePropertyChange('behavior.preventHoverAnimation', e.target.checked)}
                   />
                 }
                 label="Prevent Hover Animation"
               />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Position Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Position</Typography>
              <Grid container spacing={2}>
               <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="X Position"
                     type="number"
                     value={selectedKey.position?.x || 0}
                     onChange={(e) => handlePropertyChange('position.x', parseInt(e.target.value) || 0)}
                     inputProps={{ min: 0, max: gridSize.cols - 1 }}
                     size="small"
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="Y Position"
                     type="number"
                     value={selectedKey.position?.y || 0}
                     onChange={(e) => handlePropertyChange('position.y', parseInt(e.target.value) || 0)}
                     inputProps={{ min: 0, max: gridSize.rows - 1 }}
                     size="small"
                   />
                 </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Size Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Size</Typography>
              <Grid container spacing={2}>
                                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="Width (cells)"
                     type="number"
                     value={selectedKey.size?.width || selectedKey.position?.w || 1}
                     onChange={(e) => handlePropertyChange('size.width', parseInt(e.target.value) || 1)}
                     inputProps={{ min: 1, max: gridSize.cols }}
                     size="small"
                   />
                 </Grid>
                 <Grid item xs={6}>
                   <TextField
                     fullWidth
                     label="Height (cells)"
                     type="number"
                     value={selectedKey.size?.height || selectedKey.position?.h || 1}
                     onChange={(e) => handlePropertyChange('size.height', parseInt(e.target.value) || 1)}
                     inputProps={{ min: 1, max: gridSize.rows }}
                     size="small"
                   />
                 </Grid>
              </Grid>
              <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
                Drag any of the 8 resize handles to resize visually
              </Typography>
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Appearance Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Appearance</Typography>

              {/* Normal Text = label drawn on the tile (reference sets caption here, not via a Key Name field) */}
              <TextField
                fullWidth
                label="Normal Text"
                value={selectedKey.name || ''}
                onChange={(e) => handlePropertyChange('name', e.target.value)}
                sx={{ mb: 2 }}
                placeholder="Text shown on the key..."
              />

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Font Size</InputLabel>
                <Select
                  value={selectedKey.fontSize}
                  onChange={(e) => handlePropertyChange('fontSize', e.target.value)}
                  label="Font Size"
                >
                  <MenuItem value={12}>12</MenuItem>
                  <MenuItem value={14}>14</MenuItem>
                  <MenuItem value={16}>16</MenuItem>
                  <MenuItem value={18}>18</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={24}>24</MenuItem>
                  <MenuItem value={28}>28</MenuItem>
                  <MenuItem value={32}>32</MenuItem>
                  <MenuItem value={36}>36</MenuItem>
                  <MenuItem value={40}>40</MenuItem>
                </Select>
              </FormControl>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Text Style</Typography>
                                 <ToggleButtonGroup
                   value={Object.keys(selectedKey.textStyle || {}).filter(key => selectedKey.textStyle?.[key])}
                   onChange={(e, newFormats) => {
                     const updatedStyles = { bold: false, italic: false, underline: false };
                     newFormats.forEach(format => {
                       updatedStyles[format] = true;
                     });
                     handlePropertyChange('textStyle', updatedStyles);
                   }}
                   size="small"
                 >
                  <ToggleButton value="bold">
                    <FormatBold />
                  </ToggleButton>
                  <ToggleButton value="italic">
                    <FormatItalic />
                  </ToggleButton>
                  <ToggleButton value="underline">
                    <FormatUnderlined />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {renderColorControl('Border Colour', 'borderColor')}
              {renderColorControl('Normal Background Colour', 'backgroundColor')}
              {renderColorControl('Normal Text Colour', 'textColor')}

              {/* Image Section */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>Normal Image</Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<ImageIcon />}
                    size="small"
                    onClick={() => setMediaDialogOpen(true)}
                  >
                    Select Image
                  </Button>
                  {selectedKey.image && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      onClick={handleRemoveImage}
                    >
                      Remove Image
                    </Button>
                  )}
                </Box>

                {/* Image fit toggles (reference: Constrain Width/Height on, Fill off) */}
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={selectedKey.constrainImageWidth !== false}
                      onChange={(e) => handlePropertyChange('constrainImageWidth', e.target.checked)}
                    />
                  }
                  label="Constrain Image Width"
                  sx={{ display: 'block', mb: 1 }}
                />
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={selectedKey.constrainImageHeight !== false}
                      onChange={(e) => handlePropertyChange('constrainImageHeight', e.target.checked)}
                    />
                  }
                  label="Constrain Image Height"
                  sx={{ display: 'block', mb: 1 }}
                />
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={!!selectedKey.fillKeyWithImage}
                      onChange={(e) => handlePropertyChange('fillKeyWithImage', e.target.checked)}
                    />
                  }
                  label="Fill Key with Image"
                  sx={{ display: 'block', mb: 1 }}
                />

                {/* Image Preview */}
                {selectedKey.image && (
                  <Box sx={{ 
                    width: '100%', 
                    maxWidth: 150,
                    height: 100, 
                    border: '2px dashed #ccc', 
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    mb: 1
                  }}>
                    <img 
                      src={selectedKey.image} 
                      alt="Sale key preview"
                      style={{ 
                        maxWidth: '100%', 
                        maxHeight: '100%', 
                        objectFit: 'contain' 
                      }} 
                    />
                  </Box>
                )}
              </Box>
            </Box>
          </>
        )}

        {/* Bottom Action Buttons */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{ mb: 1 }}
          >
            Save
          </Button>
          <Button
            fullWidth
            variant="outlined"
            startIcon={<CloseIcon />}
            onClick={() => navigate('/setup/sale-key-sets')}
          >
            Cancel
          </Button>
        </Box>
      </Box>
      )}

      {/* Media library dialog for selecting key images */}
      <MediaDialog
        open={mediaDialogOpen}
        onClose={() => setMediaDialogOpen(false)}
        onSelect={(url) => {
          handleImageSelectedFromMedia(url);
          setMediaDialogOpen(false);
        }}
        accept="image/*"
      />

      {/* Color Picker Dialog */}
      <Dialog
        open={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Choose Color</DialogTitle>
        <DialogContent>
          <ChromePicker
            color={selectedKey?.[colorPickerType] || '#000000'}
            onChange={handleColorChange}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowColorPicker(false)}>Done</Button>
        </DialogActions>
      </Dialog>


      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SaleKeyEditor;
