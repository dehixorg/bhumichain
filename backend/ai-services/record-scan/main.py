"""
RecordScan AI Service — FastAPI app
Port 8010

Endpoints:
  POST /scan/upload         — Upload Satbara image → returns ScanResult
  POST /scan/approve        — Officer approves → POSTs DLPI to API Gateway
  GET  /scan/:scanId        — Retrieve a previous scan result
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

from satbara_schema import ScanResult, SatbaraExtraction, SatbaraOwner
from pipeline import scan_document

MOCK = os.getenv("RECORD_SCAN_MODE", "mock") == "mock"
API_GATEWAY = os.getenv("API_GATEWAY_URL", "http://localhost:4000")
DEMO_TOKEN = os.getenv("DEMO_GATEWAY_TOKEN", "")   # set after getDemoToken()

# In-memory scan store (Redis in prod)
scan_store: dict[str, ScanResult] = {}

app = FastAPI(
    title="BhumiChain RecordScan AI",
    description="Satbara OCR + NER pipeline. Azure Document Intelligence + LayoutLM.",
    version="1.0.0",
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
        content={"error": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."},
    )


@app.get("/health")
def health():
    return {"status": "ok", "mode": "mock" if MOCK else "real", "port": 8010}


# ─── POST /scan/upload ────────────────────────────────────────────────────────

@app.post("/scan/upload", response_model=ScanResult)
async def upload_scan(
    file: UploadFile = File(...),
    demoVariant: Optional[str] = Form(None),
):
    """
    Accept a Satbara image or PDF.
    Returns structured ScanResult after OCR + NER pipeline.
    """
    allowed = {"image/jpeg", "image/png", "image/tiff", "application/pdf"}
    if file.content_type not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use JPEG, PNG, TIFF, or PDF.",
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

    scan_store[result.scanId] = result
    return result


# ─── POST /scan/approve ───────────────────────────────────────────────────────

class ApproveRequest(BaseModel):
    scanId: str
    dlpiId: str                          # officer may override suggestedDlpiId
    officerAadhaarHash: str
    officerName: str
    # Officer may correct any field before approving
    correctedFields: Optional[dict] = None
    token: str                           # JWT from API gateway


@app.post("/scan/approve")
async def approve_scan(req: ApproveRequest, background: BackgroundTasks):
    """
    Officer reviews and approves the extracted data.
    Sends CreateDLPI transaction to API gateway → blockchain.
    """
    result = scan_store.get(req.scanId)
    if not result:
        raise HTTPException(status_code=404, detail=f"Scan {req.scanId} not found")

    ext = result.extraction

    # Apply officer corrections
    if req.correctedFields:
        ext = ext.model_copy(update=req.correctedFields)

    # Build DLPI payload
    tehsil_code = _tehsil_code(ext.tehsilName)
    primary_owner = ext.owners[0] if ext.owners else SatbaraOwner(name="Unknown", ownershipType="Individual")

    dlpi_payload = {
        "dlpiId": req.dlpiId,
        "ownerName": primary_owner.name,
        "ownerAadhaarHash": req.officerAadhaarHash,  # oracle will verify real hash later
        "landType": ext.landType.value,
        "areaHectares": ext.totalAreaHectares,
        "geojsonCID": f"Qm{uuid.uuid4().hex[:32].upper()}",   # placeholder until surveyor adds polygon
        "surveyDocCID": result.ipfsCID,
        "approvedByOfficer": req.officerName,
        "approvedByHash": req.officerAadhaarHash,
        "scanId": result.scanId,
        "ocrConfidence": ext.ocrConfidence,
    }

    # POST to API gateway (non-blocking)
    background.add_task(_post_to_gateway, dlpi_payload, req.token)

    return {
        "approved": True,
        "dlpiId": req.dlpiId,
        "submittedToBlockchain": True,
        "message": f"DLPI {req.dlpiId} submitted to Hyperledger Fabric. TX will confirm in ~2 seconds.",
    }


# ─── GET /scan/:scanId ────────────────────────────────────────────────────────

@app.get("/scan/{scan_id}", response_model=ScanResult)
def get_scan(scan_id: str):
    result = scan_store.get(scan_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Scan {scan_id} not found")
    return result


# ─── GET /scan/demo/satbara-image — serve a sample Satbara image for the demo ─

@app.get("/scan/demo/image-list")
def demo_image_list():
    """Return list of pre-loaded demo Satbara images."""
    return {
        "images": [
            {
                "id": "demo_clear",
                "label": "Sinnar Survey 142/2A — Clean scan",
                "description": "High-quality Satbara of Ramesh Patil's Bagayat land",
                "expectedConfidence": 0.93,
                "variant": "demo_clear",
            },
            {
                "id": "demo_degraded",
                "label": "Sinnar Survey 98 — Ink smudged",
                "description": "1980s paper record, water damage. Requires officer review.",
                "expectedConfidence": 0.60,
                "variant": "demo_degraded",
            },
        ]
    }


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _tehsil_code(tehsil: str) -> str:
    return {"Sinnar": "SNN", "Igatpuri": "IGT", "Nashik": "NSK",
            "Dindori": "DIN", "Niphad": "NIK"}.get(tehsil, "NSK")


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
    print(f"\n🔍 BhumiChain RecordScan AI")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL (Azure Doc Intelligence)'}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
