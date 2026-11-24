# SiteSentinel - developer commands
PY      ?= python3
VENV    := backend/.venv
BIN     := $(VENV)/bin

.PHONY: setup data demo-data pipeline-setup pipeline backend frontend dev test build clean

setup:            ## Install backend + frontend dependencies and generate demo data
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -q -r backend/requirements-dev.txt
	npm --prefix frontend ci
	$(MAKE) data

data:             ## Create synthetic demo data only if outputs/ has no results yet
	@test -f outputs/alerts.geojson && echo "outputs/ already has data, skipping" || $(BIN)/python backend/scripts/make_mock_data.py --out outputs --seed 42

demo-data:        ## Overwrite outputs/ with synthetic demo data
	$(BIN)/python backend/scripts/make_mock_data.py --out outputs --seed 42

pipeline-setup:   ## Create the pipeline environment (geospatial dependencies)
	$(PY) -m venv pipeline/.venv
	pipeline/.venv/bin/pip install -q -r pipeline/requirements.txt

pipeline:         ## Run the Sentinel-2 change detection pipeline into outputs/
	pipeline/.venv/bin/python -m pipeline.run --out outputs

backend:          ## Run FastAPI on :8000
	$(BIN)/uvicorn app.main:app --app-dir backend --port 8000 --reload --reload-dir backend/app

frontend:         ## Run Vite dev server on :5173
	npm --prefix frontend run dev

dev:              ## Run backend and frontend together
	$(MAKE) -j2 backend frontend

test:             ## Backend tests + frontend type check
	$(BIN)/pytest -q backend/tests
	npm --prefix frontend run typecheck

build:            ## Production build of the frontend
	npm --prefix frontend run build

clean:            ## Remove build output and the local database
	rm -rf frontend/public/demo frontend/dist outputs/app.db*
