# Provider integration

Providers return explicit status and never manufacture successful measurements. Common states are `available`, `not_configured`, `disabled`, `pipeline_not_configured`, `unavailable`, and `test_fixture`.

## Weather

`WeatherProvider` defines current weather, recent rainfall, forecast, metadata, and health operations. `WeatherService` tries IMD, then falls back to local CHIRPS. Every normalized observation includes provider, source, observation time, receive time, age, live flag, status, quality, confidence, location, and provenance.

CHIRPS is a historical Aizawl regional mean, not a point rain gauge and never live. `FixtureWeatherProvider` exists only for tests and labels all output `test_fixture`.

## Satellite

Sentinel-1, Sentinel-2, and MOSDAC implement the same latest-observation interface. No acquisition is returned until a real catalog/download/processing pipeline exists. Future normalized records must contain provider, satellite, product, acquisition time, processed time, geometry, applicable cloud coverage, optional change score, and status.

## Sensors

The HTTP ingest adapter reports `no_sensor_connected` until a protected reading is stored. Physical readings and test fixtures have distinct `source` values. The hybrid engine only uses the nearest configured reading within its spatial radius and preserves time/distance.

## Alerts

Console delivery is a development/test channel. Firebase and SMS adapters remain disabled without configuration and never simulate external delivery. `SMS_ENABLED=false` is the safe default.

## Adding a provider

1. Implement the corresponding abstract provider.
2. Map approved source fields to the normalized TerraWatch model.
3. Preserve observation/acquisition time and raw-source provenance.
4. Return a truthful unavailable state for credential, transport, schema, or quality failure.
5. Register the adapter in `ServiceContainer`.
6. Add contract, unavailable, and normalization tests.

