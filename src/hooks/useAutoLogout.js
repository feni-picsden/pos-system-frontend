import { useEffect, useRef } from 'react';
import settingsService, { GENERAL_SETTINGS_REFRESHED_EVENT } from '../services/settingsService';

// Setup > General > Login: "General Auto Logout Time" applies everywhere,
// "Sell Screen Auto Logout Time" overrides it on the sell screen when > 0.
// The general value is clamped to the reference's 60..7200 range; 0/blank means
// the reference default of 7200. The sell screen value is capped at two hours
// too ("you can specify an amount higher but Shopfront will automatically log
// out on all pages after the two hours have passed").
const MAX_S = 7200;

export const resolveTimeoutMs = (settings, isSellScreen) => {
  const sell = Number(settings?.autoLogoutTime) || 0;
  if (isSellScreen && sell > 0) return Math.min(MAX_S, sell) * 1000;
  const general = Number(settings?.generalAutoLogoutTime) || MAX_S;
  return Math.min(MAX_S, Math.max(60, general)) * 1000;
};

// "Auto Logout During Sale" off => an in-progress sale keeps the user in, but
// only on the sell screen: the reference says the toggle "only affects the Sell
// screen Auto Logout Time setting", so the general timer still logs out of
// every other page even while a sale sits parked on the sell screen.
export const saleBlocksLogout = (settings, isSellScreen, hasActiveSale) =>
  isSellScreen && hasActiveSale && settings?.autoLogoutDuringSale !== true;

// Runnable self-checks (silent unless the timeout rules regress).
console.assert(resolveTimeoutMs({ autoLogoutTime: 30, generalAutoLogoutTime: 7200 }, true) === 30000, 'sell screen value wins');
console.assert(resolveTimeoutMs({ autoLogoutTime: 30, generalAutoLogoutTime: 600 }, false) === 600000, 'general applies off the sell screen');
console.assert(resolveTimeoutMs({ autoLogoutTime: 0, generalAutoLogoutTime: 0 }, true) === 7200000, 'blank general falls back to 7200');
console.assert(resolveTimeoutMs({ generalAutoLogoutTime: 10 }, false) === 60000, 'general clamped to 60');
console.assert(resolveTimeoutMs({ autoLogoutTime: 99999 }, true) === 7200000, 'sell screen capped at 7200');
console.assert(saleBlocksLogout({ autoLogoutDuringSale: false }, true, true) === true, 'sale blocks on sell screen');
console.assert(saleBlocksLogout({ autoLogoutDuringSale: false }, false, true) === false, 'sale never blocks other pages');
console.assert(saleBlocksLogout({ autoLogoutDuringSale: true }, true, true) === false, 'toggle on: sale does not block');

const useAutoLogout = ({ isSellScreen, hasActiveSale, onLogout }) => {
  const onLogoutRef = useRef(onLogout);
  const hasActiveSaleRef = useRef(hasActiveSale);
  onLogoutRef.current = onLogout;
  hasActiveSaleRef.current = hasActiveSale;

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    // Always read the live cached blob, so a value saved on the General
    // Settings page applies on the very next re-arm instead of after a reload.
    const settings = () => settingsService.getCachedGeneralSettings();

    const arm = () => {
      clearTimeout(timer);
      timer = setTimeout(fire, resolveTimeoutMs(settings(), isSellScreen));
    };
    const fire = () => {
      if (saleBlocksLogout(settings(), isSellScreen, hasActiveSaleRef.current())) {
        arm();
        return;
      }
      onLogoutRef.current();
    };

    let cleanup = () => clearTimeout(timer);
    settingsService.loadCachedGeneralSettings().then(() => {
      if (cancelled) return;
      window.addEventListener('mousedown', arm);
      window.addEventListener('keydown', arm);
      window.addEventListener('touchstart', arm);
      window.addEventListener(GENERAL_SETTINGS_REFRESHED_EVENT, arm);
      arm();
      cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('mousedown', arm);
        window.removeEventListener('keydown', arm);
        window.removeEventListener('touchstart', arm);
        window.removeEventListener(GENERAL_SETTINGS_REFRESHED_EVENT, arm);
      };
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isSellScreen]);
};

export default useAutoLogout;
