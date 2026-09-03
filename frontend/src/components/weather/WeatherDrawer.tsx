'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import type { WeatherCurrentResponse, WeatherHistoryResponse } from '@/lib/types';
import { CloudRain, CloudLightning, X, Droplets, Thermometer, Wind, CheckCircle2, XCircle, AlertCircle, Clock, Database, Radio } from 'lucide-react';

interface WeatherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates?: { latitude: number; longitude: number } | null;
}

export function WeatherDrawer({
  isOpen,
  onClose,
  coordinates,
}: WeatherDrawerProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState<WeatherCurrentResponse | null>(null);
  const [history, setHistory] = useState<WeatherHistoryResponse | null>(null);
  const [weatherStatus, setWeatherStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const target = coordinates || { latitude: 23.7271, longitude: 92.7176 };

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    Promise.all([
      api.getCurrentWeather(target.latitude, target.longitude).catch(() => null),
      api.getWeatherHistory(target.latitude, target.longitude).catch(() => null),
      api.getWeatherStatus().catch(() => null),
    ]).then(([curr, hist, stat]) => {
      setCurrent(curr);
      setHistory(hist);
      setWeatherStatus(stat);
      setLoading(false);
    });
  }, [isOpen, target.latitude, target.longitude]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end p-0 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 shadow-2xl p-6 flex flex-col text-slate-100 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
              <CloudRain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">{t.weather.title}</h3>
              <p className="text-xs text-slate-400">
                Aizawl Region ({target.latitude.toFixed(3)}°N, {target.longitude.toFixed(3)}°E)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Querying weather provider gateways...</span>
          </div>
        ) : (
          <div className="mt-5 space-y-6 text-xs flex-1">
            {/* IMD Live Weather Card */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <CloudLightning className="w-3.5 h-3.5 text-amber-400" />
                  {t.weather.current}
                </span>
                {current?.live ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    LIVE IMD
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    NOT CONNECTED
                  </span>
                )}
              </div>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                {current?.live && current.observation ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-[10px] text-slate-400 block">{t.weather.rainfall1h}</span>
                        <span className="text-lg font-bold font-mono text-sky-400">
                          {current.observation.rainfall_1h_mm ?? 0} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{t.weather.rainfall24h}</span>
                        <span className="text-lg font-bold font-mono text-sky-400">
                          {current.observation.rainfall_24h_mm ?? 0} mm
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{t.weather.temperature}</span>
                        <span className="text-base font-bold font-mono text-slate-200">
                          {current.observation.temperature_c ?? '--'} °C
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">{t.weather.humidity}</span>
                        <span className="text-base font-bold font-mono text-slate-200">
                          {current.observation.humidity_percent ?? '--'} %
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-3 px-2 text-center space-y-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                      <AlertCircle className="w-4 h-4 text-amber-400" />
                      <span>{t.weather.imdNotConnected}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                      Real-time Indian Meteorological Department (IMD) telemetry requires station API credentials. The system automatically switches to historical CHIRPS storm references.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Historical CHIRPS Reference Section */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-sky-400" />
                {t.weather.historical}
              </span>

              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                {history?.observation ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-300">
                      <span>Source Inventory</span>
                      <span className="font-mono text-sky-400 font-medium">CHIRPS 0.05° Gridded Rainfall</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{t.weather.rainfall24h}</span>
                        <span className="text-base font-bold font-mono text-slate-100">
                          {history.observation.rainfall_24h_mm?.toFixed(1) ?? '--'} mm
                        </span>
                      </div>
                      <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">{t.weather.rainfall72h}</span>
                        <span className="text-base font-bold font-mono text-slate-100">
                          {history.observation.rainfall_72h_mm?.toFixed(1) ?? '--'} mm
                        </span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Pilot Reference Window:</span>
                      <span className="font-mono">May–Sep Monsoons</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 text-center py-2">Historical rainfall dataset available in backend repository.</p>
                )}
              </div>
            </div>

            {/* Provider Gateways & Data Freshness */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-indigo-400" />
                Provider Status Telemetry
              </span>

              <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800 space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">Copernicus DEM (Terrain)</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Available (Static)
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">GSI Landslide Inventory</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 572 Records
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">OSM Aizawl Roads</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 116,763 Segments
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">XGBoost ML Susceptibility</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Operational
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">CHIRPS Rainfall</span>
                  <span className="text-amber-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Historical Reference
                  </span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-300">IMD Weather Station</span>
                  <span className="text-slate-400 font-semibold flex items-center gap-1">
                    <XCircle className="w-3 h-3 text-slate-500" /> Not Configured
                  </span>
                </div>
                <div className="flex items-center justify-between py-1">
                  <span className="text-slate-300">Groq LLM Safety Copilot</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Ready (with Fallback)
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
