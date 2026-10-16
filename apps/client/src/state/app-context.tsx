import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { generateResource, getDashboard, isApiConfigured, login as apiLogin, submitDiagnostic, type DashboardResponse } from "../lib/api";

type Persona = "foundation" | "exam" | "practice";
export type UserSummary = { id: string; username: string; displayName: string; persona: Persona; goal: string };
export type PathItem = { id: string; nodeId: string; title: string; reason: string; mastery: number; status: string; resource: string; evidence: string };
export type ResourceItem = { id: string; userId: string; nodeId: string; type: string; title: string; summary: string; content: string; difficulty: number; status: string; score: number; sourceIds: string[]; personalizationReasons: string[]; cached: boolean; createdAt: string };
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
const mapRemoteResource = (item: DashboardResponse["resources"][number]): ResourceItem => ({ ...item, type: resourceTypeLabels[item.type] ?? item.type, status: resourceStatusLabels[item.status] ?? item.status, score: item.reviewScore, sourceIds: item.sourceIds ?? [], personalizationReasons: item.personalizationReasons ?? [], content: item.content ?? "", difficulty: item.difficulty ?? 1, createdAt: item.createdAt ?? "" });
const mapRemotePath = (path: { id: string; nodeId: string; title: string; reason: string; mastery: number; status: string; recommendedResource: string }[]): PathItem[] => path.map((item) => ({ ...item, resource: resourceTypeLabels[item.recommendedResource] ?? item.recommendedResource, evidence: `${item.reason}；诊断/画像掌握度 ${item.mastery}%` }));
type DiagnosticAnswer = { nodeId: string; correctness: number; usedHint: boolean; confidence: number };
type AppState = { demoUsers: UserSummary[]; currentUser: UserSummary | null; path: PathItem[]; resources: ResourceItem[]; loading: boolean; ready: boolean; login: (username: string, password: string) => Promise<void>; logout: () => Promise<void>; completeDiagnostic: (answers: DiagnosticAnswer[]) => Promise<void>; addGeneratedResource: (type: string) => Promise<void> };
const AppContext = createContext<AppState | null>(null);
const SESSION_KEY = "zhijing.session.v2";

export function AppProvider({ children }: PropsWithChildren) {
  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null); const [resources, setResources] = useState<ResourceItem[]>([]); const [remotePath, setRemotePath] = useState<PathItem[] | null>(null); const [loading, setLoading] = useState(false); const [ready, setReady] = useState(false); const localResourceId = useRef(0);
  const hydrate = async (user: UserSummary) => {
    setCurrentUser(user);
    try { if (!isApiConfigured()) throw new Error("API 未配置"); const dashboard = await getDashboard(user.id); setRemotePath(mapRemotePath(dashboard.path)); setResources(dashboard.resources.map(mapRemoteResource)); }
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
  const logout = async () => { await AsyncStorage.removeItem(SESSION_KEY); setCurrentUser(null); setResources([]); setRemotePath(null); };
  const addGeneratedResource = async (type: string) => {
    if (!currentUser) return;
    const typeMap: Record<string, string> = { "讲解文档": "document", "知识图解": "diagram", "分层练习": "quiz", "SQL 实操": "sql-lab", "交互图解": "visual", "复习卡片": "reading" };
    localResourceId.current += 1; const pendingId = `generating-${localResourceId.current}`; setResources((items) => [{ id: pendingId, userId: currentUser.id, nodeId: "", type, title: `正在生成${type}…`, summary: "资源代理正在结合当前画像与知识断点生成内容。", content: "", difficulty: 1, status: "生成中", score: 0, sourceIds: [], personalizationReasons: [], cached: false, createdAt: "" }, ...items]);
    try { if (!isApiConfigured()) throw new Error("API 未配置"); const nodeId = path[0]?.nodeId ?? "keys-integrity"; const { resource } = await generateResource({ userId: currentUser.id, nodeId, type: typeMap[type] ?? "document" }); setResources((items) => [mapRemoteResource(resource), ...items.filter((item) => item.id !== pendingId && item.id !== resource.id)]); }
    catch { setResources((items) => [{ id: `unavailable-${localResourceId.current}`, userId: currentUser.id, nodeId: "", type, title: `${type}暂不可用`, summary: "资源服务暂不可用，请检查网络后重试。", content: "", difficulty: 1, status: "已降级", score: 0, sourceIds: [], personalizationReasons: [], cached: false, createdAt: "" }, ...items.filter((item) => item.id !== pendingId)]); }
  };
  const completeDiagnostic = async (answers: DiagnosticAnswer[]) => {
    if (!currentUser) return; setLoading(true);
    try { if (!isApiConfigured()) throw new Error("API 未配置"); const result = await submitDiagnostic({ userId: currentUser.id, answers }); setRemotePath(mapRemotePath(result.path)); await hydrate(currentUser); }
    catch { setRemotePath(pathByPersona[currentUser.persona]); }
    finally { setLoading(false); }
  };
  const path = remotePath ?? (currentUser ? pathByPersona[currentUser.persona] : []);
  const value = { demoUsers: users, currentUser, path, resources, loading, ready, login, logout, completeDiagnostic, addGeneratedResource };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() { const context = useContext(AppContext); if (!context) throw new Error("useApp must be used inside AppProvider"); return context; }
