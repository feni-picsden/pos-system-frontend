import React, { useState } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Checkbox,
  Grid,
  Paper,
  Divider,
  Icon,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Inventory as InventoryIcon,
  PriceChange as PriceChangeIcon,
  LocalOffer as LocalOfferIcon,
  PointOfSale as PointOfSaleIcon,
  Assessment as AssessmentIcon,
  Warehouse as WarehouseIcon,
  Business as BusinessIcon,
} from '@mui/icons-material';
import { PERMISSION_CATEGORIES } from '../../constants/permissions';

const PermissionSelector = ({ selectedPermissions = [], onPermissionChange }) => {
  const [expandedCategories, setExpandedCategories] = useState({});

  const iconMap = {
    person: PersonIcon,
    security: SecurityIcon,
    inventory: InventoryIcon,
    price_change: PriceChangeIcon,
    local_offer: LocalOfferIcon,
    point_of_sale: PointOfSaleIcon,
    assessment: AssessmentIcon,
    warehouse: WarehouseIcon,
    business: BusinessIcon,
  };

  const handleCategoryToggle = (categoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const handlePermissionToggle = (permission) => {
    const isSelected = selectedPermissions.includes(permission);
    let newPermissions;
    
    if (isSelected) {
      newPermissions = selectedPermissions.filter(p => p !== permission);
    } else {
      newPermissions = [...selectedPermissions, permission];
    }
    
    onPermissionChange(newPermissions);
  };

  const handleCategorySelectAll = (categoryKey, categoryPermissions) => {
    const allCategoryPermissions = Object.keys(categoryPermissions);
    const allSelected = allCategoryPermissions.every(p => selectedPermissions.includes(p));
    
    let newPermissions;
    if (allSelected) {
      // Deselect all category permissions
      newPermissions = selectedPermissions.filter(p => !allCategoryPermissions.includes(p));
    } else {
      // Select all category permissions
      const permissionsToAdd = allCategoryPermissions.filter(p => !selectedPermissions.includes(p));
      newPermissions = [...selectedPermissions, ...permissionsToAdd];
    }
    
    onPermissionChange(newPermissions);
  };

  const getCategoryStats = (categoryPermissions) => {
    const totalPermissions = Object.keys(categoryPermissions).length;
    const selectedCount = Object.keys(categoryPermissions).filter(p => 
      selectedPermissions.includes(p)
    ).length;
    
    return { totalPermissions, selectedCount };
  };

  const isCategoryFullySelected = (categoryPermissions) => {
    return Object.keys(categoryPermissions).every(p => selectedPermissions.includes(p));
  };

  const isCategoryPartiallySelected = (categoryPermissions) => {
    const selected = Object.keys(categoryPermissions).filter(p => selectedPermissions.includes(p));
    return selected.length > 0 && selected.length < Object.keys(categoryPermissions).length;
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
        Role Permissions
      </Typography>
      
      <Paper sx={{ p: 2, backgroundColor: '#f8f9fa', borderRadius: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select the permissions this role should have. Users with this role will only be able to perform actions they have permissions for.
        </Typography>
        
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            Total Permissions Selected: {selectedPermissions.length}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ mt: 3 }}>
        {Object.entries(PERMISSION_CATEGORIES).map(([categoryKey, category]) => {
          const IconComponent = iconMap[category.icon] || PersonIcon;
          const { totalPermissions, selectedCount } = getCategoryStats(category.permissions);
          const isFullySelected = isCategoryFullySelected(category.permissions);
          const isPartiallySelected = isCategoryPartiallySelected(category.permissions);

          return (
            <Accordion
              key={categoryKey}
              expanded={expandedCategories[categoryKey] || false}
              onChange={() => handleCategoryToggle(categoryKey)}
              sx={{
                mb: 1,
                border: '1px solid #e0e0e0',
                '&:before': { display: 'none' },
                borderRadius: '8px !important',
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{
                  backgroundColor: isFullySelected ? '#e3f2fd' : isPartiallySelected ? '#fff3e0' : '#f8f9fa',
                  borderRadius: '8px',
                  '&.Mui-expanded': {
                    borderBottomLeftRadius: 0,
                    borderBottomRightRadius: 0,
                  }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <IconComponent sx={{ mr: 2, color: '#4fc3f7' }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 500 }}>
                      {category.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedCount} of {totalPermissions} permissions selected
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={isFullySelected}
                        indeterminate={isPartiallySelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCategorySelectAll(categoryKey, category.permissions);
                        }}
                        sx={{ color: '#4fc3f7' }}
                      />
                    }
                    label=""
                    onClick={(e) => e.stopPropagation()}
                    sx={{ mr: 1 }}
                  />
                </Box>
              </AccordionSummary>
              
              <AccordionDetails sx={{ backgroundColor: '#ffffff', p: 3 }}>
                <Grid container spacing={2}>
                  {Object.entries(category.permissions).map(([permission, label]) => (
                    <Grid item xs={12} sm={6} md={4} key={permission}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={selectedPermissions.includes(permission)}
                            onChange={() => handlePermissionToggle(permission)}
                            sx={{ color: '#4fc3f7' }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontWeight: 400 }}>
                            {label}
                          </Typography>
                        }
                        sx={{
                          backgroundColor: selectedPermissions.includes(permission) ? '#f0f8ff' : 'transparent',
                          borderRadius: 1,
                          p: 1,
                          m: 0,
                          width: '100%',
                          '&:hover': {
                            backgroundColor: '#f5f5f5',
                          }
                        }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>

      <Box sx={{ mt: 3, p: 2, backgroundColor: '#e8f5e8', borderRadius: 2 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: '#2e7d32' }}>
          💡 Permission Tips:
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          • View permissions are typically required for other actions in the same category
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Users will only see menu items and buttons for actions they have permission for
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • All actions are verified on the backend for security
        </Typography>
      </Box>
    </Box>
  );
};

export default PermissionSelector;
