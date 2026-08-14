import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Grid,
  TextField,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  Image as ImageIcon,
  ShoppingCart as CartIcon,
  AttachMoney as MoneyIcon,
  Cancel as CancelIcon,
  FormatBold,
  FormatItalic,
  FormatUnderlined,
} from '@mui/icons-material';
import { productOptionLabel, productOptionDetail } from '../../utils/productOptionLabel';

const AddSaleKeyDialog = ({
  open,
  onClose,
  newSaleKey,
  setNewSaleKey,
  availableProducts,
  loadingProducts,
  availablePaymentMethods,
  onActionChange,
  onProductSelection,
  onImageUpload,
  onAddSaleKey,
  getIconForSaleKey,
}) => {
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle sx={{ 
        bgcolor: '#1976d2', 
        color: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AddIcon />
          Add Sale Key
        </Box>
        <IconButton onClick={onClose} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, color: '#1976d2' }}>
              Basic Information
            </Typography>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Sale Key Name"
              value={newSaleKey.name}
              onChange={(e) => setNewSaleKey(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter sale key name"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <FormControl fullWidth required>
              <InputLabel>Action Type</InputLabel>
              <Select
                value={newSaleKey.action}
                onChange={(e) => onActionChange(e.target.value)}
                label="Action Type"
              >
                <MenuItem value="no-action">No Action</MenuItem>
                <MenuItem value="add-product">Add Product</MenuItem>
                <MenuItem value="add-product-case">Add Product using Case Quantity</MenuItem>
                <MenuItem value="add-product-combo">Add Product Combo</MenuItem>
                <MenuItem value="add-gift-card">Add Gift Card</MenuItem>
                <MenuItem value="subtract-quantity">Subtract Quantity from Current Product</MenuItem>
                <MenuItem value="add-quantity">Add Quantity to Current Product</MenuItem>
                <MenuItem value="payment">Payment</MenuItem>
                <MenuItem value="pay-amount">Pay Amount</MenuItem>
                <MenuItem value="pay-exact-amount">Pay Exact Amount</MenuItem>
                <MenuItem value="clear-sale">Clear Sale</MenuItem>
                <MenuItem value="open-drawer">Open Cash Drawer</MenuItem>
                <MenuItem value="open-sale-key-folder">Open Sale Key Folder</MenuItem>
                <MenuItem value="display-product-details">Display Product Details</MenuItem>
                <MenuItem value="view-live-profit">View Live Profit</MenuItem>
                <MenuItem value="view-promotions">View the Current Promotions</MenuItem>
                <MenuItem value="navigation">Navigation</MenuItem>
                <MenuItem value="special">Special Action</MenuItem>
                <MenuItem value="info">Information</MenuItem>
                {/* --- Additional Shopfront sale-key actions --- */}
                <MenuItem value="create-customer">Create a Customer</MenuItem>
                <MenuItem value="add-customer">Add Customer to the Sale</MenuItem>
                <MenuItem value="customer-list">View a list of Customers</MenuItem>
                <MenuItem value="add-note">Add a Note</MenuItem>
                <MenuItem value="add-order-reference">Add a order reference to the current sale</MenuItem>
                <MenuItem value="apply-discount">Apply Predefined Discount</MenuItem>
                <MenuItem value="return-item">Return a Product</MenuItem>
                <MenuItem value="flip-sale">Flip the Sale Quantities</MenuItem>
                <MenuItem value="add-quantity-barcode">Increase quantity by scanned barcode quantity</MenuItem>
                <MenuItem value="subtract-quantity-barcode">Decrease quantity by scanned barcode quantity</MenuItem>
                <MenuItem value="use-case-quantity">Use Case Quantity</MenuItem>
                <MenuItem value="pay-loyalty">Pay Using Customer Loyalty</MenuItem>
                <MenuItem value="add-component-to-current">Add a Component to the currently selected Package</MenuItem>
                <MenuItem value="remove-component-from-current">Remove a Component from the currently selected Package</MenuItem>
                <MenuItem value="display-components-add">Display a list of Components to Add</MenuItem>
                <MenuItem value="display-components-remove">Display a list of Components to Remove</MenuItem>
                <MenuItem value="display-classification-products">Display all Products in Classification</MenuItem>
                <MenuItem value="display-classification-products-case">Display all products with a Classification and Add Case</MenuItem>
                <MenuItem value="product-search-input">Enter a key into the Product Search Box</MenuItem>
                <MenuItem value="previous-folder">Return to the Previous Sale Key Folder</MenuItem>
                <MenuItem value="search-additional">Search by additional information</MenuItem>
                <MenuItem value="sale-search">Search for a Sale</MenuItem>
                <MenuItem value="show-backorders">Show Product Backorders</MenuItem>
                <MenuItem value="change-price-set">Change Price Set</MenuItem>
                <MenuItem value="view-previous-date">View a Previous Date</MenuItem>
                <MenuItem value="view-current-time">View the Current Time</MenuItem>
                <MenuItem value="reweigh">Weigh Again</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          {(newSaleKey.action === 'add-product' || newSaleKey.action === 'add-product-case') && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: '#4CAF50' }}>
                  Product Selection
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  options={availableProducts}
                  getOptionLabel={productOptionLabel}
                  value={newSaleKey.selectedProduct}
                  onChange={(event, newValue) => onProductSelection(newValue)}
                  loading={loadingProducts}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Product"
                      placeholder="Search and select a product"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Box>
                        <Typography variant="body1">{option.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {productOptionDetail(option)}
                          {option.description && ` - ${option.description}`}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
            </>
          )}

          {(newSaleKey.action === 'payment' || newSaleKey.action === 'pay-amount') && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: '#FF9800' }}>
                  Payment Configuration
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Amount"
                  type="number"
                  value={newSaleKey.amount}
                  onChange={(e) => setNewSaleKey(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">$</InputAdornment>,
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={newSaleKey.paymentMethod}
                    onChange={(e) => setNewSaleKey(prev => ({ ...prev, paymentMethod: e.target.value }))}
                    label="Payment Method"
                  >
                    <MenuItem value="cash">Cash</MenuItem>
                    <MenuItem value="card">Card</MenuItem>
                    <MenuItem value="eftpos">EFTPOS</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}
          
          {newSaleKey.action === 'pay-exact-amount' && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: '#FF9800' }}>
                  Exact Amount Payment
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  options={availablePaymentMethods}
                  getOptionLabel={(option) => option.name}
                  value={newSaleKey.selectedPaymentMethod || null}
                  onChange={(event, newValue) => setNewSaleKey(prev => ({ ...prev, selectedPaymentMethod: newValue }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select Payment Method"
                      placeholder="Choose a payment method..."
                    />
                  )}
                />
              </Grid>
            </>
          )}
          
          {newSaleKey.action === 'view-promotions' && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: '#9C27B0' }}>
                  Promotion Type
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Type</InputLabel>
                  <Select
                    value={newSaleKey.promotionType || 'Current'}
                    onChange={(e) => setNewSaleKey(prev => ({ ...prev, promotionType: e.target.value }))}
                    label="Type"
                  >
                    <MenuItem value="Current">Current</MenuItem>
                    <MenuItem value="Future">Future</MenuItem>
                    <MenuItem value="All">All</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </>
          )}

          {(newSaleKey.action === 'add-component-to-current' || newSaleKey.action === 'remove-component-from-current') && (
            <>
              <Grid item xs={12}>
                <Typography variant="h6" sx={{ mb: 2, color: '#4CAF50' }}>
                  Component
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Autocomplete
                  options={availableProducts}
                  getOptionLabel={productOptionLabel}
                  value={availableProducts.find(p => p.id === newSaleKey.componentProductId) || null}
                  onChange={(event, newValue) => setNewSaleKey(prev => ({
                    ...prev,
                    componentProductId: newValue?.id || null,
                    componentProductName: newValue?.name || '',
                  }))}
                  loading={loadingProducts}
                  isOptionEqualToValue={(option, value) => option.id === value?.id}
                  renderInput={(params) => (
                    <TextField {...params} label="Component (product)" placeholder="Search and select a component" />
                  )}
                />
              </Grid>
            </>
          )}

          {newSaleKey.action === 'add-note' && (
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Apply Note To</InputLabel>
                <Select
                  value={newSaleKey.noteScope || 'Sale'}
                  onChange={(e) => setNewSaleKey(prev => ({ ...prev, noteScope: e.target.value }))}
                  label="Apply Note To"
                >
                  <MenuItem value="Product">Product</MenuItem>
                  <MenuItem value="Sale">Sale</MenuItem>
                  <MenuItem value="Sale (Internal)">Sale (Internal)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}

          {newSaleKey.action === 'apply-discount' && (
            <>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Discount Type</InputLabel>
                  <Select
                    value={newSaleKey.discountType || 'discount_percentage'}
                    onChange={(e) => setNewSaleKey(prev => ({ ...prev, discountType: e.target.value }))}
                    label="Discount Type"
                  >
                    <MenuItem value="discount_percentage">Discount Percentage</MenuItem>
                    <MenuItem value="discount_total_amount">Discount Total Amount</MenuItem>
                    <MenuItem value="discount_item_amount">Discount Item Amount</MenuItem>
                    <MenuItem value="total_price_override">Total Price Override</MenuItem>
                    <MenuItem value="item_price_override">Item Price Override</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Discount / Quantity"
                  type="number"
                  value={newSaleKey.discountValue || ''}
                  onChange={(e) => setNewSaleKey(prev => ({ ...prev, discountValue: e.target.value }))}
                  placeholder="Value depends on Discount Type"
                />
              </Grid>
            </>
          )}

          {newSaleKey.action === 'product-search-input' && (
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Text"
                value={newSaleKey.keyboardText || ''}
                onChange={(e) => setNewSaleKey(prev => ({ ...prev, keyboardText: e.target.value }))}
                placeholder="Text to type; supports [Backspace], [Delete], [Clear]"
              />
            </Grid>
          )}

          {(newSaleKey.action === 'view-previous-date' || newSaleKey.action === 'view-current-time') && (
            <>
              {newSaleKey.action === 'view-previous-date' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Duration Ago (ISO 8601 Period)"
                    value={newSaleKey.durationAgo || ''}
                    onChange={(e) => setNewSaleKey(prev => ({ ...prev, durationAgo: e.target.value }))}
                    placeholder="e.g. P18Y or P21Y"
                  />
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Format"
                  value={newSaleKey.dateFormat || ''}
                  onChange={(e) => setNewSaleKey(prev => ({ ...prev, dateFormat: e.target.value }))}
                  placeholder={newSaleKey.action === 'view-current-time' ? 'HH:mm:ss' : 'YYYY-MM-DD'}
                />
              </Grid>
            </>
          )}

          {newSaleKey.action && !['add-product', 'payment', 'pay-amount'].includes(newSaleKey.action) && (
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Amount (Optional)"
                type="number"
                value={newSaleKey.amount}
                onChange={(e) => setNewSaleKey(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Grid>
          )}

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, color: '#9C27B0' }}>
              Appearance
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Text Style</Typography>
            <ToggleButtonGroup
              value={Object.keys(newSaleKey.textStyle).filter(key => newSaleKey.textStyle[key])}
              onChange={(event, newStyles) => {
                const updatedStyles = {
                  bold: newStyles.includes('bold'),
                  italic: newStyles.includes('italic'),
                  underline: newStyles.includes('underline')
                };
                setNewSaleKey(prev => ({ ...prev, textStyle: updatedStyles }));
              }}
              aria-label="text style"
            >
              <ToggleButton value="bold" aria-label="bold">
                <FormatBold />
              </ToggleButton>
              <ToggleButton value="italic" aria-label="italic">
                <FormatItalic />
              </ToggleButton>
              <ToggleButton value="underline" aria-label="underline">
                <FormatUnderlined />
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Font Size"
              type="number"
              value={newSaleKey.fontSize}
              onChange={(e) => setNewSaleKey(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 16 }))}
              inputProps={{ min: 8, max: 48 }}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Border Color"
              type="color"
              value={newSaleKey.borderColor}
              onChange={(e) => setNewSaleKey(prev => ({ ...prev, borderColor: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Background Color"
              type="color"
              value={newSaleKey.backgroundColor}
              onChange={(e) => setNewSaleKey(prev => ({ ...prev, backgroundColor: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Text Color"
              type="color"
              value={newSaleKey.textColor}
              onChange={(e) => setNewSaleKey(prev => ({ ...prev, textColor: e.target.value }))}
            />
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, color: '#FF5722' }}>
              Image (Optional)
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Button
                variant="outlined"
                component="label"
                startIcon={<ImageIcon />}
              >
                Select Image
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={onImageUpload}
                />
              </Button>
              {newSaleKey.image && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => setNewSaleKey(prev => ({ ...prev, image: null, imageFile: null }))}
                >
                  Remove Image
                </Button>
              )}
            </Box>

            {newSaleKey.image && (
              <Box sx={{ 
                width: 200, 
                height: 200, 
                border: '2px dashed #ccc', 
                borderRadius: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden'
              }}>
                <img 
                  src={newSaleKey.image} 
                  alt="Sale key preview"
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '100%', 
                    objectFit: 'contain' 
                  }} 
                />
              </Box>
            )}
          </Grid>

          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, color: '#607D8B' }}>
              Preview
            </Typography>
            <Box
              sx={{
                width: 120,
                height: 80,
                backgroundColor: newSaleKey.backgroundColor,
                color: newSaleKey.textColor,
                border: `1px solid ${newSaleKey.borderColor}`,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: Math.min(newSaleKey.fontSize, 14),
                fontWeight: newSaleKey.textStyle.bold ? 'bold' : 'normal',
                fontStyle: newSaleKey.textStyle.italic ? 'italic' : 'normal',
                textDecoration: newSaleKey.textStyle.underline ? 'underline' : 'none',
                borderRadius: 1,
                textAlign: 'center',
                p: 1,
                boxSizing: 'border-box'
              }}
            >
              {newSaleKey.image ? (
                <img 
                  src={newSaleKey.image} 
                  alt="Preview"
                  style={{ 
                    width: '60%', 
                    height: '60%', 
                    objectFit: 'contain',
                    marginBottom: 4 
                  }} 
                />
              ) : (
                <Box sx={{ fontSize: '1.5rem', mb: 0.5 }}>
                  {getIconForSaleKey({ action: newSaleKey.action })}
                </Box>
              )}
              
              <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1 }}>
                {newSaleKey.name || 'Sale Key Name'}
              </Typography>
              
              {newSaleKey.amount && (
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
                  ${newSaleKey.amount}
                </Typography>
              )}
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions sx={{ p: 2, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={onAddSaleKey}
          disabled={!newSaleKey.name.trim() || !newSaleKey.action}
          sx={{ 
            bgcolor: '#4CAF50',
            '&:hover': { bgcolor: '#45a049' }
          }}
        >
          Add Sale Key
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddSaleKeyDialog;
