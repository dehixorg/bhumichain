"""
BhumiBot AI Service Configuration
Loads dedicated BHUMIBOT_* environment variables with fallback to project-wide Azure AI / OpenAI keys.
"""

import os
from dotenv import load_dotenv

# Load main backend api-gateway .env first (centralized config)
base_dir = os.path.dirname(__file__)
gw_env = os.path.abspath(os.path.join(base_dir, "../../api-gateway/.env"))
if os.path.exists(gw_env):
    load_dotenv(gw_env, override=False)

# Load local .env if present (optional service-specific overrides)
local_env = os.path.join(base_dir, ".env")
if os.path.exists(local_env):
    load_dotenv(local_env, override=True)


class BhumiBotConfig:
    PORT: int = int(os.getenv("BHUMIBOT_PORT", "8015"))
    ENV: str = os.getenv("BHUMIBOT_ENV", "development")
    
    # LLM Settings
    MODEL_NAME: str = (
        os.getenv("BHUMIBOT_MODEL_NAME") or 
        os.getenv("BHUMIBOT_AZURE_AI_MODEL") or 
        os.getenv("AZURE_AI_MODEL") or 
        "gpt-4o"
    )
    TEMPERATURE: float = float(os.getenv("BHUMIBOT_TEMPERATURE", "0.2"))
    MAX_TOKENS: int = int(os.getenv("BHUMIBOT_MAX_TOKENS", "2048"))
    
    # Azure AI Credentials (primary key aliases)
    AZURE_OPENAI_ENDPOINT: str = (
        os.getenv("BHUMIBOT_AZURE_AI_ENDPOINT") or 
        os.getenv("BHUMIBOT_AZURE_OPENAI_ENDPOINT") or 
        os.getenv("AZURE_AI_ENDPOINT") or 
        os.getenv("AZURE_OPENAI_ENDPOINT") or 
        ""
    )
    AZURE_OPENAI_KEY: str = (
        os.getenv("BHUMIBOT_AZURE_AI_KEY") or 
        os.getenv("BHUMIBOT_AZURE_OPENAI_KEY") or 
        os.getenv("AZURE_AI_KEY") or 
        os.getenv("AZURE_OPENAI_KEY") or 
        ""
    )
    AZURE_OPENAI_DEPLOYMENT: str = (
        os.getenv("BHUMIBOT_AZURE_OPENAI_DEPLOYMENT") or 
        os.getenv("BHUMIBOT_AZURE_AI_MODEL") or 
        os.getenv("AZURE_AI_MODEL") or 
        "gpt-4o"
    )
    AZURE_OPENAI_API_VERSION: str = os.getenv("BHUMIBOT_AZURE_OPENAI_API_VERSION", "2024-05-01-preview")

    # OpenAI Direct Credentials
    OPENAI_API_KEY: str = os.getenv("BHUMIBOT_OPENAI_API_KEY") or os.getenv("OPENAI_API_KEY") or ""
    OPENAI_BASE_URL: str = os.getenv("BHUMIBOT_OPENAI_BASE_URL", "https://api.openai.com/v1")
    
    # Platform Info
    SERVICE_NAME: str = "BhumiBot AI Legal Assistant Service"
    SERVICE_VERSION: str = "5.0.0"


config = BhumiBotConfig()
