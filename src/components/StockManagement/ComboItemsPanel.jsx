import { useEffect, useRef, useState } from 'react';
import {
  Autocomplete,
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import {
  DeleteOutline as DeleteIcon,
  Inventory2Outlined as ComboIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import settingsService from '../../services/settingsService';
import { pricingUnitCost } from '../../utils/productCost';

// "Combo Items" — what a Combo Product spends. Selling one combo takes each
// row's quantity off that product's stock (Shopfront "Basket Products",
// art. 115003878751 — the same feature under our name).
//
// Quantity is deliberately a decimal: a pot is .29 of a 50L keg and a pint .57,
// which is how a bar sells glasses out of a keg. The reference holds sell
// quantities to two decimal places, so a third decimal is rounded away.
const roundQty = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100) / 100;
};

const money = (value) => `$${(Number(value) || 0).toFixed(2)}`;

// The reference shows each line already multiplied out — quantity 55 of a $4
// product reads $220.00, not $4.00 — so both money columns are line figures.
const rowPrice = (row) => (Number(row.price) || 0) * (Number(row.quantity) || 0);
const rowCost = (row) => (Number(row.cost) || 0) * (Number(row.quantity) || 0);

const ComboItemsPanel = ({ items = [], excludeProductId = null, outletId = null, onChange }) => {
  const [options, setOptions] = useState([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  // Guards against a slow response for an older term overwriting a newer one.
  const searchSeq = useRef(0);

  // Reference: 1-2 characters show "Keep Typing to Search...", 3+ actually
  // search. Searching on the server rather than filtering a preloaded page
  // keeps every product reachable, not just the first few hundred.
  useEffect(() => {
    const term = query.trim();
    const seq = ++searchSeq.current;
    if (term.length < 3) {
      setOptions([]);
      setSearching(false);
      return undefined;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await productService.getProducts({
          search: term,
          limit: 20,
          status: 'Active',
          ...(outletId ? { outletId } : {}),
        });
        if (seq !== searchSeq.current) return;
        const rows = response?.products || [];
        // A combo inside a combo would spend stock it does not own, and a combo
        // cannot contain itself, so neither is offered.
        setOptions(rows.filter((p) => p.id !== excludeProductId && p.type !== 'Combo Product'));
      } catch {
        if (seq === searchSeq.current) setOptions([]);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, excludeProductId, outletId]);

  const singlePriceOf = (product) => {
    const tiers = (product?.prices || []).filter((p) => p?.priceSetId == null);
    const single = tiers.find((p) => Number(p.quantity) === 1) || tiers[0];
    if (!single) return 0;
    return (Number(single.price) || 0) / (Number(single.quantity) || 1);
  };

  const add = (product) => {
    if (!product) return;
    if (items.some((row) => row.productId === product.id)) return;
    onChange([
      ...items,
      {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: singlePriceOf(product),
        // Resolved through the pricing engine (Last / Average / Mixed per the
        // company setting), the same way the product's own price rows are costed.
        cost: pricingUnitCost(product, settingsService.getCachedGeneralSettings()),
      },
    ]);
  };

  const setQuantity = (productId, value) => {
    onChange(items.map((row) => (row.productId === productId ? { ...row, quantity: value } : row)));
  };

  const remove = (productId) => {
    onChange(items.filter((row) => row.productId !== productId));
  };

  const itemsTotal = items.reduce((sum, row) => sum + rowPrice(row), 0);
  const contentsCost = items.reduce((sum, row) => sum + rowCost(row), 0);

  return (
    <Box>
      <Autocomplete
        options={options}
        getOptionLabel={(option) => option?.name || ''}
        filterOptions={(opts) => opts}
        value={null}
        inputValue={query}
        onInputChange={(e, next, reason) => {
          if (reason === 'input') setQuery(next);
          else if (reason === 'clear') setQuery('');
        }}
        blurOnSelect
        loading={searching}
        noOptionsText={query.trim().length < 3 ? 'Keep Typing to Search...' : 'No results found'}
        onChange={(e, option) => { add(option); setQuery(''); }}
        renderInput={(params) => (
          <TextField {...params} placeholder="Add Products..." size="small" />
        )}
        sx={{ mb: 2 }}
      />

      {items.length === 0 ? (
        /* Reference's empty state: a centred icon and label, nothing else — no
           totals and no help text until there is something to total. */
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            py: 4,
            color: '#737373',
          }}
        >
          <ComboIcon sx={{ fontSize: 20 }} />
          <Typography sx={{ fontSize: 16 }}>No Combo Items</Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxWidth: 860, border: '1px solid #e0e0e0', borderRadius: '8px' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: '#ebebeb', fontWeight: 700, fontSize: 15, border: 0 } }}>
                <TableCell>Product</TableCell>
                <TableCell align="center">Quantity</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="right">Cost</TableCell>
                <TableCell align="center">&nbsp;</TableCell>
              </TableRow>
            </TableHead>
            <TableBody sx={{ '& td': { border: 0, fontSize: 15, py: 1 } }}>
              {items.map((row) => (
                <TableRow key={row.productId}>
                  <TableCell>{row.name || `#${row.productId}`}</TableCell>
                  <TableCell align="center">
                    <TextField
                      size="small"
                      type="number"
                      value={row.quantity}
                      onChange={(e) => setQuantity(row.productId, e.target.value)}
                      onBlur={(e) => setQuantity(row.productId, roundQty(e.target.value))}
                      inputProps={{ min: '0', step: '0.01', style: { textAlign: 'center' } }}
                      sx={{ width: 104 }}
                    />
                  </TableCell>
                  <TableCell align="right">{money(rowPrice(row))}</TableCell>
                  <TableCell align="right">{money(rowCost(row))}</TableCell>
                  <TableCell align="center">
                    <IconButton
                      size="small"
                      onClick={() => remove(row.productId)}
                      aria-label={`remove ${row.name || 'product'}`}
                      sx={{ color: '#d32f2f' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
              {/* Reference closes the table with a Totals line sitting under the
                  Price and Cost columns rather than as free text below it. */}
              <TableRow>
                <TableCell sx={{ borderTop: '1px solid #e0e0e0 !important', fontWeight: 700 }}>
                  Totals
                </TableCell>
                <TableCell sx={{ borderTop: '1px solid #e0e0e0 !important' }} />
                <TableCell align="right" sx={{ borderTop: '1px solid #e0e0e0 !important', fontWeight: 700 }}>
                  {money(itemsTotal)}
                </TableCell>
                <TableCell align="right" sx={{ borderTop: '1px solid #e0e0e0 !important', fontWeight: 700 }}>
                  {money(contentsCost)}
                </TableCell>
                <TableCell sx={{ borderTop: '1px solid #e0e0e0 !important' }} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}


      {items.length > 0 && (
        <>
          <Typography sx={{ mt: 1.5, fontSize: 14, color: '#676b72', maxWidth: 860 }}>
            Quantity is what comes off each product&apos;s stock when one combo sells. Use whole
            numbers for a hamper, or a decimal to sell a glass out of a keg (a pint is 0.57 of a 50L keg).
          </Typography>
        </>
      )}
    </Box>
  );
};

export default ComboItemsPanel;
