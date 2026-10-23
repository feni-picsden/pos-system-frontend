import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { ArrowBack as BackIcon } from '@mui/icons-material';
import { format } from 'date-fns';
import favouriteReportService from '../../services/favouriteReportService';

// Reference "Report Revision History" (Favourite Reports > View > Revisions):
//   [<- Back] Report Revision History
//   bordered table Field | From | To | User | Timestamp, sticky header,
//   "Please Note: Revisions may take up to five minutes to appear",
//   emailSettings rows = nested Field/Value tables (Address list, Period, Anchor,
//   Orientation, Type) with the changed cells red (From) / green (To);
//   nextEmailDate rows = plain "2025-01-08 13:59:59" -> "2025-01-09 13:59:59".
const SETTING_ROWS = [
  ['address', 'Address'],
  ['period', 'Period'],
  ['anchor', 'Anchor'],
  ['orientation', 'Orientation'],
  ['type', 'Type'],
];
const FROM_BG = '#f8d7da';
const TO_BG = '#d4edda';
const BORDER = '1px solid #000';

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const text = (v) => {
  if (v === null || v === undefined || v === '') return '';
  if (Array.isArray(v)) return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

const SettingsTable = ({ value, other, isFrom }) => {
  if (!value || typeof value !== 'object') return <span>{text(value)}</span>;
  return (
    <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', border: BORDER, '& th, & td': { border: BORDER, px: 1, py: '6px', fontSize: 16, textAlign: 'left', verticalAlign: 'middle' }, '& th': { fontWeight: 700, textAlign: 'center' } }}>
      <thead><tr><th style={{ width: '30%' }}>Field</th><th>Value</th></tr></thead>
      <tbody>
        {SETTING_ROWS.filter(([k]) => value[k] !== undefined).map(([k, label]) => {
          const changed = !same(value[k], other?.[k]);
          const bg = changed ? (isFrom ? FROM_BG : TO_BG) : 'transparent';
          const v = text(value[k]);
          return (
            <tr key={k}>
              <td style={{ background: bg }}>{label}</td>
              <td style={{ background: bg }}>{Array.isArray(v) ? v.map((line, i) => <div key={i}>{line}</div>) : v}</td>
            </tr>
          );
        })}
      </tbody>
    </Box>
  );
};

const FavouriteReportRevisions = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    favouriteReportService.getRevisions(id)
      .then((res) => { if (alive) setRows(res?.data || []); })
      .catch((e) => { if (alive) setError(e.response?.data?.error || 'Failed to load revisions'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const cell = (row, isFrom) => {
    const value = isFrom ? row.from : row.to;
    const other = isFrom ? row.to : row.from;
    if (row.field === 'emailSettings') return <SettingsTable value={value} other={other} isFrom={isFrom} />;
    const v = text(value);
    return Array.isArray(v) ? v.join(', ') : v;
  };

  return (
    <Box sx={{ p: '8px 12px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Button
          disableElevation
          startIcon={<BackIcon />}
          onClick={() => navigate(-1)}
          sx={{ bgcolor: '#1e88e5', color: '#fff', fontSize: 26, fontWeight: 400, textTransform: 'none', borderRadius: 0, px: 2, py: 0.25, '&:hover': { bgcolor: '#1976d2' } }}
        >
          Back
        </Button>
        <Typography component="h1" sx={{ fontSize: 30, fontWeight: 700, color: '#000' }}>Report Revision History</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : error ? (
        <Box sx={{ bgcolor: 'rgb(227,52,47)', color: '#fff', px: 2, py: 1.5, fontSize: 15 }}>{error}</Box>
      ) : (
        <Box sx={{ maxHeight: 'calc(100vh - 140px)', overflow: 'auto', border: BORDER }}>
          <Box component="table" sx={{ borderCollapse: 'collapse', width: '100%', '& th, & td': { border: BORDER, px: 1, py: '8px', fontSize: 16, color: '#000', verticalAlign: 'middle' }, '& th': { fontWeight: 700, textAlign: 'center', bgcolor: '#fff', position: 'sticky', top: 0, zIndex: 1, boxShadow: 'inset 0 -1px 0 #000, inset 0 1px 0 #000' } }}>
            <thead>
              <tr>
                <th style={{ width: '11.5%' }}>Field</th>
                <th style={{ width: '31.5%' }}>From</th>
                <th style={{ width: '31.5%' }}>To</th>
                <th style={{ width: '8.5%' }}>User</th>
                <th style={{ width: '17%' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              <tr><td colSpan={5} style={{ textAlign: 'center' }}>Please Note: Revisions may take up to five minutes to appear</td></tr>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.field}</td>
                  <td style={{ padding: row.field === 'emailSettings' ? 8 : undefined }}>{cell(row, true)}</td>
                  <td style={{ padding: row.field === 'emailSettings' ? 8 : undefined }}>{cell(row, false)}</td>
                  <td>{row.user}</td>
                  <td>{row.timestamp ? format(new Date(row.timestamp), 'dd/MM/yyyy HH:mm:ss') : ''}</td>
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default FavouriteReportRevisions;
