'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { hi } from './hi';
import { lus } from './lus';

export type LanguageCode = 'en' | 'hi' | 'lus';

export interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: typeof en;
  languageName: string;
}

const translations: Record<LanguageCode, typeof en> = {
  en,
  hi,
  lus,
};

const languageNames: Record<LanguageCode, string> = {
  en: 'English',
  hi: 'हिंदी (Hindi)',
  lus: 'Mizo ṭawng',
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: en,
  languageName: 'English',
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en');

  useEffect(() => {
    const saved = localStorage.getItem('bhurakshak_lang') as LanguageCode;
    if (saved && (saved === 'en' || saved === 'hi' || saved === 'lus')) {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('bhurakshak_lang', lang);
    }
  };

  const value = {
    language,
    setLanguage,
    t: translations[language] || en,
    languageName: languageNames[language] || 'English',
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  return useContext(LanguageContext);
}
