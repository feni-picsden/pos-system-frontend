import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Divider,
  Alert,
  Chip,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import PermissionGate from '../Common/PermissionGate';
import { usePermissions } from '../../hooks/usePermissions';

/**
 * Example component showing how to use the permission system
 * This demonstrates various ways to implement permission-based UI
 */
const PermissionExamples = () => {
  const { permissions, user } = usePermissions();

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Permission System Examples
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        This page demonstrates how to use the permission system in your components.
        Your current permissions are shown below.
      </Alert>

      {/* Current User Permissions */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Your Current Permissions
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          User: {user?.name || 'Unknown'} | Role: {user?.role || 'Unknown'}
        </Typography>
        
        {user?.hasAllPermission ? (
          <Chip 
            label="Super Admin - All Permissions" 
            color="error" 
            sx={{ mb: 2 }}
          />
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" gutterBottom>
              Permissions ({permissions.length}):
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {permissions.map((permission) => (
                <Chip 
                  key={permission} 
                  label={permission} 
                  size="small" 
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </Paper>

      <Grid container spacing={3}>
        {/* Example 1: Single Permission Check */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Example 1: Single Permission
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Shows button only if user has 'users.add' permission
            </Typography>
            
            <PermissionGate permission="users.add">
              <Button 
                variant="contained" 
                startIcon={<AddIcon />}
                sx={{ mb: 2 }}
              >
                Add User
              </Button>
            </PermissionGate>
            
            <PermissionGate 
              permission="users.add"
              fallback={
                <Alert severity="warning">
                  You don't have permission to add users
                </Alert>
              }
            >
              <Alert severity="success">
                You can add users!
              </Alert>
            </PermissionGate>
          </Paper>
        </Grid>

        {/* Example 2: Multiple Permission Check (ANY) */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Example 2: Any Permission
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Shows content if user has ANY of the specified permissions
            </Typography>
            
            <PermissionGate anyPermission={['users.edit', 'users.delete']}>
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <PermissionGate permission="users.edit">
                  <Button 
                    variant="outlined" 
                    startIcon={<EditIcon />}
                    size="small"
                  >
                    Edit
                  </Button>
                </PermissionGate>
                <PermissionGate permission="users.delete">
                  <Button 
                    variant="outlined" 
                    color="error"
                    startIcon={<DeleteIcon />}
                    size="small"
                  >
                    Delete
                  </Button>
                </PermissionGate>
              </Box>
            </PermissionGate>
            
            <PermissionGate 
              anyPermission={['users.edit', 'users.delete']}
              fallback={
                <Alert severity="warning">
                  You can't edit or delete users
                </Alert>
              }
            >
              <Alert severity="success">
                You can perform user management actions!
              </Alert>
            </PermissionGate>
          </Paper>
        </Grid>

        {/* Example 3: All Permissions Required */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Example 3: All Permissions Required
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Shows content only if user has ALL specified permissions
            </Typography>
            
            <PermissionGate allPermissions={['users.view', 'users.edit', 'users.delete']}>
              <Button 
                variant="contained" 
                color="secondary"
                startIcon={<VisibilityIcon />}
                sx={{ mb: 2 }}
              >
                Full User Management
              </Button>
            </PermissionGate>
            
            <PermissionGate 
              allPermissions={['users.view', 'users.edit', 'users.delete']}
              fallback={
                <Alert severity="info">
                  You need view, edit, AND delete permissions for full access
                </Alert>
              }
            >
              <Alert severity="success">
                You have full user management access!
              </Alert>
            </PermissionGate>
          </Paper>
        </Grid>

        {/* Example 4: Nested Permissions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Example 4: Nested Permission Checks
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Complex permission logic with nested components
            </Typography>
            
            <PermissionGate permission="users.view">
              <Box sx={{ p: 2, backgroundColor: '#f5f5f5', borderRadius: 1, mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  User List (you can view users)
                </Typography>
                
                <PermissionGate permission="users.add">
                  <Button size="small" variant="outlined" sx={{ mr: 1 }}>
                    Add User
                  </Button>
                </PermissionGate>
                
                <PermissionGate permission="users.edit">
                  <Button size="small" variant="outlined" sx={{ mr: 1 }}>
                    Edit Users
                  </Button>
                </PermissionGate>
                
                <PermissionGate permission="users.delete">
                  <Button size="small" variant="outlined" color="error">
                    Delete Users
                  </Button>
                </PermissionGate>
              </Box>
            </PermissionGate>
            
            <PermissionGate 
              permission="users.view"
              fallback={
                <Alert severity="error">
                  You cannot view the user list
                </Alert>
              }
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Code Examples */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Implementation Code Examples
        </Typography>
        
        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          1. Using PermissionGate Component:
        </Typography>
        <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {`<PermissionGate permission="users.add">
  <Button>Add User</Button>
</PermissionGate>`}
        </Box>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          2. Using Permission Hooks:
        </Typography>
        <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {`const canAddUsers = useHasPermission('users.add');
const canEditOrDelete = useHasAnyPermission(['users.edit', 'users.delete']);

return (
  <>
    {canAddUsers && <Button>Add User</Button>}
    {canEditOrDelete && <div>Management Options</div>}
  </>
);`}
        </Box>

        <Typography variant="subtitle2" gutterBottom sx={{ mt: 2 }}>
          3. Backend API Security (Always Required):
        </Typography>
        <Box sx={{ backgroundColor: '#f5f5f5', p: 2, borderRadius: 1, fontFamily: 'monospace', fontSize: '0.875rem' }}>
          {`// Frontend UI checks are for UX only
// Backend must ALWAYS verify permissions:
app.post('/api/users', requirePermission('users.add'), (req, res) => {
  // Create user logic
});`}
        </Box>
      </Paper>
    </Box>
  );
};

export default PermissionExamples;
