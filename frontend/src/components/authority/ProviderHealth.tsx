'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CheckCircle2, XCircle } from 'lucide-react';

interface ProviderHealthProps {
  authorityKey: string;
}

export function ProviderHealth({ authorityKey: _authorityKey }: ProviderHealthProps) {
  const [providers, setProviders] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getProviders()
      .then((res) => setProviders(res))
      .catch((err) => console.warn('Provider health error:', err))
      .finally(() => setLoading(false));
  }, [_authorityKey]);

  const available = (status: unknown) => status === 'available' || status === 'operational';
  const StatusIcon = ({ status }: { status: unknown }) =>
    available(status) ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-slate-500" />;
  const StatusBadge = ({ status }: { status: unknown }) => (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${available(status) ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-slate-800 text-slate-400 border-slate-700'}`}>
      {String(status || 'unknown').replaceAll('_', ' ')}
    </span>
  );

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
              <StatusIcon status={providers?.terrain?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              {providers?.terrain?.source || 'Terrain provider status unavailable.'}
            </p>
            <StatusBadge status={providers?.terrain?.status} />
          </div>

          {/* GSI Landslides */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">GSI Landslide Inventory</span>
              <StatusIcon status={providers?.historical?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              Historical inventory and spatial susceptibility status from the backend.
            </p>
            <StatusBadge status={providers?.historical?.status} /> <span className="text-[10px] text-slate-400 ml-2">{providers?.historical?.inventory_size ?? 'unknown'} events</span>
          </div>

          {/* XGBoost Susceptibility */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">XGBoost ML Engine</span>
              <StatusIcon status={providers?.ml?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              {providers?.ml?.model_name || 'No model metadata returned.'}
            </p>
            <StatusBadge status={providers?.ml?.model_loaded ? 'available' : 'unavailable'} /> <span className="text-[10px] text-slate-400 ml-2">v{providers?.ml?.model_version || 'unknown'}</span>
          </div>

          {/* CHIRPS Historical */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">CHIRPS Rainfall Data</span>
              <StatusIcon status={providers?.weather?.chirps?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              {providers?.weather?.chirps?.message || 'Historical rainfall provider status unavailable.'}
            </p>
            <StatusBadge status={providers?.weather?.chirps?.status} />
          </div>

          {/* IMD Weather */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">IMD Live Weather Station</span>
              <StatusIcon status={providers?.weather?.imd?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              {providers?.weather?.imd?.message || 'IMD provider status unavailable.'}
            </p>
            <StatusBadge status={providers?.weather?.imd?.status} />
          </div>

          {/* Groq Copilot */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">Groq LLM Safety Copilot</span>
              <StatusIcon status={providers?.copilot?.status} />
            </div>
            <p className="text-slate-400 text-[11px]">
              {providers?.copilot?.role || 'Grounded explanation provider status unavailable.'}
            </p>
            <StatusBadge status={providers?.copilot?.status} />
          </div>
        </div>
      )}
    </div>
  );
}
