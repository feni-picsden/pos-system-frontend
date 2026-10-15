import React from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  IconButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Calculate as CalculateIcon,
  Assignment as AssignmentIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

// Reference (Editing Order, expanded line - 15/10/2026):
//   left   : 9-week Purchased / Sold chart ("8 weeks ago" .. "this week"),
//            legend squares, three light-blue square buttons
//   right  : bordered cost table (Last Cost (inc), Last Received Base Cost (inc),
//            Current Average Cost (inc), New Average Cost (inc), Last Sent Date,
//            Last Received Date), blue-headed outlet table (Outlet, Cases, Items,
//            Reorder Level, Reorder Amount, Reorder Limit, Max Quantity), then
//            Relevant Prices (Source, Quantity, Price, Cost, %)
//   edges  : round <- / -> buttons stepping to the previous / next line
//
// `newCost` (optional): { label, unit } - Setup > General > "Show Average Cost on
// Price Editor When Editing Orders": extra column with what each tier's cost
// becomes once this order lands.
// `costInfo` (optional): { currentAvgCaseCost, newAvgCaseCost, newLastCaseCost,
// isReturnOrTransfer } from the order screen.
const ProductDetailView = ({ product, preloadedDetails, newCost = null, costInfo = null, onPrev = null, onNext = null }) => {
  const { getOutletName } = useAuth();

  const productData = preloadedDetails?.productData || product;
  const WEEKS = 9;
  const salesData = preloadedDetails?.salesData || new Array(WEEKS).fill(0);
  const purchaseData = preloadedDetails?.purchaseData || new Array(WEEKS).fill(0);
  const lastSentDate = preloadedDetails?.lastSentDate || null;
  const lastReceivedDate = preloadedDetails?.lastReceivedDate || null;

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

  // Reference renders dates as dd/mm/yyyy; "Never Sent" when there is none
  const formatDate = (dateString, never) => {
    if (!dateString) return never;
    return new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit' });
  };

  // ── Chart ────────────────────────────────────────────────────────────────
  const renderPerformanceGraph = () => {
    const n = Math.max(salesData.length, purchaseData.length, WEEKS);
    const maxValue = Math.max(...salesData, ...purchaseData, 1);
    // Nice y step: 0.5 for small ranges (reference "0, 0.5, 1 .. 6")
    const yStep = maxValue <= 6 ? 0.5 : maxValue <= 20 ? 2 : Math.ceil(maxValue / 6);
    const yMax = Math.ceil(maxValue / yStep) * yStep;
    const width = 640;
    const height = 230;
    const padL = 60; // room for the rotated "8 weeks ago" label under the first point
    const padR = 16;
    const padT = 10;
    const padB = 78;
    const plotW = width - padL - padR;
    const plotH = height - padT - padB;
    const xAt = (i) => padL + (i * plotW) / (n - 1);
    const yAt = (v) => padT + plotH - (v / yMax) * plotH;
    const path = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(v)}`).join(' ');
    const area = `${path(salesData)} L ${xAt(n - 1)} ${yAt(0)} L ${xAt(0)} ${yAt(0)} Z`;
    const label = (i) => (i === n - 1 ? 'this week' : `${n - 1 - i} week${n - 1 - i === 1 ? '' : 's'} ago`);
    const yTicks = [];
    for (let v = 0; v <= yMax + 1e-9; v += yStep) yTicks.push(Math.round(v * 100) / 100);

    return (
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
        <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: 'block', maxWidth: width }}>
          <style>{`@keyframes pdvDraw{to{stroke-dashoffset:0}} @keyframes pdvFade{from{opacity:0}to{opacity:1}} .pdv-line{stroke-dasharray:2000;stroke-dashoffset:2000;animation:pdvDraw 1.2s ease-out forwards} .pdv-fade{opacity:0;animation:pdvFade .6s ease-out .6s forwards}`}</style>
          {/* grid */}
          {yTicks.map((v) => (
            <line key={`h${v}`} x1={padL} y1={yAt(v)} x2={width - padR} y2={yAt(v)} stroke="#e0e0e0" strokeWidth={1} />
          ))}
          {Array.from({ length: n }).map((_, i) => (
            <line key={`v${i}`} x1={xAt(i)} y1={padT} x2={xAt(i)} y2={padT + plotH} stroke="#e0e0e0" strokeWidth={1} />
          ))}
          {/* y labels */}
          {yTicks.map((v) => (
            <text key={`t${v}`} x={padL - 6} y={yAt(v) + 4} fontSize={10} fill="#313439" textAnchor="end">{v}</text>
          ))}
          {/* sold: filled light blue area + line + dots */}
          <path className="pdv-fade" d={area} fill="#5ebbeb" fillOpacity={0.25} />
          <path className="pdv-line" d={path(salesData)} stroke="#5ebbeb" strokeWidth={2} fill="none" />
          {salesData.map((v, i) => <circle className="pdv-fade" key={`s${i}`} cx={xAt(i)} cy={yAt(v)} r={3} fill="#5ebbeb" />)}
          {/* purchased: red line + dots */}
          <path className="pdv-line" d={path(purchaseData)} stroke="#e3342f" strokeWidth={2} fill="none" />
          {purchaseData.map((v, i) => <circle className="pdv-fade" key={`p${i}`} cx={xAt(i)} cy={yAt(v)} r={3} fill="#e3342f" />)}
          {/* x labels, rotated like the reference */}
          {Array.from({ length: n }).map((_, i) => (
            <text
              key={`x${i}`}
              x={xAt(i)}
              y={padT + plotH + 14}
              fontSize={10}
              fill="#313439"
              textAnchor="end"
              transform={`rotate(-45 ${xAt(i)} ${padT + plotH + 14})`}
            >
              {label(i)}
            </text>
          ))}
        </svg>
        <Box sx={{ pt: 6, minWidth: 90 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Box sx={{ width: 14, height: 14, backgroundColor: '#e3342f' }} />
            <Typography sx={{ fontSize: 13 }}>Purchased</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 14, height: 14, backgroundColor: '#5ebbeb' }} />
            <Typography sx={{ fontSize: 13 }}>Sold</Typography>
          </Box>
        </Box>
      </Box>
    );
  };

  if (!product) return null;

  const fullProduct = productData || product;
  const cq = Number(fullProduct.caseQuantity) || 1;

  // Reference button: light blue, square, white text
  const refBtn = {
    backgroundColor: '#5ebbeb',
    color: '#fff',
    borderRadius: 0,
    textTransform: 'none',
    fontSize: 18,
    fontWeight: 400,
    px: 2.5,
    height: 44,
    boxShadow: 'none',
    '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
  };
  // Bordered reference tables
  // App card style (user's choice over the reference's black grid): white card
  // with a rounded border, heading inside, rows separated by a thin line only.
  const card = { backgroundColor: '#fff', border: '1px solid #e0e0e0', borderRadius: 2, p: 2, mb: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
  const cardTitle = { fontSize: 20, fontWeight: 700, color: '#000', mb: 1.5 };
  const cell = { borderBottom: '1px solid #e0e0e0', padding: '8px 12px', fontSize: 14, color: '#000', backgroundColor: '#fff' };
  const head = { ...cell, fontWeight: 400 };
  const blueHead = { ...cell, backgroundColor: '#5ebbeb', color: '#fff', fontWeight: 700, textAlign: 'center', borderBottom: 0 };
  const na = { ...cell, color: '#9e9e9e', textAlign: 'center' };
  const num = { ...cell, textAlign: 'center' };

  const lastCaseCost = preloadedDetails?.lastCaseCost ?? (Number(fullProduct.caseCost) || 0);
  const lastReceivedBase = preloadedDetails?.lastReceivedBaseCaseCost;
  const currentAvg = costInfo?.currentAvgCaseCost ?? (Number(fullProduct.averageCaseCost) || lastCaseCost);
  const newAvg = costInfo?.newAvgCaseCost;

  const pair = (casesVal, itemsVal) => [
    <td key="c" style={num}>{casesVal ?? 'N/A'}</td>,
    <td key="i" style={num}>{itemsVal ?? 'N/A'}</td>,
  ];
  const optional = (v) => (v === '' || v == null ? null : v);

  return (
    <Box sx={{ position: 'relative', px: { xs: 0, md: 6 } }}>
      {/* previous / next line */}
      {onPrev && (
        <IconButton onClick={onPrev} sx={{ position: 'absolute', left: 0, top: '45%', backgroundColor: '#000', color: '#fff', '&:hover': { backgroundColor: '#313439' } }}>
          <ArrowBackIcon />
        </IconButton>
      )}
      {onNext && (
        <IconButton onClick={onNext} sx={{ position: 'absolute', right: 0, top: '45%', backgroundColor: '#000', color: '#fff', '&:hover': { backgroundColor: '#313439' } }}>
          <ArrowForwardIcon />
        </IconButton>
      )}

      <Grid container spacing={3}>
        {/* Left: chart + buttons */}
        <Grid item xs={12} md={6}>
          {renderPerformanceGraph()}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 1, flexWrap: 'wrap' }}>
            <Button startIcon={<EditIcon />} component={RouterLink} to={`/products/${fullProduct.id}/edit`} sx={refBtn}>
              Edit Product
            </Button>
            <Button startIcon={<CalculateIcon />} component={RouterLink} to={`/products/${fullProduct.id}/view?section=salesSummary`} sx={refBtn}>
              Sales Summary
            </Button>
            <Button startIcon={<AssignmentIcon />} component={RouterLink} to={`/products/${fullProduct.id}/view?section=purchaseHistory`} sx={refBtn}>
              Purchase History
            </Button>
          </Box>
          {/* Relevant Prices - under the buttons */}
          <Box sx={{ ...card, mb: 0, mt: 2 }}>
          <Typography sx={cardTitle}>Relevant Prices</Typography>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'left' }}>Source</th>
                <th style={{ ...head, textAlign: 'right' }}>Quantity</th>
                <th style={{ ...head, textAlign: 'right' }}>Price</th>
                <th style={{ ...head, textAlign: 'right' }}>Cost</th>
                {newCost && <th style={{ ...head, textAlign: 'right' }}>{newCost.label}</th>}
                <th style={{ ...head, textAlign: 'right' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {(fullProduct.prices && fullProduct.prices.length > 0
                ? fullProduct.prices
                : [{ quantity: 1, price: fullProduct.prices?.[0]?.price || 0, cost: fullProduct.itemCost || 0 }]
              ).map((price, index) => {
                const qty = Number(price.quantity) || 1;
                const tierCost = Number(price.cost) || (Number(fullProduct.itemCost) || 0) * qty;
                const profit = price.price && tierCost ? ((price.price - tierCost) / tierCost) * 100 : 100;
                const newTierCost = newCost ? newCost.unit * qty : null;
                const newProfit = newTierCost != null && price.price && newTierCost > 0
                  ? ((price.price - newTierCost) / newTierCost) * 100 : null;
                return (
                  <tr key={index}>
                    <td style={cell}>{index === 0 ? 'Default Price' : `Price ${index + 1}`}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{qty}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(price.price || 0)}</td>
                    <td style={{ ...cell, textAlign: 'right' }}>{formatCurrency(tierCost)}</td>
                    {newCost && <td style={{ ...cell, textAlign: 'right', fontWeight: 700 }}>{formatCurrency(newTierCost)}</td>}
                    <td style={{ ...cell, textAlign: 'right' }}>{(newProfit != null ? newProfit : profit).toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Typography sx={{ fontSize: 11, color: '#676b72', mt: 0.5 }}>Case quantity {cq}</Typography>
          </Box>
        </Grid>

        {/* Right: cost table, outlet table, prices */}
        <Grid item xs={12} md={6}>
          <Box sx={card}>
          <Typography sx={cardTitle}>Last Activity</Typography>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={head}>Last Cost (inc)</td><td style={cell}>{lastCaseCost > 0 ? formatCurrency(lastCaseCost) : 'Never Received'}</td></tr>
              <tr><td style={head}>Last Received Base Cost (inc)</td><td style={cell}>{lastReceivedBase != null ? formatCurrency(lastReceivedBase) : 'Never Received'}</td></tr>
              <tr><td style={head}>Current Average Cost (inc)</td><td style={cell}>{formatCurrency(currentAvg)}</td></tr>
              {!costInfo?.isReturnOrTransfer && (
                <tr><td style={head}>New Average Cost (inc)</td><td style={cell}>{newAvg != null ? formatCurrency(newAvg) : '—'}</td></tr>
              )}
              <tr><td style={head}>Last Sent Date</td><td style={cell}>{formatDate(lastSentDate, 'Never Sent')}</td></tr>
              <tr><td style={head}>Last Received Date</td><td style={cell}>{formatDate(lastReceivedDate, 'Never Received')}</td></tr>
            </tbody>
          </table>
          </Box>

          <Box sx={card}>
          <Typography sx={cardTitle}>Outlet Stock</Typography>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={blueHead}>Outlet</th>
                <th style={blueHead}>Cases</th>
                <th style={blueHead}>Items</th>
                <th style={blueHead} colSpan={2}>Reorder Level</th>
                <th style={blueHead} colSpan={2}>Reorder Amount</th>
                <th style={blueHead} colSpan={2}>Reorder Limit</th>
                <th style={blueHead} colSpan={2}>Max Quantity</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={cell}>{fullProduct.outlet?.name || getOutletName() || 'Main Outlet'}</td>
                <td style={num}>{fullProduct.currentStockCases || 0}</td>
                <td style={num}>{fullProduct.currentStockItems || 0}</td>
                {pair(fullProduct.reorderLevelCases || 0, fullProduct.reorderLevelItems || 0)}
                {pair(fullProduct.reorderAmountCases || 0, fullProduct.reorderAmountItems || 0)}
                {optional(fullProduct.reorderLimitCases) == null && optional(fullProduct.reorderLimitItems) == null
                  ? [<td key="lc" style={na}>N/A</td>, <td key="li" style={na}>N/A</td>]
                  : pair(optional(fullProduct.reorderLimitCases) ?? 0, optional(fullProduct.reorderLimitItems) ?? 0)}
                {optional(fullProduct.maxOnHandCases) == null && optional(fullProduct.maxOnHandItems) == null
                  ? [<td key="mc" style={na}>N/A</td>, <td key="mi" style={na}>N/A</td>]
                  : pair(optional(fullProduct.maxOnHandCases) ?? 0, optional(fullProduct.maxOnHandItems) ?? 0)}
              </tr>
            </tbody>
          </table>
          </Box>
        </Grid>

      </Grid>
    </Box>
  );
};

export default ProductDetailView;
