import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import {
  Edit as EditIcon,
  BarChart as BarChartIcon,
  Assignment as AssignmentIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
import orderInvoiceService from '../../services/orderInvoiceService';
import { useAuth } from '../../contexts/AuthContext';

const ProductDetailView = ({ product, quantities, onQuantityChange, onSupplierCodeChange, supplierCode, preloadedDetails }) => {
  const navigate = useNavigate();
  const { getOutletName } = useAuth();
  
  const productData = preloadedDetails?.productData || product;
  const salesData = preloadedDetails?.salesData || new Array(7).fill(0);
  const purchaseData = preloadedDetails?.purchaseData || new Array(7).fill(0);
  const lastCost = preloadedDetails?.lastCost || null;
  const lastSentDate = preloadedDetails?.lastSentDate || null;
  const lastReceivedDate = preloadedDetails?.lastReceivedDate || null;


  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Reference renders dates as dd/mm/yyyy
  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };


  // Render performance graph
  const renderPerformanceGraph = () => {
    const maxValue = Math.max(...salesData, ...purchaseData, 1);
    const width = 400;
    const height = 120;
    const padding = 20;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    const pointWidth = plotWidth / 6;

    // Generate paths
    const salesPath = [];
    const purchasePath = [];
    
    for (let i = 0; i < 7; i++) {
      const x = padding + i * pointWidth;
      const salesY = height - padding - (salesData[i] / maxValue) * plotHeight;
      const purchaseY = height - padding - (purchaseData[i] / maxValue) * plotHeight;
      
      if (i === 0) {
        salesPath.push(`M ${x} ${salesY}`);
        purchasePath.push(`M ${x} ${purchaseY}`);
      } else {
        salesPath.push(`L ${x} ${salesY}`);
        purchasePath.push(`L ${x} ${purchaseY}`);
      }
    }

    return (
      <Box sx={{ mt: 2 }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5, 6].map(i => {
            const x = padding + i * pointWidth;
            return (
              <line
                key={i}
                x1={x}
                y1={padding}
                x2={x}
                y2={height - padding}
                stroke="#e0e0e0"
                strokeWidth={1}
              />
            );
          })}
          
          {/* Purchase line (red) */}
          <path
            d={purchasePath.join(' ')}
            stroke="#f44336"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Sales line (blue) */}
          <path
            d={salesPath.join(' ')}
            stroke="#2196f3"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 2, backgroundColor: '#f44336' }} />
            <Typography variant="caption">Purchased</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 16, height: 2, backgroundColor: '#2196f3' }} />
            <Typography variant="caption">Sold</Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  if (!product) return null;

  const fullProduct = productData || product;

  return (
    <Box>
        <Grid container spacing={3}>
          {/* Middle Section */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Performance</Typography>
              {renderPerformanceGraph()}
              <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => navigate(`/stock-management/products/${fullProduct.id}/edit`)}
                  sx={{ backgroundColor: '#1976d2' }}
                >
                  Edit Product
                </Button>
                <Button
                  variant="contained"
                  startIcon={<BarChartIcon />}
                  onClick={() => navigate(`/stock-management/products/${fullProduct.id}?tab=sales`)}
                  sx={{ backgroundColor: '#1976d2' }}
                >
                  Sales Summary
                </Button>
                <Button
                  variant="contained"
                  startIcon={<AssignmentIcon />}
                  onClick={() => navigate(`/stock-management/products/${fullProduct.id}?tab=purchases`)}
                  sx={{ backgroundColor: '#1976d2' }}
                >
                  Purchase History
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Right Section - Last Activity & Outlet Stock */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Last Activity</Typography>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Last Cost (inc)</TableCell>
                      <TableCell>{lastCost ? formatCurrency(lastCost) : 'Never Received'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Last Sent Date</TableCell>
                      <TableCell>{formatDate(lastSentDate)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Last Received Date</TableCell>
                      <TableCell>{formatDate(lastReceivedDate)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Outlet Stock</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>{getOutletName() || 'Main Outlet'}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>Items</TableCell>
                      <TableCell>{fullProduct.currentStockItems || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Reorder Level</TableCell>
                      <TableCell>{fullProduct.reorderLevelItems || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Reorder Amount</TableCell>
                      <TableCell>{fullProduct.reorderAmountItems || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Reorder Limit</TableCell>
                      <TableCell>{fullProduct.reorderLimitItems || 'N/A'}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Max Quantity</TableCell>
                      <TableCell>N/A</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>

          {/* Relevant Prices */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Relevant Prices</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Source</TableCell>
                      <TableCell align="right">Quantity</TableCell>
                      <TableCell align="right">Price</TableCell>
                      <TableCell align="right">Cost</TableCell>
                      <TableCell align="right">%</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {fullProduct.prices && fullProduct.prices.length > 0 ? (
                      fullProduct.prices.map((price, index) => {
                        const profit = price.price && price.cost ? 
                          ((price.price - price.cost) / price.cost) * 100 : 100;
                        return (
                          <TableRow key={index}>
                            <TableCell>{index === 0 ? 'Default Price' : `Price ${index + 1}`}</TableCell>
                            <TableCell align="right">{price.quantity || 1}</TableCell>
                            <TableCell align="right">{formatCurrency(price.price || 0)}</TableCell>
                            <TableCell align="right">{formatCurrency(price.cost || fullProduct.itemCost || 0)}</TableCell>
                            <TableCell align="right">{profit.toFixed(2)}%</TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell>Default Price</TableCell>
                        <TableCell align="right">1</TableCell>
                        <TableCell align="right">
                          {fullProduct.prices?.[0]?.price ? 
                            formatCurrency(fullProduct.prices[0].price) : 
                            formatCurrency(0)
                          }
                        </TableCell>
                        <TableCell align="right">{formatCurrency(fullProduct.itemCost || 0)}</TableCell>
                        <TableCell align="right">100.00%</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
    </Box>
  );
};

export default ProductDetailView;

