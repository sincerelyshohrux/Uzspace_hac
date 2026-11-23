"""Synthetic demo data generator.

Writes every file of the data contract into outputs/ with is_mock = true, so the
backend and frontend can be built and demoed before the real pipeline is ready.
NOT REAL DATA. The real pipeline (pipeline/) writes the same files.

    python scripts/make_mock_data.py --out ../outputs --seed 42
"""
from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import zlib
from datetime import datetime, timedelta, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import MultiPoint, Point, Polygon, box
from shapely.ops import voronoi_diagram

M_LAT = 111_320.0


def m_lon(lat: float) -> float:
    return M_LAT * math.cos(math.radians(lat))


DISTRICTS = [
    ("Bektemir", 41.209, 69.334, 3.0),
    ("Chilonzor", 41.275, 69.204, 1.0),
    ("Mirobod", 41.287, 69.284, 1.0),
    ("Mirzo Ulug'bek", 41.338, 69.335, 1.5),
    ("Olmazor", 41.355, 69.215, 1.2),
    ("Sergeli", 41.227, 69.220, 3.0),
    ("Shayxontohur", 41.320, 69.230, 0.8),
    ("Uchtepa", 41.290, 69.170, 1.5),
    ("Yakkasaroy", 41.285, 69.255, 0.6),
    ("Yashnobod", 41.290, 69.330, 1.5),
    ("Yunusobod", 41.365, 69.285, 1.5),
    ("Yangihayot", 41.205, 69.180, 3.0),
]

CANAL = [(69.12, 41.335), (69.17, 41.318), (69.21, 41.31), (69.25, 41.296), (69.29, 41.288), (69.33, 41.268), (69.37, 41.255)]
RIVER = [(69.14, 41.37), (69.18, 41.355), (69.24, 41.35), (69.30, 41.345), (69.36, 41.33)]
POWER = [(69.13, 41.20), (69.20, 41.245), (69.27, 41.29), (69.35, 41.345)]
RAIL = [(69.16, 41.24), (69.24, 41.265), (69.30, 41.28), (69.39, 41.30)]
LINES = {"canal": CANAL, "river": RIVER, "power_line": POWER, "railway": RAIL}
BUFFER_M = {"canal": 30, "river": 50, "power_line": 30, "railway": 25}


def rect(lon: float, lat: float, w: float, h: float) -> list[tuple[float, float]]:
    dx, dy = w / 2 / m_lon(lat), h / 2 / M_LAT
    return [(lon - dx, lat - dy), (lon + dx, lat - dy), (lon + dx, lat + dy), (lon - dx, lat + dy), (lon - dx, lat - dy)]


PARKS = [rect(69.282, 41.318, 700, 500), rect(69.245, 41.338, 500, 450), rect(69.205, 41.292, 450, 380), rect(69.318, 41.31, 520, 420)]
FARMS = [rect(69.17, 41.19, 3200, 1800), rect(69.30, 41.185, 3000, 1700), rect(69.12, 41.26, 1800, 2600)]
CEMETERY = [rect(69.265, 41.255, 350, 300)]
POLYS = {"park": PARKS, "farmland": FARMS, "cemetery": CEMETERY}

ZONE_WEIGHT = {"power_line": 1.0, "canal": 0.9, "river": 0.9, "park": 0.8, "farmland": 0.7, "railway": 0.6, "cemetery": 0.6}
PERMIT_FACTOR = {"none": 1.0, "no_data": 1.0, "partial": 0.6, "matched": 0.2}
MONTHS = [f"{y}-{m:02d}" for y in (2023, 2024, 2025) for m in range(1, 13)]

INSPECTORS = ["a.karimov", "d.rahimova", "s.toshev", "m.yusupova"]

# City outline used to clip the (approximate, demo) district cells
CITY = Polygon([(69.10, 41.25), (69.12, 41.33), (69.18, 41.385), (69.27, 41.40), (69.36, 41.385), (69.41, 41.33),
                (69.40, 41.24), (69.35, 41.175), (69.24, 41.165), (69.14, 41.18), (69.10, 41.25)])


def chip_extent_m(area_m2: float) -> float:
    """Side length (metres) of the square chip centred on the alert. Same rule in the frontend."""
    return max(120.0, math.sqrt(area_m2) * 2.6)


class Gen:
    def __init__(self, seed: int):
        self.r = random.Random(seed)

    def between(self, a: float, b: float) -> float:
        return a + (b - a) * self.r.random()

    def weighted(self, items):
        vals, weights = zip(*items)
        return self.r.choices(vals, weights=weights, k=1)[0]


def district_cells() -> dict[str, Polygon]:
    pts = MultiPoint([(lon, lat) for _, lat, lon, _ in DISTRICTS])
    cells = voronoi_diagram(pts, envelope=box(68.9, 41.0, 69.6, 41.6))
    out = {}
    for name, lat, lon, _ in DISTRICTS:
        p = Point(lon, lat)
        for c in cells.geoms:
            if c.contains(p):
                out[name] = c.intersection(CITY)
                break
    return out


def district_of(cells: dict[str, Polygon], lon: float, lat: float) -> str:
    p = Point(lon, lat)
    for name, poly in cells.items():
        if poly.contains(p):
            return name
    return min(DISTRICTS, key=lambda d: (d[2] - lon) ** 2 + (d[1] - lat) ** 2)[0]


# ------------------------------------------------------------------ chips
def draw_chip(g: Gen, alert: dict, ring_m: list[tuple[float, float]], which: str, path: Path) -> None:
    S = 256
    ext = chip_extent_m(alert["area_m2"])
    k = S / ext  # px per metre

    def px(x: float, y: float) -> tuple[float, float]:
        return (S / 2 + x * k, S / 2 - y * k)

    rr = random.Random(zlib.crc32(alert["alert_id"].encode()))
    img = Image.new("RGB", (S, S), (118, 132, 88))
    d = ImageDraw.Draw(img)
    # field stripes
    for i in range(0, S, 9):
        shade = rr.randint(-10, 10)
        d.rectangle([0, i, S, i + 4], fill=(110 + shade, 128 + shade, 80 + shade))
    # road
    ry = rr.randint(30, 70)
    d.rectangle([0, S - ry - 10, S, S - ry + 6], fill=(168, 162, 150))
    # neighbouring roofs
    for _ in range(rr.randint(2, 5)):
        x, y = rr.choice([(rr.randint(5, 60), rr.randint(5, 200)), (rr.randint(190, 240), rr.randint(5, 200))])
        w, h = rr.randint(18, 36), rr.randint(14, 30)
        d.rectangle([x, y, x + w, y + h], fill=rr.choice([(176, 172, 168), (150, 96, 80), (190, 190, 196)]), outline=(90, 90, 90))
    # trees
    for _ in range(rr.randint(4, 10)):
        x, y, r = rr.randint(0, S), rr.randint(0, S), rr.randint(4, 8)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(58, 96, 52))
    # zone context
    zones = alert["zones"]
    if "canal" in zones or "river" in zones:
        d.line([(0, 40), (S, 90)], fill=(70, 110, 140), width=14 if "river" in zones else 9)
    if "power_line" in zones:
        d.line([(0, S), (S, 0)], fill=(40, 40, 40), width=1)
        for t in (0.2, 0.55, 0.9):
            cx, cy = t * S, S - t * S
            d.rectangle([cx - 3, cy - 3, cx + 3, cy + 3], fill=(60, 60, 60))
    if "railway" in zones:
        d.line([(0, 150), (S, 120)], fill=(120, 110, 100), width=6)
        d.line([(0, 150), (S, 120)], fill=(80, 70, 60), width=1)

    poly_px = [px(x, y) for x, y in ring_m]
    ct = alert["change_type"]
    if which == "before":
        if ct == "demolition":
            d.polygon(poly_px, fill=(172, 170, 166), outline=(80, 80, 80))
    else:
        if ct == "new_construction":
            d.polygon(poly_px, fill=(198, 200, 206), outline=(70, 70, 76))
            # roof ridge
            d.line([poly_px[0], poly_px[2]], fill=(160, 162, 170), width=1)
        elif ct == "land_clearing":
            d.polygon(poly_px, fill=(176, 146, 104))
        else:  # demolition -> rubble
            d.polygon(poly_px, fill=(140, 128, 112))
            for _ in range(40):
                x = rr.uniform(min(p[0] for p in poly_px), max(p[0] for p in poly_px))
                y = rr.uniform(min(p[1] for p in poly_px), max(p[1] for p in poly_px))
                d.point((x, y), fill=(100, 92, 84))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    # a little sensor noise
    noise = Image.effect_noise((S, S), 10).convert("RGB")
    img = Image.blend(img, noise, 0.06)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, optimize=True)


# ------------------------------------------------------------------ main
def generate(out: Path, seed: int, n: int) -> None:
    g = Gen(seed)
    cells = district_cells()
    if out.exists():
        for name in ("chips",):
            shutil.rmtree(out / name, ignore_errors=True)
    out.mkdir(parents=True, exist_ok=True)

    features, timeseries = [], {}
    for i in range(n):
        scenario = g.weighted([("none", 40), ("canal", 14), ("power_line", 10), ("farmland", 14), ("park", 7),
                               ("river", 6), ("railway", 6), ("cemetery", 3)])
        zones: list[str] = []
        if scenario == "none":
            dname, dlat, dlon, _ = g.weighted([(d, d[3]) for d in DISTRICTS])
            lon, lat = dlon + g.between(-0.018, 0.018), dlat + g.between(-0.014, 0.014)
        elif scenario in LINES:
            line = LINES[scenario]
            j = g.r.randrange(len(line) - 1)
            t = g.r.random()
            (x1, y1), (x2, y2) = line[j], line[j + 1]
            lon, lat = x1 + (x2 - x1) * t, y1 + (y2 - y1) * t
            # inside the buffer corridor
            off = g.between(-BUFFER_M[scenario] * 0.8, BUFFER_M[scenario] * 0.8)
            lon += off / m_lon(lat) * 0.7
            lat += off / M_LAT * 0.7
            zones.append(scenario)
        else:
            r = g.r.choice(POLYS[scenario])
            lon, lat = g.between(r[0][0], r[1][0]), g.between(r[0][1], r[2][1])
            zones.append(scenario)
        if scenario != "none" and g.r.random() < 0.15:
            extra = g.r.choice(["farmland", "canal", "power_line"])
            if extra not in zones:
                zones.append(extra)

        change_type = g.weighted([("new_construction", 70), ("land_clearing", 20), ("demolition", 10)])
        area = round(math.exp(g.between(math.log(800), math.log(15000))))
        aspect = g.between(0.5, 1.6)
        w = math.sqrt(area * aspect)
        h = area / w
        ang = g.between(-0.6, 0.6)
        ring_m = []
        for x, y in [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2), (-w / 2, -h / 2)]:
            ring_m.append((x * math.cos(ang) - y * math.sin(ang), x * math.sin(ang) + y * math.cos(ang)))
        ring = [[round(lon + x / m_lon(lat), 6), round(lat + y / M_LAT, 6)] for x, y in ring_m]

        permit = g.weighted([("none", 55), ("matched", 25), ("partial", 10), ("no_data", 10)])
        confidence = round(g.between(0.6, 0.97), 2)
        zone_weight = max((ZONE_WEIGHT[z] for z in zones), default=0.3)
        area_factor = round(min(1.0, math.log10(area) / 4), 2)
        permit_factor = PERMIT_FACTOR[permit]
        risk = round(100 * confidence * zone_weight * area_factor * permit_factor)

        start_idx = int(g.between(27, 33)) if change_type == "land_clearing" else int(g.between(7, 32))
        alert_id = f"TSH-2025-{i + 1:04d}"
        props = {
            "alert_id": alert_id,
            "district": district_of(cells, lon, lat),
            "area_m2": area,
            "lat": round(lat, 6),
            "lon": round(lon, 6),
            "confidence": confidence,
            "change_type": change_type,
            "start_month": MONTHS[start_idx],
            "zones": zones,
            "permit_match": permit,
            "risk_score": risk,
            "risk": {"confidence": confidence, "zone_weight": zone_weight, "area_factor": area_factor, "permit_factor": permit_factor},
            "chip_before": f"chips/{alert_id}_before.png",
            "chip_after": f"chips/{alert_id}_after.png",
        }
        features.append({"type": "Feature", "geometry": {"type": "Polygon", "coordinates": [ring]}, "properties": props})
        draw_chip(g, props, ring_m, "before", out / props["chip_before"])
        draw_chip(g, props, ring_m, "after", out / props["chip_after"])

        base = g.between(0.05, 0.2)
        amp = g.between(0.25, 0.4) if change_type == "land_clearing" else g.between(0.55, 0.75)
        series = []
        for kk, month in enumerate(MONTHS):
            s = 1 / (1 + math.exp(-(kk - start_idx) / 1.3))
            if change_type == "demolition":
                s = 1 - s
            winter = month[-2:] in ("01", "12") and g.r.random() < 0.35
            v = base + amp * s + g.between(-0.05, 0.05) + (0.1 if change_type == "demolition" else 0)
            series.append({"month": month, "built": None if winter else round(min(1, max(0, v)), 2)})
        timeseries[alert_id] = series

    # ---------- layers
    zone_features = []
    names = {"canal": "Bo'zsuv kanali (demo)", "river": "Chirchiq tarmog'i (demo)",
             "power_line": "110 kV elektr liniyasi (demo)", "railway": "Temir yo'l (demo)"}
    for z, line in LINES.items():
        zone_features.append({"type": "Feature", "properties": {"zone": z, "name": names[z], "buffer_m": BUFFER_M[z]},
                              "geometry": {"type": "LineString", "coordinates": [list(p) for p in line]}})
    for z, polys in POLYS.items():
        label = {"park": "Bog'", "farmland": "Qishloq xo'jaligi yeri", "cemetery": "Qabriston"}[z]
        for k, ring in enumerate(polys):
            zone_features.append({"type": "Feature", "properties": {"zone": z, "name": f"{label} {k + 1} (demo)", "buffer_m": 0},
                                  "geometry": {"type": "Polygon", "coordinates": [[list(p) for p in ring]]}})

    district_features = []
    for name, poly in cells.items():
        coords = [[round(x, 5), round(y, 5)] for x, y in poly.exterior.coords]
        district_features.append({"type": "Feature", "properties": {"name": name}, "geometry": {"type": "Polygon", "coordinates": [coords]}})

    # ---------- demo inspector activity (seeded into SQLite on first start)
    ranked = sorted(features, key=lambda f: -f["properties"]["risk_score"])
    activity = []
    t0 = datetime(2026, 11, 2, 9, 0, tzinfo=timezone.utc)
    for idx, f in enumerate(ranked):
        aid = f["properties"]["alert_id"]
        user = INSPECTORS[idx % len(INSPECTORS)]
        ts = t0 + timedelta(hours=idx * 5 + g.r.randint(0, 3), minutes=g.r.randint(0, 59))
        if idx % 9 == 3:
            activity.append({"alert_id": aid, "old_status": "new", "new_status": "in_review", "note": None, "user": user,
                             "ts": ts.isoformat(timespec="seconds")})
            activity.append({"alert_id": aid, "old_status": "in_review", "new_status": "confirmed",
                             "note": "Joyida tekshirildi: ruxsatnoma ko'rsatilmadi (demo)", "user": user,
                             "ts": (ts + timedelta(days=2)).isoformat(timespec="seconds")})
        elif idx % 11 == 5:
            activity.append({"alert_id": aid, "old_status": "new", "new_status": "false_positive",
                             "note": "Mavsumiy dala ishlari, qurilish emas (demo)", "user": user, "ts": ts.isoformat(timespec="seconds")})
        elif idx % 7 == 2:
            activity.append({"alert_id": aid, "old_status": "new", "new_status": "in_review", "note": None, "user": user,
                             "ts": ts.isoformat(timespec="seconds")})

    metrics = {
        "is_mock": True,
        "test_points": 240,
        "baseline": {"precision": 0.58, "recall": 0.71, "f1": 0.64},
        "ml": {"precision": 0.84, "recall": 0.76, "f1": 0.80, "pr_auc": 0.86},
        "threshold": 0.5,
        "pr_curve": [
            {"threshold": t, "precision": p, "recall": r}
            for t, p, r in [(0.1, .52, .95), (0.2, .61, .92), (0.3, .69, .88), (0.4, .77, .83), (0.5, .84, .76),
                            (0.6, .88, .67), (0.7, .92, .55), (0.8, .95, .41), (0.9, .97, .24)]
        ],
        "confusion": {"tp": 73, "fp": 14, "fn": 23, "tn": 130},
        "object_precision": {"checked": 50, "correct": 43},
        "dataset": {
            "source": "Sentinel-2 L2A, Sentinel-1 GRD, Dynamic World V1",
            "period_t1": "2023-05..2023-09",
            "period_t2": "2025-05..2025-09",
            "n_train": 960,
            "n_test": 240,
            "cv": "spatial block k=5",
            "features": ["ΔNDBI", "ΔNDVI", "ΔBSI", "ΔDW built", "ΔS1 VV", "ΔS1 VH", "NDBI T2", "DW built T2", "slope"],
        },
        "limitations": [
            "Sentinel-2 aniqligi 10 m: taxminan 800 m² dan kichik obyektlar ishonchli aniqlanmaydi.",
            "Qishloq xo'jaligi mavsumi (hosil yig'ish, haydash) yolg'on signal berishi mumkin.",
            "Ruxsatnomalar reyestri demoda sintetik; real tizimga ulanish talab qilinadi.",
            "Qurilish boshlanish sanasi ± 1–2 oy aniqlikda (bulutli oylar ta'sir qiladi).",
            "Binoning balandligi va qavatlar soni aniqlanmaydi.",
            "Maydon bahosi taxminiy (piksel chegaralari).",
        ],
    }
    meta = {
        "is_mock": True,
        "region": "Toshkent",
        "period_t1": "2023-05..2023-09",
        "period_t2": "2025-05..2025-09",
        "generated_at": "2026-11-23T09:00:00Z",
        "districts": sorted(d[0] for d in DISTRICTS),
        "zones": ["canal", "river", "power_line", "railway", "park", "cemetery", "farmland"],
    }

    def dump(name: str, obj) -> None:
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    dump("alerts.geojson", {"type": "FeatureCollection", "features": features})
    dump("timeseries.json", timeseries)
    dump("metrics.json", metrics)
    dump("meta.json", meta)
    dump("zones.geojson", {"type": "FeatureCollection", "features": zone_features})
    dump("districts.geojson", {"type": "FeatureCollection", "features": district_features})
    dump("demo_activity.json", activity)
    print(f"wrote {len(features)} alerts, {len(zone_features)} zones, {len(district_features)} districts, "
          f"{len(activity)} demo audit entries -> {out}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=Path(__file__).resolve().parents[2] / "outputs")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("-n", type=int, default=74)
    a = ap.parse_args()
    generate(a.out, a.seed, a.n)
