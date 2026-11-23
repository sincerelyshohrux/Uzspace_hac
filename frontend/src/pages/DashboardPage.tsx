import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { List } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Alert } from "@/api/types";
import { useAlerts, useDistrictLayer, useMeta, useZones } from "@/api/hooks";
import { getMine, loadLayers, saveLayers, useAppState, type LayerPrefs, type QueueTab } from "@/app/state";
import { useBreakpoint } from "@/app/useMedia";
import { AlertQueue } from "@/components/alerts/AlertQueue";
import { DetailPanel } from "@/components/detail/DetailPanel";
import { OverviewCard } from "@/components/detail/OverviewCard";
import { Legend } from "@/components/map/Legend";
import { MapControls } from "@/components/map/MapControls";
import { MapView, type MapHandle } from "@/components/map/MapView";
import { TimelineBar } from "@/components/map/TimelineBar";
import { Button } from "@/components/ui/button";
import { Dialog, SheetContent } from "@/components/ui/dialog";
import { spring } from "@/lib/motion";
import { useI18n } from "@/i18n";

const QW = 360; // queue width
const DW = 420; // detail width
const GAP = 12;

export function DashboardPage({ searchRef }: { searchRef: React.RefObject<HTMLInputElement> }) {
  const { t } = useI18n();
  const { s, set, setFilters, resetFilters, select } = useAppState();
  const bp = useBreakpoint();
  const reduce = !!useReducedMotion();
  const meta = useMeta();
  const zones = useZones();
  const districts = useDistrictLayer();
  const q = useAlerts(s.filters);
  const mapRef = useRef<MapHandle>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [layers, setLayersState] = useState<LayerPrefs>(loadLayers);
  const [queueOpen, setQueueOpen] = useState(false);
  const setLayers = (l: LayerPrefs) => {
    setLayersState(l);
    saveLayers(l);
  };

  // filters (server) -> timeline cap -> queue tab -> sort
  const capped = useMemo<Alert[]>(() => {
    const items = q.data?.items ?? [];
    return s.month ? items.filter((a) => a.start_month && a.start_month <= s.month!) : items;
  }, [q.data, s.month]);
  const mine = useMemo(() => getMine(), [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const counts = useMemo<Record<QueueTab, number>>(
    () => ({
      all: capped.length,
      critical: capped.filter((a) => a.risk_score >= 60).length,
      review: capped.filter((a) => a.status === "in_review").length,
      mine: capped.filter((a) => mine.has(a.alert_id)).length,
    }),
    [capped, mine],
  );
  const items = useMemo(() => {
    let r = capped;
    if (s.queue === "critical") r = r.filter((a) => a.risk_score >= 60);
    if (s.queue === "review") r = r.filter((a) => a.status === "in_review");
    if (s.queue === "mine") r = r.filter((a) => mine.has(a.alert_id));
    const sorted = [...r];
    if (s.sort === "area") sorted.sort((a, b) => b.area_m2 - a.area_m2);
    else if (s.sort === "new") sorted.sort((a, b) => (b.start_month ?? "").localeCompare(a.start_month ?? ""));
    else sorted.sort((a, b) => b.risk_score - a.risk_score);
    return sorted;
  }, [capped, s.queue, s.sort, mine]);

  const idx = items.findIndex((a) => a.alert_id === s.alert);
  const prev = idx > 0 ? () => select(items[idx - 1].alert_id) : undefined;
  const next = idx >= 0 && idx < items.length - 1 ? () => select(items[idx + 1].alert_id) : undefined;
  const close = useCallback(() => select(null), [select]);
  const onSelect = useCallback(
    (id: string | null) => {
      select(id);
      if (id) setQueueOpen(false);
    },
    [select],
  );

  // Enter on the focused list opens the first alert when nothing is selected
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !s.alert && document.activeElement?.getAttribute("role") === "listbox" && items[0]) select(items[0].alert_id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.alert, items, select]);

  const docked = bp.lg; // floating queue on the left
  const detailDocked = bp.xl || (bp.lg && !!s.alert); // floating right panel
  const padding = {
    top: 70,
    left: docked ? QW + GAP * 2 : 20,
    right: detailDocked ? DW + GAP * 2 : 60,
    bottom: bp.md ? 110 : 90,
  };

  const queue = (
    <AlertQueue
      items={items}
      counts={counts}
      loading={q.isLoading}
      error={q.error}
      onRetry={() => q.refetch()}
      filters={s.filters}
      districts={meta.data?.districts ?? []}
      onFilters={setFilters}
      onReset={resetFilters}
      queue={s.queue}
      onQueue={(v) => set({ queue: v })}
      sort={s.sort}
      onSort={(v) => set({ sort: v })}
      selected={s.alert}
      hovered={hovered}
      onSelect={onSelect}
      onHover={setHovered}
      searchRef={bp.lg ? undefined : searchRef}
      className="h-full"
    />
  );
  const detail = s.alert ? (
    <DetailPanel key={s.alert} id={s.alert} onClose={close} onPrev={prev} onNext={next} position={idx >= 0 ? `${idx + 1}/${items.length}` : undefined} />
  ) : null;

  const map = (
    <MapView
      ref={mapRef}
      alerts={capped}
      zones={zones.data}
      districts={districts.data}
      selected={s.alert}
      hovered={hovered}
      onSelect={onSelect}
      onHover={setHovered}
      basemap={s.basemap}
      view3d={s.view3d}
      layers={layers}
      padding={padding}
      reducedMotion={reduce}
      activeDistrict={s.filters.district}
    />
  );
  const controls = (
    <MapControls map={mapRef} basemap={s.basemap} onBasemap={(b) => set({ basemap: b })} view3d={s.view3d} on3d={(v) => set({ view3d: v })} layers={layers} onLayers={setLayers} />
  );

  // ---------------- mobile ----------------
  if (!bp.md) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="relative h-[45vh] shrink-0 overflow-hidden">
          {map}
          <div className="absolute right-2 top-2 z-10">{controls}</div>
          <div className="absolute inset-x-2 bottom-2 z-10">
            <TimelineBar alerts={q.data?.items ?? []} month={s.month} onMonth={(m) => set({ month: m })} />
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-bg1">{queue}</div>
        <Dialog open={!!s.alert} onOpenChange={(o) => !o && close()}>
          <SheetContent side="bottom" title={s.alert ?? ""} className="h-[88vh]">
            <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-fg3/40" />
            {detail}
          </SheetContent>
        </Dialog>
      </div>
    );
  }

  // ---------------- tablet / desktop ----------------
  const rightOffset = detailDocked ? DW + GAP * 2 : GAP;
  const leftOffset = docked ? QW + GAP * 2 : GAP;
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {map}

      {/* left: queue */}
      {docked ? (
        <motion.aside
          initial={reduce ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.25 }}
          className="glass absolute bottom-3 left-3 top-3 z-20 overflow-hidden rounded-2xl"
          style={{ width: QW }}
        >
          {queue}
        </motion.aside>
      ) : (
        <>
          <Button className="glass absolute left-3 top-3 z-20" onClick={() => setQueueOpen(true)}>
            <List size={15} /> {t("alerts_n", { n: items.length })}
          </Button>
          <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
            <SheetContent side="left" title="Alerts">{queue}</SheetContent>
          </Dialog>
        </>
      )}

      {/* right: detail / overview */}
      {bp.lg ? (
        <AnimatePresence mode="popLayout">
          {(s.alert || bp.xl) && (
            <motion.aside
              key={s.alert ? "detail" : "overview"}
              initial={reduce ? false : { opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
              transition={spring}
              className="glass absolute bottom-3 right-3 top-3 z-20 overflow-hidden rounded-2xl"
              style={{ width: DW }}
            >
              {detail ?? <OverviewCard top={items[0]} onStart={() => items[0] && select(items[0].alert_id)} onDistrict={(d) => setFilters({ district: d })} />}
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <Dialog open={!!s.alert} onOpenChange={(o) => !o && close()}>
          <SheetContent side="right" title={s.alert ?? ""}>{detail}</SheetContent>
        </Dialog>
      )}

      {/* map chrome */}
      <div className="absolute top-3 z-10 transition-[right] duration-300" style={{ right: rightOffset }}>{controls}</div>
      <Legend className="absolute z-10 hidden transition-[left] duration-300 lg:block" style={{ left: leftOffset, bottom: 104 }} />
      <div className="absolute z-10 transition-[left,right] duration-300" style={{ left: leftOffset, right: rightOffset, bottom: GAP }}>
        <div className="mx-auto max-w-[760px]">
          <TimelineBar alerts={q.data?.items ?? []} month={s.month} onMonth={(m) => set({ month: m })} />
        </div>
      </div>
    </div>
  );
}
