import React, { useState, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';

const AdvancedProductImporter = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [resultsDialogOpen, setResultsDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        setSelectedFile(file);
        setError('');
      } else {
        setError('Please select a CSV file');
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile) {
      setError('Please select a CSV file to import');
      return;
    }

    try {
      setImporting(true);
      setError('');
      
      const result = await productService.importAdvancedProducts(selectedFile);
      setImportResults(result);
      setResultsDialogOpen(true);
      
      // Clear the selected file after successful import
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Error importing products:', error);
      setError(error.response?.data?.error || 'Failed to import products');
    } finally {
      setImporting(false);
    }
  };

  const handleCloseResults = () => {
    setResultsDialogOpen(false);
    setImportResults(null);
  };

  const handleGoBack = () => {
    navigate('/products');
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={handleGoBack} sx={{ mr: 2 }}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            Advanced Product Importer
          </Typography>
        </Box>

        {/* Instructions */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Shopfront features an advanced CSV importer for products that use dynamic columns to set multiple prices, barcodes and inventory levels.
          </Typography>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <strong>Note:</strong> We also have a basic CSV importer which is simpler to use, but only allows you to have one price and barcode. If your use-case supports it, we would recommend using the basic importer instead.
          </Alert>

          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>Note:</strong> Whilst this is more powerful than the basic product importer, it doesn't allow for the addition of every possible field. If you need to import anything that isn't available on this importer, you can use our developer API.
          </Alert>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your CSV file can contain the following columns:
          </Typography>
          
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Required Columns</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Required</strong></TableCell>
                      <TableCell><strong>Default Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>name</TableCell>
                      <TableCell>The name of the product</TableCell>
                      <TableCell><Chip label="Yes" color="error" size="small" /></TableCell>
                      <TableCell>N/A</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Optional Basic Columns</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Required</strong></TableCell>
                      <TableCell><strong>Default Value</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>category</TableCell>
                      <TableCell>The UUID of the category this product belongs to</TableCell>
                      <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                      <TableCell>No Category</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>case_quantity</TableCell>
                      <TableCell>The case quantity of the product</TableCell>
                      <TableCell><Chip label="If prices are specified" color="warning" size="small" /></TableCell>
                      <TableCell>1</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>supplier</TableCell>
                      <TableCell>The UUID of the supplier for this product</TableCell>
                      <TableCell><Chip label="If supplier_code is specified" color="warning" size="small" /></TableCell>
                      <TableCell>No Supplier</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>supplier_code</TableCell>
                      <TableCell>The supplier code for this product</TableCell>
                      <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                      <TableCell>None</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>tax_rate</TableCell>
                      <TableCell>The UUID of the tax rate for this product</TableCell>
                      <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                      <TableCell>No tax</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Dynamic Columns (Multiple Prices)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 2 }}>
                For multiple prices, use incrementing numbers starting at 1:
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column Pattern</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Example</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>price_inc_(n)</TableCell>
                      <TableCell>The nth price's price (inclusive of tax)</TableCell>
                      <TableCell>price_inc_1, price_inc_2, price_inc_3</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>price_qty_(n)</TableCell>
                      <TableCell>The nth price's quantity</TableCell>
                      <TableCell>price_qty_1, price_qty_2, price_qty_3</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="body2" sx={{ mt: 2 }}>
                <strong>Example:</strong> price_inc_1, price_qty_1, price_inc_2, price_qty_2, price_inc_3, price_qty_3
              </Typography>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Dynamic Columns (Multiple Barcodes)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column Pattern</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Example</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>barcode_code_(n)</TableCell>
                      <TableCell>The nth barcode's code</TableCell>
                      <TableCell>barcode_code_1, barcode_code_2</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>barcode_qty_(n)</TableCell>
                      <TableCell>The nth barcode's quantity</TableCell>
                      <TableCell>barcode_qty_1, barcode_qty_2</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">Dynamic Columns (Outlet-Specific Inventory)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Replace (outlet) with the UUID of the Outlet:
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell><strong>Column Pattern</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Example</strong></TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>inv_(outlet)</TableCell>
                      <TableCell>The inventory level at the provided Outlet (in total items)</TableCell>
                      <TableCell>inv_12345-uuid-67890</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>inv_reorder_level_(outlet)</TableCell>
                      <TableCell>The inventory reorder point at the provided Outlet (in total items)</TableCell>
                      <TableCell>inv_reorder_level_12345-uuid-67890</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>inv_reorder_amount_(outlet)</TableCell>
                      <TableCell>The inventory reorder amount at the provided Outlet (in total items)</TableCell>
                      <TableCell>inv_reorder_amount_12345-uuid-67890</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>cost_last_(outlet)</TableCell>
                      <TableCell>The last case cost at the provided Outlet (inclusive of tax)</TableCell>
                      <TableCell>cost_last_12345-uuid-67890</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>cost_avg_(outlet)</TableCell>
                      <TableCell>The average case cost at the provided Outlet (inclusive of tax)</TableCell>
                      <TableCell>cost_avg_12345-uuid-67890</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>

          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Additional things to be aware of:</strong>
              <br />• Column order does not matter
              <br />• Columns are case sensitive
              <br />• All other columns present will be ignored
              <br />• Sell / Cost fields can include currency symbols (e.g., "$")
              <br />• Fields that have (outlet) or (n) in their name must not have brackets in the column name
              <br />• To find a UUID refer to How To Find a UUID
            </Typography>
          </Box>
        </Box>

        {/* File Upload Area */}
        <Box
          sx={{
            border: `2px dashed ${dragActive ? '#1976d2' : '#ccc'}`,
            borderRadius: 2,
            p: 4,
            textAlign: 'center',
            backgroundColor: dragActive ? '#f5f5f5' : 'transparent',
            cursor: 'pointer',
            transition: 'all 0.3s ease',
            '&:hover': {
              borderColor: '#1976d2',
              backgroundColor: '#f5f5f5',
            }
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          
          <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          
          <Typography variant="h6" sx={{ mb: 1 }}>
            {selectedFile ? selectedFile.name : 'Drop in a file or click to select a file'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary">
            CSV files only, up to 10MB
          </Typography>
        </Box>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={!selectedFile || importing}
            startIcon={importing ? null : <UploadIcon />}
          >
            {importing ? 'Importing...' : 'Import Products'}
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleGoBack}
          >
            Cancel
          </Button>
        </Box>
      </Paper>

      {/* Import Results Dialog */}
      <Dialog open={resultsDialogOpen} onClose={handleCloseResults} maxWidth="md" fullWidth>
        <DialogTitle>
          Import Results
          <IconButton
            onClick={handleCloseResults}
            sx={{ position: 'absolute', right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {importResults && (
            <Box>
              <Typography variant="body1" gutterBottom>
                {importResults.message}
              </Typography>
              
              <Box sx={{ display: 'flex', gap: 2, my: 2 }}>
                <Chip 
                  icon={<CheckCircleIcon />}
                  label={`Successful: ${importResults.results.successful}`} 
                  color="success" 
                />
                <Chip 
                  icon={<ErrorIcon />}
                  label={`Failed: ${importResults.results.failed}`} 
                  color="error" 
                />
                <Chip 
                  label={`Total: ${importResults.results.total}`} 
                  color="default" 
                />
              </Box>

              {importResults.results.errors && importResults.results.errors.length > 0 && (
                <Box>
                  <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
                    Errors:
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Row</TableCell>
                          <TableCell>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {importResults.results.errors.map((error, index) => (
                          <TableRow key={index}>
                            <TableCell>{error.row}</TableCell>
                            <TableCell>{error.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseResults}>Close</Button>
          <Button onClick={handleGoBack} variant="contained">
            View Products
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AdvancedProductImporter;
