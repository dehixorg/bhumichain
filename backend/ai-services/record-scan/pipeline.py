"""
RecordScan AI Pipeline
Steps:
  1. Receive uploaded image (JPEG/PNG/PDF)
  2. Azure Document Intelligence OCR  → raw text + bounding boxes
  3. LayoutLM NER                     → structured Satbara fields
  4. Cross-validation vs Mahabhulekh  → confidence boost / flag
  5. IPFS pin                         → CID stored in DLPI
  6. Return ScanResult to officer UI  → officer reviews, corrects, approves

In mock mode: skips steps 2-4 and returns pre-scripted ScanResult.
"""

import hashlib
import os
import time
import uuid
from typing import Optional

from satbara_schema import SatbaraExtraction, ScanResult, SatbaraOwner, LandType
from mock_responses import MOCK_RESPONSES, DEMO_CLEAR


def _mock_ipfs_pin(content: bytes) -> str:
    """Return deterministic mock IPFS CID based on content hash."""
    digest = hashlib.sha256(content).hexdigest()[:32]
    return f"Qm{digest.upper()}"


async def scan_document(
    filename: str,
    content: bytes,
    demo_variant: Optional[str] = None,
    mock: bool = True,
) -> ScanResult:
    """
    Main pipeline entry point.
    demo_variant: "demo_clear" | "demo_degraded" | None (auto-select by filename)
    """
    start = time.monotonic()

    if mock:
        # Auto-select variant: if filename contains "smudge" or "degrad" → degraded
        variant = demo_variant
        if not variant:
            name_lower = filename.lower()
            if any(k in name_lower for k in ["smudge", "degrad", "damage", "old", "faded"]):
                variant = "demo_degraded"
            else:
                variant = "demo_clear"

        result = MOCK_RESPONSES.get(variant, DEMO_CLEAR)
        # Update with actual uploaded filename and a fresh scanId
        result = result.model_copy(update={
            "scanId": f"SCN-{uuid.uuid4().hex[:8].upper()}",
            "fileName": filename,
            "fileSizeKB": round(len(content) / 1024, 1),
            "ipfsCID": _mock_ipfs_pin(content),
        })
        # Simulate processing delay in mock (realistic for demo)
        await _simulate_steps(result.processingSteps)
        return result

    # ─── Real pipeline ────────────────────────────────────────────────────────
    # Step 1: IPFS pin
    ipfs_cid = await _ipfs_pin_real(content)

    # Step 2: Azure Document Intelligence
    ocr_result = await _azure_ocr(content)

    # Step 3: LayoutLM NER
    ner_result = await _layoutlm_ner(ocr_result)

    # Step 4: Mahabhulekh cross-validation
    validated = await _mahabhulekh_validate(ner_result)

    elapsed_ms = int((time.monotonic() - start) * 1000)
    return _build_result(filename, len(content), ipfs_cid, validated, elapsed_ms)


async def _simulate_steps(steps: list) -> None:
    """In mock mode, sleep proportional to each step's durationMs so the UI
    progress bar advances realistically during the demo."""
    import asyncio
    for step in steps:
        # Scale down 10× so 5s pipeline feels like ~0.5s in demo
        await asyncio.sleep(step.get("durationMs", 500) / 10000)


async def _ipfs_pin_real(content: bytes) -> str:
    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{os.getenv('IPFS_GATEWAY', 'http://localhost:5001')}/api/v0/add",
            files={"file": content},
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()["Hash"]


async def _azure_ocr(content: bytes) -> dict:
    """Call Azure Document Intelligence prebuilt-document model."""
    from azure.ai.documentintelligence import DocumentIntelligenceClient  # type: ignore
    from azure.core.credentials import AzureKeyCredential              # type: ignore

    client = DocumentIntelligenceClient(
        endpoint=os.getenv("AZURE_DOC_INTEL_ENDPOINT", ""),
        credential=AzureKeyCredential(os.getenv("AZURE_DOC_INTEL_KEY", "")),
    )
    poller = client.begin_analyze_document(
        model_id=os.getenv("AZURE_DOC_INTEL_MODEL", "prebuilt-document"),
        analyze_request={"base64Source": content},
    )
    return poller.result().as_dict()


async def _layoutlm_ner(ocr_result: dict) -> SatbaraExtraction:
    """
    Run LayoutLM NER over OCR result to extract Satbara fields.
    Placeholder — real implementation uses azure-ml endpoint or local model.
    """
    raise NotImplementedError(
        "LayoutLM NER not yet deployed. Set RECORD_SCAN_MODE=mock for demo."
    )


async def _mahabhulekh_validate(extraction: SatbaraExtraction) -> SatbaraExtraction:
    """Cross-check extracted fields against Mahabhulekh e-Satbara API."""
    raise NotImplementedError(
        "Mahabhulekh API integration pending. Set RECORD_SCAN_MODE=mock for demo."
    )


def _build_result(filename, size_bytes, ipfs_cid, extraction, elapsed_ms) -> ScanResult:
    scan_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"
    tehsil_code = {"Sinnar": "SNN", "Igatpuri": "IGT", "Nashik": "NSK"}.get(
        extraction.tehsilName, "NSK"
    )
    survey_clean = extraction.surveyNumber.replace("/", "").zfill(5)
    dlpi_id = f"DLPI-MH-{tehsil_code}-{survey_clean}"

    return ScanResult(
        scanId=scan_id,
        fileName=filename,
        fileSizeKB=round(size_bytes / 1024, 1),
        ipfsCID=ipfs_cid,
        processingSteps=[],
        extraction=extraction,
        suggestedDlpiId=dlpi_id,
        processingTimeMs=elapsed_ms,
    )
