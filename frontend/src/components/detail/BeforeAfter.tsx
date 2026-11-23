import { ChevronsLeftRight } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Alert } from "@/api/types";
import { Segmented } from "@/components/ui/segmented";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { ringToChip } from "@/lib/geo";

type Mode = "slider" | "side" | "blink";

function Outline({ a }: { a: Alert }) {
  const pts = ringToChip(a.geometry.coordinates[0], a.lon, a.lat, a.area_m2).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 256 256" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <polygon points={pts} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="5 3" />
    </svg>
  );
}

function Img({ src, label, a, demo }: { src: string | null; label: string; a: Alert; demo: boolean }) {
  return (
    <div className="absolute inset-0">
      {src ? <img src={src} alt={label} className="h-full w-full select-none object-cover [image-rendering:auto]" draggable={false} /> : <div className="h-full w-full bg-bg3" />}
      <Outline a={a} />
      {demo && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1 text-[9px] font-semibold tracking-wider text-white/90">DEMO</span>}
    </div>
  );
}

export function BeforeAfter({ a, before, after, demo }: { a: Alert; before: string | null; after: string | null; demo: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("slider");
  const [pos, setPos] = useState(50);
  const [blinkB, setBlinkB] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => setPos(50), [a.alert_id]);
  useEffect(() => {
    if (mode !== "blink") return;
    const id = setInterval(() => setBlinkB((b) => !b), 800);
    return () => clearInterval(id);
  }, [mode]);

  const move = (e: PointerEvent) => {
    if (!dragging.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 5));
    if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 5));
  };
  const L1 = `T1 · 2023`;
  const L2 = `T2 · 2025`;
  const tag = "absolute top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="section-title">{t("compare")}</span>
        <Segmented
          size="xs"
          label={t("compare")}
          value={mode}
          onChange={setMode}
          options={[{ value: "slider", label: t("cmp_slider") }, { value: "side", label: t("cmp_side") }, { value: "blink", label: t("cmp_blink") }]}
        />
      </div>
      {mode === "side" ? (
        <div className="grid grid-cols-2 gap-1.5">
          {[[before, L1], [after, L2]].map(([src, l]) => (
            <div key={l} className="relative aspect-square overflow-hidden rounded-xl border">
              <Img src={src} label={l as string} a={a} demo={demo} />
              <span className={cn(tag, "left-2")}>{l}</span>
            </div>
          ))}
        </div>
      ) : mode === "blink" ? (
        <div className="relative aspect-square overflow-hidden rounded-xl border">
          <Img src={blinkB ? before : after} label={blinkB ? L1 : L2} a={a} demo={demo} />
          <span className={cn(tag, "left-2", !blinkB && "bg-accent/80 text-bg0")}>{blinkB ? L1 : L2}</span>
        </div>
      ) : (
        <div
          ref={box}
          className="relative aspect-square touch-none select-none overflow-hidden rounded-xl border"
          onPointerDown={(e) => {
            dragging.current = true;
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            move(e);
          }}
          onPointerMove={move}
          onPointerUp={() => (dragging.current = false)}
        >
          <Img src={after} label={L2} a={a} demo={demo} />
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            <Img src={before} label={L1} a={a} demo={false} />
          </div>
          <span className={cn(tag, "left-2")}>{L1}</span>
          <span className={cn(tag, "right-2")}>{L2}</span>
          <div className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,.5)]" style={{ left: `calc(${pos}% - 1px)` }}>
            <button
              role="slider"
              aria-label={t("compare")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              onKeyDown={key}
              className="absolute left-1/2 top-1/2 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center rounded-full border-2 border-white bg-black/50 text-white backdrop-blur"
            >
              <ChevronsLeftRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
