# GIS and connectivity pipeline

## Current status

The Aizawl pilot uses a real Geofabrik North-Eastern Zone PBF clipped to `[92.60, 23.60, 92.85, 23.85]`. Preprocessing produced 116,763 physical road segments, a 115,929-node/232,947-directed-edge graph, 14 settlements, and 29 critical facilities. The exact provenance, counts, missing values, and geometry checks are in `data/gis/processed/gis_data_audit.md`. No map tiles are used as analytical geometry.

## Reproduction

Run `python backend/scripts/download_osm_geofabrik.py`, then `python backend/scripts/preprocess_aizawl_osm.py`. The downloader verifies Geofabrik's published MD5 and records source metadata. Preprocessing clips features, retains stable OSM IDs and original tags, derives geodesic length, applies configured speed assumptions only when OSM `maxspeed` is absent, and writes GeoJSON plus GraphML and compressed Joblib graphs.

- `length_m`
- `travel_time_s`
- `risk_score`
- `officially_closed`
- `verified_blockage`
- optional `unverified_report_count`

## Risk grid

`/risk/grid` creates a bounded point grid, runs the point-risk pipeline per cell, returns GeoJSON, supplies an ETag, and keeps an in-memory TTL cache. `RISK_GRID_MAX_CELLS` prevents accidental demo overload.

## Exposure

Road exposure intersects line geometry with risk polygons and returns exposed length, highest intersecting risk, level, and status. A risky intersection yields `exposed` or `high_risk`; only an official status record can yield `officially_closed`.

## Isolation and access

Isolation copies the graph and removes explicitly selected edges. `analysis_mode=confirmed_closure` and `analysis_mode=risk_scenario` remain distinct. Only the confirmed mode may yield confirmed unreachability; scenario mode yields potential isolation.

Facility access compares reachable hospitals/police/emergency nodes, distance, travel time, and route exposure. Safer routing uses travel time plus risk, verified blockage, and unverified-report penalties. Official closures are non-routable; unverified reports never close an edge.

`GET /roads` is capped and supports `bbox`, `offset`, and `limit`. Static layers and their STRtree spatial indices are process-cached. The graph is loaded once from Joblib at service construction. Runtime risk and road-status overlays do not mutate the source artifact.
