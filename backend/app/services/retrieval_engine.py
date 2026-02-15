"""Course-scoped RAG retrieval engine with source-type priority weighting.

All retrieval MUST respect course isolation and topic locking.

Source priority (highest to lowest):
  TRANSCRIPT > SLIDES > NOTES > TEXTBOOK > SYLLABUS

The engine over-fetches candidates from ChromaDB, then re-ranks them by
combining semantic similarity distance with a source-type weight multiplier.
"""

from sqlalchemy.orm import Session

from app.config import SOURCE_TYPE_WEIGHTS, TOP_K_CANDIDATES, TOP_K_CHUNKS
from app.models.document import Document, DocumentChunk
from app.models.topic import Topic, TopicStatus
from app.utils.chroma_client import get_course_collection


def get_eligible_topics(
    db: Session,
    course_id: str,
    include_mastered: bool = False,
) -> list[Topic]:
    """Get topics eligible for retrieval based on their status.

    For Level 1/Level 2: only IN_PROGRESS topics.
    For Exam mode: IN_PROGRESS + MASTERED topics.
    LOCKED topics are NEVER included.
    """
    statuses = [TopicStatus.IN_PROGRESS]
    if include_mastered:
        statuses.append(TopicStatus.MASTERED)

    return db.query(Topic).filter(
        Topic.course_id == course_id,
        Topic.status.in_(statuses),
    ).all()


def retrieve_chunks(
    db: Session,
    course_id: str,
    query: str,
    topic_ids: list[str] | None = None,
    top_k: int = TOP_K_CHUNKS,
) -> list[dict]:
    """Retrieve relevant chunks with source-type priority re-ranking.

    1. Over-fetch candidates from ChromaDB (TOP_K_CANDIDATES)
    2. Filter by eligible topic IDs at the DB level
    3. Re-rank by combining ChromaDB distance with source-type weight
    4. Return the top_k best results

    Returns list of {content, file_name, file_type, page_number, topic_id, chunk_id}.
    """
    collection = get_course_collection(course_id)

    # Build where filter for ChromaDB
    where_filter = {"course_id": course_id}

    # Over-fetch to allow weighted re-ranking
    fetch_count = max(TOP_K_CANDIDATES, top_k * 3)

    # Query ChromaDB
    results = collection.query(
        query_texts=[query],
        n_results=fetch_count,
        where=where_filter,
        include=["documents", "metadatas", "distances"],
    )

    if not results or not results["ids"] or not results["ids"][0]:
        return []

    # Get the chunk vector IDs returned
    vector_ids = results["ids"][0]
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Filter by eligible topic IDs at the DB level
    chunks_query = db.query(DocumentChunk).filter(
        DocumentChunk.vector_id.in_(vector_ids)
    )

    if topic_ids is not None:
        # Only include chunks linked to eligible topics (or unlinked chunks)
        chunks_query = chunks_query.filter(
            (DocumentChunk.topic_id.in_(topic_ids)) | (DocumentChunk.topic_id.is_(None))
        )

    db_chunks = {c.vector_id: c for c in chunks_query.all()}

    # Also load file_type for each chunk's parent document
    doc_ids = set()
    for chunk in db_chunks.values():
        doc_ids.add(chunk.document_id)

    doc_file_types: dict[str, str] = {}
    if doc_ids:
        docs = db.query(Document).filter(Document.id.in_(doc_ids)).all()
        doc_file_types = {d.id: d.file_type.value for d in docs}

    # Build candidates with weighted scores
    candidates = []
    for i, vid in enumerate(vector_ids):
        chunk = db_chunks.get(vid)
        if chunk is None:
            continue  # Filtered out by topic locking

        metadata = metadatas[i] if i < len(metadatas) else {}
        distance = distances[i] if i < len(distances) else 1.0

        # Get file type — prefer metadata (new uploads), fallback to DB lookup
        file_type = metadata.get("file_type") or doc_file_types.get(chunk.document_id, "TEXTBOOK")

        # Source weight multiplier (higher = more important)
        weight = SOURCE_TYPE_WEIGHTS.get(file_type, 1.0)

        # ChromaDB distance: lower = more similar.
        # Weighted score: lower = better. Divide distance by weight so
        # higher-priority sources get a smaller (better) score.
        weighted_score = distance / weight

        candidates.append({
            "content": chunk.content,
            "file_name": metadata.get("file_name", "Unknown"),
            "file_type": file_type,
            "page_number": chunk.page_number,
            "topic_id": chunk.topic_id,
            "chunk_id": chunk.id,
            "distance": distance,
            "weighted_score": weighted_score,
        })

    # Sort by weighted score (lower is better) and take top_k
    candidates.sort(key=lambda c: c["weighted_score"])
    top_results = candidates[:top_k]

    # Remove internal scoring fields from output
    for r in top_results:
        r.pop("distance", None)
        r.pop("weighted_score", None)

    return top_results


def retrieve_for_exam(
    db: Session,
    course_id: str,
    query: str,
    include_mastered: bool = False,
    top_k: int = TOP_K_CHUNKS,
) -> list[dict]:
    """High-level retrieval that enforces topic locking.

    Combines topic eligibility checking with weighted chunk retrieval.
    Returns empty list if no eligible topics exist.
    """
    eligible_topics = get_eligible_topics(db, course_id, include_mastered)
    if not eligible_topics:
        return []

    topic_ids = [t.id for t in eligible_topics]
    return retrieve_chunks(db, course_id, query, topic_ids=topic_ids, top_k=top_k)
