"""Exam session management and question generation."""

import json
import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import (
    EXAM_CONFIGS,
    EXAM_RETAKE_COOLDOWN_HOURS,
    TIMER_GRACE_PERIOD_SECONDS,
)
from app.models.exam import ExamLevel, ExamQuestion, ExamSession, ExamStatus
from app.models.topic import Topic, TopicStatus
from app.services.ai_client import chat_completion, parse_json_response
from app.services.retrieval_engine import get_eligible_topics, retrieve_for_exam
from app.services.syllabus_manager import create_default_rubric, get_rubric_as_dict


def validate_can_start_exam(
    db: Session,
    course_id: str,
    level: ExamLevel,
    force: bool = False,
) -> list[Topic]:
    """Validate that an exam can be started. Returns eligible topics.

    Checks:
    1. There are unlocked topics available
    2. For EXAM level, check 24-hour cooldown unless forced
    """
    include_mastered = level == ExamLevel.EXAM
    eligible = get_eligible_topics(db, course_id, include_mastered)

    if not eligible:
        raise HTTPException(
            status_code=400,
            detail="No unlocked topics available for testing.",
        )

    # Check 24-hour cooldown for EXAM level
    if level == ExamLevel.EXAM and not force:
        cooldown_cutoff = datetime.now(timezone.utc) - timedelta(
            hours=EXAM_RETAKE_COOLDOWN_HOURS
        )
        recent_exam = db.query(ExamSession).filter(
            ExamSession.course_id == course_id,
            ExamSession.level == ExamLevel.EXAM,
            ExamSession.started_at > cooldown_cutoff,
        ).first()

        if recent_exam:
            raise HTTPException(
                status_code=429,
                detail=f"Exam retake cooldown: must wait {EXAM_RETAKE_COOLDOWN_HOURS} hours between exam attempts.",
            )

    return eligible


def start_exam_session(
    db: Session,
    course_id: str,
    level: ExamLevel,
    api_key: str,
    force: bool = False,
    provider: str = "anthropic",
) -> ExamSession:
    """Start a new exam session with generated questions.

    1. Validate eligibility
    2. Create session
    3. Generate questions using AI provider
    4. Return session with questions
    """
    eligible_topics = validate_can_start_exam(db, course_id, level, force)
    config = EXAM_CONFIGS[level.value]

    # Ensure rubric exists
    create_default_rubric(db, course_id, level)

    # Create session
    session = ExamSession(
        course_id=course_id,
        level=level,
        duration_minutes=config["duration_minutes"],
        max_score=config["max_score"],
    )
    db.add(session)
    db.flush()

    # Generate questions
    questions = _generate_questions(
        db, course_id, level, eligible_topics, config, api_key, provider
    )

    for i, q in enumerate(questions, start=1):
        exam_q = ExamQuestion(
            exam_session_id=session.id,
            topic_id=q["topic_id"],
            question_number=i,
            question_text=q["question_text"],
            max_score=q["max_score"],
        )
        db.add(exam_q)

    db.commit()
    db.refresh(session)
    return session


def _generate_questions(
    db: Session,
    course_id: str,
    level: ExamLevel,
    eligible_topics: list[Topic],
    config: dict,
    api_key: str,
    provider: str = "anthropic",
) -> list[dict]:
    """Generate exam questions using AI provider.

    Questions are grounded in retrieved chunks only.
    """
    include_mastered = level == ExamLevel.EXAM
    question_count = random.randint(
        config["question_count_min"], config["question_count_max"]
    )

    # Select topics for questions — distribute across eligible topics
    selected_topics = _select_topics_for_questions(eligible_topics, question_count)

    # Retrieve context for each topic
    questions_context = []
    for topic in selected_topics:
        chunks = retrieve_for_exam(
            db, course_id, topic.name, include_mastered=include_mastered
        )
        questions_context.append({
            "topic_id": topic.id,
            "topic_name": topic.name,
            "context": chunks,
        })

    # Get rubric for prompt
    rubric = get_rubric_as_dict(db, course_id, level)

    # Calculate per-question score
    total_max = config["max_score"] or question_count
    per_question_score = total_max / question_count

    # Build prompt
    prompt = _build_question_generation_prompt(
        level, questions_context, rubric, per_question_score
    )

    system_prompt = "You are an exam question generator for a university course. Generate questions that are grounded ONLY in the provided course material. Never fabricate content beyond the provided context. Output valid JSON only."

    response_text = chat_completion(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=prompt,
        provider=provider,
    )

    # Parse response
    try:
        generated = parse_json_response(response_text, expect_array=True)
    except ValueError:
        raise HTTPException(
            status_code=500, detail="Failed to parse generated questions"
        )

    # Map back to topics
    result = []
    for i, q in enumerate(generated[:question_count]):
        ctx = questions_context[i % len(questions_context)]
        result.append({
            "topic_id": ctx["topic_id"],
            "question_text": q.get("question", q.get("question_text", "")),
            "max_score": per_question_score,
        })

    return result


def _select_topics_for_questions(
    topics: list[Topic], count: int
) -> list[Topic]:
    """Select topics for questions, distributing evenly."""
    if len(topics) <= count:
        selected = topics[:]
        # Fill remaining by repeating
        while len(selected) < count:
            selected.append(random.choice(topics))
        return selected

    return random.sample(topics, count)


def _build_question_generation_prompt(
    level: ExamLevel,
    contexts: list[dict],
    rubric: list[dict],
    per_question_score: float,
) -> str:
    """Build the prompt for question generation."""
    level_descriptions = {
        ExamLevel.FLASHCARD: "short recall questions requiring brief factual answers",
        ExamLevel.LEVEL1: "basic recall and short explanation questions",
        ExamLevel.LEVEL2: "application-based questions requiring analysis",
        ExamLevel.EXAM: "synthesis questions requiring cross-topic reasoning and framework application",
    }

    context_sections = []
    for ctx in contexts:
        chunks_text = "\n".join(
            f"[{c.get('file_type', 'TEXTBOOK')} — {c['file_name']}, Page {c['page_number']}]\n{c['content']}"
            for c in ctx["context"]
        ) if ctx["context"] else "No specific material available for this topic."

        context_sections.append(
            f"### Topic: {ctx['topic_name']}\n{chunks_text}"
        )

    rubric_text = "\n".join(
        f"- {r['criteria_name']}: {r['max_score']} points — {r['description']}"
        for r in rubric
    ) if rubric else "Standard grading criteria apply."

    return f"""Generate exactly {len(contexts)} exam questions based on the following course material.

Question Type: {level_descriptions.get(level, 'standard questions')}
Each question is worth {per_question_score} points.

SOURCE PRIORITY (highest to lowest):
- TRANSCRIPT: What the professor said in class — most exam-relevant
- SLIDES: What the professor presented — key concepts
- NOTES: Student notes — personalized emphasis
- TEXTBOOK: Comprehensive reference — broad coverage
- SYLLABUS: Structure only — not content

When material from different sources overlaps or conflicts, prioritize higher-ranked sources.
Focus questions on concepts emphasized in TRANSCRIPT and SLIDES over TEXTBOOK.

Rubric Criteria:
{rubric_text}

Course Material:
{"".join(context_sections)}

Requirements:
1. Each question must be grounded ONLY in the provided course material
2. Questions must be appropriate for the difficulty level described
3. For EXAM level, encourage cross-topic synthesis
4. Reference specific concepts from the material
5. Prioritize concepts from TRANSCRIPT and SLIDES sources

Output a JSON array of objects with "question" field:
[
  {{"question": "Your question text here"}},
  ...
]

Output ONLY the JSON array, no additional text."""


def submit_exam(
    db: Session,
    session: ExamSession,
    answers: dict[str, str],
) -> ExamSession:
    """Submit exam answers and mark session as submitted.

    Validates timing constraints.
    """
    now = datetime.now(timezone.utc)

    # Check if already submitted
    if session.status != ExamStatus.IN_PROGRESS:
        raise HTTPException(
            status_code=400,
            detail="This exam session has already been submitted.",
        )

    # Check timer (with grace period)
    if session.duration_minutes is not None:
        deadline = session.started_at.replace(tzinfo=timezone.utc) + timedelta(
            minutes=session.duration_minutes,
            seconds=TIMER_GRACE_PERIOD_SECONDS,
        )
        if now > deadline:
            raise HTTPException(
                status_code=400,
                detail="Submission rejected: timer has expired beyond grace period.",
            )

    # Save answers
    for question in session.questions:
        answer = answers.get(question.id)
        if answer is not None:
            question.student_answer = answer

    session.status = ExamStatus.SUBMITTED
    session.submitted_at = now
    db.commit()
    db.refresh(session)
    return session
