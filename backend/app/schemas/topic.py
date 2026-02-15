from pydantic import BaseModel

from app.models.topic import TopicStatus


class TopicCreate(BaseModel):
    name: str
    week_number: int | None = None
    status: TopicStatus = TopicStatus.LOCKED


class TopicUpdate(BaseModel):
    name: str | None = None
    week_number: int | None = None
    status: TopicStatus | None = None


class TopicBulkUpdate(BaseModel):
    topic_ids: list[str]
    status: TopicStatus


class TopicResponse(BaseModel):
    id: str
    course_id: str
    name: str
    week_number: int | None
    status: TopicStatus
    mastery_score: float

    model_config = {"from_attributes": True}
