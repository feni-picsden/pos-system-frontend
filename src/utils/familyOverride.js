// Family price override for the product editor.
//
// A Family is "products that are price-aligned and grouped together" — the family
// itself stores no prices (see Classification in schema.prisma: name, type, colour
// and nothing else). So "the family's prices" means the prices its existing member
// products already agree on, and moving a product into a family offers to bring it
// into line with them.
//
// Pure and dependency-free so the alignment rules can be tested without the editor.
//
// What an override replaces:
//   * the quantity/price tiers (the "price quantities")
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

/** Stable identity for a set of tiers, so "same prices" is a string comparison. */
function tiersSignature(tiers) {
  return tiers.map((t) => `${t.quantity}@${t.price}`).join('|');
}

/**
 * Pick the value shared by most members, breaking ties on the most recently
 * updated member — a deliberate recent edit is the better guess at the family's
 * current intent than whichever row happens to sort first.
 */
function modeBy(members, valueOf) {
  const buckets = new Map();
  for (const m of members) {
    const key = valueOf(m);
    if (key == null) continue;
    if (!buckets.has(key)) buckets.set(key, { key, count: 0, latest: 0, sample: m });
    const b = buckets.get(key);
    b.count += 1;
    const updated = Date.parse(m?.updatedAt || '') || 0;
    if (updated >= b.latest) {
      b.latest = updated;
      b.sample = m;
    }
  }
  if (buckets.size === 0) return null;
  return [...buckets.values()].sort(
    (a, b) => b.count - a.count || b.latest - a.latest
  )[0];
}

/**
 * The price template a family offers, derived from its current members.
 *
 * @param {Array} members  products already in the family (exclude the one being edited)
 * @returns {object|null}  null when the family has no member that carries a price.
 *   { prices, retailTaxRate, memberCount, agreeingCount, aligned, sourceProduct }
 *   `aligned` is false when members disagree — the caller should say so rather than
 *   quietly imposing a majority the user cannot see.
 */
export function deriveFamilyTemplate(members) {
  const usable = (Array.isArray(members) ? members : []).filter(
    (m) => m && defaultTiers(m).length > 0
  );
  if (usable.length === 0) return null;

  const priceMode = modeBy(usable, (m) => tiersSignature(defaultTiers(m)));
  if (!priceMode) return null;

  // Tax rate is voted on separately: a family can agree on price while one member
  // carries the wrong tax rate, and the majority is still the right answer for both.
  const taxMode = modeBy(usable, (m) => m.retailTaxRate || null);

  return {
    prices: defaultTiers(priceMode.sample),
    retailTaxRate: taxMode?.key ?? priceMode.sample.retailTaxRate ?? null,
    memberCount: usable.length,
    agreeingCount: priceMode.count,
    aligned: priceMode.count === usable.length,
    sourceProduct: priceMode.sample,
  };
}

/**
 * Apply a template to the editor's form data.
 *
 * Each tier keeps the cost the product already had at that quantity (matched by
 * quantity, else the qty-1 cost, else 0) so an override changes what the customer
 * pays without touching what the product cost us.
 */
export function applyFamilyTemplate(formData, template) {
  if (!formData || !template) return formData;

  const existing = Array.isArray(formData.prices) ? formData.prices : [];
  const costFor = (quantity) => {
    const exact = existing.find((r) => (num(r.quantity) ?? 1) === quantity);
    if (exact) return { cost: num(exact.cost) ?? 0, percentage: num(exact.percentage) ?? 0 };
    const base = existing.find((r) => (num(r.quantity) ?? 1) === 1) || existing[0];
    return { cost: num(base?.cost) ?? 0, percentage: num(base?.percentage) ?? 0 };
  };

  return {
    ...formData,
    prices: template.prices.map((t) => ({
      quantity: t.quantity,
      price: t.price,
      ...costFor(t.quantity),
    })),
    ...(template.retailTaxRate ? { retailTaxRate: template.retailTaxRate } : {}),
  };
}

/**
 * What an override would do, as a sentence a shop owner can act on.
 *
 * The alignment warning is a SEPARATE sentence on its own line: it is a different
 * kind of statement from the price (a caution, not a fact about the new price), and
 * run together on one wrapped line it reads as a footnote and gets skipped. Both the
 * banner and the save prompt render with `white-space: pre-line`, so the newline
 * survives in both.
 */
export function describeFamilyTemplate(template, familyName) {
  if (!template) return '';
  const price = describeFamilyPrice(template, familyName);
  const warning = describeFamilyAlignment(template, familyName);
  return warning ? `${price}\n${warning}` : price;
}

/** The price line on its own: "X" is priced at $3.00 each, 6 for $16.00 and GST. */
export function describeFamilyPrice(template, familyName) {
  if (!template) return '';
  const tiers = template.prices
    .map((t) => (t.quantity === 1 ? `$${t.price.toFixed(2)} each` : `${t.quantity} for $${t.price.toFixed(2)}`))
    .join(', ');
  const tax = template.retailTaxRate ? ` and ${template.retailTaxRate}` : '';
  const name = familyName ? `"${familyName}"` : 'this family';
  return `${name} is priced at ${tiers}${tax}.`;
}

/**
 * The "members disagree" warning, or '' when the family is aligned. Separate so a
 * caller can style it differently from the price it qualifies.
 */
export function describeFamilyAlignment(template, familyName) {
  if (!template || template.aligned) return '';
  const name = familyName ? `"${familyName}"` : 'this family';
  return `Note: only ${template.agreeingCount} of ${template.memberCount} products in ${name} use this price.`;
}
