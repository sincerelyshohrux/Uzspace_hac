import { motion } from "motion/react";
import { Check, FileCheck2, FileQuestion, FileWarning, FileX2 } from "lucide-react";
import { forwardRef, useState } from "react";
import type { Alert } from "@/api/types";
import { chipUrl } from "@/api/client";
import { RiskTile, StatusBadge, ZoneChip, ChangeIcon } from "@/components/ui/badges";
import { useI18n, type I18nKey } from "@/i18n";
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
  /** multi-select for bulk actions */
  checked: boolean;
  selecting: boolean;
  onCheck: (v: boolean) => void;
}

export const AlertRow = forwardRef<HTMLLIElement, Props>(function AlertRow(
  { a, index, selected, hovered, onSelect, onHover, animate, checked, selecting, onCheck },
  ref,
) {
  const { t, lang } = useI18n();
  const P = PERMIT_ICON[a.permit_match];
  const thumb = chipUrl(a.chip_after);
  const [imgOk, setImgOk] = useState(true);
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
      onClick={(e) => (selecting || e.shiftKey || e.metaKey || e.ctrlKey ? onCheck(!checked) : onSelect())}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      className={cn(
        "group relative flex cursor-pointer items-stretch gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 transition-[background,border,box-shadow,transform] duration-150",
        checked
          ? "border-accent2/50 bg-accent2/[.08]"
          : selected
            ? "border-accent/60 bg-accent/[.09] shadow-glow"
            : hovered
              ? "-translate-y-px border-line-strong/25 bg-bg3/60"
              : "border-transparent hover:-translate-y-px hover:border-line-strong/20 hover:bg-bg3/50",
      )}
    >
      <span className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r", BAR[riskLevel(a.risk_score)])} />
      <div className="relative">
        <RiskTile score={a.risk_score} className="h-full min-h-[52px]" />
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={t("select_alert", { id: a.alert_id })}
          onClick={(e) => {
            e.stopPropagation();
            onCheck(!checked);
          }}
          className={cn(
            "absolute -left-1 -top-1 grid h-[18px] w-[18px] place-items-center rounded-[5px] border bg-bg1 text-white shadow transition-opacity",
            checked ? "border-accent2 bg-accent2 opacity-100" : selecting ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          )}
        >
          {checked && <Check size={12} strokeWidth={3} />}
        </button>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[12.5px] font-medium">{a.alert_id}</span>
          <StatusBadge status={a.status} className="ml-auto" />
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-fg2">
          <ChangeIcon type={a.change_type} size={12} className="shrink-0" />
          <span className="truncate" title={a.district}>{a.district}</span>
          <span className="tnum ml-auto shrink-0 whitespace-nowrap">≈{fmtInt(a.area_m2)} m²</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          {a.zones.slice(0, 2).map((z) => <ZoneChip key={z} zone={z} compact />)}
          {a.zones.length > 2 && (
            <span className="text-2xs text-fg3" title={a.zones.slice(2).map((z) => t(`z_${z}` as I18nKey)).join(", ")}>+{a.zones.length - 2}</span>
          )}
          {!a.zones.length && <span className="text-2xs text-fg3">{t("no_zone")}</span>}
          <span className="tnum ml-auto whitespace-nowrap text-2xs text-fg3">{fmtMonth(a.start_month, lang, true)}</span>
          <span className={cn(PERMIT_CLS[a.permit_match])} title={t(`pm_${a.permit_match}`)}>
            <P size={14} aria-label={t(`pm_${a.permit_match}`)} />
          </span>
        </div>
      </div>
      {thumb && imgOk && (
        <div className="relative hidden w-[46px] shrink-0 overflow-hidden rounded-lg border border-line/20 bg-bg3 min-[400px]:block" aria-hidden>
          <img src={thumb} alt="" loading="lazy" decoding="async" onError={() => setImgOk(false)} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
          <span className="absolute inset-[5px] rounded-[3px] border border-accent/80" />
        </div>
      )}
    </motion.li>
  );
});
