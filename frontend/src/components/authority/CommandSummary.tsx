'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n/context';
import type { AuthorityOverviewResponse } from '@/lib/types';
import { ShieldAlert, AlertTriangle, Road, Home, FileText, CheckCircle2, Clock } from 'lucide-react';

interface CommandSummaryProps {
  overview: AuthorityOverviewResponse | null;
  loading: boolean;
}

export function CommandSummary({ overview, loading }: CommandSummaryProps) {
  const { t } = useTranslation();

  const criticalCount = overview?.high_critical_risk_zones?.length || 0;
  const closuresCount = overview?.confirmed_closures?.length || 0;
  const pendingCount = overview?.pending_report_count ?? 0;
  const incidentsCount = overview?.verified_incidents?.length || 0;
  const overallRiskScore = overview?.overall_risk?.maximum_recent_score;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* KPI 1: Max Recent Risk */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Peak Risk Score
        </span>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-black font-mono ${overallRiskScore && overallRiskScore >= 75 ? 'text-rose-400' : 'text-amber-400'}`}>
            {overallRiskScore ? overallRiskScore.toFixed(1) : '--'}
          </span>
          <span className="text-[10px] text-slate-500">/100</span>
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Aizawl Region</span>
      </div>

      {/* KPI 2: Critical Risk Zones */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          {t.authority.kpis.criticalZones}
        </span>
        <div className="text-xl font-black font-mono text-rose-400">
          {loading ? '...' : criticalCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Grid Cells &gt;60</span>
      </div>

      {/* KPI 3: Confirmed Road Closures */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          {t.authority.kpis.confirmedClosures}
        </span>
        <div className="text-xl font-black font-mono text-rose-400">
          {loading ? '...' : closuresCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Edges Disabled</span>
      </div>

      {/* KPI 4: Pending Citizen Reports */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          {t.authority.kpis.pendingReports}
        </span>
        <div className="text-xl font-black font-mono text-amber-400">
          {loading ? '...' : pendingCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Awaiting Review</span>
      </div>

      {/* KPI 5: Verified Incidents */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          {t.authority.kpis.verifiedIncidents}
        </span>
        <div className="text-xl font-black font-mono text-sky-400">
          {loading ? '...' : incidentsCount}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Clustered Events</span>
      </div>

      {/* KPI 6: Data Freshness Status */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          Weather State
        </span>
        <div className="text-sm font-bold text-slate-200 mt-1 truncate">
          {overview?.data_freshness?.weather === 'operational' ? 'Live IMD' : 'CHIRPS Scenario'}
        </div>
        <span className="text-[10px] text-slate-500 block truncate">Backend Engine</span>
      </div>
    </div>
  );
}
