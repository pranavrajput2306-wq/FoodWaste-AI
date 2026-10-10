"""
FastAPI Microservice for FoodWaste AI ML Predictions
=====================================================
Serves genuine machine learning predictions for:
  1. Demand Forecasting (Regression)
  2. Food Waste-Risk (Classification)

Endpoints:
  GET  /health
  POST /predict/demand
  POST /predict/waste-risk
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

# Ensure project root in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, status, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from ml.src.models.model_trainer import (
    load_artifact,
    DEMAND_MODEL_PATH,
    WASTE_RISK_MODEL_PATH,
    METADATA_PATH,
    EVAL_RESULTS_PATH,
    ARTIFACTS_DIR,
)
from ml.src.features.feature_engineering import (
    add_date_features,
    add_lag_features,
    add_rolling_features,
    DEMAND_FORECAST_FEATURES,
    WASTE_RISK_FEATURES,
    RISK_LABEL_NAMES,
)

TRAINING_STATUS_PATH = os.path.join(ARTIFACTS_DIR, "training_status.json")

def get_production_training_status() -> Dict[str, Any]:
    """
    Reads genuine training status to ensure unverified/synthetic models
    are never treated as valid production models.
    """
    if os.path.exists(TRAINING_STATUS_PATH):
        try:
            with open(TRAINING_STATUS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"status": "unverified", "message": "No verified production training record found."}


# ---------------------------------------------------------------------------
# FastAPI Initialization & Security Boundary
# ---------------------------------------------------------------------------
app = FastAPI(
    title="FoodWaste AI — ML Prediction Service",
    description="Genuine demand forecasting and food waste-risk prediction API.",
    version="1.0.0",
)

# CORS configuration: Production restricts to configured backend/gateway origin
ALLOWED_ORIGINS_ENV = os.environ.get("ML_ALLOWED_ORIGINS", "")
if ALLOWED_ORIGINS_ENV:
    cors_origins = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
else:
    # Safe defaults for internal gateway communication
    cors_origins = ["http://localhost:5000", "http://127.0.0.1:5000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if os.environ.get("NODE_ENV") == "production" else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def verify_service_boundary(request: Request, call_next):
    """
    Ensures FastAPI prediction endpoints are protected by an internal shared secret
    when ML_SERVICE_SECRET is configured, preventing direct unauthenticated public access.
    Health checks remain open for deployment readiness/liveness probes.
    """
    expected_secret = os.environ.get("ML_SERVICE_SECRET")
    if expected_secret and request.url.path.startswith("/predict/"):
        client_secret = request.headers.get("X-Internal-Service-Key")
        if not client_secret or client_secret != expected_secret:
            from fastapi.responses import JSONResponse
            return JSONResponse(
                status_code=401,
                content={
                    "success": False,
                    "status": "unauthorized",
                    "message": "Direct unauthenticated access prohibited. Requests must route via the authenticated backend gateway.",
                },
            )
    return await call_next(request)



# ---------------------------------------------------------------------------
# Pydantic Request & Response Schemas
# ---------------------------------------------------------------------------

class HistoricalRecordInput(BaseModel):
    record_date: str = Field(..., description="Date in YYYY-MM-DD format")
    quantity_prepared: float = Field(..., ge=0, description="Units prepared")
    quantity_sold: float = Field(..., ge=0, description="Units sold")
    quantity_wasted: float = Field(..., ge=0, description="Units wasted")


class PredictionRequest(BaseModel):
    food_item_id: int = Field(..., gt=0, description="Food item ID")
    target_date: str = Field(..., description="Target service date in YYYY-MM-DD format")
    planned_quantity_prepared: float = Field(..., ge=0, description="Planned production quantity")
    historical_records: Optional[List[HistoricalRecordInput]] = Field(
        default=None,
        description="Optional list of historical consumption records for this item",
    )

    @field_validator("target_date")
    @classmethod
    def validate_date(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("target_date must be in YYYY-MM-DD format.")
        return v


# ---------------------------------------------------------------------------
# Helper: Feature Extraction for Inference
# ---------------------------------------------------------------------------

def construct_inference_feature_row(
    food_item_id: int,
    target_date: str,
    planned_prepared: float,
    historical_records: Optional[List[HistoricalRecordInput]] = None,
    task: str = "demand",
) -> Tuple[bool, Optional[pd.DataFrame], Optional[str]]:
    """
    Builds the exact feature row matching training schemas without future leakage.
    Returns (success, feature_df, error_message).
    """
    # 1. Gather historical data for this item
    history_df: Optional[pd.DataFrame] = None
    if historical_records and len(historical_records) > 0:
        history_df = pd.DataFrame([r.model_dump() for r in historical_records])
        history_df["food_item_id"] = food_item_id
    else:
        # Check if local export exists
        default_csv = os.path.join(PROJECT_ROOT, "ml", "data", "raw", "demand_records.csv")
        if os.path.exists(default_csv):
            try:
                full_csv = pd.read_csv(default_csv)
                item_csv = full_csv[full_csv["food_item_id"] == food_item_id].copy()
                if len(item_csv) > 0:
                    history_df = item_csv
            except Exception:
                pass

    if history_df is None or len(history_df) < 7:
        count = len(history_df) if history_df is not None else 0
        return (
            False,
            None,
            f"Insufficient historical records for food item #{food_item_id}: {count} available, "
            f"at least 7 prior days are required to calculate genuine lag and rolling features without fabricating values.",
        )

    # 2. Filter strictly prior dates to prevent future-data leakage
    history_df["record_date"] = pd.to_datetime(history_df["record_date"])
    target_dt = pd.to_datetime(target_date)
    prior_df = history_df[history_df["record_date"] < target_dt].copy()

    if len(prior_df) < 7:
        return (
            False,
            None,
            f"Only {len(prior_df)} historical records exist strictly prior to {target_date}. "
            f"At least 7 prior days are required for genuine lag features.",
        )

    # Compute waste ratio on historical data
    prep = prior_df["quantity_prepared"].replace(0, np.nan)
    prior_df["waste_ratio"] = (prior_df["quantity_wasted"] / prep).fillna(0.0)

    # 3. Create candidate target row with planned_prepared
    target_row = pd.DataFrame([{
        "food_item_id": food_item_id,
        "record_date": target_dt,
        "quantity_prepared": planned_prepared,
        "quantity_sold": np.nan,    # Unknown future target
        "quantity_wasted": np.nan,  # Unknown future target
        "waste_ratio": np.nan,      # Unknown future target
    }])

    # 4. Concatenate and apply feature pipeline
    combined = pd.concat([prior_df, target_row], ignore_index=True)
    combined = add_date_features(combined)
    combined = add_lag_features(combined)
    combined = add_rolling_features(combined)

    # Extract the target row (last index)
    feat_row = combined.iloc[[-1]].copy()

    if task == "demand":
        req_cols = DEMAND_FORECAST_FEATURES
    else:
        req_cols = WASTE_RISK_FEATURES

    # Ensure planned_quantity_prepared is mapped
    feat_row["quantity_prepared"] = planned_prepared

    missing_cols = [c for c in req_cols if c not in feat_row.columns]
    if missing_cols:
        return False, None, f"Missing engineered features: {missing_cols}"

    # Verify that required calendar lag/rolling features are non-null
    # (i.e. strictly sufficient continuous historical calendar records exist without fabricating values)
    nan_cols = [c for c in req_cols if pd.isna(feat_row[c].iloc[0])]
    if nan_cols:
        return (
            False,
            None,
            f"Insufficient historical calendar records for food item #{food_item_id} to compute "
            f"calendar-aware features without fabricating values (missing calendar history for: {nan_cols}).",
        )

    return True, feat_row[req_cols], None


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health_check() -> Dict[str, Any]:
    """
    Health check verifying service status and model artifact presence.
    Ensures production inference cannot treat unverified/synthetic artifacts as valid production models.
    """
    prod_status = get_production_training_status()
    is_verified_success = prod_status.get("status") == "success"

    demand_exists = os.path.exists(DEMAND_MODEL_PATH) and os.path.getsize(DEMAND_MODEL_PATH) > 0
    waste_exists = os.path.exists(WASTE_RISK_MODEL_PATH) and os.path.getsize(WASTE_RISK_MODEL_PATH) > 0

    models_valid_and_available = is_verified_success and demand_exists and waste_exists

    return {
        "status": "healthy",
        "service": "foodwaste-ml-api",
        "timestamp": datetime.now(timezone.utc).isoformat() + "Z",
        "models_available": models_valid_and_available,
        "training_status": prod_status.get("status", "unknown"),
        "artifacts": {
            "demand_model": demand_exists,
            "waste_risk_model": waste_exists,
            "metadata": os.path.exists(METADATA_PATH),
        },
    }


@app.post("/predict/demand")
def predict_demand(req: PredictionRequest) -> Dict[str, Any]:
    """
    Forecast expected demand quantity for a food item on target_date.
    Never uses future information or fake values.
    """
    # 1. Model Availability & Verification Check
    prod_status = get_production_training_status()
    if prod_status.get("status") == "insufficient_data":
        return {
            "success": False,
            "status": "insufficient_data",
            "message": prod_status.get(
                "message",
                "Production models are unavailable due to insufficient genuine training data."
            ),
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    if not os.path.exists(DEMAND_MODEL_PATH) or os.path.getsize(DEMAND_MODEL_PATH) == 0:
        return {
            "success": False,
            "status": "model_unavailable",
            "message": "Demand forecasting model has not been trained or serialized yet.",
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    # 2. Extract Feature Row
    ok, feat_df, err = construct_inference_feature_row(
        food_item_id=req.food_item_id,
        target_date=req.target_date,
        planned_prepared=req.planned_quantity_prepared,
        historical_records=req.historical_records,
        task="demand",
    )
    if not ok:
        return {
            "success": False,
            "status": "insufficient_data",
            "message": err,
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    # 3. Model Inference
    try:
        model = load_artifact(DEMAND_MODEL_PATH)
        pred_value = float(model.predict(feat_df)[0])
        # Demand cannot be negative
        predicted_demand = round(max(0.0, pred_value), 2)

        model_name = "Best Selected Regressor"
        metrics = {}
        if os.path.exists(METADATA_PATH):
            try:
                meta = load_artifact(METADATA_PATH)
                model_name = meta.get("demand_model", {}).get("selected_model", model_name)
                metrics = meta.get("demand_model", {}).get("metrics", {})
            except Exception:
                pass

        return {
            "success": True,
            "status": "success",
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
            "planned_quantity_prepared": req.planned_quantity_prepared,
            "predicted_demand_units": predicted_demand,
            "model_used": model_name,
            "model_metrics": metrics,
        }
    except Exception as e:
        return {
            "success": False,
            "status": "prediction_error",
            "message": f"Inference execution failed: {str(e)}",
            "food_item_id": req.food_item_id,
        }


@app.post("/predict/waste-risk")
def predict_waste_risk(req: PredictionRequest) -> Dict[str, Any]:
    """
    Classify food waste risk tier (Low, Medium, High) for a food item on target_date.
    Never uses ground-truth waste metrics or fake predictions.
    """
    # 1. Model Availability & Verification Check
    prod_status = get_production_training_status()
    if prod_status.get("status") == "insufficient_data":
        return {
            "success": False,
            "status": "insufficient_data",
            "message": prod_status.get(
                "message",
                "Production models are unavailable due to insufficient genuine training data."
            ),
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    if not os.path.exists(WASTE_RISK_MODEL_PATH) or os.path.getsize(WASTE_RISK_MODEL_PATH) == 0:
        return {
            "success": False,
            "status": "model_unavailable",
            "message": "Waste-risk classification model has not been trained or serialized yet.",
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    # 2. Extract Feature Row
    ok, feat_df, err = construct_inference_feature_row(
        food_item_id=req.food_item_id,
        target_date=req.target_date,
        planned_prepared=req.planned_quantity_prepared,
        historical_records=req.historical_records,
        task="waste_risk",
    )
    if not ok:
        return {
            "success": False,
            "status": "insufficient_data",
            "message": err,
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
        }

    # 3. Model Inference
    try:
        model = load_artifact(WASTE_RISK_MODEL_PATH)
        pred_class = int(model.predict(feat_df)[0])
        risk_label = RISK_LABEL_NAMES.get(pred_class, "Unknown")

        probabilities: Dict[str, float] = {}
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(feat_df)[0]
            for idx, p in enumerate(probs):
                name = RISK_LABEL_NAMES.get(idx, f"Class_{idx}")
                probabilities[name] = round(float(p), 4)

        model_name = "Best Selected Classifier"
        metrics = {}
        if os.path.exists(METADATA_PATH):
            try:
                meta = load_artifact(METADATA_PATH)
                model_name = meta.get("waste_risk_model", {}).get("selected_model", model_name)
                metrics = meta.get("waste_risk_model", {}).get("metrics", {})
            except Exception:
                pass

        return {
            "success": True,
            "status": "success",
            "food_item_id": req.food_item_id,
            "target_date": req.target_date,
            "planned_quantity_prepared": req.planned_quantity_prepared,
            "predicted_risk_level": pred_class,
            "predicted_risk_label": risk_label,
            "class_probabilities": probabilities,
            "model_used": model_name,
            "model_metrics": metrics,
        }
    except Exception as e:
        return {
            "success": False,
            "status": "prediction_error",
            "message": f"Inference execution failed: {str(e)}",
            "food_item_id": req.food_item_id,
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("ML_PORT", 8000))
    host = os.environ.get("ML_HOST", "127.0.0.1")
    uvicorn.run("ml.src.api:app", host=host, port=port, reload=False)
