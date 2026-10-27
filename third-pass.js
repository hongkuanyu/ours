(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const sectionTitles = {
    home: '首页', recent: '近期', schedule: '日程', menu: '今晚私厨', memories: '回忆', wishes: '共同愿望',
    daily: '每日心里话', play: '一起玩', 'play-more': '约会与问答', vault: '我们的秘密',
  };
  const shellSelectors = ['main', '.site-footer', '.mobile-dock', '.order-fab'];
  let menuTrigger = null;
  let sectionFrame = 0;
  let mediaFrame = 0;

  function visibleDialog() {
    const panels = $$('.modal-layer:not([hidden]) [role="dialog"], .drawer-layer:not([hidden]) .order-drawer, .drawer-layer:not([hidden]) .shopping-drawer, .install-layer:not([hidden]) [role="dialog"]').filter((panel) => panel.classList.contains('is-open'));
    return panels[panels.length - 1] || null;
  }

  function setShellInert(active) {
    shellSelectors.forEach((selector) => {
      $$(selector).forEach((element) => { element.inert = active; });
    });
    const header = $('#siteHeader');
    if (header) header.inert = active && !document.body.classList.contains('menu-open');
  }

  function bindMenuMore() {
    const more = $('#dockMore');
    const toggle = $('#menuToggle');
    if (!more || !toggle) return;
    more.addEventListener('click', () => {
      menuTrigger = more;
      if (!document.body.classList.contains('menu-open')) toggle.click();
    });
    toggle.addEventListener('click', () => {
      if (!document.body.classList.contains('menu-open')) menuTrigger = toggle;
    });
    const menu = $('#mobileMenu');
    let wasOpen = false;
    const syncMenu = () => {
      const open = document.body.classList.contains('menu-open');
      if (open && !wasOpen) {
        window.setTimeout(() => $('a, button', menu)?.focus({ preventScroll: true }), 120);
      } else if (!open && wasOpen) {
        window.setTimeout(() => (menuTrigger || toggle).focus({ preventScroll: true }), 80);
      }
      wasOpen = open;
      setShellInert(open || Boolean(visibleDialog()));
    };
    new MutationObserver(syncMenu).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    syncMenu();
  }

  function bindDialogA11y() {
    const focusableSelector = ['a[href]', 'button:not([disabled])', 'input:not([disabled])', 'textarea:not([disabled])', 'select:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(',');
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Tab') return;
      const panel = visibleDialog();
      if (!panel) return;
      const focusable = $$(focusableSelector, panel).filter((element) => element.offsetParent !== null);
      if (!focusable.length) {
        event.preventDefault();
        panel.focus?.({ preventScroll: true });
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    });
    const sync = () => {
      const active = Boolean(visibleDialog());
      setShellInert(active || document.body.classList.contains('menu-open'));
    };
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['hidden', 'class'], subtree: true });
    sync();
  }

  function updateSectionContext() {
    if (document.body.classList.contains('app-shell-ready')) return;
    const sections = Object.keys(sectionTitles).map((id) => ({ id, element: document.getElementById(id) })).filter((item) => item.element);
    const threshold = window.innerHeight * 0.3;
    let active = sections[0];
    sections.forEach((item) => {
      const rect = item.element.getBoundingClientRect();
      if (rect.top <= threshold && rect.bottom > threshold) active = item;
    });
    const activeId = active?.id || 'home';
    const navId = activeId === 'recent' ? 'home' : activeId === 'play-more' ? 'play' : activeId;
    const label = sectionTitles[activeId] || '首页';
    const context = $('#brandSection');
    if (context && context.textContent !== label) context.textContent = label;
    let matchedDock = false;
    $$('.desktop-nav a, .mobile-dock a').forEach((link) => {
      const target = link.dataset.section || link.getAttribute('href')?.slice(1);
      const current = target === navId;
      if (current) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
      if (link.closest('.mobile-dock')) {
        link.classList.toggle('is-active', current);
        if (current) matchedDock = true;
      }
    });
    $('#dockMore')?.classList.toggle('is-active', !matchedDock);
    document.documentElement.dataset.section = activeId;
  }

  function scheduleSectionContext() {
    if (sectionFrame) return;
    sectionFrame = window.requestAnimationFrame(() => {
      updateSectionContext();
      sectionFrame = 0;
    });
  }
  function markImage(img) {
    if (!(img instanceof HTMLImageElement) || img.dataset.mediaBound === 'true') return;
    img.dataset.mediaBound = 'true';
    img.decoding = 'async';
    if (!img.closest('.hero') && !img.hasAttribute('loading')) img.loading = 'lazy';
    img.classList.add('media-enhanced');
    const holder = img.parentElement;
    if (!holder) return;
    const loaded = () => {
      holder.classList.remove('media-loading', 'media-error');
      img.classList.remove('media-loading');
      holder.classList.add('media-loaded');
      img.classList.add('media-loaded');
    };
    const failed = () => {
      holder.classList.remove('media-loading');
      img.classList.remove('media-loading');
      holder.classList.add('media-error');
    };
    if (img.complete) {
      if (img.naturalWidth > 0) loaded();
      else failed();
      return;
    }
    holder.classList.add('media-loading');
    img.classList.add('media-loading');
    img.addEventListener('load', loaded, { once: true });
    img.addEventListener('error', failed, { once: true });
  }

  function enhanceMedia(root = document) {
    if (root instanceof HTMLImageElement) markImage(root);
    else $$('img', root).forEach(markImage);
  }

  function scheduleMediaEnhance() {
    if (mediaFrame) return;
    mediaFrame = window.requestAnimationFrame(() => {
      enhanceMedia();
      mediaFrame = 0;
    });
  }

  function bindPressFeedback() {
    let pressed = null;
    const clear = () => {
      pressed?.classList.remove('is-pressing');
      pressed = null;
    };
    document.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      const target = event.target.closest('button, a, .dish-card, .memory-card, .recent-item, .wish-item');
      if (!target || target.matches(':disabled')) return;
      clear();
      pressed = target;
      target.classList.add('is-pressing');
    }, { passive: true });
    window.addEventListener('pointerup', clear, { passive: true });
    window.addEventListener('pointercancel', clear, { passive: true });
    window.addEventListener('blur', clear);
  }

  function bindMicroInteractions() {
    document.addEventListener('click', (event) => {
      const cartAction = event.target.closest('[data-cart-action]');
      if (cartAction) {
        const cartId = cartAction.closest('[data-cart-id]')?.dataset.cartId;
        window.setTimeout(() => {
          const quantity = cartId ? $(`[data-cart-id="${CSS.escape(cartId)}"] .line-quantity span`) : null;
          if (!quantity) return;
          quantity.classList.remove('is-bumped');
          void quantity.offsetWidth;
          quantity.classList.add('is-bumped');
        }, 30);
      }

      if (event.target.closest('#drawDateIdea')) {
        const result = $('#dateIdeaResult');
        window.setTimeout(() => {
          if (!result) return;
          result.classList.remove('is-revealed');
          void result.offsetWidth;
          result.classList.add('is-revealed');
        }, 80);
      }      if (event.target.closest('#memoryYearFilter button, #memoryViewToggle button')) {
        const grid = $('#memoryGrid');
        grid?.classList.add('is-filtering');
        window.setTimeout(() => grid?.classList.remove('is-filtering'), 220);
      }
      if (event.target.closest('#menuFilters button')) {
        const grid = $('#dishGrid');
        grid?.classList.add('is-filtering');
        window.setTimeout(() => grid?.classList.remove('is-filtering'), 220);
      }
    }, true);

    const image = $('#memoryModalImage');
    if (image) {
      new MutationObserver(() => {
        image.classList.remove('is-refreshing');
        void image.offsetWidth;
        image.classList.add('is-refreshing');
      }).observe(image, { attributes: true, attributeFilter: ['src'] });
    }
  }
  function init() {
    bindMenuMore();
    bindDialogA11y();
    bindPressFeedback();
    bindMicroInteractions();
    updateSectionContext();
    enhanceMedia();
    window.addEventListener('scroll', scheduleSectionContext, { passive: true });
    window.addEventListener('resize', scheduleSectionContext, { passive: true });
    window.addEventListener('hashchange', scheduleSectionContext);
    document.addEventListener('ours:ready', scheduleMediaEnhance);
    document.addEventListener('ours:data-changed', scheduleMediaEnhance);
    document.addEventListener('ours:dishes-rendered', scheduleMediaEnhance);
    document.addEventListener('ours:dish-opened', scheduleMediaEnhance);
    new MutationObserver(scheduleMediaEnhance).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('load', () => {
      scheduleMediaEnhance();
      scheduleSectionContext();
    }, { once: true });
  }

  window.OURS_THIRD_PASS = { enhanceMedia, updateSectionContext };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();