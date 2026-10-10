"""
Model Evaluation Module
=======================
Computes measurable, standardized evaluation metrics and naive baselines for both ML tasks.
Provides selection criteria and baseline comparisons.

Task 1 — Demand Forecasting (Regression)
  Metrics: MAE, RMSE, R²
  Baselines:
    - Lag-1 (previous calendar day demand)
    - Lag-7 (previous 7th calendar day demand)
    - Historical / Rolling Mean (mean of available historical observations)

Task 2 — Waste-Risk Classification (Multi-class)
  Metrics: Accuracy, Precision (weighted), Recall (weighted), F1 (weighted), Confusion Matrix.
  Baseline:
    - Majority-class classifier derived strictly from training data.
"""

from typing import Dict, Any, Tuple, Optional, List, Union
import numpy as np
import pandas as pd
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

RISK_LABELS = {0: "Low", 1: "Medium", 2: "High"}


# ---------------------------------------------------------------------------
# Regression Metrics (Demand Forecasting)
# ---------------------------------------------------------------------------

def evaluate_regression(y_true, y_pred) -> Dict[str, float]:
    """
    Compute regression metrics: MAE, RMSE, R².
    """
    y_true = np.asarray(y_true, dtype=float)
    y_pred = np.asarray(y_pred, dtype=float)

    # Filter out any non-finite pairs if present
    valid_mask = np.isfinite(y_true) & np.isfinite(y_pred)
    if not np.any(valid_mask):
        return {"MAE": float("nan"), "RMSE": float("nan"), "R2": float("nan")}

    y_t = y_true[valid_mask]
    y_p = y_pred[valid_mask]

    mae = float(mean_absolute_error(y_t, y_p))
    try:
        from sklearn.metrics import root_mean_squared_error
        rmse = float(root_mean_squared_error(y_t, y_p))
    except ImportError:
        rmse = float(np.sqrt(mean_squared_error(y_t, y_p)))

    # If single value or zero variance, r2_score can return nan
    try:
        r2 = float(r2_score(y_t, y_p))
    except Exception:
        r2 = float("nan")

    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "R2": round(r2, 4) if not np.isnan(r2) else 0.0,
    }


def select_best_regression_model(
    results: Dict[str, Dict[str, Any]]
) -> Tuple[str, Dict[str, Any]]:
    """
    Select the best regression model based on minimum validation RMSE.
    """
    if not results:
        raise ValueError("Cannot select from empty model results.")

    best_name = min(results.keys(), key=lambda name: results[name]["metrics"]["RMSE"])
    return best_name, results[best_name]


# ---------------------------------------------------------------------------
# Classification Metrics (Waste-Risk)
# ---------------------------------------------------------------------------

def evaluate_classification(y_true, y_pred) -> Dict[str, Any]:
    """
    Compute classification metrics: Accuracy, Precision, Recall, F1, Confusion Matrix.
    Uses weighted averages to account for class imbalance in operational food waste.
    """
    y_true = np.asarray(y_true, dtype=int)
    y_pred = np.asarray(y_pred, dtype=int)

    acc  = float(accuracy_score(y_true, y_pred))
    prec = float(precision_score(y_true, y_pred, average="weighted", zero_division=0))
    rec  = float(recall_score(y_true, y_pred, average="weighted", zero_division=0))
    f1   = float(f1_score(y_true, y_pred, average="weighted", zero_division=0))
    cm   = confusion_matrix(y_true, y_pred).tolist()

    unique_classes = sorted(list(set(y_true) | set(y_pred)))
    target_names = [RISK_LABELS.get(c, str(c)) for c in unique_classes]

    report = classification_report(
        y_true, y_pred,
        labels=unique_classes,
        target_names=target_names,
        zero_division=0,
        output_dict=True,
    )

    return {
        "Accuracy": round(acc, 4),
        "Precision": round(prec, 4),
        "Recall": round(rec, 4),
        "F1": round(f1, 4),
        "confusion_matrix": cm,
        "classification_report": report,
    }


def select_best_classification_model(
    results: Dict[str, Dict[str, Any]]
) -> Tuple[str, Dict[str, Any]]:
    """
    Select the best classification model based on highest validation weighted F1 score.
    """
    if not results:
        raise ValueError("Cannot select from empty model results.")

    best_name = max(results.keys(), key=lambda name: results[name]["metrics"]["F1"])
    return best_name, results[best_name]


# ---------------------------------------------------------------------------
# Naive Baselines (Demand Forecasting)
# ---------------------------------------------------------------------------

def evaluate_demand_baselines(
    X_test: pd.DataFrame,
    y_test: pd.Series,
    y_train: pd.Series,
) -> Dict[str, Dict[str, Any]]:
    """
    Evaluates naive demand baselines on the holdout set:
      1. lag_1: previous-day demand (using feature 'sold_lag_1' if available)
      2. lag_7: previous-7-day demand (using feature 'sold_lag_7' if available)
      3. historical_mean: overall historical mean of training set y_train
      4. rolling_mean_7: historical 7-day rolling mean feature if available

    Baselines never observe final-holdout target values.
    Returns metrics dict with status flag for valid/applicable baselines.
    """
    baselines: Dict[str, Dict[str, Any]] = {}
    y_test_arr = y_test.values

    # Baseline 1: Lag-1 Demand (previous calendar day)
    if "sold_lag_1" in X_test.columns:
        lag1_preds = X_test["sold_lag_1"].values
        valid_idx = np.isfinite(lag1_preds)
        if np.sum(valid_idx) > 0:
            metrics = evaluate_regression(y_test_arr[valid_idx], lag1_preds[valid_idx])
            baselines["lag_1"] = {
                "description": "Previous-day demand (calendar lag-1)",
                "applicable": True,
                "valid_samples": int(np.sum(valid_idx)),
                "total_samples": len(y_test),
                "metrics": metrics,
            }
        else:
            baselines["lag_1"] = {
                "description": "Previous-day demand (calendar lag-1)",
                "applicable": False,
                "reason": "All lag-1 values in holdout are NaN due to calendar gaps.",
                "metrics": None,
            }
    else:
        baselines["lag_1"] = {
            "description": "Previous-day demand (calendar lag-1)",
            "applicable": False,
            "reason": "'sold_lag_1' feature column not present in matrix.",
            "metrics": None,
        }

    # Baseline 2: Lag-7 Demand (previous 7-day demand)
    if "sold_lag_7" in X_test.columns:
        lag7_preds = X_test["sold_lag_7"].values
        valid_idx = np.isfinite(lag7_preds)
        if np.sum(valid_idx) > 0:
            metrics = evaluate_regression(y_test_arr[valid_idx], lag7_preds[valid_idx])
            baselines["lag_7"] = {
                "description": "Previous-7-day demand (calendar lag-7)",
                "applicable": True,
                "valid_samples": int(np.sum(valid_idx)),
                "total_samples": len(y_test),
                "metrics": metrics,
            }
        else:
            baselines["lag_7"] = {
                "description": "Previous-7-day demand (calendar lag-7)",
                "applicable": False,
                "reason": "All lag-7 values in holdout are NaN due to calendar gaps.",
                "metrics": None,
            }
    else:
        baselines["lag_7"] = {
            "description": "Previous-7-day demand (calendar lag-7)",
            "applicable": False,
            "reason": "'sold_lag_7' feature column not present in matrix.",
            "metrics": None,
        }

    # Baseline 3: Historical Training Mean
    if len(y_train) > 0 and np.any(np.isfinite(y_train.values)):
        train_mean = float(np.nanmean(y_train.values))
        mean_preds = np.full(shape=len(y_test), fill_value=train_mean)
        metrics = evaluate_regression(y_test_arr, mean_preds)
        baselines["historical_mean"] = {
            "description": f"Historical training set mean ({train_mean:.2f})",
            "applicable": True,
            "valid_samples": len(y_test),
            "total_samples": len(y_test),
            "metrics": metrics,
        }
    else:
        baselines["historical_mean"] = {
            "description": "Historical training set mean",
            "applicable": False,
            "reason": "Training set target values are empty or non-finite.",
            "metrics": None,
        }

    # Baseline 4: Rolling 7-day Mean (Historical, strictly shift-1)
    if "sold_rolling_mean_7" in X_test.columns:
        roll7_preds = X_test["sold_rolling_mean_7"].values
        valid_idx = np.isfinite(roll7_preds)
        if np.sum(valid_idx) > 0:
            metrics = evaluate_regression(y_test_arr[valid_idx], roll7_preds[valid_idx])
            baselines["rolling_mean_7"] = {
                "description": "Historical 7-day rolling mean (shift-1 prior days)",
                "applicable": True,
                "valid_samples": int(np.sum(valid_idx)),
                "total_samples": len(y_test),
                "metrics": metrics,
            }
        else:
            baselines["rolling_mean_7"] = {
                "description": "Historical 7-day rolling mean",
                "applicable": False,
                "reason": "All rolling-mean-7 values in holdout are NaN.",
                "metrics": None,
            }

    return baselines


# ---------------------------------------------------------------------------
# Naive Baseline (Waste-Risk Classification)
# ---------------------------------------------------------------------------

def evaluate_waste_risk_baseline(
    y_test: pd.Series,
    y_train: pd.Series,
) -> Dict[str, Any]:
    """
    Evaluates majority-class classifier derived strictly from training labels y_train.
    Never uses final-holdout target information.
    """
    if len(y_train) == 0:
        return {
            "description": "Majority class baseline",
            "applicable": False,
            "reason": "Training labels are empty.",
            "metrics": None,
        }

    # Compute mode from training set only
    val_counts = pd.Series(y_train).value_counts()
    if len(val_counts) == 0:
        return {
            "description": "Majority class baseline",
            "applicable": False,
            "reason": "No valid training class labels.",
            "metrics": None,
        }

    majority_class = int(val_counts.index[0])
    majority_label = RISK_LABELS.get(majority_class, str(majority_class))

    y_test_arr = y_test.values
    preds = np.full(shape=len(y_test_arr), fill_value=majority_class, dtype=int)

    metrics = evaluate_classification(y_test_arr, preds)

    return {
        "description": f"Majority class from training portion: class {majority_class} ({majority_label})",
        "applicable": True,
        "majority_class": majority_class,
        "majority_label": majority_label,
        "metrics": metrics,
    }


# ---------------------------------------------------------------------------
# Comparison Helpers
# ---------------------------------------------------------------------------

def compare_demand_against_baselines(
    ml_metrics: Dict[str, float],
    baselines: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Checks whether the ML model strictly beats valid baselines on RMSE and MAE.
    Does NOT claim ML is superior if it does not beat the baseline.
    """
    comparison: Dict[str, Any] = {}
    ml_rmse = ml_metrics.get("RMSE", float("inf"))
    ml_mae = ml_metrics.get("MAE", float("inf"))

    beats_all_applicable = True
    applicable_count = 0

    for base_key, b_info in baselines.items():
        if not b_info.get("applicable") or b_info.get("metrics") is None:
            comparison[base_key] = {
                "applicable": False,
                "reason": b_info.get("reason", "Not applicable"),
            }
            continue

        applicable_count += 1
        b_metrics = b_info["metrics"]
        b_rmse = b_metrics.get("RMSE", float("inf"))
        b_mae = b_metrics.get("MAE", float("inf"))

        # ML beats baseline if lower error
        beats_rmse = ml_rmse < b_rmse
        beats_mae = ml_mae < b_mae
        beats = beats_rmse and beats_mae

        if not beats:
            beats_all_applicable = False

        comparison[base_key] = {
            "applicable": True,
            "baseline_metrics": b_metrics,
            "ml_metrics": ml_metrics,
            "beats_rmse": beats_rmse,
            "beats_mae": beats_mae,
            "ml_beats_baseline": beats,
            "rmse_improvement": round(b_rmse - ml_rmse, 4),
            "mae_improvement": round(b_mae - ml_mae, 4),
        }

    overall_beat = beats_all_applicable if applicable_count > 0 else False
    return {
        "comparisons": comparison,
        "applicable_baselines_count": applicable_count,
        "ml_beats_all_applicable_baselines": overall_beat,
        "superiority_verdict": "ML beats applicable baselines" if overall_beat else "ML DOES NOT beat all applicable baselines (or baselines unavailable)",
    }


def compare_waste_risk_against_baseline(
    ml_metrics: Dict[str, Any],
    baseline_info: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Checks whether the ML model strictly beats the majority-class baseline on weighted F1 and Accuracy.
    Does NOT claim ML is superior if it does not beat the baseline.
    """
    if not baseline_info.get("applicable") or baseline_info.get("metrics") is None:
        return {
            "applicable": False,
            "ml_beats_baseline": False,
            "superiority_verdict": "Baseline not applicable",
        }

    b_metrics = baseline_info["metrics"]
    ml_f1 = ml_metrics.get("F1", 0.0)
    b_f1 = b_metrics.get("F1", 0.0)
    ml_acc = ml_metrics.get("Accuracy", 0.0)
    b_acc = b_metrics.get("Accuracy", 0.0)

    # ML beats baseline if higher weighted F1 (and accuracy not degraded)
    beats_f1 = ml_f1 > b_f1
    beats_acc = ml_acc > b_acc
    beats = beats_f1 or (ml_f1 == b_f1 and ml_acc > b_acc)

    return {
        "applicable": True,
        "baseline_f1": b_f1,
        "ml_f1": ml_f1,
        "baseline_accuracy": b_acc,
        "ml_accuracy": ml_acc,
        "ml_beats_baseline": beats,
        "f1_improvement": round(ml_f1 - b_f1, 4),
        "accuracy_improvement": round(ml_acc - b_acc, 4),
        "superiority_verdict": "ML beats majority-class baseline" if beats else "ML DOES NOT beat majority-class baseline",
    }
