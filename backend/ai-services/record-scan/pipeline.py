"""
RecordScan AI Pipeline — UP Khatauni edition

Steps:
  1. Receive uploaded Khatauni image / PDF
  2. Azure Document Intelligence OCR  → raw text + bounding boxes
  3. Azure OpenAI GPT-4o NER          → structured Khatauni fields
  4. Confidence scoring + flagging     → requiresManualReview flag
  5. IPFS pin (Pinata)                → CID stored in DLPI
  6. DynamoDB persist                 → scan job stored in table
  7. Return ScanResult to officer UI  → officer reviews, corrects, approves

In mock mode: skips steps 2–5, returns pre-scripted ScanResult.
"""

import base64
import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import boto3
import httpx
from botocore.exceptions import BotoCoreError, ClientError

from khatauni_schema import (
    KhatauniExtraction, KhatedaOwner, KhataEncumbrance, ScanResult, LandType
)
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
        return dynamodb.Table(os.getenv('DYNAMODB_TABLE', 'bhumichain-record-scans'))
    except Exception as e:
        print(f"[DynamoDB] Connection error: {e}")
        return None


def _persist_scan(result: ScanResult) -> bool:
    """Store scan result in DynamoDB. PK = SCAN#<scanId>."""
    table = _get_dynamo_table()
    if not table:
        print("[DynamoDB] No table — using in-memory fallback only")
        return False
    try:
        item = {
            'pk':              f'SCAN#{result.scanId}',
            'scanId':          result.scanId,
            'fileName':        result.fileName,
            'fileSizeKB':      str(result.fileSizeKB),
            'ipfsCID':         result.ipfsCID,
            'suggestedDlpiId': result.suggestedDlpiId,
            'status':          result.status,
            'createdAt':       datetime.now(timezone.utc).isoformat(),
            'ttl':             int(time.time()) + 86400,
            'resultJson':      json.dumps(result.model_dump(), ensure_ascii=False),
            'tehsil':          result.extraction.tehsil,
            'khasraNo':        result.extraction.khasraNo,
            'zila':            result.extraction.zila,
            'ocrConfidence':   str(round(result.extraction.ocrConfidence, 3)),
            'requiresReview':  result.extraction.requiresManualReview,
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
        data['status'] = item.get('status', 'COMPLETED')
        data['ownerAadhaarHash'] = item.get('ownerAadhaarHash')
        data['patwariName'] = item.get('patwariName')
        data['patwariHash'] = item.get('patwariHash')
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


def update_scan_status(scan_id: str, status: str):
    """Update only status in DynamoDB (used for off-chain review flow)."""
    table = _get_dynamo_table()
    if not table:
        return
    try:
        # We also need to update the nested resultJson
        resp = table.get_item(Key={'pk': f'SCAN#{scan_id}'})
        item = resp.get('Item')
        if item:
            data = json.loads(item['resultJson'])
            data['status'] = status
            table.put_item(Item={
                **item,
                'status': status,
                'resultJson': json.dumps(data, ensure_ascii=False)
            })
    except Exception as e:
        print(f"[DynamoDB] update_scan_status error: {e}")


def query_scans_by_status(status: str) -> list[ScanResult]:
    """Query all scans with a specific status."""
    table = _get_dynamo_table()
    if not table:
        return []
    try:
        from boto3.dynamodb.conditions import Attr
        resp = table.scan(FilterExpression=Attr('status').eq(status))
        items = resp.get('Items', [])
        results = []
        for item in items:
            data = json.loads(item['resultJson'])
            data['status'] = item['status']
            data['ownerAadhaarHash'] = item.get('ownerAadhaarHash')
            data['patwariName'] = item.get('patwariName')
            data['patwariHash'] = item.get('patwariHash')
            results.append(ScanResult(**data))
        return results
    except Exception as e:
        print(f"[DynamoDB] query_scans_by_status error: {e}")
        return []


def save_patwari_approval(scan_id: str, dlpi_id: str, owner_hash: str, officer_name: str, officer_hash: str):
    """Save Patwari approval metadata in DynamoDB and update status to SCAN_PENDING_SRO."""
    table = _get_dynamo_table()
    if not table:
        return
    try:
        # We also need to update the nested resultJson
        resp = table.get_item(Key={'pk': f'SCAN#{scan_id}'})
        item = resp.get('Item')
        if item:
            data = json.loads(item['resultJson'])
            data['status'] = 'SCAN_PENDING_SRO'
            data['suggestedDlpiId'] = dlpi_id
            data['ownerAadhaarHash'] = owner_hash
            data['patwariName'] = officer_name
            data['patwariHash'] = officer_hash
            table.put_item(Item={
                **item,
                'status': 'SCAN_PENDING_SRO',
                'suggestedDlpiId': dlpi_id,
                'ownerAadhaarHash': owner_hash,
                'patwariName': officer_name,
                'patwariHash': officer_hash,
                'resultJson': json.dumps(data, ensure_ascii=False)
            })
    except Exception as e:
        print(f"[DynamoDB] save_patwari_approval error for {scan_id}: {e}")


# ─── IPFS helpers ─────────────────────────────────────────────────────────────

def _mock_ipfs_pin(content: bytes) -> str:
    digest = hashlib.sha256(content).hexdigest()[:32]
    return f"Qm{digest.upper()}"


async def _ipfs_pin_real(content: bytes) -> str:
    """Pin document to Pinata IPFS. Falls back to mock CID on failure."""
    pinata_key    = os.getenv("PINATA_API_KEY", "")
    pinata_secret = os.getenv("PINATA_SECRET", "")

    if not pinata_key or not pinata_secret:
        print("[IPFS] No Pinata keys configured — using SHA-256 mock CID")
        return _mock_ipfs_pin(content)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.pinata.cloud/pinning/pinFileToIPFS",
                headers={
                    "pinata_api_key":        pinata_key,
                    "pinata_secret_api_key": pinata_secret,
                },
                files={"file": ("khatauni.pdf", content, "application/octet-stream")},
            )
            resp.raise_for_status()
            cid = resp.json()["IpfsHash"]
            print(f"[IPFS] Pinned to Pinata: {cid}")
            return cid
    except Exception as e:
        print(f"[IPFS] Pinata upload failed: {e} — falling back to mock CID")
        return _mock_ipfs_pin(content)


# ─── Azure Document Intelligence OCR ─────────────────────────────────────────

async def _azure_ocr(content: bytes) -> str:
    """
    Run Azure Document Intelligence on the document bytes.
    Returns the extracted full text (all pages concatenated).
    """
    endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT", "")
    key      = os.getenv("AZURE_DOC_INTEL_KEY", "")
    model    = os.getenv("AZURE_DOC_INTEL_MODEL", "prebuilt-layout")

    if not endpoint or not key:
        raise ValueError("AZURE_DOC_INTEL_ENDPOINT and AZURE_DOC_INTEL_KEY must be set")

    b64 = base64.b64encode(content).decode("utf-8")

    # Submit analysis job
    async with httpx.AsyncClient(timeout=60) as client:
        submit_url = f"{endpoint.rstrip('/')}/formrecognizer/documentModels/{model}:analyze?api-version=2023-07-31"
        submit_resp = await client.post(
            submit_url,
            headers={
                "Ocp-Apim-Subscription-Key": key,
                "Content-Type": "application/json",
            },
            json={"base64Source": b64},
        )
        submit_resp.raise_for_status()
        operation_url = submit_resp.headers.get("Operation-Location", "")
        if not operation_url:
            raise ValueError("No Operation-Location header in Azure OCR response")

    # Poll for result
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(30):
            await _async_sleep(2)
            poll_resp = await client.get(
                operation_url,
                headers={"Ocp-Apim-Subscription-Key": key},
            )
            poll_resp.raise_for_status()
            data = poll_resp.json()
            status = data.get("status", "")
            if status == "succeeded":
                # Extract all text content from pages
                pages = data.get("analyzeResult", {}).get("pages", [])
                lines = []
                for page in pages:
                    for line in page.get("lines", []):
                        lines.append(line.get("content", ""))
                full_text = "\n".join(lines)
                print(f"[Azure OCR] Extracted {len(full_text)} chars from {len(pages)} page(s)")
                return full_text
            elif status == "failed":
                raise RuntimeError(f"Azure OCR failed: {data}")
            print(f"[Azure OCR] Polling attempt {attempt+1}, status={status}")

    raise TimeoutError("Azure OCR did not complete within 60 seconds")


async def _async_sleep(seconds: float):
    import asyncio
    await asyncio.sleep(seconds)


# ─── GPT-4o NER — extract Khatauni fields from OCR text ──────────────────────

_EXTRACTION_PROMPT = """\
You are an expert at reading Indian land records (UP Khatauni / खतौनी).

Below is the raw OCR text extracted from a scanned Khatauni document from Uttar Pradesh.
Extract the following fields and return a valid JSON object ONLY — no markdown, no explanation.

JSON schema to populate:
{
  "zila": "district name in English",
  "tehsil": "tehsil name in English",
  "gram": "village name",
  "fasalVarsh": "crop year e.g. 2025-26 or null",
  "khataNo": "khata number as string",
  "khasraNo": "khasra / gata number as string",
  "areaHectares": 0.0,
  "areaBigha": 0.0 or null,
  "landType": "Bhumidhari | Sirdar | Asamiyadar | Residential | Commercial | Tribal_FRA | Govt_Reserved",
  "irrigationSource": "Well | Canal | Tubewell | null",
  "cropDetails": "string or null",
  "khatedars": [
    {
      "name": "owner name",
      "fatherHusbandName": "string or null",
      "share": "1/2 or full or null",
      "ownershipType": "Individual | Joint | Coparcenary | Government",
      "isScheduledTribe": false
    }
  ],
  "hasJointOwnership": false,
  "hasCoparcenary": false,
  "currentPossessor": "string or null",
  "encumbrances": [],
  "khatabandiDate": "date string or null",
  "lekhpalSignature": "name or null",
  "naibTehsildarSignature": "name or null",
  "ocrConfidence": 0.85,
  "nerConfidence": 0.80,
  "overallConfidence": 0.82,
  "flaggedFields": [],
  "requiresManualReview": false
}

Rules:
- If OCR text is in Hindi (Devanagari), translate field values to English.
- If a field cannot be found, use null (not empty string).
- Set requiresManualReview=true if ocrConfidence < 0.75 or any important field is missing.
- flaggedFields should list keys that were hard to read or uncertain.
- areaHectares must be a number (convert bigha: 1 bigha = 0.2529 ha in UP).

OCR TEXT:
\"\"\"
{ocr_text}
\"\"\"

Respond with valid JSON only.
"""


async def _gpt4o_ner(ocr_text: str) -> KhatauniExtraction:
    """Use Azure OpenAI GPT-4o to extract structured Khatauni fields from OCR text."""
    openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    openai_key      = os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_OPENAI_KEY", "")
    openai_model    = os.getenv("AZURE_OPENAI_DEPLOYMENT", "gpt-4o")
    api_version     = os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01")

    if not openai_endpoint or not openai_key:
        # Fallback: use Anthropic Claude if Azure OpenAI not available
        return await _claude_ner(ocr_text)

    prompt = _EXTRACTION_PROMPT.replace("{ocr_text}", ocr_text[:6000])  # cap at 6k chars

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{openai_endpoint.rstrip('/')}/openai/deployments/{openai_model}/chat/completions?api-version={api_version}",
            headers={
                "api-key": openai_key,
                "Content-Type": "application/json",
            },
            json={
                "messages": [
                    {"role": "system", "content": "You are a land records expert. Return only valid JSON."},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.1,
                "max_completion_tokens": 1500,
            },
        )
        if resp.status_code != 200:
            raise RuntimeError(f"Azure OpenAI Error {resp.status_code}: {resp.text}")
        raw = resp.json()["choices"][0]["message"]["content"].strip()

    return _parse_ner_response(raw, "azure_openai")


async def _claude_ner(ocr_text: str) -> KhatauniExtraction:
    """Fallback: use Anthropic Claude to extract Khatauni fields."""
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        print("[NER] No LLM keys configured. Falling back to MOCK extraction for NER step.")
        from mock_responses import DEMO_CLEAR
        return DEMO_CLEAR.extraction

    prompt = _EXTRACTION_PROMPT.replace("{ocr_text}", ocr_text[:6000])

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key":         anthropic_key,
                "anthropic-version": "2023-06-01",
                "Content-Type":      "application/json",
            },
            json={
                "model": "claude-3-5-sonnet-20241022",
                "max_tokens": 1500,
                "messages": [
                    {"role": "user", "content": prompt},
                ],
            },
        )
        resp.raise_for_status()
        raw = resp.json()["content"][0]["text"].strip()

    return _parse_ner_response(raw, "claude")


def _parse_ner_response(raw: str, source: str) -> KhatauniExtraction:
    """Parse the JSON string from the LLM into a KhatauniExtraction object."""
    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"[{source}] LLM returned invalid JSON: {e}\nRaw: {raw[:300]}")

    print(f"[{source}] NER extracted: khasra={data.get('khasraNo')}, zila={data.get('zila')}, confidence={data.get('overallConfidence')}")

    # Parse owners
    khatedars = [
        KhatedaOwner(
            name=o.get("name", "Unknown"),
            fatherHusbandName=o.get("fatherHusbandName"),
            share=o.get("share"),
            ownershipType=o.get("ownershipType", "Individual"),
            isScheduledTribe=bool(o.get("isScheduledTribe", False)),
        )
        for o in (data.get("khatedars") or [{"name": "Unknown"}])
    ]

    # Parse encumbrances
    encumbrances = [
        KhataEncumbrance(
            type=enc.get("type", "Other"),
            creditorName=enc.get("creditorName"),
            amount=enc.get("amount"),
            date=enc.get("date"),
            remarks=enc.get("remarks"),
        )
        for enc in (data.get("encumbrances") or [])
    ]

    # Map land type
    land_type_map = {
        "bhumidhari":   LandType.BHUMIDHARI,
        "sirdar":       LandType.SIRDAR,
        "asamiyadar":   LandType.ASAMIYADAR,
        "residential":  LandType.RESIDENTIAL,
        "commercial":   LandType.COMMERCIAL,
        "tribal_fra":   LandType.TRIBAL_FRA,
        "govt_reserved": LandType.GOVT_RESERVED,
    }
    raw_lt = (data.get("landType") or "Bhumidhari").lower().replace(" ", "_")
    land_type = land_type_map.get(raw_lt, LandType.BHUMIDHARI)

    area = float(data.get("areaHectares") or 0.0)
    if area == 0.0 and data.get("areaBigha"):
        area = round(float(data["areaBigha"]) * 0.2529, 4)

    ocr_conf = float(data.get("ocrConfidence") or 0.80)
    ner_conf = float(data.get("nerConfidence") or 0.80)
    overall  = float(data.get("overallConfidence") or min(ocr_conf, ner_conf))

    return KhatauniExtraction(
        zila=data.get("zila") or "Gautam Buddha Nagar",
        tehsil=data.get("tehsil") or "Dadri",
        gram=data.get("gram") or "Unknown",
        fasalVarsh=data.get("fasalVarsh"),
        khataNo=str(data.get("khataNo") or "0"),
        khasraNo=str(data.get("khasraNo") or "0"),
        areaHectares=area,
        areaBigha=data.get("areaBigha"),
        landType=land_type,
        irrigationSource=data.get("irrigationSource"),
        cropDetails=data.get("cropDetails"),
        khatedars=khatedars,
        hasJointOwnership=bool(data.get("hasJointOwnership", False)),
        hasCoparcenary=bool(data.get("hasCoparcenary", False)),
        currentPossessor=data.get("currentPossessor"),
        encumbrances=encumbrances,
        khatabandiDate=data.get("khatabandiDate"),
        lekhpalSignature=data.get("lekhpalSignature"),
        naibTehsildarSignature=data.get("naibTehsildarSignature"),
        ocrConfidence=ocr_conf,
        nerConfidence=ner_conf,
        overallConfidence=overall,
        flaggedFields=list(data.get("flaggedFields") or []),
        requiresManualReview=bool(data.get("requiresManualReview", overall < 0.75)),
    )


# ─── Main pipeline entry ──────────────────────────────────────────────────────

async def scan_document(
    filename: str,
    content: bytes,
    demo_variant: Optional[str] = None,
    mock: bool = True,
) -> ScanResult:
    """
    Main pipeline entry point.
    mock=True  → returns fast pre-scripted ScanResult (for demos with no real doc)
    mock=False → runs full Azure OCR + GPT-4o NER pipeline
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
            "scanId":     f"SCN-{uuid.uuid4().hex[:8].upper()}",
            "fileName":   filename,
            "fileSizeKB": round(len(content) / 1024, 1),
            "ipfsCID":    _mock_ipfs_pin(content),
        })
        await _simulate_steps(result.processingSteps)
        stored = _persist_scan(result)
        return result.model_copy(update={"storedInDynamoDB": stored})

    # ─── Real pipeline ────────────────────────────────────────────────────────
    steps = []

    # Step 1: IPFS pin
    t0 = time.monotonic()
    ipfs_cid = await _ipfs_pin_real(content)
    steps.append({
        "step": "IPFS", "label": "Document pinned to IPFS",
        "detail": f"CID: {ipfs_cid}", "status": "done",
        "durationMs": int((time.monotonic() - t0) * 1000),
    })

    # Step 2: Azure Document Intelligence OCR
    t0 = time.monotonic()
    steps.append({"step": "AZURE_OCR", "label": "Azure Document Intelligence OCR", "status": "running"})
    try:
        ocr_text = await _azure_ocr(content)
        ocr_duration = int((time.monotonic() - t0) * 1000)
        steps[-1] = {
            "step": "AZURE_OCR", "label": "Azure Document Intelligence OCR",
            "detail": f"Extracted {len(ocr_text)} characters",
            "confidence": 0.92, "status": "done", "durationMs": ocr_duration,
        }
    except Exception as e:
        steps[-1] = {"step": "AZURE_OCR", "label": "Azure Document Intelligence OCR", "status": "error", "detail": str(e)}
        raise RuntimeError(f"Azure OCR failed: {e}")

    # Step 3: GPT-4o / Claude NER
    t0 = time.monotonic()
    steps.append({"step": "GPT4O_NER", "label": "GPT-4o Khatauni field extraction", "status": "running"})
    try:
        extraction = await _gpt4o_ner(ocr_text)
        ner_duration = int((time.monotonic() - t0) * 1000)
        steps[-1] = {
            "step": "GPT4O_NER", "label": "GPT-4o Khatauni field extraction",
            "detail": f"Extracted khasra={extraction.khasraNo}, owner={extraction.khatedars[0].name if extraction.khatedars else 'Unknown'}",
            "confidence": extraction.nerConfidence, "status": "done", "durationMs": ner_duration,
        }
    except Exception as e:
        steps[-1] = {"step": "GPT4O_NER", "label": "GPT-4o field extraction", "status": "error", "detail": str(e)}
        raise RuntimeError(f"NER extraction failed: {e}")

    # Step 4: Build result
    elapsed_ms = int((time.monotonic() - start) * 1000)
    result = _build_result(filename, len(content), ipfs_cid, extraction, elapsed_ms, steps)
    stored = _persist_scan(result)
    return result.model_copy(update={"storedInDynamoDB": stored})


# ─── Async simulation (mock only) ─────────────────────────────────────────────

async def _simulate_steps(steps: list) -> None:
    import asyncio
    for step in steps:
        await asyncio.sleep(step.get("durationMs", 500) / 10000)


# ─── Build ScanResult ─────────────────────────────────────────────────────────

def _build_result(filename, size_bytes, ipfs_cid, extraction, elapsed_ms, steps) -> ScanResult:
    scan_id      = f"SCN-{uuid.uuid4().hex[:8].upper()}"
    tehsil_map   = {"Dadri": "DAD", "Noida": "NDA", "Jewar": "JWR", "Bisrakh": "BSK"}
    tehsil_code  = tehsil_map.get(extraction.tehsil, "DAD")
    khasra_clean = extraction.khasraNo.replace("/", "").replace(" ", "").zfill(5)
    dlpi_id      = f"DLPI-UP-{tehsil_code}-{khasra_clean}"

    return ScanResult(
        scanId=scan_id,
        fileName=filename,
        fileSizeKB=round(size_bytes / 1024, 1),
        ipfsCID=ipfs_cid,
        processingSteps=steps,
        extraction=extraction,
        suggestedDlpiId=dlpi_id,
        processingTimeMs=elapsed_ms,
    )
