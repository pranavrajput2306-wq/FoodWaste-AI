"""
Training Entry Point Module
===========================
Executes the reproducible training pipeline for:
  1. Demand Forecasting (Regression)
  2. Waste-Risk (Classification)

Usage:
  python -m ml.src.train [--data PATH] [--min-samples INT] [--random-state INT]

Rules:
  - If data is below minimum threshold, reports 'insufficient_data' without fabrication.
  - Compares all required candidate models on time-aware train/test split.
  - Selects and serializes the best valid model for each task using Joblib.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import pandas as pd

from ml.src.preprocessing.data_preprocessor import preprocess_pipeline
from ml.src.features.feature_engineering import (
    prepare_task_matrices,
    LOW_RISK_THRESHOLD,
    HIGH_RISK_THRESHOLD,
    RISK_LABEL_NAMES,
    DEMAND_FORECAST_FEATURES,
    WASTE_RISK_FEATURES,
)
from ml.src.models.model_trainer import (
    time_aware_split,
    train_and_compare_demand_models,
    train_and_compare_waste_risk_models,
    save_artifact,
    DEMAND_MODEL_PATH,
    WASTE_RISK_MODEL_PATH,
    METADATA_PATH,
    EVAL_RESULTS_PATH,
    ARTIFACTS_DIR,
)

# Minimum number of historical observations required for genuine time-series ML
DEFAULT_MIN_SAMPLES = 30
DEFAULT_RANDOM_STATE = 42


def run_training_pipeline(
    data_source: Optional[str] = None,
    df_input: Optional[pd.DataFrame] = None,
    min_samples: int = DEFAULT_MIN_SAMPLES,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> Dict[str, Any]:
    """
    Executes the genuine ML training pipeline.
    """
    print("=" * 60)
    print("  FOODWASTE AI — REPRODUCIBLE ML TRAINING PIPELINE")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}Z")
    print(f"Random State: {random_state} | Min Samples Required: {min_samples}\n")

    # 1. Load Data
    if df_input is not None:
        raw_df = df_input.copy()
        source_desc = f"In-memory DataFrame ({len(raw_df)} rows)"
    else:
        if not data_source:
            # Default location
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_source = os.path.join(base_dir, "data", "raw", "demand_records.csv")

        if not os.path.exists(data_source):
            print(f"❌ Data file not found: {data_source}")
            status = {
                "status": "insufficient_data",
                "message": f"Data file does not exist at {data_source}.",
                "samples_count": 0,
                "min_samples_required": min_samples,
            }
            save_status_artifact(status)
            return status

        raw_df = pd.read_csv(data_source)
        source_desc = f"{data_source} ({len(raw_df)} rows)"

    print(f"1. Loading dataset from: {source_desc}")

    # 2. Preprocess & Validate
    prep_result = preprocess_pipeline(raw_df)
    if not prep_result["success"]:
        print(f"❌ Preprocessing validation failed: {prep_result['report']['errors']}")
        status = {
            "status": "validation_failed",
            "errors": prep_result["report"]["errors"],
            "warnings": prep_result["report"].get("warnings", []),
        }
        save_status_artifact(status)
        return status

    cleaned_df = prep_result["data"]
    total_valid = len(cleaned_df)
    print(f"2. Preprocessing & Validation: PASS ({total_valid} valid records)")

    # 3. Check Data Sufficiency
    if total_valid < min_samples:
        print("\n" + "!" * 60)
        print("  INSUFFICIENT DATA DETECTED")
        print("!" * 60)
        print(f"  Current available records : {total_valid}")
        print(f"  Minimum required records  : {min_samples}")
        print("  Reason: A reliable time-aware train/test split with lag windows")
        print("  (lags 1, 3, 7 days) requires at least 30 observations to prevent")
        print("  overfitting and temporal bias.")
        print("  -> DO NOT FABRICATE DATA: Model training aborted cleanly.")
        print("!" * 60 + "\n")

        status = {
            "status": "insufficient_data",
            "message": (
                f"Insufficient historical demand observations: {total_valid} available, "
                f"{min_samples} required for reliable time-aware train/test evaluation."
            ),
            "samples_count": total_valid,
            "min_samples_required": min_samples,
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
        save_status_artifact(status)
        return status

    # 4. Feature Engineering for Task 1: Demand Forecasting
    print("\n3. Feature Engineering & Matrix Construction:")
    demand_matrix = prepare_task_matrices(cleaned_df, task="demand")
    X_demand = demand_matrix["X"]
    y_demand = demand_matrix["y"]
    dates_demand = demand_matrix["dates"]

    if len(X_demand) < int(min_samples * 0.7):
        print(f"❌ Insufficient post-lag samples ({len(X_demand)} remaining after lag window drop).")
        status = {
            "status": "insufficient_data",
            "message": f"Only {len(X_demand)} samples remain after lag calculation.",
            "samples_count": len(X_demand),
            "min_samples_required": min_samples,
        }
        save_status_artifact(status)
        return status

    # 5. Time-Aware Split (Demand)
    X_train_d, X_test_d, y_train_d, y_test_d = time_aware_split(
        X_demand, y_demand, dates_demand, test_ratio=0.2
    )
    print(f"   Demand Task Split -> Train: {len(X_train_d)} samples | Test: {len(X_test_d)} samples")

    # 6. Train & Compare Demand Regressors
    print("\n4. Training & Comparing Demand Regressors (Time-Aware Split):")
    best_demand_model, best_demand_name, demand_eval = train_and_compare_demand_models(
        X_train_d, X_test_d, y_train_d, y_test_d, random_state=random_state
    )
    for model_name, metrics in demand_eval["comparison"].items():
        prefix = "[SELECTED]" if model_name == best_demand_name else "          "
        print(f"   {prefix} {model_name:26s} | MAE: {metrics['MAE']:8.4f} | RMSE: {metrics['RMSE']:8.4f} | R2: {metrics['R2']:8.4f}")

    # 7. Feature Engineering for Task 2: Waste-Risk Classification
    waste_matrix = prepare_task_matrices(cleaned_df, task="waste_risk")
    X_waste = waste_matrix["X"]
    y_waste = waste_matrix["y"]
    dates_waste = waste_matrix["dates"]

    X_train_w, X_test_w, y_train_w, y_test_w = time_aware_split(
        X_waste, y_waste, dates_waste, test_ratio=0.2
    )
    print(f"\n5. Waste-Risk Task Split -> Train: {len(X_train_w)} samples | Test: {len(X_test_w)} samples")
    print(f"   Train Class Distribution : {dict(pd.Series(y_train_w).value_counts())}")
    print(f"   Test Class Distribution  : {dict(pd.Series(y_test_w).value_counts())}")

    # 8. Train & Compare Waste-Risk Classifiers
    print("\n6. Training & Comparing Waste-Risk Classifiers:")
    best_waste_model, best_waste_name, waste_eval = train_and_compare_waste_risk_models(
        X_train_w, X_test_w, y_train_w, y_test_w, random_state=random_state
    )
    for model_name, metrics in waste_eval["comparison"].items():
        prefix = "[SELECTED]" if model_name == best_waste_name else "          "
        print(f"   {prefix} {model_name:26s} | Acc: {metrics['Accuracy']:6.4f} | F1: {metrics['F1']:6.4f} | Prec: {metrics['Precision']:6.4f} | Rec: {metrics['Recall']:6.4f}")

    # 9. Artifact Serialization
    print("\n7. Serializing Selected Models & Metadata:")
    save_artifact(best_demand_model, DEMAND_MODEL_PATH)
    print(f"   [OK] Best Demand Model saved -> {DEMAND_MODEL_PATH}")

    save_artifact(best_waste_model, WASTE_RISK_MODEL_PATH)
    print(f"   [OK] Best Waste Risk Model saved -> {WASTE_RISK_MODEL_PATH}")

    metadata = {
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "random_state": random_state,
        "sample_counts": {
            "total_clean_records": total_valid,
            "demand_train_samples": len(X_train_d),
            "demand_test_samples": len(X_test_d),
            "waste_train_samples": len(X_train_w),
            "waste_test_samples": len(X_test_w),
        },
        "demand_model": {
            "selected_model": best_demand_name,
            "metrics": demand_eval["best_metrics"],
            "features": demand_matrix["features"],
            "comparison": demand_eval["comparison"],
        },
        "waste_risk_model": {
            "selected_model": best_waste_name,
            "metrics": waste_eval["best_metrics"],
            "features": waste_matrix["features"],
            "comparison": waste_eval["comparison"],
            "thresholds": {
                "low_risk": f"< {LOW_RISK_THRESHOLD * 100}% waste",
                "medium_risk": f"{LOW_RISK_THRESHOLD * 100}% to {HIGH_RISK_THRESHOLD * 100}% waste",
                "high_risk": f">= {HIGH_RISK_THRESHOLD * 100}% waste",
            },
            "class_labels": RISK_LABEL_NAMES,
        },
    }

    save_artifact(metadata, METADATA_PATH)
    print(f"   [OK] Metadata saved -> {METADATA_PATH}")

    # Structured JSON results
    with open(EVAL_RESULTS_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"   [OK] Evaluation results JSON saved -> {EVAL_RESULTS_PATH}")

    return {
        "status": "success",
        "metadata": metadata,
        "demand_model_path": DEMAND_MODEL_PATH,
        "waste_risk_model_path": WASTE_RISK_MODEL_PATH,
    }


def save_status_artifact(status_dict: Dict[str, Any]) -> None:
    """Save pipeline execution status to artifacts directory."""
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)
    status_path = os.path.join(ARTIFACTS_DIR, "training_status.json")
    with open(status_path, "w", encoding="utf-8") as f:
        json.dump(status_dict, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="FoodWaste AI ML Training Pipeline")
    parser.add_argument("--data", type=str, default=None, help="Path to raw CSV dataset")
    parser.add_argument("--min-samples", type=int, default=DEFAULT_MIN_SAMPLES, help="Minimum samples threshold")
    parser.add_argument("--random-state", type=int, default=DEFAULT_RANDOM_STATE, help="Seed for reproducibility")
    args = parser.parse_args()

    result = run_training_pipeline(
        data_source=args.data,
        min_samples=args.min_samples,
        random_state=args.random_state,
    )
    if result.get("status") == "insufficient_data":
        sys.exit(0)
    elif result.get("status") != "success":
        sys.exit(1)


if __name__ == "__main__":
    main()
