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
import { byMode } from '../../theme/sfPalette';

// Dark-mode overrides for the shared Setup template list (light values = TemplateListActions' own).
const listHeadDarkSx = {
  '& th': { bgcolor: byMode('transparent', '#333333'), color: byMode('#000', '#5ebbeb'), borderColor: byMode('#000', '#373737') },
};
const listBodyDarkSx = {
  '& tr': { bgcolor: byMode('#f8f8f8', '#232323') },
  '& td': { borderColor: byMode('#000', '#373737'), color: byMode('#000', '#f8f8f8') },
};

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
  '&:hover': { bgcolor: byMode('rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)') },
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
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', color: byMode('#000', '#f8f8f8') }}>
          Customer Displays
        </Typography>
        {canModify && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={openCreateDialog}
            sx={{
              color: byMode('#fff', '#232323'),
              textTransform: 'none',
              boxShadow: 'none',
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16,
              height: 42,
              px: 3,
              transition: INSTANT,
              backgroundColor: byMode('#22c55e', '#7bf1a8'),
              '&:hover': { backgroundColor: byMode('#4ade80', '#a4f6c4'), boxShadow: 'none' },
            }}
          >
            New
          </Button>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: byMode('#000', '#f8f8f8') }}>
            {templates.length}
          </Typography>
          <Typography sx={{ fontSize: 13, color: byMode('#676b72', '#a0a4aa') }}>Results</Typography>
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
          <TableHead sx={[templateListHeadSx, listHeadDarkSx]}>
            <TableRow>
              <TableCell>Name</TableCell>
              {showOutletColumn && <TableCell>Outlet</TableCell>}
              <TableCell sx={{ width: 320 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={[templateListBodySx, listBodyDarkSx]}>
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
                        sx={{ ...ROW_ACTION_SX, color: byMode('#32b643', '#7bf1a8'), '&:hover': { color: byMode('#6dd77b', '#a4f6c4'), bgcolor: 'transparent' } }}
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
                                color: byMode('#676b72', '#a0a4aa'),
                                '&:hover': { color: byMode('#e3342f', '#ffa2a2'), bgcolor: 'transparent' },
                                '&.Mui-disabled': { color: byMode('#b5b5b5', '#757575'), pointerEvents: 'auto', cursor: 'not-allowed' },
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
                          sx={{ ...ROW_ACTION_SX, color: byMode('#1c86f2', '#74d4ff'), '&:hover': { color: byMode('#73b4f7', '#a5e3ff'), bgcolor: 'transparent' } }}
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
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: byMode('#313439', '#f8f8f8'), mb: 2, textAlign: 'center' }}>
            Create New Customer Display
          </Typography>
          {createError && (
            <Alert severity="error" onClose={() => setCreateError('')} sx={{ mb: 2 }}>{createError}</Alert>
          )}
          <Typography sx={{ fontSize: 16, color: byMode('#676b72', '#a0a4aa'), mb: 1 }}>
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
                '& .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#404040', '#a1a1a1'), borderWidth: '1px' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('#000', '#f8f8f8'), borderWidth: '2px' },
              },
            }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2.5 }}>
            <Typography sx={{ fontSize: 16, color: byMode('#313439', '#f8f8f8') }}>Use Default Template</Typography>
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
              bgcolor: byMode('#8a8d91', '#3a3a3a'),
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: byMode('#76797d', '#4a4a4a') },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!newTemplateName.trim() || creating}
            disableElevation
            sx={{
              bgcolor: byMode('#32b643', '#7bf1a8'),
              color: byMode('#fff', '#232323'),
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: byMode('#2a9c39', '#5ee08e') },
              '&.Mui-disabled': { bgcolor: byMode('#a1a1a1', '#3a3a3a'), color: byMode('#fff', '#a0a4aa') },
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
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: byMode('#313439', '#f8f8f8'), mb: 2 }}>
            Confirm Clone
          </Typography>
          {cloneError && (
            <Alert severity="error" onClose={() => setCloneError('')} sx={{ mb: 2 }}>{cloneError}</Alert>
          )}
          <Typography sx={{ fontSize: 16, color: byMode('#000', '#f8f8f8'), mb: 2, wordBreak: 'break-word' }}>
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
            sx={{ bgcolor: byMode('#8a8d91', '#3a3a3a'), color: byMode('#fff', '#f8f8f8'), textTransform: 'none', borderRadius: '6px', fontWeight: 600, px: 3, flex: 1, '&:hover': { bgcolor: byMode('#76797d', '#4a4a4a') } }}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmClone}
            disabled={cloning || !cloneName.trim()}
            disableElevation
            sx={{ bgcolor: byMode('#22c55e', '#7bf1a8'), color: byMode('#fff', '#232323'), textTransform: 'none', borderRadius: '6px', fontWeight: 600, px: 3, flex: 1, '&:hover': { bgcolor: byMode('#4ade80', '#5ee08e') }, '&.Mui-disabled': { bgcolor: byMode('#a1a1a1', '#3a3a3a'), color: byMode('#fff', '#a0a4aa') } }}
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
