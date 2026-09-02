# Architecture

TerraWatch uses a modular service architecture. Routes validate HTTP input and delegate; domain services calculate risk, exposure, connectivity, clustering, and delivery decisions; providers isolate external schemas and credentials; repositories isolate persistence.

```text
FastAPI routes
    -> domain services
        -> provider interfaces (IMD, CHIRPS, Sentinel, MOSDAC, sensors, alerts)
        -> analytical artifacts (terrain, GSI inventory, XGBoost, OSM geometry/graph)
        -> repositories
            -> SQLite development / PostgreSQL-Supabase production
```

## Application lifecycle

`backend.app.main:create_app` constructs a settings-bound application. The service container loads the static terrain, historical inventory, risk configuration, and trained model once. Startup creates local SQLite development tables; managed PostgreSQL/Supabase deployments require the reviewed Alembic migration first. Shutdown disposes database connections. Model/provider failure is retained as health state and does not crash unrelated endpoints.

## Major boundaries

- `core/`: settings, structured logging, request IDs, security dependencies, API errors.
- `models/`: API schemas and SQLAlchemy entities.
- `providers/`: external/local provider contracts. No risk decision logic belongs here.
- `services/`: risk, confidence, GIS, connectivity, reporting, sensor, incident, and alert behavior.
- `repositories/`: transaction-scoped database access.
- `api/routes/`: versioned transport layer under `/api/v1`.

## Database

Entities cover citizen reports, incidents, sensor devices/readings, risk snapshots, road status, alerts, facilities, villages, provider health, and authority actions. Local SQLite is the credential-free default. `DATABASE_URL` can point to PostgreSQL/Supabase without changing repositories.

The PostgreSQL migration enables RLS as defense in depth and creates no public policies or client grants. FastAPI is the intended data-access boundary. A production database role should receive only the privileges it needs.

## Security and low-network behavior

- Sensor ingest requires `SENSOR_INGEST_SECRET`.
- Report/incident verification, alert creation, and authority overview require `AUTHORITY_API_KEY`.
- Report UUIDs may be client-generated for idempotent offline synchronization.
- `/sync/changes` provides timestamp-based incremental resource discovery.
- Upload metadata is MIME/size validated; this foundation accepts media URLs and does not execute media.
- Request logs omit bodies, credentials, and private media.
- Grid size is bounded and cached; resource IDs and update timestamps are stable.
