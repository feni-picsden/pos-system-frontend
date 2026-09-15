// Family prices for the product editor.
//
// A Family is "products that are price-aligned and grouped together" — the family
// itself stores no prices (see Classification in schema.prisma: name, type, colour
// and nothing else). The family's price is the FIRST product in it that carries a
// price, with members in family order (earliest created first — the order the
// family's assignment list shows). The server aligns to the same product, see
// familyPriceFrom in pos-system-backend/lib/productDerive.js.
//
// Pure and dependency-free so the rules can be tested without the editor.
//
// What picking a family replaces:
//   * the default quantity/price tiers (the "price quantities")
//   * the retail tax rate
// What it deliberately keeps:
//   * cost — a product's cost comes from what IT was bought for, not from its
//     shelf-mates. Copying a sibling's cost would silently rewrite this product's
//     margin, and cost is not what the family aligns on.

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * A product's DEFAULT price tiers, normalised and ordered by quantity.
 * Rows belonging to a Price Set are excluded: a set is an alternative price point
 * layered over the default group, so it is not what the family aligns on.
 */
export function defaultTiers(product) {
  const rows = Array.isArray(product?.prices) ? product.prices : [];
  return rows
    .filter((r) => r?.priceSetId == null)
    .map((r) => ({ quantity: num(r.quantity) ?? 1, price: num(r.price) ?? 0 }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity);
}

/**
 * The price template a family offers: its first member (in the order given) that
 * carries a price.
 *
 * @param {Array} members  products already in the family, in family order
 *                         (exclude the one being edited)
 * @returns {object|null}  { prices, retailTaxRate, sourceProduct }, or null when no
 *                         member carries a price.
 */
export function deriveFamilyTemplate(members) {
  const source = (Array.isArray(members) ? members : []).find(
    (m) => m && defaultTiers(m).length > 0
  );
  if (!source) return null;
  return {
    prices: defaultTiers(source),
    retailTaxRate: source.retailTaxRate || null,
    sourceProduct: source,
  };
}

// --- Price points: best rate --------------------------------------------------------
//
// Shopfront "Quantity Rate": a quantity sells at the BEST (lowest) per-unit rate among
// the price points equal to or below it — "the best price for the customer". A pack
// priced dearer per unit than a smaller price point is therefore never used: a $5
// single with a $60 six-pack sells 6 for $30, not $60.

/**
 * The price point a quantity sells at: lowest price/quantity among the rows whose
 * quantity is at or below `quantity`. On an equal rate the larger pack wins (same
 * money). Rows without a usable quantity or price are skipped.
 * @returns the row, or null when no price point is at or below the quantity
 */
export function bestRateTier(rows, quantity) {
  const qty = Number(quantity);
  let best = null;
  let bestRate = Infinity;
  for (const row of Array.isArray(rows) ? rows : []) {
    const q = num(row?.quantity);
    const p = num(row?.price);
    if (q == null || q <= 0 || !(q <= qty) || p == null) continue;
    const rate = p / q;
    const better = rate < bestRate - 1e-9;
    const tieLargerPack = best && Math.abs(rate - bestRate) <= 1e-9 && q > num(best.quantity);
    if (better || tieLargerPack) {
      best = row;
      bestRate = rate;
    }
  }
  return best;
}

/**
 * The first price point priced at a HIGHER per-unit rate than a smaller quantity in
 * the same price group (Price Set). The register sells at the best rate, so such a
 * price point would never be used — the product editor asks before saving it
 * (reference "Invalid Price Rates Detected"). Blank and $0 rows are ignored.
 * @returns the offending quantity, or null
 */
export function findHigherRateQuantity(rows) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const q = num(row?.quantity);
    const p = num(row?.price);
    if (!(q > 0) || !(p > 0)) continue;
    const key = row?.priceSetId ?? 'default';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ quantity: q, rate: p / q });
  }
  let found = null;
  for (const list of groups.values()) {
    list.sort((a, b) => a.quantity - b.quantity);
    let lowestSoFar = Infinity;
    for (const tier of list) {
      if (tier.rate > lowestSoFar + 1e-9) {
        if (found == null || tier.quantity < found) found = tier.quantity;
        break;
      }
      lowestSoFar = Math.min(lowestSoFar, tier.rate);
    }
  }
  return found;
}

// --- Sell screen: family quantity pricing ----------------------------------------
//
// Family products share their price points at the register: 3 x Beer A + 3 x Beer B
// in a family priced "6 for $16" is 6 bottles, so the pair sells for $16 — not two
// lines of 3 at the single price. The page prices a family group's COMBINED quantity
// with its normal price-point rule, then splits that total back onto the lines.

/** Stable key for a price-tier list, so "same prices" is a string comparison. */
export function tiersKey(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((r) => ({ quantity: num(r?.quantity) ?? 1, price: num(r?.price) ?? 0 }))
    .filter((r) => r.quantity > 0)
    .sort((a, b) => a.quantity - b.quantity || a.price - b.price)
    .map((r) => `${r.quantity}@${r.price}`)
    .join('|');
}

/**
 * Cart lines that price together: 2+ lines whose products share a family AND the
 * same price tiers. A family whose members disagree on price cannot say whose
 * "6 for $16" applies, so those lines keep pricing on their own.
 *
 * @param {Array<{ familyId, tiersKey: string, quantity: number }>} lines
 * @returns {Array<Array>} the groups, each of 2+ lines, in cart order
 */
export function groupFamilyLines(lines) {
  const groups = new Map();
  for (const line of Array.isArray(lines) ? lines : []) {
    if (line?.familyId == null || !line.tiersKey || !(Number(line.quantity) > 0)) continue;
    const id = `${line.familyId}|${line.tiersKey}`;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(line);
  }
  return [...groups.values()].filter((group) => group.length > 1);
}

/**
 * Split a family total across its lines by quantity, to the cent, so the line
 * prices always add back up to exactly the total: $16 over 3 + 3 is $8 + $8, and
 * over 4 + 2 is $10.67 + $5.33 (the leftover cent goes to the largest remainder).
 */
export function shareByQuantity(total, quantities) {
  const qty = (Array.isArray(quantities) ? quantities : []).map((q) => Math.max(0, Number(q) || 0));
  const sum = qty.reduce((a, b) => a + b, 0);
  if (sum <= 0) return qty.map(() => 0);
  const cents = Math.round((Number(total) || 0) * 100);
  const exact = qty.map((q) => (cents * q) / sum);
  const shares = exact.map((e) => Math.floor(e));
  let left = cents - shares.reduce((a, b) => a + b, 0);
  const byRemainder = exact
    .map((e, i) => [e - shares[i], i])
    .sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0 && k < byRemainder.length; k += 1, left -= 1) {
    shares[byRemainder[k][1]] += 1;
  }
  return shares.map((c) => c / 100);
}

/**
 * Apply a template to the editor's form data.
 *
 * Each tier keeps the cost the product already had at that quantity (matched by
 * quantity, else the qty-1 cost, else 0) so the family changes what the customer
 * pays without touching what the product cost us. Price Set rows are kept.
 */
export function applyFamilyTemplate(formData, template) {
  if (!formData || !template) return formData;

  const existing = Array.isArray(formData.prices) ? formData.prices : [];
  const defaults = existing.filter((r) => r?.priceSetId == null);
  const priceSetRows = existing.filter((r) => r?.priceSetId != null);
  const costFor = (quantity) => {
    const exact = defaults.find((r) => (num(r.quantity) ?? 1) === quantity);
    if (exact) return { cost: num(exact.cost) ?? 0, percentage: num(exact.percentage) ?? 0 };
    const base = defaults.find((r) => (num(r.quantity) ?? 1) === 1) || defaults[0];
    return { cost: num(base?.cost) ?? 0, percentage: num(base?.percentage) ?? 0 };
  };

  return {
    ...formData,
    prices: [
      ...template.prices.map((t) => ({
        quantity: t.quantity,
        price: t.price,
        ...costFor(t.quantity),
      })),
      ...priceSetRows,
    ],
    ...(template.retailTaxRate ? { retailTaxRate: template.retailTaxRate } : {}),
  };
}
