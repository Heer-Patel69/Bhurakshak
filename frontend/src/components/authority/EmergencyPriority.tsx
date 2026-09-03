'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import type { FacilityFeature, SettlementFeature } from '@/lib/types';
import { ShieldAlert, Hospital, Clock, MapPin, CheckCircle2 } from 'lucide-react';

export function EmergencyPriority() {
  const [facilities, setFacilities] = useState<FacilityFeature[]>([]);
  const [settlements, setSettlements] = useState<SettlementFeature[]>([]);
  const [selectedVillage, setSelectedVillage] = useState<string>('');
  const [accessibility, setAccessibility] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getFacilities().then((res) => setFacilities(res.features || [])).catch(() => {});
    api.getSettlements().then((res) => {
      setSettlements(res.features || []);
      if (res.features?.length > 0) {
        const firstId = res.features[0].properties.village_id || res.features[0].id;
        setSelectedVillage(String(firstId));
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedVillage) return;
    setLoading(true);
    api.getFacilityAccessibility({ village_id: selectedVillage })
      .then((res) => setAccessibility(res))
      .catch((err) => console.warn('Accessibility assessment error:', err))
      .finally(() => setLoading(false));
  }, [selectedVillage]);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-sm text-white">Emergency Facility Accessibility Queue</h4>
          <p className="text-slate-400 text-xs">
            Evaluates ETA and road reachability to all 29 medical and critical facilities in Aizawl.
          </p>
        </div>

        {settlements.length > 0 && (
          <select
            value={selectedVillage}
            onChange={(e) => setSelectedVillage(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs cursor-pointer"
          >
            {settlements.map((s) => (
              <option key={String(s.properties.village_id || s.id)} value={String(s.properties.village_id || s.id)}>
                Origin: {s.properties.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="py-16 text-center text-slate-400">Computing facility shortest paths...</div>
      ) : accessibility?.reachable_facilities ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {accessibility.reachable_facilities.map((f: any) => (
            <div key={f.facility_id} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-bold text-xs text-emerald-400">🏥 {f.name}</span>
                  <span className="text-[10px] text-slate-400 block capitalize">{f.facility_type}</span>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Reachable
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1 border-t border-slate-800/60">
                <div>
                  <span className="text-slate-500 text-[10px] block">Distance</span>
                  <span className="font-mono font-bold text-slate-200">
                    {(f.distance_m / 1000).toFixed(2)} km
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Estimated ETA</span>
                  <span className="font-mono font-bold text-sky-400">
                    {f.eta_minutes.toFixed(1)} mins
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
