'use client';

import React, { useState } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { RoutePlanner } from '@/components/routing/RoutePlanner';
import { BhuRakshakMap } from '@/components/map/BhuRakshakMap';
import { WeatherDrawer } from '@/components/weather/WeatherDrawer';
import { SafetyCopilotModal } from '@/components/ai/SafetyCopilotModal';
import type { RouteSegment } from '@/lib/types';

export default function RoutePage() {
  const [fastestRoute, setFastestRoute] = useState<RouteSegment | null>(null);
  const [saferRoute, setSaferRoute] = useState<RouteSegment | null>(null);
  const [points, setPoints] = useState<{
    origin: { latitude: number; longitude: number; label: string } | null;
    destination: { latitude: number; longitude: number; label: string } | null;
  }>({ origin: null, destination: null });
  const [pickedCoords, setPickedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);

  const handleRoutesCalculated = (routes: { fastest: RouteSegment; safer: RouteSegment } | null) => {
    if (routes) {
      setFastestRoute(routes.fastest);
      setSaferRoute(routes.safer);
    } else {
      setFastestRoute(null);
      setSaferRoute(null);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col pb-20 lg:pb-8 text-slate-100">
      <Header
        onOpenWeather={() => setIsWeatherOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form / Planner */}
        <div className="lg:col-span-5 order-2 lg:order-1">
          <RoutePlanner
            onRouteCalculated={handleRoutesCalculated}
            onPointsSelected={setPoints}
            pickedCoordinates={pickedCoords}
          />
        </div>

        {/* Right Map Preview */}
        <div className="lg:col-span-7 order-1 lg:order-2 h-[450px] lg:h-auto min-h-[400px] rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
          <BhuRakshakMap
            fastestRoute={fastestRoute}
            saferRoute={saferRoute}
            originCoordinates={points.origin}
            destinationCoordinates={points.destination}
            onSelectCoordinates={(c) => setPickedCoords(c)}
          />
        </div>
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
