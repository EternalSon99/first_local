from datetime import datetime

from pydantic import BaseModel


class CourseCreate(BaseModel):
    name: str
    description: str | None = None


class CourseUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class TopicSummary(BaseModel):
    total: int
    locked: int
    in_progress: int
    mastered: int


class CourseResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    topic_summary: TopicSummary | None = None

    model_config = {"from_attributes": True}


class CourseListResponse(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    topic_count: int = 0
    document_count: int = 0

    model_config = {"from_attributes": True}
