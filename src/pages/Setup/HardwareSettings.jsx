import React, { useEffect, useState } from 'react';
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
import { Save as SaveIcon, PointOfSale as DrawerIcon, Refresh as RefreshIcon, CreditCard as CardIcon } from '@mui/icons-material';
import drawerService from '../../services/drawerService';
import tyroService from '../../services/tyroService';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

const BRANDS = ['Epson', 'Star', 'Generic ESC/POS'];

const HardwareSettings = () => {
  const { confirm } = useAppDialogs();
  const [printer, setPrinter] = useState(drawerService.getDrawerPrinter());
  const [brand, setBrand] = useState(drawerService.getPrinterBrand());
  const [kickCode, setKickCode] = useState(drawerService.getKickCode());
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
    showSuccess('Hardware settings saved');
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await drawerService.kickDrawer({ printerName: printer, kickCode });
      showSuccess(`Drawer command sent to "${res.printer}" (hex ${res.hex})`);
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

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>Hardware Connect Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure the receipt printer that triggers the cash drawer. Requires QZ Tray running on this terminal.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={16} /> : <DrawerIcon />}
            onClick={handleTest}
            disabled={testing}
          >
            Test Open Cash Drawer
          </Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
            Save
          </Button>
        </Box>
      </Box>

      {qzAvailable === false && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          QZ Tray was not detected. Install/launch QZ Tray on this terminal to select a printer and open the drawer.
          You can still enter settings now; they'll apply once QZ Tray is running.
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Receipt Printer</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Autocomplete
              freeSolo
              options={printers}
              value={printer}
              onChange={(_e, val) => setPrinter(val || '')}
              onInputChange={(_e, val) => setPrinter(val || '')}
              loading={loadingPrinters}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Printer"
                  placeholder="Select or type the receipt printer name"
                  helperText="The printer the cash drawer is plugged into (leave blank to use the system default)."
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        <Tooltip title="Refresh printer list">
                          <span>
                            <Button size="small" onClick={loadPrinters} disabled={loadingPrinters} sx={{ minWidth: 0, px: 1 }}>
                              <RefreshIcon fontSize="small" />
                            </Button>
                          </span>
                        </Tooltip>
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />
          </Grid>

          <Grid item xs={12} md={3}>
            <TextField
              select
              fullWidth
              label="Receipt Printer Brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            >
              {BRANDS.map((b) => (
                <MenuItem key={b} value={b}>{b}</MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="Cash Drawer Kick Code"
              value={kickCode}
              onChange={(e) => setKickCode(e.target.value)}
              placeholder="27,112,0,25,250"
              helperText={`Decimal (e.g. 27,112,0,25,250) or hex. Sent as: ${kickHexPreview}`}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Tyro terminal pairing — stored per browser device (reference model:
          the pairing lives in the browser). Replacement terminal = clear here,
          then pair the new terminal from the sell screen's Tyro payment. */}
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
              {tyroPairing.pairedAt ? ` (since ${new Date(tyroPairing.pairedAt).toLocaleDateString()})` : ''}.
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

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
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
