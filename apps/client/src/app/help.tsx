import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import Head from "expo-router/head";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { AmbientBackdrop } from "../components/ambient-backdrop";
import { Reveal } from "../components/scroll-reveal";
import { MiniIcon, type IconName } from "../components/mini-icon";
import { ThemeSwitcher } from "../components/theme-switcher";
import { useApp } from "../state/app-context";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { useTheme, type ThemeMode, type ThemeTokens } from "../state/theme-context";

type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };
type WebStyle = ViewStyle & TextStyle;
type ResourceTab = "sql" | "graph" | "quiz";
type AccentTone = "accent" | "success" | "warning" | "agent" | "secondary";

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>): WebStyle | null {
  return Platform.OS === "web" ? (style as unknown as WebStyle) : null;
}

/** Non-null variant used inside StyleSheet.create factory spreads. */
function webStyle(style: Record<string, unknown>): ViewStyle {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : {};
}

const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

/**
 * Code and terminal surfaces follow the active theme: warm sand-ivory in light
 * modes, warm charcoal only when the learner explicitly picks dark mode.
 */

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

const motion = StyleSheet.create({
  entrance0: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "680ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "0ms" }),
  entrance1: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "680ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "80ms" }),
  entrance2: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "680ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "160ms" }),
  entrance3: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "680ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "240ms" }),
  entrance4: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "680ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "320ms" }),
  panelIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "260ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards" }),
  dotPulse: webAnimation({ animationKeyframes: "dotPulse", animationDuration: "2.4s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
});

type StepDef = { key: string; step: string; title: string; subtitle: string; icon: string; tone: AccentTone };

/** The four learner-loop steps (诊断 / 路径 / 资源 / 辅导). */
const STEPS: readonly StepDef[] = [
  { key: "diagnosis", step: "01", title: "认知诊断", subtitle: "自适应难度校准", icon: "✦", tone: "accent" },
  { key: "path", step: "02", title: "学习路径", subtitle: "证据驱动拓扑编排", icon: "◇", tone: "success" },
  { key: "resources", step: "03", title: "多模态资源", subtitle: "6 类靶向生成 + SQL 沙箱", icon: "▤", tone: "warning" },
  { key: "tutor", step: "04", title: "AI 辅导", subtitle: "RAG 知识卡检索问答", icon: "◎", tone: "agent" },
];

const STEP_COPY = [
  { body: "诊断不是一次考试，而是一条持续更新的证据链。题目难度会随表现动态调整，并把每次作答写回 BKT 掌握度模型。", bullets: ["连续答对：提升难度并触发跨节点跳测", "答错：回溯前置知识断点，避免无效刷题", "每次作答：BKT 更新掌握度概率与置信度"] },
  { body: "路径节点由诊断证据驱动，而不是固定章节顺序。每个节点都说明为什么现在学、学到什么程度、下一步做什么。", bullets: ["每个节点包含诊断证据、掌握度与推荐动作", "前置依赖满足后自动解锁下一段学习闭环", "资源类型随画像、目标与薄弱维动态选型"] },
  { body: "6 类资源覆盖概念讲解、图谱、练习与实验。练习附带答案与错因解析，SQL 实验在隔离沙箱中执行。", bullets: ["讲解 / 图谱 / 练习 / 实验 / 闪卡 / 调优案例", "练习附答案、解析与错误模式提示", "8 表 sql.js WASM 沙箱：只读单语句、超时终止"] },
  { body: "TutorAgent 先检索课程知识卡，再生成回答。回答附来源引用；超出课程范围会明确拒答，服务超时会用本地课程事实兜底。", bullets: ["优先检索课程知识卡，回答可追溯", "超出《数据库原理》范围时明确拒答", "超时或服务不可用时使用本地检索事实"] },
] as const;

const DEMO_ROLES: readonly { username: string; title: string; description: string; icon: string; tone: AccentTone }[] = [
  { username: "foundation", title: "基础补齐", description: "零基础建立关系模型与 SQL 核心概念", icon: "◈", tone: "agent" },
  { username: "exam", title: "应试巩固", description: "高频考点与易错点专项突破", icon: "✦", tone: "warning" },
  { username: "practice", title: "实践进阶", description: "复杂查询与索引调优实战", icon: "⌘", tone: "success" },
];

const PATH_DEMO = [
  { id: "N-18", title: "多表 JOIN 优化", evidence: "SQL JOIN 耗时偏高", mastery: 54, action: "生成概念精讲 + 2 道实验题", detail: "前置依赖：SELECT 基础、关系代数。诊断证据：3 次 JOIN 查询平均耗时 420ms；BKT 掌握度 54%，建议先补齐连接算法，再做执行计划对照实验。" },
  { id: "N-22", title: "子查询嵌套", evidence: "相关子查询错误率 38%", mastery: 47, action: "分层练习 + 错因解析", detail: "前置依赖：多表 JOIN。画像证据：相关子查询题错误率 38%，常见问题是内外层执行时序混淆。建议先做 2 道关联子查询练习，再回到路径节点。" },
  { id: "N-31", title: "B+ 树索引", evidence: "索引选择正确率 61%", mastery: 61, action: "交互图解 + EXPLAIN 实验", detail: "前置依赖：SELECT 基础、连接算法。诊断证据：索引选择题正确率 61%，但无法解释回表成本。推荐使用 EXPLAIN 实验验证覆盖索引。" },
] as const;

const FAQ_ITEMS = [
  { q: "什么是基于诊断证据的 BKT 掌握度评估？", a: "BKT（Bayesian Knowledge Tracing）把掌握度视为一个概率状态：先验概率来自画像与历史作答，观测到答对/答错后计算后验，再叠加知识转移率。它比单次分数更稳定，也能解释为什么下一题会变难或回退到前置断点。" },
  { q: "SQL 实验室的代码在什么环境中运行？安全吗？", a: "SQL 在独立的 sql.js WASM Worker 中执行，与业务数据库完全隔离。每次执行使用全新内存数据库，只允许单条只读查询，并设有超时、最大返回行数与安全关键字拦截。ATTACH、PRAGMA 与多语句会被拒绝。" },
  { q: "如何切换演示账号或重置本机学习状态？", a: "在“我的”页面点击“退出登录”即可清除本机登录状态，随后回到登录页选择 foundation / exam / practice 任一角色。演示密码统一为 demo1234。" },
] as const;

/** Six-stage agent pipeline (distinct from the four-step learner loop below). */
const PIPELINE_STAGES = [
  { key: "orchestrator", label: "Orchestrator", caption: "编排", tone: "accent", stage: "S01" },
  { key: "profile", label: "Profile", caption: "画像", tone: "success", stage: "S02" },
  { key: "diagnosis", label: "Diagnosis", caption: "诊断", tone: "warning", stage: "S03" },
  { key: "path", label: "Path", caption: "路径", tone: "agent", stage: "S04" },
  { key: "resource", label: "Resource", caption: "资源", tone: "accent", stage: "S05" },
  { key: "review", label: "Review", caption: "质检", tone: "secondary", stage: "S06" },
] as const;

type AgentStatus = "ONLINE" | "READY" | "STANDBY";
type ArchAgent = {
  name: string;
  cn: string;
  desc: string;
  status: AgentStatus;
  latency: string;
  stage: string;
  tone: AccentTone;
  icon: IconName;
};

const ARCH_AGENTS: readonly ArchAgent[] = [
  { name: "Router", cn: "意图路由", desc: "解析学习意图并拆分任务 DAG", status: "ONLINE", latency: "8ms", stage: "S01", tone: "accent", icon: "link" },
  { name: "Profiler", cn: "画像师", desc: "八维学情画像与薄弱维识别", status: "ONLINE", latency: "14ms", stage: "S02", tone: "success", icon: "radar" },
  { name: "Diagnostic", cn: "诊断官", desc: "知识断点定位与错因推理", status: "ONLINE", latency: "22ms", stage: "S03", tone: "warning", icon: "target" },
  { name: "PathPlanner", cn: "路径规划师", desc: "动态路径编排与资源选型", status: "ONLINE", latency: "11ms", stage: "S04", tone: "agent", icon: "chart" },
  { name: "DocumentAgent", cn: "文档生成", desc: "概念精讲与结构化讲解", status: "ONLINE", latency: "36ms", stage: "S05", tone: "agent", icon: "book" },
  { name: "DiagramAgent", cn: "图谱生成", desc: "关系图谱与交互图解", status: "ONLINE", latency: "41ms", stage: "S05", tone: "agent", icon: "layers" },
  { name: "QuizAgent", cn: "测验生成", desc: "分层练习、答案与错因解析", status: "ONLINE", latency: "33ms", stage: "S05", tone: "warning", icon: "check" },
  { name: "SQLLabAgent", cn: "沙箱实验", desc: "8 表 SQL 实验设计与执行", status: "READY", latency: "4.2ms", stage: "S05", tone: "success", icon: "terminal" },
  { name: "SocraticTutor", cn: "苏格拉底导师", desc: "循证答疑与概念纠偏", status: "ONLINE", latency: "18ms", stage: "S05", tone: "accent", icon: "spark" },
  { name: "BKT-Evaluator", cn: "掌握度评估", desc: "贝叶斯知识追踪与参数更新", status: "ONLINE", latency: "9ms", stage: "S02", tone: "success", icon: "chart" },
  { name: "ReviewGuard", cn: "四维质检", desc: "事实、安全、格式与难度审核", status: "STANDBY", latency: "—", stage: "S06", tone: "secondary", icon: "shield" },
  { name: "MemoryAgent", cn: "记忆管理", desc: "学习历史、遗忘曲线与复习调度", status: "ONLINE", latency: "12ms", stage: "S04", tone: "success", icon: "clock" },
];

const AGENT_IO: Record<string, { input: string; engine: string; output: string }> = {
  Router: { input: "utterance + session_ctx + history", engine: "IntentClassifier · Task DAG Router", output: "route.plan → agents[]" },
  Profiler: { input: "submissions + attempt_history", engine: "8-D Vector · EWMA Update", output: "profile.vec → PathPlanner" },
  Diagnostic: { input: "symptom + profile.vec + graph", engine: "CauseGraph · Rule+LLM Trace", output: "diag.chain → PathPlanner" },
  PathPlanner: { input: "profile.vec + diag.chain", engine: "TopoSort · Dynamic Replan", output: "path.vN → Orchestrator" },
  DocumentAgent: { input: "concept + persona + weak_dims", engine: "Markdown Composer · Style Adapter", output: "doc.md + citations[]" },
  DiagramAgent: { input: "schema + dependency_graph", engine: "ER Layout · Mermaid Compiler", output: "svg + mermaid source" },
  QuizAgent: { input: "skill + error_patterns + bloom", engine: "Distractor Synthesis · IRT", output: "quiz.json + misconception[]" },
  SQLLabAgent: { input: "sql_draft + dataset_manifest", engine: "sql.js WASM · EXPLAIN Assert", output: "result_set + plan.assert" },
  SocraticTutor: { input: "query + RAG hits + profile", engine: "RAG Retriever · Socratic Policy", output: "reply + follow_up_chain" },
  "BKT-Evaluator": { input: "attempt + skill + priors", engine: "Bayes Knowledge Tracing", output: "P(L_t) → Profiler" },
  ReviewGuard: { input: "draft_bundle + rubric", engine: "4-D Gate · Claim Verification", output: "verdict + intercept report" },
  MemoryAgent: { input: "events + memory_pool", engine: "Ebbinghaus · SM-2 Scheduler", output: "due.queue → PathPlanner" },
};

const AGENT_WORKFLOW: Record<string, readonly string[]> = {
  Router: ["解析意图", "拆分任务 DAG", "分派智能体"],
  Profiler: ["读取作答历史", "更新八维向量", "输出薄弱维"],
  Diagnostic: ["采集症状", "遍历知识依赖", "定位断点链"],
  PathPlanner: ["读取画像", "拓扑排序", "生成路径"],
  DocumentAgent: ["选择模板", "生成讲解", "附上引用"],
  DiagramAgent: ["解析模式", "布局 ER 图", "输出 SVG"],
  QuizAgent: ["定位技能", "合成干扰项", "生成解析"],
  SQLLabAgent: ["启动沙箱", "执行查询", "断言结果"],
  SocraticTutor: ["检索知识卡", "生成追问", "给出提示"],
  "BKT-Evaluator": ["读取先验", "观测作答", "更新后验"],
  ReviewGuard: ["事实核验", "安全与格式", "难度对齐"],
  MemoryAgent: ["召回记忆", "计算遗忘曲线", "调度复习"],
};

const MECHANISM_CARDS = [
  { key: "bkt", title: "BKT 掌握度更新", desc: "先验来自画像与历史作答；观测答对/答错后计算后验，再叠加知识转移率 P(T)。每次作答都会更新节点概率与置信度。" },
  { key: "review", title: "ReviewAgent 四维质检", desc: "事实出处、安全策略、格式规范、难度对齐四项评分。低于阈值触发条件边打回，由生成智能体重构后再次送审。" },
  { key: "loop", title: "学习闭环回流", desc: "诊断 → 路径 → 资源 → 实验 → 评估 → 画像，每次学习行为都会回流到 BKT 与路径规划，形成可持续的个性化闭环。" },
] as const;


function toneColor(theme: ThemeTokens, tone: AccentTone): string {
  if (tone === "secondary") return theme.accentSecondary;
  if (tone === "success") return theme.success;
  if (tone === "warning") return theme.warning;
  if (tone === "agent") return theme.agent;
  return theme.accentPrimary;
}

function toneSoft(theme: ThemeTokens, tone: AccentTone): string {
  if (tone === "secondary") return `${theme.accentSecondary}18`;
  if (tone === "success") return theme.successSoft;
  if (tone === "warning") return theme.warningSoft;
  if (tone === "agent") return theme.agentSoft;
  return theme.accentSoft;
}

function toneBorder(theme: ThemeTokens, tone: AccentTone): string {
  if (tone === "secondary") return `${theme.accentSecondary}55`;
  if (tone === "success") return `${theme.success}55`;
  if (tone === "warning") return `${theme.warning}55`;
  if (tone === "agent") return `${theme.agent}55`;
  return theme.accentSoftBorder;
}

function masteryColor(theme: ThemeTokens, value: number): string {
  if (value >= 80) return theme.success;
  if (value >= 55) return theme.accentPrimary;
  return theme.warning;
}

function statusColor(theme: ThemeTokens, status: AgentStatus): string {
  if (status === "ONLINE") return theme.success;
  if (status === "READY") return theme.warning;
  return theme.textMuted;
}

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

function PulseDot({ color, size = 6 }: { color: string; size?: number }) {
  const styles = useHelpStyles();
  return <View style={styles.pulseWrap}>
    <View style={[styles.pulseHalo, motion.dotPulse, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]} />
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
  </View>;
}

function LogoMark() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  return <View style={[
    styles.logoMark,
    { backgroundColor: theme.accentPrimary, borderColor: theme.accentSoftBorder },
    webOnly({
      backgroundImage: `linear-gradient(135deg, ${theme.accentGradientFrom} 0%, ${theme.accentPrimary} 100%)`,
      boxShadow: `0 4px 12px -4px ${theme.accentShadow}, inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
    }),
  ]}>
    <Text style={[styles.logoGlyph, { color: theme.onAccent }]}>⬡</Text>
  </View>;
}

function GuideTopNav({
  compact,
  tight,
  showDocs,
  showWalkthrough,
  switcherCompact,
}: {
  compact: boolean;
  tight: boolean;
  showDocs: boolean;
  showWalkthrough: boolean;
  switcherCompact: boolean;
}) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };
  return <View
    nativeID="guide-nav"
    style={[
      styles.navbar,
      compact && styles.navbarCompact,
      { backgroundColor: theme.bgGlass, borderBottomColor: theme.borderSubtle },
      webOnly({ backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }),
    ]}
  >
    <View style={[styles.navLeft, compact && styles.navLeftCompact]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="返回工作台或登录"
        onPress={goBack}
        style={(state: PressState) => [
          styles.backPill,
          tight && styles.backPillCompact,
          { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated },
          state.hovered && { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgSubtleHover },
          state.pressed && styles.backPillPressed,
        ]}
      >
        <Text style={[styles.backGlyph, tight && styles.backGlyphCompact, { color: theme.accentPrimary }]}>←</Text>
        <Text style={[styles.backText, { color: theme.textPrimary }]}>{compact ? "返回" : "返回工作台/登录"}</Text>
      </Pressable>
      {!compact ? <View style={[styles.navDivider, { backgroundColor: theme.borderDivider }]} /> : null}
      <LogoMark />
      <Text style={[styles.navBrandText, tight && styles.navBrandCompact, { color: theme.textPrimary }]} numberOfLines={1}>知径 DB</Text>
      {!compact ? <Text style={[styles.navDocsText, { color: theme.textMuted }]} numberOfLines={1}>{"// SYSTEM DOCS & GUIDE"}</Text> : null}
    </View>
    <View style={styles.navRight}>
      {showDocs ? <View style={[styles.docsPill, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.docsPillText, { color: theme.accentPrimary }]}>DOCS v2.4</Text>
      </View> : null}
      {showWalkthrough ? <View style={[styles.walkthroughBadge, { borderColor: theme.borderSubtle, backgroundColor: theme.successSoft }]}>
        <PulseDot color={theme.success} />
        <Text style={[styles.walkthroughText, { color: theme.success }]}>Interactive Walkthrough</Text>
      </View> : null}
      <ThemeSwitcher compact={switcherCompact} />
    </View>
  </View>;
}

function GuideFooter({ isWide }: { isWide: boolean }) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  return <View style={[
    styles.footer,
    !isWide && styles.footerCompact,
    { backgroundColor: theme.bgGlass, borderTopColor: theme.borderSubtle },
    webOnly({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }),
  ]}>
    <View style={styles.footerLeft}>
      <PulseDot color={theme.success} size={5} />
      <Text style={[styles.footerText, { color: theme.textSecondary }]} numberOfLines={1}>
        ENGINE: <Text style={[styles.footerValue, { color: theme.accentPrimary }]}>BKT-DIAGNOSIS-V2</Text>
        <Text style={[styles.footerDim, { color: theme.textMuted }]}> · </Text>LATENCY: <Text style={[styles.footerValue, { color: theme.accentPrimary }]}>18ms</Text>
        {isWide ? <><Text style={[styles.footerDim, { color: theme.textMuted }]}> · </Text>SANDBOX: <Text style={[styles.footerValue, { color: theme.accentPrimary }]}>SQL.JS WASM READY</Text></> : null}
      </Text>
    </View>
    {isWide ? <Text style={[styles.footerRight, { color: theme.textMuted }]}>DOCS: v2.4 · INTERACTIVE GUIDE</Text> : null}
  </View>;
}

function DiagnosisDemo() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const [mastery, setMastery] = useState(48);
  const [level, setLevel] = useState(1);
  const [feedback, setFeedback] = useState("等待模拟作答…");
  const [positive, setPositive] = useState<boolean | null>(null);

  const answer = (correct: boolean) => {
    setPositive(correct);
    setMastery((value) => Math.max(20, Math.min(96, value + (correct ? 12 : -8))));
    setLevel((value) => Math.max(1, Math.min(3, value + (correct ? 1 : -1))));
    setFeedback(correct ? "✓ 答对：难度提升并触发跨节点跳测" : "✗ 答错：回溯前置断点，下一题降档");
  };

  const masteryTone = masteryColor(theme, mastery);

  return <View style={styles.demoBox}>
    <View style={styles.demoHeader}>
      <Text style={styles.demoKicker}>ADAPTIVE DIAGNOSTIC ENGINE</Text>
      <Text style={[styles.demoMeta, { color: theme.success }]}>BKT LIVE</Text>
    </View>
    <Text style={styles.demoQuestion}>多表 JOIN 后出现重复行，最可能的原因是？</Text>
    <View style={styles.demoActions}>
      <Pressable accessibilityRole="button" onPress={() => answer(true)} style={({ pressed }) => [styles.demoAction, styles.demoActionCorrect, pressed && styles.demoActionPressed]}>
        <Text style={[styles.demoActionCorrectText, { color: theme.success }]}>模拟答对 ✓</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => answer(false)} style={({ pressed }) => [styles.demoAction, styles.demoActionWrong, pressed && styles.demoActionPressed]}>
        <Text style={[styles.demoActionWrongText, { color: theme.warning }]}>模拟答错 ✗</Text>
      </Pressable>
    </View>
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>BKT MASTERY</Text>
      <Text style={[styles.metricValue, { color: masteryTone }]}>{mastery}%</Text>
    </View>
    <View style={styles.masteryTrack}>
      <View style={[styles.masteryFill, { width: `${mastery}%`, backgroundColor: masteryTone }, webOnly({ transitionProperty: "width, background-color", transitionDuration: "380ms" })]} />
    </View>
    <View style={styles.difficultyRow}>
      <Text style={styles.metricLabel}>NEXT DIFFICULTY</Text>
      <View style={styles.difficultyDots}>
        {[1, 2, 3].map((item) => <View key={item} style={[styles.difficultyDot, item <= level && styles.difficultyDotActive]} />)}
      </View>
      <Text style={styles.difficultyValue}>Lv.{level}/3</Text>
    </View>
    <Text style={[
      styles.demoFeedback,
      positive === true && { color: theme.success },
      positive === false && { color: theme.warning },
    ]}>{feedback}</Text>
  </View>;
}

function PathDemo() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const [expanded, setExpanded] = useState<number | null>(1);
  return <View style={styles.demoBox}>
    <View style={styles.demoHeader}>
      <Text style={styles.demoKicker}>EVIDENCE-DRIVEN PATH</Text>
      <Text style={[styles.demoMeta, { color: theme.success }]}>3 NODES</Text>
    </View>
    <View style={styles.pathList}>
      {PATH_DEMO.map((node, index) => {
        const open = expanded === index;
        return <Pressable
          key={node.id}
          accessibilityRole="button"
          accessibilityLabel={`${node.title}，掌握度 ${node.mastery}%`}
          accessibilityState={{ expanded: open }}
          onPress={() => setExpanded(open ? null : index)}
          style={({ pressed }) => [styles.pathNode, open && styles.pathNodeOpen, pressed && styles.pathNodePressed]}
        >
          <View style={styles.pathTopRow}>
            <Text style={styles.pathNodeId}>{node.id}</Text>
            <Text style={styles.pathNodeTitle} numberOfLines={1}>{node.title}</Text>
            <Text style={[styles.pathNodeMastery, { color: masteryColor(theme, node.mastery) }]}>{node.mastery}%</Text>
          </View>
          <Text style={styles.pathEvidence} numberOfLines={1}>Evidence: {node.evidence}</Text>
          <Text style={styles.pathAction} numberOfLines={1}>推荐动作：{node.action}</Text>
          {open ? <View style={[styles.pathDetail, motion.panelIn]}><Text style={styles.pathDetailText}>{node.detail}</Text></View> : null}
        </Pressable>;
      })}
    </View>
  </View>;
}

function SqlMini() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  return <View>
    <View style={styles.sqlCode}>
      <Text style={styles.sqlLine} numberOfLines={1}><Text style={styles.sqlKeyword}>SELECT</Text> s.name, <Text style={styles.sqlFunc}>AVG</Text>(sc.score) <Text style={styles.sqlKeyword}>AS</Text> avg_score</Text>
      <Text style={styles.sqlLine} numberOfLines={1}><Text style={styles.sqlKeyword}>FROM</Text> student s</Text>
      <Text style={styles.sqlLine} numberOfLines={1}><Text style={styles.sqlKeyword}>JOIN</Text> enrollment sc <Text style={styles.sqlKeyword}>ON</Text> sc.student_id = s.id</Text>
      <Text style={styles.sqlLine} numberOfLines={1}><Text style={styles.sqlKeyword}>GROUP BY</Text> s.name <Text style={styles.sqlKeyword}>ORDER BY</Text> avg_score <Text style={styles.sqlKeyword}>DESC</Text>;</Text>
    </View>
    <View style={styles.resultTable}>
      <View style={[styles.resultRow, styles.resultHeader]}>
        <Text style={styles.resultCell}>name</Text>
        <Text style={styles.resultCell}>avg_score</Text>
      </View>
      <View style={styles.resultRow}><Text style={styles.resultCell}>林晓</Text><Text style={styles.resultCell}>92.4</Text></View>
      <View style={styles.resultRow}><Text style={styles.resultCell}>陈默</Text><Text style={styles.resultCell}>88.1</Text></View>
    </View>
    <Text style={[styles.execMeta, { color: theme.success }]}>Execution: 4.2ms · 2 rows · isolated sql.js WASM</Text>
  </View>;
}

function GraphMini() {
  const styles = useHelpStyles();
  return <View style={styles.miniGraphWrap}>
    <View style={styles.miniGraphRow}>
      {["关系", "元组", "键", "范式", "SQL"].map((label, index) => <View key={label} style={styles.miniGraphStep}>
        <View style={styles.miniGraphNode}><Text style={styles.miniGraphText}>{label}</Text></View>
        {index < 4 ? <Text style={styles.miniGraphArrow}>→</Text> : null}
      </View>)}
    </View>
    <Text style={styles.miniGraphNote}>概念节点通过前置依赖与实验资源形成可追踪路径；点击路径节点可查看诊断证据。</Text>
  </View>;
}

function QuizMini() {
  const styles = useHelpStyles();
  return <View style={styles.quizWrap}>
    <Text style={styles.quizQuestion}>若 score = NULL，哪种筛选方式能正确找出缺失成绩？</Text>
    <View style={styles.quizOptionWrong}><Text style={styles.quizMark}>✕</Text><Text style={styles.quizOptionText}>WHERE score = NULL</Text></View>
    <View style={styles.quizOptionCorrect}><Text style={styles.quizMarkGood}>✓</Text><Text style={styles.quizOptionText}>WHERE score IS NULL</Text></View>
    <Text style={styles.quizExplanation}>解析：NULL 表示未知，不能使用等值比较；应使用 IS NULL / IS NOT NULL。系统会将该错因写回画像并推荐针对性练习。</Text>
  </View>;
}

function ResourcesDemo() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const [tab, setTab] = useState<ResourceTab>("sql");
  const tabs: { key: ResourceTab; label: string }[] = [
    { key: "sql", label: "SQL 沙箱执行流" },
    { key: "graph", label: "知识图谱结构" },
    { key: "quiz", label: "错题解析卡" },
  ];
  return <View style={styles.demoBox}>
    <View style={styles.demoTabs}>{tabs.map((item) => {
      const active = item.key === tab;
      return <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setTab(item.key)} style={({ pressed }) => [styles.demoTab, active && styles.demoTabActive, pressed && styles.demoTabPressed]}>
        <Text style={[styles.demoTabText, active && { color: theme.accentPrimary }, active && styles.demoTabTextActive]}>{item.label}</Text>
      </Pressable>;
    })}</View>
    <View key={tab} style={[styles.demoTabBody, motion.panelIn]}>
      {tab === "sql" ? <SqlMini /> : tab === "graph" ? <GraphMini /> : <QuizMini />}
    </View>
  </View>;
}

function TutorDemo() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  return <View style={styles.demoBox}>
    <View style={styles.demoHeader}>
      <Text style={styles.demoKicker}>TUTORAGENT · GROUNDED ANSWER</Text>
      <Text style={[styles.demoMeta, { color: theme.success }]}>RAG</Text>
    </View>
    <View style={styles.userBubble}><Text style={styles.userBubbleText}>为什么 score = NULL 查不到数据？</Text></View>
    <View style={styles.retrievalPill}><PulseDot color={theme.success} size={4} /><Text style={styles.retrievalText}>🔍 已检索 3 张课程知识卡 (Node-14, Node-18)</Text></View>
    <View style={styles.aiRow}>
      <View style={styles.aiAvatar}><Text style={styles.aiAvatarText}>✦</Text></View>
      <View style={styles.aiBubble}>
        <Text style={styles.aiBubbleTitle}>TutorAgent · 循证回答</Text>
        <Text style={styles.aiBubbleText}>SQL 中的 NULL 表示“未知”，不是空字符串或 0。判断缺失值应使用 IS NULL / IS NOT NULL；使用 = NULL 的结果仍是 UNKNOWN，不会进入 WHERE 结果集。</Text>
      </View>
    </View>
    <View style={styles.sourceCard}>
      <Text style={styles.sourceTitle}>来源证据卡片</Text>
      <Text style={styles.sourceText}>PostgreSQL Documentation · NULL Handling · Node-14</Text>
    </View>
  </View>;
}

function StepPreview({ step, isWide }: { step: number; isWide: boolean }) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const current = STEPS[step]!;
  const accent = toneColor(theme, current.tone);
  return <View style={[styles.previewPod, motion.entrance3]}>
    <View style={styles.previewPodHeader}>
      <PulseDot color={accent} size={5} />
      <Text style={styles.previewPodKicker}>LIVE FEATURE PREVIEW · STEP {current.step}</Text>
      <View style={[styles.previewPodBadge, { borderColor: toneBorder(theme, current.tone), backgroundColor: toneSoft(theme, current.tone) }]}>
        <Text style={[styles.previewPodBadgeText, { color: accent }]}>{current.title.toUpperCase()}</Text>
      </View>
    </View>
    <View key={step} style={[styles.previewColumns, isWide && styles.previewColumnsWide, motion.panelIn]}>
      <View style={styles.explainerColumn}>
        <Text style={[styles.explainerKicker, { color: accent }]}>{current.icon} {current.subtitle}</Text>
        <Text style={styles.explainerTitle}>{current.title}</Text>
        <Text style={styles.explainerBody}>{STEP_COPY[step]!.body}</Text>
        <View style={styles.bulletList}>
          {STEP_COPY[step]!.bullets.map((bullet) => <View key={bullet} style={styles.bulletRow}>
            <Text style={[styles.bulletGlyph, { color: accent }]}>▸</Text>
            <Text style={styles.bulletText}>{bullet}</Text>
          </View>)}
        </View>
      </View>
      <View style={styles.demoColumn}>
        {step === 0 ? <DiagnosisDemo /> : step === 1 ? <PathDemo /> : step === 2 ? <ResourcesDemo /> : <TutorDemo />}
      </View>
    </View>
  </View>;
}

function DemoCredentialsPod() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const { login, ready } = useApp();
  const [busyRole, setBusyRole] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const clipboard = Platform.OS === "web"
    ? (globalThis as unknown as { navigator?: { clipboard?: { writeText: (text: string) => Promise<void> } } }).navigator?.clipboard
    : undefined;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyPassword = async () => {
    try { await clipboard?.writeText("demo1234"); } catch { /* clipboard can be unavailable */ }
    setCopied(true);
  };

  const startDemo = async (username: string) => {
    if (!ready || busyRole) return;
    setBusyRole(username);
    try {
      await login(username, "demo1234");
      router.replace("/(tabs)");
    } catch {
      router.replace({ pathname: "/", params: { demo: username } } as never);
    } finally {
      setBusyRole(null);
    }
  };

  return <View nativeID="demo-credentials" style={styles.sideCard}>
    <View style={styles.sideHeader}>
      <PulseDot color={theme.success} />
      <Text style={styles.sideKicker}>DEMO CREDENTIALS</Text>
      <Text style={styles.sideMeta}>ONE-CLICK</Text>
    </View>
    <View style={styles.passwordRow}>
      <Text style={styles.passwordLabel}>PASSWORD</Text>
      <Text style={styles.passwordValue}>demo1234</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="复制演示密码" onPress={() => void copyPassword()} style={({ pressed }) => [styles.copyButton, pressed && styles.copyButtonPressed]}>
        <Text style={[styles.copyText, copied && { color: theme.success }]}>{copied ? "✓ 已复制" : "复制密码"}</Text>
      </Pressable>
    </View>
    <View style={styles.roleList}>
      {DEMO_ROLES.map((role) => {
        const accent = toneColor(theme, role.tone);
        return <View key={role.username} style={styles.roleCard}>
          <View style={[styles.roleIcon, { borderColor: toneBorder(theme, role.tone), backgroundColor: toneSoft(theme, role.tone) }]}>
            <Text style={[styles.roleIconText, { color: accent }]}>{role.icon}</Text>
          </View>
          <View style={styles.roleCopy}>
            <View style={styles.roleTitleRow}>
              <Text style={[styles.roleUsername, { color: accent }]}>@{role.username}</Text>
              <Text style={styles.roleTitle} numberOfLines={1}>{role.title}</Text>
            </View>
            <Text style={styles.roleDescription} numberOfLines={2}>{role.description}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`以此账号登录 ${role.username}`}
            disabled={!ready || Boolean(busyRole)}
            onPress={() => void startDemo(role.username)}
            style={({ pressed }) => [styles.roleLogin, pressed && styles.roleLoginPressed, (!ready || busyRole) && styles.roleLoginDisabled]}
          >
            {busyRole === role.username
              ? <ActivityIndicator color={theme.accentPrimary} size="small" />
              : <Text style={styles.roleLoginText}>以此账号登录 →</Text>}
          </Pressable>
        </View>;
      })}
    </View>
  </View>;
}

function FAQAccordion() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const [open, setOpen] = useState<number | null>(0);
  return <View style={styles.sideCard}>
    <View style={styles.sideHeader}>
      <PulseDot color={theme.accentPrimary} size={5} />
      <Text style={styles.sideKicker}>QUICK FAQ</Text>
      <Text style={styles.sideMeta}>3 ITEMS</Text>
    </View>
    <View style={styles.faqList}>
      {FAQ_ITEMS.map((item, index) => {
        const isOpen = open === index;
        return <View key={item.q} style={styles.faqItem}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : index)} style={({ pressed }) => [styles.faqHeader, pressed && styles.faqHeaderPressed]}>
            <Text style={styles.faqIndex}>Q{index + 1}</Text>
            <Text style={styles.faqQuestion}>{item.q}</Text>
            <Text style={[styles.faqChevron, isOpen && styles.faqChevronOpen]}>⌄</Text>
          </Pressable>
          {isOpen ? <View style={[styles.faqBody, motion.panelIn]}><Text style={styles.faqAnswer}>{item.a}</Text></View> : null}
        </View>;
      })}
    </View>
  </View>;
}

function GuideActions() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const { currentUser, logout } = useApp();
  const returnToLogin = async () => {
    if (currentUser) await logout();
    router.replace("/");
  };
  return <View style={styles.actionsRow}>
    <Pressable accessibilityRole="button" accessibilityLabel="返回登录页" onPress={() => void returnToLogin()} style={({ pressed }) => [styles.secondaryAction, pressed && styles.actionPressed]}>
      <Text style={styles.secondaryActionText}>返回登录</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="进入学习空间" onPress={() => router.replace(currentUser ? "/(tabs)" : "/")} style={({ pressed }) => [styles.primaryAction, pressed && styles.actionPressed]}>
      <Text style={[styles.primaryActionText, { color: theme.onAccent }]}>{currentUser ? "进入学习空间" : "开始体验"} →</Text>
    </Pressable>
  </View>;
}

function PipelineStrip({ tight, activeStage, onSelect, reducedMotion }: { tight: boolean; activeStage: string | null; onSelect: (key: string | null) => void; reducedMotion: boolean }) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  return <View style={[styles.pipelineStrip, tight && styles.pipelineStripWrap]}>
    {PIPELINE_STAGES.map((stage, index) => {
      const showConnector = index > 0 && !(tight && index % 2 === 0);
      const active = activeStage === stage.key;
      const color = toneColor(theme, stage.tone);
      const count = ARCH_AGENTS.filter((agent) => agent.stage === stage.stage).length;
      return <View key={stage.key} style={[styles.pipelineItem, tight && styles.pipelineItemWrap]}>
        {showConnector ? <View style={[styles.pipelineConnector, { backgroundColor: theme.borderSubtle }]} /> : null}
        <Reveal index={index} reducedMotion={reducedMotion} style={styles.pipelineChipReveal}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`筛选 ${stage.label} 阶段的智能体`}
          accessibilityState={{ selected: active }}
          onPress={() => onSelect(active ? null : stage.key)}
          style={(state) => [
            styles.pipelineChip,
            tight && styles.pipelineChipTight,
            {
              backgroundColor: active ? toneSoft(theme, stage.tone) : theme.bgSurface,
              borderColor: active ? color : state.hovered ? toneBorder(theme, stage.tone) : theme.borderDivider,
            },
            active && webOnly({ boxShadow: `0 0 0 1px ${color}33, 0 8px 22px ${color}18` }),
            state.hovered && { transform: [{ translateY: -1 }] },
            webOnly({ cursor: "pointer", transitionProperty: "transform, border-color, background-color, box-shadow", transitionDuration: "180ms" }),
          ]}
        >
          <View style={[styles.pipelineNumBadge, { backgroundColor: active ? color : toneSoft(theme, stage.tone), borderColor: active ? color : toneBorder(theme, stage.tone) }]}>
            <Text style={[styles.pipelineNum, { color: active ? theme.onAccent : color }]}>{`0${index + 1}`}</Text>
          </View>
          <View style={styles.pipelineCopy}>
            <Text style={[styles.pipelineLabel, tight && styles.pipelineLabelTight, { color: theme.textPrimary }]} numberOfLines={1}>{stage.label}</Text>
            {!tight ? <Text style={[styles.pipelineCaption, { color: theme.textMuted }]} numberOfLines={1}>{stage.caption} · {count} agents</Text> : null}
          </View>
          {active ? <View style={[styles.pipelineActiveDot, { backgroundColor: color }]} /> : null}
        </Pressable>
        </Reveal>
      </View>;
    })}
  </View>;
}

function AgentDetailModal({ agent, onClose }: { agent: ArchAgent | null; onClose: () => void }) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  if (!agent) return null;
  const color = toneColor(theme, agent.tone);
  const io = AGENT_IO[agent.name];
  const flow = AGENT_WORKFLOW[agent.name] ?? [];
  const contract = JSON.stringify(io ?? { input: "", engine: "", output: "" }, null, 2);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <Pressable style={styles.agentModalOverlay} onPress={onClose}>
      <Pressable
        accessibilityViewIsModal
        onAccessibilityEscape={onClose}
        style={[styles.agentModalCard, { backgroundColor: theme.bgGlass, borderColor: theme.borderSubtle }]}
        onPress={(event) => event.stopPropagation()}
      >
        <View style={styles.agentModalHead}>
          <View style={[styles.agentModalIcon, { backgroundColor: toneSoft(theme, agent.tone), borderColor: toneBorder(theme, agent.tone) }]}>
            <MiniIcon name={agent.icon} size={22} color={color} />
          </View>
          <View style={styles.agentModalCopy}>
            <Text style={styles.agentModalKicker} numberOfLines={1}>{agent.stage} · {agent.status} · ⚡ {agent.latency}</Text>
            <Text style={styles.agentModalTitle}>{agent.cn}</Text>
            <Text style={[styles.agentModalCode, { color }]}>@{agent.name}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="关闭智能体详情" onPress={onClose} style={styles.agentModalClose}>
            <Text style={styles.agentModalCloseText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.agentModalDesc}>{agent.desc}</Text>
        <View style={styles.agentModalSection}>
          <Text style={styles.agentModalSectionTitle}>INPUT / ENGINE / OUTPUT CONTRACT</Text>
          <View style={styles.agentCodeBlock}>
            <Text style={styles.agentCodeText} numberOfLines={12}>{contract}</Text>
          </View>
        </View>
        <View style={styles.agentModalSection}>
          <Text style={styles.agentModalSectionTitle}>WORKFLOW EXAMPLE</Text>
          <View style={styles.agentFlowRow}>
            {flow.map((step, index) => <View key={step} style={styles.agentFlowStep}>
              <Text style={[styles.agentFlowIndex, { color }]}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.agentFlowText} numberOfLines={1}>{step}</Text>
              {index < flow.length - 1 ? <Text style={styles.agentFlowArrow}>→</Text> : null}
            </View>)}
          </View>
        </View>
      </Pressable>
    </Pressable>
  </Modal>;
}

function BktDiagram() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  if (Platform.OS !== "web") {
    return <View style={styles.diagramFallback}>
      <Text style={styles.diagramFallbackText}>Prior 48% → +Correct → Posterior 68%</Text>
      <Text style={styles.diagramFallbackFormula}>P(L_t | obs) ∝ P(obs | L_t) P(L_t)</Text>
    </View>;
  }
  return <View style={styles.mechanismDiagram}>
    <svg viewBox="0 0 280 110" role="img" aria-label="BKT 先验到后验更新曲线" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="bktArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accentPrimary} stopOpacity="0.24" />
          <stop offset="100%" stopColor={theme.accentPrimary} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M12 82 C48 78 66 70 92 58 S140 38 168 30 S210 18 258 12 L258 96 L12 96 Z" fill="url(#bktArea)" />
      <path d="M12 82 C48 78 66 70 92 58 S140 38 168 30 S210 18 258 12" fill="none" stroke={theme.accentPrimary} strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="92" cy="58" r="4" fill={theme.warning} />
      <circle cx="168" cy="30" r="4" fill={theme.success} />
      <text x="12" y="12" fill={theme.textSecondary} fontSize="9" fontFamily="monospace">P(L_t | obs) ∝ P(obs | L_t) P(L_t)</text>
      <text x="12" y="107" fill={theme.textMuted} fontSize="9" fontFamily="monospace">Prior 48%</text>
      <text x="102" y="107" fill={theme.warning} fontSize="9" fontFamily="monospace">+Correct</text>
      <text x="196" y="107" fill={theme.success} fontSize="9" fontFamily="monospace">Posterior 68%</text>
    </svg>
  </View>;
}

function ReviewDiagram() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const items = [
    { label: "事实出处", score: 96, tone: "success" as AccentTone },
    { label: "安全策略", score: 100, tone: "success" as AccentTone },
    { label: "格式规范", score: 92, tone: "warning" as AccentTone },
    { label: "难度对齐", score: 94, tone: "agent" as AccentTone },
  ];
  return <View style={styles.reviewDiagram}>
    <View style={styles.reviewGrid}>
      {items.map((item) => {
        const color = toneColor(theme, item.tone);
        return <View key={item.label} style={[styles.reviewBadge, { borderColor: toneBorder(theme, item.tone), backgroundColor: toneSoft(theme, item.tone) }]}>
          <MiniIcon name="shield" size={15} color={color} />
          <View style={styles.reviewBadgeCopy}>
            <Text style={[styles.reviewBadgeScore, { color }]}>{item.score}</Text>
            <Text style={styles.reviewBadgeLabel} numberOfLines={1}>{item.label}</Text>
          </View>
        </View>;
      })}
    </View>
    <View style={styles.reviewFlow}>
      <Text style={styles.reviewFlowStep}>初审 &lt;80</Text>
      <Text style={styles.reviewFlowArrow}>→</Text>
      <Text style={[styles.reviewFlowStep, { color: theme.warning }]}>打回重构 ↺</Text>
      <Text style={styles.reviewFlowArrow}>→</Text>
      <Text style={[styles.reviewFlowStep, { color: theme.success }]}>终审 ≥85 放行</Text>
    </View>
  </View>;
}

function LoopDiagram() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const nodes = [
    { label: "诊断", angle: -90, tone: "accent" as AccentTone },
    { label: "路径", angle: -30, tone: "agent" as AccentTone },
    { label: "资源", angle: 30, tone: "success" as AccentTone },
    { label: "实验", angle: 90, tone: "warning" as AccentTone },
    { label: "评估", angle: 150, tone: "secondary" as AccentTone },
    { label: "画像", angle: 210, tone: "accent" as AccentTone },
  ];
  if (Platform.OS !== "web") {
    return <View style={styles.loopFallback}>
      {nodes.map((node, index) => <View key={node.label} style={styles.loopFallbackStep}>
        <Text style={[styles.loopFallbackText, { color: toneColor(theme, node.tone) }]}>{node.label}</Text>
        {index < nodes.length - 1 ? <Text style={styles.loopFallbackArrow}>→</Text> : null}
      </View>)}
      <Text style={styles.loopFallbackArrow}>↺</Text>
    </View>;
  }
  const cx = 140;
  const cy = 66;
  const radius = 44;
  const point = (angle: number, r = radius) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * r, y: cy + Math.sin(rad) * r };
  };
  return <View style={styles.mechanismDiagram}>
    <svg viewBox="0 0 280 132" role="img" aria-label="学习闭环六节点回流图" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      <defs>
        <marker id="loopArrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L7 4 L0 8 Z" fill={theme.textMuted} />
        </marker>
      </defs>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={theme.borderSubtle} strokeWidth="1.2" strokeDasharray="3 4" />
      {nodes.map((node, index) => {
        const next = nodes[(index + 1) % nodes.length]!;
        const a = point(node.angle, radius + 4);
        const b = point(next.angle, radius + 4);
        return <path key={`arc-${node.label}`} d={`M ${a.x} ${a.y} A ${radius + 4} ${radius + 4} 0 0 1 ${b.x} ${b.y}`} fill="none" stroke={theme.textMuted} strokeWidth="1.1" markerEnd="url(#loopArrow)" opacity="0.7" />;
      })}
      {nodes.map((node) => {
        const pos = point(node.angle);
        const color = toneColor(theme, node.tone);
        return <g key={node.label}>
          <circle cx={pos.x} cy={pos.y} r="16" fill={toneSoft(theme, node.tone)} stroke={color} strokeWidth="1.3" />
          <text x={pos.x} y={pos.y + 3.5} textAnchor="middle" fontSize="8.5" fontFamily="monospace" fontWeight="700" fill={color}>{node.label}</text>
        </g>;
      })}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize="9" fontFamily="monospace" fill={theme.textMuted}>学习闭环</text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize="13" fontFamily="monospace" fill={theme.accentPrimary}>↺</text>
    </svg>
  </View>;
}

function MechanismCard({ card }: { card: (typeof MECHANISM_CARDS)[number] }) {
  const styles = useHelpStyles();
  return <View style={styles.mechanismCard}>
    {card.key === "bkt" ? <BktDiagram /> : card.key === "review" ? <ReviewDiagram /> : <LoopDiagram />}
    <Text style={styles.mechanismTitle}>{card.title}</Text>
    <Text style={styles.mechanismDesc}>{card.desc}</Text>
  </View>;
}

function ArchitectureSection({ width, reducedMotion }: { width: number; reducedMotion: boolean }) {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const fourColumns = width >= 1200;
  const twoColumns = width >= 560;
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<ArchAgent | null>(null);
  const activeStageDef = PIPELINE_STAGES.find((stage) => stage.key === activeStage) ?? null;
  return <View nativeID="architecture-section" style={styles.architectureSection}>
    <Reveal index={0} reducedMotion={reducedMotion}>
    <View style={styles.architectureHeader}>
      <Text style={[styles.architectureEyebrow, { color: theme.agent }]}>SYSTEM ARCHITECTURE · 12 AGENTS</Text>
      <Text style={styles.architectureTitle}>十二智能体协同架构与评分机制</Text>
      <Text style={styles.architectureSubtitle}>
        六阶段流水线（01 Orchestrator → 02 Profile → 03 Diagnosis → 04 Path → 05 Resource → 06 Review）以条件边接续调度；
        点击阶段筛选智能体，点击卡片查看输入输出契约与工作流示例。
      </Text>
    </View>
    </Reveal>

    <Reveal index={1} reducedMotion={reducedMotion}>
    <View style={styles.pipelineBox}>
      <View style={styles.pipelineBoxHead}>
        <Text style={styles.pipelineBoxTitle}>六阶段智能体流水线</Text>
        <Text style={styles.pipelineBoxMeta}>6 STAGES · 12 AGENTS · CLICK TO FILTER</Text>
      </View>
      <PipelineStrip tight={width < 840} activeStage={activeStage} onSelect={setActiveStage} reducedMotion={reducedMotion} />
      <Text style={styles.pipelineFilterNote} numberOfLines={2}>
        {activeStageDef
          ? `已筛选 ${activeStageDef.label} · ${ARCH_AGENTS.filter((agent) => agent.stage === activeStageDef.stage).length} 个智能体 · 再次点击阶段取消筛选`
          : "点击任一阶段，高亮对应智能体；点击智能体卡片查看契约详情。"}
      </Text>
    </View>
    </Reveal>

    <View style={styles.architectureGrid}>
      {ARCH_AGENTS.map((agent, index) => {
        const color = toneColor(theme, agent.tone);
        const matchesStage = !activeStageDef || agent.stage === activeStageDef.stage;
        const dimmed = Boolean(activeStageDef && !matchesStage);
        return <Reveal key={agent.name} index={index} reducedMotion={reducedMotion} style={fourColumns ? styles.archCardFour : twoColumns ? styles.archCardTwo : styles.archCardOne}>
        <Pressable
          nativeID={`arch-agent-${agent.name}`}
          accessibilityRole="button"
          accessibilityLabel={`${agent.cn} ${agent.name}，${agent.desc}，${agent.status}，${agent.latency}`}
          accessibilityState={{ selected: selectedAgent?.name === agent.name }}
          onPress={() => setSelectedAgent(agent)}
          style={(state) => [
            styles.archCard,
            styles.archCardFull,
            {
              borderColor: matchesStage && activeStageDef ? color : theme.borderSubtle,
              borderLeftColor: color,
              backgroundColor: theme.bgSurface,
            },
            matchesStage && activeStageDef && webOnly({ boxShadow: `0 0 0 1px ${color}33, 0 12px 28px ${color}18` }),
            state.hovered && !dimmed && { transform: [{ translateY: -2 }], borderColor: color },
            state.hovered && !dimmed && webOnly({ boxShadow: `0 14px 34px -16px ${color}55, 0 2px 8px rgba(0,0,0,0.04)` }),
            dimmed && styles.archCardDimmed,
            state.pressed && { transform: [{ scale: 0.99 }] },
            webOnly({ cursor: "pointer", transitionProperty: "transform, border-color, box-shadow, background-color", transitionDuration: "180ms" }),
          ]}
        >
          <View style={styles.archTop}>
            <View style={[styles.archIconBadge, { backgroundColor: toneSoft(theme, agent.tone), borderColor: toneBorder(theme, agent.tone) }]}>
              <MiniIcon name={agent.icon} size={18} color={color} />
            </View>
            <View style={styles.archTopMeta}>
              <View style={styles.archStatusRow}>
                <View style={[styles.archStatusDot, { backgroundColor: statusColor(theme, agent.status) }]} />
                <Text style={[styles.archStatus, { color: statusColor(theme, agent.status) }]} numberOfLines={1}>{agent.status}</Text>
                <Text style={[styles.archStageInline, { color: theme.textMuted, borderColor: theme.borderDivider }]}>{agent.stage}</Text>
                <Text style={[styles.archLatencyTop, { color: theme.textMuted }]} numberOfLines={1}>⚡ {agent.latency}</Text>
              </View>
              <Text style={styles.archCn} numberOfLines={1}>{agent.cn}</Text>
            </View>
          </View>
          <Text style={[styles.archCode, { color }]} numberOfLines={1} ellipsizeMode="tail">@{agent.name}</Text>
          <Text style={styles.archDesc} numberOfLines={2}>{agent.desc}</Text>
          <View style={styles.archMicro}>
            <View style={styles.archWave}>
              {Array.from({ length: 12 }, (_, bar) => <View
                key={bar}
                style={[styles.archWaveBar, { height: 3 + ((bar * 7 + index * 5 + agent.name.length) % 9), backgroundColor: color }]}
              />)}
            </View>
            <Text style={styles.archMicroStage}>STAGE {agent.stage.slice(1)}</Text>
            <View style={[styles.archLatencyPill, { borderColor: toneBorder(theme, agent.tone), backgroundColor: toneSoft(theme, agent.tone) }]}>
              <Text style={[styles.archLatencyPillText, { color }]}>⚡ {agent.latency}</Text>
            </View>
          </View>
          <View
            pointerEvents="none"
            {...({ dataSet: { sheen: "true" } } as ViewProps)}
            style={[styles.archSheen, webOnly({ backgroundImage: "linear-gradient(105deg, transparent 30%, rgba(255, 255, 255, 0.3) 50%, transparent 70%)" })]}
          />
        </Pressable>
        </Reveal>;
      })}
    </View>

    <View nativeID="mechanism-grid" style={styles.scoringGrid}>
      {MECHANISM_CARDS.map((card, index) => <Reveal key={card.key} index={index} reducedMotion={reducedMotion} style={styles.mechanismReveal}>
        <MechanismCard card={card} />
      </Reveal>)}
    </View>

    <AgentDetailModal agent={selectedAgent} onClose={() => setSelectedAgent(null)} />
  </View>;
}

export default function HelpScreen() {
  const { theme } = useTheme();
  const styles = useHelpStyles();
  const reducedMotion = useReducedMotion();
  const width = useHydratedWidth();
  const isWide = width >= 960;
  const isCompact = width < 700;
  const navCompact = width < 840;
  const tight = width < 560;
  const showDocs = width >= 960;
  const showWalkthrough = width >= 1200;
  const switcherCompact = width < 840;
  const [activeStep, setActiveStep] = useState(0);

  const activeAccent = toneColor(theme, STEPS[activeStep]!.tone);

  return <>
    <Head><title>系统指南 · 知径 DB</title></Head>
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bgCanvas }]}>
      <AmbientBackdrop variant="corner" reducedMotion={reducedMotion} />

      <GuideTopNav
        compact={navCompact}
        tight={tight}
        showDocs={showDocs}
        showWalkthrough={showWalkthrough}
        switcherCompact={switcherCompact}
      />

      <ScrollView nativeID="help-stage" style={styles.stage} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.page, isWide && styles.pageWide, isCompact && styles.pageCompact]}>
          <View style={[styles.columns, isWide && styles.columnsWide]}>
            <View style={styles.mainColumn}>
              <View style={[styles.guideHeader, motion.entrance1]}>
                <Text style={styles.guideEyebrow}>INTERACTIVE SYSTEM GUIDE</Text>
                <Text style={[styles.guideTitle, isCompact && styles.guideTitleCompact]}>四步走完学习闭环</Text>
                <Text style={styles.guideSubtitle}>从诊断证据到个性化资源，再到循证辅导。点击下方步骤，体验每个环节的真实交互。</Text>
                <View style={styles.guideMetaRow}>
                  {["4 STEPS", "12 AGENTS", "45 NODES", "6 RESOURCE MODES"].map((item) => <View key={item} style={styles.guideMetaPill}>
                    <Text style={styles.guideMetaText}>{item}</Text>
                  </View>)}
                </View>
              </View>

              <View style={[styles.stepperCard, motion.entrance2]}>
                <View style={styles.stepperLabelRow}>
                  <Text style={styles.stepperLabel}>学习者闭环 · LEARNER LOOP</Text>
                  <Text style={styles.stepperLabelValue}>诊断 / 路径 / 资源 / 辅导</Text>
                </View>
                <View style={styles.stepperTrack}>
                  <View style={[styles.stepperFill, { width: `${((activeStep + 1) / STEPS.length) * 100}%`, backgroundColor: activeAccent }, webOnly({ transitionProperty: "width, background-color", transitionDuration: "320ms" })]} />
                </View>
                <View style={styles.stepperGrid}>
                  {STEPS.map((step, index) => {
                    const active = index === activeStep;
                    const accent = toneColor(theme, step.tone);
                    return <Pressable
                      key={step.key}
                      accessibilityRole="tab"
                      accessibilityLabel={`第 ${step.step} 步，${step.title}，${step.subtitle}`}
                      accessibilityState={{ selected: active }}
                      onPress={() => setActiveStep(index)}
                      style={(state: PressState) => [
                        styles.stepTab,
                        !isWide && styles.stepTabCompact,
                        active && styles.stepTabActive,
                        state.hovered && !active && styles.stepTabHover,
                        state.pressed && styles.stepTabPressed,
                      ]}
                    >
                      {active ? <View pointerEvents="none" style={[styles.stepTopLine, { backgroundColor: accent }]} /> : null}
                      <Text style={[styles.stepNumber, active && { color: accent }]}>STEP {step.step}</Text>
                      <Text style={styles.stepTitle}>{step.title}</Text>
                      <Text style={styles.stepSubtitle} numberOfLines={2}>{step.subtitle}</Text>
                      {active ? <View pointerEvents="none" style={[styles.stepCursor, { borderTopColor: accent }]} /> : null}
                    </Pressable>;
                  })}
                </View>
              </View>

              <StepPreview step={activeStep} isWide={isWide} />
            </View>

            <View style={[styles.sideColumn, isWide && styles.sideColumnWide]}>
              <DemoCredentialsPod />
              <FAQAccordion />
              <GuideActions />
            </View>
          </View>

          <ArchitectureSection width={width} reducedMotion={reducedMotion} />
        </View>
        <GuideFooter isWide={isWide} />
      </ScrollView>
    </SafeAreaView>
  </>;
}

const helpStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

/** One compiled style sheet per theme, shared by every section on the guide. */
function useHelpStyles() {
  const { mode, theme } = useTheme();
  return useMemo(() => {
    const cached = helpStyleCache.get(mode);
    if (cached) return cached;
    const created = createStyles(theme);
    helpStyleCache.set(mode, created);
    return created;
  }, [mode, theme]);
}

function createStyles(theme: ThemeTokens) {
  const warmShadow = theme.isDark
    ? theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.12), 0 16px 40px -20px rgba(0, 0, 0, 0.78)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px -20px rgba(0, 0, 0, 0.75)"
    : "0 12px 32px -8px rgba(41, 37, 36, 0.06), 0 2px 6px rgba(41, 37, 36, 0.04)";
  const webCard = webStyle({
    boxShadow: warmShadow,
    ...(theme.base === "linear" ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {}),
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  });
  const webSurface = webStyle({
    transitionProperty: "background-color, border-color",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  });

  return StyleSheet.create({
    safe: { flex: 1 },
    stage: { flex: 1, minHeight: 0 },
    scrollContent: { flexGrow: 1, paddingBottom: 12 },

    // ── Top navigation (fixed above the scroll view) ──────────────────────
    navbar: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 16,
      paddingHorizontal: 24,
      borderBottomWidth: 1,
      flexShrink: 0,
      zIndex: 40,
    },
    navbarCompact: { paddingHorizontal: 12, gap: 10, minHeight: 58 },
    navLeft: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 },
    navLeftCompact: { gap: 8 },
    backPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 14,
      paddingVertical: 9,
      flexShrink: 0,
      ...webSurface,
    },
    backPillCompact: { paddingHorizontal: 10, paddingVertical: 7, gap: 5 },
    backPillPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    backGlyph: { fontSize: 16, fontWeight: "800" },
    backGlyphCompact: { fontSize: 14 },
    backText: { fontSize: 13, fontWeight: "600" },
    navDivider: { width: 1, height: 22 },
    pulseWrap: { width: 16, height: 16, alignItems: "center", justifyContent: "center" },
    pulseHalo: { position: "absolute" },
    logoMark: {
      width: 32,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      flexShrink: 0,
    },
    logoGlyph: { fontSize: 16, fontWeight: "800" },
    navBrandText: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3, flexShrink: 1 },
    navBrandCompact: { fontSize: 15 },
    navDocsText: {
      fontSize: 11.5,
      fontWeight: "600",
      fontFamily: MONO_FONT,
      letterSpacing: 0.3,
      flexShrink: 1,
    },
    navRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
    docsPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 6 },
    docsPillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4, fontFamily: MONO_FONT },
    walkthroughBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    walkthroughText: { fontSize: 10.5, fontWeight: "700", fontFamily: MONO_FONT, letterSpacing: 0.2 },

    // ── Footer (in flow, never covers the last card) ──────────────────────
    footer: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      paddingHorizontal: 32,
      paddingVertical: 10,
      borderTopWidth: 1,
      flexShrink: 0,
    },
    footerCompact: { paddingHorizontal: 16 },
    footerLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, minWidth: 0 },
    footerText: { flexShrink: 1, fontSize: 11.5, fontWeight: "600", fontFamily: MONO_FONT, letterSpacing: 0.2 },
    footerValue: { fontWeight: "700" },
    footerDim: {},
    footerRight: { fontSize: 11, fontFamily: MONO_FONT, letterSpacing: 0.2 },

    // ── Page frame ────────────────────────────────────────────────────────
    page: {
      width: "100%",
      maxWidth: 1280,
      alignSelf: "center",
      paddingHorizontal: 24,
      paddingTop: 40,
      paddingBottom: 72,
      gap: 40,
    },
    pageWide: { paddingHorizontal: 32 },
    pageCompact: { paddingTop: 24, paddingHorizontal: 16, paddingBottom: 48, gap: 28 },

    // ── Two-column learner layout ─────────────────────────────────────────
    columns: { width: "100%", gap: 24 },
    columnsWide: { flexDirection: "row", alignItems: "flex-start", gap: 32 },
    mainColumn: { flex: 1, minWidth: 0, gap: 20 },
    sideColumn: { width: "100%", gap: 16, paddingTop: 0 },
    sideColumnWide: { flexShrink: 0, width: 420, maxWidth: 420 },

    // ── Guide header ──────────────────────────────────────────────────────
    guideHeader: { gap: 9 },
    guideEyebrow: { color: theme.accentPrimary, fontSize: 12, fontWeight: "700", letterSpacing: 1.6, fontFamily: MONO_FONT },
    guideTitle: { color: theme.textPrimary, fontSize: 42, lineHeight: 50, fontWeight: "800", letterSpacing: -1.2 },
    guideTitleCompact: { fontSize: 31, lineHeight: 40, letterSpacing: -0.8 },
    guideSubtitle: { color: theme.textSecondary, fontSize: 16.5, lineHeight: 26, maxWidth: 860 },
    guideMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    guideMetaPill: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    guideMetaText: { color: theme.textSecondary, fontSize: 11, fontWeight: "600", fontFamily: MONO_FONT, letterSpacing: 0.3 },

    // ── Learner loop stepper ──────────────────────────────────────────────
    stepperCard: {
      position: "relative",
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      padding: 18,
      gap: 14,
      ...webCard,
    },
    stepperLabelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
    stepperLabel: { color: theme.textMuted, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.9, fontFamily: MONO_FONT },
    stepperLabelValue: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "600" },
    stepperTrack: { height: 4, borderRadius: 999, backgroundColor: theme.bgElevated, overflow: "hidden" },
    stepperFill: { height: 4, borderRadius: 999 },
    stepperGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    stepTab: {
      position: "relative",
      flex: 1,
      minWidth: 150,
      minHeight: 112,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 5,
      ...webSurface,
    },
    stepTabCompact: { flexBasis: "47%", flexGrow: 1 },
    stepTabActive: { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder },
    stepTabHover: { backgroundColor: theme.bgSubtleHover, borderColor: theme.borderSubtle },
    stepTabPressed: { transform: [{ scale: 0.985 }] },
    stepTopLine: { position: "absolute", top: -1, left: 16, right: 16, height: 3, borderRadius: 2 },
    stepCursor: {
      position: "absolute",
      bottom: -6,
      left: "50%",
      marginLeft: -5,
      width: 0,
      height: 0,
      borderLeftWidth: 5,
      borderRightWidth: 5,
      borderTopWidth: 6,
      borderLeftColor: "transparent",
      borderRightColor: "transparent",
    },
    stepNumber: { color: theme.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.6, fontFamily: MONO_FONT },
    stepTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
    stepSubtitle: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 },

    // ── Live preview pod ──────────────────────────────────────────────────
    previewPod: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      padding: 24,
      ...webCard,
    },
    previewPodHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 18, flexWrap: "wrap" },
    previewPodKicker: { flexShrink: 1, color: theme.textMuted, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, fontFamily: MONO_FONT },
    previewPodBadge: { marginLeft: "auto", borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 5 },
    previewPodBadgeText: { fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4, fontFamily: MONO_FONT },
    previewColumns: { gap: 24 },
    previewColumnsWide: { flexDirection: "row", alignItems: "stretch" },
    explainerColumn: { flex: 1, minWidth: 0, gap: 10 },
    demoColumn: { flex: 1.15, minWidth: 0 },
    explainerKicker: { fontSize: 12, fontWeight: "700", letterSpacing: 0.4, fontFamily: MONO_FONT },
    explainerTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    explainerBody: { color: theme.textSecondary, fontSize: 15, lineHeight: 25 },
    bulletList: { gap: 9, marginTop: 4 },
    bulletRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 9,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 12,
    },
    bulletGlyph: { fontSize: 15, fontWeight: "800", marginTop: 1 },
    bulletText: { flex: 1, color: theme.textSecondary, fontSize: 14, lineHeight: 22 },

    // ── Demo boxes (inner elevated surface) ───────────────────────────────
    demoBox: {
      flex: 1,
      minHeight: 340,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 20,
      gap: 12,
      ...webSurface,
    },
    demoHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    demoKicker: { flexShrink: 1, color: theme.textMuted, fontSize: 11, fontWeight: "700", letterSpacing: 0.5, fontFamily: MONO_FONT },
    demoMeta: { fontSize: 11, fontWeight: "700", fontFamily: MONO_FONT },
    demoQuestion: { color: theme.textPrimary, fontSize: 15.5, lineHeight: 23, fontWeight: "700" },
    demoActions: { flexDirection: "row", gap: 12 },
    demoAction: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    demoActionCorrect: { borderColor: theme.borderSubtle, backgroundColor: theme.successSoft },
    demoActionWrong: { borderColor: theme.borderSubtle, backgroundColor: theme.warningSoft },
    demoActionPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    demoActionCorrectText: { fontSize: 13.5, fontWeight: "700" },
    demoActionWrongText: { fontSize: 13.5, fontWeight: "700" },
    metricRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    metricLabel: { color: theme.textMuted, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.3, fontFamily: MONO_FONT },
    metricValue: { fontSize: 15, fontWeight: "700", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    masteryTrack: { height: 9, borderRadius: 999, backgroundColor: theme.bgSurface, overflow: "hidden", borderWidth: 1, borderColor: theme.borderDivider },
    masteryFill: { height: "100%", borderRadius: 999 },
    difficultyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    difficultyDots: { flexDirection: "row", gap: 6 },
    difficultyDot: { width: 22, height: 6, borderRadius: 3, backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.borderDivider },
    difficultyDotActive: { backgroundColor: theme.accentPrimary, borderColor: theme.accentPrimary },
    difficultyValue: { marginLeft: "auto", color: theme.textSecondary, fontSize: 12, fontWeight: "700", fontFamily: MONO_FONT },
    demoFeedback: { color: theme.textSecondary, fontSize: 13, lineHeight: 21, fontFamily: MONO_FONT },

    // ── Path nodes ────────────────────────────────────────────────────────
    pathList: { gap: 10 },
    pathNode: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgSurface,
      padding: 14,
      gap: 5,
      ...webSurface,
    },
    pathNodeOpen: { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    pathNodePressed: { opacity: 0.84 },
    pathTopRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    pathNodeId: { color: theme.accentPrimary, fontSize: 11.5, fontWeight: "700", fontFamily: MONO_FONT },
    pathNodeTitle: { flex: 1, color: theme.textPrimary, fontSize: 14.5, fontWeight: "700" },
    pathNodeMastery: { fontSize: 13.5, fontWeight: "700", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    pathEvidence: { color: theme.warning, fontSize: 12, marginTop: 2, fontFamily: MONO_FONT },
    pathAction: { color: theme.textSecondary, fontSize: 12.5, marginTop: 2 },
    pathDetail: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.borderDivider },
    pathDetailText: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },

    // ── Resource tabs ─────────────────────────────────────────────────────
    demoTabs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    demoTab: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgSurface,
      paddingHorizontal: 13,
      paddingVertical: 8,
      ...webSurface,
    },
    demoTabActive: { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    demoTabPressed: { opacity: 0.8 },
    demoTabText: { color: theme.textSecondary, fontSize: 12.5, fontWeight: "600" },
    demoTabTextActive: { fontWeight: "700" },
    demoTabBody: { flex: 1, marginTop: 12 },

    // ── Fixed warm charcoal code block ────────────────────────────────────
    sqlCode: { gap: 3, padding: 14, borderRadius: 10, backgroundColor: theme.code.bg, borderWidth: 1, borderColor: theme.code.border },
    sqlLine: { color: theme.code.text, fontSize: 12.5, lineHeight: 21, fontFamily: MONO_FONT },
    sqlKeyword: { color: theme.code.keyword, fontWeight: "700" },
    sqlFunc: { color: theme.code.string, fontWeight: "700" },
    resultTable: { marginTop: 10, borderRadius: 9, overflow: "hidden", borderWidth: 1, borderColor: theme.borderDivider },
    resultRow: { flexDirection: "row", backgroundColor: theme.bgSurface },
    resultHeader: { backgroundColor: theme.bgElevated },
    resultCell: { width: 120, paddingHorizontal: 10, paddingVertical: 7, color: theme.textSecondary, fontSize: 12.5, fontFamily: MONO_FONT },
    execMeta: { fontSize: 11.5, fontFamily: MONO_FONT, marginTop: 8 },

    // ── Mini knowledge graph ──────────────────────────────────────────────
    miniGraphWrap: { gap: 14 },
    miniGraphRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    miniGraphStep: { flexDirection: "row", alignItems: "center", gap: 8 },
    miniGraphNode: {
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.successSoft,
      paddingHorizontal: 13,
      paddingVertical: 9,
    },
    miniGraphText: { color: theme.success, fontSize: 13, fontWeight: "700" },
    miniGraphArrow: { color: theme.textMuted, fontSize: 15, fontWeight: "700" },
    miniGraphNote: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 21 },

    // ── Quiz card ─────────────────────────────────────────────────────────
    quizWrap: { gap: 10 },
    quizQuestion: { color: theme.textPrimary, fontSize: 15.5, lineHeight: 23, fontWeight: "700" },
    quizOptionWrong: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 44,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.warningSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quizOptionCorrect: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 44,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.successSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    quizMark: { width: 18, color: theme.warning, fontSize: 13, fontWeight: "700" },
    quizMarkGood: { width: 18, color: theme.success, fontSize: 13, fontWeight: "700" },
    quizOptionText: { flex: 1, color: theme.textSecondary, fontSize: 13, fontFamily: MONO_FONT },
    quizExplanation: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 21, marginTop: 4 },

    // ── Tutor demo ────────────────────────────────────────────────────────
    userBubble: {
      alignSelf: "flex-end",
      maxWidth: "90%",
      borderRadius: 12,
      borderTopRightRadius: 4,
      borderWidth: 1,
      borderColor: theme.accentSoftBorder,
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    userBubbleText: { color: theme.textPrimary, fontSize: 13.5, lineHeight: 21 },
    retrievalPill: {
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.successSoft,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    retrievalText: { color: theme.success, fontSize: 11.5, fontWeight: "600", fontFamily: MONO_FONT },
    aiRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    aiAvatar: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.accentSoft,
      borderWidth: 1,
      borderColor: theme.accentSoftBorder,
    },
    aiAvatarText: { color: theme.accentPrimary, fontSize: 13, fontWeight: "700" },
    aiBubble: {
      flex: 1,
      borderRadius: 12,
      borderTopLeftRadius: 4,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      padding: 14,
      gap: 6,
    },
    aiBubbleTitle: { color: theme.accentPrimary, fontSize: 11.5, fontWeight: "700", fontFamily: MONO_FONT },
    aiBubbleText: { color: theme.textPrimary, fontSize: 13.5, lineHeight: 22 },
    sourceCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgSurface,
      padding: 12,
      gap: 4,
    },
    sourceTitle: { color: theme.textMuted, fontSize: 11, fontWeight: "700", fontFamily: MONO_FONT },
    sourceText: { color: theme.textSecondary, fontSize: 12, fontFamily: MONO_FONT },

    // ── Side cards (credentials / FAQ) ────────────────────────────────────
    sideCard: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      padding: 20,
      ...webCard,
    },
    sideHeader: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 },
    sideKicker: { flexShrink: 1, color: theme.textSecondary, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, fontFamily: MONO_FONT },
    sideMeta: { marginLeft: "auto", color: theme.textMuted, fontSize: 10.5, fontWeight: "600", fontFamily: MONO_FONT },
    passwordRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 12,
    },
    passwordLabel: { color: theme.textMuted, fontSize: 10.5, fontWeight: "700", letterSpacing: 0.4, fontFamily: MONO_FONT },
    passwordValue: { flex: 1, color: theme.textPrimary, fontSize: 16, fontWeight: "700", fontFamily: MONO_FONT, letterSpacing: 0.4 },
    copyButton: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.accentSoftBorder,
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    copyButtonPressed: { opacity: 0.8 },
    copyText: { color: theme.accentPrimary, fontSize: 12, fontWeight: "700" },
    roleList: { gap: 12, marginTop: 16 },
    roleCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 14,
    },
    roleIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    roleIconText: { fontSize: 15, fontWeight: "700" },
    roleCopy: { flex: 1, minWidth: 0 },
    roleTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    roleUsername: { fontSize: 11, fontWeight: "700", fontFamily: MONO_FONT, flexShrink: 0 },
    roleTitle: { flexShrink: 1, color: theme.textPrimary, fontSize: 14.5, fontWeight: "700" },
    roleDescription: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 19, marginTop: 3 },
    roleLogin: {
      flexShrink: 0,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.accentSoftBorder,
      backgroundColor: theme.accentSoft,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    roleLoginPressed: { opacity: 0.8, transform: [{ scale: 0.97 }] },
    roleLoginDisabled: { opacity: 0.55 },
    roleLoginText: { color: theme.accentPrimary, fontSize: 12, fontWeight: "700" },

    // ── FAQ ───────────────────────────────────────────────────────────────
    faqList: { gap: 10 },
    faqItem: {
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      overflow: "hidden",
    },
    faqHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
    faqHeaderPressed: { backgroundColor: theme.bgSubtleHover },
    faqIndex: { color: theme.accentPrimary, fontSize: 11.5, fontWeight: "700", fontFamily: MONO_FONT },
    faqQuestion: { flex: 1, color: theme.textPrimary, fontSize: 14.5, fontWeight: "600", lineHeight: 22 },
    faqChevron: { color: theme.textMuted, fontSize: 15, fontWeight: "700" },
    faqChevronOpen: { transform: [{ rotate: "180deg" }] },
    faqBody: {
      paddingHorizontal: 14,
      paddingBottom: 14,
      paddingTop: 4,
      borderTopWidth: 1,
      borderTopColor: theme.borderDivider,
    },
    faqAnswer: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 22 },

    // ── Actions ───────────────────────────────────────────────────────────
    actionsRow: { flexDirection: "row", justifyContent: "flex-end", flexWrap: "wrap", gap: 10, marginTop: 6 },
    secondaryAction: {
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      paddingHorizontal: 18,
      paddingVertical: 12,
      ...webSurface,
    },
    secondaryActionText: { color: theme.textPrimary, fontSize: 13, fontWeight: "700" },
    primaryAction: {
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.accentPrimary,
      backgroundColor: theme.accentPrimary,
      paddingHorizontal: 18,
      paddingVertical: 12,
      ...webStyle({
        backgroundImage: `linear-gradient(135deg, ${theme.accentGradientFrom} 0%, ${theme.accentPrimary} 100%)`,
        boxShadow: `0 6px 16px -6px ${theme.accentShadow}`,
      }),
    },
    primaryActionText: { fontSize: 13, fontWeight: "700" },
    actionPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },

    // ── Architecture ──────────────────────────────────────────────────────
    architectureSection: {
      width: "100%",
      gap: 20,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.borderSubtle,
      backgroundColor: theme.bgSurface,
      padding: 24,
      ...webCard,
    },
    architectureHeader: { gap: 8 },
    architectureEyebrow: { fontSize: 11.5, fontWeight: "700", letterSpacing: 1.3, fontFamily: MONO_FONT },
    architectureTitle: { color: theme.textPrimary, fontSize: 30, fontWeight: "800", letterSpacing: -0.8, lineHeight: 38 },
    architectureSubtitle: { color: theme.textSecondary, fontSize: 14.5, lineHeight: 24, maxWidth: 900 },

    pipelineBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 14,
      gap: 12,
    },
    pipelineBoxHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
    pipelineBoxTitle: { color: theme.textSecondary, fontSize: 12, fontWeight: "700" },
    pipelineBoxMeta: { color: theme.textMuted, fontSize: 9.5, fontWeight: "600", fontFamily: MONO_FONT, letterSpacing: 0.6 },
    pipelineStrip: { flexDirection: "row", alignItems: "center" },
    pipelineStripWrap: { flexWrap: "wrap", rowGap: 8, columnGap: 4 },
    pipelineItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center" },
    pipelineItemWrap: { flexBasis: "49%", flexGrow: 0, maxWidth: "49%" },
    pipelineConnector: { width: 10, height: 1, flexShrink: 0 },
    pipelineChip: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
    },
    pipelineChipTight: { paddingHorizontal: 5, gap: 4 },
    pipelineChipReveal: { flex: 1, minWidth: 0 },
    pipelineNumBadge: { width: 24, height: 24, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    pipelineActiveDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    pipelineFilterNote: { color: theme.textMuted, fontSize: 10.5, lineHeight: 16, marginTop: 3 },
    pipelineNum: { fontSize: 8.5, fontWeight: "800", fontFamily: MONO_FONT, flexShrink: 0 },
    pipelineCopy: { flex: 1, minWidth: 0 },
    pipelineLabel: { fontSize: 10.5, fontWeight: "600" },
    pipelineLabelTight: { fontSize: 8.5 },
    pipelineCaption: { fontSize: 9, lineHeight: 13 },

    architectureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    archCard: {
      minHeight: 176,
      borderRadius: 14,
      borderWidth: 1,
      borderLeftWidth: 3,
      padding: 14,
      gap: 6,
      overflow: "hidden",
      ...webSurface,
    },
    archCardDimmed: { opacity: 0.48 },
    archSheen: { position: "absolute", top: 0, bottom: 0, left: 0, width: "45%", opacity: 0 },
    archTop: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    archIconBadge: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    archTopMeta: { flex: 1, minWidth: 0, gap: 3 },
    archStatusRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    archStageInline: { fontSize: 8.5, fontWeight: "700", fontFamily: MONO_FONT, paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, borderWidth: 1, overflow: "hidden", flexShrink: 0 },
    archLatencyTop: { marginLeft: "auto", fontSize: 8.5, fontWeight: "600", fontFamily: MONO_FONT, flexShrink: 0, fontVariant: ["tabular-nums"] },
    archMicro: { marginTop: "auto", paddingTop: 7, borderTopWidth: 1, borderTopColor: theme.borderDivider, flexDirection: "row", alignItems: "center", gap: 6 },
    archWave: { flex: 1, minWidth: 0, height: 14, flexDirection: "row", alignItems: "flex-end", gap: 2 },
    archWaveBar: { width: 3, borderRadius: 2, opacity: 0.82 },
    archMicroStage: { fontSize: 8, fontWeight: "700", fontFamily: MONO_FONT, letterSpacing: 0.3, color: theme.textMuted, flexShrink: 0 },
    archLatencyPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
    archLatencyPillText: { fontSize: 8.5, fontWeight: "800", fontFamily: MONO_FONT },
    archCardFull: { width: "100%" },
    archCardFour: { width: "23%" },
    archCardTwo: { width: "48%" },
    archCardOne: { width: "100%" },
    archStatusDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    archStatus: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.3, fontFamily: MONO_FONT, flexShrink: 0 },
    archStage: {
      marginLeft: "auto",
      fontSize: 9,
      fontWeight: "700",
      fontFamily: MONO_FONT,
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderRadius: 4,
      borderWidth: 1,
      overflow: "hidden",
      flexShrink: 0,
    },
    archLatency: { fontSize: 8.5, fontWeight: "600", fontFamily: MONO_FONT, flexShrink: 0, fontVariant: ["tabular-nums"] },
    archCn: { color: theme.textPrimary, fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
    archCode: { fontSize: 10.5, fontWeight: "700", fontFamily: MONO_FONT },
    archDesc: { color: theme.textSecondary, fontSize: 11.5, lineHeight: 17 },


    // ── Mechanism mini diagrams ─────────────────────────────────────────────
    mechanismReveal: { flex: 1, minWidth: 250 },
    mechanismCard: { flex: 1, minWidth: 250, borderRadius: 16, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 16, gap: 10, ...webCard },
    mechanismDiagram: { width: "100%", minHeight: 118, borderRadius: 12, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, padding: 10, justifyContent: "center", overflow: "hidden" },
    mechanismTitle: { color: theme.textPrimary, fontSize: 15.5, fontWeight: "800", letterSpacing: -0.2 },
    mechanismDesc: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 20 },
    diagramFallback: { gap: 6, padding: 4 },
    diagramFallbackText: { color: theme.textSecondary, fontSize: 12, fontFamily: MONO_FONT },
    diagramFallbackFormula: { color: theme.textMuted, fontSize: 10, fontFamily: MONO_FONT },
    reviewDiagram: { gap: 8 },
    reviewGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    reviewBadge: { flexBasis: "47%", flexGrow: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 9, paddingHorizontal: 8, paddingVertical: 6 },
    reviewBadgeCopy: { minWidth: 0 },
    reviewBadgeScore: { fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT, lineHeight: 15 },
    reviewBadgeLabel: { color: theme.textSecondary, fontSize: 9, lineHeight: 12 },
    reviewFlow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 2 },
    reviewFlowStep: { color: theme.textSecondary, fontSize: 9, fontFamily: MONO_FONT, lineHeight: 13 },
    reviewFlowArrow: { color: theme.textMuted, fontSize: 9, fontFamily: MONO_FONT },
    loopFallback: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
    loopFallbackStep: { flexDirection: "row", alignItems: "center", gap: 3 },
    loopFallbackText: { fontSize: 10, fontWeight: "700", fontFamily: MONO_FONT },
    loopFallbackArrow: { color: theme.textMuted, fontSize: 11, fontFamily: MONO_FONT },

    // ── Agent detail modal ──────────────────────────────────────────────────
    agentModalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.62)" : "rgba(41, 37, 36, 0.32)" },
    agentModalCard: { width: "100%", maxWidth: 620, borderRadius: 20, borderWidth: 1, padding: 22, gap: 12, ...webCard, ...webStyle({ backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)" }) },
    agentModalHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    agentModalIcon: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    agentModalCopy: { flex: 1, minWidth: 0 },
    agentModalKicker: { color: theme.textMuted, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.5, fontFamily: MONO_FONT },
    agentModalTitle: { color: theme.textPrimary, fontSize: 23, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
    agentModalCode: { fontSize: 11, fontWeight: "700", fontFamily: MONO_FONT, marginTop: 1 },
    agentModalClose: { width: 30, height: 30, borderRadius: 10, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    agentModalCloseText: { color: theme.textMuted, fontSize: 12, fontWeight: "800" },
    agentModalDesc: { color: theme.textSecondary, fontSize: 13, lineHeight: 21 },
    agentModalSection: { gap: 6 },
    agentModalSectionTitle: { color: theme.textMuted, fontSize: 9.5, fontWeight: "700", letterSpacing: 0.8, fontFamily: MONO_FONT },
    agentCodeBlock: { borderRadius: 10, borderWidth: 1, borderColor: theme.code.border, backgroundColor: theme.code.bg, paddingHorizontal: 12, paddingVertical: 10 },
    agentCodeText: { color: theme.code.text, fontSize: 10.5, lineHeight: 17, fontFamily: MONO_FONT },
    agentFlowRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    agentFlowStep: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, paddingHorizontal: 8, paddingVertical: 5 },
    agentFlowIndex: { fontSize: 8.5, fontWeight: "800", fontFamily: MONO_FONT },
    agentFlowText: { color: theme.textSecondary, fontSize: 10, maxWidth: 130 },
    agentFlowArrow: { color: theme.textMuted, fontSize: 11, fontFamily: MONO_FONT },

    scoringGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
    scoringCard: {
      flex: 1,
      minWidth: 240,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.borderDivider,
      backgroundColor: theme.bgElevated,
      padding: 18,
      gap: 6,
    },
    scoringTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
    scoringDesc: { color: theme.textSecondary, fontSize: 13.5, lineHeight: 22 },
  });
}
