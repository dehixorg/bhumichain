# BhumiChain Inheritance & Succession Workflow (Virasat / वरासत)

This document outlines the end-to-end technical and operational workflow for the automated succession (Virasat) module in BhumiChain.

## 1. Triggering the Succession
The process begins when a landholder passes away. There are two ways this workflow can be triggered:
*   **Citizen-Led:** An heir logs into the BhumiChain Citizen Portal and uploads the deceased’s Civil Registration System (CRS) Death Certificate.
*   **Patwari-Led (Assisted):** For citizens without digital literacy, they submit the physical death certificate to the local Patwari/Lekhpal, who scans and uploads it via the Officer Dashboard.

## 2. AI Document Scanning & Verification
Once uploaded, the **RecordScan AI** pipeline takes over:
*   **Azure Document Intelligence (OCR)** extracts text from the death certificate.
*   **LayoutLM NER** specifically targets key fields: Deceased Name, Date of Death, and the CRS Registration Number.
*   The system uses the CRS Registration Number to silently verify authenticity against the central CRS database via a secure API oracle.

## 3. Mapping to Aadhaar & Family Registry
Once the death is verified, the system needs to find the heirs.
*   **UP Family ID / Parivar Register Mapping:** BhumiChain interfaces with the state’s digitized Family ID database (like UP's *Parivar Kalyan Card* or Haryana's *Parivar Pehchan Patra*).
*   Using the deceased's Aadhaar Hash (linked to their land parcel / DLPI), the system retrieves all living Class-I heirs listed under that family unit.
*   The blockchain pulls their respective Aadhaar Hashes to securely identify them.

## 4. CoparcenaryMapper AI (Rule Engine)
Before distributing shares, BhumiChain runs an on-chain/off-chain rule engine to prevent manual calculation errors or bias:
*   **HSA 2005 Enforcement:** The engine strictly enforces Section 6(3) of the Hindu Succession (Amendment) Act, 2005. 
*   It automatically assigns **equal coparcenary shares to daughters**, preventing rogue officials from illegally bypassing daughters in favor of sons (a common ground-level issue).
*   The exact fractional shares (e.g., 1/3, 1/3, 1/3) are computed and locked into the `InitiateSuccession` chaincode transaction.

## 5. How Other Heirs Are Notified
Transparency is critical. Once the heirs and their shares are identified:
*   BhumiChain automatically queries the Aadhaar/Telecom database to find the registered mobile numbers for the identified heir Aadhaar hashes.
*   **SMS & WhatsApp Alerts** are dispatched immediately via an SMS gateway (e.g., NIC SMS Gateway).
*   The message reads: *"A succession mutation has been initiated for Late [Name]'s property. Please log in to BhumiChain Citizen Portal to review your share and eSign."*

## 6. eSign & Dispute Handling
Heirs log into the portal using their own Aadhaar OTP.
*   **Consent:** They review the family tree and their computed share. If they agree, they click **eSign**, which cryptographically signs the transaction on the Hyperledger Fabric ledger (`ConsentSuccession`).
*   **Objection:** If an heir spots a missing sibling or disputes the calculation, they click **Object**. The automated mutation halts immediately, and the case is legally flagged as "Disputed" and referred to the Civil Court / SDM.

## 7. Zero-Touch Auto-Mutation
Once 100% of the identified heirs cryptographically eSign their consent:
*   The Hyperledger Fabric chaincode verifies the multi-sig condition.
*   The property title (DLPI) is **automatically mutated** on the ledger.
*   **No Tehsildar or Patwari approval is required.** By completely bypassing human approval for undisputed, algorithmically-verified successions, BhumiChain entirely eliminates the primary bottleneck for rural rent-seeking and bribery.

---

### Should we make a Patwari flow?
**Yes, a hybrid approach is best.** While the end-goal is a 100% faceless, citizen-led system, digital literacy in rural UP requires an assisted model. 

*   **Phase 1 (Current):** Patwari triggers the workflow by scanning the death certificate, but the AI and Blockchain handle the actual calculations and mutations, stripping the Patwari of the power to manipulate shares.
*   **Phase 2 (Future):** Citizens upload the certificate directly, or hospitals trigger it automatically upon registering a death, making it a completely zero-touch process.
