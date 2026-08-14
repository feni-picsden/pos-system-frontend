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
  Settings as SettingsIcon,
  DragIndicator as DragIndicatorIcon
} from '@mui/icons-material';
import ResizableBox from '../Dashboard/ResizableBox';
import PropTypes from 'prop-types';

const ResizableReportBox = ({
  title,
  children,
  initialWidth = '100%',
  initialHeight = 400,
  onEdit,
  onDelete,
  onPrint,
  onResize,
  isDraggable = true
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reportTitle, setReportTitle] = useState(title);
  const [reportWidth, setReportWidth] = useState(initialWidth);
  const [reportHeight, setReportHeight] = useState(initialHeight);
  
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
  
  const handleSaveChanges = () => {
    if (onEdit) {
      onEdit({
        title: reportTitle,
        width: reportWidth,
        height: reportHeight
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
  
  const handleResize = (dimensions) => {
    if (onResize) {
      onResize(dimensions);
    }
  };

  return (
    <ResizableBox
      initialWidth={initialWidth}
      initialHeight={initialHeight}
      onResize={handleResize}
      style={{ margin: 2 }}
    >
      <Paper
        sx={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #1976d2',
          position: 'relative'
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
            bgcolor: '#fff'
          }}
        >
          <Typography variant="h6" sx={{ ml: isDraggable ? 4 : 0 }}>{title}</Typography>
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
              <MenuItem onClick={handleDeleteClick}>
                <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
                Delete Report
              </MenuItem>
            </Menu>
          </Box>
        </Box>
        
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 0 }}>
          {children}
        </Box>
      </Paper>
      
      <Dialog open={editDialogOpen} onClose={handleEditDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>Edit Report</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Report Title"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Width"
                value={typeof reportWidth === 'string' ? reportWidth : `${reportWidth}px`}
                onChange={(e) => {
                  let value = e.target.value;
                  if (value.endsWith('px')) {
                    value = parseInt(value);
                  }
                  setReportWidth(value);
                }}
                helperText="Use px or % (e.g., 500px or 50%)"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Height (px)"
                type="number"
                value={reportHeight}
                onChange={(e) => setReportHeight(Number(e.target.value))}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleEditDialogClose}>Cancel</Button>
          <Button onClick={handleSaveChanges} variant="contained" color="primary">
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </ResizableBox>
  );
};

ResizableReportBox.propTypes = {
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  initialWidth: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  initialHeight: PropTypes.number,
  onEdit: PropTypes.func,
  onDelete: PropTypes.func,
  onPrint: PropTypes.func,
  onResize: PropTypes.func,
  isDraggable: PropTypes.bool
};

export default ResizableReportBox;
