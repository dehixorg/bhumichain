# BhumiChain Distributed Architecture: VM1 & VM2

BhumiChain is deployed across two separate Virtual Machines (VMs) to ensure a secure, scalable, and decentralized architecture. This document explains the exact role of each VM, the services they run, and how they communicate with each other.

---

## 🖥️ VM1: Application & AI Layer (The "Client" Node)

**Role:** VM1 acts as the primary interface for users (Citizens, Patwaris, Officers) and handles all heavy off-chain computing, AI processing, and API routing. It does *not* host the core ledger.

### Services running on VM1:
1.  **Frontend Web Portal (Next.js):** 
    *   The UI that Citizens and Revenue Officers interact with.
    *   Runs in development mode (`npm run dev`) or production mode.
2.  **API Gateway (Node.js - Port 4000):**
    *   The central router. It receives HTTP requests from the Frontend and translates them into gRPC calls to the blockchain.
    *   **Fabric SDK:** Uses the Hyperledger Fabric SDK to sign and submit transactions to the network on VM2.
3.  **AI Microservices (Python/FastAPI - Port 8010/8011):**
    *   **RecordScan AI:** Handles Azure Document Intelligence OCR and LayoutLM NER for legacy document scanning.
    *   **CoparcenaryMapper AI:** The rule engine that processes family trees.
    *   **Nyaya AI:** The predictive justice model for dispute resolution.

---

## ⛓️ VM2: Blockchain Consensus Layer (The "Ledger" Node)

**Role:** VM2 is the secure, immutable backend. It hosts the Hyperledger Fabric consortium network, the smart contracts (chaincode), and decentralized storage. It acts as the absolute source of truth.

### Services running on VM2:
1.  **Hyperledger Fabric Network (Docker Containers):**
    *   **Peers (e.g., peer0.org1.example.com):** Maintain the ledger and state database.
    *   **Orderer (Raft Consensus):** Sequences transactions into blocks.
    *   **Certificate Authority (CA):** Issues cryptographic identities to users (Citizens, Tehsildars).
2.  **State Database (CouchDB):**
    *   Stores the current "World State" of all DLPIs (land parcels) in JSON format, allowing rich queries like `QueryDLPIsByOwner`.
3.  **Smart Contracts / Chaincode (`dlpi-contract`):**
    *   The compiled business logic (Node.js/Go) running in isolated Docker containers. This is where `InitiateSuccession` and `ConsentSuccession` natively execute.
4.  **IPFS Node (Port 5001):**
    *   Decentralized file storage. When a Khatauni or Death Certificate is uploaded, it is pinned here. The resulting CID (e.g., `Qm123...`) is what gets stored on the Fabric ledger.

---

## 🔗 The Link: How VM1 and VM2 Communicate

The architecture operates on a strict **Off-Chain (VM1) to On-Chain (VM2)** flow.

1.  **gRPC over TLS:** The API Gateway on **VM1** uses the Fabric SDK to connect to the Peer and Orderer nodes on **VM2**. This communication happens via gRPC protocol, secured by mutual TLS certificates.
2.  **Transaction Flow (Example: Succession):**
    *   A citizen uploads a death certificate on the Frontend (**VM1**).
    *   The AI microservice on **VM1** scans it and extracts the Aadhaar Hash.
    *   The API Gateway on **VM1** packages this data into a transaction proposal.
    *   **VM1** sends the proposal to the Peer on **VM2** via gRPC.
    *   The Peer on **VM2** executes the smart contract (Chaincode), validates the rules (HSA 2005), and returns an endorsement to **VM1**.
    *   **VM1** forwards the endorsed transaction to the Orderer on **VM2**, which cuts a block and permanently records the mutation on the ledger.
3.  **IPFS Gateway:** When the API Gateway (**VM1**) needs to retrieve a document (like a scanned Khatauni), it requests it from the IPFS HTTP API exposed by **VM2**.

### Why separate them?
This separation mimics a real-world enterprise deployment. The UP Government (Revenue Department) would host **VM1** (Application/AI), while the actual blockchain nodes (**VM2**) would be distributed across independent consortium members (e.g., NIC, Ministry of Electronics and IT, Judiciary) to ensure decentralization and prevent a single point of failure.
