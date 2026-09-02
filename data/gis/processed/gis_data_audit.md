# TerraWatch Aizawl GIS data audit

- Source: OpenStreetMap contributors via Geofabrik
- License: ODbL 1.0
- Source URL: https://download.geofabrik.de/asia/india/north-eastern-zone-latest.osm.pbf
- Downloaded at: 2026-09-02T15:00:53.085482+00:00
- Dataset version: 2026-09-01T20:20:50Z
- Processing timestamp: 2026-09-02T15:06:22.431449+00:00
- Output CRS: EPSG:4326
- Coordinate bounds: [92.6, 23.6, 92.85, 23.85]

## Counts and geometry

| Metric | Value |
|---|---:|
| Road segments | 116763 |
| Total physical road length (m) | 1196811.18 |
| Graph nodes | 115929 |
| Directed graph edges | 232947 |
| Weakly connected components | 25 |
| Largest weak component nodes | 109503 |
| Settlements | 14 |
| Hospitals | 19 |
| Clinics | 4 |
| Police stations | 6 |
| Fire stations | 0 |
| Ambulance/other emergency | 0 |
| Total facilities | 29 |
| Invalid geometries skipped | 3 |

## Missing names

| Layer | Missing names |
|---|---:|
| Road segments | 113007 |
| Settlements | 4 |
| Facilities | 0 |

## OSM tags used

```json
{
  "highway": 263041,
  "name": 4176,
  "surface": 10156,
  "maxspeed": 787,
  "bridge": 12577,
  "tunnel": 365,
  "oneway": 3907,
  "access": 207
}
```

## Conservative default speeds when `maxspeed` is absent

```json
{
  "motorway": 50,
  "trunk": 45,
  "primary": 40,
  "secondary": 35,
  "tertiary": 30,
  "residential": 20,
  "unclassified": 20,
  "service": 15
}
```

## Notes

- Roads are physical OSM way-node segments; graph edges are directed and may contain both directions.
- Missing names remain null; no road, settlement, facility, or population value is invented.
- Node and way POIs are processed; relation-only POIs may require a future area/relation pass.
