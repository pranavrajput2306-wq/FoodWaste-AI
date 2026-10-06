"""
Data Preprocessing Module
=========================
Handles data validation, cleaning, and transformation for the ML pipeline.

Pipeline stages this module covers:
  Historical Data → Data Validation → Data Cleaning → Prepared DataFrame

Future tasks:
  - Validate demand_records from MySQL
  - Handle missing values (quantity_prepared, quantity_sold, quantity_wasted)
  - Remove duplicate records
  - Enforce date/type constraints
  - Compute waste ratio, sell-through rate
"""

import pandas as pd
import numpy as np
from datetime import datetime


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REQUIRED_COLUMNS = [
    "food_item_id",
    "record_date",
    "quantity_prepared",
    "quantity_sold",
    "quantity_wasted",
]

NUMERIC_COLUMNS = ["quantity_prepared", "quantity_sold", "quantity_wasted"]


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate_dataframe(df: pd.DataFrame) -> dict:
    """
    Validate a raw demand-records DataFrame.

    Returns a dict with:
      - is_valid  (bool)
      - errors    (list[str])
      - warnings  (list[str])
    """
    errors = []
    warnings = []

    # 1. Required columns present
    missing = [c for c in REQUIRED_COLUMNS if c not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {missing}")

    if errors:
        return {"is_valid": False, "errors": errors, "warnings": warnings}

    # 2. No completely empty DataFrame
    if df.empty:
        errors.append("DataFrame is empty — no records to process.")
        return {"is_valid": False, "errors": errors, "warnings": warnings}

    # 3. Numeric columns
    for col in NUMERIC_COLUMNS:
        non_numeric = df[col].apply(lambda x: not isinstance(x, (int, float))).sum()
        if non_numeric > 0:
            warnings.append(f"Column '{col}' has {non_numeric} non-numeric values.")

    # 4. Negative quantities
    for col in NUMERIC_COLUMNS:
        neg = (pd.to_numeric(df[col], errors="coerce") < 0).sum()
        if neg > 0:
            warnings.append(f"Column '{col}' has {neg} negative values.")

    # 5. Waste > prepared (logically impossible)
    numeric_df = df[NUMERIC_COLUMNS].apply(pd.to_numeric, errors="coerce")
    waste_gt_prep = (numeric_df["quantity_wasted"] > numeric_df["quantity_prepared"]).sum()
    if waste_gt_prep > 0:
        errors.append(
            f"{waste_gt_prep} records have quantity_wasted > quantity_prepared (impossible demand state)."
        )

    # 5b. Sold + Wasted > Prepared
    sold_plus_wasted_gt_prep = (
        (numeric_df["quantity_sold"] + numeric_df["quantity_wasted"]) > numeric_df["quantity_prepared"]
    ).sum()
    if sold_plus_wasted_gt_prep > 0:
        errors.append(
            f"{sold_plus_wasted_gt_prep} records have quantity_sold + quantity_wasted > quantity_prepared."
        )

    # 6. Date parseable
    try:
        pd.to_datetime(df["record_date"])
    except Exception:
        errors.append("Column 'record_date' contains unparseable date values.")

    is_valid = len(errors) == 0
    return {"is_valid": is_valid, "errors": errors, "warnings": warnings}


# ---------------------------------------------------------------------------
# Cleaning
# ---------------------------------------------------------------------------

def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean and normalise a demand-records DataFrame.

    Steps:
      1. Parse record_date to datetime
      2. Coerce numeric columns
      3. Drop rows with NaN in required columns
      4. Clip negatives to 0
      5. Cap quantity_wasted at quantity_prepared
      6. Drop duplicates on (food_item_id, record_date)
      7. Sort by food_item_id, record_date
    """
    df = df.copy()

    # 1. Dates
    df["record_date"] = pd.to_datetime(df["record_date"], errors="coerce")

    # 2. Numeric coercion
    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    # 3. Drop NaNs in required columns
    df.dropna(subset=REQUIRED_COLUMNS, inplace=True)

    # 4. Clip negatives
    for col in NUMERIC_COLUMNS:
        df[col] = df[col].clip(lower=0)

    # 5. Cap waste at prepared
    df["quantity_wasted"] = df[["quantity_wasted", "quantity_prepared"]].min(axis=1)

    # 6. Drop duplicates (keep last entry per food_item + date)
    df.drop_duplicates(subset=["food_item_id", "record_date"], keep="last", inplace=True)

    # 7. Sort
    df.sort_values(["food_item_id", "record_date"], inplace=True)
    df.reset_index(drop=True, inplace=True)

    return df


# ---------------------------------------------------------------------------
# Derived metrics
# ---------------------------------------------------------------------------

def add_derived_metrics(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute basic derived metrics used by the feature-engineering stage.

    Adds:
      - waste_ratio       : quantity_wasted / quantity_prepared
      - sell_through_rate : quantity_sold   / quantity_prepared
    """
    df = df.copy()
    prepared = df["quantity_prepared"].replace(0, np.nan)
    df["waste_ratio"]       = df["quantity_wasted"] / prepared
    df["sell_through_rate"] = df["quantity_sold"]   / prepared
    df["waste_ratio"] = df["waste_ratio"].fillna(0.0)
    df["sell_through_rate"] = df["sell_through_rate"].fillna(0.0)
    return df


# ---------------------------------------------------------------------------
# Pipeline & Entrypoint
# ---------------------------------------------------------------------------

def preprocess_pipeline(df: pd.DataFrame) -> dict:
    """
    Full preprocessing pipeline.

    Returns:
      {
        "success": bool,
        "data"   : pd.DataFrame | None,
        "report" : dict          (validation report)
      }
    """
    report = validate_dataframe(df)

    if not report["is_valid"]:
        return {"success": False, "data": None, "report": report}

    cleaned = clean_dataframe(df)
    enriched = add_derived_metrics(cleaned)

    return {"success": True, "data": enriched, "report": report}


def validate_and_preprocess_file(file_path: str) -> dict:
    """
    Load CSV data file, validate and preprocess.
    """
    df = pd.read_csv(file_path)
    return preprocess_pipeline(df)


if __name__ == "__main__":
    import sys
    print("Testing ML Data Preprocessor Validation Foundation...")
    sample_valid = pd.DataFrame({
        "food_item_id": [1, 1, 2],
        "record_date": ["2026-10-01", "2026-10-02", "2026-10-01"],
        "quantity_prepared": [100.0, 80.0, 50.0],
        "quantity_sold": [85.0, 70.0, 42.0],
        "quantity_wasted": [15.0, 10.0, 8.0],
    })
    res_valid = preprocess_pipeline(sample_valid)
    assert res_valid["success"] is True, "Valid sample should pass"
    assert "waste_ratio" in res_valid["data"].columns, "Derived metric missing"

    sample_invalid = pd.DataFrame({
        "food_item_id": [1],
        "record_date": ["2026-10-01"],
        "quantity_prepared": [50.0],
        "quantity_sold": [40.0],
        "quantity_wasted": [20.0],  # 40 + 20 = 60 > 50
    })
    res_invalid = preprocess_pipeline(sample_invalid)
    assert res_invalid["success"] is False, "Invalid sample must fail validation"
    print("ML Preprocessor validation tests passed successfully!")

