import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import transfereeService from '../../services/transfereeService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const money = (n) => `$${(Number(n) || 0).toFixed(2)}`;

// Reference: H1 = transferee name, then a plain bordered table of the transfers
// made to it (From | Status | Type | Order Date | Total Cost) ending in a Total row.
const TransfereeView = () => {
  const { id } = useParams();
  const { selectedOutletId } = useSelectedOutlet();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferee, setTransferee] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    document.title = 'View Transferees | Crinit\'s Shop';
  }, []);

  // Reloads on a navbar outlet switch: the rows are the transfers the current
  // outlet view may see (own outlet, or every outlet on All Outlets).
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await transfereeService.getTransfereeTransfers(id);
        const rows = response.transfers || [];
        setTransferee(response.transferee || null);
        setTransfers(rows);
        setTotalCost(
          response.totalCost != null
            ? Number(response.totalCost)
            : rows.reduce((s, t) => s + (Number(t.totalAmount) || 0), 0)
        );
        setError('');
      } catch (err) {
        console.error('Error loading transferee transfers:', err);
        setError(err.response?.data?.error || 'Failed to load transferee');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, selectedOutletId]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography
        component="h1"
        sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}
      >
        {transferee?.name || 'Transferee'}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Reference: plain bordered grid (1px black cells), bold centred headings,
          every transfer to this transferee, then a final "Total" row. The grid is
          shown even with no transfers so the layout can be checked. */}
      {!error && (
        <TableContainer>
          <Table
            size="small"
            sx={{
              borderCollapse: 'collapse',
              '& th, & td': {
                border: '1px solid #000',
                fontSize: 16,
                color: '#000',
                p: '8px 8px',
                height: 36,
              },
              '& th': { fontWeight: 700, textAlign: 'center' },
            }}
          >
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Total Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transfers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} sx={{ color: '#555', textAlign: 'center' }}>
                    No transfers have been made to this transferee yet.
                  </TableCell>
                </TableRow>
              )}
              {transfers.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.outlet?.name || ''}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{formatDate(row.orderDate)}</TableCell>
                  <TableCell>{money(row.totalAmount)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'right', border: 0, borderRight: '1px solid #000' }}>
                  Total
                </TableCell>
                <TableCell>{money(totalCost)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TransfereeView;
