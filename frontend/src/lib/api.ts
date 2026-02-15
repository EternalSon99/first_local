/**
 * API client for StudyEngine backend.
 *
 * Sends API key via X-API-Key header and AI provider via X-AI-Provider header.
 * Both values are stored in localStorage.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getApiKey(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("studyengine_api_key");
}

function getProvider(): string {
  if (typeof window === "undefined") return "anthropic";
  return localStorage.getItem("studyengine_ai_provider") || "groq";
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiKey = getApiKey();
  const provider = getProvider();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  // Don't set Content-Type for FormData
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  headers["X-AI-Provider"] = provider;

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// ============================================================
// Courses
// ============================================================
import type {
  Course,
  CourseCreate,
  CourseListItem,
  Document,
  DocumentUploadResponse,
  ExamResults,
  ExamSession,
  ExamSessionListItem,
  ExamStartRequest,
  ExamSubmitRequest,
  FileType,
  FlashcardGradeRequest,
  FlashcardGradeResponse,
  FlashcardGenerateResponse,
  Setting,
  Topic,
  TopicBulkUpdate,
  TopicCreate,
  TopicUpdate,
} from "./types";

export const api = {
  // Courses
  createCourse: (data: CourseCreate) =>
    request<Course>("/api/courses", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listCourses: () => request<CourseListItem[]>("/api/courses"),

  getCourse: (id: string) => request<Course>(`/api/courses/${id}`),

  deleteCourse: (id: string) =>
    request<void>(`/api/courses/${id}`, { method: "DELETE" }),

  // Topics
  listTopics: (courseId: string) =>
    request<Topic[]>(`/api/courses/${courseId}/topics`),

  createTopic: (courseId: string, data: TopicCreate) =>
    request<Topic>(`/api/courses/${courseId}/topics`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateTopic: (courseId: string, topicId: string, data: TopicUpdate) =>
    request<Topic>(`/api/courses/${courseId}/topics/${topicId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  deleteTopic: (courseId: string, topicId: string) =>
    request<void>(`/api/courses/${courseId}/topics/${topicId}`, {
      method: "DELETE",
    }),

  bulkUpdateTopics: (courseId: string, data: TopicBulkUpdate) =>
    request<Topic[]>(`/api/courses/${courseId}/topics/bulk`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Documents
  uploadDocument: (courseId: string, file: File, fileType: FileType) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("file_type", fileType);
    return request<DocumentUploadResponse>(
      `/api/courses/${courseId}/documents/upload`,
      { method: "POST", body: formData }
    );
  },

  listDocuments: (courseId: string) =>
    request<Document[]>(`/api/courses/${courseId}/documents`),

  deleteDocument: (courseId: string, documentId: string) =>
    request<void>(`/api/courses/${courseId}/documents/${documentId}`, {
      method: "DELETE",
    }),

  // Exams
  startExam: (courseId: string, data: ExamStartRequest) =>
    request<ExamSession>(`/api/courses/${courseId}/exams/start`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getExamSession: (courseId: string, sessionId: string) =>
    request<ExamSession>(`/api/courses/${courseId}/exams/${sessionId}`),

  submitExam: (courseId: string, sessionId: string, data: ExamSubmitRequest) =>
    request<ExamSession>(`/api/courses/${courseId}/exams/${sessionId}/submit`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getExamResults: (courseId: string, sessionId: string) =>
    request<ExamResults>(`/api/courses/${courseId}/exams/${sessionId}/results`),

  listExamSessions: (courseId: string) =>
    request<ExamSessionListItem[]>(`/api/courses/${courseId}/exams`),

  // Flashcards
  generateFlashcards: (courseId: string) =>
    request<FlashcardGenerateResponse>(
      `/api/courses/${courseId}/flashcards/generate`,
      { method: "POST" }
    ),

  gradeFlashcards: (courseId: string, data: FlashcardGradeRequest) =>
    request<FlashcardGradeResponse>(
      `/api/courses/${courseId}/flashcards/grade`,
      { method: "POST", body: JSON.stringify(data) }
    ),

  // Settings
  getSettings: () => request<Setting[]>("/api/settings"),

  updateSettings: (settings: { key: string; value: string | null }[]) =>
    request<Setting[]>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({ settings }),
    }),

  // Health
  healthCheck: () => request<{ status: string }>("/api/health"),
};
