'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import type { CitizenReportItem, ReportMediaItem } from '@/lib/types';
import { CheckCircle2, XCircle, Clock, ShieldAlert, Eye, Image as ImageIcon, MapPin, Tag, Road, AlertTriangle } from 'lucide-react';

interface ReportReviewQueueProps {
  authorityKey: string;
  onActionComplete?: () => void;
}

export function ReportReviewQueue({ authorityKey, onActionComplete }: ReportReviewQueueProps) {
  const { t } = useTranslation();
  const [reports, setReports] = useState<CitizenReportItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [selectedReport, setSelectedReport] = useState<CitizenReportItem | null>(null);
  const [mediaList, setMediaList] = useState<ReportMediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Review Form State
  const [actionStatus, setActionStatus] = useState<'verified' | 'rejected' | 'under_review'>('verified');
  const [severity, setSeverity] = useState<string>('high');
  const [verificationNote, setVerificationNote] = useState<string>('');
  const [affectedRoadId, setAffectedRoadId] = useState<string>('');
  const [confirmRoadClosure, setConfirmRoadClosure] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const res = await api.getAuthorityReports(
        authorityKey,
        filterStatus === 'all' ? undefined : filterStatus,
        0,
        50
      );
      setReports(res.items || []);
    } catch (err) {
      console.warn('Load authority reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [filterStatus, authorityKey]);

  const handleSelectReport = async (report: CitizenReportItem) => {
    setSelectedReport(report);
    setAffectedRoadId(report.affected_road_id || '');
    setVerificationNote(report.verification_note || '');
    setMediaList([]);

    setLoadingMedia(true);
    try {
      const mediaRes = await api.getReportMedia(report.report_id, authorityKey);
      setMediaList(mediaRes.items || []);
    } catch (err) {
      console.warn('Fetch media error:', err);
    } finally {
      setLoadingMedia(false);
    }
  };

  const handleVerifyReport = async () => {
    if (!selectedReport) return;
    setIsProcessing(true);
    try {
      await api.verifyReport(
        selectedReport.report_id,
        {
          status: actionStatus,
          verified_by: 'officer-authority',
          severity,
          category: selectedReport.category,
          verification_note: verificationNote || undefined,
          affected_road_id: affectedRoadId || undefined,
          confirmed_road_blockage: confirmRoadClosure,
        },
        authorityKey
      );

      setSelectedReport(null);
      await loadReports();
      if (onActionComplete) onActionComplete();
    } catch (err: any) {
      alert('Verification update error: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div className="flex gap-1.5 text-xs font-semibold">
          {['pending', 'verified', 'under_review', 'rejected', 'all'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                filterStatus === st
                  ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {st.replace('_', ' ')}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          {reports.length} reports
        </span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          Loading citizen reports queue...
        </div>
      ) : reports.length === 0 ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          No reports found with status &apos;{filterStatus}&apos;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reports.map((r) => (
            <div
              key={r.report_id}
              onClick={() => handleSelectReport(r)}
              className={`p-4 rounded-xl border text-left cursor-pointer transition-all space-y-2.5 ${
                selectedReport?.report_id === r.report_id
                  ? 'bg-slate-900 border-sky-500 ring-1 ring-sky-500/50 shadow-lg'
                  : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-bold text-xs text-slate-200 block">
                    {t.categories[r.category] || r.category}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    ID: {r.report_id.slice(0, 8)}... • {r.place_name || 'Aizawl'}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    r.verification_status === 'verified'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : r.verification_status === 'rejected'
                      ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                      : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  }`}
                >
                  {r.verification_status.replace('_', ' ')}
                </span>
              </div>

              {r.description_original && (
                <p className="text-xs text-slate-300 line-clamp-2 italic">
                  &quot;{r.description_original}&quot;
                </p>
              )}

              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                <span className="font-mono">
                  {r.latitude.toFixed(3)}°N, {r.longitude.toFixed(3)}°E ({r.location_source})
                </span>
                <span className="capitalize">{r.reporter_type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Report Review & Media Inspection Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 text-slate-100 max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <span>Review Hazard Report</span>
                  <span className="text-xs font-mono font-normal text-slate-400">
                    ({selectedReport.report_id})
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Submitted by {selectedReport.reporter_type} on {new Date(selectedReport.captured_at).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedReport(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {/* Media Previews via Private Signed URLs */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-sky-400" />
                Attached Media Evidence
              </span>

              {loadingMedia ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Retrieving private signed media URLs...
                </div>
              ) : mediaList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {mediaList.map((m) => (
                    <div key={m.media_id} className="p-2 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      {m.media_type === 'video' ? (
                        <video src={m.signed_url} controls className="w-full h-40 object-cover rounded-lg bg-black" />
                      ) : (
                        <img src={m.signed_url} alt="Report Media" className="w-full h-40 object-cover rounded-lg bg-black" />
                      )}
                      <div className="flex justify-between text-[10px] text-slate-400">
                        <span>{m.mime_type}</span>
                        <span>{(m.file_size_bytes / 1024).toFixed(0)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                  No photo/video attachments uploaded for this report.
                </div>
              )}
            </div>

            {/* Action Form */}
            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3 text-xs">
              <span className="font-bold text-slate-200 block uppercase tracking-wider text-[11px]">
                Authority Action & Road Closure Impact
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Verification Decision</label>
                  <select
                    value={actionStatus}
                    onChange={(e) => setActionStatus(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="verified">Verify & Confirm Incident</option>
                    <option value="under_review">Mark Under Review</option>
                    <option value="rejected">Reject Report</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Severity Assessment</label>
                  <select
                    value={severity}
                    onChange={(e) => setSeverity(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Associate Affected Road ID (e.g. way/123456)</label>
                <input
                  type="text"
                  value={affectedRoadId}
                  onChange={(e) => setAffectedRoadId(e.target.value)}
                  placeholder="e.g. way/12345 or NH-54"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 font-mono"
                />
              </div>

              {actionStatus === 'verified' && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-300 text-xs block">
                      Confirm Official Road Closure
                    </span>
                    <span className="text-[10px] text-rose-200/80">
                      Disables graph edges and recalculates safer routing for all users.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={confirmRoadClosure}
                    onChange={(e) => setConfirmRoadClosure(e.target.checked)}
                    className="w-5 h-5 rounded bg-slate-900 border-slate-700 text-rose-600 focus:ring-rose-500 cursor-pointer"
                  />
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Verification Note / Action Log</label>
                <textarea
                  rows={2}
                  value={verificationNote}
                  onChange={(e) => setVerificationNote(e.target.value)}
                  placeholder="e.g. Field inspection team confirmed 15m road blockage at km 12."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleVerifyReport}
                disabled={isProcessing}
                className="px-6 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-600/20"
              >
                {isProcessing ? 'Updating...' : 'Save Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
