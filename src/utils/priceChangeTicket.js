// Reference (help centre, Stock List / Capped Pricing / Future Prices articles):
// saving a changed sell price adds the product to the Everyday Shelf Tickets list
// so a new ticket gets printed. Live store check (30/09/2026): Anu changed Alkoomi
// Riesling's 12-pack price at 11:45:59 and the Everyday ticket carries that exact
// second - ANY tier counts, not only the quantity-1 price.
// Stock List and Capped Pricing already queue the ticket; this helper is the same
// rule for the Sell & Cost editor and Bulk Price Edit. Pure comparison + one caller.

/** quantity -> price (cents) for every row that is a real price point. */
const tierMap = (rows) => {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const qty = parseInt(r?.quantity, 10);
    const price = parseFloat(r?.price);
    if (!(qty > 0) || !Number.isFinite(price)) return;
    map.set(qty, Math.round(price * 100));
  });
  return map;
};

/**
 * True when the saved price rows differ from the loaded ones on any tier's sell
 * price (a tier added, removed or repriced). Cost / percentage changes alone do
 * not print a new ticket - the ticket shows the sell price.
 */
export const sellPricesChanged = (before, after) => {
  const a = tierMap(before);
  const b = tierMap(after);
  if (a.size !== b.size) return true;
  for (const [qty, cents] of a) {
    if (!b.has(qty) || b.get(qty) !== cents) return true;
  }
  return false;
};

/**
 * Queue the product for an Everyday shelf ticket. Never throws: a ticket that
 * already exists (400 from the API) or a network error must not fail the save
 * that just succeeded.
 */
export const queueEverydayTicket = async (shelfTicketService, productId) => {
  const id = parseInt(productId, 10);
  if (!(id > 0) || !shelfTicketService?.addShelfTicket) return false;
  try {
    await shelfTicketService.addShelfTicket({ productId: id, ticketType: 'Everyday', productGrouping: null });
    return true;
  } catch (error) {
    if (error?.response?.status !== 400) console.error('Error adding shelf ticket:', error);
    return false;
  }
};
