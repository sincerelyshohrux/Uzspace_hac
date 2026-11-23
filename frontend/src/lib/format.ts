import type { Alert, Zone } from "@/api/types";
import type { Lang } from "@/i18n";

const THIN = " ";
export const fmtInt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, THIN);
export const fmtArea = (m2: number) => `≈ ${fmtInt(m2)} m²`;
export const fmtHa = (ha: number) => (ha >= 10 ? ha.toFixed(1) : ha.toFixed(2));
export const fmtPct = (v: number) => `${Math.round(v * 100)}%`;

const MONTHS_UZ = ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtMonth(ym: string | null | undefined, lang: Lang, short = false) {
  if (!ym) return "—";
  const [y, m] = ym.split("-").map(Number);
  const mon = (lang === "uz" ? MONTHS_UZ : MONTHS_EN)[m - 1];
  return short ? `${mon} '${String(y).slice(2)}` : `${mon} ${y}`;
}
export function fmtDateTime(iso: string | null | undefined, lang: Lang) {
  if (!iso) return "—";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  const mon = (lang === "uz" ? MONTHS_UZ : MONTHS_EN)[d.getMonth()];
  return `${d.getDate()} ${mon} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export type RiskLevel = "high" | "mid" | "low";
export const riskLevel = (r: number): RiskLevel => (r >= 60 ? "high" : r >= 30 ? "mid" : "low");
/** Hex colours for canvas/SVG contexts (MapLibre, Recharts). Match the CSS tokens. */
export const RISK_HEX: Record<RiskLevel, string> = { high: "#EF4444", mid: "#F59E0B", low: "#EAB308" };
export const riskHex = (r: number) => RISK_HEX[riskLevel(r)];

export const ZONE_HEX: Record<Zone, string> = {
  canal: "#38BDF8", river: "#14B8A6", power_line: "#F59E0B", railway: "#A1A1AA",
  park: "#4ADE80", cemetery: "#A78BFA", farmland: "#CA8A04",
};
export const STATUS_HEX = { new: "#94A3B8", in_review: "#3B82F6", confirmed: "#A855F7", false_positive: "#64748B" } as const;

export function toCsv(items: Alert[]): string {
  const head = ["alert_id", "district", "lat", "lon", "area_m2", "change_type", "start_month", "zones", "permit_match", "confidence", "risk_score", "status", "note"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = items.map((a) =>
    [a.alert_id, a.district, a.lat, a.lon, a.area_m2, a.change_type, a.start_month, a.zones.join("|"), a.permit_match, a.confidence, a.risk_score, a.status, a.note].map(esc).join(","),
  );
  return [head.join(","), ...rows].join("\n");
}

export function downloadText(filename: string, content: string, type = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
