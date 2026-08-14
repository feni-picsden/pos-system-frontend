// Product names are not unique (and neither are name + price), so every product
// picker labels an option with a disambiguator: its first barcode, else its id.
// Shared so the key editor, the legacy editor and the add-key dialog can't drift.

import { normalizeBarcodeCodes } from '../services/posLocalDb.js';

/** "$5.50 · 9312345" — price plus the identifier that makes the option unique. */
export function productOptionDetail(item) {
  if (!item) return '';
  const price =
    item.retailPrice || item.prices?.[0]?.price || item.calculatedTotalPrice || item.totalPrice || 0;
  // ponytail: barcode reads better on the shop floor; id is the guaranteed fallback.
  const tag = normalizeBarcodeCodes(item.barcodes)[0] || `#${item.id}`;
  return `$${Number(price).toFixed(2)} · ${tag}`;
}

/** "ZZTEST-products - $5.50 · #64" */
export function productOptionLabel(item) {
  return item ? `${item.name || ''} - ${productOptionDetail(item)}` : '';
}

export default productOptionLabel;
