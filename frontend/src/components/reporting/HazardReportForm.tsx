'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation, type LanguageCode } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import { saveQueuedReport } from '@/lib/offline/db';
import type { HazardCategory, LocationSource, ReporterType, CitizenReportPayload } from '@/lib/types';
import {
  AlertTriangle,
  Locate,
  MapPin,
  Camera,
  Video,
  FileImage,
  CheckCircle2,
  AlertOctagon,
  ArrowRight,
  ArrowLeft,
  Upload,
  RefreshCw,
  Info,
  Shield,
  Layers,
} from 'lucide-react';

const CATEGORIES: Array<{ key: HazardCategory; label: string; icon: string; desc: string }> = [
  { key: 'landslide', label: 'Active Landslide', icon: '⛰️', desc: 'Active earth/mud mass sliding down slope' },
  { key: 'slope_crack', label: 'Slope / Tension Crack', icon: '⚡', desc: 'Visible ground fissures or slope cracks' },
  { key: 'rockfall', label: 'Rockfall / Boulders', icon: '🪨', desc: 'Loose rocks falling or rolling onto terrain' },
  { key: 'debris', label: 'Debris Flow', icon: '🌊', desc: 'Mud, gravel, and organic debris accumulation' },
  { key: 'water_seepage', label: 'Water Seepage', icon: '💧', desc: 'Heavy unexplained water oozing from slope' },
  { key: 'road_blockage', label: 'Road Blockage', icon: '🚧', desc: 'Slide material obstructing road traffic' },
  { key: 'slope_movement', label: 'Slope Movement', icon: '📉', desc: 'Gradual creeping or shifting terrain' },
  { key: 'collapsed_retaining_wall', label: 'Collapsed Retaining Wall', icon: '🧱', desc: 'Cracked, bulging, or fallen road wall' },
  { key: 'flash_flood', label: 'Flash Flood / Torrent', icon: '🌧️', desc: 'Rapid mountain runoff washing away road' },
  { key: 'unknown', label: 'Other Hazard', icon: '⚠️', desc: 'Other unidentified geological danger' },
];

export function HazardReportForm() {
  const { t, language } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [step, setStep] = useState<number>(1);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number | null }>({
    latitude: 23.7271,
    longitude: 92.7176,
    accuracy: null,
  });
  const [locationSource, setLocationSource] = useState<LocationSource>('device_gps');
  const [category, setCategory] = useState<HazardCategory>('landslide');
  const [description, setDescription] = useState('');
  const [placeName, setPlaceName] = useState('Aizawl');
  const [landmark, setLandmark] = useState('');
  const [roadName, setRoadName] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<'en' | 'hi' | 'lus'>(language);
  const [reporterType, setReporterType] = useState<ReporterType>('citizen');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaCapturedAt, setMediaCapturedAt] = useState<string | null>(null);

  // Submission State
  const [isLocating, setIsLocating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [savedOffline, setSavedOffline] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // GPS Geolocation Handler
  const handleCaptureGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser. Please enter coordinates manually.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationSource('device_gps');
      },
      (err) => {
        setIsLocating(false);
        console.warn('GPS capture error:', err);
        alert('Could not access GPS. Please allow location permissions or set coordinates manually.');
        setLocationSource('manual_pin');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  // Media Selection Handler
  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size limit (20MB)
    if (file.size > 20 * 1024 * 1024) {
      alert('File size exceeds 20MB limit. Please select a smaller photo or short video.');
      return;
    }

    setMediaFile(file);
    setMediaCapturedAt(new Date().toISOString());
    const objectUrl = URL.createObjectURL(file);
    setMediaPreview(objectUrl);

    // Attach a fresh device location to the report metadata at capture/select time.
    // We do not rewrite EXIF bytes; the protected report record is the source of truth.
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

  // Submit Handler
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    // Generate client-side UUID for offline idempotency
    const clientReportId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `rep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload: CitizenReportPayload = {
      report_id: clientReportId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy_m: coords.accuracy,
      timestamp: mediaCapturedAt || new Date().toISOString(),
      category,
      description_original: description || `${t.categories[category]} reported at ${placeName}`,
      language: selectedLanguage,
      location_source: locationSource,
      reporter_type: reporterType,
      place_name: placeName,
      landmark: landmark || undefined,
      road_name: roadName || undefined,
      district: 'Aizawl',
      offline_created_at: !navigator.onLine ? new Date().toISOString() : undefined,
    };

    // If offline or request fails, queue in IndexedDB
    if (!navigator.onLine) {
      try {
        await saveQueuedReport({
          local_id: clientReportId,
          payload,
          media_file: mediaFile,
          media_filename: mediaFile?.name,
          media_mime: mediaFile?.type,
          status: 'pending',
          created_at: Date.now(),
        });
        setSavedOffline(true);
        setSubmittedReportId(clientReportId);
        setStep(8);
      } catch (dbErr: any) {
        setErrorMessage('Failed to store offline report: ' + dbErr.message);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    try {
      // 1. Submit report payload to FastAPI backend
      const result = await api.submitReport(payload);
      const serverReportId = result.report_id || clientReportId;

      // 2. Upload media if attached
      if (mediaFile) {
        try {
          await api.uploadReportMedia(serverReportId, mediaFile);
        } catch (mediaErr: any) {
          console.warn('Media upload warning (report itself succeeded):', mediaErr);
        }
      }

      setSubmittedReportId(serverReportId);
      setSavedOffline(false);
      setStep(8);
    } catch (err: any) {
      console.warn('Live report submission failed, falling back to offline queue:', err);
      // Fallback to IndexedDB queue
      try {
        await saveQueuedReport({
          local_id: clientReportId,
          payload,
          media_file: mediaFile,
          media_filename: mediaFile?.name,
          media_mime: mediaFile?.type,
          status: 'pending',
          created_at: Date.now(),
        });
        setSavedOffline(true);
        setSubmittedReportId(clientReportId);
        setStep(8);
      } catch {
        setErrorMessage(err.message || 'Submission failed. Please check network connection.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setStep(1);
    setDescription('');
    setLandmark('');
    setRoadName('');
    setMediaFile(null);
    setMediaPreview(null);
    setMediaCapturedAt(null);
    setSubmittedReportId(null);
    setSavedOffline(false);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-7 text-slate-100">
      {/* Title & Step Header */}
      <div className="pb-4 mb-5 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">{t.report.title}</h2>
              <p className="text-xs text-slate-400">{t.report.subtitle}</p>
            </div>
          </div>
          {step <= 7 && (
            <span className="text-xs font-mono font-bold text-sky-400 bg-sky-500/10 px-2.5 py-1 rounded-full border border-sky-500/20">
              Step {step} / 7
            </span>
          )}
        </div>
      </div>

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Wizard Steps */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step1}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Accurate GPS coordinates help emergency response teams locate the hazard quickly.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={isLocating}
                className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
              >
                <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                <span>{isLocating ? 'Acquiring GPS...' : t.report.useMyLocation}</span>
              </button>

              <button
                type="button"
                onClick={() => setLocationSource('manual_pin')}
                className={`py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all ${
                  locationSource === 'manual_pin'
                    ? 'bg-slate-800 text-sky-400 border-sky-500/40'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                <MapPin className="w-4 h-4" />
                <span>Manual Coordinates</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.latitude}
                  onChange={(e) =>
                    setCoords({ ...coords, latitude: parseFloat(e.target.value) || 23.7271 })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={coords.longitude}
                  onChange={(e) =>
                    setCoords({ ...coords, longitude: parseFloat(e.target.value) || 92.7176 })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
              </div>
            </div>

            {coords.accuracy !== null && (
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>GPS Accuracy: ±{coords.accuracy.toFixed(1)} meters</span>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step2}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Select the primary observation category that best matches what you see.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[50vh] overflow-y-auto pr-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setCategory(cat.key)}
                className={`p-3 rounded-xl border text-left flex items-start gap-3 transition-all ${
                  category === cat.key
                    ? 'bg-sky-950/40 border-sky-500 text-white shadow-md shadow-sky-500/10'
                    : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span className="text-xl">{cat.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-slate-200">{cat.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{cat.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step3}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Provide context such as estimated slide width, whether rocks are still falling, or if road is passable.
            </p>
          </div>

          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.report.descriptionPlaceholder}
            className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
          />

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step4}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Local landmark or village name helps road maintenance crews reach the spot.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                {t.report.placeName} *
              </label>
              <input
                type="text"
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value)}
                placeholder="e.g. Khatla, Bawngkawn, Durtlang, Falkawn"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                {t.report.landmark}
              </label>
              <input
                type="text"
                value={landmark}
                onChange={(e) => setLandmark(e.target.value)}
                placeholder="e.g. Near Government Primary School, 200m after petrol pump"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                {t.report.roadName}
              </label>
              <input
                type="text"
                value={roadName}
                onChange={(e) => setRoadName(e.target.value)}
                placeholder="e.g. NH-54, Treasury Bypass Road, Lengpui Link Road"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step5}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visual proof enables AI & authority specialists to estimate hazard volume and damage severity.
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="hidden"
            onChange={handleMediaChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className="hidden"
            onChange={handleMediaChange}
          />

          <div className="p-6 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/40 text-center space-y-3">
            {mediaPreview ? (
              <div className="space-y-3">
                {mediaFile?.type.startsWith('video') ? (
                  <video src={mediaPreview} controls className="max-h-48 mx-auto rounded-lg border border-slate-700" />
                ) : (
                  <img src={mediaPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg border border-slate-700 object-cover" />
                )}
                <div className="text-xs text-slate-300 font-mono">
                  {mediaFile?.name} ({(mediaFile?.size || 0) / 1024 > 1024 ? `${((mediaFile?.size || 0) / (1024 * 1024)).toFixed(1)} MB` : `${((mediaFile?.size || 0) / 1024).toFixed(0)} KB`})
                </div>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-emerald-400">
                  <MapPin className="w-3.5 h-3.5" />
                  GPS attached to report · {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
                  {coords.accuracy !== null ? ` · ±${coords.accuracy.toFixed(0)}m` : ''}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMediaFile(null);
                    setMediaPreview(null);
                    setMediaCapturedAt(null);
                  }}
                  className="px-3 py-1 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs hover:bg-rose-500/30"
                >
                  Remove File
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 text-sky-400 flex items-center justify-center mx-auto">
                  <Camera className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-300">
                    Capture Photo, Record Video, or Upload Media
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    JPEG, PNG, WebP, MP4 (Max 20MB)
                  </p>
                </div>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="py-2 px-4 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-sky-600/20"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{t.report.chooseFile}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Take photo</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(6)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <span>Next</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 6 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step6}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Identify reporting language and provenance.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Language</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="en">English (en)</option>
                <option value="hi">हिंदी (hi)</option>
                <option value="lus">Mizo ṭawng (lus)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Reporter Role</label>
              <select
                value={reporterType}
                onChange={(e) => setReporterType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
              >
                <option value="citizen">Citizen / Resident</option>
                <option value="field_official">Field Disaster Officer / First Responder</option>
                <option value="authority">District Disaster Management Authority</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(5)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setStep(7)}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs flex items-center gap-1.5"
            >
              <span>Review</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {step === 7 && (
        <div className="space-y-4 animate-in fade-in">
          <div>
            <h3 className="text-sm font-bold text-slate-200">{t.report.step7}</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Confirm report details before submitting to the emergency response queue.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Category:</span>
              <span className="font-bold text-amber-300">{t.categories[category]}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Location:</span>
              <span className="font-mono text-slate-200">
                {coords.latitude.toFixed(4)}°N, {coords.longitude.toFixed(4)}°E ({locationSource})
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-800/80">
              <span className="text-slate-400">Place / Village:</span>
              <span className="text-slate-200">{placeName}</span>
            </div>
            {landmark && (
              <div className="flex justify-between py-1 border-b border-slate-800/80">
                <span className="text-slate-400">Landmark:</span>
                <span className="text-slate-200">{landmark}</span>
              </div>
            )}
            {description && (
              <div className="py-1 border-b border-slate-800/80">
                <span className="text-slate-400 block mb-0.5">Description:</span>
                <p className="text-slate-300 italic">{description}</p>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span className="text-slate-400">Attached Media:</span>
              <span className="text-slate-200">
                {mediaFile ? `${mediaFile.name} (${(mediaFile.size / 1024).toFixed(0)} KB)` : 'None'}
              </span>
            </div>
          </div>

          {/* Official Disclaimer */}
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-start gap-2">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{t.report.disclaimer}</span>
          </div>

          <div className="flex justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(6)}
              className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="py-2.5 px-6 bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-600/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.report.submitting}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>{t.report.submit}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 8 && (
        <div className="space-y-5 text-center py-6 animate-in fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <h3 className="text-base font-bold text-white">{t.report.successTitle}</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              {savedOffline ? t.report.savedOffline : 'Your report has been transmitted to the Bhu Rakshak Emergency Authority dashboard.'}
            </p>
          </div>

          {submittedReportId && (
            <div className="inline-block p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-sky-400">
              <span className="text-slate-500 text-[10px] block uppercase">{t.report.reportId}</span>
              <span>{submittedReportId}</span>
            </div>
          )}

          <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] text-slate-300 max-w-md mx-auto text-left space-y-1">
            <div className="font-bold text-amber-400 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              <span>{t.report.pendingVerification}</span>
            </div>
            <p className="text-slate-400 text-[10px]">
              {t.report.disclaimer}
            </p>
          </div>

          <div className="pt-2 flex justify-center gap-3">
            <button
              type="button"
              onClick={resetForm}
              className="py-2.5 px-6 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs"
            >
              Report Another Hazard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
