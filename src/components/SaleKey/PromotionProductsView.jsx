import React from 'react';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowUpward as ArrowUpwardIcon,
} from '@mui/icons-material';

const PromotionProductsView = ({
  promotionTypeFilter,
  onTypeChange,
  promotionSearchTerm,
  onSearchChange,
  loadingPromotionProducts,
  promotionProducts,
  selectedPromotionProduct,
  onProductSelect,
  onAddToSale,
  onBack,
  ensureRegisterControl,
}) => {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
      {/* Header with Back button and Type selector - White background, black text */}
      <Box sx={{ 
        p: 1.5, 
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: 'white',
        borderBottom: '1px solid #e0e0e0',
        minHeight: 56
      }}>
        <IconButton 
          onClick={onBack} 
          sx={{ 
            color: '#000000',
            '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.05)' }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography 
          variant="body1" 
          sx={{ 
            color: '#000000',
            cursor: 'pointer',
            '&:hover': { textDecoration: 'underline' }
          }}
          onClick={onBack}
        >
          Back
        </Typography>
        <Box sx={{ flex: 1 }} />
        <FormControl 
          size="small" 
          sx={{ 
            minWidth: 120,
            '& .MuiInputBase-root': {
              color: '#000000',
              bgcolor: 'white',
              border: '1px solid #000000',
              borderRadius: 0,
              '&:hover': {
                bgcolor: 'white',
              },
              '& .MuiOutlinedInput-notchedOutline': { 
                borderColor: '#000000',
              },
              '&:hover .MuiOutlinedInput-notchedOutline': { 
                borderColor: '#000000',
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
                borderColor: '#000000',
              },
              '& .MuiSvgIcon-root': { color: '#000000' }
            }
          }}
        >
          <Select
            value={promotionTypeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
            sx={{ 
              color: '#000000',
              '& .MuiSelect-select': {
                py: 1,
                px: 1.5
              }
            }}
            MenuProps={{
              PaperProps: {
                sx: {
                  mt: 0.5,
                  '& .MuiMenuItem-root': {
                    '&:hover': {
                      bgcolor: '#f5f5f5'
                    }
                  }
                }
              }
            }}
          >
            <MenuItem value="Current">Current</MenuItem>
            <MenuItem value="Future">Future</MenuItem>
            <MenuItem value="All">All</MenuItem>
          </Select>
        </FormControl>
      </Box>
      
      {/* Search/Filter - White background, light grey border, no icon */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0', bgcolor: 'white' }}>
        <TextField
          fullWidth
          placeholder="Filter by product, classification or promotional category..."
          value={promotionSearchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'white',
              '& fieldset': {
                borderColor: '#e0e0e0',
              },
              '&:hover fieldset': {
                borderColor: '#bdbdbd',
              },
              '&.Mui-focused fieldset': {
                borderColor: '#9e9e9e',
              },
            },
            '& .MuiInputBase-input::placeholder': {
              color: '#757575',
              opacity: 1,
            }
          }}
        />
      </Box>
      
      {/* Products List */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {loadingPromotionProducts ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : promotionProducts.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', p: 4 }}>
            <Typography variant="h6" color="text.secondary">No promotion products found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Try selecting a different type or check your promotions
            </Typography>
          </Box>
        ) : (
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', color: '#000000' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Product
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#000000' }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', color: '#000000' }} align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    Quantity
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#000000' }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', color: '#000000' }} align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    Price
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#000000' }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', color: '#000000' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Start
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#000000' }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: '#f5f5f5', color: '#000000' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    End
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: '#000000' }} />
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {promotionProducts
                .filter(item => {
                  if (!promotionSearchTerm) return true;
                  const search = promotionSearchTerm.toLowerCase();
                  return (
                    item.product.name?.toLowerCase().includes(search) ||
                    item.promotionName?.toLowerCase().includes(search)
                  );
                })
                .map((item, index) => {
                  const startDate = item.startDate ? new Date(item.startDate).toLocaleDateString('en-GB') : '-';
                  const endDate = item.endDate ? new Date(item.endDate).toLocaleDateString('en-GB') : '-';
                  const isSelected = selectedPromotionProduct && 
                    selectedPromotionProduct.product.id === item.product.id &&
                    selectedPromotionProduct.quantity === item.quantity;
                  return (
                    <TableRow 
                      key={`${item.product.id}-${item.quantity}-${index}`} 
                      hover
                      onClick={async () => {
                        const ok = await ensureRegisterControl();
                        if (!ok) return;
                        onProductSelect(item);
                        onAddToSale(item);
                      }}
                      sx={{ 
                        cursor: 'pointer',
                        bgcolor: isSelected ? '#e3f2fd' : 'white',
                        '&:hover': { bgcolor: isSelected ? '#bbdefb' : '#f5f5f5' },
                        '& td': {
                          color: '#000000',
                          borderBottom: '1px solid #e0e0e0'
                        }
                      }}
                    >
                      <TableCell sx={{ color: '#000000' }}>{item.product.name}</TableCell>
                      <TableCell align="right" sx={{ color: '#000000' }}>{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ color: '#000000' }}>${item.price.toFixed(2)}</TableCell>
                      <TableCell sx={{ color: '#000000' }}>{startDate}</TableCell>
                      <TableCell sx={{ color: '#000000' }}>{endDate}</TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
};

export default PromotionProductsView;
