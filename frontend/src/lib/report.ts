// Demo mode only: printable HTML report (browser "Save as PDF"). API mode uses /api/alerts/{id}/report.pdf.
import type { Alert, AuditEntry } from "@/api/types";

export function openPrintableReport(a: Alert, audit: AuditEntry[], L: (k: string) => string, chips: { before: string | null; after: string | null }) {
  const w = window.open("", "_blank");
  if (!w) return;
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const abs = (u: string | null) => (u ? new URL(u, location.href).href : "");
  const rows: [string, string][] = [
    [L("district"), a.district],
    [L("coords"), `${a.lat.toFixed(6)}, ${a.lon.toFixed(6)}`],
    [L("area"), `≈ ${a.area_m2.toLocaleString("ru-RU")} m²`],
    [L("change_type"), L(`ct_${a.change_type}`)],
    [L("started"), a.start_month ?? "—"],
    [L("zone"), a.zones.map((z) => L(`z_${z}`)).join(", ") || L("no_zone")],
    [L("rf_permit"), `${L(`pm_${a.permit_match}`)} ${L("demo_registry")}`],
    [L("rf_confidence"), `${Math.round(a.confidence * 100)}%`],
    ["Risk", `${a.risk_score} / 100`],
    [L("status"), L(`st_${a.status}`)],
    ["Google Maps", `https://www.google.com/maps?q=${a.lat},${a.lon}`],
  ];
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(a.alert_id)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;margin:32px;color:#0f172a;position:relative}h1{margin:0 0 4px;font-size:22px}
.muted{color:#64748b;font-size:12px}.wm{position:fixed;top:38%;left:18%;font-size:120px;font-weight:800;color:#fde2e2;transform:rotate(-30deg);z-index:-1}
table{border-collapse:collapse;margin:16px 0;width:100%;font-size:13px}td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
td:first-child{font-weight:600;width:200px}.imgs{display:flex;gap:12px}.imgs div{flex:1}.imgs img{width:100%;border-radius:8px}
.f{font-family:monospace;font-size:12px;color:#475569}li{font-size:12px;margin:3px 0}@media print{button{display:none}}</style></head><body>
<div class="wm">DEMO</div>
<button onclick="window.print()" style="float:right;padding:8px 14px">PDF / Print</button>
<h1>${esc(a.alert_id)} · ${esc(L("needs_check"))}</h1>
<div class="muted">${esc(L("disclaimer"))}</div>
<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
<div class="f">100 × ${a.risk.confidence.toFixed(2)} × ${a.risk.zone_weight.toFixed(2)} × ${a.risk.area_factor.toFixed(2)} × ${a.risk.permit_factor.toFixed(2)} = ${a.risk_score}</div>
<div class="imgs" style="margin-top:16px"><div><b>T1 · 2023</b><img src="${abs(chips.before)}"></div><div><b>T2 · 2025</b><img src="${abs(chips.after)}"></div></div>
${a.note ? `<h3>Note</h3><p>${esc(a.note)}</p>` : ""}
${audit.length ? `<h3>${esc(L("history"))}</h3><ul>${audit.map((e) => `<li>${esc(e.ts.slice(0, 16).replace("T", " "))} · ${esc(e.user)}: ${esc(e.old_status ?? "—")} → ${esc(e.new_status)}${e.note ? ` (${esc(e.note)})` : ""}</li>`).join("")}</ul>` : ""}
</body></html>`);
  w.document.close();
}
