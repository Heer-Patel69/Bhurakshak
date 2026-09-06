export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ConfidenceLevel = 'low' | 'moderate' | 'high';
export type AssessmentContext = 'live_operational' | 'historical_reference_scenario' | 'degraded_current';

export interface LocationCoordinates {
  latitude: float;
  longitude: float;
}

export type float = number;

export interface RiskPointResponse {
  location: {
    latitude: number;
    longitude: number;
  };
  risk_score: number;
  risk_level: RiskLevel;
  confidence_score: number;
  confidence_level: ConfidenceLevel;
  signals: {
    soil?: { status: string; volumetric_water_content?: number; source: string };
    rainfall?: {
      provider?: string;
      source: string;
      rainfall_1h_mm?: number | null;
      rainfall_24h_mm?: number | null;
      rainfall_72h_mm?: number | null;
      rainfall_7d_mm?: number | null;
      live: boolean;
      status: string;
    };
    terrain?: {
      elevation_m: number;
      slope_deg: number;
      aspect_deg?: number | null;
      source: string;
    };
    historical_susceptibility?: {
      historical_susceptibility_score: number;
      nearest_historical_event_distance_m: number;
      historical_events_within_500m: number;
      historical_events_within_1km: number;
      historical_events_within_2km: number;
      inventory_size: number;
    };
    historical?: {
      historical_susceptibility_score: number;
      nearest_historical_event_distance_m: number;
      historical_events_within_500m: number;
      historical_events_within_1km: number;
      historical_events_within_2km: number;
      inventory_size: number;
      status: string;
    };
    ml_susceptibility?: {
      ml_susceptibility_score?: number | null;
      model_name: string;
      status: string;
    };
    ml?: {
      available: boolean;
      model_loaded: boolean;
      susceptibility_score?: number | null;
      ml_susceptibility_score?: number | null;
      model_name: string;
      model_version: string;
      status: string;
      features?: string[];
    };
    sensor?: {
      status: string;
      reading?: any;
    };
    satellite?: {
      status: string;
    };
    citizen_reports?: {
      verified_reports_within_500m: number;
      reports: any[];
    };
  };
  drivers: string[];
  data_sources: Array<{
    signal: string;
    source: string;
    status: string;
    live: boolean;
    confidence: string;
    timestamp?: string;
  }>;
  missing_signals: string[];
  generated_at: string;
  data_timestamp?: string | null;
  assessment_context: AssessmentContext;
}

export interface RiskGridFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'Polygon';
    coordinates: [number, number] | number[][][];
  };
  properties: {
    risk_score: number;
    risk_level: RiskLevel;
    confidence_score: number;
    confidence_level: ConfidenceLevel;
    drivers: string[];
    context: string;
    generated_at: string;
    weather_source: string;
    sample_distance_m?: number;
  };
}

export interface RiskGridResponse {
  type: 'FeatureCollection';
  features: RiskGridFeature[];
  metadata: {
    bbox: [number, number, number, number];
    resolution: number;
    cell_count: number;
    assessment_context: AssessmentContext;
    generated_at: string;
  };
}

export interface HistoricalLandslideFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    event_id: string;
    location_name?: string | null;
    date?: string | null;
    landslide_type?: string | null;
    source: string;
    trigger?: string | null;
    fatalities?: number | null;
    state?: string;
    district?: string;
  };
}

export interface HistoricalLandslidesResponse {
  type: 'FeatureCollection';
  features: HistoricalLandslideFeature[];
  metadata: {
    inventory_size: number;
    source: string;
    pilot: string;
  };
}

export interface RoadFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'LineString' | 'MultiLineString';
    coordinates: number[][] | number[][][];
  };
  properties: {
    road_id: string;
    name?: string | null;
    highway?: string | null;
    surface?: string | null;
    length_m?: number;
    status?: 'open' | 'restricted' | 'hazard' | 'high_risk' | 'blocked' | 'officially_closed';
    closure_confirmed?: boolean;
    exposed_length_m?: number;
    risk_score?: number;
    source?: string;
  };
}

export interface RoadsResponse {
  type: 'FeatureCollection';
  features: RoadFeature[];
  metadata: {
    count: number;
    total_feature_count?: number;
    matched_feature_count?: number;
    returned_feature_count?: number;
    offset: number;
    limit: number;
    layer: string;
  };
}

export interface SettlementFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    village_id?: string;
    name: string;
    population?: number | null;
    place?: string;
    nearest_node?: string;
    status?: 'connected' | 'at_risk' | 'potentially_isolated' | 'confirmed_isolated';
    hospital_reachable?: boolean;
    major_road_reachable?: boolean;
  };
}

export interface FacilityFeature {
  type: 'Feature';
  id?: string | number;
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    facility_id?: string;
    name: string;
    facility_type: 'hospital' | 'clinic' | 'police' | 'fire' | 'emergency' | string;
    amenity?: string;
    phone?: string | null;
    nearest_node?: string;
    source?: string;
  };
}

export interface VillageIsolationItem {
  village_id: string;
  village_name: string;
  isolation_status: 'connected' | 'at_risk' | 'potentially_isolated' | 'confirmed_isolated';
  hospital_reachable: boolean;
  major_road_reachable: boolean;
  alternative_routes_available: boolean;
  analysis_mode: 'risk_scenario' | 'confirmed_closure';
  reason?: string;
}

export interface VillageIsolationResponse {
  status: string;
  analysis_mode: 'risk_scenario' | 'confirmed_closure';
  villages: VillageIsolationItem[];
  message?: string;
}

export interface FacilityAccessibilityResponse {
  accessibility_status: string;
  source_node?: string;
  nearest_facility?: {
    facility_id: string;
    name: string;
    facility_type: string;
  } | null;
  route_distance_m?: number;
  estimated_travel_time_seconds?: number;
  route_risk_exposure?: number;
  reachable_facilities: Array<{
    facility_id: string;
    name: string;
    facility_type: string;
    distance_m: number;
    travel_time_s: number;
    eta_minutes: number;
  }>;
  unreachable_facilities: Array<{
    facility_id: string;
    name: string;
    facility_type: string;
  }>;
}

export interface PlaceSearchItem {
  id: string;
  name: string;
  type: 'facility' | 'settlement' | 'road';
  subtype?: string | null;
  latitude: number;
  longitude: number;
  display_name: string;
  source: string;
}

export interface RouteSegment {
  distance_m: number;
  travel_time_s: number;
  eta_minutes: number;
  mean_risk_score: number;
  high_risk_distance_m: number;
  route_geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  nodes: string[];
}

export interface RouteCompareResponse {
  fastest_route: RouteSegment;
  safer_route: RouteSegment;
  comparison: {
    risk_reduction_percent: number;
    extra_travel_time_s: number;
    extra_travel_time_minutes: number;
    extra_distance_m: number;
    is_safer_alternative_available: boolean;
    recommended_route: 'safer' | 'fastest';
    advisory: string;
  };
  unverified_reports_close_edges: boolean;
}

export type HazardCategory =
  | 'landslide'
  | 'slope_crack'
  | 'rockfall'
  | 'debris'
  | 'water_seepage'
  | 'road_blockage'
  | 'slope_movement'
  | 'collapsed_retaining_wall'
  | 'flash_flood'
  | 'road_damage'
  | 'low_visibility'
  | 'unknown';

export type ReporterType = 'citizen' | 'field_official' | 'authority';
export type LocationSource = 'device_gps' | 'manual_pin' | 'media_exif';
export type VerificationStatusType = 'pending' | 'under_review' | 'verified' | 'rejected';

export interface CitizenReportPayload {
  report_id?: string;
  latitude: number;
  longitude: number;
  accuracy_m?: number | null;
  timestamp?: string;
  category: HazardCategory;
  description_original?: string;
  language?: 'en' | 'hi' | 'lus';
  location_source: LocationSource;
  reporter_type?: ReporterType;
  place_name?: string;
  landmark?: string;
  road_name?: string;
  district?: string;
  severity_observed?: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  offline_created_at?: string;
}

export interface CitizenReportItem {
  report_id: string;
  client_report_id?: string | null;
  latitude: number;
  longitude: number;
  gps_accuracy_m?: number | null;
  captured_at: string;
  category: HazardCategory;
  description_original?: string | null;
  transcript?: string | null;
  ai_summary?: string | null;
  ai_severity?: string | null;
  ai_confidence?: number | null;
  media_url?: string | null;
  media_mime_type?: string | null;
  language: string;
  location_source: LocationSource;
  verification_status: VerificationStatusType;
  verified_by?: string | null;
  verified_at?: string | null;
  incident_id?: string | null;
  created_at: string;
  updated_at: string;
  reporter_type: ReporterType;
  place_name?: string | null;
  landmark?: string | null;
  road_name?: string | null;
  severity_observed?: string | null;
  created_offline: boolean;
  sync_status: 'synced' | 'pending_media' | 'duplicate' | string;
  verification_note?: string | null;
  affected_road_id?: string | null;
  authority_action_id?: string | null;
  media_status: 'none' | 'pending' | 'uploaded';
  location: { latitude: number; longitude: number };
}

export interface ReportMediaItem {
  media_id: string;
  report_id: string;
  storage_path: string;
  media_type: 'image' | 'video' | 'audio';
  mime_type: string;
  file_size_bytes: number;
  uploaded_at: string;
  source: string;
  original_filename?: string | null;
  sha256?: string;
  signed_url?: string;
}

export interface IncidentItem {
  incident_id: string;
  centroid: { latitude: number; longitude: number };
  category: string;
  report_count: number;
  verification_status: string;
  severity: string;
  affected_road_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface AlertItem {
  alert_id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location?: any;
  affected_area?: any;
  recommended_action?: string | null;
  source: string;
  created_at: string;
  expires_at?: string | null;
  delivery_channels: string[];
  delivery_status?: any;
}

export interface WeatherCurrentResponse {
  mode: 'live' | 'unavailable';
  status: string;
  live: boolean;
  observation?: {
    provider: string;
    source: string;
    observation_time: string;
    rainfall_1h_mm?: number | null;
    rainfall_24h_mm?: number | null;
    temperature_c?: number | null;
    humidity_percent?: number | null;
    forecast_rainfall_mm?: number | null;
    confidence: string;
  } | null;
  provider_status?: {
    provider: string;
    status: string;
    message?: string;
  } | null;
}

export interface WeatherHistoryResponse {
  mode: 'historical';
  live: false;
  observation: {
    provider: string;
    source: string;
    observation_time: string;
    rainfall_1h_mm?: number | null;
    rainfall_24h_mm?: number | null;
    rainfall_72h_mm?: number | null;
    rainfall_7d_mm?: number | null;
    confidence: string;
    provenance: {
      year: number;
      date: string;
      region: string;
    };
  };
}

export interface CopilotAdviceResponse {
  summary: string;
  recommended_actions: string[];
  avoid: string[];
  emergency_information: string[];
  why: string[];
  confidence_note: string;
  language: 'en' | 'hi' | 'lus';
  generated_at: string;
  ai_available: boolean;
  recommendations_source: 'groq_grounded' | 'deterministic_template';
  facts: any;
}

export interface AuthorityOverviewResponse {
  generated_at: string;
  overall_risk: {
    maximum_recent_score?: number | null;
    snapshot_count: number;
    status: string;
  };
  high_critical_risk_zones: any[];
  confirmed_closures: Array<{
    road_id: string;
    source: string;
    observed_at?: string;
  }>;
  affected_roads: {
    status: string;
    items: string[];
  };
  potentially_isolated_villages: {
    status: string;
    items: string[];
  };
  hospital_accessibility: {
    status: string;
    items: string[];
  };
  latest_citizen_reports: string[];
  pending_report_count: number;
  verified_incidents: string[];
  sensor_status: any;
  weather_provider_status: any;
  satellite_provider_status: any;
  media_storage_status: any;
  alerts: string[];
  data_freshness: {
    latest_risk_generated_at?: string | null;
    weather: string;
  };
  system_health: {
    ml: string;
    terrain: string;
    historical: string;
  };
}

export interface BootstrapResponse {
  generated_at: string;
  pilot: string;
  supported_languages: Array<{
    code: 'en' | 'hi' | 'lus';
    name: string;
    review_status?: string;
  }>;
  provider_status: {
    weather: any;
    satellite: any;
    sensors: any;
    copilot: any;
    media: any;
  };
  risk_context: AssessmentContext;
  map_metadata: {
    bbox: string;
    crs: string;
    source: string;
  };
  feature_availability: {
    roads: string;
    settlements: string;
    facilities: string;
  };
  latest_alerts: Array<{
    alert_id: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    created_at: string;
  }>;
}

export interface OfflineQueuedReport {
  local_id: string;
  payload: CitizenReportPayload;
  media_file?: File | null;
  media_blob?: Blob | null;
  media_filename?: string;
  media_mime?: string;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  error_message?: string;
  created_at: number;
  server_report_id?: string;
}
