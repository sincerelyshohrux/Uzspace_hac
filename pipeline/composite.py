"""Seasonal median composites for T1 and T2."""
from __future__ import annotations

import warnings

import numpy as np

from . import config as C
from . import s2


def ndvi(b: dict) -> np.ndarray:
    return (b["B08"] - b["B04"]) / (b["B08"] + b["B04"] + 1e-6)


def seasonal(start: str, end: str) -> dict[str, np.ndarray]:
    """Median of cloud-free pixels over the season, plus the greenest NDVI seen (crop check)."""
    def build():
        items = s2.spread(s2.search(start, end, C.MAX_CLOUD), C.SCENES_PER_PERIOD)
        print(f"  {start}..{end}: {len(items)} scenes", flush=True)
        stack = s2.load(items, C.BANDS, C.RES)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", RuntimeWarning)
            out = {b: np.nanmedian(stack[b], axis=0).astype("float32") for b in C.BANDS}
            out["ndvi_peak"] = np.nanmax(ndvi(stack), axis=0).astype("float32")
        out["transform"] = stack["_transform"]
        out["dates"] = stack["_dates"]
        return out

    return s2.cached("composite", {"p": [start, end], "c": C.MAX_CLOUD, "n": C.SCENES_PER_PERIOD, "bbox": C.AOI_BBOX}, build)
