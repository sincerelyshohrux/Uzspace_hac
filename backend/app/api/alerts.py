from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from ..deps import AlertFilters, get_store
from ..report import build_pdf
from ..schemas import Alert, AlertList, AlertUpdate, AuditEntry, TimeseriesPoint
from ..store import Store

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _get_or_404(store: Store, alert_id: str) -> dict:
    a = store.get(alert_id)
    if a is None:
        raise HTTPException(404, f"Alert {alert_id} not found")
    return a


@router.get("", response_model=AlertList)
def list_alerts(
    f: AlertFilters = Depends(),
    limit: int = Query(500, ge=1, le=2000),
    offset: int = Query(0, ge=0),
    store: Store = Depends(get_store),
):
    items = store.query(**f.kw)
    return {"total": len(items), "items": items[offset: offset + limit]}


@router.get("/{alert_id}", response_model=Alert)
def get_alert(alert_id: str, store: Store = Depends(get_store)):
    return _get_or_404(store, alert_id)


@router.patch("/{alert_id}", response_model=Alert)
def update_alert(alert_id: str, body: AlertUpdate, store: Store = Depends(get_store)):
    _get_or_404(store, alert_id)
    return store.update(alert_id, body.status, body.note, body.user)


@router.get("/{alert_id}/timeseries", response_model=list[TimeseriesPoint])
def timeseries(alert_id: str, store: Store = Depends(get_store)):
    _get_or_404(store, alert_id)
    return store.timeseries.get(alert_id, [])


@router.get("/{alert_id}/audit", response_model=list[AuditEntry])
def audit(alert_id: str, store: Store = Depends(get_store)):
    _get_or_404(store, alert_id)
    return store.audit(alert_id)


@router.get("/{alert_id}/report.pdf")
def report(alert_id: str, store: Store = Depends(get_store)):
    a = _get_or_404(store, alert_id)
    pdf = build_pdf(a, store.data_dir, bool(store.meta.get("is_mock")), store.audit(alert_id), store.meta)
    return Response(
        pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{alert_id}.pdf"'},
    )
