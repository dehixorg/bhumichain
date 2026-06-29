"""
RecordScan AI Pipeline — UP Khatauni edition

Steps:
  1. Receive uploaded Khatauni image / PDF
  2. Azure Document Intelligence OCR  → raw text + bounding boxes
  3. LayoutLM NER                     → structured Khatauni fields
  4. Cross-validation vs Bhulekh UP  → confidence boost / flag
  5. IPFS pin                         → CID stored in DLPI
  6. DynamoDB persist                 → scan job stored in testArpit table
  7. Return ScanResult to officer UI  → officer reviews, corrects, approves

In mock mode: skips steps 2–5, returns pre-scripted ScanResult.
"""

import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from khatauni_schema import KhatauniExtraction, ScanResult, KhatedaOwner, LandType
from mock_responses import MOCK_RESPONSES, DEMO_CLEAR

# ─── DynamoDB client ──────────────────────────────────────────────────────────

def _get_dynamo_table():
    try:
        dynamodb = boto3.resource(
            'dynamodb',
            region_name=os.getenv('AWS_REGION', 'ap-south-1'),
            aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
            aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
        )
        return dynamodb.Table(os.getenv('DYNAMODB_TABLE', 'testArpit'))
    except Exception as e:
        print(f"[DynamoDB] Connection error: {e}")
        return None


def _persist_scan(result: ScanResult) -> bool:
    """Store scan result in DynamoDB testArpit table. PK = SCAN#<scanId>."""
    table = _get_dynamo_table()
    if not table:
        return False
    try:
        item = {
            'pk':            f'SCAN#{result.scanId}',
            'scanId':        result.scanId,
            'fileName':      result.fileName,
            'fileSizeKB':    str(result.fileSizeKB),
            'ipfsCID':       result.ipfsCID,
            'suggestedDlpiId': result.suggestedDlpiId,
            'status':        'COMPLETED',
            'createdAt':     datetime.now(timezone.utc).isoformat(),
            # TTL: 24 hours from now (Unix epoch)
            'ttl':           int(time.time()) + 86400,
            # Full result as compressed JSON string
            'resultJson':    json.dumps(result.model_dump(), ensure_ascii=False),
            # Extracted summary fields for quick querying
            'tehsil':        result.extraction.tehsil,
            'khasraNo':      result.extraction.khasraNo,
            'zila':          result.extraction.zila,
            'ocrConfidence': str(round(result.extraction.ocrConfidence, 3)),
            'requiresReview': result.extraction.requiresManualReview,
        }
        table.put_item(Item=item)
        return True
    except (BotoCoreError, ClientError) as e:
        print(f"[DynamoDB] put_item error: {e}")
        return False


def retrieve_scan(scan_id: str) -> Optional[ScanResult]:
    """Fetch scan result from DynamoDB by scanId."""
    table = _get_dynamo_table()
    if not table:
        return None
    try:
        resp = table.get_item(Key={'pk': f'SCAN#{scan_id}'})
        item = resp.get('Item')
        if not item:
            return None
        data = json.loads(item['resultJson'])
        return ScanResult(**data)
    except (BotoCoreError, ClientError, json.JSONDecodeError, Exception) as e:
        print(f"[DynamoDB] get_item error for {scan_id}: {e}")
        return None


def mark_scan_approved(scan_id: str, dlpi_id: str):
    """Update scan status to APPROVED in DynamoDB."""
    table = _get_dynamo_table()
    if not table:
        return
    try:
        table.update_item(
            Key={'pk': f'SCAN#{scan_id}'},
            UpdateExpression='SET #s = :s, approvedDlpiId = :d, approvedAt = :a',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':s': 'APPROVED',
                ':d': dlpi_id,
                ':a': datetime.now(timezone.utc).isoformat(),
            },
        )
    except (BotoCoreError, ClientError) as e:
        print(f"[DynamoDB] update_item error for {scan_id}: {e}")


# ─── IPFS mock ────────────────────────────────────────────────────────────────

def _mock_ipfs_pin(content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()[:32]
    return f"Qm{digest.upper()}"


# ─── Main pipeline entry ──────────────────────────────────────────────────────

async def scan_document(
    filename: str,
    content: bytes,
    demo_variant: Optional[str] = None,
    mock: bool = True,
) -> ScanResult:
    """
    Main pipeline entry point.
    demo_variant: "demo_clear" | "demo_degraded" | None (auto-detect from filename)
    Returns ScanResult (persisted to DynamoDB).
    """
    start = time.monotonic()

    if mock:
        variant = demo_variant
        if not variant:
            fname = filename.lower()
            if any(k in fname for k in ["smudge", "degrad", "damage", "old", "faded", "torn", "1994", "1980"]):
                variant = "demo_degraded"
            else:
                variant = "demo_clear"

        template = MOCK_RESPONSES.get(variant, DEMO_CLEAR)
        result = template.model_copy(update={
            "scanId":      f"SCN-{uuid.uuid4().hex[:8].upper()}",
            "fileName":    filename,
            "fileSizeKB":  round(len(content) / 1024, 1),
            "ipfsCID":     _mock_ipfs_pin(content),
        })

        await _simulate_steps(result.processingSteps)
        stored = _persist_scan(result)
        result = result.model_copy(update={"storedInDynamoDB": stored})
        return result

    # ─── Real pipeline ────────────────────────────────────────────────────────

    ipfs_cid  = await _ipfs_pin_real(content)
    ocr_result = await _azure_ocr(content)
    ner_result = await _layoutlm_ner(ocr_result)
    validated  = await _bhulekh_validate(ner_result)

    elapsed_ms = int((time.monotonic() - start) * 1000)
    result     = _build_result(filename, len(content), ipfs_cid, validated, elapsed_ms)
    stored     = _persist_scan(result)
    result     = result.model_copy(update={"storedInDynamoDB": stored})
    return result


# ─── Async simulation ─────────────────────────────────────────────────────────

async def _simulate_steps(steps: list) -> None:
    import asyncio
    for step in steps:
        await asyncio.sleep(step.get("durationMs", 500) / 10000)


# ─── Real pipeline stubs ──────────────────────────────────────────────────────

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
    from azure.ai.documentintelligence import DocumentIntelligenceClient    # type: ignore
    from azure.core.credentials import AzureKeyCredential                   # type: ignore
    client = DocumentIntelligenceClient(
        endpoint=os.getenv("AZURE_DOC_INTEL_ENDPOINT", ""),
        credential=AzureKeyCredential(os.getenv("AZURE_DOC_INTEL_KEY", "")),
    )
    poller = client.begin_analyze_document(
        model_id=os.getenv("AZURE_DOC_INTEL_MODEL", "prebuilt-document"),
        analyze_request={"base64Source": content},
    )
    return poller.result().as_dict()


async def _layoutlm_ner(ocr_result: dict) -> KhatauniExtraction:
    raise NotImplementedError("LayoutLM NER not yet deployed. Set RECORD_SCAN_MODE=mock.")


async def _bhulekh_validate(extraction: KhatauniExtraction) -> KhatauniExtraction:
    raise NotImplementedError("Bhulekh UP API integration pending. Set RECORD_SCAN_MODE=mock.")


def _build_result(filename, size_bytes, ipfs_cid, extraction, elapsed_ms) -> ScanResult:
    scan_id    = f"SCN-{uuid.uuid4().hex[:8].upper()}"
    tehsil_map = {"Dadri": "DAD", "Noida": "NDA", "Jewar": "JWR", "Bisrakh": "BSK"}
    tehsil_code = tehsil_map.get(extraction.tehsil, "DAD")
    khasra_clean = extraction.khasraNo.replace("/", "").replace(" ", "").zfill(5)
    dlpi_id     = f"DLPI-UP-{tehsil_code}-{khasra_clean}"

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
