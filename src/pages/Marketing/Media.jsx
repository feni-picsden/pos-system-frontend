import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  IconButton,
  Dialog,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Select,
  MenuItem,
  SvgIcon,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  CloudUploadOutlined as CloudUploadIcon,
  FolderOutlined as FolderIcon,
  FolderOpenOutlined as FolderOpenIcon,
  ImageOutlined as ImageIcon,
  InsertDriveFileOutlined as FileIcon,
  VideoFileOutlined as VideoIcon,
  PictureAsPdfOutlined as PdfIcon,
  DeleteOutline as DeleteIcon,
  EditOutlined as EditIcon,
  SyncOutlined as RefreshIcon,
  DriveFolderUploadOutlined as UpDirIcon,
  CreateNewFolderOutlined as NewFolderIcon,
  AddOutlined as AddIcon,
  CloseOutlined as CloseIcon,
  ArrowDropDown,
  KeyboardArrowRight as ChevronRightIcon,
  KeyboardArrowDown as ChevronDownIcon,
  CheckBoxOutlineBlank as UncheckedIcon,
  CheckBox as CheckedIcon,
  StorageOutlined as StorageIcon,
  DescriptionOutlined as DescriptionIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import { formatDistanceToNowStrict } from 'date-fns';
import apiClient from '../../services/apiClient';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';

const SORT_OPTIONS = ['Created At', 'Last Modified', 'Name', 'File Type'];

const COMPARATORS = {
  'Created At': (a, b) => new Date(a.created || 0) - new Date(b.created || 0),
  'Last Modified': (a, b) => new Date(a.modified || 0) - new Date(b.modified || 0),
  Name: (a, b) => a.name.localeCompare(b.name),
  'File Type': (a, b) => (a.extension || '').localeCompare(b.extension || ''),
};

// Media files are served by the API host from /uploads (not /api), so the origin
// has to follow apiClient's baseURL — hardcoding a host breaks every environment
// but the one it names. Same derivation as Setup/Users.jsx and Common/MediaDialog.jsx.
const API_ORIGIN = (apiClient.defaults?.baseURL || '').replace(/\/+api\/?$/, '').replace(/\/+$/, '');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];

const isImageFile = (item) => IMAGE_EXTENSIONS.includes((item?.extension || '').toLowerCase());
const isVideoFile = (item) => VIDEO_EXTENSIONS.includes((item?.extension || '').toLowerCase());

// "Created 5 years ago" – empty string on a missing/garbage timestamp
// (formatDistanceToNowStrict throws a RangeError on an invalid date).
const relativeCreated = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : `Created ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
};

// Thin-line "fal fa-sort-amount-up" / "fal fa-sort-amount-down": the arrow flips
// with the sort direction so the current direction is always readable.
const SortAmountIcon = ({ up, ...props }) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      d={
        up
          ? 'M6 20V4.5M2.5 8L6 4.5 9.5 8M13 5.5h8M13 11.5h6M13 17.5h4'
          : 'M6 4v15.5M2.5 16L6 19.5 9.5 16M13 5.5h8M13 11.5h6M13 17.5h4'
      }
    />
  </SvgIcon>
);

/**
 * Shopfront ".question.show-frame" modal: a centred 289px card with a blue
 * circular question badge overhanging the top edge.
 * Declared at module scope so the input keeps focus between keystrokes.
 */
const QuestionDialog = ({ open, title, body, value, onChange, onCancel, onConfirm, confirmText }) => (
  <Dialog
    open={open}
    onClose={onCancel}
    transitionDuration={0}
    PaperProps={{
      sx: {
        width: 289,
        maxWidth: '92vw',
        borderRadius: 0,
        boxShadow: '0 0 30px rgba(0,0,0,0.25)',
        overflow: 'visible',
        mt: '48px',
      },
    }}
  >
    <Box
      sx={{
        position: 'absolute',
        top: -48,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 96,
        height: 96,
        borderRadius: '50%',
        bgcolor: '#1c86f2',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <HelpIcon sx={{ fontSize: 56, color: '#f8f8f8' }} />
    </Box>
    <Box sx={{ pt: '60px', px: 2, pb: 2, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439', mb: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: 14, color: '#676b72', mb: 2 }}>{body}</Typography>
      <Box
        component="input"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onConfirm();
        }}
        sx={{
          width: 257,
          maxWidth: '100%',
          height: 53,
          border: '1px solid #000000',
          borderRadius: 0,
          fontSize: 16,
          fontFamily: 'inherit',
          px: 1.5,
          boxSizing: 'border-box',
          outline: 'none',
        }}
      />
      {/* ponytail: Create/Rename stay enabled on an empty field — matches the reference */}
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 2 }}>
        <Button
          onClick={onCancel}
          sx={{
            width: 121,
            height: 48,
            borderRadius: 0,
            bgcolor: '#f8f8f8',
            color: '#676b72',
            border: '1px solid #676b72',
            textTransform: 'none',
            fontSize: 16,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#f8f8f8', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          sx={{
            width: 121,
            height: 48,
            borderRadius: 0,
            bgcolor: '#32b643',
            color: '#f8f8f8',
            textTransform: 'none',
            fontSize: 16,
            boxShadow: 'none',
            '&:hover': { bgcolor: '#32b643', boxShadow: 'none' },
          }}
        >
          {confirmText}
        </Button>
      </Box>
    </Box>
  </Dialog>
);

const Media = () => {
  const theme = useTheme();
  const isTabletOrBelow = useMediaQuery(theme.breakpoints.down('md'));

  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Created At');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [originalExtension, setOriginalExtension] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const fileInputRef = useRef(null);

  // Fetch folder structure
  const fetchFolders = async () => {
    try {
      const response = await apiClient.get('/media/folders');
      setFolders(response.data.folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      setError('Failed to load folder structure');
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
      setError('Failed to load files');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath]);

  // Navigate into a directory
  const handleFolderClick = (folderPath) => {
    setCurrentPath(folderPath);
    setSelectedItems([]);
  };

  // Selection – single click selects any tile, the checkbox toggles multi-select
  const isSelected = (item) => selectedItems.some((s) => s.path === item.path);
  const selectOnly = (item) => setSelectedItems([item]);
  const toggleSelect = (item) =>
    setSelectedItems((prev) =>
      prev.some((s) => s.path === item.path)
        ? prev.filter((s) => s.path !== item.path)
        : [...prev, item]
    );

  // Handle upload – the backend accepts one file per request, so a multi-file
  // drop / picker selection is uploaded sequentially against the same endpoint.
  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;

    setLoading(true);
    setError('');
    try {
      for (const file of list) {
        const formData = new FormData();
        formData.append('file', file);
        // Note: folderPath is sent as query parameter since multer's destination callback
        // doesn't have access to req.body for multipart/form-data
        await apiClient.post(`/media/upload?folderPath=${encodeURIComponent(currentPath)}`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
      }
      setSuccess(list.length > 1 ? `${list.length} files uploaded successfully` : 'File uploaded successfully');
      fetchFiles(currentPath);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error uploading file:', error);
      setError(error.response?.data?.error || 'Failed to upload file');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    uploadFiles(event.dataTransfer?.files);
  };

  // Handle create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    setLoading(true);
    setError('');
    try {
      await apiClient.post('/media/folder', {
        folderPath: currentPath,
        folderName: newFolderName
      });
      setSuccess('Folder created successfully');
      fetchFolders();
      fetchFiles(currentPath);
      setFolderDialogOpen(false);
      setNewFolderName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError(error.response?.data?.error || 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  // Handle delete – opens the shared confirmation dialog (single or bulk)
  const handleDelete = (items) => {
    if (!items.length) return;
    setItemsToDelete(items);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    const items = itemsToDelete;
    if (!items.length) {
      setDeleteDialogOpen(false);
      return;
    }

    setLoading(true);
    setError('');
    try {
      for (const item of items) {
        const type = item.type === 'folder' ? 'folder' : 'file';
        await apiClient.delete(`/media/${type}`, {
          params: { path: item.path }
        });
      }
      setSuccess(
        items.length > 1
          ? `${items.length} items deleted successfully`
          : `${items[0].type === 'folder' ? 'Folder' : 'File'} deleted successfully`
      );
      if (items.some((i) => i.type === 'folder')) {
        fetchFolders();
      }
      fetchFiles(currentPath);
      setSelectedItems((prev) => prev.filter((s) => !items.some((i) => i.path === s.path)));
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error deleting:', error);
      setError(error.response?.data?.error || 'Failed to delete');
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemsToDelete([]);
    }
  };

  // Helper to get file extension
  const getFileExtension = (filename) => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  };

  const openRename = (item) => {
    if (!item) return;
    setRenameTarget(item);
    setRenameValue(item.name);
    setOriginalExtension(item.type === 'folder' ? '' : getFileExtension(item.name));
    setRenameDialogOpen(true);
  };

  // Handle rename
  const handleRename = async () => {
    if (!renameValue.trim() || !renameTarget) return;
    const oldPath = renameTarget.path;

    setLoading(true);
    setError('');
    try {
      // Preserve extension if user didn't include it
      let finalName = renameValue.trim();
      const hasExtension = getFileExtension(finalName) !== '';

      // If no extension in new name and we have an original extension, add it
      if (!hasExtension && originalExtension) {
        finalName = finalName + originalExtension;
      }

      const response = await apiClient.put('/media/rename', {
        oldPath,
        newName: finalName
      });

      const { newPath, newName, newUrl, size, extension, type } = response.data;

      setSuccess('Renamed successfully');
      fetchFolders();
      fetchFiles(currentPath);

      // Keep the renamed item selected
      setSelectedItems((prev) =>
        prev.map((s) =>
          s.path === oldPath
            ? {
                ...s,
                name: newName,
                path: newPath,
                // getMediaUrl normalises the leading slash / base URL join
                url: newUrl || `/uploads/media/${newPath}`,
                size: size ?? s.size,
                extension: extension || s.extension,
                type: type || s.type,
              }
            : s
        )
      );

      setRenameDialogOpen(false);
      setRenameValue('');
      setRenameTarget(null);
      setOriginalExtension('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error renaming:', error);
      setError(error.response?.data?.error || 'Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  const toggleFolder = (folderPath) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: !prev[folderPath],
    }));
  };

  // Reference `.folder-header`: 2rem tall, 1.25rem text, 2rem line-height.
  // Size lives on the row so the label just inherits it.
  const treeRowSx = (current) => ({
    height: 32,
    minHeight: 32,
    py: 0,
    px: 1,
    fontSize: '1.25rem',
    lineHeight: '2rem',
    transition: 'none',
    color: current ? '#1c86f2' : 'rgb(0,0,0)',
    '& .MuiListItemText-primary': { fontSize: 'inherit', lineHeight: 'inherit' },
    '& .MuiSvgIcon-root': { color: current ? '#1c86f2' : '#676b72' },
    // Row hover lightens the row; the current folder gets a stronger fill
    '&&:hover': {
      bgcolor: current ? '#d9d9d9' : '#e6e6e6',
      color: current ? 'rgb(12,109,207)' : '#313439',
    },
    // ...and the chevron / label recolour on their own when hovered directly
    '& .folder-close-toggle:hover .MuiSvgIcon-root': {
      color: current ? 'rgb(12,109,207)' : '#1c86f2',
    },
    '& .folder-heading:hover': { color: current ? 'rgb(12,109,207)' : '#1c86f2' },
  });

  // Render folder tree
  const renderFolderTree = (folderList, level = 0) => {
    return folderList.map((folder) => {
      const isExpanded = expandedFolders[folder.path];
      const isCurrent = currentPath === folder.path;
      const hasChildren = folder.children && folder.children.length > 0;

      return (
        <React.Fragment key={folder.path}>
          <ListItem disablePadding sx={{ pl: level * 2 }}>
            <ListItemButton
              onClick={(e) => {
                e.stopPropagation();
                // Single click navigates AND auto-expands (never collapses)
                if (hasChildren) {
                  setExpandedFolders((prev) => ({ ...prev, [folder.path]: true }));
                }
                handleFolderClick(folder.path);
              }}
              sx={treeRowSx(isCurrent)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                {/* Expand/Collapse Icon */}
                {hasChildren ? (
                  <Box
                    className="folder-close-toggle"
                    sx={{
                      width: 20,
                      height: 20,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 0.5,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(folder.path);
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDownIcon sx={{ fontSize: 18 }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 18 }} />
                    )}
                  </Box>
                ) : (
                  <Box sx={{ width: 20, mr: 0.5 }} />
                )}
                {/* Folder Icon */}
                <ListItemIcon sx={{ minWidth: 28 }}>
                  {isExpanded && hasChildren ? (
                    <FolderOpenIcon sx={{ fontSize: 20 }} />
                  ) : (
                    <FolderIcon sx={{ fontSize: 20 }} />
                  )}
                </ListItemIcon>
                {/* Folder Name */}
                <ListItemText className="folder-heading" primary={folder.name} />
              </Box>
            </ListItemButton>
          </ListItem>
          {isExpanded && hasChildren && (
            <Box>{renderFolderTree(folder.children, level + 1)}</Box>
          )}
        </React.Fragment>
      );
    });
  };

  const getBreadcrumbs = () => {
    const breadcrumbs = [{ name: 'Home', path: '' }];
    if (!currentPath) return breadcrumbs;
    let pathSoFar = '';
    currentPath.split('/').filter(Boolean).forEach((part) => {
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      breadcrumbs.push({ name: part, path: pathSoFar });
    });
    return breadcrumbs;
  };

  // Search + sort. Folder tiles stay pinned to the top in both directions.
  const visibleItems = useMemo(() => {
    const matches = files.filter((item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const dirs = matches.filter((i) => i.type === 'folder');
    const docs = matches.filter((i) => i.type !== 'folder');
    const cmp = COMPARATORS[sortBy] || COMPARATORS['Created At'];
    docs.sort((a, b) => (sortAsc ? cmp(a, b) : cmp(b, a)));
    return [...dirs, ...docs];
  }, [files, searchQuery, sortBy, sortAsc]);

  // File-type glyph used by the thumbnail overlay
  const typeGlyph = (item, fontSize) => {
    const sx = { fontSize, color: '#f8f8f8' };
    if (isImageFile(item)) return <ImageIcon sx={sx} />;
    if (isVideoFile(item)) return <VideoIcon sx={sx} />;
    if ((item.extension || '').toLowerCase() === '.pdf') return <PdfIcon sx={sx} />;
    return <FileIcon sx={sx} />;
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Helper function to construct proper media URL
  const getMediaUrl = (url) => {
    if (!url) return '';
    if (/^(https?:|data:|blob:)/i.test(url)) return url;
    // Strip the leading slash so the join never doubles up
    return `${API_ORIGIN}/${String(url).replace(/^\/+/, '')}`;
  };

  const tileSx = (selected) => ({
    width: 227,
    height: 200,
    bgcolor: selected ? '#bdbdbd' : '#f8f8f8',
    borderRadius: 0,
    boxShadow: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 200ms ease-in-out',
    '&:hover': { bgcolor: '#bdbdbd' },
  });

  const captionSx = {
    fontSize: 16,
    color: '#313439',
    maxWidth: 207,
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  };

  // 36x34 flat chip button used by the refresh + sort-direction controls
  const chipBtnSx = {
    width: 36,
    height: 34,
    borderRadius: '6px',
    bgcolor: '#f8f8f8',
    color: '#313439',
    p: '8px',
    transition: 'background 0.2s ease',
    '&&:hover': { bgcolor: '#d9d9d9' },
  };

  const railBtnSx = (disabled) => ({
    height: 35,
    borderRadius: '6px',
    bgcolor: '#f8f8f8',
    color: '#676b72',
    fontSize: 16,
    fontWeight: 400,
    textTransform: 'none',
    boxShadow: 'none',
    gap: 0.75,
    px: 1.5,
    transition: 'background 200ms ease, color 200ms ease',
    '&:hover': {
      bgcolor: disabled ? '#f8f8f8' : '#d9d9d9',
      color: disabled ? '#bdbdbd' : '#313439',
      boxShadow: 'none',
    },
    '&.Mui-disabled': { bgcolor: '#f8f8f8', color: '#bdbdbd' },
  });

  const selectedFile = selectedItems.length === 1 ? selectedItems[0] : null;
  const canRename = selectedItems.length === 1;
  const canDelete = selectedItems.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        height: { xs: 'auto', md: 'calc(100vh - 50px)' },
        bgcolor: '#f8f8f8',
      }}
    >
      {/* Left Sidebar – Upload / New Folder / Folder tree */}
      <Paper
        sx={{
          width: { xs: '100%', md: 383 },
          minWidth: { xs: 'auto', md: 383 },
          height: { xs: 'auto', md: '100%' },
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
          boxShadow: 'none',
          mb: { xs: 2, md: 0 },
        }}
      >
        <Button
          fullWidth
          startIcon={<CloudUploadIcon sx={{ fontSize: 28 }} />}
          onClick={() => fileInputRef.current?.click()}
          sx={{
            height: 64,
            borderRadius: 0,
            bgcolor: '#32b643',
            color: '#f8f8f8',
            fontSize: 24,
            fontWeight: 400,
            textTransform: 'none',
            boxShadow: 'none',
            borderBottom: '1px solid currentColor',
            transition: 'background 0.2s ease, color 0.2s ease',
            // Reference inverts on hover
            '&&:hover': { bgcolor: '#f8f8f8', color: '#32b643', boxShadow: 'none' },
          }}
        >
          Upload
        </Button>
        <Button
          fullWidth
          startIcon={<AddIcon />}
          onClick={() => setFolderDialogOpen(true)}
          sx={{
            height: 48,
            borderRadius: 0,
            bgcolor: '#1c86f2',
            color: '#f8f8f8',
            fontSize: 16,
            fontWeight: 400,
            textTransform: 'none',
            boxShadow: 'none',
            borderBottom: '1px solid currentColor',
            transition: 'background 0.2s ease, color 0.2s ease',
            '&&:hover': { bgcolor: '#f8f8f8', color: '#1c86f2', boxShadow: 'none' },
          }}
        >
          New Folder
        </Button>
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'white' }}>
          <List dense sx={{ py: 0, bgcolor: 'white' }}>
            {/* Home root node – always the first row, returns to the root directory */}
            <ListItem disablePadding>
              <ListItemButton onClick={() => handleFolderClick('')} sx={treeRowSx(currentPath === '')}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Box className="folder-close-toggle" sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5 }}>
                    <ChevronDownIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <FolderOpenIcon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText className="folder-heading" primary="Home" />
                </Box>
              </ListItemButton>
            </ListItem>
            {renderFolderTree(folders, 1)}
          </List>
        </Box>
      </Paper>

      {/* Main Content Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: '#ffffff',
        }}
      >
        {/* Breadcrumb + toolbar */}
        <Box sx={{ p: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              flexDirection: { xs: 'column', sm: 'row' },
              gap: 1.5,
            }}
          >
            {/* Breadcrumbs – "/ Home / Product Images" */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', fontSize: 14, color: '#313439' }}>
              {getBreadcrumbs().map((crumb) => (
                <React.Fragment key={crumb.path || 'home'}>
                  <Box
                    component="span"
                    sx={{ color: '#313439', fontSize: 14, fontWeight: 700, m: '0 2px', p: '4px 0' }}
                  >
                    /
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => handleFolderClick(crumb.path)}
                    sx={{
                      border: 0,
                      bgcolor: 'transparent',
                      color: '#313439',
                      fontSize: 14,
                      fontFamily: 'inherit',
                      display: 'inline-block',
                      height: 24,
                      lineHeight: '16px',
                      p: '4px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      textDecoration: 'none',
                      transition: 'background 200ms ease-in-out',
                      '&&:hover': { bgcolor: '#d9d9d9' },
                    }}
                  >
                    {crumb.name}
                  </Box>
                </React.Fragment>
              ))}
            </Box>

            {/* File viewer actions: refresh | sort direction | sort by */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton disableRipple onClick={() => fetchFiles(currentPath)} sx={chipBtnSx} title="Refresh">
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
              <IconButton
                disableRipple
                onClick={() => setSortAsc((prev) => !prev)}
                sx={chipBtnSx}
                title={sortAsc ? 'Sort ascending' : 'Sort descending'}
              >
                <SortAmountIcon up={sortAsc} sx={{ fontSize: 16 }} />
              </IconButton>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                IconComponent={ArrowDropDown}
                sx={{
                  width: 150,
                  height: 32,
                  bgcolor: '#f8f8f8',
                  borderRadius: '6px',
                  fontSize: 14,
                  p: 0,
                  transition: 'background 0.2s, color 0.2s',
                  '& .MuiSelect-select': {
                    padding: '0 8px 0 0 !important',
                    minHeight: 'unset',
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                  },
                  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                  '& .MuiSelect-icon': { color: '#676b72', transition: 'color 0.2s' },
                  '&:hover': { bgcolor: '#d9d9d9' },
                  '&:hover .MuiSelect-icon': { color: '#313439' },
                }}
                MenuProps={{
                  transitionDuration: 0,
                  PaperProps: {
                    elevation: 0,
                    sx: {
                      width: 148,
                      mt: '11px',
                      borderRadius: 0,
                      boxShadow: 'none',
                      '& .MuiMenuItem-root': { minHeight: 56, px: 2, fontSize: 16, color: '#313439' },
                      '& .MuiMenuItem-root.Mui-selected': { color: '#38bdf8', bgcolor: 'transparent' },
                      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: 'rgba(0,0,0,0.04)' },
                    },
                  },
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>{option}</MenuItem>
                ))}
              </Select>
            </Box>
          </Box>

          {/* Search pill with a clear button */}
          <TextField
            fullWidth
            variant="standard"
            placeholder="Search for file in current directory"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              disableUnderline: true,
              endAdornment: searchQuery ? (
                <IconButton
                  onClick={() => setSearchQuery('')}
                  sx={{ width: 30, height: 24, p: 0, borderRadius: '4px', color: '#676b72' }}
                  title="Clear"
                >
                  <CloseIcon sx={{ fontSize: 18 }} />
                </IconButton>
              ) : null,
            }}
            sx={{
              mt: 2,
              '& .MuiInputBase-root': {
                height: 48,
                bgcolor: '#ededed',
                borderRadius: '24px',
                fontSize: 16,
                padding: '0 16px 0 24px',
              },
              '& .MuiInputBase-input': { p: 0 },
            }}
          />
        </Box>

        {/* File Grid – also a drop target for uploads */}
        <Box
          sx={{ flex: 1, overflow: 'auto', p: 2 }}
          onDragEnter={(e) => e.preventDefault()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
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
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, 227px)',
                justifyContent: 'flex-start',
                gap: 0,
              }}
            >
              {/* ".." up-directory tile – always the first tile, even at root */}
              <Paper
                sx={tileSx(false)}
                onDoubleClick={() => handleFolderClick(currentPath.split('/').filter(Boolean).slice(0, -1).join('/'))}
              >
                <Box sx={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UpDirIcon sx={{ fontSize: 92, color: '#313439' }} />
                </Box>
                <Typography sx={captionSx}>...</Typography>
              </Paper>

              {/* "New Folder" tile – second tile of every directory */}
              <Paper sx={tileSx(false)} onDoubleClick={() => setFolderDialogOpen(true)}>
                <Box sx={{ width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <NewFolderIcon sx={{ fontSize: 92, color: '#1c86f2' }} />
                </Box>
                <Typography sx={{ ...captionSx, color: '#1c86f2' }}>New Folder</Typography>
              </Paper>

              {visibleItems.map((item) => {
                const selected = isSelected(item);
                return (
                  <Paper
                    key={item.path}
                    sx={tileSx(selected)}
                    onClick={() => selectOnly(item)}
                    onDoubleClick={() => {
                      if (item.type === 'folder') handleFolderClick(item.path);
                    }}
                  >
                    <Box sx={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {item.type === 'folder' ? (
                        <FolderIcon sx={{ fontSize: 92, color: '#313439' }} />
                      ) : (
                        <>
                          {item.url && isImageFile(item) && (
                            <Box
                              component="img"
                              src={getMediaUrl(item.url)}
                              alt={item.name}
                              sx={{ width: 140, height: 140, objectFit: 'cover' }}
                              onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            />
                          )}
                          {item.url && isVideoFile(item) && (
                            <Box
                              component="video"
                              src={getMediaUrl(item.url)}
                              preload="metadata"
                              sx={{ width: 140, height: 140, objectFit: 'cover' }}
                              onError={(e) => { e.target.style.visibility = 'hidden'; }}
                            />
                          )}
                          {/* Dark file-type overlay – fades out when the tile is selected */}
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              bgcolor: '#313439',
                              opacity: selected ? 0 : 0.3,
                              transition: 'opacity 200ms ease-in-out',
                              pointerEvents: 'none',
                            }}
                          >
                            {typeGlyph(item, 96)}
                          </Box>
                        </>
                      )}
                      {/* Multi-select checkbox – always visible */}
                      <Box
                        component="button"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(item);
                        }}
                        onDoubleClick={(e) => e.stopPropagation()}
                        sx={{
                          position: 'absolute',
                          top: 8,
                          left: 8,
                          width: 25,
                          height: 24,
                          p: 0,
                          border: 0,
                          borderRadius: '4px',
                          bgcolor: 'rgba(0,0,0,0.6)',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        {selected
                          ? <CheckedIcon sx={{ fontSize: 16, color: '#ffffff' }} />
                          : <UncheckedIcon sx={{ fontSize: 16, color: '#ffffff' }} />}
                      </Box>
                    </Box>
                    <Typography sx={captionSx}>{item.name}</Typography>
                  </Paper>
                );
              })}
            </Box>
          )}
        </Box>
      </Box>

      {/* Right rail – actions + details. Hidden on tablets and below to keep the layout clean */}
      {!isTabletOrBelow && (
        <Box
          sx={{
            width: 383,
            minWidth: 383,
            height: '100%',
            p: 2,
            overflow: 'auto',
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            <Button
              disabled={!canRename}
              onClick={() => openRename(selectedFile)}
              startIcon={<EditIcon sx={{ color: canRename ? '#32b643' : '#bdbdbd' }} />}
              sx={{ ...railBtnSx(!canRename), width: 118 }}
            >
              Rename
            </Button>
            <Button
              disabled={!canDelete}
              onClick={() => handleDelete(selectedItems)}
              startIcon={<DeleteIcon sx={{ color: canDelete ? '#e33430' : '#bdbdbd' }} />}
              sx={{ ...railBtnSx(!canDelete), width: 105 }}
            >
              Delete
            </Button>
          </Box>

          {selectedItems.length > 1 ? (
            <Box component="ul" sx={{ listStyleType: 'disc', pl: 3, m: 0 }}>
              {selectedItems.map((item) => (
                <Box component="li" key={item.path} sx={{ fontSize: 16, color: '#313439', mb: 0.5 }}>
                  {item.name}
                </Box>
              ))}
            </Box>
          ) : selectedFile ? (
            <Box>
              {selectedFile.url && (
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  {isImageFile(selectedFile) ? (
                    <Box
                      component="img"
                      src={getMediaUrl(selectedFile.url)}
                      alt={selectedFile.name}
                      sx={{ maxWidth: '100%', maxHeight: 300, objectFit: 'fill', borderRadius: 0 }}
                    />
                  ) : isVideoFile(selectedFile) ? (
                    <Box
                      component="video"
                      src={getMediaUrl(selectedFile.url)}
                      controls
                      sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 0 }}
                    >
                      Your browser does not support the video tag.
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
                      <FileIcon sx={{ fontSize: 96, color: '#bdbdbd' }} />
                    </Box>
                  )}
                </Box>
              )}
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000000', wordBreak: 'break-word' }}>
                {selectedFile.name}
              </Typography>
              {relativeCreated(selectedFile.created) && (
                <Typography sx={{ fontSize: 12, color: '#676b72', mt: 0.5 }}>
                  {relativeCreated(selectedFile.created)}
                </Typography>
              )}
              {selectedFile.size != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <StorageIcon sx={{ fontSize: 18, color: '#676b72' }} />
                  <Typography sx={{ fontSize: 14, color: '#313439' }}>
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
              )}
              {selectedFile.extension && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                  <DescriptionIcon sx={{ fontSize: 18, color: '#676b72' }} />
                  <Typography sx={{ fontSize: 14, color: '#313439' }}>
                    {selectedFile.extension.replace('.', '')}
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', mt: 4 }}>
              <FileIcon sx={{ fontSize: 96, color: '#bdbdbd', mb: 2 }} />
              <Typography sx={{ fontSize: 18, color: '#bdbdbd' }}>Select a file</Typography>
            </Box>
          )}
        </Box>
      )}

      {/* Hidden file input driven by the Upload button */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        accept="image/*,video/*,.pdf"
        onChange={(e) => uploadFiles(e.target.files)}
      />

      {/* Create Directory Dialog */}
      <QuestionDialog
        open={folderDialogOpen}
        title="Create New Directory"
        body="What should the directory be called?"
        value={newFolderName}
        onChange={setNewFolderName}
        onCancel={() => {
          setFolderDialogOpen(false);
          setNewFolderName('');
        }}
        onConfirm={handleCreateFolder}
        confirmText="Create"
      />

      {/* Rename Dialog */}
      <QuestionDialog
        open={renameDialogOpen}
        title={renameTarget?.type === 'folder' ? 'Rename directory' : 'Rename file'}
        body={`What should the ${renameTarget?.type === 'folder' ? 'directory' : 'file'}, ${renameTarget?.name || ''}, be renamed to?`}
        value={renameValue}
        onChange={setRenameValue}
        onCancel={() => {
          setRenameDialogOpen(false);
          setRenameValue('');
          setRenameTarget(null);
          setOriginalExtension('');
        }}
        onConfirm={handleRename}
        confirmText="Rename"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title={
          itemsToDelete.length > 1
            ? 'Delete Items'
            : itemsToDelete[0]?.type === 'folder'
              ? 'Delete Folder'
              : 'Delete File'
        }
        message={
          itemsToDelete.length > 1
            ? `Are you sure you want to delete these ${itemsToDelete.length} items?`
            : `Are you sure you want to delete "${itemsToDelete[0]?.name || ''}"?`
        }
        loading={loading}
        onCancel={() => {
          setDeleteDialogOpen(false);
          setItemsToDelete([]);
        }}
        onConfirm={confirmDelete}
      />
    </Box>
  );
};

export default Media;
