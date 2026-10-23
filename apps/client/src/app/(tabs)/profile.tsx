import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { DEFAULT_ACHIEVEMENTS } from "../../components/achievement-badges";
import { ActivityHeatmap, KnowledgeConstellation } from "../../components/knowledge-constellation";
import { MiniIcon } from "../../components/mini-icon";
import { Reveal } from "../../components/scroll-reveal";
import { LoadingPanel, MONO_FONT, PageHeading, ThemedScreen, webOnly } from "../../components/theme-ui";
import { getMasteryHistory, type MasteryHistoryPoint } from "../../lib/api";
import { flashcardsForNode, quizzesForNode } from "../../lib/learning-content";
import { TOPOLOGY_NODES, mergePath, nodeById, type TopologyNode } from "../../lib/path-topology";
import { useApp } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";
import { useHydratedWidth } from "../../lib/use-hydrated-width";

type RetentionItem = {
  nodeId: string;
  nodeTitle: string;
  currentMastery: number;
  retentionScore: number;
  daysSinceLastPractice: number;
  needsReview: boolean;
};

const DIMENSIONS = [
  { label: "前置基础", value: 48 },
  { label: "知识掌握度", value: 56 },
  { label: "学习目标", value: 86 },
  { label: "学习偏好", value: 72 },
  { label: "可用时间", value: 68 },
  { label: "常见错误", value: 82 },
  { label: "资源偏好", value: 61 },
  { label: "进步趋势", value: 74 },
];

const DIMENSION_DETAIL: Record<string, { diagnosis: string; priorities: string[]; nodeId: string }> = {
  "前置基础": { diagnosis: "关系模型与键约束是后续 SQL、范式与索引的共同地基。先修断点会放大所有后续错误。", priorities: ["关系、元组与域", "候选键/主键/外键", "实体与参照完整性"], nodeId: "relations" },
  "知识掌握度": { diagnosis: "概念会背但迁移到真实查询时容易断链，建议用 SELECT/WHERE/NULL 的沙箱题验证。", priorities: ["SELECT 逻辑顺序", "WHERE 与 NULL", "ORDER BY 分页"], nodeId: "sql-select" },
  "学习目标": { diagnosis: "目标清晰度较高，保持以“能独立完成校园选课查询”为验收标准。", priorities: ["路径节点验收", "SQL 实战", "错因复盘"], nodeId: "nf-3bc" },
  "学习偏好": { diagnosis: "视觉优先与交互式练习更匹配，先用图解建立结构，再用练习固化。", priorities: ["知识图解", "交互推演", "闪卡复习"], nodeId: "keys-integrity" },
  "可用时间": { diagnosis: "碎片时间适合 8 分钟微课与 30 秒闪卡，避免一次塞入过多新概念。", priorities: ["30 秒闪卡", "单题快测", "单点复盘"], nodeId: "tx-acid" },
  "常见错误": { diagnosis: "错误模式较集中，建议用反例对比与错因标签建立“先检查边界”的习惯。", priorities: ["传递依赖反例", "NULL 陷阱", "外键孤儿记录"], nodeId: "redundancy-fd" },
  "资源偏好": { diagnosis: "偏好多模态资源，建议组合图解 + SQL 实操 + 闪卡形成闭环。", priorities: ["多模态资源", "SQL 实操", "复习卡片"], nodeId: "index-design" },
  "进步趋势": { diagnosis: "趋势总体向上，保持每次学习后完成一道快测，避免“看懂但不会用”。", priorities: ["BKT 快测", "错题回流", "路径推进"], nodeId: "tx-acid" },
};

const RESCUE_TARGETS = [
  { nodeId: "relations", fallbackRetention: 39 },
  { nodeId: "keys-integrity", fallbackRetention: 15 },
  { nodeId: "sql-select", fallbackRetention: 60 },
  { nodeId: "sql-view-cte", fallbackRetention: 71 },
];

const EVOLUTION_TOPICS = [
  { nodeId: "relations", trigger: "完成关系模型诊断 + 术语连线练习" },
  { nodeId: "keys-integrity", trigger: "候选键/主键辨析 8 题 + 外键反例复盘" },
  { nodeId: "sql-select", trigger: "SQL 沙箱三表联查 + WHERE/NULL 修复" },
  { nodeId: "sql-aggregate", trigger: "GROUP BY/HAVING 实验 + 2 道错因题" },
  { nodeId: "nf-3bc", trigger: "闭包推导 3NF/BCNF + 选课表反例" },
  { nodeId: "index-design", trigger: "复合索引 EXPLAIN + 覆盖索引验证" },
  { nodeId: "tx-acid", trigger: "ACID 闪卡 + 事务边界快测" },
];

const BADGE_PROGRESS: Record<string, { current: number; target: number }> = {
  "badge-multi-join": { current: 2, target: 3 },
  "badge-subquery": { current: 1, target: 2 },
  "badge-window-func": { current: 0, target: 1 },
  "badge-bkt-leap": { current: 0, target: 1 },
  "badge-normal-form": { current: 1, target: 2 },
};

const PERSONA_LABELS: Record<string, string> = { foundation: "基础补齐", exam: "应试巩固", practice: "实践进阶" };
const PERSONA_GLYPHS: Record<string, string> = { foundation: "基", exam: "考", practice: "践" };

const FALLBACK_RETENTION: RetentionItem[] = RESCUE_TARGETS.map((target, index) => ({
  ...target,
  nodeTitle: nodeById(TOPOLOGY_NODES, target.nodeId)?.title ?? target.nodeId,
  currentMastery: nodeById(TOPOLOGY_NODES, target.nodeId)?.mastery ?? 50,
  retentionScore: [39, 15, 60, 71][index] ?? 50,
  daysSinceLastPractice: [4, 3, 2, 1][index] ?? 2,
  needsReview: true,
}));

function formatDate(timestamp: number) {
  const date = new Date(timestamp);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function normalizeHistory(points: MasteryHistoryPoint[]): MasteryHistoryPoint[] {
  const sorted = [...points].sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
  const recent = sorted.slice(-7);
  if (recent.length === 0) return [];
  const latest = new Date(recent[recent.length - 1]!.timestamp).getTime();
  return recent.map((point, index) => ({
    ...point,
    date: formatDate(latest - (recent.length - 1 - index) * 86_400_000),
  }));
}

function buildFallbackHistory(): MasteryHistoryPoint[] {
  const now = Date.now();
  const values = [42, 48, 55, 61, 68, 74, 88];
  const deltas = [0, 6, 7, 6, 7, 6, 14];
  return values.map((mastery, index) => ({
    date: formatDate(now - (6 - index) * 86_400_000),
    timestamp: new Date(now - (6 - index) * 86_400_000).toISOString(),
    mastery,
    nodeId: EVOLUTION_TOPICS[index]!.nodeId,
    nodeTitle: nodeById(TOPOLOGY_NODES, EVOLUTION_TOPICS[index]!.nodeId)?.title ?? "SQL 核心",
    delta: deltas[index]!,
  }));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => setReduced(query.matches);
      const frame = requestAnimationFrame(apply);
      query.addEventListener?.("change", apply);
      return () => {
        cancelAnimationFrame(frame);
        query.removeEventListener?.("change", apply);
      };
    }
    return;
  }, []);
  return reduced;
}

function useCountUp(target: number, reduced: boolean, duration = 700) {
  const [value, setValue] = useState(reduced ? target : 0);
  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reduced]);
  return reduced ? target : value;
}

function useRevealFlag(reduced: boolean) {
  const [visible, setVisible] = useState(reduced);
  useEffect(() => {
    if (reduced) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [reduced]);
  return reduced || visible;
}

function RetentionCurve({ scores }: { scores: number[] }) {
  const { theme } = useTheme();
  const styles = useProfileStyles();
  if (Platform.OS !== "web") return <View style={styles.curveFallback}>{scores.map((score, index) => <View key={index} style={[styles.curveFallbackBar, { height: `${Math.max(18, score)}%` as `${number}%`, backgroundColor: score < 60 ? theme.warning : theme.success }]} />)}</View>;
  const points = [100, 82, 67, 55, ...scores].slice(-6);
  const coords = points.map((value, index) => `${18 + index * 59},${18 + (100 - value) * 0.72}`).join(" ");
  const thresholdY = 18 + (100 - 60) * 0.72;
  return <View style={styles.curveWrap}>
    <svg viewBox="0 0 360 110" style={{ width: "100%", height: 104 }} aria-hidden>
      <defs>
        <linearGradient id="retention-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.accentPrimary} stopOpacity="0.25" />
          <stop offset="100%" stopColor={theme.accentPrimary} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="16" y1={thresholdY} x2="344" y2={thresholdY} stroke={theme.warning} strokeWidth="1" strokeDasharray="5 5" opacity="0.7" />
      <path d={`M ${coords.replaceAll(" ", " L ")}`} fill="none" stroke={theme.accentPrimary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M ${coords.replaceAll(" ", " L ")} L 336 100 L 18 100 Z`} fill="url(#retention-fill)" />
      {points.map((value, index) => <circle key={index} cx={18 + index * 59} cy={18 + (100 - value) * 0.72} r="3.5" fill={value < 60 ? theme.warning : theme.accentPrimary} stroke={theme.bgSurface} strokeWidth="1.5" />)}
    </svg>
    <View style={styles.curveLabels}><Text style={[styles.curveLabel, { color: theme.textMuted }]}>100%</Text><Text style={[styles.curveThreshold, { color: theme.warning }]}>60% 安全留存线</Text><Text style={[styles.curveLabel, { color: theme.textMuted }]}>0%</Text></View>
  </View>;
}

function RescueQuiz({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useProfileStyles();
  const quiz = quizzesForNode(node)[0]!;
  const [choice, setChoice] = useState<number | null>(null);
  const correct = choice === quiz.correct;
  return <View style={[styles.quizCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
    <View style={styles.quizHead}><Text style={[styles.quizKicker, { color: theme.accentPrimary }]}>10 秒唤醒题</Text><Text style={[styles.quizMeta, { color: theme.textMuted }]}>先作答，再复习</Text></View>
    <Text style={[styles.quizQuestion, { color: theme.textPrimary }]}>{quiz.question}</Text>
    <View style={styles.quizOptions}>{quiz.options.map((option, index) => {
      const isCorrect = index === quiz.correct;
      const chosen = choice === index;
      const state = choice === null ? "idle" : isCorrect ? "correct" : chosen ? "wrong" : "muted";
      return <Pressable key={option} accessibilityRole="button" accessibilityLabel={`${String.fromCharCode(65 + index)}：${option}`} accessibilityState={{ selected: chosen }} onPress={() => setChoice(index)} disabled={choice !== null} style={({ pressed }) => [styles.quizOption, { borderColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.borderSubtle, backgroundColor: state === "correct" ? theme.successSoft : state === "wrong" ? theme.warningSoft : theme.bgElevated }, pressed && styles.pressed]}>
        <Text style={[styles.quizMark, { color: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.textMuted }]}>{state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + index)}</Text>
        <Text style={[styles.quizOptionText, { color: theme.textPrimary }]}>{option}</Text>
      </Pressable>;
    })}</View>
    {choice !== null ? <Text style={[styles.quizExplanation, { color: correct ? theme.success : theme.warning }]}>{correct ? "✓ " : "✕ "}{quiz.explanation}</Text> : null}
  </View>;
}

function rescuePointsFor(node: TopologyNode): string[] {
  if (node.id === "keys-integrity") return [
    "超键 ⊃ 候选键 ⊃ 主键；主键是从候选键中选定的最小唯一标识。",
    "实体完整性：主属性绝不能为 NULL，否则无法唯一标识元组。",
    "参照完整性：外键要么为 NULL，要么等于被参照表中已存在的主键值。",
  ];
  return flashcardsForNode(node).slice(0, 3).map((card) => card.back);
}

const profileStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();
function useProfileStyles() {
  const { mode, theme } = useTheme();
  if (!profileStyleCache.has(mode)) profileStyleCache.set(mode, createStyles(theme));
  return profileStyleCache.get(mode)!;
}

export default function ProfileScreen() {
  const { theme } = useTheme();
  const styles = useProfileStyles();
  const width = useHydratedWidth();
  const isDesktop = width >= 960;
  const { currentUser, path, demoUsers, switchUser, logout } = useApp();
  const reducedMotion = useReducedMotion();
  const reveal = useRevealFlag(reducedMotion);
  const nodes = useMemo(() => mergePath(TOPOLOGY_NODES, path), [path]);
  const [historyPoints, setHistoryPoints] = useState<MasteryHistoryPoint[]>([]);
  const [retentionItems, setRetentionItems] = useState<RetentionItem[]>(FALLBACK_RETENTION);
  const [overallMastery, setOverallMastery] = useState(56);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [selectedEvolution, setSelectedEvolution] = useState<number | null>(null);
  const [selectedDimension, setSelectedDimension] = useState("前置基础");
  const [selectedBadgeId, setSelectedBadgeId] = useState(DEFAULT_ACHIEVEMENTS[0]!.id);
  const [selectedRescue, setSelectedRescue] = useState("relations");
  const [rescued, setRescued] = useState<Set<string>>(() => new Set());
  const [showMastered, setShowMastered] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let active = true;
    void getMasteryHistory(currentUser.id)
      .then((data) => {
        if (!active) return;
        const normalized = normalizeHistory(data.history);
        setHistoryPoints(normalized.length > 0 ? normalized : buildFallbackHistory());
        setRetentionItems(data.retention && data.retention.length > 0 ? data.retention : FALLBACK_RETENTION);
        if (data.overallMastery) setOverallMastery(data.overallMastery);
      })
      .catch(() => {
        if (!active) return;
        setHistoryPoints(buildFallbackHistory());
        setRetentionItems(FALLBACK_RETENTION);
      })
      .finally(() => { if (active) setHistoryLoading(false); });
    return () => { active = false; };
  }, [currentUser]);

  const displayHistory = useMemo(() => normalizeHistory(historyPoints).map((point, index) => {
    const topic = EVOLUTION_TOPICS[index % EVOLUTION_TOPICS.length]!;
    const node = nodeById(nodes, topic.nodeId) ?? nodeById(TOPOLOGY_NODES, topic.nodeId);
    return { ...point, nodeId: node?.id ?? topic.nodeId, nodeTitle: node?.title ?? point.nodeTitle, trigger: topic.trigger, law: node ? flashcardsForNode(node)[0]!.back : point.nodeTitle };
  }), [historyPoints, nodes]);

  const allBadges = useMemo(() => DEFAULT_ACHIEVEMENTS.map((badge) => ({
    ...badge,
    unlocked: badge.unlocked || ["初探八表", "语法零失误", "12 智能体全链路", "BKT 跃升者"].includes(badge.title),
  })), []);
  const unlockedCount = allBadges.filter((badge) => badge.unlocked).length;
  const selectedBadge = allBadges.find((badge) => badge.id === selectedBadgeId) ?? allBadges[0]!;

  const masteredNodes = nodes.filter((node) => node.mastery >= 80);
  const masteredStreamNodes = useMemo(() => {
    const sorted = [...masteredNodes].sort((left, right) => right.mastery - left.mastery);
    const picks = sorted.slice(0, 5);
    if (picks.length >= 5) return picks;
    const seen = new Set(picks.map((node) => node.id));
    const fallback = [...nodes].sort((left, right) => right.mastery - left.mastery).filter((node) => !seen.has(node.id));
    return [...picks, ...fallback].slice(0, 5);
  }, [masteredNodes, nodes]);
  const warningCount = Math.max(RESCUE_TARGETS.length, retentionItems.filter((item) => item.needsReview).length);
  const masteredCount = useCountUp(masteredNodes.length, reducedMotion);
  const warningCountUp = useCountUp(warningCount, reducedMotion);
  const unlockedCountUp = useCountUp(unlockedCount, reducedMotion);

  if (!currentUser) {
    return <ThemedScreen>
      <LoadingPanel title="正在加载学习画像…" detail="正在同步掌握度、成就与诊断记录。" />
    </ThemedScreen>;
  }

  const activeEvolutionIndex = selectedEvolution !== null && selectedEvolution < displayHistory.length ? selectedEvolution : Math.max(0, displayHistory.length - 1);
  const evolutionPoint = displayHistory[activeEvolutionIndex] ?? displayHistory[displayHistory.length - 1];
  const latestDelta = [...displayHistory].reverse().find((point) => point.delta > 0)?.delta ?? 0;
  const pathProgress = path.length > 0 ? Math.round(path.reduce((sum, item) => sum + item.mastery, 0) / path.length) : overallMastery;
  const selectedDimensionInfo = DIMENSIONS.find((item) => item.label === selectedDimension) ?? DIMENSIONS[0]!;
  const dimensionDetail = DIMENSION_DETAIL[selectedDimensionInfo.label] ?? DIMENSION_DETAIL["前置基础"]!;
  const dimensionNode = nodeById(nodes, dimensionDetail.nodeId) ?? nodes[0]!;
  const rescueCards = RESCUE_TARGETS.map((target, index) => {
    const node = nodeById(nodes, target.nodeId) ?? nodeById(TOPOLOGY_NODES, target.nodeId);
    const apiItem = retentionItems.find((item) => item.nodeId === node?.apiNodeId || item.nodeId === node?.id || item.nodeTitle === node?.title);
    const isRescued = node ? rescued.has(node.id) : false;
    return { node, target, isRescued, retentionScore: isRescued ? 95 : apiItem?.retentionScore ?? target.fallbackRetention, days: apiItem?.daysSinceLastPractice ?? [4, 3, 2, 1][index]!, mastery: node?.mastery ?? apiItem?.currentMastery ?? 50 };
  }).filter((item): item is { node: TopologyNode; target: typeof RESCUE_TARGETS[number]; isRescued: boolean; retentionScore: number; days: number; mastery: number } => Boolean(item.node));
  const activeRescue = rescueCards.find((item) => item.node.id === selectedRescue) ?? rescueCards[0];

  const switchIdentity = async (persona: string) => {
    const target = demoUsers.find((user) => user.persona === persona);
    if (!target || target.id === currentUser.id) return;
    setSwitching(persona);
    setHistoryLoading(true);
    try { await switchUser(target.id); } finally { setSwitching(null); }
  };
  const cycleIdentity = () => {
    const currentIndex = demoUsers.findIndex((user) => user.id === currentUser.id);
    const next = demoUsers[(currentIndex + 1) % demoUsers.length];
    if (next) void switchIdentity(next.persona);
  };
  const exit = async () => { await logout(); router.replace("/" as never); };

  if (historyLoading && historyPoints.length === 0) {
    return <ThemedScreen>
      <PageHeading title="我的学习画像" subtitle="画像由对话、诊断与沙箱评估证据持续动态更新" />
      <LoadingPanel title="正在加载学习画像…" detail="正在同步 BKT 趋势、记忆留存与成就记录。" />
    </ThemedScreen>;
  }

  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading title="我的学习画像" subtitle="可当场复习、可回溯证据的认知成长工作台" />

    <Reveal index={0}>
      <View style={[styles.passport, { borderColor: theme.borderSubtle, backgroundColor: theme.bgGlass }, webOnly({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" })]}>
        <View style={styles.passportTop}>
          <View style={styles.passportIdentity}>
            <View style={[styles.avatar, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
              <Text style={[styles.avatarText, { color: theme.accentPrimary }]}>{PERSONA_GLYPHS[currentUser.persona] ?? "学"}</Text>
            </View>
            <View style={styles.passportCopy}>
              <Text style={[styles.passportKicker, { color: theme.accentHover }]}>LEARNER PASSPORT · {PERSONA_LABELS[currentUser.persona]}</Text>
              <Text style={[styles.passportName, { color: theme.textPrimary }]}>{currentUser.displayName}</Text>
              <Text style={[styles.passportGoal, { color: theme.textSecondary }]}>{currentUser.goal}</Text>
            </View>
          </View>
          <View style={styles.passportStats}>
            <View style={[styles.passportStat, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.passportStatValue, { color: theme.accentPrimary }]}>+{latestDelta}%</Text><Text style={[styles.passportStatLabel, { color: theme.textSecondary }]}>BKT 跃迁</Text></View>
            <View style={[styles.passportStat, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}><Text style={[styles.passportStatValue, { color: theme.success }]}>{pathProgress}%</Text><Text style={[styles.passportStatLabel, { color: theme.textSecondary }]}>路径推进</Text></View>
            <View style={[styles.passportStat, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}><Text style={[styles.passportStatValue, { color: theme.textPrimary }]}>{overallMastery}%</Text><Text style={[styles.passportStatLabel, { color: theme.textSecondary }]}>综合掌握</Text></View>
          </View>
        </View>

        <View accessibilityRole="tablist" accessibilityLabel="切换演示身份" style={styles.roleTabs}>
          {(["foundation", "exam", "practice"] as const).map((persona) => {
            const active = currentUser.persona === persona;
            return <Pressable key={persona} accessibilityRole="tab" accessibilityState={{ selected: active, busy: switching === persona }} aria-selected={active} disabled={Boolean(switching)} onPress={() => void switchIdentity(persona)} style={({ pressed }) => [styles.roleTab, { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : theme.bgSurface }, pressed && styles.pressed, Boolean(switching) && styles.disabled]}>
              {switching === persona ? <ActivityIndicator size="small" color={theme.accentPrimary} /> : <View style={[styles.roleDot, { backgroundColor: active ? theme.accentPrimary : theme.textMuted }]} />}
              <Text style={[styles.roleText, { color: active ? theme.accentPrimary : theme.textSecondary }]}>{PERSONA_LABELS[persona]}</Text>
            </Pressable>;
          })}
        </View>

        <View style={styles.masteryStrip}>
          <Pressable accessibilityRole="button" accessibilityLabel="查看已掌握知识要点清单" onPress={() => setShowMastered((value) => !value)} style={({ pressed }) => [styles.masteryEntry, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }, pressed && styles.pressed]}>
            <View style={styles.masteryEntryTop}><Text style={[styles.masteryEntryKicker, { color: theme.textMuted }]}>累计已掌握知识要点</Text><Text style={[styles.masteryEntryToggle, { color: theme.accentPrimary }]}>{showMastered ? "收起 ⌃" : "查看清单 ⌄"}</Text></View>
            <View style={styles.masteryCounts}>
              <View><Text style={[styles.masteryCountValue, { color: theme.success }]}>{masteredCount}</Text><Text style={[styles.masteryCountLabel, { color: theme.textSecondary }]}>已攻克概念</Text></View>
              <View><Text style={[styles.masteryCountValue, { color: theme.warning }]}>{warningCountUp}</Text><Text style={[styles.masteryCountLabel, { color: theme.textSecondary }]}>待加固预警</Text></View>
              <View><Text style={[styles.masteryCountValue, { color: theme.accentPrimary }]}>{unlockedCountUp}</Text><Text style={[styles.masteryCountLabel, { color: theme.textSecondary }]}>已解锁勋章</Text></View>
            </View>
          </Pressable>
          <View style={[styles.masteredStream, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
            <View style={styles.masteredStreamHead}>
              <Text style={[styles.masteredStreamTitle, { color: theme.textPrimary }]}>最近已攻克的核心概念</Text>
              <Text style={[styles.masteredStreamMeta, { color: theme.textMuted }]}>掌握度 TOP {masteredStreamNodes.length}</Text>
            </View>
            <View style={styles.masteredStreamChips}>
              {masteredStreamNodes.map((node) => <View key={node.id} style={[styles.masteredStreamChip, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}>
                <Text numberOfLines={1} style={[styles.masteredStreamChipText, { color: theme.success }]}>✓ {node.title} {node.mastery}%</Text>
              </View>)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="展开全部知识清单" accessibilityState={{ expanded: showMastered }} onPress={() => setShowMastered((value) => !value)} style={({ pressed }) => [styles.masteredStreamToggle, { borderColor: theme.accentSoftBorder }, pressed && styles.pressed]}>
              <Text style={[styles.masteredStreamToggleText, { color: theme.accentPrimary }]}>展开全部知识清单 {showMastered ? "⌃" : "▾"}</Text>
            </Pressable>
          </View>
          {showMastered ? <View style={styles.masteredList}>{masteredNodes.slice(0, 10).map((node) => <View key={node.id} style={[styles.masteredChip, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}><Text style={[styles.masteredChipText, { color: theme.success }]}>{node.title} {node.mastery}%</Text></View>)}</View> : null}
        </View>
      </View>
    </Reveal>

    <Reveal index={1}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}>
          <View style={{ minWidth: 0, flexShrink: 1 }}>
            <Text style={[styles.sectionKicker, { color: theme.accentHover }]}>KNOWLEDGE CONSTELLATION · ACTIVITY RECAP</Text>
            <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>知识拓扑星图 & 学习活跃度复盘</Text>
          </View>
          <View style={[styles.sectionPill, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}><Text style={[styles.sectionPillText, { color: theme.agent }]}>Obsidian × GitHub</Text></View>
        </View>
        <View style={[styles.recapSplit, isDesktop && styles.recapSplitWide]}>
          <View style={[styles.recapPane, isDesktop && { flex: 55 }, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
            <KnowledgeConstellation nodes={nodes} onOpenNode={(id) => router.push({ pathname: "/(tabs)/path", params: { nodeId: id } } as never)} />
          </View>
          <View style={[styles.recapPane, isDesktop && { flex: 45 }, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
            <ActivityHeatmap nodes={nodes} />
          </View>
        </View>
      </View>
    </Reveal>

    <Reveal index={2}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}><View><Text style={[styles.sectionKicker, { color: theme.accentHover }]}>BKT EVOLUTION · 7-DAY TRACE</Text><Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>掌握度演进趋势</Text></View><View style={[styles.sectionPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.sectionPillText, { color: theme.accentPrimary }]}>当前综合 {overallMastery}%</Text></View></View>
        <View style={[styles.evolutionSplit, isDesktop && styles.evolutionSplitWide]}>
          <View style={[styles.chartCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
            <View style={styles.chartGrid}>{["100%", "75%", "50%", "25%"].map((label) => <View key={label} style={[styles.gridRow, { borderColor: theme.borderDivider }]}><Text style={[styles.gridLabel, { color: theme.textMuted }]}>{label}</Text></View>)}</View>
            <View style={styles.barsRow}>
              {displayHistory.map((point, index) => {
                const active = index === activeEvolutionIndex;
                return <Pressable key={`${point.date}-${index}`} accessibilityRole="button" accessibilityLabel={`${point.date}，掌握度 ${point.mastery}%，跃迁 ${point.delta}%`} accessibilityState={{ selected: active }} onPress={() => setSelectedEvolution(index)} onHoverIn={() => setSelectedEvolution(index)} style={({ pressed }) => [styles.barColumn, active && styles.barColumnActive, pressed && styles.pressed]}>
                  {point.delta > 0 ? <Text style={[styles.deltaText, { color: active ? theme.accentPrimary : theme.success }]}>+{point.delta}</Text> : <View style={styles.deltaSpacer} />}
                  <View style={[styles.barTrack, { backgroundColor: theme.bgElevated, borderColor: active ? theme.accentPrimary : theme.borderSubtle }]}>
                    <View style={[styles.barFill, { height: `${reveal ? point.mastery : 0}%` as `${number}%`, backgroundColor: active ? theme.accentPrimary : theme.accentSoftBorder }, webOnly({ backgroundImage: active ? `linear-gradient(180deg, ${theme.accentGradientFrom}, ${theme.accentPrimary})` : undefined })]} />
                  </View>
                  <Text style={[styles.barValue, { color: active ? theme.accentPrimary : theme.textSecondary }]}>{point.mastery}%</Text>
                  <Text style={[styles.barDate, { color: active ? theme.accentPrimary : theme.textMuted }]}>{point.date}</Text>
                </Pressable>;
              })}
            </View>
            <Text style={[styles.chartHint, { color: theme.textMuted }]}>点击任意柱子查看当天真正学会的知识点</Text>
          </View>

          <View style={[styles.evolutionInspector, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
            {evolutionPoint ? <>
              <View style={styles.inspectorTop}><Text style={[styles.inspectorKicker, { color: theme.accentPrimary }]}>EVOLUTION INSPECTOR</Text><Text style={[styles.inspectorDate, { color: theme.textMuted }]}>{evolutionPoint.date}</Text></View>
              <Text style={[styles.inspectorNode, { color: theme.textPrimary }]}>{evolutionPoint.nodeTitle}</Text>
              <View style={styles.inspectorMetrics}><View><Text style={[styles.inspectorMetric, { color: theme.accentPrimary }]}>{evolutionPoint.mastery}%</Text><Text style={[styles.inspectorLabel, { color: theme.textMuted }]}>当日掌握</Text></View><View><Text style={[styles.inspectorMetric, { color: theme.success }]}>+{evolutionPoint.delta}%</Text><Text style={[styles.inspectorLabel, { color: theme.textMuted }]}>跃迁</Text></View></View>
              <View style={[styles.inspectorLine, { borderColor: theme.borderDivider }]}><Text style={[styles.inspectorLineLabel, { color: theme.textMuted }]}>触发事件</Text><Text style={[styles.inspectorLineText, { color: theme.textSecondary }]}>{evolutionPoint.trigger}</Text></View>
              <View style={[styles.inspectorLaw, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.inspectorLawKicker, { color: theme.accentPrimary }]}>当日核心定律</Text><Text style={[styles.inspectorLawText, { color: theme.textPrimary }]}>{evolutionPoint.law}</Text></View>
            </> : <Text style={[styles.emptyText, { color: theme.textMuted }]}>完成一次 SQL 沙箱实验后，这里会出现当日的知识跃迁复盘。</Text>}
          </View>
        </View>
      </View>
    </Reveal>

    <Reveal index={3}>
      <View style={styles.sectionCard}>
        <View style={styles.sectionTitleRow}><View><Text style={[styles.sectionKicker, { color: theme.warning }]}>MEMORY RESCUE · EBBINGHAUS</Text><Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>艾宾浩斯记忆急救站</Text></View><View style={[styles.sectionPill, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}><Text style={[styles.sectionPillText, { color: theme.warning }]}>{warningCount} 个今日预警</Text></View></View>
        <View style={[styles.retentionLayout, isDesktop && styles.retentionLayoutWide]}>
          <View style={[styles.curveCard, isDesktop && styles.curveCardWide, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
            <View style={styles.curveHead}><Text style={[styles.curveTitle, { color: theme.textPrimary }]}>记忆留存率随 Δt 衰减</Text><Text style={[styles.curveMeta, { color: theme.textMuted }]}>阈值 60%</Text></View>
            <RetentionCurve scores={rescueCards.map((card) => card.retentionScore)} />
          </View>
          <View style={[styles.rescueGrid, isDesktop && styles.rescueGridWide]}>
            {rescueCards.map((card) => {
              const active = activeRescue?.node.id === card.node.id;
              return <Pressable key={card.node.id} accessibilityRole="button" accessibilityLabel={`${card.node.title}，留存 ${card.retentionScore}%，点击展开记忆急救`} accessibilityState={{ selected: active }} onPress={() => setSelectedRescue(card.node.id)} style={({ pressed }) => [styles.rescueCard, { backgroundColor: card.isRescued ? theme.successSoft : active ? theme.accentSoft : theme.bgSurface, borderColor: card.isRescued ? `${theme.success}55` : active ? theme.accentSoftBorder : theme.borderSubtle }, pressed && styles.pressed]}>
                <View style={styles.rescueTop}><Text style={[styles.rescueTitle, { color: theme.textPrimary }]} numberOfLines={1}>{card.node.title}</Text><View style={[styles.rescueBadge, { backgroundColor: card.isRescued ? theme.successSoft : theme.warningSoft, borderColor: card.isRescued ? `${theme.success}44` : `${theme.warning}44` }]}><Text style={[styles.rescueBadgeText, { color: card.isRescued ? theme.success : theme.warning }]}>{card.isRescued ? "已加固 ✓" : "今日需复习"}</Text></View></View>
                <View style={styles.rescueStats}><Text style={[styles.rescueMeta, { color: theme.textMuted }]}>掌握 {card.mastery}%</Text><Text style={[styles.rescueScore, { color: card.isRescued ? theme.success : theme.warning }]}>留存 {card.retentionScore}%</Text><Text style={[styles.rescueMeta, { color: theme.textMuted }]}>Δt {card.days} 天</Text></View>
                <View style={styles.rescueBar}><View style={[styles.rescueBarFill, { width: `${card.retentionScore}%`, backgroundColor: card.isRescued ? theme.success : theme.warning }, webOnly({ transitionProperty: "width", transitionDuration: "700ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" })]} /></View>
              </Pressable>;
            })}
          </View>
        </View>

        {activeRescue ? <View key={activeRescue.node.id} style={[styles.rescuePod, { borderColor: activeRescue.isRescued ? `${theme.success}44` : theme.accentSoftBorder, backgroundColor: activeRescue.isRescued ? theme.successSoft : theme.bgElevated }]}>
          <View style={styles.rescuePodHead}><View><Text style={[styles.rescuePodKicker, { color: activeRescue.isRescued ? theme.success : theme.accentPrimary }]}>⚡ 30 秒靶向记忆急救舱</Text><Text style={[styles.rescuePodTitle, { color: theme.textPrimary }]}>{activeRescue.node.title}</Text></View><Text style={[styles.rescuePodScore, { color: activeRescue.isRescued ? theme.success : theme.warning }]}>{activeRescue.retentionScore}%</Text></View>
          <View style={[styles.rescuePodBody, isDesktop && styles.rescuePodBodyWide]}>
            <View style={styles.rescuePointsColumn}>
              <Text style={[styles.rescueColumnKicker, { color: theme.textMuted }]}>3 条必背核心考点</Text>
              <View style={styles.pointsColumn}>{rescuePointsFor(activeRescue.node).map((text, index) => <View key={text} style={[styles.pointCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}><View style={[styles.pointIndex, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.pointIndexText, { color: theme.accentPrimary }]}>{String(index + 1).padStart(2, "0")}</Text></View><Text style={[styles.pointText, { color: theme.textSecondary }]}>{text}</Text></View>)}</View>
            </View>
            <View style={styles.rescueQuizColumn}>
              <RescueQuiz key={activeRescue.node.id} node={activeRescue.node} />
              <Pressable accessibilityRole="button" accessibilityLabel={activeRescue.isRescued ? "今日已加固" : "完成30秒复习并刷新记忆留存率"} disabled={activeRescue.isRescued} onPress={() => setRescued((current) => new Set(current).add(activeRescue.node.id))} style={({ pressed }) => [styles.rescueAction, { backgroundColor: activeRescue.isRescued ? theme.success : theme.accentPrimary }, pressed && !activeRescue.isRescued && styles.pressed]}>
                <Text style={[styles.rescueActionText, { color: activeRescue.isRescued ? (theme.isDark ? "#06201C" : "#FFFFFF") : theme.onAccent }]}>{activeRescue.isRescued ? "✓ 今日已加固 · 留存率已刷新至 95%" : "✨ 完成 30 秒复习 · 立即刷新留存率"}</Text>
              </Pressable>
            </View>
          </View>
        </View> : null}
      </View>
    </Reveal>

    <View style={[styles.bottomSplit, isDesktop && styles.bottomSplitWide]}>
      <Reveal index={4} style={styles.bottomColumn}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}><View><Text style={[styles.sectionKicker, { color: theme.accentHover }]}>EIGHT-DIMENSION DIAGNOSIS</Text><Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>八维画像诊断处方</Text></View><Text style={[styles.sectionMeta, { color: theme.textMuted }]}>点击维度查看处方</Text></View>
          <View style={styles.dimensionGrid}>{DIMENSIONS.map((item, index) => {
            const active = selectedDimension === item.label;
            const isWeak = item.value < 60;
            const color = isWeak ? theme.warning : item.value >= 75 ? theme.success : theme.accentPrimary;
            return <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} ${item.value} 分，点击查看诊断处方`} accessibilityState={{ selected: active }} onPress={() => setSelectedDimension(item.label)} style={({ pressed }) => [styles.dimensionCard, { backgroundColor: active ? theme.accentSoft : theme.bgElevated, borderColor: active ? theme.accentSoftBorder : theme.borderSubtle }, pressed && styles.pressed]}>
              <View style={styles.dimensionHead}><Text style={[styles.dimensionIndex, { color: theme.textMuted }]}>{String(index + 1).padStart(2, "0")}</Text><Text style={[styles.dimensionLabel, { color: theme.textSecondary }]} numberOfLines={1}>{item.label}</Text><Text style={[styles.dimensionValue, { color }]}>{item.value}</Text></View>
              <View style={styles.dimensionTrack}><View style={[styles.dimensionFill, { width: `${reveal ? item.value : 0}%`, backgroundColor: color }, webOnly({ transitionProperty: "width", transitionDuration: "850ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" })]} /><View style={[styles.dimensionMarker, { backgroundColor: theme.textMuted }]} /></View>
            </Pressable>;
          })}</View>
          <View style={[styles.dimensionDetail, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
            <View style={styles.dimensionDetailHead}><View><Text style={[styles.detailKicker, { color: theme.accentPrimary }]}>处方 · {selectedDimensionInfo.label}</Text><Text style={[styles.detailTitle, { color: theme.textPrimary }]}>{selectedDimensionInfo.value < 60 ? "先补断点，再推进" : selectedDimensionInfo.value >= 75 ? "保持优势并迁移" : "用练习完成固化"}</Text></View><Text style={[styles.detailValue, { color: selectedDimensionInfo.value < 60 ? theme.warning : theme.success }]}>{selectedDimensionInfo.value}</Text></View>
            <Text style={[styles.detailBody, { color: theme.textSecondary }]}>{dimensionDetail.diagnosis}</Text>
            <View style={styles.priorityRow}>{dimensionDetail.priorities.map((item) => <View key={item} style={[styles.priorityChip, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}><Text style={[styles.priorityText, { color: theme.textSecondary }]}>{item}</Text></View>)}</View>
            <Pressable accessibilityRole="button" accessibilityLabel="一键前往突破节点" onPress={() => router.push({ pathname: "/(tabs)/path", params: { nodeId: dimensionNode.id } } as never)} style={({ pressed }) => [styles.detailAction, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed]}><Text style={[styles.detailActionText, { color: theme.onAccent }]}>前往「{dimensionNode.title}」突破 →</Text></Pressable>
          </View>
        </View>
      </Reveal>

      <Reveal index={5} style={styles.bottomColumn}>
        <View style={styles.sectionCard}>
          <View style={styles.sectionTitleRow}><View><Text style={[styles.sectionKicker, { color: theme.warning }]}>ACHIEVEMENT MUSEUM</Text><Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>成就激励勋章馆</Text></View><View style={[styles.sectionPill, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}><Text style={[styles.sectionPillText, { color: theme.warning }]}>{unlockedCount} / {allBadges.length} 解锁</Text></View></View>
          <View style={styles.badgeGrid}>{allBadges.map((badge) => {
            const active = selectedBadge.id === badge.id;
            const progress = BADGE_PROGRESS[badge.id];
            return <Pressable key={badge.id} accessibilityRole="button" accessibilityLabel={`${badge.title}，${badge.unlocked ? "已解锁" : `未解锁，进度 ${progress?.current ?? 0}/${progress?.target ?? 1}`}`} accessibilityState={{ selected: active }} onPress={() => setSelectedBadgeId(badge.id)} style={({ pressed }) => [styles.badgeCard, { backgroundColor: active ? theme.accentSoft : badge.unlocked ? theme.warningSoft : theme.bgElevated, borderColor: active ? theme.accentSoftBorder : badge.unlocked ? `${theme.warning}44` : theme.borderSubtle }, pressed && styles.pressed]}>
              {badge.unlocked ? <View pointerEvents="none" style={[styles.badgeSheen, webOnly({ backgroundImage: "linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.35) 50%, transparent 75%)" })]} /> : null}
              <View style={[styles.badgeIcon, { backgroundColor: badge.unlocked ? theme.bgSurface : theme.bgSurface, borderColor: badge.unlocked ? `${theme.warning}33` : theme.borderDivider }]}><Text style={[styles.badgeGlyph, badge.unlocked ? undefined : styles.badgeGlyphLocked]}>{badge.icon}</Text></View>
              <Text style={[styles.badgeTitle, { color: badge.unlocked ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>{badge.title}</Text>
              <Text style={[styles.badgeCategory, { color: theme.textMuted }]}>{badge.category}</Text>
              {badge.unlocked ? <Text style={[styles.badgeStatus, { color: theme.success }]}>已解锁</Text> : <><Text style={[styles.badgeStatus, { color: theme.textMuted }]}>未解锁 · 进度 {progress?.current ?? 0}/{progress?.target ?? 1}</Text><View style={styles.badgeProgress}><View style={[styles.badgeProgressFill, { width: `${Math.round(((progress?.current ?? 0) / (progress?.target ?? 1)) * 100)}%`, backgroundColor: theme.accentPrimary }]} /></View></>}
            </Pressable>;
          })}</View>
          <View style={[styles.badgeDetail, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
            <View style={styles.badgeDetailTop}><Text style={styles.badgeDetailIcon}>{selectedBadge.icon}</Text><View style={styles.badgeDetailCopy}><Text style={[styles.badgeDetailTitle, { color: theme.textPrimary }]}>{selectedBadge.title}</Text><Text style={[styles.badgeDetailMeta, { color: selectedBadge.unlocked ? theme.success : theme.warning }]}>{selectedBadge.unlocked ? `已解锁 · ${selectedBadge.unlockedAt ?? "近期"}` : "未解锁 · 继续积累证据"}</Text></View></View>
            <Text style={[styles.badgeDetailBody, { color: theme.textSecondary }]}>{selectedBadge.description}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={selectedBadge.unlocked ? "去 SQL 实验室继续练习" : "去 SQL 实验室达成徽章"} onPress={() => router.push("/sql-lab" as never)} style={({ pressed }) => [styles.badgeDetailAction, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}><Text style={[styles.badgeDetailActionText, { color: theme.accentPrimary }]}>{selectedBadge.unlocked ? "去实验室继续练习 →" : "去 SQL 实验室达成 →"}</Text></Pressable>
          </View>
        </View>
      </Reveal>
    </View>

    <Reveal index={6}>
      <View style={[styles.systemBar, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
        <View style={styles.systemCopy}><View style={styles.systemTitleRow}><MiniIcon name="shield" size={13} color={theme.success} /><Text style={[styles.systemTitle, { color: theme.textPrimary }]}>隐私与系统控制</Text></View><Text style={[styles.systemText, { color: theme.textSecondary }]}>仅保存学习所需的匿名画像与作答证据；不保存真实身份或模型隐藏思维过程。</Text></View>
        <View style={styles.systemActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="打开系统指南" onPress={() => router.push("/help" as never)} style={({ pressed }) => [styles.systemButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}><Text style={[styles.systemButtonText, { color: theme.textSecondary }]}>📖 系统指南</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="切换学习身份" disabled={Boolean(switching)} onPress={cycleIdentity} style={({ pressed }) => [styles.systemButton, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>{switching ? <ActivityIndicator size="small" color={theme.accentPrimary} /> : <Text style={[styles.systemButtonText, { color: theme.accentPrimary }]}>🔄 切换身份</Text>}</Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="退出登录" onPress={() => void exit()} style={({ pressed }) => [styles.systemButton, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }, pressed && styles.pressed]}><Text style={[styles.systemButtonText, { color: theme.warning }]}>🚪 退出登录</Text></Pressable>
        </View>
      </View>
    </Reveal>
  </ThemedScreen>;
}

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    page: { maxWidth: 1360, paddingTop: 24, paddingBottom: 56, paddingHorizontal: 18, gap: 14, width: "100%", alignSelf: "center" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    disabled: { opacity: 0.55 },
    passport: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 12 },
    passportTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    passportIdentity: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 270 },
    avatar: { width: 56, height: 56, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    avatarText: { fontSize: 21, fontWeight: "900" },
    passportCopy: { flex: 1, minWidth: 0, gap: 2 },
    passportKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.7, fontFamily: MONO_FONT },
    passportName: { fontSize: 26, fontWeight: "800", letterSpacing: -0.6, lineHeight: 34 },
    passportGoal: { fontSize: 15, lineHeight: 22 },
    passportStats: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
    passportStat: { minWidth: 92, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, alignItems: "center" },
    passportStatValue: { fontSize: 20, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    passportStatLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
    roleTabs: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    roleTab: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
    roleDot: { width: 6, height: 6, borderRadius: 3 },
    roleText: { fontSize: 14, fontWeight: "700" },
    masteryStrip: { flexDirection: "row", flexWrap: "wrap", gap: 10, alignItems: "stretch" },
    masteryEntry: { flex: 1, minWidth: 260, borderRadius: 10, borderWidth: 1, padding: 10, gap: 7 },
    masteryEntryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    masteryEntryKicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
    masteryEntryToggle: { fontSize: 11, fontWeight: "800" },
    masteryCounts: { flexDirection: "row", gap: 24, flexWrap: "wrap" },
    masteryCountValue: { fontSize: 26, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    masteryCountLabel: { fontSize: 12, marginTop: 2 },
    masteredStream: { flex: 1.4, minWidth: 300, borderRadius: 10, borderWidth: 1, padding: 10, gap: 7 },
    masteredStreamHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" },
    masteredStreamTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
    masteredStreamMeta: { fontSize: 11, fontFamily: MONO_FONT },
    masteredStreamChips: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    masteredStreamChip: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, maxWidth: "100%" },
    masteredStreamChipText: { fontSize: 13, fontWeight: "800" },
    masteredStreamToggle: { alignSelf: "flex-start", borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
    masteredStreamToggleText: { fontSize: 13, fontWeight: "800" },
    masteredList: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingLeft: 2, width: "100%", flexBasis: "100%" },
    masteredChip: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
    masteredChipText: { fontSize: 12, fontWeight: "700" },

    sectionCard: { borderRadius: 17, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 16, gap: 12 },
    sectionTitleRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    sectionKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    sectionTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.6, marginTop: 2, lineHeight: 32 },
    sectionMeta: { fontSize: 12, fontWeight: "600" },
    sectionPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    sectionPillText: { fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT },
    recapSplit: { gap: 14, minWidth: 0 },
    recapSplitWide: { flexDirection: "row", alignItems: "stretch" },
    recapPane: { minWidth: 0, borderRadius: 14, borderWidth: 1, padding: 14 },
    evolutionSplit: { gap: 8 },
    evolutionSplitWide: { flexDirection: "row", alignItems: "stretch" },
    chartCard: { flex: 1.15, borderRadius: 12, borderWidth: 1, padding: 12, minWidth: 0, position: "relative" },
    chartGrid: { position: "absolute", left: 8, right: 8, top: 26, bottom: 40, justifyContent: "space-between" },
    gridRow: { borderBottomWidth: 1, height: 1 },
    gridLabel: { position: "absolute", left: 0, top: -9, fontSize: 11, fontFamily: MONO_FONT },
    barsRow: { flexDirection: "row", alignItems: "flex-end", height: 215, paddingLeft: 26, paddingTop: 22, gap: 4 },
    barColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 3, borderRadius: 6, paddingTop: 4 },
    barColumnActive: { backgroundColor: `${theme.accentPrimary}10` },
    deltaText: { fontSize: 11, fontWeight: "800", fontFamily: MONO_FONT },
    deltaSpacer: { height: 10 },
    barTrack: { width: 24, height: 148, borderRadius: 8, borderWidth: 1, justifyContent: "flex-end", overflow: "hidden", backgroundColor: theme.bgElevated },
    barFill: { width: "100%", borderRadius: 7, ...webOnly({ transitionProperty: "height", transitionDuration: "750ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }) },
    barValue: { fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    barDate: { fontSize: 13, fontFamily: MONO_FONT },
    chartHint: { fontSize: 13, marginTop: 6, textAlign: "center" },
    evolutionInspector: { flex: 0.85, borderRadius: 12, borderWidth: 1, padding: 14, gap: 9, minWidth: 0 },
    inspectorTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    inspectorKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    inspectorDate: { fontSize: 13, fontFamily: MONO_FONT },
    inspectorNode: { fontSize: 22, fontWeight: "800", lineHeight: 30 },
    inspectorMetrics: { flexDirection: "row", gap: 24 },
    inspectorMetric: { fontSize: 32, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"], lineHeight: 36 },
    inspectorLabel: { fontSize: 11, marginTop: 2 },
    inspectorLine: { borderTopWidth: 1, paddingTop: 8, gap: 3 },
    inspectorLineLabel: { fontSize: 11, fontWeight: "800" },
    inspectorLineText: { fontSize: 15, lineHeight: 22 },
    inspectorLaw: { borderRadius: 8, borderWidth: 1, padding: 9, gap: 3 },
    inspectorLawKicker: { fontSize: 11, fontWeight: "800" },
    inspectorLawText: { fontSize: 16, lineHeight: 24, fontWeight: "600" },

    retentionLayout: { gap: 8 },
    retentionLayoutWide: { flexDirection: "row", alignItems: "stretch", gap: 8 },
    curveCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 7 },
    curveCardWide: { flex: 0.42, minWidth: 0 },
    curveHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    curveTitle: { fontSize: 14, fontWeight: "800" },
    curveMeta: { fontSize: 12, fontFamily: MONO_FONT },
    curveWrap: { gap: 3, flex: 1, justifyContent: "center" },
    curveLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 6 },
    curveLabel: { fontSize: 12, fontFamily: MONO_FONT },
    curveThreshold: { fontSize: 11, fontWeight: "700" },
    curveFallback: { height: 70, flexDirection: "row", alignItems: "flex-end", gap: 5, padding: 8 },
    curveFallbackBar: { flex: 1, borderRadius: 4 },
    rescueGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignContent: "stretch" },
    rescueGridWide: { flex: 0.58, minWidth: 0 },
    rescueCard: { flexBasis: "47%", flexGrow: 0, minWidth: 150, borderRadius: 10, borderWidth: 1, padding: 12, gap: 7, justifyContent: "space-between" },
    rescueTop: { flexDirection: "row", alignItems: "center", gap: 5 },
    rescueTitle: { flex: 1, fontSize: 17, lineHeight: 24, fontWeight: "800" },
    rescueBadge: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
    rescueBadgeText: { fontSize: 13, fontWeight: "800" },
    rescueStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4, flexWrap: "wrap" },
    rescueMeta: { fontSize: 13, fontFamily: MONO_FONT },
    rescueScore: { fontSize: 26, fontWeight: "900", fontFamily: MONO_FONT },
    rescueBar: { height: 6, borderRadius: 99, backgroundColor: theme.bgSurface, overflow: "hidden" },
    rescueBarFill: { height: "100%", borderRadius: 99 },
    rescuePod: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 10 },
    rescuePodHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    rescuePodKicker: { fontSize: 13.5, fontWeight: "800", letterSpacing: 0.4 },
    rescuePodTitle: { fontSize: 20, fontWeight: "800", lineHeight: 28, marginTop: 2 },
    rescuePodScore: { fontSize: 26, fontWeight: "900", fontFamily: MONO_FONT },
    pointsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    pointCard: { borderRadius: 8, borderWidth: 1, padding: 12, gap: 7, minWidth: 0 },
    pointIndex: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    pointIndexText: { fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    pointText: { fontSize: 15, lineHeight: 23 },
    quizCard: { borderRadius: 9, borderWidth: 1, padding: 12, gap: 8 },
    quizHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    quizKicker: { fontSize: 12, fontWeight: "800" },
    quizMeta: { fontSize: 12, fontFamily: MONO_FONT },
    quizQuestion: { fontSize: 17, lineHeight: 25, fontWeight: "700" },
    quizOptions: { gap: 6 },
    quizOption: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 9 },
    quizMark: { width: 18, fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    quizOptionText: { flex: 1, fontSize: 15, lineHeight: 22 },
    quizExplanation: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
    rescueAction: { minHeight: 48, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    rescueActionText: { fontSize: 15, fontWeight: "800" },

    bottomSplit: { gap: 12 },
    bottomSplitWide: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    bottomColumn: { flex: 1, minWidth: 0 },
    dimensionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    dimensionCard: { flexBasis: "48%", flexGrow: 1, minWidth: 145, borderRadius: 9, borderWidth: 1, padding: 10, gap: 7 },
    dimensionHead: { flexDirection: "row", alignItems: "center", gap: 4 },
    dimensionIndex: { width: 20, fontSize: 9, fontWeight: "800", fontFamily: MONO_FONT },
    dimensionLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
    dimensionValue: { fontSize: 18, fontWeight: "900", fontFamily: MONO_FONT },
    dimensionTrack: { height: 10, borderRadius: 99, backgroundColor: theme.bgSurface, overflow: "hidden", position: "relative" },
    dimensionFill: { height: "100%", borderRadius: 99 },
    dimensionMarker: { position: "absolute", top: 0, bottom: 0, left: "60%", width: 1, opacity: 0.65 },
    dimensionDetail: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 8, marginTop: 3 },
    dimensionDetailHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    detailKicker: { fontSize: 12, fontWeight: "800" },
    detailTitle: { fontSize: 20, fontWeight: "800", lineHeight: 27, marginTop: 1 },
    detailValue: { fontSize: 28, fontWeight: "900", fontFamily: MONO_FONT },
    detailBody: { fontSize: 15, lineHeight: 23 },
    priorityRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    priorityChip: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
    priorityText: { fontSize: 13, fontWeight: "600" },
    detailAction: { alignSelf: "flex-start", borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
    detailActionText: { fontSize: 14, fontWeight: "800" },

    badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    badgeCard: { flexBasis: "23%", flexGrow: 1, minWidth: 110, borderRadius: 10, borderWidth: 1, padding: 10, gap: 4, alignItems: "center", overflow: "hidden" },
    badgeSheen: { position: "absolute", top: 0, bottom: 0, left: 0, width: "42%", opacity: 0.45 },
    badgeIcon: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    badgeGlyph: { fontSize: 22 },
    badgeGlyphLocked: { opacity: 0.7 },
    badgeTitle: { fontSize: 16, lineHeight: 22, fontWeight: "800", textAlign: "center" },
    badgeCategory: { fontSize: 13 },
    badgeStatus: { fontSize: 13, fontWeight: "700" },
    badgeProgress: { width: "86%", height: 5, borderRadius: 99, backgroundColor: theme.bgSurface, overflow: "hidden" },
    badgeProgressFill: { height: "100%", borderRadius: 99 },
    badgeDetail: { borderRadius: 10, borderWidth: 1, padding: 11, gap: 7 },
    badgeDetailTop: { flexDirection: "row", alignItems: "center", gap: 7 },
    badgeDetailIcon: { fontSize: 22 },
    badgeDetailCopy: { flex: 1, gap: 1 },
    badgeDetailTitle: { fontSize: 17, fontWeight: "800" },
    badgeDetailMeta: { fontSize: 13, fontWeight: "700" },
    badgeDetailBody: { fontSize: 15, lineHeight: 23 },
    badgeDetailAction: { alignSelf: "flex-start", borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
    badgeDetailActionText: { fontSize: 13, fontWeight: "800" },

    rescuePodBody: { gap: 10 },
    rescuePodBodyWide: { flexDirection: "row", alignItems: "stretch", gap: 14 },
    rescuePointsColumn: { flex: 55, minWidth: 0, gap: 8 },
    rescueQuizColumn: { flex: 45, minWidth: 0, gap: 8, justifyContent: "space-between" },
    rescueColumnKicker: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
    pointsColumn: { gap: 8 },
    systemBar: { borderRadius: 14, borderWidth: 1, padding: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    systemCopy: { flex: 1, minWidth: 220, gap: 3 },
    systemTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    systemTitle: { fontSize: 14, fontWeight: "800" },
    systemText: { fontSize: 13, lineHeight: 20 },
    systemActions: { flexDirection: "row", gap: 5, flexWrap: "wrap" },
    systemButton: { minHeight: 40, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    systemButtonText: { fontSize: 14, fontWeight: "800" },
    emptyText: { fontSize: 9, lineHeight: 14 },
  });
}
