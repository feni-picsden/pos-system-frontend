import React, { useEffect, useState } from 'react';
import { byMode } from '../../theme/sfPalette';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  MenuItem,
  Autocomplete,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { Save as SaveIcon, Refresh as RefreshIcon, CreditCard as CardIcon, Replay as RetryIcon } from '@mui/icons-material';
import drawerService from '../../services/drawerService';
import tyroService from '../../services/tyroService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { formatDate as formatAppDate } from '../../utils/appDateTime';
import {
  NICE_ERROR_SX,
  NICE_ERROR_ICON_SX,
  NICE_ERROR_REASON_SX,
  NICE_ERROR_HEADING_SX,
  NICE_ERROR_BODY_SX,
} from '../../components/StockManagement/productViewStyles';

const BRANDS = ['Epson', 'Star', 'Generic ESC/POS'];

// Reference Hardware Connect Settings chrome: square 50px fields with a 1px
// #000 border and the field name as a small label ABOVE the box; header
// buttons are square, 16px, no shadow. Dropdown papers are square, black
// bordered, no shadow, and the global focus outline is suppressed on items.
const REF_FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: byMode('#fff', '#121212'), height: 50, fontSize: 16, py: 0 },
  '& .MuiOutlinedInput-input, & .MuiAutocomplete-input': { py: '0 !important' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') },
  '& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') },
  '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 },
};
const REF_MENU_SX = {
  borderRadius: 0,
  border: byMode('1px solid #000', '1px solid #a1a1a1'),
  boxShadow: 'none',
  mt: '2px',
  '& li': { fontSize: 16, minHeight: 44 },
  '& li.Mui-selected, & li[aria-selected="true"]': { bgcolor: byMode('#dbeafe !important', 'transparent !important'), color: byMode(undefined, '#00a6f4') },
  '& li:hover': { bgcolor: byMode('#eff6ff', '#0084d1 !important'), color: byMode(undefined, '#fafafa') },
  '& li:focus-visible': { outline: 'none' },
};
const REF_BTN_SX = { borderRadius: 0, textTransform: 'none', fontSize: 16, fontWeight: 400, px: 2.5, py: 1, boxShadow: 'none' };
const RefLabel = ({ children }) => (
  <Typography component="label" sx={{ display: 'block', fontSize: 12, color: byMode('#333', '#d4d4d4'), mb: '4px', ml: '2px' }}>
    {children}
  </Typography>
);

// Where the local print agent (QZ Tray — our Hardware Connect) is downloaded from.
const AGENT_DOWNLOAD_URL = 'https://qz.io/download/';

// Reference ".nice-error" neutral face: a 160px ring, two dots and a flat mouth,
// drawn inline so the stroke weight matches the reference glyph.
const NeutralFace = () => (
  <Box component="svg" viewBox="0 0 160 160" aria-hidden="true" sx={{ display: 'inline-block', width: 160, height: 160, color: byMode('#000', '#f8f8f8') }}>
    <circle cx="80" cy="80" r="72" fill="none" stroke="currentColor" strokeWidth="8" />
    <circle cx="57" cy="62" r="7" fill="currentColor" />
    <circle cx="103" cy="62" r="7" fill="currentColor" />
    <line x1="50" y1="106" x2="110" y2="106" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
  </Box>
);

// Reference: when Hardware Connect cannot be reached the page shows only this
// block (no settings form) — heading, a sentence with an "installing" link, and
// a green Retry.
const AgentError = ({ onRetry, retrying }) => (
  <Box sx={{ ...NICE_ERROR_SX, p: '32px 16px' }} data-testid="hardware-connect-error">
    <Box sx={{ ...NICE_ERROR_ICON_SX, width: 'auto', mr: '24px' }}>
      <NeutralFace />
    </Box>
    <Box sx={NICE_ERROR_REASON_SX}>
      <Typography component="h2" sx={NICE_ERROR_HEADING_SX}>
        Hardware Connect error
      </Typography>
      <Typography component="p" sx={{ ...NICE_ERROR_BODY_SX, m: '0 0 8px' }}>
        Error trying to get Hardware Connect settings. Try{' '}
        <Box component="a" href={AGENT_DOWNLOAD_URL} target="_blank" rel="noopener noreferrer" sx={{ color: byMode('#1a0dab', '#4ca0f5') }}>
          installing
        </Box>{' '}
        or restarting Hardware Connect (QZ Tray) and try again
      </Typography>
      <Box>
        <Button
          variant="contained"
          disableElevation
          startIcon={retrying ? <CircularProgress size={16} color="inherit" /> : <RetryIcon />}
          onClick={onRetry}
          disabled={retrying}
          sx={{
            bgcolor: '#2fb344',
            color: '#fff',
            borderRadius: 0,
            textTransform: 'none',
            fontSize: 16,
            px: 3,
            py: 1.25,
            '&:hover': { bgcolor: '#28a03c' },
          }}
        >
          Retry
        </Button>
      </Box>
    </Box>
  </Box>
);

const HardwareSettings = () => {
  const { confirm } = useAppDialogs();
  const [printer, setPrinter] = useState(drawerService.getDrawerPrinter());
  const [brand, setBrand] = useState(drawerService.getPrinterBrand());
  const [kickCode, setKickCode] = useState(drawerService.getKickCode());
  // Reference "Ignore Kick": on = never send the drawer command (no drawer, or
  // a printer with nothing plugged into its drawer port).
  const [ignoreKick, setIgnoreKick] = useState(drawerService.getIgnoreKick());
  const [tyroPairing, setTyroPairing] = useState(tyroService.getPairing());

  const [printers, setPrinters] = useState([]);
  const [qzAvailable, setQzAvailable] = useState(null); // null = checking
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [testing, setTesting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSuccess = (message) => setSnackbar({ open: true, message, severity: 'success' });
  const showError = (message) => setSnackbar({ open: true, message, severity: 'error' });

  const loadPrinters = async () => {

    setLoadingPrinters(true);
    try {
      const available = await drawerService.isQzAvailable();
      setQzAvailable(available);
      if (available) {
        const list = await drawerService.listPrinters();
        setPrinters(list);
      } else {
        setPrinters([]);
      }
    } catch {
      setQzAvailable(false);
      setPrinters([]);
    } finally {
      setLoadingPrinters(false);
    }
  };

  useEffect(() => {
    loadPrinters();
  }, []);

  const handleSave = () => {
    drawerService.setDrawerPrinter(printer);
    drawerService.setPrinterBrand(brand);
    drawerService.setKickCode(kickCode);
    drawerService.setIgnoreKick(ignoreKick);
    showSuccess('Hardware settings saved');
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await drawerService.kickDrawer({ printerName: printer, kickCode, ignoreKick });
      if (res.skipped) {
        showSuccess('Ignore Kick is on — no drawer command was sent');
      } else {
        showSuccess(`Drawer command sent to "${res.printer}" (hex ${res.hex})`);
      }
    } catch (err) {
      if (err.code === 'QZ_UNAVAILABLE') {
        showError('QZ Tray is not running on this terminal. Start QZ Tray and try again.');
      } else if (err.code === 'NO_PRINTER') {
        showError('No printer selected. Choose a printer above (or set a default printer).');
      } else {
        showError(err?.message || 'Failed to send drawer command');
      }
    } finally {
      setTesting(false);
    }
  };

  // Hex preview of the entered kick code (so the user can confirm it's valid).
  const kickHexPreview = drawerService.parseKickToHex(kickCode);

  // Reference: no agent = no settings form, only the error block + Retry.
  if (qzAvailable === false) {
    return <AgentError onRetry={loadPrinters} retrying={loadingPrinters} />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Reference header: title left, "Test Open Cash Drawer" (grey outline) + blue Save right. */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2 }}>Hardware Connect Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Hardware Connect (QZ Tray) running on this terminal
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={16} /> : null}
            onClick={handleTest}
            disabled={testing}
            sx={{ ...REF_BTN_SX, color: byMode('#555', '#d4d4d4'), borderColor: byMode('#ccc', '#a1a1a1'), bgcolor: byMode('#fff', 'transparent'), '&:hover': { borderColor: byMode('#999', '#d4d4d4'), bgcolor: byMode('#fafafa', 'rgba(255,255,255,0.08)') } }}
          >
            Test Open Cash Drawer
          </Button>
          <Button
            variant="contained"
            disableElevation
            startIcon={<SaveIcon />}
            onClick={handleSave}
            sx={{ ...REF_BTN_SX, bgcolor: '#1e88e5', '&:hover': { bgcolor: '#1976d2' } }}
          >
            Save
          </Button>
        </Box>
      </Box>

      {/* Reference section: "Receipt Printer" heading, labels ABOVE square fields, 3 per row. */}
      <Typography component="h2" sx={{ fontSize: 20, fontWeight: 700, mb: 1 }}>Receipt Printer</Typography>
      <Grid container spacing={3} sx={{ px: 1.5 }}>
        <Grid item xs={12} md={4}>
          <RefLabel>Printer</RefLabel>
          {/* Reference: a plain dropdown of the agent's printers (arrow only - no
              clear / refresh icons; the list refreshes on load and on Retry). */}
          <Autocomplete
            options={printers}
            value={printer || null}
            onChange={(_e, val) => setPrinter(val || '')}
            loading={loadingPrinters}
            disableClearable
            slotProps={{ paper: { sx: REF_MENU_SX } }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Select the receipt printer"
                inputProps={{ ...params.inputProps, 'aria-label': 'Printer' }}
                sx={REF_FIELD_SX}
              />
            )}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <RefLabel>Receipt Printer Brand</RefLabel>
          <TextField
            select
            fullWidth
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            sx={REF_FIELD_SX}
            SelectProps={{
              SelectDisplayProps: { 'aria-label': 'Receipt Printer Brand', 'data-testid': 'brand-select' },
              MenuProps: { marginThreshold: 0, PaperProps: { sx: REF_MENU_SX } },
            }}
          >
            {BRANDS.map((b) => (
              <MenuItem key={b} value={b}>{b}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} md={4}>
          <RefLabel>Cash Drawer Kick Code</RefLabel>
          <TextField
            fullWidth
            value={kickCode}
            onChange={(e) => setKickCode(e.target.value)}
            placeholder="27,112,0,25,250"
            inputProps={{ 'aria-label': 'Cash Drawer Kick Code', title: `Sent as hex ${kickHexPreview}` }}
            sx={REF_FIELD_SX}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          {/* Reference "Ignore Kick" toggle: switch + label, vertically centred like a field row. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 50 }}>
            <ShopfrontSwitch
              checked={ignoreKick}
              onChange={(e) => setIgnoreKick(e.target.checked)}
              inputProps={{ 'aria-label': 'Ignore Kick' }}
            />
            <Typography sx={{ fontSize: 16 }}>Ignore Kick</Typography>
          </Box>
        </Grid>
      </Grid>

      {/* Tyro terminal pairing — stored per browser device (reference model:
          the pairing lives in the browser). Replacement terminal = clear here,
          then pair the new terminal from the sell screen's Tyro payment.
          Hidden with the Tyro payment type (user 20/10/2026) - kept, not removed. */}
      {false && (
      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CardIcon color="primary" />
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Tyro EFTPOS</Typography>
        </Box>
        {tyroPairing ? (
          <>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              Terminal paired on this device — Merchant ID <b>{tyroPairing.merchantId}</b>,
              Terminal ID <b>{tyroPairing.terminalId}</b>
              {tyroPairing.pairedAt ? ` (since ${formatAppDate(tyroPairing.pairedAt)})` : ''}.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Replacing the terminal? Clear the pairing on the old terminal's menu first
              (contact Tyro for the exact steps), then clear it here and pair the new
              terminal from the sell screen.
            </Typography>
            <Button
              variant="outlined"
              color="error"
              sx={{ textTransform: 'none', fontWeight: 600 }}
              onClick={async () => {
                const ok = await confirm(
                  'Clear the Tyro terminal pairing on this device? The next Tyro payment will show the pairing screen again.',
                  { title: 'Clear Tyro pairing', confirmText: 'Clear pairing', severity: 'warning' }
                );
                if (!ok) return;
                tyroService.clearPairing();
                setTyroPairing(null);
                showSuccess('Tyro pairing cleared on this device');
              }}
            >
              Clear pairing on this device
            </Button>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No Tyro terminal is paired on this device. Pairing happens from the sell
            screen: take a payment with a Tyro payment method and the pairing screen
            will appear.
          </Typography>
        )}
      </Paper>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default HardwareSettings;
