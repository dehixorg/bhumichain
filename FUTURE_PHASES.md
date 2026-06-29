# BhumiChain — Future Phases Reference
> Post-POC development guide. Phase 3 (Pilot) and beyond.
> POC decisions and current architecture → see MASTER_DEV.md

---

## 1. Complete Government Hierarchy (All Roles)

### National Level

| Role | Title | What they do |
|---|---|---|
| `nic_admin` | NIC System Administrator | System deployment, security, node management, onboarding new states |
| `dolr_secretary` | Secretary, DoLR (Dept of Land Records) | Policy approvals, cross-state reports, DILRMP integration oversight |
| `national_coordinator` | BhumiChain National Coordinator | Monitor all state channels, cross-state fraud (national channel) |

### State Level (UP)

| Role | Title | What they do |
|---|---|---|
| `state_admin` | Revenue Board Administrator (UP) | Manage all district data, state-wide analytics, officer onboarding |
| `board_of_revenue` | Board of Revenue member | Highest appeals authority, policy enforcement |
| `ig_registration` | Inspector General of Registration (IGR) | Oversees all SROs, stamp duty policy, EC framework |
| `divisional_commissioner` | Divisional Commissioner | Oversees 2–4 districts, hears collector appeals |

### District Level

| Role | Title | What they do |
|---|---|---|
| `collector` | District Magistrate / Collector | Ultimate district authority. Override mutations, benami referral, set court injunctions, disaster management land surveys |
| `adr_revenue` | Additional District Registrar | Assists Collector on revenue matters |
| `adr_land_acquisition` | ADR Land Acquisition | Government acquisition cases (RFCTLARR Act) |
| `dilr` | District Inspector of Land Records | Technical head of all Lekhpals. Bulk operations, data quality, survey supervision |

### Sub-Division Level

| Role | Title | What they do |
|---|---|---|
| `sdm` | Sub-Divisional Magistrate | Approves contested mutations, hears revenue cases, authority above Tehsildar |
| `sdo_land` | SDO Land Acquisition | Sub-division level land acquisition |

### Tehsil / Taluka Level

| Role | Title | What they do |
|---|---|---|
| `tehsildar` | Tehsildar | **POC role.** Final mutation approval, succession disputes, tehsil dashboard |
| `naib_tehsildar` | Naib Tehsildar | Deputy. Same powers as Tehsildar for routine matters |
| `awal_karkun` | Awal Karkun (Senior Clerk) | Back-office: data entry, certified copy issuance, file management |
| `sro` | Sub-Registrar | Registers sale deeds, issues ECs, endorses property transfers |

### Village / Circle Level

| Role | Title | What they do |
|---|---|---|
| `kanungo` / `circle_inspector` | Kanungo / Revenue Inspector | **POC role.** Supervises Lekhpals, field verification, escalates disputes |
| `lekhpal` / `patwari` | Lekhpal / Patwari | **POC role.** Village-level records officer. RecordScan, mutations, Girdawari |
| `kotwal` | Kotwal | Physical notice serving, village activity log. Digital role: confirm notice served |
| `gramsevak` | Gram Sevak | Gram panchayat secretary. Involved in abadi land, panchayat resolutions |

### Registration Chain

| Role | Title | What they do |
|---|---|---|
| `sro` | Sub-Registrar | Registers documents, issues ECs, endorses transfers |
| `stamp_inspector` | Stamp Inspector | Stamp duty verification, franking |

### Legal / Social

| Role | Title | What they do |
|---|---|---|
| `nalsa` | NALSA Coordinator | Lok Adalat scheduling, legal aid alerts, NyayaAI outputs |
| `drt_officer` | DRT (Debt Recovery Tribunal) | SARFAESI auction oversight, NPA enforcement |
| `court_receiver` | Court-appointed Receiver | Manages property under dispute during court proceedings |

### Specialized / Tribal

| Role | Title | What they do |
|---|---|---|
| `gram_sabha` | Gram Sabha (body, not individual) | Multi-sig consent for tribal land transactions (5 signatories) |
| `forest_officer` | Forest Range Officer | FRA 2006 rights verification, forest land flags |
| `pvtg_coordinator` | PVTG Welfare Officer | Particularly Vulnerable Tribal Group protections |

### Finance / Banking

| Role | Title | What they do |
|---|---|---|
| `bank` | Bank Branch Manager / Loan Officer | EC queries, mortgage registration (CERSAI), SARFAESI notices |
| `nabard` | NABARD coordinator | KCC (Kisan Credit Card) land eligibility |
| `pmay` | PMAY coordinator | Housing scheme eligibility against land ownership |

### Survey / GIS

| Role | Title | What they do |
|---|---|---|
| `survey_of_india` | Survey of India (SVAMITVA) | Drone survey GPS polygon import |
| `dilrmp_tech` | DILRMP Technical Officer | Bulk data migration, geo-referencing, ULPIN assignment |

---

## 2. Phase 3 Features (Pilot — 1 Tehsil, Real Data)

### Requires Before Phase 3
- [ ] UIDAI ASA empanelment (for real Aadhaar OTP)
- [ ] UIDAI eSign ESP tie-up (eMudhra or NSDL)
- [ ] UP Revenue Board NIC empanelment (Bhulekh API access)
- [ ] CRS API access (MoHFW Vital Statistics)
- [ ] DigiLocker issuer registration (DoLR)
- [ ] NIC NBTS or Azure India hosting
- [ ] Legal framework: UP state govt notification for blockchain RoR

### Phase 3 Features to Build

| Feature | Who uses it | Why deferred from POC |
|---|---|---|
| Real Aadhaar OTP | All users | Need UIDAI authorization |
| Real eSign | Transfer + Succession | Need ESP empanelment |
| SRO login + Encumbrance Cert | Sub-Registrar | Separate auth chain, not in demo story |
| Bank API login | Bank officers | Need RBI/bank API agreements |
| Real DILRMP import | DILR | Need UP Bhulekh API key |
| Mortgage registration | Bank + SRO | Depends on bank + CERSAI |
| Court injunction | SDM/Tehsildar | Needs eCourts MMP integration |
| BhumiAuction full (4 types) | Heirs + Banks | Type 2 needs court order chain |
| NyayaAI full | Citizens + NALSA | Needs NyayaAnumana dataset licensing |
| Multi-state channels | State admins | Phase 3: add Rajasthan or Haryana channel |
| ULPIN harmonization | DILR | 49% geo-referenced nationally — incomplete |
| Janganana census integration | DILR + Collectors | Census 2025 data not yet released |
| PM Kisan eligibility check | Citizens | Need PM Kisan API access |
| Soil Health Card cross-ref | Patwari | SHC API integration |
| Preemption rights notification | Adjacent owners | Legal edge case, low demo value |

---

## 3. Phase 4 Features (State Scale)

- Multi-tehsil rollout across Gautam Buddha Nagar
- Real Fabric network: NIC NBTS hosting (not Azure)
- SVAMITVA GPS polygon import (Survey of India API)
- Cross-district benami detection (national channel real data)
- WhatsApp Business API for citizen notifications
- Mobile app (Flutter — for Patwari field use, offline-first)
- Integration with eCourts MMP for live court status
- BhumiAnalytics: state-level Collector dashboard

---

## 4. NyayaAI — Full Production Plan

### Training Data (Not 18 Crore — Corrected)

| Dataset | Size | Availability |
|---|---|---|
| NyayaAnumana (eCourts format) | 702,945 cases | Open source (IIT Bombay) |
| eCourts scrape (land cases only) | ~50,000 cases | Legal via RTI / NIC agreement |
| Synthetic augmentation | ~200,000 cases | Generate from base distributions |
| **Total realistic** | **~950,000 cases** | Reframe in whitepaper |

Do NOT claim "18 crore cases" — NyayaAnumana is the largest available corpus at ~703K. Judges will fact-check this.

### Model Architecture (Production)
- XGBoost: case outcome prediction (settled / court / lok_adalat)
- BERT-multilingual: legal text NER for citation extraction
- SHAP TreeExplainer: top-5 explainability factors
- Claude API: legal text summarization + Marathi/Hindi explanation
- Separate outputs for: citizen advisory, judicial brief, Lok Adalat anchor

---

## 5. BhumiAuction — Full 4-Type Architecture

| Type | Trigger | Who benefits | POC status |
|---|---|---|---|
| Type 1: Consensual Heir | All heirs agree → auction instead of partition | Heirs | Demo in POC |
| Type 2: Court-Ordered | Court decree for partition, court-appointed receiver manages | Court, heirs | Phase 3 (needs court chain) |
| Type 3: NPA/SARFAESI | Bank NPA → DRT notice → public auction | Bank, DRT | Phase 3 (needs bank + DRT) |
| Type 4: Govt Land Bank | Government surplus land → public tender | Government | Phase 4 |

**Legal note for Type 2:** Chaincode executes AFTER court decree. It replaces the court receiver (inefficient manual process), not the judicial decree itself. This distinction matters for legal validity.

---

## 6. TribalGuard (Phase 3 — Not in Noida Demo)

Noida (Gautam Buddha Nagar) has no Schedule V tribal areas.

For Phase 3, add a second tehsil from tribal UP district:
- Sonbhadra district (largest tribal district in UP — Gond, Kol communities)
- Lakhimpur Kheri (Tharu tribe, Schedule V)

TribalGuard features:
- Hard chaincode reject: non-tribal buyer → `TRIBAL_TRANSFER_PROHIBITED` error
- Gram Sabha 5-signature multi-sig for intra-tribal transfers
- FRA 2006 S.3/S.4 community rights recording
- PVTG (Particularly Vulnerable Tribal Group) extra protections
- Auto-NALSA notification on any tribal transfer attempt
- Cite: Samatha v. State of AP (1997) 8 SCC 191

---

## 7. Cross-State Architecture (Phase 4)

### National Channel Design
```
state-channel-UP    ── state data (UP only)
state-channel-MH    ── state data (Maharashtra only)
state-channel-RJ    ── state data (Rajasthan only)

national-channel    ── cross-state data:
  - Parcel locks (prevent dual-sale across states)
  - Benami network graph (ownership patterns)
  - NPA alerts (bank exposure across states)
  - Succession cross-state heir verification
```

### Endorsement Policy (Cross-State Transaction)
```
For a property sale involving parties from different states:
  AND(
    state-channel-UP.RevenueDept.MSP,
    national-channel.DoLR.MSP
  )
```

---

## 8. What NOT to Build Until Phase 3

These exist in the codebase but should remain mocked:

| Component | File | Phase |
|---|---|---|
| Real UIDAI API | oracle-service/aadhaar.py | Phase 3 |
| LayoutLM NER model | record-scan/pipeline.py | Phase 3 (Claude Vision fine for POC) |
| Mahabhulekh cross-validation | record-scan/pipeline.py | Phase 3 |
| ValuationOracle (XGBoost) | ai-services/valuation-oracle/ | Phase 3 |
| FraudSense GNN (full) | ai-services/fraud-sense/ | Phase 3 |
| NyayaAI (full model) | ai-services/nyaya-ai/ | Phase 3 |
| Janganana Engine | ai-services/janganana-engine/ | Phase 3 (census data needed) |
| CERSAI real integration | oracle-service/cersai.py | Phase 3 |
| UPI real payment | oracle-service/upi.py | Phase 3 |
| DigiLocker real delivery | (not built) | Phase 3 |
| BhumiAuction Type 2, 3, 4 | (not built) | Phase 3 |
