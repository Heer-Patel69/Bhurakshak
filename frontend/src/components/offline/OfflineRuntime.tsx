'use client';

import { useEffect } from 'react';
import { syncOfflineReports } from '@/lib/offline/sync';

export function OfflineRuntime() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    if (navigator.onLine) syncOfflineReports();
  }, []);
  return null;
}
