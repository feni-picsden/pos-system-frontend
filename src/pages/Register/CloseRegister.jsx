import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, InputBase, Collapse, Snackbar, Alert } from '@mui/material';
import {
  PointOfSaleOutlined as OpenDrawerIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  HelpOutline as HelpOutlineIcon,
  InfoOutlined as InfoOutlinedIcon,
  MeetingRoomOutlined as MeetingRoomOutlinedIcon,
} from '@mui/icons-material';
import registerService from '../../services/registerService';
import linklyService from '../../services/linklyService';
import NiceError from '../../components/Common/NiceError';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

// Reference tokens (topdrops.onshopfront.com/close). Tailwind palette values the
// reference resolves to, kept literal so nothing depends on the MUI theme.
const PRIMARY = '#5ebbeb';
const N100 = '#f5f5f5';
const N200 = '#e5e5e5';
const N500 = '#737373';
const N600 = '#525252';
const GREEN_BORDER = '#22c55e';
const GREEN_TEXT = '#16a34a';
const RED = '#dc2626';

// Reference buttons: 42px, 12px radius, 8px/32px padding, bold, no uppercase.
const BTN_SX = {
  height: 42,
  borderRadius: '12px',
  px: '32px',
  py: '8px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  whiteSpace: 'nowrap',
  '&:hover': { boxShadow: 'none' },
};
const BTN_GREEN_SX = {
  ...BTN_SX,
  color: GREEN_TEXT,
  border: `1px solid ${GREEN_BORDER}`,
  bgcolor: 'transparent',
  '&:hover': { boxShadow: 'none', bgcolor: 'rgba(34,197,94,0.06)' },
};
const BTN_PRIMARY_SX = {
  ...BTN_SX,
  color: '#fff',
  bgcolor: PRIMARY,
  border: `1px solid ${PRIMARY}`,
  '&:hover': { boxShadow: 'none', bgcolor: '#4aa9db' },
};

// Reference table header: solid #5ebbeb band, white bold, 16px pad, the outer
// corners rounded 12px and nothing else.
const TH_SX = {
  bgcolor: PRIMARY,
  color: '#fff',
  fontWeight: 700,
  fontSize: 16,
  p: '16px',
  border: 0,
  whiteSpace: 'nowrap',
};
const TD_SX = { p: '16px', border: 0, fontSize: 16, color: '#000' };

const fmt = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Number(n) || 0).toFixed(2)}`;

// Reference prints the open time as a coarse relative duration ("5 hours ago").
const timeAgo = (iso) => {
  if (!iso) return '';
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  const units = [
    [86400, 'day'],
    [3600, 'hour'],
    [60, 'minute'],
  ];
  for (const [size, label] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n} ${label}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
};

// Sub-methods the reference nests under a chevron. Gift Card has none.
const SUB_METHODS = {
  EFTPOS: ['Non - Integrated Tyro', 'Non - Integrated Tyro CASH OUT'],
  Linkly: ['EFTPOS', 'EFTPOS Cash Out'],
  Voucher: ['Uber Eats Delivery', 'Shop MyLocal'],
};
const DENOMINATIONS = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];

// Reference money input: borderless field in a rounded white shell with a grey
// "$" prefix. 40px tall, 8px radius.
const MoneyInput = ({ value, onChange, width = 136, grey = false, readOnly = false }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      width,
      maxWidth: '100%',
      height: 40,
      borderRadius: '8px',
      border: `1px solid ${N200}`,
      bgcolor: grey ? N200 : '#fff',
      px: '16px',
      gap: '8px',
    }}
  >
    <Box component="span" sx={{ color: N500, fontSize: 16 }}>$</Box>
    <InputBase
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      type={readOnly ? 'text' : 'number'}
      sx={{ flex: 1, fontSize: 16, '& input': { p: 0 } }}
      inputProps={{ step: '0.01', min: '0' }}
    />
  </Box>
);

const CloseRegister = () => {
  const [preview, setPreview] = useState(null);
  const [received, setReceived] = useState({});
  const [expanded, setExpanded] = useState({});
  const [showMore, setShowMore] = useState(false);
  const [qty, setQty] = useState({});
  const [floatAmount, setFloatAmount] = useState(300);
  const [note, setNote] = useState('');
  // EFTPOS end-of-day settlement (independent of closing the register).
  const [pinpadPaired, setPinpadPaired] = useState(false);
  const [settling, setSettling] = useState(false);
  const [settleSnack, setSettleSnack] = useState(null); // { message, severity }
  const [settleReceipt, setSettleReceipt] = useState(null);
  const navigate = useNavigate();
  const { clearSelectedRegister } = useSelectedRegister();
  const registerId = localStorage.getItem('selectedRegisterId')
    ? parseInt(localStorage.getItem('selectedRegisterId'))
    : null;

  useEffect(() => {
    if (!registerId) return;
    registerService.previewClosure(registerId).then(setPreview).catch(() => {});
    linklyService
      .getPinpadStatus()
      .then((res) => setPinpadPaired(!!res.paired))
      .catch(() => setPinpadPaired(false));
  }, [registerId]);

  const expectedFor = (method) => {
    const map = preview?.paymentBreakdown || {};
    const target = method.trim().toLowerCase();
    for (const [k, v] of Object.entries(map)) {
      if (String(k).trim().toLowerCase() === target) return Number(v) || 0;
    }
    return 0;
  };

  // Rows come from whatever was actually tendered this session (any outlet
  // method name, e.g. 'Credit Card'), so nothing in the breakdown is omitted.
  // Cash is always shown even with no cash sales.
  const methods = [
    'Cash',
    ...Object.keys(preview?.paymentBreakdown || {})
      .filter((m) => m.trim().toLowerCase() !== 'cash')
      .sort(),
  ];

  const inDrawer = DENOMINATIONS.reduce(
    (sum, d) => sum + d * (parseFloat(qty[d]) || 0),
    0,
  );
  const total = inDrawer - (parseFloat(floatAmount) || 0);

  const handleClose = async () => {
    await registerService.closeRegister(registerId, {
      inDrawer,
      floatAmount: parseFloat(floatAmount) || 0,
      note,
      denominations: DENOMINATIONS.map((d) => ({ value: d, qty: parseFloat(qty[d]) || 0 })),
      receivedByMethod: received,
    });
    // Context call, not a raw localStorage wipe: the provider holds the same
    // selection in memory and every screen reads it from there now.
    clearSelectedRegister();
    navigate('/');
  };

  // Runs the pinpad's end-of-day settlement. Never blocks handleClose — a
  // settlement failure must not stop the register from closing.
  const handleSettlement = async () => {
    setSettling(true);
    setSettleReceipt(null);
    try {
      const res = await linklyService.settlement();
      const isTerminal = (s) => ['approved', 'declined', 'failed', 'unknown'].includes(s);
      let txn = res.transaction;
      // Poll ~2s for up to 60s; the GET route reconciles against Linkly
      // directly, so this resolves even without the webhook tunnel.
      for (let i = 0; i < 30 && txn && !isTerminal(txn.status); i++) {
        await new Promise((r) => setTimeout(r, 2000));
        txn = await linklyService.getTransaction(txn.txnRef);
      }
      const ok = txn?.status === 'approved';
      setSettleSnack({
        message: txn?.responseText || `Settlement ${txn?.status || 'timed out'}`,
        severity: ok ? 'success' : 'warning',
      });
      if (txn?.merchantReceipt) setSettleReceipt(txn.merchantReceipt);
    } catch (e) {
      setSettleSnack({
        message: e?.response?.data?.message || e?.response?.data?.error || e.message || 'Settlement failed',
        severity: 'error',
      });
    } finally {
      setSettling(false);
    }
  };

  // A register that was never opened has nothing to close — same reference
  // empty state as Manage Cash, only the sentence differs.
  if (!registerId || localStorage.getItem('selectedRegisterStatus') !== 'Open') {
    return (
      <NiceError
        icon={<MeetingRoomOutlinedIcon sx={{ fontSize: 'inherit' }} />}
        heading="Register not open"
        body="The register hasn't been opened yet so you can't close it."
      />
    );
  }

  const methodRow = (method) => {
    const expected = expectedFor(method);
    const got = parseFloat(received[method]) || 0;
    const subs = SUB_METHODS[method];
    return (
      <React.Fragment key={method}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 170px 110px 1fr',
            alignItems: 'center',
          }}
        >
          <Box sx={{ ...TD_SX, display: 'flex', alignItems: 'center', gap: '4px' }}>
            {subs ? (
              <Box
                component="span"
                onClick={() => setExpanded((p) => ({ ...p, [method]: !p[method] }))}
                sx={{ display: 'flex', cursor: 'pointer', color: N600 }}
              >
                {expanded[method] ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              </Box>
            ) : (
              <Box sx={{ width: 24 }} />
            )}
            {method}
          </Box>
          <Box sx={{ ...TD_SX, textAlign: 'center' }}>{fmt(expected)}</Box>
          <Box sx={{ ...TD_SX, p: '8px' }}>
            <MoneyInput
              value={received[method] ?? ''}
              onChange={(e) => setReceived((p) => ({ ...p, [method]: e.target.value }))}
            />
          </Box>
          <Box sx={{ ...TD_SX, textAlign: 'center' }}>{fmt(got - expected)}</Box>
          <Box sx={{ ...TD_SX, textAlign: 'center' }}>
            {method === 'Cash' && (
              <Button sx={BTN_GREEN_SX} startIcon={<OpenDrawerIcon />}>
                Open Drawer
              </Button>
            )}
            {method === 'Linkly' && (
              <Button sx={BTN_GREEN_SX} startIcon={<ChevronRightIcon />}>
                Options
              </Button>
            )}
          </Box>
        </Box>
        {subs && (
          <Collapse in={!!expanded[method]}>
            {subs.map((sub) => {
              const key = `${method} / ${sub}`;
              const subGot = parseFloat(received[key]) || 0;
              return (
                <Box
                  key={key}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 100px 170px 110px 1fr',
                    alignItems: 'center',
                  }}
                >
                  <Box sx={{ ...TD_SX, pl: '48px', color: N600 }}>{sub}</Box>
                  <Box sx={{ ...TD_SX, textAlign: 'center' }}>{fmt(0)}</Box>
                  <Box sx={{ ...TD_SX, p: '8px' }}>
                    <MoneyInput
                      value={received[key] ?? ''}
                      onChange={(e) => setReceived((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </Box>
                  <Box sx={{ ...TD_SX, textAlign: 'center' }}>{fmt(subGot)}</Box>
                  <Box />
                </Box>
              );
            })}
          </Collapse>
        )}
      </React.Fragment>
    );
  };

  return (
    <Box
      sx={{
        height: 'calc(100vh - 50px)',
        overflow: 'auto',
        p: 2,
        bgcolor: '#fff',
        display: 'flex',
        gap: 4,
      }}
    >
      {/* Left column — reference max-w-3xl, grows, 64px bottom breathing room */}
      <Box sx={{ flexGrow: 1, maxWidth: 768, mb: 8 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, mb: 4 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 30,
              height: 42,
              borderRadius: '12px',
              border: `1px solid ${N500}`,
              color: N600,
              cursor: 'pointer',
            }}
          >
            <HelpOutlineIcon fontSize="small" />
          </Box>
          <Typography sx={{ fontSize: 30, lineHeight: '36px', fontWeight: 700 }}>
            Close Register
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 4, px: '4px', mt: 1, mb: 2 }}>
          <Box>
            <Typography sx={{ fontSize: 14, color: N600 }}>Open Time</Typography>
            <Typography sx={{ fontSize: 16 }}>{timeAgo(preview?.openedAt)}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 14, color: N600 }}>Sale Upload Status</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Typography sx={{ fontSize: 16 }}>All Uploaded</Typography>
              <CheckCircleOutlineIcon sx={{ fontSize: 18, color: GREEN_TEXT }} />
            </Box>
          </Box>
        </Box>

        {/* Payment methods */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 170px 110px 1fr',
            '& > .hd:first-of-type': { borderRadius: '12px 0 0 12px' },
            '& > .hd:last-of-type': { borderRadius: '0 12px 12px 0' },
          }}
        >
          <Box className="hd" sx={TH_SX}>Payment Method</Box>
          <Box className="hd" sx={{ ...TH_SX, textAlign: 'center' }}>Expected</Box>
          <Box className="hd" sx={{ ...TH_SX, textAlign: 'center' }}>Received</Box>
          <Box className="hd" sx={{ ...TH_SX, textAlign: 'center' }}>Difference</Box>
          <Box className="hd" sx={TH_SX} />
        </Box>

        {methodRow('Cash')}

        {/* Reference collapses everything but Cash behind this toggle. */}
        {methods.length > 1 && (
          <>
            <Box
              onClick={() => setShowMore((v) => !v)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                p: '8px',
                cursor: 'pointer',
                fontSize: 16,
                userSelect: 'none',
              }}
            >
              {showMore ? <ExpandMoreIcon /> : <ChevronRightIcon />}
              Show {methods.length - 1} more payment methods
            </Box>
            <Collapse in={showMore}>
              {methods.filter((m) => m !== 'Cash').map(methodRow)}
            </Collapse>
          </>
        )}

        <Box sx={{ mt: 3 }}>
          <Typography sx={{ fontSize: 12, color: N600, mb: '4px' }}>
            Register Closure Note
          </Typography>
          <InputBase
            value={note}
            onChange={(e) => setNote(e.target.value)}
            multiline
            minRows={3}
            sx={{
              width: '100%',
              borderRadius: '12px',
              border: `1px solid ${N200}`,
              p: '12px',
              fontSize: 16,
            }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button sx={BTN_PRIMARY_SX} onClick={handleClose}>
            Close Register
          </Button>
          {pinpadPaired && (
            <Button sx={BTN_GREEN_SX} onClick={handleSettlement} disabled={settling}>
              {settling ? 'Settling…' : 'EFTPOS Settlement'}
            </Button>
          )}
        </Box>
        {settleReceipt && (
          <Box
            component="pre"
            sx={{
              mt: 2,
              p: '12px',
              borderRadius: '12px',
              border: `1px solid ${N200}`,
              bgcolor: N100,
              fontSize: 13,
              overflowX: 'auto',
            }}
          >
            {settleReceipt}
          </Box>
        )}
        <Snackbar
          open={!!settleSnack}
          autoHideDuration={6000}
          onClose={() => setSettleSnack(null)}
        >
          <Alert severity={settleSnack?.severity || 'info'} onClose={() => setSettleSnack(null)}>
            {settleSnack?.message}
          </Alert>
        </Snackbar>
      </Box>

      {/* Right column — reference bleeds this panel to the page edges (-m-4 p-4). */}
      <Box
        sx={{
          flex: 1,
          display: { xs: 'none', md: 'block' },
          m: -2,
          p: 2,
          borderLeft: `1px solid ${N200}`,
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            '& > .hd:first-of-type': { borderRadius: '12px 0 0 12px' },
            '& > .hd:last-of-type': { borderRadius: '0 12px 12px 0' },
          }}
        >
          <Box className="hd" sx={TH_SX}>Denomination</Box>
          <Box className="hd" sx={TH_SX}>Amount</Box>
          <Box className="hd" sx={TH_SX}>Value</Box>
          {DENOMINATIONS.map((d, i) => {
            // Reference stripes every second denomination across all three cells.
            const stripe = i % 2 === 1 ? { bgcolor: N100 } : {};
            const value = d * (parseFloat(qty[d]) || 0);
            return (
              <React.Fragment key={d}>
                <Box sx={{ ...TD_SX, ...stripe, display: 'flex', alignItems: 'center' }}>
                  {fmt(d)}
                </Box>
                <Box sx={{ ...TD_SX, ...stripe, display: 'flex', alignItems: 'center' }}>
                  <MoneyInput
                    value={qty[d] ?? ''}
                    onChange={(e) => setQty((p) => ({ ...p, [d]: e.target.value }))}
                  />
                </Box>
                <Box sx={{ ...TD_SX, ...stripe, display: 'flex', alignItems: 'center' }}>
                  <MoneyInput readOnly value={value ? value.toFixed(2) : ''} />
                </Box>
              </React.Fragment>
            );
          })}
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', mt: 1 }}>
          <Box sx={TD_SX}>In Drawer</Box>
          <Box />
          <Box sx={TD_SX}>{fmt(inDrawer)}</Box>

          <Box sx={{ ...TD_SX, display: 'flex', alignItems: 'center', gap: '4px' }}>
            Float
            <InfoOutlinedIcon sx={{ fontSize: 16, color: N500 }} />
          </Box>
          <Box />
          <Box sx={{ ...TD_SX, p: '8px' }}>
            <MoneyInput
              grey
              width="100%"
              value={floatAmount}
              onChange={(e) => setFloatAmount(e.target.value)}
            />
          </Box>

          <Box sx={TD_SX}>Total</Box>
          <Box />
          <Box sx={{ ...TD_SX, color: total < 0 ? RED : '#000' }}>{fmt(total)}</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default CloseRegister;
