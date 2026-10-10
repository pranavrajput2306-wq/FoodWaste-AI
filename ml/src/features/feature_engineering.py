"""
Feature Engineering Module
===========================
Transforms cleaned demand records into model-ready feature matrices.
Ensures strict prevention of future-data leakage and target leakage.

Two tasks are supported:

  Task 1 — Demand Forecasting (Regression)
    Target   : quantity_sold (actual units consumed/sold)
    Features : Planned quantity_prepared, calendar features, lagged sales,
               rolling sales statistics (mean, std), and lagged waste behavior.
    Leakage Prevention:
      - Current day's quantity_sold is EXCLUDED from features.
      - Rolling statistics strictly use shift(1) so they observe ONLY past days.

  Task 2 — Food Waste-Risk (Classification)
    Target   : waste_risk_label (0=Low, 1=Medium, 2=High)
               derived from actual historical waste behavior:
                 0 = Low    (< 10% waste)
                 1 = Medium (10% to 25% waste)
                 2 = High   (>= 25% waste)
    Features : Planned quantity_prepared, calendar features, lagged consumption,
               and historical rolling waste tendencies.
    Leakage Prevention:
      - Current day's quantity_wasted, waste_ratio, and sell_through_rate are
        STRICTLY EXCLUDED from features (these define the target state).
      - All waste features use strictly historical observations (shift >= 1).
"""

from typing import List, Tuple, Dict, Any, Optional
import numpy as np
import pandas as pd


# ---------------------------------------------------------------------------
# Thresholds for Waste-Risk Labelling
# ---------------------------------------------------------------------------
LOW_RISK_THRESHOLD = 0.10   # < 10% waste is Low Risk
HIGH_RISK_THRESHOLD = 0.25  # >= 25% waste is High Risk
RISK_LABEL_NAMES = {0: "Low", 1: "Medium", 2: "High"}


# ---------------------------------------------------------------------------
# Date / Calendar features
# ---------------------------------------------------------------------------

def add_date_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extract temporal calendar features from record_date.
    No future leakage: purely deterministic from the calendar date.
    """
    df = df.copy()
    dates = pd.to_datetime(df["record_date"])
    df["day_of_week"]   = dates.dt.dayofweek        # 0=Mon ... 6=Sun
    df["day_of_month"]  = dates.dt.day
    df["month"]         = dates.dt.month
    df["week_of_year"]  = dates.dt.isocalendar().week.astype(int)
    df["is_weekend"]    = (df["day_of_week"] >= 5).astype(int)
    df["quarter"]       = dates.dt.quarter
    return df


# ---------------------------------------------------------------------------
# Lag & Rolling features (Per Food Item)
# ---------------------------------------------------------------------------

def add_lag_features(
    df: pd.DataFrame,
    lags: Optional[List[int]] = None,
) -> pd.DataFrame:
    """
    Add calendar-date-aware lagged consumption features per food_item_id.
    Lag k corresponds strictly to k calendar days prior to record_date (calendar-aware).
    Missing calendar dates are NOT treated as consecutive observations and will yield NaN.
    """
    if lags is None:
        lags = [1, 3, 7]

    df = df.copy()
    if df.empty:
        return df

    # Work with datetime for exact calendar arithmetic
    df["_cal_date"] = pd.to_datetime(df["record_date"])
    df = df.sort_values(["food_item_id", "_cal_date"]).reset_index(drop=True)

    for lag in lags:
        # Build lookup table for exact calendar lagged matching:
        # A record on date D matches a historical record on date D - lag days.
        lookup_cols = ["food_item_id", "_cal_date", "quantity_sold"]
        if "quantity_prepared" in df.columns:
            lookup_cols.append("quantity_prepared")

        lookup = df[lookup_cols].drop_duplicates(subset=["food_item_id", "_cal_date"]).copy()
        lookup["_join_date"] = lookup["_cal_date"] + pd.to_timedelta(lag, unit="D")

        rename_map = {"quantity_sold": f"sold_lag_{lag}"}
        if "quantity_prepared" in df.columns:
            rename_map["quantity_prepared"] = f"prepared_lag_{lag}"

        merged_cols = ["food_item_id", "_join_date", f"sold_lag_{lag}"]
        if "quantity_prepared" in df.columns:
            merged_cols.append(f"prepared_lag_{lag}")

        lookup_renamed = lookup.rename(columns=rename_map)[merged_cols]

        df = df.merge(
            lookup_renamed,
            left_on=["food_item_id", "_cal_date"],
            right_on=["food_item_id", "_join_date"],
            how="left",
        ).drop(columns=["_join_date"])

    df = df.drop(columns=["_cal_date"])
    return df


def add_rolling_features(
    df: pd.DataFrame,
    windows: Optional[List[int]] = None,
) -> pd.DataFrame:
    """
    Add calendar-date-aware rolling mean / std of quantity_sold and waste_ratio per food_item_id.
    CRITICAL: Preserves the shift(1) rule so that the current day's value is NEVER included.
    Uses continuous daily calendar spacing (freq='D') so missing calendar dates are not
    treated as consecutive observations.
    """
    if windows is None:
        windows = [3, 7]

    df = df.copy()
    if df.empty:
        return df

    df["_cal_date"] = pd.to_datetime(df["record_date"])
    df = df.sort_values(["food_item_id", "_cal_date"]).reset_index(drop=True)

    processed_groups = []
    for item_id, group in df.groupby("food_item_id", sort=False):
        min_date = group["_cal_date"].min()
        max_date = group["_cal_date"].max()

        full_idx = pd.date_range(min_date, max_date, freq="D")
        unique_g = group.drop_duplicates(subset=["_cal_date"]).set_index("_cal_date")

        value_cols = ["quantity_sold"]
        if "waste_ratio" in unique_g.columns:
            value_cols.append("waste_ratio")

        daily = unique_g[value_cols].reindex(full_idx)

        rolling_cols = {}
        for window in windows:
            # Shift(1) guarantees strictly historical calendar days are aggregated
            shifted_sold = daily["quantity_sold"].shift(1)
            rolling_cols[f"sold_rolling_mean_{window}"] = (
                shifted_sold.rolling(window, min_periods=1).mean()
            )
            rolling_cols[f"sold_rolling_std_{window}"] = (
                shifted_sold.rolling(window, min_periods=1).std().fillna(0.0)
            )

            if "waste_ratio" in daily.columns:
                shifted_waste = daily["waste_ratio"].shift(1)
                rolling_cols[f"waste_ratio_rolling_mean_{window}"] = (
                    shifted_waste.rolling(window, min_periods=1).mean()
                )

        rolling_df = pd.DataFrame(rolling_cols, index=full_idx)

        merged_group = group.merge(
            rolling_df,
            left_on="_cal_date",
            right_index=True,
            how="left",
        )
        processed_groups.append(merged_group)

    result = pd.concat(processed_groups, ignore_index=True).drop(columns=["_cal_date"])
    return result


# ---------------------------------------------------------------------------
# Waste-Risk Labelling
# ---------------------------------------------------------------------------

def label_waste_risk(
    df: pd.DataFrame,
    low_threshold: float = LOW_RISK_THRESHOLD,
    high_threshold: float = HIGH_RISK_THRESHOLD,
) -> pd.DataFrame:
    """
    Create ground-truth waste_risk_label from actual historical waste_ratio.

      0 — Low    (waste_ratio < low_threshold, e.g. < 10%)
      1 — Medium (low_threshold <= waste_ratio < high_threshold, e.g. 10% - 25%)
      2 — High   (waste_ratio >= high_threshold, e.g. >= 25%)
    """
    df = df.copy()

    if "waste_ratio" not in df.columns:
        if "quantity_prepared" in df.columns and "quantity_wasted" in df.columns:
            prep = df["quantity_prepared"].replace(0, np.nan)
            df["waste_ratio"] = (df["quantity_wasted"] / prep).fillna(0.0)
        else:
            raise ValueError("Cannot label waste risk without quantity_prepared and quantity_wasted.")

    conditions = [
        df["waste_ratio"] < low_threshold,
        (df["waste_ratio"] >= low_threshold) & (df["waste_ratio"] < high_threshold),
        df["waste_ratio"] >= high_threshold,
    ]
    choices = [0, 1, 2]
    df["waste_risk_label"] = np.select(conditions, choices, default=0).astype(int)

    return df


# ---------------------------------------------------------------------------
# Model Feature Definitions (Explicitly Guarded Against Leakage)
# ---------------------------------------------------------------------------

# Demand forecasting predicts quantity_sold on a service day.
# Allowed: date parts, past lags, past rolling stats.
# FORBIDDEN: quantity_prepared (exogenous demand should not depend on prep),
# current day's quantity_sold (target), current day's quantity_wasted.
DEMAND_FORECAST_FEATURES: List[str] = [
    "day_of_week",
    "day_of_month",
    "month",
    "week_of_year",
    "is_weekend",
    "quarter",
    "sold_lag_1",
    "sold_lag_3",
    "sold_lag_7",
    "sold_rolling_mean_3",
    "sold_rolling_mean_7",
    "sold_rolling_std_3",
    "sold_rolling_std_7",
    "waste_ratio_rolling_mean_3",
    "waste_ratio_rolling_mean_7",
]

# Waste-risk classification predicts the risk tier (0, 1, 2) before service.
# Allowed: date parts, planned quantity_prepared, past consumption lags, past rolling waste tendencies.
# FORBIDDEN: current day's quantity_wasted, current day's waste_ratio, current day's sell_through_rate.
WASTE_RISK_FEATURES: List[str] = [
    "quantity_prepared",
    "day_of_week",
    "day_of_month",
    "month",
    "week_of_year",
    "is_weekend",
    "quarter",
    "sold_lag_1",
    "sold_lag_3",
    "sold_lag_7",
    "sold_rolling_mean_3",
    "sold_rolling_mean_7",
    "waste_ratio_rolling_mean_3",
    "waste_ratio_rolling_mean_7",
]


# ---------------------------------------------------------------------------
# Full Feature Engineering Pipeline
# ---------------------------------------------------------------------------

def build_features(
    df: pd.DataFrame,
    is_training: bool = True,
) -> pd.DataFrame:
    """
    Transforms cleaned records into a full feature-engineered DataFrame.
    Can be used for both training and future inference.
    """
    # Ensure derived waste_ratio is available for rolling statistics
    if "waste_ratio" not in df.columns and "quantity_prepared" in df.columns and "quantity_wasted" in df.columns:
        prep = df["quantity_prepared"].replace(0, np.nan)
        df["waste_ratio"] = (df["quantity_wasted"] / prep).fillna(0.0)

    df = add_date_features(df)
    df = add_lag_features(df)
    df = add_rolling_features(df)

    if is_training:
        df = label_waste_risk(df)

    return df


def prepare_task_matrices(
    df: pd.DataFrame,
    task: str = "demand",
    drop_na: bool = True,
) -> Dict[str, Any]:
    """
    Extract X (feature matrix) and y (target vector) for a given ML task.

    Parameters
    ----------
    df      : Raw or preprocessed DataFrame
    task    : 'demand' | 'waste_risk'
    drop_na : If True, drops initial rows with NaN from lag features.

    Returns
    -------
    {
      'X': pd.DataFrame,
      'y': pd.Series,
      'features': List[str],
      'task': str,
      'dates': pd.Series (chronological ordering reference)
    }
    """
    featured_df = build_features(df, is_training=True)

    if task == "demand":
        feature_cols = [c for c in DEMAND_FORECAST_FEATURES if c in featured_df.columns]
        target_col = "quantity_sold"
    elif task == "waste_risk":
        feature_cols = [c for c in WASTE_RISK_FEATURES if c in featured_df.columns]
        target_col = "waste_risk_label"
    else:
        raise ValueError(f"Unknown task: '{task}'. Expected 'demand' or 'waste_risk'.")

    if drop_na:
        # Drop rows where any required feature or target is NaN
        featured_df = featured_df.dropna(subset=feature_cols + [target_col]).reset_index(drop=True)

    target = featured_df[target_col]

    # Final sanity check against leakage
    if task == "demand" and "quantity_sold" in feature_cols:
        raise RuntimeError("CRITICAL LEAKAGE: 'quantity_sold' present in demand feature matrix!")
    if task == "waste_risk" and any(c in feature_cols for c in ["waste_ratio", "quantity_wasted", "sell_through_rate"]):
        raise RuntimeError("CRITICAL LEAKAGE: Ground-truth waste metric present in waste_risk feature matrix!")

    return {
        "X": featured_df[feature_cols],
        "y": target,
        "features": feature_cols,
        "task": task,
        "dates": featured_df["record_date"],
        "full_df": featured_df,
    }
