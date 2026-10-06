"""
Model Training & Comparison Module
===================================
Implements reproducible model training, time-aware splitting, model comparison,
and Joblib artifact serialization for:
  1. Demand Forecasting (Regression: LinearRegression, RandomForestRegressor, GradientBoostingRegressor)
  2. Waste-Risk Classification (Classification: LogisticRegression, RandomForestClassifier, GradientBoostingClassifier)
"""

from typing import Dict, Any, Tuple, Optional
import os
import sys
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

from ml.src.evaluation.model_evaluator import (
    evaluate_regression,
    select_best_regression_model,
    evaluate_classification,
    select_best_classification_model,
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
    Earliest records go to Train, latest records to Test.
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
# Training & Comparison Routines
# ---------------------------------------------------------------------------

def train_and_compare_demand_models(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    random_state: int = 42,
) -> Tuple[Any, str, Dict[str, Any]]:
    """
    Trains and compares LinearRegression, RandomForestRegressor, and GradientBoostingRegressor.
    Returns (best_fitted_model, best_model_name, comparison_summary).
    """
    candidates = get_demand_regressors(random_state=random_state)
    results = {}

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        metrics = evaluate_regression(y_test, y_pred)
        results[name] = {
            "model": model,
            "metrics": metrics,
        }

    best_name, best_info = select_best_regression_model(results)
    best_model = best_info["model"]

    summary = {
        "best_model": best_name,
        "best_metrics": best_info["metrics"],
        "comparison": {name: r["metrics"] for name, r in results.items()},
    }

    return best_model, best_name, summary


def train_and_compare_waste_risk_models(
    X_train: pd.DataFrame,
    X_test: pd.DataFrame,
    y_train: pd.Series,
    y_test: pd.Series,
    random_state: int = 42,
) -> Tuple[Any, str, Dict[str, Any]]:
    """
    Trains and compares LogisticRegression, RandomForestClassifier, and GradientBoostingClassifier.
    Returns (best_fitted_model, best_model_name, comparison_summary).
    """
    candidates = get_waste_risk_classifiers(random_state=random_state)
    results = {}

    for name, model in candidates.items():
        model.fit(X_train, y_train)
        y_pred = model.predict(X_test)
        metrics = evaluate_classification(y_test, y_pred)
        results[name] = {
            "model": model,
            "metrics": metrics,
        }

    best_name, best_info = select_best_classification_model(results)
    best_model = best_info["model"]

    summary = {
        "best_model": best_name,
        "best_metrics": best_info["metrics"],
        "comparison": {name: r["metrics"] for name, r in results.items()},
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
