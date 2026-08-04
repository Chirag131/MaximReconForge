"""
pgvector-backed RAG service for whiteboard embeddings.

Embeds cleaned whiteboard entries into the `whiteboard_embeddings` table
(1024-dim, matching Voyage AI voyage-3 schema). Provides semantic search for
search_whiteboard tool.
"""

from __future__ import annotations

import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.config import settings

logger = logging.getLogger(__name__)


def generate_embedding(text_content: str) -> list[float]:
    """Generate embedding vector for text content.

    Currently stubbed with a 1024-dim zero vector until VOYAGEAI_API_KEY is provided.
    """
    dim = settings.embedding_dimension  # 1024
    if settings.voyageai_api_key:
        try:
            import voyageai
            vo = voyageai.Client(api_key=settings.voyageai_api_key)
            res = vo.embed([text_content], model=settings.embedding_model)
            return res.embeddings[0]
        except Exception as exc:
            logger.warning("Voyage AI embedding failed, falling back to stub: %s", exc)

    # Stub fallback
    return [0.0] * dim


async def embed_and_store_whiteboard_entry(
    db: AsyncSession,
    *,
    engagement_id: str,
    content: str,
    finding_id: str | None = None,
) -> None:
    """Embed cleaned whiteboard content and store in Supabase pgvector table."""
    vector = generate_embedding(content)
    vector_str = f"[{','.join(str(v) for v in vector)}]"

    query = text("""
        INSERT INTO whiteboard_embeddings (engagement_id, finding_id, content, embedding)
        VALUES (:engagement_id, :finding_id, :content, :embedding::vector)
    """)

    try:
        await db.execute(
            query,
            {
                "engagement_id": engagement_id,
                "finding_id": finding_id,
                "content": content,
                "embedding": vector_str,
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to store whiteboard embedding: %s", exc, exc_info=True)


async def search_whiteboard_embeddings(
    db: AsyncSession,
    *,
    engagement_id: str,
    query_text: str,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Cosine similarity search on whiteboard_embeddings for an engagement."""
    vector = generate_embedding(query_text)
    vector_str = f"[{','.join(str(v) for v in vector)}]"

    query = text("""
        SELECT id, content, finding_id, 1 - (embedding <=> :embedding::vector) AS score
        FROM whiteboard_embeddings
        WHERE engagement_id = :engagement_id
        ORDER BY embedding <=> :embedding::vector
        LIMIT :top_k
    """)

    try:
        res = await db.execute(
            query,
            {
                "engagement_id": engagement_id,
                "embedding": vector_str,
                "top_k": top_k,
            },
        )
        rows = res.mappings().all()
        return [
            {
                "id": str(r["id"]),
                "content": r["content"],
                "finding_id": str(r["finding_id"]) if r["finding_id"] else None,
                "score": float(r["score"]) if r["score"] is not None else 0.0,
            }
            for r in rows
        ]
    except Exception as exc:
        logger.error("pgvector search failed: %s", exc, exc_info=True)
        return []
