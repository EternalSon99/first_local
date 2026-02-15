from pydantic import BaseModel

from app.models.exam import ExamLevel


class RubricCreate(BaseModel):
    level: ExamLevel
    criteria_name: str
    max_score: int
    description: str | None = None


class RubricResponse(BaseModel):
    id: str
    course_id: str
    level: ExamLevel
    criteria_name: str
    max_score: int
    description: str | None

    model_config = {"from_attributes": True}
