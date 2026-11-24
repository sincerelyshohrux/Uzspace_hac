"""Sentinel-2 L2A access through Microsoft Planetary Computer (no account needed)."""
from __future__ import annotations

import hashlib
from concurrent.futures import ThreadPoolExecutor
import json

import numpy as np
import odc.stac
import planetary_computer
import pystac_client

from . import config as C


def catalog() -> pystac_client.Client:
    return pystac_client.Client.open(C.STAC_URL, modifier=planetary_computer.sign_inplace)


def search(start: str, end: str, max_cloud: float) -> list:
    items = catalog().search(
        collections=[C.COLLECTION], bbox=C.AOI_BBOX, datetime=f"{start}/{end}",
        query={"eo:cloud_cover": {"lt": max_cloud}},
    ).items()
    return sorted(items, key=lambda it: it.datetime)


def spread(items: list, n: int) -> list:
    """Pick up to n scenes evenly spread over the period (one per day)."""
    by_day = {}
    for it in sorted(items, key=lambda it: it.properties["eo:cloud_cover"]):
        by_day.setdefault(it.datetime.date(), it)
    days = sorted(by_day)
    if len(days) <= n:
        return [by_day[d] for d in days]
    idx = np.linspace(0, len(days) - 1, n).round().astype(int)
    return [by_day[days[i]] for i in idx]


odc.stac.configure_rio(cloud_defaults=True, GDAL_HTTP_MAX_RETRY="5", GDAL_HTTP_RETRY_DELAY="2")


def load_scene(item, bands: list[str], res: int) -> dict[str, np.ndarray]:
    """One scene as float reflectance (y, x); clouds, shadows and no-data are NaN. Cached per scene."""
    def build():
        ds = odc.stac.load([item], bands=[*bands, "SCL"], bbox=C.AOI_BBOX, crs=C.CRS, resolution=res,
                           resampling={"SCL": "nearest", "*": "bilinear"}, pool=len(bands) + 1)
        scl = ds["SCL"].values[0]
        valid = np.isin(scl, C.SCL_VALID)
        out = {}
        for b in bands:
            raw = ds[b].values[0]
            v = (raw.astype("float32") - C.BOA_OFFSET) / 10_000
            v[~valid | (raw == 0)] = np.nan
            out[b] = v
        out["_transform"] = np.array(ds.odc.geobox.affine)[:6]
        return out

    return cached("scene", {"id": item.id, "b": bands, "r": res, "bbox": C.AOI_BBOX}, build)


def load(items: list, bands: list[str], res: int) -> dict[str, np.ndarray]:
    """Stack scenes into (time, y, x) arrays."""
    def one(it):
        sc = load_scene(it, bands, res)
        print(f"    scene {it.datetime.date()} ok", flush=True)
        return sc

    # A few scenes in parallel: each HTTP connection is slow, the line is not
    with ThreadPoolExecutor(max_workers=4) as ex:
        scenes = list(ex.map(one, items))
    out = {b: np.stack([s[b] for s in scenes]) for b in bands}
    out["_transform"] = scenes[0]["_transform"]
    out["_dates"] = np.array([it.datetime.date().isoformat() for it in items])
    return out


def cached(name: str, key: dict, fn):
    """Cache numpy dicts on disk so re-runs do not download imagery again."""
    C.CACHE_DIR.mkdir(parents=True, exist_ok=True)
    h = hashlib.sha1(json.dumps(key, sort_keys=True).encode()).hexdigest()[:10]
    path = C.CACHE_DIR / f"{name}_{h}.npz"
    if path.exists():
        with np.load(path, allow_pickle=False) as z:
            return {k: z[k] for k in z.files}
    data = fn()
    np.savez_compressed(path, **data)
    return data
