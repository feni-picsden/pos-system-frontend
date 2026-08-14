import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  TextField,
  Alert,
  Snackbar,
  Chip,
  CircularProgress,
} from '@mui/material';
import {
  Link as PairIcon,
  PowerSettingsNew as LogonIcon,
  CreditCard as CardIcon,
} from '@mui/icons-material';
import linklyService from '../../services/linklyService';

// Admin screen to pair a Linkly PIN pad and run a Logon test.
// Pairing is one-time per PIN pad; the secret is stored encrypted server-side.

const LinklySettings = () => {
  const [terminalKey, setTerminalKey] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pairCode, setPairCode] = useState('');

  const [paired, setPaired] = useState(null); // null = unknown/checking
  const [checking, setChecking] = useState(true);
  const [pairing, setPairing] = useState(false);
  const [loggingOn, setLoggingOn] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [journal, setJournal] = useState([]);
  const [orphansOnly, setOrphansOnly] = useState(false);
  const [journalLoading, setJournalLoading] = useState(false);

  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const refreshStatus = async () => {
    setChecking(true);
    try {
      const res = await linklyService.getPinpadStatus(terminalKey || undefined);
      setPaired(res.paired);
    } catch {
      setPaired(null);
    } finally {
      setChecking(false);
    }
  };

  const loadJournal = async (onlyOrphans = orphansOnly) => {
    setJournalLoading(true);
    try {
      setJournal(
        onlyOrphans
          ? await linklyService.listOrphans(30)
          : await linklyService.listTransactions({ days: 7, limit: 50 })
      );
    } catch {
      setJournal([]);
    } finally {
      setJournalLoading(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    loadJournal(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePair = async () => {
    if (!username || !password || !pairCode) {
      notify('Username, password and pair code are required', 'error');
      return;
    }
    setPairing(true);
    try {
      await linklyService.pair({
        username,
        password,
        pairCode,
        terminalKey: terminalKey || undefined,
      });
      notify('PIN pad paired successfully');
      setPassword('');
      setPairCode('');
      await refreshStatus();
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message;
      notify(msg || 'Pairing failed', 'error');
    } finally {
      setPairing(false);
    }
  };

  const handleLogon = async () => {
    setLoggingOn(true);
    try {
      const res = await linklyService.logon(terminalKey || undefined);
      const txn = res?.transaction;
      if (txn?.status === 'approved') {
        notify(`Logon approved — PIN pad reachable (${(txn.responseText || '').trim() || 'OK'})`);
      } else {
        notify(`Logon ${txn?.status || 'sent'} — ${(txn?.responseText || '').trim() || 'watch the PIN pad'}`,
          txn?.status === 'approved' ? 'success' : 'warning');
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message;
      notify(msg || 'Logon failed', 'error');
    } finally {
      setLoggingOn(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CardIcon color="primary" />
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Linkly EFTPOS
        </Typography>
        {checking ? (
          <CircularProgress size={18} sx={{ ml: 1 }} />
        ) : (
          <Chip
            size="small"
            color={paired ? 'success' : 'default'}
            label={paired ? 'Paired' : 'Not paired'}
            sx={{ ml: 1 }}
          />
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Pair this register's bank PIN pad with Linkly. Pairing is done once — the
        secret is stored encrypted on the server and never expires.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
          Pair PIN pad
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Terminal key (optional)"
              helperText="Leave blank to use the default terminal"
              fullWidth
              value={terminalKey}
              onChange={(e) => setTerminalKey(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Linkly username"
              fullWidth
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="off"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Linkly password"
              type="password"
              fullWidth
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Pair code"
              helperText="Shown on the PIN pad when you start pairing"
              fullWidth
              value={pairCode}
              onChange={(e) => setPairCode(e.target.value)}
            />
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={pairing ? <CircularProgress size={18} color="inherit" /> : <PairIcon />}
            onClick={handlePair}
            disabled={pairing}
          >
            {paired ? 'Re-pair' : 'Pair'}
          </Button>
          <Button onClick={refreshStatus} disabled={checking}>
            Refresh status
          </Button>
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Test connection
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Send a Logon to confirm the PIN pad is reachable through Linkly.
        </Typography>
        <Button
          variant="outlined"
          startIcon={loggingOn ? <CircularProgress size={18} /> : <LogonIcon />}
          onClick={handleLogon}
          disabled={loggingOn || !paired}
        >
          Logon
        </Button>
        {!paired && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Pair the PIN pad before running a Logon.
          </Alert>
        )}
      </Paper>

      {/* Transaction journal — every terminal integration needs one for
          end-of-day reconciliation and card disputes. Read-only. */}
      {/* The 720px column suits the pairing form but crushes a 7-column table,
          so the journal breaks out to the full page width. */}
      <Paper variant="outlined" sx={{ p: 3, mt: 3, width: 'calc(100vw - 48px)', maxWidth: 1200 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, flexGrow: 1 }}>
            Transaction journal
          </Typography>
          <Button
            size="small"
            variant={orphansOnly ? 'contained' : 'outlined'}
            onClick={() => {
              const next = !orphansOnly;
              setOrphansOnly(next);
              loadJournal(next);
            }}
          >
            {orphansOnly ? 'Showing unmatched only' : 'Show unmatched approvals'}
          </Button>
          <Button size="small" onClick={() => loadJournal()} disabled={journalLoading}>
            Refresh
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {orphansOnly
            ? 'Approved on the PIN pad in the last 30 days with no matching sale payment — each one needs investigating.'
            : 'Last 50 PIN pad transactions from the past 7 days.'}
        </Typography>
        {journalLoading ? (
          <CircularProgress size={22} />
        ) : journal.length === 0 ? (
          <Alert severity={orphansOnly ? 'success' : 'info'}>
            {orphansOnly ? 'No unmatched approvals.' : 'No transactions yet.'}
          </Alert>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <Box component="thead">
                <Box component="tr" sx={{ '& th': { textAlign: 'left', p: 1, bgcolor: '#f8f8f8', whiteSpace: 'nowrap' } }}>
                  <th>When</th><th>Type</th><th>Amount</th><th>Status</th><th>Code</th><th>Card</th><th>Reference</th>
                </Box>
              </Box>
              <Box component="tbody">
                {journal.map((t) => (
                  <Box component="tr" key={t.txnRef} sx={{ '& td': { p: 1, borderTop: '1px solid #eee', whiteSpace: 'nowrap' } }}>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                    <td>{t.type}</td>
                    <td>${(((t.approvedAmountCents ?? t.amountCents) || 0) / 100).toFixed(2)}</td>
                    <td>
                      <Chip
                        size="small"
                        label={t.status}
                        color={t.status === 'approved' ? 'success' : t.status === 'declined' ? 'error' : 'default'}
                      />
                    </td>
                    <td>{t.responseCode || '—'}</td>
                    <td>{(t.cardType || '').trim() || '—'}</td>
                    <td>{t.txnRef}</td>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default LinklySettings;
