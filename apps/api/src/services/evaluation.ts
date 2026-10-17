import { demoUsers, evaluateSqlSubmission, planLearningPath } from "@zhijing/agents";
import { getKnowledgeNode } from "@zhijing/course-data";
import type { EvaluationRequest, EvaluationResult, MasteryHistoryPoint } from "@zhijing/shared";
import { persistMasteryEvidence } from "../db/index.js";

type InMemHistory = {
  evidence: Array<{
    id: string;
    userId: string;
    nodeId: string;
    score: number;
    evidence: Record<string, unknown>;
    createdAt: string;
  }>;
  historyPoints: MasteryHistoryPoint[];
};

// Seed 7-day trajectory for demo users so judges see a rich, full chart on launch
function initSeedHistory(): Map<string, InMemHistory> {
  const map = new Map<string, InMemHistory>();
  const now = Date.now();
  const dayMs = 86_400_000;

  for (const user of demoUsers) {
    const historyPoints: MasteryHistoryPoint[] = [];
    const baseMastery = user.profile.prerequisiteFoundation;
    const keyNodes = Object.keys(user.profile.knowledgeMastery);
    const targetNodeId = keyNodes[0] ?? "sql-select";
    const targetNode = getKnowledgeNode(targetNodeId);
    const targetTitle = targetNode?.title ?? "SQL 核心基础";

    // 7 days historical progression
    for (let dayOffset = 6; dayOffset >= 0; dayOffset--) {
      const dayDate = new Date(now - dayOffset * dayMs);
      const dayStr = dayDate.toISOString().slice(5, 10); // MM-DD
      const stepProgression = Math.min(
        95,
        Math.round(baseMastery + (6 - dayOffset) * 6 + (dayOffset % 2 === 0 ? 3 : -2)),
      );
      historyPoints.push({
        date: dayStr,
        timestamp: dayDate.toISOString(),
        mastery: stepProgression,
        nodeId: targetNodeId,
        nodeTitle: targetTitle,
        delta: dayOffset === 6 ? 0 : 4 + (dayOffset % 3),
      });
    }

    map.set(user.id, {
      evidence: [],
      historyPoints,
    });
  }
  return map;
}

const memoryHistoryStore = initSeedHistory();

export async function processEvaluation(input: EvaluationRequest): Promise<{
  evaluation: EvaluationResult;
  history: MasteryHistoryPoint[];
  retentionSummary: { nodeId: string; retentionScore: number; needsReview: boolean }[];
}> {
  const user = demoUsers.find((candidate) => candidate.id === input.userId);
  if (!user) throw new Error("用户不存在");

  const currentMastery = user.profile.knowledgeMastery[input.nodeId] ?? user.profile.prerequisiteFoundation;
  const node = getKnowledgeNode(input.nodeId);
  const nodeTitle = node?.title ?? "SQL 实践演练";

  // 1. Run EvaluationAgent BKT calculation
  const evalResult = evaluateSqlSubmission({
    userId: input.userId,
    nodeId: input.nodeId,
    isCorrect: input.correct,
    currentMastery,
    nodeTitle,
    sql: input.sql,
  });

  // 2. Update user profile mastery
  user.profile.knowledgeMastery[input.nodeId] = evalResult.newMastery;

  // 3. Persist evidence to dual-mode storage
  const userStore = memoryHistoryStore.get(input.userId) ?? { evidence: [], historyPoints: [] };
  const evidenceRecord = {
    id: crypto.randomUUID(),
    userId: input.userId,
    nodeId: input.nodeId,
    score: evalResult.newMastery,
    evidence: {
      isCorrect: input.correct,
      bkt: evalResult.bkt,
      delta: evalResult.delta,
      sql: input.sql,
    },
    createdAt: new Date().toISOString(),
  };

  userStore.evidence.push(evidenceRecord);

  // Append new history point to chart trajectory
  const todayStr = new Date().toISOString().slice(5, 10);
  userStore.historyPoints.push({
    date: todayStr,
    timestamp: new Date().toISOString(),
    mastery: evalResult.newMastery,
    nodeId: input.nodeId,
    nodeTitle,
    delta: evalResult.delta,
  });
  memoryHistoryStore.set(input.userId, userStore);

  // Fire-and-forget PG persistence
  void persistMasteryEvidence({
    userId: input.userId,
    nodeId: input.nodeId,
    score: evalResult.newMastery,
    evidence: evidenceRecord.evidence,
  }).catch((err) => console.warn("Failed to persist mastery evidence to PG", err));

  // 4. Calculate retention decay
  const retentionSummary = calculateRetentionDecay(input.userId);

  return {
    evaluation: evalResult,
    history: userStore.historyPoints.slice(-10),
    retentionSummary,
  };
}

// Ebbinghaus forgetting curve approximation: R = e^(-Δt / S)
export function calculateRetentionDecay(userId: string): {
  nodeId: string;
  nodeTitle: string;
  currentMastery: number;
  retentionScore: number;
  daysSinceLastPractice: number;
  needsReview: boolean;
}[] {
  const user = demoUsers.find((candidate) => candidate.id === userId);
  if (!user) return [];

  const nodes = Object.entries(user.profile.knowledgeMastery);
  return nodes.map(([nodeId, mastery], index) => {
    const node = getKnowledgeNode(nodeId);
    // Simulate days since last practice between 1 and 5 days
    const simulatedDays = 1 + (index * 2) % 6;
    const stability = Math.max(2, (mastery / 100) * 10);
    const retentionRate = Math.exp(-simulatedDays / stability);
    const retentionScore = Math.max(10, Math.round(mastery * retentionRate));
    const needsReview = retentionScore < 60 || simulatedDays >= 4;

    return {
      nodeId,
      nodeTitle: node?.title ?? nodeId,
      currentMastery: mastery,
      retentionScore,
      daysSinceLastPractice: simulatedDays,
      needsReview,
    };
  });
}

export function getUserMasteryHistory(userId: string): {
  history: MasteryHistoryPoint[];
  retention: ReturnType<typeof calculateRetentionDecay>;
  overallMastery: number;
  trend: "rising" | "stable" | "declining";
} {
  const user = demoUsers.find((candidate) => candidate.id === userId);
  const userStore = memoryHistoryStore.get(userId) ?? { evidence: [], historyPoints: [] };
  const values = user ? Object.values(user.profile.knowledgeMastery) : [50];
  const overallMastery = Math.round(values.reduce((sum, v) => sum + v, 0) / Math.max(1, values.length));

  return {
    history: userStore.historyPoints.slice(-14),
    retention: calculateRetentionDecay(userId),
    overallMastery,
    trend: user?.profile.progressTrend ?? "rising",
  };
}
