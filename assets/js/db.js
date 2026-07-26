const BowDB = (() => {
  const DB_NAME = 'bowPokemonCollection';
  const DB_VERSION = 1;
  let dbPromise;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('collection')) {
          const store = db.createObjectStore('collection', { keyPath: 'card_id' });
          store.createIndex('set_id', 'set_id', { unique: false });
          store.createIndex('updated_at', 'updated_at', { unique: false });
        }
        if (!db.objectStoreNames.contains('wishlist')) {
          db.createObjectStore('wishlist', { keyPath: 'card_id' });
        }
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache', { keyPath: 'key' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return dbPromise;
  }

  async function get(storeName, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function getAll(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, value) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  async function remove(storeName, key) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function clear(storeName) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const req = db.transaction(storeName, 'readwrite').objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async function cacheGet(key, maxAgeMs) {
    const item = await get('cache', key);
    if (!item || Date.now() - item.saved_at > maxAgeMs) return null;
    return item.value;
  }

  async function cachePut(key, value) {
    return put('cache', { key, value, saved_at: Date.now() });
  }

  return { open, get, getAll, put, remove, clear, cacheGet, cachePut };
})();
