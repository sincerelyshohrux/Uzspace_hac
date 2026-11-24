import { ChevronsLeftRight, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Alert } from "@/api/types";
import { Segmented } from "@/components/ui/segmented";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { chipExtentM, ringToChip } from "@/lib/geo";
import { WAYBACK, waybackTiles } from "@/lib/wayback";

type Mode = "slider" | "side" | "blink";
type Source = "hires" | "s2";
type Side = "t1" | "t2";

function Outline({ a }: { a: Alert }) {
  const pts = ringToChip(a.geometry.coordinates[0], a.lon, a.lat, a.area_m2).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox="0 0 256 256" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <polygon points={pts} fill="none" stroke="#22D3EE" strokeWidth="2" strokeDasharray="5 3" />
    </svg>
  );
}

/** High-resolution Esri Wayback mosaic over the same square as the Sentinel-2 chip. */
function HiRes({ a, side, label, onFail }: { a: Alert; side: Side; label: string; onFail: () => void }) {
  const tiles = waybackTiles(WAYBACK[side].release, a.lon, a.lat, chipExtentM(a.area_m2));
  return (
    <div className="absolute inset-0 overflow-hidden bg-bg3" role="img" aria-label={label}>
      {tiles.map((tl) => (
        <img
          key={tl.key}
          src={tl.src}
          alt=""
          draggable={false}
          onError={onFail}
          className="absolute max-w-none select-none"
          style={{ left: `${tl.left}%`, top: `${tl.top}%`, width: `${tl.size}%`, height: `${tl.size}%` }}
        />
      ))}
    </div>
  );
}

function Img({ src, label, a, demo, source, side, onFail }: { src: string | null; label: string; a: Alert; demo: boolean; source: Source; side: Side; onFail: () => void }) {
  return (
    <div className="absolute inset-0">
      {source === "hires" ? (
        <HiRes a={a} side={side} label={label} onFail={onFail} />
      ) : src ? (
        <img src={src} alt={label} className="h-full w-full select-none object-cover [image-rendering:auto]" draggable={false} />
      ) : (
        <div className="h-full w-full bg-bg3" />
      )}
      <Outline a={a} />
      {demo && source === "s2" && <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1 text-[9px] font-semibold tracking-wider text-white/90">DEMO</span>}
    </div>
  );
}

export function BeforeAfter({ a, before, after, demo }: { a: Alert; before: string | null; after: string | null; demo: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("slider");
  // Demo alerts are synthetic, so real high-resolution imagery would not match them
  const [source, setSource] = useState<Source>(demo ? "s2" : "hires");
  const [failed, setFailed] = useState(false);
  const fail = () => setFailed(true);
  const [pos, setPos] = useState(50);
  const [blinkB, setBlinkB] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const on = () => setFs(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = () =>
    (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch(() => undefined);

  useEffect(() => setPos(50), [a.alert_id]);
  useEffect(() => setFailed(false), [a.alert_id, source]);
  useEffect(() => setSource(demo ? "s2" : "hires"), [demo]);
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
    if (e.key === "Home") setPos(0);
    if (e.key === "End") setPos(100);
  };
  const hi = source === "hires";
  const L1 = hi ? `2023 · ${WAYBACK.t1.label}` : `T1 · 2023`;
  const L2 = hi ? `2025 · ${WAYBACK.t2.label}` : `T2 · 2025`;
  const pic = (side: Side, src: string | null, label: string, d = demo) => <Img src={src} label={label} a={a} demo={d} source={source} side={side} onFail={fail} />;
  const tag = "absolute top-2 z-10 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur";

  return (
    <div ref={root} className={cn(fs && "flex flex-col items-center justify-center bg-bg0 p-4")}>
      <div className={cn(fs && "w-[min(86vh,92vw)]")}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="section-title">{t("compare")}</span>
        <Segmented
          size="xs"
          label={t("img_source")}
          value={source}
          onChange={setSource}
          options={[{ value: "hires", label: t("src_hires") }, { value: "s2", label: t("src_s2") }]}
        />
      </div>
      <div className="mb-2 flex items-center justify-end gap-1.5">
        <button onClick={toggleFs} className="grid h-7 w-7 place-items-center rounded-md border text-fg2 hover:bg-bg3 hover:text-fg1" aria-label={t("fullscreen")} title={t("fullscreen")}>
          {fs ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
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
              {pic(l === L1 ? "t1" : "t2", src, l as string)}
              <span className={cn(tag, "left-2")}>{l}</span>
            </div>
          ))}
        </div>
      ) : mode === "blink" ? (
        <div className="relative aspect-square overflow-hidden rounded-xl border">
          {pic(blinkB ? "t1" : "t2", blinkB ? before : after, blinkB ? L1 : L2)}
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
          {pic("t2", after, L2)}
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
            {pic("t1", before, L1, false)}
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
      <p className="mt-1.5 text-[10.5px] leading-snug text-fg3">
        {hi ? (failed ? t("hires_fail") : t("hires_note")) : t("s2_note")}
      </p>
      </div>
    </div>
  );
}
