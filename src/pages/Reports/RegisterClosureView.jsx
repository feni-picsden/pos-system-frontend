import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Box, Typography, Paper, Grid, Table, TableHead, TableBody, TableRow, TableCell, Button, Dialog, DialogTitle, DialogContent, IconButton, Stack, Alert, Avatar } from '@mui/material';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PrintDisabledOutlinedIcon from '@mui/icons-material/PrintDisabledOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import { useParams, useNavigate } from 'react-router-dom';
import { format, formatDistanceToNowStrict } from 'date-fns';
import registerClosureService from '../../services/registerClosureService';
import settingsService from '../../services/settingsService';
import { resolveAssetUrl } from '../../services/apiClient';

// Reference toolbar palette (measured on the Shopfront closure view)
const REF_BLUE = '#1C86F2';
const REF_BLUE_HOVER = '#73B4F7';
const REF_TEXT = '#f8f8f8';
const REF_TRANSITION = 'background 0.2s ease, color 0.2s ease';

// Tile colours (reference): Money Received / Tax blue, Payment Subtype dark grey,
// Account Sales green, Refunds red, Discounts orange, Movements teal.
const TILE = {
  money: '#0a3f8f',
  subtype: '#3c4858',
  tax: '#0b5aa3',
  account: '#3d7a1e',
  accountPayments: '#1e6b1e',
  refunds: '#a61b1b',
  discounts: '#e85d04',
  movements: '#0D6B6B'
};

const toolbarBtnSx = {
  bgcolor: REF_BLUE,
  color: REF_TEXT,
  borderRadius: 0,
  p: '16px',
  minHeight: 53,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  boxShadow: 'none',
  transition: REF_TRANSITION,
  '&:hover': { bgcolor: REF_BLUE_HOVER, boxShadow: 'none' },
  '& .MuiButton-startIcon': { mr: 1, ml: 0 }
};

const backBtnSx = {
  bgcolor: REF_BLUE,
  color: REF_TEXT,
  border: `1px solid ${REF_TEXT}`,
  borderRadius: 0,
  width: 136,
  height: 48,
  minWidth: 136,
  p: '4px 8px',
  m: '0 4px',
  fontSize: 32,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  boxShadow: 'none',
  transition: REF_TRANSITION,
  '&:hover': { bgcolor: REF_BLUE_HOVER, boxShadow: 'none', border: `1px solid ${REF_TEXT}` },
  '& .MuiButton-startIcon': { mr: '4px', ml: 0, '& svg': { fontSize: 28 } }
};

const esc = (v) => String(v ?? '').replace(/[<>&'"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
));

const money = (n) => { const v = Number(n || 0); return `${v < 0 ? '-' : ''}$${Math.abs(v).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; };
const initials = (name) => (String(name || '').trim() ? String(name).trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2) : 'U');
const STATS_BLUE = 'rgb(91, 184, 240)';
// Hourly tabs (reference): each metric has its own line/fill colour.
const HOURLY_TABS = [
  { key: 'revenue', label: 'Revenue', color: '#7b8fb5', fill: '#f2f3f6', money: true },
  { key: 'customers', label: 'Customers', color: '#e9aa6e', fill: '#fdf6ef', money: false },
  { key: 'transactions', label: 'Transactions', color: '#a69bc9', fill: '#f4f3f7', money: false },
  { key: 'averageSale', label: 'Average Sale', color: '#6fd3d6', fill: '#eefafa', money: true },
];
const moneyLong = money;
const when = (v) => (v ? format(new Date(v), 'dd/MM/yyyy HH:mm:ss') : '');
const ago = (v) => (v ? `${formatDistanceToNowStrict(new Date(v))} ago` : '');
// Reference "Sale" column: the invoice number when the sale has one, else the sale number.
const saleLabel = (r) => (r.invoiceNumber != null ? String(r.invoiceNumber) : (r.saleNumber || r.saleId || ''));

// ponytail: print via a throwaway hidden iframe — no print-only CSS to keep in sync
const printHtml = (html) => {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(() => frame.remove(), 1000);
};

// Tile with the print icon the reference shows: a printer when the section is in the
// printout, a crossed printer when the Print Settings say "Don't Print".
const Tile = ({ title, value, onClick, bg, printed }) => (
  <Paper
    elevation={0}
    onClick={onClick}
    data-tile={title}
    sx={{
      p: '12px 16px 16px',
      minHeight: 128,
      height: '100%',
      position: 'relative',
      cursor: onClick ? 'pointer' : 'default',
      bgcolor: bg,
      color: '#fff',
      borderRadius: 0,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      // Print Full Page keeps the tile colours (Chrome drops backgrounds otherwise).
      WebkitPrintColorAdjust: 'exact',
      printColorAdjust: 'exact',
      '@media print': { border: '0 !important', boxShadow: 'none' }
    }}
  >
    {printed === undefined ? null : (printed
      ? <PrintOutlinedIcon titleAccess="Printed on the register closure" sx={{ position: 'absolute', top: 10, right: 12, fontSize: 22, color: '#fff' }} />
      : <PrintDisabledOutlinedIcon titleAccess="Not printed on the register closure" sx={{ position: 'absolute', top: 10, right: 12, fontSize: 22, color: '#fff' }} />)}
    <Typography sx={{ fontSize: 28, fontWeight: 400, lineHeight: '34px' }}>{title}</Typography>
    <Box sx={{ fontSize: 16, lineHeight: '24px', mt: 1 }}>{value}</Box>
  </Paper>
);

// Full-screen overlay in the tile colour with a table and the explanatory sentence (reference).
const Overlay = ({ open, onClose, title, bg, columns, rows, renderRow, text }) => (
  <Dialog
    open={open}
    onClose={onClose}
    sx={{ '& .MuiDialog-container': { alignItems: 'end' } }}
    PaperProps={{ sx: { bgcolor: bg, color: '#fff', height: '94vh', width: '100vw', maxWidth: 'unset', margin: 0, borderRadius: 0 } }}
  >
    <DialogTitle sx={{ m: 0, p: '16px 16px 8px', textAlign: 'center', fontSize: 28, fontWeight: 400, lineHeight: '34px' }}>
      {title}
      <IconButton aria-label="close" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 10, color: '#fff' }}>
        <CloseIcon sx={{ fontSize: 32 }} />
      </IconButton>
    </DialogTitle>
    <DialogContent sx={{ p: 2 }}>
      <Table size="small" sx={{ borderCollapse: 'collapse', '& td, & th': { border: '1px solid #fff', color: '#fff', fontSize: 16, p: '8px', textAlign: 'left' }, '& th': { fontWeight: 700, textAlign: 'center' } }}>
        <TableHead>
          <TableRow>
            {columns.map((c) => <TableCell key={c}>{c}</TableCell>)}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r, i) => renderRow(r, i))}
        </TableBody>
      </Table>
      <Typography sx={{ display: 'block', mt: 2, mx: 'auto', maxWidth: 700, textAlign: 'center', fontSize: 16 }}>{text}</Typography>
    </DialogContent>
  </Dialog>
);

const cell = (v) => <TableCell>{v}</TableCell>;

const EMPTY = { rows: [], total: 0 };

const RegisterClosureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [closure, setClosure] = useState(null);
  const [details, setDetails] = useState(null);
  const [notes, setNotes] = useState([]);
  const [overlay, setOverlay] = useState(null); // 'money' | 'subtype' | 'tax' | 'account' | 'refunds' | 'discounts'
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [hourlyRows, setHourlyRows] = useState([]);
  const [hourlyTab, setHourlyTab] = useState('revenue');
  // Setup > General > Registers > Edit > Register Closures > Print Settings.
  const [closurePrint, setClosurePrint] = useState({});
  const [closureToggles, setClosureToggles] = useState({});

  const reload = useCallback(async () => {
    const [c, d, n, h] = await Promise.all([
      registerClosureService.getById(id),
      registerClosureService.getDetails(id).catch(() => null),
      registerClosureService.getNotes(id).catch(() => []),
      registerClosureService.getHourlyStats(id).catch(() => ({ rows: [] }))
    ]);
    setClosure(c);
    setDetails(d);
    setNotes(n);
    setHourlyRows(h.rows || []);
  }, [id]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (!closure?.registerId) return;
    settingsService
      .getSetting(`register_profile_${closure.registerId}`)
      .then((res) => {
        const v = res?.setting?.value || {};
        setClosurePrint(v.closurePrint || v.closure?.print || {});
        setClosureToggles(v.closure || {});
      })
      .catch(() => { setClosurePrint({}); setClosureToggles({}); });
  }, [closure?.registerId]);

  const hourlyChartData = useMemo(() => {
    if (!closure) return [];
    const hourMs = 60 * 60 * 1000;
    const startActual = new Date(closure.openedAt);
    const endActual = new Date(closure.closedAt);
    const start = new Date(startActual);
    start.setMinutes(0, 0, 0);
    // Reference: one point per hour from the opening hour to the closing hour.
    const end = new Date(Math.max(endActual.getTime(), start.getTime() + hourMs));
    const hourKey = (d) => { const k = new Date(d); k.setMinutes(0, 0, 0); return k.toISOString(); };
    const map = new Map((hourlyRows || []).map(r => [hourKey(new Date(r.time)), r]));
    const result = [];
    for (let t = start.getTime(); t <= end.getTime(); t += hourMs) {
      const d = new Date(t);
      const row = map.get(hourKey(d));
      const value = Number(row ? row[hourlyTab] : 0);
      const label = format(d, 'dd/MM/yyyy HH:mm:ss');
      result.push({ time: label, value });
    }
    return result;
  }, [closure, hourlyRows, hourlyTab]);

  const activeHourlyTab = HOURLY_TABS.find((t) => t.key === hourlyTab) || HOURLY_TABS[0];
  const hourlyFormat = (v) => (activeHourlyTab.money ? moneyLong(v) : String(Math.round(Number(v) * 100) / 100));

  // Default print mode per section matches CLOSURE_PRINT_SECTIONS in Setup > General.
  const modeFor = (key, fallback) => closurePrint[key] || fallback;
  const printed = (key, fallback) => modeFor(key, fallback) !== "Don't Print";

  const moneyRows = useMemo(() => {
    const pb = closure?.paymentBreakdown || {};
    return Object.keys(pb).map(method => {
      const entry = pb[method];
      if (entry && typeof entry === 'object') return { method, expected: Number(entry.expected || 0), received: Number(entry.received || 0) };
      return { method, expected: Number(entry || 0), received: Number(entry || 0) };
    });
  }, [closure]);

  const account = details?.accountSales || EMPTY;
  const refunds = details?.refunds || EMPTY;
  const accountPayments = details?.accountPayments || EMPTY;
  const discounts = details?.discounts || EMPTY;
  const tax = details?.tax || { rows: [], total: closure?.taxTotal || 0 };
  const subtypes = details?.paymentSubtypes || EMPTY;
  const movements = details?.movements || { rows: [], total: closure?.cashMovementsTotal || 0 };

  const statsTotal = useMemo(() => {
    const rows = closure?.userStats || [];
    const revenue = rows.reduce((s, r) => s + (Number(r.revenue) || 0), 0);
    const cogs = rows.reduce((s, r) => s + (Number(r.costOfGoodsSold) || 0), 0);
    const transactions = rows.reduce((s, r) => s + (Number(r.transactions) || 0), 0);
    const profit = revenue - cogs;
    return { revenue, cogs, profit, pct: revenue > 0 ? (profit / revenue) * 100 : 0, avg: transactions > 0 ? revenue / transactions : 0 };
  }, [closure]);

  const summaryRows = closure ? [
    ['Outlet', closure.register?.outlet?.name || '-'],
    ['Register', closure.register?.name || closure.registerId],
    ['Opened At', when(closure.openedAt)],
    ['Closed At', when(closure.closedAt)],
    ['Closed By', closure.closedBy?.name || '-'],
    ['Total Transactions', closure.totalTransactions]
  ] : [];

  // "Print" prints the closure document the reference prints (sections per the
  // register's Print Settings); "Print Full Page" prints the same document with
  // EVERY section as a table, ignoring the Print Settings (reference).
  const printSlip = (fullPage = false) => {
    const mode = fullPage ? (key) => (key === 'movements' && !movements.rows.length ? 'Print Total' : 'Print Table') : modeFor;
    const toggles = fullPage ? { paymentSubtypeTotals: true, statistics: true, notes: true } : closureToggles;
    // Reference printout: bold section heading, the section's total(s) under it, then a centred bordered table.
    const table = (title, head, body, totalsText = '') => `<h2>${esc(title)}</h2>${totalsText ? `<div class="sub">${totalsText}</div>` : ''}<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`;
    const tr = (cells, cls = '') => `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c, i) => `<td${i ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`;
    const parts = [];
    parts.push(`<table class="info"><tbody>${summaryRows.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`);

    const pm = mode('paymentMethod', 'Print Table');
    if (pm === 'Print Table') parts.push(table('Money Received', ['Payment Method', 'Expected', 'Received', 'Difference'], moneyRows.map((r) => tr([r.method, money(r.expected), money(r.received), money(r.received - r.expected)])).join(''), `Expected: ${esc(moneyLong(closure.expectedAmount))}<br/>Received: ${esc(moneyLong(closure.receivedAmount))}`));
    else if (pm === 'Print Total') parts.push(table('Money Received', ['Expected', 'Received'], tr([money(closure.expectedAmount), money(closure.receivedAmount)])));

    if (toggles.paymentSubtypeTotals && subtypes.rows.length) parts.push(table('Payment Subtype Sales', ['Payment Subtype', 'Amount'], subtypes.rows.map((r) => tr([r.subtype, money(r.amount)])).join(''), esc(moneyLong(subtypes.total))));

    const tx = mode('tax', 'Print Table');
    if (tx === 'Print Table') parts.push(table('Tax', ['Tax Rate', 'Revenue', 'Tax'], tax.rows.map((r) => tr([r.rate, money(r.revenue), money(r.tax)])).join(''), esc(moneyLong(tax.total))));
    else if (tx === 'Print Total') parts.push(table('Tax', ['Tax'], tr([money(tax.total)])));

    const mv = mode('movements', 'Print Total');
    if (mv === 'Print Table' && movements.rows.length) parts.push(table('Movements', ['Date and Time', 'User', 'Type', 'Reason', 'Amount'], movements.rows.map((r) => tr([when(r.createdAt), r.user, r.type, r.reason, money(r.amount)])).join(''), esc(moneyLong(movements.total))));
    // "Sections with no applicable data are omitted from the printout" (Print Settings help).
    else if (mv !== "Don't Print" && (movements.rows.length || Number(movements.total))) parts.push(table('Movements', ['Amount'], tr([money(movements.total)])));

    const as = mode('accountSales', 'Print Table');
    if (account.rows.length && as === 'Print Table') parts.push(table('Account Sales', ['Date and Time', 'User', 'Customer', 'Sale', 'Amount', 'Outstanding'], account.rows.map((r) => tr([when(r.createdAt), r.user, r.customer, saleLabel(r), money(r.amount), money(r.outstanding)])).join(''), esc(moneyLong(account.total))));
    else if (account.rows.length && as === 'Print Total') parts.push(table('Account Sales', ['Amount'], tr([money(account.total)])));

    const ap = mode('accountPayments', 'Print Table');
    if (accountPayments.rows.length && ap === 'Print Table') parts.push(table('Account Payments', ['Date and Time', 'User', 'Customer', 'Sale', 'Payment Method', 'Amount'], accountPayments.rows.map((r) => tr([when(r.createdAt), r.user, r.customer, saleLabel(r), r.method, money(r.amount)])).join(''), esc(moneyLong(accountPayments.total))));
    else if (accountPayments.rows.length && ap === 'Print Total') parts.push(table('Account Payments', ['Amount'], tr([money(accountPayments.total)])));

    const rf = mode('refunds', 'Print Table');
    if (refunds.rows.length && rf === 'Print Table') parts.push(table('Refunds', ['Date and Time', 'User', 'Customer', 'Sale', 'Total Price'], refunds.rows.map((r) => tr([when(r.createdAt), r.user, r.customer, saleLabel(r), money(r.totalPrice)])).join(''), esc(moneyLong(refunds.total))));
    else if (refunds.rows.length && rf === 'Print Total') parts.push(table('Refunds', ['Amount'], tr([money(refunds.total)])));

    const dc = mode('discounts', 'Print Table');
    if (discounts.rows.length && dc === 'Print Table') parts.push(table('Discounts', ['Date and Time', 'User', 'Customer', 'Sale', 'Price', 'Discount'], discounts.rows.map((r) => tr([when(r.createdAt), r.user, r.customer, saleLabel(r), money(r.price), money(r.discount)]) + (r.reason ? `<tr class="reason"><td colspan="6">&#9492; ${esc(r.reason)}</td></tr>` : '')).join(''), esc(moneyLong(discounts.total))));
    else if (discounts.rows.length && dc === 'Print Total') parts.push(table('Discounts', ['Amount'], tr([money(discounts.total)])));

    if (toggles.statistics && (closure.userStats || []).length) parts.push(table('Statistics', ['Name', 'Revenue', 'Cost of Goods Sold', 'Profit', 'Profit Percentage', 'Average Sale'], closure.userStats.map((s) => tr([s.user?.name || s.userId, money(s.revenue), money(s.costOfGoodsSold), money(s.profit), `${Number(s.profitPercentage || 0).toFixed(2)}%`, money(s.averageSale)])).join('') + tr(['', money(statsTotal.revenue), money(statsTotal.cogs), money(statsTotal.profit), `${statsTotal.pct.toFixed(2)}%`, money(statsTotal.avg)], 'total')));

    if (toggles.notes !== false && notes.length) parts.push(`<h1 class="notes">Notes</h1>${notes.map((n) => `<p class="note"><b>${esc(n.user || '')}</b><br/>${esc(when(n.createdAt))}<br/>${esc(n.text)}</p>`).join('')}`);

    printHtml(`<html><head><title>Register Closure ${esc(closure.id)}</title>
<style>body{font:13px/1.4 Arial,Helvetica,sans-serif;margin:24px;color:#000}h1{font-size:24px;margin:0 0 14px}h1.notes{margin-top:24px}h2{font-size:13px;font-weight:700;margin:16px 0 0}.sub{margin:0 0 6px}
table{border-collapse:collapse;margin:0 0 8px 2%;width:88%}th,td{border:1px solid #000;padding:6px 8px;text-align:left;vertical-align:top;white-space:nowrap}th{text-align:center}
tr.total td{font-weight:700}tr.reason td{border-top:0;padding-left:14px}
table.info{width:88%;margin:0 0 14px 2%}table.info th{width:50%;text-align:left;font-weight:400}p.note{margin:6px 0 10px;white-space:pre-wrap}</style></head>
<body><h1>Register Closure</h1>${parts.join('')}</body></html>`);
  };

  const addNote = async () => {
    setNoteSaving(true);
    try {
      const list = await registerClosureService.addNote(id, noteDraft);
      setNotes(list);
      setNoteDraft('');
      setNoteOpen(false);
    } catch {
      setMsg({ severity: 'error', text: 'Failed to add the note.' });
    } finally {
      setNoteSaving(false);
    }
  };

  if (!closure) return null;

  const tiles = [
    { key: 'money', title: 'Money Received', bg: TILE.money, printed: printed('paymentMethod', 'Print Table'), value: <Box component="span" sx={{ display: 'block' }}>Expected: {money(closure.expectedAmount)}<br />Received: {money(closure.receivedAmount)}</Box> },
    { key: 'subtype', title: 'Payment Subtype Sales', bg: TILE.subtype, printed: !!closureToggles.paymentSubtypeTotals, value: money(subtypes.total) },
    { key: 'tax', title: 'Tax', bg: TILE.tax, printed: printed('tax', 'Print Table'), value: money(tax.total) },
    ...(account.rows.length ? [{ key: 'account', title: 'Account Sales', bg: TILE.account, printed: printed('accountSales', 'Print Table'), value: money(account.total) }] : []),
    ...(accountPayments.rows.length ? [{ key: 'accountPayments', title: 'Account Payments', bg: TILE.accountPayments, printed: printed('accountPayments', 'Print Table'), value: money(accountPayments.total) }] : []),
    ...(refunds.rows.length ? [{ key: 'refunds', title: 'Refunds', bg: TILE.refunds, printed: printed('refunds', 'Print Table'), value: money(refunds.total) }] : []),
    ...(discounts.rows.length ? [{ key: 'discounts', title: 'Discounts', bg: TILE.discounts, printed: printed('discounts', 'Print Table'), value: money(discounts.total) }] : []),
    ...(Number(movements.total) ? [{ key: 'movements', title: 'Movements', bg: TILE.movements, printed: printed('movements', 'Print Total'), value: money(movements.total) }] : [])
  ];


  return (
    <>
    <Box sx={{ p: 3, '@media print': { p: 0 } }}>
      {msg && (
        <Alert severity={msg.severity} onClose={() => setMsg(null)} sx={{ borderRadius: 0, mb: 2, fontSize: 16 }} className="no-print">
          {msg.text}
        </Alert>
      )}

      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: '48px', display: 'flex', alignItems: 'center', m: 0, height: 48 }}>
        <Button className="no-print" variant="contained" disableRipple disableElevation startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={backBtnSx}>
          Back
        </Button>
        Register Closure
      </Typography>

      <Stack direction="row" spacing="16px" sx={{ mt: '22px', mb: 2 }} className="no-print">
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<PrintOutlinedIcon />} onClick={() => printSlip(false)}>Print</Button>
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<DescriptionOutlinedIcon />} onClick={() => printSlip(true)}>Print Full Page</Button>
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<NoteAddOutlinedIcon />} onClick={() => { setNoteDraft(''); setNoteOpen(true); }}>Add Note</Button>
      </Stack>

      <Paper sx={{ mb: 2, borderRadius: 0, boxShadow: 'none' }}>
        <Table size="small">
          <TableBody>
            {summaryRows.map(([label, value], i) => (
              <TableRow key={label} sx={{ bgcolor: i % 2 === 0 ? '#fff' : '#f8f8f8', '& td': { color: '#000', fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none' } }}>
                <TableCell sx={{ width: 220, fontWeight: 700 }}>{label}</TableCell>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Grid container spacing={2}>
        {tiles.map((t) => (
          <Grid item xs={12} md={4} key={t.key}>
            <Tile title={t.title} bg={t.bg} value={t.value} printed={t.printed} onClick={t.key === 'movements' ? undefined : () => setOverlay(t.key)} />
          </Grid>
        ))}
      </Grid>

      {/* Reference order: Notes, Statistics, Hourly */}
      <Box sx={{ mt: 3 }} data-section="notes">
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 1 }}>Notes</Typography>
        {notes.length === 0 && <Typography sx={{ color: '#676b72', fontSize: 16 }}>No notes have been added to this register closure.</Typography>}
        {notes.map((n) => (
          <Box key={n.id} data-note sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', py: 1 }}>
            {/* Same as the navbar profile: the user's image, else their initials on blue */}
            <Avatar src={n.avatar ? resolveAssetUrl(n.avatar) : undefined} alt={n.user || ''} sx={{ bgcolor: '#1976d2', width: 34, height: 34, fontSize: 13 }}>
              {!n.avatar && initials(n.user)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, color: '#000' }}>
                <Box component="span" sx={{ fontWeight: 700 }}>{n.user || 'Unknown'}</Box>
                <Box component="span" sx={{ color: '#676b72' }} title={when(n.createdAt)}> - {ago(n.createdAt)}</Box>
              </Typography>
              <Typography sx={{ fontSize: 14, color: '#000', whiteSpace: 'pre-wrap' }}>{n.text}</Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 1 }}>Statistics</Typography>
        {/* Reference: sky-blue header row (white caps), zebra rows, blue total row with no label */}
        <Table size="small" data-section="statistics" sx={{ '& td, & th': { border: 0, fontSize: 16, px: 1, py: '8px' } }}>
          <TableHead>
            <TableRow sx={{ bgcolor: STATS_BLUE, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              {['NAME', 'REVENUE', 'COST OF GOODS SOLD', 'PROFIT', 'PROFIT PERCENTAGE', 'AVERAGE SALE'].map((h, i) => (
                <TableCell key={h} align={i ? 'center' : 'left'} sx={{ color: '#fff', fontWeight: 700 }}>{h}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {(closure.userStats || []).map((s, i) => (
              <TableRow key={s.id} sx={{ bgcolor: i % 2 ? '#e0e0e0' : '#f8f8f8', '& td': { color: '#000' } }}>
                <TableCell>{s.user?.name || s.userId}</TableCell>
                <TableCell align="center">{money(s.revenue)}</TableCell>
                <TableCell align="center">{money(s.costOfGoodsSold)}</TableCell>
                <TableCell align="center">{money(s.profit)}</TableCell>
                <TableCell align="center">{Number(s.profitPercentage || 0).toFixed(2)}%</TableCell>
                <TableCell align="center">{money(s.averageSale)}</TableCell>
              </TableRow>
            ))}
            <TableRow data-row="total" sx={{ bgcolor: STATS_BLUE, WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact', '& td': { color: '#fff', fontWeight: 700 } }}>
              <TableCell />
              <TableCell align="center">{money(statsTotal.revenue)}</TableCell>
              <TableCell align="center">{money(statsTotal.cogs)}</TableCell>
              <TableCell align="center">{money(statsTotal.profit)}</TableCell>
              <TableCell align="center">{statsTotal.pct.toFixed(2)}%</TableCell>
              <TableCell align="center">{money(statsTotal.avg)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 2 }}>Hourly</Typography>
        {/* Reference: centred dark segmented toggle, selected tab blue */}
        <Box className="no-print" sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Box data-hourly-tabs sx={{ display: 'inline-flex', border: '1px solid #1f1f1f', borderRadius: '2px', overflow: 'hidden' }}>
            {HOURLY_TABS.map((t, i) => (
              <Box
                key={t.key}
                component="button"
                type="button"
                aria-pressed={hourlyTab === t.key}
                onClick={() => setHourlyTab(t.key)}
                sx={{
                  border: 0, borderLeft: i ? '1px solid #1f1f1f' : 0, cursor: 'pointer', font: 'inherit', fontSize: 16, lineHeight: '24px',
                  px: 2, py: '14px', color: '#fff', bgcolor: hourlyTab === t.key ? '#1c86f2' : '#333',
                  '&:hover': { bgcolor: hourlyTab === t.key ? '#1c86f2' : '#444' }
                }}
              >
                {t.label}
              </Box>
            ))}
          </Box>
        </Box>
        <Box sx={{ height: 400 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={hourlyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 60 }}>
              <CartesianGrid stroke="#e5e5e5" />
              <XAxis dataKey="time" angle={-35} textAnchor="end" height={70} interval={0} tick={{ fontSize: 11, fill: '#000' }} tickLine={false} axisLine={{ stroke: '#ccc' }} />
              <YAxis tick={{ fontSize: 11, fill: '#000' }} tickLine={false} axisLine={false} tickFormatter={hourlyFormat} width={80} allowDecimals={hourlyTab === 'averageSale'} />
              <Tooltip formatter={(v) => [hourlyFormat(v), activeHourlyTab.label]} />
              <Area type="monotone" dataKey="value" stroke={activeHourlyTab.color} strokeWidth={2} fill={activeHourlyTab.fill} fillOpacity={1} dot={{ r: 3, fill: activeHourlyTab.color, strokeWidth: 0 }} activeDot={{ r: 4 }} isAnimationActive animationBegin={0} animationDuration={600} animationEasing="ease-out" />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      </Box>
    </Box>

    <Dialog
      open={noteOpen}
      onClose={() => setNoteOpen(false)}
      transitionDuration={0}
      slotProps={{ backdrop: { sx: { bgcolor: 'transparent' } } }}
      PaperProps={{ sx: { width: 382, maxWidth: 382, m: 0, mt: '60px', borderRadius: 0, overflow: 'visible', boxShadow: 'rgba(0,0,0,0.25) 0px 0px 30px 0px, rgba(0,0,0,0.19) 0px 0px 30px 0px' } }}
    >
      <Box aria-hidden="true" sx={{ width: 120, height: 120, borderRadius: '100%', bgcolor: REF_BLUE, color: REF_TEXT, position: 'absolute', top: -60, left: 'calc(50% - 60px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, lineHeight: 1 }}>
        ?
      </Box>
      <DialogTitle component="h3" sx={{ fontSize: '18.72px', fontWeight: 700, textAlign: 'center', m: '60px 8px 8px', p: 0 }}>
        Add Note
      </DialogTitle>
      <DialogContent sx={{ p: '0 16px 16px', textAlign: 'center', overflow: 'visible' }}>
        <Typography component="p" sx={{ fontSize: 16, textAlign: 'center', mb: 1 }}>
          Add note to register closure?
        </Typography>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          maxLength={2000}
          aria-label="Note"
          style={{ width: 350, height: 129, background: '#fff', border: '1px solid #000', borderRadius: 0, padding: 16, boxSizing: 'border-box', font: 'inherit', fontSize: 16, resize: 'none' }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: '8px', m: '8px 0 0' }}>
          <Button
            disableRipple
            disableElevation
            onClick={() => setNoteOpen(false)}
            sx={{ width: 167, height: 48, minWidth: 167, bgcolor: '#f8f8f8', color: '#676b72', border: '1px solid #676b72', borderRadius: 0, fontSize: 32, lineHeight: 1, fontWeight: 400, textTransform: 'none', boxShadow: 'none', transition: REF_TRANSITION, '&:hover': { bgcolor: '#676b72', color: '#f8f8f8', border: '1px solid #676b72', boxShadow: 'none' } }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            disableElevation
            onClick={addNote}
            disabled={noteSaving}
            sx={{ width: 167, height: 48, minWidth: 167, bgcolor: 'rgb(50,182,67)', color: REF_TEXT, border: `1px solid ${REF_TEXT}`, borderRadius: 0, fontSize: 32, lineHeight: 1, fontWeight: 400, textTransform: 'none', boxShadow: 'none', transition: REF_TRANSITION, '&:hover': { bgcolor: 'rgb(66,200,84)', boxShadow: 'none', border: `1px solid ${REF_TEXT}` } }}
          >
            {noteSaving ? 'Adding…' : 'Add'}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>

    <Overlay open={overlay === 'money'} onClose={() => setOverlay(null)} title="Money Received" bg={TILE.money}
      columns={['Payment Method', 'Expected', 'Received', 'Difference']} rows={moneyRows}
      renderRow={(r, i) => <TableRow key={i}>{cell(r.method)}{cell(money(r.expected))}{cell(money(r.received))}{cell(money(r.received - r.expected))}</TableRow>}
      text="This screen shows the total amount of money that was expected compared to the amount that was received for each payment method type." />

    <Overlay open={overlay === 'subtype'} onClose={() => setOverlay(null)} title="Payment Subtype Sales" bg={TILE.subtype}
      columns={['Payment Subtype', 'Amount']} rows={subtypes.rows}
      renderRow={(r, i) => <TableRow key={i}>{cell(r.subtype)}{cell(money(r.amount))}</TableRow>}
      text="This shows the breakdown of payment types when payment breakdowns are supported. Subtypes come from the payment method and are not controlled by the system. Data is recalculated when this page loads." />

    <Overlay open={overlay === 'tax'} onClose={() => setOverlay(null)} title="Tax" bg={TILE.tax}
      columns={['Tax Rate', 'Revenue', 'Tax']} rows={tax.rows}
      renderRow={(r, i) => <TableRow key={i}>{cell(r.rate)}{cell(money(r.revenue))}{cell(money(r.tax))}</TableRow>}
      text="This screen shows the total revenue and the tax paid by each tax rate. This is stored at the time the register is closed and is not recalculated - for an up-to-date view of the tax for the day, please run a sales report." />

    <Overlay open={overlay === 'account'} onClose={() => setOverlay(null)} title="Account Sales" bg={TILE.account}
      columns={['Date and Time', 'User', 'Customer', 'Sale', 'Amount', 'Outstanding']} rows={account.rows}
      renderRow={(r) => <TableRow key={r.saleId}>{cell(when(r.createdAt))}{cell(r.user)}{cell(r.customer)}{cell(saleLabel(r))}{cell(money(r.amount))}{cell(money(r.outstanding))}</TableRow>}
      text="This screen shows the sales that were put on a customer's account while the register was open, and how much of each is still outstanding." />

    <Overlay open={overlay === 'accountPayments'} onClose={() => setOverlay(null)} title="Account Payments" bg={TILE.accountPayments}
      columns={['Date and Time', 'User', 'Customer', 'Sale', 'Payment Method', 'Amount']} rows={accountPayments.rows}
      renderRow={(r) => <TableRow key={r.id}>{cell(when(r.createdAt))}{cell(r.user)}{cell(r.customer)}{cell(saleLabel(r))}{cell(r.method)}{cell(money(r.amount))}</TableRow>}
      text="This screen shows the payments customers made towards their account while the register was open." />

    <Overlay open={overlay === 'refunds'} onClose={() => setOverlay(null)} title="Refunds" bg={TILE.refunds}
      columns={['Date and Time', 'User', 'Customer', 'Sale', 'Total Price']} rows={refunds.rows}
      renderRow={(r) => <TableRow key={r.saleId}>{cell(when(r.createdAt))}{cell(r.user)}{cell(r.customer)}{cell(saleLabel(r))}{cell(money(r.totalPrice))}</TableRow>}
      text="This screen shows the refunds that were processed while the register was open." />

    <Overlay open={overlay === 'discounts'} onClose={() => setOverlay(null)} title="Discounts" bg={TILE.discounts}
      columns={['Date and Time', 'User', 'Customer', 'Sale', 'Price', 'Discount']} rows={discounts.rows}
      renderRow={(r) => (
        <React.Fragment key={r.saleId}>
          <TableRow>{cell(when(r.createdAt))}{cell(r.user)}{cell(r.customer)}{cell(saleLabel(r))}{cell(money(r.price))}{cell(money(r.discount))}</TableRow>
          {r.reason && <TableRow data-reason><TableCell colSpan={6} sx={{ pl: 4, fontStyle: 'italic', borderTop: 0 }}>└ {r.reason}</TableCell></TableRow>}
        </React.Fragment>
      )}
      text="This screen shows the sales that were discounted while the register was open, with the reason given for each discount." />
    </>
  );
};

export default RegisterClosureView;
