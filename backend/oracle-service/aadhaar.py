"""
Aadhaar Oracle — verifies Aadhaar numbers and returns SHA-256 hashes.
In mock mode: returns pre-scripted identity data for demo personas.
In real mode: calls UIDAI sandbox/production API.
"""

import hashlib
import os
from typing import Optional
from pydantic import BaseModel

MOCK_IDENTITIES = {
    # Ramesh Patil (parcel owner — demo Scene 2, 3)
    "123456789012": {
        "name": "Ramesh Dattatray Patil",
        "dob": "1960-04-15",
        "gender": "M",
        "address": "Sinnar, Nashik, Maharashtra 422103",
        "verified": True,
        "hash": "sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a",
    },
    # Suresh Deshmukh (buyer — demo Scene 4)
    "234567890123": {
        "name": "Suresh Balaji Deshmukh",
        "dob": "1978-09-22",
        "gender": "M",
        "address": "Nashik City, Nashik, Maharashtra 422001",
        "verified": True,
        "hash": "sha256:buyer1suresh9d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0",
    },
    # Arun Patil (heir 1 — demo Scene 3)
    "345678901234": {
        "name": "Arun Ramesh Patil",
        "dob": "1988-03-15",
        "gender": "M",
        "address": "Sinnar, Nashik, Maharashtra 422103",
        "verified": True,
        "hash": "sha256:heir1arun3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8",
    },
    # Vijay Patil (heir 2 — demo Scene 3)
    "456789012345": {
        "name": "Vijay Ramesh Patil",
        "dob": "1991-07-22",
        "gender": "M",
        "address": "Pune, Maharashtra 411001",
        "verified": True,
        "hash": "sha256:heir2vijay8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7",
    },
    # Sunita Patil (heir 3 — daughter with HSA 2005 rights)
    "567890123456": {
        "name": "Sunita Ramesh Patil",
        "dob": "1994-11-08",
        "gender": "F",
        "address": "Mumbai, Maharashtra 400001",
        "verified": True,
        "hash": "sha256:heir3sunita1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5",
    },
    # Mangal Bhil (tribal owner — demo Scene 6)
    "678901234567": {
        "name": "Mangal Ramji Bhil",
        "dob": "1972-06-10",
        "gender": "M",
        "address": "Igatpuri, Nashik, Maharashtra 422403",
        "verified": True,
        "isScheduledTribe": True,
        "community": "Bhil",
        "hash": "sha256:b4g9f3d2c8e1a7f0e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a",
    },
    # Non-tribal buyer (for Scene 6 rejection demo)
    "789012345678": {
        "name": "Rahul Shinde",
        "dob": "1985-02-14",
        "gender": "M",
        "address": "Nashik City, Maharashtra 422001",
        "verified": True,
        "isScheduledTribe": False,
        "hash": "sha256:nontribal1rahulshinde2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2",
    },
    # Revenue officer
    "890123456789": {
        "name": "Prakash Nana Kulkarni",
        "dob": "1975-08-30",
        "gender": "M",
        "address": "Sinnar Tehsil Office, Nashik",
        "verified": True,
        "role": "Circle Officer",
        "hash": "sha256:officer1prakash0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7",
    },
}


class AadhaarVerifyRequest(BaseModel):
    aadhaarNumber: str
    otp: Optional[str] = None  # Not used in mock


def _sha256(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode()).hexdigest()


def verify_aadhaar(request: AadhaarVerifyRequest, mock: bool) -> dict:
    if mock:
        identity = MOCK_IDENTITIES.get(request.aadhaarNumber)
        if not identity:
            # Generate deterministic hash for any unknown number
            return {
                "verified": True,
                "name": "Test User",
                "hash": _sha256(request.aadhaarNumber),
                "isScheduledTribe": False,
            }
        return {
            "verified": identity["verified"],
            "name": identity["name"],
            "dob": identity.get("dob"),
            "gender": identity.get("gender"),
            "hash": identity["hash"],
            "isScheduledTribe": identity.get("isScheduledTribe", False),
            "community": identity.get("community"),
        }
    else:
        # Real UIDAI API call — implement when keys available
        raise NotImplementedError("Real Aadhaar API not yet configured. Set ORACLE_MODE=mock.")
