# AgentOS v2 — Memory Store (ChromaDB Vector Memory)
"""
Long-term vector memory using ChromaDB for semantic search
across agent interactions, decisions, and artifacts.
"""

from __future__ import annotations

import logging
import time
from datetime import datetime
from typing import Any

import chromadb

from app.core.config import CHROMA_COLLECTION, CHROMA_PERSIST_DIR, MEMORY_MAX_RESULTS
from app.core.schemas import AgentRole

logger = logging.getLogger(__name__)


class MemoryStore:
    """
    ChromaDB-backed vector memory store.

    Provides:
    - Semantic search across all agent outputs
    - Agent-filtered queries
    - Pipeline-scoped memory retrieval
    - Automatic deduplication via document IDs
    """

    def __init__(
        self,
        persist_dir: str = CHROMA_PERSIST_DIR,
        collection_name: str = CHROMA_COLLECTION,
    ):
        self.persist_dir = persist_dir
        self.collection_name = collection_name
        self._client: chromadb.ClientAPI | None = None
        self._collection: chromadb.Collection | None = None

    def initialize(self) -> None:
        """Initialize ChromaDB client and collection."""
        try:
            self._client = chromadb.PersistentClient(path=self.persist_dir)
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info(
                "ChromaDB initialized: collection=%s, docs=%d",
                self.collection_name,
                self._collection.count(),
            )
        except Exception as e:
            logger.error("Failed to initialize ChromaDB: %s", e)
            # Fallback to in-memory client
            self._client = chromadb.Client()
            self._collection = self._client.get_or_create_collection(
                name=self.collection_name,
            )
            logger.warning("ChromaDB falling back to in-memory mode")

    @property
    def is_ready(self) -> bool:
        return self._collection is not None

    @property
    def document_count(self) -> int:
        if not self._collection:
            return 0
        return self._collection.count()

    def store(
        self,
        text: str,
        agent: AgentRole | str,
        pipeline_id: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """
        Store a document in vector memory.
        Returns the document ID.
        """
        if not self._collection:
            raise RuntimeError("Memory store not initialized")

        doc_id = f"{agent}_{pipeline_id or 'none'}_{int(time.time() * 1000)}"
        meta = {
            "agent": str(agent),
            "timestamp": datetime.utcnow().isoformat(),
            "pipeline_id": pipeline_id or "",
        }
        if metadata:
            meta.update({k: str(v) for k, v in metadata.items()})

        self._collection.add(
            documents=[text],
            metadatas=[meta],
            ids=[doc_id],
        )
        logger.debug("Stored memory document: %s", doc_id)
        return doc_id

    def query(
        self,
        query_text: str,
        n_results: int = MEMORY_MAX_RESULTS,
        agent_filter: str | None = None,
        pipeline_id: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        Query vector memory semantically.
        Returns list of matching documents with metadata and distance scores.
        """
        if not self._collection:
            return []

        if self._collection.count() == 0:
            return []

        where_filter: dict[str, Any] = {}
        conditions = []
        if agent_filter:
            conditions.append({"agent": agent_filter})
        if pipeline_id:
            conditions.append({"pipeline_id": pipeline_id})

        if len(conditions) == 1:
            where_filter = conditions[0]
        elif len(conditions) > 1:
            where_filter = {"$and": conditions}

        try:
            results = self._collection.query(
                query_texts=[query_text],
                n_results=min(n_results, self._collection.count()),
                where=where_filter if where_filter else None,
                include=["documents", "metadatas", "distances"],
            )
        except Exception as e:
            logger.error("Memory query failed: %s", e)
            return []

        output: list[dict[str, Any]] = []
        if results and results.get("documents"):
            for i, doc in enumerate(results["documents"][0]):
                meta = (results["metadatas"] or [[]])[0][i] if results.get("metadatas") else {}
                distance = (results["distances"] or [[]])[0][i] if results.get("distances") else 0.0
                output.append({
                    "text": doc,
                    "metadata": meta,
                    "distance": distance,
                    "relevance": max(0, 1 - distance),
                })

        return output

    def delete_by_pipeline(self, pipeline_id: str) -> int:
        """Delete all memory documents associated with a pipeline."""
        if not self._collection:
            return 0

        try:
            self._collection.delete(where={"pipeline_id": pipeline_id})
            logger.info("Deleted memory documents for pipeline: %s", pipeline_id)
            return 0  # ChromaDB delete doesn't return count
        except Exception as e:
            logger.error("Failed to delete pipeline memory: %s", e)
            return -1


# ── In-Memory Session Store (Redis-like) ───────────────────────────

class SessionMemory:
    """
    In-memory session state store.
    Acts as a lightweight replacement for Redis for session data.
    Supports TTL-based expiration.
    """

    def __init__(self, default_ttl: int = 86400):
        self._store: dict[str, dict[str, Any]] = {}
        self._ttl: dict[str, float] = {}
        self._default_ttl = default_ttl

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Store a value with optional TTL."""
        import time
        self._store[key] = value
        self._ttl[key] = time.time() + (ttl if ttl is not None else self._default_ttl)

    def get(self, key: str, default: Any = None) -> Any:
        """Get a value, returning None if expired."""
        import time
        if key not in self._store:
            return default
        if time.time() > self._ttl.get(key, 0):
            self.delete(key)
            return default
        return self._store[key]

    def delete(self, key: str) -> bool:
        """Delete a key. Returns True if key existed."""
        if key in self._store:
            del self._store[key]
            self._ttl.pop(key, None)
            return True
        return False

    def keys(self, pattern: str = "*") -> list[str]:
        """List all active (non-expired) keys matching a pattern."""
        import fnmatch
        import time
        now = time.time()
        active_keys = []
        for key, expires in self._ttl.items():
            if now <= expires and fnmatch.fnmatch(key, pattern):
                active_keys.append(key)
        return active_keys

    @property
    def count(self) -> int:
        import time
        return sum(1 for t in self._ttl.values() if time.time() <= t)

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        import time
        now = time.time()
        expired = [k for k, t in self._ttl.items() if now > t]
        for k in expired:
            self.delete(k)
        return len(expired)


# ── Singletons ─────────────────────────────────────────────────────

memory_store = MemoryStore()
session_memory = SessionMemory()


def initialize_memory() -> None:
    """Initialize all memory stores at startup."""
    memory_store.initialize()
    logger.info("Memory stores initialized")
