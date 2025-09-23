// IndexedDB wrapper (simple, resilient)
const DB_NAME = 'kmdb';
const DB_VER = 1;
const STORE = 'items';

// Open DB
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const os = db.createObjectStore(STORE, { keyPath: 'id' });
        os.createIndex('updatedAt', 'updatedAt', { unique: false });
        os.createIndex('createdAt', 'createdAt', { unique: false });
        os.createIndex('identity', 'identity', { unique: false });
        os.createIndex('type', 'type', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// CRUD
async function dbAddOrUpdate(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function dbImport(items) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    items.forEach(it => store.put(it));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbExport() {
  const items = await dbAll();
  return items;
}

// Seed helper (optional)
async function ensureSeed() {
  const list = await dbAll();
  if (list.length) return;
  const now = new Date().toISOString();
  const seed = [
    {
      id: crypto.randomUUID(),
      title: 'SlowMoJog Test Plan',
      identity: 'Company',
      type: 'Project',
      tags: ['replay','BMD','NDI','UI'],
      links: [],
      content: 'Checklist: input sources (NDI/BMD/USB), hotkeys, slow/normal toggle, recording pipeline (WebM -> MP4), error center.',
      createdAt: now, updatedAt: now, _v: 1
    },
    {
      id: crypto.randomUUID(),
      title: 'Template Market – Pricing Ideas',
      identity: 'Personal',
      type: 'Project',
      tags: ['pricing','stripe','marketplace'],
      links: [],
      content: 'Tiering: Free, Plus ($9.99), Pro ($19), bundle discounts, designer revenue split.',
      createdAt: now, updatedAt: now, _v: 1
    },
    {
      id: crypto.randomUUID(),
      title: 'NDI vs SDI Notes',
      identity: 'Company',
      type: 'Knowledge',
      tags: ['NDI','SDI','latency'],
      links: [],
      content: 'NDI suitable for IP workflows; SDI for low-latency baseband. Consider capture card and signal path.',
      createdAt: now, updatedAt: now, _v: 1
    }
  ];
  await dbImport(seed);
}