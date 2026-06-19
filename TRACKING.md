# BhumiChain — Project Tracking
> CDAC Blockchain India Challenge 2026 | Prototype Stage | 4-Week Sprint
> Last updated: 2026-06-10 (Day 10 complete)

---

## Demo Story: "Ramesh, a farmer in Nashik, Maharashtra"

| Scene | Title | Duration | Status |
|-------|-------|----------|--------|
| 1 | The Problem — Scanned Satbara extract, ink smudged | 60s | ⬜ TODO |
| 2 | RecordScan AI — Satbara image → DLPI on blockchain | 90s | ✅ DONE |
| 3 | Coparcenary — Ramesh dies, CoparcenaryMapper assigns heirs | 60s | ✅ DONE |
| 4 | Property Sale — Multi-sig → national parcel lock → title delivery | 90s | ✅ DONE |
| 5 | Fraud Attempt — Dual-sale rejected at second terminal | 60s | ✅ DONE |
| 6 | TribalGuard — Hard reject on Schedule V parcel | 30s | ✅ DONE |
| 7 | BhumiGPT — Marathi WhatsApp query → land rights answer | 60s | ✅ DONE |
| 8 | Dashboard — BhumiAnalytics fraud heatmap, live metrics | 30s | ✅ DONE |

**Total demo runtime: ~8 minutes**

---

## Feature Tracker

### Blockchain Layer (Hyperledger Fabric v2.5)

| Feature | Chaincode File | Status | Priority | Notes |
|---------|---------------|--------|----------|-------|
| DLPI — Digital Land Parcel Identity | `dlpi/dlpi.go` | ✅ DONE | P0 | Foundation for everything |
| PropertyTransfer — Atomic multi-party | `property-transfer/property_transfer.go` | ✅ DONE | P0 | Core demo Scene 4 |
| MutationManager — 60-sec alert | `mutation-manager/mutation_manager.go` | ✅ DONE | P0 | Core demo Scene 3 |
| Uttaradhikar — Inheritance engine | `uttaradhikar/uttaradhikar.go` | ✅ DONE | P0 | Core demo Scene 3 — CRS-triggered, HSA 2005 enforced, auto-mutation |
| TribalGuard — Hard block | `tribal-guard/tribal_guard.go` | ✅ DONE | P0 | Core demo Scene 6 — <200ms reject, FRA/Schedule V/PVTG, Samatha ruling |
| Encumbrance Module — 30-sec EC | `encumbrance/encumbrance.go` | ✅ DONE | P1 | Scene 4 dependency |
| National Parcel Lock — Cross-SRO | Part of PropertyTransfer | ✅ DONE | P0 | Scene 4 + 5 — in SetTransferLock |
| Preemption Rights Notification | Part of PropertyTransfer | ⬜ TODO | P2 | Adjacent owner notify |

### AI Services (Python FastAPI)

| Feature | Service | Model/Tech | Status | Priority | Demo Scene |
|---------|---------|-----------|--------|----------|-----------|
| RecordScan AI | `record-scan/` | Azure Document Intelligence + NER | ✅ DONE | P0 | Scene 2 — full pipeline, 2 demo variants |
| CoparcenaryMapper AI | `coparcenary-mapper/` | Rule engine + LLM edge cases | ✅ DONE | P0 | Scene 3 — HSA/Muslim/Tribal/ISA, Fraction shares, port 8011 |
| BhumiGPT — Marathi advisory | `bhumi-gpt/` | Claude API + RAG (land law PDFs) | ✅ DONE | P0 | Scene 7 — port 8012, mock Q&A, real Claude claude-sonnet-4-6 when API key set |
| ValuationOracle | `valuation-oracle/` | XGBoost on Maharashtra circle rates | ⬜ TODO | P1 | Scene 4 |
| FraudSense — Graph anomaly | `fraud-sense/` | NetworkX + anomaly scoring | ⬜ TODO | P1 | Scene 5 + 8 |
| NyayaAI — Legal prediction | `nyaya-ai/` | XGBoost + BERT NLP | ⬜ TODO | P2 | Dashboard |
| Janganana Engine — Census cross-ref | `janganana-engine/` | Spatial join + anomaly detection | ⬜ TODO | P1 | Map layer |

### Backend Services (Node.js)

| Feature | File | Status | Priority |
|---------|------|--------|----------|
| API Gateway (Kong-style) | `api-gateway/src/index.js` | ✅ DONE | P0 | Express + JWT + rate limit + oracle proxy |
| Fabric Gateway SDK integration | `api-gateway/src/services/fabric.js` | ✅ DONE | P0 | Mock/real toggle, submit + evaluate + events |
| Oracle Service — Aadhaar mock | `oracle-service/aadhaar.py` | ✅ DONE | P0 | 8 demo identities + tribal flag |
| Oracle Service — CRS mock (death cert) | `oracle-service/crs.py` | ✅ DONE | P0 | Ramesh Patil death cert pre-scripted |
| Oracle Service — Stamp duty | `oracle-service/stamp_duty.py` | ✅ DONE | P1 | Nashik circle rates, MH 5% rule |
| Oracle Service — UPI payment mock | `oracle-service/upi.py` | ✅ DONE | P1 | QR + deep link + auto-verify |
| Oracle Service — eCourts mock | `oracle-service/ecourts.py` | ✅ DONE | P1 | Court order verification |
| Oracle Service — CERSAI mock | `oracle-service/cersai.py` | ✅ DONE | P1 | Dual-mortgage prevention |
| Oracle Service — Valuation + FraudSense stub | `oracle-service/main.py` | ✅ DONE | P1 | Circle-rate valuation, fraud score |
| WebSocket — Real-time alerts | `api-gateway/src/services/websocket.js` | ✅ DONE | P0 | Fabric event relay + mock trigger endpoint |
| Nearby property notification | `api-gateway/src/services/nearby.js` | ✅ DONE | P2 | Adjacent owner alert + preemption rights |
| PM Kisan eligibility API | `oracle-service/pm_kisan.py` | ⬜ TODO | P2 |
| Soil Health Card oracle | `oracle-service/soil_health.py` | ⬜ TODO | P3 |

### Frontend (Next.js 14 + Tailwind)

| Feature | Component | Status | Priority | Demo Scene |
|---------|-----------|--------|----------|-----------|
| GIS Map — Nashik parcels, color-coded | `components/map/ParcelMap.tsx` | ✅ DONE | P0 | Leaflet + dark tiles + filter + search + live event pulse |
| DLPI parcel detail popup | `components/map/ParcelPopup.tsx` | ✅ DONE | P0 | Heirs, encumbrance, HSA note, valuation |
| Janganana mismatch overlay | `components/map/CensusLayer.tsx` | ✅ DONE | P1 | Circle markers, severity colours, toggle |
| RecordScan upload UI | `components/forms/RecordScan.tsx` | ✅ DONE | P0 | Scene 2 — drop zone, animated pipeline, field editor, approve flow |
| Family tree visualizer | `components/dashboard/FamilyTree.tsx` | ✅ DONE | P0 | Scene 3 — SVG tree, HSA ★ daughters, consent states |
| Multi-sig consent panel | `components/forms/MultiSig.tsx` | ✅ DONE | P0 | Scene 3+4 — Fingerprint eSign, objection input, dispute banner |
| Succession page (Scene 3) | `app/succession/page.tsx` | ✅ DONE | P0 | Scene 3 — CRS trigger, AI steps, FamilyTree, MultiSig, MutationAlert |
| PropertyTransfer wizard | `components/forms/TransferWizard.tsx` | ✅ DONE | P0 | Scene 4 — 7-step: buyer form, compliance pipeline, lock, MultiSig, UPI, SRO execute |
| Transfer page (Scene 4+5) | `app/transfer/page.tsx` | ✅ DONE | P0 | Scene 4+5 — scene toggle, wizard, fraud attempt second terminal |
| 60-second mutation alert banner | `components/modals/MutationAlert.tsx` | ✅ DONE | P0 | Scene 3 — SLA badge, live timer, 30-day objection window |
| Fraud rejection screen | `components/modals/FraudReject.tsx` | ✅ DONE | P0 | Scene 5 — national lock timeline, fraud score 0.94, audit trail |
| TribalGuard hard reject screen | `components/modals/TribalReject.tsx` | ✅ DONE | P0 | Scene 6 — all 4 legal citations, auto-notified panel, cannot-override notice |
| TribalGuard page (Scene 6) | `app/tribal/page.tsx` | ✅ DONE | P0 | Scene 6A (non-tribal → hard reject) + 6B (same community → Gram Sabha 5-sig) |
| BhumiGPT WhatsApp-style chat | `components/dashboard/BhumiGPT.tsx` | ✅ DONE | P0 | Scene 7 — Marathi/English, confidence badge, sources, typing animation |
| BhumiGPT page (Scene 7) | `app/bhumi-gpt/page.tsx` | ✅ DONE | P0 | Scene 7 — chat + capabilities + knowledge base panel |
| BhumiAnalytics dashboard | `app/analytics/page.tsx` | ✅ DONE | P1 | Scene 8 — 10 KPI cards, fraud heatmap, live event feed, Janganana summary, chaincode health |
| Fraud heatmap on map | `components/map/FraudHeatmap.tsx` | ✅ DONE | P1 | Scene 8 — 25 risk points, color-coded HIGH/MED/LOW, Leaflet circle markers |
| Janganana page | `app/janganana/page.tsx` | ✅ DONE | P1 — anomaly map, type breakdown, detail table, SVAMITVA stats |
| Nearby sale notification panel | `components/dashboard/NearbyAlerts.tsx` | ⬜ TODO | P2 | |
| DigiLocker title delivery mock | `components/modals/TitleDelivery.tsx` | ✅ DONE | P1 | Scene 4 — inline in TransferWizard done step |

### Data & Infrastructure

| Item | Status | Notes |
|------|--------|-------|
| 5,000 synthetic Nashik parcels (GeoJSON) | ✅ DONE | `data/synthetic-parcels/nashik_parcels.json` + `.geojson` |
| 50 coparcenary family trees | ✅ DONE | `data/family-trees/nashik_families.json` |
| 200 synthetic court cases (NyayaAI training) | ⬜ TODO | Synthetic eCourts format |
| 1,000 synthetic census GPS points (Janganana mock) | ✅ DONE | `data/census-mock/nashik_census_mock.json` — 302 anomalies |
| Satbara extract scan images (demo) | ⬜ TODO | 5 images: clear + degraded |
| Azure VM setup (D8s v3) | ⬜ TODO | Docker + Fabric test-network |
| Hyperledger Fabric test-network | ⬜ TODO | 2 orgs, 3 channels |
| Docker Compose (full stack) | ⬜ TODO | One-command local demo |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1 — CITIZEN INTERFACE                                │
│  Next.js Web Portal | BhumiGPT Chat | GIS Map              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 2 — BUSINESS LOGIC & AI GATEWAY                     │
│  Node.js API Gateway | Python AI Services | Oracle Network  │
│  RecordScan | CoparcenaryMapper | BhumiGPT | FraudSense     │
│  ValuationOracle | NyayaAI | Janganana Engine               │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 3 — HYPERLEDGER FABRIC v2.5                         │
│  State Channel (Maharashtra) | National Channel             │
│  TribalGuard Channel                                        │
│  Chaincodes: DLPI | Transfer | Mutation | Uttaradhikar      │
│              TribalGuard | Encumbrance                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│  LAYER 4 — DATA STORAGE & INTEGRATIONS                     │
│  IPFS (document CIDs) | CouchDB (state) | Redis (cache)    │
│  Mock Oracles: Aadhaar | CRS | UPI | eCourts | SVAMITVA    │
│  Janganana Census API | PM Kisan | Soil Health Card         │
└─────────────────────────────────────────────────────────────┘
```

---

## 4-Week Sprint Timeline

| Week | Days | Goal | Milestone |
|------|------|------|-----------|
| Week 1 | 1–7 | Azure + Fabric + DLPI + Map | Parcel visible on GIS map from blockchain |
| Week 2 | 8–14 | All core chaincodes + alerts | Full transaction flow + TribalGuard reject |
| Week 3 | 15–21 | All AI services live | BhumiGPT answers in Marathi, RecordScan working |
| Week 4 | 22–28 | Polish + Janganana + Video | 8-minute demo recorded, whitepaper final |

---

## Priority Legend
- **P0** — Must have. Demo breaks without it.
- **P1** — Should have. Significantly strengthens demo.
- **P2** — Nice to have. Add if time permits.
- **P3** — Future. Note in whitepaper, don't build now.

---

## Status Legend
- ⬜ **TODO** — Not started
- 🔵 **IN PROGRESS** — Actively being built
- ✅ **DONE** — Complete and tested
- ❌ **BLOCKED** — Waiting on dependency
- ⏭️ **DEFERRED** — Moved to MVP stage

---

## Key Technical Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Blockchain platform | Hyperledger Fabric v2.5 | Non-crypto, permissioned, Indian govt precedent |
| State pilot | Maharashtra (Nashik district) | Satbara format, tribal population, known fraud context |
| LLM for BhumiGPT | Claude API (claude-haiku-4-5) | Fastest, cheapest, multilingual |
| OCR for RecordScan | Azure Document Intelligence | Pre-built, no training needed, 4-week constraint |
| ML platform | Azure ML AutoML | Within Azure credits budget |
| Graph analysis | NetworkX + anomaly scoring | Faster to build than full GNN, demo-sufficient |
| Frontend | Next.js 14 + Tailwind + Leaflet.js | Fast development, GIS-ready |
| Map tiles | SVAMITVA/OpenStreetMap | Free, India-specific, authentic |
| Deployment | Azure AKS + Docker Compose (local) | Cloud for judges, local for demo stability |

---

## Open Questions / Decisions Pending

- [ ] Claude API key — user to provision
- [ ] Azure Document Intelligence endpoint — user to provision
- [ ] Exact Nashik tehsil to use for synthetic data (Nashik / Sinnar / Igatpuri)
- [ ] Whether to include NyayaAI in prototype or defer to MVP
- [ ] Video recording tool (Loom / OBS / Azure screen capture)
- [ ] Submission format — PDF whitepaper + GitHub repo + video

---

## Competitive Advantages (Remind yourself before every session)

1. **RecordScan AI** — No other team solves the paper→blockchain migration with AI
2. **Janganana integration** — Census is live NOW (April 2026). Real-time, real policy relevance
3. **TribalGuard hard block** — Most emotionally compelling 30 seconds in the demo
4. **BhumiGPT in Marathi** — Shows real citizen impact, not just government infrastructure
5. **Coparcenary enforcement** — Solves 40-50% of all Indian civil cases architecturally
6. **Nearby property + preemption rights** — Legal depth no other team will have considered
7. **FraudSense dual-sale live rejection** — Show, don't tell
