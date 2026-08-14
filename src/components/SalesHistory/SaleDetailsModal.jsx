import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
  Card,
  CardContent,
  Paper
} from '@mui/material';
import {
  Close,
  Print,
  Email,
  Edit,
  PersonAdd,
  Undo,
  Cancel,
  CheckCircle
} from '@mui/icons-material';
import { saleBasePrice } from '../../utils/saleTotals';

const SaleDetailsModal = ({
  open,
  onClose,
  sale,
  onReprintReceipt,
  onEmailReceipt,
  onModifyDetails,
  onAssignCustomer,
  onReturnItems,
  onCancelSale
}) => {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-AU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'CANCELLED':
        return 'error';
      case 'RETURNED':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (!sale) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '80vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h5">Sale Details</Typography>
          <IconButton onClick={onClose}>
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Grid container spacing={3}>
          {/* Left Column - Sale Summary */}
          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Sale Summary
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h4" color="primary">
                    {formatCurrency(sale.totalAmount)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {sale.saleNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDateTime(sale.saleDate)}
                  </Typography>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <CheckCircle color="success" sx={{ mr: 1 }} />
                  <Chip
                    label={sale.status}
                    color={getStatusColor(sale.status)}
                    size="small"
                  />
                </Box>

                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Store:</strong> {sale.outlet?.name || 'Unknown Store'}
                </Typography>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Register:</strong> {sale.registerId || 'Main Register'}
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  <strong>Cashier:</strong> {sale.user?.name || 'Unknown User'}
                </Typography>
              </CardContent>
            </Card>

            {/* Items List */}
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Items
                </Typography>
                <List dense>
                  {sale.items?.map((item, index) => (
                    <ListItem key={index} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="body2">
                              {item.quantity} {item.productName}
                            </Typography>
                            <Typography variant="body2" fontWeight="bold">
                              {formatCurrency(item.totalPrice)}
                            </Typography>
                          </Box>
                        }
                        secondary={item.description}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          {/* Right Column - Price Breakdown and Actions */}
          <Grid item xs={12} md={6}>
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Price Breakdown
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Base Price</Typography>
                    <Typography variant="body2">{formatCurrency(saleBasePrice(sale))}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="success.main">Savings</Typography>
                    <Typography variant="body2" color="success.main">
                      -{formatCurrency(sale.savings)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="error.main">Discount</Typography>
                    <Typography variant="body2" color="error.main">
                      -{formatCurrency(sale.discount)}
                    </Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Tax</Typography>
                    <Typography variant="body2">{formatCurrency(sale.tax)}</Typography>
                  </Box>
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Loyalty Value</Typography>
                    <Typography variant="body2">{sale.loyaltyValue} points</Typography>
                  </Box>
                  
                  <Divider sx={{ my: 1 }} />
                  
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h6">Total</Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(sale.totalAmount)}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" gutterBottom>
                    <strong>Payment Method:</strong> {sale.paymentMethod}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Balance:</strong> {formatCurrency(sale.balance)}
                  </Typography>
                </Box>

                {sale.payments && sale.payments.length > 0 && (
                  <Box>
                    <Typography variant="body2" gutterBottom>
                      <strong>Payment Details:</strong>
                    </Typography>
                    {sale.payments.map((payment, index) => (
                      <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">
                          {payment.paymentMethod}
                        </Typography>
                        <Typography variant="body2">
                          {formatCurrency(payment.amount)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Customer Information */}
            {sale.customer && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Customer Information
                  </Typography>
                  <Typography variant="body2" gutterBottom>
                    <strong>Name:</strong> {sale.customer.firstName} {sale.customer.lastName}
                  </Typography>
                  {sale.customer.company && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Company:</strong> {sale.customer.company}
                    </Typography>
                  )}
                  {sale.customer.phone && (
                    <Typography variant="body2" gutterBottom>
                      <strong>Phone:</strong> {sale.customer.phone}
                    </Typography>
                  )}
                  {sale.customer.emails && sale.customer.emails.length > 0 && (
                    <Typography variant="body2">
                      <strong>Email:</strong> {sale.customer.emails[0]}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {sale.notes && (
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Notes
                  </Typography>
                  <Typography variant="body2">
                    {sale.notes}
                  </Typography>
                </CardContent>
              </Card>
            )}
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={<Print />}
            onClick={onReprintReceipt}
            color="primary"
          >
            Reprint Receipt
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Email />}
            onClick={onEmailReceipt}
          >
            Email Receipt
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Edit />}
            onClick={onModifyDetails}
          >
            Modify Details
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<PersonAdd />}
            onClick={onAssignCustomer}
          >
            Assign Customer
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Undo />}
            onClick={onReturnItems}
            color="warning"
          >
            Return Items
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Cancel />}
            onClick={onCancelSale}
            color="error"
          >
            Cancel Sale
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default SaleDetailsModal;
