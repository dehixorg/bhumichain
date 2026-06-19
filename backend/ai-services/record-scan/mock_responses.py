"""
Pre-scripted RecordScan responses for demo Scene 2.
Two variants:
  - demo_clear:    Clean Satbara scan → high confidence → auto-extracted
  - demo_degraded: Ink-smudged scan → low confidence → flags for officer review
"""

from satbara_schema import (
    SatbaraExtraction, SatbaraOwner, SatbaraEncumbrance, ScanResult, LandType
)

# ─── Scene 2a: Clean scan (Ramesh Patil's Satbara) ────────────────────────────

DEMO_CLEAR = ScanResult(
    scanId="SCN-DEMO-CLEAR-001",
    fileName="satbara_sinnar_142_2a.jpg",
    fileSizeKB=842.3,
    ipfsCID="QmSatbaraSNNSurvey142Clean2026",
    processingSteps=[
        {
            "step": "UPLOAD",
            "label": "Document uploaded",
            "status": "done",
            "durationMs": 312,
        },
        {
            "step": "AZURE_OCR",
            "label": "Azure Document Intelligence OCR",
            "detail": "Extracted 847 characters from Devanagari + Roman text",
            "confidence": 0.94,
            "status": "done",
            "durationMs": 1840,
        },
        {
            "step": "LAYOUT_LM_NER",
            "label": "LayoutLM NER — field extraction",
            "detail": "18 entities identified: owner, survey no, area, land type, encumbrances",
            "confidence": 0.91,
            "status": "done",
            "durationMs": 2210,
        },
        {
            "step": "VALIDATION",
            "label": "Cross-validation against Mahabhulekh registry",
            "detail": "Survey No. 142/2A matches district records",
            "confidence": 0.98,
            "status": "done",
            "durationMs": 640,
        },
        {
            "step": "IPFS",
            "label": "Document pinned to IPFS",
            "detail": "CID: QmSatbaraSNNSurvey142Clean2026",
            "status": "done",
            "durationMs": 290,
        },
    ],
    extraction=SatbaraExtraction(
        districtName="Nashik",
        tehsilName="Sinnar",
        villageName="Sonewadi",
        surveyNumber="142",
        subdivisionNumber="2A",
        localName="Gut No. 142",
        totalAreaHectares=2.4,
        landType=LandType.BAGAYAT,
        irrigationSource="Well",
        owners=[
            SatbaraOwner(
                name="Ramesh Dattatray Patil",
                fatherHusbandName="Dattatray Vishwanath Patil",
                share="Full",
                ownershipType="Individual",
            )
        ],
        hasJointOwnership=False,
        hasCoparcenary=True,
        encumbrances=[],
        currentCultivator="Ramesh Dattatray Patil",
        cropDetails="Onion (Kharif), Wheat (Rabi)",
        possessionType="Self",
        surveyDate="2019-11-10",
        registeredAt="2019-11-14T10:30:00",
        talathiSignature="Suresh B. Pawar, Talathi, Sonewadi",
        ocrConfidence=0.94,
        nerConfidence=0.91,
        overallConfidence=0.93,
        flaggedFields=[],
        requiresManualReview=False,
    ),
    suggestedDlpiId="DLPI-MH-SNN-00142",
    processingTimeMs=5292,
)

# ─── Scene 2b: Degraded/smudged scan (ink damage simulation) ─────────────────

DEMO_DEGRADED = ScanResult(
    scanId="SCN-DEMO-DEGRADED-001",
    fileName="satbara_sinnar_098_smudged.jpg",
    fileSizeKB=631.7,
    ipfsCID="QmSatbaraSNNSurvey098Degraded2026",
    processingSteps=[
        {
            "step": "UPLOAD",
            "label": "Document uploaded",
            "status": "done",
            "durationMs": 298,
        },
        {
            "step": "AZURE_OCR",
            "label": "Azure Document Intelligence OCR",
            "detail": "Ink damage detected in Zone 3. Partial text recovered (61% coverage).",
            "confidence": 0.61,
            "status": "done",
            "durationMs": 2140,
        },
        {
            "step": "LAYOUT_LM_NER",
            "label": "LayoutLM NER — field extraction",
            "detail": "11 of 18 expected entities extracted. Area and encumbrance fields unclear.",
            "confidence": 0.58,
            "status": "partial",
            "durationMs": 2890,
        },
        {
            "step": "VALIDATION",
            "label": "Cross-validation against Mahabhulekh registry",
            "detail": "Survey No. 98 found in district records — owner name partially matches.",
            "confidence": 0.72,
            "status": "partial",
            "durationMs": 720,
        },
        {
            "step": "IPFS",
            "label": "Document pinned to IPFS",
            "detail": "CID: QmSatbaraSNNSurvey098Degraded2026",
            "status": "done",
            "durationMs": 285,
        },
    ],
    extraction=SatbaraExtraction(
        districtName="Nashik",
        tehsilName="Sinnar",
        villageName="[UNCLEAR — ink damage]",
        surveyNumber="98",
        subdivisionNumber=None,
        totalAreaHectares=1.2,        # uncertain — area field partially legible
        landType=LandType.JIRAYAT,
        owners=[
            SatbaraOwner(
                name="Vitthal [PARTIAL] Shinde",
                fatherHusbandName=None,
                share="Full",
                ownershipType="Individual",
            )
        ],
        hasJointOwnership=False,
        hasCoparcenary=False,
        encumbrances=[
            SatbaraEncumbrance(
                type="Mortgage",
                creditorName="[UNCLEAR]",
                amount=None,
                date=None,
                remarks="Partial ink — amount and creditor illegible",
            )
        ],
        currentCultivator="[UNCLEAR]",
        cropDetails=None,
        possessionType="Self",
        surveyDate="2011-08-22",
        ocrConfidence=0.61,
        nerConfidence=0.58,
        overallConfidence=0.60,
        flaggedFields=[
            "villageName",
            "ownerName (partial)",
            "encumbranceAmount",
            "totalAreaHectares (low confidence)",
        ],
        requiresManualReview=True,
    ),
    suggestedDlpiId="DLPI-MH-SNN-00098",
    processingTimeMs=6333,
)

MOCK_RESPONSES = {
    "demo_clear":    DEMO_CLEAR,
    "demo_degraded": DEMO_DEGRADED,
}
