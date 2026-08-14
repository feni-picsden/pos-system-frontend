import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Popper,
  ClickAwayListener,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  FormControlLabel,
  IconButton,
} from '@mui/material';
import {
  VisibilityOutlined as ViewIcon,
  SettingsOutlined as SettingsIcon,
  DeleteOutline as DeleteIcon,
  EmailOutlined as EmailIcon,
  EditOutlined as EditIcon,
  Add as AddIcon,
  Description as DescriptionIcon,
  Close as CloseIcon,
  ArrowDropDown as ArrowDropDownIcon,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as SquareCheckedIcon,
} from '@mui/icons-material';
import favouriteReportService from '../../services/favouriteReportService';
import ConfirmDeleteDialog from '../../components/Common/ConfirmDeleteDialog';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';
import { format } from 'date-fns';
import { LocalizationProvider, DateTimePicker } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';

// The Shopfront reference has no transitions on filters, panels or rows.
const INSTANT = 'all 0s ease';
const PANEL_SHADOW = '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)';
const FILTER_LABEL_SX = { mb: 0.5, fontSize: 16, fontWeight: 400, color: '#000', letterSpacing: 'normal' };

// Report type catalog — texts and order as on the reference Favourite Reports screen.
const REPORT_TYPE_OPTIONS = [
  { value: 'actions', label: 'Actions' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'purchase', label: 'Purchase' },
  { value: 'sales', label: 'Sales' },
  { value: 'revision', label: 'Revision' },
  { value: 'inventory-movement', label: 'Inventory Movement' },
];

const EMAIL_FILTER_OPTIONS = [
  { value: 'disabled', label: 'No Email' },
  { value: 'enabled', label: 'Email' },
];

// ISO 8601 period ("P14D", "P1M", "PT30M") — the format the help docs require for a
// Custom email schedule. Returns null for anything unparseable or zero-length.
const addIsoPeriod = (date, period) => {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    (period || '').trim().toUpperCase()
  );
  if (!m || m.slice(1).every((v) => !v)) return null;
  const n = (v) => (v ? Number(v) : 0);
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + n(m[1]));
  next.setMonth(next.getMonth() + n(m[2]));
  next.setDate(next.getDate() + n(m[3]) * 7 + n(m[4]));
  next.setHours(next.getHours() + n(m[5]));
  next.setMinutes(next.getMinutes() + n(m[6]));
  next.setSeconds(next.getSeconds() + n(m[7]));
  return next;
};

// Custom schedule: the anchor date is the first send; roll it forward by whole
// periods until it is in the future.
const nextCustomDate = (anchor, period) => {
  if (!anchor) return null;
  const now = new Date();
  let d = new Date(anchor);
  for (let i = 0; i < 1000 && d <= now; i += 1) {
    const advanced = addIsoPeriod(d, period);
    if (!advanced || advanced <= d) return new Date(anchor);
    d = advanced;
  }
  return d;
};

// Reference filter control: 42px field with chip pills + clear button, and a
// portal panel with 56px rows, selected options re-pinned to the top.
const FilterSelect = ({ multiple, options, value, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const selected = multiple ? value : value ? [value] : [];
  const selectedOptions = options.filter((o) => selected.includes(o.value));
  const rest = options.filter((o) => !selected.includes(o.value));

  const pick = (v) => {
    if (multiple) {
      onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v]);
    } else {
      onChange(value === v ? '' : v);
      setOpen(false);
    }
  };

  const optionRow = (o, key) => {
    const isSel = selected.includes(o.value);
    return (
      <Box
        key={key}
        component="button"
        type="button"
        onClick={() => pick(o.value)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          width: '100%',
          height: 56,
          p: 2,
          border: 0,
          bgcolor: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: 16,
          color: isSel ? '#38bdf8' : '#0a0a0a',
          transition: INSTANT,
          '&:hover': { bgcolor: '#7dd3fc' },
        }}
      >
        {multiple &&
          (isSel ? (
            <SquareCheckedIcon sx={{ fontSize: 20, color: '#38bdf8' }} />
          ) : (
            <SquareIcon sx={{ fontSize: 20, color: '#0a0a0a' }} />
          ))}
        <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {o.label}
        </Box>
      </Box>
    );
  };

  return (
    <ClickAwayListener onClickAway={() => setOpen(false)}>
      <Box onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
        <Box
          ref={anchorRef}
          role="button"
          tabIndex={0}
          onClick={() => setOpen((o) => !o)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setOpen((o) => !o)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            height: 42,
            border: '1px solid #404040',
            borderRadius: '8px',
            bgcolor: '#fff',
            px: 1,
            cursor: 'pointer',
            overflow: 'hidden',
            transition: INSTANT,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
            {selectedOptions.length === 0 ? (
              <Box component="span" sx={{ fontSize: 16, color: '#808080' }}>
                {placeholder}
              </Box>
            ) : (
              selectedOptions.map((o) => (
                <Box
                  key={o.value}
                  component="span"
                  sx={{
                    bgcolor: 'rgba(0,0,0,0.1)',
                    borderRadius: '4px',
                    px: 1,
                    fontSize: 16,
                    color: '#000',
                    maxWidth: 150,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {o.label}
                </Box>
              ))
            )}
          </Box>
          {selectedOptions.length > 0 && (
            <Box
              component="button"
              type="button"
              aria-label="Clear selection"
              onClick={(e) => {
                e.stopPropagation();
                onChange(multiple ? [] : '');
              }}
              sx={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 25,
                height: 24,
                p: 0,
                border: 0,
                borderRadius: '8px',
                bgcolor: 'transparent',
                color: '#000',
                cursor: 'pointer',
                transition: INSTANT,
                '&:hover': { bgcolor: 'rgba(0,0,0,0.05)' },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </Box>
          )}
          <ArrowDropDownIcon sx={{ flexShrink: 0, color: '#404040' }} />
        </Box>

        <Popper
          open={open}
          anchorEl={anchorRef.current}
          placement="bottom-start"
          modifiers={[{ name: 'offset', options: { offset: [0, 4] } }]}
          style={{ zIndex: 1300 }}
        >
          <Box
            sx={{
              width: anchorRef.current ? anchorRef.current.offsetWidth : 'auto',
              bgcolor: '#fff',
              border: '1px solid #000000',
              borderRadius: '8px',
              boxShadow: PANEL_SHADOW,
              maxHeight: 288,
              overflow: 'auto',
              transition: INSTANT,
            }}
          >
            {multiple && selectedOptions.length > 0 && (
              <>
                {selectedOptions.map((o) => optionRow(o, `pinned-${o.value}`))}
                <Box sx={{ height: '1px', bgcolor: '#e5e5e5' }} />
              </>
            )}
            {(multiple ? rest : options).map((o) => optionRow(o, o.value))}
          </Box>
        </Popper>
      </Box>
    </ClickAwayListener>
  );
};

const FavouriteReports = () => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert } = useAppDialogs();
  const navigate = useNavigate();

  // Filter states
  const [reportName, setReportName] = useState('');
  const [reportTypes, setReportTypes] = useState([]); // multi-select, empty = all
  const [emailFilter, setEmailFilter] = useState(''); // '' = all (placeholder)

  // Data states
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);

  // Email settings states
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailAddresses, setEmailAddresses] = useState(['']);
  const [exportType, setExportType] = useState('PDF');
  const [pageOrientation, setPageOrientation] = useState('Portrait');
  const [timePeriod, setTimePeriod] = useState('Fortnightly');
  const [customPeriod, setCustomPeriod] = useState('P14D');
  const [nextEmailDate, setNextEmailDate] = useState(null);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadReports();
  }, [reportName, emailFilter]);

  const loadReports = async () => {
    setLoading(true);
    try {
      const filters = {
        reportName: reportName || undefined,
        emailFilter: emailFilter || undefined,
      };

      const response = await favouriteReportService.getAll(filters);
      if (response.success) {
        setReports(response.data || []);
      }
    } catch (error) {
      console.error('Error loading favourite reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (report) => {
    // Navigate to the report with saved filters
    const path = report.reportPath;
    const filters = report.filters || {};

    // Build query string from filters
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      if (filters[key] !== null && filters[key] !== undefined && filters[key] !== '') {
        if (Array.isArray(filters[key])) {
          filters[key].forEach(val => queryParams.append(key, val));
        } else {
          // Convert Date objects or date strings to ISO string format
          let value = filters[key];
          if (value instanceof Date) {
            value = value.toISOString();
          } else if (typeof value === 'string' && key.includes('Date') && !value.includes('T')) {
            // Try to parse and convert to ISO string (ISO strings pass through unchanged)
            try {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                value = date.toISOString();
              }
            } catch {
              // Keep original value if parsing fails
            }
          }
          queryParams.append(key, value);
        }
      }
    });

    const queryString = queryParams.toString();
    navigate(`${path}${queryString ? `?${queryString}` : ''}`);
  };

  const handleDelete = (report) => {
    setSelectedReport(report);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedReport) return;

    try {
      await favouriteReportService.delete(selectedReport.id);
      setDeleteDialogOpen(false);
      setSelectedReport(null);
      loadReports();
    } catch (error) {
      console.error('Error deleting report:', error);
    }
  };

  const calculateNextEmailDate = (period, currentDate = null) => {
    const now = currentDate || new Date();
    let calculatedDate = null;

    switch (period) {
      case 'Every 5 minutes':
        calculatedDate = new Date(now);
        calculatedDate.setMinutes(calculatedDate.getMinutes() + 5);
        break;
      case 'Daily':
        calculatedDate = new Date(now);
        calculatedDate.setDate(calculatedDate.getDate() + 1);
        calculatedDate.setHours(23, 59, 59, 999);
        break;
      case 'Weekly':
        calculatedDate = new Date(now);
        calculatedDate.setDate(calculatedDate.getDate() + 7);
        calculatedDate.setHours(23, 59, 59, 999);
        break;
      case 'Fortnightly':
        calculatedDate = new Date(now);
        calculatedDate.setDate(calculatedDate.getDate() + 14);
        calculatedDate.setHours(23, 59, 59, 999);
        break;
      case 'Monthly':
        calculatedDate = new Date(now);
        calculatedDate.setMonth(calculatedDate.getMonth() + 1);
        calculatedDate.setDate(1);
        calculatedDate.setHours(23, 59, 59, 999);
        break;
      case 'Custom':
        // Anchor date drives Custom — keep whatever the user picked.
        calculatedDate = currentDate ? new Date(currentDate) : new Date(now);
        break;
      default:
        calculatedDate = new Date(now);
        calculatedDate.setHours(23, 59, 59, 999);
    }

    return calculatedDate;
  };

  const handleSettings = (report) => {
    setSelectedReport(report);
    // Custom schedules are stored as "Custom:<ISO 8601 period>" in emailSchedule.
    const rawSchedule = report.emailSchedule || report.timePeriod || 'Fortnightly';
    const [initialTimePeriod, storedPeriod] = String(rawSchedule).split(':');
    setEmailEnabled(report.emailEnabled || false);
    setEmailAddresses(
      report.emailAddresses && Array.isArray(report.emailAddresses) && report.emailAddresses.length > 0
        ? [...report.emailAddresses, '']
        : ['']
    );
    setExportType(report.exportType || 'PDF');
    setPageOrientation(report.pageOrientation || 'Portrait');
    setTimePeriod(initialTimePeriod);
    setCustomPeriod(storedPeriod || 'P14D');

    // Calculate or use existing next email date
    const existingDate = report.nextEmailDate ? new Date(report.nextEmailDate) : null;
    const calculatedDate = calculateNextEmailDate(initialTimePeriod, existingDate);
    setNextEmailDate(calculatedDate);

    setSettingsDialogOpen(true);
  };

  const handleTimePeriodChange = (newPeriod) => {
    setTimePeriod(newPeriod);
    if (newPeriod !== 'Custom') {
      // Auto-calculate next email date for non-custom periods
      const calculatedDate = calculateNextEmailDate(newPeriod);
      setNextEmailDate(calculatedDate);
    } else if (!nextEmailDate) {
      setNextEmailDate(new Date());
    }
  };

  const handleAddEmail = () => {
    setEmailAddresses([...emailAddresses, '']);
  };

  const handleRemoveEmail = (index) => {
    const newEmails = emailAddresses.filter((_, i) => i !== index);
    setEmailAddresses(newEmails.length > 0 ? newEmails : ['']);
  };

  const handleEmailChange = (index, value) => {
    const newEmails = [...emailAddresses];
    newEmails[index] = value;
    setEmailAddresses(newEmails);
  };

  const handleUpdateSettings = async () => {
    if (!selectedReport) return;

    // Validate email addresses
    const validEmails = emailAddresses.filter(email => email.trim() !== '');
    if (emailEnabled && validEmails.length === 0) {
      alert('Please add at least one email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of validEmails) {
      if (!emailRegex.test(email)) {
        alert(`Invalid email address: ${email}`);
        return;
      }
    }

    if (emailEnabled && timePeriod === 'Custom' && !addIsoPeriod(new Date(), customPeriod)) {
      alert('Enter the period in ISO 8601 Period Format, e.g. P14D for a fortnight.');
      return;
    }

    setUpdating(true);
    try {
      // Calculate next email date based on time period
      let calculatedNextEmailDate = null;
      if (emailEnabled) {
        calculatedNextEmailDate =
          timePeriod === 'Custom'
            ? nextCustomDate(nextEmailDate, customPeriod)
            : calculateNextEmailDate(timePeriod, new Date());
      }

      await favouriteReportService.update(selectedReport.id, {
        emailEnabled,
        emailAddresses: validEmails,
        exportType,
        pageOrientation,
        timePeriod,
        emailSchedule: timePeriod === 'Custom' ? `Custom:${customPeriod.trim().toUpperCase()}` : timePeriod,
        nextEmailDate: calculatedNextEmailDate,
      });

      setSettingsDialogOpen(false);
      loadReports(); // Reload reports to show updated data
    } catch (error) {
      console.error('Error updating settings:', error);
      alert('Failed to update settings');
    } finally {
      setUpdating(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const getReportTypeLabel = (type) => {
    const option = REPORT_TYPE_OPTIONS.find(opt => opt.value === type);
    return option ? option.label : type;
  };

  // Report-type multi-select is applied client-side (empty selection = all).
  const displayedReports = reportTypes.length === 0
    ? reports
    : reports.filter(r => reportTypes.includes(r.reportType));

  // Shared outlined field styling (parity: #404040 border, 8px radius).
  const outlinedSx = {
    bgcolor: '#fff',
    '& .MuiOutlinedInput-root': {
      borderRadius: '8px',
      height: 42,
      fontSize: 16,
      '& fieldset': { borderColor: '#404040' },
      '&:hover fieldset': { borderColor: '#404040' },
      '&.Mui-focused fieldset': { borderColor: '#000', borderWidth: 2 },
    },
    '& .MuiOutlinedInput-input': { padding: '8px 16px' },
    '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 1 }}>
      <Typography component="h1" sx={{ mb: 3, fontSize: 32, fontWeight: 700, color: '#000' }}>
        Favourite Reports
      </Typography>

      {/* Filters — reference grid: search 2fr, the two selects 1fr each, 16px gutters */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' },
          gap: '16px',
          mb: 3,
          alignItems: 'start',
        }}
      >
        {/* Report Name search — static label above, wide input */}
        <Box>
          <Typography component="label" sx={{ ...FILTER_LABEL_SX, display: 'block' }}>
            Report Name
          </Typography>
          <TextField
            fullWidth
            placeholder="Search Report Name..."
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            sx={outlinedSx}
          />
        </Box>

        {/* Report Type — multi-select */}
        <Box>
          <Typography component="label" sx={{ ...FILTER_LABEL_SX, display: 'block' }}>
            Report Type
          </Typography>
          <FilterSelect
            multiple
            options={REPORT_TYPE_OPTIONS}
            value={reportTypes}
            onChange={setReportTypes}
            placeholder="Filter Report Types..."
          />
        </Box>

        {/* Email Filter — single select */}
        <Box>
          <Typography component="label" sx={{ ...FILTER_LABEL_SX, display: 'block' }}>
            Email Filter
          </Typography>
          <FilterSelect
            options={EMAIL_FILTER_OPTIONS}
            value={emailFilter}
            onChange={setEmailFilter}
            placeholder="Filter Report Emailing..."
          />
        </Box>
      </Box>

      {/* Reports Table */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer>
          <Table sx={{ borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    bgcolor: '#5ebbeb',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: 'none',
                    padding: '16px',
                    height: 51,
                    py: 0,
                    border: 0,
                  },
                  '& th:first-of-type': { borderRadius: '12px 0 0 12px' },
                  '& th:last-of-type': { borderRadius: '0 12px 12px 0' },
                }}
              >
                <TableCell>Name</TableCell>
                <TableCell sx={{ width: 253 }}>Created</TableCell>
                <TableCell sx={{ width: 253 }}>Updated</TableCell>
                <TableCell sx={{ width: 253 }}>Next Email</TableCell>
                <TableCell align="center" sx={{ width: 467 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody
              sx={{
                // No zebra on this screen — every row is white, like the reference.
                '& tr': { bgcolor: '#ffffff' },
                '& td': { border: 0, padding: '16px', height: 74, fontSize: 16, color: '#000' },
                '& tr:first-of-type td:first-of-type': { borderTopLeftRadius: '12px' },
                '& tr:first-of-type td:last-of-type': { borderTopRightRadius: '12px' },
              }}
            >
              {displayedReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <Typography sx={{ fontSize: 16, color: '#737373' }}>
                      No favourite reports found.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                displayedReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Box sx={{ maxWidth: '30vw' }}>
                        <Typography
                          noWrap
                          sx={{ fontWeight: 400, fontSize: 16, color: '#000' }}
                        >
                          {report.name}
                          {report.emailEnabled && (
                            <EmailIcon sx={{ fontSize: 16, width: 20, ml: 1, color: '#a3a3a3', verticalAlign: 'middle' }} />
                          )}
                        </Typography>
                        <Typography sx={{ fontSize: 14, color: '#4b5563' }}>
                          {getReportTypeLabel(report.reportType)}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{formatDate(report.createdAt)}</TableCell>
                    <TableCell>
                      <Box>
                        <Typography sx={{ fontSize: 16, color: '#000' }}>{formatDate(report.updatedAt)}</Typography>
                        <Typography sx={{ fontSize: 14, color: '#4b5563' }}>
                          {report.updatedBy || 'Shopfront'}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      {report.nextEmailDate ? formatDate(report.nextEmailDate) : ''}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                        <Button
                          onClick={() => handleView(report)}
                          startIcon={<ViewIcon />}
                          disableRipple
                          sx={{
                            color: '#0284c7', fontWeight: 700, fontSize: 16, borderRadius: '12px',
                            textTransform: 'none', minWidth: 0, transition: INSTANT,
                            '&:hover': { bgcolor: 'transparent', color: '#0284c7' },
                          }}
                        >
                          View
                        </Button>
                        <Button
                          onClick={() => handleSettings(report)}
                          startIcon={<SettingsIcon />}
                          disableRipple
                          sx={{
                            color: '#32b643', fontWeight: 700, fontSize: 16, borderRadius: '12px',
                            textTransform: 'none', minWidth: 0, transition: INSTANT,
                            '&:hover': { bgcolor: 'transparent', color: '#32b643' },
                          }}
                        >
                          Settings
                        </Button>
                        <Button
                          onClick={() => handleDelete(report)}
                          startIcon={<DeleteIcon />}
                          disableRipple
                          sx={{
                            color: '#dc2626', fontWeight: 700, fontSize: 16, borderRadius: '12px',
                            textTransform: 'none', minWidth: 0, transition: INSTANT,
                            '&:hover': { bgcolor: 'transparent', color: '#dc2626' },
                          }}
                        >
                          Delete
                        </Button>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        title="Delete Favourite Report"
        message={`Are you sure you want to delete "${selectedReport?.name}"? This action cannot be undone.`}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={confirmDelete}
      />

      {/* Email Settings Dialog */}
      <Dialog
        open={settingsDialogOpen}
        onClose={() => setSettingsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 0,
          }
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: '#e8f5e9',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            color: '#16a34a',
            fontWeight: 700,
            fontSize: 16,
            py: 1.5,
            px: 2,
          }}
        >
          <EditIcon sx={{ fontSize: 20 }} />
          Email Settings
        </DialogTitle>
        <DialogContent sx={{ pt: 2, px: 2, pb: 1 }}>
          {selectedReport && (
            <Box>
              {/* Report Name */}
              <Typography sx={{ mb: 2, fontSize: 16, color: '#000' }}>
                {selectedReport.name}
              </Typography>

              {/* Enable Automatic Emails and Next Email Date Row */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <FormControlLabel
                  control={
                    <ShopfrontSwitch
                      checked={emailEnabled}
                      onChange={(e) => setEmailEnabled(e.target.checked)}
                      sx={{ mr: 1 }}
                    />
                  }
                  label="Enable automatic emails"
                  sx={{ m: 0 }}
                />
                {emailEnabled && nextEmailDate && (
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Next Email Date
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#4b5563' }}>
                      {format(
                        timePeriod === 'Custom'
                          ? nextCustomDate(nextEmailDate, customPeriod) || nextEmailDate
                          : nextEmailDate,
                        'dd/MM/yyyy HH:mm:ss'
                      )}
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Show all email settings only when enabled */}
              {emailEnabled && (
                <>
                  {/* Export Type and Page Orientation Row */}
                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Export Type</InputLabel>
                      <Select
                        value={exportType}
                        onChange={(e) => setExportType(e.target.value)}
                        label="Export Type"
                      >
                        <MenuItem value="PDF">PDF</MenuItem>
                        <MenuItem value="CSV">CSV</MenuItem>
                        <MenuItem value="XLSX">XLSX</MenuItem>
                        <MenuItem value="JSON">JSON</MenuItem>
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Page Orientation</InputLabel>
                      <Select
                        value={pageOrientation}
                        onChange={(e) => setPageOrientation(e.target.value)}
                        label="Page Orientation"
                      >
                        <MenuItem value="Portrait">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DescriptionIcon sx={{ fontSize: 18 }} />
                            Portrait
                          </Box>
                        </MenuItem>
                        <MenuItem value="Landscape">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <DescriptionIcon sx={{ fontSize: 18, transform: 'rotate(90deg)' }} />
                            Landscape
                          </Box>
                        </MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Time Period */}
                  <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                    <InputLabel>Time Period</InputLabel>
                    <Select
                      value={timePeriod}
                      onChange={(e) => handleTimePeriodChange(e.target.value)}
                      label="Time Period"
                    >
                      <MenuItem value="Every 5 minutes">Every 5 minutes</MenuItem>
                      <MenuItem value="Daily">Daily</MenuItem>
                      <MenuItem value="Weekly">Weekly</MenuItem>
                      <MenuItem value="Fortnightly">Fortnightly</MenuItem>
                      <MenuItem value="Monthly">Monthly</MenuItem>
                      <MenuItem value="Custom">Custom</MenuItem>
                    </Select>
                  </FormControl>

                  {/* Custom: anchor date + ISO 8601 period, per the help docs */}
                  {timePeriod === 'Custom' && (
                    <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                      <DateTimePicker
                        label="Anchor Date"
                        value={nextEmailDate}
                        onChange={(newValue) => setNextEmailDate(newValue ? new Date(newValue) : null)}
                        format="dd/MM/yyyy HH:mm:ss"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                            helperText: 'Starting point for the period — set the time here to force a send time.',
                          }
                        }}
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Period"
                        value={customPeriod}
                        onChange={(e) => setCustomPeriod(e.target.value)}
                        placeholder="P14D"
                        helperText="ISO 8601 Period Format, e.g. P14D = every second week."
                      />
                    </Box>
                  )}

                  {/* Email Addresses */}
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Emails
                    </Typography>
                    {emailAddresses.map((email, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(index, e.target.value)}
                          placeholder="Email Address"
                        />
                        {emailAddresses.length > 1 && (
                          <IconButton
                            size="small"
                            onClick={() => handleRemoveEmail(index)}
                            aria-label="Remove email address"
                          >
                            <CloseIcon sx={{ fontSize: 18 }} />
                          </IconButton>
                        )}
                      </Box>
                    ))}
                    <Button
                      startIcon={<AddIcon />}
                      onClick={handleAddEmail}
                      size="small"
                      sx={{ mt: 0.5, textTransform: 'none', color: '#32b643' }}
                      variant="text"
                    >
                      New Email Address
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
          <Button
            onClick={() => setSettingsDialogOpen(false)}
            sx={{
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              color: '#404040'
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpdateSettings}
            variant="contained"
            disabled={updating}
            sx={{
              bgcolor: '#16a34a',
              borderRadius: '12px',
              textTransform: 'none',
              fontWeight: 700,
              boxShadow: 'none',
              '&:hover': { bgcolor: '#15803d', boxShadow: 'none' }
            }}
          >
            {updating ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </LocalizationProvider>
  );
};

export default FavouriteReports;
