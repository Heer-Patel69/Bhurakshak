'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { AlertTriangle, Radio, Zap } from 'lucide-react';
import {
  createTelemetryStream, isHazardLevel, HAZARD_RAINFALL_MM, HAZARD_SOIL_MOISTURE,
  type TelemetryPoint,
} from '@/lib/mockTelemetry';

const MAX_POINTS = 30;

export function LiveTelemetryChart() {
  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [alertActive, setAlertActive] = useState(false);
  const streamRef = useRef<ReturnType<typeof createTelemetryStream> | null>(null);

  useEffect(() => {
    const stream = createTelemetryStream((point) => {
      setData((prev) => [...prev.slice(-(MAX_POINTS - 1)), point]);
      setAlertActive(isHazardLevel(point));
    });
    streamRef.current = stream;
    return () => stream.stop();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h4 className="font-bold text-sm text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-sky-400" />
            Live Sensor Telemetry — IoT Rain & Soil Moisture Nodes
          </h4>
          <p className="text-slate-400 text-xs mt-0.5">
            Simulated live feed for demo purposes. Wire to real IoT/CHIRPS stream post-hackathon.
          </p>
        </div>
        <button
          onClick={() => streamRef.current?.triggerStorm()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-bold hover:bg-amber-500/20 transition-colors"
        >
          <Zap className="w-3.5 h-3.5" />
          Simulate Storm Event
        </button>
      </div>

      {alertActive && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-bold animate-pulse">
          <AlertTriangle className="w-4 h-4" />
          HAZARD THRESHOLD BREACHED — Rainfall/Soil Moisture Elevated
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Rainfall (mm/hr)</span>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <ReferenceLine y={HAZARD_RAINFALL_MM} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Hazard', fontSize: 9, fill: '#f43f5e' }} />
              <Line type="monotone" dataKey="rainfall_mm" stroke="#38bdf8" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">Soil Moisture (%)</span>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#64748b' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 9, fill: '#64748b' }} domain={[0, 100]} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', fontSize: 11 }} />
              <ReferenceLine y={HAZARD_SOIL_MOISTURE} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Hazard', fontSize: 9, fill: '#f43f5e' }} />
              <Line type="monotone" dataKey="soil_moisture" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}