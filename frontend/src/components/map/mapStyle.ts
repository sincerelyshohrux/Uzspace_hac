import type { StyleSpecification } from "maplibre-gl";

export const TASHKENT: [number, number] = [69.262, 41.292];
export const START_ZOOM = 10.6;
export const GLYPHS = "https://fonts.openmaptiles.org/{fontstack}/{range}.pbf";
export const FONT = ["Open Sans Semibold"];

/** Raster basemaps only: no API keys, no vector tile vendor. */
export function baseStyle(): StyleSpecification {
  return {
    version: 8,
    glyphs: GLYPHS,
    sources: {
      sat: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "Imagery © Esri, Maxar, Earthstar Geographics",
      },
      satLabels: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 19,
      },
      osm: {
        type: "raster",
        tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
        tileSize: 256,
        maxzoom: 19,
        attribution: "© OpenStreetMap contributors",
      },
    },
    layers: [
      { id: "bg", type: "background", paint: { "background-color": "#070B14" } },
      { id: "base-sat", type: "raster", source: "sat", paint: { "raster-saturation": -0.15, "raster-contrast": 0.05 } },
      { id: "base-sat-labels", type: "raster", source: "satLabels", paint: { "raster-opacity": 0.75 } },
      { id: "base-streets", type: "raster", source: "osm", layout: { visibility: "none" }, paint: { "raster-saturation": -0.3 } },
      {
        id: "base-dark",
        type: "raster",
        source: "osm",
        layout: { visibility: "none" },
        paint: { "raster-brightness-min": 0.92, "raster-brightness-max": 0.06, "raster-saturation": -0.85, "raster-hue-rotate": 200, "raster-contrast": 0.1 },
      },
    ],
  };
}
