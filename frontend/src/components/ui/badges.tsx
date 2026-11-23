import { Building2, Hammer, Shovel } from "lucide-react";
import type { ChangeType, Status, Zone } from "@/api/types";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { riskLevel, ZONE_HEX } from "@/lib/format";

const RISK_CLS = {
  high: "bg-risk-high/15 text-risk-high ring-risk-high/30",
  mid: "bg-risk-mid/15 text-risk-mid ring-risk-mid/30",
  low: "bg-risk-low/15 text-risk-low ring-risk-low/30",
};

export function RiskTile({ score, className }: { score: number; className?: string }) {
  const { t } = useI18n();
  const lvl = riskLevel(score);
  return (
    <div className={cn("flex w-11 shrink-0 flex-col items-center justify-center rounded-lg py-1 ring-1 ring-inset", RISK_CLS[lvl], className)} aria-label={`Risk ${score}, ${t(`lvl_${lvl}`)}`}>
      <span className="tnum text-base font-bold leading-none">{Math.round(score)}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide opacity-90">{t(`lvl_${lvl}`)}</span>
    </div>
  );
}

const ST_CLS: Record<Status, string> = {
  new: "bg-st-new/12 text-st-new ring-st-new/25",
  in_review: "bg-st-review/15 text-st-review ring-st-review/30",
  confirmed: "bg-st-confirmed/15 text-st-confirmed ring-st-confirmed/30",
  false_positive: "bg-st-fp/15 text-fg2 ring-st-fp/30 line-through decoration-fg3/50",
};
export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const { t } = useI18n();
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-2xs font-semibold ring-1 ring-inset", ST_CLS[status], className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-current no-underline" />
      {t(`st_${status}` as I18nKey)}
    </span>
  );
}

export function ZoneChip({ zone, compact }: { zone: Zone; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border bg-bg2 px-1.5 py-0.5 text-2xs text-fg1">
      <span className="h-2 w-2 rounded-sm" style={{ background: ZONE_HEX[zone] }} />
      {compact ? t(`z_${zone}` as I18nKey).split(" ")[0] : t(`z_${zone}` as I18nKey)}
    </span>
  );
}

export function ChangeIcon({ type, size = 14, className }: { type: ChangeType; size?: number; className?: string }) {
  const I = type === "new_construction" ? Building2 : type === "land_clearing" ? Shovel : Hammer;
  return <I size={size} className={className} aria-hidden />;
}
