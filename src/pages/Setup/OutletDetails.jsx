import React, { useState, useEffect } from 'react';
import PageLoader from '../../components/Common/PageLoader';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip
} from '@mui/material';
import {
  Store as StoreIcon,
  People as PeopleIcon,
  Security as SecurityIcon,
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import outletService from '../../services/outletService';
// import userService from '../../services/userService';
// import roleService from '../../services/roleService';

// Parity-system primary button (matches Outlets.jsx / Dashboard rails).
const PRIMARY_BUTTON_SX = {
  bgcolor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  boxShadow: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  '&:hover': { bgcolor: '#4aa9dd', boxShadow: 'none' },
};

const CANCEL_BUTTON_SX = {
  bgcolor: '#8a8d91',
  color: '#fff',
  textTransform: 'none',
  borderRadius: '12px',
  fontWeight: 700,
  fontSize: 16,
  height: 42,
  px: 3,
  boxShadow: 'none',
  '&:hover': { bgcolor: '#76797d', boxShadow: 'none' },
};

const OutletDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [outlet, setOutlet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchOutletDetails();
  }, [id]);

  const fetchOutletDetails = async () => {
    try {
      setLoading(true);
      const response = await outletService.getOutletById(id);
      setOutlet(response.outlet);
      setFormData({
        name: response.outlet.name,
        code: response.outlet.code,
        address: response.outlet.address || '',
        description: response.outlet.description || ''
      });
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to fetch outlet details');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditDialog = () => {
    setFormData({
      name: outlet.name,
      code: outlet.code,
      address: outlet.address || '',
      description: outlet.description || ''
    });
    setFormErrors({});
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    if (!formData.code.trim()) {
      errors.code = 'Code is required';
    }
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      await outletService.updateOutlet(id, formData);
      handleCloseEditDialog();
      fetchOutletDetails();
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to update outlet';
      setFormErrors({ general: errorMessage });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/outlets')}
          sx={{ mt: 2 }}
        >
          Back to Outlets
        </Button>
      </Box>
    );
  }

  if (!outlet) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Outlet not found</Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/outlets')}
          sx={{ mt: 2 }}
        >
          Back to Outlets
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <IconButton onClick={() => navigate('/outlets')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4" component="h1">
            <StoreIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            {outlet.name}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disableRipple
          disableElevation
          startIcon={<EditIcon />}
          onClick={handleOpenEditDialog}
          sx={PRIMARY_BUTTON_SX}
        >
          Edit Outlet
        </Button>
      </Box>

      {/* Outlet Info Card */}
      <Card sx={{ mb: 3 }}>
        <CardHeader
          title="Outlet Information"
          avatar={<StoreIcon color="primary" />}
        />
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Name
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {outlet.name}
              </Typography>
            </Grid>
                         <Grid item xs={12} md={6}>
               <Typography variant="subtitle2" color="text.secondary">
                 Code
               </Typography>
               <Typography variant="body1" sx={{ mb: 2 }}>
                 {outlet.code}
               </Typography>
             </Grid>
             <Grid item xs={12} md={6}>
               <Typography variant="subtitle2" color="text.secondary">
                 Address
               </Typography>
               <Typography variant="body1" sx={{ mb: 2 }}>
                 {outlet.address || 'No address provided'}
               </Typography>
             </Grid>
             <Grid item xs={12} md={6}>
               <Typography variant="subtitle2" color="text.secondary">
                 Description
               </Typography>
               <Typography variant="body1" sx={{ mb: 2 }}>
                 {outlet.description || 'No description provided'}
               </Typography>
             </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Created At
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {formatDate(outlet.createdAt)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <PeopleIcon color="primary" sx={{ fontSize: 40 }} />
                <Box>
                                     <Typography variant="h4" component="div">
                     {outlet._count?.user_outlets || 0}
                   </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Users
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2}>
                <SecurityIcon color="secondary" sx={{ fontSize: 40 }} />
                <Box>
                                     <Typography variant="h4" component="div">
                     {outlet.user_outlets?.filter(uo => uo.roleId).length || 0}
                   </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Roles
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Users" />
          <Tab label="Roles" />
        </Tabs>
        <Divider />

        {/* Users Tab */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Users</Typography>
              <Button
                variant="contained"
                disableRipple
                disableElevation
                startIcon={<AddIcon />}
                onClick={() => navigate(`/outlets/${id}/users/new`)}
                sx={PRIMARY_BUTTON_SX}
              >
                Add User
              </Button>
            </Box>
                         {outlet.user_outlets && outlet.user_outlets.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                                         {outlet.user_outlets.map((userOutlet) => (
                                             <TableRow key={userOutlet.id}>
                         <TableCell>
                           <Typography variant="subtitle2">
                             {userOutlet.users.name}
                           </Typography>
                         </TableCell>
                         <TableCell>
                           <Chip
                             label={userOutlet.roles?.name || userOutlet.users.role || 'No Role'}
                             size="small"
                             color={userOutlet.users.hasAllPermission ? 'error' : 'default'}
                           />
                         </TableCell>
                         <TableCell>
                           <Chip
                             label={userOutlet.users.isActive ? 'Active' : 'Inactive'}
                             size="small"
                             color={userOutlet.users.isActive ? 'success' : 'error'}
                             variant="outlined"
                           />
                         </TableCell>
                         <TableCell>{formatDate(userOutlet.users.createdAt)}</TableCell>
                         <TableCell align="center">
                           <Tooltip title="Edit User">
                             <IconButton
                               size="small"
                               onClick={() => navigate(`/setup/users/${userOutlet.users.id}/edit`)}
                             >
                               <EditIcon />
                             </IconButton>
                           </Tooltip>
                         </TableCell>
                       </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No users assigned to this outlet
                </Typography>
                <Button
                  variant="contained"
                  disableRipple
                  disableElevation
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/outlets/${id}/users/new`)}
                  sx={{ ...PRIMARY_BUTTON_SX, mt: 2 }}
                >
                  Add First User
                </Button>
              </Box>
            )}
          </Box>
        )}

        {/* Roles Tab */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">Roles</Typography>
              <Button
                variant="contained"
                disableRipple
                disableElevation
                startIcon={<AddIcon />}
                onClick={() => navigate(`/outlets/${id}/roles/new`)}
                sx={PRIMARY_BUTTON_SX}
              >
                Add Role
              </Button>
            </Box>
                         {outlet.user_outlets && outlet.user_outlets.filter(uo => uo.roleId).length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Users</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                                         {outlet.user_outlets
                       .filter(uo => uo.roleId)
                       .map((userOutlet) => (
                                             <TableRow key={userOutlet.roles.id}>
                         <TableCell>
                           <Typography variant="subtitle2">
                             {userOutlet.roles.name}
                           </Typography>
                         </TableCell>
                         <TableCell>
                           {userOutlet.roles.description || 'No description'}
                         </TableCell>
                         <TableCell>
                           <Chip
                             label={userOutlet.roles.isActive ? 'Active' : 'Inactive'}
                             size="small"
                             color={userOutlet.roles.isActive ? 'success' : 'error'}
                             variant="outlined"
                           />
                         </TableCell>
                         <TableCell>
                           <Chip
                             label={outlet.user_outlets.filter(uo => uo.roleId === userOutlet.roleId).length}
                             size="small"
                             color="primary"
                             variant="outlined"
                           />
                         </TableCell>
                         <TableCell align="center">
                           <Tooltip title="Edit Role">
                             <IconButton
                               size="small"
                               onClick={() => navigate(`/setup/roles/${userOutlet.roles.id}/permissions`)}
                             >
                               <EditIcon />
                             </IconButton>
                           </Tooltip>
                         </TableCell>
                       </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Box textAlign="center" py={4}>
                <Typography variant="body1" color="text.secondary">
                  No roles created for this outlet
                </Typography>
                <Button
                  variant="contained"
                  disableRipple
                  disableElevation
                  startIcon={<AddIcon />}
                  onClick={() => navigate(`/outlets/${id}/roles/new`)}
                  sx={{ ...PRIMARY_BUTTON_SX, mt: 2 }}
                >
                  Add First Role
                </Button>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Outlet</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1 }}>
            {formErrors.general && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {formErrors.general}
              </Alert>
            )}
                         <TextField
               fullWidth
               label="Outlet Name"
               value={formData.name}
               onChange={(e) => setFormData({ ...formData, name: e.target.value })}
               error={!!formErrors.name}
               helperText={formErrors.name}
               margin="normal"
               required
             />
             <TextField
               fullWidth
               label="Outlet Code"
               value={formData.code}
               onChange={(e) => setFormData({ ...formData, code: e.target.value })}
               error={!!formErrors.code}
               helperText={formErrors.code}
               margin="normal"
               required
             />
             <TextField
               fullWidth
               label="Address"
               value={formData.address}
               onChange={(e) => setFormData({ ...formData, address: e.target.value })}
               error={!!formErrors.address}
               helperText={formErrors.address}
               margin="normal"
               multiline
               rows={2}
             />
             <TextField
               fullWidth
               label="Description"
               value={formData.description}
               onChange={(e) => setFormData({ ...formData, description: e.target.value })}
               error={!!formErrors.description}
               helperText={formErrors.description}
               margin="normal"
               multiline
               rows={2}
             />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1.25 }}>
          <Button disableRipple onClick={handleCloseEditDialog} disabled={submitting} sx={CANCEL_BUTTON_SX}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            disableRipple
            disableElevation
            disabled={submitting}
            sx={PRIMARY_BUTTON_SX}
          >
            {submitting ? 'Updating...' : 'Update'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OutletDetails;
