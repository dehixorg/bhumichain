# BhumiChain — In-Depth Technical Workflow

This document provides a deep dive into the technical architecture, data flows, and state management of the BhumiChain National Digital Land Registry platform. It is intended for developers, architects, and technical auditors.

---

## 🏛️ 1. Core Architecture & Tech Stack

BhumiChain uses a multi-tier architecture to separate the presentation layer, business logic, AI processing, and immutable ledger storage.

* **Frontend (Presentation)**: Next.js 14 App Router, React 18, TailwindCSS.
* **API Gateway (Middleware)**: FastAPI / Node.js Express. Handles routing, rate-limiting, and JWT validation.
* **AI / OCR Layer**: Azure Document Intelligence, HuggingFace LayoutLM (NER), LangChain (NyayaAI).
* **Off-chain Storage**: AWS DynamoDB (for async jobs, temporary scan results, and UI preferences).
* **Blockchain (Data & State)**: Hyperledger Fabric v2.5. Permissioned network managed by NIC (National Informatics Centre).

---

## 🔐 2. Authentication & Session Management (Deep Dive)

The authentication system is completely stateless on the frontend, relying on secure JSON Web Tokens (JWT).

### 2.1 JWT Generation & Validation
1. **Request**: Frontend sends Aadhaar hash + OTP to `/api/auth/verify`.
2. **Backend Validation**: The API verifies the OTP with UIDAI services.
3. **Identity Resolution**: The API queries the Fabric identity registry for the user's role (e.g., `citizen` vs `tehsildar`).
4. **JWT Minting**: The server signs a JWT using RS256 with the following claims:
   * `sub`: Cryptographic hash of the Aadhaar number (DPDPA 2023 compliance).
   * `role`: User role (`citizen`, `patwari`, `kanungo`, `tehsildar`, `kotwal`).
   * `jurisdiction`: Area code (e.g., `GBN-001` for Gautam Buddha Nagar).
5. **Session Storage**: Frontend stores the JWT in an `HttpOnly` secure cookie (in production) or `localStorage` (in development/demo mode).

### 2.2 Route Protection (Next.js Middleware)
* The Next.js `middleware.ts` intercepts all requests to `/my-parcels`, `/officer-dashboard`, etc.
* It parses the JWT and redirects unauthorized users back to `/login`.
* Role-based access control (RBAC) ensures a `citizen` cannot access the `/officer-dashboard`.

---

## 🗺️ 3. GIS Map & Geospatial Data Flow

The map module (`/map`) visualizes land parcels using GeoJSON data pulled dynamically from the backend.

### 3.1 Data Flow
1. **Component**: `ParcelMap.tsx` mounts and initializes Leaflet.js.
2. **API Call**: `getGeoJSON()` fetches the master parcel map data.
3. **Blockchain Hydration**: The backend doesn't store coordinates on-chain (too expensive). Instead, it stores a reference to a spatial database (PostGIS) or IPFS hash. The API merges the spatial data (GeoJSON) with the **live on-chain ownership status**.
4. **Rendering**: Leaflet renders polygons on CartoDB Positron tiles.
5. **Styling Logic (`mapColors.ts`)**:
   * `isTribal === true` ➔ Orange
   * `encumbranceStatus !== 'CLEAR'` ➔ Red (Encumbered)
   * `landType === 'BHUMIDHARI'` ➔ Green

---

## 🤖 4. AI Workflows: RecordScan & NyayaAI

BhumiChain employs AI to bridge the gap between legacy paper records and the blockchain.

### 4.1 RecordScan AI (Legacy Digitization)
1. **File Drop**: Officer uploads a physical Khatauni scan (`/scan`).
2. **Upload & Job Creation**: File is uploaded to Azure Blob Storage; a Job ID is created in DynamoDB.
3. **Azure OCR**: Document Intelligence extracts raw Devanagari text.
4. **NER Pipeline**: The raw text is passed to a custom-trained **LayoutLM** model which performs Named Entity Recognition to locate:
   * `Khata_Number`, `Khasra_Number`, `Area`, `Khatedar_Name`.
5. **Validation Engine**: The backend queries the traditional UP Bhulekh database to cross-verify the extracted data.
6. **Frontend Display**: `ConfidenceBanner` and inline editable fields are rendered.
7. **Blockchain Commit**: Once the officer verifies and clicks "Approve", the frontend calls `/api/scan/approve`. This triggers a Fabric transaction (`createParcel`), officially minting the Digital Land Parcel Identifier (DLPI) on-chain.

### 4.2 NyayaAI (Legal Assistant)
1. **User Query**: Officer asks a legal question in `/nyaya-ai`.
2. **Embedding**: The query is embedded using an OpenAI/Azure text-embedding model.
3. **Vector Search**: Pinecone/Milvus vector database is queried. The DB contains embeddings of the UP Revenue Code 2006, Zamindari Abolition Act, and Forest Rights Act.
4. **RAG (Retrieval-Augmented Generation)**: The retrieved legal context is passed to a GPT-4/Claude LLM with a strict system prompt ("You are a UP Revenue Court expert...").
5. **Output**: The frontend renders the response, citing exact section numbers.

---

## 🔄 5. State Transitions & Smart Contracts (Chaincode)

Business logic is strictly enforced at the blockchain layer via Go smart contracts.

### 5.1 The DLPI Lifecycle
A parcel (DLPI) undergoes strict state transitions:
* `MINTED` (via RecordScan or Survey)
* `TRANSFER_PENDING` (locked, no mutations allowed)
* `MUTATION_PENDING` (locked)
* `DISPUTED` (locked by Kotwal/Revenue Court)

### 5.2 Multi-Signature Approval Pipeline
Transfers and Successions require hierarchical multi-sig consensus.
1. **Patwari Review**: `submitApproval(dlpiId, patwariAadhaar, "Level1")`
2. **Kanungo Review**: `submitApproval(dlpiId, kanungoAadhaar, "Level2")`
3. **Tehsildar Execution**: `executeTransfer(dlpiId, tehsildarAadhaar)`
   * The smart contract verifies that Level 1 and Level 2 signatures exist in the state database.
   * If valid, it updates `ownerAadhaarHash` and creates an immutable historical record.

### 5.3 TribalGuard Automated Enforcement
When `executeTransfer` is called, the chaincode checks:
```go
if parcel.IsTribal && !buyer.IsTribal {
    return fmt.Errorf("SCHEDULE_V_VIOLATION: Non-tribal buyer cannot acquire tribal land")
}
```
If this fails, the transaction is rejected at the protocol level. The API catches this error and the frontend renders the `TribalReject` modal.

---

## 📡 6. Real-Time Event Driven Architecture

To keep the UI synchronized across millions of users, BhumiChain uses WebSockets tied directly to Fabric Block Events.

1. **Chaincode Event**: When `executeTransfer` succeeds, the chaincode emits an event: `stub.SetEvent("TransferCompleted", payload)`.
2. **Fabric SDK Listener**: The backend API Gateway listens to the channel event stream.
3. **WebSocket Broadcast**: The API broadcasts the payload to all connected clients via Socket.io.
4. **Frontend `useWebSocket` Hook**:
   * The `ParcelMap` listens for the event. If the affected `dlpiId` is on screen, it triggers a visual pulse animation (re-renders the specific polygon).
   * The `Sidebar` and `OfficerDashboard` listen for events to update counts and show Toast notifications automatically.

---

## 📁 7. Frontend Folder Structure & Routing

* `src/app/` - Next.js App Router. Each folder represents a URL path (e.g., `/login`, `/transfer`, `/officer-dashboard`).
* `src/components/` - Reusable UI components.
  * `/auth` - Login inputs (OTP, Aadhaar).
  * `/dashboard` - Navigation, headers, footers.
  * `/forms` - Complex multi-step wizards (RecordScan, TransferWizard).
  * `/map` - Leaflet GIS integrations.
  * `/modals` - Alerts (TribalReject, FraudReject).
* `src/lib/` - Utility functions.
  * `api.ts` - Axios/Fetch wrappers for backend communication.
  * `auth.ts` - JWT decoding, OTP mock handling.
  * `mockBackend.ts` - In-memory state for demo mode (simulating the blockchain before API integration).
* `src/hooks/` - Custom React hooks (e.g., `useWebSocket`).

---

*Document Version: 1.0 (Architecture Deep Dive)*
*BhumiChain Core Engineering Team*
