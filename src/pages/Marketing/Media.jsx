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
  SvgIcon,
  Tooltip,
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
  AttachFile as AttachIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import apiClient from '../../services/apiClient';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

const USED_FILE_MSG = "Cannot delete a file that is being used somewhere in Crinit's Shop";

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
// busy: the request is on its way - both buttons and Enter are off, so a
// double click cannot send it twice
const QuestionDialog = ({ open, title, body, value, onChange, onCancel, onConfirm, confirmText, confirmDisabled = false, busy = false }) => (
  <Dialog
    open={open}
    onClose={busy ? undefined : onCancel}
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
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !confirmDisabled && !busy) onConfirm();
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
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 2 }}>
        <Button
          onClick={onCancel}
          disabled={busy}
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
            '&.Mui-disabled': {
              bgcolor: '#f8f8f8',
              color: '#b3b3b3',
              border: '1px solid #676b72',
            },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={confirmDisabled || busy}
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
            '&.Mui-disabled': {
              bgcolor: '#e0e0e0',
              color: '#a6a6a6',
              boxShadow: 'none',
            },
          }}
        >
          {busy ? `${confirmText}...` : confirmText}
        </Button>
      </Box>
    </Box>
  </Dialog>
);

const Media = () => {
  const theme = useTheme();
  const isTabletOrBelow = useMediaQuery(theme.breakpoints.down('md'));

  // Outlet rule: a navbar outlet (or a user's own outlet) = that outlet's library.
  // All Outlets = the common library, with a picker to open one outlet's library.
  const { outlets, selectedOutletId, isAllOutlets } = useSelectedOutlet();
  const [libraryOutlet, setLibraryOutlet] = useState('');
  const scopeOutletId = isAllOutlets ? libraryOutlet : selectedOutletId;
  const scope = scopeOutletId ? { outletId: scopeOutletId } : {};
  const scopeQuery = scopeOutletId ? `&outletId=${encodeURIComponent(scopeOutletId)}` : '';

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
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [renameTarget, setRenameTarget] = useState(null);
  const [originalExtension, setOriginalExtension] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState([]);
  const fileInputRef = useRef(null);
  // A create / rename request is on its way (its dialog's buttons are off).
  // The ref stops a second click that lands before the re-render.
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  // Answers that arrive after the library or folder changed are dropped
  const libraryRef = useRef(scopeOutletId);
  libraryRef.current = scopeOutletId;
  const filesReqRef = useRef(0);

  // Load one folder's sub-folders into the tree
  const loadChildren = async (folderPath) => {
    const library = scopeOutletId;
    setTreeLoading((prev) => ({ ...prev, [folderPath]: true }));
    try {
      const response = await apiClient.get('/media/folders', {
        params: { shallow: 1, folderPath, ...scope },
        noCache: true,
      });
      if (libraryRef.current !== library) return;
      setChildrenOf((prev) => ({ ...prev, [folderPath]: response.data.folders || [] }));
    } catch (error) {
      console.error('Error fetching folders:', error);
      setError('Failed to load folder structure');
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
      setError(error.response?.data?.error || 'Failed to load files');
    } finally {
      if (req === filesReqRef.current) setLoading(false);
    }
  };

  // A new library (outlet picker): start again at its Home
  useEffect(() => {
    setChildrenOf({});
    setExpandedFolders({});
    setSelectedItems([]);
    setCurrentPath('');
    loadChildren('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeOutletId]);

  useEffect(() => {
    fetchFiles(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath, scopeOutletId]);

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
      // One bad file (too big, a huge GIF) must not stop the rest
      const failed = [];
      for (const file of list) {
        const formData = new FormData();
        formData.append('file', file);
        // Note: folderPath is sent as query parameter since multer's destination callback
        // doesn't have access to req.body for multipart/form-data
        try {
          await apiClient.post(`/media/upload?folderPath=${encodeURIComponent(currentPath)}${scopeQuery}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          });
        } catch (error) {
          console.error('Error uploading file:', error);
          failed.push(`${file.name}: ${error.response?.data?.error || 'Failed to upload file'}`);
        }
      }
      const done = list.length - failed.length;
      if (done) {
        setSuccess(done > 1 ? `${done} files uploaded successfully` : 'File uploaded successfully');
        setTimeout(() => setSuccess(''), 3000);
      }
      // fetchFiles clears the error first, so it goes before the error is set
      fetchFiles(currentPath);
      if (failed.length) setError(failed.join(' | '));
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
    if (!newFolderName.trim() || savingRef.current) return;

    savingRef.current = true;
    setSaving(true);
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/media/folder', {
        folderPath: currentPath,
        folderName: newFolderName.trim(),
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
      setError(error.response?.data?.error || 'Failed to create folder');
    } finally {
      savingRef.current = false;
      setSaving(false);
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
      // A used file / a folder holding one is refused by the server; the rest go
      const deleted = [];
      const failed = [];
      for (const item of items) {
        const type = item.type === 'folder' ? 'folder' : 'file';
        try {
          await apiClient.delete(`/media/${type}`, {
            params: { path: item.path, ...scope }
          });
          deleted.push(item);
        } catch (error) {
          console.error('Error deleting:', error);
          failed.push(`${item.name}: ${error.response?.data?.error || 'Failed to delete'}`);
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
      if (deleted.some((i) => i.type === 'folder')) {
        fetchFolders();
      }
      fetchFiles(currentPath);
      if (failed.length) setError(failed.join(' | '));
      setSelectedItems((prev) => prev.filter((s) => !deleted.some((i) => i.path === s.path)));
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

  const trimmedRenameValue = renameValue.trim();
  const finalRenameName = trimmedRenameValue && originalExtension && !getFileExtension(trimmedRenameValue)
    ? `${trimmedRenameValue}${originalExtension}`
    : trimmedRenameValue;
  const renameDisabled = !renameTarget || !finalRenameName || finalRenameName === renameTarget.name;

  // Handle rename
  const handleRename = async () => {
    if (renameDisabled || savingRef.current) return;
    const oldPath = renameTarget.path;

    savingRef.current = true;
    setSaving(true);
    setLoading(true);
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

      // Update the tile and its selected details together before refreshing.
      setFiles((prev) => prev.map(updateRenamedItem));
      setSelectedItems((prev) => prev.map(updateRenamedItem));

      setSuccess('Renamed successfully');
      fetchFolders();
      fetchFiles(currentPath);

      setRenameDialogOpen(false);
      setRenameValue('');
      setRenameTarget(null);
      setOriginalExtension('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error renaming:', error);
      setError(error.response?.data?.error || 'Failed to rename');
    } finally {
      savingRef.current = false;
      setSaving(false);
      setLoading(false);
    }
  };

  // The chevron opens / closes a folder; its sub-folders load the first time
  const toggleFolder = (folderPath) => {
    const opening = !expandedFolders[folderPath];
    setExpandedFolders((prev) => ({
      ...prev,
      [folderPath]: opening,
    }));
    if (opening && !childrenOf[folderPath]) loadChildren(folderPath);
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
      const loaded = childrenOf[folder.path];
      // Reference: every folder shows a chevron until it is known to be empty
      const hasChildren = !loaded || loaded.length > 0;

      return (
        <React.Fragment key={folder.path}>
          <ListItem disablePadding sx={{ pl: level * 2 }}>
            <ListItemButton
              onClick={(e) => {
                e.stopPropagation();
                // Reference: the name only navigates; the chevron opens / closes
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
          {isExpanded && hasChildren && renderTreeLevel(folder.path, level + 1)}
        </React.Fragment>
      );
    });
  };

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

  // Format file size – reference style: 1000-based, "15.05 kB"
  const formatFileSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n < 1000) return `${n} bytes`;
    const sizes = ['kB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log10(n) / 3), sizes.length);
    return `${(n / 1000 ** i).toFixed(2)} ${sizes[i - 1]}`;
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
    // Reference: hovering greys the tile and lifts the dark overlay off the picture
    '&:hover': { bgcolor: '#bdbdbd' },
    '&:hover .media-overlay': { opacity: 0 },
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
  // Reference: a file used somewhere can be renamed but not deleted
  const selectionUsed = selectedItems.some((i) => i.usedBy?.length > 0);
  const canDelete = selectedItems.length > 0 && !selectionUsed;

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
            {renderTreeLevel('', 1)}
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
                sx={{
                  width: 150,
                  height: 34, // same height as the two chip buttons beside it
                  bgcolor: '#f8f8f8',
                  borderRadius: '6px',
                  fontSize: 14,
                  p: 0,
                  transition: 'background 0.2s, color 0.2s',
                  '& .MuiSelect-select': {
                    padding: '0 8px 0 10px !important',
                    minHeight: 'unset',
                    height: 34,
                    lineHeight: '34px',
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
              {/* All Outlets only: which library to open - the common one or an outlet's */}
              {isAllOutlets && outlets.length > 0 && (
                <Select
                  value={libraryOutlet}
                  displayEmpty
                  onChange={(e) => setLibraryOutlet(e.target.value)}
                  IconComponent={ArrowDropDown}
                  title="Library"
                  sx={{
                    width: 170,
                    height: 34,
                    bgcolor: '#f8f8f8',
                    borderRadius: '6px',
                    fontSize: 14,
                    '& .MuiSelect-select': { padding: '0 8px 0 10px !important', minHeight: 'unset', height: 34, lineHeight: '34px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' },
                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                    '& .MuiSelect-icon': { color: '#676b72' },
                    '&:hover': { bgcolor: '#d9d9d9' },
                  }}
                  MenuProps={{ transitionDuration: 0, PaperProps: { sx: { borderRadius: 0, '& .MuiMenuItem-root': { minHeight: 48, fontSize: 16, color: '#313439' }, '& .MuiMenuItem-root.Mui-selected': { color: '#38bdf8', bgcolor: 'transparent' } } } }}
                >
                  <MenuItem value="">Common</MenuItem>
                  {outlets.map((o) => (
                    <MenuItem key={o.id} value={String(o.id)}>{o.name}</MenuItem>
                  ))}
                </Select>
              )}
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
              <Paper sx={tileSx(false)} onClick={() => setFolderDialogOpen(true)}>
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
                        // Reference: a folder with a small file glyph inside it
                        <Box sx={{ position: 'relative', width: 92, height: 92 }}>
                          <FolderIcon sx={{ fontSize: 92, color: '#313439' }} />
                          <FileIcon sx={{ position: 'absolute', left: '50%', top: '56%', transform: 'translate(-50%, -50%)', fontSize: 26, color: '#313439' }} />
                        </Box>
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
                            {typeGlyph(item, 96)}
                          </Box>
                        </>
                      )}
                      {/* Multi-select checkbox – always visible */}
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
                    <Typography sx={captionSx} title={item.name}>
                      {item.usedBy?.length > 0 && (
                        <AttachIcon titleAccess="Used in Crinit's Shop" sx={{ fontSize: 16, verticalAlign: 'text-bottom', mr: 0.25, transform: 'rotate(45deg)' }} />
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
            <Box component="span" data-testid="delete-wrap" sx={{ display: 'inline-flex' }}>
              <Button
                disabled={!canDelete}
                onClick={() => handleDelete(selectedItems)}
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
              <Typography sx={{ fontSize: 18, fontWeight: 700, color: '#000000', wordBreak: 'break-word', textAlign: 'center' }}>
                {selectedFile.name}
              </Typography>
              {relativeCreated(selectedFile.created) && (
                <Typography sx={{ fontSize: 12, color: '#676b72', mt: 0.5, textAlign: 'center' }}>
                  {relativeCreated(selectedFile.created)}
                </Typography>
              )}
              {selectedFile.size != null && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                  <StorageIcon sx={{ fontSize: 18, color: '#676b72' }} />
                  <Typography sx={{ fontSize: 14, color: '#313439' }}>
                    {formatFileSize(selectedFile.size)}
                  </Typography>
                </Box>
              )}
              {selectedFile.extension && (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 1 }}>
                  <DescriptionIcon sx={{ fontSize: 18, color: '#676b72' }} />
                  <Typography sx={{ fontSize: 14, color: '#313439' }}>
                    {selectedFile.extension.replace('.', '').toUpperCase()}
                  </Typography>
                </Box>
              )}
              {selectedFile.usedBy?.length > 0 && (
                <Box sx={{ mt: 2, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#313439', mb: 0.5 }}>Used by</Typography>
                  {Object.entries(
                    selectedFile.usedBy.reduce((acc, u) => ({ ...acc, [u.group]: [...(acc[u.group] || []), u] }), {})
                  ).map(([group, uses]) => (
                    <Box key={group} sx={{ mb: 1 }}>
                      <Typography sx={{ fontSize: 14, color: '#676b72' }}>{group}</Typography>
                      {/* centred list: bullets would float left of the text, so none */}
                      <Box component="ul" sx={{ listStyleType: 'none', p: 0, m: 0 }}>
                        {uses.map((u) => (
                          <Box component="li" key={u.link} sx={{ fontSize: 14 }}>
                            <Box component={RouterLink} to={u.link} sx={{ color: '#1c86f2', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>
                              {u.name}
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  ))}
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
        confirmDisabled={!newFolderName.trim()}
        busy={saving}
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
        confirmDisabled={renameDisabled}
        busy={saving}
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
