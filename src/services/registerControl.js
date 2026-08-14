import registerService from './registerService';
import { authService } from './authService';

// Shared "does this device still control its register?" lookup, used by
// RegisterTakeoverWatcher. The sell screen runs its own forced check inside
// ensureRegisterControl(), so it claims the UI (below) to stop two takeover
// dialogs stacking.

// Resolves to the name of whoever else holds the register, or null if we still
// do (or if there's nothing to check / the lookup fails — an outage must not
// stop the till).
export const getTakeoverHolder = async () => {
  const id = parseInt(localStorage.getItem('selectedRegisterId'));
  const me = authService.getCurrentUser();
  if (!id || !me?.id) return null;
  try {
    const registers = await registerService.list();
    const holder = registers.find((r) => r.id === id)?.currentUser;
    return holder && holder.id !== me.id ? holder.name : null;
  } catch {
    return null;
  }
};

// A page that renders its own takeover dialog calls this on mount; the global
// watcher stays quiet while any claim is outstanding.
let claims = 0;
export const claimTakeoverUI = () => {
  claims += 1;
  return () => {
    claims -= 1;
  };
};
export const hasLocalTakeoverUI = () => claims > 0;
