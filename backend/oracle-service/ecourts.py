"""
eCourts Oracle
Verifies court orders and case status from services.ecourts.gov.in.
Mock: returns pre-scripted case data for demo scenarios.
Real: calls eCourts API v2.
"""

from pydantic import BaseModel
from typing import Optional


MOCK_COURT_ORDERS = {
    # Example injunction — not used in main demo but available for demos/testing
    "NSK-DC-2025-1042": {
        "caseNumber": "NSK-DC-2025-1042",
        "courtName": "District Court Nashik",
        "orderType": "STAY",
        "dlpiId": "DLPI-MH-SNN-00098",
        "orderDate": "2025-11-15",
        "orderSummary": "Stay order on property transfer pending disposal of Title Suit",
        "status": "ACTIVE",
        "eCourtsOracleHash": "sha256:ecourt1nsk2025104200000000000000000000000000000000000000000000",
        "verified": True,
    },
    # Succession dispute — demo Scene 3 (if heir objects)
    "NSK-CJ-2026-0211": {
        "caseNumber": "NSK-CJ-2026-0211",
        "courtName": "Civil Judge (SD) Nashik",
        "orderType": "SUCCESSION_ORDER",
        "dlpiId": "DLPI-MH-SNN-00142",
        "orderDate": "2026-06-05",
        "orderSummary": "Court confirms equal shares for all three children under HSA 2005 S.6(3). Daughter Sunita entitled to 1/3 share.",
        "status": "FINAL",
        "eCourtsOracleHash": "sha256:ecourt2nsk2026021100000000000000000000000000000000000000000000",
        "verified": True,
    },
}


class ECourtsVerifyRequest(BaseModel):
    caseNumber: str
    dlpiId: Optional[str] = None


def verify_court_order(request: ECourtsVerifyRequest, mock: bool) -> dict:
    if mock:
        order = MOCK_COURT_ORDERS.get(request.caseNumber)
        if not order:
            return {"verified": False, "error": f"Case {request.caseNumber} not found in eCourts"}
        if request.dlpiId and order.get("dlpiId") != request.dlpiId:
            return {"verified": False, "error": "Case number does not match parcel DLPI ID"}
        return order
    else:
        raise NotImplementedError("Real eCourts API not configured. Set ORACLE_MODE=mock.")
