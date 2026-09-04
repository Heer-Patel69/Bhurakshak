import { api } from '../api';
import { deleteQueuedReport, getPendingReports, updateQueuedReport } from './db';
import type { OfflineQueuedReport } from '../types';

export type SyncCallback = (status: {
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt?: Date;
  error?: string | null;
}) => void;

let isSyncing = false;
const listeners = new Set<SyncCallback>();

export function subscribeSyncStatus(callback: SyncCallback): () => void {
  listeners.add(callback);
  notifyListeners();
  return () => listeners.delete(callback);
}

async function notifyListeners(error?: string | null) {
  try {
    const pending = await getPendingReports();
    listeners.forEach((cb) =>
      cb({
        isSyncing,
        pendingCount: pending.length,
        error: error || null,
      })
    );
  } catch {
    // Ignore listener notify errors
  }
}

export async function syncOfflineReports(): Promise<{ synced: number; failed: number }> {
  if (typeof window === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0 };
  }

  if (isSyncing) return { synced: 0, failed: 0 };

  isSyncing = true;
  await notifyListeners();

  let synced = 0;
  let failed = 0;

  try {
    const pending = await getPendingReports();

    for (const item of pending) {
      try {
        item.status = 'syncing';
        await updateQueuedReport(item);

        // Submit the report payload
        const serverReport = await api.submitReport(item.payload);
        item.server_report_id = serverReport.report_id;

        // If media file was queued as blob/file, upload it
        if (item.media_file || item.media_blob) {
          const fileToUpload =
            item.media_file ||
            new File(
              [item.media_blob!],
              item.media_filename || 'hazard_media.jpg',
              { type: item.media_mime || 'image/jpeg' }
            );

          await api.uploadReportMedia(serverReport.report_id, fileToUpload);
        }

        item.status = 'synced';
        await deleteQueuedReport(item.local_id);
        synced++;
      } catch (err: any) {
        failed++;
        item.status = 'failed';
        item.error_message = err.message || 'Sync failed';
        await updateQueuedReport(item);
      }
    }
  } finally {
    isSyncing = false;
    await notifyListeners();
  }

  return { synced, failed };
}

// Auto-sync on network reconnection
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineReports();
  });
}
