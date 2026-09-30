// Keyboard rules for a search-result dropdown (reference: the top result is
// highlighted as soon as results appear, ArrowDown/ArrowUp move the highlight
// and wrap around (down from the last row lands on the first, up from the first
// on the last),
// Enter adds the highlighted row, Escape closes). Pure - the hook wraps it.

/** Index after a key press; -1 = close, same index = nothing to do. */
export const nextIndex = (key, index, length) => {
  if (!(length > 0)) return -1;
  const cur = index >= 0 && index < length ? index : 0;
  if (key === 'ArrowDown') return (cur + 1) % length;
  if (key === 'ArrowUp') return (cur - 1 + length) % length;
  if (key === 'Escape') return -1;
  return cur;
};

/** The row Enter picks: the highlighted one, else the top result. */
export const pickIndex = (index, length) => {
  if (!(length > 0)) return -1;
  return index >= 0 && index < length ? index : 0;
};
