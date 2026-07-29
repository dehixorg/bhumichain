# BhumiChain — Complete System Workflow

> **National Digital Land Registry on Hyperledger Fabric v2.5**
> Uttar Pradesh Pilot · Gautam Buddha Nagar (Noida)

---

## 🏛️ System Architecture Overview

```
Citizen / Officer Browser
        │
        ▼
Next.js 14 Frontend (Port 3000)
        │
        ▼
REST API Gateway (FastAPI / Node)
        │
     ┌──┴──────────────────────┐
     │                         │
     ▼                         ▼
Hyperledger Fabric v2.5    AWS DynamoDB
(Blockchain Ledger)        (Scan Jobs / Off-chain)
     │
     ▼
Smart Contracts (Chaincode)
- LandRegistry
- MutationContract
- TransferContract
- SuccessionContract
- TribalGuardContract
```

---

## 👤 User Roles

| Role | Access Level | Key Actions |
|------|-------------|-------------|
| **Citizen** | Self only | View records, apply mutation, transfer, succession |
| **Patwari** | Village level | Claim parcels, RecordScan AI, verify fields |
| **Circle Inspector (Kanungo)** | Circle level | Approve patwari submissions, SRO scan review |
| **Tehsildar** | Tehsil level | Final approval, override, multi-sig |
| **Kotwal** | All | Emergency access, dispute resolution |

---

## 🔐 1. Authentication Flow

```
User visits /login
      │
      ├─► DigiLocker SSO (Primary)
      │       └─► Aadhaar-linked OAuth → JWT issued → redirect
      │
      ├─► Aadhaar OTP (Secondary)
      │       ├─► Enter 12-digit Aadhaar
      │       ├─► OTP sent to registered mobile
      │       ├─► Enter 6-digit OTP
      │       └─► JWT issued → role-based redirect
      │
      ├─► Mobile OTP
      │       └─► Enter +91 mobile → OTP → JWT
      │
      └─► JanParichay / State SSO
              └─► OAuth redirect → JWT
```

**JWT Payload:**
```json
{
  "sub": "aadhaarHash",
  "name": "Ramesh Kumar",
  "role": "citizen",
  "jurisdictionCode": "GBN-001",
  "aadhaarId": "xxxx-xxxx-1234",
  "exp": 1720000000
}
```

**Role-based Redirects:**
- `citizen` → `/my-parcels`
- `patwari` / `circle_inspector` / `tehsildar` / `kotwal` → `/officer-dashboard`

---

## 🗺️ 2. GIS Map & Parcel Discovery

```
/map page loads
     │
     ▼
Fetch GeoJSON from API
     │
     ▼
Leaflet renders parcels on CartoDB Positron tiles
     │
     ├─► Color-coded by land type:
     │     Green  = Bhumidhari (Permanent Occupancy)
     │     Blue   = Sirdar (Hereditary Tenancy)
     │     Orange = Tribal / FRA Protected
     │     Red    = Encumbered
     │     Gray   = Kharaba (Barren)
     │
     ├─► Click a parcel → ParcelPopup opens
     │     Shows: Owner, DLPI ID, Area, Status, Khata/Khasra No.
     │
     └─► WebSocket live events → parcel pulses on blockchain txn
```

---

## 📋 3. My Parcels Dashboard

```
Citizen logs in → /my-parcels
     │
     ▼
API: GET /parcels?aadhaarHash={hash}
     │
     ▼
Display parcel cards with:
  - DLPI ID (e.g. DLPI-GBN-001-0001)
  - Khata No / Khasra No
  - Area in hectares
  - Land type + encumbrance status
  - Tribal / Coparcenary flags
     │
     ▼
Quick actions per parcel:
  ├─► View full details
  ├─► Download RoR (Record of Rights)
  ├─► Apply for Mutation
  ├─► Initiate Transfer
  └─► Apply Succession
```

---

## ✏️ 4. Mutation Workflow

> **Mutation** = Change in ownership/cultivator records without transfer of title

```
STEP 1 — CITIZEN applies
─────────────────────────────────────────────────────────
Citizen → /mutation → fill form
  - Select parcel (DLPI ID)
  - Upload supporting documents
  - Submit → Status: CLAIM_SUBMITTED

STEP 2 — PATWARI reviews
─────────────────────────────────────────────────────────
Officer Queue shows new mutation
Patwari → /officer-dashboard → click mutation
  - Verify documents
  - Field inspection notes
  - Approve → Status: UNDER_REVIEW

STEP 3 — CIRCLE INSPECTOR (Kanungo) approves
─────────────────────────────────────────────────────────
  - Reviews patwari report
  - Cross-checks with Bhulekh UP portal
  - Approve → Status: CI_APPROVED
  - Blockchain txn: MutationApproved event fired

STEP 4 — TEHSILDAR final sign
─────────────────────────────────────────────────────────
  - Multi-sig required (2 of 3 officers must sign)
  - Sign on Fabric → Status: VERIFIED
  - RoR updated on blockchain
  - Citizen notified

Timeline: ~7-14 working days
```

---

## 🔄 5. Property Transfer Workflow

> **Transfer** = Permanent change of ownership (sale, gift, inheritance)

```
STEP 1 — Buyer + Seller initiate
─────────────────────────────────────────────────────────
/transfer page (TransferWizard)
  Phase 1: Enter buyer Aadhaar + details
  Phase 2: Compliance check runs automatically
    ├─► Encumbrance check (any loans/disputes?)
    ├─► Tribal land restriction check (Schedule V)
    ├─► Active mutation check
    └─► Pending dispute check
  Phase 3: Stamp duty calculation (INR)
  Phase 4: Payment (Razorpay integration)
  Phase 5: Submit to officer queue

STEP 2 — Patwari verification
─────────────────────────────────────────────────────────
  - Verify identity documents
  - Physical inspection
  - Approve → UNDER_REVIEW

STEP 3 — CI + Tehsildar multi-sig
─────────────────────────────────────────────────────────
  - 2-of-3 multi-sig on Hyperledger Fabric
  - Each officer signs with their Aadhaar key
  - On full consensus → transfer recorded on chain

STEP 4 — Completion
─────────────────────────────────────────────────────────
  - New owner reflected in parcel record
  - New RoR generated + both parties notified
```

---

## 👨‍👩‍👧 6. Succession Workflow

> **Succession** = Distribution of deceased person's land to legal heirs

```
STEP 1 — Heir files claim
─────────────────────────────────────────────────────────
/succession page
  - Select deceased's parcel (DLPI ID)
  - Upload: Death certificate, legal heir certificate
  - Add all heirs with Aadhaar IDs
  - Define share distribution (e.g. 33% each)
  - Submit → Status: CLAIM_SUBMITTED

STEP 2 — FamilyTree built
─────────────────────────────────────────────────────────
System generates visual family tree:
    Deceased (Ramesh Kumar)
    ├─► Heir 1: Priya Kumar  (33%)
    ├─► Heir 2: Arun Kumar   (33%)
    └─► Heir 3: Sunita Kumar (34%)

STEP 3 — Multi-sig consent
─────────────────────────────────────────────────────────
Each heir must digitally consent:
  ├─► Heir 1 logs in → reviews share → signs
  ├─► Heir 2 logs in → reviews share → signs
  └─► Heir 3 logs in → reviews share → signs
  All 3/3 must sign (configurable threshold)

STEP 4 — Officer verification
─────────────────────────────────────────────────────────
Patwari → CI → Tehsildar (same as mutation)

STEP 5 — Blockchain execution
─────────────────────────────────────────────────────────
  - Deceased's DLPI split into heir DLPIs
  - Each heir gets new DLPI ID
  - Shares recorded as coparcenary ownership
  - New RoRs generated for each heir

Dispute path:
  Any heir objects → Status: DISPUTED
  → NyayaAI generates legal brief
  → Referred to Revenue Court
```

---

## 📄 7. Encumbrance Certificate (EC)

```
Citizen → /ec
  - Select parcel DLPI ID
  - System queries blockchain for ALL transactions:
      ├─► Ownership history
      ├─► Mutations applied
      ├─► Transfers recorded
      ├─► Loans/liens registered
      └─► Disputes filed
  - Generate PDF certificate
  - Digitally signed by Tehsildar (on-chain)
  - Download → government-stamped EC document
```

---

## 🤖 8. RecordScan AI (Officer Tool)

> **AI-assisted digitization of physical Khatauni records**

```
Officer → /scan

STEP 1 — Upload
─────────────────
Drop UP Khatauni (खतौनी) image/PDF
Max 20 MB · JPEG, PNG, TIFF, PDF

STEP 2 — OCR Pipeline
────────────────────────
Azure Document Intelligence
  └─► Reads Devanagari + tabular Khatauni format
  └─► Extracts raw text

STEP 3 — NER (Named Entity Recognition)
──────────────────────────────────────────
LayoutLM model extracts:
  - Khata No, Khasra No
  - Owner name (Khatedar)
  - Area (hectares)
  - Land type
  - Village (Gram), Tehsil, District

STEP 4 — Validation
─────────────────────
Cross-check vs Bhulekh UP portal:
  ├─► Match: Confidence score shown
  └─► Mismatch: Flagged fields highlighted in amber

STEP 5 — DynamoDB
────────────────────
Scan job + extracted data persisted to AWS DynamoDB

STEP 6 — Officer Review
─────────────────────────
Officer reviews + edits inline
Adds notes

STEP 7 — Blockchain Submission
──────────────────────────────
Officer approves → DLPI record created on Fabric
Smart contract: LandRegistry.createParcel()
Returns new DLPI ID

Confidence levels:
  HIGH   (>85%)   → Auto-suggest, officer confirms
  MEDIUM (60-85%) → Officer reviews each field
  LOW    (<60%)   → Full manual entry required
```

---

## ⚖️ 9. NyayaAI — Legal Intelligence

```
/nyaya-ai

Input: Natural language legal question
  e.g. "Can a tribal land be transferred to a non-tribal?"

Processing:
  ├─► Query vector DB of UP Revenue laws
  ├─► UP Zamindari Abolition & Land Reforms Act 1950
  ├─► UP Revenue Code 2006
  ├─► Forest Rights Act (FRA) 2006
  └─► Recent Revenue Court judgements

Output:
  - Plain language answer
  - Relevant legal sections cited
  - Recommended action
  - Officer can generate formal legal brief PDF
```

---

## 🛡️ 10. TribalGuard

> **Automatic protection for Scheduled Tribe land**

```
Every transfer/mutation request → TribalGuard runs:

Check 1: Is seller tribal (ST)?
  └─► Yes → Is buyer also tribal?
        ├─► Yes → Allowed
        └─► No  → HARD BLOCK (Schedule V violation)

Check 2: Gram Sabha consent required

Check 3: Collector approval required

If violation detected:
  → Transfer REJECTED with legal reason
  → TribalReject modal shown
  → Audit log written to blockchain
  → Alert to District Tribal Welfare Office
```

---

## 📡 11. Live Events (WebSocket)

```
Events fired on every blockchain transaction:
  ├─► MutationApproved      → Green toast + map pulse
  ├─► TransferCompleted     → Blue toast + parcel highlight
  ├─► SuccessionExecuted    → Purple toast
  ├─► TribalViolationHard   → Red toast + alert
  ├─► AuctionBidPlaced      → Yellow toast
  └─► RecordScanApproved    → Info toast

GIS Map parcels pulse yellow for 4 seconds on any event
Officer dashboard shows live activity feed
```

---

## 🔗 12. Blockchain Data Model

```json
DLPI Format: DLPI-{district}-{tehsil}-{sequence}
Example:     DLPI-GBN-001-0042

Parcel Record (on-chain):
{
  "dlpiId":             "DLPI-GBN-001-0042",
  "khataNo":            "142",
  "khasraNo":           "312/1A",
  "ownerAadhaarHash":   "sha256:...",
  "ownerName":          "Ramesh Kumar",
  "areaHectares":       2.4,
  "landType":           "BHUMIDHARI",
  "encumbranceStatus":  "CLEAR",
  "isTribal":           false,
  "isCoparcenary":      false,
  "gram":               "Dadri",
  "tehsil":             "Dadri",
  "district":           "Gautam Buddha Nagar",
  "createdAt":          "2026-01-15T10:30:00Z",
  "lastUpdated":        "2026-06-20T14:22:00Z",
  "txHash":             "0xabc123..."
}
```

---

## 📊 13. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript, TailwindCSS |
| **Blockchain** | Hyperledger Fabric v2.5 (Permissioned) |
| **Smart Contracts** | Go chaincode |
| **API Gateway** | FastAPI (Python) / Node.js |
| **OCR / AI** | Azure Document Intelligence, LayoutLM NER |
| **Database** | AWS DynamoDB (off-chain scan jobs) |
| **GIS Maps** | Leaflet.js + CartoDB Positron tiles |
| **Auth** | JWT + Aadhaar OTP + DigiLocker OAuth |
| **WebSockets** | Socket.io (live blockchain events) |
| **Hosting** | NIC Government Cloud / AWS |
| **Payments** | Razorpay (stamp duty collection) |

---

## 🚀 Quick Start (Development)

```bash
# Clone
git clone https://github.com/dehixorg/bhumichain.git
cd bhumichain
git checkout second

# Frontend
cd frontend/web-portal
npm install
npm run dev
# → http://localhost:3000

# Environment variables
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_FABRIC_MODE=mock   # or 'real' for blockchain
```

---

## 🔑 Demo Credentials

| Role | Aadhaar | Email | OTP |
|------|---------|-------|-----|
| Tehsildar — Amit Saxena | 9999-0001-0001 | amit.saxena@up.gov.in | 123456 |
| Kanungo — Rajesh Verma | 9999-0001-0002 | rajesh.verma@up.gov.in | 123456 |
| Patwari — Vijay Singh | 9999-0001-0003 | vijay.singh@up.gov.in | 123456 |
| Deceased — Ramesh Kumar | 9999-0001-0009 | — | 123456 |
| Heir 1 — Priya Kumar | 9999-0001-0010 | — | 123456 |
| Heir 2 — Arun Kumar | 9999-0001-0014 | — | 123456 |
| Heir 3 — Sunita Kumar | 9999-0001-0015 | — | 123456 |

---

*BhumiChain © 2026 · Government of India · Ministry of Rural Development · NIC*
