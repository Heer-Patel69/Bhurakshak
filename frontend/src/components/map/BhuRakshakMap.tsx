'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { AIZAWL_CONFIG, RISK_COLORS } from '@/lib/config';
import { api } from '@/lib/api';
import { LayerControl, type ActiveLayers } from './LayerControl';
import { MapLegend } from './MapLegend';
import { Locate, Navigation } from 'lucide-react';
import type { RouteSegment } from '@/lib/types';

interface BhuRakshakMapProps {
  onSelectCoordinates?: (coords: { latitude: number; longitude: number }) => void;
  selectedCoordinates?: { latitude: number; longitude: number } | null;
  fastestRoute?: RouteSegment | null;
  saferRoute?: RouteSegment | null;
  highlightedRoadId?: string | null;
  interactive?: boolean;
}

export function BhuRakshakMap({
  onSelectCoordinates,
  selectedCoordinates,
  fastestRoute,
  saferRoute,
  interactive = true,
}: BhuRakshakMapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const selectedMarkerRef = useRef<maplibregl.Marker | null>(null);
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
  const [layerControlOpen, setLayerControlOpen] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

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

    if (interactive) {
      map.on('click', (e) => {
        const { lng, lat } = e.lngLat;
        if (onSelectCoordinates) {
          onSelectCoordinates({ latitude: lat, longitude: lng });
        }
      });
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [interactive, onSelectCoordinates]);

  // Initialize all analytical layers and GeoJSON sources
  const initializeDataSources = async (map: maplibregl.Map) => {
    try {
      // 1. Risk Grid Layer
      const gridData = await api.getRiskGrid(AIZAWL_CONFIG.bbox, 7).catch(() => null);
      if (gridData && !map.getSource('risk-grid')) {
        map.addSource('risk-grid', {
          type: 'geojson',
          data: gridData as any,
        });

        map.addLayer({
          id: 'risk-grid-points',
          type: 'circle',
          source: 'risk-grid',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 28, 17, 60],
            'circle-color': [
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
            'circle-opacity': 0.45,
            'circle-blur': 0.5,
          },
        });
      }

      // 2. Historical Landslides Layer (572 GSI records)
      const historicalData = await api.getHistoricalLandslides().catch(() => null);
      if (historicalData && !map.getSource('historical-landslides')) {
        map.addSource('historical-landslides', {
          type: 'geojson',
          data: historicalData as any,
          cluster: true,
          clusterMaxZoom: 13,
          clusterRadius: 40,
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
              <div class="space-y-1 text-xs">
                <div class="font-bold text-rose-400">Landslide Event ${props.event_id || ''}</div>
                <div class="text-slate-300"><strong>Location:</strong> ${props.location_name || 'Aizawl Region'}</div>
                <div class="text-slate-300"><strong>Recorded Date:</strong> ${props.date ? props.date : 'Date unavailable'}</div>
                <div class="text-slate-300"><strong>Type:</strong> ${props.landslide_type || 'Unknown'}</div>
                <div class="text-slate-400 text-[10px] mt-1">Source: ${props.source || 'GSI Historical Inventory'}</div>
              </div>
            `)
            .addTo(map);
        });
      }

      // 3. Roads & Exposure Layer
      loadRoadsForViewport(map);

      // 4. Settlements Layer
      const settlementsData = await api.getSettlements().catch(() => null);
      if (settlementsData && !map.getSource('settlements')) {
        map.addSource('settlements', {
          type: 'geojson',
          data: settlementsData as any,
        });

        map.addLayer({
          id: 'settlements-layer',
          type: 'circle',
          source: 'settlements',
          paint: {
            'circle-color': '#38bdf8',
            'circle-radius': 5,
            'circle-stroke-width': 1.5,
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
            'text-offset': [0, 1.2],
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
          const feat = e.features[0];
          const props = (feat.properties || {}) as any;
          const coords = (feat.geometry as any).coordinates.slice();

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 text-xs">
                <div class="font-bold text-sky-400">${props.name}</div>
                <div class="text-slate-300"><strong>Type:</strong> Settlement / Village</div>
                <div class="text-slate-300"><strong>Status:</strong> ${props.status || 'Connected'}</div>
                <div class="text-slate-400 text-[10px]">Source: Geofabrik OSM Aizawl</div>
              </div>
            `)
            .addTo(map);
        });
      }

      // 5. Critical Facilities Layer
      const facilitiesData = await api.getFacilities().catch(() => null);
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
            'circle-color': '#10b981',
            'circle-radius': 6,
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
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
          },
          paint: {
            'text-color': '#6ee7b7',
            'text-halo-color': '#064e3b',
            'text-halo-width': 1,
          },
        });

        map.on('click', 'facilities-layer', (e) => {
          if (!e.features || !e.features[0]) return;
          const feat = e.features[0];
          const props = (feat.properties || {}) as any;
          const coords = (feat.geometry as any).coordinates.slice();

          new maplibregl.Popup()
            .setLngLat(coords)
            .setHTML(`
              <div class="space-y-1 text-xs">
                <div class="font-bold text-emerald-400">🏥 ${props.name}</div>
                <div class="text-slate-300"><strong>Type:</strong> ${props.facility_type || 'Emergency Facility'}</div>
                <div class="text-slate-400 text-[10px]">Source: OSM Aizawl Critical Infrastructure</div>
              </div>
            `)
            .addTo(map);
        });
      }

      // 6. Routes Sources (Empty initial)
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
            'line-color': '#0284c7',
            'line-width': 5,
            'line-opacity': 0.85,
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
            'line-color': '#10b981',
            'line-width': 6,
            'line-dasharray': [2, 1],
            'line-opacity': 0.95,
          },
        });
      }
    } catch (err) {
      console.warn('Map data source initialization error:', err);
    }
  };

  // Load viewport-based roads dynamically
  const loadRoadsForViewport = useCallback(async (map: maplibregl.Map) => {
    try {
      const bounds = map.getBounds();
      const bboxStr = `${bounds.getWest().toFixed(4)},${bounds.getSouth().toFixed(4)},${bounds.getEast().toFixed(4)},${bounds.getNorth().toFixed(4)}`;
      const roadsData = await api.getRoads(bboxStr, 0, 800).catch(() => null);

      if (roadsData) {
        if (!map.getSource('roads')) {
          map.addSource('roads', {
            type: 'geojson',
            data: roadsData as any,
          });

          map.addLayer(
            {
              id: 'roads-base-layer',
              type: 'line',
              source: 'roads',
              layout: { 'line-join': 'round', 'line-cap': 'round' },
              paint: {
                'line-color': [
                  'case',
                  ['==', ['get', 'closure_confirmed'], true],
                  '#ef4444',
                  ['==', ['get', 'status'], 'high_risk'],
                  '#f97316',
                  '#64748b',
                ],
                'line-width': [
                  'case',
                  ['==', ['get', 'closure_confirmed'], true],
                  3.5,
                  ['==', ['get', 'status'], 'high_risk'],
                  2.5,
                  1.2,
                ],
                'line-opacity': 0.75,
              },
            },
            'osm-tiles-layer'
          );

          map.on('click', 'roads-base-layer', (e) => {
            if (!e.features || !e.features[0]) return;
            const feat = e.features[0];
            const props = (feat.properties || {}) as any;
            const coords = e.lngLat;

            new maplibregl.Popup()
              .setLngLat(coords)
              .setHTML(`
                <div class="space-y-1 text-xs">
                  <div class="font-bold text-slate-200">🛣️ ${props.name || 'Unnamed Road Segment'}</div>
                  <div class="text-slate-300"><strong>Status:</strong> ${props.closure_confirmed ? '🔴 Confirmed Closed' : (props.status || 'Open')}</div>
                  <div class="text-slate-300"><strong>Highway Type:</strong> ${props.highway || 'local'}</div>
                  <div class="text-slate-400 text-[10px]">Source: Geofabrik OSM Aizawl</div>
                </div>
              `)
              .addTo(map);
          });
        } else {
          (map.getSource('roads') as maplibregl.GeoJSONSource).setData(roadsData as any);
        }
      }
    } catch {
      // Ignore road viewport refresh errors
    }
  }, []);

  // Update routes when props change
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
  }, [fastestRoute, saferRoute, mapLoaded]);

  // Update selected coordinates pin marker
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    if (selectedCoordinates) {
      if (!selectedMarkerRef.current) {
        const el = document.createElement('div');
        el.className = 'w-6 h-6 rounded-full bg-rose-500 border-2 border-white shadow-xl animate-bounce flex items-center justify-center text-[10px] text-white font-bold';
        el.innerHTML = '📍';
        selectedMarkerRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedCoordinates.longitude, selectedCoordinates.latitude])
          .addTo(map);
      } else {
        selectedMarkerRef.current.setLngLat([selectedCoordinates.longitude, selectedCoordinates.latitude]);
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

    if (layerKey === 'riskGrid' && map.getLayer('risk-grid-points')) {
      map.setLayoutProperty('risk-grid-points', 'visibility', isVisible);
    }
    if (layerKey === 'historicalLandslides') {
      if (map.getLayer('historical-clusters')) map.setLayoutProperty('historical-clusters', 'visibility', isVisible);
      if (map.getLayer('historical-cluster-count')) map.setLayoutProperty('historical-cluster-count', 'visibility', isVisible);
      if (map.getLayer('historical-unclustered')) map.setLayoutProperty('historical-unclustered', 'visibility', isVisible);
    }
    if (layerKey === 'roads' && map.getLayer('roads-base-layer')) {
      map.setLayoutProperty('roads-base-layer', 'visibility', isVisible);
    }
    if (layerKey === 'settlements') {
      if (map.getLayer('settlements-layer')) map.setLayoutProperty('settlements-layer', 'visibility', isVisible);
      if (map.getLayer('settlements-labels')) map.setLayoutProperty('settlements-labels', 'visibility', isVisible);
    }
    if (layerKey === 'facilities') {
      if (map.getLayer('facilities-layer')) map.setLayoutProperty('facilities-layer', 'visibility', isVisible);
      if (map.getLayer('facilities-labels')) map.setLayoutProperty('facilities-labels', 'visibility', isVisible);
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
            el.className = 'w-4 h-4 rounded-full bg-sky-400 border-2 border-white shadow-lg ring-4 ring-sky-500/30 animate-pulse';
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
