import type { AgentTraceItem, EvaluationResult, MasteryHistoryPoint, SqlExercise } from "@zhijing/shared";

export type { AgentTraceItem, EvaluationResult, MasteryHistoryPoint, SqlExercise };

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");

export type AuthResponse = { token: string; user: { id: string; username: string; displayName: string; persona: "foundation" | "exam" | "practice" }; expiresIn: number };
export function login(input: { username: string; password: string }) {
  return request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(input), timeoutMs: 15_000 });
}

export function isApiConfigured() {
  return Boolean(apiUrl);
}

type RequestOptions = RequestInit & { timeoutMs?: number };

async function request<T>(path: string, init?: RequestOptions): Promise<T> {
  if (!apiUrl) throw new Error("API URL is not configured");
  const { timeoutMs, ...requestInit } = init ?? {};
  const controller = new AbortController();
  const timer = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : undefined;
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      ...requestInit,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...requestInit.headers },
    });
    const body = await response.json();
    if (!response.ok) {
      const message = typeof body.error === "string"
        ? body.error
        : typeof body.error?.message === "string"
          ? body.error.message
          : `API ${response.status}`;
      throw new Error(message);
    }
    return body as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type DashboardResponse = {
  path: { id: string; nodeId: string; title: string; reason: string; mastery: number; status: string; recommendedResource: string }[];
  resources: { id: string; userId: string; nodeId: string; type: string; title: string; summary: string; content: string; difficulty: number; status: string; reviewScore: number; sourceIds: string[]; personalizationReasons: string[]; cached: boolean; createdAt: string; agentTrace?: AgentTraceItem[] }[];
};

export function getDashboard(userId: string) {
  return request<DashboardResponse>(`/api/dashboard/${userId}`);
}

export type GenerateResourceResponse = {
  resource: DashboardResponse["resources"][number];
  events: { runId: string; agent: string; status: string; progress: number; summary: string; elapsedMs: number; timestamp: string }[];
  agentTrace: AgentTraceItem[];
  runId: string;
  cacheHit: boolean;
};

export function generateResource(input: { userId: string; nodeId: string; type: string; forceReviewReject?: boolean }) {
  return request<GenerateResourceResponse>("/api/resources", {
    method: "POST",
    body: JSON.stringify(input),
    timeoutMs: 20_000,
  });
}

export function submitDiagnostic(input: { userId: string; answers: { nodeId: string; correctness: number; usedHint: boolean; confidence: number }[] }) {
  return request<{ path: DashboardResponse["path"] }>("/api/diagnostics", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function executeSql(input: { userId: string; mode: "query" | "experiment"; sql: string }) {
  return request<{ columns: string[]; rows: unknown[][]; rowCount: number; elapsedMs: number; sandbox: string }>("/api/sql/run", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type TutorResponse = {
  answer: string;
  citations: { id: string; title: string; url?: string }[];
  refused: boolean;
};

export function askTutor(input: { userId: string; question: string; nodeId?: string }) {
  return request<TutorResponse>("/api/tutor", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type CourseResponse = { title: string; nodes: { id: string; title: string; module: string; objective: string; difficulty: number; sourceIds: string[] }[]; sources: { id: string; title: string; organization: string; url: string; license: string }[] };
export function getCourse() { return request<CourseResponse>("/api/course"); }

export type ExercisesResponse = {
  total: number;
  coreCount: number;
  exercises: SqlExercise[];
};

export function getExercises(category?: string) {
  const query = category ? `?category=${encodeURIComponent(category)}` : "";
  return request<ExercisesResponse>(`/api/sql/exercises${query}`);
}

export type EvaluateResponse = {
  evaluation: EvaluationResult;
  history: MasteryHistoryPoint[];
  retentionSummary: { nodeId: string; retentionScore: number; needsReview: boolean }[];
};

export function evaluateSql(input: {
  userId: string;
  nodeId: string;
  correct: boolean;
  sql?: string;
  timeSpentSec?: number;
  hintCount?: number;
}) {
  return request<EvaluateResponse>("/api/evaluate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type MasteryHistoryResponse = {
  history: MasteryHistoryPoint[];
  retention: {
    nodeId: string;
    nodeTitle: string;
    currentMastery: number;
    retentionScore: number;
    daysSinceLastPractice: number;
    needsReview: boolean;
  }[];
  overallMastery: number;
  trend: "rising" | "stable" | "declining";
};

export function getMasteryHistory(userId: string) {
  return request<MasteryHistoryResponse>(`/api/mastery/history/${userId}`);
}
