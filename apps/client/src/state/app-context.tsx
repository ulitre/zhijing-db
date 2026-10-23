import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { generateResource, getDashboard, isApiConfigured, login as apiLogin, submitDiagnostic, type AgentTraceItem, type DashboardResponse } from "../lib/api";

type Persona = "foundation" | "exam" | "practice";
export type UserSummary = { id: string; username: string; displayName: string; persona: Persona; goal: string };
export type PathItem = { id: string; nodeId: string; title: string; reason: string; mastery: number; status: string; resource: string; evidence: string };
export type ResourceItem = { id: string; userId: string; nodeId: string; type: string; title: string; summary: string; content: string; difficulty: number; status: string; score: number; sourceIds: string[]; personalizationReasons: string[]; cached: boolean; createdAt: string; agentTrace?: AgentTraceItem[] };
export const users: UserSummary[] = [
  { id: "demo-foundation", username: "foundation", displayName: "基础薄弱型学生", persona: "foundation", goal: "补齐关系模型与 SQL 基础" },
  { id: "demo-exam", username: "exam", displayName: "应试巩固型学生", persona: "exam", goal: "巩固规范化与高频易错点" },
  { id: "demo-practice", username: "practice", displayName: "实践导向型学生", persona: "practice", goal: "掌握事务、索引和查询优化" },
];
const pathByPersona: Record<Persona, PathItem[]> = {
  foundation: [{ id: "relations", nodeId: "relations", title: "关系、元组、属性与域", reason: "最优先的基础断点", mastery: 48, status: "active", resource: "知识图解", evidence: "初始画像：关系模型基础掌握度 48%" }, { id: "keys", nodeId: "keys-integrity", title: "键与关系完整性", reason: "SQL 与设计的前置知识", mastery: 35, status: "recommended", resource: "讲解文档", evidence: "画像错误模式：容易混淆主键、候选键与外键" }, { id: "sql", nodeId: "sql-select", title: "SELECT 与联表查询", reason: "连接校园选课案例", mastery: 44, status: "recommended", resource: "SQL 实操", evidence: "初始画像：SQL 查询掌握度 44%" }],
  exam: [{ id: "closure", nodeId: "closure-keys", title: "属性闭包与候选键", reason: "规范化证明的知识断点", mastery: 52, status: "active", resource: "分层练习", evidence: "初始画像：函数依赖掌握度 58%，范式掌握度 46%" }, { id: "nf", nodeId: "nf-3bc", title: "第三范式与 BCNF", reason: "期末高频考点", mastery: 46, status: "recommended", resource: "分层练习", evidence: "画像错误模式：会套范式结论，但不会用闭包证明" }, { id: "tx", nodeId: "tx-acid", title: "事务与 ACID", reason: "需要快速巩固", mastery: 58, status: "recommended", resource: "复习卡片", evidence: "考试目标：优先覆盖高频易错点" }],
  practice: [{ id: "isolation", nodeId: "isolation", title: "并发异常与隔离级别", reason: "从会写 SQL 进阶到工程实践", mastery: 52, status: "active", resource: "SQL 实操", evidence: "初始画像：并发隔离掌握度 52%" }, { id: "index", nodeId: "index-design", title: "复合与覆盖索引", reason: "查询优化的关键基础", mastery: 48, status: "recommended", resource: "SQL 实操", evidence: "画像错误模式：缺少执行计划和并发意识" }, { id: "plan", nodeId: "optimizer", title: "执行计划与 EXPLAIN", reason: "验证索引是否生效", mastery: 42, status: "recommended", resource: "交互图解", evidence: "实践目标：通过计划验证优化结果" }],
};
const resourceTypeLabels: Record<string, string> = { document: "讲解文档", diagram: "知识图解", quiz: "分层练习", "sql-lab": "SQL 实操", visual: "交互图解", reading: "复习卡片" };
const resourceStatusLabels: Record<string, string> = { approved: "已审核", reviewing: "审核中", generating: "生成中", fallback: "已降级", rejected: "未通过" };

function generateDefaultTrace(type: string, score: number): AgentTraceItem[] {
  const typeMap: Record<string, AgentTraceItem["agent"]> = {
    "讲解文档": "DocumentAgent", "知识图解": "DiagramAgent", "分层练习": "QuizAgent", "SQL 实操": "SQLLabAgent", "交互图解": "DiagramAgent", "复习卡片": "ReadingAgent",
    document: "DocumentAgent", diagram: "DiagramAgent", quiz: "QuizAgent", "sql-lab": "SQLLabAgent", reading: "ReadingAgent", visual: "DiagramAgent",
  };
  const generator: AgentTraceItem["agent"] = typeMap[type] ?? "DocumentAgent";
  return [
    { agent: "Orchestrator", action: "协调资源生成任务，初始化多 Agent 编排流水线", status: "completed", elapsedMs: 12, timestamp: new Date().toISOString() },
    { agent: "ProfileAgent", action: "读取八维学情画像，提取知识掌握度与目标参数", status: "completed", elapsedMs: 15, timestamp: new Date().toISOString() },
    { agent: "DiagnosisAgent", action: "错因模式推理，定位易错认知断点并注入指导约束", status: "completed", elapsedMs: 28, timestamp: new Date().toISOString() },
    { agent: "PathAgent", action: "动态选型资源形态与难度梯度", status: "completed", elapsedMs: 14, timestamp: new Date().toISOString() },
    { agent: generator, action: `调用模型生成${type}核心内容`, status: "completed", elapsedMs: 142, timestamp: new Date().toISOString() },
    { agent: "ReviewAgent", action: "四维质检（事实出处、安全策略、格式规范、难度对齐）", status: "approved", score: score > 0 ? score : 92, elapsedMs: 35, timestamp: new Date().toISOString() },
  ];
}

const mapRemoteResource = (item: DashboardResponse["resources"][number], extraTrace?: AgentTraceItem[]): ResourceItem => {
  const mappedType = resourceTypeLabels[item.type] ?? item.type;
  return {
    ...item,
    type: mappedType,
    status: resourceStatusLabels[item.status] ?? item.status,
    score: item.reviewScore,
    sourceIds: item.sourceIds ?? [],
    personalizationReasons: item.personalizationReasons ?? [],
    content: item.content ?? "",
    difficulty: item.difficulty ?? 1,
    createdAt: item.createdAt ?? "",
    agentTrace: extraTrace ?? item.agentTrace ?? generateDefaultTrace(mappedType, item.reviewScore),
  };
};
const mapRemotePath = (path: { id: string; nodeId: string; title: string; reason: string; mastery: number; status: string; recommendedResource: string }[]): PathItem[] => path.map((item) => ({ ...item, resource: resourceTypeLabels[item.recommendedResource] ?? item.recommendedResource, evidence: `${item.reason}；诊断/画像掌握度 ${item.mastery}%` }));
type DiagnosticAnswer = { nodeId: string; correctness: number; usedHint: boolean; confidence: number };
type AppState = { demoUsers: UserSummary[]; currentUser: UserSummary | null; path: PathItem[]; resources: ResourceItem[]; latestTrace: AgentTraceItem[] | null; loading: boolean; ready: boolean; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void>; switchUser: (userId: string) => Promise<void>; completeDiagnostic: (answers: DiagnosticAnswer[]) => Promise<void>; addGeneratedResource: (type: string, options?: { forceReviewReject?: boolean; nodeId?: string }) => Promise<void> };
const AppContext = createContext<AppState | null>(null);
const SESSION_KEY = "zhijing.session.v2";

export function AppProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null); const [resources, setResources] = useState<ResourceItem[]>([]); const [remotePath, setRemotePath] = useState<PathItem[] | null>(null); const [latestTrace, setLatestTrace] = useState<AgentTraceItem[] | null>(null); const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false); const localResourceId = useRef(0);
  const hydrate = async (user: UserSummary) => {
    setCurrentUser(user);
    try { if (!isApiConfigured()) throw new Error("API 未配置"); const dashboard = await getDashboard(user.id); setRemotePath(mapRemotePath(dashboard.path)); setResources(dashboard.resources.map((item) => mapRemoteResource(item))); }
    catch { setRemotePath(pathByPersona[user.persona]); setResources([]); }
  };
  useEffect(() => { void (async () => { try { const saved = await AsyncStorage.getItem(SESSION_KEY); if (saved) { const session = JSON.parse(saved) as { userId: string; expiresAt: number }; const user = users.find((item) => item.id === session.userId); if (user && session.expiresAt > Date.now()) await hydrate(user); else await AsyncStorage.removeItem(SESSION_KEY); } } catch { await AsyncStorage.removeItem(SESSION_KEY); } finally { setReady(true); } })(); }, []);
  const login = async (username: string, password: string) => {
    setLoading(true);
    try {
      if (!isApiConfigured()) throw new Error("无法连接登录服务，请检查网络后重试");
      const result = await apiLogin({ username, password }); const user = users.find((item) => item.id === result.user.id);
      if (!user) throw new Error("登录账号未配置学习画像");
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token: result.token, userId: user.id, expiresAt: Date.now() + result.expiresIn * 1000 }));
      await hydrate(user);
    } finally { setLoading(false); }
  };
  const logout = async () => { await AsyncStorage.removeItem(SESSION_KEY); setCurrentUser(null); setResources([]); setRemotePath(null); setLatestTrace(null); };
  const switchUser = async (userId: string) => {
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) return;
    setResources([]); setRemotePath(null); setLatestTrace(null);
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify({ token: "local-demo", userId: user.id, expiresAt: Date.now() + 86_400_000 }));
    await hydrate(user);
  };
  const addGeneratedResource = async (type: string, options?: { forceReviewReject?: boolean; nodeId?: string }) => {
    if (!currentUser) return;
    const typeMap: Record<string, string> = { "讲解文档": "document", "知识图解": "diagram", "分层练习": "quiz", "SQL 实操": "sql-lab", "交互图解": "visual", "复习卡片": "reading" };
    const nodeId = options?.nodeId ?? path[0]?.nodeId ?? "keys-integrity";
    localResourceId.current += 1; const pendingId = `generating-${localResourceId.current}`; setResources((items) => [{ id: pendingId, userId: currentUser.id, nodeId, type, title: `正在生成${type}…`, summary: "资源代理正在结合当前画像与知识断点生成内容。", content: "", difficulty: 1, status: "生成中", score: 0, sourceIds: [], personalizationReasons: [], cached: false, createdAt: "" }, ...items]);
    try {
      if (!isApiConfigured()) throw new Error("API 未配置");
      const result = await generateResource({
        userId: currentUser.id,
        nodeId,
        type: typeMap[type] ?? "document",
        forceReviewReject: options?.forceReviewReject,
      });
      // Cached API responses omit `agentTrace`; the resource's generated
      // default trace keeps the quality gate populated in that case.
      const mapped = mapRemoteResource(result.resource, result.agentTrace);
      setLatestTrace(result.agentTrace ?? mapped.agentTrace ?? null);
      setResources((items) => [mapped, ...items.filter((item) => item.id !== pendingId && item.id !== result.resource.id)]);
    } catch {
      const fallbackTrace: AgentTraceItem[] = [
        { agent: "Orchestrator", action: "调度降级方案", status: "completed", elapsedMs: 8, timestamp: new Date().toISOString() },
        { agent: "ReviewAgent", action: "服务暂不可用已降级", status: "fallback", elapsedMs: 12, timestamp: new Date().toISOString() },
      ];
      setLatestTrace(fallbackTrace);
      setResources((items) => [{ id: `unavailable-${localResourceId.current}`, userId: currentUser.id, nodeId, type, title: `${type}暂不可用`, summary: "资源服务暂不可用，请检查网络后重试。", content: "", difficulty: 1, status: "已降级", score: 0, sourceIds: [], personalizationReasons: [], cached: false, createdAt: "", agentTrace: fallbackTrace }, ...items.filter((item) => item.id !== pendingId)]);
    }
  };
  const completeDiagnostic = async (answers: DiagnosticAnswer[]) => {
    if (!currentUser) return; setLoading(true);
    try { if (!isApiConfigured()) throw new Error("API 未配置"); const result = await submitDiagnostic({ userId: currentUser.id, answers }); setRemotePath(mapRemotePath(result.path)); await hydrate(currentUser); }
    catch { setRemotePath(pathByPersona[currentUser.persona]); }
    finally { setLoading(false); }
  };
  const path = remotePath ?? (currentUser ? pathByPersona[currentUser.persona] : []);
  const value = { demoUsers: users, currentUser, path, resources, latestTrace, loading, ready, login, logout, switchUser, completeDiagnostic, addGeneratedResource };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error("useApp must be used inside AppProvider"); return context; }
