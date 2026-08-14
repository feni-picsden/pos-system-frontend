import React, { useState, useEffect } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
} from '@mui/material';
import productService from '../../services/productService';
import {
  SECTION_ROOT_SX,
  GRID_TABLE_SX,
  WIDGET_SHADOW,
} from './productViewStyles';

// Reference gives the revision header row a white background + widget shadow.
const REVISION_TABLE_SX = {
  ...GRID_TABLE_SX,
  '& thead tr': { backgroundColor: '#fff', boxShadow: WIDGET_SHADOW },
};

// Reference highlights removed values pink and added values green inside the
// nested From/To tables.
const REMOVED_BG = 'rgba(227, 52, 47, 0.2)';
const ADDED_BG = 'rgba(50, 182, 67, 0.2)';

const COLUMNS = ['Field', 'From', 'To', 'User', 'Timestamp'];

// Reference nested value tables reuse the same black grid, one level in.
const NESTED_TABLE_SX = {
  ...GRID_TABLE_SX,
  width: '100%',
  '& th, & td': { ...GRID_TABLE_SX['& th, & td'], padding: '8px' },
  '& th': GRID_TABLE_SX['& th'],
  '& td': GRID_TABLE_SX['& td'],
};

const ProductRevisionHistory = ({ productId }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revisions, setRevisions] = useState([]);

  useEffect(() => {
    if (productId) {
      loadRevisionHistory();
    }
  }, [productId]);

  const loadRevisionHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await productService.getProductRevisions(productId);
      setRevisions(response.revisions || []);
    } catch (err) {
      console.error('Error loading revision history:', err);
      setError('Failed to load revision history');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    // Reference format: "21/11/2025 20:32:35" (no comma).
    return `${d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })} ${d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })}`;
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined) return '';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const parse = (value) => {
    if (typeof value !== 'string' || value === '') return value;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };

  // "priceSet" -> "Price Set", "lastCost" -> "Last Cost"
  const titleCase = (key) =>
    key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase());

  const cellValue = (key, value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && /cost|price/i.test(key) && key !== 'priceSet') {
      return formatCurrency(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Reference renders any array-of-objects value as a nested grid table, with
  // rows that are only on one side highlighted red (removed) or green (added).
  const renderNested = (rows, otherRows, isFrom) => {
    const other = Array.isArray(otherRows) ? otherRows : [];
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r || {})))];
    const same = (a, b) => keys.every((k) => String(a?.[k] ?? '') === String(b?.[k] ?? ''));
    return (
      <Box component="table" sx={NESTED_TABLE_SX}>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k}>{titleCase(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              style={{
                backgroundColor: other.some((o) => same(row, o))
                  ? 'transparent'
                  : isFrom
                  ? REMOVED_BG
                  : ADDED_BG,
              }}
            >
              {keys.map((k) => (
                <td key={k}>{cellValue(k, row?.[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </Box>
    );
  };

  // A lone object is rendered as a one-row table, same as an array of one.
  const asRows = (v) =>
    Array.isArray(v)
      ? v.every((x) => x && typeof x === 'object' && !Array.isArray(x))
        ? v
        : null
      : v && typeof v === 'object'
      ? [v]
      : null;

  const renderSide = (field, value, otherValue, isFrom) => {
    const rows = asRows(value);
    if (rows && rows.length > 0) {
      return renderNested(rows, asRows(otherValue) || [], isFrom);
    }
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value) && value.length === 0) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'True' : 'False';
    if (typeof value === 'number' && /cost|price/i.test(field)) {
      return formatCurrency(value);
    }
    return String(value);
  };

  if (loading) {
    return (
      <Box
        sx={{
          ...SECTION_ROOT_SX,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 200,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={SECTION_ROOT_SX}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    // Reference nests two 8px paddings (.p-2 > .revision-page).
    <Box sx={SECTION_ROOT_SX}>
      <Box sx={{ p: 1 }}>
        <Table sx={REVISION_TABLE_SX}>
          <TableHead>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableCell key={c}>{c}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} align="center">
                Please Note: Revisions may take up to five minutes to appear
              </TableCell>
            </TableRow>
            {revisions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No revisions found
                </TableCell>
              </TableRow>
            ) : (
              revisions.map((rev, idx) => {
                const fromValue = parse(rev.from);
                const toValue = parse(rev.to);
                return (
                  <TableRow key={`rev-${idx}`}>
                    <TableCell>{rev.field || ''}</TableCell>
                    <TableCell>
                      {renderSide(rev.field, fromValue, toValue, true)}
                    </TableCell>
                    <TableCell>
                      {renderSide(rev.field, toValue, fromValue, false)}
                    </TableCell>
                    <TableCell>{rev.user || rev.userName || ''}</TableCell>
                    <TableCell>{formatDateTime(rev.timestamp)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
};

export default ProductRevisionHistory;
