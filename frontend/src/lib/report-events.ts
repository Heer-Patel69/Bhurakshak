import type { CitizenReportPayload } from './types';

const STORAGE_KEY = 'bhurakshak_local_pending_reports';
const EVENT_NAME = 'bhurakshak:report-submitted';
const MAX_LOCAL_REPORTS = 50;
const RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface LocalPendingReport {
  report_id: string;
  latitude: number;
  longitude: number;
  category: string;
  captured_at: string;
  verification_status: 'pending';
  sync_status: 'pending' | 'synced';
  saved_at: number;
}

function readStoredReports(): LocalPendingReport[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - RETENTION_MS;
    return parsed.filter((item) => item?.report_id && item.saved_at >= cutoff).slice(-MAX_LOCAL_REPORTS);
  } catch {
    return [];
  }
}

function writeStoredReports(reports: LocalPendingReport[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(-MAX_LOCAL_REPORTS)));
}

export function rememberPendingReport(
  reportId: string,
  payload: CitizenReportPayload,
  syncStatus: LocalPendingReport['sync_status']
): LocalPendingReport {
  const pending: LocalPendingReport = {
    report_id: reportId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    category: payload.category,
    captured_at: payload.timestamp || new Date().toISOString(),
    verification_status: 'pending',
    sync_status: syncStatus,
    saved_at: Date.now(),
  };
  const reports = readStoredReports().filter((item) => item.report_id !== reportId);
  reports.push(pending);
  writeStoredReports(reports);
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: pending }));
  return pending;
}

export function getLocalPendingReports(): LocalPendingReport[] {
  return readStoredReports();
}

export function reconcileVerifiedReports(verifiedReportIds: string[]): LocalPendingReport[] {
  const verified = new Set(verifiedReportIds);
  const reports = readStoredReports().filter((item) => !verified.has(item.report_id));
  writeStoredReports(reports);
  return reports;
}

export function pendingReportToFeature(report: LocalPendingReport) {
  return {
    type: 'Feature' as const,
    id: report.report_id,
    geometry: {
      type: 'Point' as const,
      coordinates: [report.longitude, report.latitude],
    },
    properties: {
      report_id: report.report_id,
      category: report.category,
      severity: 'unverified',
      verification_status: 'pending',
      sync_status: report.sync_status,
      captured_at: report.captured_at,
      source: 'local_citizen_report',
    },
  };
}

export const REPORT_SUBMITTED_EVENT = EVENT_NAME;
