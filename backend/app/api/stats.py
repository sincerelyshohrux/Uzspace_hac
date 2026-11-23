from collections import defaultdict

from fastapi import APIRouter, Depends

from ..deps import get_store
from ..schemas import DistrictStat, InspectorStat, Summary, TimelinePoint
from ..store import HIGH_RISK, Store

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/summary", response_model=Summary)
def summary(store: Store = Depends(get_store)):
    items = store.all_alerts()
    return {
        "total": len(items),
        "area_ha": round(sum(a["area_m2"] for a in items) / 10_000, 2),
        "in_restricted_zone": sum(Store.is_restricted(a) for a in items),
        "high_risk": sum(a["risk_score"] >= HIGH_RISK for a in items),
        "confirmed": sum(a["status"] == "confirmed" for a in items),
        "false_positive": sum(a["status"] == "false_positive" for a in items),
        "pending": sum(a["status"] in ("new", "in_review") for a in items),
    }


@router.get("/districts", response_model=list[DistrictStat])
def districts(store: Store = Depends(get_store)):
    acc: dict[str, dict] = defaultdict(lambda: dict(count=0, area=0.0, in_restricted_zone=0, high_risk=0, confirmed=0))
    for a in store.all_alerts():
        d = acc[a["district"]]
        d["count"] += 1
        d["area"] += a["area_m2"]
        d["in_restricted_zone"] += Store.is_restricted(a)
        d["high_risk"] += a["risk_score"] >= HIGH_RISK
        d["confirmed"] += a["status"] == "confirmed"
    rows = [
        {"district": k, "count": v["count"], "area_ha": round(v["area"] / 10_000, 2),
         "in_restricted_zone": v["in_restricted_zone"], "high_risk": v["high_risk"], "confirmed": v["confirmed"]}
        for k, v in acc.items()
    ]
    return sorted(rows, key=lambda r: -r["count"])


@router.get("/timeline", response_model=list[TimelinePoint])
def timeline(store: Store = Depends(get_store)):
    acc: dict[str, list[float]] = defaultdict(lambda: [0, 0.0])
    for a in store.all_alerts():
        if a.get("start_month"):
            acc[a["start_month"]][0] += 1
            acc[a["start_month"]][1] += a["area_m2"]
    return [{"month": m, "count": int(c), "area_ha": round(ar / 10_000, 2)} for m, (c, ar) in sorted(acc.items())]


@router.get("/inspectors", response_model=list[InspectorStat])
def inspectors(store: Store = Depends(get_store)):
    return store.inspectors()
