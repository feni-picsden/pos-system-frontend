import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@mui/material';
import { AccessTime as RevisionsIcon } from '@mui/icons-material';

// Reference: a report opened from Favourite Reports > View shows a "Revisions"
// button next to Save (Report Revision History). Renders nothing otherwise.
const FavouriteRevisionsButton = ({ sx }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const favouriteId = searchParams.get('favouriteId');
  if (!favouriteId) return null;
  return (
    <Button variant="outlined" startIcon={<RevisionsIcon />} onClick={() => navigate(`/reports/favourite/${favouriteId}/revisions`)} sx={sx}>
      Revisions
    </Button>
  );
};

export default FavouriteRevisionsButton;
