import React from 'react';
import { Box, Typography } from '@mui/material';
import { formatMoney } from '../../utils/currency';
import { plural } from '../../utils/caseLine';

// Order / invoice / transfer / return totals, laid out like the sell screen's
// sale summary (CartSidebar): counters + the money breakdown on the left, the
// grand total big on the right, the whole block at the bottom RIGHT of the page.

// Same money rendering as the sell screen: cents a size smaller.
const SmallCentsMoney = ({ value }) => {
  const text = formatMoney(value);
  const dot = text.lastIndexOf('.');
  if (dot === -1) return text;
  return (
    <>
      {text.slice(0, dot + 1)}
      <span style={{ fontSize: '0.7em' }}>{text.slice(dot + 1)}</span>
    </>
  );
};

const lineSx = { fontSize: 16, fontWeight: 400, lineHeight: 'normal', color: '#000' };

/**
 * cases / items: quantity counters; products: line count.
 * lines: [{ label, value, sign? }] money breakdown (Products, Fees, Freight...);
 *   rows with value 0 are shown greyed, like the sell screen's Savings/Discount.
 * total: the grand total. pending: figures being recalculated (dimmed).
 * notes: extra small lines under the block (freight off the invoice, payment fee).
 */
const DocumentTotalsSummary = ({ cases = 0, items = 0, products = 0, lines = [], total = 0, pending = false, notes = [] }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', mt: 3 }}>
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        maxWidth: 560,
        border: '1px solid #000',
        backgroundColor: '#fff',
      }}
    >
      <Box sx={{ width: '50%', boxSizing: 'border-box', p: '8px', display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        <Typography component="div" sx={lineSx}>
          {cases} {plural('Case', cases)}
        </Typography>
        <Typography component="div" sx={lineSx}>
          {items} {plural('Item', items)}
        </Typography>
        <Typography component="div" sx={lineSx}>
          {products} {plural('Product', products)}
        </Typography>
        {lines.map((l) => {
          const zero = Math.abs(Number(l.value) || 0) < 0.005;
          return (
            <Typography
              key={l.label}
              component="div"
              sx={{ ...lineSx, color: zero ? 'rgba(189, 189, 189, 0.7)' : '#000', opacity: pending ? 0.35 : 1 }}
            >
              {l.label}: {l.sign === '-' && !zero ? '-' : ''}<SmallCentsMoney value={Math.abs(Number(l.value) || 0)} />
            </Typography>
          );
        })}
      </Box>
      <Box sx={{ width: '50%', boxSizing: 'border-box', p: '8px', textAlign: 'center', alignSelf: 'center' }}>
        <Typography component="div" sx={{ fontWeight: 400, fontSize: 40, lineHeight: 'normal', color: '#000', opacity: pending ? 0.35 : 1 }}>
          <SmallCentsMoney value={total} />
        </Typography>
        <Typography component="p" sx={{ fontSize: 24, fontWeight: 400, fontVariant: 'small-caps', lineHeight: 'normal', m: 0, color: '#000' }}>
          Total
        </Typography>
        {pending && (
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Updating total…</Typography>
        )}
      </Box>
    </Box>
    {notes.filter(Boolean).map((n) => (
      <Typography key={n} sx={{ fontSize: 14, color: '#000', textAlign: 'right', maxWidth: 560, mt: 0.5 }}>
        {n}
      </Typography>
    ))}
  </Box>
);

export default DocumentTotalsSummary;
