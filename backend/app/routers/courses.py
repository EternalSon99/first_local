"""Course CRUD endpoints."""

import shutil

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import COURSES_DIR
from app.database import get_db
from app.models.course import Course
from app.models.document import Document
from app.models.topic import Topic, TopicStatus
from app.schemas.course import (
    CourseCreate,
    CourseListResponse,
    CourseResponse,
    CourseUpdate,
    TopicSummary,
)
from app.utils.chroma_client import delete_course_collection

router = APIRouter(prefix="/api/courses", tags=["courses"])


@router.post("", response_model=CourseResponse, status_code=201)
def create_course(body: CourseCreate, db: Session = Depends(get_db)):
    """Create a new course with isolated storage."""
    course = Course(name=body.name, description=body.description)
    db.add(course)
    db.commit()
    db.refresh(course)

    # Create storage directory
    course_dir = COURSES_DIR / course.id
    for subdir in ["textbooks", "transcripts", "notes", "syllabus", "slides"]:
        (course_dir / subdir).mkdir(parents=True, exist_ok=True)

    return CourseResponse(
        id=course.id,
        name=course.name,
        description=course.description,
        created_at=course.created_at,
        topic_summary=TopicSummary(total=0, locked=0, in_progress=0, mastered=0),
    )


@router.get("", response_model=list[CourseListResponse])
def list_courses(db: Session = Depends(get_db)):
    """List all courses with summary counts."""
    courses = db.query(Course).order_by(Course.created_at.desc()).all()
    result = []
    for c in courses:
        topic_count = db.query(Topic).filter(Topic.course_id == c.id).count()
        doc_count = db.query(Document).filter(Document.course_id == c.id).count()
        result.append(
            CourseListResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                created_at=c.created_at,
                topic_count=topic_count,
                document_count=doc_count,
            )
        )
    return result


@router.get("/{course_id}", response_model=CourseResponse)
def get_course(course_id: str, db: Session = Depends(get_db)):
    """Get course detail with topic summary."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    topics = db.query(Topic).filter(Topic.course_id == course_id).all()
    summary = TopicSummary(
        total=len(topics),
        locked=sum(1 for t in topics if t.status == TopicStatus.LOCKED),
        in_progress=sum(1 for t in topics if t.status == TopicStatus.IN_PROGRESS),
        mastered=sum(1 for t in topics if t.status == TopicStatus.MASTERED),
    )

    return CourseResponse(
        id=course.id,
        name=course.name,
        description=course.description,
        created_at=course.created_at,
        topic_summary=summary,
    )


@router.patch("/{course_id}", response_model=CourseResponse)
def update_course(
    course_id: str, body: CourseUpdate, db: Session = Depends(get_db)
):
    """Update course name or description."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if body.name is not None:
        course.name = body.name
    if body.description is not None:
        course.description = body.description

    db.commit()
    db.refresh(course)
    return get_course(course_id, db)


@router.delete("/{course_id}", status_code=204)
def delete_course(course_id: str, db: Session = Depends(get_db)):
    """Delete a course and ALL associated data.

    Removes: DB rows, ChromaDB collection, stored files.
    """
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Delete ChromaDB collection
    delete_course_collection(course_id)

    # Delete stored files
    course_dir = COURSES_DIR / course_id
    if course_dir.exists():
        shutil.rmtree(course_dir, ignore_errors=True)

    # Delete from DB (cascade handles topics, documents, exams, etc.)
    db.delete(course)
    db.commit()
