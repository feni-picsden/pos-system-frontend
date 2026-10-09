import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import { formatDate as formatAppDate, formatDateTime as formatAppDateTime } from '../../utils/appDateTime';
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
  MenuItem,
  CircularProgress,
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
import { useParams, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import orderInvoiceService from '../../services/orderInvoiceService';
import supplierService from '../../services/supplierService';
import { resolveAssetUrl } from '../../services/apiClient';
import { outletService } from '../../services/outletService';
import { userService } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { canReceiveTransfer } from '../../utils/transferReceive';
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

// Edit Details Save (reference): blue stays blue on hover (darker), white text;
// while saving it is disabled and shows a spinner + "Saving...".
const sfDialogSave = {
  backgroundColor: '#5ebbeb',
  color: '#fff',
  height: 42,
  minWidth: 100,
  borderRadius: 0,
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  px: 3,
  whiteSpace: 'nowrap',
  transition: 'background 0.2s ease',
  '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { backgroundColor: '#5ebbeb', color: '#fff', opacity: 0.7 },
};

const OrderDetails = () => {
  // In-app dialog — shadows window.prompt on purpose.
  const { prompt, confirm, alert } = useAppDialogs();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by the notification panel: re-read the document even if this page was
  // already open, and bypass the GET cache so the copy is the current one.
  const refreshToken = location.state?.refresh || null;
  const { user, getOutletName, isTrueSuperAdmin } = useAuth();
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
    from: 'all',
    orderDate: null,
    orderNumber: '',
    dueDate: null,
    internalReference: '',
    expectedTotal: '',
    publicNotes: '',
    internalNotes: '',
  });
  // Edit Details lets the supplier be corrected (reference), so the dropdown
  // needs the supplier list - same source as Create Order.
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
    supplierService
      .getSuppliers()
      .then((res) => setSuppliers(res?.suppliers || []))
      .catch(() => setSuppliers([]));
  }, []);
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
    loadOrder({ fresh: Boolean(refreshToken) });
    loadUserOutlet();
    // Load once per order/user (and again on a notification click); the
    // loaders read fresh state when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user, refreshToken]);

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

  const loadOrder = async ({ fresh = false } = {}) => {
    try {
      setLoading(true);
      const response = await orderInvoiceService.getOrderInvoice(id, { fresh });
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

  // Incoming transfer: one-shot receive of everything the source sent (the
  // backend credits exactly what left the sending outlet). Same call as the
  // notification bell's "Receive Stock".
  const [receivingTransfer, setReceivingTransfer] = useState(false);
  const handleReceiveTransfer = async () => {
    if (!(await confirm(
      `Receive transfer ${order.orderNumber}? The stock is added to ${order.toOutlet?.name || 'the destination outlet'}.`,
      { title: 'Receive transfer', confirmText: 'Receive' }
    ))) {
      return;
    }
    setReceivingTransfer(true);
    try {
      await orderInvoiceService.receiveTransfer(order.id);
      await loadOrder({ fresh: true });
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to receive transfer', 'error');
    } finally {
      setReceivingTransfer(false);
    }
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
  // Only an open purchase document may change supplier: a received one already
  // wrote its purchase record and product costs against the current supplier.
  const supplierEditable = ['ORDER', 'INVOICE'].includes(order?.type)
    && !['RECEIVED', 'CANCELLED', 'APPLIED'].includes(String(order?.status || '').toUpperCase());
  const editFromOptions = (() => {
    if (!['ORDER', 'INVOICE'].includes(order?.type)) {
      return [{ value: String(order?.from ?? ''), label: fromDisplay || String(order?.from ?? '') }];
    }
    const options = [
      { value: 'all', label: 'All Suppliers' },
      ...suppliers.map((sup) => ({ value: String(sup.id), label: sup.name })),
    ];
    const current = String(editFormData.from ?? order?.from ?? 'all');
    if (!options.some((o) => o.value === current)) {
      options.push({ value: current, label: fromDisplay || current });
    }
    return options;
  })();

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
    // Sending an unsent transfer moves its stock first (same call as the edit page's
    // Save & Send); the email goes out only once the stock has left. Emailing alone
    // used to mark it SENT with nothing deducted, so the destination received nothing.
    const sendsTransfer = order?.type === 'TRANSFER' && ['PENDING', 'OPEN'].includes(order?.status);
    if (sendsTransfer) {
      try {
        setSaving(true);
        await orderInvoiceService.sendTransfer(id);
      } catch (err) {
        setSaving(false);
        setSnackbar({ open: true, message: err.response?.data?.error || 'Failed to send transfer.', severity: 'error' });
        return;
      }
    }
    try {
      setSaving(true);
      await orderInvoiceService.sendOrderEmail(id, {
        to: emailTo.trim(),
        subject: emailSubject.trim(),
        body: bodyHtml,
      });
      setEmailOrderDialogOpen(false);
      setSnackbar({
        open: true,
        message: sendsTransfer ? 'Transfer sent and email sent successfully.' : 'Order email sent successfully.',
        severity: 'success',
      });
    } catch (err) {
      setSnackbar({
        open: true,
        message: sendsTransfer
          ? `Transfer sent, but the email failed: ${err.response?.data?.error || 'unknown error'}`
          : err.response?.data?.error || 'Failed to send order email.',
        severity: 'error',
      });
    } finally {
      setSaving(false);
      // The transfer is SENT now either way; reload so a retried email does not
      // try to send the stock a second time.
      if (sendsTransfer) await loadOrder({ fresh: true });
    }
  };

  const handleOpenEditDetails = () => {
    if (!order) return;
    setEditFormData({
      from: String(order.from ?? 'all'),
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
        from: editFormData.from ?? order.from,
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
      // Reference dialog is a plain confirm (Base cost); the Base + Fees +
      // Freight choice lives on the Return Stock form's "Return Cost" field.
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

  // dd/mm/yyyy and dd/mm/yyyy HH:mm:ss in Setup > General > Timezone
  // (utils/appDateTime) - the reference format, '06/07/2026 19:57:23'.
  const formatDate = formatAppDate;
  const formatDateTime = formatAppDateTime;

  // Case quantity per line, returned by the API (product join); legacy rows default to 1
  const getCaseQuantity = (item) => item?.caseQuantity || 1;

  // Per-line tax rate: the product's configured purchase tax % (returned by the
  // API); transfers are internal stock movements so no tax. Legacy rows without
  // the field keep the old 10% assumption.
  const itemTaxRate = (item) =>
    order?.type === 'TRANSFER' ? 0 : (item?.taxRatePercent ?? 10) / 100;

  // Freight flag. A received document shows the flag snapshotted on it at receive
  // time (history must not change when the supplier's setting changes later);
  // an unreceived one previews the supplier's current default.
  //
  // ONE meaning everywhere (order screen, details, print, email): "is freight
  // already inside the line costs on the supplier's invoice?" - the same rule
  // receive() applies. It used to turn "Yes" whenever any freight amount was
  // charged, which is the opposite case (freight billed separately on top), so
  // a pending "No" flipped to "Yes" once the order was received.
  const includesFreight = Boolean(
    order?.status === 'RECEIVED'
      ? order?.freightIncluded
      : (order?.freightIncluded || (order?.invoiceFreight == null && order?.supplier?.freightIncludedOnInvoices))
  );

  // Helper to calculate cases and items from quantity
  const calculateCasesAndItems = (quantity, caseQuantity = 1) => {
    const cases = Math.floor(quantity / caseQuantity);
    const items = quantity % caseQuantity;
    return { cases, items };
  };

  // Helper to calculate totals with tax
  // Ordered totals. When "Costs on supplier invoice is inclusive of tax" is on,
  // the entered cost already contains its tax, so inc == ex (receive backs the
  // tax out instead of adding it; the columns used to show 143.00 beside a
  // received Total (inc) of 130.00).
  //
  // (ex) is ALWAYS the tax-exclusive figure and (inc) the tax-inclusive one, so
  // inc = ex x (1 + rate) on every row - as the reference shows. On a
  // tax-inclusive document the entered value is the (inc) figure and the tax
  // has to be taken OUT to get (ex); this used to put the entered value in both
  // columns ($24.00 / $24.00 on a 10% GST line instead of $21.82 / $24.00).
  const calculateTotals = (quantity, unitPrice, taxRate = 0.1) => {
    const entered = quantity * unitPrice;
    const totalEx = order?.costsIncludeTax ? entered / (1 + taxRate) : entered;
    const totalInc = order?.costsIncludeTax ? entered : entered * (1 + taxRate);
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

  const totalLines = order.items?.length || 0;
  // Toolbar/table gating (reference matrix)
  const isUnsent = order.status === 'PENDING' || order.status === 'OPEN';
  const isCreditNote = order.type === 'CREDIT_NOTE';
  // Our credit note is an AMOUNT against a supplier, with no product lines. The
  // page used to add up the (empty) lines and show a $0.00 total for a $1.00
  // note (QA row 62) - the amount is the document's own totalAmount.
  const creditAmount = Number(order.totalAmount) || 0;
  const amountOnlyCredit = isCreditNote && totalLines === 0;
  const isOrderOrInvoice = order.type === 'ORDER' || order.type === 'INVOICE';
  // Unsent orders/invoices show the simplified reference column set
  const simpleTable = isOrderOrInvoice && isUnsent;

  // Not received yet: the server sends what this document will come to once
  // invoice fees / freight / discount and the supplier's payment fee are
  // applied (same maths as receive). Reference parity: the view page of an
  // unreceived order carries those amounts INSIDE each line's Total (ex/inc)
  // and shows the sum as EXPECTED TOTAL in the header - it used to add up the
  // product lines only ($24.00 here, $29.48 on the edit screen and at receive).
  const landedPreview = isOrderOrInvoice && order.status !== 'RECEIVED' ? (order.landedPreview || null) : null;
  const landedLineFor = (item) => landedPreview?.lines?.find((l) => l.key === item.id) || null;

  // One row's money, used by the rows AND the footer so they cannot disagree.
  // Reference (received ALM order, payment fee 1.56%, costs including tax):
  //   Total (inc) = cost + fees + freight - rebate, as invoiced
  //   Total (ex)  = Total (inc) with the tax taken out   (inc = ex x 1.10)
  //   Payment Fees = its own column, NOT part of Total (ex) or Total (inc)
  //   header EXPECTED TOTAL = Total (inc);  the list total = Total (inc) + payment fees
  // Ours used to leave the tax in Total (ex) on a tax-inclusive document and add
  // the payment fee into Total (inc), so ex and inc differed by the payment fee
  // instead of by the tax ($29.00 / $29.48 where it should read $26.36 / $29.00).
  const receivedPurchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
  const rowFigures = (item) => {
    const purchaseItem = receivedPurchase?.items?.find((pi) => pi.productName === item.product) || null;
    // Received: what the Purchase record posted. Not received yet: the landed
    // preview, so a pending/sent order shows the totals it will receive at.
    const landedLine = purchaseItem ? null : landedLineFor(item);
    const baseCost = purchaseItem?.cost || (item.unitPrice * item.quantity);
    const fees = purchaseItem ? (purchaseItem.fees || 0) : (landedLine?.fees || 0);
    const freight = purchaseItem ? (purchaseItem.freight || 0) : (landedLine?.freight || 0);
    const rebate = purchaseItem ? (purchaseItem.rebate || 0) : (landedLine?.discount || 0);
    const paymentFees = purchaseItem ? (purchaseItem.paymentFees || 0) : (landedLine?.paymentFees || 0);
    const rate = itemTaxRate(item);
    // Fees/discount and freight carry the supplier's Fees Tax / Freight Tax.
    const feesTaxRate = (order.feesTaxPercent ?? 0) / 100;
    const freightTaxRate = (order.freightTaxPercent ?? 0) / 100;
    const net = fees - rebate;
    const entered = baseCost + net + freight;
    const totalEx = order.costsIncludeTax
      ? baseCost / (1 + rate) + net / (1 + feesTaxRate) + freight / (1 + freightTaxRate)
      : entered;
    const totalInc = order.costsIncludeTax
      ? entered
      : entered + baseCost * rate + net * feesTaxRate + freight * freightTaxRate;
    return { purchaseItem, baseCost, fees, freight, rebate, paymentFees, totalEx, totalInc };
  };
  const tableTotals = (order.items || []).reduce((sum, item) => {
    const r = rowFigures(item);
    return { ex: sum.ex + r.totalEx, inc: sum.inc + r.totalInc };
  }, { ex: 0, inc: 0 });

  // Header "Expected Total": the figure typed in Edit Details wins; otherwise
  // the table's Total (inc) - what the supplier's invoice comes to (reference).
  const expectedTotalDisplay = order.expectedTotal != null ? order.expectedTotal : tableTotals.inc;
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
        {/* Receive an incoming (SENT) transfer at its destination outlet */}
        {canReceiveTransfer(order, user, isTrueSuperAdmin()) && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<ReceiveIcon />}
            onClick={handleReceiveTransfer}
            disabled={receivingTransfer}
            sx={toolbarBtnSx}
          >
            {receivingTransfer ? 'Receiving…' : 'Receive'}
          </Button>
        )}
        {/* Edit: unsent documents open the edit page */}
        {isUnsent && !isCreditNote && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<PencilIcon />}
            component={RouterLink} to={`/orders-invoices/${id}/edit`}
            sx={toolbarBtnSx}
          >
            Edit
          </Button>
        )}
        {/* Send: unsent documents — opens the email composer (send-email marks SENT;
            a transfer's stock moves first, see handleSendOrderEmail). */}
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
        {/* View Review: any document that has a review, including received ones.
            Reference ("Accessing Existing Reviews"): historical reviews are shown
            on the order view page. Create Review stays limited to unsent docs and
            sent orders/invoices/transfers (not sent returns). */}
        {!isCreditNote && order.reviewStatus && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<PencilIcon />}
            component={RouterLink} to={`/orders-invoices/${id}/review`}
            sx={toolbarBtnSx}
          >
            View Review
          </Button>
        )}
        {!isCreditNote && !order.reviewStatus && (isUnsent || (order.status === 'SENT' && order.type !== 'RETURN')) && (
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
          // Reference header: EXPECTED TOTAL sits right after CREATED AT
          ...(isOrderOrInvoice && expectedTotalDisplay != null
            ? [['Expected Total', formatCurrency(expectedTotalDisplay)]]
            : []),
          ...(isCreditNote ? [['Credit Amount', formatCurrency(creditAmount)]] : []),
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
                href={resolveAssetUrl(att.url)}
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
          {amountOnlyCredit ? (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={thSx}>Description</TableCell>
                <TableCell sx={thSx}>Supplier</TableCell>
                <TableCell sx={thSx}>Linked Invoice</TableCell>
                <TableCell sx={thSx} align="right">Credit Amount</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow>
                <TableCell sx={tdSx}>Credit note {order.orderNumber}</TableCell>
                <TableCell sx={tdSx}>{order.supplier?.name || '-'}</TableCell>
                <TableCell sx={tdSx}>{order.linkedInvoice?.orderNumber || '-'}</TableCell>
                <TableCell sx={tdSx} align="right">{formatCurrency(creditAmount)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell sx={totalTdSx}>Total</TableCell>
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} />
                <TableCell sx={totalTdSx} align="right">{formatCurrency(creditAmount)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          ) : simpleTable ? (
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
                    {/* Line value + its share of fees / freight / discount, tax inclusive */}
                    <TableCell sx={tdSx} align="right">{formatCurrency(rowFigures(item).totalInc)}</TableCell>
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
                <TableCell sx={totalTdSx} align="right">{formatCurrency(tableTotals.inc)}</TableCell>
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

                // Money for this row - see rowFigures (shared with the footer).
                const {
                  fees, freight, rebate, paymentFees, totalEx: rowTotalEx, totalInc: rowTotalInc,
                } = rowFigures(item);

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
                        return formatCurrency(purchase ? (purchase.fees || 0) : (landedPreview?.fees || 0));
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        // Sum charged line freight (purchase.freight records freight
                        // even when it's included in line costs and not charged)
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        const totalFreight = purchase?.items?.reduce((sum, item) => sum + (item.freight || 0), 0) || 0;
                        return formatCurrency(purchase ? totalFreight : (landedPreview?.freight || 0));
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        const totalRebate = purchase?.items?.reduce((sum, item) => sum + (item.rebate || 0), 0) || 0;
                        return formatCurrency(purchase ? totalRebate : (landedPreview?.discount || 0));
                      })()}
                    </TableCell>
                    <TableCell sx={totalTdSx} align="right">
                      {(() => {
                        const purchase = order.purchases && order.purchases.length > 0 ? order.purchases[0] : null;
                        return formatCurrency(purchase ? (purchase.paymentFees || 0) : (landedPreview?.paymentFees || 0));
                      })()}
                    </TableCell>
                  </>
                )}
                {/* The rows above, added up: ex-tax and inc-tax (payment fees have their own column) */}
                <TableCell sx={totalTdSx} align="right">{formatCurrency(tableTotals.ex)}</TableCell>
                <TableCell sx={totalTdSx} align="right">{formatCurrency(tableTotals.inc)}</TableCell>
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
          {/* An unsent transfer's Send moves the stock before the email goes out
              (handleSendOrderEmail) - say so before the user presses it. */}
          {order?.type === 'TRANSFER' && ['PENDING', 'OPEN'].includes(order?.status) && (() => {
            const lines = order.items || [];
            const cases = lines.reduce((s, it) => s + (Number(it.cases) || 0), 0);
            const items = lines.reduce((s, it) => s + (Number(it.items) || 0), 0);
            const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
            return (
              <Alert severity="info" sx={{ mb: 2 }}>
                Sending this transfer moves the stock now: {plural(lines.length, 'line')} · {plural(cases, 'case')} {plural(items, 'item')} leave {supplierSideDisplay} for {outletSideDisplay}, then the email is sent.
              </Alert>
            );
          })()}
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
          <DialogContent sx={{ pt: 1 }}>
            <Grid container spacing={2}>
              {/* From: supplier dropdown (editable until received); To: locked
                  dropdown - reference parity with the Create Order form. */}
              <Grid item xs={6}>
                <TextField
                  select
                  fullWidth
                  label="From"
                  value={String(editFormData.from ?? 'all')}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, from: e.target.value }))}
                  disabled={!supplierEditable}
                >
                  {editFromOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <TextField select fullWidth label="To" value="to" disabled>
                  <MenuItem value="to">{toDisplay}</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Order / Invoice Date"
                    value={editFormData.orderDate}
                    onChange={(newValue) => setEditFormData(prev => ({ ...prev, orderDate: newValue }))}
                    slotProps={{ textField: { fullWidth: true } }}
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
                    slotProps={{ textField: { fullWidth: true } }}
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
              startIcon={saving ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : <SaveIcon />}
              sx={sfDialogSave}
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
