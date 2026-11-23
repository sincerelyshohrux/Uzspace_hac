"""Shared dependencies: one Store per process."""
from functools import lru_cache
from typing import Optional

from fastapi import HTTPException, Query

from . import config
from .store import Store


@lru_cache(maxsize=1)
def get_store() -> Store:
    return Store(config.DATA_DIR, config.DB_PATH)


def parse_bbox(bbox: Optional[str]) -> Optional[tuple[float, float, float, float]]:
    if not bbox:
        return None
    try:
        w, s, e, n = (float(x) for x in bbox.split(","))
    except ValueError:
        raise HTTPException(422, "bbox must be 'west,south,east,north'")
    return (w, s, e, n)


class AlertFilters:
    """Query parameters shared by /api/alerts and /api/export.csv."""

    def __init__(
        self,
        district: Optional[str] = None,
        zone: Optional[str] = Query(None, description="zone name or 'any_restricted'"),
        min_risk: float = Query(0, ge=0, le=100),
        status: Optional[str] = None,
        change_type: Optional[str] = None,
        bbox: Optional[str] = Query(None, description="west,south,east,north"),
        q: Optional[str] = Query(None, max_length=50),
        sort: str = Query("-risk_score", pattern=r"^-?(risk_score|area_m2|start_month|confidence|alert_id)$"),
    ):
        self.kw = dict(district=district, zone=zone, min_risk=min_risk, status=status,
                       change_type=change_type, bbox=parse_bbox(bbox), q=q, sort=sort)
