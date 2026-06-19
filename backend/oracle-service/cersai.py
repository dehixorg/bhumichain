"""
CERSAI Oracle (Central Registry of Securitisation Asset Reconstruction and Security Interest)
Verifies mortgage registrations and checks for existing charges before new mortgage.
Mock: returns pre-scripted mortgage data.
"""

from pydantic import BaseModel
from typing import Optional


# CERSAI registry — active and released charges
MOCK_CERSAI_REGISTRY = {
    # Released mortgage (SBI loan paid off)
    "CERSAI-NSK-2022-00891": {
        "cersaiRegNo": "CERSAI-NSK-2022-00891",
        "dlpiId": "DLPI-MH-SNN-00142",
        "bankName": "State Bank of India",
        "bankBranch": "Sinnar Branch",
        "loanAmountINR": 1500000,
        "mortgageDate": "2022-03-10",
        "mortgageExpiry": "2032-03-10",
        "status": "RELEASED",
        "releasedOn": "2025-09-01",
        "verified": True,
    },
    # Active charge on tribal parcel
    "CERSAI-NSK-2024-01203": {
        "cersaiRegNo": "CERSAI-NSK-2024-01203",
        "dlpiId": "DLPI-MH-IGT-T0023",
        "bankName": "Gramin Bank of Aryavart",
        "bankBranch": "Igatpuri Branch",
        "loanAmountINR": 250000,
        "mortgageDate": "2024-01-15",
        "mortgageExpiry": "2034-01-15",
        "status": "ACTIVE",
        "verified": True,
    },
}

# Active charges by DLPI (for dual-mortgage check)
ACTIVE_CHARGES_BY_DLPI = {
    dlpi: reg
    for dlpi, reg in {
        r["dlpiId"]: r for r in MOCK_CERSAI_REGISTRY.values() if r["status"] == "ACTIVE"
    }.items()
}


class CERSAIVerifyRequest(BaseModel):
    cersaiRegNo: str
    dlpiId: Optional[str] = None


def verify_cersai(request: CERSAIVerifyRequest, mock: bool) -> dict:
    if mock:
        record = MOCK_CERSAI_REGISTRY.get(request.cersaiRegNo)
        if not record:
            # Treat unknown CERSAI numbers as newly registered (valid)
            return {"verified": True, "cersaiRegNo": request.cersaiRegNo, "status": "NEWLY_REGISTERED"}
        if request.dlpiId and record["dlpiId"] != request.dlpiId:
            return {"verified": False, "error": "CERSAI registration does not match parcel DLPI ID"}
        return record
    else:
        raise NotImplementedError("Real CERSAI API not configured. Set ORACLE_MODE=mock.")


def check_active_charge(dlpi_id: str, mock: bool) -> dict:
    """Check if a parcel already has an active CERSAI charge (dual mortgage prevention)."""
    if mock:
        charge = ACTIVE_CHARGES_BY_DLPI.get(dlpi_id)
        if charge:
            return {"hasActiveCharge": True, "charge": charge}
        return {"hasActiveCharge": False}
    else:
        raise NotImplementedError("Real CERSAI API not configured. Set ORACLE_MODE=mock.")
