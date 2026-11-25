from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from .. import config
from ..deps import get_store
from ..schemas import Health
from ..store import Store

router = APIRouter(prefix="/api", tags=["meta"])


@router.get("/health", response_model=Health)
def health(store: Store = Depends(get_store)):
    return {"status": "ok", "data_loaded": bool(store.alerts), "alerts": len(store.alerts)}


@router.get("/meta")
def meta(store: Store = Depends(get_store)):
    return store.meta


@router.get("/metrics")
def metrics(store: Store = Depends(get_store)):
    return store.metrics


@router.get("/layers/zones")
def zones(store: Store = Depends(get_store)):
    return store.zones


@router.get("/layers/districts")
def districts(store: Store = Depends(get_store)):
    return store.districts


def _admin() -> None:
    if not config.ENABLE_ADMIN:
        raise HTTPException(404)


@router.post("/admin/reload", dependencies=[Depends(_admin)])
def reload(store: Store = Depends(get_store)):
    store.reload()
    return {"alerts": len(store.alerts)}


@router.post("/admin/reset", dependencies=[Depends(_admin)])
def reset(store: Store = Depends(get_store)):
    store.reset_activity()
    return {"ok": True}


class DemoRow(BaseModel):
    alert_id: str
    new_status: str
    note: Optional[str] = None
    user: str
    ts: str


@router.get("/demo/activity")
def demo_activity(store: Store = Depends(get_store)):
    return {"rows": store.demo_count()}


@router.post("/demo/activity", dependencies=[Depends(_admin)])
def demo_seed(rows: list[DemoRow], store: Store = Depends(get_store)):
    for r in rows:
        if r.new_status not in ("new", "in_review", "confirmed", "false_positive"):
            raise HTTPException(422, f"bad status {r.new_status}")
    return {"rows": store.demo_seed([r.model_dump() for r in rows])}


@router.delete("/demo/activity", dependencies=[Depends(_admin)])
def demo_clear(store: Store = Depends(get_store)):
    return {"removed": store.demo_clear()}
