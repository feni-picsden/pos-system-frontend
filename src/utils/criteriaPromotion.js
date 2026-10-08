// Advanced promotions whose criteria are all "Required - purchase N - to receive a
// total price of $V", priced across the whole cart. The reference (Shopfront)
// rules, each one checked by ringing sales up on the live POS:
//   * a criterion's products count TOGETHER (3 + 3 of two products = one set of 6);
//   * with SEVERAL criteria every one must be met: one "set" is N1 of criterion 1
//     AND N2 of criterion 2 ... (Prosecco alone or Muscat alone = normal price,
//     both together = $15 + $17);
//   * the promotion repeats per complete set (2 units of "Purchase 1" = 2 sets);
//   * units left over sell at their normal unit price;
//   * the number of sets is the one that saves the customer the most, taking the
//     dearest units first (never a set that costs more than normal);
//   * a criterion's promo total is split over its covered units in cents per the
//     company's Price Rounding Mode (splitCents: Redistribute keeps the total,
//     Round rounds every line);
//   * a line that also has left-over units never costs more than it would on its
//     own (2 Prosecco + 1 Muscat: the Prosecco line keeps its own $28 two-bottle
//     price rather than $15 + one bottle);
//   * "applied" (blue) only when every eligible unit in the cart is in a set.
// Pure: no React, no services.

const cents = (n) => Math.round(n * 100);

/**
 * Setup > General > "Price Rounding Mode": how a promo total in cents is split
 * over the lines it covers, in proportion to `weights` (units or value).
 *   Redistribute  the total is kept exactly: every line rounds on its own and
 *                 the LARGEST line (first on a tie) takes the total less the
 *                 others. Both reference More Info tables come out of that:
 *                 "3 for $10" = $3.34 / $3.33 / $3.33 (A, the first of equals);
 *                 fuel 17 + 18 at $1.419 (total $49.67) = $24.12 / $25.55 (the
 *                 18-unit line; a largest-fraction rule would have given the
 *                 cent to the 17-unit line's .3 instead).
 *   Round         every line is rounded on its own and the total is whatever
 *                 that adds to: $3.33 x 3 = $9.99; $24.12 + $25.54 = $49.66.
 * `totalCents` may carry fractions of a cent (fuel: 4966.5): each line rounds
 * from its EXACT value (17 x 1.419 = 24.123 -> 24.12), and under Redistribute
 * the absorbing line squares up to the rounded total.
 * @returns whole cents per line, same order
 */
export const splitCents = (totalCents, weights, mode = 'Redistribute') => {
  const w = weights.map((x) => Math.max(0, Number(x) || 0));
  const sum = w.reduce((a, b) => a + b, 0);
  if (sum <= 0) return w.map(() => 0);
  const shares = w.map((x) => Math.round((totalCents * x) / sum));
  if (mode === 'Round') return shares;
  let big = 0;
  w.forEach((x, i) => { if (x > w[big]) big = i; });
  shares[big] = Math.round(totalCents) - shares.reduce((a, b, i) => (i === big ? a : a + b), 0);
  return shares;
};

const normalOfFirst = (byPrice, n) => {
  let left = n;
  let sum = 0;
  byPrice.forEach((l) => { const t = Math.min(l.q, left); sum += t * l.unit; left -= t; });
  return sum;
};

/**
 * @param {Array<{lines: Array<{index:any, q:number, unit:number}>, setQty:number, setPrice:number}>} groups
 *        one group per criterion: its eligible cart lines (integer units, normal
 *        price per unit), its purchase quantity and its promo total.
 * @param {{maxSets?: number, rounding?: 'Redistribute'|'Round'}} [options]
 *        Max Applications Per Sale; the company's Price Rounding Mode.
 * @returns {{sets:number, allCovered:boolean, prices: Map<any, number>}}
 */
export const allocateCriteriaSets = (groups, { maxSets, rounding = 'Redistribute' } = {}) => {
  const prices = new Map();
  // Buy X get Y: an Optional criterion whose products are not in the cart does
  // not block the sets (it simply pays nothing out); a "(quantity only)"
  // criterion (noChange) counts units but never changes their price.
  const prepared = groups
    .filter((g) => !(g.optional && g.lines.length === 0))
    .map((g) => ({
      ...g,
      totalUnits: g.lines.reduce((s, l) => s + l.q, 0),
      byPrice: [...g.lines].sort((a, b) => b.unit - a.unit),
    }));
  if (prepared.length === 0 || prepared.every((g) => g.optional)) return { sets: 0, allCovered: false, prices };

  let limit = prepared.length
    ? Math.min(...prepared.map((g) => (g.setQty > 0 ? Math.floor(g.totalUnits / g.setQty) : 0)))
    : 0;
  if (Number.isFinite(maxSets) && maxSets > 0) limit = Math.min(limit, maxSets);

  let sets = 0;
  let best = 0.005;
  for (let s = 1; s <= limit; s += 1) {
    const saving = prepared.reduce((sum, g) => g.noChange ? sum : sum + normalOfFirst(g.byPrice, s * g.setQty) - s * g.setPrice, 0);
    if (saving > best) { best = saving; sets = s; }
  }

  prepared.forEach((g) => {
    const promoUnits = new Map();
    let toCover = sets * g.setQty;
    g.byPrice.forEach((l) => {
      const t = Math.min(l.q, toCover);
      promoUnits.set(l.index, t);
      toCover -= t;
    });
    const covered = sets * g.setQty;
    const promoCents = cents(sets * g.setPrice);
    const withPromo = g.lines.filter((l) => (promoUnits.get(l.index) || 0) > 0);
    // The promo total over the covered units, per the Price Rounding Mode.
    const shares = splitCents(promoCents, withPromo.map((l) => promoUnits.get(l.index) || 0), rounding);
    g.lines.forEach((l) => {
      const pu = promoUnits.get(l.index) || 0;
      const own = cents(l.q * l.unit);
      let c;
      if (g.noChange) {
        c = own; // "(quantity only)": counted, never repriced
      } else if (sets > 0 && pu > 0) {
        const share = shares[withPromo.indexOf(l)];
        c = share + cents((l.q - pu) * l.unit);
        // Never dearer than on its own - whether partly covered (2 Prosecco + 1
        // Muscat) or fully covered by a criterion whose promo total is above its
        // own normal value while another criterion carries the saving.
        c = Math.min(c, own);
      } else {
        c = own;
      }
      prices.set(l.index, c / 100);
    });
    g.covered = covered;
  });

  const allCovered = sets > 0 && prepared.every((g) => g.covered === g.totalUnits);
  return { sets, allCovered, prices };
};

// ---------------------------------------------------------------------------
// SPEND & GET (reference help article "How to Create and Sell a Spend & Get
// Promotion": "a customer spends over a certain amount (e.g. $30) across either
// all products or certain products and then receives a discount on another
// product"; automatic activation "activate[s] the discount when the amount being
// spent is at least equal to the value specified").
// In the advanced editor that is a "spend $X" criterion (the products to spend
// on) plus, usually, a criterion for the product that gets the discount
// ("Optionally purchase 1 to receive ..."). Rules, as the editor's own simulator
// reads them:
//   * every Required criterion must be met (spend: normal value of its lines
//     >= $X; purchase: units >= N); an Optional criterion only when it is met;
//   * each met criterion then applies its "to receive" once - a purchase
//     criterion to N units (dearest first, the customer-favourable reading), a
//     spend criterion to its whole lines;
//   * nothing changes unless the customer actually saves.

export const RECEIVE_TYPES = ['total_price', 'each_item_for', 'discount_each_item', 'discount_total', 'discount', 'percentage_discount', 'quantity_only'];

// New price (in cents) for `units` units of each line (dearest first when a
// count is given), under one "to receive" rule applied `sets` times (a purchase
// criterion is one set of N units; `sets` sets cover sets x N units and the
// reward is counted per set). Returns Map(index -> cents).
//
// Measured on the live reference (ZZTEST Spend & Get, 01/10/2026): "a discount
// off the total worth $10" on a set of 2 took $5 off EACH unit ($60 -> $55,
// $50 -> $45), not $5.45 / $4.55 by value - so a money-off reward is split
// equally per unit. "a total price of" keeps the by-value split the Buy X for Y
// sets use (not measured in a spend promotion).
const receiveOn = (lines, units, receiveType, value, sets = 1, rounding = 'Redistribute') => {
  const out = new Map();
  const v = Number(value) || 0;
  const byPrice = [...lines].sort((a, b) => b.unit - a.unit);
  const cover = new Map();
  let left = units === Infinity ? Infinity : Math.max(0, units);
  byPrice.forEach((l) => { const t = Math.min(l.q, left); cover.set(l.index, t); left -= t; });
  const coveredLines = lines.filter((l) => (cover.get(l.index) || 0) > 0);
  const coveredNormalCents = coveredLines.reduce((s, l) => s + cents((cover.get(l.index) || 0) * l.unit), 0);
  const coveredUnits = coveredLines.reduce((s, l) => s + (cover.get(l.index) || 0), 0);
  const perSet = units === Infinity ? 1 : Math.max(1, sets);

  // Target price (cents) for ALL covered units together.
  let target = coveredNormalCents;
  let equalSplit = false;
  switch (receiveType) {
    case 'total_price': target = cents(v * perSet); break;
    case 'each_item_for': target = cents(v * coveredUnits); equalSplit = true; break;
    case 'discount_each_item': target = Math.max(0, coveredNormalCents - cents(v * coveredUnits)); equalSplit = true; break;
    case 'discount_total':
    case 'discount': target = Math.max(0, coveredNormalCents - cents(v * perSet)); equalSplit = true; break;
    case 'percentage_discount': target = Math.max(0, Math.round(coveredNormalCents * (1 - v / 100))); break;
    default: target = coveredNormalCents; // quantity_only
  }
  const offCents = coveredNormalCents - target; // what comes off, spread over the covered units
  // Equal split: the same money off every covered unit. A line too cheap to carry
  // its share is taken to $0 and the rest moves to the other lines, so the total
  // taken off is always exactly the reward (the last open line absorbs the cent).
  const equalOff = new Map();
  if (equalSplit) {
    const pool = coveredLines.map((l) => ({ l, cu: cover.get(l.index) || 0, own: cents((cover.get(l.index) || 0) * l.unit), off: 0 }));
    let remaining = offCents;
    for (let pass = 0; pass < 8 && remaining > 0; pass += 1) {
      const open = pool.filter((p) => p.off < p.own);
      if (!open.length) break;
      const units = open.reduce((s, p) => s + p.cu, 0);
      let given = 0;
      open.forEach((p, i) => {
        const want = i === open.length - 1 ? remaining - given : Math.round((remaining * p.cu) / units);
        const take = Math.max(0, Math.min(want, p.own - p.off));
        p.off += take;
        given += take;
      });
      remaining -= given;
      if (given === 0) break;
    }
    pool.forEach((p) => equalOff.set(p.l.index, p.off));
  }
  // By-value split of the target over the covered lines, per the Price Rounding Mode.
  const valueShares = splitCents(target, coveredLines.map((l) => cents((cover.get(l.index) || 0) * l.unit)), rounding);
  lines.forEach((l) => {
    const cu = cover.get(l.index) || 0;
    const rest = cents((l.q - cu) * l.unit);
    if (cu === 0 || coveredNormalCents === 0) { out.set(l.index, cents(l.q * l.unit)); return; }
    const own = cents(cu * l.unit);
    const share = equalSplit
      ? own - (equalOff.get(l.index) || 0)
      : valueShares[coveredLines.indexOf(l)];
    out.set(l.index, share + rest);
  });
  return out;
};

/**
 * @param {Array<{kind:'spend'|'purchase', threshold:number, optional?:boolean,
 *   receiveType:string, receiveValue:number,
 *   lines:Array<{index:any, q:number, unit:number}>}>} groups  one per criterion
 * @returns {{applied:boolean, prices: Map<any, number>}}  price for every line.
 */
// Measured on the live reference (ZZTEST Spend & Get, 01/10/2026; Spend $100 on
// A+B "(amount only)" + purchase criterion on A+B):
//   * a REQUIRED purchase criterion repeats per set: units / N sets, every set
//     rewarded (1 x A + 2 x B on "purchase 1 -> $10 off each" took $10 off all
//     three; 2 + 2 on "purchase 2 -> $10 off the total" saved $20); the spend
//     criterion does not use the units up, so the same lines serve both;
//   * an OPTIONAL purchase criterion whose lines are ALSO in a spend criterion
//     never pays out (the spend criterion takes those units first) - 1 + 1,
//     1 + 2 and 2 + 2 all rang up at full price. With its own products (the help
//     article's "spend $30 on beer, get the coke for $1") it pays once.
// `maxSets` = the editor's Max Applications Per Sale.
export const allocateSpendPromotion = (groups, { maxSets, rounding = 'Redistribute' } = {}) => {
  const prices = new Map();
  const normalCents = (l) => cents(l.q * l.unit);
  const spendIndexes = new Set(groups.filter((g) => g.kind === 'spend').flatMap((g) => g.lines.map((l) => l.index)));
  const met = groups.map((g) => {
    if (!(g.threshold > 0)) return false;
    // "spend" is measured on the NORMAL sell value (l.spendValue when the caller
    // prices the line on something cheaper, e.g. an Express promotion already on it).
    const measured = g.kind === 'spend'
      ? g.lines.reduce((s, l) => s + (l.spendValue != null ? l.spendValue : l.q * l.unit), 0)
      : g.lines.reduce((s, l) => s + l.q, 0);
    return measured + 1e-9 >= g.threshold;
  });
  const requiredMet = groups.every((g, i) => g.optional || met[i]);
  const anyMet = met.some(Boolean);

  const newCents = new Map();
  let saving = 0;
  if (requiredMet && anyMet) {
    groups.forEach((g, i) => {
      if (!met[i]) return;
      let units = Infinity;
      let sets = 1;
      if (g.kind !== 'spend') {
        const n = Math.max(1, Math.floor(g.threshold));
        if (g.optional) {
          // Shares its units with a spend criterion: nothing left to reward.
          if (g.lines.some((l) => spendIndexes.has(l.index))) return;
          sets = 1;
        } else {
          sets = Math.floor(g.lines.reduce((s, l) => s + l.q, 0) / n);
          if (Number.isFinite(maxSets) && maxSets > 0) sets = Math.min(sets, maxSets);
          if (sets < 1) return;
        }
        units = sets * n;
      }
      const r = receiveOn(g.lines, units, g.receiveType, g.receiveValue, sets, rounding);
      g.lines.forEach((l) => {
        const c = r.get(l.index);
        if (c == null) return;
        const before = newCents.has(l.index) ? newCents.get(l.index) : normalCents(l);
        // A line on two criteria keeps the cheaper outcome.
        const now = Math.min(before, c);
        saving += before - now;
        newCents.set(l.index, now);
      });
    });
  }
  const applied = saving > 0;
  groups.forEach((g) => g.lines.forEach((l) => {
    prices.set(l.index, (applied && newCents.has(l.index) ? newCents.get(l.index) : normalCents(l)) / 100);
  }));
  return { applied, prices };
};

// "Mix Criteria" ON (reference help article: "whether the criteria should mix
// together as if they were a single criteria"): every criterion's products
// count in one pool, one set = the purchase quantities added up, at the promo
// totals added up. Not verified on the live store (no Mix ON promotion there).
export const mergeCriteriaGroups = (groups) => {
  if (!groups.length) return [];
  const merged = { lines: [], setQty: 0, setPrice: 0 };
  groups.forEach((g) => {
    merged.lines.push(...g.lines);
    merged.setQty += g.setQty;
    merged.setPrice += g.setPrice;
  });
  merged.setPrice = Math.round(merged.setPrice * 100) / 100;
  return [merged];
};

/** Single-criterion convenience wrapper ("Purchase N -> a total price of $V"). */
export const allocateTotalPriceSets = (lines, { setQty, setPrice, maxSets, rounding }) => {
  const r = allocateCriteriaSets([{ lines, setQty, setPrice }], { maxSets, rounding });
  const totalUnits = lines.reduce((s, l) => s + l.q, 0);
  return { ...r, covered: r.sets * setQty, totalUnits };
};

export default allocateCriteriaSets;
