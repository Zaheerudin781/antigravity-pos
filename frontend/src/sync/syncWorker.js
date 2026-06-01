import api from '../api/axios';
import { getPendingMutations, deleteMutation } from './offlineQueue';

let syncInterval = null;
let isSyncing = false;

export const startSyncWorker = (onSyncComplete) => {
  if (syncInterval) return;
  syncInterval = setInterval(async () => {
    if (!navigator.onLine || isSyncing) return;
    const pending = await getPendingMutations();
    if (!pending.length) return;

    isSyncing = true;
    let syncedCount = 0;

    for (const mutation of pending) {
      try {
        const { method, url, data } = mutation;
        await api({ method, url, data });
        await deleteMutation(mutation.id);
        syncedCount++;
      } catch (err) {
        console.warn('Sync failed for mutation:', mutation.id, err.message);
        if (mutation.retries >= 3) await deleteMutation(mutation.id);
      }
    }

    isSyncing = false;
    if (syncedCount > 0 && onSyncComplete) onSyncComplete(syncedCount);
  }, 5000);
};

export const stopSyncWorker = () => {
  if (syncInterval) { clearInterval(syncInterval); syncInterval = null; }
};
