(() => {
  const DB_NAME = 'ours-local-media';
  const DB_VERSION = 1;
  const PHOTO_STORE = 'photos';
  const SCHEMA_KEY = 'ours-schema-version';
  const SCHEMA_VERSION = 3;
  const MANAGED_KEYS = [
    'ours-supper-cart-v2', 'ours-supper-last-order-v2', 'ours-custom-dishes-v1',
    'ours-supper-wishes-v2', 'ours-supper-heart-v2', 'ours-memories-v1',
    'ours-cooking-v1', 'ours-shopping-v1', 'ours-next-meeting-v1',
    'ours-daily-notes-v1', 'ours-date-ideas-v1', 'ours-questions-v1',
    'ours-quiz-results-v1', 'ours-profile-v1'
  ];
  const ARRAY_KEYS = new Set([
    'ours-custom-dishes-v1', 'ours-supper-wishes-v2', 'ours-memories-v1',
    'ours-shopping-v1', 'ours-daily-notes-v1', 'ours-date-ideas-v1', 'ours-questions-v1'
  ]);
  const OBJECT_KEYS = new Set([
    'ours-supper-cart-v2', 'ours-supper-last-order-v2', 'ours-cooking-v1', 'ours-profile-v1'
  ]);
  const LIMITS = {
    backupBytes: 120 * 1024 * 1024,
    recordsBytes: 12 * 1024 * 1024,
    photosBytes: 100 * 1024 * 1024,
    photoBytes: 16 * 1024 * 1024,
    photoCount: 600,
  };

  let dbPromise = null;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  }

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('当前浏览器不支持本地照片存储。'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(request.error);
      };
    });
    return dbPromise;
  }

  async function transaction(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, mode);
      const store = tx.objectStore(PHOTO_STORE);
      let request;
      try {
        request = action(store);
      } catch (error) {
        try { tx.abort(); } catch {}
        reject(error);
        return;
      }
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error || new Error('本地照片存储失败。'));
      tx.onabort = () => reject(tx.error || new Error('本地照片操作已中止。'));
    });
  }

  function getJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  async function putPhoto(id, blob) {
    if (!id || !(blob instanceof Blob)) throw new Error('照片数据无效。');
    return transaction('readwrite', (store) => store.put(blob, String(id)));
  }

  async function getPhoto(id) {
    return transaction('readonly', (store) => store.get(String(id)));
  }

  async function deletePhoto(id) {
    return transaction('readwrite', (store) => store.delete(String(id)));
  }

  async function listPhotos() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      tx.oncomplete = () => {
        const values = valuesRequest.result || [];
        const keys = keysRequest.result || [];
        resolve(keys.map((key, index) => ({ id: key, blob: values[index] })).filter((item) => item.blob instanceof Blob));
      };
      tx.onerror = () => reject(tx.error || new Error('照片列表读取失败。'));
      tx.onabort = () => reject(tx.error || new Error('照片列表读取已中止。'));
    });
  }

  async function replacePhotos(items) {
    return transaction('readwrite', (store) => {
      store.clear();
      items.forEach((item) => store.put(item.blob, String(item.id)));
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('照片读取失败。'));
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const match = String(dataUrl).match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
    if (!match) throw new Error('备份中包含无法识别的图片。');
    const binary = atob(match[2].replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  }

  async function exportData() {
    const records = {};
    MANAGED_KEYS.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value !== null) records[key] = value;
    });
    const photos = {};
    for (const item of await listPhotos()) photos[item.id] = await blobToDataUrl(item.blob);
    return {
      app: 'OURS',
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      records,
      photos,
    };
  }

  function validateRecord(key, value) {
    if (typeof value !== 'string') throw new Error('备份记录格式不正确。');
    let parsed;
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error('备份中有损坏的记录。');
    }
    if (ARRAY_KEYS.has(key) && !Array.isArray(parsed)) throw new Error('备份中的列表记录格式不正确。');
    if (OBJECT_KEYS.has(key) && !isPlainObject(parsed)) throw new Error('备份中的对象记录格式不正确。');
    if (key === 'ours-next-meeting-v1' && parsed !== null && typeof parsed !== 'string') {
      throw new Error('备份中的见面日期格式不正确。');
    }
    if (key === 'ours-supper-heart-v2' && !(typeof parsed === 'number' || typeof parsed === 'string')) {
      throw new Error('备份中的喜欢计数格式不正确。');
    }
    if (key === 'ours-quiz-results-v1' && parsed !== null && !isPlainObject(parsed)) {
      throw new Error('备份中的问答结果格式不正确。');
    }
  }

  function validatePayload(payload) {
    if (!isPlainObject(payload) || payload.app !== 'OURS') throw new Error('这不是有效的 OURS 备份文件。');
    if (![1, 2, SCHEMA_VERSION].includes(Number(payload.schemaVersion))) throw new Error('备份版本不受支持。');
    if (!isPlainObject(payload.records) || !isPlainObject(payload.photos)) throw new Error('备份结构不完整。');
    let size = 0;
    try { size = JSON.stringify(payload).length; } catch { throw new Error('备份文件无法读取。'); }
    if (size > LIMITS.backupBytes) throw new Error('备份文件过大，无法安全导入。');

    const recordEntries = Object.entries(payload.records);
    const unknownKey = recordEntries.find(([key]) => !MANAGED_KEYS.includes(key));
    if (unknownKey) throw new Error(`备份包含当前版本无法识别的记录：${unknownKey[0]}`);
    let recordsBytes = 0;
    recordEntries.forEach(([key, value]) => {
      recordsBytes += String(value).length;
      validateRecord(key, value);
    });
    if (recordsBytes > LIMITS.recordsBytes) throw new Error('备份中的文字记录过大。');

    const photoEntries = Object.entries(payload.photos);
    if (photoEntries.length > LIMITS.photoCount) throw new Error('备份中的照片数量过多。');
    let photosBytes = 0;
    const photos = photoEntries.map(([id, dataUrl]) => {
      if (typeof id !== 'string' || !id || id.length > 140) throw new Error('备份中的照片标识不正确。');
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) throw new Error('备份中包含无法识别的图片。');
      if (dataUrl.length > LIMITS.photoBytes) throw new Error(`照片 ${id} 过大，无法导入。`);
      photosBytes += dataUrl.length;
      let blob;
      try { blob = dataUrlToBlob(dataUrl); } catch { throw new Error(`照片 ${id} 已损坏。`); }
      return { id, blob };
    });
    if (photosBytes > LIMITS.photosBytes) throw new Error('备份中的照片总大小过大。');
    return { records: Object.fromEntries(recordEntries), photos };
  }

  function snapshotRecords() {
    const snapshot = {};
    MANAGED_KEYS.forEach((key) => { snapshot[key] = localStorage.getItem(key); });
    snapshot[SCHEMA_KEY] = localStorage.getItem(SCHEMA_KEY);
    return snapshot;
  }

  function restoreRecords(snapshot) {
    Object.entries(snapshot).forEach(([key, value]) => {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    });
  }

  async function importData(payload) {
    const validated = validatePayload(payload);
    const recordSnapshot = snapshotRecords();
    let photoSnapshot = [];
    try {
      photoSnapshot = await listPhotos();
    } catch {
      throw new Error('当前设备的照片存储不可用，无法安全导入。');
    }
    try {
      MANAGED_KEYS.forEach((key) => localStorage.removeItem(key));
      Object.entries(validated.records).forEach(([key, value]) => localStorage.setItem(key, value));
      localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
      await replacePhotos(validated.photos);
    } catch (error) {
      try {
        restoreRecords(recordSnapshot);
        await replacePhotos(photoSnapshot);
      } catch {
        throw new Error('备份导入失败，自动恢复也未完成。请先导出当前数据再重试。');
      }
      throw new Error(error?.message || '备份导入失败，原有数据已恢复。');
    }
  }

  function migrate() {
    const current = Number(localStorage.getItem(SCHEMA_KEY) || 0);
    if (current < SCHEMA_VERSION) localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    return { from: current, to: SCHEMA_VERSION };
  }

  window.OURS_STORE = {
    getJSON, setJSON, putPhoto, getPhoto, deletePhoto, listPhotos,
    exportData, importData, migrate, SCHEMA_VERSION,
  };
})();