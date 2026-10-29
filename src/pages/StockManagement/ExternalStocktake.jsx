import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  FormControl,
  Select,
  MenuItem,
  FormControlLabel,
  Link,
  Stack,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  UploadFileOutlined as ImportIcon,
  FileDownloadOutlined as ExportIcon,
  HelpOutline as HelpIcon,
  VisibilityOutlined as ViewIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material';
import { outletService } from '../../services/outletService';
import stocktakeService from '../../services/stocktakeService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ExternalStocktakeHelpDrawer from '../../components/StockManagement/ExternalStocktakeHelpDrawer';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Reference: Menu > Stock Management > More > External Stocktake
// (support.onshopfront.com article 34108517200909).

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
  '& .MuiSelect-select': { fontSize: 16, py: '14px' },
};

const FieldLabel = ({ children }) => (
  <Typography sx={{ mb: 1, fontSize: 14, color: '#676b72' }}>{children}</Typography>
);

// Plain dropdown like the other pages' outlet pickers (no free text / clear ✕).
const OutletCombobox = ({ outlets, value, onChange }) => (
  <FormControl fullWidth sx={outletFieldSx}>
    <Select
      displayEmpty
      value={outlets.some((o) => o.id === value) ? value : ''}
      onChange={(e) => onChange(e.target.value)}
      renderValue={(v) => {
        const o = outlets.find((x) => x.id === v);
        return o ? o.name : <span style={{ color: '#808080' }}>Select an outlet</span>;
      }}
      MenuProps={{
        PaperProps: {
          sx: {
            borderRadius: '8px',
            border: '1px solid #404040',
            boxShadow: 'none',
            '& .MuiMenuItem-root': { color: '#5ebbeb', fontSize: 16 },
            '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-selected, & .MuiMenuItem-root.Mui-selected:hover': { backgroundColor: '#f8f8f8' },
          },
        },
      }}
    >
      {outlets.map((o) => (
        <MenuItem key={o.id} value={o.id}>{o.name}</MenuItem>
      ))}
    </Select>
  </FormControl>
);

// Standing outlet rule: navbar outlet set -> only that outlet is offered (locked);
// All Outlets -> every outlet, first one preselected.
const useOutlets = (open) => {
  const { selectedOutletId } = useSelectedOutlet();
  const [outlets, setOutlets] = useState([]);
  useEffect(() => {
    if (!open) return;
    outletService
      .getAllOutlets()
      .then((res) => {
        const all = res.outlets || [];
        setOutlets(selectedOutletId ? all.filter((o) => o.id === selectedOutletId) : all);
      })
      .catch((err) => console.error('Error loading outlets:', err));
  }, [open, selectedOutletId]);
  return { outlets, locked: Boolean(selectedOutletId) };
};

export const formatDateTime = (value) => {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

const ImportStocktakeDialog = ({ open, onClose, onImport, onOpenHelp }) => {
  const blank = { file: null, outletId: '', inventoryMethod: 'override', zeroStockNotCounted: false, importCosts: false };
  const [formData, setFormData] = useState(blank);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { outlets, locked } = useOutlets(open);

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
    setFormData(blank);
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
                accept=".csv,text/csv"
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, file: e.target.files[0] || null }))
                }
              />
            </Box>
          </Box>

          {/* Outlet: hidden when the navbar already fixes the outlet (standing rule) */}
          {!locked && (
            <Box>
              <FieldLabel>Outlet</FieldLabel>
              <OutletCombobox
                outlets={outlets}
                value={formData.outletId}
                onChange={(outletId) => setFormData((prev) => ({ ...prev, outletId }))}
              />
            </Box>
          )}

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
                <Tooltip title="If enabled, this will override the costs on your products with the provided costs. This is typically not wanted">
                  <HelpIcon sx={{ fontSize: 16, color: '#676b72' }} />
                </Tooltip>
              </Stack>
            }
            sx={{ ml: 0, gap: 1.5 }}
          />

          <Link
            component="button"
            type="button"
            onClick={onOpenHelp}
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

const ExportStocktakeDialog = ({ open, onClose, onExport }) => {
  const [outletId, setOutletId] = useState('');
  const [includeNoBarcode, setIncludeNoBarcode] = useState(false);
  const [loading, setLoading] = useState(false);
  const { outlets, locked } = useOutlets(open);

  useEffect(() => {
    if (!open) return;
    setOutletId((prev) => (outlets.some((o) => o.id === prev) ? prev : outlets[0]?.id || ''));
  }, [open, outlets]);

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
          {!locked && (
            <Box>
              <FieldLabel>Outlet</FieldLabel>
              <OutletCombobox outlets={outlets} value={outletId} onChange={setOutletId} />
            </Box>
          )}
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

const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Reference row actions: blue "View" / red "Delete" text buttons; a row still
// Processing shows both as grey disabled boxes.
const rowBtnSx = (color, disabled) => ({
  minWidth: 118,
  height: 42,
  px: 2,
  borderRadius: disabled ? '8px' : 0,
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  color: disabled ? '#9a9a9a' : color,
  bgcolor: disabled ? '#e5e5e5' : 'transparent',
  '&.Mui-disabled': { color: '#9a9a9a', bgcolor: '#e5e5e5' },
  '&:hover': { bgcolor: disabled ? '#e5e5e5' : 'rgba(0,0,0,0.04)' },
});

export default function ExternalStocktake() {
  const navigate = useNavigate();
  const [stocktakeFiles, setStocktakeFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef(null);

  const loadStocktakeFiles = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await stocktakeService.getExternalStocktakes();
      setStocktakeFiles(response.data || []);
    } catch (err) {
      console.error('Error loading stocktake files:', err);
      setError('Failed to load stocktake files');
      setStocktakeFiles([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadStocktakeFiles(); }, [loadStocktakeFiles]);

  // Reference processes the import in the background; poll while any row is
  // still Processing so the row flips to viewable without a refresh.
  useEffect(() => {
    const busy = stocktakeFiles.some((f) => f.status === 'Processing');
    if (busy && !pollRef.current) {
      pollRef.current = setInterval(() => loadStocktakeFiles(true), 3000);
    } else if (!busy && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [stocktakeFiles, loadStocktakeFiles]);

  const handleImportFile = async (importData) => {
    try {
      const formData = new FormData();
      formData.append('file', importData.file);
      formData.append('outletId', importData.outletId);
      formData.append('inventoryMethod', importData.inventoryMethod);
      formData.append('zeroStockNotCounted', importData.zeroStockNotCounted);
      formData.append('importCosts', importData.importCosts);
      await stocktakeService.importExternalStocktake(formData);
      await loadStocktakeFiles(true);
    } catch (err) {
      console.error('Import error:', err);
      throw new Error(err?.response?.data?.error || 'Failed to import stocktake file');
    }
  };

  const handleExportFile = async ({ outletId, includeNoBarcode }) => {
    try {
      const blob = await stocktakeService.exportStocktakeTemplate(outletId, 'csv', includeNoBarcode);
      downloadBlob(blob, `stocktake_export_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export stocktake file');
    }
  };

  const handleView = (file) => {
    if (file.status === 'Completed' && file.stocktakeId) {
      navigate(`/stock-management/stocktakes/${file.stocktakeId}`);
    } else {
      navigate(`/stock-management/external-stocktake/${file.id}`);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await stocktakeService.deleteExternalStocktake(deleteTarget.id);
      setDeleteTarget(null);
      await loadStocktakeFiles(true);
    } catch (err) {
      console.error('Delete error:', err);
      setError('Failed to delete stocktake file');
    } finally {
      setDeleting(false);
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

  const bodyCellSx = { fontSize: 16, color: '#000', p: '8px 8px 8px 10px', border: 'none', height: 74 };

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
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                  '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' },
                }}
              >
                <TableCell sx={{ ...headCellSx, width: '28%' }}>Date Created</TableCell>
                <TableCell sx={{ ...headCellSx, width: '38%' }}>Outlet</TableCell>
                <TableCell sx={headCellSx}>Status</TableCell>
                <TableCell sx={{ ...headCellSx, width: 300 }} align="right" />
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
                stocktakeFiles.map((file) => {
                  const busy = file.status === 'Processing';
                  const failed = file.status === 'Failed';
                  return (
                    <TableRow key={file.id}>
                      <TableCell sx={bodyCellSx}>{formatDateTime(file.createdAt)}</TableCell>
                      <TableCell sx={bodyCellSx}>{file.outlet?.name || 'N/A'}</TableCell>
                      <TableCell sx={bodyCellSx}>
                        {failed ? (
                          <Tooltip title={file.error || ''}><span style={{ color: '#e33430' }}>Failed</span></Tooltip>
                        ) : file.status === 'Imported' ? 'Completed' : file.status}
                      </TableCell>
                      <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }} align="right">
                        <Button
                          disableRipple
                          disabled={busy || failed}
                          startIcon={<ViewIcon sx={{ fontSize: 20 }} />}
                          onClick={() => handleView(file)}
                          sx={rowBtnSx('#5ebbeb', busy || failed)}
                        >
                          View
                        </Button>
                        <Button
                          disableRipple
                          disabled={busy}
                          startIcon={<DeleteIcon sx={{ fontSize: 20 }} />}
                          onClick={() => setDeleteTarget(file)}
                          sx={{ ...rowBtnSx('#e33430', busy), ml: 1 }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <ImportStocktakeDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportFile}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <ExportStocktakeDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExportFile}
      />
      <ExternalStocktakeHelpDrawer open={helpOpen} onClose={() => setHelpOpen(false)} />
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
