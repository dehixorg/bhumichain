"""
BhumiChain Valuation Oracle
Provides stamp-duty circle rates for Gautam Buddha Nagar tehsils.
Sprint 11 stub — real revenue circle-rate API integration in Sprint 12.
"""
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="BhumiChain Valuation Oracle", version="1.0.0")

# UP Revenue Board circle rates (Dadri, GBN) — ₹ per sq m, 2025-26
CIRCLE_RATES = {
    "DAD": {  # Dadri
        "residential": 18000,
        "agricultural": 2500,
        "commercial": 45000,
        "industrial": 22000,
    },
    "GBN": {  # Greater Noida
        "residential": 32000,
        "agricultural": 4500,
        "commercial": 75000,
        "industrial": 38000,
    },
}

STAMP_DUTY_RATE = 0.07        # 7% UP stamp duty
REGISTRATION_FEE_RATE = 0.01  # 1% registration fee


class ValuationRequest(BaseModel):
    dlpiId: str       # e.g. DLPI-UP-DAD-00100
    areaInSqM: float
    landType: str = "agricultural"


class ValuationResponse(BaseModel):
    dlpiId: str
    areaInSqM: float
    landType: str
    tehsilCode: str
    circleRatePerSqM: int
    marketValueINR: float
    stampDutyINR: float
    registrationFeeINR: float
    totalPayableINR: float
    source: str


@app.get("/health")
def health():
    return {"status": "ok", "service": "valuation-oracle"}


@app.post("/api/valuation", response_model=ValuationResponse)
def valuate(req: ValuationRequest):
    # Extract tehsil from DLPI-UP-DAD-XXXXX
    parts = req.dlpiId.split("-")
    tehsil = parts[2] if len(parts) >= 3 else "DAD"

    rates = CIRCLE_RATES.get(tehsil, CIRCLE_RATES["DAD"])
    land_type = req.landType.lower()
    circle_rate = rates.get(land_type, rates["agricultural"])

    market_value = circle_rate * req.areaInSqM
    stamp_duty = round(market_value * STAMP_DUTY_RATE, 2)
    reg_fee = round(market_value * REGISTRATION_FEE_RATE, 2)

    return ValuationResponse(
        dlpiId=req.dlpiId,
        areaInSqM=req.areaInSqM,
        landType=land_type,
        tehsilCode=tehsil,
        circleRatePerSqM=circle_rate,
        marketValueINR=market_value,
        stampDutyINR=stamp_duty,
        registrationFeeINR=reg_fee,
        totalPayableINR=round(market_value + stamp_duty + reg_fee, 2),
        source="mock-circle-rates-2025-26",
    )


@app.get("/api/circle-rates/{tehsil}")
def circle_rates(tehsil: str):
    return CIRCLE_RATES.get(tehsil.upper(), CIRCLE_RATES["DAD"])
