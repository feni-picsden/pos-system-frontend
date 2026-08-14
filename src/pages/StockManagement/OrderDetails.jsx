import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Alert,
  Snackbar,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Divider,
  Avatar,
  Chip,
  Grid,
  InputAdornment,
} from '@mui/material';
import {
  LocalShipping as ReceiveIcon,
  Label as ShelfTicketIcon,
  Print as PrintIcon,
  Email as EmailIcon,
  Cancel as CancelIcon,
  AttachFile as AttachFileIcon,
  Send as SendIcon,
  Create as PencilIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  StrikethroughS,
  Code as CodeIcon,
  Superscript as SuperscriptIcon,
  Subscript as SubscriptIcon,
  FormatListBulleted,
  FormatListNumbered,
  FormatIndentIncrease,
  FormatIndentDecrease,
  BorderColor as TextColorIcon,
  LinkOff as UnlinkIcon,
  Image as ImageIcon,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatAlignJustify,
  Link as LinkIcon,
  Undo as UndoIcon,
  Redo as RedoIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Replay as ReturnIcon,
  CalendarToday as DateIcon,
  Receipt as OrderIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { useParams, useNavigate } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import { outletService } from '../../services/outletService';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import shelfTicketService from '../../services/shelfTicketService';
import productService from '../../services/productService';
import ReviewerSelectDialog from '../../components/StockManagement/ReviewerSelectDialog';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// Shopfront reference toolbar button: solid #5ebbeb, 53px tall, square, hover inverts to #f8f8f8/#5ebbeb
const toolbarBtnSx = {
  backgroundColor: '#5ebbeb',
  color: '#f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  height: 53,
  borderRadius: 0,
  border: '1px solid #5ebbeb',
  boxShadow: 'none',
  textTransform: 'none',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { backgroundColor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
  '&.Mui-disabled': { backgroundColor: '#5ebbeb', color: 'rgba(248,248,248,0.6)', opacity: 0.6 },
};

// Reference table styles: header #5ebbeb / #f8f8f8 16px bold, 8px padding, cells 16px #000
const thSx = {
  backgroundColor: '#5ebbeb',
  color: 'rgb(248,248,248)',
  fontSize: 16,
  fontWeight: 700,
  padding: '8px',
  borderRadius: 0,
  borderBottom: 'none',
};
const tdSx = {
  fontSize: 16,
  color: '#000',
  padding: '8px',
  borderBottom: 'none',
};
const totalTdSx = {
  backgroundColor: 'rgb(94,187,235)',
  color: 'rgb(248,248,248)',
  fontWeight: 700,
  fontSize: 16,
  padding: '8px',
  borderBottom: 'none',
};
// Sub-caption under quantity numbers inside body cells (12.8px uppercase grey)
const qtySubSx = {
  fontSize: '12.8px',
  textTransform: 'uppercase',
  color: 'rgb(189,189,189)',
  lineHeight: 1.2,
};
// Header metadata label: 16px fw400 uppercase grey, no colon
const metaLabelSx = {
  fontSize: 16,
  fontWeight: 400,
  color: 'rgb(189,189,189)',
  textTransform: 'uppercase',
};
const metaValueSx = { fontSize: 16, color: '#000' };

const OrderDetails = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, prompt } = useAppDialogs();
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, getOutletName } = useAuth();
  const { selectedOutlet, outlets: knownOutlets } = useSelectedOutlet();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [emailOrderDialogOpen, setEmailOrderDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('[order-table]');
  const emailBodyRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [outlet, setOutlet] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewUsers, setReviewUsers] = useState([]);
  const [editDetailsOpen, setEditDetailsOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    orderDate: null,
    orderNumber: '',
    dueDate: null,
    internalReference: '',
    expectedTotal: '',
    publicNotes: '',
    internalNotes: '',
  });
  // Generic confirm dialog: { title, message, label, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);

  // Review gating: whether sending is blocked by an unresolved review
  const reviewBlocked = ['PENDING', 'DECLINED', 'CHANGES_REQUESTED'].includes(order?.reviewStatus);
  const reviewChipColor = {
    PENDING: '#f59e0b',
    CHANGES_REQUESTED: '#f59e0b',
    APPROVED: '#16a34a',
    DECLINED: '#dc2626',
  }[order?.reviewStatus];

  useEffect(() => {
    loadOrder();
    loadUserOutlet();
  }, [id, user]);

  const loadUserOutlet = async () => {
    try {
      if (user?.outlet) {
        setOutlet(user.outlet);
      } else if (user?.outletId) {
        // Try to get outlet from profile endpoint
        try {
          const profileResponse = await outletService.getCurrentOutlet();
          if (profileResponse?.user?.outlet) {
            setOutlet(profileResponse.user.outlet);
          }
        } catch {
          // If that fails and user is super admin, try getOutletById
          if (user?.isSuperAdmin && user?.outletId) {
            try {
              const response = await outletService.getOutletById(user.outletId);
              if (response.outlet) {
                setOutlet(response.outlet);
              }
            } catch (outletErr) {
              console.error('Error loading outlet by ID:', outletErr);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading user outlet:', err);
      // Fallback to getOutletName from context
    }
  };

  const loadOrder = async () => {
    try {
      setLoading(true);
      const response = await orderInvoiceService.getOrderInvoice(id);
      setOrder(response.orderInvoice);
      setError('');
    } catch (err) {
      setError('Failed to load order details');
      console.error('Error loading order:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reference: Receive opens the order modify (receive/edit) page with per-line
  // To Receive inputs, Save and Save & Receive — no one-shot API receive here.
  const handleReceive = () => {
    navigate(`/orders-invoices/${id}/edit`);
  };

  // Reference product name is a black, non-underlined link to the product page.
  // Order items only store the product name (no productId column on
  // OrderInvoiceItem), so resolve the id via search: try the full name first,
  // then progressively shorter prefixes so punctuation/rename drift still lands
  // on the right product instead of dead-ending in a snackbar.
  const handleProductClick = async (item) => {
    if (item?.productId) {
      navigate(`/products/${item.productId}`);
      return;
    }
    const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const productName = String(item?.product || '').replace(/\s+/g, ' ').trim();
    try {
      const tokens = productName.split(' ');
      for (let n = tokens.length; n >= 1; n--) {
        const term = tokens.slice(0, n).join(' ');
        const response = await productService.getProducts({ search: term, limit: 10 });
        const products = response.products || response.data || [];
        if (products.length === 0) continue;
        const match = products.find(p => norm(p.name) === norm(productName)) || products[0];
        navigate(`/products/${match.id}`);
        return;
      }
      setSnackbar({ open: true, message: `Product "${productName}" not found`, severity: 'warning' });
    } catch (err) {
      console.error('Error opening product:', err);
    }
  };

  // Cancel: detail-fields-only PUT (no `items` key so lines are preserved) with status CANCELLED
  const handleCancelOrder = async () => {
    try {
      setSaving(true);
      await orderInvoiceService.updateOrderInvoice(id, {
        from: order.from,
        to: order.to,
        orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
        orderNumber: order.orderNumber || '',
        dueDate: order.dueDate ? new Date(order.dueDate) : null,
        internalReference: order.internalReference || '',
        publicNotes: order.publicNotes || '',
        internalNotes: order.internalNotes || '',
        generateStockFrom: order?.generateStockFrom || 'none',
        totalAmount: order.totalAmount || 0,
        type: order?.type || 'ORDER',
        status: 'CANCELLED',
      });
      setConfirmDialog(null);
      await loadOrder();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to cancel order',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Reorder Items (sent returns): create a new PENDING ORDER copying all lines
  const handleReorderItems = async () => {
    try {
      setSaving(true);
      const response = await orderInvoiceService.reorderItems(id);
      setConfirmDialog(null);
      navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to reorder items',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // Display names for From / To. For RETURN docs the goods go outlet -> supplier,
  // so the supplier/outlet sides are swapped relative to orders/invoices.
  // TRANSFER stores the source outlet id in `from`; resolve it to a name.
  const resolveOutletRef = (ref) => {
    const id = parseInt(String(ref ?? '').replace(/^outlet:/, ''), 10);
    return Number.isNaN(id) ? null : knownOutlets.find((o) => o.id === id)?.name || null;
  };
  const supplierSideDisplay = !order
    ? ''
    : order.from === 'all'
      ? 'All Suppliers'
      : order.supplier?.name
        || order.fromOutlet?.name
        || order.fromName
        || resolveOutletRef(order.from)
        || order.from;
  const outletSideDisplay = !order
    ? ''
    : order.customer
      ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() || order.customer.name
      : order.toOutlet?.name
        || order.toTransferee?.name
        || order.toVendor?.name
        || order.toName
        // A TRANSFER's destination lives in `to`; never fall back to the
        // document's own outlet (that is the source) or the viewer's outlet.
        || (order.type === 'TRANSFER'
          ? resolveOutletRef(order.to) || order.to || 'N/A'
          : knownOutlets.find((o) => o.id === (order.toOutletId ?? order.outletId))?.name
            || outlet?.name
            || selectedOutlet?.name
            || getOutletName()
            || 'N/A');
  const isReturn = order?.type === 'RETURN';
  // Sent By/At only exist once the document was actually sent (never from createdAt/updatedAt)
  const wasSent = Boolean(order?.sentAt || order?.sentBy);
  const fromDisplay = isReturn ? outletSideDisplay : supplierSideDisplay;
  const toDisplay = isReturn ? supplierSideDisplay : outletSideDisplay;

  const handleOpenEmailOrderDialog = () => {
    if (!order) return;
    const typeTitle = order.type
      ? order.type.charAt(0).toUpperCase() + order.type.slice(1).toLowerCase()
      : 'Order';
    setEmailSubject(`${typeTitle} ${order.orderNumber} from ${fromDisplay}`);
    setEmailBody(order.publicNotes ? `<p>${order.publicNotes}</p>[order-table]` : '[order-table]');
    setEmailTo(order.customer?.email || '');
    setEmailOrderDialogOpen(true);
  };

  useEffect(() => {
    if (!emailOrderDialogOpen) return;
    const setInitialBody = () => {
      if (emailBodyRef.current) {
        emailBodyRef.current.innerHTML = emailBody || '[order-table]';
      }
    };
    setInitialBody();
    const t = setTimeout(setInitialBody, 0);
    return () => clearTimeout(t);
  }, [emailOrderDialogOpen, emailBody]);

  const execEditorCommand = (command, value = null) => {
    if (emailBodyRef.current) {
      emailBodyRef.current.focus();
      document.execCommand(command, false, value);
    }
  };

  const handleSendOrderEmail = async () => {
    if (!emailTo.trim()) {
      setSnackbar({ open: true, message: 'Please enter a recipient email address.', severity: 'warning' });
      return;
    }
    const bodyHtml = emailBodyRef.current?.innerHTML ?? emailBody;
    try {
      setSaving(true);
      await orderInvoiceService.sendOrderEmail(id, {
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: bodyHtml,
      });
      setEmailOrderDialogOpen(false);
      setSnackbar({ open: true, message: 'Order email sent successfully.', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to send order email.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditDetails = () => {
    if (!order) return;
    setEditFormData({
      orderDate: order.orderDate ? new Date(order.orderDate) : new Date(),
      orderNumber: order.orderNumber || '',
      dueDate: order.dueDate ? new Date(order.dueDate) : null,
      internalReference: order.internalReference || '',
      expectedTotal: order.expectedTotal != null ? String(order.expectedTotal) : '',
      publicNotes: order.publicNotes || '',
      internalNotes: order.internalNotes || '',
    });
    setEditDetailsOpen(true);
  };

  const handleSaveEditDetails = async () => {
    try {
      setSaving(true);
      // Detail fields only — no `items` key, so the backend preserves the
      // existing order lines instead of recreating them.
      await orderInvoiceService.updateOrderInvoice(id, {
        from: order.from,
        to: order.to,
        orderDate: editFormData.orderDate,
        orderNumber: editFormData.orderNumber,
        dueDate: editFormData.dueDate,
        internalReference: editFormData.internalReference,
        publicNotes: editFormData.publicNotes,
        internalNotes: editFormData.internalNotes,
        expectedTotal: editFormData.expectedTotal === '' ? null : parseFloat(editFormData.expectedTotal),
        generateStockFrom: order?.generateStockFrom || 'none',
        totalAmount: order.totalAmount,
        type: order?.type || 'ORDER',
        status: order?.status || 'PENDING',
      });
      setEditDetailsOpen(false);
      setSnackbar({ open: true, message: 'Order details updated successfully', severity: 'success' });
      await loadOrder();
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to save order details',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReturnItems = async () => {
    try {
      setSaving(true);
      const response = await orderInvoiceService.returnItems(id);
      setConfirmDialog(null);
      setSnackbar({ open: true, message: 'Return created successfully', severity: 'success' });
      navigate(`/orders-invoices/${response.orderInvoice.id}/edit`);
    } catch (err) {
      setSnackbar({
        open: true,
        message: err.response?.data?.error || 'Failed to create return',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenCreateReview = async () => {
    setReviewDialogOpen(true);
    if (reviewUsers.length === 0) {
      try {
        const response = await userService.getUsers();
        setReviewUsers(response.users || response.data || response || []);
      } catch (err) {
        console.error('Error loading users for review:', err);
      }
    }
  };

  // Create the review, then open the dedicated review page (reference behaviour)
  const handleConfirmReview = async (reviewerIds) => {
    if (reviewerIds.length === 0) {
      setSnackbar({ open: true, message: 'Please select at least one reviewer.', severity: 'warning' });
      return;
    }
    try {
      setSaving(true);
      await orderInvoiceService.createReview(id, { reviewerIds });
      setReviewDialogOpen(false);
      navigate(`/orders-invoices/${id}/review`);
    } catch (err) {
      setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to request review.', severity: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddToShelfTickets = async () => {
    if (!order || !order.items || order.items.length === 0) {
      setSnackbar({
        open: true,
        message: 'No products in this order to add',
        severity: 'warning',
      });
      return;
    }

    try {
      setSaving(true);

      // Extract unique product names from order items
      const productNames = [...new Set(order.items.map(item => item.product).filter(Boolean))];

      if (productNames.length === 0) {
        setSnackbar({
          open: true,
          message: 'No valid products found in this order',
          severity: 'warning',
        });
        return;
      }

      // Search for products by name to get their IDs
      const productIds = [];
      const notFoundProducts = [];

      for (const productName of productNames) {
        try {
          const response = await productService.getProducts({
            search: productName,
            limit: 1,
          });

          const products = response.products || response.data || [];
          const exactMatch = products.find(p => p.name === productName);

          if (exactMatch) {
            productIds.push(exactMatch.id);
          } else if (products.length > 0) {
            // Use first match if exact match not found
            productIds.push(products[0].id);
          } else {
            notFoundProducts.push(productName);
          }
        } catch (err) {
          console.error(`Error searching for product ${productName}:`, err);
          notFoundProducts.push(productName);
        }
      }

      if (productIds.length === 0) {
        setSnackbar({
          open: true,
          message: 'Could not find any products to add',
          severity: 'error',
        });
        return;
      }

      // Add products to shelf tickets
      const response = await shelfTicketService.addBulkShelfTickets({
        productIds,
        ticketType: 'Everyday',
        productGrouping: null,
        priceSet: null,
      });

      let message = `Added ${response.added} product${response.added !== 1 ? 's' : ''} to shelf tickets`;
      if (response.skipped > 0) {
        message += ` (${response.skipped} already existed)`;
      }
      if (notFoundProducts.length > 0) {
        message += `. ${notFoundProducts.length} product(s) not found: ${notFoundProducts.join(', ')}`;
      }

      setSnackbar({
        open: true,
        message,
        severity: notFoundProducts.length > 0 ? 'warning' : 'success',
      });

      // Optionally navigate to shelf tickets page
      setTimeout(() => {
        navigate('/marketing/shelf-tickets/everyday');
      }, 1500);
    } catch (error) {
      console.error('Error adding products to shelf tickets:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to add products to shelf tickets',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAttachment = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow re-selecting the same file
    if (!file) return;

    try {
      setSaving(true);
      const response = await orderInvoiceService.uploadAttachment(id, file);
      setOrder((prev) => (prev ? { ...prev, attachments: response.attachments } : prev));
      setSnackbar({ open: true, message: 'Attachment uploaded successfully', severity: 'success' });
    } catch (error) {
      console.error('Error uploading attachment:', error);
      setSnackbar({
        open: true,
        message: error.response?.data?.error || 'Failed to upload attachment',
        severity: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (!order) return;

    // Create or get print container
    let printContainer = document.getElementById('order-print-container');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'order-print-container';
      document.body.appendChild(printContainer);
    }

    // Calculate totals for print
    const totalOrderedCases = order.items?.reduce((sum, item) => {
      return sum + (item.cases !== undefined ? item.cases : Math.floor(item.quantity / getCaseQuantity(item)));
    }, 0) || 0;

    const totalOrderedItems = order.items?.reduce((sum, item) => {
      return sum + (item.items !== undefined ? item.items : (item.quantity % getCaseQuantity(item)));
    }, 0) || 0;

    const totalAmountInc = order.items?.reduce((sum, item) => {
      const totals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));
      return sum + totals.totalInc;
    }, 0) || 0;

    // Format ordered quantity display
    const formatOrdered = (item) => {
      const caseQuantity = getCaseQuantity(item);
      const cases = item.cases !== undefined ? item.cases : calculateCasesAndItems(item.quantity, caseQuantity).cases;
      const items = item.items !== undefined ? item.items : calculateCasesAndItems(item.quantity, caseQuantity).items;
      if (cases > 0 && items > 0) {
        return `${cases}/${items}`;
      } else if (cases > 0) {
        return cases.toString();
      } else if (items > 0) {
        return items.toString();
      }
      return '0';
    };

    // Get product suppliers
    const getSupplierName = () => {
      return order.supplier?.name || '-';
    };

    // Get supplier code
    const getSupplierCode = (item) => {
      return item.supplierCode || '-';
    };

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
            <span class="info-value">${fromDisplay}</span>
          </div>
          <div class="info-row">
            <span class="info-label">To:</span>
            <span class="info-value">${toDisplay}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Includes Freight:</span>
            <span class="info-value">${includesFreight ? 'Yes' : 'No'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created By:</span>
            <span class="info-value">${order.creator?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Created At:</span>
            <span class="info-value">${formatDateTime(order.createdAt)}</span>
          </div>
          ${wasSent ? `
          <div class="info-row">
            <span class="info-label">Sent By:</span>
            <span class="info-value">${order.sender?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sent At:</span>
            <span class="info-value">${formatDateTime(order.sentAt)}</span>
          </div>
          ` : `
          <div class="info-row">
            <span class="info-label">Sent By:</span>
            <span class="info-value">-</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sent At:</span>
            <span class="info-value">-</span>
          </div>
          `}
          ${order.receivedBy && order.receivedAt ? `
          <div class="info-row">
            <span class="info-label">Received By:</span>
            <span class="info-value">${order.receiver?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Received At:</span>
            <span class="info-value">${formatDateTime(order.receivedAt)}</span>
          </div>
          ` : `
          <div class="info-row">
            <span class="info-label">Received By:</span>
            <span class="info-value">-</span>
          </div>
          <div class="info-row">
            <span class="info-label">Received At:</span>
            <span class="info-value">-</span>
          </div>
          `}
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
              <th>Total (inc)</th>
            </tr>
          </thead>
          <tbody>
            ${order.items && order.items.length > 0 ? order.items.map((item) => {
              const totals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));
              return `
                <tr>
                  <td>${item.product}</td>
                  <td>${getSupplierName(item)}</td>
                  <td>${getSupplierCode(item)}</td>
                  <td>${getCaseQuantity(item)}</td>
                  <td>${formatOrdered(item)}</td>
                  <td>${formatCurrency(totals.totalInc)}</td>
                </tr>
              `;
            }).join('') : `
              <tr>
                <td colspan="6" style="text-align: center; color: #999;">0 lines</td>
              </tr>
            `}
            <tr class="total-row">
              <td>Total</td>
              <td>${order.items?.length || 0} line${(order.items?.length || 0) !== 1 ? 's' : ''}</td>
              <td></td>
              <td></td>
              <td>${totalOrderedCases}/${totalOrderedItems}</td>
              <td>${formatCurrency(totalAmountInc)}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          <div class="footer-url">${window.location.origin}/orders-invoices/${id}</div>
          <div class="footer-page">1/1</div>
        </div>
      </div>
    `;

    // Add print styles
    const styleId = 'order-print-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #order-print-container {
          display: none;
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
            display: block !important;
          }
          .order-print-view {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .order-header {
            margin-bottom: 20px;
          }
          .order-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
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
          @page {
            margin: 20mm;
            size: A4;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // Trigger print
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  };

  // Reference shows enum values in sentence case ('Transfer', 'Sent', 'Credit note')
  const sentenceCase = (s) => (s ? (s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).replace(/_/g, ' ') : '');

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

  // Case quantity per line, returned by the API (product join); legacy rows default to 1
  const getCaseQuantity = (item) => item?.caseQuantity || 1;

  // Per-line tax rate: the product's configured purchase tax % (returned by the
  // API); transfers are internal stock movements so no tax. Legacy rows without
  // the field keep the old 10% assumption.
  const itemTaxRate = (item) =>
    order?.type === 'TRANSFER' ? 0 : (item?.taxRatePercent ?? 10) / 100;

  // Freight flag: supplier setting, or actual freight charged on the received purchase
  const includesFreight = Boolean(
    order?.supplier?.freightIncludedOnInvoices || (order?.purchases?.[0]?.freight || 0) > 0
  );

  // Helper to calculate cases and items from quantity
  const calculateCasesAndItems = (quantity, caseQuantity = 1) => {
    const cases = Math.floor(quantity / caseQuantity);
    const items = quantity % caseQuantity;
    return { cases, items };
  };

  // Helper to calculate totals with tax
  const calculateTotals = (quantity, unitPrice, taxRate = 0.1) => {
    const totalEx = quantity * unitPrice;
    const totalInc = totalEx * (1 + taxRate);
    return { totalEx, totalInc };
  };

  if (loading) {
    return <PageLoader />;
  }

  if (!order) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Order not found</Alert>
      </Box>
    );
  }

  // Calculate totals for all items
  const orderedTotalEx = order.items?.reduce((sum, item) => {
    const totals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));
    return sum + totals.totalEx;
  }, 0) || 0;

  const orderedTotalInc = order.items?.reduce((sum, item) => {
    const totals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));
    return sum + totals.totalInc;
  }, 0) || 0;

  // For received, we'll use the same as ordered for now (since schema doesn't have separate received quantity)
  const receivedTotalEx = orderedTotalEx;
  const receivedTotalInc = orderedTotalInc;

  const totalLines = order.items?.length || 0;
  // Toolbar/table gating (reference matrix)
  const isUnsent = order.status === 'PENDING' || order.status === 'OPEN';
  const isCreditNote = order.type === 'CREDIT_NOTE';
  const isOrderOrInvoice = order.type === 'ORDER' || order.type === 'INVOICE';
  // Unsent orders/invoices show the simplified reference column set
  const simpleTable = isOrderOrInvoice && isUnsent;
  // Fee-related columns: reference hides them only for TRANSFER documents
  // (sent returns show +Fees/-Discounts, Freight, Rebate, Payment Fees).
  const showFeeColumns = order.type !== 'TRANSFER';
  // A RETURN needs a supplier: transfers are returnable only when a vendor
  // counterpart is resolvable (supplierId, or 'vendor:<id>' in to/from).
  const transferHasVendor =
    order.supplierId != null ||
    String(order.to || '').startsWith('vendor:') ||
    String(order.from || '').startsWith('vendor:');
  const canReturnItems =
    order.status === 'RECEIVED' &&
    (order.type === 'ORDER' ||
      order.type === 'INVOICE' ||
      (order.type === 'TRANSFER' && transferHasVendor));

  const totalCases = order.items?.reduce((sum, item) => {
    return sum + (item.cases !== undefined ? item.cases : Math.floor(item.quantity / getCaseQuantity(item)));
  }, 0) || 0;
  const totalItems = order.items?.reduce((sum, item) => {
    return sum + (item.items !== undefined ? item.items : (item.quantity % getCaseQuantity(item)));
  }, 0) || 0;

  // Received footer totals: persisted receivedCases/receivedItems (partial receipt),
  // else purchase record, else ordered once RECEIVED, else 0 (same fallback as rows)
  const receivedQtyFor = (item) => {
    const pi = order.purchases?.[0]?.items?.find((p) => p.productName === item.product);
    return {
      cases: item.receivedCases ?? (pi ? (pi.cases || 0) : (order.status === 'RECEIVED' ? (item.cases || 0) : 0)),
      items: item.receivedItems ?? (pi ? (pi.items || 0) : (order.status === 'RECEIVED' ? (item.items || 0) : 0)),
    };
  };
  const receivedTotalCases = order.items?.reduce((sum, item) => sum + receivedQtyFor(item).cases, 0) || 0;
  const receivedTotalItems = order.items?.reduce((sum, item) => sum + receivedQtyFor(item).items, 0) || 0;

  // Quantity with CASES / ITEMS sub-captions inside the cell (reference style)
  const renderQty = (cases, items, onColor = false) => (
    <Box>
      <Box>
        <Typography component="span" sx={{ fontSize: 16, fontWeight: 'inherit', color: 'inherit' }}>{cases}</Typography>
        <Typography sx={{ ...qtySubSx, ...(onColor ? { color: 'rgba(248,248,248,0.8)' } : {}) }}>Cases</Typography>
      </Box>
      <Box>
        <Typography component="span" sx={{ fontSize: 16, fontWeight: 'inherit', color: 'inherit' }}>{items}</Typography>
        <Typography sx={{ ...qtySubSx, ...(onColor ? { color: 'rgba(248,248,248,0.8)' } : {}) }}>Items</Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ backgroundColor: '#f5f5f5', minHeight: '100vh', pb: 3 }}>
      {error && (
        <Alert severity="error" sx={{ m: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Top Action Bar — buttons and order follow the reference status/type matrix */}
      <Box sx={{
        p: 1.5,
        display: 'flex',
        gap: 1,
        flexWrap: 'wrap',
        mb: 2,
      }}>
        {/* Receive: local addition (not in reference) for unsent/sent orders & invoices */}
        {isOrderOrInvoice && (isUnsent || order.status === 'SENT') && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<ReceiveIcon />}
            onClick={handleReceive}
            sx={toolbarBtnSx}
          >
            Receive
          </Button>
        )}
        {/* Edit: unsent documents open the edit page */}
        {isUnsent && !isCreditNote && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<PencilIcon />}
            onClick={() => navigate(`/orders-invoices/${id}/edit`)}
            sx={toolbarBtnSx}
          >
            Edit
          </Button>
        )}
        {/* Send: unsent documents — opens the email composer (send-email marks SENT) */}
        {isUnsent && !isCreditNote && (
          <Tooltip title={reviewBlocked ? 'Order review is pending/declined' : ''}>
            <span>
              <Button
                variant="contained"
                disableElevation
                startIcon={<SendIcon />}
                onClick={handleOpenEmailOrderDialog}
                disabled={saving || reviewBlocked}
                sx={toolbarBtnSx}
              >
                Send
              </Button>
            </span>
          </Tooltip>
        )}
        {!isCreditNote && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<ShelfTicketIcon />}
            onClick={handleAddToShelfTickets}
            disabled={saving || !order?.items || order.items.length === 0}
            sx={toolbarBtnSx}
          >
            {saving ? 'Adding...' : 'Add to Shelf Tickets'}
          </Button>
        )}
        {/* Pending credit notes show Edit Details before Print (reference) */}
        {isCreditNote && order.status === 'PENDING' && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<EditIcon />}
            onClick={handleOpenEditDetails}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Edit Details
          </Button>
        )}
        <Button
          variant="contained"
          disableElevation
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={toolbarBtnSx}
        >
          Print
        </Button>
        {/* Email Order: sent documents only */}
        {!isCreditNote && order.status === 'SENT' && (
          <Tooltip title={reviewBlocked ? 'Order review is pending/declined' : ''}>
            <span>
              <Button
                variant="contained"
                disableElevation
                startIcon={<EmailIcon />}
                onClick={handleOpenEmailOrderDialog}
                disabled={reviewBlocked}
                sx={toolbarBtnSx}
              >
                Email Order
              </Button>
            </span>
          </Tooltip>
        )}
        {/* Edit Details: sent orders/invoices/returns, and anything received */}
        {!isCreditNote &&
          ((order.status === 'SENT' && order.type !== 'TRANSFER') || order.status === 'RECEIVED') && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<EditIcon />}
            onClick={handleOpenEditDetails}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Edit Details
          </Button>
        )}
        {/* Reorder Items: sent returns */}
        {order.type === 'RETURN' && order.status === 'SENT' && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<RedoIcon />}
            onClick={() => setConfirmDialog({
              title: 'Reorder Items',
              message: 'Are you sure you wish to reorder all of the items from this return?',
              label: 'Reorder Items',
              onConfirm: handleReorderItems,
            })}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Reorder Items
          </Button>
        )}
        {canReturnItems && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<ReturnIcon />}
            onClick={() => setConfirmDialog({
              title: 'Return All Items',
              message: 'Are you sure you wish to return all of the items from this invoice?',
              label: 'Return Items',
              onConfirm: handleReturnItems,
            })}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Return Items
          </Button>
        )}
        {/* Create/View Review: unsent docs, and sent orders/invoices/transfers (not sent returns) */}
        {!isCreditNote && (isUnsent || (order.status === 'SENT' && order.type !== 'RETURN')) && (
          order.reviewStatus ? (
            <Button
              variant="contained"
              disableElevation
              startIcon={<PencilIcon />}
              onClick={() => navigate(`/orders-invoices/${id}/review`)}
              sx={toolbarBtnSx}
            >
              View Review
            </Button>
          ) : (
            <Button
              variant="contained"
              disableElevation
              startIcon={<PencilIcon />}
              onClick={handleOpenCreateReview}
              disabled={reviewDialogOpen}
              sx={toolbarBtnSx}
            >
              Create Review
            </Button>
          )
        )}
        {/* Cancel: unsent documents (before Upload in reference) */}
        {isUnsent && !isCreditNote && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<CancelIcon />}
            onClick={() => setConfirmDialog({
              title: 'Cancel Order',
              message: 'Are you sure you wish to cancel this order?',
              label: 'Cancel Order',
              onConfirm: handleCancelOrder,
            })}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          disableElevation
          component="label"
          startIcon={<AttachFileIcon />}
          sx={toolbarBtnSx}
        >
          Upload Attachment
          <input type="file" hidden accept="image/*,application/pdf" onChange={handleUploadAttachment} />
        </Button>
        {/* Cancel for pending credit notes comes after Upload (reference) */}
        {isCreditNote && order.status === 'PENDING' && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<CancelIcon />}
            onClick={() => setConfirmDialog({
              title: 'Cancel Credit Note',
              message: 'Are you sure you wish to cancel this order?',
              label: 'Cancel',
              onConfirm: handleCancelOrder,
            })}
            disabled={saving}
            sx={toolbarBtnSx}
          >
            Cancel
          </Button>
        )}
      </Box>

      {/* Order Summary Header — flat on the page background, one dense left-aligned flow row */}
      <Box sx={{ mb: 2, pl: 1, display: 'flex', flexWrap: 'wrap', columnGap: '48px', rowGap: 2 }}>
        {[
          ['Type', sentenceCase(order.type)],
          ['Status', sentenceCase(order.status)],
          ...(order.reviewStatus
            ? [['Review', (
                <Chip
                  size="small"
                  label={sentenceCase(order.reviewStatus)}
                  sx={{ backgroundColor: reviewChipColor, color: '#fff', borderRadius: 0, fontSize: 14 }}
                />
              )]]
            : []),
          ['From', fromDisplay],
          ['To', toDisplay],
          ['Order Date', formatDate(order.orderDate)],
          ['Order Number', order.orderNumber],
          ...((isReturn || order.type === 'CREDIT_NOTE') && order.linkedInvoice?.orderNumber
            ? [['Linked Invoice', order.linkedInvoice.orderNumber]]
            : []),
          ...(isReturn && order.returnCostBasis
            ? [['Return Cost', order.returnCostBasis === 'BASE_FEES_FREIGHT' ? 'Base + Fees + Freight' : 'Base Cost Only']]
            : []),
          ['Includes Freight', includesFreight ? 'Yes' : 'No'],
          ['Created By', order.creator?.name || 'N/A'],
          ['Created At', formatDateTime(order.createdAt)],
          ...(wasSent
            ? [
                ['Sent By', order.sender?.name || 'N/A'],
                ['Sent At', formatDateTime(order.sentAt)],
              ]
            : []),
          ...(order.receivedBy || order.receivedAt
            ? [
                ['Received By', order.receiver?.name || 'N/A'],
                ['Received At', formatDateTime(order.receivedAt)],
              ]
            : []),
          ...(order.internalReference ? [['Internal Reference', order.internalReference]] : []),
          ...(order.publicNotes ? [['Public Notes', order.publicNotes]] : []),
          ...(order.internalNotes ? [['Internal Notes', order.internalNotes]] : []),
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography sx={metaLabelSx}>{label}</Typography>
            <Typography sx={metaValueSx} component={typeof value === 'string' ? 'p' : 'div'}>{value}</Typography>
          </Box>
        ))}
        {Array.isArray(order.attachments) && order.attachments.length > 0 && (
          <Box>
            <Typography sx={metaLabelSx}>Attachments</Typography>
            {order.attachments.map((att, i) => (
              <Box
                key={i}
                component="a"
                href={`${window.location.protocol}//${window.location.hostname}:5000${att.url}`}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ ...metaValueSx, display: 'block', color: '#5ebbeb', textDecoration: 'none' }}
              >
                {att.name}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Product Details Table — unsent orders/invoices show the simplified reference column set */}
      <Paper sx={{ mx: 2, backgroundColor: '#fff', borderRadius: 0, boxShadow: 'none' }}>
        <TableContainer>
          {simpleTable ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Product</TableCell>
                <TableCell sx={thSx}>Supplier</TableCell>
                <TableCell sx={thSx}>Supplier Code</TableCell>
                <TableCell sx={thSx} align="right">Case Quantity</TableCell>
                <TableCell sx={thSx} align="right">Ordered</TableCell>
                <TableCell sx={thSx} align="right">Total (inc)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.items?.map((item, index) => {
                const caseQuantity = getCaseQuantity(item);
                const orderedCases = item.cases !== undefined ? item.cases : calculateCasesAndItems(item.quantity, caseQuantity).cases;
                const orderedItems = item.items !== undefined ? item.items : calculateCasesAndItems(item.quantity, caseQuantity).items;
                const orderedTotals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));
                return (
                  <TableRow key={index}>
                    <TableCell sx={tdSx}>
                      <Box
                        component="a"
                        onClick={() => handleProductClick(item)}
                        sx={{ color: '#000', textDecoration: 'none', cursor: 'pointer' }}
                      >
                        {item.product}
                      </Box>
                    </TableCell>
                    <TableCell sx={tdSx}>{order.supplier?.name || ''}</TableCell>
                    <TableCell sx={tdSx}>{item.supplierCode || '-'}</TableCell>
                    <TableCell sx={tdSx} align="right">{caseQuantity}</TableCell>
                    <TableCell sx={tdSx} align="right">{renderQty(orderedCases, orderedItems)}</TableCell>
                    <TableCell sx={tdSx} align="right">{formatCurrency(orderedTotals.totalInc)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow>
                <TableCell sx={totalTdSx}>Total</TableCell>
                <TableCell sx={totalTdSx}>
                  {totalLines} line{totalLines !== 1 ? 's' : ''}
                </TableCell>
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} align="right">{renderQty(totalCases, totalItems, true)}</TableCell>
                <TableCell sx={totalTdSx} align="right">{formatCurrency(orderedTotalInc)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Product</TableCell>
                <TableCell sx={thSx}>Supplier Code</TableCell>
                <TableCell sx={thSx} align="right">Case Quantity</TableCell>
                <TableCell sx={thSx} align="right">Base Cost</TableCell>
                <TableCell sx={thSx} align="right">Ordered</TableCell>
                <TableCell sx={thSx} align="right">Ordered Total (ex)</TableCell>
                <TableCell sx={thSx} align="right">Ordered Total (inc)</TableCell>
                <TableCell sx={thSx} align="right">Received</TableCell>
                {showFeeColumns && (
                  <>
                    <TableCell sx={thSx} align="right">+ Fees / - Discounts</TableCell>
                    <TableCell sx={thSx} align="right">Freight</TableCell>
                    <TableCell sx={thSx} align="right">Rebate</TableCell>
                    <TableCell sx={thSx} align="right">Payment Fees</TableCell>
                  </>
                )}
                <TableCell sx={thSx} align="right">Total (ex)</TableCell>
                <TableCell sx={thSx} align="right">Total (inc)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {order.items?.map((item, index) => {
                // Use stored cases and items if available, otherwise calculate from quantity (backward compatibility)
                const caseQuantity = getCaseQuantity(item);
                const orderedCases = item.cases !== undefined ? item.cases : calculateCasesAndItems(item.quantity, caseQuantity).cases;
                const orderedItems = item.items !== undefined ? item.items : calculateCasesAndItems(item.quantity, caseQuantity).items;
                const orderedTotals = calculateTotals(item.quantity, item.unitPrice, itemTaxRate(item));

                // Get purchase item data if order is received
                const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                const purchaseItem = purchase?.items?.find(pi => pi.productName === item.product);

                // Received = persisted receivedCases/receivedItems (partial receipt);
                // fall back to the purchase record captured at receive time; nothing before then
                const receivedCases = item.receivedCases ?? (purchaseItem ? (purchaseItem.cases || 0) : (order.status === 'RECEIVED' ? orderedCases : 0));
                const receivedItems = item.receivedItems ?? (purchaseItem ? (purchaseItem.items || 0) : (order.status === 'RECEIVED' ? orderedItems : 0));

                // Calculate received totals with fees
                const baseCost = purchaseItem?.cost || (item.unitPrice * item.quantity);
                const fees = purchaseItem?.fees || 0;
                const freight = purchaseItem?.freight || 0;
                const rebate = purchaseItem?.rebate || 0;
                const paymentFees = purchaseItem?.paymentFees || 0;

                // Total (ex) should NOT include payment fees
                const rowTotalEx = baseCost + fees + freight - rebate;
                // Total (inc) includes payment fees and tax; tax-inclusive
                // invoice costs already contain their tax
                const rowTotalInc = order.costsIncludeTax
                  ? rowTotalEx + paymentFees
                  : (rowTotalEx + paymentFees) * (1 + itemTaxRate(item));

                return (
                  <TableRow key={index}>
                    <TableCell sx={tdSx}>
                      <Box
                        component="a"
                        onClick={() => handleProductClick(item)}
                        sx={{ color: '#000', textDecoration: 'none', cursor: 'pointer' }}
                      >
                        {item.product}
                      </Box>
                    </TableCell>
                    <TableCell sx={tdSx}>{item.supplierCode || '-'}</TableCell>
                    <TableCell sx={tdSx} align="right">{caseQuantity}</TableCell>
                    <TableCell sx={tdSx} align="right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell sx={tdSx} align="right">{renderQty(orderedCases, orderedItems)}</TableCell>
                    <TableCell sx={tdSx} align="right">{formatCurrency(orderedTotals.totalEx)}</TableCell>
                    <TableCell sx={tdSx} align="right">{formatCurrency(orderedTotals.totalInc)}</TableCell>
                    <TableCell sx={tdSx} align="right">{renderQty(receivedCases, receivedItems)}</TableCell>
                    {showFeeColumns && (
                      <>
                        <TableCell sx={tdSx} align="right">{formatCurrency(fees)}</TableCell>
                        <TableCell sx={tdSx} align="right">{formatCurrency(freight)}</TableCell>
                        <TableCell sx={tdSx} align="right">{formatCurrency(rebate)}</TableCell>
                        <TableCell sx={tdSx} align="right">{formatCurrency(paymentFees)}</TableCell>
                      </>
                    )}
                    <TableCell sx={tdSx} align="right">{formatCurrency(rowTotalEx)}</TableCell>
                    <TableCell sx={tdSx} align="right">{formatCurrency(rowTotalInc)}</TableCell>
                  </TableRow>
                );
              })}

              {/* Footer Total Row */}
              <TableRow>
                <TableCell sx={totalTdSx}>Total</TableCell>
                <TableCell sx={totalTdSx}>
                  {totalLines} line{totalLines !== 1 ? 's' : ''}
                </TableCell>
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} align="right">{renderQty(totalCases, totalItems, true)}</TableCell>
                <TableCell sx={totalTdSx} align="right">{formatCurrency(orderedTotalEx)}</TableCell>
                <TableCell sx={totalTdSx} align="right">{formatCurrency(orderedTotalInc)}</TableCell>
                <TableCell sx={totalTdSx} align="right">{renderQty(receivedTotalCases, receivedTotalItems, true)}</TableCell>
                {showFeeColumns && (
                  <>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        return formatCurrency(purchase?.fees || 0);
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        // Sum charged line freight (purchase.freight records freight
                        // even when it's included in line costs and not charged)
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        const totalFreight = purchase?.items?.reduce((sum, item) => sum + (item.freight || 0), 0) || 0;
                        return formatCurrency(totalFreight);
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        const totalRebate = purchase?.items?.reduce((sum, item) => sum + (item.rebate || 0), 0) || 0;
                        return formatCurrency(totalRebate);
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        return formatCurrency(purchase?.paymentFees || 0);
                      })()}
                    </TableCell>
                  </>
                )}
                <TableCell sx={totalTdSx} align="right">
                  {(() => {
                    const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                    if (purchase) {
                      // Total (ex) = cost + fees + charged freight - rebate (NO payment fees)
                      const chargedFreight = purchase.items?.reduce((sum, item) => sum + (item.freight || 0), 0) || 0;
                      const totalEx = (purchase.cost || 0) + (purchase.fees || 0) + chargedFreight - (purchase.items?.reduce((sum, item) => sum + (item.rebate || 0), 0) || 0);
                      return formatCurrency(totalEx);
                    }
                    return formatCurrency(receivedTotalEx);
                  })()}
                </TableCell>
                <TableCell sx={totalTdSx} align="right">
                  {(() => {
                    const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                    return formatCurrency(purchase?.totalAmount || receivedTotalInc);
                  })()}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          )}
        </TableContainer>
      </Paper>

      {/* Email Order Dialog - large square-cornered composer (reference style) */}
      <Dialog
        open={emailOrderDialogOpen}
        onClose={() => !saving && setEmailOrderDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
            minHeight: 570,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
          },
        }}
        sx={{ '& .MuiBackdrop-root': { backgroundColor: 'rgba(0,0,0,0.5)' } }}
      >
        <DialogContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, minWidth: 64 }}>To:</Typography>
            <TextField
              fullWidth
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              placeholder="Recipient email address"
              size="small"
              variant="outlined"
            />
          </Box>
          <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography sx={{ fontSize: 16, minWidth: 64 }}>Subject:</Typography>
            <TextField
              fullWidth
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              size="small"
              variant="outlined"
            />
          </Box>
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 280 }}>
            <Paper variant="outlined" sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 0.25,
                  p: 0.5,
                  borderBottom: '1px solid #e0e0e0',
                  backgroundColor: '#fafafa',
                }}
              >
                <Tooltip title="Bold"><IconButton size="small" onClick={() => execEditorCommand('bold')}><FormatBold fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Italic"><IconButton size="small" onClick={() => execEditorCommand('italic')}><FormatItalic fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Underline"><IconButton size="small" onClick={() => execEditorCommand('underline')}><FormatUnderlined fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Strikethrough"><IconButton size="small" onClick={() => execEditorCommand('strikeThrough')}><StrikethroughS fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Code"><IconButton size="small" onClick={() => execEditorCommand('formatBlock', '<pre>')}><CodeIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Superscript"><IconButton size="small" onClick={() => execEditorCommand('superscript')}><SuperscriptIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Subscript"><IconButton size="small" onClick={() => execEditorCommand('subscript')}><SubscriptIcon fontSize="small" /></IconButton></Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Box
                  component="select"
                  aria-label="Paragraph style"
                  defaultValue="<p>"
                  onChange={(e) => execEditorCommand('formatBlock', e.target.value)}
                  sx={{ height: 28, border: '1px solid #e0e0e0', borderRadius: '2px', backgroundColor: '#fff', fontSize: 13, px: 0.5 }}
                >
                  <option value="<p>">Normal</option>
                  <option value="<h1>">Heading 1</option>
                  <option value="<h2>">Heading 2</option>
                  <option value="<h3>">Heading 3</option>
                  <option value="<h4>">Heading 4</option>
                  <option value="<blockquote>">Quote</option>
                </Box>
                <Box
                  component="select"
                  aria-label="Font size"
                  defaultValue="3"
                  onChange={(e) => execEditorCommand('fontSize', e.target.value)}
                  sx={{ height: 28, border: '1px solid #e0e0e0', borderRadius: '2px', backgroundColor: '#fff', fontSize: 13, px: 0.5 }}
                >
                  <option value="1">10</option>
                  <option value="2">13</option>
                  <option value="3">16</option>
                  <option value="4">18</option>
                  <option value="5">24</option>
                  <option value="6">32</option>
                  <option value="7">48</option>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Bullet list"><IconButton size="small" onClick={() => execEditorCommand('insertUnorderedList')}><FormatListBulleted fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Numbered list"><IconButton size="small" onClick={() => execEditorCommand('insertOrderedList')}><FormatListNumbered fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Increase indent"><IconButton size="small" onClick={() => execEditorCommand('indent')}><FormatIndentIncrease fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Decrease indent"><IconButton size="small" onClick={() => execEditorCommand('outdent')}><FormatIndentDecrease fontSize="small" /></IconButton></Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Align left"><IconButton size="small" onClick={() => execEditorCommand('justifyLeft')}><FormatAlignLeft fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Align center"><IconButton size="small" onClick={() => execEditorCommand('justifyCenter')}><FormatAlignCenter fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Align right"><IconButton size="small" onClick={() => execEditorCommand('justifyRight')}><FormatAlignRight fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Justify"><IconButton size="small" onClick={() => execEditorCommand('justifyFull')}><FormatAlignJustify fontSize="small" /></IconButton></Tooltip>
                <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                <Tooltip title="Text colour"><IconButton size="small" onClick={async () => { const c = await prompt('Enter colour (e.g. #e33430):', '#000000', { title: 'Text colour' }); if (c) execEditorCommand('foreColor', c); }}><TextColorIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Insert link"><IconButton size="small" onClick={async () => { const url = await prompt('Enter URL:', 'https://', { title: 'Insert link', confirmText: 'Insert link' }); if (url) execEditorCommand('createLink', url); }}><LinkIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Remove link"><IconButton size="small" onClick={() => execEditorCommand('unlink')}><UnlinkIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Insert image"><IconButton size="small" onClick={async () => { const url = await prompt('Enter image URL:', 'https://', { title: 'Insert image', confirmText: 'Insert image' }); if (url) execEditorCommand('insertImage', url); }}><ImageIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Undo"><IconButton size="small" onClick={() => execEditorCommand('undo')}><UndoIcon fontSize="small" /></IconButton></Tooltip>
                <Tooltip title="Redo"><IconButton size="small" onClick={() => execEditorCommand('redo')}><RedoIcon fontSize="small" /></IconButton></Tooltip>
              </Box>
              <Box
                ref={emailBodyRef}
                component="div"
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Use [order-table] to insert order details"
                sx={{
                  flex: 1,
                  p: 2,
                  overflow: 'auto',
                  minHeight: 200,
                  fontSize: 16,
                  outline: 'none',
                  '&:empty:before': {
                    content: 'attr(data-placeholder)',
                    color: '#999',
                  },
                }}
              />
            </Paper>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, borderTop: '1px solid #e0e0e0', justifyContent: 'space-between' }}>
          <Button
            onClick={() => setEmailOrderDialogOpen(false)}
            disabled={saving}
            variant="outlined"
            startIcon={<CancelIcon />}
            sx={{ textTransform: 'none', color: '#676b72', borderColor: '#bdbdbd', '&:hover': { borderColor: '#bdbdbd', backgroundColor: 'transparent' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSendOrderEmail}
            variant="contained"
            disableElevation
            disabled={saving}
            sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', minWidth: 100, boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
          >
            {saving ? 'Sending...' : 'Send'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Review Dialog - reviewer multi-select combobox (reference style) */}
      <ReviewerSelectDialog
        open={reviewDialogOpen}
        onClose={() => setReviewDialogOpen(false)}
        users={reviewUsers}
        onConfirm={handleConfirmReview}
        saving={saving}
        confirmLabel="Create Review"
      />

      {/* Edit Details Dialog (reference layout, same as EditOrder's) */}
      <Dialog
        open={editDetailsOpen}
        onClose={() => !saving && setEditDetailsOpen(false)}
        maxWidth={false}
        PaperProps={{ sx: { borderRadius: 0, width: 660, maxWidth: '95vw', overflowY: 'visible' } }}
      >
        <Box sx={{ position: 'relative', pt: 5 }}>
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
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, color: '#676b72', textTransform: 'uppercase' }}>From</Typography>
                <Typography sx={{ fontWeight: 500 }}>{fromDisplay}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography sx={{ fontSize: 12, color: '#676b72', textTransform: 'uppercase' }}>To</Typography>
                <Typography sx={{ fontWeight: 500 }}>{toDisplay}</Typography>
              </Grid>
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
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Order / Invoice Number"
                  value={editFormData.orderNumber}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, orderNumber: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <OrderIcon sx={{ color: '#666', mr: 1 }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
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
              <Grid item xs={6}>
                <TextField
                  fullWidth
                  label="Internal Reference"
                  value={editFormData.internalReference}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, internalReference: e.target.value }))}
                />
              </Grid>
              {(order.type === 'ORDER' || order.type === 'INVOICE') && (
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Expected Total"
                    value={editFormData.expectedTotal}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, expectedTotal: e.target.value }))}
                    InputProps={{
                      startAdornment: <InputAdornment position="start">$</InputAdornment>,
                    }}
                  />
                </Grid>
              )}
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
          <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
            <Button
              onClick={() => setEditDetailsOpen(false)}
              disabled={saving}
              variant="outlined"
              sx={{ textTransform: 'none', color: '#676b72', borderColor: '#bdbdbd', '&:hover': { borderColor: '#bdbdbd', backgroundColor: 'transparent' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEditDetails}
              disabled={saving}
              variant="contained"
              disableElevation
              startIcon={<SaveIcon />}
              sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', minWidth: 100, boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Generic confirm dialog (Return Items / Reorder Items / Cancel) */}
      <Dialog
        open={Boolean(confirmDialog)}
        onClose={() => !saving && setConfirmDialog(null)}
        fullWidth
        PaperProps={{ sx: { borderRadius: 0, maxWidth: 560 } }}
      >
        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Avatar sx={{ bgcolor: '#313439', width: 64, height: 64 }}>
              <ReturnIcon sx={{ color: '#f8f8f8' }} />
            </Avatar>
          </Box>
          <Typography sx={{ textAlign: 'center', fontWeight: 700, fontSize: 22, mb: 1 }}>
            {confirmDialog?.title}
          </Typography>
          <Typography sx={{ textAlign: 'center', fontSize: 16 }}>
            {confirmDialog?.message}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
          <Button
            onClick={() => setConfirmDialog(null)}
            disabled={saving}
            variant="outlined"
            sx={{ textTransform: 'none', color: '#676b72', borderColor: '#bdbdbd', '&:hover': { borderColor: '#bdbdbd', backgroundColor: 'transparent' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmDialog?.onConfirm}
            disabled={saving}
            variant="contained"
            disableElevation
            sx={{ textTransform: 'none', backgroundColor: '#5ebbeb', minWidth: 100, boxShadow: 'none', '&:hover': { backgroundColor: '#5ebbeb', boxShadow: 'none' } }}
          >
            {saving ? 'Working...' : confirmDialog?.label}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default OrderDetails;
