"""
Utility Functions
=================
Shared helpers used across the ML pipeline.
"""

import os
import json
import pandas as pd
import numpy as np
from datetime import datetime


# ---------------------------------------------------------------------------
# File I/O
# ---------------------------------------------------------------------------

def load_csv(path: str, **kwargs) -> pd.DataFrame:
    """Load a CSV file into a DataFrame with basic logging."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"CSV not found: {path}")
    df = pd.read_csv(path, **kwargs)
    print(f"Loaded {len(df):,} rows from {path}")
    return df


def save_csv(df: pd.DataFrame, path: str, **kwargs) -> None:
    """Save a DataFrame to CSV, creating parent directories as needed."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    df.to_csv(path, index=False, **kwargs)
    print(f"Saved {len(df):,} rows → {path}")


def save_json(data: dict, path: str) -> None:
    """Save a dict to a JSON file."""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(data, f, indent=2, default=str)
    print(f"Saved JSON → {path}")


def load_json(path: str) -> dict:
    """Load a JSON file into a dict."""
    with open(path) as f:
        return json.load(f)


# ---------------------------------------------------------------------------
# Date helpers
# ---------------------------------------------------------------------------

def parse_date(value) -> datetime:
    """Parse a date string or datetime-like value to datetime."""
    return pd.to_datetime(value)


def date_range_str(start, end) -> str:
    """Return a human-readable date range string."""
    return f"{pd.to_datetime(start).date()} → {pd.to_datetime(end).date()}"


# ---------------------------------------------------------------------------
# DataFrame helpers
# ---------------------------------------------------------------------------

def describe_dataframe(df: pd.DataFrame) -> None:
    """Print a concise summary of a DataFrame."""
    print(f"Shape    : {df.shape}")
    print(f"Columns  : {list(df.columns)}")
    print(f"Dtypes   :\n{df.dtypes}")
    print(f"Nulls    :\n{df.isnull().sum()}")
    print(f"Head     :\n{df.head(3)}")


def safe_divide(numerator, denominator, fill: float = 0.0):
    """Element-wise safe division, returning fill where denominator is 0."""
    denom = np.where(denominator == 0, np.nan, denominator)
    result = numerator / denom
    return np.nan_to_num(result, nan=fill)


# ---------------------------------------------------------------------------
# Logging / reporting
# ---------------------------------------------------------------------------

def timestamp() -> str:
    """Return current UTC timestamp as ISO-8601 string."""
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


def print_section(title: str, width: int = 60) -> None:
    """Print a formatted section header."""
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)
