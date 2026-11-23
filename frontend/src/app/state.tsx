// Global UI state, mirrored into the URL (?tab=&alert=&district=…) so every view is shareable and survives reload.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { EMPTY_FILTERS, type Filters } from "@/api/types";

export type Tab = "dashboard" | "stats" | "accuracy";
export type QueueTab = "all" | "critical" | "review" | "mine";
export type SortKey = "risk" | "area" | "new";
export type Basemap = "satellite" | "streets" | "dark";

export interface AppState {
  tab: Tab;
  alert: string | null;
  filters: Filters;
  queue: QueueTab;
  sort: SortKey;
  month: string | null; // timeline cap, null = whole period
  basemap: Basemap;
  view3d: boolean;
}


function fromUrl(): AppState {
  const p = new URLSearchParams(location.search);
  const tab = p.get("tab");
  return {
    tab: tab === "stats" || tab === "accuracy" ? tab : "dashboard",
    alert: p.get("alert"),
    filters: {
      district: p.get("district") ?? "",
      zone: p.get("zone") ?? "",
      minRisk: Number(p.get("min_risk") ?? 0) || 0,
      status: p.get("status") ?? "",
      changeType: p.get("type") ?? "",
      q: p.get("q") ?? "",
    },
    queue: (["all", "critical", "review", "mine"] as const).find((x) => x === p.get("queue")) ?? "all",
    sort: (["risk", "area", "new"] as const).find((x) => x === p.get("sort")) ?? "risk",
    month: /^\d{4}-\d{2}$/.test(p.get("month") ?? "") ? p.get("month") : null,
    basemap: (["satellite", "streets", "dark"] as const).find((x) => x === p.get("basemap")) ?? "satellite",
    view3d: p.get("mode") === "3d",
  };
}

function toUrl(s: AppState) {
  const p = new URLSearchParams();
  if (s.tab !== "dashboard") p.set("tab", s.tab);
  if (s.alert) p.set("alert", s.alert);
  if (s.filters.district) p.set("district", s.filters.district);
  if (s.filters.zone) p.set("zone", s.filters.zone);
  if (s.filters.minRisk) p.set("min_risk", String(s.filters.minRisk));
  if (s.filters.status) p.set("status", s.filters.status);
  if (s.filters.changeType) p.set("type", s.filters.changeType);
  if (s.filters.q) p.set("q", s.filters.q);
  if (s.queue !== "all") p.set("queue", s.queue);
  if (s.sort !== "risk") p.set("sort", s.sort);
  if (s.month) p.set("month", s.month);
  if (s.basemap !== "satellite") p.set("basemap", s.basemap);
  if (s.view3d) p.set("mode", "3d");
  const qs = p.toString();
  const url = `${location.pathname}${qs ? `?${qs}` : ""}`;
  if (url !== `${location.pathname}${location.search}`) history.replaceState(null, "", url);
}

interface Ctx {
  s: AppState;
  set: (patch: Partial<AppState>) => void;
  setFilters: (patch: Partial<Filters>) => void;
  resetFilters: () => void;
  select: (id: string | null) => void;
}
const StateCtx = createContext<Ctx | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<AppState>(fromUrl);
  useEffect(() => toUrl(s), [s]);
  const set = useCallback((patch: Partial<AppState>) => setS((p) => ({ ...p, ...patch })), []);
  const setFilters = useCallback((patch: Partial<Filters>) => setS((p) => ({ ...p, filters: { ...p.filters, ...patch } })), []);
  const resetFilters = useCallback(() => setS((p) => ({ ...p, filters: EMPTY_FILTERS, queue: "all", month: null })), []);
  const select = useCallback((id: string | null) => setS((p) => ({ ...p, alert: id })), []);
  const value = useMemo(() => ({ s, set, setFilters, resetFilters, select }), [s, set, setFilters, resetFilters, select]);
  return <StateCtx.Provider value={value}>{children}</StateCtx.Provider>;
}

export function useAppState() {
  const c = useContext(StateCtx);
  if (!c) throw new Error("AppStateProvider missing");
  return c;
}

// ---------- current user + "Mine" tracking ----------
export const CURRENT_USER = "inspector.demo";
const MINE_KEY = "qn-mine";
export function getMine(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
export function addMine(id: string) {
  const m = getMine();
  m.add(id);
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify([...m]));
  } catch {
    /* ignore */
  }
}

// ---------- persisted map layer prefs ----------
export interface LayerPrefs {
  alerts: boolean;
  zones: boolean;
  buffers: boolean;
  districts: boolean;
  heat: boolean;
  zoneTypes: Record<string, boolean>;
  alertOpacity: number;
  zoneOpacity: number;
}
export const DEFAULT_LAYERS: LayerPrefs = {
  alerts: true, zones: true, buffers: true, districts: true, heat: false,
  zoneTypes: { canal: true, river: true, power_line: true, railway: true, park: true, cemetery: true, farmland: true },
  alertOpacity: 0.35, zoneOpacity: 0.18,
};
export function loadLayers(): LayerPrefs {
  try {
    const v = localStorage.getItem("qn-layers");
    if (v) return { ...DEFAULT_LAYERS, ...(JSON.parse(v) as Partial<LayerPrefs>) };
  } catch {
    /* ignore */
  }
  return DEFAULT_LAYERS;
}
export function saveLayers(l: LayerPrefs) {
  try {
    localStorage.setItem("qn-layers", JSON.stringify(l));
  } catch {
    /* ignore */
  }
}
