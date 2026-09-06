'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation, type LanguageCode } from '@/lib/i18n/context';
import { api } from '@/lib/api';
import type { CopilotAdviceResponse } from '@/lib/types';
import { Sparkles, X, ShieldCheck, AlertOctagon, PhoneCall, HelpCircle, Send, BrainCircuit, RefreshCw } from 'lucide-react';

interface SafetyCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  coordinates?: { latitude: number; longitude: number } | null;
}

export function SafetyCopilotModal({
  isOpen,
  onClose,
  coordinates,
}: SafetyCopilotModalProps) {
  const { t, language } = useTranslation();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<CopilotAdviceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetCoords = coordinates || { latitude: 23.7271, longitude: 92.7176 };

  const fetchAdvice = async (customQuestion?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getCopilotAdvice({
        latitude: targetCoords.latitude,
        longitude: targetCoords.longitude,
        language: language as 'en' | 'hi' | 'lus',
        question: customQuestion || question || 'What should I do in this area right now?',
      });
      setAdvice(response);
    } catch (err: any) {
      console.warn('Copilot advice error:', err);
      setError('Unable to fetch advice. Please follow standard emergency guidelines.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAdvice();
    }
  }, [isOpen, language]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-slate-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>{t.copilot.title}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
                  Dhara Drishti Copilot
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                {t.copilot.subtitle} ({targetCoords.latitude.toFixed(3)}°N, {targetCoords.longitude.toFixed(3)}°E)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Question Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Is it safe to drive on the bypass road? What precautions should I take?"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              onKeyDown={(e) => e.key === 'Enter' && fetchAdvice(question)}
            />
            <button
              onClick={() => fetchAdvice(question)}
              disabled={loading}
              className="px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-1.5 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
              <BrainCircuit className="w-8 h-8 text-sky-400 animate-pulse" />
              <span>Consulting verified terrain, susceptibility & road status evidence...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              {error}
            </div>
          ) : advice ? (
            <div className="space-y-4">
              {/* Situation Summary */}
              <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80">
                <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block mb-1">
                  {t.copilot.summary}
                </span>
                <p className="text-slate-200 text-xs leading-relaxed font-medium">
                  {advice.summary}
                </p>
                <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-2">
                  <span>Source: {advice.recommendations_source === 'groq_grounded' ? 'Groq Grounded LLM' : 'Dhara Drishti Deterministic Safety Engine'}</span>
                  <span>•</span>
                  <span>{advice.confidence_note}</span>
                </div>
              </div>

              {/* Recommended Actions */}
              {advice.recommended_actions && advice.recommended_actions.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    {t.copilot.actions}
                  </span>
                  <div className="grid gap-1.5">
                    {advice.recommended_actions.map((act, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-emerald-950/20 border border-emerald-800/30 text-emerald-200 flex items-start gap-2">
                        <span className="font-bold text-emerald-400">{i + 1}.</span>
                        <span>{act}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Things to Avoid */}
              {advice.avoid && advice.avoid.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4" />
                    {t.copilot.avoid}
                  </span>
                  <div className="grid gap-1.5">
                    {advice.avoid.map((item, i) => (
                      <div key={i} className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-800/30 text-rose-200 flex items-start gap-2">
                        <span className="font-bold text-rose-400">✕</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Emergency Info */}
              {advice.emergency_information && advice.emergency_information.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5" />
                    {t.copilot.emergency}
                  </span>
                  <ul className="text-slate-300 space-y-1 text-[11px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                    {advice.emergency_information.map((info, i) => (
                      <li key={i}>• {info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Underlying Factors / Why */}
              {advice.why && advice.why.length > 0 && (
                <div className="space-y-1 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300 block">
                    {t.copilot.why}:
                  </span>
                  <ul className="space-y-0.5">
                    {advice.why.map((reason, i) => (
                      <li key={i}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Footer Disclaimer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/80 text-[10px] text-slate-400 flex items-center justify-between">
          <span>{t.copilot.disclaimer}</span>
          <button
            onClick={() => fetchAdvice()}
            className="text-sky-400 hover:text-sky-300 flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Refresh</span>
          </button>
        </div>
      </div>
    </div>
  );
}
