(() => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const api = window.OURS_FEATURES_API;
  const store = window.OURS_STORE;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
  const todayISO = () => api.todayISO();
  const toast = (message) => api.toast(message);
  const focusReturn = new WeakMap();
  let cookingModeDishId = '';
  let cookingModeStep = 0;
  let timerEnd = 0;
  let timerRemaining = 0;
  let timerInterval = 0;
  let resultPhotoBlob = null;
  let resultPhotoUrl = '';
  let lastResult = null;
  let profilePhotoBlob = null;
  let profileRemovePhoto = false;
  let profilePhotoUrl = '';
  let heroObjectUrl = '';

  const realMemories = () => api.getAllMemories().filter((memory) => !memory.seed || memory.updatedAt);

  function openLayer(layer, panel) {
    if (!layer || !panel) return;
    focusReturn.set(layer, document.activeElement);
    api.openDialog(layer, panel);
  }

  function closeLayer(layer, panel) {
    if (!layer || !panel) return;
    api.closeDialog(layer, panel);
    const target = focusReturn.get(layer);
    window.setTimeout(() => target?.focus?.({ preventScroll: true }), reducedMotion ? 0 : 330);
  }

  function hideLayerNow(layer, panel) {
    if (!layer || !panel) return;
    layer.classList.remove('is-open');
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    layer.hidden = true;
    const visible = $('.modal-layer:not([hidden]), .drawer-layer:not([hidden]), .install-layer:not([hidden])');
    document.body.classList.toggle('modal-open', Boolean(visible));
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand('copy');
      area.remove();
      return copied;
    }
  }

  async function shareText(title, text) {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    toast(await copyText(text) ? '内容已复制，可以发送给对方。' : '复制失败，请手动选择文字。');
  }

  function renderRecent() {
    const memories = realMemories();
    const latestMemory = memories[0];
    const memoryCard = $('#recentMemory');
    if (latestMemory) {
      memoryCard.querySelector('strong').textContent = latestMemory.title;
      memoryCard.querySelector('small').textContent = `${latestMemory.date} · ${latestMemory.location || '我们的回忆'}`;
      memoryCard.onclick = () => api.openMemoryById(latestMemory.id);
    } else {
      memoryCard.querySelector('strong').textContent = '还没有回忆';
      memoryCard.querySelector('small').textContent = '去相册添加第一张照片';
      memoryCard.onclick = () => $('#memories')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    const dishes = api.allDishes();
    const cooking = api.getCooking();
    const logs = dishes.flatMap((dish) => {
      const state = cooking[dish.id];
      if (!state || !Array.isArray(state.logs)) return [];
      return state.logs.map((log) => ({ dish, log }));
    }).sort((a, b) => String(b.log.date).localeCompare(String(a.log.date)));
    const cookingCard = $('#recentCooking');
    if (logs.length) {
      cookingCard.querySelector('strong').textContent = logs[0].dish.name;
      cookingCard.querySelector('small').textContent = `${logs[0].log.date} · ${logs[0].log.rating || '—'} 分`;
      cookingCard.onclick = () => window.OURS_APP?.openDish?.(logs[0].dish.id);
    } else {
      cookingCard.querySelector('strong').textContent = '还没有做菜记录';
      cookingCard.querySelector('small').textContent = '从私厨开始第一道菜';
      cookingCard.onclick = () => $('#menu')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    const completed = api.getWishes()
      .filter((wish) => wish.done)
      .sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    const wishCard = $('#recentWish');
    if (completed.length) {
      wishCard.querySelector('strong').textContent = completed[0].title;
      wishCard.querySelector('small').textContent = `完成于 ${completed[0].completedAt || '最近'}`;
      wishCard.onclick = () => completed[0].memoryId
        ? api.openMemoryById(completed[0].memoryId)
        : document.dispatchEvent(new CustomEvent('ours:wish-memory', { detail: { id: completed[0].id } }));
    } else {
      wishCard.querySelector('strong').textContent = '还没有完成记录';
      wishCard.querySelector('small').textContent = '每完成一件事都值得留下';
      wishCard.onclick = () => $('#wishes')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    const now = new Date();
    const todayKey = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const onThisDay = memories.find((memory) => memory.date
      && memory.date.slice(5) === todayKey
      && Number(memory.date.slice(0, 4)) < now.getFullYear());
    const onCard = $('#onThisDayCard');
    if (onThisDay) {
      onCard.hidden = false;
      $('#onThisDayText').textContent = `${onThisDay.date.slice(0, 4)} 年的今天，${onThisDay.title}`;
      onCard.onclick = () => api.openMemoryById(onThisDay.id);
    } else {
      onCard.hidden = true;
    }
  }

  async function renderYearReview() {
    const year = new Date().getFullYear();
    const memories = realMemories().filter((memory) => String(memory.date).startsWith(String(year)));
    const wishes = api.getWishes().filter((wish) => wish.done && String(wish.completedAt || '').startsWith(String(year)));
    const dishes = api.allDishes();
    const cooking = api.getCooking();
    const cooked = dishes.flatMap((dish) => {
      const state = cooking[dish.id];
      if (!state || !Array.isArray(state.logs)) return [];
      return state.logs
        .filter((log) => String(log.date).startsWith(String(year)))
        .map((log) => ({ dish, log }));
    });
    const latestImage = memories[0] ? await api.memoryImage(memories[0]) : '';
    const slides = [];

    slides.push(`
      <article class="review-slide review-slide-intro">
        <span>OUR YEAR · ${year}</span>
        <strong>${memories.length}</strong>
        <h3>段被认真保存的日子</h3>
        ${latestImage ? `<img class="review-photo" src="${escapeHTML(latestImage)}" alt="${escapeHTML(memories[0].title)}" />` : '<p>这一年不需要很多照片。只要有一刻想留下，我们就慢慢写。</p>'}
      </article>`);

    slides.push(`
      <article class="review-slide">
        <span>WISHES TOGETHER</span>
        <strong>${wishes.length}</strong>
        <h3>个愿望一起完成</h3>
        <ul>${wishes.slice(0, 5).map((wish) => `<li>${escapeHTML(wish.title)}</li>`).join('') || '<li>这一年还可以慢慢写。</li>'}</ul>
      </article>`);

    slides.push(`
      <article class="review-slide">
        <span>FROM OUR KITCHEN</span>
        <strong>${cooked.length}</strong>
        <h3>次为你下厨</h3>
        <ul>${cooked.slice(0, 5).map((item) => `<li>${escapeHTML(item.dish.name)} · ${escapeHTML(item.log.date)}</li>`).join('') || '<li>下一道菜，等你来点。</li>'}</ul>
      </article>`);

    const dates = [
      ...memories.map((memory) => memory.date),
      ...wishes.map((wish) => wish.completedAt),
      ...cooked.map((item) => item.log.date),
    ].filter(Boolean).sort();
    slides.push(`
      <article class="review-slide review-slide-closing">
        <span>LITTLE THINGS, KEPT</span>
        <h3>${dates.length ? '这些日子，都是我们一起走过的。' : '今年还没写完，下一页留给下一顿饭。'}</h3>
        <p>${dates.length ? `从 ${escapeHTML(dates[0])} 到 ${escapeHTML(dates[dates.length - 1])}，没有排名，也不赶进度。` : '不连续打卡，也不需要完成多少件事。我们只记录真正想记住的。'}</p>
      </article>`);

    $('#yearReviewBody').innerHTML = slides.join('');
    openLayer($('#yearReviewLayer'), $('.year-review-dialog'));
  }

  function openWishMemory(wishId) {
    const wish = api.getWishes().find((entry) => entry.id === wishId);
    if (!wish) return;
    if (wish.memoryId) {
      api.openMemoryById(wish.memoryId);
      return;
    }
    api.openMemoryEditor(null, {
      title: `完成愿望：${wish.title}`,
      date: wish.completedAt || todayISO(),
      location: '',
      text: wish.note ? `完成这个愿望时，我们想起：${wish.note}` : '',
      wishId: wish.id,
    });
  }
  function stopTimer() {
    window.clearInterval(timerInterval);
    timerInterval = 0;
  }

  function formatTimer(seconds) {
    const safe = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
  }

  function renderTimer() {
    const display = $('#cookTimerDisplay');
    if (!display) return;
    let remaining = timerRemaining;
    if (timerEnd) remaining = Math.max(0, (timerEnd - Date.now()) / 1000);
    display.textContent = formatTimer(remaining);
    if (timerEnd && remaining <= 0) {
      stopTimer();
      timerEnd = 0;
      timerRemaining = 0;
      display.textContent = '00:00';
      $('#cookTimerNote').textContent = '时间到了。网页关闭后不会发送系统通知，请留意锅里的变化。';
      toast('计时结束，可以检查火候了。');
    }
  }

  function resetCookTimer() {
    stopTimer();
    timerEnd = 0;
    timerRemaining = 0;
    const minutes = $('#cookTimerMinutes');
    if (minutes) minutes.value = '5';
    const note = $('#cookTimerNote');
    if (note) note.textContent = '计时按真实时间计算，切换页面也不会累计出错；网页关闭后不会弹出系统提醒。';
    renderTimer();
  }

  function startCookTimer() {
    const minutes = Math.max(1, Math.min(90, Number($('#cookTimerMinutes').value) || 5));
    $('#cookTimerMinutes').value = String(minutes);
    timerRemaining = minutes * 60;
    timerEnd = Date.now() + timerRemaining * 1000;
    stopTimer();
    renderTimer();
    timerInterval = window.setInterval(renderTimer, 500);
    toast(`开始计时 ${minutes} 分钟。`);
  }

  function openCookingMode(dishId) {
    const dish = api.allDishes().find((item) => item.id === dishId);
    if (!dish) return;
    cookingModeDishId = dishId;
    const state = api.dishState(dishId);
    const firstOpen = dish.steps.findIndex((step, index) => !state.steps[index]);
    cookingModeStep = firstOpen >= 0 ? firstOpen : Math.max(0, dish.steps.length - 1);
    if (state.status === 'want') {
      state.status = 'practice';
      api.saveCooking();
      api.decorateDishCards();
      api.renderCookingDashboard();
    }
    $('#cookingModeTitle').textContent = dish.name;
    $('#cookModeIngredients').innerHTML = dish.ingredients.map((item) => `<li>${escapeHTML(item)}</li>`).join('');
    stopTimer();
    timerEnd = 0;
    timerRemaining = 0;
    $('#cookTimerMinutes').value = '5';
    $('#cookTimerDisplay').textContent = '05:00';
    $('#cookTimerNote').textContent = '计时按真实时间计算，切换页面也不会累计出错；网页关闭后不会弹出系统提醒。';
    renderCookingStep();
    openLayer($('#cookingModeLayer'), $('.cooking-mode-dialog'));
  }

  function renderCookingStep() {
    const dish = api.allDishes().find((item) => item.id === cookingModeDishId);
    if (!dish || !dish.steps.length) return;
    const state = api.dishState(cookingModeDishId);
    const total = dish.steps.length;
    cookingModeStep = Math.max(0, Math.min(cookingModeStep, total - 1));
    const done = Object.values(state.steps).filter(Boolean).length;
    $('#cookModeStepTitle').textContent = state.steps[cookingModeStep] ? `第 ${cookingModeStep + 1} 步 · 已完成` : `第 ${cookingModeStep + 1} 步`;
    $('#cookModeStepText').textContent = dish.steps[cookingModeStep] || '';
    $('#cookModeProgress').textContent = `${done} / ${total} 步`;
    $('#cookModeProgressBar').style.width = `${total ? done / total * 100 : 0}%`;
    $('#cookPrev').disabled = cookingModeStep === 0;
    $('#cookNext').textContent = state.steps[cookingModeStep]
      ? (cookingModeStep === total - 1 ? '这一步已完成' : '下一步 →')
      : (cookingModeStep === total - 1 ? '完成这一步' : '完成并继续 →');
    $('#cookModeFinish').classList.toggle('is-ready', done === total);
  }

  function markCookingStepDone() {
    const dish = api.allDishes().find((item) => item.id === cookingModeDishId);
    if (!dish) return false;
    const state = api.dishState(cookingModeDishId);
    state.steps[cookingModeStep] = true;
    state.status = 'practice';
    if (!api.saveCooking()) {
      toast('步骤保存失败，请检查浏览器存储空间。');
      return false;
    }
    api.decorateDishCards();
    api.renderCookingDashboard();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    return true;
  }

  function closeCookingMode() {
    if (timerEnd) {
      timerRemaining = Math.max(0, (timerEnd - Date.now()) / 1000);
      timerEnd = 0;
    }
    stopTimer();
    closeLayer($('#cookingModeLayer'), $('.cooking-mode-dialog'));
    toast('进度已经保留，回来可以接着做。');
  }

  function openCookingResult() {
    const dish = api.allDishes().find((item) => item.id === cookingModeDishId);
    if (!dish) return;
    const state = api.dishState(cookingModeDishId);
    const done = Object.values(state.steps).filter(Boolean).length;
    if (done < dish.steps.length) {
      toast(`还有 ${dish.steps.length - done} 个步骤没有勾选。`);
      return;
    }
    stopTimer();
    timerEnd = 0;
    timerRemaining = 0;
    hideLayerNow($('#cookingModeLayer'), $('.cooking-mode-dialog'));
    resultPhotoBlob = null;
    if (resultPhotoUrl) URL.revokeObjectURL(resultPhotoUrl);
    resultPhotoUrl = '';
    $('#cookingResultSuccess').hidden = true;
    $('#cookingResultBody').hidden = false;
    $('#cookingResultBody').innerHTML = `
      <form class="cooking-result-form" id="cookingResultForm">
        <div class="result-form-grid">
          <label class="field">这次做菜的日子<input id="resultCookDate" type="date" value="${todayISO()}" required /></label>
          <label class="field">给自己打个分<select id="resultCookRating"><option value="5">5 · 很好吃</option><option value="4">4 · 不错</option><option value="3">3 · 还可以</option><option value="2">2 · 再练练</option><option value="1">1 · 下次一定</option></select></label>
        </div>
        <label class="field">这次的火候和心得<textarea id="resultCookNotes" rows="3" maxlength="240" placeholder="比如：这次汤汁收得刚好。"></textarea></label>
        <label class="field">她的真实反馈<textarea id="resultCookFeedback" rows="3" maxlength="160" placeholder="如果她说了什么，可以记在这里。"></textarea></label>
        <label class="result-photo-field">成品照片（可选）<input id="resultCookPhoto" type="file" accept="image/*" /><img id="resultCookPhotoPreview" src="assets/dish-custom.svg" alt="成品照片预览" /><small>照片会压缩后只保存在当前设备，不会自动上传。</small></label>
        <p class="profile-note">不强迫填写全部内容。照片和反馈都可以留空。</p>
        <button class="primary-button result-submit" id="saveCookingResult" type="submit">保存这次做菜 <span>↗</span></button>
      </form>`;
    openLayer($('#cookingResultLayer'), $('.cooking-result-dialog'));
    $('#resultCookDate').focus({ preventScroll: true });
  }

  function compressResultPhoto(file) {
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

  async function saveCookingResult(event) {
    event.preventDefault();
    const dish = api.allDishes().find((item) => item.id === cookingModeDishId);
    if (!dish) return;
    const date = $('#resultCookDate').value;
    if (!date) {
      toast('请选择这次做菜的日期。');
      return;
    }
    const button = $('#saveCookingResult');
    button.disabled = true;
    const logId = `${dish.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const photoId = resultPhotoBlob ? `cook-${logId}` : '';
    const state = api.dishState(dish.id);
    const snapshot = JSON.stringify(state);
    if (resultPhotoBlob) {
      try {
        await store.putPhoto(photoId, resultPhotoBlob);
      } catch {
        button.disabled = false;
        toast('成品照片保存失败，请换一张小一点的照片。');
        return;
      }
    }
    const log = {
      id: logId,
      date,
      rating: Number($('#resultCookRating').value) || 5,
      notes: $('#resultCookNotes').value.trim(),
      feedback: $('#resultCookFeedback').value.trim(),
      photoId,
      createdAt: new Date().toISOString(),
    };
    state.logs.unshift(log);
    state.status = 'done';
    state.steps = {};
    if (!api.saveCooking()) {
      Object.keys(state).forEach((key) => delete state[key]);
      Object.assign(state, JSON.parse(snapshot));
      if (photoId) store.deletePhoto(photoId).catch(() => {});
      button.disabled = false;
      toast('做菜记录保存失败，请检查浏览器存储空间。');
      return;
    }
    lastResult = { dish, log };
    resultPhotoBlob = null;
    api.decorateDishCards();
    api.renderCookingDashboard();
    document.dispatchEvent(new CustomEvent('ours:data-changed'));
    api.sparkle(window.innerWidth / 2, window.innerHeight / 2);
    renderCookingResultSuccess();
  }

  function existingResultMemory() {
    if (!lastResult) return null;
    return api.getAllMemories().find((memory) => memory.cookingLogId === lastResult.log.id) || null;
  }

  function renderCookingResultSuccess() {
    if (!lastResult) return;
    const existing = existingResultMemory();
    $('#cookingResultBody').hidden = true;
    const success = $('#cookingResultSuccess');
    success.hidden = false;
    success.innerHTML = `
      <span class="result-seal">O.</span>
      <p>COOKED WITH LOVE</p>
      <h3>${escapeHTML(lastResult.dish.name)}，已经端上我们的桌。</h3>
      <p>${lastResult.log.rating} 分 · ${escapeHTML(lastResult.log.date)}${lastResult.log.notes ? ` · ${escapeHTML(lastResult.log.notes)}` : ''}</p>
      <button type="button" data-cook-result="memory">${existing ? '查看已保存的回忆' : '把今天收进回忆'}</button>
      <button type="button" data-cook-result="share">分享这次做菜</button>
      <button type="button" data-cook-result="close">先到这里</button>`;
  }

  function openResultAsMemory() {
    if (!lastResult) return;
    const existing = existingResultMemory();
    if (existing) {
      hideLayerNow($('#cookingResultLayer'), $('.cooking-result-dialog'));
      api.openMemoryById(existing.id);
      return;
    }
    const { dish, log } = lastResult;
    const textParts = [
      log.notes ? `这次的心得：${log.notes}` : '',
      log.feedback ? `她的话：${log.feedback}` : '',
    ].filter(Boolean);
    const prefill = {
      title: `${dish.name}，今天做给你吃`,
      date: log.date,
      location: '我们的厨房',
      text: textParts.join('\n') || '今天把这道菜端上了我们的桌，想把这个普通又认真的一天留下来。',
      dishId: dish.id,
      cookingLogId: log.id,
    };
    if (resultPhotoBlob) prefill.photoBlob = resultPhotoBlob;
    else if (log.photoId) {
      store.getPhoto(log.photoId).then((blob) => {
        if (blob) prefill.photoBlob = blob;
        closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog'));
        window.setTimeout(() => api.openMemoryEditor(null, prefill), reducedMotion ? 0 : 180);
      }).catch(() => {
        closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog'));
        window.setTimeout(() => api.openMemoryEditor(null, prefill), reducedMotion ? 0 : 180);
      });
      return;
    }
    closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog'));
    window.setTimeout(() => api.openMemoryEditor(null, prefill), reducedMotion ? 0 : 180);
  }

  function renderCookingHistory(dishId) {
    const container = $('#cookingHistory');
    if (!container) return;
    const dish = api.allDishes().find((item) => item.id === dishId);
    const logs = dish ? api.dishState(dish.id).logs : [];
    if (!dish || !logs.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }
    container.hidden = false;
    container.innerHTML = `<div class="cooking-history-head"><h3>做过的日子</h3><small>记录仍在，随时可以补一段回忆。</small></div>${logs.slice(0, 4).map((log) => {
      const memory = api.getAllMemories().find((item) => item.cookingLogId === log.id);
      return `<article class="cooking-history-item"><time>${escapeHTML(log.date)}</time><div><strong>${log.rating || '—'} 分</strong><p>${escapeHTML(log.notes || log.feedback || '这一天的味道，留给以后再想起。')}</p></div><button type="button" data-cooking-log-id="${escapeHTML(log.id)}">${memory ? '查看纪念' : '收进回忆'}</button></article>`;
    }).join('')}`;
  }

  async function openCookingLogMemory(dishId, logId) {
    const dish = api.allDishes().find((item) => item.id === dishId);
    const log = dish ? api.dishState(dish.id).logs.find((item) => item.id === logId) : null;
    if (!dish || !log) return;
    lastResult = { dish, log };
    const existing = existingResultMemory();
    if (existing) {
      api.openMemoryById(existing.id);
      return;
    }
    openResultAsMemory();
  }

  async function shareCookingResult() {
    if (!lastResult) return;
    const { dish, log } = lastResult;
    const text = `OURS · 今天为你下厨\n\n${dish.name}\n${log.date} · ${log.rating} 分\n${log.notes ? `\n${log.notes}` : ''}${log.feedback ? `\n她的话：${log.feedback}` : ''}\n\n认真做完一顿饭，也想把这一天留下来。`;
    await shareText('OURS · 今天为你下厨', text);
  }
  function readProfile() {
    return store.getJSON('ours-profile-v1', {}) || {};
  }

  async function applyHeroProfile() {
    const profile = readProfile();
    if (profile.favoriteColor && /^#[0-9a-f]{6}$/i.test(profile.favoriteColor)) {
      document.documentElement.style.setProperty('--wine', profile.favoriteColor);
      document.documentElement.style.setProperty('--wine-bright', profile.favoriteColor);
    }
    if (!profile.photoId) return;
    try {
      const blob = await store.getPhoto(profile.photoId);
      if (!blob) return;
      if (heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
      heroObjectUrl = URL.createObjectURL(blob);
      const image = $('#heroProfilePhoto');
      if (image) {
        image.src = heroObjectUrl;
        image.alt = '我们的首页合照';
      }
      const caption = $('#heroProfileCaption');
      if (caption) caption.textContent = profile.heroCaption || '我们的封面照片';
      const author = $('#heroProfileAuthor');
      if (author) author.textContent = 'OUR PHOTO · US';
      $('#heroStage')?.classList.add('has-real-photo');
    } catch {}
  }

  async function openProfile() {
    const profile = readProfile();
    const current = profile.photoId ? '正在读取当前封面…' : '还没有上传封面照片';
    profilePhotoBlob = null;
    profileRemovePhoto = false;
    if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
    profilePhotoUrl = '';
    $('#profileBody').innerHTML = `
      <form id="profileForm" class="profile-form">
        <div class="profile-photo-panel">
          <img class="profile-photo-preview" id="profilePhotoPreview" src="assets/photo-01.svg" alt="首页封面预览" />
          <label class="profile-upload">选择首页主照片<input id="profilePhoto" type="file" accept="image/*" /></label>
          <button class="text-button" id="removeProfilePhoto" type="button">移除封面照片</button>
          <small id="profilePhotoStatus">${escapeHTML(current)}</small>
        </div>
        <div class="profile-fields">
          <div class="form-grid">
            <label class="field">我的昵称<input id="profileMyName" maxlength="20" value="${escapeHTML(profile.myName || '')}" placeholder="例如：阿宇" /></label>
            <label class="field">她的昵称<input id="profileHerName" maxlength="20" value="${escapeHTML(profile.herName || '')}" placeholder="例如：小猪" required /></label>
          </div>
          <label class="field">我们在一起的日期<input id="profileStart" type="date" value="${escapeHTML(profile.relationshipStart || '')}" required /></label>
          <div class="form-grid">
            <label class="field">她的生日月份<input id="profileBirthdayMonth" type="number" min="1" max="12" value="${escapeHTML(profile.birthdayMonth || '')}" required /></label>
            <label class="field">生日日期<input id="profileBirthdayDay" type="number" min="1" max="31" value="${escapeHTML(profile.birthdayDay || '')}" required /></label>
          </div>
          <div class="form-grid">
            <label class="field">我们喜欢的颜色<input id="profileColor" type="color" value="${escapeHTML(profile.favoriteColor || '#722f42')}" /></label>
            <label class="field">下次见面<input id="profileNextMeeting" type="date" value="${escapeHTML(profile.nextMeeting || '')}" /></label>
          </div>
          <label class="field">封面照片说明<input id="profileHeroCaption" maxlength="40" value="${escapeHTML(profile.heroCaption || '')}" placeholder="例如：某个很普通的晚上" /></label>
          <p class="profile-note">这些设置只保存在当前浏览器，不会自动同步到她的手机。照片会压缩并存入本机 IndexedDB，也不会自动上传。</p>
          <button class="primary-button profile-save" type="submit">保存我们的小档案 <span>↗</span></button>
        </div>
      </form>`;
    openLayer($('#profileLayer'), $('.profile-dialog'));
    if (profile.photoId) {
      try {
        const blob = await store.getPhoto(profile.photoId);
        if (blob) {
          profilePhotoUrl = URL.createObjectURL(blob);
          $('#profilePhotoPreview').src = profilePhotoUrl;
          $('#profilePhotoStatus').textContent = '当前封面照片';
        }
      } catch {
        $('#profilePhotoStatus').textContent = '封面照片读取失败，仍可重新选择。';
      }
    }
  }

  function closeProfile() {
    closeLayer($('#profileLayer'), $('.profile-dialog'));
    profilePhotoBlob = null;
    profileRemovePhoto = false;
    if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
    profilePhotoUrl = '';
  }

  function compressProfilePhoto(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) return reject(new Error('请选择图片文件。'));
      if (file.size > 15 * 1024 * 1024) return reject(new Error('照片太大，请选择 15MB 以内的图片。'));
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('照片读取失败。'));
      reader.onload = () => {
        const image = new Image();
        image.onerror = () => reject(new Error('这张照片暂时无法处理。'));
        image.onload = () => {
          const scale = Math.min(1, 1800 / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#f3ece4';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('照片处理失败。')), 'image/jpeg', .84);
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function saveProfile(event) {
    event.preventDefault();
    const herName = $('#profileHerName').value.trim();
    const relationshipStart = $('#profileStart').value;
    const birthdayMonth = Number($('#profileBirthdayMonth').value);
    const birthdayDay = Number($('#profileBirthdayDay').value);
    if (!herName || !relationshipStart) {
      toast('她的昵称和在一起日期都要填写。');
      return;
    }
    const birthdayCheck = new Date(2000, birthdayMonth - 1, birthdayDay);
    if (!birthdayMonth || !birthdayDay || birthdayCheck.getMonth() !== birthdayMonth - 1 || birthdayCheck.getDate() !== birthdayDay) {
      toast('生日月份或日期不正确。');
      return;
    }
    const nextMeeting = $('#profileNextMeeting').value;
    const favoriteColor = $('#profileColor').value;
    const previousProfile = readProfile();
    let photoId = profileRemovePhoto ? '' : (previousProfile.photoId || '');
    let createdPhotoId = '';
    const submit = $('#profileForm button[type="submit"]');
    submit.disabled = true;
    if (profilePhotoBlob) {
      createdPhotoId = `profile-cover-${Date.now()}`;
      try {
        await store.putPhoto(createdPhotoId, profilePhotoBlob);
        photoId = createdPhotoId;
      } catch {
        submit.disabled = false;
        toast('封面照片保存失败，请换一张小一点的照片。');
        return;
      }
    }
    const nextProfile = {
      myName: $('#profileMyName').value.trim(),
      herName,
      relationshipStart,
      birthdayMonth,
      birthdayDay,
      favoriteColor,
      nextMeeting,
      heroCaption: $('#profileHeroCaption').value.trim(),
      photoId,
      updatedAt: new Date().toISOString(),
    };
    if (!store.setJSON('ours-profile-v1', nextProfile)) {
      if (createdPhotoId) store.deletePhoto(createdPhotoId).catch(() => {});
      submit.disabled = false;
      toast('小档案保存失败，请检查浏览器存储空间。');
      return;
    }
    if (!store.setJSON('ours-next-meeting-v1', nextMeeting || null)) {
      toast('见面日期保存失败，但其他设置已经保存。');
    }
    if (previousProfile.photoId && previousProfile.photoId !== photoId) {
      store.deletePhoto(previousProfile.photoId).catch(() => {});
    }
    document.documentElement.style.setProperty('--wine', favoriteColor);
    document.documentElement.style.setProperty('--wine-bright', favoriteColor);
    toast('我们的小档案已经保存，正在更新页面。');
    window.setTimeout(() => location.reload(), 650);
  }

  async function buildOrderCardFile(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 1080, 1350);
    gradient.addColorStop(0, '#3b171d');
    gradient.addColorStop(1, '#120e0d');
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(239, 226, 199, .26)';
    context.lineWidth = 2;
    context.strokeRect(60, 60, 960, 1230);
    context.fillStyle = '#d0ad76';
    context.font = '30px Georgia, serif';
    context.fillText('OURS · A LITTLE WORLD FOR TWO', 105, 145);
    context.fillStyle = '#f3ece4';
    context.font = '96px Georgia, serif';
    context.fillText('今晚的桌', 105, 290);
    context.font = '30px "Microsoft YaHei", sans-serif';
    context.fillStyle = 'rgba(243, 236, 228, .75)';
    const wrapped = text.split('\n').flatMap((line) => {
      const output = [];
      let rest = line;
      while (rest.length > 24) {
        output.push(rest.slice(0, 24));
        rest = rest.slice(24);
      }
      output.push(rest);
      return output;
    });
    wrapped.slice(0, 22).forEach((line, index) => context.fillText(line, 105, 390 + index * 45));
    context.fillStyle = '#d0ad76';
    context.fillRect(105, 1190, 870, 2);
    context.font = '24px "Microsoft YaHei", sans-serif';
    context.fillText('等你入席。', 105, 1242);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], 'OURS-tonight-menu.png', { type: 'image/png' }) : null;
  }

  async function shareOrder() {
    const text = $('#orderSuccessCopy')?.textContent?.trim();
    if (!text) return;
    try {
      const file = await buildOrderCardFile(text);
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: 'OURS · 今晚的桌', text: '今晚，等你入席。', files: [file] });
        return;
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
    await shareText('OURS · 今晚的桌', text);
  }

  function focusWish(id) {
    const item = $(`[data-wish-id="${CSS.escape(id)}"]`);
    if (!item) return;
    $('#wishes')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
    item.classList.add('is-focused');
    window.setTimeout(() => {
      item.classList.remove('is-focused');
      item.querySelector('button')?.focus({ preventScroll: true });
    }, reducedMotion ? 0 : 650);
  }
  function bindSecondPass() {
    $('#openProfile')?.addEventListener('click', openProfile);
    $('#openProfileMobile')?.addEventListener('click', () => {
      if (document.body.classList.contains('menu-open')) $('#menuToggle')?.click();
      openProfile();
    });
    $('#closeProfile')?.addEventListener('click', closeProfile);
    $('#profileBackdrop')?.addEventListener('click', closeProfile);
    $('#profileBody')?.addEventListener('submit', (event) => {
      if (event.target.id === 'profileForm') saveProfile(event);
    });
    $('#profileBody')?.addEventListener('change', async (event) => {
      if (event.target.id !== 'profilePhoto') return;
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        profilePhotoBlob = await compressProfilePhoto(file);
        profileRemovePhoto = false;
        if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
        profilePhotoUrl = URL.createObjectURL(profilePhotoBlob);
        $('#profilePhotoPreview').src = profilePhotoUrl;
        $('#profilePhotoStatus').textContent = '新封面已经准备好';
        toast('封面照片已经准备好。');
      } catch (error) {
        profilePhotoBlob = null;
        toast(error.message || '封面照片处理失败。');
      }
    });
    $('#profileBody')?.addEventListener('click', (event) => {
      if (!event.target.closest('#removeProfilePhoto')) return;
      profilePhotoBlob = null;
      profileRemovePhoto = true;
      if (profilePhotoUrl) URL.revokeObjectURL(profilePhotoUrl);
      profilePhotoUrl = '';
      $('#profilePhotoPreview').src = 'assets/photo-01.svg';
      $('#profilePhotoStatus').textContent = '保存后会恢复默认占位图';
    });

    $('#openYearReview')?.addEventListener('click', () => renderYearReview());
    $('#closeYearReview')?.addEventListener('click', () => closeLayer($('#yearReviewLayer'), $('.year-review-dialog')));
    $('#yearReviewBackdrop')?.addEventListener('click', () => closeLayer($('#yearReviewLayer'), $('.year-review-dialog')));
    $('#shareOrder')?.addEventListener('click', shareOrder);

    $('#closeCookingMode')?.addEventListener('click', closeCookingMode);
    $('#cookingModeBackdrop')?.addEventListener('click', closeCookingMode);
    $('#cookPause')?.addEventListener('click', closeCookingMode);
    $('#cookPrev')?.addEventListener('click', () => {
      cookingModeStep = Math.max(0, cookingModeStep - 1);
      renderCookingStep();
    });
    $('#cookNext')?.addEventListener('click', () => {
      const dish = api.allDishes().find((item) => item.id === cookingModeDishId);
      if (!dish) return;
      const state = api.dishState(cookingModeDishId);
      if (!state.steps[cookingModeStep] && !markCookingStepDone()) return;
      cookingModeStep = Math.min(dish.steps.length - 1, cookingModeStep + 1);
      renderCookingStep();
    });
    $('#cookTimerStart')?.addEventListener('click', startCookTimer);
    $('#cookTimerReset')?.addEventListener('click', resetCookTimer);
    $('#cookModeFinish')?.addEventListener('click', openCookingResult);

    $('#closeCookingResult')?.addEventListener('click', () => closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog')));
    $('#cookingResultBackdrop')?.addEventListener('click', () => closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog')));
    $('#cookingResultBody')?.addEventListener('submit', (event) => {
      if (event.target.id === 'cookingResultForm') saveCookingResult(event);
    });
    $('#cookingResultBody')?.addEventListener('change', async (event) => {
      if (event.target.id !== 'resultCookPhoto') return;
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        resultPhotoBlob = await compressResultPhoto(file);
        if (resultPhotoUrl) URL.revokeObjectURL(resultPhotoUrl);
        resultPhotoUrl = URL.createObjectURL(resultPhotoBlob);
        $('#resultCookPhotoPreview').src = resultPhotoUrl;
        toast('成品照片已经准备好。');
      } catch (error) {
        resultPhotoBlob = null;
        toast(error.message || '成品照片处理失败。');
      }
    });
    $('#cookingHistory')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cooking-log-id]');
      const dishId = $('#dishModalTitle').dataset.dishId;
      if (!button || !dishId) return;
      openCookingLogMemory(dishId, button.dataset.cookingLogId);
    });
    $('#cookingResultSuccess')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cook-result]');
      if (!button) return;
      if (button.dataset.cookResult === 'memory') openResultAsMemory();
      if (button.dataset.cookResult === 'share') shareCookingResult();
      if (button.dataset.cookResult === 'close') closeLayer($('#cookingResultLayer'), $('.cooking-result-dialog'));
    });

    document.addEventListener('ours:start-cooking', (event) => {
      if (event.detail?.id) openCookingMode(event.detail.id);
    });    document.addEventListener('ours:dish-opened', (event) => {
      if (event.detail?.id) renderCookingHistory(event.detail.id);
    });
    document.addEventListener('ours:wish-memory', (event) => {
      if (event.detail?.id) openWishMemory(event.detail.id);
    });
    document.addEventListener('ours:focus-wish', (event) => {
      if (event.detail?.id) focusWish(event.detail.id);
    });
    document.addEventListener('ours:data-changed', () => {
      renderRecent();
      if (lastResult && !$('#cookingResultSuccess').hidden) renderCookingResultSuccess();
      const openDishId = $('#dishModalTitle').dataset.dishId;
      if (openDishId && !$('#dishLayer').hidden) renderCookingHistory(openDishId);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && timerEnd) renderTimer();
    });

    document.addEventListener('keydown', (event) => {
      const layers = [
        [$('#profileLayer'), $('.profile-dialog')],
        [$('#yearReviewLayer'), $('.year-review-dialog')],
        [$('#cookingResultLayer'), $('.cooking-result-dialog')],
        [$('#cookingModeLayer'), $('.cooking-mode-dialog')],
      ];
      const top = layers.find(([layer]) => layer && !layer.hidden);
      if (event.key === 'Escape' && top) {
        event.preventDefault();
        closeLayer(top[0], top[1]);
        return;
      }
      if (event.key !== 'Tab' || !top) return;
      const focusable = $$('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href]', top[1])
        .filter((element) => element.offsetParent !== null);
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
  }

  function syncModalScroll() {
    const visible = $('.modal-layer:not([hidden]), .drawer-layer:not([hidden]), .install-layer:not([hidden])');
    document.body.classList.toggle('modal-open', Boolean(visible));
  }

  function initSecondPass() {
    bindSecondPass();
    applyHeroProfile();
    renderRecent();
    syncModalScroll();
    const observer = new MutationObserver(syncModalScroll);
    observer.observe(document.body, { attributes: true, attributeFilter: ['hidden'], subtree: true });
  }

  window.OURS_SECOND_PASS_API = {
    openCookingMode,
    openProfile,
    renderRecent,
    renderYearReview,
    openResultAsMemory,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSecondPass, { once: true });
  } else {
    initSecondPass();
  }
})();