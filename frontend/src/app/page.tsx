'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { BhuRakshakMap } from '@/components/map/BhuRakshakMap';
import { RiskPointModal } from '@/components/risk/RiskPointModal';
import { SafetyCopilotModal } from '@/components/ai/SafetyCopilotModal';
import { WeatherDrawer } from '@/components/weather/WeatherDrawer';
import { api } from '@/lib/api';
import type { RiskPointResponse } from '@/lib/types';
import { cacheRiskPoint, getCachedRiskPoint } from '@/lib/offline/db';

export default function HomePage() {
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [riskData, setRiskData] = useState<RiskPointResponse | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);

  // Modals / Drawers
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);
  const [copilotCoords, setCopilotCoords] = useState<{ latitude: number; longitude: number } | null>(null);

  // Handle map click
  const handleMapClick = async (coords: { latitude: number; longitude: number }) => {
    setSelectedCoords(coords);
    setLoadingRisk(true);

    try {
      if (!navigator.onLine) {
        const cached = await getCachedRiskPoint(coords.latitude, coords.longitude);
        if (cached) {
          setRiskData(cached);
          setLoadingRisk(false);
          return;
        }
      }

      const res = await api.getRiskPoint(coords.latitude, coords.longitude);
      setRiskData(res);
      await cacheRiskPoint(coords.latitude, coords.longitude, res);
    } catch (err) {
      console.warn('Point risk assessment error:', err);
    } finally {
      setLoadingRisk(false);
    }
  };

  const handleOpenCopilotForCoords = (coords: { latitude: number; longitude: number }) => {
    setCopilotCoords(coords);
    setIsCopilotOpen(true);
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden flex flex-col bg-slate-950">
      {/* Top Header */}
      <Header
        onOpenWeather={() => setIsWeatherOpen(true)}
        onOpenCopilot={() => {
          setCopilotCoords(selectedCoords || { latitude: 23.7271, longitude: 92.7176 });
          setIsCopilotOpen(true);
        }}
      />

      {/* Main Interactive Map View */}
      <div className="relative flex-1 w-full h-full overflow-hidden">
        <BhuRakshakMap
          selectedCoordinates={selectedCoords}
          onSelectCoordinates={handleMapClick}
        />

        {/* Click Risk Inspection Panel */}
        <RiskPointModal
          data={riskData}
          loading={loadingRisk}
          onClose={() => {
            setSelectedCoords(null);
            setRiskData(null);
          }}
          onOpenCopilot={handleOpenCopilotForCoords}
        />
      </div>

      {/* Weather Drawer */}
      <WeatherDrawer
        isOpen={isWeatherOpen}
        onClose={() => setIsWeatherOpen(false)}
        coordinates={selectedCoords}
      />

      {/* AI Safety Copilot Modal */}
      <SafetyCopilotModal
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        coordinates={copilotCoords}
      />

      {/* Bottom Mobile Navigation */}
      <MobileNav
        onOpenCopilot={() => {
          setCopilotCoords(selectedCoords || { latitude: 23.7271, longitude: 92.7176 });
          setIsCopilotOpen(true);
        }}
      />
    </main>
  );
}
