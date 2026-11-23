import { motion } from "motion/react";
import { FileCheck2, FileQuestion, FileWarning, FileX2 } from "lucide-react";
import { forwardRef } from "react";
import type { Alert } from "@/api/types";
import { RiskTile, StatusBadge, ZoneChip, ChangeIcon } from "@/components/ui/badges";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtInt, fmtMonth, riskLevel } from "@/lib/format";

const PERMIT_ICON = { none: FileX2, partial: FileWarning, matched: FileCheck2, no_data: FileQuestion };
const PERMIT_CLS = { none: "text-risk-high", partial: "text-risk-mid", matched: "text-ok", no_data: "text-fg3" };
const BAR = { high: "bg-risk-high", mid: "bg-risk-mid", low: "bg-risk-low" };

interface Props {
  a: Alert;
  index: number;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (h: boolean) => void;
  animate: boolean;
}

export const AlertRow = forwardRef<HTMLLIElement, Props>(function AlertRow({ a, index, selected, hovered, onSelect, onHover, animate }, ref) {
  const { t, lang } = useI18n();
  const P = PERMIT_ICON[a.permit_match];
  return (
    <motion.li
      ref={ref}
      layout={animate ? "position" : false}
      custom={index}
      initial={animate ? { opacity: 0, x: -6 } : false}
      animate={{ opacity: 1, x: 0, transition: { delay: animate ? Math.min(index, 12) * 0.02 : 0, duration: 0.2 } }}
      role="option"
      aria-selected={selected}
      id={`row-${a.alert_id}`}
      onClick={onSelect}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "group relative flex cursor-pointer gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-[background,border,box-shadow,transform] duration-150",
        selected ? "border-accent/60 bg-accent/[.09] shadow-glow" : hovered ? "-translate-y-px border-line-strong/25 bg-bg3/60" : "border-transparent hover:-translate-y-px hover:border-line-strong/20 hover:bg-bg3/50",
      )}
    >
      <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r", BAR[riskLevel(a.risk_score)])} />
      <RiskTile score={a.risk_score} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12.5px] font-medium">{a.alert_id}</span>
          <StatusBadge status={a.status} className="ml-auto" />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg2">
          <ChangeIcon type={a.change_type} size={12} />
          <span className="truncate">{a.district}</span>
          <span className="text-fg3">·</span>
          <span className="tnum whitespace-nowrap">≈{fmtInt(a.area_m2)} m²</span>
          <span className="text-fg3">·</span>
          <span className="tnum whitespace-nowrap">{fmtMonth(a.start_month, lang, true)}</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          {a.zones.slice(0, 2).map((z) => <ZoneChip key={z} zone={z} compact />)}
          {a.zones.length > 2 && <span className="text-2xs text-fg3">+{a.zones.length - 2}</span>}
          {!a.zones.length && <span className="text-2xs text-fg3">{t("no_zone")}</span>}
          <span className="ml-auto h-1 w-14 overflow-hidden rounded-full bg-bg3" aria-hidden>
            <span className={cn("block h-full rounded-full", BAR[riskLevel(a.risk_score)])} style={{ width: `${a.risk_score}%` }} />
          </span>
          <span className={cn(PERMIT_CLS[a.permit_match])} title={t(`pm_${a.permit_match}`)}>
            <P size={14} aria-label={t(`pm_${a.permit_match}`)} />
          </span>
        </div>
      </div>
    </motion.li>
  );
});
