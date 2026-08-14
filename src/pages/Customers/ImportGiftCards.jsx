import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Alert,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  FormLabel,
} from '@mui/material';
import {
  ArrowRightAltOutlined,
  Close as CloseIcon,
  UploadFileOutlined,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import giftCardService from '../../services/giftCardService';
import outletService from '../../services/outletService';
import { useAuth } from '../../contexts/AuthContext';
import ReportTable from '../../components/Reports/ReportTable';

const FORMAT_HELP_URL =
  'https://support.onshopfront.com/hc/en-us/articles/115003889472#h_01J1XSTXFWP56RWPDKP6WTDZ87';

// Reference nests the Back button inside the <h1>, so it inherits the 32px font.
const backButtonSx = {
  minWidth: 136,
  width: 136,
  height: 48,
  p: '4px 8px',
  gap: '4px',
  borderRadius: 0,
  bgcolor: '#1c86f2',
  color: '#f8f8f8',
  border: '1px solid currentColor',
  boxShadow: 'none',
  fontSize: 'inherit',
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  transition: 'background 200ms ease, color 200ms ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
};

// Border/icon/text all ride one inherited `color`, so hover moves them together.
const dropzoneSx = {
  flex: 1,
  minHeight: 0,
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  p: 0,
  bgcolor: 'transparent',
  color: '#bdbdbd',
  border: '2px dashed currentColor',
  borderRadius: 0,
  boxShadow: 'none',
  cursor: 'pointer',
  textAlign: 'center',
  fontFamily: 'inherit',
  fontSize: 24,
  fontWeight: 400,
  transition: 'background 200ms ease, color 200ms ease',
  '&:hover': { color: '#676b72' },
};

const primaryBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 3,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  bgcolor: '#5ebbeb',
  color: '#fff',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const cancelBtnSx = {
  height: 42,
  borderRadius: '12px',
  px: 3,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  bgcolor: '#dddddd',
  color: '#000',
  '&:hover': { bgcolor: '#cccccc', boxShadow: 'none' },
};

const money = (value) => (Number.isFinite(value) ? `$${value.toFixed(2)}` : '$0.00');

// ponytail: IMPORT money guard — strip an optional currency symbol and return a
// finite number >= 0, else null. Keeps NaN/negative out of the preview (the
// backend rejects the same rows on import).
const parseMoney = (raw) => {
  const n = parseFloat(String(raw ?? '').replace(/[$€£,]/g, '').trim());
  return Number.isFinite(n) && n >= 0 ? n : null;
};

const previewColumns = [
  { field: 'code', headerName: 'Code', width: 240 },
  { field: 'originalAmount', headerName: 'Original Amount', width: 180, format: money },
  { field: 'currentAmount', headerName: 'Current Amount', width: 180, format: money },
  {
    field: 'expiry',
    headerName: 'Expiry',
    width: 160,
    format: (value) => (value ? new Date(value).toLocaleDateString('en-GB') : ''),
  },
];

const ImportGiftCards = () => {
  const navigate = useNavigate();
  const { isSuperAdmin, getOutletId } = useAuth();
  const [formatDialogOpen, setFormatDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [selectedOutlet, setSelectedOutlet] = useState('');
  const [loadingOutlets, setLoadingOutlets] = useState(false);

  const handleBack = () => {
    navigate('/customers/gift-cards');
  };

  // Load outlets if super admin
  useEffect(() => {
    const loadOutlets = async () => {
      if (isSuperAdmin()) {
        setLoadingOutlets(true);
        try {
          const response = await outletService.getAllOutlets();
          const fetchedOutlets = response.outlets || [];
          setOutlets(fetchedOutlets);
          // Set first outlet as default
          if (fetchedOutlets.length > 0) {
            setSelectedOutlet(fetchedOutlets[0].id.toString());
          }
        } catch (error) {
          console.error('Error loading outlets:', error);
          setOutlets([]);
        } finally {
          setLoadingOutlets(false);
        }
      } else {
        // Regular user - set their outlet
        const outletId = getOutletId();
        if (outletId) {
          setSelectedOutlet(outletId.toString());
        }
      }
    };

    loadOutlets();
  }, [isSuperAdmin, getOutletId]);

  const parseCSV = (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    // Parse header to get column indices
    const header = lines[0].toLowerCase().split(',').map(col => col.trim());
    const codeIndex = header.indexOf('code');
    const balanceIndex = header.indexOf('balance');
    const originalIndex = header.indexOf('original');
    const expiryIndex = header.indexOf('expiry');

    if (codeIndex === -1 || balanceIndex === -1) {
      throw new Error('CSV must contain "code" and "balance" columns');
    }

    const results = [];
    // Parse all rows (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = line.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
      
      if (values.length >= 2) {
        const currentAmount = parseMoney(values[balanceIndex]);
        const parsedOriginal = originalIndex !== -1 ? parseMoney(values[originalIndex]) : null;
        const item = {
          code: values[codeIndex] || '',
          originalAmount: parsedOriginal !== null ? parsedOriginal : currentAmount,
          currentAmount,
          expiry: expiryIndex !== -1 && values[expiryIndex] ? values[expiryIndex] : null,
        };
        results.push(item);
      }
    }

    return results;
  };

  const processFile = async (file) => {
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        setError('No valid gift card data found in the CSV file');
        return;
      }

      // Store the file and show preview
      setUploadedFile(file);
      setPreviewData(parsedData);
    } catch (err) {
      console.error('Error parsing CSV:', err);
      setError(err.message || 'Failed to parse CSV file. Please check the file format.');
    }
  };

  const handleImport = async () => {
    if (!uploadedFile) return;

    setLoading(true);
    setError(null);

    try {
      const response = await giftCardService.importGiftCards(
        uploadedFile, 
        selectedOutlet ? parseInt(selectedOutlet) : null
      );
      
      setSuccess(response.message || `Successfully imported gift cards`);
      
      // Redirect back after 2 seconds
      setTimeout(() => {
        navigate('/customers/gift-cards');
      }, 2000);
    } catch (err) {
      console.error('Error importing gift cards:', err);
      setError(err.response?.data?.error || err.message || 'Failed to import gift cards. Please check the file format.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreviewData(null);
    setUploadedFile(null);
    setError(null);
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (file) {
        processFile(file);
      }
    };
    input.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const file = e.dataTransfer.files[0];
    processFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: 'calc(100vh - 50px)',
        bgcolor: '#f5f5f5',
        px: '8px',
        pb: '8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title carries the Back button inline: one 32px line, no header band */}
      <Box
        component="h1"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          m: '21.44px 4px',
          fontSize: 32,
          fontWeight: 700,
          color: '#000',
          lineHeight: 1,
        }}
      >
        <Button
          data-testid="back-button"
          onClick={handleBack}
          disableRipple
          disableElevation
          sx={backButtonSx}
        >
          <ArrowRightAltOutlined sx={{ fontSize: 'inherit', transform: 'scaleX(-1)' }} />
          Back
        </Button>
        Import Gift Cards
      </Box>

      {/* Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        {!previewData ? (
          <>
            {/* File Format Link */}
            <Typography component="p" sx={{ fontSize: 16, color: '#000', m: '0 0 16px' }}>
              Looking for the file format?{' '}
              <Link
                href={FORMAT_HELP_URL}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  fontSize: 16,
                  color: 'rgb(0,0,238)',
                  textDecoration: 'underline',
                  transition: 'none',
                  '&:hover': { color: 'rgb(0,0,238)' },
                }}
              >
                Click here.
              </Link>
            </Typography>

            {/* Error and Success Messages */}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}{' '}
                <Link
                  component="button"
                  type="button"
                  onClick={() => setFormatDialogOpen(true)}
                  sx={{ fontSize: 14, verticalAlign: 'baseline' }}
                >
                  View the file format.
                </Link>
              </Alert>
            )}

            {/* Upload Zone */}
            <Box
              component="button"
              type="button"
              sx={{ ...dropzoneSx, ...(dragActive ? { color: '#676b72' } : {}) }}
              onDrop={handleDrop}
              onDragOver={handleDrag}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onClick={handleFileSelect}
            >
              {loading ? (
                'Importing gift cards...'
              ) : (
                <>
                  <UploadFileOutlined sx={{ fontSize: 48 }} />
                  Drop in a file or click to select a file
                </>
              )}
            </Box>
          </>
        ) : (
          <>
            {/* Preview Section */}
            <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <Typography component="p" sx={{ fontSize: 16, color: '#000', m: '0 0 16px' }}>
                Loaded the first 10 lines from the import.
              </Typography>

              {/* Outlet Filter */}
              {isSuperAdmin() && outlets.length > 0 && (
                <Paper sx={{ p: 2, mb: 2 }}>
                  <FormControl fullWidth>
                    <FormLabel sx={{ mb: 1, fontSize: '0.875rem', fontWeight: 600, color: 'text.primary' }}>
                      Select Outlet
                    </FormLabel>
                    <Select
                      value={selectedOutlet}
                      onChange={(e) => setSelectedOutlet(e.target.value)}
                      disabled={loadingOutlets || loading}
                      displayEmpty
                      sx={{
                        bgcolor: '#fff',
                        borderRadius: '8px',
                        fontSize: 16,
                        '& .MuiSelect-select': { py: 1.5 },
                        '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                        '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#000',
                          borderWidth: 2,
                        },
                      }}
                    >
                      {outlets.map((outlet) => (
                        <MenuItem key={outlet.id} value={outlet.id.toString()}>
                          {outlet.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>
              )}

              {/* Error and Success Messages */}
              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                  {error}
                </Alert>
              )}
              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                  {success}
                </Alert>
              )}

              {/* Preview Table */}
              <Box sx={{ flex: 1, minHeight: 0, mb: 2 }}>
                <ReportTable
                  data={previewData.slice(0, 10)}
                  columns={previewColumns}
                  maxHeight="100%"
                  hideFooter
                />
              </Box>

              {/* Action Buttons */}
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleCancel}
                  disabled={loading}
                  sx={cancelBtnSx}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  disableElevation
                  onClick={handleImport}
                  disabled={loading}
                  sx={primaryBtnSx}
                >
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Import'}
                </Button>
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Format Dialog */}
      <Dialog
        open={formatDialogOpen}
        onClose={() => setFormatDialogOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight={600}>
            Gift Card Import Format
          </Typography>
          <IconButton onClick={() => setFormatDialogOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent dividers>
          <Typography variant="body2" paragraph>
            You can import gift cards without the need to sell them. This allows the gift cards to be instantly redeemable.
          </Typography>

          <Typography variant="h6" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
            CSV File Format
          </Typography>

          <Typography variant="body2" paragraph>
            Your CSV file can contain the following columns:
          </Typography>

          <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Required</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><code>code</code></TableCell>
                  <TableCell>The unique gift card code</TableCell>
                  <TableCell><strong>Yes</strong></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>balance</code></TableCell>
                  <TableCell>The current balance of the gift card</TableCell>
                  <TableCell><strong>Yes</strong></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>outlet</code></TableCell>
                  <TableCell>The UUID of the outlet (only applies to multi outlet stores)</TableCell>
                  <TableCell>No</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>original</code></TableCell>
                  <TableCell>The original gift card sale amount</TableCell>
                  <TableCell>No</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>expiry</code></TableCell>
                  <TableCell>The expiry date of the gift card</TableCell>
                  <TableCell>No</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="h6" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
            Important Notes
          </Typography>

          <Box component="ul" sx={{ pl: 3, mb: 2 }}>
            <li><Typography variant="body2">Column order does not matter</Typography></li>
            <li><Typography variant="body2">Columns are case sensitive</Typography></li>
            <li><Typography variant="body2">All other columns present will be ignored</Typography></li>
            <li><Typography variant="body2">Date must be in <strong>YYYY-MM-DD</strong> format</Typography></li>
            <li><Typography variant="body2">Gift card value can include the currency symbol (e.g. "$" and "€")</Typography></li>
          </Box>

          <Typography variant="h6" fontWeight={600} sx={{ mt: 3, mb: 2 }}>
            Example CSV
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: '#f9f9f9', fontFamily: 'monospace', fontSize: '0.85rem' }}>
            code,balance,outlet,original,expiry<br/>
            GC001,50.00,,50.00,2025-12-31<br/>
            GC002,100.00,,100.00,2025-12-31<br/>
            9310246030534,$50.00,,,2024-04-11
          </Paper>

          <Link
            href={FORMAT_HELP_URL}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              display: 'inline-block',
              mt: 3,
              fontSize: 16,
              color: 'rgb(0,0,238)',
              textDecoration: 'underline',
            }}
          >
            View full article
          </Link>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setFormatDialogOpen(false)}
            variant="contained"
            disableElevation
            sx={primaryBtnSx}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImportGiftCards;

