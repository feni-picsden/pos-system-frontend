import React, { useState } from 'react';
import {
  Box,
  CssBaseline,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  useTheme,
  useMediaQuery,
  Avatar,
  Badge,
  ListItemIcon,
  ListItemText,
  Chip,
  Popover,
  List,
  ListItem,
  Button,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  ClickAwayListener,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Close as CloseIcon,
  NotificationsNoneOutlined as NotificationsIcon,
  VolumeUpOutlined as VolumeUpIcon,
  VolumeDownOutlined as VolumeDownIcon,
  VolumeOffOutlined as VolumeOffIcon,
  PublicOutlined as GlobeIcon,
  Cloud as CloudIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  EditOutlined as EditOutlinedIcon,
  DeleteOutline as DeleteIcon,
  MoveToInboxOutlined as MoveToInboxIcon,
  Refresh as RefreshIcon,
  SyncOutlined as SyncIcon,
  CloudUploadOutlined as CloudUploadIcon,
  SaveOutlined as SaveOutlinedIcon,
  DescriptionOutlined as DescriptionIcon,
} from '@mui/icons-material';
import RegisterTakeoverWatcher from '../Register/RegisterTakeoverWatcher';
import LocationSelectorDialog from '../Common/LocationSelectorDialog';
import RegisterSelectButton from '../Common/RegisterSelectButton';
import Sidebar from './Sidebar';
import { TopProgressBar } from '../Common/GlobalTopBar';
import ProfileDrawer from './ProfileDrawer';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { styled } from '@mui/material/styles';
import { useAuth } from '../../contexts/AuthContext';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';
import { useThemeMode } from '../../contexts/themeMode';
import { useNavigate, useLocation } from 'react-router-dom';
import notificationService from '../../services/notificationService';
import apiClient, { backendOrigin } from '../../services/apiClient';
import orderInvoiceService from '../../services/orderInvoiceService';
import settingsService from '../../services/settingsService';
import useAutoLogout from '../../hooks/useAutoLogout';
import { useAppDialogs } from '../Common/AppDialogProvider';

// Team Message is admin-set HTML but still crosses a trust boundary: keep text
// and plain <a href="http(s)://..."> links, drop every other tag and attribute.
const sanitizeTeamMessage = (html) =>
  String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<(?!\/?a(?:\s|>|\/))[^>]*>/gi, '')
    .replace(/<a\s[^>]*>/gi, (tag) => {
      const href = /href\s*=\s*"(https?:\/\/[^"]*)"|href\s*=\s*'(https?:\/\/[^']*)'/i.exec(tag);
      const url = href && (href[1] || href[2]);
      return url ? `<a href="${url}" target="_blank" rel="noopener noreferrer">` : '<a>';
    });

console.assert(sanitizeTeamMessage('<script>x</script>hi') === 'hi', 'teamMessage: scripts stripped');
console.assert(
  sanitizeTeamMessage('<a href="https://x.io" onclick="evil()">go</a>') ===
    '<a href="https://x.io" target="_blank" rel="noopener noreferrer">go</a>',
  'teamMessage: link kept, handlers dropped'
);
console.assert(sanitizeTeamMessage('<a href="javascript:evil()">go</a>') === '<a>go</a>', 'teamMessage: javascript: href dropped');

const drawerWidth = 500;
// Toolbar height: the drawers/backdrop start below the fixed topbar so the
// hamburger/X stays visible (reference behavior: 50px bar).
const HEADER_HEIGHT = 50;
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.0.0';

function getDeviceName() {
  let name = localStorage.getItem('deviceName');
  if (!name) {
    name = `Device-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    localStorage.setItem('deviceName', name);
  }
  return name;
}

// Human-friendly "x minutes ago" for notification timestamps.
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ];
  for (const [name, secs] of units) {
    const v = Math.floor(diffSec / secs);
    if (v >= 1) return `${v} ${name}${v > 1 ? 's' : ''} ago`;
  }
  return 'just now';
}

const Main = styled('main')(() => ({
  flexGrow: 1,
  width: '100%',
}));

const AppBarStyled = styled(AppBar)(({ theme }) => ({
  backgroundColor: '#313439',
  boxShadow: 'none',
  width: '100%',
  zIndex: theme.zIndex.drawer + 1,
  '@media print': { display: 'none' },
}));

const DrawerHeader = styled('div')(() => ({
  minHeight: HEADER_HEIGHT,
  '@media print': { display: 'none' },
}));

// Plain 50x50 header cell — no circular button, no ripple, no hover (reference)
const headerCellSx = {
  width: 50,
  height: 50,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: '#f8f8f8',
};

// Small tool button in the quick menu (star / pencil) — 30x28, #f8f8f8, radius 6 (reference)
const quickToolSx = {
  width: 30,
  height: 28,
  bgcolor: '#f8f8f8',
  color: '#676b72',
  borderRadius: '6px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.2s ease-in-out',
  '&:hover': { bgcolor: '#e8e8e8' },
};

const quickInputSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    '& fieldset': { borderColor: '#404040', borderWidth: 1 },
    '&:hover fieldset': { borderColor: '#404040' },
    '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
  },
};

const DashboardLayout = ({ children }) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm } = useAppDialogs();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();
  // Local copy of the user so the top-bar avatar refreshes immediately after save
  const [localUser, setLocalUser] = useState(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user, logout } = useAuth();
  // Only the remount key below still needs the outlet; the selector itself moved
  // into the Location Selector dialog.
  const { selectedOutletId } = useSelectedOutlet();
  const navigate = useNavigate();
  const location = useLocation();

  const navDrawerOpen = isMobile ? mobileOpen : desktopOpen;

  const handleDrawerToggle = () => {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
    }
  };

  const handleAvatarClick = () => {
    setProfileDrawerOpen(true);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
    setProfileDrawerOpen(false);
  };

  const handleModifyUser = () => {
    setProfileDrawerOpen(false);
    navigate('/profile/edit');
  };

  // Keep localUser in sync with the auth context user
  React.useEffect(() => { setLocalUser(user); }, [user]);

  // Setup > General > Team Message: slim banner above every page.
  const [teamMessage, setTeamMessage] = useState('');
  React.useEffect(() => {
    settingsService
      .loadCachedGeneralSettings()
      .then((s) => setTeamMessage(sanitizeTeamMessage(s?.teamMessage)))
      .catch(() => {});
  }, []);

  // Setup > General > Login: idle auto logout (sell screen value overrides the
  // general one; an in-progress sale blocks it unless "Auto Logout During Sale").
  useAutoLogout({
    isSellScreen: location.pathname === '/',
    hasActiveSale: () => {
      try {
        // Same key SaleKeyPage persists the in-progress sale under.
        const saved = JSON.parse(localStorage.getItem('posActiveCart') || 'null');
        const cart = Array.isArray(saved) ? saved : saved?.cart;
        return Array.isArray(cart) && cart.length > 0;
      } catch {
        return false;
      }
    },
    onLogout: handleLogout,
  });

  const displayUser = localUser || user;

  const avatarSrc = displayUser?.avatar ? `${backendOrigin()}/${displayUser.avatar}` : null;

  const getUserInitials = () => {
    if (!displayUser?.name) return 'U';
    return displayUser.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // ── Quick Menu (cloud logo hover dropdown) ─────────────────────────────────
  const quickKey = `quickMenu:${user?.id ?? 'default'}`;
  const [quickItems, setQuickItems] = useState([]);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickEditOpen, setQuickEditOpen] = useState(false);

  React.useEffect(() => {
    // ponytail: quick menu is per-user localStorage; move to backend if cross-device sync matters
    try {
      const saved = JSON.parse(localStorage.getItem(quickKey));
      setQuickItems(Array.isArray(saved) ? saved : [{ name: 'Sell Screen', url: '/', external: false }]);
    } catch {
      setQuickItems([{ name: 'Sell Screen', url: '/', external: false }]);
    }
  }, [quickKey]);

  const saveQuickItems = (items) => {
    setQuickItems(items);
    try { localStorage.setItem(quickKey, JSON.stringify(items)); } catch { /* ignore */ }
  };

  const updateQuickItem = (idx, patch) =>
    saveQuickItems(quickItems.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const currentPinned = quickItems.some((i) => i.url === location.pathname);

  // Human-readable name for the current page, derived from the route
  // (reference adds directly with no prompt; rename later via the pencil dialog)
  const currentPageName = () => {
    if (location.pathname === '/') return 'Sell Screen';
    const seg = location.pathname.split('/').filter(Boolean).pop() || '';
    const name = decodeURIComponent(seg).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return name || document.title || location.pathname;
  };

  const handleStarClick = () => {
    if (currentPinned) {
      saveQuickItems(quickItems.filter((i) => i.url !== location.pathname));
    } else {
      saveQuickItems([...quickItems, { name: currentPageName(), url: location.pathname, external: false }]);
    }
  };

  const handleQuickItemClick = (item) => {
    setQuickOpen(false);
    if (!item.url) return;
    if (item.external) window.open(item.url, '_blank');
    else navigate(item.url);
  };

  // ── Volume (audio popover) ─────────────────────────────────────────────────
  const [volAnchorEl, setVolAnchorEl] = useState(null);
  const [volume, setVolume] = useState(() => {
    const defaults = { master: 100, shopfront: 100, masterMuted: false, shopfrontMuted: false };
    try { return { ...defaults, ...JSON.parse(localStorage.getItem('volumeSettings') || '{}') }; }
    catch { return defaults; }
  });

  const updateVolume = (patch) => {
    setVolume((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('volumeSettings', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const masterLevel = volume.masterMuted ? 0 : volume.master;

  // ── Online status + synchronise menu ───────────────────────────────────────
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncAnchorEl, setSyncAnchorEl] = useState(null);

  React.useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const handleExportLogging = () => {
    const log = {
      exportedAt: new Date().toISOString(),
      user: displayUser?.name || null,
      device: getDeviceName(),
      userAgent: navigator.userAgent,
      online: navigator.onLine,
      url: window.location.href,
      localStorageKeys: Object.keys(localStorage),
    };
    const blob = new Blob([JSON.stringify(log, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pos-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleClearLocalData = async () => {
    if (await confirm(
      'Clearing local data removes any outstanding sales and all other local data. You will need to log in again.',
      { title: 'Clear local data', confirmText: 'Clear and log out' }
    )) {
      try { localStorage.clear(); } catch { /* ignore */ }
      logout();
      navigate('/login');
    }
  };

  const syncButtons = [
    { label: 'Export Logging', icon: <DescriptionIcon />, bg: 'rgb(199,235,204)', accent: '#32b643', onClick: handleExportLogging },
    // ponytail: no offline sale queue locally — backup/upload report "nothing queued" like the reference does when empty
    { label: 'Offline Sale Backup', icon: <SaveOutlinedIcon />, bg: 'rgb(188,219,251)', accent: '#0284c7', onClick: () => alert('No offline sales to back up', 'info') },
    { label: 'Force Synchronisation', icon: <SyncIcon />, bg: 'rgb(188,219,251)', accent: '#0284c7', onClick: () => window.location.reload() },
    { label: 'Force Upload', icon: <CloudUploadIcon />, bg: 'rgb(188,219,251)', accent: '#0284c7', onClick: () => alert('Nothing queued to be uploaded', 'info') },
    { label: 'Clear Local Data', icon: <DeleteIcon />, bg: 'rgb(247,198,197)', accent: '#e33430', onClick: handleClearLocalData },
  ];

  // ── Notifications (bell-icon panel) ────────────────────────────────────────
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [receivingId, setReceivingId] = useState(null);

  const fetchNotifCount = React.useCallback(async () => {
    try {
      const r = await notificationService.getCount();
      // Bell dot = unread notifications (cleared by "Mark all as read"),
      // not status:'Pending' (that only clears when stock is received).
      setPendingCount(r.unread || 0);
    } catch { /* ignore */ }
  }, []);

  const refreshNotifications = async () => {
    setNotifLoading(true);
    try {
      const r = await notificationService.getNotifications({ limit: 50 });
      setNotifications(r.notifications || []);
      fetchNotifCount();
    } catch { /* ignore */ } finally {
      setNotifLoading(false);
    }
  };

  const handleNotifOpen = () => {
    setNotifOpen(true);
    refreshNotifications();
  };
  const handleNotifClose = () => setNotifOpen(false);

  const handleDeleteNotif = async (id) => {
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      fetchNotifCount();
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllRead();
      await refreshNotifications();
    } catch { /* ignore */ }
  };

  const handleReceiveStock = async (notif) => {
    if (!notif?.referenceId) return;
    setReceivingId(notif.id);
    try {
      await orderInvoiceService.receiveTransfer(notif.referenceId);
      apiClient.bustCache('/notifications');
      await refreshNotifications();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to receive stock');
    } finally {
      setReceivingId(null);
    }
  };

  React.useEffect(() => {
    fetchNotifCount();
    const t = setInterval(fetchNotifCount, 60000);
    return () => clearInterval(t);
  }, [fetchNotifCount]);

  const drawer = (
    <Box
      sx={{
        height: '100%',
        bgcolor: '#fff',
        display: 'flex',
        flexDirection: 'column',
        // Shopfront-style row overrides for the shared Sidebar (page-local, keeps Sidebar untouched)
        '& .MuiListItem-root': { marginTop: '4px', marginBottom: '4px' },
        '& .MuiListItemButton-root': {
          minHeight: 36,
          paddingTop: '4px',
          paddingBottom: '4px',
          borderRadius: 0,
          '&:hover': {
            backgroundColor: 'transparent',
            '& .MuiTypography-root': { color: '#737373' },
          },
        },
        // Reference: sub-items are the same 20px #171717 as top-level items
        '& .MuiListItemText-root .MuiTypography-root': { fontSize: 20, color: '#171717' },
        // Expanded group: parent label turns blue. Sidebar renders KeyboardArrowRight
        // (not ExpandLess) and its Collapse uses unmountOnExit, so a ListItem
        // immediately followed by a Collapse == expanded group.
        '& .MuiListItem-root:has(+ .MuiCollapse-root) > .MuiListItemButton-root .MuiListItemText-root .MuiTypography-root': {
          color: '#5ebbeb',
        },
      }}
    >
      <Box sx={{ overflow: 'auto', flex: 1 }}>
        <Sidebar onClick={handleDrawerToggle} />
      </Box>
      <Box sx={{ p: '8px 32px 16px', flexShrink: 0 }}>
        {['Channel: Release', `Version: ${APP_VERSION}`, `Device: ${getDeviceName()}`].map((line) => (
          <Typography key={line} sx={{ fontSize: 12, fontWeight: 400, color: '#a3a3a3' }}>
            {line}
          </Typography>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBarStyled position="fixed" sx={{ overflow: 'visible' }}>
        <Toolbar disableGutters sx={{ minHeight: `${HEADER_HEIGHT}px !important`, height: HEADER_HEIGHT, justifyContent: 'space-between', px: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', height: HEADER_HEIGHT }}>
            <Box
              onClick={handleDrawerToggle}
              role="button"
              aria-label={navDrawerOpen ? 'close drawer' : 'open drawer'}
              sx={headerCellSx}
            >
              {navDrawerOpen ? <CloseIcon sx={{ fontSize: 24 }} /> : <MenuIcon sx={{ fontSize: 24 }} />}
            </Box>
            {/* Cloud logo — HOVER opens the Quick Menu, CLICK navigates to the sell screen (reference) */}
            <ClickAwayListener onClickAway={() => setQuickOpen(false)}>
              <Box
                sx={{ position: 'relative', height: HEADER_HEIGHT }}
                onMouseEnter={() => setQuickOpen(true)}
                onMouseLeave={() => setQuickOpen(false)}
              >
                <Box
                  onClick={() => { setQuickOpen(false); navigate('/'); }}
                  role="button"
                  aria-label="quick menu"
                  sx={headerCellSx}
                >
                  <CloudIcon sx={{ fontSize: 30, color: '#fff' }} />
                </Box>
                {quickOpen && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      zIndex: 20,
                      animation: 'quickMenuIn 0.4s ease',
                      '@keyframes quickMenuIn': {
                        from: { opacity: 0, transform: 'translateY(-1rem)' },
                        to: { opacity: 1, transform: 'translateY(0)' },
                      },
                    }}
                  >
                    <Box sx={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '8px solid #f8f8f8', ml: '13px' }} />
                    <Box sx={{ bgcolor: '#f8f8f8', boxShadow: 'rgba(0,0,0,0.2) 0 0 4px, rgba(0,0,0,0.15) 0 2px 4px', borderRadius: 0, p: 1, minWidth: 200 }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Box
                          onClick={handleStarClick}
                          title={currentPinned ? 'Remove this page from the Quick Menu' : 'Add this page to the Quick Menu'}
                          sx={quickToolSx}
                        >
                          {currentPinned
                            ? <StarIcon sx={{ fontSize: 17 }} />
                            : <StarBorderIcon sx={{ fontSize: 17 }} />}
                        </Box>
                        <Box
                          onClick={() => { setQuickOpen(false); setQuickEditOpen(true); }}
                          title="Edit Quick Menu"
                          sx={quickToolSx}
                        >
                          <EditOutlinedIcon sx={{ fontSize: 17 }} />
                        </Box>
                      </Box>
                      {quickItems.map((item, idx) => (
                        <Box
                          key={idx}
                          onClick={() => handleQuickItemClick(item)}
                          sx={{
                            width: '100%',
                            height: 39,
                            boxSizing: 'border-box',
                            bgcolor: '#f8f8f8',
                            borderRadius: '6px',
                            color: '#313439',
                            fontSize: '19.2px',
                            p: '8px',
                            mt: 1,
                            cursor: 'pointer',
                            transition: 'background 0.2s ease-in-out',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            lineHeight: '23px',
                            '&:hover': { bgcolor: '#e8e8e8' },
                          }}
                        >
                          {item.name || item.url}
                        </Box>
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </ClickAwayListener>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', height: HEADER_HEIGHT }}>
            {/* Outlet is now picked in the Location Selector (step 1), the same
                place the register is picked — the navbar chip is gone. */}
            <RegisterSelectButton />

            {/* Volume — hidden for now; the popover and every volume handler stay wired. */}
            <Box
              onClick={(e) => setVolAnchorEl(e.currentTarget)}
              role="button"
              aria-label="volume"
              sx={{ ...headerCellSx, display: 'none' }}
            >
              {masterLevel === 0 ? (
                <VolumeOffIcon sx={{ fontSize: 24 }} />
              ) : (
                <VolumeUpIcon sx={{ fontSize: 24 }} />
              )}
            </Box>
            <Popover
              open={Boolean(volAnchorEl)}
              anchorEl={volAnchorEl}
              onClose={() => setVolAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{ paper: { sx: { width: 400, maxWidth: '95vw', bgcolor: 'rgb(248,248,248)', borderRadius: 0, boxShadow: 'rgba(0,0,0,0.2) 0 0 4px, rgba(0,0,0,0.15) 0 2px 4px', p: 2 } } }}
            >
              {[
                ['Master Volume', 'master', 'masterMuted'],
                ['Shopfront', 'shopfront', 'shopfrontMuted'],
              ].map(([label, key, mutedKey]) => (
                <Box key={key} sx={{ p: 2 }}>
                  <Typography component="span" sx={{ fontSize: 16, color: '#000' }}>{label}</Typography>
                  <Typography component="span" sx={{ fontSize: 14, color: 'rgb(128,128,128)' }}>
                    {` - ${volume[mutedKey] ? 0 : volume[key]}%`}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                    <VolumeDownIcon sx={{ fontSize: 24, color: '#313439' }} />
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={volume[mutedKey] ? 0 : volume[key]}
                      onChange={(e) => updateVolume({ [key]: Number(e.target.value), [mutedKey]: false })}
                      aria-label={`${label} level`}
                      style={{ flex: 1, height: 5, accentColor: '#5ebbeb' }}
                    />
                    <VolumeUpIcon sx={{ fontSize: 24, color: '#313439' }} />
                  </Box>
                  <Button
                    disableRipple
                    onClick={() => updateVolume({ [mutedKey]: !volume[mutedKey] })}
                    sx={{
                      mt: 1,
                      width: 90,
                      height: 29,
                      minWidth: 0,
                      bgcolor: '#f8f8f8',
                      border: '1px solid #000',
                      borderRadius: '6px',
                      color: '#000',
                      fontSize: 16,
                      textTransform: 'none',
                      lineHeight: 1,
                      p: 0,
                      '&:hover': { bgcolor: '#f8f8f8' },
                    }}
                  >
                    {volume[mutedKey] ? 'Unmute' : 'Mute'}
                  </Button>
                </Box>
              ))}
            </Popover>

            {/* Online status + synchronise menu */}
            <Box
              onClick={(e) => setSyncAnchorEl(e.currentTarget)}
              role="button"
              aria-label="online status"
              sx={{ minWidth: 100, height: HEADER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, cursor: 'pointer', px: 0.5 }}
            >
              <GlobeIcon sx={{ fontSize: 24, color: isOnline ? 'rgb(50,182,67)' : 'rgb(227,52,47)' }} />
              <Typography sx={{ fontSize: 16, color: isOnline ? 'rgb(50,182,67)' : 'rgb(227,52,47)' }}>
                {isOnline ? 'ONLINE' : 'OFFLINE'}
              </Typography>
            </Box>
            <Popover
              open={Boolean(syncAnchorEl)}
              anchorEl={syncAnchorEl}
              onClose={() => setSyncAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              slotProps={{
                paper: {
                  sx: {
                    width: 300,
                    bgcolor: 'rgb(248,248,248)',
                    borderRadius: 0,
                    boxShadow: 'rgba(0,0,0,0.2) 0 0 4px, rgba(0,0,0,0.15) 0 2px 4px',
                    p: 2,
                  },
                },
              }}
            >
              <Typography sx={{ fontSize: '14.4px', color: '#313439' }}>
                Please note, clearing local data or forcing a synchronise will <b>clear</b> any outstanding sales and all other local data.
              </Typography>
              <Typography sx={{ fontSize: '14.4px', color: '#313439', mt: 1 }}>
                Use these only if you know what you are doing
              </Typography>
              {syncButtons.map((b) => (
                <Button
                  key={b.label}
                  disableRipple
                  startIcon={b.icon}
                  onClick={() => { setSyncAnchorEl(null); b.onClick(); }}
                  sx={{
                    mt: 1,
                    width: 268,
                    maxWidth: '100%',
                    height: 51,
                    justifyContent: 'flex-start',
                    bgcolor: b.bg,
                    borderLeft: `4px solid ${b.accent}`,
                    borderRadius: 0,
                    color: '#313439',
                    fontSize: 16,
                    textTransform: 'none',
                    px: 1.5,
                    '&:hover': { bgcolor: b.bg },
                    '& .MuiSvgIcon-root': { color: '#313439' },
                  }}
                >
                  {b.label}
                </Button>
              ))}
            </Popover>

            {/* Notification bell */}
            <Box
              onClick={handleNotifOpen}
              role="button"
              aria-label="notifications"
              sx={headerCellSx}
            >
              <Badge
                variant="dot"
                invisible={pendingCount === 0}
                sx={{ '& .MuiBadge-badge': { bgcolor: 'rgb(227,52,47)', width: 8, height: 8, minWidth: 8, borderRadius: '50%' } }}
              >
                <NotificationsIcon sx={{ fontSize: 24 }} />
              </Badge>
            </Box>

            {/* Avatar + name */}
            <Box
              onClick={handleAvatarClick}
              role="button"
              title="Profile"
              sx={{ height: HEADER_HEIGHT, display: 'flex', alignItems: 'center', gap: 1, px: 1.5, cursor: 'pointer' }}
            >
              <Avatar
                src={avatarSrc}
                sx={{ width: 34, height: 34, bgcolor: '#1976d2', fontSize: 13 }}
              >
                {!avatarSrc && getUserInitials()}
              </Avatar>
              {displayUser?.name && (
                <Typography sx={{ fontSize: 16, color: '#f8f8f8', whiteSpace: 'nowrap' }}>
                  {displayUser.name}
                </Typography>
              )}
            </Box>
          </Box>
        </Toolbar>
        <TopProgressBar variant="appBar" />
      </AppBarStyled>

      {/* Left navigation drawer (below the 50px header, reference-style) */}
      <Drawer
        variant="temporary"
        open={navDrawerOpen}
        onClose={handleDrawerToggle}
        transitionDuration={150}
        SlideProps={{ easing: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
        ModalProps={{
          keepMounted: true,
          // Reference dims the page below the 50px topbar (rgba(0,0,0,0.4), 0.15s).
          BackdropProps: {
            transitionDuration: 150,
            sx: { top: HEADER_HEIGHT, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
          },
        }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            maxWidth: '90%',
            top: HEADER_HEIGHT,
            height: `calc(100% - ${HEADER_HEIGHT}px)`,
            bgcolor: '#fff',
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Notifications right drawer */}
      <Drawer
        anchor="right"
        open={notifOpen}
        onClose={handleNotifClose}
        transitionDuration={150}
        ModalProps={{
          BackdropProps: {
            transitionDuration: 150,
            sx: { top: HEADER_HEIGHT, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
          },
        }}
        PaperProps={{
          sx: {
            width: 500,
            maxWidth: '100vw',
            top: HEADER_HEIGHT,
            height: `calc(100% - ${HEADER_HEIGHT}px)`,
            borderRadius: 0,
            boxShadow:
              '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 20, fontWeight: 700 }}>Notifications</Typography>
          <IconButton size="small" disableRipple onClick={refreshNotifications} aria-label="refresh notifications" sx={{ ml: 0.5 }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Button
            disableRipple
            onClick={handleMarkAllRead}
            disabled={notifications.length === 0}
            sx={{ ml: 'auto', fontSize: 16, fontWeight: 700, color: 'rgb(112,112,112)', textTransform: 'none' }}
          >
            Mark All as Read
          </Button>
        </Box>
        <Divider />
        {notifLoading ? (
          <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>
        ) : notifications.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
            <Typography variant="body2">No notifications</Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, overflowY: 'auto', flex: 1 }}>
            {notifications.map((n) => {
              const isPendingTransfer = n.type === 'STOCK_TRANSFER' && n.status === 'Pending';
              return (
                <ListItem
                  key={n.id}
                  alignItems="flex-start"
                  sx={{ borderBottom: '1px solid #f0f0f0' }}
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {!n.readAt && (
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#5ebbeb' }} />
                      )}
                      <IconButton edge="end" size="small" disableRipple onClick={() => handleDeleteNotif(n.id)} aria-label="delete notification">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  }
                >
                  <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                    <MoveToInboxIcon sx={{ color: '#5ebbeb' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={<Typography sx={{ fontSize: 16, fontWeight: 700, pr: 5 }}>{n.title}</Typography>}
                    secondaryTypographyProps={{ component: 'div' }}
                    secondary={
                      <>
                        <Typography variant="caption" color="text.secondary">{timeAgo(n.createdAt)}</Typography>
                        <Typography variant="body2" color="text.primary" sx={{ mt: 0.5 }}>{n.message}</Typography>
                        {isPendingTransfer && (
                          <Button
                            size="small"
                            variant="contained"
                            sx={{ mt: 1, textTransform: 'none' }}
                            disabled={receivingId === n.id}
                            onClick={() => handleReceiveStock(n)}
                          >
                            {receivingId === n.id ? 'Receiving…' : 'Receive Stock'}
                          </Button>
                        )}
                        {n.type === 'STOCK_TRANSFER' && n.status === 'Received' && (
                          <Chip size="small" label="Received" color="success" sx={{ mt: 1 }} />
                        )}
                        {n.status === 'Cancelled' && (
                          <Chip size="small" label="Cancelled" sx={{ mt: 1 }} />
                        )}
                      </>
                    }
                  />
                </ListItem>
              );
            })}
          </List>
        )}
      </Drawer>

      {/* Quick Menu editor */}
      <Dialog open={quickEditOpen} onClose={() => setQuickEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Quick Menu</DialogTitle>
        <DialogContent>
          {quickItems.map((item, idx) => (
            <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, mt: idx === 0 ? 1 : 0 }}>
              <TextField
                label="Name"
                size="small"
                value={item.name}
                onChange={(e) => updateQuickItem(idx, { name: e.target.value })}
                sx={{ ...quickInputSx, width: 180 }}
              />
              <TextField
                label="URL"
                size="small"
                value={item.url}
                onChange={(e) => updateQuickItem(idx, { url: e.target.value })}
                sx={{ ...quickInputSx, flex: 1 }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <ShopfrontSwitch
                  checked={!!item.external}
                  onChange={(e) => updateQuickItem(idx, { external: e.target.checked })}
                />
                <Typography sx={{ fontSize: 13, color: '#676b72' }}>External</Typography>
              </Box>
              <IconButton size="small" onClick={() => saveQuickItems(quickItems.filter((_, i) => i !== idx))} aria-label="delete quick menu item">
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            onClick={() => saveQuickItems([...quickItems, { name: '', url: '/', external: false }])}
            sx={{ textTransform: 'none', color: '#5ebbeb', fontWeight: 700 }}
          >
            + Add
          </Button>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setQuickEditOpen(false)}
            sx={{
              bgcolor: '#5ebbeb',
              color: '#fff',
              borderRadius: '12px',
              height: 42,
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              px: 3,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
            }}
          >
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Main>
        <DrawerHeader />
        {teamMessage && (
          <Box
            sx={{
              bgcolor: '#171717',
              color: '#fff',
              fontSize: 14,
              px: 2,
              py: 1,
              '& a': { color: '#5ebbeb' },
            }}
            dangerouslySetInnerHTML={{ __html: teamMessage }}
          />
        )}
        {/* Remount the routed page whenever the selected outlet changes so every
            page refetches its data scoped to the new outlet (apiClient attaches
            outletId to all GETs for super admins). */}
        <React.Fragment key={selectedOutletId ?? 'all'}>{children}</React.Fragment>
      </Main>

      {/* Blocks the whole app if another user takes control of our register. */}
      <RegisterTakeoverWatcher />

      {/* Mounted once, OUTSIDE the outlet-keyed Fragment above, so picking an
          outlet in step 1 doesn't unmount the dialog mid-flow. */}
      <LocationSelectorDialog />

      {/* Profile sidebar */}
      <ProfileDrawer
        open={profileDrawerOpen}
        onClose={() => setProfileDrawerOpen(false)}
        user={displayUser}
        onModifyUser={handleModifyUser}
        onLogout={handleLogout}
        theme={themeMode}
        onThemeChange={setThemeMode}
      />

    </Box>
  );
};

export default DashboardLayout;
