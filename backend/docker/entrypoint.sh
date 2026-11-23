#!/bin/sh
set -e
# Use pipeline outputs mounted into /data; fall back to synthetic demo data.
if [ ! -f "$ICM_DATA_DIR/alerts.geojson" ]; then
  echo "No data in $ICM_DATA_DIR, generating demo data"
  python scripts/make_mock_data.py --out "$ICM_DATA_DIR" --seed 42
fi
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
