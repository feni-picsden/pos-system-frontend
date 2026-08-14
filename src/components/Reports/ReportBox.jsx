import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  FormControlLabel,
  Switch,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Edit as EditIcon,
  Print as PrintIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import ReportTable from './ReportTable';

const ReportBox = ({ 
  title, 
  data, 
  columns, 
  onEdit, 
  onDelete, 
  onPrint, 
  onResize,
  width = 6,
  isDraggable = true
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState(title);
  const [filterByCurrentUser, setFilterByCurrentUser] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [boxWidth, setBoxWidth] = useState(width);
  
  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };
  
  const handleEditClick = () => {
    handleMenuClose();
    if (onEdit) {
      onEdit();
    } else {
      setEditDialogOpen(true);
    }
  };
  
  const handleEditDialogClose = () => {
    setEditDialogOpen(false);
  };
  
  const handleSaveChanges = () => {
    // Here you would save the changes to the report
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
  
  const handleFilterToggle = () => {
    setFilterByCurrentUser(!filterByCurrentUser);
  };
  
  const handleWidthChange = (event) => {
    const newWidth = parseInt(event.target.value);
    setBoxWidth(newWidth);
    if (onResize) {
      onResize(newWidth);
    }
  };

  return (
    <>
      <Paper 
        sx={{ 
          p: 0, 
          overflow: 'hidden', 
          border: '1px solid #1976d2',
          position: 'relative',
          height: '100%'
        }}
      >
        {isDraggable && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 0, 
              left: 0, 
              cursor: 'move',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              '&:hover': {
                backgroundColor: 'rgba(0,0,0,0.04)'
              }
            }}
          >
            <DragIndicatorIcon color="action" fontSize="small" />
          </Box>
        )}
        
        <Box 
          sx={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            p: 2,
            borderBottom: '1px solid #1976d2',
            bgcolor: '#fff',
            position: 'relative'
          }}
        >
          <Typography variant="h6" sx={{ ml: isDraggable ? 4 : 0 }}>{reportTitle}</Typography>
          <Box>
            <IconButton size="small" sx={{ mr: 1 }} onClick={handleEditClick}>
              <EditIcon />
            </IconButton>
            <IconButton size="small" sx={{ mr: 1 }} onClick={handlePrintClick}>
              <PrintIcon />
            </IconButton>
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
                Edit Report
              </MenuItem>
              <MenuItem onClick={handlePrintClick}>
                <PrintIcon fontSize="small" sx={{ mr: 1 }} />
                Print Report
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleDeleteClick}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                Delete Report
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        
        <Box sx={{ p: 0 }}>
          <ReportTable data={data} columns={columns} />
        </Box>
      </Paper>
      
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Edit Report
            <IconButton edge="end" color="inherit" onClick={handleEditDialogClose} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Report Title"
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              margin="normal"
            />
            
            <FormControl fullWidth margin="normal">
              <InputLabel>Report Width</InputLabel>
              <Select
                value={boxWidth}
                onChange={handleWidthChange}
                label="Report Width"
              >
                <MenuItem value={3}>Quarter Width (3)</MenuItem>
                <MenuItem value={4}>One Third Width (4)</MenuItem>
                <MenuItem value={6}>Half Width (6)</MenuItem>
                <MenuItem value={8}>Two Thirds Width (8)</MenuItem>
                <MenuItem value={9}>Three Quarters Width (9)</MenuItem>
                <MenuItem value={12}>Full Width (12)</MenuItem>
              </Select>
            </FormControl>
            
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={filterByCurrentUser}
                    onChange={handleFilterToggle}
                    color="primary"
                  />
                }
                label="Filter report by current user"
              />
            </Box>
          </Box>
          
          <Typography variant="subtitle1" gutterBottom>
            Column Settings
          </Typography>
          
          {columns.map((column, index) => (
            <Box 
              key={index} 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                mb: 1, 
                p: 1,
                border: '1px solid #e0e0e0',
                borderRadius: 1
              }}
            >
              <TextField
                label="Column Name"
                value={column.headerName}
                size="small"
                sx={{ mr: 2, flex: 2 }}
              />
              <TextField
                label="Width"
                type="number"
                value={column.width}
                size="small"
                sx={{ mr: 2, flex: 1 }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={true}
                    color="primary"
                    size="small"
                  />
                }
                label="Visible"
              />
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose}>Cancel</Button>
          <Button onClick={handleSaveChanges} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ReportBox;
