import React, { useState, useEffect, useRef, useMemo } from 'react';
import { spinSx } from '../../utils/spinSx';
import useSpinOnce from '../../hooks/useSpinOnce';
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
  Tooltip,
} from '@mui/material';
import {
  CloudUploadOutlined as CloudUploadIcon,
  FolderOutlined as FolderIcon,
  FolderOpenOutlined as FolderOpenIcon,
  InsertDriveFileOutlined as FileIcon,
  ImageOutlined as ImageIcon,
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
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import apiClient from '../../services/apiClient';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
// Shopfront "Media Centre" look, shared with the full page (Marketing/Media.jsx)
import {
  USED_FILE_MSG,
  SORT_OPTIONS,
  COMPARATORS,
  getMediaUrl,
  isImageFile,
  isVideoFile,
  formatFileSize,
  typeGlyph,
  treeRowSx,
  tileSx,
  captionSx,
  chipBtnSx,
  railBtnSx,
  sortSelectSx,
  sortMenuProps,
  searchFieldSx,
  crumbSeparatorSx,
  crumbButtonSx,
  uploadBtnSx,
  newFolderBtnSx,
} from './mediaCentreUi.js';
import { SortAmountIcon, QuestionDialog } from './mediaCentreComponents';

// Picker tiles are a size down from the page's 227px so five fit a row at ~1500px
const TILE_W = 150;
const THUMB = 140;
const pickerTileSx = (selected) => ({
  ...tileSx(selected),
  width: TILE_W,
  height: 186,
  gap: 0.5,
  outline: selected ? '2px solid #1c86f2' : 'none',
  outlineOffset: -2,
});
const pickerCaptionSx = { ...captionSx, fontSize: 14, maxWidth: TILE_W - 16 };

/**
 * Media picker used by every "choose an image / video" button.
 *
 * Props (all callers keep working unchanged):
 *  - open, onClose
 *  - onSelect(url)            single mode (default) - the absolute media URL
 *  - onSelect([url, ...])     when `multiple` is true (slideshow "Add New Slide")
 *  - accept                   'image/*' (default) filters the grid to images and
 *                             rejects non-image uploads; 'image/*,video/*' or
 *                             anything else shows every file
 *  - multiple                 checkboxes build a multi-selection; Select returns all
 */
const MediaDialog = ({ open, onClose, onSelect, accept = 'image/*', multiple = false }) => {
  // Same library the dialog lists: the navbar outlet's (GETs carry it
  // automatically, a FormData upload / DELETE does not), or the common one
  const { selectedOutletId } = useSelectedOutlet();
  const scope = selectedOutletId ? { outletId: selectedOutletId } : {};
  const scopeQuery = selectedOutletId ? `&outletId=${encodeURIComponent(selectedOutletId)}` : '';

  // Folder tree, loaded a level at a time: childrenOf[path] is the list of
  // sub-folders once that folder has been opened ('' = Home).
  const [childrenOf, setChildrenOf] = useState({});
  const [treeLoading, setTreeLoading] = useState({});
  const [files, setFiles] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('Created At');
  const [sortAsc, setSortAsc] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshSpinning, spinRefresh] = useSpinOnce(loading);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [originalExtension, setOriginalExtension] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const fileInputRef = useRef(null);
  // Answers that arrive after the folder changed are dropped
  const filesReqRef = useRef(0);

  // Load one folder's sub-folders into the tree
  const loadChildren = async (folderPath) => {
    setTreeLoading((prev) => ({ ...prev, [folderPath]: true }));
    try {
      const response = await apiClient.get('/media/folders', {
        params: { shallow: 1, folderPath, ...scope },
        noCache: true,
      });
      setChildrenOf((prev) => ({ ...prev, [folderPath]: response.data.folders || [] }));
    } catch (error) {
      console.error('Error fetching folders:', error);
      if (error?.response?.status !== 403) setError('Failed to load folder structure');
    } finally {
      setTreeLoading((prev) => ({ ...prev, [folderPath]: false }));
    }
  };

  // After a create / rename / delete: reload every folder the tree has open
  const fetchFolders = () => {
    Object.keys(childrenOf).forEach((p) => loadChildren(p));
    if (!('' in childrenOf)) loadChildren('');
  };

  // Fetch files in current folder
  const fetchFiles = async (path = '') => {
    const req = ++filesReqRef.current;
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.get('/media/files', {
        params: { folderPath: path, ...scope },
        noCache: true,
      });
      if (req !== filesReqRef.current) return;
      const list = [...response.data.folders, ...response.data.files];
      setFiles(list);
      // Keep the selection's details (e.g. "Used by") in step with the server
      setSelectedItems((prev) => prev.map((s) => list.find((i) => i.path === s.path) || s));
    } catch (error) {
      if (req !== filesReqRef.current) return;
      console.error('Error fetching files:', error);
      setError(error?.response?.status === 403
        ? 'You do not have permission to see the Media Centre'
        : (error?.response?.data?.error || 'Failed to load files'));
    } finally {
      if (req === filesReqRef.current) setLoading(false);
    }
  };

  // Every opening starts fresh at Home with nothing selected
  useEffect(() => {
    if (!open) return;
    setChildrenOf({});
    setExpandedFolders({});
    setSelectedItems([]);
    setSearchQuery('');
    setError('');
    setSuccess('');
    setCurrentPath('');
    loadChildren('');
    fetchFiles('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedOutletId]);

  useEffect(() => {
    if (open) fetchFiles(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  // Navigate into a directory
  const handleFolderClick = (folderPath) => {
    setCurrentPath(folderPath);
    setSelectedItems([]);
  };

  const goUp = () => handleFolderClick(currentPath.split('/').filter(Boolean).slice(0, -1).join('/'));

  // Selection – a click selects one tile; in multi mode the checkbox adds / removes
  const isSelected = (item) => selectedItems.some((s) => s.path === item.path);
  const selectOnly = (item) => setSelectedItems([item]);
  const toggleSelect = (item) => {
    if (!multiple) {
      setSelectedItems((prev) => (prev.some((s) => s.path === item.path) ? [] : [item]));
      return;
    }
    setSelectedItems((prev) =>
      prev.some((s) => s.path === item.path)
        ? prev.filter((s) => s.path !== item.path)
        : [...prev, item]
    );
  };

  const selectedFiles = selectedItems.filter((i) => i.type !== 'folder');
  const selectedFile = selectedItems.length === 1 ? selectedItems[0] : null;
  const canRename = selectedItems.length === 1;
  // Reference: a file used somewhere can be renamed but not deleted
  const selectionUsed = selectedItems.some((i) => i.usedBy?.length > 0);
  const canDelete = selectedItems.length > 0 && !selectionUsed;
  const canSelect = selectedFiles.length > 0;

  // Hand the choice back in the shape the caller expects
  const confirmSelection = (items = selectedFiles) => {
    if (!items.length || !onSelect) return;
    const urls = items.map((f) => getMediaUrl(f.url));
    onSelect(multiple ? urls : urls[0]);
    onClose?.();
  };

  // Accept filter: 'image/*' shows images only; anything broader shows every file
  const acceptsOnly = (file) => {
    if (accept === 'image/*') return file.type.startsWith('image/');
    if (accept === 'image/*,video/*') return file.type.startsWith('image/') || file.type.startsWith('video/');
    return true;
  };

  // Upload – the backend accepts one file per request, so a multi-file
  // drop / picker selection is uploaded sequentially against the same endpoint.
  const uploadFiles = async (fileList) => {
    const list = Array.from(fileList || []);
    if (!list.length) return;

    setLoading(true);
    setError('');
    try {
      const failed = [];
      for (const file of list) {
        if (!acceptsOnly(file)) {
          failed.push(`${file.name}: ${accept === 'image/*' ? 'Please select an image file' : 'Please select an image or video file'}`);
          continue;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
          await apiClient.post(`/media/upload?folderPath=${encodeURIComponent(currentPath || '')}${scopeQuery}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          failed.push(`${file.name}: ${error?.response?.data?.error || 'Failed to upload file'}`);
        }
      }
      const done = list.length - failed.length;
      if (done) {
        setSuccess(done > 1 ? `${done} files uploaded successfully` : 'File uploaded successfully');
        setTimeout(() => setSuccess(''), 3000);
        // fetchFiles clears the error first, so it goes before the error is set
        await fetchFiles(currentPath);
      }
      if (failed.length) setError(failed.join(' | '));
    } finally {
      setLoading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };
  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) setIsDragging(false);
  };
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    uploadFiles(e.dataTransfer?.files);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim() || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      await apiClient.post('/media/folder', {
        folderName: newFolderName.trim(),
        folderPath: currentPath,
        ...scope,
      });
      setSuccess('Folder created successfully');
      fetchFolders();
      fetchFiles(currentPath);
      setFolderDialogOpen(false);
      setNewFolderName('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error creating folder:', error);
      setError(error?.response?.data?.error || 'Failed to create folder');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

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

  const closeRename = () => {
    setRenameDialogOpen(false);
    setRenameValue('');
    setRenameTarget(null);
    setOriginalExtension('');
  };

  const trimmedRenameValue = renameValue.trim();
  const finalRenameName = trimmedRenameValue && originalExtension && !getFileExtension(trimmedRenameValue)
    ? `${trimmedRenameValue}${originalExtension}`
    : trimmedRenameValue;
  const renameDisabled = !renameTarget || !finalRenameName || finalRenameName === renameTarget.name;

  const handleRename = async () => {
    if (renameDisabled || savingRef.current) return;
    const oldPath = renameTarget.path;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const response = await apiClient.put('/media/rename', {
        oldPath,
        newName: finalRenameName,
        ...scope,
      });
      const { newPath, newName, newUrl, size, extension, type } = response.data;
      const updateRenamedItem = (item) => item.path === oldPath
        ? {
            ...item,
            name: newName,
            path: newPath,
            url: item.type === 'folder' ? undefined : (newUrl || item.url),
            size: size ?? item.size,
            extension: extension ?? item.extension,
            type: type || item.type,
          }
        : item;
      setFiles((prev) => prev.map(updateRenamedItem));
      setSelectedItems((prev) => prev.map(updateRenamedItem));
      setSuccess('Renamed successfully');
      fetchFolders();
      fetchFiles(currentPath);
      closeRename();
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error renaming:', error);
      setError(error?.response?.data?.error || 'Failed to rename');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
      const deleted = [];
      const failed = [];
      for (const item of items) {
        const type = item.type === 'folder' ? 'folder' : 'file';
        try {
          await apiClient.delete(`/media/${type}`, { params: { path: item.path, ...scope } });
          deleted.push(item);
        } catch (error) {
          console.error('Error deleting:', error);
          failed.push(`${item.name}: ${error?.response?.data?.error || 'Failed to delete'}`);
        }
      }
      if (deleted.length) {
        setSuccess(
          deleted.length > 1
            ? `${deleted.length} items deleted successfully`
            : `${deleted[0].type === 'folder' ? 'Folder' : 'File'} deleted successfully`
        );
        setTimeout(() => setSuccess(''), 3000);
      }
      if (deleted.some((i) => i.type === 'folder')) fetchFolders();
      await fetchFiles(currentPath);
      if (failed.length) setError(failed.join(' | '));
      setSelectedItems((prev) => prev.filter((s) => !deleted.some((i) => i.path === s.path)));
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setItemsToDelete([]);
    }
  };

  // The chevron opens / closes a folder; its sub-folders load the first time
  const toggleFolder = (folderPath) => {
    const opening = !expandedFolders[folderPath];
    setExpandedFolders((prev) => ({ ...prev, [folderPath]: opening }));
    if (opening && !childrenOf[folderPath]) loadChildren(folderPath);
  };

  const renderFolderTree = (folderList, level = 0) => folderList.map((folder) => {
    const isExpanded = expandedFolders[folder.path];
    const isCurrent = currentPath === folder.path;
    const loaded = childrenOf[folder.path];
    // Reference: every folder shows a chevron until it is known to be empty
    const hasChildren = !loaded || loaded.length > 0;

    return (
      <React.Fragment key={folder.path}>
        <ListItem disablePadding sx={{ pl: level * 2 }}>
          <ListItemButton
            onClick={(e) => {
              e.stopPropagation();
              handleFolderClick(folder.path);
            }}
            sx={treeRowSx(isCurrent)}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
              {hasChildren ? (
                <Box
                  className="folder-close-toggle"
                  sx={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFolder(folder.path);
                  }}
                >
                  {isExpanded ? <ChevronDownIcon sx={{ fontSize: 18 }} /> : <ChevronRightIcon sx={{ fontSize: 18 }} />}
                </Box>
              ) : (
                <Box sx={{ width: 20, mr: 0.5 }} />
              )}
              <ListItemIcon sx={{ minWidth: 28 }}>
                {isExpanded && hasChildren ? <FolderOpenIcon sx={{ fontSize: 20 }} /> : <FolderIcon sx={{ fontSize: 20 }} />}
              </ListItemIcon>
              <ListItemText className="folder-heading" primary={folder.name} />
            </Box>
          </ListItemButton>
        </ListItem>
        {isExpanded && hasChildren && renderTreeLevel(folder.path, level + 1)}
      </React.Fragment>
    );
  });

  // One folder's sub-folders, or "Loading..." while they are fetched
  const renderTreeLevel = (folderPath, level) => {
    const list = childrenOf[folderPath];
    if (!list) {
      return treeLoading[folderPath] ? (
        <ListItem disablePadding sx={{ pl: level * 2 + 3.5, height: 32, fontSize: 16, color: '#676b72' }}>
          Loading...
        </ListItem>
      ) : null;
    }
    return <Box>{renderFolderTree(list, level)}</Box>;
  };

  // Reference: "/ Home" at the root, "/ MDB / Sales Keys" inside a folder
  const getBreadcrumbs = () => {
    if (!currentPath) return [{ name: 'Home', path: '' }];
    const breadcrumbs = [];
    let pathSoFar = '';
    currentPath.split('/').filter(Boolean).forEach((part) => {
      pathSoFar = pathSoFar ? `${pathSoFar}/${part}` : part;
      breadcrumbs.push({ name: part, path: pathSoFar });
    });
    return breadcrumbs;
  };

  // Accept filter + search + sort. Folder tiles stay pinned to the top.
  const visibleItems = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const matches = files.filter((item) => {
      if (!item.name.toLowerCase().includes(q)) return false;
      if (item.type === 'folder') return true;
      if (accept === 'image/*') return isImageFile(item);
      return true;
    });
    const dirs = matches.filter((i) => i.type === 'folder');
    const docs = matches.filter((i) => i.type !== 'folder');
    const cmp = COMPARATORS[sortBy] || COMPARATORS['Created At'];
    docs.sort((a, b) => (sortAsc ? cmp(a, b) : cmp(b, a)));
    return [...dirs, ...docs];
  }, [files, searchQuery, sortBy, sortAsc, accept]);

  const thumbBoxSx = { width: THUMB, height: THUMB, display: 'flex', alignItems: 'center', justifyContent: 'center' };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      transitionDuration={0}
      aria-label="Media Centre"
      PaperProps={{
        sx: { bgcolor: 'rgba(0, 0, 0, 0.6)', boxShadow: 'none' },
        onDragEnter: handleDragEnter,
        onDragOver: handleDragOver,
        onDragLeave: handleDragLeave,
        onDrop: handleDrop,
      }}
    >
      {/* Close "X" at the very top-right of the overlay (Cancel) */}
      <IconButton
        onClick={onClose}
        aria-label="Cancel"
        title="Cancel"
        sx={{
          position: 'absolute',
          top: 4,
          right: 8,
          zIndex: 2,
          color: '#f8f8f8',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
        }}
      >
        <CloseIcon sx={{ fontSize: 28 }} />
      </IconButton>

      <Box
        sx={{
          position: 'absolute',
          top: 44,
          left: { xs: 0, md: 24 },
          right: { xs: 0, md: 24 },
          bottom: { xs: 0, md: 24 },
          display: 'flex',
          bgcolor: '#f8f8f8',
          overflow: 'hidden',
        }}
      >
        {/* Left column – Upload / New Folder / Folder tree */}
        <Paper
          sx={{
            width: { xs: 240, md: 370 },
            minWidth: { xs: 240, md: 370 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            boxShadow: 'none',
          }}
        >
          <Button
            fullWidth
            startIcon={<CloudUploadIcon sx={{ fontSize: 28 }} />}
            onClick={() => fileInputRef.current?.click()}
            sx={uploadBtnSx}
          >
            Upload
          </Button>
          <Button fullWidth startIcon={<AddIcon />} onClick={() => setFolderDialogOpen(true)} sx={newFolderBtnSx}>
            New Folder
          </Button>
          <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'white' }}>
            <List dense sx={{ py: 0, bgcolor: 'white' }}>
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
              {renderTreeLevel('', 1)}
            </List>
          </Box>
        </Paper>

        {/* Main area – breadcrumb, toolbar, search, tile grid */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', bgcolor: '#f8f8f8' }}>
          <Box sx={{ p: 2, pb: 0 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: 14, color: '#313439' }}>
                {getBreadcrumbs().map((crumb) => (
                  <React.Fragment key={crumb.path || 'home'}>
                    <Box component="span" sx={crumbSeparatorSx}>/</Box>
                    <Box component="button" type="button" onClick={() => handleFolderClick(crumb.path)} sx={crumbButtonSx}>
                      {crumb.name}
                    </Box>
                  </React.Fragment>
                ))}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton disableRipple onClick={() => { spinRefresh(); fetchFiles(currentPath); }} sx={chipBtnSx} title="Refresh">
                  <RefreshIcon sx={{ fontSize: 16, ...spinSx(refreshSpinning) }} />
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
                  sx={sortSelectSx}
                  MenuProps={sortMenuProps}
                >
                  {SORT_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option}>{option}</MenuItem>
                  ))}
                </Select>
              </Box>
            </Box>

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
              sx={searchFieldSx}
            />
          </Box>

          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
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
              <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TILE_W}px)`, justifyContent: 'flex-start', gap: 1 }}>
                {/* ".." up-directory tile – only below Home */}
                {currentPath && (
                  <Paper sx={pickerTileSx(false)} onClick={goUp} title="Up one folder">
                    <Box sx={thumbBoxSx}>
                      <UpDirIcon sx={{ fontSize: 80, color: '#313439' }} />
                    </Box>
                    <Typography sx={pickerCaptionSx}>..</Typography>
                  </Paper>
                )}

                {/* "New Folder" tile */}
                <Paper sx={pickerTileSx(false)} onClick={() => setFolderDialogOpen(true)}>
                  <Box sx={thumbBoxSx}>
                    <NewFolderIcon sx={{ fontSize: 80, color: '#1c86f2' }} />
                  </Box>
                  <Typography sx={{ ...pickerCaptionSx, color: '#1c86f2' }}>New Folder</Typography>
                </Paper>

                {visibleItems.map((item) => {
                  const selected = isSelected(item);
                  const isFolder = item.type === 'folder';
                  return (
                    <Paper
                      key={item.path}
                      sx={pickerTileSx(selected)}
                      onClick={() => (isFolder ? handleFolderClick(item.path) : selectOnly(item))}
                      onDoubleClick={() => {
                        // Double-clicking a file picks it straight away (single mode)
                        if (!isFolder && !multiple) confirmSelection([item]);
                      }}
                    >
                      <Box sx={{ ...thumbBoxSx, position: 'relative', overflow: 'hidden' }}>
                        {isFolder ? (
                          <Box sx={{ position: 'relative', width: 80, height: 80 }}>
                            <FolderIcon sx={{ fontSize: 80, color: '#313439' }} />
                            <FileIcon sx={{ position: 'absolute', left: '50%', top: '56%', transform: 'translate(-50%, -50%)', fontSize: 22, color: '#313439' }} />
                          </Box>
                        ) : (
                          <>
                            {item.url && isImageFile(item) && (
                              <Box
                                component="img"
                                src={getMediaUrl(item.url)}
                                alt={item.name}
                                sx={{ width: THUMB, height: THUMB, objectFit: 'cover' }}
                                onError={(e) => { e.target.style.visibility = 'hidden'; }}
                              />
                            )}
                            {item.url && isVideoFile(item) && (
                              <Box
                                component="video"
                                src={getMediaUrl(item.url)}
                                preload="metadata"
                                muted
                                sx={{ width: THUMB, height: THUMB, objectFit: 'cover' }}
                                onError={(e) => { e.target.style.visibility = 'hidden'; }}
                              />
                            )}
                            {/* Dark file-type overlay – fades out when the tile is selected or hovered */}
                            <Box
                              className="media-overlay"
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
                              {typeGlyph(item, 80)}
                            </Box>
                          </>
                        )}
                        {/* Checkbox – always visible; builds the multi-selection */}
                        <Box
                          component="button"
                          type="button"
                          aria-label={`Select ${item.name}`}
                          aria-pressed={selected}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(item);
                          }}
                          onDoubleClick={(e) => e.stopPropagation()}
                          sx={{
                            position: 'absolute',
                            top: 6,
                            left: 6,
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
                      <Typography sx={pickerCaptionSx} title={item.name}>
                        {item.usedBy?.length > 0 && (
                          <AttachIcon titleAccess="Used in Crinit's Shop" sx={{ fontSize: 14, verticalAlign: 'text-bottom', mr: 0.25, transform: 'rotate(45deg)' }} />
                        )}
                        {item.name}
                      </Typography>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        </Box>

        {/* Right panel – Rename / Delete, preview, Select */}
        <Paper
          sx={{
            width: { xs: 260, md: 380 },
            minWidth: { xs: 260, md: 380 },
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 0,
            boxShadow: 'none',
          }}
        >
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <Button
                disabled={!canRename}
                onClick={() => openRename(selectedFile)}
                startIcon={<EditIcon sx={{ color: canRename ? '#32b643' : '#bdbdbd' }} />}
                sx={{ ...railBtnSx(!canRename), width: 118 }}
              >
                Rename
              </Button>
              {/* span: a disabled button fires no hover events, so the tooltip hangs on its wrapper */}
              <Tooltip
                title={selectionUsed ? USED_FILE_MSG : ''}
                placement="bottom"
                arrow
                enterDelay={0}
                TransitionProps={{ timeout: 0 }}
                componentsProps={{
                  tooltip: { sx: { bgcolor: '#313439', color: '#f8f8f8', fontSize: 14, fontWeight: 400, maxWidth: 260, p: '8px 12px', borderRadius: '6px', textAlign: 'center' } },
                  arrow: { sx: { color: '#313439' } },
                }}
              >
                <Box component="span" sx={{ display: 'inline-flex' }}>
                  <Button
                    disabled={!canDelete}
                    onClick={() => {
                      setItemsToDelete(selectedItems);
                      setDeleteDialogOpen(true);
                    }}
                    startIcon={<DeleteIcon sx={{ color: canDelete ? '#e33430' : '#bdbdbd' }} />}
                    sx={{ ...railBtnSx(!canDelete), width: 105 }}
                  >
                    Delete
                  </Button>
                </Box>
              </Tooltip>
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
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  {selectedFile.url && isImageFile(selectedFile) ? (
                    <Box
                      component="img"
                      src={getMediaUrl(selectedFile.url)}
                      alt={selectedFile.name}
                      sx={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 0 }}
                    />
                  ) : selectedFile.url && isVideoFile(selectedFile) ? (
                    <Box component="video" src={getMediaUrl(selectedFile.url)} controls sx={{ maxWidth: '100%', maxHeight: 300, borderRadius: 0 }}>
                      Your browser does not support the video tag.
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 100 }}>
                      {selectedFile.type === 'folder'
                        ? <FolderIcon sx={{ fontSize: 96, color: '#bdbdbd' }} />
                        : <FileIcon sx={{ fontSize: 96, color: '#bdbdbd' }} />}
                    </Box>
                  )}
                </Box>
                <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000000', wordBreak: 'break-word', textAlign: 'center' }}>
                  {selectedFile.name}
                </Typography>
                {selectedFile.size != null && selectedFile.type !== 'folder' && (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                    <StorageIcon sx={{ fontSize: 18, color: '#676b72' }} />
                    <Typography sx={{ fontSize: 14, color: '#313439' }}>{formatFileSize(selectedFile.size)}</Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', mt: 4 }}>
                <ImageIcon sx={{ fontSize: 96, color: '#bdbdbd', mb: 2 }} />
                <Typography sx={{ fontSize: 18, color: '#bdbdbd' }}>Select a file</Typography>
              </Box>
            )}
          </Box>

          <Button
            fullWidth
            disabled={!canSelect}
            onClick={() => confirmSelection()}
            sx={{
              height: 70,
              borderRadius: 0,
              bgcolor: '#1c86f2',
              color: '#f8f8f8',
              fontSize: 24,
              fontWeight: 400,
              textTransform: 'none',
              boxShadow: 'none',
              flexShrink: 0,
              '&&:hover': { bgcolor: 'rgb(12,109,207)', boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#bdbdbd', color: '#f8f8f8' },
            }}
          >
            Select{multiple && selectedFiles.length > 1 ? ` (${selectedFiles.length})` : ''}
          </Button>
        </Paper>

        {/* Drag-and-drop upload overlay */}
        {isDragging && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              bgcolor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(4px)',
              zIndex: 3,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'copy',
            }}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Box sx={{ bgcolor: 'white', p: 4, textAlign: 'center', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)', maxWidth: 400, mx: 2 }}>
              <CloudUploadIcon sx={{ fontSize: 56, color: '#32b643', mb: 2 }} />
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#313439' }}>Drop your file here</Typography>
              <Typography sx={{ fontSize: 14, color: '#676b72' }}>It will be uploaded to the current directory</Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Hidden file input driven by the Upload button */}
      <input
        type="file"
        ref={fileInputRef}
        multiple
        style={{ display: 'none' }}
        accept={accept}
        onChange={(e) => uploadFiles(e.target.files)}
      />

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
        confirmDisabled={!newFolderName.trim()}
        busy={saving}
      />

      <QuestionDialog
        open={renameDialogOpen}
        title={renameTarget?.type === 'folder' ? 'Rename directory' : 'Rename file'}
        body={`What should the ${renameTarget?.type === 'folder' ? 'directory' : 'file'}, ${renameTarget?.name || ''}, be renamed to?`}
        value={renameValue}
        onChange={setRenameValue}
        onCancel={closeRename}
        onConfirm={handleRename}
        confirmText="Rename"
        confirmDisabled={renameDisabled}
        busy={saving}
      />

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
    </Dialog>
  );
};

export default MediaDialog;
