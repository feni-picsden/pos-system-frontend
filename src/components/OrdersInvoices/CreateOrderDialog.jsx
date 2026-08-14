import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Check as CheckIcon,
  Business as SupplierIcon,
  Person as CustomerIcon,
  CalendarToday as DateIcon,
  Receipt as OrderIcon,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import supplierService from '../../services/supplierService';
import customerService from '../../services/customerService';
import orderInvoiceService from '../../services/orderInvoiceService';
import { useAuth } from '../../contexts/AuthContext';

const CreateOrderDialog = ({ open, onClose, onSave, editingOrder = null }) => {
  const { user, getOutletName } = useAuth();
  const [formData, setFormData] = useState({
    from: 'all',
    to: '',
    orderDate: new Date(),
    orderNumber: '',
    dueDate: null,
    internalReference: '',
    publicNotes: '',
    internalNotes: '',
    generateStockFrom: 'none',
    items: []
  });

  const [suppliers, setSuppliers] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [orderNumberGenerated, setOrderNumberGenerated] = useState(false);

  useEffect(() => {
    if (open) {
      loadSuppliers();
      loadCustomers();
      if (!editingOrder) {
        generateOrderNumber();
      }
    }
  }, [open, editingOrder]);

  useEffect(() => {
    if (editingOrder) {
      setFormData({
        from: editingOrder.from || 'all',
        to: editingOrder.to || '',
        orderDate: editingOrder.orderDate ? new Date(editingOrder.orderDate) : new Date(),
        orderNumber: editingOrder.orderNumber || '',
        dueDate: editingOrder.dueDate ? new Date(editingOrder.dueDate) : null,
        internalReference: editingOrder.internalReference || '',
        publicNotes: editingOrder.publicNotes || '',
        internalNotes: editingOrder.internalNotes || '',
        generateStockFrom: editingOrder.generateStockFrom || 'none',
        items: editingOrder.items || []
      });
      setOrderNumberGenerated(true);
    }
  }, [editingOrder]);

  const loadSuppliers = async () => {
    try {
      const response = await supplierService.getSuppliers();
      setSuppliers(response.suppliers || []);
    } catch (err) {
      console.error('Error loading suppliers:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = await customerService.getCustomers();
      const activeCustomers = (response.customers || []).filter(customer => customer.isActive);
      setCustomers(activeCustomers);
    } catch (err) {
      console.error('Error loading customers:', err);
    }
  };

  const generateOrderNumber = async () => {
    try {
      setLoading(true);
      const response = await orderInvoiceService.generateOrderNumber();
      setFormData(prev => ({
        ...prev,
        orderNumber: response.orderNumber
      }));
      setOrderNumberGenerated(true);
    } catch (err) {
      console.error('Error generating order number:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddItem = () => {
    const newItem = {
      id: Date.now(),
      product: '',
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    };
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, newItem]
    }));
  };

  const handleRemoveItem = (itemId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== itemId)
    }));
  };

  const handleItemChange = (itemId, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item => {
        if (item.id === itemId) {
          const updatedItem = { ...item, [field]: value };
          if (field === 'quantity' || field === 'unitPrice') {
            updatedItem.total = updatedItem.quantity * updatedItem.unitPrice;
          }
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const calculateTotal = () => {
    return formData.items.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');

      const orderData = {
        ...formData,
        totalAmount: calculateTotal(),
        type: 'ORDER',
        status: 'PENDING'
      };

      if (editingOrder) {
        await orderInvoiceService.updateOrderInvoice(editingOrder.id, orderData);
      } else {
        await orderInvoiceService.createOrderInvoice(orderData);
      }

      onSave();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save order');
      console.error('Error saving order:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({
      from: 'all',
      to: '',
      orderDate: new Date(),
      orderNumber: '',
      dueDate: null,
      internalReference: '',
      publicNotes: '',
      internalNotes: '',
      generateStockFrom: 'none',
      items: []
    });
    setError('');
    setOrderNumberGenerated(false);
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          minHeight: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ 
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f5f5f5',
        fontWeight: 'bold',
        fontSize: '1.5rem'
      }}>
        {editingOrder ? 'Edit Order' : 'Create Order'}
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* From Field */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>From</InputLabel>
              <Select
                value={formData.from}
                onChange={(e) => handleInputChange('from', e.target.value)}
                startAdornment={<SupplierIcon sx={{ mr: 1, color: '#666' }} />}
              >
                <MenuItem value="all">All Suppliers</MenuItem>
                {suppliers.map((supplier) => (
                  <MenuItem key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* To Field */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>To</InputLabel>
              <Select
                value={formData.to}
                onChange={(e) => handleInputChange('to', e.target.value)}
                startAdornment={<CustomerIcon sx={{ mr: 1, color: '#666' }} />}
                disabled
                sx={{ backgroundColor: '#f5f5f5' }}
              >
                <MenuItem value="">{user?.isSuperAdmin ? 'Global' : (getOutletName() || 'N/A')}</MenuItem>
                {customers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {`${customer.firstName} ${customer.lastName}`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Order Date */}
          <Grid item xs={12} md={6}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Order Date"
                value={formData.orderDate}
                onChange={(newValue) => handleInputChange('orderDate', newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: <DateIcon sx={{ mr: 1, color: '#666' }} />
                    }}
                  />
                )}
              />
            </LocalizationProvider>
          </Grid>

          {/* Order Number */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Order Number"
              value={formData.orderNumber}
              onChange={(e) => handleInputChange('orderNumber', e.target.value)}
              InputProps={{
                endAdornment: orderNumberGenerated && (
                  <CheckIcon sx={{ color: '#4caf50' }} />
                ),
                startAdornment: <OrderIcon sx={{ mr: 1, color: '#666' }} />
              }}
              disabled={loading}
            />
          </Grid>

          {/* Due Date */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Due Date</InputLabel>
              <Select
                value={formData.dueDate ? 'custom' : 'none'}
                onChange={(e) => handleInputChange('dueDate', e.target.value === 'none' ? null : new Date())}
                startAdornment={<DateIcon sx={{ mr: 1, color: '#666' }} />}
              >
                <MenuItem value="none">No Due Date</MenuItem>
                <MenuItem value="custom">Custom Date</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Generate Stock From */}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>Generate Stock From</InputLabel>
              <Select
                value={formData.generateStockFrom}
                onChange={(e) => handleInputChange('generateStockFrom', e.target.value)}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="supplier">Supplier</MenuItem>
                <MenuItem value="category">Category</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          {/* Internal Reference */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Internal Reference"
              placeholder="Internal Reference"
              value={formData.internalReference}
              onChange={(e) => handleInputChange('internalReference', e.target.value)}
            />
          </Grid>

          {/* Public Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Public Notes"
              placeholder="Public Notes"
              value={formData.publicNotes}
              onChange={(e) => handleInputChange('publicNotes', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>

          {/* Internal Notes */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Internal Notes"
              placeholder="Internal Notes"
              value={formData.internalNotes}
              onChange={(e) => handleInputChange('internalNotes', e.target.value)}
              multiline
              rows={3}
            />
          </Grid>
        </Grid>

        {/* Order Items Table */}
        <Box sx={{ mt: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              Order Items
            </Typography>
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={handleAddItem}
              sx={{ borderRadius: 1 }}
            >
              Add Item
            </Button>
          </Box>

          <TableContainer component={Paper} sx={{ borderRadius: 1 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Product</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Quantity</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Unit Price</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Total</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.product}
                        onChange={(e) => handleItemChange(item.id, 'product', e.target.value)}
                        placeholder="Product name"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        value={item.description}
                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                        placeholder="Description"
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small"
                        type="number"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        inputProps={{ min: 0, step: 0.01 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        ${(item.total || 0).toFixed(2)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => handleRemoveItem(item.id)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {formData.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                      <Typography color="text.secondary">
                        No items added. Click "Add Item" to start.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Total */}
          {formData.items.length > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
              <Chip
                label={`Total: $${calculateTotal().toFixed(2)}`}
                color="primary"
                sx={{ fontSize: '1.1rem', fontWeight: 'bold' }}
              />
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #e0e0e0' }}>
        <Button onClick={handleClose} sx={{ mr: 1 }}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !formData.orderNumber}
          sx={{
            backgroundColor: 'rgb(94, 187, 235)',
            '&:hover': {
              backgroundColor: 'rgb(79, 172, 220)'
            }
          }}
        >
          {saving ? null : (editingOrder ? 'Update' : 'Create')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateOrderDialog;
