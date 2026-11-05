// Reference item-search dropdown grouping (categories first, products last).
export const GROUP_ORDER = ['CATEGORY', 'BRAND', 'FAMILY', 'TAG', 'PRODUCT'];
export const GROUP_LABEL = { CATEGORY: 'CATEGORIES', BRAND: 'BRANDS', FAMILY: 'FAMILIES', TAG: 'TAGS', PRODUCT: 'PRODUCTS' };
export const groupOf = (r) => (r.resultType === 'PRODUCT' ? 'PRODUCT' : String(r.type || 'CLASSIFICATION').toUpperCase());
export const sortByGroup = (results) => [...results].sort((a, b) => GROUP_ORDER.indexOf(groupOf(a)) - GROUP_ORDER.indexOf(groupOf(b)));
