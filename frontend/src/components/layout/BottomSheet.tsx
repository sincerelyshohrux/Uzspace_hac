// Draggable bottom sheet over the map (mobile): peek / half / full snap points.
// Only the grab handle starts a drag, so the list inside keeps its own scrolling.
import { animate, motion, useDragControls, useMotionValue, useReducedMotion } from "motion/react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Snap = "peek" | "half" | "full";

export function BottomSheet({ snap, onSnap, header, children, label, peek = 132 }: {
  snap: Snap;
  onSnap: (s: Snap) => void;
  header?: ReactNode;
  children: ReactNode;
  label: string;
  peek?: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [H, setH] = useState(0); // container height
  const y = useMotionValue(0);
  const controls = useDragControls();
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const el = wrap.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight));
    ro.observe(el);
    setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const full = Math.max(0, H - 12); // sheet height
  const offsets: Record<Snap, number> = { full: 0, half: Math.round(full * 0.48), peek: Math.max(0, full - peek) };

  useEffect(() => {
    if (!H) return;
    const c = animate(y, offsets[snap], reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 42 });
    return () => c.stop();
  }, [snap, H]); // eslint-disable-line react-hooks/exhaustive-deps

  const settle = (velocity: number) => {
    const cur = y.get() + velocity * 0.18; // project the fling a little
    const best = (Object.keys(offsets) as Snap[]).reduce((a, b) => (Math.abs(offsets[b] - cur) < Math.abs(offsets[a] - cur) ? b : a));
    if (best === snap) animate(y, offsets[best], { type: "spring", stiffness: 420, damping: 42 });
    onSnap(best);
  };

  const cycle = () => onSnap(snap === "peek" ? "half" : snap === "half" ? "full" : "peek");

  return (
    <motion.section
      ref={wrap}
      aria-label={label}
      className="glass absolute inset-x-0 bottom-0 z-30 flex flex-col overflow-hidden rounded-t-[20px] border-b-0"
      style={{ height: full || "60%", y }}
      drag="y"
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ top: 0, bottom: offsets.peek }}
      dragElastic={0.06}
      dragMomentum={false}
      onDragEnd={(_, info) => settle(info.velocity.y)}
    >
      <div
        className="shrink-0 cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <button
          type="button"
          onClick={cycle}
          className="mx-auto flex h-6 w-full items-center justify-center"
          aria-label={label}
          aria-expanded={snap !== "peek"}
        >
          <span className={cn("h-1.5 w-11 rounded-full bg-fg3/50 transition-colors", snap === "full" && "bg-accent/70")} />
        </button>
        {header}
      </div>
      {/* keep the visible part scrollable: the off-screen part of the sheet is padded away */}
      <div className="min-h-0 flex-1" style={{ paddingBottom: snap === "full" ? 0 : offsets[snap] }}>{children}</div>
    </motion.section>
  );
}
