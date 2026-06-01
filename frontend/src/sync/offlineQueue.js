import { openDB } from 'idb';

const DB_NAME = 'pos_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_mutations';

let dbInstance = null;

export const getDB = async () => {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp');
      }
    },
  });
  return dbInstance;
};

export const queueMutation = async (mutation) => {
  const db = await getDB();
  await db.add(STORE_NAME, { ...mutation, timestamp: Date.now(), retries: 0 });
};

export const getPendingMutations = async () => {
  const db = await getDB();
  return db.getAllFromIndex(STORE_NAME, 'timestamp');
};

export const deleteMutation = async (id) => {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};

export const clearAll = async () => {
  const db = await getDB();
  await db.clear(STORE_NAME);
};
