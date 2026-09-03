'use client';

import React, { useState } from 'react';
import { api } from '@/lib/api';
import { Road, AlertTriangle, ShieldCheck, XCircle, RefreshCw } from 'lucide-react';

interface RoadClosureManagerProps {
  authorityKey: string;
  onStatusUpdated?: () => void;
}

export function RoadClosureManager({ authorityKey, onStatusUpdated }: RoadClosureManagerProps) {
  const [roadId, setRoadId] = useState('');
  const [closureStatus, setClosureStatus] = useState<'officially_closed' | 'restricted' | 'open'>('officially_closed');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleUpdateStatus = async () => {
    if (!roadId.trim()) {
      alert('Please enter a valid Road ID (e.g. way/123456).');
      return;
    }

    setIsUpdating(true);
    setMessage(null);

    try {
      await api.updateRoadStatus(
        roadId.trim(),
        {
          status: closureStatus,
          source: 'authority',
          verified: true,
        },
        authorityKey
      );

      setMessage(`Road ${roadId} status successfully set to '${closureStatus}'. Routing graph updated.`);
      setRoadId('');
      if (onStatusUpdated) onStatusUpdated();
    } catch (err: any) {
      setMessage('Failed to update road status: ' + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-xl p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-4 text-xs">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
        <Road className="w-5 h-5 text-sky-400" />
        <div>
          <h4 className="font-bold text-sm text-white">Manual Road Status & Closure Control</h4>
          <p className="text-[11px] text-slate-400">
            Directly open, restrict, or officially close road network segments in the routing engine.
          </p>
        </div>
      </div>

      {message && (
        <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-300 text-xs">
          {message}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-slate-300 font-semibold block mb-1">Road OSM Segment ID</label>
          <input
            type="text"
            value={roadId}
            onChange={(e) => setRoadId(e.target.value)}
            placeholder="e.g. way/123456 or road_nh54"
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
          />
        </div>

        <div>
          <label className="text-slate-300 font-semibold block mb-1">Target Operational Status</label>
          <select
            value={closureStatus}
            onChange={(e) => setClosureStatus(e.target.value as any)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
          >
            <option value="officially_closed">🔴 Officially Closed (Blocks all routing)</option>
            <option value="restricted">🟠 Restricted / Hazard Caution</option>
            <option value="open">🟢 Open / Fully Passable</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleUpdateStatus}
          disabled={isUpdating}
          className="w-full py-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all"
        >
          {isUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          <span>Broadcast Road Status Override</span>
        </button>
      </div>
    </div>
  );
}
