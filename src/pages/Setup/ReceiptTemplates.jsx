import React, { useState } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  EditOutlined as EditIcon,
  SettingsOutlined as SettingsIcon,
  DeleteOutline as DeleteIcon,
  ContentCopy as CloneIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import receiptTemplateService from '../../services/receiptTemplateService';
import usePageCache from '../../hooks/usePageCache';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { useHasPermission } from '../../hooks/usePermissions';
import { applyReceiptConfig } from '../../utils/receiptTemplateShape';
import ConfigureReceiptDialog from '../../components/Receipt/ConfigureReceiptDialog';

// Reference row actions LIGHTEN their text color instantly on hover with no
// background tint. Mirror that: transparent hover bg + lighter text, no transition.
const rowActionSx = (color, hoverColor) => ({
  color,
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  minWidth: 0,
  transition: 'none',
  // Measured reference action icon is 20px; MUI's small button default is 18.
  '& .MuiButton-startIcon > svg': { fontSize: 20 },
  '&:hover': { backgroundColor: 'transparent', color: hoverColor },
});

const ReceiptTemplates = () => {
  const navigate = useNavigate();
  // Backend gates every template mutation (create/update/config/delete/clone)
  // behind `modify_receipts`; viewing the list is unrestricted. Mirror that in
  // the UI so users who can only read don't see controls that 403 on click.
  const canModifyReceipts = useHasPermission('modify_receipts');
  // Templates render from IndexedDB first, then revalidate in the background.
  const {
    data: templates,
    loading,
    refresh: loadTemplates,
  } = usePageCache('receiptTemplates', () =>
    receiptTemplateService.getTemplates().then((r) => r.templates || [])
  );
  const [error, setError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'Normal Receipt',
    isAccountPayment: false,
    startFrom: 'default', // 'default' preset or 'blank' page (reference step 2)
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showConfigureDialog, setShowConfigureDialog] = useState(false);
  const [configureTemplate, setConfigureTemplate] = useState(null);
  const [templateConfig, setTemplateConfig] = useState(null);
  const [padding, setPadding] = useState({ top: 0, left: 0, right: 0, bottom: 0 });
  // Generic / Text Only templates only: paper width in mm, in place of the padding block.
  const [receiptWidth, setReceiptWidth] = useState('');
  // Email templates only: PDF receipt attachments, each { name, receiptTemplateId } linking an A4 template.
  const [attachments, setAttachments] = useState([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const handleCreateTemplate = async () => {
    try {
      if (!newTemplate.name.trim()) {
        setError('Please enter a name for the receipt template');
        return;
      }

      // Start from the built-in default preset for this type, or a blank canvas.
      let config;
      if (newTemplate.startFrom === 'default') {
        try {
          const res = await receiptTemplateService.getDefaultConfig(newTemplate.type);
          config = res.config || res;
        } catch {
          config = undefined; // preset unavailable -> fall back to blank
        }
      }

      const templateData = {
        name: newTemplate.name,
        type: newTemplate.type,
        isAccountPayment: newTemplate.isAccountPayment,
        for: newTemplate.isAccountPayment ? 'Payment' : 'Sale',
        ...(config ? { config } : {}),
        createdAt: new Date().toISOString(),
      };

      const response = await receiptTemplateService.createTemplate(templateData);
      await loadTemplates();
      handleCloseCreateDialog();

      // Navigate to edit the newly created template
      if (response.template && response.template.id) {
        navigate(`/setup/receipts/${response.template.id}/edit`);
      }
    } catch (err) {
      console.error('Error creating receipt template:', err);
      setError('Failed to create receipt template');
    }
  };

  const handleCloseCreateDialog = () => {
    setShowCreateDialog(false);
    setNewTemplate({
      name: '',
      type: 'Normal Receipt',
      isAccountPayment: false,
      startFrom: 'default',
    });
    setError('');
  };

  const handleEdit = (template) => {
    navigate(`/setup/receipts/${template.id}/edit`);
  };

  const handleConfigure = async (template) => {
    setConfigureTemplate(template);
    setShowConfigureDialog(true);
    setConfigLoading(true);
    try {
      const res = await receiptTemplateService.getTemplateConfig(template.id);
      const cfg = res.config || res || {};
      setTemplateConfig(cfg);
      const p = cfg.padding || {};
      setPadding({
        top: Number(p.top) || 0,
        left: Number(p.left) || 0,
        right: Number(p.right) || 0,
        bottom: Number(p.bottom) || 0,
      });
      setReceiptWidth(cfg.receiptWidth == null ? '' : String(cfg.receiptWidth));
      setAttachments(Array.isArray(cfg.attachments) ? cfg.attachments : []);
    } catch (err) {
      console.error('Error loading receipt config:', err);
      // Leave the config NULL, never {}. Confirm writes the whole config column, so
      // an empty object here plus one Confirm click erased the template's components.
      setTemplateConfig(null);
      setPadding({ top: 0, left: 0, right: 0, bottom: 0 });
      setReceiptWidth('');
      setAttachments([]);
      setError('Failed to load receipt configuration');
    } finally {
      setConfigLoading(false);
    }
  };

  const handleCloseConfigure = () => {
    setShowConfigureDialog(false);
    setConfigureTemplate(null);
    setTemplateConfig(null);
    setReceiptWidth('');
    setAttachments([]);
    setError('');
  };

  const handleConfirmConfigure = async () => {
    if (!configureTemplate || !templateConfig) return;
    // Same rules as the editor's gear dialog — one implementation, in the shape util.
    const { error: configError, config: updatedConfig } = applyReceiptConfig(templateConfig, {
      template: configureTemplate,
      padding,
      receiptWidth,
      attachments,
    });
    if (configError) {
      setError(configError);
      return;
    }
    try {
      setConfigSaving(true);
      await receiptTemplateService.updateTemplateConfig(configureTemplate.id, updatedConfig);
      handleCloseConfigure();
    } catch (err) {
      console.error('Error saving receipt config:', err);
      setError('Failed to save receipt configuration');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleDelete = (templateId) => {
    setTemplateToDelete(templateId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    try {
      setDeleteLoading(true);
      await receiptTemplateService.deleteTemplate(templateToDelete);
      await loadTemplates();
    } catch (err) {
      console.error('Error deleting receipt template:', err);
      setError('Failed to delete receipt template');
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  const handleClone = async (template) => {
    try {
      await receiptTemplateService.cloneTemplate(template.id);
      await loadTemplates();
    } catch (err) {
      console.error('Error cloning receipt template:', err);
      setError('Failed to clone receipt template');
    }
  };

  const getReceiptTypeOptions = () => [
    'Normal Receipt',
    'Generic / Text Only Receipt',
    'A4 Receipt',
    'Email Receipt',
  ];

  if (loading) {
    return <PageLoader />;
  }

  // Rendered on the page AND inside both dialogs: a dialog sits above the page
  // content, so an error raised while one is open (empty name, duplicate
  // attachment, save failure) was painted behind the backdrop and read as
  // "the button does nothing".
  const errorAlert = error ? (
    <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
      {error}
    </Alert>
  ) : null;

  // Metrics measured live on the reference 2026-08-06 — docs/parity/receipts-setup-reference.md
  return (
    <Box sx={{ p: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', fontSize: 32 }}>
          Receipt List
        </Typography>
        {canModifyReceipts && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setShowCreateDialog(true)}
            sx={{ bgcolor: '#32b643', color: '#f8f8f8', border: '1px solid #f8f8f8', '&:hover': { bgcolor: '#32b643', boxShadow: 'none' }, borderRadius: 0, textTransform: 'none', boxShadow: 'none', fontWeight: 400, fontSize: 32, height: 48, width: 130, minWidth: 130, p: '4px 8px', whiteSpace: 'nowrap', transition: 'background-color 0.2s', '& .MuiButton-startIcon > svg': { fontSize: 26 } }}
          >
            New
          </Button>
        )}
      </Box>

      {errorAlert}

      {/* Receipt Templates Table */}
      <TableContainer sx={{ mt: 1 }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: 'transparent', color: '#000', fontWeight: 700, fontSize: 16, textAlign: 'center', borderBottom: '1px solid #000', borderRadius: 0, height: 51, py: 0 },
              }}
            >
              <TableCell>Name</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>For</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: '#f8f8f8' },
              '& tr:nth-of-type(even)': { bgcolor: 'transparent' },
              '& td': { border: 0, fontSize: 16, color: '#000', height: 52, py: 0 }
            }}
          >
            {templates.map((template) => (
              <TableRow key={template.id}>
                <TableCell>
                  {template.name}
                </TableCell>
                <TableCell>
                  {template.type?.replace(/ Receipt$/, '')}
                </TableCell>
                <TableCell>
                  {template.for || (template.isAccountPayment ? 'Payment' : 'Sale')}
                </TableCell>
                <TableCell align="right" sx={{ pr: '20px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                    {canModifyReceipts && (
                      <>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleEdit(template)}
                          sx={rowActionSx('#32b643', '#6dd77b')}
                        >
                          Edit
                        </Button>
                        <Button
                          size="small"
                          startIcon={<SettingsIcon />}
                          onClick={() => handleConfigure(template)}
                          sx={rowActionSx('#1c86f2', '#5ea9f6')}
                        >
                          Configure
                        </Button>
                        <Button
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleDelete(template.id)}
                          sx={rowActionSx('#e3342f', '#eb6f6c')}
                        >
                          Delete
                        </Button>
                        <Button
                          size="small"
                          startIcon={<CloneIcon />}
                          onClick={() => handleClone(template)}
                          sx={rowActionSx('#1c86f2', '#5ea9f6')}
                        >
                          Clone
                        </Button>
                      </>
                    )}
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {templates.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No receipt templates found. Click "New" to create your first template.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create New Receipt Dialog */}
      <Dialog
        open={showCreateDialog}
        onClose={handleCloseCreateDialog}
        PaperProps={{
          sx: {
            borderRadius: 0,
            width: 491,
            maxWidth: '92vw',
            overflow: 'visible',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        {/* Blue '?' badge overlapping the top edge; no header bar, no X (reference clone) */}
        <Box sx={{
          position: 'absolute',
          top: -28,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 56,
          height: 56,
          borderRadius: '50%',
          bgcolor: '#5ebbeb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
        }}>
          <Typography sx={{ color: '#fff', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>?</Typography>
        </Box>
        <Typography sx={{ textAlign: 'center', color: '#000', fontWeight: 700, fontSize: 20, pt: 4.5, pb: 0.5, px: 3 }}>
          Create New Receipt
        </Typography>

        <DialogContent sx={{ p: 3 }}>
          {errorAlert}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 1 }}>
            <TextField
              fullWidth
              label="What should the receipt be called?"
              variant="outlined"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter receipt name"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
                }
              }}
            />
            
            <FormControl fullWidth>
              <InputLabel>What type of receipt is being created?</InputLabel>
              <Select
                value={newTemplate.type}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, type: e.target.value }))}
                label="What type of receipt is being created?"
                IconComponent={ArrowDropDownIcon}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      mt: 0.5,
                      borderRadius: '8px',
                      border: '1px solid #e0e0e0',
                      boxShadow: '0 4px 14px rgba(0,0,0,0.12)'
                    }
                  }
                }}
                sx={{
                  borderRadius: '8px',
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' }
                }}
              >
                {getReceiptTypeOptions().map((option) => (
                  <MenuItem
                    key={option}
                    value={option}
                    sx={{ fontSize: 16, color: '#000', '&:hover': { bgcolor: '#5ebbeb' }, '&.Mui-selected': { bgcolor: 'transparent' }, '&.Mui-selected:hover': { bgcolor: '#5ebbeb' }, '&.Mui-focusVisible': { bgcolor: '#5ebbeb' } }}
                  >
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <ShopfrontSwitch
                  checked={newTemplate.isAccountPayment}
                  onChange={(e) => setNewTemplate(prev => ({
                    ...prev,
                    isAccountPayment: e.target.checked
                  }))}
                />
              }
              label="Account Payment Receipt"
              sx={{ mt: 1, ml: 0, gap: 1.5 }}
            />

            <FormControl>
              <FormLabel sx={{ color: '#313439', fontWeight: 700, fontSize: 16, mb: 0.5, '&.Mui-focused': { color: '#313439' } }}>
                What would you like to start from?
              </FormLabel>
              <RadioGroup
                value={newTemplate.startFrom}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, startFrom: e.target.value }))}
              >
                <FormControlLabel
                  value="default"
                  control={<Radio sx={{ '&.Mui-checked': { color: '#5ebbeb' } }} />}
                  label="Default receipt template"
                />
                <FormControlLabel
                  value="blank"
                  control={<Radio sx={{ '&.Mui-checked': { color: '#5ebbeb' } }} />}
                  label="Blank page"
                />
              </RadioGroup>
            </FormControl>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
          <Button
            onClick={handleCloseCreateDialog}
            sx={{ bgcolor: '#f8f8f8', color: '#313439', border: '1px solid #e5e5e5', textTransform: 'none', boxShadow: 'none', borderRadius: 0, fontWeight: 700, fontSize: 16, minWidth: 100, height: 42, '&:hover': { bgcolor: '#e9e9e9', boxShadow: 'none' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => handleCreateTemplate()}
            sx={{ bgcolor: '#32b643', color: '#f8f8f8', '&:hover': { bgcolor: '#2ba03b', boxShadow: 'none' }, borderRadius: 0, textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, minWidth: 100, height: 42 }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Configure — the SAME dialog the editor's gear opens (shared component). */}
      <ConfigureReceiptDialog
        open={showConfigureDialog}
        template={configureTemplate}
        value={{ padding, receiptWidth, attachments }}
        onChange={(v) => { setPadding(v.padding); setReceiptWidth(v.receiptWidth); setAttachments(v.attachments); }}
        onCancel={handleCloseConfigure}
        onConfirm={handleConfirmConfigure}
        a4Templates={templates.filter((t) => t.type === 'A4 Receipt')}
        loading={configLoading}
        saving={configSaving}
        error={error}
        onErrorClose={() => setError('')}
      />

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Receipt Template"
        message="Are you sure you want to delete this receipt template?"
        loading={deleteLoading}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setTemplateToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default ReceiptTemplates;
