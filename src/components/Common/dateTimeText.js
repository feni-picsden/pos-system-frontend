import { parse, isValid } from 'date-fns';

// Text formats shared by the Shopfront date-time field (DateTimeField.jsx).
export const DT_FORMAT = 'dd/MM/yyyy HH:mm:ss';
export const DT_MASK = 'DD/MM/YYYY HH:MM:SS';
const ACCEPTED_FORMATS = [DT_FORMAT, 'dd/MM/yyyy HH:mm', 'dd/MM/yyyy'];

// Accepts a fully or partially timed DD/MM/YYYY string; null when unparseable.
export const parseDateTimeText = (text) => {
  const t = (text || '').trim();
  if (!t) return null;
  for (const f of ACCEPTED_FORMATS) {
    const d = parse(t, f, new Date());
    // Reject part-typed years (01/01/2 -> year 2) so auto-applying filters never
    // fires a fetch against a half-entered date.
    if (isValid(d) && d.getFullYear() >= 1000) return d;
  }
  return null;
};
