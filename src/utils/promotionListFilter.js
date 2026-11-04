// Promotions list filtering (Marketing > Promotions). Pure so it is unit-tested;
// the page only supplies state. Rules (reference, live 30/09 + 04/11/2026):
//   * Show Inactive off  -> promotions with isActive === false are hidden;
//   * Search              -> case-insensitive "contains" on the name;
//   * Promotion Categories-> promotion.categoryId in the picked ids;
//   * Products            -> any item's productId in the picked ids;
//   * Brands / Categories / Families / Tags -> any item's product carries the
//     classification, OR (Express) the promotion has a classification row of that
//     type in conditions.classificationItems (a category-wide express promotion
//     has no product items at all);
//   * Customer Groups     -> promotion's groups (join rows or ids) intersect;
//   * Outlets             -> promotion.outletId in the picked ids; global (null) always kept;
//   * Promotion Range     -> start OR end date falls inside the picked range.
const active = (arr) => Array.isArray(arr) && arr.length > 0;

const parseYmd = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

const classificationRows = (p) => (Array.isArray(p?.conditions?.classificationItems) ? p.conditions.classificationItems : []);
const hasClassification = (p, type, ids) =>
  classificationRows(p).some((c) => String(c.classificationType || '').toUpperCase() === type && ids.includes(c.classificationId));

/**
 * @param promotions  rows from GET /promotions (items[].product carries brandId / categoryId / familyId)
 * @param f           { searchTerm, showInactive, categoryFilter, productFilter, brandFilter,
 *                      categoryStockFilter, familyFilter, tagFilter, customerGroupFilter,
 *                      outletFilter, dateRangeStart, dateRangeEnd }  (filters are id arrays)
 * @param productTags Map(productId -> [tagId])   (tags are not embedded in the promotion payload)
 */
export function filterPromotions(promotions, f = {}, productTags = new Map()) {
  const from = parseYmd(f.dateRangeStart);
  const to = parseYmd(f.dateRangeEnd);
  const fromMs = from ? from.setHours(0, 0, 0, 0) : null;
  const toMs = to ? to.setHours(23, 59, 59, 999) : null;
  const q = String(f.searchTerm || '').trim().toLowerCase();

  return (Array.isArray(promotions) ? promotions : []).filter((p) => {
    if (!f.showInactive && p.isActive === false) return false;
    if (q && !(p.name || '').toLowerCase().includes(q)) return false;
    if (active(f.categoryFilter) && !f.categoryFilter.includes(p.categoryId)) return false;

    const items = Array.isArray(p.items) ? p.items : [];
    if (active(f.productFilter)) {
      const wanted = new Set(f.productFilter);
      if (!items.some((i) => wanted.has(i.productId))) return false;
    }
    if (active(f.brandFilter) && !items.some((i) => f.brandFilter.includes(i.product?.brandId)) && !hasClassification(p, 'BRAND', f.brandFilter)) return false;
    if (active(f.categoryStockFilter) && !items.some((i) => f.categoryStockFilter.includes(i.product?.categoryId)) && !hasClassification(p, 'CATEGORY', f.categoryStockFilter)) return false;
    if (active(f.familyFilter) && !items.some((i) => f.familyFilter.includes(i.product?.familyId)) && !hasClassification(p, 'FAMILY', f.familyFilter)) return false;
    if (
      active(f.tagFilter) &&
      !items.some((i) => (productTags.get(i.productId) || []).some((t) => f.tagFilter.includes(t))) &&
      !hasClassification(p, 'TAG', f.tagFilter)
    ) {
      return false;
    }

    if (active(f.customerGroupFilter)) {
      const groupIds = [
        ...(Array.isArray(p.customerGroups) ? p.customerGroups.map((g) => g.customerGroupId) : []),
        ...(Array.isArray(p.customerGroupIds) ? p.customerGroupIds : [])
      ];
      if (!groupIds.some((g) => f.customerGroupFilter.includes(g))) return false;
    }

    if (active(f.outletFilter) && p.outletId != null && !f.outletFilter.includes(p.outletId)) return false;

    if (fromMs || toMs) {
      const inRange = (ms) => ms != null && (fromMs == null || ms >= fromMs) && (toMs == null || ms <= toMs);
      const ps = p.startDate ? new Date(p.startDate).getTime() : null;
      const pe = p.endDate ? new Date(p.endDate).getTime() : null;
      if (!inRange(ps) && !inRange(pe)) return false;
    }
    return true;
  });
}

export default filterPromotions;
