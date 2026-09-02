# Data provenance

Every operational response must be traceable to its source and time semantics.

| Signal | Current source | Time semantics | Key provenance |
|---|---|---|---|
| Rainfall | CHIRPS daily local CSV | Historical observation, never live | dataset, regional-mean method, observation/receive time, age |
| Terrain | Copernicus DEM GLO-30-derived samples | Static | source, 30 m nominal resolution, requested/sample coordinates, distance |
| Historical | 572 GSI inventory points | Spatial susceptibility only | source, inventory size, bandwidth/normalization method, distance/counts |
| ML | Existing XGBoost artifact | Model output generated on request | model name/version/type, exact feature schema |
| Sensors | Authenticated submitted readings | Observation time supplied by device | sensor ID, source, age, distance, reading ID |
| Satellite | Not connected | Latest observation when later available | provider/product/acquisition/processing time/geometry |
| Citizen reports | Submitted records | User-observed time | report ID, location source/accuracy, language, verification state |
| Risk | Hybrid service | Generation time plus source data time | signal records, component scores, drivers, missing signals, confidence |

`data_sources` in point risk names every signal, status, observation time where applicable, and live flag. `data_timestamp` is the weather observation time. `generated_at` is computation time. `assessment_context` distinguishes operational from historical-reference output.

Raw citizen reports never become training labels. Verification creates operational incident evidence only; a separate governed curation process would be required before any future training use.

