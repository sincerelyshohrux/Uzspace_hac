import { motion, useReducedMotion } from "motion/react";
import type { Alert } from "@/api/types";
import { useI18n, type I18nKey } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtInt } from "@/lib/format";

/** Each factor of the risk score with the reason behind it, then the exact formula. */
export function FactorBars({ a }: { a: Alert }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { risk } = a;
  const zones = a.zones.map((z) => t(`z_${z}` as I18nKey)).join(", ");
  const rows = [
    { label: t("rf_confidence"), v: risk.confidence, why: t("fx_conf", { p: Math.round(risk.confidence * 100) }) },
    { label: t("rf_zone"), v: risk.zone_weight, why: a.zones.length ? t("fx_zone", { zone: zones }) : t("fx_nozone"), warn: !!a.zones.length },
    { label: t("rf_area"), v: risk.area_factor, why: t("fx_area", { a: fmtInt(a.area_m2) }) },
    { label: t("rf_permit"), v: risk.permit_factor, why: t(`fx_permit_${a.permit_match}` as I18nKey), muted: a.permit_match === "no_data" },
  ];
  return (
    <div>
      <div className="section-title mb-2">{t("fx_title")}</div>
      <div className="space-y-2.5">
        {rows.map((r, i) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="font-medium text-fg1">{r.label}</span>
              <span className="tnum font-mono font-semibold">×{r.v.toFixed(2)}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg3">
              <motion.div
                className={cn("h-full rounded-full", r.warn ? "bg-risk-high" : r.muted ? "bg-fg3/50" : "bg-accent")}
                initial={{ width: reduce ? `${r.v * 100}%` : 0 }}
                animate={{ width: `${r.v * 100}%` }}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
            <div className="mt-0.5 text-2xs text-fg2">{r.why}</div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg border bg-bg2 px-2.5 py-1.5 font-mono text-[11px] text-fg2">
        100 × {risk.confidence.toFixed(2)} × {risk.zone_weight.toFixed(2)} × {risk.area_factor.toFixed(2)} × {risk.permit_factor.toFixed(2)} = <b className="text-fg1">{Math.round(a.risk_score)}</b>
      </p>
      <p className="mt-1.5 text-2xs text-fg3">{t("fx_note")}</p>
    </div>
  );
}
