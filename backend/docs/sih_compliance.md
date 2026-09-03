# Bhu Rakshak SIH backend compliance

| Requirement | Status | Evidence / remaining work |
|---|---|---|
| Rainfall | WORKING | CHIRPS historical reference; never labelled live |
| Soil sensors | WAITING_PHYSICAL_DEVICE | Validated ingest/status APIs work; no deployed devices |
| Satellite | WAITING_EXTERNAL_CREDENTIAL | Provider contract reports unavailable honestly |
| Terrain | WORKING | Copernicus DEM-derived local features |
| Historical landslides | WORKING | 572 GSI events and susceptibility endpoint |
| AI/ML | WORKING | Existing XGBoost risk signal plus grounded Groq explanation |
| High-risk zones | WORKING | Cached risk grid and road exposure |
| Real-time alerts | PARTIAL | Alert records and console delivery work; Firebase/SMS credentials pending |
| GIS roads/villages/infrastructure | WORKING | Real OSM/Geofabrik Aizawl artifacts |
| Geo-tagged citizen photo/video | PARTIAL | GPS contract, validation, private bucket, metadata and upload API work; Storage REST requires service-role secret |
| Risk severity | WORKING | Low/medium/high/critical with independent confidence |
| Road connectivity | WORKING | Fastest/safer routing and verified closure overlay |
| Weather-linked risk | WORKING | Historical scenario works; live context activates only for validated IMD observations |
| Emergency prioritization | WORKING | Facility access, incident severity and authority overview |
| Multilingual | PARTIAL | English/Hindi templates present; Mizo requires authority language review |
| Low-network/offline sync | WORKING | UUID idempotency and explicit sync fields |
| Mobile/web reporting | FRONTEND_REQUIRED | Backend GPS/media/report contracts complete |
| IMD integration readiness | WAITING_EXTERNAL_CREDENTIAL | Config-driven adapter and normalized validation are ready |
| Satellite integration readiness | WAITING_EXTERNAL_CREDENTIAL | Provider boundary ready; processing credentials/data unavailable |
| SMS/app warning readiness | WAITING_EXTERNAL_CREDENTIAL | Alert abstraction ready; paid providers disabled |
| Cloud architecture | WORKING | Supabase PostgreSQL schema, private Storage bucket and RLS/Data API restrictions |

Mizo emergency wording is not legally or operationally authoritative until reviewed by a qualified authority translator.
