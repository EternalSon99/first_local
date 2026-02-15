import enum
import uuid

from sqlalchemy import Enum, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TopicStatus(str, enum.Enum):
    LOCKED = "LOCKED"
    IN_PROGRESS = "IN_PROGRESS"
    MASTERED = "MASTERED"


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(String, ForeignKey("courses.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    week_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[TopicStatus] = mapped_column(
        Enum(TopicStatus), default=TopicStatus.LOCKED, nullable=False
    )
    mastery_score: Mapped[float] = mapped_column(Float, default=0.0)

    # Relationships
    course = relationship("Course", back_populates="topics")
    document_chunks = relationship("DocumentChunk", back_populates="topic")
    exam_questions = relationship("ExamQuestion", back_populates="topic")
    study_schedules = relationship(
        "StudySchedule", back_populates="topic", cascade="all, delete-orphan"
    )
