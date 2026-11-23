import { motion, useReducedMotion } from "motion/react";
import type { RiskBreakdown } from "@/api/types";
import { useI18n } from "@/i18n";

export function FactorBars({ risk, score }: { risk: RiskBreakdown; score: number }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const rows = [
    [t("rf_confidence"), risk.confidence],
    [t("rf_zone"), risk.zone_weight],
    [t("rf_area"), risk.area_factor],
    [t("rf_permit"), risk.permit_factor],
  ] as const;
  return (
    <div>
      <div className="space-y-2">
        {rows.map(([label, v], i) => (
          <div key={label}>
            <div className="flex justify-between text-xs">
              <span className="text-fg2">{label}</span>
              <span className="tnum font-semibold">{Math.round(v * 100)}%</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-bg3">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent2 to-accent"
                initial={{ width: reduce ? `${v * 100}%` : 0 }}
                animate={{ width: `${v * 100}%` }}
                transition={{ duration: 0.5, delay: reduce ? 0 : 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 rounded-lg border bg-bg2 px-2.5 py-1.5 font-mono text-[11px] text-fg2">
        100 × {risk.confidence.toFixed(2)} × {risk.zone_weight.toFixed(2)} × {risk.area_factor.toFixed(2)} × {risk.permit_factor.toFixed(2)} = <b className="text-fg1">{Math.round(score)}</b>
      </p>
    </div>
  );
}
