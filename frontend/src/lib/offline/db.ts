import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { OfflineQueuedReport, RiskPointResponse } from '../types';

interface BhuRakshakDB extends DBSchema {
  reports_queue: {
    key: string;
    value: OfflineQueuedReport;
    indexes: { 'by-status': string; 'by-created': number };
  };
  cached_risk: {
    key: string;
    value: {
      locationKey: string;
      data: RiskPointResponse;
      cachedAt: number;
    };
  };
}

const DB_NAME = 'bhurakshak_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<BhuRakshakDB>> | null = null;

export function getOfflineDB(): Promise<IDBPDatabase<BhuRakshakDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in browser environments'));
  }

  if (!dbPromise) {
    dbPromise = openDB<BhuRakshakDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('reports_queue')) {
          const reportStore = db.createObjectStore('reports_queue', { keyPath: 'local_id' });
          reportStore.createIndex('by-status', 'status');
          reportStore.createIndex('by-created', 'created_at');
        }

        if (!db.objectStoreNames.contains('cached_risk')) {
          db.createObjectStore('cached_risk', { keyPath: 'locationKey' });
        }
      },
    });
  }

  return dbPromise;
}

export async function saveQueuedReport(report: OfflineQueuedReport): Promise<void> {
  const db = await getOfflineDB();
  await db.put('reports_queue', report);
}

export async function getPendingReports(): Promise<OfflineQueuedReport[]> {
  const db = await getOfflineDB();
  const reports = await db.getAll('reports_queue');
  return reports.filter((report) => report.status === 'pending' || report.status === 'failed');
}

export async function getAllQueuedReports(): Promise<OfflineQueuedReport[]> {
  const db = await getOfflineDB();
  return db.getAll('reports_queue');
}

export async function updateQueuedReport(report: OfflineQueuedReport): Promise<void> {
  const db = await getOfflineDB();
  await db.put('reports_queue', report);
}

export async function deleteQueuedReport(localId: string): Promise<void> {
  const db = await getOfflineDB();
  await db.delete('reports_queue', localId);
}

export async function cacheRiskPoint(latitude: number, longitude: number, data: RiskPointResponse): Promise<void> {
  try {
    const db = await getOfflineDB();
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    await db.put('cached_risk', {
      locationKey: key,
      data,
      cachedAt: Date.now(),
    });
  } catch {
    // Ignore caching failure in private/restricted mode
  }
}

export async function getCachedRiskPoint(latitude: number, longitude: number): Promise<RiskPointResponse | null> {
  try {
    const db = await getOfflineDB();
    const key = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const result = await db.get('cached_risk', key);
    return result ? result.data : null;
  } catch {
    return null;
  }
}
