(() => {
  const DB_NAME = 'ours-local-media';
  const DB_VERSION = 1;
  const PHOTO_STORE = 'photos';
  const SCHEMA_KEY = 'ours-schema-version';
  const SCHEMA_VERSION = 2;
  const MANAGED_KEYS = [
    'ours-supper-cart-v2', 'ours-supper-last-order-v2', 'ours-custom-dishes-v1',
    'ours-supper-wishes-v2', 'ours-supper-heart-v2', 'ours-memories-v1',
    'ours-cooking-v1', 'ours-shopping-v1', 'ours-next-meeting-v1',
    'ours-daily-notes-v1', 'ours-date-ideas-v1', 'ours-questions-v1',
    'ours-quiz-results-v1'
  ];

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PHOTO_STORE)) db.createObjectStore(PHOTO_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function transaction(mode, action) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, mode);
      const store = tx.objectStore(PHOTO_STORE);
      let request;
      try { request = action(store); } catch (error) { reject(error); return; }
      tx.oncomplete = () => resolve(request?.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function getJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  }

  function setJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch { return false; }
  }

  async function putPhoto(id, blob) {
    return transaction('readwrite', (store) => store.put(blob, id));
  }

  async function getPhoto(id) {
    return transaction('readonly', (store) => store.get(id));
  }

  async function deletePhoto(id) {
    return transaction('readwrite', (store) => store.delete(id));
  }

  async function listPhotos() {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const keysRequest = store.getAllKeys();
      const valuesRequest = store.getAll();
      tx.oncomplete = () => resolve(keysRequest.result.map((key, index) => ({ id: key, blob: valuesRequest.result[index] })));
      tx.onerror = () => reject(tx.error);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    const [header, body] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
    const binary = atob(body);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mime });
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

  async function importData(payload) {
    if (!payload || payload.app !== 'OURS' || !payload.records) throw new Error('这不是有效的 OURS 备份文件。');
    if (![1, SCHEMA_VERSION].includes(Number(payload.schemaVersion))) throw new Error('备份版本不受支持。');
    Object.entries(payload.records).forEach(([key, value]) => {
      if (MANAGED_KEYS.includes(key) && typeof value === 'string') localStorage.setItem(key, value);
    });
    if (payload.photos && typeof payload.photos === 'object') {
      for (const [id, dataUrl] of Object.entries(payload.photos)) {
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) await putPhoto(id, dataUrlToBlob(dataUrl));
      }
    }
    localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
  }

  function migrate() {
    const current = Number(localStorage.getItem(SCHEMA_KEY) || 0);
    if (current < 2) localStorage.setItem(SCHEMA_KEY, String(SCHEMA_VERSION));
    return { from: current, to: SCHEMA_VERSION };
  }

  window.OURS_STORE = { getJSON, setJSON, putPhoto, getPhoto, deletePhoto, exportData, importData, migrate, SCHEMA_VERSION };
})();