import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.database import Base


class ExamLevel(str, enum.Enum):
    FLASHCARD = "FLASHCARD"
    LEVEL1 = "LEVEL1"
    LEVEL2 = "LEVEL2"
    EXAM = "EXAM"


class ExamStatus(str, enum.Enum):
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    GRADED = "GRADED"


class ExamSession(Base):
    __tablename__ = "exam_sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(String, ForeignKey("courses.id"), nullable=False)
    level: Mapped[ExamLevel] = mapped_column(Enum(ExamLevel), nullable=False)
    status: Mapped[ExamStatus] = mapped_column(
        Enum(ExamStatus), default=ExamStatus.IN_PROGRESS, nullable=False
    )
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    max_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Relationships
    course = relationship("Course", back_populates="exam_sessions")
    questions = relationship(
        "ExamQuestion", back_populates="exam_session", cascade="all, delete-orphan"
    )


class ExamQuestion(Base):
    __tablename__ = "exam_questions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    exam_session_id: Mapped[str] = mapped_column(
        String, ForeignKey("exam_sessions.id"), nullable=False
    )
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id"), nullable=False)
    question_number: Mapped[int] = mapped_column(Integer, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    student_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    awarded_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    exam_session = relationship("ExamSession", back_populates="questions")
    topic = relationship("Topic", back_populates="exam_questions")
