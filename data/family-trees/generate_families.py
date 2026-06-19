"""
BhumiChain — Coparcenary Family Tree Generator
Generates 50 realistic Mitakshara coparcenary families for Nashik demo
"""

import json
import random
import hashlib
from datetime import datetime, timedelta

random.seed(99)

SURNAMES = ["Patil", "Shinde", "Jadhav", "Pawar", "Salve", "Bhosale", "More",
            "Gaikwad", "Deshmukh", "Kulkarni", "Joshi", "Rane", "Naik"]
MALE_NAMES = ["Ramesh", "Suresh", "Arun", "Vijay", "Sanjay", "Rajesh", "Mahesh",
              "Balasaheb", "Dnyaneshwar", "Tukaram", "Namdev", "Eknath", "Ganesh"]
FEMALE_NAMES = ["Sunita", "Priya", "Kavita", "Anita", "Rekha", "Meena", "Lata",
                "Savita", "Nanda", "Shobha", "Vandana", "Usha"]

APPLICABLE_LAWS = [
    {"law": "Hindu Succession Act 1956/2005", "type": "Mitakshara", "weight": 75},
    {"law": "Muslim Personal Law (Shariat) 1937", "type": "Hanafi", "weight": 15},
    {"law": "Indian Succession Act 1925", "type": "Christian", "weight": 10},
]


def aadhaar_hash(name, dob):
    return hashlib.sha256(f"{name}-{dob}-{random.randint(1, 999999)}".encode()).hexdigest()[:32]


def random_dob(min_year=1940, max_year=1970):
    start = datetime(min_year, 1, 1)
    end = datetime(max_year, 12, 31)
    return (start + timedelta(days=random.randint(0, (end - start).days))).strftime("%Y-%m-%d")


def weighted_choice(items):
    total = sum(i["weight"] for i in items)
    r = random.uniform(0, total)
    cumulative = 0
    for item in items:
        cumulative += item["weight"]
        if r <= cumulative:
            return item
    return items[-1]


def compute_hsa_shares(members):
    """
    Compute shares under Hindu Succession Act 2005:
    - Sons and daughters get equal shares (post-2005 amendment)
    - Widow gets 1 share equal to each child
    """
    class_1_heirs = [m for m in members if m["relation"] in
                     ("Son", "Daughter", "Widow", "Widower")]
    if not class_1_heirs:
        return members

    n = len(class_1_heirs)
    share_fraction = f"1/{n}"
    share_decimal = round(1 / n, 6)

    for m in members:
        if m in class_1_heirs:
            m["share"] = share_fraction
            m["shareDecimal"] = share_decimal
            if m["relation"] == "Daughter":
                m["legalNote"] = "Equal coparcenary right per HSA 2005 S.6(3) — non-bypassable"
        else:
            m["share"] = "0"
            m["shareDecimal"] = 0.0
    return members


def generate_family(index: int, surname: str = None) -> dict:
    law_obj = weighted_choice(APPLICABLE_LAWS)
    surname = surname or random.choice(SURNAMES)

    # Patriarch (deceased — triggering succession)
    patriarch_name = f"{random.choice(MALE_NAMES)} {random.choice(MALE_NAMES[:5])} {surname}"
    patriarch_dob = random_dob(1935, 1960)
    patriarch_dod_year = random.randint(2020, 2026)
    patriarch_dod = f"{patriarch_dod_year}-{random.randint(1,12):02d}-{random.randint(1,28):02d}"

    members = []

    # Widow (50% chance)
    has_widow = random.random() < 0.5
    if has_widow:
        widow_name = f"{random.choice(FEMALE_NAMES)} {random.choice(MALE_NAMES[:5])} {surname}"
        members.append({
            "memberId": f"MBR-{index:03d}-W",
            "name": widow_name,
            "relation": "Widow",
            "gender": "F",
            "dob": random_dob(1940, 1965),
            "aadhaarHash": aadhaar_hash(widow_name, patriarch_dob),
            "isAlive": True,
            "isAdult": True,
        })

    # Sons: 1–3
    n_sons = random.randint(1, 3)
    for i in range(n_sons):
        son_fname = random.choice(MALE_NAMES)
        son_name = f"{son_fname} {patriarch_name.split()[0]} {surname}"
        son_dob = random_dob(1975, 1995)
        members.append({
            "memberId": f"MBR-{index:03d}-S{i+1}",
            "name": son_name,
            "relation": "Son",
            "gender": "M",
            "dob": son_dob,
            "aadhaarHash": aadhaar_hash(son_name, son_dob),
            "isAlive": True,
            "isAdult": True,
        })

    # Daughters: 0–2 (always include at least 1 to show HSA 2005 enforcement)
    n_daughters = random.randint(1, 2)
    for i in range(n_daughters):
        dau_fname = random.choice(FEMALE_NAMES)
        dau_name = f"{dau_fname} {patriarch_name.split()[0]} {surname}"
        dau_dob = random_dob(1978, 1998)
        members.append({
            "memberId": f"MBR-{index:03d}-D{i+1}",
            "name": dau_name,
            "relation": "Daughter",
            "gender": "F",
            "dob": dau_dob,
            "aadhaarHash": aadhaar_hash(dau_name, dau_dob),
            "isAlive": True,
            "isAdult": True,
        })

    # Compute shares based on applicable law
    if law_obj["law"] == "Hindu Succession Act 1956/2005":
        members = compute_hsa_shares(members)

    # Disputed? (10% chance)
    is_disputed = random.random() < 0.10
    dispute_info = None
    if is_disputed:
        disputed_member = random.choice(members)
        dispute_info = {
            "type": "ContestingShare",
            "filedBy": disputed_member["name"],
            "eCourtsNo": f"CNS/{random.randint(1000,9999)}/{random.randint(2020,2025)}",
            "court": f"Civil Court {random.choice(['Nashik', 'Sinnar', 'Dindori'])}",
            "status": "PENDING",
        }

    family = {
        "familyId": f"FAM-MH-NSK-{index:03d}",
        "patriarch": {
            "name": patriarch_name,
            "aadhaarHash": aadhaar_hash(patriarch_name, patriarch_dob),
            "dob": patriarch_dob,
            "dod": patriarch_dod,
            "isAlive": False,
        },
        "surname": surname,
        "applicableLaw": law_obj["law"],
        "coparcenaryType": law_obj["type"],
        "members": members,
        "totalHeirs": len(members),
        "parcelsOwned": [],      # filled by parcel generator when linking
        "successionStatus": "COURT_REFERRED" if is_disputed else "PENDING_CONSENT",
        "disputeInfo": dispute_info,
        "deathCertificateIPFS": f"QmDeathCert{index:04d}",
        "crsRegistrationNo": f"CRS/NSK/{patriarch_dod_year}/{random.randint(10000,99999)}",
        "triggeredAt": f"{patriarch_dod}T08:00:00Z",
    }

    return family


def generate_ramesh_family_exact() -> dict:
    """Exact family tree for demo Scene 3"""
    return {
        "familyId": "FAM-MH-SNN-001",
        "patriarch": {
            "name": "Ramesh Dattatray Patil",
            "aadhaarHash": hashlib.sha256("Ramesh-1958-demo".encode()).hexdigest()[:32],
            "dob": "1958-03-15",
            "dod": "2026-05-20",
            "isAlive": False,
        },
        "surname": "Patil",
        "applicableLaw": "Hindu Succession Act 1956/2005",
        "coparcenaryType": "Mitakshara",
        "members": [
            {
                "memberId": "MBR-001-S1",
                "name": "Arun Ramesh Patil",
                "relation": "Son",
                "gender": "M",
                "dob": "1982-07-10",
                "aadhaarHash": hashlib.sha256("Arun-1982-demo".encode()).hexdigest()[:32],
                "isAlive": True,
                "isAdult": True,
                "share": "1/3",
                "shareDecimal": 0.3333,
                "phone": "+91-9876543210",
            },
            {
                "memberId": "MBR-001-S2",
                "name": "Vijay Ramesh Patil",
                "relation": "Son",
                "gender": "M",
                "dob": "1985-11-22",
                "aadhaarHash": hashlib.sha256("Vijay-1985-demo".encode()).hexdigest()[:32],
                "isAlive": True,
                "isAdult": True,
                "share": "1/3",
                "shareDecimal": 0.3333,
                "phone": "+91-9876543211",
            },
            {
                "memberId": "MBR-001-D1",
                "name": "Sunita Ramesh Patil",
                "relation": "Daughter",
                "gender": "F",
                "dob": "1988-04-05",
                "aadhaarHash": hashlib.sha256("Sunita-1988-demo".encode()).hexdigest()[:32],
                "isAlive": True,
                "isAdult": True,
                "share": "1/3",
                "shareDecimal": 0.3333,
                "legalNote": "Equal coparcenary right per HSA 2005 S.6(3) — non-bypassable",
                "phone": "+91-9876543212",
                "whatsapp": "+91-9876543212",
            },
        ],
        "totalHeirs": 3,
        "parcelsOwned": ["DLPI-MH-SNN-00142"],
        "successionStatus": "PENDING_CONSENT",
        "disputeInfo": None,
        "deathCertificateIPFS": "QmRameshDeathCertificateMay2026",
        "crsRegistrationNo": "CRS/NSK/2026/84231",
        "triggeredAt": "2026-05-20T09:15:00Z",
        "isDemoFamily": True,
    }


def main():
    print("Generating BhumiChain family tree dataset...")

    families = [generate_ramesh_family_exact()]

    for i in range(2, 51):
        families.append(generate_family(i))

    output_path = "nashik_families.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(families, f, ensure_ascii=False, indent=2)

    print(f"✓ Generated {len(families)} family trees → {output_path}")

    # Stats
    disputed = sum(1 for f in families if f.get("disputeInfo"))
    avg_heirs = sum(f["totalHeirs"] for f in families) / len(families)
    daughters_in_all = sum(
        sum(1 for m in f["members"] if m["relation"] == "Daughter")
        for f in families
    )
    print(f"  Disputed families:   {disputed}")
    print(f"  Avg heirs per family: {avg_heirs:.1f}")
    print(f"  Total daughters (HSA 2005 enforcement): {daughters_in_all}")


if __name__ == "__main__":
    main()
