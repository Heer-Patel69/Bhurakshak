'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { AlertCard } from '@/components/alerts/AlertCard';
import { WeatherDrawer } from '@/components/weather/WeatherDrawer';
import { SafetyCopilotModal } from '@/components/ai/SafetyCopilotModal';
import { api } from '@/lib/api';
import type { AlertItem } from '@/lib/types';
import { Bell, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { useTranslation } from '@/lib/i18n/context';

export default function AlertsPage() {
  const { t } = useTranslation();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const res = await api.getAlerts(50);
      setAlerts(res.items || []);
    } catch (err) {
      console.warn('Load alerts error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col pb-20 lg:pb-8 text-slate-100">
      <Header
        onOpenWeather={() => setIsWeatherOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{t.alerts.title}</h1>
              <p className="text-xs text-slate-400">
                Official emergency broadcasts and AI risk advisories for Aizawl District.
              </p>
            </div>
          </div>
          <button
            onClick={loadAlerts}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Alerts Feed */}
        {loading ? (
          <div className="py-24 text-center text-xs text-slate-400">
            Checking active emergency alerts...
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-200">{t.alerts.noAlerts}</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No critical landslide or extreme weather alerts have been broadcast by District Disaster Management Authorities.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((a) => (
              <AlertCard key={a.alert_id} alert={a} />
            ))}
          </div>
        )}
      </div>

      <WeatherDrawer
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
      />

      <SafetyCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
      />

      <MobileNav onOpenCopilot={() => setIsCopilotOpen(true)} />
    </main>
  );
}
