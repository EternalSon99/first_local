import uuid

from sqlalchemy import Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.exam import ExamLevel


class Rubric(Base):
    __tablename__ = "rubrics"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    course_id: Mapped[str] = mapped_column(String, ForeignKey("courses.id"), nullable=False)
    level: Mapped[ExamLevel] = mapped_column(Enum(ExamLevel), nullable=False)
    criteria_name: Mapped[str] = mapped_column(String(255), nullable=False)
    max_score: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    course = relationship("Course", back_populates="rubrics")
