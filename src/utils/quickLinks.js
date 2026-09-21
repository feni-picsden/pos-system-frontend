// Quick Menu (cloud-logo dropdown) helpers. The list lives on the USER's record in
// the database (user_quick_menu_items), like the reference's `quick_menu`, so it
// follows the person to every computer — not the browser they happened to use.

// A web address (opens in a new tab) rather than a page of this system. Derived
// from the url itself, so no extra column is stored.
export const isExternalUrl = (url) => /^https?:\/\//i.test(String(url || '').trim());

// The cloud icon no longer links to the sell screen, so the menu always keeps a
// Sell Screen row: renameable, but its target and delete are locked.
export const SELL_SCREEN_ITEM = { name: 'Sell Screen', url: '/' };
export const isSellScreenItem = (item) => item?.url === '/';
export const withSellScreen = (items = []) =>
  (items.some(isSellScreenItem) ? items : [SELL_SCREEN_ITEM, ...items]);

// Server rows / older browser rows -> the shape the menu renders.
export const toQuickItems = (rows = []) =>
  withSellScreen(
    (Array.isArray(rows) ? rows : [])
      .filter((r) => r && String(r.url || '').trim())
      .map((r) => ({ name: String(r.name || '').trim(), url: String(r.url).trim() })),
  );

// What is sent to the server: complete rows only, in menu order.
export const toServerItems = (items = []) =>
  items
    .filter((i) => i && String(i.name || '').trim() && String(i.url || '').trim())
    .map((i, idx) => ({ name: String(i.name).trim(), url: String(i.url).trim(), sortOrder: idx }));

// Fired after the signed-in user's list is saved anywhere (cloud menu, profile
// dialog, Setup > Users) so the cloud menu redraws without a reload.
export const QUICK_MENU_EVENT = 'quickmenu:updated';
export const announceQuickMenu = (items) => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(QUICK_MENU_EVENT, { detail: { items: items || [] } }));
  }
};
