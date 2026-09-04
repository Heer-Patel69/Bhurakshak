'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation, LanguageCode } from '@/lib/i18n/context';
import { Shield, ShieldAlert, Map, AlertTriangle, Route, Bell, Radio, WifiOff, CloudRain, Sparkles, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import type { BootstrapResponse } from '@/lib/types';
import { subscribeSyncStatus, syncOfflineReports } from '@/lib/offline/sync';

interface HeaderProps {
  onOpenWeather?: () => void;
  onOpenCopilot?: () => void;
  onOpenTelemetry?: () => void;
}

export function Header({ onOpenWeather, onOpenCopilot, onOpenTelemetry }: HeaderProps) {
  const pathname = usePathname();
  const { t, language, setLanguage } = useTranslation();
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    api.getBootstrap()
      .then((data) => setBootstrap(data))
      .catch((err) => console.warn('Bootstrap fetch warning:', err));

    const unsubscribe = subscribeSyncStatus(({ pendingCount }) => {
      setPendingSyncCount(pendingCount);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const riskContext = bootstrap?.risk_context || 'historical_reference_scenario';
  const mapNavTitle =
    riskContext === 'live_operational'
      ? 'Live Risk Map'
      : riskContext === 'degraded_current'
      ? 'Current Risk — Limited Data'
      : 'Historical Risk Explorer';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/90 backdrop-blur-md">
      {/* Offline banner if disconnected */}
      {!isOnline && (
        <div className="bg-amber-900/80 border-b border-amber-700/60 px-4 py-1.5 text-center text-xs font-medium text-amber-200 flex items-center justify-center gap-2">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          <span>{t.offline.banner}</span>
        </div>
      )}

      {/* Pending sync banner if reports are waiting */}
      {pendingSyncCount > 0 && isOnline && (
        <div className="bg-sky-950 border-b border-sky-800/80 px-4 py-1 text-center text-xs text-sky-300 flex items-center justify-center gap-2">
          <span>{pendingSyncCount} {t.offline.pendingCount}</span>
          <button
            onClick={() => syncOfflineReports()}
            className="px-2 py-0.5 bg-sky-600 hover:bg-sky-500 text-white rounded font-medium text-[11px] transition-colors"
          >
            {t.offline.syncNow}
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Logo & Pilot Title */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg tracking-tight text-white">
                  Bhu Rakshak
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-400 font-bold border border-sky-500/30">
                  AIZAWL PILOT
                </span>
              </div>
              <p className="text-[10px] text-slate-400 -mt-0.5">
                Landslide Early Warning & Risk Intelligence
              </p>
            </div>
          </Link>
        </div>

        {/* Data Context Badge */}
        <div className="hidden md:flex items-center">
          {riskContext === 'live_operational' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>{t.context.live_operational}</span>
            </div>
          ) : riskContext === 'degraded_current' ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>{t.context.degraded_current}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30" title="Operational risk calculated using historical CHIRPS storm reference scenario">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>{t.context.historical_reference_scenario}</span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="hidden lg:flex items-center gap-1 text-sm font-medium">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              pathname === '/' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Map className="w-4 h-4" />
            {mapNavTitle}
          </Link>
          <Link
            href="/report"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              pathname === '/report' ? 'bg-amber-600/20 text-amber-300 border border-amber-500/30 font-semibold' : 'text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            {t.nav.report}
          </Link>
          <Link
            href="/route"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              pathname === '/route' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Route className="w-4 h-4" />
            {t.nav.route}
          </Link>
          <Link
            href="/alerts"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              pathname === '/alerts' ? 'bg-slate-800 text-sky-400 font-semibold' : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Bell className="w-4 h-4" />
            {t.nav.alerts}
          </Link>
          <Link
            href="/authority"
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              pathname === '/authority' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 font-semibold' : 'text-indigo-400 hover:bg-indigo-500/10'
            }`}
          >
            <Radio className="w-4 h-4" />
            {t.nav.authority}
          </Link>
        </nav>

        {/* Right Action Tools: Language, Weather, Copilot */}
        <div className="flex items-center gap-2">
          {/* Weather Button */}
          {onOpenWeather && (
            <button
              onClick={onOpenWeather}
              title="Weather Intelligence"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-sky-300 border border-slate-700 transition-colors"
            >
              <CloudRain className="w-4 h-4" />
            </button>
          )}

          {/* AI Copilot Button */}
          {onOpenCopilot && (
            <button
              onClick={onOpenCopilot}
              title="AI Safety Copilot"
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 shadow-md shadow-sky-600/20 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span className="hidden sm:inline">{t.copilot.title}</span>
            </button>
          )}

          {/* Language Selector */}
          <div className="relative inline-block">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2 py-1.5 font-medium focus:ring-1 focus:ring-sky-500 focus:outline-none cursor-pointer"
            >
              <option value="en">EN</option>
              <option value="hi">हिंदी (HI)</option>
              <option value="lus">Mizo (LUS)</option>
            </select>
          </div>
        </div>
      </div>
    </header>
  );
}
