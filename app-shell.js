(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const ROUTES = {
    today: {
      label: '今天',
      eyebrow: 'Today, together',
      title: '今天',
      subtitle: '把今天过好，也把明天放进期待里。',
    },
    plans: {
      label: '计划',
      eyebrow: 'Plans for us',
      title: '计划',
      subtitle: '日程、愿望和提醒，都放在同一个未来里。',
    },
    memories: {
      label: '回忆',
      eyebrow: 'Our memories',
      title: '回忆',
      subtitle: '照片、日记和那些值得再想起的普通日子。',
    },
    life: {
      label: '生活',
      eyebrow: 'A life we share',
      title: '生活',
      subtitle: '今天吃什么，周末去哪里，想一起过的生活。',
    },
    us: {
      label: '我们',
      eyebrow: 'Just the two of us',
      title: '我们',
      subtitle: '游戏、留言、秘密，以及只属于两个人的设置。',
    },
  };

  const ICONS = {
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2v2.1M12 18.7v2.1M20.8 12h-2.1M5.3 12H3.2M18.2 5.8l-1.5 1.5M7.3 16.7l-1.5 1.5M18.2 18.2l-1.5-1.5M7.3 7.3 5.8 5.8"/><circle cx="12" cy="12" r="4.1"/></svg>',
    plans: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5.4" width="16" height="14.4" rx="3"/><path d="M8 3.6v3.4M16 3.6v3.4M4 9.6h16M8.2 13.3h2.1M13.7 13.3h2.1M8.2 16.5h2.1"/></svg>',
    memories: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="m5.7 16 3.7-3.5 3 2.7 2.1-1.9 3.8 3.2"/></svg>',
    life: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.2 3.8v5.1a2.4 2.4 0 0 0 4.8 0V3.8M9.6 3.8v16.4M16.4 3.8v16.4M16.4 3.8c2.2 1.4 3.2 3.6 3.2 6.3 0 1.5-.9 2.5-3.2 2.5"/></svg>',
    us: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.2s-7.4-4.2-7.4-10A4.1 4.1 0 0 1 12 7.4a4.1 4.1 0 0 1 7.4 2.8c0 5.8-7.4 10-7.4 10Z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.7" cy="10.7" r="6.1"/><path d="m15.3 15.3 4.1 4.1"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.7 9.7a5.3 5.3 0 0 1 10.6 0c0 6 2.1 6.4 2.1 7.6H4.6c0-1.2 2.1-1.6 2.1-7.6Z"/><path d="M9.6 19.1a2.8 2.8 0 0 0 4.8 0M12 3.1V2"/></svg>',
    settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.1 13.4a7.8 7.8 0 0 0 0-2.8l1.5-1.1-1.8-3.1-1.8.7a8 8 0 0 0-2.4-1.4L14.3 3h-4.6l-.3 2.7a8 8 0 0 0-2.4 1.4l-1.8-.7-1.8 3.1 1.5 1.1a7.8 7.8 0 0 0 0 2.8L3.4 14.5l1.8 3.1 1.8-.7a8 8 0 0 0 2.4 1.4l.3 2.7h4.6l.3-2.7a8 8 0 0 0 2.4-1.4l1.8.7 1.8-3.1-1.5-1.1Z"/></svg>',
    chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    plusCircle: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="M12 8v8M8 12h8"/></svg>',
  };

  const QUICK_ACTIONS = [
    { id: 'memory', label: '添加回忆', detail: '照片、地点和那天的心情', icon: ICONS.memories },
    { id: 'event', label: '新建约会', detail: '把下一次见面写进日历', icon: ICONS.plans },
    { id: 'todo', label: '添加待办', detail: '记下一件想一起完成的小事', icon: ICONS.today },
    { id: 'wish', label: '添加愿望', detail: '想一起完成的一件小事', icon: ICONS.us },
    { id: 'recipe', label: '添加菜谱', detail: '记住想一起做的味道', icon: ICONS.life },
    { id: 'note', label: '写心里话', detail: '把想说的话留给对方', icon: ICONS.today },
  ];

  const LEGACY_ALIASES = {
    home: ['today', 'home'],
    recent: ['today', 'recent'],
    todayWeek: ['today', 'todayWeek'],
    schedule: ['plans', 'schedule'],
    wishes: ['plans', 'wishes'],
    memories: ['memories', 'memories'],
    daily: ['memories', 'daily'],
    menu: ['life', 'menu'],
    cooking: ['life', 'cooking'],
    weeklyMenuCard: ['life', 'weeklyMenuCard'],
    play: ['us', 'play'],
    'play-more': ['us', 'appUsQuiz'],
    vault: ['us', 'vault'],
  };

  const INTRO_SPECS = {
    plans: {
      kicker: 'Plans for us',
      title: '把期待，安排进日历。',
      copy: '约会、愿望、纪念日和提醒都在一起。计划不是任务表，是下一次好好见面的理由。',
      actions: [
        { label: '安排约会', action: 'new-event', primary: true },
        { label: '打开提醒', action: 'reminders' },
        { label: '共同待办', action: 'todos' },
      ],
    },
    memories: {
      kicker: 'Our memories',
      title: '普通的日子，也值得被认真收藏。',
      copy: '照片留下当时的画面，日记留下当时的心情。顺着时间往回走，我们一直都在。',
      actions: [
        { label: '添加回忆', action: 'new-memory', primary: true },
        { label: '写今天', action: 'new-note' },
      ],
    },
    life: {
      kicker: 'A life we share',
      title: '一餐一饭，都是我们的生活。',
      copy: '厨房是这里最热闹的一角，但生活不只发生在餐桌上。也把约会灵感和采购安排放在这里。',
      actions: [
        { label: '查看今晚的桌', action: 'order', primary: true },
        { label: '买菜清单', action: 'shopping' },
        { label: '礼物与喜好', action: 'gifts' },
      ],
    },
    us: {
      kicker: 'Just the two of us',
      title: '只属于我们两个人的部分。',
      copy: '玩一局游戏，留一封秘密的信，整理好自己的资料。这里不需要向任何人解释。',
      actions: [
        { label: '编辑小档案', action: 'profile', primary: true },
        { label: '备份我们的世界', action: 'backup' },
        { label: '检查更新', action: 'check-update' },
        { label: '云端同步', action: 'cloud' },
      ],
    },
  };

  const main = $('body > main');
  if (!main) return;

  const originalHeroTitle = $('.hero-title', main);
  if (originalHeroTitle?.tagName === 'H1') {
    const heroTitle = document.createElement('h2');
    [...originalHeroTitle.attributes].forEach((attribute) => heroTitle.setAttribute(attribute.name, attribute.value));
    heroTitle.innerHTML = originalHeroTitle.innerHTML;
    originalHeroTitle.replaceWith(heroTitle);
  }

  const footer = $('body > .site-footer');
  const oldOrderFab = $('#orderFab');
  const shell = document.createElement('div');
  shell.className = 'ours-app-shell';
  shell.innerHTML = `
    <aside class="app-sidebar" aria-label="应用侧边导航">
      <a class="app-sidebar-brand" href="#/today" aria-label="OURS 今天">
        <span class="app-brand-mark">O.</span>
        <span><strong>OURS</strong><small>A little world for two</small></span>
      </a>
      <div class="app-sidebar-date"><span id="appSidebarDate">今天</span><i></i></div>
      <nav class="app-rail-nav"></nav>
      <div class="app-sidebar-foot">
        <span class="app-mode-dot"></span>
        <div><strong>Local mode</strong><small>数据只保存在这台设备</small></div>
      </div>
    </aside>
    <div class="app-workspace">
      <header class="app-topbar">
        <a class="app-mobile-brand" href="#/today" aria-label="OURS 今天"><span>O.</span></a>
        <div class="app-topbar-heading">
          <span id="appRouteEyebrow">Today, together</span>
          <h1 id="appPageTitle" class="app-page-title" tabindex="-1">今天</h1>
        </div>
        <div class="app-topbar-actions">
          <button class="app-round-action app-quick-trigger" id="appQuickAdd" type="button" aria-label="快捷添加" aria-haspopup="dialog">${ICONS.plus}</button>
          <button class="app-round-action" id="appSearchButton" type="button" aria-label="全局搜索">${ICONS.search}</button>
          <button class="app-round-action app-notification-trigger" id="appNotificationsButton" type="button" aria-label="通知" aria-haspopup="dialog">${ICONS.bell}<span class="app-notification-badge" id="appNotificationUnreadBadge" hidden></span></button>
          <button class="app-round-action" id="appSettingsButton" type="button" aria-label="设置与档案">${ICONS.settings}</button>
        </div>
      </header>
      <div class="app-content-scroll"></div>
    </div>
    <nav class="app-liquid-dock" aria-label="五大主页面">
      <span class="app-dock-indicator" aria-hidden="true"></span>
      ${Object.entries(ROUTES).map(([route, meta]) => `
        <a href="#/${route}" data-app-route="${route}" aria-label="${meta.label}">
          <span class="app-dock-icon">${ICONS[route]}</span>
          <span class="app-dock-label">${meta.label}</span>
        </a>`).join('')}
    </nav>
    <div class="app-quick-layer" id="appQuickLayer" hidden>
      <button class="app-quick-backdrop" id="appQuickBackdrop" type="button" aria-label="关闭快捷添加"></button>
      <section class="app-quick-sheet" role="dialog" aria-modal="true" aria-labelledby="appQuickTitle">
        <div class="app-sheet-grab" aria-hidden="true"></div>
        <header><div><span>Quick add</span><h2 id="appQuickTitle">想留下什么？</h2></div><button class="app-sheet-close" id="appQuickClose" type="button" aria-label="关闭">×</button></header>
        <div class="app-quick-grid">
          ${QUICK_ACTIONS.map((item) => `
            <button type="button" data-app-quick-action="${item.id}">
              <span class="app-quick-icon">${item.icon}</span>
              <strong>${item.label}</strong>
              <small>${item.detail}</small>
              <span class="app-quick-chevron">${ICONS.chevron}</span>
            </button>`).join('')}
        </div>
      </section>
    </div>
    <div class="app-update-toast" id="appUpdateToast" hidden role="status" aria-live="polite">
      <div><strong>OURS 有新版本</strong><small>更新不会影响本地记录。</small></div>
      <button type="button" id="appUpdateNow">立即更新</button>
      <button type="button" id="appUpdateLater" aria-label="稍后更新">×</button>
    </div>
    <div class="app-route-announcer" id="appRouteAnnouncer" aria-live="polite" aria-atomic="true"></div>
  `;
  document.body.insertBefore(shell, main);

  const contentScroll = $('.app-content-scroll', shell);
  contentScroll.append(main);
  main.className = 'app-main-content';
  main.id = 'appMainContent';

  const routeViews = {};
  Object.entries(ROUTES).forEach(([route, meta]) => {
    const view = document.createElement('section');
    view.className = `app-view app-view--${route}`;
    view.dataset.appView = route;
    view.setAttribute('aria-labelledby', `appViewTitle-${route}`);
    view.hidden = true;
    const intro = INTRO_SPECS[route] ? `
      <header class="app-page-intro">
        <div class="app-page-intro-copy">
          <p>${INTRO_SPECS[route].kicker}</p>
          <h2 id="appViewTitle-${route}">${INTRO_SPECS[route].title}</h2>
          <span>${INTRO_SPECS[route].copy}</span>
        </div>
        <div class="app-page-intro-actions">
          ${INTRO_SPECS[route].actions.map((action) => `<button type="button" data-app-action="${action.action}" class="${action.primary ? 'is-primary' : ''}">${action.label}${action.primary ? ICONS.chevron : ''}</button>`).join('')}
        </div>
      </header>` : '';
    view.innerHTML = intro;
    main.append(view);
    routeViews[route] = view;
  });

  const routeSections = {
    today: ['#recent', '#home'],
    plans: ['#schedule', '#wishes'],
    memories: ['#memories', '#daily'],
    life: ['#menu'],
    us: ['#play', '#vault'],
  };

  Object.entries(routeSections).forEach(([route, selectors]) => {
    const view = routeViews[route];
    selectors.forEach((selector) => {
      const node = $(selector, main);
      if (node) view.append(node);
    });
  });

  const ticker = $('.ticker', main);
  ticker?.remove();

  const playMore = $('#play-more', main);
  if (playMore) {
    const dateBox = $('.date-box', playMore);
    const quizCard = $('.quiz-card', playMore);
    if (dateBox) {
      const lifeIdeas = document.createElement('section');
      lifeIdeas.className = 'app-module-section app-date-ideas';
      lifeIdeas.innerHTML = '<header class="app-module-heading"><div><span>Ideas for us</span><h2>把今晚交给一点即兴。</h2></div><small>收藏灵感、放进愿望，或直接安排进日程。</small></header>';
      lifeIdeas.append(dateBox);
      routeViews.life.append(lifeIdeas);
    }
    if (quizCard) {
      const quizModule = document.createElement('section');
      quizModule.className = 'app-module-section app-quiz-module';
      quizModule.id = 'appUsQuiz';
      quizModule.innerHTML = '<header class="app-module-heading"><div><span>Just for fun</span><h2>再认识彼此一点。</h2></div><small>答案没有输赢，只有你们自己的默契。</small></header>';
      quizModule.append(quizCard);
      routeViews.us.append(quizModule);
    }
    playMore.remove();
  }

  if (footer) {
    if (!footer.id) footer.id = 'appSiteFooter';
    footer.classList.add('app-site-footer');
    routeViews.us.append(footer);
  }

  const dock = $('.app-liquid-dock', shell);
  const routeAnnouncer = $('#appRouteAnnouncer', shell);
  const pageTitle = $('#appPageTitle', shell);
  const routeEyebrow = $('#appRouteEyebrow', shell);
  const quickLayer = $('#appQuickLayer', shell);
  const quickSheet = $('.app-quick-sheet', shell);
  const quickTrigger = $('#appQuickAdd', shell);
  const topbar = $('.app-topbar', shell);
  const sidebar = $('.app-sidebar', shell);

  let currentRoute = null;
  let currentAnchor = '';
  let quickTriggerElement = null;
  let quickOpen = false;
  let pageAnimationTimer = 0;
  const scrollPositions = new Map();
  const initialController = Boolean(navigator.serviceWorker?.controller);

  const railNav = $('.app-rail-nav', shell);
  railNav.innerHTML = Object.entries(ROUTES).map(([route, meta]) => `
    <a href="#/${route}" data-app-route="${route}" aria-label="${meta.label}：${meta.subtitle}">
      <span class="app-rail-icon">${ICONS[route]}</span>
      <span><strong>${meta.label}</strong><small>${meta.subtitle}</small></span>
    </a>`).join('');

  function setDateLabels() {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat('zh-CN', {
      month: 'long', day: 'numeric', weekday: 'long',
    }).format(now);
    const sidebarDate = $('#appSidebarDate', shell);
    if (sidebarDate) sidebarDate.textContent = dateLabel;
    shell.style.setProperty('--app-today-label', `"${dateLabel}"`);
  }

  function routeFromHash(rawHash = location.hash) {
    const raw = decodeURIComponent(String(rawHash || '').replace(/^#\/?/, ''));
    if (!raw) return { route: 'today', anchor: '' };
    const [routeToken, ...anchorParts] = raw.split('/');
    if (ROUTES[routeToken]) {
      const anchor = anchorParts.join('/');
      return { route: routeToken, anchor };
    }
    if (LEGACY_ALIASES[raw]) {
      const [route, anchor] = LEGACY_ALIASES[raw];
      return { route, anchor };
    }
    if (ROUTES[routeToken]) return { route: routeToken, anchor: '' };
    const element = document.getElementById(routeToken);
    const owner = element?.closest('[data-app-view]');
    if (owner && ROUTES[owner.dataset.appView]) {
      return { route: owner.dataset.appView, anchor: routeToken };
    }
    return { route: 'today', anchor: '' };
  }

  function canonicalHash(route, anchor = '') {
    return `#/${route}${anchor ? `/${anchor}` : ''}`;
  }

  function setNavigationState(route) {
    $$('[data-app-route]', shell).forEach((link) => {
      const active = link.dataset.appRoute === route;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    document.body.dataset.appRoute = route;
    document.documentElement.dataset.appRoute = route;
    window.OURS_LIQUID_DOCK?.sync(dock, route);
  }

  function updateTopbar(route) {
    const meta = ROUTES[route];
    if (!meta) return;
    pageTitle.textContent = meta.title;
    routeEyebrow.textContent = meta.eyebrow;
    document.title = `${meta.label} · OURS`;
    routeAnnouncer.textContent = `已打开${meta.label}页面。${meta.subtitle}`;
  }

  function scrollToAnchor(anchor, behavior = 'auto') {
    if (!anchor) return false;
    const target = document.getElementById(anchor);
    if (!target) return false;
    target.scrollIntoView({ behavior, block: 'start' });
    return true;
  }

  function renderRoute({ focus = false, animate = true } = {}) {
    const { route, anchor } = routeFromHash();
    if (!ROUTES[route]) return;
    const expectedHash = canonicalHash(route, anchor);
    if (location.hash !== expectedHash) history.replaceState(null, '', expectedHash);
    const routeChanged = route !== currentRoute;
    if (currentRoute) scrollPositions.set(currentRoute, window.scrollY);

    if (routeChanged) {
      const oldView = routeViews[currentRoute];
      oldView?.classList.remove('is-active');
      oldView?.setAttribute('aria-hidden', 'true');
      Object.entries(routeViews).forEach(([viewRoute, view]) => {
        const active = viewRoute === route;
        view.hidden = !active;
        view.setAttribute('aria-hidden', String(!active));
      });
      const nextView = routeViews[route];
      nextView.hidden = false;
      nextView.classList.remove('is-entering');
      if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void nextView.offsetWidth;
        nextView.classList.add('is-entering');
        window.clearTimeout(pageAnimationTimer);
        pageAnimationTimer = window.setTimeout(() => nextView.classList.remove('is-entering'), 420);
      }
      nextView.classList.add('is-active');
      currentRoute = route;
      currentAnchor = anchor;
      setNavigationState(route);
      updateTopbar(route);
      const targetScroll = scrollPositions.get(route) || 0;
      if (!anchor) window.scrollTo(0, targetScroll);
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
        if (anchor) {
          scrollToAnchor(anchor, 'auto');
        } else {
          window.scrollTo(0, targetScroll);
        }
        if (focus) pageTitle.focus({ preventScroll: true });
      }));
      if (!anchor) {
        window.setTimeout(() => {
          if (currentRoute === route && !currentAnchor) window.scrollTo(0, targetScroll);
        }, 430);
      }
    } else {
      currentAnchor = anchor;
      if (anchor) window.requestAnimationFrame(() => scrollToAnchor(anchor, 'smooth'));
    }
  }

  function navigate(route, anchor = '', { focus = true, replace = false } = {}) {
    if (!ROUTES[route]) return;
    const nextHash = canonicalHash(route, anchor);
    if (route === currentRoute && !anchor) {
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      if (focus) pageTitle.focus({ preventScroll: true });
      return;
    }
    if (location.hash !== nextHash) {
      if (replace) history.replaceState(null, '', nextHash);
      else history.pushState(null, '', nextHash);
    }
    renderRoute({ focus, animate: true });
  }

  function resolveNavigation(rawHash) {
    if (!rawHash) return null;
    const clean = rawHash.replace(/^#/, '');
    if (!clean) return null;
    if (ROUTES[clean]) return { route: clean, anchor: '' };
    if (LEGACY_ALIASES[clean]) {
      const [route, anchor] = LEGACY_ALIASES[clean];
      return { route, anchor };
    }
    const element = document.getElementById(clean);
    const owner = element?.closest('[data-app-view]');
    if (owner) return { route: owner.dataset.appView, anchor: clean };
    return null;
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || link.target === '_blank') return;
    const destination = resolveNavigation(link.getAttribute('href'));
    if (!destination) return;
    event.preventDefault();
    navigate(destination.route, destination.anchor, { focus: true });
  }, true);

  function openQuickAdd(trigger) {
    quickTriggerElement = trigger || document.activeElement;
    quickOpen = true;
    quickLayer.hidden = false;
    document.body.classList.add('app-quick-open');
    window.requestAnimationFrame(() => {
      quickLayer.classList.add('is-open');
      $('[data-app-quick-action]', quickLayer)?.focus({ preventScroll: true });
    });
  }

  function closeQuickAdd({ restoreFocus = true } = {}) {
    if (!quickOpen) return;
    quickOpen = false;
    quickLayer.classList.remove('is-open');
    document.body.classList.remove('app-quick-open');
    window.setTimeout(() => { quickLayer.hidden = true; }, 260);
    if (restoreFocus) quickTriggerElement?.focus?.({ preventScroll: true });
  }

  function triggerExisting(selector, delay = 60) {
    const element = $(selector);
    if (!element) return false;
    window.setTimeout(() => element.click(), delay);
    return true;
  }

  function triggerAction(action) {
    const actions = {
      'new-event': () => triggerExisting('#addEvent'),
      'new-todo': () => {
        navigate('plans', 'sharedTodos');
        window.setTimeout(() => document.querySelector('#todoTitle')?.focus({ preventScroll: true }), 260);
      },
      reminders: () => triggerExisting('#openReminders'),
      todos: () => navigate('plans', 'sharedTodos'),
      gifts: () => navigate('life', 'giftShelf'),
      'new-memory': () => triggerExisting('#addMemory'),
      'new-note': () => {
        navigate('memories', 'daily');
        window.setTimeout(() => $('#dailyNoteInput')?.focus({ preventScroll: true }), 240);
      },
      'new-wish': () => {
        navigate('plans', 'wishes');
        window.setTimeout(() => $('#wishInput')?.focus({ preventScroll: true }), 240);
      },
      shopping: () => triggerExisting('#openShopping'),
      order: () => triggerExisting('#orderFab'),
      cooking: () => triggerExisting('#openTodayCooking'),
      profile: () => triggerExisting('#openProfile'),
      backup: () => {
        navigate('us', 'appSiteFooter');
        window.setTimeout(() => $('#exportData')?.click(), 240);
      },
      quiz: () => triggerExisting('#startQuiz'),
      'date-idea': () => triggerExisting('#drawDateIdea'),
      'check-update': () => checkForUpdate(),
      cloud: () => navigate('us', 'cloudSync'),
    };
    actions[action]?.();
  }

  document.addEventListener('click', (event) => {
    const actionButton = event.target.closest('[data-app-action]');
    if (actionButton) {
      triggerAction(actionButton.dataset.appAction);
      return;
    }
    const quickAction = event.target.closest('[data-app-quick-action]');
    if (quickAction) {
      const action = quickAction.dataset.appQuickAction;
      const targetRoute = action === 'event' || action === 'wish' || action === 'todo' ? 'plans' : action === 'recipe' ? 'life' : 'memories';
      closeQuickAdd({ restoreFocus: false });
      navigate(targetRoute, '', { focus: false });
      window.setTimeout(() => {
        const button = $(`[data-quick-add="${action}"]`);
        if (button) button.click();
        else triggerAction(action === 'memory' ? 'new-memory' : action === 'event' ? 'new-event' : action === 'todo' ? 'new-todo' : action === 'wish' ? 'new-wish' : action === 'note' ? 'new-note' : 'shopping');
      }, 180);
    }
  });

  quickTrigger.addEventListener('click', () => openQuickAdd(quickTrigger));
  $('#appQuickBackdrop', shell).addEventListener('click', () => closeQuickAdd());
  $('#appQuickClose', shell).addEventListener('click', () => closeQuickAdd());
  $('#appSearchButton', shell).addEventListener('click', () => triggerExisting('#openSearch', 0));
  $('#appSettingsButton', shell).addEventListener('click', () => triggerExisting('#openProfile', 0));

  document.addEventListener('keydown', (event) => {
    if (!quickOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeQuickAdd();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])', quickSheet).filter((item) => item.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  function syncChromeInert() {
    const blocked = document.body.classList.contains('modal-open') || quickOpen;
    [topbar, dock, sidebar].forEach((element) => { if (element) element.inert = blocked; });
    topbar?.classList.toggle('is-behind-overlay', blocked);
  }
  new MutationObserver(syncChromeInert).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  syncChromeInert();


  function showUpdateToast() {
    const toast = $('#appUpdateToast', shell);
    if (!toast || !toast.hidden) return;
    toast.hidden = false;
    window.requestAnimationFrame(() => toast.classList.add('is-visible'));
  }

  async function checkForUpdate() {
    if (!('serviceWorker' in navigator)) {
      window.OURS_APP?.showToast?.('当前浏览器不支持 PWA 更新检查。');
      return;
    }
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        window.OURS_APP?.showToast?.('刷新页面后会重新检查应用版本。');
        return;
      }
      if (registration.waiting) {
        showUpdateToast();
        return;
      }
      await registration.update();
      window.OURS_APP?.showToast?.('已检查更新；有新版时会提示你重新载入。');
    } catch {
      window.OURS_APP?.showToast?.('暂时无法检查更新，请稍后再试。');
    }
  }

  $('#appUpdateNow', shell).addEventListener('click', () => location.reload());
  $('#appUpdateLater', shell).addEventListener('click', () => {
    const toast = $('#appUpdateToast', shell);
    toast.classList.remove('is-visible');
    window.setTimeout(() => { toast.hidden = true; }, 240);
  });

  navigator.serviceWorker?.addEventListener('controllerchange', () => {
    if (initialController) showUpdateToast();
  });
  navigator.serviceWorker?.getRegistration?.().then((registration) => {
    if (registration?.waiting) showUpdateToast();
  }).catch(() => {});


  window.addEventListener('popstate', () => renderRoute({ focus: false }));
  window.addEventListener('hashchange', () => renderRoute({ focus: false }));

  setDateLabels();
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  document.documentElement.classList.add('app-shell-ready');
  document.body.classList.add('app-shell-ready');
  document.body.dataset.appShell = '3.0';

  const skipLink = $('.skip-link');
  if (skipLink) {
    skipLink.href = '#/today';
    skipLink.textContent = '跳到主要内容';
  }

  const initial = routeFromHash();
  const initialCanonical = canonicalHash(initial.route, initial.anchor);
  if (location.hash !== initialCanonical) history.replaceState(null, '', initialCanonical);
  renderRoute({ focus: false, animate: false });

  const shortcut = new URL(location.href).searchParams.get('shortcut');
  if (shortcut === 'memory' || shortcut === 'event') {
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete('shortcut');
    history.replaceState(null, '', cleanUrl);
    window.setTimeout(() => {
      const quickButton = document.querySelector(`[data-quick-add="${shortcut}"]`);
      if (quickButton) quickButton.click();
      else triggerAction(shortcut === 'memory' ? 'new-memory' : 'new-event');
    }, 420);
  }

  window.OURS_APP_SHELL = {
    navigate,
    renderRoute,
    currentRoute: () => currentRoute,
    checkForUpdate,
  };
})();