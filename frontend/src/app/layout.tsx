import type { Metadata, Viewport } from 'next';
import './globals.css';
import { LanguageProvider } from '@/lib/i18n/context';
import { OfflineRuntime } from '@/components/offline/OfflineRuntime';
import { DevDiagnosticsPanel } from '@/components/debug/DevDiagnosticsPanel';

export const metadata: Metadata = {
  title: 'Dhara Drishti — AI-Assisted Landslide Risk & Connectivity Intelligence',
  description:
    'Grounded geospatial landslide risk estimation, real OSM road exposure, emergency routing, and citizen hazard reporting for Aizawl Pilot, Mizoram.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Dhara Drishti',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#090d16',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-sky-500 selection:text-white">
        <LanguageProvider>
          <OfflineRuntime />
          {children}
          <DevDiagnosticsPanel />
        </LanguageProvider>
      </body>
    </html>
  );
}
