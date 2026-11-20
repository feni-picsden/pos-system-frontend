import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { Link as RouterLink } from 'react-router-dom';
import FavouriteReportPreview from '../components/Dashboard/FavouriteReportPreview';
import dashboardLayoutService from '../services/dashboardLayoutService';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { useSelectedRegister } from '../contexts/SelectedRegisterContext';
import { useAuth } from '../contexts/AuthContext';
import posLocalDb from '../services/posLocalDb';
import { byMode } from '../theme/sfPalette';

const GRID_COLS = 10;

const Dashboard = () => {
  const { selectedOutletId, isAllOutlets } = useSelectedOutlet();
  const { openLocationSelector } = useSelectedRegister();
  const { user } = useAuth();
  const [widgets, setWidgets] = useState([]);
  const [gridRows, setGridRows] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const cacheKey = `layout_${selectedOutletId ?? 'default'}`;

    const load = async () => {
      setError('');
      await posLocalDb.init();

      // Serve from IDB immediately
      const all = await posLocalDb.getStoreAll('dashboardLayouts');
      const cached = all.find((r) => r.key === cacheKey);
      if (cached?.widgets && mounted) {
        setWidgets(cached.widgets);
        setGridRows(cached.rows || 5);
        setLoading(false);
      }

      // Always refresh in background (layout changes when user edits)
      const stale = await posLocalDb.isStoreStale('dashboardLayouts', 60 * 1000);
      if (stale || !cached) {
        try {
          const params = {};
          if (selectedOutletId != null) params.outletId = selectedOutletId;
          const response = await dashboardLayoutService.getLayout(params);
          const freshWidgets = Array.isArray(response?.data?.widgets) ? response.data.widgets : [];
          const freshRows = response?.data?.rows || 5;
          await posLocalDb.putStoreItem('dashboardLayouts', { key: cacheKey, widgets: freshWidgets, rows: freshRows });
          if (mounted) {
            setWidgets(freshWidgets);
            setGridRows(freshRows);
            setLoading(false);
          }
        } catch (e) {
          if (mounted && !cached) {
            setWidgets([]);
            setError(e?.response?.data?.error || e?.message || 'Failed to load dashboard layout');
            setLoading(false);
          }
        }
      }

      if (mounted) setLoading(false);
    };

    // Dashboards are per outlet; "All Outlets" mode has none to load (the server
    // would answer 400), so the page asks for an outlet instead.
    if (isAllOutlets) {
      setWidgets([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    load();
    return () => {
      mounted = false;
    };
  }, [selectedOutletId, isAllOutlets]);

  const visibleWidgets = widgets.filter((w) => w?.favouriteReport);

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'calc(100vh - 50px)',
        minHeight: 480,
        // All Outlets: the whole page is the sell screen's "no register" pane.
        bgcolor: isAllOutlets ? byMode('#4a4e52', '#050505') : byMode('#fff', '#121212'),
        p: isAllOutlets ? 0 : 2.5,
        '@media print': { height: 'auto', minHeight: 0 },
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${gridRows}, minmax(64px, 1fr))`,
          gap: 0,
        }}
      >
        {loading && (
          <Box sx={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress size={32} />
          </Box>
        )}
        {!loading && error && (
          <Box sx={{ gridColumn: '1 / -1', p: 2 }}>
            <Typography variant="body2" color="error">
              {error}
            </Typography>
          </Box>
        )}
        {!loading && isAllOutlets && (
          <Box
            sx={{
              gridColumn: '1 / -1',
              gridRow: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              textAlign: 'center',
              px: 2,
            }}
          >
            <Typography sx={{ color: '#f8f8f8', fontSize: 48, fontWeight: 400, lineHeight: 1.2 }}>
              You currently don't have an outlet selected.
            </Typography>
            <Box
              component="button"
              onClick={() => openLocationSelector({ force: true, step: 'outlet' })}
              sx={{
                bgcolor: byMode('transparent', '#313439'),
                border: '1px solid currentColor',
                color: '#f8f8f8',
                fontSize: 32,
                borderRadius: 0,
                padding: '4px 8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'inherit',
                lineHeight: 1.2,
              }}
            >
              <StorefrontOutlinedIcon sx={{ fontSize: 20 }} />
              Select Outlet
            </Box>
          </Box>
        )}
        {!loading && !error && !isAllOutlets && visibleWidgets.length === 0 && (
          <Box
            sx={{
              gridColumn: '1 / -1',
              gridRow: '1 / -1',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
            }}
          >
            <Typography sx={{ fontSize: 36, fontWeight: 400, color: byMode('#606f7b', '#bdbdbd'), lineHeight: 1.2 }}>
              No User Dashboard
            </Typography>
            <Box
              component={RouterLink}
              to="/dashboard/customize"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                height: 30,
                px: '10px',
                bgcolor: '#16a34a',
                color: '#fff',
                fontSize: 16,
                textDecoration: 'none',
                borderRadius: 0,
                '&:hover': { bgcolor: '#15803d' },
              }}
            >
              <EditOutlinedIcon sx={{ fontSize: 18 }} />
              Edit
            </Box>
          </Box>
        )}
        {!loading && !error && visibleWidgets.map((w) => (
          <Box
            key={w.id}
            sx={{
              gridColumn: `${w.x + 1} / span ${w.w}`,
              gridRow: `${w.y + 1} / span ${w.h}`,
              m: 0.25,
              p: 0.25,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, color: byMode('#000', '#f8f8f8'), mb: 0.5 }}>
              {w.favouriteReport
                ? `${w.favouriteReport.name}${w.favouriteReport.user && w.favouriteReport.user.id !== user?.id ? `(${w.favouriteReport.user.name})` : ''}`
                : 'Dashboard item'}
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <FavouriteReportPreview favouriteReport={w.favouriteReport} filterByUser={w.filterByUser} />
            </Box>
          </Box>
        ))}
      </Box>

      {/* Right-edge slide-out rail (matches reference: icon square peeks out, hover slides the label in).
          In All Outlets mode Edit opens the Location Selector (pick an outlet first). */}
      <Box
        sx={{
          position: 'fixed',
          top: 78,
          right: 0,
          zIndex: 1050,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'none',
          displayPrint: 'none',
        }}
      >
        <Box
          component={isAllOutlets ? 'button' : RouterLink}
          to={isAllOutlets ? undefined : '/dashboard/customize'}
          onClick={isAllOutlets ? () => openLocationSelector({ force: true, step: 'outlet' }) : undefined}
          aria-label="Edit dashboard"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            // It is an <a> now (so it can be opened in a new tab); keep it
            // looking exactly like the button it replaced.
            textDecoration: 'none',
            color: '#fff',
            bgcolor: '#16a34a',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <EditOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Edit</Box>
        </Box>
        <Box
          component="button"
          onClick={() => window.print()}
          aria-label="Print dashboard"
          sx={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            width: 144,
            height: 44,
            p: 0,
            border: 0,
            borderRadius: 0,
            cursor: 'pointer',
            color: '#fff',
            bgcolor: '#404040',
            transform: 'translateX(96px)',
            transition: 'transform 300ms',
            '&:hover': { transform: 'translateX(0)' },
          }}
        >
          <Box sx={{ width: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PrintOutlinedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ width: 96, textAlign: 'left', fontSize: 18, fontFamily: 'inherit' }}>Print</Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Dashboard;
