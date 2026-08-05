import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    QDRANT_URL: str = os.getenv("QDRANT_URL", "http://localhost:6333")
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "kb_documents")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    CHAT_MODEL: str = os.getenv("CHAT_MODEL", "gpt-4o-mini")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "1000"))
    CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "150"))

    # Redis Pub/Sub channel names — MUST match shared/redis-contract.md and
    # backend/src/services/redisPubSub.ts exactly.
    CHANNEL_PDF_PROCESS = "pdf:process"
    CHANNEL_PDF_PROCESSED = "pdf:processed"
    CHANNEL_AI_REQUEST = "ai:request"
    CHANNEL_AI_RESPONSE = "ai:response"


settings = Settings()
