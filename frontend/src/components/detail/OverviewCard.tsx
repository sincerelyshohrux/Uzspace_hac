import { ArrowRight, Radar } from "lucide-react";
import type { Alert } from "@/api/types";
import { useDistrictStats, useSummary } from "@/api/hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { useI18n } from "@/i18n";
import { fmtHa } from "@/lib/format";

export function OverviewCard({ top, onStart, onDistrict }: { top: Alert | undefined; onStart: () => void; onDistrict: (d: string) => void }) {
  const { t } = useI18n();
  const s = useSummary();
  const d = useDistrictStats();
  const kpis = s.data
    ? [
        [t("k_total"), s.data.total, "text-fg1"],
        [t("k_high"), s.data.high_risk, "text-risk-high"],
        [t("k_restricted"), s.data.in_restricted_zone, "text-accent"],
        [t("k_pending"), s.data.pending, "text-risk-mid"],
      ] as const
    : null;
  const maxD = Math.max(1, ...(d.data ?? []).map((x) => x.count));
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"><Radar size={16} /></div>
        <div>
          <div className="text-sm font-semibold">{t("overview")}</div>
          {s.data && <div className="tnum text-2xs text-fg2">{fmtHa(s.data.area_ha)} {t("ha")} · {t("k_area").toLowerCase()}</div>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {kpis
          ? kpis.map(([l, v, c]) => (
              <div key={l} className="rounded-xl border bg-bg2/70 p-3">
                <div className={`tnum text-2xl font-semibold ${c}`}>{v}</div>
                <div className="mt-0.5 text-2xs text-fg2">{l}</div>
              </div>
            ))
          : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px]" />)}
      </div>
      <div>
        <div className="section-title mb-2">{t("top_districts")}</div>
        <div className="space-y-1.5">
          {(d.data ?? []).slice(0, 5).map((x) => (
            <button key={x.district} onClick={() => onDistrict(x.district)} className="group grid w-full grid-cols-[96px_1fr_28px] items-center gap-2 text-left text-xs">
              <span className="truncate text-fg2 group-hover:text-fg1">{x.district}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-bg3">
                <span className="block h-full rounded-full bg-accent2" style={{ width: `${(x.count / maxD) * 100}%` }} />
              </span>
              <span className="tnum text-right font-semibold">{x.count}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-auto">
        <Button variant="primary" size="lg" className="w-full" onClick={onStart} disabled={!top}>
          {t("start_top")} <ArrowRight size={15} />
        </Button>
        {top && <div className="mt-1.5 text-center font-mono text-2xs text-fg3">{top.alert_id} · {Math.round(top.risk_score)}</div>}
      </div>
    </div>
  );
}
