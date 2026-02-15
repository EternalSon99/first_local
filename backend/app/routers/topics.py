"""Topic management endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.topic import Topic
from app.schemas.topic import (
    TopicBulkUpdate,
    TopicCreate,
    TopicResponse,
    TopicUpdate,
)

router = APIRouter(prefix="/api/courses/{course_id}/topics", tags=["topics"])


def _verify_course(course_id: str, db: Session) -> Course:
    """Verify course exists."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("", response_model=list[TopicResponse])
def list_topics(course_id: str, db: Session = Depends(get_db)):
    """List all topics for a course with status and mastery scores."""
    _verify_course(course_id, db)
    topics = (
        db.query(Topic)
        .filter(Topic.course_id == course_id)
        .order_by(Topic.week_number.asc().nulls_last(), Topic.name.asc())
        .all()
    )
    return [TopicResponse.model_validate(t) for t in topics]


@router.post("", response_model=TopicResponse, status_code=201)
def create_topic(
    course_id: str, body: TopicCreate, db: Session = Depends(get_db)
):
    """Create a new topic for a course."""
    _verify_course(course_id, db)
    topic = Topic(
        course_id=course_id,
        name=body.name,
        week_number=body.week_number,
        status=body.status,
    )
    db.add(topic)
    db.commit()
    db.refresh(topic)
    return TopicResponse.model_validate(topic)


@router.patch("/{topic_id}", response_model=TopicResponse)
def update_topic(
    course_id: str,
    topic_id: str,
    body: TopicUpdate,
    db: Session = Depends(get_db),
):
    """Update a topic's name, week number, or status."""
    _verify_course(course_id, db)
    topic = db.query(Topic).filter(
        Topic.id == topic_id, Topic.course_id == course_id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    if body.name is not None:
        topic.name = body.name
    if body.week_number is not None:
        topic.week_number = body.week_number
    if body.status is not None:
        topic.status = body.status

    db.commit()
    db.refresh(topic)
    return TopicResponse.model_validate(topic)


@router.delete("/{topic_id}", status_code=204)
def delete_topic(
    course_id: str, topic_id: str, db: Session = Depends(get_db)
):
    """Delete a topic."""
    _verify_course(course_id, db)
    topic = db.query(Topic).filter(
        Topic.id == topic_id, Topic.course_id == course_id
    ).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    db.delete(topic)
    db.commit()


@router.post("/bulk", response_model=list[TopicResponse])
def bulk_update_topics(
    course_id: str, body: TopicBulkUpdate, db: Session = Depends(get_db)
):
    """Bulk update status for multiple topics."""
    _verify_course(course_id, db)
    topics = db.query(Topic).filter(
        Topic.course_id == course_id,
        Topic.id.in_(body.topic_ids),
    ).all()

    if len(topics) != len(body.topic_ids):
        raise HTTPException(
            status_code=404,
            detail="One or more topic IDs not found in this course",
        )

    for topic in topics:
        topic.status = body.status

    db.commit()
    return [TopicResponse.model_validate(t) for t in topics]
