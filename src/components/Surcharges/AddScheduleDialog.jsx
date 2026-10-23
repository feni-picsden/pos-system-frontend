import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  FormControl,
  Select,
  MenuItem,
  Box,
  Typography,
  InputAdornment,
  IconButton,
  Checkbox,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Paper,
  ClickAwayListener,
  Chip,
  Autocomplete,
} from '@mui/material';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import {
  Edit as EditIcon,
  Close as CloseIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  CheckBox as CheckBoxIcon,
} from '@mui/icons-material';
import { taxRateService } from '../../services/taxRateService';
import classificationService from '../../services/classificationService';
import { useAppDialogs } from '../Common/AppDialogProvider';

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

// Stored value stays 'Fixed Amount' (backend validates it); display label is 'Fixed'
const SURCHARGE_TYPES = [
  { value: 'Percentage', label: 'Percentage' },
  { value: 'Fixed Amount', label: 'Fixed' },
];

// Reference: the Applies To picker only searches once two characters are typed.
const MIN_SEARCH_CHARS = 2;

const isAllDay = (startTime, endTime) =>
  startTime === '00:00' && (endTime === '23:59' || endTime === '24:00');

// Reference dialog fields: thin grey border, 8px radius, 42px tall.
const fieldSx = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'white',
    borderRadius: '8px',
    minHeight: 42,
    '& fieldset': { borderColor: '#c7c7c7', borderWidth: 1 },
    '&:hover fieldset': { borderColor: '#8a8a8a' },
    '&.Mui-focused fieldset': { borderColor: '#000000', borderWidth: 1 },
  },
  '& .MuiOutlinedInput-input': { py: '9.5px' },
  '& input::placeholder': { color: '#808080', opacity: 1 },
};
const selectSx = {
  bgcolor: 'white',
  borderRadius: '8px',
  minHeight: 42,
  '& .MuiSelect-select': { py: '9.5px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#c7c7c7', borderWidth: 1 },
  '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#8a8a8a' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#000000', borderWidth: 1 },
};
const labelSx = { mb: 0.5, color: '#000000', fontWeight: 600, fontSize: 14 };

const AddScheduleDialog = ({
  open,
  onClose,
  onSave,
  onDelete,
  selectedDay = null,
  schedule = null,
  saving = false,
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm, notify } = useAppDialogs();
  const isEditMode = !!schedule;
  // Reference: validation feedback is a top toast ("The surcharge amount is not valid").
  const toastError = (message) => (notify ? notify(message, 'error', { position: 'top' }) : alert(message));

  const [formData, setFormData] = useState({
    surchargeName: 'Surcharge',
    selectedCategories: [],
    selectedTags: [],
    dayOfWeek: selectedDay ? selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase() : 'Monday',
    applyAllDay: true,
    startTime: '--:--',
    endTime: '--:--',
    surchargeType: 'Percentage',
    surchargeAmount: '',
    taxRate: '',
  });

  const [taxRates, setTaxRates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAppliesToDropdown, setShowAppliesToDropdown] = useState(false);

  useEffect(() => {
    if (open) {
      loadTaxRates();
      loadClassifications();

      if (isEditMode && schedule) {
        // Get appliesTo and stored classifications from surcharge (backend now persists these)
        const surchargeAppliesTo = schedule.surcharge?.appliesTo || schedule.appliesTo || 'All Products';
        const categoryIds = schedule.surcharge?.categoryIds || schedule.categoryIds || schedule.selectedCategories || [];
        const tagIds = schedule.surcharge?.tagIds || schedule.tagIds || schedule.selectedTags || [];

        setFormData({
          surchargeName: schedule.surchargeName || schedule.surcharge?.name || 'Surcharge',
          appliesTo: surchargeAppliesTo,
          selectedCategories: Array.isArray(categoryIds) ? categoryIds : [],
          selectedTags: Array.isArray(tagIds) ? tagIds : [],
          dayOfWeek: schedule.dayOfWeek || selectedDay?.charAt(0) + selectedDay?.slice(1).toLowerCase() || 'Monday',
          applyAllDay: isAllDay(schedule.startTime, schedule.endTime),
          startTime: schedule.startTime || '--:--',
          endTime: schedule.endTime || '--:--',
          surchargeType: schedule.surcharge?.surchargeType || schedule.surchargeType || 'Percentage',
          surchargeAmount: schedule.surcharge?.surchargeAmount?.toString() || schedule.surchargeAmount?.toString() || '',
          taxRate: schedule.taxRateId || schedule.surcharge?.taxRateId || schedule.taxRate?.id || '',
        });
      } else {
        setFormData({
          surchargeName: 'Surcharge',
          appliesTo: 'All Products',
          selectedCategories: [],
          selectedTags: [],
          dayOfWeek: selectedDay ? selectedDay.charAt(0) + selectedDay.slice(1).toLowerCase() : 'Monday',
          applyAllDay: true,
          startTime: '--:--',
          endTime: '--:--',
          surchargeType: 'Percentage',
          surchargeAmount: '',
          taxRate: '',
        });
      }
      setSearchTerm('');
      setShowAppliesToDropdown(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isEditMode, schedule, selectedDay]);

  const loadTaxRates = async () => {
    try {
      const response = await taxRateService.getTaxRates();
      const rates = response.taxRates || [];
      setTaxRates(rates);
      // Default new surcharges to the store default tax rate (e.g. GST)
      if (!isEditMode) {
        const defaultRate = rates.find((r) => r.isDefault);
        if (defaultRate) {
          setFormData((prev) => (prev.taxRate ? prev : { ...prev, taxRate: defaultRate.id }));
        }
      }
    } catch (err) {
      console.error('Error loading tax rates:', err);
      setTaxRates([]);
    }
  };

  const loadClassifications = async () => {
    try {
      const [categoriesRes, tagsRes] = await Promise.all([
        classificationService.getClassifications({ type: 'CATEGORY' }),
        classificationService.getClassifications({ type: 'TAG' })
      ]);
      setCategories(categoriesRes.classifications || []);
      setTags(tagsRes.classifications || []);
    } catch (err) {
      console.error('Error loading classifications:', err);
      setCategories([]);
      setTags([]);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryToggle = (categoryId) => {
    setFormData(prev => {
      const isSelected = prev.selectedCategories.includes(categoryId);
      return {
        ...prev,
        selectedCategories: isSelected
          ? prev.selectedCategories.filter(id => id !== categoryId)
          : [...prev.selectedCategories, categoryId]
      };
    });
  };

  const handleTagToggle = (tagId) => {
    setFormData(prev => {
      const isSelected = prev.selectedTags.includes(tagId);
      return {
        ...prev,
        selectedTags: isSelected
          ? prev.selectedTags.filter(id => id !== tagId)
          : [...prev.selectedTags, tagId]
      };
    });
  };

  const handleRemoveCategory = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      selectedCategories: prev.selectedCategories.filter(id => id !== categoryId)
    }));
  };

  const handleRemoveTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.filter(id => id !== tagId)
    }));
  };

  // Reference: nothing is listed until MIN_SEARCH_CHARS are typed ("Keep Typing to Search...").
  const canSearch = searchTerm.trim().length >= MIN_SEARCH_CHARS;
  const needle = searchTerm.trim().toLowerCase();
  const filteredCategories = canSearch ? categories.filter(cat => cat.name?.toLowerCase().includes(needle)) : [];
  const filteredTags = canSearch ? tags.filter(tag => tag.name?.toLowerCase().includes(needle)) : [];

  const handleSubmit = () => {
    if (!formData.surchargeName.trim()) {
      toastError('The surcharge name is not valid');
      return;
    }

    if (!formData.applyAllDay && (formData.startTime === '--:--' || formData.endTime === '--:--')) {
      toastError('The start and end times are not valid');
      return;
    }

    if (!formData.surchargeAmount || isNaN(parseFloat(formData.surchargeAmount)) || parseFloat(formData.surchargeAmount) < 0) {
      toastError('The surcharge amount is not valid');
      return;
    }

    // Determine appliesTo based on whether categories/tags are selected
    const hasSelections = formData.selectedCategories.length > 0 || formData.selectedTags.length > 0;
    const appliesTo = hasSelections ? 'Limited' : 'All Products';

    const scheduleData = {
      ...formData,
      appliesTo: appliesTo,
      surchargeAmount: parseFloat(formData.surchargeAmount),
      // Apply all day = full-day window
      startTime: formData.applyAllDay ? '00:00' : formData.startTime,
      endTime: formData.applyAllDay ? '23:59' : formData.endTime,
      categoryIds: formData.selectedCategories,
      tagIds: formData.selectedTags
    };

    onSave(scheduleData);
  };

  const handleClose = () => {
    setFormData({
      surchargeName: 'Surcharge',
      selectedCategories: [],
      selectedTags: [],
      dayOfWeek: 'Monday',
      applyAllDay: true,
      startTime: '--:--',
      endTime: '--:--',
      surchargeType: 'Percentage',
      surchargeAmount: '',
      taxRate: '',
    });
    setSearchTerm('');
    setShowAppliesToDropdown(false);
    onClose();
  };

  // Get selected items for display
  const getSelectedItems = () => {
    const selected = [];
    formData.selectedCategories.forEach(catId => {
      const cat = categories.find(c => c.id === catId);
      if (cat) selected.push({ id: catId, name: cat.name, type: 'category' });
    });
    formData.selectedTags.forEach(tagId => {
      const tag = tags.find(t => t.id === tagId);
      if (tag) selected.push({ id: tagId, name: tag.name, type: 'tag' });
    });
    return selected;
  };

  const renderOptionGroup = (title, items, selectedIds, onToggle, withTopBorder) => (
    <Box>
      <Typography
        sx={{
          px: 1.5,
          py: 0.75,
          fontWeight: 700,
          fontSize: 14,
          color: '#000000',
          borderTop: withTopBorder ? '1px solid #e0e0e0' : 'none',
        }}
      >
        {title}
      </Typography>
      <List dense sx={{ p: 0 }}>
        {items.map((item) => {
          const checked = selectedIds.includes(item.id);
          return (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                onClick={() => onToggle(item.id)}
                sx={{
                  py: 0.25,
                  bgcolor: checked ? '#e3f3fb' : 'transparent',
                  '&:hover': { bgcolor: checked ? '#cfe9f7' : '#f5f5f5' },
                }}
              >
                <Checkbox
                  checked={checked}
                  icon={<CheckBoxOutlineBlankIcon />}
                  checkedIcon={<CheckBoxIcon />}
                  sx={{ color: '#000000', p: 0.5 }}
                />
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{ sx: { color: '#000000', fontSize: 14 } }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 512,
          maxWidth: '95vw',
          borderRadius: '8px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
        }
      }}
    >
      {/* Reference header: pale green band, dark-green pencil + title */}
      <Box sx={{
        bgcolor: '#e6f4ea',
        px: 2,
        py: 1.25,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
      }}>
        <EditIcon sx={{ color: '#1b5e20', fontSize: 20 }} />
        <Typography sx={{ fontSize: 18, fontWeight: 600, color: '#1b5e20', flex: 1 }}>
          {isEditMode ? 'Modify Schedule' : 'Add to Schedule'}
        </Typography>
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Surcharge Name */}
          <Box>
            <Typography sx={labelSx}>Surcharge Name</Typography>
            <TextField
              fullWidth
              value={formData.surchargeName}
              onChange={(e) => handleInputChange('surchargeName', e.target.value)}
              variant="outlined"
              inputProps={{ autoComplete: 'off' }}
              sx={fieldSx}
            />
          </Box>

          {/* Applies To - search (2+ chars) over Categories and Tags, chips for picks */}
          <Box sx={{ position: 'relative' }}>
            <Typography sx={labelSx}>Applies To</Typography>
            <ClickAwayListener onClickAway={() => setShowAppliesToDropdown(false)}>
              <Box>
                <Box
                  sx={{
                    border: '1px solid #c7c7c7',
                    borderRadius: '8px',
                    minHeight: 42,
                    bgcolor: 'white',
                    px: 1,
                    py: 0.5,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    alignItems: 'center',
                    cursor: 'text',
                    '&:hover': { borderColor: '#8a8a8a' },
                    '&:focus-within': { borderColor: '#000000' },
                  }}
                  onClick={() => setShowAppliesToDropdown(true)}
                >
                  {getSelectedItems().map((item) => (
                    <Chip
                      key={`${item.type}-${item.id}`}
                      label={item.name}
                      onDelete={() => {
                        if (item.type === 'category') handleRemoveCategory(item.id);
                        else handleRemoveTag(item.id);
                      }}
                      deleteIcon={<CloseIcon sx={{ fontSize: 16, color: '#000000' }} />}
                      sx={{
                        bgcolor: '#f1f1f1',
                        color: '#000000',
                        borderRadius: '6px',
                        '& .MuiChip-deleteIcon': { color: '#000000', '&:hover': { color: '#000000' } },
                      }}
                      size="small"
                    />
                  ))}

                  <TextField
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowAppliesToDropdown(true);
                    }}
                    onFocus={() => setShowAppliesToDropdown(true)}
                    placeholder={getSelectedItems().length === 0 ? 'All Products' : ''}
                    variant="standard"
                    inputProps={{ autoComplete: 'off', 'aria-label': 'Applies To search' }}
                    InputProps={{
                      disableUnderline: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowAppliesToDropdown(!showAppliesToDropdown);
                            }}
                            sx={{ color: '#000000' }}
                          >
                            <Typography variant="caption">▼</Typography>
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    sx={{
                      flex: 1,
                      minWidth: 150,
                      '& .MuiInputBase-input': { color: '#000000', fontSize: 14, py: 0.5 },
                    }}
                  />
                </Box>

                {showAppliesToDropdown && (
                  <Paper
                    sx={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      zIndex: 1000,
                      mt: 0.5,
                      maxHeight: 300,
                      overflow: 'auto',
                      border: '1px solid #c7c7c7',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      bgcolor: 'white'
                    }}
                  >
                    {!canSearch && (
                      <Box sx={{ p: 2 }}>
                        <Typography sx={{ color: '#757575', fontSize: 14 }}>Keep Typing to Search...</Typography>
                      </Box>
                    )}
                    {canSearch && filteredCategories.length > 0 &&
                      renderOptionGroup('Categories', filteredCategories, formData.selectedCategories, handleCategoryToggle, false)}
                    {canSearch && filteredTags.length > 0 &&
                      renderOptionGroup('Tags', filteredTags, formData.selectedTags, handleTagToggle, filteredCategories.length > 0)}
                    {canSearch && filteredCategories.length === 0 && filteredTags.length === 0 && (
                      <Box sx={{ p: 2 }}>
                        <Typography sx={{ color: '#757575', fontSize: 14 }}>No Options</Typography>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>
            </ClickAwayListener>
          </Box>

          {/* Reference: Day of Week select with the "Apply all day" toggle on the same row */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelSx}>Day of Week</Typography>
              <FormControl fullWidth>
                <Select
                  value={formData.dayOfWeek}
                  onChange={(e) => handleInputChange('dayOfWeek', e.target.value)}
                  sx={selectSx}
                >
                  {DAYS_OF_WEEK.map((day) => (
                    <MenuItem key={day} value={day}>{day}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, height: 42 }}>
              <ShopfrontSwitch
                checked={formData.applyAllDay}
                onChange={(e) => handleInputChange('applyAllDay', e.target.checked)}
              />
              <Typography sx={{ color: '#000000', fontSize: 14 }}>Apply all day</Typography>
            </Box>
          </Box>

          {/* Start Time and End Time (hidden while Apply all day is on) */}
          {!formData.applyAllDay && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={labelSx}>Start Time</Typography>
                <TextField
                  fullWidth
                  type="time"
                  value={formData.startTime === '--:--' ? '' : formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value || '--:--')}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  sx={fieldSx}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={labelSx}>End Time</Typography>
                <TextField
                  fullWidth
                  type="time"
                  value={formData.endTime === '--:--' ? '' : formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value || '--:--')}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  sx={fieldSx}
                />
              </Box>
            </Box>
          )}

          {/* Surcharge Type and Amount */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={labelSx}>Surcharge Type</Typography>
              <FormControl fullWidth>
                <Select
                  value={formData.surchargeType}
                  onChange={(e) => handleInputChange('surchargeType', e.target.value)}
                  sx={selectSx}
                >
                  {SURCHARGE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>{type.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography sx={labelSx}>Surcharge Amount</Typography>
              <TextField
                fullWidth
                type="number"
                placeholder="Amount"
                value={formData.surchargeAmount}
                onChange={(e) => handleInputChange('surchargeAmount', e.target.value)}
                inputProps={{ autoComplete: 'off', min: 0, step: 'any' }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography sx={{ color: '#000000' }}>
                        {formData.surchargeType === 'Percentage' ? '%' : '$'}
                      </Typography>
                    </InputAdornment>
                  ),
                }}
                sx={fieldSx}
              />
            </Box>
          </Box>

          {/* Tax Rate — reference: searchable select */}
          <Box>
            <Typography sx={labelSx}>Tax Rate</Typography>
            <Autocomplete
              options={taxRates}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              value={taxRates.find((r) => r.id === formData.taxRate) || null}
              onChange={(e, value) => handleInputChange('taxRate', value?.id || '')}
              size="small"
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Select..."
                  inputProps={{ ...params.inputProps, autoComplete: 'off' }}
                  sx={fieldSx}
                />
              )}
            />
          </Box>
        </Box>
      </DialogContent>

      {/* Action Buttons */}
      <Box sx={{
        p: 2,
        bgcolor: 'white',
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 1,
        borderTop: '1px solid #e0e0e0'
      }}>
        <Button
          onClick={handleClose}
          disabled={saving}
          sx={{
            bgcolor: '#d4d4d4',
            color: '#000000',
            '&:hover': { bgcolor: '#c4c4c4' },
            textTransform: 'none',
            minWidth: 118,
            height: 42,
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16
          }}
        >
          Cancel
        </Button>

        {isEditMode && onDelete && (
          <Button
            onClick={async () => {
              if (!schedule) return;
              const confirmed = await confirm('Remove this surcharge schedule?', {
                title: 'Remove schedule',
                confirmText: 'Remove schedule',
              });
              if (confirmed) {
                onDelete(schedule);
              }
            }}
            sx={{
              bgcolor: '#dc2626',
              color: 'white',
              '&:hover': { bgcolor: '#b91c1c' },
              textTransform: 'none',
              minWidth: 118,
              height: 42,
              borderRadius: '12px',
              fontWeight: 700,
              fontSize: 16
            }}
          >
            Remove
          </Button>
        )}

        <Button
          onClick={handleSubmit}
          disabled={saving}
          sx={{
            bgcolor: '#22c55e',
            color: 'white',
            '&:hover': { bgcolor: '#16a34a' },
            '&.Mui-disabled': { bgcolor: '#9ad8ad', color: 'white' },
            textTransform: 'none',
            minWidth: 118,
            height: 42,
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16
          }}
        >
          {/* Reference: the button reads "Add..." and stays disabled while saving */}
          {saving ? (isEditMode ? 'Update...' : 'Add...') : (isEditMode ? 'Update' : 'Add')}
        </Button>
      </Box>
    </Dialog>
  );
};

export default AddScheduleDialog;
