// Phase 77: the smallest IndexedDB wrapper the outbox needs — one object
// store, promise-based get/put/delete/getAll. Blobs (photos) are stored as-is.

const DB_NAME = "quoteai-offline";
const DB_VERSION = 1;
export const OUTBOX_STORE = "outbox";

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbSupported(): boolean {
  return typeof indexedDB !== "undefined";
}

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error ?? new Error("indexedDB open failed"));
    req.onblocked = () => reject(new Error("indexedDB open blocked"));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error("indexedDB request failed"));
  });
}

export async function idbGetAll<T>(store: string): Promise<T[]> {
  const db = await open();
  return request(db.transaction(store, "readonly").objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function idbPut<T>(store: string, value: T): Promise<void> {
  const db = await open();
  await request(db.transaction(store, "readwrite").objectStore(store).put(value));
}

export async function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  const db = await open();
  await request(db.transaction(store, "readwrite").objectStore(store).delete(key));
}
