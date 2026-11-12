import { createElement } from 'react';
import {
  ImageOutlined as ImageIcon,
  InsertDriveFileOutlined as FileIcon,
  VideoFileOutlined as VideoIcon,
  PictureAsPdfOutlined as PdfIcon,
} from '@mui/icons-material';
import { formatDistanceToNowStrict } from 'date-fns';
import apiClient from '../../services/apiClient';

// Shopfront "Media Centre" look, shared by the full page (Marketing/Media.jsx)
// and the picker dialog (Common/MediaDialog.jsx) so the two never drift apart.
// Constants, helpers and sx only (no JSX) - the shared components
// (QuestionDialog, SortAmountIcon) live in mediaCentreComponents.jsx.

export const USED_FILE_MSG = "Cannot delete a file that is being used somewhere in Crinit's Shop";

export const SORT_OPTIONS = ['Created At', 'Last Modified', 'Name', 'File Type'];

export const COMPARATORS = {
  'Created At': (a, b) => new Date(a.created || 0) - new Date(b.created || 0),
  'Last Modified': (a, b) => new Date(a.modified || 0) - new Date(b.modified || 0),
  Name: (a, b) => a.name.localeCompare(b.name),
  'File Type': (a, b) => (a.extension || '').localeCompare(b.extension || ''),
};

// Media files are served by the API host from /uploads (not /api), so the origin
// has to follow apiClient's baseURL — hardcoding a host breaks every environment
// but the one it names. Same derivation as Setup/Users.jsx.
export const API_ORIGIN = (apiClient.defaults?.baseURL || '').replace(/\/+api\/?$/, '').replace(/\/+$/, '');

// Helper function to construct proper media URL
export const getMediaUrl = (url) => {
  if (!url) return '';
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  // Strip the leading slash so the join never doubles up
  return `${API_ORIGIN}/${String(url).replace(/^\/+/, '')}`;
};

export const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
export const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv', '.flv', '.wmv'];

export const isImageFile = (item) => IMAGE_EXTENSIONS.includes((item?.extension || '').toLowerCase());
export const isVideoFile = (item) => VIDEO_EXTENSIONS.includes((item?.extension || '').toLowerCase());

// "Created 5 years ago" – empty string on a missing/garbage timestamp
// (formatDistanceToNowStrict throws a RangeError on an invalid date).
export const relativeCreated = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : `Created ${formatDistanceToNowStrict(date, { addSuffix: true })}`;
};

// Format file size – reference style: 1000-based, "15.05 kB"
export const formatFileSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n < 1000) return `${n} bytes`;
  const sizes = ['kB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log10(n) / 3), sizes.length);
  return `${(n / 1000 ** i).toFixed(2)} ${sizes[i - 1]}`;
};

// File-type glyph used by the thumbnail overlay (createElement: this is a .js
// module so it can export constants without tripping react-refresh)
export const typeGlyph = (item, fontSize) => {
  const sx = { fontSize, color: '#f8f8f8' };
  if (isImageFile(item)) return createElement(ImageIcon, { sx });
  if (isVideoFile(item)) return createElement(VideoIcon, { sx });
  if ((item.extension || '').toLowerCase() === '.pdf') return createElement(PdfIcon, { sx });
  return createElement(FileIcon, { sx });
};

// Reference `.folder-header`: 2rem tall, 1.25rem text, 2rem line-height.
// Size lives on the row so the label just inherits it.
export const treeRowSx = (current) => ({
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

export const tileSx = (selected) => ({
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

export const captionSx = {
  fontSize: 16,
  color: '#313439',
  maxWidth: 207,
  textAlign: 'center',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

// 36x34 flat chip button used by the refresh + sort-direction controls
export const chipBtnSx = {
  width: 36,
  height: 34,
  borderRadius: '6px',
  bgcolor: '#f8f8f8',
  color: '#313439',
  p: '8px',
  transition: 'background 0.2s ease',
  '&&:hover': { bgcolor: '#d9d9d9' },
};

export const railBtnSx = (disabled) => ({
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

// Sort-by select, sized to sit beside the two chip buttons
export const sortSelectSx = {
  width: 150,
  height: 34,
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
};

export const sortMenuProps = {
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
};

// Rounded grey "Search for file in current directory" pill
export const searchFieldSx = {
  mt: 2,
  '& .MuiInputBase-root': {
    height: 48,
    bgcolor: '#ededed',
    borderRadius: '24px',
    fontSize: 16,
    padding: '0 16px 0 24px',
  },
  '& .MuiInputBase-input': { p: 0 },
};

// Breadcrumb pieces: "/ Home / Product Images"
export const crumbSeparatorSx = { color: '#313439', fontSize: 14, fontWeight: 700, m: '0 2px', p: '4px 0' };
export const crumbButtonSx = {
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
};

// Left-column buttons: green Upload (64px) and blue New Folder (48px); both invert on hover
export const uploadBtnSx = {
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
};

export const newFolderBtnSx = {
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
};
