"""StudyEngine FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import FRONTEND_URL
from app.database import Base, engine
from app.routers import courses, documents, exams, flashcards, settings, topics

# Import all models so they're registered with Base.metadata
from app.models import course, document, exam, rubric, schedule, settings as settings_model, topic  # noqa: F401

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="StudyEngine",
    description="Curriculum-Aware AI Study System — course-isolated, progressive, rubric-based exam simulator with mastery tracking.",
    version="0.1.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(courses.router)
app.include_router(topics.router)
app.include_router(documents.router)
app.include_router(exams.router)
app.include_router(flashcards.router)
app.include_router(settings.router)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "StudyEngine"}
