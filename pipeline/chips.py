"""Before / after image chips cut from the seasonal composites."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image
from pyproj import Transformer

from . import config as C

SIZE = 256
_to_utm = Transformer.from_crs("EPSG:4326", C.CRS, always_xy=True).transform


def chip_extent_m(area_m2: float) -> float:
    """Same rule as the frontend (lib/geo.ts) so the outline drawn there matches the image."""
    return max(120.0, math.sqrt(area_m2) * 2.6)


def to_rgb(c: dict) -> np.ndarray:
    """True colour with one fixed stretch for both dates, so T1 and T2 are comparable."""
    rgb = np.stack([c["B04"], c["B03"], c["B02"]], axis=-1)
    rgb = np.clip((np.nan_to_num(rgb) - 0.02) / 0.28, 0, 1) ** 0.8
    return (rgb * 255).astype("uint8")


def cut(rgb: np.ndarray, transform, lon: float, lat: float, extent_m: float) -> Image.Image:
    x, y = _to_utm(lon, lat)
    col = (x - transform[2]) / transform[0]
    row = (y - transform[5]) / transform[4]
    half = extent_m / 2 / C.RES
    box = (col - half, row - half, col + half, row + half)
    img = Image.fromarray(rgb)
    return img.transform((SIZE, SIZE), Image.Transform.EXTENT, box, resample=Image.Resampling.BICUBIC)


def write(rgb1, rgb2, transform, lon, lat, area_m2, before: Path, after: Path) -> None:
    ext = chip_extent_m(area_m2)
    before.parent.mkdir(parents=True, exist_ok=True)
    cut(rgb1, transform, lon, lat, ext).save(before, optimize=True)
    cut(rgb2, transform, lon, lat, ext).save(after, optimize=True)
