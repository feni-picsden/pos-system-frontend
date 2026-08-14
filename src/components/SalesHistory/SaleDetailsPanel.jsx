import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Grid,
  Divider,
  List,
  ListItem,
  ListItemText,
  Chip,
  IconButton,
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

const SaleDetailsPanel = ({
  sale,
  onReprintReceipt,
  onEmailReceipt,
  onModifyDetails,
  onAssignCustomer,
  onReturnItems,
  onCancelSale,
  onClose
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
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Sale Details</Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      <CardContent sx={{ flex: 1, p: 0 }}>
        <Box sx={{ p: 3 }}>
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <CheckCircle color="success" sx={{ mr: 1 }} />
              <Chip
                label={sale.status}
                color={getStatusColor(sale.status)}
                size="small"
              />
            </Box>
            
            <Typography variant="h4" color="primary" gutterBottom>
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

          <Box sx={{ mb: 3 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Store:</strong> {sale.outlet?.name || 'Unknown Store'}
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Register:</strong> {sale.registerId || 'Main Register'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Cashier:</strong> {sale.user?.name || 'Unknown User'}
            </Typography>
          </Box>

          <Box sx={{ mb: 3 }}>
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
          </Box>

          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8f9fa' }}>
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
          </Paper>

          {sale.customer && (
            <Box sx={{ mb: 3 }}>
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
            </Box>
          )}

          {sale.notes && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Notes
              </Typography>
              <Typography variant="body2">
                {sale.notes}
              </Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ p: 3, borderTop: '1px solid #e0e0e0', backgroundColor: '#f8f9fa' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<Print />}
              onClick={onReprintReceipt}
              color="primary"
              fullWidth
            >
              Reprint Receipt
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Email />}
              onClick={onEmailReceipt}
              fullWidth
            >
              Email Receipt
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Edit />}
              onClick={onModifyDetails}
              fullWidth
            >
              Modify Details
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={onAssignCustomer}
              fullWidth
            >
              Assign Customer
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Undo />}
              onClick={onReturnItems}
              color="warning"
              fullWidth
            >
              Return Items
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Cancel />}
              onClick={onCancelSale}
              color="error"
              fullWidth
            >
              Cancel Sale
            </Button>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

export default SaleDetailsPanel;
