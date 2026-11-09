(() => {
  'use strict';
  const installed = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (!installed || !('ontouchstart' in window)) return;

  const releaseDistance = 74;
  const directionSlop = 6;
  const blockedTarget = 'input, textarea, select, [contenteditable], [role="dialog"], dialog';
  const atTop = () => (document.scrollingElement?.scrollTop ?? window.scrollY) <= 1;
  const overlayOpen = () => document.body.matches('.modal-open, .club-app-sheet-open');

  document.documentElement.classList.add('montanino-pull-ready');
  const indicator = document.createElement('div');
  indicator.className = 'montanino-pull-indicator';
  indicator.setAttribute('role', 'status');
  indicator.hidden = true;
  document.body.append(indicator);

  let gesture;
  let refreshing = false;

  function reset() {
    gesture = undefined;
    indicator.hidden = true;
  }

  document.addEventListener('touchstart', event => {
    reset();
    if (refreshing || event.touches.length !== 1 || !atTop() || overlayOpen() ||
        event.target.closest?.(blockedTarget)) return;
    const { clientX, clientY } = event.touches[0];
    gesture = { x: clientX, y: clientY, pulling: false, ready: false };
  }, { passive: true });

  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1 || !atTop() || overlayOpen() || !event.cancelable) {
      reset();
      return;
    }
    const { clientX, clientY } = event.touches[0];
    const down = clientY - gesture.y;
    const sideways = Math.abs(clientX - gesture.x);
    if (!gesture.pulling) {
      if (down < -directionSlop || (sideways > directionSlop && sideways >= down)) {
        reset();
        return;
      }
      if (down <= directionSlop) return;
      gesture.pulling = true;
    }

    event.preventDefault();
    gesture.ready = down >= releaseDistance;
    const label = gesture.ready ? 'Rilascia per aggiornare' : 'Trascina per aggiornare';
    if (indicator.textContent !== label) indicator.textContent = label;
    indicator.hidden = down <= directionSlop;
  }, { passive: false });

  document.addEventListener('touchend', event => {
    if (!event.touches.length && gesture?.ready && atTop() && !overlayOpen()) {
      refreshing = true;
      gesture = undefined;
      indicator.textContent = 'Aggiornamento…';
      location.reload();
      return;
    }
    reset();
  }, { passive: true });

  document.addEventListener('touchcancel', reset, { passive: true });
})();
