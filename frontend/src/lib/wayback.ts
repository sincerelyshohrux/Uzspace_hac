// Esri World Imagery Wayback: archived high-resolution imagery releases.
// The tile service redirects each request to the latest release at or before the one asked
// for in which that tile changed, so the capture date is "on or before" the release date.

export const WAYBACK = {
  t1: { release: 64776, label: "2023-08" }, // World Imagery (Wayback 2023-08-31)
  t2: { release: 58924, label: "2025-09" }, // World Imagery (Wayback 2025-09-25)
} as const;

const TILE = 256;
const R = 156543.03392; // metres per pixel at zoom 0, equator

export const waybackUrl = (release: number, z: number, x: number, y: number) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/${z}/${y}/${x}`;

/** MapLibre raster tile template for one release. */
export const waybackTemplate = (release: number) =>
  `https://wayback.maptiles.arcgis.com/arcgis/rest/services/World_Imagery/WMTS/1.0.0/default028mm/MapServer/tile/${release}/{z}/{y}/{x}`;

export interface TileSpec { key: string; src: string; left: number; top: number; size: number }

/**
 * Tiles covering a square of `extentM` metres centred on (lon, lat), positioned in percent
 * of that square, so overlays drawn in the same 0..256 chip space stay aligned.
 */
export function waybackTiles(release: number, lon: number, lat: number, extentM: number, maxZoom = 18): TileSpec[] {
  const cos = Math.cos((lat * Math.PI) / 180);
  // ~3 tiles across the square is sharp enough without loading many tiles
  const z = Math.max(14, Math.min(maxZoom, Math.round(Math.log2((R * cos * TILE * 3) / extentM))));
  const n = 2 ** z;
  const px = ((lon + 180) / 360) * n * TILE;
  const latR = (lat * Math.PI) / 180;
  const py = ((1 - Math.asinh(Math.tan(latR)) / Math.PI) / 2) * n * TILE;
  const E = extentM / ((R * cos) / n); // square side in pixels at zoom z
  const x0 = px - E / 2, y0 = py - E / 2;
  const out: TileSpec[] = [];
  for (let ty = Math.floor(y0 / TILE); ty <= Math.floor((y0 + E) / TILE); ty++)
    for (let tx = Math.floor(x0 / TILE); tx <= Math.floor((x0 + E) / TILE); tx++)
      out.push({
        key: `${z}/${tx}/${ty}`,
        src: waybackUrl(release, z, tx, ty),
        left: ((tx * TILE - x0) / E) * 100,
        top: ((ty * TILE - y0) / E) * 100,
        size: (TILE / E) * 100,
      });
  return out;
}
