// Promotion criteria helpers shared by the promotion EDITOR and the promotion VIEW,
// so one promotion always shows one set of criteria and one profit figure.
//
// Two things used to go wrong for promotions stored as PromotionItem rows only (the
// create wizard, the express editor and seeded data all leave `conditions.criteria`
// empty):
//   * the editor rebuilt the criteria from the rows but read the cost from
//     `product.cost` — a column that does not exist (the product carries `itemCost`
//     / `averageItemCost`, its price rows carry `cost`) — so PROFIT read "N/A" on a
//     complete criteria set (go-live audit: "Summer Beer Special", buy 1 for $3.50,
//     cost $2.00 -> should read 42.86%);
//   * the view did not rebuild them at all and showed an empty page.
//
// Pure: no React, no services.
import { getBaseTier } from './baseTier.js';
import { effectiveUnitCost } from './productCost.js';

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * What ONE unit of the product costs, for margin maths. The quantity-1 price row's
 * own cost when it has one (it is what Sell & Cost shows against that price), else
 * the product's unit cost under the company's Cost Calculation Method. 0 = unknown —
 * callers show "N/A" rather than invent a margin.
 */
export const unitCostOf = (product, costMethod = 'Last Cost') => {
  if (!product) return 0;
  const base = getBaseTier(product.prices);
  const baseQty = num(base?.quantity) || 1;
  const tierUnitCost = base ? num(base.cost) / baseQty : 0;
  if (tierUnitCost > 0) return tierUnitCost;
  return num(effectiveUnitCost(product, costMethod)) || num(product.cost);
};

/** How a stored PromotionItem row reads as a criterion's "to receive" part. */
export const receiveFromItem = (item) => {
  const promoPrice = num(item?.promoPrice);
  const percentage = num(item?.discountPercentage);
  const amount = num(item?.discountAmount);
  if (promoPrice > 0) return { receiveType: 'total_price', receiveValue: promoPrice };
  if (percentage > 0) return { receiveType: 'percentage_discount', receiveValue: percentage };
  if (amount > 0) return { receiveType: 'discount_each_item', receiveValue: amount };
  return { receiveType: 'quantity_only', receiveValue: 0 };
};

/** A criterion item snapshotted from a product (per-unit price and cost). */
export const criterionItemFromProduct = (product, { id, sourceLabel = null, name, price, rebate = 0 } = {}, costMethod) => {
  const base = getBaseTier(product?.prices);
  const originalPrice = num(price) || num(base?.price);
  return {
    id,
    productId: product?.id ?? null,
    name: name || product?.name || 'Unknown Product',
    type: 'PRODUCT',
    sourceLabel,
    originalPrice,
    pricingTiers: Array.isArray(product?.prices) ? product.prices : [],
    cost: unitCostOf(product, costMethod),
    rebateAmount: num(rebate),
    rebatePercentage: originalPrice > 0 ? (num(rebate) / originalPrice) * 100 : 0,
    excluded: false,
  };
};

/**
 * Fold PromotionItem rows into the criteria the editor / view work with. Rows that
 * share quantity, reward and optional-flag become one criterion.
 */
export const criteriaFromItems = (items, costMethod = 'Last Cost') => {
  const groups = new Map();
  (Array.isArray(items) ? items : []).forEach((item, index) => {
    const { receiveType, receiveValue } = receiveFromItem(item);
    const quantity = parseInt(item.quantity, 10) || 1;
    // Wizard "get" rows are isRequired:false — that is the Optional criteria flag.
    const isOptional = item.isRequired === false;
    const key = `${quantity}|${receiveType}|${receiveValue}|${isOptional}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: `items-${groups.size + 1}`,
        isOptional,
        purchaseType: 'purchase',
        purchaseValue: quantity,
        receiveType,
        receiveValue,
        items: [],
        profit: 0,
      });
    }
    groups.get(key).items.push(criterionItemFromProduct(
      item.product || null,
      {
        id: item.id ?? `item-${index + 1}`,
        name: item.productName || item.product?.name,
        // The row's own normal price wins: it is what the promotion was built against.
        price: num(item.normalPrice) || undefined,
        rebate: item.rebate,
      },
      costMethod,
    ));
    // criterionItemFromProduct has no product id when the product was deleted.
    const pushed = groups.get(key).items[groups.get(key).items.length - 1];
    if (pushed.productId == null) pushed.productId = item.productId ?? null;
  });
  return Array.from(groups.values());
};

/**
 * Stored criteria carry a SNAPSHOT of each product (price rows + cost) taken when the
 * promotion was saved. Promotions saved before the cost lookup was fixed snapshotted
 * `cost: 0` and no price rows, so they kept reading "N/A" for products that do have a
 * cost — and any snapshot goes stale when the product's cost changes. The promotion's
 * item rows arrive with the CURRENT product, so the snapshot's cost and price rows are
 * refreshed from it. Nothing else on the item is touched (name, rebate, excluded…),
 * and an item whose product is not on the promotion's rows is left exactly as saved.
 */
export const hydrateCriteria = (criteria, promotionItems, costMethod = 'Last Cost') => {
  const products = new Map();
  (Array.isArray(promotionItems) ? promotionItems : []).forEach((row) => {
    if (row?.product?.id != null) products.set(String(row.product.id), row.product);
  });
  if (products.size === 0) return Array.isArray(criteria) ? criteria : [];
  return (Array.isArray(criteria) ? criteria : []).map((criterion) => ({
    ...criterion,
    items: (criterion.items || []).map((item) => {
      const product = item?.productId != null ? products.get(String(item.productId)) : null;
      if (!product) return item;
      const freshCost = unitCostOf(product, costMethod);
      const rows = Array.isArray(product.prices) ? product.prices : [];
      return {
        ...item,
        pricingTiers: rows.length > 0 ? rows : item.pricingTiers || [],
        cost: freshCost > 0 ? freshCost : num(item.cost),
        originalPrice: num(item.originalPrice) || num(getBaseTier(rows)?.price),
      };
    }),
  }));
};

/**
 * Criteria to show for a promotion: the stored ones (refreshed from the current
 * products), else rebuilt from its item rows.
 */
export const criteriaOfPromotion = (promotion, costMethod = 'Last Cost') => {
  const saved = promotion?.conditions?.criteria;
  if (Array.isArray(saved) && saved.length > 0) return hydrateCriteria(saved, promotion?.items, costMethod);
  return criteriaFromItems(promotion?.items, costMethod);
};
