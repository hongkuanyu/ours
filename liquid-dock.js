(() => {
  'use strict';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileViewport = window.matchMedia('(max-width: 899px)');
  let dock = null;
  let indicator = null;
  let currentRoute = '';
  let resizeObserver = null;
  let shiftTimer = 0;
  let keyboardTimer = 0;

  function isEditable(element) {
    return Boolean(element?.matches?.('input, textarea, select, [contenteditable="true"]'));
  }

  function isKeyboardOpen() {
    if (!mobileViewport.matches) return false;
    if (isEditable(document.activeElement)) return true;
    const viewport = window.visualViewport;
    if (!viewport) return false;
    const layoutHeight = Math.max(window.innerHeight, document.documentElement.clientHeight || 0);
    return layoutHeight - viewport.height > 120 || viewport.offsetTop > 40;
  }

  function syncKeyboardState() {
    window.clearTimeout(keyboardTimer);
    keyboardTimer = window.setTimeout(() => {
      document.body.classList.toggle('app-keyboard-open', isKeyboardOpen());
    }, 70);
  }

  function clearPressed() {
    dock?.querySelectorAll('.is-pressed').forEach((link) => link.classList.remove('is-pressed'));
  }

  function bindDock(nextDock) {
    if (!dock || dock !== nextDock) {
      dock = nextDock;
      indicator = dock.querySelector('.app-dock-indicator');
      dock.addEventListener('pointerdown', (event) => {
        const link = event.target.closest('a[data-app-route]');
        if (!link) return;
        clearPressed();
        link.classList.add('is-pressed');
      }, { passive: true });
      dock.addEventListener('keydown', (event) => {
        const link = event.target.closest('a[data-app-route]');
        if (!link || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
        clearPressed();
        link.classList.add('is-pressed');
      });
      dock.addEventListener('keyup', clearPressed);
      window.addEventListener('pointerup', clearPressed, { passive: true });
      window.addEventListener('pointercancel', clearPressed, { passive: true });
      window.addEventListener('blur', clearPressed);

      if (resizeObserver) resizeObserver.disconnect();
      if ('ResizeObserver' in window) {
        resizeObserver = new ResizeObserver(() => positionDock(currentRoute, { immediate: true }));
        resizeObserver.observe(dock);
      }
    }
  }

  function positionDock(route = currentRoute, { immediate = false } = {}) {
    if (!dock || !indicator || !route) return;
    const activeLink = dock.querySelector(`[data-app-route="${CSS.escape(route)}"]`);
    if (!activeLink) return;

    const dockRect = dock.getBoundingClientRect();
    const activeRect = activeLink.getBoundingClientRect();
    if (!dockRect.width || !activeRect.width) return;

    const firstPosition = !dock.classList.contains('is-ready');
    const instant = firstPosition || immediate || reducedMotion.matches;
    const x = Math.round((activeRect.left - dockRect.left + 4) * 100) / 100;
    const width = Math.round((activeRect.width - 8) * 100) / 100;

    window.clearTimeout(shiftTimer);
    if (instant) {
      dock.classList.remove('is-shifting');
    } else {
      dock.classList.add('is-shifting');
      shiftTimer = window.setTimeout(() => dock.classList.remove('is-shifting'), 430);
    }

    indicator.style.setProperty('--dock-x', `${x}px`);
    indicator.style.setProperty('--dock-width', `${width}px`);
    if (instant) indicator.style.setProperty('--dock-stretch', '1');

    window.requestAnimationFrame(() => {
      if (!dock || !indicator) return;
      dock.classList.add('is-ready');
      if (firstPosition || reducedMotion.matches) indicator.style.removeProperty('--dock-stretch');
    });
  }

  function sync(nextDock, route, options = {}) {
    bindDock(nextDock);
    currentRoute = route || currentRoute;
    positionDock(currentRoute, options);
  }

  function refresh(options = {}) {
    positionDock(currentRoute, { immediate: true, ...options });
  }

  document.addEventListener('focusin', syncKeyboardState);
  document.addEventListener('focusout', syncKeyboardState);
  window.visualViewport?.addEventListener('resize', syncKeyboardState, { passive: true });
  window.visualViewport?.addEventListener('scroll', syncKeyboardState, { passive: true });
  window.addEventListener('resize', () => {
    syncKeyboardState();
    window.requestAnimationFrame(() => refresh());
  }, { passive: true });
  window.addEventListener('orientationchange', () => window.setTimeout(() => refresh(), 120), { passive: true });
  window.addEventListener('pageshow', () => window.setTimeout(() => refresh(), 80));
  reducedMotion.addEventListener?.('change', () => refresh());
  mobileViewport.addEventListener?.('change', syncKeyboardState);

  window.OURS_LIQUID_DOCK = {
    sync,
    refresh,
    currentRoute: () => currentRoute,
  };
})();