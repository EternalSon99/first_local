from pydantic import BaseModel


class FlashcardQuestion(BaseModel):
    id: str
    question: str
    topic_id: str
    topic_name: str


class FlashcardGenerateResponse(BaseModel):
    questions: list[FlashcardQuestion]
    topic_ids_used: list[str]


class FlashcardAnswer(BaseModel):
    question_id: str
    question: str
    answer: str
    topic_id: str


class FlashcardGradeRequest(BaseModel):
    answers: list[FlashcardAnswer]


class FlashcardResult(BaseModel):
    question_id: str
    question: str
    correct: bool
    expected_answer: str
    feedback: str


class FlashcardGradeResponse(BaseModel):
    results: list[FlashcardResult]
    total_correct: int
    total_questions: int
    mastery_updates: dict[str, float]
