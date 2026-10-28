(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const cloudConfig = window.OURS_CLOUD_CONFIG || {};
  const store = window.OURS_STORE;
  const PENDING_KEY = 'ours-push-pending-v1';
  const CACHE_KEY = 'ours-notification-cache-v1';
  const CATEGORY_META = {
    memories: { label: '回忆', icon: '◌' },
    dates: { label: '约会', icon: '◇' },
    wishes: { label: '愿望', icon: '✦' },
    messages: { label: '留言', icon: '✉' },
    todos: { label: '待办', icon: '✓' },
    life: { label: '生活', icon: '⌂' },
    system: { label: '通知', icon: '○' },
  };
  const DEFAULT_PREFERENCES = {
    push_enabled: false,
    memory_events: true,
    date_events: true,
    wish_events: true,
    message_events: true,
    todo_events: true,
    life_events: true,
    quiet_start: '',
    quiet_end: '',
    timezone: '',
    hide_preview: true,
  };

  let notifications = [];
  let unreadCount = 0;
  let preferences = { ...DEFAULT_PREFERENCES };
  let loading = false;
  let panelOpen = false;
  let settingsOpen = false;
  let currentDevice = { status: 'checking', detail: '正在检查通知能力…' };
  let pendingTarget = null;
  let pollTimer = 0;
  let panelReturnFocus = null;
  let settingsReturnFocus = null;

  function cloudApi() {
    return window.OURS_CLOUD;
  }

  function authState() {
    return cloudApi()?.getAuth?.() || {
      configured: false,
      authenticated: false,
      paired: false,
      syncEnabled: false,
      notificationBaselineReady: false,
    };
  }

  function toast(message) {
    window.OURS_APP?.showToast?.(message);
  }

  function friendlyError(error) {
    const message = String(error?.message || error || '操作失败');
    if (/failed to fetch|networkerror|load failed|fetch failed|econnreset|connection reset/i.test(message)) {
      return '无法连接 Supabase。请检查网络；受限网络可能需要 VPN 或可用的自定义域名。';
    }
    return message;
  }

  function formatNotificationTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const delta = Date.now() - date.getTime();
    if (delta < 60000) return '刚刚';
    if (delta < 3600000) return `${Math.max(1, Math.floor(delta / 60000))} 分钟前`;
    if (delta < 86400000) return `${Math.floor(delta / 3600000)} 小时前`;
    return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
  }

  function devicePlatform() {
    return navigator.userAgentData?.platform || navigator.platform || 'Web';
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isStandalone() {
    return window.matchMedia?.('(display-mode: standalone)')?.matches
      || window.navigator.standalone === true;
  }

  function pushCapability() {
    const supported = window.isSecureContext
      && 'serviceWorker' in navigator
      && 'PushManager' in window
      && 'Notification' in window;
    const permission = supported ? Notification.permission : 'unsupported';
    const hasVapid = String(cloudConfig.vapidPublicKey || '').length > 40;
    let reason = '';
    if (!window.isSecureContext) reason = '通知需要 HTTPS 安全连接。';
    else if (!supported) reason = '当前浏览器不支持标准 Web Push。';
    else if (isIOS() && !isStandalone()) reason = 'iPhone 需要先从主屏幕打开 OURS。';
    else if (!hasVapid) reason = '服务端 VAPID 公钥尚未配置。';
    return { supported, permission, hasVapid, standalone: isStandalone(), ios: isIOS(), reason };
  }

  function categoryEnabled(category) {
    const keyById = {
      memories: 'memory_events',
      dates: 'date_events',
      wishes: 'wish_events',
      messages: 'message_events',
      todos: 'todo_events',
      life: 'life_events',
    };
    return preferences[keyById[category]] !== false;
  }

  function normalizePreferences(row = {}) {
    return {
      ...DEFAULT_PREFERENCES,
      ...row,
      quiet_start: row.quiet_start ? String(row.quiet_start).slice(0, 5) : '',
      quiet_end: row.quiet_end ? String(row.quiet_end).slice(0, 5) : '',
      timezone: row.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      hide_preview: row.hide_preview !== false,
    };
  }

  function savePendingTarget(target) {
    pendingTarget = target;
    if (target) sessionStorage.setItem(PENDING_KEY, JSON.stringify(target));
    else sessionStorage.removeItem(PENDING_KEY);
  }

  function readPendingTargetFromStorage() {
    try {
      const value = JSON.parse(sessionStorage.getItem(PENDING_KEY) || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  }

  function readPendingTargetFromUrl() {
    const url = new URL(location.href);
    const eventId = url.searchParams.get('push_event');
    if (!eventId) return null;
    const target = {
      eventId,
      route: url.searchParams.get('push_route') || '',
      anchor: url.searchParams.get('push_anchor') || '',
    };
    url.searchParams.delete('push_event');
    url.searchParams.delete('push_route');
    url.searchParams.delete('push_anchor');
    history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    return target;
  }

  function updateBadge() {
    unreadCount = notifications.filter((item) => !item.read_at).length;
    const button = $('#appNotificationsButton');
    const badge = $('#appNotificationUnreadBadge');
    if (badge) {
      badge.hidden = unreadCount === 0;
      badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount);
    }
    if (button) button.setAttribute('aria-label', unreadCount ? `通知，${unreadCount} 条未读` : '通知');
    const panelCount = $('#notificationUnreadSummary');
    if (panelCount) panelCount.textContent = unreadCount ? `${unreadCount} 条未读` : '全部已读';
  }

  function updateDeviceStatus() {
    const capability = pushCapability();
    const auth = authState();
    if (!auth.configured) {
      currentDevice = { status: 'disabled', detail: '双人云端尚未配置。' };
    } else if (!auth.authenticated || !auth.paired) {
      currentDevice = { status: 'disabled', detail: '登录并加入双人空间后才能开启通知。' };
    } else if (!capability.supported) {
      currentDevice = { status: 'unsupported', detail: capability.reason };
    } else if (isIOS() && !capability.standalone) {
      currentDevice = { status: 'install', detail: '请先添加到主屏幕，再从主屏幕打开 OURS。' };
    } else if (!capability.hasVapid) {
      currentDevice = { status: 'disabled', detail: 'VAPID 公钥尚未配置，系统推送暂不可用。' };
    } else if (capability.permission === 'granted') {
      if (!['ready','available'].includes(currentDevice.status)) currentDevice = { status: 'eligible', detail: '系统通知权限已授权，正在检查本设备订阅。' };
    } else if (capability.permission === 'denied') {
      currentDevice = { status: 'denied', detail: '通知权限已被浏览器拒绝，请在系统设置中重新允许。' };
    } else {
      currentDevice = { status: 'available', detail: '可以主动开启系统通知。' };
    }
    const label = $('#notificationDeviceStatus');
    if (label) {
      label.dataset.state = currentDevice.status;
      label.textContent = currentDevice.detail;
    }
    return capability;
  }

  function buildUi() {
    if ($('#notificationLayer')) return;
    const layer = document.createElement('div');
    layer.className = 'notification-layer';
    layer.id = 'notificationLayer';
    layer.hidden = true;
    layer.innerHTML = `
      <button class="notification-backdrop" id="notificationBackdrop" type="button" aria-label="关闭通知中心"></button>
      <section class="notification-panel" role="dialog" aria-modal="true" aria-labelledby="notificationTitle">
        <header class="notification-head">
          <div><span>Together, in real time</span><h2 id="notificationTitle">双人动态</h2><small id="notificationUnreadSummary">全部已读</small></div>
          <button class="notification-close" id="notificationClose" type="button" aria-label="关闭通知中心">×</button>
        </header>
        <div class="notification-toolbar">
          <span>只显示另一半发来的云端动态</span>
          <div><button type="button" id="notificationMarkAll">全部已读</button><button type="button" id="notificationOpenSettings">通知设置</button></div>
        </div>
        <div class="notification-body" id="notificationBody"></div>
        <footer class="notification-foot">生日和日程提醒仍在「提醒中心」；这里是双人空间的实时动态。</footer>
      </section>`;
    document.body.appendChild(layer);

    const settings = document.createElement('div');
    settings.className = 'notification-layer notification-settings-layer';
    settings.id = 'notificationSettingsLayer';
    settings.hidden = true;
    settings.innerHTML = `
      <button class="notification-backdrop" id="notificationSettingsBackdrop" type="button" aria-label="关闭通知设置"></button>
      <section class="notification-panel notification-settings-panel" role="dialog" aria-modal="true" aria-labelledby="notificationSettingsTitle">
        <header class="notification-head">
          <div><span>Quietly connected</span><h2 id="notificationSettingsTitle">通知与提醒</h2><small>只有你能看到这份设备设置</small></div>
          <button class="notification-close" id="notificationSettingsClose" type="button" aria-label="关闭通知设置">×</button>
        </header>
        <div class="notification-settings-body" id="notificationSettingsBody"></div>
      </section>`;
    document.body.appendChild(settings);
  }

  function renderLoading(message = '正在读取双人动态…') {
    const body = $('#notificationBody');
    if (!body) return;
    body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">○</span><strong>${escapeHTML(message)}</strong><small>只会在登录并加入双人空间后读取。</small></div>`;
  }

  function notificationRow(item) {
    const meta = CATEGORY_META[item.category] || CATEGORY_META.system;
    const unread = !item.read_at;
    return `<article class="notification-item ${unread ? 'is-unread' : ''}" data-notification-id="${escapeHTML(item.event_id)}">
      <button class="notification-main" type="button" data-notification-open="${escapeHTML(item.event_id)}">
        <span class="notification-category-icon" aria-hidden="true">${meta.icon}</span>
        <span class="notification-copy">
          <span class="notification-item-top"><b>${escapeHTML(meta.label)}</b><time>${escapeHTML(formatNotificationTime(item.created_at))}</time></span>
          <strong>${escapeHTML(item.title)}</strong>
          <small>${escapeHTML(item.body)}</small>
        </span>
        ${unread ? '<i class="notification-unread-dot" aria-label="未读"></i>' : ''}
      </button>
      <button class="notification-delete" type="button" data-notification-delete="${escapeHTML(item.event_id)}" aria-label="删除这条通知">×</button>
    </article>`;
  }

  function renderNotifications() {
    const body = $('#notificationBody');
    if (!body) return;
    const auth = authState();
    if (!auth.configured) {
      body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">○</span><strong>双人云端尚未配置</strong><small>通知中心会在 Supabase、活动事件和 VAPID 配置完成后启用。</small><button type="button" data-notification-cloud>查看云端配置</button></div>`;
      updateBadge();
      return;
    }
    if (!auth.authenticated || !auth.paired) {
      body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">○</span><strong>登录后查看双人动态</strong><small>未认证时不会读取任何通知或私人内容。</small><button type="button" data-notification-cloud>登录并进入双人空间</button></div>`;
      updateBadge();
      return;
    }
    if (loading) {
      renderLoading();
      return;
    }
    if (!notifications.length) {
      body.innerHTML = `<div class="notification-state notification-empty"><span class="notification-state-mark">✦</span><strong>还没有新的双人动态</strong><small>另一半记录新的回忆、约会或愿望时，会安静地出现在这里。</small></div>`;
      updateBadge();
      return;
    }
    body.innerHTML = `<div class="notification-list">${notifications.map(notificationRow).join('')}</div>`;
    updateBadge();
  }

  function formatPushEnabled() {
    const capability = updateDeviceStatus();
    if (!authState().configured) return '云端未配置';
    if (!authState().authenticated || !authState().paired) return '等待登录双人空间';
    if (isIOS() && !capability.standalone) return '需要先添加到主屏幕';
    if (!capability.supported) return '此设备不支持 Web Push';
    if (!capability.hasVapid) return 'VAPID 尚未配置';
    return capability.permission === 'granted' ? '系统通知已授权' : '系统通知尚未开启';
  }

  function renderSettings() {
    const body = $('#notificationSettingsBody');
    if (!body) return;
    const auth = authState();
    const capability = updateDeviceStatus();
    if (!auth.configured || !auth.authenticated || !auth.paired) {
      body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">○</span><strong>先登录双人空间</strong><small>通知订阅必须绑定当前账号、双人空间和设备。</small><button type="button" data-notification-cloud>前往云端空间</button></div>`;
      return;
    }
    const toggle = (id, label, hint, checked) => `<label class="notification-toggle-row"><span><strong>${escapeHTML(label)}</strong><small>${escapeHTML(hint)}</small></span><input id="${id}" type="checkbox" ${checked ? 'checked' : ''} /></label>`;
    const iosHint = isIOS() && !capability.standalone
      ? `<div class="notification-guidance"><strong>iPhone 开启方法</strong><ol><li>在 Safari 中点击分享。</li><li>选择“添加到主屏幕”。</li><li>从主屏幕打开 OURS。</li><li>登录后点击下方“开启系统通知”。</li></ol></div>`
      : '';
    body.innerHTML = `
      <section class="notification-device-card">
        <div class="notification-device-head"><div><span>THIS DEVICE</span><strong>${escapeHTML(devicePlatform())}</strong></div><b id="notificationDeviceStatus" data-state="${currentDevice.status}">${escapeHTML(currentDevice.detail)}</b></div>
        <div class="notification-device-actions">
          <button class="primary-button" type="button" id="notificationEnablePush">开启系统通知</button>
          <button type="button" id="notificationDisablePush">关闭本设备推送</button>
          <button type="button" id="notificationTestPush" ${preferences.push_enabled ? '' : 'disabled'}>发送测试通知</button>
        </div>
        <small>${capability.permission === 'denied' ? '如果权限已被拒绝，请到浏览器或系统设置中手动恢复 OURS 的通知权限。' : '系统推送需要 HTTPS；iPhone 需要 iOS 16.4+ 且从主屏幕打开。'}</small>
      </section>
      ${iosHint}
      <form class="notification-preferences-form" id="notificationPreferencesForm">
        <section class="notification-settings-section">
          <h3>推送范围</h3>
          <p>关闭某类后会停止系统推送，但云端动态仍安全保存在通知中心。</p>
          <div class="notification-toggle-list">
            ${toggle('notifMemoryEvents', '回忆', '新增或更新共同回忆', preferences.memory_events !== false)}
            ${toggle('notifDateEvents', '约会', '新增或修改约会计划', preferences.date_events !== false)}
            ${toggle('notifWishEvents', '愿望', '新增或完成共同愿望', preferences.wish_events !== false)}
            ${toggle('notifMessageEvents', '留言', '新增共同留言', preferences.message_events !== false)}
            ${toggle('notifTodoEvents', '待办', '新增或完成共同待办', preferences.todo_events !== false)}
            ${toggle('notifLifeEvents', '生活计划', '菜单或采购计划更新', preferences.life_events !== false)}
          </div>
        </section>
        <section class="notification-settings-section">
          <h3>安静时间</h3>
          <p>安静时间内不发送系统通知，动态会在结束后合并提醒。</p>
          <div class="notification-time-grid">
            <label class="field">开始<input id="notifQuietStart" type="time" value="${escapeHTML(preferences.quiet_start)}" /></label>
            <label class="field">结束<input id="notifQuietEnd" type="time" value="${escapeHTML(preferences.quiet_end)}" /></label>
          </div>
          <small class="notification-timezone">时区：${escapeHTML(preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai')}</small>
        </section>
        <section class="notification-settings-section">
          <h3>隐私预览</h3>
          ${toggle('notifHidePreview', '隐藏通知内容', '锁屏统一显示“OURS 有一条新动态”', preferences.hide_preview !== false)}
        </section>
        <div class="notification-form-actions"><span id="notificationSettingsFeedback" role="status"></span><button class="primary-button" type="submit">保存通知设置</button></div>
      </form>`;
    updateDeviceStatus();
  }

  function openPanel() {
    buildUi();
    const layer = $('#notificationLayer');
    if (!layer) return;
    panelReturnFocus = document.activeElement;
    panelOpen = true;
    layer.hidden = false;
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => { layer.classList.add('is-open'); $('#notificationClose')?.focus({ preventScroll: true }); });
    renderNotifications();
    loadNotifications().catch((error) => {
      if (notifications.length) {
        renderNotifications();
        toast('当前无法连接云端，正在显示上次缓存的双人动态。');
        return;
      }
      const body = $('#notificationBody');
      if (body) body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">!</span><strong>通知加载失败</strong><small>${escapeHTML(error.message || '请稍后重试。')}</small><button type="button" data-notification-retry>重新加载</button></div>`;
    });
  }

  function closePanel() {
    const layer = $('#notificationLayer');
    if (!layer) return;
    panelOpen = false;
    layer.classList.remove('is-open');
    window.setTimeout(() => { layer.hidden = true; }, 220);
    if (!settingsOpen) {
      document.body.classList.remove('modal-open');
      panelReturnFocus?.focus?.({ preventScroll: true });
    }
  }

  function openSettings() {
    buildUi();
    settingsReturnFocus = panelOpen ? panelReturnFocus : document.activeElement;
    if ($('#profileLayer') && !$('#profileLayer').hidden) $('#closeProfile')?.click();
    const layer = $('#notificationSettingsLayer');
    if (!layer) return;
    closePanel();
    settingsOpen = true;
    layer.hidden = false;
    document.body.classList.add('modal-open');
    window.requestAnimationFrame(() => { layer.classList.add('is-open'); $('#notificationSettingsClose')?.focus({ preventScroll: true }); });
    renderSettings();
    refreshDeviceSubscription().catch(() => {});
    loadPreferences().then(renderSettings).catch((error) => {
      const body = $('#notificationSettingsBody');
      if (body) body.innerHTML = `<div class="notification-state"><span class="notification-state-mark">!</span><strong>设置加载失败</strong><small>${escapeHTML(error.message || '请稍后重试。')}</small></div>`;
    });
  }

  function closeSettings() {
    const layer = $('#notificationSettingsLayer');
    if (!layer) return;
    settingsOpen = false;
    layer.classList.remove('is-open');
    window.setTimeout(() => { layer.hidden = true; }, 220);
    document.body.classList.remove('modal-open');
    settingsReturnFocus?.focus?.({ preventScroll: true });
  }

  async function loadNotifications({ silent = false } = {}) {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) {
      notifications = [];
      updateBadge();
      if (!silent) renderNotifications();
      return;
    }
    loading = true;
    if (!silent && panelOpen) renderNotifications();
    try {
      const rows = await api.rpc('ours_list_notifications', { p_limit: 50 });
      notifications = Array.isArray(rows) ? rows : [];
      store?.setJSON(CACHE_KEY, notifications.slice(0, 20));
      updateBadge();
    } finally {
      loading = false;
      if (panelOpen) renderNotifications();
    }
  }

  async function loadPreferences() {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) {
      preferences = { ...DEFAULT_PREFERENCES };
      return preferences;
    }
    const rows = await api.rpc('ours_get_notification_preferences');
    preferences = normalizePreferences(Array.isArray(rows) ? rows[0] : rows);
    return preferences;
  }

  async function savePreferences() {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) throw new Error('请先登录并加入双人空间。');
    await api.rpc('ours_save_notification_preferences', {
      p_push_enabled: Boolean(preferences.push_enabled),
      p_memory_events: preferences.memory_events !== false,
      p_date_events: preferences.date_events !== false,
      p_wish_events: preferences.wish_events !== false,
      p_message_events: preferences.message_events !== false,
      p_todo_events: preferences.todo_events !== false,
      p_life_events: preferences.life_events !== false,
      p_quiet_start: preferences.quiet_start || null,
      p_quiet_end: preferences.quiet_end || null,
      p_timezone: preferences.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai',
      p_hide_preview: preferences.hide_preview !== false,
    });
  }

  function saveFormPreferences() {
    preferences = {
      ...preferences,
      memory_events: $('#notifMemoryEvents')?.checked !== false,
      date_events: $('#notifDateEvents')?.checked !== false,
      wish_events: $('#notifWishEvents')?.checked !== false,
      message_events: $('#notifMessageEvents')?.checked !== false,
      todo_events: $('#notifTodoEvents')?.checked !== false,
      life_events: $('#notifLifeEvents')?.checked !== false,
      quiet_start: $('#notifQuietStart')?.value || '',
      quiet_end: $('#notifQuietEnd')?.value || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || preferences.timezone || 'Asia/Shanghai',
      hide_preview: $('#notifHidePreview')?.checked !== false,
    };
  }

  function decodeBase64Url(value) {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, (character) => character.charCodeAt(0));
  }

  async function getPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  }

  async function refreshDeviceSubscription() {
    const capability = updateDeviceStatus();
    if (!capability.supported) {
      renderSettings();
      return;
    }
    try {
      const subscription = await getPushSubscription();
      if (!subscription) {
        currentDevice = {
          status: capability.permission === 'denied' ? 'denied' : 'available',
          detail: capability.permission === 'denied' ? '通知权限已被浏览器拒绝。' : '此设备尚未订阅系统通知。',
        };
      } else {
        currentDevice = { status: 'ready', detail: `此设备已订阅系统通知 · ${devicePlatform()}` };
      }
    } catch (error) {
      currentDevice = { status: 'unsupported', detail: error.message || '无法读取本设备的通知状态。' };
    }
    renderSettings();
  }

  async function enablePush() {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) throw new Error('请先登录并加入双人空间。');
    const capability = updateDeviceStatus();
    if (isIOS() && !capability.standalone) throw new Error('iPhone 需要先从主屏幕打开 OURS，才能开启系统通知。');
    if (!capability.supported) throw new Error(capability.reason || '当前设备不支持系统通知。');
    if (!capability.hasVapid) throw new Error('VAPID 公钥尚未配置，暂时不能订阅系统通知。');
    if (Notification.permission === 'denied') throw new Error('通知权限已被拒绝，请到浏览器或系统设置中恢复。');
    const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('你还没有允许系统通知。应用内通知中心仍然可以使用。');

    const registration = await navigator.serviceWorker.ready;
    const applicationServerKey = decodeBase64Url(String(cloudConfig.vapidPublicKey));
    let subscription = await registration.pushManager.getSubscription();
    const existingKey = subscription?.options?.applicationServerKey;
    if (existingKey) {
      const existingBytes = new Uint8Array(existingKey);
      const sameKey = existingBytes.length === applicationServerKey.length
        && existingBytes.every((value, index) => value === applicationServerKey[index]);
      if (!sameKey) {
        await subscription.unsubscribe();
        subscription = null;
      }
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }
    const json = subscription.toJSON();
    await api.rpc('ours_register_push_subscription', {
      p_endpoint: subscription.endpoint,
      p_p256dh: json.keys?.p256dh || '',
      p_auth_secret: json.keys?.auth || '',
      p_user_agent: navigator.userAgent,
      p_platform: devicePlatform(),
    });
    preferences.push_enabled = true;
    await savePreferences();
    currentDevice = { status: 'ready', detail: `此设备已订阅系统通知 · ${devicePlatform()}` };
    renderSettings();
    toast('系统通知已开启。');
  }

  async function disablePush() {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) throw new Error('请先登录并加入双人空间。');
    const subscription = await getPushSubscription();
    if (subscription) {
      try {
        await api.rpc('ours_revoke_push_subscription', { p_endpoint: subscription.endpoint });
      } finally {
        await subscription.unsubscribe();
      }
    }
    preferences.push_enabled = false;
    await savePreferences();
    currentDevice = { status: 'available', detail: '此设备已关闭系统通知。' };
    renderSettings();
    toast('本设备推送已关闭。');
  }

  async function queueTestNotification() {
    const api = cloudApi();
    const auth = authState();
    if (!api?.rpc || !auth.authenticated || !auth.paired) throw new Error('请先登录并加入双人空间。');
    await api.rpc('ours_queue_test_notification');
    toast('测试通知已进入发送队列，通常一分钟内送达。');
    await loadNotifications({ silent: true });
  }

  function findNotification(eventId) {
    return notifications.find((item) => item.event_id === eventId);
  }

  async function markRead(eventId) {
    if (!eventId) return;
    const item = findNotification(eventId);
    if (item?.read_at) return;
    const api = cloudApi();
    if (!api?.rpc) return;
    try {
      await api.rpc('ours_mark_notification_read', { p_event_id: eventId });
      if (item) item.read_at = new Date().toISOString();
      updateBadge();
      renderNotifications();
    } catch {}
  }

  async function removeNotification(eventId) {
    const api = cloudApi();
    if (!api?.rpc) return;
    await api.rpc('ours_delete_notification', { p_event_id: eventId });
    notifications = notifications.filter((item) => item.event_id !== eventId);
    updateBadge();
    renderNotifications();
  }

  async function markAllRead() {
    const api = cloudApi();
    if (!api?.rpc || !notifications.some((item) => !item.read_at)) return;
    await api.rpc('ours_mark_all_notifications_read');
    const now = new Date().toISOString();
    notifications = notifications.map((item) => ({ ...item, read_at: item.read_at || now }));
    updateBadge();
    renderNotifications();
  }

  function entityExists(item) {
    try {
      if (item.entity_type === 'memory') return Boolean(window.OURS_FEATURES_API?.getAllMemories?.().some((entry) => entry.id === item.entity_id));
      if (item.entity_type === 'event') return Boolean(window.OURS_LIFE_TOOLS?.events?.().some((entry) => entry.id === item.entity_id));
      if (item.entity_type === 'wish') return Boolean(window.OURS_FEATURES_API?.getWishes?.().some((entry) => entry.id === item.entity_id));
      if (item.entity_type === 'todo') return Boolean((store?.getJSON('ours-todos-v1', []) || []).some((entry) => entry.id === item.entity_id));
      if (item.entity_type === 'message') return Boolean((store?.getJSON('ours-daily-notes-v1', []) || []).some((entry) => entry.id === item.entity_id));
      return true;
    } catch {
      return true;
    }
  }

  function openNotification(item) {
    if (!item) return;
    markRead(item.event_id).catch(() => {});
    const route = item.target_route || (
      item.category === 'memories' ? 'memories'
        : item.category === 'dates' || item.category === 'wishes' || item.category === 'todos' ? 'plans'
          : item.category === 'life' ? 'life' : 'us'
    );
    const anchor = item.target_anchor || '';
    closeSettings();
    closePanel();
    if (item.event_type === 'test' || (route === 'us' && anchor === 'notificationSettings')) {
      window.setTimeout(openSettings, 240);
      return;
    }
    if (!entityExists(item)) {
      toast('这条动态对应的内容已被删除，或你已经失去访问权限。');
    }
    window.OURS_APP_SHELL?.navigate(route, anchor, { focus: false });
    window.setTimeout(() => {
      if (item.entity_type === 'memory' && entityExists(item)) {
        window.OURS_FEATURES_API?.openMemoryById?.(item.entity_id);
      } else if (item.entity_type === 'event' && entityExists(item)) {
        document.dispatchEvent(new CustomEvent('ours:open-event', { detail: { id: item.entity_id } }));
      } else if (item.entity_type === 'wish' && entityExists(item)) {
        document.dispatchEvent(new CustomEvent('ours:focus-wish', { detail: { id: item.entity_id } }));
      } else if (item.entity_type === 'todo' && entityExists(item)) {
        document.dispatchEvent(new CustomEvent('ours:focus-todo', { detail: { id: item.entity_id } }));
      } else if (item.entity_type === 'message' && entityExists(item)) {
        document.dispatchEvent(new CustomEvent('ours:focus-note', { detail: { id: item.entity_id } }));
      } else {
        document.dispatchEvent(new CustomEvent('ours:notification-target', { detail: item }));
      }
    }, 420);
  }

  async function processPendingTarget() {
    if (!pendingTarget) pendingTarget = readPendingTargetFromStorage();
    if (!pendingTarget) return;
    const auth = authState();
    if (!auth.authenticated || !auth.paired) {
      openPanel();
      return;
    }
    try {
      await loadNotifications({ silent: true });
      const item = findNotification(pendingTarget.eventId) || {
        event_id: pendingTarget.eventId,
        target_route: pendingTarget.route || 'today',
        target_anchor: pendingTarget.anchor || '',
        category: 'system',
        entity_type: '',
        entity_id: '',
        title: 'OURS 新动态',
        created_at: new Date().toISOString(),
      };
      savePendingTarget(null);
      openNotification(item);
    } catch (error) {
      toast(friendlyError(error));
    }
  }

  function injectProfileNotificationEntry() {
    const body = $('#profileBody');
    if (!body || $('#profileNotificationEntry')) return;
    const entry = document.createElement('section');
    entry.className = 'profile-notification-entry';
    entry.id = 'profileNotificationEntry';
    entry.innerHTML = `<div><span>通知与提醒</span><small>${escapeHTML(formatPushEnabled())}</small></div><button type="button" data-notification-settings>管理通知</button>`;
    const utilities = $('.profile-utilities', body);
    body.insertBefore(entry, utilities || null);
  }

  async function handleSettingsSubmit(event) {
    event.preventDefault();
    const feedback = $('#notificationSettingsFeedback');
    const button = event.target.querySelector('button[type="submit"]');
    if (feedback) feedback.textContent = '正在保存…';
    if (button) button.disabled = true;
    try {
      saveFormPreferences();
      await savePreferences();
      if (feedback) feedback.textContent = '通知设置已保存。';
      updateDeviceStatus();
      toast('通知设置已保存。');
    } catch (error) {
      if (feedback) feedback.textContent = friendlyError(error) || '保存失败，请稍后重试。';
    } finally {
      if (button) button.disabled = false;
    }
  }

  function bindUi() {
    $('#appNotificationsButton')?.addEventListener('click', openPanel);
    $('#notificationBackdrop')?.addEventListener('click', closePanel);
    $('#notificationClose')?.addEventListener('click', closePanel);
    $('#notificationMarkAll')?.addEventListener('click', () => markAllRead().catch((error) => toast(error.message)));
    $('#notificationOpenSettings')?.addEventListener('click', openSettings);
    $('#notificationSettingsBackdrop')?.addEventListener('click', closeSettings);
    $('#notificationSettingsClose')?.addEventListener('click', closeSettings);

    document.addEventListener('click', (event) => {
      const open = event.target.closest('[data-notification-open]');
      if (open) { openNotification(findNotification(open.dataset.notificationOpen)); return; }
      const remove = event.target.closest('[data-notification-delete]');
      if (remove) { removeNotification(remove.dataset.notificationDelete).catch((error) => toast(error.message)); return; }
      if (event.target.closest('[data-notification-settings]')) { openSettings(); return; }
      if (event.target.closest('[data-notification-cloud]')) {
        closePanel();
        closeSettings();
        window.OURS_APP_SHELL?.navigate('us', 'cloudSync');
        return;
      }
      if (event.target.closest('[data-notification-retry]')) { loadNotifications().catch((error) => toast(error.message)); return; }
      if (event.target.closest('#notificationEnablePush')) { enablePush().catch((error) => { toast(friendlyError(error)); updateDeviceStatus(); renderSettings(); }); return; }
      if (event.target.closest('#notificationDisablePush')) { disablePush().catch((error) => toast(error.message)); return; }
      if (event.target.closest('#notificationTestPush')) { queueTestNotification().catch((error) => toast(error.message)); return; }
    });

    document.addEventListener('submit', (event) => {
      if (event.target.id === 'notificationPreferencesForm') handleSettingsSubmit(event);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (settingsOpen) { closeSettings(); return; }
        if (panelOpen) closePanel();
        return;
      }
      if (event.key !== 'Tab' || (!panelOpen && !settingsOpen)) return;
      const root = settingsOpen ? $('#notificationSettingsLayer') : $('#notificationLayer');
      const focusable = $$('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled])', root)
        .filter((item) => item.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    const profileBody = $('#profileBody');
    if (profileBody) {
      new MutationObserver(() => window.setTimeout(injectProfileNotificationEntry, 0)).observe(profileBody, { childList: true });
    }
  }

  async function initialize() {
    notifications = authState().authenticated ? (store?.getJSON(CACHE_KEY, []) || []) : [];
    buildUi();
    bindUi();
    injectProfileNotificationEntry();
    updateBadge();
    updateDeviceStatus();
    pendingTarget = readPendingTargetFromUrl() || readPendingTargetFromStorage();
    loadNotifications({ silent: true }).catch(() => {});
    processPendingTarget().catch(() => {});
    pollTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible' && authState().authenticated && authState().paired) {
        loadNotifications({ silent: true }).catch(() => {});
      }
    }, 45000);
  }

  window.addEventListener('ours:cloud-session-changed', () => {
    updateDeviceStatus();
    injectProfileNotificationEntry();
    if (!authState().authenticated) {
      notifications = [];
      localStorage.removeItem(CACHE_KEY);
      updateBadge();
      renderNotifications();
      navigator.serviceWorker?.ready?.then((registration) => registration.pushManager?.getSubscription?.())
        .then((subscription) => subscription?.unsubscribe?.())
        .catch(() => {});
      return;
    }
    loadNotifications({ silent: true }).then(processPendingTarget).catch(() => {});
  });
  window.addEventListener('online', () => loadNotifications({ silent: true }).catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && authState().authenticated && authState().paired) {
      loadNotifications({ silent: true }).catch(() => {});
    }
  });
  document.addEventListener('ours:data-changed', (event) => {
    if (event.detail?.source === 'cloud') window.setTimeout(() => loadNotifications({ silent: true }).catch(() => {}), 300);
  });
  navigator.serviceWorker?.addEventListener('message', (event) => {
    if (event.data?.type === 'OURS_PUSH_SUBSCRIPTION_CHANGED') {
      updateDeviceStatus();
      toast('系统通知订阅已变化，请打开通知设置重新确认。');
      return;
    }
    if (event.data?.type !== 'OURS_NOTIFICATION_CLICK') return;
    savePendingTarget({
      eventId: event.data.eventId || '',
      route: event.data.route || '',
      anchor: event.data.anchor || '',
    });
    processPendingTarget().catch(() => {});
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();

  window.OURS_NOTIFICATIONS = {
    open: openPanel,
    openSettings,
    refresh: () => loadNotifications(),
    getUnreadCount: () => unreadCount,
    capability: pushCapability,
  };
})();
