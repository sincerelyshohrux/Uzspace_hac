import { Flame, Map as MapIcon, Route, Shapes, Waypoints } from "lucide-react";
import type { ReactNode } from "react";
import { ZONES } from "@/api/types";
import type { Basemap, LayerPrefs } from "@/app/state";
import { Segmented } from "@/components/ui/segmented";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useI18n, type I18nKey } from "@/i18n";
import { ZONE_HEX } from "@/lib/format";

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 text-[13px]">
      <span className="text-fg2">{icon}</span>
      <span className="flex-1">{label}</span>
      {children}
    </label>
  );
}

export function LayersPanel({ value: L, onChange, basemap, onBasemap }: { value: LayerPrefs; onChange: (l: LayerPrefs) => void; basemap: Basemap; onBasemap: (b: Basemap) => void }) {
  const { t } = useI18n();
  const set = (p: Partial<LayerPrefs>) => onChange({ ...L, ...p });
  return (
    <div className="space-y-3">
      <div className="section-title">{t("layers")}</div>
      <Segmented
        label="Basemap"
        className="w-full sm:hidden"
        value={basemap}
        onChange={onBasemap}
        options={[{ value: "satellite", label: t("bm_satellite") }, { value: "streets", label: t("bm_streets") }, { value: "dark", label: t("bm_dark") }]}
      />
      <div className="divide-y divide-line/10">
        <div>
          <Row icon={<Shapes size={15} />} label={t("l_alerts")}><Switch checked={L.alerts} onChange={(v) => set({ alerts: v })} label={t("l_alerts")} /></Row>
          {L.alerts && (
            <div className="flex items-center gap-3 pb-2 pl-7 text-2xs text-fg2">
              {t("opacity")}
              <Slider label={t("opacity")} value={Math.round(L.alertOpacity * 100)} min={10} max={90} onChange={(v) => set({ alertOpacity: v / 100 })} />
            </div>
          )}
        </div>
        <div>
          <Row icon={<Waypoints size={15} />} label={t("l_zones")}><Switch checked={L.zones} onChange={(v) => set({ zones: v })} label={t("l_zones")} /></Row>
          {L.zones && (
            <div className="grid grid-cols-1 gap-1 pb-2 pl-7">
              {ZONES.map((z) => (
                <label key={z} className="flex cursor-pointer items-center gap-2 text-xs text-fg1">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 accent-cyan-500"
                    checked={L.zoneTypes[z] !== false}
                    onChange={(e) => set({ zoneTypes: { ...L.zoneTypes, [z]: e.target.checked } })}
                  />
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ZONE_HEX[z] }} />
                  {t(`z_${z}` as I18nKey)}
                </label>
              ))}
              <div className="mt-1 flex items-center gap-3 text-2xs text-fg2">
                {t("opacity")}
                <Slider label={t("opacity")} value={Math.round(L.zoneOpacity * 100)} min={0} max={60} onChange={(v) => set({ zoneOpacity: v / 100 })} />
              </div>
            </div>
          )}
        </div>
        <Row icon={<Route size={15} />} label={t("l_buffers")}><Switch checked={L.buffers} onChange={(v) => set({ buffers: v })} label={t("l_buffers")} /></Row>
        <Row icon={<MapIcon size={15} />} label={t("l_districts")}><Switch checked={L.districts} onChange={(v) => set({ districts: v })} label={t("l_districts")} /></Row>
        <Row icon={<Flame size={15} />} label={t("l_heat")}><Switch checked={L.heat} onChange={(v) => set({ heat: v })} label={t("l_heat")} /></Row>
      </div>
    </div>
  );
}
