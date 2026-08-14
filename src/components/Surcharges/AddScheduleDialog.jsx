import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  TextField,
  Button,
  FormControl,
  InputLabel,
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
  Tooltip,
} from '@mui/material';
import ShopfrontSwitch from '../Common/ShopfrontSwitch';
import {
  Edit as EditIcon,
  AccessTime as TimeIcon,
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

const isAllDay = (startTime, endTime) =>
  startTime === '00:00' && (endTime === '23:59' || endTime === '24:00');

const AddScheduleDialog = ({ 
  open, 
  onClose, 
  onSave, 
  onDelete,
  selectedDay = null,
  schedule = null
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { alert, confirm } = useAppDialogs();
  const isEditMode = !!schedule;

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

  const filteredCategories = searchTerm
    ? categories.filter(cat =>
        cat.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : categories;

  const filteredTags = searchTerm
    ? tags.filter(tag =>
        tag.name?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : tags;

  const handleSubmit = () => {
    // Validate required fields
        if (!formData.surchargeName.trim()) {
      alert('Surcharge name is required');
          return;
        }

    if (!formData.applyAllDay && (formData.startTime === '--:--' || formData.endTime === '--:--')) {
      alert('Please select start and end times');
          return;
        }

    if (!formData.surchargeAmount || isNaN(parseFloat(formData.surchargeAmount)) || parseFloat(formData.surchargeAmount) < 0) {
      alert('Surcharge amount must be a valid positive number');
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
      {/* Light Green Header */}
      <Box sx={{
        bgcolor: '#C8E6C9',
        p: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
      }}>
        <EditIcon sx={{ color: '#16a34a', fontSize: 20 }} />
        <Typography sx={{ fontSize: 18, fontWeight: 400, color: '#16a34a', flex: 1 }}>
          {isEditMode ? 'Modify Schedule' : 'Add to Schedule'}
        </Typography>
      </Box>

      <DialogContent sx={{ p: 3, bgcolor: 'white' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          {/* Surcharge Name */}
            <Box>
            <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
              Surcharge Name
              </Typography>
                <TextField
              fullWidth
                  value={formData.surchargeName}
                  onChange={(e) => handleInputChange('surchargeName', e.target.value)}
              variant="outlined"
              sx={{
                '& .MuiOutlinedInput-root': {
                  bgcolor: 'white',
                  '& fieldset': {
                    borderColor: '#000000',
                    borderWidth: 2,
                  },
                  '&:hover fieldset': {
                    borderColor: '#000000',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#000000',
                  },
                },
              }}
            />
          </Box>

          {/* Applies To - Multi-select with chips */}
          <Box sx={{ position: 'relative' }}>
            <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
              Applies To
            </Typography>
            <ClickAwayListener onClickAway={() => setShowAppliesToDropdown(false)}>
              <Box>
                {/* Input field with chips */}
                <Tooltip title="Restrict surcharge to product categories and tags" placement="top" arrow>
                <Box
                  sx={{
                    border: '2px solid #000000',
                    borderRadius: 1,
                    minHeight: 40,
                    bgcolor: 'white',
                    p: 1,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    alignItems: 'center',
                    cursor: 'text',
                    '&:hover': {
                      borderColor: '#000000',
                    },
                    '&:focus-within': {
                      borderColor: '#000000',
                      borderWidth: 2,
                    }
                  }}
                  onClick={() => setShowAppliesToDropdown(true)}
                >
                  {/* Selected chips */}
                  {getSelectedItems().map((item) => (
                    <Chip
                      key={`${item.type}-${item.id}`}
                      label={item.name}
                      onDelete={() => {
                        if (item.type === 'category') {
                          handleRemoveCategory(item.id);
                        } else {
                          handleRemoveTag(item.id);
                        }
                      }}
                      deleteIcon={<CloseIcon sx={{ fontSize: 16, color: '#000000' }} />}
                      sx={{
                        bgcolor: 'white',
                        color: '#000000',
                        border: '1px solid #000000',
                        '& .MuiChip-deleteIcon': {
                          color: '#000000',
                          '&:hover': {
                            color: '#000000',
                          }
                        }
                      }}
                      size="small"
                    />
                  ))}
                  
                  {/* Search input */}
                  <TextField
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setShowAppliesToDropdown(true);
                    }}
                    onFocus={() => setShowAppliesToDropdown(true)}
                    placeholder={getSelectedItems().length === 0 ? "All Products" : ""}
                    variant="standard"
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
                      '& .MuiInputBase-input': {
                        color: '#000000',
                        fontSize: '0.875rem',
                        py: 0.5
                      }
                    }}
                  />
                </Box>
                </Tooltip>

                {/* Dropdown for Categories and Tags */}
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
                      border: '2px solid #000000',
                      bgcolor: 'white'
                    }}
                  >
                    {/* Categories Section */}
                    {filteredCategories.length > 0 && (
                      <Box>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            p: 1, 
                            fontWeight: 'bold', 
                            color: '#000000',
                            borderBottom: '1px solid #e0e0e0'
                          }}
                        >
                          Categories
                        </Typography>
                        <List dense sx={{ p: 0 }}>
                          {filteredCategories.map((category) => (
                            <ListItem key={category.id} disablePadding>
                              <ListItemButton
                                onClick={() => handleCategoryToggle(category.id)}
                                sx={{ 
                                  py: 0.5,
                                  bgcolor: formData.selectedCategories.includes(category.id) ? '#E3F2FD' : 'transparent',
                                  '&:hover': {
                                    bgcolor: formData.selectedCategories.includes(category.id) ? '#BBDEFB' : '#F5F5F5'
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={formData.selectedCategories.includes(category.id)}
                                  icon={<CheckBoxOutlineBlankIcon />}
                                  checkedIcon={<CheckBoxIcon />}
                                  sx={{ color: '#000000', p: 0.5 }}
                                />
                                <ListItemText 
                                  primary={category.name}
                                  primaryTypographyProps={{
                                    sx: { 
                                      color: formData.selectedCategories.includes(category.id) ? '#1976D2' : '#000000', 
                                      fontSize: '0.875rem' 
                                    }
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {/* Tags Section */}
                    {filteredTags.length > 0 && (
                      <Box>
                        <Typography 
                          variant="subtitle2" 
                          sx={{ 
                            p: 1, 
                            fontWeight: 'bold', 
                            color: '#000000',
                            borderTop: filteredCategories.length > 0 ? '1px solid #e0e0e0' : 'none',
                            borderBottom: '1px solid #e0e0e0'
                          }}
                        >
                          Tags
                        </Typography>
                        <List dense sx={{ p: 0 }}>
                          {filteredTags.map((tag) => (
                            <ListItem key={tag.id} disablePadding>
                              <ListItemButton
                                onClick={() => handleTagToggle(tag.id)}
                                sx={{ 
                                  py: 0.5,
                                  bgcolor: formData.selectedTags.includes(tag.id) ? '#E3F2FD' : 'transparent',
                                  '&:hover': {
                                    bgcolor: formData.selectedTags.includes(tag.id) ? '#BBDEFB' : '#F5F5F5'
                                  }
                                }}
                              >
                                <Checkbox
                                  checked={formData.selectedTags.includes(tag.id)}
                                  icon={<CheckBoxOutlineBlankIcon />}
                                  checkedIcon={<CheckBoxIcon />}
                                  sx={{ color: '#000000', p: 0.5 }}
                                />
                                <ListItemText 
                                  primary={tag.name}
                                  primaryTypographyProps={{
                                    sx: { 
                                      color: formData.selectedTags.includes(tag.id) ? '#1976D2' : '#000000', 
                                      fontSize: '0.875rem' 
                                    }
                                  }}
                                />
                              </ListItemButton>
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}

                    {filteredCategories.length === 0 && filteredTags.length === 0 && searchTerm && (
                      <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#757575' }}>
                          No Options
                        </Typography>
                      </Box>
                    )}

                    {!searchTerm && filteredCategories.length === 0 && filteredTags.length === 0 && categories.length === 0 && tags.length === 0 && (
                      <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" sx={{ color: '#757575' }}>
                          Keep Typing to Search...
                  </Typography>
                      </Box>
                    )}
                  </Paper>
                )}
              </Box>
            </ClickAwayListener>
            </Box>

          {/* Day of Week + Apply all day */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
              Day of Week
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.dayOfWeek}
                onChange={(e) => handleInputChange('dayOfWeek', e.target.value)}
                sx={{
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#000000',
                    borderWidth: 2,
                  },
                  '&:hover .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#000000',
                  },
                  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#000000',
                  },
                }}
              >
                {DAYS_OF_WEEK.map((day) => (
                  <MenuItem key={day} value={day}>
                    {day}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Apply all day toggle - ON hides Start/End Time */}
          <Box sx={{ pb: 0.5 }}>
            <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
              Apply all day
            </Typography>
            <ShopfrontSwitch
              checked={formData.applyAllDay}
              onChange={(e) => handleInputChange('applyAllDay', e.target.checked)}
            />
          </Box>
          </Box>

          {/* Start Time and End Time (hidden while Apply all day is on) */}
          {!formData.applyAllDay && (
              <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
                Start Time
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  type="time"
                  value={formData.startTime === '--:--' ? '' : formData.startTime}
                  onChange={(e) => handleInputChange('startTime', e.target.value || '--:--')}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      '& fieldset': {
                        borderColor: '#000000',
                        borderWidth: 2,
                      },
                    },
                  }}
                />
              </Box>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
                End Time
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  type="time"
                  value={formData.endTime === '--:--' ? '' : formData.endTime}
                  onChange={(e) => handleInputChange('endTime', e.target.value || '--:--')}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 300 }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      bgcolor: 'white',
                      '& fieldset': {
                        borderColor: '#000000',
                        borderWidth: 2,
                      },
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
          )}

          {/* Surcharge Type and Amount */}
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
                Surcharge Type
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={formData.surchargeType}
                  onChange={(e) => handleInputChange('surchargeType', e.target.value)}
                  sx={{
                    bgcolor: 'white',
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderColor: '#000000',
                      borderWidth: 2,
                    },
                  }}
                >
                  {SURCHARGE_TYPES.map((type) => (
                    <MenuItem key={type.value} value={type.value}>
                      {type.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
                Surcharge Amount
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={formData.surchargeAmount}
                onChange={(e) => handleInputChange('surchargeAmount', e.target.value)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography sx={{ color: '#000000' }}>
                        {formData.surchargeType === 'Percentage' ? '%' : '$'}
                      </Typography>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'white',
                    '& fieldset': {
                      borderColor: '#000000',
                      borderWidth: 2,
                    },
                  },
                }}
              />
            </Box>
          </Box>

          {/* Tax Rate */}
          <Box>
            <Typography variant="body2" sx={{ mb: 0.5, color: '#000000', fontWeight: 500 }}>
              Tax Rate
            </Typography>
            <FormControl fullWidth>
              <Select
                value={formData.taxRate}
                onChange={(e) => handleInputChange('taxRate', e.target.value)}
                displayEmpty
                renderValue={(value) => {
                  if (!value) {
                    return <span style={{ color: '#808080' }}>Select...</span>;
                  }
                  return taxRates.find((r) => r.id === value)?.name || '';
                }}
                sx={{
                  bgcolor: 'white',
                  '& .MuiOutlinedInput-notchedOutline': {
                    borderColor: '#000000',
                    borderWidth: 2,
                  },
                }}
                endAdornment={
                  formData.taxRate && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInputChange('taxRate', '');
                      }}
                      sx={{ mr: 1 }}
                    >
                      <CloseIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )
                }
              >
                {taxRates.map((taxRate) => (
                  <MenuItem key={taxRate.id} value={taxRate.id}>
                    {taxRate.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
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
          sx={{
            bgcolor: '#d4d4d4',
            color: '#000000',
            '&:hover': {
              bgcolor: '#c4c4c4',
            },
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
              '&:hover': {
                bgcolor: '#b91c1c',
              },
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
          sx={{
            bgcolor: '#22c55e',
            color: 'white',
            '&:hover': {
              bgcolor: '#16a34a',
            },
            textTransform: 'none',
            minWidth: 118,
            height: 42,
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: 16
          }}
        >
          {isEditMode ? 'Update' : 'Add'}
        </Button>
      </Box>
    </Dialog>
  );
};

export default AddScheduleDialog;
