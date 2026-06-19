"""
BhumiChain Oracle Service
FastAPI app exposing all mock/real oracle endpoints.
Runs on port 8001. Called by the Node.js API Gateway.
"""

import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from aadhaar import AadhaarVerifyRequest, verify_aadhaar
from crs import CRSVerifyRequest, verify_death_certificate
from stamp_duty import StampDutyRequest, calculate_stamp_duty
from upi import UPIInitiateRequest, initiate_payment, verify_payment
from ecourts import ECourtsVerifyRequest, verify_court_order
from cersai import CERSAIVerifyRequest, verify_cersai, check_active_charge

MOCK = os.getenv("ORACLE_MODE", "mock") == "mock"

app = FastAPI(
    title="BhumiChain Oracle Service",
    description="Unified oracle proxy for Aadhaar, CRS, Stamp Duty, UPI, eCourts, CERSAI",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."},
    )


@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock" if MOCK else "real"}


# ─── Aadhaar ──────────────────────────────────────────────────────────────────

@app.post("/aadhaar/verify")
def aadhaar_verify(request: AadhaarVerifyRequest):
    try:
        return verify_aadhaar(request, MOCK)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Civil Registration System ────────────────────────────────────────────────

@app.post("/crs/verify")
def crs_verify(request: CRSVerifyRequest):
    try:
        result = verify_death_certificate(request, MOCK)
        if not result.get("verified"):
            raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
        return result
    except HTTPException:
        raise
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Stamp Duty ───────────────────────────────────────────────────────────────

@app.post("/stamp-duty/calculate")
def stamp_duty_calculate(request: StampDutyRequest):
    try:
        return calculate_stamp_duty(request, MOCK)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Valuation (simple circle-rate estimate for PropertyTransfer) ─────────────

class ValuationRequest(BaseModel):
    dlpiId: str
    declaredValueINR: int
    landType: Optional[str] = "Bagayat"
    areaHectares: Optional[float] = 2.4
    tehsilCode: Optional[str] = "SNN"

@app.post("/valuation/estimate")
def valuation_estimate(request: ValuationRequest):
    """Simple valuation using circle rates — full XGBoost model in AI service."""
    from stamp_duty import NASHIK_CIRCLE_RATES, TEHSIL_MULTIPLIER
    base = NASHIK_CIRCLE_RATES.get(request.landType or "Bagayat", 1_500_000)
    mult = TEHSIL_MULTIPLIER.get(request.tehsilCode or "SNN", 0.85)
    estimated = int(base * mult * (request.areaHectares or 2.4))
    return {
        "dlpiId": request.dlpiId,
        "estimatedValueINR": estimated,
        "declaredValueINR": request.declaredValueINR,
        "valuationMethod": "circle_rate",
        "note": "Full XGBoost valuation available from AI service /valuation/xgboost",
    }


# ─── UPI ──────────────────────────────────────────────────────────────────────

@app.post("/upi/initiate")
def upi_initiate(request: UPIInitiateRequest):
    try:
        return initiate_payment(request, MOCK)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/upi/verify/{ref_no}")
def upi_verify(ref_no: str):
    try:
        return verify_payment(ref_no, MOCK)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── eCourts ─────────────────────────────────────────────────────────────────

@app.post("/ecourts/verify")
def ecourts_verify(request: ECourtsVerifyRequest):
    try:
        result = verify_court_order(request, MOCK)
        if not result.get("verified"):
            raise HTTPException(status_code=404, detail=result.get("error", "Not found"))
        return result
    except HTTPException:
        raise
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── CERSAI ───────────────────────────────────────────────────────────────────

@app.post("/cersai/verify")
def cersai_verify(request: CERSAIVerifyRequest):
    try:
        return verify_cersai(request, MOCK)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cersai/verify/{cersai_reg_no}")
def cersai_verify_get(cersai_reg_no: str, dlpi_id: Optional[str] = Query(None)):
    return cersai_verify(CERSAIVerifyRequest(cersaiRegNo=cersai_reg_no, dlpiId=dlpi_id))


@app.get("/cersai/active-charge/{dlpi_id}")
def cersai_active_charge(dlpi_id: str):
    try:
        return check_active_charge(dlpi_id, MOCK)
    except NotImplementedError as e:
        raise HTTPException(status_code=501, detail=str(e))


# ─── FraudSense stub ─────────────────────────────────────────────────────────
# Full GNN-based fraud scoring is in ai-service. This stub returns pre-scripted
# scores for the demo so the oracle service is self-contained.

class FraudScoreRequest(BaseModel):
    dlpiId: str
    sellerAadhaarHash: str
    buyerAadhaarHash: str
    declaredValueINR: int
    oracleValueINR: int

MOCK_FRAUD_SCORES = {
    # Legitimate sale — Scene 4
    "DLPI-MH-SNN-00142::buyer1": 0.12,
    # Duplicate sale attempt — Scene 5
    "DLPI-MH-SNN-00142::buyer2": 0.94,
    # Tribal — blocked before fraud check
    "DLPI-MH-IGT-T0023": 0.0,
}

@app.post("/fraud/score")
def fraud_score(request: FraudScoreRequest):
    if MOCK:
        # Return high score for second attempt on same parcel (dual-sale demo)
        score_key = f"{request.dlpiId}::buyer1"
        score = MOCK_FRAUD_SCORES.get(score_key, 0.08)
        signals = []
        if score >= 0.75:
            signals = ["NATIONAL_LOCK_ACTIVE", "DUPLICATE_BUYER_PATTERN", "PRICE_UNDERVALUED"]
        return {
            "dlpiId": request.dlpiId,
            "fraudScore": score,
            "fraudSignals": signals,
            "model": "mock_fraud_sense_v1",
            "note": "Full GNN model available at ai-service /fraud/gnn-score",
        }
    raise HTTPException(status_code=501, detail="Real FraudSense model not configured")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8001))
    print(f"\n🔮 BhumiChain Oracle Service")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL'}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
