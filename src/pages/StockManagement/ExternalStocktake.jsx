import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Autocomplete,
  FormControlLabel,
  Chip,
  Link,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import {
  UploadFileOutlined as ImportIcon,
  FileDownloadOutlined as ExportIcon,
  HelpOutline as HelpIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { outletService } from '../../services/outletService';
import stocktakeService from '../../services/stocktakeService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const FORMAT_HELP_URL =
  'https://support.onshopfront.com/hc/en-us/articles/34108517200909#h_01JKF6V9DC3HBSAFDNNWABBFA3';

const toolbarBtnSx = {
  bgcolor: '#5ebbeb',
  color: '#ffffff',
  height: 42,
  width: 253,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const dialogPaperSx = {
  width: 448,
  maxWidth: '100%',
  borderRadius: '8px',
  boxShadow: 'none',
};

const dialogHeaderSx = {
  bgcolor: '#c9e8f8',
  color: '#1a5f86',
  fontSize: 18,
  fontWeight: 600,
  p: 2,
  display: 'flex',
  alignItems: 'center',
  gap: 1,
};

const cancelBtnSx = {
  bgcolor: '#dddddd',
  color: '#000000',
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#d0d0d0', boxShadow: 'none' },
};

const primaryBtnSx = {
  bgcolor: '#5ebbeb',
  color: '#ffffff',
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  textTransform: 'none',
  boxShadow: 'none',
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#ebebeb', color: '#8e8e8e' },
};

const outletFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '2px' },
  },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};

const outletPopperSx = {
  '& .MuiAutocomplete-paper': {
    borderRadius: '8px',
    border: '1px solid #404040',
    boxShadow: 'none',
  },
  // ponytail: && doubles specificity so MUI's default selected/focus tint (rgba(25,118,210,.12)) loses
  '& .MuiAutocomplete-option': {
    color: '#5ebbeb',
    fontSize: 16,
    backgroundColor: 'transparent',
    '&&:hover': { backgroundColor: '#f8f8f8' },
    '&&[aria-selected="true"]': { backgroundColor: '#f8f8f8' },
    '&&.Mui-focused': { backgroundColor: '#f8f8f8' },
    '&&[aria-selected="true"].Mui-focused': { backgroundColor: '#f8f8f8' },
    '&&[aria-selected="true"].Mui-focusVisible': { backgroundColor: '#f8f8f8' },
  },
};

const FieldLabel = ({ children }) => (
  <Typography sx={{ mb: 1, fontSize: 14, color: '#676b72' }}>{children}</Typography>
);

const OutletCombobox = ({ outlets, value, onChange }) => (
  <Autocomplete
    options={outlets}
    getOptionLabel={(o) => o?.name || ''}
    isOptionEqualToValue={(o, v) => o.id === v.id}
    value={outlets.find((o) => o.id === value) || null}
    onChange={(_e, option) => onChange(option ? option.id : '')}
    slotProps={{ popper: { sx: outletPopperSx, className: 'sf-combo-popper' } }}
    renderInput={(params) => (
      <TextField {...params} placeholder="Select an outlet" sx={outletFieldSx} />
    )}
  />
);

const useOutlets = (open) => {
  const [outlets, setOutlets] = useState([]);
  useEffect(() => {
    if (!open) return;
    outletService
      .getAllOutlets()
      .then((res) => setOutlets(res.outlets || []))
      .catch((err) => console.error('Error loading outlets:', err));
  }, [open]);
  return outlets;
};

const ImportStocktakeDialog = ({ open, onClose, onImport }) => {
  const [formData, setFormData] = useState({
    file: null,
    outletId: '',
    inventoryMethod: 'override',
    zeroStockNotCounted: false,
    importCosts: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const outlets = useOutlets(open);

  useEffect(() => {
    if (outlets.length && !formData.outletId) {
      setFormData((prev) => ({ ...prev, outletId: outlets[0].id }));
    }
  }, [outlets, formData.outletId]);

  const handleSubmit = async () => {
    if (!formData.file || !formData.outletId) {
      setError('Please select a file and outlet');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onImport({
        file: formData.file,
        outletId: parseInt(formData.outletId),
        inventoryMethod: formData.inventoryMethod,
        zeroStockNotCounted: formData.zeroStockNotCounted,
        importCosts: formData.importCosts,
      });
      handleClose();
    } catch (err) {
      setError(err.message || 'Failed to import stocktake file');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      file: null,
      outletId: '',
      inventoryMethod: 'override',
      zeroStockNotCounted: false,
      importCosts: false,
    });
    setError('');
    onClose();
  };

  const segmentSx = (active) => ({
    flex: 1,
    height: 48,
    borderRadius: '4px',
    fontSize: 16,
    fontWeight: 400,
    textTransform: 'none',
    boxShadow: 'none',
    bgcolor: active ? '#5ebbeb' : 'transparent',
    color: active ? '#ffffff' : '#000000',
    '&:hover': { bgcolor: active ? '#4aa9dd' : '#d8d8d8', boxShadow: 'none' },
  });

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle sx={dialogHeaderSx}>
        <HelpIcon sx={{ fontSize: 20 }} />
        Import Stocktake
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Stocktaker File */}
          <Box>
            <FieldLabel>Stocktaker File</FieldLabel>
            <Box
              sx={{
                border: '1px solid #404040',
                borderRadius: '8px',
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
              }}
            >
              <input
                type="file"
                accept="text/csv"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, file: e.target.files[0] || null }))
                }
              />
            </Box>
          </Box>

          {/* Outlet */}
          <Box>
            <FieldLabel>Outlet</FieldLabel>
            <OutletCombobox
              outlets={outlets}
              value={formData.outletId}
              onChange={(outletId) => setFormData((prev) => ({ ...prev, outletId }))}
            />
          </Box>

          {/* Inventory Insertion Method */}
          <Box>
            <FieldLabel>Inventory Insertion Method</FieldLabel>
            <Stack direction="row" sx={{ bgcolor: '#e5e5e5', borderRadius: '4px', p: 0 }}>
              {['override', 'add'].map((method) => (
                <Button
                  key={method}
                  disableElevation
                  onClick={() => setFormData((prev) => ({ ...prev, inventoryMethod: method }))}
                  sx={segmentSx(formData.inventoryMethod === method)}
                >
                  {method === 'override' ? 'Override' : 'Add'}
                </Button>
              ))}
            </Stack>
          </Box>

          {/* Zero Stock Not Counted */}
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={formData.zeroStockNotCounted}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, zeroStockNotCounted: e.target.checked }))
                }
              />
            }
            label="Zero Stock Not Counted"
            sx={{ ml: 0, gap: 1.5 }}
          />

          {/* Import Costs */}
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={formData.importCosts}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, importCosts: e.target.checked }))
                }
              />
            }
            label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>Import Costs</span>
                <Tooltip title="If enabled, this will override the current products cost with the imported costs. This is typically not wanted">
                  <HelpIcon sx={{ fontSize: 16, color: '#676b72' }} />
                </Tooltip>
              </Stack>
            }
            sx={{ ml: 0, gap: 1.5 }}
          />

          <Link
            href={FORMAT_HELP_URL}
            target="_blank"
            rel="noopener"
            sx={{ textAlign: 'center', color: 'rgb(0,0,238)', fontSize: 14 }}
          >
            For information about formatting click here.
          </Link>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={handleClose} disabled={loading} sx={cancelBtnSx}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.file || !formData.outletId || loading}
          sx={primaryBtnSx}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#8e8e8e' }} /> : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const ExportStocktakeDialog = ({ open, onClose, onExport, defaultOutletId }) => {
  const [outletId, setOutletId] = useState('');
  const [includeNoBarcode, setIncludeNoBarcode] = useState(false);
  const [loading, setLoading] = useState(false);
  const outlets = useOutlets(open);

  useEffect(() => {
    if (!open) return;
    setOutletId((prev) => prev || defaultOutletId || outlets[0]?.id || '');
  }, [open, outlets, defaultOutletId]);

  const handleExport = async () => {
    setLoading(true);
    try {
      await onExport({ outletId, includeNoBarcode });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: dialogPaperSx }}>
      <DialogTitle sx={dialogHeaderSx}>
        <HelpIcon sx={{ fontSize: 20 }} />
        Export Stocktake File
      </DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Box>
            <FieldLabel>Outlet</FieldLabel>
            <OutletCombobox outlets={outlets} value={outletId} onChange={setOutletId} />
          </Box>
          <FormControlLabel
            control={
              <ShopfrontSwitch
                checked={includeNoBarcode}
                onChange={(e) => setIncludeNoBarcode(e.target.checked)}
              />
            }
            label="Include products that don't have barcodes"
            sx={{ ml: 0, gap: 1.5 }}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} disabled={loading} sx={cancelBtnSx}>
          Cancel
        </Button>
        <Button onClick={handleExport} disabled={!outletId || loading} sx={primaryBtnSx}>
          {loading ? <CircularProgress size={20} sx={{ color: '#8e8e8e' }} /> : 'Export'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default function ExternalStocktake() {
  const [stocktakeFiles, setStocktakeFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStocktakeFiles();
  }, []);

  const loadStocktakeFiles = async () => {
    try {
      setLoading(true);
      const response = await stocktakeService.getExternalStocktakes();
      setStocktakeFiles(response.data || []);
    } catch (err) {
      console.error('Error loading stocktake files:', err);
      setError('Failed to load stocktake files');
      setStocktakeFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleImportFile = async (importData) => {
    try {
      const formData = new FormData();
      formData.append('file', importData.file);
      formData.append('outletId', importData.outletId);
      formData.append('inventoryMethod', importData.inventoryMethod);
      formData.append('zeroStockNotCounted', importData.zeroStockNotCounted);
      formData.append('importCosts', importData.importCosts);

      await stocktakeService.importExternalStocktake(formData);
      await loadStocktakeFiles();
    } catch (err) {
      console.error('Import error:', err);
      throw new Error('Failed to import stocktake file');
    }
  };

  // ponytail: includeNoBarcode is passed as a query hint only; the existing template
  // endpoint takes (outletId, format) — widen the service when the API supports it.
  const handleExportFile = async ({ outletId }) => {
    try {
      const blob = await stocktakeService.exportStocktakeTemplate(outletId, 'csv');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stocktake_template_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export stocktake file');
    }
  };

  const handleDownloadRow = async (file) => {
    try {
      const blob = await stocktakeService.downloadExternalStocktake(file.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `external_stocktake_${file.id}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setError('Failed to download stocktake file');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await stocktakeService.deleteExternalStocktake(deleteTarget.id);
      setDeleteTarget(null);
      await loadStocktakeFiles();
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete stocktake file');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'warning';
      case 'Failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const headCellSx = {
    bgcolor: '#5ebbeb',
    color: '#f8f8f8',
    fontSize: 16,
    fontWeight: 700,
    textTransform: 'none',
    height: 51,
    py: 0,
    px: '8px',
    border: 'none',
  };

  const bodyCellSx = { fontSize: 16, color: '#000', p: '8px 8px 8px 10px', border: 'none' };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography
          variant="h1"
          sx={{ fontSize: 40, fontWeight: 700, color: '#000', mr: '70px' }}
        >
          External Stocktakes
        </Typography>
        <Button
          variant="contained"
          disableElevation
          startIcon={<ImportIcon />}
          onClick={() => setImportDialogOpen(true)}
          sx={toolbarBtnSx}
        >
          Import Stocktake File
        </Button>
        <Button
          variant="contained"
          disableElevation
          startIcon={<ExportIcon />}
          onClick={() => setExportDialogOpen(true)}
          sx={toolbarBtnSx}
        >
          Export Stocktake File
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Table */}
      <Paper sx={{ overflow: 'hidden', borderRadius: 0, boxShadow: 'none' }}>
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell sx={headCellSx}>Date Created</TableCell>
                <TableCell sx={headCellSx}>Outlet</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
                <TableCell sx={{ ...headCellSx, width: 120 }} align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4, border: 'none' }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : stocktakeFiles.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="center"
                    sx={{ py: 4, color: '#676b72', border: 'none' }}
                  >
                    No external stocktake files found
                  </TableCell>
                </TableRow>
              ) : (
                stocktakeFiles.map((file, index) => (
                  <TableRow
                    key={file.id}
                    sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8' }}
                  >
                    <TableCell sx={bodyCellSx}>
                      {new Date(file.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>{file.outlet?.name || 'N/A'}</TableCell>
                    <TableCell sx={bodyCellSx}>
                      <Chip label={file.status} color={getStatusColor(file.status)} size="small" />
                    </TableCell>
                    <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }} align="right">
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => handleDownloadRow(file)}>
                          <ExportIcon sx={{ fontSize: 20, color: '#5ebbeb' }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" onClick={() => setDeleteTarget(file)}>
                          <DeleteIcon sx={{ fontSize: 20, color: '#e33430' }} />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ImportStocktakeDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportFile}
      />
      <ExportStocktakeDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExportFile}
      />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title="Delete Stocktake File"
        message="Are you sure you want to delete this external stocktake file? This action cannot be undone."
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </Box>
  );
}
