import React, { useState, useRef } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardMedia,
  IconButton,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Grid,
  Chip,
  Tooltip
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  Add as AddIcon,
  Edit as EditIcon
} from '@mui/icons-material';
import MediaDialog from './MediaDialog';
import { useAppDialogs } from './AppDialogProvider';

const ImageUpload = ({ 
  productId, 
  images = [], 
  onImageUpload, 
  onImageDelete, 
  onSetMainImage,
  disabled = false,
  maxImages = 10 
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm } = useAppDialogs();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [previewDialog, setPreviewDialog] = useState({ open: false, image: null });
  const [editDialog, setEditDialog] = useState({ open: false, image: null, altText: '' });
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleImageUpload = async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }

    // Check if we've reached the maximum number of images
    if (images.length >= maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    try {
      setUploading(true);
      setError('');
      
      // For new products, handle locally first
      if (!productId || productId === 'new') {
        // Create a local preview and store the file for later upload
        const reader = new FileReader();
        reader.onload = (e) => {
          const tempImage = {
            id: `temp-${Date.now()}`,
            imageUrl: e.target.result,
            isMain: images.length === 0, // First image becomes main
            altText: '',
            sortOrder: images.length,
            file: file // Store the file for later upload
          };
          
          // Call the parent component's handler with the temp image
          if (onImageUpload) {
            onImageUpload('new', tempImage);
          }
        };
        reader.readAsDataURL(file);
        
        setSuccess('Image added (will be uploaded when product is saved)');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        // For existing products, upload immediately
        const result = await onImageUpload(productId, file);
        setSuccess('Image uploaded successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleImageDelete = async (imageId) => {
    if (await confirm('Delete this image?', { title: 'Delete image', confirmText: 'Delete image' })) {
      try {
        await onImageDelete(productId, imageId);
        setSuccess('Image deleted successfully');
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        setError(error.response?.data?.error || 'Failed to delete image');
      }
    }
  };

  const handleSetMainImage = async (imageId) => {
    try {
      await onSetMainImage(productId, imageId);
      setSuccess('Main image updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to set main image');
    }
  };

  const handleEditImage = (image) => {
    setEditDialog({
      open: true,
      image,
      altText: image.altText || ''
    });
  };

  const handleSaveEdit = async () => {
    // This would require an update endpoint in the backend
    // For now, we'll just close the dialog
    setEditDialog({ open: false, image: null, altText: '' });
  };

  const openPreview = (image) => {
    setPreviewDialog({ open: true, image });
  };

  const closePreview = () => {
    setPreviewDialog({ open: false, image: null });
  };

  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return '';
    if (imageUrl.startsWith('http') || imageUrl.startsWith('data:')) {
      return imageUrl;
    }
    const protocol =
      typeof window !== 'undefined' ? window.location.protocol : 'http:';
    const hostname =
      typeof window !== 'undefined' ? window.location.hostname : '192.168.29.13';
    const baseUrl = `${protocol}//${hostname}:5000`;
    const separator = imageUrl.startsWith('/') ? '' : '/';
    return `${baseUrl}${separator}${imageUrl}`;
  };

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Upload Button */}
      <Box sx={{ mb: 2 }}>
        <Button
          variant="outlined"
          startIcon={uploading ? null : <CloudUploadIcon />}
          onClick={() => setMediaDialogOpen(true)}
          disabled={disabled || uploading || images.length >= maxImages}
          fullWidth
        >
          {uploading ? 'Uploading...' : 
           `Upload Image (${images.length}/${maxImages})`}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </Box>

      {/* Media Dialog */}
      <MediaDialog
        open={mediaDialogOpen}
        onClose={() => setMediaDialogOpen(false)}
        onSelect={async (imageUrl) => {
          try {
            setMediaDialogOpen(false);
                        if (!productId || productId === 'new') {
              const tempImage = {
                id: `temp-${Date.now()}`,
                imageUrl: imageUrl,
                isMain: images.length === 0, // First image becomes main
                altText: '',
                sortOrder: images.length,
                isFromMediaCenter: true // Flag to indicate it's from media center
              };
              
              // Call the parent component's handler with the temp image
              if (onImageUpload) {
                onImageUpload('new', tempImage);
              }
              
              setSuccess('Image added from media center (will be saved when product is saved)');
              setTimeout(() => setSuccess(''), 3000);
            } else {
              setUploading(true);
              try {
                // Fetch the image and convert to blob/file for upload
                const response = await fetch(imageUrl);
                const blob = await response.blob();
                const fileName = imageUrl.split('/').pop() || 'image.jpg';
                const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
                
                // Use the existing upload handler
                await handleImageUpload(file);
              } catch (error) {
                console.error('Error loading image from media center:', error);
                setError('Failed to load image from media center');
              } finally {
                setUploading(false);
              }
            }
          } catch (error) {
            console.error('Error handling media center selection:', error);
            setError('Failed to add image from media center');
          }
        }}
        accept="image/*"
      />

      {/* Images Grid */}
      {images.length > 0 && (
        <Grid container spacing={2}>
          {images.map((image, index) => (
            <Grid item xs={12} sm={6} md={4} key={image.id}>
              <Card sx={{ position: 'relative' }}>
                <CardMedia
                  component="img"
                  height="200"
                  image={getImageUrl(image.imageUrl)}
                  alt={image.altText || 'Product image'}
                  sx={{ cursor: 'pointer' }}
                  onClick={() => openPreview(image)}
                />
                <CardContent sx={{ p: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {image.isMain && (
                        <Chip
                          icon={<StarIcon />}
                          label="Main"
                          color="primary"
                          size="small"
                        />
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {index + 1}
                      </Typography>
                    </Box>
                    <Box>
                      <Tooltip title="Set as main image">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleSetMainImage(image.id)}
                            disabled={disabled || image.isMain}
                          >
                            {image.isMain ? <StarIcon color="primary" /> : <StarBorderIcon />}
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleEditImage(image)}
                            disabled={disabled}
                          >
                            <EditIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            onClick={() => handleImageDelete(image.id)}
                            disabled={disabled}
                            color="error"
                          >
                            <DeleteIcon />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* No Images Message */}
      {images.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CloudUploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body2" color="text.secondary">
            No images uploaded yet. Click the upload button to add product images.
          </Typography>
        </Box>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewDialog.open} onClose={closePreview} maxWidth="md" fullWidth>
        <DialogTitle>Image Preview</DialogTitle>
        <DialogContent>
          {previewDialog.image && (
            <Box sx={{ textAlign: 'center' }}>
              <img
                src={getImageUrl(previewDialog.image.imageUrl)}
                alt={previewDialog.image.altText || 'Product image'}
                style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
              />
              {previewDialog.image.altText && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  {previewDialog.image.altText}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePreview}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, image: null, altText: '' })}>
        <DialogTitle>Edit Image</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Alt Text"
            value={editDialog.altText}
            onChange={(e) => setEditDialog(prev => ({ ...prev, altText: e.target.value }))}
            margin="normal"
            multiline
            rows={3}
            placeholder="Describe this image for accessibility..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, image: null, altText: '' })}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ImageUpload;
