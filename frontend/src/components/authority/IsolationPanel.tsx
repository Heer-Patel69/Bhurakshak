'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { VillageIsolationItem } from '@/lib/types';
import { Home, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from 'lucide-react';

export function IsolationPanel() {
  const [analysisMode, setAnalysisMode] = useState<'risk_scenario' | 'confirmed_closure'>('risk_scenario');
  const [villages, setVillages] = useState<VillageIsolationItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadIsolationData = async (mode: 'risk_scenario' | 'confirmed_closure') => {
    setLoading(true);
    try {
      const res = await api.getVillageIsolation(mode);
      setVillages(res.villages || []);
    } catch (err) {
      console.warn('Village isolation fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadIsolationData(analysisMode);
  }, [analysisMode]);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-sm text-white">Settlement & Village Isolation Analysis</h4>
          <p className="text-slate-400 text-xs">
            Evaluates road network connectivity to emergency medical facilities under hazard scenarios.
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
          <button
            onClick={() => setAnalysisMode('risk_scenario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              analysisMode === 'risk_scenario'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Risk Scenario
          </button>
          <button
            onClick={() => setAnalysisMode('confirmed_closure')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              analysisMode === 'confirmed_closure'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Confirmed Closures
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">
          Running graph connectivity analysis for 14 Aizawl pilot settlements...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {villages.map((v) => (
            <div
              key={v.village_id}
              className={`p-4 rounded-xl border space-y-2.5 transition-all ${
                v.isolation_status === 'confirmed_isolated'
                  ? 'bg-rose-950/30 border-rose-600/50 text-rose-100'
                  : v.isolation_status === 'potentially_isolated'
                  ? 'bg-amber-950/30 border-amber-500/40 text-amber-100'
                  : 'bg-slate-950/70 border-slate-800 text-slate-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-sm">{v.village_name}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    v.isolation_status === 'confirmed_isolated'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : v.isolation_status === 'potentially_isolated'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {v.isolation_status.replace('_', ' ')}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300 pt-1 border-t border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span>Hospital Reachable:</span>
                  <span className="font-semibold">
                    {v.hospital_reachable ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Yes
                      </span>
                    ) : (
                      <span className="text-rose-400 flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" /> No Access
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Major Road Link:</span>
                  <span className="font-semibold">
                    {v.major_road_reachable ? 'Available' : 'Restricted'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span>Alternative Paths:</span>
                  <span className="font-semibold">
                    {v.alternative_routes_available ? 'Yes' : 'Single Corridor'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
