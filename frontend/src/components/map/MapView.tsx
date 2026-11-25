import maplibregl, { type GeoJSONSource, type Map as MLMap, type MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { Alert, DistrictLayer, ZoneLayer } from "@/api/types";
import type { Basemap, LayerPrefs } from "@/app/state";
import { mLon } from "@/lib/geo";
import { RISK_HEX, ZONE_HEX } from "@/lib/format";
import { WAYBACK, waybackTemplate } from "@/lib/wayback";
import { baseStyle, FONT, START_ZOOM, TASHKENT } from "./mapStyle";

export interface MapHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  recenter: () => void;
  fitAlerts: () => void;
}

interface Props {
  alerts: Alert[];
  zones?: ZoneLayer;
  districts?: DistrictLayer;
  selected: string | null;
  hovered: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  basemap: Basemap;
  view3d: boolean;
  layers: LayerPrefs;
  padding: { left: number; right: number; bottom: number; top: number };
  reducedMotion: boolean;
  activeDistrict?: string;
  /** Swipe between 2023 and 2025 high-resolution imagery over the whole map */
  compare?: boolean;
  compareLabels?: { left: string; right: string; hint: string };
}

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };
const riskColorExpr = (prop = "risk_score"): maplibregl.ExpressionSpecification => [
  "step", ["get", prop], RISK_HEX.low, 30, RISK_HEX.mid, 60, RISK_HEX.high,
];
const zoneColorExpr: maplibregl.ExpressionSpecification = [
  "match", ["get", "zone"],
  ...Object.entries(ZONE_HEX).flat(),
  "#94A3B8",
] as unknown as maplibregl.ExpressionSpecification;

/** Square "risk column" footprints for 3D mode (visible at city scale). */
function columns(alerts: Alert[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: alerts.map((a) => {
      const half = 90;
      const dx = half / mLon(a.lat);
      const dy = half / 111_320;
      return {
        type: "Feature",
        id: a.alert_id,
        properties: { alert_id: a.alert_id, risk_score: a.risk_score, h: 40 + a.risk_score * 9 },
        geometry: { type: "Polygon", coordinates: [[[a.lon - dx, a.lat - dy], [a.lon + dx, a.lat - dy], [a.lon + dx, a.lat + dy], [a.lon - dx, a.lat + dy], [a.lon - dx, a.lat - dy]]] },
      };
    }),
  };
}

/** Square target frame around each alert, sized by footprint. */
function frames(alerts: Alert[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: alerts.map((a) => {
      const half = Math.max(40, Math.sqrt(a.area_m2) * 0.9);
      const dx = half / mLon(a.lat);
      const dy = half / 111_320;
      return {
        type: "Feature",
        id: a.alert_id,
        properties: { alert_id: a.alert_id, risk_score: a.risk_score, label: `${a.alert_id.slice(-4)} · ${Math.round(a.risk_score)}` },
        geometry: { type: "Polygon", coordinates: [[[a.lon - dx, a.lat - dy], [a.lon + dx, a.lat - dy], [a.lon + dx, a.lat + dy], [a.lon - dx, a.lat + dy], [a.lon - dx, a.lat - dy]]] },
      };
    }),
  };
}

function centroid(poly: GeoJSON.Polygon): [number, number] {
  const r = poly.coordinates[0];
  const n = r.length - 1;
  let x = 0;
  let y = 0;
  for (let i = 0; i < n; i++) {
    x += r[i][0];
    y += r[i][1];
  }
  return [x / n, y / n];
}

export const MapView = forwardRef<MapHandle, Props>(function MapView(p, ref) {
  const el = useRef<HTMLDivElement>(null);
  const coordEl = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const [ready, setReady] = useState(false);
  const cb = useRef(p);
  cb.current = p;
  const prevSel = useRef<string | null>(null);
  const ovEl = useRef<HTMLDivElement>(null);
  const ov = useRef<MLMap | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);
  const prevHover = useRef<string | null>(null);

  const alertFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: p.alerts.map((a) => ({
        type: "Feature",
        id: a.alert_id,
        properties: { alert_id: a.alert_id, risk_score: a.risk_score, area_m2: a.area_m2, status: a.status, district: a.district },
        geometry: a.geometry,
      })),
    }),
    [p.alerts],
  );
  const pointFC = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: p.alerts.map((a) => ({
        type: "Feature",
        properties: { alert_id: a.alert_id, risk_score: a.risk_score, area_m2: a.area_m2 },
        geometry: { type: "Point", coordinates: [a.lon, a.lat] },
      })),
    }),
    [p.alerts],
  );
  const districtLabels = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: (p.districts?.features ?? []).map((f) => ({ type: "Feature", properties: { name: f.properties.name }, geometry: { type: "Point", coordinates: centroid(f.geometry) } })),
    }),
    [p.districts],
  );

  useImperativeHandle(ref, () => ({
    zoomIn: () => map.current?.zoomIn(),
    zoomOut: () => map.current?.zoomOut(),
    recenter: () => map.current?.flyTo({ center: TASHKENT, zoom: START_ZOOM, pitch: cb.current.view3d ? 55 : 0, bearing: cb.current.view3d ? -15 : 0, padding: cb.current.padding }),
    fitAlerts: () => {
      const m = map.current;
      const a = cb.current.alerts;
      if (!m || !a.length) return;
      const b = new maplibregl.LngLatBounds();
      a.forEach((x) => b.extend([x.lon, x.lat]));
      m.fitBounds(b, { padding: { ...cb.current.padding, top: cb.current.padding.top + 40, bottom: cb.current.padding.bottom + 40, left: cb.current.padding.left + 40, right: cb.current.padding.right + 40 }, maxZoom: 14, duration: 900 });
    },
  }));

  useEffect(() => {
    if (!el.current) return;
    const m = new maplibregl.Map({
      container: el.current,
      style: baseStyle(),
      center: TASHKENT,
      zoom: START_ZOOM,
      attributionControl: { compact: true },
      maxPitch: 70,
      dragRotate: true,
    });
    map.current = m;
    m.addControl(new maplibregl.ScaleControl({ unit: "metric", maxWidth: 90 }), "bottom-left");

    m.on("load", () => {
      m.addSource("districts", { type: "geojson", data: EMPTY });
      m.addSource("district-labels", { type: "geojson", data: EMPTY });
      m.addSource("zones", { type: "geojson", data: EMPTY });
      m.addSource("alerts", { type: "geojson", data: EMPTY, promoteId: "alert_id" });
      m.addSource("columns", { type: "geojson", data: EMPTY, promoteId: "alert_id" });
      m.addSource("frames", { type: "geojson", data: EMPTY, promoteId: "alert_id" });
      m.addSource("pts-raw", { type: "geojson", data: EMPTY });
      m.addSource("pts", {
        type: "geojson",
        data: EMPTY,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 44,
        clusterProperties: { maxRisk: ["max", ["get", "risk_score"]] },
      });

      m.addLayer({ id: "districts-fill", type: "fill", source: "districts", paint: { "fill-color": "#22D3EE", "fill-opacity": ["case", ["==", ["get", "name"], ""], 0.06, 0] } });
      m.addLayer({ id: "districts-line", type: "line", source: "districts", paint: { "line-color": "#E2E8F0", "line-opacity": 0.45, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.6, 14, 1.6], "line-dasharray": [3, 2] } });
      m.addLayer({
        id: "districts-label", type: "symbol", source: "district-labels", maxzoom: 13.5,
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": FONT, "text-size": 11, "text-letter-spacing": 0.12, "text-allow-overlap": false },
        paint: { "text-color": "#E2E8F0", "text-halo-color": "rgba(7,11,20,.85)", "text-halo-width": 1.4, "text-opacity": 0.85 },
      });

      m.addLayer({ id: "zones-fill", type: "fill", source: "zones", filter: ["==", ["geometry-type"], "Polygon"], paint: { "fill-color": zoneColorExpr, "fill-opacity": 0.18 } });
      m.addLayer({ id: "zones-outline", type: "line", source: "zones", filter: ["==", ["geometry-type"], "Polygon"], paint: { "line-color": zoneColorExpr, "line-width": 1.4, "line-opacity": 0.9 } });
      // protection corridor: width follows metres (buffer_m) at every zoom, lat ≈ 41.3
      const px = (z: number) => ["*", ["get", "buffer_m"], 2 / ((156543.03392 * Math.cos((41.3 * Math.PI) / 180)) / 2 ** z)];
      m.addLayer({
        id: "zones-buffer", type: "line", source: "zones", filter: ["==", ["geometry-type"], "LineString"],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": zoneColorExpr, "line-opacity": 0.2, "line-width": ["interpolate", ["exponential", 2], ["zoom"], 9, px(9), 19, px(19)] as unknown as maplibregl.ExpressionSpecification },
      });
      m.addLayer({ id: "zones-line", type: "line", source: "zones", filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "zone"], ["literal", ["canal", "river"]]]], layout: { "line-cap": "round", "line-join": "round" }, paint: { "line-color": zoneColorExpr, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.5, 16, 4] } });
      m.addLayer({ id: "zones-line-dashed", type: "line", source: "zones", filter: ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "zone"], ["literal", ["power_line", "railway"]]]], paint: { "line-color": zoneColorExpr, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 16, 2.5], "line-dasharray": [2, 1.5] } });

      m.addLayer({
        id: "heat", type: "heatmap", source: "pts-raw", layout: { visibility: "none" },
        paint: {
          "heatmap-weight": ["/", ["get", "risk_score"], 100],
          "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 9, 18, 14, 40],
          "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 9, 1, 14, 2.5],
          "heatmap-opacity": 0.75,
          "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.2, "#0E7490", 0.45, "#22D3EE", 0.65, "#EAB308", 0.85, "#F59E0B", 1, "#EF4444"],
        },
      });

      m.addLayer({
        id: "alerts-fill", type: "fill", source: "alerts", minzoom: 12.5,
        paint: { "fill-color": riskColorExpr(), "fill-opacity": ["case", ["boolean", ["feature-state", "selected"], false], 0.55, ["boolean", ["feature-state", "hover"], false], 0.5, 0.35] },
      });
      m.addLayer({
        id: "alerts-line", type: "line", source: "alerts", minzoom: 12.5,
        paint: {
          "line-color": ["case", ["boolean", ["feature-state", "selected"], false], "#22D3EE", riskColorExpr()],
          "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 3, ["boolean", ["feature-state", "hover"], false], 2.5, 1.6],
        },
      });

      m.addLayer({
        id: "columns", type: "fill-extrusion", source: "columns", layout: { visibility: "none" },
        paint: {
          "fill-extrusion-color": ["case", ["boolean", ["feature-state", "selected"], false], "#22D3EE", riskColorExpr()],
          "fill-extrusion-height": ["get", "h"],
          "fill-extrusion-base": 0,
          "fill-extrusion-opacity": 0.88,
        },
      });

      const frameColor: maplibregl.ExpressionSpecification = ["case", ["boolean", ["feature-state", "selected"], false], "#22D3EE", riskColorExpr()];
      m.addLayer({ id: "frames-glow", type: "line", source: "frames", minzoom: 12.5, paint: { "line-color": frameColor, "line-width": ["interpolate", ["linear"], ["zoom"], 13, 5, 17, 10], "line-blur": 6, "line-opacity": 0.55 } });
      m.addLayer({ id: "frames", type: "line", source: "frames", minzoom: 12.5, paint: { "line-color": frameColor, "line-width": ["case", ["boolean", ["feature-state", "selected"], false], 2.4, 1.4], "line-opacity": 0.95 } });
      m.addLayer({
        id: "frame-labels", type: "symbol", source: "frames", minzoom: 13.5,
        layout: { "text-field": ["get", "label"], "text-font": FONT, "text-size": 11, "text-anchor": "bottom-left", "text-offset": [0, -0.3], "symbol-placement": "point", "text-allow-overlap": false, "text-variable-anchor": ["bottom-left", "top-left"] } as maplibregl.SymbolLayerSpecification["layout"],
        paint: { "text-color": riskColorExpr(), "text-halo-color": "rgba(4,9,20,.92)", "text-halo-width": 1.6 },
      });

      m.addLayer({ id: "pulse", type: "circle", source: "pts-raw", minzoom: 11, maxzoom: 13.5, filter: [">=", ["get", "risk_score"], 60], paint: { "circle-radius": 10, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": RISK_HEX.high, "circle-stroke-width": 2, "circle-stroke-opacity": 0.6 } });

      m.addLayer({
        id: "clusters-glow", type: "circle", source: "pts", filter: ["has", "point_count"],
        paint: { "circle-color": riskColorExpr("maxRisk"), "circle-opacity": 0.28, "circle-blur": 1, "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 30, 10, 40, 30, 54] },
      });
      m.addLayer({
        id: "clusters", type: "circle", source: "pts", filter: ["has", "point_count"],
        paint: {
          "circle-color": riskColorExpr("maxRisk"),
          "circle-opacity": 0.3,
          "circle-stroke-color": riskColorExpr("maxRisk"),
          "circle-stroke-width": 1.6,
          "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 15, 10, 21, 30, 30],
          "circle-blur": 0.05,
        },
      });
      m.addLayer({ id: "cluster-count", type: "symbol", source: "pts", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": FONT, "text-size": 12, "text-allow-overlap": true }, paint: { "text-color": "#F8FAFC" } });

      m.addLayer({
        id: "points-glow", type: "circle", source: "pts", maxzoom: 13.5, filter: ["!", ["has", "point_count"]],
        paint: { "circle-color": riskColorExpr(), "circle-opacity": 0.45, "circle-blur": 1, "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 11, 13, 22] },
      });
      m.addLayer({
        id: "points", type: "circle", source: "pts", maxzoom: 13.5, filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": riskColorExpr(),
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["interpolate", ["linear"], ["get", "area_m2"], 800, 4, 15000, 7], 13, ["interpolate", ["linear"], ["get", "area_m2"], 800, 7, 15000, 12]],
          "circle-stroke-color": "#0B1220",
          "circle-stroke-width": 1.5,
        },
      });
      m.addLayer({ id: "selected-ring", type: "circle", source: "pts-raw", maxzoom: 13.5, filter: ["==", ["get", "alert_id"], ""], paint: { "circle-radius": 16, "circle-color": "rgba(34,211,238,.12)", "circle-stroke-color": "#22D3EE", "circle-stroke-width": 2.5 } });

      const pickable = ["alerts-fill", "points", "columns"];
      const idOf = (f?: MapGeoJSONFeature) => (f?.properties?.alert_id as string | undefined) ?? null;
      const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12, className: "ss-pop" });

      m.on("click", (e) => {
        const hit = m.queryRenderedFeatures(e.point, { layers: [...pickable, "clusters"].filter((l) => m.getLayoutProperty(l, "visibility") !== "none") });
        const c = hit.find((f) => f.layer.id === "clusters");
        if (c && !hit.some((f) => pickable.includes(f.layer.id))) {
          (m.getSource("pts") as GeoJSONSource).getClusterExpansionZoom(c.properties.cluster_id as number).then((z) => {
            m.easeTo({ center: (c.geometry as GeoJSON.Point).coordinates as [number, number], zoom: z + 0.3 });
          });
          return;
        }
        const id = idOf(hit.find((f) => pickable.includes(f.layer.id)));
        cb.current.onSelect(id);
      });
      m.on("mousemove", (e) => {
        if (coordEl.current) coordEl.current.textContent = `${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`;
        const layersOn = [...pickable, "clusters"].filter((l) => m.getLayoutProperty(l, "visibility") !== "none");
        const hit = m.queryRenderedFeatures(e.point, { layers: layersOn });
        m.getCanvas().style.cursor = hit.length ? "pointer" : "";
        const f = hit.find((x) => pickable.includes(x.layer.id));
        const id = idOf(f);
        if (id !== prevHover.current) cb.current.onHover(id);
        if (f && id) {
          const a = cb.current.alerts.find((x) => x.alert_id === id);
          if (a) {
            popup
              .setLngLat([a.lon, a.lat])
              .setHTML(`<div style="font:600 12px Inter;display:flex;gap:8px;align-items:center"><span style="font-family:'JetBrains Mono',monospace">${a.alert_id}</span><span style="color:${RISK_HEX[a.risk_score >= 60 ? "high" : a.risk_score >= 30 ? "mid" : "low"]}">${Math.round(a.risk_score)}</span></div><div style="font:400 11px Inter;opacity:.7">${a.district} · ≈${Math.round(a.area_m2)} m²</div>`)
              .addTo(m);
          }
        } else popup.remove();
      });
      m.getCanvas().addEventListener("mouseleave", () => {
        popup.remove();
        cb.current.onHover(null);
      });

      setReady(true);
    });

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      setReady(false); // a re-created map (fast refresh) must load its sources first
    };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    (m.getSource("alerts") as GeoJSONSource).setData(alertFC);
    (m.getSource("columns") as GeoJSONSource).setData(columns(p.alerts));
    (m.getSource("frames") as GeoJSONSource).setData(frames(p.alerts));
    (m.getSource("pts") as GeoJSONSource).setData(pointFC);
    (m.getSource("pts-raw") as GeoJSONSource).setData(pointFC);
  }, [ready, alertFC, pointFC, p.alerts]);
  useEffect(() => {
    if (ready && p.zones) (map.current!.getSource("zones") as GeoJSONSource).setData(p.zones);
  }, [ready, p.zones]);
  useEffect(() => {
    if (!ready || !p.districts) return;
    (map.current!.getSource("districts") as GeoJSONSource).setData(p.districts);
    (map.current!.getSource("district-labels") as GeoJSONSource).setData(districtLabels);
  }, [ready, p.districts, districtLabels]);
  useEffect(() => {
    if (!ready) return;
    map.current!.setPaintProperty("districts-fill", "fill-opacity", ["case", ["==", ["get", "name"], p.activeDistrict ?? ""], 0.08, 0]);
  }, [ready, p.activeDistrict]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const cmp = !!p.compare;
    vis("base-sat", p.basemap === "satellite" && !cmp);
    vis("base-wb2", cmp);
    vis("base-sat-labels", p.basemap === "satellite" && !cmp);
    vis("base-streets", p.basemap === "streets" && !cmp);
    vis("base-dark", p.basemap === "dark" && !cmp);
    const light = p.basemap === "streets" && !cmp;
    m.setPaintProperty("districts-line", "line-color", light ? "#334155" : "#E2E8F0");
    m.setPaintProperty("districts-label", "text-color", light ? "#0F172A" : "#E2E8F0");
    m.setPaintProperty("districts-label", "text-halo-color", light ? "rgba(255,255,255,.9)" : "rgba(7,11,20,.85)");
  }, [ready, p.basemap, p.compare]);

  // Compare mode: a second, non-interactive map with the 2023 imagery, clipped to the left of the
  // swipe line and following the main map's camera (including its padding).
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !p.compare || !ovEl.current) return;
    // start the line in the middle of the part of the map not covered by panels
    const W = wrap.current?.clientWidth ?? 0;
    const pd = cb.current.padding;
    if (W) setPos(Math.min(90, Math.max(10, ((pd.left + (W - pd.left - pd.right) / 2) / W) * 100)));
    const o = new maplibregl.Map({
      container: ovEl.current,
      style: {
        version: 8,
        sources: {
          wb1: { type: "raster", tiles: [waybackTemplate(WAYBACK.t1.release)], tileSize: 256, maxzoom: 19 },
          al: { type: "geojson", data: alertFC },
        },
        layers: [
          { id: "bg", type: "background", paint: { "background-color": "#070B14" } },
          { id: "wb1", type: "raster", source: "wb1" },
          { id: "al", type: "line", source: "al", minzoom: 12.5, paint: { "line-color": "#22D3EE", "line-width": 1.6, "line-dasharray": [2, 1.5] } },
        ],
      },
      interactive: false,
      attributionControl: false,
      center: m.getCenter(),
      zoom: m.getZoom(),
      bearing: m.getBearing(),
      pitch: m.getPitch(),
    });
    ov.current = o;
    const sync = () => o.jumpTo({ center: m.getCenter(), zoom: m.getZoom(), bearing: m.getBearing(), pitch: m.getPitch(), padding: m.getPadding() });
    sync();
    m.on("move", sync);
    const ro = new ResizeObserver(() => {
      o.resize();
      sync();
    });
    ro.observe(ovEl.current);
    return () => {
      m.off("move", sync);
      ro.disconnect();
      o.remove();
      ov.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, p.compare]);
  useEffect(() => {
    const o = ov.current;
    if (!o) return;
    const apply = () => (o.getSource("al") as GeoJSONSource | undefined)?.setData(alertFC);
    if (o.isStyleLoaded()) apply();
    else o.once("load", apply);
  }, [alertFC, p.compare]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const L = p.layers;
    const vis = (id: string, on: boolean) => m.setLayoutProperty(id, "visibility", on ? "visible" : "none");
    const alertsOn = L.alerts;
    vis("columns", alertsOn && p.view3d);
    ["alerts-fill", "alerts-line", "frames-glow", "frames", "frame-labels"].forEach((id) => vis(id, alertsOn && !p.view3d));
    ["clusters-glow", "clusters", "cluster-count", "points-glow", "points", "pulse", "selected-ring"].forEach((id) => vis(id, alertsOn && !p.view3d));
    vis("heat", L.heat);
    ["districts-line", "districts-label", "districts-fill"].forEach((id) => vis(id, L.districts));
    const types = Object.entries(L.zoneTypes).filter(([, on]) => on).map(([z]) => z);
    const tf: maplibregl.ExpressionSpecification = ["in", ["get", "zone"], ["literal", types]];
    ["zones-fill", "zones-outline", "zones-line", "zones-line-dashed"].forEach((id) => vis(id, L.zones));
    vis("zones-buffer", L.zones && L.buffers);
    m.setFilter("zones-fill", ["all", ["==", ["geometry-type"], "Polygon"], tf]);
    m.setFilter("zones-outline", ["all", ["==", ["geometry-type"], "Polygon"], tf]);
    m.setFilter("zones-buffer", ["all", ["==", ["geometry-type"], "LineString"], tf]);
    m.setFilter("zones-line", ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "zone"], ["literal", ["canal", "river"]]], tf]);
    m.setFilter("zones-line-dashed", ["all", ["==", ["geometry-type"], "LineString"], ["in", ["get", "zone"], ["literal", ["power_line", "railway"]]], tf]);
    m.setPaintProperty("zones-fill", "fill-opacity", L.zoneOpacity);
    const fo = p.compare ? 0 : L.alertOpacity; // compare: outlines only, so both years stay visible
    m.setPaintProperty("alerts-fill", "fill-opacity", ["case", ["boolean", ["feature-state", "selected"], false], p.compare ? 0.12 : Math.min(1, fo + 0.25), ["boolean", ["feature-state", "hover"], false], Math.min(1, fo + 0.15), fo]);
    ["zones-fill", "zones-buffer"].forEach((id) => vis(id, L.zones && !p.compare && (id !== "zones-buffer" || L.buffers)));
  }, [ready, p.layers, p.view3d, p.compare]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const opts = p.view3d ? { pitch: 58, bearing: -18 } : { pitch: 0, bearing: 0 };
    if (p.reducedMotion) m.jumpTo(opts);
    else m.easeTo({ ...opts, duration: 900 });
  }, [ready, p.view3d, p.reducedMotion]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const setSel = (id: string | null, v: boolean) => {
      if (!id) return;
      m.setFeatureState({ source: "alerts", id }, { selected: v });
      m.setFeatureState({ source: "columns", id }, { selected: v });
      m.setFeatureState({ source: "frames", id }, { selected: v });
    };
    setSel(prevSel.current, false);
    setSel(p.selected, true);
    prevSel.current = p.selected;
    m.setFilter("selected-ring", ["==", ["get", "alert_id"], p.selected ?? ""]);
    if (!p.selected) return;
    const a = p.alerts.find((x) => x.alert_id === p.selected);
    if (!a) return;
    const target = { center: [a.lon, a.lat] as [number, number], zoom: Math.max(m.getZoom(), p.view3d ? 14 : 15.2), padding: p.padding };
    if (p.reducedMotion) m.jumpTo(target);
    else m.flyTo({ ...target, duration: 1200, curve: 1.4, essential: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, p.selected]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    if (prevHover.current) {
      m.setFeatureState({ source: "alerts", id: prevHover.current }, { hover: false });
    }
    if (p.hovered) m.setFeatureState({ source: "alerts", id: p.hovered }, { hover: true });
    prevHover.current = p.hovered;
  }, [ready, p.hovered]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m || p.reducedMotion) return;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 33) return;
      last = t;
      const k = (t % 2000) / 2000;
      m.setPaintProperty("pulse", "circle-radius", 8 + k * 18);
      m.setPaintProperty("pulse", "circle-stroke-opacity", 0.7 * (1 - k));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, p.reducedMotion]);

  const drag = (e: React.PointerEvent) => {
    if (!dragging.current || !wrap.current) return;
    const r = wrap.current.getBoundingClientRect();
    setPos(Math.min(98, Math.max(2, ((e.clientX - r.left) / r.width) * 100)));
  };
  const L = p.compareLabels;

  return (
    <div ref={wrap} className="absolute inset-0">
      <div ref={el} className="h-full w-full" role="region" aria-label="Map" />
      {p.compare && (
        <>
          {/* maplibre sets position:relative on its container, so clip an absolute wrapper instead */}
          <div className="pointer-events-none absolute inset-0 z-[5]" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} aria-hidden>
            <div ref={ovEl} className="h-full w-full" />
          </div>
          <div className="pointer-events-none absolute inset-y-0 z-[6] w-0.5 bg-white/90 shadow-[0_0_10px_rgba(0,0,0,.6)]" style={{ left: `calc(${pos}% - 1px)` }}>
            {L && (
              <div className="absolute left-1/2 top-16 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap text-[11px] font-semibold">
                <span className="rounded-l-md bg-black/70 px-2 py-1 text-white backdrop-blur">◀ {L.left}</span>
                <span className="rounded-r-md bg-accent/90 px-2 py-1 text-bg0">{L.right} ▶</span>
              </div>
            )}
            <button
              role="slider"
              aria-label={L?.hint ?? "Compare"}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(pos)}
              title={L?.hint}
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={drag}
              onPointerUp={() => (dragging.current = false)}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setPos((v) => Math.max(2, v - 4));
                if (e.key === "ArrowRight") setPos((v) => Math.min(98, v + 4));
              }}
              className="pointer-events-auto absolute left-1/2 top-1/2 grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full border-2 border-white bg-black/60 text-white shadow-lg backdrop-blur"
            >
              ⇆
            </button>
          </div>
        </>
      )}
      <div ref={coordEl} className="pointer-events-none absolute bottom-2 left-[110px] z-10 hidden rounded-md bg-black/45 px-1.5 py-0.5 font-mono text-[10px] text-white/85 backdrop-blur md:block" aria-hidden />
    </div>
  );
});
