// Small geometry helpers (no turf dependency).
const M_LAT = 111_320;
export const mLon = (lat: number) => M_LAT * Math.cos((lat * Math.PI) / 180);

/** Same rule as backend/scripts/make_mock_data.py: side (m) of the square chip centred on the alert. */
export const chipExtentM = (areaM2: number) => Math.max(120, Math.sqrt(areaM2) * 2.6);

/** Project a polygon ring to chip pixel space (0..size), centred on (lon, lat). */
export function ringToChip(ring: number[][], lon: number, lat: number, areaM2: number, size = 256): [number, number][] {
  const k = size / chipExtentM(areaM2);
  return ring.map(([x, y]) => [size / 2 + (x - lon) * mLon(lat) * k, size / 2 - (y - lat) * M_LAT * k]);
}

/** Buffer distance in metres -> line width in px at a zoom level (Web Mercator). */
export function metersToPx(m: number, lat: number, zoom: number) {
  const mpp = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return (2 * m) / mpp;
}
