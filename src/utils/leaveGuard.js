// Cross-component "unsaved changes" gate. The app runs on <BrowserRouter>, so
// react-router's useBlocker (data-router only) is unavailable - instead a page
// with unsaved edits registers a guard, and navigation entry points route their
// navigate() calls through confirmLeave().
// ponytail: only guarded call sites (Sidebar) prompt; browser back/forward is
// covered by beforeunload alone. Upgrade path: migrate to createBrowserRouter.
let guard = null;

export const setLeaveGuard = (fn) => { guard = fn; };

export const clearLeaveGuard = (fn) => { if (guard === fn) guard = null; };

// Runs `next` immediately when nothing is dirty, otherwise hands it to the
// registered guard which shows its Confirm Leaving dialog and calls it on Leave.
export const confirmLeave = (next) => { if (guard) guard(next); else next(); };

// Nav items render as real <a href> links so they can be opened in a new tab.
// They only need to cancel the anchor and route through the dialog when a guard
// is actually registered; otherwise the link's own navigation is enough.
export const hasLeaveGuard = () => guard !== null;
