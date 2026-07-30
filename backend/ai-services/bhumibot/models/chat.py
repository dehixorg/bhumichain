"""
BhumiBot Chat Data Models
Pydantic schemas for request, response, chat history, and document analysis contexts.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="Message sender role: 'user', 'assistant', or 'system'")
    content: str = Field(..., description="Text content of the message")


class DocumentContext(BaseModel):
    document_name: Optional[str] = Field(None, description="Name of uploaded property document")
    document_type: Optional[str] = Field(None, description="Type of document e.g. '7/12 Satbara', 'Sale Deed', 'Mutation Order'")
    extracted_text: Optional[str] = Field(None, description="Extracted text or OCR contents from document")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional document metadata")


class BhumiBotChatRequest(BaseModel):
    query: str = Field(..., description="The user's current legal query or prompt")
    conversation_history: List[ChatMessage] = Field(default_factory=list, description="Prior conversation messages")
    state: Optional[str] = Field(None, description="Indian State or Union Territory (e.g. 'Maharashtra', 'Uttar Pradesh')")
    jurisdiction: Optional[str] = Field(None, description="Applicable legal jurisdiction")
    language: Optional[str] = Field(None, description="User language code or name e.g. 'mr', 'hi', 'en'")
    document: Optional[DocumentContext] = Field(None, description="Optional property document context for analysis")


class BhumiBotChatResponse(BaseModel):
    answer: str = Field(..., description="Legally reasoned BhumiBot AI answer")
    confidence: float = Field(default=0.95, ge=0.0, le=1.0, description="Legal reasoning confidence score")
    sources: List[str] = Field(default_factory=list, description="Acts, Sections, or Supreme Court judgments cited")
    legal_provisions: List[str] = Field(default_factory=list, description="Specific legal provisions involved")
    clarifying_question: Optional[str] = Field(None, description="Concise clarifying question if information is missing")
    suggested_actions: List[str] = Field(default_factory=list, description="Concrete next steps or practical guidance")
    state: Optional[str] = Field(None, description="Determined or confirmed State/UT")
    json_mode: bool = Field(default=False, description="Whether response was generated in structured JSON mode")
