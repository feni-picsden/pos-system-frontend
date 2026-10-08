// Controlled number inputs that can be emptied.
//
// `value={x || 0}` + `onChange={parseFloat(e.target.value) || 0}` turns a
// cleared box straight back into "0", so the 0 can never be erased and typing
// after it gives "05". These helpers keep '' in state while the user types and
// settle it to a number on blur (or wherever the value is consumed).

/** Raw input text -> number, or '' while the box is empty / mid-edit. */
export const parseNumberInput = (raw, { int = false } = {}) => {
  if (raw === '' || raw == null) return '';
  const n = int ? parseInt(raw, 10) : parseFloat(raw);
  return Number.isNaN(n) ? '' : n;
};

/** State -> what the input shows ('' stays '', never a forced 0). */
export const numberInputValue = (v) => (v === '' || v == null ? '' : v);

/** State -> number for calculations and saving; '' falls back. */
export const finishNumber = (v, fallback = 0) => {
  if (v === '' || v == null) return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : n;
};
