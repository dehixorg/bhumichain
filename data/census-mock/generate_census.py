"""
BhumiChain — Janganana (Census 2026) Mock Data Generator
Generates 1,000 synthetic GPS-tagged census household points for Nashik
Includes deliberate mismatches to demonstrate anomaly detection
"""

import json
import random
import uuid
from datetime import datetime

random.seed(77)

NASHIK_BOUNDS = {
    "min_lat": 19.5, "max_lat": 20.4,
    "min_lon": 73.5, "max_lon": 74.8,
}

# Anomaly types with their distribution
ANOMALY_SCENARIOS = [
    {"type": "NORMAL", "weight": 70},
    {"type": "ENCROACHMENT", "weight": 10},         # household on govt/forest land
    {"type": "BENAMI_SUSPECT", "weight": 8},          # no one lives at "owner-occupied" parcel
    {"type": "COPARCENARY_INVISIBLE", "weight": 7},   # large joint family, single name in records
    {"type": "ILLEGAL_CONVERSION", "weight": 5},      # house on agricultural land
]

HOUSEHOLD_TYPES = ["Nuclear", "Joint", "Extended", "Single"]
CASTE_CATEGORIES = ["General", "OBC", "SC", "ST"]


def weighted_choice(items):
    total = sum(i["weight"] for i in items)
    r = random.uniform(0, total)
    cumulative = 0
    for item in items:
        cumulative += item["weight"]
        if r <= cumulative:
            return item
    return items[-1]


def generate_household(index: int, parcel_dlpi: str = None) -> dict:
    scenario = weighted_choice(ANOMALY_SCENARIOS)

    lat = random.uniform(NASHIK_BOUNDS["min_lat"], NASHIK_BOUNDS["max_lat"])
    lon = random.uniform(NASHIK_BOUNDS["min_lon"], NASHIK_BOUNDS["max_lon"])

    household_size = random.randint(2, 12)
    caste = random.choice(CASTE_CATEGORIES)
    if caste == "ST":
        # Tribal households more likely in Igatpuri/Trimbak area
        lat = random.uniform(19.5, 19.85)
        lon = random.uniform(73.5, 73.85)

    household = {
        "householdId": f"JGNN-NSK-{str(index).zfill(5)}",
        "enumerationDate": f"2026-{random.randint(4,6):02d}-{random.randint(1,28):02d}",
        "gpsLocation": {
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "accuracy_m": random.randint(2, 15),
        },
        "householdSize": household_size,
        "householdType": random.choice(HOUSEHOLD_TYPES),
        "casteCategory": caste,
        "headOfHousehold": f"HH-{uuid.uuid4().hex[:8]}",   # anonymized
        "hasElectricity": random.random() < 0.85,
        "hasToilet": random.random() < 0.70,
        "hasPuckaHouse": random.random() < 0.60,
        "monthlyIncomeBracket": random.choice(
            ["<5000", "5000-15000", "15000-30000", "30000-50000", ">50000"]
        ),
        "matchedDlpiId": parcel_dlpi,
        "anomalyType": scenario["type"],
        "anomalyDetails": None,
        "flaggedForReview": scenario["type"] != "NORMAL",
        "enumeratorId": f"ENUM-NSK-{random.randint(100,999)}",
    }

    # Add anomaly-specific details
    if scenario["type"] == "ENCROACHMENT":
        household["anomalyDetails"] = {
            "description": "Household GPS falls within a parcel classified as Government Reserved / Forest land. No legal occupancy record found.",
            "recommendedAction": "Revenue Department field survey within 30 days",
            "severity": "HIGH",
            "possibleDlpiClassification": random.choice(["Govt_Reserved", "Tribal_FRA"]),
        }
    elif scenario["type"] == "BENAMI_SUSPECT":
        household["anomalyDetails"] = {
            "description": "Parcel records show 'owner-occupied' status but no census household found at this GPS location. Possible benami holding or agricultural land misclassified.",
            "recommendedAction": "Escalate to BhumiAnalytics FraudSense for graph analysis",
            "severity": "MEDIUM",
            "pmKisanImpact": random.random() < 0.4,
        }
    elif scenario["type"] == "COPARCENARY_INVISIBLE":
        household["anomalyDetails"] = {
            "description": f"Household of {household_size} persons living at parcel. Land records show single owner name — possible coparcenary family invisible to revenue system.",
            "recommendedAction": "Trigger Uttaradhikar Engine for coparcenary investigation",
            "severity": "MEDIUM",
            "estimatedCoparceners": household_size // 3,
        }
    elif scenario["type"] == "ILLEGAL_CONVERSION":
        household["anomalyDetails"] = {
            "description": "Permanent residential structure found on parcel classified as agricultural land (Jirayat/Bagayat). Possible unauthorized conversion.",
            "recommendedAction": "District Collector NOC verification. Agricultural conversion lock check.",
            "severity": "HIGH",
            "conversionArea": round(random.uniform(0.02, 0.2), 3),
        }

    return household


def generate_demo_households() -> list:
    """
    Pre-crafted households for demo scenarios
    """
    return [
        # Encroachment on govt land — shown on BhumiAnalytics dashboard
        {
            "householdId": "JGNN-NSK-DEMO-01",
            "enumerationDate": "2026-05-15",
            "gpsLocation": {"latitude": 19.7234, "longitude": 73.6891, "accuracy_m": 5},
            "householdSize": 6,
            "householdType": "Joint",
            "casteCategory": "ST",
            "matchedDlpiId": None,
            "anomalyType": "ENCROACHMENT",
            "flaggedForReview": True,
            "anomalyDetails": {
                "description": "Household of 6 found on Forest Reserve land near Igatpuri. No legal patta exists.",
                "recommendedAction": "Revenue Department field survey. Verify if FRA claim pending.",
                "severity": "HIGH",
            },
            "isDemoHousehold": True,
        },
        # Benami — owner listed, no one lives there
        {
            "householdId": "JGNN-NSK-DEMO-02",
            "enumerationDate": "2026-04-22",
            "gpsLocation": {"latitude": 19.9812, "longitude": 73.7823, "accuracy_m": 8},
            "householdSize": 0,
            "householdType": None,
            "casteCategory": None,
            "matchedDlpiId": "DLPI-MH-NSK-02891",
            "anomalyType": "BENAMI_SUSPECT",
            "flaggedForReview": True,
            "anomalyDetails": {
                "description": "No household found. DLPI-MH-NSK-02891 shows owner with 5 similar parcels — benami pattern detected by FraudSense.",
                "recommendedAction": "Escalate to I-T Department. FraudSense score: 0.87",
                "severity": "HIGH",
                "pmKisanImpact": True,
            },
            "isDemoHousehold": True,
        },
        # Coparcenary invisible — large family, one name in records
        {
            "householdId": "JGNN-NSK-DEMO-03",
            "enumerationDate": "2026-05-08",
            "gpsLocation": {"latitude": 19.8612, "longitude": 74.0001, "accuracy_m": 4},
            "householdSize": 9,
            "householdType": "Joint",
            "casteCategory": "OBC",
            "matchedDlpiId": "DLPI-MH-SNN-00142",
            "anomalyType": "COPARCENARY_INVISIBLE",
            "flaggedForReview": True,
            "anomalyDetails": {
                "description": "Joint family of 9 at Ramesh Patil parcel. Revenue records show single name. 3 potential coparceners identified.",
                "recommendedAction": "Uttaradhikar Engine triggered. Multi-sig consent pending from 3 heirs.",
                "severity": "MEDIUM",
                "estimatedCoparceners": 3,
            },
            "isDemoHousehold": True,
        },
    ]


def main():
    print("Generating Janganana census mock data...")

    households = generate_demo_households()

    for i in range(4, 1001):
        households.append(generate_household(i))

    output_path = "nashik_census_mock.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(households, f, ensure_ascii=False, indent=2)
    print(f"✓ Generated {len(households)} census households → {output_path}")

    # Stats
    anomaly_counts = {}
    for h in households:
        t = h["anomalyType"]
        anomaly_counts[t] = anomaly_counts.get(t, 0) + 1

    total_flagged = sum(1 for h in households if h["flaggedForReview"])
    print(f"\n── Janganana Dataset Stats ─────────────")
    print(f"Total households: {len(households)}")
    print(f"Flagged for review: {total_flagged} ({100*total_flagged/len(households):.1f}%)")
    print("\nAnomaly breakdown:")
    for atype, count in sorted(anomaly_counts.items(), key=lambda x: -x[1]):
        print(f"  {atype:30s}: {count}")


if __name__ == "__main__":
    main()
