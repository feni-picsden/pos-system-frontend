import React, { useState, useEffect, useRef } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  TextField,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  ListItemText,
} from '@mui/material';
import {
  Add as AddIcon,
  VisibilityOutlined as ViewIcon,
  EditOutlined as EditIcon,
  HubOutlined as AssignIcon,
  DeleteOutline as DeleteIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ClassificationDialog from '../../components/Classifications/ClassificationDialog';
import PerformanceGraph from '../../components/Classifications/PerformanceGraph';
import classificationService from '../../services/classificationService';
import usePageCache from '../../hooks/usePageCache';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const CLASSIFICATION_TYPE_OPTIONS = [
  { value: 'BRAND', label: 'Brand' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'TAG', label: 'Tag' },
];

// Row action buttons: 42px tall pill, radius 12px, px-32, subtle gray hover, no transition
const rowActionSx = (color) => ({
  color,
  textTransform: 'none',
  fontWeight: 700,
  fontSize: 16,
  minWidth: 0,
  height: 42,
  borderRadius: '12px',
  px: 4,
  transition: 'none',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
});

const formatType = (type) =>
  type ? type.charAt(0) + type.slice(1).toLowerCase() : '';

const Classifications = () => {
  // Renders from IndexedDB first, then revalidates in the background.
  // Search / type filtering happens locally in filterClassifications().
  const {
    data: classifications,
    loading,
    refresh: loadClassifications,
  } = usePageCache('classifications', () =>
    classificationService.getClassifications().then((r) => r.classifications || [])
  );
  const [filteredClassifications, setFilteredClassifications] = useState([]);
  const [error, setError] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingClassification, setEditingClassification] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  // Parity: ref pre-selects all 4 classification types (shown as chips)
  const [categoryFilter, setCategoryFilter] = useState(
    CLASSIFICATION_TYPE_OPTIONS.map((o) => o.value)
  );
  const [saveError, setSaveError] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [classificationToDelete, setClassificationToDelete] = useState(null);
  const typeSelectAnchorRef = useRef(null);
  const [typeMenuWidth, setTypeMenuWidth] = useState(undefined);
  const navigate = useNavigate();

  useEffect(() => {
    filterClassifications();
  }, [classifications, searchTerm, categoryFilter]);

  const filterClassifications = () => {
    let filtered = classifications.filter(classification => {
      // Search filter
      const matchesSearch = !searchTerm ||
        classification.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (classification.masterDatabaseRef &&
         classification.masterDatabaseRef.toLowerCase().includes(searchTerm.toLowerCase()));

      // Classifications multi-select filter (none selected = show all)
      const matchesCategory = categoryFilter.length === 0 || categoryFilter.includes(classification.type);

      return matchesSearch && matchesCategory;
    });

    setFilteredClassifications(filtered);
  };

  const handleAddClassification = () => {
    setEditingClassification(null);
    setSaveError('');
    setOpenDialog(true);
  };

  // Parity: ref Edit opens the edit form directly. Open the Modify dialog in place
  // (no extra hop through the detail view page).
  const handleEditClassification = (classification) => {
    setEditingClassification(classification);
    setSaveError('');
    setOpenDialog(true);
  };

  const handleViewClassification = (classification) => {
    navigate(`/stock-management/classifications/${classification.id}`);
  };

  const handleDeleteClassification = (classification) => {
    setClassificationToDelete(classification);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteClassification = async () => {
    if (!classificationToDelete) {
      setDeleteDialogOpen(false);
      return;
    }
    try {
      await classificationService.deleteClassification(classificationToDelete.id);
      await loadClassifications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete classification');
      console.error('Error deleting classification:', err);
    } finally {
      setDeleteDialogOpen(false);
      setClassificationToDelete(null);
    }
  };

  const handleAssignClassification = (classification) => {
    navigate(`/stock-management/classifications/${classification.id}/assign`);
  };


  const handleClassificationSaved = async (classificationData) => {
    try {
      setSaveError('');
      if (editingClassification) {
        await classificationService.updateClassification(editingClassification.id, classificationData);
      } else {
        // Super-admin creates arrive with outletId=null (global). The list is
        // scoped to selectedOutletId (apiClient appends it to super-admin GETs)
        // with an exact backend match that excludes globals, so a null-outlet
        // record would persist but never appear. Land the new record in the
        // currently-selected outlet so create-then-see-it works like the ref.
        const dataToCreate = { ...classificationData };
        if (dataToCreate.outletId == null) {
          const selectedOutletId = localStorage.getItem('selectedOutletId');
          if (selectedOutletId) dataToCreate.outletId = parseInt(selectedOutletId, 10);
        }
        await classificationService.createClassification(dataToCreate);
      }
      setOpenDialog(false);
      setEditingClassification(null);
      await loadClassifications();
    } catch (err) {
      // Surface the failure INSIDE the still-open dialog. The page-level Alert
      // renders behind the modal, so on a failed save the user saw nothing and
      // the record silently didn't persist.
      setSaveError(err.response?.data?.error || 'Failed to save classification');
      console.error('Error saving classification:', err);
    }
  };

  const handleCategoryFilterChange = (event) => {
    const value = event.target.value;
    setCategoryFilter(typeof value === 'string' ? value.split(',') : value);
  };

  if (loading) {
    return <PageLoader />;
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h4" component="h1" fontWeight="bold">
            Classifications
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddClassification}
            sx={{ bgcolor: '#5ebbeb', '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' }, transition: 'none', borderRadius: '12px', textTransform: 'none', boxShadow: 'none', fontWeight: 700, fontSize: 16, px: 4, height: 42 }}
          >
            Add Classification
          </Button>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#000', lineHeight: 1 }}>
            {filteredClassifications.length}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Results
          </Typography>
        </Box>
      </Box>

      {/* Search */}
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>
        Search
      </Typography>
      <TextField
        fullWidth
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{
          mb: 2,
          backgroundColor: 'white',
          '& .MuiOutlinedInput-root': {
            borderRadius: '8px',
            fontSize: 16,
            height: 42,
            // Match Shopfront: dark-gray border, turns solid black on focus/click
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: '2px' },
          },
        }}
      />

      {/* Classifications type filter: labeled multi-select with chips + overlay listbox */}
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 400, fontSize: 16, color: '#000' }}>
        Classifications
      </Typography>
      <FormControl fullWidth sx={{ mb: 2 }} ref={typeSelectAnchorRef}>
        <Select
          multiple
          displayEmpty
          value={categoryFilter}
          onChange={handleCategoryFilterChange}
          onOpen={() => setTypeMenuWidth(typeSelectAnchorRef.current ? typeSelectAnchorRef.current.offsetWidth : undefined)}
          IconComponent={ArrowDropDownIcon}
          MenuProps={{
            PaperProps: {
              sx: {
                mt: 0.5,
                width: typeMenuWidth,
                maxWidth: typeMenuWidth,
                maxHeight: 288,
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
                '& .MuiList-root': { py: 0.5 },
              },
            },
          }}
          renderValue={(selected) => {
            if (!selected || selected.length === 0) {
              return <span />;
            }
            return (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {selected.map((value) => {
                  const opt = CLASSIFICATION_TYPE_OPTIONS.find((o) => o.value === value);
                  return (
                    <Box
                      key={value}
                      component="span"
                      sx={{
                        bgcolor: 'rgba(0,0,0,0.1)',
                        borderRadius: '4px',
                        px: 1,
                        fontSize: 14,
                        lineHeight: '24px',
                        color: '#000',
                      }}
                    >
                      {opt ? opt.label : value}
                    </Box>
                  );
                })}
              </Box>
            );
          }}
          sx={{
            backgroundColor: 'white',
            borderRadius: '8px',
            fontSize: 16,
            minHeight: 42,
            '& .MuiSelect-select': { display: 'flex', alignItems: 'center', py: '8px' },
            // Match Shopfront: solid dark-gray border, no hover/focus color shift
            '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
            '& .MuiSelect-icon': { color: '#404040' },
          }}
        >
          {CLASSIFICATION_TYPE_OPTIONS.map((option) => {
            const isSelected = categoryFilter.indexOf(option.value) > -1;
            return (
              <MenuItem
                key={option.value}
                value={option.value}
                sx={{
                  px: 2,
                  py: 2,
                  fontSize: 16,
                  // Doubled-class (&&) specificity so the #5ebbeb hover beats MUI's
                  // default .MuiMenuItem-root.Mui-selected background (every option is
                  // selected by default, so plain &:hover was losing the cascade).
                  '&&.Mui-selected': { bgcolor: 'transparent' },
                  '&&:hover, &&.Mui-selected:hover, &&.Mui-focusVisible': { bgcolor: '#5ebbeb' },
                  '&&:hover .MuiListItemText-primary': { color: '#000' },
                }}
              >
                <Checkbox
                  checked={isSelected}
                  size="small"
                  disableRipple
                  sx={{ p: 0, mr: 1.5, color: '#767676', '&.Mui-checked': { color: '#0ea5e9' } }}
                />
                <ListItemText
                  primary={option.label}
                  primaryTypographyProps={{ fontSize: 16, color: isSelected ? '#0ea5e9' : '#000' }}
                />
              </MenuItem>
            );
          })}
        </Select>
      </FormControl>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Classifications Table */}
      <TableContainer sx={{ mt: 1 }}>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow
              sx={{
                '& th': { bgcolor: '#5ebbeb', color: 'white', fontWeight: 700, fontSize: 16, border: 0, height: 51, py: 0, whiteSpace: 'nowrap' },
                '& th:first-of-type': { borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' },
                '& th:last-of-type': { borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }
              }}
            >
              <TableCell>
                Name
              </TableCell>
              <TableCell>
                Type
              </TableCell>
              <TableCell>
                Product Count
              </TableCell>
              <TableCell>
                Performance
              </TableCell>
              <TableCell align="center">
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody
            sx={{
              '& tr:nth-of-type(odd)': { bgcolor: '#ffffff' },
              '& tr:nth-of-type(even)': { bgcolor: '#f8f8f8' },
              '& td': { border: 0, fontSize: 16, color: '#000', py: '35px' }
            }}
          >
            {filteredClassifications.map((classification) => (
              <TableRow key={classification.id}>
                <TableCell>
                  <Typography
                    component="a"
                    href={`/stock-management/classifications/${classification.id}`}
                    onClick={(e) => {
                      e.preventDefault();
                      handleViewClassification(classification);
                    }}
                    sx={{ fontSize: 16, color: '#000', textDecoration: 'none', cursor: 'pointer' }}
                  >
                    {classification.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 16, color: '#000' }}>
                    {formatType(classification.type)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography sx={{ fontSize: 16, color: '#000' }}>
                    {classification.productCount}
                  </Typography>
                </TableCell>
                <TableCell>
                  <PerformanceGraph
                    classificationId={classification.id}
                    productCount={classification.productCount}
                  />
                </TableCell>
                <TableCell align="center">
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                    <Button
                      variant="text"
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewClassification(classification)}
                      size="small"
                      sx={rowActionSx('#2f9fd6')}
                    >
                      View
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditClassification(classification)}
                      size="small"
                      sx={rowActionSx('#16a34a')}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<AssignIcon />}
                      onClick={() => handleAssignClassification(classification)}
                      size="small"
                      sx={rowActionSx('#d97706')}
                    >
                      Assign
                    </Button>
                    <Button
                      variant="text"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDeleteClassification(classification)}
                      size="small"
                      sx={rowActionSx('#e5484d')}
                    >
                      Delete
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            {filteredClassifications.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchTerm || categoryFilter.length > 0
                      ? 'No classifications found matching your filters'
                      : 'No classifications found'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Classification"
        message={`Are you sure you want to delete "${classificationToDelete?.name || ''}"?`}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setClassificationToDelete(null);
        }}
        onConfirm={confirmDeleteClassification}
      />

      {/* Classification Dialog */}
      <ClassificationDialog
        open={openDialog}
        onClose={() => {
          setOpenDialog(false);
          setSaveError('');
        }}
        onSave={handleClassificationSaved}
        editingClassification={editingClassification}
        saveError={saveError}
      />
    </Box>
  );
};

export default Classifications;
