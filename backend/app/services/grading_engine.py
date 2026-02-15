"""Rubric-based grading engine supporting multiple AI providers.

All grading must:
- Load syllabus rubric
- Compare student answer with retrieved chunks and transcript emphasis
- Score by rubric categories
- Include mandatory citations
"""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.exam import ExamLevel, ExamQuestion, ExamSession, ExamStatus
from app.services.ai_client import chat_completion, parse_json_response
from app.services.mastery_engine import update_mastery
from app.services.retrieval_engine import retrieve_for_exam
from app.services.syllabus_manager import get_rubric_as_dict


def grade_exam_session(
    db: Session,
    session: ExamSession,
    api_key: str,
    provider: str = "anthropic",
) -> ExamSession:
    """Grade all questions in an exam session.

    1. For each question, retrieve relevant chunks
    2. Grade using AI provider with rubric enforcement
    3. Update mastery scores
    4. Mark session as graded
    """
    if session.status != ExamStatus.SUBMITTED:
        raise ValueError("Session must be submitted before grading")

    include_mastered = session.level == ExamLevel.EXAM
    rubric = get_rubric_as_dict(db, session.course_id, session.level)

    total_awarded = 0.0
    total_max = 0.0
    topic_scores: dict[str, list[float]] = {}

    for question in session.questions:
        if not question.student_answer:
            # No answer submitted — score 0
            question.awarded_score = 0
            question.feedback = {
                "awarded_score": 0,
                "max_score": question.max_score,
                "rubric_breakdown": {},
                "missing_elements": ["No answer submitted"],
                "citations": [],
            }
        else:
            # Retrieve context for grading
            chunks = retrieve_for_exam(
                db,
                session.course_id,
                question.question_text,
                include_mastered=include_mastered,
            )

            # Grade with AI
            feedback = _grade_single_question(
                question=question,
                chunks=chunks,
                rubric=rubric,
                level=session.level,
                api_key=api_key,
                provider=provider,
            )

            question.awarded_score = feedback["awarded_score"]
            question.feedback = feedback

        total_awarded += question.awarded_score or 0
        total_max += question.max_score

        # Collect scores per topic for mastery updates
        if question.topic_id not in topic_scores:
            topic_scores[question.topic_id] = []
        percentage = (
            (question.awarded_score / question.max_score * 100)
            if question.max_score > 0
            else 0
        )
        topic_scores[question.topic_id].append(percentage)

    # Update session
    session.score = total_awarded
    session.status = ExamStatus.GRADED
    session.completed_at = datetime.now(timezone.utc)

    # Update mastery for each topic
    for topic_id, scores in topic_scores.items():
        avg_percentage = sum(scores) / len(scores)
        update_mastery(db, topic_id, avg_percentage)

    db.commit()
    db.refresh(session)
    return session


def _grade_single_question(
    question: ExamQuestion,
    chunks: list[dict],
    rubric: list[dict],
    level: ExamLevel,
    api_key: str,
    provider: str = "anthropic",
) -> dict:
    """Grade a single question using AI provider with strict rubric enforcement."""
    prompt = _build_grading_prompt(question, chunks, rubric, level)

    system_prompt = """You are a strict university professor grading student exams. You must:
1. Grade STRICTLY according to the provided rubric criteria
2. Award scores based on demonstrated knowledge, not implied understanding
3. Identify specific missing elements the student failed to address
4. Provide citations from the course material for every scoring decision
5. If no citation can be found, state: "No direct source located in unlocked material."
6. Output ONLY valid JSON matching the specified schema. No additional text."""

    response_text = chat_completion(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=prompt,
        provider=provider,
    )

    try:
        result = parse_json_response(response_text, expect_array=False)
    except ValueError:
        # Fallback: return zero score with error
        return {
            "awarded_score": 0,
            "max_score": question.max_score,
            "rubric_breakdown": {},
            "missing_elements": ["Grading error: could not parse LLM response"],
            "citations": [],
        }

    # Ensure awarded_score doesn't exceed max
    result["awarded_score"] = min(
        float(result.get("awarded_score", 0)),
        float(question.max_score),
    )
    result["max_score"] = question.max_score

    # Ensure required fields exist
    result.setdefault("rubric_breakdown", {})
    result.setdefault("missing_elements", [])
    result.setdefault("citations", [])

    return result


def _build_grading_prompt(
    question: ExamQuestion,
    chunks: list[dict],
    rubric: list[dict],
    level: ExamLevel,
) -> str:
    """Build the grading prompt with rubric, context, and student answer."""
    # Build rubric section
    rubric_text = "\n".join(
        f"- {r['criteria_name']}: {r['max_score']} points — {r['description']}"
        for r in rubric
    )

    # Build context section from retrieved chunks with source type labels
    if chunks:
        context_text = "\n\n".join(
            f"[{c.get('file_type', 'TEXTBOOK')} — {c['file_name']}, Page {c['page_number']}]\n{c['content']}"
            for c in chunks
        )
    else:
        context_text = "No relevant course material found for this question."

    level_strictness = {
        ExamLevel.FLASHCARD: "Basic correctness check. Be lenient.",
        ExamLevel.LEVEL1: "Light rubric enforcement. Focus on factual accuracy.",
        ExamLevel.LEVEL2: "Moderate rubric enforcement. Expect application of concepts.",
        ExamLevel.EXAM: "STRICT rubric enforcement. Expect synthesis, framework usage, and cross-topic reasoning.",
    }

    return f"""Grade the following student answer.

QUESTION (worth {question.max_score} points):
{question.question_text}

STUDENT ANSWER:
{question.student_answer}

RUBRIC CRITERIA:
{rubric_text}

GRADING STRICTNESS: {level_strictness.get(level, 'Standard grading.')}

SOURCE PRIORITY (use when determining correctness and completeness):
- TRANSCRIPT sources carry the highest authority (what the professor said)
- SLIDES sources carry high authority (what the professor presented)
- NOTES sources carry medium authority
- TEXTBOOK sources carry base authority
If the student's answer aligns with TRANSCRIPT/SLIDES content, weigh that more favorably.

RELEVANT COURSE MATERIAL:
{context_text}

Grade the answer and output ONLY this JSON structure:
{{
  "awarded_score": <number>,
  "max_score": {question.max_score},
  "rubric_breakdown": {{
    "<criteria_name>": <score_awarded>,
    ...
  }},
  "missing_elements": [
    "<specific element the student missed>",
    ...
  ],
  "citations": [
    {{"source": "<file_name>", "page": <page_number>}},
    ...
  ]
}}

CITATION RULE: Every scoring decision must reference course material.
If no source found: use {{"source": "No direct source located in unlocked material.", "page": 0}}"""


def grade_flashcards(
    db: Session,
    course_id: str,
    answers: list[dict],
    api_key: str,
    provider: str = "anthropic",
) -> list[dict]:
    """Grade flashcard answers — simpler grading with pass/fail per question.

    Returns list of {question_id, correct, expected_answer, feedback}.
    """
    # Retrieve context for grading
    all_questions_text = "\n".join(a.get("question", "") for a in answers)
    chunks = retrieve_for_exam(db, course_id, all_questions_text, include_mastered=False)

    context_text = "\n\n".join(
        f"[Source: {c['file_name']}, Page {c['page_number']}]\n{c['content']}"
        for c in chunks
    ) if chunks else "No course material available."

    # Build batch grading prompt
    questions_text = "\n\n".join(
        f"Q{i+1} (ID: {a['question_id']}):\nQuestion: {a['question']}\nStudent Answer: {a['answer']}"
        for i, a in enumerate(answers)
    )

    prompt = f"""Grade these flashcard answers as correct or incorrect.

{questions_text}

COURSE MATERIAL:
{context_text}

For each question, output JSON array:
[
  {{
    "question_id": "<id>",
    "correct": true/false,
    "expected_answer": "<brief correct answer>",
    "feedback": "<brief explanation>"
  }},
  ...
]

Output ONLY the JSON array."""

    system_prompt = "You are a strict professor grading flashcard answers. Be objective. Output only valid JSON."

    response_text = chat_completion(
        api_key=api_key,
        system_prompt=system_prompt,
        user_prompt=prompt,
        provider=provider,
    )

    try:
        results = parse_json_response(response_text, expect_array=True)
    except ValueError:
        results = []

    return results
