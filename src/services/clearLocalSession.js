import posLocalDb from './posLocalDb';

// Single owner of "wipe this device's session state". There used to be three
// half-versions of this — authService.logout, the apiClient 401 interceptor and
// nothing at all on login — so whichever way a session ended, the next user on a
// shared till inherited the previous user's outlet, register and cached catalog.
export default async function clearLocalSession() {
  ['authToken', 'user', 'selectedOutletId',
   'selectedRegisterId', 'selectedRegisterName', 'selectedRegisterStatus']
    .forEach((k) => localStorage.removeItem(k));
  try { await posLocalDb.clearAll(); } catch { /* best effort */ }
}
