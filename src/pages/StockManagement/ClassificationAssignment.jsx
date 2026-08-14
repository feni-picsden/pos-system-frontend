import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel
} from '@mui/material';
import {
  Close as CloseIcon,
  ArrowDropDown as ArrowDropDownIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import classificationService from '../../services/classificationService';
import productComboService from '../../services/productComboService';
import ShopfrontSwitch from '../../components/Common/ShopfrontSwitch';

// Combos carry only a category/brand link in the schema, so they can only be
// assigned to those two classification types.
const COMBO_FIELD = { CATEGORY: 'categoryId', BRAND: 'brandId' };

// Thin-stroke +/- to match the reference's FontAwesome-light fa-plus / fa-minus
// (MUI Add/Remove icons render a heavier stroke).
const ThinPlus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.5V13.5M2.5 8H13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);
const ThinMinus = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M2.5 8H13.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
  </svg>
);

const TYPE_LABELS = {
  BRAND: 'Brand',
  CATEGORY: 'Category',
  FAMILY: 'Family',
  TAG: 'Tag'
};

const ClassificationAssignment = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [classification, setClassification] = useState(null);
  const [assignedProducts, setAssignedProducts] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);
  // Snapshot of the assigned IDs at load time; Save diffs against it (staged model)
  const [initialAssignedIds, setInitialAssignedIds] = useState([]);
  const [filteredAssigned, setFilteredAssigned] = useState([]);
  const [filteredAvailable, setFilteredAvailable] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [classificationFilter, setClassificationFilter] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [allClassifications, setAllClassifications] = useState([]);
  const [hoveredOption, setHoveredOption] = useState('');

  useEffect(() => {
    loadClassificationData();
  }, [id]);

  useEffect(() => {
    filterProducts();
  }, [assignedProducts, availableProducts, searchTerm, unassignedOnly, classificationFilter, classification, allClassifications]);

  // Load the full classification list so the filter dropdown offers every
  // classification grouped by type (not just ones present on loaded products)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await classificationService.getClassifications();
        if (!cancelled) setAllClassifications(data.classifications || []);
      } catch (err) {
        console.error('Error loading classification list:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Close the classification-filter dropdown on Escape
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFilterOpen(false);
        setFilterText('');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [filterOpen]);

  const loadClassificationData = async () => {
    try {
      setLoading(true);
      const data = await classificationService.getClassificationProducts(id, {
        unassignedOnly: unassignedOnly
      });

      const assigned = data.assignedProducts || [];
      const available = data.availableProducts || [];

      // Product combos are a local-only feature: they belong in the same
      // available/assigned lists as normal products (category/brand only).
      const comboField = COMBO_FIELD[data.classification?.type];
      let combos = [];
      if (comboField) {
        try {
          const comboData = await productComboService.getProductCombos({ limit: 500, status: 'Active' });
          combos = (comboData.combos || []).map(c => ({
            id: `combo-${c.id}`,
            comboId: c.id,
            isCombo: true,
            name: c.name,
            categoryId: c.categoryId,
            brandId: c.brandId
          }));
        } catch (comboErr) {
          console.error('Error loading product combos:', comboErr);
        }
      }
      const assignedCombos = combos.filter(c => String(c[comboField]) === String(id));
      const availableCombos = combos.filter(c => String(c[comboField]) !== String(id));

      setClassification(data.classification);
      setAssignedProducts([...assigned, ...assignedCombos]);
      setInitialAssignedIds([...assigned, ...assignedCombos].map(p => p.id));
      setAvailableProducts([...available, ...availableCombos]);
      setError('');
    } catch (err) {
      setError('Failed to load classification data');
      console.error('Error loading classification data:', err);
    } finally {
      setLoading(false);
    }
  };

  const productLacksCurrentType = (product) => {
    if (product.isCombo) {
      const field = COMBO_FIELD[classification?.type];
      return field ? !product[field] : true;
    }
    switch (classification?.type) {
      case 'CATEGORY': return !product.category;
      case 'BRAND': return !product.brand;
      case 'FAMILY': return !product.family;
      default: return !product.category && !product.brand && !product.family;
    }
  };

  const productMatchesClassification = (product, name) => {
    if (product.isCombo) {
      return allClassifications.some(c =>
        c.name === name &&
        (String(c.id) === String(product.categoryId) || String(c.id) === String(product.brandId))
      );
    }
    return (
      product.category?.name === name ||
      product.brand?.name === name ||
      product.family?.name === name ||
      (product.tags || []).some(pt => pt.tag?.name === name)
    );
  };

  const byName = (a, b) => a.name.localeCompare(b.name);

  const filterProducts = () => {
    const searchLower = searchTerm.toLowerCase();

    const nextAssigned = assignedProducts.filter(product =>
      product.name.toLowerCase().includes(searchLower)
    );

    let nextAvailable = availableProducts.filter(product =>
      product.name.toLowerCase().includes(searchLower)
    );
    if (classificationFilter) {
      nextAvailable = nextAvailable.filter(product =>
        productMatchesClassification(product, classificationFilter)
      );
    }
    if (unassignedOnly) {
      nextAvailable = nextAvailable.filter(productLacksCurrentType);
    }

    // Reference lists both panels alphabetically by name
    setFilteredAssigned([...nextAssigned].sort(byName));
    setFilteredAvailable([...nextAvailable].sort(byName));
  };

  // Grouped options for the classification filter: the FULL classification
  // list grouped by its DB type, with only the current classification excluded
  const filterOptions = useMemo(() => {
    const groups = { CATEGORY: [], BRAND: [], FAMILY: [], TAG: [] };
    allClassifications.forEach((item) => {
      if (!item?.name || !groups[item.type]) return;
      if (classification && String(item.id) === String(classification.id)) return;
      // Same-name duplicates are kept: the table shows both rows, so both must
      // be selectable (they are distinct classification records).
      groups[item.type].push({ id: item.id, name: item.name });
    });
    return [
      { header: 'Categories', options: groups.CATEGORY },
      { header: 'Brands', options: groups.BRAND },
      { header: 'Families', options: groups.FAMILY },
      { header: 'Tags', options: groups.TAG }
    ];
  }, [allClassifications, classification]);

  // Staged: +/- only move products between lists client-side. Nothing is
  // persisted until Save (matches reference).
  const handleAssignProduct = (product) => {
    setAssignedProducts(prev => [...prev, product]);
    setAvailableProducts(prev => prev.filter(p => p.id !== product.id));
  };

  const handleUnassignProduct = (product) => {
    setAssignedProducts(prev => prev.filter(p => p.id !== product.id));
    setAvailableProducts(prev => [...prev, product]);
  };

  // Save is the commit action: diff staged assigned list against the loaded
  // snapshot and persist adds/removes, then return to the list.
  const handleSave = async () => {
    const initial = new Set(initialAssignedIds);
    const currentIds = new Set(assignedProducts.map(p => p.id));
    const byId = new Map([...assignedProducts, ...availableProducts].map(p => [p.id, p]));
    const added = assignedProducts.filter(p => !initial.has(p.id));
    const removed = initialAssignedIds.filter(pid => !currentIds.has(pid)).map(pid => byId.get(pid)).filter(Boolean);

    const toAssign = added.filter(p => !p.isCombo).map(p => p.id);
    const toUnassign = removed.filter(p => !p.isCombo).map(p => p.id);
    const comboField = COMBO_FIELD[classification.type];

    try {
      setSaving(true);
      if (toAssign.length) await classificationService.assignProducts(id, toAssign, 'assign');
      if (toUnassign.length) await classificationService.assignProducts(id, toUnassign, 'unassign');
      if (comboField) {
        for (const combo of added.filter(p => p.isCombo)) {
          await productComboService.updateProductCombo(combo.comboId, { [comboField]: parseInt(id, 10) });
        }
        for (const combo of removed.filter(p => p.isCombo)) {
          await productComboService.updateProductCombo(combo.comboId, { [comboField]: null });
        }
      }
      navigate('/stock-management/classifications');
    } catch (err) {
      setError('Failed to save changes');
      console.error('Error saving classification assignments:', err);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!classification) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Classification not found</Alert>
      </Box>
    );
  }

  const typeLabel = TYPE_LABELS[classification.type] || 'Category';

  // Shared field skin: 42px tall, 8px radius, #404040 border, black 2px on focus
  const fieldSx = {
    backgroundColor: 'white',
    '& .MuiOutlinedInput-root': {
      height: 40,
      borderRadius: '8px',
      fontSize: 16,
      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#404040', borderWidth: '1px' },
      '&:hover.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000', borderWidth: '2px' },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: '#000 !important',
        borderWidth: '2px !important'
      }
    },
    '& .MuiOutlinedInput-input': { backgroundColor: '#fff' },
    '& .MuiOutlinedInput-input::placeholder': { color: '#808080', opacity: 1 }
  };

  // Reference label: 12.8px black with the floating-label transition
  const fieldLabelSx = {
    fontSize: '12.8px',
    color: '#000',
    mb: 0.5,
    transition: 'all 150ms'
  };

  const zebraRowSx = (index) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    px: 1,
    borderRadius: '4px',
    backgroundColor: index % 2 === 1 ? '#f8f8f8' : 'transparent'
  });

  // 32x32 round-cornered +/- action button at the right edge of each row
  const rowButtonSx = (borderColor, iconColor) => ({
    width: 32,
    height: 32,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    borderRadius: '12px',
    border: `1px solid ${borderColor}`,
    backgroundColor: 'transparent',
    color: iconColor,
    cursor: 'pointer',
    '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' }
  });

  const emptyStateSx = {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    color: '#737373',
    textAlign: 'center'
  };

  return (
    <Box>
      {/* Slate title bar with the without-a-classification toggle at its right edge */}
      <Box
        sx={{
          height: 60,
          px: 2,
          backgroundColor: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Typography sx={{ fontSize: 22, fontWeight: 400, color: '#000' }}>
          {classification.name}
        </Typography>
        <FormControlLabel
          control={
            <ShopfrontSwitch
              checked={unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
              sx={{
                // Reference OFF track is neutral-400 (the shared switch defaults to #a1a1a1)
                '& .MuiSwitch-track': { backgroundColor: '#a3a3a3 !important' },
                // ponytail: ON track #3b82f6 is round-1's recorded value, never re-measured
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#3b82f6 !important'
                },
                // Reference OFF track darkens neutral-400 -> neutral-500 on hover
                '&:hover .MuiSwitch-switchBase:not(.Mui-checked) + .MuiSwitch-track': {
                  backgroundColor: '#737373 !important'
                },
                // Reference thumb: no drop shadow, 150ms travel
                '& .MuiSwitch-switchBase': { transitionDuration: '150ms' },
                '& .MuiSwitch-thumb': {
                  boxShadow: 'none',
                  transition: 'transform 150ms, translate 150ms, scale 150ms, rotate 150ms'
                }
              }}
            />
          }
          label={`Only show Products without a ${typeLabel}`}
          labelPlacement="end"
          sx={{
            m: 0,
            gap: 1,
            '& .MuiFormControlLabel-label': { fontSize: 16, color: '#000' }
          }}
        />
      </Box>

      <Box sx={{ p: 2 }}>
        {/* Search (left half) + Classification filter (right half) */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={fieldLabelSx}>
              Search
            </Typography>
            <TextField
              fullWidth
              placeholder="Search for Products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                endAdornment: searchTerm ? (
                  <Box
                    component="span"
                    role="button"
                    aria-label="Clear search"
                    onClick={() => setSearchTerm('')}
                    sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <CloseIcon sx={{ fontSize: 18, color: '#404040' }} />
                  </Box>
                ) : null
              }}
              sx={fieldSx}
            />
          </Box>
          <Box sx={{ flex: 1, position: 'relative' }}>
            <Typography sx={fieldLabelSx}>
              Classification
            </Typography>
            <Box
              sx={{
                width: '100%',
                height: 40,
                px: '12px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '8px',
                border: '1px solid #404040',
                backgroundColor: 'white',
                '&:focus-within': { borderColor: '#000', borderWidth: '2px', px: '11px' }
              }}
            >
              <Box
                component="input"
                type="text"
                value={filterOpen ? filterText : classificationFilter}
                placeholder="Filter by Classification..."
                onFocus={() => setFilterOpen(true)}
                onClick={() => setFilterOpen(true)}
                onChange={(e) => {
                  setFilterText(e.target.value);
                  setFilterOpen(true);
                }}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  color: '#000',
                  '&::placeholder': { color: '#808080', opacity: 1 }
                }}
              />
              {classificationFilter && (
                <Box
                  component="span"
                  role="button"
                  aria-label="Clear classification filter"
                  onClick={(e) => {
                    e.stopPropagation();
                    setClassificationFilter('');
                  }}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mr: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <CloseIcon sx={{ fontSize: 18, color: '#404040' }} />
                </Box>
              )}
              <ArrowDropDownIcon
                onClick={() => setFilterOpen((prev) => !prev)}
                sx={{ color: '#404040', cursor: 'pointer' }}
              />
            </Box>
            {filterOpen && (
              <>
                {/* Click-away backdrop */}
                <Box
                  onClick={() => {
                    setFilterOpen(false);
                    setFilterText('');
                  }}
                  sx={{ position: 'fixed', inset: 0, zIndex: 1290 }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    top: 'calc(100% + 10px)',
                    left: 0,
                    right: 0,
                    zIndex: 1300,
                    backgroundColor: '#fff',
                    borderRadius: '8px',
                    border: '1px solid #000',
                    maxHeight: 288,
                    overflowY: 'auto',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)'
                  }}
                >
                  {filterOptions
                    .map((group) => ({
                      ...group,
                      options: group.options.filter((option) =>
                        option.name.toLowerCase().includes(filterText.toLowerCase())
                      )
                    }))
                    .filter((group) => group.options.length > 0)
                    .map((group) => (
                    <Box key={group.header}>
                      <Box
                        sx={{
                          height: 57,
                          p: 2,
                          boxSizing: 'border-box',
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#000',
                          borderBottom: '1px solid #a3a3a3'
                        }}
                      >
                        {group.header}
                      </Box>
                      {group.options.map((option) => (
                        <Box
                          key={option.id}
                          onClick={() => {
                            setClassificationFilter(option.name);
                            setFilterOpen(false);
                            setFilterText('');
                            setHoveredOption('');
                          }}
                          onMouseEnter={() => setHoveredOption(option.id)}
                          onMouseLeave={() => setHoveredOption('')}
                          sx={{
                            height: 56,
                            p: 2,
                            boxSizing: 'border-box',
                            textAlign: 'left',
                            fontSize: 16,
                            color: '#000',
                            cursor: 'pointer',
                            // react-select renders the reference filter; its
                            // documented default focused/hover option bg is
                            // primary25 = #DEEBFF (a pale blue), not sky-300.
                            backgroundColor:
                              hoveredOption === option.id ? '#DEEBFF' : 'transparent',
                            '&:hover': { backgroundColor: '#DEEBFF' }
                          }}
                        >
                          {option.name}
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Two bare zebra lists: assigned (left) / available (right) */}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Box sx={{ flex: 1, height: 545, overflowY: 'auto' }}>
            {filteredAssigned.length === 0 ? (
              <Box sx={emptyStateSx}>
                {assignedProducts.length === 0
                  ? `Add products to ${classification.name}...`
                  : `No products in ${classification.name} found...`}
              </Box>
            ) : (
              filteredAssigned.map((product, index) => (
                <Box key={product.id} sx={zebraRowSx(index)}>
                  <Typography component="span" noWrap sx={{ fontSize: 16, color: '#000', minWidth: 0 }}>
                    {product.name}
                  </Typography>
                  <Box
                    component="button"
                    type="button"
                    aria-label={`Remove ${product.name}`}
                    disabled={saving}
                    onClick={() => handleUnassignProduct(product)}
                    sx={rowButtonSx('#ef4444', '#dc2626')}
                  >
                    <ThinMinus />
                  </Box>
                </Box>
              ))
            )}
          </Box>

          <Box sx={{ flex: 1, height: 545, overflowY: 'auto' }}>
            {filteredAvailable.map((product, index) => (
              <Box key={product.id} sx={zebraRowSx(index)}>
                <Typography component="span" noWrap sx={{ fontSize: 16, color: '#000', minWidth: 0 }}>
                  {product.name}
                </Typography>
                <Box
                  component="button"
                  type="button"
                  aria-label={`Add ${product.name}`}
                  disabled={saving}
                  onClick={() => handleAssignProduct(product)}
                  sx={rowButtonSx('#22c55e', '#16a34a')}
                >
                  <ThinPlus />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Fixed full-width bottom action bar (reference: #525252, 74px tall,
          pinned to viewport bottom, Save right-aligned with ~16px inset) */}
      <Box sx={{ height: 74 }} />
      <Box
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          height: 74,
          zIndex: 1200,
          backgroundColor: '#525252',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          pr: 2
        }}
      >
        <Box
          component="button"
          onClick={handleSave}
          disabled={saving}
          sx={{
            minWidth: 103,
            height: 42,
            px: '20px',
            borderRadius: '12px',
            border: '1px solid #0ea5e9',
            bgcolor: '#0ea5e9',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: saving ? 'default' : 'pointer',
            boxShadow: 'none',
            '&:hover': { bgcolor: '#38bdf8', borderColor: '#38bdf8' },
            '&:disabled': { bgcolor: '#404040', borderColor: '#404040', color: '#737373', cursor: 'default' }
          }}
        >
          Save
        </Box>
      </Box>
    </Box>
  );
};

export default ClassificationAssignment;
