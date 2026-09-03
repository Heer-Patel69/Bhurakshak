'use client';

import React, { useState } from 'react';
import { Shield, Key, ArrowRight, Lock } from 'lucide-react';

interface AuthorityLoginModalProps {
  onLogin: (key: string) => void;
}

export function AuthorityLoginModal({ onLogin }: AuthorityLoginModalProps) {
  const [keyInput, setKeyInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyInput.trim()) {
      onLogin(keyInput.trim());
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl text-slate-100 text-center space-y-4">
      <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto">
        <Lock className="w-6 h-6" />
      </div>

      <div>
        <h3 className="text-base font-bold text-white">Authority Dashboard Authentication</h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter your District Disaster Management Authority (DDMA) security key to access verification and closure controls.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Key className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Authority Security Key (e.g. test-authority-key)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
            autoFocus
          />
        </div>

        <button
          type="submit"
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all"
        >
          <span>Access Command Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
