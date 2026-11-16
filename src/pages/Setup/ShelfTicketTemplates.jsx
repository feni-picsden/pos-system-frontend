import React, { useState, useRef, useEffect } from 'react';
import {
  Box, Typography, Button, Paper, Dialog, DialogTitle, DialogContent,
  DialogActions, TextField, Alert, Snackbar, Card, CardContent, CardActions,
  Grid, Tooltip, IconButton, Chip, CircularProgress, Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  DeleteOutline as DeleteIcon,
  LocalOffer as TicketIcon,
  ContentCopy as DuplicateIcon,
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import shelfTicketTemplateService from '../../services/shelfTicketTemplateService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { useGlobalOutlet } from '../../components/Common/GlobalOutletFilter';
import { renderPrintElement } from '../../utils/shelfTicketPrint.jsx';

// Sample data for the card thumbnail (same figures the editor's Preview uses).
const THUMB_SAMPLE = {
  productName: 'Sample Product', name: 'Sample Product', price: '9.99', salePrice: '7.49',
  barcode: '5901234123457', category: 'Category', brand: 'Brand', sku: 'SKU001',
  description: 'Product description', unit: 'EA', qty2: '6', price2: '36.00', qty3: '', price3: '',
  caseQty: '24', casePrice: '120.00', unitPrice2: '6.00', unitPriceCase: '5.00',
  multiBuy: '6 for $36.00 · 24 for $120.00', priceBreaks: [],
};
const MM_TO_PX = 3.7795275591;

// Real thumbnail: the template's elements rendered with sample data and scaled
// to the card (was a placeholder tag icon - you could not tell designs apart).
const TemplateThumbnail = ({ template }) => {
  const boxRef = useRef(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (w && h) setScale(Math.min(w / (template.width * MM_TO_PX), h / (template.height * MM_TO_PX)));
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [template.width, template.height]);
  const elements = Array.isArray(template.elements) ? template.elements : [];
  return (
    <Box ref={boxRef} data-testid="template-thumb" sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {elements.length === 0 ? (
        <TicketIcon sx={{ fontSize: 40, color: '#e0e0e0' }} />
      ) : scale > 0 && (
        <Box
          sx={{
            position: 'relative',
            width: `${template.width}mm`,
            height: `${template.height}mm`,
            backgroundColor: template.backgroundColor || '#fff',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            flexShrink: 0,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {elements.map((el) => (
            <Box key={el.id} sx={{ position: 'absolute', left: `${el.x}mm`, top: `${el.y}mm`, width: `${el.width}mm`, height: `${el.height}mm`, overflow: 'hidden' }}>
              {renderPrintElement(el, THUMB_SAMPLE)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

const ShelfTicketTemplates = () => {
  const navigate = useNavigate();
  // Outlet chip on a card only in All Outlets mode (user 16/11/2026: with an outlet
  // picked in the header every card is that outlet's, so the chip says nothing).
  const { globalMode } = useGlobalOutlet();
  // Auto-seeding the defaults must happen at most once per mount, otherwise a
  // refresh right after deleting the last template would recreate them.
  const seededRef = useRef(false);
  // Renders from IndexedDB first, then revalidates in the background.
  const {
    data: templates,
    loading,
    refresh: loadTemplates,
  } = usePageCache('shelfTicketTemplates', async () => {
    const data = await shelfTicketTemplateService.getTemplates();
    let list = data.templates || [];
    if (list.length === 0 && !seededRef.current) {
      seededRef.current = true;
      await shelfTicketTemplateService.seedDefaults();
      list = (await shelfTicketTemplateService.getTemplates()).templates || [];
    }
    return list;
  });

  const [deleteDialog, setDeleteDialog] = useState({ open: false, template: null });
  const [newTemplateDialog, setNewTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') =>
    setSnackbar({ open: true, message, severity });

  const handleCreateTemplate = async () => {
    if (!newTemplateName.trim()) return;
    try {
      setCreating(true);
      const data = await shelfTicketTemplateService.createTemplate({
        name: newTemplateName.trim(),
        width: 100,
        height: 70,
        backgroundColor: '#ffffff',
        elements: [],
      });
      setNewTemplateDialog(false);
      setNewTemplateName('');
      navigate(`/setup/shelf-tickets/${data.template.id}/edit`);
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to create template', 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (template) => {
    try {
      await shelfTicketTemplateService.duplicateTemplate(template.id);
      await loadTemplates();
      showSnackbar('Template duplicated');
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to duplicate template', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteDialog.template) return;
    try {
      await shelfTicketTemplateService.deleteTemplate(deleteDialog.template.id);
      await loadTemplates();
      setDeleteDialog({ open: false, template: null });
      showSnackbar('Template deleted');
    } catch (err) {
      showSnackbar(err.response?.data?.error || 'Failed to delete template', 'error');
    }
  };

  const TemplateCardSkeleton = () => (
    <Grid item xs={12} sm={6} md={4} lg={3}>
      <Card>
        <CardContent>
          <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 1 }} />
          <Skeleton variant="text" height={28} width="70%" />
          <Skeleton variant="text" height={20} width="90%" />
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Skeleton variant="rounded" width={80} height={22} />
            <Skeleton variant="rounded" width={90} height={22} />
          </Box>
        </CardContent>
        <CardActions sx={{ px: 2, pb: 2 }}>
          <Skeleton variant="rounded" width="60%" height={32} />
        </CardActions>
      </Card>
    </Grid>
  );

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" fontWeight="bold">Shelf Ticket Templates</Typography>
          <Typography variant="body2" color="text.secondary">
            Design and manage ticket templates for printing shelf price labels — stored per outlet
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setNewTemplateDialog(true)}
          sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42, flexShrink: 0 }}
        >
          New Template
        </Button>
      </Box>

      <Grid container spacing={2.5}>
        {loading
          ? [0, 1, 2].map(i => <TemplateCardSkeleton key={i} />)
          : templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={template.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.2s ease',
                  '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  {/* Mini preview placeholder */}
                  <Box
                    sx={{
                      width: '100%',
                      aspectRatio: `${template.width} / ${template.height}`,
                      maxHeight: 120,
                      backgroundColor: template.backgroundColor || '#fff',
                      border: '1px solid #e0e0e0',
                      borderRadius: 1,
                      mb: 2,
                      overflow: 'hidden',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <TemplateThumbnail template={template} />
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute', bottom: 4, right: 4,
                        color: 'text.secondary', backgroundColor: 'rgba(255,255,255,0.85)',
                        px: 0.5, borderRadius: 0.5,
                      }}
                    >
                      {template.width}×{template.height}mm
                    </Typography>
                    {template.isDefault && (
                      <Chip
                        label="Default"
                        size="small"
                        color="primary"
                        sx={{ position: 'absolute', top: 4, left: 4, fontSize: 10 }}
                      />
                    )}
                  </Box>

                  <Typography variant="h6" fontWeight={600} gutterBottom noWrap>
                    {template.name}
                  </Typography>
                  {template.description && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
                      {template.description}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
                    <Chip label={`${template.elements?.length || 0} elements`} size="small" variant="outlined" />
                    <Chip label={`${template.width}×${template.height}mm`} size="small" variant="outlined" color="primary" />
                    {globalMode && template.outlet && (
                      <Chip label={template.outlet.name} size="small" variant="outlined" color="success" />
                    )}
                    {globalMode && !template.outletId && (
                      <Chip label="Global" size="small" variant="outlined" color="warning" />
                    )}
                  </Box>
                </CardContent>

                <CardActions sx={{ px: 2, pb: 2, gap: 1 }}>
                  <Button
                    size="small"
                    startIcon={<EditIcon />}
                    component={RouterLink} to={`/setup/shelf-tickets/${template.id}/edit`}
                    sx={{ flexGrow: 1, color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0 }}
                  >
                    Design
                  </Button>
                  <Tooltip title="Duplicate">
                    <span>
                      <IconButton size="small" onClick={() => handleDuplicate(template)}>
                        <DuplicateIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <span>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, template })}
                        sx={{ color: '#dc2626' }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))
        }

        {!loading && templates.length === 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 6, textAlign: 'center' }}>
              <TicketIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No templates yet
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Create your first shelf ticket template to get started
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setNewTemplateDialog(true)}
                sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
              >
                Create Template
              </Button>
            </Paper>
          </Grid>
        )}
      </Grid>

      {/* New Template Dialog */}
      <Dialog
        open={newTemplateDialog}
        onClose={() => setNewTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ fontSize: 20, fontWeight: 700, px: 3, pt: 3, pb: 1 }}>New Shelf Ticket Template</DialogTitle>
        <DialogContent sx={{ px: 3 }}>
          <Typography sx={{ fontSize: 14, fontWeight: 600, color: '#344054', mb: 0.75 }}>Template Name</Typography>
          <TextField
            autoFocus
            fullWidth
            size="small"
            placeholder="e.g. Shelf Edge 100×70"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTemplate()}
            inputProps={{ 'aria-label': 'Template Name' }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                fontSize: 16,
                bgcolor: '#fff',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d0d5dd' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#98a2b3' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#5ebbeb', borderWidth: '1px' },
              },
            }}
          />
          <Typography sx={{ fontSize: 13, color: 'text.secondary', mt: 1 }}>
            You'll be taken to the designer to build the template layout
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, pt: 1, gap: 1 }}>
          <Button
            disableElevation
            onClick={() => { setNewTemplateDialog(false); setNewTemplateName(''); }}
            sx={{ bgcolor: '#d4d4d4', color: '#000', height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#a3a3a3', boxShadow: 'none' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleCreateTemplate}
            disabled={!newTemplateName.trim() || creating}
            startIcon={creating ? <CircularProgress size={16} sx={{ color: '#fff' }} /> : null}
            sx={{ bgcolor: '#5ebbeb', color: '#fff', height: 42, borderRadius: '12px', px: 3, fontSize: 16, fontWeight: 700, textTransform: 'none', boxShadow: 'none', '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' }, '&.Mui-disabled': { bgcolor: '#cfe9f7', color: '#fff' } }}
          >
            Create & Design
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <ConfirmDeleteDialog
        open={deleteDialog.open}
        title="Delete Template"
        message={`Are you sure you want to delete ${deleteDialog.template?.name || ''}? This cannot be undone.`}
        onCancel={() => setDeleteDialog({ open: false, template: null })}
        onConfirm={handleDelete}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3500}
        onClose={() => setSnackbar(s => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ShelfTicketTemplates;
