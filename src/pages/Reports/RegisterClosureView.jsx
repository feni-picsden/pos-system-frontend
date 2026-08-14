import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Paper, Grid, Table, TableHead, TableBody, TableRow, TableCell, Button, Dialog, DialogTitle, DialogContent, IconButton, Stack, ClickAwayListener, Alert } from '@mui/material';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import { useParams, useNavigate } from 'react-router-dom';
import registerClosureService from '../../services/registerClosureService';

// Reference toolbar palette (measured on the Shopfront closure view)
const REF_BLUE = '#1C86F2';
const REF_BLUE_HOVER = '#73B4F7';
const REF_TEXT = '#f8f8f8';
const REF_TRANSITION = 'background 0.2s ease, color 0.2s ease';

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

const integrationItemSx = {
  bgcolor: REF_BLUE,
  color: REF_TEXT,
  borderRadius: 0,
  p: '16px',
  height: 74,
  mb: '8px',
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  justifyContent: 'flex-start',
  boxShadow: 'rgba(0,0,0,0.25) 0px 0px 30px 0px',
  transition: REF_TRANSITION,
  '&:hover': { bgcolor: REF_BLUE_HOVER, boxShadow: 'rgba(0,0,0,0.25) 0px 0px 30px 0px' },
  '& .MuiButton-startIcon': { mr: '8px', ml: 0, '& svg': { fontSize: 40, width: 40, height: 40 } }
};

const esc = (v) => String(v ?? '').replace(/[<>&'"]/g, (c) => (
  { '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]
));

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

const Tile = ({ title, value, onClick, bg = '#0B56A2', icon }) => (
  <Paper
    elevation={1}
    onClick={onClick}
    sx={{
      p: 2,
      // Avoid stretching to the tallest column; keep tiles compact
      minHeight: 140,
      cursor: onClick ? 'pointer' : 'default',
      bgcolor: bg,
      color: '#fff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {icon}
    </Box>
    <Typography variant="h4" sx={{ fontWeight: 700, mt: 1 }}>{value}</Typography>
  </Paper>
);

const RegisterClosureView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [closure, setClosure] = useState(null);
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxData, setTaxData] = useState({ rows: [], totalTax: 0 });
  const [moneyOpen, setMoneyOpen] = useState(false);
  const [moneyRows, setMoneyRows] = useState([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [integrationMsg, setIntegrationMsg] = useState(null);
  const [paySubtypeOpen, setPaySubtypeOpen] = useState(false);
  const [paySubtypeRows, setPaySubtypeRows] = useState([]);
  const [hourlyRows, setHourlyRows] = useState([]);
  const [hourlyTab, setHourlyTab] = useState('revenue'); 

  useEffect(() => {
    const load = async () => {
      const data = await registerClosureService.getById(id);
      setClosure(data);
      // If backend provides taxTotal, seed the Tax tile immediately
      if (data && typeof data.taxTotal !== 'undefined') {
        setTaxData(prev => ({ ...prev, totalTax: Number(data.taxTotal) || 0 }));
      }
    };
    load();
  }, [id]);
  const hourlyChartData = useMemo(() => {
    if (!closure) return [];
    const hourMs = 60 * 60 * 1000;
    const startActual = new Date(closure.openedAt);
    const endActual = new Date(closure.closedAt);
    const start = new Date(startActual);
    start.setMinutes(0, 0, 0);
    // Ensure at least 24 hours of ticks from the start hour
    const minEnd = new Date(start.getTime() + 23 * hourMs);
    const end = new Date(Math.max(endActual.getTime(), minEnd.getTime()));

    const hourKey = (d) => {
      const k = new Date(d);
      k.setMinutes(0, 0, 0);
      return k.toISOString();
    };
    const map = new Map((hourlyRows || []).map(r => [hourKey(new Date(r.time)), r]));

    const result = [];
    for (let t = start.getTime(); t <= end.getTime(); t += hourMs) {
      const d = new Date(t);
      const key = hourKey(d);
      const row = map.get(key);
      const value = Number(row ? row[hourlyTab] : 0);
      const label = d.toLocaleString([], {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
      });
      result.push({ time: label, value });
    }
    return result;
  }, [closure, hourlyRows, hourlyTab]);

  useEffect(() => {
    const loadHourly = async () => {
      const data = await registerClosureService.getHourlyStats(id);
      setHourlyRows(data.rows || []);
    };
    loadHourly();
  }, [id]);

  const openTax = async () => {
    const data = await registerClosureService.getTax(id);
    setTaxData({ rows: data.rows || [], totalTax: data.totalTax || 0 });
    setTaxOpen(true);
  };

  const openMoney = () => {
    const pb = closure.paymentBreakdown || {};
    const rows = Object.keys(pb).map(method => {
      const entry = pb[method];
      if (entry && typeof entry === 'object') {
        return { method, expected: Number(entry.expected || 0), received: Number(entry.received || 0) };
      }
      return { method, expected: Number(entry || 0), received: Number(entry || 0) };
    });
    setMoneyRows(rows);
    setMoneyOpen(true);
  };

  const summaryRows = closure ? [
    ['Outlet', closure.register?.outlet?.name || '-'],
    ['Register', closure.register?.name || closure.registerId],
    ['Opened At', new Date(closure.openedAt).toLocaleString()],
    ['Closed At', new Date(closure.closedAt).toLocaleString()],
    ['Closed By', closure.closedBy?.name || '-'],
    ['Total Transactions', closure.totalTransactions]
  ] : [];

  // "Print" prints the closure slip only; "Print Full Page" prints the whole page.
  const printSlip = () => {
    const money = (n) => `$${Number(n || 0).toFixed(2)}`;
    const lines = [
      ...summaryRows,
      ['Money Received', money(closure.receivedAmount)],
      ['Expected', money(closure.expectedAmount)],
      ['Movements', money(closure.cashMovementsTotal)],
      ['Tax', money(taxData.totalTax)]
    ];
    printHtml(`<html><head><title>Register Closure ${esc(closure.id)}</title>
<style>body{font:14px/1.5 monospace;margin:16px;width:280px}h1{font-size:16px;margin:0 0 12px}
table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}
td:last-child{text-align:right}hr{border:0;border-top:1px dashed #000;margin:8px 0}</style></head>
<body><h1>Register Closure</h1><table>${lines.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table>
${(closure.userStats || []).length ? `<hr /><table>${closure.userStats.map(s => `<tr><td>${esc(s.user?.name || s.userId)}</td><td>${money(s.revenue)}</td></tr>`).join('')}</table>` : ''}
${closure.note ? `<hr /><div>${esc(closure.note)}</div>` : ''}</body></html>`);
  };

  const downloadXml = () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<RegisterClosure id="${esc(closure.id)}">
  <Outlet>${esc(closure.register?.outlet?.name || '')}</Outlet>
  <Register>${esc(closure.register?.name || closure.registerId)}</Register>
  <OpenedAt>${esc(new Date(closure.openedAt).toISOString())}</OpenedAt>
  <ClosedAt>${esc(new Date(closure.closedAt).toISOString())}</ClosedAt>
  <ClosedBy>${esc(closure.closedBy?.name || '')}</ClosedBy>
  <TotalTransactions>${esc(closure.totalTransactions)}</TotalTransactions>
  <ExpectedAmount>${Number(closure.expectedAmount || 0).toFixed(2)}</ExpectedAmount>
  <ReceivedAmount>${Number(closure.receivedAmount || 0).toFixed(2)}</ReceivedAmount>
  <TaxTotal>${Number(taxData.totalTax || 0).toFixed(2)}</TaxTotal>
  <Note>${esc(closure.note || '')}</Note>
  <UserStats>
${(closure.userStats || []).map(s => `    <User name="${esc(s.user?.name || s.userId)}" revenue="${Number(s.revenue || 0).toFixed(2)}" profit="${Number(s.profit || 0).toFixed(2)}" />`).join('\n')}
  </UserStats>
</RegisterClosure>`;
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/xml' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `register-closure-${closure.id}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    setIntegrationsOpen(false);
    setIntegrationMsg({ severity: 'success', text: `Downloaded register-closure-${closure.id}.xml` });
  };

  // ponytail: no accounting/banner-group integration is configured in this build, so the
  // documented "Resend to <software>" reports that instead of pretending it sent.
  const resendToIba = () => {
    setIntegrationsOpen(false);
    setIntegrationMsg({ severity: 'warning', text: 'No active accounting integration is configured, so this closure could not be resent to IBA.' });
  };

  const saveNote = async () => {
    setNoteSaving(true);
    try {
      const updated = await registerClosureService.updateNote(id, noteDraft);
      setClosure(prev => ({ ...prev, note: updated?.note ?? (noteDraft.trim() || null) }));
      setNoteOpen(false);
    } catch {
      setIntegrationMsg({ severity: 'error', text: 'Failed to save the note.' });
    } finally {
      setNoteSaving(false);
    }
  };

  if (!closure) return null;

  return (
    <>
    <Box sx={{ p: 2 }}>
      {integrationMsg && (
        <Alert
          severity={integrationMsg.severity}
          onClose={() => setIntegrationMsg(null)}
          sx={{ borderRadius: 0, mb: 2, fontSize: 16 }}
        >
          {integrationMsg.text}
        </Alert>
      )}

      <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: '48px', display: 'flex', alignItems: 'center', m: 0, height: 48 }}>
        <Button variant="contained" disableRipple disableElevation startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)} sx={backBtnSx}>
          Back
        </Button>
        Register Closure
      </Typography>

      <Stack direction="row" spacing="16px" sx={{ mt: '22px', mb: 2 }}>
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<PrintOutlinedIcon />} onClick={printSlip}>Print</Button>
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<DescriptionOutlinedIcon />} onClick={() => window.print()}>Print Full Page</Button>
        <Button variant="contained" disableRipple disableElevation sx={toolbarBtnSx} startIcon={<NoteAddOutlinedIcon />} onClick={() => { setNoteDraft(closure.note || ''); setNoteOpen(true); }}>Add Note</Button>
        <ClickAwayListener onClickAway={() => setIntegrationsOpen(false)}>
          <Box sx={{ position: 'relative' }}>
            <Button
              variant="contained"
              disableRipple
              disableElevation
              onClick={() => setIntegrationsOpen(o => !o)}
              startIcon={integrationsOpen ? null : <IntegrationInstructionsIcon />}
              endIcon={integrationsOpen ? null : <ArrowDropDownIcon />}
              sx={{ ...toolbarBtnSx, width: 175, ...(integrationsOpen ? { bgcolor: REF_BLUE_HOVER, color: 'transparent' } : {}) }}
            >
              {integrationsOpen ? '' : 'Integrations'}
            </Button>
            {integrationsOpen && (
              <Box sx={{ position: 'absolute', left: 0, top: 'calc(100% + 8px)', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
                <Button variant="contained" disableRipple disableElevation sx={{ ...integrationItemSx, width: 182 }} startIcon={<SendOutlinedIcon />} onClick={resendToIba}>Resend to IBA</Button>
                <Button variant="contained" disableRipple disableElevation sx={{ ...integrationItemSx, width: 189 }} startIcon={<FileDownloadOutlinedIcon />} onClick={downloadXml}>Download XML</Button>
              </Box>
            )}
          </Box>
        </ClickAwayListener>
      </Stack>

      <Paper sx={{ mb: 2, borderRadius: 0, boxShadow: 'none' }}>
        <Table size="small">
          <TableBody>
            {summaryRows.map(([label, value], i) => (
              <TableRow
                key={label}
                sx={{
                  bgcolor: i % 2 === 0 ? '#fff' : '#f8f8f8',
                  '& td': { color: '#000', fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none' }
                }}
              >
                <TableCell sx={{ width: 220, fontWeight: 700 }}>{label}</TableCell>
                <TableCell>{value}</TableCell>
              </TableRow>
            ))}
            {closure.note && (
              <TableRow sx={{ bgcolor: summaryRows.length % 2 === 0 ? '#fff' : '#f8f8f8', '& td': { color: '#000', fontSize: 16, padding: '8px 8px 8px 10px', borderBottom: 'none' } }}>
                <TableCell sx={{ width: 220, fontWeight: 700 }}>Note</TableCell>
                <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{closure.note}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Tile

            title="Money Received"
            value={`$${Number(closure.receivedAmount || 0).toFixed(2)}`}
            onClick={openMoney}
            icon={<PrintOutlinedIcon sx={{ color: 'rgba(255,255,255,0.9)' }} />}
          />
          <Paper sx={{ p: 2, mt: 2, bgcolor: '#0D6B6B', color: '#fff' ,minHeight: 140}}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Movements</Typography>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                ${Number(closure.cashMovementsTotal || 0).toFixed(2)}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Tile  bg="rgb(51, 65, 85)" title="Payment Subtype Sales" value={`$${Number(closure.expectedAmount || 0).toFixed(2)}`} onClick={async () => {
            const data = await registerClosureService.getPaymentSubtypes(id);
            setPaySubtypeRows(data.rows || []);
            setPaySubtypeOpen(true);
          }} />
        </Grid>
        <Grid item xs={12} md={4}>
          <Tile title="Tax" value={`$${Number(taxData.totalTax || 0).toFixed(2)}`} onClick={openTax} />
        </Grid>
      </Grid>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Statistics</Typography>
        <Paper>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Cost of Goods Sold</TableCell>
                <TableCell align="right">Profit</TableCell>
                <TableCell align="right">Profit %</TableCell>
                <TableCell align="right">Average Sale</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {closure.userStats?.map(s => (
                <TableRow key={s.id}>
                  <TableCell>{s.user?.name || s.userId}</TableCell>
                  <TableCell align="right">${s.revenue.toFixed(2)}</TableCell>
                  <TableCell align="right">${s.costOfGoodsSold.toFixed(2)}</TableCell>
                  <TableCell align="right">${s.profit.toFixed(2)}</TableCell>
                  <TableCell align="right">{s.profitPercentage.toFixed(2)}%</TableCell>
                  <TableCell align="right">${s.averageSale.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </Box>

      <Box sx={{ mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Hourly</Typography>
        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
          {['revenue','customers','transactions','averageSale'].map(key => (
            <Button key={key} variant={hourlyTab===key?'contained':'outlined'} size="small" onClick={()=>setHourlyTab(key)} sx={{ textTransform:'none' }}>
              {key==='averageSale'?'Average Sale':key.charAt(0).toUpperCase()+key.slice(1)}
            </Button>
          ))}
          <Box sx={{ flexGrow: 1 }} />
          <Button size="small" onClick={async ()=>{
            const data = await registerClosureService.getHourlyStats(id);
            setHourlyRows(data.rows || []);
          }}>Refresh</Button>
        </Stack>
        <Paper sx={{ p: 2 }}>
          <Box sx={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={hourlyChartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" angle={-45} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v)=> hourlyTab==='revenue'||hourlyTab==='averageSale'?`$${Number(v).toFixed(2)}`:Number(v)} />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>
    </Box>
    <Dialog
      open={noteOpen}
      onClose={() => setNoteOpen(false)}
      transitionDuration={0}
      slotProps={{ backdrop: { sx: { bgcolor: 'transparent' } } }}
      PaperProps={{
        sx: {
          width: 382,
          maxWidth: 382,
          m: 0,
          mt: '60px',
          borderRadius: 0,
          overflow: 'visible',
          boxShadow: 'rgba(0,0,0,0.25) 0px 0px 30px 0px, rgba(0,0,0,0.19) 0px 0px 30px 0px'
        }
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          width: 120, height: 120, borderRadius: '100%', bgcolor: REF_BLUE, color: REF_TEXT,
          position: 'absolute', top: -60, left: 'calc(50% - 60px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, lineHeight: 1
        }}
      >
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
          style={{
            width: 350, height: 129, background: '#fff', border: '1px solid #000',
            borderRadius: 0, padding: 16, boxSizing: 'border-box', font: 'inherit', fontSize: 16, resize: 'none'
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: '8px', m: '8px 0 0' }}>
          <Button
            disableRipple
            disableElevation
            onClick={() => setNoteOpen(false)}
            sx={{
              width: 167, height: 48, minWidth: 167, bgcolor: '#f8f8f8', color: '#676b72',
              border: '1px solid #676b72', borderRadius: 0, fontSize: 32, lineHeight: 1, fontWeight: 400,
              textTransform: 'none', boxShadow: 'none', transition: REF_TRANSITION,
              '&:hover': { bgcolor: '#676b72', color: '#f8f8f8', border: '1px solid #676b72', boxShadow: 'none' }
            }}
          >
            Cancel
          </Button>
          <Button
            disableRipple
            disableElevation
            onClick={saveNote}
            disabled={noteSaving}
            sx={{
              width: 167, height: 48, minWidth: 167, bgcolor: 'rgb(50,182,67)', color: REF_TEXT,
              border: `1px solid ${REF_TEXT}`, borderRadius: 0, fontSize: 32, lineHeight: 1, fontWeight: 400,
              textTransform: 'none', boxShadow: 'none', transition: REF_TRANSITION,
              '&:hover': { bgcolor: 'rgb(66,200,84)', boxShadow: 'none', border: `1px solid ${REF_TEXT}` }
            }}
          >
            Add
          </Button>
        </Box>
      </DialogContent>
    </Dialog>

    <Dialog
      open={paySubtypeOpen}
      onClose={() => setPaySubtypeOpen(false)}
      sx={{
        '& .MuiDialog-container': { alignItems: 'end' }
      }}
      PaperProps={{ sx: { bgcolor: 'rgb(51, 65, 85)', color: '#fff', height: '94vh', width: '100vw', maxWidth: 'unset', margin: 0 } }}
    >
      <DialogTitle sx={{ m: 0, p: 2, textAlign: 'center', fontWeight: 700 }}>
        Payment Subtype Sales
        <IconButton aria-label="close" onClick={() => setPaySubtypeOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.2)' }}>
        <Table size="small" sx={{ '& td, & th': { borderColor: 'rgba(255,255,255,0.3)', color: '#fff' } }}>
          <TableHead>
            <TableRow>
              <TableCell>Payment Subtype</TableCell>
              <TableCell align="right">Amount</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {paySubtypeRows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.subtype}</TableCell>
                <TableCell align="right">${Number(r.amount || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.9, textAlign: 'center' }}>
          This shows the breakdown of payment types when payment breakdowns are supported. Subtypes come from the payment method and are not controlled by the system. Data is recalculated when this page loads.
        </Typography>
      </DialogContent>
    </Dialog>
    <Dialog
      open={taxOpen}
      onClose={() => setTaxOpen(false)}
      sx={{

        '& .MuiDialog-container': {
          alignItems: 'end', 
        }
      }}
      // fullScreen
      PaperProps={{ sx: { bgcolor: '#0B56A2', color: '#fff',height: '94vh' ,width: '100vw' , maxWidth:"unset",margin:0} }}
    >
      <DialogTitle sx={{ m: 0, p: 2, textAlign: 'center', fontWeight: 700 }}>
        Tax
        <IconButton
          aria-label="close"
          onClick={() => setTaxOpen(false)}
          sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.2)' }}>
        <Table size="small" sx={{
          '& td, & th': {
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff'
          }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>Tax Rate</TableCell>
              <TableCell align="right">Revenue</TableCell>
              <TableCell align="right">Tax</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {taxData.rows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.rate}</TableCell>
                <TableCell align="right">${Number(r.revenue || 0).toFixed(2)}</TableCell>
                <TableCell align="right">${Number(r.tax || 0).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.9 }}>
          This screen shows the total revenue and the tax paid by each tax rate. This is stored at the time the register is closed and is not recalculated - for an up-to-date view of the tax for the day, please run a sales report.
        </Typography>
      </DialogContent>
    </Dialog>

    <Dialog
      open={moneyOpen}
      onClose={() => setMoneyOpen(false)}
      sx={{
        '& .MuiDialog-container': {
          alignItems: 'end', 
        }
      }}
      // fullScreen
      PaperProps={{ sx: { bgcolor: '#0B56A2', color: '#fff',height: '94vh' ,width: '100vw' , maxWidth:"unset",margin:0} }}
    >
      <DialogTitle sx={{ m: 0, p: 2, textAlign: 'center', fontWeight: 700 }}>
        Money Received
        <IconButton aria-label="close" onClick={() => setMoneyOpen(false)} sx={{ position: 'absolute', right: 8, top: 8, color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ borderColor: 'rgba(255,255,255,0.2)' }}>
        <Table size="small" sx={{
          '& td, & th': {
            borderColor: 'rgba(255,255,255,0.3)',
            color: '#fff'
          }
        }}>
          <TableHead>
            <TableRow>
              <TableCell>Payment Method</TableCell>
              <TableCell align="right">Expected</TableCell>
              <TableCell align="right">Received</TableCell>
              <TableCell align="right">Difference</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {moneyRows.map((r, i) => (
              <TableRow key={i}>
                <TableCell>{r.method}</TableCell>
                <TableCell align="right">${Number(r.expected || 0).toFixed(2)}</TableCell>
                <TableCell align="right">${Number(r.received || 0).toFixed(2)}</TableCell>
                <TableCell align="right">${(Number(r.received || 0) - Number(r.expected || 0)).toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.9 }}>
          This screen shows the total amount of money that was expected compared to the amount that was received for each payment method type.
        </Typography>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default RegisterClosureView;

