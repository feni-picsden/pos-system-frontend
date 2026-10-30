import React, { useMemo, useState, useEffect } from 'react';
import { Dialog, Box, Typography, Button, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';

// "See Prices" on the price list edit page (reference "Product Prices" /
// "Family Prices" dialog): every price row of the product grouped as
//   Relevant Prices - the rows the navbar outlet sells at (its own outlet rows
//                     beating the global Default Price Set rows per quantity;
//                     with no outlet, the Default Price Set)
//   Other Prices    - everything else (other outlets' rows and every Price Set),
//                     hidden behind "Show Other Prices" until clicked
// Columns: Source / Quantity / Price / Cost (grey) / % (profit margin).

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;

const cellSx = { border: '1px solid #000', fontSize: 16, color: '#000', padding: '12px 10px', lineHeight: 'normal' };
const groupRowSx = { '& td': { ...cellSx, bgcolor: '#ebebeb', fontSize: 18, padding: '14px 16px' } };

const buildPriceGroups = ({ product, priceSets = [], outlets = [], selectedOutletId = null }) => {
  const rows = Array.isArray(product?.prices) ? product.prices : [];
  const unitCost = Number(product?.itemCost ?? product?.cost ?? 0) || 0;
  const setName = new Map(priceSets.map((s) => [s.id, s.name]));
  const outletName = new Map(outlets.map((o) => [o.id, o.name]));
  const oid = selectedOutletId != null ? Number(selectedOutletId) : null;

  const describe = (r) => {
    const qty = Number(r.quantity) || 0;
    const price = Number(r.price) || 0;
    const cost = qty * unitCost;
    return {
      id: r.id,
      source: r.priceSetId != null
        ? (setName.get(r.priceSetId) || `Price Set ${r.priceSetId}`)
        : (r.outletId != null ? (outletName.get(r.outletId) || `Outlet ${r.outletId}`) : 'Default Price Set'),
      quantity: qty,
      price,
      cost,
      pct: price > 0 ? ((price - cost) / price) * 100 : 0,
    };
  };

  // Relevant: default-group rows for the outlet, one per quantity, outlet row first.
  const byQty = new Map();
  rows
    .filter((r) => r.priceSetId == null && (r.outletId == null || (oid != null && Number(r.outletId) === oid)))
    .forEach((r) => {
      const q = Number(r.quantity) || 0;
      const held = byQty.get(q);
      if (!held || (held.outletId == null && r.outletId != null)) byQty.set(q, r);
    });
  const relevantIds = new Set([...byQty.values()].map((r) => r.id));
  const sortRows = (a, b) => a.quantity - b.quantity || a.source.localeCompare(b.source);
  return {
    relevant: rows.filter((r) => relevantIds.has(r.id)).map(describe).sort(sortRows),
    other: rows.filter((r) => !relevantIds.has(r.id)).map(describe).sort(sortRows),
  };
};

const PriceRows = ({ rows }) =>
  rows.map((r) => (
    <TableRow key={r.id}>
      <TableCell sx={cellSx}>{r.source}</TableCell>
      <TableCell sx={cellSx}>{r.quantity}</TableCell>
      <TableCell sx={cellSx}>{money(r.price)}</TableCell>
      <TableCell sx={{ ...cellSx, bgcolor: '#c4c4c4', color: '#5a5a5a' }}>{money(r.cost)}</TableCell>
      <TableCell sx={cellSx}>{r.pct.toFixed(2)}%</TableCell>
    </TableRow>
  ));

const ProductPricesDialog = ({ open, onClose, title = 'Product Prices', product, priceSets, outlets, selectedOutletId, loading = false }) => {
  const [showOther, setShowOther] = useState(false);
  useEffect(() => { if (open) setShowOther(false); }, [open]);

  const groups = useMemo(
    () => buildPriceGroups({ product, priceSets, outlets, selectedOutletId }),
    [product, priceSets, outlets, selectedOutletId]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      PaperProps={{ elevation: 0, sx: { width: 770, maxWidth: '94vw', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 0 30px rgba(0,0,0,.25), 0 15px 30px rgba(0,0,0,.19)' } }}
    >
      <Box sx={{ bgcolor: '#bfe6fb', px: 3, py: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoIcon sx={{ color: '#1c6fa8', fontSize: 20 }} />
        <Typography sx={{ color: '#1c6fa8', fontWeight: 700, fontSize: 18 }}>{title}</Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        <Table sx={{ borderCollapse: 'collapse' }}>
          <TableHead>
            <TableRow>
              {['Source', 'Quantity', 'Price', 'Cost', '%'].map((h) => (
                <TableCell key={h} sx={{ ...cellSx, fontWeight: 700, textAlign: 'center', padding: '14px 10px' }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow sx={groupRowSx}><TableCell colSpan={5}>Relevant Prices</TableCell></TableRow>
            {loading ? (
              <TableRow><TableCell colSpan={5} sx={{ ...cellSx, color: '#6b7280', textAlign: 'center' }}>Loading...</TableCell></TableRow>
            ) : (
              <PriceRows rows={groups.relevant} />
            )}
            {!showOther ? (
              <TableRow sx={{ ...groupRowSx, cursor: 'pointer', '&:hover td': { bgcolor: '#e0e0e0' } }} onClick={() => setShowOther(true)}>
                <TableCell colSpan={5}>Show Other Prices</TableCell>
              </TableRow>
            ) : (
              <>
                <TableRow sx={groupRowSx}><TableCell colSpan={5}>Other Prices</TableCell></TableRow>
                {!loading && <PriceRows rows={groups.other} />}
              </>
            )}
          </TableBody>
        </Table>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2.5 }}>
          <Button
            onClick={onClose}
            disableElevation
            sx={{ bgcolor: '#e0e0e0', color: '#000', fontWeight: 700, fontSize: 16, textTransform: 'none', borderRadius: '8px', px: 3, height: 42, '&:hover': { bgcolor: '#d0d0d0' } }}
          >
            Done
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default ProductPricesDialog;
