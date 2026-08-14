import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
} from '@mui/material';
import { PrintOutlined, MeetingRoomOutlined as MeetingRoomOutlinedIcon } from '@mui/icons-material';
import cashManagementService from '../services/cashManagementService';
import drawerService from '../services/drawerService';
import settingsService from '../services/settingsService';
import { formatCurrency } from '../utils/currency';
import CashActionDialog from '../components/CashDrawer/CashActionDialog';
import NiceError from '../components/Common/NiceError';
import { useHasPermission, useHasAnyPermission } from '../hooks/usePermissions';

const ACTION_BTN_SX = {
  backgroundColor: '#5ebbeb',
  color: '#fff',
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 700,
  height: 42,
  padding: '8px 32px',
  borderRadius: '12px',
  boxShadow: 'none',
  '&:hover': { backgroundColor: '#4aa9dd', boxShadow: 'none' },
  '&.Mui-disabled': { backgroundColor: '#5ebbeb', color: '#fff', opacity: 0.5 },
};

const PRINT_BTN_SX = {
  backgroundColor: 'transparent',
  color: '#5ebbeb',
  border: '1px solid #5ebbeb',
  textTransform: 'none',
  fontSize: 16,
  fontWeight: 700,
  height: 42,
  padding: '8px 32px',
  borderRadius: '12px',
  boxShadow: 'none',
  flexShrink: 0,
  '&:hover': {
    backgroundColor: 'transparent',
    border: '1px solid #5ebbeb',
    boxShadow: 'none',
  },
};

const TYPE_LABELS = {
  open_drawer: 'Open Drawer',
  put_in: 'Put Cash In',
  take_out: 'Take Cash Out',
  safe_drop: 'Safe Drop',
  swap_cash: 'Swap Cash',
  shift_open: 'Shift Open',
  shift_close: 'Shift Close',
  cash_sale: 'Cash Sale',
  cash_refund: 'Cash Refund',
};

// Splits "$1,234.56" into ["$1,234", ".56"] so cents render smaller.
const splitCurrency = (amount) => {
  const formatted = formatCurrency(amount);
  const dotIndex = formatted.lastIndexOf('.');
  return dotIndex === -1
    ? [formatted, '']
    : [formatted.slice(0, dotIndex), formatted.slice(dotIndex)];
};

const formatDateTime = (dateString) =>
  new Date(dateString).toLocaleString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const getRegisterId = () => {
  const id = localStorage.getItem('selectedRegisterId');
  const parsed = parseInt(id, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// The sell screen persists the status alongside the id; a register that exists
// but isn't Open has no cash drawer to manage.
const isRegisterOpen = () =>
  localStorage.getItem('selectedRegisterStatus') === 'Open';

const ManageCash = () => {
  const canManage = useHasAnyPermission(['register.cash_drawer.manage', 'register.manage']);
  const canAccess = useHasPermission('register.cash_drawer');

  const registerId = getRegisterId();

  const [shiftData, setShiftData] = useState(null);
  const [movements, setMovements] = useState([]);
  const [, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const [dialog, setDialog] = useState(null);

  // Predefined reasons: cash out/in keep their own settings rows, the open-drawer
  // list lives in the company blob alongside its require-a-reason toggle.
  const [reasons, setReasons] = useState({ take_out: [], put_in: [], drawer: [], requireDrawerReason: false });
  useEffect(() => {
    Promise.all([
      settingsService.getCashDrawerReasons('take_out'),
      settingsService.getCashDrawerReasons('put_in'),
      settingsService.loadCachedGeneralSettings(),
    ])
      .then(([takeOut, putIn, general]) =>
        setReasons({
          take_out: takeOut?.reasons || [],
          put_in: putIn?.reasons || [],
          drawer: general?.predefinedCashDrawerReasons || [],
          requireDrawerReason: general?.requireReasonForCashDrawer === true,
        })
      )
      .catch(() => {});
  }, []);

  const [historyFilters] = useState({
    search: '',
    type: '',
    startDate: '',
    endDate: '',
    page: 1,
  });

  const showSuccess = (message) =>
    setSnackbar({ open: true, message, severity: 'success' });
  const showError = (message) =>
    setSnackbar({ open: true, message, severity: 'error' });

  const loadShift = useCallback(async () => {
    if (!registerId) {
      setShiftData(null);
      return;
    }
    const data = await cashManagementService.getShift(registerId);
    setShiftData(data);
  }, [registerId]);

  const loadMovements = useCallback(async (page = 1) => {
    if (!registerId) return;
    const params = {
      registerId,
      page,
      limit: 25,
    };
    if (historyFilters.search) params.search = historyFilters.search;
    if (historyFilters.type) params.type = historyFilters.type;
    if (historyFilters.startDate) params.startDate = historyFilters.startDate;
    if (historyFilters.endDate) params.endDate = historyFilters.endDate;

    const data = await cashManagementService.getMovements(params);
    setMovements(data.movements || []);
    setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
  }, [registerId, historyFilters]);

  const refreshAll = useCallback(async () => {
    if (!registerId) {
      setLoading(false);
      return;
    }
    try {
      setError('');
      await Promise.all([loadShift(), loadMovements(historyFilters.page)]);
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to load cash drawer data');
    } finally {
      setLoading(false);
    }
  }, [registerId, loadShift, loadMovements, historyFilters.page]);

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    refreshAll();
  }, [canAccess, refreshAll]);

  const runAction = async (fn, successMessage) => {
    if (!registerId) {
      showError('No register selected. Select a register on the sell screen first.');
      return;
    }
    try {
      setActionLoading(true);
      await fn();
      showSuccess(successMessage);
      setDialog(null);
      await refreshAll();
    } catch (err) {
      const msg =
        err?.error ||
        err?.errors?.[0]?.msg ||
        err?.message ||
        'Action failed';
      showError(msg);
    } finally {
      setActionLoading(false);
    }
  };

  // One-click: pop the physical drawer via QZ Tray (if present) AND log the open.
  // Falls back to logging only when no QZ Tray / printer is available (e.g. testing
  // without hardware), so the action always succeeds and stays auditable.
  const handleOpenDrawer = async ({ reason = 'Manual open', note = '' } = {}) => {
    if (!registerId) {
      showError('No register selected. Select a register on the sell screen first.');
      return;
    }
    setActionLoading(true);
    let suffix = '';
    try {
      try {
        const res = await drawerService.kickDrawer();
        suffix = ` (sent to ${res.printer})`;
      } catch (hwErr) {
        suffix =
          hwErr.code === 'QZ_UNAVAILABLE'
            ? ' — QZ Tray not detected, logged only'
            : ' — no printer detected, logged only';
      }
      await cashManagementService.openDrawer({ registerId, reason, notes: note });
      showSuccess(`Cash drawer opened${suffix}`);
      setDialog(null);
      await refreshAll();
    } catch (err) {
      showError(err?.error || err?.errors?.[0]?.msg || err?.message || 'Failed to open drawer');
    } finally {
      setActionLoading(false);
    }
  };

  const hasActiveShift = shiftData?.hasActiveShift;
  const summary = shiftData?.summary;

  if (!canAccess) {
    return (
      <Box sx={{ p: 1, backgroundColor: '#fff', minHeight: '100%' }}>
        <Alert severity="warning">You do not have permission to access Manage Cash.</Alert>
      </Box>
    );
  }

  if (!registerId || !isRegisterOpen()) {
    return (
      <NiceError
        icon={<MeetingRoomOutlinedIcon sx={{ fontSize: 'inherit' }} />}
        heading="Register not open"
        body="The register hasn't been opened yet so you can't manage its cash drawer."
      />
    );
  }

  return (
    <Box sx={{ p: 1, backgroundColor: '#fff', minHeight: '100%' }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {/* Cash action buttons — first content row */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Button
              variant="contained"
              onClick={() => setDialog('openDrawer')}
              disabled={actionLoading}
              sx={ACTION_BTN_SX}
            >
              Open Cash Drawer
            </Button>
            <Button
              variant="contained"
              onClick={() => setDialog('putIn')}
              disabled={!hasActiveShift}
              sx={ACTION_BTN_SX}
            >
              Put Cash In
            </Button>
            <Button
              variant="contained"
              onClick={() => setDialog('takeOut')}
              disabled={!hasActiveShift || !canManage}
              sx={ACTION_BTN_SX}
            >
              Take Cash Out
            </Button>
            <Button
              variant="contained"
              onClick={() => setDialog('safeDrop')}
              disabled={!hasActiveShift || !canManage}
              sx={ACTION_BTN_SX}
            >
              Safe Drop
            </Button>
            <Button
              variant="contained"
              onClick={() => setDialog('swap')}
              sx={ACTION_BTN_SX}
            >
              Swap Cash
            </Button>
          </Box>

          {/* Shift summary — inline label/value pairs */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', mb: 4 }}>
            <Box sx={{ minWidth: 202 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#000' }}>
                Open Time
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 400, color: '#000' }}>
                {hasActiveShift ? formatDateTime(summary.openedAt) : '—'}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#000' }}>
                Received Cash In Drawer
              </Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 400, color: '#000' }}>
                {formatCurrency(summary?.cashReceivedDuringShift ?? 0)}
              </Typography>
            </Box>
          </Box>

          {/* Recent movements */}
          <Box sx={{ maxWidth: 1024, mx: 'auto' }}>
            <Typography
              component="h2"
              sx={{ fontSize: 24, fontWeight: 700, color: '#000', mb: 4 }}
            >
              Recent Cash Movements
            </Typography>
            <MovementsList movements={movements.slice(0, 10)} />
          </Box>
        </>
      )}

      {/* Dialogs */}
      <CashActionDialog
        open={dialog === 'shiftOpen'}
        onClose={() => setDialog(null)}
        title="Shift Open"
        submitLabel="Open Shift"
        loading={actionLoading}
        requireAmount
        requireReason={false}
        noteLabel="Note (optional)"
        onSubmit={({ amount, note }) =>
          runAction(
            () =>
              cashManagementService.openShift({
                registerId,
                openingBalance: amount,
                notes: note,
              }),
            'Shift opened successfully'
          )
        }
      />

      <CashActionDialog
        open={dialog === 'shiftClose'}
        onClose={() => setDialog(null)}
        title="Shift Close"
        submitLabel="Close Shift"
        loading={actionLoading}
        requireAmount
        requireNote
        noteLabel="Closing notes"
        extraContent={
          <Alert severity="info">
            Expected in drawer:{' '}
            <strong>{formatCurrency(summary?.currentDrawerBalance ?? 0)}</strong>
            <br />
            Enter the actual counted cash amount below.
          </Alert>
        }
        onSubmit={({ amount, note }) =>
          runAction(
            () =>
              cashManagementService.closeShift({
                registerId,
                countedAmount: amount,
                notes: note,
              }),
            'Shift closed successfully'
          )
        }
      />

      <CashActionDialog
        open={dialog === 'openDrawer'}
        onClose={() => setDialog(null)}
        title="Open Cash Drawer"
        submitLabel="Open Drawer"
        loading={actionLoading}
        requireAmount={false}
        requireReason={reasons.requireDrawerReason}
        reasonLabel="Reason (required)"
        reasonOptions={reasons.drawer}
        noteLabel={reasons.requireDrawerReason ? 'Note (optional)' : 'Reason (optional)'}
        onSubmit={({ reason, note }) =>
          handleOpenDrawer({ reason: reason || note || 'Manual open', note })
        }
      />

      <CashActionDialog
        open={dialog === 'putIn'}
        onClose={() => setDialog(null)}
        title="Put Cash In"
        submitLabel="Add Cash"
        loading={actionLoading}
        requireAmount
        requireReason
        reasonLabel="Reason (required)"
        reasonOptions={reasons.put_in}
        onSubmit={({ amount, reason, note }) =>
          runAction(
            () =>
              cashManagementService.putCashIn({
                registerId,
                amount,
                reason,
                notes: note,
              }),
            'Cash added to drawer'
          )
        }
      />

      <CashActionDialog
        open={dialog === 'takeOut'}
        onClose={() => setDialog(null)}
        title="Take Cash Out"
        submitLabel="Remove Cash"
        loading={actionLoading}
        requireAmount
        requireReason
        reasonLabel="Reason (required)"
        reasonOptions={reasons.take_out}
        extraContent={
          <Typography variant="body2" color="text.secondary">
            Available: {formatCurrency(summary?.currentDrawerBalance ?? 0)}
          </Typography>
        }
        onSubmit={({ amount, reason, note }) =>
          runAction(
            () =>
              cashManagementService.takeCashOut({
                registerId,
                amount,
                reason,
                notes: note,
              }),
            'Cash removed from drawer'
          )
        }
      />

      <CashActionDialog
        open={dialog === 'safeDrop'}
        onClose={() => setDialog(null)}
        title="Safe Drop"
        submitLabel="Record Safe Drop"
        loading={actionLoading}
        requireAmount
        requireNote
        noteLabel="Note (required)"
        extraContent={
          <Typography variant="body2" color="text.secondary">
            Moves excess cash to safe. Available: {formatCurrency(summary?.currentDrawerBalance ?? 0)}
          </Typography>
        }
        onSubmit={({ amount, note }) =>
          runAction(
            () =>
              cashManagementService.safeDrop({
                registerId,
                amount,
                notes: note,
              }),
            'Safe drop recorded'
          )
        }
      />

      <CashActionDialog
        open={dialog === 'swap'}
        onClose={() => setDialog(null)}
        title="Swap Cash"
        submitLabel="Record Swap"
        loading={actionLoading}
        requireAmount={false}
        amountOptional
        noteLabel="Note (required)"
        requireNote
        onSubmit={({ amount, note }) =>
          runAction(
            () =>
              cashManagementService.swapCash({
                registerId,
                amount: amount ?? 0,
                notes: note,
              }),
            'Cash swap recorded (balance unchanged)'
          )
        }
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

function MovementsList({ movements }) {
  if (!movements?.length) {
    return (
      <Typography sx={{ fontSize: 16, color: '#676b72' }}>No activity recorded</Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {movements.map((m) => {
        const [dollars, cents] = splitCurrency(m.amount);
        return (
          <Box
            key={m.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
            }}
          >
            <Box>
              <Typography sx={{ fontSize: 16, fontWeight: 400, color: '#000' }}>
                {TYPE_LABELS[m.type] || m.type}
                {m.reason ? `: ${m.reason}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#676b72' }}>
                {formatDateTime(m.createdAt)}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#676b72' }}>
                {m.user?.name || '—'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <Typography
                sx={{ fontSize: 36, fontWeight: 400, color: '#000', lineHeight: 1 }}
              >
                {dollars}
                <Box component="span" sx={{ fontSize: 20 }}>
                  {cents}
                </Box>
              </Typography>
              <Button variant="outlined" startIcon={<PrintOutlined />} sx={PRINT_BTN_SX}>
                Print
              </Button>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

export default ManageCash;
