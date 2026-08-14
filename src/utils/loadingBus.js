/** Tracks in-flight HTTP requests for UI feedback (top bar or blocking overlay). */

let barCount = 0;
let overlayCount = 0;
/** Keeps bar visible briefly so fast requests are still noticeable. */
let barHoldActive = false;
let barHideTimer = null;

const BAR_MIN_VISIBLE_MS = 350;

function emit() {
  window.dispatchEvent(
    new CustomEvent('global-loading', {
      detail: {
        barActive: barCount > 0 || barHoldActive,
        overlayActive: overlayCount > 0,
        barCount,
        overlayCount,
      },
    })
  );
}

function scheduleBarHide() {
  if (barHideTimer) clearTimeout(barHideTimer);
  barHideTimer = setTimeout(() => {
    barHideTimer = null;
    barHoldActive = false;
    emit();
  }, BAR_MIN_VISIBLE_MS);
}

/** @param {'bar'|'overlay'} mode */
export function startLoading(mode = 'bar') {
  if (mode === 'overlay') {
    overlayCount += 1;
  } else {
    if (barHideTimer) {
      clearTimeout(barHideTimer);
      barHideTimer = null;
    }
    barHoldActive = true;
    barCount += 1;
  }
  emit();
}

/** @param {'bar'|'overlay'} mode */
export function stopLoading(mode = 'bar') {
  if (mode === 'overlay') {
    if (overlayCount > 0) overlayCount -= 1;
    emit();
    return;
  }

  if (barCount > 0) barCount -= 1;
  if (barCount === 0) {
    if (barHoldActive) scheduleBarHide();
    else emit();
  } else {
    emit();
  }
}

export function resetLoading() {
  barCount = 0;
  overlayCount = 0;
  barHoldActive = false;
  if (barHideTimer) {
    clearTimeout(barHideTimer);
    barHideTimer = null;
  }
  emit();
}
