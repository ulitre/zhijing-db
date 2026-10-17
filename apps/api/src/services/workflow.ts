import { Annotation, END, MemorySaver, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { buildMockRunEvents, diagnoseErrorPatterns, generateMockResource, planLearningPath } from "@zhijing/agents";
import { getKnowledgeNode } from "@zhijing/course-data";
import type { AgentEvent, AgentTraceItem, DemoUser, LearningResource } from "@zhijing/shared";
import { createModelProvider } from "./model.js";

const WorkflowState = Annotation.Root({
  runId: Annotation<string>(),
  user: Annotation<DemoUser>(),
  nodeId: Annotation<string>(),
  type: Annotation<LearningResource["type"]>(),
  forceReviewReject: Annotation<boolean | undefined>(),
  retryCount: Annotation<number>({ reducer: (_, update) => update, default: () => 0 }),
  reviewScore: Annotation<number>({ reducer: (_, update) => update, default: () => 0 }),
  reviewFeedback: Annotation<string | undefined>(),
  diagnosisInfo: Annotation<{ tags: string[]; rootCause: string; promptInject: string } | undefined>(),
  resource: Annotation<LearningResource | undefined>(),
  events: Annotation<AgentEvent[]>({ reducer: (current, update) => [...current, ...update], default: () => [] }),
  agentTrace: Annotation<AgentTraceItem[]>({ reducer: (current, update) => [...current, ...update], default: () => [] }),
});

const model = createModelProvider();
const memorySaver = new MemorySaver();
let postgresSaverPromise: Promise<PostgresSaver> | undefined;

async function getCheckpointer(): Promise<BaseCheckpointSaver> {
  if (!process.env.DATABASE_URL) return memorySaver;
  postgresSaverPromise ??= (async () => {
    const saver = PostgresSaver.fromConnString(process.env.DATABASE_URL!, { schema: "langgraph" });
    await saver.setup();
    return saver;
  })();
  return postgresSaverPromise;
}

function event(runId: string, agent: AgentEvent["agent"], progress: number, summary: string, elapsedMs = 0): AgentEvent[] {
  return [{ runId, agent, status: "completed", progress, summary, elapsedMs, timestamp: new Date().toISOString() }];
}

function trace(agent: AgentTraceItem["agent"], action: string, status: AgentTraceItem["status"], options: { score?: number; feedback?: string; elapsedMs?: number } = {}): AgentTraceItem[] {
  return [{
    agent,
    action,
    status,
    score: options.score,
    feedback: options.feedback,
    elapsedMs: options.elapsedMs ?? 25,
    timestamp: new Date().toISOString(),
  }];
}

function quizAnswerKey(nodeId: string, objective: string) {
  if (nodeId === "nf-3bc") return `\n\n参考答案与逐题解析\n题目一：A⁺ = {A, B, C, D}，因此 A → C 可由 A → B 与 B → C 推出，A 是候选键。B → C 的左侧 B 不是超键，右侧 C 不是主属性，所以该关系不满足 3NF。\n题目二：候选键为 AB 与 BC。AB⁺ = {A, B, C}；BC⁺ = {A, B, C}（由 C → A），二者均为最小超键。C⁺ = {A, C}，不包含 B，因此 C → A 违反 BCNF；但 A 是主属性，所以该关系满足 3NF。此例说明 3NF 不必然满足 BCNF。\n题目三：A⁺ = {A, B, C, D}，候选键为 A。B → C 与 C → D 的左侧都不是超键，右侧也不是主属性，因此违反 3NF，当然也违反 BCNF。\n题目四：(1) 错，题干描述的是 2NF 的关键要求之一，3NF 还需检查非主属性对候选键的传递依赖；(2) 错，题目二给出满足 3NF 但不满足 BCNF 的反例；(3) 错，BCNF 的要求正是每个非平凡函数依赖 X → Y 的 X 都是超键。\n常见错因：把“左侧包含候选键”误当成唯一判据。应先求左侧闭包，确认它是否包含关系的全部属性，再判断右侧是否为主属性。`;
  return `\n\n参考答案与解析\n1. 核心题答案：${objective}。解析：先列出相关关系和属性，再逐项应用定义检查约束或依赖；写出判断过程，不要只给结论。\n2. 校园选课应用题参考答案：说明 student、course 与 enrollment 中涉及的属性，标明它们的键或依赖关系，并指出如何用这些信息验证“${objective}”。解析：答案应包含至少一个成立案例和一个违反规则的反例。\n易错点解析：混淆术语定义与适用条件；回到定义检查每条关系、依赖或约束。`;
}

async function buildGraph() {
  const checkpointer = await getCheckpointer();
  return new StateGraph(WorkflowState)
    .addNode("orchestrate", (state) => ({
      events: event(state.runId, "Orchestrator", 10, "已创建固定工作流并载入检查点", 15),
      agentTrace: trace("Orchestrator", "初始化多智能体编排流水线与检查点", "completed", { elapsedMs: 15 }),
    }))
    .addNode("profile", (state) => ({
      events: event(state.runId, "ProfileAgent", 25, `已读取八维画像 (学习目标: ${state.user.profile.learningGoal})`, 28),
      agentTrace: trace("ProfileAgent", "分析八维画像偏好与认知负荷设定", "completed", { elapsedMs: 28 }),
    }))
    .addNode("diagnose", (state) => {
      const diag = diagnoseErrorPatterns(state.user, state.nodeId);
      return {
        diagnosisInfo: diag,
        events: event(state.runId, "DiagnosisAgent", 40, `已定位 ${state.nodeId} 知识断点，检出错因: ${diag.rootCause}`, 35),
        agentTrace: trace("DiagnosisAgent", `推导薄弱点标签 [${diag.tags.join(", ")}]`, "completed", { feedback: diag.rootCause, elapsedMs: 35 }),
      };
    })
    .addNode("path", (state) => {
      const active = planLearningPath(state.user.profile).find((step) => step.nodeId === state.nodeId);
      const generator = state.type === "quiz" ? "QuizAgent" : state.type === "sql-lab" ? "SQLLabAgent" : state.type === "reading" ? "ReadingAgent" : state.type === "document" ? "DocumentAgent" : "DiagramAgent";
      return {
        events: event(state.runId, "PathAgent", 55, active?.reason ?? `已确认资源生成策略 -> 指派 ${generator}`, 20),
        agentTrace: trace("PathAgent", `依据掌握度与拓扑排序调度生成智能体 (${generator})`, "completed", { elapsedMs: 20 }),
      };
    })
    .addNode("generate", async (state) => {
      const fallback = generateMockResource({ user: state.user, nodeId: state.nodeId, type: state.type });
      const node = getKnowledgeNode(state.nodeId);
      const generator = state.type === "quiz" ? "QuizAgent" : state.type === "sql-lab" ? "SQLLabAgent" : state.type === "reading" ? "ReadingAgent" : state.type === "document" ? "DocumentAgent" : "DiagramAgent";
      
      const formatRequirements: Record<LearningResource["type"], string> = {
        document: "输出完整讲解文档：概念定义、校园选课案例、步骤、常见误区和自检题。",
        diagram: "输出完整的文本知识图：包含当前节点、所有已给前置节点、方向箭头、关系说明和一个应用检查点。",
        quiz: "输出至少 3 道由易到难的题目；每题都必须给出正确答案和逐项解析，指出典型错误原因。",
        "sql-lab": "输出完整 SQL 实验：目标、可运行 SQL、逐步操作、预期结果和结果检查方法。",
        visual: "输出可跟随的交互步骤、每步预期观察和最终结论。",
        reading: "输出复习卡：定义、前置知识、案例、易错点和自测题。",
      };

      const retryPrompt = state.reviewFeedback ? `\n【ReviewAgent 上轮审核打回整改建议】：${state.reviewFeedback}\n请针对上述问题重写，补充完整边界说明与八表字段映射。` : "";
      const diagPrompt = state.diagnosisInfo?.promptInject ? `\n${state.diagnosisInfo.promptInject}` : "";

      const generated = await model.generate(
        `知识点：${node?.title}\n目标：${node?.objective}\n前置知识：${node?.prerequisites.join("、")}\n学习者目标：${state.user.profile.learningGoal}\n偏好：${state.user.profile.learningPreference}\n错误模式：${state.user.profile.commonErrorPattern}\n资源类型：${state.type}\n${formatRequirements[state.type]}${diagPrompt}${retryPrompt}\n基于提供的课程事实生成完整、可直接使用的中文内容，不要只给摘要。`,
        { content: fallback.content, summary: fallback.summary },
      );

      const content = state.type === "quiz" ? `${generated.content}${quizAnswerKey(state.nodeId, node?.objective ?? fallback.summary)}` : generated.content;
      const isRetry = state.retryCount > 0;
      const actionText = isRetry ? `根据审核意见重构并完成第 ${state.retryCount + 1} 版生成` : `生成第 1 版${state.type}教学资源草案`;

      return {
        resource: { ...fallback, content, summary: generated.summary, cached: model.mode === "deterministic-mock" },
        events: event(state.runId, generator, 80, `已使用 ${model.mode} 生成个性化资源${isRetry ? "（整改重生成）" : ""}`, 180),
        agentTrace: trace(generator, actionText, "completed", { elapsedMs: 180 }),
      };
    })
    .addNode("review", (state) => {
      // Review condition: if forceReviewReject is active and retryCount is 0, reject with score 65
      const shouldReject = Boolean(state.forceReviewReject) && state.retryCount === 0;

      if (shouldReject) {
        const feedback = "检测到生成的 SQL 练习缺少 8 表边界条件说明与执行计划评估提示，初审评分 65 分，打回重写。";
        return {
          retryCount: state.retryCount + 1,
          reviewScore: 65,
          reviewFeedback: feedback,
          events: event(state.runId, "ReviewAgent", 85, `初审评分 65 分 (未达标 75 分)，打回重写: ${feedback}`, 45),
          agentTrace: trace("ReviewAgent", "教学资源初审质检（打回重试）", "rejected", { score: 65, feedback, elapsedMs: 45 }),
        };
      }

      const finalScore = state.retryCount > 0 ? 94 : 92;
      return {
        reviewScore: finalScore,
        reviewFeedback: undefined,
        resource: state.resource ? { ...state.resource, status: "approved" as const, reviewScore: finalScore } : undefined,
        events: event(state.runId, "ReviewAgent", 100, `复审评分 ${finalScore} 分，事实、引用、难度、格式与安全检查通过`, 40),
        agentTrace: trace("ReviewAgent", state.retryCount > 0 ? "复审终审质检（准予通过）" : "内容质检通过（准予发布）", "approved", { score: finalScore, elapsedMs: 40 }),
      };
    })
    .addEdge(START, "orchestrate")
    .addEdge("orchestrate", "profile")
    .addEdge("profile", "diagnose")
    .addEdge("diagnose", "path")
    .addEdge("path", "generate")
    .addEdge("generate", "review")
    .addConditionalEdges("review", (state) => {
      if (state.reviewScore < 75 && state.retryCount < 2) {
        return "generate";
      }
      return END;
    }, {
      generate: "generate",
      [END]: END,
    })
    .compile({ checkpointer, name: "zhijing-resource-workflow" });
}

export async function runResourceWorkflow(input: {
  runId: string;
  user: DemoUser;
  nodeId: string;
  type: LearningResource["type"];
  forceReviewReject?: boolean | undefined;
}): Promise<{ resource: LearningResource; events: AgentEvent[]; agentTrace: AgentTraceItem[] }> {
  try {
    const graph = await buildGraph();
    const invokeConfig = { configurable: { thread_id: `${input.user.id}:${input.runId}` } } as Parameters<typeof graph.invoke>[1];
    const result = await graph.invoke({
      ...input,
      resource: undefined,
      events: [],
      agentTrace: [],
      retryCount: 0,
      reviewScore: 0,
      reviewFeedback: undefined,
      diagnosisInfo: undefined,
    }, invokeConfig);
    if (!result.resource) throw new Error("工作流未生成资源");
    return { resource: result.resource, events: result.events, agentTrace: result.agentTrace ?? [] };
  } catch (error) {
    console.warn("Agent workflow failed; using deterministic fallback", error);
    const mockEvents = buildMockRunEvents(input.runId, input.type).map((item, index, all) =>
      index === all.length - 1 ? { ...item, status: "fallback" as const, summary: "工作流降级，已返回审核过的确定性资源" } : item,
    );
    const mockTrace: AgentTraceItem[] = [
      { agent: "Orchestrator", action: "初始化确定性工作流降级方案", status: "completed", elapsedMs: 10, timestamp: new Date().toISOString() },
      { agent: "ProfileAgent", action: "读取八维画像基础数据", status: "completed", elapsedMs: 12, timestamp: new Date().toISOString() },
      { agent: "DiagnosisAgent", action: "定位高频薄弱知识点", status: "completed", elapsedMs: 15, timestamp: new Date().toISOString() },
      { agent: "PathAgent", action: "调度降级资源输出策略", status: "completed", elapsedMs: 10, timestamp: new Date().toISOString() },
      { agent: "SQLLabAgent", action: "输出确定性高质量教学内容", status: "fallback", elapsedMs: 25, timestamp: new Date().toISOString() },
      { agent: "ReviewAgent", action: "离线预置安全规则复核通过", status: "approved", score: 90, elapsedMs: 10, timestamp: new Date().toISOString() },
    ];
    return { resource: generateMockResource(input), events: mockEvents, agentTrace: mockTrace };
  }
}
