'use client';

import React, { useState } from 'react';
import { ArrowRight, Lock, AlertCircle } from 'lucide-react';
import { signInAuthority } from '@/lib/supabaseAuth';
import { SUPABASE_AUTH_CONFIGURED } from '@/lib/config';

interface AuthorityLoginModalProps {
  onLogin: (tokenOrKey: string) => void;
}

export function AuthorityLoginModal({ onLogin }: AuthorityLoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSupabaseLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide your authority email and password.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = await signInAuthority(email.trim(), password);
      onLogin(token);
    } catch (err: any) {
      console.warn('Supabase Auth error:', err);
      setError(err.message || 'Supabase authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 space-y-5">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-white">Authority Dashboard Authentication</h3>
        <p className="text-xs text-slate-400">
          District Disaster Management Authority (DDMA), Aizawl. Secure access for verified hazard review and road closures.
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {SUPABASE_AUTH_CONFIGURED ? (
        <form onSubmit={handleSupabaseLogin} className="space-y-3 text-xs">
          <div>
            <label className="text-slate-300 font-semibold mb-1 block">Authority Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="official@aizawl.ddma.gov.in"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-slate-300 font-semibold mb-1 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
          >
            <span>{loading ? 'Authenticating...' : 'Sign In with Supabase'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      ) : (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
          Supabase Auth must be configured for authority access in this environment.
        </div>
      )}
    </div>
  );
}
