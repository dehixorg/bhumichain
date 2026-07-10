# BhumiChain Distributed Architecture: VM1 & VM2

BhumiChain is deployed across two separate Virtual Machines (VMs) to ensure a secure, scalable, and decentralized architecture. 

Because Hyperledger Fabric is a distributed consortium network, **both VMs host blockchain nodes**. This prevents a single point of failure and ensures true decentralization across different organizations (e.g., Revenue Department vs. Judiciary/NIC).

---

## 🖥️ VM1: Organization 1 (Revenue Department) & Application Layer

**Role:** VM1 acts as the primary interface for users and hosts the blockchain infrastructure for Organization 1.

### Services running on VM1:
1.  **Frontend Web Portal (Next.js):** The UI that Citizens and Revenue Officers interact with.
2.  **API Gateway (Node.js - Port 4000):** The central router. Translates HTTP requests into gRPC calls for the local blockchain peer.
3.  **AI Microservices (Python/FastAPI):** RecordScan AI, CoparcenaryMapper AI, and Nyaya AI.
4.  **Hyperledger Fabric - Org1 Node:**
    *   **peer0.org1:** The blockchain peer for Organization 1. It maintains a full copy of the ledger and endorses transactions.
    *   **CouchDB (Org1):** The state database attached to `peer0.org1`, storing the World State (DLPIs in JSON format) so Org1 can perform rich queries locally.
    *   **Certificate Authority (ca.org1):** Issues cryptographic identities for Org1 users.

---

## ⛓️ VM2: Organization 2 (Judiciary/NIC) & Consensus Layer

**Role:** VM2 hosts the infrastructure for Organization 2 and runs the Orderer nodes responsible for network consensus.

### Services running on VM2:
1.  **Hyperledger Fabric - Org2 Node & Orderer:**
    *   **peer0.org2:** The blockchain peer for Organization 2. It maintains a synchronized copy of the ledger independently of VM1.
    *   **CouchDB (Org2):** The state database attached to `peer0.org2`.
    *   **Orderer (Raft Consensus):** The crucial node that sequences endorsed transactions into blocks and distributes them to both VM1 and VM2 peers.
    *   **Certificate Authority (ca.org2):** Issues identities for Org2 users.
2.  **IPFS Node (Port 5001):**
    *   Decentralized file storage. Heavy files (Khatauni scans, death certificates) are pinned here.

---

## 🔗 The Link: How VM1 and VM2 Communicate

Since both VMs host Hyperledger Fabric nodes, they communicate natively over the Fabric Gossip Protocol and gRPC.

1.  **Peer-to-Peer Gossip:** `peer0.org1` (VM1) and `peer0.org2` (VM2) communicate securely over TLS to synchronize private data collections and ensure both ledgers match perfectly.
2.  **Transaction Endorsement Flow:**
    *   A transaction (like `InitiateSuccession`) is triggered on the Frontend (VM1).
    *   The API Gateway (VM1) sends the proposal to `peer0.org1` (VM1) *and* `peer0.org2` (VM2) to get enough endorsements (depending on the chaincode endorsement policy).
    *   Once endorsed by the peers, the API Gateway sends the transaction to the **Orderer** (VM2).
    *   The Orderer (VM2) creates a new block and broadcasts it back to the peers on **both VM1 and VM2**.
    *   Both `peer0.org1` and `peer0.org2` update their respective CouchDB databases simultaneously.

### Why this architecture is powerful:
By putting `peer0` and `CouchDB` on VM1 alongside the frontend, **VM1 can execute lightning-fast read queries** (like fetching land records) entirely locally without waiting for VM2, while still relying on VM2's Orderer for secure, decentralized write-consensus.
