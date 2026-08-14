import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Link,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { SwapHoriz as SwapHorizIcon } from '@mui/icons-material';
import PageLoader from '../Common/PageLoader';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';
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

// Local-only columns (Direction / Cases / Items / Quantity / Unit Cost / Total)
// are kept - the reference product has no transfers so its column set for this
// section could not be measured.
const COLUMNS = [
  'Direction',
  'From',
  'To',
  'Status',
  'Date',
  'Transfer #',
  'Cases',
  'Items',
  'Quantity',
  'Unit Cost',
  'Total',
  '',
];

const ProductTransferHistory = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferData, setTransferData] = useState(null);
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    if (productId) {
      loadTransferHistory();
    }
  }, [productId, page]);

  const loadTransferHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await productService.getProductTransferHistory(productId, {
        page,
        limit: 20,
      });
      setTransferData(response.data);
    } catch (err) {
      console.error('Error loading transfer history:', err);
      setError('Failed to load transfer history');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
      Number(value) || 0
    );

  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : '';

  if (loading) return <PageLoader />;

  if (error) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!transferData) {
    return (
      <Box sx={EVENT_ROOT_SX}>
        <Alert severity="info">No transfer history available</Alert>
      </Box>
    );
  }

  return (
    <Box sx={EVENT_ROOT_SX}>
      {transferData.transfers.length === 0 ? (
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
              {transferData.transfers.map((transfer) => (
                <TableRow key={transfer.id}>
                  <TableCell>
                    <Box component="span" sx={orderStatusSx(transfer.direction)}>
                      {String(transfer.direction || 'UNKNOWN').toUpperCase()}
                    </Box>
                  </TableCell>
                  <TableCell className="left">
                    <Box className="main">{transfer.from || '-'}</Box>
                    <Box className="secondary">From</Box>
                  </TableCell>
                  <TableCell className="left">
                    <Box className="main">{transfer.to || '-'}</Box>
                    <Box className="secondary">To</Box>
                  </TableCell>
                  <TableCell>
                    <Box component="span" sx={orderStatusSx(transfer.status)}>
                      {String(transfer.status || 'PENDING').toUpperCase()}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box className="main">{formatDate(transfer.orderDate)}</Box>
                  </TableCell>
                  <TableCell>{transfer.orderNumber}</TableCell>
                  <TableCell>{transfer.cases ?? 0}</TableCell>
                  <TableCell>{transfer.items ?? 0}</TableCell>
                  <TableCell>{transfer.quantity ?? 0}</TableCell>
                  <TableCell>{formatCurrency(transfer.unitPrice)}</TableCell>
                  <TableCell>{formatCurrency(transfer.totalAmount)}</TableCell>
                  <TableCell>
                    <Link
                      component="button"
                      underline="none"
                      onClick={() => navigate(`/orders-invoices/${transfer.id}`)}
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
                      <SwapHorizIcon sx={{ fontSize: 24 }} />
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {transferData.pagination.pages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
          <Pagination
            count={transferData.pagination.pages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </Box>
  );
};

export default ProductTransferHistory;
