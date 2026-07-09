# BhumiChain Inheritance & Succession Workflow
**Module:** HSA 2005 Automated Mutation via Smart Contracts  
**Platform:** Hyperledger Fabric (Azure VM) & Next.js

---

## 1. Introduction
This document outlines the step-by-step workflow for the BhumiChain Inheritance module. Unlike traditional land registries that rely on manual applications and Revenue Officer approvals, this system automates the mutation process using Oracles and Blockchain Consensus to strictly enforce the **Hindu Succession Act (HSA) 2005**.

## 2. The Step-by-Step Workflow

### Step 1: The External Trigger (CRS Oracle)
The process begins entirely autonomously.
1. A citizen (e.g., Ramesh Kumar) passes away. 
2. The municipality registers the death in the **Civil Registration System (CRS)**.
3. The CRS Oracle detects this and fires a secure webhook to the BhumiChain API Gateway.
4. The backend API automatically invokes the `InitiateSuccession` function on the Hyperledger Fabric ledger.
5. The land parcel's status on the blockchain is immediately locked and updated to `SUCCESSION_PENDING`.

### Step 2: AI Family Tree Mapping
Once the succession is initiated on-chain:
1. The backend pings the **Coparcenary Mapper AI** (Python microservice).
2. The AI analyzes the family tree records and applies HSA 2005 logic.
3. It determines the rightful heirs and mandates equal coparcenary rights for daughters.
4. Result: The land is mathematically divided into exact **33.3% shares** for the three heirs (Arun, Priya, Sunita).

### Step 3: Multi-Party eSign (Frontend UI)
Instead of visiting a Tehsildar's office, the heirs interact with the blockchain directly.
1. **Heir 1 (Priya):** Logs into the BhumiChain portal via Aadhaar. She navigates to **My Parcels**, sees the `Pending Inheritance` badge, clicks **Review Inheritance**, and eSigns her consent using an Aadhaar OTP.
2. **Heir 2 (Arun):** Logs in, reviews the exact same smart contract proposal, and eSigns his consent.
3. **Heir 3 (Sunita):** Logs in and provides her digital signature. 
*Note: The blockchain records the `aadhaarHash` for each signature, maintaining an immutable cryptographic audit trail while complying with DPDPA 2023.*

### Step 4: Automated On-Chain Mutation (The Magic)
This is the core innovation of the BhumiChain system.
1. The moment the final heir (Sunita) signs, the `dlpi.go` smart contract detects that **100% consensus has been reached**.
2. **NO Human Approval Needed:** The chaincode completely bypasses the Patwari and Tehsildar. It automatically executes the `executeSuccessionMutation` logic.
3. The legacy owner (Ramesh Kumar) is removed from the ledger.
4. The new owners (Priya, Arun, Sunita) are permanently written into the world state database with their 33.3% shares.
5. The `SUCCESSION_PENDING` lock is released, and the property status becomes `OWNER_VERIFIED`.

## 3. Cryptographic Verification
To prove to stakeholders that this mutation occurred flawlessly without middleman tampering, the following command can be run on the Azure VM terminal:

```bash
docker-compose exec cli peer chaincode query -C land-registry -n dlpi -c '{"Args":["GetDLPIHistory", "DLPI-UP-DAD-00100"]}'
```

**Output Proof:** The terminal will display a JSON array showing the exact cryptographic transaction hashes (`txId`) and timestamps of the mutation, providing irrefutable proof of the digital succession.
