"""
Indian succession law rule engine.
Determines applicable law and computes heir shares.

Supported laws:
  Hindu Succession Act 1956 (amended 2005)
  Muslim Personal Law (Shariat) Application Act 1937
  Indian Succession Act 1925 (Christian / Parsi / others)
  Tribal Customary Law + Forest Rights Act 2006
"""

from dataclasses import dataclass, field
from typing import List, Optional
from enum import Enum
from fractions import Fraction


class Religion(str, Enum):
    HINDU   = "Hindu"
    MUSLIM  = "Muslim"
    CHRISTIAN = "Christian"
    PARSI   = "Parsi"
    TRIBAL  = "Tribal"
    OTHER   = "Other"


class Gender(str, Enum):
    M = "M"
    F = "F"


@dataclass
class FamilyMember:
    memberId: str
    name: str
    relation: str       # Son | Daughter | Widow | Widower | Mother | Father | Grandson | etc.
    gender: Gender
    dob: str
    isAlive: bool
    isAdult: bool
    isNri: bool = False
    religion: Religion = Religion.HINDU
    legalNote: Optional[str] = None
    share: Optional[str] = None
    shareDecimal: float = 0.0


@dataclass
class ComputationResult:
    applicableLaw: str
    heirs: List[FamilyMember]
    legalNotes: List[str]
    edgeCases: List[str]
    confidence: float
    computationTrace: List[str]


# ─── HSA 2005 (Mitakshara — Class I heirs) ────────────────────────────────────
# Class I: Son, Daughter, Widow, Mother (all take equally from the first share)
# After 2005 amendment: daughter = coparcener by birth = equal to son

CLASS_I_HSA = {"Son", "Daughter", "Widow", "Mother"}
CLASS_II_HSA = {"Father", "Son's Son", "Son's Daughter", "Daughter's Son", "Daughter's Daughter",
                "Brother", "Sister"}

def compute_hsa(members: List[FamilyMember], date_of_death: str) -> ComputationResult:
    trace = ["Applicable law: Hindu Succession Act 1956 (amended 2005)"]
    notes = []
    edge_cases = []

    alive = [m for m in members if m.isAlive and m.relation in CLASS_I_HSA]

    if not alive:
        # Fall to Class II
        alive = [m for m in members if m.isAlive and m.relation in CLASS_II_HSA]
        trace.append("No Class I heirs alive — falling to Class II heirs")

    # HSA 2005 S.6(3): daughters = sons (coparceners by birth)
    # Death after 9 Sept 2005 → all daughters get equal share regardless of prior law
    daughters = [m for m in alive if m.relation == "Daughter"]
    sons = [m for m in alive if m.relation == "Son"]

    if daughters:
        notes.append(
            "Hindu Succession (Amendment) Act 2005, Section 6(3): Daughters are coparceners "
            "by birth and have the same rights as sons in Mitakshara coparcenary property."
        )
        # Enforce equal share — no differentiation by gender
        for d in daughters:
            if d.share != next((s.share for s in sons), d.share):
                edge_cases.append(
                    f"HSA2005_ENFORCED: Daughter {d.name}'s share upgraded to equal sons' share"
                )

    if not alive:
        trace.append("No heirs identified — estate goes to government (bona vacantia)")
        return ComputationResult(
            applicableLaw="Hindu Succession Act 1956/2005",
            heirs=[],
            legalNotes=notes,
            edgeCases=["NO_HEIRS: Property escheats to state"],
            confidence=0.99,
            computationTrace=trace,
        )

    n = len(alive)
    base = Fraction(1, n)
    for m in alive:
        m.share = str(base)
        m.shareDecimal = float(base)

    trace.append(f"{n} Class I heir(s) — equal shares of {base} each")

    # NRI flag
    nri_heirs = [m for m in alive if m.isNri]
    if nri_heirs:
        edge_cases.append(
            f"NRI_FEMA: {', '.join(h.name for h in nri_heirs)} are NRIs — "
            "FEMA 1999 compliance required before repatriation of proceeds"
        )

    return ComputationResult(
        applicableLaw="Hindu Succession Act 1956/2005",
        heirs=alive,
        legalNotes=notes,
        edgeCases=edge_cases,
        confidence=0.97 if not edge_cases else 0.88,
        computationTrace=trace,
    )


# ─── Muslim Personal Law (Sunni Hanafi — most common in Maharashtra) ──────────

def compute_muslim(members: List[FamilyMember]) -> ComputationResult:
    trace = ["Applicable law: Muslim Personal Law (Shariat) Application Act 1937 — Sunni Hanafi"]
    notes = [
        "Under Muslim personal law, daughters receive half the share of sons (2:1 ratio). "
        "Widow receives 1/8 if children exist, 1/4 if no children."
    ]

    alive = [m for m in members if m.isAlive]
    sons = [m for m in alive if m.relation == "Son"]
    daughters = [m for m in alive if m.relation == "Daughter"]
    widows = [m for m in alive if m.relation == "Widow"]

    # Simplified Hanafi computation: each son = 2 daughters' shares
    # Total units = 2×sons + 1×daughters
    son_units = 2 * len(sons)
    daughter_units = len(daughters)
    total_units = son_units + daughter_units

    residue = Fraction(1, 1)
    if widows:
        widow_share = Fraction(1, 8) if (sons or daughters) else Fraction(1, 4)
        for w in widows:
            w.share = str(widow_share / len(widows))
            w.shareDecimal = float(widow_share / len(widows))
        residue -= widow_share
        trace.append(f"Widow(s) take {widow_share} — residue {residue}")

    if total_units > 0:
        unit = residue / total_units
        for s in sons:
            s.share = str(unit * 2)
            s.shareDecimal = float(unit * 2)
        for d in daughters:
            d.share = str(unit)
            d.shareDecimal = float(unit)
        trace.append(f"Sons: {unit*2} each, Daughters: {unit} each (2:1 ratio)")

    heirs = sons + daughters + widows
    return ComputationResult(
        applicableLaw="Muslim Personal Law (Shariat) Application Act 1937",
        heirs=heirs,
        legalNotes=notes,
        edgeCases=[],
        confidence=0.92,
        computationTrace=trace,
    )


# ─── Indian Succession Act 1925 (Christian / Parsi / others) ─────────────────

def compute_indian_succession(members: List[FamilyMember]) -> ComputationResult:
    trace = ["Applicable law: Indian Succession Act 1925 (s.33 — intestate succession)"]
    alive = [m for m in members if m.isAlive and m.relation in {"Son", "Daughter", "Widow", "Mother"}]
    n = len(alive)
    if n:
        for m in alive:
            m.share = str(Fraction(1, n))
            m.shareDecimal = float(Fraction(1, n))
    return ComputationResult(
        applicableLaw="Indian Succession Act 1925",
        heirs=alive,
        legalNotes=["Equal shares among all surviving heirs under ISA 1925."],
        edgeCases=[],
        confidence=0.90,
        computationTrace=trace,
    )


# ─── Tribal Customary Law ─────────────────────────────────────────────────────

def compute_tribal(members: List[FamilyMember]) -> ComputationResult:
    trace = ["Applicable law: Tribal Customary Law + Forest Rights Act 2006"]
    notes = [
        "Tribal succession follows community customary law recognised under Article 13(3)(a). "
        "FRA 2006 S.4(5): forest rights vest in the community — individual transfer requires Gram Sabha approval."
    ]
    alive = [m for m in members if m.isAlive]
    # Simplified: equal shares within household (tribal custom varies by community)
    n = len(alive)
    if n:
        for m in alive:
            m.share = str(Fraction(1, n))
            m.shareDecimal = float(Fraction(1, n))
    return ComputationResult(
        applicableLaw="Tribal Customary Law + Forest Rights Act 2006",
        heirs=alive,
        legalNotes=notes,
        edgeCases=["GRAM_SABHA_REQUIRED: succession must be ratified by village Gram Sabha"],
        confidence=0.82,
        computationTrace=trace,
    )


# ─── Dispatcher ───────────────────────────────────────────────────────────────

def compute_succession(
    members: List[FamilyMember],
    religion: Religion,
    date_of_death: str,
    is_tribal: bool = False,
) -> ComputationResult:
    if is_tribal:
        return compute_tribal(members)
    if religion == Religion.HINDU:
        return compute_hsa(members, date_of_death)
    if religion == Religion.MUSLIM:
        return compute_muslim(members)
    return compute_indian_succession(members)
