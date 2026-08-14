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
  ArrowUpward,
  ArrowDownward,
  SaveOutlined as SaveIcon,
  ArrowDropDown,
  CheckBoxOutlineBlankOutlined as SquareIcon,
  CheckBoxOutlined as CheckSquareIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import inventoryReportService from '../../services/inventoryReportService';
import outletService from '../../services/outletService';
import productService from '../../services/productService';
import SaveReportDialog from '../../components/Reports/SaveReportDialog';
import { format } from 'date-fns';

// Reference tokens: 42px fields, 8px radius, #404040 rail, retracting label
// (16px grey inside when empty -> 12.8px slate above when filled).
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
  },
  '& .MuiInputLabel-root': { fontSize: 16, color: 'rgba(103,107,114,0.6)' },
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    color: '#313439',
    transform: 'translate(14px, -9px) scale(0.8)',
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#313439' },
  '& .MuiAutocomplete-popupIndicator': { color: '#313439' },
};

// Reference dropdown: white panel, 1px SOLID BLACK, 8px radius, 288px scroll,
// xl shadow, no open/close transition, 56px option rows with 16px padding.
const panelSx = (selectedSx) => ({
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
        '&.Mui-focused': { backgroundColor: 'rgba(0,0,0,0.04)' },
        "&[aria-selected='true'], &[aria-selected='true'].Mui-focused": selectedSx,
      },
    },
  },
});

// Multi-select panels highlight the picked row (sky-200); the single outlet
// panel just recolours the picked label (sky-400 text on white).
const multiPanelSlotProps = panelSx({ backgroundColor: '#7dd3fc' });
const singlePanelSlotProps = panelSx({ backgroundColor: '#fff', color: '#38bdf8' });

// Reference requires two characters before it will search a filter list.
const MIN_SEARCH = 2;

// Reference filter: type-to-search MULTI-select with square / check-square glyphs,
// 'Keep Typing to Search...' below the minimum and 'No Options' when nothing matches.
const SearchMultiSelect = ({ label, options, value, onChange }) => {
  const [inputValue, setInputValue] = useState('');
  const searching = inputValue.trim().length >= MIN_SEARCH;

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
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
        if (input.length < MIN_SEARCH) return [];
        return opts.filter((o) => (o.name || '').toLowerCase().includes(input));
      }}
      noOptionsText={searching ? 'No Options' : 'Keep Typing to Search...'}
      slotProps={multiPanelSlotProps}
      sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
      renderOption={(props, option, { selected }) => {
        const { key, ...optionProps } = props;
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
      renderTags={(vals, getTagProps) =>
        vals.map((option, index) => {
          const { key, ...tagProps } = getTagProps({ index });
          return (
            <Chip
              key={key}
              label={option.name}
              size="small"
              {...tagProps}
              sx={{ bgcolor: 'rgba(0,0,0,0.1)', borderRadius: '4px', color: '#262626', fontSize: 14 }}
            />
          );
        })
      }
      renderInput={(params) => <TextField {...params} label={label} />}
    />
  );
};

const SlowMovingStock = () => {
  const { getOutletId, getOutletName, isSuperAdmin } = useAuth();

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
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      const currentOutletId = getOutletId();
      try {
        if (isSuperAdmin()) {
          const response = await outletService.getAllOutlets();
          const outletsList = response?.outlets || response || [];
          setOutlets(Array.isArray(outletsList) ? outletsList : []);
        } else if (currentOutletId) {
          // Non-super-admins can only ever report on their own outlet.
          setOutlets([{ id: currentOutletId, name: getOutletName() || 'My Outlet' }]);
        }
        // Reference has no 'All Outlets' — the user's own outlet is pre-selected.
        setOutletId((prev) => prev ?? currentOutletId ?? null);
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
  }, [getOutletId, getOutletName, isSuperAdmin]);

  const ids = (list) => (list.length ? list.map((item) => item.id) : undefined);

  const activeFilters = {
    outletId: outletId || undefined,
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

  const formatDate = (date) => {
    if (!date) return 'Never';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return 'Never';
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
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {label}
        {sortConfig.key === columnKey && (
          sortConfig.direction === 'asc' ? <ArrowUpward fontSize="small" /> : <ArrowDownward fontSize="small" />
        )}
      </Box>
    </TableCell>
  );

  return (
    <Box sx={{ px: '16px', pt: '16px', pb: 4, bgcolor: '#fff', minHeight: 'calc(100vh - 50px)' }}>
      {/* Reference opens straight on the Export button; the heading is local chrome. */}
      <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 2 }}>
        Slow Moving Stock
      </Typography>

      <Box sx={{ display: 'flex', gap: '16px', mb: '16px' }}>
        <Button
          onClick={exportToCSV}
          startIcon={<ExportIcon />}
          disableElevation
          disableRipple
          sx={{
            height: 53,
            minWidth: 142,
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
          }}
        >
          Export CSV
        </Button>

        {/* Local-only favourite-report shortcut, in the parity palette. */}
        <Button
          onClick={() => setSaveDialogOpen(true)}
          startIcon={<SaveIcon />}
          disableElevation
          disableRipple
          sx={{
            height: 53,
            minWidth: 110,
            padding: '16px',
            borderRadius: 0,
            border: '1px solid #5ebbeb',
            bgcolor: '#f8f8f8',
            color: '#5ebbeb',
            fontSize: 16,
            fontWeight: 400,
            textTransform: 'none',
            boxShadow: 'none',
            transition: 'background 0.2s ease, color 0.2s ease',
            '&:hover': { bgcolor: '#5ebbeb', color: '#f8f8f8', boxShadow: 'none' },
          }}
        >
          Save
        </Button>
      </Box>

      {/* Reference: bare filter block, no card. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
        <Autocomplete
          options={outlets}
          value={outlets.find((o) => o.id === outletId) || null}
          onChange={(e, newValue) => setOutletId(newValue?.id || null)}
          getOptionLabel={(option) => option?.name || ''}
          isOptionEqualToValue={(o, v) => o.id === v.id}
          popupIcon={<ArrowDropDown />}
          slotProps={singlePanelSlotProps}
          sx={{ width: 358, maxWidth: '100%', ...fieldSx }}
          renderInput={(params) => <TextField {...params} label="Outlet" />}
        />

        <SearchMultiSelect label="Brands" options={brands} value={selectedBrands} onChange={setSelectedBrands} />
        <SearchMultiSelect label="Categories" options={categories} value={selectedCategories} onChange={setSelectedCategories} />
        <SearchMultiSelect label="Families" options={families} value={selectedFamilies} onChange={setSelectedFamilies} />
        <SearchMultiSelect label="Tags" options={tags} value={selectedTags} onChange={setSelectedTags} />
      </Box>

      {/* Reference puts Run on its own row, 32px below the filters, at the left edge. */}
      <Box sx={{ mt: '32px' }}>
        <Button
          onClick={handleRun}
          // The report cannot span outlets — one outlet must be picked first.
          disabled={loading || !outletId}
          disableElevation
          disableRipple
          sx={{
            height: 42,
            minWidth: 120,
            borderRadius: '12px',
            bgcolor: '#5ebbeb',
            color: '#f8f8f8',
            fontSize: 16,
            fontWeight: 700,
            textTransform: 'none',
            boxShadow: 'none',
            transition: 'background 0.2s ease',
            '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: '#737373' }} /> : 'Run'}
        </Button>
      </Box>

      <Typography sx={{ my: '16px', fontSize: 16, color: '#676b72' }}>
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
                <SortableHeader columnKey="averageSoldPerDay" label="AVERAGE SOLD PER DAY" align="right" />
                <SortableHeader columnKey="inventory" label="INVENTORY" align="right" />
                <SortableHeader columnKey="creationDate" label="CREATION DATE" />
                <SortableHeader columnKey="lastSold" label="LAST SOLD" />
                <SortableHeader columnKey="lastOrdered" label="LAST ORDERED" />
                <SortableHeader columnKey="lastReceived" label="LAST RECEIVED" />
                <SortableHeader columnKey="score" label="SCORE" align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow sx={{ '& td': { borderBottom: 'none', fontSize: 16, color: '#000' } }}>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No products found matching the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, index) => (
                  <TableRow
                    key={row.id || index}
                    sx={{
                      bgcolor: index % 2 === 0 ? '#fff' : '#f8f8f8',
                      '& td': {
                        color: '#000',
                        fontSize: 16,
                        padding: '8px 8px 8px 10px',
                        borderBottom: 'none',
                      },
                    }}
                  >
                    <TableCell>{row.name || ''}</TableCell>
                    <TableCell align="right">{row.averageSoldPerDay?.toFixed(3) || '0.000'}</TableCell>
                    <TableCell align="right">{row.inventory || 0}</TableCell>
                    <TableCell>{formatDate(row.creationDate)}</TableCell>
                    <TableCell>{formatDate(row.lastSold)}</TableCell>
                    <TableCell>{formatDate(row.lastOrdered)}</TableCell>
                    <TableCell>{formatDate(row.lastReceived)}</TableCell>
                    <TableCell align="right">{row.score || 0}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !hasRun && (
        <Typography sx={{ fontSize: 16, color: '#676b72' }}>
          Adjust the filters above and press Run to generate the report.
        </Typography>
      )}

      <SaveReportDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        reportType="slow-moving-stock"
        reportPath="/reports/slow-moving-stock"
        filters={activeFilters}
      />
    </Box>
  );
};

export default SlowMovingStock;
