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

// --- Picking a family: what the user is told before it happens -------------------
//
// Joining a family REPLACES this product's prices with the family's, and at the till
// the family's quantity breaks are reached by adding its members together. Putting a
// product in the wrong family is therefore a pricing mistake (go-live audit:
// Coca-Cola 1.25L in "Beer Stubbies 375ml" took the beers' prices). The editor asks
// first, showing exactly what will change.

/** "1 for $5.00, 6 for $16.00" — a product's default price points, for display. */
export function formatTiers(product) {
  return defaultTiers(product)
    .map((t) => `${t.quantity} for $${t.price.toFixed(2)}`)
    .join(', ');
}

const categoryName = (product) =>
  (typeof product?.category === 'string' ? product.category : product?.category?.name) || '';

/**
 * Is this product a stranger in the family? Compares its category with the ACTIVE
 * members' categories.
 * @returns {{ mismatch: boolean, familyCategories: string[] }}
 *          mismatch is false when either side has no category to compare.
 */
export function familyCategoryCheck(productCategory, members) {
  const familyCategories = [...new Set(
    (Array.isArray(members) ? members : [])
      .filter((m) => m && m.isActive !== false)
      .map(categoryName)
      .filter(Boolean),
  )].sort();
  const mine = String(productCategory || '').trim();
  const mismatch = !!mine && familyCategories.length > 0 && !familyCategories.includes(mine);
  return { mismatch, familyCategories };
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
 * Shopfront "High Mix Price" (Setup > General > Use Quantity Rate = High Mix Price):
 * the quantity is built up from whole price points — "incrementally adding the
 * previous price points until we reach the purchase quantity" — each at ITS price,
 * never a pack's per-unit rate spread over the loose units. Reference example,
 * 1 @ $10 / 2 @ $15, buying 3: $15 + $10 = $25 (Quantity Rate gives $22.50).
 *
 * "Shopfront will still calculate the best price for the customer by looking at
 * all price points that are equal to or below the purchase quantity": of every
 * way to make the quantity from price points at or below it, the cheapest wins
 * (two 4-packs beat a 4-pack plus four singles). Only points at or below the
 * quantity are used — a dearer-per-unit bigger pack is never forced in.
 *
 * Price points are small (a handful of rows) and quantities are sale sizes, so a
 * straightforward exact-cover minimum is cheap.
 * @returns the total for `quantity`, or null when no price point can make it up
 */
export function highMixPrice(rows, quantity) {
  const qty = Math.round(Number(quantity));
  if (!Number.isFinite(qty) || qty <= 0) return null;
  const points = (Array.isArray(rows) ? rows : [])
    .map((r) => ({ q: num(r?.quantity), p: num(r?.price) }))
    .filter((r) => r.q != null && r.q > 0 && r.q <= qty && r.p != null && Number.isInteger(r.q));
  if (!points.length) return null;
  // best[n] = cheapest way to make exactly n units from whole price points
  const best = new Array(qty + 1).fill(Infinity);
  best[0] = 0;
  for (let n = 1; n <= qty; n += 1) {
    for (const { q, p } of points) {
      if (q <= n && best[n - q] + p < best[n]) best[n] = best[n - q] + p;
    }
  }
  if (Number.isFinite(best[qty])) return best[qty];
  // No exact cover (e.g. only a 6-pack row, buying 7): the largest cover that
  // fits, with the leftover units at the smallest point's per-unit rate.
  const smallest = points.reduce((a, b) => (b.q < a.q ? b : a));
  for (let n = qty - 1; n >= 1; n -= 1) {
    if (Number.isFinite(best[n])) return best[n] + ((qty - n) * smallest.p) / smallest.q;
  }
  return (qty * smallest.p) / smallest.q;
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
 * Setup > General > "Family Price Distribution Method" = Match Price Points.
 * Only meaningful under High Mix Price (the reference says so). Rule, fitted to
 * the three support-article examples and six baskets measured on the reference
 * (TEST family, 08/10/2026; price points 1 @ 6.50, 4 @ 24, 10 @ 55, 24 @ 120):
 *
 *   a line is MATCHED when its quantity is a price point exactly, or a whole
 *   multiple of a pack point (8 = 2 x 4, 12 = 3 x 4); a matched line is priced at
 *   its own High Mix price (3 x 4-pack = $47.97 for 12).
 *   the UNMATCHED lines take what is left of the family total, shared by quantity
 *   (12/8/5: $47.97 + $31.98, the 5 gets -$4.95 - the article's own example).
 *   all matched and the total does not add up: the LAST line absorbs the gap
 *   (five singles on "4 for $15.99 + 1": $5 x 4 and $0.99).
 *   nothing matched: evenly ($30.50 over 2 + 3 rang up $12.20 / $18.30).
 *
 * @param total      the family's High Mix total for the combined quantity
 * @param quantities per line, cart order
 * @param rows       the family's price points
 * @param ownTotal   (quantity) => that quantity's own High Mix price
 * @returns one price per line, to the cent, summing to `total`
 */
export function matchPricePoints(total, quantities, rows, ownTotal) {
  const qty = (Array.isArray(quantities) ? quantities : []).map((q) => Math.max(0, Number(q) || 0));
  const points = (Array.isArray(rows) ? rows : [])
    .map((r) => num(r?.quantity))
    .filter((q) => q != null && q > 0);
  const isMatched = (q) =>
    Number.isInteger(q) && points.some((p) => q === p || (p > 1 && q % p === 0));
  const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const matched = qty.map(isMatched);
  if (!matched.some(Boolean)) return shareByQuantity(total, qty);

  const prices = qty.map((q, i) => (matched[i] ? cents(ownTotal(q)) : null));
  const matchedSum = cents(prices.reduce((a, p) => a + (p || 0), 0));
  const unmatchedIdx = qty.map((_, i) => i).filter((i) => !matched[i]);
  if (unmatchedIdx.length) {
    const shares = shareByQuantity(cents(total - matchedSum), unmatchedIdx.map((i) => qty[i]));
    unmatchedIdx.forEach((i, k) => { prices[i] = shares[k]; });
    return prices;
  }
  const gap = cents(total - matchedSum);
  if (gap !== 0) prices[prices.length - 1] = cents(prices[prices.length - 1] + gap);
  return prices;
}

// --- Family vs promotion at the register: the cheaper one wins ---------------------
//
// Reference (promotion worker): a line on promotion is NOT left out of its family.
// Every way of pricing the basket is totalled and the LOWEST total is applied —
// "the best price for the customer". Two ways matter for a family group:
//
//   all-family   every line sells on the family's combined quantity
//   promo-kept   promotion lines keep their promotion price; the OTHER lines still
//                group as a family among themselves (the reference re-prices the
//                "remaining" family quantity the same way)
//
// Before this, a promotion line was simply excluded from the family, so
// 3 x VB + 3 x Carlton(promo $3.50) cost $15 + $10.50 = $25.50 although the family's
// "6 for $16" was cheaper — the promotion made the basket dearer.
//
// Pure. `familyTotalFor(quantity)` is the family's everyday price for a combined
// quantity; `finalize(line, share)` turns a line's share into its final price (the
// customer's price list), defaulting to the share itself.
//
// @param group  lines of ONE family group (2+): { quantity, ownPrice, promoPriced }
// @param distribute  (total, quantities) => per-line shares; defaults to Evenly
//                    (shareByQuantity), Match Price Points passes matchPricePoints
// @returns one entry per line, same order: { price, familyPriced }
export function chooseFamilyPricing(
  group,
  familyTotalFor,
  finalize = (line, share) => share,
  distribute = shareByQuantity,
) {
  const cents = (n) => Math.round((Number(n) || 0) * 100) / 100;
  const sum = (arr) => cents(arr.reduce((a, b) => a + b, 0));
  // Family prices for a subset of the lines, or null when it is not a group.
  const asFamily = (subset) => {
    if (subset.length < 2) return null;
    const quantities = subset.map((l) => l.quantity);
    const total = familyTotalFor(quantities.reduce((a, b) => a + b, 0));
    const shares = distribute(total, quantities);
    return subset.map((l, i) => cents(finalize(l, shares[i])));
  };

  const lines = Array.isArray(group) ? group : [];
  const allFamily = asFamily(lines);
  if (!allFamily) return lines.map((l) => ({ price: cents(l.ownPrice), familyPriced: false }));

  const promo = lines.filter((l) => l.promoPriced);
  if (promo.length === 0) return allFamily.map((price) => ({ price, familyPriced: true }));

  const rest = lines.filter((l) => !l.promoPriced);
  const restFamily = asFamily(rest);
  const keptTotal = sum(promo.map((l) => l.ownPrice))
    + (restFamily ? sum(restFamily) : sum(rest.map((l) => l.ownPrice)));

  // Strictly cheaper only: on a tie the promotion stays (its saving stays visible).
  if (sum(allFamily) < keptTotal - 0.005) {
    return allFamily.map((price) => ({ price, familyPriced: true }));
  }
  return lines.map((l) => {
    if (l.promoPriced) return { price: cents(l.ownPrice), familyPriced: false };
    const i = rest.indexOf(l);
    return restFamily
      ? { price: restFamily[i], familyPriced: true }
      : { price: cents(l.ownPrice), familyPriced: false };
  });
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
