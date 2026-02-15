from datetime import datetime

from pydantic import BaseModel

from app.models.exam import ExamLevel, ExamStatus


class ExamStartRequest(BaseModel):
    level: ExamLevel
    force: bool = False


class QuestionResponse(BaseModel):
    id: str
    question_number: int
    question_text: str
    topic_id: str
    max_score: float
    student_answer: str | None = None
    awarded_score: float | None = None
    feedback: dict | None = None

    model_config = {"from_attributes": True}


class ExamSessionResponse(BaseModel):
    id: str
    course_id: str
    level: ExamLevel
    status: ExamStatus
    duration_minutes: int | None
    started_at: datetime
    submitted_at: datetime | None
    completed_at: datetime | None
    score: float | None
    max_score: float | None
    questions: list[QuestionResponse] = []

    model_config = {"from_attributes": True}


class ExamSessionListResponse(BaseModel):
    id: str
    course_id: str
    level: ExamLevel
    status: ExamStatus
    duration_minutes: int | None = None
    started_at: datetime
    score: float | None
    max_score: float | None

    model_config = {"from_attributes": True}


class AnswerSubmission(BaseModel):
    question_id: str
    answer: str


class ExamSubmitRequest(BaseModel):
    answers: list[AnswerSubmission]


class GradingResult(BaseModel):
    awarded_score: float
    max_score: float
    rubric_breakdown: dict[str, float]
    missing_elements: list[str]
    citations: list[dict]


class ExamResultsResponse(BaseModel):
    session: ExamSessionResponse
    total_score: float
    max_total_score: float
    percentage: float
