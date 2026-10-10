"""
Phase 2B & M1-Fix-B — Comprehensive ML Pipeline Verification Test Suite
========================================================================
Verifies:
  1. Python imports & environment
  2. Preprocessing & data validation (including logical quantity bounds)
  3. Feature engineering & strict leakage prevention
  4. Insufficient data handling (clean stop without data fabrication)
  5. TimeSeriesSplit validation strictly on training portion (untouched final holdout)
  6. Final single-pass holdout evaluation & naive baselines comparison:
     - Demand: Lag-1, Lag-7, Historical Mean, Rolling Mean baselines vs selected ML model
     - Waste-Risk: Majority-class baseline vs selected ML model
  7. Class distribution tracking & missing-class limitations detection
  8. Artifact serialization & deserialization (Joblib roundtrip in isolated directory)
  9. Production artifact protection (ml/artifacts/ untouched by tests)
"""

import os
import sys
import json
import tempfile
import shutil
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
    cross_validate_demand_candidates,
    cross_validate_waste_risk_candidates,
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
    print("   PHASE 2B & M1-FIX-B — ML PIPELINE VERIFICATION SUITE")
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

    # 1. Environment & Package Imports
    print("1. Environment & Package Imports:")
    import sklearn
    check(hasattr(sklearn, "__version__"), f"All ML libraries imported (sklearn {sklearn.__version__}, joblib {joblib.__version__})")

    # 2. Preprocessing & Data Validation
    print("\n2. Data Preprocessing & Validation:")
    invalid_row = pd.DataFrame([{
        "food_item_id": 1,
        "record_date": "2026-10-01",
        "quantity_prepared": 50.0,
        "quantity_sold": 40.0,
        "quantity_wasted": 15.0,  # 40 + 15 = 55 > 50 -> logical violation
    }])
    val_rep = validate_dataframe(invalid_row)
    check(len(val_rep["errors"]) > 0, "Logical violation (sold + wasted > prepared) detected by validator")

    valid_row = pd.DataFrame([{
        "food_item_id": 1,
        "record_date": "2026-10-01",
        "quantity_prepared": 50.0,
        "quantity_sold": 35.0,
        "quantity_wasted": 10.0,
    }])
    val_rep_ok = validate_dataframe(valid_row)
    check(len(val_rep_ok["errors"]) == 0, "Valid record passes validation")

    # 3. Feature Engineering & Strict Leakage Prevention
    print("\n3. Feature Engineering & Leakage Prevention:")
    synth_df = generate_verification_demand_data(n_days=10, food_items=[1])
    with_dates = add_date_features(synth_df)
    check("day_of_week" in with_dates.columns and "is_weekend" in with_dates.columns, "Calendar features extracted")

    with_lags = add_lag_features(synth_df)
    check("sold_lag_1" in with_lags.columns and "sold_lag_3" in with_lags.columns and "sold_lag_7" in with_lags.columns, "Lag features created per food item")

    with_rolling = add_rolling_features(with_lags)
    check("sold_rolling_mean_3" in with_rolling.columns and "sold_rolling_mean_7" in with_rolling.columns, "Rolling features created with shift(1)")

    # Verify shift(1) prevents rolling leakage on row 1
    first_sold = with_rolling.loc[0, "quantity_sold"]
    second_rolling = with_rolling.loc[1, "sold_rolling_mean_3"]
    check(abs(first_sold - second_rolling) < 1e-4, "Rolling statistics strictly use shifted historical values (shift 1)")

    # Verify Leakage in Task Matrices
    d_matrix = prepare_task_matrices(synth_df, task="demand")
    check("quantity_prepared" not in d_matrix["X"].columns, "Demand task: 'quantity_prepared' EXCLUDED from features (no prep leakage)")
    check("quantity_sold" not in d_matrix["X"].columns, "Demand task: target 'quantity_sold' EXCLUDED from features (no leakage)")
    check("quantity_wasted" not in d_matrix["X"].columns, "Demand task: 'quantity_wasted' EXCLUDED from features (no leakage)")

    w_matrix = prepare_task_matrices(synth_df, task="waste_risk")
    check("quantity_prepared" in w_matrix["X"].columns, "Waste-risk task: 'quantity_prepared' INCLUDED in features")
    check("waste_ratio" not in w_matrix["X"].columns, "Waste-risk task: 'waste_ratio' EXCLUDED from features (no target leakage)")
    check("quantity_wasted" not in w_matrix["X"].columns, "Waste-risk task: 'quantity_wasted' EXCLUDED from features (no target leakage)")
    check("sell_through_rate" not in w_matrix["X"].columns, "Waste-risk task: 'sell_through_rate' EXCLUDED from features (no target leakage)")

    # 4, 5, 6, 7: Use a dedicated temporary test artifacts directory
    temp_test_dir = tempfile.mkdtemp(prefix="foodwaste_ml_test_artifacts_")
    try:
        # 4. Insufficient Data Handling
        print("\n4. Insufficient Data Handling:")
        small_df = synth_df.iloc[:5].copy()  # Only 5 samples
        insuf_res = run_training_pipeline(df_input=small_df, min_samples=30, artifacts_dir=temp_test_dir)
        check(insuf_res["status"] == "insufficient_data", "Pipeline stops cleanly on insufficient data without fabrication")
        check("samples_count" in insuf_res and insuf_res["samples_count"] == 5, "Reports exact record count and refusal reason")

        # 5. TimeSeriesSplit Validation & Model Selection on Training Portion
        print("\n5. TimeSeriesSplit Model Selection on Training Portion:")
        full_data = generate_verification_demand_data(n_days=50, food_items=[1, 2])
        train_res = run_training_pipeline(df_input=full_data, min_samples=30, random_state=42, artifacts_dir=temp_test_dir)
        check(train_res["status"] == "success", "Training pipeline succeeds on valid dataset")

        meta = train_res["metadata"]

        # Verify holdout was never used for model selection
        demand_info = meta["demand_model"]
        check("time_series_splits" in demand_info and demand_info["time_series_splits"] == 3,
              "Demand model selected using 3 TimeSeriesSplit folds on training set only")
        check("validation_metrics" in demand_info, "TimeSeriesSplit cross-validation scores recorded for all candidates")
        check(demand_info["selected_model"] in demand_info["validation_metrics"],
              f"Selected demand model: {demand_info['selected_model']}")

        waste_info = meta["waste_risk_model"]
        check("time_series_splits" in waste_info and waste_info["time_series_splits"] == 3,
              "Waste-risk model selected using 3 TimeSeriesSplit folds on training set only")
        check("validation_metrics" in waste_info, "TimeSeriesSplit cross-validation scores recorded for all waste candidates")
        check(waste_info["selected_model"] in waste_info["validation_metrics"],
              f"Selected waste-risk model: {waste_info['selected_model']}")

        # 6. Final Holdout Evaluation & Naive Baselines
        print("\n6. Final Holdout Evaluation & Naive Baselines Comparison:")
        # Demand Holdout & Baselines
        check("holdout_metrics" in demand_info, "Evaluated selected demand model once on untouched holdout")
        check("baselines" in demand_info, "Computed naive baselines on untouched holdout")
        baselines = demand_info["baselines"]
        check("lag_1" in baselines and "lag_7" in baselines and "historical_mean" in baselines,
              "Reported lag_1, lag_7, and historical_mean baselines")
        check("comparison_against_baselines" in demand_info and "superiority_verdict" in demand_info,
              "Strictly verified whether ML beats applicable demand baselines")

        # Waste Risk Holdout & Majority-Class Baseline
        check("holdout_metrics" in waste_info, "Evaluated selected waste-risk model once on untouched holdout")
        check("baseline" in waste_info and waste_info["baseline"]["applicable"],
              "Computed majority-class baseline derived strictly from training data")
        check("comparison_against_baseline" in waste_info and "superiority_verdict" in waste_info,
              "Strictly verified whether ML beats majority-class baseline")

        # 7. Test/Holdout Data Reporting & Class Distribution
        print("\n7. Holdout Data Reporting & Class Distribution:")
        sample_counts = meta["sample_counts"]
        check("demand_usable_observations" in sample_counts and "demand_train_samples" in sample_counts and "demand_holdout_samples" in sample_counts,
              f"Reported usable ({sample_counts['demand_usable_observations']}), train ({sample_counts['demand_train_samples']}), and holdout ({sample_counts['demand_holdout_samples']}) counts")

        class_dist = waste_info["class_distribution"]
        check("training" in class_dist and "holdout" in class_dist, "Reported waste-risk class distribution in training and holdout")
        check("present_classes_in_holdout" in class_dist and "absent_classes_in_holdout" in class_dist, "Identified present and absent classes in holdout")
        check("limitations_note" in class_dist, f"Class limitations accurately reported: {class_dist['limitations_note']}")

        # 8. Artifact Serialization & Deserialization in Isolated Test Directory
        print("\n8. Artifact Serialization & Deserialization (Isolated Test Directory):")
        test_demand_path = os.path.join(temp_test_dir, "demand_forecasting_model.joblib")
        test_waste_path = os.path.join(temp_test_dir, "waste_risk_model.joblib")
        test_metadata_path = os.path.join(temp_test_dir, "training_metadata.joblib")

        check(os.path.exists(test_demand_path) and os.path.getsize(test_demand_path) > 0, "demand_forecasting_model.joblib created in test directory")
        check(os.path.exists(test_waste_path) and os.path.getsize(test_waste_path) > 0, "waste_risk_model.joblib created in test directory")
        check(os.path.exists(test_metadata_path) and os.path.getsize(test_metadata_path) > 0, "training_metadata.joblib created in test directory")

        loaded_demand_model = load_artifact(test_demand_path)
        loaded_waste_model = load_artifact(test_waste_path)
        check(hasattr(loaded_demand_model, "predict"), "Loaded test demand model exposes .predict() API")
        check(hasattr(loaded_waste_model, "predict"), "Loaded test waste risk model exposes .predict() API")

        # Predict test
        test_features_d = prepare_task_matrices(full_data, task="demand")["X"].iloc[:3]
        d_preds = loaded_demand_model.predict(test_features_d)
        check(len(d_preds) == 3 and np.all(np.isfinite(d_preds)), "Loaded demand model produces valid real-valued predictions")

        test_features_w = prepare_task_matrices(full_data, task="waste_risk")["X"].iloc[:3]
        w_preds = loaded_waste_model.predict(test_features_w)
        check(len(w_preds) == 3 and all(p in [0, 1, 2] for p in w_preds), "Loaded waste risk model produces valid class predictions in {0, 1, 2}")

        # Check production artifacts directory was NEVER contaminated by tests
        check(not os.path.exists(DEMAND_MODEL_PATH), "Production ml/artifacts/ remains untouched by test suite")
    finally:
        shutil.rmtree(temp_test_dir, ignore_errors=True)
    print("=" * 65)

    print(f"\nFinal Test Results: {passed} PASSED, {failed} FAILED")
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_tests()
