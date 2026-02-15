"""Exam session endpoints: start, get, submit, results, history."""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.models.exam import ExamSession, ExamStatus
from app.schemas.exam import (
    ExamResultsResponse,
    ExamSessionListResponse,
    ExamSessionResponse,
    ExamStartRequest,
    ExamSubmitRequest,
    QuestionResponse,
)
from app.services.exam_engine import start_exam_session, submit_exam
from app.services.grading_engine import grade_exam_session

router = APIRouter(prefix="/api/courses/{course_id}/exams", tags=["exams"])


def _verify_course(course_id: str, db: Session) -> Course:
    """Verify course exists."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _get_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Extract API key from header."""
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Set it via Settings in the UI.",
        )
    return x_api_key


def _get_provider(x_ai_provider: Optional[str] = Header(None)) -> str:
    """Extract AI provider from header. Defaults to anthropic."""
    return (x_ai_provider or "anthropic").lower().strip()


@router.post("/start", response_model=ExamSessionResponse, status_code=201)
def start_exam(
    course_id: str,
    body: ExamStartRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(_get_api_key),
    provider: str = Depends(_get_provider),
):
    """Start a new exam session with AI-generated questions."""
    _verify_course(course_id, db)

    session = start_exam_session(
        db=db,
        course_id=course_id,
        level=body.level,
        api_key=api_key,
        force=body.force,
        provider=provider,
    )

    return _session_to_response(session)


@router.get("", response_model=list[ExamSessionListResponse])
def list_exam_sessions(course_id: str, db: Session = Depends(get_db)):
    """List all exam session history for a course."""
    _verify_course(course_id, db)
    sessions = (
        db.query(ExamSession)
        .filter(ExamSession.course_id == course_id)
        .order_by(ExamSession.started_at.desc())
        .all()
    )
    return [
        ExamSessionListResponse(
            id=s.id,
            course_id=s.course_id,
            level=s.level,
            status=s.status,
            duration_minutes=s.duration_minutes,
            started_at=s.started_at,
            score=s.score,
            max_score=s.max_score,
        )
        for s in sessions
    ]


@router.get("/{session_id}", response_model=ExamSessionResponse)
def get_exam_session(
    course_id: str, session_id: str, db: Session = Depends(get_db)
):
    """Get an exam session with its questions."""
    _verify_course(course_id, db)
    session = db.query(ExamSession).filter(
        ExamSession.id == session_id,
        ExamSession.course_id == course_id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Exam session not found")

    return _session_to_response(session)


@router.post("/{session_id}/submit", response_model=ExamSessionResponse)
def submit_exam_answers(
    course_id: str,
    session_id: str,
    body: ExamSubmitRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(_get_api_key),
    provider: str = Depends(_get_provider),
):
    """Submit exam answers, trigger grading, and update mastery."""
    _verify_course(course_id, db)
    session = db.query(ExamSession).filter(
        ExamSession.id == session_id,
        ExamSession.course_id == course_id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Exam session not found")

    # Map answers by question ID
    answers = {a.question_id: a.answer for a in body.answers}

    # Submit
    session = submit_exam(db, session, answers)

    # Grade
    session = grade_exam_session(db, session, api_key, provider=provider)

    return _session_to_response(session)


@router.get("/{session_id}/results", response_model=ExamResultsResponse)
def get_exam_results(
    course_id: str, session_id: str, db: Session = Depends(get_db)
):
    """Get detailed graded results for an exam session."""
    _verify_course(course_id, db)
    session = db.query(ExamSession).filter(
        ExamSession.id == session_id,
        ExamSession.course_id == course_id,
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Exam session not found")

    if session.status != ExamStatus.GRADED:
        raise HTTPException(
            status_code=400,
            detail="Exam has not been graded yet",
        )

    total_score = session.score or 0
    max_total = session.max_score or 0
    percentage = (total_score / max_total * 100) if max_total > 0 else 0

    return ExamResultsResponse(
        session=_session_to_response(session),
        total_score=total_score,
        max_total_score=max_total,
        percentage=round(percentage, 2),
    )


def _session_to_response(session: ExamSession) -> ExamSessionResponse:
    """Convert ExamSession model to response schema."""
    questions = [
        QuestionResponse(
            id=q.id,
            question_number=q.question_number,
            question_text=q.question_text,
            topic_id=q.topic_id,
            max_score=q.max_score,
            student_answer=q.student_answer,
            awarded_score=q.awarded_score,
            feedback=q.feedback,
        )
        for q in sorted(session.questions, key=lambda x: x.question_number)
    ]

    return ExamSessionResponse(
        id=session.id,
        course_id=session.course_id,
        level=session.level,
        status=session.status,
        duration_minutes=session.duration_minutes,
        started_at=session.started_at,
        submitted_at=session.submitted_at,
        completed_at=session.completed_at,
        score=session.score,
        max_score=session.max_score,
        questions=questions,
    )
