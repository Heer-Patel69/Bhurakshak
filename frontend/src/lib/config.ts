export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_PUBLIC_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
export const SUPABASE_AUTH_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_PUBLIC_KEY);

export const AIZAWL_CONFIG = {
  center: [92.7176, 23.7271] as [number, number], // [lng, lat]
  defaultZoom: 11.5,
  minZoom: 9,
  maxZoom: 18,
  bbox: '92.60,23.60,92.85,23.85',
  bounds: [
    [92.50, 23.50], // Southwest [lng, lat]
    [92.95, 23.95], // Northeast [lng, lat]
  ] as [[number, number], [number, number]],
  pilotName: 'Aizawl Pilot (Mizoram)',
};

export const RISK_COLORS = {
  low: '#10b981', // green-500
  medium: '#f59e0b', // amber-500
  high: '#f97316', // orange-500
  critical: '#ef4444', // red-500
};

export const RISK_BADGE_CLASSES = {
  low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  critical: 'bg-red-500/10 text-red-400 border-red-500/30',
};

export const CONTEXT_LABELS = {
  live_operational: {
    label: 'LIVE OPERATIONAL RISK',
    variant: 'success',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
  historical_reference_scenario: {
    label: 'HISTORICAL REFERENCE',
    variant: 'warning',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  },
  degraded_current: {
    label: 'CURRENT — LIMITED DATA',
    variant: 'danger',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  },
};
