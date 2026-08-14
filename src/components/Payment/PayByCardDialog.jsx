import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Paper,
  Divider,
} from '@mui/material';
import {
  CreditCard as CardIcon,
  CheckCircle as ApprovedIcon,
  Cancel as DeclinedIcon,
  HelpOutline as UnknownIcon,
  Print as PrintIcon,
} from '@mui/icons-material';
import linklyService from '../../services/linklyService';

// Live EFTPOS payment dialog.
//
// Flow: start a purchase/refund -> poll the backend for the pinpad's live
// display prompts ("PRESENT CARD", "PROCESSING") -> show the final approved /
// declined / unknown result and receipts. If nothing resolves within the
// timeout, ask the backend to reconcile against Linkly (never re-charges).

const POLL_INTERVAL_MS = 1500;
const TIMEOUT_MS = 120000; // pinpad interaction budget before we reconcile

const TERMINAL = new Set(['approved', 'declined', 'failed', 'unknown']);

const STATUS_META = {
  approved: { color: 'success.main', Icon: ApprovedIcon, label: 'Approved' },
  declined: { color: 'error.main', Icon: DeclinedIcon, label: 'Declined' },
  failed: { color: 'error.main', Icon: DeclinedIcon, label: 'Failed' },
  unknown: { color: 'warning.main', Icon: UnknownIcon, label: 'Needs review' },
};

function makeTxnRef() {
  // Linkly limit: TxnRef max 16 chars. base36 time (8) + random (4) = 13.
  // Unique per attempt; the backend also enforces uniqueness.
  const rand = Math.random().toString(36).slice(2, 6);
  return `t${Date.now().toString(36)}${rand}`;
}

const PayByCardDialog = ({
  open,
  onClose,
  amountCents,
  cashOutCents = 0, // EFTPOS cash-out added on top of the goods amount
  orderId,
  registerId,
  terminalKey,
  originalTxnRef, // matched refund: TxnRef of the original approved purchase
  txnType = 'purchase', // 'purchase' | 'refund'
  onApproved,
  onDeclined,
}) => {
  const [txn, setTxn] = useState(null);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [busy, setBusy] = useState(false); // cancel/reprint in flight
  const [reprintText, setReprintText] = useState(''); // receipt text returned by a reprint

  const txnRefRef = useRef(null);
  const pollTimer = useRef(null);
  const startedAt = useRef(0);
  const reconcileTried = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Guards against reporting the same terminal result twice (poll + manual Done
  // can both reach an approved txn). An approved result MUST reach onApproved
  // exactly once — never a silent close — or the card is charged with no payment.
  const resultReportedRef = useRef(false);

  const handleResult = useCallback(
    (result) => {
      if (!result || resultReportedRef.current) return;
      if (result.status === 'approved') {
        resultReportedRef.current = true;
        onApproved?.(result);
      } else if (result.status === 'declined' || result.status === 'failed') {
        resultReportedRef.current = true;
        onDeclined?.(result);
      }
    },
    [onApproved, onDeclined]
  );

  // Closing the dialog while holding an approved-but-unreported txn would orphan
  // a real charge. Route every manual close through handleResult first so an
  // approved payment is always recorded before the dialog goes away.
  const finishAndClose = useCallback(() => {
    if (txn?.status === 'approved' && !resultReportedRef.current) {
      handleResult(txn);
      return;
    }
    onClose?.();
  }, [txn, handleResult, onClose]);

  const poll = useCallback(async () => {
    const ref = txnRefRef.current;
    if (!ref) return;
    try {
      const current = await linklyService.getTransaction(ref);
      setTxn(current);

      if (current && TERMINAL.has(current.status)) {
        stopPolling();
        handleResult(current);
        return;
      }

      // Timed out with no final result — reconcile once against Linkly.
      if (Date.now() - startedAt.current > TIMEOUT_MS && !reconcileTried.current) {
        reconcileTried.current = true;
        try {
          const reconciled = await linklyService.reconcile(ref);
          setTxn(reconciled);
          if (reconciled && TERMINAL.has(reconciled.status)) {
            stopPolling();
            handleResult(reconciled);
            return;
          }
        } catch {
          /* keep polling; a later sweep may resolve it */
        }
      }
    } catch {
      // Transient poll error — keep trying.
    }
    pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [stopPolling, handleResult]);

  const start = useCallback(async () => {
    setStarting(true);
    setError('');
    setTxn(null);
    setReprintText('');
    reconcileTried.current = false;
    resultReportedRef.current = false;
    startedAt.current = Date.now();
    const txnRef = makeTxnRef();
    txnRefRef.current = txnRef;
    try {
      const fn = txnType === 'refund' ? linklyService.startRefund : linklyService.startPurchase;
      const res = await fn({ amountCents, cashOutCents, txnRef, orderId, registerId, terminalKey, originalTxnRef });
      setTxn(res.transaction);
      if (res.transaction && TERMINAL.has(res.transaction.status)) {
        handleResult(res.transaction);
      } else {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.response?.data?.error || e.message;
      setError(msg || 'Failed to start card payment');
    } finally {
      setStarting(false);
    }
  }, [amountCents, cashOutCents, orderId, registerId, terminalKey, txnType, originalTxnRef, poll, handleResult]);

  useEffect(() => {
    if (open) start();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleCancel = async () => {
    if (!txn?.sessionId) return;
    setBusy(true);
    try {
      // Linkly SendKey: Key must be a single char. '0' = CANCEL/OK key
      // (the word 'CANCEL' is rejected 400, leaving the txn to time out).
      await linklyService.sendKey(txn.sessionId, '0', terminalKey);
    } catch {
      /* ignore — the pinpad may already be finishing */
    } finally {
      setBusy(false);
    }
  };

  // 'unknown' result: let the operator re-check reconciliation so a
  // backend-resolved approval still attaches to this sale via onApproved.
  const handleCheckAgain = async () => {
    if (!txnRefRef.current) return;
    setBusy(true);
    try {
      const current = await linklyService.reconcile(txnRefRef.current);
      setTxn(current);
      if (current && TERMINAL.has(current.status)) {
        handleResult(current);
      } else if (current) {
        pollTimer.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    } catch {
      /* still unresolved — operator can try again */
    } finally {
      setBusy(false);
    }
  };

  const handleReprint = async () => {
    if (!txn?.sessionId) return;
    setBusy(true);
    try {
      // Sync reprint returns the receipt text — show it, don't discard it.
      const res = await linklyService.reprint(txn.sessionId, terminalKey);
      const r = res?.response || {};
      // Linkly returns the lines as an array (`receiptText`) on the sync reprint
      // response; older shapes used `Lines` or a plain string.
      const lines = r.Lines || r.ReceiptText || r.receiptText;
      const text = Array.isArray(lines) ? lines.join('\n') : lines || '';
      if (text.trim()) setReprintText(text);
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const status = txn?.status;
  // start() failed before a txn existed (backend down, pairing lost) — the
  // dialog must stay dismissable so the operator can close or retry.
  const failedToStart = !!error && !txn;
  const inProgress =
    !failedToStart && (!status || status === 'pending' || status === 'in_progress');
  const meta = STATUS_META[status];
  const displayLines = Array.isArray(txn?.lastDisplay?.DisplayText)
    ? txn.lastDisplay.DisplayText
    : [];
  const cashOut = (cashOutCents || 0) / 100;
  const totalCents = (amountCents || 0) + (cashOutCents || 0);
  const amount = (totalCents / 100).toFixed(2);

  return (
    <Dialog open={open} maxWidth="xs" fullWidth onClose={inProgress ? undefined : finishAndClose}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CardIcon color="primary" />
        {txnType === 'refund' ? 'Refund to Card' : 'Pay by Card'} · ${amount}
      </DialogTitle>
      {cashOut > 0 && (
        <Typography variant="body2" sx={{ px: 3, pb: 1, color: 'text.secondary' }}>
          Goods ${((amountCents || 0) / 100).toFixed(2)} + Cash out ${cashOut.toFixed(2)}
        </Typography>
      )}

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Live pinpad state */}
        {inProgress && !error && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {starting ? 'Contacting PIN pad…' : 'Follow the PIN pad'}
            </Typography>
            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: 2,
                fontFamily: 'monospace',
                bgcolor: 'grey.900',
                color: 'lime',
                minHeight: 64,
              }}
            >
              {displayLines.length > 0 ? (
                displayLines.map((line, i) => <div key={i}>{line || ' '}</div>)
              ) : (
                <div>PRESENT CARD</div>
              )}
            </Paper>
            {/* Pinpad-requested operator keys (signature approval etc). Linkly
                SendKey codes: '0' OK, '1' Yes/Accept, '2' No/Decline, '3' Authorise. */}
            <Box sx={{ mt: 1.5, display: 'flex', gap: 1, justifyContent: 'center' }}>
              {txn?.lastDisplay?.AcceptYesKeyFlag && (
                <Button variant="contained" color="success" disabled={busy}
                  onClick={() => linklyService.sendKey(txn.sessionId, '1', terminalKey).catch(() => {})}>
                  Yes
                </Button>
              )}
              {txn?.lastDisplay?.AuthoriseKeyFlag && (
                <Button variant="contained" color="success" disabled={busy}
                  onClick={() => linklyService.sendKey(txn.sessionId, '3', terminalKey).catch(() => {})}>
                  Authorise
                </Button>
              )}
              {txn?.lastDisplay?.DeclineNoKeyFlag && (
                <Button variant="contained" color="error" disabled={busy}
                  onClick={() => linklyService.sendKey(txn.sessionId, '2', terminalKey).catch(() => {})}>
                  No
                </Button>
              )}
              {txn?.lastDisplay?.OKKeyFlag && (
                <Button variant="outlined" disabled={busy}
                  onClick={() => linklyService.sendKey(txn.sessionId, '0', terminalKey).catch(() => {})}>
                  OK
                </Button>
              )}
            </Box>
            {/* Signature flow: the merchant copy (signature slip) arrives BEFORE
                the operator answers Yes/No — show it so it can be sighted/printed
                before approving the signature. */}
            {txn?.merchantReceipt && (
              <Paper variant="outlined" sx={{ mt: 2, p: 1.5, textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary">
                  Merchant copy (signature slip)
                </Typography>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {txn.merchantReceipt}
                </pre>
              </Paper>
            )}
          </Box>
        )}

        {/* Final result */}
        {!inProgress && meta && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <meta.Icon sx={{ fontSize: 56, color: meta.color }} />
            <Typography variant="h5" sx={{ fontWeight: 700, color: meta.color }}>
              {meta.label}
            </Typography>
            {txn?.responseText && (
              <Typography variant="body2" color="text.secondary">
                {txn.responseText}
              </Typography>
            )}
            {status === 'unknown' && (
              <Alert severity="warning" sx={{ mt: 2, textAlign: 'left' }}>
                The result could not be confirmed. It will be reconciled automatically
                against Linkly — do not re-charge the customer.
              </Alert>
            )}
            {status === 'approved' && cashOut > 0 && (
              <Alert severity="info" sx={{ mt: 2, textAlign: 'left' }}>
                Give the customer <strong>${cashOut.toFixed(2)}</strong> cash out.
              </Alert>
            )}
            {(txn?.customerReceipt || txn?.merchantReceipt) && (
              <>
                <Divider sx={{ my: 2 }} />
                {txn.customerReceipt && (
                  <Paper variant="outlined" sx={{ p: 1.5, mb: 1, textAlign: 'left' }}>
                    <Typography variant="caption" color="text.secondary">
                      Customer copy
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {txn.customerReceipt}
                    </pre>
                  </Paper>
                )}
                {txn.merchantReceipt && (
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'left' }}>
                    <Typography variant="caption" color="text.secondary">
                      Merchant copy
                    </Typography>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                      {txn.merchantReceipt}
                    </pre>
                  </Paper>
                )}
              </>
            )}
            {reprintText && (
              <Paper variant="outlined" sx={{ p: 1.5, mt: 1, textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary">
                  Reprint copy
                </Typography>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>
                  {reprintText}
                </pre>
              </Paper>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        {failedToStart ? (
          <>
            <Button onClick={start} disabled={starting}>
              Retry
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={onClose}>
              Close
            </Button>
          </>
        ) : inProgress ? (
          <Button color="error" onClick={handleCancel} disabled={busy || !txn?.sessionId}>
            Cancel transaction
          </Button>
        ) : (
          <>
            <Button startIcon={<PrintIcon />} onClick={handleReprint} disabled={busy || !txn?.sessionId}>
              Reprint
            </Button>
            {status === 'unknown' && (
              <Button onClick={handleCheckAgain} disabled={busy}>
                Check again
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={finishAndClose}>
              Done
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default PayByCardDialog;
