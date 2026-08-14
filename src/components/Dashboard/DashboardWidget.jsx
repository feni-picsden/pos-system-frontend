import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  TextField,
  Grid
} from '@mui/material';
import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Print as PrintIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';

const DashboardWidget = ({ 
  title, 
  children, 
  onEdit, 
  onDelete, 
  onPrint, 
  onSettings, 
  height = 400,
  width = '100%'
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [widgetTitle, setWidgetTitle] = useState(title);
  const [widgetType, setWidgetType] = useState('table');
  const [widgetHeight, setWidgetHeight] = useState(height);
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleEditClick = () => {
    handleMenuClose();
    setEditDialogOpen(true);
  };
  
  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
  };
  
  const handleSaveSettings = () => {
    // Here you would save the widget settings
    if (onEdit) {
      onEdit({
        title: widgetTitle,
        type: widgetType,
        height: widgetHeight
      });
    }
    setEditDialogOpen(false);
  };
  
  const handlePrintClick = () => {
    handleMenuClose();
    if (onPrint) onPrint();
  };
  
  const handleDeleteClick = () => {
    handleMenuClose();
    if (onDelete) onDelete();
  };
  
  const handleSettingsClick = () => {
    handleMenuClose();
    if (onSettings) onSettings();
  };

  return (
    <>
      <Paper 
        sx={{ 
          height: height, 
          width: width,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            p: 2,
            borderBottom: '1px solid #e0e0e0'
          }}
        >
          <Typography variant="h6">{title}</Typography>
          <Box>
            <IconButton size="small" onClick={handleMenuOpen}>
              <MoreVertIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
            >
              <MenuItem onClick={handleEditClick}>
                <EditIcon fontSize="small" sx={{ mr: 1 }} />
                Edit
              </MenuItem>
              <MenuItem onClick={handlePrintClick}>
                <PrintIcon fontSize="small" sx={{ mr: 1 }} />
                Print
              </MenuItem>
              <MenuItem onClick={handleSettingsClick}>
                <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
                Settings
              </MenuItem>
              <MenuItem onClick={handleDeleteClick}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                Remove
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {children}
        </Box>
      </Paper>
      
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose}>
        <DialogTitle>Edit Widget</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Widget Title"
                value={widgetTitle}
                onChange={(e) => setWidgetTitle(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Widget Type</InputLabel>
                <Select
                  value={widgetType}
                  label="Widget Type"
                  onChange={(e) => setWidgetType(e.target.value)}
                >
                  <MenuItem value="table">Table</MenuItem>
                  <MenuItem value="chart">Chart</MenuItem>
                  <MenuItem value="stats">Statistics</MenuItem>
                  <MenuItem value="list">List</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Height (px)"
                type="number"
                value={widgetHeight}
                onChange={(e) => setWidgetHeight(Number(e.target.value))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose}>Cancel</Button>
          <Button onClick={handleSaveSettings} variant="contained" color="primary">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default DashboardWidget;
