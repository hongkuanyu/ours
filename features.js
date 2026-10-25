(() => {
  const config = window.OURS_CONFIG;
  const store = window.OURS_STORE;
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const todayISO = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const parseDate = (value) => {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const dateSerial = (date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
  const dayDiff = (a, b) => dateSerial(a) - dateSerial(b);
  const formatDate = (date) => new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  let toastTimer = 0;
  function toast(message) {
    const element = $('#toast');
    if (!element) return;
    element.textContent = message;
    element.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => element.classList.remove('is-visible'), 2600);
  }

  function openDialog(layer, panel) {
    layer.hidden = false;
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => {
      layer.classList.add('is-open');
      panel.classList.add('is-open');
      panel.setAttribute('aria-hidden', 'false');
      panel.querySelector('.close-button, button, input, textarea')?.focus({ preventScroll: true });
    });
  }

  function closeDialog(layer, panel) {
    layer.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal-open');
    window.setTimeout(() => { layer.hidden = true; }, reducedMotion ? 0 : 320);
  }

  function sparkle(x, y) {
    if (reducedMotion) return;
    const layer = document.createElement('div');
    layer.className = 'confetti-layer';
    for (let index = 0; index < 18; index += 1) {
      const piece = document.createElement('i');
      piece.style.setProperty('--x', `${x}px`);
      piece.style.setProperty('--y', `${y}px`);
      piece.style.setProperty('--dx', `${(Math.random() - .5) * 220}px`);
      piece.style.setProperty('--dy', `${-30 - Math.random() * 160}px`);
      piece.style.setProperty('--r', `${Math.random() * 480}deg`);
      piece.style.background = index % 3 === 0 ? '#722f42' : index % 3 === 1 ? '#b99b6b' : '#e7b9bb';
      layer.appendChild(piece);
    }
    document.body.appendChild(layer);
    window.setTimeout(() => layer.remove(), 1700);
  }

  const dailyQuotes = [
    '今天也想和你一起吃很多很多顿饭。',
    '再普通的一天，有你就不普通。',
    '想把今天存起来，和你以后再慢慢翻看。',
    '喜欢不是一件大事，是每天都有你。',
    '如果日子有味道，今天应该是甜的。',
    '想和你把很多个“下次”变成“已经去过”。',
    '今天也认真喜欢你，没有偷懒。',
    '生活没有滤镜的时候，你是我最想拍下来的部分。',
    '愿我们吵完架以后，还是想坐在同一张桌边。',
    '想和你分享的不只是开心，还有一整天的小事。',
    '爱是记得你不吃什么，也记得你最近想吃什么。',
    '不管今天怎么样，回家以后都有人站在你这边。'
  ];

  function updateRelationshipExtras() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = parseDate(config.relationshipStart);
    const days = Math.max(1, dayDiff(today, start) + 1);
    let anniversary = new Date(today.getFullYear(), start.getMonth(), start.getDate());
    if (anniversary < today) anniversary = new Date(today.getFullYear() + 1, start.getMonth(), start.getDate());
    const nextAnniversary = Math.max(0, dayDiff(anniversary, today));
    const nextDays = $('#nextAnniversaryDays');
    const caption = $('#anniversaryCaption');
    if (nextDays) nextDays.textContent = String(nextAnniversary);
    if (caption) {
      const milestones = { 100: '第 100 天', 365: '一周年', 520: '第 520 天', 1000: '第 1000 天', 1314: '第 1314 天' };
      caption.textContent = milestones[days] ? `${milestones[days]} · 今天值得庆祝` : `下一次纪念日 · ${formatDate(anniversary)}`;
    }
    const quoteIndex = dayDiff(today, new Date(2025, 0, 1)) % dailyQuotes.length;
    const quote = $('#dailyNoteText');
    const quoteDate = $('#dailyNoteDate');
    if (quote) quote.textContent = dailyQuotes[Math.abs(quoteIndex)];
    if (quoteDate) quoteDate.textContent = formatDate(today);
    if ($('#ritualDaysNumber')) $('#ritualDaysNumber').textContent = String(days);
    if ($('#ritualBirthdayDays')) $('#ritualBirthdayDays').textContent = $('#birthdayDays')?.textContent || '—';
    if ($('#ritualBirthdayDateLabel')) $('#ritualBirthdayDateLabel').textContent = $('#birthdayDateLabel')?.textContent || '生日倒计时';
    renderNextMeeting();
  }
  let nextMeeting = store.getJSON('ours-next-meeting-v1', null);

  function renderNextMeeting() {
    const days = $('#nextMeetingDays');
    const label = $('#nextMeetingLabel');
    if (!days || !label) return;
    if (!nextMeeting) {
      days.textContent = '—';
      label.innerHTML = '<button id="setNextMeeting" type="button">设置见面的日子</button>';
      $('#setNextMeeting')?.addEventListener('click', openMeetingDialog);
      return;
    }
    const date = parseDate(nextMeeting);
    const remaining = dayDiff(date, new Date());
    days.textContent = remaining >= 0 ? String(remaining) : '—';
    label.innerHTML = remaining >= 0
      ? `${formatDate(date)} · ${remaining === 0 ? '就是今天' : `再过 ${remaining} 天`} <button id="setNextMeeting" type="button">修改</button>`
      : `${formatDate(date)} 已经过去 <button id="setNextMeeting" type="button">设置新的日期</button>`;
    $('#setNextMeeting')?.addEventListener('click', openMeetingDialog);
  }

  function openMeetingDialog() {
    $('#meetingDate').value = nextMeeting || '';
    openDialog($('#meetingLayer'), $('.mini-dialog'));
  }

  function bindMeeting() {
    $('#meetingForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = $('#meetingDate').value;
      if (!value) return;
      nextMeeting = value;
      store.setJSON('ours-next-meeting-v1', value);
      renderNextMeeting();
      closeDialog($('#meetingLayer'), $('.mini-dialog'));
      toast('见面日期已经记下。');
    });
    $('#clearMeeting').addEventListener('click', () => {
      nextMeeting = null;
      localStorage.removeItem('ours-next-meeting-v1');
      renderNextMeeting();
      closeDialog($('#meetingLayer'), $('.mini-dialog'));
      toast('见面日期已清除。');
    });
    $('#closeMeeting').addEventListener('click', () => closeDialog($('#meetingLayer'), $('.mini-dialog')));
    $('#meetingBackdrop').addEventListener('click', () => closeDialog($('#meetingLayer'), $('.mini-dialog')));
  }

  let dailyNotes = store.getJSON('ours-daily-notes-v1', []);
  if (!Array.isArray(dailyNotes)) dailyNotes = [];

  function renderDailyNotes() {
    const list = $('#dailyNotesList');
    if (!list) return;
    const sorted = [...dailyNotes].sort((a, b) => String(b.date).localeCompare(String(a.date)));
    $('#dailyNotesCount').textContent = String(sorted.length);
    list.innerHTML = sorted.length ? sorted.map((note) => `
      <article class="daily-note-item" data-note-id="${escapeHTML(note.id)}">
        <time datetime="${escapeHTML(note.date)}">${escapeHTML(note.date)}</time>
        <p>${escapeHTML(note.text)}</p>
        <button type="button" aria-label="删除这条记录">×</button>
      </article>
    `).join('') : '<div class="shopping-empty">还没有写下今天的心里话。</div>';
  }

  function bindDailyNotes() {
    $('#dailyNoteEntryDate').value = todayISO();
    $('#dailyNoteForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = $('#dailyNoteInput').value.trim();
      if (!text) return;
      dailyNotes.push({ id: uid('note'), date: $('#dailyNoteEntryDate').value || todayISO(), text, createdAt: new Date().toISOString() });
      if (!store.setJSON('ours-daily-notes-v1', dailyNotes)) {
        toast('保存失败，请检查浏览器存储空间。');
        return;
      }
      $('#dailyNoteInput').value = '';
      renderDailyNotes();
      toast('今天的话已经收进日记。');
      sparkle(window.innerWidth - 80, window.innerHeight - 100);
    });
    $('#dailyNotesList').addEventListener('click', (event) => {
      const item = event.target.closest('[data-note-id]');
      if (!item || !event.target.closest('button')) return;
      dailyNotes = dailyNotes.filter((note) => note.id !== item.dataset.noteId);
      store.setJSON('ours-daily-notes-v1', dailyNotes);
      renderDailyNotes();
    });
  }

  const WISH_KEY = 'ours-supper-wishes-v2';
  let wishes = store.getJSON(WISH_KEY, null);
  if (!Array.isArray(wishes)) {
    wishes = config.wishes.map((wish) => ({
      ...wish, done: false, date: '', note: '', createdAt: todayISO(), completedAt: null,
    }));
  } else {
    wishes = wishes.filter((wish) => wish && wish.id && wish.title).map((wish) => ({
      ...wish,
      done: Boolean(wish.done),
      date: wish.date || '',
      note: wish.note || '',
      createdAt: wish.createdAt || '',
      completedAt: wish.completedAt || null,
    }));
  }

  function saveWishes() {
    return store.setJSON(WISH_KEY, wishes);
  }

  function renderWishes() {
    const list = $('#wishList');
    if (!list) return;
    const complete = wishes.filter((wish) => wish.done).length;
    $('#wishProgress').textContent = `${String(complete).padStart(2, '0')} / ${String(wishes.length).padStart(2, '0')}`;
    $('#wishBar').style.width = `${wishes.length ? complete / wishes.length * 100 : 0}%`;
    list.innerHTML = wishes.map((wish) => `
      <div class="wish-item ${wish.done ? 'is-done' : ''}" data-wish-id="${escapeHTML(wish.id)}">
        <button type="button" aria-label="${wish.done ? '标记为未完成' : '标记为已完成'}"><span>✓</span></button>
        <div><p>${escapeHTML(wish.title)}</p><div class="wish-meta">${wish.date ? `<time>${escapeHTML(wish.date)}</time>` : ''}${wish.note ? `<span>${escapeHTML(wish.note)}</span>` : ''}${wish.completedAt ? `<span>完成于 ${escapeHTML(wish.completedAt)}</span>` : ''}</div></div>
        <small>${wish.done ? 'DONE' : 'TO DO'}</small>
      </div>
    `).join('');
  }

  function addWish(title, note = '', date = '') {
    if (!title) return;
    wishes.push({ id: uid('wish'), title, note, date, done: false, createdAt: todayISO(), completedAt: null });
    saveWishes();
    renderWishes();
    toast('已经放进共同愿望。');
  }

  function bindWishesEnhanced() {
    const list = $('#wishList');
    const form = $('#wishForm');
    const listClone = list.cloneNode(false);
    const formClone = form.cloneNode(true);
    list.replaceWith(listClone);
    form.replaceWith(formClone);
    listClone.addEventListener('click', (event) => {
      const item = event.target.closest('[data-wish-id]');
      if (!item || !event.target.closest('button')) return;
      const wish = wishes.find((entry) => entry.id === item.dataset.wishId);
      if (!wish) return;
      wish.done = !wish.done;
      wish.completedAt = wish.done ? todayISO() : null;
      saveWishes();
      renderWishes();
      if (wish.done) {
        sparkle(event.clientX, event.clientY);
        toast('又完成了一件想一起做的事。');
      }
    });
    formClone.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = $('#wishInput').value.trim();
      if (!title) return;
      addWish(title, $('#wishNote').value.trim(), $('#wishDate').value);
      $('#wishInput').value = '';
      $('#wishNote').value = '';
      $('#wishDate').value = '';
    });
    renderWishes();
  }
  const MEMORY_KEY = 'ours-memories-v1';
  let memoryOverrides = store.getJSON(MEMORY_KEY, []);
  if (!Array.isArray(memoryOverrides)) memoryOverrides = [];
  let visibleMemories = [];
  let activeMemoryId = null;
  let editingMemoryId = null;
  let pendingMemoryBlob = null;
  let memoryYear = '全部';
  let memoryDeleteArmed = false;
  let memoryDeleteTimer = 0;
  const memoryObjectUrls = new Map();

  function getAllMemories() {
    const map = new Map(config.memories.map((memory, index) => [`seed-${index}`, {
      ...memory, id: `seed-${index}`, seed: true,
    }]));
    memoryOverrides.forEach((memory) => {
      if (!memory || !memory.id) return;
      if (memory.deleted) map.delete(memory.id);
      else map.set(memory.id, { ...map.get(memory.id), ...memory });
    });
    return Array.from(map.values()).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  async function memoryImage(memory) {
    if (memory.photoId) {
      if (memoryObjectUrls.has(memory.photoId)) return memoryObjectUrls.get(memory.photoId);
      try {
        const blob = await store.getPhoto(memory.photoId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          memoryObjectUrls.set(memory.photoId, url);
          return url;
        }
      } catch {}
    }
    return memory.src || 'assets/photo-01.svg';
  }

  function compressMemoryImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件。'));
      if (file.size > 12 * 1024 * 1024) return reject(new Error('照片太大，请选择 12MB 以内的图片。'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('照片读取失败。'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('这张照片暂时无法处理。'));
        image.onload = () => {
          const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#f3ece4';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('照片处理失败。')), 'image/jpeg', .82);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function renderMemories() {
    const grid = $('#memoryGrid');
    const filter = $('#memoryYearFilter');
    const all = getAllMemories();
    const years = [...new Set(all.map((memory) => String(memory.date || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    filter.innerHTML = ['全部', ...years].map((year) => `<button type="button" data-year="${year}" class="${memoryYear === year ? 'is-active' : ''}">${year}</button>`).join('');
    const filtered = memoryYear === '全部' ? all : all.filter((memory) => String(memory.date).startsWith(memoryYear));
    visibleMemories = filtered;
    if (all.length) {
      const earliest = all[all.length - 1]?.date || '';
      const latest = all[0]?.date || '';
      $('#memoryDateRange').textContent = `${earliest.slice(0, 4)}—${latest.slice(0, 4)} · ${all.length} 个瞬间`;
    }
    if (!filtered.length) {
      grid.innerHTML = '<div class="shopping-empty">这一年还没有照片，等你来放第一张。</div>';
      return;
    }
    const cards = await Promise.all(filtered.map(async (memory, index) => {
      const image = await memoryImage(memory);
      return `
        <button class="memory-card is-visible" type="button" data-memory-id="${escapeHTML(memory.id)}" aria-label="打开回忆：${escapeHTML(memory.title)}">
          <span class="memory-image"><img src="${escapeHTML(image)}" alt="${escapeHTML(memory.title)}" loading="lazy" /><i>${String(index + 1).padStart(2, '0')}</i></span>
          <span class="memory-copy"><small>${escapeHTML(memory.date)} · ${escapeHTML(memory.location || '没有写地点')}</small><strong>${escapeHTML(memory.title)}</strong><span>${escapeHTML(memory.text || '')}</span><b>打开这一刻 ↗</b></span>
        </button>`;
    }));
    grid.innerHTML = cards.join('');
  }
  async function openMemoryById(id) {
    const memory = visibleMemories.find((item) => item.id === id) || getAllMemories().find((item) => item.id === id);
    if (!memory) return;
    activeMemoryId = id;
    $('#memoryModalImage').src = await memoryImage(memory);
    $('#memoryModalImage').alt = memory.title;
    $('#memoryModalMeta').textContent = `${memory.date} / ${memory.location || '没有写地点'}`;
    $('#memoryModalTitle').textContent = memory.title;
    $('#memoryModalText').textContent = memory.text || '';
    $('#memoryPrev').disabled = visibleMemories.length < 2;
    $('#memoryNext').disabled = visibleMemories.length < 2;
    openDialog($('#memoryLayer'), $('#memoryDialog'));
  }

  function stepMemory(direction) {
    if (!activeMemoryId || visibleMemories.length < 2) return;
    const index = visibleMemories.findIndex((memory) => memory.id === activeMemoryId);
    const next = (index + direction + visibleMemories.length) % visibleMemories.length;
    openMemoryById(visibleMemories[next].id);
  }

  async function openMemoryEditor(id = null) {
    const memory = id ? getAllMemories().find((item) => item.id === id) : null;
    editingMemoryId = memory?.id || null;
    pendingMemoryBlob = null;
    memoryDeleteArmed = false;
    window.clearTimeout(memoryDeleteTimer);
    $('#memoryEditorForm').reset();
    $('#memoryEditorTitle').textContent = memory ? '编辑这段回忆' : '添加一段回忆';
    $('#memoryTitle').value = memory?.title || '';
    $('#memoryDate').value = memory?.date || todayISO();
    $('#memoryLocation').value = memory?.location || '';
    $('#memoryText').value = memory?.text || '';
    $('#memoryImagePreview').src = memory ? await memoryImage(memory) : 'assets/photo-01.svg';
    $('#deleteMemory').textContent = '删除';
    if (!$('#memoryLayer').hidden) closeDialog($('#memoryLayer'), $('#memoryDialog'));
    window.setTimeout(() => openDialog($('#memoryEditorLayer'), $('#memoryEditor')), reducedMotion ? 0 : 180);
  }

  function closeMemoryEditor() {
    closeDialog($('#memoryEditorLayer'), $('#memoryEditor'));
    editingMemoryId = null;
    pendingMemoryBlob = null;
  }

  async function saveMemory(event) {
    event.preventDefault();
    const title = $('#memoryTitle').value.trim();
    const date = $('#memoryDate').value;
    if (!title || !date) {
      toast('标题和日期都要填写。');
      return;
    }
    const existing = editingMemoryId ? getAllMemories().find((item) => item.id === editingMemoryId) : null;
    const id = existing?.id || uid('memory');
    let photoId = existing?.photoId || '';
    if (pendingMemoryBlob) {
      photoId = existing?.photoId || uid('photo');
      try {
        await store.putPhoto(photoId, pendingMemoryBlob);
      } catch {
        toast('照片保存失败，请换一张小一点的照片。');
        return;
      }
    }
    const record = {
      id,
      seed: Boolean(existing?.seed),
      title,
      date,
      location: $('#memoryLocation').value.trim(),
      text: $('#memoryText').value.trim(),
      photoId,
      src: photoId ? '' : (existing?.src || 'assets/photo-01.svg'),
      updatedAt: new Date().toISOString(),
    };
    memoryOverrides = memoryOverrides.filter((memory) => memory.id !== id).concat(record);
    if (!store.setJSON(MEMORY_KEY, memoryOverrides)) {
      toast('回忆保存失败，可能是浏览器存储空间不足。');
      return;
    }
    closeMemoryEditor();
    await renderMemories();
    toast(existing ? '回忆已经更新。' : '这段回忆已经收进相册。');
    window.setTimeout(() => openMemoryById(id), reducedMotion ? 0 : 350);
  }

  function deleteActiveMemory() {
    const memory = getAllMemories().find((item) => item.id === activeMemoryId);
    if (!memory) return;
    const button = $('#deleteMemory');
    if (!memoryDeleteArmed) {
      memoryDeleteArmed = true;
      button.textContent = '再点一次确认删除';
      window.clearTimeout(memoryDeleteTimer);
      memoryDeleteTimer = window.setTimeout(() => {
        memoryDeleteArmed = false;
        button.textContent = '删除';
      }, 2600);
      return;
    }
    memoryOverrides = memoryOverrides.filter((item) => item.id !== memory.id);
    memoryOverrides.push({ id: memory.id, deleted: true });
    store.setJSON(MEMORY_KEY, memoryOverrides);
    if (memory.photoId) store.deletePhoto(memory.photoId).catch(() => {});
    closeDialog($('#memoryLayer'), $('#memoryDialog'));
    activeMemoryId = null;
    renderMemories();
    toast('这段回忆已经从相册移除。');
  }

  function bindMemoriesEnhanced() {
    const legacyGrid = $('#memoryGrid');
    const grid = legacyGrid.cloneNode(false);
    legacyGrid.replaceWith(grid);
    grid.addEventListener('click', (event) => {
      const card = event.target.closest('[data-memory-id]');
      if (card) openMemoryById(card.dataset.memoryId);
    });
    $('#memoryYearFilter').addEventListener('click', (event) => {
      const button = event.target.closest('[data-year]');
      if (!button) return;
      memoryYear = button.dataset.year;
      renderMemories();
    });
    $('#addMemory').addEventListener('click', () => openMemoryEditor());
    $('#memoryImage').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      const preview = $('#memoryImagePreview');
      preview.classList.add('is-loading');
      try {
        pendingMemoryBlob = await compressMemoryImage(file);
        preview.src = URL.createObjectURL(pendingMemoryBlob);
        toast('照片已经准备好。');
      } catch (error) {
        pendingMemoryBlob = null;
        toast(error.message || '照片处理失败。');
      } finally {
        preview.classList.remove('is-loading');
      }
    });
    $('#memoryEditorForm').addEventListener('submit', saveMemory);
    $('#closeMemoryEditor').addEventListener('click', closeMemoryEditor);
    $('#cancelMemoryEditor').addEventListener('click', closeMemoryEditor);
    $('#memoryEditorBackdrop').addEventListener('click', closeMemoryEditor);
    $('#memoryPrev').addEventListener('click', () => stepMemory(-1));
    $('#memoryNext').addEventListener('click', () => stepMemory(1));
    $('#editMemory').addEventListener('click', () => activeMemoryId && openMemoryEditor(activeMemoryId));
    $('#deleteMemory').addEventListener('click', deleteActiveMemory);
    let swipeStart = null;
    $('#memoryDialog').addEventListener('pointerdown', (event) => { swipeStart = event.clientX; });
    $('#memoryDialog').addEventListener('pointerup', (event) => {
      if (swipeStart === null) return;
      const distance = event.clientX - swipeStart;
      swipeStart = null;
      if (Math.abs(distance) > 70) stepMemory(distance > 0 ? -1 : 1);
    });
    renderMemories();
  }
  const COOKING_KEY = 'ours-cooking-v1';
  let cooking = store.getJSON(COOKING_KEY, {});
  if (!cooking || typeof cooking !== 'object') cooking = {};
  const statusLabels = { want: '还没学', practice: '正在练习', done: '我学会啦' };

  function allDishes() {
    return window.OURS_APP?.getAllDishes?.() || [...config.menu, ...(window.OURS_EXTRA_MENU || [])];
  }

  function dishState(id) {
    if (!cooking[id]) cooking[id] = { status: 'want', favorite: false, steps: {}, logs: [] };
    if (!cooking[id].steps) cooking[id].steps = {};
    if (!Array.isArray(cooking[id].logs)) cooking[id].logs = [];
    return cooking[id];
  }

  function saveCooking() {
    return store.setJSON(COOKING_KEY, cooking);
  }

  function decorateDishCards() {
    $$('.dish-card').forEach((card) => {
      const id = card.dataset.dishId;
      const state = dishState(id);
      card.classList.toggle('is-favorite', Boolean(state.favorite));
      const copy = card.querySelector('.dish-copy');
      const foot = copy?.querySelector('.dish-foot');
      if (!copy || !foot) return;
      copy.querySelector('.dish-status-row')?.remove();
      const row = document.createElement('span');
      row.className = 'dish-status-row';
      row.innerHTML = `<span class="dish-status" data-status="${state.status}">${statusLabels[state.status] || statusLabels.want}</span>${state.favorite ? '<span class="dish-favorite-label">♡ 她的最爱</span>' : ''}`;
      foot.before(row);
    });
  }

  function renderCookingDashboard() {
    const dishes = allDishes();
    const counts = { want: 0, practice: 0, done: 0 };
    dishes.forEach((dish) => { counts[dishState(dish.id).status] += 1; });
    $('#cookWantCount').textContent = String(counts.want);
    $('#cookPracticeCount').textContent = String(counts.practice);
    $('#cookDoneCount').textContent = String(counts.done);
    const logs = dishes.flatMap((dish) => dishState(dish.id).logs.map((log) => ({ ...log, dish }))).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    if (logs.length) {
      $('#lastCookedDish').textContent = logs[0].dish.name;
      $('#lastCookedDate').textContent = `${logs[0].date} · ${logs[0].rating} 分`;
    } else {
      $('#lastCookedDish').textContent = '还没有记录';
      $('#lastCookedDate').textContent = '从第一道菜开始';
    }
  }
  function renderDishCookingPanel(id) {
    const dish = allDishes().find((item) => item.id === id);
    if (!dish) return;
    const state = dishState(id);
    $('#dishLearningStatus').value = state.status;
    const favoriteButton = $('#toggleDishFavorite');
    favoriteButton.classList.toggle('is-favorite', state.favorite);
    favoriteButton.innerHTML = state.favorite ? '<span>♥</span> 她的最爱' : '<span>♡</span> 标记她的最爱';
    $('#dishModalSteps').innerHTML = dish.steps.map((step, index) => `
      <li class="${state.steps[index] ? 'is-checked' : ''}"><label><input type="checkbox" data-step-index="${index}" ${state.steps[index] ? 'checked' : ''} /><span>${escapeHTML(step)}</span></label></li>`).join('');
    updateCookProgress(dish);
  }
  function updateCookProgress(dish) {
    const state = dishState(dish.id);
    const total = dish.steps.length;
    const done = Object.values(state.steps).filter(Boolean).length;
    $('#cookStepProgress').textContent = `${done} / ${total} 步`;
    const allDone = total > 0 && done === total;
    $('#cookingJournal').hidden = !allDone;
    if (allDone && state.status === 'want') {
      state.status = 'practice';
      $('#dishLearningStatus').value = 'practice';
      saveCooking();
      decorateDishCards();
      renderCookingDashboard();
    }
  }
  function bindCooking() {
    document.addEventListener('ours:dishes-rendered', () => { decorateDishCards(); renderCookingDashboard(); });
    document.addEventListener('ours:dish-opened', (event) => renderDishCookingPanel(event.detail.id));
    $('#dishLearningStatus').addEventListener('change', (event) => {
      const id = $('#dishModalTitle').dataset.dishId;
      if (!id) return;
      const state = dishState(id);
      state.status = event.target.value;
      saveCooking();
      decorateDishCards();
      renderCookingDashboard();
      toast('学习状态已更新。');
    });
    $('#toggleDishFavorite').addEventListener('click', () => {
      const id = $('#dishModalTitle').dataset.dishId;
      if (!id) return;
      const state = dishState(id);
      state.favorite = !state.favorite;
      saveCooking();
      renderDishCookingPanel(id);
      decorateDishCards();
      toast(state.favorite ? '已经标记为她的最爱。' : '已取消她的最爱标记。');
    });    $('#dishModalSteps').addEventListener('change', (event) => {
      const checkbox = event.target.closest('input[data-step-index]');
      const id = $('#dishModalTitle').dataset.dishId;
      if (!checkbox || !id) return;
      const dish = allDishes().find((item) => item.id === id);
      const state = dishState(id);
      state.steps[checkbox.dataset.stepIndex] = checkbox.checked;
      checkbox.closest('li')?.classList.toggle('is-checked', checkbox.checked);
      saveCooking();
      updateCookProgress(dish);
      decorateDishCards();
      renderCookingDashboard();
    });
    $('#startCooking').addEventListener('click', () => {
      const id = $('#dishModalTitle').dataset.dishId;
      if (!id) return;
      const state = dishState(id);
      state.status = 'practice';
      state.steps = {};
      saveCooking();
      renderDishCookingPanel(id);
      decorateDishCards();
      renderCookingDashboard();
      toast('开始做菜。一步一步来就好。');
    });    $('#resetCookingSteps').addEventListener('click', () => {
      const id = $('#dishModalTitle').dataset.dishId;
      if (!id) return;
      dishState(id).steps = {};
      saveCooking();
      renderDishCookingPanel(id);
    });    $('#finishCooking').addEventListener('click', () => {
      const id = $('#dishModalTitle').dataset.dishId;
      if (!id) return;
      const dish = allDishes().find((item) => item.id === id);
      const state = dishState(id);
      const completed = Object.values(state.steps).filter(Boolean).length;
      if (completed !== dish.steps.length) {
        toast('先把所有步骤勾完，再来记录这次做菜。');
        return;
      }
      state.status = 'done';
      state.logs.unshift({ date: todayISO(), rating: Number($('#cookingRating').value), notes: $('#cookingNotes').value.trim() });
      state.steps = {};
      saveCooking();
      $('#cookingNotes').value = '';
      renderDishCookingPanel(id);
      decorateDishCards();
      renderCookingDashboard();
      sparkle(window.innerWidth / 2, window.innerHeight / 2);
      toast('这道菜完成了，今天又进步一点。');
    });
  }
  const SHOPPING_KEY = 'ours-shopping-v1';
  let shopping = store.getJSON(SHOPPING_KEY, []);
  if (!Array.isArray(shopping)) shopping = [];

  function normalizeIngredient(raw) {
    const parts = String(raw).trim().split(/\s+/);
    return { name: parts.shift() || raw, amount: parts.join(' ') };
  }

  function renderShopping() {
    const list = $('#shoppingList');
    $('#shoppingCount').textContent = String(shopping.filter((item) => !item.checked).length);
    list.innerHTML = shopping.length ? shopping.map((item) => `
      <div class="shopping-item ${item.checked ? 'is-checked' : ''}" data-shopping-id="${escapeHTML(item.id)}">
        <button type="button" data-action="toggle" aria-label="切换购买状态">✓</button>
        <span>${escapeHTML(item.name)}${item.amount ? ` · ${escapeHTML(item.amount)}` : ''}</span>
        <button type="button" data-action="remove" aria-label="移除">×</button>
      </div>`).join('') : '<div class="shopping-empty">清单还是空的。先选几道今晚想吃的菜吧。</div>';
  }

  function saveShopping() {
    return store.setJSON(SHOPPING_KEY, shopping);
  }
  function generateShoppingFromCart() {
    const cart = window.OURS_APP?.getCart?.() || {};
    const dishes = allDishes();
    const merged = new Map();
    Object.entries(cart).forEach(([id, quantity]) => {
      const dish = dishes.find((item) => item.id === id);
      if (!dish) return;
      dish.ingredients.forEach((raw) => {
        const parsed = normalizeIngredient(raw);
        if (!merged.has(parsed.name)) merged.set(parsed.name, { name: parsed.name, amounts: new Set() });
        if (parsed.amount) merged.get(parsed.name).amounts.add(parsed.amount);
      });
    });
    const previous = new Map(shopping.map((item) => [item.name, item]));
    shopping = Array.from(merged.values()).map((entry) => {
      const old = previous.get(entry.name);
      return { id: old?.id || uid('shop'), name: entry.name, amount: Array.from(entry.amounts).join(' + '), checked: old?.checked || false };
    });
    saveShopping();
    renderShopping();
    toast(shopping.length ? '今晚的买菜清单已经生成。' : '今晚的桌还是空的。');
  }
  function bindShopping() {
    $('#openShopping').addEventListener('click', () => { renderShopping(); openDialog($('#shoppingLayer'), $('#shoppingDrawer')); });
    $('#shoppingBackdrop').addEventListener('click', () => closeDialog($('#shoppingLayer'), $('#shoppingDrawer')));
    $('#closeShopping').addEventListener('click', () => closeDialog($('#shoppingLayer'), $('#shoppingDrawer')));
    $('#buildShoppingList').addEventListener('click', generateShoppingFromCart);
    $('#shoppingForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const value = $('#shoppingInput').value.trim();
      if (!value) return;
      const parsed = normalizeIngredient(value);
      shopping.push({ id: uid('shop'), name: parsed.name, amount: parsed.amount, checked: false });
      saveShopping();
      $('#shoppingInput').value = '';
      renderShopping();
    });
    $('#shoppingList').addEventListener('click', (event) => {
      const item = event.target.closest('[data-shopping-id]');
      const action = event.target.closest('[data-action]');
      if (!item || !action) return;
      const entry = shopping.find((value) => value.id === item.dataset.shoppingId);
      if (!entry) return;
      if (action.dataset.action === 'toggle') entry.checked = !entry.checked;
      if (action.dataset.action === 'remove') shopping = shopping.filter((value) => value.id !== entry.id);
      saveShopping();
      renderShopping();
    });    $('#copyShopping').addEventListener('click', async () => {
      const text = `OURS 买菜清单\n${shopping.map((item) => `□ ${item.name}${item.amount ? ` ${item.amount}` : ''}`).join('\n')}`;
      try { await navigator.clipboard.writeText(text); toast('买菜清单已复制。'); }
      catch { toast('复制失败，请手动选择文本。'); }
    });
    $('#clearShopping').addEventListener('click', () => {
      shopping = [];
      saveShopping();
      renderShopping();
      toast('买菜清单已清空。');
    });
    renderShopping();
  }
  const dateIdeas = [
    { title: '去附近散步，不设目的地', hint: '把手机收起来，走到想回家为止。' },
    { title: '一起做一道没做过的菜', hint: '可以从今晚菜单里随机挑一道。' },
    { title: '在家看一部电影', hint: '准备两杯饮料，关灯，把手机调成静音。' },
    { title: '去吃一家没去过的小店', hint: '不查评分，只看哪家灯光让你想走进去。' },
    { title: '互相拍十张照片', hint: '不用摆拍，拍对方认真做事的瞬间。' },
    { title: '找一个安静的地方看日落', hint: '提前十分钟到，带一点喜欢的零食。' },
    { title: '去超市买今晚的食材', hint: '一人挑一样，再一起决定怎么做。' },
    { title: '坐一趟没有坐过的公交', hint: '在喜欢的那一站下车。' }
  ];
  let currentDateIdea = null;
  let savedDateIdeas = store.getJSON('ours-date-ideas-v1', []);
  if (!Array.isArray(savedDateIdeas)) savedDateIdeas = [];

  function drawDateIdea() {
    const pool = dateIdeas.filter((idea) => idea.title !== currentDateIdea?.title);
    currentDateIdea = pool[Math.floor(Math.random() * pool.length)];
    $('#dateIdeaText').textContent = `“${currentDateIdea.title}”`;
    $('#dateIdeaHint').textContent = currentDateIdea.hint;
    $('#saveDateIdea').disabled = false;
    $('#addDateIdeaWish').disabled = false;
    sparkle(window.innerWidth / 2, window.innerHeight / 2);
  }

  function bindDateIdea() {
    $('#drawDateIdea').addEventListener('click', drawDateIdea);
    $('#saveDateIdea').addEventListener('click', () => {
      if (!currentDateIdea) return;
      if (!savedDateIdeas.some((idea) => idea.title === currentDateIdea.title)) {
        savedDateIdeas.push({ ...currentDateIdea, savedAt: todayISO() });
        store.setJSON('ours-date-ideas-v1', savedDateIdeas);
      }
      toast('约会灵感已经收藏。');
    });
    $('#addDateIdeaWish').addEventListener('click', () => {
      if (!currentDateIdea) return;
      addWish(currentDateIdea.title, currentDateIdea.hint);
    });
  }
  const defaultQuestions = [
    { id: 'q1', question: '我们第一次约会，更像哪一种？', options: ['认真吃饭聊天', '紧张得没吃多少', '散步走了很久'] },
    { id: 'q2', question: '她心情不好时，最需要什么？', options: ['安静陪着', '带她去吃好吃的', '听她慢慢说完'] },
    { id: 'q3', question: '下次旅行更想去哪里？', options: ['海边', '山里', '陌生城市'] },    { id: 'q4', question: '我们最适合的约会时间是？', options: ['清晨', '下午', '夜里'] },
    { id: 'q5', question: '她最喜欢哪一类礼物？', options: ['实用的小东西', '认真挑很久的礼物', '一起去做一件事'] },
    { id: 'q6', question: '如果有普通的一天，我们最可能？', options: ['一起做饭', '窝在沙发看剧', '出门随便走走'] }
  ];
  let customQuestions = store.getJSON('ours-questions-v1', []);
  if (!Array.isArray(customQuestions)) customQuestions = [];
  const quizState = { mode: 'game', questions: [], index: 0, player: 0, answers: [[], []], selected: null };
  let lastQuizResult = store.getJSON('ours-quiz-results-v1', null);

  function allQuestions() {
    return [...defaultQuestions, ...customQuestions].filter((question) => question && question.question && Array.isArray(question.options) && question.options.length > 1);
  }

  function updateQuizSummary() {
    if (lastQuizResult) {
      $('#quizSummary').innerHTML = `<span>${lastQuizResult.score}% 默契</span><small>${lastQuizResult.date} · ${lastQuizResult.matched} / ${lastQuizResult.total} 题答案相同</small>`;
    } else {
      $('#quizSummary').innerHTML = `<span>还没有玩过</span><small>共 ${allQuestions().length} 道问题</small>`;
    }
  }
  function openQuiz(mode = 'game') {
    quizState.mode = mode;
    renderQuiz();
    openDialog($('#quizLayer'), $('.quiz-dialog'));
  }

  function startQuiz() {
    quizState.questions = allQuestions();
    quizState.index = 0;
    quizState.player = 0;
    quizState.answers = [[], []];
    quizState.selected = null;
    openQuiz('game');
  }
  function renderQuiz() {
    if (quizState.mode === 'manage') renderQuizManager();
    else renderQuizGame();
  }

  function renderQuizGame() {
    const body = $('#quizBody');
    if (!quizState.questions.length) {
      body.innerHTML = '<p>还没有可以玩的问题。</p><button class="quiz-restart" data-quiz-manage="true">去添加问题</button>';
      return;
    }
    if (quizState.index >= quizState.questions.length) {
      const matched = quizState.answers[0].filter((answer, index) => answer === quizState.answers[1][index]).length;
      const total = quizState.questions.length;
      const score = Math.round(matched / total * 100);
      lastQuizResult = { score, matched, total, date: todayISO() };
      store.setJSON('ours-quiz-results-v1', lastQuizResult);
      updateQuizSummary();
      body.innerHTML = `<div class="quiz-result"><div class="quiz-result-score">${score}<span>%</span></div><h3>${score >= 80 ? '你们已经很懂彼此了。' : score >= 50 ? '有些答案不一样，也很可爱。' : '原来还有这么多可以慢慢了解。'}</h3><p>${total} 道题里有 ${matched} 道答案相同。答案不同不代表不够喜欢，只是又发现了一个可以聊很久的话题。</p><button class="quiz-restart" data-quiz-restart="true">再玩一次</button></div>`;
      sparkle(window.innerWidth / 2, window.innerHeight / 2);
      return;
    }    const question = quizState.questions[quizState.index];
    const playerLabel = quizState.player === 0 ? '先由你回答' : '现在换她回答，先别偷看';
    body.innerHTML = `
      <div class="quiz-progress">QUESTION ${quizState.index + 1} / ${quizState.questions.length}</div>
      <p class="quiz-player-name">${playerLabel}</p>
      <h3 class="quiz-question">${escapeHTML(question.question)}</h3>
      <div class="quiz-options">${question.options.map((option, index) => `<button type="button" data-quiz-option="${index}">${escapeHTML(option)}</button>`).join('')}</div>`;
  }

  function chooseQuizAnswer(index) {
    quizState.answers[quizState.player][quizState.index] = index;
    if (quizState.player === 0) {
      quizState.player = 1;
      renderQuizGame();
      return;
    }
    quizState.player = 0;
    quizState.index += 1;
    renderQuizGame();
  }
  function renderQuizManager() {
    const list = customQuestions.map((question) => `<div class="quiz-manage-item"><span>${escapeHTML(question.question)}</span><button type="button" data-delete-question="${escapeHTML(question.id)}" aria-label="删除问题">×</button></div>`).join('');
    $('#quizBody').innerHTML = `
      <p>默认问题会一直保留。下面是你自己添加的问题。</p>
      <div class="quiz-manage-list">${list || '<p>还没有自定义问题。</p>'}</div>
      <form class="quiz-manage-form" id="quizQuestionForm"><input id="customQuestion" maxlength="60" placeholder="写一个关于我们的问题" required /><input id="customOptionA" maxlength="30" placeholder="选项 A" required /><input id="customOptionB" maxlength="30" placeholder="选项 B" required /><button type="submit" aria-label="添加问题">＋</button></form>
      <button class="quiz-restart" data-quiz-start="true">开始问答</button>`;
  }
  function bindQuiz() {
    $('#startQuiz').addEventListener('click', startQuiz);
    $('#manageQuestions').addEventListener('click', () => openQuiz('manage'));
    $('#closeQuiz').addEventListener('click', () => closeDialog($('#quizLayer'), $('.quiz-dialog')));
    $('#quizBackdrop').addEventListener('click', () => closeDialog($('#quizLayer'), $('.quiz-dialog')));
    $('#quizBody').addEventListener('click', (event) => {
      const option = event.target.closest('[data-quiz-option]');
      if (option) { chooseQuizAnswer(Number(option.dataset.quizOption)); return; }
      if (event.target.closest('[data-quiz-restart]')) { startQuiz(); return; }
      if (event.target.closest('[data-quiz-start]')) { startQuiz(); return; }
      if (event.target.closest('[data-quiz-manage]')) { openQuiz('manage'); return; }
      const remove = event.target.closest('[data-delete-question]');
      if (remove) {
        customQuestions = customQuestions.filter((question) => question.id !== remove.dataset.deleteQuestion);
        store.setJSON('ours-questions-v1', customQuestions);
        renderQuizManager();
      }
    });    $('#quizBody').addEventListener('submit', (event) => {
      if (event.target.id !== 'quizQuestionForm') return;
      event.preventDefault();
      const question = $('#customQuestion').value.trim();
      const optionA = $('#customOptionA').value.trim();
      const optionB = $('#customOptionB').value.trim();
      if (!question || !optionA || !optionB) return;
      customQuestions.push({ id: uid('question'), question, options: [optionA, optionB] });
      store.setJSON('ours-questions-v1', customQuestions);
      renderQuizManager();
      updateQuizSummary();
    });
    updateQuizSummary();
  }
  function bindBackup() {
    $('#openDataMenu')?.addEventListener('click', () => $('.backup-actions')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' }));
    $('#exportData').addEventListener('click', async () => {
      try {
        const payload = await store.exportData();
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `OURS-backup-${todayISO()}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast('备份文件已经准备好。');
      } catch {
        toast('导出失败，请稍后再试。');
      }
    });
    $('#importData').addEventListener('click', () => $('#importDataFile').click());
    $('#importDataFile').addEventListener('change', async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!window.confirm('导入备份会覆盖当前设备中的本地记录，确定继续吗？')) return;
      try {
        const payload = JSON.parse(await file.text());
        await store.importData(payload);
        toast('备份已导入，正在重新打开。');
        window.setTimeout(() => location.reload(), 700);
      } catch (error) {
        toast(error.message || '这个备份文件无法读取。');
      }
    });
  }
  function bindActiveNavigation() {
    const sectionMap = { home: 'home', memories: 'memories', menu: 'menu', wishes: 'wishes', play: 'play', 'play-more': 'play', vault: 'play' };
    const setActive = (section) => $$('.mobile-dock a').forEach((link) => link.classList.toggle('is-active', link.dataset.section === section));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) setActive(sectionMap[entry.target.id] || entry.target.id);
      });
    }, { rootMargin: '-42% 0px -48% 0px', threshold: 0 });
    ['home', 'memories', 'menu', 'wishes', 'play', 'play-more', 'vault'].forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });
  }

  function bindFeatureKeyboard() {
    document.addEventListener('keydown', (event) => {
      if (!$('#memoryLayer').hidden && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        stepMemory(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (event.key !== 'Escape') return;
      if (!$('#memoryEditorLayer').hidden) closeMemoryEditor();
      else if (!$('#shoppingLayer').hidden) closeDialog($('#shoppingLayer'), $('#shoppingDrawer'));
      else if (!$('#meetingLayer').hidden) closeDialog($('#meetingLayer'), $('.mini-dialog'));
      else if (!$('#quizLayer').hidden) closeDialog($('#quizLayer'), $('.quiz-dialog'));
    });
  }
  function initFeatures() {
    store.migrate();
    updateRelationshipExtras();
    bindMeeting();
    renderDailyNotes();
    bindDailyNotes();
    bindWishesEnhanced();
    bindMemoriesEnhanced();
    bindCooking();
    bindShopping();
    renderCookingDashboard();
    decorateDishCards();
    bindDateIdea();
    bindQuiz();
    bindBackup();
    bindActiveNavigation();
    bindFeatureKeyboard();
    window.setInterval(updateRelationshipExtras, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFeatures, { once: true });
  } else {
    initFeatures();
  }
})();  const regexOr = String.fromCharCode(124);
  const recipeNoise = new RegExp(['复制打开', '打开抖音', '打开小红书', '小红书号', '抖音号', '点赞', '收藏', '评论', '转发', '分享', '相关推荐', '广告', '下载APP', '打开APP', '作者', '发布时间', '视频原声', '图文', '展开'].join(regexOr));
  const ingredientWords = ['食材', '用料', '配料', '原材料', '准备材料', '所需材料', '材料'];
  const stepWords = ['做法', '步骤', '制作步骤', '烹饪步骤', '烹饪方法', '制作方法', '教程'];
  const endWords = ['小贴士', '提示', '注意', '备注', '标签', 'Tips', '#'];
  function startsWithAny(line, words) { return words.some((word) => line.startsWith(word)); }
  function extractRecipeUrl(text) { const match = String(text).match(/https?:\/\/[^\s，。！？]+/i); return match ? match[0].replace(/[)\]}>，。！？]+$/g, "") : ""; }
  function isSafeHttpUrl(value) { try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol); } catch { return false; } }
  function recipePlatform(url) { const lower = String(url).toLowerCase(); if (lower.includes("douyin.com")) return "抖音"; if (lower.includes("iesdouyin.com")) return "抖音"; if (lower.includes("xiaohongshu.com")) return "小红书"; if (lower.includes("xhslink.com")) return "小红书"; return url ? "外部链接" : ""; }
  function cleanRecipeLine(line) { return String(line).replace(/^[\s>#*+\-•·]+/, "").replace(/^\d+[.、)]\s*/, "").replace(/#[^\s#]+/g, "").replace(/\s+/g, " ").trim(); }
  function guessRecipeTitle(text, url) {
    const withoutUrl = String(text).replace(url, '').replace(/\s+/g, ' ').trim();
    const brackets = [...withoutUrl.matchAll(/【([^】]{2,80})】/g)].map((match) => cleanRecipeLine(match[1]));
    const goodBracket = brackets.find((value) => value.length >= 3 && !/的作品|的笔记|发布了/.test(value));
    if (goodBracket) return goodBracket;
    const lines = withoutUrl.split(/[\r\n]+/).map(cleanRecipeLine).filter(Boolean);
    const candidates = lines.filter((line) => line.length >= 3 && line.length <= 70 && !recipeNoise.test(line) && !startsWithAny(line, ingredientWords) && !startsWithAny(line, stepWords));
    candidates.sort((a, b) => b.length - a.length);
    return candidates[0] ? candidates[0] : '';
  }
  function guessRecipeCategory(text) {
    if (['蛋糕', '布丁', '甜点', '冰淇淋', '奶油', '焦糖', '巴斯克', '饼干', '派'].some((word) => text.includes(word))) return '甜点';
    if (['饮', '茶', '咖啡', '果汁', '气泡', '鸡尾酒', '红酒', '奶昔'].some((word) => text.includes(word))) return '饮品';
    if (['面条', '米饭', '粥', '粉', '饺子', '馒头', '包子', '意面', '烩饭'].some((word) => text.includes(word))) return '主食';
    if (['小吃', '薯', '炸', '烤串', '沙拉', '下酒', '零食'].some((word) => text.includes(word))) return '小吃';
    if (['汤', '前菜', '开胃', '凉拌'].some((word) => text.includes(word))) return '前菜';
    return '主菜';
  }
  function guessRecipeTime(text) {
    const minutes = text.match(/(\d{1,3})\s*分钟/);
    if (minutes) return minutes[1] + ' MIN';
    const mins = text.match(/(\d{1,3})\s*min/i);
    if (mins) return mins[1] + ' MIN';
    const hours = text.match(/(\d{1,2})\s*小时/);
    if (hours) return hours[1] + ' HR';
    return '';
  }
  function parseRecipeSections(text) {
    const rawLines = String(text).replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean);
    const ingredients = [];
    const steps = [];
    let mode = '';
    rawLines.forEach((line) => {
      const clean = cleanRecipeLine(line);
      if (!clean) return;
      if (startsWithAny(clean, ingredientWords)) {
        mode = 'ingredient';
        const word = ingredientWords.find((entry) => clean.startsWith(entry));
        const rest = clean.slice(word.length).replace(/^[:：\s]+/, '').trim();
        if (rest.length > 1) ingredients.push(rest);
        return;
      }
      if (startsWithAny(clean, stepWords)) {
        mode = 'step';
        const word = stepWords.find((entry) => clean.startsWith(entry));
        const rest = clean.slice(word.length).replace(/^[:：\s]+/, '').trim();
        if (rest.length > 1) steps.push(rest);
        return;
      }
      if (startsWithAny(clean, endWords)) { mode = ''; return; }
      if (mode === 'ingredient' && clean.length <= 90 && !recipeNoise.test(clean)) ingredients.push(clean);
      if (mode === 'step' && clean.length >= 3 && !recipeNoise.test(clean)) steps.push(clean);
    });
    if (!ingredients.length) {
      rawLines.forEach((line) => {
        if (/(\d+(?:\.\d+)?\s*(?:g|kg|ml|l|克|千克|毫升|勺|茶匙|杯|个|颗|片|根|瓣|块|只|斤|两))/.test(line)) ingredients.push(cleanRecipeLine(line));
      });
    }
    if (!steps.length) {
      rawLines.forEach((line) => {
        if (/^\s*\d+[.、)]\s+/.test(line)) steps.push(cleanRecipeLine(line));
      });
    }
    return { ingredients: [...new Set(ingredients)].slice(0, 30), steps: [...new Set(steps)].slice(0, 30) };
  }
  function importRecipeText() {
    const input = document.getElementById('recipeImportText');
    const status = document.getElementById('recipeImportStatus');
    const raw = input.value.trim();
    if (!raw) { status.textContent = '先粘贴链接、分享文案或页面文字。'; return; }
    const url = extractRecipeUrl(raw);
    const platform = recipePlatform(url);
    const title = guessRecipeTitle(raw, url);
    const sections = parseRecipeSections(raw);
    const time = guessRecipeTime(raw);
    const safeUrl = isSafeHttpUrl(url) ? url : '';
    document.getElementById('dishSourceUrl').value = safeUrl;
    document.getElementById('dishSourcePlatform').value = platform;
    const sourceButton = document.getElementById('openRecipeSource');
    sourceButton.hidden = !safeUrl;
    if (title) document.getElementById('dishName').value = title;
    if (sections.ingredients.length) document.getElementById('dishEditorIngredients').value = sections.ingredients.join('\n');
    if (sections.steps.length) document.getElementById('dishEditorSteps').value = sections.steps.join('\n');
    if (time) document.getElementById('dishTime').value = time;
    const category = guessRecipeCategory(raw);
    document.getElementById('dishCategory').value = category;
    if (title) document.getElementById('dishDesc').value = `来自${platform || '外部链接'}的菜谱灵感：${title}`;
    if (!title && !sections.ingredients.length && !sections.steps.length) {
      status.textContent = safeUrl ? `已识别${platform}链接。平台限制无法直接读取正文，请把详情页文字一起粘贴。` : '没有识别到可用的菜品信息。';
      return;
    }
    status.textContent = `已填入：${title ? '菜名' : ''} ${sections.ingredients.length} 种食材 · ${sections.steps.length} 个步骤`;
  }
  function renderDishSource(id) {
    const row = document.getElementById('dishSourceRow');
    const link = document.getElementById('dishSourceLink');
    const dish = window.OURS_APP?.getAllDishes?.().find((item) => item.id === id);
    if (!row) return;
    if (!link) return;
    if (!dish?.sourceUrl) { row.hidden = true; return; }
    row.hidden = false;
    row.querySelector('span').textContent = `灵感来源：${dish.sourcePlatform ? dish.sourcePlatform : '外部链接'}`;
    link.href = isSafeHttpUrl(dish.sourceUrl) ? dish.sourceUrl : '#';
    link.textContent = '打开原帖 ↗';
  }
  function initRecipeImporter() {
    const importButton = document.getElementById('importRecipe');
    const importInput = document.getElementById('recipeImportText');
    const sourceButton = document.getElementById('openRecipeSource');
    if (!importButton) return;
    if (!importInput) return;
    if (!sourceButton) return;
    importButton.addEventListener('click', importRecipeText);
    importInput.addEventListener('paste', () => window.setTimeout(importRecipeText, 80));
    sourceButton.addEventListener('click', () => {
      const url = document.getElementById('dishSourceUrl').value;
      if (isSafeHttpUrl(url)) window.open(url, '_blank', 'noopener,noreferrer');
    });
    document.addEventListener('ours:dish-opened', (event) => renderDishSource(event.detail.id));
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecipeImporter, { once: true });
  } else {
    initRecipeImporter();
  }
