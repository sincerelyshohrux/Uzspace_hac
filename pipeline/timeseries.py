"""Monthly built-up signal per detection, used to estimate when construction started."""
from __future__ import annotations

import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import date

import numpy as np

from . import config as C
from . import s2

TS_BANDS = ["B04", "B08", "B11"]
SEASON = range(3, 12)  # March..November; winter scenes are often cloudy or snowy


def month_list() -> list[str]:
    y0, m0 = map(int, C.MONTHS[0].split("-"))
    y1, m1 = map(int, C.MONTHS[1].split("-"))
    out, y, m = [], y0, m0
    while (y, m) <= (y1, m1):
        out.append(f"{y}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def best_scene(month: str):
    y, m = map(int, month.split("-"))
    end = date(y + (m == 12), m % 12 + 1, 1)
    items = s2.search(f"{month}-01", end.isoformat(), C.MONTHLY_MAX_CLOUD)
    return min(items, key=lambda it: it.properties["eo:cloud_cover"]) if items else None


def built_score(b: dict) -> np.ndarray:
    """0..1: high when the surface is non-vegetated and has a built-up / bare spectral signature."""
    e = 1e-6
    ndvi = (b["B08"] - b["B04"]) / (b["B08"] + b["B04"] + e)
    ndbi = (b["B11"] - b["B08"]) / (b["B11"] + b["B08"] + e)
    return np.clip((ndbi + 0.1) / 0.25, 0, 1) * np.clip((0.45 - ndvi) / 0.3, 0, 1)


def series(labels: np.ndarray, transform10, ids: list[int]) -> dict[int, list[dict]]:
    """Mean built score inside each labelled object for every month (None when not observed)."""
    rows, cols = np.nonzero(labels)
    lab = labels[rows, cols]
    t = transform10
    x = t[2] + (cols + 0.5) * t[0]
    y = t[5] + (rows + 0.5) * t[4]
    out = {i: [] for i in ids}
    months = month_list()
    picks = {m: best_scene(m) for m in months if int(m[5:]) in SEASON}
    with ThreadPoolExecutor(max_workers=4) as ex:  # prefetch into the cache in parallel
        list(ex.map(lambda it: s2.load_scene(it, TS_BANDS, C.MONTHLY_RES), [it for it in picks.values() if it]))
    for month in months:
        item = picks.get(month)
        vals = None
        if item is not None:
            sc = s2.load_scene(item, TS_BANDS, C.MONTHLY_RES)
            t20 = sc["_transform"]
            c20 = ((x - t20[2]) / t20[0]).astype(int)
            r20 = ((y - t20[5]) / t20[4]).astype(int)
            h, w = sc["B04"].shape
            ok = (r20 >= 0) & (r20 < h) & (c20 >= 0) & (c20 < w)
            score = np.full(lab.shape, np.nan, dtype="float32")
            score[ok] = built_score(sc)[r20[ok], c20[ok]]
            vals = score
            print(f"    {month}: {item.datetime.date()} cloud {item.properties['eo:cloud_cover']:.0f}%", flush=True)
        for i in ids:
            v = None
            if vals is not None:
                px = vals[lab == i]
                if px.size and np.isfinite(px).mean() >= 0.5:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore", RuntimeWarning)
                        v = round(float(np.nanmean(px)), 2)
            out[i].append({"month": month, "built": v})
    return out


def start_month(points: list[dict], rising: bool = True) -> str | None:
    """First month after which the signal stays past the midpoint between its early and late level."""
    obs = [(p["month"], p["built"]) for p in points if p["built"] is not None]
    if len(obs) < 8:
        return None
    vals = np.array([v for _, v in obs])
    pre, post = np.median(vals[:4]), np.median(vals[-4:])
    if abs(post - pre) < 0.1:
        return None
    mid = (pre + post) / 2
    for k in range(len(obs) - 2):
        window = vals[k:k + 3]
        if (rising and (window >= mid).all()) or (not rising and (window <= mid).all()):
            return obs[k][0]
    return None
