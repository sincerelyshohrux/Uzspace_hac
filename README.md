# SiteSentinel — Construction Change Monitoring

> **Uzspace Hackathon 2026** · Challenge: **Illegal Construction Monitoring** (GIS / AI track)
> **Team:** Potential

SiteSentinel is a web tool for city inspectors. It compares satellite imagery of Tashkent
from two dates, finds new built-up areas, and ranks each change by how urgently it should be
checked on the ground. The system does **not** decide that a building is illegal. It flags
changes that **require inspection**, explains why, and records what the inspector decided.

> **Status: working prototype on real data.** The alerts in `outputs/` come from Sentinel-2
> imagery of Tashkent (2023 vs 2025) and OpenStreetMap zones. Model accuracy is **not validated
> yet**; the accuracy page shows demo values and is marked **DEMO** (see [Validation](#validation)).

---

## Team

| Name | Role | Main contribution |
|---|---|---|
| Asliddin Xazratqulov | Captain · product & presentation | Problem framing, inspector workflow, risk formula and zone weights, demo scenario and pitch |
| Shohruxbek Maxamatjonov | Backend | FastAPI service, data contract, SQLite status and audit log, PDF / CSV reports, synthetic data generator, tests |
| Saidazizxon Saydinabiyev | Frontend | React dashboard, MapLibre map and layers, alert queue, detail panel, statistics and accuracy pages, UZ / EN |
| Abdukarim Abdulqayumov | GIS / remote sensing | Sentinel-2 data selection and preprocessing, restricted zones from OpenStreetMap, district boundaries |
| Mirahmad Zoxidov | ML / validation | Change detection method, labelled validation sample, precision / recall and error analysis |

---

## What it does

1. **Detect** — new built-up areas between T1 (2023) and T2 (2025).
2. **Score** — each change gets a risk score from 0 to 100 (formula below).
3. **Triage** — inspectors work through a queue sorted by risk, filter by district, zone, status
   and type, and see each alert on the map with a before/after comparison.
4. **Decide** — an inspector marks an alert *In review*, *Confirmed* or *False positive*, with a
   comment. Every change is stored in an audit log.
5. **Report** — one-page PDF per alert for field visits, CSV export of the filtered list,
   statistics by district / month / zone, and a model accuracy page.

### Risk score

```
risk = 100 × confidence × zone_weight × area_factor × permit_factor
```

| Factor | Meaning | Values |
|---|---|---|
| `confidence` | detector confidence that the change is new construction | 0 – 1 |
| `zone_weight` | most restrictive zone the polygon touches (OpenStreetMap) | power line 1.0 · canal / river 0.9 · park 0.8 · farmland 0.7 · railway / cemetery 0.6 · none 0.3 |
| `area_factor` | larger footprint → higher priority | `min(1, log10(area_m2) / 4)` |
| `permit_factor` | match against permit registry | none / no data 1.0 · partial 0.6 · matched 0.2 |

Alerts with risk ≥ 60 are shown as *high*, 30–59 *medium*, below 30 *low*.

---

## Detection method

The pipeline (`pipeline/`) uses only open Sentinel-2 L2A data from Microsoft Planetary Computer,
so it runs without any account or API key.

1. **Composites.** For each period (T1 = Jun–Sep 2023, T2 = Jun–Sep 2025) take 4 scenes with
   < 5 % cloud, mask clouds and shadows with the scene classification layer (SCL), and compute
   the per-pixel median. Using the same season in both years reduces crop-cycle effects.
2. **Indices.** NDVI (vegetation), NDBI (built-up), MNDWI (water), BSI (bare soil).
3. **Change rule.** A pixel is a candidate when vegetation is lost (ΔNDVI > 0.12) or the built-up
   index rises (ΔNDBI > 0.06), it is not vegetated in T2 (NDVI < 0.30), it was never green during
   the T2 season (peak NDVI < 0.45, filters seasonal fields), and it is not water.
4. **Objects.** Candidates are grouped into connected objects (≥ 5 pixels = 500 m², ≤ 15 ha),
   kept only if their mean T2 NDBI is ≥ 0.03 and mean T2 NDVI ≤ 0.19 (drops dry grass along
   canals and fallow strips), converted to polygons and labelled *new construction* (built-up signature in T2) or
   *land clearing* (bare soil).
5. **Score.** Change strength and object size give a 0–1 score. It is a ranking heuristic, not a
   calibrated probability; its accuracy is measured separately (see Validation).
6. **Start month.** For every object, a monthly built-up signal (Mar–Nov, best scene per month)
   shows when the surface changed; the first month that stays past the midpoint is reported.
7. **Zones and districts.** Canals, rivers, power lines, railways, parks, cemeteries and
   farmland are downloaded from OpenStreetMap (Overpass API). Line features get a protection
   corridor (canal 30 m, river 50 m, power line 30 m, railway 25 m on each side). Each object
   gets the zones it intersects, the district that contains its centre (13 Tashkent districts
   from OSM), and its risk score. Objects outside the Toshkent city boundary are dropped.
8. **Chips.** True-colour T1 / T2 crops around each object for the before / after view.

```bash
make pipeline-setup   # once: geospatial dependencies in pipeline/.venv
make pipeline         # downloads imagery (cached in pipeline/cache/) and writes outputs/
```

## Data sources

| Source | Used for | Status |
|---|---|---|
| Synthetic data (`make_mock_data.py`) | accuracy page (until validation), offline demo | demo only |
| Esri World Imagery | satellite basemap in the map view | in use (display only) |
| OpenStreetMap tiles | streets / dark basemap | in use (display only) |
| OpenMapTiles fonts | map labels | in use (display only) |
| Sentinel-2 L2A (Copernicus, via Microsoft Planetary Computer) | change detection T1 → T2, monthly signal, image chips | in use |
| OpenStreetMap (Overpass API) | restricted zones, district and city boundaries | in use |

---

## Tech stack and dependencies

**Backend** — Python 3.11+ (`backend/requirements.txt`)
FastAPI · Uvicorn · Pydantic v2 · SQLite (WAL) · fpdf2 (PDF) · Pillow · Shapely · pytest + httpx (tests)

**Frontend** — Node 18+ (`frontend/package.json`)
React 18 · TypeScript · Vite · Tailwind CSS · MapLibre GL · TanStack Query · Recharts · Radix UI · Motion

---

## Run with Docker (recommended)

Requirements: Docker Desktop.

```bash
git clone https://github.com/sincerelyshohrux/Uzspace_hac.git
cd Uzspace_hac
docker compose up --build
```

Open **http://localhost:8080**. The backend serves the pipeline results committed in
`outputs/` (alerts, image chips, time series), so no imagery download is needed to run the demo.
Inspector decisions are stored in `outputs/app.db` (not committed). Stop with `docker compose down`.

## Run locally

Requirements: Python 3.11+, Node 18+, `make`.

```bash
git clone https://github.com/sincerelyshohrux/Uzspace_hac.git
cd Uzspace_hac
make setup      # venv + pip install, npm ci (uses the results already in outputs/)
make dev        # backend on :8000 and frontend on :5173
```

Open **http://localhost:5173**. API docs: **http://localhost:8000/docs**.

Without `make`:

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements-dev.txt
backend/.venv/bin/python backend/scripts/make_mock_data.py --out outputs
backend/.venv/bin/uvicorn app.main:app --app-dir backend --port 8000    # terminal 1
npm --prefix frontend ci && npm --prefix frontend run dev                # terminal 2
```

**Demo mode:** if the backend is not running, the frontend loads the same data from
`frontend/public/demo/` and keeps inspector decisions in the browser. The top bar shows
whether the API is connected, and the **DEMO** badge marks synthetic data.

Other commands: `make test` (pytest + type check), `make build` (production bundle),
`make pipeline` (recompute results from Sentinel-2), `make demo-data` (replace results with
synthetic demo data).

### Demo walkthrough

1. Dashboard → **Start with the highest-risk alert**: the map flies to it and opens the detail panel.
2. Compare T1 / T2 with the slider, side-by-side or blink mode; read *Why it requires inspection*.
3. Change status to *In review* → confirm → the audit log updates.
4. Download the PDF report or export the filtered list to CSV.
5. Drag the timeline to see how alerts appeared month by month; switch to 3D view.
6. Open **Statistics** and **Model accuracy** pages.

---

## API

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | service status, data mode, alert count |
| GET | `/api/meta` · `/api/metrics` | dataset metadata, model metrics |
| GET | `/api/alerts` | list with filters: `bbox`, `district`, `zone`, `min_risk`, `status`, `type`, `q` |
| GET | `/api/alerts/{id}` | single alert |
| PATCH | `/api/alerts/{id}` | update status / comment (writes audit log) |
| GET | `/api/alerts/{id}/timeseries` · `/audit` | built-up index history, audit log |
| GET | `/api/alerts/{id}/report.pdf` | inspector PDF report |
| GET | `/api/export.csv` | CSV export (same filters as the list) |
| GET | `/api/stats/summary` · `/districts` · `/timeline` · `/inspectors` | aggregated statistics |
| GET | `/api/layers/zones` · `/api/layers/districts` | GeoJSON layers for the map |

---

## Project structure

```
backend/
  app/            FastAPI app: api/ routers, store (SQLite + files), schemas, PDF report
  scripts/        make_mock_data.py — synthetic data generator (same format as the real pipeline)
  tests/          API tests
frontend/
  src/api/        typed API client, demo-mode server, React Query hooks
  src/components/ map, alert queue, detail panel, analytics, UI primitives
  src/pages/      Dashboard, Statistics, Model accuracy
  src/i18n/       Uzbek and English strings
outputs/          pipeline results served by the backend (alerts, chips, time series)
pipeline/         Sentinel-2 download, change detection, time series, chips
```

---

## Validation

Not available yet. The accuracy page currently shows **demo values** and is labelled as such.
Planned: a manually labelled sample of detected polygons in Tashkent, with precision, recall and
a confusion matrix computed from it.

## Limitations

- Accuracy is not measured yet; detections are a ranked list for checking, not verified facts.
- 10 m Sentinel-2 pixels cannot see small structures (roughly under 200 m²).
- No access to the official permit registry; `permit_factor` is a placeholder.
- Zone corridor widths are working assumptions for ranking, not the legal protection widths,
  and OpenStreetMap may miss or misplace some canals and power lines.
- A high risk score means "check first", not "violation".

## Roadmap

- [x] Backend API, risk scoring, audit log, PDF / CSV
- [x] Inspector dashboard, statistics, accuracy page, UZ / EN
- [x] Docker setup
- [x] Sentinel-2 change detection pipeline for Tashkent
- [x] Restricted zones and districts from OpenStreetMap
- [ ] Validation on a labelled sample

---

## Use of AI tools

We used AI coding assistants (Claude Code) to speed up parts of the implementation:

- **AI-assisted:** UI components and styling, API boilerplate (routers, schemas), the synthetic
  data generator, test scaffolding and parts of this README.
- **Team's own work:** the problem framing and inspector workflow, system architecture and data
  contract, the risk formula and zone weights, choice of data sources, the satellite pipeline
  and validation, and all integration, debugging and testing.

All AI-generated code was reviewed, edited and tested by the team. Each member can explain the
part of the code they are responsible for.
