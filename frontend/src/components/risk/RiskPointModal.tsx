'use client';



import React from 'react';

import { useTranslation } from '@/lib/i18n/context';

import { RISK_COLORS, RISK_BADGE_CLASSES, CONTEXT_LABELS } from '@/lib/config';

import type { RiskPointResponse } from '@/lib/types';

import { ShieldAlert, Mountain, CloudRain, History, Activity, Sparkles, X, MapPin, AlertTriangle, Layers } from 'lucide-react';



interface RiskPointModalProps {

  data: RiskPointResponse | null;

  loading: boolean;

  onClose: () => void;

  onOpenCopilot: (coords: { latitude: number; longitude: number }) => void;

}



export function RiskPointModal({

  data,

  loading,

  onClose,

  onOpenCopilot,

}: RiskPointModalProps) {

  const { t } = useTranslation();



  if (!data && !loading) return null;



  return (

    <div className="absolute top-4 left-4 z-30 w-full max-w-sm sm:max-w-md bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-xl p-4 sm:p-5 text-slate-100 max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-left-4">

      {/* Header */}

      <div className="flex items-start justify-between pb-3 border-b border-slate-800">

        <div className="flex items-center gap-2">

          <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">

            <ShieldAlert className="w-4 h-4" />

          </div>

          <div>

            <h3 className="font-bold text-sm tracking-wide text-white">

              {t.risk.pointAnalysis}

            </h3>

            {data && (

              <p className="text-[11px] text-slate-400 font-mono">

                {data.location.latitude.toFixed(4)}°N, {data.location.longitude.toFixed(4)}°E

              </p>

            )}

          </div>

        </div>

        <button

          onClick={onClose}

          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"

        >

          <X className="w-4 h-4" />

        </button>

      </div>



      {loading ? (

        <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">

          <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />

          <span className="text-xs">Analyzing terrain, weather & susceptibility signals...</span>

        </div>

      ) : data ? (

        <div className="mt-4 space-y-4 text-xs">

          {/* Context Badge */}

          <div>

            <span

              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold border tracking-wider ${

                CONTEXT_LABELS[data.assessment_context]?.badgeClass || 'bg-slate-800 text-slate-300'

              }`}

            >

              {CONTEXT_LABELS[data.assessment_context]?.label || data.assessment_context}

            </span>

          </div>



          <p className="text-slate-300">Data: {data.data_timestamp || 'Unavailable'}<br />
            {data.assessment_context === 'historical_reference_scenario' ? '2024 historical replay · Cyclone Remal reference' : 'Current AI-assisted risk'}</p>
          <p className="text-slate-400">Rain 72h: {data.signals?.rainfall?.rainfall_72h_mm ?? 'Unavailable'} mm · Rain 7d: {data.signals?.rainfall?.rainfall_7d_mm ?? 'Unavailable'} mm</p>
          <p className="text-slate-400">Soil: {(data.signals?.soil as any)?.volumetric_water_content ?? 'Unavailable'} · Open-Meteo model-derived; contextual only.</p>
          {/* Risk Score & Level Gauge */}

          <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">

            <div>

              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">

                {t.risk.score}

              </span>

              <div className="flex items-baseline gap-1.5 mt-0.5">

                <span

                  className="text-2xl font-black font-mono tracking-tight"

                  style={{ color: RISK_COLORS[data.risk_level] }}

                >

                  {data.risk_score.toFixed(1)}

                </span>

                <span className="text-slate-500 text-[10px]">/100</span>

              </div>

              <span

                className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase mt-1 border ${

                  RISK_BADGE_CLASSES[data.risk_level]

                }`}

              >

                {t.risk[data.risk_level] || data.risk_level}

              </span>

            </div>



            <div>

              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">

                {t.risk.confidence}

              </span>

              <div className="flex items-baseline gap-1.5 mt-0.5">

                <span className="text-2xl font-black font-mono text-slate-200">

                  {data.confidence_score.toFixed(0)}%

                </span>

              </div>

              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 border border-slate-700 mt-1 uppercase">

                {data.confidence_level} Confidence

              </span>

            </div>

          </div>



          {/* Primary Risk Drivers */}

          {data.drivers && data.drivers.length > 0 && (

            <div className="space-y-1.5">

              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">

                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />

                {t.risk.drivers}

              </span>

              <ul className="space-y-1 bg-slate-950/40 p-2.5 rounded-xl border border-slate-800/60 text-slate-300 text-[11px]">

                {data.drivers.map((driver, i) => (

                  <li key={i} className="flex items-start gap-1.5">

                    <span className="text-amber-400 mt-0.5">•</span>

                    <span>{driver}</span>

                  </li>

                ))}

              </ul>

            </div>

          )}



          {/* Key Observational Signals */}

          <div className="space-y-2">

            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">

              <Layers className="w-3.5 h-3.5 text-sky-400" />

              Observational Signals

            </span>



            <div className="grid grid-cols-2 gap-2 text-[11px]">

              {/* Terrain */}

              {data.signals?.terrain && (

                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 space-y-0.5">

                  <div className="flex items-center gap-1 text-slate-400 text-[10px] font-semibold">

                    <Mountain className="w-3 h-3 text-sky-400" />

                    Terrain / Slope

                  </div>

                  <div className="text-slate-200 font-mono font-medium">

                    {data.signals.terrain.slope_deg?.toFixed(1)}° Slope

                  </div>

                  <div className="text-slate-400 text-[10px]">

                    {data.signals.terrain.elevation_m?.toFixed(0)}m Elevation

                  </div>

                </div>

              )}



              {/* Historical Susceptibility */}

              {(() => {

                const hist = (data.signals?.historical || data.signals?.historical_susceptibility) as any;

                if (!hist) return null;

                const score = hist.historical_susceptibility_score;

                const events = hist.historical_events_within_1km;

                return (

                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 space-y-0.5">

                    <div className="flex items-center gap-1 text-slate-400 text-[10px] font-semibold">

                      <History className="w-3 h-3 text-rose-400" />

                      Historical Susc.

                    </div>

                    <div className="text-slate-200 font-mono font-medium">

                      {(Number(score || 0) * 100).toFixed(1)}%

                    </div>

                    <div className="text-slate-400 text-[10px]">

                      {events ?? 0} events &lt;1km

                    </div>

                  </div>

                );

              })()}



              {/* Rainfall / Weather */}

              {data.signals?.rainfall && (

                <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 space-y-0.5">

                  <div className="flex items-center gap-1 text-slate-400 text-[10px] font-semibold">

                    <CloudRain className="w-3 h-3 text-sky-400" />

                    Rainfall Signal

                  </div>

                  <div className="text-slate-200 font-mono font-medium">

                    {data.signals.rainfall.rainfall_24h_mm !== undefined && data.signals.rainfall.rainfall_24h_mm !== null

                      ? `${Number(data.signals.rainfall.rainfall_24h_mm).toFixed(1)} mm (24h)`

                      : 'Unavailable'}

                  </div>

                  <div className="text-slate-400 text-[10px]">

                    {data.signals.rainfall.provider || 'Unavailable'}

                  </div>

                </div>

              )}



              {/* ML Model */}

              {(() => {

                const ml = (data.signals?.ml || data.signals?.ml_susceptibility) as any;

                if (!ml) return null;

                const score = ml.ml_susceptibility_score ?? ml.susceptibility_score;

                return (

                  <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 space-y-0.5">

                    <div className="flex items-center gap-1 text-slate-400 text-[10px] font-semibold">

                      <Activity className="w-3 h-3 text-indigo-400" />

                      ML Susceptibility

                    </div>

                    <div className="text-slate-200 font-mono font-medium">

                      {score !== undefined && score !== null

                        ? `${(Number(score) * 100).toFixed(1)}%`

                        : 'Not active'}

                    </div>

                    <div className="text-slate-400 text-[10px] truncate" title={ml.model_name}>

                      {ml.model_name || 'XGBoost'}

                    </div>

                  </div>

                );

              })()}

            </div>

          </div>



          {/* Missing Signals */}

          {data.missing_signals && data.missing_signals.length > 0 && (

            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">

              <span className="font-semibold text-slate-300 block mb-1">

                {t.risk.missingSignals}:

              </span>

              <div className="flex flex-wrap gap-1">

                {data.missing_signals.map((sig, i) => (

                  <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">

                    {sig}

                  </span>

                ))}

              </div>

            </div>

          )}



          {/* What Should I Do? Action Button */}

          <div className="pt-2">

            <button

              onClick={() => onOpenCopilot(data.location)}

              className="w-full py-2.5 px-4 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all text-xs"

            >

              <Sparkles className="w-4 h-4 animate-pulse" />

              <span>{t.copilot.quickPrompt}</span>

            </button>

          </div>

        </div>

      ) : null}

    </div>
  );
}
