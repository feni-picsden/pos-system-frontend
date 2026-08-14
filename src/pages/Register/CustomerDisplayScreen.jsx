import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import customerDisplayTemplateService from '../../services/customerDisplayTemplateService';
import CustomerDisplayRenderer from '../../components/CustomerDisplay/CustomerDisplayRenderer';
import customerDisplayService from '../../services/customerDisplayService';
import {
  CUSTOMER_DISPLAY_MESSAGE_TYPE,
  CUSTOMER_DISPLAY_WINDOW_NAME,
  getCustomerDisplayStorageKey,
} from '../../utils/customerDisplayWindow';

function enterFullscreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    return elem.requestFullscreen();
  }
  if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
    return undefined;
  }
  if (elem.webkitRequestFullScreen) {
    elem.webkitRequestFullScreen();
    return undefined;
  }
  if (elem.mozRequestFullScreen) {
    elem.mozRequestFullScreen();
    return undefined;
  }
  if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
    return undefined;
  }
  return undefined;
}

const parseRegisterId = () => {
  const query = new URLSearchParams(window.location.search);
  const fromQuery = query.get('registerId');
  let id = parseInt(fromQuery || '', 10);
  if (!Number.isNaN(id)) return id;
  try {
    // Query param, then the one owned key — the sessionStorage mirror is gone.
    id = parseInt(localStorage.getItem('selectedRegisterId') || '', 10);
    if (!Number.isNaN(id)) return id;
  } catch (_) {}
  return null;
};

const CustomerDisplayScreen = () => {
  const [templates, setTemplates] = useState([]);
  const [registerConfig, setRegisterConfig] = useState(null);
  const [displayState, setDisplayState] = useState({});
  const [registerId, setRegisterId] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = parseRegisterId();
    if (id == null) {
      setLoading(false);
      setError('No register selected for customer display. Open it from the sales screen or register menu after selecting a register.');
      return;
    }
    setRegisterId(id);
  }, []);

  useEffect(() => {
    if (!registerId) return;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [{ config, state }, templateList] = await Promise.all([
          customerDisplayService.getRegisterState(registerId),
          customerDisplayTemplateService.listTemplates(),
        ]);
        const rawTid = config?.templateId;
        const numTid = Number(rawTid);
        const normalizedConfig = config
          ? {
              ...config,
              templateId:
                rawTid != null && rawTid !== '' && Number.isFinite(numTid) ? numTid : null,
            }
          : null;
        setRegisterConfig(normalizedConfig);
        setDisplayState(state?.payload || {});
        setTemplates(templateList);
      } catch (err) {
        setError('Failed to load customer display settings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [registerId]);

  useEffect(() => {
    if (!registerId) return undefined;

    const applyPayload = (payload) => {
      if (payload && typeof payload === 'object') {
        setDisplayState(payload);
      }
    };

    const readLocalState = () => {
      try {
        const raw = localStorage.getItem(getCustomerDisplayStorageKey(registerId));
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (Number(parsed.registerId) === Number(registerId)) {
          applyPayload(parsed.payload);
        }
      } catch {
        // Ignore malformed/unavailable cached display state
      }
    };

    readLocalState();

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (data?.type !== CUSTOMER_DISPLAY_MESSAGE_TYPE) return;
      if (Number(data.registerId) !== Number(registerId)) return;
      applyPayload(data.payload);
    };

    const onStorage = (event) => {
      if (event.key !== getCustomerDisplayStorageKey(registerId)) return;
      readLocalState();
    };

    const onCustom = (event) => {
      const data = event.detail;
      if (Number(data?.registerId) !== Number(registerId)) return;
      applyPayload(data.payload);
    };

    window.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    window.addEventListener('pos-customer-display-state', onCustom);

    const interval = setInterval(async () => {
      try {
        const { state } = await customerDisplayService.getRegisterState(registerId);
        if (state?.payload) {
          applyPayload(state.payload);
        }
      } catch (_) {}
    }, 15000);

    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('pos-customer-display-state', onCustom);
      clearInterval(interval);
    };
  }, [registerId]);

  const selectedTemplate = useMemo(() => {
    if (!templates.length) return null;
    const desired = registerConfig?.templateId;
    if (desired == null || desired === '' || Number.isNaN(Number(desired))) {
      return templates[0];
    }
    const match = templates.find(
      (template) => String(template.id) === String(desired)
    );
    return match || templates[0];
  }, [templates, registerConfig]);

  const displayReadyForFullscreen =
    !loading && !error && registerId != null && selectedTemplate != null;

  useEffect(() => {
    if (window.name !== CUSTOMER_DISPLAY_WINDOW_NAME) return;
    if (!displayReadyForFullscreen) return;
    const id = window.setTimeout(() => {
      try {
        const p = enterFullscreen();
        if (p != null && typeof p.catch === 'function') {
          p.catch(() => {});
        }
      } catch (_) {
        /* Fullscreen may be blocked without a user gesture on some browsers */
      }
    }, 50);
    return () => clearTimeout(id);
  }, [displayReadyForFullscreen]);

  if (loading) {
    return (
      <Box sx={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#000' }}>
        <CircularProgress sx={{ color: '#fff' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!selectedTemplate) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">
          No customer display templates found. Create one under Setup → Customer Display, then assign it to this register.
        </Alert>
      </Box>
    );
  }

  const mode = displayState?.mode || 'idle';

  return (
    <Box sx={{ width: '100vw', height: '100vh', bgcolor: '#000' }}>
      <CustomerDisplayRenderer
        template={selectedTemplate}
        mode={mode}
        data={displayState}
      />
      <Box sx={{ position: 'fixed', left: 8, bottom: 8, color: '#fff', opacity: 0.4 }}>
        <Typography variant="caption">{selectedTemplate.name}</Typography>
      </Box>
    </Box>
  );
};

export default CustomerDisplayScreen;
