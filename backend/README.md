# TerraWatch backend

Production-structured FastAPI foundation for the TerraWatch Aizawl pilot. The backend combines local historical/weather/terrain evidence, the existing experimental XGBoost susceptibility model, connectivity analysis interfaces, citizen reports, sensors, incidents, alerts, and provider health without claiming deterministic landslide prediction.

No code in this backend retrains the model or writes into `data/Cleaned/`, `data/generated/`, or `backend/models/`.

## What works locally

- `GET /api/v1/health`
- `GET /api/v1/system/providers`
- `POST /api/v1/risk/point`
- bounded/cached GeoJSON risk grids
- historical CHIRPS fallback clearly marked `live: false`
- 572-point GSI historical spatial susceptibility
- static nearest-sample Copernicus DEM terrain lookup
- validated one-time XGBoost model loading and graceful degradation
- SQLite persistence with PostgreSQL-compatible SQLAlchemy entities
- idempotent offline report creation, verification, and incident clustering
- protected sensor ingest and latest-reading lookup
- generic road exposure, isolation, routing, and facility-access services
- console/test alerts; disabled external alert providers

Analytical OSM roads, village/facility layers, road graph, live IMD, satellite processing, Firebase, SMS, and Groq execution remain unavailable until their data pipelines or credentials are configured. Their APIs report that status instead of returning fake observations.

## Setup

Python 3.11 or newer is required.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python -m uvicorn backend.app.main:app --reload
```

Do not put the Supabase service-role key, sensor secret, authority key, SMS key, or provider credentials into committed files.

## Acceptance calls

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/system/providers

$body = @{ latitude = 23.7271; longitude = 92.7176 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/v1/risk/point -Method Post -ContentType application/json -Body $body
```

Without IMD configuration, point risk uses the most recent local CHIRPS record as a historical reference scenario. The response contains `assessment_context: historical_reference_scenario`, `live: false`, `live_weather` in missing signals, and reduced confidence.

## Tests and migrations

```powershell
python -m compileall -q backend
python -m pytest backend\tests -q
alembic -c backend\alembic.ini upgrade head
```

Local startup creates missing SQLite tables for convenience. Use Alembic for managed PostgreSQL/Supabase deployments. The backend connects directly to PostgreSQL; no table is deliberately exposed to Supabase's Data API. See [migrations/README.md](migrations/README.md).

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api_reference.md)
- [Provider integration](docs/provider_integration.md)
- [IMD integration](docs/imd_integration.md)
- [Risk engine](docs/risk_engine.md)
- [GIS pipeline](docs/gis_pipeline.md)
- [Data provenance](docs/data_provenance.md)
- [Limitations](docs/limitations.md)

