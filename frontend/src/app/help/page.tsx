'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { api } from '@/lib/api';
import type { FacilityFeature } from '@/lib/types';
import { Ambulance, Building2, Flame, Hospital, Locate, MapPin, Phone, Share2, Shield } from 'lucide-react';

const CONTACTS = [
  { label: 'Emergency number', number: process.env.NEXT_PUBLIC_EMERGENCY_NUMBER, icon: Phone },
  { label: 'Ambulance', number: process.env.NEXT_PUBLIC_AMBULANCE_NUMBER, icon: Ambulance },
  { label: 'Police', number: process.env.NEXT_PUBLIC_POLICE_NUMBER, icon: Shield },
  { label: 'Fire', number: process.env.NEXT_PUBLIC_FIRE_NUMBER, icon: Flame },
  { label: 'District control room', number: process.env.NEXT_PUBLIC_DISTRICT_CONTROL_ROOM_NUMBER, icon: Building2 },
];

type UserLocation = { latitude: number; longitude: number };

function distanceKm(location: UserLocation, facility: FacilityFeature) {
  const [longitude, latitude] = facility.geometry.coordinates;
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(latitude - location.latitude);
  const dLon = radians(longitude - location.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(location.latitude)) * Math.cos(radians(latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function HelpPage() {
  const [facilities, setFacilities] = useState<FacilityFeature[]>([]);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getFacilities().then((result) => setFacilities(result.features || [])).catch(() => setFacilities([]));
  }, []);

  const hospitals = useMemo(() => {
    const candidates = facilities.filter((item) => ['hospital', 'clinic', 'emergency'].includes(item.properties.facility_type));
    if (!location) return candidates.slice(0, 5).map((facility) => ({ facility, distance: null as number | null }));
    return candidates
      .map((facility) => ({ facility, distance: distanceKm(location, facility) }))
      .sort((a, b) => (a.distance || 0) - (b.distance || 0))
      .slice(0, 5);
  }, [facilities, location]);

  const locate = () => {
    if (!navigator.geolocation) {
      setMessage('Location is unavailable on this device.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setMessage('Location captured. Hospital distances are straight-line estimates, not confirmed routes.');
      },
      () => setMessage('Location permission was not granted.'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const shareLocation = async () => {
    if (!location) {
      locate();
      return;
    }
    const text = `My location: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    const canShare = typeof navigator.share === 'function';
    try {
      if (canShare) await navigator.share({ title: 'Emergency location', text });
      else await navigator.clipboard.writeText(text);
      setMessage(canShare ? 'Location shared.' : 'Location copied to clipboard.');
    } catch {
      setMessage('Location sharing was cancelled.');
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-20 text-slate-100 lg:pb-8">
      <Header />
      <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="border-b border-slate-800 pb-4">
          <h1 className="text-xl font-black text-white">Emergency Help</h1>
          <p className="mt-1 text-xs text-slate-400">Configured contacts and known emergency facilities. Unconfigured data is never guessed.</p>
        </div>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONTACTS.map(({ label, number, icon: Icon }) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex min-w-0 items-center gap-3"><Icon className="h-5 w-5 shrink-0 text-rose-400" /><div><div className="text-xs font-bold text-slate-200">{label}</div><div className="mt-0.5 text-sm text-slate-400">{number || 'Not configured'}</div></div></div>
              {number && <a href={`tel:${number}`} className="flex min-h-11 items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white"><Phone className="h-4 w-4" />Call</a>}
            </div>
          ))}
        </section>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button type="button" onClick={locate} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 text-xs font-bold text-white"><Locate className="h-4 w-4" />Use My Location</button>
          <button type="button" onClick={shareLocation} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-bold text-slate-200"><Share2 className="h-4 w-4" />Share Location</button>
        </div>
        {message && <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-xs text-sky-200">{message}</div>}

        <section className="space-y-3">
          <div><h2 className="flex items-center gap-2 text-sm font-bold text-white"><Hospital className="h-5 w-5 text-emerald-400" />Nearby known hospitals</h2><p className="mt-1 text-[11px] text-slate-500">Facility names and coordinates come from the configured Dhara Drishti GIS dataset.</p></div>
          {hospitals.length ? hospitals.map(({ facility, distance }) => {
            const [longitude, latitude] = facility.geometry.coordinates;
            return <div key={facility.properties.facility_id || facility.properties.name} className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-bold text-slate-200">{facility.properties.name}</div><div className="mt-1 text-[11px] text-slate-400">{facility.properties.facility_type}{distance === null ? '' : ` · ${distance.toFixed(1)} km straight-line`}</div></div><a href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 text-xs font-bold text-emerald-300"><MapPin className="h-4 w-4" />Navigate</a></div>;
          }) : <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-center text-xs text-slate-500">No configured hospital data is available.</div>}
        </section>
      </div>
      <MobileNav />
    </main>
  );
}
