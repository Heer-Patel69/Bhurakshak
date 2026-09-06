'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AIZAWL_CONFIG, RISK_COLORS } from '@/lib/config';
import { api } from '@/lib/api';
import {
  pendingReportToFeature,
  reconcileVerifiedReports,
  REPORT_SUBMITTED_EVENT,
} from '@/lib/report-events';
import { LayerControl, type ActiveLayers, type LayerStatusInfo } from './LayerControl';
import { MapLegend } from './MapLegend';
import { Locate, Navigation } from 'lucide-react';
import type { RouteSegment } from '@/lib/types';

interface BhuRakshakMapProps {
  onSelectCoordinates?: (coords: { latitude: number; longitude: number }) => void;
  selectedCoordinates?: { latitude: number; longitude: number } | null;
  originCoordinates?: { latitude: number; longitude: number; label?: string } | null;
  destinationCoordinates?: { latitude: number; longitude: number; label?: string } | null;
  fastestRoute?: RouteSegment | null;
  saferRoute?: RouteSegment | null;
  highlightedRoadId?: string | null;
  interactive?: boolean;
}

export function BhuRakshakMap({
  onSelectCoordinates,
  selectedCoordinates,
  originCoordinates,
  destinationCoordinates,
  fastestRoute,
  saferRoute,
  interactive = true,
}: BhuRakshakMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destMarkerRef = useRef<maplibregl.Marker | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeLayers, setActiveLayers] = useState<ActiveLayers>({
    riskGrid: true,
    historicalLandslides: true,
    roads: true,
    roadExposure: true,
    settlements: true,
    facilities: true,
    reports: true,
    routes: true,
  });

  const [layerStatuses, setLayerStatuses] = useState<Partial<Record<keyof ActiveLayers, LayerStatusInfo>>>({
    riskGrid: { state: 'loading' },
    historicalLandslides: { state: 'loading' },
    roads: { state: 'loading' },
    roadExposure: { state: 'loading' },
    settlements: { state: 'loading' },
    facilities: { state: 'loading' },
    reports: { state: 'loading' },
    routes: { state: 'loaded' },
  });

  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const roadDebounceTimer = useRef<NodeJS.Timeout | null>(null);

  const refreshCitizenReports = useCallback(async () => {
    const map = mapRef.current;
    const source = map?.getSource('citizen-reports') as maplibregl.GeoJSONSource | undefined;
    if (!map || !source) return;
    try {
      const verified = await api.getMapReports();
      const verifiedFeatures = verified.features || [];
      const verifiedIds = verifiedFeatures
        .map((feature: any) => feature?.properties?.report_id)
        .filter(Boolean);
      const pendingFeatures = reconcileVerifiedReports(verifiedIds).map(pendingReportToFeature);
      source.setData({
        type: 'FeatureCollection',
        features: [...verifiedFeatures, ...pendingFeatures],
      } as any);
      setLayerStatuses((previous) => ({
        ...previous,
        reports: {
          state: 'loaded',
          count: `${verifiedFeatures.length + pendingFeatures.length} reports`,
        },
      }));
    } catch {
      // Retain the last good source; controlled polling will retry.
    }
  }, []);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
            paint: {
              'raster-brightness-min': 0.15,
              'raster-brightness-max': 0.85,
              'raster-contrast': 0.1,
              'raster-saturation': -0.2,
            },
          },
        ],
      },
      center: AIZAWL_CONFIG.center,
      zoom: AIZAWL_CONFIG.defaultZoom,
      minZoom: AIZAWL_CONFIG.minZoom,
      maxZoom: AIZAWL_CONFIG.maxZoom,
      attributionControl: { compact: true },
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');

    map.on('load', () => {
      mapRef.current = map;
      setMapLoaded(true);
      initializeDataSources(map);
    });

    // Debounced road reloading when map bounds change
    map.on('moveend', () => {
      if (!mapRef.current) return;
      if (roadDebounceTimer.current) clearTimeout(roadDebounceTimer.current);
      roadDebounceTimer.current = setTimeout(() => {
        loadRoadsForViewport(map);
      }, 400);
    });

    if (interactive) {
      map.on('click', (e) => {
        // Prevent click if clicking an existing popup or feature with its own click handler
        const features = map.queryRenderedFeatures(e.point, {
          layers: [
            'historical-unclustered',
            'historical-clusters',
            'settlements-layer',
            'facilities-layer',
            'citizen-reports-layer',
            'risk-grid-cells',
          ].filter((id) => map.getLayer(id)),
        });

        // If user clicked the risk grid or empty ground, select coordinates for point risk
        const { lng, lat } = e.lngLat;
        if (onSelectCoordinates) {
          onSelectCoordinates({ latitude: lat, longitude: lng });
        }
      });
    }

    return () => {
      if (roadDebounceTimer.current) clearTimeout(roadDebounceTimer.current);
      map.remove();
      mapRef.current = null;
    };
  }, [interactive, onSelectCoordinates]);

  useEffect(() => {
    if (!mapLoaded) return;
    const refresh = () => void refreshCitizenReports();
    window.addEventListener(REPORT_SUBMITTED_EVENT, refresh);
    const timer = window.setInterval(refresh, 15_000);
    return () => {
      window.removeEventListener(REPORT_SUBMITTED_EVENT, refresh);
      window.clearInterval(timer);
    };
  }, [mapLoaded, refreshCitizenReports]);

  // Initialize all analytical layers and GeoJSON sources
  const initializeDataSources = async (map: maplibregl.Map) => {
    // 1. Risk Grid Layer (Polygons/Cells)
    try {
      const gridData = await api.getRiskGrid(AIZAWL_CONFIG.bbox, 6);
      if (gridData && !map.getSource('risk-grid')) {
        map.addSource('risk-grid', {
          type: 'geojson',
          data: gridData as any,
        });

        // Polygon Fill Layer
        map.addLayer({
          id: 'risk-grid-cells',
          type: 'fill',
          source: 'risk-grid',
          paint: {
            'fill-color': [
              'match',
              ['get', 'risk_level'],
              'critical',
              RISK_COLORS.critical,
              'high',
              RISK_COLORS.high,
              'medium',
              RISK_COLORS.medium,
              RISK_COLORS.low,
            ],
            'fill-opacity': 0.45,
          },
        });

        // Polygon Outline Layer
        map.addLayer({
          id: 'risk-grid-cells-outline',
          type: 'line',
          source: 'risk-grid',
          paint: {
            'line-color': [
              'match',
              ['get', 'risk_level'],
              'critical',
              '#991b1b',
              'high',
              '#c2410c',
              'medium',
              '#d97706',
              '#047857',
            ],
            'line-width': 1,
            'line-opacity': 0.7,
          },
        });

        // Popup for Risk Grid Cells
        map.on('click', 'risk-grid-cells', (e) => {
          if (!e.features || !e.features[0]) return;
          const feat = e.features[0];
          const props = (feat.properties || {}) as any;
          const coords = e.lngLat;

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1.5 text-xs text-slate-100 min-w-[200px]">
                <div class="flex items-center justify-between border-b border-slate-700 pb-1">
                  <span class="font-bold uppercase tracking-wider text-[10px] text-slate-400">Risk Assessment Cell</span>
                  <span class="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase" style="background-color: ${
                    RISK_COLORS[props.risk_level as keyof typeof RISK_COLORS] || '#10b981'
                  }33; color: ${RISK_COLORS[props.risk_level as keyof typeof RISK_COLORS] || '#10b981'}">
                    ${props.risk_level || 'Low'}
                  </span>
                </div>
                <div class="grid grid-cols-2 gap-1 text-[11px]">
                  <div><span class="text-slate-400">Score:</span> <strong class="font-mono text-white">${Number(props.risk_score || 0).toFixed(1)}/100</strong></div>
                  <div><span class="text-slate-400">Confidence:</span> <strong class="font-mono text-white">${Number(props.confidence_score || 0).toFixed(0)}%</strong></div>
                </div>
                ${props.ml_susceptibility_score !== undefined && props.ml_susceptibility_score !== null ? `
                  <div class="text-[11px]"><span class="text-slate-400">ML Susceptibility:</span> <strong class="font-mono text-indigo-300">${(Number(props.ml_susceptibility_score) * 100).toFixed(1)}%</strong></div>
                ` : ''}
                <div>Elevation: ${props.elevation_m ?? 'Unavailable'} m · Slope: ${props.slope_deg ?? 'Unavailable'}°</div>
                <div>Rain 24h: ${props.rain24 ?? 'Unavailable'} · 72h: ${props.rain72 ?? 'Unavailable'} · 7d: ${props.rain7d ?? 'Unavailable'} mm</div>
                <div>Historical signal: ${props.historical_susceptibility_score ?? 'Unavailable'} · Nearby (&lt;1 km): ${props.nearby_historical_landslides ?? 'Unavailable'}</div>
                <div>Data year: ${props.data_year ?? 'Unavailable'} · ${props.scenario || ''}</div>
                <div class="text-[10px] text-slate-400"><span class="font-semibold">Context:</span> ${props.context || props.assessment_context || 'Historical Reference'}</div>
                <div class="text-[10px] text-slate-400 truncate"><span class="font-semibold">Sources:</span> ${props.data_sources || 'Terrain, Weather, Historical, ML'}</div>
                <div class="text-[9px] text-slate-500 mt-1">${props.generated_at ? new Date(props.generated_at).toLocaleString() : ''}</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          riskGrid: { state: 'loaded', count: `${gridData.features?.length || 0} cells` },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, riskGrid: { state: 'error', message: 'Failed to load grid' } }));
    }

    // 2. Historical Landslides Layer (572 GSI records)
    try {
      const historicalData = await api.getHistoricalLandslides();
      if (historicalData && !map.getSource('historical-landslides')) {
        map.addSource('historical-landslides', {
          type: 'geojson',
          data: historicalData as any,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 35,
        });

        // Cluster Circles
        map.addLayer({
          id: 'historical-clusters',
          type: 'circle',
          source: 'historical-landslides',
          filter: ['has', 'point_count'],
          paint: {
            'circle-color': '#be123c',
            'circle-radius': ['step', ['get', 'point_count'], 14, 10, 20, 50, 28],
            'circle-opacity': 0.85,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Cluster count text
        map.addLayer({
          id: 'historical-cluster-count',
          type: 'symbol',
          source: 'historical-landslides',
          filter: ['has', 'point_count'],
          layout: {
            'text-field': '{point_count_abbreviated}',
            'text-size': 11,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // Individual Unclustered Points
        map.addLayer({
          id: 'historical-unclustered',
          type: 'circle',
          source: 'historical-landslides',
          filter: ['!', ['has', 'point_count']],
          paint: {
            'circle-color': '#e11d48',
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        // Popups for historical events
        map.on('click', 'historical-unclustered', (e) => {
          if (!e.features || !e.features[0]) return;
          const feat = e.features[0];
          const props = (feat.properties || {}) as any;
          const coords = (feat.geometry as any).coordinates.slice();

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 text-xs text-slate-100">
                <div class="font-bold text-rose-400">Historical Landslide Event ${props.event_id || ''}</div>
                <div><span class="text-slate-400">Location:</span> ${props.location_name || props.district || 'Aizawl Region'}</div>
                <div><span class="text-slate-400">Recorded Date:</span> <strong>${props.date ? props.date : 'Date unrecorded'}</strong></div>
                ${props.historical_susceptibility_score !== undefined ? `<div><span class="text-slate-400">Kernel Density:</span> ${(Number(props.historical_susceptibility_score) * 100).toFixed(1)}%</div>` : ''}
                <div class="text-slate-400 text-[10px] mt-1 pt-1 border-t border-slate-700">Source: Geological Survey of India (GSI)</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          historicalLandslides: {
            state: 'loaded',
            count: `${historicalData.features?.length || 0} events`,
          },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({
        ...prev,
        historicalLandslides: { state: 'error', message: 'Failed to load GSI inventory' },
      }));
    }

    // 3. Roads Layer
    loadRoadsForViewport(map);

    // 4. Road Exposure Layer
    try {
      const exposureData = await api.getRoadExposure(AIZAWL_CONFIG.bbox, 5);
      if (exposureData && !map.getSource('road-exposure')) {
        map.addSource('road-exposure', {
          type: 'geojson',
          data: exposureData as any,
        });

        map.addLayer({
          id: 'road-exposure-layer',
          type: 'line',
          source: 'road-exposure',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': [
              'case',
              ['>=', ['get', 'risk_score'], 70],
              '#ef4444',
              ['>=', ['get', 'risk_score'], 50],
              '#f97316',
              '#f59e0b',
            ],
            'line-width': 2.8,
            'line-opacity': 0.85,
          },
        });

        map.on('click', 'road-exposure-layer', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = (e.features[0].properties || {}) as any;
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="space-y-1 text-xs text-slate-100">
                <div class="font-bold text-amber-400">Road Exposure Assessment</div>
                <div><span class="text-slate-400">Road:</span> ${props.name || props.road_id || 'Segment'}</div>
                <div><span class="text-slate-400">Exposure Score:</span> <strong class="font-mono text-rose-400">${Number(props.risk_score || 0).toFixed(1)}/100</strong></div>
                <div><span class="text-slate-400">Length:</span> ${(Number(props.length_m || 0)).toFixed(0)} m</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          roadExposure: { state: 'loaded', count: `${exposureData.features?.length || 0} exposed` },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, roadExposure: { state: 'error', message: 'Exposure unavailable' } }));
    }

    // 5. Settlements Layer (with Isolation Analysis)
    try {
      const [settlementsData, isolationData] = await Promise.all([
        api.getSettlements().catch(() => null),
        api.getVillageIsolation().catch(() => null),
      ]);

      if (settlementsData && !map.getSource('settlements')) {
        // Enrich settlement features with isolation details
        const isolationMap = new Map<string, any>();
        if (isolationData?.villages) {
          for (const v of isolationData.villages) {
            isolationMap.set(String(v.village_id), v);
            if (v.village_name) isolationMap.set(v.village_name.toLowerCase(), v);
          }
        }

        const enrichedFeatures = (settlementsData.features || []).map((feat: any) => {
          const props = feat.properties || {};
          const iso =
            isolationMap.get(String(props.village_id || feat.id)) ||
            isolationMap.get(String(props.name || '').toLowerCase()) ||
            {};
          return {
            ...feat,
            properties: {
              ...props,
              isolation_status: iso.isolation_status || props.status || 'connected',
              hospital_reachable: iso.hospital_reachable ?? true,
              major_road_reachable: iso.major_road_reachable ?? true,
              alternative_routes: iso.alternative_routes_available ?? true,
            },
          };
        });

        map.addSource('settlements', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: enrichedFeatures } as any,
        });

        map.addLayer({
          id: 'settlements-layer',
          type: 'circle',
          source: 'settlements',
          paint: {
            'circle-color': [
              'match',
              ['get', 'isolation_status'],
              'confirmed_isolated',
              '#ef4444',
              'potentially_isolated',
              '#f97316',
              'at_risk',
              '#f59e0b',
              '#38bdf8', // connected
            ],
            'circle-radius': 6.5,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0f172a',
          },
        });

        map.addLayer({
          id: 'settlements-labels',
          type: 'symbol',
          source: 'settlements',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 11,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#f8fafc',
            'text-halo-color': '#090d16',
            'text-halo-width': 1.5,
          },
        });

        map.on('click', 'settlements-layer', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = (e.features[0].properties || {}) as any;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1.5 text-xs text-slate-100 min-w-[180px]">
                <div class="font-bold text-sky-400 text-sm border-b border-slate-700 pb-1">🏘️ ${props.name}</div>
                <div><span class="text-slate-400">Connectivity Status:</span> <strong class="capitalize ${
                  props.isolation_status === 'confirmed_isolated'
                    ? 'text-rose-400'
                    : props.isolation_status === 'potentially_isolated'
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }">${(props.isolation_status || 'Connected').replace('_', ' ')}</strong></div>
                <div><span class="text-slate-400">Main Road Access:</span> ${props.major_road_reachable ? '✅ Reachable' : '❌ Obstructed'}</div>
                <div><span class="text-slate-400">Hospital Access:</span> ${props.hospital_reachable ? '✅ Reachable' : '❌ Obstructed'}</div>
                <div><span class="text-slate-400">Alternative Route:</span> ${props.alternative_routes ? '✅ Available' : '⚠️ None'}</div>
                <div class="text-slate-500 text-[10px] mt-1">Source: Geofabrik OSM Aizawl</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          settlements: { state: 'loaded', count: `${enrichedFeatures.length} settlements` },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, settlements: { state: 'error', message: 'Settlements unavailable' } }));
    }

    // 6. Critical Facilities Layer (29 Facilities)
    try {
      const facilitiesData = await api.getFacilities();
      if (facilitiesData && !map.getSource('facilities')) {
        map.addSource('facilities', {
          type: 'geojson',
          data: facilitiesData as any,
        });

        map.addLayer({
          id: 'facilities-layer',
          type: 'circle',
          source: 'facilities',
          paint: {
            'circle-color': [
              'match',
              ['get', 'facility_type'],
              'hospital',
              '#10b981', // emerald
              'clinic',
              '#14b8a6', // teal
              'police',
              '#3b82f6', // blue
              'fire',
              '#ef4444', // red
              '#f59e0b', // emergency / amber
            ],
            'circle-radius': 6.5,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.addLayer({
          id: 'facilities-labels',
          type: 'symbol',
          source: 'facilities',
          minzoom: 12,
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.3],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#6ee7b7',
            'text-halo-color': '#064e3b',
            'text-halo-width': 1.5,
          },
        });

        map.on('click', 'facilities-layer', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = (e.features[0].properties || {}) as any;
          const coords = (e.features[0].geometry as any).coordinates.slice();

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 text-xs text-slate-100 min-w-[180px]">
                <div class="font-bold text-emerald-400 text-sm border-b border-slate-700 pb-1">🏥 ${props.name}</div>
                <div><span class="text-slate-400">Facility Type:</span> <strong class="capitalize text-slate-200">${props.facility_type || 'Medical'}</strong></div>
                <div><span class="text-slate-400">Accessibility:</span> <span class="text-slate-200">Assess in Route Planner</span></div>
                <div class="text-slate-500 text-[10px] mt-1">Source: OSM Aizawl Critical Infrastructure</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          facilities: { state: 'loaded', count: `${facilitiesData.features?.length || 0} facilities` },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, facilities: { state: 'error', message: 'Facilities unavailable' } }));
    }

    // 7. Citizen Reports Layer
    try {
      const reportsData = await api.getMapReports();
      if (reportsData && !map.getSource('citizen-reports')) {
        const verifiedFeatures = reportsData.features || [];
        const verifiedIds = verifiedFeatures
          .map((feature: any) => feature?.properties?.report_id)
          .filter(Boolean);
        const pendingFeatures = reconcileVerifiedReports(verifiedIds).map(pendingReportToFeature);
        map.addSource('citizen-reports', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [...verifiedFeatures, ...pendingFeatures],
          } as any,
        });

        map.addLayer({
          id: 'citizen-reports-layer',
          type: 'circle',
          source: 'citizen-reports',
          paint: {
            'circle-color': [
              'match',
              ['get', 'verification_status'],
              'verified',
              '#ef4444',
              '#f59e0b',
            ],
            'circle-radius': 7,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
          },
        });

        map.on('click', 'citizen-reports-layer', (e) => {
          if (!e.features || !e.features[0]) return;
          const props = (e.features[0].properties || {}) as any;
          const isVerified = props.verification_status === 'verified';
          new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
              <div class="space-y-1 text-xs text-slate-100">
                <div class="font-bold ${isVerified ? 'text-rose-400' : 'text-amber-400'}">⚠️ ${isVerified ? 'Verified Hazard Report' : 'Citizen Report — Unverified'}</div>
                <div><span class="text-slate-400">Status:</span> <strong>${isVerified ? 'Verified' : props.sync_status === 'pending' ? 'Pending Sync' : 'Pending Verification'}</strong></div>
                <div><span class="text-slate-400">Category:</span> <strong class="capitalize">${props.category || 'Landslide'}</strong></div>
                <div><span class="text-slate-400">Severity:</span> <span class="font-semibold uppercase text-rose-400">${props.severity || 'Medium'}</span></div>
                <div class="text-slate-500 text-[10px]">Captured: ${props.captured_at ? new Date(props.captured_at).toLocaleDateString() : ''}</div>
              </div>
            `)
            .addTo(map);
        });

        setLayerStatuses((prev) => ({
          ...prev,
          reports: { state: 'loaded', count: `${verifiedFeatures.length + pendingFeatures.length} reports` },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, reports: { state: 'error', message: 'Reports unavailable' } }));
    }

    // 8. Route Layers (Fastest and Safer)
    if (!map.getSource('route-fastest')) {
      map.addSource('route-fastest', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'route-fastest-layer',
        type: 'line',
        source: 'route-fastest',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#0284c7', // Sky blue
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });
    }

    if (!map.getSource('route-safer')) {
      map.addSource('route-safer', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'route-safer-layer',
        type: 'line',
        source: 'route-safer',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#10b981', // Emerald green
          'line-width': 6,
          'line-dasharray': [2, 1],
          'line-opacity': 0.95,
        },
      });
    }
  };

  // Load viewport-based roads dynamically without burying under raster tiles
  const loadRoadsForViewport = useCallback(async (map: maplibregl.Map) => {
    try {
      const bounds = map.getBounds();
      const bboxStr = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
      const roadsData = await api.getRoads(bboxStr, 0, 800);

      if (roadsData) {
        if (!map.getSource('roads')) {
          map.addSource('roads', {
            type: 'geojson',
            data: roadsData as any,
          });

          // NOTE: DO NOT pass 'osm-tiles-layer' as beforeId; roads must sit ON TOP of map raster tiles!
          map.addLayer({
            id: 'roads-base-layer',
            type: 'line',
            source: 'roads',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
              'line-color': [
                'case',
                ['==', ['get', 'closure_confirmed'], true],
                '#ef4444', // Red for confirmed closure
                ['==', ['get', 'status'], 'high_risk'],
                '#f97316', // Orange for high risk
                '#64748b', // Subtle slate for normal
              ],
              'line-width': [
                'case',
                ['==', ['get', 'closure_confirmed'], true],
                3.5,
                ['==', ['get', 'status'], 'high_risk'],
                2.5,
                1.3,
              ],
              'line-opacity': 0.8,
            },
          });

          map.on('click', 'roads-base-layer', (e) => {
            if (!e.features || !e.features[0]) return;
            const feat = e.features[0];
            const props = (feat.properties || {}) as any;

            new maplibregl.Popup()
              .setLngLat(e.lngLat)
              .setHTML(`
                <div class="space-y-1 text-xs text-slate-100">
                  <div class="font-bold text-slate-200">🛣️ ${props.name || 'Unnamed Road Segment'}</div>
                  <div><span class="text-slate-400">Status:</span> ${
                    props.closure_confirmed
                      ? '<strong class="text-rose-400">🔴 Confirmed Closed</strong>'
                      : props.status === 'high_risk'
                      ? '<strong class="text-orange-400">⚠️ High Risk Segment</strong>'
                      : '<strong class="text-slate-300">Open</strong>'
                  }</div>
                  <div><span class="text-slate-400">Type:</span> ${props.highway || 'local'}</div>
                  <div class="text-slate-500 text-[10px]">Source: Geofabrik OSM Aizawl</div>
                </div>
              `)
              .addTo(map);
          });
        } else {
          (map.getSource('roads') as maplibregl.GeoJSONSource).setData(roadsData as any);
        }

        setLayerStatuses((prev) => ({
          ...prev,
          roads: {
            state: 'loaded',
            count: `${roadsData.metadata?.matched_feature_count || roadsData.features?.length || 0} in view`,
          },
        }));
      }
    } catch {
      setLayerStatuses((prev) => ({ ...prev, roads: { state: 'error', message: 'Failed to load roads' } }));
    }
  }, []);

  // Update routes when props change & fit bounds
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;

    if (map.getSource('route-fastest')) {
      const data = fastestRoute?.route_geometry
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: fastestRoute.route_geometry,
          }
        : { type: 'FeatureCollection' as const, features: [] };
      (map.getSource('route-fastest') as maplibregl.GeoJSONSource).setData(data as any);
    }

    if (map.getSource('route-safer')) {
      const data = saferRoute?.route_geometry
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: saferRoute.route_geometry,
          }
        : { type: 'FeatureCollection' as const, features: [] };
      (map.getSource('route-safer') as maplibregl.GeoJSONSource).setData(data as any);
    }

    // Auto-fit route bounds
    const coords =
      fastestRoute?.route_geometry?.coordinates || saferRoute?.route_geometry?.coordinates;
    if (coords && coords.length > 1) {
      let minLng = coords[0][0];
      let maxLng = coords[0][0];
      let minLat = coords[0][1];
      let maxLat = coords[0][1];
      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 60, maxZoom: 15 }
      );
    }
  }, [fastestRoute, saferRoute, mapLoaded]);

  // Update origin & destination markers & fit bounds
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Origin Marker
    if (originCoordinates) {
      if (!originMarkerRef.current) {
        const el = document.createElement('div');
        el.className =
          'w-7 h-7 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-xs text-white font-bold animate-pulse';
        el.innerHTML = 'A';
        originMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([originCoordinates.longitude, originCoordinates.latitude])
          .addTo(map);
      } else {
        originMarkerRef.current.setLngLat([originCoordinates.longitude, originCoordinates.latitude]);
      }
    } else if (originMarkerRef.current) {
      originMarkerRef.current.remove();
      originMarkerRef.current = null;
    }

    // Destination Marker
    if (destinationCoordinates) {
      if (!destMarkerRef.current) {
        const el = document.createElement('div');
        el.className =
          'w-7 h-7 rounded-full bg-rose-500 border-2 border-white shadow-xl flex items-center justify-center text-xs text-white font-bold animate-pulse';
        el.innerHTML = 'B';
        destMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([destinationCoordinates.longitude, destinationCoordinates.latitude])
          .addTo(map);
      } else {
        destMarkerRef.current.setLngLat([
          destinationCoordinates.longitude,
          destinationCoordinates.latitude,
        ]);
      }
    } else if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }

    // Fit bounds if both origin and destination exist and no routes are rendered yet
    if (originCoordinates && destinationCoordinates && !fastestRoute) {
      const minLng = Math.min(originCoordinates.longitude, destinationCoordinates.longitude);
      const maxLng = Math.max(originCoordinates.longitude, destinationCoordinates.longitude);
      const minLat = Math.min(originCoordinates.latitude, destinationCoordinates.latitude);
      const maxLat = Math.max(originCoordinates.latitude, destinationCoordinates.latitude);
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 70, maxZoom: 15 }
      );
    }
  }, [originCoordinates, destinationCoordinates, fastestRoute]);

  // Update selected coordinates pin marker
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (selectedCoordinates) {
      if (!selectedMarkerRef.current) {
        const el = document.createElement('div');
        el.className =
          'w-7 h-7 rounded-full bg-rose-500 border-2 border-white shadow-xl animate-bounce flex items-center justify-center text-xs text-white font-bold';
        el.innerHTML = '📍';
        selectedMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedCoordinates.longitude, selectedCoordinates.latitude])
          .addTo(map);
      } else {
        selectedMarkerRef.current.setLngLat([
          selectedCoordinates.longitude,
          selectedCoordinates.latitude,
        ]);
      }
    } else if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }
  }, [selectedCoordinates]);

  // Handle Layer toggles
  const handleToggleLayer = (layerKey: keyof ActiveLayers) => {
    const updated = { ...activeLayers, [layerKey]: !activeLayers[layerKey] };
    setActiveLayers(updated);

    if (!mapRef.current) return;
    const map = mapRef.current;
    const isVisible = updated[layerKey] ? 'visible' : 'none';

    if (layerKey === 'riskGrid') {
      if (map.getLayer('risk-grid-cells')) map.setLayoutProperty('risk-grid-cells', 'visibility', isVisible);
      if (map.getLayer('risk-grid-cells-outline')) map.setLayoutProperty('risk-grid-cells-outline', 'visibility', isVisible);
    }
    if (layerKey === 'historicalLandslides') {
      if (map.getLayer('historical-clusters')) map.setLayoutProperty('historical-clusters', 'visibility', isVisible);
      if (map.getLayer('historical-cluster-count')) map.setLayoutProperty('historical-cluster-count', 'visibility', isVisible);
      if (map.getLayer('historical-unclustered')) map.setLayoutProperty('historical-unclustered', 'visibility', isVisible);
    }
    if (layerKey === 'roads' && map.getLayer('roads-base-layer')) {
      map.setLayoutProperty('roads-base-layer', 'visibility', isVisible);
    }
    if (layerKey === 'roadExposure' && map.getLayer('road-exposure-layer')) {
      map.setLayoutProperty('road-exposure-layer', 'visibility', isVisible);
    }
    if (layerKey === 'settlements') {
      if (map.getLayer('settlements-layer')) map.setLayoutProperty('settlements-layer', 'visibility', isVisible);
      if (map.getLayer('settlements-labels')) map.setLayoutProperty('settlements-labels', 'visibility', isVisible);
    }
    if (layerKey === 'facilities') {
      if (map.getLayer('facilities-layer')) map.setLayoutProperty('facilities-layer', 'visibility', isVisible);
      if (map.getLayer('facilities-labels')) map.setLayoutProperty('facilities-labels', 'visibility', isVisible);
    }
    if (layerKey === 'reports' && map.getLayer('citizen-reports-layer')) {
      map.setLayoutProperty('citizen-reports-layer', 'visibility', isVisible);
    }
    if (layerKey === 'routes') {
      if (map.getLayer('route-fastest-layer')) map.setLayoutProperty('route-fastest-layer', 'visibility', isVisible);
      if (map.getLayer('route-safer-layer')) map.setLayoutProperty('route-safer-layer', 'visibility', isVisible);
    }
  };

  // Locate Current User Geolocation
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        const { latitude, longitude } = pos.coords;

        if (mapRef.current) {
          mapRef.current.flyTo({ center: [longitude, latitude], zoom: 14 });

          if (!userMarkerRef.current) {
            const el = document.createElement('div');
            el.className =
              'w-4 h-4 rounded-full bg-sky-400 border-2 border-white shadow-lg ring-4 ring-sky-500/30 animate-pulse';
            userMarkerRef.current = new maplibregl.Marker({ element: el })
              .setLngLat([longitude, latitude])
              .addTo(mapRef.current);
          } else {
            userMarkerRef.current.setLngLat([longitude, latitude]);
          }
        }

        if (onSelectCoordinates) {
          onSelectCoordinates({ latitude, longitude });
        }
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        alert('Could not retrieve device GPS location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  // Reset to Aizawl Center
  const handleResetCenter = () => {
    if (mapRef.current) {
      mapRef.current.flyTo({ center: AIZAWL_CONFIG.center, zoom: AIZAWL_CONFIG.defaultZoom });
    }
  };

  return (
    <div className="relative w-full h-full min-h-[400px] overflow-hidden bg-slate-950">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Layer Control */}
      <LayerControl
        activeLayers={activeLayers}
        layerStatuses={layerStatuses}
        onToggleLayer={handleToggleLayer}
        isOpen={layerControlOpen}
        onToggleOpen={() => setLayerControlOpen(!layerControlOpen)}
      />

      {/* Floating Action Controls */}
      <div className="absolute top-4 left-16 z-20 flex flex-col gap-2">
        <button
          onClick={handleLocateUser}
          disabled={isLocating}
          className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-sky-400 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md transition-colors"
          title="Use My Current GPS Location"
        >
          <Locate className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
        </button>
        <button
          onClick={handleResetCenter}
          className="p-2.5 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-lg shadow-xl backdrop-blur-md transition-colors"
          title="Recenter Map on Aizawl Pilot"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </div>

      {/* Symbology & Legend */}
      <MapLegend />
    </div>
  );
}
