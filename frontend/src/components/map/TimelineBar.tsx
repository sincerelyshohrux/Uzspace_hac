import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Alert } from "@/api/types";
import { chipUrl } from "@/api/client";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtMonth } from "@/lib/format";

const MONTHS: string[] = [];
for (let y = 2023; y <= 2025; y++) for (let m = 1; m <= 12; m++) MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);

const QUARTERS = Array.from({ length: MONTHS.length / 3 }, (_, q) => ({
  label: `Q${(q % 4) + 1} '${MONTHS[q * 3].slice(2, 4)}`,
  months: MONTHS.slice(q * 3, q * 3 + 3),
  end: q * 3 + 2,
}));

/** "Time machine": filters alerts to start_month ≤ selected month. Histogram shows detections per month. */
export function TimelineBar({ alerts, month, onMonth, strip = false, className }: { alerts: Alert[]; month: string | null; onMonth: (m: string | null) => void; strip?: boolean; className?: string }) {
  const { t, lang } = useI18n();
  const [playing, setPlaying] = useState(false);
  const idx = month ? MONTHS.indexOf(month) : MONTHS.length - 1;
  const counts = useMemo(() => {
    const c = new Array(MONTHS.length).fill(0) as number[];
    alerts.forEach((a) => {
      const i = a.start_month ? MONTHS.indexOf(a.start_month) : -1;
      if (i >= 0) c[i]++;
    });
    return c;
  }, [alerts]);
  const max = Math.max(1, ...counts);
  const quarters = useMemo(
    () =>
      QUARTERS.map((q) => {
        const inQ = alerts.filter((a) => a.start_month && q.months.includes(a.start_month));
        const top = inQ.reduce<Alert | undefined>((b, a) => (!b || a.risk_score > b.risk_score ? a : b), undefined);
        return { ...q, n: inQ.length, img: top ? chipUrl(top.chip_after) : null };
      }),
    [alerts],
  );
  const cum = counts.slice(0, idx + 1).reduce((s, v) => s + v, 0);
  const timer = useRef<number>();

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      const cur = month ? MONTHS.indexOf(month) : -1;
      const next = cur + 1;
      if (next >= MONTHS.length - 1) {
        onMonth(null);
        setPlaying(false);
      } else onMonth(MONTHS[next]);
    }, 450);
    return () => window.clearInterval(timer.current);
  }, [playing, month, onMonth]);

  const play = () => {
    if (playing) return setPlaying(false);
    if (!month) onMonth(MONTHS[0]);
    setPlaying(true);
  };

  return (
    <div className={cn("glass rounded-2xl px-3 py-2", className)}>
      {strip && (
        <div className="mb-2 grid grid-cols-12 gap-1.5 border-b border-line/10 pb-2">
          {quarters.map((q, i) => {
            const active = idx >= q.end - 2 && idx <= q.end;
            const future = q.end - 2 > idx;
            return (
              <button
                key={q.label}
                onClick={() => { setPlaying(false); onMonth(i === quarters.length - 1 ? null : MONTHS[q.end]); }}
                className={cn(
                  "group relative aspect-square overflow-hidden rounded-md border bg-bg3 transition",
                  active ? "border-accent shadow-[0_0_12px_rgb(var(--accent)/.6)]" : "border-line/20 hover:border-accent/50",
                  future && "opacity-40 grayscale",
                )}
                title={`${q.label}: ${q.n}`}
              >
                {q.img && <img src={q.img} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-110" />}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-1 pb-0.5 pt-2 text-left text-[9px] font-semibold leading-none text-white">{q.label}</span>
                {q.n > 0 && <span className={cn("tnum absolute right-0.5 top-0.5 rounded px-1 text-[9px] font-bold leading-[13px]", active ? "bg-accent text-bg0" : "bg-black/70 text-white")}>{q.n}</span>}
              </button>
            );
          })}
        </div>
      )}
    <div className="flex items-center gap-3">
      <Tip label={playing ? t("pause") : t("play")}>
        <button onClick={play} aria-label={playing ? t("pause") : t("play")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-bg0 shadow-[0_0_18px_rgb(var(--accent)/.45)] transition hover:brightness-110 active:scale-95">
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" className="translate-x-px" />}
        </button>
      </Tip>
      <div className="min-w-0 flex-1">
        <div className="relative h-7">
          <div className="absolute inset-x-0 bottom-0 flex h-full items-end gap-[2px]">
            {counts.map((c, i) => (
              <div
                key={MONTHS[i]}
                className={cn("flex-1 rounded-t-sm transition-colors", i <= idx ? "bg-accent/70" : "bg-fg3/25")}
                style={{ height: `${c ? 18 + (c / max) * 82 : 6}%` }}
                title={`${fmtMonth(MONTHS[i], lang)}: ${c}`}
              />
            ))}
          </div>
        </div>
        <input
          type="range"
          min={0}
          max={MONTHS.length - 1}
          value={idx}
          aria-label={t("timeline")}
          aria-valuetext={fmtMonth(MONTHS[idx], lang)}
          onChange={(e) => {
            setPlaying(false);
            const i = Number(e.target.value);
            onMonth(i >= MONTHS.length - 1 ? null : MONTHS[i]);
          }}
          className="mt-1 block h-1.5 w-full cursor-pointer appearance-none rounded-full bg-bg3 accent-cyan-400 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgb(var(--accent))]"
        />
        <div className="mt-1 flex justify-between text-[10px] text-fg3">
          {["2023-01", "2023-07", "2024-01", "2024-07", "2025-01", "2025-07", "2025-12"].map((m) => (
            <span key={m} className={cn("tnum", m.endsWith("-07") && "hidden sm:inline")}>{fmtMonth(m, lang, true)}</span>
          ))}
        </div>
      </div>
      <div className="w-[92px] shrink-0 text-right">
        <div className="tnum text-sm font-semibold">{month ? fmtMonth(month, lang) : t("all_time")}</div>
        <div className="tnum text-2xs text-fg2">{t("alerts_n", { n: cum })}</div>
      </div>
      {month && (
        <Tip label={t("reset")}>
          <button onClick={() => { setPlaying(false); onMonth(null); }} className="grid h-8 w-8 place-items-center rounded-lg text-fg2 hover:bg-bg3 hover:text-fg1" aria-label={t("reset")}>
            <RotateCcw size={14} />
          </button>
        </Tip>
      )}
    </div>
    </div>
  );
}
