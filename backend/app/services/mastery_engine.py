"""Mastery tracking and topic status management."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import (
    MASTERY_THRESHOLD_AUTO_DRILL,
    MASTERY_THRESHOLD_MASTERED,
    MASTERY_WEIGHT_NEW,
    MASTERY_WEIGHT_PREVIOUS,
)
from app.models.schedule import StudySchedule
from app.models.topic import Topic, TopicStatus


def update_mastery(
    db: Session,
    topic_id: str,
    percentage_score: float,
) -> float:
    """Update a topic's mastery score using the weighted formula.

    Formula: new_mastery = (previous_mastery * 0.7) + (percentage_score * 0.3)

    Also updates topic status based on thresholds and schedules
    flashcard drills if mastery drops below 50.

    Returns the new mastery score.
    """
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if topic is None:
        raise ValueError(f"Topic not found: {topic_id}")

    # Calculate new mastery
    new_mastery = (
        topic.mastery_score * MASTERY_WEIGHT_PREVIOUS
        + percentage_score * MASTERY_WEIGHT_NEW
    )
    new_mastery = max(0.0, min(100.0, new_mastery))  # Clamp to 0-100
    topic.mastery_score = new_mastery

    # Update status based on mastery threshold
    if new_mastery >= MASTERY_THRESHOLD_MASTERED:
        topic.status = TopicStatus.MASTERED
    elif topic.status == TopicStatus.MASTERED:
        # Dropped below mastered threshold, move back to IN_PROGRESS
        topic.status = TopicStatus.IN_PROGRESS

    # Auto-schedule flashcard drill if mastery is too low
    if new_mastery < MASTERY_THRESHOLD_AUTO_DRILL:
        _schedule_flashcard_drill(db, topic)

    db.commit()
    return new_mastery


def _schedule_flashcard_drill(db: Session, topic: Topic) -> None:
    """Schedule a flashcard drill for a topic with low mastery.

    Only schedules if there isn't already an incomplete drill scheduled.
    """
    existing = db.query(StudySchedule).filter(
        StudySchedule.topic_id == topic.id,
        StudySchedule.completed == False,  # noqa: E712
    ).first()

    if existing is None:
        schedule = StudySchedule(
            course_id=topic.course_id,
            topic_id=topic.id,
            scheduled_type="flashcard_drill",
            scheduled_at=datetime.now(timezone.utc),
        )
        db.add(schedule)


def bulk_update_mastery(
    db: Session,
    scores: dict[str, float],
) -> dict[str, float]:
    """Update mastery for multiple topics at once.

    Args:
        scores: dict of {topic_id: percentage_score}

    Returns dict of {topic_id: new_mastery_score}.
    """
    results = {}
    for topic_id, score in scores.items():
        results[topic_id] = update_mastery(db, topic_id, score)
    return results


def get_pending_drills(db: Session, course_id: str) -> list[StudySchedule]:
    """Get all pending flashcard drills for a course."""
    return db.query(StudySchedule).filter(
        StudySchedule.course_id == course_id,
        StudySchedule.completed == False,  # noqa: E712
    ).all()


def complete_drill(db: Session, schedule_id: str) -> None:
    """Mark a scheduled drill as completed."""
    schedule = db.query(StudySchedule).filter(StudySchedule.id == schedule_id).first()
    if schedule:
        schedule.completed = True
        db.commit()
