"""
CoparcenaryMapper AI Service  —  port 8011

Endpoints:
  POST /coparcenary/compute          — death cert path: compute heir shares
  POST /coparcenary/validate-plan    — validate a pre-registered InheritancePlan
                                        (checks intended shares against applicable law)
  POST /coparcenary/compute-alive    — alive transfer: verify recipient list is valid
  GET  /coparcenary/family/:familyId — return full family tree data
  GET  /health

All three trigger modes route through this service before calling uttaradhikar chaincode:

  OWNER_ALIVE     → /compute-alive   (no death, just validate recipients)
  DEATH_CERT      → /compute         (standard CRS-verified death)
  HEIR_PETITION   → /compute         (with deathSource="AFFIDAVIT")

The oracle listens for Fabric events:
  HeirNotificationRequired    → queue SMS/WhatsApp/Push notifications
  AllHeirsConsentedAutoMutation → write INHERITANCE mutation via mutation-manager
"""

import json
import os
import uuid
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from laws import (
    FamilyMember, Gender, Religion, MuslimSchool,
    compute_succession, ComputationResult,
)

MOCK = os.getenv("COPARCENARY_MODE", "mock") == "mock"

# Family data path — updated for Noida personas
DATA_PATH = Path(__file__).parent.parent.parent.parent / "data" / "family-trees" / "noida_families.json"
_FAMILIES: list = []


def _load_families():
    global _FAMILIES
    if _FAMILIES:
        return
    try:
        with open(DATA_PATH) as f:
            _FAMILIES = json.load(f)
    except FileNotFoundError:
        # Fall back to nashik file (legacy)
        fallback = DATA_PATH.parent / "nashik_families.json"
        try:
            with open(fallback) as f:
                _FAMILIES = json.load(f)
        except FileNotFoundError:
            _FAMILIES = []


app = FastAPI(
    title="BhumiChain CoparcenaryMapper AI",
    description=(
        "Rule engine for Indian succession law — "
        "HSA 2005, Muslim (Sunni/Shia), Christian (ISA), Parsi (ISA), Tribal. "
        "Supports all three inheritance trigger modes: "
        "OWNER_ALIVE (gift), DEATH_CERT (standard), HEIR_PETITION (affidavit)."
    ),
    version="2.0.0",
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
def startup():
    _load_families()


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "mock" if MOCK else "real",
        "familiesLoaded": len(_FAMILIES),
        "lawsSupported": [
            "Hindu_Succession_Act_1956",
            "Muslim_Personal_Law_Sunni",
            "Muslim_Personal_Law_Shia",
            "Indian_Succession_Act_1925_Christian",
            "Indian_Succession_Act_1925_Parsi",
            "Tribal_Customary_Law",
            "Special_Marriage_Act_1954",
        ],
    }


# ─── POST /coparcenary/compute — Death-triggered succession ────────────────────
# Used for: DEATH_CERT trigger and HEIR_PETITION trigger (deathSource tells the difference)

class ComputeRequest(BaseModel):
    dlpiId: str
    familyId: str
    deceasedName: str
    deceasedHash: str
    dateOfDeath: str
    religion: str = "Hindu"
    muslimSchool: str = "Sunni"    # "Sunni" | "Shia"
    isTribal: bool = False
    deathSource: str = "DEATH_CERT"  # "DEATH_CERT" | "AFFIDAVIT"
    # Optional: caller can provide member list directly; otherwise loaded from family store
    members: Optional[list[dict]] = None


class ComputeResponse(BaseModel):
    computationId: str
    familyId: str
    dlpiId: str
    applicableLaw: str
    legalSection: str
    heirs: list[dict]
    minorHeirs: list[dict]
    legalNotes: list[str]
    warnings: list[str]
    edgeCases: list[str]
    aiConfidenceScore: float
    computationTrace: list[str]
    aiComputationCID: str


@app.post("/coparcenary/compute", response_model=ComputeResponse)
def compute(req: ComputeRequest):
    """
    Main computation endpoint.
    Called by oracle when a death-triggered succession needs heir computation.

    For HEIR_PETITION (deathSource=AFFIDAVIT): confidence is reduced by 0.05
    to account for unverified death (no CRS oracle confirmation).
    """
    raw_members = req.members
    if not raw_members:
        family = _get_family(req.familyId)
        if not family:
            raise HTTPException(status_code=404, detail=f"Family {req.familyId} not found")
        raw_members = family.get("members", [])

    members = [_to_member(m) for m in raw_members]
    religion = _parse_religion(req.religion)
    school   = MuslimSchool.SHIA if req.muslimSchool == "Shia" else MuslimSchool.SUNNI

    result = compute_succession(
        members=members,
        religion=religion,
        date_of_death=req.dateOfDeath,
        is_tribal=req.isTribal,
        muslim_school=school,
    )

    # Reduce confidence for affidavit-only death (no CRS verification)
    confidence = result.confidence
    if req.deathSource == "AFFIDAVIT":
        confidence = max(confidence - 0.05, 0.50)
        result.warnings.append(
            "AFFIDAVIT_DEATH: Death confirmed by affidavit only (no CRS registration). "
            "Confidence reduced by 0.05. CRS registration recommended within 21 days of death "
            "(Registration of Births and Deaths Act 1969 S.8)."
        )

    adult_heirs = [m for m in result.heirs if m.isAdult]
    minor_heirs = [m for m in result.heirs if not m.isAdult]

    computation_id = f"CMP-{uuid.uuid4().hex[:8].upper()}"
    cid = f"QmCoparcenary{computation_id}" if MOCK else f"Qm{computation_id}"

    return ComputeResponse(
        computationId=computation_id,
        familyId=req.familyId,
        dlpiId=req.dlpiId,
        applicableLaw=result.applicableLaw,
        legalSection=result.legalSection,
        heirs=[_heir_dict(h) for h in adult_heirs],
        minorHeirs=[_heir_dict(h) for h in minor_heirs],
        legalNotes=result.legalNotes,
        warnings=result.warnings,
        edgeCases=result.edgeCases,
        aiConfidenceScore=confidence,
        computationTrace=result.computationTrace,
        aiComputationCID=cid,
    )


# ─── POST /coparcenary/validate-plan — InheritancePlan pre-validation ──────────
# Called when owner registers an InheritancePlan to check if their intended
# shares are legally valid under their religion's rules.
# Returns warnings (non-blocking) and errors (blocking).

class PlanValidationRequest(BaseModel):
    dlpiId: str
    ownerName: str
    religion: str = "Hindu"
    muslimSchool: str = "Sunni"
    isTribal: bool = False
    plannedHeirs: list[dict]       # same format as PlannedHeir in uttaradhikar.go

class PlanValidationResponse(BaseModel):
    isValid: bool
    errors: list[str]             # blocking violations (plan should be REJECTED)
    warnings: list[str]           # advisory (plan allowed but officer should review)
    legalNotes: list[str]
    applicableLaw: str


@app.post("/coparcenary/validate-plan", response_model=PlanValidationResponse)
def validate_plan(req: PlanValidationRequest):
    """
    Validates a pre-registered InheritancePlan against the applicable inheritance law.

    For example:
      A Hindu owner who gives 0 share to daughter → ERROR (HSA 2005 S.6(3) violation)
      A Muslim owner who gives wife 1/5 (> 1/4 with children) → WARNING
      A Hindu owner who tries to will everything to one son → WARNING

    Does NOT block the plan registration by itself — the chaincode has its own
    share-sum validation. This endpoint returns advisory data shown to the owner.
    """
    religion = _parse_religion(req.religion)
    school   = MuslimSchool.SHIA if req.muslimSchool == "Shia" else MuslimSchool.SUNNI

    # Convert planned heirs to FamilyMember objects with intended shares
    members = []
    for ph in req.plannedHeirs:
        m = FamilyMember(
            memberId=ph.get("aadhaarHash", str(uuid.uuid4()))[:12],
            name=ph.get("name", ""),
            relation=ph.get("relation", "Son"),
            gender=Gender.F if ph.get("gender", "M") == "F" else Gender.M,
            dob=ph.get("dob", "1980-01-01"),
            isAlive=True,
            isAdult=not ph.get("isMinor", False),
            isNri=ph.get("isNri", False),
        )
        # Set share from intended share
        m.share = ph.get("intendedShare", "0")
        m.shareDecimal = float(ph.get("intendedShareDec", 0.0))
        members.append(m)

    # Run the law engine with intended shares
    result = compute_succession(
        members=members,
        religion=religion,
        date_of_death="2099-01-01",   # owner alive — future date triggers no special rules
        is_tribal=req.isTribal,
        muslim_school=school,
    )

    # Compare intended shares with what law mandates
    errors = []
    warnings = []

    if religion in (Religion.HINDU, Religion.SIKH, Religion.BUDDHIST, Religion.JAIN):
        errors += _check_hsa_plan_violations(members)
    elif religion == Religion.MUSLIM:
        warnings += _check_muslim_plan_warnings(members, school)

    return PlanValidationResponse(
        isValid=len(errors) == 0,
        errors=errors,
        warnings=warnings + result.warnings,
        legalNotes=result.legalNotes,
        applicableLaw=result.applicableLaw,
    )


def _check_hsa_plan_violations(members: list[FamilyMember]) -> list[str]:
    errors = []
    sons      = [m for m in members if m.relation == "Son"]
    daughters = [m for m in members if m.relation == "Daughter"]
    if sons and daughters:
        avg_son = sum(m.shareDecimal for m in sons) / len(sons)
        avg_dau = sum(m.shareDecimal for m in daughters) / len(daughters)
        if abs(avg_son - avg_dau) > 0.001:
            errors.append(
                f"HSA2005_VIOLATION: Daughters' per-capita share ({avg_dau:.4f}) ≠ Sons' ({avg_son:.4f}). "
                "Daughters are coparceners with equal rights under HSA 2005 S.6(3). "
                "This plan cannot exclude or disadvantage daughters relative to sons."
            )
    return errors


def _check_muslim_plan_warnings(members: list[FamilyMember], school: MuslimSchool) -> list[str]:
    warnings = []
    wives   = [m for m in members if m.relation in ("Wife", "Widow")]
    sons    = [m for m in members if m.relation == "Son"]
    daughters = [m for m in members if m.relation == "Daughter"]
    has_children = bool(sons or daughters)
    if wives:
        total_wife = sum(m.shareDecimal for m in wives)
        expected   = 0.125 if has_children else 0.25
        if abs(total_wife - expected) > 0.01:
            warnings.append(
                f"MUSLIM_WIFE_SHARE: Wife/wives intended total {total_wife:.4f}. "
                f"Quranic share = {expected} ({'with' if has_children else 'without'} children). "
                "This will be corrected to the Quranic share at execution."
            )
    wasiyat_heirs = [m for m in members if m.relation in ("Charity", "Friend", "NonHeir")]
    if wasiyat_heirs:
        total_wasiyat = sum(m.shareDecimal for m in wasiyat_heirs)
        if total_wasiyat > 0.333:
            warnings.append(
                f"WASIYAT_EXCEEDED: {total_wasiyat:.4f} allocated to non-heirs. "
                "Bequest to non-heirs cannot exceed 1/3 of estate without all heirs' consent (Quran 2:180)."
            )
    return warnings


# ─── POST /coparcenary/compute-alive — Alive transfer recipient validation ─────
# Called before TriggerAliveTransfer to validate recipient list.
# For gift deed: no law enforcement on shares (owner is giving freely)
# but we warn about potential legal complications.

class AliveTransferRequest(BaseModel):
    dlpiId: str
    ownerName: str
    ownerReligion: str = "Hindu"
    recipients: list[dict]         # [{aadhaarHash, name, relation, finalShare, finalShareDec}]

class AliveTransferResponse(BaseModel):
    isValid: bool
    warnings: list[str]
    legalNotes: list[str]
    stampDutyNote: str


@app.post("/coparcenary/compute-alive", response_model=AliveTransferResponse)
def compute_alive_transfer(req: AliveTransferRequest):
    """
    Validates a proposed alive transfer (gift deed).
    No hard law blocks — owner can gift to anyone.
    Returns warnings if the gift might create legal complications.
    """
    warnings = []
    notes = []
    religion = _parse_religion(req.ownerReligion)

    # Check share sum
    total = sum(r.get("finalShareDec", 0.0) for r in req.recipients)
    if abs(total - 1.0) > 0.001:
        return AliveTransferResponse(
            isValid=False,
            warnings=[f"Recipient shares sum to {total:.4f} — must equal 1.0"],
            legalNotes=[],
            stampDutyNote="",
        )

    # Hindu: warn if daughters are excluded (they have coparcenary rights)
    if religion in (Religion.HINDU, Religion.SIKH, Religion.BUDDHIST, Religion.JAIN):
        has_sons      = any(r.get("relation") == "Son" for r in req.recipients)
        has_daughters = any(r.get("relation") == "Daughter" for r in req.recipients)
        if has_sons and not has_daughters:
            warnings.append(
                "HSA2005_ALERT: Sons are recipients but no daughters are listed. "
                "Daughters may have coparcenary rights. If they object, they can challenge the gift deed. "
                "Consider including daughters or getting their No-Objection Certificate."
            )

    # Muslim: warn about wasiyat limit if non-heirs are recipients
    if religion == Religion.MUSLIM:
        non_heirs_share = sum(
            r.get("finalShareDec", 0.0) for r in req.recipients
            if r.get("relation") not in (
                "Son", "Daughter", "Wife", "Mother", "Father", "Brother", "Sister"
            )
        )
        if non_heirs_share > 0.333:
            warnings.append(
                f"WASIYAT_LIMIT: {non_heirs_share:.2%} going to non-heirs. "
                "Muslim law limits bequest to non-heirs at 1/3 without all heirs' consent."
            )

    # Stamp duty note for UP
    stamp = (
        "Transfer of Property Act 1882 S.122 (Gift Deed) — "
        "UP Stamp Duty: 2% of circle-rate value for gift to blood relatives; "
        "7% for gifts to unrelated persons. Registration compulsory under TPA S.123."
    )

    notes.append(
        "Gift deed is irrevocable once registered (TPA S.126) unless donor reserved right of revocation. "
        "Registration under Registration Act 1908 S.17 is mandatory for immovable property gifts."
    )

    return AliveTransferResponse(
        isValid=True,
        warnings=warnings,
        legalNotes=notes,
        stampDutyNote=stamp,
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

def _parse_religion(s: str) -> Religion:
    mapping = {
        "Hindu": Religion.HINDU,
        "Sikh": Religion.SIKH,
        "Buddhist": Religion.BUDDHIST,
        "Jain": Religion.JAIN,
        "Muslim": Religion.MUSLIM,
        "Muslim_Sunni": Religion.MUSLIM,
        "Muslim_Shia": Religion.MUSLIM,
        "Christian": Religion.CHRISTIAN,
        "Parsi": Religion.PARSI,
        "Tribal": Religion.TRIBAL,
    }
    return mapping.get(s, Religion.HINDU)


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
        isTribal=raw.get("isTribal", False),
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
    print(f"\n⚖️  BhumiChain CoparcenaryMapper AI v2.0")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL'}")
    print(f"   Laws  → HSA 2005 | Muslim Sunni/Shia | Christian ISA | Parsi ISA | Tribal")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
