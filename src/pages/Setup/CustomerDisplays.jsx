import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { Glyph, templateListHeadSx, templateListBodySx } from '../../components/Common/TemplateListActions';
import { createDefaultCustomerDisplayTemplate } from '../../utils/customerDisplayDefaults';
import { useHasPermission } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Shopfront reference has no transitions anywhere.
const INSTANT = 'all 0s ease';

// Reference row action (Edit green / Delete grey / Clone blue): coloured text with
// the thin outline glyph, all on one line.
const ROW_ACTION_SX = {
  textTransform: 'none',
  fontWeight: 400,
  fontSize: 16,
  height: 36,
  borderRadius: '8px',
  minWidth: 0,
  px: 1,
  transition: INSTANT,
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
  '& .MuiButton-startIcon': { mr: '6px' },
  '& i.fal': { display: 'inline-flex', alignItems: 'center', '& svg': { width: 16, height: 16 } },
};

const apiError = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

const CustomerDisplays = () => {
  const { isTrueSuperAdmin } = useAuth();
  const { selectedOutletId } = useSelectedOutlet();
  const canModify = useHasPermission('modify_customer_displays');
  // Outlet column only on "All Outlets": with a navbar outlet every row is that
  // outlet or Global, so the column adds nothing (same rule as Tax Rates).
  const showOutletColumn = isTrueSuperAdmin() && selectedOutletId == null;

  // Renders from IndexedDB first, then revalidates in the background.
  const { data: templates, refresh: loadTemplates } = usePageCache(
    'customerDisplays',
    () =>
      customerDisplayTemplateService
        .listTemplates()
        // stable creation order, matching reference
        .then((list) => [...list].sort((a, b) => Number(a.id) - Number(b.id))),
    { deps: [selectedOutletId] }
  );
  const [error, setError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  // Reference "Confirm Clone": ask the name, prefilled "<name> - Clone".
  const [cloneSource, setCloneSource] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [cloneError, setCloneError] = useState('');
  const [cloning, setCloning] = useState(false);
  const navigate = useNavigate();

  const handleDelete = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete || deleting) return;
    setDeleting(true);
    try {
      await customerDisplayTemplateService.removeTemplate(templateToDelete.id);
      setError('');
    } catch (err) {
      setError(apiError(err, 'Failed to delete customer display template'));
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
      loadTemplates();
    }
  };

  const handleClone = (template) => {
    setCloneSource(template);
    setCloneName(`${template.name} - Clone`);
    setCloneError('');
  };

  const closeCloneDialog = () => {
    if (cloning) return;
    setCloneSource(null);
    setCloneError('');
  };

  const confirmClone = async () => {
    if (!cloneSource || cloning) return;
    const name = cloneName.trim();
    if (!name) {
      setCloneError('Please enter a name for the clone');
      return;
    }
    setCloning(true);
    try {
      await customerDisplayTemplateService.cloneTemplate(cloneSource.id, name);
      setCloneSource(null);
      setCloneError('');
      loadTemplates();
    } catch (err) {
      setCloneError(apiError(err, 'Failed to clone customer display template'));
    } finally {
      setCloning(false);
    }
  };

  const openCreateDialog = () => {
    setNewTemplateName('');
    setUseDefaultTemplate(true);
    setCreateError('');
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    const name = newTemplateName.trim();
    if (!name || creating) return;
    setCreating(true);
    setCreateError('');
    try {
      const base = useDefaultTemplate
        ? createDefaultCustomerDisplayTemplate()
        : { idle: { components: [] }, sale: { components: [] } };
      const { savedId } = await customerDisplayTemplateService.upsertTemplate({
        ...base,
        id: null,
        name,
      });
      setCreateDialogOpen(false);
      navigate(`/settings/customer-display/${savedId}/edit`);
    } catch (err) {
      setCreateError(apiError(err, 'Failed to create customer display template'));
    } finally {
      setCreating(false);
    }
  };

  const getOutletDisplay = (template) => {
    if (template.outlet) return `${template.outlet.name} (${template.outlet.code})`;
    return 'Global';
  };

  const columnCount = 2 + (showOutletColumn ? 1 : 0);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header: title, green "+ New", right-top results counter */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: '#000' }}>
          Customer Displays
        </Typography>
        {canModify && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{
              color: '#fff',
              textTransform: 'none',
              boxShadow: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              height: 42,
              px: 3,
              transition: INSTANT,
              backgroundColor: '#22c55e',
              '&:hover': { backgroundColor: '#4ade80', boxShadow: 'none' },
            }}
          >
            New
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: '#000' }}>
            {templates.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: '#676b72' }}>Results</Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError('')} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Reference: plain bordered table, Name | Actions */}
      <TableContainer>
        <Table sx={{ borderCollapse: 'collapse' }}>
          <TableHead sx={templateListHeadSx}>
            <TableRow>
              <TableCell>Name</TableCell>
              {showOutletColumn && <TableCell>Outlet</TableCell>}
              <TableCell sx={{ width: 320 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={templateListBodySx}>
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                    No customer display templates found.{canModify && ' Click "New" to create your first template.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>{template.name}</TableCell>
                  {showOutletColumn && (
                    <TableCell>
                      <Chip
                        label={getOutletDisplay(template)}
                        size="small"
                        variant="outlined"
                        color={template.outlet ? 'primary' : 'default'}
                      />
                    </TableCell>
                  )}
                  <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>
                    {/* Actions spread across the whole column, like the reference */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', width: '100%' }}>
                      <Button
                        disableRipple
                        startIcon={<Glyph name="pencil" />}
                        onClick={() => navigate(`/settings/customer-display/${template.id}/edit`)}
                        sx={{ ...ROW_ACTION_SX, color: '#32b643', '&:hover': { color: '#6dd77b', bgcolor: 'transparent' } }}
                      >
                        Edit
                      </Button>
                      {canModify && (
                        <Tooltip
                          title={template.inUse
                            ? `Used by ${(template.usedBy || []).map((r) => r.name).join(', ')} - choose another template for ${(template.usedBy || []).length === 1 ? 'that register' : 'those registers'} first`
                            : ''}
                          placement="top"
                          arrow
                        >
                          <span>
                            <Button
                              disableRipple
                              startIcon={<Glyph name="trash" />}
                              onClick={() => handleDelete(template)}
                              disabled={Boolean(template.inUse)}
                              sx={{
                                ...ROW_ACTION_SX,
                                color: '#676b72',
                                '&:hover': { color: '#e3342f', bgcolor: 'transparent' },
                                '&.Mui-disabled': { color: '#b5b5b5', pointerEvents: 'auto', cursor: 'not-allowed' },
                              }}
                            >
                              Delete
                            </Button>
                          </span>
                        </Tooltip>
                      )}
                      {canModify && (
                        <Button
                          disableRipple
                          startIcon={<Glyph name="clone" />}
                          onClick={() => handleClone(template)}
                          sx={{ ...ROW_ACTION_SX, color: '#1c86f2', '&:hover': { color: '#73b4f7', bgcolor: 'transparent' } }}
                        >
                          Clone
                        </Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={createDialogOpen}
        onClose={() => !creating && setCreateDialogOpen(false)}
        slotProps={{ backdrop: { sx: { bgcolor: 'rgba(0,0,0,0.45)' } } }}
        PaperProps={{ sx: { borderRadius: '8px', width: 400, maxWidth: '92vw', overflow: 'visible' } }}
      >
        {/* Round icon badge on top, like the editor's Configure dialog */}
        <Box
          sx={{
            position: 'absolute',
            top: -34,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 68,
            height: 68,
            borderRadius: '50%',
            bgcolor: '#1c86f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <AddIcon sx={{ color: '#fff', fontSize: 42 }} />
        </Box>
        <DialogContent sx={{ px: 3, pt: 5, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#313439', mb: 2, textAlign: 'center' }}>
            Create New Customer Display
          </Typography>
          {createError && (
            <Alert severity="error" onClose={() => setCreateError('')} sx={{ mb: 2 }}>{createError}</Alert>
          )}
          <Typography sx={{ fontSize: 16, color: '#676b72', mb: 1 }}>
            What should the customer display be called?
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={newTemplateName}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setNewTemplateName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                fontSize: 16,
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
              },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5 }}>
            <Typography sx={{ fontSize: 16, color: '#313439' }}>Use Default Template</Typography>
            <ShopfrontSwitch
              checked={useDefaultTemplate}
              onChange={(e) => setUseDefaultTemplate(e.target.checked)}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.25 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            disabled={creating}
            disableElevation
            sx={{
              bgcolor: '#8a8d91',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#76797d' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newTemplateName.trim() || creating}
            disableElevation
            sx={{
              bgcolor: '#32b643',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#2a9c39' },
              '&.Mui-disabled': { bgcolor: '#a1a1a1', color: '#fff' },
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Confirm Clone - reference: name question, prefilled "<name> - Clone", Cancel / Clone. */}
      <Dialog
        open={Boolean(cloneSource)}
        onClose={closeCloneDialog}
        PaperProps={{ sx: { borderRadius: '8px', width: 476, maxWidth: '92vw' } }}
      >
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#313439', mb: 2 }}>
            Confirm Clone
          </Typography>
          {cloneError && (
            <Alert severity="error" onClose={() => setCloneError('')} sx={{ mb: 2 }}>{cloneError}</Alert>
          )}
          <Typography sx={{ fontSize: 16, color: '#000', mb: 2, wordBreak: 'break-word' }}>
            What do you want to name the clone of &quot;{cloneSource?.name}&quot;?
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={cloneName}
            inputProps={{ maxLength: 100 }}
            onChange={(e) => setCloneName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmClone(); } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2, gap: 1.25 }}>
          <Button
            onClick={closeCloneDialog}
            disabled={cloning}
            disableElevation
            sx={{ bgcolor: '#8a8d91', color: '#fff', textTransform: 'none', borderRadius: '6px', fontWeight: 600, px: 3, flex: 1, '&:hover': { bgcolor: '#76797d' } }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmClone}
            disabled={cloning || !cloneName.trim()}
            disableElevation
            sx={{ bgcolor: '#22c55e', color: '#fff', textTransform: 'none', borderRadius: '6px', fontWeight: 600, px: 3, flex: 1, '&:hover': { bgcolor: '#4ade80' }, '&.Mui-disabled': { bgcolor: '#a1a1a1', color: '#fff' } }}
          >
            {cloning ? 'Cloning...' : 'Clone'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Customer Display Template"
        message={`Are you sure you want to delete ${templateToDelete?.name || 'this customer display template'}?`}
        loading={deleting}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setTemplateToDelete(null);
        }}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default CustomerDisplays;
