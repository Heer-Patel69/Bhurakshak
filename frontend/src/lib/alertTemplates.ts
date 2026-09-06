import type { AuthorityOverviewResponse } from './types';

export type AlertLanguage = 'en' | 'hi' | 'lus';
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

interface AlertDraft {
  title: string;
  message: string;
}

function countOf(value: any[] | undefined | null): number {
  return Array.isArray(value) ? value.length : 0;
}

export function buildAlertDraft(
  language: AlertLanguage,
  overview: AuthorityOverviewResponse | null,
  severity: AlertSeverity
): AlertDraft {
  const criticalZones = countOf(overview?.high_critical_risk_zones);
  const affectedRoads = countOf(overview?.affected_roads?.items);
  const isolatedVillages = countOf(overview?.potentially_isolated_villages?.items);

  if (language === 'hi') {
    return {
      title: 'भूस्खलन चेतावनी — आइजोल जिला',
      message: `जिला आपदा प्रबंधन प्राधिकरण (आइजोल) की चेतावनी: वर्तमान में ${criticalZones} क्षेत्रों में अत्यधिक भूस्खलन जोखिम है। ${affectedRoads} सड़कें प्रभावित हो सकती हैं और ${isolatedVillages} गांव अलग-थलग पड़ सकते हैं। कृपया अनावश्यक यात्रा से बचें और आधिकारिक निर्देशों का पालन करें।`,
    };
  }

  if (language === 'lus') {
    return {
      title: 'Lung tlan hlauhawm thu — Aizawl District',
      message: `DDMA Aizawl chuan: Tunah lung tlan hlauhawm nasa tak a awm ${criticalZones} hmun ah. Kawng ${affectedRoads} hi a nghawng thei a, khaw ${isolatedVillages} pawh an inhen thei. Kalpui vek loh tur leh thupek dan zawm tur kan ngen a che.`,
    };
  }

  return {
    title: `Landslide Early Warning — Aizawl District (${severity.toUpperCase()})`,
    message: `District Disaster Management Authority (Aizawl) advisory: ${criticalZones} zone(s) currently show critical landslide risk. ${affectedRoads} road segment(s) may be affected and ${isolatedVillages} village(s) are at risk of isolation. Avoid non-essential travel in these areas and follow official instructions.`,
  };
}