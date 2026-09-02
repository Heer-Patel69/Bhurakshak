# GIS and connectivity pipeline

## Current status

Risk points/grids work. Analytical road, village, facility, and OSM road-graph files are not present in the repository, so those layer endpoints truthfully return `not_configured`. No map tiles are used as analytical geometry.

## Expected inputs

Set `ROADS_GEOJSON_PATH`, `VILLAGES_GEOJSON_PATH`, `FACILITIES_GEOJSON_PATH`, and `ROAD_GRAPH_PATH` to reviewed derivatives of an OSM/Geofabrik North-Eastern India extract. Stable IDs and source tags must be retained. Villages/facilities used for graph analysis require `nearest_node` properties. Graph edges should contain:

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

