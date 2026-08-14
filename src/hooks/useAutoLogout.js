import { useEffect, useRef } from 'react';
import settingsService from '../services/settingsService';

// Setup > General > Login: "General Auto Logout Time" applies everywhere,
// "Sell Screen Auto Logout Time" overrides it on the sell screen when > 0.
// The general value is clamped to the reference's 60..7200 range; 0/blank means
// the reference default of 7200.
export const resolveTimeoutMs = (settings, isSellScreen) => {
  const sell = Number(settings?.autoLogoutTime) || 0;
  if (isSellScreen && sell > 0) return sell * 1000;
  const general = Number(settings?.generalAutoLogoutTime) || 7200;
  return Math.min(7200, Math.max(60, general)) * 1000;
};

// Runnable self-checks (silent unless the timeout rules regress).
console.assert(resolveTimeoutMs({ autoLogoutTime: 30, generalAutoLogoutTime: 7200 }, true) === 30000, 'sell screen value wins');
console.assert(resolveTimeoutMs({ autoLogoutTime: 30, generalAutoLogoutTime: 600 }, false) === 600000, 'general applies off the sell screen');
console.assert(resolveTimeoutMs({ autoLogoutTime: 0, generalAutoLogoutTime: 0 }, true) === 7200000, 'blank general falls back to 7200');
console.assert(resolveTimeoutMs({ generalAutoLogoutTime: 10 }, false) === 60000, 'general clamped to 60');

const useAutoLogout = ({ isSellScreen, hasActiveSale, onLogout }) => {
  const onLogoutRef = useRef(onLogout);
  const hasActiveSaleRef = useRef(hasActiveSale);
  onLogoutRef.current = onLogout;
  hasActiveSaleRef.current = hasActiveSale;

  useEffect(() => {
    let timer = null;
    let cancelled = false;

    const start = (settings) => {
      const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(fire, resolveTimeoutMs(settings, isSellScreen));
      };
      const fire = () => {
        // "Auto Logout During Sale" off => an in-progress sale keeps the user in.
        if (hasActiveSaleRef.current() && settings.autoLogoutDuringSale !== true) {
          arm();
          return;
        }
        onLogoutRef.current();
      };
      if (cancelled) return;
      window.addEventListener('mousedown', arm);
      window.addEventListener('keydown', arm);
      window.addEventListener('touchstart', arm);
      arm();
      cleanup = () => {
        clearTimeout(timer);
        window.removeEventListener('mousedown', arm);
        window.removeEventListener('keydown', arm);
        window.removeEventListener('touchstart', arm);
      };
    };

    let cleanup = () => clearTimeout(timer);
    settingsService.loadCachedGeneralSettings().then(start);

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isSellScreen]);
};

export default useAutoLogout;
