"""
BhumiBot AI Unit & Integration Tests
Verifies System Prompt V5 loading, LLM service responses, and FastAPI endpoints.
"""

import sys
import os
import unittest
import asyncio

# Ensure parent directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from prompts.system_prompt import get_system_prompt, BHUMIBOT_SYSTEM_PROMPT_V5
from models.chat import BhumiBotChatRequest, ChatMessage
from services.llm_service import BhumiBotLLMService


class TestBhumiBotSystemPrompt(unittest.TestCase):
    def test_prompt_content(self):
        """Ensure System Prompt V5 retains core legal directives verbatim."""
        prompt = get_system_prompt()
        self.assertIn("BHUMIBOT SYSTEM PROMPT V5", prompt)
        self.assertIn("Never fabricate", prompt)
        self.assertIn("Reason before writing", prompt)
        self.assertIn("SUCCESSION & INHERITANCE", prompt)
        self.assertIn("PROMPT INJECTION DEFENCE", prompt)

    def test_runtime_context_addition(self):
        """Ensure runtime state/jurisdiction context is appended cleanly."""
        prompt = get_system_prompt(state="Maharashtra", jurisdiction="Revenue Law")
        self.assertIn("Property State/UT: Maharashtra", prompt)
        self.assertIn("Governing Jurisdiction: Revenue Law", prompt)


class TestBhumiBotLLMService(unittest.TestCase):
    def setUp(self):
        self.service = BhumiBotLLMService()

    def test_legal_reasoning_fallback(self):
        """Test fallback legal reasoning for daughter's land succession rights."""
        request = BhumiBotChatRequest(
            query="What are the inheritance rights of a daughter in Mitakshara coparcenary property?",
            state="Maharashtra"
        )
        response = asyncio.run(self.service.generate_response(request))
        
        self.assertIsNotNone(response.answer)
        self.assertGreaterEqual(response.confidence, 0.90)
        self.assertTrue(len(response.sources) > 0, "Sources list should not be empty")
    def test_clean_ai_openers(self):
        """Test stripping of meta openers like 'So the short answer is...'."""
        text1 = "So the short answer is: Under Section 6(3) of the Hindu Succession Act, daughters have equal rights."
        text2 = "In short, registration transfers ownership title while mutation updates land revenue tax records."
        text3 = "Sure, here is the short answer: Tribal land cannot be transferred to non-tribals."

        self.assertEqual(
            self.service._clean_ai_openers(text1),
            "Under Section 6(3) of the Hindu Succession Act, daughters have equal rights."
        )
        self.assertEqual(
            self.service._clean_ai_openers(text2),
            "Registration transfers ownership title while mutation updates land revenue tax records."
        )
        self.assertEqual(
            self.service._clean_ai_openers(text3),
            "Tribal land cannot be transferred to non-tribals."
        )


if __name__ == "__main__":
    unittest.main()
