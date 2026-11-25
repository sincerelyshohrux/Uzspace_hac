import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, List } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUSES, type Alert } from "@/api/types";
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
import { BottomSheet, type Snap } from "@/components/layout/BottomSheet";
import { spring } from "@/lib/motion";
import { WAYBACK } from "@/lib/wayback";
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
  const [collapsed, setCollapsed] = useState(false); // user-collapsed alert list (desktop)
  const [measure, setMeasure] = useState(false);
  const [sheet, setSheet] = useState<Snap>(() => (s.alert ? "half" : "peek")); // mobile sheet
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
    else if (s.sort === "status") sorted.sort((a, b) => STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) || b.risk_score - a.risk_score);
    else sorted.sort((a, b) => b.risk_score - a.risk_score);
    return sorted;
  }, [capped, s.queue, s.sort, mine]);

  const topId = useMemo(() => capped.reduce<Alert | null>((b, a) => (!b || a.risk_score > b.risk_score ? a : b), null)?.alert_id, [capped]);
  const idx = items.findIndex((a) => a.alert_id === s.alert);
  const prev = idx > 0 ? () => select(items[idx - 1].alert_id) : undefined;
  const next = idx >= 0 && idx < items.length - 1 ? () => select(items[idx + 1].alert_id) : undefined;
  const close = useCallback(() => select(null), [select]);
  const onSelect = useCallback(
    (id: string | null) => {
      select(id);
      if (id) {
        setQueueOpen(false);
        setSheet((v) => (v === "peek" ? "half" : v));
      }
    },
    [select],
  );

  // Enter on the focused list opens the first alert when nothing is selected; M toggles measuring
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if ((e.key === "m" || e.key === "M") && !e.metaKey && !e.ctrlKey && tag !== "INPUT" && tag !== "TEXTAREA" && !document.querySelector('[role="dialog"]')) setMeasure((v) => !v);
      if (e.key === "Enter" && !s.alert && document.activeElement?.getAttribute("role") === "listbox" && items[0]) select(items[0].alert_id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [s.alert, items, select]);

  // floating queue on the left; on laptop widths it yields to the detail panel so the map stays usable
  const docked = bp.lg && !collapsed && (bp.xl || !s.alert);
  const detailDocked = bp.xl || (bp.lg && !!s.alert); // floating right panel
  const padding = {
    top: 70,
    left: docked ? QW + GAP * 2 : 20,
    right: detailDocked ? DW + GAP * 2 : 60,
    bottom: bp.lg ? 170 : bp.md ? 110 : sheet === "peek" ? 150 : sheet === "half" ? Math.round(innerHeight * 0.45) : 90,
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
      searchRef={bp.wide ? undefined : searchRef}
      topId={topId}
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
      compare={s.compare}
      compareLabels={{ left: `2023 · ${WAYBACK.t1.label}`, right: `2025 · ${WAYBACK.t2.label}`, hint: t("cmp_hint") }}
      measure={measure}
      onMeasureClose={() => setMeasure(false)}
      measureLabels={{ title: t("measure"), dist: t("m_dist"), area: t("m_area"), points: t("m_points"), clear: t("m_clear"), close: t("close"), hint: t("m_hint") }}
    />
  );
  const controls = (
    <MapControls map={mapRef} basemap={s.basemap} onBasemap={(b) => set({ basemap: b })} view3d={s.view3d} on3d={(v) => set({ view3d: v })} layers={layers} onLayers={setLayers} compare={s.compare} onCompare={(v) => set({ compare: v })} measure={measure} onMeasure={setMeasure} />
  );

  // Mobile: full-screen map with a draggable sheet (list, or the selected alert)
  if (!bp.md) {
    return (
      <div className="relative min-h-0 flex-1 overflow-hidden">
        {map}
        <div className="absolute right-2 top-2 z-10">{controls}</div>
        {sheet === "peek" && (
          <div className="absolute inset-x-2 z-10" style={{ bottom: 140 }}>
            <TimelineBar alerts={q.data?.items ?? []} month={s.month} onMonth={(m) => set({ month: m })} />
          </div>
        )}
        <BottomSheet snap={sheet} onSnap={setSheet} label={s.alert ?? t("alerts_n", { n: items.length })}>
          {detail ?? queue}
        </BottomSheet>
      </div>
    );
  }

  // Tablet / desktop: floating panels over the map
  const rightOffset = detailDocked ? DW + GAP * 2 : GAP;
  const leftOffset = docked ? QW + GAP * 2 : GAP;
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden">
      {map}

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
          <Button className="glass absolute left-3 top-3 z-20" onClick={() => (bp.xl && collapsed ? setCollapsed(false) : setQueueOpen(true))}>
            <List size={15} /> {t("alerts_n", { n: items.length })}
          </Button>
          <Dialog open={queueOpen} onOpenChange={setQueueOpen}>
            <SheetContent side="left" title="Alerts">{queue}</SheetContent>
          </Dialog>
        </>
      )}

      {docked && (
        <button
          onClick={() => setCollapsed(true)}
          className="glass absolute top-1/2 z-30 grid h-10 w-5 -translate-y-1/2 place-items-center rounded-r-lg text-fg2 hover:text-fg1"
          style={{ left: QW + GAP }}
          aria-label={t("collapse_list")}
          title={t("collapse_list")}
        >
          <ChevronLeft size={14} />
        </button>
      )}

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
              {detail ?? <OverviewCard items={[...capped].sort((x, y) => y.risk_score - x.risk_score)} onSelect={onSelect} onDistrict={(d) => setFilters({ district: d })} />}
            </motion.aside>
          )}
        </AnimatePresence>
      ) : (
        <Dialog open={!!s.alert} onOpenChange={(o) => !o && close()}>
          <SheetContent side="right" title={s.alert ?? ""}>{detail}</SheetContent>
        </Dialog>
      )}

      <div className="absolute top-3 z-10 transition-[right] duration-300" style={{ right: rightOffset }}>{controls}</div>
      <Legend className="absolute z-10 hidden transition-[left] duration-300 lg:block" style={{ left: leftOffset, bottom: bp.lg ? 168 : 104 }} />
      <div className="absolute z-10 transition-[left,right] duration-300" style={{ left: leftOffset, right: rightOffset, bottom: GAP }}>
        <div className="mx-auto max-w-[760px]">
          <TimelineBar alerts={q.data?.items ?? []} month={s.month} onMonth={(m) => set({ month: m })} strip={bp.lg} />
        </div>
      </div>
    </div>
  );
}
