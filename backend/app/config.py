import os
from pathlib import Path

# Base paths
BASE_DIR = Path(__file__).resolve().parent.parent
STORAGE_DIR = BASE_DIR / "storage"
COURSES_DIR = STORAGE_DIR / "courses"
CHROMA_DIR = BASE_DIR.parent / "chroma_data"

# Database
DATABASE_URL = f"sqlite:///{STORAGE_DIR / 'studyengine.db'}"

# Ensure directories exist
STORAGE_DIR.mkdir(parents=True, exist_ok=True)
COURSES_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Document processing
# Smaller chunks = fewer tokens per AI call without losing meaning
CHUNK_SIZE = 600
CHUNK_OVERLAP = 100

# Exam configurations
EXAM_CONFIGS = {
    "FLASHCARD": {
        "duration_minutes": None,
        "question_count_min": 5,
        "question_count_max": 10,
        "max_score": None,
    },
    "LEVEL1": {
        "duration_minutes": 20,
        "question_count_min": 2,
        "question_count_max": 2,
        "max_score": 20,
    },
    "LEVEL2": {
        "duration_minutes": 60,
        "question_count_min": 3,
        "question_count_max": 4,
        "max_score": 40,
    },
    "EXAM": {
        "duration_minutes": 120,
        "question_count_min": 5,
        "question_count_max": 5,
        "max_score": 100,
    },
}

# Mastery thresholds
MASTERY_WEIGHT_PREVIOUS = 0.7
MASTERY_WEIGHT_NEW = 0.3
MASTERY_THRESHOLD_MASTERED = 80
MASTERY_THRESHOLD_NEEDS_REVIEW = 60
MASTERY_THRESHOLD_AUTO_DRILL = 50

# Exam retake cooldown (hours)
EXAM_RETAKE_COOLDOWN_HOURS = 24

# Timer grace period (seconds)
TIMER_GRACE_PERIOD_SECONDS = 30

# Retrieval
# 3 chunks per query is enough for focused questions and keeps token costs low
TOP_K_CHUNKS = 3
# Fetch more candidates from ChromaDB, then re-rank with source weights
TOP_K_CANDIDATES = 10

# Hard cap on characters per chunk inserted into prompts.
# Prevents runaway token costs from unexpectedly large chunks.
# ~400 chars ≈ ~100 tokens — keeps each chunk concise.
MAX_CHUNK_CHARS_IN_PROMPT = 400

# Source type priority weights for retrieval re-ranking.
# Higher weight = more likely to appear in final results.
# Transcript (what the professor said) > Slides > Notes > Textbook > Syllabus.
SOURCE_TYPE_WEIGHTS: dict[str, float] = {
    "TRANSCRIPT": 1.4,
    "SLIDES": 1.25,
    "NOTES": 1.1,
    "TEXTBOOK": 1.0,
    "SYLLABUS": 0.6,
}

# Default Claude model
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"

# File type subdirectories
FILE_TYPE_DIRS = {
    "TEXTBOOK": "textbooks",
    "TRANSCRIPT": "transcripts",
    "NOTES": "notes",
    "SYLLABUS": "syllabus",
    "SLIDES": "slides",
}

# Allowed upload extensions
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".docx", ".pptx"}

# CORS
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
