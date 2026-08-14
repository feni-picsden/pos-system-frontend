import React, { useState } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  IconButton,
  Menu,
  MenuItem,
  Divider,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import {
  Edit as EditIcon,
  Print as PrintIcon,
  MoreVert as MoreVertIcon,
  Add as AddIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import ReportTable from '../components/Reports/ReportTable';
import ReportEditor from '../components/Reports/ReportEditor';
import ReportBox from '../components/Reports/ReportBox';
import ResizableReportBox from '../components/Reports/ResizableReportBox';

const Reports = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedReport, setSelectedReport] = useState('');
  const [filterByCurrentUser, setFilterByCurrentUser] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  
  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleReportChange = (event) => {
    setSelectedReport(event.target.value);
  };

  const handleFilterToggle = () => {
    setFilterByCurrentUser(!filterByCurrentUser);
  };
  
  const handleEditReport = (report) => {
    setCurrentReport(report);
    setEditDialogOpen(true);
  };
  
  const handleCloseEditDialog = (updatedReport) => {
    if (updatedReport) {
      // Handle saving the updated report
      console.log('Updated report:', updatedReport);
    }
    setEditDialogOpen(false);
    setCurrentReport(null);
  };

  // Sample data for reports
  const reportTypes = [
    { id: 'weekly-sales', name: 'Drouin weekly Sales' },
    { id: 'inventory-report', name: 'Weekly Inventory Report (Drouin)' },
    { id: 'sales-by-category', name: 'Sales by Category' },
    { id: 'sales-by-employee', name: 'Sales by Employee' },
  ];

  const salesData = [
    { name: 'HARD RATED ORANGE 10PK 375ML', quantity: 5, price: 25.99 },
    { name: 'CARLTON DRY MID CAN 30PK 375ML', quantity: 3, price: 59.99 },
    { name: 'Jim Beam Cola Can 375ml', quantity: 8, price: 22.50 },
    { name: 'Wild Turkey & cola 101 Can 375ml', quantity: 4, price: 26.75 },
    { name: 'Vb Can 30pk 375ml', quantity: 2, price: 54.99 },
  ];

  const inventoryData = [
    { name: '-196 GRAPE 6% CAN 10PK 330ML', stock: 15, reorderLevel: 5 },
    { name: '16 SHOTS BUCKET LITFATLAMB30ML', stock: 8, reorderLevel: 3 },
    { name: '1800 REPOSADO TEQUILA 700ML', stock: 6, reorderLevel: 2 },
    { name: '19 Crimes Blanc De Blanc 750ML', stock: 12, reorderLevel: 4 },
    { name: '19 Crimes Cab Sauv 750ml', stock: 10, reorderLevel: 4 },
  ];

  const renderContent = () => (
    <Box sx={{ p: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="h4" component="h1">
              Reports
            </Typography>
            <Box>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<AddIcon />}
                sx={{ mr: 1 }}
              >
                New Report
              </Button>
              <IconButton onClick={handleMenuClick}>
                <MoreVertIcon />
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleMenuClose}>Import Reports</MenuItem>
                <MenuItem onClick={handleMenuClose}>Export Reports</MenuItem>
                <Divider />
                <MenuItem onClick={handleMenuClose}>Report Settings</MenuItem>
              </Menu>
            </Box>
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 0, overflow: 'hidden', border: '1px solid #1976d2' }}>
            <Box sx={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              borderBottom: '1px solid #1976d2',
              bgcolor: '#fff'
            }}>
              <Box sx={{ 
                flex: '1 1 33%', 
                p: 2, 
                borderRight: '1px solid #1976d2',
                minWidth: { xs: '100%', md: '33%' }
              }}>
                <FormControl fullWidth>
                  <InputLabel id="report-select-label">Select Report</InputLabel>
                  <Select
                    labelId="report-select-label"
                    id="report-select"
                    value={selectedReport || 'weekly-sales'}
                    onChange={handleReportChange}
                    label="Select Report"
                  >
                    {reportTypes.map((report) => (
                      <MenuItem key={report.id} value={report.id}>
                        {report.name}
                      </MenuItem>
                    ))}
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
              <Box sx={{ 
                flex: '1 1 33%', 
                p: 2, 
                borderRight: '1px solid #1976d2',
                minWidth: { xs: '100%', md: '33%' }
              }}>
                <FormControl fullWidth>
                  <InputLabel id="report-select-label-2">Select Report</InputLabel>
                  <Select
                    labelId="report-select-label-2"
                    id="report-select-2"
                    value={selectedReport || 'inventory-report'}
                    onChange={handleReportChange}
                    label="Select Report"
                  >
                    {reportTypes.map((report) => (
                      <MenuItem key={report.id} value={report.id}>
                        {report.name}
                      </MenuItem>
                    ))}
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
              <Box sx={{ 
                flex: '1 1 33%', 
                p: 2,
                minWidth: { xs: '100%', md: '33%' }
              }}>
                <FormControl fullWidth>
                  <InputLabel id="report-select-label-3">Select a report...</InputLabel>
                  <Select
                    labelId="report-select-label-3"
                    id="report-select-3"
                    value=""
                    onChange={handleReportChange}
                    label="Select a report..."
                  >
                    {reportTypes.map((report) => (
                      <MenuItem key={report.id} value={report.id}>
                        {report.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Box sx={{ mt: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={false}
                        onChange={handleFilterToggle}
                        color="primary"
                      />
                    }
                    label="Filter report by current user"
                  />
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <ResizableReportBox
            title="Drouin weekly Sales"
            initialWidth="100%"
            initialHeight={400}
            onEdit={() => handleEditReport({
              id: 'weekly-sales',
              name: 'Drouin weekly Sales',
              type: 'sales',
              columns: [
                { id: 'name', name: 'NAME', visible: true, width: 300 },
                { id: 'quantity', name: 'QTY', visible: true, width: 100 },
                { id: 'price', name: 'PRICE', visible: true, width: 100 }
              ]
            })}
            onPrint={() => console.log('Print sales report')}
            onDelete={() => console.log('Delete sales report')}
            onResize={(dimensions) => console.log('Resized sales report:', dimensions)}
            isDraggable={false}
          >
            <ReportTable 
              data={salesData} 
              columns={[
                { field: 'name', headerName: 'NAME', width: 300 },
                { field: 'quantity', headerName: 'QTY', width: 100 },
                { field: 'price', headerName: 'PRICE', width: 100, format: (value) => `$${value.toFixed(2)}` },
              ]} 
            />
          </ResizableReportBox>
        </Grid>

        <Grid item xs={12} md={6}>
          <ResizableReportBox
            title="Weekly Inventory Report (Drouin)"
            initialWidth="100%"
            initialHeight={400}
            onEdit={() => handleEditReport({
              id: 'inventory-report',
              name: 'Weekly Inventory Report (Drouin)',
              type: 'inventory',
              columns: [
                { id: 'name', name: 'NAME', visible: true, width: 300 },
                { id: 'stock', name: 'STOCK', visible: true, width: 100 },
                { id: 'reorderLevel', name: 'REORDER', visible: true, width: 100 }
              ]
            })}
            onPrint={() => console.log('Print inventory report')}
            onDelete={() => console.log('Delete inventory report')}
            onResize={(dimensions) => console.log('Resized inventory report:', dimensions)}
            isDraggable={false}
          >
            <ReportTable 
              data={inventoryData} 
              columns={[
                { field: 'name', headerName: 'NAME', width: 300 },
                { field: 'stock', headerName: 'STOCK', width: 100 },
                { field: 'reorderLevel', headerName: 'REORDER', width: 100 },
              ]} 
            />
          </ResizableReportBox>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <>
      {renderContent()}
      {editDialogOpen && currentReport && (
        <ReportEditor
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          report={currentReport}
        />
      )}
    </>
  );
};

export default Reports;
