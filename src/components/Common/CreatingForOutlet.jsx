import { Box, Typography } from '@mui/material';
import { PlaceOutlined as OutletIcon, PublicOutlined as GlobalIcon } from '@mui/icons-material';
import { useSelectedOutlet } from '../../contexts/SelectedOutletContext';

/**
 * One line under a create/edit form's title saying which outlet the record
 * will belong to. It states what the form will actually send, not what the
 * navbar shows — a global admin working "in Main Outlet" still creates a GLOBAL
 * record on every form that does not send an outletId, and that record then
 * appears in every outlet. This is the warning that makes that visible.
 *
 * Props:
 *  - outletId: the outlet the form will send. Omit when the form sends none.
 *    For an outlet user the session outlet is what the server will store, so
 *    that is shown regardless.
 */
const CreatingForOutlet = ({ outletId, sx }) => {
  const { outlets, selectedOutlet, isTrueSuperAdmin } = useSelectedOutlet();

  let label;
  let global = false;
  if (!isTrueSuperAdmin) {
    // Pinned user: the server stores their outlet whatever the form sends.
    label = selectedOutlet?.name || 'your outlet';
  } else if (outletId != null) {
    label = outlets.find((o) => o.id === Number(outletId))?.name || `Outlet #${outletId}`;
  } else {
    label = 'All Outlets';
    global = true;
  }

  // A quiet, centred caption under the dialog title — a small pill, not a
  // banner, so it reads as context rather than as a warning box. The global
  // case alone gets an amber tint, because that is the one to notice.
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1, ...sx }}>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.25,
          py: 0.4,
          borderRadius: '999px',
          bgcolor: global ? '#fff4dc' : '#f3f4f6',
          color: global ? '#8a5a00' : '#4b5563',
          fontSize: 12.5,
          lineHeight: 1.4,
        }}
      >
        {global ? <GlobalIcon sx={{ fontSize: 15 }} /> : <OutletIcon sx={{ fontSize: 15 }} />}
        <Typography component="span" sx={{ fontSize: 'inherit', color: 'inherit' }}>
          Creating for <b>{label}</b>
          {global && ' · visible in every outlet'}
        </Typography>
      </Box>
    </Box>
  );
};

export default CreatingForOutlet;
