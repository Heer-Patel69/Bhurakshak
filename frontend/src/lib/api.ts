import { getRiskMode } from './risk-mode';
import { API_BASE_URL } from './config';
import type {
  AlertItem,
  AuthorityOverviewResponse,
  BootstrapResponse,
  CitizenReportItem,
  CitizenReportPayload,
  CopilotAdviceResponse,
  FacilityAccessibilityResponse,
  FacilityFeature,
  HistoricalLandslidesResponse,
  IncidentItem,
  PlaceSearchItem,
  ReportMediaItem,
  RiskGridResponse,
  RiskPointResponse,
  RoadsResponse,
  RouteCompareResponse,
  SettlementFeature,
  VillageIsolationResponse,
  WeatherCurrentResponse,
  WeatherHistoryResponse,
} from './types';

class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}${endpoint}`;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Risk-Mode': getRiskMode(),
    ...(options.headers as Record<string, string>),
  };

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      let errorBody: any = {};
      try {
        errorBody = await response.json();
      } catch {
        // Non-JSON error response
      }
      const err = errorBody?.error || errorBody;
      throw new ApiError(
        err?.code || `HTTP_${response.status}`,
        err?.message || response.statusText || 'An unexpected error occurred',
        response.status,
        err?.details || errorBody
      );
    }

    return (await response.json()) as T;
  } catch (error: any) {
    const apiError = error instanceof ApiError ? error : new ApiError(
      'NETWORK_ERROR',
      error?.message || 'Failed to connect to Dhara Drishti API server.',
      0
    );
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      window.dispatchEvent(new CustomEvent('bhurakshak:api-error', {
        detail: { endpoint, code: apiError.code, status: apiError.status, message: apiError.message },
      }));
    }
    throw apiError;
  }
}

function authorityHeaders(accessToken: string): Record<string, string> {
  if (accessToken.startsWith('shared:')) {
    return { 'X-Authority-Key': accessToken.slice('shared:'.length) };
  }
  return { Authorization: `Bearer ${accessToken}` };
}

export const api = {
  // Bootstrap & Health
  getBootstrap: () => fetchJson<BootstrapResponse>('/api/v1/bootstrap'),
  getHealth: () => fetchJson<any>('/api/v1/health'),
  getProviders: () => fetchJson<any>('/api/v1/system/providers'),

  // Risk Engine
  getRiskPoint: (latitude: number, longitude: number, timestamp?: string) =>
    fetchJson<RiskPointResponse>('/api/v1/risk/point', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, timestamp }),
    }),

  getRiskGrid: (bbox: string, resolution: number = 6) =>
    fetchJson<RiskGridResponse>(
      `/api/v1/risk/grid?bbox=${encodeURIComponent(bbox)}&resolution=${resolution}`
    ),

  // GIS & Landslides
  getHistoricalLandslides: (bbox?: string) =>
    fetchJson<HistoricalLandslidesResponse>(
      `/api/v1/gis/historical-landslides${bbox ? `?bbox=${encodeURIComponent(bbox)}` : ''}`
    ),

  getRoads: (bbox?: string, offset: number = 0, limit: number = 500) =>
    fetchJson<RoadsResponse>(
      `/api/v1/roads?offset=${offset}&limit=${limit}${bbox ? `&bbox=${encodeURIComponent(bbox)}` : ''}`
    ),

  getRoadExposure: (bbox?: string, resolution: number = 5) =>
    fetchJson<{ type: 'FeatureCollection'; features: any[]; metadata: any }>(
      `/api/v1/roads/exposure?bbox=${encodeURIComponent(bbox || '92.64,23.63,92.80,23.82')}&resolution=${resolution}`
    ),

  getSettlements: () =>
    fetchJson<{ type: 'FeatureCollection'; features: SettlementFeature[]; metadata: any }>(
      '/api/v1/villages'
    ),

  getVillageIsolation: (analysisMode: 'risk_scenario' | 'confirmed_closure' = 'risk_scenario') =>
    fetchJson<VillageIsolationResponse>(
      `/api/v1/villages/isolation?analysis_mode=${analysisMode}`
    ),

  getFacilities: () =>
    fetchJson<{ type: 'FeatureCollection'; features: FacilityFeature[]; metadata: any }>(
      '/api/v1/facilities'
    ),

  getFacilityAccessibility: (params: { latitude?: number; longitude?: number; village_id?: string }) => {
    const query = new URLSearchParams();
    if (params.latitude !== undefined) query.set('latitude', params.latitude.toString());
    if (params.longitude !== undefined) query.set('longitude', params.longitude.toString());
    if (params.village_id) query.set('village_id', params.village_id);
    return fetchJson<FacilityAccessibilityResponse>(`/api/v1/accessibility?${query.toString()}`);
  },

  searchPlaces: (query: string, limit: number = 15) =>
    fetchJson<{ items: PlaceSearchItem[]; count: number; source: string; query: string }>(
      `/api/v1/places/search?q=${encodeURIComponent(query)}&limit=${limit}`
    ),

  // Routing
  compareRoutes: (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) =>
    fetchJson<RouteCompareResponse>('/api/v1/routes/compare', {
      method: 'POST',
      body: JSON.stringify({ origin, destination }),
    }),

  // AI Copilot
  getCopilotAdvice: (payload: { latitude: number; longitude: number; language?: 'en' | 'hi' | 'lus'; question?: string }) =>
    fetchJson<CopilotAdviceResponse>('/api/v1/copilot/advice', {
      method: 'POST',
      body: JSON.stringify({
        latitude: payload.latitude,
        longitude: payload.longitude,
        language: payload.language || 'en',
        question: payload.question,
      }),
    }),

  // Weather
  getCurrentWeather: (latitude: number, longitude: number) =>
    fetchJson<WeatherCurrentResponse>(
      `/api/v1/weather/current?latitude=${latitude}&longitude=${longitude}`
    ),

  getWeatherHistory: (latitude: number, longitude: number, timestamp?: string) =>
    fetchJson<WeatherHistoryResponse>(
      `/api/v1/weather/history?latitude=${latitude}&longitude=${longitude}${timestamp ? `&timestamp=${encodeURIComponent(timestamp)}` : ''}`
    ),

  getWeatherStatus: () => fetchJson<any>('/api/v1/weather/status'),

  // Citizen Reports
  submitReport: (payload: CitizenReportPayload) =>
    fetchJson<CitizenReportItem>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  uploadReportMedia: (reportId: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetchJson<ReportMediaItem>(`/api/v1/reports/${reportId}/media`, {
      method: 'POST',
      body: formData,
    });
  },

  getMapReports: () =>
    fetchJson<{ type: 'FeatureCollection'; features: any[]; metadata: any }>('/api/v1/reports/map'),

  getReportMedia: (reportId: string, authorityKey: string) =>
    fetchJson<{ items: ReportMediaItem[]; count: number }>(
      `/api/v1/reports/${reportId}/media`,
      {
        headers: authorityHeaders(authorityKey),
      }
    ),

  // Alerts
  getAlerts: (limit: number = 50) =>
    fetchJson<{ items: AlertItem[]; count: number }>(`/api/v1/alerts?limit=${limit}`),

  createAlert: (payload: any, authorityKey: string) =>
    fetchJson<{ alert_id: string; delivery_status: any }>('/api/v1/alerts', {
      method: 'POST',
      headers: authorityHeaders(authorityKey),
      body: JSON.stringify(payload),
    }),

  // Authority Dashboard
  getAuthorityOverview: (authorityKey: string) =>
    fetchJson<AuthorityOverviewResponse>('/api/v1/authority/overview', {
      headers: authorityHeaders(authorityKey),
    }),

  getAuthorityReports: (
    authorityKey: string,
    verificationStatus?: string,
    offset: number = 0,
    limit: number = 50
  ) =>
    fetchJson<{ items: CitizenReportItem[]; count: number; offset: number; limit: number }>(
      `/api/v1/reports?offset=${offset}&limit=${limit}${verificationStatus ? `&verification_status=${verificationStatus}` : ''}`,
      {
        headers: authorityHeaders(authorityKey),
      }
    ),

  verifyReport: (
    reportId: string,
    payload: {
      status: 'under_review' | 'verified' | 'rejected';
      verified_by: string;
      severity?: string;
      category?: string;
      verification_note?: string;
      affected_road_id?: string;
      confirmed_road_blockage?: boolean;
    },
    authorityKey: string
  ) =>
    fetchJson<{ report: CitizenReportItem; incident_id?: string | null }>(
      `/api/v1/reports/${reportId}/verify`,
      {
        method: 'PATCH',
        headers: authorityHeaders(authorityKey),
        body: JSON.stringify(payload),
      }
    ),

  getIncidents: (authorityKey: string, limit: number = 50) =>
    fetchJson<{ items: IncidentItem[]; count: number }>(
      `/api/v1/incidents?limit=${limit}`,
      {
        headers: authorityHeaders(authorityKey),
      }
    ),

  verifyIncident: (
    incidentId: string,
    payload: { status: string; verified_by: string; severity?: string; affected_road_ids?: string[] },
    authorityKey: string
  ) =>
    fetchJson<any>(`/api/v1/incidents/${incidentId}/verify`, {
      method: 'PATCH',
      headers: authorityHeaders(authorityKey),
      body: JSON.stringify(payload),
    }),

  updateRoadStatus: (
    roadId: string,
    payload: {
      status: 'open' | 'restricted' | 'hazard' | 'blocked' | 'officially_closed';
      source: 'authority' | 'official_closure' | 'verified_citizen_report';
      verified?: boolean;
      geometry?: any;
    },
    authorityKey: string
  ) =>
    fetchJson<any>(`/api/v1/roads/${encodeURIComponent(roadId)}/status`, {
      method: 'PATCH',
      headers: authorityHeaders(authorityKey),
      body: JSON.stringify(payload),
    }),
};
