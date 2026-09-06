'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useTranslation } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import { saveQueuedReport } from '@/lib/offline/db';
import { rememberPendingReport } from '@/lib/report-events';
import type { CitizenReportPayload, HazardCategory, LocationSource } from '@/lib/types';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileImage,
  Locate,
  MapPin,
  RefreshCw,
  Shield,
  Upload,
} from 'lucide-react';

const ReportLocationMap = dynamic(
  () => import('@/components/map/BhuRakshakMap').then((mod) => mod.BhuRakshakMap),
  { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-slate-950" /> }
);

const CATEGORIES: Array<{ key: HazardCategory; label: string; icon: string }> = [
  { key: 'landslide', label: 'Landslide', icon: '⛰️' },
  { key: 'road_blockage', label: 'Road Blocked', icon: '🚧' },
  { key: 'rockfall', label: 'Rockfall', icon: '🪨' },
  { key: 'slope_crack', label: 'Slope Crack', icon: '⚡' },
  { key: 'debris', label: 'Debris', icon: '🌊' },
  { key: 'flash_flood', label: 'Flood / Water', icon: '🌧️' },
  { key: 'road_damage', label: 'Road Damage', icon: '🛣️' },
  { key: 'low_visibility', label: 'Low Visibility', icon: '🌫️' },
  { key: 'unknown', label: 'Other', icon: '⚠️' },
];

type Coordinates = { latitude: number; longitude: number; accuracy: number | null };

export function HazardReportForm() {
  const { language } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [step, setStep] = useState(1);
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locationSource, setLocationSource] = useState<LocationSource>('device_gps');
  const [showMap, setShowMap] = useState(false);
  const [category, setCategory] = useState<HazardCategory>('landslide');
  const [description, setDescription] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaCapturedAt, setMediaCapturedAt] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
  }, [mediaPreview]);

  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      setErrorMessage('Location is not supported on this device. Select the location on the map.');
      setShowMap(true);
      return;
    }
    setIsLocating(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setLocationSource('device_gps');
        setShowMap(false);
        setIsLocating(false);
      },
      () => {
        setErrorMessage('GPS permission was unavailable. Select the hazard location on the map.');
        setShowMap(true);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleMapSelection = (point: { latitude: number; longitude: number }) => {
    setCoords({ ...point, accuracy: null });
    setLocationSource('manual_pin');
    setErrorMessage(null);
  };

  const handleMediaChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setErrorMessage('File size exceeds 20 MB. Choose a smaller photo or short video.');
      return;
    }
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setMediaFile(file);
    setMediaCapturedAt(new Date().toISOString());
    setMediaPreview(URL.createObjectURL(file));
    setErrorMessage(null);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
          setLocationSource('device_gps');
        },
        () => undefined,
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 15000 }
      );
    }
  };

  const buildPayload = (reportId: string): CitizenReportPayload | null => {
    if (!coords) return null;
    const categoryLabel = CATEGORIES.find((item) => item.key === category)?.label || 'Hazard';
    return {
      report_id: reportId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_m: coords.accuracy,
      timestamp: mediaCapturedAt || new Date().toISOString(),
      category,
      description_original: description.trim() || `${categoryLabel} reported by a citizen.`,
      language,
      location_source: locationSource,
      reporter_type: 'citizen',
      district: 'Aizawl',
      offline_created_at: !navigator.onLine ? new Date().toISOString() : undefined,
    };
  };

  const queueOffline = async (reportId: string, payload: CitizenReportPayload) => {
    await saveQueuedReport({
      local_id: reportId,
      payload,
      media_file: mediaFile,
      media_filename: mediaFile?.name,
      media_mime: mediaFile?.type,
      status: 'pending',
      created_at: Date.now(),
    });
    rememberPendingReport(reportId, payload, 'pending');
    setSavedOffline(true);
    setSubmittedReportId(reportId);
    setStep(6);
  };

  const handleSubmit = async () => {
    const clientReportId = crypto.randomUUID();
    const payload = buildPayload(clientReportId);
    if (!payload) {
      setStep(1);
      setErrorMessage('Choose the hazard location before submitting.');
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    if (!navigator.onLine) {
      try {
        await queueOffline(clientReportId, payload);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown storage error';
        setErrorMessage(`Could not save the offline report: ${message}`);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    try {
      const result = await api.submitReport(payload);
      const reportId = result.report_id || clientReportId;
      if (mediaFile) {
        try {
          await api.uploadReportMedia(reportId, mediaFile);
        } catch (error) {
          console.warn('Report saved, but media upload is waiting for a retry.', error);
        }
      }
      rememberPendingReport(reportId, payload, 'synced');
      setSubmittedReportId(reportId);
      setSavedOffline(false);
      setStep(6);
    } catch (error: unknown) {
      try {
        await queueOffline(clientReportId, payload);
      } catch {
        setErrorMessage(error instanceof Error ? error.message : 'Submission failed. Check the connection and try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    if (mediaPreview) URL.revokeObjectURL(mediaPreview);
    setStep(1);
    setCoords(null);
    setShowMap(false);
    setCategory('landslide');
    setDescription('');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaCapturedAt(null);
    setSubmittedReportId(null);
    setSavedOffline(false);
    setErrorMessage(null);
  };

  const nextFromLocation = () => {
    if (!coords) {
      setErrorMessage('Use GPS or select the hazard location on the map.');
      return;
    }
    setErrorMessage(null);
    setStep(2);
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-2xl sm:p-7">
      <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/20 text-amber-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Report Hazard</h2>
            <p className="text-xs text-slate-400">A short, geo-tagged report for emergency review.</p>
          </div>
        </div>
        {step <= 5 && <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 font-mono text-xs font-bold text-sky-400">Step {step} / 5</span>}
      </div>

      {errorMessage && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertOctagon className="h-4 w-4 shrink-0" /><span>{errorMessage}</span>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div><h3 className="text-sm font-bold text-slate-200">Where is the hazard?</h3><p className="mt-1 text-xs text-slate-400">GPS accuracy and time are recorded automatically when available.</p></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleCaptureGPS} disabled={isLocating} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-xs font-bold text-white hover:bg-sky-500 disabled:bg-slate-800">
              <Locate className={`h-4 w-4 ${isLocating ? 'animate-spin' : ''}`} />{isLocating ? 'Finding location...' : 'Use My Location'}
            </button>
            <button type="button" onClick={() => setShowMap((value) => !value)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-bold text-slate-200 hover:border-sky-500">
              <MapPin className="h-4 w-4 text-sky-400" />Select on Map
            </button>
          </div>
          {showMap && <div className="h-72 overflow-hidden rounded-xl border border-slate-700"><ReportLocationMap selectedCoordinates={coords} onSelectCoordinates={handleMapSelection} /></div>}
          {coords && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" /><div><div className="font-bold">Location captured</div><div className="font-mono text-[11px] text-slate-300">{coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}{coords.accuracy !== null ? ` · ±${coords.accuracy.toFixed(0)} m` : ' · map pin'}</div></div>
            </div>
          )}
          <div className="flex justify-end"><button type="button" onClick={nextFromLocation} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-sky-500">Next <ArrowRight className="h-4 w-4" /></button></div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div><h3 className="text-sm font-bold text-slate-200">What do you see?</h3><p className="mt-1 text-xs text-slate-400">Choose the closest quick option. Authorities can correct it during review.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {CATEGORIES.map((item) => <button key={item.key} type="button" onClick={() => setCategory(item.key)} className={`min-h-20 rounded-xl border p-3 text-left transition-colors ${category === item.key ? 'border-sky-500 bg-sky-950/50 text-white' : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600'}`}><span className="block text-xl">{item.icon}</span><span className="mt-1 block text-xs font-bold">{item.label}</span></button>)}
          </div>
          <WizardActions back={() => setStep(1)} next={() => setStep(3)} />
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div><h3 className="text-sm font-bold text-slate-200">Add a photo or short video</h3><p className="mt-1 text-xs text-slate-400">Optional. Evidence is visible to authenticated authority reviewers.</p></div>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleMediaChange} />
          <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleMediaChange} />
          {mediaPreview ? (
            <div className="overflow-hidden rounded-xl border border-slate-700 bg-black">
              {mediaFile?.type.startsWith('video/') ? <video src={mediaPreview} controls className="max-h-80 w-full object-contain" /> : <img src={mediaPreview} alt="Hazard evidence preview" className="max-h-80 w-full object-contain" />}
              <div className="flex items-center justify-between bg-slate-950 p-3 text-[11px] text-slate-300"><span className="truncate">{mediaFile?.name}</span><button type="button" onClick={() => { setMediaFile(null); setMediaPreview(null); }} className="text-rose-300">Remove</button></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 text-xs font-bold text-sky-300"><Camera className="h-5 w-5" />Take Photo</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-24 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950 text-xs font-bold text-slate-300"><FileImage className="h-5 w-5" />Choose Photo / Video</button>
            </div>
          )}
          <WizardActions back={() => setStep(2)} next={() => setStep(4)} nextLabel={mediaFile ? 'Next' : 'Skip'} />
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <div><h3 className="text-sm font-bold text-slate-200">Add a short description</h3><p className="mt-1 text-xs text-slate-400">Optional. Say whether the road is passable or the hazard is still moving.</p></div>
          <textarea rows={5} maxLength={500} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Example: rocks are still falling and one lane is blocked" className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500" />
          <div className="text-right text-[10px] text-slate-500">{description.length}/500</div>
          <WizardActions back={() => setStep(3)} next={() => setStep(5)} nextLabel={description ? 'Next' : 'Skip'} />
        </div>
      )}

      {step === 5 && coords && (
        <div className="space-y-4">
          <div><h3 className="text-sm font-bold text-slate-200">Submit report</h3><p className="mt-1 text-xs text-slate-400">Check the essentials. No account is required for a citizen report.</p></div>
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs">
            <SummaryRow label="Hazard" value={CATEGORIES.find((item) => item.key === category)?.label || category} />
            <SummaryRow label="Location" value={`${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`} />
            <SummaryRow label="Accuracy" value={coords.accuracy === null ? 'Map pin' : `±${coords.accuracy.toFixed(0)} m`} />
            <SummaryRow label="Media" value={mediaFile ? mediaFile.name : 'None'} />
            <SummaryRow label="Language" value={language.toUpperCase()} />
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[11px] text-amber-100"><Shield className="h-4 w-4 shrink-0" /><span>Citizen reports are Pending Verification. They never close a road until an authority confirms the closure.</span></div>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setStep(4)} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-300"><ArrowLeft className="h-4 w-4" />Back</button>
            <button type="button" onClick={handleSubmit} disabled={isSubmitting} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-amber-600 px-7 py-3 text-xs font-bold text-white hover:bg-amber-500 disabled:bg-slate-800">{isSubmitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}{isSubmitting ? 'Saving report...' : 'Submit Hazard Report'}</button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-5 py-4 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"><CheckCircle2 className="h-8 w-8" /></div>
          <div><h3 className="text-lg font-bold text-white">{savedOffline ? 'Report Saved Offline' : 'Report Submitted'}</h3><p className="mx-auto mt-2 max-w-md text-xs text-slate-400">{savedOffline ? 'It is safely queued on this device and will sync automatically when the connection returns.' : 'It now appears on this device as a Citizen Report — Pending Verification and is available to authority reviewers.'}</p></div>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-300">Report ID: {submittedReportId}</div>
          <button type="button" onClick={resetForm} className="min-h-11 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-sky-500">Report Another Hazard</button>
        </div>
      )}
    </div>
  );
}

function WizardActions({ back, next, nextLabel = 'Next' }: { back: () => void; next: () => void; nextLabel?: string }) {
  return <div className="flex justify-between pt-2"><button type="button" onClick={back} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-300 hover:bg-slate-700"><ArrowLeft className="h-4 w-4" />Back</button><button type="button" onClick={next} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-sky-600 px-6 py-2.5 text-xs font-bold text-white hover:bg-sky-500">{nextLabel}<ArrowRight className="h-4 w-4" /></button></div>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-2 last:border-0 last:pb-0"><span className="text-slate-500">{label}</span><span className="text-right font-semibold text-slate-200">{value}</span></div>;
}
