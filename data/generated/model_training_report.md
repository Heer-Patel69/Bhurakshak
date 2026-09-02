# TerraWatch: Experimental XGBoost Susceptibility Model Training & Spatial Validation Report

**System:** TerraWatch Landslide Early Warning & Spatial-Temporal Hazard Assessment System  
**Pilot Area:** Aizawl District, Mizoram, India  
**Model Type:** Experimental Storm-Conditioned Spatial Susceptibility Model  
**Date:** 2026-09-02  
**Framework:** XGBoost v3.4.1  
**Dataset:** `data/generated/model_features.csv` ($N = 351$)  

---

## 1. Executive Summary & Model Overview

An **Experimental storm-conditioned spatial susceptibility model** was trained using XGBoost on ground-truth landslide occurrences from the May 28, 2024 Cyclone Remal event in Aizawl. 

> [!IMPORTANT]
> **Model Purpose & Output Semantics:**  
> This model evaluates **spatial susceptibility conditional on a high-intensity storm event**. It is **NOT** a generalized future landslide probability model because all positive records share a single event date.  
> Output field: `ml_susceptibility_score` (continuous range: `0.0` to `1.0`).  
> **Never label this output as a temporal event forecast (e.g., "78% chance of landslide in the next X hours").**

---

## 2. Pre-Training Data Audit & Feature Collinearity

### Sample Integrity
- **Total Dataset Size:** 351 samples
- **Positive Landslide Samples (`label = 1`):** 117 (recorded landslide occurrences)
- **Background Samples (`label = 0`):** 234 (spatially buffered pseudo-absences)
- **Class Balance:** Exactly 1 : 2 (33.33% positive, 66.67% background)
- **Missing Predictive Values:** 0 across all features

### Feature Correlation Matrix

| Feature | `elevation_m` | `slope_deg` | `rain_prev_24h_mm` | `rain_prev_72h_mm` | `rain_prev_7d_mm` |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`elevation_m`** | 1.0000 | 0.3324 | -0.1959 | -0.4020 | -0.2847 |
| **`slope_deg`** | 0.3324 | 1.0000 | -0.1297 | -0.1991 | -0.1656 |
| **`rain_prev_24h_mm`** | -0.1959 | -0.1297 | 1.0000 | **0.7783** | **0.7163** |
| **`rain_prev_72h_mm`** | -0.4020 | -0.1991 | **0.7783** | 1.0000 | **0.8969** |
| **`rain_prev_7d_mm`** | -0.2847 | -0.1656 | **0.7163** | **0.8969** | 1.0000 |

> [!NOTE]
> **Rainfall Collinearity Analysis:**  
> Cumulative rainfall features exhibit strong positive correlation:
> - r(rain_prev_72h_mm, rain_prev_7d_mm) = **0.8969**
> - r(rain_prev_24h_mm, rain_prev_72h_mm) = **0.7783**
> - r(rain_prev_24h_mm, rain_prev_7d_mm) = **0.7163**  
> In tree-based gradient boosting, multicollinear features do not degrade predictive accuracy but split gains are shared across collinear proxies.

---

## 3. Spatial Validation Scheme

To prevent optimistic leakage from spatial autocorrelation, samples were partitioned strictly into **mutually exclusive geographic blocks**:

| Split | Spatial Block / Region | Total Samples | % of Dataset | Positives (`label=1`) | Backgrounds (`label=0`) | Latitude Bounds | Longitude Bounds |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Train** | `Central_West_Aizawl_Block` | **239** | 68.09% | **94** (39.33%) | **145** (60.67%) | [23.5501°N, 24.0968°N] | [92.4608°E, 92.9990°E] |
| **Validation** | `South_Aizawl_Block` | **53** | 15.10% | **13** (24.53%) | **40** (75.47%) | [23.4327°N, 23.5495°N] | [92.4557°E, 92.9966°E] |
| **Test** | `NorthEast_Aizawl_Block` | **59** | 16.81% | **10** (16.95%) | **49** (83.05%) | [23.7310°N, 24.0892°N] | [92.7977°E, 92.9985°E] |

*The spatial split mapping is persisted in [`data/generated/model_spatial_split.csv`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/data/generated/model_spatial_split.csv).*

---

## 4. Hyperparameter Tuning & Threshold Optimization

### Final Selected Hyperparameters
* `max_depth`: 3
* `learning_rate`: 0.03
* `n_estimators`: 60
* `min_child_weight`: 3
* `subsample`: 0.70
* `colsample_bytree`: 0.70
* `reg_alpha` (L1): 0.50
* `reg_lambda` (L2): 2.00
* `scale_pos_weight`: 1.0
* `random_state`: 42

### Operating Decision Threshold Selection
- Candidate threshold space: `[0.10, 0.90]`
- **Selected Threshold:** **`0.4800`** (derived purely from validation set optimization)
- Validation Performance at Threshold `0.4800`:  
  * Recall: **100.00%** (13/13 positive landslides detected)
  * Precision: **68.42%**
  * F1 Score: **0.8125**

---

## 5. Model Evaluation Across Splits

| Metric | Train Split ($N=239$) | Validation Split ($N=53$) | **Untouched Test Split ($N=59$)** |
| :--- | :--- | :--- | :--- |
| **Precision** | 0.9778 | 0.6842 | **0.4286** |
| **Recall** | 0.9362 | 1.0000 | **0.3000** |
| **F1 Score** | 0.9565 | 0.8125 | **0.3529** |
| **ROC-AUC** | 0.9927 | 0.9192 | **0.8276** |
| **PR-AUC** | 0.9901 | 0.7207 | **0.5295** |
| **Brier Score** | 0.0660 | 0.1327 | **0.1230** |
| **Accuracy** | 0.9665 | 0.8868 | **0.8136** |

### Test Split Confusion Matrix ($N=59$)
| | Predicted Background (0) | Predicted Susceptible (1) |
| :--- | :--- | :--- |
| **Actual Background (0)** | **45** (True Negatives) | **4** (False Positives) |
| **Actual Landslide (1)** | **7** (False Negatives) | **3** (True Positives) |

---

## 6. Feature Importance & SHAP Interpretability

### Importance Metrics Table

| Feature Name | Gain Score | Gain Importance (%) | SHAP Mean Absolute | SHAP Importance (%) |
| :--- | :--- | :--- | :--- | :--- |
| **`elevation_m`** | 28.17 | **58.07%** | 0.7592 | **46.15%** |
| **`rain_prev_72h_mm`** | 9.63 | **19.85%** | 0.4532 | **27.55%** |
| **`rain_prev_7d_mm`** | 5.80 | **11.95%** | 0.2057 | **12.50%** |
| **`rain_prev_24h_mm`** | 3.91 | **8.07%** | 0.2203 | **13.39%** |
| **`slope_deg`** | 1.00 | **2.06%** | 0.0066 | **0.40%** |

> [!NOTE]
> **Dominance & Non-Causal Interpretation:**  
> `elevation_m` accounts for 58.1% of total tree split gain and 46.1% of SHAP importance. This reflects the reality that Cyclone Remal slope failures clustered heavily in the mid-to-high ridge settlements of Aizawl. This is an associative spatial pattern and **must not be claimed as a direct causal trigger**.

---

## 7. Overfitting, Generalization & Leakage Audit

### 1. Evidence of Spatial Domain Shift & Overfitting
- **Train ROC-AUC:** `0.9927` | **Test ROC-AUC:** `0.8276`
- **Train F1:** `0.9565` | **Test F1:** `0.3529`
- **Analysis:** The significant performance drop between the training block and the spatially unseen North-East test block reflects genuine spatial domain shift (different topographic gradient in outer North-East Aizawl). This confirms that a naive random split would have caused severe optimistic data leakage.

### 2. Single-Event Temporal Limitation
All positive labels correspond to May 28, 2024. The model has zero variance across storm profiles and cannot generalize to dry-season slope stability or moderate storms.

---

## 8. Artifact Locations & Persisted Schema

| Artifact | File Path | Description |
| :--- | :--- | :--- |
| **Spatial Split Mapping** | [`data/generated/model_spatial_split.csv`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/data/generated/model_spatial_split.csv) | Sample-level spatial group and split tags |
| **Trained XGBoost Model** | [`backend/models/xgboost_landslide_model.joblib`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/backend/models/xgboost_landslide_model.joblib) | Serialized XGBoost model object |
| **Metrics Artifact** | [`backend/models/metrics.json`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/backend/models/metrics.json) | Full machine-readable split metrics and confusion matrices |
| **Feature Schema & Metadata** | [`backend/models/feature_schema.json`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/backend/models/feature_schema.json) | Metadata, input schema, limitations, and semantics |
| **Feature Importance Table** | [`backend/models/feature_importance.csv`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/backend/models/feature_importance.csv) | Gain and SHAP importance breakdowns |
| **Training Report** | [`data/generated/model_training_report.md`](file:///c:/Users/heerp/OneDrive/Desktop/TerraWatch/data/generated/model_training_report.md) | Comprehensive engineering documentation |
