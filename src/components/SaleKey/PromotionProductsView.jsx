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
import { byMode } from '../../theme/sfPalette';

// Dark mode: light values unchanged, dark values from the reference dark sell screen.
const lineBy = (light, dark) => (t) => `1px solid ${t.palette.mode === 'dark' ? dark : light}`;

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
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: byMode('white', '#232323') }}>
      {/* Header with Back button and Type selector - White background, black text */}
      <Box sx={{
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        bgcolor: byMode('white', '#232323'),
        borderBottom: lineBy('#e0e0e0', '#373737'),
        minHeight: 56
      }}>
        <IconButton
          onClick={onBack}
          sx={{
            color: byMode('#000000', '#f8f8f8'),
            '&:hover': { bgcolor: byMode('rgba(0, 0, 0, 0.05)', 'rgba(255,255,255,0.08)') }
          }}
        >
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="body1"
          sx={{
            color: byMode('#000000', '#f8f8f8'),
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
              color: byMode('#000000', '#f8f8f8'),
              bgcolor: byMode('white', '#121212'),
              border: lineBy('#000000', '#a1a1a1'),
              borderRadius: 0,
              '&:hover': {
                bgcolor: byMode('white', '#121212'),
              },
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: byMode('#000000', '#a1a1a1'),
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: byMode('#000000', '#a1a1a1'),
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: byMode('#000000', '#2b7fff'),
              },
              '& .MuiSvgIcon-root': { color: byMode('#000000', '#f8f8f8') }
            }
          }}
        >
          <Select
            value={promotionTypeFilter}
            onChange={(e) => onTypeChange(e.target.value)}
            sx={{
              color: byMode('#000000', '#f8f8f8'),
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
                      bgcolor: byMode('#f5f5f5', '#0084d1')
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
      <Box sx={{ p: 2, borderBottom: lineBy('#e0e0e0', '#373737'), bgcolor: byMode('white', '#232323') }}>
        <TextField
          fullWidth
          placeholder="Filter by product, classification or promotional category..."
          value={promotionSearchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          variant="outlined"
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: byMode('white', '#121212'),
              '& fieldset': {
                borderColor: byMode('#e0e0e0', '#a1a1a1'),
              },
              '&:hover fieldset': {
                borderColor: byMode('#bdbdbd', '#a1a1a1'),
              },
              '&.Mui-focused fieldset': {
                borderColor: byMode('#9e9e9e', '#2b7fff'),
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
                <TableCell sx={{ fontWeight: 'bold', bgcolor: byMode('#f5f5f5', '#333333'), color: byMode('#000000', '#5ebbeb') }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Product
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: byMode('#000000', '#5ebbeb') }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: byMode('#f5f5f5', '#333333'), color: byMode('#000000', '#5ebbeb') }} align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    Quantity
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: byMode('#000000', '#5ebbeb') }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: byMode('#f5f5f5', '#333333'), color: byMode('#000000', '#5ebbeb') }} align="right">
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                    Price
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: byMode('#000000', '#5ebbeb') }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: byMode('#f5f5f5', '#333333'), color: byMode('#000000', '#5ebbeb') }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Start
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: byMode('#000000', '#5ebbeb') }} />
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold', bgcolor: byMode('#f5f5f5', '#333333'), color: byMode('#000000', '#5ebbeb') }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    End
                    <ArrowUpwardIcon sx={{ fontSize: 16, color: byMode('#000000', '#5ebbeb') }} />
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
                        bgcolor: isSelected ? byMode('#e3f2fd', '#1f3a4a') : byMode('white', '#232323'),
                        '&:hover': { bgcolor: isSelected ? byMode('#bbdefb', '#0084d1') : byMode('#f5f5f5', '#2b2b2b') },
                        '& td': {
                          color: byMode('#000000', '#f8f8f8'),
                          borderBottom: lineBy('#e0e0e0', '#373737')
                        }
                      }}
                    >
                      <TableCell sx={{ color: byMode('#000000', '#f8f8f8') }}>{item.product.name}</TableCell>
                      <TableCell align="right" sx={{ color: byMode('#000000', '#f8f8f8') }}>{item.quantity}</TableCell>
                      <TableCell align="right" sx={{ color: byMode('#000000', '#f8f8f8') }}>${item.price.toFixed(2)}</TableCell>
                      <TableCell sx={{ color: byMode('#000000', '#f8f8f8') }}>{startDate}</TableCell>
                      <TableCell sx={{ color: byMode('#000000', '#f8f8f8') }}>{endDate}</TableCell>
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
