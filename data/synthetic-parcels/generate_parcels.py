"""
BhumiChain — Synthetic Gautam Buddha Nagar (Noida) Parcel Generator
Generates 500 realistic land parcels for Dadri tehsil, GBN district demo
"""

import json
import random
import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List

random.seed(42)

# ─── GBN / Noida Geography ────────────────────────────────────────────────────
# Bounding box for Gautam Buddha Nagar: 28.45°N–28.70°N, 77.40°E–77.75°E
GBN_BOUNDS = {
    "min_lat": 28.45, "max_lat": 28.70,
    "min_lon": 77.40, "max_lon": 77.75,
}

TEHSIL = {"name": "Dadri", "code": "DAD", "urban_ratio": 0.55}

# UP land tenure types
LAND_TYPES = [
    {"type": "Bhumidhari",    "desc": "Hereditary tenant with full rights",   "weight": 40},
    {"type": "Sirdar",        "desc": "Hereditary tenant with limited rights", "weight": 20},
    {"type": "Residential",   "desc": "Residential plot / abadi",             "weight": 18},
    {"type": "Commercial",    "desc": "Commercial / industrial plot",          "weight": 8},
    {"type": "Tribal_FRA",    "desc": "Tribal / forest rights patta",         "weight": 4},
    {"type": "Govt_Reserved", "desc": "Government / gram sabha land",         "weight": 10},
]

ENCUMBRANCE_STATUS = [
    {"status": "CLEAR",            "weight": 62},
    {"status": "MORTGAGED",        "weight": 20},
    {"status": "COURT_INJUNCTION", "weight": 9},
    {"status": "IT_ATTACHMENT",    "weight": 5},
    {"status": "DISPUTED",         "weight": 4},
]

CLAIM_STATUS_WEIGHTS = [
    {"status": "SEEDED_UNVERIFIED", "weight": 30},
    {"status": "CLAIM_SUBMITTED",   "weight": 15},
    {"status": "UNDER_REVIEW",      "weight": 15},
    {"status": "CI_APPROVED",       "weight": 10},
    {"status": "VERIFIED",          "weight": 25},
    {"status": "DISPUTED",          "weight": 4},
    {"status": "REJECTED",          "weight": 1},
]

UP_FIRST_NAMES = [
    "Ramesh", "Suresh", "Arun", "Vijay", "Sanjay", "Rajesh", "Mahesh",
    "Sunita", "Priya", "Kavita", "Anita", "Rekha", "Meena", "Lata",
    "Mohan", "Sohan", "Girish", "Dinesh", "Naresh", "Umesh", "Ganesh",
    "Savita", "Geeta", "Seema", "Pushpa", "Saroj", "Usha", "Kamla",
]
UP_SURNAMES = [
    "Sharma", "Verma", "Gupta", "Singh", "Yadav", "Chaudhary", "Saxena",
    "Mishra", "Pandey", "Tripathi", "Srivastava", "Agarwal", "Jain",
    "Rawat", "Kumar", "Prasad", "Dubey", "Tiwari", "Shukla", "Bajpai",
]
TRIBAL_FIRST_NAMES = ["Mangal", "Laxmi", "Balu", "Ramu", "Shanta", "Kalu", "Dhani"]
TRIBAL_SURNAMES    = ["Gond", "Kol", "Bhil", "Sahariya", "Tharu", "Musahar"]

# Demo citizen aadhaar → placeholder (seed script resolves to real hash via oracle)
DEMO_CITIZEN_PLACEHOLDERS = {
    "999900010010": "__HASH_PRIYA__",
    "999900010011": "__HASH_ARUN__",
    "999900010012": "__HASH_SURESH__",
    "999900010013": "__HASH_MEENA__",
    "999900010020": "__HASH_RAMKALI__",
}


def weighted_choice(items, key="weight"):
    total = sum(i[key] for i in items)
    r     = random.uniform(0, total)
    cumul = 0
    for item in items:
        cumul += item[key]
        if r <= cumul:
            return item
    return items[-1]


def random_name(is_tribal=False):
    if is_tribal:
        return f"{random.choice(TRIBAL_FIRST_NAMES)} {random.choice(TRIBAL_SURNAMES)}"
    return f"{random.choice(UP_FIRST_NAMES)} {random.choice(UP_SURNAMES)}"


def sim_aadhaar_hash(name: str, seed: str) -> str:
    fake = f"{name}-{seed}-{random.randint(100000000000, 999999999999)}"
    return hashlib.sha256(fake.encode()).hexdigest()[:32]


def random_dob():
    start = datetime(1945, 1, 1)
    end   = datetime(1985, 12, 31)
    return (start + timedelta(days=random.randint(0, (end - start).days))).strftime("%Y-%m-%d")


def generate_polygon(lat: float, lon: float, area_ha: float) -> dict:
    # 1° lat ≈ 111 km, 1° lon ≈ 96 km at Noida latitude
    side_m  = (area_ha * 10000) ** 0.5
    dlat    = (side_m / 111000) * random.uniform(0.8, 1.2)
    dlon    = (side_m / 96000)  * random.uniform(0.8, 1.2)
    corners = [
        [lon - dlon/2, lat - dlat/2],
        [lon + dlon/2, lat - dlat/2],
        [lon + dlon/2, lat + dlat/2],
        [lon - dlon/2, lat + dlat/2],
        [lon - dlon/2, lat - dlat/2],
    ]
    return {"type": "Polygon", "coordinates": [corners]}


def random_valuation(land_type: str, area_ha: float) -> int:
    base_rates = {
        "Bhumidhari":    1_200_000,
        "Sirdar":          900_000,
        "Residential":   5_000_000,
        "Commercial":   12_000_000,
        "Tribal_FRA":      300_000,
        "Govt_Reserved":         0,
    }
    rate = base_rates.get(land_type, 1_000_000)
    return int(rate * area_ha * random.uniform(0.85, 1.15))


def generate_parcel(index: int) -> dict:
    land_type_obj = weighted_choice(LAND_TYPES)
    land_type     = land_type_obj["type"]
    is_tribal     = land_type == "Tribal_FRA"
    encumbrance   = weighted_choice(ENCUMBRANCE_STATUS)
    claim_status  = weighted_choice(CLAIM_STATUS_WEIGHTS)["status"]

    if land_type == "Residential":
        area_ha = round(random.uniform(0.005, 0.06), 4)
    elif land_type == "Commercial":
        area_ha = round(random.uniform(0.01, 0.25), 4)
    elif land_type in ["Bhumidhari", "Sirdar"]:
        area_ha = round(random.uniform(0.5, 5.0), 4)
    elif land_type == "Tribal_FRA":
        area_ha = round(random.uniform(1.0, 3.5), 4)
    else:
        area_ha = round(random.uniform(2.0, 30.0), 4)

    lat = random.uniform(GBN_BOUNDS["min_lat"], GBN_BOUNDS["max_lat"])
    lon = random.uniform(GBN_BOUNDS["min_lon"], GBN_BOUNDS["max_lon"])

    owner_name = random_name(is_tribal)
    owner_dob  = random_dob()
    owner_hash = sim_aadhaar_hash(owner_name, owner_dob)

    is_coparcenary = (
        land_type in ["Bhumidhari", "Sirdar", "Tribal_FRA"]
        and random.random() < 0.35
    )

    khasra        = random.randint(1, 2000)
    khata         = random.randint(1, 500)
    sub           = random.choice(["", "/1", "/2", "/3", "क", "ख"])
    survey_number = f"{khasra}{sub}/{khata}"

    n_mutations    = random.randint(0, 3)
    mutation_history = []
    mutation_date  = datetime(1990, 1, 1)
    for _ in range(n_mutations):
        mutation_date += timedelta(days=random.randint(365, 2500))
        if mutation_date > datetime.now():
            break
        mutation_history.append({
            "type":        random.choice(["Vikray (Sale)", "Virasat (Inheritance)", "Vibhajan (Partition)", "Daan (Gift)"]),
            "date":        mutation_date.strftime("%Y-%m-%d"),
            "officerName": f"Lekhpal {random_name()}",
            "mutationNo":  f"DM/DAD/{random.randint(1000, 9999)}/{mutation_date.year}",
        })

    return {
        "dlpiId":            f"DLPI-UP-DAD-{str(index).zfill(5)}",
        "khataNo":           str(khata),
        "khasraNo":          survey_number,
        "tehsil":            TEHSIL["name"],
        "tehsilCode":        TEHSIL["code"],
        "district":          "Gautam Buddha Nagar",
        "districtCode":      "UP-GBN",
        "state":             "Uttar Pradesh",
        "landType":          land_type,
        "landTypeDesc":      land_type_obj["desc"],
        "areaHectares":      area_ha,
        "isTribal":          is_tribal,
        "isCoparcenary":     is_coparcenary,
        "encumbranceStatus": encumbrance["status"],
        "claimStatus":       claim_status,
        "owner": {
            "name":        owner_name,
            "aadhaarHash": owner_hash,
            "dob":         owner_dob,
            "isTribal":    is_tribal,
        },
        "location": {
            "latitude":        round(lat, 6),
            "longitude":       round(lon, 6),
            "boundaryPolygon": generate_polygon(lat, lon, area_ha),
        },
        "valuation": {
            "circleRateINR":    random_valuation(land_type, area_ha),
            "lastAssessedDate": "2025-04-01",
        },
        "mutationHistory": mutation_history,
        "ipfsCID":         f"Qm{uuid.uuid4().hex[:44]}",
        "createdAt":       "2026-06-01T00:00:00Z",
        "sourceType":      "DILRMP_MIGRATION",
        "blockNumber":     random.randint(1, 5000),
        "txHash":          f"0x{uuid.uuid4().hex}",
    }


def generate_demo_parcels() -> List[dict]:
    """Fixed parcels for the demo citizen personas — all in Dadri tehsil."""
    demo_centers = [
        (28.5706, 77.5413),  # Priya 1 — Sector 62 Noida
        (28.5480, 77.5620),  # Priya 2 — Noida Extension
        (28.6010, 77.4850),  # Arun — Dadri town
        (28.5280, 77.6100),  # Suresh — Greater Noida
        (28.5900, 77.4700),  # Meena — Jewar area
        (28.6300, 77.4500),  # Ramkali (tribal) — Sikandrabad area
    ]

    return [
        {
            "dlpiId": "DLPI-UP-DAD-00001", "khataNo": "101", "khasraNo": "1842/101",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Residential", "landTypeDesc": "Residential plot / abadi",
            "areaHectares": 0.025, "isTribal": False, "isCoparcenary": False,
            "encumbranceStatus": "CLEAR", "claimStatus": "VERIFIED",
            "owner": {"name": "Priya Kumar", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010010"], "dob": "1990-04-15", "isTribal": False},
            "location": {"latitude": demo_centers[0][0], "longitude": demo_centers[0][1], "boundaryPolygon": generate_polygon(demo_centers[0][0], demo_centers[0][1], 0.025)},
            "valuation": {"circleRateINR": 3_750_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [{"type": "Vikray (Sale)", "date": "2019-03-10", "officerName": "Lekhpal Anil Verma", "mutationNo": "DM/DAD/4521/2019"}],
            "ipfsCID": "QmPriyaKumarResidentialDadri2019", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "DILRMP_MIGRATION", "blockNumber": 1, "txHash": "0xdemo_priya1_tx", "isDemoParcel": True,
        },
        {
            "dlpiId": "DLPI-UP-DAD-00002", "khataNo": "102", "khasraNo": "1200/102",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Bhumidhari", "landTypeDesc": "Hereditary tenant with full rights",
            "areaHectares": 1.2, "isTribal": False, "isCoparcenary": True,
            "encumbranceStatus": "MORTGAGED", "claimStatus": "UNDER_REVIEW",
            "owner": {"name": "Priya Kumar", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010010"], "dob": "1990-04-15", "isTribal": False},
            "location": {"latitude": demo_centers[1][0], "longitude": demo_centers[1][1], "boundaryPolygon": generate_polygon(demo_centers[1][0], demo_centers[1][1], 1.2)},
            "valuation": {"circleRateINR": 1_440_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [], "ipfsCID": "QmPriyaKumarBhumidhari2026", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "DILRMP_MIGRATION", "blockNumber": 2, "txHash": "0xdemo_priya2_tx", "isDemoParcel": True,
        },
        {
            "dlpiId": "DLPI-UP-DAD-00003", "khataNo": "201", "khasraNo": "740/201",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Bhumidhari", "landTypeDesc": "Hereditary tenant with full rights",
            "areaHectares": 2.4, "isTribal": False, "isCoparcenary": True,
            "encumbranceStatus": "CLEAR", "claimStatus": "SEEDED_UNVERIFIED",
            "owner": {"name": "Arun Sharma", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010011"], "dob": "1985-09-22", "isTribal": False},
            "coparcenary": {
                "heirs": [
                    {"name": "Arun Sharma", "relation": "Self", "share": "1/2", "shareDecimal": 0.5},
                    {"name": "Sushma Sharma", "relation": "Wife", "share": "1/4", "shareDecimal": 0.25},
                    {"name": "Rohan Sharma", "relation": "Son", "share": "1/4", "shareDecimal": 0.25},
                ],
                "coparcenaryType": "Mitakshara", "applicableLaw": "Hindu Succession Act 1956/2005", "status": "ACTIVE",
            },
            "location": {"latitude": demo_centers[2][0], "longitude": demo_centers[2][1], "boundaryPolygon": generate_polygon(demo_centers[2][0], demo_centers[2][1], 2.4)},
            "valuation": {"circleRateINR": 2_880_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [{"type": "Virasat (Inheritance)", "date": "2015-08-11", "officerName": "Lekhpal Ramesh Yadav", "mutationNo": "DM/DAD/3890/2015"}],
            "ipfsCID": "QmArunSharmaBhumidhari2024", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "DILRMP_MIGRATION", "blockNumber": 3, "txHash": "0xdemo_arun_tx", "isDemoParcel": True,
        },
        {
            "dlpiId": "DLPI-UP-DAD-00004", "khataNo": "301", "khasraNo": "999/301",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Residential", "landTypeDesc": "Residential plot / abadi",
            "areaHectares": 0.04, "isTribal": False, "isCoparcenary": False,
            "encumbranceStatus": "COURT_INJUNCTION", "claimStatus": "DISPUTED",
            "disputeNote": "Boundary encroachment alleged by adjacent plot owner. Civil suit filed in Dadri court (CS/2025/0441).",
            "owner": {"name": "Suresh Yadav", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010012"], "dob": "1978-12-03", "isTribal": False},
            "location": {"latitude": demo_centers[3][0], "longitude": demo_centers[3][1], "boundaryPolygon": generate_polygon(demo_centers[3][0], demo_centers[3][1], 0.04)},
            "valuation": {"circleRateINR": 4_800_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [], "ipfsCID": "QmSureshYadavResidential2026", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "DILRMP_MIGRATION", "blockNumber": 4, "txHash": "0xdemo_suresh_tx", "isDemoParcel": True,
        },
        {
            "dlpiId": "DLPI-UP-DAD-00005", "khataNo": "401", "khasraNo": "380/401",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Sirdar", "landTypeDesc": "Hereditary tenant with limited rights",
            "areaHectares": 0.8, "isTribal": False, "isCoparcenary": False,
            "encumbranceStatus": "CLEAR", "claimStatus": "CLAIM_SUBMITTED",
            "owner": {"name": "Meena Devi", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010013"], "dob": "1972-06-18", "isTribal": False},
            "location": {"latitude": demo_centers[4][0], "longitude": demo_centers[4][1], "boundaryPolygon": generate_polygon(demo_centers[4][0], demo_centers[4][1], 0.8)},
            "valuation": {"circleRateINR": 720_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [], "ipfsCID": "QmMeenaDeviSirdar2026", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "DILRMP_MIGRATION", "blockNumber": 5, "txHash": "0xdemo_meena_tx", "isDemoParcel": True,
        },
        {
            "dlpiId": "DLPI-UP-DAD-00006", "khataNo": "501", "khasraNo": "120/501",
            "tehsil": "Dadri", "tehsilCode": "DAD",
            "district": "Gautam Buddha Nagar", "districtCode": "UP-GBN", "state": "Uttar Pradesh",
            "landType": "Tribal_FRA", "landTypeDesc": "Tribal / forest rights patta",
            "areaHectares": 2.1, "isTribal": True, "isCoparcenary": False,
            "encumbranceStatus": "CLEAR", "claimStatus": "VERIFIED",
            "owner": {"name": "Ramkali Gond", "aadhaarHash": DEMO_CITIZEN_PLACEHOLDERS["999900010020"], "dob": "1968-02-10", "isTribal": True, "community": "Gond", "tribeId": "GOND-UP-GBN-002481"},
            "tribalProtection": {
                "scheduleType": "Schedule V", "fraPatteNumber": "FRA/DAD/2011/0088",
                "gramSabhaVillage": "Roja Yakubpur", "gramSabhaId": "GSBH-DAD-0007",
                "protectionAct": ["Constitution Art.244", "FRA 2006 S.4", "5th Schedule"],
            },
            "location": {"latitude": demo_centers[5][0], "longitude": demo_centers[5][1], "boundaryPolygon": generate_polygon(demo_centers[5][0], demo_centers[5][1], 2.1)},
            "valuation": {"circleRateINR": 630_000, "lastAssessedDate": "2025-04-01"},
            "mutationHistory": [], "ipfsCID": "QmRamkaliGondFRADadri2011", "createdAt": "2026-06-01T00:00:00Z",
            "sourceType": "SVAMITVA", "blockNumber": 6, "txHash": "0xdemo_ramkali_tx",
            "isDemoParcel": True, "demoScene": "tribal_guard",
        },
    ]


def main():
    print("Generating BhumiChain synthetic Noida/GBN parcel dataset...")

    demo_parcels = generate_demo_parcels()
    demo_ids     = {p["dlpiId"] for p in demo_parcels}

    parcels = demo_parcels.copy()
    i = 7
    while len(parcels) < 500:
        p = generate_parcel(i)
        if p["dlpiId"] not in demo_ids:
            parcels.append(p)
        i += 1

    out = "noida_parcels.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(parcels, f, ensure_ascii=False, indent=2)
    print(f"✓ {len(parcels)} parcels → {out}")

    features = []
    for p in parcels:
        features.append({
            "type": "Feature",
            "properties": {
                "dlpiId":            p["dlpiId"],
                "owner":             p["owner"]["name"],
                "landType":          p["landType"],
                "areaHectares":      p["areaHectares"],
                "encumbranceStatus": p["encumbranceStatus"],
                "claimStatus":       p["claimStatus"],
                "isTribal":          p["isTribal"],
                "isCoparcenary":     p["isCoparcenary"],
                "tehsil":            p["tehsil"],
                "khasraNo":          p["khasraNo"],
                "circleRateINR":     p["valuation"]["circleRateINR"],
            },
            "geometry": p["location"]["boundaryPolygon"],
        })

    geojson_out = "noida_parcels.geojson"
    with open(geojson_out, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False)
    print(f"✓ GeoJSON → {geojson_out}")

    tribal_count      = sum(1 for p in parcels if p["isTribal"])
    coparcenary_count = sum(1 for p in parcels if p["isCoparcenary"])
    lt_counts, cs_counts = {}, {}
    for p in parcels:
        lt_counts[p["landType"]]    = lt_counts.get(p["landType"], 0) + 1
        cs_counts[p["claimStatus"]] = cs_counts.get(p["claimStatus"], 0) + 1

    print(f"\n── Dataset Statistics ──────────────────")
    print(f"Total parcels:   {len(parcels)}")
    print(f"Tribal:          {tribal_count}")
    print(f"Coparcenary:     {coparcenary_count}")
    print("\nLand types:")
    for lt, cnt in sorted(lt_counts.items(), key=lambda x: -x[1]):
        print(f"  {lt:20s}: {cnt}")
    print("\nClaim status:")
    for cs, cnt in sorted(cs_counts.items(), key=lambda x: -x[1]):
        print(f"  {cs:25s}: {cnt}")
    print("\nNOTE: Demo parcels use __HASH_xxx__ placeholders.")
    print("Run 'node scripts/seed-district.js' to resolve hashes and seed to Fabric.")


if __name__ == "__main__":
    main()
