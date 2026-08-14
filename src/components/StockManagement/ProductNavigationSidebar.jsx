import React from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Button,
  Divider,
} from '@mui/material';
import {
  Home as HomeIcon,
  GridView as GridViewIcon,
  History as HistoryIcon,
  Assignment as AssignmentIcon,
  SwapHoriz as SwapHorizIcon,
  LocalOffer as LocalOfferIcon,
  RestoreFromTrash as RevisionIcon,
  Business as BusinessIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useAppDialogs } from '../Common/AppDialogProvider';

const ProductNavigationSidebar = ({ 
  activeTab, 
  onTabChange, 
  onEdit, 
  onDelete,
  productName 
}) => {
  // In-app dialogs — these shadow window.alert/confirm/prompt on purpose.
  const { confirm } = useAppDialogs();
  const navigationItems = [
    {
      id: 'home',
      label: 'Home',
      icon: <HomeIcon />,
      description: 'View product details and basic statistics',
    },
    {
      id: 'salesSummary',
      label: 'Sales Summary',
      icon: <GridViewIcon />,
      description: 'See a quick snapshot of this product\'s sales history',
    },
    {
      id: 'salesHistory',
      label: 'Sales History',
      icon: <HistoryIcon />,
      description: 'View all sales for this product',
    },
    {
      id: 'purchaseHistory',
      label: 'Purchase History',
      icon: <AssignmentIcon />,
      description: 'View all purchases for this product',
    },
    {
      id: 'transferHistory',
      label: 'Transfer History',
      icon: <SwapHorizIcon />,
      description: 'View all transfers for this product',
    },
    {
      id: 'promotions',
      label: 'Promotions',
      icon: <LocalOfferIcon />,
      description: 'Check which promotions apply to the product',
    },
    {
      id: 'revision',
      label: 'Revision History',
      icon: <RevisionIcon />,
      description: 'Check the recent changes made to this product',
    },
    {
      id: 'inventoryLog',
      label: 'Inventory Log',
      icon: <BusinessIcon />,
      description: 'View the changes made to the inventory',
    },
  ];

  const handleDelete = async () => {
    if (await confirm(`Delete "${productName}"? This cannot be undone.`, { title: 'Delete product', confirmText: 'Delete product' })) {
      onDelete();
    }
  };

  return (
    <Box
      sx={{
        width: 300,
        height: '100%',
        pl: 1,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Edit - green text link on the #f8f8f8 title-bar strip at the top of the rail */}
      <Box
        sx={{
          mb: 1,
          backgroundColor: '#f8f8f8',
          border: '1px solid #000',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <Button
          startIcon={<EditIcon />}
          onClick={onEdit}
          sx={{
            backgroundColor: 'transparent',
            boxShadow: 'none',
            borderRadius: 0,
            color: '#16a34a',
            fontWeight: 700,
            fontSize: 16,
            textTransform: 'none',
            px: 2,
            '&:hover': { backgroundColor: 'transparent', boxShadow: 'none' },
          }}
        >
          Edit
        </Button>
      </Box>

      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {/* Navigation Items */}
        <Box
          sx={{
            backgroundColor: '#f8f8f8',
            border: '1px solid #000',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <List sx={{ p: 1 }}>
            {navigationItems.map((item) => (
              <ListItem key={item.id} disablePadding>
                <ListItemButton
                  onClick={() => onTabChange(item.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    backgroundColor: activeTab === item.id ? '#e3f2fd' : 'transparent',
                    '&:hover': {
                      backgroundColor: activeTab === item.id ? '#e3f2fd' : '#e0e0e0',
                    },
                    transition: 'background-color 0.2s ease',
                  }}
                >
                  <ListItemIcon
                    sx={{
                      color: activeTab === item.id ? '#0284c7' : '#000',
                      minWidth: 40,
                      '& svg': { fontSize: 24 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        sx={{
                          color: activeTab === item.id ? '#0284c7' : '#000',
                          fontWeight: 700,
                          fontSize: 16,
                        }}
                      >
                        {item.label}
                      </Typography>
                    }
                    secondary={
                      <Typography
                        variant="caption"
                        sx={{
                          color: '#676b72',
                          fontSize: '0.75rem',
                          lineHeight: 1.2,
                        }}
                      >
                        {item.description}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>

        {/* Delete - red text link kept at the bottom of the rail */}
        <Box
          sx={{
            mt: 1,
            backgroundColor: '#f8f8f8',
            border: '1px solid #000',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          <Button
            startIcon={<DeleteIcon />}
            onClick={handleDelete}
            sx={{
              backgroundColor: 'transparent',
              boxShadow: 'none',
              borderRadius: 0,
              color: '#dc2626',
              fontWeight: 700,
              fontSize: 16,
              textTransform: 'none',
              px: 2,
              '&:hover': { backgroundColor: 'transparent', boxShadow: 'none' },
            }}
          >
            Delete
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default ProductNavigationSidebar;
