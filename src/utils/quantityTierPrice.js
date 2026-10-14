// Quantity-tier pricing, as the reference prices a product inside a Basket
// (Combo) Product: take the highest price tier whose quantity does not exceed
// the quantity asked for, and charge that tier's per-unit rate for every unit.
// Measured 14/10/2026 with tiers 1→$5, 6→$27, 20→$80: qty 6 = $27, 8 = $36
// (8 × 4.50), 12 = $54, 20 = $80. Below the lowest tier the lowest tier's rate
// applies; a product with no prices is $0.

// Only the product's own (default price set) rows take part.
const defaultTiers = (prices) =>
  (prices || [])
    .filter((p) => p && p.priceSetId == null && Number(p.quantity) > 0)
    .map((p) => ({ quantity: Number(p.quantity), price: Number(p.price) || 0 }))
    .sort((a, b) => a.quantity - b.quantity);

export const tierUnitRate = (prices, quantity) => {
  const tiers = defaultTiers(prices);
  if (!tiers.length) return 0;
  const qty = Number(quantity) || 0;
  let pick = tiers[0];
  for (const t of tiers) if (t.quantity <= qty) pick = t;
  return pick.price / pick.quantity;
};

export const tierLinePrice = (prices, quantity) =>
  Math.round(tierUnitRate(prices, quantity) * (Number(quantity) || 0) * 100) / 100;
