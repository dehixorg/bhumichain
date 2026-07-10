# Legal Document Analyzer (Indian Property Documents)

An AI-powered, full-stack web application designed to analyze, parse, and extract structured metadata from Indian property-related legal documents (e.g., Sale Deeds, Gift Deeds, Lease Deeds, Leave & License Agreements, Wills, Mutation Extracts, 7/12 Extracts, RERA Agreements, and Encumbrance Certificates) using **Azure OpenAI GPT-5.4**.

It supports both digital text PDFs and scanned image-only PDFs (automatically converting pages to images and utilizing GPT-5.4's vision capabilities).

---

## 🚀 Key Features

* **Tailored Indian Legal Schema:** Extracts structured details including document registration numbers, SRO details, stamp duty/fees, party details (PAN, Aadhaar, parentage, occupation), specific land metrics (survey numbers, khasra/gat, CTS, villages, boundaries), and payment details.
* **Dual Processing Modes:**
  * **Text Mode:** Standard fast extraction for digital PDFs containing embedded text.
  * **Vision OCR Mode:** Fallback for scanned/handwritten documents; renders pages as PNG images and processes them using GPT-5.4's multimodal capabilities.
* **Instant Multi-Language Toggles:** Extracts elements in the original document language, and automatically translates them to **English** and **Hindi** concurrently on the server. Users can toggle languages instantly in the frontend with zero loading delay.
* **Completeness & Compliance Check:** Calculates a completeness percentage based on critical legal fields and flags missing critical items. If the score is low ($<40\%$), it warns the user and suggests uploading a better copy.
* **Premium UI:** Dark-themed glassmorphism interface with smooth animations, drag-and-drop file upload, collapsible categories, and structured tabular views.

---

## 🛠️ Technology Stack

* **Frontend:** React (Vite), Vanilla CSS (glassmorphism tokens), and SVG iconography.
* **Backend:** Node.js (Express), Multer (file handling), pdf-parse (text extraction), pdfjs-dist & @napi-rs/canvas (PDF to PNG rendering for vision OCR).
* **AI Engine:** Azure OpenAI GPT-5.4 (utilizing standard chat completions deployments).

---

## ⚙️ Getting Started

### 1. Prerequisites
Ensure you have **Node.js (v18+)** installed.

### 2. Environment Setup
Create a `.env` file in the root directory and add your Azure OpenAI keys and endpoints:
```env
AZURE_OPENAI_ENDPOINT=https://your-resource-name.services.ai.azure.com/api/projects/your-project
AZURE_OPENAI_API_KEY=your_azure_openai_api_key_here
DEPLOYMENT_NAME=gpt-5.4
PORT=3000
```
*(Note: `.env` is ignored by git to protect credentials.)*

### 3. Installation
Install the project dependencies:
```bash
npm install
```

### 4. Running the Development Servers
Start both the Express backend server and the Vite React development server simultaneously:
```bash
npm run dev
```

* **Frontend Application:** http://localhost:5173/
* **Backend API Server:** http://localhost:3000

---

## 📊 Extracted Schema Structure

The application extracts data according to the following structured JSON format:

```json
{
  "document_type": "sale_deed",
  "registration_info": {
    "document_number": "1234/2026",
    "registration_date": "2026-07-06",
    "execution_date": "2026-07-01",
    "sub_registrar_office": "SRO Haveli IV, Pune",
    "taluka_or_tehsil": "Haveli",
    "district": "Pune",
    "state": "Maharashtra",
    "book_number": "1",
    "cd_volume_number": "45",
    "page_number": "12"
  },
  "stamp_and_fees": {
    "stamp_duty_paid": 150000,
    "stamp_duty_currency": "INR",
    "registration_fee_paid": 30000,
    "estamp_certificate_number": "IN-MH123456789012U",
    "estamp_issue_date": "2026-06-28",
    "franking_number": null,
    "market_value_as_per_jantri_or_ready_reckoner": 2500000
  },
  "parties": [
    {
      "role": "vendor/seller",
      "name": "Rajesh Kumar",
      "parentage": "S/o Amit Kumar",
      "age": 45,
      "gender": "Male",
      "address": "Flat 302, Green Valley, Pune 411001",
      "pan_number": "ABCDE1234F",
      "aadhaar_last_4_digits": "5678",
      "occupation": "Business"
    }
  ],
  "property": {
    "property_type": "flat_apartment",
    "survey_number": "12A",
    "full_address": "Flat 302, Green Valley, Village Mundhwa, Pune",
    "area": {
      "value": "1200",
      "unit": "sq_ft"
    },
    "boundaries": {
      "north": "Road",
      "south": "Open Plot",
      "east": "Wing B",
      "west": "Adjacent Building"
    }
  },
  "financial": {
    "total_consideration_amount": 2500000,
    "consideration_currency": "INR",
    "payment_mode": "rtgs_neft"
  },
  "witnesses": [
    {
      "name": "Suresh Sharma",
      "address": "Pune",
      "signature_present": true
    }
  ]
}
```
