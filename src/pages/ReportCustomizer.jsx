import React, { useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Add as AddIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import ReportBox from '../components/Reports/ReportBox';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useAppDialogs } from '../components/Common/AppDialogProvider';

// Note: This component uses react-beautiful-dnd which would need to be installed:
// npm install react-beautiful-dnd

const ReportCustomizer = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const [reports, setReports] = useState([
    {
      id: 'report1',
      title: 'Drouin weekly Sales',
      width: 6,
      data: [
        { name: 'HARD RATED ORANGE 10PK 375ML', quantity: 5, price: 25.99 },
        { name: 'CARLTON DRY MID CAN 30PK 375ML', quantity: 3, price: 59.99 },
        { name: 'Jim Beam Cola Can 375ml', quantity: 8, price: 22.50 },
        { name: 'Wild Turkey & cola 101 Can 375ml', quantity: 4, price: 26.75 },
        { name: 'Vb Can 30pk 375ml', quantity: 2, price: 54.99 },
      ],
      columns: [
        { field: 'name', headerName: 'NAME', width: 300 },
        { field: 'quantity', headerName: 'QTY', width: 100 },
        { field: 'price', headerName: 'PRICE', width: 100, format: (value) => `$${value.toFixed(2)}` },
      ]
    },
    {
      id: 'report2',
      title: 'Weekly Inventory Report (Drouin)',
      width: 6,
      data: [
        { name: '-196 GRAPE 6% CAN 10PK 330ML', stock: 15, reorderLevel: 5 },
        { name: '16 SHOTS BUCKET LITFATLAMB30ML', stock: 8, reorderLevel: 3 },
        { name: '1800 REPOSADO TEQUILA 700ML', stock: 6, reorderLevel: 2 },
        { name: '19 Crimes Blanc De Blanc 750ML', stock: 12, reorderLevel: 4 },
        { name: '19 Crimes Cab Sauv 750ml', stock: 10, reorderLevel: 4 },
      ],
      columns: [
        { field: 'name', headerName: 'NAME', width: 300 },
        { field: 'stock', headerName: 'STOCK', width: 100 },
        { field: 'reorderLevel', headerName: 'REORDER', width: 100 },
      ]
    }
  ]);
  
  const [addReportDialogOpen, setAddReportDialogOpen] = useState(false);
  const [newReportTitle, setNewReportTitle] = useState('');
  const [newReportType, setNewReportType] = useState('sales');
  const [newReportWidth, setNewReportWidth] = useState(6);
  
  const handleOpenAddReportDialog = () => {
    setAddReportDialogOpen(true);
  };
  
  const handleCloseAddReportDialog = () => {
    setAddReportDialogOpen(false);
    setNewReportTitle('');
    setNewReportType('sales');
    setNewReportWidth(6);
  };
  
  const handleAddReport = () => {
    const newReport = {
      id: `report${reports.length + 1}`,
      title: newReportTitle,
      width: newReportWidth,
      data: [],
      columns: []
    };
    
    // Set default columns and data based on report type
    if (newReportType === 'sales') {
      newReport.columns = [
        { field: 'name', headerName: 'NAME', width: 300 },
        { field: 'quantity', headerName: 'QTY', width: 100 },
        { field: 'price', headerName: 'PRICE', width: 100, format: (value) => `$${value.toFixed(2)}` },
      ];
      newReport.data = [
        { name: 'Sample Product 1', quantity: 5, price: 25.99 },
        { name: 'Sample Product 2', quantity: 3, price: 59.99 },
        { name: 'Sample Product 3', quantity: 8, price: 22.50 },
      ];
    } else if (newReportType === 'inventory') {
      newReport.columns = [
        { field: 'name', headerName: 'NAME', width: 300 },
        { field: 'stock', headerName: 'STOCK', width: 100 },
        { field: 'reorderLevel', headerName: 'REORDER', width: 100 },
      ];
      newReport.data = [
        { name: 'Sample Product 1', stock: 15, reorderLevel: 5 },
        { name: 'Sample Product 2', stock: 8, reorderLevel: 3 },
        { name: 'Sample Product 3', stock: 6, reorderLevel: 2 },
      ];
    }
    
    setReports([...reports, newReport]);
    handleCloseAddReportDialog();
  };
  
  const handleDeleteReport = (id) => {
    setReports(reports.filter(report => report.id !== id));
  };
  
  const handleResizeReport = (id, newWidth) => {
    setReports(reports.map(report => {
      if (report.id === id) {
        return { ...report, width: newWidth };
      }
      return report;
    }));
  };
  
  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(reports);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setReports(items);
  };
  
  const handleSaveLayout = () => {
    // Here you would save the layout to your backend or local storage
    console.log('Saving layout:', reports);
    alert('Layout saved successfully!');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Customize Reports</Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={handleOpenAddReportDialog}
            sx={{ mr: 2 }}
          >
            Add Report
          </Button>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<SaveIcon />}
            onClick={handleSaveLayout}
          >
            Save Layout
          </Button>
        </Box>
      </Box>
      
      <Typography variant="body1" sx={{ mb: 3 }}>
        Drag and drop reports to rearrange them. Click the edit icon to customize each report.
      </Typography>
      
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="reports">
          {(provided) => (
            <Grid 
              container 
              spacing={3}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {reports.map((report, index) => (
                <Draggable key={report.id} draggableId={report.id} index={index}>
                  {(provided) => (
                    <Grid 
                      item 
                      xs={12} 
                      md={report.width}
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      <ReportBox
                        title={report.title}
                        data={report.data}
                        columns={report.columns}
                        onDelete={() => handleDeleteReport(report.id)}
                        onResize={(width) => handleResizeReport(report.id, width)}
                        width={report.width}
                        isDraggable={true}
                      />
                    </Grid>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </Grid>
          )}
        </Droppable>
      </DragDropContext>
      
      {reports.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            No reports added yet
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Click "Add Report" to create your first report
          </Typography>
          <Button 
            variant="outlined" 
            startIcon={<AddIcon />} 
            onClick={handleOpenAddReportDialog}
          >
            Add Report
          </Button>
        </Paper>
      )}
      
      <Dialog open={addReportDialogOpen} onClose={handleCloseAddReportDialog}>
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Add New Report
            <IconButton edge="end" color="inherit" onClick={handleCloseAddReportDialog} aria-label="close">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              label="Report Title"
              value={newReportTitle}
              onChange={(e) => setNewReportTitle(e.target.value)}
              margin="normal"
            />
            <FormControl fullWidth margin="normal">
              <InputLabel>Report Type</InputLabel>
              <Select
                value={newReportType}
                label="Report Type"
                onChange={(e) => setNewReportType(e.target.value)}
              >
                <MenuItem value="sales">Sales Report</MenuItem>
                <MenuItem value="inventory">Inventory Report</MenuItem>
                <MenuItem value="customers">Customer Report</MenuItem>
                <MenuItem value="employees">Employee Report</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth margin="normal">
              <InputLabel>Report Width</InputLabel>
              <Select
                value={newReportWidth}
                label="Report Width"
                onChange={(e) => setNewReportWidth(e.target.value)}
              >
                <MenuItem value={3}>Quarter Width (3)</MenuItem>
                <MenuItem value={4}>One Third Width (4)</MenuItem>
                <MenuItem value={6}>Half Width (6)</MenuItem>
                <MenuItem value={8}>Two Thirds Width (8)</MenuItem>
                <MenuItem value={9}>Three Quarters Width (9)</MenuItem>
                <MenuItem value={12}>Full Width (12)</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseAddReportDialog}>Cancel</Button>
          <Button 
            onClick={handleAddReport} 
            variant="contained" 
            color="primary"
            disabled={!newReportTitle}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ReportCustomizer;
