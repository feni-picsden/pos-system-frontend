import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Dialog, Button, TextField, Box, Typography, MenuItem, Select } from '@mui/material';
import { HelpOutline as HelpIcon, ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import favouriteReportService from '../../services/favouriteReportService';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Reference "Save Report" dialog:
//   ? Save Report (light-blue header)
//   Report Name [Sales by Outlet]
//   (o) Dynamic Time Period           — only on reports with a Date and Time block
//       (Note: The report will be modified)
//       Amount [1]   Period [Day(s) v]
//       (o) Include today
//   Cancel   Save
// Opened from Favourite Reports > View (favouriteId in the URL) it pre-fills the
// saved name / dynamic settings and UPDATES that favourite instead of creating one.
const DYNAMIC_PERIODS = ['Day(s)', 'Week(s)', 'Month(s)', 'Year(s)'];

const FIELD_SX = {
  '& .MuiOutlinedInput-root': { borderRadius: '8px', height: 42, fontSize: 16, bgcolor: '#fff' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' },
  '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 },
};
const LABEL_SX = { fontSize: 14, color: '#000', mb: 0.5 };

// alwaysDynamic: reports whose reference dialog has no "Dynamic Time Period"
// switch (Product Revision History) — Amount / Period / Include today show
// straight away and the saved favourite is always dynamic.
const SaveReportDialog = ({ open, onClose, reportType, reportPath, filters, defaultName = '', dynamicAllowed = true, alwaysDynamic = false }) => {
  const { selectedOutletId } = useSelectedOutlet();
  const [searchParams] = useSearchParams();
  const favouriteId = searchParams.get('favouriteId');
  const [name, setName] = useState('');
  const [dynamic, setDynamic] = useState(false);
  const [amount, setAmount] = useState('1');
  const [period, setPeriod] = useState('Day(s)');
  const [includeToday, setIncludeToday] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Reset on every open: saved favourite → its values, otherwise the page default name.
  useEffect(() => {
    if (!open) return;
    setError('');
    setDynamic(alwaysDynamic); setAmount('1'); setPeriod('Day(s)'); setIncludeToday(alwaysDynamic);
    setName(defaultName || '');
    if (!favouriteId) return;
    let alive = true;
    favouriteReportService.getById(favouriteId).then((res) => {
      if (!alive || !res?.data) return;
      const fav = res.data;
      setName(fav.name || defaultName || '');
      const dyn = fav.filters?.dynamic;
      if (dyn && dynamicAllowed) {
        setDynamic(true);
        setAmount(String(dyn.amount ?? 1));
        setPeriod(DYNAMIC_PERIODS.includes(dyn.period) ? dyn.period : 'Day(s)');
        setIncludeToday(!!dyn.includeToday);
      }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, favouriteId]);

  const handleSave = async () => {
    if (!name.trim()) { setError('Report name is required'); return; }
    const amt = parseInt(amount, 10);
    if (dynamic && (!Number.isFinite(amt) || amt < 1)) { setError('Amount must be 1 or more'); return; }
    setLoading(true);
    setError('');
    const payloadFilters = { ...(filters || {}), dynamic: dynamicAllowed && dynamic ? { amount: amt, period, includeToday } : null };
    try {
      if (favouriteId) {
        await favouriteReportService.update(favouriteId, { name: name.trim(), filters: payloadFilters });
      } else {
        await favouriteReportService.create({
          name: name.trim(),
          reportType,
          reportPath,
          filters: payloadFilters,
          ...(selectedOutletId != null ? { outletId: selectedOutletId } : {}),
        });
      }
      onClose(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save report');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => { setError(''); onClose(false); };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      PaperProps={{ elevation: 0, sx: { width: 470, maxWidth: '95vw', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0,0,0,.2), 0 8px 10px -6px rgba(0,0,0,.2)' } }}
    >
      <Box sx={{ bgcolor: '#bfe3f8', color: '#0c4a6e', display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 2, fontSize: 18, fontWeight: 700 }}>
        <HelpIcon sx={{ fontSize: 22, color: '#0284c7' }} />
        Save Report
      </Box>
      <Box sx={{ px: 2, pt: 2.5, pb: 2 }}>
        <Typography sx={LABEL_SX}>Report Name</Typography>
        <TextField
          fullWidth
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={!!error}
          helperText={error || undefined}
          autoFocus
          sx={{ ...FIELD_SX, mb: 2 }}
          inputProps={{ maxLength: 120 }}
        />

        {dynamicAllowed && (
          <>
            {!alwaysDynamic && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: dynamic ? 1.5 : 0 }}>
                <ShopfrontSwitch checked={dynamic} onChange={(e) => setDynamic(e.target.checked)} />
                <Typography sx={{ fontSize: 16, color: '#000' }}>Dynamic Time Period</Typography>
              </Box>
            )}
            {dynamic && (
              <>
                {!alwaysDynamic && (
                  <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>(Note: The report will be modified)</Typography>
                )}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={LABEL_SX}>Amount</Typography>
                    <TextField fullWidth type="number" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ min: 1, step: 1 }} sx={FIELD_SX} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={LABEL_SX}>Period</Typography>
                    <Select
                      fullWidth
                      value={period}
                      onChange={(e) => setPeriod(e.target.value)}
                      IconComponent={ArrowDropDownIcon}
                      sx={{ borderRadius: '8px', height: 42, fontSize: 16, bgcolor: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: 2 } }}
                    >
                      {DYNAMIC_PERIODS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                    </Select>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <ShopfrontSwitch checked={includeToday} onChange={(e) => setIncludeToday(e.target.checked)} />
                  <Typography sx={{ fontSize: 16, color: '#000' }}>Include today</Typography>
                </Box>
              </>
            )}
          </>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}>
          <Button disableElevation onClick={handleClose} sx={{ minWidth: 118, height: 44, borderRadius: '10px', bgcolor: '#d4d4d4', color: '#000', fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#c4c4c4' } }}>
            Cancel
          </Button>
          <Button disableElevation onClick={handleSave} disabled={loading} sx={{ minWidth: 118, height: 44, borderRadius: '10px', bgcolor: '#0ea5e9', color: '#fff', fontSize: 16, fontWeight: 700, textTransform: 'none', '&:hover': { bgcolor: '#0284c7' }, '&.Mui-disabled': { bgcolor: '#9ccfe8', color: '#fff' } }}>
            {loading ? 'Saving...' : 'Save'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default SaveReportDialog;
