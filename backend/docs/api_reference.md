# API reference

All endpoints are under `/api/v1`. Interactive OpenAPI documentation is available at `/docs` when the server runs.

## Health and providers

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Database, model, historical, and terrain health |
| GET | `/system/providers` | Weather, satellite, alert, sensor, ML, GIS, graph, and copilot status |

## Risk and source signals

| Method | Path | Purpose |
|---|---|---|
| POST | `/risk/point` | Hybrid risk and independent confidence for a coordinate |
| GET | `/risk/grid?bbox=west,south,east,north&resolution=10` | Bounded/cached GeoJSON point grid |
| GET | `/weather/current` | Live provider if available, otherwise labeled historical fallback |
| GET | `/weather/history` | Archived CHIRPS observation on/before a timestamp |
| GET | `/terrain/point` | Static terrain sample with sampled coordinate and distance |
| GET | `/historical/susceptibility` | GSI distance-decay spatial evidence |
| GET | `/satellite/latest` | Latest-observation provider state; never called live satellite |

Point input:

```json
{
  "latitude": 23.7271,
  "longitude": 92.7176,
  "timestamp": null
}
```

The response separates `risk_score` from `confidence_score`, includes every signal/provider status, provenance, drivers, missing signals, data time, generation time, and `assessment_context`.

## GIS and connectivity

| Method | Path | Purpose |
|---|---|---|
| GET | `/gis/layers` | Analytical layer availability |
| GET | `/roads` | Configured road GeoJSON or `not_configured` |
| GET | `/roads/exposure` | Risk intersection; exposure does not mean closure |
| GET | `/villages` | Configured village GeoJSON |
| GET | `/villages/isolation` | `confirmed_closure` or `risk_scenario` graph analysis |
| GET | `/facilities` | Configured critical-facility GeoJSON |
| GET | `/accessibility?source_node=...` | Nearest accessible facility via safer routing |
| POST | `/routes/compare` | Fastest versus safer route |

Routing input:

```json
{"source_node": "123", "destination_node": "456"}
```

Official closures are non-routable. Verified blockage reports receive a severe penalty. Unverified reports may add cost but never close an edge.

## Reports, incidents, sensors, alerts, and operations

| Method | Path | Authentication |
|---|---|---|
| POST | `/reports` | Public ingest; idempotent client UUID supported |
| GET | `/reports` | Authority key |
| PATCH | `/reports/{id}/verify` | Authority key |
| GET | `/incidents` | Authority key |
| PATCH | `/incidents/{id}/verify` | Authority key |
| POST | `/sensors/ingest` | Sensor secret |
| GET | `/sensors/status` | None |
| GET | `/alerts` | None |
| POST | `/alerts` | Authority key |
| GET | `/authority/overview` | Authority key |
| GET | `/sync/changes?since=...` | None in pilot; scope with auth before production |

Use `X-Sensor-Secret`, `X-Authority-Key`, or a Bearer token containing the corresponding configured value. Missing server-side secrets disable protected operations rather than opening them.

## Errors

Domain errors use:

```json
{
  "error": {
    "code": "WEATHER_PROVIDER_UNAVAILABLE",
    "message": "...",
    "recoverable": true
  }
}
```

Optional provider failure degrades a risk response instead of failing it. FastAPI validation errors remain standard HTTP 422 responses.
