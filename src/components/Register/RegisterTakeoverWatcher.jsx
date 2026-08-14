import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import ShopfrontDialog from '../Common/ShopfrontDialog';
import registerService from '../../services/registerService';
import { getTakeoverHolder, hasLocalTakeoverUI } from '../../services/registerControl';
import { useSelectedRegister } from '../../contexts/SelectedRegisterContext';

// Reference behaviour: while a device holds a register, another user can take
// control of it. The device that lost it gets a blocking "Register Takeover"
// dialog offering to pick a different location or claim the register back.
// Polling is the slow path; a blocked sale raises the same dialog immediately.
const POLL_MS = 15000;

const RegisterTakeoverWatcher = () => {
  const navigate = useNavigate();
  const { clearSelectedRegister } = useSelectedRegister();
  const [takenBy, setTakenBy] = useState(null);

  useEffect(() => {
    const check = () => {
      // The sell screen shows its own takeover dialog; don't stack a second.
      if (hasLocalTakeoverUI()) return setTakenBy(null);
      getTakeoverHolder().then(setTakenBy);
    };
    check();
    const t = setInterval(check, POLL_MS);
    return () => clearInterval(t);
  }, []);

  const chooseLocation = () => {
    // Goes through the context so the in-memory selection is dropped too —
    // wiping localStorage alone would leave the provider holding a dead register.
    clearSelectedRegister();
    setTakenBy(null);
    navigate('/');
  };

  const takeBackControl = async () => {
    const id = parseInt(localStorage.getItem('selectedRegisterId'));
    try {
      await registerService.takeControl(id);
      setTakenBy(null);
    } catch {
      // Left open so the user can choose a location instead.
    }
  };

  return (
    <ShopfrontDialog
      open={!!takenBy}
      icon={<InfoOutlinedIcon sx={{ fontSize: 'inherit' }} />}
      title="Register Takeover"
      message={`${takenBy} has taken over this register.`}
      actions={[
        { label: 'Choose Location', onClick: chooseLocation },
        { label: 'Take Back Control', onClick: takeBackControl },
      ]}
    />
  );
};

export default RegisterTakeoverWatcher;
