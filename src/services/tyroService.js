// Tyro integrated EFTPOS — device pairing store (reference art. 360020096032).
// On the reference, the Tyro pairing lives in the BROWSER (Tyro's iClient keeps
// it under iclient.tyro.com site data), i.e. per device — replacing a terminal
// means clearing that stored pairing. This mirrors that model with a
// localStorage record on this device.
//
// Actual integrated processing goes through Tyro's iClient library, which needs
// a Tyro-issued POS API key. Until those credentials are configured, a paired
// device records Tyro tenders like a standalone terminal; this module is the
// single place the future iClient adapter plugs into.

const STORAGE_KEY = 'tyroPairing';

export const tyroService = {
  getPairing() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const pairing = raw ? JSON.parse(raw) : null;
      return pairing && pairing.merchantId && pairing.terminalId ? pairing : null;
    } catch {
      return null;
    }
  },

  savePairing({ merchantId, terminalId }) {
    const pairing = {
      merchantId: String(merchantId).trim(),
      terminalId: String(terminalId).trim(),
      pairedAt: new Date().toISOString(),
      // 'standalone' until Tyro iClient credentials are configured.
      mode: 'standalone',
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pairing));
    } catch {
      /* private windows etc. — pairing just won't persist */
    }
    return pairing;
  },

  // The replacement-terminal flow: clear this device's pairing, then pair the
  // new terminal from the sell screen.
  clearPairing() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export default tyroService;
