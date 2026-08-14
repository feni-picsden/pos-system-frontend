import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
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

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
};

const HEADER_SX = {
  '& th': {
    backgroundColor: '#5ebbeb',
    color: '#f8f8f8',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'uppercase',
    padding: '8px',
    height: 36,
    borderBottom: 'none',
  },
};

const TransfereeView = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferee, setTransferee] = useState(null);
  const [transfers, setTransfers] = useState([]);

  useEffect(() => {
    document.title = 'View Transferees | Shopfront';
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await transfereeService.getTransfereeTransfers(id);
        setTransferee(response.transferee || null);
        setTransfers(response.transfers || []);
      } catch (err) {
        console.error('Error loading transferee transfers:', err);
        setError(err.response?.data?.error || 'Failed to load transferee');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 1 }}>
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

      {transfers.length === 0 ? (
        <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
          No orders found.
        </Typography>
      ) : (
        <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={HEADER_SX}>
                <TableCell>From</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell align="right">Total Cost</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {transfers.map((row, index) => (
                <TableRow
                  key={row.id}
                  sx={{
                    bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                    '& td': {
                      color: '#000',
                      fontSize: 16,
                      padding: '8px 8px 8px 10px',
                      borderBottom: 'none',
                    },
                  }}
                >
                  <TableCell>{row.outlet?.name || ''}</TableCell>
                  <TableCell>{row.status}</TableCell>
                  <TableCell>{row.type}</TableCell>
                  <TableCell>{formatDate(row.orderDate)}</TableCell>
                  <TableCell align="right">${Number(row.totalAmount || 0).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default TransfereeView;
