import React, { useState, useEffect, useCallback } from 'react';
import {
  Drawer,
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
} from '@mui/material';
import { SettingsOutlined as SettingsIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import apiClient from '../../services/apiClient';
import { THEME_MODES } from '../../contexts/themeMode';

// Slate label colour, lightened in dark mode
const slate = (t) => (t.palette.mode === 'dark' ? '#e8eaed' : '#313439');

// Reference: right-side drawer below the 50px bar, 500px wide, white
const DRAWER_WIDTH = 500;
const HEADER_HEIGHT = 50;

// Format currency compactly on the Y-axis
const fmtCurrency = (v) => `$${Number(v).toFixed(2)}`;

// Build an array of {label, date} for the last N days
function lastNDays(n) {
  const days = [];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({
      label: dayNames[d.getDay()],
      dateStr: d.toISOString().slice(0, 10),
      revenue: 0,
      count: 0,
    });
  }
  return days;
}

const ProfileDrawer = ({ open, onClose, onModifyUser, onLogout, theme, onThemeChange }) => {
  const [chartData, setChartData] = useState(lastNDays(7));

  const loadChartData = useCallback(async () => {
    try {
      const endDate = new Date().toISOString().slice(0, 10);
      const startDate = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
      const resp = await apiClient.get('/sales/summary', {
        params: { startDate, endDate, groupBy: 'day' },
      });
      const rows = resp.data?.data || resp.data?.summary || [];
      const base = lastNDays(7);
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
          bgcolor: 'background.paper',
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
            <SettingsIcon sx={{ fontSize: 20, color: slate }} />
            <Typography sx={{ fontSize: 16, color: slate }}>Theme</Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <Select
              value={theme}
              onChange={(e) => onThemeChange(e.target.value)}
              sx={{
                fontSize: 14,
                borderRadius: '8px',
                '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: 1 },
                '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#676b72' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={fmtCurrency}
                tick={{ fontSize: 10, fill: '#676b72' }}
                axisLine={false}
                tickLine={false}
                width={50}
              />
              <Tooltip
                formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Revenue']}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
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
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#676b72' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#676b72' }}
                axisLine={false}
                tickLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip
                formatter={(v) => [v, 'Transactions']}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 6 }}
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
            border: '1px solid #5ebbeb',
            color: '#5ebbeb',
            bgcolor: 'transparent',
            '&:hover': { bgcolor: 'rgba(94,187,235,0.08)', border: '1px solid #4aa9dd' },
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
            color: '#fff',
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
