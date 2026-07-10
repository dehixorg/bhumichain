"""
RecordScan AI Service — FastAPI app (UP Khatauni edition)
Port 8010

Endpoints:
  POST /scan/upload         — Upload Khatauni image → returns ScanResult (stored in DynamoDB)
  POST /scan/approve        — Officer approves → POSTs DLPI to API Gateway
  GET  /scan/{scanId}       — Retrieve a scan (checks DynamoDB first, falls back to memory)
  GET  /scan/demo/image-list — Demo image variants for presenter
  GET  /health
"""

import os
import uuid
import json
import httpx
from typing import Optional
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(env_path, override=True)

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from khatauni_schema import ScanResult, KhatauniExtraction
from pipeline import scan_document, retrieve_scan, mark_scan_approved, update_scan_status, query_scans_by_status, save_patwari_approval, _load_local_db, _get_dynamo_table

MOCK        = os.getenv("RECORD_SCAN_MODE", "mock") == "mock"
API_GATEWAY = os.getenv("API_GATEWAY_URL", "http://localhost:4000")

# In-memory fallback (if DynamoDB is unreachable)
_scan_cache: dict[str, ScanResult] = {}

app = FastAPI(
    title="BhumiChain RecordScan AI",
    description="UP Khatauni OCR + NER pipeline. Azure Document Intelligence + LayoutLM + DynamoDB.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    print(f"Global Error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"error": "INTERNAL_SERVER_ERROR", "detail": str(exc)},
    )


@app.get("/health")
def health():
    return {
        "status":    "ok",
        "mode":      "mock" if MOCK else "real",
        "port":      8010,
        "state":     "UP Khatauni (खतौनी)",
        "dynamo":    os.getenv("DYNAMODB_TABLE", "testArpit"),
        "region":    os.getenv("AWS_REGION", "ap-south-1"),
    }


# ─── POST /scan/upload ────────────────────────────────────────────────────────

@app.post("/scan/upload", response_model=ScanResult)
async def upload_scan(
    file: UploadFile = File(...),
    demoVariant: Optional[str] = Form(None),
):
    """
    Accept a Khatauni image or PDF (JPEG/PNG/TIFF/PDF).
    Runs OCR + NER pipeline. Persists result to DynamoDB testArpit.
    Returns ScanResult to officer for review.
    """
    allowed = {"image/jpeg", "image/png", "image/tiff", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Accepted: JPEG, PNG, TIFF, PDF.",
        )

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File too large. Max 20 MB.")

    force_mock = MOCK or (demoVariant is not None)

    result = await scan_document(
        filename=file.filename or "upload.jpg",
        content=content,
        demo_variant=demoVariant,
        mock=force_mock,
    )

    _scan_cache[result.scanId] = result
    return result


# ─── POST /scan/approve ───────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    scanId:             str
    dlpiId:             str
    officerAadhaarHash: str
    ownerAadhaarHash:   str
    officerName:        str
    correctedFields:    Optional[dict] = None
    token:              str


@app.post("/scan/approve")
async def approve_scan(req: ApproveRequest, background: BackgroundTasks):
    """
    Patwari reviews and submits scan for Kanungo (SRO) review.
    Saves metadata to DynamoDB and transitions status to SCAN_PENDING_SRO off-chain.
    """
    result = retrieve_scan(req.scanId) or _scan_cache.get(req.scanId)
    if not result:
        print(f"Scan {req.scanId} not found in cache. Creating mock result for external scan.")
        result = ScanResult(
            scanId=req.scanId,
            fileName="external-doc.pdf",
            fileSizeKB=0,
            ipfsCID="QmPending",
            processingSteps=[],
            extraction={},
            suggestedDlpiId=req.dlpiId,
            processingTimeMs=0,
            storedInDynamoDB=False,
            status="COMPLETED"
        )
        _scan_cache[req.scanId] = result

    ext = result.extraction
    if req.correctedFields:
        # Handle dict or pydantic model depending on how ext is typed
        if hasattr(ext, 'model_copy'):
            ext = ext.model_copy(update=req.correctedFields)
        elif isinstance(ext, dict):
            ext.update(req.correctedFields)
        result.extraction = ext

    # Update state off-chain (SRO queue)
    if MOCK:
        # Cache sync
        if req.scanId in _scan_cache:
            s = _scan_cache[req.scanId]
            s.status = "SCAN_PENDING_SRO"
            s.suggestedDlpiId = req.dlpiId
            s.ownerAadhaarHash = req.ownerAadhaarHash
            s.patwariName = req.officerName
            s.patwariHash = req.officerAadhaarHash
    else:
        try:
            save_patwari_approval(req.scanId, req.dlpiId, req.ownerAadhaarHash, req.officerName, req.officerAadhaarHash)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to save Patwari approval: {str(e)}")

    return {
        "approved":              True,
        "dlpiId":                req.dlpiId,
        "submittedToBlockchain": False,
        "message":               f"Scan submitted for SRO (Kanungo) approval.",
    }


@app.get("/scan", response_model=list[ScanResult])
def list_scans(status: str):
    """Query scans by status (for SRO/Tehsildar review queues)."""
    if MOCK:
        return [s for s in _scan_cache.values() if s.status == status]
    try:
        return query_scans_by_status(status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query scans from DynamoDB: {str(e)}")


@app.post("/scan/approve-sro-by-dlpi/{dlpiId}")
def approve_scan_sro_by_dlpi(dlpiId: str):
    """SRO (Kanungo) approves scan off-chain, promoting status to SCAN_PENDING_TEHSILDAR."""
    found_scans = []
    if MOCK:
        for s in _scan_cache.values():
            if s.suggestedDlpiId == dlpiId:
                found_scans.append(s)
    else:
        import pipeline
        table = pipeline._get_dynamo_table()
        if table:
            try:
                from boto3.dynamodb.conditions import Attr
                resp = table.scan(FilterExpression=Attr('suggestedDlpiId').eq(dlpiId))
                for item in resp.get('Items', []):
                    scan = ScanResult(**json.loads(item['resultJson']))
                    scan.status = item.get('status', 'COMPLETED')
                    found_scans.append(scan)
            except Exception as e:
                print(f"[DynamoDB] SRO search error: {e}")

        # Fallback to local DB
        if not found_scans:
            db = pipeline._load_local_db()
            for s_id, item in db.items():
                if item.get('suggestedDlpiId') == dlpiId:
                    scan = ScanResult(**json.loads(item['resultJson']))
                    scan.status = item.get('status', 'COMPLETED')
                    found_scans.append(scan)
                
    if not found_scans:
        raise HTTPException(status_code=404, detail=f"No pending scan found for DLPI {dlpiId}")
        
    try:
        from pipeline import update_scan_status
        for scan in found_scans:
            update_scan_status(scan.scanId, "SCAN_PENDING_TEHSILDAR")
            if scan.scanId in _scan_cache:
                _scan_cache[scan.scanId].status = "SCAN_PENDING_TEHSILDAR"
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update scan status: {str(e)}")

    return {"success": True}


class TehsildarApproveRequest(BaseModel):
    officerAadhaarHash: str
    officerName:        str
    token:              str


@app.post("/scan/approve-tehsildar-by-dlpi/{dlpiId}")
async def approve_scan_tehsildar_by_dlpi(dlpiId: str, req: TehsildarApproveRequest, background: BackgroundTasks):
    """Tehsildar approves scan, finally writing it to the blockchain (CreateDLPI)."""
    found_scans = []
    if MOCK:
        for s in _scan_cache.values():
            if s.suggestedDlpiId == dlpiId:
                found_scans.append(s)
    else:
        import pipeline
        table = pipeline._get_dynamo_table()
        if table:
            try:
                from boto3.dynamodb.conditions import Attr
                resp = table.scan(FilterExpression=Attr('suggestedDlpiId').eq(dlpiId))
                for item in resp.get('Items', []):
                    scan = pipeline.retrieve_scan(item['scanId'])
                    if scan:
                        found_scans.append(scan)
            except Exception as e:
                print(f"[DynamoDB] Tehsildar search error: {e}")

        # Fallback to local DB
        if not found_scans:
            db = pipeline._load_local_db()
            for s_id, item in db.items():
                if item.get('suggestedDlpiId') == dlpiId:
                    scan = pipeline.retrieve_scan(s_id)
                    if scan:
                        found_scans.append(scan)
                
    if not found_scans:
        raise HTTPException(status_code=404, detail=f"No pending scan found for DLPI {dlpiId}")

    # Transition ALL found scans to APPROVED
    from pipeline import update_scan_status
    for scan in found_scans:
        update_scan_status(scan.scanId, "APPROVED")
        if scan.scanId in _scan_cache:
            _scan_cache[scan.scanId].status = "APPROVED"

    # For blockchain minting, we only need one of the scans to generate the payload
    scan = found_scans[0]
    ext = scan.extraction
    tehsil_map = {"Dadri": "DAD", "Noida": "NDA", "Jewar": "JWR", "Bisrakh": "BSK"}
    tehsil_code = tehsil_map.get(ext.tehsil, "DAD")

    # Post to gateway to commit to blockchain
    land_type_val = ext.landType.value
    dlpi_payload = {
        "dlpiId":              dlpiId,
        "surveyNumber":        ext.khasraNo or "0",
        "khasraNo":            ext.khasraNo or "0",
        "tehsil":              ext.tehsil or "Dadri",
        "tehsilCode":          tehsil_code,
        "district":            ext.zila or "Gautam Buddha Nagar",
        "state":               "Uttar Pradesh",
        "landType":            "Jirayat" if land_type_val == "Bhumidhari" else land_type_val,
        "landTypeDescription": land_type_val,
        "areaHectares":        float(ext.areaHectares),
        "isTribal":            False,
        "scheduleVArea":       False,
        "initialOwners": [
            {
                "name":         ext.khatedars[0].name if ext.khatedars else "Unknown",
                "aadhaarHash":  scan.ownerAadhaarHash or ("sha256:" + "0" * 64),
                "share":        "1/1",
                "shareDecimal": 1.0
            }
        ],
        "ownershipType":       "SOLE",
        "latitude":            28.5355,
        "longitude":           77.3910,
        "boundaryPolygon":     None,
        "circleRateINR":       5000000,
        "ipfsCID":             scan.ipfsCID,
        "sourceType":          "RECORD_SCAN_AI"
    }

    try:
        await _post_to_gateway(dlpi_payload, req.token)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain commit failed: {str(e)}")

    background.add_task(mark_scan_approved, scan.scanId, dlpiId)

    return {"success": True, "message": "DLPI scan successfully committed to blockchain."}


# ─── GET /scan/{scanId} ───────────────────────────────────────────────────────

@app.get("/scan/{scan_id}", response_model=ScanResult)
def get_scan(scan_id: str):
    result = retrieve_scan(scan_id) or _scan_cache.get(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return result


# ─── GET /scan/demo/image-list ────────────────────────────────────────────────

@app.get("/scan/demo/image-list")
def demo_image_list():
    return {
        "images": [
            {
                "id":                  "demo_clear",
                "label":               "Dadri Gata 740/201 — Clean scan",
                "description":         "2025-26 Khatauni — Arun Sharma, Bhumidhari, 2.4 Ha. High confidence.",
                "expectedConfidence":  0.95,
                "variant":             "demo_clear",
            },
            {
                "id":                  "demo_degraded",
                "label":               "Dadri Gata 312 — 1994 torn register",
                "description":         "1990s handwritten Khatauni, paper torn. Requires officer review.",
                "expectedConfidence":  0.60,
                "variant":             "demo_degraded",
            },
        ]
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _post_to_gateway(payload: dict, token: str):
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{API_GATEWAY}/api/dlpi",
            json=payload,
            headers={"Authorization": f"Bearer {token}"},
            timeout=15,
        )
        if not resp.is_success:
            print(f"[RecordScan] Gateway post failed with {resp.status_code}: {resp.text}")
            resp.raise_for_status()
        return resp.json()


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8010))
    print(f"\n RecordScan AI -- UP Khatauni Edition")
    print(f"   REST  -> http://localhost:{port}")
    print(f"   Docs  -> http://localhost:{port}/docs")
    print(f"   Mode  -> {'MOCK' if MOCK else 'REAL (Azure Document Intelligence)'}")
    print(f"   DB    -> DynamoDB {os.getenv('DYNAMODB_TABLE', 'testArpit')} ({os.getenv('AWS_REGION', 'ap-south-1')})")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
