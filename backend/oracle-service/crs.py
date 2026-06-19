"""
Civil Registration System (CRS) Oracle
Verifies death certificates from crsorgi.gov.in.
In mock mode: returns pre-scripted Ramesh Patil death certificate for demo Scene 3.
"""

from pydantic import BaseModel
from typing import Optional


MOCK_DEATH_CERTS = {
    # Ramesh Patil — Demo Scene 3
    "CRS-NSK-2026-00541": {
        "registrationNo": "CRS-NSK-2026-00541",
        "deceasedName": "Ramesh Dattatray Patil",
        "fatherName": "Dattatray Vishwanath Patil",
        "dateOfDeath": "2026-05-20",
        "placeOfDeath": "Sinnar Primary Health Centre, Nashik",
        "causeOfDeath": "Cardiac Arrest",
        "aadhaarHash": "sha256:a3f8e2d1c7b4a09f6e5d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a",
        "registeredAt": "2026-05-21T10:30:00Z",
        "registeredBy": "Sinnar Gram Panchayat",
        "ipfsCID": "QmDeathCertRamesh2026",
        "verified": True,
    },
}


class CRSVerifyRequest(BaseModel):
    registrationNo: str
    deceasedAadhaarHash: Optional[str] = None


def verify_death_certificate(request: CRSVerifyRequest, mock: bool) -> dict:
    if mock:
        cert = MOCK_DEATH_CERTS.get(request.registrationNo)
        if not cert:
            return {"verified": False, "error": f"Death certificate {request.registrationNo} not found"}
        # Optionally cross-check Aadhaar hash
        if request.deceasedAadhaarHash and cert["aadhaarHash"] != request.deceasedAadhaarHash:
            return {"verified": False, "error": "Aadhaar hash mismatch on death certificate"}
        return cert
    else:
        raise NotImplementedError("Real CRS API not yet configured. Set ORACLE_MODE=mock.")
