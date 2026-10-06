"""
Phase 2B — Comprehensive ML Pipeline Verification Test Suite
============================================================
Verifies:
  1. Python imports & environment
  2. Preprocessing & data validation (including logical quantity bounds)
  3. Feature engineering & strict leakage prevention
  4. Insufficient data handling (without data fabrication)
  5. Full training pipeline with time-aware split on candidate models:
     - Demand: LinearRegression, RandomForestRegressor, GradientBoostingRegressor (MAE, RMSE, R²)
     - Waste-Risk: LogisticRegression, RandomForestClassifier, GradientBoostingClassifier (Acc, Prec, Rec, F1, CM)
  6. Artifact serialization & deserialization (Joblib roundtrip)
"""

import os
import sys
import json
import numpy as np
import pandas as pd
import joblib

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.src.preprocessing.data_preprocessor import (
    validate_dataframe,
    clean_dataframe,
    preprocess_pipeline,
)
from ml.src.features.feature_engineering import (
    add_date_features,
    add_lag_features,
    add_rolling_features,
    label_waste_risk,
    prepare_task_matrices,
    DEMAND_FORECAST_FEATURES,
    WASTE_RISK_FEATURES,
    LOW_RISK_THRESHOLD,
    HIGH_RISK_THRESHOLD,
)
from ml.src.models.model_trainer import (
    time_aware_split,
    train_and_compare_demand_models,
    train_and_compare_waste_risk_models,
    load_artifact,
    DEMAND_MODEL_PATH,
    WASTE_RISK_MODEL_PATH,
    METADATA_PATH,
)
from ml.src.train import run_training_pipeline


def generate_verification_demand_data(n_days=60, food_items=(1, 2)) -> pd.DataFrame:
    """
    Generates a deterministic, sequential demand dataset for ML pipeline verification.
    Satisfies sold + wasted <= prepared.
    """
    np.random.seed(42)
    dates = pd.date_range(start="2026-08-01", periods=n_days, freq="D")
    records = []

    for item_id in food_items:
        base_demand = 80.0 if item_id == 1 else 45.0
        for i, dt in enumerate(dates):
            dow = dt.dayofweek
            weekend_boost = 15.0 if dow >= 5 else 0.0
            trend = i * 0.2

            # Realistic consumption with variations
            sold = float(np.clip(base_demand + weekend_boost + trend + np.sin(i / 3.0) * 10, 20.0, 150.0))
            # Varying waste behaviors (low, medium, high waste days)
            waste_pct = 0.05 if (i % 3 == 0) else (0.18 if (i % 3 == 1) else 0.30)
            wasted = float(round(sold * waste_pct, 2))
            prepared = float(round(sold + wasted + 5.0, 2))  # prepared always >= sold + wasted

            records.append({
                "food_item_id": item_id,
                "record_date": dt.strftime("%Y-%m-%d"),
                "quantity_prepared": prepared,
                "quantity_sold": sold,
                "quantity_wasted": wasted,
            })

    return pd.DataFrame(records)


def run_tests():
    print("=" * 65)
    print("   PHASE 2B — ML PIPELINE VERIFICATION SUITE")
    print("=" * 65 + "\n")

    passed = 0
    failed = 0

    def check(condition: bool, name: str):
        nonlocal passed, failed
        if condition:
            print(f"  [PASS] {name}")
            passed += 1
        else:
            print(f"  [FAIL] {name}")
            failed += 1

    # 1. Imports
    print("1. Environment & Package Imports:")
    try:
        import sklearn
        import matplotlib
        import seaborn
        check(True, f"All ML libraries imported (sklearn {sklearn.__version__}, joblib {joblib.__version__})")
    except Exception as e:
        check(False, f"ML library import failed: {e}")

    # 2. Preprocessing & Data Validation
    print("\n2. Data Preprocessing & Validation:")
    invalid_sample = pd.DataFrame({
        "food_item_id": [1],
        "record_date": ["2026-10-01"],
        "quantity_prepared": [50.0],
        "quantity_sold": [40.0],
        "quantity_wasted": [20.0],  # 40 + 20 = 60 > 50 -> logical violation
    })
    v_report = validate_dataframe(invalid_sample)
    check(not v_report["is_valid"], "Logical violation (sold + wasted > prepared) detected by validator")

    valid_sample = pd.DataFrame({
        "food_item_id": [1],
        "record_date": ["2026-10-01"],
        "quantity_prepared": [50.0],
        "quantity_sold": [40.0],
        "quantity_wasted": [8.0],
    })
    v_valid = validate_dataframe(valid_sample)
    check(v_valid["is_valid"], "Valid record passes validation")

    # 3. Feature Engineering & Leakage Prevention
    print("\n3. Feature Engineering & Leakage Prevention:")
    synth_df = generate_verification_demand_data(n_days=15, food_items=[1])
    featured = add_date_features(synth_df)
    check(all(c in featured.columns for c in ["day_of_week", "month", "is_weekend", "quarter"]), "Calendar features extracted")

    with_lags = add_lag_features(featured)
    check(all(c in with_lags.columns for c in ["sold_lag_1", "sold_lag_3", "sold_lag_7"]), "Lag features created per food item")

    with_rolling = add_rolling_features(with_lags)
    check("sold_rolling_mean_3" in with_rolling.columns and "sold_rolling_mean_7" in with_rolling.columns, "Rolling features created with shift(1)")

    # Verify shift(1) prevents rolling leakage on row 1
    # For day 1 (index 1), sold_rolling_mean_3 should equal the day 0 quantity_sold
    first_sold = with_rolling.loc[0, "quantity_sold"]
    second_rolling = with_rolling.loc[1, "sold_rolling_mean_3"]
    check(abs(first_sold - second_rolling) < 1e-4, "Rolling statistics strictly use shifted historical values (shift 1)")

    # Verify Leakage in Task Matrices
    d_matrix = prepare_task_matrices(synth_df, task="demand")
    check("quantity_sold" not in d_matrix["X"].columns, "Demand task: target 'quantity_sold' EXCLUDED from features (no leakage)")
    check("quantity_wasted" not in d_matrix["X"].columns, "Demand task: 'quantity_wasted' EXCLUDED from features (no leakage)")

    w_matrix = prepare_task_matrices(synth_df, task="waste_risk")
    check("waste_ratio" not in w_matrix["X"].columns, "Waste-risk task: 'waste_ratio' EXCLUDED from features (no target leakage)")
    check("quantity_wasted" not in w_matrix["X"].columns, "Waste-risk task: 'quantity_wasted' EXCLUDED from features (no target leakage)")
    check("sell_through_rate" not in w_matrix["X"].columns, "Waste-risk task: 'sell_through_rate' EXCLUDED from features (no target leakage)")

    # 4. Insufficient Data Handling
    print("\n4. Insufficient Data Handling:")
    small_df = synth_df.iloc[:5].copy()  # Only 5 samples
    insuf_res = run_training_pipeline(df_input=small_df, min_samples=30)
    check(insuf_res["status"] == "insufficient_data", "Pipeline stops cleanly on insufficient data without fabrication")
    check("samples_count" in insuf_res and insuf_res["samples_count"] == 5, "Reports exact record count and refusal reason")

    # 5. Full Model Training, Comparison & Evaluation on Sufficient Data
    print("\n5. Model Training & Comparison (Time-Aware Split):")
    full_data = generate_verification_demand_data(n_days=50, food_items=[1, 2])
    train_res = run_training_pipeline(df_input=full_data, min_samples=30, random_state=42)
    check(train_res["status"] == "success", "Training pipeline succeeds on valid dataset")

    meta = train_res["metadata"]

    # Demand Regressors Comparison
    demand_comp = meta["demand_model"]["comparison"]
    check("LinearRegression" in demand_comp and "RandomForestRegressor" in demand_comp and "GradientBoostingRegressor" in demand_comp,
          "Trained & compared all 3 regressors: LinearRegression, RandomForestRegressor, GradientBoostingRegressor")
    check(all("MAE" in m and "RMSE" in m and "R2" in m for m in demand_comp.values()),
          "Calculated regression metrics: MAE, RMSE, R² for each candidate")
    check(meta["demand_model"]["selected_model"] in demand_comp,
          f"Selected best valid demand model: {meta['demand_model']['selected_model']}")

    # Waste-Risk Classifiers Comparison
    waste_comp = meta["waste_risk_model"]["comparison"]
    check("LogisticRegression" in waste_comp and "RandomForestClassifier" in waste_comp and "GradientBoostingClassifier" in waste_comp,
          "Trained & compared all 3 classifiers: LogisticRegression, RandomForestClassifier, GradientBoostingClassifier")
    check(all("Accuracy" in m and "F1" in m and "Precision" in m and "Recall" in m and "confusion_matrix" in m for m in waste_comp.values()),
          "Calculated classification metrics: Accuracy, Precision, Recall, F1, Confusion Matrix")
    check(meta["waste_risk_model"]["selected_model"] in waste_comp,
          f"Selected best valid waste-risk model: {meta['waste_risk_model']['selected_model']}")

    # 6. Artifact Serialization & Deserialization (Joblib Roundtrip)
    print("\n6. Artifact Serialization & Deserialization:")
    check(os.path.exists(DEMAND_MODEL_PATH) and os.path.getsize(DEMAND_MODEL_PATH) > 0, "demand_forecasting_model.joblib exists and is non-empty")
    check(os.path.exists(WASTE_RISK_MODEL_PATH) and os.path.getsize(WASTE_RISK_MODEL_PATH) > 0, "waste_risk_model.joblib exists and is non-empty")
    check(os.path.exists(METADATA_PATH) and os.path.getsize(METADATA_PATH) > 0, "training_metadata.joblib exists and is non-empty")

    loaded_demand_model = load_artifact(DEMAND_MODEL_PATH)
    loaded_waste_model = load_artifact(WASTE_RISK_MODEL_PATH)
    check(hasattr(loaded_demand_model, "predict"), "Loaded demand model exposes .predict() API")
    check(hasattr(loaded_waste_model, "predict"), "Loaded waste risk model exposes .predict() API")

    # Predict test
    test_features_d = prepare_task_matrices(full_data, task="demand")["X"].iloc[:3]
    d_preds = loaded_demand_model.predict(test_features_d)
    check(len(d_preds) == 3 and np.all(np.isfinite(d_preds)), "Loaded demand model produces valid real-valued predictions")

    test_features_w = prepare_task_matrices(full_data, task="waste_risk")["X"].iloc[:3]
    w_preds = loaded_waste_model.predict(test_features_w)
    check(len(w_preds) == 3 and all(p in [0, 1, 2] for p in w_preds), "Loaded waste risk model produces valid class predictions in {0, 1, 2}")

    print("\n" + "=" * 65)
    print(f"SUMMARY: {passed} PASSED, {failed} FAILED")
    print("=" * 65)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
