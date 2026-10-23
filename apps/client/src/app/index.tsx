import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { AmbientBackdrop } from "../components/ambient-backdrop";
import { Reveal, revealData, revealDelay, useScrollReveal } from "../components/scroll-reveal";
import { ThemeSwitcher } from "../components/theme-switcher";
import { isApiConfigured } from "../lib/api";
import { useApp } from "../state/app-context";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { useTheme, type ThemeMode, type ThemeTokens } from "../state/theme-context";

type DemoPersona = "foundation" | "exam" | "practice";
type PersonaKey = DemoPersona | "guest";
type InspectorTab = "agents" | "graph" | "resources";
type Tone = "accent" | "success" | "warning" | "agent";
type QuickAction = "sql" | "pipeline" | "bkt";
type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };
type WebStyle = ViewStyle & TextStyle;

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>): WebStyle | null {
  return Platform.OS === "web" ? (style as unknown as WebStyle) : null;
}

/** Same as webOnly but always returns an object, so it can be spread inside StyleSheet.create. */
function webProps(style: Record<string, unknown>): ViewStyle {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : {};
}

/** Warm semantic tones: terracotta primary, teal secondary, amber warning. */
function toneColor(theme: ThemeTokens, tone: Tone): string {
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "agent") return theme.agent;
  return theme.accentPrimary;
}

function toneSoft(theme: ThemeTokens, tone: Tone): string {
  if (tone === "success") return theme.successSoft;
  if (tone === "warning") return theme.warningSoft;
  if (tone === "agent") return theme.agentSoft;
  return theme.accentSoft;
}

/** Guarantees a template-literal percentage type for React Native styles. */
function pct(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

/**
 * Web CSS animations must be registered through StyleSheet.create so react-native-web
 * compiles animationKeyframes into a class rule (inline styles drop that property).
 */
const motion = StyleSheet.create({
  entrance0: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "720ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "0ms" }),
  entrance1: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "720ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "90ms" }),
  entrance2: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "720ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "180ms" }),
  entrance3: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "720ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "260ms" }),
  entrance4: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "720ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "340ms" }),
  auroraA: webAnimation({ animationKeyframes: "auroraDriftA", animationDuration: "11s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDirection: "alternate" }),
  auroraB: webAnimation({ animationKeyframes: "auroraDriftB", animationDuration: "13s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDirection: "alternate", animationDelay: "-3s" }),
  gridScan: webAnimation({ animationKeyframes: "gridScan", animationDuration: "9.5s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  shimmer: webAnimation({ animationKeyframes: "shimmer", animationDuration: "2.8s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  shimmerCta: webAnimation({ animationKeyframes: "shimmer", animationDuration: "3.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  pulseRing: webAnimation({ animationKeyframes: "pulseRing", animationDuration: "1.8s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
  dataFlowBg0: webAnimation({ animationKeyframes: "dataFlowBg", animationDuration: "2.2s", animationTimingFunction: "linear", animationIterationCount: "infinite", animationDelay: "0s" }),
  dataFlowBg1: webAnimation({ animationKeyframes: "dataFlowBg", animationDuration: "2.2s", animationTimingFunction: "linear", animationIterationCount: "infinite", animationDelay: "0.18s" }),
  dataFlowBg2: webAnimation({ animationKeyframes: "dataFlowBg", animationDuration: "2.2s", animationTimingFunction: "linear", animationIterationCount: "infinite", animationDelay: "0.36s" }),
  agentBlink0: webAnimation({ animationKeyframes: "agentBlink", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0s" }),
  agentBlink1: webAnimation({ animationKeyframes: "agentBlink", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.12s" }),
  agentBlink2: webAnimation({ animationKeyframes: "agentBlink", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.24s" }),
  agentBlink3: webAnimation({ animationKeyframes: "agentBlink", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.36s" }),
  energyPulse0: webAnimation({ animationKeyframes: "energyPulse", animationDuration: "2.8s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0s" }),
  energyPulse1: webAnimation({ animationKeyframes: "energyPulse", animationDuration: "2.8s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.16s" }),
  energyPulse2: webAnimation({ animationKeyframes: "energyPulse", animationDuration: "2.8s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.32s" }),
  meshBreath0: webAnimation({ animationKeyframes: "meshBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0s" }),
  meshBreath1: webAnimation({ animationKeyframes: "meshBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-0.85s" }),
  meshBreath2: webAnimation({ animationKeyframes: "meshBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-1.7s" }),
  meshBreath3: webAnimation({ animationKeyframes: "meshBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-2.55s" }),
  sparkScan: webAnimation({ animationKeyframes: "sparkScan", animationDuration: "4.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  caretBlink: webAnimation({ animationKeyframes: "caretBlink", animationDuration: "1s", animationTimingFunction: "steps(1)", animationIterationCount: "infinite" }),
  badgeFloat: webAnimation({ animationKeyframes: "badgeFloat", animationDuration: "4.5s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  dotPulse: webAnimation({ animationKeyframes: "dotPulse", animationDuration: "2.4s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
  panelIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "260ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards" }),
  lineIn0: webAnimation({ animationKeyframes: "terminalLineIn", animationDuration: "360ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", animationDelay: "0ms" }),
  lineIn1: webAnimation({ animationKeyframes: "terminalLineIn", animationDuration: "360ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", animationDelay: "55ms" }),
  lineIn2: webAnimation({ animationKeyframes: "terminalLineIn", animationDuration: "360ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", animationDelay: "110ms" }),
  lineIn3: webAnimation({ animationKeyframes: "terminalLineIn", animationDuration: "360ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", animationDelay: "165ms" }),
});

const DOT_BLINKS = [motion.agentBlink0, motion.agentBlink1, motion.agentBlink2, motion.agentBlink3];
const ENERGY_PULSES = [motion.energyPulse0, motion.energyPulse1, motion.energyPulse2];
const MESH_BREATHS = [motion.meshBreath0, motion.meshBreath1, motion.meshBreath2, motion.meshBreath3];
const TERMINAL_LINES = [motion.lineIn0, motion.lineIn1, motion.lineIn2, motion.lineIn3] as unknown as TextStyle[];
const DATA_FLOW_BGS = [motion.dataFlowBg0, motion.dataFlowBg1, motion.dataFlowBg2];
const BENTO_ENTRANCES = [motion.entrance2, motion.entrance3, motion.entrance4];

const NAV_STATUS = [
  { tab: "agents", icon: "✦", label: "多智能体引擎", tone: "accent" },
  { tab: "graph", icon: "❖", label: "45节点知识图谱", tone: "success" },
  { tab: "resources", icon: "⌘", label: "SQL沙箱就绪", tone: "warning" },
] as const;

const STATS = [
  { tab: "agents", value: "12", unit: "AGENTS", label: "智能体协同", icon: "✦", kind: "mesh", tone: "accent" },
  { tab: "graph", value: "45", unit: "NODES", label: "课程知识节点", icon: "◇", kind: "spark", tone: "success" },
  { tab: "resources", value: "6", unit: "FORMATS", label: "个性化资源类型", icon: "▤", kind: "energy", tone: "warning" },
] as const;

const TAB_OVERVIEWS = {
  agents: {
    tag: "12 AGENTS",
    title: "多智能体协同引擎",
    description: "从意图路由、画像诊断到资源生成与四维质检，12 个智能体以条件边协同完成一次完整学习任务。",
    stats: ["12 智能体", "6 阶段流水线", "实时遥测"],
    tone: "accent",
  },
  graph: {
    tag: "45 NODES",
    title: "45 节点知识图谱",
    description: "按前置依赖组织的课程拓扑。每个节点携带诊断证据、BKT 掌握度、薄弱原因与推荐实验。",
    stats: ["45 节点", "4 大章节", "BKT 联动"],
    tone: "success",
  },
  resources: {
    tag: "6 MODES",
    title: "多模态资源与 SQL 沙箱",
    description: "讲解、图谱、练习、实验、闪卡与调优案例统一由画像驱动生成，并通过 ReviewAgent 四维质检。",
    stats: ["6 类资源", "8 表沙箱", "4 维质检"],
    tone: "warning",
  },
} as const;

const RESOURCE_SEGMENTS = [
  { key: "DOC", flex: 30, tone: "accent" },
  { key: "GRAPH", flex: 22, tone: "success" },
  { key: "SQL", flex: 18, tone: "agent" },
  { key: "QUIZ", flex: 14, tone: "warning" },
  { key: "CARD", flex: 9, tone: "accent" },
  { key: "LAB", flex: 7, tone: "success" },
] as const;

/** Keep the six labels legible even when the proportional track gets narrow. */
const ENERGY_LABEL_MIN: Record<string, number> = {
  DOC: 16, GRAPH: 22, SQL: 16, QUIZ: 18, CARD: 18, LAB: 16,
};

function sparklineSvg(theme: ThemeTokens): string {
  return `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 34' preserveAspectRatio='none'><defs><linearGradient id='sparkFill' x1='0' y1='0' x2='0' y2='1'><stop offset='0%' stop-color='${theme.accentPrimary}' stop-opacity='0.26'/><stop offset='100%' stop-color='${theme.accentSecondary}' stop-opacity='0.01'/></linearGradient></defs><path d='M0,30 L20,24 L40,27 L60,16 L80,18 L100,8 L120,4 L120,34 L0,34 Z' fill='url(#sparkFill)'/><polyline points='0,30 20,24 40,27 60,16 80,18 100,8 120,4' fill='none' stroke='${theme.accentPrimary}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/><circle cx='120' cy='4' r='2.4' fill='${theme.accentSecondary}'/></svg>`,
  )}")`;
}

const PIPELINE = [
  { key: "orchestrator", label: "Orchestrator", glyph: "✦" },
  { key: "profile", label: "Profile", glyph: "◎" },
  { key: "diagnosis", label: "Diagnosis", glyph: "◇" },
  { key: "path", label: "Path", glyph: "⬡" },
  { key: "resource", label: "Resource", glyph: "▤" },
  { key: "review", label: "Review", glyph: "◈" },
] as const;

const ROLE_META: Record<DemoPersona, {
  title: string;
  code: string;
  description: string;
  mastery: string;
  icon: string;
  tone: Tone;
}> = {
  foundation: {
    title: "基础补齐",
    code: "FOUNDATION",
    description: "零基础建立关系模型与 SQL 核心概念",
    mastery: "初始掌握度 ~35%",
    icon: "◈",
    tone: "accent",
  },
  exam: {
    title: "应试巩固",
    code: "EXAM SPRINT",
    description: "高频考点突击与易错点专项训练",
    mastery: "目标冲刺 90%+",
    icon: "✦",
    tone: "warning",
  },
  practice: {
    title: "实践进阶",
    code: "PRACTICE",
    description: "复杂查询、索引与执行计划调优实战",
    mastery: "实战调优精通",
    icon: "⌘",
    tone: "success",
  },
};

/** Login-card telemetry shown as soon as a demo role is selected. */
const ROLE_TELEMETRY: Record<DemoPersona, {
  mastery: number;
  pending: number;
  node: string;
  dims: readonly number[];
}> = {
  foundation: { mastery: 35, pending: 6, node: "关系、元组、属性与域", dims: [32, 40, 28, 36, 30, 44, 38, 26] },
  exam: { mastery: 68, pending: 3, node: "属性闭包与候选键", dims: [66, 72, 60, 64, 70, 58, 62, 74] },
  practice: { mastery: 86, pending: 1, node: "复合与覆盖索引", dims: [88, 84, 90, 82, 86, 92, 80, 88] },
};

const DIMENSION_LABELS = ["先修基础", "知识掌握", "目标清晰", "节奏匹配", "错误识别", "资源偏好", "练习独立", "进步趋势"] as const;

const AUTH_STAGES = [
  "正在校验会话凭证",
  "同步八维学情画像",
  "恢复学习路径与资源",
  "建立学习空间会话",
] as const;

function agentStatusColor(theme: ThemeTokens, status: string): string {
  if (status === "ONLINE") return theme.success;
  if (status === "READY") return theme.warning;
  return theme.textMuted;
}

const PERSONA_LABELS: Record<PersonaKey, string> = {
  guest: "预览画像 · WAITING FOR ROLE",
  foundation: "基础薄弱型 · FOUNDATION",
  exam: "应试巩固型 · EXAM SPRINT",
  practice: "实践导向型 · PRACTICE",
};

const PERSONA_LOGS: Record<PersonaKey, string[]> = {
  guest: [
    "[Orchestrator] 正在解析学习者历史 SQL 提交记录...",
    "[ProfileAgent] 读取八维学情画像，等待选择演示角色...",
    "[DiagnosisAgent] 准备知识依赖图与前置断点检测器...",
    "[ReviewAgent] 预览流水线就绪，选择角色后生成专属路径 ✓",
  ],
  foundation: [
    "[Orchestrator] 正在解析学习者历史 SQL 提交记录...",
    "[ProfileAgent] 识别薄弱维：多表连接 (JOIN) 与子查询嵌套 (掌握度 42%)",
    "[DiagnosisAgent] 定位前置知识断点 -> #Node-14 关系代数基础",
    "[ReviewAgent] 已生成个性化补齐路径与 3 道靶向 SQL 实验题 ✓",
  ],
  exam: [
    "[Orchestrator] 正在聚合历年高频考点与错题记录...",
    "[ProfileAgent] 识别薄弱维：属性闭包 (58%) 与范式判定 (46%)",
    "[DiagnosisAgent] 定位高频易错点 -> #Node-27 BCNF 分解与候选键",
    "[ReviewAgent] 已生成应试巩固路径与 5 道范式判断题 ✓",
  ],
  practice: [
    "[Orchestrator] 正在分析执行计划与慢查询样本...",
    "[ProfileAgent] 识别薄弱维：复合索引设计 (48%) 与执行计划解读 (42%)",
    "[DiagnosisAgent] 定位工程断点 -> #Node-39 覆盖索引与回表",
    "[ReviewAgent] 已生成调优实战路径与 3 组 EXPLAIN 对照实验 ✓",
  ],
};

const AGENT_MATRIX = [
  { key: "router", name: "Router", cn: "意图路由", description: "解析学习意图并拆分任务 DAG", status: "ONLINE", latency: "8ms", stage: 0 },
  { key: "profiler", name: "Profiler", cn: "画像师", description: "八维学情画像与薄弱维识别", status: "ONLINE", latency: "14ms", stage: 1 },
  { key: "diagnostic", name: "Diagnostic", cn: "诊断官", description: "知识断点定位与错因推理", status: "ONLINE", latency: "22ms", stage: 2 },
  { key: "path", name: "PathPlanner", cn: "路径规划师", description: "动态路径编排与资源选型", status: "ONLINE", latency: "11ms", stage: 3 },
  { key: "document", name: "DocumentAgent", cn: "文档生成", description: "概念精讲与结构化讲解", status: "ONLINE", latency: "36ms", stage: 4 },
  { key: "diagram", name: "DiagramAgent", cn: "图谱生成", description: "关系图谱与交互图解", status: "ONLINE", latency: "41ms", stage: 4 },
  { key: "quiz", name: "QuizAgent", cn: "测验生成", description: "分层练习、答案与错因解析", status: "ONLINE", latency: "33ms", stage: 4 },
  { key: "sandbox", name: "SQLLabAgent", cn: "沙箱实验", description: "8 表 SQL 实验设计与执行", status: "READY", latency: "4.2ms", stage: 4 },
  { key: "tutor", name: "SocraticTutor", cn: "苏格拉底导师", description: "循证答疑与概念纠偏", status: "ONLINE", latency: "18ms", stage: 4 },
  { key: "bkt", name: "BKT-Evaluator", cn: "掌握度评估", description: "贝叶斯知识追踪与参数更新", status: "ONLINE", latency: "9ms", stage: 1 },
  { key: "review", name: "ReviewGuard", cn: "四维质检", description: "事实出处、安全、格式与难度审核", status: "STANDBY", latency: "—", stage: 5 },
  { key: "memory", name: "MemoryAgent", cn: "记忆管理", description: "学习历史、遗忘曲线与复习调度", status: "ONLINE", latency: "12ms", stage: 0 },
] as const;

type AgentKey = (typeof AGENT_MATRIX)[number]["key"];

const AGENT_IO: Record<AgentKey, { input: string; engine: string; output: string }> = {
  router: { input: "utterance + session_ctx + history", engine: "IntentClassifier · Task DAG Router", output: "route.plan → agents[]" },
  profiler: { input: "submissions + attempt_history", engine: "8-D Vector · EWMA Update", output: "profile.vec → PathPlanner" },
  diagnostic: { input: "symptom + profile.vec + graph", engine: "CauseGraph · Rule+LLM Trace", output: "diag.chain → PathPlanner" },
  path: { input: "profile.vec + diag.chain", engine: "TopoSort · Dynamic Replan", output: "path.vN → Orchestrator" },
  document: { input: "concept + persona + weak_dims", engine: "Markdown Composer · Style Adapter", output: "doc.md + citations[]" },
  diagram: { input: "schema + dependency_graph", engine: "ER Layout · Mermaid Compiler", output: "svg + mermaid source" },
  quiz: { input: "skill + error_patterns + bloom", engine: "Distractor Synthesis · IRT", output: "quiz.json + misconception[]" },
  sandbox: { input: "sql_draft + dataset_manifest", engine: "sql.js WASM · EXPLAIN Assert", output: "result_set + plan.assert" },
  tutor: { input: "query + RAG hits + profile", engine: "RAG Retriever · Socratic Policy", output: "reply + follow_up_chain" },
  bkt: { input: "attempt + skill + priors", engine: "Bayes Knowledge Tracing", output: "P(L_t) → Profiler" },
  review: { input: "draft_bundle + rubric", engine: "4-D Gate · Claim Verification", output: "verdict + intercept report" },
  memory: { input: "events + memory_pool", engine: "Ebbinghaus · SM-2 Scheduler", output: "due.queue → PathPlanner" },
};

const AGENT_LOGS: Record<AgentKey, Record<PersonaKey, string[]>> = {
  router: {
    guest: [
      "▸ [Router] q=\"如何写多表查询\" · persona=GUEST",
      "├─ Intent: SQL_JOIN_BASIC (0.71) · entropy 0.43",
      "├─ Slots: table=unknown · goal=browse · depth=L1",
      "├─ Route: PathPlanner → DocumentAgent (预览模式)",
      "├─ DAG: [parse] → [profile:mock] ⇢ [generate] → [review]",
      "└─ Dispatch 5/12 · budget 2.4s · confidence gate 0.70 ✓",
    ],
    foundation: [
      "▸ [Router] q=\"JOIN 结果重复怎么排查\" · persona=FOUNDATION",
      "├─ Intent: SQL_JOIN_DEBUG (0.94) · entropy 0.11",
      "├─ Slots: tables=[student, course] · symptom=duplicate_rows",
      "├─ Route: Diagnostic → DocumentAgent → PathPlanner",
      "├─ DAG: [parse] → [profile] → [diagnose] ⇢ [generate] → [review]",
      "└─ Dispatch 4/12 · budget 1.8s · confidence gate 0.90 ✓",
    ],
    exam: [
      "▸ [Router] q=\"BCNF 分解怎么判断候选键\" · persona=EXAM",
      "├─ Intent: NORMALIZATION_BCNF (0.93) · entropy 0.14",
      "├─ Slots: topic=候选键 · method=属性闭包 · tag=高频",
      "├─ Route: SocraticTutor → QuizAgent → ReviewGuard",
      "├─ DAG: [parse] → [retrieve] → [quiz] ⇢ [review]",
      "└─ Dispatch 4/12 · budget 1.6s · confidence gate 0.90 ✓",
    ],
    practice: [
      "▸ [Router] q=\"JOIN 为什么没走索引\" · persona=PRACTICE",
      "├─ Intent: EXPLAIN_INDEX_TUNING (0.96) · entropy 0.08",
      "├─ Slots: engine=MySQL8 · plan=ref(ALL) · rows=1.2M",
      "├─ Route: Diagnostic → SQLLabAgent → ReviewGuard",
      "├─ DAG: [parse] → [profile] → [explain] ⇢ [sandbox] → [review]",
      "└─ Dispatch 5/12 · budget 2.1s · confidence gate 0.92 ✓",
    ],
  },
  profiler: {
    guest: [
      "▸ [Profiler] load vector dim=8 · source=prefetch_queue",
      "├─ 语法 0.31 | 关系代数 0.28 | 索引 0.22 | 事务 0.19",
      "├─ SQL 0.30 | 范式 0.18 | 执行计划 0.15 | 建模 0.24",
      "├─ Weakest: 执行计划 0.15 → 索引调优 0.22",
      "├─ Update: Kalman gain 0.18 · prior → posterior",
      "└─ Emit profile.vec.v3 → Diagnostic · confidence 0.62",
    ],
    foundation: [
      "▸ [Profiler] load vector dim=8 · source=12 submissions",
      "├─ 语法 0.78 | 关系代数 0.52 | 索引 0.34 | 事务 0.41",
      "├─ SQL 0.74 | 范式 0.46 | 执行计划 0.31 | 建模 0.55",
      "├─ Weakest: 执行计划 0.31 → 多表JOIN 0.42",
      "├─ Update: EWMA α=0.35 · drift=+0.06",
      "└─ Emit profile.vec.v7 → PathPlanner · confidence 0.88",
    ],
    exam: [
      "▸ [Profiler] load vector dim=8 · source=38 submissions",
      "├─ 语法 0.86 | 关系代数 0.58 | 索引 0.63 | 事务 0.47",
      "├─ SQL 0.82 | 范式 0.46 | 执行计划 0.57 | 建模 0.61",
      "├─ Weakest: 范式 0.46 → 属性闭包 / BCNF",
      "├─ Update: EWMA α=0.35 · exam-weight ×1.4",
      "└─ Emit profile.vec.v9 → Diagnostic · confidence 0.91",
    ],
    practice: [
      "▸ [Profiler] load vector dim=8 · source=57 slow queries",
      "├─ 语法 0.92 | 关系代数 0.71 | 索引 0.48 | 事务 0.66",
      "├─ SQL 0.88 | 范式 0.64 | 执行计划 0.42 | 建模 0.73",
      "├─ Weakest: 执行计划 0.42 → 覆盖索引 / 回表",
      "├─ Update: EWMA α=0.30 · plan-weight ×1.6",
      "└─ Emit profile.vec.v11 → PathPlanner · confidence 0.93",
    ],
  },
  diagnostic: {
    guest: [
      "▸ [Diagnostic] probe graph snapshot · nodes=48 edges=126",
      "├─ Symptom: 未提供错题样本 · 使用演示探针",
      "├─ Trace: JOIN 语法 → 执行时序 → 结果集",
      "├─ Root-cause chain: #N-03 别名作用域",
      "├─ Evidence: 3 条规则命中 · confidence 0.64",
      "└─ Emit diag.preview → SocraticTutor (dry-run)",
    ],
    foundation: [
      "▸ [Diagnostic] probe graph snapshot · nodes=48 edges=126",
      "├─ Symptom: 笛卡尔积 · rows 2,340 ≫ expected 39",
      "├─ Trace: 捕获 SQL 笛卡尔积异常",
      "├─ Root-cause: 前置节点 #N-14 外键连接条件缺失",
      "├─ Chain: #N-14 → #N-18 多表JOIN → #N-22 去重",
      "└─ Emit diag.chain → PathPlanner · confidence 0.91 ✓",
    ],
    exam: [
      "▸ [Diagnostic] probe graph snapshot · nodes=48 edges=126",
      "├─ Symptom: 范式判断错误 · 候选键遗漏",
      "├─ Trace: 属性闭包 {A,B}+ 未覆盖全属性",
      "├─ Root-cause: #N-27 BCNF 分解与候选键",
      "├─ Chain: #N-27 → #N-25 函数依赖 → #N-24 范式",
      "└─ Emit diag.chain → SocraticTutor · confidence 0.89 ✓",
    ],
    practice: [
      "▸ [Diagnostic] probe graph snapshot · nodes=48 edges=126",
      "├─ Symptom: type=ALL · rows 1.2M · key=NULL",
      "├─ Trace: WHERE 两侧类型不一致 → 隐式转换",
      "├─ Root-cause: #N-39 覆盖索引与回表",
      "├─ Chain: #N-39 → #N-36 复合索引 → #N-33 B+树",
      "└─ Emit diag.chain → SQLLabAgent · confidence 0.94 ✓",
    ],
  },
  path: {
    guest: [
      "▸ [PathPlanner] topo-sort 48 nodes · cycle check ✓",
      "├─ Unlock: [N-01 SELECT] → [N-04 JOIN] → [N-07 聚合]",
      "├─ Strategy: 最短补链 · 3 节点 · 24 min",
      "├─ Resource mix: DOC 2 · QUIZ 1 · LAB 0",
      "├─ Replan: persona=GUEST · waiting for role",
      "└─ Emit path.preview → Orchestrator",
    ],
    foundation: [
      "▸ [PathPlanner] topo-sort 48 nodes · cycle check ✓",
      "├─ Unlock: [N-12 SELECT基础] → [N-18 多表JOIN] → [N-24 执行计划]",
      "├─ Strategy: 前置补齐优先 · 5 节点 · 38 min",
      "├─ Resource mix: DOC 3 · QUIZ 2 · LAB 1 · CARD 1",
      "├─ Replan on BKT Δ>0.08 · slack 12%",
      "└─ Emit path.v7 → SQLLabAgent · locked ✓",
    ],
    exam: [
      "▸ [PathPlanner] topo-sort 48 nodes · cycle check ✓",
      "├─ Unlock: [N-25 函数依赖] → [N-27 BCNF] → [N-29 范式判定]",
      "├─ Strategy: 高频考点突击 · 4 节点 · 32 min",
      "├─ Resource mix: QUIZ 3 · DOC 2 · CARD 1",
      "├─ Replan on error-cluster ≥2 · slack 8%",
      "└─ Emit path.v9 → QuizAgent · locked ✓",
    ],
    practice: [
      "▸ [PathPlanner] topo-sort 48 nodes · cycle check ✓",
      "├─ Unlock: [N-33 B+树] → [N-36 复合索引] → [N-39 覆盖索引]",
      "├─ Strategy: 实战调优链 · 4 节点 · 45 min",
      "├─ Resource mix: LAB 3 · DOC 1 · QUIZ 1",
      "├─ Replan on EXPLAIN diff ≥1 · slack 15%",
      "└─ Emit path.v11 → SQLLabAgent · locked ✓",
    ],
  },
  document: {
    guest: [
      "▸ [DocumentAgent] template=concept-explain · lang=zh-CN",
      "├─ Outline: 定义 → 例子 → 反例 → 自测",
      "├─ Section 1: 多表查询的三种连接语义",
      "├─ Section 2: 反例 · 漏写 ON 导致笛卡尔积",
      "├─ Analogy: JOIN = 两张表的「配对游戏」",
      "└─ Output: markdown 1,240 字 · citations 3 · 待审",
    ],
    foundation: [
      "▸ [DocumentAgent] template=concept-explain · persona=FOUNDATION",
      "├─ Outline: 定义 → 图示 → 反例 → 练习锚点",
      "├─ Section 1: INNER/LEFT JOIN 的集合语义",
      "├─ Section 2: 反例 · ON 遗漏 → 2,340 行",
      "├─ Analogy: JOIN 谓词 = 学生与课程的选课规则",
      "└─ Output: markdown 1,680 字 · citations 5 · 待审",
    ],
    exam: [
      "▸ [DocumentAgent] template=exam-note · persona=EXAM",
      "├─ Outline: 考点 → 判定步骤 → 易错项 → 速记",
      "├─ Section 1: 候选键与属性闭包判定四步法",
      "├─ Section 2: BCNF 反例 · 丢失函数依赖",
      "├─ Mnemonic: 先闭包、再超键、后分解",
      "└─ Output: markdown 1,420 字 · citations 4 · 待审",
    ],
    practice: [
      "▸ [DocumentAgent] template=runbook · persona=PRACTICE",
      "├─ Outline: 现象 → EXPLAIN 证据 → 改写 → 验证",
      "├─ Section 1: 隐式转换导致索引失效",
      "├─ Section 2: 反例 · WHERE varchar=1 全表扫描",
      "├─ Snippet: 覆盖索引改写 + 回表消除",
      "└─ Output: markdown 1,760 字 · snippets 6 · 待审",
    ],
  },
  diagram: {
    guest: [
      "▸ [DiagramAgent] graph=ER · layout=dagre · dpi=2x",
      "├─ Nodes: student(9) · course(7) · enroll(5)",
      "├─ Edges: student.pk → enroll.fk · course.pk → enroll.fk",
      "├─ Mermaid: erDiagram + 基数标注 ||--o{",
      "├─ A11y: alt-text generated · contrast 4.8:1",
      "└─ Output: er-preview.svg + mermaid 源码",
    ],
    foundation: [
      "▸ [DiagramAgent] graph=ER · layout=dagre · persona=FOUNDATION",
      "├─ Nodes: student(9) · course(7) · enroll(5) + 标注",
      "├─ Edges: 外键连线高亮 · 缺失 ON 条件红色虚线",
      "├─ Mermaid: erDiagram · student ||--o{ enroll : selects",
      "├─ Annotation: 笛卡尔积风险节点 ×1",
      "└─ Output: er.svg + mermaid · 质检待审",
    ],
    exam: [
      "▸ [DiagramAgent] graph=dependency · layout=dot",
      "├─ Nodes: 属性 6 · 函数依赖 5 · 候选键 2",
      "├─ Edges: A→B · A→C · AB→D · 传递依赖 B→C",
      "├─ Mermaid: graph TD · 闭包路径高亮",
      "├─ Annotation: BCNF 违约边 ×1",
      "└─ Output: fd-graph.svg + mermaid · 质检待审",
    ],
    practice: [
      "▸ [DiagramAgent] graph=plan · layout=dot · engine=MySQL8",
      "├─ Nodes: scan → filter → join → sort",
      "├─ Edges: rows 1.2M → 39 → 39 · cost 420ms",
      "├─ Mermaid: graph LR · 全表扫描节点标红",
      "├─ Annotation: 缺失索引 · key=NULL ×1",
      "└─ Output: explain-graph.svg + mermaid · 质检待审",
    ],
  },
  quiz: {
    guest: [
      "▸ [QuizAgent] target=SQL_JOIN · bloom=L2 · count=3",
      "├─ Q1: 哪种连接会保留左表未匹配行？ [LEFT JOIN]",
      "├─ Distractor A: INNER JOIN ← 误认为保留",
      "├─ Distractor B: CROSS JOIN ← 混淆笛卡尔积",
      "├─ Distractor C: UNION ← 混淆集合运算",
      "└─ Output: quiz.preview · 3 题 · 错因映射 3 条",
    ],
    foundation: [
      "▸ [QuizAgent] target=SQL_JOIN · bloom=L2 · count=5",
      "├─ Q1: LEFT JOIN 未匹配行如何补值？ [NULL]",
      "├─ Distractor A: 0 ← 混淆数值默认值",
      "├─ Distractor B: 空字符串 ← 混淆类型默认值",
      "├─ Distractor C: 报错 ← 混淆严格模式",
      "└─ Output: quiz.v7 · 5 题 · 干扰项命中率 0.72",
    ],
    exam: [
      "▸ [QuizAgent] target=NORMALIZATION · bloom=L3 · count=5",
      "├─ Q1: R(A,B,C), A→B, B→C 属于？ [2NF]",
      "├─ Distractor A: 3NF ← 忽略传递依赖",
      "├─ Distractor B: BCNF ← 混淆决定因素",
      "├─ Distractor C: 1NF ← 混淆原子性",
      "└─ Output: quiz.v9 · 5 题 · 干扰项命中率 0.68",
    ],
    practice: [
      "▸ [QuizAgent] target=INDEX_TUNING · bloom=L4 · count=4",
      "├─ Q1: 最左前缀失效的场景是？ [跳过首列]",
      "├─ Distractor A: 使用覆盖索引 ← 概念混淆",
      "├─ Distractor B: 范围查询后列 ← 部分正确",
      "├─ Distractor C: 等值查询首列 ← 完全相反",
      "└─ Output: quiz.v11 · 4 题 · 干扰项命中率 0.75",
    ],
  },
  sandbox: {
    guest: [
      "▸ [SQLLabAgent] boot sql.js WASM · mem=64MB · tables=8",
      "├─ Dataset: student/course/enroll/dept/teacher...",
      "├─ Seed: 1,024 rows · schema checksum ✓",
      "├─ Sandbox: read-only snapshot · timeout 3s",
      "├─ Assert: EXPLAIN QUERY PLAN exists",
      "└─ Output: lab.preview · 0 用户查询",
    ],
    foundation: [
      "▸ [SQLLabAgent] boot sql.js WASM · mem=64MB · tables=8",
      "├─ Dataset: student(200) · course(40) · enroll(1,024)",
      "├─ Seed: FK 约束 6 条 · schema checksum ✓",
      "├─ Sandbox: per-user mem DB · timeout 3s · row limit 5k",
      "├─ Assert: 结果集 39 行 · 无笛卡尔积",
      "└─ Output: lab.v7 · 通过 3/3 断言 ✓",
    ],
    exam: [
      "▸ [SQLLabAgent] boot sql.js WASM · mem=64MB · tables=8",
      "├─ Dataset: fd_sample(12) · relation_r(64)",
      "├─ Seed: 闭包测试数据 · schema checksum ✓",
      "├─ Sandbox: 隔离事务 · rollback on fail",
      "├─ Assert: 候选键唯一 · BCNF 分解无损",
      "└─ Output: lab.v9 · 通过 4/4 断言 ✓",
    ],
    practice: [
      "▸ [SQLLabAgent] boot sql.js WASM · mem=64MB · tables=8",
      "├─ Dataset: orders(1.2M) · users(80k) · items(240k)",
      "├─ Seed: 索引 4 个 · 统计信息 ANALYZE ✓",
      "├─ Sandbox: 内存表 · timeout 3s · plan capture",
      "├─ Assert: EXPLAIN key=idx_user_created · rows<100",
      "└─ Output: lab.v11 · 通过 5/5 断言 ✓",
    ],
  },
  tutor: {
    guest: [
      "▸ [SocraticTutor] retrieve top-k=4 · course=DB basis",
      "├─ Hits: Card #DB-204 (0.88) · #DB-219 (0.84)",
      "├─ Card #DB-204: 连接谓词与结果集基数",
      "├─ Ask: 你认为重复行来自哪一步？",
      "├─ Hint: 先看 ON 条件，再数结果行数",
      "└─ Output: tutor.reply · 1 问 · 0 直接答案",
    ],
    foundation: [
      "▸ [SocraticTutor] retrieve top-k=4 · persona=FOUNDATION",
      "├─ Hits: Card #DB-204 (0.91) · #DB-219 (0.87)",
      "├─ Card #DB-204: JOIN 谓词的作用域",
      "├─ Ask: 如果漏写 ON，两张表会如何配对？",
      "├─ Hint: 想想 200×40 与 39 的数量差距",
      "└─ Output: tutor.reply · misconception=笛卡尔积",
    ],
    exam: [
      "▸ [SocraticTutor] retrieve top-k=4 · persona=EXAM",
      "├─ Hits: Card #DB-231 (0.93) · #DB-244 (0.86)",
      "├─ Card #DB-231: 属性闭包判定候选键",
      "├─ Ask: 为什么 {A,B}+ 覆盖全属性就能定键？",
      "├─ Hint: 闭包是从已知依赖「滚雪球」",
      "└─ Output: tutor.reply · misconception=传递依赖",
    ],
    practice: [
      "▸ [SocraticTutor] retrieve top-k=4 · persona=PRACTICE",
      "├─ Hits: Card #DB-260 (0.92) · #DB-271 (0.89)",
      "├─ Card #DB-260: 隐式类型转换与索引失效",
      "├─ Ask: 为什么 varchar_col = 1 走不了索引？",
      "├─ Hint: 比较之前，数据库先做了什么转换？",
      "└─ Output: tutor.reply · misconception=索引失效",
    ],
  },
  bkt: {
    guest: [
      "▸ [BKT-Evaluator] params: P(Init)=0.30 · P(Transit)=0.10",
      "├─ Params: P(Slip)=0.10 · P(Guess)=0.20",
      "├─ Observe: correct on demo item · prior 0.30",
      "├─ Posterior: P(L_t) 0.30 → 0.46 · K=1",
      "├─ Next review: +1d → 2026-10-22 09:00",
      "└─ Emit bkt.vec → Profiler · confidence 0.64",
    ],
    foundation: [
      "▸ [BKT-Evaluator] params: P(Init)=0.30 · P(Transit)=0.12",
      "├─ Params: P(Slip)=0.10 · P(Guess)=0.22",
      "├─ Observe: 4/6 correct · skill=多表JOIN",
      "├─ Posterior: P(L_t) 0.42 → 0.68 · K=6",
      "├─ Mastery gate: 0.68 < 0.85 · 继续巩固",
      "└─ Emit bkt.vec → Profiler · confidence 0.88 ✓",
    ],
    exam: [
      "▸ [BKT-Evaluator] params: P(Init)=0.34 · P(Transit)=0.14",
      "├─ Params: P(Slip)=0.09 · P(Guess)=0.18",
      "├─ Observe: 7/9 correct · skill=范式判定",
      "├─ Posterior: P(L_t) 0.51 → 0.79 · K=9",
      "├─ Mastery gate: 0.79 < 0.90 · 冲刺激活",
      "└─ Emit bkt.vec → Profiler · confidence 0.91 ✓",
    ],
    practice: [
      "▸ [BKT-Evaluator] params: P(Init)=0.38 · P(Transit)=0.16",
      "├─ Params: P(Slip)=0.08 · P(Guess)=0.15",
      "├─ Observe: 5/7 correct · skill=覆盖索引",
      "├─ Posterior: P(L_t) 0.46 → 0.71 · K=7",
      "├─ Mastery gate: 0.71 < 0.85 · 实验强化",
      "└─ Emit bkt.vec → Profiler · confidence 0.90 ✓",
    ],
  },
  review: {
    guest: [
      "▸ [ReviewGuard] gate=4D · policy=strict · dry-run",
      "├─ [✓] 事实出处核验 96% · citations 3/3",
      "├─ [✓] SQL 语法可执行 · sandbox pass",
      "├─ [✓] 无幻觉越界 · claim check 100%",
      "├─ [—] 难度匹配画像 · persona=GUEST 跳过",
      "└─ Verdict: CONDITIONAL · 等待角色选择",
    ],
    foundation: [
      "▸ [ReviewGuard] gate=4D · policy=strict · persona=FOUNDATION",
      "├─ [✓] 事实出处核验 100% · citations 5/5",
      "├─ [✓] SQL 语法可执行 · sandbox pass 3/3",
      "├─ [✓] 无幻觉越界 · claim check 100%",
      "├─ [✓] 难度匹配画像 · target 0.42 ✓",
      "└─ Verdict: PASS · 交付 6 件资源 · 0 拦截",
    ],
    exam: [
      "▸ [ReviewGuard] gate=4D · policy=strict · persona=EXAM",
      "├─ [✓] 事实出处核验 100% · citations 4/4",
      "├─ [✓] SQL 语法可执行 · sandbox pass 4/4",
      "├─ [✓] 无幻觉越界 · claim check 100%",
      "├─ [✓] 难度匹配画像 · bloom L3 ✓",
      "└─ Verdict: PASS · 交付 7 件资源 · 0 拦截",
    ],
    practice: [
      "▸ [ReviewGuard] gate=4D · policy=strict · persona=PRACTICE",
      "├─ [✓] 事实出处核验 100% · citations 6/6",
      "├─ [✓] SQL 语法可执行 · sandbox pass 5/5",
      "├─ [✓] 无幻觉越界 · claim check 100%",
      "├─ [✓] 难度匹配画像 · bloom L4 ✓",
      "└─ Verdict: PASS · 交付 9 件资源 · 0 拦截",
    ],
  },
  memory: {
    guest: [
      "▸ [MemoryAgent] recall memory pool · items=0 · cold start",
      "├─ Ebbinghaus: R(t)=e^(-t/S) · S=1.0d",
      "├─ Due queue: empty · 等待首次学习事件",
      "├─ Spaced repetition: [1d, 3d, 7d, 21d]",
      "├─ Write-back: dry-run · no profile mutation",
      "└─ Emit memory.preview → Orchestrator",
    ],
    foundation: [
      "▸ [MemoryAgent] recall memory pool · items=37 · hits=12",
      "├─ Ebbinghaus: R(t)=e^(-t/S) · S=2.4d · R=0.71",
      "├─ Due queue: 6 cards · next 2026-10-22 09:00",
      "├─ Spaced repetition: JOIN错题 [1d, 3d, 7d, 21d]",
      "├─ Decay flag: 笛卡尔积错因 R=0.58 → 提前复习",
      "└─ Emit memory.due → PathPlanner ✓",
    ],
    exam: [
      "▸ [MemoryAgent] recall memory pool · items=64 · hits=21",
      "├─ Ebbinghaus: R(t)=e^(-t/S) · S=3.1d · R=0.76",
      "├─ Due queue: 9 cards · next 2026-10-23 09:00",
      "├─ Spaced repetition: 范式错题 [1d, 3d, 7d, 21d]",
      "├─ Decay flag: BCNF错因 R=0.63 → 考前优先",
      "└─ Emit memory.due → QuizAgent ✓",
    ],
    practice: [
      "▸ [MemoryAgent] recall memory pool · items=88 · hits=27",
      "├─ Ebbinghaus: R(t)=e^(-t/S) · S=3.8d · R=0.81",
      "├─ Due queue: 11 cards · next 2026-10-22 21:00",
      "├─ Spaced repetition: 执行计划错题 [1d, 3d, 7d]",
      "├─ Decay flag: 回表错因 R=0.66 → 实验复现",
      "└─ Emit memory.due → SQLLabAgent ✓",
    ],
  },
};

const GRAPH_CHAPTERS = [
  { key: "relations", label: "关系模型", prefix: "RM", base: { foundation: 46, exam: 64, practice: 74 }, labels: ["关系代数", "元组与属性", "主键与外键", "实体联系", "关系完整性", "范式入门"], offsets: [18, 10, 4, -6, 2, 12] },
  { key: "sql", label: "SQL核心", prefix: "SQ", base: { foundation: 48, exam: 68, practice: 78 }, labels: ["SELECT基础", "WHERE过滤", "多表JOIN", "子查询嵌套", "聚合分组", "窗口函数"], offsets: [20, 14, 2, -8, 8, 0] },
  { key: "index", label: "索引与调优", prefix: "IX", base: { foundation: 42, exam: 62, practice: 80 }, labels: ["B+树索引", "复合索引", "覆盖索引", "执行计划EXPLAIN", "连接算法", "慢查询分析"], offsets: [16, 6, -4, 12, 2, -10] },
  { key: "tx", label: "事务并发", prefix: "TX", base: { foundation: 44, exam: 66, practice: 76 }, labels: ["ACID", "隔离级别", "脏读", "不可重复读", "锁与MVCC", "死锁检测"], offsets: [18, 8, 4, -2, 10, -6] },
] as const;

const RESOURCE_TYPES = [
  { key: "doc", icon: "📄", label: "概念精讲", tone: "accent" },
  { key: "graph", icon: "🕸️", label: "关系图谱", tone: "success" },
  { key: "sql", icon: "💻", label: "SQL实验", tone: "agent" },
  { key: "quiz", icon: "🎯", label: "靶向测验", tone: "warning" },
  { key: "card", icon: "🗂️", label: "速记闪卡", tone: "accent" },
  { key: "lab", icon: "🔬", label: "调优案例", tone: "success" },
] as const;

type ResourceKey = (typeof RESOURCE_TYPES)[number]["key"];

const PERSONA_BRIEFS: Record<PersonaKey, { kicker: string; title: string; points: string[] }> = {
  guest: { kicker: "LEARNING BRIEF", title: "选择角色后生成专属要点", points: ["关系模型的核心抽象", "SQL 查询的执序", "索引与执行计划"] },
  foundation: { kicker: "FOUNDATION BRIEF", title: "关系模型：从表到关系", points: ["元组 = 一行，属性 = 一列", "候选键唯一标识元组", "外键维护参照完整性"] },
  exam: { kicker: "EXAM SPRINT", title: "范式判定速查", points: ["1NF：属性保持原子性", "2NF：消除部分函数依赖", "3NF：消除传递函数依赖"] },
  practice: { kicker: "PRACTICE PLAYBOOK", title: "复合索引设计要点", points: ["遵循最左前缀原则", "覆盖索引避免回表", "用 EXPLAIN 验证扫描行数"] },
};

const QUIZ_BY_PERSONA: Record<PersonaKey, { question: string; options: string[]; correct: number }> = {
  guest: { question: "关系模型中，一行通常称为什么？", options: ["元组", "属性", "关系"], correct: 0 },
  foundation: { question: "关系模型中，一行通常称为什么？", options: ["元组", "属性", "关系"], correct: 0 },
  exam: { question: "若 R(A,B,C) 存在 A→B、B→C，则 R 至少违反哪个范式？", options: ["1NF", "2NF", "3NF"], correct: 2 },
  practice: { question: "复合索引 (dept, age) 下，哪类查询无法有效利用索引？", options: ["WHERE dept = ?", "WHERE dept = ? AND age > ?", "WHERE age > ?"], correct: 2 },
};

function graphMastery(base: number, offset: number) {
  return Math.max(16, Math.min(96, base + offset));
}

/** Semantic mastery ramp: teal mastered, amber shortfall, terracotta still building. */
function masteryColor(value: number, theme: ThemeTokens) {
  if (value >= 80) return theme.success;
  if (value >= 55) return theme.warning;
  return theme.accentPrimary;
}

const CHAPTER_EXERCISES: Record<string, string[]> = {
  relations: ["两表笛卡尔积与自然连接对比", "候选键与主键判定", "关系完整性约束实验"],
  sql: ["三表 JOIN 查询成绩", "相关子查询改写", "窗口函数排名"],
  index: ["复合索引最左前缀验证", "覆盖索引执行计划对照", "慢查询索引优化"],
  tx: ["隔离级别与脏读实验", "MVCC 快照读验证", "死锁检测与重试"],
};

const STAGE_DETAIL_LINES = [
  ["[SQL Parser] AST 解析完成：JOIN×3 · 子查询×1 · 预计代价 420ms", "[BKT] 更新 relations 0.48 → 0.52 · 置信度 0.81"],
  ["[Profiler] 薄弱维：多表连接 42% · 子查询嵌套 47%", "[BKT] 八维画像同步完成 · EWMA α=0.35"],
  ["[Diagnostic] 定位前置断点 #Node-14 关系代数基础", "[BKT] 前置依赖概率 0.31 · 建议先补基础"],
  ["[PathPlanner] 生成 3 节点路径 · 预计 24 分钟完成", "[Orchestrator] 路径已锁定 · 资源配额 6 件"],
  ["[ResourceAgent] 调度解析、练习与 SQL 沙箱 · 6 类资源", "[DocumentAgent] 概念精讲生成中 · 引用 5 条"],
  ["[ReviewGuard] 四维质检通过：事实 92 · 安全 98 · 格式 95", "[Orchestrator] 学习闭环完成 · 已写入画像"],
] as const;

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== "function") return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduced(value); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return reduced;
}

function PulsingDot({ color, size = 6 }: { color?: string; size?: number }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const tint = color ?? theme.success;
  const reduced = useReducedMotion();
  const isWeb = Platform.OS === "web";
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (isWeb || reduced) { pulse.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1200, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1200, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [isWeb, pulse, reduced]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });
  const haloMotion = isWeb
    ? motion.dotPulse
    : { opacity: reduced ? 0 : opacity, transform: reduced ? undefined : [{ scale }] };
  return <View style={styles.pulseWrap}>
    <Animated.View style={[styles.pulseHalo, {
      width: size + 1,
      height: size + 1,
      borderRadius: (size + 1) / 2,
      backgroundColor: tint,
    }, haloMotion]} />
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint }} />
  </View>;
}

function LogoMark() {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  return <View style={styles.logoWrap}>
    <View style={[styles.logoMark, { backgroundColor: theme.accentPrimary, borderColor: theme.accentSoftBorder }, webOnly({
      backgroundImage: `linear-gradient(135deg, ${theme.accentGradientFrom} 0%, ${theme.accentPrimary} 100%)`,
      boxShadow: `0 0 22px ${theme.accentShadow}, inset 0 1px 0 rgba(255, 255, 255, 0.28)`,
    })]}>
      <Text style={styles.logoGlyph}>⬡</Text>
    </View>
    <View style={[styles.logoOnline, { backgroundColor: theme.success, borderColor: theme.bgCanvas }]} />
  </View>;
}

const TRAFFIC_LIGHTS = [
  { color: "#FF5F56", glyph: "×", label: "关闭" },
  { color: "#FFBD2E", glyph: "−", label: "最小化" },
  { color: "#27C93F", glyph: "+", label: "展开" },
] as const;

/** Decorative macOS traffic lights with a hover glyph reveal. */
function TrafficLights() {
  const styles = useLoginStyles();
  const [hovered, setHovered] = useState<number | null>(null);
  return <View style={styles.trafficLights}>
    {TRAFFIC_LIGHTS.map((light, index) => <Pressable
      key={light.label}
      accessibilityRole="button"
      accessibilityLabel={`${light.label}窗口（演示）`}
      accessibilityHint="装饰性窗口控制"
      onPress={() => undefined}
      onHoverIn={() => setHovered(index)}
      onHoverOut={() => setHovered(null)}
      style={[styles.trafficDot, { backgroundColor: light.color }]}
    >
      {hovered === index ? <Text style={styles.trafficGlyph}>{light.glyph}</Text> : null}
    </Pressable>)}
  </View>;
}

/** Shared macOS-style title bar used by the live terminal and SQL sandbox. */
function MacWindowHeader({ title, right }: { title: string; right?: ReactNode }) {
  const styles = useLoginStyles();
  return <View style={styles.macWindowHeader}>
    <TrafficLights />
    <Text style={styles.macWindowTitle} numberOfLines={1}>{title}</Text>
    <View style={styles.macWindowRight}>{right}</View>
  </View>;
}

function TopNav({
  isWide,
  isNarrow,
  showVersion,
  showPills,
  showDetail,
  showSystemStatus,
  switcherCompact,
  activeTab,
  onSelectTab,
  onHelp,
}: {
  isWide: boolean;
  isNarrow: boolean;
  showVersion: boolean;
  showPills: boolean;
  showDetail: boolean;
  showSystemStatus: boolean;
  switcherCompact: boolean;
  activeTab: InspectorTab;
  onSelectTab: (tab: InspectorTab) => void;
  onHelp: () => void;
}) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  return <View nativeID="top-navbar" style={[
    styles.navbar,
    isWide && styles.navbarWide,
    isNarrow && styles.navbarNarrow,
    { backgroundColor: theme.bgGlass, borderBottomColor: theme.borderSubtle },
    motion.entrance0,
    webOnly({
      zIndex: 50,
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)",
    }),
  ]}>
    <View style={[styles.navBrand, isNarrow && styles.navBrandNarrow]}>
      <LogoMark />
      <Text style={styles.navBrandText}>知径 <Text style={styles.navBrandAccent}>DB</Text></Text>
      {showVersion ? <View style={styles.versionPill}><Text style={styles.versionText}>v2.4 Enterprise</Text></View> : null}
    </View>

    {showPills ? <View accessibilityRole="tablist" accessibilityLabel="功能面板切换" style={styles.navPills}>{NAV_STATUS.map((item) => {
      const active = activeTab === item.tab;
      const color = toneColor(theme, item.tone);
      return <Pressable
        key={item.label}
        nativeID={`nav-${item.tab}`}
        accessibilityRole="tab"
        accessibilityLabel={item.label}
        accessibilityState={{ selected: active }}
        onPress={() => onSelectTab(item.tab)}
        style={(state: PressState) => [
          styles.navPill,
          active && styles.navPillActive,
          active && { borderColor: `${color}88`, boxShadow: `0 0 16px ${color}33` },
          state.hovered && !active && styles.navPillHover,
          state.pressed && styles.navPillPressed,
        ]}
      >
        {active ? <View pointerEvents="none" style={[styles.navPillTopLine, { backgroundColor: color }]} /> : null}
        <Text style={[styles.navPillIcon, { color }]}>{item.icon}</Text>
        <Text style={[styles.navPillText, active && styles.navPillTextActive]}>{item.label}</Text>
        {active ? <View pointerEvents="none" style={[styles.navPillCursor, { borderTopColor: color }]} /> : null}
      </Pressable>;
    })}</View> : null}

    <View style={[styles.navRight, switcherCompact && styles.navRightCompact]}>
      {showSystemStatus ? <View style={styles.systemStatus}>
        <PulsingDot color={theme.success} />
        <Text style={styles.systemStatusText} numberOfLines={1}>System Operational{showDetail ? " · 12 Agents Online" : ""}</Text>
      </View> : null}
      <ThemeSwitcher compact={switcherCompact} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="打开使用帮助"
        onPress={onHelp}
        style={(state: PressState) => [
          styles.navHelp,
          state.hovered && styles.navHelpHover,
          state.pressed && styles.navHelpPressed,
          webOnly({ transitionProperty: "transform, background-color, border-color", transitionDuration: "160ms" }),
        ]}
      >
        <View style={styles.navHelpIcon}><Text style={styles.navHelpIconText}>?</Text></View>
        {isWide ? <Text style={styles.navHelpText}>使用帮助</Text> : null}
      </Pressable>
    </View>
  </View>;
}

function FooterTelemetry({ isWide }: { isWide: boolean }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  return <View nativeID="footer-telemetry" style={[styles.footer, motion.entrance4]}>
    <View style={styles.footerLeft}>
      <PulsingDot color={theme.success} size={5} />
      <Text style={styles.footerText} numberOfLines={1}>
        ENGINE: <Text style={styles.footerValue}>BKT-DIAGNOSIS-V2</Text>
        <Text style={styles.footerDim}> · </Text>LATENCY: <Text style={styles.footerValue}>18ms</Text>
        {isWide ? <><Text style={styles.footerDim}> · </Text>SANDBOX: <Text style={styles.footerValue}>SQL.JS WASM READY</Text></> : null}
      </Text>
    </View>
    {isWide ? <Text style={styles.footerRight}>REGION: CN-EAST-1 · BUILD 2.4.0</Text> : null}
  </View>;
}

function AgentMesh() {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const tones: Tone[] = ["accent", "success", "warning"];
  return <View style={styles.microWrap}>
    <View style={styles.meshGrid}>
      {Array.from({ length: 12 }, (_, index) => <View
        key={index}
        style={[styles.meshDot, {
          backgroundColor: toneColor(theme, tones[index % tones.length] ?? "accent"),
        }, MESH_BREATHS[index % MESH_BREATHS.length]]}
      />)}
    </View>
    <Text style={styles.microCaption}>PIPELINE MESH</Text>
  </View>;
}

function NodeSparkline() {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  return <View style={styles.microWrap}>
    <View style={[styles.sparkline, webOnly({
      backgroundImage: sparklineSvg(theme),
      backgroundSize: "100% 100%",
      backgroundRepeat: "no-repeat",
    })]}>
      <View pointerEvents="none" style={[styles.sparkScan, motion.sparkScan, webOnly({
        backgroundImage: `linear-gradient(90deg, transparent, ${theme.accentHalo}, transparent)`,
      })]} />
    </View>
    <Text style={styles.microCaption}>TOPOLOGY TRACE</Text>
  </View>;
}

function ResourceEnergy() {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  return <View style={styles.microWrap}>
    <View style={styles.energyBar}>
      {RESOURCE_SEGMENTS.map((segment, index) => <View
        key={segment.key}
        style={[styles.energyColumn, { flex: segment.flex, minWidth: ENERGY_LABEL_MIN[segment.key] ?? 0 }]}
      >
        <View style={[styles.energySegment, { backgroundColor: toneColor(theme, segment.tone) }, ENERGY_PULSES[index % ENERGY_PULSES.length]]} />
        <Text style={[styles.energyLabel, { color: toneColor(theme, segment.tone) }]} numberOfLines={1}>{segment.key}</Text>
      </View>)}
    </View>
  </View>;
}

function BentoStat({ stat, index, active, onPress }: {
  stat: (typeof STATS)[number];
  index: number;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const color = toneColor(theme, stat.tone);
  const soft = toneSoft(theme, stat.tone);
  return <Pressable
    nativeID={`bento-${stat.tab}`}
    accessibilityRole="tab"
    accessibilityLabel={`${stat.value} ${stat.label}`}
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={(state: PressState) => [
      styles.statCard,
      state.hovered && !active && styles.statCardHover,
      active && styles.statCardActive,
      active && { borderColor: `${color}99`, boxShadow: `0 0 0 1px ${color}33, 0 10px 26px ${color}22` },
      state.pressed && styles.statCardPressed,
      BENTO_ENTRANCES[index],
      webOnly({
        backgroundColor: active
          ? soft
          : state.hovered
            ? theme.bgElevated
            : theme.bgSurface,
        transitionProperty: "border-color, background-color, transform, box-shadow",
        transitionDuration: "180ms",
      }),
    ]}
  >
    {active ? <View pointerEvents="none" style={[
      styles.statTopLine,
      { boxShadow: `0 0 12px ${color}` },
      webOnly({ backgroundImage: theme.accentGradient, backgroundColor: "transparent" }),
    ]} /> : null}
    <View style={styles.statTop}>
      <Text style={[styles.statIcon, { color }]}>{stat.icon}</Text>
      <Text style={[styles.statMeta, active && { color }]}>{stat.unit}</Text>
    </View>
    <Text style={styles.statValue}>{stat.value}</Text>
    <Text style={styles.statLabel}>{stat.label}</Text>
    {stat.kind === "mesh" ? <AgentMesh /> : stat.kind === "spark" ? <NodeSparkline /> : <ResourceEnergy />}
    <Text style={styles.statHint}>点击展开深度交互演示 ↓</Text>
    {active ? <View pointerEvents="none" style={[styles.statCursor, { borderTopColor: color }]} /> : null}
  </Pressable>;
}

function telemetryTone(line: string, styles: ReturnType<typeof createStyles>) {
  if (line.includes("✓")) return styles.telemetryOk;
  if (line.includes("⚠") || line.includes("✕")) return styles.telemetryWarn;
  if (line.includes("[—]")) return styles.telemetryIdle;
  if (line.startsWith("▸")) return styles.telemetryPrompt;
  return styles.telemetryLine;
}

function AgentTerminal({ personaKey, activeStage, reducedMotion, focus }: {
  personaKey: PersonaKey;
  activeStage: number;
  reducedMotion: boolean;
  focus: (typeof AGENT_MATRIX)[number] | null;
}) {
  const styles = useLoginStyles();
  const logs = PERSONA_LOGS[personaKey];
  const focusLines = focus ? AGENT_LOGS[focus.key][personaKey] : null;
  const targetLog = focusLines
    ? focusLines.join("\n")
    : [logs[activeStage] ?? logs[0]!, ...(STAGE_DETAIL_LINES[activeStage] ?? [])].join("\n");
  const [typedLog, setTypedLog] = useState(targetLog);

  useEffect(() => {
    if (focusLines) return;
    if (reducedMotion) {
      const timer = setTimeout(() => setTypedLog(targetLog), 0);
      return () => clearTimeout(timer);
    }
    let index = 0;
    const timer = setInterval(() => {
      index += 2;
      setTypedLog(targetLog.slice(0, index));
      if (index >= targetLog.length) clearInterval(timer);
    }, 28);
    return () => clearInterval(timer);
  }, [targetLog, reducedMotion, focusLines]);

  const displayLog = reducedMotion ? targetLog : typedLog;
  const history = focusLines ? [] : logs.slice(Math.max(0, activeStage - 2), activeStage);
  const io = focus ? AGENT_IO[focus.key] : null;

  return <View nativeID="agent-terminal" style={styles.terminal}>
    <MacWindowHeader
      title={`terminal — ${focus ? focus.key : "profiler"}.zsh — 80×24`}
      right={<Text style={styles.terminalStage}>{focus ? `${String(focus.stage + 1).padStart(2, "0")}/06` : `${String(activeStage + 1).padStart(2, "0")}/06`}</Text>}
    />
    <View style={styles.terminalBody}>
      {focusLines
        ? focusLines.map((line, index) => <Text
            key={`${focus?.key}-${personaKey}-${index}`}
            style={[styles.telemetryLine, telemetryTone(line, styles), TERMINAL_LINES[index % TERMINAL_LINES.length]]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >{line}</Text>)
        : <>
            {history.map((line, index) => <Text key={`${personaKey}-${activeStage}-${index}`} style={[styles.terminalHistory, TERMINAL_LINES[index % TERMINAL_LINES.length]]} numberOfLines={1}>{line}</Text>)}
            <View style={styles.terminalLine}>
              <Text style={styles.terminalPrompt}>❯</Text>
              <Text style={styles.terminalText}>{displayLog}</Text>
              <View style={[styles.caret, motion.caretBlink]} />
            </View>
          </>}
    </View>
    {io ? <View style={styles.ioBar}>
      <View style={styles.ioRow}>
        <Text style={[styles.ioPill, styles.ioPillIn]}>INPUT</Text>
        <Text style={styles.ioValue} numberOfLines={1}>{io.input}</Text>
      </View>
      <View style={styles.ioRow}>
        <Text style={[styles.ioPill, styles.ioPillEngine]}>ENGINE</Text>
        <Text style={styles.ioValue} numberOfLines={1}>{io.engine}</Text>
      </View>
      <View style={styles.ioRow}>
        <Text style={[styles.ioPill, styles.ioPillOut]}>OUTPUT</Text>
        <Text style={styles.ioValue} numberOfLines={1}>{io.output}</Text>
      </View>
    </View> : null}
    <Text accessibilityLiveRegion="polite" style={styles.srOnly}>{targetLog}</Text>
    <View style={styles.terminalFooter}>
      <Text style={styles.terminalMeta} numberOfLines={1}>{focus ? `TELEMETRY · ${focus.cn}` : PERSONA_LABELS[personaKey]}</Text>
      <Text style={styles.terminalMeta}>{focus ? `${focus.status} · ${focus.latency}` : `STREAM · ${activeStage + 1}/6`}</Text>
    </View>
  </View>;
}

/** Shared animated progress track: fills once on mount on every platform. */
function GrowthBar({ value, color, height = 8, label }: { value: number; color: string; height?: number; label: string }) {
  const styles = useLoginStyles();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 60);
    return () => clearTimeout(timer);
  }, []);
  return <View
    accessibilityRole="progressbar"
    accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: value }}
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    style={[styles.growthTrack, { height }]}
  >
    <View style={[styles.growthFill, { width: pct(ready ? value : 0), backgroundColor: color }]} />
  </View>;
}

const QUICK_CHIPS = [
  { key: "sql", label: "▶ 模拟一次 SQL 错因诊断" },
  { key: "pipeline", label: "▶ 预览 6 阶段流水线调度" },
  { key: "bkt", label: "▶ 触发 BKT 掌握度更新" },
] as const;

const PIPELINE_SHORT = ["Orch", "Prof", "Diag", "Path", "Res", "Review"] as const;

function QuickReadout({ action }: { action: QuickAction }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  if (action === "pipeline") {
    return <View style={[styles.quickReadout, motion.panelIn]}>
      <View style={styles.quickReadoutHead}>
        <Text style={styles.quickReadoutKicker} numberOfLines={1}>ORCHESTRATOR · 6-STAGE SCHEDULE</Text>
        <Text style={styles.quickReadoutValue}>budget 2.1s</Text>
      </View>
      <View style={styles.quickPipelineRow}>
        {PIPELINE.map((stage, index) => {
          const active = index === 3;
          return <View key={stage.key} style={styles.quickPipelineStep}>
            <View style={[styles.quickPipelinePill, active && styles.quickPipelinePillActive]}>
              <Text style={[styles.quickPipelinePillText, active && styles.quickPipelinePillTextActive]} numberOfLines={1}>{PIPELINE_SHORT[index]}</Text>
            </View>
          </View>;
        })}
      </View>
      <Text style={styles.quickReadoutText}>PathPlanner 已接收调度 · 资源配额 6 件 · 预计 2.1s 完成六阶段协同。</Text>
    </View>;
  }
  if (action === "bkt") {
    return <View style={[styles.quickReadout, motion.panelIn]}>
      <View style={styles.quickReadoutHead}>
        <Text style={styles.quickReadoutKicker} numberOfLines={1}>BKT-EVALUATOR · POSTERIOR UPDATE</Text>
        <Text style={[styles.quickReadoutValue, { color: theme.success }]}>+0.26</Text>
      </View>
      <Text style={styles.quickReadoutText}>P(L_t) 0.42 → 0.68 · 掌握度后验更新完成。</Text>
      <GrowthBar value={68} color={theme.success} label="BKT 掌握度 68%" />
      <View style={styles.quickReadoutMetaRow}>
        <Text style={styles.quickReadoutMeta}>POSTERIOR P(L_t)</Text>
        <Text style={styles.quickReadoutMeta}>+0.26 · K=6</Text>
      </View>
    </View>;
  }
  return <View style={[styles.quickReadout, motion.panelIn]}>
    <View style={styles.quickReadoutHead}>
      <Text style={styles.quickReadoutKicker} numberOfLines={1}>DIAGNOSIS AGENT · SPOTLIGHT</Text>
      <Text style={styles.quickReadoutValue}>91%</Text>
    </View>
    <Text style={styles.quickReadoutText}>DiagnosisAgent located #N-14 关系代数基础</Text>
    <GrowthBar value={91} color={theme.accentPrimary} label="诊断置信度 91%" />
    <View style={styles.quickReadoutMetaRow}>
      <Text style={styles.quickReadoutMeta}>CONFIDENCE · #N-14</Text>
      <Text style={styles.quickReadoutMeta}>91%</Text>
    </View>
  </View>;
}

function OverviewPod({ tab, onExpand, onQuickAction }: {
  tab: InspectorTab;
  onExpand: () => void;
  onQuickAction: (action: QuickAction) => void;
}) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const data = TAB_OVERVIEWS[tab];
  const color = toneColor(theme, data.tone);
  const [quick, setQuick] = useState<QuickAction | null>(null);
  const [quickNonce, setQuickNonce] = useState(0);
  const triggerQuick = (action: QuickAction) => {
    setQuick(action);
    setQuickNonce((value) => value + 1);
    onQuickAction(action);
  };
  return <View style={[styles.overviewCard, { borderColor: `${color}33` }]}>
    <View style={styles.overviewHeader}>
      <PulsingDot color={color} size={7} />
      <Text style={[styles.overviewKicker, { color }]}>CURRENT MODULE · 当前选中模块</Text>
      <View style={[styles.overviewTag, { borderColor: `${color}55`, backgroundColor: `${color}14` }]}><Text style={[styles.overviewTagText, { color }]}>{data.tag}</Text></View>
    </View>
    <Text style={styles.overviewTitle}>{data.title}</Text>
    <Text style={styles.overviewDesc}>{data.description}</Text>
    <View style={styles.overviewStats}>
      {data.stats.map((item) => <View key={item} style={styles.overviewStat}><View style={[styles.overviewStatDot, { backgroundColor: color }]} /><Text style={styles.overviewStatText}>{item}</Text></View>)}
    </View>
    <View style={styles.quickChips}>
      {QUICK_CHIPS.map((chip) => {
        const active = quick === chip.key;
        return <Pressable
          key={chip.key}
          accessibilityRole="button"
          accessibilityLabel={chip.label.replace("▶ ", "")}
          accessibilityState={{ selected: active }}
          onPress={() => triggerQuick(chip.key)}
          style={({ pressed }) => [
            styles.quickChip,
            active && styles.quickChipActive,
            pressed && styles.quickChipPressed,
          ]}
        >
          <Text style={[styles.quickChipText, active && styles.quickChipTextActive]} numberOfLines={1}>{chip.label}</Text>
        </Pressable>;
      })}
    </View>
    {quick ? <QuickReadout key={`${quick}-${quickNonce}`} action={quick} /> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="展开全宽沉浸式沙盘" onPress={onExpand} style={({ pressed }) => [styles.overviewCta, pressed && styles.overviewCtaPressed]}>
      <Text style={styles.overviewCtaText}>展开全宽沉浸式沙盘 ⤢</Text>
    </Pressable>
  </View>;
}

function InspectorHeader({ kicker, meta, right, color }: { kicker: string; meta?: string; right?: ReactNode; color?: string }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const tint = color ?? theme.accentPrimary;
  return <View style={styles.inspectorHeader}>
    <PulsingDot color={tint} size={7} />
    <Text style={[styles.inspectorKicker, { color: tint }]} numberOfLines={1}>{kicker}</Text>
    {meta ? <Text style={styles.inspectorMeta} numberOfLines={1}>{meta}</Text> : null}
    {right ? <View style={styles.inspectorHeaderRight}>{right}</View> : null}
  </View>;
}

function AgentsPanel({ persona, reducedMotion, spotlightAgentKey, spotlightNonce }: {
  persona: DemoPersona | null;
  reducedMotion: boolean;
  spotlightAgentKey: AgentKey | null;
  spotlightNonce: number;
}) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const width = useHydratedWidth();
  const isWide = width >= 960;
  const isCompact = width < 560;
  const fourColumns = width >= 1280;
  const personaKey: PersonaKey = persona ?? "guest";
  const [activeStage, setActiveStage] = useState(0);
  const [paused, setPaused] = useState(false);
  const [focusAgent, setFocusAgent] = useState<(typeof AGENT_MATRIX)[number] | null>(null);
  const lastSpotlight = useRef(0);
  const { ref: terminalRef, visible: terminalVisible } = useScrollReveal(reducedMotion);

  useEffect(() => {
    if (reducedMotion || paused || focusAgent) return;
    const timer = setInterval(() => {
      setActiveStage((stage) => (stage + 1) % PIPELINE.length);
    }, 2200);
    return () => clearInterval(timer);
  }, [paused, reducedMotion, focusAgent]);

  // SQL quick action focuses the diagnostic agent; manual card clicks keep working.
  useEffect(() => {
    if (!spotlightAgentKey || spotlightNonce === lastSpotlight.current) return;
    lastSpotlight.current = spotlightNonce;
    const target = AGENT_MATRIX.find((agent) => agent.key === spotlightAgentKey);
    if (!target) return;
    const timer = setTimeout(() => {
      setFocusAgent(target);
      setActiveStage(target.stage);
    }, 0);
    return () => clearTimeout(timer);
  }, [spotlightAgentKey, spotlightNonce]);

  const lockedStage = focusAgent ? focusAgent.stage : null;
  const currentStage = lockedStage ?? activeStage;
  const activePipeline = PIPELINE[currentStage]!;

  return <View style={styles.panelFill}>
    <Reveal reducedMotion={reducedMotion} index={0}>
    <InspectorHeader
      kicker="AGENT PIPELINE · 12 AGENTS COLLABORATION"
      meta="12 AGENTS"
      color={theme.accentPrimary}
      right={<Pressable
        accessibilityRole="button"
        accessibilityLabel={paused ? "继续自动演练" : "暂停自动演练"}
        accessibilityState={{ disabled: reducedMotion }}
        disabled={reducedMotion}
        onPress={() => setPaused((value) => !value)}
        style={({ pressed }) => [styles.pauseButton, reducedMotion && styles.pauseButtonDisabled, pressed && !reducedMotion && styles.pauseButtonPressed]}
      ><Text style={styles.pauseText}>{paused ? "▶" : "⏸"}</Text></Pressable>}
    />
    </Reveal>
    <View style={[styles.agentsBody, isWide && styles.agentsBodyWide]}>
      <View style={[styles.agentsMain, isWide && styles.agentsMainWide]}>
        {focusAgent ? <View nativeID="stage-lock" style={styles.stageLockBar}>
          <View style={[styles.stageLockDot, { backgroundColor: theme.accentPrimary }]} />
          <Text style={styles.stageLockText} numberOfLines={1}>STAGE LOCKED · {String(currentStage + 1).padStart(2, "0")} {activePipeline.label.toUpperCase()}</Text>
          <Text style={styles.stageLockAgent} numberOfLines={1}>{focusAgent.name}</Text>
        </View> : null}
        <Reveal reducedMotion={reducedMotion} index={1}>
        <View
          nativeID="agent-pipeline"
          style={styles.pipelineRowCompact}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="智能体协同流水线"
          accessibilityValue={{ min: 1, max: PIPELINE.length, now: currentStage + 1, text: `${lockedStage === null ? "当前阶段" : "已锁定阶段"} ${currentStage + 1}/${PIPELINE.length} ${activePipeline.label}` }}
        >
          {PIPELINE.map((stage, index) => {
            const active = index === currentStage;
            const done = index < currentStage;
            return <Fragment key={stage.key}>
              <View nativeID={`pipeline-${stage.key}`} accessibilityState={{ selected: active }} style={styles.pipelineStepWrap}>
                <View style={[styles.pipelineNodeWrap, isCompact && styles.pipelineNodeWrapCompact]}>
                  {active ? <View pointerEvents="none" style={[styles.pulseRing, motion.pulseRing, { borderColor: theme.accentRing }]} /> : null}
                  <View style={[
                    styles.pipelineNode,
                    done && { backgroundColor: theme.success, borderColor: theme.success },
                    active && { backgroundColor: theme.accentPrimary, borderColor: theme.accentPrimary },
                    active && webOnly({
                      backgroundImage: `linear-gradient(135deg, ${theme.accentGradientFrom} 0%, ${theme.accentPrimary} 100%)`,
                      boxShadow: `0 0 26px ${theme.accentShadow}`,
                    }),
                    isCompact && styles.pipelineNodeCompact,
                  ]}>
                    <Text style={[styles.pipelineGlyph, (done || active) && { color: theme.onAccent }]}>{done ? "✓" : stage.glyph}</Text>
                  </View>
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.pipelineLabel,
                    isCompact && styles.pipelineLabelCompact,
                    done && { color: theme.textPrimary },
                    active && { color: theme.accentPrimary, fontWeight: "800" },
                  ]}
                >{stage.label}</Text>
              </View>
              {index < PIPELINE.length - 1 ? <View
                style={[
                  styles.pipelineConnector,
                  index < currentStage && { backgroundColor: theme.success },
                  DATA_FLOW_BGS[index % DATA_FLOW_BGS.length],
                  webOnly({
                    backgroundImage: `linear-gradient(90deg, transparent 20%, ${theme.accentPrimary} 50%, transparent 80%)`,
                    backgroundSize: "46% 100%",
                    backgroundRepeat: "no-repeat",
                  }),
                ]}
              /> : null}
            </Fragment>;
          })}
        </View>
        </Reveal>

        <View ref={terminalRef} {...(revealData(terminalVisible, "left") as ViewProps)} style={[styles.terminalRevealWrap, revealDelay(2, reducedMotion)]}>
        {terminalVisible ? <AgentTerminal
          personaKey={personaKey}
          activeStage={currentStage}
          reducedMotion={reducedMotion}
          focus={focusAgent}
        /> : null}
        </View>
      </View>

      <View style={styles.agentsSide}>
        <View style={styles.agentMatrixHeader}>
          <Text style={styles.matrixLabel}>AGENT MATRIX · 12 CARDS</Text>
          <Text style={styles.matrixHint} numberOfLines={1}>{focusAgent ? "再次点击已选卡片返回实时流" : "点击卡片查看深度遥测"}</Text>
        </View>
        <View style={styles.agentGrid}>
          {AGENT_MATRIX.map((agent, index) => {
            const active = focusAgent?.key === agent.key;
            const dotColor = agentStatusColor(theme, agent.status);
            return <Reveal key={agent.key} index={index} direction="right" reducedMotion={reducedMotion} style={fourColumns ? styles.agentCardWide : styles.agentCardCompact}>
            <Pressable
              key={agent.key}
              nativeID={`agent-card-${agent.key}`}
              accessibilityRole="button"
              accessibilityLabel={`${agent.name} ${agent.cn}，${agent.description}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                if (active) {
                  setFocusAgent(null);
                  return;
                }
                setFocusAgent(agent);
                setActiveStage(agent.stage);
              }}
              style={({ pressed }) => [
                styles.agentCard,
                styles.agentCardFull,
                active && styles.agentCardActive,
                active && { boxShadow: `0 0 22px ${theme.accentShadow}` },
                pressed && styles.agentCardPressed,
              ]}
            >
              <View style={styles.agentCardTop}>
                <PulsingDot color={dotColor} size={5} />
                <Text style={[styles.agentStatusLabel, { color: dotColor }]} numberOfLines={1}>{agent.status}</Text>
                <Text style={styles.agentStageTag} numberOfLines={1}>S{String(agent.stage + 1).padStart(2, "0")}</Text>
                <Text style={styles.agentLatency} numberOfLines={1}>{agent.latency}</Text>
              </View>
              <Text style={styles.agentName} numberOfLines={1}>{agent.cn}</Text>
              <View style={styles.agentCodeRow}>
                <Text style={styles.agentCode} numberOfLines={1} ellipsizeMode="tail">@{agent.name}</Text>
              </View>
              <Text style={styles.agentDesc} numberOfLines={2}>{agent.description}</Text>
            </Pressable>
            </Reveal>;
          })}
        </View>
      </View>
    </View>
  </View>;
}

function GraphPanel({ persona }: { persona: DemoPersona | null }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const width = useHydratedWidth();
  const isWide = width >= 960;
  const personaKey: DemoPersona = persona ?? "foundation";
  const [chapterKey, setChapterKey] = useState<string>(GRAPH_CHAPTERS[0].key);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const chapter = GRAPH_CHAPTERS.find((item) => item.key === chapterKey) ?? GRAPH_CHAPTERS[0];
  const nodes = chapter.labels.map((label, index) => {
    const mastery = graphMastery(chapter.base[personaKey], chapter.offsets[index] ?? 0);
    const prereq = index === 0 ? "课程导论" : (chapter.labels[index - 1] ?? "课程导论");
    return {
      id: `${chapter.prefix}-${String(index + 1).padStart(2, "0")}`,
      label,
      mastery,
      color: masteryColor(mastery, theme),
      prereq,
      labs: 3 + ((index + chapter.prefix.length) % 3),
      evidence: [
        `最近 3 次作答正确率 ${Math.min(96, mastery + 8)}%`,
        mastery < 55 ? "错因：前置概念不牢固，需回补基础" : "错因：复杂查询执行时序混淆",
        `建议先复习 ${prereq}`,
      ],
    };
  });
  const selected = nodes[selectedIndex] ?? nodes[0]!;
  const exercises = CHAPTER_EXERCISES[chapter.key] ?? [];

  return <View style={styles.panelFill}>
    <InspectorHeader
      kicker="KNOWLEDGE GRAPH · 45 NODES TOPOLOGY"
      meta="45 NODES"
      color={theme.success}
      right={<View style={styles.inspectorBadge}><Text style={[styles.inspectorBadgeText, { color: theme.success }]}>BKT VIEW</Text></View>}
    />
    <View style={styles.chapterRow}>
      {GRAPH_CHAPTERS.map((item) => {
        const active = item.key === chapter.key;
        return <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={`切换到${item.label}章节`}
          accessibilityState={{ selected: active }}
          onPress={() => { setChapterKey(item.key); setSelectedIndex(0); }}
          style={({ pressed }) => [
            styles.chapterChip,
            active && [styles.chapterChipActive, { borderColor: `${theme.success}99`, backgroundColor: theme.successSoft }],
            pressed && styles.chapterChipPressed,
          ]}
        ><Text style={[styles.chapterChipText, active && { color: theme.success, fontWeight: "800" }]}>{item.label}</Text></Pressable>;
      })}
    </View>

    <View style={[styles.graphBody, isWide && styles.graphBodyWide]}>
      <View style={styles.graphCanvas}>
        <View style={styles.graphCanvasHeader}>
          <Text style={styles.graphCanvasTitle}>{chapter.label} · 核心节点拓扑</Text>
          <Text style={styles.graphCanvasMeta}>点击节点查看诊断详情</Text>
        </View>
        <View style={styles.graphGrid}>
          {nodes.map((node, index) => {
            const active = index === selectedIndex;
            return <Pressable
              key={node.id}
              accessibilityRole="button"
              accessibilityLabel={`${node.label}，掌握度${node.mastery}%`}
              accessibilityState={{ selected: active }}
              onPress={() => setSelectedIndex(index)}
              style={({ pressed }) => [
                styles.graphNode,
                !isWide && styles.graphNodeCompact,
                active && styles.graphNodeActive,
                active && { borderColor: node.color, boxShadow: `0 0 22px ${node.color}33` },
                pressed && styles.graphNodePressed,
              ]}
            >
              <View style={styles.graphNodeTop}>
                <Text style={styles.graphNodeId}>{node.id}</Text>
                <View style={[styles.graphStatusDot, { backgroundColor: node.color }]} />
                <Text style={[styles.graphStatusText, { color: node.color }]}>{node.mastery >= 80 ? "已掌握" : node.mastery >= 55 ? "薄弱断点" : "待解锁"}</Text>
              </View>
              <Text style={styles.graphLabel} numberOfLines={1}>{node.label}</Text>
              <Text style={[styles.graphMastery, { color: node.color }]}>{node.mastery}%</Text>
              <View style={styles.graphProgressTrack}><View style={[styles.graphProgressFill, { width: `${node.mastery}%`, backgroundColor: node.color }]} /></View>
              <Text style={styles.graphDependency} numberOfLines={1}>↳ 前置：{node.prereq}</Text>
            </Pressable>;
          })}
        </View>
      </View>

      <View style={styles.graphDashboard}>
        <Text style={styles.dashboardKicker}>NODE DIAGNOSTIC DASHBOARD</Text>
        <View style={styles.dashboardTitleRow}>
          <Text style={styles.dashboardTitle}>{selected.label}</Text>
          <Text style={styles.dashboardId}>{selected.id}</Text>
        </View>
        <View style={styles.dashboardMasteryRow}>
          <Text style={[styles.dashboardMastery, { color: selected.color }]}>{selected.mastery}%</Text>
          <View style={styles.dashboardMasteryMeta}>
            <Text style={styles.dashboardLabel}>BKT MASTERY</Text>
            <Text style={[styles.dashboardStatus, { color: selected.color }]}>{selected.mastery >= 80 ? "已掌握" : selected.mastery >= 55 ? "薄弱断点" : "待解锁"}</Text>
          </View>
        </View>
        <View style={styles.graphProgressTrackLarge}><View style={[styles.graphProgressFill, { width: `${selected.mastery}%`, backgroundColor: selected.color }]} /></View>
        <View style={styles.dashboardSection}>
          <Text style={styles.dashboardSectionTitle}>历史薄弱证据</Text>
          {selected.evidence.map((item) => <Text key={item} style={styles.dashboardEvidence}>▸ {item}</Text>)}
        </View>
        <View style={styles.dashboardSection}>
          <Text style={styles.dashboardSectionTitle}>前置依赖链</Text>
          <Text style={styles.dashboardChain}>课程导论 → {selected.prereq} → <Text style={{ color: selected.color }}>{selected.label}</Text></Text>
        </View>
        <View style={styles.dashboardSection}>
          <Text style={styles.dashboardSectionTitle}>推荐关联实验 · {selected.labs} 道</Text>
          {exercises.slice(0, 3).map((exercise, index) => <View key={exercise} style={styles.exerciseRow}>
            <Text style={styles.exerciseIndex}>0{index + 1}</Text>
            <Text style={styles.exerciseTitle} numberOfLines={1}>{exercise}</Text>
            <Text style={styles.exerciseArrow}>→</Text>
          </View>)}
        </View>
      </View>
    </View>
  </View>;
}

function SqlIde({ mode }: { mode: "query" | "tuning" }) {
  const styles = useLoginStyles();
  const width = useHydratedWidth();
  const isWide = width >= 960;
  const queryLines = [
    <Text key="q1"><Text style={styles.sqlKeyword}>SELECT</Text> s.name, <Text style={styles.sqlFunc}>AVG</Text>(sc.score) <Text style={styles.sqlKeyword}>AS</Text> avg_score</Text>,
    <Text key="q2"><Text style={styles.sqlKeyword}>FROM</Text> student s</Text>,
    <Text key="q3"><Text style={styles.sqlKeyword}>JOIN</Text> enrollment sc <Text style={styles.sqlKeyword}>ON</Text> sc.student_id = s.id</Text>,
    <Text key="q4"><Text style={styles.sqlKeyword}>GROUP BY</Text> s.name <Text style={styles.sqlKeyword}>ORDER BY</Text> avg_score <Text style={styles.sqlKeyword}>DESC</Text></Text>,
    <Text key="q5"><Text style={styles.sqlKeyword}>LIMIT</Text> 2;</Text>,
  ];
  const tuningLines = [
    <Text key="t1"><Text style={styles.sqlKeyword}>CREATE INDEX</Text> idx_enrollment_score</Text>,
    <Text key="t2"><Text style={styles.sqlKeyword}>ON</Text> enrollment (score);</Text>,
    <Text key="t3"><Text style={styles.sqlKeyword}>EXPLAIN</Text> (<Text style={styles.sqlFunc}>ANALYZE</Text>, <Text style={styles.sqlFunc}>BUFFERS</Text>)</Text>,
    <Text key="t4"><Text style={styles.sqlKeyword}>SELECT</Text> * <Text style={styles.sqlKeyword}>FROM</Text> enrollment</Text>,
    <Text key="t5"><Text style={styles.sqlKeyword}>WHERE</Text> score &gt;= 85;</Text>,
  ];
  const lines = mode === "query" ? queryLines : tuningLines;

  return <View style={[styles.ideBody, isWide && styles.ideBodyWide]}>
    <View style={styles.ideLeft}>
      <View style={styles.sqlWindow}>
        <MacWindowHeader
          title={mode === "query" ? "terminal — sql_editor.zsh — 120×32" : "terminal — tuning.zsh — 120×32"}
          right={<Text style={styles.sqlWindowBadge}>READ ONLY</Text>}
        />
        <View style={styles.sqlWindowBody}>
          {lines.map((line, index) => <View key={index} style={styles.sqlLineRow}>
            <Text style={styles.lineNo}>{index + 1}</Text>
            <Text style={styles.sqlCodeLine}>{line}</Text>
          </View>)}
        </View>
      </View>
      <View style={styles.explainCard}>
        <View style={styles.explainHeader}><Text style={styles.explainTitle}>EXPLAIN TREE</Text><Text style={styles.explainCost}>cost 4.2ms</Text></View>
        <Text style={styles.explainLine}>HashAggregate <Text style={styles.explainDim}>(cost=4.21..4.23)</Text></Text>
        <Text style={[styles.explainLine, styles.explainIndent1]}>→ Hash Join <Text style={styles.explainDim}>(student × enrollment)</Text></Text>
        <Text style={[styles.explainLine, styles.explainIndent2]}>→ Seq Scan student <Text style={styles.explainDim}>(120 rows)</Text></Text>
        <Text style={[styles.explainLine, styles.explainIndent2]}>→ Index Scan enrollment_score_idx <Text style={styles.explainGood}>(86 rows)</Text></Text>
      </View>
    </View>
    <View style={styles.ideRight}>
      <View style={styles.resultHeader}><Text style={styles.resultTitle}>QUERY RESULTS</Text><Text style={styles.resultMeta}>2 rows · 4.2ms</Text></View>
      <View style={styles.resultTableLarge}>
        <View style={[styles.resultRowLarge, styles.resultHeaderRow]}><Text style={styles.resultCellLarge}>name</Text><Text style={styles.resultCellLarge}>avg_score</Text></View>
        <View style={styles.resultRowLarge}><Text style={styles.resultCellLarge}>林晓</Text><Text style={styles.resultCellLarge}>92.4</Text></View>
        <View style={styles.resultRowLarge}><Text style={styles.resultCellLarge}>陈默</Text><Text style={styles.resultCellLarge}>88.1</Text></View>
      </View>
      <View style={styles.perfCard}>
        <Text style={styles.perfKicker}>PERFORMANCE GAIN</Text>
        <View style={styles.perfRow}><Text style={styles.perfBad}>42.8ms</Text><Text style={styles.perfArrow}>→</Text><Text style={styles.perfGood}>4.2ms</Text></View>
        <Text style={styles.perfSpeed}>10.2× faster</Text>
        <Text style={styles.perfNote}>Rows scanned 12,480 → 86 · Index Scan replaces Seq Scan</Text>
      </View>
      <View style={styles.safetyNote}><Text style={styles.safetyGlyph}>⛨</Text><Text style={styles.safetyText}>sql.js WASM 隔离沙箱 · 单条只读语句 · 2s 超时 · 最多 200 行</Text></View>
    </View>
  </View>;
}

function ResourcesPanel({ persona }: { persona: DemoPersona | null }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const personaKey: PersonaKey = persona ?? "foundation";
  const [resourceKey, setResourceKey] = useState<ResourceKey>("sql");
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const brief = PERSONA_BRIEFS[personaKey];
  const quiz = QUIZ_BY_PERSONA[personaKey];

  return <View style={styles.panelFill}>
    <InspectorHeader
      kicker="MULTIMODAL RESOURCES & SQL SANDBOX"
      meta="6 MODES"
      color={theme.warning}
      right={<View style={styles.inspectorBadge}><Text style={[styles.inspectorBadgeText, { color: theme.warning }]}>LIVE PREVIEW</Text></View>}
    />
    <View style={styles.resourceChips}>
      {RESOURCE_TYPES.map((item) => {
        const active = item.key === resourceKey;
        const color = toneColor(theme, item.tone);
        const soft = toneSoft(theme, item.tone);
        return <Pressable
          key={item.key}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ selected: active }}
          onPress={() => { setResourceKey(item.key); setQuizChoice(null); setFlipped(false); }}
          style={({ pressed }) => [
            styles.resourceChip,
            active && { borderColor: `${color}88`, backgroundColor: soft },
            pressed && styles.resourceChipPressed,
          ]}
        ><Text style={[styles.resourceChipText, active && { color }]}>{item.icon} {item.label}</Text></Pressable>;
      })}
    </View>

    <View style={styles.resourcePreviewLarge}>
      {resourceKey === "sql" ? <SqlIde mode="query" /> : null}
      {resourceKey === "lab" ? <SqlIde mode="tuning" /> : null}

      {resourceKey === "doc" ? <View style={styles.largePreview}>
        <View style={styles.previewHeadRow}><Text style={styles.previewKicker}>{brief.kicker}</Text><Text style={styles.previewPersona}>{personaKey.toUpperCase()}</Text></View>
        <Text style={styles.largePreviewTitle}>{brief.title}</Text>
        {brief.points.map((point) => <View key={point} style={styles.largeBulletRow}><Text style={styles.largeBulletGlyph}>▸</Text><Text style={styles.largeBulletText}>{point}</Text></View>)}
      </View> : null}

      {resourceKey === "graph" ? <View style={styles.largePreview}>
        <Text style={styles.previewKicker}>RELATION GRAPH · CONCEPT TOPOLOGY</Text>
        <View style={styles.largeGraphRow}>{["关系", "元组", "键", "范式", "SQL", "实验"].map((label, index) => <View key={label} style={styles.largeGraphStep}>
          <View style={styles.largeGraphNode}><Text style={styles.largeGraphText}>{label}</Text></View>
          {index < 5 ? <Text style={styles.largeGraphArrow}>→</Text> : null}
        </View>)}</View>
        <Text style={styles.largeBulletText}>概念节点通过前置依赖与实验资源形成可追踪路径；点击路径节点可查看诊断证据与关联实验。</Text>
      </View> : null}

      {resourceKey === "quiz" ? <View style={styles.largePreview}>
        <Text style={styles.previewKicker}>TARGETED DIAGNOSTIC · SINGLE CHOICE</Text>
        <Text style={styles.largeQuizQuestion}>{quiz.question}</Text>
        {quiz.options.map((option, index) => {
          const chosen = quizChoice === index;
          const correct = index === quiz.correct;
          return <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: chosen }}
            onPress={() => setQuizChoice(index)}
            style={[styles.largeQuizOption, chosen && (correct ? styles.largeQuizCorrect : styles.largeQuizWrong)]}
          >
            <Text style={styles.largeQuizMark}>{chosen ? (correct ? "✓" : "✕") : String.fromCharCode(65 + index)}</Text>
            <Text style={styles.largeQuizText}>{option}</Text>
          </Pressable>;
        })}
        {quizChoice !== null ? <Text style={styles.largeQuizExplanation}>{quizChoice === quiz.correct ? "✓ 正确。该作答会写回 BKT 模型并更新薄弱维置信度。" : "✕ 再想想。系统会记录该错因并推荐对应知识卡。"}</Text> : null}
      </View> : null}

      {resourceKey === "card" ? <Pressable accessibilityRole="button" accessibilityLabel="翻转速记闪卡" onPress={() => setFlipped((value) => !value)} style={styles.largePreview}>
        <View style={styles.previewHeadRow}><Text style={styles.previewKicker}>{flipped ? "ANSWER SIDE" : "PROMPT SIDE"} · TAP TO FLIP</Text><Text style={styles.previewPersona}>{personaKey.toUpperCase()}</Text></View>
        <Text style={styles.largePreviewTitle}>{flipped ? brief.points[0] : brief.title}</Text>
        <Text style={styles.largeBulletText}>{flipped ? brief.points.slice(1).join(" · ") : "点击卡片翻转，查看针对当前角色的记忆锚点。"}</Text>
        <Text style={styles.largeFlipHint}>{flipped ? "↺ 再次点击返回正面" : "↻ 点击翻转"}</Text>
      </Pressable> : null}
    </View>
  </View>;
}

function InspectorPanel({ activeTab, persona, reducedMotion, spotlightAgentKey, spotlightNonce }: {
  activeTab: InspectorTab;
  persona: DemoPersona | null;
  reducedMotion: boolean;
  spotlightAgentKey: AgentKey | null;
  spotlightNonce: number;
}) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const width = useHydratedWidth();
  const accent = activeTab === "agents" ? theme.accentPrimary : activeTab === "graph" ? theme.success : theme.warning;
  return <View nativeID="inspector-card" style={[styles.inspectorCard, width < 560 && styles.inspectorCardCompact]}>
    <View pointerEvents="none" style={[styles.inspectorTopLine, { backgroundColor: accent, boxShadow: `0 0 12px ${accent}` }]} />
    <View key={activeTab} style={[styles.panelFill, motion.panelIn]}>
      {activeTab === "agents"
        ? <AgentsPanel
            persona={persona}
            reducedMotion={reducedMotion}
            spotlightAgentKey={spotlightAgentKey}
            spotlightNonce={spotlightNonce}
          />
        : activeTab === "graph"
          ? <GraphPanel persona={persona} />
          : <ResourcesPanel persona={persona} />}
    </View>
  </View>;
}

function HelpModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useLoginStyles();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.helpOverlay} onPress={onClose}>
      <Pressable accessibilityViewIsModal onAccessibilityEscape={onClose} style={[styles.helpModalCard, webOnly({
        backdropFilter: "blur(22px)",
      })]} onPress={(event) => event.stopPropagation()}>
        <View style={styles.helpHeader}>
          <View>
            <Text style={styles.helpEyebrow}>SYSTEM HELP // QUICKSTART</Text>
            <Text style={styles.helpTitle}>快速开始</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭帮助" onPress={onClose} style={styles.helpClose}>
            <Text style={styles.helpCloseText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.helpItem}><Text style={styles.helpItemGlyph}>01</Text><Text style={styles.helpItemText}>选择任一角色卡片，系统会自动填入对应的演示账号与密码 <Text style={styles.helpMono}>demo1234</Text>。</Text></View>
        <View style={styles.helpItem}><Text style={styles.helpItemGlyph}>02</Text><Text style={styles.helpItemText}>登录后先完成一次自适应诊断，系统会据此生成个性化学习路径。</Text></View>
        <View style={styles.helpItem}><Text style={styles.helpItemGlyph}>03</Text><Text style={styles.helpItemText}>仅保存匿名学习记录，不保存真实姓名、学号或模型隐藏思维过程。</Text></View>
        <Pressable accessibilityRole="button" onPress={() => { onClose(); router.push("/help" as never); }} style={styles.helpLinkWrap}>
          <Text style={styles.helpLink}>打开完整帮助 →</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  </Modal>;
}

/** Login-card extension: a compact, animated snapshot of the selected role's starting state. */
function RoleTelemetry({ persona, compact = false }: { persona: DemoPersona; compact?: boolean }) {
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const data = ROLE_TELEMETRY[persona];
  const meta = ROLE_META[persona];
  const masteryTone = data.mastery >= 80 ? theme.success : data.mastery >= 55 ? theme.warning : theme.accentPrimary;
  return <View
    nativeID="role-telemetry"
    accessible
    accessibilityLabel={`角色初始学情快照，${meta.title}，掌握度 ${data.mastery}%，待补断点 ${data.pending} 个，首个推荐突破节点 ${data.node}`}
    style={[styles.telemetryStrip, compact && styles.telemetryStripCompact]}
  >
    <View style={[styles.telemetryStripBlock, compact && styles.telemetryStripBlockCompact]}>
      <Text style={styles.telemetryStripKicker}>ROLE PROFILE TELEMETRY</Text>
      <View style={styles.telemetryStripValueRow}>
        <Text style={styles.telemetryStripLabel}>初始掌握度</Text>
        <Text style={[styles.telemetryStripValue, { color: masteryTone }]}>{data.mastery}%</Text>
      </View>
      <GrowthBar value={data.mastery} color={masteryTone} height={6} label={`初始掌握度 ${data.mastery}%`} />
    </View>

    <View style={[styles.telemetryStripDivider, compact && styles.telemetryStripDividerCompact]} />

    <View style={[styles.telemetryStripBlockSmall, compact && styles.telemetryStripBlockSmallCompact]}>
      <Text style={styles.telemetryStripKicker}>待补知识断点</Text>
      <View style={styles.telemetryStripValueRow}>
        <Text style={[styles.telemetryStripValue, { color: theme.warning }]}>{data.pending} 个</Text>
        <View style={styles.telemetryStripTag}><Text style={styles.telemetryStripTagText}>HIGH PRIORITY</Text></View>
      </View>
    </View>

    <View style={[styles.telemetryStripDivider, compact && styles.telemetryStripDividerCompact]} />

    <View style={[styles.telemetryStripBlockWide, compact && styles.telemetryStripBlockWideCompact]}>
      <View style={styles.telemetryStripNodeRow}>
        <Text style={styles.telemetryStripKicker}>首个推荐突破节点</Text>
        <Text style={styles.telemetryStripNode} numberOfLines={1}>{data.node}</Text>
      </View>
      <View style={styles.telemetryMiniMatrix}>
        {data.dims.map((value, index) => {
          const label = DIMENSION_LABELS[index] ?? `DIM ${index + 1}`;
          const color = value >= 75 ? theme.success : value >= 60 ? theme.accentPrimary : theme.warning;
          return <View
            key={label}
            accessibilityRole="progressbar"
            accessibilityLabel={`${label} ${value} 分`}
            accessibilityValue={{ min: 0, max: 100, now: value }}
            aria-label={`${label} ${value} 分`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={value}
            style={styles.telemetryMiniTrack}
          >
            <View style={[styles.telemetryMiniFill, { height: pct(value), backgroundColor: color }]} />
          </View>;
        })}
      </View>
    </View>
  </View>;
}

export default function LoginScreen() {
  const { currentUser, demoUsers, login, loading, ready } = useApp();
  const { theme } = useTheme();
  const styles = useLoginStyles();
  const { demo } = useLocalSearchParams<{ demo?: string }>();
  const demoUser = demoUsers.find((user) => user.username === demo);
  const width = useHydratedWidth();
  const isWide = width >= 960;
  const isCompact = width < 700;
  const isNarrow = width < 380;
  const wideAuthCard = width >= 1180;
  const passwordPlaceholder = isNarrow ? "密码 · demo1234" : "请输入密码（默认 demo1234）";
  const showPills = width >= 1040;
  const showDetail = width >= 1280;
  const showVersion = width >= 1180;
  const showSystemStatus = width >= 900;
  const switcherCompact = width < 760;
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<ScrollView>(null);
  const deepDiveY = useRef(0);
  const [activeTab, setActiveTab] = useState<InspectorTab>("agents");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [selectedPersona, setSelectedPersona] = useState<DemoPersona | null>(null);
  const [focusedField, setFocusedField] = useState<"username" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [ctaHovered, setCtaHovered] = useState(false);
  const [authStage, setAuthStage] = useState(-1);
  const [spotlight, setSpotlight] = useState<{ key: AgentKey | null; nonce: number }>({ key: null, nonce: 0 });
  const [usernameFlash, setUsernameFlash] = useState(false);
  const submitting = useRef(false);
  const spotlightSequence = useRef(0);
  const authTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (authTimer.current) clearInterval(authTimer.current);
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  useEffect(() => { if (!ready || currentUser || demo) return; void AsyncStorage.getItem("zhijing.onboarding.v1").then((seen) => { if (!seen) router.replace("/onboarding" as never); }); }, [ready, currentUser, demo]);
  useEffect(() => { if (ready && currentUser) router.replace("/(tabs)"); }, [ready, currentUser]);
  useEffect(() => {
    if (!demoUser) return;
    const timer = setTimeout(() => {
      setSelectedPersona(demoUser.persona);
      setUsername(demoUser.username);
      setPassword("demo1234");
      setError("");
    }, 0);
    return () => clearTimeout(timer);
  }, [demoUser]);

  const submit = async (presetUsername = username.trim(), presetPassword = password) => {
    if (!ready || loading || submitting.current) return;
    submitting.current = true;
    setError("");
    setAuthStage(0);
    const timer = setInterval(() => {
      setAuthStage((current) => (current < 0 ? current : Math.min(current + 1, AUTH_STAGES.length - 1)));
    }, 760);
    authTimer.current = timer;
    try {
      // Keep the staged handshake visible for at least ~900ms, even when the API answers fast.
      const outcome: { error: unknown } = { error: null };
      await Promise.all([
        login(presetUsername.trim(), presetPassword).catch((reason) => { outcome.error = reason; }),
        new Promise<void>((resolve) => setTimeout(resolve, 900)),
      ]);
      if (outcome.error) {
        const reason = outcome.error;
        const message = reason instanceof Error ? reason.message : "登录失败，请检查账号密码";
        setError(
          message === "The operation was aborted" || message.includes("AbortError")
            ? "登录请求超时，请检查网络后重试"
            : message === "Failed to fetch" || message.includes("Network request failed")
              ? "无法连接学习服务，请确认 API 已在 http://localhost:8787 启动"
              : message,
        );
      }
    } finally {
      clearInterval(timer);
      if (authTimer.current === timer) authTimer.current = null;
      setAuthStage(-1);
      submitting.current = false;
    }
  };

  const selectRole = (persona: DemoPersona, demoUsername: string) => {
    setSelectedPersona(persona);
    setUsername(demoUsername);
    setPassword("demo1234");
    setError("");
    flashUsername();
  };

  const flashUsername = () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setUsernameFlash(false);
    requestAnimationFrame(() => setUsernameFlash(true));
    flashTimer.current = setTimeout(() => setUsernameFlash(false), 1100);
  };

  const onChangeUsername = (value: string) => {
    setUsername(value);
    const matched = demoUsers.find((user) => user.username === value.trim());
    setSelectedPersona(matched ? matched.persona : null);
  };

  const loginDisabled = loading || !ready;
  const ctaDisabled = loginDisabled || authStage >= 0;
  const scrollToDeepDive = () => {
    scrollRef.current?.scrollTo({ y: Math.max(0, deepDiveY.current - 82), animated: true });
  };
  const selectTab = (tab: InspectorTab) => {
    setActiveTab(tab);
    requestAnimationFrame(scrollToDeepDive);
  };
  const handleQuickAction = (action: QuickAction) => {
    setActiveTab(action === "bkt" ? "graph" : "agents");
    if (action === "sql") {
      spotlightSequence.current += 1;
      setSpotlight({ key: "diagnostic", nonce: spotlightSequence.current });
    } else {
      setSpotlight((current) => ({ key: null, nonce: current.nonce }));
    }
    requestAnimationFrame(scrollToDeepDive);
  };

  return <>
    <Head><title>登录 · 知径 DB</title></Head>
    <SafeAreaView style={styles.safe}>
      <AmbientBackdrop variant="hero" reducedMotion={reducedMotion} />

      <TopNav
        isWide={isWide}
        isNarrow={isNarrow}
        showVersion={showVersion}
        showPills={showPills}
        showDetail={showDetail}
        showSystemStatus={showSystemStatus}
        switcherCompact={switcherCompact}
        activeTab={activeTab}
        onSelectTab={selectTab}
        onHelp={() => setShowHelp(true)}
      />

      <ScrollView
        ref={scrollRef}
        nativeID="login-stage"
        style={styles.stage}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.pageContainer, isCompact && styles.pageContainerCompact, isNarrow && styles.pageContainerNarrow]}>
          <View style={[styles.heroRow, isWide && styles.heroRowWide]}>
            <View nativeID="brand-column" style={[styles.brandColumn, isWide && styles.brandColumnWide]}>
            <View style={[styles.brandBadge, motion.entrance0]}>
              <PulsingDot color={theme.success} />
              <Text style={styles.brandBadgeText}>MULTI-AGENT LEARNING ENGINE</Text>
            </View>

            <View style={[styles.heroCopy, motion.entrance1]}>
              <View style={styles.heroTitleRow}>
                <Text style={[styles.heroTitle, isWide && styles.heroTitleWide]}>
                  知径 <Text style={[styles.heroTitleAccent, webOnly({
                    backgroundImage: theme.accentGradient,
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    color: "transparent",
                  })]}>DB</Text>
                </Text>
                <View style={[styles.heroBadge, motion.badgeFloat]}>
                  <Text style={styles.heroBadgeText}>v2.4</Text>
                  <View style={styles.heroBadgeDot} />
                </View>
              </View>
              <Text style={[styles.heroSubtitle, isWide && styles.heroSubtitleWide]}>
                以诊断证据驱动的多智能体学习系统。让每一个知识断点，都能连接到可执行的学习路径。
              </Text>
            </View>

            <View style={styles.statsRow}>
              {STATS.map((stat, index) => <BentoStat
                key={stat.label}
                stat={stat}
                index={index}
                active={activeTab === stat.tab}
                onPress={() => selectTab(stat.tab)}
              />)}
            </View>


            <OverviewPod tab={activeTab} onExpand={scrollToDeepDive} onQuickAction={handleQuickAction} />
          </View>


          <View style={[styles.authColumn, isWide && styles.authColumnWide, wideAuthCard && styles.authColumnWideCard]}>
            <View nativeID="auth-card" style={[styles.authCard, isWide && styles.authCardWide, wideAuthCard && styles.authCardWideCard, isNarrow && styles.authCardNarrow, motion.entrance2, webOnly({
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            })]}>
              <View pointerEvents="none" style={[styles.cardTopLine, webOnly({
                backgroundImage: theme.accentGradient,
              })]} />

              <View style={styles.sessionRow}>
                <View style={styles.sessionLeft}>
                  <View style={styles.sessionDot} />
                  <Text style={styles.sessionSecure}>TLS 1.3</Text>
                </View>
                <View style={styles.envPill}>
                  <Text style={styles.envPillText}>✨ 演示环境已就绪</Text>
                </View>
              </View>

              <View style={styles.cardHeader}>
                <View style={styles.cardHeaderCopy}>
                  <Text style={styles.cardEyebrow}>WELCOME BACK</Text>
                  <Text style={styles.cardTitle}>登录学习空间</Text>
                  <Text style={styles.cardSubtitle}>选择学习身份，账号与学情画像将自动装配</Text>
                </View>
                <View style={styles.lockBadge}><Text style={styles.lockGlyph}>⌁</Text></View>
              </View>

              {!isApiConfigured() ? <View accessibilityRole="alert" style={styles.notice}>
                <Text style={styles.noticeTitle}>未检测到 API 地址</Text>
                <Text style={styles.noticeText}>请在 apps/client/.env 中设置 EXPO_PUBLIC_API_URL，或运行 pnpm env:local 后再启动。</Text>
              </View> : null}

              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>01</Text></View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>选择学习身份</Text>
                  <Text style={styles.stepHint}>一键自动装配账号与学情画像</Text>
                </View>
              </View>

              <View accessibilityRole="radiogroup" accessibilityLabel="选择演示角色" style={styles.roleList}>
                {demoUsers.map((user) => {
                  const meta = ROLE_META[user.persona];
                  const active = selectedPersona === user.persona;
                  const color = toneColor(theme, meta.tone);
                  const soft = toneSoft(theme, meta.tone);
                  return <Pressable
                    key={user.id}
                    accessibilityRole="radio"
                    accessibilityLabel={`${meta.title}，${meta.description}，${meta.mastery}`}
                    accessibilityState={{ checked: active, disabled: loginDisabled }}
                    disabled={loginDisabled}
                    onPress={() => selectRole(user.persona, user.username)}
                    style={(state: PressState) => [
                      styles.roleCard,
                      isNarrow && styles.roleCardNarrow,
                      state.hovered && !loginDisabled && [styles.roleCardHover, { borderColor: `${color}66` }],
                      active && [styles.roleCardActive, { borderColor: color, backgroundColor: soft, boxShadow: `0 0 0 1px ${color}22, 0 8px 26px ${color}18` }],
                      state.pressed && !loginDisabled && styles.roleCardPressed,
                      loginDisabled && styles.disabled,
                      webOnly({
                        transitionProperty: "transform, border-color, background-color, box-shadow",
                        transitionDuration: "180ms",
                      }),
                    ]}
                  >
                    {active ? <View style={[styles.roleAccent, { backgroundColor: color, boxShadow: `0 0 12px ${color}` }, webOnly({ backgroundImage: theme.accentGradient })]} /> : null}
                    {active ? <View pointerEvents="none" style={[styles.roleShimmer, motion.shimmer, webOnly({
                      backgroundImage: "linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.28) 50%, transparent 80%)",
                    })]} /> : null}
                    <View style={[styles.roleIconBox, isNarrow && styles.roleIconBoxNarrow, { borderColor: `${color}55`, backgroundColor: soft }]}>
                      <Text style={[styles.roleIcon, { color }]}>{meta.icon}</Text>
                    </View>
                    <View style={styles.roleCopy}>
                      <View style={styles.roleTitleRow}>
                        <Text style={styles.roleTitle}>{meta.title}</Text>
                        <Text style={styles.roleCode}>{meta.code}</Text>
                      </View>
                      <Text style={styles.roleDescription} numberOfLines={wideAuthCard ? 1 : 2}>{meta.description}</Text>
                    </View>
                    <View style={[styles.roleRight, isNarrow && styles.roleRightNarrow]}>
                      <View style={[styles.roleMasteryPill, { borderColor: `${color}55`, backgroundColor: soft }]}>
                        <Text style={[styles.roleMasteryPillText, { color: active ? color : theme.textMuted }]} numberOfLines={1}>{meta.mastery}</Text>
                      </View>
                      {active
                        ? <View style={[styles.roleCheck, { backgroundColor: theme.accentPrimary }, webOnly({ backgroundImage: theme.accentGradient })]}><Text style={[styles.roleCheckText, { color: theme.onAccent }]}>✓</Text></View>
                        : <Text style={styles.roleChevron}>›</Text>}
                    </View>
                  </Pressable>;
                })}
              </View>
              {selectedPersona ? <RoleTelemetry persona={selectedPersona} compact={!wideAuthCard} /> : null}

              <View style={styles.stepHeader}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>02</Text></View>
                <View style={styles.stepCopy}>
                  <Text style={styles.stepTitle}>确认账号凭证</Text>
                  <Text style={styles.stepHint}>已从角色自动填入，可直接登录</Text>
                </View>
              </View>

              <Text style={styles.fieldLabel}>用户名</Text>
              <View style={[styles.inputShell, focusedField === "username" && styles.inputShellFocused, usernameFlash && styles.inputShellFlash, webOnly({
                transitionProperty: "border-color, box-shadow, background-color",
                transitionDuration: "160ms",
                ...(focusedField === "username" ? { boxShadow: `0 0 0 3px ${theme.accentRing}` } : null),
              })]}>
                <Text style={styles.inputPrefix}>@</Text>
                <TextInput
                  accessibilityLabel="用户名"
                  autoCapitalize="none"
                  autoComplete="username"
                  autoCorrect={false}
                  returnKeyType="next"
                  value={username}
                  onChangeText={onChangeUsername}
                  onFocus={() => setFocusedField("username")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="foundation / exam / practice"
                  placeholderTextColor={theme.textMuted}
                  selectionColor={theme.accentPrimary}
                  style={styles.input}
                />
                {username ? <Pressable accessibilityRole="button" accessibilityLabel="清空用户名" onPress={() => { onChangeUsername(""); setError(""); }} style={styles.inputAction}>
                  <Text style={styles.inputActionText}>✕</Text>
                </Pressable> : null}
              </View>

              <View style={styles.fieldLabelRow}>
                <Text style={[styles.fieldLabel, styles.fieldLabelInline]}>密码</Text>
                <View style={styles.autoFillPill}>
                  <Text style={styles.autoFillText}>✓ 已自动填入 demo1234</Text>
                </View>
              </View>
              <View style={[styles.inputShell, focusedField === "password" && styles.inputShellFocused, webOnly({
                transitionProperty: "border-color, box-shadow, background-color",
                transitionDuration: "160ms",
                ...(focusedField === "password" ? { boxShadow: `0 0 0 3px ${theme.accentRing}` } : null),
              })]}>
                <Text style={styles.inputPrefix}>◇</Text>
                <TextInput
                  accessibilityLabel="密码"
                  autoCapitalize="none"
                  autoComplete="current-password"
                  secureTextEntry={!showPassword}
                  returnKeyType="go"
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder={passwordPlaceholder}
                  placeholderTextColor={theme.textMuted}
                  selectionColor={theme.accentPrimary}
                  style={[styles.input, isNarrow && styles.inputNarrow]}
                  onSubmitEditing={() => void submit()}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "隐藏密码" : "显示密码"}
                  onPress={() => setShowPassword((value) => !value)}
                  style={[styles.inputAction, styles.inputActionFixed]}
                ><Text style={styles.inputActionText}>{showPassword ? "隐藏" : "显示"}</Text></Pressable>
              </View>

              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

              <Pressable
                nativeID="login-cta"
                accessibilityRole="button"
                accessibilityHint="进入基于诊断证据的个性化学习空间"
                accessibilityState={{ disabled: ctaDisabled, busy: loading || authStage >= 0 }}
                disabled={ctaDisabled}
                onHoverIn={() => setCtaHovered(true)}
                onHoverOut={() => setCtaHovered(false)}
                onPress={() => void submit()}
                style={(state: PressState) => [
                  styles.cta,
                  state.hovered && !ctaDisabled && styles.ctaHover,
                  state.pressed && !ctaDisabled && styles.ctaPressed,
                  ctaDisabled && styles.ctaDisabled,
                  webOnly({
                    backgroundImage: theme.accentGradient,
                    transitionProperty: "transform, box-shadow, filter",
                    transitionDuration: "160ms",
                  }),
                  state.hovered && !ctaDisabled ? webOnly({ filter: "brightness(1.06)" }) : null,
                ]}
              >
                <View pointerEvents="none" style={styles.ctaHighlight} />
                <View pointerEvents="none" style={[styles.ctaShimmer, motion.shimmerCta, webOnly({
                  backgroundImage: "linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.42) 50%, transparent 70%)",
                })]} />
                {authStage >= 0
                  ? <View accessibilityLiveRegion="polite" aria-live="polite" style={styles.ctaBusyRow}>
                    <View style={styles.ctaDots}>
                      {[0, 1, 2].map((dot) => <View key={dot} style={[styles.ctaDot, DOT_BLINKS[dot]]} />)}
                    </View>
                    <Text style={styles.ctaStageText} numberOfLines={1}>{AUTH_STAGES[Math.max(0, Math.min(authStage, AUTH_STAGES.length - 1))]}…</Text>
                  </View>
                  : loading
                    ? <ActivityIndicator color={theme.onAccent} />
                    : <>
                      <Text style={styles.ctaText}>登录并进入学习空间</Text>
                      <View style={[
                        styles.ctaArrow,
                        ctaHovered && !ctaDisabled && styles.ctaArrowHover,
                        webOnly({ transitionProperty: "transform", transitionDuration: "160ms" }),
                      ]}><Text style={styles.ctaArrowText}>→</Text></View>
                    </>}
              </Pressable>
              <View style={styles.sessionTelemetry}>
                <View style={styles.telemetryCell}>
                  <View style={styles.telemetryKeyRow}><View style={styles.readyDot} /><Text style={styles.telemetryKey} numberOfLines={1}>AUTH LATENCY</Text></View>
                  <Text style={styles.telemetryValue} numberOfLines={1}>18ms</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <View style={styles.telemetryKeyRow}><View style={styles.readyDot} /><Text style={styles.telemetryKey} numberOfLines={1}>AGENTS ONLINE</Text></View>
                  <Text style={styles.telemetryValue} numberOfLines={1}>12/12</Text>
                </View>
                <View style={styles.telemetryCell}>
                  <View style={styles.telemetryKeyRow}><View style={styles.readyDot} /><Text style={styles.telemetryKey} numberOfLines={1}>BKT SYNC</Text></View>
                  <Text style={styles.telemetryValue} numberOfLines={1}>READY</Text>
                </View>
              </View>
              <Text style={styles.disclaimer}>演示密码 demo1234 · 登录状态仅保存在本机</Text>
            </View>
          </View>

          </View>

          <View
            nativeID="deep-dive-stage"
            style={styles.deepDiveSection}
            onLayout={(event) => { deepDiveY.current = event.nativeEvent.layout.y; }}
          >
            <Reveal reducedMotion={reducedMotion} index={0}>
            <View style={styles.deepDiveHeader}>
              <View style={styles.deepDiveHeaderCopy}>
                <Text style={styles.deepDiveEyebrow}>FULL-WIDTH INTERACTIVE SHOWCASE</Text>
                <Text style={styles.deepDiveTitle}>{TAB_OVERVIEWS[activeTab].title} · 全宽深度工作台</Text>
                <Text style={styles.deepDiveSubtitle}>向下滚动查看完整流水线、知识图谱与 IDE 级资源预览。</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="回到首屏" onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })} style={({ pressed }) => [styles.backToTop, pressed && styles.backToTopPressed]}>
                <Text style={styles.backToTopText}>回到首屏 ↑</Text>
              </Pressable>
            </View>
            </Reveal>
            <InspectorPanel
              activeTab={activeTab}
              persona={selectedPersona}
              reducedMotion={reducedMotion}
              spotlightAgentKey={spotlight.key}
              spotlightNonce={spotlight.nonce}
            />
          </View>
        </View>
        <FooterTelemetry isWide={isWide} />
      </ScrollView>

      <HelpModal visible={showHelp} onClose={() => setShowHelp(false)} />
    </SafeAreaView>
  </>;
}

const loginStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

/** One compiled style sheet per theme, shared by the login page and every panel. */
function useLoginStyles() {
  const { mode, theme } = useTheme();
  return useMemo(() => {
    const cached = loginStyleCache.get(mode);
    if (cached) return cached;
    const created = createStyles(theme);
    loginStyleCache.set(mode, created);
    return created;
  }, [mode, theme]);
}

function createStyles(theme: ThemeTokens) {
  const cardShadow = theme.isDark
    ? theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.12), 0 16px 40px -20px rgba(0, 0, 0, 0.78)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px -20px rgba(0, 0, 0, 0.75)"
    : "0 12px 32px -8px rgba(41, 37, 36, 0.06), 0 2px 6px rgba(41, 37, 36, 0.04)";
  const authShadow = theme.isDark
    ? theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.12), 0 30px 80px -30px rgba(0, 0, 0, 0.86)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 30px 80px -30px rgba(0, 0, 0, 0.82)"
    : `0 24px 64px -22px ${theme.accentShadow}, 0 8px 20px -12px ${theme.accentGlow}`;
  const webCard = webProps({
    boxShadow: cardShadow,
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  });
  const webTransition = webProps({
    transitionProperty: "background-color, border-color, box-shadow, transform",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  });
  const barTransition = webProps({
    transitionProperty: "width, height, background-color",
    transitionDuration: "500ms",
    transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
  });

  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.bgCanvas },
    scrollContent: { flexGrow: 0 },
    stage: { flex: 1, minHeight: 0 },
    pageContainer: { width: "100%", maxWidth: 1280, alignSelf: "center", paddingHorizontal: 32, paddingTop: 38, paddingBottom: 64, gap: 56 },
    pageContainerCompact: { paddingHorizontal: 16, paddingTop: 30, paddingBottom: 44, gap: 36 },
    pageContainerNarrow: { paddingHorizontal: 12, paddingTop: 24, paddingBottom: 40, gap: 30 },
    heroRow: { width: "100%", gap: 28 },
    heroRowWide: { flexDirection: "row", alignItems: "flex-start", gap: 48 },
    deepDiveSection: { width: "100%", gap: 20 },
    deepDiveHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 20 },
    deepDiveHeaderCopy: { flex: 1, minWidth: 0, gap: 6 },
    deepDiveEyebrow: { color: theme.accentPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 1.6, fontFamily: MONO_FONT },
    deepDiveTitle: { color: theme.textPrimary, fontSize: 32, fontWeight: "900", letterSpacing: -1, lineHeight: 40 },
    deepDiveSubtitle: { color: theme.textSecondary, fontSize: 16, lineHeight: 26, maxWidth: 820 },
    backToTop: { flexShrink: 0, borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, paddingHorizontal: 16, paddingVertical: 10 },
    backToTopPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
    backToTopText: { color: theme.textSecondary, fontSize: 14, fontWeight: "900" },

    // Overview pod + quick interactions
    overviewCard: { borderRadius: 20, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 24, gap: 12, overflow: "hidden", ...webCard },
    overviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    overviewKicker: { flexShrink: 1, color: theme.accentPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 1, fontFamily: MONO_FONT },
    overviewTag: { marginLeft: "auto", borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, paddingHorizontal: 12, paddingVertical: 5 },
    overviewTagText: { fontSize: 12, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    overviewTitle: { color: theme.textPrimary, fontSize: 28, fontWeight: "900", letterSpacing: -0.8 },
    overviewDesc: { color: theme.textSecondary, fontSize: 15, lineHeight: 24, maxWidth: 760 },
    overviewStats: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 2 },
    overviewStat: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 12, paddingVertical: 7 },
    overviewStatDot: { width: 6, height: 6, borderRadius: 3 },
    overviewStatText: { color: theme.textSecondary, fontSize: 13, fontWeight: "800" },
    overviewCta: { marginTop: 6, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentSoftBorder },
    overviewCtaPressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
    overviewCtaText: { color: theme.accentPrimary, fontSize: 16, fontWeight: "900" },
    quickChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    quickChip: { minHeight: 36, justifyContent: "center", borderRadius: 999, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 12, paddingVertical: 7, ...webTransition },
    quickChipActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentPrimary },
    quickChipPressed: { opacity: 0.84, transform: [{ scale: 0.99 }] },
    quickChipText: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "700" },
    quickChipTextActive: { color: theme.accentPrimary },
    quickReadout: { borderRadius: 12, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, padding: 12, gap: 8, overflow: "hidden" },
    quickReadoutHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    quickReadoutKicker: { flexShrink: 1, color: theme.textMuted, fontFamily: MONO_FONT, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.8 },
    quickReadoutValue: { marginLeft: "auto", color: theme.accentPrimary, fontFamily: MONO_FONT, fontSize: 12, fontWeight: "900" },
    quickReadoutText: { color: theme.textSecondary, fontSize: 12, lineHeight: 18 },
    quickReadoutMetaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    quickReadoutMeta: { color: theme.textMuted, fontFamily: MONO_FONT, fontSize: 9.5, letterSpacing: 0.5 },
    quickPipelineRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
    quickPipelineStep: { flex: 1, minWidth: 0 },
    quickPipelinePill: { paddingVertical: 5, borderRadius: 6, alignItems: "center", backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.borderDivider },
    quickPipelinePillActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentPrimary },
    quickPipelinePillText: { color: theme.textMuted, fontSize: 8.5, fontWeight: "700" },
    quickPipelinePillTextActive: { color: theme.accentPrimary, fontWeight: "900" },
    growthTrack: { borderRadius: 999, backgroundColor: theme.bgSubtleHover, overflow: "hidden", ...barTransition },
    growthFill: { height: "100%", borderRadius: 999, ...barTransition },

    // Top navigation
    navbar: {
      height: 64,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.borderSubtle,
      backgroundColor: theme.bgGlass,
      ...webProps({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", zIndex: 50 }),
    },
    navbarWide: { paddingHorizontal: 32 },
    navbarNarrow: { paddingHorizontal: 12, gap: 8 },
    navBrand: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
    navBrandNarrow: { gap: 7 },
    navBrandText: { color: theme.textPrimary, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
    navBrandAccent: { color: theme.accentPrimary },
    versionPill: { borderRadius: 99, borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft, paddingHorizontal: 12, paddingVertical: 6 },
    versionText: { color: theme.accentPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    navPills: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
    navPill: { position: "relative", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 10, paddingVertical: 8, ...webTransition },
    navPillActive: { backgroundColor: theme.bgSurface },
    navPillHover: { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgSubtleHover },
    navPillPressed: { transform: [{ scale: 0.97 }] },
    navPillTopLine: { position: "absolute", top: -1, left: 16, right: 16, height: 2, borderRadius: 2 },
    navPillCursor: { position: "absolute", bottom: -6, left: "50%", marginLeft: -5, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: "transparent", borderRightColor: "transparent" },
    navPillIcon: { fontSize: 13, fontWeight: "900" },
    navPillText: { color: theme.textSecondary, fontSize: 12.5, fontWeight: "700", fontFamily: MONO_FONT },
    navPillTextActive: { color: theme.textPrimary },
    navRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
    navRightCompact: { gap: 8 },
    systemStatus: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 },
    systemStatusText: { color: theme.textSecondary, fontSize: 12, fontWeight: "700", fontFamily: MONO_FONT },
    navHelp: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, paddingHorizontal: 10, paddingVertical: 7 },
    navHelpHover: { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgSubtleHover, transform: [{ translateY: -1 }] },
    navHelpPressed: { transform: [{ scale: 0.97 }] },
    navHelpIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentSoftBorder },
    navHelpIconText: { color: theme.accentPrimary, fontSize: 13, fontWeight: "900", fontFamily: MONO_FONT },
    navHelpText: { color: theme.textSecondary, fontSize: 13, fontWeight: "800" },

    // Brand mark
    logoWrap: { width: 38, height: 38 },
    logoMark: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentPrimary },
    logoGlyph: { color: theme.onAccent, fontSize: 19, fontWeight: "900" },
    logoOnline: { position: "absolute", right: -1, bottom: -1, width: 10, height: 10, borderRadius: 5, backgroundColor: theme.success, borderWidth: 2, borderColor: theme.bgCanvas },

    // Footer
    footer: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.borderSubtle, backgroundColor: theme.bgGlass },
    footerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
    footerText: { flexShrink: 1, color: theme.textMuted, fontSize: 11.5, fontWeight: "700", fontFamily: MONO_FONT, letterSpacing: 0.3 },
    footerValue: { color: theme.accentPrimary },
    footerDim: { color: theme.textMuted },
    footerRight: { color: theme.textMuted, fontSize: 11.5, fontFamily: MONO_FONT, letterSpacing: 0.3 },

    // Brand column
    brandColumn: { gap: 24 },
    brandColumnWide: { flex: 1, gap: 26 },
    brandBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.successSoft },
    brandBadgeText: { color: theme.success, fontSize: 11, fontWeight: "900", letterSpacing: 1.3, fontFamily: MONO_FONT },
    pulseWrap: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
    pulseHalo: { position: "absolute" },
    heroCopy: { gap: 12 },
    heroTitleRow: { flexDirection: "row", alignItems: "flex-start", gap: 14, flexWrap: "wrap" },
    heroTitle: { color: theme.textPrimary, fontSize: 52, fontWeight: "900", letterSpacing: -2, lineHeight: 58 },
    heroTitleWide: { fontSize: 64, lineHeight: 72, letterSpacing: -3 },
    heroTitleAccent: { color: theme.accentPrimary },
    heroBadge: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    heroBadgeText: { color: theme.accentPrimary, fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: 0.7 },
    heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accentPrimary },
    heroSubtitle: { color: theme.textSecondary, fontSize: 18, lineHeight: 28, maxWidth: 680 },
    heroSubtitleWide: { fontSize: 18, lineHeight: 28 },

    // Bento stat cards
    statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    statCard: { position: "relative", flex: 1, minWidth: 150, minHeight: 220, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, overflow: "hidden", ...webCard },
    statCardHover: { borderColor: theme.accentSoftBorder, transform: [{ translateY: -2 }] },
    statCardActive: { backgroundColor: theme.bgSurface },
    statCardPressed: { transform: [{ scale: 0.985 }] },
    statTopLine: { position: "absolute", top: -1, left: 16, right: 16, height: 3, borderRadius: 3 },
    statCursor: { position: "absolute", bottom: -6, left: "50%", marginLeft: -5, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 6, borderLeftColor: "transparent", borderRightColor: "transparent" },
    statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    statIcon: { fontSize: 18, fontWeight: "900" },
    statMeta: { color: theme.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.9, fontFamily: MONO_FONT },
    statValue: { color: theme.textPrimary, fontSize: 40, fontWeight: "900", marginTop: 10, letterSpacing: -1.2, fontFamily: MONO_FONT },
    statLabel: { color: theme.textSecondary, fontSize: 15, fontWeight: "800", marginTop: 2 },
    statHint: { color: theme.accentPrimary, fontSize: 11, fontWeight: "800", marginTop: 10 },
    microWrap: { marginTop: 14 },
    microCaption: { color: theme.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT, marginTop: 7 },
    meshGrid: { width: 60, flexDirection: "row", flexWrap: "wrap", gap: 4 },
    meshDot: { width: 5, height: 5, borderRadius: 3 },
    sparkline: { height: 48, borderRadius: 8, overflow: "hidden", backgroundColor: theme.bgElevated },
    sparkScan: { position: "absolute", top: 0, bottom: 0, width: "45%" },
    energyBar: { flexDirection: "row", alignItems: "flex-start", gap: 2 },
    energyColumn: { minWidth: 0, alignItems: "center", gap: 6 },
    energySegment: { width: "100%", height: 10, borderRadius: 5, marginHorizontal: 1 },
    energyLabel: { width: "100%", overflow: "hidden", fontSize: 7.2, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: 0, textAlign: "center" },

    // Inspector shell
    inspectorCard: { position: "relative", overflow: "hidden", minHeight: 560, borderRadius: 24, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 28, ...webCard },
    inspectorCardCompact: { padding: 14, borderRadius: 18 },
    inspectorTopLine: { position: "absolute", top: 0, left: 24, right: 24, height: 2, borderRadius: 2 },
    panelFill: { flex: 1, minHeight: 0 },
    inspectorHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    inspectorKicker: { flexShrink: 1, color: theme.accentPrimary, fontSize: 16, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    inspectorMeta: { flexShrink: 0, color: theme.textMuted, fontSize: 12, fontWeight: "900", letterSpacing: 0.5, fontFamily: MONO_FONT },
    inspectorHeaderRight: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 10 },
    inspectorBadge: { borderRadius: 99, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 12, paddingVertical: 6 },
    inspectorBadgeText: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5, fontFamily: MONO_FONT },
    pauseButton: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated },
    pauseButtonDisabled: { opacity: 0.45 },
    pauseButtonPressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
    pauseText: { color: theme.textSecondary, fontSize: 14, fontWeight: "900" },
    srOnly: { position: "absolute", width: 1, height: 1, overflow: "hidden", opacity: 0 },

    // Pipeline
    pipelineRowCompact: { flexDirection: "row", alignItems: "flex-start", marginTop: 18 },
    pipelineStepWrap: { flex: 1, minWidth: 0, alignItems: "center" },
    pipelineNodeWrap: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
    pipelineNodeWrapCompact: { width: 40, height: 40 },
    pulseRing: { position: "absolute", width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: theme.accentRing },
    stageLockBar: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, borderRadius: 9, borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft, paddingHorizontal: 12, paddingVertical: 7, overflow: "hidden" },
    stageLockDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.accentPrimary },
    stageLockText: { flexShrink: 1, minWidth: 0, color: theme.accentPrimary, fontSize: 10.5, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    stageLockAgent: { marginLeft: "auto", maxWidth: "38%", color: theme.accentPrimary, fontSize: 10.5, fontWeight: "800", fontFamily: MONO_FONT },
    pipelineNode: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.pendingRing, backgroundColor: theme.bgElevated },
    pipelineNodeCompact: { width: 40, height: 40, borderRadius: 12 },
    pipelineGlyph: { color: theme.textMuted, fontSize: 16, fontWeight: "900" },
    pipelineLabel: { color: theme.textMuted, fontSize: 9.5, lineHeight: 13, fontWeight: "700", marginTop: 8, textAlign: "center", fontFamily: MONO_FONT },
    pipelineLabelCompact: { fontSize: 8, lineHeight: 11, letterSpacing: -0.2, marginTop: 6 },
    pipelineConnector: { flexShrink: 0, width: 4, height: 3, borderRadius: 2, marginTop: 20, backgroundColor: theme.pendingLine },

    // macOS window chrome shared by the terminal and SQL sandbox
    trafficLights: { flexDirection: "row", alignItems: "center", gap: 8, width: 68, flexShrink: 0 },
    trafficDot: { width: 12, height: 12, borderRadius: 6, alignItems: "center", justifyContent: "center" },
    trafficGlyph: { color: "rgba(0, 0, 0, 0.58)", fontSize: 8, lineHeight: 10, fontWeight: "900" },
    macWindowHeader: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder, backgroundColor: theme.code.headerBg },
    macWindowTitle: { flex: 1, minWidth: 0, textAlign: "center", color: theme.code.title, fontSize: 11, fontFamily: MONO_FONT, letterSpacing: 0.2 },
    macWindowRight: { width: 68, alignItems: "flex-end", flexShrink: 0 },
    terminalRevealWrap: { flex: 1, minHeight: 260, marginTop: 18 },
    sqlWindow: { borderRadius: 16, borderWidth: 1, borderColor: theme.code.border, backgroundColor: theme.code.bg, overflow: "hidden", ...webProps({ boxShadow: theme.code.shadow }) },
    sqlWindowBody: { padding: 20, gap: 2 },
    sqlWindowBadge: { color: theme.code.string, fontSize: 10, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: 0.5 },

    // Terminal — warm sand-ivory studio window in every light mode
    terminal: { flex: 1, minHeight: 260, borderRadius: 16, borderWidth: 1, borderColor: theme.code.border, backgroundColor: theme.code.bg, overflow: "hidden", ...webProps({ boxShadow: theme.code.shadow }) },
    terminalHeader: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder, backgroundColor: theme.code.headerBg },
    terminalDots: { flexDirection: "row", gap: 6 },
    terminalDot: { width: 8, height: 8, borderRadius: 4 },
    terminalTitle: { flexShrink: 1, minWidth: 0, color: theme.code.muted, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4, fontFamily: MONO_FONT },
    terminalStage: { color: theme.code.string, fontSize: 10.5, fontWeight: "900", fontFamily: MONO_FONT },
    terminalBody: { flex: 1, minHeight: 180, paddingHorizontal: 20, paddingVertical: 20, gap: 7 },
    terminalHistory: { color: theme.code.muted, fontSize: 12.5, lineHeight: 19, fontFamily: MONO_FONT },
    terminalLine: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
    terminalPrompt: { color: theme.code.string, fontSize: 14, fontWeight: "900", fontFamily: MONO_FONT },
    terminalText: { flex: 1, color: theme.code.text, fontSize: 13, lineHeight: 22, fontFamily: MONO_FONT },
    caret: { width: 8, height: 18, backgroundColor: theme.code.caret, marginBottom: 2 },
    terminalFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderTopWidth: 1, borderTopColor: theme.code.headerBorder },
    terminalMeta: { flexShrink: 1, minWidth: 0, color: theme.code.muted, fontSize: 10.5, fontWeight: "800", fontFamily: MONO_FONT, letterSpacing: 0.3 },
    telemetryLine: { color: theme.code.text, fontSize: 11, lineHeight: 18, fontFamily: MONO_FONT },
    telemetryPrompt: { color: theme.code.string, fontWeight: "900" },
    telemetryOk: { color: theme.code.string },
    telemetryWarn: { color: theme.code.keyword },
    telemetryIdle: { color: theme.code.muted },
    ioBar: { borderTopWidth: 1, borderTopColor: theme.code.headerBorder, backgroundColor: theme.code.subtleBg, paddingHorizontal: 12, paddingVertical: 9, gap: 5 },
    ioRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
    ioPill: { width: 54, textAlign: "center", overflow: "hidden", fontSize: 9, fontWeight: "900", letterSpacing: 0.6, borderRadius: 4, borderWidth: 1, paddingVertical: 2, fontFamily: MONO_FONT },
    ioPillIn: { color: theme.code.string, borderColor: `${theme.code.string}59`, backgroundColor: `${theme.code.string}1A` },
    ioPillEngine: { color: theme.code.keyword, borderColor: `${theme.code.keyword}59`, backgroundColor: `${theme.code.keyword}1A` },
    ioPillOut: { color: theme.accentPrimary, borderColor: `${theme.accentPrimary}59`, backgroundColor: `${theme.accentPrimary}1A` },
    ioValue: { flex: 1, minWidth: 0, color: theme.code.text, fontSize: 10.5, fontFamily: MONO_FONT },

    // Agent matrix
    agentsBody: { gap: 20, marginTop: 18 },
    agentsBodyWide: { flexDirection: "row", alignItems: "stretch", gap: 24 },
    agentsMain: { flex: 1.4, minWidth: 0 },
    agentsMainWide: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: 460 },
    agentsSide: { flex: 1, minWidth: 0 },
    agentMatrixHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
    matrixLabel: { color: theme.accentPrimary, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    matrixHint: { flexShrink: 1, minWidth: 0, color: theme.textMuted, fontSize: 11, fontFamily: MONO_FONT },
    agentGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignContent: "flex-start" },
    agentCard: { minHeight: 150, borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 12, gap: 4, overflow: "hidden", ...webTransition },
    agentCardFull: { width: "100%" },
    agentCardWide: { width: "23%" },
    agentCardCompact: { width: "48.5%" },
    agentCardActive: { borderColor: theme.accentPrimary, backgroundColor: theme.accentSoft },
    agentCardPressed: { opacity: 0.84, transform: [{ scale: 0.98 }] },
    agentCardTop: { flexDirection: "row", alignItems: "center", gap: 4, minWidth: 0 },
    agentStatusLabel: { flexShrink: 1, fontSize: 9, fontWeight: "900", letterSpacing: 0.4, fontFamily: MONO_FONT },
    agentLatency: { marginLeft: "auto", flexShrink: 0, color: theme.textMuted, fontSize: 9.5, fontWeight: "800", fontFamily: MONO_FONT },
    agentName: { color: theme.textPrimary, fontSize: 15, lineHeight: 20, fontWeight: "800", marginTop: 2 },
    agentCodeRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
    agentCode: { flex: 1, minWidth: 0, color: theme.accentPrimary, fontSize: 11, fontWeight: "800", fontFamily: MONO_FONT },
    agentStageTag: { flexShrink: 0, overflow: "hidden", color: theme.textMuted, fontSize: 8.5, fontWeight: "900", letterSpacing: 0.3, fontFamily: MONO_FONT, borderRadius: 4, borderWidth: 1, borderColor: theme.borderSubtle, paddingHorizontal: 4, paddingVertical: 1 },
    agentDesc: { color: theme.textSecondary, fontSize: 11, lineHeight: 16, marginTop: 2 },

    // Knowledge graph
    chapterRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 16 },
    chapterChip: { borderRadius: 9, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 16, paddingVertical: 8, ...webTransition },
    chapterChipActive: { borderColor: theme.success, backgroundColor: theme.successSoft },
    chapterChipPressed: { opacity: 0.8 },
    chapterChipText: { color: theme.textSecondary, fontSize: 13, fontWeight: "800" },
    chapterChipTextActive: { color: theme.success, fontWeight: "800" },
    graphBody: { gap: 20, marginTop: 18 },
    graphBodyWide: { flexDirection: "row", alignItems: "stretch", gap: 24 },
    graphCanvas: { flex: 1.55, minWidth: 0 },
    graphCanvasHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
    graphCanvasTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "900" },
    graphCanvasMeta: { color: theme.textMuted, fontSize: 11, fontFamily: MONO_FONT },
    graphGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
    graphNode: { width: "31.5%", minHeight: 160, borderRadius: 14, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 16, gap: 5, ...webTransition },
    graphNodeCompact: { width: "47%" },
    graphNodeActive: { backgroundColor: theme.bgSurface },
    graphNodePressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
    graphNodeTop: { flexDirection: "row", alignItems: "center", gap: 6 },
    graphNodeId: { color: theme.textMuted, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    graphStatusDot: { width: 7, height: 7, borderRadius: 4, marginLeft: "auto" },
    graphStatusText: { fontSize: 11, fontWeight: "800" },
    graphLabel: { color: theme.textPrimary, fontSize: 15, fontWeight: "900", marginTop: 3 },
    graphMastery: { fontSize: 18, fontWeight: "900", fontFamily: MONO_FONT },
    graphProgressTrack: { height: 8, borderRadius: 99, backgroundColor: theme.bgSubtleHover, overflow: "hidden", marginTop: 2 },
    graphProgressFill: { height: "100%", borderRadius: 99 },
    graphDependency: { color: theme.textMuted, fontSize: 11, marginTop: 4, fontFamily: MONO_FONT },
    graphDashboard: { flex: 1, minWidth: 0, borderRadius: 16, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 20, gap: 10, ...webCard },
    dashboardKicker: { color: theme.success, fontSize: 12, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    dashboardTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 },
    dashboardTitle: { flex: 1, color: theme.textPrimary, fontSize: 23, fontWeight: "900", letterSpacing: -0.5 },
    dashboardId: { color: theme.textMuted, fontSize: 12, fontFamily: MONO_FONT },
    dashboardMasteryRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
    dashboardMastery: { fontSize: 38, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: -1 },
    dashboardMasteryMeta: { gap: 2 },
    dashboardLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "800", fontFamily: MONO_FONT },
    dashboardStatus: { fontSize: 13, fontWeight: "900" },
    graphProgressTrackLarge: { height: 12, borderRadius: 99, backgroundColor: theme.bgSubtleHover, overflow: "hidden" },
    dashboardSection: { gap: 5, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderDivider },
    dashboardSectionTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: "900" },
    dashboardEvidence: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
    dashboardChain: { color: theme.textSecondary, fontSize: 12, lineHeight: 20, fontFamily: MONO_FONT },
    exerciseRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 5 },
    exerciseIndex: { color: theme.accentPrimary, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    exerciseTitle: { flex: 1, color: theme.textSecondary, fontSize: 13 },
    exerciseArrow: { color: theme.accentPrimary, fontSize: 14, fontWeight: "900" },

    // Resources + SQL IDE
    resourceChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
    resourceChip: { borderRadius: 9, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 16, paddingVertical: 9, ...webTransition },
    resourceChipPressed: { opacity: 0.8 },
    resourceChipText: { color: theme.textSecondary, fontSize: 14, fontWeight: "800" },
    resourcePreviewLarge: { marginTop: 16, minHeight: 420 },
    ideBody: { flexDirection: "column", gap: 20 },
    ideBodyWide: { flexDirection: "row", alignItems: "stretch" },
    ideLeft: { flex: 1.25, minWidth: 0, gap: 12 },
    ideRight: { flex: 1, minWidth: 0, gap: 12 },
    editorHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    editorTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    editorBadge: { color: theme.success, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: 0.5 },
    sqlEditor: { borderRadius: 12, borderWidth: 1, borderColor: theme.code.border, backgroundColor: theme.code.bg, padding: 16, gap: 2 },
    sqlLineRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    lineNo: { width: 24, color: theme.code.muted, fontSize: 13, lineHeight: 24, fontFamily: MONO_FONT, textAlign: "right" },
    sqlCodeLine: { flex: 1, color: theme.code.text, fontSize: 13.5, lineHeight: 24, fontFamily: MONO_FONT },
    sqlKeyword: { color: theme.code.keyword, fontWeight: "900" },
    sqlFunc: { color: theme.code.string, fontWeight: "900" },
    explainCard: { borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 16, gap: 5 },
    explainHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 4 },
    explainTitle: { color: theme.textMuted, fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    explainCost: { color: theme.success, fontSize: 12, fontFamily: MONO_FONT },
    explainLine: { color: theme.textPrimary, fontSize: 12.5, lineHeight: 21, fontFamily: MONO_FONT },
    explainIndent1: { paddingLeft: 18 },
    explainIndent2: { paddingLeft: 36 },
    explainDim: { color: theme.textMuted },
    explainGood: { color: theme.success },
    resultHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    resultTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: "900", fontFamily: MONO_FONT },
    resultMeta: { color: theme.textMuted, fontSize: 11, fontFamily: MONO_FONT },
    resultTableLarge: { borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: theme.borderSubtle },
    resultRowLarge: { flexDirection: "row", backgroundColor: theme.bgSurface },
    resultHeaderRow: { backgroundColor: theme.bgElevated },
    resultCellLarge: { flex: 1, minWidth: 100, paddingHorizontal: 14, paddingVertical: 10, color: theme.textSecondary, fontSize: 13, fontFamily: MONO_FONT },
    perfCard: { borderRadius: 14, borderWidth: 1, borderColor: `${theme.success}55`, backgroundColor: theme.successSoft, padding: 20, gap: 6 },
    perfKicker: { color: theme.success, fontSize: 12, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    perfRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    perfBad: { color: theme.warning, fontSize: 30, fontWeight: "900", fontFamily: MONO_FONT, textDecorationLine: "line-through" },
    perfArrow: { color: theme.textMuted, fontSize: 22, fontWeight: "900" },
    perfGood: { color: theme.success, fontSize: 34, fontWeight: "900", fontFamily: MONO_FONT },
    perfSpeed: { color: theme.success, fontSize: 22, fontWeight: "900", fontFamily: MONO_FONT },
    perfNote: { color: theme.textSecondary, fontSize: 12, lineHeight: 19 },
    safetyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft, padding: 12 },
    safetyGlyph: { color: theme.accentPrimary, fontSize: 15, fontWeight: "900" },
    safetyText: { flex: 1, color: theme.textSecondary, fontSize: 11.5, lineHeight: 18 },
    previewHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    previewKicker: { flexShrink: 1, color: theme.accentPrimary, fontSize: 12, fontWeight: "900", letterSpacing: 0.5, fontFamily: MONO_FONT },
    previewPersona: { color: theme.success, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    largePreview: { minHeight: 380, borderRadius: 16, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 28, gap: 12 },
    largePreviewTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 4 },
    largeBulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    largeBulletGlyph: { color: theme.accentPrimary, fontSize: 16, fontWeight: "900", marginTop: 1 },
    largeBulletText: { flex: 1, color: theme.textSecondary, fontSize: 14, lineHeight: 22 },
    largeGraphRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 8 },
    largeGraphStep: { flexDirection: "row", alignItems: "center", gap: 8 },
    largeGraphNode: { borderRadius: 10, borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft, paddingHorizontal: 14, paddingVertical: 10 },
    largeGraphText: { color: theme.accentPrimary, fontSize: 13, fontWeight: "800" },
    largeGraphArrow: { color: theme.textMuted, fontSize: 17, fontWeight: "900" },
    largeQuizQuestion: { color: theme.textPrimary, fontSize: 15, lineHeight: 23, fontWeight: "700", marginTop: 4 },
    largeQuizOption: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, paddingHorizontal: 14, paddingVertical: 8 },
    largeQuizCorrect: { borderColor: `${theme.success}99`, backgroundColor: theme.successSoft },
    largeQuizWrong: { borderColor: `${theme.warning}99`, backgroundColor: theme.warningSoft },
    largeQuizMark: { width: 20, color: theme.accentPrimary, fontSize: 13, fontWeight: "900", fontFamily: MONO_FONT },
    largeQuizText: { flex: 1, color: theme.textSecondary, fontSize: 13, lineHeight: 20 },
    largeQuizExplanation: { color: theme.textMuted, fontSize: 13, lineHeight: 21, marginTop: 4 },
    largeFlipHint: { color: theme.accentPrimary, fontSize: 12, fontFamily: MONO_FONT, marginTop: "auto" },

    // Auth card
    authColumn: { width: "100%", maxWidth: 500, alignSelf: "center" },
    authColumnWide: { flexShrink: 0, width: 500, maxWidth: 500, alignSelf: "flex-start" },
    authColumnTwoColumn: { width: 640, maxWidth: 640 },
    authColumnWideCard: { width: 640, maxWidth: 640 },
    authCard: {
      position: "relative",
      overflow: "hidden",
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgGlass,
      paddingHorizontal: 24,
      paddingTop: 20,
      paddingBottom: 18,
      ...webCard,
      ...webProps({
        boxShadow: authShadow,
      }),
    },
    authCardWide: { width: "100%" },
    authCardTwoColumn: { width: "100%" },
    authCardWideCard: { width: "100%" },
    authCardNarrow: { padding: 18, borderRadius: 20 },
    authBody: { width: "100%" },
    authBodyTwoColumn: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    authPane: { minWidth: 0 },
    authPaneTwoColumn: { flex: 1 },
    authPaneRight: { borderLeftWidth: 1, borderLeftColor: theme.borderDivider, paddingLeft: 16 },
    dividerTwoColumn: { marginTop: 0 },
    cardTopLine: { position: "absolute", top: 0, left: 28, right: 28, height: 3, borderRadius: 2, backgroundColor: theme.accentPrimary },
    sessionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
    sessionLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
    envPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.successSoft, paddingHorizontal: 9, paddingVertical: 4 },
    envPillText: { color: theme.success, fontSize: 10, fontWeight: "700", letterSpacing: 0.1 },
    sessionDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.success },
    sessionSecure: { color: theme.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    sessionTag: { marginLeft: "auto", color: theme.textMuted, fontSize: 11, fontWeight: "900", letterSpacing: 0.7, fontFamily: MONO_FONT },
    cardHeader: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
    cardHeaderCopy: { flex: 1 },
    cardEyebrow: { color: theme.accentPrimary, fontSize: 10.5, fontWeight: "900", letterSpacing: 1.1, fontFamily: MONO_FONT },
    cardTitle: { color: theme.textPrimary, fontSize: 23, fontWeight: "900", letterSpacing: -0.4, marginTop: 4 },
    cardSubtitle: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
    lockBadge: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    lockGlyph: { color: theme.accentPrimary, fontSize: 18, fontWeight: "900" },
    notice: { borderRadius: 12, borderWidth: 1, borderColor: `${theme.warning}66`, backgroundColor: theme.warningSoft, padding: 12, marginTop: 16, gap: 4 },
    noticeTitle: { color: theme.warning, fontSize: 13, fontWeight: "900" },
    noticeText: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 19 },
    fieldLabel: { color: theme.textPrimary, fontSize: 12.5, fontWeight: "900", letterSpacing: 0.3, marginTop: 10, marginBottom: 6 },
    fieldLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 10, marginBottom: 6 },
    fieldLabelInline: { marginTop: 0, marginBottom: 0 },
    autoFillPill: { flexDirection: "row", alignItems: "center", borderRadius: 999, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.successSoft, paddingHorizontal: 8, paddingVertical: 3 },
    autoFillText: { color: theme.success, fontSize: 9.5, fontWeight: "800", fontFamily: MONO_FONT },
    stepHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 6 },
    stepBadge: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    stepBadgeText: { color: theme.accentPrimary, fontSize: 10, fontWeight: "900", fontFamily: MONO_FONT },
    stepCopy: { flex: 1, minWidth: 0 },
    stepTitle: { color: theme.textPrimary, fontSize: 13, fontWeight: "800", letterSpacing: -0.1 },
    stepHint: { color: theme.textMuted, fontSize: 10.5, lineHeight: 14, marginTop: 0 },
    fieldLabelTwoColumn: { marginTop: 0 },
    fieldLabelSpaced: { marginTop: 14 },
    roleList: { gap: 7 },
    roleCard: { position: "relative", overflow: "hidden", flexDirection: "row", alignItems: "center", gap: 8, padding: 8, paddingLeft: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, minHeight: 54, ...webTransition },
    roleCardNarrow: { gap: 9, padding: 10, paddingLeft: 14, borderRadius: 14 },
    roleCardTwoColumn: { minHeight: 100 },
    roleCardHover: { backgroundColor: theme.bgElevated, transform: [{ translateY: -2 }], ...webProps({ boxShadow: `0 10px 24px -14px ${theme.accentShadow}` }) },
    roleCardActive: { backgroundColor: theme.accentSoft },
    roleCardPressed: { transform: [{ scale: 0.985 }] },
    roleAccent: { position: "absolute", left: 0, top: 12, bottom: 12, width: 4, borderRadius: 4, overflow: "hidden" },
    roleShimmer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "42%" },
    roleIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1 },
    roleIconBoxNarrow: { width: 34, height: 34, borderRadius: 10 },
    roleIcon: { fontSize: 15, fontWeight: "900" },
    roleCopy: { flex: 1, minWidth: 0 },
    roleTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
    roleTitle: { color: theme.textPrimary, fontSize: 15, fontWeight: "900" },
    roleCode: { color: theme.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 0.6, fontFamily: MONO_FONT },
    roleDescription: { color: theme.textSecondary, fontSize: 11.5, lineHeight: 15, marginTop: 1 },
    roleDescriptionNarrow: { fontSize: 12, lineHeight: 17 },
    roleDescriptionTwoColumn: { fontSize: 11.5, lineHeight: 16 },
    roleRight: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, minWidth: 96, maxWidth: 140 },
    roleMasteryPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, maxWidth: 116 },
    roleMasteryPillText: { fontSize: 9, fontWeight: "900", lineHeight: 13, fontFamily: MONO_FONT, textAlign: "center" },
    roleRightNarrow: { minWidth: 90, maxWidth: 100 },
    roleRightTwoColumn: { minWidth: 70, maxWidth: 84 },
    roleMastery: { fontSize: 10, fontWeight: "900", lineHeight: 15, textAlign: "right", fontFamily: MONO_FONT },
    roleChevron: { color: theme.textMuted, fontSize: 20, fontWeight: "900" },
    roleCheck: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentPrimary, overflow: "hidden" },
    roleCheckText: { color: theme.onAccent, fontSize: 12, fontWeight: "900" },
    roleHint: { color: theme.accentPrimary, fontSize: 11.5, lineHeight: 17, marginTop: 8, fontWeight: "700" },
    disabled: { opacity: 0.58 },

    // Role profile telemetry (login-card extension)
    telemetryPod: { marginTop: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 14, gap: 9, overflow: "hidden" },
    telemetryPodCompact: { marginTop: 10, padding: 12, gap: 7 },
    telemetryHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    telemetryKicker: { flexShrink: 1, color: theme.accentPrimary, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.8, fontFamily: MONO_FONT },
    telemetryKickerZh: { color: theme.textMuted, fontSize: 10.5 },
    telemetryMasteryRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    telemetryMasteryLabel: { color: theme.textSecondary, fontSize: 11 },
    telemetryMasteryValue: { fontSize: 22, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    telemetryPendingRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    telemetryPendingText: { color: theme.textSecondary, fontSize: 11.5 },
    telemetryPriorityTag: { borderRadius: 5, borderWidth: 1, borderColor: `${theme.warning}66`, backgroundColor: theme.warningSoft, paddingHorizontal: 6, paddingVertical: 2 },
    telemetryPriorityText: { color: theme.warning, fontSize: 9, fontWeight: "900", letterSpacing: 0.3, fontFamily: MONO_FONT },
    telemetryNodeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    telemetryNodeLabel: { flexShrink: 0, color: theme.textMuted, fontSize: 10.5 },
    telemetryNodeValue: { flexShrink: 1, minWidth: 0, color: theme.textPrimary, fontSize: 11.5, fontWeight: "700" },
    telemetryDims: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
    telemetryDimsCompact: { flexWrap: "nowrap", gap: 3, marginTop: 2 },
    telemetryDim: { flexBasis: "22%", flexGrow: 1, minWidth: 0, gap: 4 },
    telemetryDimCompact: { flexBasis: 0, flexGrow: 1, minWidth: 0, gap: 0 },
    telemetryDimTrack: { height: 24, borderRadius: 4, backgroundColor: theme.bgSubtleHover, overflow: "hidden", justifyContent: "flex-end" },
    telemetryDimTrackCompact: { height: 22 },
    telemetryDimFill: { width: "100%", borderRadius: 4 },
    telemetryDimLabel: { color: theme.textMuted, fontSize: 8.5 },
    telemetryDimValue: { color: theme.textSecondary, fontSize: 9.5, fontWeight: "700", fontFamily: MONO_FONT },


    // Unified role telemetry strip
    telemetryStrip: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, padding: 10, overflow: "hidden" },
    telemetryStripCompact: { flexDirection: "column", alignItems: "stretch", gap: 8, padding: 10 },
    telemetryStripBlock: { flexGrow: 1, flexBasis: 140, minWidth: 0, gap: 3 },
    telemetryStripBlockCompact: { flexBasis: "auto", flexGrow: 0 },
    telemetryStripBlockSmall: { flexGrow: 1, flexBasis: 96, minWidth: 0, gap: 4 },
    telemetryStripBlockSmallCompact: { flexBasis: "auto", flexGrow: 0 },
    telemetryStripBlockWide: { flexGrow: 1.3, flexBasis: 180, minWidth: 0, gap: 3 },
    telemetryStripBlockWideCompact: { flexBasis: "auto", flexGrow: 0 },
    telemetryStripDivider: { width: 1, alignSelf: "stretch", backgroundColor: theme.borderDivider },
    telemetryStripDividerCompact: { width: "100%", height: 1, alignSelf: "auto" },
    telemetryStripKicker: { color: theme.textMuted, fontSize: 8, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    telemetryStripLabel: { color: theme.textSecondary, fontSize: 10 },
    telemetryStripValueRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    telemetryStripValue: { fontSize: 16, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    telemetryStripTag: { borderRadius: 5, backgroundColor: theme.warningSoft, paddingHorizontal: 5, paddingVertical: 1 },
    telemetryStripTagText: { color: theme.warning, fontSize: 7.5, fontWeight: "900", letterSpacing: 0.3, fontFamily: MONO_FONT },
    telemetryStripNodeRow: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
    telemetryStripNode: { flexShrink: 1, minWidth: 0, color: theme.textPrimary, fontSize: 10.5, fontWeight: "700" },
    telemetryMiniMatrix: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 18, marginTop: 0 },
    telemetryMiniTrack: { flex: 1, minWidth: 0, height: 18, borderRadius: 3, backgroundColor: theme.bgSubtleHover, overflow: "hidden", justifyContent: "flex-end" },
    telemetryMiniFill: { width: "100%", borderRadius: 3 },

    // Divider, inputs, CTA
    divider: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 18, marginBottom: 2 },
    dividerLine: { flex: 1, height: 1, backgroundColor: theme.borderDivider },
    dividerText: { color: theme.textMuted, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4 },
    inputShell: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, ...webTransition },
    inputShellFocused: { borderColor: theme.accentPrimary, backgroundColor: theme.bgSurface },
    inputShellFlash: {
      borderColor: theme.accentPrimary,
      backgroundColor: theme.bgSurface,
      ...webProps({
        animationKeyframes: "fieldFlash",
        animationDuration: "900ms",
        animationTimingFunction: "ease-out",
        animationFillMode: "both",
      }),
    },
    inputPrefix: { color: theme.textMuted, fontSize: 15, fontWeight: "900", width: 16, textAlign: "center", fontFamily: MONO_FONT },
    input: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 8, paddingRight: 12, color: theme.textPrimary, fontSize: 15, fontFamily: MONO_FONT },
    inputNarrow: { fontSize: 13 },
    inputAction: { flexShrink: 0, minHeight: 32, minWidth: 32, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", borderRadius: 8 },
    inputActionFixed: { flexShrink: 0 },
    inputActionText: { color: theme.textSecondary, fontSize: 13, fontWeight: "800" },
    error: { color: theme.warning, fontSize: 12.5, lineHeight: 19, fontWeight: "700", marginTop: 8 },
    cta: {
      position: "relative",
      overflow: "hidden",
      marginTop: 12,
      minHeight: 46,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      backgroundColor: theme.accentPrimary,
      ...webProps({
        boxShadow: `0 10px 26px -8px ${theme.accentShadow}, inset 0 1px 0 rgba(255, 255, 255, 0.32), inset 0 -1px 0 rgba(24, 24, 27, 0.18)`,
        transitionProperty: "transform, box-shadow, filter, background-color",
        transitionDuration: "160ms",
      }),
    },
    ctaHover: { transform: [{ translateY: -1 }], ...webProps({ boxShadow: `0 14px 36px -8px ${theme.accentShadow}, inset 0 1px 0 rgba(255, 255, 255, 0.4), inset 0 -1px 0 rgba(24, 24, 27, 0.18)` }) },
    ctaPressed: { transform: [{ scale: 0.98 }] },
    ctaDisabled: { opacity: 0.6 },
    ctaHighlight: { position: "absolute", top: 0, left: 20, right: 20, height: 1, backgroundColor: "rgba(255, 255, 255, 0.36)" },
    ctaShimmer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "40%" },
    ctaText: { color: theme.onAccent, fontSize: 15, fontWeight: "900", letterSpacing: 0.2 },
    ctaArrow: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: theme.isDark ? "rgba(24, 24, 27, 0.16)" : "rgba(255, 255, 255, 0.18)" },
    ctaArrowHover: { transform: [{ translateX: 4 }] },
    ctaArrowText: { color: theme.onAccent, fontSize: 15, fontWeight: "900" },
    ctaBusyRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, maxWidth: "100%", paddingHorizontal: 12 },
    ctaDots: { flexDirection: "row", alignItems: "center", gap: 5 },
    ctaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.onAccent },
    ctaStageText: { flexShrink: 1, color: theme.onAccent, fontSize: 13, fontWeight: "700" },
    sessionTelemetry: { flexDirection: "row", gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderDivider },
    telemetryCell: { flex: 1, minWidth: 0, gap: 3 },
    telemetryKeyRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    readyDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: theme.success, flexShrink: 0 },
    telemetryKey: { color: theme.textMuted, fontSize: 9.5, fontWeight: "900", letterSpacing: 0.2, fontFamily: MONO_FONT },
    telemetryValue: { color: theme.accentPrimary, fontSize: 11.5, fontWeight: "900", fontFamily: MONO_FONT },
    authSpacer: { flex: 1, minHeight: 12 },
    disclaimer: { color: theme.textMuted, fontSize: 10.5, textAlign: "center", marginTop: 6, lineHeight: 16 },

    // Help modal
    helpOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 22, backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.62)" : "rgba(41, 37, 36, 0.32)" },
    helpModalCard: { width: "100%", maxWidth: 520, borderRadius: 22, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 22, gap: 12, ...webProps({ boxShadow: cardShadow }) },
    helpHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    helpEyebrow: { color: theme.accentPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 1.1, fontFamily: MONO_FONT },
    helpTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 5 },
    helpClose: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated },
    helpCloseText: { color: theme.textSecondary, fontSize: 12, fontWeight: "900" },
    helpItem: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    helpItemGlyph: { color: theme.accentPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 0.5, marginTop: 2, fontFamily: MONO_FONT },
    helpItemText: { flex: 1, color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
    helpMono: { color: theme.textPrimary, fontWeight: "800", fontFamily: MONO_FONT },
    helpLinkWrap: { alignSelf: "flex-end", paddingVertical: 4 },
    helpLink: { color: theme.accentPrimary, fontSize: 12.5, fontWeight: "900" },
  });
}
