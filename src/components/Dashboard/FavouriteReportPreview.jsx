import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import ReportTable from '../Reports/ReportTable';
import inventoryReportService from '../../services/inventoryReportService';
import salesReportService from '../../services/salesReportService';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const INVENTORY_COLUMN_DEFS = [
  { field: 'name', headerName: 'NAME', width: 300, align: 'left' },
  { field: 'caseQuantity', headerName: 'CASE QUANTITY', width: 120, align: 'right' },
  { field: 'caseLevel', headerName: 'CASE LEVEL', width: 120, align: 'right' },
  { field: 'itemLevel', headerName: 'ITEM LEVEL', width: 120, align: 'right' },
  { field: 'valueIncLast', headerName: 'VALUE (INC) (LAST)', width: 160, align: 'right' },
  { field: 'valueExcLast', headerName: 'VALUE (EXC) (LAST)', width: 160, align: 'right' },
  { field: 'quantityOnHand', headerName: 'QUANTITY ON HAND', width: 150, align: 'right' },
  { field: 'averageCost', headerName: 'AVERAGE COST', width: 140, align: 'right' },
  { field: 'lastCost', headerName: 'LAST COST', width: 120, align: 'right' },
  { field: 'reorderLevel', headerName: 'REORDER LEVEL', width: 140, align: 'right' },
  { field: 'reorderQuantity', headerName: 'REORDER QUANTITY', width: 160, align: 'right' },
];

const SALES_COLUMN_ORDER = [
  'name',
  'revenue',
  'costOfGoods',
  'transactionCount',
  'averageSale',
  'profit',
  'profitPercentage',
  'markup',
  'taxAmount',
  'totalItems',
  'casesSold',
  'itemsSold',
  'calculatedCasesSold',
  'calculatedItemsSold',
  'discountAmount',
  'rebateQuantity',
  'expectedRebate',
  'promotionQuantity',
  'promotionalSavings',
  'earnedLoyaltyPoints',
  'revenuePercentage',
  'transactionPercentage',
];

const CURRENCY_KEY_REGEX = /(value|cost|amount|revenue|profit|savings|average|rebate)/i;
const PERCENT_KEY_REGEX = /(percentage|markup)/i;

const toNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const formatCell = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value !== 'number') return value;

  if (PERCENT_KEY_REGEX.test(key)) {
    return `${value.toFixed(2)}%`;
  }

  if (CURRENCY_KEY_REGEX.test(key)) {
    return `$${value.toFixed(2)}`;
  }

  return value.toLocaleString();
};

const prettyHeader = (key) => {
  if (!key) return '';
  return key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .trim()
    .toUpperCase();
};

const flattenRows = (rows) => {
  const out = [];
  (rows || []).forEach((row) => {
    out.push({ ...row, __isChild: false });
    if (Array.isArray(row?.children)) {
      row.children.forEach((child) => {
        out.push({ ...child, __isChild: true });
      });
    }
  });
  return out;
};

const buildInventoryColumns = () => {
  return INVENTORY_COLUMN_DEFS.map((col) => ({
    ...col,
    format: (value) => formatCell(col.field, value),
  }));
};

const buildInventoryRows = (data) => {
  const flat = flattenRows(data);
  const mapped = flat.map((row, index) => ({
    name: `${row.__isChild ? '  ' : ''}${row.name || `Row ${index + 1}`}`,
    caseQuantity: row.caseQuantity ?? '-',
    caseLevel: row.caseLevel ?? row.case_level ?? 0,
    itemLevel: row.itemLevel ?? row.single_level ?? row.item_level ?? 0,
    valueIncLast: toNumber(row.valueIncLast),
    valueExcLast: toNumber(row.valueExcLast),
    quantityOnHand: toNumber(row.quantityOnHand),
    averageCost: toNumber(row.averageCost),
    lastCost: toNumber(row.lastCost),
    reorderLevel: toNumber(row.reorderLevel),
    reorderQuantity: toNumber(row.reorderQuantity),
    __isTotal: false,
  }));

  if (!data?.length) return mapped;

  const totalBase = {
    caseLevel: 0,
    itemLevel: 0,
    valueIncLast: 0,
    valueExcLast: 0,
    quantityOnHand: 0,
    averageCost: 0,
    lastCost: 0,
    reorderLevel: 0,
    reorderQuantity: 0,
  };

  const totals = data.reduce((acc, row) => {
    Object.keys(totalBase).forEach((key) => {
      acc[key] += toNumber(row[key]);
    });
    return acc;
  }, totalBase);

  mapped.push({
    name: 'TOTAL',
    caseQuantity: '-',
    ...totals,
    __isTotal: true,
  });

  return mapped;
};

const buildGenericColumns = (rows, preferredOrder = []) => {
  const keySet = new Set();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (key !== 'children' && key !== '__isChild' && key !== '__isTotal' && key !== 'isTotalRow') {
        keySet.add(key);
      }
    });
  });

  if (!keySet.has('name')) {
    keySet.add('name');
  }

  const preferred = preferredOrder.filter((key) => keySet.has(key));
  const remaining = Array.from(keySet)
    .filter((key) => !preferred.includes(key))
    .sort((a, b) => a.localeCompare(b));

  const ordered = [...preferred, ...remaining];

  return ordered.map((field) => ({
    field,
    headerName: prettyHeader(field),
    width: field === 'name' ? 280 : 140,
    align: field === 'name' ? 'left' : 'right',
    format: (value) => formatCell(field, value),
  }));
};

const buildGenericRows = (data) => {
  const flat = flattenRows(data).map((row, index) => ({
    ...row,
    name: `${row.__isChild ? '  ' : ''}${row.name || `Row ${index + 1}`}`,
    __isTotal: false,
  }));

  if (!data?.length) return flat;

  const keys = new Set();
  data.forEach((row) => {
    Object.keys(row || {}).forEach((key) => {
      if (key !== 'name' && key !== 'children' && typeof row[key] === 'number') {
        keys.add(key);
      }
    });
  });

  if (keys.size === 0) return flat;

  const totalRow = { name: 'TOTAL', __isTotal: true };
  keys.forEach((key) => {
    totalRow[key] = data.reduce((sum, row) => sum + toNumber(row[key]), 0);
  });

  flat.push(totalRow);
  return flat;
};

/**
 * Renders a table preview for a saved favourite report.
 */
const FavouriteReportPreview = ({ favouriteReport, filterByUser }) => {
  const { selectedOutletId } = useSelectedOutlet();
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!favouriteReport) {
      setColumns([]);
      setRows([]);
      setError('');
      return;
    }

    const filters = favouriteReport.filters || {};
    const outletId = filters.outletId ?? selectedOutletId ?? undefined;
    const type = favouriteReport.reportType;

    const run = async () => {
      setLoading(true);
      setError('');

      try {
        if (type === 'inventory') {
          const params = {
            reportType: filters.reportType || 'inventory_on_hand',
            groupBy: filters.groupBy || 'none',
            searchTerm: filters.searchTerm || '',
            includeDeleted: filters.includeDeleted ?? false,
            outletId: outletId ?? filters.outletId,
          };

          if (typeof filters.query === 'string' && filters.query.trim() !== '') {
            params.query = filters.query;
          }

          const response = await inventoryReportService.getInventoryReport(params);
          const inventoryPayload = response?.data;
          const data = Array.isArray(inventoryPayload)
            ? inventoryPayload
            : inventoryPayload
              ? [inventoryPayload]
              : [];

          setColumns(buildInventoryColumns());
          setRows(buildInventoryRows(data));
          return;
        }

        if (type === 'sales') {
          const q = filters.query || {};
          const params = {
            reportType: filters.reportType || q.reportType || 'outlet',
            groupBy: filters.groupBy || q.groupBy || 'none',
            searchTerm: filters.searchTerm || '',
            consolidate: filters.consolidate,
            precision: filters.precision,
            includeDeleted: filters.includeDeleted,
            outletId: outletId ?? filters.outletId,
            ...(filters.dateTime ? { dateTime: filters.dateTime } : {}),
            ...(filters.startDate ? { startDate: filters.startDate } : {}),
            ...(filters.endDate ? { endDate: filters.endDate } : {}),
          };

          if (typeof filters.query === 'string' && filters.query.trim() !== '') {
            params.query = filters.query;
          }

          const response = await salesReportService.getSalesReport(params);
          const salesPayload = response?.data ?? response?.rows;
          const data = Array.isArray(salesPayload)
            ? salesPayload
            : salesPayload
              ? [salesPayload]
              : [];

          const fullRows = buildGenericRows(data);
          const fullColumns = buildGenericColumns(fullRows, SALES_COLUMN_ORDER);
          setColumns(fullColumns);
          setRows(fullRows);
          return;
        }

        setColumns([{ field: 'msg', headerName: 'INFO', width: 520 }]);
        setRows([
          {
            msg: `Preview for "${type}" reports is not wired yet.`,
          },
        ]);
      } catch (e) {
        const msg = e?.response?.data?.error || e?.message || 'Failed to load report';
        setError(msg);
        setColumns([{ field: 'err', headerName: 'ERROR', width: 520 }]);
        setRows([{ err: msg }]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [favouriteReport, filterByUser, selectedOutletId]);

  if (!favouriteReport) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
        Select a favourite report using Edit.
      </Typography>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (error && rows.length === 0) {
    return (
      <Typography variant="body2" color="error" sx={{ p: 3 }}>
        {error}
      </Typography>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }}>
      <ReportTable data={rows} columns={columns} hideFooter maxHeight="100%" />
    </Box>
  );
};

export default FavouriteReportPreview;
