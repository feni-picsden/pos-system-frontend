// Cash-drawer hardware integration via QZ Tray (https://qz.io).
// The drawer is opened by sending the receipt printer a standard ESC/POS
// "drawer-kick" command. QZ Tray is a small local agent the browser talks to
// over a localhost WebSocket; it relays raw bytes to the printer.
//
// This mirrors Shopfront's "Hardware Connect": a local agent + a configurable
// cash-drawer kick code sent to the selected receipt printer. Settings (printer,
// kick code, brand) are persisted per terminal in localStorage.
//
// qz-tray is loaded lazily so any load-time issue is contained to this feature
// instead of breaking app startup.

const PRINTER_KEY = 'drawerPrinterName';
const KICK_KEY = 'drawerKickCode';
const BRAND_KEY = 'drawerPrinterBrand';

// Standard ESC/POS drawer-kick: ESC p m=0 t1=25 t2=250.
// Decimal "27,112,0,25,250"  ==  hex "1B700019FA"  (Epson + most generic printers).
const DEFAULT_KICK_DECIMAL = '27,112,0,25,250';
const DEFAULT_KICK_HEX = '1B700019FA';

let qzPromise = null;
let connecting = null;
let securityConfigured = false;

async function getQz() {
  if (!qzPromise) {
    qzPromise = import('qz-tray').then((m) => m.default || m);
  }
  return qzPromise;
}

async function configureSecurity(qz) {
  if (securityConfigured) return;
  // Unsigned mode — fine for a trusted single-site install. For production,
  // replace these with a signed certificate + signature per QZ Tray docs.
  qz.security.setCertificatePromise((resolve) => resolve());
  qz.security.setSignaturePromise(() => (resolve) => resolve());
  securityConfigured = true;
}

export function getDrawerPrinter() {
  return localStorage.getItem(PRINTER_KEY) || '';
}
export function setDrawerPrinter(name) {
  if (name) localStorage.setItem(PRINTER_KEY, name);
  else localStorage.removeItem(PRINTER_KEY);
}

export function getKickCode() {
  return localStorage.getItem(KICK_KEY) || DEFAULT_KICK_DECIMAL;
}
export function setKickCode(code) {
  if (code) localStorage.setItem(KICK_KEY, code);
  else localStorage.removeItem(KICK_KEY);
}

export function getPrinterBrand() {
  return localStorage.getItem(BRAND_KEY) || 'Epson';
}
export function setPrinterBrand(brand) {
  if (brand) localStorage.setItem(BRAND_KEY, brand);
  else localStorage.removeItem(BRAND_KEY);
}

/**
 * Convert a kick code to a hex string for QZ Tray.
 * Accepts decimal CSV ("27,112,0,25,250") or hex ("1B700019FA" / "1B 70 00 19 FA").
 */
export function parseKickToHex(input) {
  const s = String(input == null ? '' : input).trim();
  if (!s) return DEFAULT_KICK_HEX;
  // Decimal CSV: only digits + separators.
  if (/[,\s]/.test(s) && /^[0-9,\s]+$/.test(s)) {
    const bytes = s.split(/[\s,]+/).filter(Boolean).map((n) => parseInt(n, 10));
    if (!bytes.length || bytes.some((b) => Number.isNaN(b) || b < 0 || b > 255)) {
      return DEFAULT_KICK_HEX;
    }
    return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  }
  // Hex (strip spaces / 0x).
  const hex = s.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (hex.length >= 2 && hex.length % 2 === 0) return hex.toUpperCase();
  return DEFAULT_KICK_HEX;
}

async function ensureConnected() {
  const qz = await getQz();
  await configureSecurity(qz);
  if (qz.websocket.isActive()) return qz;
  if (!connecting) {
    connecting = Promise.resolve(qz.websocket.connect()).finally(() => {
      connecting = null;
    });
  }
  await connecting;
  return qz;
}

// Returns true if QZ Tray is reachable on this terminal.
export async function isQzAvailable() {
  try {
    const qz = await ensureConnected();
    return qz.websocket.isActive();
  } catch {
    return false;
  }
}

// Returns the list of printer names QZ Tray can see.
export async function listPrinters() {
  const qz = await ensureConnected();
  const found = await qz.printers.find();
  return Array.isArray(found) ? found : [found].filter(Boolean);
}

/**
 * Send the drawer-kick command to the configured (or given) printer.
 * Throws an Error with a `.code` of 'QZ_UNAVAILABLE' | 'NO_PRINTER' | 'PRINT_FAILED'.
 */
export async function kickDrawer({ printerName, kickCode } = {}) {
  let qz;
  try {
    qz = await ensureConnected();
  } catch {
    const err = new Error('QZ Tray is not running on this terminal.');
    err.code = 'QZ_UNAVAILABLE';
    throw err;
  }

  try {
    const name = printerName || getDrawerPrinter();
    const printer = name ? await qz.printers.find(name) : await qz.printers.getDefault();
    if (!printer) {
      const err = new Error('No printer is selected or found for the cash drawer.');
      err.code = 'NO_PRINTER';
      throw err;
    }
    const hex = parseKickToHex(kickCode != null ? kickCode : getKickCode());
    const config = qz.configs.create(printer);
    await qz.print(config, [{ type: 'raw', format: 'hex', data: hex }]);
    return { printer: String(printer), hex };
  } catch (e) {
    if (e.code) throw e;
    const err = new Error(e?.message || 'Failed to send the drawer command.');
    err.code = 'PRINT_FAILED';
    throw err;
  }
}

export default {
  isQzAvailable,
  listPrinters,
  kickDrawer,
  getDrawerPrinter,
  setDrawerPrinter,
  getKickCode,
  setKickCode,
  getPrinterBrand,
  setPrinterBrand,
  parseKickToHex,
};
