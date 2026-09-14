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
