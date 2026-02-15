"""Flashcard generation and grading endpoints."""

from __future__ import annotations

import json
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.course import Course
from app.schemas.flashcard import (
    FlashcardAnswer,
    FlashcardGenerateResponse,
    FlashcardGradeRequest,
    FlashcardGradeResponse,
    FlashcardQuestion,
    FlashcardResult,
)
from app.services.ai_client import chat_completion, parse_json_response
from app.services.grading_engine import grade_flashcards
from app.services.mastery_engine import update_mastery
from app.services.retrieval_engine import get_eligible_topics, retrieve_for_exam

router = APIRouter(prefix="/api/courses/{course_id}/flashcards", tags=["flashcards"])


def _verify_course(course_id: str, db: Session) -> Course:
    """Verify course exists."""
    course = db.query(Course).filter(Course.id == course_id).first()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


def _get_api_key(x_api_key: Optional[str] = Header(None)) -> str:
    """Extract API key from header."""
    if not x_api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Set it via Settings in the UI.",
        )
    return x_api_key


def _get_provider(x_ai_provider: Optional[str] = Header(None)) -> str:
    """Extract AI provider from header. Defaults to anthropic."""
    return (x_ai_provider or "anthropic").lower().strip()


@router.post("/generate", response_model=FlashcardGenerateResponse)
def generate_flashcards(
    course_id: str,
    db: Session = Depends(get_db),
    api_key: str = Depends(_get_api_key),
    provider: str = Depends(_get_provider),
):
    """Generate a set of flashcard questions from unlocked topics.

    Only uses IN_PROGRESS topics. Locked topics are never included.
    """
    _verify_course(course_id, db)

    # Get eligible topics (IN_PROGRESS only for flashcards)
    eligible = get_eligible_topics(db, course_id, include_mastered=False)
    if not eligible:
        raise HTTPException(
            status_code=400,
            detail="No unlocked topics available for testing.",
        )

    # Retrieve context from all eligible topics
    topic_names = ", ".join(t.name for t in eligible)
    chunks = retrieve_for_exam(
        db, course_id, topic_names, include_mastered=False
    )

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No document material available for unlocked topics.",
        )

    # Build context for question generation
    context_text = "\n\n".join(
        f"[Topic context]\n{c['content']}" for c in chunks
    )

    topic_list = "\n".join(f"- {t.name}" for t in eligible)

    prompt = f"""Generate 5-10 short recall flashcard questions based on this course material.

Available Topics:
{topic_list}

Course Material:
{context_text}

Requirements:
1. Each question should test a single factual concept
2. Questions should require brief answers (1-3 sentences)
3. Distribute questions across the available topics
4. Only generate questions about material that appears in the context

Output a JSON array:
[
  {{"question": "What is...?", "topic_name": "Topic Name"}},
  ...
]

Output ONLY the JSON array."""

    system_prompt = "You are a study aid generating recall-based flashcard questions. Generate questions grounded ONLY in the provided material. Output only valid JSON."

    try:
        response_text = chat_completion(
            api_key=api_key,
            system_prompt=system_prompt,
            user_prompt=prompt,
            provider=provider,
        )
    except Exception as e:
        err = str(e)
        if "429" in err or "RESOURCE_EXHAUSTED" in err or "quota" in err.lower():
            raise HTTPException(
                status_code=429,
                detail=f"AI provider quota exceeded. Try switching providers in Settings, or wait and retry. ({provider})",
            )
        if "401" in err or "invalid" in err.lower() or "api key" in err.lower():
            raise HTTPException(
                status_code=401,
                detail=f"Invalid API key for provider '{provider}'. Check Settings.",
            )
        raise HTTPException(status_code=500, detail=f"AI provider error: {err[:200]}")

    try:
        generated = parse_json_response(response_text, expect_array=True)
    except ValueError:
        raise HTTPException(status_code=500, detail="Failed to generate flashcards")

    # Map topic names to IDs
    topic_map = {t.name.lower(): t for t in eligible}
    questions = []
    topic_ids_used = set()

    for item in generated:
        topic_name = item.get("topic_name", "")
        # Find matching topic (case-insensitive)
        topic = topic_map.get(topic_name.lower())
        if topic is None:
            # Assign to first eligible topic as fallback
            topic = eligible[0]

        q = FlashcardQuestion(
            id=str(uuid.uuid4()),
            question=item["question"],
            topic_id=topic.id,
            topic_name=topic.name,
        )
        questions.append(q)
        topic_ids_used.add(topic.id)

    return FlashcardGenerateResponse(
        questions=questions,
        topic_ids_used=list(topic_ids_used),
    )


@router.post("/grade", response_model=FlashcardGradeResponse)
def grade_flashcard_answers(
    course_id: str,
    body: FlashcardGradeRequest,
    db: Session = Depends(get_db),
    api_key: str = Depends(_get_api_key),
    provider: str = Depends(_get_provider),
):
    """Grade flashcard responses and update mastery scores."""
    _verify_course(course_id, db)

    # Convert to dicts for grading engine
    answers_dicts = [
        {
            "question_id": a.question_id,
            "question": a.question,
            "answer": a.answer,
            "topic_id": a.topic_id,
        }
        for a in body.answers
    ]

    # Grade with AI
    grading_results = grade_flashcards(db, course_id, answers_dicts, api_key, provider=provider)

    # Build results and calculate mastery updates
    results = []
    topic_scores: dict[str, list[float]] = {}

    for i, gr in enumerate(grading_results):
        answer = body.answers[i] if i < len(body.answers) else None
        correct = gr.get("correct", False)
        score = 100.0 if correct else 0.0

        result = FlashcardResult(
            question_id=gr.get("question_id", answer.question_id if answer else ""),
            question=answer.question if answer else "",
            correct=correct,
            expected_answer=gr.get("expected_answer", ""),
            feedback=gr.get("feedback", ""),
        )
        results.append(result)

        if answer:
            if answer.topic_id not in topic_scores:
                topic_scores[answer.topic_id] = []
            topic_scores[answer.topic_id].append(score)

    # Update mastery for each topic
    mastery_updates = {}
    for topic_id, scores in topic_scores.items():
        avg_score = sum(scores) / len(scores)
        new_mastery = update_mastery(db, topic_id, avg_score)
        mastery_updates[topic_id] = new_mastery

    total_correct = sum(1 for r in results if r.correct)

    return FlashcardGradeResponse(
        results=results,
        total_correct=total_correct,
        total_questions=len(results),
        mastery_updates=mastery_updates,
    )
