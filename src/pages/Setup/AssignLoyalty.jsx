import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Autocomplete
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, DeleteOutline as DeleteIcon, SaveOutlined as SaveOutlinedIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import loyaltyProgramService from '../../services/loyaltyProgramService';
import classificationService from '../../services/classificationService';

// Reference solid-blue button (Back/Save): #1c86f2 bg, 32px white text, radius 0, invert on hover
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
  '&:hover': {
    backgroundColor: '#f8f8f8',
    color: '#1c86f2',
    border: '1px solid #1c86f2',
    boxShadow: 'none'
  }
};

// Reference "Add All ..." button: #5ebbeb bg, 16px white text, radius 0, invert on hover
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
  '&:hover': {
    backgroundColor: '#f8f8f8',
    color: '#5ebbeb',
    border: '1px solid #5ebbeb',
    boxShadow: 'none'
  }
};

const AssignLoyalty = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const [loyaltyProgram, setLoyaltyProgram] = useState(null);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [families, setFamilies] = useState([]);
  const [tags, setTags] = useState([]);

  const [brandAssignments, setBrandAssignments] = useState([]);
  const [categoryAssignments, setCategoryAssignments] = useState([]);
  const [familyAssignments, setFamilyAssignments] = useState([]);
  const [tagAssignments, setTagAssignments] = useState([]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch loyalty program
      const programResponse = await loyaltyProgramService.getLoyaltyProgram(id);
      setLoyaltyProgram(programResponse.loyaltyProgram);

      // Fetch classifications
      const classificationsResponse = await classificationService.getClassifications();
      const allClassifications = classificationsResponse.classifications || [];

      setBrands(allClassifications.filter(c => c.type === 'BRAND' || c.type === 'Brand'));
      setCategories(allClassifications.filter(c => c.type === 'CATEGORY' || c.type === 'Category'));
      setFamilies(allClassifications.filter(c => c.type === 'FAMILY' || c.type === 'Family'));
      setTags(allClassifications.filter(c => c.type === 'TAG' || c.type === 'Tag'));

      // Fetch existing assignments
      const assignmentsResponse = await loyaltyProgramService.getAssignments(id);
      if (assignmentsResponse.assignments) {
        setBrandAssignments(assignmentsResponse.assignments.brands || []);
        setCategoryAssignments(assignmentsResponse.assignments.categories || []);
        setFamilyAssignments(assignmentsResponse.assignments.families || []);
        setTagAssignments(assignmentsResponse.assignments.tags || []);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAllBrands = async () => {
    try {
      setError('');
      const response = await loyaltyProgramService.assignBrands(id);
      console.log('Add all brands response:', response);
      
      if (response.newBrands && response.newBrands.length > 0) {
        const newAssignments = response.newBrands.map(brand => ({
          id: null,
          brandId: brand.id,
          brand: brand,
          quantity: 0,
          earnRate: 0,
          redeemRate: 0
        }));
        setBrandAssignments(prev => [...prev, ...newAssignments]);
        setSuccess(`Added ${response.newBrands.length} new brands`);
      } else if (response.brands && response.brands.length > 0) {
        // If all brands are already assigned, show info message
        setSuccess(`All ${response.brands.length} brands are already assigned`);
      } else {
        setError('No brands found. Please ensure you have brands in your classifications.');
      }
    } catch (err) {
      console.error('Error adding brands:', err);
      setError(err.response?.data?.error || 'Failed to add brands');
    }
  };

  const handleAddAllCategories = async () => {
    try {
      setError('');
      const response = await loyaltyProgramService.assignCategories(id);
      console.log('Add all categories response:', response);
      
      if (response.newCategories && response.newCategories.length > 0) {
        const newAssignments = response.newCategories.map(category => ({
          id: null,
          categoryId: category.id,
          category: category,
          quantity: 0,
          earnRate: 0,
          redeemRate: 0
        }));
        setCategoryAssignments(prev => [...prev, ...newAssignments]);
        setSuccess(`Added ${response.newCategories.length} new categories`);
      } else if (response.categories && response.categories.length > 0) {
        setSuccess(`All ${response.categories.length} categories are already assigned`);
      } else {
        setError('No categories found. Please ensure you have categories in your classifications.');
      }
    } catch (err) {
      console.error('Error adding categories:', err);
      setError(err.response?.data?.error || 'Failed to add categories');
    }
  };

  const handleAddAllFamilies = async () => {
    try {
      setError('');
      const response = await loyaltyProgramService.assignFamilies(id);
      console.log('Add all families response:', response);
      
      if (response.newFamilies && response.newFamilies.length > 0) {
        const newAssignments = response.newFamilies.map(family => ({
          id: null,
          familyId: family.id,
          family: family,
          quantity: 0,
          earnRate: 0,
          redeemRate: 0
        }));
        setFamilyAssignments(prev => [...prev, ...newAssignments]);
        setSuccess(`Added ${response.newFamilies.length} new families`);
      } else if (response.families && response.families.length > 0) {
        setSuccess(`All ${response.families.length} families are already assigned`);
      } else {
        setError('No families found. Please ensure you have families in your classifications.');
      }
    } catch (err) {
      console.error('Error adding families:', err);
      setError(err.response?.data?.error || 'Failed to add families');
    }
  };

  const handleAddAllTags = async () => {
    try {
      setError('');
      const response = await loyaltyProgramService.assignTags(id);
      console.log('Add all tags response:', response);
      
      if (response.newTags && response.newTags.length > 0) {
        const newAssignments = response.newTags.map(tag => ({
          id: null,
          tagId: tag.id,
          tag: tag,
          quantity: 0,
          earnRate: 0,
          redeemRate: 0
        }));
        setTagAssignments(prev => [...prev, ...newAssignments]);
        setSuccess(`Added ${response.newTags.length} new tags`);
      } else if (response.tags && response.tags.length > 0) {
        setSuccess(`All ${response.tags.length} tags are already assigned`);
      } else {
        setError('No tags found. Please ensure you have tags in your classifications.');
      }
    } catch (err) {
      console.error('Error adding tags:', err);
      setError(err.response?.data?.error || 'Failed to add tags');
    }
  };

  const handleUpdateAssignment = (type, index, field, value) => {
    const updaters = {
      brand: setBrandAssignments,
      category: setCategoryAssignments,
      family: setFamilyAssignments,
      tag: setTagAssignments
    };

    updaters[type](prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      return updated;
    });
  };

  const handleRemoveAssignment = (type, index) => {
    const updaters = {
      brand: setBrandAssignments,
      category: setCategoryAssignments,
      family: setFamilyAssignments,
      tag: setTagAssignments
    };

    updaters[type](prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      const assignments = [];

      brandAssignments.forEach(assignment => {
        assignments.push({
          type: 'brand',
          itemId: assignment.brandId,
          quantity: parseInt(assignment.quantity) || 0,
          earnRate: parseFloat(assignment.earnRate) || 0,
          redeemRate: parseFloat(assignment.redeemRate) || 0
        });
      });

      categoryAssignments.forEach(assignment => {
        assignments.push({
          type: 'category',
          itemId: assignment.categoryId,
          quantity: parseInt(assignment.quantity) || 0,
          earnRate: parseFloat(assignment.earnRate) || 0,
          redeemRate: parseFloat(assignment.redeemRate) || 0
        });
      });

      familyAssignments.forEach(assignment => {
        assignments.push({
          type: 'family',
          itemId: assignment.familyId,
          quantity: parseInt(assignment.quantity) || 0,
          earnRate: parseFloat(assignment.earnRate) || 0,
          redeemRate: parseFloat(assignment.redeemRate) || 0
        });
      });

      tagAssignments.forEach(assignment => {
        assignments.push({
          type: 'tag',
          itemId: assignment.tagId,
          quantity: parseInt(assignment.quantity) || 0,
          earnRate: parseFloat(assignment.earnRate) || 0,
          redeemRate: parseFloat(assignment.redeemRate) || 0
        });
      });

      await loyaltyProgramService.saveAssignments(id, assignments);
      setSuccess('Assignments saved successfully');
      
      // Refresh data
      await fetchData();
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError(err.response?.data?.error || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuantityTier = (type, itemId, itemData) => {
    const newAssignment = {
      id: null,
      quantity: 0,
      earnRate: 0,
      redeemRate: 0
    };

    if (type === 'brand') {
      newAssignment.brandId = itemId;
      newAssignment.brand = itemData;
      setBrandAssignments(prev => [...prev, newAssignment]);
    } else if (type === 'category') {
      newAssignment.categoryId = itemId;
      newAssignment.category = itemData;
      setCategoryAssignments(prev => [...prev, newAssignment]);
    } else if (type === 'family') {
      newAssignment.familyId = itemId;
      newAssignment.family = itemData;
      setFamilyAssignments(prev => [...prev, newAssignment]);
    } else if (type === 'tag') {
      newAssignment.tagId = itemId;
      newAssignment.tag = itemData;
      setTagAssignments(prev => [...prev, newAssignment]);
    }
  };

  const renderAssignmentFields = (assignment, type, index) => {
    const name = assignment[type]?.name || 'Unknown';
    const itemId = assignment[`${type}Id`];
    const itemData = assignment[type];

    return (
      <Box key={`${type}-${index}`} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="subtitle1" fontWeight="bold">
            {name}
          </Typography>
          <Button
            variant="contained"
            color="success"
            size="small"
            onClick={() => handleAddQuantityTier(type, itemId, itemData)}
          >
            + Add
          </Button>
        </Box>
        <Box display="flex" gap={2} alignItems="center">
          <Box flex={1}>
            <Typography variant="caption" display="block" gutterBottom>
              Quantity (threshold)
            </Typography>
            <TextField
              fullWidth
              value={assignment.quantity}
              onChange={(e) => handleUpdateAssignment(type, index, 'quantity', e.target.value)}
              type="number"
              size="small"
              inputProps={{ min: 0 }}
              helperText="Minimum quantity for this rule (0 = no threshold)"
            />
          </Box>
          <Box flex={1}>
            <Typography variant="caption" display="block" gutterBottom>
              Earn Rate (multiplier)
            </Typography>
            <TextField
              fullWidth
              value={assignment.earnRate}
              onChange={(e) => handleUpdateAssignment(type, index, 'earnRate', e.target.value)}
              type="number"
              size="small"
              inputProps={{ min: 0, step: 0.01 }}
              helperText={assignment.earnRate > 10 ? "Warning: Values > 10 may be too high. Typical: 1.0-2.0" : "Multiplier for earning points (e.g., 1.5 = 1.5x points)"}
              error={assignment.earnRate > 10}
            />
          </Box>
          <Box flex={1}>
            <Typography variant="caption" display="block" gutterBottom>
              Redeem Value
            </Typography>
            <TextField
              fullWidth
              value={assignment.redeemRate}
              onChange={(e) => handleUpdateAssignment(type, index, 'redeemRate', e.target.value)}
              type="number"
              size="small"
              inputProps={{ min: 0, step: 0.01 }}
            />
          </Box>
          <IconButton
            color="error"
            onClick={() => handleRemoveAssignment(type, index)}
            size="small"
          >
            <DeleteIcon />
          </IconButton>
        </Box>
      </Box>
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={2}>
      <Box display="flex" alignItems="center" mb={2} >
        <Button
          startIcon={<ArrowBackIcon sx={{ fontSize: '28px !important' }} />}
          onClick={() => navigate('/setup/loyalty')}
          sx={{ ...refBlueButtonSx, mr: 2 }}
        >
          Back
        </Button>
        <Typography sx={{ fontSize: 32, fontWeight: 700, color: '#000' }}>
          Assign Loyalty - {loyaltyProgram?.outlet?.name || user?.outlet?.name || loyaltyProgram?.name || 'Unknown'}
        </Typography>
      </Box>

      <Typography paragraph sx={{ fontSize: 16, color: '#000' }}>
        Please note: The highest earn value will be selected and the lowest redeem value will be selected on conflicts, however values with zero will take highest priority.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Paper elevation={1} sx={{ p: 2, mb: 2, bgcolor: 'primary.lighter' }}>
        <Typography variant="body2" color="text.secondary">
          <strong>Available:</strong> {brands.length} Brands, {categories.length} Categories, {families.length} Families, {tags.length} Tags
          {' | '}
          <strong>Assigned:</strong> {brandAssignments.length + categoryAssignments.length + familyAssignments.length + tagAssignments.length} items
        </Typography>
      </Paper>

      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Autocomplete
          freeSolo
          options={[
            ...brands.map(b => ({ ...b, type: 'Brand', displayType: 'Brand' })),
            ...categories.map(c => ({ ...c, type: 'Category', displayType: 'Category' })),
            ...families.map(f => ({ ...f, type: 'Family', displayType: 'Family' })),
            ...tags.map(t => ({ ...t, type: 'Tag', displayType: 'Tag' }))
          ]}
          getOptionLabel={(option) => option.name || ''}
          groupBy={(option) => option.displayType || option.type}
          inputValue={searchTerm}
          onInputChange={(e, value) => setSearchTerm(value)}
          onChange={(e, value) => {
            if (value && value.id) {
              // Add the selected item
              const assignment = {
                id: null,
                quantity: 0,
                earnRate: 0,
                redeemRate: 0
              };

              if (value.type === 'Brand') {
                assignment.brandId = value.id;
                assignment.brand = value;
                const exists = brandAssignments.find(a => a.brandId === value.id);
                if (!exists) {
                  setBrandAssignments(prev => [...prev, assignment]);
                  setSuccess(`Added brand: ${value.name}`);
                }
              } else if (value.type === 'Category') {
                assignment.categoryId = value.id;
                assignment.category = value;
                const exists = categoryAssignments.find(a => a.categoryId === value.id);
                if (!exists) {
                  setCategoryAssignments(prev => [...prev, assignment]);
                  setSuccess(`Added category: ${value.name}`);
                }
              } else if (value.type === 'Family') {
                assignment.familyId = value.id;
                assignment.family = value;
                const exists = familyAssignments.find(a => a.familyId === value.id);
                if (!exists) {
                  setFamilyAssignments(prev => [...prev, assignment]);
                  setSuccess(`Added family: ${value.name}`);
                }
              } else if (value.type === 'Tag') {
                assignment.tagId = value.id;
                assignment.tag = value;
                const exists = tagAssignments.find(a => a.tagId === value.id);
                if (!exists) {
                  setTagAssignments(prev => [...prev, assignment]);
                  setSuccess(`Added tag: ${value.name}`);
                }
              }
              setSearchTerm('');
            }
          }}
          forcePopupIcon
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search for Brands, Categories, Families or Tags..."
              variant="outlined"
              fullWidth
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '8px',
                  minHeight: 42,
                  '& fieldset': { border: '1px solid #404040' },
                  '&:hover fieldset': { border: '1px solid #404040' },
                  '&.Mui-focused fieldset': { border: '2px solid #000' }
                },
                '& input::placeholder': { color: '#808080', opacity: 1 }
              }}
            />
          )}
          renderOption={(props, option) => {
            // eslint-disable-next-line no-unused-vars
            const { key, ...optionProps } = props;
            return (
              <li key={`${option.type}-${option.id}`} {...optionProps}>
                <Box>
                  <Typography variant="body2">{option.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.displayType || option.type}
                  </Typography>
                </Box>
              </li>
            );
          }}
          sx={{ mb: 2 }}
        />

        <Box display="flex" gap={1} mb={3} flexWrap="wrap">
          <Button onClick={handleAddAllBrands} sx={refAddAllButtonSx}>
            Add All Brands
          </Button>
          <Button onClick={handleAddAllCategories} sx={refAddAllButtonSx}>
            Add All Categories
          </Button>
          <Button onClick={handleAddAllFamilies} sx={refAddAllButtonSx}>
            Add All Families
          </Button>
          <Button onClick={handleAddAllTags} sx={refAddAllButtonSx}>
            Add All Tags
          </Button>
        </Box>

        {brandAssignments.length === 0 && 
         categoryAssignments.length === 0 && 
         familyAssignments.length === 0 && 
         tagAssignments.length === 0 && (
          <Box textAlign="center" py={4}>
            <Typography variant="body1" color="text.secondary">
              No items assigned yet. Use the search or "Add All" buttons above to add items.
            </Typography>
          </Box>
        )}

        {brandAssignments.length > 0 && (
          <Box mb={4}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Brand
              <Typography component="span" variant="caption" color="text.secondary">
                ({brandAssignments.length} assigned)
              </Typography>
            </Typography>
            {brandAssignments.map((assignment, index) =>
              renderAssignmentFields(assignment, 'brand', index)
            )}
          </Box>
        )}

        {categoryAssignments.length > 0 && (
          <Box mb={4}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Category
              <Typography component="span" variant="caption" color="text.secondary">
                ({categoryAssignments.length} assigned)
              </Typography>
            </Typography>
            {categoryAssignments.map((assignment, index) =>
              renderAssignmentFields(assignment, 'category', index)
            )}
          </Box>
        )}

        {familyAssignments.length > 0 && (
          <Box mb={4}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Family
              <Typography component="span" variant="caption" color="text.secondary">
                ({familyAssignments.length} assigned)
              </Typography>
            </Typography>
            {familyAssignments.map((assignment, index) =>
              renderAssignmentFields(assignment, 'family', index)
            )}
          </Box>
        )}

        {tagAssignments.length > 0 && (
          <Box mb={4}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              Tag
              <Typography component="span" variant="caption" color="text.secondary">
                ({tagAssignments.length} assigned)
              </Typography>
            </Typography>
            {tagAssignments.map((assignment, index) =>
              renderAssignmentFields(assignment, 'tag', index)
            )}
          </Box>
        )}
      </Paper>

      <Box display="flex" justifyContent="flex-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={20} /> : <SaveOutlinedIcon sx={{ fontSize: '28px !important' }} />}
          sx={refBlueButtonSx}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
};

export default AssignLoyalty;
