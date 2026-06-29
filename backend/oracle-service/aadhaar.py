"""
Aadhaar Oracle — verifies Aadhaar numbers and returns identity data.
Mock mode: returns pre-scripted Noida/UP demo personas.
Real mode: calls UIDAI API (requires ASA empanelment).

Security: Raw Aadhaar number never stored. Only used transiently to lookup
persona, then discarded. aadhaarHash (SHA-256) flows downstream.
"""

import hashlib
import os
from typing import Optional
from pydantic import BaseModel

SALT = os.getenv("AADHAAR_SALT", "bhumichain-aadhaar-salt-change-in-prod")


def _sha256(aadhaar: str) -> str:
    return "sha256:" + hashlib.sha256((aadhaar + SALT).encode()).hexdigest()


# ─── Demo Personas (Noida — Dadri Tehsil, Gautam Buddha Nagar) ───────────────
# Aadhaar numbers: 9999-0001-XXXX format (clearly fake for demo)
# All OTPs are "123456" in mock mode (AADHAAR_MOCK=true)

MOCK_IDENTITIES = {

    # ── Officers ─────────────────────────────────────────────────────────────

    # Tehsildar
    "999900010001": {
        "name": "Amit Saxena",
        "dob": "1978-03-15",
        "gender": "M",
        "address": "Dadri Tehsil Office, Gautam Buddha Nagar, UP 203207",
        "verified": True,
        "role": "tehsildar",
        "deptEmail": "amit.saxena@up.gov.in",
        "jurisdictionCode": "GBN-DAD",
        "tehsilCode": "DAD",
    },

    # Circle Inspector / Kanungo
    "999900010002": {
        "name": "Rajesh Verma",
        "dob": "1983-07-22",
        "gender": "M",
        "address": "Revenue Circle Office, Dadri, Gautam Buddha Nagar, UP",
        "verified": True,
        "role": "circle_inspector",
        "deptEmail": "rajesh.verma@up.gov.in",
        "jurisdictionCode": "GBN-DAD",
        "circleCode": "DAD-C1",
        "patwariCodes": ["DAD-P1", "DAD-P2", "DAD-P3"],
    },

    # Patwari / Lekhpal
    "999900010003": {
        "name": "Vijay Singh",
        "dob": "1990-11-05",
        "gender": "M",
        "address": "Village Dadri, Gautam Buddha Nagar, UP 203207",
        "verified": True,
        "role": "patwari",
        "deptEmail": "vijay.singh@up.gov.in",
        "jurisdictionCode": "GBN-DAD",
        "patwariCode": "DAD-P1",
        "villageCodes": ["DAD-001", "DAD-002", "DAD-003"],
    },

    # ── Citizens ─────────────────────────────────────────────────────────────

    # Primary citizen — owns DLPI-UP-DAD-00142
    "999900010010": {
        "name": "Priya Kumar",
        "dob": "1985-06-18",
        "gender": "F",
        "address": "45, Sector 12, Noida, Gautam Buddha Nagar, UP 201301",
        "verified": True,
        "role": "citizen",
    },

    # Buyer in property transfer demo
    "999900010011": {
        "name": "Arun Sharma",
        "dob": "1979-09-12",
        "gender": "M",
        "address": "78, Sector 27, Noida, Gautam Buddha Nagar, UP 201301",
        "verified": True,
        "role": "citizen",
    },

    # Heir 1 in succession demo
    "999900010012": {
        "name": "Suresh Yadav",
        "dob": "1992-02-28",
        "gender": "M",
        "address": "12, Village Bisrakh, Gautam Buddha Nagar, UP",
        "verified": True,
        "role": "citizen",
    },

    # Heir 2 — daughter (HSA 2005 equal rights demo)
    "999900010013": {
        "name": "Meena Devi",
        "dob": "1995-04-10",
        "gender": "F",
        "address": "Sadarpur Village, Dadri, Gautam Buddha Nagar, UP",
        "verified": True,
        "role": "citizen",
    },

    # ── Tribal (for TribalGuard demo — UP tribal district, not Noida) ─────────
    # Shown as a system capability; Noida itself has no tribal land

    "999900010020": {
        "name": "Ramkali Gond",
        "dob": "1968-08-25",
        "gender": "F",
        "address": "Dudhi Block, Sonbhadra, UP 231208",
        "verified": True,
        "role": "citizen",
        "isScheduledTribe": True,
        "community": "Gond",
    },

    # Non-tribal buyer attempting to buy tribal land (rejection demo)
    "999900010021": {
        "name": "Vikram Chaudhary",
        "dob": "1987-12-03",
        "gender": "M",
        "address": "Civil Lines, Allahabad, UP 211001",
        "verified": True,
        "role": "citizen",
        "isScheduledTribe": False,
    },
}


class AadhaarVerifyRequest(BaseModel):
    aadhaarNumber: str
    otp: Optional[str] = None


def verify_aadhaar(request: AadhaarVerifyRequest, mock: bool) -> dict:
    if mock:
        identity = MOCK_IDENTITIES.get(request.aadhaarNumber)
        if not identity:
            # Unknown number — return a generic verified citizen
            return {
                "verified": True,
                "name": "Unknown User",
                "role": "citizen",
                "hash": _sha256(request.aadhaarNumber),
                "isScheduledTribe": False,
            }
        result = {
            "verified": identity["verified"],
            "name": identity["name"],
            "dob": identity.get("dob"),
            "gender": identity.get("gender"),
            "role": identity.get("role", "citizen"),
            "hash": _sha256(request.aadhaarNumber),
            "isScheduledTribe": identity.get("isScheduledTribe", False),
            "community": identity.get("community"),
            # Officer-specific fields
            "deptEmail": identity.get("deptEmail"),
            "jurisdictionCode": identity.get("jurisdictionCode"),
            "tehsilCode": identity.get("tehsilCode"),
            "circleCode": identity.get("circleCode"),
            "patwariCode": identity.get("patwariCode"),
            "villageCodes": identity.get("villageCodes"),
            "patwariCodes": identity.get("patwariCodes"),
        }
        # Strip None values
        return {k: v for k, v in result.items() if v is not None}

    raise NotImplementedError(
        "Real Aadhaar API not configured. Set ORACLE_MODE=mock or provide UIDAI ASA credentials."
    )
