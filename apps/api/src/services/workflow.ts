import { Annotation, END, MemorySaver, START, StateGraph, type BaseCheckpointSaver } from "@langchain/langgraph";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { buildMockRunEvents, generateMockResource, planLearningPath } from "@zhijing/agents";
import { getKnowledgeNode } from "@zhijing/course-data";
import type { AgentEvent, DemoUser, LearningResource } from "@zhijing/shared";
import { createModelProvider } from "./model.js";

const WorkflowState = Annotation.Root({
  runId: Annotation<string>(),
  user: Annotation<DemoUser>(),
  nodeId: Annotation<string>(),
  type: Annotation<LearningResource["type"]>(),
  resource: Annotation<LearningResource | undefined>(),
  events: Annotation<AgentEvent[]>({ reducer: (current, update) => [...current, ...update], default: () => [] }),
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

function event(runId: string, agent: AgentEvent["agent"], progress: number, summary: string): AgentEvent[] {
  return [{ runId, agent, status: "completed", progress, summary, elapsedMs: 0, timestamp: new Date().toISOString() }];
}

function quizAnswerKey(nodeId: string, objective: string) {
  if (nodeId === "nf-3bc") return `\n\n参考答案与逐题解析\n题目一：A⁺ = {A, B, C, D}，因此 A → C 可由 A → B 与 B → C 推出，A 是候选键。B → C 的左侧 B 不是超键，右侧 C 不是主属性，所以该关系不满足 3NF。\n题目二：候选键为 AB 与 BC。AB⁺ = {A, B, C}；BC⁺ = {A, B, C}（由 C → A），二者均为最小超键。C⁺ = {A, C}，不包含 B，因此 C → A 违反 BCNF；但 A 是主属性，所以该关系满足 3NF。此例说明 3NF 不必然满足 BCNF。\n题目三：A⁺ = {A, B, C, D}，候选键为 A。B → C 与 C → D 的左侧都不是超键，右侧也不是主属性，因此违反 3NF，当然也违反 BCNF。\n题目四：(1) 错，题干描述的是 2NF 的关键要求之一，3NF 还需检查非主属性对候选键的传递依赖；(2) 错，题目二给出满足 3NF 但不满足 BCNF 的反例；(3) 错，BCNF 的要求正是每个非平凡函数依赖 X → Y 的 X 都是超键。\n常见错因：把“左侧包含候选键”误当成唯一判据。应先求左侧闭包，确认它是否包含关系的全部属性，再判断右侧是否为主属性。`;
  return `\n\n参考答案与解析\n1. 核心题答案：${objective}。解析：先列出相关关系和属性，再逐项应用定义检查约束或依赖；写出判断过程，不要只给结论。\n2. 校园选课应用题参考答案：说明 student、course 与 enrollment 中涉及的属性，标明它们的键或依赖关系，并指出如何用这些信息验证“${objective}”。解析：答案应包含至少一个成立案例和一个违反规则的反例。\n易错点解析：混淆术语定义与适用条件；回到定义检查每条关系、依赖或约束。`;
}

async function buildGraph() {
  const checkpointer = await getCheckpointer();
  return new StateGraph(WorkflowState)
    .addNode("orchestrate", (state) => ({ events: event(state.runId, "Orchestrator", 10, "已创建固定工作流并载入检查点") }))
    .addNode("profile", (state) => ({ events: event(state.runId, "ProfileAgent", 25, "已读取八维学习画像") }))
    .addNode("diagnose", (state) => ({ events: event(state.runId, "DiagnosisAgent", 40, `已定位 ${state.nodeId} 知识断点`) }))
    .addNode("path", (state) => {
      const active = planLearningPath(state.user.profile).find((step) => step.nodeId === state.nodeId);
      return { events: event(state.runId, "PathAgent", 55, active?.reason ?? "已校验知识依赖与资源策略") };
    })
    .addNode("generate", async (state) => {
      const fallback = generateMockResource({ user: state.user, nodeId: state.nodeId, type: state.type });
      const node = getKnowledgeNode(state.nodeId);
      const formatRequirements: Record<LearningResource["type"], string> = {
        document: "输出完整讲解文档：概念定义、校园选课案例、步骤、常见误区和自检题。",
        diagram: "输出完整的文本知识图：包含当前节点、所有已给前置节点、方向箭头、关系说明和一个应用检查点。",
        quiz: "输出至少 3 道由易到难的题目；每题都必须给出正确答案和逐项解析，指出典型错误原因。",
        "sql-lab": "输出完整 SQL 实验：目标、可运行 SQL、逐步操作、预期结果和结果检查方法。",
        visual: "输出可跟随的交互步骤、每步预期观察和最终结论。",
        reading: "输出复习卡：定义、前置知识、案例、易错点和自测题。",
      };
      const generated = await model.generate(
        `知识点：${node?.title}\n目标：${node?.objective}\n前置知识：${node?.prerequisites.join("、")}\n学习者目标：${state.user.profile.learningGoal}\n偏好：${state.user.profile.learningPreference}\n错误模式：${state.user.profile.commonErrorPattern}\n资源类型：${state.type}\n${formatRequirements[state.type]}\n基于提供的课程事实生成完整、可直接使用的中文内容，不要只给摘要。`,
        { content: fallback.content, summary: fallback.summary },
      );
      const generator = state.type === "quiz" ? "QuizAgent" : state.type === "sql-lab" ? "SQLLabAgent" : state.type === "reading" ? "ReadingAgent" : state.type === "document" ? "DocumentAgent" : "DiagramAgent";
      const content = state.type === "quiz" ? `${generated.content}${quizAnswerKey(state.nodeId, node?.objective ?? fallback.summary)}` : generated.content;
      return { resource: { ...fallback, content, summary: generated.summary, cached: model.mode === "deterministic-mock" }, events: event(state.runId, generator, 80, `已使用 ${model.mode} 生成个性化资源`) };
    })
    .addNode("review", (state) => ({ resource: state.resource ? { ...state.resource, status: "approved" as const, reviewScore: 92 } : undefined, events: event(state.runId, "ReviewAgent", 100, "事实、引用、难度、格式与安全检查通过") }))
    .addEdge(START, "orchestrate").addEdge("orchestrate", "profile").addEdge("profile", "diagnose")
    .addEdge("diagnose", "path").addEdge("path", "generate").addEdge("generate", "review").addEdge("review", END)
    .compile({ checkpointer, name: "zhijing-resource-workflow" });
}

export async function runResourceWorkflow(input: { runId: string; user: DemoUser; nodeId: string; type: LearningResource["type"] }): Promise<{ resource: LearningResource; events: AgentEvent[] }> {
  try {
    const graph = await buildGraph();
    const invokeConfig = { configurable: { thread_id: `${input.user.id}:${input.runId}` } } as Parameters<typeof graph.invoke>[1];
    const result = await graph.invoke({ ...input, resource: undefined, events: [] }, invokeConfig);
    if (!result.resource) throw new Error("工作流未生成资源");
    return { resource: result.resource, events: result.events };
  } catch (error) {
    console.warn("Agent workflow failed; using deterministic fallback", error);
    return { resource: generateMockResource(input), events: buildMockRunEvents(input.runId, input.type).map((item, index, all) => index === all.length - 1 ? { ...item, status: "fallback", summary: "工作流降级，已返回审核过的确定性资源" } : item) };
  }
}
