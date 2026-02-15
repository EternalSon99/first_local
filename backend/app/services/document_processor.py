"""Document processing pipeline: upload → parse → chunk → embed → store."""

import uuid
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sqlalchemy.orm import Session

from app.config import CHUNK_OVERLAP, CHUNK_SIZE, COURSES_DIR, FILE_TYPE_DIRS
from app.models.document import Document, DocumentChunk, FileType
from app.utils.chroma_client import get_course_collection
from app.utils.file_parsers import parse_file


def get_storage_path(course_id: str, file_type: FileType, file_name: str) -> Path:
    """Build the storage path for a document."""
    subdir = FILE_TYPE_DIRS.get(file_type.value, "other")
    dir_path = COURSES_DIR / course_id / subdir
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path / file_name


def process_document(
    db: Session,
    course_id: str,
    file_name: str,
    file_type: FileType,
    file_content: bytes,
) -> tuple[Document, int]:
    """Process an uploaded document through the full pipeline.

    1. Save file to disk
    2. Parse text content
    3. Split into chunks
    4. Embed and store in ChromaDB
    5. Create DB records

    Returns (Document, chunk_count).
    """
    # Save file to disk
    storage_path = get_storage_path(course_id, file_type, file_name)
    storage_path.write_bytes(file_content)

    # Create document record
    doc = Document(
        course_id=course_id,
        file_name=file_name,
        file_type=file_type,
        storage_path=str(storage_path.relative_to(COURSES_DIR.parent)),
    )
    db.add(doc)
    db.flush()  # Get the ID

    # Parse the file
    pages = parse_file(storage_path)
    if not pages:
        db.commit()
        return doc, 0

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        length_function=len,
    )

    all_chunks: list[DocumentChunk] = []
    chroma_ids: list[str] = []
    chroma_documents: list[str] = []
    chroma_metadatas: list[dict] = []

    for page in pages:
        text_chunks = splitter.split_text(page["text"])
        for chunk_text in text_chunks:
            vector_id = str(uuid.uuid4())
            chunk = DocumentChunk(
                document_id=doc.id,
                page_number=page["page_number"],
                content=chunk_text,
                vector_id=vector_id,
            )
            all_chunks.append(chunk)
            chroma_ids.append(vector_id)
            chroma_documents.append(chunk_text)
            chroma_metadatas.append({
                "course_id": course_id,
                "document_id": doc.id,
                "file_name": file_name,
                "file_type": file_type.value,
                "page_number": page["page_number"],
            })

    # Store in ChromaDB (course-isolated collection)
    if chroma_ids:
        collection = get_course_collection(course_id)
        # Add in batches to avoid large payloads
        batch_size = 100
        for i in range(0, len(chroma_ids), batch_size):
            end = i + batch_size
            collection.add(
                ids=chroma_ids[i:end],
                documents=chroma_documents[i:end],
                metadatas=chroma_metadatas[i:end],
            )

    # Save chunk records to DB
    db.add_all(all_chunks)
    db.commit()

    return doc, len(all_chunks)


def delete_document(db: Session, document: Document) -> None:
    """Delete a document and its chunks from DB and ChromaDB."""
    # Get vector IDs before deleting
    chunk_vector_ids = [c.vector_id for c in document.chunks]

    # Remove from ChromaDB
    if chunk_vector_ids:
        collection = get_course_collection(document.course_id)
        # Delete in batches
        batch_size = 100
        for i in range(0, len(chunk_vector_ids), batch_size):
            end = i + batch_size
            collection.delete(ids=chunk_vector_ids[i:end])

    # Delete file from disk
    try:
        storage_path = COURSES_DIR.parent / document.storage_path
        if storage_path.exists():
            storage_path.unlink()
    except OSError:
        pass

    # Delete from DB (cascades to chunks)
    db.delete(document)
    db.commit()


def link_chunks_to_topic(
    db: Session, document_id: str, topic_id: str
) -> int:
    """Link all chunks of a document to a topic.

    Returns the number of chunks updated.
    """
    chunks = db.query(DocumentChunk).filter(
        DocumentChunk.document_id == document_id
    ).all()

    for chunk in chunks:
        chunk.topic_id = topic_id

    db.commit()
    return len(chunks)
