// API contract. Must stay identical to backend/app/schemas.py.

export type Status = "new" | "in_review" | "confirmed" | "false_positive";
export type ChangeType = "new_construction" | "land_clearing" | "demolition";
export type PermitMatch = "none" | "matched" | "partial" | "no_data";
export type Zone = "canal" | "river" | "power_line" | "railway" | "park" | "cemetery" | "farmland";

export const ZONES: Zone[] = ["power_line", "canal", "river", "park", "farmland", "railway", "cemetery"];
export const STATUSES: Status[] = ["new", "in_review", "confirmed", "false_positive"];
export const CHANGE_TYPES: ChangeType[] = ["new_construction", "land_clearing", "demolition"];

export interface RiskBreakdown {
  confidence: number;
  zone_weight: number;
  area_factor: number;
  permit_factor: number;
}

export interface Alert {
  alert_id: string;
  district: string;
  area_m2: number;
  lat: number;
  lon: number;
  confidence: number;
  change_type: ChangeType;
  start_month: string | null;
  zones: Zone[];
  permit_match: PermitMatch;
  risk_score: number;
  risk: RiskBreakdown;
  status: Status;
  note: string | null;
  updated_at: string | null;
  chip_before: string | null;
  chip_after: string | null;
  geometry: GeoJSON.Polygon;
}

export interface AlertList { total: number; items: Alert[] }
export interface AlertUpdate { status: Status; note?: string | null; user?: string }

export interface AuditEntry {
  id: number;
  alert_id: string;
  old_status: Status | null;
  new_status: Status;
  note: string | null;
  user: string;
  ts: string;
}

export interface TimeseriesPoint { month: string; built: number | null }

export interface Summary {
  total: number;
  area_ha: number;
  in_restricted_zone: number;
  high_risk: number;
  confirmed: number;
  false_positive: number;
  pending: number;
}

export interface DistrictStat {
  district: string;
  count: number;
  area_ha: number;
  in_restricted_zone: number;
  high_risk: number;
  confirmed: number;
}

export interface TimelinePoint { month: string; count: number; area_ha: number }

export interface InspectorStat {
  user: string;
  reviewed: number;
  confirmed: number;
  false_positive: number;
  last_action: string | null;
}

export interface Metrics {
  is_mock: boolean;
  test_points: number;
  baseline: { precision: number; recall: number; f1: number };
  ml: { precision: number; recall: number; f1: number; pr_auc: number };
  threshold: number;
  pr_curve: { threshold: number; precision: number; recall: number }[];
  confusion: { tp: number; fp: number; fn: number; tn: number };
  object_precision: { checked: number; correct: number };
  dataset?: {
    source: string;
    period_t1: string;
    period_t2: string;
    n_train: number;
    n_test: number;
    cv: string;
    features: string[];
  };
  limitations: string[];
  /** Strata of the validation sample, when one has been drawn */
  sampling?: { stratum: string; pixels: number; points: number }[] | null;
  labelled?: { usable: number; total: number };
}

export interface Meta {
  is_mock: boolean;
  region: string;
  period_t1: string;
  period_t2: string;
  generated_at: string;
  districts: string[];
  zones: Zone[];
  scenes_t1?: string[];
  scenes_t2?: string[];
}

export type ZoneLayer = GeoJSON.FeatureCollection<GeoJSON.Geometry, { zone: Zone; name: string; buffer_m: number }>;
export type DistrictLayer = GeoJSON.FeatureCollection<GeoJSON.Polygon, { name: string }>;

export interface Filters {
  district: string;
  zone: string; // "" | Zone | "any_restricted"
  minRisk: number;
  status: string;
  changeType: string;
  q: string;
}

export const EMPTY_FILTERS: Filters = { district: "", zone: "", minRisk: 0, status: "", changeType: "", q: "" };
