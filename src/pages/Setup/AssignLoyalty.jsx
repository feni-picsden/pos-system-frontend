import React, { useState, useEffect, useMemo } from 'react';
import { Box, Typography, Button, TextField, Alert, CircularProgress, Autocomplete } from '@mui/material';
import { ArrowBack as ArrowBackIcon, DeleteOutline as DeleteIcon, SaveOutlined as SaveOutlinedIcon, Add as AddIcon } from '@mui/icons-material';
import { useParams, Link as RouterLink } from 'react-router-dom';
import loyaltyProgramService from '../../services/loyaltyProgramService';
import classificationService from '../../services/classificationService';
import PageSaveBar from '../../components/Common/PageSaveBar';

// Reference "Assign Loyalty - <Outlet>" page: search (Brands / Categories / Families / Tags,
// "Keep Typing to Search..." until typed), Add All buttons, then one bordered panel per
// classification: "<name>  [+ Add]" (adds a quantity tier), column headings Quantity /
// Earn Value / Redeem Value, one row per tier with a red Remove. Blank Earn/Redeem
// inherits the outlet rate; 0 explicitly disables it for the item.

const refBlueButtonSx = {
  height: 48,
  px: 2.5,
  backgroundColor: '#1c86f2',
  color: '#f8f8f8',
  fontSize: 32,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #1c86f2',
  boxShadow: 'none',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  '&:hover': { backgroundColor: '#f8f8f8', color: '#1c86f2', border: '1px solid #1c86f2', boxShadow: 'none' },
};

const refAddAllButtonSx = {
  height: 53,
  px: 2,
  backgroundColor: '#5ebbeb',
  color: '#f8f8f8',
  fontSize: 16,
  fontWeight: 400,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #5ebbeb',
  boxShadow: 'none',
  transition: 'background-color 0.2s ease, color 0.2s ease',
  '&:hover': { backgroundColor: '#f8f8f8', color: '#5ebbeb', border: '1px solid #5ebbeb', boxShadow: 'none' },
};

const addTierSx = {
  ml: 2,
  height: 39,
  px: 1.5,
  backgroundColor: '#28a745',
  color: '#fff',
  fontSize: 24,
  fontWeight: 400,
  lineHeight: 1,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #28a745',
  boxShadow: 'none',
  '& .MuiButton-startIcon': { mr: 1, '& svg': { fontSize: 26 } },
  '&:hover': { backgroundColor: '#1e7e34', border: '1px solid #1e7e34', boxShadow: 'none' },
};

const removeSx = {
  height: 53,
  minWidth: 74,
  px: 1,
  backgroundColor: '#dc3545',
  color: '#fff',
  fontSize: 15,
  lineHeight: 1.1,
  textTransform: 'none',
  borderRadius: 0,
  border: '1px solid #dc3545',
  boxShadow: 'none',
  display: 'flex',
  flexDirection: 'column',
  '& .MuiButton-startIcon': { m: 0, '& svg': { fontSize: 20 } },
  '&:hover': { backgroundColor: '#bd2130', border: '1px solid #bd2130', boxShadow: 'none' },
};

const cellFieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 0,
    height: 53,
    fontSize: 16,
    backgroundColor: '#fff',
    '& fieldset': { border: '1px solid #000' },
    '&:hover fieldset': { border: '1px solid #000' },
    '&.Mui-focused fieldset': { border: '2px solid #000' },
  },
  '& input': { padding: '0 14px', height: 53, boxSizing: 'border-box' },
};

const TYPES = [
  { type: 'brand', idKey: 'brandId', title: 'Brand', group: 'Brands', match: (c) => /^brand$/i.test(c.type) },
  { type: 'category', idKey: 'categoryId', title: 'Category', group: 'Categories', match: (c) => /^category$/i.test(c.type) },
  { type: 'family', idKey: 'familyId', title: 'Family', group: 'Families', match: (c) => /^family$/i.test(c.type) },
  { type: 'tag', idKey: 'tagId', title: 'Tag', group: 'Tags', match: (c) => /^tag$/i.test(c.type) },
];
const toInput = (v) => (v === null || v === undefined ? '' : String(v));
const newTier = () => ({ id: null, quantity: '0', earnRate: '', redeemRate: '' });

const AssignLoyalty = () => {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loyaltyProgram, setLoyaltyProgram] = useState(null);
  const [classifications, setClassifications] = useState({ brand: [], category: [], family: [], tag: [] });
  // items[type] = [{ itemId, item: {id,name}, tiers: [{id, quantity, earnRate, redeemRate}] }]
  const [items, setItems] = useState({ brand: [], category: [], family: [], tag: [] });

  useEffect(() => { fetchData(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      setLoading(true);
      const programResponse = await loyaltyProgramService.getLoyaltyProgram(id);
      setLoyaltyProgram(programResponse.loyaltyProgram);

      const classificationsResponse = await classificationService.getClassifications();
      const all = classificationsResponse.classifications || [];
      const byType = {};
      TYPES.forEach((t) => { byType[t.type] = all.filter(t.match); });
      setClassifications(byType);

      const assignmentsResponse = await loyaltyProgramService.getAssignments(id);
      const grouped = assignmentsResponse.assignments || {};
      const next = {};
      TYPES.forEach((t) => {
        const rows = grouped[`${t.type === 'family' ? 'families' : t.type === 'category' ? 'categories' : t.type + 's'}`] || [];
        const map = new Map();
        rows.forEach((r) => {
          const itemId = r[t.idKey];
          if (!map.has(itemId)) map.set(itemId, { itemId, item: r[t.type] || { id: itemId, name: 'Unknown' }, tiers: [] });
          map.get(itemId).tiers.push({ id: r.id, quantity: toInput(r.quantity ?? 0), earnRate: toInput(r.earnRate), redeemRate: toInput(r.redeemRate) });
        });
        map.forEach((v) => v.tiers.sort((a, b) => Number(a.quantity) - Number(b.quantity)));
        next[t.type] = Array.from(map.values());
      });
      setItems(next);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const addItem = (type, item) => {
    let added = false;
    setItems((prev) => {
      if (prev[type].some((x) => x.itemId === item.id)) return prev;
      added = true;
      return { ...prev, [type]: [...prev[type], { itemId: item.id, item: { id: item.id, name: item.name }, tiers: [newTier()] }] };
    });
    return added;
  };

  const handleAddAll = async (t) => {
    try {
      setError(''); setSuccess('');
      const fn = { brand: 'assignBrands', category: 'assignCategories', family: 'assignFamilies', tag: 'assignTags' }[t.type];
      const response = await loyaltyProgramService[fn](id);
      const listKey = { brand: 'brands', category: 'categories', family: 'families', tag: 'tags' }[t.type];
      const found = response[listKey] || [];
      const fresh = found.filter((item) => !items[t.type].some((x) => x.itemId === item.id));
      const count = fresh.length;
      if (count) setItems((prev) => ({ ...prev, [t.type]: [...prev[t.type], ...fresh.filter((item) => !prev[t.type].some((x) => x.itemId === item.id)).map((item) => ({ itemId: item.id, item: { id: item.id, name: item.name }, tiers: [newTier()] }))] }));
      if (found.length === 0) setError(`No ${t.group.toLowerCase()} found. Please ensure you have ${t.group.toLowerCase()} in your classifications.`);
      else if (count === 0) setSuccess(`All ${found.length} ${t.group.toLowerCase()} are already assigned`);
      else setSuccess(`Added ${count} ${count === 1 ? t.title.toLowerCase() : t.group.toLowerCase()}`);
    } catch (err) {
      console.error(`Error adding ${t.group}:`, err);
      setError(err.response?.data?.error || `Failed to add ${t.group.toLowerCase()}`);
    }
  };

  const updateTier = (type, itemIdx, tierIdx, field, value) => {
    setItems((prev) => {
      const list = prev[type].map((it, i) => i !== itemIdx ? it : { ...it, tiers: it.tiers.map((tr, j) => (j !== tierIdx ? tr : { ...tr, [field]: value })) });
      return { ...prev, [type]: list };
    });
  };
  const addTier = (type, itemIdx) => setItems((prev) => ({ ...prev, [type]: prev[type].map((it, i) => (i !== itemIdx ? it : { ...it, tiers: [...it.tiers, newTier()] })) }));
  // Removing the last tier removes the whole item (its saved rows are deleted on Save).
  const removeTier = (type, itemIdx, tierIdx) => setItems((prev) => ({
    ...prev,
    [type]: prev[type].map((it, i) => (i !== itemIdx ? it : { ...it, tiers: it.tiers.filter((_, j) => j !== tierIdx) })).filter((it) => it.tiers.length > 0),
  }));

  const handleSave = async () => {
    try {
      setSaving(true); setError(''); setSuccess('');
      const assignments = [];
      TYPES.forEach((t) => items[t.type].forEach((it) => it.tiers.forEach((tr) => assignments.push({
        type: t.type,
        itemId: it.itemId,
        quantity: parseInt(tr.quantity, 10) || 0,
        // Blank is sent as blank (inherit); 0 as 0 (override). Never coerced to 0.
        earnRate: String(tr.earnRate).trim(),
        redeemRate: String(tr.redeemRate).trim(),
      }))));
      const res = await loyaltyProgramService.saveAssignments(id, assignments);
      if (res?.errors?.length) {
        setError(res.errors.map((e) => e.error).join('; '));
      } else {
        setSuccess('Loyalty settings saved');
      }
      await fetchData();
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError(err.response?.data?.error || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const searchOptions = useMemo(() => TYPES.flatMap((t) => classifications[t.type].map((c) => ({ id: c.id, name: c.name, type: t.type, group: t.group }))), [classifications]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  const outletTitle = loyaltyProgram?.outlet?.name || (loyaltyProgram && loyaltyProgram.outletId == null ? 'All Outlets' : loyaltyProgram?.name) || 'Unknown';
  const totalAssigned = TYPES.reduce((n, t) => n + items[t.type].length, 0);

  return (
    <Box p={2} pb={12}>
      <Box display="flex" alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon sx={{ fontSize: '28px !important' }} />} component={RouterLink} to="/settings/loyalty" sx={{ ...refBlueButtonSx, mr: 1 }}>
          Back
        </Button>
        <Typography component="h1" sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Assign Loyalty - {outletTitle}
        </Typography>
      </Box>

      <Typography sx={{ fontSize: 16, color: '#000', mb: 2 }}>
        Please note: The highest earn value will be selected and the lowest redeem value will be selected on conflicts, however values with zero will take highest priority.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}

      <Autocomplete
        options={searchOptions}
        value={null}
        getOptionLabel={(o) => o.name || ''}
        groupBy={(o) => o.group}
        inputValue={searchTerm}
        onInputChange={(e, value, reason) => { if (reason !== 'reset') setSearchTerm(value); }}
        // Nothing lists until something is typed (reference: "Keep Typing to Search...").
        filterOptions={(opts, state) => {
          const q = state.inputValue.trim().toLowerCase();
          return q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : [];
        }}
        noOptionsText={searchTerm.trim() ? 'No matches' : 'Keep Typing to Search...'}
        onChange={(e, value) => {
          if (value && value.id) {
            const t = TYPES.find((x) => x.type === value.type);
            if (addItem(value.type, value)) setSuccess(`Added ${t.title.toLowerCase()}: ${value.name}`);
            setSearchTerm('');
          }
        }}
        forcePopupIcon
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Search for Brands, Categories, Families or Tags..."
            fullWidth
            inputProps={{ ...params.inputProps, 'aria-label': 'Search classifications' }}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '8px',
                minHeight: 42,
                backgroundColor: '#fff',
                '& fieldset': { border: '1px solid #404040' },
                '&:hover fieldset': { border: '1px solid #404040' },
                '&.Mui-focused fieldset': { border: '2px solid #000' },
              },
              '& input::placeholder': { color: '#808080', opacity: 1 },
            }}
          />
        )}
        renderGroup={(params) => (
          <li key={params.key}>
            <Typography sx={{ fontSize: 16, fontWeight: 700, color: '#000', px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0' }}>{params.group}</Typography>
            <ul style={{ padding: 0 }}>{params.children}</ul>
          </li>
        )}
        renderOption={(props, option) => {
          // eslint-disable-next-line no-unused-vars
          const { key, ...optionProps } = props;
          return (
            <li key={`${option.type}-${option.id}`} {...optionProps} style={{ fontSize: 16, padding: '14px 16px' }}>
              {option.name}
            </li>
          );
        }}
        slotProps={{ paper: { sx: { borderRadius: '8px', border: '1px solid #404040', boxShadow: 'none', '& .MuiAutocomplete-option.Mui-focused': { backgroundColor: '#5ebbeb' }, '& .MuiAutocomplete-option[aria-selected="true"]': { backgroundColor: '#5ebbeb' } } } }}
        sx={{ mb: 1.5 }}
      />

      <Box display="flex" gap={1} mb={3} flexWrap="wrap">
        {TYPES.map((t) => (
          <Button key={t.type} disableRipple onClick={() => handleAddAll(t)} sx={refAddAllButtonSx}>
            Add All {t.group}
          </Button>
        ))}
      </Box>

      {totalAssigned === 0 && (
        <Typography sx={{ fontSize: 16, color: '#676b72', textAlign: 'center', py: 4 }}>
          No items assigned yet. Use the search or "Add All" buttons above to add items.
        </Typography>
      )}

      {TYPES.map((t) => items[t.type].length > 0 && (
        <Box key={t.type} mb={3}>
          <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000', mb: 1 }}>{t.title}</Typography>
          {items[t.type].map((it, itemIdx) => (
            <Box key={`${t.type}-${it.itemId}`} data-testid={`loyalty-item-${t.type}-${it.itemId}`} sx={{ border: '1px solid #000', p: 1, mb: 1.5 }}>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography sx={{ fontSize: 24, fontWeight: 700, color: '#000', lineHeight: 1.2 }}>{it.item?.name || 'Unknown'}</Typography>
                <Button disableRipple startIcon={<AddIcon />} onClick={() => addTier(t.type, itemIdx)} sx={addTierSx} aria-label={`Add tier ${it.item?.name}`}>
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 74px', columnGap: 1, mb: 0.5 }}>
                {['Quantity', 'Earn Value', 'Redeem Value'].map((h) => (
                  <Typography key={h} sx={{ fontSize: 16, fontWeight: 700, color: '#000', textAlign: 'center' }}>{h}</Typography>
                ))}
                <Box />
              </Box>
              {it.tiers.map((tr, tierIdx) => (
                <Box key={tierIdx} sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 74px', columnGap: 1, mb: tierIdx < it.tiers.length - 1 ? 1 : 0 }}>
                  <TextField value={tr.quantity} onChange={(e) => updateTier(t.type, itemIdx, tierIdx, 'quantity', e.target.value)} sx={cellFieldSx} inputProps={{ inputMode: 'numeric', 'aria-label': `Quantity ${it.item?.name} ${tierIdx + 1}` }} />
                  <TextField value={tr.earnRate} onChange={(e) => updateTier(t.type, itemIdx, tierIdx, 'earnRate', e.target.value)} sx={cellFieldSx} inputProps={{ inputMode: 'decimal', 'aria-label': `Earn Value ${it.item?.name} ${tierIdx + 1}` }} />
                  <TextField value={tr.redeemRate} onChange={(e) => updateTier(t.type, itemIdx, tierIdx, 'redeemRate', e.target.value)} sx={cellFieldSx} inputProps={{ inputMode: 'decimal', 'aria-label': `Redeem Value ${it.item?.name} ${tierIdx + 1}` }} />
                  <Button disableRipple startIcon={<DeleteIcon />} onClick={() => removeTier(t.type, itemIdx, tierIdx)} sx={removeSx} aria-label={`Remove ${it.item?.name} ${tierIdx + 1}`}>
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      ))}

      <PageSaveBar onSave={handleSave} saving={saving} icon={<SaveOutlinedIcon />} />
    </Box>
  );
};

export default AssignLoyalty;
