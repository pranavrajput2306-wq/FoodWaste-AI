# AI-Powered Food Waste Prediction & Reduction System
# ML Module

## Overview

This directory contains the **Machine Learning pipeline** for the AI-Powered Food Waste
Prediction & Reduction System. It is intentionally kept separate from the backend (`server/`)
and frontend (`client/`) layers.

---

## Directory Structure

```
ml/
├── data/             # Raw and processed datasets (not committed — add to .gitignore)
├── notebooks/        # Jupyter notebooks for EDA and experimentation
├── src/
│   ├── preprocessing/   # Data validation, cleaning, derived metrics
│   ├── features/        # Feature engineering (lag, rolling, date, risk labels)
│   ├── models/          # Model definitions, training stubs, serialisation
│   ├── evaluation/      # Evaluation metrics (MAE, RMSE, R², F1, etc.)
│   └── utils/           # Shared helpers (I/O, logging, date utilities)
├── artifacts/        # Saved/serialised models (*.joblib) — not committed
├── requirements.txt  # Python dependencies
└── README.md
```

---

## ML Tasks

### Task 1 — Demand Forecasting (Regression)

**Goal:** Predict the expected quantity of a food item to be sold on a future date.

| Item             | Detail                                                     |
|------------------|------------------------------------------------------------|
| Target variable  | `quantity_sold`                                            |
| Features         | Lag features, rolling stats, date parts, quantity_prepared |
| Candidate models | RandomForestRegressor, GradientBoostingRegressor, Linear   |
| Metrics          | MAE, RMSE, R²                                              |

### Task 2 — Waste-Risk Classification (Multi-class)

**Goal:** Classify a food item's waste risk as **Low**, **Medium**, or **High**.

| Item             | Detail                                                     |
|------------------|------------------------------------------------------------|
| Target variable  | `waste_risk_label` (0=Low, 1=Medium, 2=High)               |
| Features         | Waste ratio, sell-through rate, rolling waste, date parts  |
| Candidate models | RandomForestClassifier, GradientBoostingClassifier, LR     |
| Metrics          | Accuracy, Precision, Recall, F1 (weighted)                 |

---

## ML Pipeline

```
Historical Data (MySQL demand_records)
  → Data Validation        (src/preprocessing/data_preprocessor.py)
  → EDA                    (notebooks/)
  → Data Cleaning          (src/preprocessing/data_preprocessor.py)
  → Feature Engineering    (src/features/feature_engineering.py)
  → Train/Test Split       (sklearn.model_selection.train_test_split)
  → Baseline Models        (src/models/model_trainer.py)
  → Model Training         (src/models/model_trainer.py)
  → Model Evaluation       (src/evaluation/model_evaluator.py)
  → Model Comparison       (src/evaluation/model_evaluator.py)
  → Best Model Selection
  → Model Serialisation    (joblib → artifacts/)
  → Prediction API         (FastAPI — Phase 2)
  → Backend Integration    (Express REST API)
```

---

## Setup

```bash
# Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

---

## Notes

- **Phase 1**: Structure and stubs only. No final model training yet.
- **Phase 2**: Real model training, evaluation, and FastAPI prediction service.
- Data files and trained model artefacts are excluded from version control.
