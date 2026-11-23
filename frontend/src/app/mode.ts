// Data source selection.
//  - "api":  FastAPI backend (/api, /static)
//  - "demo": static files in public/demo (same contract), statuses kept in localStorage
// VITE_DATA_MODE = "api" | "demo" | "auto" (default auto: use the API if /api/health answers).
export type DataMode = "api" | "demo";

const KEY = "ss-data-mode";
let mode: DataMode = "demo";

export function getMode(): DataMode {
  return mode;
}

export function setPreferredMode(m: DataMode | null) {
  try {
    if (m) localStorage.setItem(KEY, m);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export async function apiReachable(timeoutMs = 2500): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const r = await fetch("/api/health", { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return false;
    const j = (await r.json()) as { status?: string };
    return j.status === "ok";
  } catch {
    return false;
  }
}

export async function resolveMode(): Promise<{ mode: DataMode; apiOnline: boolean }> {
  const env = (import.meta.env.VITE_DATA_MODE as string | undefined) ?? "auto";
  let pref: string | null = null;
  try {
    pref = localStorage.getItem(KEY);
  } catch {
    /* ignore */
  }
  const online = await apiReachable();
  if (env === "demo" || pref === "demo") mode = "demo";
  else if (env === "api") mode = "api";
  else mode = online ? "api" : "demo";
  return { mode, apiOnline: online };
}
