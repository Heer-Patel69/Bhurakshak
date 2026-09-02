# Limitations

## Scientific

- All 117 positive ML labels are from Cyclone Remal on 2024-05-28. The model represents storm-conditioned spatial susceptibility, not generalized temporal prediction.
- The 234 negatives are background locations without a recorded event, not verified stable slopes.
- Rainfall features are Aizawl regional CHIRPS means. The current fallback is archived through 2025-09-30 and cannot represent current rainfall.
- Terrain lookup uses the nearest of 572 existing historical-point samples, not a continuous DEM query. Sample distance is exposed.
- Historical inventory density reflects recorded-location bias and includes undated records as spatial evidence only.
- Prototype hybrid weights and thresholds require validation by geologists, disaster-management authorities, and event backtesting.

## Operational

- IMD is not connected.
- No Sentinel-1/Sentinel-2/MOSDAC download and processing pipeline is connected.
- No analytical OSM road/village/facility extract or routable road graph is present.
- No physical sensor is connected by default.
- Firebase, real SMS, and Groq execution are disabled/not configured.
- Media binary upload/storage is not implemented; report APIs accept validated media metadata/URLs.
- In-memory grid cache is per-process. A distributed cache is needed for multi-instance deployment.
- SQLite is for development. Production should use managed PostgreSQL/Supabase, migrations, backups, least-privilege roles, and monitored connection pooling.

## Claim boundaries

TerraWatch estimates risk, susceptibility, exposure, potential isolation, and confidence. It does not promise safety, predict a guaranteed event time, or treat exposed roads/scenario-isolated villages as confirmed closures/isolation.

