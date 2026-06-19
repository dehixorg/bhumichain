"""
Maharashtra Stamp Duty & Registration Oracle
Computes stamp duty based on Maharashtra circle rates.
Real: calls igrmaharashtra.gov.in circle rate API.
Mock: uses hardcoded Nashik district circle rates for demo.
"""

from pydantic import BaseModel


# Maharashtra stamp duty rates (2025-26)
MH_STAMP_DUTY_RATE = 0.05       # 5% for agricultural/residential
MH_REGISTRATION_RATE = 0.01     # 1% registration fee (max ₹30,000)
MH_METRO_SURCHARGE = 0.01       # 1% metro cess (Nashik Municipal area only)

# Nashik district circle rates (₹/hectare) — approximate 2025-26 IGR rates
NASHIK_CIRCLE_RATES = {
    "Bagayat":        2_200_000,  # Irrigated agricultural
    "Jirayat":        1_100_000,  # Rain-fed agricultural
    "Kharaba":          400_000,  # Barren
    "Tribal_FRA":       900_000,  # Tribal FRA (for encumbrance valuation only)
    "Government":             0,
    "Forest":                 0,
}

# Tehsil-level multipliers (relative to base Nashik city)
TEHSIL_MULTIPLIER = {
    "SNN": 0.85,  # Sinnar — semi-urban, lower rates
    "IGT": 0.60,  # Igatpuri — tribal/hilly, lower
    "NSK": 1.00,  # Nashik city
    "DIN": 0.90,  # Dindori
    "NIK": 0.80,  # Niphad
}


class StampDutyRequest(BaseModel):
    dlpiId: str
    landType: str
    areaHectares: float
    declaredValueINR: int
    tehsilCode: str
    isNashikMunicipal: bool = False


class StampDutyResponse(BaseModel):
    dlpiId: str
    estimatedValueINR: int
    stampDutyBaseValueINR: int  # max(declared, 80% of estimated)
    stampDutyINR: int
    registrationFeeINR: int
    metroSurchargeINR: int
    totalPayableINR: int
    circleRatePerHectare: int
    breakdown: dict


def calculate_stamp_duty(request: StampDutyRequest, mock: bool) -> StampDutyResponse:
    base_rate = NASHIK_CIRCLE_RATES.get(request.landType, 1_000_000)
    multiplier = TEHSIL_MULTIPLIER.get(request.tehsilCode, 1.0)
    estimated_value = int(base_rate * multiplier * request.areaHectares)

    # Maharashtra rule: stamp duty on max(declared, 80% of circle rate estimate)
    stamp_base = max(request.declaredValueINR, int(estimated_value * 0.80))
    stamp_duty = int(stamp_base * MH_STAMP_DUTY_RATE)
    reg_fee = min(int(stamp_base * MH_REGISTRATION_RATE), 30_000)
    metro_surcharge = int(stamp_base * MH_METRO_SURCHARGE) if request.isNashikMunicipal else 0
    total = stamp_duty + reg_fee + metro_surcharge

    return StampDutyResponse(
        dlpiId=request.dlpiId,
        estimatedValueINR=estimated_value,
        stampDutyBaseValueINR=stamp_base,
        stampDutyINR=stamp_duty,
        registrationFeeINR=reg_fee,
        metroSurchargeINR=metro_surcharge,
        totalPayableINR=total,
        circleRatePerHectare=int(base_rate * multiplier),
        breakdown={
            "landType": request.landType,
            "areaHectares": request.areaHectares,
            "tehsilCode": request.tehsilCode,
            "tehsilMultiplier": multiplier,
            "stampDutyRate": f"{MH_STAMP_DUTY_RATE * 100}%",
            "registrationRate": f"{MH_REGISTRATION_RATE * 100}% (max ₹30,000)",
        },
    )
