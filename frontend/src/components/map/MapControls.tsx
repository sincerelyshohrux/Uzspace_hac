import { Box, Columns2, Crosshair, Layers, Maximize2, Minimize2, Minus, Plus, Ruler, ScanSearch } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Basemap, LayerPrefs } from "@/app/state";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Segmented } from "@/components/ui/segmented";
import { Tip } from "@/components/ui/tooltip";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/cn";
import { LayersPanel } from "./LayersPanel";
import type { MapHandle } from "./MapView";

function Group({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("glass flex flex-col overflow-hidden rounded-xl", className)}>{children}</div>;
}
const ctl = "grid h-9 w-9 place-items-center text-fg2 transition-colors hover:bg-bg3/70 hover:text-fg1";

export function MapControls({ map, basemap, onBasemap, view3d, on3d, layers, onLayers, compare, onCompare, measure, onMeasure, className }: {
  map: React.RefObject<MapHandle>; basemap: Basemap; onBasemap: (b: Basemap) => void; view3d: boolean; on3d: (v: boolean) => void;
  layers: LayerPrefs; onLayers: (l: LayerPrefs) => void; compare: boolean; onCompare: (v: boolean) => void;
  measure?: boolean; onMeasure?: (v: boolean) => void; className?: string;
}) {
  const { t } = useI18n();
  const [fs, setFs] = useState(false);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", on);
    return () => document.removeEventListener("fullscreenchange", on);
  }, []);
  const toggleFs = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => undefined);

  return (
    <div className={cn("pointer-events-none flex flex-col items-end gap-2", className)}>
      <div className="pointer-events-auto flex items-center gap-2">
        <Tip label={t("cmp_hint")} side="bottom">
          <button
            onClick={() => onCompare(!compare)}
            aria-pressed={compare}
            className={cn(
              "glass inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors",
              compare ? "bg-accent text-bg0 hover:bg-accent/90" : "text-fg1 hover:bg-bg3/70",
            )}
          >
            <Columns2 size={14} /> {t("cmp_map")}
          </button>
        </Tip>
        <Segmented
          label="Basemap"
          className={cn("glass hidden", !compare && "sm:inline-flex")}
          value={basemap}
          onChange={onBasemap}
          options={[
            { value: "satellite", label: t("bm_satellite") },
            { value: "streets", label: t("bm_streets") },
            { value: "dark", label: t("bm_dark") },
          ]}
        />
        <Segmented
          label="View"
          className="glass"
          value={view3d ? "3d" : "2d"}
          onChange={(v) => on3d(v === "3d")}
          options={[
            { value: "2d", label: t("view_2d") },
            { value: "3d", label: <span className="flex items-center gap-1"><Box size={12} />{t("view_3d")}</span> },
          ]}
        />
      </div>
      <div className="pointer-events-auto flex flex-col gap-2">
        <Group>
          <Popover>
            <Tip label={t("layers")} side="left">
              <PopoverTrigger asChild>
                <button className={ctl} aria-label={t("layers")}><Layers size={16} /></button>
              </PopoverTrigger>
            </Tip>
            <PopoverContent side="left" align="start" className="w-72">
              <LayersPanel value={layers} onChange={onLayers} basemap={basemap} onBasemap={onBasemap} />
            </PopoverContent>
          </Popover>
        </Group>
        <Group>
          <Tip label={t("zoom_in")} side="left"><button className={ctl} onClick={() => map.current?.zoomIn()} aria-label={t("zoom_in")}><Plus size={16} /></button></Tip>
          <div className="mx-2 h-px bg-line/20" />
          <Tip label={t("zoom_out")} side="left"><button className={ctl} onClick={() => map.current?.zoomOut()} aria-label={t("zoom_out")}><Minus size={16} /></button></Tip>
        </Group>
        <Group>
          {onMeasure && (
            <>
              <Tip label={t("measure")} side="left" kbd="M">
                <button className={cn(ctl, measure && "bg-accent/20 text-accent")} onClick={() => onMeasure(!measure)} aria-pressed={!!measure} aria-label={t("measure")}><Ruler size={15} /></button>
              </Tip>
              <div className="mx-2 h-px bg-line/20" />
            </>
          )}
          <Tip label={t("recenter")} side="left"><button className={ctl} onClick={() => map.current?.recenter()} aria-label={t("recenter")}><Crosshair size={16} /></button></Tip>
          <div className="mx-2 h-px bg-line/20" />
          <Tip label="Fit alerts" side="left"><button className={ctl} onClick={() => map.current?.fitAlerts()} aria-label="Fit alerts"><ScanSearch size={16} /></button></Tip>
          <div className="mx-2 hidden h-px bg-line/20 md:block" />
          <Tip label={t("fullscreen")} side="left"><button className={cn(ctl, "hidden md:grid")} onClick={toggleFs} aria-label={t("fullscreen")}>{fs ? <Minimize2 size={15} /> : <Maximize2 size={15} />}</button></Tip>
        </Group>
      </div>
    </div>
  );
}

