'use client';

import React, { useState } from 'react';
import { Header } from '@/components/navigation/Header';
import { MobileNav } from '@/components/navigation/MobileNav';
import { HazardReportForm } from '@/components/reporting/HazardReportForm';
import { WeatherDrawer } from '@/components/weather/WeatherDrawer';
import { SafetyCopilotModal } from '@/components/ai/SafetyCopilotModal';

export default function ReportPage() {
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [isWeatherOpen, setIsWeatherOpen] = useState(false);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col pb-20 lg:pb-8">
      <Header
        onOpenWeather={() => setIsWeatherOpen(true)}
        onOpenCopilot={() => setIsCopilotOpen(true)}
      />

      <div className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8">
        <HazardReportForm />
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
