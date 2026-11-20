import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Link,
  Select,
  MenuItem,
} from '@mui/material';
import {
  ArrowRightAltOutlined,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  FileUpload as UploadIcon,
} from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import productService from '../../services/productService';
import ProductImportHelpDrawer from '../../components/Products/ProductImportHelpDrawer';
import { byMode } from '../../theme/sfPalette';

// Reference (Stock Management > Products > Import Products, 16/11/2026): one page
// for both importers. Blue "<- Back" + title + "Looking for the file format?
// There is the Simple or Advanced file format" (links open the help article in a
// drawer), an "Import Mode" Simple / Advanced dropdown top-right, and a full-page
// dashed drop zone "Upload a file or drag and drop". Choosing a file shows it
// with Import / Cancel; results come back in the same dialog as before.

const backButtonSx = {
  minWidth: 120,
  height: 44,
  px: 2,
  gap: '6px',
  borderRadius: '12px',
  bgcolor: byMode('#1c86f2', '#5ebbeb'),
  color: byMode('#f8f8f8', '#232323'),
  boxShadow: 'none',
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1,
  textTransform: 'none',
  '&:hover': { bgcolor: byMode('#1a78d8', '#4aa9dd'), boxShadow: 'none' },
};

const linkSx = {
  fontSize: 16,
  color: byMode('rgb(0,0,238)', '#4ca0f5'),
  textDecoration: 'underline',
  verticalAlign: 'baseline',
  cursor: 'pointer',
  fontFamily: 'inherit',
  '&:hover': { color: byMode('rgb(0,0,238)', '#4ca0f5') },
};

const selectSx = {
  width: 216,
  height: 40,
  bgcolor: byMode('#fff', '#121212'),
  borderRadius: '8px',
  fontSize: 16,
  textAlign: 'left',
  '& .MuiSelect-select': { py: 1, pl: 1.5, textAlign: 'left' },
  '& .MuiSelect-icon': { fontSize: 18, color: byMode('#000', '#f8f8f8') },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1'), borderWidth: 1 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#a1a1a1') },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#2b7fff'), borderWidth: 1 },
};

const MENU_PROPS = {
  PaperProps: {
    sx: {
      mt: 0.5, borderRadius: '8px', border: 1, borderStyle: 'solid', borderColor: byMode('#000', '#a1a1a1'), boxShadow: 'none',
      // Reference: selected option is blue text on white, no fill.
      '& .MuiMenuItem-root': {
        fontSize: 16, py: 2, px: 2,
        '&.Mui-selected, &.Mui-selected.Mui-focusVisible, &.Mui-focusVisible': { bgcolor: 'transparent', color: byMode('#1c86f2', '#00a6f4'), outline: 'none', boxShadow: 'none' },
        '&:focus, &:focus-visible': { outline: 'none', boxShadow: 'none' },
        '&:hover, &.Mui-selected:hover': { bgcolor: byMode('#f5f5f5', '#0084d1') },
        'html[data-theme="dark"] &:hover, html[data-theme="dark"] &.Mui-selected:hover': { color: '#fafafa' },
      },
    },
  },
};

const primaryBtnSx = {
  height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none',
  bgcolor: '#5ebbeb', color: byMode('#fff', '#232323'), '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: byMode('#cfe9f7', '#2e5a6e'), color: byMode('#fff', '#8a8d91') },
};
const cancelBtnSx = {
  height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none',
  bgcolor: byMode('#dddddd', '#3a3a3a'), color: byMode('#000', '#f8f8f8'), '&:hover': { bgcolor: byMode('#cccccc', '#4a4a4a'), boxShadow: 'none' },
};

const isCsv = (file) => file && (file.type === 'text/csv' || /\.csv$/i.test(file.name));

// Browser-side CSV read (same rules as the server: quotes, commas in quotes, CRLF, BOM).
const parseCsv = (text) => {
  const src = String(text || '').replace(/^\uFEFF/, '');
  const records = []; let row = []; let field = ''; let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) { if (ch === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += ch; }
    else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\r') { /* skip */ }
    else if (ch === '\n') { row.push(field); field = ''; records.push(row); row = []; }
    else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); records.push(row); }
  const nonBlank = records.filter((r) => r.some((v) => String(v).trim() !== ''));
  if (!nonBlank.length) return { headers: [], rows: [] };
  return { headers: nonBlank[0].map((h) => h.trim().toLowerCase()), rows: nonBlank.slice(1).map((r) => r.map((v) => v.trim())) };
};

// Reference validates the whole file on upload and shows one toast, e.g. "One or
// more rows has an invalid case quantity, ensure all the case quantities are
// whole numbers". Returns the message or null.
const validateCsv = (text, mode) => {
  const { headers, rows } = parseCsv(text);
  if (!headers.length || !rows.length) return 'The file must contain a header row and at least one product row';
  const required = mode === 'advanced' ? ['name'] : ['name', 'cost', 'sell_price'];
  const missing = required.filter((c) => !headers.includes(c));
  if (missing.length) return `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`;
  const whole = (v) => v === '' || /^\d+$/.test(v);
  const col = (name) => headers.indexOf(name);
  const cq = col('case_quantity');
  if (cq !== -1 && rows.some((r) => !whole(r[cq] ?? ''))) return 'One or more rows has an invalid case quantity, ensure all the case quantities are whole numbers';
  const qtyCols = headers.map((h, i) => (/^(price_qty_|barcode_qty_)\d+$/.test(h) ? i : -1)).filter((i) => i !== -1);
  if (qtyCols.some((i) => rows.some((r) => !whole(r[i] ?? '')))) return 'One or more rows has an invalid quantity, ensure all the price and barcode quantities are whole numbers';
  if (rows.some((r) => r.length !== headers.length)) return 'One or more rows has a different number of columns to the header row';
  return null;
};

const TOAST_MS = 6000;
// Reference toast: pink "!" block, message, countdown ring, top centre.
const ImportToast = ({ message, onClose }) => {
  const [left, setLeft] = useState(100);
  React.useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const pct = Math.max(0, 100 - ((Date.now() - start) / TOAST_MS) * 100);
      setLeft(pct);
      if (pct <= 0) { clearInterval(id); onClose(); }
    }, 100);
    return () => clearInterval(id);
  }, [onClose]);
  return (
    <Box role="alert" data-testid="import-toast" sx={{ position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 1500, display: 'flex', alignItems: 'stretch', width: 'min(752px, calc(100vw - 32px))', bgcolor: byMode('#fff', '#232323'), borderRadius: '0 0 8px 8px', boxShadow: '0 2px 12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
      <Box sx={{ width: 52, bgcolor: '#f9c7cf', color: '#c62828', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700 }}>!</Box>
      <Typography sx={{ flex: 1, fontSize: 16, color: byMode('#000', '#f8f8f8'), px: 2, py: 1.5, lineHeight: 1.3 }}>{message}</Typography>
      <Box onClick={onClose} sx={{ width: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Dismiss">
        <CircularProgress variant="determinate" value={left} size={24} thickness={3} sx={{ color: '#9e9e9e' }} />
      </Box>
    </Box>
  );
};

const ImportProducts = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef(null);
  const mode = searchParams.get('mode') === 'advanced' ? 'advanced' : 'simple';
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [helpArticle, setHelpArticle] = useState(null); // 'simple' | 'advanced' | null
  const clearError = React.useCallback(() => setError(''), []);

  const setMode = (m) => {
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
    setSearchParams(m === 'advanced' ? { mode: 'advanced' } : {}, { replace: true });
  };

  // Reference: the file is checked and imported as soon as it is dropped / chosen.
  const takeFile = async (file) => {
    if (!file || importing) return;
    setError('');
    if (!isCsv(file)) { setError('Please upload a CSV file'); return; }
    let text = '';
    try { text = await file.text(); } catch { setError('The file could not be read'); return; }
    const problem = validateCsv(text, mode);
    if (problem) { setError(problem); if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    try {
      setImporting(true);
      const result = mode === 'advanced'
        ? await productService.importAdvancedProducts(file)
        : await productService.importProducts(file);
      setImportResults(result);
      setResultsDialogOpen(true);
    } catch (err) {
      console.error('Error importing products:', err);
      setError(err.response?.data?.error || 'Failed to import products');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    takeFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  };

  const handleFileSelect = (e) => takeFile(e.target.files && e.target.files[0]);

  const handleCloseResults = () => {
    setResultsDialogOpen(false);
    setImportResults(null);
  };

  const handleGoBack = () => navigate('/products');

  return (
    <Box sx={{ minHeight: 'calc(100vh - 50px)', bgcolor: byMode('#f5f5f5', '#121212'), px: '8px', pb: '8px', display: 'flex', flexDirection: 'column' }}>
      {/* Header: Back + title/subtitle on the left, Import Mode on the right */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '16px', m: '20px 0 16px' }}>
        <Button data-testid="back-button" onClick={handleGoBack} disableRipple disableElevation sx={backButtonSx}>
          <ArrowRightAltOutlined sx={{ fontSize: 22, transform: 'scaleX(-1)' }} />
          Back
        </Button>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: byMode('#000', '#f8f8f8'), lineHeight: 1.1, m: 0 }}>
            Import Products
          </Typography>
          <Typography component="p" sx={{ fontSize: 16, color: byMode('#000', '#d4d4d4'), mt: 0.5 }}>
            Looking for the file format? There is the{' '}
            <Link component="button" type="button" data-testid="help-simple" onClick={() => setHelpArticle('simple')} sx={linkSx}>Simple</Link>
            {' '}or{' '}
            <Link component="button" type="button" data-testid="help-advanced" onClick={() => setHelpArticle('advanced')} sx={linkSx}>Advanced</Link>
            {' '}file format
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography component="label" htmlFor="import-mode-select" sx={{ display: 'block', fontSize: 16, color: byMode('#000', '#f8f8f8'), mb: 0.5 }}>
            Import Mode
          </Typography>
          <Select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            disabled={importing}
            MenuProps={MENU_PROPS}
            inputProps={{ id: 'import-mode-select', 'aria-label': 'Import Mode' }}
            SelectDisplayProps={{ 'data-testid': 'import-mode' }}
            sx={selectSx}
          >
            <MenuItem value="simple">Simple</MenuItem>
            <MenuItem value="advanced">Advanced</MenuItem>
          </Select>
        </Box>
      </Box>

      {error && <ImportToast message={error} onClose={clearError} />}

      {/* Drop zone fills the page (reference) */}
      <Box
        data-testid="import-dropzone"
        role="button"
        tabIndex={0}
        sx={{
          flex: 1,
          minHeight: 420,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          border: '2px dashed',
          borderColor: dragActive ? byMode('#676b72', '#d4d4d4') : byMode('#bdbdbd', '#a1a1a1'),
          bgcolor: dragActive ? byMode('#eeeeee', '#1e1e1e') : 'transparent',
          color: byMode('#9e9e9e', '#a0a4aa'),
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'background 200ms ease, color 200ms ease',
          '&:hover': { color: byMode('#676b72', '#d4d4d4'), borderColor: byMode('#9e9e9e', '#d4d4d4') },
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !importing && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileSelect}
          data-testid="import-file-input"
          style={{ display: 'none' }}
        />
        {importing ? (
          <>
            <CircularProgress size={40} sx={{ color: '#5ebbeb' }} />
            <Typography sx={{ fontSize: 16, color: byMode('#676b72', '#a0a4aa'), mt: 1 }}>Importing products...</Typography>
          </>
        ) : (
          <>
            <UploadIcon sx={{ fontSize: 56 }} />
            <Typography sx={{ fontSize: 15, color: byMode('#000', '#d4d4d4') }}>
              <Box component="span" sx={{ color: byMode('#5ebbeb', '#4ca0f5') }}>Upload a file</Box> or drag and drop
            </Typography>
          </>
        )}
      </Box>

      <ProductImportHelpDrawer open={Boolean(helpArticle)} article={helpArticle || 'simple'} onClose={() => setHelpArticle(null)} />

      {/* Import Results Dialog */}
      <Dialog open={resultsDialogOpen} onClose={handleCloseResults} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '12px' } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>
          Import Results
          <IconButton onClick={handleCloseResults} sx={{ position: 'absolute', right: 8, top: 8 }} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {importResults && (
            <Box data-testid="import-results">
              <Typography variant="body1" gutterBottom>{importResults.message}</Typography>
              <Box sx={{ display: 'flex', gap: 2, my: 2 }}>
                <Chip icon={<CheckCircleIcon />} label={`Successful: ${importResults.results.successful}`} color="success" />
                <Chip icon={<ErrorIcon />} label={`Failed: ${importResults.results.failed}`} color="error" />
                <Chip label={`Total: ${importResults.results.total}`} color="default" />
              </Box>
              {importResults.results.errors && importResults.results.errors.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Errors:</Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResults.results.errors.map((er, index) => (
                          <TableRow key={index}>
                            <TableCell>{er.row}</TableCell>
                            <TableCell>{er.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={handleCloseResults} disableElevation sx={cancelBtnSx}>Close</Button>
          <Button onClick={handleGoBack} variant="contained" disableElevation sx={primaryBtnSx}>View Products</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImportProducts;
