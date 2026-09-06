# Dhara Drishti backend

Production-structured FastAPI foundation for the Dhara Drishti Aizawl pilot. The backend combines local historical/weather/terrain evidence, the existing experimental XGBoost susceptibility model, connectivity analysis interfaces, citizen reports, sensors, incidents, alerts, and provider health without claiming deterministic landslide prediction.

The API never retrains from incoming reports. `scripts/retrain_model.py` is an explicit, gated admin job that writes a candidate artifact only after minimum-data and validation checks; production promotion additionally requires `--promote`.

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
- real Aizawl OSM roads, settlements, critical facilities, and directed routing graph
- bbox-filtered/paginated GIS layers, indexed road-risk exposure, coordinate routing, isolation, and facility access
- console/test alerts; disabled external alert providers

Live IMD, satellite processing, Firebase, SMS, and Groq execution remain unavailable until their provider credentials are configured. Their APIs report that status instead of returning fake observations.

## Setup

Python 3.11 or newer is required.

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python -m uvicorn backend.app.main:app --reload
```

Do not put the Supabase service-role key, authority test password, sensor secret, SMS key, or provider credentials into committed files.

## Supabase authority login

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `backend/.env`, and the matching `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `frontend/.env.local`. The anon key is public configuration; the service-role key is backend-only.

Create a local test user in **Supabase Dashboard → Authentication → Users → Add user**, using the email stored as `DEV_AUTHORITY_EMAIL` and a password stored only as `DEV_AUTHORITY_PASSWORD` in `backend/.env`. Assign `{ "role": "authority" }` in that user's trusted `app_metadata` through the Supabase Admin API or Dashboard tooling. Do not use `user_metadata` for authorization. Reset the password from **Authentication → Users → user → Reset/Update password**.

For a controlled local demonstration, you can instead set `AUTHORITY_SHARED_ACCESS_CODE` in `backend/.env` and enter it in the Command Center. It is excluded from Git, must be shared only with intended operators, and can be rotated by changing the local value and restarting the API. The backend also accepts Supabase Bearer JWTs whose server-fetched `app_metadata.role`/`roles` contains `authority` or `admin`.

## Acceptance calls

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/v1/health
Invoke-RestMethod http://127.0.0.1:8000/api/v1/system/providers
Invoke-RestMethod "http://127.0.0.1:8000/api/v1/roads?bbox=92.70,23.70,92.74,23.76&limit=100"
Invoke-RestMethod http://127.0.0.1:8000/api/v1/gis/historical-landslides

$body = @{ latitude = 23.7271; longitude = 92.7176 } | ConvertTo-Json
Invoke-RestMethod http://127.0.0.1:8000/api/v1/risk/point -Method Post -ContentType application/json -Body $body

$route = @{ origin = @{ latitude = 23.7271; longitude = 92.7176 }; destination = @{ latitude = 23.75; longitude = 92.73 } } | ConvertTo-Json -Depth 3
Invoke-RestMethod http://127.0.0.1:8000/api/v1/routes/compare -Method Post -ContentType application/json -Body $route
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
