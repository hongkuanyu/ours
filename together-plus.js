(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const api = window.OURS_FEATURES_API;
  const store = window.OURS_STORE;
  if (!api || !store) return;

  const TODOS_KEY = 'ours-todos-v1';
  const GIFTS_KEY = 'ours-gifts-v1';
  const PREFERENCES_KEY = 'ours-preferences-v1';
  const EVENT_KEY = 'ours-events-v1';
  const WISH_KEY = 'ours-supper-wishes-v2';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const dateLabel = (value) => {
    if (!value) return '没有日期';
    const date = new Date(`${value}T00:00:00`);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
  };
  const daysUntil = (value) => {
    if (!value) return null;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const date = new Date(`${value}T00:00:00`);
    return Math.round((date - today) / 86400000);
  };
  const arrayData = (key) => {
    const value = store.getJSON(key, []);
    return Array.isArray(value) ? value : [];
  };
  const saveArray = (key, value) => store.setJSON(key, value);

  let todos = arrayData(TODOS_KEY).filter((item) => item && item.id && item.title).map((item) => ({
    ...item,
    status: item.status === 'done' ? 'done' : 'open',
    priority: item.priority === 'important' ? 'important' : 'normal',
    dueDate: item.dueDate || '',
    notes: item.notes || '',
    wishId: item.wishId || '',
    createdAt: item.createdAt || new Date().toISOString(),
    updatedAt: item.updatedAt || new Date().toISOString(),
    completedAt: item.completedAt || '',
  }));
  let gifts = arrayData(GIFTS_KEY).filter((item) => item && item.id && item.title).map((item) => ({
    ...item,
    forWhom: item.forWhom || 'her',
    status: ['idea', 'planned', 'bought', 'given'].includes(item.status) ? item.status : 'idea',
    budget: item.budget === '' || item.budget == null ? '' : Math.max(0, Number(item.budget) || 0),
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));
  let preferences = arrayData(PREFERENCES_KEY).filter((item) => item && item.id && item.title).map((item) => ({
    ...item,
    person: item.person === 'me' ? 'me' : 'her',
    type: item.type === 'dislike' ? 'dislike' : 'like',
    category: item.category || '其他',
    notes: item.notes || '',
    updatedAt: item.updatedAt || new Date().toISOString(),
  }));

  let todoFilter = 'open';
  let editingTodoId = '';
  let giftFilter = 'active';
  let editingGiftId = '';
  let preferenceFilter = 'all';
  let editingPreferenceId = '';
  let decisionText = '';

  const plansView = $('[data-app-view="plans"]');
  const lifeView = $('[data-app-view="life"]');
  const todayView = $('[data-app-view="today"]');

  function wishOptions(selected = '') {
    const wishes = api.getWishes().filter((wish) => !wish.done);
    return '<option value="">不关联愿望</option>' + wishes.map((wish) => `<option value="${escapeHTML(wish.id)}" ${wish.id === selected ? 'selected' : ''}>${escapeHTML(wish.title)}</option>`).join('');
  }

  function linkedEventForTodo(todoId) {
    const events = arrayData(EVENT_KEY);
    return events.find((event) => event && event.todoId === todoId) || null;
  }

  function renderTodoModule() {
    const list = $('#todoList');
    if (!list) return;
    const openCount = todos.filter((todo) => todo.status !== 'done').length;
    const doneCount = todos.length - openCount;
    $('#todoCount').textContent = `${openCount} 项待完成`;
    $$('[data-todo-filter]', $('#sharedTodos')).forEach((button) => {
      const active = button.dataset.todoFilter === todoFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const filtered = todos
      .filter((todo) => todoFilter === 'all' || (todoFilter === 'open' ? todo.status !== 'done' : todo.status === 'done'))
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === 'done' ? 1 : -1;
        if (a.priority !== b.priority) return a.priority === 'important' ? -1 : 1;
        return `${a.dueDate || '9999-12-31'}${a.createdAt}`.localeCompare(`${b.dueDate || '9999-12-31'}${b.createdAt}`);
      });
    if (!filtered.length) {
      list.innerHTML = `<div class="plus-empty"><strong>${todoFilter === 'done' ? '还没有完成的待办' : '暂时没有待办'}</strong><p>${todoFilter === 'done' ? '完成一件事后，它会出现在这里。' : '写下一件想和对方一起完成的小事。'}</p></div>`;
      renderHomeTodos();
      return;
    }
    list.innerHTML = filtered.map((todo) => {
      const wish = api.getWishes().find((item) => item.id === todo.wishId);
      const event = linkedEventForTodo(todo.id);
      const days = daysUntil(todo.dueDate);
      const dueTone = todo.status !== 'done' && days !== null && days < 0 ? 'is-overdue' : todo.status !== 'done' && days !== null && days <= 3 ? 'is-soon' : '';
      return `
        <article class="plus-todo-item ${todo.status === 'done' ? 'is-done' : ''}" data-todo-id="${escapeHTML(todo.id)}">
          <button class="plus-check" type="button" data-todo-toggle="${escapeHTML(todo.id)}" aria-label="${todo.status === 'done' ? '标记为未完成' : '标记为已完成'}"><span>✓</span></button>
          <div class="plus-todo-copy">
            <div class="plus-item-heading"><h3>${escapeHTML(todo.title)}</h3>${todo.priority === 'important' ? '<span class="plus-priority">重要</span>' : ''}</div>
            ${todo.notes ? `<p>${escapeHTML(todo.notes)}</p>` : ''}
            <div class="plus-meta">
              <span class="${dueTone}">${escapeHTML(dateLabel(todo.dueDate))}</span>
              ${wish ? `<span>愿望 · ${escapeHTML(wish.title)}</span>` : ''}
              ${event ? `<span>日程 · ${escapeHTML(event.status === 'completed' ? '已完成' : '已安排')}</span>` : ''}
            </div>
          </div>
          <div class="plus-item-actions">
            ${event ? `<button type="button" data-todo-view-event="${escapeHTML(event.id)}">查看日程</button>` : `<button type="button" data-todo-plan="${escapeHTML(todo.id)}">安排约会</button>`}
            <button type="button" data-todo-edit="${escapeHTML(todo.id)}">编辑</button>
            <button type="button" data-todo-remove="${escapeHTML(todo.id)}">删除</button>
          </div>
        </article>`;
    }).join('');
    renderHomeTodos();
  }

  function renderHomeTodos() {
    const card = $('#plusHomeTodos');
    if (!card) return;
    const open = todos.filter((todo) => todo.status !== 'done').sort((a, b) => `${a.dueDate || '9999-12-31'}${a.createdAt}`.localeCompare(`${b.dueDate || '9999-12-31'}${b.createdAt}`));
    const next = open.slice(0, 2);
    card.innerHTML = `
      <button class="plus-home-main" type="button" data-plus-open-todos>
        <span class="plus-home-kicker">共同待办</span>
        <strong>${open.length ? `${open.length} 件小事在等我们` : '今天没有悬着的事'}</strong>
        <small>${next.length ? next.map((todo) => escapeHTML(todo.title)).join(' · ') : '需要时，把下一件事写进来。'}</small>
      </button>
      <button class="plus-home-add" type="button" data-plus-add-todo aria-label="添加共同待办">＋</button>`;
  }

  function fillTodoForm(todo = null) {
    editingTodoId = todo?.id || '';
    $('#todoTitle').value = todo?.title || '';
    $('#todoDueDate').value = todo?.dueDate || '';
    $('#todoPriority').value = todo?.priority || 'normal';
    $('#todoWishId').innerHTML = wishOptions(todo?.wishId || '');
    $('#todoNotes').value = todo?.notes || '';
    $('#todoSubmit').innerHTML = todo ? '保存修改' : '加入待办';
    const todoMore = $('#sharedTodos .plus-form-more');
    if (todoMore) todoMore.open = Boolean(todo && (todo.wishId || todo.notes));
    $('#todoFormTitle').textContent = todo ? '编辑这件小事' : '写下下一件小事';
    if (todo) $('#sharedTodos').scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
  }

  function completeLinkedWish(todo) {
    if (!todo.wishId) return;
    const wish = api.getWishes().find((item) => item.id === todo.wishId);
    if (!wish || wish.done || !window.confirm(`待办已完成。要把愿望“${wish.title}”也标记为完成吗？`)) return;
    wish.done = true;
    wish.completedAt = todayISO();
    if (!api.saveWishes()) {
      api.toast('待办已完成，但关联愿望同步失败。');
      return;
    }
    api.renderWishes();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
  }

  function saveTodoFromForm(event) {
    event.preventDefault();
    const title = $('#todoTitle').value.trim();
    if (!title) return;
    const existing = todos.find((item) => item.id === editingTodoId);
    const now = new Date().toISOString();
    const record = {
      ...(existing || {}),
      id: existing?.id || uid('todo'),
      title,
      dueDate: $('#todoDueDate').value,
      priority: $('#todoPriority').value,
      wishId: $('#todoWishId').value,
      notes: $('#todoNotes').value.trim(),
      status: existing?.status || 'open',
      completedAt: existing?.completedAt || '',
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    const next = existing ? todos.map((item) => item.id === existing.id ? record : item) : [record, ...todos];
    const snapshot = todos;
    todos = next;
    if (!saveArray(TODOS_KEY, todos)) {
      todos = snapshot;
      api.toast('待办保存失败，请检查浏览器存储空间。');
      return;
    }
    fillTodoForm();
    renderTodoModule();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.toast(existing ? '待办已经更新。' : '已经写进共同待办。');
  }

  function handleTodoAction(event) {
    const toggle = event.target.closest('[data-todo-toggle]');
    const edit = event.target.closest('[data-todo-edit]');
    const remove = event.target.closest('[data-todo-remove]');
    const plan = event.target.closest('[data-todo-plan]');
    const viewEvent = event.target.closest('[data-todo-view-event]');
    const todo = todos.find((item) => item.id === (toggle?.dataset.todoToggle || edit?.dataset.todoEdit || remove?.dataset.todoRemove || plan?.dataset.todoPlan));
    if (todo && toggle) {
      const wasDone = todo.status === 'done';
      todo.status = wasDone ? 'open' : 'done';
      todo.completedAt = wasDone ? '' : todayISO();
      todo.updatedAt = new Date().toISOString();
      if (!saveArray(TODOS_KEY, todos)) {
        todo.status = wasDone ? 'done' : 'open';
        api.toast('状态保存失败。');
        return;
      }
      if (!wasDone) completeLinkedWish(todo);
      renderTodoModule();
      document.dispatchEvent(new CustomEvent('ours:data-changed'));
      return;
    }
    if (todo && edit) { fillTodoForm(todo); return; }
    if (todo && remove) {
      if (!window.confirm(`删除待办“${todo.title}”？关联日程和愿望不会被删除。`)) return;
      todos = todos.filter((item) => item.id !== todo.id);
      saveArray(TODOS_KEY, todos);
      renderTodoModule();
      document.dispatchEvent(new CustomEvent('ours:data-changed'));
      api.toast('待办已经删除。');
      return;
    }
    if (todo && plan) {
      document.dispatchEvent(new CustomEvent('ours:open-event', { detail: { prefill: { title: todo.title, date: todo.dueDate || todayISO(), notes: todo.notes, todoId: todo.id, status: 'planned' } } }));
      return;
    }
    if (viewEvent) {
      document.dispatchEvent(new CustomEvent('ours:open-event', { detail: { id: viewEvent.dataset.todoViewEvent } }));
    }
  }

  function buildTodoSection() {
    if (!plansView || $('#sharedTodos')) return;
    const section = document.createElement('section');
    section.className = 'app-module-section plus-module plus-todos';
    section.id = 'sharedTodos';
    section.innerHTML = `
      <header class="app-module-heading">
        <div><span>Things to do together</span><h2>共同待办</h2></div>
        <small id="todoCount">0 项待完成</small>
      </header>
      <form class="plus-form todo-form" id="todoForm">
        <div class="plus-form-title"><strong id="todoFormTitle">写下下一件小事</strong><small>三两步就能安排清楚。</small></div>
        <div class="plus-form-grid">
          <label class="field plus-field-wide">待办内容<input id="todoTitle" maxlength="60" required placeholder="例如：一起挑一只花瓶" /></label>
          <label class="field">计划日期<input id="todoDueDate" type="date" /></label>
          <label class="field">优先级<select id="todoPriority"><option value="normal">普通</option><option value="important">重要</option></select></label>
        <details class="plus-form-more">
          <summary>关联愿望、备注</summary>
          <div class="plus-form-grid">
            <label class="field">关联愿望<select id="todoWishId"></select></label>
            <label class="field plus-field-wide">备注<input id="todoNotes" maxlength="120" placeholder="补充一点需要记住的细节" /></label>
          </div>
        </details>
        </div>
        <div class="plus-form-actions"><button class="text-button" id="todoCancelEdit" type="button">清空</button><button class="primary-button" id="todoSubmit" type="submit">加入待办</button></div>
      </form>
      <div class="plus-toolbar" role="group" aria-label="待办筛选"><button type="button" data-todo-filter="open" class="is-active">待完成</button><button type="button" data-todo-filter="done">已完成</button><button type="button" data-todo-filter="all">全部</button></div>
      <div class="plus-list" id="todoList"></div>`;
    const wishes = $('#wishes', plansView);
    plansView.insertBefore(section, wishes || null);
    $('#todoForm').addEventListener('submit', saveTodoFromForm);
    $('#todoCancelEdit').addEventListener('click', () => fillTodoForm());
    $('#sharedTodos').addEventListener('click', (event) => {
      const filter = event.target.closest('[data-todo-filter]');
      if (filter) { todoFilter = filter.dataset.todoFilter; renderTodoModule(); return; }
      handleTodoAction(event);
    });
    fillTodoForm();
    renderTodoModule();
  }

  function buildHomeTodoCard() {
    if (!todayView || $('#plusHomeTodos')) return;
    const todayWeek = $('#todayWeek', todayView);
    if (!todayWeek) return;
    const card = document.createElement('section');
    card.className = 'plus-home-todos';
    card.id = 'plusHomeTodos';
    todayWeek.insertAdjacentElement('afterend', card);
    renderHomeTodos();
  }

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-plus-open-todos]')) {
      window.OURS_APP_SHELL?.navigate('plans', 'sharedTodos');
      return;
    }
    if (event.target.closest('[data-plus-add-todo]')) {
      window.OURS_APP_SHELL?.navigate('plans', 'sharedTodos');
      window.setTimeout(() => $('#todoTitle')?.focus({ preventScroll: true }), 260);
    }
  });

  document.addEventListener('ours:add-todo-from-wish', (event) => {
    const wish = api.getWishes().find((item) => item.id === event.detail?.id);
    if (!wish) return;
    window.OURS_APP_SHELL?.navigate('plans', 'sharedTodos');
    window.setTimeout(() => {
      fillTodoForm();
      $('#todoTitle').value = wish.title;
      $('#todoDueDate').value = wish.date || '';
      $('#todoWishId').innerHTML = wishOptions(wish.id);
      $('#todoNotes').value = wish.note || '';
      const wishTodoMore = $('#sharedTodos .plus-form-more');
      if (wishTodoMore) wishTodoMore.open = true;
      $('#todoTitle').focus({ preventScroll: true });
    }, 260);
  });

  document.addEventListener('ours:data-changed', () => {
    renderTodoModule();
    renderGifts();
    renderPreferences();
  });
  function safeLink(value) {
    try {
      const url = new URL(String(value || ''));
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch {
      return '';
    }
  }

  function renderGifts() {
    const list = $('#giftList');
    if (!list) return;
    const activeCount = gifts.filter((gift) => ['idea', 'planned', 'bought'].includes(gift.status)).length;
    const totalBudget = gifts.filter((gift) => gift.status !== 'given' && gift.budget !== '').reduce((sum, gift) => sum + Number(gift.budget || 0), 0);
    $('#giftCount').textContent = `${activeCount} 个进行中`;
    $('#giftBudgetSummary').textContent = totalBudget ? `计划预算 ¥${totalBudget}` : '还没有设置预算';
    $$('[data-gift-filter]', $('#giftShelf')).forEach((button) => {
      const active = button.dataset.giftFilter === giftFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const filtered = gifts.filter((gift) => {
      if (giftFilter === 'given') return gift.status === 'given';
      if (giftFilter === 'active') return gift.status !== 'given';
      return true;
    }).sort((a, b) => {
      const order = { planned: 0, bought: 1, idea: 2, given: 3 };
      if (a.status !== b.status) return order[a.status] - order[b.status];
      return `${a.date || '9999-12-31'}${b.updatedAt}`.localeCompare(`${b.date || '9999-12-31'}${a.updatedAt}`);
    });
    if (!filtered.length) {
      list.innerHTML = '<div class="plus-empty"><strong>还没有礼物记录</strong><p>先收藏一个灵感，之后再慢慢挑。</p></div>';
      return;
    }
    const labels = { idea: '灵感', planned: '准备中', bought: '已购买', given: '已送出' };
    list.innerHTML = filtered.map((gift) => {
      const link = safeLink(gift.link);
      const recipient = gift.forWhom === 'me' ? '送给我' : gift.forWhom === 'us' ? '给我们' : '送给她';
      return `<article class="plus-gift-card status-${gift.status}" data-gift-id="${escapeHTML(gift.id)}">
        <div class="plus-card-top"><span class="plus-status">${labels[gift.status]}</span><span>${recipient}</span></div>
        <h3>${escapeHTML(gift.title)}</h3>
        <div class="plus-meta"><span>${escapeHTML(gift.occasion || '没有写场合')}</span>${gift.date ? `<span>${escapeHTML(dateLabel(gift.date))}</span>` : ''}${gift.budget !== '' ? `<span>¥${Number(gift.budget)}</span>` : ''}</div>
        ${gift.notes ? `<p>${escapeHTML(gift.notes)}</p>` : ''}
        <div class="plus-card-actions">
          ${link ? `<a href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">打开链接</a>` : ''}
          ${gift.status !== 'given' ? `<button type="button" data-gift-advance="${escapeHTML(gift.id)}">${gift.status === 'idea' ? '开始准备' : gift.status === 'planned' ? '标记已购买' : '标记已送出'}</button>` : ''}
          <button type="button" data-gift-edit="${escapeHTML(gift.id)}">编辑</button>
          <button type="button" data-gift-remove="${escapeHTML(gift.id)}">删除</button>
        </div>
      </article>`;
    }).join('');
  }

  function fillGiftForm(gift = null) {
    editingGiftId = gift?.id || '';
    $('#giftTitle').value = gift?.title || '';
    $('#giftForWhom').value = gift?.forWhom || 'her';
    $('#giftOccasion').value = gift?.occasion || '';
    $('#giftDate').value = gift?.date || '';
    $('#giftBudget').value = gift?.budget ?? '';
    $('#giftStatus').value = gift?.status || 'idea';
    $('#giftLink').value = gift?.link || '';
    $('#giftNotes').value = gift?.notes || '';
    $('#giftSubmit').textContent = gift ? '保存礼物' : '收进礼物清单';
    const giftMore = $('#giftShelf .plus-form-more');
    if (giftMore) giftMore.open = Boolean(gift && (gift.occasion || gift.date || gift.budget !== '' || gift.link || gift.notes));
    $('#giftFormTitle').textContent = gift ? '编辑这个礼物' : '记下一个礼物灵感';
  }

  function saveGiftForm(event) {
    event.preventDefault();
    const title = $('#giftTitle').value.trim();
    if (!title) return;
    const existing = gifts.find((item) => item.id === editingGiftId);
    const record = {
      ...(existing || {}),
      id: existing?.id || uid('gift'),
      title,
      forWhom: $('#giftForWhom').value,
      occasion: $('#giftOccasion').value.trim(),
      date: $('#giftDate').value,
      budget: $('#giftBudget').value === '' ? '' : Math.max(0, Number($('#giftBudget').value) || 0),
      status: $('#giftStatus').value,
      link: safeLink($('#giftLink').value.trim()),
      notes: $('#giftNotes').value.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const snapshot = gifts;
    gifts = existing ? gifts.map((item) => item.id === existing.id ? record : item) : [record, ...gifts];
    if (!saveArray(GIFTS_KEY, gifts)) {
      gifts = snapshot;
      api.toast('礼物保存失败，请检查浏览器存储空间。');
      return;
    }
    fillGiftForm();
    renderGifts();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.toast(existing ? '礼物记录已经更新。' : '已经收进礼物清单。');
  }

  function handleGiftAction(event) {
    const edit = event.target.closest('[data-gift-edit]');
    const remove = event.target.closest('[data-gift-remove]');
    const advance = event.target.closest('[data-gift-advance]');
    const id = edit?.dataset.giftEdit || remove?.dataset.giftRemove || advance?.dataset.giftAdvance;
    const gift = gifts.find((item) => item.id === id);
    if (!gift) return;
    if (edit) { fillGiftForm(gift); return; }
    if (remove) {
      if (!window.confirm(`删除礼物记录“${gift.title}”？`)) return;
      gifts = gifts.filter((item) => item.id !== gift.id);
      saveArray(GIFTS_KEY, gifts);
      renderGifts();
      document.dispatchEvent(new CustomEvent('ours:data-changed'));
      return;
    }
    if (advance) {
      gift.status = { idea: 'planned', planned: 'bought', bought: 'given', given: 'given' }[gift.status] || 'idea';
      gift.updatedAt = new Date().toISOString();
      saveArray(GIFTS_KEY, gifts);
      renderGifts();
      document.dispatchEvent(new CustomEvent('ours:data-changed'));
    }
  }

  function buildGiftSection() {
    if (!lifeView || $('#giftShelf')) return;
    const section = document.createElement('section');
    section.className = 'app-module-section plus-module plus-gifts';
    section.id = 'giftShelf';
    section.innerHTML = `
      <header class="app-module-heading">
        <div><span>Gift notes</span><h2>礼物与惊喜</h2></div>
        <div class="plus-heading-stats"><strong id="giftCount">0 个进行中</strong><small id="giftBudgetSummary">还没有设置预算</small></div>
      </header>
      <form class="plus-form gift-form" id="giftForm">
        <div class="plus-form-title"><strong id="giftFormTitle">记下一个礼物灵感</strong><small>不急着买，先把想到的留住。</small></div>
        <div class="plus-form-grid gift-form-grid">
          <label class="field plus-field-wide">礼物名称<input id="giftTitle" maxlength="60" required placeholder="例如：她提过一次的相机包" /></label>
          <label class="field">送给谁<select id="giftForWhom"><option value="her">送给她</option><option value="me">送给我</option><option value="us">给我们</option></select></label>
          <label class="field">状态<select id="giftStatus"><option value="idea">灵感</option><option value="planned">准备中</option><option value="bought">已购买</option><option value="given">已送出</option></select></label>
        <details class="plus-form-more">
          <summary>场合、日期、预算与链接</summary>
          <div class="plus-form-grid gift-form-grid">
            <label class="field">场合<input id="giftOccasion" maxlength="40" placeholder="生日 / 纪念日 / 没来由" /></label>
            <label class="field">日期<input id="giftDate" type="date" /></label>
            <label class="field">预算<input id="giftBudget" type="number" min="0" step="1" placeholder="可选" /></label>
            <label class="field">商品链接<input id="giftLink" type="url" maxlength="300" placeholder="https://" /></label>
            <label class="field plus-field-wide">备注<input id="giftNotes" maxlength="140" placeholder="尺码、颜色、包装方式……" /></label>
          </div>
        </details>
        </div>
        <div class="plus-form-actions"><button class="text-button" id="giftCancelEdit" type="button">清空</button><button class="primary-button" id="giftSubmit" type="submit">收进礼物清单</button></div>
      </form>
      <div class="plus-toolbar" role="group" aria-label="礼物筛选"><button type="button" data-gift-filter="active" class="is-active">进行中</button><button type="button" data-gift-filter="given">已送出</button><button type="button" data-gift-filter="all">全部</button></div>
      <div class="plus-gift-grid" id="giftList"></div>`;
    const dateIdeas = $('.app-date-ideas', lifeView);
    lifeView.insertBefore(section, dateIdeas || null);
    $('#giftForm').addEventListener('submit', saveGiftForm);
    $('#giftCancelEdit').addEventListener('click', () => fillGiftForm());
    $('#giftShelf').addEventListener('click', (event) => {
      const filter = event.target.closest('[data-gift-filter]');
      if (filter) { giftFilter = filter.dataset.giftFilter; renderGifts(); return; }
      handleGiftAction(event);
    });
    fillGiftForm();
    renderGifts();
  }
  function renderPreferences() {
    const list = $('#preferenceList');
    if (!list) return;
    $$('[data-preference-filter]', $('#preferenceShelf')).forEach((button) => {
      const active = button.dataset.preferenceFilter === preferenceFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    const filtered = preferences.filter((item) => preferenceFilter === 'all' || preferenceFilter === item.person).sort((a, b) => `${a.category}${b.updatedAt}`.localeCompare(`${b.category}${a.updatedAt}`));
    if (!filtered.length) {
      list.innerHTML = '<div class="plus-empty"><strong>还没有偏好记录</strong><p>她随口说过的不喜欢，也值得认真记住。</p></div>';
      return;
    }
    list.innerHTML = filtered.map((item) => `<article class="plus-preference-card type-${item.type}" data-preference-id="${escapeHTML(item.id)}">
      <div class="plus-card-top"><span class="plus-status">${item.person === 'me' ? '我的' : '她的'}${item.type === 'dislike' ? '不喜欢' : '喜欢'}</span><span>${escapeHTML(item.category)}</span></div>
      <h3>${escapeHTML(item.title)}</h3>
      ${item.notes ? `<p>${escapeHTML(item.notes)}</p>` : ''}
      <div class="plus-card-actions"><button type="button" data-preference-edit="${escapeHTML(item.id)}">编辑</button><button type="button" data-preference-remove="${escapeHTML(item.id)}">删除</button></div>
    </article>`).join('');
  }

  function fillPreferenceForm(item = null) {
    editingPreferenceId = item?.id || '';
    $('#preferencePerson').value = item?.person || 'her';
    $('#preferenceType').value = item?.type || 'like';
    $('#preferenceCategory').value = item?.category || '食物';
    $('#preferenceTitle').value = item?.title || '';
    $('#preferenceNotes').value = item?.notes || '';
    $('#preferenceSubmit').textContent = item ? '保存偏好' : '记下来';
  }

  function savePreferenceForm(event) {
    event.preventDefault();
    const title = $('#preferenceTitle').value.trim();
    if (!title) return;
    const existing = preferences.find((item) => item.id === editingPreferenceId);
    const record = {
      ...(existing || {}),
      id: existing?.id || uid('preference'),
      person: $('#preferencePerson').value,
      type: $('#preferenceType').value,
      category: $('#preferenceCategory').value,
      title,
      notes: $('#preferenceNotes').value.trim(),
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const snapshot = preferences;
    preferences = existing ? preferences.map((item) => item.id === existing.id ? record : item) : [record, ...preferences];
    if (!saveArray(PREFERENCES_KEY, preferences)) {
      preferences = snapshot;
      api.toast('偏好保存失败，请检查浏览器存储空间。');
      return;
    }
    fillPreferenceForm();
    renderPreferences();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.toast(existing ? '偏好已经更新。' : '已经记住这件事。');
  }

  function handlePreferenceAction(event) {
    const edit = event.target.closest('[data-preference-edit]');
    const remove = event.target.closest('[data-preference-remove]');
    const id = edit?.dataset.preferenceEdit || remove?.dataset.preferenceRemove;
    const item = preferences.find((entry) => entry.id === id);
    if (!item) return;
    if (edit) fillPreferenceForm(item);
    if (remove) {
      if (!window.confirm(`删除偏好“${item.title}”？`)) return;
      preferences = preferences.filter((entry) => entry.id !== item.id);
      saveArray(PREFERENCES_KEY, preferences);
      renderPreferences();
      document.dispatchEvent(new CustomEvent('ours:data-changed'));
    }
  }

  function drawGiftDecision() {
    const likes = preferences.filter((item) => item.person === 'her' && item.type === 'like');
    const ideas = gifts.filter((gift) => gift.forWhom === 'her' && ['idea', 'planned'].includes(gift.status));
    const output = $('#giftDecisionResult');
    if (!output) return;
    if (!likes.length && !ideas.length) {
      decisionText = '先记下她喜欢的一件小事，或收藏一个礼物灵感，我再帮你搭一个方向。';
    } else {
      const like = likes.length ? likes[Math.floor(Math.random() * likes.length)] : null;
      const gift = ideas.length ? ideas[Math.floor(Math.random() * ideas.length)] : null;
      decisionText = gift && like ? `可以从“${gift.title}”开始，再顺着她喜欢的“${like.title}”准备一个小细节。` : gift ? `这次先看看“${gift.title}”，把它慢慢准备成惊喜。` : `她喜欢“${like.title}”，可以围绕这个方向挑一份礼物。`;
    }
    output.textContent = decisionText;
    output.classList.remove('is-revealed');
    void output.offsetWidth;
    output.classList.add('is-revealed');
  }

  function buildPreferenceSection() {
    if (!lifeView || $('#preferenceShelf')) return;
    const section = document.createElement('section');
    section.className = 'app-module-section plus-module plus-preferences';
    section.id = 'preferenceShelf';
    section.innerHTML = `
      <header class="app-module-heading">
        <div><span>Little things we remember</span><h2>我们的喜好</h2></div>
        <small>把随口说过的小事记下来，不必每次都重新问。</small>
      </header>
      <form class="plus-form preference-form" id="preferenceForm">
        <div class="plus-form-grid preference-form-grid">
          <label class="field">是谁<select id="preferencePerson"><option value="her">她的</option><option value="me">我的</option></select></label>
          <label class="field">类型<select id="preferenceType"><option value="like">喜欢</option><option value="dislike">不喜欢</option></select></label>
          <label class="field">分类<select id="preferenceCategory"><option>食物</option><option>礼物</option><option>体验</option><option>习惯</option><option>其他</option></select></label>
          <label class="field plus-field-wide">具体内容<input id="preferenceTitle" maxlength="60" required placeholder="例如：不喜欢香菜 / 喜欢木质香" /></label>
          <label class="field plus-field-wide">备注<input id="preferenceNotes" maxlength="120" placeholder="补充一点背景" /></label>
        </div>
        <div class="plus-form-actions"><button class="text-button" id="preferenceCancelEdit" type="button">清空</button><button class="primary-button" id="preferenceSubmit" type="submit">记下来</button></div>
      </form>
      <div class="plus-toolbar" role="group" aria-label="喜好筛选"><button type="button" data-preference-filter="all" class="is-active">全部</button><button type="button" data-preference-filter="her">她的</button><button type="button" data-preference-filter="me">我的</button></div>
      <div class="plus-preference-grid" id="preferenceList"></div>
      <div class="plus-decision">
        <div><span>Gift compass</span><h3>不知道送什么时，先从这里开始。</h3><p id="giftDecisionResult">把礼物灵感和她喜欢的事放在一起，会更容易找到方向。</p></div>
        <button type="button" id="giftDecisionButton">帮我找一个方向</button>
      </div>`;
    const giftSection = $('#giftShelf', lifeView);
    if (giftSection) giftSection.insertAdjacentElement('afterend', section);
    else lifeView.appendChild(section);
    $('#preferenceForm').addEventListener('submit', savePreferenceForm);
    $('#preferenceCancelEdit').addEventListener('click', () => fillPreferenceForm());
    $('#giftDecisionButton').addEventListener('click', drawGiftDecision);
    $('#preferenceShelf').addEventListener('click', (event) => {
      const filter = event.target.closest('[data-preference-filter]');
      if (filter) { preferenceFilter = filter.dataset.preferenceFilter; renderPreferences(); return; }
      handlePreferenceAction(event);
    });
    fillPreferenceForm();
    renderPreferences();
  }

  function initTogetherPlus() {
    buildTodoSection();
    buildHomeTodoCard();
    buildGiftSection();
    buildPreferenceSection();
    renderTodoModule();
    renderGifts();
    renderPreferences();
    document.dispatchEvent(new CustomEvent('ours:plus-ready'));
    window.requestAnimationFrame(() => window.OURS_APP_SHELL?.renderRoute({ focus: false, animate: false }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTogetherPlus, { once: true });
  else initTogetherPlus();

  window.OURS_PLUS = {
    getTodos: () => todos.slice(),
    getGifts: () => gifts.slice(),
    getPreferences: () => preferences.slice(),
    saveTodos: () => saveArray(TODOS_KEY, todos),
  };
})();
