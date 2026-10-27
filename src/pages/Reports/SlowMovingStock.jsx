import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Autocomplete,
  Checkbox,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from '@mui/material';
import {
  TableChartOutlined as ExportIcon,
  ArrowDropDown,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import useHeaderScope from '../../hooks/useHeaderScope';
import { useAppDialogs } from '../../components/Common/AppDialogProvider';
import apiClient from '../../services/apiClient';
import inventoryReportService from '../../services/inventoryReportService';
import productService from '../../services/productService';
import { format } from 'date-fns';

// Reference (26/10/2026 screenshots): 42px fields, 8px radius, #404040 rail, the
// field name as small text ABOVE the box and a grey placeholder inside when empty.
const fieldSx = {
  bgcolor: '#fff',
  '& .MuiOutlinedInput-root': {
    minHeight: 42,
    borderRadius: '8px',
    fontSize: 16,
    py: '3px',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
    '& input::placeholder': { color: '#676b72', opacity: 1 },
  },
  '& .MuiAutocomplete-popupIndicator': { color: '#313439' },
  '& .MuiAutocomplete-clearIndicator': { color: '#313439', visibility: 'visible' },
};
const LABEL_SX = { fontSize: 13, color: '#313439', mb: '4px', lineHeight: 1.2 };

// Reference header: ⇕ after every label; `active` = 'asc' | 'desc' fills the
// triangle of the current sort direction (same as InventoryReport.jsx).
const SortIcon = ({ active }) => (
  <svg width="10" height="14" viewBox="0 0 10 14" style={{ marginLeft: 4, verticalAlign: 'middle', display: 'inline-block' }} aria-hidden="true">
    <path d="M1 5.5 L5 1.5 L9 5.5 Z" fill={active === 'asc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'asc' ? 1.6 : 1.1} strokeLinejoin="round" />
    <path d="M1 8.5 L5 12.5 L9 8.5 Z" fill={active === 'desc' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={active === 'desc' ? 1.6 : 1.1} strokeLinejoin="round" />
  </svg>
);
// Reference button: the Export CSV block (53px, square, sky) is reused for Run;
// focus draws the 2px black rail seen in the screenshots.
const BLOCK_BUTTON_SX = {
  height: 53,
  minWidth: 62,
  padding: '16px',
  borderRadius: 0,
  border: '1px solid #5ebbeb',
  bgcolor: '#5ebbeb',
  color: '#f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'background 0.2s ease, color 0.2s ease',
  '&:hover': { bgcolor: '#f8f8f8', color: '#5ebbeb', boxShadow: 'none' },
  '&:focus-visible': { outline: '2px solid #000', outlineOffset: 0 },
  '&.Mui-disabled': { bgcolor: '#5ebbeb', color: '#f8f8f8', opacity: 0.6 },
};

// Reference dropdown: white panel, 1px SOLID BLACK, 8px radius, 288px scroll,
// xl shadow, no open/close transition, 56px option rows with 16px padding.
const panelSx = (selectedSx, focusedSx = { backgroundColor: 'rgba(0,0,0,0.04)' }) => ({
  paper: {
    sx: {
      border: '1px solid #000',
      borderRadius: '8px',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.10), 0 8px 10px -6px rgba(0,0,0,0.10)',
      mt: '4px',
      '& .MuiAutocomplete-listbox': { maxHeight: 288, py: 0 },
      '& .MuiAutocomplete-noOptions': { padding: '16px', fontSize: 16, color: '#262626' },
      '& .MuiAutocomplete-option': {
        minHeight: 56,
        padding: '16px',
        fontSize: 16,
        color: '#262626',
        '&.Mui-focused': focusedSx,
        "&[aria-selected='true']": selectedSx,
        "&[aria-selected='true'].Mui-focused": { ...selectedSx, ...focusedSx },
      },
    },
  },
});

// Reference (26/10 ss): picked rows show blue text on white; the hovered/focused
// row (picked or not) is sky. The single outlet panel just recolours the label.
const multiPanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' }, { backgroundColor: '#7dd3fc' });
const singlePanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' });

// Reference requires two characters before it will search a filter list.
const MIN_SEARCH = 2;
// Pseudo row shown under the picked items while the search is too short.
const HINT_ROW = { id: '__hint', name: 'Keep Typing to Search...' };

// Reference filter: type-to-search MULTI-select with square / check-square glyphs.
// Opened without typing it lists what is already picked (checked) and then
// 'Keep Typing to Search...'; 'No Options' when a search matches nothing.
const SearchMultiSelect = ({ label, options, value, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const searching = inputValue.trim().length >= MIN_SEARCH;

  return (
    <Box sx={{ flex: '1 1 0', minWidth: 220 }}>
    <Typography sx={LABEL_SX}>{label}</Typography>
    <Autocomplete
      multiple
      disableCloseOnSelect
      // Reference: a "x" clear-all sits beside the arrow whenever something is picked.
      clearIcon={<span style={{ fontSize: 18, lineHeight: 1 }}>×</span>}
      options={options}
      value={value}
      onChange={(e, newValue) => onChange(newValue)}
      inputValue={inputValue}
      onInputChange={(e, newInput) => setInputValue(newInput)}
      getOptionLabel={(option) => option?.name || ''}
      isOptionEqualToValue={(o, v) => o.id === v.id}
      popupIcon={<ArrowDropDown />}
      filterOptions={(opts, state) => {
        const input = state.inputValue.trim().toLowerCase();
        // Too short to search: the picked rows (checked) + the hint row.
        if (input.length < MIN_SEARCH) return [...value, HINT_ROW];
        return opts.filter((o) => (o.name || '').toLowerCase().includes(input));
      }}
      getOptionDisabled={(o) => o.id === HINT_ROW.id}
      noOptionsText={searching ? 'No Options' : 'Keep Typing to Search...'}
      slotProps={multiPanelSlotProps}
      sx={fieldSx}
      renderOption={(props, option, { selected }) => {
        const { key, ...optionProps } = props;
        if (option.id === HINT_ROW.id) {
          return (
            <li key={key} {...optionProps} aria-selected={false} style={{ opacity: 1, color: '#262626', cursor: 'default' }}>
              {HINT_ROW.name}
            </li>
          );
        }
        return (
          <li key={key} {...optionProps}>
            <Checkbox
              icon={<SquareIcon />}
              checkedIcon={<CheckSquareIcon />}
              checked={selected}
              disableRipple
              sx={{ p: 0, mr: '8px', color: '#262626', '&.Mui-checked': { color: '#262626' } }}
            />
            {option.name}
          </li>
        );
      }}
      // Reference: one grey chip — the name for a single pick, "N Selected..." for
      // more; no per-chip x (the field's clear-all x removes everything).
      renderTags={(vals) => (
        <Chip
          label={vals.length === 1 ? vals[0].name : `${vals.length} Selected...`}
          size="small"
          sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#262626', fontSize: 16, height: 26, ml: '4px' }}
        />
      )}
      renderInput={(params) => <TextField {...params} placeholder={value.length ? '' : label} />}
    />
    </Box>
  );
};

const SlowMovingStock = () => {
  const { getOutletId } = useAuth();
  const { notify } = useAppDialogs();

  // Filter states — brands/categories/families/tags are MULTI-select on the reference.
  const [outletId, setOutletId] = useState(null);
  const [selectedBrands, setSelectedBrands] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedFamilies, setSelectedFamilies] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);

  // Data states
  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);

  // UI states
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });

  // Header rule (16/10/2026): in-page Outlet filter hidden when a header outlet is selected.
  const { showOutletFilter, headerOutletId } = useHeaderScope();
  useEffect(() => {
    if (!showOutletFilter && outletId) setOutletId(null);
  }, [showOutletFilter]); // eslint-disable-line react-hooks/exhaustive-deps
  // The outlet the report runs for: the in-page pick, or the header outlet while the
  // pick is hidden. The page pre-selects an outlet once its list loads, and that
  // pick used to be sent even under a header outlet (navbar Outlet 1 ran outlet 4).
  const reportOutletId = showOutletFilter ? outletId : headerOutletId;

  useEffect(() => {
    const load = async () => {
      const currentOutletId = getOutletId();
      try {
        // Reference: every outlet the account is assigned to is listed (Reporting
        // Access is not a filter here); picking one without it answers the red
        // toast on Run. Same source as Inventory at Date.
        const res = await apiClient.get('/auth/report-outlets');
        const outletsList = Array.isArray(res?.data?.assigned) && res.data.assigned.length
          ? res.data.assigned
          : (Array.isArray(res?.data?.outlets) ? res.data.outlets : []);
        setOutlets(outletsList);
        // Reference has no 'All Outlets' — the user's own outlet is pre-selected.
        setOutletId((prev) => prev ?? (outletsList.some((o) => o.id === currentOutletId) ? currentOutletId : outletsList[0]?.id ?? null));
      } catch (error) {
        console.error('Error loading outlets:', error);
      }

      try {
        const [brandsRes, categoriesRes, familiesRes, tagsRes] = await Promise.all([
          productService.getBrands(currentOutletId),
          productService.getCategories(currentOutletId),
          productService.getFamilies(currentOutletId),
          productService.getTags(currentOutletId),
        ]);

        setBrands(Array.isArray(brandsRes) ? brandsRes : []);
        setCategories(Array.isArray(categoriesRes) ? categoriesRes : []);
        setFamilies(Array.isArray(familiesRes) ? familiesRes : []);
        setTags(Array.isArray(tagsRes) ? tagsRes : []);
      } catch (error) {
        console.error('Error loading filter options:', error);
      }
    };
    load();
  }, [getOutletId]);

  const ids = (list) => (list.length ? list.map((item) => item.id) : undefined);

  const activeFilters = {
    outletId: reportOutletId || undefined,
    brandId: ids(selectedBrands),
    categoryId: ids(selectedCategories),
    familyId: ids(selectedFamilies),
    tagIds: ids(selectedTags),
  };

  const handleRun = async () => {
    setLoading(true);
    setHasRun(true);
    try {
      const response = await inventoryReportService.getSlowMovingStock(activeFilters);
      if (response.success) {
        setReportData(response.data || []);
      } else {
        console.error('Error fetching slow moving stock:', response.error);
        setReportData([]);
      }
    } catch (error) {
      console.error('Error fetching slow moving stock:', error);
      setReportData([]);
      // Reference: an outlet without Reporting Access answers a red toast and the
      // page stays as it was before Run.
      const message = error.response?.data?.error || error.response?.data?.message || 'Failed to load the report';
      notify?.(message, 'error', { position: 'top' });
      setHasRun(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const sortedData = [...reportData].sort((a, b) => {
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];

    if (sortConfig.key === 'name') {
      aVal = (aVal || '').toLowerCase();
      bVal = (bVal || '').toLowerCase();
    } else if (sortConfig.key === 'creationDate' || sortConfig.key === 'lastSold' || sortConfig.key === 'lastOrdered' || sortConfig.key === 'lastReceived') {
      aVal = aVal ? new Date(aVal).getTime() : 0;
      bVal = bVal ? new Date(bVal).getTime() : 0;
    } else {
      aVal = Number(aVal) || 0;
      bVal = Number(bVal) || 0;
    }

    if (sortConfig.direction === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  // Reference leaves a date the product never had (e.g. Last Ordered) blank.
  const formatDate = (date) => {
    if (!date) return '';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return '';
    }
  };

  const exportToCSV = () => {
    const headers = [
      'NAME',
      'AVERAGE SOLD PER DAY',
      'INVENTORY',
      'CREATION DATE',
      'LAST SOLD',
      'LAST ORDERED',
      'LAST RECEIVED',
      'SCORE'
    ];

    const csvContent = [
      headers.join(','),
      ...sortedData.map(row => [
        `"${row.name || ''}"`,
        row.averageSoldPerDay || 0,
        row.inventory || 0,
        formatDate(row.creationDate),
        formatDate(row.lastSold),
        formatDate(row.lastOrdered),
        formatDate(row.lastReceived),
        row.score || 0
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `slow-moving-stock-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const SortableHeader = ({ columnKey, label, align = 'left' }) => (
    <TableCell
      align={align}
      sx={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
      onClick={() => handleSort(columnKey)}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          justifyContent: align === 'right' ? 'flex-end' : align === 'center' ? 'center' : 'flex-start',
        }}
      >
        {label}<SortIcon active={sortConfig.key === columnKey ? sortConfig.direction : null} />
      </Box>
    </TableCell>
  );

  return (
    <Box sx={{ px: '16px', pt: '16px', pb: 4, bgcolor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      {/* Reference opens straight on the Export button; the heading is local chrome. */}
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}>
        Slow Moving Stock
      </Typography>

      {/* Reference toolbar: Export CSV only (Save is not on this report). */}
      <Box sx={{ display: 'flex', gap: '16px', mb: '16px' }}>
        <Button
          onClick={exportToCSV}
          startIcon={<ExportIcon />}
          disableElevation
          disableRipple
          sx={{ ...BLOCK_BUTTON_SX, minWidth: 142 }}
        >
          Export CSV
        </Button>
      </Box>

      {/* Reference: bare filter block, no card. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        {/* Header rule (16/10/2026): hidden when a header outlet is selected, not removed */}
        {showOutletFilter && (
        <Box sx={{ flex: '1 1 0', minWidth: 220 }}>
          <Typography sx={LABEL_SX}>Outlet</Typography>
          <Autocomplete
            options={outlets}
            value={outlets.find((o) => o.id === outletId) || null}
            onChange={(e, newValue) => setOutletId(newValue?.id || null)}
            getOptionLabel={(option) => option?.name || ''}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            popupIcon={<ArrowDropDown />}
            disableClearable
            slotProps={singlePanelSlotProps}
            sx={fieldSx}
            renderInput={(params) => <TextField {...params} placeholder="Outlet" />}
          />
        </Box>
        )}

        <SearchMultiSelect label="Brands" options={brands} value={selectedBrands} onChange={setSelectedBrands} />
        <SearchMultiSelect label="Categories" options={categories} value={selectedCategories} onChange={setSelectedCategories} />
        <SearchMultiSelect label="Families" options={families} value={selectedFamilies} onChange={setSelectedFamilies} />
        <SearchMultiSelect label="Tags" options={tags} value={selectedTags} onChange={setSelectedTags} />
      </Box>

      {/* Reference puts Run on its own row, 32px below the filters, at the left edge,
          in the same square sky block as Export CSV. */}
      <Box sx={{ mt: '32px' }}>
        <Button
          onClick={handleRun}
          // The report cannot span outlets — one outlet must be picked first.
          disabled={loading || !reportOutletId}
          disableElevation
          disableRipple
          sx={BLOCK_BUTTON_SX}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#f8f8f8' }} /> : 'Run'}
        </Button>
      </Box>

      <Typography sx={{ mt: '16px', mb: '16px', fontSize: 16, color: '#000' }}>
        Please Note: This report presumes that your inventory is correct.
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress sx={{ color: '#5ebbeb' }} />
        </Box>
      )}

      {!loading && hasRun && (
        <TableContainer sx={{ borderRadius: 0, boxShadow: 'none', overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow
                sx={{
                  '& th': {
                    backgroundColor: '#5ebbeb',
                    color: '#f8f8f8',
                    fontWeight: 700,
                    fontSize: 16,
                    textTransform: 'uppercase',
                    padding: '8px',
                    borderBottom: 'none',
                  },
                }}
              >
                <SortableHeader columnKey="name" label="NAME" />
                <SortableHeader columnKey="averageSoldPerDay" label="AVERAGE SOLD PER DAY" align="center" />
                <SortableHeader columnKey="inventory" label="INVENTORY" align="center" />
                <SortableHeader columnKey="creationDate" label="CREATION DATE" align="center" />
                <SortableHeader columnKey="lastSold" label="LAST SOLD" align="center" />
                <SortableHeader columnKey="lastOrdered" label="LAST ORDERED" align="center" />
                <SortableHeader columnKey="lastReceived" label="LAST RECEIVED" align="center" />
                <SortableHeader columnKey="score" label="SCORE" align="center" />
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Reference: no "no results" row — an empty run shows just the header
                  and the sky footer bar below. */}
              {sortedData.map((row, index) => (
                  <TableRow
                    key={row.id || index}
                    sx={{
                      // Reference stripes: grey first row, white next.
                      bgcolor: index % 2 === 0 ? '#e8e8e8' : '#fff',
                      '& td': {
                        color: '#000',
                        fontSize: 16,
                        padding: '8px 8px 8px 10px',
                        borderBottom: 'none',
                      },
                    }}
                  >
                    <TableCell>
                      {/* Reference: the name links to the product view page. */}
                      {row.id ? (
                        <Box
                          component={RouterLink}
                          to={`/products/${row.id}/view`}
                          sx={{ color: '#2563eb', textDecoration: 'underline', '&:hover': { color: '#1d4ed8' } }}
                        >
                          {row.name || ''}
                        </Box>
                      ) : (row.name || '')}
                    </TableCell>
                    <TableCell align="center">{row.averageSoldPerDay?.toFixed(3) || '0.000'}</TableCell>
                    <TableCell align="center">{row.inventory || 0}</TableCell>
                    <TableCell align="center">{formatDate(row.creationDate)}</TableCell>
                    <TableCell align="center">{formatDate(row.lastSold)}</TableCell>
                    <TableCell align="center">{formatDate(row.lastOrdered)}</TableCell>
                    <TableCell align="center">{formatDate(row.lastReceived)}</TableCell>
                    <TableCell align="center">{row.score ?? 0}</TableCell>
                  </TableRow>
              ))}
              {/* Reference: a sky bar closes the table (taller when the run is empty). */}
              <TableRow>
                <TableCell colSpan={8} sx={{ bgcolor: '#5ebbeb', borderBottom: 'none', padding: 0, height: sortedData.length ? 36 : 56 }} />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !hasRun && (
        <Typography sx={{ fontSize: 16, color: '#000' }}>
          Please select your parameters and press run.
        </Typography>
      )}
    </Box>
  );
};

export default SlowMovingStock;
