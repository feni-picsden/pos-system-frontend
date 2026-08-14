// A product's `prices` array comes back unfiltered and in row-id order:
// GET /products includes every tier for every outlet (routes/products.js:170
// selects outletId with no `where`). So prices[0] is whichever row was created
// first — for a product with a bulk tier that is the CASE price, not the unit
// price, and any per-unit maths built on it is off by the case size.
//
// The base tier is the cheapest-granularity row the given outlet actually sees:
//   1. rows for that outlet, else global rows (outletId null), else anything
//   2. within those, quantity 1 if present, else the smallest quantity
export function getBaseTier(prices, outletId = null) {
  const tiers = Array.isArray(prices) ? prices : [];
  if (tiers.length === 0) return null;

  const scoped = outletId
    ? tiers.filter((t) => String(t.outletId) === String(outletId))
    : [];
  const global = tiers.filter((t) => t.outletId === null || t.outletId === undefined);
  const pool = scoped.length ? scoped : global.length ? global : tiers;

  return (
    pool.find((t) => Number(t.quantity) === 1) ||
    [...pool].sort((a, b) => (Number(a.quantity) || 0) - (Number(b.quantity) || 0))[0]
  );
}
