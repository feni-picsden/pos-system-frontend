// Best-match-first ordering for product search results - the same rules as the
// server (pos-system-backend/lib/productSearch.js), so the sell screen's local
// catalog and every server-backed search box list results in one order:
//   0 a barcode equals the search      3 every word starts a word of the name
//   1 the name equals the search       4 the name contains the search
//   2 the name starts with the search  5 matched elsewhere (other words / description / barcode)
// then name A-Z.

const wordsOf = (q) => String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const barcodeCodes = (barcodes) => (Array.isArray(barcodes) ? barcodes : [])
  .map((b) => (typeof b === 'string' || typeof b === 'number' ? String(b) : (b?.code ?? b?.barcode ?? '')))
  .map((s) => String(s).trim().toLowerCase())
  .filter(Boolean);

/** Lower = better. */
export function searchRank(product, search) {
  const q = String(search || '').trim().toLowerCase();
  const name = String(product?.name || '').toLowerCase();
  if (!q) return 5;
  if (barcodeCodes(product?.barcodes).includes(q)) return 0;
  if (name === q) return 1;
  if (name.startsWith(q)) return 2;
  if (wordsOf(q).every((w) => new RegExp(`(^|[^a-z0-9])${escapeRe(w)}`).test(name))) return 3;
  if (name.includes(q)) return 4;
  return 5;
}

/** Products best match first, then name A-Z (stable on id). */
export function rankProducts(products, search) {
  return [...(products || [])]
    .map((p) => ({ p, r: searchRank(p, search) }))
    .sort((a, b) => a.r - b.r
      || String(a.p.name || '').localeCompare(String(b.p.name || ''), undefined, { sensitivity: 'base' })
      || (a.p.id || 0) - (b.p.id || 0))
    .map((x) => x.p);
}
