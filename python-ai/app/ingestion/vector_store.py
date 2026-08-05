from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Qdrant

from qdrant_client import QdrantClient
from qdrant_client.http.models import Distance, VectorParams, Filter, FieldCondition, MatchValue

from app.config import settings


# Local embedding model (no OpenAI needed)
_embeddings = OllamaEmbeddings(
    model="nomic-embed-text",
)

_client = QdrantClient(url=settings.QDRANT_URL)


def ensure_collection() -> None:
    """
    Creates the Qdrant collection if it doesn't exist.
    nomic-embed-text produces 768-dimensional embeddings.
    """
    existing = [c.name for c in _client.get_collections().collections]

    if settings.QDRANT_COLLECTION not in existing:
        _client.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config=VectorParams(
                size=768,
                distance=Distance.COSINE,
            ),
        )


def get_vector_store() -> Qdrant:
    ensure_collection()

    return Qdrant(
        client=_client,
        collection_name=settings.QDRANT_COLLECTION,
        embeddings=_embeddings,
    )


def delete_document_vectors(document_id: str) -> None:
    """
    Delete all vectors belonging to one document.
    """
    _client.delete(
        collection_name=settings.QDRANT_COLLECTION,
        points_selector=Filter(
            must=[
                FieldCondition(
                    key="metadata.document_id",
                    match=MatchValue(value=document_id),
                )
            ]
        ),
    )