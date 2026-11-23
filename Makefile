# SiteSentinel - developer commands
PY      ?= python3
VENV    := backend/.venv
BIN     := $(VENV)/bin

.PHONY: setup data backend frontend dev test build clean

setup:            ## Install backend + frontend dependencies and generate demo data
	$(PY) -m venv $(VENV)
	$(BIN)/pip install -q -r backend/requirements-dev.txt
	npm --prefix frontend ci
	$(MAKE) data

data:             ## Regenerate synthetic demo data into outputs/
	$(BIN)/python backend/scripts/make_mock_data.py --out outputs --seed 42

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

clean:            ## Remove generated data and build output
	rm -rf outputs frontend/public/demo frontend/dist
