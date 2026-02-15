// ============================================================
// StudyEngine TypeScript Types
// ============================================================

// Enums
export type TopicStatus = "LOCKED" | "IN_PROGRESS" | "MASTERED";
export type FileType = "TEXTBOOK" | "TRANSCRIPT" | "NOTES" | "SYLLABUS" | "SLIDES";
export type ExamLevel = "FLASHCARD" | "LEVEL1" | "LEVEL2" | "EXAM";
export type ExamStatus = "IN_PROGRESS" | "SUBMITTED" | "GRADED";

// Course
export interface TopicSummary {
  total: number;
  locked: number;
  in_progress: number;
  mastered: number;
}

export interface Course {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  topic_summary?: TopicSummary;
}

export interface CourseListItem {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  topic_count: number;
  document_count: number;
}

export interface CourseCreate {
  name: string;
  description?: string;
}

// Topic
export interface Topic {
  id: string;
  course_id: string;
  name: string;
  week_number: number | null;
  status: TopicStatus;
  mastery_score: number;
}

export interface TopicCreate {
  name: string;
  week_number?: number;
  status?: TopicStatus;
}

export interface TopicUpdate {
  name?: string;
  week_number?: number;
  status?: TopicStatus;
}

export interface TopicBulkUpdate {
  topic_ids: string[];
  status: TopicStatus;
}

// Document
export interface Document {
  id: string;
  course_id: string;
  file_name: string;
  file_type: FileType;
  uploaded_at: string;
  chunk_count: number;
}

export interface DocumentUploadResponse {
  id: string;
  file_name: string;
  file_type: FileType;
  chunks_created: number;
  message: string;
}

// Exam
export interface ExamQuestion {
  id: string;
  question_number: number;
  question_text: string;
  topic_id: string;
  max_score: number;
  student_answer: string | null;
  awarded_score: number | null;
  feedback: GradingFeedback | null;
}

export interface GradingFeedback {
  awarded_score: number;
  max_score: number;
  rubric_breakdown: Record<string, number>;
  missing_elements: string[];
  citations: Citation[];
}

export interface Citation {
  source: string;
  page: number;
}

export interface ExamSession {
  id: string;
  course_id: string;
  level: ExamLevel;
  status: ExamStatus;
  duration_minutes: number | null;
  started_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  score: number | null;
  max_score: number | null;
  questions: ExamQuestion[];
}

export interface ExamSessionListItem {
  id: string;
  course_id: string;
  level: ExamLevel;
  status: ExamStatus;
  duration_minutes: number | null;
  started_at: string;
  score: number | null;
  max_score: number | null;
}

export interface ExamStartRequest {
  level: ExamLevel;
  force?: boolean;
}

export interface AnswerSubmission {
  question_id: string;
  answer: string;
}

export interface ExamSubmitRequest {
  answers: AnswerSubmission[];
}

export interface ExamResults {
  session: ExamSession;
  total_score: number;
  max_total_score: number;
  percentage: number;
}

// Flashcard
export interface FlashcardQuestion {
  id: string;
  question: string;
  topic_id: string;
  topic_name: string;
}

export interface FlashcardGenerateResponse {
  questions: FlashcardQuestion[];
  topic_ids_used: string[];
}

export interface FlashcardAnswer {
  question_id: string;
  question: string;
  answer: string;
  topic_id: string;
}

export interface FlashcardGradeRequest {
  answers: FlashcardAnswer[];
}

export interface FlashcardResult {
  question_id: string;
  question: string;
  correct: boolean;
  expected_answer: string;
  feedback: string;
}

export interface FlashcardGradeResponse {
  results: FlashcardResult[];
  total_correct: number;
  total_questions: number;
  mastery_updates: Record<string, number>;
}

// Settings
export interface Setting {
  key: string;
  value: string | null;
}
