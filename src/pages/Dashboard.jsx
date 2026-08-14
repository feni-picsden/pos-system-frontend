import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { useNavigate } from 'react-router-dom';
import FavouriteReportPreview from '../components/Dashboard/FavouriteReportPreview';
import dashboardLayoutService from '../services/dashboardLayoutService';
import { useSelectedOutlet } from '../contexts/SelectedOutletContext';
import { useAuth } from '../contexts/AuthContext';
import posLocalDb from '../services/posLocalDb';

const GRID_COLS = 10;

const Dashboard = () => {
  const navigate = useNavigate();
  const { selectedOutletId } = useSelectedOutlet();
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

    setLoading(true);
    load();
    return () => {
      mounted = false;
    };
  }, [selectedOutletId]);

  const visibleWidgets = widgets.filter((w) => w?.favouriteReport);

  return (
    <Box
      sx={{
        display: 'flex',
        height: 'calc(100vh - 50px)',
        minHeight: 480,
        bgcolor: '#fff',
        p: 2.5,
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
        {!loading && !error && visibleWidgets.length === 0 && (
          <Box sx={{ gridColumn: '1 / -1', p: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              No reports on dashboard
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click Edit to add and save dashboard items.
            </Typography>
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
            <Typography variant="h6" sx={{ fontSize: 18, fontWeight: 700, color: '#000', mb: 0.5 }}>
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

      {/* Right-edge slide-out rail (matches reference: icon square peeks out, hover slides the label in) */}
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
          component="button"
          onClick={() => navigate('/dashboard/customize')}
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
