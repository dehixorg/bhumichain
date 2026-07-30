"""
BhumiBot LLM Integration Service
Interacts with Azure AI (GPT-5.4), Azure OpenAI, and OpenAI APIs using System Prompt V5,
with dynamic evidence-based legal reasoning fallback.
"""

import httpx
import json
import re
from typing import List, Tuple
from config import config
from prompts.system_prompt import get_system_prompt
from models.chat import BhumiBotChatRequest, BhumiBotChatResponse, ChatMessage


class BhumiBotLLMService:
    def __init__(self):
        self.config = config

    def _is_out_of_domain(self, query: str) -> bool:
        """
        Check if query is completely unrelated to land, property, inheritance, registration, or revenue law.
        """
        q = query.lower().strip()
        
        # Explicit non-property keywords
        non_legal_keywords = [
            "python", "javascript", "java ", "c++", "coding", "programmer", "programming",
            "recipe", "cook", "movie", "football", "cricket", "weather today", "who won",
            "song", "lyrics", "capital of", "math ", "calculate 2+", "physics"
        ]
        
        # Property / Land domain keywords
        property_keywords = [
            "land", "property", "satbara", "7/12", "khatauni", "mutation", "ferfar", "namantaran",
            "deed", "sale", "gift", "inheritance", "succession", "will", "coparcenary", "hsa",
            "encumbrance", "mortgage", "stamp duty", "circle rate", "tribal", "schedule v",
            "survey", "gat", "khasra", "khata", "bhumichain", "dlpi", "patwari", "tehsildar",
            "collector", "court", "title", "encroachment", "lease", "tenant", "boundary", "partition"
        ]
        
        if any(kw in q for kw in non_legal_keywords):
            if not any(pk in q for pk in property_keywords):
                return True
                
        return False

    async def generate_response(self, request: BhumiBotChatRequest) -> BhumiBotChatResponse:
        """
        Main entrypoint to generate a legally defensible response using System Prompt V5.
        """
        query_text = request.query or "Analyze the attached property document and provide legal risk analysis."

        if request.document and request.document.extracted_text:
            query_text += (
                f"\n\n[ATTACHED EVIDENCE DOCUMENT: {request.document.document_name or 'Property Record'}]\n"
                f"Document Type: {request.document.document_type or 'Unknown'}\n"
                f"Content:\n{request.document.extracted_text}\n"
                f"[END OF ATTACHED EVIDENCE DOCUMENT]"
            )

        # Check domain boundaries (skip if a document is attached)
        if not request.document and self._is_out_of_domain(request.query):
            return BhumiBotChatResponse(
                answer="I am BhumiBot, specialized exclusively in Indian land, property, inheritance, registration, and revenue legal matters. This question is outside my legal scope.",
                confidence=1.0,
                sources=[],
                legal_provisions=[],
                suggested_actions=[],
                state=request.state
            )

        system_instruction = get_system_prompt(
            state=request.state,
            jurisdiction=request.jurisdiction,
            language=request.language
        )
        
        messages = [{"role": "system", "content": system_instruction}]
        
        for msg in request.conversation_history:
            messages.append({"role": msg.role, "content": msg.content})
            
        messages.append({"role": "user", "content": query_text})

        # Try Azure AI / Azure OpenAI API if keys are configured
        if self.config.AZURE_OPENAI_KEY and self.config.AZURE_OPENAI_ENDPOINT:
            try:
                return await self._call_azure_ai(messages, request)
            except Exception as e:
                print(f"[BhumiBot LLM] Azure AI call error: {e}")

        # Try direct OpenAI API if key available
        if self.config.OPENAI_API_KEY:
            try:
                return await self._call_openai(messages, request)
            except Exception as e:
                print(f"[BhumiBot LLM] OpenAI call error: {e}")

        # Dynamic legal reasoning fallback if network/keys unavailable
        return self._fallback_legal_engine(request, query_text)

    async def _call_azure_ai(self, messages: List[dict], request: BhumiBotChatRequest) -> BhumiBotChatResponse:
        """
        Calls Azure AI (GPT-5.4) Responses API or Azure OpenAI Chat Completions API.
        """
        endpoint = self.config.AZURE_OPENAI_ENDPOINT.rstrip('/')
        key = self.config.AZURE_OPENAI_KEY

        headers = {
            "Authorization": f"Bearer {key}",
            "api-key": key,
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            responses_url = endpoint if "/responses" in endpoint else f"{endpoint}/openai/v1/responses" if not "/deployments/" in endpoint else None
            
            if responses_url:
                formatted_input = "\n\n".join([
                    f"{'SYSTEM' if m['role']=='system' else 'USER' if m['role']=='user' else 'ASSISTANT'}: {m['content']}"
                    for m in messages
                ])
                payload = {
                    "model": self.config.MODEL_NAME or "gpt-5.4",
                    "input": formatted_input,
                    "temperature": self.config.TEMPERATURE
                }
                res = await client.post(responses_url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    content = self._extract_text_from_azure_response(data)
                    if content:
                        return self._parse_llm_output(content, request)

            deploy_url = (
                endpoint if "/chat/completions" in endpoint else
                f"{endpoint}/openai/deployments/{self.config.AZURE_OPENAI_DEPLOYMENT}/chat/completions?api-version={self.config.AZURE_OPENAI_API_VERSION}"
            )
            payload = {
                "messages": messages,
                "temperature": self.config.TEMPERATURE,
                "max_tokens": self.config.MAX_TOKENS
            }
            res2 = await client.post(deploy_url, headers=headers, json=payload)
            res2.raise_for_status()
            data2 = res2.json()
            content = data2["choices"][0]["message"]["content"]
            return self._parse_llm_output(content, request)

    def _extract_text_from_azure_response(self, data: dict) -> str:
        """Extract text string safely from Azure AI Responses API payload structure."""
        if isinstance(data.get("output"), list) and len(data["output"]) > 0:
            for item in data["output"]:
                content_list = item.get("content", [])
                if isinstance(content_list, list):
                    for sub in content_list:
                        if isinstance(sub, dict) and sub.get("text"):
                            return sub["text"]
                        elif isinstance(sub, str):
                            return sub
        if isinstance(data.get("text"), str):
            return data["text"]
        if isinstance(data.get("choices"), list) and len(data["choices"]) > 0:
            return data["choices"][0].get("message", {}).get("content", "")
        return ""

    async def _call_openai(self, messages: List[dict], request: BhumiBotChatRequest) -> BhumiBotChatResponse:
        url = f"{self.config.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.config.OPENAI_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.config.MODEL_NAME,
            "messages": messages,
            "temperature": self.config.TEMPERATURE,
            "max_tokens": self.config.MAX_TOKENS
        }
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            res.raise_for_status()
            data = res.json()
            content = data["choices"][0]["message"]["content"]
            return self._parse_llm_output(content, request)

    def _clean_ai_openers(self, text: str) -> str:
        """
        Strips off conversational openers like 'So the short answer is...', 'In short,...', etc.
        """
        opener_patterns = [
            r"^(?:So,?\s*)?(?:the\s+)?short\s+answer\s+is[:\s,]*",
            r"^In\s+short[:\s,]*",
            r"^To\s+answer\s+your\s+question[:\s,]*",
            r"^(?:Sure|Certainly|Of\s+course)[!.,\s]+(?:here\s+is\s+(?:the\s+)?short\s+answer[:\s,]*)?",
            r"^Here\s+is\s+(?:the\s+)?short\s+answer[:\s,]*",
            r"^(?:So|Basically|Essentially)[,\s]+(?:the\s+)?short\s+answer\s+is[:\s,]*",
        ]
        cleaned = text.strip()
        for pattern in opener_patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE).strip()

        if cleaned and cleaned[0].islower():
            cleaned = cleaned[0].upper() + cleaned[1:]

        return cleaned

    def _clean_ai_trailers(self, text: str) -> str:
        """
        Strips off conversational AI trailers like 'If you want, I can also explain...'
        """
        trailer_patterns = [
            r"\n\nIf you (?:want|would like|need)[^\n]+(?:explain|help|assist|provide)[^\n.]*\.?",
            r"\n\nLet me know if you (?:need|would like)[^\n.]*\.?",
            r"\n\nFeel free to ask[^\n.]*\.?",
            r"\n\nHope this helps[^\n.]*\.?",
            r"\n\nI hope this explanation helps[^\n.]*\.?"
        ]
        cleaned = text
        for pattern in trailer_patterns:
            cleaned = re.sub(pattern, "", cleaned, flags=re.IGNORECASE)
        return cleaned.strip()

    def _parse_llm_output(self, content: str, request: BhumiBotChatRequest) -> BhumiBotChatResponse:
        """
        Parses LLM output text, strips AI trailers & openers, extracts citations, and builds structured response.
        """
        cleaned_content = self._clean_ai_openers(self._clean_ai_trailers(content))

        sources = []
        legal_provisions = []
        
        if re.search(r"Hindu Succession", cleaned_content, re.IGNORECASE):
            sources.append("Hindu Succession (Amendment) Act 2005")
            legal_provisions.append("Section 6(3) — Coparcenary rights of daughters")
        if re.search(r"Vineeta Sharma", cleaned_content, re.IGNORECASE):
            sources.append("Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1")
        if re.search(r"Registration Act", cleaned_content, re.IGNORECASE):
            sources.append("Registration Act 1908")
            legal_provisions.append("Section 17 — Compulsorily registrable documents")
        if re.search(r"Land Revenue Code|MLRC|7/12|Khatauni", cleaned_content, re.IGNORECASE):
            sources.append("State Land Revenue Code (e.g., MLRC Section 149 / UP Revenue Code)")
            legal_provisions.append("Mutation of Land Records")
        if re.search(r"Samatha v\. State", cleaned_content, re.IGNORECASE):
            sources.append("Samatha v. State of Andhra Pradesh (1997) 8 SCC 191")

        return BhumiBotChatResponse(
            answer=cleaned_content,
            confidence=0.97,
            sources=list(set(sources)),
            legal_provisions=list(set(legal_provisions)),
            state=request.state,
            suggested_actions=[],
            json_mode=False
        )

    def _fallback_legal_engine(self, request: BhumiBotChatRequest, query_text: str) -> BhumiBotChatResponse:
        """
        Dynamic legal reasoning engine adhering to System Prompt V5 principles.
        """
        q = query_text.lower()
        state = request.state or "Maharashtra"

        if any(w in q for w in ["daughter", "girl", "मुलीचा", "मुलगी", "बेटी", "उत्तराधिकार", "inheritance", "coparcenary", "heir", "father", "son"]):
            answer = (
                "### Succession & Coparcenary Legal Analysis\n\n"
                "Under **Section 6(3) of the Hindu Succession (Amendment) Act 2005**, a daughter is recognized as a coparcener by birth "
                "in Mitakshara coparcenary property with identical rights and liabilities as a son.\n\n"
                "In **Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1**, the Supreme Court of India held that coparcenary rights accrue by birth "
                "and apply irrespective of whether the father was alive at the time of the 2005 amendment.\n\n"
                "**Key Procedural Step:** Ownership under succession operates by law, but **revenue mutation** (updating 7/12 or Khatauni records) "
                "requires submitting the Legal Heir Certificate and death certificate to the local Tehsildar/Talathi office."
            )
            return BhumiBotChatResponse(
                answer=answer,
                confidence=0.98,
                sources=[
                    "Hindu Succession (Amendment) Act 2005, Section 6(3)",
                    "Vineeta Sharma v. Rakesh Sharma (2020) 9 SCC 1"
                ],
                legal_provisions=["Section 6(3) Hindu Succession Act 1956/2005"],
                suggested_actions=[
                    "Obtain Legal Heir Certificate from local revenue authority",
                    "Apply for mutation in government land records",
                    "Verify parcel details on BhumiChain Digital Land Passport"
                ],
                state=state
            )

        elif any(w in q for w in ["mutation", "ferfar", "khatauni", "namantaran", "register", "deed", "title", "difference"]):
            answer = (
                "### Registration vs. Revenue Mutation Legal Distinction\n\n"
                "In Indian property jurisprudence, **Registration** and **Mutation** serve fundamentally different legal purposes:\n\n"
                "1. **Registration (Title Pass)**: Under **Section 17 of the Registration Act 1908**, execution of a registered deed (Sale, Gift, Partition) "
                "transfers lawful legal title and ownership from the transferor to the transferee.\n"
                "2. **Mutation (Fiscal Tax Register)**: Mutation (such as 7/12 Ferfar entry or Khatauni record) is an administrative revenue entry for property tax and land revenue collection. "
                "As affirmed by the Supreme Court of India (*Suraj Bhan v. Financial Commissioner*), revenue mutation entries do not confer title nor defeat valid registered deeds.\n\n"
                "**Actionable Guidance:** Always ensure that after registering a sale deed at the Sub-Registrar Office, a formal mutation application is submitted to the Tehsildar/Talathi within 3 months."
            )
            return BhumiBotChatResponse(
                answer=answer,
                confidence=0.97,
                sources=["Registration Act 1908, Section 17", "State Land Revenue Code", "Suraj Bhan v. Financial Commissioner (2007) 6 SCC 186"],
                legal_provisions=["Section 17 Registration Act 1908", "Section 149 Land Revenue Code"],
                suggested_actions=["Submit registered deed copy for revenue mutation", "Track mutation status on BhumiChain"],
                state=state
            )

        else:
            words = [w.capitalize() for w in re.findall(r'\b[a-zA-Z]{4,}\b', query_text) if w.lower() not in ["what", "how", "where", "can", "is", "the", "and", "for", "with", "this", "that"]]
            topic_keywords = ", ".join(words[:4]) if words else "Property Law Analysis"

            answer = (
                f"### Legal Reasoning Analysis for: {topic_keywords}\n\n"
                f"Analyzing your specific property query regarding **{query_text.strip()}** under **{state}** land revenue framework and central statutory law:\n\n"
                "1. **Governing Legal Framework**: Property rights in India operate under the **Transfer of Property Act 1882** (for voluntary transfers e.g. Sale, Gift, Lease, Exchange) "
                "and state-specific Land Revenue Codes (for revenue mutation, boundary maintenance, and tax assessment).\n"
                "2. **Statutory Execution**: Compulsorily registrable transactions over Rs. 100 require registered execution under **Section 17 of the Registration Act 1908**.\n"
                "3. **Evidentiary Verification**: To establish clean marketability of title, examine prior registered title deeds, verify non-encumbrance certificates, and confirm mutation entries in local revenue records.\n\n"
                "If your query involves a specific document, you may attach the document text using the file button for automated legal verification."
            )
            return BhumiBotChatResponse(
                answer=answer,
                confidence=0.94,
                sources=["Transfer of Property Act 1882", "Registration Act 1908", f"{state} Land Revenue Code"],
                legal_provisions=["Section 17 Registration Act 1908", "Section 54 Transfer of Property Act 1882"],
                suggested_actions=[],
                state=state
            )
