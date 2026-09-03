'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import type { RouteCompareResponse, SettlementFeature, FacilityFeature, RouteSegment } from '@/lib/types';
import { Route, Navigation, ShieldCheck, Clock, AlertTriangle, ArrowRight, CheckCircle2, RotateCcw, Locate } from 'lucide-react';

interface RoutePlannerProps {
  onRouteCalculated?: (routes: { fastest: RouteSegment; safer: RouteSegment } | null) => void;
}

export function RoutePlanner({ onRouteCalculated }: RoutePlannerProps) {
  const { t } = useTranslation();
  const [settlements, setSettlements] = useState<SettlementFeature[]>([]);
  const [facilities, setFacilities] = useState<FacilityFeature[]>([]);

  // Origin / Destination
  const [origin, setOrigin] = useState<{ latitude: number; longitude: number; label: string }>({
    latitude: 23.7271,
    longitude: 92.7176,
    label: 'Aizawl Center',
  });
  const [destination, setDestination] = useState<{ latitude: number; longitude: number; label: string }>({
    latitude: 23.7500,
    longitude: 92.7300,
    label: 'Civil Hospital / North Aizawl',
  });

  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteCompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getSettlements().then((res) => setSettlements(res.features || [])).catch(() => {});
    api.getFacilities().then((res) => setFacilities(res.features || [])).catch(() => {});
  }, []);

  const handleCompareRoutes = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.compareRoutes(
        { latitude: origin.latitude, longitude: origin.longitude },
        { latitude: destination.latitude, longitude: destination.longitude }
      );
      setRouteResult(result);
      if (onRouteCalculated) {
        onRouteCalculated({
          fastest: result.fastest_route,
          safer: result.safer_route,
        });
      }
    } catch (err: any) {
      console.warn('Route calculation error:', err);
      setError(err.message || 'Could not find a valid route between these points in the road graph.');
      if (onRouteCalculated) onRouteCalculated(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocationForOrigin = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      setOrigin({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        label: 'My Current Location',
      });
    });
  };

  return (
    <div className="max-w-xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-6 text-slate-100 space-y-5">
      {/* Header */}
      <div className="pb-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center">
            <Route className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-base text-white">{t.routing.title}</h2>
            <p className="text-xs text-slate-400">{t.routing.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Input Controls */}
      <div className="space-y-3 text-xs">
        {/* Origin */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>{t.routing.origin}</span>
            </label>
            <button
              type="button"
              onClick={handleUseCurrentLocationForOrigin}
              className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center gap-1"
            >
              <Locate className="w-3 h-3" />
              <span>{t.routing.useCurrentLocation}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.001"
              value={origin.latitude}
              onChange={(e) => setOrigin({ ...origin, latitude: parseFloat(e.target.value) || 23.7271 })}
              placeholder="Origin Latitude"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
            />
            <input
              type="number"
              step="0.001"
              value={origin.longitude}
              onChange={(e) => setOrigin({ ...origin, longitude: parseFloat(e.target.value) || 92.7176 })}
              placeholder="Origin Longitude"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
            />
          </div>

          {settlements.length > 0 && (
            <select
              onChange={(e) => {
                const s = settlements.find((item) => (item.properties.village_id || item.id) === e.target.value);
                if (s) {
                  setOrigin({
                    latitude: s.geometry.coordinates[1],
                    longitude: s.geometry.coordinates[0],
                    label: s.properties.name,
                  });
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300"
            >
              <option value="">-- Or Select Origin Village / Settlement --</option>
              {settlements.map((s) => (
                <option key={s.properties.village_id || s.id} value={s.properties.village_id || s.id}>
                  {s.properties.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Destination */}
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <label className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>{t.routing.destination}</span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="0.001"
              value={destination.latitude}
              onChange={(e) => setDestination({ ...destination, latitude: parseFloat(e.target.value) || 23.75 })}
              placeholder="Dest Latitude"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
            />
            <input
              type="number"
              step="0.001"
              value={destination.longitude}
              onChange={(e) => setDestination({ ...destination, longitude: parseFloat(e.target.value) || 92.73 })}
              placeholder="Dest Longitude"
              className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-slate-200"
            />
          </div>

          {facilities.length > 0 && (
            <select
              onChange={(e) => {
                const f = facilities.find((item) => (item.properties.facility_id || item.id) === e.target.value);
                if (f) {
                  setDestination({
                    latitude: f.geometry.coordinates[1],
                    longitude: f.geometry.coordinates[0],
                    label: f.properties.name,
                  });
                }
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-[11px] text-slate-300"
            >
              <option value="">-- Or Select Hospital / Emergency Facility --</option>
              {facilities.map((f) => (
                <option key={f.properties.facility_id || f.id} value={f.properties.facility_id || f.id}>
                  🏥 {f.properties.name} ({f.properties.facility_type})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleCompareRoutes}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
        >
          {loading ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Analyzing Network Graph...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>{t.routing.compareButton}</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          {error}
        </div>
      )}

      {/* Comparison Results Card */}
      {routeResult && (
        <div className="space-y-4 pt-2 border-t border-slate-800 text-xs animate-in fade-in">
          {/* Summary Metric Badges */}
          <div className="grid grid-cols-2 gap-3">
            {/* Fastest Route Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-400 text-xs flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  {t.routing.fastest}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(routeResult.fastest_route.distance_m / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.eta}:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {routeResult.fastest_route.eta_minutes.toFixed(1)} mins
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.riskScore}:</span>
                  <span className="font-mono text-amber-400 font-bold">
                    {routeResult.fastest_route.mean_risk_score.toFixed(1)} / 100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.highRiskDistance}:</span>
                  <span className="font-mono text-rose-400">
                    {routeResult.fastest_route.high_risk_distance_m.toFixed(0)} m
                  </span>
                </div>
              </div>
            </div>

            {/* Safer Route Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-emerald-500/40 space-y-2 shadow-lg shadow-emerald-500/5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400 text-xs flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  {t.routing.safer}
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {(routeResult.safer_route.distance_m / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.eta}:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {routeResult.safer_route.eta_minutes.toFixed(1)} mins
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.riskScore}:</span>
                  <span className="font-mono text-emerald-400 font-bold">
                    {routeResult.safer_route.mean_risk_score.toFixed(1)} / 100
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">{t.routing.highRiskDistance}:</span>
                  <span className="font-mono text-emerald-300">
                    {routeResult.safer_route.high_risk_distance_m.toFixed(0)} m
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Risk Reduction & Tradeoff Banner */}
          {routeResult.comparison.is_safer_alternative_available ? (
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 text-emerald-200 text-xs space-y-1">
              <div className="font-bold text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>{routeResult.comparison.risk_reduction_percent.toFixed(1)}% Risk Exposure Reduction</span>
              </div>
              <p className="text-[11px] text-slate-300">
                {routeResult.comparison.advisory || `Safer path avoids high hazard segments with only +${routeResult.comparison.extra_travel_time_minutes.toFixed(1)} mins travel time.`}
              </p>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-sky-400 flex-shrink-0" />
              <span>{t.routing.noSaferAlternative}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
