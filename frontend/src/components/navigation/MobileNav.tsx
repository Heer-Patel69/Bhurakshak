'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n/context';
import { Map, AlertTriangle, Route, Bell, LifeBuoy } from 'lucide-react';

interface MobileNavProps {
  onOpenCopilot?: () => void;
}

export function MobileNav(props: MobileNavProps) {
  void props.onOpenCopilot;
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-2 py-1.5 flex items-center justify-around">
      <Link
        href="/"
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
          pathname === '/' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Map className="w-5 h-5" />
        <span className="text-[10px]">{t.nav.map}</span>
      </Link>

      <Link
        href="/report"
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
          pathname === '/report' ? 'text-amber-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <div className="relative">
          <AlertTriangle className="w-5 h-5 text-amber-400" />
        </div>
        <span className="text-[10px]">{t.nav.report}</span>
      </Link>

      <Link
        href="/route"
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
          pathname === '/route' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Route className="w-5 h-5" />
        <span className="text-[10px]">{t.nav.route}</span>
      </Link>

      <Link
        href="/alerts"
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
          pathname === '/alerts' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <Bell className="w-5 h-5" />
        <span className="text-[10px]">{t.nav.alerts}</span>
      </Link>

      <Link
        href="/help"
        className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
          pathname === '/help' ? 'text-emerald-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        <LifeBuoy className="w-5 h-5" />
        <span className="text-[10px]">Help</span>
      </Link>
    </nav>
  );
}
