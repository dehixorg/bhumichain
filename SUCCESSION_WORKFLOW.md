# BhumiChain Inheritance & Succession (Virasat) Technical Architecture

This document details the technical pipeline, microservices, and smart contract interactions powering the automated succession (Virasat) module in BhumiChain.

## 1. System Trigger & Ingestion (API Gateway)
The workflow is instantiated via a `POST` request to the API Gateway `/api/succession/upload-crs`.
*   **Payload:** Multipart form-data containing the physical Civil Registration System (CRS) Death Certificate (PDF/JPEG).
*   **Actor:** Can be authenticated via `Patwari` role (assisted flow) or `Citizen` role (self-service).
*   **Routing:** The API Gateway proxies the file buffer to the off-chain `ai-document-analyzer` Python microservice running on port 8010.

## 2. AI Document Processing Pipeline (Off-chain)
The `ai-document-analyzer` service processes the unstructured document:
1.  **OCR Extraction:** The buffer is sent to **Azure Document Intelligence (prebuilt-document model)** to extract raw text, key-value pairs, and bounding boxes, overcoming low-quality scans of Hindi/English hybrid text.
2.  **NER (Named Entity Recognition):** The raw text is passed through a fine-tuned **LayoutLMv3** model to extract targeted entities:
    *   `deceased_name`
    *   `date_of_death` (ISO 8601 normalization)
    *   `crs_registration_number`
3.  **Oracle Validation:** The extracted `crs_registration_number` is dispatched to a simulated UP Government CRS Oracle (`/api/oracle/crs/verify`) to ensure cryptographically secure validity.
4.  **IPFS Pinning:** The original document is pinned to a local IPFS node, returning a CID (e.g., `QmDeathCert...`) to ensure tamper-proof storage without bloating the ledger.

## 3. Distributed Ledger State Query (Hyperledger Fabric)
Once the death is verified, the system must identify the deceased's land parcels (DLPIs) and their legal heirs.
1.  **DLPI Query:** The API Gateway evaluates the `QueryDLPIsByOwner` chaincode function on Fabric, querying the CouchDB state database for all assets where `owners.aadhaarHash` matches the deceased's hash.
2.  **Family Tree Mapping:** The system queries an external **Parivar Register API** (representing UP's Family ID database) using the deceased's Aadhaar hash. This returns an array of living Class-I heirs, including their relational mapping (`relation: "son" | "daughter" | "widow"`) and Aadhaar hashes.

## 4. CoparcenaryMapper AI (On-Chain/Off-Chain Rule Engine)
To eliminate manual manipulation of shares by revenue officers, BhumiChain algorithmically enforces the Hindu Succession Act (1956) and its 2005 Amendment.
*   **HSA 2005 Enforcement:** The engine identifies all Class-I heirs. Crucially, it parses the `relation` field and guarantees that nodes marked as `daughter` receive a coparcenary share strictly equal to a `son` (enforcing Section 6(3) of HSA 2005).
*   **Transaction Payload:** The API Gateway constructs the fractional shares (e.g., `shareDecimal: 0.3333`) and submits an invoke transaction: `submit('dlpi', 'InitiateSuccession', [dlpiId, deceasedHash, heirDataJSON])`.
*   **Ledger State:** The chaincode updates the DLPI asset state to `status: "SUCCESSION_PENDING"` and emits a `SuccessionInitiated` event.

## 5. Asynchronous Notification System (Event Listener)
*   A Fabric block event listener service detects the `SuccessionInitiated` chaincode event.
*   It extracts the `heirAadhaarHashes` from the event payload.
*   It interfaces with a mock **NIC SMS Gateway API** to map hashes to registered mobile numbers and dispatches asynchronous SMS/WhatsApp Webhooks to notify heirs to review their shares.

## 6. Multi-Sig Cryptographic Consent (Citizen Portal)
Heirs authenticate to the Citizen Portal using Aadhaar OTP (generating a JWT containing their Aadhaar hash).
*   **Consent:** Heirs review the computed share distribution. Clicking "eSign" triggers `POST /api/dlpi/:dlpiId/consent-succession`. The API Gateway submits the `ConsentSuccession` chaincode transaction. The chaincode verifies that the invoker's hash matches an expected heir and records the consent state in CouchDB.
*   **Dispute / Objection:** If an heir objects, the chaincode flags the asset as `DISPUTED`, locking any automated state transitions and emitting a `SuccessionDisputed` event for Civil Court routing.

## 7. Zero-Touch Auto-Mutation (Chaincode Execution)
The `ConsentSuccession` chaincode function contains a self-executing evaluation step:
*   Upon every consent recorded, the chaincode checks if `consentingHeirs.length === totalIdentifiedHeirs`.
*   If `true`, the chaincode natively executes the mutation within the same transaction context.
*   It deletes the deceased owner from the DLPI's `owners` array, appends the verified heirs with their computed shares, and updates the DLPI `status` to `OWNER_VERIFIED`.
*   **Architectural Outcome:** The mutation occurs entirely at the consensus layer, completely bypassing the Tehsildar/Patwari approval queue. This achieves a 100% faceless, zero-rent-seeking mutation lifecycle.

---

### UI / UX Flow Consideration (Patwari vs. Citizen)
While the backend execution is fully automated via chaincode, the initiation trigger supports a hybrid UI:
*   **Assisted Flow (Patwari UI):** Patwaris use the `RecordScan AI` dashboard to upload the physical death certificates provided by rural citizens. The Patwari acts *only* as a data-entry conduit; the smart contract prevents them from manually overriding the computed shares.
*   **Faceless Flow (Citizen UI):** Digitally literate citizens trigger the flow directly from their portal, bypassing the Patwari entirely.
