import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Paper,
  IconButton,
  Breadcrumbs,
  Link,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Image as ImageIcon,
  InsertDriveFile as FileIcon,
  Refresh as RefreshIcon,
  ArrowUpward as ArrowUpwardIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Search as SearchIcon,
  NavigateNext as NavigateNextIcon,
  KeyboardArrowRight as ChevronRightIcon,
  KeyboardArrowDown as ChevronDownIcon,
  Videocam as VideoIcon,
} from '@mui/icons-material';
import apiClient from '../../services/apiClient';

const MediaDialog = ({ open, onClose, onSelect, accept = 'image/*' }) => {
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringUpload, setIsHoveringUpload] = useState(false);
  const fileInputRef = useRef(null);

  const getBackendOrigin = () => {
    const configuredBaseUrl = apiClient?.defaults?.baseURL || '';
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/+api\/?$/, '').replace(/\/+$/, '');
    }

    if (typeof window !== 'undefined' && window.location) {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }

    return 'https://pos-system-backend-five.vercel.app';
  };

  const getMediaUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
      return url;
    }

    const cleanPath = String(url).replace(/^\/+/, '');
    return `${getBackendOrigin()}/${cleanPath}`;
  };

  const fetchFolders = async () => {
    try {
      const response = await apiClient.get('/media/folders');
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      if (error?.response?.status !== 403) setError('Failed to load folder structure');
    }
  };

  // Fetch files in current folder
  const fetchFiles = async (path = '') => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/media/files', {
        params: { folderPath: path }
      });
      setFiles([...response.data.folders, ...response.data.files]);
    } catch (error) {
      console.error('Error fetching files:', error);
      setError(error?.response?.status === 403
        ? 'You do not have permission to see the Media Centre'
        : 'Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFolders();
      fetchFiles();
      setCurrentPath('');
      setSelectedFile(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      fetchFiles(currentPath);
    }
  }, [currentPath, open]);

  const filteredFiles = files.filter(item => {
    const matchesSearch = !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (item.type === 'folder') return matchesSearch;
    
    if (accept === 'image/*') {
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      const hasImageExt = item.extension && imageExtensions.includes(item.extension.toLowerCase());
      return matchesSearch && hasImageExt;
    }
    
    if (accept === 'image/*,video/*' || !accept) {
      return matchesSearch;
    }
    
    return matchesSearch;
  });

  const handleFolderClick = (path) => {
    setCurrentPath(path);
    setSelectedFile(null);
  };

  const handleFileClick = (file) => {
    setSelectedFile(file);
  };

  const handleSelect = () => {
    if (selectedFile && onSelect && selectedFile.type !== 'folder') {
      const imageUrl = getMediaUrl(selectedFile.url);
      onSelect(imageUrl);
      onClose();
    }
  };

  const handleUpload = async (file) => {
    if (!file) return;

    // Check accept type
    if (accept === 'image/*' && !file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    if (accept === 'image/*,video/*' && !file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setError('Please select an image or video file');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      setLoading(true);
      const response = await apiClient.post(`/media/upload?folderPath=${encodeURIComponent(currentPath || '')}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setSuccess('File uploaded successfully');
      fetchFiles(currentPath);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    } finally {
      setLoading(false);
      setIsDragging(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = async (event) => {
    const file = event.target.files[0];
    await handleUpload(file);
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const file = droppedFiles[0];
      await handleUpload(file);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      setLoading(true);
      await apiClient.post('/media/folder', {
        folderName: newFolderName,
        folderPath: currentPath
      });
      setSuccess('Folder created successfully');
      fetchFolders();
      fetchFiles(currentPath);
      setFolderDialogOpen(false);
      setNewFolderName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError('Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const isImageFile = (item) => {
    if (!item.extension) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    return imageExtensions.includes(item.extension.toLowerCase());
  };

  const isVideoFile = (item) => {
    if (!item.extension) return false;
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'];
    return videoExtensions.includes(item.extension.toLowerCase());
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getBreadcrumbs = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', path: '' }];
    let current = '';
    parts.forEach(part => {
      current += '/' + part;
      breadcrumbs.push({ name: part, path: current });
    });
    return breadcrumbs;
  };

  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map((folder) => {
      const isExpanded = expandedFolders[folder.path] || false;
      const hasChildren = folder.children && folder.children.length > 0;

      return (
        <React.Fragment key={folder.path}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => {
                if (hasChildren) {
                  setExpandedFolders(prev => ({
                    ...prev,
                    [folder.path]: !prev[folder.path]
                  }));
                }
                handleFolderClick(folder.path);
              }}
              selected={currentPath === folder.path}
              sx={{ pl: level * 2 + 2 }}
            >
              <ListItemIcon>
                {isExpanded ? <FolderOpenIcon /> : <FolderIcon />}
              </ListItemIcon>
              <ListItemText primary={folder.name} />
              {hasChildren && (
                isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />
              )}
            </ListItemButton>
          </ListItem>
          {isExpanded && hasChildren && (
            <Box sx={{ pl: 2 }}>
              {renderFolderTree(folder.children, level + 1)}
            </Box>
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="xl" 
      fullWidth
      PaperProps={{
        sx: {
          position: 'relative',
        },
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
      }}
    >
      <DialogTitle>Select Media</DialogTitle>
      <DialogContent sx={{ p: 0, height: '70vh', position: 'relative' }}>
        <Box sx={{ display: 'flex', height: '100%', bgcolor: '#f5f5f5' }}>
          {/* Left Sidebar - Folder Navigation */}
          <Paper
            sx={{
              width: 300,
              minWidth: 300,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 0,
            }}
          >
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: '#1976d2' }}>
              <Button
                variant="contained"
                startIcon={<CreateNewFolderIcon />}
                fullWidth
                onClick={() => setFolderDialogOpen(true)}
                sx={{ 
                  bgcolor: 'white',
                  color: '#1976d2',
                  '&:hover': { 
                    bgcolor: '#f5f5f5',
                  },
                  fontWeight: 600,
                }}
              >
                + New Folder
              </Button>
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'white' }}>
              <List dense sx={{ py: 0, bgcolor: 'white' }}>
                {renderFolderTree(folders)}
              </List>
            </Box>
          </Paper>

          {/* Main Content Area */}
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Paper sx={{ p: 2, borderRadius: 0, borderBottom: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Media Library</Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadIcon />}
                    onClick={() => {
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                    onMouseEnter={() => setIsHoveringUpload(true)}
                    onMouseLeave={() => setIsHoveringUpload(false)}
                    sx={{ bgcolor: '#4caf50', '&:hover': { bgcolor: '#45a049' } }}
                  >
                    Upload
                  </Button>
                  <IconButton onClick={() => fetchFiles(currentPath)}>
                    <RefreshIcon />
                  </IconButton>
                </Box>
              </Box>

              {/* Breadcrumbs */}
              <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ mb: 2 }}>
                {getBreadcrumbs().map((crumb, index) => (
                  <Link
                    key={index}
                    component="button"
                    variant="body2"
                    onClick={() => handleFolderClick(crumb.path)}
                    sx={{
                      textDecoration: 'none',
                      color: index === getBreadcrumbs().length - 1 ? 'text.primary' : 'text.secondary',
                      '&:hover': { textDecoration: 'underline' },
                    }}
                  >
                    {crumb.name}
                  </Link>
                ))}
              </Breadcrumbs>

              {/* Search */}
              <TextField
                fullWidth
                size="small"
                placeholder="Search for file in current directory"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
              />
            </Paper>

            {/* File Grid */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2, bgcolor: '#f5f5f5' }}>
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

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container spacing={2}>
                  {currentPath && (
                    <Grid item xs={6} sm={4} md={3} lg={2.4}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 0,
                          textAlign: 'center',
                          cursor: 'pointer',
                          bgcolor: 'white',
                          border: '1px solid #e0e0e0',
                          borderRadius: 1,
                          overflow: 'hidden',
                          '&:hover': { 
                            boxShadow: 2,
                            borderColor: '#1976d2',
                          },
                        }}
                        onClick={() => {
                          const parentPath = currentPath.split('/').slice(0, -1).join('/');
                          handleFolderClick(parentPath);
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: 180,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                          }}
                        >
                          <ArrowUpwardIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                        </Box>
                        <Box sx={{ p: 1.5, minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              wordBreak: 'break-word',
                              textAlign: 'center',
                            }}
                          >
                            ..
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  )}
                  {filteredFiles.map((item) => (
                    <Grid item xs={6} sm={4} md={3} lg={2.4} key={item.path}>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 0,
                          textAlign: 'center',
                          cursor: 'pointer',
                          position: 'relative',
                          bgcolor: 'white',
                          border: selectedFile?.path === item.path ? '2px solid #1976d2' : '1px solid #e0e0e0',
                          borderRadius: 1,
                          overflow: 'hidden',
                          '&:hover': { 
                            boxShadow: 2,
                            borderColor: '#1976d2',
                          },
                        }}
                        onClick={() => {
                          if (item.type === 'folder') {
                            handleFolderClick(item.path);
                          } else {
                            handleFileClick(item);
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: '100%',
                            height: 180,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: '#f5f5f5',
                            position: 'relative',
                            overflow: 'hidden',
                          }}
                        >
                          {item.type === 'folder' ? (
                            <FolderIcon sx={{ fontSize: 64, color: '#1976d2' }} />
                          ) : item.url && isImageFile(item) ? (
                            <Box
                              component="img"
                              src={getMediaUrl(item.url)}
                              alt={item.name}
                              sx={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                              }}
                            />
                          ) : item.url && isVideoFile(item) ? (
                            <Box
                              sx={{
                                width: '100%',
                                height: '100%',
                                position: 'relative',
                                bgcolor: '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Box
                                component="video"
                                src={getMediaUrl(item.url)}
                                sx={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  opacity: 0.7,
                                }}
                                muted
                                onError={(e) => {
                                  e.target.style.display = 'none';
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  bgcolor: 'rgba(0, 0, 0, 0.6)',
                                  borderRadius: '50%',
                                  p: 1.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <VideoIcon sx={{ fontSize: 32, color: 'white' }} />
                              </Box>
                            </Box>
                          ) : (
                            <FileIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                          )}
                          {!item.type && !isImageFile(item) && !isVideoFile(item) && (
                            <Box
                              sx={{
                                position: 'absolute',
                                width: '100%',
                                height: '100%',
                                display: 'none',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <FileIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                            </Box>
                          )}
                        </Box>
                        <Box sx={{ p: 1.5, minHeight: 50, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontSize: '0.75rem',
                              wordBreak: 'break-word',
                              textAlign: 'center',
                              color: 'text.primary',
                              lineHeight: 1.3,
                            }}
                            title={item.name}
                          >
                            {item.name.length > 30 ? `${item.name.substring(0, 30)}...` : item.name}
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Box>

          {/* Right Sidebar - File Preview */}
          <Paper
            sx={{
              width: 300,
              minWidth: 300,
              height: '100%',
              p: 2,
              borderRadius: 0,
              bgcolor: '#fafafa',
            }}
          >
            {selectedFile ? (
              <Box>
                <Typography variant="h6" sx={{ mb: 2 }}>File Details</Typography>
                {selectedFile.url && isImageFile(selectedFile) && (
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <Box
                      component="img"
                      src={getMediaUrl(selectedFile.url)}
                      alt={selectedFile.name}
                      sx={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        objectFit: 'contain',
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                )}
                {selectedFile.url && isVideoFile(selectedFile) && (
                  <Box sx={{ mb: 2, textAlign: 'center' }}>
                    <Box
                      component="video"
                      src={getMediaUrl(selectedFile.url)}
                      controls
                      sx={{
                        maxWidth: '100%',
                        maxHeight: 200,
                        borderRadius: 1,
                      }}
                    />
                  </Box>
                )}
                <Typography variant="subtitle2" gutterBottom>
                  {selectedFile.name}
                </Typography>
                {selectedFile.size && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Size
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2 }}>
                      {formatFileSize(selectedFile.size)}
                    </Typography>
                  </>
                )}
                {selectedFile.path && (
                  <>
                    <Typography variant="subtitle2" gutterBottom>
                      Path
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 2, wordBreak: 'break-word', fontSize: '0.75rem' }}>
                      {selectedFile.path}
                    </Typography>
                  </>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <FileIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  Select a file
                </Typography>
              </Box>
            )}
          </Paper>
        </Box>

        {(isDragging || isHoveringUpload) && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 1300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              cursor: isDragging ? 'copy' : 'pointer',
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
              if (!isDragging) {
                setIsHoveringUpload(false);
                setTimeout(() => fileInputRef.current?.click(), 100);
              }
            }}
          >
            <Box
              sx={{
                bgcolor: 'white',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                maxWidth: 400,
                mx: 2,
              }}
            >
              <Box
                sx={{
                  width: 80,
                  height: 80,
                  mx: 'auto',
                  mb: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: '#f5f5f5',
                  borderRadius: 2,
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 48, color: '#666' }} />
              </Box>
              <Typography
                variant="h6"
                sx={{
                  mb: 1,
                  fontWeight: 600,
                  color: '#333',
                }}
              >
                Drag and drop your file here
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: '#666',
                }}
              >
                or click to browse your local computer for files
              </Typography>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={handleSelect} variant="contained" disabled={!selectedFile || selectedFile.type === 'folder'}>
          Select
        </Button>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>

      {/* Upload Input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept={accept}
        onChange={handleFileInputChange}
      />

      {/* Create Folder Dialog */}
      <Dialog open={folderDialogOpen} onClose={() => setFolderDialogOpen(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            variant="outlined"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFolderDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
};

export default MediaDialog;

