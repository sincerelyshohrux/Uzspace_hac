import { getMode } from "@/app/mode";
import type { DemoRow } from "@/lib/demoActivity";
import { demoApi } from "./demoServer";
import type {
  Alert, AlertList, AlertUpdate, AuditEntry, DistrictLayer, DistrictStat, Filters, InspectorStat,
  Meta, Metrics, Summary, TimelinePoint, TimeseriesPoint, ZoneLayer,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function http<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
  } catch {
    throw new ApiError(0, "Network error: backend unreachable");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, String(detail));
  }
  return (await res.json()) as T;
}

export function filtersToQuery(f: Filters): string {
  const p = new URLSearchParams();
  if (f.district) p.set("district", f.district);
  if (f.zone) p.set("zone", f.zone);
  if (f.minRisk) p.set("min_risk", String(f.minRisk));
  if (f.status) p.set("status", f.status);
  if (f.changeType) p.set("change_type", f.changeType);
  if (f.q.trim()) p.set("q", f.q.trim());
  return p.toString();
}

const demo = () => getMode() === "demo";

export const api = {
  meta: (): Promise<Meta> => (demo() ? demoApi.meta() : http("/api/meta")),
  metrics: (): Promise<Metrics> => (demo() ? demoApi.metrics() : http("/api/metrics")),
  zones: (): Promise<ZoneLayer> => (demo() ? demoApi.zones() : http("/api/layers/zones")),
  districtsLayer: (): Promise<DistrictLayer> => (demo() ? demoApi.districtsLayer() : http("/api/layers/districts")),
  alerts: (f: Filters): Promise<AlertList> => (demo() ? demoApi.alerts(f) : http(`/api/alerts?${filtersToQuery(f)}&limit=2000`)),
  alert: (id: string): Promise<Alert> => (demo() ? demoApi.alert(id) : http(`/api/alerts/${encodeURIComponent(id)}`)),
  update: (id: string, body: AlertUpdate): Promise<Alert> =>
    demo() ? demoApi.update(id, body) : http(`/api/alerts/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(body) }),
  timeseries: (id: string): Promise<TimeseriesPoint[]> => (demo() ? demoApi.timeseries(id) : http(`/api/alerts/${encodeURIComponent(id)}/timeseries`)),
  audit: (id: string): Promise<AuditEntry[]> => (demo() ? demoApi.audit(id) : http(`/api/alerts/${encodeURIComponent(id)}/audit`)),
  summary: (): Promise<Summary> => (demo() ? demoApi.summary() : http("/api/stats/summary")),
  districts: (): Promise<DistrictStat[]> => (demo() ? demoApi.districts() : http("/api/stats/districts")),
  timeline: (): Promise<TimelinePoint[]> => (demo() ? demoApi.timeline() : http("/api/stats/timeline")),
  inspectors: (): Promise<InspectorStat[]> => (demo() ? demoApi.inspectors() : http("/api/stats/inspectors")),
  demoActivity: (): Promise<{ rows: number }> => (demo() ? demoApi.demoActivity() : http("/api/demo/activity")),
  demoSeed: (rows: DemoRow[]): Promise<{ rows: number }> =>
    demo() ? demoApi.demoSeed(rows) : http("/api/demo/activity", { method: "POST", body: JSON.stringify(rows) }),
  demoClear: (): Promise<{ removed: number }> => (demo() ? demoApi.demoClear() : http("/api/demo/activity", { method: "DELETE" })),
  reset: (): Promise<unknown> => (demo() ? demoApi.reset() : http("/api/admin/reset", { method: "POST" })),
};

export const chipUrl = (path: string | null): string | null =>
  !path ? null : demo() ? demoApi.chipUrl(path) : `/static/${path}`;

/** PDF report URL in API mode; null in demo mode (a printable HTML report is used instead). */
export const reportUrl = (id: string) => (demo() ? null : `/api/alerts/${encodeURIComponent(id)}/report.pdf`);
export const exportUrl = (f: Filters) => (demo() ? null : `/api/export.csv?${filtersToQuery(f)}`);
