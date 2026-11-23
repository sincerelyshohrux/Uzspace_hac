"""Backend settings. Everything can be overridden with environment variables."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

# Pipeline outputs (alerts.geojson, timeseries.json, metrics.json, meta.json, chips/)
DATA_DIR = Path(os.getenv("ICM_DATA_DIR", ROOT / "outputs"))
# SQLite file for alert status and audit log
DB_PATH = Path(os.getenv("ICM_DB_PATH", DATA_DIR / "app.db"))
# Allowed frontend origins (CORS)
CORS_ORIGINS = os.getenv("ICM_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
# Dev-only admin endpoints (reload outputs/, reset demo activity)
ENABLE_ADMIN = os.getenv("ICM_ENABLE_ADMIN", "1") == "1"
