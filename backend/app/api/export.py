import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from ..deps import AlertFilters, get_store
from ..store import Store

router = APIRouter(prefix="/api", tags=["export"])

COLUMNS = ["alert_id", "district", "lat", "lon", "area_m2", "change_type", "start_month", "zones",
           "permit_match", "confidence", "risk_score", "status", "note", "updated_at"]


@router.get("/export.csv")
def export_csv(f: AlertFilters = Depends(), store: Store = Depends(get_store)):
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(COLUMNS)
    for a in store.query(**f.kw):
        w.writerow(["|".join(a.get("zones", [])) if c == "zones" else a.get(c) for c in COLUMNS])
    return Response(
        "﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="qurilishnazorat_alerts.csv"'},
    )
