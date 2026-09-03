'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n/context';
import { ChevronDown, ChevronUp, Info } from 'lucide-react';

export function MapLegend() {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="absolute bottom-6 left-4 z-20 max-w-xs bg-slate-900/90 border border-slate-800 rounded-xl shadow-2xl backdrop-blur-md p-3 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-200 text-[11px] uppercase tracking-wider">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span>Legend & Symbology</span>
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-slate-400 hover:text-white p-0.5 rounded"
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-2.5">
          {/* Risk Levels */}
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              {t.risk.level}
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
                <span className="text-slate-300 text-[11px]">{t.risk.low} (&lt;30)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50" />
                <span className="text-slate-300 text-[11px]">{t.risk.medium} (30-60)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50" />
                <span className="text-slate-300 text-[11px]">{t.risk.high} (60-80)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50" />
                <span className="text-slate-300 text-[11px]">{t.risk.critical} (80+)</span>
              </div>
            </div>
          </div>

          {/* Infrastructure & Hazards */}
          <div className="pt-1.5 border-t border-slate-800/60 space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-red-500 rounded" />
              <span className="text-slate-300 text-[11px]">Official Road Closure</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-1 bg-orange-400 rounded" />
              <span className="text-slate-300 text-[11px]">High-Risk Road Segment</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white/60" />
              <span className="text-slate-300 text-[11px]">GSI Historical Landslide</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-sky-500 border border-white/60" />
              <span className="text-slate-300 text-[11px]">Hospital / Emergency Facility</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
