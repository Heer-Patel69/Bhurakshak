# IMD integration

## CURRENT STATUS: NOT CONNECTED

TerraWatch has no IMD API key or permission. The backend does not contain guessed IMD endpoint paths, does not label CHIRPS as IMD, and does not fabricate live observations.

`IMDWeatherProvider` is the isolated adapter boundary. Configure only values received through the official access process:

```dotenv
IMD_API_BASE_URL=
IMD_API_KEY=
IMD_AUTH_TOKEN=
IMD_CURRENT_PATH=
IMD_RECENT_RAINFALL_PATH=
IMD_FORECAST_PATH=
IMD_METADATA_PATH=
IMD_PROVIDER_ENABLED=false
```

When permission is granted:

1. Put credentials into an uncommitted `.env` or deployment secret store.
2. Put the official endpoint paths into the matching settings; do not edit the hybrid engine.
3. Map the approved IMD response schema inside the IMD adapter to `WeatherObservation` and add captured contract tests with sensitive fields removed.
4. Enable `IMD_PROVIDER_ENABLED=true`.
5. Call `/api/v1/weather/current`, `/api/v1/system/providers`, and `/api/v1/risk/point`; verify observation time, data age, quality, and `live` semantics.

The current adapter can authenticate and call configured paths. Until the official response schema is approved and mapped, even a successful raw response returns `schema_mapping_required` and is not admitted to risk computation. This keeps the core risk engine unchanged while preventing accidental interpretation of undocumented fields.

