"""Restricted zones and district boundaries from OpenStreetMap (Overpass API).

    pipeline/.venv/bin/python -m pipeline.zones    # download and print a summary
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from dataclasses import dataclass

import requests
from pyproj import Transformer
from shapely import STRtree
from shapely.geometry import LineString, MultiPolygon, Polygon, mapping, shape
import numpy as np
import shapely
from shapely.ops import linemerge, polygonize, unary_union

from . import config as C

LINE_ZONES = {
    "canal": 'way[waterway=canal]',
    "river": 'way[waterway=river]',
    "power_line": 'way[power=line]',
    "railway": 'way[railway=rail][!service]',
}
AREA_ZONES = {
    "park": ['[leisure=park]'],
    "cemetery": ['[landuse=cemetery]', '[amenity=grave_yard]'],
    "farmland": ['[landuse~"^(farmland|orchard|vineyard)$"]'],
}

_to_utm = Transformer.from_crs("EPSG:4326", C.CRS, always_xy=True).transform
_to_wgs = Transformer.from_crs(C.CRS, "EPSG:4326", always_xy=True).transform


def transform(fn, geom):
    return shapely.transform(geom, lambda xy: np.column_stack(fn(xy[:, 0], xy[:, 1])))


def overpass(query: str) -> dict:
    """POST a query to Overpass, cached in pipeline/cache by query hash."""
    C.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = C.CACHE_DIR / f"osm_{hashlib.sha1(query.encode()).hexdigest()[:10]}.json"
    if path.exists():
        return json.loads(path.read_text())
    for attempt in range(4):
        r = requests.post(C.OVERPASS_URL, data={"data": query}, timeout=300,
                          headers={"User-Agent": "SiteSentinel-pipeline/0.1"})
        if r.status_code == 200:
            path.write_text(r.text)
            return r.json()
        time.sleep(10 * (attempt + 1))   # 429 / 504: server busy
    r.raise_for_status()
    raise RuntimeError("Overpass request failed")


def _bbox() -> str:
    w, s, e, n = C.AOI_BBOX
    return f"{s},{w},{n},{e}"


def _line(el: dict) -> LineString | None:
    pts = [(p["lon"], p["lat"]) for p in el.get("geometry", []) if p]
    return LineString(pts) if len(pts) >= 2 else None


def _area(el: dict) -> Polygon | MultiPolygon | None:
    """Closed way or multipolygon relation -> (Multi)Polygon in lon/lat."""
    if el["type"] == "way":
        ln = _line(el)
        if ln is None or not ln.is_closed or len(ln.coords) < 4:
            return None
        return Polygon(ln.coords)
    outer = [_line(m) for m in el.get("members", []) if m.get("type") == "way" and m.get("role") in ("outer", "")]
    inner = [_line(m) for m in el.get("members", []) if m.get("type") == "way" and m.get("role") == "inner"]
    shell = unary_union(list(polygonize([x for x in outer if x is not None])))
    if shell.is_empty:
        return None
    holes = unary_union(list(polygonize([x for x in inner if x is not None])))
    return shell.difference(holes) if not holes.is_empty else shell


def _parts(g):
    return list(g.geoms) if hasattr(g, "geoms") else [g]


def clean_name(name: str) -> str:
    name = re.sub(r"\s+tumani$", "", name.strip(), flags=re.IGNORECASE)
    return re.sub(r"[‘’ʻʼ`]", "'", name)


@dataclass
class Zone:
    zone: str
    name: str
    buffer_m: int
    geom_wgs: object      # LineString or Polygon, drawn on the map
    area_utm: object      # Polygon in UTM used for intersection (buffered for lines)


def fetch_zones() -> list[Zone]:
    b = _bbox()
    parts = [f"{q}({b});" for q in LINE_ZONES.values()]
    for filters in AREA_ZONES.values():
        parts += [f"way{f}({b});rel{f}({b});" for f in filters]
    data = overpass(f"[out:json][timeout:240];({''.join(parts)});out geom;")

    def kind(tags: dict) -> str | None:
        if tags.get("waterway") in ("canal", "river"):
            return tags["waterway"]
        if tags.get("power") == "line":
            return "power_line"
        if tags.get("railway") == "rail":
            return "railway"
        if tags.get("leisure") == "park":
            return "park"
        if tags.get("landuse") == "cemetery" or tags.get("amenity") == "grave_yard":
            return "cemetery"
        if tags.get("landuse") in ("farmland", "orchard", "vineyard"):
            return "farmland"
        return None

    lines: dict[tuple[str, str], list] = {}
    zones: list[Zone] = []
    for el in data["elements"]:
        tags = el.get("tags", {})
        z = kind(tags)
        if z is None:
            continue
        name = tags.get("name:uz") or tags.get("name") or ""
        if z in C.ZONE_BUFFER_M:
            ln = _line(el)
            if ln is not None:
                lines.setdefault((z, name), []).append(ln)
            continue
        g = _area(el)
        if g is None:
            continue
        for p in _parts(g):
            utm = transform(_to_utm, p).buffer(0)
            if utm.area < C.MIN_ZONE_POLY_M2:
                continue
            simple = utm.simplify(5)
            for q in _parts(simple):
                if q.geom_type == "Polygon":
                    zones.append(Zone(z, name, 0, transform(_to_wgs, q), q))

    for (z, name), segs in lines.items():
        buf = C.ZONE_BUFFER_M[z]
        u = unary_union(segs)
        merged = linemerge(u) if u.geom_type == "MultiLineString" else u
        for ln in _parts(merged):
            utm = transform(_to_utm, ln).simplify(5)
            zones.append(Zone(z, name, buf, transform(_to_wgs, utm), utm.buffer(buf)))
    return zones


def fetch_districts() -> tuple[list[tuple[str, object]], object]:
    """Return [(name, Polygon in UTM)] for the city districts and the city outline in UTM."""
    data = overpass(
        f'[out:json][timeout:180];rel[boundary=administrative][admin_level=4][name="{C.REGION}"]->.c;'
        f'.c out geom;.c map_to_area->.a;rel(area.a)[boundary=administrative][admin_level=6];out geom;'
    )
    city, cands = None, []
    for el in data["elements"]:
        tags = el.get("tags", {})
        g = _area(el)
        if g is None:
            continue
        g = transform(_to_utm, g).buffer(0)
        if tags.get("admin_level") == "4" and tags.get("name") == C.REGION:
            city = g
        elif tags.get("admin_level") == "6" and tags.get("name"):
            cands.append((clean_name(tags["name"]), g))
    if city is None:
        raise RuntimeError("City boundary not found in OSM")
    districts = [(n, g) for n, g in cands if city.contains(g.representative_point())]
    return sorted(districts), city


class Context:
    """Spatial lookups used to enrich each detection."""

    def __init__(self):
        self.zones = fetch_zones()
        self.districts, self.city = fetch_districts()
        self._ztree = STRtree([z.area_utm for z in self.zones])
        self._dtree = STRtree([g for _, g in self.districts])

    def zones_for(self, poly_utm) -> list[str]:
        hit = {self.zones[i].zone for i in self._ztree.query(poly_utm, predicate="intersects")}
        return sorted(hit, key=lambda z: -C.ZONE_WEIGHT[z])

    def district_for(self, point_utm) -> str | None:
        idx = self._dtree.query(point_utm, predicate="intersects")
        return self.districts[int(idx[0])][0] if len(idx) else None

    def in_city(self, point_utm) -> bool:
        return self.city.contains(point_utm)

    @staticmethod
    def zone_weight(zones: list[str]) -> float:
        return max((C.ZONE_WEIGHT[z] for z in zones), default=C.ZONE_WEIGHT_NONE)

    def zones_geojson(self) -> dict:
        feats = []
        for z in self.zones:
            g = mapping(z.geom_wgs)
            g["coordinates"] = _round(g["coordinates"])
            feats.append({"type": "Feature", "properties": {"zone": z.zone, "name": z.name, "buffer_m": z.buffer_m}, "geometry": g})
        return {"type": "FeatureCollection", "features": feats}

    def districts_geojson(self) -> dict:
        feats = []
        for name, g in self.districts:
            for p in _parts(transform(_to_wgs, g.simplify(15))):
                geom = mapping(p)
                geom["coordinates"] = _round(geom["coordinates"])
                feats.append({"type": "Feature", "properties": {"name": name}, "geometry": geom})
        return {"type": "FeatureCollection", "features": feats}


def _round(c):
    if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
        return [round(c[0], 5), round(c[1], 5)]
    return [_round(x) for x in c]


def to_utm(geom_wgs):
    return transform(_to_utm, shape(geom_wgs) if isinstance(geom_wgs, dict) else geom_wgs)


if __name__ == "__main__":
    ctx = Context()
    from collections import Counter
    print("zones:", dict(Counter(z.zone for z in ctx.zones)))
    print("districts:", [n for n, _ in ctx.districts])
    print("zones.geojson size: %.1f MB" % (len(json.dumps(ctx.zones_geojson())) / 1e6))
