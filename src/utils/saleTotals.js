// Sale.basePrice is the COST of goods (registerClosures.js consumes it as `cogs`),
// so it must never be rendered as the sell-side "Base Price" line. The sell-side
// base price is the pre-discount line total, derived from the items.
// ponytail: derived client-side — SaleItem has no cost field, so basePrice must
// stay cost-of-goods for profit reporting; add a stored sell subtotal only if a
// sale ever needs a base price its items cannot reproduce.

// Net of discounts: what the lines actually charged (SaleItem.totalPrice is
// persisted POST-discount). This is the sale TOTAL, not the base price.
export const saleLineTotal = (sale) =>
  (sale?.items || []).reduce((sum, item) => {
    const line =
      item?.totalPrice != null
        ? Number(item.totalPrice)
        : (Number(item?.unitPrice) || 0) * (Number(item?.quantity) || 0);
    return sum + (Number.isFinite(line) ? line : 0);
  }, 0);

// Pre-discount: the net lines with each line's own discount added back, so
// "Base Price" - "Discount" reconciles to the line total shown next to it.
export const saleBasePrice = (sale) =>
  (sale?.items || []).reduce((sum, item) => {
    const discount = Number(item?.discount);
    return sum + (Number.isFinite(discount) && discount > 0 ? discount : 0);
  }, saleLineTotal(sale));

// Sell-screen savings on ONE cart line: PROMOTIONS ONLY (promotion price,
// combo/package deal). A manual price change is a DISCOUNT, not a saving, and
// must never appear in both counters — so the comparison is against the price
// BEFORE the manual change (`price + discount`), not the charged price.
// Cart lines carry the normal total as `normalPrice`; `comboDeal.basePrice` is
// the pre-combo marker the combo engine sets. The readings OVERLAP —
// normalPrice - price already contains the combo reduction — so take the
// largest, never the sum.
export const lineSavings = (item, discount = 0) => {
  const rawPrice = Number(item?.price) || 0;
  // What the line cost before the operator changed the price by hand.
  const price = rawPrice + Math.max(0, Number(discount) || 0);
  // A product-combo cart line carries no `normalPrice`: its pre-combo total is
  // `comboNormalTotal`, banked PER SET while `price` is already scaled by the set
  // count. Without this the live receipt printed $0.00 savings on a combo line that
  // the reprint (which sums the members' allocated savings) printed in full.
  const comboNormal = (Number(item?.comboNormalTotal) || 0) * (Number(item?.quantity) || 1);
  const normal = Number(item?.normalPrice) || comboNormal || price;
  const comboBase = Number(item?.comboDeal?.basePrice) || price;
  return Math.max(0, normal - price, comboBase - price);
};

// Units per case. The schema field is `caseQuantity` (`itemsPerCase` is the legacy
// alias on older cached rows). A product with no case size still sells one per case,
// so the receipt's Case Qty column prints 1 — the sell screen has always defaulted to
// 1 and a reprint that defaulted to 0 printed a different receipt for the same sale.
export const itemsPerCase = (product) =>
  Number(product?.itemsPerCase || product?.caseQuantity) || 1;

const num = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// A combo is ONE line on the receipt but reaches the DB as its member products
// (stock, loyalty and reports all key off productId). Regroup the members back into
// the single line for display; members carry `comboName` + `comboSets` from sale time.
// Non-combo lines pass through untouched, in order.
export const groupSaleItemsForReceipt = (items = []) => {
  const merged = new Map();
  const out = [];
  (items || []).forEach((item) => {
    const name = item?.comboName;
    if (!name) {
      out.push(item);
      return;
    }
    const existing = merged.get(name);
    if (!existing) {
      const line = {
        ...item,
        productName: name,
        name,
        description: null,
        productId: null,
        quantity: Number(item.comboSets) || 1,
      };
      merged.set(name, line);
      out.push(line);
      return;
    }
    // The member shares sum back to the combo line total the live receipt printed.
    existing.totalPrice = num(existing.totalPrice) + num(item.totalPrice);
    existing.tax = num(existing.tax) + num(item.tax);
    existing.discount = num(existing.discount) + num(item.discount);
    existing.savings = num(existing.savings) + num(item.savings);
    existing.normalPrice = num(existing.normalPrice) + num(item.normalPrice);
    // Members on different rates blend into one unnamed line, exactly as the live
    // combo line did — keeping member 1's name would relabel the tax summary row
    // ("GST" on a reprint, "Tax" live) for the same sale.
    if (existing.taxName !== item.taxName) existing.taxName = null;
  });
  merged.forEach((line) => {
    line.unitPrice = line.quantity ? num(line.totalPrice) / line.quantity : num(line.totalPrice);
  });
  return out;
};

export default saleBasePrice;
