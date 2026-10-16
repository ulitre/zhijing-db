import { z } from "zod";

export const ProfileSchema = z.object({
  prerequisiteFoundation: z.number().min(0).max(100),
  knowledgeMastery: z.record(z.string(), z.number().min(0).max(100)),
  learningGoal: z.string().min(1),
  learningPreference: z.enum(["visual", "concise", "practice", "balanced"]),
  weeklyMinutes: z.number().int().min(30).max(2400),
  commonErrorPattern: z.string(),
  resourcePreference: z.array(z.string()).min(1),
  progressTrend: z.enum(["rising", "stable", "declining"]),
});
export type LearnerProfile = z.infer<typeof ProfileSchema>;

export const DemoUserSchema = z.object({
  id: z.string(),
  username: z.string(),
  displayName: z.string(),
  persona: z.enum(["foundation", "exam", "practice"]),
  profile: ProfileSchema,
});
export type DemoUser = z.infer<typeof DemoUserSchema>;

export const KnowledgeNodeSchema = z.object({
  id: z.string(),
  module: z.string(),
  title: z.string(),
  objective: z.string(),
  difficulty: z.number().int().min(1).max(5),
  prerequisites: z.array(z.string()),
  keywords: z.array(z.string()),
  sourceIds: z.array(z.string()).min(1),
});
export type KnowledgeNode = z.infer<typeof KnowledgeNodeSchema>;

export const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  url: z.string().url(),
  license: z.string(),
  licenseUrl: z.string().url(),
  retrievedAt: z.string(),
});
export type KnowledgeSource = z.infer<typeof SourceSchema>;

export const MasteryEvidenceSchema = z.object({
  correctness: z.number().min(0).max(100),
  hintIndependence: z.number().min(0).max(100),
  responseQuality: z.number().min(0).max(100),
  confidenceCalibration: z.number().min(0).max(100),
});
export type MasteryEvidence = z.infer<typeof MasteryEvidenceSchema>;

export const PathStepSchema = z.object({
  id: z.string(),
  nodeId: z.string(),
  title: z.string(),
  reason: z.string(),
  mastery: z.number().min(0).max(100),
  status: z.enum(["locked", "recommended", "active", "mastered"]),
  recommendedResource: z.enum(["document", "diagram", "quiz", "sql-lab", "visual", "reading"]),
});
export type PathStep = z.infer<typeof PathStepSchema>;

export const ResourceSchema = z.object({
  id: z.string(),
  userId: z.string(),
  nodeId: z.string(),
  type: z.enum(["document", "diagram", "quiz", "sql-lab", "visual", "reading"]),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  difficulty: z.number().int().min(1).max(5),
  status: z.enum(["generating", "reviewing", "approved", "rejected", "fallback"]),
  reviewScore: z.number().min(0).max(100),
  sourceIds: z.array(z.string()),
  personalizationReasons: z.array(z.string()),
  cached: z.boolean(),
  createdAt: z.string(),
});
export type LearningResource = z.infer<typeof ResourceSchema>;

export const AgentNameSchema = z.enum([
  "Orchestrator",
  "ProfileAgent",
  "DiagnosisAgent",
  "PathAgent",
  "DocumentAgent",
  "DiagramAgent",
  "QuizAgent",
  "SQLLabAgent",
  "ReadingAgent",
  "ReviewAgent",
  "TutorAgent",
  "EvaluationAgent",
]);
export type AgentName = z.infer<typeof AgentNameSchema>;

export const AgentEventSchema = z.object({
  runId: z.string(),
  agent: AgentNameSchema,
  status: z.enum(["queued", "running", "completed", "failed", "fallback"]),
  progress: z.number().min(0).max(100),
  summary: z.string(),
  elapsedMs: z.number().nonnegative(),
  timestamp: z.string(),
});
export type AgentEvent = z.infer<typeof AgentEventSchema>;

export const LoginRequestSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const DiagnosticSubmissionSchema = z.object({
  userId: z.string(),
  answers: z.array(
    z.object({
      nodeId: z.string(),
      correctness: z.number().min(0).max(100),
      usedHint: z.boolean(),
      confidence: z.number().min(0).max(100),
    }),
  ),
});

export const ResourceRequestSchema = z.object({
  userId: z.string(),
  nodeId: z.string(),
  type: ResourceSchema.shape.type,
});

export const TutorRequestSchema = z.object({
  userId: z.string(),
  question: z.string().min(2).max(1000),
  nodeId: z.string().optional(),
});

export const SqlRunRequestSchema = z.object({
  userId: z.string(),
  mode: z.enum(["query", "experiment"]),
  sql: z.string().min(1).max(16_384),
});

export type ApiError = { error: string; details?: unknown };
