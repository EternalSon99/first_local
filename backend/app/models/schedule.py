import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class StudySchedule(Base):
    __tablename__ = "study_schedules"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(String, ForeignKey("courses.id"), nullable=False)
    topic_id: Mapped[str] = mapped_column(String, ForeignKey("topics.id"), nullable=False)
    scheduled_type: Mapped[str] = mapped_column(String(50), default="flashcard_drill")
    scheduled_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    course = relationship("Course", back_populates="study_schedules")
    topic = relationship("Topic", back_populates="study_schedules")
