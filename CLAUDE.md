# StudyEngine — Curriculum-Aware AI Study System

## Project Overview
A course-isolated, progressive, rubric-based exam simulator with mastery tracking. NOT a chatbot — a structured LMS-style exam system powered by AI grading.

## Architecture
- **Single-user** (no authentication)
- **Monorepo**: `/frontend` (Next.js) + `/backend` (FastAPI)
- **API key**: User provides Anthropic API key via UI, stored in localStorage, sent via `X-API-Key` header

## Tech Stack

### Frontend
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- KaTeX (LaTeX rendering in questions/answers)
- React Query / TanStack Query (server state)

### Backend
- FastAPI (Python 3.11+)
- SQLAlchemy 2.0 (async not required, sync is fine)
- SQLite (via `storage/studyengine.db`)
- Alembic (migrations)
- LangChain (text splitting only — RecursiveCharacterTextSplitter)
- ChromaDB (vector store, one collection per course)

### AI
- Anthropic Claude API (claude-sonnet-4-5-20250929 default)
- Structured JSON outputs enforced
- Citation-backed grading mandatory

### File Parsing
- PyMuPDF / fitz (PDF)
- python-docx (DOCX)
- python-pptx (PPTX)
- Plain read (TXT)

## Project Structure
```
/
├── CLAUDE.md
├── .gitignore
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py              # FastAPI app, CORS, router mounting
│   │   ├── config.py            # Settings, paths, constants
│   │   ├── database.py          # Engine, SessionLocal, Base
│   │   ├── models/              # SQLAlchemy models
│   │   ├── schemas/             # Pydantic request/response
│   │   ├── routers/             # API route handlers
│   │   ├── services/            # Business logic modules
│   │   └── utils/               # Helpers (parsers, chroma client)
│   └── storage/
│       ├── studyengine.db       # SQLite database
│       └── courses/             # Per-course file storage
│           └── {course_id}/
│               ├── textbooks/
│               ├── transcripts/
│               ├── notes/
│               ├── syllabus/
│               └── slides/
├── frontend/
│   └── src/
│       ├── app/                 # Next.js pages (App Router)
│       ├── components/          # React components
│       ├── lib/                 # API client, types, utilities
│       └── hooks/               # Custom React hooks
└── chroma_data/                 # ChromaDB persistent storage
```

## Database Schema

### Courses
| Column | Type | Notes |
|--------|------|-------|
| id | UUID (string) | Primary key |
| name | String | Required |
| description | Text | Optional |
| created_at | DateTime | Auto |

### Topics
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| course_id | UUID | FK → Courses |
| name | String | Required |
| week_number | Integer | Optional ordering |
| status | Enum | LOCKED / IN_PROGRESS / MASTERED |
| mastery_score | Float | 0–100, default 0 |

### Documents
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| course_id | UUID | FK → Courses |
| file_name | String | Original filename |
| file_type | Enum | TEXTBOOK / TRANSCRIPT / NOTES / SYLLABUS / SLIDES |
| storage_path | String | Relative path in storage/ |
| uploaded_at | DateTime | Auto |

### DocumentChunks
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| document_id | UUID | FK → Documents |
| topic_id | UUID | FK → Topics (nullable) |
| page_number | Integer | Source page |
| content | Text | Chunk text |
| vector_id | String | ChromaDB vector ID |

### Rubrics
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| course_id | UUID | FK → Courses |
| level | Enum | LEVEL1 / LEVEL2 / EXAM |
| criteria_name | String | e.g. "content_accuracy" |
| max_score | Integer | Points available |
| description | Text | What this criterion measures |

### ExamSessions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| course_id | UUID | FK → Courses |
| level | Enum | FLASHCARD / LEVEL1 / LEVEL2 / EXAM |
| status | Enum | IN_PROGRESS / SUBMITTED / GRADED |
| duration_minutes | Integer | Time limit |
| started_at | DateTime | When session began |
| submitted_at | DateTime | Nullable until submitted |
| completed_at | DateTime | Nullable until graded |
| score | Float | Nullable until graded |
| max_score | Float | Total possible |

### ExamQuestions
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| exam_session_id | UUID | FK → ExamSessions |
| topic_id | UUID | FK → Topics |
| question_number | Integer | Ordering |
| question_text | Text | Generated question |
| student_answer | Text | Nullable until answered |
| max_score | Float | Points available |
| awarded_score | Float | Nullable until graded |
| feedback | JSON | Full grading output |

### StudySchedule
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| course_id | UUID | FK → Courses |
| topic_id | UUID | FK → Topics |
| scheduled_type | String | "flashcard_drill" |
| scheduled_at | DateTime | When to do it |
| completed | Boolean | Default false |

### Settings
| Column | Type | Notes |
|--------|------|-------|
| id | Integer | PK |
| key | String | Unique setting name |
| value | Text | Setting value |

## Critical Rules

### 1. Course Isolation (NEVER VIOLATE)
- Each course gets its own ChromaDB collection: `course_{course_id}`
- All DB queries MUST filter by `course_id`
- File storage is per-course: `storage/courses/{course_id}/`
- Deleting a course removes: DB rows + ChromaDB collection + stored files
- Retrieval MUST NEVER cross course boundaries

### 2. Topic Locking (MOST CRITICAL FEATURE)
- Only retrieve chunks where `topic.status != LOCKED`
- Question generation filters: IN_PROGRESS only for Level1/Level2, IN_PROGRESS + MASTERED for Exam
- Locked topics are invisible to: flashcards, tests, exams, AI explanations
- If no unlocked topics: return `"No unlocked topics available for testing."`

### 3. Timer Enforcement
- Backend records `started_at` + `duration_minutes`
- Frontend countdown: `remaining = (started_at + duration) - server_now`
- Auto-submit fires at timer=0
- Backend rejects submissions after `started_at + duration + 30s grace`
- No editing after submission

### 4. Grading (LLM as Strict Professor)
- Always load course rubric
- Compare answer against retrieved chunks + transcript emphasis
- Citations are MANDATORY — if none found: `"No direct source located in unlocked material."`
- Output format:
```json
{
  "awarded_score": 14,
  "max_score": 20,
  "rubric_breakdown": {
    "content_accuracy": 8,
    "clarity": 3,
    "required_framework_usage": 3
  },
  "missing_elements": [
    "Did not mention Second Law definition",
    "No example provided"
  ],
  "citations": [
    {"source": "Textbook_A.pdf", "page": 142}
  ]
}
```

### 5. Mastery Formula
```
new_mastery = (previous_mastery * 0.7) + (percentage_score * 0.3)
```
- < 60 → Needs Review (stays IN_PROGRESS)
- 60–80 → In Progress
- ≥ 80 → MASTERED
- < 50 → Auto-schedule flashcard drill

## Study Modes

| Mode | Duration | Questions | Score | Topics Used |
|------|----------|-----------|-------|-------------|
| Flashcard | — | 5–10 | Pass/Fail each | IN_PROGRESS |
| Level 1 | 20 min | 2 | /20 | IN_PROGRESS |
| Level 2 | 60 min | 3–4 | /40 | IN_PROGRESS |
| Exam | 120 min | 5 | /100 | IN_PROGRESS + MASTERED |

## API Endpoints

### Courses
- `POST /api/courses` — Create course
- `GET /api/courses` — List courses
- `GET /api/courses/{id}` — Course detail
- `DELETE /api/courses/{id}` — Delete course + all data

### Topics
- `GET /api/courses/{id}/topics` — List with status/mastery
- `PATCH /api/courses/{id}/topics/{tid}` — Update status
- `POST /api/courses/{id}/topics/bulk` — Bulk update

### Documents
- `POST /api/courses/{id}/documents/upload` — Upload + process
- `GET /api/courses/{id}/documents` — List documents
- `DELETE /api/courses/{id}/documents/{did}` — Remove + cleanup

### Exams
- `POST /api/courses/{id}/exams/start` — Start session
- `GET /api/courses/{id}/exams/{sid}` — Get session + questions
- `POST /api/courses/{id}/exams/{sid}/submit` — Submit + grade
- `GET /api/courses/{id}/exams/{sid}/results` — Graded results
- `GET /api/courses/{id}/exams` — Session history

### Flashcards
- `POST /api/courses/{id}/flashcards/generate` — Generate set
- `POST /api/courses/{id}/flashcards/grade` — Grade responses

### Settings
- `GET /api/settings` — Get all settings
- `PUT /api/settings` — Update settings

## Document Processing Pipeline
1. Upload file → validate type → save to `storage/courses/{course_id}/{file_type}/`
2. Parse text: PyMuPDF (PDF), python-docx (DOCX), python-pptx (PPTX), read (TXT)
3. Split: LangChain `RecursiveCharacterTextSplitter(chunk_size=1000, overlap=200)`
4. Metadata per chunk: `{course_id, document_id, page_number, file_name}`
5. Embed + store in ChromaDB collection `course_{course_id}`
6. Create `DocumentChunk` rows in DB
7. Topic linking: manual assignment or auto-detect via syllabus keywords

## Retrieval Rules
1. Identify eligible topics (filter by status)
2. Query ChromaDB with `WHERE course_id = X AND topic_id IN [eligible]`
3. Retrieve top 5 relevant chunks
4. Generate question grounded ONLY in retrieved chunks
5. Attach citation metadata (source file + page)
6. AI must NEVER fabricate content beyond retrieved material

## Failsafe Rules
- Cannot start exam if no unlocked topics exist
- Cannot retake EXAM mode within 24 hours (unless forced)
- Cannot edit answers after submission
- All grading outputs logged for transparency

## Service Modules (must be isolated and testable)
- `exam_engine.py` — Question generation, session management
- `grading_engine.py` — Rubric-based LLM grading
- `syllabus_manager.py` — Rubric parsing and management
- `mastery_engine.py` — Score updates, status transitions, scheduling
- `retrieval_engine.py` — Course-scoped RAG retrieval
- `document_processor.py` — Upload → parse → chunk → embed pipeline

## Development Phases
1. **Foundation**: Course CRUD, file upload, topic management, document processing, basic frontend
2. **Study**: Flashcards, Level 1 tests, basic grading, timer, retrieval engine
3. **Full Grading**: Rubric enforcement, Exam mode, mastery system, feedback UI
4. **Polish**: Analytics, study scheduling, performance history, edge cases

## Conventions
- Backend: Python 3.11+, type hints everywhere, docstrings on public functions
- Frontend: TypeScript strict, functional components, named exports
- API: All endpoints prefixed with `/api/`
- IDs: UUID strings (use `uuid4()`)
- Errors: Return proper HTTP status codes with `{"detail": "message"}` body
- All API key usage: extract from `X-API-Key` request header
