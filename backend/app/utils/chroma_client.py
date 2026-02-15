from __future__ import annotations

from typing import Optional

import chromadb
from chromadb import Collection

from app.config import CHROMA_DIR

_client: Optional[chromadb.PersistentClient] = None


def get_chroma_client() -> chromadb.PersistentClient:
    """Get or create the ChromaDB persistent client."""
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return _client


def get_course_collection(course_id: str) -> Collection:
    """Get or create a ChromaDB collection for a specific course.

    Each course has its own isolated collection to prevent cross-course retrieval.
    """
    client = get_chroma_client()
    return client.get_or_create_collection(
        name=f"course_{course_id}",
        metadata={"course_id": course_id},
    )


def delete_course_collection(course_id: str) -> None:
    """Delete a course's ChromaDB collection entirely."""
    client = get_chroma_client()
    collection_name = f"course_{course_id}"
    try:
        client.delete_collection(collection_name)
    except ValueError:
        pass  # Collection doesn't exist
