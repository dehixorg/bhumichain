"""
BhumiGPT AI Service  —  port 8012

Endpoints:
  POST /bhumi-gpt/query   — answer a land rights question
  GET  /bhumi-gpt/history — list recent queries (in-memory, demo only)
  GET  /health
"""

import os
import uuid
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from mock_responses import get_mock_response

MOCK = os.getenv("BHUMI_GPT_MODE", "mock") == "mock"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")

app = FastAPI(
    title="BhumiChain BhumiGPT",
    description="Multilingual land rights Q&A — Claude API + Land Law RAG",
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

# In-memory query history (demo only — no persistence)
_history: list[dict] = []

# System prompt for real mode
SYSTEM_PROMPT = """You are BhumiGPT, an AI assistant for Indian land rights, built for BhumiChain.
You help citizens, revenue officers, and advocates understand:
- Land inheritance (Hindu Succession Act 1956/2005, Muslim Personal Law, Indian Succession Act 1925)
- Tribal land protection (Fifth Schedule, Sixth Schedule, Forest Rights Act 2006, Samatha ruling)
- Encumbrance certificates and mortgages
- Property transfer and stamp duty (Maharashtra)
- Mutation process and 60-second alert SLA
- Satbara (7/12) and Mahabhulekh e-registry
- SVAMITVA scheme, Janganana census

Rules:
1. Respond in the SAME language as the query (Marathi, Hindi, or English). Detect from script.
2. Always cite specific sections, acts, and case citations when relevant.
3. Bold key legal terms using **term** syntax.
4. Keep responses concise but complete.
5. Never provide legal advice — only legal information. Add "Consult an advocate" for complex disputes.
6. For tribal land questions, always cite Samatha v. State of AP (1997) 8 SCC 191.
7. For daughter inheritance, always cite HSA 2005 S.6(3) and Vineeta Sharma (2020).
"""


class QueryRequest(BaseModel):
    query: str
    language: Optional[str] = "auto"
    dlpiContext: Optional[str] = None   # optional DLPI ID for parcel-specific queries


class QueryResponse(BaseModel):
    queryId: str
    query: str
    response: str
    language: str
    confidence: float
    sources: list[str]
    mode: str
    askedAt: str


@app.get("/health")
def health():
    return {
        "status": "ok",
        "mode": "mock" if MOCK else "real",
        "model": "claude-sonnet-4-6" if not MOCK else "mock",
    }


@app.post("/bhumi-gpt/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    query_id = f"BGPT-{uuid.uuid4().hex[:8].upper()}"
    asked_at = datetime.utcnow().isoformat() + "Z"

    if MOCK or not ANTHROPIC_API_KEY:
        result = _mock_query(req.query)
    else:
        result = await _claude_query(req.query)

    entry = {
        "queryId": query_id,
        "query": req.query,
        **result,
        "mode": "mock" if (MOCK or not ANTHROPIC_API_KEY) else "real",
        "askedAt": asked_at,
    }
    _history.append(entry)
    if len(_history) > 50:
        _history.pop(0)

    return QueryResponse(**entry)


@app.get("/bhumi-gpt/history")
def history(limit: int = 20):
    return _history[-limit:]


# ─── Mock query ───────────────────────────────────────────────────────────────

def _mock_query(query: str) -> dict:
    preset = get_mock_response(query)
    if preset:
        return {
            "response":   preset["response"],
            "language":   preset["language"],
            "confidence": preset["confidence"],
            "sources":    preset["sources"],
        }
    # Generic fallback
    lang = "mr" if any(ord(c) > 0x0900 for c in query) else "en"
    fallback = {
        "mr": "माफ करा, मी या प्रश्नाचे उत्तर आत्ता देऊ शकत नाही. कृपया नमुना प्रश्न वापरा.",
        "en": "I'm unable to answer this specific question in mock mode. Please use one of the preset questions.",
    }
    return {
        "response":   fallback.get(lang, fallback["en"]),
        "language":   lang,
        "confidence": 0.0,
        "sources":    [],
    }


# ─── Real Claude query ────────────────────────────────────────────────────────

async def _claude_query(query: str) -> dict:
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": query}],
        )
        response_text = msg.content[0].text if msg.content else ""
        lang = "mr" if any(ord(c) > 0x0900 for c in query) else "en"
        return {
            "response":   response_text,
            "language":   lang,
            "confidence": 0.90,
            "sources":    [],
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Claude API error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8012))
    print(f"\n💬 BhumiChain BhumiGPT AI Service")
    print(f"   REST  → http://localhost:{port}")
    print(f"   Docs  → http://localhost:{port}/docs")
    print(f"   Mode  → {'MOCK' if MOCK else 'REAL (Claude API)'}")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
