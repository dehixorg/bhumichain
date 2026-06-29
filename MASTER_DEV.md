# BhumiChain — Master Development Guide
> CDAC Blockchain India Challenge 2026 | Phase 2 POC
> Living document — updated as decisions are made
> Last updated: 2026-06-29

---

## Table of Contents

1. [Pilot Scope](#1-pilot-scope)
2. [Authentication & Login Architecture](#2-authentication--login-architecture)
3. [Data Onboarding — How Records Enter the Chain](#3-data-onboarding--how-records-enter-the-chain)
4. [User Roles & Permissions Matrix](#4-user-roles--permissions-matrix)
5. [Module Development Plan](#5-module-development-plan)
6. [API Design](#6-api-design)
7. [Blockchain Network Setup](#7-blockchain-network-setup)
8. [Frontend Pages & Flows](#8-frontend-pages--flows)
9. [Demo Script (8 Minutes)](#9-demo-script-8-minutes)
10. [Open Decisions](#10-open-decisions)

---

## 1. Pilot Scope

**District:** Gautam Buddha Nagar (Noida), Uttar Pradesh
**Tehsil:** Dadri (covers Noida + Greater Noida) + Jewar stub
**Parcel count:** 500 dummy property records (UP Khatauni format)
**Channels:** 1 state channel (UP) + 1 national channel stub
**Languages:** English + Hindi (for BhumiGPT and BhumiSeva)
**Land document:** UP Khatauni (Khasra + Khatauni register — equivalent of Maharashtra 7/12)

### Why Noida / Gautam Buddha Nagar
- Well-known district — CDAC judges will recognize it immediately
- Mixed land types: urban residential (Sector parcels), peri-urban agricultural (Dadri), industrial (NOIDA Authority)
- UP Bhulekh already has records online (bhulekh.up.gov.in) — easy to reference as existing system
- Real land disputes well-documented in Noida (farmer compensation cases, expressway land, unauthorized colonies)
- No tribal land in Noida → simplifies demo (TribalGuard shown as a feature, not a Noida example)
- Hindi-speaking audience → BhumiGPT Hindi demo is more natural than Marathi

### Demo Personas (Noida)
| Person | Role | Detail |
|---|---|---|
| Ramesh Kumar | Deceased landowner | Khasra 142, Dadri village. Agricultural plot 0.5 hectare. |
| Priya Kumar | Heir / daughter | HSA 2005 — daughter has equal coparcenary right |
| Arun Kumar | Heir / son | |
| Sunita Kumar | Heir / younger daughter | |
| Suresh Sharma | Buyer | Wants to buy 0.3 hectare from Arun post-succession |
| Vijay Singh | Patwari | Dadri, serves 8 villages |
| Rajesh Verma | Circle Inspector | Supervises Vijay's work |
| Amit Saxena | Tehsildar | Dadri tehsil head |

---

## 2. Authentication & Login (POC — 4 Roles Only)

### POC Decision: 4 Roles Are Sufficient

For the CDAC POC demo, you need exactly **4 roles**. Everything else (Bank, SRO, Collector, NALSA, Gram Sabha, Judge) is future phase. See [FUTURE_PHASES.md](FUTURE_PHASES.md) for the full hierarchy.

| Role (JWT) | Who | Login method |
|---|---|---|
| `tehsildar` | Amit Saxena, Dadri tehsil head | Aadhaar OTP + govt email |
| `circle_inspector` | Rajesh Verma, Kanungo | Aadhaar OTP + govt email |
| `patwari` | Vijay Singh, Dadri Patwari | Aadhaar OTP + govt email |
| `citizen` | Priya/Arun/Suresh etc. | Aadhaar OTP only |

**Kotwal:** No login needed. Their notice-serving function is replaced by auto-SMS notification. If a judge asks, say "physical notice is automatically triggered — Kotwal acknowledges via SMS confirmation."

### 2.1 Login Flow

#### Citizen Login
```
1. Enter Aadhaar last 4 digits (full number masked in UI — never stored)
2. Request OTP → Oracle calls UIDAI mock → OTP sent to registered mobile
3. Enter OTP → Oracle verifies → returns { name, aadhaarHash, dob }
4. API Gateway mints JWT: { role: "citizen", aadhaarHash: "sha256:...", name, exp: 8h }
5. Redirect → /my-parcels (parcels matched by aadhaarHash)
```
Raw Aadhaar never leaves step 1. Only `sha256(aadhaar + salt)` flows anywhere downstream.

#### Officer Login (Patwari / Circle Inspector / Tehsildar)
```
1. Enter Aadhaar number + department email (@gov.in / @up.gov.in / @nic.in)
2. OTP sent to Aadhaar-linked mobile
3. Enter OTP → Oracle verifies Aadhaar → system checks email domain
4. JWT minted: { role: "patwari", name, aadhaarHash, villageCodes: [...], jurisdictionCode: "GBN-DAD", exp: 8h }
5. Redirect → /officer-dashboard
```
Officer's jurisdiction (which villages they can touch) is baked into the JWT. API middleware enforces it — no code path lets a Patwari edit another Patwari's village records.

### 2.2 eSign (Consent Signing — Separate from Login)

Every action that needs a party's signature (transfer consent, heir consent, record claim) triggers a fresh OTP:
```
System shows: "You are signing: Transfer of Khasra 142 to Suresh Sharma"
→ "Sign with Aadhaar" button
→ Fresh OTP challenge (independent of login session)
→ OTP verified → eSignTxHash returned
→ eSignTxHash stored on-chain as permanent consent proof
```
This mirrors how UIDAI's eSign API works. The login OTP and the consent eSign OTP are always separate events.

### 2.3 JWT Payloads

```json
// Citizen
{ "role": "citizen", "name": "Priya Kumar", "aadhaarHash": "sha256:priya001", "exp": "8h" }

// Patwari
{ "role": "patwari", "name": "Vijay Singh", "aadhaarHash": "sha256:vijay001",
  "jurisdictionCode": "GBN-DAD", "villageCodes": ["DAD-001","DAD-002","DAD-003"], "exp": "8h" }

// Circle Inspector
{ "role": "circle_inspector", "name": "Rajesh Verma", "aadhaarHash": "sha256:rajesh001",
  "jurisdictionCode": "GBN-DAD", "circleCode": "DAD-C1", "exp": "8h" }

// Tehsildar
{ "role": "tehsildar", "name": "Amit Saxena", "aadhaarHash": "sha256:amit001",
  "jurisdictionCode": "GBN-DAD", "tehsilCode": "DAD", "exp": "8h" }
```

### 2.4 What Exists vs. What Needs Building (POC)

| Component | Status | Notes |
|---|---|---|
| JWT middleware (auth.js) | ✅ Done | Needs role names updated to new 4 roles |
| Demo token issuer | ✅ Done | Mock mode only |
| Aadhaar OTP oracle (mock) | ✅ Done | Update to Noida demo identities |
| Login page (Frontend) | ❌ TODO | Aadhaar input + OTP screen |
| Officer login page | ❌ TODO | Aadhaar + dept email input |
| Jurisdiction middleware | ❌ TODO | Enforce villageCodes in JWT |
| eSign UI wiring | ❌ TODO | Fingerprint animation exists, needs OTP flow |
| Token refresh | ❌ Deferred | 8h session is fine for demo |
| Real UIDAI API | ❌ Phase 3 | Need UIDAI ASA empanelment |

---

## 3. Data Onboarding — How Records Enter the Chain

### 3.1 The Core Answer: Government Seeds, Owner Claims

**No owner can self-declare a property. Government always seeds first.**

This is how every successful project works:
- **Georgia**: Government seeded all existing records → citizens got certificates
- **Rwanda**: District registrars created all records → citizens verified via national ID
- **SVAMITVA**: Drone survey → govt creates property cards → owner claims card
- **AP Pilot**: Revenue Dept seeded records → owners had no direct blockchain entry

**Why:** India has no clean title system. 66% of civil cases are property disputes. Self-declaration recreates fraud on blockchain.

### 3.2 Three Entry Points for Data

#### Entry Point 1: DILRMP Bulk Seed (Primary — for existing parcels)
```
Revenue HQ exports DILRMP data for Nashik district
    ↓
Bulk import job: CSV/API → CreateDLPI chaincode (batch)
    ↓
All parcels created with status: SEEDED_UNVERIFIED
    ↓
SMS/WhatsApp notification to owner's Aadhaar-linked mobile:
"Your land parcel [Survey No.] has been digitized on BhumiChain.
 Verify your record at bhumichain.nic.in by [date]."
    ↓
Owner logs in → views parcel → clicks "Claim & Verify" → Aadhaar eSign
    ↓
Parcel status: OWNER_VERIFIED
```

**If owner disputes the seeded data:**
```
Owner clicks "Dispute Record" → fills dispute form → submits to tehsil
→ Parcel flagged: DATA_DISPUTED
→ Circle Officer reviews → corrects if needed → owner re-verifies
```

**If owner doesn't claim within 30 days:**
```
Parcel stays: SEEDED_UNVERIFIED (not blocked, still usable, but flagged)
→ Any transaction on unclaimed parcel requires officer approval
```

#### Entry Point 2: RecordScan AI (For paper records not in DILRMP)
```
Paper Satbara (7/12) extract scanned at CSC kiosk or tehsil office
    ↓
RecordScan AI: OCR → field extraction → parcel data struct
    ↓
Revenue Officer reviews AI output → corrects errors → approves
    ↓
POST /api/dlpi (REVENUE_OFFICER role required) → CreateDLPI on chain
    ↓
Owner notification + claim flow (same as Entry Point 1)
```

This handles the ~5% of parcels not yet in DILRMP digitally.

#### Entry Point 3: SVAMITVA Integration (For rural abadi land)
```
Survey of India GPS polygon data (from drone survey) → API import
    ↓
CreateDLPI with GPS polygon as official boundary
    ↓
Property card number becomes DLPI ID
    ↓
Owner who received property card → claims on BhumiSeva
```

#### Entry Point 4: New Registration (For all future transactions)
```
All NEW property registrations go directly on blockchain from Day 1
→ SRO office: buyer + seller + SRO → PropertyTransfer workflow
→ No paper record created — blockchain is the primary record
```

### 3.3 DLPI Status Lifecycle

```
SEEDED_UNVERIFIED   ← created from DILRMP/RecordScan/SVAMITVA
       ↓ (all owners claim)
OWNER_VERIFIED      ← all registered owners have Aadhaar-eSigned
       ↓ (can now transact)
  [TRANSFER / SUCCESSION / AUCTION events — see section 3B]
       ↓
DATA_DISPUTED       ← owner filed dispute
       ↓ (officer resolves)
OWNER_VERIFIED      ← back to normal after dispute resolution
```

**Multi-owner claim rule:** For a parcel with N co-owners (e.g., 3 heirs), ClaimStatus becomes `OWNER_VERIFIED` only when ALL N owners have individually eSigned. Each co-owner can verify their own entry independently; the parcel stays `SEEDED_UNVERIFIED` until the last one signs.

### 3.4 What the Claim Screen Looks Like

When owner logs in for the first time and has an unclaimed parcel:
```
┌─────────────────────────────────────────────────────┐
│  📋 Your Land Record — Action Required              │
│                                                     │
│  Khasra No: 142, Dadri Village, Noida               │
│  Area: 0.5 hectares (Agricultural)                  │
│  Seeded from: UP Bhulekh records (Dec 2025)         │
│  Status: ⚠️  UNVERIFIED — Your verification needed  │
│                                                     │
│  Review your record details below.                  │
│  If everything is correct, verify with Aadhaar.     │
│  If something is wrong, raise a dispute.            │
│                                                     │
│  [✅ Verify Record]  [⚠️ Raise Dispute]              │
└─────────────────────────────────────────────────────┘
```

### 3.5 Bulk Seed Script (To Be Built)

Location: `scripts/seed-district.js`

```javascript
// Reads UP Bhulekh export CSV → calls /api/dlpi (with TEHSILDAR demo token)
// Input: noida_khatauni_export.csv (or synthetic data)
// Output: 500 DLPI records created + seed-report.json
```

---

## 3B. BhumiToken (DLPI) — Complete End-to-End Workflow

### What Is BhumiToken?

BhumiToken is NOT cryptocurrency. It is a **non-fungible blockchain record** on Hyperledger Fabric that represents one land parcel. Think of it as the digital twin of a physical land parcel — every state change (ownership, encumbrance, court order) is recorded permanently.

- One parcel = one BhumiToken
- ID format: `DLPI-UP-DAD-00142` (State-District-Tehsil-KhasraNo)
- **ULPIN field** — optional foreign key storing the government's 14-digit Unique Land Parcel Identification Number when available (49% coverage nationally). DLPI works without it; ULPIN stored when Patwari enters it during record creation. This aligns BhumiChain with the national land digitization roadmap.
- Stored on Hyperledger Fabric state database (CouchDB)
- Document evidence stored on IPFS (not on chain)
- Aadhaar identity stored as `sha256(aadhaar + salt)` — raw Aadhaar never touches blockchain

### Complete State Machine

```
                     [PATWARI CREATES]
                           │
                    SEEDED_UNVERIFIED ─── (30-day window) ──→ stays unverified (blocks transfers)
                           │
                    (Owner claims)
                           │
                    OWNER_VERIFIED ←──────────────────────────────────┐
                    │         │         │          │                   │
              [Transfer]  [Mutation] [Succession] [Encumber]      [Resolved]
                    │         │         │          │
         TRANSFER_INITIATED  MUTATION_  SUCCESSION_ ENCUMBERED
                    │        INITIATED  INITIATED   (mortgage/court)
                    │         │         │
              [FraudCheck] [60s Alert] [Heirs ID]
                    │         │         │
              [Stamp Duty] [30-day    [Heir
                    │       objection]  Consents]
                    │
              TRANSFER_LOCKED (24h national lock)
                    │
              TRANSFER_COMPLETED ─── (new owner takes over)
                    │
              (loop back to OWNER_VERIFIED with new owner)

       REJECTED paths:
       TRANSFER_REJECTED_FRAUD     (fraud score ≥ 0.90)
       TRANSFER_REJECTED_LOCKED    (national lock already active)
       TRANSFER_REJECTED_CONSENT   (buyer/seller withdrew)
       MUTATION_DISPUTED           (owner objected in 30-day window)
       SUCCESSION_DISPUTED         (heir contested)
```

### Full Lifecycle — 7 Workflows

---

#### Workflow 1: Genesis (First Time a Parcel Enters the Blockchain)

**Who:** Patwari → Circle Inspector → Tehsildar
**Trigger:** Either bulk DILRMP import or RecordScan from paper

```
Patwari uploads Khatauni image
    ↓
RecordScan AI (Claude Haiku vision) extracts fields:
  - Khasra No: 142
  - Village: Dadri, Dadri Tehsil, Gautam Buddha Nagar
  - Area: 0.5 Ha (Jirayat)
  - Owner: Ramesh Kumar s/o Hariram Kumar
    ↓
Patwari reviews extracted fields, corrects any errors
Patwari separately enters owner Aadhaar (NOT from document)
    ↓
API: POST /api/dlpi { khasraNo, village, area, landType, ownerAadhaarHash, ipfsCID }
    ↓
Circle Inspector receives notification → reviews → "Field Verified" checkbox
    ↓
Tehsildar receives → final approve
    ↓
Chaincode: CreateDLPI() called on Fabric
    ↓
DLPI-UP-DAD-00142 created on blockchain
  status: SEEDED_UNVERIFIED
  owner: sha256:ramesh001
  area: 0.5 Ha
  ipfsCID: Qm... (document on IPFS)
    ↓
Owner SMS (to Aadhaar-linked mobile):
"Ramesh Kumar ji, aapki Khasra 142 BhumiChain par register ho gayi hai.
 Verify karein: bhumichain.nic.in"
```

**Third-party services used:**
- Claude API (Haiku): OCR extraction — `RECORD_SCAN_MODE=claude`
- IPFS (Pinata): Document storage — `IPFS_GATEWAY`
- SMS (mock in POC): Owner notification

---

#### Workflow 2: Owner Claim / Verification

**Who:** Citizen (owner)
**Trigger:** Owner sees SMS / opens portal on their own

```
Owner logs in (Aadhaar OTP)
    ↓
Portal shows "UNVERIFIED record found for you"
Owner sees: Khasra 142, 0.5 Ha, Dadri — all details from DLPI
    ↓
Owner reviews data
    ↓
Option A: Data is correct
  → "Verify Record" button
  → Fresh OTP challenge (eSign, NOT login OTP)
  → API: POST /api/dlpi/DLPI-UP-DAD-00142/claim { eSignTxHash }
  → Chaincode: ClaimDLPI() → status: OWNER_VERIFIED
  → Owner's dashboard now shows green parcel

Option B: Data is wrong (wrong area, wrong name)
  → "Raise Dispute" → fills form (what is wrong, what it should be)
  → API: POST /api/dlpi/DLPI-UP-DAD-00142/dispute { reason, correction }
  → Status: DATA_DISPUTED
  → Patwari gets notification → reviews → corrects DLPI → status back to SEEDED_UNVERIFIED
  → Owner re-verifies
```

---

#### Workflow 3: Property Transfer (Sale)

**Who:** Seller(s) + Buyer(s) + Tehsildar (endorser)
**Trigger:** Any co-owner initiates sale

### Transfer Type Decision (Shown to User in UI)

```
┌─────────────────────────────────────────────────────────────┐
│  What type of transfer?                                     │
│                                                             │
│  ○ Full Sale — sell the entire property                     │
│    (all 3 of you sell together to one or more buyers)       │
│                                                             │
│  ○ Share Sale — sell only YOUR 1/3 share                    │
│    (other co-owners notified, 30-day preemption right)      │
│                                                             │
│  ○ Gift — transfer at nil/nominal value                     │
│    (lower stamp duty applies)                               │
└─────────────────────────────────────────────────────────────┘
```

### Case A: FULL_SALE (All 3 heirs sell to 1 buyer)

```
Priya, Arun, Sunita all agree to sell entire Khasra 142 to Suresh Sharma

Priya (any heir) initiates transfer:
  POST /api/transfer/initiate {
    dlpiId: "DLPI-UP-DAD-00142",
    transferType: "FULL_SALE",
    sellers: [
      { aadhaarHash: sha256:priya001, share: "1/3", shareDecimal: 0.333 },
      { aadhaarHash: sha256:arun001,  share: "1/3", shareDecimal: 0.333 },
      { aadhaarHash: sha256:sunita001,share: "1/3", shareDecimal: 0.333 }
    ],
    buyers: [
      { aadhaarHash: sha256:suresh001, name: "Suresh Sharma", share: "1/1", shareDecimal: 1.0 }
    ],
    declaredValueINR: 4500000
  }

Chaincode: InitiateTransfer()
  → validateShares: sellers total = 1.0 ✓, buyers total = 1.0 ✓
  → National parcel lock placed (24h)
  → status: INITIATED

FraudSense: score 0.12 → proceed

Stamp duty: 7% × ₹45L = ₹3.15L → UPI payment link
Suresh pays → Oracle confirms → STAMP_DUTY_PAID

Consent collection (all 3 sellers + buyer):
  Priya eSign   → RecordConsent("SELLER", sha256:priya001, ...)  ✓
  Arun eSign    → RecordConsent("SELLER", sha256:arun001, ...)   ✓
  Sunita eSign  → RecordConsent("SELLER", sha256:sunita001, ...) ✓
  Suresh eSign  → RecordConsent("BUYER",  sha256:suresh001, ...) ✓
  allConsentsGiven() → true

Tehsildar endorses → ExecuteTransfer():
  DLPI chaincode: UpdateOwners(
    dlpiId: DLPI-UP-DAD-00142,
    remove: [sha256:priya001, sha256:arun001, sha256:sunita001],
    add:    [{ sha256:suresh001, "Suresh Sharma", share: "1/1", shareDecimal: 1.0 }]
  )
  Result: DLPI now has 1 owner (Suresh), OwnershipType: SOLE
  status: TRANSFER_COMPLETED

DigiLocker: Title issued to Suresh Sharma
```

### Case B: SHARE_SALE (Arun sells only his 1/3 to Suresh)

```
Arun wants to sell his 1/3 to Suresh Sharma. Priya and Sunita keep their shares.

Step 1 — Initiate with preemption
  POST /api/transfer/initiate {
    dlpiId: "DLPI-UP-DAD-00142",
    transferType: "SHARE_SALE",
    sellers: [{ aadhaarHash: sha256:arun001, share: "1/3", shareDecimal: 0.333 }],
    buyers:  [{ aadhaarHash: sha256:suresh001, share: "1/3", shareDecimal: 0.333 }],
    coOwnerHashes: ["sha256:priya001", "sha256:sunita001"],  // for preemption
    declaredValueINR: 1500000  // 1/3 of parcel value
  }
  status: PREEMPTION_WINDOW (30-day window opens — UP Revenue Code 2006 S.54)

Step 2 — Preemption notifications
  SMS to Priya: "Arun Kumar apna 1/3 hissa ₹15L mein Suresh Sharma ko bech raha hai.
                 Kya aap preemption adhikar use karna chahte hain? 30 din mein batayein."
  SMS to Sunita: same

Step 2A — Co-owners waive (happy path)
  Priya logs in → "I waive my preemption right" → eSign → WaivePreemption()
  Sunita logs in → "I waive my preemption right" → eSign → WaivePreemption()
  Both waived → preemption.Resolved = true → status: INITIATED

Step 2B — Co-owner exercises preemption (alternate path)
  Priya logs in → "I want to buy Arun's share" → eSign → ExercisePreemption()
  System: buyer is now Priya (not Suresh)
  Arun and Priya proceed to stamp duty + eSign
  Result: Priya (2/3), Sunita (1/3) — internal transfer, no outside buyer
  status: PREEMPTION_EXERCISED → then COMPLETED

Step 3 — Normal flow after preemption resolved
  FraudSense → stamp duty → consent collection:
    Arun eSign (seller)  ✓
    Suresh eSign (buyer) ✓
  Tehsildar endorses → ExecuteTransfer():
    DLPI UpdateOwners:
      remove: [sha256:arun001]
      add:    [{ sha256:suresh001, "Suresh Sharma", "1/3", 0.333 }]
    Result: Priya (1/3), Sunita (1/3), Suresh (1/3)
    OwnershipType: JOINT
    status: TRANSFER_COMPLETED
```

### Case C: FULL_SALE to Multiple Buyers

```
All 3 heirs sell. Suresh buys 60%, his wife Meera buys 40%.

sellers: [priya 1/3, arun 1/3, sunita 1/3]  → total selling: 1.0
buyers:  [suresh 0.6, meera 0.4]              → total buying: 1.0  ✓

Consent required: Priya + Arun + Sunita (sellers) + Suresh + Meera (buyers)
= 5 eSigns total

After ExecuteTransfer:
  DLPI owners: [Suresh 60%, Meera 40%], OwnershipType: JOINT
```

### What Prevents Fraud in Multi-Owner Scenario

| Attempt | What happens |
|---|---|
| Arun tries SHARE_SALE but claims he owns 2/3 | `validateBuyerShares()` rejects — doesn't match DLPI.Owners[] |
| Arun tries FULL_SALE without telling Priya and Sunita | All 3 sellers in proposal. Priya/Sunita don't eSign → `allConsentsGiven()` fails |
| Suresh buys from Arun but there's already a lock (dual-sale) | `SetTransferLock` fails → `LOCK_FAILED` |
| Someone impersonates Priya to waive preemption | `WaivePreemption` verifies aadhaarHash matches co-owner list |

---

#### Workflow 4: Succession / Uttaradhikar

**Who:** Heir (citizen) or Patwari
**Trigger:** Death certificate received

```
Heir or Patwari submits: death cert no. for Ramesh Kumar
Oracle: POST /crs/verify { certNo, aadhaarHash: sha256:ramesh001 }
CRS returns: { verified: true, deceasedName: "Ramesh Kumar", dateOfDeath: "..." }

Chaincode: InitiateSuccession(dlpiId, deathCertHash)
→ DLPI flagged: SUCCESSION_INITIATED

CoparcenaryMapper AI runs:
Input: { religion: Hindu, dob: 1955, deathDate: ..., familyTree }
Output: { heirs: [
    { name: "Priya Kumar", relation: "daughter", share: "1/3", hsa2005: true ★ },
    { name: "Arun Kumar",  relation: "son",      share: "1/3" },
    { name: "Sunita Kumar",relation: "daughter", share: "1/3", hsa2005: true ★ }
]}
★ = HSA 2005 S.6(3) — daughters have equal right

SMS sent to all 3 heirs: "Ramesh Kumar ji ke nidhan par, aapka uttaradhikar case khula hai"

Each heir logs in → sees succession case → "Accept share" → eSign
All 3 consent → mutation auto-triggered

Patwari gets 60-second SLA alert: "Mutation required for succession on Khasra 142"
Patwari confirms mutation within SLA
DLPI updated: 3 owners { Priya 1/3, Arun 1/3, Sunita 1/3 }
status: OWNER_VERIFIED (with 3 owners)

If any heir disputes:
→ status: SUCCESSION_DISPUTED
→ Tehsildar reviews → refers to court if unresolvable
→ Court order → mutation executed post-decree
```

---

#### Workflow 5: Mutation (Record Correction / Administrative Change)

**Who:** Patwari initiates
**Trigger:** Any change in record — sale, succession, partition, correction

```
Patwari: InitiateMutation(dlpiId, changeType, changeDetails)
→ Mutation entry created on blockchain
→ 60-second SLA clock starts (Patwari must notify owner within 60 seconds)

IMMEDIATE notification to owner:
"Aapki Khasra 142 par mutation shuru hua hai.
 Vivran: [change details]
 Aaptat ho to 30 din mein appeal karein."

Owner has 30-day objection window
  → No objection: mutation auto-approved after 30 days (or sooner with Tehsildar approval)
  → Objection filed: mutation goes to DISPUTED state → Tehsildar hears it

Tehsildar approves → DLPI record updated
```

---

#### Workflow 6: Encumbrance (Mortgage / Court Order)

```
Mortgage registration (Phase 3 — bank login needed):
Bank: POST /api/encumbrance/mortgage { dlpiId, bankCode, loanAmt, loanDate }
→ DLPI: encumbrances[] gets { type: "MORTGAGE", creditor: "SBI Dadri", amount: ₹XX }
→ Any transfer attempt on mortgaged parcel → BLOCKED until bank releases

Court Injunction (Phase 3 — court login needed):
Court: POST /api/encumbrance/court-order { dlpiId, caseNo, courtCode }
→ DLPI encumbrance: { type: "COURT_INJUNCTION" }
→ ALL transactions blocked until court releases

For POC: These are shown as "existing encumbrance" states in demo data
```

---

### Third-Party Services & Costs

#### POC (Demo Day — Everything Mocked)

| Service | What for | POC solution | POC cost |
|---|---|---|---|
| UIDAI Aadhaar OTP | Login verification | Mock OTP (hardcoded "123456") | ₹0 |
| UIDAI eSign | Consent signing | Mock eSign (fingerprint animation) | ₹0 |
| UP Bhulekh API | DILRMP record import | Static CSV / synthetic data | ₹0 |
| CRS API | Death certificate verify | Mock response (Ramesh Kumar) | ₹0 |
| Stamp Duty API (UP) | Calculate stamp duty | Hardcoded UP rate: 7% residential | ₹0 |
| UPI payment | Stamp duty collection | Mock payment with UPI deep-link animation | ₹0 |
| Claude API (Haiku) | RecordScan OCR | ~500 images @ $0.00025 | ~₹10 |
| IPFS (Pinata free) | Document storage | 1 GB free tier | ₹0 |
| OpenStreetMap | Map tiles | Free, cache offline | ₹0 |
| Hyperledger Fabric | Blockchain | Docker on laptop (FABRIC_MODE=mock optional) | ₹0 |
| SMS notifications | Owner alerts | Console log / toast UI | ₹0 |
| **TOTAL POC COST** | | | **~₹10** |

#### Production (Phase 3 — Real Deployment)

| Service | Provider | Cost | Notes |
|---|---|---|---|
| Aadhaar OTP (eKYC) | UIDAI via ASA empanelled agency | ₹0.50–₹2 per verification | Need ASA tie-up (e.g., eMudhra, NSDL) |
| Aadhaar eSign | eMudhra / NSDL (UIDAI ESP) | ₹15–₹25 per signature | Legal validity under IT Act |
| UP Bhulekh API | UP Revenue Board / NIC | Free (govt-to-govt) | Need NIC empanelment letter |
| CRS (death cert) | Vital Statistics, MoHFW | Free (govt API) | Registration needed |
| Stamp Duty API | IGRSUP (UP registration dept) | Free | Integrate with IGRSUP portal |
| UPI Collect | Razorpay / PayU | 2% + GST OR ₹2–5 flat UPI | For stamp duty actual payment |
| CERSAI charge | CERSAI portal | ₹50–₹250 per registration | For mortgage registration |
| DigiLocker issuance | NIC DigiLocker API | Free (for registered issuers) | Need DoLR/NIC sign-off |
| SMS (OTP + alerts) | AWS SNS or MSG91 | ₹0.10–₹0.15 per SMS | ~5 SMS per transaction |
| IPFS (Pinata) | Pinata.cloud | $20/month (100 GB) | Or self-host |
| Claude API (Haiku) | Anthropic | $0.00025/image | RecordScan at scale |
| **Hosting (Azure)** | Azure D4s v3 VM | ~₹11,500/month | 4 vCPU, 16 GB RAM |
| Azure Container Reg | Azure | ~₹400/month | Docker image storage |
| Load Balancer | Azure | ~₹1,500/month | |
| **Total infra/month** | | **~₹14,000/month** | Within typical govt project budget |

#### Cost Per Land Transaction (Production)

| Event | Services triggered | Approx cost |
|---|---|---|
| New DLPI creation | RecordScan (₹2) + IPFS (₹1) + 2 SMS (₹0.30) | ~₹3.50 |
| Owner claim | 1 eKYC (₹1) + 1 eSign (₹20) | ~₹21 |
| Property transfer | 2 eKYC + 4 eSigns + UPI (2%) + 5 SMS | ~₹160 + 2% of sale |
| Succession | 1 eKYC + N eSigns (N heirs) + 3 SMS | ~₹25–₹80 |
| Mutation | 2 SMS | ~₹0.30 |

Compare: Current physical process costs ₹5,000–₹50,000 in bribes + delays. BhumiChain reduces this to ₹160 per transfer.

### Data That Lives on Blockchain vs. Off-Chain

| Data | Where | Why |
|---|---|---|
| DLPI record (owner hash, area, status, history) | Hyperledger Fabric | Immutable, auditable |
| Encumbrances list | Hyperledger Fabric | Must be tamper-proof |
| eSign transaction hashes | Hyperledger Fabric | Consent proof |
| Mutation audit trail | Hyperledger Fabric | Officer accountability |
| Actual document (Khatauni scan) | IPFS (CID on chain) | Too large for chain |
| Owner name (plaintext) | Off-chain (oracle only) | Privacy — only aadhaarHash on chain |
| Raw Aadhaar number | NEVER stored anywhere | DPDPA 2023 compliance |
| Fraud scores | Off-chain (AI service) | Only score stored on chain |

---

## 3C. Global Benchmark: How the Best Projects Solved Co-Ownership

### Why India's Problem Is Uniquely Hard

Every successful blockchain land registry in the world either:
- Started with CLEAN, SINGLE-OWNER records (Georgia, Sweden, Dubai), or
- Had a clean slate due to mass land reallocation (Rwanda post-genocide)

India has neither. India has:
- Centuries of family inheritance creating undivided co-ownership
- Coparcenary law (Mitakshara) that automatically makes sons AND daughters co-owners at birth
- A record system (Transfer of Property Act 1882) based on the OLD English deed system,
  not the modern Torrens registration system that Australia replaced it with in 1858

### The Global Comparison

| System | Country | Fragmentation Approach | Missing Co-Owner | Verdict for BhumiChain |
|---|---|---|---|---|
| **Torrens Title** | Australia/NZ/Singapore | Any co-owner can petition court → court ORDERS SALE (not physical partition) → proceeds split by fraction | Assurance Fund: excluded party gets MONEY, not property back | **Gold standard. India MUST adopt this framework.** |
| **Samäganderätt** | Sweden/Lantmäteriet | Any single co-owner can UNILATERALLY demand sale — no majority needed | Centuries of accurate records; problem virtually non-existent | Not applicable — different starting point |
| **LAIS** | Rwanda (2010) | Systematic registration from scratch + physical demarcation + community witnessing | Village land committees validated every parcel — community ground-truth solved missing owners | Most relevant for India's rural villages |
| **BitFury/NCA** | Georgia (2016) | Post-Soviet allocation = mostly single-owner titles; fragmentation was not present | Secured existing govt registry as-is; disputes through court | Technology lesson: blockchain ≠ clean title. Need clean records first. |
| **DLD Blockchain** | Dubai (2018) | New TRANSACTIONS only — didn't retroactively touch existing titles | Problem bypassed — only covers developer titles | Irrelevant for India's legacy burden |
| **Factom** | Honduras (2015, FAILED) | Never implemented — corrupt officials blocked migration | Never solved | Key lesson: political will > technology |
| **Keeper's Warranty** | Scotland (2012) | Government "Keeper" guarantees register accuracy; compensates errors | Systematic conversion with state indemnity | Second best after Torrens |
| **HUF System** | India (ITCA) | Hindu Undivided Family = separate legal entity; Karta manages; members own SHARES IN ENTITY | Karta + succession law governs additions | **Already in Indian law — BhumiChain SHOULD USE THIS** |

### The Core Insight: Three Separate Failures

**Failure 1 — Georgia/Georgia-style systems**: Blockchain secured CORRUPTED RECORDS. You now have an
immutable tamper-proof record of the wrong data. Garbage in, garbage out — on a blockchain.

**Failure 2 — Dubai-style systems**: Only secured NEW transactions. Didn't help the 95% of India's
land that already exists with messy records. No legacy problem solved.

**Failure 3 — Honduras**: Had the technology, had the intention, failed on political corruption.
Lesson: the Patwari's incentive to accept bribes is stronger than any technology. BhumiChain's
answer is that the chaincode makes certain frauds ARCHITECTURALLY IMPOSSIBLE — not just harder.

### What Australia's 1858 Torrens System Got Right (That India Never Did)

Robert Torrens in South Australia introduced three principles that STILL govern land registration
in Australia, NZ, Canada, Singapore, and parts of the US:

```
MIRROR PRINCIPLE:
  The register is a perfect mirror of ALL rights in the land.
  No rights exist that are not on the register.
  
CURTAIN PRINCIPLE:
  A bona fide purchaser does NOT look behind the register.
  They pay fair value, they get title. Period.
  No "surprise heirs" can undo a completed sale.
  
INSURANCE/ASSURANCE PRINCIPLE:
  If the register is wrong and someone is wrongly excluded,
  they get COMPENSATION from the government assurance fund —
  not the property back.
  This decouples "was the record wrong?" from "can we unwind the sale?"
```

**Why this matters for BhumiChain:**
The reason India has 66% of civil cases as property disputes is that India uses
the DEED SYSTEM (prove your chain of title going back in time) not the TORRENS SYSTEM
(what's on the register today is the title). Every blockchain land project that ignores
this fundamental legal architecture is doomed to reproduce the same disputes on a blockchain.

BhumiChain's legal architecture memo for CDAC: advocate for UP Revenue Board to pass a
notification adopting Torrens-style registration principles for BhumiChain records.
Without this, blockchain just makes the existing system faster — not better.

---

## 3D. The 64×64 Problem — Generational Fragmentation at Scale

### The Actual Math

```
Gen 0: Ramesh Kumar owns 64 plots               → 1 person × 64 plots
Gen 1: Ramesh dies → 2 sons (Arun + Vijay)      → 2 persons × 64 plots (1/2 each)
Gen 2: Both sons die → 2 sons each              → 4 persons × 64 plots (1/4 each)
Gen 3: All 4 die → 2 sons each                  → 8 persons × 64 plots (1/8 each)
Gen 4: All 8 die → 2 sons each                  → 16 persons × 64 plots (1/16 each)
Gen 5: All 16 die → 2 sons each                 → 32 persons × 64 plots (1/32 each)
Gen 6: All 32 die → 2 sons each                 → 64 persons × 64 plots (1/64 each)
```

**Why physical partition doesn't work:**

- 1/64 of a 1-acre agricultural plot = 677 sq ft. Not viable for any crop.
- 1/64 of a 500 sq yard urban plot = 7.8 sq yards. Can't build anything.
- Even if viable: getting 64 people to agree on WHICH slice each gets requires unanimous
  consent. In practice, 1 person out of 64 always holds out — forever.
- And this is across 64 DIFFERENT PROPERTIES, each with a different 64-way dispute.

**Why requiring 64 eSigns for every transaction breaks the blockchain:**

Under the current design (before this section), any transfer of DLPI-A would require
consent from all 64 co-owners. If even one is:
- Dead (pending succession)
- Unreachable (no mobile number registered)
- Unregistered on BhumiChain
- Withholding consent for leverage

...the entire property is frozen forever. This is called "Bilateral Monopoly" and it's
exactly why undivided coparcenary property becomes untransactable within a few generations.

### The Solution: Coparcenary Pool Entity (CPE)

**Inspired by: HUF (Hindu law) + REIT (Real Estate Investment Trust) + Torrens Assurance**

Instead of tracking 64 people's shares across 64 individual DLPIs, create one on-chain entity
that HOLDS all 64 DLPIs, and track people's shares AT THE POOL LEVEL:

```
BEFORE (broken, individual DLPI model):
┌─────────────────────────────────────────────────────────────┐
│  DLPI-A: [Rahul 1/64] [Deepak 1/64] [Sunil 1/64] ... ×64  │
│  DLPI-B: [Rahul 1/64] [Deepak 1/64] [Sunil 1/64] ... ×64  │
│  ...      × 64 properties                                    │
│                                                             │
│  Problem: To sell DLPI-A → need 64 eSigns. Frozen forever. │
└─────────────────────────────────────────────────────────────┘

AFTER (CPE model — mirrors HUF):
┌─────────────────────────────────────────────────────────────┐
│  CPE-KUMAR-2026:                                            │
│    poolAssets:   [DLPI-A, DLPI-B, ..., DLPI-64]           │  ← 64 properties
│    poolMembers:                                             │
│      Rahul  → 1/64 pool share                              │
│      Deepak → 1/64 pool share                              │
│      Sunil  → 1/64 pool share                              │
│      ...    × 64 members                                   │
│    karta:   Rahul (eldest, manages pool)                   │
│    dissolutionThreshold: 50% by share (HSA 1956 S.23)     │
└─────────────────────────────────────────────────────────────┘
```

**What the CPE enables:**

#### Transaction 1: Deepak sells his pool share (no property divided)
```
Deepak: "I want out. I'll sell my 1/64 pool share to Suresh for ₹8L."
  → Suresh buys 1/64 of the POOL (not 1/64 of DLPI-A specifically)
  → No physical division of any plot
  → No 64 eSigns needed — just Deepak eSign + Suresh eSign + Karta approval
  → Suresh is now a pool member with 1/64 share
  → Deepak exits cleanly
  → All 64 properties still intact and undivided in pool
```

#### Transaction 2: Family wants to end the pool (full dissolution)
```
Rahul (25/64 share) + Sunil (15/64) + others (15/64 combined) vote to dissolve
  → 55/64 = 85.9% — above 50% threshold
  → BhumiAuction Type 1 triggered: all 64 properties go to open auction together
  → Winning bid: ₹15 crore for all 64 plots
  → Proceeds distributed by share: Rahul gets 25/64 × ₹15Cr = ₹58.6L etc.
  → Pool dissolved, all DLPIs marked TRANSFERRED
```

#### Transaction 3: Specific property extracted (partial dissolution)
```
75% of members agree: "DLPI-A goes to Rahul as sole owner"
  → DLPI-A released from pool to Rahul (sole owner, 1/1 share)
  → Rahul's pool share reduced accordingly
  → DLPI-A is now a standalone property — simple, single-owner
  → 63 properties remain in pool
```

#### Transaction 4: One co-owner petitions for forced dissolution
```
Deepak files with Tehsildar: "I want my share, others are blocking"
  → Tehsildar refers to Revenue Court
  → Court issues partition decree
  → COURT_ORDER mutation on CPE → dissolution = forced
  → BhumiAuction Type 2 (court-ordered) → proceeds split
  → This is S.23 of HSA 1956 — already a legal right
```

### The CPE Chaincode

New file: `blockchain/chaincode/coparcenary-pool/coparcenary_pool.go`

Key functions:
- `CreatePool(poolId, familyName, ancestorHash, membersJSON, assetDLPIIdsJSON, dilrmpNameCount)` 
  — establishes pool, detects registration gaps, starts 90-day notice if gap found
- `TransferPoolShare(fromHash, toHash, shareFraction)` — sell share, no property divided
- `VoteForDissolution(method: AUCTION | FAMILY_PARTITION | COURT_ORDER)` — supermajority triggers BhumiAuction
- `ReleaseAsset(dlpiId, recipientHash)` — extract one property to sole owner (75% approval)
- `FlagMissingHeir(source, hintName)` — Janganana Engine or officer flags unregistered person
- `ResolveMissingHeirFlag(resolution: REGISTERED | DECEASED | AFFIDAVIT_FILED)` — closes gap
- `AddMember(newHash, share, kartaESign)` — previously missing heir joins pool

### Pool Governance Summary

| Decision | Who decides | Threshold |
|---|---|---|
| Daily management | Karta (eldest coparcener) | Sole authority |
| Share transfer (internal — to existing member) | Seller + Karta | 2 eSigns |
| Share transfer (external — to outsider) | Seller + Karta + 30-day preemption for members | 2 eSigns + notice |
| Release specific DLPI to specific member | All members vote | 75% by share |
| Dissolve pool (auction or partition) | All members vote | 50% by share (Hindu law) |
| Forced dissolution (court) | One member petitions | Court decree |
| Add missing heir | Karta + Tehsildar approve | Joint approval |

### CoparcenaryPool — Chaincode Development Detail

**File:** `blockchain/chaincode/coparcenary-pool/coparcenary_pool.go`

#### Core Structs

```go
type PoolMember struct {
    AadhaarHash        string  // sha256(aadhaar + salt) — never raw
    Name               string
    Share              string  // "3/64" — fractional representation
    ShareDecimal       float64 // 0.046875
    JoinedAt           string
    Relation           string  // how they relate to the original ancestor
    IsKarta            bool    // eldest male coparcener — manages pool
    HasVotedToDissolve bool
    DissolveMethod     string  // AUCTION | FAMILY_PARTITION | COURT_ORDER
    IsDeceased         bool
    SuccessionCaseId   string  // if deceased, linked uttaradhikar case
}

type PoolAsset struct {
    DLPIId       string
    AreaHectares float64
    LandType     string  // Agricultural | Residential | Commercial
    Village      string
    IsReleased   bool    // true once carved out to a sole owner
    ReleasedTo   string  // aadhaarHash if released
}

type MissingHeirFlag struct {
    FlagID       string
    HintName     string  // name from DILRMP or Janganana that doesn't match any member
    Source       string  // DILRMP | JANGANANA | PATWARI | SELF_REPORTED
    FlaggedAt    string
    FlaggedByHash string
    Resolution   string  // REGISTERED | DECEASED | AFFIDAVIT_FILED | PENDING
    ResolvedAt   string
}

type CoparcenaryPool struct {
    PoolID             string
    FamilyName         string
    AncestorHash       string    // original owner from whom all members descend
    Religion           string    // determines dissolution threshold
    LawApplied         string

    Members            []PoolMember
    Assets             []PoolAsset
    KartaHash          string

    // Dissolution
    MinDissolveVote    float64   // 0.50 Hindu / 0.67 Muslim / 0.75 custom
    DissolutionStatus  string    // NONE | VOTING | APPROVED | EXECUTED
    DissolutionMethod  string    // AUCTION | FAMILY_PARTITION | COURT_ORDER
    AuctionID          string    // set when bhumi-auction is triggered

    // Missing heir tracking
    DilrmpNameCount    int       // how many unique names DILRMP shows for these khasras
    RegisteredCount    int       // how many are registered on BhumiChain
    RegistrationGap    bool      // true if dilrmpNameCount > registeredCount
    PublicNoticeTill   string    // 90-day notice expiry ISO timestamp
    KnownMissingHeirs  []MissingHeirFlag

    // Financial
    AssuranceFundLevied float64  // total 0.1% levied on pool transactions

    Status             string    // ACTIVE | DISSOLUTION_VOTING | DISSOLVING | DISSOLVED
    CreatedAt          string
    UpdatedAt          string
}
```

#### Functions

| Function | Called by | Parameters | What it does |
|---|---|---|---|
| `CreatePool` | Tehsildar or Uttaradhikar Engine | poolId, familyName, ancestorHash, religion, membersJSON, assetDLPIIdsJSON, dilrmpNameCount | Creates pool; if dilrmpNameCount > len(members) → sets RegistrationGap=true, starts 90-day notice |
| `AddMember` | Karta + Tehsildar (co-approval) | poolId, kartaESign, tehsildarHash, newMemberHash, newMemberName, relation, share | Adds previously missing heir; reduces existing shares proportionally |
| `TransferPoolShare` | Member (seller) | poolId, fromHash, toHash, shareFraction, buyerESign, sellerESign | Sell pool share; if toHash is outsider, emits 30-day preemption event; blocks if RegistrationGap active |
| `VoteForDissolution` | Member | poolId, memberHash, method (AUCTION / FAMILY_PARTITION / COURT_ORDER) | Records vote; if cumulative vote share ≥ MinDissolveVote → fires DissolutionApproved event |
| `ReleaseAsset` | Pool vote result | poolId, dlpiId, recipientHash | Extracts one DLPI from pool to a sole owner; requires 75% approval; fires PartitionDLPIRequired event |
| `FlagMissingHeir` | Patwari / Janganana oracle | poolId, hintName, source | Adds MissingHeirFlag; if pool had no gap, sets RegistrationGap=true and starts notice |
| `ResolveMissingHeirFlag` | Tehsildar | poolId, flagId, resolution (REGISTERED / DECEASED / AFFIDAVIT_FILED) | Closes flag; if all flags resolved → clears RegistrationGap |
| `RecordAuctionResult` | BhumiAuction oracle | poolId, auctionId, totalProceedsINR | Links auction result; sets DissolutionStatus=EXECUTED; fires ProceedsDistributionRequired event |
| `QueryPool` | Any | poolId | Returns full pool state |
| `QueryPoolByAncestor` | Any | ancestorHash | Returns all pools for a family |

#### Dissolution Thresholds (by religion)

| Religion | Threshold | Legal basis |
|---|---|---|
| Hindu / Sikh / Buddhist / Jain | 50% by share | HSA 1956 S.23 — any coparcener can demand partition |
| Muslim | 67% by share | No specific statute — 2/3 supermajority as conservative default |
| Tribal | 75% by share | FRA 2006 + Gram Sabha ratification required |
| Christian / Parsi | 50% by share | ISA 1925 — any heir can petition for partition |

#### Key Events Fired

```
PoolCreated               → oracle posts public notice to bhulekh.up.gov.in
MissingHeirFlagged        → oracle alerts all registered members + Tehsildar
DissolutionApproved       → oracle triggers BhumiAuction or BhumiSettle
PartitionDLPIRequired     → mutation-manager creates PARTITION mutation for that DLPI
ProceedsDistributionRequired → oracle calculates each member's UPI payout
PreemptionNoticeRequired  → 30-day window for existing members to match outsider's bid
```

#### Anti-Corruption Rules

1. `TransferPoolShare` blocked if `RegistrationGap = true` — prevents clean exit before missing heirs are resolved
2. `KartaHash` can only be changed by Tehsildar (prevents Karta fraud)
3. `AssuranceFundLevied += 0.001 × shareValue` on every pool share transfer — accumulated in BhumiAssurance Fund

---

## 3E. The "3 Registered, 4 Actual Owners" Problem

### Why This Is Unsolvable Without a Legal Framework

This is not a technology problem. **The blockchain cannot know what it doesn't know.**

If Ramesh had 4 children but only 3 registered with BhumiChain, the chaincode sees only 3
Aadhaar hashes. The 4th person's legal rights exist in the physical world — in family knowledge,
in a village's oral history, in a 40-year-old Aadhaar enrollment record — but NOT on-chain.

No technology can auto-discover this. What technology CAN do is:

### Five Detection Layers

#### Layer 1 — DILRMP Cross-Validation (Catch Before Entry)

```
When Patwari seeds DLPI or creates CPE pool:
  System queries DILRMP record for Khasra 142 (raw government data)
  DILRMP shows: "Ramesh Kumar, Vijay Kumar, Anita Kumari, Geeta Kumari" — 4 names
  Patwari entered: sha256:ramesh001, sha256:vijay001, sha256:anita001 — 3 Aadhaar hashes

  → MISMATCH DETECTED
  → CPE created with RegistrationGap = true, DilrmpNameCount = 4, RegisteredCount = 3
  → Cannot proceed to any transaction until gap resolved or affidavit filed
  → Public notice auto-triggered for 90 days
```

This catches the most common fraud: the bribed Patwari enters only one heir's Aadhaar.
The DILRMP raw record still shows all names — the gap is immediately visible.

#### Layer 2 — Aadhaar Family Cross-Reference (UIDAI Data)

```
When heir Arun Kumar claims inheritance (submits Aadhaar eKYC):
  UIDAI eKYC returns: { name, dob, relation_to_registered_members }
  UIDAI family linkage shows: "Ramesh Kumar had 4 children enrolled (based on enrollment data)"
  BhumiChain registered: 3 heirs

  → System: "UIDAI data suggests 4 children of Ramesh Kumar. 3 registered. 
             Enter the 4th heir's Aadhaar or file Affidavit of Non-Existence."
  → Officer must resolve before CPE/DLPI goes to OWNER_VERIFIED

Note: UIDAI family data is partial — available only where all members enrolled together.
This catches the case where the 4th person IS Aadhaar-enrolled (most Indians are).
```

#### Layer 3 — Neighbor + Community Alert (Rwanda-style)

```
When any CPE is created or any DLPI mutation initiated:
  System queries: adjacent DLPIs by GPS boundary
  Alerts sent to: adjacent property owners + Gram Sabha of that village

  Message: "Property Khasra 142, Dadri is being registered. Do you know of any other 
            person who has a right to this property? Alert within 30 days."
  
  Channel: SMS to adjacent owners + Gram Sabha notice board (Kotwal confirms posting)

Rwanda ran their ENTIRE land registration this way. Community knows ground truth better
than government records. Neighbors are the best fraud detection.
```

#### Layer 4 — Constructive Notice Window (Torrens-style)

```
EVERY transaction on a CPE or DLPI fires a public notice:

  Published on:
    1. bhulekh.up.gov.in (Khasra number searchable by anyone)
    2. Gram Sabha notice board (Kotwal confirms with on-chain attestation)
    3. Local newspaper (properties above ₹25L)

  Duration: 90 days

  After 90 days without objection:
    → "Constructive notice deemed served" (anyone who SHOULD have known, is treated as KNOWING)
    → Transaction proceeds
    → Bona fide purchaser (paid fair value, no knowledge of dispute) gets INDEFEASIBLE TITLE
    → Can NEVER be reversed, even if a 4th owner emerges later

  After 90 days WITH objection:
    → Transaction BLOCKED
    → Tehsildar hears it
    → If valid: 4th owner registers and gets their share
    → If invalid: transaction proceeds

  Wrongly excluded 4th owner AFTER sale to bona fide purchaser:
    → Sue the 3 sellers personally (their proceeds)
    → Claim from BhumiAssurance Fund if sellers are untraceable
```

This is the Torrens Curtain Principle. You look at the register, not behind it.

#### Layer 5 — BhumiAssurance Fund (Phase 3 — Like DICGC for Land)

```
Funded by: 0.1% levy on every property transaction (auto-levied in CPE.TransferPoolShare())
  Example: ₹50L sale → ₹5,000 into Assurance Fund

Covers: Wrongly excluded co-owners who can PROVE their right but:
  - Sellers are dead or bankrupt
  - Property already sold to bona fide purchaser (cannot be reversed)
  - Victim cannot get the land back

Claim process: File with Revenue Board → adjudication → fund pays compensation

Legal precedent:
  - Australia: Real Property Act Assurance Fund (since 1858 — 165 years working)
  - Scotland: Keeper's indemnity (since 1979 Land Registration Act)
  - India: DICGC insures bank deposits (exact same model for deposits)

For CDAC: show 0.1% levy line in property transfer workflow
         frame as "BhumiAssurance Fund — India's first land title insurance built into the system"
         This is a unique feature no other Indian land system has
```

### Decision Framework: When to Proceed vs. Block

```
┌──────────────────────────────────────────────────────────────────────┐
│  Registration gap detected (dilrmpNameCount > registeredCount)?      │
│                                                                       │
│  Yes → Start 90-day public notice                                     │
│        Block all transactions                                          │
│                                                                       │
│  Within 90 days: missing heir comes forward → add them → proceed     │
│                                                                       │
│  After 90 days without emergence:                                     │
│    Officer files Affidavit of Non-Existence (says "4th person cannot │
│    be located after public notice" — signed with Aadhaar eSign)      │
│    → Gap resolved as AFFIDAVIT_FILED                                  │
│    → CPE created / transaction proceeds                               │
│    → If 4th person appears later → Assurance Fund compensates        │
│                                                                       │
│  After transaction with Assurance Fund flag:                          │
│    Buyer: clean title (Torrens Curtain Principle)                     │
│    Missing heir: claim Assurance Fund (prove right to Revenue Board) │
└──────────────────────────────────────────────────────────────────────┘
```

### The Fundamental Legal Gap (Honest Assessment for CDAC)

Without a government notification adopting Torrens-style indefeasibility for BhumiChain records,
the blockchain layer alone cannot fully solve the missing co-owner problem. What it CAN do:

1. Make omission DETECTABLE (Layer 1 — DILRMP cross-check is immediate)
2. Make omission HARDER (5 detection layers create friction and audit trail)
3. Make omission ACCOUNTABLE (officer's Aadhaar hash permanently recorded with every registration gap)
4. Create COMPENSATION MECHANISM (Assurance Fund) for cases that slip through

**For the POC demo**, focus on Layers 1 and 4 — these are demonstrable without government integration.
The Assurance Fund and Aadhaar family cross-reference are Phase 3 with UIDAI empanelment.

### New Chaincode Deployment Order (Updated)

```
1. dlpi                (foundation)
2. encumbrance         (depends on dlpi)
3. coparcenary-pool    (NEW — depends on dlpi)
4. mutation-manager    (depends on dlpi, calls pool for joint properties)
5. property-transfer   (depends on dlpi)
6. uttaradhikar        (depends on dlpi, auto-creates CPE for multi-heir succession)
7. tribal-guard        (depends on dlpi)
8. bhumi-auction       (depends on uttaradhikar + coparcenary-pool)
```

---

## 3F. BhumiSettle — Equitable Partition and Family Settlement Engine

### The Core Idea: Shuffle, Don't Slice

Physical partition of 1/64 of an acre is not viable. But **value-based reshuffling** is.

Every plot has a circle rate (₹/hectare, set by Tehsildar from IGRSUP notification).
Multiply area × circle rate = fair market value of that plot.
Each co-owner's **fair share value** = their fraction × total portfolio value.

Now run a greedy assignment:
- Sort all properties by value (highest first)
- Assign each property to the person whose running assigned total is **furthest below** their fair share
- Repeat until all properties assigned
- Small cash "equalization payments" cover the remainder

```
Example: Rahul (1/4), Deepak (1/4), Sunil (1/4), Manoj (1/4)
4 plots: Plot A ₹20L, Plot B ₹15L, Plot C ₹10L, Plot D ₹5L
Total = ₹50L. Each fair share = ₹12.5L.

Assignment round:
  Plot A (₹20L) → Rahul (biggest shortfall, all at ₹0 assigned)  [Rahul: ₹20L]
  Plot B (₹15L) → Deepak (next biggest shortfall)                 [Deepak: ₹15L]
  Plot C (₹10L) → Sunil                                           [Sunil: ₹10L]
  Plot D (₹5L)  → Manoj                                           [Manoj: ₹5L]

Equalization payments:
  Rahul received ₹7.5L more than fair share → pays: Sunil ₹2.5L, Manoj ₹5L
  Deepak received ₹2.5L more → pays: Sunil ₹2.5L

Result: Everyone gets sole ownership of specific plots.
        Small UPI payments settle the value difference.
        No co-ownership. No frozen ledger. No court.
```

**After settlement:** each person has a clean DLPI with `OwnershipType: SOLE`.
Future generations inherit ONE clean plot each — fragmentation resets to Generation 1.

---

### Three Settlement Modes

| Mode | When to use | Who must agree | Properties in scope |
|---|---|---|---|
| `EQUITABLE_PARTITION` | All co-owners want clean titles | All parties | All properties in pool |
| `SUBGROUP` | 10 of 64 people want to settle among themselves | Only those 10 | Properties proportional to their combined share |
| `DIRECT_BUYOUT` | One person or external buyer offers to buy everyone out at circle rate | 51% by share (or DM if deadlock) | All properties |

**Subgroup settlement example:**
Rahul, Deepak, Sunil want to exit the 64-person pool. Their combined share = 3/64.
They carve out their 3/64 portion (3 specific plots, valued at their combined fair share).
The remaining 61 people continue in the pool with 61 plots.
Nobody needs all 64 to agree.

---

### Circle Rate — The Valuation Anchor

Circle rates are the **government's official minimum land value** for stamp duty.
In UP, published annually by IGRSUP (Inspector General of Registration, UP).
In BhumiChain: **Tehsildar enters circle rates per village per land type.**

```
Chaincode: SetCircleRate(tehsilCode, villageCode, landType, ratePerHa, tehsildarHash)

Example:
  SetCircleRate("DAD", "DAD-001", "Jirayat", 800000, sha256:amit001)
  → ₹8,00,000 per hectare for unirrigated agricultural land in Dadri village

Used for:
  1. Settlement: fair value calculation for equitable partition
  2. Stamp duty: floor price — declared value cannot be below circle rate
  3. BhumiAuction: reserve price for property auctions
  4. Fraud detection: declared value < 60% of circle rate → UNDERVALUATION flag
```

Tehsildar updates circle rates when IGRSUP issues new annual notification.
Every settlement records a `circleRateSnapshot` — the rates at the time of proposal
(so a dispute later can't claim the rate was different).

---

### AI Settlement Recommendation (BhumiSettle AI)

When `InitiateSettlement` is called, the chaincode fires `AISettlementRequested` event.
The Python AI service receives it, runs the greedy assignment algorithm, and calls
`RecordAIRecommendation` back on-chain with:

```python
# backend/ai-services/bhumi-settle/settle.py (to build)
def recommend_settlement(parties, properties):
    """
    parties:    [{ aadhaarHash, fairValueInr }]
    properties: [{ dlpiId, valueInr }]
    
    Returns: assignments[], payments[], maxDeviation
    """
    # Sort properties descending by value
    props = sorted(properties, key=lambda p: p['valueInr'], reverse=True)
    assigned = {p['aadhaarHash']: 0.0 for p in parties}
    result = []
    
    for prop in props:
        # Assign to party with biggest current shortfall
        best = min(parties, key=lambda p: assigned[p['aadhaarHash']] - p['fairValueInr'])
        result.append({ 'dlpiId': prop['dlpiId'], 'assignedTo': best['aadhaarHash'],
                        'valueInr': prop['valueInr'] })
        assigned[best['aadhaarHash']] += prop['valueInr']
    
    # Calculate equalization payments
    payments = calc_equalization(parties, assigned)
    max_dev = max(abs(assigned[p['aadhaarHash']] - p['fairValueInr']) / p['fairValueInr']
                  for p in parties)
    return result, payments, max_dev
```

The AI does NOT make decisions — it produces a RECOMMENDATION. All parties can:
- Accept the AI recommendation (eSign)
- Propose manual changes (counter-proposal)
- Object → escalate to Tehsildar

**The AI's job:** eliminate the negotiation deadlock that happens when 64 people
argue about which plot is "better." The algorithm is deterministic and transparent —
anyone can audit it using the circle rates stored on-chain.

---

### Settlement Escalation Chain

```
PARTIES TRY THEMSELVES (14 days)
    ↓ objection
TEHSILDAR MEDIATES (14 days)
  → Tehsildar can modify the AI recommendation
  → Tehsildar holds formal hearing (all parties, virtual or in-person)
  → Tehsildar approves modified settlement → ExecuteSettlement
    ↓ still unresolved
SDM (Sub-Divisional Magistrate) HEARS IT (14 days)
  → SDM has authority to order a specific settlement under Revenue Code
  → SDM can also order partial settlement for willing parties
    ↓ still unresolved
DM / COLLECTOR ORDERS BhumiAuction (7 days to comply)
  → DM invokes BhumiAuction Type 2 (court-ordered)
  → All properties sold at open auction
  → Proceeds distributed by share — nobody can block this
    ↓ someone disputes the auction
REVENUE COURT (months to years — but this is rare)
  → By now, most cases resolve at SDM level
```

**The key improvement over current system:**
Current UP: a partition suit takes 8–15 years in Revenue Court.
BhumiChain: same legal process but each level has a HARD DEADLINE (14 days).
Blockchain records force the process to move. Officers can't sit on files.

---

### Settlement Status Flow

```
DRAFT
  ↓ (AI generates recommendation)
AI_RECOMMENDED
  ↓ (parties review — 14 days)
NEGOTIATING ←──── (any party objects)
  ↓ (all consent)
ALL_CONSENTED
  ↓ (equalization payments pending)
PAYMENT_PENDING
  ↓ (UPI payments confirmed)
ALL_CONSENTED
  ↓ (Tehsildar ExecuteSettlement)
EXECUTED → each DLPI gets new sole owner → clean titles

ESCALATED (from any state, if objection after Tehsildar window)
  ↓
COURT_REFERRED (terminal — goes to Revenue Court)
```

---

### Chaincode Key Functions (bhumi-settle)

| Function | Called by | What it does |
|---|---|---|
| `SetCircleRate` | Tehsildar | Stores official circle rate per village/land type |
| `GetCircleRate` | Any | Returns current rate for valuation |
| `InitiateSettlement` | Citizen / Officer | Creates proposal, calculates fair values, fires AI request |
| `RecordAIRecommendation` | Oracle (AI service) | Writes AI's assignment plan on-chain |
| `ConsentToSettlement` | Party (citizen eSign) | Accept the plan |
| `ObjectToSettlement` | Party (citizen) | Reject → auto-escalate to Tehsildar |
| `RecordEqualizationPayment` | Oracle (UPI confirm) | Marks cash payment as done |
| `ExecuteSettlement` | Tehsildar (eSign) | Fires events → DLPI.UpdateOwners per assignment |
| `EscalateSettlement` | Officer | Moves case to next level with reason |

---

## 3G. Officer Fraud Detection — AI Pattern Engine

### Why Officer-Side Fraud Is Different

The co-owner fraud problem is about OWNERS bribing OFFICERS.
But there's a second class of fraud: **officers acting on their own initiative** —
processing fraudulent mutations without being bribed, for their own benefit or for
future leverage (demand bribe to "fix" the record they deliberately broke).

BhumiChain has complete officer audit trails. The FraudSense AI service runs pattern
analysis on mutation events and flags anomalies automatically.

### Eight Patterns (Seven Officer + One Benami)

The eighth pattern runs at district level (not per-officer) to detect benami property accumulation — properties held in someone else's name. Benami Transactions Prohibition Act 2016 makes this a cognizable offence.

| Pattern | Type | Trigger |
|---|---|---|
| `BENAMI_ACCUMULATION` | District-level / Buyer pattern | Same Aadhaar hash appears as buyer across 10+ separate DLPIs within 12 months across different villages. Flag: one person accumulating at scale — typical benami front. Auto-alert to DM + District Collector. |

**Implementation:** `QueryBuyerConcentration(aadhaarHash, months=12)` CouchDB query on the mutation-manager chaincode. Runs as a nightly batch job via oracle. Results appear in Analytics Dashboard under "Benami Alerts" tab.

---

### Seven Officer Fraud Patterns

| Pattern | What it looks like | Why it's fraud |
|---|---|---|
| `SINGLE_HEIR_REPEAT` | Officer filed 3 inheritance mutations this month, all with 1 heir, but DILRMP shows 2+ names each time | Systematically omitting heirs for payment |
| `UNDERVALUATION` | Declared value < 60% of circle rate on multiple transactions by same officer | Stamp duty evasion — officer facilitating buyer |
| `DELAYED_MUTATION` | Death certificate date is 3+ years before mutation filing date | Hiding death to continue transacting as if owner is alive |
| `SELF_DEALING` | Transaction involves a parcel where the officer's Aadhaar family hash appears | Conflict of interest — officer processing own family property |
| `BUYER_CONCENTRATION` | Same buyer appears in >5 mutations filed by same officer in 30 days | Benami accumulation pattern — officer facilitating land grab |
| `OFF_HOURS_ENTRY` | Mutations filed repeatedly between 11pm–5am | Evasion pattern — avoiding supervisor review |
| `SEQUENTIAL_SAME_DLPI` | Same parcel processed 3+ times by same officer in 7 days | Cover-up pattern — multiple edits trying to set a state |

### Escalation Architecture

```
FraudSense AI detects pattern → scores it (0–1)
  
  Score < 0.60 → log only, no alert
  Score 0.60–0.79 → INFO alert to immediate supervisor
  Score 0.80–0.89 → WARNING alert + officer activity frozen on that DLPI
  Score ≥ 0.90 → CRITICAL alert + all officer's pending mutations suspended
                  pending supervisor review

Escalation chain (auto, cannot be blocked by the officer):
  Patwari fraud          → Circle Inspector (Kanungo)
  Circle Inspector fraud → Tehsildar
  Tehsildar fraud        → SDM / DM
  DM fraud               → State Revenue Board + DoLR
  
Key: the OFFICER CANNOT SEE their own fraud alert.
     The alert goes DIRECTLY to the supervisor — bypassing the officer entirely.
     The officer only learns about it when the supervisor contacts them.
```

### Chaincode: RecordOfficerFraudAlert

```go
// Called by FraudSense AI oracle
RecordOfficerFraudAlert(
    officerHash, officerName, officerRank,
    patternType,      // SINGLE_HEIR_REPEAT | UNDERVALUATION | etc.
    fraudScore,       // 0.60–1.0 (below 0.60 not written)
    evidenceMutIds,   // which mutations triggered this
    evidenceDLPIIds,  // which parcels are affected
    description       // AI-generated human-readable explanation
) → alertId
```

The event `OfficerFraudAlertFired` contains the alert + escalation target rank.
The oracle layer looks up the supervising officer for that tehsil and sends them:
- In-app alert (high priority)
- SMS notification
- Email to their govt email

### What the Supervisor Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  ⚠️  FRAUD ALERT — Action Required                                  │
│                                                                     │
│  Officer: Vijay Singh (Patwari, DAD-P1)                            │
│  Pattern: SINGLE_HEIR_REPEAT                                        │
│  Score: 0.87 (HIGH)                                                 │
│                                                                     │
│  Evidence:                                                          │
│  - MUT-DLPI-UP-DAD-00142: Filed inheritance for "Arun Kumar only"  │
│    DILRMP shows 3 names for this Khasra                             │
│  - MUT-DLPI-UP-DAD-00156: Same pattern — 1 heir, DILRMP shows 2   │
│  - MUT-DLPI-UP-DAD-00171: Same pattern — 1 heir, DILRMP shows 3   │
│                                                                     │
│  All 3 mutations: same buyer "Deepak Yadav (sha256:deepak999)"     │
│                                                                     │
│  [Review Mutations]  [Suspend Officer]  [Dismiss Alert]             │
└─────────────────────────────────────────────────────────────────────┘
```

The supervisor resolves the alert with one of:
- `DISMISSED` — reviewed and found legitimate (reason required)
- `UNDER_REVIEW` — investigating (freezes officer's pending mutations)
- `ACTION_TAKEN` — disciplinary action taken (triggers DoLR notification)

All resolutions are permanently on-chain with the supervisor's Aadhaar hash.
A supervisor who dismisses a valid fraud alert is themselves flagged in the next pattern cycle.

### What This Catches That Paper Systems Cannot

In the current paper system:
- A Patwari files 20 fraudulent mutations across 3 years. Nobody notices because
  mutations are filed physically in different registers across different villages.
- No cross-parcel pattern matching is possible without an integrated database.

In BhumiChain:
- All mutations are on one ledger, queryable by officer hash
- FraudSense runs `QueryOfficerMutations(officerHash)` → pattern analysis → alert
- The pattern across 20 mutations is visible in milliseconds
- The officer's supervisor is notified BEFORE the mutations are executed (SLA-based)

### POC Demo Moment: Officer Fraud Alert

**Scene for demo** (add to Scene 4 extended):
```
Normal transfer executes → Tehsildar dashboard
    ↓
Suddenly: RED ALERT banner appears
"FRAUD ALERT: Vijay Singh (Patwari) — SINGLE_HEIR_REPEAT pattern detected.
 Score: 0.87. 3 inheritance mutations with suspected missing heirs."
    ↓
Tehsildar clicks alert → sees all 3 mutations + evidence
    ↓
Tehsildar clicks "Suspend Officer" → all 3 pending mutations frozen
    ↓
Demo point: "This is impossible in a paper system.
             On BhumiChain, every officer action is cross-referenced automatically.
             No Patwari can run a systematic scheme without detection."
```

### Updated Chaincode Deployment Order

```
1. dlpi               (foundation)
2. encumbrance        (depends on dlpi)
3. coparcenary-pool   (depends on dlpi — multi-gen fragmentation)
4. bhumi-settle       (depends on dlpi, coparcenary-pool — settlement + circle rates + fraud)
5. mutation-manager   (depends on dlpi)
6. property-transfer  (depends on dlpi)
7. uttaradhikar       (depends on dlpi, auto-creates pool for multi-heir succession)
8. tribal-guard       (depends on dlpi)
9. bhumi-auction      (depends on uttaradhikar + coparcenary-pool + bhumi-settle)
```

---

## 3H. Uttaradhikar — Complete Inheritance Engine

### Three Trigger Scenarios

India's inheritance process fails because it has a single path: someone dies, heirs file paperwork, Patwari manually mutates. This creates fraud, delay, and exclusion of rightful heirs. BhumiChain supports all three real-world scenarios:

| Scenario | Trigger | Who Acts | Legal Basis |
|---|---|---|---|
| **A — Pre-registration** | Owner alive | Owner registers heirs while alive | Indian Registration Act 1908 |
| **B — Alive Transfer** | Owner decides to give NOW | Owner eSigns gift deed | Transfer of Property Act S.122 |
| **C1 — Death Certificate** | CRS oracle confirms death | Heirs consent on portal | Registration of Births and Deaths Act 1969 |
| **C2 — Heir Petition** | Heirs petition without official cert | Pre-registered plan + affidavit | Hindu Succession Act / Muslim Personal Law |

### InheritancePlan (Scenario A — Pre-registration)

Owner registers a plan while alive:
- Names all intended heirs with Relation, Aadhaar hash, intended share
- Can optionally link a registered Will (offline will registration no.)
- Sets permissions: `AllowAliveTransfer` + `AllowHeirPetition`
- Owner can `UpdateInheritancePlan` or `RevokeInheritancePlan` anytime
- Fresh eSign required for each update → immutable audit trail on-chain
- **Does NOT automatically execute** — it's a plan, not a trigger
- When death occurs, the plan accelerates the process (heirs list pre-populated)

```
Owner alive → RegisterInheritancePlan → ACTIVE
                  ↓ owner wants to give now
             TriggerAliveTransfer → TRIGGERED → SuccessionCase (OWNER_ALIVE)
                  ↓ owner dies, heirs use the plan
             InitiateSuccessionByHeirPetition → SuccessionCase (HEIR_PETITION)
```

### Alive Transfer Flow (Scenario B)

```
Owner eSigns → TriggerAliveTransfer called →
  DLPI locked (SUCCESSION_PENDING) →
  Recipients receive SMS "XYZ ne aapko zameen transfer karni hai" →
  Each recipient eSigns acceptance →
  AllHeirsConsentedAutoMutation event →
  Oracle calls mutation-manager with GIFT mutation type →
  DLPI title transferred → Stamp duty 2% (UP gift rate)
```

Key: owner is the donor, NOT a deceased person. No death certificate. 30-day consent window.

### Heir Petition Flow (Scenario C2)

```
Owner dies → death cert delayed (months) →
Heir (Priya) petitions on portal →
  If InheritancePlan exists → heir list auto-loaded from plan →
  Petitioner adds any missing heirs →
  Notarized affidavit uploaded (IPFS CID) →
InitiateSuccessionByHeirPetition called →
  CoparcenaryMapper computes legal shares →
  confidence -= 0.05 (no CRS verification) →
  All heirs notified via SMS/WhatsApp →
  Each heir eSigns →
  Auto-mutation fires (INHERITANCE type, UTTARADHIKAR_ENGINE origin) →
  When CRS cert eventually arrives → oracle links it to closed case
```

### Applicable Laws Enforced

#### Hindu Succession Act 1956 (amended 2005)

| Rule | Source | Enforcement |
|---|---|---|
| Daughters = Sons (equal per-capita share) | HSA 2005 S.6(3), Vineeta Sharma v. Rakesh Sharma 2020 SC | **HARD BLOCK** if daughters < sons |
| Multiple widows share ONE unit | HSA 1956 S.10 Rule 2 | Auto-computed; WARNING emitted |
| Class I excludes Class II | HSA 1956 S.8 | **HARD BLOCK** if Father + Sons listed together |
| No sons/daughters → Class II | HSA 1956 S.8 | Auto-falls-through |
| No heirs → state (bona vacantia) | HSA 1956 S.29 | Case status = ESCHEAT |

#### Muslim Personal Law — Sunni (Hanafi)

| Rule | Source | Enforcement |
|---|---|---|
| Son = 2 × daughter share | Quran 4:11 | **HARD BLOCK** if ratio violated |
| Wife share: 1/8 with children, 1/4 without | Quran 4:12 | WARNING (not hard block — share reviewed by officer) |
| Single daughter: 1/2 | Fara'id | WARNING |
| Multiple daughters (no son): 2/3 max | Fara'id | WARNING |
| Wasiyat (will bequest) ≤ 1/3 to non-heirs | Quran 2:180 | WARNING at plan registration |

#### Muslim Personal Law — Shia (Ithna Ashari)

| Rule | Source | Enforcement |
|---|---|---|
| Radd (return) — surplus returned to sharers, not agnates | Ithna Ashari Shia law | Computed in laws.py |
| Daughter as sole heir: entire estate via Radd | Shia vs Sunni key difference | Confidence = 0.82 + qazi review warning |
| Agnates excluded if cognates exist | Shia rule | Implemented |

#### Christian (Indian Succession Act 1925)

| Rule | Source | Enforcement |
|---|---|---|
| Spouse + lineal descendants: spouse 1/3 | ISA 1925 S.33 | WARNING if spouse share ≠ 1/3 |
| No descendants but kindred: spouse 1/2 | ISA 1925 S.33A | Auto-computed |
| No descendants/kindred: spouse takes all | ISA 1925 S.33A | Auto-computed |
| Equal distribution among descendants regardless of gender | ISA 1925 S.34 | Auto-computed |

#### Parsi (ISA 1925 Ss.51–56)

| Rule | Source | Enforcement |
|---|---|---|
| Widow = equal share as each child | ISA 1925 S.51 | **HARD BLOCK** if widow ≠ child share |
| Sons = daughters (equal) | ISA 1925 | **HARD BLOCK** if sons ≠ daughters |
| No children: widow 1/2, kindred 1/2 | ISA 1925 S.52 | Auto-computed |

#### Special Marriage Act 1954

Inter-religious couples registered under SMA 1954 → ISA 1925 (Christian rules) applied automatically.

### Anti-Corruption Guarantees

1. **INHERITANCE mutations ONLY come from UTTARADHIKAR_ENGINE** (checked in mutation-manager.go — rejected if `initiatedBy != "UTTARADHIKAR_ENGINE"`)
2. **ALL heirs notified independently** via `HeirNotificationRequired` event → oracle sends N separate SMS (not through the Patwari)
3. **DLPI locked during SUCCESSION_PENDING** — no other transfer can happen
4. **Heir objection → auto court referral** — no officer discretion
5. **Court order required for revision** — chaincode validates eCourts oracle hash before accepting revised heirs

### Files

| File | Purpose |
|---|---|
| `blockchain/chaincode/uttaradhikar/uttaradhikar.go` | Core chaincode — all 3 trigger modes + law enforcement |
| `backend/ai-services/coparcenary-mapper/laws.py` | Python law engine — computes shares per religion |
| `backend/ai-services/coparcenary-mapper/main.py` | FastAPI — `/compute`, `/validate-plan`, `/compute-alive` |

---

## 3I. BhumiAuction — Forced Sale and Proceeds Distribution

### When Is BhumiAuction Triggered?

Three entry points — all from existing modules:

| Trigger | Source | Who initiates |
|---|---|---|
| **CoparcenaryPool dissolution** | Pool vote ≥ MinDissolveVote OR court order | DM / Revenue Court |
| **Settlement failure** | BhumiSettle escalates past DM (all 14-day windows exhausted) | DM orders auction as last resort |
| **Court decree execution** | eCourts oracle fires event | CPC Order XXI — execution of money decree against property |

### Three Auction Types

| Type | When used | Bid visibility | Best for |
|---|---|---|---|
| `OPEN_BID` | Standard pool dissolution | All bids visible in real time | Straightforward properties |
| `SEALED_BID` | High-value properties, court auctions | Bids encrypted until close; revealed simultaneously | Prevents collusion between bidders |
| `RESERVE_ONLY` | Urgent court sale | DM sets fixed price; first taker wins | Debt recovery, emergency sale |

### Core Flow (OPEN_BID — standard case)

```
1. CreateAuction (DM / officer)
   → reservePrice = circle rate × area (floor — cannot be set lower)
   → auctionType, bidWindowDays (7 default), emdPercent (10% default)
   → Status: CREATED

2. AuctionPublicNoticeRequired event fires
   → Oracle: post notice on bhulekh.up.gov.in
   → Oracle: SMS all registered members of the pool / village
   → Mandatory 21-day notice period before bidding opens (UP Revenue Rule)
   → Status: NOTICE_PERIOD

3. RegisterBidder (any citizen)
   → Bidder submits Aadhaar hash + EMD amount via UPI
   → Oracle confirms UPI payment → RecordEMDPayment called
   → Status: REGISTERED (per bidder)

4. Bid submission window opens (7 days)
   → PlaceBid(auctionId, bidderHash, bidAmountINR)
   → bidAmount must be ≥ reservePrice (hard block in chaincode)
   → Each new bid must be ≥ previous highest bid (hard block)
   → All bids permanently on-chain — no deletion, no modification
   → Status: BIDDING_OPEN

5. Auction closes
   → DeclareWinner called by oracle (or auto on deadline)
   → Winner = highest bidder
   → Status: WINNER_DECLARED

6. 30-day challenge window
   → Any losing bidder within 15% of winning bid can file AuctionChallenge
   → Challenge pauses title transfer
   → DM reviews and resolves
   → Status: CHALLENGE_PERIOD (or CONFIRMED if no challenges)

7. Winner pays balance (90% of bid — EMD was 10%)
   → RecordBalancePayment called by oracle on UPI confirmation
   → Deadline: 30 days from WINNER_DECLARED (hard deadline)
   → If missed: EMD forfeited, second-highest bidder gets 72-hour right of refusal
   → Status: PAYMENT_RECEIVED

8. Title transfer
   → AuctionExecuted fires → mutation-manager creates COURT_ORDER or AUCTION mutation
   → DLPI ownership transfers to winner
   → Status: EXECUTED

9. Proceeds distribution
   → Pool members / sellers each get proceeds proportional to their share
   → RecordProceedsDistribution called per member
   → Oracle triggers UPI transfer to each member's bank
   → Unclaimed proceeds after 7 years → BhumiAssurance Fund
   → Status: PROCEEDS_DISTRIBUTED
```

### Indian Legal Compliance Embedded in Chaincode

| Rule | Source | Chaincode enforcement |
|---|---|---|
| Reserve price ≥ circle rate × area | UP Land Revenue Act | `reservePrice < circleRateValue` → hard reject |
| 21-day public notice before bidding | UP Revenue Auction Rules | Timer in chaincode; bids rejected before notice expiry |
| EMD = 10% of reserve price | Standard UP revenue practice | EMD amount validated at RegisterBidder |
| Balance payment within 30 days | UP Revenue Rules | Hard deadline; EMD forfeiture auto-triggered at deadline |
| 30-day challenge period | CPC Order XXI R.72 | Status locked at CHALLENGE_PERIOD; no transfer during challenge |
| Stamp duty 7% on auction value | UP Stamp Act | StampDutyRequired event fires after WINNER_DECLARED |
| Registration within 4 months | Registration Act 1908 S.17 | RegistrationDeadline set on AuctionExecuted event |

### Chaincode Structs

```go
type AuctionBid struct {
    BidID       string
    BidderHash  string
    AmountINR   float64
    PlacedAt    string
    IsWinning   bool
}

type AuctionChallenge struct {
    ChallengerHash  string
    Reason          string
    FiledAt         string
    Status          string  // FILED | DISMISSED | UPHELD
    ResolvedAt      string
    ResolvedByHash  string
}

type ProceedsEntry struct {
    RecipientHash   string
    ShareDecimal    float64
    AmountINR       float64
    UPIRef          string
    Status          string  // PENDING | PAID | UNCLAIMED
    PaidAt          string
}

type Auction struct {
    AuctionID       string
    TriggerSource   string    // POOL_DISSOLUTION | SETTLEMENT_FAILURE | COURT_ORDER
    TriggerRefID    string    // poolId or caseId or courtCaseNo
    DLPIIds         []string  // one or many properties being auctioned
    AuctionType     string    // OPEN_BID | SEALED_BID | RESERVE_ONLY

    // Valuation
    CircleRateINR   float64   // per hectare, from bhumi-settle chaincode
    TotalAreaHa     float64
    ReservePrice    float64   // ≥ CircleRateINR × TotalAreaHa

    // Bidding
    EMDPercent      float64   // default 10
    EMDAmountINR    float64   // = ReservePrice × EMDPercent / 100
    BidWindowDays   int       // default 7
    RegisteredBidders []string
    Bids            []AuctionBid
    WinningBid      float64
    WinnerHash      string

    // Timeline
    NoticePeriodEnd string    // CreatedAt + 21 days
    BidOpenAt       string
    BidCloseAt      string
    ChallengePeriodEnd string

    // Challenge
    Challenges      []AuctionChallenge

    // Proceeds
    ProceedsLedger  []ProceedsEntry
    TotalProceeds   float64

    // Officer
    CreatedByHash   string
    CreatedByRank   string    // must be tehsildar or above

    Status          string
    // CREATED → NOTICE_PERIOD → BIDDING_OPEN → WINNER_DECLARED →
    // CHALLENGE_PERIOD → CONFIRMED → PAYMENT_RECEIVED → EXECUTED →
    // PROCEEDS_DISTRIBUTED
    CreatedAt       string
    UpdatedAt       string
}
```

### Chaincode Functions

| Function | Called by | What it does |
|---|---|---|
| `CreateAuction` | DM / Tehsildar | Creates auction; validates reservePrice ≥ circle rate; sets 21-day notice timer |
| `RegisterBidder` | Citizen | Registers interest; EMD amount recorded |
| `RecordEMDPayment` | Oracle (UPI confirm) | Confirms EMD received; bidder now eligible to bid |
| `PlaceBid` | Registered bidder | Records bid; validates ≥ reserve and ≥ current highest; bid is immutable |
| `DeclareWinner` | Oracle (on bid close) | Sets winner to highest bidder; starts challenge period |
| `FileChallenge` | Losing bidder | Records challenge; pauses title transfer |
| `ResolveChallenge` | DM | Dismisses or upholds challenge |
| `RecordBalancePayment` | Oracle (UPI confirm) | Confirms 90% balance received |
| `ForfeitEMD` | Oracle (on deadline miss) | Marks EMD forfeited; offers to second-highest bidder |
| `ExecuteAuction` | Oracle (after payment) | Fires AuctionExecuted event → mutation-manager creates AUCTION mutation |
| `RecordProceedsDistribution` | Oracle (per member) | Records UPI payout per pool member / seller |
| `QueryAuction` | Any | Returns full auction state |
| `QueryActiveAuctions` | Any | CouchDB query — all non-EXECUTED auctions |

### Key Events

```
AuctionPublicNoticeRequired   → oracle posts to bhulekh.up.gov.in + SMS village members
BidderRegistrationOpened      → informational
BiddingOpened                 → informational
NewHighBid                    → real-time WebSocket push to all watchers
AuctionWinnerDeclared         → oracle: notify winner + all losing bidders + pool members
StampDutyRequired             → oracle: generate stamp duty challan (7% of winning bid)
AuctionExecuted               → mutation-manager: create AUCTION mutation → DLPI ownership transfer
ProceedsDistributionRequired  → oracle: calculate UPI amounts per member; send payouts
```

### Anti-Corruption Design

1. **Reserve price is auto-computed from circle rates** — officer cannot set below circle rate. No low-price collusion.
2. **All bids immutable on-chain** — no bid can be retracted, modified, or backdated.
3. **21-day mandatory notice** — chaincode timer blocks bidding before notice expiry. No surprise auctions.
4. **Sealed bid prevents real-time collusion** — for SEALED_BID type, bids stored encrypted; all decrypted simultaneously at close.
5. **Winner identity in SEALED_BID is hidden until all bids submitted** — no "submit just above the current leader" gaming.
6. **EMD forfeiture is automatic** — oracle checks deadline, no officer discretion to give extensions.
7. **Challenge mechanism on-chain** — DM cannot bury a challenge; it's permanently recorded.

### Proceeds Distribution — Pool Dissolution Example

After a 64-member pool auction closes at ₹2 crore:

```
ProceedsLedger:
  Rahul   → 3/64 pool share → ₹2Cr × 3/64 = ₹9,37,500
  Deepak  → 2/64 pool share → ₹2Cr × 2/64 = ₹6,25,000
  ...
  (64 entries)

Oracle reads ProceedsDistributionRequired event →
For each entry: UPI transfer to registered bank account →
RecordProceedsDistribution(auctionId, recipientHash, upiRef) →
Status: PAID

Unclaimed after 7 years (member unreachable / no bank account) →
Amount moves to BhumiAssurance Fund
```

### Demo Scene: Pool Dissolution → Auction → Proceeds

```
SCENE (2 minutes):
1. Show 64-member CoparcenaryPool on Tehsildar dashboard
   "64 people, 8 properties, 6 generations of fragmentation"

2. DM clicks "Order Auction" → CreateAuction fires
   Reserve price auto-filled: ₹1.2 crore (from circle rates × total area)
   "System auto-set minimum from government circle rates. Cannot go lower."

3. 21-day notice fires → bhulekh.up.gov.in shows public notice
   "Every person in the village who might be interested is notified."

4. Bidding opens. Two bidders registered. Bids appear on-chain in real time.
   Suresh Sharma bids ₹1.5 crore. Another bidder bids ₹1.48 crore.
   "Both bids are permanent on the blockchain. No manipulation possible."

5. Auction closes. Winner: Suresh Sharma.
   "Title transfer paused — 30-day challenge window."

6. No challenges filed. Balance paid via NEFT.
   "AuctionExecuted → DLPI ownership transfers to Suresh Sharma."

7. 64 pool members receive UPI payouts in proportion to their shares.
   "Family of 64 finally resolved in one transaction.
    6 generations of dispute — closed."
```

### File

`blockchain/chaincode/bhumi-auction/bhumi_auction.go` — to be built

---

## 3J. NyayaAI — Legal Buddy for Everyone

### The Problem It Solves

Three groups are legally blind in Indian land matters today:

- **Citizens** — can't afford ₹5,000/consultation lawyers to know if their mutation is valid or their inheritance share is correct
- **Patwaris** — handle complex partition and succession cases daily but have zero formal legal training; errors are from ignorance, not malice
- **Tehsildar/DM** — receive escalated disputes with thick files; a 10-minute AI brief of a 3-year case saves hours

NyayaAI is a domain-specialized legal assistant that answers questions, summarises blockchain case data for officers, and drafts legal documents — all backed by Claude API, no fine-tuning needed.

### What NyayaAI Is (POC)

**API wrapper only.** No custom ML model, no vector DB, no eCourts live query.

- **Backend:** Claude API (claude-haiku-4-5 for Q&A, claude-sonnet-4-6 for document drafting)
- **System prompt:** Pre-loads all relevant Indian land laws + key SC judgments
- **Context injection:** Before answering, the API gateway fetches the relevant DLPI / mutation / succession case from blockchain and passes it as context — so answers are about the user's *actual* property, not a hypothetical
- **Language:** Auto-detect Hindi or English from the query; respond in the same language
- **Access:** Login required (JWT). Token limits enforced per role.

### Token Limits (Per Day)

| Role | Queries/day | Rationale |
|---|---|---|
| `citizen` | 10 | Prevents abuse; enough for genuine use |
| `patwari` / `circle_inspector` | 25 | Officers need more for case research |
| `tehsildar` and above | Unlimited | Decision-makers shouldn't be throttled |

Token count tracked in Redis / in-memory store keyed by `aadhaarHash + date`. Resets at midnight IST.

### Three Modes

#### Mode 1 — Legal Q&A

Natural language question → structured answer.

**Response always includes:**
1. Direct answer in plain language
2. The specific law section that applies
3. One relevant SC/HC judgment
4. Concrete next steps (what the user should actually do)
5. Mandatory disclaimer

**Example interactions:**

```
Citizen (Hindi):
"Mere bhai ne mujhe virasat mein hissa nahi diya — kya main kuch kar sakti hoon?"

NyayaAI:
"Haan, aapka hissa kanoon se surakshit hai.
 
 Kaanoon: Hindu Succession Act 1956, Section 6(3) (2005 mein sanshodhan)
 Rule: Beti ko beta ke barabar hissa milta hai — yeh janm se adhikar hai.
 
 SC Judgment: Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1
 Supreme Court ne kaha: Beti ka adhikar 9 September 2005 se pehle
 janmi beti ko bhi milega — chahe pita ki mrityu kab bhi hui ho.
 
 Aapke steps:
 1. Is portal pe 'Heir Objection' file karein — mutation rok jaayega
 2. Tehsildar ko legal heir application dein (AI draft neechey hai)
 3. Agar bhai nahi maane — Revenue Court mein partition petition
 
 [Draft: Legal Heir Certificate Application]
 
 ⚠️ Yeh AI se milne wali kanooni jaankari hai. Court mein jaane se
 pehle ek registered vakeel se zaroor milein."
```

```
Patwari (English):
"Can I execute a sale deed mutation if there is an active encumbrance on the DLPI?"

NyayaAI:
"No. A mutation for sale cannot be executed while an encumbrance exists.

 Law: Transfer of Property Act 1882, S.52 (lis pendens) +
      Registration Act 1908, S.17 read with UP Revenue Code 2006 S.34
 
 Rule: An encumbrance (mortgage/lien) on a DLPI blocks transfer of
 clean title. The buyer would take the property subject to the charge —
 which creates liability and is legally voidable.
 
 What you must do:
 1. Issue EC (Encumbrance Certificate) to both parties — shows the charge
 2. Mortgage must be discharged (bank NOC received) before mutation proceeds
 3. On BhumiChain: DLPI status = ENCUMBERED blocks transfer chaincode
    automatically — you do not need to manually check
 
 ⚠️ AI-generated legal information only. Consult a senior officer or
 advocate for complex cases."
```

#### Mode 2 — Case Summary (For Officers)

Officer passes a `caseId` or `mutationId`. NyayaAI reads the on-chain data and generates a 1-page structured brief.

**Used for:**
- Tehsildar receiving an escalated settlement dispute
- DM preparing to issue a partition order
- Circle Inspector reviewing a complex succession case

**Brief format:**
```
CASE BRIEF — AUTO-GENERATED BY NyayaAI
Case ID: SUC-DCA-DLPI-UP-DAD-00142-abc123
Generated: 2026-06-29

PROPERTY: DLPI-UP-DAD-00142, Khasra 142, Dadri
PARTIES:
  Deceased: Ramesh Kumar (died 2026-01-15, CRS reg: UP-GBN-2026-00891)
  Heir 1: Priya Kumar (Daughter) — 1/3 share — CONSENTED
  Heir 2: Arun Kumar (Son) — 1/3 share — CONSENTED
  Heir 3: Sunita Kumar (Daughter) — 1/3 share — OBJECTED

APPLICABLE LAW: HSA 1956 S.6(3) — daughters equal to sons

DISPUTE: Sunita objects to equal 1/3 share — claims 1/2 share
         (alleges Priya forfeited rights by marrying)

LEGAL ANALYSIS:
  Sunita's claim has no basis in law. Marriage does not forfeit
  a daughter's coparcenary right (Vineeta Sharma 2020).
  All three heirs are entitled to equal 1/3 shares.

RECOMMENDATION: Dismiss Sunita's objection. Proceed with auto-mutation
                on 1/3 equal shares. If Sunita wishes to contest,
                Revenue Court is the appropriate forum.

TIMELINE: Initiated 2026-02-01. In dispute for 47 days. SLA breach if
          not resolved by 2026-03-01 (30-day window).
```

#### Mode 3 — Document Drafting

Citizen or officer requests a document type. NyayaAI drafts it in 30 seconds using context from the blockchain.

**Documents available for POC:**

| Document | Who needs it | Typical use |
|---|---|---|
| Death Affidavit | Heir (for HEIR_PETITION trigger) | When CRS death cert is delayed |
| Legal Heir Certificate Application | Heir → to Tehsildar | Official request for heir recognition |
| Mutation Objection Letter | Co-owner | Opposing a mutation within 30-day window |
| No Objection Certificate (NOC) | Co-heir | Agreeing to another heir's actions |
| Settlement Agreement Outline | All parties | Foundation for BhumiSettle partition |
| Partition Application | Member → Revenue Court | Forced partition petition under HSA S.23 |
| FEMA Compliance Letter | NRI heir | Required for repatriation of sale proceeds |
| Guardian Application | Parent/relative | Requesting court-appointed guardian for minor heir |

**Each draft includes:**
- Correct headings and formatting for UP Revenue Courts
- Pre-filled with actual names/dates/parcel details from blockchain
- Clear `[FILL IN]` markers where user must provide information not on-chain
- Disclaimer: *"AI-generated draft template. Review with a qualified advocate before submitting."*

### System Prompt — What Laws Are Pre-Loaded

```
You are NyayaAI, a specialized legal assistant for Indian land law and property records.
You work within the BhumiChain system for Gautam Buddha Nagar (Noida), Uttar Pradesh.

You have deep knowledge of:

STATUTES:
- Hindu Succession Act 1956 (amended 2005) — full text of Ss. 6, 8, 10, 14, 23, 29
- Transfer of Property Act 1882 — Ss. 5, 52, 54, 122 (gift), 58 (mortgage)
- Registration Act 1908 — Ss. 17 (compulsory), 49 (unregistered docs inadmissible)
- UP Revenue Code 2006 (Bhu-Abhilekh) — mutation procedure, time limits
- Muslim Personal Law (Shariat) Application Act 1937 — Hanafi + Shia basics
- Indian Succession Act 1925 — Ss. 33-36 (Christian), 51-56 (Parsi)
- Forest Rights Act 2006 — S.4(5) tribal land alienation restriction
- FEMA 1999 — S.6(5) NRI agricultural land restrictions
- Limitation Act 1963 — Art. 65 (12 years for immovable property)
- Specific Relief Act 1963 — S.12 (partition suits)
- CPC 1908 — Order XXI (decree execution), Order XXXII (minors)
- DPDPA 2023 — data privacy basics relevant to land records

KEY JUDGMENTS:
- Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1: daughters' coparcenary rights from birth
- Suraj Lamp & Industries v. State of Haryana (2012) 1 SCC 656: GPA sales are not valid transfers
- Kancherla Lakshmaiah v. Kancherla Nageswara Rao (2022): HUF partition
- Danamma v. Amar (2018) 3 SCC 343: daughter's share in coparcenary property pre-2005
- Indra Sarma v. V.K.V. Sarma (2013): live-in relationship rights (for inheritance context)

BHUMICHAIN CONTEXT:
- DLPI = Digital Land Parcel Identity (the blockchain record of a parcel)
- Mutation = change in land records (inheritance, sale, partition)
- CoparcenaryPool = holds multiple DLPIs for joint family; members have pool shares
- BhumiSettle = equitable partition engine; uses circle rates for valuation
- Uttaradhikar = inheritance engine; supports 3 trigger modes
- Circle rate = government minimum land value per hectare, set by Tehsildar

RESPONSE RULES:
1. Always cite the specific law section (not just the act name)
2. Always mention at least one SC/HC judgment when one exists
3. Always give concrete next steps the user can take
4. Respond in Hindi if the query is in Hindi; English if in English
5. Always end with the disclaimer
6. For document drafts: use formal language suitable for UP Revenue Courts
7. Never give an opinion on whether a specific person is guilty of fraud
8. If the question is outside land law scope, say so clearly and redirect
```

### Service Architecture

**Merged with BhumiGPT** — one service, one port, one deployment. BhumiGPT (Hindi Q&A chat) and NyayaAI (structured legal buddy) are the same capability at different depth levels. No reason to run two Claude-backed services separately.

```
File: backend/ai-services/nyaya-ai/main.py   ← BhumiGPT merged here
Port: 8012

Endpoints:
  POST /nyaya/ask              Legal Q&A + BhumiGPT general chat (claude-haiku-4-5)
  POST /nyaya/summarize        Case summary for officers (claude-sonnet-4-6)
  POST /nyaya/draft            Document draft (claude-sonnet-4-6)
  GET  /nyaya/token-status     Returns {used: N, limit: M, resetsAt: ISO}
  GET  /health

All endpoints require: Authorization: Bearer <JWT>
Token tracking: in-memory dict {aadhaarHash_date: count} (Redis in production)

Note: /nyaya/ask handles both citizen casual chat ("Meri zameen ka EC kaise nikaaloon?")
and structured legal queries ("What are my rights under HSA 2005?") — same endpoint,
Claude adapts depth based on query complexity.
```

### What NyayaAI Is NOT (POC Scope)

- ❌ Live eCourts case lookup (future phase — needs eCourts API empanelment)
- ❌ Court e-filing integration
- ❌ Custom fine-tuned model on eCourts data
- ❌ Vector database of 18 crore cases
- ❌ Bar Council registration verification
- ❌ Criminal law advice (land fraud FIR, IPC sections)

### Demo Scene

```
Tehsildar opens NyayaAI tab → types (or shown pre-typed):
"Summarise the inheritance case for DLPI-UP-DAD-00142"

NyayaAI reads blockchain data → returns 1-page brief in 3 seconds:
  Property, parties, dispute, legal analysis, recommendation

Then: Priya Kumar (citizen) asks in Hindi:
"Mera bhai mujhe hissa nahi de raha — main kya kar sakti hoon?"

NyayaAI: answers with HSA 2005 + Vineeta Sharma 2020
         + draft Legal Heir Application in her name ready to download

Demo point:
"Yeh woh kaam hai jo pehle ₹5,000 ka vakeel karta tha.
 Ab koi bhi citizen se le ke tehsildar tak — sabko ek
 AI-powered kanooni sahayak mil gaya hai."
```

---

## 3K. Notification System — SMS, Email, Telegram

### Why This Module Is Critical

Every other module depends on notifications actually reaching people:
- An inheritance mutation alert that never reaches a co-heir → fraud succeeds
- A succession consent request that goes undelivered → case stuck indefinitely
- A fraud alert that officers don't see → corrupt officer continues

BhumiChain sends notifications through **3 channels simultaneously**: SMS, Email, Telegram. If any one fails, the others are the fallback.

### Three Channels

| Channel | POC Implementation | Production Upgrade | Who uses it |
|---|---|---|---|
| **SMS** | Mock (console.log + display in UI) | MSG91 (India-specific, Hindi templates) / Twilio | Everyone with a mobile number |
| **Email** | Nodemailer + Mailhog (local SMTP dev server) | SendGrid / NIC email | Citizens with email |
| **Telegram** | **Real** Telegram Bot API (free, no approval needed) | Same | Citizens who opt in |

**Why Telegram is real even in POC:** The Telegram Bot API requires zero approval, zero payment, and zero infrastructure — just a bot token from @BotFather. This means we can show real notifications during the physical demo, not mocked ones. SMS and email are mocked but Telegram works live.

### Telegram Opt-in Flow

Telegram cannot push to users who haven't started the bot first. So citizens must opt in:

```
1. Citizen logs into BhumiChain portal → Profile page
2. Clicks "Link Telegram for notifications"
3. Portal generates a unique 8-char link code tied to their aadhaarHash
   Example: GBN-K9M2P7

4. Citizen opens Telegram → searches @BhumiChainBot
5. Sends: /link GBN-K9M2P7
6. Bot replies: "✅ Your BhumiChain account is now linked.
               You will receive property alerts on Telegram."

7. NotificationService stores: { aadhaarHash: "sha256:...", telegramChatId: 123456789 }
   (in-memory for POC, Redis/DB for production)

8. All future notifications go to this chat ID
```

**For demo:** Pre-link the demo personas (Priya, Arun) to a real Telegram account during setup so notifications visibly arrive during the presentation.

### Events That Trigger Notifications

| Event (from Fabric) | Recipients | Message |
|---|---|---|
| `MutationAlertRequired` | ALL current owners of the DLPI | "Aapki zameen [DLPI] par mutation shuru hua hai. 30 din mein aaparti karein." |
| `HeirNotificationRequired` | ALL identified heirs | "Aap [deceased name] ke waris hain. Apna hissa sweekar karein." |
| `AuctionPublicNoticeRequired` | All registered members of the pool + village members | "DLPI [id] ki neelami [date] ko hogi. Reserve price: ₹[X]" |
| `SuccessionDisputeFiled` | All heirs + Tehsildar | "Case [id] mein aaparti darj ki gayi. Court referral ho sakta hai." |
| `OfficerFraudAlertFired` | Supervising officer only (not the flagged officer) | "⚠️ FRAUD ALERT: [Officer name] ke baare mein pattern mila. Turant dekhen." |
| `AllHeirsConsentedAutoMutation` | All heirs | "✅ Sab hisson ne samati di. Zameen ka haq transfer ho raha hai." |
| `TransferCompleted` | Buyer + Seller | "✅ Zameen ka transfer poora hua. DLPI [id] aapke naam par." |
| `ClaimWindowExpiringSoon` | Owner whose parcel is unclaimed | "⚠️ 3 din baad aapka claim window band ho jayega. Abhi verify karein." |
| `DissolutionApproved` | All pool members | "Pool [id] mein dissolution approved. Neelami shuru hogi." |
| `AuctionWinnerDeclared` | Winner + all bidders + pool members | "Neelami khatam. Vijeta: [name]. Bid: ₹[X]" |

### Notification Templates (Hindi/English)

Each event has two template variants. Language selected based on user preference (default: Hindi).

```javascript
// Example — MutationAlertRequired
templates.MutationAlertRequired = {
  hi: {
    sms: "BhumiChain Alert: Aapki zameen {{dlpiId}} par mutation shuru hua. " +
         "Aaparti ke liye {{deadline}} tak portal par jayein: bhumichain.nic.in",
    email: {
      subject: "Zameen ka Mutation Shuru — Aaparti Zaroori",
      body: "..." // full HTML template
    },
    telegram: "🏛 *BhumiChain Mutation Alert*\n\n" +
              "Aapki zameen *{{dlpiId}}* par mutation shuru hua hai.\n" +
              "Officer: {{officerName}}\n" +
              "Deadline: {{deadline}}\n\n" +
              "Portal par jayein: bhumichain.nic.in\n" +
              "_Aaparti na karne par mutation approved ho sakta hai._"
  },
  en: {
    sms: "BhumiChain: Mutation initiated on your parcel {{dlpiId}} by {{officerName}}. " +
         "Object within 30 days at bhumichain.nic.in",
    telegram: "🏛 *BhumiChain Mutation Alert*\n\n" +
              "Mutation initiated on parcel *{{dlpiId}}*\n" +
              "By: {{officerName}}\n" +
              "Deadline: {{deadline}}\n\n" +
              "Visit: bhumichain.nic.in"
  }
}
```

### Service Architecture

**Built inside api-gateway, not a separate service** — for POC, notification logic is a module imported by api-gateway. No extra port, no extra deployment, no extra Docker container.

```
File: backend/api-gateway/src/notifications/index.js   ← module, not service
       backend/api-gateway/src/notifications/sms.js
       backend/api-gateway/src/notifications/email.js
       backend/api-gateway/src/notifications/telegram.js
       backend/api-gateway/src/notifications/templates.js

How it works:
  After every chaincode event (fabric-network SDK event listener in api-gateway),
  the gateway calls notify(eventType, recipients, payload) directly as a function call.
  No HTTP hop, no extra port, no separate process.

External route exposed (for Telegram opt-in):
  POST /api/notifications/telegram/link   Citizen links Telegram account
  GET  /api/notifications/telegram/status/:aadhaarHash

Telegram chat ID store: in-memory Map for POC, Redis for production
```

**Production extraction:** When the notification volume grows (hundreds of thousands of events), extract to a standalone service with its own queue (Redis Bull or RabbitMQ). The module boundary makes this a clean cut — no api-gateway refactoring needed.

### Delivery Tracking

Every alert delivery (success or failure) is recorded back on-chain via `RecordOwnerAlertDelivery` in the mutation-manager chaincode. This creates an immutable audit trail:

```
"Did the co-owner receive the alert?" → answerable from blockchain
"When did they receive it?" → answerable from blockchain
"Did they acknowledge it?" → answerable from blockchain (RecordOwnerConsent / RecordOwnerObjection)
```

If a mutation is later contested: "I was never notified" — the chain shows exactly when and where the alert was sent.

### Mock Setup for POC (Non-Telegram Channels)

```javascript
// notification-service/channels/sms.js
async function sendSMS(phone, message) {
  if (process.env.SMS_MOCK === 'true') {
    console.log(`[SMS MOCK] To: ${phone}\n${message}`);
    return { status: 'mock_sent', messageId: `MOCK-${Date.now()}` };
  }
  // Production: MSG91 API call
}

// notification-service/channels/email.js
async function sendEmail(to, subject, body) {
  if (process.env.EMAIL_MOCK === 'true') {
    // Send to Mailhog (localhost:1025) — visible in Mailhog UI at localhost:8025
    const transporter = nodemailer.createTransport({ host: 'localhost', port: 1025 });
    return transporter.sendMail({ from: 'alerts@bhumichain.nic.in', to, subject, html: body });
  }
  // Production: SendGrid
}

// notification-service/channels/telegram.js — REAL even in POC
async function sendTelegram(chatId, message) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' })
  });
}
```

### Demo Setup

Before demo day:
1. Create `@BhumiChainBot` on Telegram via @BotFather → get bot token
2. Pre-link demo personas (Priya Kumar, Arun Kumar) to the demo presenter's Telegram
3. Set `TELEGRAM_BOT_TOKEN` in `.env`
4. During demo: trigger any mutation event → real Telegram message arrives on the presenter's phone

This is the most visually impressive notification moment in the demo — showing a real phone receive a real Telegram message while on screen the mutation alert fires.

### Environment Variables

```env
# notification-service/.env
SMS_MOCK=true
EMAIL_MOCK=true             # sends to Mailhog
TELEGRAM_BOT_TOKEN=         # real token — get from @BotFather
TELEGRAM_MOCK=false         # always false — Telegram is real in POC

# For production (not POC):
SMS_PROVIDER=msg91
MSG91_AUTH_KEY=
SENDGRID_API_KEY=
```

---

## 3L. Encumbrance Certificate (EC) — Instant, Verifiable, QR-Coded

### What Is an EC and Why Does It Matter?

An Encumbrance Certificate proves a property has no pending loans, mortgages, or legal charges. Every bank requires it before sanctioning a loan. Every buyer checks it before purchasing land.

**Today in India:** 2–7 days wait at SRO office, ₹200–500 fee, physical queue, paper document that can be forged.

**BhumiChain:** 30 seconds, free, digitally signed, QR code verifiable by anyone on their phone.

This is the single most immediately useful feature for everyday citizens and banks.

### Who Can Access It

- **Public search** — anyone enters a Khasra number or DLPI ID, no login needed. EC is a public document in India (same as current SRO practice).
- **Citizen download** — logged-in citizen downloads EC for their own parcel as a signed PDF.
- **Bank API** — external API key (no citizen JWT) for banks to query EC programmatically before loan sanction.

### What the EC Contains

```
┌─────────────────────────────────────────────────────────────────┐
│           ENCUMBRANCE CERTIFICATE                               │
│           BhumiChain | Govt of Uttar Pradesh                   │
│                                                                 │
│  DLPI ID    : DLPI-UP-DAD-00142                                │
│  Khasra No  : 142, Dadri Village, Gautam Buddha Nagar          │
│  Area       : 0.5 hectares (Agricultural)                       │
│  ULPIN      : UP-GBN-DAD-142-001 (if available)               │
│                                                                 │
│  CURRENT OWNERS                                                 │
│  1. Priya Kumar    — 1/3 share  (since 2026-02-15)             │
│  2. Arun Kumar     — 1/3 share  (since 2026-02-15)             │
│  3. Sunita Kumar   — 1/3 share  (since 2026-02-15)             │
│                                                                 │
│  ENCUMBRANCES (last 30 years)                                  │
│  ✅ NONE — No mortgage, lien, or legal charge found            │
│                                                                 │
│  TRANSACTION HISTORY (last 13 years)                           │
│  2026-02-15 : Inheritance mutation (Ramesh Kumar → 3 heirs)    │
│  2025-11-01 : DLPI created from UP Bhulekh records             │
│                                                                 │
│  PENDING MUTATIONS    : NONE                                    │
│  ACTIVE DISPUTES      : NONE                                    │
│  SUCCESSION PENDING   : NO                                      │
│                                                                 │
│  Generated : 2026-06-29T14:32:00Z (blockchain timestamp)       │
│  Valid for : 72 hours from generation                           │
│  Chain Hash: 8f3a2c9d...                                       │
│                                                                 │
│  ┌─────────┐   Verify this certificate:                        │
│  │ QR CODE │   bhumichain.nic.in/verify/EC-8f3a2c9d           │
│  │         │   Scan to confirm authenticity on blockchain      │
│  └─────────┘                                                   │
│                                                                 │
│  ⚠️  This certificate is valid for 72 hours. For transactions, │
│     generate a fresh EC. Blockchain data is authoritative.      │
└─────────────────────────────────────────────────────────────────┘
```

### QR Code Design

- QR encodes URL: `bhumichain.nic.in/verify/EC-<sha256-of-dlpiId+timestamp>`
- Public verify page: shows same EC data fetched live from chain — no login
- Bank officer scans → sees green "✅ VERIFIED — No encumbrances" or red "⚠️ ACTIVE MORTGAGE"
- Generated server-side using `qrcode` npm package (no third-party service)
- Embedded in EC PDF using `pdfkit` + `qrcode`

### API Endpoints

```
GET  /api/dlpi/:dlpiId/encumbrance-cert          Public — returns EC JSON
GET  /api/dlpi/:dlpiId/encumbrance-cert/pdf      Public — returns signed PDF with QR
GET  /api/verify/EC-:hash                        Public — QR scan verification endpoint
POST /api/ec/bank-query                          API key auth (for banks, no JWT)
```

### What Triggers EC Invalidation

If any of these change after an EC is generated, the QR verification shows a warning:
- New encumbrance registered
- Transfer initiated (national lock active)
- Succession pending
- Court order filed
- Data disputed

This forces the requester to generate a fresh EC — ensuring banks always have current data.

### Implementation

```
File: backend/api-gateway/src/routes/ec.js
QR:   npm package 'qrcode' — zero third-party service, generated locally
PDF:  npm package 'pdfkit' — generate PDF on the fly
Data: Read from Fabric chaincode (dlpi + encumbrance chaincodes)
Sign: HMAC-SHA256 of {dlpiId + timestamp + chainHash} with server secret
```

---

## 3M. Mutation Manager — Anti-Corruption Architecture

### The Core Problem: Generational Co-Ownership Fragmentation

This is the **#1 corruption vector in Indian land records.**

**How it happens:**

Ramesh Kumar owns 4 plots. He has 2 sons: Arun and Vijay. Ramesh dies. By law, all 4 plots
should list BOTH sons as co-owners (1/2 share each). Each generation compounds this:

```
Gen 1: Ramesh (sole owner) → 4 plots

Gen 2: Arun (1/2) + Vijay (1/2) → all 4 plots
       [correct — both names on all 4]

Gen 3: Arun dies → his sons Rahul + Deepak inherit his 1/2
       Vijay dies → his sons Sunil + Manoj inherit his 1/2
       Result: 4 owners (Rahul 1/4, Deepak 1/4, Sunil 1/4, Manoj 1/4) on all 4 plots

Gen 4: each of the 4 has 2 children → 8 names on all 4 plots
```

**The Bribery Mechanism (Today, without BhumiChain):**

Rahul goes to the Patwari and pays ₹1 lakh. The Patwari opens the mutation register and writes
"Inheritance: Plot A → Rahul Kumar (sole owner)" — omitting Deepak, Sunil, and Manoj entirely.
Rahul sells Plot A to a builder for ₹50 lakh. The other 3 find out years later. Property is gone.
Legal battle takes 15 years.

**Why This Is Architecturally Hard to Prevent Without Blockchain:**

- Paper mutation registers can be altered
- Heirs in different cities have no way to monitor mutations on their plots
- A Patwari who accepts ₹1 lakh faces no technical barrier — just a bureaucratic one
- The same officer who initiates the mutation also notifies the owners (obvious conflict of interest)

---

### BhumiChain's Three Hard Rules

These are ARCHITECTURAL constraints in the chaincode — not process guidelines.

#### RULE 1: Inheritance Mutations Cannot Be Manually Filed

An `INHERITANCE` type mutation can ONLY be auto-generated by the Uttaradhikar Engine
after ALL heirs have given eSign consent. The `InitiateMutation` function returns
`ANTI_CORRUPTION` error if a Patwari tries to manually create an Inheritance mutation.

```
CORRECT:    Heir submits death cert → Uttaradhikar Engine runs → CoparcenaryMapper AI
            identifies ALL heirs → ALL heirs eSign → Engine auto-generates Inheritance mutation
            → Patwari gets 60-second alert to CONFIRM (cannot change who the heirs are)

REJECTED:   Patwari opens mutation form → types "Type: Inheritance, New Owner: Rahul Kumar"
            → chaincode returns: "ANTI_CORRUPTION: Inheritance mutations cannot be manually
            filed by officers. Attempt by [officerHash] on DLPI [dlpiId] permanently recorded."
```

The Patwari's role in succession is to CONFIRM the mutation the system generated — not to CREATE it.
Their Aadhaar hash and the confirmation timestamp are stored permanently on-chain regardless.

#### RULE 2: ALL Co-Owners Get Simultaneous Independent Alerts

When ANY mutation is initiated on a multi-owner DLPI, the event fired contains `allOwnerHashes[]` —
every single Aadhaar hash in `Owners[]`. The oracle service sends an independent SMS/WhatsApp to each
one simultaneously. This is not an "alert to the registered owner" — it is N individual alerts for N owners.

```go
// In InitiateMutation:
alertEvent = {
    "allOwnerHashes": ["sha256:rahul001", "sha256:deepak001", "sha256:sunil001", "sha256:manoj001"],
    "alertChannels":  ["SMS", "WHATSAPP", "APP"],
    "consentDeadline": 30 days from now,
    ...
    "officerName":  "Vijay Singh",   // permanently in event
    "officerHash":  "sha256:vijay001"  // accountability
}
```

The oracle reads this event and sends 4 independent SMS messages. If any one SMS fails delivery,
it's tracked per-owner in `OwnerAlerts[]`. The officer cannot send to fewer owners — the list
comes from the DLPI chaincode's `Owners[]` at the time of mutation, not from the officer's input.

**60-second SLA:** From mutation initiation to all N alerts delivered is tracked on-chain.
For demo: SLA is simulated — in production this would be enforced with penalty mechanisms.

#### RULE 3: Mutation Blocked During Pending Succession

If a DLPI has `SuccessionStatus = SUCCESSION_PENDING`, the API layer blocks all mutation
initiation attempts. This prevents the window where an owner just died but succession hasn't
completed — which is exactly when bribery attempts peak.

```
Ramesh dies → Uttaradhikar Engine starts → SuccessionStatus = SUCCESSION_PENDING
During this window: ANY mutation attempt on DLPI-UP-DAD-00142 → BLOCKED
Reasoning: Until we know who the heirs are (from CRS + CoparcenaryMapper), nobody can
           initiate a mutation that might entrench a fraudulent ownership state.
```

---

### Data Structure Design

```go
// MutationRequest — one mutation case (replaces old single-field design)
type MutationRequest struct {
    MutationID   string          // unique
    MutationNo   string          // human-readable: "MUT/2026/A3F7"
    DLPIId       string
    MutationType string          // SALE | INHERITANCE | PARTITION | GIFT | COURT_ORDER | CORRECTION

    // Officer permanently recorded — cannot be changed after creation
    OfficerName  string
    OfficerHash  string          // sha256(officerAadhaar + salt)
    OfficerRank  string          // patwari | circle_inspector | tehsildar

    // Source of mutation — critical for Inheritance
    InitiatedBy      string      // OFFICER | UTTARADHIKAR_ENGINE | PROPERTY_TRANSFER | COURT
    SuccessionCaseId string      // required when InitiatedBy = UTTARADHIKAR_ENGINE

    NewOwners    []NewOwnerEntry // array — no more single-owner field possible

    // Per-owner alert tracking — one entry per current co-owner
    OwnerAlerts  []OwnerAlert   // {aadhaarHash, alertSentAt, delivered, response, eSignTxHash}

    PartitionScheme *PartitionScheme // only for PARTITION type
    Status string                    // DRAFT | ALERTS_SENT | AWAITING_CONSENTS | ALL_CONSENTED |
                                     // OBJECTION_FILED | PUBLIC_NOTICE_PERIOD | PENDING_EXECUTION |
                                     // EXECUTED | REJECTED | COURT_REFERRED
}

// OwnerAlert — individual co-owner tracking
type OwnerAlert struct {
    AadhaarHash     string      // which co-owner
    AlertSentAt     string      // when alert fired
    AlertChannel    string      // SMS | WHATSAPP | APP
    AlertDelivered  bool
    DeliveredAt     string
    Response        string      // PENDING | CONSENTED | OBJECTED | NO_RESPONSE
    ResponseAt      string
    ESignTxHash     string      // filled on consent
    ObjectionReason string      // filled on objection
    ObjectionCID    string      // IPFS hash of objection evidence
}
```

**Key change from old design:**
- Old: `NewOwnerName string` + `OwnerConsentHash string` — single person
- New: `NewOwners []NewOwnerEntry` + `OwnerAlerts []OwnerAlert` — unlimited co-owners

---

### Mutation Types and Flows

#### Type: SALE (auto-generated by PropertyTransfer chaincode)
When a property transfer is executed, the PropertyTransfer chaincode auto-generates the SALE mutation.
A Patwari cannot manually create a SALE mutation — it comes from the completed transfer record.

#### Type: INHERITANCE (auto-generated by Uttaradhikar Engine ONLY)
```
Uttaradhikar Engine (after all heirs consent):
    → calls InitiateMutation(initiatedBy="UTTARADHIKAR_ENGINE", successionCaseId="SC-...")
    → mutation auto-generated with NewOwners = heirs from succession case
    → Patwari gets 60-second SLA notification to CONFIRM
    → On confirmation: ExecuteMutation() → DLPI.UpdateOwners() called
    → All 4 co-owners get simultaneous alerts (30-day objection window)
```

#### Type: PARTITION (solution to generational fragmentation)

Partition is the PERMANENT solution to the N-owner fragmentation problem.

After 4 generations, Ramesh's 4 plots have 8 co-owners. The family decides to partition:
- Plot A → Rahul (sole owner, new DLPI-UP-DAD-00142-P1)
- Plot B → Deepak (sole owner, new DLPI-UP-DAD-00142-P2)
- Plot C → Sunil (sole owner, new DLPI-UP-DAD-00142-P3)
- Plot D → Manoj (sole owner, new DLPI-UP-DAD-00142-P4)

```
All 4 owners must eSign the partition deed (OwnerAlerts[] for all 4)
    ↓
PartitionScheme: { awards: [{owner: Rahul, newDLPIId: ..., areaHectares: 0.5}, ...] }
    ↓
ExecuteMutation() →
    Creates 4 new DLPIs (each with 1 sole owner)
    Marks parent DLPI as PARTITIONED (terminal state — no more transactions)
    ↓
After partition: each owner has a clean single-owner DLPI
Future generations: fragmentation resets to Generation 1
```

**Why Partition Solves the Problem:**
After partition, each of the 4 children owns 1 plot outright. When THEY die, their heirs inherit
1 plot with N heirs — manageable. No more 8-owner joint property where any 1 person can bribe
a Patwari to sell the whole thing.

BhumiChain **actively nudges toward partition** — the officer dashboard shows "joint properties with 4+
co-owners" as a recommendation to initiate partition before fragmentation compounds further.

#### Type: GIFT
All current owners must give eSign consent (they're all giving away their share).
Public notice mandatory (30 days). Lower stamp duty applies.

#### Type: COURT_ORDER
No owner consent required — court decree is authoritative. Requires `courtOrderNo` and
`courtOracleHash` from the eCourts oracle. Skips objection window.

#### Type: CORRECTION / NAME_UPDATE
No ownership change — just fixes a data error (wrong area, spelling of name, etc.).
Still fires alerts to ALL co-owners so they know a correction was made.

---

### Mutation Status Flow

```
[DRAFT]
   ↓ (alerts fired within 60 seconds)
[ALERTS_SENT]
   ↓ (oracle confirms deliveries)
[AWAITING_CONSENTS]
   ↓ (any owner objects)                    ↓ (all owners consent)
[OBJECTION_FILED]                        [ALL_CONSENTED]
   ↓ (Tehsildar hears)                      ↓ (Tehsildar approves)
[COURT_REFERRED]                        [PENDING_EXECUTION]
   ↓ (court order)                          ↓
[COURT_ORDER mutation]               [EXECUTED]
                                         → DLPI.UpdateOwners() called
                                         → Owners[] now reflect new reality
```

For INHERITANCE / PARTITION / GIFT — 30-day PUBLIC NOTICE PERIOD runs in parallel with AWAITING_CONSENTS.
If any third party objects during public notice → COURT_REFERRED.

---

### Accountability Mechanism

Every mutation record permanently stores:
- `officerAadhaarHash` — who initiated
- `officerRank` — their level
- `initiatedBy` — OFFICER vs. UTTARADHIKAR_ENGINE (auto)
- `OwnerAlerts[]` — exactly who was notified, when, and what they responded

This means:
- If a Patwari tries to file Inheritance manually → rejected + attempt logged with their hash
- If alerts only went to 2 of 4 co-owners → permanent record shows who wasn't alerted
- If co-owner was notified and didn't object in 30 days → no legal remedy later ("constructive notice")
- If co-owner objected → case cannot proceed without court order

The immutability of Hyperledger Fabric means this audit trail cannot be altered after the fact.
A corrupt Patwari cannot hide their attempt — even failed attempts are permanently recorded.

---

### What Remains to Wire Up (POC TODO)

| Component | Status | What's needed |
|---|---|---|
| `mutation_manager.go` | ✅ Rewritten | Multi-owner, anti-corruption rules |
| Mutation API routes (`/api/mutation/`) | ❌ TODO | Routes in api-gateway |
| Oracle: multi-owner alert dispatch | ❌ TODO | Read `allOwnerHashes[]` from event, send N SMS |
| WebSocket: per-owner mutation alerts | ❌ TODO | Push to each owner's session independently |
| Uttaradhikar → auto-generate Inheritance mutation | ❌ TODO | Uttaradhikar chaincode post-consent hook |
| Partition UI | ❌ TODO | "Initiate Partition" flow with scheme builder |
| Officer dashboard: "Joint properties with 4+ owners" | ❌ TODO | Query + recommendation panel |

---

## 4. User Roles & Login Hierarchy

### 4.1 Why Govt Login Exists

Two reasons:
1. **Fabric identity signing** — The blockchain only trusts transactions signed by a Fabric identity belonging to the Revenue Dept MSP. A citizen Aadhaar JWT cannot create a DLPI. Only an officer Fabric certificate can.
2. **Officer accountability** — Every mutation, creation, and approval has the officer's Aadhaar hash permanently on-chain. Without officer login there is no audit trail.

### 4.2 DILRMP / UP Bhulekh Coverage (Noida District)

| Coverage Type | India Avg | Uttar Pradesh | Gautam Buddha Nagar |
|---|---|---|---|
| Khatauni records digitized | ~95% | ~90% | ~85% |
| Geo-referenced (GPS polygon) | ~49% | ~42% | ~50% (urban areas better) |
| Structured API-accessible | ~30% | ~35% | ~40% |

UP Bhulekh (bhulekh.up.gov.in) has most Khataunis online but as PDFs/HTML views, not structured API. RecordScan AI is needed to process these documents.

Noida (Dadri tehsil): good digital coverage for urban plots. Peri-urban villages (Dadri, Jewar) have more paper records. No tribal land in Noida — TribalGuard is shown as a system feature for tribal UP districts.

### 4.3 UP Land Admin Hierarchy (Dadri Tehsil, Noida)

```
NIC / DoLR (national)
  └── Revenue Board, UP (state)
        └── Divisional Commissioner, Meerut (division)
              └── District Magistrate / Collector (district — Gautam Buddha Nagar)
                    └── Sub-Divisional Magistrate (SDM)
                          └── Tehsildar (taluka/tehsil head — Dadri)
                                └── Naib Tehsildar
                                      └── Kanungo / Circle Inspector (supervises Lekhpals)
                                            └── Lekhpal (= Patwari in field — village level)
                                                  └── Kotwal (notice server, village watchman)

—— separate chain ——
Sub-Registrar (SRO) ← sale deed registration + EC issuance
```

> **Important:** In UP, the village-level officer is officially called **Lekhpal**, not Patwari (though everyone calls them Patwari colloquially). The supervisor is called **Kanungo** (equivalent to Circle Inspector / Revenue Inspector). The demo uses the popular names: Patwari and Circle Inspector.

### 4.4 Role Definitions — The 5 Roles for Demo

**Simplified for POC.** Full hierarchy exists in production; demo focuses on the 5 roles that create visible workflow.

---

#### 1. Tehsildar (`tehsildar`)
**Real job:** Head of the tehsil (Dadri). Judicial and executive authority for all land records in the tehsil. Signs off on mutations, hears revenue cases, final word on disputed claims.

**In BhumiChain:**
- Final approval on mutation entries (dakhil kharij)
- Approves contested succession cases referred by Circle Inspector
- Can set a parcel as "disputed" → blocks any transfer
- Sees entire tehsil dashboard: all pending mutations, active disputes, succession queue
- Approves bulk seed operations from DILRMP

**Dashboard:** Officer queue view — list of pending approvals with SLA timer, disputed parcel map, officer activity log

---

#### 2. Circle Inspector / Kanungo (`circle_inspector`)
**Real job:** Supervises 10–20 Lekhpals/Patwaris. Does field verification. Checks accuracy of entries made by Patwari. Submits reports to Tehsildar. In UP also called Kanungo.

**In BhumiChain:**
- Reviews and approves RecordScan AI output submitted by Patwari before it goes to Tehsildar
- Field verification flag — marks a parcel as "field-verified"
- Sees all records submitted by Patwaris in their circle
- Escalates disputes upward to Tehsildar
- Can run a "circle audit" — view all parcels in circle, flag anomalies

**Dashboard:** Patwari submission queue, field verification checklist, circle map view

**Key difference from Tehsildar:** Circle Inspector cannot finalize mutations — can only verify and forward. Final approval is always Tehsildar.

---

#### 3. Patwari / Lekhpal (`patwari`)
**Real job:** The most important ground-level officer. Maintains Khatauni (the actual land register). Does Girdawari (crop inspection twice a year). Measures land, records possession, issues certified copies of Khatauni. The person farmers interact with most.

**In BhumiChain:**
- **Core creator of DLPI records** — runs RecordScan AI on paper Khataunis
- Initiates mutation after any property transaction (death, sale, inheritance)
- Sends 60-second alert to owner when mutation is initiated
- Responds to owner disputes about their record
- Can only see/edit records in their assigned village set (hard enforced in JWT)
- The person who physically does the "Paper → Blockchain" conversion

**Dashboard:** RecordScan upload tool, their village parcels only, pending mutations they initiated, owner dispute inbox, mutation alert status

**Why this is the hero role in the demo:** Every blockchain record originates from the Patwari. They're the bridge between paper India and blockchain India.

---

#### 4. Kotwal (`kotwal`)
**Real job:** Village watchman and notice server. When a mutation is initiated, law requires adjacent landowners to be notified. Kotwal physically goes to their houses and serves the notice. Also maintains the village crime/activity log.

**In BhumiChain:** Minimal digital role. Their job in the physical world (serving notices) is automated by SMS/WhatsApp in the digital system. However, for legal compliance, the system still needs a "physical notice served" acknowledgment.

**In BhumiChain — one action only:**
- Marks "Physical notice served" for a mutation (confirms they went to adjacent owners)
- This acknowledgment is stored on-chain as part of the mutation audit trail

**Why include Kotwal at all:** It shows the judges that BhumiChain doesn't replace the legal notice process — it digitizes the confirmation. It's a small role but demonstrates legal completeness.

**Dashboard:** Simple list of pending mutation notices in their village → one button: "Confirm notice served to [owner name]"

**Honest answer:** For a demo you can skip Kotwal's login and just show the SMS notification going out automatically. The judges won't miss it. Only include if you want to show legal completeness of the mutation process.

---

#### 5. Citizen (`citizen`)
**Real job:** Property owner, heir, buyer — anyone with a stake in a parcel.

**In BhumiChain:**
- Logs in with Aadhaar OTP (no passwords)
- Sees their parcels on the map
- Claims/verifies a parcel seeded from DILRMP
- Gives eSign consent for transfers and succession
- Receives mutation alerts with 30-day objection window
- Asks BhumiGPT questions in Hindi
- Downloads Encumbrance Certificate

**Dashboard:** Map centered on own parcel(s), "Verify Record" CTA, BhumiGPT chat, notification panel

---

### 4.5 Why Bank Login Is NOT Needed for the Demo

**Short answer: Bank login is a production feature, not a demo feature.**

Bank login exists in the system for:
1. Registering a mortgage lien on a parcel (bank lending against land)
2. SARFAESI NPA auction initiation (when borrower defaults)
3. Querying Encumbrance Certificate before loan sanction

**None of these need to be in the 8-minute demo.** The demo needs to show the core land record digitization story — that's Patwari creates DLPI, citizen verifies, property transfers, succession works, fraud is rejected. Banks are a downstream user.

**What to say when judges ask about bank integration:** "Bank integration is built into the system — banks can query Encumbrance Certificates via API, and mortgage liens are recorded on-chain. In the demo we're showing the core land registry flow. Bank integration demo is available on request."

**Remove bank login from the demo flow entirely.** Keep the code (bank role exists in auth.js), just don't demo it.

### 4.6 Simplified Permissions Matrix (5 Demo Roles)

| Action | citizen | patwari | circle_inspector | tehsildar | notes |
|---|---|---|---|---|---|
| View any DLPI | ✅ | ✅ | ✅ | ✅ | Public data |
| Create DLPI from scan | ❌ | ✅ | ❌ | ✅ | Patwari is the creator |
| Approve RecordScan output | ❌ | submits | reviews | final approve | 3-step pipeline |
| Claim DLPI (own parcel) | ✅ | ❌ | ❌ | ❌ | Only owner can claim |
| Dispute seeded data | ✅ | ❌ | ❌ | ❌ | Only owner can dispute |
| Initiate mutation | ❌ | ✅ | ✅ | ✅ | After any land event |
| Approve mutation | ❌ | ❌ | verify | ✅ final | CI verifies, Tehsildar approves |
| Initiate property transfer | ✅ (as party) | ❌ | ❌ | ❌ | Buyer + seller together |
| Endorse transfer (SRO) | ❌ | ❌ | ❌ | ✅ | Tehsildar acts as SRO in demo |
| Initiate succession | ✅ (heir) | ✅ | ✅ | ✅ | Death cert triggers it |
| Give heir consent | ✅ (self only) | ❌ | ❌ | ❌ | Each heir signs independently |
| Resolve succession dispute | ❌ | ❌ | ❌ | ✅ | |
| Confirm notice served | ❌ | ❌ | ❌ | ❌ | Kotwal only (or auto-SMS) |
| View analytics | ❌ | own villages | own circle | full tehsil | Scoped by jurisdiction |

### 4.7 JWT Structure for Each Demo Role

```json
// Tehsildar
{ "role": "tehsildar", "name": "Amit Saxena", "aadhaarHash": "sha256:...",
  "jurisdictionCode": "GBN-DAD", "tehsilCode": "DAD", "exp": "8h" }

// Circle Inspector  
{ "role": "circle_inspector", "name": "Rajesh Verma", "aadhaarHash": "sha256:...",
  "jurisdictionCode": "GBN-DAD", "circleCode": "DAD-C1",
  "patwariCodes": ["DAD-P1", "DAD-P2", "DAD-P3"], "exp": "8h" }

// Patwari
{ "role": "patwari", "name": "Vijay Singh", "aadhaarHash": "sha256:...",
  "jurisdictionCode": "GBN-DAD", "patwariCode": "DAD-P1",
  "villageCodes": ["DAD-001", "DAD-002", "DAD-003"], "exp": "8h" }

// Citizen
{ "role": "citizen", "name": "Priya Kumar", "aadhaarHash": "sha256:...", "exp": "8h" }
```

### 4.8 Auth.js Changes Needed

```javascript
// Replace current flat ROLES with:
const ROLES = {
  CITIZEN: 'citizen',
  PATWARI: 'patwari',           // was: revenue_officer (renamed)
  CIRCLE_INSPECTOR: 'circle_inspector',  // was: circle_officer (renamed)
  TEHSILDAR: 'tehsildar',       // was: collector (repurposed)
  KOTWAL: 'kotwal',             // new — minimal role
  // Keep these for production but hide from demo:
  SRO: 'sro',
  COLLECTOR: 'collector',
  BANK: 'bank',
  NALSA: 'nalsa',
  ORACLE: 'oracle',
  SUPER_ADMIN: 'super_admin',
};

// Convenience groups
const CAN_CREATE_DLPI = ['patwari', 'tehsildar', 'collector', 'super_admin'];
const CAN_APPROVE_MUTATION = ['circle_inspector', 'tehsildar', 'collector', 'super_admin'];
const OFFICER_ROLES = ['patwari', 'circle_inspector', 'tehsildar', 'kotwal', 'sro', 'collector', 'super_admin'];
```

---

## 4B. Demo Preparation Guide

### What the Demo Needs to Show (6 Minutes, 5 Scenes)

**The Story:** "Ramesh Kumar, a farmer in Dadri village, Noida — dies. His land needs to go to his three children. But first, let's show how his land got onto the blockchain in the first place."

---

#### Scene 1 — Paper to Blockchain (90 seconds)
*Login: Patwari (Vijay Singh)*

1. Patwari opens BhumiChain → RecordScan tab
2. Uploads dummy Khatauni paper (you prepared this)
3. AI pipeline animates: OCR → Field extraction → Confidence check
4. Extracted fields appear: Khasra 142, Dadri, 0.5 hectare, Ramesh Kumar, Jirayat
5. Patwari reviews, corrects one field (show human-in-loop), clicks "Submit to Circle Inspector"
6. Switch to Circle Inspector tab → approves
7. Switch to Tehsildar tab → final approve → DLPI minted
8. **Show DLPI ID on screen: `DLPI-UP-DAD-00142`**
9. Map zooms to the parcel — it's now on the blockchain

*What this proves:* Paper India → Digital India pipeline works. Patwari is the first-mile officer.

---

#### Scene 2 — Owner Claims Their Record (30 seconds)
*Login: Citizen (Ramesh Kumar — before death scenario)*

1. Ramesh gets SMS: "Your land record is on BhumiChain. Verify it."
2. Logs in with Aadhaar OTP → sees his parcel
3. Reviews data → "Verify Record" → Aadhaar eSign animation
4. Status changes: `SEEDED_UNVERIFIED` → `OWNER_VERIFIED` (green)

*What this proves:* Owner is in control. Government seeds, owner confirms.

---

#### Scene 3 — Succession / Uttaradhikar (90 seconds)
*Login: Multiple roles*

1. Patwari submits: Death certificate (CRS mock) for Ramesh Kumar → `InitiateSuccession`
2. CoparcenaryMapper AI runs → family tree appears: 3 heirs (Priya ★ daughter, Arun son, Sunita daughter)
   - HSA 2005 star shown on daughters — "daughters have equal right by law"
3. SMS goes to all 3 heirs → "Your inheritance case is open"
4. Switch to heir tabs → each clicks "I Consent" with Aadhaar eSign
5. All 3 consented → mutation auto-triggers → Patwari gets 60-second SLA alert
6. Patwari confirms → DLPI updated: 3 new owners with 1/3 share each
7. **Show audit trail: Ramesh → [3 heirs] — permanently immutable**

*What this proves:* Succession happens automatically, daughters can't be excluded, full audit trail.

---

#### Scene 4 — Property Transfer + Dual Sale Fraud (90 seconds)
*Login: Citizen (Arun Kumar as seller) + second browser tab*

1. Arun initiates sale of his 1/3 share to Suresh Sharma (buyer)
2. National parcel lock placed (24-hour lock — shows on national channel)
3. FraudSense score: 0.12 → passes
4. Stamp duty calculated: UP rate applied
5. Arun + Suresh both eSign → Tehsildar endorses → title transferred
6. **Now open second browser tab (second buyer)**
7. Deepak Yadav tries to buy the SAME share from Arun → 
8. `TRANSFER_LOCKED` → FraudSense: 0.94 → **REJECTED** — fraud alert on screen
9. Show fraud signals: `NATIONAL_LOCK_ACTIVE`, `DUPLICATE_BUYER_PATTERN`

*What this proves:* Dual-sale fraud is technically impossible. No registry can be tricked.

---

#### Scene 5 — BhumiGPT in Hindi (30 seconds)
*Login: Citizen (Priya Kumar)*

1. Priya types in Hindi: "**क्या मुझे पिताजी की जमीन में बराबर हिस्सा मिलेगा?**" (Will I get equal share in father's land?)
2. BhumiGPT responds in Hindi: "हाँ, हिन्दू उत्तराधिकार अधिनियम 2005 की धारा 6(3) के अनुसार बेटियों को बेटों के बराबर अधिकार है..."
3. Shows sources: HSA 2005 S.6(3), Vineeta Sharma v. Rakesh Sharma (2020)

*What this proves:* Legal literacy for rural citizens in their own language.

---

### What You Need to Prepare Before Demo Day

#### 1. Dummy Property Documents (Physical Props)
Print these on paper for the RecordScan scene:

```
Document 1: Khatauni — Khasra 142, Dadri, Ramesh Kumar, 0.5 Ha, Jirayat land
Document 2: Khatauni — Khasra 143, Dadri, Suresh Sharma (neighbor — for transfer)
Document 3: Death Certificate — Ramesh Kumar, died [date], CRS format
```

Make them look real-ish — black and white printed, slightly crumpled. The "degraded" document effect helps sell the RecordScan AI story.

#### 2. Synthetic Data (Noida)
Replace Nashik synthetic data with Noida/UP equivalents:
- `data/synthetic-parcels/noida_parcels.geojson` — 500 parcels, Dadri village area
- `data/family-trees/noida_families.json` — 20 families, Noida names (Kumar, Sharma, Yadav)
- Khasra numbers: 100–600 range (realistic for Dadri)
- Land types: `Jirayat` (unirrigated), `Abaadi` (residential), `Industrial`

#### 3. Demo Identities (update aadhaar.py)
```python
MOCK_IDENTITIES = {
    "sha256:ramesh001": {"name": "Ramesh Kumar", "dob": "1955-03-14", "isScheduledTribe": False},
    "sha256:priya001":  {"name": "Priya Kumar",  "dob": "1982-07-22", "isScheduledTribe": False},
    "sha256:arun001":   {"name": "Arun Kumar",   "dob": "1984-11-05", "isScheduledTribe": False},
    "sha256:sunita001": {"name": "Sunita Kumar", "dob": "1987-04-18", "isScheduledTribe": False},
    "sha256:suresh001": {"name": "Suresh Sharma","dob": "1975-09-30", "isScheduledTribe": False},
    "sha256:vijay001":  {"name": "Vijay Singh",  "dob": "1980-06-12", "isScheduledTribe": False,
                         "officerRole": "patwari", "villageCodes": ["DAD-001","DAD-002"]},
    "sha256:rajesh001": {"name": "Rajesh Verma", "dob": "1978-02-28", "isScheduledTribe": False,
                         "officerRole": "circle_inspector"},
    "sha256:amit001":   {"name": "Amit Saxena",  "dob": "1972-08-15", "isScheduledTribe": False,
                         "officerRole": "tehsildar"},
}
```

#### 4. Browser Setup for Demo Day
Have 4 browser windows open before you start:

| Window | Who | URL |
|---|---|---|
| Tab 1 | Patwari (Vijay Singh) | /officer-dashboard — RecordScan ready |
| Tab 2 | Tehsildar (Amit Saxena) | /officer-dashboard — Approval queue |
| Tab 3 | Citizen (Priya Kumar) | /my-parcels |
| Tab 4 | Citizen (Arun Kumar — fraud attempt) | /transfer — second buyer tab |

Pre-login all tabs. Don't login live during the demo — token expiry or OTP failure kills momentum.

#### 5. One-Command Start
```bash
# Single command to start everything
docker compose up --wait
# Then open browser at localhost:3000
# Everything pre-seeded with Noida demo data
```

#### 6. Offline Readiness
- Map tiles cached offline (Leaflet tile cache)
- All API calls mocked (ORACLE_MODE=mock, FABRIC_MODE=mock)
- No internet dependency during demo
- Video recording of the demo as backup

### Common Demo Failure Points + Fixes

| Failure | Fix |
|---|---|
| OTP doesn't come | Pre-login all tabs. OTP is mocked — just hardcode "123456" in dev |
| Map doesn't load | Cache OpenStreetMap tiles for Noida bounding box |
| Blockchain slow | FABRIC_MODE=mock — instant responses, no actual Fabric needed |
| Wrong role shown | Pre-check tabs before presenting |
| Timer runs over | Cut Scene 5 (BhumiGPT) if running long — it's nice-to-have |
| Judges ask "is this real data?" | "These are synthetic records generated to match actual Khatauni format. Real data would require DILRMP API access which is restricted to authorized government systems." |

### Q&A Preparation

| Likely Judge Question | Answer |
|---|---|
| "Why Hyperledger Fabric and not a public chain?" | Permissioned network — only govt orgs are nodes. No crypto, no tokens, no speculative risk. Aligns with DoLR policy. |
| "What happens if a Patwari enters wrong data?" | Human-in-loop review at Circle Inspector and Tehsildar level. Every entry has officer's Aadhaar hash permanently on chain — accountability. Owner disputes wrong data in 30-day window. |
| "How do you handle legacy paper records?" | RecordScan AI — that's Scene 1. 95% of India's RoR is digitized via DILRMP, but not structured. We process the remaining 5% via AI OCR. |
| "What about internet connectivity in rural areas?" | Patwari can scan offline at CSC (Common Service Centre). Sync happens when connectivity is available. Blockchain records are final only after sync — offline draft state until confirmed. |
| "AP blockchain pilot failed — why will this succeed?" | AP failed because it had no legal framework and no Aadhaar authentication. BhumiChain builds on DILRMP (already law), uses Aadhaar (already law), integrates with existing tehsil workflows rather than replacing them. |
}
```

### 4.8 Auth.js Changes Needed

Current roles in `auth.js` are too flat. Expand to:

```javascript
const ROLES = {
  CITIZEN: 'citizen',
  TALATHI: 'talathi',
  REVENUE_INSPECTOR: 'revenue_inspector',
  NAIB_TEHSILDAR: 'naib_tehsildar',
  TEHSILDAR: 'tehsildar',
  SDO: 'sdo',
  DILR: 'dilr',
  SRO: 'sro',
  COLLECTOR: 'collector',
  STATE_ADMIN: 'state_admin',
  SUPER_ADMIN: 'super_admin',
  BANK: 'bank',
  NALSA: 'nalsa',
  GRAM_SABHA: 'gram_sabha',
  FOREST_OFFICER: 'forest_officer',
  ORACLE: 'oracle',
};

// Convenience groups for requireRole() calls
const OFFICER_ROLES = ['talathi','revenue_inspector','naib_tehsildar','tehsildar','sdo','dilr','sro','collector','state_admin','super_admin'];
const CAN_CREATE_DLPI = ['talathi','tehsildar','dilr','collector','super_admin'];
const CAN_APPROVE_MUTATION = ['revenue_inspector','tehsildar','sdo','dilr','collector','super_admin'];
```

---

## 5. Module Development Plan

### Priority Order for Phase 2 POC

| # | Module | Priority | Status | Depends On |
|---|---|---|---|---|
| 1 | Login (Aadhaar OTP flow) | P0 | ❌ TODO | Oracle service |
| 2 | Data Seed + Claim flow | P0 | ❌ TODO | Login |
| 3 | BhumiToken / DLPI chaincode | P0 | ✅ Chaincode done | Fabric network |
| 4 | PropertyTransfer | P0 | ✅ Done | DLPI |
| 5 | Uttaradhikar Engine (3 trigger modes) | P0 | ✅ Chaincode done | DLPI, CRS oracle |
| 6 | Mutation Manager + alert | P0 | ✅ Chaincode done | DLPI, WebSocket |
| 7 | TribalGuard | P0 | ✅ Done | DLPI |
| 8 | NyayaAI (API wrapper — legal buddy) | P1 | ❌ TODO | Claude API, JWT |
| 9 | BhumiAuction | P1 | ❌ TODO (chaincode spec done) | CoparcenaryPool, BhumiSettle |
| 10 | CoparcenaryPool | P1 | ✅ Chaincode done | DLPI |
| 11 | BhumiSettle + AI service | P1 | ✅ Chaincode + AI done | CoparcenaryPool, CircleRate |
| 12 | Notification Module (inside api-gateway) | P1 | ❌ TODO | All modules |
| 13 | BhumiGPT — merged into NyayaAI (module 8) | — | ✅ Merged | — |
| 14 | BhumiAnalytics Dashboard + live event feed | P1 | ✅ Done (needs live feed) | WebSocket |
| 15 | Encumbrance Certificate + QR Code | P1 | ❌ TODO | DLPI, pdfkit, qrcode |
| 16 | CoparcenaryMapper AI (laws.py) | P1 | ✅ Done | Uttaradhikar |

### Module 1: Login (Currently Missing)

**What needs building:**
- `frontend/web-portal/src/app/login/page.tsx` — Aadhaar input + OTP entry
- `frontend/web-portal/src/app/officer-login/page.tsx` — Officer login (Aadhaar + dept email)
- `backend/api-gateway/src/routes/auth.js` — POST /api/auth/aadhaar-otp, POST /api/auth/verify-otp
- Logic to redirect based on role after login (citizen → map, officer → dashboard)

**API endpoints:**
```
POST /api/auth/request-otp    { aadhaarNumber: "XXXX" }
POST /api/auth/verify-otp     { aadhaarNumber, otp } → { token, user }
POST /api/auth/officer-login  { aadhaarNumber, deptEmail, otp } → { token, user }
POST /api/auth/demo-token     { role, name } → { token } (mock only)
GET  /api/auth/me             → { user } (from JWT)
```

### Module 2: Data Seed + Claim Flow

**What needs building:**
- `scripts/seed-district.js` — bulk DILRMP import script
- Add `claimStatus` field to DLPI chaincode (`SEEDED_UNVERIFIED | OWNER_VERIFIED | DATA_DISPUTED`)
- `ClaimDLPI(dlpiId, ownerAadhaarHash, eSignTxHash)` chaincode function
- `DisputeDLPI(dlpiId, ownerAadhaarHash, disputeReason)` chaincode function
- `frontend/.../app/claim/page.tsx` — owner claim screen

**API endpoints:**
```
POST /api/dlpi/bulk-seed          { csvData } (COLLECTOR role)
POST /api/dlpi/:dlpiId/claim      { eSignTxHash } (citizen)
POST /api/dlpi/:dlpiId/dispute    { reason, evidence } (citizen)
GET  /api/dlpi/my-parcels         (citizen — returns all parcels by aadhaarHash)
```

### Module 3–7: Already Have Chaincode — Need Fabric Network + Wiring

See section 7 (Blockchain Network Setup) for what needs to happen to make the existing chaincode actually run.

### Module 8: NyayaAI — Legal Buddy (POC = API Wrapper)

**Design:** Claude API wrapper with domain-specialized system prompt. No custom ML model, no eCourts DB. See Section 3J for full spec.

**Three modes:** Legal Q&A (Hindi + English) | Case Summary for officers | Document Drafting

**Token limits:** Citizen 10/day | Officer 25/day | Tehsildar+ unlimited

**To build:**
- `backend/ai-services/nyaya-ai/main.py` — FastAPI on port 8012
- Two Claude model tiers: claude-haiku-4-5 for Q&A (fast), claude-sonnet-4-6 for drafts (quality)
- System prompt: pre-loads HSA, TPA, Registration Act, UP Revenue Code, Muslim Personal Law, ISA 1925, FRA 2006, FEMA, key SC judgments (Vineeta Sharma 2020, Suraj Lamp 2012)
- Context injection: gateway fetches DLPI/mutation/case from blockchain before each query
- Token tracking: in-memory dict `{aadhaarHash_date: count}` (Redis in production)

### Module 9: BhumiAuction

**Triggers:** CoparcenaryPool dissolution vote | BhumiSettle escalation failure (DM order) | Court decree execution

**Auction types:** OPEN_BID | SEALED_BID | RESERVE_ONLY. See Section 3I for full spec.

**To build:**
- `blockchain/chaincode/bhumi-auction/bhumi_auction.go` — NEW chaincode
- Key functions: CreateAuction, RegisterBidder, RecordEMDPayment, PlaceBid, DeclareWinner, FileChallenge, ResolveChallenge, RecordBalancePayment, ExecuteAuction, RecordProceedsDistribution

**Anti-corruption:** Reserve price floor = circle rate × area (chaincode enforced). All bids immutable. 21-day mandatory notice. 30-day challenge period.

---

### Module 10: CoparcenaryPool

**Solves:** 64×64 generational fragmentation. People own pool shares, not individual property slices. See Section 3D for full chaincode spec.

**To build:**
- `blockchain/chaincode/coparcenary-pool/coparcenary_pool.go` — already written
- Key functions: CreatePool, AddMember, TransferPoolShare, VoteForDissolution, ReleaseAsset, FlagMissingHeir, ResolveMissingHeirFlag, RecordAuctionResult

**Triggered by:** Uttaradhikar Engine (auto-creates pool for multi-heir succession) | Tehsildar (manual pool creation for existing joint families)

---

### Module 11: BhumiSettle

**Solves:** Equitable partition — circle-rate-based property shuffle so each person gets sole ownership of specific plots. Subgroup settlement. Officer fraud detection. See Section 3F and 3G for full spec.

**To build:**
- `blockchain/chaincode/bhumi-settle/bhumi_settle.go` — already written
- `backend/ai-services/bhumi-settle/settle.py` — already written (greedy assign + fraud patterns)
- Key chaincode functions: SetCircleRate, InitiateSettlement, RecordAIRecommendation, ConsentToSettlement, ObjectToSettlement, RecordEqualizationPayment, ExecuteSettlement, EscalateSettlement, RecordOfficerFraudAlert

---

### Module 12: Notification Service

**Channels:** SMS (mock) | Email (Mailhog for dev) | Telegram (real Bot API). See Section 3K for full spec.

**To build:**
- `backend/notification-service/index.js` — Node.js service on port 8015
- `backend/notification-service/channels/sms.js` — mock + MSG91
- `backend/notification-service/channels/email.js` — Nodemailer + SendGrid
- `backend/notification-service/channels/telegram.js` — real Telegram Bot API
- `backend/notification-service/templates.js` — Hindi + English templates for all 10 event types
- Create `@BhumiChainBot` on Telegram before demo day (5 minutes via @BotFather)

---

## 5A. RecordScan AI — How to Build It

### What It Does

Takes a scanned **UP Khatauni** (Khasra-Khatauni register) image uploaded by a Patwari → extracts all structured fields → Patwari reviews + corrects → approves → CreateDLPI on blockchain.

**Document format: UP Khatauni (not Maharashtra Satbara/7/12).** UP uses Khatauni (Plot register) and Khasra (field register) — different layout and field names from Maharashtra. The Claude Vision prompt must target UP Khatauni format specifically.

The existing code uses Azure Document Intelligence + LayoutLM NER. **For POC, replace with Claude Vision API — faster, handles Hindi Devanagari, no ML deployment needed.**

### Option Comparison

| Approach | Pros | Cons | Verdict |
|---|---|---|---|
| **Claude API vision** (claude-haiku-4-5) | Handles Devanagari natively, no model deployment, structured JSON output, fast | Data leaves India; costs per image | ✅ **Use for POC** |
| Azure Document Intelligence (custom) | Good accuracy after training, Azure India region available | Needs 500+ labeled Satbara images to train custom model, slow to set up | ✅ Use for production |
| Tesseract OCR + custom NER | Free, fully on-premise | Poor Devanagari accuracy, complex pipeline | ❌ Too complex for POC |
| Google Document AI | Good Indic language support | Same data sovereignty issue as Claude | Consider for fallback |

### Privacy Analysis for RecordScan

**Satbara (7/12) is a PUBLIC document in India.** Anyone can download it from MahaBhulekh. There is no Aadhaar number on a 7/12 extract. The fields are: survey number, village, area, land type, owner names, cultivation details.

**The privacy risk is LOW for the document itself.** The only sensitive combination is: owner name + land holding + Aadhaar (which is NOT on the 7/12).

**Privacy architecture:**
```
Talathi uploads Satbara image
    ↓
System sends image to Claude API (only the image — no Aadhaar, no other PII)
    ↓
Claude extracts: survey number, area, land type, owner names from document
    ↓ (owner names ARE in the document — public record)
Talathi reviews extracted fields → corrects errors
    ↓
Talathi separately enters owner Aadhaar → system hashes it (never stored raw)
    ↓
DLPI created: extracted data + sha256(Aadhaar + salt) — Aadhaar never touches Claude
```

**For DPDPA 2023 compliance in production:**
- Use Azure AI in Central India region (data stays in India)
- Add data processing agreement with provider
- Never send Aadhaar to any external API

### Implementation Plan (Claude Vision approach)

**Replace** `_azure_ocr` + `_layoutlm_ner` in [pipeline.py](backend/ai-services/record-scan/pipeline.py) with a single Claude vision call:

```python
async def _claude_vision_extract(content: bytes, filename: str) -> SatbaraExtraction:
    import anthropic, base64
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    
    img_b64 = base64.standard_b64encode(content).decode("utf-8")
    media_type = "image/jpeg" if filename.lower().endswith(".jpg") else "image/png"
    
    prompt = """Extract the following fields from this Uttar Pradesh Khatauni (land register) document.
This is a UP Revenue record (Khasra-Khatauni format), written in Hindi (Devanagari script).
Return ONLY a JSON object with these exact keys:
{
  "districtName": "",          // जिला (Zila)
  "tehsilName": "",            // तहसील (Tehsil)
  "villageName": "",           // ग्राम (Gram)
  "khasraNumber": "",          // खसरा संख्या
  "khataNumber": "",           // खाता संख्या (Khatauni account number)
  "totalAreaHectares": 0.0,   // क्षेत्रफल (in hectares — convert from bigha/biswa if needed)
  "areaInBigha": null,        // बीघा (if shown — 1 bigha UP = 0.2529 hectare)
  "landType": "Agricultural|Residential|Commercial|Govt|Forest|Abadi",  // भूमि प्रकार
  "landClassification": "",   // सिंचित/असिंचित/बंजर (irrigated/unirrigated/barren)
  "owners": [
    {
      "name": "",             // काश्तकार/स्वामी नाम
      "fatherHusbandName": null,
      "share": null,          // हिस्सा (fraction if shown e.g. "1/2")
      "ownershipType": "Individual|Joint|Government"
    }
  ],
  "hasJointOwnership": false,
  "currentCultivator": null,  // वास्तविक काश्तकार (actual cultivator if different from owner)
  "cultivatorType": "Self|Tenant|Lessee|Sharecropper",
  "encumbrances": [],         // बंधक/ऋण (mortgage/loan entries if shown)
  "mutationNumber": null,     // खतौनी संख्या
  "fasalYear": null,          // फसल वर्ष (harvest year)
  "ulpin": null,              // ULPIN 14-digit code if printed on document
  "flaggedFields": [],        // fields you are uncertain about
  "requiresManualReview": false,
  "confidence_note": "any fields you are uncertain about"
}
The document is in Hindi. Field labels may be in Devanagari. Extract all text accurately.
Common UP Khatauni abbreviations: स्व. = swargiya (late), पु. = putra (son of), 
पत्नी = wife, बिघा = bigha (area unit)."""
    
    msg = client.messages.create(
        model="claude-haiku-4-5-20251001",  # fastest + cheapest
        max_tokens=1024,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": img_b64}},
                {"type": "text", "text": prompt}
            ]
        }]
    )
    
    import json
    raw = msg.content[0].text.strip()
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    
    data = json.loads(raw.strip())
    # Derive confidence from model output
    flagged = data.get("flaggedFields", [])
    confidence = 0.95 if not flagged else max(0.5, 0.95 - len(flagged) * 0.08)
    
    return SatbaraExtraction(
        **{k: v for k, v in data.items() if k != "confidence_note"},
        ocrConfidence=confidence,
        nerConfidence=confidence,
        overallConfidence=confidence,
        requiresManualReview=len(flagged) > 2
    )
```

**Update the pipeline toggle:**
```python
# pipeline.py — updated scan_document()
if mock:
    ...  # existing mock path
elif os.getenv("RECORD_SCAN_MODE") == "claude":
    ipfs_cid = await _ipfs_pin_real(content) if os.getenv("IPFS_GATEWAY") else _mock_ipfs_pin(content)
    extraction = await _claude_vision_extract(content, filename)
    return _build_result(filename, len(content), ipfs_cid, extraction, elapsed_ms)
else:
    # Azure + LayoutLM path (production)
    ...
```

**Environment variable:**
```
RECORD_SCAN_MODE=claude    # uses Claude API vision
RECORD_SCAN_MODE=azure     # uses Azure Document Intelligence + LayoutLM
RECORD_SCAN_MODE=mock      # pre-scripted responses (default for demo)
```

### What Happens with Low-Quality / Degraded Images

Claude handles degraded images better than Tesseract but worse than Azure custom model. Strategy:

1. If `overallConfidence < 0.70` → `requiresManualReview = true` → Talathi must fill all flagged fields manually
2. If `overallConfidence < 0.50` → reject scan → Talathi must re-scan or type manually
3. Always: Talathi reviews every field before approving → human-in-the-loop is the safety net

### Cost Estimate

claude-haiku-4-5: ~$0.00025 per image (1 image input + 1K token output)
For 5,000 Nashik parcels: ~$1.25 total — negligible for a POC.

### Files to Modify

| File | Change |
|---|---|
| [pipeline.py](backend/ai-services/record-scan/pipeline.py) | Add `_claude_vision_extract()`, update `scan_document()` mode toggle |
| [main.py](backend/ai-services/record-scan/main.py) | Add `RECORD_SCAN_MODE` to health response |
| [.env.example](backend/ai-services/record-scan/.env.example) | Add `RECORD_SCAN_MODE`, `ANTHROPIC_API_KEY` |
| [requirements.txt](backend/ai-services/record-scan/requirements.txt) | Add `anthropic>=0.40.0` |

---

## 6. API Design

### Base URL
- Local: `http://localhost:3001`
- Production: `https://api.bhumichain.nic.in` (via Render/NIC NBTS)

### Routes Overview

```
/api/auth/
  POST /request-otp
  POST /verify-otp
  POST /officer-login
  GET  /me

/api/dlpi/
  GET  /my-parcels                  (citizen — own parcels)
  GET  /:dlpiId                     (public)
  GET  /:dlpiId/history             (public — audit trail)
  GET  /:dlpiId/encumbrance-cert    (public — 30-sec EC)
  POST /                            (revenue_officer — create)
  POST /bulk-seed                   (collector — bulk import)
  POST /:dlpiId/claim               (citizen — claim seeded parcel)
  POST /:dlpiId/dispute             (citizen — dispute data)
  POST /:dlpiId/janganana-flag      (oracle — census anomaly)

/api/transfer/
  POST /initiate                    (citizen as seller + buyer)
  POST /:transferId/consent         (any party)
  POST /:transferId/stamp-duty-paid (oracle — UPI confirmation)
  POST /:transferId/execute         (sro)
  POST /:transferId/reject          (any party)
  GET  /:transferId                 (parties)

/api/succession/
  POST /initiate                    (citizen or officer — death cert)
  POST /:caseId/heir-consent        (citizen as heir)
  POST /:caseId/dispute             (heir)
  GET  /:caseId                     (parties)

/api/mutation/
  GET  /pending                     (officer)
  POST /:mutationId/approve         (officer)
  GET  /alerts                      (citizen — own parcel alerts)

/api/tribal/
  POST /transfer-attempt            (any — will be hard rejected for non-tribal)
  GET  /gram-sabha/:villageCode/pending  (gram_sabha)
  POST /gram-sabha/:villageCode/consent  (gram_sabha)

/api/auction/
  POST /initiate                    (heirs or bank)
  GET  /:auctionId                  (public)
  POST /:auctionId/bid              (citizen — registered bidder)
  POST /:auctionId/settle           (oracle — after bid close)

/api/nyaya-ai/
  POST /predict                     (citizen or nalsa)
  GET  /lok-adalat-anchor/:caseId   (nalsa)

/api/analytics/
  GET  /kpis                        (officer)
  GET  /fraud-heatmap               (officer)
  GET  /benami-alerts               (collector)

/api/bhumi-gpt/
  POST /query                       (citizen)
  GET  /history                     (citizen)

/ws (WebSocket)
  MutationAlert    → citizen
  TransferUpdate   → parties
  SuccessionUpdate → heirs
  AuctionBid       → all watchers
  FraudAlert       → officers
```

---

## 7. Blockchain Network Setup

### What Needs to Happen (Currently Not Done)

The chaincodes exist as Go files but there is **no running Fabric network**. Everything currently runs in mock mode.

#### Step 1: Fabric Test Network (Local)

Use `fabric-samples/test-network` as base:
```bash
# Location: infra/fabric-network/
# 1 org: Maharashtra Revenue Department
# 2 peers: peer0.mh-revenue.bhumichain.in, peer1.mh-revenue.bhumichain.in
# 1 orderer: orderer.bhumichain.in (Raft)
# 2 channels: mh-state-channel, national-channel
```

#### Step 2: Deploy Chaincodes in Order
```
1. dlpi              (foundation — everything else calls into this)
2. encumbrance       (depends on dlpi)
3. coparcenary-pool  (NEW — depends on dlpi; manages multi-generation fragmentation)
4. mutation-manager  (depends on dlpi; calls coparcenary-pool for joint property mutations)
5. property-transfer (depends on dlpi — cross-chaincode calls)
6. uttaradhikar      (depends on dlpi; auto-creates CPE for multi-heir succession)
7. tribal-guard      (depends on dlpi)
8. bhumi-auction     (NEW — depends on uttaradhikar + coparcenary-pool + dlpi)
```

#### Step 3: Switch API Gateway from Mock to Real
```
# backend/api-gateway/.env
FABRIC_MODE=real         # currently "mock"
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CHANNEL=mh-state-channel
FABRIC_CHAINCODE_DLPI=dlpi
CRYPTO_PATH=../../infra/fabric-network/crypto-material
```

#### Step 4: Verify Cross-Chaincode Calls Work
The PropertyTransfer chaincode calls `InvokeChaincode("dlpi", ...)` for parcel locking.
This only works if both chaincodes are on the same channel. Test this explicitly.

### Infra Files Needed
```
infra/
  fabric-network/
    docker-compose.yml         (peers + orderer + CA)
    configtx.yaml              (channel config)
    crypto-config.yaml         (org + identity setup)
    scripts/
      start-network.sh
      deploy-chaincode.sh      (deploys all chaincodes in order)
      stop-network.sh
  docker-compose.full.yml      (full stack: Fabric + API GW + Oracle + AI + Frontend)
```

---

## 8. Frontend Pages & Flows

### Pages Needed

| Page | Route | Status | Who Sees It |
|---|---|---|---|
| Login | `/login` | ❌ TODO | All |
| Officer Login | `/officer-login` | ❌ TODO | Officers |
| Home / Map | `/` | ✅ Done | All |
| My Parcels | `/my-parcels` | ❌ TODO | Citizen |
| Claim Parcel | `/claim/:dlpiId` | ❌ TODO | Citizen |
| Parcel Detail | `/parcel/:dlpiId` | (in map popup) | All |
| EC Certificate | `/ec/:dlpiId` | ❌ TODO | All |
| Property Transfer | `/transfer` | ✅ Done | Citizen |
| Succession | `/succession` | ✅ Done | Citizen |
| Tribal Guard | `/tribal` | ✅ Done | All |
| BhumiGPT | `/bhumi-gpt` | ✅ Done | Citizen |
| Analytics | `/analytics` | ✅ Done | Officers |
| Auction | `/auction` | ❌ TODO | All |
| NyayaAI | `/nyaya-ai` | ❌ TODO | Citizen + NALSA |
| Officer Dashboard | `/dashboard` | ❌ TODO | Officers |
| Janganana | `/janganana` | ✅ Done | Officers |

### Login Page Design (To Build)

```
┌────────────────────────────────────────────────────────┐
│                     🌍 BhumiChain                       │
│           India's Land Trust Infrastructure             │
│                                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Citizen Login              Officer Login  [tab] │  │
│  │                                                  │  │
│  │  Enter your Aadhaar number                       │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  XXXX - XXXX - [____]  (last 4 only shown) │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  │                                                  │  │
│  │  [Send OTP to registered mobile]                 │  │
│  │                                                  │  │
│  │  Enter OTP: [__ __ __ __ __ __]                 │  │
│  │                                                  │  │
│  │  [Login Securely]                                │  │
│  │                                                  │  │
│  │  🔒 Your Aadhaar is never stored.               │  │
│  │     Only a cryptographic hash is used.           │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  Available in: English | मराठी | हिंदी                  │
└────────────────────────────────────────────────────────┘
```

### My Parcels Page (To Build)

Shows all parcels matching citizen's aadhaarHash:
- Claimed parcels → green badge
- Unclaimed parcels → yellow "Verify Now" CTA
- Disputed parcels → orange badge
- Each parcel card links to map + detail + transaction history

---

## 9. Demo Script (Physical Demo — No Time Limit)

Physical presentation for CDAC judges. Organized in 4 Acts. Each scene has a clear point to make — don't rush, let the tech speak.

**Demo personas always in play:**
- Ramesh Kumar — deceased landowner, Khasra 142, Dadri
- Priya Kumar — daughter/heir (citizen login)
- Arun Kumar — son/heir (citizen login)
- Sunita Kumar — younger daughter/heir
- Suresh Sharma — buyer
- Vijay Singh — Patwari (patwari login)
- Rajesh Verma — Circle Inspector
- Amit Saxena — Tehsildar (tehsildar login)

---

### ACT 1 — The Problem + Digitization

**Scene 0 — Setup: Why This Matters**
> Show a real scanned photo of a smudged paper Khatauni (Khasra register)
> 
> "Yeh hai India ka land record. Isme Ramesh Kumar ki zameen hai — 0.5 hectare, Dadri, Noida. Isko koi bhi badal sakta hai. Ink se kaat do. Naya naam likh do. ₹1 lakh patwari ko do — khatam."
> 
> "BhumiChain iska jawab hai."

**Scene 1 — Login: Aadhaar OTP**
> Vijay Singh (Patwari) logs in → patwari dashboard
> Priya Kumar (citizen) logs in → her parcel view
> 
> Point: "Raw Aadhaar kabhi store nahi hota. Sirf cryptographic hash. DPDPA 2023 compliant."

**Scene 2 — RecordScan: Paper → Blockchain**
> Vijay uploads photo of paper Khatauni
> RecordScan AI extracts fields in Hindi: Khasra 142, 0.5 hectare, Ramesh Kumar
> Vijay reviews, corrects if needed, approves
> CreateDLPI fires → `DLPI-UP-DAD-00142` created on Fabric
>
> Point: "1.5 crore paper records in UP. Ek ek ko is tarah digitize kiya jaayega."

**Scene 3 — Claim: Owner Verifies**
> Priya gets SMS + Telegram: "Aapki zameen digitize hui hai. Verify karein."
> (Demo: real Telegram message arrives on presenter's phone)
> Priya clicks Claim → Aadhaar eSign → parcel is now `OWNER_VERIFIED`
>
> Point: "Blockchain mein ek record bhi bina maalik ki marzi ke nahi aata."

---

### ACT 2 — Inheritance: The Complete Story

**Scene 4 — InheritancePlan: Alive Pre-Registration**
> Ramesh Kumar (logged in) opens "Inheritance Plan" → names Priya (1/3), Arun (1/3), Sunita (1/3)
> Aadhaar eSign → plan stored on-chain
>
> Point: "Ramesh ne apni zameen ke baare mein plan bana diya — jab tak woh jeevit hain, badal sakte hain. Marne ke baad yeh plan instantly activate ho jaata hai."

**Scene 5 — Death + Succession: Uttaradhikar Engine**
> CRS oracle fires: Ramesh Kumar death registered (CRS/UP/GBN/2026/00891)
> Uttaradhikar Engine reads InheritancePlan → identifies 3 heirs
> CoparcenaryMapper AI confirms: HSA 2005 — daughters = sons, 1/3 each
> All 3 heirs get notification simultaneously
> (Show: Telegram message to Priya, SMS to Arun, Email to Sunita)
>
> "DLPI-UP-DAD-00142 mein aaparti ke liye 30 din hain."
>
> Point: "3 log. 3 alag channel. Ek bhi nahi chhuta. Patwari involved nahi — woh sirf confirm karta hai."

**Scene 6 — Patwari Tries to File Manually → REJECTED**
> Vijay Singh (Patwari) opens mutation form → types "Type: Inheritance, New Owner: Arun Kumar only" → Submit
> Chaincode response: `ANTI_CORRUPTION: Inheritance mutations cannot be manually filed by officers. Attempt by sha256:vijay001 on DLPI-UP-DAD-00142 permanently recorded.`
>
> Point: "Yeh technical impossibility hai. Software level par block hai — koi bhi bribe kaam nahi karega."

**Scene 7 — Heirs eSign → Auto-Mutation**
> Priya logs in → "Accept my share" → Aadhaar eSign
> Arun does same → eSign
> Sunita does same → eSign
> AllHeirsConsentedAutoMutation fires → DLPI updated: 3 owners, 1/3 each
> Mutation executed — `INHERITANCE` type, `UTTARADHIKAR_ENGINE` origin
>
> Point: "3 log, 3 sign. Auto hua. Patwari ne ek naam nahi chuna — system ne sab tay kiya."

---

### ACT 3 — Anti-Corruption: Fraud Detection

**Scene 8 — Officer Fraud Alert**
> (Pre-configured: Vijay has 3 past inheritance mutations with only 1 heir each, but DILRMP shows 2+ names each time)
> FraudSense AI fires on the 3rd mutation → score: 0.87 (HIGH)
> Amit Saxena (Tehsildar) dashboard: RED banner
> "⚠️ FRAUD ALERT: Vijay Singh — SINGLE_HEIR_REPEAT pattern. Score: 0.87."
> Amit clicks → sees all 3 mutations with evidence
> Clicks "Suspend Officer" → Vijay's pending mutations frozen
>
> Point: "Paper system mein yeh pattern 3 saal mein pakda nahi jaata. BhumiChain mein milliseconds mein pakad gaya."

---

### ACT 4 — The 64×64 Problem + Resolution

**Scene 9 — CoparcenaryPool: Show the Problem**
> Show a pool: 8 members, 4 properties, 3 generations
> "64 log, 64 zameen — aisa hota hai 6 generation mein. Koi nahi bech sakta. Koi court nahi kar sakta. Zameen freeze ho jaati hai."
> Point: "Yeh India ka sabse bada zameen ka problem hai."

**Scene 10 — BhumiSettle: Equitable Partition**
> Tehsildar initiates settlement → SetCircleRate already set for Dadri
> InitiateSettlement → AI greedy algorithm runs
> AI returns: "Plot A → Priya (value match 97%), Plot B → Arun (94%), Plot C → Sunita (91%)"
> Cash equalization: Priya pays Sunita ₹25,000 via UPI
> All 3 consent → ExecuteSettlement → 3 separate DLPIs, sole ownership each
>
> Point: "64 log ki zameen ko barabar value mein baant diya. Koi 1/64 ka tukda nahi — pura plot, sole owner."

**Scene 11 — BhumiAuction: When Settlement Fails**
> 2 members object to partition → Pool votes to dissolve → DM orders auction
> CreateAuction: Reserve price = circle rate × area = ₹12 lakh (auto-computed, cannot go lower)
> 21-day notice fires → bhulekh.up.gov.in notice + Telegram to all members
> Suresh Sharma registers as bidder → pays EMD ₹1.2 lakh via UPI
> Suresh bids ₹15 lakh → wins
> Balance paid → AuctionExecuted → DLPI transfers to Suresh
> Pool members each get UPI payout (proportional to share)
>
> Point: "6 generation ka dispute — ek auction mein khatam. Proceeds seedha bank mein."

---

### ACT 5 — More Guardrails

**Scene 12 — PropertyTransfer: Clean Sale**
> Arun (now sole owner of Plot B) sells to Suresh → PropertyTransfer initiated
> Both eSign → national lock on DLPI → stamp duty oracle confirms 7% UP rate
> Tehsildar endorses → DLPI transferred
>
> Point: "Clean title. Arun ne becha, Suresh ko mila. Koi chain break nahi."

**Scene 13 — Dual-Sale Fraud Rejected**
> Arun tries to sell same plot to a second buyer simultaneously (second browser tab)
> Second attempt: `NATIONAL_LOCK_ACTIVE: DLPI-UP-DAD-00142 locked for transfer TX-XYZ. Cannot initiate another transfer.`
>
> Point: "National lock — ek hi zameen ko do logon ko bechnaa ab technically impossible hai."

**Scene 14 — TribalGuard Hard Block**
> Non-tribal attempts to buy a tribal-tagged DLPI
> `TRIBAL_PROTECTION: Transfer to non-tribal not permitted. Forest Rights Act 2006 S.4(5). This attempt is permanently recorded.`
>
> Point: "Tribal land ki suraksha chaincode mein hai — rule badalna padega, sirf permission dene se kaam nahi chalega."

---

### ACT 6 — AI Layer

**Scene 15 — NyayaAI: Legal Buddy**
> Priya (citizen) types in Hindi: "Mere bhai ne mujhe hissa nahi diya — kya kar sakti hoon?"
> NyayaAI responds: HSA 2005 S.6(3) + Vineeta Sharma 2020 + concrete next steps
> Draft: "Legal Heir Certificate Application" — pre-filled with her name, DLPI, Tehsildar's name
>
> Then Amit Saxena (Tehsildar) types: "Summarise the inheritance case for DLPI-UP-DAD-00142"
> NyayaAI generates: 1-page case brief — timeline, dispute, legal analysis, recommendation
>
> Point: "Citizen ko vakeel ki zaroorat nahi. Officer ko file padhne ki zaroorat nahi."

**Scene 16 — BhumiGPT: Hindi Q&A**
> Citizen asks: "Meri zameen ka encumbrance certificate kaise nikaaloon?"
> BhumiGPT responds in Hindi with steps
>
> Point: "Koi bhi, kisi bhi bhasha mein puch sakta hai."

**Scene 17 — Analytics Dashboard**
> Amit Saxena opens analytics:
> - KPIs: 500 parcels, 23 mutations this month, 2 fraud alerts
> - Fraud heatmap: village-level visualization
> - Live event feed (WebSocket): mutation events firing in real time
>
> Point: "Tehsildar ke paas pehli baar poori tehsil ka real-time view hai."

---

### Key Talking Points for Judges

| Question judges will ask | Answer |
|---|---|
| "Is this replacing existing systems?" | "No — BhumiChain sits on top of UP Bhulekh and DILRMP. It adds a tamper-proof audit layer. Existing data still accessible." |
| "What about offline areas?" | "Patwari uploads from CSC kiosk. Citizen can claim within 30 days. Offline-first at field level." |
| "How is Aadhaar privacy handled?" | "Raw Aadhaar never stored anywhere. Only SHA-256 hash on-chain. DPDPA 2023 compliant by architecture." |
| "What about fake death certificates?" | "CRS oracle cross-checks with Civil Registration System. Affidavit path has lower confidence score and mandatory Tehsildar review." |
| "Can the code itself be tampered?" | "Chaincode is deployed to all Fabric peers simultaneously. No single node can change it. All peers must validate." |
| "Cost of running this?" | "Hyperledger Fabric has no transaction fees. Infrastructure cost: ~₹2,000/month on NIC NBTS cloud for a tehsil." |
| "Sweden/Georgia also tried this — why did they struggle?" | "They built on public chains (Ethereum). We use permissioned Fabric — no gas fees, controlled access, government MSP identity." |

---

## 10. Open Decisions

| Decision | Decided |
|---|---|
| Login for POC | Mock Aadhaar OTP (hardcoded "123456" for demo personas) |
| DLPI ID format | `DLPI-UP-DAD-00142` (UP Noida format) |
| ULPIN | Optional field in DLPI — store when Patwari enters it |
| Fabric network hosting | Docker Compose local for POC; NIC NBTS for production |
| NyayaAI scope | Claude API wrapper only — no custom ML model |
| BhumiGPT vs NyayaAI | Merged — one service on port 8012 |
| Notification service | Module inside api-gateway (not separate service) for POC |
| Notification channels | SMS (mock) + Email (Mailhog) + Telegram (real Bot API) |
| WhatsApp | Not for POC — Telegram covers the demo |
| BhumiAuction types | OPEN_BID + SEALED_BID + RESERVE_ONLY (all 3 in chaincode) |
| Who can see EC | Public — no login needed (EC is public record in India) |
| EC format | PDF with QR code — generated via pdfkit + qrcode npm packages |
| Claim window | 30 days |
| CRS oracle fallback | Heir petition path (HEIR_PETITION trigger) — affidavit based |
| RecordScan document | UP Khatauni format (not Maharashtra Satbara) — Hindi Devanagari |
| Mobile vs web | Web only for POC |
| BhumiAssurance Fund counter | Skip for POC |
| Gram Sabha in TribalGuard | Keep as hard block for POC |
| Benami detection | Add as 8th pattern — nightly batch job, DM-level alert |

---

## Notes from Research (Key Facts for Judges)

- India's property registration rank: **154/190** (World Bank 2024)
- **66%** of all Indian civil cases involve land disputes
- **40–50%** of property cases are coparcenary/Mitakshara disputes
- DILRMP: 95% RoR computerized, but **only 49% geo-referenced** (needed for ULPIN)
- SVAMITVA: 92% drone survey complete, 2.25 crore property cards issued
- **NyayaAnumana** dataset: 702,945 Indian legal cases — largest available (not 18 crore)
- **Sweden's blockchain land registry**: started 2016, still pending legislation as of 2024 (8 years!)
- **Honduras (Factom)**: failed due to political resistance — NOT technology failure
- **AP Pilot**: 100,000 records secured, but **did NOT achieve state-level implementation after 5 years**
- eCourts MMP: processes ~4 crore cases/year across all Indian courts
- NALSA: ~40 lakh Lok Adalat settlements/year (target 60 lakh with NyayaAI)

---

---

## 11. Complete Tech Stack

### Blockchain Layer

| Component | Technology | Version | Notes |
|---|---|---|---|
| Blockchain platform | Hyperledger Fabric | 2.5 | Permissioned — no public access, no gas fees |
| Consensus | Raft CFT | — | 3 orderer nodes; crash fault tolerant |
| State DB | CouchDB | 3.x | Rich JSON queries for analytics + fraud detection |
| Identity | Fabric CA | 1.5 | MSP certificates for each org (Revenue Dept, NIC) |
| Chaincode language | Go | 1.21 | All 8 chaincodes written in Go |
| Chaincode SDK | fabric-contract-api-go | 1.2.2 | Standard Fabric Go contract API |
| Node.js SDK | @hyperledger/fabric-gateway | 1.x | api-gateway talks to Fabric peers via gRPC |

### Backend

| Component | Technology | Version | Notes |
|---|---|---|---|
| API Gateway | Node.js + Express | 20 LTS / 4.x | Main backend — port 3001 |
| Authentication | JWT (jsonwebtoken) | — | 8-hour sessions; role + jurisdiction in payload |
| Real-time | ws (WebSocket) | — | Mutation alerts, auction bids, fraud alerts |
| Notifications | Module inside api-gateway | — | SMS + Email + Telegram — not a separate service |
| QR Code generation | qrcode (npm) | — | For EC PDF — no third-party service |
| PDF generation | pdfkit (npm) | — | EC PDF generation — no third-party service |
| AI services runtime | Python + FastAPI | 3.11 / 0.100+ | All AI services use FastAPI |

### AI Services

| Service | Port | File | Models Used |
|---|---|---|---|
| RecordScan (UP Khatauni OCR) | 8010 | `ai-services/record-scan/main.py` | claude-haiku-4-5 (vision) |
| CoparcenaryMapper (inheritance law) | 8011 | `ai-services/coparcenary-mapper/main.py` | Pure Python (no LLM) |
| NyayaAI + BhumiGPT (merged legal buddy) | 8012 | `ai-services/nyaya-ai/main.py` | claude-haiku-4-5 (Q&A), claude-sonnet-4-6 (drafting) |
| BhumiSettle + FraudSense | 8013 | `ai-services/bhumi-settle/settle.py` | Pure Python (no LLM) |

### Frontend

| Component | Technology | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript |
| Styling | TailwindCSS | — |
| Map | Leaflet.js + OpenStreetMap | Free tiles — no API key |
| State management | React Context + useState | No Redux needed for POC |
| WebSocket client | Native browser WebSocket | Mutation alerts, live event feed |
| HTTP client | fetch (native) | No axios needed |

### Infrastructure (POC)

| Component | Technology | Notes |
|---|---|---|
| Containerization | Docker + Docker Compose | All services in one compose file |
| Hosting (POC) | Render.com | Current — free tier OK for demo |
| Hosting (production) | NIC NBTS | National Informatics Centre cloud |
| Document storage | IPFS via Pinata | Free tier 1GB — mutation docs, affidavits, will scans |
| Local email (dev) | Mailhog | SMTP mock — visible at localhost:8025 |

---

## 12. Third-Party Services — Complete Reference

> **Legend:** ✅ REAL (working in POC) | 🟡 MOCK (simulated) | ❌ NOT IN POC SCOPE

---

### AI & Intelligence

---

#### ✅ Claude API (Anthropic)

**What it does in BhumiChain:**
- **RecordScan (port 8010):** Receives a scanned UP Khatauni image → sends it to `claude-haiku-4-5` with a Hindi vision prompt → extracts Khasra number, Khata number, owner names, area, land type, fasalYear as structured JSON
- **NyayaAI (port 8012):** Three modes — Q&A (citizen asks a legal question about their land in Hindi/English), Case Summary (officer pastes a dispute, Claude explains it), Document Draft (Claude generates affidavit or legal notice text); `claude-haiku-4-5` for Q&A, `claude-sonnet-4-6` for drafting

**Pricing:**
| Model | Input | Output |
|---|---|---|
| claude-haiku-4-5 | $0.80 / 1M tokens | $4.00 / 1M tokens |
| claude-sonnet-4-6 | $3.00 / 1M tokens | $15.00 / 1M tokens |

For POC demo (~50 queries + 10 scans): estimated **$2–5 total**.

**Setup:** `ANTHROPIC_API_KEY=sk-ant-...` in `.env`

**Decision: ✅ REAL**

---

### Notifications & Messaging

---

#### ✅ Telegram Bot API

**What it does in BhumiChain:**
Citizens and officers opt-in by messaging `@BhumiChainBot` with `/link <aadhaarHash>`. When any of these events fire, BhumiChain sends a Telegram message:
- Mutation initiated on their DLPI
- Heir consent requested (succession pending)
- Fraud alert filed against an officer
- BhumiAuction started for a DLPI they own
- EC generated and ready for download
- Succession case status change

**Pricing:** Completely free. Telegram charges nothing for bots. No rate limit for normal usage (30 messages/sec across all users).

**Setup:** Create bot via `@BotFather` → get `TELEGRAM_BOT_TOKEN` → no payment required.

**Decision: ✅ REAL**

---

#### 🟡 MSG91 (SMS)

**What it does in production:**
Sends Hindi SMS to citizens' registered mobile numbers — mutation alerts, OTP for officer login, heir consent request. Required because not every citizen uses Telegram.
MSG91 provides DLT-compliant transactional SMS with pre-approved Hindi templates (TRAI mandate).

**Why mocked:**
- Requires DLT (Distributed Ledger Technology) registration on TRAI portal — 2–4 weeks
- Needs Indian business entity for sender ID approval
- Hindi SMS templates must be pre-approved by telecom operators

**Pricing (production):**
- Transactional SMS: ₹0.17–₹0.25 per message
- DLT registration: one-time ₹5,900 + GST
- Monthly minimum: ₹500

**POC mock:** `console.log("[SMS]", phone, message)` + displayed in demo UI panel. `SMS_MOCK=true`

**Decision: 🟡 MOCK**

---

#### 🟡 SendGrid (Email)

**What it does in production:**
Sends HTML emails — mutation confirmation PDFs, EC document attachments, auction result summaries, monthly land record statements to citizens.

**Why mocked:**
- Needs domain verification (SPF/DKIM DNS records)
- Requires payment method even for free tier
- For POC, Mailhog handles all emails locally

**Pricing (production):**
- Free tier: 100 emails/day forever
- Essentials: $19.95/month for 50,000 emails/month

**POC mock:** Mailhog (see below) catches all emails and shows them in browser UI. `EMAIL_MOCK=true`

**Decision: 🟡 MOCK** (Mailhog in POC)

---

#### ✅ Mailhog (Local Email Dev Server)

**What it does in BhumiChain:**
Runs as a Docker container — acts as a fake SMTP server. When api-gateway sends an email (mutation alert, EC attachment), Mailhog catches it and displays it in a web UI at `localhost:8025`. Judges can see emails during demo without needing real email accounts.

**Pricing:** Free. Open source. Self-hosted via Docker.

**Setup:** `docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog` — no API key, no account.

**Decision: ✅ REAL** (dev/demo tool)

---

### Database & Storage

---

#### ✅ Amazon DynamoDB

**What it does in BhumiChain:**
Off-chain NoSQL store for all operational data that does not belong on the blockchain:

| Table | Partition Key | What it stores |
|---|---|---|
| `bhumichain-notifications` | `aadhaarHash` | Telegram chatId, email, phone, opt-in status |
| `bhumichain-tokens` | `aadhaarHash#date` | NyayaAI daily query counts per role |
| `bhumichain-ec-cache` | `dlpiId` | Generated EC IPFS CID, valid-until timestamp |
| `bhumichain-analytics` | `eventType#date` | Mutation counts, fraud alerts, auction events for dashboard |

No Aadhaar numbers stored — only hashes. CouchDB (Fabric world-state) handles all blockchain records. DynamoDB handles everything else.

**Why not Aurora PostgreSQL / Aurora DSQL:**
- Aurora needs minimum ~$43/month — no free tier
- Aurora DSQL is multi-region distributed SQL — designed for global fintech at crore-user scale, not a POC
- DynamoDB free tier covers everything BhumiChain needs

**Pricing:**
- **Free tier (always free):** 25 GB storage + 25 WCU + 25 RCU/month = effectively unlimited for POC
- Beyond free tier: $1.25/million write requests, $0.25/million read requests, $0.25/GB/month storage

**Setup:** AWS account → create tables in `ap-south-1` (Mumbai) → `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` in `.env`

**Decision: ✅ REAL**

---

#### ✅ Pinata (IPFS Document Storage)

**What it does in BhumiChain:**
Stores all off-chain documents by content hash (CID). The CID goes on-chain in the mutation or succession record — anyone can verify the document hasn't been tampered with by recomputing the hash.

Documents stored:
- Mutation supporting documents (sale deed scan, gift deed, court order)
- Death affidavits and CRS certificates
- InheritancePlan supporting documents (registered will scan)
- RecordScan output (original Khatauni image)
- Generated EC PDFs

**Pricing:**
- Free tier: 1 GB storage, unlimited bandwidth on public gateway, 100 files
- Paid: $20/month for 10 GB

For POC (~200 documents × ~500KB each = ~100MB): **free tier sufficient**.

**Setup:** Sign up at pinata.cloud → `PINATA_API_KEY` + `PINATA_SECRET` in `.env`

**Decision: ✅ REAL**

---

### Maps & Location

---

#### ✅ OpenStreetMap (via Leaflet.js)

**What it does in BhumiChain:**
Renders the property map on the frontend — shows DLPI parcel boundaries as GeoJSON polygons on top of OSM base tiles. Officers can click a parcel to open mutation details. Citizens see their land on a map.

**Pricing:** Completely free. OSM tiles have no API key, no rate limit for normal (non-commercial, non-abusive) use. Leaflet.js is a free npm library.

**Setup:** `npm install leaflet` — zero configuration.

**Decision: ✅ REAL**

---

### Document Generation (Local Libraries — No External Service)

---

#### ✅ pdfkit (npm)

**What it does in BhumiChain:**
Generates the Encumbrance Certificate PDF entirely in Node.js — no external service call. PDF contains: property details, owner history, encumbrance list, issue timestamp, officer digital signature block, and the QR code image.

**Pricing:** Free npm package. No API, no calls, no cost.

**Decision: ✅ REAL**

---

#### ✅ qrcode (npm)

**What it does in BhumiChain:**
Generates a QR code image (PNG/SVG) that encodes a verification URL — `https://bhumichain.gov.in/verify-ec?dlpi=DLPI-UP-DAD-00142&hash=abc123`. Anyone scanning it can instantly verify the EC is authentic and unmodified. Embedded in the EC PDF by pdfkit.

**Pricing:** Free npm package. Runs locally. No external service.

**Decision: ✅ REAL**

---

### Government & Identity APIs

---

#### 🟡 UIDAI eKYC / Aadhaar OTP Authentication

**What it does in production:**
When a citizen or officer logs in, they enter their Aadhaar number → UIDAI sends OTP to their Aadhaar-linked mobile → they enter OTP → UIDAI confirms identity. BhumiChain then computes `SHA-256(aadhaar + salt)` locally and uses the hash. Raw Aadhaar number is discarded immediately — never stored anywhere.

**Why mocked:**
- Requires ASA (Authentication Service Agency) empanelment with UIDAI — 6–12 months, legal agreement with state government
- Only available to licensed agencies under UIDAI's AUA/ASA framework
- Not feasible for a hackathon POC

**Pricing (production):** ₹20 per authentication (UIDAI charges the integrating agency)

**POC mock:**
- OTP is always `123456` for all demo personas
- 5 pre-set demo personas with known aadhaarHash values in seed data
- `AADHAAR_MOCK=true` in `.env`

**Decision: 🟡 MOCK**

---

#### 🟡 CRS Oracle (Civil Registration System — Death Certificates)

**What it does in production:**
CRS is the national death registration system. When someone dies, the family registers the death at the local municipal office → CRS records it with a unique registration number. BhumiChain runs an oracle that polls or listens to the CRS API — when a death is registered for an DLPI owner, it fires `InitiateSuccessionByDeathCert` on the Uttaradhikar chaincode automatically.

**Why mocked:**
- NIC CRS API is restricted — requires state-level MoU with UP government
- Not publicly available

**Pricing (production):** Government API — free with MoU

**POC mock:**
- `POST /api/test/fire-crs-death` endpoint — officer enters the deceasedHash + DLPI + CRS registration number → oracle fires manually
- Simulates what would happen automatically in production

**Decision: 🟡 MOCK**

---

#### 🟡 DILRMP API (NIC — Digital India Land Records)

**What it does in production:**
Digital India Land Records Modernisation Programme — NIC's existing database of digitized land records across states. BhumiChain's RecordScan uses this to cross-validate OCR results against existing records. Seed data for BhumiChain's initial 500 Noida parcels would come from DILRMP export.

**Why mocked:**
- Restricted government API — NIC empanelment + state MoU required
- Not publicly accessible

**Pricing (production):** Government API — free with MoU

**POC mock:** 500 synthetic Noida Khatauni records in `scripts/seed-district.js` (CSV format matching DILRMP structure). Loaded via `npm run seed`.

**Decision: 🟡 MOCK**

---

#### 🟡 IGRSUP (UP Inspector General of Registration Stamps — Circle Rates)

**What it does in production:**
IGRSUP publishes annual government circle rates (minimum government-assessed value) for every land type in every district of UP. BhumiSettle uses these rates to value each DLPI parcel for equitable partition calculations in the greedy algorithm.

**Why mocked:**
- No public API — circle rates are published as PDF gazette notifications
- Requires manual parsing or state-level data sharing agreement

**Pricing (production):** Free public data — no API cost

**POC mock:** Circle rates hardcoded in bhumi-settle chaincode:
- Dadri tehsil, Agricultural land: ₹45,000/hectare
- Dadri tehsil, Residential plot: ₹8,500/sq.m
- Dadri tehsil, Commercial: ₹15,000/sq.m

**Decision: 🟡 MOCK**

---

#### 🟡 eCourts API (NIC Mission Mode Project)

**What it does in production:**
eCourts MMP provides access to case filings, hearing dates, and court orders from district courts across India. BhumiChain uses it for: (1) NyayaAI referencing past land dispute judgements, (2) BhumiAuction accepting court-decreed auction triggers by verifying the order hash.

**Why mocked:**
- Restricted API — NIC empanelment required
- Limited data access even with empanelment (judgement text not always available)

**Pricing (production):** Government API — free with empanelment

**POC mock:**
- NyayaAI references 3 hardcoded landmark cases (Vineeta Sharma 2020, Danamma 2018, Thressiamma Jacob 2013)
- Auction court decree: officer enters mock order string `ECOURTS-MOCK-ORDER-XYZ`

**Decision: 🟡 MOCK**

---

#### 🟡 bhulekh.up.gov.in (UP Land Records Portal — Public Notice Posting)

**What it does in production:**
The official UP government land records public portal. BhumiChain would post auction notices and mutation notices here so that any member of the public can see them, satisfying the legal requirement for public notice before mutation or auction.

**Why mocked:**
- No write API — it's a state government portal with no integration interface
- Posting notices requires administrative access granted by UP IT Dept

**Pricing:** Free

**POC mock:** `console.log("[NOTICE BOARD]", noticeText)` + shown in demo UI admin panel

**Decision: 🟡 MOCK**

---

### Payments

---

#### 🟡 UPI / Razorpay (Stamp Duty Payment & EMD)

**What it does in production:**
Three payment scenarios in BhumiChain:
1. **Stamp duty payment** — before PropertyTransfer mutation is executed, buyer pays stamp duty. UPI confirmation hash goes on-chain.
2. **BhumiAuction EMD** — bidders deposit Earnest Money Deposit via UPI to participate in auction. Non-winner EMDs are refunded.
3. **BhumiSettle equalization payment** — the party who received higher-value properties pays the shortfall to others via UPI.

**Why mocked:**
- Razorpay needs Indian business entity, KYC, bank account
- NPCI direct integration requires bank partnership
- No UPI credentials available for hackathon

**Pricing (production):**
- Razorpay gateway: 2% per transaction + GST
- NPCI UPI direct: negotiated with banks (typically 0%)

**POC mock:**
- Payment button shown in UI → after 3-second delay, a mock oracle fires `PaymentConfirmed` event
- `UPI_MOCK=true` in `.env`

**Decision: 🟡 MOCK**

---

#### 🟡 NEFT / RTGS (Large Equalization Transfers)

**What it does in production:**
For BhumiSettle equalization payments above ₹2 lakh, UPI is not appropriate. NEFT (up to ₹2L per transaction) or RTGS (above ₹2L, same-day settlement) is used. The bank confirmation reference goes on-chain.

**Why mocked:**
- Requires bank partnership / NPCI NEFT integration
- Not feasible for POC

**Pricing (production):** NEFT ₹2–₹25 per transaction (depends on bank). RTGS ₹24.5–₹49.5 per transaction.

**POC mock:** 5-second delay → `NFETConfirmed` event fires. `NEFT_MOCK=true`

**Decision: 🟡 MOCK**

---

### Hosting & Infrastructure

---

#### ✅ Render.com (POC Hosting)

**What it does in BhumiChain:**
Hosts the api-gateway and frontend for the POC demo so judges can access it from a browser without running Docker locally.

**Pricing:**
- Free tier: 1 web service — **sleeps after 15 min inactivity** (cold start ~30 sec)
- Starter: $7/month per service — always on, no cold start

**Recommendation:** Pay $7/month for api-gateway during demo week so judges don't see cold start delays. Frontend on free tier is fine (Next.js static build).

**Decision: ✅ REAL** (currently deployed — see git history)

---

#### ❌ CERSAI (Central Registry of Securitisation)

**What it does in production:**
CERSAI is the registry for mortgage charges on properties. Before a mutation, BhumiChain would query CERSAI to verify no existing mortgage blocks the transfer.

**Why not in POC:** CERSAI API is restricted to banks and financial institutions only. Not feasible to integrate.

**Decision: ❌ NOT IN POC SCOPE**

---

#### ❌ SVAMITVA / Survey of India

**What it does in production:**
SVAMITVA scheme provides drone-surveyed GPS polygon data for rural abadi (inhabited village) land. Would give BhumiChain precise GeoJSON boundaries for rural parcels.

**Why not in POC:** Data available only for surveyed villages — Noida is urban/peri-urban, not SVAMITVA target area. Out of scope.

**Decision: ❌ NOT IN POC SCOPE**

---

### Summary Table

| Service | Category | Decision | Cost for POC |
|---|---|---|---|
| Claude API (Anthropic) | AI | ✅ REAL | ~$2–5 total |
| Telegram Bot API | Notifications | ✅ REAL | Free |
| Amazon DynamoDB | Database | ✅ REAL | Free tier |
| Pinata IPFS | Storage | ✅ REAL | Free tier |
| OpenStreetMap + Leaflet | Maps | ✅ REAL | Free |
| pdfkit (npm) | PDF generation | ✅ REAL | Free |
| qrcode (npm) | QR generation | ✅ REAL | Free |
| Mailhog | Email (dev) | ✅ REAL | Free |
| Render.com | Hosting | ✅ REAL | $7/month (1 service) |
| MSG91 SMS | Notifications | 🟡 MOCK | ₹0 (mocked) |
| SendGrid Email | Notifications | 🟡 MOCK | ₹0 (Mailhog) |
| UIDAI eKYC / Aadhaar OTP | Identity | 🟡 MOCK | ₹0 (mocked) |
| CRS Oracle (death certs) | Government | 🟡 MOCK | ₹0 (mocked) |
| UPI / Razorpay | Payments | 🟡 MOCK | ₹0 (mocked) |
| NEFT / RTGS | Payments | 🟡 MOCK | ₹0 (mocked) |
| DILRMP API | Government data | 🟡 MOCK | ₹0 (CSV seed) |
| IGRSUP Circle Rates | Government data | 🟡 MOCK | ₹0 (hardcoded) |
| eCourts API | Government | 🟡 MOCK | ₹0 (mocked) |
| bhulekh.up.gov.in | Government | 🟡 MOCK | ₹0 (logged) |
| CERSAI | Mortgage registry | ❌ NOT IN SCOPE | — |
| SVAMITVA / Survey of India | GIS data | ❌ NOT IN SCOPE | — |
| Aurora PostgreSQL | Database | ❌ NOT USING | ~$43/month — overkill |
| Aurora DSQL | Database | ❌ NOT USING | Expensive + new |

**Total estimated POC cost: ~$9–12/month** ($7 Render + $2–5 Claude API)

---

### Environment Variables Summary

```env
# backend/api-gateway/.env

# Hyperledger Fabric
FABRIC_PEER_ENDPOINT=localhost:7051
FABRIC_CHANNEL=land-registry
FABRIC_MSPID=RevenueDeptMSP
FABRIC_TLS_CERT=./certs/peer-tls.pem

# Auth
JWT_SECRET=change-this-before-demo
JWT_EXPIRY=8h

# Claude API (REAL)
ANTHROPIC_API_KEY=sk-ant-...

# Telegram (REAL — get token from @BotFather)
TELEGRAM_BOT_TOKEN=7xxxxxxxxx:AAF...
TELEGRAM_MOCK=false

# DynamoDB (REAL — AWS free tier)
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
DYNAMO_TABLE_NOTIFICATIONS=bhumichain-notifications
DYNAMO_TABLE_TOKENS=bhumichain-tokens
DYNAMO_TABLE_EC_CACHE=bhumichain-ec-cache
DYNAMO_TABLE_ANALYTICS=bhumichain-analytics

# IPFS / Pinata (REAL — free tier)
PINATA_API_KEY=...
PINATA_SECRET=...
IPFS_GATEWAY=https://gateway.pinata.cloud/ipfs/

# Email — Mailhog in dev (REAL dev tool)
EMAIL_MOCK=true
MAILHOG_SMTP=localhost:1025
# SENDGRID_API_KEY=        ← uncomment for production

# SMS — mocked
SMS_MOCK=true
# MSG91_AUTH_KEY=          ← uncomment for production

# Mock oracles
AADHAAR_MOCK=true          # OTP always = 123456
CRS_MOCK=true              # fire via POST /api/test/fire-crs-death
UPI_MOCK=true              # payment confirmed after 3s
NEFT_MOCK=true             # NEFT confirmed after 5s

# App
NODE_ENV=development
PORT=3001
FRONTEND_URL=http://localhost:3000
```

```env
# backend/ai-services/.env  (shared across all 4 AI services)

ANTHROPIC_API_KEY=sk-ant-...
RECORD_SCAN_MODE=claude        # claude | mock
COPARCENARY_MODE=real          # pure Python — no LLM, always real
NYAYA_MODE=claude              # claude | mock

PORT_RECORD_SCAN=8010
PORT_COPARCENARY=8011
PORT_NYAYA=8012
PORT_SETTLE=8013
```

---

*This document is updated after every major discussion or decision. Check the git log for change history.*
