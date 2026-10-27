(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const config = window.OURS_CLOUD_CONFIG || {};
  const store = window.OURS_STORE;
  const sessionKey = 'ours-cloud-session-v1';
  const syncMetaKey = 'ours-cloud-sync-v1';
  const queueKey = 'ours-cloud-queue-v1';
  const conflictsKey = 'ours-cloud-conflicts-v1';
  const settingsKey = 'ours-cloud-settings-v1';
  const coupleKey = 'ours-cloud-couple-v1';
  const configured = Boolean(String(config.url || '').match(/^https?:\/\//) && String(config.anonKey || '').length > 20);
  const configuredLocalhost = Boolean(String(config.url || '').match(/^http:\/\/(127\.0\.0\.1|localhost)/));
  const cloudEnabled = configured && (String(config.url).startsWith('https://') || configuredLocalhost);
  const bucket = config.coupleBucket || 'ours-couple-media';
  const localRecordKeys = [
    'ours-supper-cart-v2', 'ours-supper-last-order-v2', 'ours-custom-dishes-v1',
    'ours-supper-wishes-v2', 'ours-supper-heart-v2', 'ours-memories-v1',
    'ours-cooking-v1', 'ours-shopping-v1', 'ours-next-meeting-v1',
    'ours-daily-notes-v1', 'ours-date-ideas-v1', 'ours-questions-v1',
    'ours-quiz-results-v1', 'ours-profile-v1', 'ours-events-v1',
    'ours-reminders-v1', 'ours-weekly-menu-v1', 'ours-todos-v1',
    'ours-gifts-v1', 'ours-preferences-v1', 'ours-diary-drafts-v1'
  ];
  const recordLabels = {
    'ours-supper-wishes-v2': '共同愿望',
    'ours-memories-v1': '回忆与照片关联',
    'ours-events-v1': '日程',
    'ours-reminders-v1': '提醒设置',
    'ours-weekly-menu-v1': '每周菜单',
    'ours-shopping-v1': '采购清单',
    'ours-todos-v1': '共同待办',
    'ours-gifts-v1': '礼物',
    'ours-preferences-v1': '喜好',
    'ours-daily-notes-v1': '日记',
    'ours-diary-drafts-v1': '日记草稿',
    'ours-profile-v1': '双人档案',
    'ours-cooking-v1': '做菜记录',
  };

  let session = store?.getJSON(sessionKey, null) || null;
  let syncMeta = store?.getJSON(syncMetaKey, {}) || {};
  let queue = store?.getJSON(queueKey, []) || [];
  let conflicts = store?.getJSON(conflictsKey, {}) || {};
  let settings = store?.getJSON(settingsKey, { autoSync: true, syncEnabled: false }) || { autoSync: true, syncEnabled: false };
  if (typeof settings.syncEnabled !== 'boolean') settings.syncEnabled = false;
  let couple = store?.getJSON(coupleKey, null) || null;
  let applyingRemote = false;
  let remoteAppliedThisSync = false;
  let syncing = false;
  let syncTimer = 0;
  let statusText = cloudEnabled ? '尚未登录' : '尚未配置';
  let lastError = '';
  let registrationHint = '';

  function saveLocal(key, value) {
    return store?.setJSON(key, value) || false;
  }

  function baseUrl(path = '') {
    return `${String(config.url || '').replace(/\/$/, '')}${path}`;
  }

  function headers(withAuth = true) {
    const result = {
      apikey: config.anonKey,
      'Content-Type': 'application/json',
    };
    if (withAuth && session?.access_token) result.Authorization = `Bearer ${session.access_token}`;
    return result;
  }

  function normalizeSession(payload) {
    if (!payload?.access_token) return null;
    return {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token || '',
      expires_at: Number(payload.expires_at) || Math.floor(Date.now() / 1000) + Math.max(30, Number(payload.expires_in) || 3600),
      token_type: payload.token_type || 'bearer',
      user: payload.user || session?.user || null,
    };
  }

  function persistSession(next) {
    session = next;
    if (next) saveLocal(sessionKey, next);
    else localStorage.removeItem(sessionKey);
  }

  async function refreshSession() {
    if (!session?.refresh_token || !cloudEnabled) return null;
    const response = await fetch(baseUrl('/auth/v1/token?grant_type=refresh_token'), {
      method: 'POST',
      headers: headers(false),
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) {
      persistSession(null);
      return null;
    }
    const next = normalizeSession(await response.json());
    if (next) persistSession(next);
    return next;
  }

  async function apiFetch(path, options = {}, retry = true) {
    if (!cloudEnabled) throw new Error('云端尚未配置。');
    if (session?.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 30) await refreshSession();
    const response = await fetch(baseUrl(path), {
      ...options,
      headers: { ...headers(options.auth !== false), ...(options.headers || {}) },
    });
    if (response.status === 401 && retry && session?.refresh_token) {
      await refreshSession();
      return apiFetch(path, options, false);
    }
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || `云端请求失败 (${response.status})`);
    return data;
  }

  async function rpc(functionName, args = {}) {
    return apiFetch(`/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      body: JSON.stringify(args),
    });
  }

  async function signIn(email, password) {
    const payload = await apiFetch('/auth/v1/token?grant_type=password', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    persistSession(normalizeSession(payload));
    statusText = '已登录';
    await loadCouple();
    renderCloudPanel();
  }

  async function signUp(email, password, displayName) {
    const payload = await apiFetch('/auth/v1/signup', {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email, password, data: { display_name: displayName || '' } }),
    });
    if (payload?.access_token) persistSession(normalizeSession(payload));
    else registrationHint = payload?.user?.identities?.length === 0 ? '这个邮箱已经注册，请直接登录。' : '账号已创建，请检查邮箱并完成验证后登录。';
    await loadCouple();
    renderCloudPanel();
  }

  async function signOut() {
    try { if (session?.access_token) await apiFetch('/auth/v1/logout', { method: 'POST' }); } catch {}
    persistSession(null);
    couple = null;
    saveLocal(coupleKey, null);
    statusText = '已退出云端';
    renderCloudPanel();
  }

  async function loadCouple() {
    if (!session?.access_token) { couple = null; return null; }
    const result = await rpc('ours_my_couple');
    const row = Array.isArray(result) ? result[0] : result;
    couple = row?.couple_id ? { id: row.couple_id, name: row.name || '我们的双人空间' } : null;
    saveLocal(coupleKey, couple);
    return couple;
  }

  async function createCouple(name) {
    const result = await rpc('ours_create_couple', { p_name: name || '我们的双人空间' });
    const row = Array.isArray(result) ? result[0] : result;
    couple = { id: row?.couple_id || row?.id, name: row?.name || name || '我们的双人空间' };
    saveLocal(coupleKey, couple);
    renderCloudPanel();
    return couple;
  }

  async function createInvite() {
    if (!couple?.id) throw new Error('请先创建双人空间。');
    const result = await rpc('ours_create_invite', { p_couple_id: couple.id });
    const row = Array.isArray(result) ? result[0] : result;
    return row?.invite_code || row?.token || String(row || '');
  }

  async function acceptInvite(code) {
    const result = await rpc('ours_accept_invite', { p_token: String(code || '').trim() });
    const row = Array.isArray(result) ? result[0] : result;
    couple = { id: row?.couple_id || row?.id, name: row?.name || '我们的双人空间' };
    saveLocal(coupleKey, couple);
    renderCloudPanel();
    return couple;
  }
  function getMeta(key) {
    return syncMeta.versions?.[key] ? { version: syncMeta.versions[key], raw: syncMeta.syncedRaw?.[key] || '' } : { version: 0, raw: '' };
  }

  function setMeta(key, version, raw) {
    if (!syncMeta.versions) syncMeta.versions = {};
    if (!syncMeta.syncedRaw) syncMeta.syncedRaw = {};
    syncMeta.versions[key] = Number(version) || 0;
    syncMeta.syncedRaw[key] = raw;
    saveLocal(syncMetaKey, syncMeta);
  }

  function currentRaw(key) {
    return localStorage.getItem(key);
  }

  function removeQueueKey(key) {
    queue = queue.filter((item) => item.key !== key);
    saveLocal(queueKey, queue);
  }

  function enqueueLocalChange(key, { force = false } = {}) {
    if (!couple?.id || !cloudEnabled || !settings.syncEnabled) return false;
    const raw = currentRaw(key);
    if (raw === null || (!force && raw === getMeta(key).raw)) return false;
    if (conflicts[key]) return false;
    let payload;
    try { payload = JSON.parse(raw); } catch { return false; }
    removeQueueKey(key);
    queue.push({
      mutationId: crypto.randomUUID(),
      key,
      payload,
      raw,
      baseVersion: getMeta(key).version,
      createdAt: new Date().toISOString(),
    });
    saveLocal(queueKey, queue);
    return true;
  }

  function scanLocalChanges() {
    if (applyingRemote) return;
    localRecordKeys.forEach((key) => enqueueLocalChange(key));
  }

  async function flushQueue() {
    if (!session?.access_token || !couple?.id || !navigator.onLine) return;
    const pending = queue.slice();
    for (const item of pending) {
      try {
        const response = await rpc('ours_push_record', {
          p_couple_id: couple.id,
          p_record_key: item.key,
          p_payload: item.payload,
          p_base_version: item.baseVersion,
          p_mutation_id: item.mutationId,
        });
        const row = Array.isArray(response) ? response[0] : response;
        if (row?.status === 'ok') {
          setMeta(item.key, row.version, item.raw);
          removeQueueKey(item.key);
        } else {
          conflicts[item.key] = {
            key: item.key,
            local: item.payload,
            localRaw: item.raw,
            remote: row?.payload ?? null,
            remoteVersion: Number(row?.version) || 0,
            detectedAt: new Date().toISOString(),
          };
          removeQueueKey(item.key);
          saveLocal(conflictsKey, conflicts);
        }
      } catch (error) {
        lastError = error.message || '同步失败';
        break;
      }
    }
  }

  function applyRemoteRecord(key, payload, version) {
    applyingRemote = true;
    try {
      store.setJSON(key, payload);
      const raw = JSON.stringify(payload);
      setMeta(key, version, raw);
    } finally {
      applyingRemote = false;
    }
  }

  async function pullRecords() {
    if (!session?.access_token || !couple?.id || !navigator.onLine) return;
    const rows = await rpc('ours_list_records', { p_couple_id: couple.id });
    if (!Array.isArray(rows)) return;
    rows.forEach((row) => {
      if (!localRecordKeys.includes(row.record_key)) return;
      const meta = getMeta(row.record_key);
      const localRaw = currentRaw(row.record_key);
      const localChanged = localRaw !== null && localRaw !== meta.raw;
      if (localChanged && Number(row.version) > meta.version) {
        conflicts[row.record_key] = {
          key: row.record_key,
          local: JSON.parse(localRaw),
          localRaw,
          remote: row.payload,
          remoteVersion: Number(row.version),
          detectedAt: new Date().toISOString(),
        };
        saveLocal(conflictsKey, conflicts);
        return;
      }
      if (Number(row.version) > meta.version || localRaw === null) {
        applyRemoteRecord(row.record_key, row.payload, Number(row.version));
        remoteAppliedThisSync = true;
      }
    });
  }

  async function uploadPhoto(photoId, blob) {
    const path = `${couple.id}/${photoId}`;
    const response = await fetch(baseUrl(`/storage/v1/object/${bucket}/${path}`), {
      method: 'POST',
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': blob.type || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: blob,
    });
    if (!response.ok) throw new Error(`照片 ${photoId} 上传失败。`);
    await rpc('ours_register_photo', {
      p_couple_id: couple.id,
      p_photo_id: String(photoId),
      p_storage_path: path,
      p_content_type: blob.type || 'application/octet-stream',
    });
  }

  async function downloadPhoto(photo) {
    const response = await apiFetch(`/storage/v1/object/sign/${bucket}/${photo.storage_path}`, {
      method: 'POST',
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    const signed = response?.signedURL || response?.signedUrl || response;
    const url = String(signed || '').startsWith('http') ? signed : baseUrl(`/storage/v1/${String(signed || '').replace(/^\//, '')}`);
    const file = await fetch(url);
    if (!file.ok) throw new Error('云端照片下载失败。');
    await store.putPhoto(photo.id, await file.blob());
  }

  async function syncPhotos() {
    if (!session?.access_token || !couple?.id || !navigator.onLine) return;
    const remotePhotos = await rpc('ours_list_photos', { p_couple_id: couple.id });
    const remoteMap = new Map(Array.isArray(remotePhotos) ? remotePhotos.map((photo) => [photo.id, photo]) : []);
    const localPhotos = await store.listPhotos();
    const localMap = new Map(localPhotos.map((photo) => [photo.id, photo.blob]));
    for (const [photoId, blob] of localMap) {
      if (!remoteMap.has(photoId)) await uploadPhoto(photoId, blob);
    }
    for (const [photoId, photo] of remoteMap) {
      if (!localMap.has(photoId)) {
        await downloadPhoto(photo);
        remoteAppliedThisSync = true;
      }
    }
  }

  async function syncNow({ manual = false } = {}) {
    if (!session?.access_token || !couple?.id) {
      if (manual) registrationHint = '请先登录并加入双人空间。';
      renderCloudPanel();
      return false;
    }
    if (!settings.syncEnabled) {
      statusText = '等待开启双向同步';
      if (manual) registrationHint = '请先确认上传本机记录与照片，再开启双向同步。';
      renderCloudPanel();
      return false;
    }
    if (syncing) return false;
    if (!navigator.onLine) {
      statusText = '当前离线，修改已留在本机';
      renderCloudPanel();
      return false;
    }
    syncing = true;
    statusText = '正在同步…';
    lastError = '';
    renderCloudPanel();
    try {
      scanLocalChanges();
      await flushQueue();
      await pullRecords();
      await syncPhotos();
      syncMeta.lastSyncAt = new Date().toISOString();
      saveLocal(syncMetaKey, syncMeta);
      statusText = Object.keys(conflicts).length ? `发现 ${Object.keys(conflicts).length} 处冲突` : '已同步';
      if (remoteAppliedThisSync) document.dispatchEvent(new CustomEvent('ours:data-changed', { detail: { source: 'cloud' } }));
    } catch (error) {
      lastError = error.message || '同步失败';
      statusText = '同步失败';
    } finally {
      syncing = false;
      renderCloudPanel();
    }
    return !lastError;
  }

  function resolveConflict(key, choice) {
    const conflict = conflicts[key];
    if (!conflict) return;
    if (choice === 'remote') {
      applyRemoteRecord(key, conflict.remote, conflict.remoteVersion);
    } else {
      setMeta(key, conflict.remoteVersion, '');
      enqueueLocalChange(key, { force: true });
    }
    delete conflicts[key];
    saveLocal(conflictsKey, conflicts);
    renderCloudPanel();
    syncNow({ manual: true });
  }

  function scheduleSync() {
    if (!settings.autoSync || !settings.syncEnabled || !session?.access_token || !couple?.id) return;
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => syncNow(), 850);
  }
  function cloudStatusLabel() {
    if (!cloudEnabled) return '未配置';
    if (!session?.access_token) return '本地模式';
    if (!couple?.id) return '等待配对';
    if (lastError) return '需要处理';
    return syncing ? '同步中' : '双人云端已连接';
  }

  function renderConflicts() {
    const items = Object.values(conflicts);
    if (!items.length) return '<p class="cloud-empty">没有待处理冲突。</p>';
    return `<div class="cloud-conflict-list">${items.map((item) => {
      const label = recordLabels[item.key] || item.key;
      const localPreview = JSON.stringify(item.local).slice(0, 160);
      const remotePreview = JSON.stringify(item.remote).slice(0, 160);
      return `<article class="cloud-conflict"><div><strong>${escapeHTML(label)}</strong><small>两端都修改了同一部分</small></div><p>本机：${escapeHTML(localPreview)}</p><p>云端：${escapeHTML(remotePreview)}</p><div><button type="button" data-cloud-resolve="local" data-cloud-key="${escapeHTML(item.key)}">保留本机</button><button type="button" data-cloud-resolve="remote" data-cloud-key="${escapeHTML(item.key)}">使用云端</button></div></article>`;
    }).join('')}</div>`;
  }

  function renderCloudPanel() {
    const body = $('#cloudBody');
    if (!body) return;
    const badge = $('#cloudStatusBadge');
    if (badge) {
      badge.textContent = cloudStatusLabel();
      badge.dataset.state = cloudEnabled ? (couple?.id ? 'connected' : 'local') : 'disabled';
    }
    if (session?.access_token && couple?.id) {
      const feedback = $('.cloud-feedback', body);
      if (feedback) feedback.textContent = lastError || statusText || '';
    }
    if (!cloudEnabled) {
      if (body.dataset.renderState === 'disabled') return;
      body.dataset.renderState = 'disabled';
      body.innerHTML = `<div class="cloud-setup"><strong>Cloud Couple Mode 尚未启用</strong><p>当前仍是 Local Mode。要启用安全的双人同步，需要先配置 Supabase Project URL 和公开 anon key，并执行项目内的 SQL 权限脚本。</p><ol><li>打开 <code>supabase/schema.sql</code>，在 Supabase SQL Editor 执行。</li><li>在 <code>cloud-config.js</code> 填写 URL 和 anon key。</li><li>重新打开 OURS，登录并创建或加入双人空间。</li></ol><small>不要把 service_role key、数据库密码或真实暗号写进前端。</small></div>`;
      return;
    }
    if (!session?.access_token) {
      const state = `auth:${registrationHint}:${lastError}`;
      if (body.dataset.renderState === state) return;
      body.dataset.renderState = state;
      body.innerHTML = `<form class="cloud-auth-form" id="cloudAuthForm"><div class="cloud-form-intro"><strong>登录后，才会访问私人云端数据</strong><small>未登录时，页面不会预加载任何远程记录或照片。</small></div><div class="cloud-fields"><label class="field">邮箱<input id="cloudEmail" type="email" autocomplete="email" required placeholder="you@example.com" /></label><label class="field">密码<input id="cloudPassword" type="password" autocomplete="current-password" minlength="8" required placeholder="至少 8 位" /></label><label class="field">昵称（创建账号时）<input id="cloudDisplayName" maxlength="30" placeholder="可选" /></label></div><div class="cloud-actions"><button class="primary-button" type="button" data-cloud-action="login">登录</button><button class="text-button" type="button" data-cloud-action="signup">创建账号</button></div><p class="cloud-feedback" id="cloudFeedback" role="status">${escapeHTML(lastError || registrationHint || '')}</p></form>`;
      return;
    }
    if (!couple?.id) {
      const state = `pair:${session.user?.email || ''}:${registrationHint}:${lastError}`;
      if (body.dataset.renderState === state) return;
      body.dataset.renderState = state;
      body.innerHTML = `<div class="cloud-account"><div><span>已登录</span><strong>${escapeHTML(session.user?.email || 'OURS 用户')}</strong></div><button type="button" data-cloud-action="logout">退出</button></div><div class="cloud-pair-grid"><form class="cloud-pair-card" id="cloudCreateCoupleForm"><strong>创建双人空间</strong><small>创建后会生成一次性邀请码。</small><label class="field">空间名称<input id="cloudCoupleName" maxlength="40" placeholder="我们的双人空间" /></label><button class="primary-button" type="button" data-cloud-action="create-couple">创建空间</button></form><form class="cloud-pair-card" id="cloudJoinCoupleForm"><strong>加入对方的空间</strong><small>粘贴对方生成的一次性邀请码。</small><label class="field">邀请码<input id="cloudInviteCode" required placeholder="输入邀请码" /></label><button class="primary-button" type="button" data-cloud-action="join-couple">加入空间</button></form></div><p class="cloud-feedback" id="cloudFeedback" role="status">${escapeHTML(lastError || registrationHint || '')}</p>`;
      return;
    }
    const queued = queue.length;
    const conflictCount = Object.keys(conflicts).length;
    const lastSync = syncMeta.lastSyncAt ? new Date(syncMeta.lastSyncAt).toLocaleString('zh-CN') : '尚未同步';
    const state = `couple:${couple.id}:${couple.name || ''}:${session.user?.email || ''}:${queued}:${conflictCount}:${syncMeta.lastSyncAt || ''}:${lastError}:${settings.autoSync}:${settings.syncEnabled}:${registrationHint}`;
    if (body.dataset.renderState === state) return;
    body.dataset.renderState = state;
    const syncActions = settings.syncEnabled
      ? `<div class="cloud-actions cloud-actions-wide"><button class="primary-button" type="button" data-cloud-action="sync">立即同步</button><button type="button" data-cloud-action="invite">生成邀请码</button><label class="cloud-toggle"><input id="cloudAutoSync" type="checkbox" ${settings.autoSync !== false ? 'checked' : ''} />自动同步</label><button type="button" data-cloud-action="disable-sync">暂停同步</button></div>`
      : `<div class="cloud-consent"><div><span>PRIVATE BY DEFAULT</span><strong>先确认，再同步</strong><small>开启后会读取云端私人内容，并把本机已有的记录与相册照片上传到这个双人空间。只有你们两位成员可以访问。</small></div><button class="primary-button" type="button" data-cloud-action="enable-sync">确认并开启双向同步</button></div>`;
    body.innerHTML = `<div class="cloud-account"><div><span>双人空间</span><strong>${escapeHTML(couple.name || '我们的双人空间')}</strong><small>${escapeHTML(session.user?.email || '')}</small></div><button type="button" data-cloud-action="logout">退出</button></div><div class="cloud-stats"><div><span>待上传修改</span><strong>${queued}</strong></div><div><span>待处理冲突</span><strong>${conflictCount}</strong></div><div><span>最近同步</span><strong>${escapeHTML(lastSync)}</strong></div></div>${syncActions}<p class="cloud-feedback" role="status">${escapeHTML(lastError || statusText || '')}</p><p class="cloud-invite-result" id="cloudInviteResult">${escapeHTML(registrationHint || '')}</p><div class="cloud-conflicts"><h3>冲突与选择</h3>${renderConflicts()}</div><div class="cloud-footnote">云端仅保存你已经登录授权的内容。退出账号不会自动删除本地数据；删除云端空间需要在账户设置中显式操作。</div>`;
  }

  async function handleCloudAction(action, button) {
    lastError = '';
    const feedback = $('#cloudFeedback');
    try {
      if (action === 'login') {
        const email = $('#cloudEmail').value.trim();
        const password = $('#cloudPassword').value;
        if (!email || !password) throw new Error('请填写邮箱和密码。');
        await signIn(email, password);
        if (couple?.id) await syncNow({ manual: true });
        return;
      }
      if (action === 'signup') {
        const email = $('#cloudEmail').value.trim();
        const password = $('#cloudPassword').value;
        if (!email || password.length < 8) throw new Error('请填写邮箱和至少 8 位密码。');
        await signUp(email, password, $('#cloudDisplayName').value.trim());
        return;
      }
      if (action === 'logout') { await signOut(); return; }
      if (action === 'create-couple') {
        await createCouple($('#cloudCoupleName')?.value.trim());
        statusText = '双人空间已创建，等待开启双向同步';
        renderCloudPanel();
        return;
      }
      if (action === 'join-couple') {
        await acceptInvite($('#cloudInviteCode')?.value);
        statusText = '已加入双人空间，等待开启双向同步';
        renderCloudPanel();
        return;
      }
      if (action === 'enable-sync') {
        settings.syncEnabled = true;
        settings.autoSync = true;
        saveLocal(settingsKey, settings);
        statusText = '正在开启双向同步…';
        scanLocalChanges();
        await syncNow({ manual: true });
        return;
      }
      if (action === 'disable-sync') {
        settings.syncEnabled = false;
        saveLocal(settingsKey, settings);
        window.clearTimeout(syncTimer);
        statusText = '双向同步已暂停';
        renderCloudPanel();
        return;
      }
      if (action === 'invite') {
        const code = await createInvite();
        const result = $('#cloudInviteResult');
        if (result) result.textContent = `一次性邀请码：${code}`;
        return;
      }
      if (action === 'sync') { await syncNow({ manual: true }); return; }
      const resolve = button.dataset.cloudResolve;
      if (resolve) { resolveConflict(button.dataset.cloudKey, resolve); return; }
    } catch (error) {
      lastError = error.message || '操作失败';
      if (feedback) feedback.textContent = lastError;
      renderCloudPanel();
    }
  }

  function bindCloudPanel() {
    const root = $('#cloudSync');
    if (!root) return;
    root.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cloud-action], [data-cloud-resolve]');
      if (!button) return;
      const action = button.dataset.cloudAction || 'resolve';
      button.disabled = true;
      handleCloudAction(action, button).finally(() => { button.disabled = false; });
    });
    root.addEventListener('change', (event) => {
      if (event.target.id !== 'cloudAutoSync') return;
      settings.autoSync = event.target.checked;
      saveLocal(settingsKey, settings);
      if (settings.autoSync) scheduleSync();
    });
  }

  function buildCloudPanel() {
    const usView = $('[data-app-view="us"]');
    if (!usView || $('#cloudSync')) return;
    const section = document.createElement('section');
    section.className = 'app-module-section cloud-sync';
    section.id = 'cloudSync';
    section.innerHTML = `<header class="app-module-heading"><div><span>Cloud couple mode</span><h2>双人云端空间</h2></div><span class="cloud-status" id="cloudStatusBadge">尚未配置</span></header><div class="cloud-body" id="cloudBody"></div>`;
    const footer = $('.app-site-footer', usView);
    usView.insertBefore(section, footer || null);
    bindCloudPanel();
    renderCloudPanel();
  }

  async function restoreCloudSession() {
    if (!cloudEnabled || !session?.access_token) return;
    if (session.expires_at && session.expires_at < Math.floor(Date.now() / 1000) + 30) await refreshSession();
    if (!session?.access_token) return;
    try { await loadCouple(); } catch (error) { lastError = error.message; }
    renderCloudPanel();
    if (couple?.id && settings.syncEnabled && settings.autoSync !== false) window.setTimeout(() => syncNow(), 500);
  }

  document.addEventListener('ours:data-changed', (event) => {
    if (event.detail?.source === 'cloud' || !session?.access_token || !couple?.id || !settings.syncEnabled || applyingRemote) return;
    scanLocalChanges();
    renderCloudPanel();
    scheduleSync();
  });
  window.addEventListener('online', () => { statusText = '网络已恢复'; scheduleSync(); renderCloudPanel(); });
  window.addEventListener('offline', () => { statusText = '当前离线，修改已留在本机'; renderCloudPanel(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && settings.syncEnabled && session?.access_token && couple?.id) syncNow(); });
  window.setInterval(() => { if (settings.autoSync && settings.syncEnabled && session?.access_token && couple?.id && navigator.onLine) syncNow(); }, 60000);

  buildCloudPanel();
  restoreCloudSession();

  window.OURS_CLOUD = {
    configured: cloudEnabled,
    signIn,
    signUp,
    signOut,
    createCouple,
    createInvite,
    acceptInvite,
    syncNow,
    getStatus: () => ({ statusText, lastError, syncing, queue: queue.length, conflicts: Object.keys(conflicts).length }),
  };
})();
