import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { useEffect, useState, type PointerEvent, type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/cn";

function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  useEffect(() => {
    if (reduce) return setV(value);
    const c = animate(0, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1], onUpdate: setV });
    return () => c.stop();
  }, [value, reduce]);
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}</>;
}

/** KPI card: icon tile, count-up value, subtitle, optional sparkline, subtle 3D tilt that follows the pointer. */
export function KpiCard({ icon, label, value, decimals, unit, sub, tone = "accent", spark, className }: {
  icon: ReactNode; label: string; value: number | undefined; decimals?: number; unit?: string; sub?: string;
  tone?: "accent" | "high" | "mid" | "violet" | "blue" | "ok"; spark?: number[]; className?: string;
}) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [6, -6]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-6, 6]), { stiffness: 200, damping: 20 });
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };
  const toneCls = {
    accent: "bg-accent/15 text-accent", high: "bg-risk-high/15 text-risk-high", mid: "bg-risk-mid/15 text-risk-mid",
    violet: "bg-st-confirmed/15 text-st-confirmed", blue: "bg-accent2/15 text-accent2", ok: "bg-ok/15 text-ok",
  }[tone];
  const stroke = { accent: "#22D3EE", high: "#EF4444", mid: "#F59E0B", violet: "#A855F7", blue: "#3B82F6", ok: "#22C55E" }[tone];
  return (
    <div style={{ perspective: 800 }} className={className}>
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={reduce ? undefined : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        whileHover={reduce ? undefined : { y: -2 }}
        className="card relative h-full overflow-hidden p-4 transition-shadow hover:shadow-[0_16px_40px_rgb(0_0_0/.35)]"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: stroke }} />
        <div className="flex items-center gap-2.5">
          <span className={cn("grid h-8 w-8 place-items-center rounded-lg", toneCls)}>{icon}</span>
          <span className="text-xs font-medium text-fg2">{label}</span>
        </div>
        <div className="mt-3 flex items-end justify-between gap-2" style={{ transform: "translateZ(20px)" }}>
          <div>
            <div className="tnum text-[28px] font-semibold leading-none">
              {value == null ? <span className="text-fg3">…</span> : <CountUp value={value} decimals={decimals} />}
              {unit && <span className="ml-1 text-sm font-medium text-fg2">{unit}</span>}
            </div>
            {sub && <div className="mt-1.5 text-2xs text-fg3">{sub}</div>}
          </div>
          {spark && spark.length > 1 && (
            <div className="h-10 w-24">
              <ResponsiveContainer>
                <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id={`sp-${tone}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor={stroke} stopOpacity={0.35} />
                      <stop offset="1" stopColor={stroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area isAnimationActive={false} type="monotone" dataKey="v" stroke={stroke} strokeWidth={1.8} fill={`url(#sp-${tone})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
