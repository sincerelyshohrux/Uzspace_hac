import { useId } from "react";

/** Tiny area sparkline (no axes). `values` are plotted left to right. */
export function Spark({ values, color = "rgb(var(--accent))", className, label }: { values: number[]; color?: string; className?: string; label?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const w = 100;
  const h = 32;
  const max = Math.max(...values) || 1;
  const min = Math.min(...values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * w, h - 2 - ((v - min) / (max - min || 1)) * (h - 6)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={className} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill={`url(#sg-${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r="2.2" fill={color} />
    </svg>
  );
}

/** Cumulative count per calendar quarter, from alerts' start months. */
export function quarterlyCumulative<T extends { start_month: string | null }>(items: T[], pick: (a: T) => boolean = () => true): number[] {
  const months = items.map((a) => a.start_month).filter(Boolean).sort() as string[];
  if (!months.length) return [];
  const q = (m: string) => Number(m.slice(0, 4)) * 4 + Math.floor((Number(m.slice(5, 7)) - 1) / 3);
  const q0 = q(months[0]);
  const q1 = q(months.at(-1)!);
  const out = Array.from({ length: q1 - q0 + 1 }, () => 0);
  items.forEach((a) => a.start_month && pick(a) && out[q(a.start_month) - q0]++);
  for (let i = 1; i < out.length; i++) out[i] += out[i - 1];
  return out;
}
