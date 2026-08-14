import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import PageLoader from '../../components/Common/PageLoader';
import { roleService } from '../../services/roleService';
import { formatRevisionValue } from '../../utils/revisionValue';

// Shopfront reference has no transitions and no ripple anywhere.
const INSTANT = 'all 0s ease';

const RoleRevisions = () => {
  const navigate = useNavigate();
  const { roleId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [roleName, setRoleName] = useState('');
  const [revisions, setRevisions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    roleService
      .getRoleRevisions(roleId)
      .then((data) => {
        if (cancelled) return;
        setRevisions(data.revisions || []);
        setRoleName(data.role?.name || '');
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load revision history');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [roleId]);

  if (loading) return <PageLoader />;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button
          disableRipple
          disableElevation
          variant="contained"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(`/setup/roles/${roleId}/permissions`)}
          sx={{
            bgcolor: '#5ebbeb',
            color: '#fff',
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 16,
            height: 42,
            borderRadius: '12px',
            px: 2.5,
            boxShadow: 'none',
            transition: INSTANT,
            '&:hover': { bgcolor: '#0ea5e9', boxShadow: 'none' },
          }}
        >
          Back
        </Button>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {roleName ? `${roleName} Revisions` : 'Revisions'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <TableHead>
            <TableRow sx={{ '& th': { fontWeight: 700, fontSize: 16, color: '#313439' } }}>
              <TableCell>Field</TableCell>
              <TableCell>From</TableCell>
              <TableCell>To</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Timestamp</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ '& tr:nth-of-type(odd)': { bgcolor: '#f8f8f8' } }}>
            {revisions.length > 0 ? (
              revisions.map((rev, idx) => (
                <TableRow key={`rev-${idx}`}>
                  <TableCell>{rev.field}</TableCell>
                  <TableCell>{formatRevisionValue(rev.from)}</TableCell>
                  <TableCell>{formatRevisionValue(rev.to)}</TableCell>
                  <TableCell>{rev.user || '-'}</TableCell>
                  <TableCell>
                    {rev.timestamp ? new Date(rev.timestamp).toLocaleString() : '-'}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography sx={{ fontSize: 16, color: '#676b72' }}>
                    No revisions found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default RoleRevisions;
