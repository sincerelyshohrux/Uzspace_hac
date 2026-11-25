from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from ..deps import get_store
from ..report import build_summary_pdf
from ..store import Store

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/summary.pdf")
def summary_pdf(district: str | None = Query(None, max_length=60), store: Store = Depends(get_store)):
    """Area report for one district, or the whole city when no district is given."""
    items = store.query(district=district or None)
    if district and not items:
        raise HTTPException(404, f"No alerts in district {district}")
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    pdf = build_summary_pdf(items, store.meta, store.data_dir, district or None, generated)
    name = f"sitesentinel_{(district or 'shahar').lower().replace(' ', '_')}.pdf"
    return Response(pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{name}"'})
