# BhumiChain Technical Architecture & Module Specifications

This document outlines the engineering specifications, data flow, and blockchain interactions for the BhumiChain National Land Registry platform.

---

## 1. System Topology
The platform operates on a decentralized permissioned architecture:
* **Frontend**: Next.js 14 App Router, React 18, TailwindCSS. Runs on port 3000.
* **API Gateway**: FastAPI (Python) or Node.js Express. Exposes REST endpoints and manages WebSockets.
* **Blockchain Network**: Hyperledger Fabric v2.5. Hosted on NIC infrastructure.
  * **Orderer Nodes**: Raft consensus mechanism.
  * **Peer Nodes**: Endorsing peers maintained by State Revenue Departments.
  * **Chaincode**: Written in Go (`LandRegistryContract`, `TransferContract`, `TribalGuardContract`).
* **Off-chain Storage**: AWS DynamoDB (for async AI jobs) and PostGIS/S3 (for spatial map data and document storage).

---

## 2. Core Blockchain Mechanics

### The DLPI State Machine
The fundamental unit of state is the **DLPI** (Digital Land Parcel Identifier). The Go chaincode maintains the DLPI lifecycle:
```go
type Parcel struct {
    DLPIId             string `json:"dlpiId"`
    OwnerHash          string `json:"ownerHash"`
    EncumbranceStatus  string `json:"encumbranceStatus"` // CLEAR, DISPUTED, LOAN
    IsTribal           bool   `json:"isTribal"`
    State              string `json:"state"` // MINTED, TRANSFER_PENDING, LOCKED
}
```

### Endorsement Policy
Most read operations (`queryParcel`) require a single peer endorsement.
State-modifying operations (e.g., `executeTransfer`, `approveMutation`) require **Multi-Sig Consensus**. The smart contract verifies cryptographic signatures from at least 2 out of 3 authorized Revenue Officers (Patwari, Kanungo, Tehsildar) before appending the block.

---

## 3. Module Specifications

### Module 1: Authentication & RBAC (Role-Based Access Control)
* **Mechanism**: Stateless JWT (JSON Web Tokens).
* **Flow**:
  1. Frontend sends Aadhaar hash + OTP.
  2. API validates via UIDAI mock layer.
  3. API queries the Fabric identity registry to fetch the user's role and jurisdiction.
  4. API issues an RS256 signed JWT:
     `{ "sub": "hash...", "role": "tehsildar", "jurisdiction": "GBN-001" }`
* **Enforcement**: Next.js middleware intercepts requests to `/officer-dashboard` and decodes the JWT. Smart contracts also extract the caller's identity from the Fabric Client Identity (`cid`) library to ensure a `citizen` cannot call `approveTransfer`.

### Module 2: GIS Map Engine (`/map`)
* **Mechanism**: Leaflet.js + CartoDB Positron + Dynamic GeoJSON Hydration.
* **Flow**:
  1. API retrieves static spatial boundaries (polygons) from a PostGIS DB.
  2. API simultaneously queries the Fabric blockchain for the real-time state of those parcels.
  3. API merges the data and returns a unified GeoJSON object to the frontend.
  4. The frontend applies a color map (`mapColors.ts`) based on the on-chain properties (`isTribal`, `encumbranceStatus`).

### Module 3: Property Transfer & Multi-Sig Consensus
* **Mechanism**: Distributed multi-signature approval pipeline.
* **Flow**:
  1. **Initiation**: Buyer and Seller submit a transfer request. The API sets the DLPI state to `TRANSFER_PENDING`.
  2. **Level 1 (Patwari)**: Patwari logs in, API checks JWT. Patwari approves, API calls `submitApproval(dlpi, "Level1")`.
  3. **Level 2 (Kanungo)**: Kanungo approves, API calls `submitApproval(dlpi, "Level2")`.
  4. **Execution**: Tehsildar triggers `executeTransfer(dlpi)`.
  5. **Chaincode Logic**: The Go contract verifies the existence of Level 1 and Level 2 approvals in the state database. If valid, the `OwnerHash` is updated and a `TransferCompleted` event is emitted.

### Module 4: RecordScan AI Pipeline (`/scan`)
* **Mechanism**: Azure Document Intelligence + LayoutLM (HuggingFace).
* **Flow**:
  1. Officer uploads a Khatauni image. Image goes to Azure Blob Storage.
  2. Azure OCR extracts raw Devanagari text.
  3. The text bounding boxes are passed to a LayoutLM NER model which identifies specific entities (`Khata_No`, `Khatedar_Name`).
  4. The data is cached in DynamoDB while the officer reviews it on the frontend.
  5. Upon officer approval, the API invokes the `mintDLPI` chaincode function to permanently record the digitized parcel.

### Module 5: TribalGuard Automated Enforcement
* **Mechanism**: Smart Contract Interceptor.
* **Flow**:
  When `executeTransfer` is invoked, the chaincode executes a pre-hook:
  ```go
  if parcel.IsTribal {
      buyerData := getIdentityAttribute(buyerHash)
      if !buyerData.IsTribal {
          return fmt.Errorf("SCHEDULE_V_VIOLATION: Non-tribal acquisition blocked")
      }
  }
  ```
  If this returns an error, the transaction is rejected at the protocol layer. The API catches this and the frontend renders a specialized `<TribalReject />` modal.

### Module 6: Live Event Architecture (WebSockets)
* **Mechanism**: Fabric Block Events → Socket.io.
* **Flow**:
  1. When a transaction succeeds on-chain (e.g., `executeTransfer`), the Go contract explicitly emits an event: `stub.SetEvent("TransferCompleted", payloadBuffer)`.
  2. The FastAPI Gateway, acting as a Fabric SDK client, listens to the channel's event stream.
  3. Upon receiving the event, the API broadcasts a JSON message via WebSockets to all connected browsers.
  4. The frontend `useWebSocket` hook catches the message. If the user is on the `/map`, it triggers a localized CSS pulse animation on the specific parcel polygon. If they are on a dashboard, it pops a Toast notification.

### Module 7: Mutation Workflow
* **Mechanism**: State update without structural DLPI change.
* **Flow**:
  1. Citizen submits a mutation request (e.g., change of land use type). State is set to `MUTATION_PENDING`.
  2. The same Level 1 (Patwari) and Level 2 (Kanungo) Multi-Sig pipeline is invoked.
  3. The `approveMutation` chaincode function executes, modifying the parcel's JSON state while preserving the `OwnerHash` and `DLPIId`.

### Module 8: Succession Workflow & Coparcenary Split
* **Mechanism**: DLPI state destruction and fractional minting (UTXO style).
* **Flow**:
  1. Heir submits death certificate and heir details.
  2. Frontend renders the `<FamilyTree />` component dynamically mapping the split.
  3. The chaincode executes `processSuccession(parentDlpiId, []HeirShares)`.
  4. **Fabric Ledger Logic**: The parent DLPI is marked as `HISTORIC` (tombstoned).
  5. The contract loops through the `HeirShares` and mints **N new DLPIs** (e.g., `DLPI-GBN-001-A`, `DLPI-GBN-001-B`), allocating the exact fractional area to each new owner hash.

### Module 9: Encumbrance Certificate (EC) Generation
* **Mechanism**: Blockchain History Query (`GetHistoryForKey`).
* **Flow**:
  1. API invokes the Fabric SDK `GetHistoryForKey(dlpiId)` function.
  2. Fabric returns an array of all state modifications (timestamp, transaction ID, value) since the DLPI was minted.
  3. The API formats this chronological array into a PDF report using a templating engine (e.g., ReportLab).
  4. The resulting PDF is cryptographically signed by the API Gateway representing the Revenue Department.

### Module 10: NyayaAI (Legal Intelligence)
* **Mechanism**: Retrieval-Augmented Generation (RAG) over vector databases.
* **Flow**:
  1. A Python cron job embeds UP Revenue Code PDFs using OpenAI `text-embedding-ada-002` (or similar) into a Pinecone vector index.
  2. Officer submits a query. API embeds the query string and performs a Cosine Similarity search against Pinecone.
  3. Top-K relevant legal text chunks are appended to a strict prompt.
  4. An LLM (GPT-4/Claude) generates the final legal brief with exact section citations.

### Module 11: Analytics & Dashboard
* **Mechanism**: Off-chain data aggregation (CQRS Pattern).
* **Flow**:
  1. Querying Fabric for aggregate data (e.g., "count all parcels in district X") is extremely slow.
  2. Instead, the API implements a CQRS (Command Query Responsibility Segregation) pattern.
  3. Every Fabric Block Event (Module 6) is also consumed by an indexer service that updates highly optimized read-views in PostgreSQL / DynamoDB.
  4. The frontend `/analytics` dashboard queries this PostgreSQL DB to render Recharts (Bar, Pie, Line graphs) instantly.

### Module 12: BhumiAuction (Government Land Auction)
* **Mechanism**: Time-locked Smart Contract Bidding.
* **Flow**:
  1. Tehsildar calls `initiateAuction(dlpiId, reservePrice, endTime)`.
  2. Citizens invoke `placeBid(dlpiId, bidAmount)` which locks their EMD (Earnest Money Deposit) logic off-chain (Razorpay integration).
  3. The chaincode rejects any bids arriving after `endTime` using the Fabric transaction timestamp.
  4. Upon `finalizeAuction()`, the chaincode automatically transfers the DLPI to the highest bidder's `OwnerHash`.

---

## 4. API & Chaincode Endpoints Reference

### Identity & Auth API
* `POST /api/auth/request-otp` - Interfaces with UIDAI mock.
* `POST /api/auth/verify` - Returns RS256 signed JWT. Payload includes `{ sub, role, jurisdiction }`.

### LandRegistry Chaincode (Go)
* `Invoke: mintDLPI(ownerHash, khataNo, khasraNo, area, landType)` ➔ Creates state.
* `Invoke: submitApproval(dlpiId, officerHash, level)` ➔ Appends multi-sig to state DB.
* `Invoke: executeTransfer(dlpiId)` ➔ Checks multi-sig array, updates `ownerHash`, clears approvals.
* `Query: getHistoryForKey(dlpiId)` ➔ Returns block history for EC generation.
* `Query: getParcelsByOwner(ownerHash)` ➔ Uses CouchDB rich query for dashboard rendering.

---

## 5. Frontend Architecture (Next.js 14 App Router)

The React frontend strictly enforces separation of concerns:
```text
src/
├── app/
│   ├── login/page.tsx             # Auth flows, handles JWT storage in HttpOnly cookie
│   ├── map/page.tsx               # Leaflet.js rendering, consumes /api/map/geojson
│   ├── officer-dashboard/         # Protected route (middleware.ts checks role !== 'citizen')
│   │   └── review/[dlpiId]/       # Multi-sig approval screen
│   └── scan/page.tsx              # Drops Khatauni image -> calls /api/scan/upload
├── components/
│   ├── auth/AadhaarInput.tsx      # Controlled input with regex validation
│   ├── forms/TransferWizard.tsx   # Complex multi-step state machine (Zustand/React Hook Form)
│   ├── map/ParcelMap.tsx          # Real-time WebSocket Hydration logic
│   └── modals/TribalReject.tsx    # Triggered by HTTP 403 SCHEDULE_V_VIOLATION
├── lib/
│   ├── api.ts                     # Axios interceptor attaching Bearer JWT
│   └── mockBackend.ts             # Local state fallback when Fabric is offline
└── hooks/
    └── useWebSocket.ts            # Socket.io client listening to 'TransferCompleted'
```
