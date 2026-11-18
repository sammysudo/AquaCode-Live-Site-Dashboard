import joblib
import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

# Load ML Model
MODEL = joblib.load("svm_water_model.joblib")
FEATURES = ["ph", "tds", "temp"]

app = FastAPI()

# Allow CORS (good practice for deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. SERVE THE STATIC FILES (CSS & JS) ---
app.mount("/static", StaticFiles(directory="static"), name="static")

class Reading(BaseModel):
    device_id: str = "esp32-01"
    ts: int | None = None
    ph: float
    tds_in: float
    tds_out: float
    temp_c: float
    turbidity: float | None = None

LATEST = {"reading": None, "prediction": None}

def predict_safe(r: Reading) -> dict:
    x = np.array([[r.ph, r.tds_out, r.temp_c]])
    pred = int(MODEL.predict(x)[0])
    proba = float(MODEL.predict_proba(x)[0][1]) if hasattr(MODEL, "predict_proba") else None
    return {"safe": pred, "probability_safe": proba}

@app.post("/api/readings")
def ingest(r: Reading):
    pred = predict_safe(r)
    LATEST["reading"] = r.model_dump()
    LATEST["prediction"] = pred
    return {"received": True, "prediction": pred}

@app.get("/api/latest")
def latest():
    if LATEST["reading"] is None:
        raise HTTPException(status_code=404, detail="no readings yet")
    return {**LATEST["reading"], **LATEST["prediction"]}

@app.post("/api/predict")
def predict(r: Reading):
    return predict_safe(r)

@app.get("/health")
def health():
    return {"ok": True, "features": FEATURES}

# --- 2. SERVE THE DASHBOARD (HTML) ---
@app.get("/")
def serve_dashboard():
    return FileResponse("index.html")