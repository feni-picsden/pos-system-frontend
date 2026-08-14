import React, { useEffect, useState } from 'react';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import ModifyUserDialog from '../../components/Layout/ModifyUserDialog';
import { authService } from '../../services/authService';

const EditProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authService.getProfile()
      .then((data) => {
        if (data?.user) setUser(data.user);
        else setUser(authService.getCurrentUser());
      })
      .catch(() => setUser(authService.getCurrentUser()))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 }, py: 2 }}>
      <Paper sx={{ p: { xs: 1, sm: 2 }, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Edit Profile
        </Typography>
        {loading || !user ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <ModifyUserDialog
            open={true}
            onClose={() => {}}
            user={user}
            onUserUpdated={(u) => setUser((prev) => ({ ...prev, ...u }))}
            asPage={true}
          />
        )}
      </Paper>
    </Box>
  );
};

export default EditProfile;

