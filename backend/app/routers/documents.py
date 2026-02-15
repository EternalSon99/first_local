"""Document upload and management endpoints."""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import ALLOWED_EXTENSIONS
from app.database import get_db
from app.models.course import Course
from app.models.document import Document, FileType
from app.schemas.document import DocumentResponse, DocumentUploadResponse
from app.services.document_processor import delete_document, process_document

router = APIRouter(prefix="/api/courses/{course_id}/documents", tags=["documents"])


def _verify_course(course_id: str, db: Session) -> Course:
    """Verify course exists."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    course_id: str,
    file: UploadFile = File(...),
    file_type: FileType = Form(...),
    db: Session = Depends(get_db),
):
    """Upload a document, parse it, chunk it, and embed it in ChromaDB.

    This runs the full document processing pipeline.
    """
    _verify_course(course_id, db)

    # Validate file extension
    if file.filename:
        ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
            )

    # Read file content
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded")

    file_name = file.filename or "unknown"

    try:
        doc, chunk_count = process_document(
            db=db,
            course_id=course_id,
            file_name=file_name,
            file_type=file_type,
            file_content=content,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document processing failed: {str(e)}",
        )

    return DocumentUploadResponse(
        id=doc.id,
        file_name=doc.file_name,
        file_type=doc.file_type,
        chunks_created=chunk_count,
        message=f"Successfully processed {file_name}: {chunk_count} chunks created",
    )


@router.get("", response_model=list[DocumentResponse])
def list_documents(course_id: str, db: Session = Depends(get_db)):
    """List all documents for a course."""
    _verify_course(course_id, db)
    documents = (
        db.query(Document)
        .filter(Document.course_id == course_id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    result = []
    for doc in documents:
        result.append(
            DocumentResponse(
                id=doc.id,
                course_id=doc.course_id,
                file_name=doc.file_name,
                file_type=doc.file_type,
                uploaded_at=doc.uploaded_at,
                chunk_count=len(doc.chunks),
            )
        )
    return result


@router.delete("/{document_id}", status_code=204)
def remove_document(
    course_id: str, document_id: str, db: Session = Depends(get_db)
):
    """Delete a document and its chunks from DB and vector store."""
    _verify_course(course_id, db)
    document = db.query(Document).filter(
        Document.id == document_id,
        Document.course_id == course_id,
    ).first()

    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    delete_document(db, document)
