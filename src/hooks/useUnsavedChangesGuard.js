import { useEffect, useRef } from 'react';
import { setLeaveGuard, clearLeaveGuard } from '../utils/leaveGuard';

/**
 * One gate for every way of leaving a page that has unsaved edits.
 *
 * Pages used to wire only two of the three routes out, so the browser's own
 * "Leave site? Changes you made may not be saved" dialog answered for the
 * third. That dialog carries browser chrome rather than ours, cannot be styled
 * or worded, and freezes the tab - to a cashier it reads as a fault in the
 * browser rather than a question from this app. The three routes are:
 *
 *   1. Sidebar / in-app navigation - already routed through leaveGuard.
 *   2. Browser Back / Forward      - handled here; used to fall to the browser.
 *   3. Tab close / reload          - `beforeunload`. Browsers hardcode this
 *      dialog and forbid replacing it, so it is the one case where the native
 *      prompt is the only option available to any website.
 *
 * @param {boolean}  isDirty      Whether the page currently holds unsaved edits.
 * @param {function} requestLeave Called with a `proceed` callback; show the
 *                                page's own Confirm Leaving dialog and call
 *                                `proceed()` if the user confirms.
 */

// Marks the throwaway history entry described in step 3 below.
const SENTINEL = '__leaveGuardSentinel';

// Same url, so popping it never changes the route - but it does fire popstate.
// The existing state is carried over because react-router keeps its own `idx`
// and `key` in there and reads them back on popstate.
const pushSentinel = () => {
  window.history.pushState({ ...window.history.state, [SENTINEL]: true }, '');
};

const onSentinel = () => Boolean(window.history.state?.[SENTINEL]);

export default function useUnsavedChangesGuard(isDirty, requestLeave) {
  // Held in a ref so a re-rendered callback never re-installs the history trap:
  // re-pushing the sentinel on every render would bury the entry Back aims at.
  const request = useRef(requestLeave);
  request.current = requestLeave;

  useEffect(() => {
    if (!isDirty) return undefined;

    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);

    const guard = (proceed) => request.current(proceed);
    setLeaveGuard(guard);

    // The app runs on <BrowserRouter>, which gives no useBlocker, so the Back
    // gesture is trapped with a spare history entry instead: pressing Back pops
    // the sentinel, and because it shares this page's url the route does not
    // change - leaving us free to ask the question in our own dialog.
    pushSentinel();
    let leaving = false;

    const onPop = () => {
      if (leaving) return; // our own history.go(-2) below - let it through
      // Back has just consumed the sentinel. Re-arm it first so that cancelling
      // still leaves the page trapped for the next Back press.
      pushSentinel();
      request.current(() => {
        leaving = true;
        // Back past the freshly re-armed sentinel AND past this page, landing
        // where the first Back press was headed.
        window.history.go(-2);
      });
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('popstate', onPop);
      clearLeaveGuard(guard);
      // Drop the sentinel when the page is saved or unmounted, so Back does not
      // need two presses afterwards. Only when it is still the current entry:
      // after a confirmed Leave or a sidebar navigate the stack has already
      // moved past it, and stepping back there would undo that navigation.
      if (!leaving && onSentinel()) window.history.back();
    };
  }, [isDirty]);
}
