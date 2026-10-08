// Single-criterion "purchase N" promotions priced over the whole cart, with the
// Setup > General > Company "Cross promotion count" toggle.
//
// Reference More Info: "determines whether products that are on promotion, but
// not active on that promotion should count towards the quantity of the
// promotion." Measured on the reference (TEST store, toggle ON, 08/10/2026) with
// A $15 and B $10, promo 1 "buy 2 A -> $20", promo 2 "buy 6 of A+B -> 10% off":
//
//   ON   4A+2B = A $40, B $18 | 6A = $60 | 3A+3B = A $33.50, B $27
//        2A+4B = A $20, B $36 | 1A+5B = A $13.50, B $45 | 4A+1B = A $40, B $10
//   OFF  4A+2B = A $40, B $20   (support article: "Shopfront will choose between
//        the two promotional options and select the end price that's cheaper")
//
// The rule that reproduces every line:
//   * every promotion is judged on units; a promotion qualifies with
//     floor(eligible units / N) sets and covers sets x N units, dearest first;
//   * ON   each promotion counts EVERY eligible unit, even one another promotion
//          already prices; a unit then sells at the cheapest price any covering
//          promotion gives it (never above its normal price);
//   * OFF  a unit belongs to one promotion only: promotions are applied one after
//          another on the units still free, and of every order of applying them
//          the cheapest basket wins.
//   Units a promotion does not cover (leftovers) stay at the normal price, and a
//   line is never dearer than its own normal total.
//
// Pure: no React, no services.

const cents = (n) => Math.round((Number(n) || 0) * 100);

// Price one unit (cents) under a promotion's reward.
const unitUnderPromo = (promo, unitCents) => {
  switch (promo.receiveType) {
    case 'total_price': return (cents(promo.receiveValue)) / promo.setQty;
    case 'each_item_for': return cents(promo.receiveValue);
    case 'discount_each_item': return Math.max(0, unitCents - cents(promo.receiveValue));
    case 'discount_total':
    case 'discount': return Math.max(0, unitCents - cents(promo.receiveValue) / promo.setQty);
    case 'percentage_discount': return unitCents * (1 - (Number(promo.receiveValue) || 0) / 100);
    default: return unitCents; // quantity_only
  }
};

const permutations = (arr) => {
  if (arr.length <= 1) return [arr];
  const out = [];
  arr.forEach((x, i) => {
    permutations([...arr.slice(0, i), ...arr.slice(i + 1)]).forEach((rest) => out.push([x, ...rest]));
  });
  return out;
};

/**
 * @param {Array<{index:any, productId:any, q:number, unit:number}>} lines
 *        cart lines: integer units at a normal unit price
 * @param {Array<{key:any, productIds:Set<string>, setQty:number, receiveType:string,
 *        receiveValue:number, maxSets?:number}>} promos
 * @param {{ crossCount?: boolean, rounding?: 'Redistribute'|'Round' }} [options]
 * @returns {{ prices: Map<any, number>, applied: Map<any, boolean>, promoOf: Map<any, any> }}
 *   prices   line index -> line total ($); applied promo key -> at least one set;
 *   promoOf  line index -> the promotion that priced most of its units (for the strip)
 */
export const allocateCrossPromotions = (lines, promos, { crossCount = true, rounding = 'Redistribute' } = {}) => {
  // Explode the cart into units, dearest first within a product (so coverage
  // "dearest first" is a prefix), keeping the line each unit came from.
  const units = [];
  lines.forEach((l) => {
    const n = Math.max(0, Math.floor(Number(l.q) || 0));
    for (let i = 0; i < n; i += 1) units.push({ line: l.index, productId: String(l.productId), normal: cents(l.unit) });
  });
  units.sort((a, b) => b.normal - a.normal);

  const live = promos.filter((p) => p.setQty >= 1 && p.productIds.size > 0);

  // One pass of one promotion over the units it may use. Returns the unit
  // indexes it covers (sets x N, dearest first) or [] when it does not qualify.
  const cover = (promo, usable) => {
    const eligible = usable.filter((u) => promo.productIds.has(units[u].productId));
    let sets = Math.floor(eligible.length / promo.setQty);
    if (Number.isFinite(promo.maxSets) && promo.maxSets > 0) sets = Math.min(sets, promo.maxSets);
    return sets > 0 ? eligible.slice(0, sets * promo.setQty) : [];
  };

  const priceWith = (order, exclusive) => {
    const price = units.map((u) => u.normal);
    const owner = units.map(() => null);
    const appliedKeys = new Set();
    let free = units.map((_, i) => i);
    order.forEach((promo) => {
      const covered = cover(promo, exclusive ? free : units.map((_, i) => i));
      if (!covered.length) return;
      appliedKeys.add(promo.key);
      covered.forEach((u) => {
        const p = unitUnderPromo(promo, units[u].normal);
        if (p < price[u] - 1e-9) { price[u] = p; owner[u] = promo.key; }
      });
      if (exclusive) free = free.filter((u) => !covered.includes(u));
    });
    return { price, owner, appliedKeys, total: price.reduce((a, b) => a + b, 0) };
  };

  let best;
  if (crossCount || live.length <= 1) {
    best = priceWith(live, false);
  } else {
    // OFF: units are exclusive; the cheapest order of applying the promotions wins.
    permutations(live).forEach((order) => {
      const r = priceWith(order, true);
      if (!best || r.total < best.total - 1e-9) best = r;
    });
  }

  // Line totals: exact unit cents summed, then rounded per the Price Rounding
  // Mode within each promotion's lines so a "3 for $10" still adds to $10.00.
  const exactByLine = new Map();
  const ownerCount = new Map(); // line -> { promoKey -> units }
  units.forEach((u, i) => {
    exactByLine.set(u.line, (exactByLine.get(u.line) || 0) + best.price[i]);
    if (best.owner[i] != null) {
      const m = ownerCount.get(u.line) || new Map();
      m.set(best.owner[i], (m.get(best.owner[i]) || 0) + 1);
      ownerCount.set(u.line, m);
    }
  });
  const rounded = new Map();
  lines.forEach((l) => rounded.set(l.index, Math.round(exactByLine.get(l.index) || 0)));
  if (rounding !== 'Round') {
    // Square each total_price promotion's lines up to its exact promo total: the
    // largest of its lines (first on a tie) absorbs the rounding, as splitCents does.
    live.filter((p) => p.receiveType === 'total_price').forEach((promo) => {
      const its = lines.filter((l) => ownerCount.get(l.index)?.has(promo.key));
      if (!its.length) return;
      const exactSum = its.reduce((s, l) => s + (exactByLine.get(l.index) || 0), 0);
      const target = Math.round(exactSum);
      const roundedSum = its.reduce((s, l) => s + rounded.get(l.index), 0);
      if (roundedSum === target) return;
      const big = its.reduce((a, b) => ((exactByLine.get(b.index) || 0) > (exactByLine.get(a.index) || 0) ? b : a));
      rounded.set(big.index, rounded.get(big.index) + (target - roundedSum));
    });
  }

  const prices = new Map();
  const promoOf = new Map();
  lines.forEach((l) => {
    const normalTotal = cents(l.unit) * Math.max(0, Math.floor(Number(l.q) || 0));
    prices.set(l.index, Math.min(rounded.get(l.index), normalTotal) / 100);
    const m = ownerCount.get(l.index);
    if (m && m.size) promoOf.set(l.index, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  });
  const applied = new Map(live.map((p) => [p.key, best.appliedKeys.has(p.key)]));
  return { prices, applied, promoOf };
};

export default allocateCrossPromotions;
