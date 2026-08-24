import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  Switch,
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
import saleKeyService from '../../services/saleKeyService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { getSaleKeysOutletId } from '../../utils/saleKeysOutlet';
import { productOptionLabel } from '../../utils/productOptionLabel';
import productService from '../../services/productService';
import productComboService from '../../services/productComboService';
import paymentMethodService from '../../services/paymentMethodService';
import classificationService from '../../services/classificationService';
import MediaDialog from '../../components/Common/MediaDialog';
import posLocalDb from '../../services/posLocalDb';

const SaleKey = () => {
  const { setId } = useParams();
  const navigate = useNavigate();
  const { getOutletId } = useAuth();
  const { selectedOutletId, isSuperAdmin } = useSelectedOutlet();
  const saleKeysOutletId = () =>
    getSaleKeysOutletId({ isSuperAdmin, getOutletId, selectedOutletId });
  const [saleKeys, setSaleKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [gridSize, setGridSize] = useState({ rows: 6, cols: 6 });
  const [currentSet, setCurrentSet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [isResizing, setIsResizing] = useState(false);
  const [resizeData, setResizeData] = useState(null);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);

  // Load existing configuration on mount
  useEffect(() => {
    loadSaleKeyConfig();
  }, [setId]);

  const loadSaleKeyConfig = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (setId) {
        // Parse setId to integer and validate
        const parsedSetId = parseInt(setId, 10);
        if (isNaN(parsedSetId)) {
          // If setId is not a number, try to find the sale key set by name
          try {
            const allSets = await saleKeyService.getSaleKeySets(saleKeysOutletId());
            const foundSet = allSets.saleKeySets?.find(set => {
              const setName = set.name.toLowerCase();
              const searchName = setId.toLowerCase();
              
              // Try multiple matching strategies
              return setName === searchName || // exact match
                     setName.replace(/\s+/g, '-') === searchName || // spaces to hyphens
                     setName.replace(/\s+/g, '') === searchName.replace(/-/g, '') || // remove all spaces and hyphens
                     searchName.replace(/-/g, ' ') === setName; // hyphens to spaces
            });
            
            if (foundSet) {
              // Redirect to the correct numeric ID route
              navigate(`/setup/sale-key/${foundSet.id}`, { replace: true });
              return;
            } else {
              setError(`Sale key set "${setId}" not found. Available sets: ${allSets.saleKeySets?.map(s => s.name).join(', ') || 'None'}`);
              setGridSize({ rows: 6, cols: 6 });
              setSaleKeys([]);
              return;
            }
          } catch (lookupError) {
            console.error('Error looking up sale key set by name:', lookupError);
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
        // Get the active sale key set
        const activeSet = await saleKeyService.getActiveSaleKeySet(saleKeysOutletId());
        setCurrentSet(activeSet);
        if (activeSet && activeSet.config) {
          setGridSize(activeSet.config.gridSize || { rows: 6, cols: 6 });
          setSaleKeys(activeSet.config.saleKeys || []);
        } else {
          // Use default configuration if no active set
          setGridSize({ rows: 6, cols: 6 });
          setSaleKeys([]);
        }
      }
    } catch (error) {
      console.error('Error loading sale key config:', error);
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
    paymentMethod: 'cash',
    selectedProduct: null,
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
    setSelectedKey(newKey);
    setSnackbar({ open: true, message: 'New sale key added', severity: 'success' });
  };

  const findNextAvailablePosition = () => {
    // Find the first empty position in the grid
    for (let row = 0; row < gridSize.rows; row++) {
      for (let col = 0; col < gridSize.cols; col++) {
        const isOccupied = saleKeys.some(key => {
          if (!key || !key.position) return false;
          
          // Handle both old format (separate size) and new format (w,h in position)
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
      setSelectedKey(null);
      setSnackbar({ open: true, message: 'Sale key removed', severity: 'info' });
    }
  };

  const handleKeySelect = (key) => {
        const keyWithDefaults = {
      ...defaultKeyProperties,
      ...key,
      // Preserve existing nested objects but ensure they exist
      textStyle: { ...defaultKeyProperties.textStyle, ...key.textStyle },
      behavior: { ...defaultKeyProperties.behavior, ...key.behavior },
      position: { ...defaultKeyProperties.position, ...key.position },
      size: { ...defaultKeyProperties.size, ...key.size }
    };
        setSelectedKey(keyWithDefaults);
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
        if (event) {
      event.stopPropagation();
    }
    
    if (key.action === 'open-sale-key-folder') {        
      handleKeySelect(key);
      
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
    handleKeySelect(key);
  };

  const handleGridCellClick = (row, col) => {
    // Check if cell is already occupied
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
      // Add a new key at this position
      const newKey = {
        ...defaultKeyProperties,
        id: `key-${Date.now()}`,
        name: 'New Key',
        position: { x: col, y: row },
      };
      setSaleKeys([...saleKeys, newKey]);
      setSelectedKey(newKey);
      setSnackbar({ open: true, message: 'New sale key added at selected position', severity: 'success' });
    }
  };

  // Helper to normalise mouse/touch events
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
      // Prevent page scroll while resizing on touch devices
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
      setSelectedKey({ ...selectedKey, size: newSize, position: newPosition });
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

  const handlePropertyChange = (property, value) => {
    if (selectedKey) {
      const updatedKey = { ...selectedKey };
      
      if (property.includes('.')) {
        const [parent, child] = property.split('.');
        updatedKey[parent] = { ...updatedKey[parent], [child]: value };
      } else {
        updatedKey[property] = value;
      }
      
      
      setSelectedKey(updatedKey);
      const updatedSaleKeys = saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      );
      setSaleKeys(updatedSaleKeys);
    }
  };

  const handleTextStyleChange = (style) => {
    if (selectedKey) {
      const updatedKey = { ...selectedKey };
      updatedKey.textStyle[style] = !updatedKey.textStyle[style];
      setSelectedKey(updatedKey);
      setSaleKeys(saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      ));
    }
  };

  const handleColorChange = (color) => {
    if (selectedKey && colorPickerType) {
      const updatedKey = { ...selectedKey };
      updatedKey[colorPickerType] = color.hex;
      setSelectedKey(updatedKey);
      setSaleKeys(saleKeys.map(key => 
        key.id === selectedKey.id ? updatedKey : key
      ));
    }
  };

  const handleSave = async () => {
    try {
      const config = {
        gridSize,
        saleKeys,
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

  const loadCombos = async () => {
    setLoadingCombos(true);
    try {
      if (posLocalDb.isReady()) {
        const memoryCombos = posLocalDb.getCombos();
        if (memoryCombos.length > 0) { setAvailableCombos(memoryCombos); return; }
      }
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('combos');
      if (cached.length > 0) {
        setAvailableCombos(cached);
        const stale = await posLocalDb.isStoreStale('combos');
        if (stale) {
          productComboService.getProductCombos({ limit: 1000, status: 'Active' })
            .then((r) => { if (r?.combos?.length) setAvailableCombos(r.combos); })
            .catch(() => {});
        }
        return;
      }
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
      if (posLocalDb.isReady()) {
        const memoryProducts = posLocalDb.getProducts();
        if (memoryProducts.length > 0) { setAvailableProducts(memoryProducts); return; }
      }
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('products');
      if (cached.length > 0) {
        setAvailableProducts(cached);
        const stale = await posLocalDb.isStoreStale('products');
        if (stale) {
          productService.getProducts({ limit: 500, status: 'Active' })
            .then((r) => { if (r?.products?.length) setAvailableProducts(r.products); })
            .catch(() => {});
        }
        return;
      }
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
      // Folders belong to ONE outlet - the cache and the API response can carry other outlets' sets (super admin in All Outlets mode), so filter like SaleKeySets does.
      const oid = saleKeysOutletId();
      const mine = (rows) => rows.filter((s) => oid != null && Number(s.outletId) === Number(oid));
      const cached = mine(await posLocalDb.getStoreAll('saleKeySets'));
      if (cached.length > 0) {
        setAvailableFolders(cached.map((s) => ({ id: s.id, name: s.name })));
        const stale = await posLocalDb.isStoreStale('saleKeySets');
        if (stale) {
          saleKeyService.getSaleKeySets(oid)
            .then(async (r) => {
              const sets = r.saleKeySets || [];
              await posLocalDb.putStoreAll('saleKeySets', sets);
              setAvailableFolders(mine(sets).map((s) => ({ id: s.id, name: s.name })));
            })
            .catch(() => {});
        }
        return;
      }
      const response = await saleKeyService.getSaleKeySets(oid);
      const sets = response.saleKeySets || [];
      await posLocalDb.putStoreAll('saleKeySets', sets);
      setAvailableFolders(mine(sets).map((s) => ({ id: s.id, name: s.name })));
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

  const loadPaymentMethods = async () => {
    setLoadingPaymentMethods(true);
    try {
      if (posLocalDb.isReady()) {
        const memoryPMs = posLocalDb.getPaymentMethods();
        if (memoryPMs.length > 0) { setAvailablePaymentMethods(memoryPMs); return; }
      }
      await posLocalDb.init();
      const cached = await posLocalDb.getStoreAll('paymentMethods');
      if (cached.length > 0) {
        setAvailablePaymentMethods(cached);
        const stale = await posLocalDb.isStoreStale('paymentMethods');
        if (stale) {
          paymentMethodService.getPaymentMethods()
            .then((r) => { if (r?.paymentMethods?.length) setAvailablePaymentMethods(r.paymentMethods); })
            .catch(() => {});
        }
        return;
      }
      const response = await paymentMethodService.getPaymentMethods();
      setAvailablePaymentMethods(response.paymentMethods || []);
    } catch (error) {
      console.error('Error loading payment methods:', error);
      setAvailablePaymentMethods([]);
    } finally {
      setLoadingPaymentMethods(false);
    }
  };

  // Load products, folders, and payment methods on component mount
  useEffect(() => {
    loadProducts();
    loadCombos();
    loadFolders();
    loadPaymentMethods();
    loadClassifications();
    // Mount-only data load by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedKey &&
        (selectedKey.action === 'display-classification-products' ||
          selectedKey.action === 'display-classification-products-case') &&
        availableClassifications.length === 0) {
      loadClassifications();
    }
  }, [selectedKey?.action]);

  // Use media library to pick an image URL (no base64 conversion)
  const handleImageSelectedFromMedia = (imageUrl) => {
    if (!selectedKey) return;
    const updatedKey = { ...selectedKey, image: imageUrl };
    setSelectedKey(updatedKey);
    setSaleKeys(saleKeys.map(key =>
      key.id === selectedKey.id ? updatedKey : key
    ));
  };

  const handleRemoveImage = () => {
    if (selectedKey) {
      const updatedKey = { ...selectedKey, image: null };
      setSelectedKey(updatedKey);
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
            {/* Selection outline (drawn outside without affecting layout) */}
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
              width: '100%', 
              height: '100%', 
              objectFit: 'contain',
              marginBottom: 8 
            }} 
          />
        ) : (
          <Box sx={{ fontSize: `${Math.max(key.fontSize || 16, 16)}px`, mb: 1 }}>
            {key.action === 'pay-amount' ? '$' : 
             key.action === 'pay-exact-amount' ? '💳' :
             key.action === 'add-product' ? '🛒' :
             key.action === 'subtract-quantity' ? '➖' :
             key.action === 'add-quantity' ? '➕' :
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
        <IconButton
          onClick={() => navigate('/setup/sale-key-sets')}
          sx={{ color: 'white', mr: 2 }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h6">
          Modify Sale Key - {currentSet?.name || 'Loading...'}
        </Typography>
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
                setSelectedKey(null);
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
                  {/* Corner handles */}
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
                  {/* Edge handles */}
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
              setSelectedKey(null);
              setSnackbar({ open: true, message: 'Grid cleared', severity: 'info' });
            }}
            sx={{ color: '#d32f2f', borderColor: '#d32f2f', '&:hover': { borderColor: '#b71c1c' } }}
          >
            Clear Grid
          </Button>
        </Box>

        {selectedKey && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Action</Typography>
              <TextField
                fullWidth
                label="Key Name"
                value={selectedKey.name || ''}
                onChange={(e) => handlePropertyChange('name', e.target.value)}
                sx={{ mb: 2 }}
                placeholder="Enter key name..."
              />
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Action Type</InputLabel>
                <Select
                  value={selectedKey.action}
                  onChange={(e) => handlePropertyChange('action', e.target.value)}
                  label="Action Type"
                  MenuProps={{
                    PaperProps: {
                      style: {
                        maxHeight: 320,
                        maxWidth: 320,
                        overflow: 'auto',
                      },
                      sx: {
                        '& .MuiMenuItem-root': {
                          whiteSpace: 'normal',
                          wordBreak: 'break-word',
                          minHeight: 'auto',
                          paddingTop: 1,
                          paddingBottom: 1,
                        },
                      },
                    },
                  }}
                >
                  <MenuItem value="no-action">No Action</MenuItem>
                  <MenuItem value="pay-amount">Pay a Specified Amount</MenuItem>
                  <MenuItem value="pay-exact-amount">Pay Exact Amount</MenuItem>
                  <MenuItem value="add-product">Add Product</MenuItem>
                  <MenuItem value="add-product-combo">Add Product Combo</MenuItem>
                  <MenuItem value="add-gift-card">Add Gift Card</MenuItem>
                  <MenuItem value="subtract-quantity">Subtract Quantity from Current Product</MenuItem>
                  <MenuItem value="add-quantity">Add Quantity to Current Product</MenuItem>
                  <MenuItem value="clear-sale">Clear Sale</MenuItem>
                  <MenuItem value="cancel-current-sale">Cancel Current Sale</MenuItem>
                  <MenuItem value="open-drawer">Open Drawer</MenuItem>
                  <MenuItem value="open-sale-key-folder">Open Sale Key Folder</MenuItem>
                  <MenuItem value="display-product-details">Display Product Details</MenuItem>
                  <MenuItem value="view-live-profit">View Live Profit</MenuItem>
                  <MenuItem value="view-promotions">View the Current Promotions</MenuItem>
                  <MenuItem value="create-customer">Create a Customer</MenuItem>
                  <MenuItem value="display-classification-products">Display all Products in Classification</MenuItem>
                  <MenuItem value="display-classification-products-case">Display all Products in Classification and Add Case</MenuItem>
                </Select>
              </FormControl>
              
              {selectedKey.action === 'pay-amount' && (
                <TextField
                  fullWidth
                  label="Amount"
                  value={selectedKey.amount}
                  onChange={(e) => handlePropertyChange('amount', e.target.value)}
                  sx={{ mb: 2 }}
                />
              )}
              
              {selectedKey.action === 'pay-amount' && (
                <FormControl fullWidth>
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={selectedKey.paymentMethod}
                    onChange={(e) => handlePropertyChange('paymentMethod', e.target.value)}
                    label="Payment Method"
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="card">Card</MenuItem>
                    <MenuItem value="eftpos">EFTPOS</MenuItem>
                  </Select>
                </FormControl>
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

              {selectedKey.action === 'add-product-combo' && (
                <Autocomplete
                  fullWidth
                  options={availableCombos}
                  getOptionLabel={productOptionLabel}
                  value={selectedKey.selectedCombo || null}
                  loading={loadingCombos}
                  onChange={(event, newValue) => {
                    handlePropertyChange('selectedCombo', newValue);
                    handlePropertyChange('comboId', newValue?.id || null);
                    // Auto-set the name and amount if combo is selected
                    if (newValue) {
                      handlePropertyChange('name', newValue.name);
                      handlePropertyChange('amount', (newValue.calculatedTotalPrice || newValue.totalPrice || 0).toString());
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product Combo"
                      placeholder="Choose a product combo..."
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

              {selectedKey.action === 'add-product' && (
                <Autocomplete
                  fullWidth
                  options={availableProducts}
                  getOptionLabel={productOptionLabel}
                  value={selectedKey.selectedProduct || null}
                  loading={loadingProducts}
                  onChange={(event, newValue) => {
                    handlePropertyChange('selectedProduct', newValue);
                    // Auto-set the name and amount if product is selected
                    if (newValue) {
                      handlePropertyChange('name', newValue.name);
                      handlePropertyChange('amount', (newValue.retailPrice || newValue.prices?.[0]?.price || 0).toString());
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product"
                      placeholder="Choose a product..."
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
              
              {selectedKey.action === 'open-sale-key-folder' && (
                <Autocomplete
                  fullWidth
                  options={availableFolders}
                  getOptionLabel={(option) => option.name || ''}
                  value={(() => {
                    // First try to find by folderId if it exists
                    if (selectedKey.folderId) {
                      return availableFolders.find(folder => folder.id === selectedKey.folderId) || null;
                    }
                    // If no folderId, try to find by folderName
                    if (selectedKey.folderName) {
                      return availableFolders.find(folder => folder.name === selectedKey.folderName) || null;
                    }
                    return null;
                  })()}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  onChange={(event, newValue) => {
                    if (newValue) {
                      // Set both ID and name
                      handlePropertyChange('folderId', newValue.id);
                      handlePropertyChange('folderName', newValue.name);
                    } else {
                      // Clear both if nothing selected
                      handlePropertyChange('folderId', '');
                      handlePropertyChange('folderName', '');
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Folder"
                      placeholder="Choose a sale key folder..."
                      helperText={`Available folders: ${availableFolders.length}, Selected: ${selectedKey.folderId ? selectedKey.folderName || selectedKey.folderId : 'None'}`}
                    />
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
                        console.log('Classification Type changed to:', newType);
                        console.log('Current selectedKey before update:', selectedKey);
                        
                        if (selectedKey) {
                          const updatedKey = { 
                            ...selectedKey,
                            classificationType: newType || undefined,
                            classificationId: '',
                            classificationName: ''
                          };
                          console.log('Updated key:', updatedKey);
                          setSelectedKey(updatedKey);
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
                    // Debug: Check if condition should render
                    const shouldRender = !!selectedKey.classificationType;
                    console.log('Third selector render check:', {
                      shouldRender,
                      classificationType: selectedKey.classificationType,
                      action: selectedKey.action,
                      selectedKey: selectedKey
                    });
                    
                    if (!shouldRender) {
                      return null;
                    }
                    
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
                          if (newValue) {
                            handlePropertyChange('classificationId', newValue.id);
                            handlePropertyChange('classificationName', newValue.name);
                          } else {
                            handlePropertyChange('classificationId', '');
                            handlePropertyChange('classificationName', '');
                          }
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
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* Behavior Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Behaviour</Typography>
                             <FormControlLabel
                 control={
                   <Switch
                     checked={selectedKey.behavior?.disableKey || false}
                     onChange={(e) => handlePropertyChange('behavior.disableKey', e.target.checked)}
                   />
                 }
                 label="Disable Key"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <Switch
                     checked={selectedKey.behavior?.preventDisable || false}
                     onChange={(e) => handlePropertyChange('behavior.preventDisable', e.target.checked)}
                   />
                 }
                 label="Prevent Disable"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <Switch
                     checked={selectedKey.behavior?.preventHover || false}
                     onChange={(e) => handlePropertyChange('behavior.preventHover', e.target.checked)}
                   />
                 }
                 label="Prevent Hover"
                 sx={{ mb: 1 }}
               />
               <FormControlLabel
                 control={
                   <Switch
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

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Border Colour</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 20,
                    bgcolor: selectedKey.borderColor,
                    border: '2px solid #ccc',
                    cursor: 'pointer',  
                    display: 'inline-block',
                  }}
                  onClick={() => {
                    setColorPickerType('borderColor');
                    setShowColorPicker(true);
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Normal Background Colour</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 20,
                    bgcolor: selectedKey.backgroundColor,
                    border: '2px solid #ccc',
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                  onClick={() => {
                    setColorPickerType('backgroundColor');
                    setShowColorPicker(true);
                  }}
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>Text Colour</Typography>
                <Box
                  sx={{
                    width: '100%',
                    height: 20,
                    bgcolor: selectedKey.textColor,
                    border: '2px solid #ccc',
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                  onClick={() => {
                    setColorPickerType('textColor');
                    setShowColorPicker(true);
                  }}
                />
              </Box>

              {/* Image Section */}
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 2, fontWeight: 'medium' }}>Image</Typography>
                
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
                      Remove
                    </Button>
                  )}
                </Box>

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

export default SaleKey;
