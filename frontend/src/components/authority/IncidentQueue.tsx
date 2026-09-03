'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { IncidentItem } from '@/lib/types';
import { Layers, ShieldCheck, MapPin, AlertTriangle, Calendar } from 'lucide-react';

interface IncidentQueueProps {
  authorityKey: string;
}

export function IncidentQueue({ authorityKey }: IncidentQueueProps) {
  const [incidents, setIncidents] = useState<IncidentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getIncidents(authorityKey, 50)
      .then((res) => setIncidents(res.items || []))
      .catch((err) => console.warn('Get incidents error:', err))
      .finally(() => setLoading(false));
  }, [authorityKey]);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-sm text-white">Verified Incident Clusters</h4>
          <p className="text-slate-400 text-xs">
            Incidents automatically clustered from verified citizen and field reports.
          </p>
        </div>
        <span className="text-slate-400 font-mono">{incidents.length} active</span>
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Loading incidents...</div>
      ) : incidents.length === 0 ? (
        <div className="py-16 text-center text-slate-400">No verified incidents active.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {incidents.map((inc) => (
            <div key={inc.incident_id} className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2.5">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold text-xs text-sky-400 font-mono">
                    Incident #{inc.incident_id.slice(0, 8)}
                  </span>
                  <div className="text-slate-300 font-medium capitalize mt-0.5">
                    {inc.category.replace('_', ' ')}
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  inc.severity === 'critical' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                  inc.severity === 'high' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                  'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {inc.severity} Severity
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                <div>
                  <span className="text-slate-500 block text-[10px]">Reports Clustered</span>
                  <span className="font-mono font-bold text-slate-200">{inc.report_count} Reports</span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Centroid Location</span>
                  <span className="font-mono text-slate-200">
                    {inc.centroid.latitude.toFixed(3)}°N, {inc.centroid.longitude.toFixed(3)}°E
                  </span>
                </div>
              </div>

              {inc.affected_road_ids && inc.affected_road_ids.length > 0 && (
                <div className="text-[10px] text-slate-400 pt-1">
                  <span className="font-semibold text-slate-300">Affected Roads: </span>
                  <span>{inc.affected_road_ids.join(', ')}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
