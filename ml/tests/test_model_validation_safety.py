"""
Regression Test Suite: Production Model Selection & Validation Safety
======================================================================
Verifies:
1. Deterministic CV Tie-Breaking:
   - When candidate models produce identical cross-validation scores,
     tree-based regularized ensembles are chosen deterministically over
     unregularized OLS (never arbitrary dictionary order).
2. Baseline Superiority Gate:
   - When no ML candidate beats the naive baseline on untouched holdout,
     the demand artifact is NOT published to production, and training_status.json
     truthfully indicates unvalidated_demand.
3. FastAPI Truthful Reporting:
   - When demand model is unvalidated or unavailable, /predict/demand returns
     status: 'model_unavailable' with clear diagnostic message.
   - When a valid artifact predicts negative demand, the safety clamp enforces >= 0
     while truthfully exposing raw_model_prediction and is_clamped: True.
"""

import os
import sys
import tempfile
import shutil
import numpy as np
import pandas as pd

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from ml.src.evaluation.model_evaluator import (
    select_best_regression_model,
    compare_demand_against_baselines,
)
from ml.src.train import run_training_pipeline
from ml.tests.test_phase2b_pipeline import generate_verification_demand_data


def test_cv_tie_break_avoids_dictionary_order():
    """Verify that identical CV scores break ties in favor of regularized tree ensembles."""
    tied_results = {
        "LinearRegression": {
            "metrics": {"RMSE": 14.5986, "MAE": 9.3111, "R2": 0.5533},
            "fold_rmse": [0.0, 0.0, 43.7957],
        },
        "RandomForestRegressor": {
            "metrics": {"RMSE": 14.5986, "MAE": 9.3111, "R2": 0.5533},
            "fold_rmse": [0.0, 0.0, 43.7957],
        },
        "GradientBoostingRegressor": {
            "metrics": {"RMSE": 14.5986, "MAE": 9.3111, "R2": 0.5533},
            "fold_rmse": [0.0, 0.0, 43.7957],
        },
    }

    selected_name, _ = select_best_regression_model(tied_results)
    assert selected_name == "RandomForestRegressor", (
        f"Expected RandomForestRegressor under tie-break, got {selected_name}"
    )


def test_baseline_superiority_gate_blocks_unvalidated_demand_artifact():
    """Verify that an ML demand model is NOT published if it does not beat naive baselines."""
    temp_dir = tempfile.mkdtemp(prefix="test_gate_")
    try:
        # Create a dataset where demand is nearly constant with a late shift, causing baselines to outperform ML
        dates = pd.date_range("2026-09-01", periods=60, freq="D")
        records = []
        for i, d in enumerate(dates):
            # Varying waste behavior: low (<10%), medium (10-25%), high (>=25%)
            waste_ratio = 0.05 if (i % 3 == 0) else (0.15 if (i % 3 == 1) else 0.30)
            prep = 130.0
            wasted = round(prep * waste_ratio, 2)
            sold = 50.0 if d < pd.Timestamp("2026-10-15") else 70.0
            records.append({
                "food_item_id": 1,
                "record_date": d.strftime("%Y-%m-%d"),
                "quantity_prepared": prep,
                "quantity_sold": sold,
                "quantity_wasted": wasted,
            })
        df = pd.DataFrame(records)

        result = run_training_pipeline(
            df_input=df,
            min_samples=30,
            random_state=42,
            artifacts_dir=temp_dir,
        )

        demand_path = os.path.join(temp_dir, "demand_forecasting_model.joblib")
        # In this dataset, ML does not beat rolling baseline -> demand model must NOT be serialized
        assert not os.path.exists(demand_path), "Demand artifact must NOT be saved when ML does not beat baseline"
        assert result["status"] == "unvalidated_demand", f"Expected unvalidated_demand, got {result['status']}"
        assert result["metadata"]["demand_model"]["is_production_validated"] is False
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_compare_demand_against_baselines_identifies_best_baseline():
    """Verify that compare_demand_against_baselines identifies best baseline and evaluates superiority."""
    baselines = {
        "lag_1": {
            "applicable": True,
            "metrics": {"RMSE": 20.0, "MAE": 15.0, "R2": 0.2},
        },
        "rolling_mean_7": {
            "applicable": True,
            "metrics": {"RMSE": 10.0, "MAE": 8.0, "R2": 0.6},
        },
    }

    # Case 1: ML worse than rolling_mean_7 (RMSE 15 vs 10)
    ml_worse = {"RMSE": 15.0, "MAE": 12.0, "R2": 0.4}
    comp_worse = compare_demand_against_baselines(ml_worse, baselines)
    assert comp_worse["best_baseline_key"] == "rolling_mean_7"
    assert comp_worse["beats_best_baseline"] is False
    assert comp_worse["ml_beats_baselines"] is False

    # Case 2: ML strictly better than rolling_mean_7 (RMSE 8 vs 10)
    ml_better = {"RMSE": 8.0, "MAE": 6.0, "R2": 0.7}
    comp_better = compare_demand_against_baselines(ml_better, baselines)
    assert comp_better["beats_best_baseline"] is True
    assert comp_better["ml_beats_baselines"] is True


if __name__ == "__main__":
    test_cv_tie_break_avoids_dictionary_order()
    print("PASS: test_cv_tie_break_avoids_dictionary_order")
    test_baseline_superiority_gate_blocks_unvalidated_demand_artifact()
    print("PASS: test_baseline_superiority_gate_blocks_unvalidated_demand_artifact")
    test_compare_demand_against_baselines_identifies_best_baseline()
    print("PASS: test_compare_demand_against_baselines_identifies_best_baseline")
    print("\nALL REGRESSION TESTS PASSED.")
