// What the "Source" column of a product's price table says for one price row.
//
// A row with priceSetId null is the product's BASE price — the one used when no
// price set applies. That is not the same thing as the register's Default Price
// Set (General Settings > Register), which merely picks which set the till reads:
// naming the base row after that set puts the same name on two different options
// in one dropdown. So the base row keeps its own generic name, and the named sets
// are exactly the ones Setup defines.
//
// Shared by the editor and the view page so the two can't drift into calling the
// same row "Product" on one screen and "Default Price" on the other.

/** The row that belongs to no price set. */
export const DEFAULT_PRICE_SOURCE = 'Default Price';

/** Used for a row scoped to an outlet rather than to a price set. */
export const OUTLET_PRICE_SOURCE = 'Outlet Price';

const nameOf = (priceSets, id) => {
  if (id == null || id === '') return null;
  const hit = (Array.isArray(priceSets) ? priceSets : []).find(
    (ps) => ps && String(ps.id) === String(id)
  );
  return hit?.name || null;
};

/** True when the row belongs to the default set (i.e. carries no price set). */
export const isDefaultPriceRow = (row) => (row?.priceSetId ?? null) == null;

/**
 * @param {object} row        a price row (priceSetId, and optionally the
 *                            backend's embedded priceSet/priceSetName/outletId)
 * @param {Array}  priceSets  Settings > Price Sets
 * @returns {string} label for the Source cell — never blank
 */
export function priceSourceLabel(row, priceSets = []) {
  if (!isDefaultPriceRow(row)) {
    return (
      nameOf(priceSets, row.priceSetId) ||
      // The view page gets the name embedded by the API and has no set list.
      row.priceSet?.name ||
      row.priceSetName ||
      `Price Set #${row.priceSetId}`
    );
  }
  return row?.outletId ? OUTLET_PRICE_SOURCE : DEFAULT_PRICE_SOURCE;
}

export default priceSourceLabel;
