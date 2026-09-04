'use client';

import React from 'react';
import { Layers, CheckSquare, Square, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

export interface ActiveLayers {
  riskGrid: boolean;
  historicalLandslides: boolean;
  roads: boolean;
  roadExposure: boolean;
  settlements: boolean;
  facilities: boolean;
  reports: boolean;
  routes: boolean;
}

export type LayerLoadState = 'loading' | 'loaded' | 'empty' | 'error';

export interface LayerStatusInfo {
  state: LayerLoadState;
  count?: number | string;
  message?: string;
}

interface LayerControlProps {
  activeLayers: ActiveLayers;
  layerStatuses?: Partial<Record<keyof ActiveLayers, LayerStatusInfo>>;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function LayerControl({
  activeLayers,
  layerStatuses = {},
  onToggleLayer,
  isOpen,
  onToggleOpen,
}: LayerControlProps) {
  const { t } = useTranslation();

  const layerItems: Array<{ key: keyof ActiveLayers; label: string }> = [
    { key: 'riskGrid', label: t.layers.riskGrid || 'Risk Heatmap / Grid' },
    { key: 'historicalLandslides', label: t.layers.historicalLandslides || 'GSI Historical Landslides' },
    { key: 'roads', label: t.layers.roadNetwork || 'OSM Road Network' },
    { key: 'roadExposure', label: t.layers.roadExposure || 'Road Exposure & Risk' },
    { key: 'settlements', label: t.layers.settlements || 'Settlements & Villages' },
    { key: 'facilities', label: t.layers.facilities || 'Hospitals & Emergency' },
    { key: 'reports', label: t.layers.citizenReports || 'Citizen Reports' },
    { key: 'routes', label: t.layers.saferRoute || 'Safer Route Alternative' },
  ];

  return (
    <div className="absolute top-4 right-4 z-20">
      <button
        onClick={onToggleOpen}
        className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold transition-colors"
        title="Toggle Map Layers"
      >
        <Layers className="w-4 h-4 text-sky-400" />
        <span className="hidden sm:inline">{t.layers.title || 'Layers'}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl p-3 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              {t.layers.title || 'Map Layers'}
            </span>
            <button
              onClick={onToggleOpen}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          {layerItems.map((item) => {
            const status = layerStatuses[item.key];
            const isError = status?.state === 'error';
            const isLoading = status?.state === 'loading';
            const isChecked = activeLayers[item.key] && !isError;

            return (
              <button
                key={item.key}
                onClick={() => !isError && onToggleLayer(item.key)}
                disabled={isError}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-colors ${
                  isError
                    ? 'opacity-60 cursor-not-allowed bg-rose-500/5'
                    : 'hover:bg-slate-800/80'
                }`}
              >
                <div className="flex flex-col truncate pr-2">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className={`truncate font-medium ${isChecked ? 'text-slate-100' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                    {status?.count !== undefined && !isError && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({status.count})
                      </span>
                    )}
                  </div>
                  {isLoading && (
                    <span className="text-[10px] text-sky-400 flex items-center gap-1">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      Loading layer...
                    </span>
                  )}
                  {isError && (
                    <span className="text-[10px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-2.5 h-2.5" />
                      Layer unavailable
                    </span>
                  )}
                </div>

                <div className="flex-shrink-0">
                  {isChecked ? (
                    <CheckSquare className="w-4 h-4 text-sky-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
