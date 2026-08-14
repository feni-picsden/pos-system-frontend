import React from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {
  PriorityHigh as PriorityHighIcon,
  QuestionMark as QuestionMarkIcon,
} from '@mui/icons-material';

// Confirm dialogs for the Future Prices / Future Costs pages, measured off the Shopfront
// reference 2026-07-17. The reference uses TWO different shells on these sibling pages:
//
//   layout="medallion" (Future Prices): 981px square-cornered panel, 120px medallion sitting
//     half-outside the top, centered title + prompt, two equal 48px square footer buttons.
//   layout="bar" (Future Costs): 823px 8px-radius panel, tinted header bar with an inline icon,
//     left-aligned prompt, right-aligned 118x42 pill buttons.
//
// Both render the affected row in a #5ebbeb-headed table. Pass `columns` to describe it.
const MEDALLION_FOOTER_SX = {
  flex: 1,
  height: 48,
  borderRadius: 0,
  fontSize: 32,
  fontWeight: 400,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { boxShadow: 'none' },
};

const BAR_FOOTER_SX = {
  width: 118,
  height: 42,
  borderRadius: '12px',
  fontSize: 16,
  fontWeight: 700,
  textTransform: 'none',
  boxShadow: 'none',
  transition: 'none',
  '&:hover': { boxShadow: 'none' },
};

// Reference centers the cells in the medallion layout but left-aligns them in the bar layout.
const RowTable = ({ row, columns, cellAlign }) => (
  <TableContainer>
    <Table>
      <TableHead>
        <TableRow
          sx={{
            '& th': {
              bgcolor: '#5ebbeb',
              color: '#fff',
              fontWeight: 700,
              fontSize: 16,
              textAlign: 'center',
              border: 0,
            },
          }}
        >
          {columns.map((col) => (
            <TableCell key={col.label}>{col.label}</TableCell>
          ))}
        </TableRow>
      </TableHead>
      <TableBody>
        <TableRow sx={{ '& td': { fontSize: 16, p: 2, border: 0, textAlign: cellAlign } }}>
          {columns.map((col) => (
            <TableCell key={col.label}>{col.get(row)}</TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  </TableContainer>
);

const FutureConfirmDialog = ({
  open,
  variant,
  noun,
  row,
  count,
  columns,
  message,
  loading,
  onCancel,
  onConfirm,
  layout = 'medallion',
}) => {
  const isDelete = variant === 'delete';
  const verb = isDelete ? 'delete' : 'apply';
  const nounLower = (noun || '').toLowerCase();
  const title = `${isDelete ? 'Delete' : 'Apply'} ${noun}`;
  const busyLabel = isDelete ? 'Deleting...' : 'Applying...';
  const actionLabel = isDelete ? 'Delete' : 'Apply';

  const prompt =
    message ||
    (row
      ? `Are you sure you want to ${verb} the ${nounLower}?`
      : `Are you sure you want to ${verb} ${count} ${nounLower}(s)?`);

  const Icon = isDelete ? PriorityHighIcon : QuestionMarkIcon;
  const showTable = !!row && columns?.length > 0;

  if (layout === 'bar') {
    // Reference tints the header bar and the title with the action's colour ramp.
    const barBg = isDelete ? '#fecaca' : '#bae6fd';
    const barFg = isDelete ? '#991b1b' : '#075985';
    const confirmBg = isDelete ? '#ef4444' : '#0ea5e9';
    const confirmHoverBg = isDelete ? '#dc2626' : '#0284c7';

    return (
      <Dialog
        open={open}
        onClose={onCancel}
        maxWidth={false}
        PaperProps={{
          sx: { width: 823, maxWidth: '100%', borderRadius: '8px', boxShadow: 'none' },
        }}
      >
        <Box
          sx={{
            height: 60,
            px: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: barBg,
            borderRadius: '8px 8px 0 0',
          }}
        >
          <Icon sx={{ fontSize: 20, color: barFg }} />
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: barFg }}>{title}</Typography>
        </Box>

        <DialogContent sx={{ p: 2 }}>
          <Typography sx={{ fontSize: 16, color: '#171717', mb: 2 }}>{prompt}</Typography>
          {showTable && <RowTable row={row} columns={columns} cellAlign="left" />}
        </DialogContent>

        <DialogActions sx={{ p: 2, pt: 0, gap: 2, justifyContent: 'flex-end' }}>
          <Button
            onClick={onCancel}
            sx={{
              ...BAR_FOOTER_SX,
              bgcolor: '#d4d4d4',
              color: '#000',
              '&:hover': { bgcolor: '#c4c4c4', boxShadow: 'none' },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            sx={{
              ...BAR_FOOTER_SX,
              bgcolor: confirmBg,
              color: '#fff',
              '&:hover': { bgcolor: confirmHoverBg, boxShadow: 'none' },
              '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
            }}
          >
            {loading ? busyLabel : actionLabel}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  const medallionBg = isDelete ? '#e3342f' : '#1c86f2';
  const confirmBg = isDelete ? '#e3342f' : '#32b643';
  const confirmHoverBg = isDelete ? '#c92c28' : '#2a9c39';

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 981,
          maxWidth: '100%',
          borderRadius: 0,
          overflow: 'visible',
          boxShadow: '0 0 30px 0 rgba(0,0,0,0.25)',
          mt: '60px',
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: -60,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 120,
          height: 120,
          borderRadius: '100%',
          bgcolor: medallionBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sx={{ fontSize: isDelete ? 64 : 56, color: '#fff' }} />
      </Box>

      <DialogContent sx={{ pt: '76px', px: 4, pb: 0 }}>
        <Typography
          component="h3"
          sx={{ fontSize: '18.72px', fontWeight: 700, color: '#000', textAlign: 'center', mb: 2 }}
        >
          {title}
        </Typography>
        <Typography sx={{ fontSize: 16, color: '#000', textAlign: 'center', mb: 3 }}>
          {prompt}
        </Typography>
        {showTable && <RowTable row={row} columns={columns} cellAlign="center" />}
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 2 }}>
        <Button
          onClick={onCancel}
          sx={{
            ...MEDALLION_FOOTER_SX,
            bgcolor: '#f8f8f8',
            color: '#676b72',
            border: '1px solid #676b72',
            '&:hover': { bgcolor: '#f0f0f0', boxShadow: 'none' },
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          sx={{
            ...MEDALLION_FOOTER_SX,
            bgcolor: confirmBg,
            color: '#f8f8f8',
            border: '1px solid #f8f8f8',
            '&:hover': { bgcolor: confirmHoverBg, boxShadow: 'none' },
            '&.Mui-disabled': { bgcolor: '#404040', color: '#737373' },
          }}
        >
          {loading ? busyLabel : actionLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FutureConfirmDialog;
