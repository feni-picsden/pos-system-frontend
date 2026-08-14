const POPUP_BOUNDS_KEY = 'customerDisplayWindowBounds';

const readSavedBounds = () => {
  try {
    const raw = localStorage.getItem(POPUP_BOUNDS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const left = Number(parsed.left);
    const top = Number(parsed.top);
    const width = Number(parsed.width);
    const height = Number(parsed.height);
    if (![left, top, width, height].every(Number.isFinite)) return null;
    if (width <= 0 || height <= 0) return null;
    return { left, top, width, height };
  } catch (_) {
    return null;
  }
};

const savePopupBounds = (popup) => {
  if (!popup || popup.closed) return;
  try {
    const bounds = {
      left: popup.screenX,
      top: popup.screenY,
      width: popup.outerWidth,
      height: popup.outerHeight,
    };
    localStorage.setItem(POPUP_BOUNDS_KEY, JSON.stringify(bounds));
  } catch (_) {}
};

const trackPopupBounds = (popup) => {
  if (!popup) return;
  const intervalId = window.setInterval(() => {
    if (!popup || popup.closed) {
      window.clearInterval(intervalId);
      return;
    }
    savePopupBounds(popup);
  }, 1000);
};

const buildFeatures = (screenInfo, savedBounds) => {
  const width = savedBounds?.width || screenInfo?.availWidth || window.screen.availWidth || 1200;
  const height = savedBounds?.height || screenInfo?.availHeight || window.screen.availHeight || 700;
  const left = savedBounds?.left ?? screenInfo?.availLeft ?? 0;
  const top = savedBounds?.top ?? screenInfo?.availTop ?? 0;

  return `popup=yes,left=${left},top=${top},width=${width},height=${height},resizable=yes,scrollbars=no`;
};

const getTargetScreen = async () => {
  if (!window.getScreenDetails) return null;
  try {
    const details = await window.getScreenDetails();
    if (!details?.screens?.length || details.screens.length < 2) return null;
    return details.screens.find((screen) => !screen.isPrimary) || details.screens[1];
  } catch (error) {
    return null;
  }
};

export const CUSTOMER_DISPLAY_WINDOW_NAME = 'customerDisplayWindow';
export const CUSTOMER_DISPLAY_MESSAGE_TYPE = 'POS_CUSTOMER_DISPLAY_STATE';
const CUSTOMER_DISPLAY_STORAGE_PREFIX = 'posCustomerDisplayState:';

/** Set when {@link openCustomerDisplayWindow} succeeds; cleared when closed or stale. */
let customerDisplayWindowRef = null;

export const getCustomerDisplayStorageKey = (registerId) =>
  `${CUSTOMER_DISPLAY_STORAGE_PREFIX}${registerId}`;

/**
 * Push cart/customer to customer display without HTTP (same machine / popup).
 */
export const publishCustomerDisplayState = (registerId, mode, payload) => {
  if (registerId == null) return;
  const message = {
    type: CUSTOMER_DISPLAY_MESSAGE_TYPE,
    registerId: Number(registerId),
    mode,
    payload,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(
      getCustomerDisplayStorageKey(registerId),
      JSON.stringify(message)
    );
  } catch {
    // localStorage may be unavailable (private mode / quota); display falls back to polling
  }

  if (customerDisplayWindowRef && !customerDisplayWindowRef.closed) {
    try {
      customerDisplayWindowRef.postMessage(message, window.location.origin);
    } catch {
      // Popup may have navigated away; storage/polling channels still deliver state
    }
  }

  try {
    window.dispatchEvent(
      new CustomEvent('pos-customer-display-state', { detail: message })
    );
  } catch {
    // CustomEvent unsupported; other channels still deliver state
  }
};

export const isCustomerDisplayWindowOpen = () => {
  if (!customerDisplayWindowRef) return false;
  if (customerDisplayWindowRef.closed) {
    customerDisplayWindowRef = null;
    return false;
  }
  return true;
};

export const closeCustomerDisplayWindow = () => {
  try {
    if (customerDisplayWindowRef && !customerDisplayWindowRef.closed) {
      customerDisplayWindowRef.close();
    }
  } catch (_) {
  } finally {
    customerDisplayWindowRef = null;
  }
};

// localStorage.selectedRegisterId is the single owner (SelectedRegisterContext
// persists and clears it). The sessionStorage mirror this used to prefer was a
// second copy that outranked its source and nothing ever invalidated, so it
// survived logout and pointed the display at the previous user's register.
const resolveRegisterIdFromStorage = () => {
  try {
    const n = parseInt(localStorage.getItem('selectedRegisterId') || '', 10);
    return Number.isNaN(n) ? null : n;
  } catch (_) {
    return null;
  }
};

export const openCustomerDisplayWindow = async (registerId) => {
  const id = registerId ?? resolveRegisterIdFromStorage();

  const targetScreen = await getTargetScreen();
  const savedBounds = targetScreen ? null : readSavedBounds();
  const url = id != null
    ? `/customer-display?registerId=${encodeURIComponent(id)}`
    : '/customer-display';
  const popup = window.open(
    url,
    CUSTOMER_DISPLAY_WINDOW_NAME,
    buildFeatures(targetScreen, savedBounds),
  );
  if (!popup) return null;

  customerDisplayWindowRef = popup;
  savePopupBounds(popup);
  trackPopupBounds(popup);
  popup.focus();
  return popup;
};
