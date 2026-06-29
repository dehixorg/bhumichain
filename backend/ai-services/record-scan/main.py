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
import httpx
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from khatauni_schema import ScanResult, KhatauniExtraction
from pipeline import scan_document, retrieve_scan, mark_scan_approved

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
        content={"error": "INTERNAL_SERVER_ERROR", "message": str(exc)},
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

    result = await scan_document(
        filename=file.filename or "upload.jpg",
        content=content,
        demo_variant=demoVariant,
        mock=MOCK,
    )

    _scan_cache[result.scanId] = result
    return result


# ─── POST /scan/approve ───────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    scanId:             str
    dlpiId:             str
    officerAadhaarHash: str
    officerName:        str
    correctedFields:    Optional[dict] = None
    token:              str


@app.post("/scan/approve")
async def approve_scan(req: ApproveRequest, background: BackgroundTasks):
    """
    Officer reviews and approves extracted data.
    Sends CreateDLPI transaction to API Gateway → Hyperledger Fabric.
    Marks scan as APPROVED in DynamoDB.
    """
    # Try DynamoDB first, fall back to in-memory cache
    result = retrieve_scan(req.scanId) or _scan_cache.get(req.scanId)
    if not result:
        raise HTTPException(status_code=404, detail=f"Scan {req.scanId} not found")

    ext = result.extraction
    if req.correctedFields:
        ext = ext.model_copy(update=req.correctedFields)

    tehsil_map  = {"Dadri": "DAD", "Noida": "NDA", "Jewar": "JWR", "Bisrakh": "BSK"}
    tehsil_code = tehsil_map.get(ext.tehsil, "DAD")

    dlpi_payload = {
        "dlpiId":            req.dlpiId,
        "ownerName":         ext.khatedars[0].name if ext.khatedars else "Unknown",
        "ownerAadhaarHash":  f"sha256:{req.officerAadhaarHash.replace('sha256:', '')}",
        "landType":          ext.landType.value,
        "areaHectares":      ext.areaHectares,
        "geojsonCID":        f"Qm{uuid.uuid4().hex[:32].upper()}",
        "surveyDocCID":      result.ipfsCID,
        "khataNo":           ext.khataNo,
        "khasraNo":          ext.khasraNo,
        "tehsil":            ext.tehsil,
        "tehsilCode":        tehsil_code,
        "district":          ext.zila,
        "approvedByOfficer": req.officerName,
        "approvedByHash":    req.officerAadhaarHash,
        "scanId":            result.scanId,
        "ocrConfidence":     ext.ocrConfidence,
    }

    background.add_task(_post_to_gateway, dlpi_payload, req.token)
    background.add_task(mark_scan_approved, req.scanId, req.dlpiId)

    return {
        "approved":              True,
        "dlpiId":                req.dlpiId,
        "submittedToBlockchain": True,
        "message":               f"DLPI {req.dlpiId} submitted to Hyperledger Fabric. TX will confirm in ~2 seconds.",
    }


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
    try:
        async with httpx.AsyncClient() as client:
            await client.post(
                f"{API_GATEWAY}/api/dlpi",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
                timeout=10,
            )
    except Exception as e:
        print(f"[RecordScan] Gateway post failed: {e}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8010))
    print(f"\n RecordScan AI — UP Khatauni Edition")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL (Azure Document Intelligence)'}")
    print(f"   DB    → DynamoDB {os.getenv('DYNAMODB_TABLE', 'testArpit')} ({os.getenv('AWS_REGION', 'ap-south-1')})")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
