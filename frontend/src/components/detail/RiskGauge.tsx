import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/i18n";
import { riskHex, riskLevel } from "@/lib/format";

/** Semicircle gauge 0–100, arc draws in and the number counts up. */
export function RiskGauge({ score, confidence }: { score: number; confidence: number }) {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const R = 54;
  const C = Math.PI * R;
  const v = useMotionValue(reduce ? score : 0);
  const dash = useTransform(v, (x) => `${(x / 100) * C} ${C}`);
  const [shown, setShown] = useState(reduce ? score : 0);
  useEffect(() => {
    if (reduce) {
      v.set(score);
      setShown(score);
      return;
    }
    v.set(0);
    const c = animate(v, score, { duration: 0.7, ease: [0.22, 1, 0.36, 1], onUpdate: (x) => setShown(Math.round(x)) });
    return () => c.stop();
  }, [score, reduce, v]);
  const color = riskHex(score);
  const lvl = riskLevel(score);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[74px] w-[132px] shrink-0">
        <svg viewBox="0 0 132 74" className="h-full w-full" aria-hidden>
          <defs>
            <linearGradient id="gauge-g" x1="0" x2="1">
              <stop offset="0" stopColor="#EAB308" />
              <stop offset=".55" stopColor="#F59E0B" />
              <stop offset="1" stopColor="#EF4444" />
            </linearGradient>
          </defs>
          <path d="M 12 66 A 54 54 0 0 1 120 66" fill="none" stroke="rgb(var(--line) / .14)" strokeWidth="10" strokeLinecap="round" />
          <motion.path d="M 12 66 A 54 54 0 0 1 120 66" fill="none" stroke="url(#gauge-g)" strokeWidth="10" strokeLinecap="round" style={{ strokeDasharray: dash }} />
          {[30, 60].map((k) => {
            const a = Math.PI * (1 - k / 100);
            return <line key={k} x1={66 + 44 * Math.cos(a)} y1={66 - 44 * Math.sin(a)} x2={66 + 38 * Math.cos(a)} y2={66 - 38 * Math.sin(a)} stroke="rgb(var(--fg-3))" strokeWidth="1.5" />;
          })}
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="tnum text-[28px] font-bold leading-none" style={{ color }}>{shown}</span>
          <span className="text-xs text-fg3">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color }}>{t(`risk_${lvl}`)}</div>
        <div className="mt-0.5 text-xs text-fg2">{t("model_conf", { p: Math.round(confidence * 100) })}</div>
        <div className="mt-2 h-1.5 w-28 overflow-hidden rounded-full bg-bg3">
          <motion.div className="h-full rounded-full bg-accent" initial={{ width: reduce ? `${confidence * 100}%` : 0 }} animate={{ width: `${confidence * 100}%` }} transition={{ duration: 0.6, delay: 0.15 }} />
        </div>
      </div>
    </div>
  );
}
