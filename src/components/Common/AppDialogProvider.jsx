import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import PriorityHighIcon from '@mui/icons-material/PriorityHigh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';

/**
 * In-app replacements for window.alert / confirm / prompt.
 *
 * Chrome matches the existing Shopfront dialogs (Common/ConfirmDeleteDialog):
 * flat #f8f8f8 surface, square corners, 1px black border, a tinted header strip
 * carrying the severity, grey Cancel + accent action bottom-right.
 *
 * Success messages are non-blocking toasts — a cashier parking a sale should
 * not have to dismiss a modal before starting the next one. Everything else is
 * a modal, because it either reports a failure or asks a question.
 */

const SEVERITY = {
  error: { bg: '#fde8e8', fg: '#e33430', btn: '#e33430', btnHover: '#cc2f2a', Icon: PriorityHighIcon },
  warning: { bg: '#fff3e0', fg: '#b25e00', btn: '#b25e00', btnHover: '#9a5100', Icon: WarningAmberIcon },
  info: { bg: '#e8f1fd', fg: '#1c86f2', btn: '#5ebbeb', btnHover: '#48a9dc', Icon: InfoOutlinedIcon },
  success: { bg: '#e7f6ec', fg: '#1e7d47', btn: '#1e7d47', btnHover: '#186a3c', Icon: CheckCircleOutlineIcon },
  question: { bg: '#e8f1fd', fg: '#1c86f2', btn: '#5ebbeb', btnHover: '#48a9dc', Icon: HelpOutlineIcon },
};

const DEFAULT_TITLE = {
  error: 'Something went wrong',
  warning: 'Check this first',
  info: 'Heads up',
  success: 'Done',
  question: 'Confirm',
};

// Call sites read like the browser dialogs they replace — alert('Failed to
// park sale.') carries its own severity in the words, so infer it rather than
// making 100+ call sites pass a second argument. Pass one to override.
const inferSeverity = (message) => {
  const text = String(message || '').toLowerCase();
  if (/(fail|error|cannot|can't|could not|couldn't|not found|no sale|denied|invalid|unable)/.test(text)) return 'error';
  if (/(success|saved|parked|resumed|emailed|complete[d]?!)/.test(text)) return 'success';
  if (/(please|must|select|add items|not configured|no products|disabled|required)/.test(text)) return 'warning';
  return 'info';
};

const AppDialogContext = createContext(null);

const PAPER_SX = {
  width: 440,
  maxWidth: '92vw',
  overflow: 'hidden',
  bgcolor: '#f8f8f8',
  borderRadius: 0,
  border: '1px solid #000',
  boxShadow: '0 0 30px 0 rgba(0,0,0,.25), 0 15px 30px 0 rgba(0,0,0,.19)',
  transition: 'none',
};

const CANCEL_SX = {
  bgcolor: '#8a8d91',
  color: '#fff',
  textTransform: 'none',
  borderRadius: '6px',
  fontWeight: 600,
  px: 3,
  '&:hover': { bgcolor: '#76797d' },
};

export const AppDialogProvider = ({ children }) => {
  const [request, setRequest] = useState(null);
  const [value, setValue] = useState('');
  const [toast, setToast] = useState(null);
  // Two alerts fired back to back (a validation message then a failure) must
  // both be seen, so queue instead of letting the second overwrite the first.
  const queue = useRef([]);

  const push = useCallback((next) => {
    setRequest((current) => {
      if (current) {
        queue.current.push(next);
        return current;
      }
      setValue(next.type === 'prompt' ? (next.defaultValue ?? '') : '');
      return next;
    });
  }, []);

  const close = useCallback((result) => {
    setRequest((current) => {
      current?.resolve(result);
      const next = queue.current.shift() || null;
      if (next) setValue(next.type === 'prompt' ? (next.defaultValue ?? '') : '');
      return next;
    });
  }, []);

  const notify = useCallback((message, severity = 'success') => {
    setToast({ message: String(message ?? ''), severity });
  }, []);

  const api = useMemo(() => ({
    notify,
    /** Drop-in for window.alert. Success messages toast; the rest open a modal. */
    alert: (message, severity) => {
      const level = severity || inferSeverity(message);
      if (level === 'success') {
        notify(message, 'success');
        return Promise.resolve();
      }
      return new Promise((resolve) => push({ type: 'alert', message, severity: level, resolve }));
    },
    /** Drop-in for window.confirm — await it. */
    confirm: (message, options = {}) =>
      new Promise((resolve) =>
        push({ type: 'confirm', message, severity: 'question', ...options, resolve })
      ),
    /** Drop-in for window.prompt — await it. Resolves to a string, or null on cancel. */
    prompt: (message, defaultValue = '', options = {}) =>
      new Promise((resolve) =>
        push({ type: 'prompt', message, defaultValue, severity: 'question', ...options, resolve })
      ),
  }), [notify, push]);

  const open = Boolean(request);
  const level = SEVERITY[request?.severity] || SEVERITY.info;
  const { Icon } = level;
  const cancelResult = request?.type === 'prompt' ? null : false;

  const submit = () => close(request?.type === 'prompt' ? value : true);

  return (
    <AppDialogContext.Provider value={api}>
      {children}

      <Dialog
        open={open}
        onClose={() => close(cancelResult)}
        PaperProps={{ elevation: 0, sx: PAPER_SX }}
        // Sale-screen dialogs sit above the cart overlays, which run to 1400.
        sx={{ zIndex: 2000 }}
      >
        <Box sx={{ bgcolor: level.bg, px: 3, py: 1.75, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Icon sx={{ color: level.fg, fontSize: 22 }} />
          <Typography sx={{ color: level.fg, fontWeight: 700, fontSize: 18 }}>
            {request?.title || DEFAULT_TITLE[request?.severity] || 'Heads up'}
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, py: 2.5 }}>
          <Typography sx={{ color: '#313439', fontSize: 16, whiteSpace: 'pre-line' }}>
            {request?.message}
          </Typography>
          {request?.type === 'prompt' && (
            <TextField
              autoFocus
              fullWidth
              size="small"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); submit(); }
              }}
              sx={{ mt: 2, '& .MuiOutlinedInput-root': { borderRadius: 0, bgcolor: '#fff' } }}
            />
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, pt: 0, gap: 1.25 }}>
          {request?.type !== 'alert' && (
            <Button onClick={() => close(cancelResult)} disableElevation sx={CANCEL_SX}>
              {request?.cancelText || 'Cancel'}
            </Button>
          )}
          <Button
            onClick={submit}
            disableElevation
            sx={{
              bgcolor: level.btn,
              color: '#fff',
              textTransform: 'none',
              borderRadius: '6px',
              fontWeight: 600,
              px: 3,
              '&:hover': { bgcolor: level.btnHover },
            }}
          >
            {request?.confirmText || (request?.type === 'alert' ? 'OK' : 'Continue')}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={2500}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ zIndex: 2100 }}
      >
        <Alert
          severity={toast?.severity || 'success'}
          variant="filled"
          onClose={() => setToast(null)}
          sx={{ borderRadius: 0, fontSize: 15, fontWeight: 600, alignItems: 'center' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>
    </AppDialogContext.Provider>
  );
};

// Falls back to the browser dialogs if a component renders outside the
// provider (tests, isolated stories) so nothing silently swallows a message.
const FALLBACK = {
  notify: (message) => window.alert(message),
  alert: (message) => { window.alert(message); return Promise.resolve(); },
  confirm: (message) => Promise.resolve(window.confirm(message)),
  prompt: (message, defaultValue = '') => Promise.resolve(window.prompt(message, defaultValue)),
};

export const useAppDialogs = () => useContext(AppDialogContext) || FALLBACK;

export default AppDialogProvider;
