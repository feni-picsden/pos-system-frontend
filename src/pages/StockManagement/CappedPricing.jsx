import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  CircularProgress,
  Alert,
  InputAdornment,
  Autocomplete,
  Checkbox,
  Button,
} from '@mui/material';
import {
  CloudOutlined as CloudOutlinedIcon,
  DescriptionOutlined as DescriptionOutlinedIcon,
  Block as BlockIcon,
  Outbox as OutboxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
  ArrowDropDown as ArrowDropDownIcon,
} from '@mui/icons-material';
import productService from '../../services/productService';
import shelfTicketService from '../../services/shelfTicketService';
import { priceSetService } from '../../services/priceSetService';
import cappedPricingService from '../../services/cappedPricingService';
import { rowsFromCappedPricingCsv, programNameFromFile } from '../../utils/cappedPricingCsv';
import { queueEverydayTicket } from '../../utils/priceChangeTicket';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

// Reference Capped Pricing (help centre art. 360000099231 "Capped Pricing (Core
// or Maximum Shelf Price)", art. 360029656231 "Importing a Capped Pricing File"):
//   Provided  - the banner group's program (none here until a feed exists)
//   Imported  - the store's own CSV (name, supplier code, quantity, price, start
//               date, end date), kept on the server for every device
// Current Price saves when the box is left, prints an Everyday shelf ticket, and
// shows red (but still saves) above the cap. % is the margin at the current price.
const HELP_URL = 'https://support.onshopfront.com/hc/en-us/articles/360029656231';
const DEFAULT_SET = 'Default Price Set';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '-');

const CappedPricing = () => {
  const { selectedOutletId } = useSelectedOutlet();
  const [activeTab, setActiveTab] = useState('provided');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [priceSets, setPriceSets] = useState([DEFAULT_SET]);
  const [selectedSets, setSelectedSets] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  // the Current Price being typed: { id, value }
  const [draft, setDraft] = useState(null);
  // reference: "Price Set" is the placeholder until the box is opened or has a pick
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await cappedPricingService.getCappedPricing();
      setRows(data?.cappedPrices || []);
    } catch (err) {
      console.error('Error loading capped pricing:', err);
      setError(err?.response?.data?.error || 'Failed to load capped pricing');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    priceSetService.getPriceSets()
      .then((r) => setPriceSets([DEFAULT_SET, ...(r?.priceSets || []).map((s) => s.name)]))
      .catch(() => {});
    // the navbar outlet changes the scope
  }, [load, selectedOutletId]);

  const processFile = async (file) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      setError('Please upload a CSV file');
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const { rows: parsed, skipped } = rowsFromCappedPricingCsv(await file.text());
      if (parsed.length === 0) {
        throw new Error(skipped.length
          ? `No valid rows: ${skipped.slice(0, 3).map((s) => `line ${s.line} - ${s.reason}`).join('; ')}`
          : 'No valid data found in CSV file');
      }
      const result = await cappedPricingService.importCappedPricing({
        programName: programNameFromFile(file.name),
        rows: parsed,
      });
      setRows(result?.cappedPrices || []);
      setActiveTab('imported');
      const skippedAll = [...skipped, ...(result?.skipped || [])];
      setSuccess(
        `Successfully imported ${result?.imported ?? parsed.length} items. ${result?.matched ?? 0} products matched with database.`
        + (skippedAll.length ? ` ${skippedAll.length} line${skippedAll.length === 1 ? '' : 's'} skipped (${skippedAll.slice(0, 2).map((s) => `line ${s.line}: ${s.reason}`).join('; ')}${skippedAll.length > 2 ? '; ...' : ''}).` : '')
      );
    } catch (err) {
      console.error('Error importing capped pricing:', err);
      setError(err?.response?.data?.error || err.message || 'Failed to import the file. Please check the format.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportCSV = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = (e) => processFile(e.target.files[0]);
    input.click();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  // Auto-save on leaving the box (no Save button on the reference). A price
  // above the cap is still saved; a cleared / zero price never is.
  const savePrice = async (row, raw) => {
    const price = round2(parseFloat(raw));
    if (!Number.isFinite(price) || price <= 0) {
      setError('Price must be greater than zero - change not saved');
      return;
    }
    // only an existing tier is modified, never a new one created
    if (!row.productId || row.currentPrice == null || Math.abs(price - Number(row.currentPrice)) < 0.005) return;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, currentPrice: price } : r)));
    try {
      // The cap row's quantity is part of the price identity: a 6-pack cap
      // updates the 6-pack tier, not the single.
      await productService.bulkUpdatePrices([{ productId: row.productId, quantity: Number(row.quantity) || 1, price }]);
      // Help docs: the price change adds the product to Shelf Tickets for printing.
      await queueEverydayTicket(shelfTicketService, row.productId);
      setLastSaved(new Date());
    } catch (err) {
      console.error('Error saving price:', err);
      setError(err?.response?.data?.error || 'Failed to save price change');
      await load();
    }
  };

  const tabRows = useMemo(() => rows.filter((r) => (activeTab === 'provided' ? r.source === 'provided' : r.source === 'imported')), [rows, activeTab]);
  const shownRows = useMemo(
    () => (selectedSets.length ? tabRows.filter((r) => selectedSets.includes(r.priceSet || DEFAULT_SET)) : tabRows),
    [tabRows, selectedSets]
  );

  const statusLabel = lastSaved
    ? `Last saved: ${lastSaved.toLocaleDateString('en-GB')} ${lastSaved.toLocaleTimeString('en-GB')}`
    : 'No changes made';

  const tabSx = {
    minHeight: 56,
    height: 56,
    textTransform: 'none',
    fontSize: 14,
    fontWeight: 400,
    color: '#000000',
    borderRadius: '8px 8px 0px 0px',
    transition: 'color 150ms cubic-bezier(0.4, 0, 0.2, 1), background-color 150ms cubic-bezier(0.4, 0, 0.2, 1), border-color 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    '&.Mui-selected': {
      color: '#000000',
      bgcolor: '#ffffff',
      boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.12), 0px 1px 2px rgba(0, 0, 0, 0.08)',
    },
  };

  // Reference (live app): bold title-case labels on a blue band with rounded ends
  const headCellSx = {
    color: '#ffffff',
    fontWeight: 700,
    fontSize: 16,
    bgcolor: '#5ebbeb',
    border: 'none',
    py: 0,
    height: 51,
    whiteSpace: 'nowrap',
    '&:first-of-type': { borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
    '&:last-of-type': { borderTopRightRadius: 8, borderBottomRightRadius: 8 },
  };

  const bodyCellSx = {
    fontSize: 16,
    color: '#000000',
    border: 'none',
    borderBottom: '1px solid #e5e7eb',
    py: 1.5,
    verticalAlign: 'middle',
  };

  const EmptyState = ({ title, description }) => (
    // Reference: big icon on the left, title + description beside it
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, py: 8 }}>
      <BlockIcon sx={{ fontSize: 140, color: '#000' }} />
      <Box>
        <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 3 }}>{title}</Typography>
        <Typography sx={{ fontSize: 16, color: '#000' }}>{description}</Typography>
      </Box>
    </Box>
  );

  const uploadZone = (
    <Box>
      <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
        Looking for the file format?{' '}
        <a href={HELP_URL} target="_blank" rel="noreferrer">Click here</a>.
      </Typography>
      <Box
        component="button"
        type="button"
        onDrop={handleDrop}
        onDragOver={handleDrag}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onClick={handleImportCSV}
        sx={{
          width: '100%',
          height: 150,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 3,
          py: 4,
          border: '1px dashed rgba(17, 24, 39, 0.25)',
          borderRadius: '8px',
          bgcolor: dragActive ? 'rgba(64, 64, 64, 0.05)' : 'transparent',
          boxShadow: 'inset 0px 2px 4px rgba(0, 0, 0, 0.05)',
          cursor: 'pointer',
          textAlign: 'center',
          '&:hover': { bgcolor: 'rgba(64, 64, 64, 0.05)' },
        }}
      >
        <OutboxIcon sx={{ fontSize: 56, color: '#a3a3a3' }} />
        {dragActive ? (
          <Typography sx={{ fontSize: 14, color: '#525252' }}>Drop file to upload</Typography>
        ) : (
          <Typography sx={{ fontSize: 14, color: '#525252' }}>
            <Box component="span" sx={{ color: '#5ebbeb' }}>Upload a file</Box>
            {' or drag and drop'}
          </Typography>
        )}
      </Box>
    </Box>
  );

  // Reference: a multi-select of the store's price sets beside the section
  // heading - picked sets as grey chips ("1 More..." past two), the list showing
  // the picked ones first in blue, a rule, then every set.
  const pickerOptions = [
    ...selectedSets.map((name) => ({ name, top: true })),
    ...priceSets.map((name) => ({ name, top: false })),
  ];
  const priceSetPicker = (
    <Autocomplete
      multiple
      disableCloseOnSelect
      disableClearable
      onOpen={() => setPickerOpen(true)}
      onClose={() => setPickerOpen(false)}
      options={pickerOptions}
      // Reference chips: grey, no delete cross, at most two then "N More..." -
      // open or closed (MUI's limitTags shows them all while focused).
      renderTags={(value) => {
        const chipSx = { display: 'inline-flex', alignItems: 'center', borderRadius: '4px', bgcolor: '#e5e7eb', color: '#000', fontSize: 15, height: 26, px: 1, mr: 1, maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' };
        return [
          ...value.slice(0, 2).map((o) => <Box key={o.name} component="span" sx={chipSx}>{o.name}</Box>),
          ...(value.length > 2 ? [<Box key="more" component="span" sx={chipSx}>{value.length - 2} More...</Box>] : []),
        ];
      }}
      value={selectedSets.map((name) => ({ name, top: true }))}
      onChange={(e, v) => setSelectedSets([...new Set(v.map((o) => o.name))])}
      getOptionLabel={(o) => o.name}
      isOptionEqualToValue={(o, v) => o.name === v.name}
      groupBy={(o) => (o.top ? 'picked' : 'all')}
      renderGroup={(params) => (
        <li key={params.key}>
          {params.group === 'all' && selectedSets.length > 0 && <Box sx={{ borderTop: '1px solid #000', mx: 0 }} />}
          <ul style={{ padding: 0 }}>{params.children}</ul>
        </li>
      )}
      popupIcon={<ArrowDropDownIcon sx={{ color: '#808080' }} />}
      renderOption={(props, option, { selected }) => (
        <li {...props} key={`${option.top ? 'p' : 'a'}-${option.name}`} style={{ fontSize: 16, minHeight: 56, color: selected ? '#29b6f6' : '#000' }}>
          <Checkbox
            icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
            checkedIcon={<CheckBoxIcon fontSize="small" />}
            checked={selected}
            sx={{ mr: 1, p: 0, color: selected ? '#29b6f6 !important' : '#404040' }}
          />
          {option.name}
        </li>
      )}
      slotProps={{
        paper: {
          sx: {
            border: '1px solid #000',
            borderRadius: '8px',
            // smooth open: fade + slight drop instead of popping in
            '@keyframes cpPickerIn': {
              from: { opacity: 0, transform: 'translateY(-6px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
            animation: 'cpPickerIn 180ms ease-out',
            '& .MuiAutocomplete-listbox': { padding: 0 },
            // option rows only - the group wrapper is an <li> too
            '&& li.MuiAutocomplete-option': { minHeight: 56, padding: '16px', backgroundColor: '#fff' },
            '&& li.MuiAutocomplete-option.Mui-focused, && li.MuiAutocomplete-option:hover': { backgroundColor: '#7dd3fc', color: '#000' },
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder={selectedSets.length || pickerOpen ? '' : 'Price Set'}
          inputProps={{ ...params.inputProps, 'aria-label': 'Price Set' }}
          sx={{
            minWidth: 420,
            '& .MuiOutlinedInput-root': {
              minHeight: 42,
              // same 42px box as the other selects (MUI's multiple padding made it 56)
              paddingTop: '0 !important',
              paddingBottom: '0 !important',
              borderRadius: '8px',
              bgcolor: '#fff',
              fontSize: 16,
              '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
              '&:hover fieldset': { borderColor: '#404040' },
              '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '2px' },
            },
            '& input::placeholder': { color: '#808080', opacity: 1, fontSize: 16 },
            '& .MuiAutocomplete-popupIndicator': { transform: 'none' },
            '& .MuiAutocomplete-popupIndicatorOpen': { transform: 'none' },
          }}
        />
      )}
    />
  );

  const table = (
    <TableContainer>
      <Table sx={{ tableLayout: 'fixed' }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ ...headCellSx, width: '25%' }}>Product</TableCell>
            <TableCell sx={{ ...headCellSx, width: '18%' }}>Capped Pricing</TableCell>
            <TableCell sx={{ ...headCellSx, width: '10%' }}>Start Date</TableCell>
            <TableCell sx={{ ...headCellSx, width: '10%' }}>End Date</TableCell>
            <TableCell sx={{ ...headCellSx, width: '8%' }} align="center">Quantity</TableCell>
            <TableCell sx={{ ...headCellSx, width: '10%' }} align="center">Capped Price</TableCell>
            <TableCell sx={{ ...headCellSx, width: '15%' }} align="center">Current Price</TableCell>
            <TableCell sx={{ ...headCellSx, width: '8%' }} align="center">%</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {shownRows.map((row) => {
            const matched = !!row.productId;
            // Reference: "modify the Current Price" - the product's existing price
            // for the cap's quantity. With no such tier there is nothing to modify;
            // typing here used to create a brand-new tier on the product.
            const hasTier = matched && row.currentPrice != null;
            const editable = hasTier;
            const typing = draft?.id === row.id;
            const current = typing ? Number(draft.value) : Number(row.currentPrice);
            const hasCurrent = Number.isFinite(current) && current > 0;
            const overCap = hasCurrent && current > Number(row.cappedPrice);
            // Margin at the current price on the tier's cost (itemCost x quantity),
            // as the reference's % column reads (14.99 on a $16 cap -> 39.63%).
            const cost = round2((row.itemCost || 0) * (Number(row.quantity) || 1));
            const marginPct = hasCurrent ? ((current - cost) / current) * 100 : null;
            return (
              <TableRow key={row.id} sx={{ bgcolor: '#ffffff' }}>
                <TableCell sx={bodyCellSx}>
                  <Typography sx={{ fontSize: 12, color: '#676b72' }}>{row.priceSet || DEFAULT_SET}</Typography>
                  <Typography sx={{ fontSize: 16, fontWeight: 600, color: '#000' }}>{row.productName || row.name}</Typography>
                  {!matched && <Typography sx={{ fontSize: 12, color: '#dc2626' }}>Not matched to a product</Typography>}
                  {matched && !hasTier && (
                    <Typography sx={{ fontSize: 12, color: '#dc2626' }}>
                      No price for quantity {row.quantity || 1} on this product - add it on the product page
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={bodyCellSx}>{row.programName || '-'}</TableCell>
                <TableCell sx={bodyCellSx}>{fmtDate(row.startDate)}</TableCell>
                <TableCell sx={bodyCellSx}>{fmtDate(row.endDate)}</TableCell>
                <TableCell sx={bodyCellSx} align="center">{row.quantity || 1}</TableCell>
                <TableCell sx={bodyCellSx} align="center">${Number(row.cappedPrice || 0).toFixed(2)}</TableCell>
                <TableCell sx={bodyCellSx} align="center">
                  <TextField
                    type="number"
                    disabled={!editable}
                    value={typing ? draft.value : (row.currentPrice == null ? '' : Number(row.currentPrice).toFixed(2))}
                    onFocus={() => setDraft({ id: row.id, value: row.currentPrice == null ? '' : Number(row.currentPrice).toFixed(2) })}
                    onChange={(e) => setDraft({ id: row.id, value: e.target.value })}
                    onBlur={() => { const d = draft; setDraft(null); if (d && d.id === row.id) savePrice(row, d.value); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Box component="span" sx={{ color: '#676b72' }}>$</Box>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      width: 233,
                      maxWidth: '100%',
                      '& .MuiOutlinedInput-root': {
                        height: 53,
                        borderRadius: '8px',
                        bgcolor: editable ? '#fff' : '#f3f4f6',
                        fontSize: 16,
                        color: overCap ? '#dc2626' : '#000000',
                        '& fieldset': { borderColor: '#404040', borderWidth: '1px' },
                        '&:hover fieldset': { borderColor: '#404040' },
                        '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: '2px' },
                      },
                    }}
                  />
                </TableCell>
                <TableCell sx={{ ...bodyCellSx, color: overCap ? '#dc2626' : '#000000', fontWeight: 600 }} align="center">
                  {marginPct == null ? '-' : `${marginPct.toFixed(2)}%`}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const heading = activeTab === 'provided' ? 'Provided' : 'Imported';

  return (
    // Reference: grey band holds the title + tabs; the white content runs full width below
    <Box sx={{ bgcolor: '#ffffff', minHeight: '100vh' }}>
      <Box sx={{ bgcolor: '#e2e8f0', px: 3, pt: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Capped Pricing</Typography>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            bgcolor: '#dcfce7',
            color: '#15803d',
            fontSize: 12,
            fontWeight: 500,
            borderRadius: '9999px',
            padding: '4px 8px',
          }}
        >
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#22c55e' }} />
          {statusLabel}
        </Box>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, v) => { setActiveTab(v); setSelectedSets([]); }}
        TabIndicatorProps={{ sx: { display: 'none' } }}
        sx={{ minHeight: 56, mb: 0, '& .MuiTab-root': tabSx }}
      >
        <Tab icon={<CloudOutlinedIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Provided" value="provided" />
        <Tab icon={<DescriptionOutlinedIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Imported" value="imported" />
      </Tabs>
      </Box>

      {/* Content */}
      <Box sx={{ bgcolor: '#ffffff', p: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        {/* Section heading + Price Set picker (reference: on both tabs) */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={600}>{heading}</Typography>
          <Box>
            {/* reference: the small label sits above the box once it is open or filled */}
            <Typography
              sx={{
                fontSize: 12,
                color: '#000',
                mb: '4px',
                // label floats up from the box rather than snapping in
                opacity: pickerOpen || selectedSets.length ? 1 : 0,
                transform: pickerOpen || selectedSets.length ? 'translateY(0)' : 'translateY(8px)',
                transition: 'opacity 180ms ease-out, transform 180ms ease-out',
              }}
            >
              Price Set
            </Typography>
            {priceSetPicker}
          </Box>
        </Box>

        {/* Reference: "Use Different File" sits under the picker, right-aligned above the table */}
        {!loading && activeTab === 'imported' && tabRows.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button
              variant="outlined"
              onClick={handleImportCSV}
              sx={{ height: 42, px: 4, textTransform: 'none', fontSize: 16, fontWeight: 600, borderRadius: '8px', color: '#000', borderColor: '#404040', '&:hover': { borderColor: '#404040' } }}
            >
              Use Different File
            </Button>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
        ) : activeTab === 'imported' && tabRows.length === 0 ? (
          uploadZone
        ) : tabRows.length === 0 ? (
          <EmptyState title="No Capped Pricing" description="No product with capped pricing found" />
        ) : (
          // a price-set filter that matches nothing leaves just the header, as the reference does
          table
        )}
      </Box>
    </Box>
  );
};

export default CappedPricing;
