'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Terminal, CheckCircle2, XCircle, AlertTriangle, RefreshCw, X, ChevronUp, ChevronDown } from 'lucide-react';

interface FailedRequest {
  endpoint: string;
  code: string;
  status: number;
  message: string;
  time: string;
}

export function DevDiagnosticsPanel() {
  const [providers, setProviders] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [failedRequests, setFailedRequests] = useState<FailedRequest[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await api.getProviders();
      setProviders(data);
    } catch (err) {
      console.warn('Dev Diagnostics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Listen to custom API error events
    const errorHandler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setFailedRequests((prev) => [
        {
          endpoint: detail.endpoint,
          code: detail.code,
          status: detail.status,
          message: detail.message,
          time: new Date().toLocaleTimeString(),
        },
        ...prev.slice(0, 9),
      ]);
    };

    window.addEventListener('bhurakshak:api-error', errorHandler);
    return () => window.removeEventListener('bhurakshak:api-error', errorHandler);
  }, []);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') return null;

  const getStatusIcon = (status: string | boolean | undefined) => {
    if (status === 'available' || status === 'operational' || status === 'configured' || status === true) {
      return <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />;
    }
    if (status === 'not_configured' || status === 'unavailable' || status === false) {
      return <XCircle className="w-3 h-3 text-slate-500 flex-shrink-0" />;
    }
    return <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />;
  };

  return (
    <div className="fixed bottom-3 right-3 z-50 max-w-sm w-full font-mono text-[11px] shadow-2xl">
      <div className="bg-slate-950/95 border border-slate-700 rounded-xl overflow-hidden backdrop-blur-md text-slate-200">
        {/* Header bar */}
        <div
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-850"
        >
          <div className="flex items-center gap-1.5 font-bold text-sky-400">
            <Terminal className="w-3.5 h-3.5" />
            <span>DEV DIAGNOSTICS</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300">
              LOCAL
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400">
            {failedRequests.length > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold">
                {failedRequests.length} ERR
              </span>
            )}
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </div>
        </div>

        {/* Collapsible Content */}
        {expanded && (
          <div className="p-3 space-y-3 max-h-96 overflow-y-auto">
            {/* System Status Grid */}
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Backend API:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers ? 'available' : 'unavailable')}
                  <span>{providers ? 'Online' : 'Offline'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Supabase DB:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.supabase?.database === 'configured')}
                  <span>{providers?.supabase?.database || 'sqlite'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">GIS Roads:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.gis?.roads?.status)}
                  <span className="truncate">{providers?.gis?.roads?.total_feature_count ?? 'unknown'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">XGBoost ML:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.ml?.model_loaded)}
                  <span>{providers?.ml?.model_loaded ? 'Loaded' : 'Offline'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Groq LLM:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.copilot?.status)}
                  <span>{providers?.copilot?.status === 'available' ? 'Active' : 'Unavail'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">IMD Weather:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.weather?.imd?.status)}
                  <span className="truncate">{providers?.weather?.imd?.status || 'Awaiting'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Soil Sensor:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.sensor_network?.status)}
                  <span>{providers?.sensor_network?.status || 'unknown'}</span>
                </span>
              </div>

              <div className="flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800">
                <span className="text-slate-400">Satellite:</span>
                <span className="flex items-center gap-1">
                  {getStatusIcon(providers?.satellite?.sentinel_1?.status)}
                  <span>{providers?.satellite?.sentinel_1?.status || 'unknown'}</span>
                </span>
              </div>
            </div>

            {/* Failed Endpoints Log */}
            <div>
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase mb-1">
                <span>Failed Requests ({failedRequests.length})</span>
                {failedRequests.length > 0 && (
                  <button
                    onClick={() => setFailedRequests([])}
                    className="text-slate-500 hover:text-white"
                  >
                    Clear
                  </button>
                )}
              </div>

              {failedRequests.length === 0 ? (
                <div className="text-[10px] text-slate-500 italic p-1.5 bg-slate-900/40 rounded">
                  No failed network requests logged.
                </div>
              ) : (
                <div className="space-y-1">
                  {failedRequests.map((req, i) => (
                    <div
                      key={i}
                      className="p-1.5 rounded bg-rose-950/30 border border-rose-900/40 text-[10px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-rose-300">
                        <span className="font-bold truncate">{req.endpoint}</span>
                        <span className="font-mono">{req.status || req.code}</span>
                      </div>
                      <div className="text-rose-200/70 truncate">{req.message}</div>
                      <div className="text-[9px] text-slate-500">{req.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="w-full py-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 flex items-center justify-center gap-1 text-[10px] font-bold transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Provider Status</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
