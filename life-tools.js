(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const api = window.OURS_FEATURES_API;
  const store = window.OURS_STORE;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const EVENTS_KEY = 'ours-events-v1';
  const REMINDERS_KEY = 'ours-reminders-v1';
  const WEEKLY_MENU_KEY = 'ours-weekly-menu-v1';
  const BACKUP_META_KEY = 'ours-backup-meta-v1';
  const TODOS_KEY = 'ours-todos-v1';
  const GIFTS_KEY = 'ours-gifts-v1';
  const PREFERENCES_KEY = 'ours-preferences-v1';
  const STATUS_LABELS = { planned: '待计划', confirmed: '已确认', completed: '已完成', cancelled: '已取消' };
  const MEALS = { lunch: '午餐', dinner: '晚餐' };
  const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const defaultReminderSettings = () => ({
    anniversary: { enabled: true, days: [0, 7] },
    birthday: { enabled: true, days: [0, 7] },
    nextMeeting: { enabled: true, days: [0, 1] },
    events: { enabled: true, days: [0, 1] },
    wishes: { enabled: true, days: [0, 3] },
    todos: { enabled: true, days: [0, 1] },
    custom: [],
  });

  const todayISO = () => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };
  const parseDate = (value) => {
    const [year, month, day] = String(value || '').split('-').map(Number);
    return year && month && day ? new Date(year, month - 1, day) : null;
  };
  const dateToISO = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const addDays = (date, count) => {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    result.setDate(result.getDate() + count);
    return result;
  };
  const startOfWeek = (date) => {
    const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return addDays(result, -((result.getDay() + 6) % 7));
  };
  const formatDate = (value) => {
    const date = typeof value === 'string' ? parseDate(value) : value;
    return date ? new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date) : '';
  };
  const dayDiff = (a, b) => Math.round((new Date(a.getFullYear(), a.getMonth(), a.getDate()) - new Date(b.getFullYear(), b.getMonth(), b.getDate())) / 86400000);
  const annualDate = (month, day, base = new Date()) => {
    const year = base.getFullYear();
    let target = new Date(year, Number(month) - 1, Number(day));
    if (Number(month) === 2 && Number(day) === 29 && target.getMonth() !== 1) target = new Date(year, 1, 28);
    if (dayDiff(target, base) < 0) {
      target = new Date(year + 1, Number(month) - 1, Number(day));
      if (Number(month) === 2 && Number(day) === 29 && target.getMonth() !== 1) target = new Date(year + 1, 1, 28);
    }
    return target;
  };
  const normalizeDays = (days) => [...new Set((Array.isArray(days) ? days : [days]).map(Number).filter((day) => Number.isFinite(day) && day >= 0 && day <= 365))].sort((a, b) => a - b);

  function loadEvents() {
    const value = store.getJSON(EVENTS_KEY, []);
    if (!Array.isArray(value)) return [];
    return value.filter((event) => event && event.id && event.title && event.date).map((event) => ({
      ...event,
      allDay: Boolean(event.allDay),
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      status: STATUS_LABELS[event.status] ? event.status : 'planned',
      budget: event.budget === '' || event.budget == null ? '' : Number(event.budget) || 0,
      actualCost: event.actualCost === '' || event.actualCost == null ? '' : Number(event.actualCost) || 0,
      prepItems: Array.isArray(event.prepItems) ? event.prepItems.filter((item) => item && item.text) : [],
      reminderDays: normalizeDays(event.reminderDays || [0]),
      reminderEnabled: event.reminderEnabled !== false,
      todoId: event.todoId || '',
    }));
  }

  function loadReminderSettings() {
    const saved = store.getJSON(REMINDERS_KEY, null);
    const defaults = defaultReminderSettings();
    if (!saved || typeof saved !== 'object') return defaults;
    const merged = { ...defaults, ...saved };
    ['anniversary', 'birthday', 'nextMeeting', 'events', 'wishes', 'todos'].forEach((key) => {
      merged[key] = {
        enabled: saved[key]?.enabled !== false,
        days: normalizeDays(saved[key]?.days || defaults[key].days),
      };
    });
    merged.custom = Array.isArray(saved.custom) ? saved.custom.filter((item) => item && item.id && item.title && item.date).map((item) => ({ ...item, days: normalizeDays(item.days || [0]) })) : [];
    return merged;
  }

  let events = loadEvents();
  let reminderSettings = loadReminderSettings();
  let calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  let scheduleView = 'calendar';
  let scheduleStatus = 'all';
  let weeklyMenu = store.getJSON(WEEKLY_MENU_KEY, null);
  if (!weeklyMenu || typeof weeklyMenu !== 'object') weeklyMenu = { weekStart: dateToISO(startOfWeek(new Date())), slots: {} };
  if (!weeklyMenu.slots || typeof weeklyMenu.slots !== 'object') weeklyMenu.slots = {};

  const weekDates = (weekStart = weeklyMenu.weekStart) => Array.from({ length: 7 }, (_, index) => addDays(parseDate(weekStart), index));
  const nextEvent = () => events.filter((event) => ['planned', 'confirmed'].includes(event.status) && event.date >= todayISO()).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`))[0] || null;
  const eventStatusLabel = (event) => STATUS_LABELS[event.status] || '待计划';

  function saveEvents() { return store.setJSON(EVENTS_KEY, events); }
  function saveReminderSettings() { return store.setJSON(REMINDERS_KEY, reminderSettings); }
  function saveWeeklyMenu() { return store.setJSON(WEEKLY_MENU_KEY, weeklyMenu); }

  function migrateLegacyNextMeeting() {
    const legacyDate = store.getJSON('ours-next-meeting-v1', null);
    if (!legacyDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(legacyDate))) return;
    const sameDate = events.find((event) => event.date === legacyDate && ['planned', 'confirmed'].includes(event.status));
    const systemEvent = events.find((event) => event.id === 'legacy-next-meeting');
    if (systemEvent) {
      if (systemEvent.date !== legacyDate && !sameDate) {
        systemEvent.date = legacyDate;
        systemEvent.updatedAt = new Date().toISOString();
        saveEvents();
      }
      return;
    }
    if (sameDate) return;
    events.push({
      id: 'legacy-next-meeting', title: '下次见面', date: legacyDate, allDay: true,
      startTime: '', endTime: '', placeName: '', address: '', notes: '由旧版“下次见面”日期自动迁移。',
      status: 'confirmed', budget: '', actualCost: '', prepItems: [], wishId: '', memoryId: '',
      reminderEnabled: true, reminderDays: [0, 1], source: 'next-meeting',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    saveEvents();
  }

  function syncNextMeeting() {
    const upcoming = nextEvent();
    store.setJSON('ours-next-meeting-v1', upcoming?.date || null);
    api.refreshNextMeeting?.();
  }
  function collectDerivedReminders() {
    const now = new Date(todayISO());
    const result = [];
    const push = (type, title, date, days, id, notes = '') => {
      if (!date) return;
      const parsed = typeof date === 'string' ? parseDate(date) : date;
      if (!parsed) return;
      const lead = normalizeDays(days);
      const trigger = addDays(parsed, -Math.max(...lead, 0));
      if (dayDiff(parsed, now) < -1 || dayDiff(trigger, now) > 90) return;
      result.push({ id, type, title, date: typeof date === 'string' ? date : dateToISO(parsed), triggerDate: dateToISO(trigger), days: lead, notes });
    };
    const profile = store.getJSON('ours-profile-v1', {}) || {};
    const config = window.OURS_CONFIG;
    if (reminderSettings.anniversary?.enabled) {
      const start = profile.relationshipStart ? parseDate(profile.relationshipStart) : null;
      push('anniversary', '恋爱纪念日', annualDate(start ? start.getMonth() + 1 : 5, start ? start.getDate() : 20), reminderSettings.anniversary.days, 'anniversary');
    }
    if (reminderSettings.birthday?.enabled) {
      push('birthday', '她的生日', annualDate(profile.birthdayMonth || config.birthday.month, profile.birthdayDay || config.birthday.day), reminderSettings.birthday.days, 'birthday');
    }
    if (reminderSettings.nextMeeting?.enabled) {
      const upcoming = nextEvent();
      if (upcoming) push('event', upcoming.title, upcoming.date, reminderSettings.nextMeeting.days, `meeting-${upcoming.id}`, upcoming.placeName || '');
    }
    if (reminderSettings.events?.enabled) {
      events.filter((event) => ['planned', 'confirmed'].includes(event.status) && event.reminderEnabled).forEach((event) => {
        push('event', event.title, event.date, event.reminderDays, `event-${event.id}`, event.placeName || '');
      });
    }
    if (reminderSettings.wishes?.enabled) {
      api.getWishes().filter((wish) => !wish.done && wish.date).forEach((wish) => {
        push('wish', wish.title, wish.date, reminderSettings.wishes.days, `wish-${wish.id}`);
      });
    }
    if (reminderSettings.todos?.enabled) {
      const todos = store.getJSON(TODOS_KEY, []);
      if (Array.isArray(todos)) todos.filter((todo) => todo && todo.status !== 'done' && todo.dueDate).forEach((todo) => {
        push('todo', todo.title, todo.dueDate, reminderSettings.todos.days, `todo-${todo.id}`, todo.notes || '');
      });
    }
    reminderSettings.custom.forEach((item) => {
      if (item.enabled !== false) push('custom', item.title, item.date, item.days || [0], item.id, item.note || '');
    });
    const unique = new Map();
    result.forEach((item) => unique.set(`${item.type}-${item.id}-${item.date}`, item));
    return [...unique.values()].sort((a, b) => a.triggerDate.localeCompare(b.triggerDate));
  }

  function syncEventMemoryLinks() {
    const memories = api.getAllMemories();
    let changed = false;
    events.forEach((event) => {
      const memory = memories.find((item) => item.eventId === event.id);
      if (memory && event.memoryId !== memory.id) {
        event.memoryId = memory.id;
        changed = true;
      }
    });
    if (changed) saveEvents();
  }
  function fillWishSelect(selectedId = '') {
    const select = $('#eventWishSelect');
    if (!select) return;
    const wishes = api.getWishes().filter((wish) => !wish.done);
    select.innerHTML = '<option value="">不关联</option>' + wishes.map((wish) => `<option value="${escapeHTML(wish.id)}">${escapeHTML(wish.title)}</option>`).join('');
    select.value = selectedId || '';
  }

  function openEventEditor(id = null, prefill = {}) {
    const event = id ? events.find((item) => item.id === id) : null;
    const source = event || prefill;
    const prepItemsText = Array.isArray(source.prepItems)
      ? source.prepItems.map((item) => (typeof item === 'string' ? item : item.text)).filter(Boolean).join('\n')
      : (source.prepItems || '');
    $('#eventForm').reset();
    $('#eventId').value = event?.id || prefill.id || '';
    $('#eventTodoId').value = event?.todoId || prefill.todoId || '';
    $('#eventEditorTitle').textContent = event ? '编辑这次计划' : '安排一次约会';
    $('#eventTitle').value = source.title || '';
    $('#eventDate').value = source.date || todayISO();
    $('#eventAllDay').checked = source.allDay !== false;
    $('#eventStatus').value = source.status || 'planned';
    $('#eventStartTime').value = source.startTime || '';
    $('#eventEndTime').value = source.endTime || '';
    $('#eventPlaceName').value = source.placeName || '';
    $('#eventAddress').value = source.address || '';
    $('#eventNotes').value = source.notes || '';
    $('#eventBudget').value = source.budget ?? '';
    $('#eventActualCost').value = source.actualCost ?? '';
    $('#eventPrepItems').value = prepItemsText;
    $('#eventReminderDays').value = String(source.reminderDays?.join(',') || '0,1');
    if (![...$('#eventReminderDays').options].some((option) => option.value === $('#eventReminderDays').value)) $('#eventReminderDays').value = '0';
    fillWishSelect(source.wishId || '');
    $('#deleteEvent').hidden = !event;
    const hasAdvancedDetails = [source.budget, source.actualCost].some((value) => value !== '' && value != null)
      || Boolean(source.prepItems?.length || source.wishId);
    $('.event-advanced').open = hasAdvancedDetails;
    toggleEventTimeFields();
    $('#eventFormFeedback').textContent = '';
    api.openDialog($('#eventEditorLayer'), $('.event-editor'));
    window.setTimeout(() => $('#eventTitle').focus({ preventScroll: true }), 80);
  }
  function closeEventEditor() {
    api.closeDialog($('#eventEditorLayer'), $('.event-editor'));
  }

  function toggleEventTimeFields() {
    $('#eventTimeFields').hidden = $('#eventAllDay').checked;
  }

  function eventFromForm() {
    const previous = events.find((event) => event.id === $('#eventId').value);
    const title = $('#eventTitle').value.trim();
    const date = $('#eventDate').value;
    if (!title || !date) throw new Error('标题和日期都要填写。');
    const startTime = $('#eventAllDay').checked ? '' : $('#eventStartTime').value;
    const endTime = $('#eventAllDay').checked ? '' : $('#eventEndTime').value;
    if (startTime && endTime && endTime < startTime) throw new Error('结束时间不能早于开始时间。');
    const previousPrep = new Map((previous?.prepItems || []).map((item) => [item.text, item]));
    const prepItems = $('#eventPrepItems').value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((text) => ({
      id: previousPrep.get(text)?.id || uid('prep'), text, done: Boolean(previousPrep.get(text)?.done),
    }));
    return {
      id: previous?.id || uid('event'), title, date,
      allDay: $('#eventAllDay').checked, startTime, endTime,
      placeName: $('#eventPlaceName').value.trim(), address: $('#eventAddress').value.trim(),
      notes: $('#eventNotes').value.trim(), status: $('#eventStatus').value,
      budget: $('#eventBudget').value === '' ? '' : Math.max(0, Number($('#eventBudget').value) || 0),
      actualCost: $('#eventActualCost').value === '' ? '' : Math.max(0, Number($('#eventActualCost').value) || 0),
      prepItems, wishId: $('#eventWishSelect').value, todoId: previous?.todoId || $('#eventTodoId').value || '',
      memoryId: previous?.memoryId || '', source: previous?.source || 'manual',
      reminderEnabled: true, reminderDays: normalizeDays($('#eventReminderDays').value.split(',')),
      createdAt: previous?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
  }

  function saveEventForm(event) {
    event.preventDefault();
    let record;
    try { record = eventFromForm(); }
    catch (error) {
      $('#eventFormFeedback').textContent = error.message;
      api.toast(error.message);
      return;
    }
    const snapshot = events.map((item) => ({ ...item }));
    const index = events.findIndex((item) => item.id === record.id);
    if (index >= 0) events[index] = record;
    else events.push(record);
    if (!saveEvents()) {
      events = snapshot;
      $('#eventFormFeedback').textContent = '日程保存失败，请检查浏览器存储空间。';
      api.toast('日程保存失败，请检查浏览器存储空间。');
      return;
    }
    if (record.status === 'completed' && record.wishId) {
      const wish = api.getWishes().find((item) => item.id === record.wishId);
      if (wish && !wish.done && window.confirm(`这次约会已完成，是否同步把愿望“${wish.title}”标记为完成？`)) {
        wish.done = true;
        wish.completedAt = record.date;
        if (!api.saveWishes?.()) api.toast('约会已保存，但愿望状态同步失败。');
      }
    }
    closeEventEditor();
    syncNextMeeting();
    renderSchedule();
    renderHomeWeek();
    renderReminders();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.toast(index >= 0 ? '这次计划已经更新。' : '约会已经写进我们的日程。');
  }

  function deleteEventById(id) {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    if (!window.confirm(`删除“${event.title}”？关联的回忆不会一起删除。`)) return;
    const snapshot = events.slice();
    events = events.filter((item) => item.id !== id);
    if (!saveEvents()) {
      events = snapshot;
      api.toast('删除失败，请检查浏览器存储空间。');
      return;
    }
    closeEventEditor();
    syncNextMeeting();
    renderSchedule();
    renderHomeWeek();
    renderReminders();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.toast('这次日程已经删除，关联回忆仍保留。');
  }

  function duplicateEvent(id) {
    const event = events.find((item) => item.id === id);
    if (!event) return;
    openEventEditor(null, {
      ...event, id: '', title: `${event.title}（副本）`, memoryId: '', todoId: '',
      prepItems: event.prepItems.map((item) => item.text).join('\n'),
    });
  }
  function filteredEvents() {
    return events.filter((event) => scheduleStatus === 'all' || event.status === scheduleStatus).slice().sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
  }

  function eventMapUrl(event) {
    const query = event.address || event.placeName;
    return query ? `https://map.baidu.com/search/${encodeURIComponent(query)}` : '';
  }

  function renderEventCard(event) {
    const prepDone = event.prepItems.filter((item) => item.done).length;
    const memory = event.memoryId ? api.getAllMemories().find((item) => item.id === event.memoryId) : null;
    return `<article class="schedule-event-card status-${event.status}" data-event-card="${escapeHTML(event.id)}">
      <button class="event-card-main" type="button" data-event-open="${escapeHTML(event.id)}">
        <span class="event-card-date"><time>${escapeHTML(event.date)}</time><i>${event.allDay ? '全天' : `${escapeHTML(event.startTime || '待定')}${event.endTime ? `–${escapeHTML(event.endTime)}` : ''}`}</i></span>
        <span class="event-card-copy"><strong>${escapeHTML(event.title)}</strong><small>${escapeHTML(event.placeName || event.address || '地点待定')} · ${eventStatusLabel(event)}</small></span>
        <span class="event-card-status">${escapeHTML(eventStatusLabel(event))}</span>
      </button>
      ${event.prepItems.length ? `<div class="event-prep">${event.prepItems.map((item) => `<label><input type="checkbox" data-prep-event="${escapeHTML(event.id)}" data-prep-id="${escapeHTML(item.id)}" ${item.done ? 'checked' : ''} /><span>${escapeHTML(item.text)}</span></label>`).join('')}<small>${prepDone}/${event.prepItems.length} 项准备完成</small></div>` : ''}
      <div class="event-card-actions">
        ${event.budget !== '' ? `<span>预算 ¥${escapeHTML(event.budget)}${event.actualCost !== '' ? ` · 实花 ¥${escapeHTML(event.actualCost)}` : ''}</span>` : '<span></span>'}
        ${eventMapUrl(event) ? `<a href="${escapeHTML(eventMapUrl(event))}" target="_blank" rel="noopener noreferrer">地图 ↗</a>` : ''}
        <button type="button" data-event-copy="${escapeHTML(event.id)}">复制</button>
        <button type="button" data-event-remove="${escapeHTML(event.id)}">删除</button>
        <button type="button" data-event-memory="${escapeHTML(event.id)}">${memory ? '查看回忆' : event.status === 'completed' ? '收进回忆' : '留下回忆'}</button>
      </div>
    </article>`;
  }

  function renderCalendar() {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const first = new Date(year, month, 1);
    const gridStart = startOfWeek(first);
    const filtered = filteredEvents();
    $('#calendarMonthLabel').textContent = `${year} 年 ${month + 1} 月`;
    const cells = [];
    for (let index = 0; index < 42; index += 1) {
      const date = addDays(gridStart, index);
      const iso = dateToISO(date);
      const dayEvents = filtered.filter((event) => event.date === iso);
      cells.push(`<div class="calendar-cell ${date.getMonth() !== month ? 'is-outside' : ''} ${iso === todayISO() ? 'is-today' : ''}" data-calendar-date="${iso}">
        <button class="calendar-day-number" type="button" data-event-add-date="${iso}" aria-label="在 ${iso} 添加日程">${date.getDate()}</button>
        <div class="calendar-events">${dayEvents.slice(0, 3).map((event) => `<button type="button" class="calendar-event status-${event.status}" data-event-open="${escapeHTML(event.id)}"><span>${escapeHTML(event.title)}</span><small>${event.allDay ? '全天' : escapeHTML(event.startTime || '')}</small></button>`).join('')}${dayEvents.length > 3 ? `<small>还有 ${dayEvents.length - 3} 项</small>` : ''}</div>
      </div>`);
    }
    $('#scheduleCalendar').innerHTML = `<div class="calendar-weekdays">${['一', '二', '三', '四', '五', '六', '日'].map((day) => `<span>周${day}</span>`).join('')}</div><div class="calendar-grid">${cells.join('')}</div>`;
  }

  function renderScheduleList() {
    const upcoming = filteredEvents().filter((event) => event.status !== 'cancelled');
    $('#scheduleList').innerHTML = upcoming.length ? upcoming.map(renderEventCard).join('') : '<div class="empty-state"><strong>这段时间还没有计划</strong><p>安排一次见面，让下一次期待有具体的日期。</p><button type="button" data-event-add>安排第一次约会</button></div>';
  }

  function renderSchedule() {
    $('#scheduleCalendar').hidden = scheduleView !== 'calendar';
    $('#scheduleList').hidden = scheduleView !== 'list';
    $$('#scheduleViewToggle button').forEach((button) => button.classList.toggle('is-active', button.dataset.scheduleView === scheduleView));
    if (scheduleView === 'calendar') renderCalendar();
    else renderScheduleList();
  }

  function togglePrepItem(eventId, prepId, checked) {
    const event = events.find((item) => item.id === eventId);
    const prep = event?.prepItems.find((item) => item.id === prepId);
    if (!prep) return;
    prep.done = checked;
    event.updatedAt = new Date().toISOString();
    saveEvents();
    renderSchedule();
  }

  function memoryFromEvent(eventId) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    if (event.memoryId) {
      const linked = api.getAllMemories().find((memory) => memory.id === event.memoryId);
      if (linked) { api.openMemoryById(linked.id); return; }
      event.memoryId = '';
      saveEvents();
    }
    const existing = api.getAllMemories().find((memory) => memory.eventId === event.id);
    if (existing) { event.memoryId = existing.id; saveEvents(); api.openMemoryById(existing.id); return; }
    api.openMemoryEditor(null, {
      title: event.title, date: event.date, location: event.placeName || event.address || '',
      text: event.notes || '这一天被认真安排，也被认真记住。', eventId: event.id,
    });
  }
  const icsDate = (date) => (date instanceof Date ? dateToISO(date) : String(date).slice(0, 10)).replace(/-/g, '');
  const icsTime = (date, time) => `${icsDate(date)}T${String(time || '09:00').replace(':', '')}00`;
  const icsEscape = (text) => String(text || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const icsStamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  function eventIcsLines(event) {
    const lines = ['BEGIN:VEVENT', `UID:${event.id}@ours.local`, `DTSTAMP:${icsStamp()}`];
    if (event.allDay) lines.push(`DTSTART;VALUE=DATE:${icsDate(event.date)}`);
    else {
      lines.push(`DTSTART:${icsTime(event.date, event.startTime || '09:00')}`);
      if (event.endTime) lines.push(`DTEND:${icsTime(event.date, event.endTime)}`);
    }
    lines.push(`SUMMARY:${icsEscape(event.title)}`);
    if (event.placeName || event.address) lines.push(`LOCATION:${icsEscape([event.placeName, event.address].filter(Boolean).join(' '))}`);
    if (event.notes) lines.push(`DESCRIPTION:${icsEscape(event.notes)}`);
    lines.push(`STATUS:${event.status === 'cancelled' ? 'CANCELLED' : event.status === 'confirmed' ? 'CONFIRMED' : 'TENTATIVE'}`);
    if (event.reminderEnabled) event.reminderDays.forEach((days) => {
      lines.push('BEGIN:VALARM', `TRIGGER:-P${days}D`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(event.title)}`, 'END:VALARM');
    });
    lines.push('END:VEVENT');
    return lines;
  }

  function annualIcsLines(title, date, uidValue) {
    return ['BEGIN:VEVENT', `UID:${uidValue}@ours.local`, `DTSTAMP:${icsStamp()}`, `DTSTART;VALUE=DATE:${icsDate(date)}`, 'RRULE:FREQ=YEARLY', `SUMMARY:${icsEscape(title)}`, 'TRANSP:TRANSPARENT', 'END:VEVENT'];
  }

  function downloadIcs(filename, eventLines) {
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OURS//Private Calendar//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...eventLines, 'END:VCALENDAR'];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportCalendar() {
    const included = filteredEvents().filter((event) => event.status !== 'cancelled');
    if (!included.length) { api.toast('还没有可以导出的日程。'); return; }
    downloadIcs(`OURS-calendar-${todayISO()}.ics`, included.flatMap((event) => eventIcsLines(event)));
    api.toast(`已导出 ${included.length} 个日程，时间按当前设备本地时区写入。`);
  }

  function exportReminderCalendar() {
    const lines = [];
    const profile = store.getJSON('ours-profile-v1', {}) || {};
    const config = window.OURS_CONFIG;
    const start = profile.relationshipStart ? parseDate(profile.relationshipStart) : null;
    lines.push(...annualIcsLines('恋爱纪念日', annualDate(start ? start.getMonth() + 1 : 5, start ? start.getDate() : 20), 'anniversary'));
    lines.push(...annualIcsLines('她的生日', annualDate(profile.birthdayMonth || config.birthday.month, profile.birthdayDay || config.birthday.day), 'birthday'));
    events.filter((event) => ['planned', 'confirmed'].includes(event.status)).forEach((event) => lines.push(...eventIcsLines(event)));
    api.getWishes().filter((wish) => !wish.done && wish.date).forEach((wish) => {
      lines.push('BEGIN:VEVENT', `UID:wish-${wish.id}@ours.local`, `DTSTAMP:${icsStamp()}`, `DTSTART;VALUE=DATE:${icsDate(wish.date)}`, `SUMMARY:${icsEscape(wish.title)}`, 'END:VEVENT');
    });
    if (reminderSettings.todos?.enabled) {
      const todos = store.getJSON(TODOS_KEY, []);
      if (Array.isArray(todos)) todos.filter((todo) => todo && todo.status !== 'done' && todo.dueDate).forEach((todo) => {
        lines.push('BEGIN:VEVENT', `UID:todo-${todo.id}@ours.local`, `DTSTAMP:${icsStamp()}`, `DTSTART;VALUE=DATE:${icsDate(todo.dueDate)}`, `SUMMARY:${icsEscape(todo.title)}`);
        if (todo.notes) lines.push(`DESCRIPTION:${icsEscape(todo.notes)}`);
        reminderSettings.todos.days.forEach((days) => lines.push('BEGIN:VALARM', `TRIGGER:-P${days}D`, 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(todo.title)}`, 'END:VALARM'));
        lines.push('END:VEVENT');
      });
    }
    reminderSettings.custom.filter((item) => item.enabled !== false).forEach((item) => {
      lines.push('BEGIN:VEVENT', `UID:${item.id}@ours.local`, `DTSTAMP:${icsStamp()}`, `DTSTART;VALUE=DATE:${icsDate(item.date)}`, `SUMMARY:${icsEscape(item.title)}`);
      if (item.note) lines.push(`DESCRIPTION:${icsEscape(item.note)}`);
      lines.push('END:VEVENT');
    });
    downloadIcs(`OURS-reminders-${todayISO()}.ics`, lines);
    api.toast('提醒日历已经导出，可在系统日历中继续设置通知。');
  }
  function renderWeeklyMenu() {
    const grid = $('#weeklyMenuGrid');
    if (!grid) return;
    const current = weekDates();
    const range = `${formatDate(current[0]).replace(/周.*$/, '')} — ${formatDate(current[6])}`;
    $('#weeklyMenuRange').textContent = `${range} · 午餐与晚餐`;
    const dishes = api.allDishes();
    grid.innerHTML = current.map((date) => {
      const iso = dateToISO(date);
      const dayMeals = Object.entries(MEALS).map(([meal, label]) => {
        const slot = weeklyMenu.slots[`${iso}|${meal}`];
        const dish = slot?.dishId ? dishes.find((item) => item.id === slot.dishId) : null;
        const name = slot?.tempName || dish?.name || '';
        return `<button class="weekly-slot ${name ? 'has-meal' : ''}" type="button" data-weekly-slot="${iso}|${meal}">
          <span>${label}</span><strong>${escapeHTML(name || '＋ 安排')}</strong>${slot ? `<small>${escapeHTML(String(slot.servings || 2))} 人${slot.note ? ` · ${escapeHTML(slot.note)}` : ''}</small>` : ''}
        </button>`;
      }).join('');
      return `<article class="weekly-day ${iso === todayISO() ? 'is-today' : ''}" data-week-date="${iso}"><header><strong>${DAY_NAMES[date.getDay()]}</strong><time>${date.getMonth() + 1}/${date.getDate()}</time></header>${dayMeals}</article>`;
    }).join('');
  }

  function openWeeklySlot(key) {
    const [date, meal] = key.split('|');
    const slot = weeklyMenu.slots[key] || {};
    const dishes = api.allDishes();
    $('#weeklySlotKey').value = key;
    $('#weeklySlotTitle').textContent = `${formatDate(date)} · ${MEALS[meal] || '用餐'}`;
    $('#weeklyDishSelect').innerHTML = '<option value="">临时菜品 / 不选菜谱</option>' + dishes.map((dish) => `<option value="${escapeHTML(dish.id)}">${escapeHTML(dish.name)} · ${escapeHTML(dish.category)}</option>`).join('');
    $('#weeklyDishSelect').value = slot.dishId || '';
    $('#weeklyTempDish').value = slot.tempName || '';
    $('#weeklyTempIngredients').value = (slot.tempIngredients || []).join('\n');
    $('#weeklyServings').value = String(slot.servings || 2);
    $('#weeklyMealNote').value = slot.note || '';
    $('#removeWeeklySlot').hidden = !weeklyMenu.slots[key];
    api.openDialog($('#weeklySlotLayer'), $('.weekly-slot-dialog'));
  }

  function closeWeeklySlot() {
    api.closeDialog($('#weeklySlotLayer'), $('.weekly-slot-dialog'));
  }

  function saveWeeklySlot(event) {
    event.preventDefault();
    const key = $('#weeklySlotKey').value;
    if (!key) return;
    const dishId = $('#weeklyDishSelect').value;
    const tempName = $('#weeklyTempDish').value.trim();
    if (!dishId && !tempName) { api.toast('请选择一道菜，或写下临时菜品。'); return; }
    weeklyMenu.slots[key] = {
      dishId, tempName: dishId ? '' : tempName,
      tempIngredients: (dishId ? '' : $('#weeklyTempIngredients').value).split(/\r?\n/).map((line) => line.trim()).filter(Boolean),
      servings: Math.max(1, Number($('#weeklyServings').value) || 2),
      note: $('#weeklyMealNote').value.trim(), updatedAt: new Date().toISOString(),
    };
    if (!saveWeeklyMenu()) { api.toast('本周菜单保存失败，请检查存储空间。'); return; }
    closeWeeklySlot();
    renderWeeklyMenu();
    renderHomeWeek();
    api.toast('这一餐已经写进本周菜单。');
  }

  function removeWeeklySlot() {
    const key = $('#weeklySlotKey').value;
    delete weeklyMenu.slots[key];
    saveWeeklyMenu();
    closeWeeklySlot();
    renderWeeklyMenu();
    renderHomeWeek();
    api.toast('这一餐已经移除。');
  }

  function changeWeek(offset) {
    const start = addDays(parseDate(weeklyMenu.weekStart), offset * 7);
    weeklyMenu.weekStart = dateToISO(start);
    saveWeeklyMenu();
    renderWeeklyMenu();
  }

  function generateWeeklyShopping() {
    const dishes = api.allDishes();
    const currentDates = new Set(weekDates().map((date) => dateToISO(date)));
    const selections = Object.entries(weeklyMenu.slots).filter(([key]) => currentDates.has(key.split('|')[0])).map(([key, slot]) => {
      const dish = slot.dishId ? dishes.find((item) => item.id === slot.dishId) : null;
      if (dish) return { dishId: dish.id, servings: slot.servings };
      if (slot.tempIngredients?.length) return { id: key, ingredients: slot.tempIngredients, category: '其他' };
      return null;
    }).filter(Boolean);
    if (!selections.length) { api.toast('本周菜单还是空的。'); return; }
    api.generateShoppingFromSelections?.(selections);
    renderHomeWeek();
  }

  function startTodayCooking() {
    const iso = todayISO();
    const dishes = api.allDishes();
    const dishId = Object.keys(MEALS).map((meal) => weeklyMenu.slots[`${iso}|${meal}`]?.dishId).find(Boolean);
    const dish = dishes.find((item) => item.id === dishId);
    if (!dish) { api.toast('今天还没有安排可做的现有菜谱。'); return; }
    window.OURS_APP?.openDish?.(dish.id);
    window.setTimeout(() => window.OURS_SECOND_PASS_API?.openCookingMode?.(dish.id), 260);
  }
  function homeUpcomingEvent() {
    return nextEvent();
  }

  function renderHomeWeek() {
    const grid = $('#todayWeekGrid');
    if (!grid) return;
    const now = new Date();
    const weekEnd = addDays(now, 7);
    const upcoming = events.filter((event) => ['planned', 'confirmed'].includes(event.status) && event.date >= todayISO() && parseDate(event.date) <= weekEnd).sort((a, b) => `${a.date}${a.startTime}`.localeCompare(`${b.date}${b.startTime}`));
    const todayMeals = Object.entries(MEALS).map(([meal, label]) => {
      const slot = weeklyMenu.slots[`${todayISO()}|${meal}`];
      if (!slot) return null;
      const dish = slot.dishId ? api.allDishes().find((item) => item.id === slot.dishId) : null;
      return `${label}：${slot.tempName || dish?.name || '待定'}`;
    }).filter(Boolean);
    const shopping = api.getShopping?.() || [];
    const remainingShopping = shopping.filter((item) => !item.checked).length;
    const pendingWish = api.getWishes().filter((wish) => !wish.done).sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')))[0];
    const memory = api.getAllMemories().find((item) => !item.seed || item.updatedAt);
    const profile = store.getJSON('ours-profile-v1', {}) || {};
    const config = window.OURS_CONFIG;
    const start = profile.relationshipStart ? parseDate(profile.relationshipStart) : null;
    const anniversary = annualDate(start ? start.getMonth() + 1 : 5, start ? start.getDate() : 20);
    const next = homeUpcomingEvent();
    const weekDateSet = new Set(weekDates().map((date) => dateToISO(date)));
    const plannedMeals = Object.entries(weeklyMenu.slots).filter(([key]) => weekDateSet.has(key.split('|')[0]));
    $('#todayWeekDate').textContent = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(now);
    const dueReminders = collectDerivedReminders().filter((item) => item.triggerDate <= todayISO());
    if ($('#openRemindersFromHome')) $('#openRemindersFromHome').textContent = `提醒中心${dueReminders.length ? ` · ${dueReminders.length}` : ''} ↗`;
    grid.innerHTML = `
      <button class="today-card today-card-wide" type="button" data-home-action="event">
        <span>下一次计划</span><strong>${next ? escapeHTML(next.title) : '还没有安排'}</strong>
        <small>${next ? `${formatDate(next.date)}${next.startTime && !next.allDay ? ` · ${escapeHTML(next.startTime)}` : ''}${next.placeName ? ` · ${escapeHTML(next.placeName)}` : ''}` : '把想见面的日子写进日程'}</small>
      </button>
      <button class="today-card" type="button" data-home-action="reminders">
        <span>最近的纪念日</span><strong>${dayDiff(anniversary, now)} 天</strong><small>${formatDate(anniversary)}</small>
      </button>
      <button class="today-card" type="button" data-home-action="weekly">
        <span>本周菜单</span><strong>${plannedMeals.length} 餐已安排</strong><small>${todayMeals.join(' · ') || '今天还没有安排菜'}</small>
      </button>
      <button class="today-card" type="button" data-home-action="shopping">
        <span>买菜进度</span><strong>${remainingShopping} 项待买</strong><small>${shopping.length ? `${shopping.length - remainingShopping}/${shopping.length} 已购买` : '从菜单生成本周清单'}</small>
      </button>
      <button class="today-card" type="button" data-home-action="wish">
        <span>待完成愿望</span><strong>${pendingWish ? escapeHTML(pendingWish.title) : '还没有愿望'}</strong><small>${pendingWish?.date ? `计划 ${escapeHTML(pendingWish.date)}` : '写一件想一起做的事'}</small>
      </button>
      <button class="today-card today-card-memory" type="button" data-home-action="memory">
        <span>最近的真实回忆</span><strong>${memory ? escapeHTML(memory.title) : '相册还没有照片'}</strong><small>${memory ? `${escapeHTML(memory.date)} · ${escapeHTML(memory.location || '我们的回忆')}` : '添加第一段回忆'}</small>
      </button>`;
    const meta = store.getJSON(BACKUP_META_KEY, null);
    const hasData = Boolean(memory || events.length || api.getWishes().some((wish) => wish.createdAt) || shopping.length);
    const stale = !meta?.lastExportedAt || (Date.now() - new Date(meta.lastExportedAt).getTime()) > 30 * 86400000;
    const nudge = $('#backupNudge');
    if (nudge) {
      nudge.hidden = !(hasData && stale);
      nudge.innerHTML = meta?.lastExportedAt
        ? `上次备份是 ${new Date(meta.lastExportedAt).toLocaleDateString('zh-CN')}。私人照片只在这台设备上，建议定期导出。 <button type="button" data-backup-export>现在备份</button>`
        : '还没有导出过备份。换手机或清除浏览器数据前，请先保存一份。 <button type="button" data-backup-export>现在备份</button>';
    }
  }

  const reminderTypeLabel = { anniversary: '纪念日', birthday: '生日', event: '约会', wish: '愿望', todo: '待办', custom: '自定义' };
  const sourceLabels = { anniversary: '恋爱纪念日', birthday: '生日', nextMeeting: '下次见面', events: '已确认约会', wishes: '有日期的愿望', todos: '有截止日期的待办' };

  function renderReminders() {
    const body = $('#remindersBody');
    if (!body) return;
    const reminders = collectDerivedReminders();
    const activeSources = Object.keys(sourceLabels).map((key) => {
      const setting = reminderSettings[key];
      return `<div class="reminder-source-row"><div><strong>${sourceLabels[key]}</strong><small>${setting.enabled ? '应用内显示并导出到日历' : '已关闭'}</small></div><label><input type="checkbox" data-reminder-source="${key}" ${setting.enabled ? 'checked' : ''} />开启</label><div class="reminder-day-options">${[0, 1, 3, 7].map((days) => `<label><input type="checkbox" data-reminder-day="${key}|${days}" ${setting.days.includes(days) ? 'checked' : ''} />${days === 0 ? '当天' : `${days} 天前`}</label>`).join('')}</div></div>`;
    }).join('');
    body.innerHTML = `<p class="reminder-disclaimer">这里只做应用内提示，不会伪装成系统通知。导出 .ics 后，提醒时间由系统日历负责。每年生日与纪念日使用本地日期，2 月 29 日在非闰年按 2 月 28 日显示。</p>
      <div class="reminder-list">${reminders.length ? reminders.map((item) => `<article class="reminder-item reminder-${item.type}"><span>${reminderTypeLabel[item.type] || '提醒'}</span><div><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.date)}${item.notes ? ` · ${escapeHTML(item.notes)}` : ''}</small></div><b>${dayDiff(parseDate(item.triggerDate), new Date(todayISO())) === 0 ? '今天提醒' : `${dayDiff(parseDate(item.triggerDate), new Date(todayISO()))} 天后`}</b></article>`).join('') : '<div class="empty-state"><strong>近期没有提醒</strong><p>纪念日、约会和有日期的愿望会出现在这里。</p></div>'}</div>
      <details class="reminder-settings" open><summary>提醒设置</summary>${activeSources}</details>
      <form class="custom-reminder-form" id="customReminderForm"><h3>添加自定义提醒</h3><div class="form-grid"><label class="field">名称<input id="customReminderTitle" maxlength="50" required placeholder="例如：给妈妈买生日礼物" /></label><label class="field">日期<input id="customReminderDate" type="date" required /></label></div><div class="form-grid"><label class="field">提前天数<input id="customReminderDays" type="number" min="0" max="365" value="0" /></label><label class="field">备注<input id="customReminderNote" maxlength="80" placeholder="可选" /></label></div><button class="text-button" type="submit">加入提醒 <span>＋</span></button></form>
      <div class="custom-reminder-list">${reminderSettings.custom.map((item) => `<div class="custom-reminder-item"><input type="checkbox" data-custom-enabled="${escapeHTML(item.id)}" ${item.enabled !== false ? 'checked' : ''} /><span>${escapeHTML(item.title)} · ${escapeHTML(item.date)}</span><button type="button" data-custom-remove="${escapeHTML(item.id)}">×</button></div>`).join('')}</div>`;
  }
  function fuzzyMatch(text, query) {
    const haystack = String(text || '').toLowerCase();
    const needle = String(query || '').toLowerCase();
    if (!needle) return true;
    if (haystack.includes(needle)) return true;
    let index = 0;
    for (const character of haystack) {
      if (character === needle[index]) index += 1;
      if (index === needle.length) return true;
    }
    return false;
  }

  function highlightText(text, query) {
    const escaped = escapeHTML(text);
    if (!query) return escaped;
    const safe = escapeHTML(query).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try { return escaped.replace(new RegExp(safe, 'gi'), (match) => `<mark>${match}</mark>`); }
    catch { return escaped; }
  }

  function collectSearchItems() {
    const results = [];
api.getAllMemories().filter((memory) => !memory.seed || memory.updatedAt).forEach((memory) => results.push({ type: 'memory', id: memory.id, title: memory.title, subtitle: `${memory.date} · ${memory.location || '回忆'} · ${memory.text || ''}`, date: memory.date, status: memory.favorite ? '已收藏' : '已保存', searchText: `${memory.title} ${memory.location || ''} ${memory.text || ''} ${Array.isArray(memory.tags) ? memory.tags.join(' ') : ''}` }));
    api.allDishes().forEach((dish) => results.push({ type: 'dish', id: dish.id, title: dish.name, subtitle: `${dish.category} · ${dish.ingredients.join(' · ')}`, date: '', status: dish.category, searchText: `${dish.name} ${dish.en || ''} ${dish.category} ${dish.desc || ''} ${dish.ingredients.join(' ')} ${dish.flavor || ''}` }));
    api.getWishes().forEach((wish) => results.push({ type: 'wish', id: wish.id, title: wish.title, subtitle: wish.note || wish.date || '共同愿望', date: wish.date || '', status: wish.done ? '已完成' : '待完成', searchText: `${wish.title} ${wish.note || ''} ${wish.date || ''}` }));
    const searchTodos = store.getJSON(TODOS_KEY, []);
    if (Array.isArray(searchTodos)) searchTodos.forEach((todo) => results.push({ type: 'todo', id: todo.id, title: todo.title, subtitle: `${todo.dueDate || '没有截止日期'} · ${todo.status === 'done' ? '已完成' : '待完成'}`, date: todo.dueDate || '', status: todo.status === 'done' ? '已完成' : '待完成', searchText: `${todo.title} ${todo.notes || ''} ${todo.dueDate || ''}` }));
    const searchGifts = store.getJSON(GIFTS_KEY, []);
    if (Array.isArray(searchGifts)) searchGifts.forEach((gift) => results.push({ type: 'gift', id: gift.id, title: gift.title, subtitle: `${gift.occasion || '礼物灵感'} · ${gift.status === 'given' ? '已送出' : gift.status === 'bought' ? '已购买' : '灵感中'}`, date: gift.date || '', status: gift.status || 'idea', searchText: `${gift.title} ${gift.occasion || ''} ${gift.notes || ''} ${gift.link || ''}` }));
    const searchPreferences = store.getJSON(PREFERENCES_KEY, []);
    if (Array.isArray(searchPreferences)) searchPreferences.forEach((item) => results.push({ type: 'preference', id: item.id, title: item.title, subtitle: `${item.person === 'me' ? '我的' : '她的'}${item.type === 'dislike' ? '不喜欢' : '喜欢'} · ${item.category || '其他'}`, date: '', status: item.type === 'dislike' ? '不喜欢' : '喜欢', searchText: `${item.title} ${item.notes || ''} ${item.category || ''}` }));
    events.forEach((event) => results.push({ type: 'event', id: event.id, title: event.title, subtitle: `${event.date} · ${event.placeName || event.address || '地点待定'} · ${eventStatusLabel(event)}`, date: event.date, status: eventStatusLabel(event), searchText: `${event.title} ${event.placeName || ''} ${event.address || ''} ${event.notes || ''} ${eventStatusLabel(event)}` }));
    const notes = store.getJSON('ours-daily-notes-v1', []);
    if (Array.isArray(notes)) notes.forEach((note) => results.push({ type: 'note', id: note.id, title: note.text.slice(0, 36), subtitle: `${note.date} · 每日心里话`, date: note.date || '', status: '日记', searchText: `${note.text} ${note.date || ''}` }));
    const dishes = api.allDishes();
    const cooking = api.getCooking();
    dishes.forEach((dish) => (cooking[dish.id]?.logs || []).forEach((log) => results.push({ type: 'cooking', id: log.id, title: dish.name, subtitle: `${log.date} · ${log.rating || '—'} 分 · ${log.notes || '做菜记录'}`, date: log.date, status: '已烹饪', searchText: `${dish.name} ${log.notes || ''} ${log.feedback || ''} ${log.date}`, dishId: dish.id })));
    return results;
  }

  function searchItems() {
    const query = $('#globalSearchInput').value.trim();
    const type = $('#searchTypeFilter').value;
    const from = $('#searchDateFrom').value;
    const to = $('#searchDateTo').value;
    const status = $('#searchStatus').value.trim().toLowerCase();
    const hasFilter = Boolean(query || from || to || status || type !== 'all');
    if (!hasFilter) return [];
    return collectSearchItems().filter((item) => {
      if (type !== 'all' && item.type !== type) return false;
      if (from && (!item.date || item.date < from)) return false;
      if (to && (!item.date || item.date > to)) return false;
      if (status && !fuzzyMatch(`${item.status} ${item.subtitle}`, status)) return false;
      return fuzzyMatch(`${item.title} ${item.subtitle} ${item.searchText}`, query);
    }).slice(0, 80);
  }

  function renderSearchResults() {
    const container = $('#searchResults');
    if (!container) return;
    const query = $('#globalSearchInput').value.trim();
    const results = searchItems();
    if (!query && !$('#searchDateFrom').value && !$('#searchDateTo').value && $('#searchTypeFilter').value === 'all' && !$('#searchStatus').value.trim()) {
      container.innerHTML = '<div class="empty-state"><strong>从一个关键词开始</strong><p>试试“海边”“番茄”“生日”或一个月份。加密情书内容不会进入搜索索引。</p></div>';
      return;
    }
    if (!results.length) {
      container.innerHTML = '<div class="empty-state"><strong>没有找到相关记录</strong><p>可以换一个关键词，或放宽类型和日期筛选。</p></div>';
      return;
    }
    const typeLabels = { memory: '回忆', dish: '菜谱', wish: '愿望', event: '日程', note: '心里话', cooking: '做菜记录', todo: '待办', gift: '礼物', preference: '喜好' };
    container.innerHTML = results.map((item) => `<button class="search-result" type="button" data-search-type="${item.type}" data-search-id="${escapeHTML(item.id)}" ${item.dishId ? `data-search-dish="${escapeHTML(item.dishId)}"` : ''}><span>${typeLabels[item.type]}</span><div><strong>${highlightText(item.title, query)}</strong><small>${highlightText(item.subtitle, query)}</small></div><b>${escapeHTML(item.date || '')}</b></button>`).join('');
  }

  function openSearch() {
    const wasMenu = document.body.classList.contains('menu-open');
    if (wasMenu) $('#menuToggle')?.click();
    window.setTimeout(() => {
      api.openDialog($('#searchLayer'), $('.search-dialog'));
      renderSearchResults();
      window.setTimeout(() => $('#globalSearchInput').focus({ preventScroll: true }), 80);
    }, wasMenu ? 90 : 0);
  }

  function closeSearch() { api.closeDialog($('#searchLayer'), $('.search-dialog')); }

  function openSearchResult(button) {
    const type = button.dataset.searchType;
    const id = button.dataset.searchId;
    closeSearch();
    if (type === 'memory') api.openMemoryById(id);
    if (type === 'dish') window.OURS_APP?.openDish?.(id);
    if (type === 'event') window.setTimeout(() => openEventEditor(id), 120);
    if (type === 'todo') {
      window.OURS_APP_SHELL?.navigate('plans', 'sharedTodos');
      window.setTimeout(() => document.querySelector(`[data-todo-id="${CSS.escape(id)}"]`)?.classList.add('is-search-target'), 260);
    }
    if (type === 'gift') {
      window.OURS_APP_SHELL?.navigate('life', 'giftShelf');
      window.setTimeout(() => document.querySelector(`[data-gift-id="${CSS.escape(id)}"]`)?.classList.add('is-search-target'), 260);
    }
    if (type === 'preference') {
      window.OURS_APP_SHELL?.navigate('life', 'preferenceShelf');
      window.setTimeout(() => document.querySelector(`[data-preference-id="${CSS.escape(id)}"]`)?.classList.add('is-search-target'), 260);
    }
    if (type === 'wish') document.dispatchEvent(new CustomEvent('ours:focus-wish', { detail: { id } }));
    if (type === 'cooking') window.OURS_APP?.openDish?.(button.dataset.searchDish);
    if (type === 'note') {
      const note = $(`[data-note-id="${CSS.escape(id)}"]`);
      $('#daily')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      window.setTimeout(() => note?.classList.add('is-focused-note'), 300);
    }
  }
  function bindSchedule() {
    $('#addEvent')?.addEventListener('click', () => openEventEditor());
    $('#openReminders')?.addEventListener('click', () => { renderReminders(); api.openDialog($('#remindersLayer'), $('.reminders-dialog')); });
    $('#openRemindersFromHome')?.addEventListener('click', () => { renderReminders(); api.openDialog($('#remindersLayer'), $('.reminders-dialog')); });
    $('#closeEventEditor')?.addEventListener('click', closeEventEditor);
    $('#cancelEventEditor')?.addEventListener('click', closeEventEditor);
    $('#eventEditorBackdrop')?.addEventListener('click', closeEventEditor);
    $('#eventForm')?.addEventListener('submit', saveEventForm);
    $('#eventAllDay')?.addEventListener('change', toggleEventTimeFields);
    $('#deleteEvent')?.addEventListener('click', () => deleteEventById($('#eventId').value));
    $('#scheduleViewToggle')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-schedule-view]');
      if (!button) return;
      scheduleView = button.dataset.scheduleView;
      renderSchedule();
    });
    $('#schedulePrevMonth')?.addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1); renderCalendar(); });
    $('#scheduleNextMonth')?.addEventListener('click', () => { calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1); renderCalendar(); });
    $('#scheduleToday')?.addEventListener('click', () => { calendarDate = new Date(new Date().getFullYear(), new Date().getMonth(), 1); renderCalendar(); });
    $('#scheduleStatusFilter')?.addEventListener('change', (event) => { scheduleStatus = event.target.value; renderSchedule(); });
    $('#exportCalendarIcs')?.addEventListener('click', exportCalendar);
    document.body.addEventListener('click', (event) => {
      const open = event.target.closest('[data-event-open]');
      if (open) { openEventEditor(open.dataset.eventOpen); return; }
      const addDate = event.target.closest('[data-event-add-date]');
      if (addDate) { openEventEditor(null, { date: addDate.dataset.eventAddDate }); return; }
      if (event.target.closest('[data-event-add]')) { openEventEditor(); return; }
      const copy = event.target.closest('[data-event-copy]');
      if (copy) { duplicateEvent(copy.dataset.eventCopy); return; }
      const remove = event.target.closest('[data-event-remove]');
      if (remove) { deleteEventById(remove.dataset.eventRemove); return; }
      const memory = event.target.closest('[data-event-memory]');
      if (memory) { memoryFromEvent(memory.dataset.eventMemory); return; }
    });
    document.addEventListener('change', (event) => {
      const prep = event.target.closest('[data-prep-event]');
      if (prep) togglePrepItem(prep.dataset.prepEvent, prep.dataset.prepId, prep.checked);
    });
    document.addEventListener('ours:open-event', (event) => {
      if (event.detail?.id) openEventEditor(event.detail.id);
      else if (event.detail?.prefill) openEventEditor(null, event.detail.prefill);
    });
    document.addEventListener('ours:plan-wish', (event) => {
      const wish = api.getWishes().find((item) => item.id === event.detail?.id);
      if (wish) openEventEditor(null, { title: wish.title, notes: wish.note || '', wishId: wish.id });
    });
    $('#planDateIdea')?.addEventListener('click', () => {
      const title = $('#dateIdeaText').textContent.trim().replace(/^[“”"']|[“”"']$/g, '');
      if (!title || title.startsWith('先按下按钮')) return;
      openEventEditor(null, { title, notes: '来自约会盲盒', status: 'planned' });
    });
    $('#drawDateIdea')?.addEventListener('click', () => window.setTimeout(() => { const button = $('#planDateIdea'); if (button) button.disabled = false; }, 120));
  }

  function bindWeeklyMenu() {
    $('#weeklyMenuGrid')?.addEventListener('click', (event) => {
      const slot = event.target.closest('[data-weekly-slot]');
      if (slot) openWeeklySlot(slot.dataset.weeklySlot);
    });
    $('#closeWeeklySlot')?.addEventListener('click', closeWeeklySlot);
    $('#cancelWeeklySlot')?.addEventListener('click', closeWeeklySlot);
    $('#weeklySlotBackdrop')?.addEventListener('click', closeWeeklySlot);
    $('#weeklySlotForm')?.addEventListener('submit', saveWeeklySlot);
    $('#removeWeeklySlot')?.addEventListener('click', removeWeeklySlot);
    $('#generateWeeklyShopping')?.addEventListener('click', generateWeeklyShopping);
    $('#openTodayCooking')?.addEventListener('click', startTodayCooking);
    $('#weeklyPrevWeek')?.addEventListener('click', () => changeWeek(-1));
    $('#weeklyNextWeek')?.addEventListener('click', () => changeWeek(1));
  }

  function bindHomeQuickActions() {
    document.addEventListener('click', (event) => {
      const quick = event.target.closest('[data-quick-add]');
      if (quick) {
        const type = quick.dataset.quickAdd;
        if (type === 'memory') api.openMemoryEditor();
        if (type === 'event') openEventEditor();
        if (type === 'wish') { $('#wishes')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => $('#wishInput')?.focus({ preventScroll: true }), 450); }
        if (type === 'recipe') { $('#menu')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => $('#addCustomDish')?.click(), 450); }
        if (type === 'note') { $('#daily')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); window.setTimeout(() => $('#dailyNoteInput')?.focus({ preventScroll: true }), 450); }
        return;
      }
      const card = event.target.closest('[data-home-action]');
      if (card) {
        const action = card.dataset.homeAction;
        if (action === 'event') { const next = homeUpcomingEvent(); if (next) openEventEditor(next.id); else openEventEditor(); }
        if (action === 'reminders') { renderReminders(); api.openDialog($('#remindersLayer'), $('.reminders-dialog')); }
        if (action === 'weekly') $('#weeklyMenuCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (action === 'shopping') { api.renderShopping?.(); api.openDialog($('#shoppingLayer'), $('#shoppingDrawer')); }
        if (action === 'wish') $('#wishes')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (action === 'memory') { const memory = api.getAllMemories().find((item) => !item.seed || item.updatedAt); if (memory) api.openMemoryById(memory.id); else api.openMemoryEditor(); }
        return;
      }
      if (event.target.closest('[data-backup-export]')) $('#exportData')?.click();
    });
  }
  function closeReminders() { api.closeDialog($('#remindersLayer'), $('.reminders-dialog')); }

  function bindReminders() {
    $('#closeReminders')?.addEventListener('click', closeReminders);
    $('#remindersBackdrop')?.addEventListener('click', closeReminders);
    $('#exportRemindersIcs')?.addEventListener('click', exportReminderCalendar);
    $('#remindersBody')?.addEventListener('change', (event) => {
      const source = event.target.closest('[data-reminder-source]');
      if (source) {
        reminderSettings[source.dataset.reminderSource].enabled = source.checked;
        saveReminderSettings();
        renderReminders();
        renderHomeWeek();
        return;
      }
      const dayOption = event.target.closest('[data-reminder-day]');
      if (dayOption) {
        const [key, day] = dayOption.dataset.reminderDay.split('|');
        const nextDays = new Set(reminderSettings[key].days);
        if (dayOption.checked) nextDays.add(Number(day));
        else nextDays.delete(Number(day));
        reminderSettings[key].days = normalizeDays([...nextDays]);
        saveReminderSettings();
        renderReminders();
        renderHomeWeek();
        return;
      }
      const custom = event.target.closest('[data-custom-enabled]');
      if (custom) {
        const item = reminderSettings.custom.find((entry) => entry.id === custom.dataset.customEnabled);
        if (item) item.enabled = custom.checked;
        saveReminderSettings();
        renderReminders();
        renderHomeWeek();
      }
    });
    $('#remindersBody')?.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-custom-remove]');
      if (!remove) return;
      reminderSettings.custom = reminderSettings.custom.filter((item) => item.id !== remove.dataset.customRemove);
      saveReminderSettings();
      renderReminders();
      renderHomeWeek();
    });
    $('#remindersBody')?.addEventListener('submit', (event) => {
      if (event.target.id !== 'customReminderForm') return;
      event.preventDefault();
      const title = $('#customReminderTitle').value.trim();
      const date = $('#customReminderDate').value;
      if (!title || !date) return;
      reminderSettings.custom.push({ id: uid('reminder'), title, date, days: normalizeDays([Number($('#customReminderDays').value) || 0]), note: $('#customReminderNote').value.trim(), enabled: true });
      saveReminderSettings();
      renderReminders();
      renderHomeWeek();
      api.toast('自定义提醒已经加入。');
    });
  }

  function bindSearch() {
    $('#openSearch')?.addEventListener('click', openSearch);
    $('#openSearchMobile')?.addEventListener('click', openSearch);
    $('#closeSearch')?.addEventListener('click', closeSearch);
    $('#searchBackdrop')?.addEventListener('click', closeSearch);
    let searchTimer = 0;
    const schedule = () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(renderSearchResults, 120); };
    $('#globalSearchInput')?.addEventListener('input', schedule);
    ['searchTypeFilter', 'searchDateFrom', 'searchDateTo', 'searchStatus'].forEach((id) => $(`#${id}`)?.addEventListener('change', renderSearchResults));
    $('#searchResults')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-search-id]');
      if (button) openSearchResult(button);
    });
    document.addEventListener('keydown', (event) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); openSearch(); return;
      }
      if (event.key === '/' && !typing) { event.preventDefault(); openSearch(); return; }
      if (event.key !== 'Escape') return;
      if (!$('#searchLayer').hidden) closeSearch();
      else if (!$('#remindersLayer').hidden) closeReminders();
      else if (!$('#eventEditorLayer').hidden) closeEventEditor();
      else if (!$('#weeklySlotLayer').hidden) closeWeeklySlot();
    });
  }

  function updateProfileBackupMeta() {
    const host = $('.profile-utilities');
    if (!host) return;
    let note = $('#profileBackupMeta');
    if (!note) {
      note = document.createElement('small');
      note.id = 'profileBackupMeta';
      host.appendChild(note);
    }
    const meta = store.getJSON(BACKUP_META_KEY, null);
    note.textContent = meta?.lastExportedAt
      ? `上次导出备份：${new Date(meta.lastExportedAt).toLocaleString('zh-CN')}，约 ${Math.max(1, Math.round((meta.lastExportBytes || 0) / 1024))} KB。`
      : '这台设备还没有导出过备份。';
  }

  function renderAll() {
    syncEventMemoryLinks();
    renderSchedule();
    renderWeeklyMenu();
    renderHomeWeek();
    renderReminders();
    updateProfileBackupMeta();
  }

  function initLifeTools() {
    migrateLegacyNextMeeting();
    syncNextMeeting();
    bindSchedule();
    bindWeeklyMenu();
    bindHomeQuickActions();
    bindReminders();
    bindSearch();
    renderAll();
    document.addEventListener('ours:data-changed', () => {
      syncEventMemoryLinks();
      renderSchedule();
      renderWeeklyMenu();
      renderHomeWeek();
      renderReminders();
      updateProfileBackupMeta();
    });
    const profileBody = $('#profileBody');
    if (profileBody) new MutationObserver(() => window.setTimeout(updateProfileBackupMeta, 0)).observe(profileBody, { childList: true });
    window.setInterval(renderHomeWeek, 60000);
  }

  window.OURS_LIFE_TOOLS = {
    openEventEditor,
    openSearch,
    events: () => events.slice(),
    reminders: collectDerivedReminders,
    renderHomeWeek,
    renderReminders,
    exportCalendar,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initLifeTools, { once: true });
  else initLifeTools();
})();
