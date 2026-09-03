'use client';

import React from 'react';
import { Layers, CheckSquare, Square } from 'lucide-react';
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

interface LayerControlProps {
  activeLayers: ActiveLayers;
  onToggleLayer: (layer: keyof ActiveLayers) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export function LayerControl({
  activeLayers,
  onToggleLayer,
  isOpen,
  onToggleOpen,
}: LayerControlProps) {
  const { t } = useTranslation();

  const layerItems: Array<{ key: keyof ActiveLayers; label: string; count?: string }> = [
    { key: 'riskGrid', label: t.layers.riskGrid },
    { key: 'historicalLandslides', label: t.layers.historicalLandslides },
    { key: 'roads', label: t.layers.roadNetwork },
    { key: 'roadExposure', label: t.layers.roadExposure },
    { key: 'settlements', label: t.layers.settlements },
    { key: 'facilities', label: t.layers.facilities },
    { key: 'reports', label: t.layers.citizenReports },
    { key: 'routes', label: t.layers.saferRoute },
  ];

  return (
    <div className="absolute top-4 right-4 z-20">
      <button
        onClick={onToggleOpen}
        className="flex items-center gap-2 px-3 py-2 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg shadow-xl backdrop-blur-md text-xs font-semibold transition-colors"
        title="Toggle Map Layers"
      >
        <Layers className="w-4 h-4 text-sky-400" />
        <span className="hidden sm:inline">{t.layers.title}</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-slate-900/95 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-xl p-3 text-xs space-y-1.5 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-800">
            <span className="font-bold text-slate-200 uppercase tracking-wider text-[10px]">
              {t.layers.title}
            </span>
            <button
              onClick={onToggleOpen}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          {layerItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onToggleLayer(item.key)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-800/80 text-left transition-colors"
            >
              <span className={`truncate ${activeLayers[item.key] ? 'text-slate-200 font-medium' : 'text-slate-400'}`}>
                {item.label}
              </span>
              {activeLayers[item.key] ? (
                <CheckSquare className="w-4 h-4 text-sky-400 flex-shrink-0" />
              ) : (
                <Square className="w-4 h-4 text-slate-600 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
