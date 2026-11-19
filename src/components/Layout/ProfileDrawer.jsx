import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  useTheme,
} from '@mui/material';
import { SettingsOutlined as SettingsIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../../services/apiClient';
import { appTimeZone } from '../../utils/appDateTime';
import { zonedParts } from '../../utils/dateFormat';
import { THEME_MODES } from '../../contexts/themeMode';
import { byMode } from '../../theme/sfPalette';

// Slate label colour, lightened in dark mode
const slate = (t) => (t.palette.mode === 'dark' ? '#e8eaed' : '#313439');

// Reference: right-side drawer below the 50px bar, 500px wide, white
const DRAWER_WIDTH = 500;
const HEADER_HEIGHT = 50;

// Format currency compactly on the Y-axis
const fmtCurrency = (v) => `$${Number(v).toFixed(2)}`;

// STORE calendar dates (Setup > General > Timezone) as YYYY-MM-DD - the same
// days /sales/summary buckets by, whatever the browser's zone is.
// Build an array of {label, date} for the last N store days.
function lastNDays(n) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const t = zonedParts(new Date(), appTimeZone());
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(t.year, t.month - 1, t.day - i));
    days.push({
      label: dayNames[d.getUTCDay()],
      dateStr: d.toISOString().slice(0, 10),
      revenue: 0,
      count: 0,
    });
  }
  return days;
}

const ProfileDrawer = ({ open, onClose, onModifyUser, onLogout, theme, onThemeChange }) => {
  const [chartData, setChartData] = useState(lastNDays(7));
  // recharts takes plain colours, not sx tokens
  const muiTheme = useTheme();
  const sf = muiTheme.palette.sf;
  const isDark = muiTheme.palette.mode === 'dark';
  // Reference dark (profile drawer): #f8f8f8 axis labels, #7e7e7e vertical grid
  const tickFill = isDark ? '#f8f8f8' : sf.textMuted;
  const darkGrid = isDark ? <CartesianGrid vertical horizontal={false} stroke="#7e7e7e" /> : null;
  const tooltipStyle = { fontSize: 12, borderRadius: 6, backgroundColor: sf.paper, borderColor: sf.borderLight, color: sf.text };

  const loadChartData = useCallback(async () => {
    try {
      const base = lastNDays(7);
      const startDate = base[0].dateStr;
      const endDate = base[base.length - 1].dateStr;
      const resp = await apiClient.get('/sales/summary', {
        params: { startDate, endDate, groupBy: 'day' },
      });
      const rows = resp.data?.data || resp.data?.summary || [];
      rows.forEach((row) => {
        const dateStr = (row.date || row.saleDate || '').slice(0, 10);
        const idx = base.findIndex((d) => d.dateStr === dateStr);
        if (idx !== -1) {
          base[idx].revenue = Number(row.revenue || row.totalRevenue || 0);
          base[idx].count = Number(row.count || row.transactionCount || 0);
        }
      });
      setChartData(base);
    } catch {
      // If the summary endpoint doesn't exist, keep zeros – no error shown to user
      setChartData(lastNDays(7));
    }
  }, []);

  useEffect(() => {
    if (open) loadChartData();
  }, [open, loadChartData]);

  const actionButtonSx = {
    width: 202,
    height: 42,
    borderRadius: '12px',
    fontWeight: 700,
    fontSize: 16,
    textTransform: 'none',
    boxShadow: 'none',
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      transitionDuration={150}
      ModalProps={{
        BackdropProps: {
          transitionDuration: 150,
          sx: { top: HEADER_HEIGHT, backgroundColor: 'rgba(0, 0, 0, 0.4)' },
        },
      }}
      PaperProps={{
        sx: {
          width: DRAWER_WIDTH,
          maxWidth: '100vw',
          top: HEADER_HEIGHT,
          height: `calc(100% - ${HEADER_HEIGHT}px)`,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: byMode('background.paper', '#202020'),
          borderRadius: 0,
          boxShadow:
            '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        },
      }}
    >
      <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Theme row */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SettingsIcon sx={{ fontSize: 20, color: (t) => (t.palette.mode === 'dark' ? '#5ebbeb' : slate(t)) }} />
            <Typography sx={{ fontSize: 16, color: slate }}>Theme</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              sx={{
                fontSize: 14,
                borderRadius: '8px',
                bgcolor: byMode('transparent', '#121212'),
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'sf.border', borderWidth: 1 },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'sf.border' },
                // Reference dark: the open select's outline is #eeeeee, not the blue focus colour
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: byMode('sf.borderStrong', '#eeeeee'), borderWidth: 2 },
              }}
              // Reference dark list: #232323 paper with a 1px white edge; the focused /
              // hovered option is #0084d1 with #fafafa text. Light keeps MUI's defaults.
              MenuProps={{
                PaperProps: {
                  sx: (t) => (t.palette.mode === 'dark' ? {
                    bgcolor: '#232323',
                    border: '1px solid #ffffff',
                    '& .MuiMenuItem-root': { color: '#f8f8f8' },
                    '& .MuiMenuItem-root.Mui-selected': { bgcolor: 'transparent' },
                    '& .MuiMenuItem-root:hover, & .MuiMenuItem-root.Mui-focusVisible, & .MuiMenuItem-root.Mui-selected:hover, & .MuiMenuItem-root.Mui-selected.Mui-focusVisible': { bgcolor: '#0084d1', color: '#fafafa' },
                    // only one row lit: while the mouse is over the list, the hovered row wins
                    '&:hover .MuiMenuItem-root.Mui-focusVisible:not(:hover)': { bgcolor: 'transparent', color: '#f8f8f8' },
                  } : {}),
                },
              }}
            >
              {THEME_MODES.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Revenue chart */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: slate, textAlign: 'center' }}>
            Revenue
          </Typography>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              {darkGrid}
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: tickFill }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCurrency}
                tick={{ fontSize: 10, fill: tickFill }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
                labelStyle={{ fontSize: 12, color: sf.text }}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#5ebbeb"
                strokeWidth={2}
                dot={{ r: 3, fill: '#5ebbeb' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>

        {/* Transaction count chart */}
        <Box>
          <Typography sx={{ fontSize: 16, fontWeight: 700, mb: 1, color: slate, textAlign: 'center' }}>
            Transaction Count
          </Typography>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              {darkGrid}
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: tickFill }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: tickFill }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [v, 'Transactions']}
                labelStyle={{ fontSize: 12, color: sf.text }}
                contentStyle={tooltipStyle}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#5ebbeb"
                strokeWidth={2}
                dot={{ r: 3, fill: '#5ebbeb' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      {/* Action buttons — reference: outlined blue Modify User + filled #5ebbeb Logout, 202x42 */}
      <Box sx={{ p: 2, display: 'flex', gap: 1.5, justifyContent: 'space-between' }}>
        <Button
          disableRipple
          onClick={onModifyUser}
          sx={{
            ...actionButtonSx,
            // Reference dark: #74d4ff outline + text
            border: byMode('1px solid #5ebbeb', '1px solid #74d4ff'),
            color: byMode('#5ebbeb', '#74d4ff'),
            bgcolor: 'transparent',
            '&:hover': { bgcolor: 'rgba(94,187,235,0.08)', border: byMode('1px solid #4aa9dd', '1px solid #a3e4ff') },
          }}
        >
          Modify User
        </Button>
        <Button
          disableRipple
          onClick={onLogout}
          sx={{
            ...actionButtonSx,
            bgcolor: '#5ebbeb',
            color: byMode('#fff', '#232323'),
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
          }}
        >
          Logout
        </Button>
      </Box>
    </Drawer>
  );
};

export default ProfileDrawer;
