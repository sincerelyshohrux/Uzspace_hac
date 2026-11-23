"""QurilishNazorat API.

Serves pipeline outputs (outputs/) and stores inspector actions in SQLite.
No satellite processing or model inference happens at request time.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config
from .api import alerts, export, meta, stats
from .deps import get_store


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_store()  # load outputs/ and open SQLite once at startup
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="QurilishNazorat API", version="1.0.0", lifespan=lifespan,
                  description="Satellite-based construction monitoring: alerts, inspector workflow, statistics.")
    app.add_middleware(CORSMiddleware, allow_origins=config.CORS_ORIGINS, allow_methods=["*"], allow_headers=["*"])
    for r in (meta.router, alerts.router, stats.router, export.router):
        app.include_router(r)
    # Only image chips are public; app.db and other files in DATA_DIR are not served.
    chips = config.DATA_DIR / "chips"
    chips.mkdir(parents=True, exist_ok=True)
    app.mount("/static/chips", StaticFiles(directory=chips), name="chips")

    return app


app = create_app()
