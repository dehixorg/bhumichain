"""
Pre-scripted RecordScan responses for demo — Noida/GBN pilot.
Two variants:
  demo_clear    — Clean Khatauni scan, high confidence, auto-extracted
  demo_degraded — Faded/torn 1990s register, low confidence, needs officer review
"""

from khatauni_schema import (
    KhatauniExtraction, KhatedaOwner, KhataEncumbrance, ScanResult, LandType,
)

# ─── Scene 2a: Clean scan — Arun Sharma's Khatauni, Dadri tehsil ─────────────

DEMO_CLEAR = ScanResult(
    scanId="SCN-DEMO-CLEAR-001",
    fileName="khatauni_dadri_gata_740_201.jpg",
    fileSizeKB=918.4,
    ipfsCID="QmKhatauni740DAD2026Clean",
    processingSteps=[
        {
            "step": "UPLOAD",
            "label": "Document uploaded",
            "status": "done",
            "durationMs": 287,
        },
        {
            "step": "AZURE_OCR",
            "label": "Azure Document Intelligence OCR",
            "detail": "Extracted 1,142 characters — Devanagari + tabular format recognised",
            "confidence": 0.96,
            "status": "done",
            "durationMs": 1920,
        },
        {
            "step": "LAYOUT_LM_NER",
            "label": "LayoutLM NER — Khatauni field extraction",
            "detail": "21 entities identified: khata no., khasra, area, bhumi prakar, khatedar, fasalvars",
            "confidence": 0.93,
            "status": "done",
            "durationMs": 2340,
        },
        {
            "step": "VALIDATION",
            "label": "Cross-validation vs Bhulekh UP portal",
            "detail": "Gata 740/201, Dadri matches district records (bhulekh.up.gov.in)",
            "confidence": 0.99,
            "status": "done",
            "durationMs": 580,
        },
        {
            "step": "IPFS",
            "label": "Document pinned to IPFS",
            "detail": "CID: QmKhatauni740DAD2026Clean",
            "status": "done",
            "durationMs": 262,
        },
    ],
    extraction=KhatauniExtraction(
        zila="Gautam Buddha Nagar",
        tehsil="Dadri",
        gram="Gharbara",
        fasalVarsh="2025-26",
        khataNo="201",
        khasraNo="740/201",
        areaHectares=2.4,
        areaBigha=9.49,
        landType=LandType.BHUMIDHARI,
        irrigationSource="Tubewell",
        cropDetails="Gehu (Rabi), Dhan (Kharif)",
        khatedars=[
            KhatedaOwner(
                name="Arun Sharma",
                fatherHusbandName="Ramcharan Sharma",
                share="1/2",
                ownershipType="Joint",
            ),
            KhatedaOwner(
                name="Sushma Sharma",
                fatherHusbandName="Arun Sharma (Pati)",
                share="1/4",
                ownershipType="Joint",
            ),
            KhatedaOwner(
                name="Rohan Sharma",
                fatherHusbandName="Arun Sharma (Pita)",
                share="1/4",
                ownershipType="Joint",
            ),
        ],
        hasJointOwnership=True,
        hasCoparcenary=True,
        currentPossessor="Arun Sharma",
        encumbrances=[],
        khatabandiDate="2025-03-15",
        lekhpalSignature="Lekhpal Ramesh Yadav, DAD-P1",
        ocrConfidence=0.96,
        nerConfidence=0.93,
        overallConfidence=0.95,
        flaggedFields=[],
        requiresManualReview=False,
    ),
    suggestedDlpiId="DLPI-UP-DAD-00003",
    processingTimeMs=5389,
)

# ─── Scene 2b: Degraded — old register, torn corner ──────────────────────────

DEMO_DEGRADED = ScanResult(
    scanId="SCN-DEMO-DEGRADED-001",
    fileName="khatauni_dadri_old_1994_gata_312.jpg",
    fileSizeKB=487.2,
    ipfsCID="QmKhatauni312DAD1994Degraded",
    processingSteps=[
        {
            "step": "UPLOAD",
            "label": "Document uploaded",
            "status": "done",
            "durationMs": 301,
        },
        {
            "step": "AZURE_OCR",
            "label": "Azure Document Intelligence OCR",
            "detail": "Paper tear detected on right margin. 63% text recovered. Devanagari ink faded.",
            "confidence": 0.63,
            "status": "done",
            "durationMs": 2380,
        },
        {
            "step": "LAYOUT_LM_NER",
            "label": "LayoutLM NER — Khatauni field extraction",
            "detail": "13 of 21 expected entities extracted. Area column and encumbrance section partially damaged.",
            "confidence": 0.55,
            "status": "partial",
            "durationMs": 2910,
        },
        {
            "step": "VALIDATION",
            "label": "Cross-validation vs Bhulekh UP portal",
            "detail": "Gata 312 found — but owner name partially differs from 1994 record. Needs officer verification.",
            "confidence": 0.68,
            "status": "partial",
            "durationMs": 690,
        },
        {
            "step": "IPFS",
            "label": "Document pinned to IPFS",
            "detail": "CID: QmKhatauni312DAD1994Degraded",
            "status": "done",
            "durationMs": 255,
        },
    ],
    extraction=KhatauniExtraction(
        zila="Gautam Buddha Nagar",
        tehsil="Dadri",
        gram="[अस्पष्ट — फटा हुआ]",
        fasalVarsh="1994-95",
        khataNo="[अस्पष्ट]",
        khasraNo="312",
        areaHectares=1.1,
        areaBigha=4.35,
        landType=LandType.SIRDAR,
        irrigationSource=None,
        cropDetails=None,
        khatedars=[
            KhatedaOwner(
                name="Ram[अस्पष्ट] Yadav",
                fatherHusbandName=None,
                share="पूर्ण",
                ownershipType="Individual",
            ),
        ],
        hasJointOwnership=False,
        hasCoparcenary=False,
        currentPossessor="[अस्पष्ट]",
        encumbrances=[
            KhataEncumbrance(
                type="Mortgage",
                creditorName="[अस्पष्ट — बैंक नाम अपठनीय]",
                amount=None,
                date=None,
                remarks="Ink damage — creditor name and amount illegible",
            ),
        ],
        khatabandiDate="1994-12-10",
        lekhpalSignature=None,
        ocrConfidence=0.63,
        nerConfidence=0.55,
        overallConfidence=0.60,
        flaggedFields=[
            "gram (damaged corner)",
            "khataNo (illegible)",
            "khatedar name (partial)",
            "encumbrance amount (ink faded)",
            "areaHectares (low confidence)",
        ],
        requiresManualReview=True,
    ),
    suggestedDlpiId="DLPI-UP-DAD-00312",
    processingTimeMs=6536,
)

MOCK_RESPONSES = {
    "demo_clear":    DEMO_CLEAR,
    "demo_degraded": DEMO_DEGRADED,
}
