import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  IconButton,
  Divider
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';

const ReportEditor = ({ open, onClose, report }) => {
  const [reportName, setReportName] = useState(report?.name || '');
  const [reportType, setReportType] = useState(report?.type || 'sales');
  const [columns, setColumns] = useState(report?.columns || [
    { id: 'name', name: 'Name', visible: true, width: 300 },
    { id: 'quantity', name: 'Quantity', visible: true, width: 100 },
    { id: 'price', name: 'Price', visible: true, width: 100 }
  ]);
  const [filters, setFilters] = useState(report?.filters || []);
  
  const handleAddColumn = () => {
    setColumns([...columns, { id: `column-${columns.length + 1}`, name: '', visible: true, width: 100 }]);
  };
  
  const handleRemoveColumn = (index) => {
    const newColumns = [...columns];
    newColumns.splice(index, 1);
    setColumns(newColumns);
  };
  
  const handleColumnChange = (index, field, value) => {
    const newColumns = [...columns];
    newColumns[index] = { ...newColumns[index], [field]: value };
    setColumns(newColumns);
  };
  
  const moveColumn = (index, direction) => {
    if (
      (direction === 'up' && index === 0) || 
      (direction === 'down' && index === columns.length - 1)
    ) {
      return;
    }
    
    const newColumns = [...columns];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newColumns[index];
    newColumns[index] = newColumns[targetIndex];
    newColumns[targetIndex] = temp;
    
    setColumns(newColumns);
  };
  
  const handleAddFilter = () => {
    setFilters([...filters, { field: '', operator: 'equals', value: '' }]);
  };
  
  const handleRemoveFilter = (index) => {
    const newFilters = [...filters];
    newFilters.splice(index, 1);
    setFilters(newFilters);
  };
  
  const handleFilterChange = (index, field, value) => {
    const newFilters = [...filters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setFilters(newFilters);
  };
  
  const handleSave = () => {
    // Save report configuration
    const updatedReport = {
      name: reportName,
      type: reportType,
      columns,
      filters
    };
    
    // Here you would typically save this to your state or backend
    console.log('Saving report:', updatedReport);
    
    onClose(updatedReport);
  };

  return (
    <Dialog 
      open={open} 
      onClose={() => onClose()} 
      fullWidth 
      maxWidth="md"
      PaperProps={{
        sx: {
          height: '80vh'
        }
      }}
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Edit Report</Typography>
        <IconButton edge="end" color="inherit" onClick={() => onClose()} aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent dividers>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Report Name"
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              margin="normal"
              variant="outlined"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth margin="normal" variant="outlined">
              <InputLabel>Report Type</InputLabel>
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                label="Report Type"
              >
                <MenuItem value="sales">Sales Report</MenuItem>
                <MenuItem value="inventory">Inventory Report</MenuItem>
                <MenuItem value="customers">Customer Report</MenuItem>
                <MenuItem value="employees">Employee Report</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Columns
              </Typography>
              <Button 
                startIcon={<AddIcon />} 
                onClick={handleAddColumn}
                variant="outlined"
                size="small"
              >
                Add Column
              </Button>
            </Box>
            
            <Box>
                    {columns.map((column, index) => (
                          <Box
                            key={column.id}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              p: 1,
                              mb: 1,
                              border: '1px solid #e0e0e0',
                              borderRadius: 1,
                              bgcolor: 'background.paper'
                            }}
                          >
                            <Box sx={{ mr: 1, display: 'flex', flexDirection: 'column' }}>
                              <IconButton 
                                size="small" 
                                disabled={index === 0}
                                onClick={() => moveColumn(index, 'up')}
                              >
                                <ExpandLess fontSize="small" />
                              </IconButton>
                              <IconButton 
                                size="small" 
                                disabled={index === columns.length - 1}
                                onClick={() => moveColumn(index, 'down')}
                              >
                                <ExpandMore fontSize="small" />
                              </IconButton>
                            </Box>
                            <Grid container spacing={2} alignItems="center">
                              <Grid item xs={5}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Column Name"
                                  value={column.name}
                                  onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                                />
                              </Grid>
                              <Grid item xs={3}>
                                <TextField
                                  fullWidth
                                  size="small"
                                  label="Width"
                                  type="number"
                                  value={column.width}
                                  onChange={(e) => handleColumnChange(index, 'width', parseInt(e.target.value))}
                                />
                              </Grid>
                              <Grid item xs={3}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Visible</InputLabel>
                                  <Select
                                    value={column.visible}
                                    onChange={(e) => handleColumnChange(index, 'visible', e.target.value)}
                                    label="Visible"
                                  >
                                    <MenuItem value={true}>Yes</MenuItem>
                                    <MenuItem value={false}>No</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={1}>
                                <IconButton 
                                  color="error" 
                                  onClick={() => handleRemoveColumn(index)}
                                  size="small"
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </Grid>
                            </Grid>
                          </Box>
                    ))}
            </Box>
          </Grid>
          
          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                Filters
              </Typography>
              <Button 
                startIcon={<AddIcon />} 
                onClick={handleAddFilter}
                variant="outlined"
                size="small"
              >
                Add Filter
              </Button>
            </Box>
            
            {filters.map((filter, index) => (
              <Box
                key={index}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  mb: 1,
                  border: '1px solid #e0e0e0',
                  borderRadius: 1,
                  bgcolor: 'background.paper'
                }}
              >
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={4}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Field</InputLabel>
                      <Select
                        value={filter.field}
                        onChange={(e) => handleFilterChange(index, 'field', e.target.value)}
                        label="Field"
                      >
                        {columns.map(column => (
                          <MenuItem key={column.id} value={column.id}>
                            {column.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={3}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={filter.operator}
                        onChange={(e) => handleFilterChange(index, 'operator', e.target.value)}
                        label="Operator"
                      >
                        <MenuItem value="equals">Equals</MenuItem>
                        <MenuItem value="contains">Contains</MenuItem>
                        <MenuItem value="greater_than">Greater Than</MenuItem>
                        <MenuItem value="less_than">Less Than</MenuItem>
                        <MenuItem value="between">Between</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={4}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Value"
                      value={filter.value}
                      onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton 
                      color="error" 
                      onClick={() => handleRemoveFilter(index)}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </Box>
            ))}
            
            {filters.length === 0 && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No filters added yet. Click "Add Filter" to create one.
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportEditor;
