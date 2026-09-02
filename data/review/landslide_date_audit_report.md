# Aizawl Landslide Date Audit and 5-Month Window Analysis Report

**Pilot:** Aizawl, Mizoram  
**System:** TerraWatch Landslide Early Warning & Hazard Assessment System  
**Audit Scope:** All 572 records in `aizawl_landslide_events_cleaned.csv` and `aizawl_terrain_features.csv`

---

## 1. Executive Summary

This audit establishes the rigorous ground truth for historical landslide event dates in the Aizawl pilot area. All dates were audited strictly from explicit event-date records and source report provenance (`landslide_report.pdf` published by the Geological Survey of India). No dates were fabricated, assumed, or imputed from publication dates.

### Key Audit Metrics
| Metric | Count / Value | Description |
| :--- | :--- | :--- |
| **Total Landslide Records** | **572** | Complete cleaned Aizawl landslide inventory |
| **Valid Explicit Dated Events** | **120** | Unambiguously verified historical events (20.98%) |
| **Unresolved Ambiguous Dates** | **1** | Retained as `ambiguous_date` (0.17%) |
| **Missing Date Records** | **451** | Preserved for spatial susceptibility priors (78.85%) |
| **Invalid Date Records** | **0** | No malformed/corrupted dates found |
| **Earliest Valid Event Date** | **2007-09-08** | GSI post-disaster field survey records |
| **Latest Valid Event Date** | **2024-05-28** | Cyclone Remal extreme rainfall multi-site disaster |
| **Unique Event Days** | **3** | 2007-09-08, 2023-10-02, 2024-05-28 |
| **Unique Event Locations** | **120** | Distinct coordinate pairs (lat, lon) |

---

## 2. Resolution of Ambiguous Dates from Source Provenance

Four records originally had numeric date strings (`08-09-2007` × 3, `02-10-2023` × 1). In accordance with the strict provenance rule (*never infer DD-MM vs MM-DD based on assumption; only resolve if the original source provides unambiguous textual date*), each source PDF page and excerpt was inspected:

| Event ID | Review ID | `date_original` | Source PDF & Page | Original Source Excerpt / Text | Resolution Outcome | Resolved Date / Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `GSI-44F3FDAF1B26` | `GSI-REVIEW-002065` | `02-10-2023` | `landslide_report.pdf`, p. 578 | `Slide number: MZ/AZL/84A10/2024/055 ... History: 02 October 2023` | **Resolved**: Source explicitly provides textual month "October". | `2023-10-02` (`valid_explicit_date`) |
| `GSI-52A18485175F` | `GSI-REVIEW-001499` | `08-09-2007` | `landslide_report.pdf`, p. 562 | `Slide number: MIZO/AIZ/84A10/2007/E-3 ... History: 8 September 2007` | **Resolved**: Source explicitly provides textual month "September". | `2007-09-08` (`valid_explicit_date`) |
| `GSI-27BB88446FF2` | `GSI-REVIEW-001479` | `08-09-2007` | `landslide_report.pdf`, p. 561 | `Slide number: MIZO/AIZ/84A10/2007/E-4 ... History: 2 September and 8 September 2007` | **Resolved**: Source explicitly provides textual month "September" for 8 September 2007. | `2007-09-08` (`valid_explicit_date`) |
| `GSI-BE3339520D0D` | `GSI-REVIEW-000998` | `08-09-2007` | `landslide_report.pdf`, p. 542 | `Slide number: MIZO/AIZ/84A10/2007/E-1 ... History: 08.09.2007 at night` | **Unresolved**: Source uses numeric dot notation `08.09.2007` without textual month name. Retained without guessing. | `null` (`ambiguous_date`) |

---

## 3. Temporal Distribution of Valid Dated Events

### Event Count by Year
| Year | Event Count | Percentage of Valid Dated | Dominant Event Context |
| :--- | :--- | :--- | :--- |
| **2024** | **117** | **97.50%** | Cyclone Remal extreme precipitation event (2024-05-28) |
| **2007** | **2** | **1.67%** | September 2007 monsoon rainfall events (2007-09-08) |
| **2023** | **1** | **0.83%** | October 2023 post-monsoon event (2023-10-02) |
| **Total** | **120** | **100.00%** | |

### Event Count by Month
| Month | Month Name | Event Count | Percentage |
| :--- | :--- | :--- | :--- |
| **05** | **May** | **117** | **97.50%** |
| **09** | **September** | **2** | **1.67%** |
| **10** | **October** | **1** | **0.83%** |

### Event Count by Specific Event Day
| Date (YYYY-MM-DD) | Event Count | Unique Coordinates | Trigger / Event Type |
| :--- | :--- | :--- | :--- |
| **2024-05-28** | **117** | **117** | Cyclone Remal severe cyclonic storm & continuous heavy downpour |
| **2007-09-08** | **2** | **2** | Intense monsoon precipitation pulse (Ramhlun / Bawng Venglai) |
| **2023-10-02** | **1** | **1** | Post-monsoon slope failure (Melriat) |

---

## 4. Continuous Five-Month Historical Window Evaluation

Every possible continuous 5-calendar-month historical window from 2007 to 2024 (216 windows total) was systematically evaluated.

### Top Window Rankings (from `data/review/five_month_window_analysis.csv`)
| Rank | Start Date | End Date | Positive Event Count | % of All Valid Dated Events | Unique Event Days | Unique Event Locations | Dominant Year | Window Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **2024-05-01** | **2024-09-30** | **117** | **97.50%** | **1** | **117** | **2024** | **Canonical Aizawl Monsoon Season (May–Sep 2024)** |
| 2 (tie) | 2024-01-01 | 2024-05-31 | 117 | 97.50% | 1 | 117 | 2024 | Overlaps May 28, 2024 |
| 2 (tie) | 2024-02-01 | 2024-06-30 | 117 | 97.50% | 1 | 117 | 2024 | Overlaps May 28, 2024 |
| 2 (tie) | 2024-03-01 | 2024-07-31 | 117 | 97.50% | 1 | 117 | 2024 | Overlaps May 28, 2024 |
| 2 (tie) | 2024-04-01 | 2024-08-31 | 117 | 97.50% | 1 | 117 | 2024 | Overlaps May 28, 2024 |
| **6 (2nd best era)** | **2007-05-01** | **2007-09-30** | **2** | **1.67%** | **1** | **2** | **2007** | **Historical 2007 Monsoon Window** |
| 7 (tie) | 2007-06-01 | 2007-10-31 | 2 | 1.67% | 1 | 2 | 2007 | Overlaps Sep 8, 2007 |
| 8 (tie) | 2007-07-01 | 2007-11-30 | 2 | 1.67% | 1 | 2 | 2007 | Overlaps Sep 8, 2007 |
| 9 (tie) | 2007-08-01 | 2007-12-31 | 2 | 1.67% | 1 | 2 | 2007 | Overlaps Sep 8, 2007 |
| 10 (tie) | 2007-09-01 | 2008-01-31 | 2 | 1.67% | 1 | 2 | 2007 | Overlaps Sep 8, 2007 |
| **11 (3rd era)** | **2023-06-01** | **2023-10-31** | **1** | **0.83%** | **1** | **1** | **2023** | **Historical 2023 Monsoon Window** |

---

## 5. Engineering Assessment & Recommendations

### 1. Best Five-Month Window
The optimal continuous five-month training window is **2024-05-01 through 2024-09-30** (May 1 to September 30, 2024).
- **Positive Event Count:** 117 events
- **Percentage of Valid Dated Events:** 97.50%
- **Unique Event Days:** 1 (2024-05-28)
- **Unique Event Locations:** 117 distinct coordinate locations across Aizawl district.

### 2. Second-Best Window
The second-best historical continuous five-month window is **2007-05-01 through 2007-09-30** (May 1 to September 30, 2007), capturing 2 events (1.67% of valid dated events) on 1 unique event day (2007-09-08) across 2 unique locations.

### 3. Single-Year Dominance
**Yes, the dataset is overwhelmingly dominated by a single year and a single event date (2024-05-28, 97.50%).**
This represents a single synoptic meteorological event: **Cyclone Remal**, which triggered massive simultaneous slope failures across Aizawl on May 28, 2024.

### 4. Real-World ML Suitability Assessment (XGBoost Prototype)
*Critical Evaluation Rule applied: A dataset must not be judged "good enough" solely on row count.*
- **Spatial Diversity:** High. The 117 events on 2024-05-28 span 117 distinct topographic, geological, and slope conditions across Aizawl district.
- **Temporal Concentration:** Extreme. All 117 events share a single event date (2024-05-28), resulting in zero inter-event temporal variance in the positive class.
- **Experimental Feasibility:** A prototype XGBoost model trained on the May–September 2024 window will effectively learn **spatial susceptibility conditional on a high-intensity storm**, but **cannot learn a generalized dynamic rainfall threshold across diverse storm profiles** from a single day's event trigger.
- **Conclusion:** While sufficient for an *initial experimental prototype* of spatial-temporal co-occurrence, it is **insufficient as a standalone predictive model**.

### 5. Architectural Role: Secondary to the Hybrid Risk Engine
**The XGBoost model must remain secondary to the Hybrid Risk Engine.**
The primary operational safety backbone of TerraWatch must be:
1. **Deterministic Physics & Geotechnical Susceptibility (SHALSTAB / Infinite Slope / Factor of Safety)**
2. **Empirical Antecedent Rainfall Thresholds (ID Curves / Cumulative Rainfall Curves for Mizoram)**
3. **Spatial Susceptibility Priors & Landslide Density Surface**
4. **Machine Learning (XGBoost) as a dynamic modulator / refinement layer** only where spatial-temporal features provide positive predictive gain without overriding physics-based guardrails.

---

## 6. Preservation and Utilization of Undated Events (451 Records)

The **451 undated positive landslide records** (78.85% of total records) are strictly preserved and must NOT be discarded:
- **Prohibition:** They must NOT be used for rainfall-event temporal training unless explicit dates are recovered.
- **Prescribed Value:**
  1. **Spatial Landslide Density & Kernel Density Estimation (KDE):** Mapping high-frequency failure corridors across Aizawl.
  2. **Historical Susceptibility Baselines:** Calibrating static slope, lithology, and elevation susceptibility weights.
  3. **Bayesian Hotspot Priors:** Acting as informative spatial priors in the TerraWatch Hybrid Risk Engine.

---

## 7. Recommended Exact Next Step

1. **Acquire Historical IMERG / GPM Daily Rainfall for May 1 – September 30, 2024** covering the Aizawl pilot bounding box (`23.3°N–24.0°N, 92.5°N–93.2°E`).
2. **Construct the 2024 Temporal Rainfall Feature Matrix** (1-day, 3-day, 7-day, 14-day, 30-day antecedent precipitation, API, and rolling intensities) for May–September 2024.
3. **Generate Spatially and Temporally Stratified Background (Label=0) Samples** across Aizawl during non-failure days and non-failure slopes within the May–September 2024 window.
4. **Link Historical Landslide Spatial Susceptibility (all 572 points)** as a static prior layer in the Hybrid Risk Engine.
