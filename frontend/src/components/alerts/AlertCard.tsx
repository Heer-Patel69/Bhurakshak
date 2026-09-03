'use client';

import React from 'react';
import type { AlertItem } from '@/lib/types';
import { AlertTriangle, ShieldAlert, Info, Clock, MapPin, CheckCircle2 } from 'lucide-react';

interface AlertCardProps {
  alert: AlertItem;
}

export function AlertCard({ alert }: AlertCardProps) {
  const severityStyles = {
    critical: 'bg-rose-950/40 border-rose-600/60 text-rose-100',
    high: 'bg-orange-950/40 border-orange-500/50 text-orange-100',
    medium: 'bg-amber-950/40 border-amber-500/50 text-amber-100',
    low: 'bg-sky-950/40 border-sky-500/40 text-sky-100',
  };

  const badgeStyles = {
    critical: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    low: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
  };

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all space-y-3 ${severityStyles[alert.severity] || severityStyles.low}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {alert.severity === 'critical' || alert.severity === 'high' ? (
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-pulse" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          )}
          <h4 className="font-bold text-sm sm:text-base text-white">{alert.title}</h4>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${badgeStyles[alert.severity] || badgeStyles.low}`}>
          {alert.severity}
        </span>
      </div>

      <p className="text-xs text-slate-200 leading-relaxed font-medium">
        {alert.message}
      </p>

      {alert.recommended_action && (
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs space-y-1">
          <span className="font-bold text-amber-300 block text-[11px] uppercase tracking-wider">
            Recommended Action:
          </span>
          <p className="text-slate-300 text-[11px]">{alert.recommended_action}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/10 gap-2">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>Issued: {new Date(alert.created_at).toLocaleString()}</span>
        </div>
        <div>
          <span>Source: {alert.source || 'Bhu Rakshak Emergency Network'}</span>
        </div>
      </div>
    </div>
  );
}
