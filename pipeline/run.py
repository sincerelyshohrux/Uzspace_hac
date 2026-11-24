"""Run the full pipeline and write outputs in the format the backend serves.

    pipeline/.venv/bin/python -m pipeline.run --out outputs
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
from datetime import datetime, timezone
from pathlib import Path

from . import chips, composite, detect, timeseries, zones
from . import config as C

PERMIT = "no_data"         # no access to the official permit registry
PERMIT_FACTOR = 1.0


def area_factor(area_m2: float) -> float:
    """0.4 at the smallest detectable object, 1.0 at the largest kept one, log scale in between.
    (The old log10(area)/4 capped at 10 000 m2, so most alerts got 1.0 and identical scores.)"""
    lo, hi = math.log10(C.MIN_PIXELS * C.RES * C.RES), math.log10(C.MAX_AREA_M2)
    x = (math.log10(max(area_m2, 1)) - lo) / (hi - lo)
    return round(0.4 + 0.6 * min(1.0, max(0.0, x)), 2)


def risk(confidence: float, area_m2: float, zone_weight: float) -> tuple[int, dict]:
    area_factor_ = area_factor(area_m2)
    score = round(100 * confidence * zone_weight * area_factor_ * PERMIT_FACTOR)
    return score, {"confidence": confidence, "zone_weight": zone_weight, "area_factor": area_factor_, "permit_factor": PERMIT_FACTOR}


def _sampling():
    from .validate import sampling_summary
    return sampling_summary()


def pending_metrics() -> dict:
    """Placeholder until validation is done; the app labels it as DEMO because is_mock is true."""
    return {
        "is_mock": True,
        "test_points": 0,
        "sampling": _sampling(),
        "baseline": {"precision": 0, "recall": 0, "f1": 0},
        "ml": {"precision": 0, "recall": 0, "f1": 0, "pr_auc": 0},
        "threshold": 0.5,
        "pr_curve": [],
        "confusion": {"tp": 0, "fp": 0, "fn": 0, "tn": 0},
        "object_precision": {"checked": 0, "correct": 0},
        "dataset": {
            "source": "Sentinel-2 L2A (Microsoft Planetary Computer)",
            "period_t1": f"{C.T1[0][:7]}..{C.T1[1][:7]}",
            "period_t2": f"{C.T2[0][:7]}..{C.T2[1][:7]}",
            "n_train": 0,
            "n_test": 0,
            "cv": "not validated yet",
            "features": ["ΔNDVI", "ΔNDBI", "NDVI T2", "NDVI peak T2", "MNDWI"],
        },
        "limitations": [
            "Natijalar hali qo'lda tekshirilgan namuna bilan baholanmagan.",
            "Sentinel-2 aniqligi 10 m: taxminan 500 m² dan kichik obyektlar aniqlanmaydi.",
            "Dala ishlari va mavsumiy tuproq ochilishi yolg'on signal berishi mumkin.",
            "Ruxsatnomalar reyestriga ulanish yo'q.",
            "Qurilish boshlanish oyi taxminiy (bulutli oylar ta'sir qiladi).",
        ],
    }


def main(out: Path) -> None:
    print("1/4 seasonal composites", flush=True)
    t1 = composite.seasonal(*C.T1)
    t2 = composite.seasonal(*C.T2)

    print("2/4 change detection", flush=True)
    dets, labels = detect.detect(t1, t2)
    print(f"    {len(dets)} objects", flush=True)

    print("    restricted zones and districts (OpenStreetMap)", flush=True)
    ctx = zones.Context()
    if C.CITY_ONLY:
        dets = [d for d in dets if ctx.in_city(d.geom_utm.centroid)]
    dets = dets[: C.MAX_ALERTS]
    print(f"    {len(dets)} objects inside {C.REGION}", flush=True)

    print("3/4 monthly time series", flush=True)
    ts = timeseries.series(labels, t2["transform"], [d.label for d in dets])

    print("4/4 chips and output files", flush=True)
    if (out / "chips").exists():
        shutil.rmtree(out / "chips")
    rgb1, rgb2 = chips.to_rgb(t1), chips.to_rgb(t2)
    features, series_out = [], {}
    for k, d in enumerate(dets, 1):
        aid = f"TSH-2025-{k:04d}"
        c = d.geom_wgs.centroid
        lon, lat = round(c.x, 6), round(c.y, 6)
        zs = ctx.zones_for(d.geom_utm)
        score, breakdown = risk(d.confidence, d.area_m2, ctx.zone_weight(zs))
        before, after = f"chips/{aid}_before.png", f"chips/{aid}_after.png"
        chips.write(rgb1, rgb2, t2["transform"], lon, lat, d.area_m2, out / before, out / after)
        points = ts[d.label]
        series_out[aid] = points
        ring = [[round(x, 6), round(y, 6)] for x, y in d.geom_wgs.exterior.coords]
        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [ring]},
            "properties": {
                "alert_id": aid, "district": ctx.district_for(d.geom_utm.centroid) or C.REGION, "area_m2": round(d.area_m2),
                "lat": lat, "lon": lon, "confidence": d.confidence, "change_type": d.change_type,
                "start_month": timeseries.start_month(points, rising=d.change_type != "demolition"),
                "zones": zs, "permit_match": PERMIT, "risk_score": score, "risk": breakdown,
                "chip_before": before, "chip_after": after,
            },
        })

    meta = {
        "is_mock": False,
        "region": C.REGION,
        "period_t1": f"{C.T1[0][:7]}..{C.T1[1][:7]}",
        "period_t2": f"{C.T2[0][:7]}..{C.T2[1][:7]}",
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "districts": [n for n, _ in ctx.districts],
        "zones": sorted(C.ZONE_WEIGHT, key=lambda z: -C.ZONE_WEIGHT[z]),
        "scenes_t1": t1["dates"].tolist(),
        "scenes_t2": t2["dates"].tolist(),
    }

    def dump(name: str, obj) -> None:
        (out / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    out.mkdir(parents=True, exist_ok=True)
    dump("alerts.geojson", {"type": "FeatureCollection", "features": features})
    dump("timeseries.json", series_out)
    dump("meta.json", meta)
    dump("metrics.json", pending_metrics())
    dump("zones.geojson", ctx.zones_geojson())
    dump("districts.geojson", ctx.districts_geojson())
    (out / "demo_activity.json").unlink(missing_ok=True)
    # Inspector statuses belong to the previous alert set; start with a clean database
    for f in ("app.db", "app.db-wal", "app.db-shm"):
        (out / f).unlink(missing_ok=True)
    print(f"done: {len(features)} alerts -> {out}", flush=True)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=C.ROOT / "outputs")
    main(ap.parse_args().out)
