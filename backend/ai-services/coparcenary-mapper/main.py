"""
CoparcenaryMapper AI Service  —  port 8011

Endpoints:
  POST /coparcenary/compute          — given familyId + death → compute heir shares
  GET  /coparcenary/family/:familyId — return full family tree data
  GET  /health
"""

import json
import os
import uuid
from pathlib import Path
from typing import Optional, List
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from laws import (
    FamilyMember, Gender, Religion,
    compute_succession, ComputationResult,
)

MOCK = os.getenv("COPARCENARY_MODE", "mock") == "mock"

# Load synthetic family data generated on Day 1
DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "family-trees" / "nashik_families.json"
_FAMILIES: list = []

def _load_families():
    global _FAMILIES
    if _FAMILIES:
        return
    try:
        with open(DATA_PATH) as f:
            _FAMILIES = json.load(f)
    except FileNotFoundError:
        _FAMILIES = []

app = FastAPI(
    title="BhumiChain CoparcenaryMapper AI",
    description="Rule engine for Indian succession law — HSA 2005, Muslim, Christian, Tribal.",
    version="1.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    _load_families()


@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock" if MOCK else "real", "familiesLoaded": len(_FAMILIES)}


# ─── POST /coparcenary/compute ────────────────────────────────────────────────

class ComputeRequest(BaseModel):
    dlpiId: str
    familyId: str
    deceasedName: str
    dateOfDeath: str
    religion: Optional[str] = "Hindu"
    isTribal: Optional[bool] = False
    # Optional: caller can provide member list; otherwise loaded from family store
    members: Optional[List[dict]] = None


class ComputeResponse(BaseModel):
    computationId: str
    familyId: str
    dlpiId: str
    applicableLaw: str
    heirs: List[dict]
    minorHeirs: List[dict]
    legalNotes: List[str]
    edgeCases: List[str]
    aiConfidenceScore: float
    computationTrace: List[str]
    aiComputationCID: str   # mock IPFS CID of this computation log


@app.post("/coparcenary/compute", response_model=ComputeResponse)
def compute(req: ComputeRequest):
    # Resolve family members
    raw_members = req.members
    if not raw_members:
        family = _get_family(req.familyId)
        if not family:
            raise HTTPException(status_code=404, detail=f"Family {req.familyId} not found")
        raw_members = family.get("members", [])

    members = [_to_member(m) for m in raw_members]
    religion = Religion(req.religion or "Hindu")

    result: ComputationResult = compute_succession(
        members=members,
        religion=religion,
        date_of_death=req.dateOfDeath,
        is_tribal=req.isTribal or False,
    )

    adult_heirs = [m for m in result.heirs if m.isAdult]
    minor_heirs = [m for m in result.heirs if not m.isAdult]

    computation_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
    mock_cid = f"QmCoparcenary{computation_id}"

    return ComputeResponse(
        computationId=computation_id,
        familyId=req.familyId,
        dlpiId=req.dlpiId,
        applicableLaw=result.applicableLaw,
        heirs=[_heir_dict(h) for h in adult_heirs],
        minorHeirs=[_heir_dict(h) for h in minor_heirs],
        legalNotes=result.legalNotes,
        edgeCases=result.edgeCases,
        aiConfidenceScore=result.confidence,
        computationTrace=result.computationTrace,
        aiComputationCID=mock_cid,
    )


# ─── GET /coparcenary/family/:familyId ───────────────────────────────────────

@app.get("/coparcenary/family/{family_id}")
def get_family(family_id: str):
    family = _get_family(family_id)
    if not family:
        raise HTTPException(status_code=404, detail=f"Family {family_id} not found")
    return family


@app.get("/coparcenary/families")
def list_families(limit: int = 20):
    _load_families()
    return _FAMILIES[:limit]


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _get_family(family_id: str) -> Optional[dict]:
    _load_families()
    for f in _FAMILIES:
        if f.get("familyId") == family_id:
            return f
    return None


def _to_member(raw: dict) -> FamilyMember:
    return FamilyMember(
        memberId=raw.get("memberId", str(uuid.uuid4())),
        name=raw.get("name", "Unknown"),
        relation=raw.get("relation", "Son"),
        gender=Gender(raw.get("gender", "M")),
        dob=raw.get("dob", "1980-01-01"),
        isAlive=raw.get("isAlive", True),
        isAdult=raw.get("isAdult", True),
        isNri=raw.get("isNri", False),
        legalNote=raw.get("legalNote"),
        share=raw.get("share"),
        shareDecimal=raw.get("shareDecimal", 0.0),
    )


def _heir_dict(m: FamilyMember) -> dict:
    return {
        "heirId": m.memberId,
        "name": m.name,
        "relation": m.relation,
        "gender": m.gender.value,
        "dob": m.dob,
        "isAlive": m.isAlive,
        "isAdult": m.isAdult,
        "isNri": m.isNri,
        "share": m.share,
        "shareDecimal": m.shareDecimal,
        "legalNote": m.legalNote,
        "hasConsented": False,
        "hasObjected": False,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8011))
    print(f"\n⚖️  BhumiChain CoparcenaryMapper AI")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL'}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
