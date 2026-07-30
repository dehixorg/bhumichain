"""
BhumiBot AI Service — Main Application
FastAPI REST microservice running on port 8015.
Exposes endpoints for BhumiBot legal assistant powered by System Prompt V5.
"""

import os
import sys
import uvicorn
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import config
from models.chat import BhumiBotChatRequest, BhumiBotChatResponse
from services.llm_service import BhumiBotLLMService
from prompts.system_prompt import get_system_prompt

# Initialize FastAPI App
app = FastAPI(
    title=config.SERVICE_NAME,
    version=config.SERVICE_VERSION,
    description="Legally accurate, evidence-based Indian property legal assistant powered by System Prompt V5"
)

# Enable CORS for frontend and API Gateway requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# LLM Service instance
llm_service = BhumiBotLLMService()


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": config.SERVICE_NAME,
        "version": config.SERVICE_VERSION,
        "port": config.PORT,
        "environment": config.ENV,
        "model": config.MODEL_NAME
    }


@app.get("/prompt/info")
async def prompt_info():
    """
    Returns information on the active System Prompt V5.
    """
    prompt_text = get_system_prompt()
    return {
        "prompt_version": "V5 (Consolidated)",
        "prompt_length_chars": len(prompt_text),
        "primary_objectives": [
            "1. Legal accuracy",
            "2. Truthfulness",
            "3. Honest uncertainty",
            "4. Practical usefulness",
            "5. Clear reasoning"
        ]
    }


@app.post("/chat", response_model=BhumiBotChatResponse)
async def chat_endpoint(request: BhumiBotChatRequest):
    """
    Primary endpoint for processing user queries against BhumiBot System Prompt V5.
    """
    if not request.query or not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty.")
        
    try:
        response = await llm_service.generate_response(request)
        return response
    except Exception as e:
        print(f"[BhumiBot Error] {e}")
        raise HTTPException(status_code=500, detail=f"BhumiBot service processing failed: {str(e)}")


if __name__ == "__main__":
    port = config.PORT
    print(f"\n=======================================================")
    print(f"[+] Starting {config.SERVICE_NAME}")
    print(f"[+] REST API  -> http://0.0.0.0:{port}")
    print(f"[+] Swagger   -> http://localhost:{port}/docs")
    print(f"[+] Prompt    -> System Prompt V5 (Consolidated)")
    print(f"=======================================================\n")
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
