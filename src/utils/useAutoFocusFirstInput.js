import { useEffect } from 'react';

// Every page opens with its first text box focused, so the user can type
// straight away instead of clicking into it first. Mounted once in the layout
// (DashboardLayout) for all pages; a page that sets its own autoFocus, an open
// dialog, or the user already clicking / typing always wins.

const SKIP_TYPES = new Set(['hidden', 'checkbox', 'radio', 'file', 'button', 'submit', 'reset', 'range', 'color', 'image']);
// Pages render their form after a data load (6s+ against the remote DB);
// a click or key press by the user ends the wait at once.
const WAIT_MS = 30000;

// A modal that is actually OPEN. The layout keeps the mobile nav drawer mounted
// but hidden (.MuiModal-hidden) - counting it blocked the focus on every page.
const openModal = () => [...document.querySelectorAll('[role="dialog"], .MuiModal-root:not(.MuiPopover-root)')]
  .some((el) => !el.classList.contains('MuiModal-hidden')
    && !el.closest('.MuiModal-hidden')
    && el.getAttribute('aria-hidden') !== 'true'
    && el.getClientRects().length > 0);

const isTyping = (el) => !!el && el !== document.body
  && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);

const isVisible = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

const firstTypeable = (root) => {
  const candidates = root.querySelectorAll('input, textarea');
  for (const el of candidates) {
    if (el.tagName === 'INPUT' && SKIP_TYPES.has((el.type || 'text').toLowerCase())) continue;
    if (el.disabled || el.readOnly) continue;
    if (el.closest('[aria-hidden="true"], [data-no-autofocus]')) continue;
    if (!isVisible(el)) continue;
    return el;
  }
  return null;
};

export default function useAutoFocusFirstInput(containerRef, routeKey, { disabled = false } = {}) {
  useEffect(() => {
    if (disabled) return undefined;
    let finished = false;
    let observer = null;
    let timer = null;

    const stop = () => {
      finished = true;
      if (observer) observer.disconnect();
      clearTimeout(timer);
      document.removeEventListener('pointerdown', stop, true);
      document.removeEventListener('keydown', stop, true);
    };

    const attempt = () => {
      if (finished) return;
      // The page (autoFocus), a dialog or the user already has a field.
      if (isTyping(document.activeElement)) { stop(); return; }
      if (openModal()) return;
      const root = containerRef.current;
      if (!root) return;
      const el = firstTypeable(root);
      if (el) {
        el.focus({ preventScroll: true });
        if (document.activeElement === el) stop();
      }
    };

    // The user acting first cancels the auto-focus (never steal their click).
    document.addEventListener('pointerdown', stop, true);
    document.addEventListener('keydown', stop, true);

    // After the page's own effects/autoFocus had their turn.
    const first = setTimeout(attempt, 50);
    if (containerRef.current && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(attempt);
      observer.observe(containerRef.current, {
        childList: true, subtree: true, attributes: true,
        attributeFilter: ['disabled', 'readonly', 'hidden', 'aria-hidden', 'class', 'style', 'type', 'data-no-autofocus'],
      });
    }
    timer = setTimeout(stop, WAIT_MS);

    return () => { clearTimeout(first); stop(); };
  }, [containerRef, routeKey, disabled]);
}
