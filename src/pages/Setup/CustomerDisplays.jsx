import React, { useState } from 'react';
import {
  Box,
  Button,
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
  Typography,
} from '@mui/material';
import { Add as AddIcon, ContentCopy as CloneIcon, DeleteOutline as DeleteIcon, EditOutlined as EditIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { createDefaultCustomerDisplayTemplate } from '../../utils/customerDisplayDefaults';

const isDefaultTemplate = (template) =>
  template?.isDefault === true || template?.name === 'Customer Display';

const CustomerDisplays = () => {
  // Renders from IndexedDB first, then revalidates in the background.
  const { data: templates, refresh: loadTemplates } = usePageCache(
    'customerDisplays',
    () =>
      customerDisplayTemplateService
        .listTemplates()
        // stable creation order, matching reference
        .then((list) => [...list].sort((a, b) => Number(a.id) - Number(b.id)))
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [useDefaultTemplate, setUseDefaultTemplate] = useState(true);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const handleDelete = (template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!templateToDelete) return;
    await customerDisplayTemplateService.removeTemplate(templateToDelete.id);
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
    loadTemplates();
  };

  const handleClone = async (id) => {
    await customerDisplayTemplateService.cloneTemplate(id);
    loadTemplates();
  };

  const openCreateDialog = () => {
    setNewTemplateName('');
    setUseDefaultTemplate(true);
    setCreateDialogOpen(true);
  };

  const handleCreate = async () => {
    const name = newTemplateName.trim();
    if (!name || creating) return;
    setCreating(true);
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
      navigate(`/setup/customer-display/${savedId}/edit`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          Customer Displays
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
          sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
        >
          New
        </Button>
      </Box>
      <TableContainer sx={{ mt: 1 }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0 },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
              }}
            >
              <TableCell sx={{ pl: '20px' }}>Name</TableCell>
              <TableCell align="right" sx={{ pr: '20px' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
              '& tr:nth-of-type(even)': { bgcolor: '#f8f8f8' },
              '& td': { border: 0, fontSize: 16, color: '#000', py: 1.5 }
            }}
          >
            {templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                    No customer display templates yet. Use New to create one; they are stored in the database and listed here.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template) => (
                <TableRow
                  key={template.id}
                  // '&&' doubles class specificity so hover beats the tbody zebra nth-of-type rules
                  sx={{ '&&:hover': { bgcolor: '#dfdfdf' } }}
                >
                  <TableCell sx={{ pl: '20px' }}>{template.name}</TableCell>
                  <TableCell align="right" sx={{ pr: '20px' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
                      <Button
                        size="small"
                        startIcon={<EditIcon />}
                        onClick={() => navigate(`/setup/customer-display/${template.id}/edit`)}
                        sx={{ color: '#16a34a', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0, '&:hover': { bgcolor: 'transparent', color: '#68c389' } }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteIcon />}
                        onClick={() => handleDelete(template)}
                        disabled={isDefaultTemplate(template)}
                        sx={{
                          color: '#dc2626',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: 16,
                          minWidth: 0,
                          '&:hover': { bgcolor: 'transparent', color: '#e87272' },
                          '&.Mui-disabled': { color: '#676b72', pointerEvents: 'auto', cursor: 'not-allowed' },
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        size="small"
                        startIcon={<CloneIcon />}
                        onClick={() => handleClone(template.id)}
                        sx={{ color: '#0284c7', textTransform: 'none', fontWeight: 700, fontSize: 16, minWidth: 0, '&:hover': { bgcolor: 'transparent', color: '#5bafdb' } }}
                      >
                        Clone
                      </Button>
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
        onClose={() => setCreateDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: '8px', width: 400, maxWidth: '92vw' } }}
      >
        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 18, color: '#313439', mb: 2 }}>
            Create New Customer Display
          </Typography>
          <Typography sx={{ fontSize: 16, color: '#676b72', mb: 1 }}>
            What should the customer display be called?
          </Typography>
          <TextField
            fullWidth
            autoFocus
            value={newTemplateName}
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
              bgcolor: '#5ebbeb',
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: '#4aa9dd' },
              '&.Mui-disabled': { bgcolor: '#a1a1a1', color: '#fff' },
            }}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Customer Display Template"
        message={`Are you sure you want to delete ${templateToDelete?.name || 'this customer display template'}?`}
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
