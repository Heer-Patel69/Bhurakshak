# Risk and confidence engines

TerraWatch produces a configurable heuristic risk estimate, not a probability that a landslide will occur.

## Inputs

- antecedent rainfall
- static terrain
- GSI historical spatial susceptibility
- experimental storm-conditioned ML susceptibility
- nearby soil-moisture sensor reading when real data exists
- latest processed satellite change signal when available
- nearby verified reports

Missing optional signals are omitted from the weighted average and explicitly listed. Available signal weights are renormalized, so missing sensors do not mechanically force risk low. Confidence separately falls when evidence is missing or stale.

## Prototype configuration

`backend/config/risk_weights.yaml` is the only source for weights and thresholds. Initial weights are rainfall 0.35, terrain 0.20, historical 0.20, ML 0.10, sensor 0.05, satellite 0.05, and verified reports 0.05. They are prototype heuristics and are not presented as scientifically calibrated constants.

Starting risk thresholds are low 0–24.9, medium 25–49.9, high 50–74.9, and critical 75–100.

Rainfall score is the maximum normalized 24-hour, 72-hour, or seven-day accumulation ratio. Terrain is an 80/20 slope/elevation heuristic. Historical and ML scores are scaled from 0–1. Verified-report score follows authority severity. All component values are clamped.

## Historical susceptibility

All 572 GSI locations contribute to an exponential distance-decay density with a configurable 1 km bandwidth. Density is normalized to the configured inventory percentile. The service also returns nearest-event distance and counts within 500 m, 1 km, and 2 km. Undated events remain spatial evidence only.

## ML boundary

The model loads once and validates the exact ordered feature schema. Output is `ml_susceptibility_score` in 0–1 and is always labeled `experimental_storm_conditioned_spatial_susceptibility`. It is secondary evidence. It is never described as a future-event probability.

## Confidence

Confidence measures evidence availability/freshness, not hazard. Static terrain, historical inventory, and loaded ML receive availability credit. Archived CHIRPS receives only partial credit. Sensor/satellite signals are freshness-weighted. Missing live weather is explicitly listed when a historical fallback is used.

When no live weather exists, the assessment is labeled `historical_reference_scenario`. This prevents a historical rain pattern from being mistaken for current operational conditions.

