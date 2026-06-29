"""
BhumiSettle AI — Equitable Partition Recommendation Engine

Listens for AISettlementRequested events from the bhumi-settle chaincode.
Runs greedy value-matching algorithm on co-owner shares + circle-rate valuations.
Writes RecordAIRecommendation back to chain via oracle.

Also processes OfficerFraudAlertFired events from bhumi-settle and
cross-references mutation patterns from mutation-manager.

Event listeners (Fabric event hub):
  AISettlementRequested  → recommend_settlement()
  MutationExecuted       → check_officer_patterns()
"""

import json
import os
from typing import Any
from dataclasses import dataclass, field
from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="BhumiSettle AI", version="1.0.0")


# ─── Settlement Recommendation ────────────────────────────────────────────────

@dataclass
class Party:
    aadhaar_hash: str
    name: str
    fair_value: float          # their share fraction × total pool value
    assigned_value: float = 0.0

@dataclass
class Property:
    dlpi_id: str
    village: str
    area_hectares: float
    land_type: str
    value_inr: float           # area × circle rate
    assigned_to: str = ""

@dataclass
class Payment:
    from_hash: str
    to_hash: str
    amount_inr: float
    status: str = "PENDING"


def greedy_assign(parties: list[Party], properties: list[Property]) -> tuple[list[Property], list[Payment]]:
    """
    Greedy value-matching algorithm for equitable partition.

    Sorts properties by value (descending).
    Assigns each property to the party whose current assigned total
    is most below their fair share value.

    Time complexity: O(N log N + N×M) where N=properties, M=parties.
    For typical Indian family sizes (2-64 members, 2-64 plots) this is instant.

    Returns: (assigned properties, equalization payments)
    """
    props = sorted(properties, key=lambda p: p.value_inr, reverse=True)
    assigned: dict[str, float] = defaultdict(float)

    for prop in props:
        # Find party with biggest shortfall (fair_value - assigned_value)
        best = max(parties, key=lambda p: p.fair_value - assigned[p.aadhaar_hash])
        prop.assigned_to = best.aadhaar_hash
        assigned[best.aadhaar_hash] += prop.value_inr

    # Calculate equalization payments
    # Those who received more than fair share pay those who received less
    overpaid: list[tuple[Party, float]] = []
    underpaid: list[tuple[Party, float]] = []
    for p in parties:
        diff = assigned[p.aadhaar_hash] - p.fair_value
        if diff > 100:
            overpaid.append((p, diff))
        elif diff < -100:
            underpaid.append((p, -diff))

    payments: list[Payment] = []
    # Match overpaid → underpaid (greedy matching)
    for op, owed in overpaid:
        remaining = owed
        for up, need in underpaid:
            if remaining <= 0:
                break
            pay_amount = min(remaining, need)
            if pay_amount > 0:
                payments.append(Payment(
                    from_hash=op.aadhaar_hash,
                    to_hash=up.aadhaar_hash,
                    amount_inr=round(pay_amount, 2)
                ))
                remaining -= pay_amount

    return props, payments


def max_deviation(parties: list[Party], assigned: dict[str, float]) -> float:
    """Maximum fractional deviation from fair share across all parties."""
    devs = []
    for p in parties:
        if p.fair_value > 0:
            devs.append(abs(assigned[p.aadhaar_hash] - p.fair_value) / p.fair_value)
    return max(devs) if devs else 0.0


class SettlementRequest(BaseModel):
    proposal_id: str
    pool_id: str
    parties: list[dict]      # {aadhaarHash, name, fairValueInr}
    properties: list[dict]   # {dlpiId, village, areaHectares, landType, valueInr}
    total_pool_value: float


class SettlementResponse(BaseModel):
    proposal_id: str
    algorithm: str
    confidence: float
    assignments: list[dict]  # {dlpiId, assignedTo, valueInr}
    payments: list[dict]     # {fromHash, toHash, amountInr, status}
    max_deviation: float
    explanation: str


@app.post("/recommend", response_model=SettlementResponse)
def recommend_settlement(req: SettlementRequest) -> SettlementResponse:
    """
    Main endpoint: receive settlement request, return recommended assignment plan.

    Called by oracle when AISettlementRequested event fires from chaincode.
    Oracle then calls RecordAIRecommendation on the bhumi-settle chaincode.
    """
    parties = [
        Party(
            aadhaar_hash=p["aadhaarHash"],
            name=p.get("name", ""),
            fair_value=p["fairValueInr"]
        )
        for p in req.parties
    ]
    properties = [
        Property(
            dlpi_id=p["dlpiId"],
            village=p.get("village", ""),
            area_hectares=p.get("areaHectares", 0),
            land_type=p.get("landType", ""),
            value_inr=p["valueInr"]
        )
        for p in req.properties
    ]

    if not parties or not properties:
        return SettlementResponse(
            proposal_id=req.proposal_id,
            algorithm="GREEDY_VALUE_MATCH",
            confidence=0.0,
            assignments=[],
            payments=[],
            max_deviation=0.0,
            explanation="Insufficient data for recommendation."
        )

    assigned_props, payments = greedy_assign(parties, properties)

    assigned_totals: dict[str, float] = defaultdict(float)
    for prop in assigned_props:
        assigned_totals[prop.assigned_to] += prop.value_inr

    dev = max_deviation(parties, assigned_totals)

    # Confidence: higher if max deviation is small
    # < 5% deviation → 0.95 confidence
    # 5–15% → 0.80
    # 15–30% → 0.65
    # > 30% → 0.50 (recommend manual review)
    if dev < 0.05:
        confidence = 0.95
    elif dev < 0.15:
        confidence = 0.80
    elif dev < 0.30:
        confidence = 0.65
    else:
        confidence = 0.50

    explanation = _build_explanation(parties, assigned_props, payments, assigned_totals, dev)

    return SettlementResponse(
        proposal_id=req.proposal_id,
        algorithm="GREEDY_VALUE_MATCH",
        confidence=confidence,
        assignments=[
            {
                "dlpiId": p.dlpi_id,
                "assignedTo": p.assigned_to,
                "valueInr": p.value_inr,
                "village": p.village,
                "landType": p.land_type,
                "isFullTransfer": True
            }
            for p in assigned_props
        ],
        payments=[
            {
                "fromHash": pay.from_hash,
                "toHash": pay.to_hash,
                "amountInr": pay.amount_inr,
                "status": "PENDING"
            }
            for pay in payments
        ],
        max_deviation=round(dev * 100, 2),  # as percentage
        explanation=explanation
    )


def _build_explanation(
    parties: list[Party],
    props: list[Property],
    payments: list[Payment],
    assigned_totals: dict[str, float],
    dev: float
) -> str:
    lines = [
        f"AI ne {len(props)} sampattiyaan {len(parties)} hissedaaron mein baant di hain.",
        f"Sabse bada antar: {dev*100:.1f}% (circle rate se).",
        "",
        "Assignment summary:"
    ]
    for p in parties:
        assigned = assigned_totals.get(p.aadhaar_hash, 0)
        diff = assigned - p.fair_value
        direction = "adhik mile" if diff > 0 else "kam mile"
        lines.append(
            f"  {p.name}: nyaay hissa ₹{p.fair_value:,.0f} → milega ₹{assigned:,.0f} "
            f"({abs(diff):,.0f} {direction})"
        )
    if payments:
        lines.append("")
        lines.append("Samata bhugtan (equalization payments):")
        for pay in payments:
            lines.append(f"  ₹{pay.amount_inr:,.0f} — {pay.from_hash[:12]}... → {pay.to_hash[:12]}...")

    return "\n".join(lines)


# ─── Officer Fraud Pattern Detection ─────────────────────────────────────────

# In-memory pattern store for POC (production: use a time-series DB)
_officer_mutation_log: dict[str, list[dict]] = defaultdict(list)


class MutationEvent(BaseModel):
    mutation_id: str
    dlpi_id: str
    mutation_type: str
    officer_hash: str
    officer_name: str
    officer_rank: str
    new_owners: list[dict]       # [{aadhaarHash, name, share}]
    dilrmp_name_count: int        # how many names DILRMP shows for this Khasra
    declared_value: float
    circle_rate_value: float      # what the property should be worth at circle rate
    initiated_at: str             # ISO timestamp


class FraudCheckResponse(BaseModel):
    officer_hash: str
    patterns: list[dict]         # [{patternType, fraudScore, evidence, description}]
    should_alert: bool


@app.post("/check-officer-pattern", response_model=FraudCheckResponse)
def check_officer_pattern(event: MutationEvent) -> FraudCheckResponse:
    """
    Called by oracle each time a MutationExecuted event fires.
    Accumulates officer mutation history and checks for fraud patterns.
    Fires RecordOfficerFraudAlert if score >= 0.60.
    """
    log = _officer_mutation_log[event.officer_hash]
    log.append(event.dict())
    # Keep only last 90 days
    cutoff = datetime.utcnow() - timedelta(days=90)
    log = [m for m in log if datetime.fromisoformat(m["initiated_at"]) > cutoff]
    _officer_mutation_log[event.officer_hash] = log

    patterns = []

    # Pattern 1: SINGLE_HEIR_REPEAT
    if event.mutation_type == "INHERITANCE":
        single_heir_cases = [
            m for m in log
            if m["mutation_type"] == "INHERITANCE"
            and len(m["new_owners"]) == 1
            and m["dilrmp_name_count"] > 1
        ]
        if len(single_heir_cases) >= 3:
            score = min(0.60 + len(single_heir_cases) * 0.05, 0.95)
            patterns.append({
                "patternType": "SINGLE_HEIR_REPEAT",
                "fraudScore": score,
                "evidenceMutIds": [m["mutation_id"] for m in single_heir_cases[-5:]],
                "description": (
                    f"{event.officer_name} ne {len(single_heir_cases)} baar "
                    f"inheritance mutation mein sirf 1 waris diya jabki DILRMP mein "
                    f"zyada naam hain."
                )
            })

    # Pattern 2: UNDERVALUATION
    if event.circle_rate_value > 0:
        ratio = event.declared_value / event.circle_rate_value
        if ratio < 0.60:
            underval_cases = [
                m for m in log
                if m["circle_rate_value"] > 0
                and m["declared_value"] / m["circle_rate_value"] < 0.60
            ]
            if len(underval_cases) >= 2:
                score = min(0.65 + len(underval_cases) * 0.05, 0.90)
                patterns.append({
                    "patternType": "UNDERVALUATION",
                    "fraudScore": score,
                    "evidenceMutIds": [m["mutation_id"] for m in underval_cases[-5:]],
                    "description": (
                        f"{event.officer_name} ke {len(underval_cases)} transactions mein "
                        f"declared value circle rate se 40%+ kam hai. "
                        f"Stamp duty chhupane ki koshish ho sakti hai."
                    )
                })

    # Pattern 3: BUYER_CONCENTRATION
    buyer_counter: dict[str, int] = defaultdict(int)
    for m in log:
        for owner in m.get("new_owners", []):
            buyer_counter[owner["aadhaarHash"]] += 1
    concentrated_buyers = [(b, c) for b, c in buyer_counter.items() if c >= 5]
    if concentrated_buyers:
        score = min(0.70 + len(concentrated_buyers) * 0.05, 0.88)
        patterns.append({
            "patternType": "BUYER_CONCENTRATION",
            "fraudScore": score,
            "evidenceMutIds": [m["mutation_id"] for m in log[-10:]],
            "description": (
                f"Ek ya zyada buyers {concentrated_buyers[0][1]} baar is officer ke "
                f"mutations mein hain. Benami accumulation pattern ho sakta hai."
            )
        })

    # Pattern 4: OFF_HOURS_ENTRY
    night_mutations = [
        m for m in log
        if datetime.fromisoformat(m["initiated_at"]).hour in range(23, 5)
    ]
    if len(night_mutations) >= 3:
        score = 0.70
        patterns.append({
            "patternType": "OFF_HOURS_ENTRY",
            "fraudScore": score,
            "evidenceMutIds": [m["mutation_id"] for m in night_mutations[-5:]],
            "description": (
                f"{event.officer_name} ne {len(night_mutations)} mutations "
                f"raat 11baje se subah 5baje ke beech file kiye. "
                f"Supervisor review se bachne ki koshish ho sakti hai."
            )
        })

    should_alert = any(p["fraudScore"] >= 0.60 for p in patterns)
    return FraudCheckResponse(
        officer_hash=event.officer_hash,
        patterns=patterns,
        should_alert=should_alert
    )


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "bhumi-settle",
        "officers_tracked": len(_officer_mutation_log),
    }
