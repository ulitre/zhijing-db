import { getKnowledgeNode, knowledgeNodes } from "@zhijing/course-data";
import type {
  AgentEvent,
  AgentName,
  DemoUser,
  LearnerProfile,
  LearningResource,
  MasteryEvidence,
  PathStep,
} from "@zhijing/shared";

export const AGENTS: ReadonlyArray<{ name: AgentName; responsibility: string }> = [
  { name: "Orchestrator", responsibility: "固定图编排、检查点和失败降级" },
  { name: "ProfileAgent", responsibility: "从对话、诊断和行为更新八维画像" },
  { name: "DiagnosisAgent", responsibility: "定位知识断点、前置缺失和错误模式" },
  { name: "PathAgent", responsibility: "按知识依赖与掌握度规划动态学习路径" },
  { name: "DocumentAgent", responsibility: "生成个性化知识讲解文档" },
  { name: "DiagramAgent", responsibility: "生成知识导图与结构图" },
  { name: "QuizAgent", responsibility: "生成分层练习、答案和解析" },
  { name: "SQLLabAgent", responsibility: "生成可验证的 SQL 实操任务" },
  { name: "ReadingAgent", responsibility: "生成拓展阅读与复习卡片" },
  { name: "ReviewAgent", responsibility: "审核事实、引用、难度、安全与格式" },
  { name: "TutorAgent", responsibility: "基于课程证据提供即时辅导" },
  { name: "EvaluationAgent", responsibility: "评估学习效果并触发路径重规划" },
] as const;

export const demoUsers: DemoUser[] = [
  {
    id: "demo-foundation",
    username: "foundation",
    displayName: "基础薄弱型学生",
    persona: "foundation",
    profile: {
      prerequisiteFoundation: 42,
      knowledgeMastery: { relations: 48, "keys-integrity": 35, "sql-select": 44 },
      learningGoal: "补齐关系模型基础，并能独立完成校园选课系统的基础查询",
      learningPreference: "visual",
      weeklyMinutes: 240,
      commonErrorPattern: "容易混淆主键、候选键与外键",
      resourcePreference: ["diagram", "document"],
      progressTrend: "stable",
    },
  },
  {
    id: "demo-exam",
    username: "exam",
    displayName: "应试巩固型学生",
    persona: "exam",
    profile: {
      prerequisiteFoundation: 72,
      knowledgeMastery: { relations: 82, "keys-integrity": 76, "fd-anomalies": 58, "nf-3bc": 46 },
      learningGoal: "在短时间内巩固规范化、事务与高频易错题",
      learningPreference: "concise",
      weeklyMinutes: 180,
      commonErrorPattern: "会套范式结论，但不会用闭包证明",
      resourcePreference: ["quiz", "reading"],
      progressTrend: "rising",
    },
  },
  {
    id: "demo-practice",
    username: "practice",
    displayName: "实践导向型学生",
    persona: "practice",
    profile: {
      prerequisiteFoundation: 78,
      knowledgeMastery: { "sql-select": 88, "sql-joins": 84, "nf-3bc": 55, isolation: 52, "index-design": 48 },
      learningGoal: "通过可执行案例掌握事务、索引和查询优化",
      learningPreference: "practice",
      weeklyMinutes: 360,
      commonErrorPattern: "能写出查询，但缺少执行计划和并发意识",
      resourcePreference: ["sql-lab", "visual"],
      progressTrend: "rising",
    },
  },
];

export function calculateEvidenceScore(evidence: MasteryEvidence): number {
  return Math.round(
    evidence.correctness * 0.6 +
      evidence.hintIndependence * 0.15 +
      evidence.responseQuality * 0.15 +
      evidence.confidenceCalibration * 0.1,
  );
}

export function updateMastery(oldMastery: number, evidence: MasteryEvidence): number {
  const score = calculateEvidenceScore(evidence);
  return Math.max(0, Math.min(100, Math.round(oldMastery * 0.7 + score * 0.3)));
}

export type BktParams = {
  pTransit?: number;
  pGuess?: number;
  pSlip?: number;
};

export type BktUpdateResult = {
  prior: number;
  posterior: number;
  newMastery: number;
  delta: number;
  transit: number;
};

export function computeBktUpdate(
  currentMastery: number,
  isCorrect: boolean,
  params: BktParams = {},
): BktUpdateResult {
  const pT = params.pTransit ?? 0.15;
  const pG = params.pGuess ?? 0.20;
  const pS = params.pSlip ?? 0.10;

  const prior = Math.max(0.05, Math.min(0.95, currentMastery / 100));

  let posterior: number;
  if (isCorrect) {
    const numerator = prior * (1 - pS);
    const denominator = numerator + (1 - prior) * pG;
    posterior = denominator > 0 ? numerator / denominator : prior;
  } else {
    const numerator = prior * pS;
    const denominator = numerator + (1 - prior) * (1 - pG);
    posterior = denominator > 0 ? numerator / denominator : prior;
  }

  const newP = posterior + (1 - posterior) * pT;
  const newMastery = Math.max(5, Math.min(99, Math.round(newP * 100)));
  const delta = newMastery - currentMastery;

  return {
    prior: Math.round(prior * 100),
    posterior: Math.round(posterior * 100),
    newMastery,
    delta,
    transit: Math.round(pT * 100),
  };
}

export function evaluateSqlSubmission(input: {
  userId: string;
  nodeId: string;
  isCorrect: boolean;
  currentMastery: number;
  nodeTitle?: string | undefined;
  sql?: string | undefined;
}) {
  const bkt = computeBktUpdate(input.currentMastery, input.isCorrect);
  const feedback = input.isCorrect
    ? `EvaluationAgent 评测通过：SQL 验证通过，简化版 BKT 计算将掌握度从 ${input.currentMastery}% 提升至 ${bkt.newMastery}% (+${bkt.delta}%)。`
    : `EvaluationAgent 评测未通过：SQL 执行未达预期，BKT 调整后掌握度为 ${bkt.newMastery}% (${bkt.delta}%)。`;

  const unlockedBadges: string[] = [];
  if (input.isCorrect) {
    unlockedBadges.push("初探八表");
    if (bkt.newMastery >= 75) unlockedBadges.push("SQL实战达人");
    if (input.sql && /join/i.test(input.sql)) unlockedBadges.push("多表联结专家");
    if (input.sql && /over\s*\(/i.test(input.sql)) unlockedBadges.push("窗口函数探秘者");
  }

  return {
    userId: input.userId,
    nodeId: input.nodeId,
    conceptTitle: input.nodeTitle ?? "SQL 综合实战",
    prevMastery: input.currentMastery,
    newMastery: bkt.newMastery,
    delta: bkt.delta,
    bkt: {
      prior: bkt.prior,
      posterior: bkt.posterior,
      transit: bkt.transit,
    },
    feedback,
    unlockedBadges,
    timestamp: new Date().toISOString(),
  };
}

export function diagnoseErrorPatterns(user: DemoUser, nodeId: string): {
  tags: string[];
  rootCause: string;
  promptInject: string;
} {
  const node = getKnowledgeNode(nodeId);
  const patterns: Record<string, { tags: string[]; rootCause: string; hint: string }> = {
    "relations": {
      tags: ["概念混淆", "元组属性映射"],
      rootCause: "未能区分关系模式与关系实例的区别",
      hint: "强调区分属性、域与元组，结合具体选课表结构说明。",
    },
    "keys-integrity": {
      tags: ["键完整性混淆", "外键约束违反"],
      rootCause: user.profile.commonErrorPattern || "容易混淆主键、候选键与外键",
      hint: "重点对比主键（唯一非空）与外键（参照完整性），列出正反例。",
    },
    "sql-select": {
      tags: ["NULL逻辑混淆", "WHERE过滤阶段错误"],
      rootCause: "在处理三值逻辑 (TRUE/FALSE/UNKNOWN) 时发生过滤漂移",
      hint: "说明 IS NULL 与 = NULL 的本质差别，并给出防错技巧。",
    },
    "sql-joins": {
      tags: ["JOIN 笛卡尔积隐患", "连接键缺失"],
      rootCause: "缺少显式连接条件或错把外键当主键关联",
      hint: "特别说明多表 JOIN 时连接键与业务关系的对应，避免生成笛卡尔积。",
    },
    "sql-aggregate": {
      tags: ["HAVING与WHERE混淆", "非聚合列未分组"],
      rootCause: "混淆行级过滤与分组后聚合过滤的时序",
      hint: "强调执行顺序：FROM -> WHERE -> GROUP BY -> HAVING -> SELECT。",
    },
    "sql-advanced": {
      tags: ["窗口帧定义错误", "PARTITION BY 与 GROUP BY 混淆"],
      rootCause: "未能掌握窗口函数不改变输出行数的特性",
      hint: "详细展示 OVER (PARTITION BY ... ORDER BY ...) 的执行逻辑与对比。",
    },
    "nf-3bc": {
      tags: ["闭包证明缺失", "范式误判"],
      rootCause: user.profile.commonErrorPattern || "会套范式结论，但不会用闭包证明",
      hint: "必须要求给出属性闭包的逐步求解过程，不要直接跳到范式级别。",
    },
  };

  const matched = patterns[nodeId] ?? {
    tags: ["基础巩固", "依赖推导"],
    rootCause: user.profile.commonErrorPattern || `对 ${node?.title ?? nodeId} 的工程应用不够熟练`,
    hint: `强化针对 ${node?.title ?? nodeId} 的前置依赖推导与常见反例。`,
  };

  return {
    tags: matched.tags,
    rootCause: matched.rootCause,
    promptInject: `【DiagnosisAgent 诊断错因】学员历史常见易错点为：“${matched.rootCause}”。本次生成必须针对标签 [${matched.tags.join(", ")}]，${matched.hint}`,
  };
}

export function resolveResourceByMastery(
  mastery: number,
  preference?: LearnerProfile["learningPreference"],
): PathStep["recommendedResource"] {
  if (mastery < 40) {
    return preference === "visual" ? "diagram" : "reading";
  }
  if (mastery > 75) {
    return "sql-lab";
  }
  if (preference === "visual") return "diagram";
  if (preference === "practice") return "sql-lab";
  return "quiz";
}

export function planLearningPath(profile: LearnerProfile, limit = 8): PathStep[] {
  const mastery = profile.knowledgeMastery;
  const weakNodes = knowledgeNodes
    .map((node) => ({ node, mastery: mastery[node.id] ?? 80 }))
    .filter(({ mastery: value }) => value < 80)
    .sort((a, b) => a.mastery - b.mastery || a.node.difficulty - b.node.difficulty);

  const selected = new Map<string, (typeof weakNodes)[number]>();
  const addWithPrerequisites = (nodeId: string) => {
    const node = getKnowledgeNode(nodeId);
    if (!node || selected.has(nodeId)) return;
    for (const prerequisite of node.prerequisites) {
      if (mastery[prerequisite] !== undefined && mastery[prerequisite] < 80) addWithPrerequisites(prerequisite);
    }
    selected.set(nodeId, { node, mastery: mastery[nodeId] ?? profile.prerequisiteFoundation });
  };

  for (const candidate of weakNodes) {
    addWithPrerequisites(candidate.node.id);
    if (selected.size >= limit) break;
  }

  return [...selected.values()].slice(0, limit).map(({ node, mastery: value }, index) => ({
    id: `step-${index + 1}-${node.id}`,
    nodeId: node.id,
    title: node.title,
    reason:
      index === 0
        ? `当前掌握度 ${value}，是最优先的知识断点`
        : `它是后续知识的前置基础，当前掌握度 ${value}`,
    mastery: value,
    status: index === 0 ? "active" : "recommended",
    recommendedResource: resolveResourceByMastery(value, profile.learningPreference),
  }));
}

function resourceBody(type: LearningResource["type"], node: (typeof knowledgeNodes)[number], profile: LearnerProfile): string {
  const intro = `本资源围绕“${node.title}”，根据你的目标“${profile.learningGoal}”生成。\n学习目标：${node.objective}`;
  const prerequisites = node.prerequisites.map((id) => getKnowledgeNode(id)?.title ?? id);
  const bodies: Record<LearningResource["type"], string> = {
    document: `${intro}\n\n核心概念\n${node.objective}\n\n校园选课案例\n学生(student)以 student_id 标识，课程(course)以 course_id 标识，选课(enrollment)记录学生与课程之间的联系。设计或查询“${node.title}”时，要明确实体、键和约束如何对应业务规则。\n\n学习步骤\n1. 先回忆${prerequisites.join("、") || "本章基础概念"}。\n2. 用自己的话解释本知识点。\n3. 把解释映射到校园选课表结构，并检查约束是否保持数据正确。\n\n常见误区\n不要只记术语；应说明它解决的问题、适用条件和一个反例。\n\n自检\n如果选课表中同一学生可以选多门课程，哪组属性能标识一条选课记录？`,
    diagram: `${intro}\n\n知识结构图\n${prerequisites.length ? prerequisites.map((item) => `前置知识：${item}`).join("\n") + "\n      ↓\n" : "课程基础\n  ↓\n"}当前节点：${node.title}\n  ├─ 目标：${node.objective}\n  ├─ 校园选课：student → enrollment → course\n  └─ 验证：检查键、约束及查询结果\n\n学习顺序\n${[...prerequisites, node.title].map((item, index) => `${index + 1}. ${item}`).join("\n")}`,
    quiz: `${intro}\n\n基础题\n问题：${node.objective}\n答案：能够结合定义说明“${node.title}”解决的问题。\n解析：先识别相关关系和业务约束，再用本知识点验证设计；不要只凭字段名称判断。\n\n应用题\n问题：校园选课系统中，学生、课程与选课记录之间如何验证这一知识点？\n参考答案：定位 student、course、enrollment 中相关属性，说明联系和约束，并检查一个有效案例与一个违反约束的反例。\n解析：答案需要同时包含概念、适用关系和可验证结果。\n\n自评\n若不能指出反例，先复习${prerequisites.join("、") || "关系模型基础"}后再作答。`,
    "sql-lab": `${intro}\n\n实验目标\n查询校园选课案例中的学生、课程和成绩，观察连接键如何对应业务关系。\n\nSQL\nSELECT s.name AS student_name, c.title AS course_title, e.score\nFROM enrollment e\nJOIN student s ON s.id = e.student_id\nJOIN course c ON c.id = e.course_id\nWHERE e.score >= 80\nORDER BY e.score DESC;\n\n操作步骤\n1. 在 SQL 实验室运行查询。\n2. 将条件改为 e.score >= 90，观察结果变化。\n3. 删除一个 JOIN 条件，比较行数并解释重复行的来源。\n\n检查点\n结果列应包含学生、课程和成绩；每条记录应对应一条选课记录。`,
    visual: `${intro}\n\n交互实验步骤\n1. 观察 student、course、enrollment 三个关系及其键。\n2. 沿 student.id → enrollment.student_id 和 course.id → enrollment.course_id 追踪连接。\n3. 增加或移除连接条件，观察行数和重复记录。\n4. 对照“${node.title}”说明当前结果是否符合预期。\n\n预期结论\n连接条件必须反映真实业务联系；仅用相似名称连接不能保证正确性。`,
    reading: `${intro}\n\n复习卡\n定义：${node.objective}\n前置：${prerequisites.join("、") || "课程基础概念"}\n案例：student、course 与 enrollment\n易错：只背概念、不检查业务约束\n自测：写出一个满足规则的案例和一个违反规则的反例。`,
  };
  return bodies[type];
}

export function generateMockResource(input: {
  user: DemoUser;
  nodeId: string;
  type: LearningResource["type"];
}): LearningResource {
  const node = getKnowledgeNode(input.nodeId) ?? knowledgeNodes[0]!;
  const reasons = [
    `匹配学习偏好：${input.user.profile.learningPreference}`,
    `针对错误模式：${input.user.profile.commonErrorPattern}`,
    `当前掌握度：${input.user.profile.knowledgeMastery[node.id] ?? input.user.profile.prerequisiteFoundation}`,
  ];
  return {
    id: `resource-${input.user.id}-${node.id}-${input.type}`,
    userId: input.user.id,
    nodeId: node.id,
    type: input.type,
    title: `${node.title} · ${input.user.displayName}专属资源`,
    summary: node.objective,
    content: resourceBody(input.type, node, input.user.profile),
    difficulty: Math.max(1, Math.min(5, node.difficulty)),
    status: "approved",
    reviewScore: 92,
    sourceIds: node.sourceIds,
    personalizationReasons: reasons,
    cached: true,
    createdAt: new Date().toISOString(),
  };
}

export function buildMockRunEvents(runId: string, type: LearningResource["type"]): AgentEvent[] {
  const generator: AgentName =
    type === "document"
      ? "DocumentAgent"
      : type === "diagram" || type === "visual"
        ? "DiagramAgent"
        : type === "quiz"
          ? "QuizAgent"
          : type === "sql-lab"
            ? "SQLLabAgent"
            : "ReadingAgent";
  const steps: Array<[AgentName, string]> = [
    ["Orchestrator", "已创建确定性工作流并载入检查点"],
    ["ProfileAgent", "已读取八维画像与最近学习证据"],
    ["DiagnosisAgent", "已定位知识断点和前置依赖"],
    ["PathAgent", "已确认当前路径节点和资源策略"],
    [generator, "已生成匹配难度、形式和案例的资源"],
    ["ReviewAgent", "引用、个性化、格式和安全检查已通过"],
  ];
  return steps.map(([agent, summary], index) => ({
    runId,
    agent,
    status: "completed",
    progress: Math.round(((index + 1) / steps.length) * 100),
    summary,
    elapsedMs: 180 + index * 240,
    timestamp: new Date(Date.now() + index * 250).toISOString(),
  }));
}
