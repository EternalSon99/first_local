import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Course(Base):
    __tablename__ = "courses"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    topics = relationship("Topic", back_populates="course", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="course", cascade="all, delete-orphan")
    rubrics = relationship("Rubric", back_populates="course", cascade="all, delete-orphan")
    exam_sessions = relationship(
        "ExamSession", back_populates="course", cascade="all, delete-orphan"
    )
    study_schedules = relationship(
        "StudySchedule", back_populates="course", cascade="all, delete-orphan"
    )
