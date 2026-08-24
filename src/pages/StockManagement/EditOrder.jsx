import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Grid,
  InputAdornment,
  Autocomplete,
  Checkbox,
  Chip,
  Dialog,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Send as SendIcon,
  LocalShipping as ReceiveIcon,
  Edit as EditIcon,
  Comment as CommentIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  CalendarToday as DateIcon,
  Receipt as OrderIcon,
  Print as PrintIcon,
  Refresh as RefreshIcon,
  KeyboardArrowUp as ArrowUpIcon,
  KeyboardArrowDown as ArrowDownIcon,
  DeleteOutline as DeleteOutlineIcon,
  BalanceOutlined as BalanceOutlinedIcon,
  ImageOutlined as ImageOutlinedIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useNavigate, useParams } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import supplierService from '../../services/supplierService';
import customerService from '../../services/customerService';
import productService from '../../services/productService';
import classificationService from '../../services/classificationService';
import buyingPeriodService from '../../services/buyingPeriodService';
import { outletService } from '../../services/outletService';
import transfereeService from '../../services/transfereeService';
import { stripHtml } from '../../services/posLocalDb';
import { useAuth } from '../../contexts/AuthContext';
import ProductDetailView from '../../components/OrdersInvoices/ProductDetailView';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// Shopfront reference button: #5ebbeb, square, h53, fs16 fw400, hover inverts colors over 0.2s
const sfBtn = {
  backgroundColor: '#5ebbeb',
  color: '#f8f8f8',
  height: 53,
  borderRadius: 0,
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  px: 3,
  whiteSpace: 'nowrap',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { backgroundColor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
};

// Shopfront reference input: square, h53
const sfField = {
  backgroundColor: '#fff',
  '& .MuiOutlinedInput-root': { borderRadius: 0, height: 53 },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const sfCaption = {
  fontSize: 11,
  color: '#676b72',
  textTransform: 'uppercase',
  textAlign: 'center',
  display: 'block',
  mt: 0.5,
};

// Parity-system primary button (Save row): #5ebbeb, radius 12, h42, fw700 fs16
const parityBtn = {
  backgroundColor: '#5ebbeb',
  color: '#fff',
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  px: 3,
  whiteSpace: 'nowrap',
  '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { backgroundColor: '#e0e0e0', color: '#9e9e9e' },
};

// Gray boxed button (dialog Cancel / OK)
const grayBtn = {
  backgroundColor: '#e5e5e5',
  color: '#313439',
  borderRadius: 0,
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 400,
  boxShadow: 'none',
  px: 3,
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { backgroundColor: '#d4d4d4', boxShadow: 'none' },
};

const highlightMatch = (text, query) => {
  const str = String(text || '');
  const q = String(query || '').trim();
  if (!q) return str;
  const idx = str.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return str;
  return (
    <>
      {str.slice(0, idx)}
      <span style={{ color: '#5ebbeb' }}>{str.slice(idx, idx + q.length)}</span>
      {str.slice(idx + q.length)}
    </>
  );
};

const EditOrder = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, getOutletName } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suppliers, setSuppliers] = useState([]);
  const [, setCustomers] = useState([]); // loaded for parity with initial data flow; From/To now read-only text
  const [outlets, setOutlets] = useState([]);
  const [transferees, setTransferees] = useState([]);
  const [order, setOrder] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedProducts, setSelectedProducts] = useState([]); // Array of product objects with order quantities
  const [groupedProducts, setGroupedProducts] = useState({}); // Grouped by supplier/classification
  const [optionsOpen, setOptionsOpen] = useState(false); // inline Options panel (Shopfront reference)
  const [editDetailsDialogOpen, setEditDetailsDialogOpen] = useState(false);
  const [commentsDialogOpen, setCommentsDialogOpen] = useState(false);
  const [productQuantities, setProductQuantities] = useState({}); // { productId: { cases: 0, items: 0, supplierCode: '' } }
  const [orderedQuantities, setOrderedQuantities] = useState({}); // snapshot of ordered quantities (Details View)
  const [supplierCodes, setSupplierCodes] = useState({}); // { productId: supplierId }
  const [searchLoading, setSearchLoading] = useState(false);
  const [allSuppliersToggle, setAllSuppliersToggle] = useState(false); // Toggle for "All Suppliers" - default OFF (reference)
  const [checkedRows, setCheckedRows] = useState({}); // { productId: bool } - row selection for bulk actions
  const [detailsView, setDetailsView] = useState(false); // footer "Details View" toggle
  // Options panel state — initialized from the loaded order (supplier defaults
  // as fallback) and persisted with every order save
  const [paymentFeePct, setPaymentFeePct] = useState('');
  const [usePctFees, setUsePctFees] = useState(false);
  const [costsIncTax, setCostsIncTax] = useState(false);
  const [freightIncluded, setFreightIncluded] = useState(false);
  const [invoiceFees, setInvoiceFees] = useState('');
  const [invoiceFreight, setInvoiceFreight] = useState(''); // blank = supplier per-case freight
  const [invoiceDiscount, setInvoiceDiscount] = useState('');
  const [selectedProductForDetail, setSelectedProductForDetail] = useState(null);
  const [productDetailsMap, setProductDetailsMap] = useState({}); // { productId: { productData, salesData, purchaseData, lastCost, lastSentDate, lastReceivedDate } }
  const [editFormData, setEditFormData] = useState({
    from: 'all',
    to: '',
    orderDate: null,
    orderNumber: '',
    dueDate: null,
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
    expectedTotal: '',
  });

  useEffect(() => {
    loadInitialData();
  }, [id]);

  // Populate edit form data when dialog opens
  useEffect(() => {
    if (editDetailsDialogOpen && order) {
      setEditFormData({
        from: order.from || 'all',
        to: order.to || (order.customer?.id ? String(order.customer.id) : ''),
        orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
        orderNumber: order.orderNumber || '',
        dueDate: order.dueDate ? new Date(order.dueDate) : null,
        internalReference: order.internalReference || '',
        publicNotes: order.publicNotes || '',
        internalNotes: order.internalNotes || '',
        expectedTotal: order.expectedTotal != null ? String(order.expectedTotal) : '',
      });
    }
  }, [editDetailsDialogOpen, order]);

  useEffect(() => {
    if (order && order.items) {
      const loadOrderProducts = async () => {
        const initialProducts = [];
        const initialQuantities = {};
        const initialOrdered = {};
        
        // Load actual product data for each item
        for (let index = 0; index < order.items.length; index++) {
          const item = order.items[index];
          if (item.product) {
            let product = null;
            let productId = `item-${index}`;
            
            // Prefer the persisted product link; fall back to a name search for legacy rows
            try {
              if (item.productId) {
                const fullProductResponse = await productService.getProduct(item.productId);
                if (fullProductResponse && fullProductResponse.product) {
                  product = fullProductResponse.product;
                  productId = product.id;
                }
              }
              if (!product) {
                const searchResponse = await productService.getProducts({ search: item.product, limit: 1 });
                if (searchResponse.products && searchResponse.products.length > 0) {
                  const foundProduct = searchResponse.products[0];
                  const fullProductResponse = await productService.getProduct(foundProduct.id);
                  if (fullProductResponse && fullProductResponse.product) {
                    product = fullProductResponse.product;
                    productId = product.id;
                  }
                }
              }
            } catch (err) {
              console.error(`Error loading product ${item.product}:`, err);
            }
            
            // If product not found, create placeholder
            // For placeholder, we need to derive caseCost and itemCost from the saved data
            if (!product) {
              const savedCases = item.cases !== undefined ? item.cases : Math.floor(item.quantity || 0);
              const savedItems = item.items !== undefined ? item.items : ((item.quantity || 0) % 1);
              const savedTotal = item.total || 0;
              const unitPrice = item.unitPrice || 0;
              
              // For placeholder products, we need to calculate caseCost and itemCost
              // If we have both cases and items, we can try to derive the costs
              // Otherwise, use unitPrice for both
              let caseCost = unitPrice;
              let itemCost = unitPrice;
              let caseQuantity = 1;
              
              // If we have saved total, cases, and items, try to derive costs
              // The saved total should equal: cases * caseCost + items * itemCost
              // If caseQuantity is known, itemCost = caseCost / caseQuantity
              // For now, we'll use unitPrice for both, but the calculation will use the correct formula
              if (savedTotal > 0) {
                // Try to derive: if we have cases and items, calculate proportionally
                if (savedCases > 0 && savedItems > 0) {
                  // Assume caseQuantity of 1 for now (will be updated when real product loads)
                  // caseCost = unitPrice (per case)
                  // itemCost = unitPrice (per item)
                  caseCost = unitPrice;
                  itemCost = unitPrice;
                } else if (savedCases > 0) {
                  // Only cases: caseCost = total / cases
                  caseCost = savedTotal / savedCases;
                  itemCost = caseCost; // Assume caseQuantity = 1
                } else if (savedItems > 0) {
                  // Only items: itemCost = total / items
                  itemCost = savedTotal / savedItems;
                  caseCost = itemCost; // Assume caseQuantity = 1
                }
              }
              
              product = {
                id: productId,
                name: item.product,
                caseQuantity: caseQuantity,
                caseCost: caseCost,
                itemCost: itemCost,
                currentStockCases: 0,
                currentStockItems: 0,
                _savedTotal: savedTotal, // Store saved total for reference
                _savedCases: savedCases,
                _savedItems: savedItems,
              };
            }
            
            initialProducts.push(product);
            
            let cases = 0;
            let items = 0;
            
            if (item.cases !== undefined && item.cases !== null && item.items !== undefined && item.items !== null) {
              cases = item.cases;
              items = item.items;
              if (cases === 0 && items === 0 && item.quantity !== undefined && item.quantity !== null && item.quantity > 0) {
                const quantity = item.quantity;
                const caseQuantity = product.caseQuantity || 1;
                cases = Math.floor(quantity / caseQuantity);
                items = quantity % caseQuantity;
              }
            } else if (item.quantity !== undefined && item.quantity !== null) {
              // Calculate from quantity using product's caseQuantity
              const quantity = item.quantity;
              const caseQuantity = product.caseQuantity || 1;
              cases = Math.floor(quantity / caseQuantity);
              items = quantity % caseQuantity;
            }
            
            // Store saved values for reference
            if (product.id.toString().startsWith('item-')) {
              product._savedTotal = item.total || 0;
              product._savedCases = cases;
              product._savedItems = items;
            }
            
            initialOrdered[product.id] = {
              cases: cases,
              items: items,
              supplierCode: item.supplierCode || '',
            };
            // On a receivable (SENT) order the boxes mean "arriving in THIS
            // delivery": prefill the OUTSTANDING quantity, not the full ordered
            // amount. Prefilling ordered on a partially-received order fed a
            // received-to-date figure back in and silently deleted stock.
            if (order.status === 'SENT') {
              initialQuantities[product.id] = {
                cases: Math.max(0, cases - (Number(item.receivedCases) || 0)),
                items: Math.max(0, items - (Number(item.receivedItems) || 0)),
                supplierCode: item.supplierCode || '',
              };
            } else {
              initialQuantities[product.id] = { ...initialOrdered[product.id] };
            }
          }
        }

        setSelectedProducts(initialProducts);
        setProductQuantities(initialQuantities);
        setOrderedQuantities(initialOrdered);
        updateGroupedProducts(initialProducts);
      };
      
      loadOrderProducts();
    }
  }, [order]);

  // Load heavy product performance details ONLY when user opens the detail view.
  useEffect(() => {
    const pid = selectedProductForDetail?.id;
    if (!pid) return;
    if (pid.toString().startsWith('item-')) return;
    if (productDetailsMap[pid]) return;
    loadProductDetailsForMap(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductForDetail?.id]);

  // Deduplicate in-flight requests so the same product isn't fetched twice.
  const productDetailsInFlightRef = useRef(new Map());
  // Cache orders/invoices fetch (this endpoint can't filter by product items).
  const ordersInvoicesCachePromiseRef = useRef(null);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      
      // Load order data
      const orderResponse = await orderInvoiceService.getOrderInvoice(id);
      const orderData = orderResponse.orderInvoice;
      setOrder(orderData);

      // Options panel: order values win, supplier defaults fill the gaps
      const sup = orderData?.supplier;
      const feePct = orderData?.paymentFeePercentage ?? sup?.paymentFeePercentage;
      setPaymentFeePct(feePct != null ? String(feePct) : '');
      setUsePctFees(Boolean(orderData?.usePercentageFees));
      setCostsIncTax(Boolean(orderData?.costsIncludeTax));
      setFreightIncluded(Boolean(orderData?.freightIncluded || sup?.freightIncludedOnInvoices));
      setInvoiceFees(orderData?.invoiceFees ? String(orderData.invoiceFees) : '');
      setInvoiceFreight(orderData?.invoiceFreight != null ? String(orderData.invoiceFreight) : '');
      setInvoiceDiscount(orderData?.invoiceDiscount ? String(orderData.invoiceDiscount) : '');


      // Load suppliers
      const suppliersResponse = await supplierService.getSuppliers();
      setSuppliers(suppliersResponse.suppliers || []);
      
      // Load customers
      const customersResponse = await customerService.getCustomers();
      const activeCustomers = (customersResponse.customers || []).filter(customer => customer.isActive);
      setCustomers(activeCustomers);

      // Load outlets (needed for TRANSFER type display)
      try {
        const outletsResp = await outletService.getAllOutlets();
        setOutlets(outletsResp.outlets || []);
      } catch (outletErr) {
        console.error('Error loading outlets:', outletErr);
      }

      // Load transferees (needed for TRANSFER destination display)
      try {
        const transfereesResp = await transfereeService.getTransferees({ activeOnly: true });
        setTransferees(transfereesResp.transferees || []);
      } catch (transfereeErr) {
        console.error('Error loading transferees:', transfereeErr);
      }
      
    } catch (err) {
      setError('Failed to load order data');
      console.error('Error loading order data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadProductDetailsForMap = async (productId) => {
    // Skip temporary IDs (like "item-0", "item-1", etc.) that don't exist in the database
    if (!productId || productDetailsMap[productId] || productId.toString().startsWith('item-')) {
      return;
    }

    // If a request is already running, don't start another one.
    if (productDetailsInFlightRef.current.has(productId)) {
      return productDetailsInFlightRef.current.get(productId);
    }
    
    // Only process numeric IDs
    const numericId = typeof productId === 'string' ? parseInt(productId, 10) : productId;
    if (isNaN(numericId)) {
      return;
    }
    
    const requestPromise = (async () => {
      // Cache the "all orders/invoices" fetch so it runs once per component (not once per product).
      if (!ordersInvoicesCachePromiseRef.current) {
        ordersInvoicesCachePromiseRef.current = orderInvoiceService
          .getOrdersInvoices({})
          .catch(() => ({ ordersInvoices: [] }));
      }

      const [productResponse, salesResponse, purchaseResponse, ordersResponse] = await Promise.all([
        productService.getProduct(numericId).catch(() => ({ product: null })),
        productService.getProductSalesSummary(numericId, 'weekly').catch(() => ({})),
        productService.getProductPurchaseHistory(numericId, {}).catch(() => ({ purchases: [] })),
        ordersInvoicesCachePromiseRef.current,
      ]);

      const product = productResponse.product;
      if (!product) return;

      // Process sales data
      const salesSummary = salesResponse?.summary?.last7Weeks || salesResponse?.data?.summary?.last7Weeks || salesResponse?.last7Weeks || [];
      const salesArray = new Array(7).fill(0);
      if (Array.isArray(salesSummary)) {
        salesSummary.forEach((item, index) => {
          if (index < 7) {
            salesArray[index] = parseFloat(item.sales || item.quantity || 0);
          }
        });
      }

      // Process purchase data
      const purchases = purchaseResponse?.purchases || purchaseResponse?.data?.purchases || [];
      const purchaseArray = new Array(7).fill(0);
      const now = new Date();
      if (Array.isArray(purchases)) {
        purchases.forEach((purchase) => {
          const dateStr = purchase.date || purchase.purchaseDate || purchase.createdAt;
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const weekAgo = Math.floor((now - date) / (7 * 24 * 60 * 60 * 1000));
              if (weekAgo >= 0 && weekAgo < 7) {
                const quantity = parseFloat(purchase.quantity || 0);
                purchaseArray[6 - weekAgo] = (purchaseArray[6 - weekAgo] || 0) + quantity;
              }
            }
          }
        });
      }

      // Find last cost, sent date, received date
      const orders = ordersResponse.ordersInvoices || [];
      const productOrders = orders.filter(order => {
        return order.items?.some(item => 
          item.product === product.name || item.productId === productId
        );
      });

      let lastCostValue = null;
      let lastSentValue = null;
      let lastReceivedValue = null;

      productOrders.forEach(order => {
        const orderItem = order.items?.find(item => 
          item.product === product.name || item.productId === productId
        );
        
        if (orderItem) {
          if (orderItem.unitPrice && !lastCostValue) {
            lastCostValue = orderItem.unitPrice;
          }
          
          if (order.status === 'SENT' && order.updatedAt && !lastSentValue) {
            lastSentValue = order.updatedAt;
          }
          
          if (order.status === 'RECEIVED' && order.receivedAt && !lastReceivedValue) {
            lastReceivedValue = order.receivedAt;
          }
        }
      });

      // Store in map
      setProductDetailsMap(prev => ({
        ...prev,
        [productId]: {
          productData: product,
          salesData: salesArray,
          purchaseData: purchaseArray,
          lastCost: lastCostValue,
          lastSentDate: lastSentValue,
          lastReceivedDate: lastReceivedValue,
        }
      }));
    })();

    productDetailsInFlightRef.current.set(productId, requestPromise);
    try {
      await requestPromise;
    } catch (err) {
      console.error(`Error loading details for product ${productId}:`, err);
    } finally {
      productDetailsInFlightRef.current.delete(productId);
    }
  };

  const handleSearch = async (searchValue) => {
    if (!searchValue || searchValue.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const searchLower = searchValue.toLowerCase().trim();

      const isTransfer = order?.type === 'TRANSFER';
      const fromOutletId =
        isTransfer && order?.from && order.from !== 'all'
          ? parseInt(order.from, 10)
          : null;
      const transferFromOutletOk = isTransfer && fromOutletId && !isNaN(fromOutletId);

      // Transfers: only products stocked at the "From" outlet (strict outlet filter on API)
      let productFilters = {
        search: searchValue,
        limit: 10,
        status: 'Active',
      };
      if (transferFromOutletOk) {
        productFilters = {
          ...productFilters,
          outletId: fromOutletId,
          outletOnly: true,
        };
      } else if (!isTransfer) {
        const supplierFilter =
          !allSuppliersToggle && order?.from && order.from !== 'all'
            ? parseInt(order.from, 10)
            : null;
        if (supplierFilter) {
          productFilters = { ...productFilters, supplier: supplierFilter };
        }
      }

      const [productsResponse, suppliersResponse, classificationsResponse] = await Promise.all([
        transferFromOutletOk || !isTransfer
          ? productService.getProducts(productFilters).catch(() => ({ products: [] }))
          : Promise.resolve({ products: [] }),
        !isTransfer
          ? supplierService.getSuppliers().catch(() => ({ suppliers: [] }))
          : Promise.resolve({ suppliers: [] }),
        !isTransfer
          ? classificationService
              .getClassifications({ search: searchValue })
              .catch(() => ({ classifications: [] }))
          : Promise.resolve({ classifications: [] }),
      ]);

      const products = (productsResponse.products || []).map(p => ({
        ...p,
        type: 'product',
      }));

      const matchingSuppliers =
        !isTransfer && allSuppliersToggle
          ? (suppliersResponse.suppliers || [])
              .filter((s) => s.name.toLowerCase().includes(searchLower))
              .map((s) => ({ ...s, type: 'supplier' }))
          : [];

      const matchingClassifications = !isTransfer
        ? (classificationsResponse.classifications || []).map((c) => ({
            ...c,
            type: 'classification',
          }))
        : [];

      // Combine all results
      const allResults = [...products, ...matchingSuppliers, ...matchingClassifications];
      setSearchResults(allResults);
    } catch (err) {
      console.error('Error searching:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSearchSelect = async (result) => {
    if (order?.type === 'TRANSFER' && result.type !== 'product') {
      return;
    }
    if (result.type === 'product') {
      const product = await productService.getProduct(result.id);
      if (product && product.product) {
        addProductToOrder(product.product);
      }
    } else if (result.type === 'supplier') {
        // Add all products from supplier
      await addSupplierProducts(result);
    } else if (result.type === 'classification') {
      await addClassificationProducts(result);
    }
    
    setSearchTerm('');
    setSearchResults([]);
  };

  // RETURN linked to a received invoice: prefill the line's unit cost from the
  // linked invoice's purchase record per the chosen basis (base vs landed).
  const applyReturnCost = (product) => {
    const costs = order?.type === 'RETURN' && order?.linkedInvoiceId ? order?.linkedInvoice?.itemCosts : null;
    if (!costs) return product;
    const entry = costs.find(c => c.productId === product.id) || costs.find(c => c.product === product.name);
    if (!entry) return product;
    const unit = order.returnCostBasis === 'BASE_FEES_FREIGHT' ? entry.landedUnitCost : entry.baseUnitCost;
    if (!Number.isFinite(unit)) return product;
    const cq = product.caseQuantity || 1;
    return { ...product, itemCost: unit, caseCost: unit * cq, _baseItemCost: unit, _baseCaseCost: unit * cq };
  };

  const addProductToOrder = (product) => {
    if (!product || !product.id) return;

    if (selectedProducts.find(p => p.id === product.id)) {
      return;
    }

    const newProduct = applyReturnCost({
      ...product,
      supplier: product.suppliers?.[0]?.supplier || null,
      _baseCaseCost: product.caseCost,
      _baseItemCost: product.itemCost,
    });

    const updatedProducts = [...selectedProducts, newProduct];
    setSelectedProducts(updatedProducts);

    setProductQuantities(prev => ({
      ...prev,
      [product.id]: {
        cases: 0,
        items: 0,
        supplierCode: '',
      }
    }));

    updateGroupedProducts(updatedProducts);
    
    // Product details are loaded lazily when user opens the detail panel.
  };

  const addSupplierProducts = async (supplier) => {
    if (order?.type === 'TRANSFER') {
      setError('Use product search only for transfers (From outlet products).');
      return;
    }
    try {
      const response = await supplierService.getSupplierProducts(supplier.id);
      const products = response.assignedProducts || [];
      
      if (products.length === 0) {
        setError('No products found for this supplier');
        return;
      }

      const existingProductIds = new Set(selectedProducts.map(p => p.id));
      const newProducts = products.filter(p => !existingProductIds.has(p.id));
      
      if (newProducts.length === 0) {
        setError('All products from this supplier are already in the order');
        return;
      }

      const productsToAdd = [];
      for (const product of newProducts) {
        try {
          const fullProduct = await productService.getProduct(product.id);
          if (fullProduct && fullProduct.product) {
          productsToAdd.push(applyReturnCost({
            ...fullProduct.product,
            supplier: supplier,
            _baseCaseCost: fullProduct.product.caseCost,
            _baseItemCost: fullProduct.product.itemCost,
          }));
          // Product details are loaded lazily when user opens the detail panel.
          }
        } catch (err) {
          console.error(`Error loading product ${product.id}:`, err);
        }
      }

      if (productsToAdd.length === 0) {
        setError('No products could be loaded from this supplier');
        return;
      }

      const updatedProducts = [...selectedProducts, ...productsToAdd];
      setSelectedProducts(updatedProducts);

      const newQuantities = {};
      productsToAdd.forEach(product => {
        newQuantities[product.id] = {
          cases: 0,
          items: 0,
          supplierCode: supplier.name,
        };
        setSupplierCodes(prev => ({
          ...prev,
          [product.id]: supplier.id,
        }));
      });
      setProductQuantities(prev => ({ ...prev, ...newQuantities }));
      updateGroupedProducts(updatedProducts);
      setSuccess(`Added ${productsToAdd.length} product(s) from ${supplier.name}`);
    } catch (err) {
      console.error('Error loading supplier products:', err);
      setError('Failed to load products from supplier');
    }
  };

  const addClassificationProducts = async (classification) => {
    if (order?.type === 'TRANSFER') {
      setError('Use product search only for transfers (From outlet products).');
      return;
    }
    try {
      const response = await classificationService.getClassificationProducts(classification.id);
      const products = response.assignedProducts || [];
      
      const existingProductIds = new Set(selectedProducts.map(p => p.id));
      const newProducts = products.filter(p => {
        const productId = p.id || p.product?.id;
        return productId && !existingProductIds.has(productId);
      });
      
      if (newProducts.length === 0) {
        setError('All products from this classification are already in the order');
        return;
      }

      const productsToAdd = [];
      for (const productData of newProducts) {
        const productId = productData.id || productData.product?.id;
        if (productId) {
          try {
            const fullProduct = await productService.getProduct(productId);
            if (fullProduct && fullProduct.product) {
              productsToAdd.push(applyReturnCost({
                ...fullProduct.product,
                classification: classification,
                _baseCaseCost: fullProduct.product.caseCost,
                _baseItemCost: fullProduct.product.itemCost,
              }));
            }
          } catch (err) {
            console.error(`Error loading product ${productId}:`, err);
          }
        }
      }

      if (productsToAdd.length === 0) {
        setError('No products could be loaded from this classification');
        return;
      }

      const updatedProducts = [...selectedProducts, ...productsToAdd];
      setSelectedProducts(updatedProducts);

      // Initialize quantities for new products
      const newQuantities = {};
      productsToAdd.forEach(product => {
        newQuantities[product.id] = {
          cases: 0,
          items: 0,
          supplierCode: '',
        };
      });
      setProductQuantities(prev => ({ ...prev, ...newQuantities }));
      updateGroupedProducts(updatedProducts);
      setSuccess(`Added ${productsToAdd.length} product(s) from ${classification.name}`);
    } catch (err) {
      console.error('Error loading classification products:', err);
      setError('Failed to load products from classification');
    }
  };

  const updateGroupedProducts = (products) => {
    const grouped = {};
    
    products.forEach(product => {
      const supplier = product.supplier || product.suppliers?.[0]?.supplier;
      const classification = product.classification;
      const groupKey = supplier?.name || classification?.name || 'Other';
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          name: groupKey,
          type: supplier ? 'supplier' : classification ? 'classification' : 'other',
          products: [],
        };
      }
      
      grouped[groupKey].products.push(product);
    });
    
    setGroupedProducts(grouped);
  };

  const handleQuantityChange = (productId, field, value) => {
    setProductQuantities(prev => {
      const next = {
        ...prev,
        [productId]: {
          ...prev[productId],
          [field]: parseFloat(value) || 0,
        }
      };

      // Apply buying period pricing (non-blocking)
      setTimeout(() => {
        applyBuyingPeriodForLine(productId, next[productId]).catch(() => {});
      }, 0);

      return next;
    });
  };

  const applyBuyingPeriodForLine = async (productId, quantities) => {
    const product = selectedProducts.find(p => p.id === productId);
    if (!product) return;

    const supplierIdFromOrder = order?.supplier?.id;
    const supplierIdFromLine = supplierCodes[productId];
    const supplierId = supplierIdFromLine ? parseInt(supplierIdFromLine, 10) : supplierIdFromOrder;
    if (!supplierId || isNaN(parseInt(supplierId, 10))) return;

    const caseQty = product.caseQuantity || 1;
    const totalItems = (quantities?.cases || 0) * caseQty + (quantities?.items || 0);
    const orderDateIso = order?.orderDate ? new Date(order.orderDate).toISOString() : new Date().toISOString();

    // Reset to base when quantity is 0
    if (!totalItems || totalItems <= 0) {
      setSelectedProducts(prev => prev.map(p => {
        if (p.id !== productId) return p;
        return {
          ...p,
          caseCost: p._baseCaseCost ?? p.caseCost,
          itemCost: p._baseItemCost ?? p.itemCost,
          buyingPeriodApplied: false,
          buyingPeriodId: null,
        };
      }));
      return;
    }

    const res = await buyingPeriodService.matchActive({
      supplierId,
      productId,
      quantity: totalItems,
      date: orderDateIso,
    });

    const match = res?.match;
    if (!match?.period) {
      setSelectedProducts(prev => prev.map(p => {
        if (p.id !== productId) return p;
        return {
          ...p,
          caseCost: p._baseCaseCost ?? p.caseCost,
          itemCost: p._baseItemCost ?? p.itemCost,
          buyingPeriodApplied: false,
          buyingPeriodId: null,
        };
      }));
      return;
    }

    setSelectedProducts(prev => prev.map(p => {
      if (p.id !== productId) return p;
      return {
        ...p,
        itemCost: match.unitCost,
        caseCost: match.caseCost,
        buyingPeriodApplied: true,
        buyingPeriodId: match.period.id,
      };
    }));
  };

  const handleSupplierCodeChange = (productId, supplierId) => {
    setSupplierCodes(prev => ({
      ...prev,
      [productId]: supplierId,
    }));
    
    // Update the supplier code in quantities
    const supplier = suppliers.find(s => s.id === parseInt(supplierId));
    setProductQuantities(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        supplierCode: supplier?.name || '',
      }
    }));
  };

  const handleSupplierTextChange = (productId, value) => {
    setProductQuantities(prev => ({
      ...prev,
      [productId]: { ...prev[productId], supplierCode: value },
    }));
  };

  // Update a product's costs (case cost + derived item cost) and rebuild groups
  const setProductCaseCost = (productId, caseCost) => {
    const updated = selectedProducts.map(p => {
      if (p.id !== productId) return p;
      const cq = p.caseQuantity || 1;
      return { ...p, caseCost, itemCost: cq > 0 ? caseCost / cq : caseCost };
    });
    setSelectedProducts(updated);
    updateGroupedProducts(updated);
  };

  const handleCaseCostChange = (productId, value) => {
    setProductCaseCost(productId, parseFloat(value) || 0);
  };

  const handleTotalPayableChange = (productId, value) => {
    const total = parseFloat(value) || 0;
    const p = selectedProducts.find(x => x.id === productId);
    if (!p) return;
    const q = productQuantities[productId] || { cases: 0, items: 0 };
    const cq = p.caseQuantity || 1;
    const caseUnits = (q.cases || 0) + (q.items || 0) / cq;
    if (caseUnits <= 0) return;
    setProductCaseCost(productId, total / caseUnits);
  };

  // Cost change vs the product's base case cost (percentage, signed)
  const getCostChangePct = (product) => {
    const base = parseFloat(product._baseCaseCost);
    const current = parseFloat(product.caseCost);
    if (!base || isNaN(base) || isNaN(current)) return 0;
    return ((current - base) / base) * 100;
  };

  const getCheckedIds = () =>
    Object.keys(checkedRows).filter(k => checkedRows[k]);

  const handleRemoveSelected = () => {
    const ids = new Set(getCheckedIds().map(String));
    if (ids.size === 0) return;
    const updatedProducts = selectedProducts.filter(p => !ids.has(String(p.id)));
    setSelectedProducts(updatedProducts);
    setProductQuantities(prev => {
      const updated = { ...prev };
      ids.forEach(pid => delete updated[pid]);
      return updated;
    });
    setSupplierCodes(prev => {
      const updated = { ...prev };
      ids.forEach(pid => delete updated[pid]);
      return updated;
    });
    setCheckedRows({});
    updateGroupedProducts(updatedProducts);
  };

  // Distribute the combined cost of the selected lines evenly across their cases
  const handleAverageCost = () => {
    const ids = new Set(getCheckedIds().map(String));
    if (ids.size === 0) return;
    let totalCost = 0;
    let totalCaseUnits = 0;
    selectedProducts.forEach(p => {
      if (!ids.has(String(p.id))) return;
      const q = productQuantities[p.id] || { cases: 0, items: 0 };
      const cq = p.caseQuantity || 1;
      totalCost += calculateProductTotal(p);
      totalCaseUnits += (q.cases || 0) + (q.items || 0) / cq;
    });
    if (totalCaseUnits <= 0) return;
    const avgCaseCost = totalCost / totalCaseUnits;
    const updated = selectedProducts.map(p => {
      if (!ids.has(String(p.id))) return p;
      const cq = p.caseQuantity || 1;
      return { ...p, caseCost: avgCaseCost, itemCost: cq > 0 ? avgCaseCost / cq : avgCaseCost };
    });
    setSelectedProducts(updated);
    updateGroupedProducts(updated);
  };

  const calculateProductTotal = (product, qtyMap = productQuantities) => {
    const quantities = qtyMap[product.id] || { cases: 0, items: 0 };
    
    // If this is a placeholder product with saved total and quantities haven't changed, use saved total
    if (product._savedTotal !== undefined && 
        quantities.cases === (product._savedCases || 0) && 
        quantities.items === (product._savedItems || 0) &&
        product.id.toString().startsWith('item-')) {
      return product._savedTotal;
    }
    
    const caseCost = product.caseCost || 0;
    const caseQuantity = product.caseQuantity || 1;
    const itemCost = product.itemCost || (caseQuantity > 0 ? caseCost / caseQuantity : caseCost);
    
    // Always calculate: cases * caseCost + items * itemCost
    // This ensures cases are priced at case cost, and loose items are priced at item cost
    const casesTotal = (quantities.cases || 0) * caseCost;
    const itemsTotal = (quantities.items || 0) * itemCost;
    
    return casesTotal + itemsTotal;
  };

  const calculateGrandTotal = (qtyMap = productQuantities) => {
    return selectedProducts.reduce((sum, product) => {
      return sum + calculateProductTotal(product, qtyMap);
    }, 0);
  };

  const formatOrderItems = (qtyMap = productQuantities) => {
    return selectedProducts.map(product => {
      const quantities = qtyMap[product.id] || { cases: 0, items: 0 };
      const totalItems = quantities.cases * (product.caseQuantity || 1) + quantities.items;
      const caseCost = product.caseCost || 0;
      const itemCost = product.itemCost || (product.caseQuantity ? caseCost / product.caseQuantity : 0);
      const unitPrice = itemCost;
      
      return {
        product: product.name,
        // Real products have numeric ids; 'item-N' placeholders stay unlinked
        productId: typeof product.id === 'number' ? product.id : null,
        supplierCode: quantities.supplierCode || '',
        description: stripHtml(product.description),
        quantity: totalItems,
        cases: quantities.cases || 0,
        items: quantities.items || 0,
        unitPrice: unitPrice,
        total: calculateProductTotal(product, qtyMap),
      };
    });
  };

  // Options panel fields, included in every order save so receive() can use them
  const buildOptionsPayload = () => ({
    paymentFeePercentage: paymentFeePct === '' ? null : parseFloat(paymentFeePct),
    usePercentageFees: usePctFees,
    costsIncludeTax: costsIncTax,
    freightIncluded: freightIncluded,
    invoiceFees: invoiceFees === '' ? 0 : parseFloat(invoiceFees) || 0,
    invoiceFreight: invoiceFreight === '' ? null : parseFloat(invoiceFreight),
    invoiceDiscount: invoiceDiscount === '' ? 0 : parseFloat(invoiceDiscount) || 0,
  });

  const handleSaveEditDetails = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const items = formatOrderItems();
      const totalAmount = calculateGrandTotal();

      const orderData = {
        from: editFormData.from,
        to: editFormData.to,
        orderDate: editFormData.orderDate,
        orderNumber: editFormData.orderNumber,
        dueDate: editFormData.dueDate,
        internalReference: editFormData.internalReference,
        publicNotes: editFormData.publicNotes,
        internalNotes: editFormData.internalNotes,
        generateStockFrom: order?.generateStockFrom || 'none',
        items: items,
        totalAmount: totalAmount,
        expectedTotal: editFormData.expectedTotal === '' ? null : parseFloat(editFormData.expectedTotal),
        type: order?.type || 'ORDER',
        status: order?.status || 'PENDING',
        ...buildOptionsPayload(),
      };

      await orderInvoiceService.updateOrderInvoice(id, orderData);

      // Update local order state
      const updatedOrder = await orderInvoiceService.getOrderInvoice(id);
      setOrder(updatedOrder.orderInvoice);

      setSuccess('Order details updated successfully!');
      setEditDetailsDialogOpen(false);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save order details');
      console.error('Error saving order details:', err);
    } finally {
      setSaving(false);
    }
  };

  const getOutletNameById = (idStr) => {
    const outletId = parseInt(idStr);
    const found = outlets.find(o => o.id === outletId);
    return found ? found.name : (idStr || 'N/A');
  };

  // The outlet side of a non-TRANSFER document is the order's own outlet
  // (OrderInvoice.outletId), not the outlet of whoever is viewing it.
  const getDocumentOutletName = () => {
    const found = outlets.find((o) => o.id === order?.outletId);
    return found?.name || order?.outlet?.name || getOutletName() || 'N/A';
  };

  const getTransferTargetName = (toValue) => {
    const normalized = String(toValue || '');
    if (normalized.startsWith('transferee:')) {
      const transfereeId = parseInt(normalized.split(':')[1], 10);
      const found = transferees.find((t) => t.id === transfereeId);
      return found?.name || normalized;
    }
    if (normalized.startsWith('vendor:')) {
      const vendorId = parseInt(normalized.split(':')[1], 10);
      const found = suppliers.find((s) => s.id === vendorId);
      return found?.name || normalized;
    }
    return getOutletNameById(normalized);
  };

  const handleSave = async (send = false) => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // On a SENT order the quantity boxes hold "To Receive" values - plain Save
      // must never rewrite the ORDERED quantities with them (10 cases ordered
      // used to become 4 after a partial receipt was typed and saved).
      const orderedMap = order?.status === 'SENT'
        ? Object.fromEntries(
            selectedProducts.map((p) => {
              const current = productQuantities[p.id] || { cases: 0, items: 0, supplierCode: '' };
              const ordered = orderedQuantities[p.id];
              return [p.id, ordered ? { ...ordered, supplierCode: current.supplierCode || '' } : current];
            })
          )
        : undefined;
      const items = formatOrderItems(orderedMap);
      const totalAmount = calculateGrandTotal(orderedMap);

      const isTransfer = order?.type === 'TRANSFER';

      const orderData = {
        from: order?.from || 'all',
        to: order?.to || '',
        orderDate: order?.orderDate ? new Date(order.orderDate) : new Date(),
        orderNumber: order?.orderNumber || '',
        dueDate: order?.dueDate ? new Date(order.dueDate) : null,
        internalReference: order?.internalReference || '',
        publicNotes: order?.publicNotes || '',
        internalNotes: order?.internalNotes || '',
        generateStockFrom: order?.generateStockFrom || 'none',
        items: items,
        totalAmount: totalAmount,
        type: order?.type || 'ORDER',
        status: send && !isTransfer ? 'SENT' : order?.status || 'PENDING',
        ...buildOptionsPayload(),
      };

      await orderInvoiceService.updateOrderInvoice(id, orderData);

      // For transfers, "Save & Send" triggers actual inventory movement
      if (send && isTransfer) {
        try {
          await orderInvoiceService.sendTransfer(id);
          setSuccess('Transfer sent! Stock has been moved between outlets.');
        } catch (transferErr) {
          setError(transferErr.response?.data?.error || 'Saved, but failed to send transfer');
          setSaving(false);
          return;
        }
      } else {
        setSuccess(send ? 'Order saved and sent successfully!' : 'Order saved successfully!');
      }
      
      setTimeout(() => {
        navigate(`/orders-invoices/${id}`);
      }, 1500);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save order');
      console.error('Error saving order:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndReceive = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // PUT keeps the ORDERED quantities (snapshot taken at load); the "To Receive"
      // inputs (productQuantities) go to the receive endpoint as receivedQuantities.
      // Supplier-code edits still flow through; lines added on this screen (no
      // ordered snapshot) fall back to their To Receive values.
      const orderedMap = Object.fromEntries(
        selectedProducts.map((p) => {
          const current = productQuantities[p.id] || { cases: 0, items: 0, supplierCode: '' };
          const ordered = orderedQuantities[p.id];
          return [p.id, ordered ? { ...ordered, supplierCode: current.supplierCode || '' } : current];
        })
      );
      const items = formatOrderItems(orderedMap);
      const totalAmount = calculateGrandTotal(orderedMap);

      // First, save the order
      const orderData = {
        from: order?.from || 'all',
        to: order?.to || '',
        orderDate: order?.orderDate ? new Date(order.orderDate) : new Date(),
        orderNumber: order?.orderNumber || '',
        dueDate: order?.dueDate ? new Date(order.dueDate) : null,
        internalReference: order?.internalReference || '',
        publicNotes: order?.publicNotes || '',
        internalNotes: order?.internalNotes || '',
        generateStockFrom: order?.generateStockFrom || 'none',
        items: items,
        totalAmount: totalAmount,
        type: order?.type || 'ORDER',
        status: order?.status || 'PENDING',
        ...buildOptionsPayload(),
      };

      const putResponse = await orderInvoiceService.updateOrderInvoice(id, orderData);

      // Then mark as received (this will add stock to inventory).
      // PUT recreates the lines, so map the fresh item ids by position — the
      // saved items were created from selectedProducts in the same order.
      const savedItems = putResponse?.orderInvoice?.items || [];
      const receivedQuantities = savedItems.map((savedItem, index) => {
        const product = selectedProducts[index];
        const toReceive = (product && productQuantities[product.id]) || { cases: 0, items: 0 };
        return {
          itemId: savedItem.id,
          // Delta form: the box holds what is arriving in THIS delivery. The
          // backend adds it to received-to-date - posting it as the cumulative
          // figure is what used to turn a second delivery into a stock-out.
          receiveNowCases: parseInt(toReceive.cases, 10) || 0,
          receiveNowItems: parseInt(toReceive.items, 10) || 0,
        };
      });
      try {
        await orderInvoiceService.markAsReceived(id, receivedQuantities);
        setSuccess('Order saved and stock received successfully!');
      } catch (receiveErr) {
        setSuccess('Order saved, but failed to receive stock. Please try receiving manually.');
        console.error('Error marking as received:', receiveErr);
      }
      
      // Redirect to order details after a short delay
      setTimeout(() => {
        navigate(`/orders-invoices/${id}`);
      }, 1500);
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save order');
      console.error('Error saving order:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Reference renders dates as dd/mm/yyyy
  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    // Reference format has no comma: '06/07/2026 19:57:23'
    return new Date(dateString).toLocaleString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(',', '');
  };

  const handlePrint = () => {
    if (!order) return;

    // Get outlet name for display
    const outletName = getDocumentOutletName();

    // Calculate totals for print using current productQuantities
    const totalOrderedCases = selectedProducts.reduce((sum, product) => {
      const quantities = productQuantities[product.id] || { cases: 0, items: 0 };
      return sum + (quantities.cases || 0);
    }, 0);

    const totalOrderedItems = selectedProducts.reduce((sum, product) => {
      const quantities = productQuantities[product.id] || { cases: 0, items: 0 };
      const totalItems = (quantities.cases || 0) * (product.caseQuantity || 1) + (quantities.items || 0);
      return sum + totalItems;
    }, 0);

    const totalAmount = calculateGrandTotal();

    // Format ordered quantity display
    const formatOrdered = (product) => {
      const quantities = productQuantities[product.id] || { cases: 0, items: 0 };
      const cases = quantities.cases || 0;
      const items = quantities.items || 0;
      if (cases > 0 && items > 0) {
        return `${cases}/${items}`;
      } else if (cases > 0) {
        return cases.toString();
      } else if (items > 0) {
        return items.toString();
      }
      return '0';
    };

    // Get supplier name for product
    const getProductSupplierName = (product) => {
      const supplier = product.supplier || product.suppliers?.[0]?.supplier;
      return supplier?.name || order.supplier?.name || '-';
    };

    // Get supplier code
    const getProductSupplierCode = (product) => {
      const quantities = productQuantities[product.id] || {};
      return quantities.supplierCode || '-';
    };

    // Create or get print container
    let printContainer = document.getElementById('order-print-container');
    if (printContainer) {
      printContainer.remove();
    }
    printContainer = document.createElement('div');
    printContainer.id = 'order-print-container';
    document.body.appendChild(printContainer);

    // Set print container content
    printContainer.innerHTML = `
      <div class="order-print-view">
        <div class="order-header">
          <div class="order-title">Order (#${order.orderNumber})</div>
        </div>
        
        <div class="order-info">
          <div class="info-row">
            <span class="info-label">Status:</span>
            <span class="info-value">${order.status}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Order Date:</span>
            <span class="info-value">${formatDate(order.orderDate)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">From:</span>
            <span class="info-value">${order.type === 'RETURN' ? outletName : (order.from === 'all' ? 'All Suppliers' : (order.supplier?.name || order.from))}</span>
          </div>
          <div class="info-row">
            <span class="info-label">To:</span>
            <span class="info-value">${order.type === 'RETURN' ? (order.supplier?.name || order.from) : (order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : outletName)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Includes Freight:</span>
            <span class="info-value">${order.supplier?.freightIncludedOnInvoices ? 'Yes' : 'No'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created By:</span>
            <span class="info-value">${order.creator?.name || user?.firstName || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created At:</span>
            <span class="info-value">${formatDateTime(order.createdAt)}</span>
          </div>
          ${order.publicNotes ? `
          <div class="info-row">
            <span class="info-label">Notes:</span>
            <span class="info-value">${order.publicNotes}</span>
          </div>
          ` : ''}
        </div>

        <table class="products-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Supplier</th>
              <th>Supplier Code</th>
              <th>Case Quantity</th>
              <th>Ordered</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${selectedProducts.length > 0 ? selectedProducts.map((product) => {
              const total = calculateProductTotal(product);
              return `
                <tr>
                  <td>${product.name}</td>
                  <td>${getProductSupplierName(product)}</td>
                  <td>${getProductSupplierCode(product)}</td>
                  <td>${product.caseQuantity || 1}</td>
                  <td>${formatOrdered(product)}</td>
                  <td>${formatCurrency(total)}</td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="6" style="text-align: center; color: #999;">0 lines</td>
              </tr>
            `}
            <tr class="total-row">
              <td>Total</td>
              <td>${selectedProducts.length} line${selectedProducts.length !== 1 ? 's' : ''}</td>
              <td></td>
              <td></td>
              <td>${totalOrderedCases}/${totalOrderedItems}</td>
              <td>${formatCurrency(totalAmount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div class="footer-url">${window.location.origin}/orders-invoices/${id}</div>
          <div class="footer-page">1/1</div>
        </div>
      </div>
    `;

    // Add or update print styles
    let printStyles = document.getElementById('order-print-styles');
    if (!printStyles) {
      printStyles = document.createElement('style');
      printStyles.id = 'order-print-styles';
      document.head.appendChild(printStyles);
    }
    
    printStyles.textContent = `
      #order-print-container {
        position: fixed;
        left: -9999px;
        top: 0;
        width: 210mm;
        min-height: 297mm;
        padding: 20mm;
        background: white;
        font-family: Arial, sans-serif;
        color: #333;
      }
      .order-print-view {
        max-width: 100%;
      }
      .order-header {
        text-align: center;
        margin-bottom: 20px;
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
      }
      .order-title {
        font-size: 24px;
        font-weight: bold;
      }
      .order-info {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        margin-bottom: 20px;
        font-size: 12px;
      }
      .info-row {
        display: flex;
        margin-bottom: 5px;
      }
      .info-label {
        font-weight: bold;
        margin-right: 10px;
        min-width: 120px;
      }
      .info-value {
        flex: 1;
      }
      .products-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 20px;
      }
      .products-table th {
        background-color: #f5f5f5;
        padding: 8px;
        text-align: left;
        border: 1px solid #ddd;
        font-weight: bold;
        font-size: 12px;
      }
      .products-table td {
        padding: 8px;
        border: 1px solid #ddd;
        font-size: 12px;
      }
      .products-table tr:nth-child(even) {
        background-color: #f9f9f9;
      }
      .total-row {
        background-color: #f5f5f5;
        font-weight: bold;
      }
      .footer {
        margin-top: 30px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        font-size: 10px;
        color: #666;
        text-align: center;
      }
      .footer-url {
        margin-bottom: 5px;
      }
      .footer-page {
        margin-top: 5px;
      }
      @media print {
        * {
          visibility: hidden;
        }
        #order-print-container,
        #order-print-container * {
          visibility: visible;
        }
        #order-print-container {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          padding: 20mm;
        }
        @page {
          margin: 0;
          size: A4;
        }
        body {
          margin: 0;
          padding: 0;
        }
      }
    `;

    // Trigger print after a short delay to ensure styles are applied
    setTimeout(() => {
      window.print();
      // Clean up after printing
      setTimeout(() => {
        if (printContainer && printContainer.parentNode) {
          printContainer.parentNode.removeChild(printContainer);
        }
      }, 1000);
      setOptionsOpen(false);
    }, 100);
  };

  // Options > + Add Buying Period: add all products currently in a buying period
  // for this order's supplier in one action (Shopfront documented behavior).
  const handleAddBuyingPeriodProducts = async () => {
    setOptionsOpen(false);
    if (order?.type === 'TRANSFER') return;
    try {
      const res = await buyingPeriodService.list();
      const now = new Date();
      const supplierId = order?.from && order.from !== 'all' ? parseInt(order.from, 10) : null;
      const active = (res.periods || []).filter((p) => {
        if (!p.product?.id) return false; // ponytail: family-level periods skipped, add if backend exposes family products here
        if (supplierId && p.supplier?.id !== supplierId) return false;
        const start = p.startDate ? new Date(p.startDate) : null;
        const end = p.endDate ? new Date(p.endDate) : null;
        return (!start || start <= now) && (!end || end >= now);
      });
      const existingIds = new Set(selectedProducts.map((p) => String(p.id)));
      const toAdd = active.filter((p) => !existingIds.has(String(p.product.id)));
      if (toAdd.length === 0) {
        setError(active.length === 0
          ? 'No products are currently in a buying period for this supplier'
          : 'All buying period products are already in the order');
        return;
      }
      const productsToAdd = [];
      for (const p of toAdd) {
        try {
          const full = await productService.getProduct(p.product.id);
          if (full && full.product) {
            productsToAdd.push({
              ...full.product,
              supplier: full.product.suppliers?.[0]?.supplier || p.supplier || null,
              _baseCaseCost: full.product.caseCost,
              _baseItemCost: full.product.itemCost,
            });
          }
        } catch (err) {
          console.error(`Error loading buying period product ${p.product.id}:`, err);
        }
      }
      if (productsToAdd.length === 0) {
        setError('No buying period products could be loaded');
        return;
      }
      const updatedProducts = [...selectedProducts, ...productsToAdd];
      setSelectedProducts(updatedProducts);
      const newQuantities = {};
      productsToAdd.forEach((product) => {
        newQuantities[product.id] = { cases: 0, items: 0, supplierCode: '' };
      });
      setProductQuantities(prev => ({ ...prev, ...newQuantities }));
      updateGroupedProducts(updatedProducts);
      setSuccess(`Added ${productsToAdd.length} buying period product(s) to the order`);
    } catch (err) {
      console.error('Error adding buying period products:', err);
      setError('Failed to add buying period products');
    }
  };

  const handleResetQuantities = () => {
    // Reset all cases and items to 0
    const resetQuantities = {};
    selectedProducts.forEach(product => {
      resetQuantities[product.id] = {
        cases: 0,
        items: 0,
        supplierCode: productQuantities[product.id]?.supplierCode || '',
      };
    });
    setProductQuantities(resetQuantities);
    setSuccess('All quantities have been reset to 0');
    setOptionsOpen(false);
  };

  if (loading) {
    return null;
  }

  if (!order) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Order not found</Alert>
      </Box>
    );
  }

  // Reference parity: a SENT order stays reachable on this route as the receive
  // surface (per-line To Receive inputs, Case Cost, Save, Save & Receive).
  const isSentOrder = order.type !== 'TRANSFER' && order.status === 'SENT';

  return (
    <Box sx={{ p: 3, backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', textAlign: 'center', flex: 1 }}>
          {order?.type === 'TRANSFER' ? 'Editing Transfer' : 'Editing Order'}
        </Typography>
        <Button
          onClick={() => setOptionsOpen(prev => !prev)}
          startIcon={<SettingsIcon />}
          endIcon={optionsOpen ? <ArrowUpIcon /> : <ArrowDownIcon />}
          sx={sfBtn}
        >
          Options
        </Button>
      </Box>

      {/* Options Panel - full-width inline (reference parity) */}
      {optionsOpen && (
        <Paper sx={{ p: 2, mb: 3, borderRadius: 0, backgroundColor: '#fff', boxShadow: 'none', border: '1px solid #e0e0e0' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
            <Button onClick={handlePrint} startIcon={<PrintIcon />} sx={sfBtn}>
              Print
            </Button>
            <Button onClick={handleResetQuantities} startIcon={<RefreshIcon />} sx={sfBtn}>
              Reset Quantities
            </Button>
            {order?.type !== 'TRANSFER' && (
              <Button onClick={handleAddBuyingPeriodProducts} startIcon={<AddIcon />} sx={sfBtn}>
                Add Buying Period
              </Button>
            )}
            <Box>
              <Typography sx={{ fontSize: 13, color: '#676b72', mb: 0.5 }}>
                Payment Fee Percentage
              </Typography>
              <TextField
                type="number"
                value={paymentFeePct}
                onChange={(e) => setPaymentFeePct(e.target.value)}
                sx={{ ...sfField, width: 220 }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">%</InputAdornment>,
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, color: '#676b72', mb: 0.5 }}>
                Invoice Fees ($)
              </Typography>
              <TextField
                type="number"
                value={invoiceFees}
                onChange={(e) => setInvoiceFees(e.target.value)}
                sx={{ ...sfField, width: 160 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, color: '#676b72', mb: 0.5 }}>
                Invoice Freight ($)
              </Typography>
              <TextField
                type="number"
                value={invoiceFreight}
                onChange={(e) => setInvoiceFreight(e.target.value)}
                placeholder="Supplier per-case freight"
                sx={{ ...sfField, width: 220 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: 13, color: '#676b72', mb: 0.5 }}>
                Invoice Discount ($)
              </Typography>
              <TextField
                type="number"
                value={invoiceDiscount}
                onChange={(e) => setInvoiceDiscount(e.target.value)}
                sx={{ ...sfField, width: 160 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 4, mt: 2, flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShopfrontSwitch checked={usePctFees} onChange={(e) => setUsePctFees(e.target.checked)} />
              <Typography sx={{ fontSize: 14, color: '#313439' }}>Use percentage for fees and discounts</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShopfrontSwitch checked={costsIncTax} onChange={(e) => setCostsIncTax(e.target.checked)} />
              <Typography sx={{ fontSize: 14, color: '#313439' }}>Costs on supplier invoice is inclusive of tax</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ShopfrontSwitch checked={freightIncluded} onChange={(e) => setFreightIncluded(e.target.checked)} />
              <Typography sx={{ fontSize: 14, color: '#313439' }}>Freight is included on supplier invoice</Typography>
            </Box>
          </Box>
        </Paper>
      )}

      {/* Order Details */}
      <Paper sx={{ p: 2, mb: 3, backgroundColor: '#fff' }}>
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">TYPE:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{order.type}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">STATUS:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{order.status}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">FROM:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {order.type === 'TRANSFER'
                ? getOutletNameById(order.from)
                : order.type === 'RETURN'
                  ? getDocumentOutletName()
                  : order.from === 'all' ? 'All Suppliers' : order.supplier?.name || order.from}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">TO:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {order.type === 'TRANSFER'
                ? getTransferTargetName(order.to)
                : order.type === 'RETURN'
                  ? order.supplier?.name || order.from
                  : order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : getDocumentOutletName()}
            </Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">ORDER DATE:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{formatDate(order.orderDate)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">ORDER NUMBER:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{order.orderNumber}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">INCLUDES FREIGHT:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{order.supplier?.freightIncludedOnInvoices ? 'Yes' : 'No'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">CREATED BY:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{order.creator?.name || user?.firstName || 'N/A'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">CREATED AT:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>{formatDateTime(order.createdAt)}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="body2" color="text.secondary">EXPECTED TOTAL:</Typography>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              {formatCurrency(order.expectedTotal != null ? order.expectedTotal : calculateGrandTotal())}
              {order.expectedTotal != null && Math.abs(order.expectedTotal - calculateGrandTotal()) >= 0.005 && (
                <Typography component="span" variant="body2" sx={{ color: '#dc2626', ml: 1 }}>
                  (actual {formatCurrency(calculateGrandTotal())})
                </Typography>
              )}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          startIcon={<EditIcon />}
          onClick={() => setEditDetailsDialogOpen(true)}
          sx={sfBtn}
        >
          Edit Details
        </Button>
        <Button
          startIcon={<CommentIcon />}
          onClick={() => setCommentsDialogOpen(true)}
          sx={sfBtn}
        >
          View Comments
        </Button>
      </Box>

      {/* Search Bar - attached row: input + New Product + All Suppliers (reference parity) */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Autocomplete
          freeSolo
          options={searchResults}
          getOptionLabel={(option) => {
            if (typeof option === 'string') return option;
            return option.name || option.product?.name || '';
          }}
          groupBy={(option) =>
            option.type === 'supplier'
              ? 'SUPPLIERS'
              : option.type === 'classification'
                ? 'CLASSIFICATIONS'
                : 'PRODUCTS'
          }
          renderGroup={(params) => (
            <li key={params.key}>
              <Box
                sx={{
                  px: 2,
                  py: 0.75,
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#676b72',
                  textTransform: 'uppercase',
                  backgroundColor: '#f8f8f8',
                }}
              >
                {params.group}
              </Box>
              <ul style={{ padding: 0, margin: 0 }}>{params.children}</ul>
            </li>
          )}
          loading={searchLoading}
          onInputChange={(event, newValue) => {
            setSearchTerm(newValue);
            if (newValue) {
              handleSearch(newValue);
            } else {
              setSearchResults([]);
            }
          }}
          onChange={(event, newValue) => {
            if (newValue && typeof newValue !== 'string') {
              handleSearchSelect(newValue);
            }
          }}
          renderOption={(props, option) => (
            <Box component="li" {...props}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                {option.image || option.imageUrl ? (
                  <Box
                    component="img"
                    src={option.image || option.imageUrl}
                    alt=""
                    sx={{ width: 28, height: 28, objectFit: 'contain' }}
                  />
                ) : (
                  <ImageOutlinedIcon sx={{ fontSize: 24, color: '#a1a1a1' }} />
                )}
                <Typography variant="body1">
                  {highlightMatch(option.name, searchTerm)}
                </Typography>
              </Box>
            </Box>
          )}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search for a product, supplier or classification"
              sx={sfField}
            />
          )}
          sx={{ flex: 1 }}
        />
        <Button
          startIcon={<AddIcon />}
          onClick={() => navigate('/products/new')}
          sx={{ ...sfBtn, fontSize: 24, px: 2.5 }}
        >
          New Product
        </Button>
        {order?.type !== 'TRANSFER' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <ShopfrontSwitch
              checked={allSuppliersToggle}
              onChange={(e) => {
                setAllSuppliersToggle(e.target.checked);
                if (searchTerm && searchTerm.trim().length >= 2) {
                  handleSearch(searchTerm);
                }
              }}
            />
            <Typography sx={{ whiteSpace: 'nowrap', fontSize: 14, color: '#313439' }}>
              All Suppliers
            </Typography>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Products List - Grouped */}
      {Object.keys(groupedProducts).length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No products added. Use the search bar above to add products.
          </Typography>
        </Paper>
      )}

      {Object.entries(groupedProducts).map(([groupKey, group]) => (
        <Paper key={groupKey} sx={{ mb: 2 }}>
          {/* Group Header */}
          <Box sx={{ backgroundColor: '#424242', color: 'white', p: 1.5 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              {group.name.toUpperCase()}
            </Typography>
          </Box>

          {/* Products in Group */}
          {group.products.map((product) => {
            const quantities = productQuantities[product.id] || { cases: 0, items: 0, supplierCode: '' };
            const ordered = orderedQuantities[product.id] || { cases: 0, items: 0 };
            const costChangePct = getCostChangePct(product);

            return (
              <Box key={product.id} sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Grid container spacing={2} alignItems="center">
                  {/* Checkbox - unchecked by default; checking reveals footer bulk actions */}
                  <Grid item xs={12} sm={0.5}>
                    <Checkbox
                      checked={!!checkedRows[product.id]}
                      onChange={(e) =>
                        setCheckedRows(prev => ({ ...prev, [product.id]: e.target.checked }))
                      }
                    />
                  </Grid>

                  {/* Product Name */}
                  <Grid item xs={12} sm={2.5}>
                    <Typography 
                      variant="body1" 
                      sx={{ fontWeight: 500, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                      onClick={() => {
                        // Toggle: if already selected, deselect; otherwise select
                        setSelectedProductForDetail(
                          selectedProductForDetail?.id === product.id ? null : product
                        );
                      }}
                    >
                      {product.name}
                    </Typography>
                    {product.buyingPeriodApplied && (
                      <Box sx={{ mt: 0.5 }}>
                        <Chip
                          size="small"
                          label="On Buying Period"
                          sx={{
                            bgcolor: '#e8f5e9',
                            color: '#2e7d32',
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Case Quantity: {product.caseQuantity || 1}
                    </Typography>
                  </Grid>

                  {/* Supplier Code - free text (reference parity) */}
                  <Grid item xs={12} sm={1.5}>
                    <TextField
                      value={quantities.supplierCode || ''}
                      onChange={(e) => handleSupplierTextChange(product.id, e.target.value)}
                      placeholder="Supplier Code"
                      fullWidth
                      sx={sfField}
                    />
                  </Grid>

                  {/* Details View: ordered quantities (disabled gray) */}
                  {detailsView && (
                    <Grid item xs={6} sm={1.5}>
                      <Typography sx={{ fontSize: 12, color: '#676b72', mb: 0.5 }}>Ordered</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box sx={{ flex: 1 }}>
                          <TextField value={ordered.cases || 0} disabled fullWidth sx={sfField} />
                          <Typography sx={sfCaption}>Cases</Typography>
                        </Box>
                        <Box sx={{ flex: 1 }}>
                          <TextField value={ordered.items || 0} disabled fullWidth sx={sfField} />
                          <Typography sx={sfCaption}>Items</Typography>
                        </Box>
                      </Box>
                    </Grid>
                  )}

                  {/* To Receive - Cases & Items (captions below, header above) */}
                  <Grid item xs={6} sm={2}>
                    <Typography sx={{ fontSize: 12, color: '#676b72', mb: 0.5 }}>To Receive</Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          type="number"
                          value={quantities.cases}
                          onChange={(e) => handleQuantityChange(product.id, 'cases', e.target.value)}
                          inputProps={{ min: 0 }}
                          fullWidth
                          sx={sfField}
                        />
                        <Typography sx={sfCaption}>Cases</Typography>
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <TextField
                          type="number"
                          value={quantities.items}
                          onChange={(e) => handleQuantityChange(product.id, 'items', e.target.value)}
                          inputProps={{ min: 0 }}
                          fullWidth
                          sx={sfField}
                        />
                        <Typography sx={sfCaption}>Items</Typography>
                      </Box>
                    </Box>
                  </Grid>

                  {/* Stock on Hand */}
                  <Grid item xs={6} sm={1}>
                    <Typography variant="body2" color="text.secondary">
                      CASES: {product.currentStockCases || 0}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ITEMS: {product.currentStockItems || 0}
                    </Typography>
                  </Grid>

                  {/* Case Cost - editable, $-prefixed */}
                  <Grid item xs={6} sm={1.5}>
                    <TextField
                      type="number"
                      value={product.caseCost ?? 0}
                      onChange={(e) => handleCaseCostChange(product.id, e.target.value)}
                      fullWidth
                      sx={sfField}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                    <Typography sx={sfCaption}>Case Cost</Typography>
                  </Grid>

                  {/* Total Payable - editable, $-prefixed */}
                  <Grid item xs={6} sm={1.5}>
                    <TextField
                      type="number"
                      value={Math.round(calculateProductTotal(product) * 100) / 100}
                      onChange={(e) => handleTotalPayableChange(product.id, e.target.value)}
                      fullWidth
                      sx={sfField}
                      InputProps={{
                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                      }}
                    />
                    <Typography sx={sfCaption}>Total Payable</Typography>
                  </Grid>

                  {/* New Case Cost + cost change indicator */}
                  <Grid item xs={6} sm={1.5}>
                    <Typography sx={{ fontSize: 11, color: '#676b72', textTransform: 'uppercase' }}>
                      New Case Cost
                    </Typography>
                    <Typography sx={{ fontWeight: 600 }}>
                      {formatCurrency(product.caseCost || 0)}
                    </Typography>
                    {costChangePct !== 0 && (
                      <Typography
                        sx={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: costChangePct > 0 ? '#dc2626' : '#16a34a',
                        }}
                      >
                        {costChangePct > 0 ? '▲' : '▼'} {Math.abs(costChangePct).toFixed(2)}%
                      </Typography>
                    )}
                  </Grid>
                </Grid>

                {/* Product Detail View - Inline */}
                {selectedProductForDetail?.id === product.id && (
                  <Box sx={{ mt: 2, pt: 2, borderTop: '2px solid #e0e0e0' }}>
                    <ProductDetailView
                      product={product}
                      quantities={productQuantities[product.id] || null}
                      onQuantityChange={handleQuantityChange}
                      onSupplierCodeChange={handleSupplierCodeChange}
                      supplierCode={supplierCodes[product.id] || null}
                      preloadedDetails={productDetailsMap[product.id]}
                    />
                  </Box>
                )}
              </Box>
            );
          })}

        </Paper>
      ))}

      {/* Footer: Details View toggle + bulk actions (shown when rows are checked) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ShopfrontSwitch checked={detailsView} onChange={(e) => setDetailsView(e.target.checked)} />
          <Typography sx={{ fontSize: 14, color: '#313439', whiteSpace: 'nowrap' }}>Details View</Typography>
        </Box>
        {getCheckedIds().length > 0 && (
          <>
            <Button
              onClick={handleRemoveSelected}
              startIcon={<DeleteOutlineIcon />}
              sx={{
                backgroundColor: '#fff',
                color: '#dc2626',
                border: '1px solid #e0e0e0',
                borderRadius: 0,
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 400,
                px: 2,
                transition: 'background 0.2s ease, color 0.2s ease',
                '&:hover': { backgroundColor: '#f8f8f8' },
              }}
            >
              Remove Products
            </Button>
            <Button
              onClick={handleAverageCost}
              startIcon={<BalanceOutlinedIcon />}
              sx={{
                backgroundColor: '#fff',
                color: '#676b72',
                border: '1px solid #e0e0e0',
                borderRadius: 0,
                textTransform: 'none',
                fontSize: 14,
                fontWeight: 400,
                px: 2,
                transition: 'background 0.2s ease, color 0.2s ease',
                '&:hover': { backgroundColor: '#f8f8f8' },
              }}
            >
              Average Cost
            </Button>
          </>
        )}
      </Box>

      {/* Footer Summary Bar - Orange with Cases, Items, Total */}
      <Box sx={{ backgroundColor: '#ff9800', color: 'white', p: 2, mt: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={4}>
            <TextField
              type="number"
              size="small"
              value={selectedProducts.reduce((sum, product) => {
                const quantities = productQuantities[product.id] || { cases: 0, items: 0 };
                return sum + (quantities.cases || 0);
              }, 0)}
              label="Cases"
              InputProps={{ readOnly: true }}
              sx={{ backgroundColor: 'white' }}
              fullWidth
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              type="number"
              size="small"
              value={selectedProducts.reduce((sum, product) => {
                // Loose items only (reference parity: Cases and Items are independent sums)
                const quantities = productQuantities[product.id] || { cases: 0, items: 0 };
                return sum + (quantities.items || 0);
              }, 0)}
              label="Items"
              InputProps={{ readOnly: true }}
              sx={{ backgroundColor: 'white' }}
              fullWidth
            />
          </Grid>
          <Grid item xs={4}>
            <TextField
              value={formatCurrency(calculateGrandTotal()).replace('$', '')}
              label="Total"
              InputProps={{ readOnly: true }}
              sx={{ backgroundColor: 'white' }}
              fullWidth
            />
          </Grid>
        </Grid>
      </Box>

      {/* Save Buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2, mb: 3 }}>
        <Button
          startIcon={<SaveIcon />}
          onClick={() => handleSave(false)}
          disabled={saving}
          sx={parityBtn}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {order?.type !== 'RETURN' && !isSentOrder && (
          <Button
            startIcon={<SendIcon />}
            onClick={() => handleSave(true)}
            disabled={saving || (order?.type === 'TRANSFER' && order?.status === 'SENT')}
            sx={parityBtn}
          >
            {order?.type === 'TRANSFER'
              ? (order?.status === 'SENT' ? 'Already Sent' : 'Save & Send')
              : 'Save & Send'}
          </Button>
        )}
        {(order?.type === 'ORDER' || order?.type === 'INVOICE') && order?.status !== 'RECEIVED' && (
          <Button
            startIcon={<ReceiveIcon />}
            onClick={handleSaveAndReceive}
            disabled={saving}
            sx={{ ...parityBtn, backgroundColor: '#16a34a', '&:hover': { backgroundColor: '#15803d', boxShadow: 'none' } }}
          >
            {saving ? 'Processing...' : 'Save & Receive'}
          </Button>
        )}
      </Box>

      {/* Order Review Comments Dialog (reference parity) */}
      <Dialog
        open={commentsDialogOpen}
        onClose={() => setCommentsDialogOpen(false)}
        PaperProps={{
          sx: { borderRadius: 0, width: 420, maxWidth: '90vw', overflowY: 'visible' },
        }}
      >
        <Box sx={{ position: 'relative', pt: 5, px: 3, pb: 3 }}>
          <Box
            sx={{
              position: 'absolute',
              top: -32,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#5ebbeb',
              color: '#f8f8f8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
              fontStyle: 'italic',
              fontFamily: 'serif',
            }}
          >
            i
          </Box>
          <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 20, mb: 2 }}>
            Order Review Comments
          </Typography>
          {(() => {
            // General review comments + resolved review status entries, newest first
            const entries = [
              ...(order?.reviewComments || [])
                .filter((c) => !c.orderInvoiceItemId)
                .map((c) => ({
                  key: `c${c.id}`,
                  title: c.user?.name || 'Unknown',
                  text: c.comment,
                  at: c.createdAt,
                })),
              ...(order?.reviews || [])
                .filter((r) => r.status !== 'PENDING')
                .map((r) => ({
                  key: `r${r.id}`,
                  title: `${r.reviewer?.name || 'Unknown'} — ${(r.status || '').replace(/_/g, ' ')}`,
                  text: r.comment,
                  at: r.resolvedAt || r.createdAt,
                })),
            ].sort((a, b) => new Date(b.at) - new Date(a.at));
            return entries.length > 0 ? (
              <Box sx={{ maxHeight: 320, overflowY: 'auto', mb: 3, textAlign: 'left' }}>
                {entries.map((entry) => (
                  <Box key={entry.key} sx={{ py: 1, borderBottom: '1px solid #e0e0e0' }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700 }}>{entry.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: '#676b72' }}>
                      {new Date(entry.at).toLocaleString('en-GB')}
                    </Typography>
                    {entry.text && (
                      <Typography sx={{ fontSize: 14, mt: 0.5 }}>{entry.text}</Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ) : null;
          })() || (
            <Typography sx={{ textAlign: 'center', color: '#676b72', fontSize: 14, mb: 3 }}>
              There are no review comments for this order.
            </Typography>
          )}
          <Button fullWidth onClick={() => setCommentsDialogOpen(false)} sx={grayBtn}>
            OK
          </Button>
        </Box>
      </Dialog>

      {/* Edit Details Dialog */}
      <Dialog
        open={editDetailsDialogOpen}
        onClose={() => setEditDetailsDialogOpen(false)}
        maxWidth={false}
        PaperProps={{
          sx: { borderRadius: 0, width: 660, maxWidth: '95vw', overflowY: 'visible' },
        }}
      >
        <Box sx={{ position: 'relative', pt: 5 }}>
          {/* Blue circular '?' badge overlapping the top edge */}
          <Box
            sx={{
              position: 'absolute',
              top: -32,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: '#5ebbeb',
              color: '#f8f8f8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            ?
          </Box>
          <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 22, mb: 2 }}>
            Edit Details
          </Typography>

          <DialogContent sx={{ pt: 0 }}>
            <Grid container spacing={2}>
              {/* From / To - read-only plain text (reference parity) */}
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, color: '#676b72', textTransform: 'uppercase' }}>From</Typography>
                <Typography sx={{ fontWeight: 500 }}>
                  {order?.type === 'TRANSFER'
                    ? getOutletNameById(order?.from)
                    : order?.from === 'all' ? 'All Suppliers' : order?.supplier?.name || order?.from}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, color: '#676b72', textTransform: 'uppercase' }}>To</Typography>
                <Typography sx={{ fontWeight: 500 }}>
                  {order?.type === 'TRANSFER'
                    ? getTransferTargetName(order?.to)
                    : order?.customer ? `${order.customer.firstName} ${order.customer.lastName}` : getDocumentOutletName()}
                </Typography>
              </Grid>

              {/* Order / Invoice Date */}
              <Grid item xs={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Order / Invoice Date"
                    value={editFormData.orderDate}
                    onChange={(newValue) => setEditFormData(prev => ({ ...prev, orderDate: newValue }))}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        sx={sfField}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <DateIcon sx={{ color: '#666', mr: 1 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>

              {/* Order / Invoice Number */}
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Order / Invoice Number"
                  value={editFormData.orderNumber}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                  sx={sfField}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OrderIcon sx={{ color: '#666', mr: 1 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {/* Due Date */}
              <Grid item xs={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Due Date"
                    value={editFormData.dueDate}
                    onChange={(newValue) => setEditFormData(prev => ({ ...prev, dueDate: newValue }))}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        fullWidth
                        sx={sfField}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <InputAdornment position="start">
                              <DateIcon sx={{ color: '#666', mr: 1 }} />
                            </InputAdornment>
                          ),
                        }}
                      />
                    )}
                  />
                </LocalizationProvider>
              </Grid>

              {/* Internal Reference */}
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Internal Reference"
                  value={editFormData.internalReference}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, internalReference: e.target.value }))}
                  sx={sfField}
                />
              </Grid>

              {/* Expected Total - $ prefix (reference parity) */}
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Expected Total"
                  value={editFormData.expectedTotal}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, expectedTotal: e.target.value }))}
                  sx={sfField}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>

              {/* Public Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Public Notes"
                  value={editFormData.publicNotes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, publicNotes: e.target.value }))}
                  multiline
                  rows={2}
                />
              </Grid>

              {/* Internal Notes */}
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Internal Notes"
                  value={editFormData.internalNotes}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, internalNotes: e.target.value }))}
                  multiline
                  rows={2}
                />
              </Grid>
            </Grid>
          </DialogContent>

          {/* Cancel bottom-left (gray boxed), Save bottom-right (#5ebbeb) */}
          <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Button onClick={() => setEditDetailsDialogOpen(false)} sx={grayBtn}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditDetails}
              disabled={saving}
              startIcon={<SaveIcon />}
              sx={{ ...sfBtn, height: 42, minWidth: 100 }}
            >
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

    </Box>
  );
};

export default EditOrder;