"""
BhumiChain — Synthetic Nashik District Parcel Generator
Generates 5,000 realistic land parcels for Nashik, Maharashtra demo
"""

import json
import random
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict

random.seed(42)  # reproducible data

# ─── Nashik District Geography ────────────────────────────────────────────────
# Approximate bounding box: 19.5°N–20.4°N, 73.5°E–74.8°E
NASHIK_BOUNDS = {
    "min_lat": 19.5, "max_lat": 20.4,
    "min_lon": 73.5, "max_lon": 74.8,
}

TEHSILS = [
    {"name": "Nashik", "code": "NSK", "urban_ratio": 0.6},
    {"name": "Sinnar", "code": "SNN", "urban_ratio": 0.2},
    {"name": "Igatpuri", "code": "IGT", "urban_ratio": 0.1, "tribal": True},
    {"name": "Trimbak", "code": "TRM", "urban_ratio": 0.15, "tribal": True},
    {"name": "Dindori", "code": "DND", "urban_ratio": 0.1, "tribal": True},
    {"name": "Niphad", "code": "NPD", "urban_ratio": 0.15},
    {"name": "Chandwad", "code": "CHD", "urban_ratio": 0.12},
    {"name": "Malegaon", "code": "MLG", "urban_ratio": 0.45},
]

LAND_TYPES = [
    {"type": "Jirayat", "desc": "Dry agricultural", "weight": 35},          # rain-fed
    {"type": "Bagayat", "desc": "Irrigated/horticulture", "weight": 25},    # orchards, vineyards
    {"type": "Residential", "desc": "Residential plot", "weight": 20},
    {"type": "Commercial", "desc": "Commercial property", "weight": 8},
    {"type": "Tribal_FRA", "desc": "Tribal FRA patta (Schedule V)", "weight": 7},
    {"type": "Govt_Reserved", "desc": "Government/forest reserve", "weight": 5},
]

ENCUMBRANCE_STATUS = [
    {"status": "CLEAR", "weight": 65},
    {"status": "MORTGAGED", "weight": 20},
    {"status": "COURT_INJUNCTION", "weight": 8},
    {"status": "IT_ATTACHMENT", "weight": 4},
    {"status": "DISPUTED", "weight": 3},
]

MARATHI_SURNAMES = [
    "Patil", "Shinde", "Jadhav", "Pawar", "Salve", "Bhosale", "More",
    "Gaikwad", "Deshmukh", "Kulkarni", "Joshi", "Rane", "Naik", "Chavan",
    "Kale", "Deshpande", "Mane", "Wagh", "Sawant", "Thakare",
]
MARATHI_FIRST_NAMES = [
    "Ramesh", "Suresh", "Arun", "Vijay", "Sanjay", "Rajesh", "Mahesh",
    "Sunita", "Priya", "Kavita", "Anita", "Rekha", "Meena", "Lata",
    "Balasaheb", "Dnyaneshwar", "Tukaram", "Namdev", "Eknath",
]
TRIBAL_SURNAMES = ["Bhil", "Pawara", "Gamit", "Vasave", "Tadvi"]
TRIBAL_FIRST_NAMES = ["Mangal", "Laxmi", "Balu", "Ramu", "Shanta", "Kalu"]


def weighted_choice(items, key="weight"):
    total = sum(i[key] for i in items)
    r = random.uniform(0, total)
    cumulative = 0
    for item in items:
        cumulative += item[key]
        if r <= cumulative:
            return item
    return items[-1]


def random_name(is_tribal=False):
    if is_tribal:
        return f"{random.choice(TRIBAL_FIRST_NAMES)} {random.choice(TRIBAL_SURNAMES)}"
    return f"{random.choice(MARATHI_FIRST_NAMES)} {random.choice(MARATHI_SURNAMES)}"


def aadhaar_hash(name: str, dob: str) -> str:
    """Simulate SHA-256 hash of Aadhaar (never store real Aadhaar)"""
    fake_aadhaar = f"{name}-{dob}-{random.randint(100000000000, 999999999999)}"
    return hashlib.sha256(fake_aadhaar.encode()).hexdigest()[:32]


def random_dob():
    start = datetime(1940, 1, 1)
    end = datetime(1985, 12, 31)
    return (start + timedelta(days=random.randint(0, (end - start).days))).strftime("%Y-%m-%d")


def generate_polygon(lat_center: float, lon_center: float, area_ha: float) -> dict:
    """Generate a simple rectangular GeoJSON polygon for a parcel"""
    # Approximate: 1 degree lat ≈ 111 km, 1 degree lon ≈ 95 km at Nashik latitude
    side_m = (area_ha * 10000) ** 0.5  # square root gives side of square equiv.
    delta_lat = (side_m / 111000) * random.uniform(0.8, 1.2)
    delta_lon = (side_m / 95000) * random.uniform(0.8, 1.2)

    # Slightly irregular polygon (4-6 vertices)
    corners = [
        [lon_center - delta_lon/2, lat_center - delta_lat/2],
        [lon_center + delta_lon/2, lat_center - delta_lat/2],
        [lon_center + delta_lon/2, lat_center + delta_lat/2],
        [lon_center - delta_lon/2, lat_center + delta_lat/2],
        [lon_center - delta_lon/2, lat_center - delta_lat/2],  # close ring
    ]
    return {"type": "Polygon", "coordinates": [corners]}


def random_valuation(land_type: str, area_ha: float, tehsil: str) -> int:
    """Synthetic circle-rate based valuation in INR"""
    base_rates = {
        "Jirayat": 800_000,       # per hectare
        "Bagayat": 1_500_000,
        "Residential": 3_000_000,
        "Commercial": 8_000_000,
        "Tribal_FRA": 200_000,
        "Govt_Reserved": 0,
    }
    urban_multiplier = {"Nashik": 3.0, "Malegaon": 1.8, "Sinnar": 1.2,
                        "Igatpuri": 0.9, "Trimbak": 0.8, "Dindori": 0.7,
                        "Niphad": 1.0, "Chandwad": 0.9}
    rate = base_rates.get(land_type, 1_000_000)
    multiplier = urban_multiplier.get(tehsil, 1.0) * random.uniform(0.8, 1.2)
    return int(rate * area_ha * multiplier)


def generate_parcel(index: int) -> dict:
    tehsil = random.choice(TEHSILS)
    is_tribal_tehsil = tehsil.get("tribal", False)

    # Force tribal land type in tribal tehsils sometimes
    if is_tribal_tehsil and random.random() < 0.35:
        land_type_obj = {"type": "Tribal_FRA", "desc": "Tribal FRA patta (Schedule V)"}
        is_tribal = True
    else:
        land_type_obj = weighted_choice(LAND_TYPES)
        is_tribal = land_type_obj["type"] == "Tribal_FRA"

    land_type = land_type_obj["type"]
    encumbrance = weighted_choice(ENCUMBRANCE_STATUS)

    # Area based on land type
    if land_type in ["Residential"]:
        area_ha = round(random.uniform(0.005, 0.05), 4)   # 50–500 sq mt
    elif land_type == "Commercial":
        area_ha = round(random.uniform(0.01, 0.2), 4)
    elif land_type in ["Jirayat", "Bagayat"]:
        area_ha = round(random.uniform(0.5, 6.0), 4)
    elif land_type == "Tribal_FRA":
        area_ha = round(random.uniform(1.0, 4.0), 4)
    else:
        area_ha = round(random.uniform(5.0, 50.0), 4)

    lat = random.uniform(NASHIK_BOUNDS["min_lat"], NASHIK_BOUNDS["max_lat"])
    lon = random.uniform(NASHIK_BOUNDS["min_lon"], NASHIK_BOUNDS["max_lon"])

    # Owner
    owner_name = random_name(is_tribal)
    owner_dob = random_dob()
    owner_aadhaar_hash = aadhaar_hash(owner_name, owner_dob)

    # Is coparcenary?
    is_coparcenary = (
        land_type in ["Jirayat", "Bagayat", "Tribal_FRA"]
        and random.random() < 0.40
    )

    # Survey number (realistic Maharashtra format: village_no/survey_no/sub_no)
    village_no = random.randint(1, 500)
    survey_no = random.randint(1, 300)
    sub_no = random.choice(["", "/1A", "/1B", "/2A", "/2B", "/3"])
    survey_number = f"{village_no}/{survey_no}{sub_no}"

    # Mutation history
    n_mutations = random.randint(0, 4)
    mutation_history = []
    mutation_date = datetime(2000, 1, 1)
    for _ in range(n_mutations):
        mutation_date += timedelta(days=random.randint(365, 3000))
        if mutation_date > datetime.now():
            break
        mutation_history.append({
            "type": random.choice(["Sale", "Inheritance", "Partition", "Gift"]),
            "date": mutation_date.strftime("%Y-%m-%d"),
            "officerName": f"Patwari {random_name()}",
            "mutation_no": f"MUT/{random.randint(1000, 9999)}/{mutation_date.year}",
        })

    # DLPI ID
    tehsil_code = tehsil["code"]
    dlpi_id = f"DLPI-MH-{tehsil_code}-{str(index).zfill(5)}"

    # Valuation
    market_value = random_valuation(land_type, area_ha, tehsil["name"])

    parcel = {
        "dlpiId": dlpi_id,
        "surveyNumber": survey_number,
        "tehsil": tehsil["name"],
        "tehsilCode": tehsil_code,
        "district": "Nashik",
        "state": "Maharashtra",
        "landType": land_type,
        "landTypeDescription": land_type_obj["desc"],
        "areaHectares": area_ha,
        "isTribal": is_tribal,
        "isCoparcenary": is_coparcenary,
        "scheduleVArea": is_tribal,
        "encumbranceStatus": encumbrance["status"],
        "owner": {
            "name": owner_name,
            "aadhaarHash": owner_aadhaar_hash,
            "dob": owner_dob,
            "isTribal": is_tribal,
        },
        "location": {
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "boundaryPolygon": generate_polygon(lat, lon, area_ha),
        },
        "valuation": {
            "circleRateINR": market_value,
            "lastAssessedDate": "2025-04-01",
        },
        "mutationHistory": mutation_history,
        "ipfsCID": f"Qm{uuid.uuid4().hex[:44]}",       # mock IPFS CID
        "createdAt": "2026-06-01T00:00:00Z",
        "sourceType": "DILRMP_MIGRATION",
        "blockNumber": random.randint(1, 5000),
        "txHash": f"0x{uuid.uuid4().hex}",
    }

    return parcel


def generate_ramesh_family() -> List[dict]:
    """
    Generate the exact parcels for the demo story.
    Ramesh Patil, Sinnar tehsil, Nashik.
    """
    owner_hash = aadhaar_hash("Ramesh Dattatray Patil", "1958-03-15")
    main_parcel = {
        "dlpiId": "DLPI-MH-SNN-00142",
        "surveyNumber": "142/2A",
        "tehsil": "Sinnar",
        "tehsilCode": "SNN",
        "district": "Nashik",
        "state": "Maharashtra",
        "landType": "Bagayat",
        "landTypeDescription": "Irrigated/horticulture land",
        "areaHectares": 2.4,
        "isTribal": False,
        "isCoparcenary": True,
        "scheduleVArea": False,
        "encumbranceStatus": "CLEAR",
        "owner": {
            "name": "Ramesh Dattatray Patil",
            "aadhaarHash": owner_hash,
            "dob": "1958-03-15",
            "isTribal": False,
        },
        "coparcenary": {
            "heirs": [
                {
                    "name": "Arun Ramesh Patil",
                    "aadhaarHash": aadhaar_hash("Arun Ramesh Patil", "1982-07-10"),
                    "relation": "Son",
                    "share": "1/3",
                    "shareDecimal": 0.3333,
                    "dob": "1982-07-10",
                },
                {
                    "name": "Vijay Ramesh Patil",
                    "aadhaarHash": aadhaar_hash("Vijay Ramesh Patil", "1985-11-22"),
                    "relation": "Son",
                    "share": "1/3",
                    "shareDecimal": 0.3333,
                    "dob": "1985-11-22",
                },
                {
                    "name": "Sunita Ramesh Patil",
                    "aadhaarHash": aadhaar_hash("Sunita Ramesh Patil", "1988-04-05"),
                    "relation": "Daughter",
                    "share": "1/3",
                    "shareDecimal": 0.3333,
                    "dob": "1988-04-05",
                    "legalNote": "Equal coparcenary right per HSA 2005 S.6(3)",
                },
            ],
            "applicableLaw": "Hindu Succession Act 1956/2005",
            "coparcenaryType": "Mitakshara",
            "status": "SUCCESSION_PENDING",
        },
        "location": {
            "latitude": 19.8612,
            "longitude": 74.0000,
            "boundaryPolygon": generate_polygon(19.8612, 74.0000, 2.4),
        },
        "valuation": {
            "circleRateINR": 3_600_000,
            "lastAssessedDate": "2025-04-01",
        },
        "mutationHistory": [
            {
                "type": "Inheritance",
                "date": "1991-06-10",
                "officerName": "Patwari Bhausaheb More",
                "mutation_no": "MUT/2341/1991",
            }
        ],
        "ipfsCID": "QmRameshPatelSatbaraExtract2024",
        "createdAt": "2026-06-01T00:00:00Z",
        "sourceType": "RECORD_SCAN",
        "blockNumber": 1,
        "txHash": "0xdemo_ramesh_genesis_tx",
        "isDemoParcel": True,
        "demoScene": "primary",
    }

    # Tribal parcel for TribalGuard demo (Scene 6)
    tribal_owner_hash = aadhaar_hash("Mangal Bhil", "1962-08-20")
    tribal_parcel = {
        "dlpiId": "DLPI-MH-IGT-T0023",
        "surveyNumber": "23/1",
        "tehsil": "Igatpuri",
        "tehsilCode": "IGT",
        "district": "Nashik",
        "state": "Maharashtra",
        "landType": "Tribal_FRA",
        "landTypeDescription": "Tribal FRA patta (Schedule V)",
        "areaHectares": 1.8,
        "isTribal": True,
        "isCoparcenary": False,
        "scheduleVArea": True,
        "encumbranceStatus": "CLEAR",
        "owner": {
            "name": "Mangal Bhil",
            "aadhaarHash": tribal_owner_hash,
            "dob": "1962-08-20",
            "isTribal": True,
            "tribeId": "BHIL-MH-NSK-004892",
        },
        "tribalProtection": {
            "scheduleType": "Schedule V",
            "fraPatteNumber": "FRA/IGT/2009/0234",
            "gramSabhaVillage": "Ghoti Budruk",
            "gramSabhaId": "GSBH-IGT-0012",
            "protectionAct": ["Constitution Art.244", "FRA 2006 S.4", "5th Schedule"],
        },
        "location": {
            "latitude": 19.6983,
            "longitude": 73.5589,
            "boundaryPolygon": generate_polygon(19.6983, 73.5589, 1.8),
        },
        "valuation": {
            "circleRateINR": 360_000,
            "lastAssessedDate": "2025-04-01",
        },
        "mutationHistory": [],
        "ipfsCID": "QmTribalFRAPatteIgatpuri2009",
        "createdAt": "2026-06-01T00:00:00Z",
        "sourceType": "SVAMITVA",
        "blockNumber": 2,
        "txHash": "0xdemo_tribal_genesis_tx",
        "isDemoParcel": True,
        "demoScene": "tribal_guard",
    }

    return [main_parcel, tribal_parcel]


def main():
    print("Generating BhumiChain synthetic Nashik parcel dataset...")

    # Generate demo parcels first (fixed IDs)
    demo_parcels = generate_ramesh_family()
    demo_ids = {p["dlpiId"] for p in demo_parcels}

    # Generate 4,998 random parcels (total = 5,000 with 2 demo parcels)
    parcels = demo_parcels.copy()
    for i in range(3, 5001):
        parcel = generate_parcel(i)
        if parcel["dlpiId"] not in demo_ids:
            parcels.append(parcel)

    # Save full dataset
    output_path = "nashik_parcels.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(parcels, f, ensure_ascii=False, indent=2)
    print(f"✓ Generated {len(parcels)} parcels → {output_path}")

    # Save GeoJSON FeatureCollection for map
    features = []
    for p in parcels:
        feature = {
            "type": "Feature",
            "properties": {
                "dlpiId": p["dlpiId"],
                "owner": p["owner"]["name"],
                "landType": p["landType"],
                "areaHectares": p["areaHectares"],
                "encumbranceStatus": p["encumbranceStatus"],
                "isTribal": p["isTribal"],
                "isCoparcenary": p["isCoparcenary"],
                "tehsil": p["tehsil"],
                "surveyNumber": p["surveyNumber"],
                "circleRateINR": p["valuation"]["circleRateINR"],
            },
            "geometry": p["location"]["boundaryPolygon"],
        }
        features.append(feature)

    geojson = {"type": "FeatureCollection", "features": features}
    geojson_path = "nashik_parcels.geojson"
    with open(geojson_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)
    print(f"✓ Generated GeoJSON map file → {geojson_path}")

    # Stats
    land_type_counts = {}
    encumbrance_counts = {}
    tribal_count = sum(1 for p in parcels if p["isTribal"])
    coparcenary_count = sum(1 for p in parcels if p["isCoparcenary"])

    for p in parcels:
        land_type_counts[p["landType"]] = land_type_counts.get(p["landType"], 0) + 1
        encumbrance_counts[p["encumbranceStatus"]] = encumbrance_counts.get(p["encumbranceStatus"], 0) + 1

    print("\n── Dataset Statistics ──────────────────")
    print(f"Total parcels:      {len(parcels)}")
    print(f"Tribal parcels:     {tribal_count}")
    print(f"Coparcenary:        {coparcenary_count}")
    print("\nLand types:")
    for lt, count in sorted(land_type_counts.items(), key=lambda x: -x[1]):
        print(f"  {lt:20s}: {count}")
    print("\nEncumbrance status:")
    for es, count in sorted(encumbrance_counts.items(), key=lambda x: -x[1]):
        print(f"  {es:20s}: {count}")


if __name__ == "__main__":
    main()
