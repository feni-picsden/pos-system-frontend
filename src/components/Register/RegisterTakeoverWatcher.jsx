import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShopfrontDialog from '../Common/ShopfrontDialog';
import registerService from '../../services/registerService';
import { getTakeoverHolder, hasLocalTakeoverUI } from '../../services/registerControl';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';
import { useAuth } from '../../contexts/AuthContext';

// Reference behaviour (bundle 9e541bf9e, "Register Takeover"): the device that
// loses a register is told ONCE, by a KICK_REGISTER event, when another user
// takes it — and never while the user is an admin (`!isAdmin` gate). We have no
// socket, so a slow poll stands in for the event; the poll must therefore
// behave like one:
//   * report a takeover once per change of holder, not on every check;
//   * survive navigation — the last holder we told the user about is kept
//     outside React so remounting on a page change does not re-fire it;
//   * skip admins, as the reference does.
// A blocked sale on the sell screen still raises its own dialog immediately.
const POLL_MS = 15000;
let lastReportedHolder = null; // module-level: outlives route changes

const RegisterTakeoverWatcher = () => {
  const navigate = useNavigate();
  const { clearSelectedRegister } = useSelectedRegister();
  const { isSuperAdmin } = useAuth();
  const [takenBy, setTakenBy] = useState(null);
  const openRef = useRef(false);

  useEffect(() => {
    if (isSuperAdmin()) return undefined;
    const check = async () => {
      // The sell screen shows its own takeover dialog; don't stack a second.
      if (hasLocalTakeoverUI()) return;
      const holder = await getTakeoverHolder();
      if (!holder) {
        lastReportedHolder = null; // we hold it again — a later takeover reports afresh
        return;
      }
      if (holder === lastReportedHolder || openRef.current) return;
      lastReportedHolder = holder;
      openRef.current = true;
      setTakenBy(holder);
    };
    // No immediate check on mount: mounting happens on every page change and
    // made the dialog reappear on "nearly every navigation".
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, [isSuperAdmin]);

  const close = () => {
    openRef.current = false;
    setTakenBy(null);
  };

  const chooseLocation = () => {
    // Goes through the context so the in-memory selection is dropped too —
    // wiping localStorage alone would leave the provider holding a dead register.
    clearSelectedRegister();
    lastReportedHolder = null;
    close();
    navigate('/');
  };

  const takeBackControl = async () => {
    const id = parseInt(localStorage.getItem('selectedRegisterId'));
    try {
      await registerService.takeControl(id);
      lastReportedHolder = null;
      close();
    } catch {
      // Left open so the user can choose a location instead.
    }
  };

  return (
    <ShopfrontDialog
      open={!!takenBy}
      icon={<InfoOutlinedIcon sx={{ fontSize: 'inherit' }} />}
      title="Register Takeover"
      message={`${takenBy} has taken over this register on another device. Only one device can use a register at a time.`}
      actions={[
        { label: 'Choose Location', onClick: chooseLocation },
        { label: 'Take Back Control', onClick: takeBackControl },
      ]}
    />
  );
};

export default RegisterTakeoverWatcher;
