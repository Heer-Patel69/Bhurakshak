'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { AuthorityOverviewResponse } from '@/lib/types';
import { buildAlertDraft, type AlertLanguage, type AlertSeverity } from '@/lib/alertTemplates';
import { Siren, Send, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

interface EarlyWarningPanelProps {
  authorityKey: string;
  overview: AuthorityOverviewResponse | null;
}

const LANGUAGES: { code: AlertLanguage; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिंदी' },
  { code: 'lus', label: 'Mizo ṭawng' },
];

const SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];

export function EarlyWarningPanel({ authorityKey, overview }: EarlyWarningPanelProps) {
  const [language, setLanguage] = useState<AlertLanguage>('en');
  const [severity, setSeverity] = useState<AlertSeverity>('high');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  const criticalZones = overview?.high_critical_risk_zones?.length ?? 0;
  const affectedRoads = overview?.affected_roads?.items?.length ?? 0;
  const isolatedVillages = overview?.potentially_isolated_villages?.items?.length ?? 0;

  useEffect(() => {
    const draft = buildAlertDraft(language, overview, severity);
    setTitle(draft.title);
    setMessage(draft.message);
  }, [language, severity, overview]);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const response = await api.createAlert(
        {
          severity,
          title,
          message,
          location: { latitude: 23.7271, longitude: 92.7176 },
          affected_area: {
            critical_zones: criticalZones,
            affected_roads: affectedRoads,
            isolated_villages: isolatedVillages,
          },
          recommended_action: 'Avoid non-essential travel in affected zones and follow official DDMA instructions.',
          source: 'ddma_command_center',
          delivery_channels: ['console'],
        },
        authorityKey
      );
      setResult({ ok: true, text: `Alert issued (ID: ${response.alert_id}).` });
    } catch (err: any) {
      setResult({ ok: false, text: err?.message || 'Failed to issue alert.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-slate-800 pb-3">
        <h4 className="font-bold text-sm text-white flex items-center gap-2">
          <Siren className="w-4 h-4 text-rose-400" />
          Early Warning Action Panel
        </h4>
        <p className="text-slate-400 text-xs mt-0.5">
          Auto-calculated from current risk assessment. Review and edit before issuing.
        </p>
      </div>

      {/* Auto-calculated affected area summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
          <div className="text-xl font-black font-mono text-rose-400">{criticalZones}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Critical Zones</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
          <div className="text-xl font-black font-mono text-amber-400">{affectedRoads}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Affected Roads</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-center">
          <div className="text-xl font-black font-mono text-sky-400">{isolatedVillages}</div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider mt-1">Villages At Risk</div>
        </div>
      </div>

      {/* Language selector */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Broadcast Language</span>
        <div className="flex gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setLanguage(lang.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                language === lang.code
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Severity selector */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Severity</span>
        <div className="flex gap-2">
          {SEVERITIES.map((level) => (
            <button
              key={level}
              onClick={() => setSeverity(level)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${
                severity === level
                  ? level === 'critical'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-amber-600 text-white border-amber-600'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      {/* Editable draft */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Alert Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500"
        />
      </div>
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Alert Message (editable)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 rounded-lg bg-slate-950/70 border border-slate-800 text-sm text-slate-100 focus:outline-none focus:border-sky-500 resize-none"
        />
      </div>

      <button
        onClick={handleSend}
        disabled={sending || !title || !message}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? 'Issuing Alert...' : 'Issue Early Warning'}
      </button>

      {result && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border ${
            result.ok
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
          }`}
        >
          {result.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {result.text}
        </div>
      )}
    </div>
  );
}