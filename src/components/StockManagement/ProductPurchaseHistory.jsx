import React, { useState, useEffect } from 'react';
import PageLoader from '../Common/PageLoader';
import {
  Box,
  Table,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableContainer,
  Alert,
  Pagination,
  Link,
} from '@mui/material';
import { VisibilityOutlined as EyeIcon } from '@mui/icons-material';
import productService from '../../services/productService';
import { useNavigate } from 'react-router-dom';
import {
  EVENT_ROOT_SX,
  ORDERS_TABLE_SX,
  orderStatusSx,
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from './productViewStyles';

const COLUMNS = [
  'From',
  'To',
  'Status',
  'Date',
  'Invoice Number',
  'Case Quantity',
  'Quantity',
  'Base Cost',
  '+ Fees / - Discounts',
  'Payment Fees',
  'Freight',
  'Rebate',
  'Case Cost',
  'Total Base Cost',
  '',
];

const ProductPurchaseHistory = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [purchasesData, setPurchasesData] = useState(null);
  const navigate = useNavigate();
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (productId) {
      loadPurchaseHistory();
    }
  }, [productId, page]);

  const loadPurchaseHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await productService.getProductPurchaseHistory(productId, {
        page,
        limit: 20,
      });
      setPurchasesData(response.data);
    } catch (err) {
      console.error('Error loading purchase history:', err);
      setError('Failed to load purchase history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(value) || 0
    );

  const formatDate = (dateString) =>
    dateString
      ? new Date(dateString).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!purchasesData) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="info">No purchase history available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={EVENT_ROOT_SX}>
      {purchasesData.purchases.length === 0 ? (
        <Box sx={NICE_ERROR_SX}>
          <Box sx={NICE_ERROR_ICON_SX}>&#8709;</Box>
          <Box sx={NICE_ERROR_REASON_SX}>
            <Box component="h2" sx={NICE_ERROR_HEADING_SX}>
              No results found
            </Box>
            <Box component="p" sx={NICE_ERROR_BODY_SX}>
              We could not find any orders.
            </Box>
          </Box>
        </Box>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table sx={ORDERS_TABLE_SX}>
            <TableHead>
              <TableRow>
                {COLUMNS.map((c, i) => (
                  <TableCell key={c || `col${i}`}>{c}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {purchasesData.purchases.map((purchase) => {
                const baseCost = purchase.unitPrice || 0;
                const totalBaseCost =
                  purchase.totalAmount || purchase.quantity * baseCost;
                return (
                  <TableRow key={purchase.id}>
                    <TableCell className="left">
                      <Box className="main">{purchase.supplier || '—'}</Box>
                      <Box className="secondary">Supplier</Box>
                    </TableCell>
                    <TableCell className="left">
                      <Box className="main">{purchase.outlet}</Box>
                      <Box className="secondary">Outlet</Box>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={orderStatusSx(purchase.status)}>
                        {String(purchase.status || '').toUpperCase()}
                      </Box>
                    </TableCell>
                    <TableCell className="nopad">
                      <Box className="main">{formatDate(purchase.orderDate)}</Box>
                      {purchase.dueDate && (
                        <Box className="secondary">
                          Due: {formatDate(purchase.dueDate)}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{purchase.orderNumber}</TableCell>
                    <TableCell>{purchase.caseQuantity || 1}</TableCell>
                    <TableCell>
                      {/* Reference renders a mini Cases/Items table in this cell */}
                      <Box
                        component="table"
                        sx={{
                          margin: '0 auto',
                          '& td': { padding: '0 8px', fontSize: 16 },
                        }}
                      >
                        <tbody>
                          <tr>
                            <td>Cases</td>
                            <td>Items</td>
                          </tr>
                          <tr>
                            <td>{purchase.cases ?? 0}</td>
                            <td>{purchase.items ?? 0}</td>
                          </tr>
                        </tbody>
                      </Box>
                    </TableCell>
                    <TableCell>{formatCurrency(baseCost)}</TableCell>
                    <TableCell>{formatCurrency(purchase.fees)}</TableCell>
                    <TableCell>{formatCurrency(purchase.paymentFees)}</TableCell>
                    <TableCell>{formatCurrency(purchase.freight)}</TableCell>
                    <TableCell>{formatCurrency(purchase.rebate)}</TableCell>
                    <TableCell>
                      {formatCurrency(baseCost * (purchase.caseQuantity || 1))}
                    </TableCell>
                    <TableCell>{formatCurrency(totalBaseCost)}</TableCell>
                    <TableCell>
                      <Link
                        component="button"
                        underline="none"
                        onClick={() =>
                          purchase.id && navigate(`/orders-invoices/${purchase.id}`)
                        }
                        sx={{
                          color: '#1c86f2',
                          fontSize: 16,
                          whiteSpace: 'nowrap',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'color 0.2s',
                        }}
                      >
                        <EyeIcon sx={{ fontSize: 24 }} />
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {purchasesData.pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={purchasesData.pagination.pages}
            page={page}
            onChange={(e, v) => setPage(v)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default ProductPurchaseHistory;
