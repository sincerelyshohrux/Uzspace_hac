"""Validation: stratified random sample of pixels, manual labels, accuracy metrics.

    pipeline/.venv/bin/python -m pipeline.validate sample     # writes validation/ (points + chips)
    open validation/label.html                                 # team labels the points (blind)
    pipeline/.venv/bin/python -m pipeline.validate evaluate   # labels.csv -> outputs/metrics.json

Sampling follows the usual good practice for change maps (stratified random sampling,
area-weighted estimates): every pixel inside the city falls in exactly one stratum,
points are drawn at random within each stratum, and estimates are weighted by stratum size.
"""
from __future__ import annotations

import argparse
import csv
import json
import random

import numpy as np
from affine import Affine
from rasterio import features

from . import chips, composite, detect, zones
from . import config as C

OUT = C.ROOT / "validation"
STRATA = {          # stratum -> number of points
    "alert": 100,   # inside a published alert polygon
    "candidate": 100,  # passed the pixel rule but not published (filtered / ranked out)
    "other": 150,   # everything else inside the city
}
CHIP_EXTENT_M = 300
FEATURES = ["d_ndvi", "d_ndbi", "ndvi1", "ndvi2", "ndbi1", "ndbi2", "bsi1", "bsi2", "mndwi1", "mndwi2", "peak2"]
LABELS = {"change", "no_change"}   # "unsure" is dropped


def _layers():
    t1, t2 = composite.seasonal(*C.T1), composite.seasonal(*C.T2)
    cand, strength, idx = detect.change_mask(t1, t2)
    a, b = idx["t1"], idx["t2"]
    layers = {
        "d_ndvi": idx["d_ndvi"], "d_ndbi": idx["d_ndbi"],
        "ndvi1": a["ndvi"], "ndvi2": b["ndvi"], "ndbi1": a["ndbi"], "ndbi2": b["ndbi"],
        "bsi1": a["bsi"], "bsi2": b["bsi"], "mndwi1": a["mndwi"], "mndwi2": b["mndwi"],
        "peak2": t2["ndvi_peak"],
    }
    return t1, t2, cand, layers


def sample(seed: int = 42) -> None:
    t1, t2, cand, layers = _layers()
    tr = t2["transform"]
    shape_ = cand.shape
    aff = Affine(*tr[:6])

    _, city = zones.fetch_districts()
    city_mask = features.rasterize([(city, 1)], out_shape=shape_, transform=aff, fill=0).astype(bool)

    alerts = json.loads((C.ROOT / "outputs" / "alerts.geojson").read_text())["features"]
    ids = [f["properties"]["alert_id"] for f in alerts]
    conf = {f["properties"]["alert_id"]: f["properties"]["confidence"] for f in alerts}
    alert_idx = features.rasterize(
        [(zones.to_utm(f["geometry"]), k + 1) for k, f in enumerate(alerts)],
        out_shape=shape_, transform=aff, fill=0, dtype="int32")

    valid = np.isfinite(layers["d_ndvi"]) & np.isfinite(layers["d_ndbi"]) & city_mask
    masks = {
        "alert": valid & (alert_idx > 0),
        "candidate": valid & cand & (alert_idx == 0),
        "other": valid & ~cand & (alert_idx == 0),
    }
    rng = np.random.default_rng(seed)
    rgb1, rgb2 = chips.to_rgb(t1), chips.to_rgb(t2)
    (OUT / "chips").mkdir(parents=True, exist_ok=True)

    rows = []
    for stratum, n in STRATA.items():
        rr, cc = np.nonzero(masks[stratum])
        pick = rng.choice(len(rr), size=min(n, len(rr)), replace=False)
        for i in pick:
            r, c = int(rr[i]), int(cc[i])
            x, y = aff * (c + 0.5, r + 0.5)
            lon, lat = zones._to_wgs(x, y)
            k = int(alert_idx[r, c])
            rows.append({
                "stratum": stratum, "stratum_pixels": int(masks[stratum].sum()),
                "lon": round(lon, 6), "lat": round(lat, 6),
                "alert_id": ids[k - 1] if k else "", "confidence": conf[ids[k - 1]] if k else "",
                "candidate": int(cand[r, c]),
                **{f: round(float(layers[f][r, c]), 4) for f in FEATURES},
            })

    # Blind order: the labeller never sees the stratum or the prediction
    random.Random(seed).shuffle(rows)
    for k, row in enumerate(rows, 1):
        row["point_id"] = f"P{k:03d}"
        for tag, rgb in (("t1", rgb1), ("t2", rgb2)):
            chips.cut(rgb, tr, row["lon"], row["lat"], CHIP_EXTENT_M).convert("RGB").save(
                OUT / "chips" / f"{row['point_id']}_{tag}.jpg", quality=88)

    cols = ["point_id", "stratum", "stratum_pixels", "lon", "lat", "alert_id", "confidence", "candidate", *FEATURES]
    with open(OUT / "sample.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    public = [{"id": r["point_id"], "lon": r["lon"], "lat": r["lat"]} for r in rows]
    (OUT / "sample.js").write_text("window.SAMPLE = " + json.dumps(public) + ";\n")
    print(f"{len(rows)} points -> {OUT}  " + ", ".join(f"{s}: {int(m.sum())} px" for s, m in masks.items()))


def sampling_summary() -> list[dict] | None:
    """Strata of the current validation sample (for the accuracy page), or None if not sampled."""
    path = OUT / "sample.csv"
    if not path.exists():
        return None
    acc: dict[str, dict] = {}
    for r in csv.DictReader(open(path)):
        d = acc.setdefault(r["stratum"], {"stratum": r["stratum"], "pixels": int(r["stratum_pixels"]), "points": 0})
        d["points"] += 1
    return [acc[s] for s in STRATA if s in acc]


# ---------------------------------------------------------------- evaluation

def _weighted_prf(y, pred, w):
    tp = float(np.sum(w[(y == 1) & (pred == 1)]))
    fp = float(np.sum(w[(y == 0) & (pred == 1)]))
    fn = float(np.sum(w[(y == 1) & (pred == 0)]))
    p = tp / (tp + fp) if tp + fp else 0.0
    r = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * p * r / (p + r) if p + r else 0.0
    return round(p, 3), round(r, 3), round(f1, 3)


def evaluate(labels_path, out_path=None) -> None:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.metrics import average_precision_score
    from sklearn.model_selection import StratifiedKFold, cross_val_predict

    rows = {r["point_id"]: r for r in csv.DictReader(open(OUT / "sample.csv"))}
    lab_rows = list(csv.DictReader(open(labels_path)))
    labels = {r["point_id"]: r["label"] for r in lab_rows}
    secs = [int(r["seconds"]) for r in lab_rows if r.get("seconds", "").isdigit()]
    if not secs:
        raise SystemExit("labels.csv has no 'seconds' column: label with the current page (v2)")
    # Below ~2 s a point cannot be compared on both images; later passes are faster because tiles are cached.
    if np.median(secs) < 2:
        raise SystemExit(f"median {np.median(secs):.0f} s per point is too fast for careful labelling; please re-check")
    data = [(rows[k], v) for k, v in labels.items() if k in rows and v in LABELS]
    if len(data) < 60:
        raise SystemExit(f"only {len(data)} usable labels; label at least 60 points first")

    y = np.array([1 if v == "change" else 0 for _, v in data])
    if y.sum() < 10 or (1 - y).sum() < 10:
        raise SystemExit("need at least 10 points of each class")
    # Stratum weight = pixels in stratum / labelled points in stratum
    n_lab = {s: sum(1 for r, _ in data if r["stratum"] == s) for s in STRATA}
    w = np.array([int(r["stratum_pixels"]) / n_lab[r["stratum"]] for r, _ in data])
    X = np.array([[float(r[f]) for f in FEATURES] for r, _ in data])

    # Baseline: plain index differencing, no seasonal or object filters
    base = ((X[:, 0] > C.D_NDVI_MIN) | (X[:, 1] > C.D_NDBI_MIN)) & (X[:, 8] < 0) & (X[:, 9] < 0)
    # Deployed system: the point lies inside a published alert
    system = np.array([1 if r["alert_id"] else 0 for r, _ in data])

    rf = RandomForestClassifier(n_estimators=400, min_samples_leaf=3, class_weight="balanced", random_state=0)
    cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=0)
    proba = cross_val_predict(rf, X, y, cv=cv, method="predict_proba")[:, 1]
    thr = 0.5
    ml = (proba >= thr).astype(int)

    bp, br, bf = _weighted_prf(y, base.astype(int), w)
    mp, mr, mf = _weighted_prf(y, ml, w)
    sp, sr, sf = _weighted_prf(y, system, w)
    curve = []
    for t in np.round(np.arange(0.1, 0.95, 0.1), 2):
        p, r, _ = _weighted_prf(y, (proba >= t).astype(int), w)
        if p > 0:
            curve.append({"threshold": float(t), "precision": p, "recall": r})

    in_alert = [(r["alert_id"], v) for r, v in data if r["alert_id"]]
    checked = sorted({a for a, _ in in_alert})
    correct = sum(1 for a in checked if any(v == "change" for b, v in in_alert if b == a))

    rf.fit(X, y)
    imp = sorted(zip(FEATURES, rf.feature_importances_), key=lambda t: -t[1])

    metrics = {
        "is_mock": False,
        "test_points": len(data),
        "baseline": {"precision": bp, "recall": br, "f1": bf},
        "ml": {"precision": mp, "recall": mr, "f1": mf,
               "pr_auc": round(float(average_precision_score(y, proba, sample_weight=w)), 3)},
        "system": {"precision": sp, "recall": sr, "f1": sf},
        "threshold": thr,
        "pr_curve": curve,
        "confusion": {"tp": int(((y == 1) & (ml == 1)).sum()), "fp": int(((y == 0) & (ml == 1)).sum()),
                      "fn": int(((y == 1) & (ml == 0)).sum()), "tn": int(((y == 0) & (ml == 0)).sum())},
        "object_precision": {"checked": len(checked), "correct": correct},
        "sampling": sampling_summary(),
        "labelled": {"usable": len(data), "total": len(rows), "median_seconds": float(np.median(secs))},
        "feature_importance": {f: round(float(v), 3) for f, v in imp},
        "dataset": {
            "source": "Sentinel-2 L2A (Microsoft Planetary Computer), labelled by the team",
            "period_t1": f"{C.T1[0][:7]}..{C.T1[1][:7]}",
            "period_t2": f"{C.T2[0][:7]}..{C.T2[1][:7]}",
            "n_train": int(round(len(data) * 4 / 5)),
            "n_test": len(data),
            "cv": "5-fold stratified CV, out-of-fold, area-weighted",
            "features": FEATURES,
        },
        "limitations": [
            f"Baho {len(data)} ta qo'lda belgilangan nuqtaga asoslangan; ishonch oralig'i keng.",
            "Belgilar 10 m Sentinel-2 va ochiq yuqori aniqlikdagi xaritalar bo'yicha qo'yilgan, joyida tekshirilmagan.",
            "Precision va recall qatlam (strata) maydoniga qarab tortilgan.",
            "Sentinel-2 aniqligi 10 m: taxminan 500 m² dan kichik obyektlar aniqlanmaydi.",
            "Ruxsatnomalar reyestriga ulanish yo'q.",
        ],
    }
    out_path = out_path or C.ROOT / "outputs" / "metrics.json"
    open(out_path, "w").write(json.dumps(metrics, ensure_ascii=False, indent=1))
    print(json.dumps({k: metrics[k] for k in ("test_points", "baseline", "ml", "system", "object_precision")}, indent=1))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("sample")
    ev = sub.add_parser("evaluate")
    ev.add_argument("--labels", default=str(OUT / "labels.csv"))
    ev.add_argument("--out", default=None, help="default: outputs/metrics.json")
    a = ap.parse_args()
    sample() if a.cmd == "sample" else evaluate(a.labels, a.out)
