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
  Divider
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  CloudUpload as UploadIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import productService from '../../services/productService';

const ImportProducts = () => {
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
      
      const result = await productService.importProducts(selectedFile);
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
            Import Products
          </Typography>
        </Box>

        {/* Instructions */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="body1" sx={{ mb: 2 }}>
            You can import new products via a CSV file. This does not merge products together and it does not allow multiple prices or barcodes to be set.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your CSV file should contain the following columns:
          </Typography>
          
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Column</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                  <TableCell><strong>Required</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>name</TableCell>
                  <TableCell>The name of the product</TableCell>
                  <TableCell><Chip label="Yes" color="error" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>cost</TableCell>
                  <TableCell>The cost of the product (including tax if applicable)</TableCell>
                  <TableCell><Chip label="Yes" color="error" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>sell_price</TableCell>
                  <TableCell>The retail sell price of the product (including tax if applicable)</TableCell>
                  <TableCell><Chip label="Yes" color="error" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>description</TableCell>
                  <TableCell>The description of the product</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>category_id</TableCell>
                  <TableCell>The UUID of the Category this product belongs to</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>brand_id</TableCell>
                  <TableCell>The UUID of the Brand this product belongs to</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>supplier_id</TableCell>
                  <TableCell>The UUID of the Supplier this product belongs to</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>case_quantity</TableCell>
                  <TableCell>The amount of items that come in a case</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>barcode</TableCell>
                  <TableCell>The barcode of the product</TableCell>
                  <TableCell><Chip label="No" color="default" size="small" /></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Typography variant="body2" color="text.secondary">
            <strong>Notes:</strong>
            <br />• Column order does not matter
            <br />• Columns are case sensitive
            <br />• Sell price can include currency symbols (e.g., "$" and "€")
            <br />• All other columns present will be ignored
          </Typography>
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

export default ImportProducts;
