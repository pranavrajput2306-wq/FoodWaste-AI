"""
Model Training & Comparison Module
===================================
Implements reproducible model training, chronological holdout splitting,
TimeSeriesSplit validation on training portion for model selection,
and final single-pass evaluation on untouched holdout.

Supported tasks:
  1. Demand Forecasting (Regression: LinearRegression, RandomForestRegressor, GradientBoostingRegressor)
  2. Waste-Risk Classification (Classification: LogisticRegression, RandomForestClassifier, GradientBoostingClassifier)
"""

from typing import Dict, Any, Tuple, Optional, List
import os
import sys
import copy
import joblib
import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from sklearn.ensemble import (
    RandomForestRegressor,
    GradientBoostingRegressor,
    RandomForestClassifier,
    GradientBoostingClassifier,
)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.model_selection import TimeSeriesSplit

from ml.src.evaluation.model_evaluator import (
    evaluate_regression,
    select_best_regression_model,
    evaluate_classification,
    select_best_classification_model,
    evaluate_demand_baselines,
    evaluate_waste_risk_baseline,
    compare_demand_against_baselines,
    compare_waste_risk_against_baseline,
    RISK_LABELS,
)

# ---------------------------------------------------------------------------
# Path resolution (no machine-specific hardcoded paths)
# ---------------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
os.makedirs(ARTIFACTS_DIR, exist_ok=True)

DEMAND_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "demand_forecasting_model.joblib")
WASTE_RISK_MODEL_PATH = os.path.join(ARTIFACTS_DIR, "waste_risk_model.joblib")
METADATA_PATH = os.path.join(ARTIFACTS_DIR, "training_metadata.joblib")
EVAL_RESULTS_PATH = os.path.join(ARTIFACTS_DIR, "evaluation_results.json")


# ---------------------------------------------------------------------------
# Model Factories
# ---------------------------------------------------------------------------

def get_demand_regressors(random_state: int = 42) -> Dict[str, Any]:
    """
    Returns candidate models for Demand Forecasting regression.
    """
    return {
        "LinearRegression": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LinearRegression()),
        ]),
        "RandomForestRegressor": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=random_state,
            )),
        ]),
        "GradientBoostingRegressor": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", GradientBoostingRegressor(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=4,
                random_state=random_state,
            )),
        ]),
    }


def get_waste_risk_classifiers(random_state: int = 42) -> Dict[str, Any]:
    """
    Returns candidate models for Waste-Risk multi-class classification.
    """
    return {
        "LogisticRegression": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LogisticRegression(
                max_iter=1000,
                random_state=random_state,
            )),
        ]),
        "RandomForestClassifier": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                class_weight="balanced",
                random_state=random_state,
            )),
        ]),
        "GradientBoostingClassifier": Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("model", GradientBoostingClassifier(
                n_estimators=100,
                learning_rate=0.1,
                max_depth=4,
                random_state=random_state,
            )),
        ]),
    }


# ---------------------------------------------------------------------------
# Time-Aware Train / Test Split
# ---------------------------------------------------------------------------

def time_aware_split(
    X: pd.DataFrame,
    y: pd.Series,
    dates: pd.Series,
    test_ratio: float = 0.2,
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.Series, pd.Series]:
    """
    Splits data chronologically to prevent temporal data leakage.
    Earliest records go to Train (80%), latest records to untouched final holdout (20%).
    Preserves strict chronological ordering.
    """
    order = dates.argsort().values
    X_sorted = X.iloc[order].reset_index(drop=True)
    y_sorted = y.iloc[order].reset_index(drop=True)

    n_samples = len(X_sorted)
    split_idx = int(n_samples * (1 - test_ratio))

    if split_idx == 0 or split_idx >= n_samples:
        raise ValueError(f"Insufficient samples ({n_samples}) for time-aware split with ratio {test_ratio}.")

    X_train, X_test = X_sorted.iloc[:split_idx], X_sorted.iloc[split_idx:]
    y_train, y_test = y_sorted.iloc[:split_idx], y_sorted.iloc[split_idx:]

    return X_train, X_test, y_train, y_test


# ---------------------------------------------------------------------------
# TimeSeriesSplit Validation (Training Portion Only)
# ---------------------------------------------------------------------------

def cross_validate_demand_candidates(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_splits: int = 3,
    random_state: int = 42,
) -> Tuple[str, Dict[str, Any], int]:
    """
    Performs TimeSeriesSplit cross-validation on the training portion ONLY.
    The final holdout is never seen or used during this process.
    Returns (selected_model_name, validation_results, actual_splits_used).
    """
    n_samples = len(X_train)
    # Determine maximum viable splits (must have at least n_splits + 1 samples)
    viable_splits = min(n_splits, n_samples - 1)
    if viable_splits < 2:
        raise ValueError(f"Insufficient training observations ({n_samples}) for TimeSeriesSplit validation.")

    tscv = TimeSeriesSplit(n_splits=viable_splits)
    candidates = get_demand_regressors(random_state=random_state)
    val_results = {name: {"mae_scores": [], "rmse_scores": [], "r2_scores": []} for name in candidates}

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]

        for name in candidates:
            # Recreate fresh pipeline instance per fold
            fold_model = get_demand_regressors(random_state=random_state)[name]
            fold_model.fit(X_tr, y_tr)
            preds = fold_model.predict(X_val)
            fold_metrics = evaluate_regression(y_val, preds)
            val_results[name]["mae_scores"].append(fold_metrics["MAE"])
            val_results[name]["rmse_scores"].append(fold_metrics["RMSE"])
            val_results[name]["r2_scores"].append(fold_metrics["R2"])

    # Aggregate validation performance across folds
    summary = {}
    for name, scores in val_results.items():
        summary[name] = {
            "metrics": {
                "MAE": round(float(np.mean(scores["mae_scores"])), 4),
                "RMSE": round(float(np.mean(scores["rmse_scores"])), 4),
                "R2": round(float(np.mean(scores["r2_scores"])), 4),
            },
            "fold_rmse": scores["rmse_scores"],
        }

    # Model selection based strictly on validation RMSE
    best_name, _ = select_best_regression_model(summary)
    return best_name, summary, viable_splits


def cross_validate_waste_risk_candidates(
    X_train: pd.DataFrame,
    y_train: pd.Series,
    n_splits: int = 3,
    random_state: int = 42,
) -> Tuple[str, Dict[str, Any], int]:
    """
    Performs TimeSeriesSplit cross-validation on the training portion ONLY for classification.
    The final holdout is never seen or used during this process.
    Returns (selected_model_name, validation_results, actual_splits_used).
    """
    n_samples = len(X_train)
    viable_splits = min(n_splits, n_samples - 1)
    if viable_splits < 2:
        raise ValueError(f"Insufficient training observations ({n_samples}) for TimeSeriesSplit validation.")

    tscv = TimeSeriesSplit(n_splits=viable_splits)
    candidates = get_waste_risk_classifiers(random_state=random_state)
    val_results = {
        name: {"f1_scores": [], "acc_scores": [], "prec_scores": [], "rec_scores": []}
        for name in candidates
    }

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X_train)):
        X_tr, X_val = X_train.iloc[train_idx], X_train.iloc[val_idx]
        y_tr, y_val = y_train.iloc[train_idx], y_train.iloc[val_idx]

        unique_classes = np.unique(y_tr)
        single_class = len(unique_classes) < 2

        for name in candidates:
            if single_class:
                preds = np.full(len(X_val), unique_classes[0])
            else:
                fold_model = get_waste_risk_classifiers(random_state=random_state)[name]
                fold_model.fit(X_tr, y_tr)
                preds = fold_model.predict(X_val)

            fold_metrics = evaluate_classification(y_val, preds)
            val_results[name]["f1_scores"].append(fold_metrics["F1"])
            val_results[name]["acc_scores"].append(fold_metrics["Accuracy"])
            val_results[name]["prec_scores"].append(fold_metrics["Precision"])
            val_results[name]["rec_scores"].append(fold_metrics["Recall"])

    # Aggregate validation performance across folds
    summary = {}
    for name, scores in val_results.items():
        summary[name] = {
            "metrics": {
                "F1": round(float(np.mean(scores["f1_scores"])), 4),
                "Accuracy": round(float(np.mean(scores["acc_scores"])), 4),
                "Precision": round(float(np.mean(scores["prec_scores"])), 4),
                "Recall": round(float(np.mean(scores["rec_scores"])), 4),
            },
            "fold_f1": scores["f1_scores"],
        }

    # Model selection based strictly on validation weighted F1
    best_name, _ = select_best_classification_model(summary)
    return best_name, summary, viable_splits


# ---------------------------------------------------------------------------
# Training, Selection & Single-Pass Holdout Evaluation Routines
# ---------------------------------------------------------------------------

def train_and_compare_demand_models(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    n_splits: int = 3,
    random_state: int = 42,
) -> Tuple[Any, str, Dict[str, Any]]:
    """
    1. Evaluates candidates using TimeSeriesSplit on X_train/y_train only.
    2. Selects best model based on validation RMSE.
    3. Fits selected model on entire X_train/y_train.
    4. Evaluates selected model once on untouched final holdout X_test/y_test.
    5. Computes naive baselines on the same holdout and checks if ML beats baselines.
    """
    # Step 1 & 2: TimeSeriesSplit Model Selection on Training Portion
    best_name, val_summary, actual_splits = cross_validate_demand_candidates(
        X_train=X_train,
        y_train=y_train,
        n_splits=n_splits,
        random_state=random_state,
    )

    # Step 3: Refit candidate models on complete X_train
    candidates = get_demand_regressors(random_state=random_state)
    holdout_comparison = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        holdout_comparison[name] = evaluate_regression(y_test, preds)

    # Selected model fitted instance
    best_model = candidates[best_name]
    best_holdout_metrics = holdout_comparison[best_name]

    # Step 4: Evaluate naive baselines on holdout
    baselines = evaluate_demand_baselines(X_test=X_test, y_test=y_test, y_train=y_train)
    comparison_vs_baselines = compare_demand_against_baselines(
        ml_metrics=best_holdout_metrics,
        baselines=baselines,
    )

    summary = {
        "validation_method": f"TimeSeriesSplit (n_splits={actual_splits}) on training set only",
        "time_series_splits": actual_splits,
        "selected_model": best_name,
        "best_model": best_name,  # Backward compatibility
        "validation_summary": {name: r["metrics"] for name, r in val_summary.items()},
        "metrics": best_holdout_metrics,
        "best_metrics": best_holdout_metrics,  # Backward compatibility
        "comparison": holdout_comparison,
        "baselines": baselines,
        "comparison_against_baselines": comparison_vs_baselines,
        "ml_beats_baselines": bool(comparison_vs_baselines.get("ml_beats_baselines", False)),
        "superiority_verdict": comparison_vs_baselines["superiority_verdict"],
    }

    return best_model, best_name, summary


def train_and_compare_waste_risk_models(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    n_splits: int = 3,
    random_state: int = 42,
) -> Tuple[Any, str, Dict[str, Any]]:
    """
    1. Evaluates candidates using TimeSeriesSplit on X_train/y_train only.
    2. Selects best model based on validation weighted F1.
    3. Fits selected model on entire X_train/y_train.
    4. Evaluates selected model once on untouched final holdout X_test/y_test.
    5. Checks class distribution across train and holdout, reporting limitations if any class is absent.
    6. Computes majority-class baseline and verifies whether ML beats it.
    """
    # Step 1 & 2: TimeSeriesSplit Model Selection on Training Portion
    best_name, val_summary, actual_splits = cross_validate_waste_risk_candidates(
        X_train=X_train,
        y_train=y_train,
        n_splits=n_splits,
        random_state=random_state,
    )

    # Step 3: Refit candidate models on complete X_train
    candidates = get_waste_risk_classifiers(random_state=random_state)
    holdout_comparison = {}
    for name, model in candidates.items():
        model.fit(X_train, y_train)
        preds = model.predict(X_test)
        holdout_comparison[name] = evaluate_classification(y_test, preds)

    best_model = candidates[best_name]
    best_holdout_metrics = holdout_comparison[best_name]

    # Step 4: Class distribution analysis
    train_dist = {int(k): int(v) for k, v in pd.Series(y_train).value_counts().items()}
    holdout_dist = {int(k): int(v) for k, v in pd.Series(y_test).value_counts().items()}

    all_expected_classes = [0, 1, 2]
    present_in_holdout = [c for c in all_expected_classes if c in holdout_dist and holdout_dist[c] > 0]
    absent_in_holdout = [c for c in all_expected_classes if c not in holdout_dist or holdout_dist[c] == 0]

    all_three_classes_present = len(absent_in_holdout) == 0

    if not all_three_classes_present:
        class_limitations = (
            f"Holdout contains only classes {present_in_holdout}. "
            f"Classes {absent_in_holdout} are absent; three-class performance is limited/incomplete."
        )
    else:
        class_limitations = "All three classes (Low, Medium, High) present in holdout."

    # Step 5: Majority-class baseline evaluation on holdout
    baseline_info = evaluate_waste_risk_baseline(y_test=y_test, y_train=y_train)
    comparison_vs_baseline = compare_waste_risk_against_baseline(
        ml_metrics=best_holdout_metrics,
        baseline_info=baseline_info,
    )

    summary = {
        "validation_method": f"TimeSeriesSplit (n_splits={actual_splits}) on training set only",
        "time_series_splits": actual_splits,
        "selected_model": best_name,
        "best_model": best_name,  # Backward compatibility
        "validation_summary": {name: r["metrics"] for name, r in val_summary.items()},
        "metrics": best_holdout_metrics,
        "best_metrics": best_holdout_metrics,  # Backward compatibility
        "comparison": holdout_comparison,
        "class_distribution": {
            "training": train_dist,
            "holdout": holdout_dist,
            "present_classes_in_holdout": [RISK_LABELS.get(c, str(c)) for c in present_in_holdout],
            "absent_classes_in_holdout": [RISK_LABELS.get(c, str(c)) for c in absent_in_holdout],
            "all_three_classes_present": all_three_classes_present,
            "limitations_note": class_limitations,
        },
        "baseline": baseline_info,
        "comparison_against_baseline": comparison_vs_baseline,
        "ml_beats_baseline": comparison_vs_baseline.get("ml_beats_baseline", False),
        "superiority_verdict": comparison_vs_baseline.get("superiority_verdict", "Unknown"),
    }

    return best_model, best_name, summary


# ---------------------------------------------------------------------------
# Artifact Serialization & Deserialization
# ---------------------------------------------------------------------------

def save_artifact(obj: Any, filepath: str) -> str:
    """Save model or metadata with Joblib."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    joblib.dump(obj, filepath)
    return filepath


def load_artifact(filepath: str) -> Any:
    """Load model or metadata from Joblib file."""
    if not os.path.exists(filepath):
        raise FileNotFoundError(f"Artifact not found at {filepath}")
    return joblib.load(filepath)
