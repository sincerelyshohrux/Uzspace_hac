// In-browser implementation of the backend API on top of public/demo (same files the backend serves).
// Inspector actions are persisted in localStorage, so the demo is fully interactive without a server.
import type {
  Alert, AlertList, AlertUpdate, AuditEntry, DistrictLayer, DistrictStat, Filters, InspectorStat,
  Meta, Metrics, Summary, TimelinePoint, TimeseriesPoint, ZoneLayer,
} from "./types";
import type { DemoRow } from "@/lib/demoActivity";

const KEY = "ss-demo-state-v2";
const BASE = `${import.meta.env.BASE_URL}demo/`;

interface State {
  statuses: Record<string, { status: Alert["status"]; note: string | null; updated_at: string; user: string }>;
  audit: AuditEntry[];
}
type RawActivity = Omit<AuditEntry, "id">;

const cache = new Map<string, Promise<unknown>>();
function file<T>(name: string): Promise<T> {
  if (!cache.has(name)) {
    cache.set(name, fetch(BASE + name).then((r) => {
      if (!r.ok) throw new Error(`demo/${name}: ${r.status}`);
      return r.json();
    }));
  }
  return cache.get(name) as Promise<T>;
}

async function baseAlerts(): Promise<Alert[]> {
  const fc = await file<GeoJSON.FeatureCollection<GeoJSON.Polygon, Omit<Alert, "geometry" | "status" | "note" | "updated_at">>>("alerts.geojson");
  return fc.features.map((f) => ({ ...f.properties, geometry: f.geometry, status: "new", note: null, updated_at: null }) as Alert);
}

let state: State | null = null;
async function getState(): Promise<State> {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (state = JSON.parse(raw) as State);
  } catch {
    /* ignore */
  }
  const seed = await file<RawActivity[]>("demo_activity.json").catch(() => [] as RawActivity[]);
  const s: State = { statuses: {}, audit: [] };
  seed.forEach((e, i) => {
    s.audit.push({ ...e, id: i + 1 });
    s.statuses[e.alert_id] = { status: e.new_status, note: e.note, updated_at: e.ts, user: e.user };
  });
  return (state = s);
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

const latency = <T,>(v: T, ms = 120) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), ms));

async function merged(): Promise<Alert[]> {
  const [items, st] = await Promise.all([baseAlerts(), getState()]);
  return items.map((a) => {
    const s = st.statuses[a.alert_id];
    return s ? { ...a, status: s.status, note: s.note, updated_at: s.updated_at } : a;
  });
}

export function applyFilters(items: Alert[], f: Filters): Alert[] {
  const q = f.q.trim().toLowerCase();
  return items
    .filter((a) => {
      if (f.district && a.district !== f.district) return false;
      if (f.zone === "any_restricted" && a.zones.length === 0) return false;
      if (f.zone && f.zone !== "any_restricted" && !a.zones.includes(f.zone as Alert["zones"][number])) return false;
      if (a.risk_score < f.minRisk) return false;
      if (f.status && a.status !== f.status) return false;
      if (f.changeType && a.change_type !== f.changeType) return false;
      if (q && !a.alert_id.toLowerCase().includes(q) && !a.district.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => b.risk_score - a.risk_score);
}

async function one(id: string): Promise<Alert> {
  const a = (await merged()).find((x) => x.alert_id === id);
  if (!a) throw new Error(`404: ${id}`);
  return a;
}

export const demoApi = {
  meta: () => file<Meta>("meta.json").then(latency),
  metrics: () => file<Metrics>("metrics.json").then(latency),
  zones: () => file<ZoneLayer>("zones.geojson"),
  districtsLayer: () => file<DistrictLayer>("districts.geojson"),
  alerts: async (f: Filters): Promise<AlertList> => {
    const items = applyFilters(await merged(), f);
    return latency({ total: items.length, items });
  },
  alert: async (id: string) => latency(await one(id)),
  update: async (id: string, body: AlertUpdate): Promise<Alert> => {
    const cur = await one(id);
    const st = await getState();
    const ts = new Date().toISOString();
    const user = body.user ?? "inspector.demo";
    st.statuses[id] = { status: body.status, note: body.note ?? null, updated_at: ts, user };
    st.audit.push({ id: (st.audit.at(-1)?.id ?? 0) + 1, alert_id: id, old_status: cur.status, new_status: body.status, note: body.note ?? null, user, ts });
    save();
    return latency(await one(id), 250);
  },
  timeseries: async (id: string) => latency((await file<Record<string, TimeseriesPoint[]>>("timeseries.json"))[id] ?? []),
  audit: async (id: string) => latency((await getState()).audit.filter((e) => e.alert_id === id).slice().reverse()),
  summary: async (): Promise<Summary> => {
    const items = await merged();
    return latency({
      total: items.length,
      area_ha: Math.round(items.reduce((s, a) => s + a.area_m2, 0)) / 10000,
      in_restricted_zone: items.filter((a) => a.zones.length > 0).length,
      high_risk: items.filter((a) => a.risk_score >= 60).length,
      confirmed: items.filter((a) => a.status === "confirmed").length,
      false_positive: items.filter((a) => a.status === "false_positive").length,
      pending: items.filter((a) => a.status === "new" || a.status === "in_review").length,
    });
  },
  districts: async (): Promise<DistrictStat[]> => {
    const by = new Map<string, DistrictStat>();
    for (const a of await merged()) {
      const d = by.get(a.district) ?? { district: a.district, count: 0, area_ha: 0, in_restricted_zone: 0, high_risk: 0, confirmed: 0 };
      d.count++;
      d.area_ha += a.area_m2 / 10000;
      if (a.zones.length) d.in_restricted_zone++;
      if (a.risk_score >= 60) d.high_risk++;
      if (a.status === "confirmed") d.confirmed++;
      by.set(a.district, d);
    }
    return latency([...by.values()].map((d) => ({ ...d, area_ha: Math.round(d.area_ha * 100) / 100 })).sort((a, b) => b.count - a.count));
  },
  timeline: async (): Promise<TimelinePoint[]> => {
    const by = new Map<string, TimelinePoint>();
    for (const a of await merged()) {
      if (!a.start_month) continue;
      const t = by.get(a.start_month) ?? { month: a.start_month, count: 0, area_ha: 0 };
      t.count++;
      t.area_ha = Math.round((t.area_ha + a.area_m2 / 10000) * 100) / 100;
      by.set(a.start_month, t);
    }
    return latency([...by.values()].sort((a, b) => a.month.localeCompare(b.month)));
  },
  inspectors: async (): Promise<InspectorStat[]> => {
    const by = new Map<string, InspectorStat & { ids: Set<string> }>();
    for (const e of (await getState()).audit) {
      const s = by.get(e.user) ?? { user: e.user, reviewed: 0, confirmed: 0, false_positive: 0, last_action: null, ids: new Set<string>() };
      s.ids.add(e.alert_id);
      if (e.new_status === "confirmed") s.confirmed++;
      if (e.new_status === "false_positive") s.false_positive++;
      if (!s.last_action || e.ts > s.last_action) s.last_action = e.ts;
      by.set(e.user, s);
    }
    return latency([...by.values()].map(({ ids, ...s }) => ({ ...s, reviewed: ids.size })).sort((a, b) => b.reviewed - a.reviewed));
  },
  demoActivity: async () => latency({ rows: (await getState()).audit.filter((e) => e.user.startsWith("demo.")).length }),
  demoSeed: async (rows: DemoRow[]) => {
    const st = await getState();
    let n = 0;
    for (const r of rows) {
      if (!r.user.startsWith("demo.")) continue;
      const old = st.statuses[r.alert_id]?.status ?? "new";
      st.audit.push({ id: (st.audit.at(-1)?.id ?? 0) + 1, alert_id: r.alert_id, old_status: old, new_status: r.new_status, note: r.note, user: r.user, ts: r.ts });
      st.statuses[r.alert_id] = { status: r.new_status, note: r.note, updated_at: r.ts, user: r.user };
      n++;
    }
    save();
    return latency({ rows: n });
  },
  demoClear: async () => {
    const st = await getState();
    const touched = new Set(st.audit.filter((e) => e.user.startsWith("demo.")).map((e) => e.alert_id));
    const before = st.audit.length;
    st.audit = st.audit.filter((e) => !e.user.startsWith("demo."));
    for (const id of touched) {
      const last = st.audit.filter((e) => e.alert_id === id).at(-1);
      if (last) st.statuses[id] = { status: last.new_status, note: last.note, updated_at: last.ts, user: last.user };
      else delete st.statuses[id];
    }
    save();
    return latency({ removed: before - st.audit.length });
  },
  reset: async () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    state = null;
    await getState();
  },
  chipUrl: (path: string) => BASE + path,
};
