# TerraWatch: Model Features Dataset Validation Report

**File:** `data/generated/model_features.csv`  
**Generated At:** 2026-09-02  
**Random Seed for Deterministic Background Sampling:** 42  
**Pilot Area:** Aizawl District, Mizoram, India  
**Event Window:** 2024-05-28 (Cyclone Remal Extreme Precipitation Pulse)  

---

## 1. Dataset Shape & Class Balance

| Metric | Target Specification | Actual Count | Status |
| :--- | :--- | :--- | :--- |
| **Total Rows** | 351 | **351** | **PASS** |
| **Total Columns** | 12 | **12** | **PASS** |
| **Positive Class (`label = 1`)** | 117 (recorded landslides) | **117** (33.33%) | **PASS** |
| **Background Class (`label = 0`)** | 234 (pseudo-absences) | **234** (66.67%) | **PASS** |
| **Class Ratio** | 1 : 2 | **1 : 2** | **PASS** |
| **Date Consistency** | `2024-05-28` across all rows | **100% (351/351)** | **PASS** |
| **Positive Sample Type** | `recorded_landslide` | **100% (117/117)** | **PASS** |
| **Background Sample Type** | `background_no_recorded_event` | **100% (234/234)** | **PASS** |

---

## 2. Integrity, Missing Values & Duplicate Audit

### Missing-Value Counts by Column

| Column Name | Data Type | Null Count | Null % | Validation Constraint | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `sample_id` | `object` | 0 | 0.00% | Unique Identifier | **PASS** |
| `event_id` | `object` | 234 | 66.67% | Expected null for background pseudo-absences | **PASS** |
| `date` | `object` | 0 | 0.00% | Must be `2024-05-28` | **PASS** |
| `latitude` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `longitude` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `elevation_m` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `slope_deg` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `rain_prev_24h_mm` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `rain_prev_72h_mm` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `rain_prev_7d_mm` | `float64` | 0 | 0.00% | No missing allowed | **PASS** |
| `label` | `int64` | 0 | 0.00% | No missing allowed (0 or 1) | **PASS** |
| `sample_type` | `object` | 0 | 0.00% | Valid categorization | **PASS** |

### Duplicate Audit

| Duplicate Scope | Duplicate Count | Status |
| :--- | :--- | :--- |
| `sample_id` Uniqueness | **0** | **PASS (All 351 IDs unique)** |
| Positive Class Intra-class Coords (`lat`, `lon`, `date`) | **0** | **PASS (117 unique locations)** |
| Background Class Intra-class Coords (`lat`, `lon`, `date`) | **0** | **PASS (234 unique locations)** |
| Cross-Class Overlap (`lat`, `lon`) | **0** | **PASS (Spatial buffer enforced)** |

---

## 3. Statistical Distribution of Features

### A. Overall Dataset (N = 351)

| Feature | Min | Max | Mean | Std Dev |
| :--- | :--- | :--- | :--- | :--- |
| **`elevation_m`** | 31.00 m | 1506.33 m | 651.65 m | 298.95 m |
| **`slope_deg`** | 0.00° | 52.77° | 26.81° | 9.63° |
| **`rain_prev_24h_mm`** | 90.41 mm | 221.73 mm | 143.46 mm | 22.01 mm |
| **`rain_prev_72h_mm`** | 171.49 mm | 345.56 mm | 250.90 mm | 31.44 mm |
| **`rain_prev_7d_mm`** | 209.08 mm | 345.56 mm | 268.09 mm | 26.05 mm |

### B. Positive Class: Recorded Landslides (`label = 1`, N = 117)

| Feature | Min | Max | Mean | Std Dev |
| :--- | :--- | :--- | :--- | :--- |
| **`elevation_m`** | 182.21 m | 1506.33 m | 868.17 m | 214.33 m |
| **`slope_deg`** | 6.19° | 52.77° | 29.39° | 9.03° |
| **`rain_prev_24h_mm`** | 123.00 mm | 171.24 mm | 147.48 mm | 15.74 mm |
| **`rain_prev_72h_mm`** | 225.56 mm | 277.29 mm | 247.13 mm | 15.69 mm |
| **`rain_prev_7d_mm`** | 246.52 mm | 296.43 mm | 268.55 mm | 13.67 mm |

### C. Background Class: Pseudo-Absences (`label = 0`, N = 234)

| Feature | Min | Max | Mean | Std Dev |
| :--- | :--- | :--- | :--- | :--- |
| **`elevation_m`** | 31.00 m | 1350.43 m | 543.39 m | 275.80 m |
| **`slope_deg`** | 0.00° | 45.74° | 25.52° | 9.68° |
| **`rain_prev_24h_mm`** | 90.41 mm | 221.73 mm | 141.46 mm | 24.33 mm |
| **`rain_prev_72h_mm`** | 171.49 mm | 345.56 mm | 252.78 mm | 36.76 mm |
| **`rain_prev_7d_mm`** | 209.08 mm | 345.56 mm | 267.86 mm | 30.43 mm |

---

## 4. Geographic Coordinate Bounds

| Sample Group | Latitude Minimum | Latitude Maximum | Longitude Minimum | Longitude Maximum | CRS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Overall Dataset (N=351)** | 23.432718°N | 24.096753°N | 92.455711°E | 92.999012°E | WGS84 (EPSG:4326) |
| **Positives (`label = 1`, N=117)** | 23.432718°N | 23.869838°N | 92.672654°E | 92.876123°E | WGS84 (EPSG:4326) |
| **Backgrounds (`label = 0`, N=234)** | 23.451044°N | 24.096753°N | 92.455711°E | 92.999012°E | WGS84 (EPSG:4326) |

---

## 5. Certification & Next Step Readiness

- **Status:** **FULLY CERTIFIED & VALIDATED**
- **Machine Learning Compatibility:** Ready for stratified cross-validation and baseline XGBoost prototype modeling without data leakage.
