from fastapi import APIRouter, Depends, HTTPException

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
