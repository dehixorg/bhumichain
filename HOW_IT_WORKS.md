# How BhumiChain Works

BhumiChain is a **National Digital Land Registry** built on a blockchain (Hyperledger Fabric) to make land ownership in India completely secure, transparent, and paperless.

Here is exactly how the system works from start to finish:

---

## 1. Logging In (Secure Identity)
* **Citizens & Officers** log in using **DigiLocker** or **Aadhaar OTP**.
* To protect privacy (DPDPA 2023), actual Aadhaar numbers are never saved. The system only stores a cryptographic "hash" of the ID.
* The system knows immediately if you are a regular Citizen, a Patwari (village officer), or a Tehsildar (senior officer) based on your login.

## 2. Viewing Land Records (The Dashboard)
* Once logged in, citizens see their **"My Parcels"** dashboard.
* It displays all land they own. Each piece of land has a **DLPI** (Digital Land Parcel Identifier), similar to an Aadhaar card but for land.
* Citizens can download their **RoR (Record of Rights)** or view their land on the **GIS Map**.
* The map uses colors to show land types (e.g., Green for permanent land, Orange for Tribal land, Red if there is a loan/dispute).

## 3. Buying or Selling Land (Property Transfer)
If you want to sell a piece of land:
1. **Initiate**: The seller enters the buyer's Aadhaar number.
2. **Smart Checks**: The system instantly checks if the land has any loans, active disputes, or if it belongs to a protected Tribal group (using **TribalGuard**).
3. **Payment**: Stamp duty is calculated and paid online.
4. **Officer Review**: A Patwari checks the details and forwards it up the chain.
5. **Multi-Sig Approval**: Finally, higher officers (Kanungo and Tehsildar) must both digitally sign the transfer.
6. **Blockchain Magic**: Once approved, the blockchain is updated permanently. The land moves from the seller's dashboard to the buyer's dashboard instantly.

## 4. Passing Down Land (Succession)
When a landowner passes away:
1. An heir uploads the Death Certificate and Legal Heir document.
2. The system automatically builds a **Visual Family Tree** showing how the land will be divided (e.g., 33% to each of 3 heirs).
3. Every heir must log in and digitally sign to say they agree with their share.
4. Once all heirs and officers approve, the blockchain creates new DLPIs for each heir.

## 5. Digitizing Old Paper Records (RecordScan AI)
To bring old paper records (Khataunis) onto the blockchain:
1. An officer uploads a photo of a physical UP Khatauni.
2. **RecordScan AI** uses Azure OCR to read the Hindi text and LayoutLM (AI) to extract the exact Khata number, owner name, and land size.
3. It cross-checks this data with the old government database.
4. The officer reviews it and clicks "Approve", which magically creates a new secure blockchain record for that land.

## 6. Resolving Legal Questions (NyayaAI)
If an officer is confused about a complex land law:
1. They type a question into **NyayaAI** (e.g., "Can a private company buy Tribal land?").
2. The AI searches through the UP Revenue Code and recent court judgements.
3. It provides an exact legal answer with citations so the officer makes the right decision.

## 7. Real-Time Tracking
* Every single time a property is transferred, mutated, or disputed, a **Live Event** fires.
* If a citizen is looking at the map, the parcel will literally pulse with a color (e.g., Blue for a transfer) the exact second the Tehsildar approves it, without needing to refresh the page.
