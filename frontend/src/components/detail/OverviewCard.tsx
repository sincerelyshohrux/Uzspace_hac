import { AlertTriangle, ArrowRight, Clock3, Layers, Radar, ScanSearch } from "lucide-react";
import type { Alert } from "@/api/types";
import { chipUrl } from "@/api/client";
import { useDistrictStats, useSummary } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { quarterlyCumulative, Spark } from "@/components/ui/Spark";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtHa, fmtInt, riskLevel } from "@/lib/format";

const TONE = {
  fg: "text-fg1 bg-accent2/10 ring-accent2/25",
  high: "text-risk-high bg-risk-high/10 ring-risk-high/25",
  accent: "text-accent bg-accent/10 ring-accent/25",
  mid: "text-risk-mid bg-risk-mid/10 ring-risk-mid/25",
};
const BAR = { high: "bg-risk-high", mid: "bg-risk-mid", low: "bg-risk-low" };
const TXT = { high: "text-risk-high", mid: "text-risk-mid", low: "text-risk-low" };

export function OverviewCard({ items, onSelect, onDistrict }: { items: Alert[]; onSelect: (id: string) => void; onDistrict: (d: string) => void }) {
  const { t } = useI18n();
  const s = useSummary();
  const d = useDistrictStats();
  const top = items[0];
  const targets = items.slice(0, 3);
  const sparks = {
    fg: quarterlyCumulative(items),
    high: quarterlyCumulative(items, (a) => a.risk_score >= 60),
    accent: quarterlyCumulative(items, (a) => a.zones.length > 0),
    mid: [] as number[],
  };
  const SPARK_COLOR = { fg: "rgb(var(--accent-2))", high: "rgb(var(--risk-high))", accent: "rgb(var(--accent))", mid: "rgb(var(--risk-mid))" };
  const kpis = s.data
    ? ([
        [t("k_total"), s.data.total, ScanSearch, "fg"],
        [t("k_high"), s.data.high_risk, AlertTriangle, "high"],
        [t("k_restricted"), s.data.in_restricted_zone, Layers, "accent"],
        [t("k_pending"), s.data.pending, Clock3, "mid"],
      ] as const)
    : null;
  const maxD = Math.max(1, ...(d.data ?? []).map((x) => x.count));

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent/15 text-accent shadow-[0_0_18px_rgb(var(--accent)/.25)]"><Radar size={17} /></div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-fg1">{t("overview")}</div>
          {s.data && <div className="tnum text-2xs text-fg2">{fmtHa(s.data.area_ha)} {t("ha")} · {t("k_area").toLowerCase()}</div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {kpis
          ? kpis.map(([l, v, I, tone]) => (
              <div key={l} className="relative overflow-hidden rounded-xl border bg-bg2/60 p-3">
                <span className={cn("grid h-7 w-7 place-items-center rounded-lg ring-1 ring-inset", TONE[tone])}><I size={14} /></span>
                {sparks[tone].length > 1 && (
                  <Spark values={sparks[tone]} color={SPARK_COLOR[tone]} className="absolute right-2.5 top-3 h-8 w-[58%] opacity-90" label={`${l}: ${t("spark_hint")}`} />
                )}
                <div className={cn("tnum mt-2 text-[26px] font-bold leading-none", TONE[tone].split(" ")[0])}>{v}</div>
                <div className="mt-1 text-2xs text-fg2">{l}</div>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />)}
      </div>

      <div>
        <div className="section-title mb-2">{t("priority_targets")}</div>
        <div className="space-y-1.5">
          {targets.map((a) => {
            const img = chipUrl(a.chip_after);
            const lvl = riskLevel(a.risk_score);
            return (
              <button key={a.alert_id} onClick={() => onSelect(a.alert_id)} className="group flex w-full items-center gap-3 rounded-xl border bg-bg2/50 p-2 text-left transition hover:border-accent/40 hover:bg-accent/[.06]">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-line/20 bg-bg3">
                  {img && <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />}
                  <span className="absolute inset-1 rounded border border-accent/70 shadow-[0_0_8px_rgb(var(--accent)/.6)]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-xs font-semibold">{a.alert_id}</span>
                    <span className={cn("tnum ml-auto text-sm font-bold", TXT[lvl])}>{Math.round(a.risk_score)}</span>
                  </div>
                  <div className="truncate text-2xs text-fg2">{a.district} · ≈{fmtInt(a.area_m2)} m²</div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-bg3">
                    <div className={cn("h-full rounded-full", BAR[lvl])} style={{ width: `${a.risk_score}%` }} />
                  </div>
                </div>
              </button>
            );
          })}
          {!targets.length && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[66px]" />)}
        </div>
      </div>

      <div>
        <div className="section-title mb-2">{t("top_districts")}</div>
        <div className="space-y-1.5">
          {(d.data ?? []).slice(0, 5).map((x) => (
            <button key={x.district} onClick={() => onDistrict(x.district)} className="group grid w-full grid-cols-[96px_1fr_28px] items-center gap-2 text-left text-xs">
              <span className="truncate text-fg2 group-hover:text-fg1">{x.district}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-bg3">
                <span className="block h-full rounded-full bg-gradient-to-r from-accent2 to-accent shadow-[0_0_8px_rgb(var(--accent)/.5)]" style={{ width: `${(x.count / maxD) * 100}%` }} />
              </span>
              <span className="tnum text-right font-semibold">{x.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-auto">
        <Button variant="primary" size="lg" className="w-full" onClick={() => top && onSelect(top.alert_id)} disabled={!top}>
          {t("start_top")} <ArrowRight size={15} />
        </Button>
      </div>
    </div>
  );
}
