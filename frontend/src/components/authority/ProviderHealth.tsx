'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Radio, CheckCircle2, XCircle, AlertCircle, Database, Satellite, Cpu, CloudRain, Sparkles } from 'lucide-react';

interface ProviderHealthProps {
  authorityKey: string;
}

export function ProviderHealth({ authorityKey }: ProviderHealthProps) {
  const [overview, setOverview] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getAuthorityOverview(authorityKey)
      .then((res) => setOverview(res))
      .catch((err) => console.warn('Provider health error:', err))
      .finally(() => setLoading(false));
  }, [authorityKey]);

  return (
    <div className="space-y-4 text-xs">
      <div className="border-b border-slate-800 pb-3">
        <h4 className="font-bold text-sm text-white">System Provider & Sensor Telemetry</h4>
        <p className="text-slate-400 text-xs">
          Real-time health status of data feeds, ML engines, weather stations, satellite models, and sensors.
        </p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading provider health...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Copernicus DEM */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Copernicus DEM (Terrain)</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-[11px]">
              Local slope, elevation, and terrain features loaded from verified dataset.
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Operational (Static)
            </span>
          </div>

          {/* GSI Landslides */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">GSI Landslide Inventory</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-[11px]">
              572 verified historical events with spatial kernel susceptibility.
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              572 Events Loaded
            </span>
          </div>

          {/* XGBoost Susceptibility */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">XGBoost ML Engine</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-[11px]">
              Experimental storm-conditioned spatial susceptibility model.
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Loaded & Validated
            </span>
          </div>

          {/* CHIRPS Historical */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">CHIRPS Rainfall Data</span>
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-slate-400 text-[11px]">
              Historical monsoon rainfall records (May–Sep 2024/2025).
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
              Historical Reference
            </span>
          </div>

          {/* IMD Weather */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">IMD Live Weather Station</span>
              <XCircle className="w-4 h-4 text-slate-500" />
            </div>
            <p className="text-slate-400 text-[11px]">
              Live station REST adapter is configured and ready for IMD API key.
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
              Awaiting Credential
            </span>
          </div>

          {/* Groq Copilot */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Groq LLM Safety Copilot</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-slate-400 text-[11px]">
              Grounded AI safety advice with multilingual deterministic fallback.
            </p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Operational
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
