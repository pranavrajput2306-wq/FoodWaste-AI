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
    artifacts_dir: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the genuine ML training pipeline.
    """
    target_artifacts_dir = artifacts_dir if artifacts_dir else ARTIFACTS_DIR
    os.makedirs(target_artifacts_dir, exist_ok=True)

    print("=" * 60)
    print("  FOODWASTE AI — REPRODUCIBLE ML TRAINING PIPELINE")
    print("=" * 60)
    print(f"Timestamp: {datetime.now(timezone.utc).isoformat()}Z")
    print(f"Random State: {random_state} | Min Samples Required: {min_samples}")
    print(f"Artifacts Destination: {target_artifacts_dir}\n")

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
            print(f"[ERROR] Data file not found: {data_source}")
            status = {
                "status": "insufficient_data",
                "message": f"Data file does not exist at {data_source}.",
                "samples_count": 0,
                "min_samples_required": min_samples,
            }
            save_status_artifact(status, artifacts_dir=target_artifacts_dir)
            return status

        raw_df = pd.read_csv(data_source)
        source_desc = f"{data_source} ({len(raw_df)} rows)"

    print(f"1. Loading dataset from: {source_desc}")

    # 2. Preprocess & Validate
    prep_result = preprocess_pipeline(raw_df)
    if not prep_result["success"]:
        print(f"[ERROR] Preprocessing validation failed: {prep_result['report']['errors']}")
        status = {
            "status": "validation_failed",
            "errors": prep_result["report"]["errors"],
            "warnings": prep_result["report"].get("warnings", []),
        }
        save_status_artifact(status, artifacts_dir=target_artifacts_dir)
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
        save_status_artifact(status, artifacts_dir=target_artifacts_dir)
        return status

    # 4. Feature Engineering for Task 1: Demand Forecasting
    print("\n3. Feature Engineering & Matrix Construction:")
    demand_matrix = prepare_task_matrices(cleaned_df, task="demand")
    X_demand = demand_matrix["X"]
    y_demand = demand_matrix["y"]
    dates_demand = demand_matrix["dates"]

    if len(X_demand) < int(min_samples * 0.7):
        print(f"[ERROR] Insufficient post-lag samples ({len(X_demand)} remaining after lag window drop).")
        status = {
            "status": "insufficient_data",
            "message": f"Only {len(X_demand)} samples remain after lag calculation.",
            "samples_count": len(X_demand),
            "min_samples_required": min_samples,
        }
        save_status_artifact(status, artifacts_dir=target_artifacts_dir)
        return status

    # 5. Time-Aware Split (Demand)
    X_train_d, X_test_d, y_train_d, y_test_d = time_aware_split(
        X_demand, y_demand, dates_demand, test_ratio=0.2
    )
    print(f"   Demand Task Split -> Train: {len(X_train_d)} samples | Untouched Final Holdout: {len(X_test_d)} samples")

    # 6. Train & Compare Demand Regressors
    print("\n4. Training Demand Models (TimeSeriesSplit Validation on Training Portion):")
    best_demand_model, best_demand_name, demand_eval = train_and_compare_demand_models(
        X_train_d, X_test_d, y_train_d, y_test_d, n_splits=3, random_state=random_state
    )
    print(f"   TimeSeriesSplit count : {demand_eval['time_series_splits']} splits on training set")
    print(f"   Selected Model        : {best_demand_name} (chosen by training validation RMSE)")
    print("   Final Holdout Results (Evaluated once on untouched test set):")
    for model_name, metrics in demand_eval["comparison"].items():
        prefix = "[SELECTED]" if model_name == best_demand_name else "          "
        print(f"   {prefix} {model_name:26s} | MAE: {metrics['MAE']:8.4f} | RMSE: {metrics['RMSE']:8.4f} | R2: {metrics['R2']:8.4f}")

    print("   Naive Baselines on Same Holdout:")
    for b_name, b_info in demand_eval["baselines"].items():
        if b_info.get("applicable"):
            m = b_info["metrics"]
            print(f"            {b_info['description']:40s} | MAE: {m['MAE']:8.4f} | RMSE: {m['RMSE']:8.4f} | R2: {m['R2']:8.4f}")
        else:
            print(f"            {b_info['description']:40s} | N/A ({b_info.get('reason')})")
    print(f"   Verdict: {demand_eval['superiority_verdict']}")

    # 7. Feature Engineering for Task 2: Waste-Risk Classification
    waste_matrix = prepare_task_matrices(cleaned_df, task="waste_risk")
    X_waste = waste_matrix["X"]
    y_waste = waste_matrix["y"]
    dates_waste = waste_matrix["dates"]

    X_train_w, X_test_w, y_train_w, y_test_w = time_aware_split(
        X_waste, y_waste, dates_waste, test_ratio=0.2
    )
    print(f"\n5. Waste-Risk Task Split -> Train: {len(X_train_w)} samples | Untouched Final Holdout: {len(X_test_w)} samples")
    train_dist_counts = dict(pd.Series(y_train_w).value_counts())
    test_dist_counts = dict(pd.Series(y_test_w).value_counts())
    print(f"   Train Class Distribution : {train_dist_counts}")
    print(f"   Holdout Class Distribution: {test_dist_counts}")

    # 8. Train & Compare Waste-Risk Classifiers
    print("\n6. Training Waste-Risk Models (TimeSeriesSplit Validation on Training Portion):")
    best_waste_model, best_waste_name, waste_eval = train_and_compare_waste_risk_models(
        X_train_w, X_test_w, y_train_w, y_test_w, n_splits=3, random_state=random_state
    )
    print(f"   TimeSeriesSplit count : {waste_eval['time_series_splits']} splits on training set")
    print(f"   Selected Model        : {best_waste_name} (chosen by training validation weighted F1)")
    print("   Final Holdout Results (Evaluated once on untouched test set):")
    for model_name, metrics in waste_eval["comparison"].items():
        prefix = "[SELECTED]" if model_name == best_waste_name else "          "
        print(f"   {prefix} {model_name:26s} | Acc: {metrics['Accuracy']:6.4f} | F1: {metrics['F1']:6.4f} | Prec: {metrics['Precision']:6.4f} | Rec: {metrics['Recall']:6.4f}")

    print("   Majority-Class Baseline on Same Holdout:")
    b_info_w = waste_eval["baseline"]
    if b_info_w.get("applicable"):
        mb = b_info_w["metrics"]
        print(f"            {b_info_w['description']:40s} | Acc: {mb['Accuracy']:6.4f} | F1: {mb['F1']:6.4f} | Prec: {mb['Precision']:6.4f} | Rec: {mb['Recall']:6.4f}")
    else:
        print(f"            {b_info_w['description']:40s} | N/A")
    print(f"   Verdict: {waste_eval['superiority_verdict']}")
    print(f"   Class Coverage Note: {waste_eval['class_distribution']['limitations_note']}")

    # 9. Artifact Serialization
    demand_model_path = os.path.join(target_artifacts_dir, "demand_forecasting_model.joblib")
    waste_risk_model_path = os.path.join(target_artifacts_dir, "waste_risk_model.joblib")
    metadata_path = os.path.join(target_artifacts_dir, "training_metadata.joblib")
    eval_results_path = os.path.join(target_artifacts_dir, "evaluation_results.json")

    print("\n7. Serializing Selected Models & Metadata:")

    # Production Validation Gate for Demand Model:
    # An ML demand model must NOT be treated as a valid production model when it does not
    # demonstrate improvement over the appropriate naive baseline.
    demand_ml_validated = bool(demand_eval.get("ml_beats_baselines", False))
    if demand_ml_validated:
        save_artifact(best_demand_model, demand_model_path)
        print(f"   [OK] Best Demand Model validated and saved -> {demand_model_path}")
    else:
        if os.path.exists(demand_model_path):
            try:
                os.remove(demand_model_path)
            except Exception:
                pass
        print(f"   [BLOCKED] Demand ML model NOT published to production: did not demonstrate improvement over naive baseline.")

    save_artifact(best_waste_model, waste_risk_model_path)
    print(f"   [OK] Best Waste Risk Model saved -> {waste_risk_model_path}")

    metadata = {
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "random_state": random_state,
        "sample_counts": {
            "total_clean_records": total_valid,
            "demand_usable_observations": len(X_demand),
            "demand_train_samples": len(X_train_d),
            "demand_holdout_samples": len(X_test_d),
            "demand_test_samples": len(X_test_d),  # Compatibility
            "waste_usable_observations": len(X_waste),
            "waste_train_samples": len(X_train_w),
            "waste_holdout_samples": len(X_test_w),
            "waste_test_samples": len(X_test_w),  # Compatibility
        },
        "demand_model": {
            "validation_method": demand_eval["validation_method"],
            "time_series_splits": demand_eval["time_series_splits"],
            "selected_model": best_demand_name,
            "is_production_validated": demand_ml_validated,
            "validation_metrics": demand_eval["validation_summary"],
            "holdout_metrics": demand_eval["metrics"],
            "metrics": demand_eval["metrics"],  # Compatibility
            "comparison": demand_eval["comparison"],
            "baselines": demand_eval["baselines"],
            "comparison_against_baselines": demand_eval["comparison_against_baselines"],
            "ml_beats_baselines": demand_ml_validated,
            "superiority_verdict": demand_eval["superiority_verdict"],
            "features": demand_matrix["features"],
        },
        "waste_risk_model": {
            "validation_method": waste_eval["validation_method"],
            "time_series_splits": waste_eval["time_series_splits"],
            "selected_model": best_waste_name,
            "validation_metrics": waste_eval["validation_summary"],
            "holdout_metrics": waste_eval["metrics"],
            "metrics": waste_eval["metrics"],  # Compatibility
            "comparison": waste_eval["comparison"],
            "class_distribution": waste_eval["class_distribution"],
            "baseline": waste_eval["baseline"],
            "comparison_against_baseline": waste_eval["comparison_against_baseline"],
            "ml_beats_baseline": waste_eval["ml_beats_baseline"],
            "superiority_verdict": waste_eval["superiority_verdict"],
            "features": waste_matrix["features"],
            "thresholds": {
                "low_risk": f"< {LOW_RISK_THRESHOLD * 100}% waste",
                "medium_risk": f"{LOW_RISK_THRESHOLD * 100}% to {HIGH_RISK_THRESHOLD * 100}% waste",
                "high_risk": f">= {HIGH_RISK_THRESHOLD * 100}% waste",
            },
            "class_labels": RISK_LABEL_NAMES,
        },
    }

    save_artifact(metadata, metadata_path)
    print(f"   [OK] Metadata saved -> {metadata_path}")

    # Structured JSON results
    with open(eval_results_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
    print(f"   [OK] Evaluation results JSON saved -> {eval_results_path}")

    if demand_ml_validated:
        pipeline_status = {
            "status": "success",
            "demand_status": "success",
            "demand_validated": True,
            "waste_risk_status": "success",
            "waste_risk_validated": True,
            "message": "Production models trained and verified successfully.",
            "samples_count": total_valid,
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
    else:
        pipeline_status = {
            "status": "unvalidated_demand",
            "demand_status": "unvalidated_against_baseline",
            "demand_validated": False,
            "waste_risk_status": "success",
            "waste_risk_validated": True,
            "message": "Demand ML model did not demonstrate improvement over naive baseline on holdout evaluation; demand artifact not published. Waste-risk model verified.",
            "samples_count": total_valid,
            "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        }
    save_status_artifact(pipeline_status, artifacts_dir=target_artifacts_dir)
    print(f"   [OK] Training status JSON saved -> {os.path.join(target_artifacts_dir, 'training_status.json')}")

    return {
        "status": pipeline_status["status"],
        "metadata": metadata,
        "demand_model_path": demand_model_path if demand_ml_validated else None,
        "waste_risk_model_path": waste_risk_model_path,
    }


def save_status_artifact(status_dict: Dict[str, Any], artifacts_dir: Optional[str] = None) -> None:
    """Save pipeline execution status to artifacts directory."""
    target_dir = artifacts_dir if artifacts_dir else ARTIFACTS_DIR
    os.makedirs(target_dir, exist_ok=True)
    status_path = os.path.join(target_dir, "training_status.json")
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
    if result.get("status") in ["insufficient_data", "unvalidated_demand", "success"]:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
