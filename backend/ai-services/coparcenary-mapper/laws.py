"""
Indian Succession Law Engine — CoparcenaryMapper

Computes legal heir shares for all religions recognised under Indian personal law.

Supported laws
──────────────
  Hindu Succession Act 1956 (amended 2005) — applies to Hindus, Sikhs, Buddhists, Jains
  Muslim Personal Law (Shariat) Application Act 1937
    • Sunni (Hanafi school — majority in UP/Maharashtra/Bengal)
    • Shia / Ithna Ashari (minority; key difference: Radd / return principle)
  Indian Succession Act 1925
    • Christian (S.33 — spouse + descendants)
    • Parsi (separate chapter — widow = equal child share)
  Special Marriage Act 1954 — inter-religious couples → ISA 1925 applies
  Tribal Customary Law + Forest Rights Act 2006

References
──────────
  HSA 1956 as amended by Act 39 of 2005
  Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1 — daughters: rights from birth
  Quran 4:11, 4:12 — mandatory shares (fara'id)
  Tyabji's Muslim Law (4th ed., 1968) — Hanafi rules
  Mulla's Principles of Mahomedan Law — sharers / residuaries
  Indian Succession Act 1925 — Ss. 33, 36–50 (Christians), Ss. 51–56 (Parsi)
  FEMA 1999 S.6(5) — NRI repatriation constraint
  Guardians and Wards Act 1890 / HMGA 1956 — minor heirs
"""

from dataclasses import dataclass, field
from typing import Optional
from fractions import Fraction
from enum import Enum


# ─── Enumerations ─────────────────────────────────────────────────────────────

class Religion(str, Enum):
    HINDU     = "Hindu"
    SIKH      = "Sikh"       # governed by HSA 1956 (included via explanation)
    BUDDHIST  = "Buddhist"   # governed by HSA 1956
    JAIN      = "Jain"       # governed by HSA 1956
    MUSLIM    = "Muslim"
    CHRISTIAN = "Christian"
    PARSI     = "Parsi"
    TRIBAL    = "Tribal"
    OTHER     = "Other"      # → ISA 1925


class MuslimSchool(str, Enum):
    SUNNI = "Sunni"   # Hanafi — most common in India
    SHIA  = "Shia"    # Ithna Ashari (Twelver)


class Gender(str, Enum):
    M = "M"
    F = "F"


# ─── Data Structures ──────────────────────────────────────────────────────────

@dataclass
class FamilyMember:
    memberId: str
    name: str
    relation: str       # Son | Daughter | Wife | Mother | Father | GrandSon |
                        # GrandDaughter | Brother | Sister | Son_Son | Son_Daughter |
                        # Daughter_Son | Daughter_Daughter | etc.
    gender: Gender
    dob: str
    isAlive: bool
    isAdult: bool
    isNri: bool = False
    religion: Religion = Religion.HINDU
    muslimSchool: MuslimSchool = MuslimSchool.SUNNI
    isTribal: bool = False
    legalNote: Optional[str] = None
    share: Optional[str] = None
    shareDecimal: float = 0.0


@dataclass
class ComputationResult:
    applicableLaw: str
    legalSection: str          # e.g. "HSA 1956 S.8 — Class I"
    heirs: list[FamilyMember]
    legalNotes: list[str]
    warnings: list[str]        # non-blocking alerts
    edgeCases: list[str]       # things that might block execution
    confidence: float
    computationTrace: list[str]


# ─── HSA 1956 (Amended 2005) — Hindu, Sikh, Buddhist, Jain ───────────────────
#
# S.8:  Rules of succession for male Hindu dying intestate
# S.10: Distribution of share in Class I
# S.6:  Devolution of coparcenary interest (amended 2005)
#
# Class I heirs (S.8 Schedule): Son, Daughter, Widow, Mother,
#   Son's Son, Son's Daughter, Daughter's Son, Daughter's Daughter,
#   Son's Son's Son, Son's Son's Daughter (and son/daughter of pre-deceased son/daughter)
#
# Key rules:
#   R1: Each living son / daughter / widow takes one equal share.
#       But multiple widows together take ONE share (split among them).
#   R2: Each branch of a pre-deceased son/daughter splits that branch's share.
#   R3: Mother takes one share alongside sons/daughters.
#   HSA 2005: daughters are coparceners by birth — same rights as sons.
#   Vineeta Sharma (2020): daughter's right applies irrespective of father's DOD.

CLASS_I_HSA = frozenset({
    "Son", "Daughter", "Wife", "Widow", "Mother",
    "Son_Son", "Son_Daughter",
    "Daughter_Son", "Daughter_Daughter",
    "Son_Son_Son", "Son_Son_Daughter",
    "PreDeceased_Son_Widow",
    "PreDeceased_Daughter_Son",
    "PreDeceased_Daughter_Daughter",
})

CLASS_II_HSA = frozenset({
    "Father",
    "Grandson_Son_Daughter",            # entry I in Schedule
    "Brother", "Sister",
    "Daughter_Son_Son", "Daughter_Daughter_Son",
    "Brother_Son", "Sister_Son",
    "Father_Father", "Father_Mother",
})


def compute_hsa(members: list[FamilyMember], date_of_death: str) -> ComputationResult:
    trace = [
        "Law: Hindu Succession Act 1956 (amended 2005)",
        f"Date of death: {date_of_death}",
    ]
    notes = []
    warnings = []
    edge_cases = []

    # Filter to alive Class I members
    class1_alive = [m for m in members if m.isAlive and m.relation in CLASS_I_HSA]

    if not class1_alive:
        class2_alive = [m for m in members if m.isAlive and m.relation in CLASS_II_HSA]
        if class2_alive:
            trace.append("No Class I heirs alive — proceeding with Class II (S.8 Rule 1)")
            heirs_pool = class2_alive
            law_section = "HSA 1956 S.8 — Class II"
        else:
            trace.append("No Class I or Class II heirs — estate escheats to state (bona vacantia, S.29)")
            return ComputationResult(
                applicableLaw="Hindu Succession Act 1956/2005",
                legalSection="HSA 1956 S.29 — Bona Vacantia",
                heirs=[],
                legalNotes=notes,
                warnings=warnings,
                edgeCases=["NO_HEIRS: Property escheats to state under HSA 1956 S.29"],
                confidence=0.99,
                computationTrace=trace,
            )
    else:
        heirs_pool = class1_alive
        law_section = "HSA 1956 S.8 — Class I"

    # HSA 2005 daughter amendment note
    daughters = [m for m in heirs_pool if m.relation == "Daughter"]
    sons      = [m for m in heirs_pool if m.relation == "Son"]
    if daughters:
        notes.append(
            "HSA 2005 S.6(3): Daughters are coparceners by birth with same rights as sons. "
            "Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1: right applies regardless of "
            "father's date of death or whether daughter was alive on 09.09.2005."
        )

    # ── S.10 Rule 2: Multiple widows take ONE share collectively ──────────────
    # Sons, daughters, mother each take independent shares.
    # ALL widows together take one share split among them.
    widows    = [m for m in heirs_pool if m.relation in ("Wife", "Widow")]
    non_widow = [m for m in heirs_pool if m.relation not in ("Wife", "Widow")]

    # Number of "share units":
    # Each son, daughter, mother = 1 unit
    # All widows together = 1 unit
    units = len(non_widow) + (1 if widows else 0)
    if units == 0:
        trace.append("Computation error: no share units")
        return ComputationResult(
            applicableLaw="Hindu Succession Act 1956/2005",
            legalSection=law_section,
            heirs=[],
            legalNotes=notes,
            warnings=warnings,
            edgeCases=["COMPUTATION_ERROR"],
            confidence=0.5,
            computationTrace=trace,
        )

    unit_share = Fraction(1, units)
    trace.append(f"Total share units: {units} (widows pooled into 1 unit)")

    for m in non_widow:
        m.share = str(unit_share)
        m.shareDecimal = float(unit_share)

    if widows:
        widow_individual = unit_share / len(widows)
        for w in widows:
            w.share = str(widow_individual)
            w.shareDecimal = float(widow_individual)
        if len(widows) > 1:
            warnings.append(
                f"HSA S.10 Rule 2: {len(widows)} widows together take one share "
                f"(₹ divided equally among them: {widow_individual} each)"
            )

    # ── NRI edge case ─────────────────────────────────────────────────────────
    nri_heirs = [m for m in heirs_pool if m.isNri]
    if nri_heirs:
        edge_cases.append(
            f"NRI_FEMA: {', '.join(h.name for h in nri_heirs)} — "
            "FEMA 1999 S.6(5): repatriation of sale proceeds requires RBI approval. "
            "Form IPI 7 required within 90 days of acquisition."
        )

    # ── Minor heirs ───────────────────────────────────────────────────────────
    minor_heirs = [m for m in heirs_pool if not m.isAdult]
    if minor_heirs:
        edge_cases.append(
            f"MINOR_GUARDIAN: {len(minor_heirs)} minor heir(s). "
            "Guardians and Wards Act 1890 S.8 / HMGA 1956 S.6: "
            "court-appointed guardian required before title mutation. "
            "Property held in trust till majority."
        )

    all_heirs = non_widow + widows
    trace.append(f"Final: {len(all_heirs)} heir(s) identified")

    return ComputationResult(
        applicableLaw="Hindu Succession Act 1956/2005",
        legalSection=law_section,
        heirs=all_heirs,
        legalNotes=notes,
        warnings=warnings,
        edgeCases=edge_cases,
        confidence=0.97 if not warnings else 0.88,
        computationTrace=trace,
    )


# ─── Muslim Personal Law — Sunni (Hanafi) ─────────────────────────────────────
#
# Quran 4:11: "li'dhdhakari mithlu hazzi'l-unthayayn" — son gets 2× daughter
# Sharers (Quranic heirs with fixed fractions):
#   Husband:  1/4 (with children), 1/2 (no children)
#   Wife(s):  1/8 together (with children), 1/4 together (no children)
#   Daughter: 1/2 (sole), 2/3 (multiple, no son)
#   Father:   1/6 (with children), inherits as residuary (with no children)
#   Mother:   1/6 (with children / 2+ brothers), 1/3 otherwise
#
# Residuaries (asaba):
#   After sharers' fractions: son(s) + daughter(s) take rest at 2:1
#
# Wasiyat (bequest by will):
#   Owner can will max 1/3 to NON-heirs. More than 1/3 requires all heirs' consent.

def compute_muslim_sunni(members: list[FamilyMember]) -> ComputationResult:
    trace = ["Law: Muslim Personal Law (Shariat) Application Act 1937 — Hanafi (Sunni)"]
    notes = [
        "Quran 4:11-12: Son gets 2× daughter's share (asaba). "
        "Wife/wives share: 1/8 with children, 1/4 without. "
        "Wasiyat (will bequest) capped at 1/3 to non-heirs.",
    ]
    warnings = []
    edge_cases = []

    alive = [m for m in members if m.isAlive]
    sons      = [m for m in alive if m.relation == "Son"]
    daughters = [m for m in alive if m.relation == "Daughter"]
    wives     = [m for m in alive if m.relation in ("Wife", "Widow")]
    father    = [m for m in alive if m.relation == "Father"]
    mother    = [m for m in alive if m.relation == "Mother"]
    brothers  = [m for m in alive if m.relation == "Brother"]

    has_children = bool(sons or daughters)

    estate = Fraction(1, 1)
    allocated = Fraction(0)
    sharer_assignments: dict[str, Fraction] = {}

    # ── Step 1: Assign fixed Quranic shares (fara'id) ─────────────────────────

    # Wife(s): 1/8 with children, 1/4 without
    if wives:
        wife_total = Fraction(1, 8) if has_children else Fraction(1, 4)
        wife_each  = wife_total / len(wives)
        for w in wives:
            sharer_assignments[w.memberId] = wife_each
        allocated += wife_total
        trace.append(f"Wife(s): {wife_total} total ({'with' if has_children else 'without'} children)")

    # Mother: 1/6 (with children or 2+ brothers), 1/3 otherwise
    if mother:
        if has_children or len(brothers) >= 2:
            mother_share = Fraction(1, 6)
        else:
            mother_share = Fraction(1, 3)
        sharer_assignments[mother[0].memberId] = mother_share
        allocated += mother_share
        trace.append(f"Mother: {mother_share}")

    # Father: 1/6 (with children) — gets residue if no children
    if father:
        if has_children:
            father_share = Fraction(1, 6)
            sharer_assignments[father[0].memberId] = father_share
            allocated += father_share
            trace.append(f"Father: {father_share} (sharer, with children)")
        else:
            # Father as residuary — will take after daughters' shares
            trace.append("Father: will take as residuary (no sons present)")

    # ── Step 2: Daughters as sharers (only when no sons) ──────────────────────
    residue = estate - allocated
    if daughters and not sons:
        if len(daughters) == 1:
            daughter_total = Fraction(1, 2)
        else:
            daughter_total = Fraction(2, 3)

        # But can't exceed residue
        if daughter_total > residue:
            daughter_total = residue
            warnings.append(
                "DAUGHTER_SHARE_REDUCED: Sharers' fractions left insufficient residue for daughters. "
                "Manual review recommended."
            )

        d_each = daughter_total / len(daughters)
        for d in daughters:
            sharer_assignments[d.memberId] = d_each
        allocated += daughter_total
        residue = estate - allocated
        trace.append(f"Daughter(s) as sharers: {daughter_total} total")

        # Remainder goes to father (as residuary / agnate) if present
        if residue > 0 and father:
            existing_father = sharer_assignments.get(father[0].memberId, Fraction(0))
            sharer_assignments[father[0].memberId] = existing_father + residue
            allocated += residue
            residue = Fraction(0)
            trace.append(f"Father takes remaining residue: {residue}")

        # If no father: residue goes to agnatic heirs (uncle, grandfather, etc.)
        # For POC: flag it
        if residue > 0:
            warnings.append(
                f"UNALLOCATED_RESIDUE: {float(residue):.4f} of estate has no agnatic residuary. "
                "Typically passes to paternal grandfather or uncle. Manual computation required."
            )

    # ── Step 3: Sons + daughters as residuaries (asaba) — 2:1 ratio ──────────
    residue = estate - allocated
    if sons:
        # son_units = 2 per son, daughter_units = 1 per daughter
        son_units      = 2 * len(sons)
        daughter_units = len(daughters)
        total_units    = son_units + daughter_units

        if total_units > 0:
            unit = residue / total_units
            for s in sons:
                sharer_assignments[s.memberId] = sharer_assignments.get(s.memberId, Fraction(0)) + unit * 2
            for d in daughters:
                sharer_assignments[d.memberId] = sharer_assignments.get(d.memberId, Fraction(0)) + unit
            trace.append(f"Residue {residue} split at 2:1 among sons/daughters: son unit={unit*2}, daughter unit={unit}")

    # ── Step 4: Apply shares to members ───────────────────────────────────────
    heirs = []
    for m in alive:
        frac = sharer_assignments.get(m.memberId)
        if frac and frac > 0:
            m.share = str(frac)
            m.shareDecimal = float(frac)
            heirs.append(m)

    notes.append(
        "Wasiyat (bequest): Will cannot assign more than 1/3 of estate to non-heirs "
        "without unanimous consent of all heirs (Quran 2:180; Tyabji Muslim Law)."
    )

    # NRI + minor edge cases
    if any(m.isNri for m in heirs):
        edge_cases.append("NRI_FEMA: FEMA 1999 compliance required for NRI heirs")
    if any(not m.isAdult for m in heirs):
        edge_cases.append("MINOR_GUARDIAN: Court-appointed guardian required for minor heirs")

    return ComputationResult(
        applicableLaw="Muslim Personal Law (Shariat) Application Act 1937",
        legalSection="Sunni Hanafi — Sharers (Fara'id) + Residuaries (Asaba)",
        heirs=heirs,
        legalNotes=notes,
        warnings=warnings,
        edgeCases=edge_cases,
        confidence=0.90,
        computationTrace=trace,
    )


# ─── Muslim Personal Law — Shia (Ithna Ashari) ───────────────────────────────
#
# Key differences from Sunni Hanafi:
#   1. Radd (return): surplus after sharers' fractions returns to them, not agnates.
#      So if daughter is sole heir, she takes entire estate (not just 1/2).
#   2. No agnatic residuaries. Agnates (brother, uncle) excluded if even a
#      distant cognate exists.
#   3. Husband: 1/4 with children, 1/2 without (same as Sunni).
#   4. Wife: 1/8 with children, 1/4 without (same as Sunni).
#   5. Daughter sole: gets entire estate via Radd.

def compute_muslim_shia(members: list[FamilyMember]) -> ComputationResult:
    trace = ["Law: Muslim Personal Law (Shariat) Application Act 1937 — Ithna Ashari (Shia)"]
    notes = [
        "Shia law (Ithna Ashari): Radd principle — surplus after Quranic shares returns "
        "to heirs proportionally (not to agnates). "
        "Daughter as sole heir takes entire estate via Radd.",
    ]
    warnings = [
        "SHIA_LAW: Shia succession is complex. Automated computation is indicative. "
        "Verification by a qualified Islamic jurist (qazi) is strongly recommended.",
    ]
    edge_cases = []

    alive = [m for m in members if m.isAlive]
    sons      = [m for m in alive if m.relation == "Son"]
    daughters = [m for m in alive if m.relation == "Daughter"]
    wives     = [m for m in alive if m.relation in ("Wife", "Widow")]
    father    = [m for m in alive if m.relation == "Father"]
    mother    = [m for m in alive if m.relation == "Mother"]

    has_children = bool(sons or daughters)
    estate = Fraction(1, 1)
    allocated = Fraction(0)
    sharer_assignments: dict[str, Fraction] = {}

    # Step 1: Fixed shares (same as Sunni)
    if wives:
        wife_total = Fraction(1, 8) if has_children else Fraction(1, 4)
        wife_each  = wife_total / len(wives)
        for w in wives:
            sharer_assignments[w.memberId] = wife_each
        allocated += wife_total

    if mother:
        m_share = Fraction(1, 6) if has_children else Fraction(1, 3)
        sharer_assignments[mother[0].memberId] = m_share
        allocated += m_share

    if father:
        if has_children:
            sharer_assignments[father[0].memberId] = Fraction(1, 6)
            allocated += Fraction(1, 6)

    # Step 2: Daughters as sharers
    residue = estate - allocated
    if daughters and not sons:
        if len(daughters) == 1:
            daughter_base = Fraction(1, 2)
        else:
            daughter_base = Fraction(2, 3)
        d_each = daughter_base / len(daughters)
        for d in daughters:
            sharer_assignments[d.memberId] = d_each
        allocated += daughter_base
        residue = estate - allocated

        # Radd: return surplus proportionally to sharers (excluding husband/wife under Shia Radd rules)
        radd_recipients = [m for m in alive if m.memberId in sharer_assignments
                           and m.relation not in ("Wife", "Widow", "Husband")]
        if residue > 0 and radd_recipients:
            radd_total = sum(sharer_assignments[m.memberId] for m in radd_recipients)
            for m in radd_recipients:
                radd_addition = residue * (sharer_assignments[m.memberId] / radd_total)
                sharer_assignments[m.memberId] += radd_addition
            trace.append(f"Radd applied: {residue} returned proportionally to non-spouse sharers")
            allocated = estate

    # Step 3: Sons + daughters as residuaries (2:1 ratio, same as Sunni)
    residue = estate - allocated
    if sons and residue > 0:
        son_units      = 2 * len(sons)
        daughter_units = len(daughters)
        total_units    = son_units + daughter_units
        if total_units > 0:
            unit = residue / total_units
            for s in sons:
                sharer_assignments[s.memberId] = sharer_assignments.get(s.memberId, Fraction(0)) + unit * 2
            for d in daughters:
                sharer_assignments[d.memberId] = sharer_assignments.get(d.memberId, Fraction(0)) + unit

    heirs = []
    for m in alive:
        frac = sharer_assignments.get(m.memberId)
        if frac and frac > 0:
            m.share = str(frac)
            m.shareDecimal = float(frac)
            heirs.append(m)

    if any(m.isNri for m in heirs):
        edge_cases.append("NRI_FEMA: FEMA 1999 compliance required for NRI heirs")
    if any(not m.isAdult for m in heirs):
        edge_cases.append("MINOR_GUARDIAN: Court-appointed guardian required for minor heirs")

    return ComputationResult(
        applicableLaw="Muslim Personal Law (Shariat) Application Act 1937",
        legalSection="Shia Ithna Ashari — Sharers + Radd",
        heirs=heirs,
        legalNotes=notes,
        warnings=warnings,
        edgeCases=edge_cases,
        confidence=0.82,
        computationTrace=trace,
    )


# ─── Indian Succession Act 1925 — Christian (S.33) ───────────────────────────
#
# S.33:  Spouse + lineal descendants: spouse gets 1/3, lineal descendants get 2/3
# S.33A: Only spouse (no lineal descendants, no kindred): spouse gets all
# S.34:  Equal distribution among lineal descendants irrespective of gender
# S.36:  Kindred (brother, sister, etc.) if no spouse or lineal descendants

def compute_christian_isa(members: list[FamilyMember]) -> ComputationResult:
    trace = ["Law: Indian Succession Act 1925 — Part V (Christians)"]
    notes = []
    warnings: list[str] = []
    edge_cases: list[str] = []

    alive = [m for m in members if m.isAlive]
    spouses     = [m for m in alive if m.relation in ("Wife", "Husband", "Widow", "Widower")]
    lineal_desc = [m for m in alive if m.relation in ("Son", "Daughter", "Grandson",
                                                        "Granddaughter", "Son_Son",
                                                        "Son_Daughter", "Daughter_Son",
                                                        "Daughter_Daughter")]
    kindred     = [m for m in alive if m.relation in ("Brother", "Sister", "Father", "Mother")]

    sharer_assignments: dict[str, Fraction] = {}

    if spouses and lineal_desc:
        # S.33: spouse 1/3, lineal descendants 2/3 (equally among them)
        spouse_share = Fraction(1, 3)
        for sp in spouses:
            sharer_assignments[sp.memberId] = spouse_share / len(spouses)
        desc_share_each = Fraction(2, 3) / len(lineal_desc)
        for d in lineal_desc:
            sharer_assignments[d.memberId] = desc_share_each
        notes.append("ISA 1925 S.33: Spouse gets 1/3; lineal descendants share 2/3 equally.")
        trace.append("S.33 applied: spouse 1/3, descendants 2/3")

    elif spouses and not lineal_desc:
        # Check for kindred
        if kindred:
            # S.33A: spouse gets 1/2 if no lineal descendants but kindred exist
            for sp in spouses:
                sharer_assignments[sp.memberId] = Fraction(1, 2) / len(spouses)
            kindred_each = Fraction(1, 2) / len(kindred)
            for k in kindred:
                sharer_assignments[k.memberId] = kindred_each
            notes.append("ISA 1925 S.33A: No lineal descendants — spouse 1/2, kindred 1/2.")
            trace.append("S.33A applied: spouse 1/2, kindred 1/2")
        else:
            # S.33A: spouse takes all
            for sp in spouses:
                sharer_assignments[sp.memberId] = Fraction(1, 1) / len(spouses)
            notes.append("ISA 1925 S.33A: No lineal descendants or kindred — spouse takes entire estate.")
            trace.append("S.33A applied: spouse takes all")

    elif lineal_desc and not spouses:
        # S.34: lineal descendants take equally
        each = Fraction(1, len(lineal_desc))
        for d in lineal_desc:
            sharer_assignments[d.memberId] = each
        notes.append("ISA 1925 S.34: Equal shares among all lineal descendants (no gender distinction).")
        trace.append(f"S.34 applied: {len(lineal_desc)} descendants equally")

    elif kindred and not spouses and not lineal_desc:
        # S.36: kindred inherits
        each = Fraction(1, len(kindred))
        for k in kindred:
            sharer_assignments[k.memberId] = each
        trace.append("S.36 applied: kindred inherits")

    else:
        edge_cases.append("NO_HEIRS: Estate escheats to government")

    heirs = []
    for m in alive:
        frac = sharer_assignments.get(m.memberId)
        if frac and frac > 0:
            m.share = str(frac)
            m.shareDecimal = float(frac)
            heirs.append(m)

    if any(m.isNri for m in heirs):
        edge_cases.append("NRI_FEMA: FEMA 1999 compliance required for NRI heirs")
    if any(not m.isAdult for m in heirs):
        edge_cases.append("MINOR_GUARDIAN: Court-appointed guardian required for minor heirs")

    return ComputationResult(
        applicableLaw="Indian Succession Act 1925",
        legalSection="ISA 1925 Part V — Christian (S.33–36)",
        heirs=heirs,
        legalNotes=notes,
        warnings=warnings,
        edgeCases=edge_cases,
        confidence=0.93,
        computationTrace=trace,
    )


# ─── Indian Succession Act 1925 — Parsi ──────────────────────────────────────
#
# ISA 1925 Ss.51–56 (Parsi Intestate Succession):
#   S.51: Widow + children take together. Widow = equal share as each child.
#   S.52: No children: widow takes 1/2, other half to kindred
#   Sons and daughters take EQUAL shares (unlike Muslim law).
#   Parents inherit if no spouse/children.

def compute_parsi_isa(members: list[FamilyMember]) -> ComputationResult:
    trace = ["Law: Indian Succession Act 1925 — Part VII (Parsi)"]
    notes = []
    warnings: list[str] = []
    edge_cases: list[str] = []

    alive = [m for m in members if m.isAlive]
    widows      = [m for m in alive if m.relation in ("Wife", "Widow")]
    children    = [m for m in alive if m.relation in ("Son", "Daughter")]
    parents     = [m for m in alive if m.relation in ("Father", "Mother")]
    kindred     = [m for m in alive if m.relation in ("Brother", "Sister")]

    sharer_assignments: dict[str, Fraction] = {}

    if widows and children:
        # S.51: widow = equal child share. Total units = widows + children
        total_units = len(widows) + len(children)
        each = Fraction(1, total_units)
        for w in widows:
            sharer_assignments[w.memberId] = each
        for c in children:
            sharer_assignments[c.memberId] = each
        notes.append(
            "ISA 1925 S.51: Widow takes equal share as each child. "
            "Sons and daughters share equally (no 2:1 distinction — unlike Muslim law)."
        )
        trace.append(f"S.51: {total_units} units (widow + {len(children)} children) = {each} each")

    elif widows and not children:
        for w in widows:
            sharer_assignments[w.memberId] = Fraction(1, 2) / len(widows)
        if kindred or parents:
            other = kindred or parents
            for o in other:
                sharer_assignments[o.memberId] = Fraction(1, 2) / len(other)
            notes.append("ISA 1925 S.52: No children — widow 1/2, kindred/parents 1/2.")
        else:
            for w in widows:
                sharer_assignments[w.memberId] = Fraction(1, 1) / len(widows)
            notes.append("ISA 1925 S.52: No children/kindred — widow takes all.")

    elif children and not widows:
        for c in children:
            sharer_assignments[c.memberId] = Fraction(1, len(children))
        notes.append("ISA 1925 S.54: Children take equally (sons = daughters).")

    elif parents and not widows and not children:
        for p in parents:
            sharer_assignments[p.memberId] = Fraction(1, len(parents))

    heirs = []
    for m in alive:
        frac = sharer_assignments.get(m.memberId)
        if frac and frac > 0:
            m.share = str(frac)
            m.shareDecimal = float(frac)
            heirs.append(m)

    if any(m.isNri for m in heirs):
        edge_cases.append("NRI_FEMA: FEMA 1999 compliance required for NRI heirs")
    if any(not m.isAdult for m in heirs):
        edge_cases.append("MINOR_GUARDIAN: Court-appointed guardian required for minor heirs")

    return ComputationResult(
        applicableLaw="Indian Succession Act 1925",
        legalSection="ISA 1925 Part VII — Parsi (S.51–56)",
        heirs=heirs,
        legalNotes=notes,
        warnings=warnings,
        edgeCases=edge_cases,
        confidence=0.91,
        computationTrace=trace,
    )


# ─── Tribal Customary Law ─────────────────────────────────────────────────────
#
# Governed by Article 13(3)(a) of Constitution — custom/usage = "law" for ST.
# Forest Rights Act 2006 S.4(5): individual title cannot be alienated/transferred
# except to legal heirs or gram sabha.
# Tribal succession varies: patrilineal (most tribes), matrilineal (Khasi, Garo, etc.)

def compute_tribal(members: list[FamilyMember]) -> ComputationResult:
    trace = ["Law: Tribal Customary Law + Forest Rights Act 2006"]
    notes = [
        "Tribal succession follows community customary law under Article 13(3)(a). "
        "FRA 2006 S.4(5): forest rights can pass to legal heirs but cannot be alienated. "
        "Gram Sabha ratification required before title mutation.",
    ]
    alive = [m for m in members if m.isAlive]
    n = len(alive)
    if n:
        unit = Fraction(1, n)
        for m in alive:
            m.share = str(unit)
            m.shareDecimal = float(unit)

    return ComputationResult(
        applicableLaw="Tribal Customary Law + Forest Rights Act 2006",
        legalSection="FRA 2006 S.4(5) — Tribal Succession",
        heirs=alive,
        legalNotes=notes,
        warnings=[
            "TRIBAL: This is a simplified equal-share approximation. "
            "Actual tribal custom must be verified with the community."
        ],
        edgeCases=["GRAM_SABHA_REQUIRED: Succession must be ratified by the village Gram Sabha"],
        confidence=0.80,
        computationTrace=trace,
    )


# ─── Dispatcher ───────────────────────────────────────────────────────────────

def compute_succession(
    members: list[FamilyMember],
    religion: Religion,
    date_of_death: str,
    is_tribal: bool = False,
    muslim_school: MuslimSchool = MuslimSchool.SUNNI,
) -> ComputationResult:
    """
    Main entry point. Returns ComputationResult with heirs + shares.

    Called by CoparcenaryMapper oracle after death event (all three trigger scenarios).
    Result is written on-chain via InitiateSuccessionByDeathCert or
    InitiateSuccessionByHeirPetition → aiComputationCID + aiConfidenceScore params.
    """
    if is_tribal:
        return compute_tribal(members)

    if religion in (Religion.HINDU, Religion.SIKH, Religion.BUDDHIST, Religion.JAIN):
        return compute_hsa(members, date_of_death)

    if religion == Religion.MUSLIM:
        if muslim_school == MuslimSchool.SHIA:
            return compute_muslim_shia(members)
        return compute_muslim_sunni(members)

    if religion == Religion.PARSI:
        return compute_parsi_isa(members)

    if religion == Religion.CHRISTIAN:
        return compute_christian_isa(members)

    # Special Marriage Act 1954 → ISA 1925 Christian rules apply
    # (inter-religious couple registered under SMA 1954)
    return compute_christian_isa(members)
