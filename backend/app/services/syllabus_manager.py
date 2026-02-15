"""Syllabus and rubric management."""

from sqlalchemy.orm import Session

from app.models.exam import ExamLevel
from app.models.rubric import Rubric


def get_rubric_for_level(
    db: Session,
    course_id: str,
    level: ExamLevel,
) -> list[Rubric]:
    """Get all rubric criteria for a course at a specific exam level."""
    return db.query(Rubric).filter(
        Rubric.course_id == course_id,
        Rubric.level == level,
    ).all()


def get_rubric_as_dict(
    db: Session,
    course_id: str,
    level: ExamLevel,
) -> list[dict]:
    """Get rubric criteria as a list of dicts for LLM prompt construction."""
    rubrics = get_rubric_for_level(db, course_id, level)
    return [
        {
            "criteria_name": r.criteria_name,
            "max_score": r.max_score,
            "description": r.description or "",
        }
        for r in rubrics
    ]


def create_default_rubric(
    db: Session,
    course_id: str,
    level: ExamLevel,
) -> list[Rubric]:
    """Create default rubric criteria for a course level if none exist.

    Returns existing rubrics if they already exist.
    """
    existing = get_rubric_for_level(db, course_id, level)
    if existing:
        return existing

    defaults = _get_default_criteria(level)
    rubrics = []
    for criteria in defaults:
        rubric = Rubric(
            course_id=course_id,
            level=level,
            criteria_name=criteria["name"],
            max_score=criteria["max_score"],
            description=criteria["description"],
        )
        db.add(rubric)
        rubrics.append(rubric)

    db.commit()
    return rubrics


def _get_default_criteria(level: ExamLevel) -> list[dict]:
    """Get default rubric criteria based on exam level."""
    if level == ExamLevel.LEVEL1:
        return [
            {
                "name": "content_accuracy",
                "max_score": 12,
                "description": "Accuracy of factual content and key concepts",
            },
            {
                "name": "clarity",
                "max_score": 4,
                "description": "Clarity of explanation and structure",
            },
            {
                "name": "completeness",
                "max_score": 4,
                "description": "Coverage of required elements",
            },
        ]
    elif level == ExamLevel.LEVEL2:
        return [
            {
                "name": "content_accuracy",
                "max_score": 16,
                "description": "Accuracy of factual content and key concepts",
            },
            {
                "name": "application",
                "max_score": 10,
                "description": "Correct application of concepts to scenarios",
            },
            {
                "name": "clarity",
                "max_score": 6,
                "description": "Clarity of explanation and logical structure",
            },
            {
                "name": "completeness",
                "max_score": 8,
                "description": "Coverage of all required elements and examples",
            },
        ]
    elif level == ExamLevel.EXAM:
        return [
            {
                "name": "content_accuracy",
                "max_score": 30,
                "description": "Accuracy and depth of factual content",
            },
            {
                "name": "critical_analysis",
                "max_score": 25,
                "description": "Quality of analysis, synthesis, and evaluation",
            },
            {
                "name": "framework_usage",
                "max_score": 20,
                "description": "Correct use of required frameworks and theories from syllabus",
            },
            {
                "name": "clarity",
                "max_score": 10,
                "description": "Writing clarity, logical structure, and coherence",
            },
            {
                "name": "completeness",
                "max_score": 15,
                "description": "Coverage of all required elements with supporting examples",
            },
        ]
    else:
        # Flashcard — simple pass/fail
        return [
            {
                "name": "correctness",
                "max_score": 1,
                "description": "Whether the answer is factually correct",
            },
        ]


def upsert_rubric_criteria(
    db: Session,
    course_id: str,
    level: ExamLevel,
    criteria_name: str,
    max_score: int,
    description: str | None = None,
) -> Rubric:
    """Create or update a single rubric criterion."""
    existing = db.query(Rubric).filter(
        Rubric.course_id == course_id,
        Rubric.level == level,
        Rubric.criteria_name == criteria_name,
    ).first()

    if existing:
        existing.max_score = max_score
        if description is not None:
            existing.description = description
        db.commit()
        return existing

    rubric = Rubric(
        course_id=course_id,
        level=level,
        criteria_name=criteria_name,
        max_score=max_score,
        description=description,
    )
    db.add(rubric)
    db.commit()
    return rubric
