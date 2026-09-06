'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { CommandSummary } from '@/components/authority/CommandSummary';
import { ReportReviewQueue } from '@/components/authority/ReportReviewQueue';
import { IncidentQueue } from '@/components/authority/IncidentQueue';
import { RoadClosureManager } from '@/components/authority/RoadClosureManager';
import { IsolationPanel } from '@/components/authority/IsolationPanel';
import { EmergencyPriority } from '@/components/authority/EmergencyPriority';
import { ProviderHealth } from '@/components/authority/ProviderHealth';
import { AuthorityLoginModal } from '@/components/authority/AuthorityLoginModal';
import { api } from '@/lib/api';
import { clearAuthoritySession, getAuthoritySession } from '@/lib/supabaseAuth';
import type { AuthorityOverviewResponse } from '@/lib/types';
import { Radio, FileText, AlertTriangle, Road, Home, Hospital, Activity, Lock } from 'lucide-react';

export default function AuthorityPage() {
  const [authorityKey, setAuthorityKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'reports' | 'incidents' | 'roads' | 'isolation' | 'facilities' | 'telemetry'>('reports');
  const [overview, setOverview] = useState<AuthorityOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const loadOverview = async (key: string) => {
    setLoading(true);
    try {
      const data = await api.getAuthorityOverview(key);
      setOverview(data);
      setAuthorityKey(key);
      setIsAuthenticated(true);
    } catch (err) {
      console.warn('Authority login error:', err);
      alert('Authentication failed. Please sign in with an authority or admin Supabase account.');
      setIsAuthenticated(false);
      clearAuthoritySession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const saved = getAuthoritySession();
    if (saved) void loadOverview(saved);
  }, []);

  const handleLogin = (key: string) => {
    setAuthorityKey(key);
    loadOverview(key);
  };

  const handleLogout = () => {
    setAuthorityKey('');
    setIsAuthenticated(false);
    clearAuthoritySession();
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col pb-20 lg:pb-8 text-slate-100">
      <Header />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Top Title & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Radio className="w-5 h-5 text-indigo-400" />
              <span>DDMA Command & Verification Center</span>
            </h1>
            <p className="text-xs text-slate-400">
              Operational dashboard for District Disaster Management Authority, Aizawl.
            </p>
          </div>

          {isAuthenticated && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                ● Authorized Session
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
              >
                Logout
              </button>
            </div>
          )}
        </div>

        {!isAuthenticated ? (
          <div className="py-12">
            <AuthorityLoginModal onLogin={handleLogin} />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Top KPIs Summary Bar */}
            <CommandSummary overview={overview} loading={loading} />

            {/* Navigation Tabs */}
            <div className="flex overflow-x-auto gap-2 border-b border-slate-800 pb-2 text-xs font-bold scrollbar-none">
              <button
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'reports'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Citizen Reports ({overview?.pending_report_count ?? 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('incidents')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'incidents'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                <span>Verified Incidents ({overview?.verified_incidents?.length ?? 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('roads')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'roads'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Road className="w-4 h-4" />
                <span>Road Closures ({overview?.confirmed_closures?.length ?? 0})</span>
              </button>

              <button
                onClick={() => setActiveTab('isolation')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'isolation'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Home className="w-4 h-4" />
                <span>Village Isolation</span>
              </button>

              <button
                onClick={() => setActiveTab('facilities')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'facilities'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Hospital className="w-4 h-4" />
                <span>Emergency Priority</span>
              </button>

              <button
                onClick={() => setActiveTab('telemetry')}
                className={`px-4 py-2 rounded-xl flex items-center gap-2 whitespace-nowrap transition-all ${
                  activeTab === 'telemetry'
                    ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Provider Telemetry</span>
              </button>
            </div>

            {/* Active Tab Panel */}
            <div className="p-3 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden">
              {activeTab === 'reports' && (
                <ReportReviewQueue
                  authorityKey={authorityKey}
                  onActionComplete={() => loadOverview(authorityKey)}
                />
              )}
              {activeTab === 'incidents' && (
                <IncidentQueue authorityKey={authorityKey} />
              )}
              {activeTab === 'roads' && (
                <RoadClosureManager
                  authorityKey={authorityKey}
                  onStatusUpdated={() => loadOverview(authorityKey)}
                />
              )}
              {activeTab === 'isolation' && (
                <IsolationPanel />
              )}
              {activeTab === 'facilities' && (
                <EmergencyPriority />
              )}
              {activeTab === 'telemetry' && (
                <ProviderHealth authorityKey={authorityKey} />
              )}
            </div>
          </div>
        )}
      </div>

      <MobileNav />
    </main>
  );
}
