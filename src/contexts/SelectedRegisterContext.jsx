import React, { createContext, useContext, useState, useEffect } from 'react';
import registerService from '../services/registerService';
import { useAuth } from './AuthContext';
import { useSelectedOutlet } from './SelectedOutletContext';

// The outlet + register "Location Selector" used to live inside the sell screen,
// so it only existed there. It now lives here and the dialog is mounted once in
// DashboardLayout, which makes the same signpost trigger work on every screen.
// localStorage stays the source of truth (four modules outside the React tree
// read selectedRegisterId directly); this provider hydrates from it and writes
// through it.
const SelectedRegisterContext = createContext(null);

export const useSelectedRegister = () => useContext(SelectedRegisterContext) || {};

export const SelectedRegisterProvider = ({ children }) => {
  const { user, getOutletId } = useAuth();
  const { outlets, selectedOutletId } = useSelectedOutlet();

  const [availableRegisters, setAvailableRegisters] = useState([]);
  const [selectedRegister, setSelectedRegister] = useState(null);
  const [showRegisterInUseDialog, setShowRegisterInUseDialog] = useState(false);
  const [registerInUseData, setRegisterInUseData] = useState(null);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  // Reference runs the selector in two steps: outlet first, then register.
  const [locationStep, setLocationStep] = useState('register');
  // Register open/close overlay (STATE 3) feedback + in-flight guard
  const [registerError, setRegisterError] = useState('');
  const [openingRegister, setOpeningRegister] = useState(false);

  // Single place that writes the selected register to state + localStorage
  // (id/name/status) so the "Open Register" overlay survives a reload.
  const persistRegister = (register) => {
    setSelectedRegister(register);
    localStorage.setItem('selectedRegisterId', register.id);
    localStorage.setItem('selectedRegisterName', register.name);
    localStorage.setItem('selectedRegisterStatus', register.status || 'Closed');
  };

  const clearSelectedRegister = () => {
    setSelectedRegister(null);
    localStorage.removeItem('selectedRegisterId');
    localStorage.removeItem('selectedRegisterName');
    localStorage.removeItem('selectedRegisterStatus');
  };

  // Hydrate from localStorage, and re-run on outlet change: a register that
  // isn't in the new outlet's list is dropped here (this used to be
  // SelectedOutletContext.pruneStaleRegister, which edited the same keys from a
  // second, racing request and left the in-memory copy pointing at a register
  // it had just deleted).
  useEffect(() => {
    // An in-flight list() belongs to the outlet that started it; if the outlet
    // changed underneath, its answer must not write state.
    let cancelled = false;
    const savedRegisterId = localStorage.getItem('selectedRegisterId');
    const savedRegisterName = localStorage.getItem('selectedRegisterName');
    if (!savedRegisterId || !savedRegisterName) {
      setSelectedRegister(null);
    } else {
      setSelectedRegister({
        id: parseInt(savedRegisterId),
        name: savedRegisterName,
        // status drives the "Open Register" overlay; persisted so a reload doesn't re-show it
        status: localStorage.getItem('selectedRegisterStatus') || 'Closed',
      });
      // The stub above only carries what localStorage holds. Merge the server row so
      // the register's own fields (invoiceNumber) are available.
      registerService.list({ isActive: true })
        .then((registers) => {
          if (cancelled) return;
          const row = (registers || []).find((r) => r.id === parseInt(savedRegisterId));
          if (row) {
            // Server row wins over the localStorage stub (the stub only carries
            // id/name/status, and its status never converged on server truth),
            // and it goes through persistRegister so the three keys every
            // out-of-tree reader uses are updated together.
            persistRegister({ ...row, outletId: row.outletId ?? row.outlet?.id ?? null });
          } else {
            // Not in the list we are scoped to (outlet switch, deletion,
            // deactivation, or a register inherited from the previous user).
            // Super admins included: their list IS outlet-scoped whenever an
            // outlet is selected, so absence means the register is another
            // outlet's. In Global mode the list is unscoped, so a valid
            // register is still found and nothing is cleared. A failed list()
            // lands in .catch below, so a network error never wipes anything.
            clearSelectedRegister();
          }
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [user?.id, selectedOutletId]);

  // Effective outlet: superadmin selection, then auth, then user, then register.
  const getEffectiveOutletId = () => {
    if (user?.isSuperAdmin && selectedOutletId) return selectedOutletId;
    let outletId = getOutletId?.();
    if (!outletId && user?.outletId) outletId = user.outletId;
    if (!outletId && selectedRegister?.outletId) outletId = selectedRegister.outletId;
    if (!outletId && selectedRegister?.outlet?.id) outletId = selectedRegister.outlet.id;
    return outletId;
  };

  // Outlet name shown in the location selector / register overlay.
  const getOutletName = () => {
    const id = getEffectiveOutletId();
    return (
      outlets.find((o) => o.id === Number(id))?.name ||
      selectedRegister?.outlet?.name ||
      availableRegisters.find((r) => r.outlet?.name)?.outlet?.name ||
      user?.outlet?.name ||
      'this outlet'
    );
  };

  // STATE 3: flip the register to Open via PUT /api/registers/:id, then drop the overlay.
  const openRegister = async () => {
    if (!selectedRegister?.id) return;
    setOpeningRegister(true);
    try {
      const updated = await registerService.update(selectedRegister.id, { status: 'Open' });
      persistRegister({ ...selectedRegister, ...(updated || {}), status: 'Open' });
    } catch (error) {
      console.error('Error opening register:', error);
      setRegisterError(error.response?.data?.error || 'Failed to open register. Please try again.');
    } finally {
      setOpeningRegister(false);
    }
  };

  const refreshRegisters = async () => {
    try {
      const registers = await registerService.list({ isActive: true });
      setAvailableRegisters(registers);
      return registers;
    } catch (error) {
      console.error('Error fetching registers:', error);
      setAvailableRegisters([]);
      return [];
    }
  };

  // opts.force skips the "already assigned to me" auto-select, so "Change Register"
  // can actually reach the picker (onClick passes an event, which has no .force).
  const openLocationSelector = async (opts) => {
    const force = opts?.force === true;
    // Opens straight on the register list; the outlet step is only reached via
    // the "Back to outlet select" link.
    setLocationStep(opts?.step || 'register');
    try {
      const registers = await registerService.list({ isActive: true });
      setAvailableRegisters(registers);

      // Check if any register is already assigned to the current user
      const userRegister = !force && registers.find(reg =>
        reg.currentUser &&
        reg.currentUser.id &&
        user &&
        reg.currentUser.id === user.id
      );

      // If a register is already assigned to the current user, automatically select it
      if (userRegister) {
        const fullRegister = {
          ...userRegister,
          outletId: userRegister.outletId || userRegister.outlet?.id || null
        };
        persistRegister(fullRegister);
        setShowLocationSelector(false);
        return;
      }

      setShowLocationSelector(true);
    } catch (error) {
      console.error('Error fetching registers:', error);
      setAvailableRegisters([]);
      setShowLocationSelector(true);
    }
  };

  const selectRegister = async (register) => {
    try {
      // Check if register is in use by another user before trying to lock
      const isInUseByOtherUser = register.currentUser &&
        register.currentUser.id &&
        user &&
        register.currentUser.id !== user.id;

      if (isInUseByOtherUser) {
        // Reference asks before stealing a register in use; it never takes
        // control silently. Answering Yes runs takeControl().
        setRegisterInUseData({
          register,
          currentUser: register.currentUser?.name || 'Another user',
          lockedAt: register.lockedAt
        });
        setShowRegisterInUseDialog(true);
        return;
      }

      // Register is not in use or is in use by current user - try to lock it
      const result = await registerService.lock(register.id);

      // Store the full register object which might have outletId
      const fullRegister = {
        ...register,
        // backend /lock returns the register with its new status ('Locked')
        status: result?.register?.status || 'Locked',
        outletId: register.outletId || register.outlet?.id || null
      };

      persistRegister(fullRegister);
      setShowLocationSelector(false);
    } catch (error) {
      if (error.response?.status === 409) {
        // Register is in use by another user (fallback if currentUser check didn't catch it)
        setRegisterInUseData({
          register,
          currentUser: error.response.data.currentUser,
          lockedAt: error.response.data.lockedAt
        });
        setShowRegisterInUseDialog(true);
      } else {
        // Anything that isn't the 409 takeover case used to be swallowed into
        // the console: the dialog closed and the screen just said no register
        // was selected. Surface it in the same snackbar the open/close errors use.
        console.error('Error selecting register:', error);
        setRegisterError(
          error.response?.data?.error || 'Could not select that register. Please try again.'
        );
      }
    }
  };

  const takeControl = async () => {
    try {
      if (registerInUseData) {
        await registerService.takeControl(registerInUseData.register.id);

        persistRegister({ ...registerInUseData.register, status: 'Locked' });
        setShowRegisterInUseDialog(false);
        setRegisterInUseData(null);
        setShowLocationSelector(false);
      }
    } catch (error) {
      console.error('Error taking control:', error);
    }
  };

  // Reference's Cancel: drop back to the Location Selector, still open behind.
  const chooseAnotherLocation = () => {
    setShowRegisterInUseDialog(false);
    setRegisterInUseData(null);
  };

  return (
    <SelectedRegisterContext.Provider
      value={{
        selectedRegister,
        setSelectedRegister,
        availableRegisters,
        showLocationSelector,
        setShowLocationSelector,
        locationStep,
        setLocationStep,
        showRegisterInUseDialog,
        registerError,
        setRegisterError,
        openingRegister,
        openLocationSelector,
        refreshRegisters,
        selectRegister,
        takeControl,
        chooseAnotherLocation,
        persistRegister,
        clearSelectedRegister,
        getOutletName,
        getEffectiveOutletId,
        openRegister,
      }}
    >
      {children}
    </SelectedRegisterContext.Provider>
  );
};

export default SelectedRegisterContext;
