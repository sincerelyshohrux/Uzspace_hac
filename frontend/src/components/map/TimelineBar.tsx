import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Alert } from "@/api/types";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { fmtMonth } from "@/lib/format";

const MONTHS: string[] = [];
for (let y = 2023; y <= 2025; y++) for (let m = 1; m <= 12; m++) MONTHS.push(`${y}-${String(m).padStart(2, "0")}`);

/** "Time machine": filters alerts to start_month ≤ selected month. Histogram shows detections per month. */
export function TimelineBar({ alerts, month, onMonth, className }: { alerts: Alert[]; month: string | null; onMonth: (m: string | null) => void; className?: string }) {
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
    <div className={cn("glass flex items-center gap-3 rounded-2xl px-3 py-2", className)}>
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
  );
}
