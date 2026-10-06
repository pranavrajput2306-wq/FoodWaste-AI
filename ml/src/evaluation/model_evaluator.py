"""
Model Evaluation Module
=======================
Computes measurable, standardized evaluation metrics for both ML tasks.
Provides selection criteria to pick the best performing model.

Task 1 — Demand Forecasting (Regression)
  Metrics: MAE, RMSE, R²
  Selection: Minimum RMSE on time-aware test split.

Task 2 — Waste-Risk Classification (Multi-class)
  Metrics: Accuracy, Precision (weighted), Recall (weighted), F1 (weighted), Confusion Matrix.
  Selection: Maximum weighted F1 on time-aware test split.
"""

from typing import Dict, Any, Tuple, Optional
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
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

    mae = float(mean_absolute_error(y_true, y_pred))
    # root_mean_squared_error handles all scikit-learn versions cleanly
    try:
        from sklearn.metrics import root_mean_squared_error
        rmse = float(root_mean_squared_error(y_true, y_pred))
    except ImportError:
        rmse = float(np.sqrt(mean_squared_error(y_true, y_pred)))

    r2 = float(r2_score(y_true, y_pred))

    return {
        "MAE": round(mae, 4),
        "RMSE": round(rmse, 4),
        "R2": round(r2, 4),
    }


def select_best_regression_model(
    results: Dict[str, Dict[str, Any]]
) -> Tuple[str, Dict[str, Any]]:
    """
    Select the best regression model based on minimum test RMSE.
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
    y_true = np.asarray(y_true)
    y_pred = np.asarray(y_pred)

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
    Select the best classification model based on highest weighted F1 score.
    """
    if not results:
        raise ValueError("Cannot select from empty model results.")

    best_name = max(results.keys(), key=lambda name: results[name]["metrics"]["F1"])
    return best_name, results[best_name]
