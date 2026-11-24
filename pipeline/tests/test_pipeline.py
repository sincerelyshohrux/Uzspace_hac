"""Offline tests for the detection rules and the risk formula (synthetic rasters, no network)."""
import json
from pathlib import Path

import numpy as np
import pytest
from affine import Affine
from shapely.geometry import Polygon, shape

from pipeline import config as C
from pipeline import detect
from pipeline.run import area_factor, risk

ROOT = Path(__file__).resolve().parents[2]


def _scene(n=40, **bands):
    """Uniform reflectance scene; override bands with arrays or scalars."""
    base = {"B02": 0.08, "B03": 0.10, "B04": 0.10, "B08": 0.35, "B11": 0.20, "ndvi_peak": 0.6}
    base.update(bands)
    return {k: np.full((n, n), v, dtype="float32") if np.isscalar(v) else v.astype("float32") for k, v in base.items()} | {
        "transform": tuple(Affine(C.RES, 0, 500_000, 0, -C.RES, 4_560_000))[:6]
    }


def test_area_factor_spreads_over_the_detectable_range():
    lo = C.MIN_PIXELS * C.RES * C.RES
    assert area_factor(lo) == 0.4
    assert area_factor(C.MAX_AREA_M2) == 1.0
    assert area_factor(10 * C.MAX_AREA_M2) == 1.0
    # the old formula gave 1.0 to everything above 10 000 m2; these must now differ
    assert area_factor(20_000) < area_factor(60_000) < area_factor(140_000)


def test_risk_is_product_of_factors():
    score, b = risk(0.9, 30_000, 0.9)
    assert b["permit_factor"] == 1.0
    assert score == round(100 * 0.9 * 0.9 * b["area_factor"])
    assert risk(0.9, 30_000, C.ZONE_WEIGHT_NONE)[0] < score


def test_new_building_on_vegetation_is_detected():
    t1 = _scene()  # green field
    b08, b11 = np.full((40, 40), 0.35), np.full((40, 40), 0.20)
    b04 = np.full((40, 40), 0.10)
    b08[10:22, 10:22], b11[10:22, 10:22], b04[10:22, 10:22] = 0.15, 0.32, 0.15  # built-up block, vegetation gone
    peak = np.full((40, 40), 0.6)
    peak[10:22, 10:22] = 0.1
    t2 = _scene(B04=b04, B08=b08, B11=b11, ndvi_peak=peak)
    dets, _ = detect.detect(t1, t2)
    assert len(dets) == 1
    d = dets[0]
    assert d.pixels == 144 and d.change_type == "new_construction"
    assert d.geom_utm.is_valid and 0.3 <= d.confidence <= 0.98


def test_seasonal_field_is_ignored():
    """Bare in the T2 median but green at the T2 peak -> a crop field, not a site."""
    t1 = _scene()
    b08, b11 = np.full((40, 40), 0.35), np.full((40, 40), 0.20)
    b04 = np.full((40, 40), 0.10)
    b08[10:22, 10:22], b11[10:22, 10:22], b04[10:22, 10:22] = 0.15, 0.32, 0.15
    t2 = _scene(B04=b04, B08=b08, B11=b11, ndvi_peak=0.6)
    assert detect.detect(t1, t2)[0] == []


def test_clean_fixes_corner_touching_outline():
    # two squares touching at one corner: a classic self-touching pixel outline
    bow = Polygon([(0, 0), (100, 0), (100, 100), (200, 100), (200, 200), (100, 200), (100, 100), (0, 100)])
    assert not bow.is_valid
    out = detect._clean(bow)
    assert out.is_valid and out.geom_type == "Polygon"
    assert out.area == pytest.approx(20_000, rel=0.03)  # 0.5 m growth adds only ~2 %


@pytest.mark.skipif(not (ROOT / "outputs" / "alerts.geojson").exists(), reason="no pipeline outputs")
def test_published_alerts_are_consistent():
    fc = json.loads((ROOT / "outputs" / "alerts.geojson").read_text())
    ids = set()
    for f in fc["features"]:
        p = f["properties"]
        assert shape(f["geometry"]).is_valid, p["alert_id"]
        assert 0 <= p["risk_score"] <= 100
        r = p["risk"]
        expect = round(100 * r["confidence"] * r["zone_weight"] * r["area_factor"] * r["permit_factor"])
        assert abs(p["risk_score"] - expect) <= 1, p["alert_id"]
        ids.add(p["alert_id"])
    assert len(ids) == len(fc["features"])
