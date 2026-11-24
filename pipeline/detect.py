"""Rule-based change detection: new built-up surface between T1 and T2."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from affine import Affine
from pyproj import Transformer
from rasterio import features
from scipy import ndimage
from shapely.geometry import Polygon, shape
from shapely.ops import transform as shp_transform

from . import config as C
from .composite import ndvi


def indices(c: dict) -> dict[str, np.ndarray]:
    e = 1e-6
    return {
        "ndvi": ndvi(c),
        "ndbi": (c["B11"] - c["B08"]) / (c["B11"] + c["B08"] + e),
        "mndwi": (c["B03"] - c["B11"]) / (c["B03"] + c["B11"] + e),
        "bsi": ((c["B11"] + c["B04"]) - (c["B08"] + c["B02"])) / ((c["B11"] + c["B04"]) + (c["B08"] + c["B02"]) + e),
    }


@dataclass
class Detection:
    geom_utm: object      # shapely Polygon in UTM
    geom_wgs: object      # shapely Polygon in lon/lat
    area_m2: float
    pixels: int
    change_type: str
    confidence: float
    label: int


def change_mask(t1: dict, t2: dict) -> tuple[np.ndarray, np.ndarray, dict]:
    """Return the candidate mask, a 0..1 change strength map and the index layers."""
    a, b = indices(t1), indices(t2)
    d_ndvi = a["ndvi"] - b["ndvi"]          # positive = vegetation lost
    d_ndbi = b["ndbi"] - a["ndbi"]          # positive = more built-up / bare
    strength = np.clip((d_ndvi / 0.25 + d_ndbi / 0.15) / 2, 0, 1)
    with np.errstate(invalid="ignore"):
        cand = (
            ((d_ndvi > C.D_NDVI_MIN) | (d_ndbi > C.D_NDBI_MIN))
            & (b["ndvi"] < C.NDVI_T2_MAX)
            & (t2["ndvi_peak"] < C.NDVI_PEAK_T2_MAX)   # still green some time in T2 -> seasonal field
            & (a["mndwi"] < 0) & (b["mndwi"] < 0)     # ignore water and shorelines
        )
    cand &= ~np.isnan(strength)
    cand = ndimage.binary_closing(cand, structure=np.ones((2, 2)))
    return cand, np.nan_to_num(strength), {"t1": a, "t2": b, "d_ndvi": d_ndvi, "d_ndbi": d_ndbi}


def _clean(poly):
    """Valid single polygon without holes. Pixel outlines touch themselves at corners
    (8-connectivity); growing the outline by 0.5 m joins those parts into one polygon."""
    poly = Polygon(poly.exterior).buffer(0.5, join_style="mitre")
    if poly.geom_type == "MultiPolygon":
        poly = max(poly.geoms, key=lambda p: p.area)
    out = Polygon(poly.exterior)
    return out if out.is_valid else out.buffer(0)


def polygons(mask: np.ndarray, strength: np.ndarray, idx: dict, transform) -> tuple[list[Detection], np.ndarray]:
    labels, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n == 0:
        return [], labels
    ids = np.arange(1, n + 1)
    pix = ndimage.sum(np.ones_like(labels), labels, ids)
    mean_s = ndimage.mean(strength, labels, ids)
    mean_dndbi = ndimage.mean(np.nan_to_num(idx["d_ndbi"]), labels, ids)
    mean_ndbi2 = ndimage.mean(np.nan_to_num(idx["t2"]["ndbi"]), labels, ids)
    mean_ndvi2 = ndimage.mean(np.nan_to_num(idx["t2"]["ndvi"]), labels, ids)

    px_area = C.RES * C.RES
    keep = (
        (pix >= C.MIN_PIXELS) & (pix * px_area <= C.MAX_AREA_M2)
        & (mean_ndbi2 >= C.OBJ_NDBI_T2_MIN)      # dry grass keeps NDBI near zero
        & (mean_ndvi2 <= C.OBJ_NDVI_T2_MAX)      # still partly vegetated -> not a site
    )
    keep_ids = set(ids[keep].tolist())
    labels = np.where(np.isin(labels, list(keep_ids)), labels, 0)

    aff = Affine(*transform[:6])
    to_wgs = Transformer.from_crs(C.CRS, "EPSG:4326", always_xy=True).transform
    out = []
    for geom, lab in features.shapes(labels.astype("int32"), mask=labels > 0, transform=aff, connectivity=8):
        lab = int(lab)
        k = lab - 1
        poly = _clean(shape(geom).simplify(C.RES * 0.5))
        if poly.is_empty or poly.area < px_area:
            continue
        built = mean_dndbi[k] >= C.D_NDBI_MIN and mean_ndbi2[k] > -0.02
        # Heuristic score, not a calibrated probability (validated separately)
        conf = float(np.clip(0.45 + 0.5 * mean_s[k] + 0.03 * np.log2(pix[k] / C.MIN_PIXELS), 0.3, 0.98))
        out.append(Detection(poly, shp_transform(to_wgs, poly), float(pix[k] * px_area), int(pix[k]),
                             "new_construction" if built else "land_clearing", round(conf, 2), lab))
    return out, labels


def detect(t1: dict, t2: dict) -> tuple[list[Detection], np.ndarray]:
    mask, strength, idx = change_mask(t1, t2)
    dets, labels = polygons(mask, strength, idx, t2["transform"])
    dets.sort(key=lambda d: (d.confidence * np.log10(d.area_m2)), reverse=True)
    return dets, labels
