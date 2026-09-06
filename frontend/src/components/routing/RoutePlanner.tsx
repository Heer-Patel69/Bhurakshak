'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import type { RouteCompareResponse, RouteSegment, PlaceSearchItem } from '@/lib/types';
import {
  Route,
  Navigation,
  ShieldCheck,
  Clock,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Locate,
  MapPin,
  Search,
  Building2,
  MapPinned,
  Crosshair,
} from 'lucide-react';

interface RoutePoint {
  latitude: number;
  longitude: number;
  label: string;
}

interface GroundedRouteAssessment {
  location: string;
  riskContext: string;
  hazardousZones: string;
  historicalEvidence: string;
  weatherContext: string;
  roadExposure: string;
  nearestFacility: string;
  recommendedAction: string;
}

function distanceKm(a: RoutePoint, coordinates: [number, number]): number {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latDelta = toRadians(coordinates[1] - a.latitude);
  const lonDelta = toRadians(coordinates[0] - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(coordinates[1]);
  const value = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

interface RoutePlannerProps {
  onRouteCalculated?: (routes: { fastest: RouteSegment; safer: RouteSegment } | null) => void;
  onPointsSelected?: (points: {
    origin: RoutePoint | null;
    destination: RoutePoint | null;
  }) => void;
  pickedCoordinates?: { latitude: number; longitude: number } | null;
}

export function RoutePlanner({
  onRouteCalculated,
  onPointsSelected,
  pickedCoordinates,
}: RoutePlannerProps) {
  const { t } = useTranslation();

  // Origin / Destination states
  const [origin, setOrigin] = useState<RoutePoint>({
    latitude: 23.7319548,
    longitude: 92.7166098,
    label: 'Aizawl Civil Hospital',
  });
  const [destination, setDestination] = useState<RoutePoint>({
    latitude: 23.7357935,
    longitude: 92.6645375,
    label: 'Mizoram University',
  });

  // Autocomplete search states
  const [originQuery, setOriginQuery] = useState('Aizawl Civil Hospital');
  const [destQuery, setDestQuery] = useState('Mizoram University');
  const [originSuggestions, setOriginSuggestions] = useState<PlaceSearchItem[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<PlaceSearchItem[]>([]);
  const [loadingOriginSearch, setLoadingOriginSearch] = useState(false);
  const [loadingDestSearch, setLoadingDestSearch] = useState(false);
  const [showOriginDropdown, setShowOriginDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  // Pin picking mode
  const [pickingTarget, setPickingTarget] = useState<'origin' | 'destination' | null>(null);

  const [loading, setLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteCompareResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [groundedAssessment, setGroundedAssessment] = useState<GroundedRouteAssessment | null>(null);

  // Debounced search for Origin
  useEffect(() => {
    if (!originQuery || originQuery.length < 2) {
      setOriginSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingOriginSearch(true);
      try {
        const res = await api.searchPlaces(originQuery, 8);
        setOriginSuggestions(res.items || []);
      } catch {
        setOriginSuggestions([]);
      } finally {
        setLoadingOriginSearch(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [originQuery]);

  // Debounced search for Destination
  useEffect(() => {
    if (!destQuery || destQuery.length < 2) {
      setDestSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoadingDestSearch(true);
      try {
        const res = await api.searchPlaces(destQuery, 8);
        setDestSuggestions(res.items || []);
      } catch {
        setDestSuggestions([]);
      } finally {
        setLoadingDestSearch(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [destQuery]);

  // Notify parent of point changes
  useEffect(() => {
    if (onPointsSelected) {
      onPointsSelected({ origin, destination });
    }
  }, [origin, destination, onPointsSelected]);

  // Handle picked coordinates from map
  useEffect(() => {
    if (pickedCoordinates && pickingTarget) {
      const point: RoutePoint = {
        latitude: pickedCoordinates.latitude,
        longitude: pickedCoordinates.longitude,
        label: `Pinned (${pickedCoordinates.latitude.toFixed(4)}, ${pickedCoordinates.longitude.toFixed(4)})`,
      };
      if (pickingTarget === 'origin') {
        setOrigin(point);
        setOriginQuery(point.label);
      } else {
        setDestination(point);
        setDestQuery(point.label);
      }
      setPickingTarget(null);
    }
  }, [pickedCoordinates, pickingTarget]);

  const handleSelectOrigin = (item: PlaceSearchItem) => {
    setOrigin({
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.name,
    });
    setOriginQuery(item.name);
    setShowOriginDropdown(false);
  };

  const handleSelectDestination = (item: PlaceSearchItem) => {
    setDestination({
      latitude: item.latitude,
      longitude: item.longitude,
      label: item.name,
    });
    setDestQuery(item.name);
    setShowDestDropdown(false);
  };

  const handleCompareRoutes = async () => {
    if (!origin || !destination) {
      setError('Please select both Origin and Destination places.');
      return;
    }

    setLoading(true);
    setError(null);
    setGroundedAssessment(null);
    setRouteResult(null);
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
      const delta = 0.03;
      const bbox = `${destination.longitude - delta},${destination.latitude - delta},${destination.longitude + delta},${destination.latitude + delta}`;
      const [riskResult, roadResult, facilityResult] = await Promise.allSettled([
        api.getRiskPoint(destination.latitude, destination.longitude),
        api.getRoadExposure(bbox, 4),
        api.getFacilities(),
      ]);
      const risk = riskResult.status === 'fulfilled' ? riskResult.value : null;
      const roadExposure = roadResult.status === 'fulfilled' ? roadResult.value : null;
      const facilities = facilityResult.status === 'fulfilled' ? facilityResult.value.features || [] : [];
      const nearest = facilities
        .map((facility) => ({ facility, distance: distanceKm(destination, facility.geometry.coordinates) }))
        .sort((a, b) => a.distance - b.distance)[0];
      const historical = risk?.signals.historical || risk?.signals.historical_susceptibility;
      const rainfall = risk?.signals.rainfall;
      const reports = risk?.signals.citizen_reports;
      const exposed = roadExposure?.features || [];
      const highExposure = exposed.filter((feature: any) => Number(feature.properties?.risk_score || 0) >= 60);
      setGroundedAssessment({
        location: `${destination.label} (${destination.latitude.toFixed(5)}, ${destination.longitude.toFixed(5)})`,
        riskContext: risk
          ? `${risk.risk_level.toUpperCase()} risk (${risk.risk_score.toFixed(1)}/100), ${risk.confidence_level} confidence.`
          : 'Data unavailable for this area.',
        hazardousZones: risk?.drivers?.length
          ? risk.drivers.join('; ')
          : 'No supported hazardous-zone driver is available for this point.',
        historicalEvidence: historical
          ? `${historical.historical_events_within_2km} inventory events within 2 km; nearest recorded event ${Math.round(historical.nearest_historical_event_distance_m)} m away.`
          : 'Data unavailable for this area.',
        weatherContext: rainfall?.status && rainfall.status !== 'unavailable'
          ? `${rainfall.rainfall_24h_mm ?? 'Unavailable'} mm rainfall in 24 h. Source: ${rainfall.source || 'configured weather provider'} (${rainfall.live ? 'live' : 'reference'}).`
          : 'Data unavailable for this area.',
        roadExposure: exposed.length
          ? `${exposed.length} known road segments assessed in the nearby window; ${highExposure.length} have risk exposure at or above 60/100.`
          : 'Data unavailable for this area.',
        nearestFacility: nearest
          ? `${nearest.facility.properties.name} (${nearest.facility.properties.facility_type}), approximately ${nearest.distance.toFixed(1)} km straight-line distance. Road access is not confirmed.`
          : 'Data unavailable for this area.',
        recommendedAction: reports?.verified_reports_within_500m
          ? `There ${reports.verified_reports_within_500m === 1 ? 'is' : 'are'} ${reports.verified_reports_within_500m} verified report(s) within 500 m. Avoid travel until an authority confirms road access.`
          : 'Check official alerts and local authority instructions before travel. No route or safe corridor is inferred without a supported road path.',
      });
      setError('Detailed road routing is currently unavailable for this location.');
      if (onRouteCalculated) onRouteCalculated(null);
    } finally {
      setLoading(false);
    }
  };

  const handleUseCurrentLocationForOrigin = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: RoutePoint = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          label: 'My Current Location (GPS)',
        };
        setOrigin(p);
        setOriginQuery(p.label);
      },
      () => {
        alert('Could not retrieve device GPS location.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
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

      {/* Picking on map indicator */}
      {pickingTarget && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 animate-spin text-amber-400" />
            Click anywhere on the map to set {pickingTarget === 'origin' ? 'Origin' : 'Destination'}
          </span>
          <button
            type="button"
            onClick={() => setPickingTarget(null)}
            className="text-[11px] underline hover:text-white"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Autocomplete Input Controls */}
      <div className="space-y-4 text-xs">
        {/* FROM PLACE */}
        <div className="relative p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
              <span>FROM (Origin)</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUseCurrentLocationForOrigin}
                className="text-sky-400 hover:text-sky-300 text-[11px] flex items-center gap-1"
                title="Use Current Device Location"
              >
                <Locate className="w-3 h-3" />
                <span>My Location</span>
              </button>
              <button
                type="button"
                onClick={() => setPickingTarget('origin')}
                className={`text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                  pickingTarget === 'origin'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
                title="Pick location on map"
              >
                <MapPin className="w-3 h-3 text-sky-400" />
                <span>Pick on Map</span>
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={originQuery}
              onChange={(e) => {
                setOriginQuery(e.target.value);
                setShowOriginDropdown(true);
              }}
              onFocus={() => setShowOriginDropdown(true)}
              placeholder="Search place, hospital, village (e.g. Aizawl Civil Hospital)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {loadingOriginSearch && (
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Searching...</span>
            )}
          </div>

          {/* Origin Suggestions Dropdown */}
          {showOriginDropdown && originSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
              {originSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectOrigin(item)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center gap-2"
                >
                  <Building2 className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 text-xs">{item.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* TO DESTINATION */}
        <div className="relative p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span>TO (Destination)</span>
            </label>
            <button
              type="button"
              onClick={() => setPickingTarget('destination')}
              className={`text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                pickingTarget === 'destination'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
              title="Pick destination on map"
            >
              <MapPinned className="w-3 h-3 text-emerald-400" />
              <span>Pick on Map</span>
            </button>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setShowDestDropdown(true);
              }}
              onFocus={() => setShowDestDropdown(true)}
              placeholder="Search destination, university, clinic (e.g. Mizoram University)"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {loadingDestSearch && (
              <span className="absolute right-3 top-2.5 text-[10px] text-slate-400">Searching...</span>
            )}
          </div>

          {/* Destination Suggestions Dropdown */}
          {showDestDropdown && destSuggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-h-48 overflow-y-auto divide-y divide-slate-800">
              {destSuggestions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectDestination(item)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800/80 transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  <div className="truncate">
                    <div className="font-semibold text-slate-200 text-xs">{item.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.display_name}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Action Button */}
        <button
          onClick={handleCompareRoutes}
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
        >
          {loading ? (
            <>
              <RotateCcw className="w-4 h-4 animate-spin" />
              <span>Calculating Route Options...</span>
            </>
          ) : (
            <>
              <Navigation className="w-4 h-4" />
              <span>Find Safest & Fastest Routes</span>
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Text-Based Safety Assessment</div>
            <div className="text-[11px] text-amber-100/80 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {groundedAssessment && (
        <div className="space-y-2 rounded-xl border border-slate-700 bg-slate-950/80 p-4 text-[11px] text-slate-300">
          <AssessmentRow label="Location" value={groundedAssessment.location} />
          <AssessmentRow label="Available risk context" value={groundedAssessment.riskContext} />
          <AssessmentRow label="Known hazardous zones" value={groundedAssessment.hazardousZones} />
          <AssessmentRow label="Historical landslide evidence" value={groundedAssessment.historicalEvidence} />
          <AssessmentRow label="Weather context" value={groundedAssessment.weatherContext} />
          <AssessmentRow label="Known road exposure" value={groundedAssessment.roadExposure} />
          <AssessmentRow label="Nearest known emergency facility" value={groundedAssessment.nearestFacility} />
          <AssessmentRow label="Recommended action" value={groundedAssessment.recommendedAction} />
        </div>
      )}

      {/* Comparison Results Card */}
      {routeResult && (
        <div className="space-y-4 pt-2 border-t border-slate-800 text-xs animate-in fade-in">
          {/* Summary Metric Badges */}
          <div className="grid grid-cols-2 gap-3">
            {/* Fastest Route Card */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-sky-500/40 space-y-2">
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
                {routeResult.comparison.advisory ||
                  `Safer path avoids high hazard segments with +${routeResult.comparison.extra_travel_time_minutes.toFixed(1)} mins travel time.`}
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

function AssessmentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-800 pb-2 last:border-0 last:pb-0">
      <div className="font-bold text-sky-300">{label}</div>
      <div className="mt-0.5 leading-relaxed">{value}</div>
    </div>
  );
}
