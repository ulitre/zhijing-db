import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View, type ViewProps, type ViewStyle } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MiniIcon } from "../../components/mini-icon";
import { LearningReader } from "../../components/learning-reader";
import { Reveal, revealData, revealDelay, useScrollReveal } from "../../components/scroll-reveal";
import { ThemedAgentTraceTimeline } from "../../components/themed-agent-trace";
import { LoadingPanel, MONO_FONT, PageHeading, ThemedScreen, webOnly } from "../../components/theme-ui";
import { useHydratedWidth } from "../../lib/use-hydrated-width";
import type { AgentTraceItem } from "../../lib/api";
import { TOPOLOGY_NODES, mergePath, nodeById, stateOf, type TopologyNode } from "../../lib/path-topology";
import { exampleForNode, flashcardsForNode, quizzesForNode, sqlLessonForNode, summaryForNode } from "../../lib/learning-content";
import { useApp, type ResourceItem } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";

type ResourceType = "讲解文档" | "知识图解" | "分层练习" | "SQL 实操" | "交互图解" | "复习卡片";
type FilterKey = "all" | "document" | "diagram" | "quiz" | "sql" | "card";
type SortKey = "latest" | "score";

const RESOURCE_TYPES: readonly ResourceType[] = ["讲解文档", "知识图解", "分层练习", "SQL 实操", "交互图解", "复习卡片"];

const TYPE_META: Record<ResourceType, { color: string; dark: string; soft: string; softDark: string; glyph: string; agent: string; eta: string }> = {
  "讲解文档": { color: "#2563EB", dark: "#60A5FA", soft: "#EFF6FF", softDark: "rgba(37, 99, 235, 0.16)", glyph: "▤", agent: "@DocumentAgent", eta: "~8s" },
  "知识图解": { color: "#7C3AED", dark: "#A78BFA", soft: "#F5F3FF", softDark: "rgba(124, 58, 237, 0.16)", glyph: "◇", agent: "@DiagramAgent", eta: "~6s" },
  "分层练习": { color: "#D97706", dark: "#FBBF24", soft: "#FFFBEB", softDark: "rgba(217, 119, 6, 0.16)", glyph: "✎", agent: "@QuizAgent", eta: "~5s" },
  "SQL 实操": { color: "#0D9488", dark: "#34D399", soft: "#F0FDFA", softDark: "rgba(13, 148, 136, 0.16)", glyph: "⌘", agent: "@SQLLabAgent", eta: "~10s" },
  "交互图解": { color: "#0891B2", dark: "#22D3EE", soft: "#ECFEFF", softDark: "rgba(8, 145, 178, 0.16)", glyph: "✦", agent: "@DiagramAgent", eta: "~7s" },
  "复习卡片": { color: "#E11D48", dark: "#FB7185", soft: "#FFF1F2", softDark: "rgba(225, 29, 72, 0.14)", glyph: "▣", agent: "@ReadingAgent", eta: "~4s" },
};

const FILTERS: readonly { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "document", label: "文档" },
  { key: "diagram", label: "图解" },
  { key: "quiz", label: "练习" },
  { key: "sql", label: "SQL" },
  { key: "card", label: "闪卡" },
];

function typeVisual(type: string, theme: ThemeTokens) {
  const meta = TYPE_META[type as ResourceType] ?? TYPE_META["讲解文档"];
  return {
    color: theme.isDark ? meta.dark : meta.color,
    soft: theme.isDark ? meta.softDark : meta.soft,
    glyph: meta.glyph,
    agent: meta.agent,
    eta: meta.eta,
  };
}

function matchesFilter(type: string, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "document") return type === "讲解文档";
  if (filter === "diagram") return type === "知识图解" || type === "交互图解";
  if (filter === "quiz") return type === "分层练习";
  if (filter === "sql") return type === "SQL 实操";
  return type === "复习卡片";
}

function previewCopy(type: ResourceType, node: TopologyNode): { line: string; tags: string[] } {
  const titlesOf = (ids: string[]) => ids.map((id) => nodeById(TOPOLOGY_NODES, id)?.title ?? id).join("、");
  switch (type) {
    case "讲解文档":
      return { line: exampleForNode(node), tags: ["核心定式", "正反例", "避坑口诀"] };
    case "知识图解":
      return { line: `先修 ${node.prereqs.length ? titlesOf(node.prereqs) : "根节点"} → ${node.title} → 解锁 ${node.next.length ? titlesOf(node.next) : "课程终点"}`, tags: ["依赖拓扑", "点击推演", "可展开"] };
    case "分层练习":
      return { line: quizzesForNode(node)[0]!.question, tags: ["即时判分", "错因解析", "BKT"] };
    case "SQL 实操": {
      const lesson = sqlLessonForNode(node);
      return { line: `${lesson.title} · ${lesson.sql.split("\n")[0]}`, tags: ["可执行", "真实结果", "8 表沙箱"] };
    }
    case "交互图解":
      return { line: exampleForNode(node), tags: ["步骤推演", "真实正例", "即时反馈"] };
    case "复习卡片":
      return { line: flashcardsForNode(node)[0]!.front, tags: ["3D 翻转", "4 张卡片", "已记住"] };
  }
}

function webAnimation(style: Record<string, unknown>) {
  return style as unknown as ViewStyle;
}

function pct(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

function masteryTone(theme: ThemeTokens, mastery: number) {
  const key = stateOf(mastery).key;
  return key === "mastered" ? theme.success : key === "steady" ? theme.accentPrimary : theme.warning;
}

function masterySoft(theme: ThemeTokens, mastery: number) {
  const key = stateOf(mastery).key;
  return key === "mastered" ? theme.successSoft : key === "steady" ? theme.accentSoft : theme.warningSoft;
}

const motion = StyleSheet.create({
  shimmer: webAnimation({ animationKeyframes: "shimmer", animationDuration: "2.8s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  priorityBreath: webAnimation({ animationKeyframes: "priorityBreath", animationDuration: "3.2s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  panelIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" }),
});

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
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== "function") return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReduced(value); }).catch(() => {});
    return () => { active = false; };
  }, []);
  return reduced;
}

function useCountUp(target: number, reducedMotion: boolean, duration = 800) {
  const [value, setValue] = useState(reducedMotion ? target : 0);
  useEffect(() => {
    if (reducedMotion) return;
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
  }, [target, duration, reducedMotion]);
  return reducedMotion ? target : value;
}

function TypeMicroPreview({ type, node }: { type: ResourceType; node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  if (type === "知识图解" || type === "交互图解") {
    const labels = [node.prereqs.length ? "先修" : "起点", "当前", node.next.length ? "下游" : "终点"];
    return <View style={styles.microNodes}>
      {labels.map((label, index) => <View key={label} style={styles.microNodeWrap}>
        <View style={[styles.microNode, { backgroundColor: index === 1 ? theme.accentSoft : theme.bgSurface, borderColor: index === 1 ? theme.accentSoftBorder : theme.borderSubtle }]}>
          <Text style={[styles.microNodeText, { color: index === 1 ? theme.accentPrimary : theme.textSecondary }]} numberOfLines={1}>{label}</Text>
        </View>
        {index < labels.length - 1 ? <Text style={[styles.microArrow, { color: theme.textMuted }]}>—</Text> : null}
      </View>)}
    </View>;
  }
  if (type === "SQL 实操") {
    const lesson = sqlLessonForNode(node);
    const preview = lesson.sql.split("\n").slice(0, 2).join("\n");
    return <View style={styles.microCode}>
      <Text style={styles.microCodeComment}>-- {node.title}</Text>
      <Text style={styles.microCodeLine} numberOfLines={2}>{preview}</Text>
    </View>;
  }
  if (type === "分层练习") {
    const quiz = quizzesForNode(node)[0]!;
    return <View style={styles.microOptions}>
      {quiz.options.slice(0, 2).map((option, index) => <View key={option} style={[styles.microOption, { borderColor: theme.borderSubtle }]}>
        <Text style={[styles.microOptionText, { color: theme.textMuted }]} numberOfLines={1}>{String.fromCharCode(65 + index)} · {option}</Text>
      </View>)}
    </View>;
  }
  if (type === "复习卡片") {
    const card = flashcardsForNode(node)[0]!;
    return <View style={styles.microCards}>
      <View style={[styles.microCard, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.microCardText, { color: theme.accentPrimary }]} numberOfLines={2}>Q · {card.front}</Text></View>
      <View style={[styles.microCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}><Text style={[styles.microCardText, { color: theme.textSecondary }]}>A · 翻面看答案</Text></View>
    </View>;
  }
  const card = flashcardsForNode(node)[0]!;
  return <View style={styles.microFormula}>
    <Text style={[styles.microFormulaText, { color: theme.accentPrimary }]} numberOfLines={2}>{card.back}</Text>
    <Text style={[styles.microFormulaHint, { color: theme.textSecondary }]} numberOfLines={1}>三段式精讲 · {node.title}</Text>
  </View>;
}

function TypeCard({
  type,
  node,
  previewType,
  generatedCount,
  generating,
  disabled,
  onPreview,
  onGenerate,
  index,
  reducedMotion,
  basis,
}: {
  type: ResourceType;
  node: TopologyNode;
  previewType: ResourceType;
  generatedCount: number;
  generating: boolean;
  disabled: boolean;
  onPreview: () => void;
  onGenerate: () => void;
  index: number;
  reducedMotion: boolean;
  basis: `${number}%`;
}) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  const [hovered, setHovered] = useState(false);
  const { ref, visible } = useScrollReveal(reducedMotion);
  const visual = typeVisual(type, theme);
  const active = previewType === type;
  const copy = previewCopy(type, node);

  return <View
    ref={ref}
    {...(revealData(visible) as ViewProps)}
    style={[styles.typeCardWrap, { flexBasis: basis }, revealDelay(index, reducedMotion)]}
  >
    <View style={[
      styles.typeCard,
      { borderColor: active ? `${visual.color}88` : theme.borderSubtle, backgroundColor: active ? visual.soft : theme.bgSurface },
      hovered && styles.typeCardHover,
      webOnly({ transitionProperty: "transform, border-color, box-shadow, background-color", transitionDuration: "200ms" }),
    ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`预览${type}，${node.title}`}
        onPress={onPreview}
        onHoverIn={() => { setHovered(true); onPreview(); }}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [styles.typePreviewArea, pressed && styles.cardPressed, webOnly({ cursor: "pointer" })]}
      >
        <View style={styles.typeTop}>
          <View style={[styles.typeIconBox, { backgroundColor: visual.soft, borderColor: `${visual.color}44` }]}>
            <Text style={{ color: visual.color, fontSize: 16, fontWeight: "800" }}>{visual.glyph}</Text>
          </View>
          <View style={styles.typeTopCopy}>
            <Text style={[styles.typeName, { color: theme.textPrimary }]}>{type}</Text>
            <Text style={[styles.typeAgent, { color: visual.color }]}>{visual.agent}</Text>
          </View>
          <Text style={styles.typeEta}>{visual.eta}</Text>
        </View>

        <TypeMicroPreview type={type} node={node} />
        <Text style={[styles.typePreviewText, { color: theme.textSecondary }]} numberOfLines={2}>{copy.line}</Text>
        <View style={styles.typeTags}>
          {copy.tags.slice(0, 2).map((tag) => <View key={tag} style={[styles.typeTag, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
            <Text style={[styles.typeTagText, { color: theme.textSecondary }]}>{tag}</Text>
          </View>)}
        </View>
      </Pressable>

      <View style={[styles.typeBottom, { borderTopColor: theme.borderDivider }]}>
        <View style={styles.typeStatusRow}>
          {generating ? <View style={[styles.statusDot, motion.priorityBreath, { backgroundColor: visual.color }]} /> : <View style={[styles.statusDot, { backgroundColor: generatedCount > 0 ? theme.success : theme.textMuted }]} />}
          <Text style={[styles.typeStatus, { color: generating ? visual.color : generatedCount > 0 ? theme.success : theme.textMuted }]}>
            {generating ? "合成中 · 画像注入" : generatedCount > 0 ? `✓ 已就绪 ${generatedCount} 份` : "待合成"}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`合成矩阵：立即合成${type}`}
          disabled={disabled}
          onPress={onGenerate}
          style={({ pressed }) => [styles.synthButton, { backgroundColor: visual.soft, borderWidth: 1, borderColor: `${visual.color}55` }, pressed && styles.synthButtonPressed, disabled && styles.synthButtonDisabled]}
        >
          {generating ? <ActivityIndicator size="small" color={visual.color} /> : <MiniIcon name="spark" size={11} color={visual.color} />}
          <Text style={[styles.synthButtonText, { color: visual.color }]}>{generating ? "合成中…" : "立即合成"}</Text>
        </Pressable>
      </View>
      {generating ? <View style={styles.progressTrack}><View style={[styles.progressFill, motion.shimmer, { backgroundColor: visual.color }]} /></View> : null}
    </View>
  </View>;
}

function QualityBar({ label, value, color }: { label: string; value: number; color: string }) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  return <View style={styles.qualityRow}>
    <Text style={styles.qualityLabel}>{label}</Text>
      <View style={[styles.qualityTrack, { backgroundColor: theme.bgElevated }]}>
      <View style={[styles.qualityFill, { width: pct(value), backgroundColor: color }]} />
    </View>
    <Text style={[styles.qualityValue, { color }]}>{value}</Text>
  </View>;
}

function PreviewPod({
  previewType,
  target,
  resources,
  latestTrace,
  anyGenerating,
  generatingType,
  demoRunning,
  reviewOpen,
  onToggleReview,
  onGenerate,
  onDemo,
  onOpenLatest,
}: {
  previewType: ResourceType;
  target: TopologyNode;
  resources: readonly ResourceItem[];
  latestTrace: AgentTraceItem[] | null;
  anyGenerating: boolean;
  generatingType: ResourceType | null;
  demoRunning: boolean;
  reviewOpen: boolean;
  onToggleReview: () => void;
  onGenerate: (type: ResourceType) => void;
  onDemo: () => void;
  onOpenLatest: (resource: ResourceItem) => void;
}) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  const visual = typeVisual(previewType, theme);
  const generated = resources.filter((resource) => resource.type === previewType && resource.nodeId === target.apiNodeId && resource.status !== "生成中");
  const latest = generated[0] ?? null;
  const trace = demoRunning ? latestTrace : (latest?.agentTrace ?? null);
  const reviewRejected = trace?.find((item) => item.agent === "ReviewAgent" && item.status === "rejected") ?? null;
  const reviewApproved = trace?.find((item) => item.agent === "ReviewAgent" && (item.status === "approved" || item.status === "completed") && (item.score ?? 0) >= 75) ?? null;
  const approvedScore = reviewApproved?.score ?? 94;
  const rejectionScore = reviewRejected?.score ?? 65;
  const factScore = Math.min(100, approvedScore + 2);
  const syntaxScore = 100;
  const profileScore = Math.min(100, approvedScore - 2);
  const formatScore = Math.min(100, approvedScore - 4);
  const demoActive = demoRunning;
  const approved = !demoActive && Boolean(reviewApproved);
  const rejected = !demoActive && Boolean(reviewRejected);
  const stage1 = rejected ? "rejected" : demoActive ? "active" : approved ? "done" : "idle";
  const stage2 = approved && rejected ? "done" : rejected ? "active" : approved ? "skipped" : demoActive ? "waiting" : "idle";
  const stage3 = approved ? "approved" : "idle";
  const reviewScoreLabel = latest && latest.score > 0 ? latest.score : reviewApproved?.score ?? null;

  return <View style={styles.pod}>
    <View style={styles.podHead}>
      <View style={styles.podHeadTop}>
        <View>
          <Text style={styles.podKicker}>LIVE MULTIMODAL READER · TARGETED</Text>
          <Text style={styles.podTitle}>即时学习工作台</Text>
        </View>
      </View>
      <View style={styles.podHeaderActions}>
        <View style={[styles.podLivePill, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}>
          <View style={[styles.podLiveDot, motion.priorityBreath, { backgroundColor: theme.success }]} />
          <Text style={[styles.podLiveText, { color: theme.success }]}>LIVE READER</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={reviewOpen ? "收起智审轨迹抽屉" : "展开智审轨迹抽屉"}
          accessibilityState={{ expanded: reviewOpen }}
          onPress={onToggleReview}
          style={({ pressed }) => [styles.reviewToggle, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}
        >
          <MiniIcon name="shield" size={12} color={theme.success} />
          <Text style={[styles.reviewToggleText, { color: theme.textSecondary }]}>{reviewOpen ? "收起智审轨迹" : reviewScoreLabel ? `查看智审轨迹 · ${reviewScoreLabel}分` : "查看智审轨迹"}</Text>
          <Text style={[styles.reviewToggleGlyph, { color: theme.textMuted }]}>{reviewOpen ? "⌃" : "⌄"}</Text>
        </Pressable>
      </View>
    </View>

    <View key={`${previewType}-reader`} style={[styles.podBody, motion.panelIn]}>
      <View style={styles.podTypeHead}>
        <View style={[styles.podTypeIcon, { backgroundColor: visual.soft, borderColor: `${visual.color}44` }]}>
          <Text style={{ color: visual.color, fontSize: 17, fontWeight: "800" }}>{visual.glyph}</Text>
        </View>
        <View style={styles.podTypeCopy}>
          <Text style={[styles.podTypeTitle, { color: theme.textPrimary }]}>{previewType}</Text>
          <Text style={[styles.podTypeMeta, { color: theme.textSecondary }]}>{visual.agent} · 预计 {visual.eta} · 靶向 {target.title}</Text>
        </View>
        <View style={[styles.podTargetPill, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
          <Text style={[styles.podTargetPillText, { color: theme.textSecondary }]}>{target.mastery}% 掌握</Text>
        </View>
      </View>

      <LearningReader type={previewType} node={target} compact />

      <View style={[styles.podBasis, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
        <Text style={[styles.podBasisTitle, { color: theme.textSecondary }]}>画像依据</Text>
        <View style={styles.podBasisTags}>
          {[`${target.title} ${target.mastery}%`, target.mastery < 60 ? "高优断点" : "巩固提升", "8 表校园沙箱"].map((tag) => <View key={tag} style={[styles.podBasisTag, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.podBasisTagText, { color: theme.textSecondary }]}>{tag}</Text>
          </View>)}
        </View>
      </View>

      <View style={styles.podActions}>
        {latest ? <Pressable accessibilityRole="button" accessibilityLabel="查看最近生成的资源" onPress={() => onOpenLatest(latest)} style={({ pressed }) => [styles.podSecondary, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }, pressed && styles.pressed]}>
          <Text style={styles.podSecondaryText}>查看已就绪资源 · {latest.score > 0 ? `${latest.score}分` : latest.status}</Text>
        </Pressable> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`速览面板：立即合成${previewType}`}
          disabled={anyGenerating}
          onPress={() => onGenerate(previewType)}
          style={({ pressed }) => [styles.podPrimary, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed, anyGenerating && styles.synthButtonDisabled]}
        >
          {generatingType === previewType ? <ActivityIndicator size="small" color={theme.onAccent} /> : <MiniIcon name="spark" size={13} color={theme.onAccent} />}
          <Text style={[styles.podPrimaryText, { color: theme.onAccent }]}>{generatingType === previewType ? "正在合成…" : `立即合成${previewType}`}</Text>
          <Text style={[styles.podPrimaryArrow, { color: theme.onAccent }]}>→</Text>
        </Pressable>
      </View>
    </View>

    {reviewOpen ? <View key="review-drawer" style={[styles.reviewDrawer, motion.panelIn]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="评委演示：触发初审打回与自愈重构循环"
        disabled={anyGenerating}
        onPress={onDemo}
        style={({ pressed }) => [styles.demoTrigger, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }, pressed && styles.pressed, anyGenerating && styles.synthButtonDisabled]}
      >
        <View style={[styles.demoTriggerIcon, { backgroundColor: theme.bgSurface, borderColor: `${theme.warning}44` }]}>
          {anyGenerating ? <ActivityIndicator size="small" color={theme.warning} /> : <MiniIcon name="shield" size={16} color={theme.warning} />}
        </View>
        <View style={styles.demoTriggerCopy}>
          <Text style={[styles.demoTriggerTitle, { color: theme.textPrimary }]}>评委演示：触发初审打回与自愈重构循环</Text>
          <Text style={[styles.demoTriggerSub, { color: theme.textSecondary }]}>
            {anyGenerating ? (demoRunning ? "ReviewAgent 正在执行 65 分打回与条件边重写…" : "另一条合成任务正在执行，完成后可触发质检演示。") : "真实调用多 Agent 接口 · 初审打回 → 二次重构 → 94 分终审"}
          </Text>
        </View>
        <Text style={[styles.demoTriggerCta, { color: theme.warning }]}>触发 ›</Text>
      </Pressable>

      <View style={styles.pipeline}>
        <View style={[styles.stage, {
          borderColor: stage1 === "rejected" ? `${theme.warning}66` : stage1 === "done" ? `${theme.success}55` : stage1 === "active" ? theme.accentSoftBorder : theme.borderSubtle,
          backgroundColor: stage1 === "rejected" ? theme.warningSoft : stage1 === "done" ? theme.successSoft : stage1 === "active" ? theme.accentSoft : theme.bgSurface,
        }]}>
          <View style={styles.stageTop}>
            <View style={[styles.stageIcon, {
              backgroundColor: stage1 === "rejected" ? theme.warningSoft : stage1 === "done" ? theme.successSoft : stage1 === "active" ? theme.accentSoft : theme.bgElevated,
              borderColor: stage1 === "rejected" ? `${theme.warning}55` : stage1 === "done" ? `${theme.success}44` : stage1 === "active" ? theme.accentSoftBorder : theme.borderSubtle,
            }]}>
              <Text style={{ color: stage1 === "rejected" ? theme.warning : stage1 === "done" ? theme.success : stage1 === "active" ? theme.accentPrimary : theme.textMuted, fontSize: 12, fontWeight: "900" }}>{stage1 === "idle" ? "1" : stage1 === "rejected" ? "✕" : stage1 === "done" ? "✓" : "◌"}</Text>
            </View>
            <View style={styles.stageCopy}>
              <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>{rejected ? "初审拦截" : stage1 === "done" ? "初审通过" : "初审拦截"}</Text>
              <Text style={[styles.stageMeta, {
                color: stage1 === "rejected" ? theme.warning : stage1 === "done" ? theme.success : theme.textMuted,
              }]}>{stage1 === "rejected" ? `${rejectionScore} 分 · 未达 75 分门禁` : stage1 === "active" ? "ReviewAgent 正在检查" : stage1 === "done" ? "初审通过 · 无打回" : "等待触发"}</Text>
            </View>
            {stage1 === "rejected" ? <View style={[styles.stageBadge, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}55` }]}><Text style={[styles.stageBadgeText, { color: theme.warning }]}>打回</Text></View> : null}
            {stage1 === "done" ? <View style={[styles.stageBadge, { backgroundColor: theme.successSoft, borderColor: `${theme.success}44` }]}><Text style={[styles.stageBadgeText, { color: theme.success }]}>通过</Text></View> : null}
          </View>
          {rejected ? <Text style={[styles.stageDesc, { color: theme.textSecondary }]}>{reviewRejected?.feedback ?? "缺少课程知识卡来源引用，SQL 示例存在笛卡尔积风险。"}</Text> : <Text style={[styles.stageDesc, { color: theme.textMuted }]}>{stage1 === "done" ? "内容直接通过初审，无需触发条件边重写。" : "自动校验事实出处、安全策略与格式规范。"}</Text>}
          {rejected ? <View style={[styles.stageReason, { backgroundColor: theme.bgSurface, borderColor: `${theme.warning}33` }]}>
            <Text style={[styles.stageReasonText, { color: theme.warning }]}>缺少课程知识卡来源引用 / SQL 示例存在笛卡尔积风险</Text>
          </View> : null}
        </View>

        <View style={styles.stageConnector}>
          <View style={[styles.stageLine, { backgroundColor: rejected ? `${theme.warning}55` : approved ? `${theme.success}33` : theme.borderSubtle }]} />
          <View style={[styles.stageLoop, { backgroundColor: rejected ? theme.warningSoft : approved ? theme.successSoft : theme.bgElevated, borderColor: rejected ? `${theme.warning}44` : approved ? `${theme.success}33` : theme.borderSubtle }]}>
            <Text style={[styles.stageLoopText, { color: rejected ? theme.warning : approved ? theme.success : theme.textMuted }]}>{rejected ? "↺ 条件边回流" : approved ? "无需回流" : "↺ 条件边回流"}</Text>
          </View>
        </View>

        <View style={[styles.stage, {
          borderColor: stage2 === "done" ? `${theme.success}44` : stage2 === "active" ? `${theme.accentPrimary}55` : stage2 === "skipped" ? `${theme.success}33` : theme.borderSubtle,
          backgroundColor: stage2 === "done" ? theme.successSoft : stage2 === "active" ? theme.accentSoft : stage2 === "skipped" ? theme.bgElevated : theme.bgSurface,
        }]}>
          <View style={styles.stageTop}>
            <View style={[styles.stageIcon, {
              backgroundColor: stage2 === "done" ? theme.successSoft : stage2 === "skipped" ? theme.bgElevated : theme.accentSoft,
              borderColor: stage2 === "done" ? `${theme.success}44` : stage2 === "skipped" ? theme.borderSubtle : theme.accentSoftBorder,
            }]}>
              <Text style={{ color: stage2 === "done" ? theme.success : stage2 === "skipped" ? theme.textMuted : theme.accentPrimary, fontSize: 12, fontWeight: "900" }}>{stage2 === "skipped" ? "—" : "↺"}</Text>
            </View>
            <View style={styles.stageCopy}>
              <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>二次重构</Text>
              <Text style={[styles.stageMeta, { color: stage2 === "done" ? theme.success : stage2 === "skipped" ? theme.textSecondary : theme.textMuted }]}>
                {stage2 === "done" ? "按反馈重写并补齐来源" : stage2 === "skipped" ? "初审直通，无需重构" : stage2 === "active" ? "条件边等待生成 Agent" : "等待演示触发"}
              </Text>
            </View>
            {stage2 === "done" ? <View style={[styles.stageBadge, { backgroundColor: theme.successSoft, borderColor: `${theme.success}44` }]}><Text style={[styles.stageBadgeText, { color: theme.success }]}>已重构</Text></View> : null}
            {stage2 === "skipped" ? <View style={[styles.stageBadge, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}><Text style={[styles.stageBadgeText, { color: theme.textMuted }]}>未触发</Text></View> : null}
          </View>
          <Text style={[styles.stageDesc, { color: theme.textSecondary }]}>{stage2 === "skipped" ? "本次初审未打回，资源直接进入终审。" : "生成 Agent 接收打回意见，补齐教材引用、边界条件与安全说明。"}</Text>
        </View>

        <View style={styles.stageConnector}>
          <View style={[styles.stageLine, { backgroundColor: approved ? `${theme.success}55` : theme.borderSubtle }]} />
          <Text style={[styles.stageConnectorLabel, { color: approved ? theme.success : theme.textMuted }]}>终审</Text>
        </View>

        <View style={[styles.stage, {
          borderColor: stage3 === "approved" ? `${theme.success}66` : theme.borderSubtle,
          backgroundColor: stage3 === "approved" ? theme.successSoft : theme.bgSurface,
        }]}>
          <View style={styles.stageTop}>
            <View style={[styles.stageIcon, { backgroundColor: approved ? theme.successSoft : theme.bgElevated, borderColor: approved ? `${theme.success}44` : theme.borderSubtle }]}>
              <Text style={{ color: approved ? theme.success : theme.textMuted, fontSize: 13, fontWeight: "900" }}>{approved ? "✓" : "3"}</Text>
            </View>
            <View style={styles.stageCopy}>
              <Text style={[styles.stageTitle, { color: theme.textPrimary }]}>终审放行</Text>
              <Text style={[styles.stageMeta, { color: approved ? theme.success : theme.textMuted }]}>{approved ? `${approvedScore} 分 · 四维质检通过` : "等待终审"}</Text>
            </View>
            {approved ? <View style={[styles.stageBadge, { backgroundColor: theme.successSoft, borderColor: `${theme.success}44` }]}><Text style={[styles.stageBadgeText, { color: theme.success }]}>{approvedScore} 分</Text></View> : null}
          </View>
          {approved ? <>
            <View style={styles.qualityGrid}>
              <QualityBar label="事实出处" value={factScore} color={theme.success} />
              <QualityBar label="语法安全" value={syntaxScore} color={theme.success} />
              <QualityBar label="画像匹配" value={profileScore} color={theme.accentPrimary} />
              <QualityBar label="格式规范" value={formatScore} color={theme.agent} />
            </View>
            <View style={styles.qualityFootnote}>
              <MiniIcon name="shield" size={11} color={theme.success} />
              <Text style={[styles.qualityFootnoteText, { color: theme.textSecondary }]}>ReviewAgent 已校验教材出处 · 8 表安全边界 · 画像难度</Text>
            </View>
          </> : <View style={[styles.qualityPending, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
            <Text style={[styles.qualityPendingText, { color: theme.textMuted }]}>终审通过后展示四维质检条</Text>
          </View>}
        </View>
      </View>

      {trace && trace.length > 0 ? <View style={styles.traceWrap}>
        <ThemedAgentTraceTimeline trace={trace} title="最近生成 · 12 智能体协同沙盘" defaultExpanded={false} />
      </View> : null}
    </View> : null}
  </View>;
}

function ResourceGalleryCard({ resource, target, nodes, index, reducedMotion }: { resource: ResourceItem; target: TopologyNode; nodes: readonly TopologyNode[]; index: number; reducedMotion: boolean }) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  const [hovered, setHovered] = useState(false);
  const { ref, visible } = useScrollReveal(reducedMotion);
  const visual = typeVisual(resource.type, theme);
  const node = resource.nodeId === target.apiNodeId ? target : nodeById(nodes, resource.nodeId);
  const isGenerating = resource.status === "生成中";
  const openable = Boolean(resource.content) && !isGenerating;
  const approved = resource.score >= 75 || resource.status === "已审核" || resource.status === "审核通过";
  const highlight = resource.nodeId === target.apiNodeId;
  const reasons = resource.personalizationReasons.slice(0, 1);

  return <View
    ref={ref}
    {...(revealData(visible) as ViewProps)}
    style={[styles.galleryCardWrap, revealDelay(index, reducedMotion)]}
  >
    <Pressable
      accessibilityRole={openable ? "button" : "none"}
      accessibilityLabel={openable ? `打开资源：${resource.type} · ${resource.title}` : `${resource.title}，${resource.status}`}
      accessibilityState={{ disabled: !openable }}
      disabled={!openable}
      onPress={() => openable && router.push({ pathname: "/resource/[id]", params: { id: resource.id } } as never)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.galleryCard,
        { borderColor: highlight ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: theme.bgSurface },
        highlight && styles.galleryCardHighlight,
        hovered && openable && styles.galleryCardHover,
        pressed && styles.cardPressed,
        webOnly({ cursor: openable ? "pointer" : "default", transitionProperty: "transform, border-color, box-shadow, background-color", transitionDuration: "220ms" }),
      ]}
    >
      {highlight ? <View style={[styles.galleryHighlightRail, { backgroundColor: theme.accentPrimary }]} /> : null}
      <View style={styles.galleryTop}>
        <View style={[styles.galleryType, { backgroundColor: visual.soft, borderColor: `${visual.color}44` }]}>
          <Text style={{ color: visual.color, fontSize: 10, fontWeight: "800" }}>{visual.glyph}</Text>
          <Text style={[styles.galleryTypeText, { color: visual.color }]}>{resource.type}</Text>
        </View>
        {isGenerating ? <View style={styles.galleryStatusBusy}><ActivityIndicator size="small" color={visual.color} /><Text style={[styles.galleryStatusBusyText, { color: visual.color }]}>合成中</Text></View> : <View style={[styles.galleryScore, { backgroundColor: approved ? theme.successSoft : theme.bgElevated, borderColor: approved ? `${theme.success}44` : theme.borderSubtle }]}>
          <MiniIcon name={approved ? "shield" : "alert"} size={10} color={approved ? theme.success : theme.warning} />
          <Text style={[styles.galleryScoreText, { color: theme.textPrimary }]}>{resource.score > 0 ? `ReviewAgent ${resource.score} · ${approved ? "终审通过" : resource.status}` : resource.status}</Text>
        </View>}
      </View>

      <Text style={[styles.galleryCardTitle, { color: theme.textPrimary }]} numberOfLines={2}>{resource.title}</Text>
      <View style={styles.galleryNodeRow}>
        <MiniIcon name="target" size={10} color={theme.accentPrimary} />
        <Text style={[styles.galleryNodeText, { color: theme.textSecondary }]} numberOfLines={1}>{node?.title ?? "当前靶向节点"}</Text>
        {highlight ? <View style={[styles.galleryCurrentPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.galleryCurrentText, { color: theme.accentPrimary }]}>当前靶向</Text></View> : null}
      </View>
      <Text style={[styles.gallerySummary, { color: theme.textSecondary }]} numberOfLines={2}>{resource.summary}</Text>
      <Text style={[styles.galleryReason, { color: theme.textSecondary }]} numberOfLines={1}>{reasons[0] ?? "结合画像、错因与当前知识断点生成"}</Text>

      <View style={styles.galleryBottom}>
        <View style={styles.galleryTags}>
          <View style={[styles.gallerySourceTag, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}>
            <Text style={[styles.gallerySourceText, { color: theme.agent }]}>{resource.sourceIds.length > 0 ? `知识卡 ×${resource.sourceIds.length}` : "课程知识库"}</Text>
          </View>
          {resource.cached ? <View style={[styles.gallerySourceTag, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}><Text style={[styles.gallerySourceText, { color: theme.textMuted }]}>缓存命中</Text></View> : null}
        </View>
        <Text style={[styles.galleryOpen, { color: openable ? theme.accentPrimary : theme.textMuted }]}>{openable ? "打开详情 ›" : isGenerating ? "等待合成" : "暂无内容"}</Text>
      </View>
    </Pressable>
  </View>;
}

function StarterAction({ glyph, title, detail, color, onPress }: { glyph: string; title: string; detail: string; color: string; onPress: () => void }) {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  const [hovered, setHovered] = useState(false);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={title}
    onPress={onPress}
    onHoverIn={() => setHovered(true)}
    onHoverOut={() => setHovered(false)}
    style={({ pressed }) => [styles.starterAction, { backgroundColor: theme.bgSurface, borderColor: hovered ? `${color}66` : theme.borderSubtle }, hovered && styles.starterActionHover, pressed && styles.pressed, webOnly({ cursor: "pointer" })]}
  >
    <View style={[styles.starterActionIcon, { backgroundColor: `${color}14`, borderColor: `${color}33` }]}><Text style={{ color, fontSize: 16, fontWeight: "900" }}>{glyph}</Text></View>
    <Text style={[styles.starterActionTitle, { color: theme.textPrimary }]}>{title}</Text>
    <Text style={[styles.starterActionText, { color: theme.textSecondary }]}>{detail}</Text>
    <Text style={[styles.starterActionCta, { color }]}>启动 ›</Text>
  </Pressable>;
}

export default function ResourcesScreen() {
  const { theme } = useTheme();
  const styles = useResourceStyles();
  const { currentUser, path, resources, latestTrace, addGeneratedResource } = useApp();
  const { nodeId: routeNodeIdParam } = useLocalSearchParams<{ nodeId?: string }>();
  const routeNodeId = typeof routeNodeIdParam === "string" && routeNodeIdParam.trim() ? routeNodeIdParam.trim() : null;
  const width = useHydratedWidth();
  const reducedMotion = useReducedMotion();
  const isDesktop = width >= 980;
  const nodes = useMemo(() => mergePath(TOPOLOGY_NODES, path), [path]);
  const pathFocus = useMemo(() => nodes.filter((node) => node.pathNode).sort((left, right) => (left.pathIndex ?? 99) - (right.pathIndex ?? 99)), [nodes]);
  const routeTarget = nodeById(nodes, routeNodeId);
  const fallbackTarget = pathFocus[0] ?? nodeById(nodes, "nf-3bc") ?? nodes[0]!;
  const [targetId, setTargetId] = useState(() => routeTarget?.id ?? fallbackTarget.id);
  const [targetTouched, setTargetTouched] = useState(false);
  const [previewType, setPreviewType] = useState<ResourceType>("讲解文档");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("latest");
  const [busyType, setBusyType] = useState<ResourceType | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [hoveredSql, setHoveredSql] = useState(false);
  const actionLock = useRef(false);
  const uniqueResources = useMemo(() => resources.filter((resource, index, items) => items.findIndex((item) => item.id === resource.id) === index), [resources]);
  const anyGenerating = uniqueResources.some((resource) => resource.status === "生成中") || demoRunning;
  const activeGenerating = uniqueResources.find((resource) => resource.status === "生成中");
  const generatingType = busyType ?? (activeGenerating && RESOURCE_TYPES.includes(activeGenerating.type as ResourceType) ? activeGenerating.type as ResourceType : null);
  const effectiveTargetId = targetTouched ? targetId : (routeTarget?.id ?? pathFocus[0]?.id ?? targetId);
  const target = nodeById(nodes, effectiveTargetId) ?? fallbackTarget;
  const targetState = stateOf(target.mastery);
  const focusNodes = useMemo(() => {
    const map = new Map<string, TopologyNode>();
    map.set(target.id, target);
    pathFocus.forEach((node) => map.set(node.id, node));
    return [...map.values()].slice(0, 5);
  }, [pathFocus, target]);
  const scored = uniqueResources.filter((resource) => resource.score > 0);
  const passRate = scored.length > 0 ? Math.round((scored.filter((resource) => resource.score >= 75).length / scored.length) * 100) : 0;
  const resourceCount = useCountUp(uniqueResources.length, reducedMotion);
  const passRateCount = useCountUp(passRate, reducedMotion);
  const targetGap = target.mastery < 60 ? 60 - target.mastery : target.mastery < 80 ? 80 - target.mastery : 0;
  const targetTone = masteryTone(theme, target.mastery);
  const targetSoft = masterySoft(theme, target.mastery);

  useEffect(() => {
    if (!routeNodeId) return;
    const frame = requestAnimationFrame(() => {
      setTargetId(routeNodeId);
      setTargetTouched(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [routeNodeId]);

  const generate = useCallback(async (type: ResourceType) => {
    if (actionLock.current || anyGenerating) return;
    actionLock.current = true;
    setPreviewType(type);
    setBusyType(type);
    try {
      await addGeneratedResource(type, { nodeId: target.apiNodeId });
    } finally {
      actionLock.current = false;
      setBusyType(null);
    }
  }, [addGeneratedResource, anyGenerating, target.apiNodeId]);

  const triggerDemo = useCallback(async () => {
    if (actionLock.current || anyGenerating) return;
    actionLock.current = true;
    setPreviewType("讲解文档");
    setReviewOpen(true);
    setBusyType("讲解文档");
    setDemoRunning(true);
    try {
      await addGeneratedResource("讲解文档", { forceReviewReject: true, nodeId: target.apiNodeId });
    } finally {
      actionLock.current = false;
      setDemoRunning(false);
      setBusyType(null);
    }
  }, [addGeneratedResource, anyGenerating, target.apiNodeId]);

  const filteredResources = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    const list = uniqueResources.filter((resource) => {
      if (!matchesFilter(resource.type, filter)) return false;
      if (!keyword) return true;
      const node = nodeById(nodes, resource.nodeId);
      return `${resource.title} ${resource.summary} ${resource.type} ${node?.title ?? ""} ${resource.personalizationReasons.join(" ")}`.toLowerCase().includes(keyword);
    });
    return [...list].sort((left, right) => {
      if (sort === "score") return (right.score || 0) - (left.score || 0);
      return (right.createdAt || "").localeCompare(left.createdAt || "") || right.id.localeCompare(left.id);
    });
  }, [filter, nodes, search, sort, uniqueResources]);

  if (!currentUser) {
    return <ThemedScreen>
      <LoadingPanel title="正在加载资源工坊…" detail="正在同步当前知识断点、画像与 ReviewAgent 质检记录。" />
    </ThemedScreen>;
  }

  const selectTarget = (id: string) => {
    setTargetId(id);
    setTargetTouched(true);
  };
  const openResource = (resource: ResourceItem) => {
    if (!resource.content || resource.status === "生成中") return;
    router.push({ pathname: "/resource/[id]", params: { id: resource.id } } as never);
  };
  const backToPath = () => router.push({ pathname: "/(tabs)/path", params: { nodeId: target.id } } as never);
  const goSqlLab = () => router.push("/sql-lab");
  const galleryBasis = width >= 1180 ? "31.7%" : width >= 760 ? "48.4%" : "100%";

  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading
      title="个性化资源库"
      subtitle="多模态靶向合成工坊 · ReviewAgent 四维质检 · 与学习路径实时联动"
    />

    <Reveal reducedMotion={reducedMotion} index={0}>
      <View style={[styles.targetCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgGlass }]}>
        <View style={[styles.targetGlow, { backgroundColor: theme.accentGlow }]} />
        <View style={styles.targetTop}>
          <View style={styles.targetCopy}>
            <Text style={styles.targetKicker}>TARGETED SYNTHESIS · 以当前断点为输入</Text>
            <View style={styles.targetTitleRow}>
              <View style={[styles.targetMark, { backgroundColor: targetSoft, borderColor: `${targetTone}44` }]}>
                <MiniIcon name="target" size={17} color={targetTone} />
              </View>
              <Text style={styles.targetLabel}>当前靶向合成目标</Text>
            </View>
            <Text style={styles.targetTitle}>{target.title}</Text>
            <View style={styles.targetMetaRow}>
              <View style={[styles.targetState, { backgroundColor: targetSoft, borderColor: `${targetTone}44` }]}>
                <Text style={[styles.targetStateText, { color: targetTone }]}>{targetState.glyph} {targetState.label}</Text>
              </View>
              <Text style={[styles.targetMastery, { color: targetTone }]}>{target.mastery}%</Text>
              <Text style={styles.targetGap}>{target.mastery >= 80 ? "已精通" : target.mastery < 60 ? `距 60% 基准 +${targetGap}%` : `距 80% 精通 +${targetGap}%`}</Text>
            </View>
            <Text style={styles.targetSummary} numberOfLines={3}>{summaryForNode(target)}</Text>
            <View style={styles.targetActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="返回知识拓扑路径" onPress={backToPath} style={({ pressed }) => [styles.backToPath, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed, webOnly({ cursor: "pointer" })]}>
                <Text style={[styles.backToPathText, { color: theme.textSecondary }]}>← 返回知识拓扑路径</Text>
              </Pressable>
              <View style={styles.targetStats}>
                <View style={[styles.statPill, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
                  <Text style={[styles.statValue, { color: theme.textPrimary }]}>{resourceCount}</Text>
                  <Text style={styles.statLabel}>已生成资源</Text>
                </View>
                <View style={[styles.statPill, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}>
                  <Text style={[styles.statValue, { color: theme.success }]}>{passRateCount}%</Text>
                  <Text style={styles.statLabel}>四维质检通过</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.targetSide}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="打开可执行 SQL 交互实验室"
              onPress={goSqlLab}
              onHoverIn={() => setHoveredSql(true)}
              onHoverOut={() => setHoveredSql(false)}
              style={({ pressed }) => [styles.sqlEntry, { borderColor: hoveredSql ? `${theme.success}66` : theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed, webOnly({ cursor: "pointer", transitionProperty: "border-color, transform", transitionDuration: "200ms" })]}
            >
              <View style={styles.sqlEntryTop}>
                <View style={styles.codeDots}><View style={[styles.codeDot, { backgroundColor: "#FF5F56" }]} /><View style={[styles.codeDot, { backgroundColor: "#FFBD2E" }]} /><View style={[styles.codeDot, { backgroundColor: "#27C93F" }]} /></View>
                <Text style={styles.sqlEntryCode}>sql_lab.zsh</Text>
                <Text style={styles.sqlEntryGlyph}>⌘</Text>
              </View>
              <View style={styles.sqlEntryBody}>
                <View style={styles.sqlStatusRow}>
                  <View style={[styles.sqlStatusDot, motion.priorityBreath, { backgroundColor: theme.success }]} />
                  <Text style={[styles.sqlStatus, { color: theme.success }]}>8 表 WASM 沙箱就绪</Text>
                </View>
                <Text style={[styles.sqlEntryTitle, { color: theme.textPrimary }]}>SQL 交互实验室</Text>
                <Text style={[styles.sqlEntrySub, { color: theme.textSecondary }]}>真实执行 · 执行计划 · BKT 评估</Text>
              </View>
              <View pointerEvents="none" style={[styles.sqlEntrySheen, motion.shimmer, webOnly({ backgroundImage: "linear-gradient(100deg, transparent 25%, rgba(255,255,255,0.55) 50%, transparent 75%)" })]} />
            </Pressable>
            <Text style={styles.targetSideNote}>⌘ 可随时进入沙箱验证范式拆解与联表查询</Text>
          </View>
        </View>

        <View style={styles.targetPills}>
          <Text style={styles.targetPillsLabel}>切换焦点节点</Text>
          <View accessibilityRole="tablist" accessibilityLabel="切换焦点节点" style={styles.targetPillGroup}>
            {focusNodes.map((node) => {
              const nodeTone = masteryTone(theme, node.mastery);
              const nodeState = stateOf(node.mastery);
              const active = node.id === target.id;
              return <Pressable
                key={node.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                aria-selected={active}
                disabled={anyGenerating}
                onPress={() => selectTarget(node.id)}
                style={({ pressed }) => [styles.targetPill, {
                  borderColor: active ? theme.accentSoftBorder : theme.borderSubtle,
                  backgroundColor: active ? theme.accentSoft : theme.bgSurface,
                }, pressed && styles.pressed, anyGenerating && styles.targetPillDisabled, webOnly({ cursor: anyGenerating ? "default" : "pointer" })]}
              >
                <View style={[styles.targetPillDot, { backgroundColor: active ? nodeTone : theme.textMuted }]} />
                <Text style={[styles.targetPillTitle, { color: active ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>{node.title}</Text>
                <Text style={[styles.targetPillMeta, { color: active ? nodeTone : theme.textMuted }]}>{node.mastery}% · {nodeState.glyph}</Text>
              </Pressable>;
            })}
          </View>
        </View>
      </View>
    </Reveal>

    <View style={[styles.workspace, isDesktop && styles.workspaceWide]}>
      <Reveal reducedMotion={reducedMotion} index={1} style={styles.matrixColumn}>
        <View style={styles.sectionHead}>
          <View>
            <Text style={styles.sectionKicker}>MULTIMODAL SYNTHESIS MATRIX</Text>
            <Text style={styles.sectionTitle}>6 类多模态合成矩阵</Text>
          </View>
          <View style={styles.sectionMetaPill}><Text style={styles.sectionMeta}>Bento · 6 TYPES</Text></View>
        </View>
        <View style={[styles.matrixGrid, !isDesktop && styles.matrixGridStack]}>
          {RESOURCE_TYPES.map((type, index) => <TypeCard
            key={type}
            type={type}
            node={target}
            previewType={previewType}
            generatedCount={uniqueResources.filter((resource) => resource.type === type && resource.nodeId === target.apiNodeId && resource.status !== "生成中").length}
            generating={generatingType === type}
            disabled={anyGenerating}
            onPreview={() => setPreviewType(type)}
            onGenerate={() => void generate(type)}
            index={index}
            reducedMotion={reducedMotion}
            basis={width > 0 && width < 700 ? "100%" : "48.5%"}
          />)}
        </View>
        <View style={[styles.matrixFootnote, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }]}>
          <MiniIcon name="spark" size={12} color={theme.accentPrimary} />
          <Text style={[styles.matrixFootnoteText, { color: theme.textSecondary }]}>所有资源共用同一靶向断点与画像依据；并发生成会被自动防抖禁用。</Text>
        </View>
      </Reveal>

      <Reveal reducedMotion={reducedMotion} index={2} style={styles.podColumn}>
        <PreviewPod
          previewType={previewType}
          target={target}
          resources={uniqueResources}
          latestTrace={latestTrace}
          anyGenerating={anyGenerating}
          generatingType={generatingType}
          demoRunning={demoRunning}
          reviewOpen={reviewOpen}
          onToggleReview={() => setReviewOpen((value) => !value)}
          onGenerate={(type) => void generate(type)}
          onDemo={() => void triggerDemo()}
          onOpenLatest={openResource}
        />
      </Reveal>
    </View>

    <Reveal reducedMotion={reducedMotion} index={3}>
      <View style={styles.gallerySection}>
        <View style={styles.galleryHeader}>
          <View style={styles.galleryTitleRow}>
            <View>
              <Text style={styles.sectionKicker}>GENERATED RESOURCE GALLERY</Text>
              <Text style={styles.galleryTitle}>已生成资源画廊</Text>
            </View>
            <View style={[styles.galleryCount, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
              <Text style={[styles.galleryCountText, { color: theme.accentPrimary }]}>{uniqueResources.length} 份</Text>
            </View>
          </View>
          <View style={styles.galleryTools}>
            <View style={[styles.searchBox, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
              <Text style={[styles.searchGlyph, { color: theme.textMuted }]}>⌕</Text>
              <TextInput
                accessibilityLabel="搜索资源"
                value={search}
                onChangeText={setSearch}
                placeholder="搜索标题、节点或画像依据"
                placeholderTextColor={theme.textMuted}
                style={[styles.searchInput, { color: theme.textPrimary }]}
              />
            </View>
            <View style={styles.sortRow}>
              {(["latest", "score"] as const).map((key) => <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected: sort === key }}
                onPress={() => setSort(key)}
                style={({ pressed }) => [styles.sortButton, { borderColor: sort === key ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: sort === key ? theme.accentSoft : theme.bgSurface }, pressed && styles.pressed]}
              >
                <Text style={[styles.sortText, { color: sort === key ? theme.accentPrimary : theme.textMuted }]}>{key === "latest" ? "最新" : "评分"}</Text>
              </Pressable>)}
            </View>
          </View>
        </View>
        <View accessibilityRole="tablist" accessibilityLabel="资源类型筛选" style={styles.filterPills}>
          {FILTERS.map((item) => <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === item.key }}
            aria-selected={filter === item.key}
            onPress={() => setFilter(item.key)}
            style={({ pressed }) => [styles.filterPill, { borderColor: filter === item.key ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: filter === item.key ? theme.accentSoft : theme.bgSurface }, pressed && styles.pressed]}
          >
            <Text style={[styles.filterPillText, { color: filter === item.key ? theme.accentPrimary : theme.textSecondary }]}>{item.label}</Text>
          </Pressable>)}
        </View>

        {uniqueResources.length === 0 ? <Reveal reducedMotion={reducedMotion} index={0}>
          <View style={[styles.starter, { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgGlass }]}>
            <View style={[styles.starterGlow, { backgroundColor: theme.accentGlow }]} />
            <View style={styles.starterHead}>
              <View style={[styles.starterIcon, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
                <MiniIcon name="spark" size={20} color={theme.accentPrimary} />
              </View>
              <View style={styles.starterCopy}>
                <Text style={[styles.starterKicker, { color: theme.accentPrimary }]}>STARTER PACK · 首套靶向学习包</Text>
                <Text style={[styles.starterTitle, { color: theme.textPrimary }]}>为「{target.title}」开启第一条合成链路</Text>
                <Text style={[styles.starterText, { color: theme.textSecondary }]}>当前还没有生成资源。先从最匹配当前断点的讲解文档开始，或者直接体验 ReviewAgent 的打回自愈循环。</Text>
              </View>
            </View>
            <View style={styles.starterActions}>
              <StarterAction glyph="🚀" title="一键生成讲解文档" detail={`${target.mastery}% 掌握 · 含反例与 3 条公理`} color={theme.accentPrimary} onPress={() => void generate("讲解文档")} />
              <StarterAction glyph="⚡" title="触发评委质检演示" detail="初审 65 → 自愈重构 → 94 分终审" color={theme.warning} onPress={() => void triggerDemo()} />
              <StarterAction glyph="⌘" title="进入 SQL 实验室" detail="8 表 WASM 沙箱 · 真实执行" color={theme.success} onPress={goSqlLab} />
            </View>
          </View>
        </Reveal> : filteredResources.length === 0 ? <View style={[styles.emptyFilter, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
          <Text style={[styles.emptyFilterText, { color: theme.textSecondary }]}>没有匹配当前筛选条件的资源。</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="清除筛选" onPress={() => { setFilter("all"); setSearch(""); }} style={({ pressed }) => [styles.clearButton, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
            <Text style={[styles.clearButtonText, { color: theme.accentPrimary }]}>清除筛选</Text>
          </Pressable>
        </View> : <View style={styles.galleryGrid}>
          {filteredResources.map((resource, index) => <View key={resource.id} style={{ flexBasis: galleryBasis, flexGrow: 0, minWidth: 0 }}>
            <ResourceGalleryCard resource={resource} target={target} nodes={nodes} index={index} reducedMotion={reducedMotion} />
          </View>)}
        </View>}
      </View>
    </Reveal>
  </ThemedScreen>;
}

const resourceStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

function useResourceStyles() {
  const { mode, theme } = useTheme();
  return useMemo(() => {
    const cached = resourceStyleCache.get(mode);
    if (cached) return cached;
    const created = createStyles(theme);
    resourceStyleCache.set(mode, created);
    return created;
  }, [mode, theme]);
}

function createStyles(theme: ThemeTokens) {
  const cardShadow = theme.isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px -22px rgba(0, 0, 0, 0.78)"
    : "0 10px 28px -12px rgba(41, 37, 36, 0.07), 0 2px 6px rgba(41, 37, 36, 0.035)";
  const hoverShadow = theme.isDark
    ? `inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 18px 44px -18px ${theme.accentShadow}`
    : `0 16px 34px -16px ${theme.accentShadow}, 0 3px 8px rgba(41, 37, 36, 0.04)`;
  const webCard = webOnly({ boxShadow: cardShadow, transitionProperty: "background-color, border-color, box-shadow, transform", transitionDuration: "220ms", transitionTimingFunction: "ease" }) ?? {};

  return StyleSheet.create({
    page: { paddingTop: 24, paddingBottom: 60, paddingHorizontal: 18, maxWidth: 1240, width: "100%", alignSelf: "center", gap: 16 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    cardPressed: { transform: [{ scale: 0.995 }] },

    targetCard: { position: "relative", overflow: "hidden", borderRadius: 22, borderWidth: 1, padding: 18, gap: 14, ...webCard, ...webOnly({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }) },
    targetGlow: { position: "absolute", width: 260, height: 260, borderRadius: 130, top: -170, right: -80, opacity: 0.9 },
    targetTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 22, flexWrap: "wrap" },
    targetCopy: { flex: 1, minWidth: 0, flexBasis: 280, gap: 6 },
    targetKicker: { color: theme.accentHover, fontSize: 9.5, fontWeight: "800", letterSpacing: 1.2, fontFamily: MONO_FONT },
    targetTitleRow: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 2 },
    targetMark: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    targetLabel: { color: theme.textSecondary, fontSize: 16, fontWeight: "700" },
    targetTitle: { color: theme.textPrimary, fontSize: 28, lineHeight: 36, fontWeight: "800", letterSpacing: -0.8 },
    targetMetaRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 7 },
    targetState: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    targetStateText: { fontSize: 13, fontWeight: "800" },
    targetMastery: { fontSize: 26, lineHeight: 30, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    targetGap: { color: theme.textMuted, fontSize: 13.5, fontFamily: MONO_FONT },
    targetSummary: { color: theme.textSecondary, fontSize: 16, lineHeight: 24, maxWidth: 640 },
    targetActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 4 },
    backToPath: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
    backToPathText: { fontSize: 13.5, fontWeight: "700" },
    targetStats: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    statPill: { flexDirection: "row", alignItems: "baseline", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
    statValue: { fontSize: 14, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    statLabel: { color: theme.textSecondary, fontSize: 12, fontWeight: "600" },

    targetSide: { width: 244, maxWidth: "100%", gap: 6, flexShrink: 0 },
    sqlEntry: { position: "relative", overflow: "hidden", borderRadius: 14, borderWidth: 1, ...webCard },
    sqlEntryTop: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderTopLeftRadius: 13, borderTopRightRadius: 13, backgroundColor: theme.code.headerBg, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder },
    codeDots: { flexDirection: "row", gap: 4, alignItems: "center" },
    codeDot: { width: 5, height: 5, borderRadius: 3 },
    sqlEntryCode: { color: theme.code.title, fontSize: 10.5, fontFamily: MONO_FONT, flex: 1 },
    sqlEntryGlyph: { color: theme.code.text, fontSize: 13, fontWeight: "800" },
    sqlEntryBody: { paddingHorizontal: 10, paddingVertical: 10, gap: 4 },
    sqlStatusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    sqlStatusDot: { width: 6, height: 6, borderRadius: 3 },
    sqlStatus: { fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT },
    sqlEntryTitle: { fontSize: 15, fontWeight: "800" },
    sqlEntrySub: { fontSize: 13.5, lineHeight: 20 },
    sqlEntrySheen: { position: "absolute", top: 0, bottom: 0, left: 0, width: "35%", opacity: 0.4 },
    targetSideNote: { color: theme.textMuted, fontSize: 13, lineHeight: 19, textAlign: "left" },

    targetPills: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, paddingTop: 11, borderTopWidth: 1, borderTopColor: theme.borderDivider },
    targetPillsLabel: { color: theme.textSecondary, fontSize: 13.5, fontWeight: "700", marginRight: 2 },
    targetPillGroup: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, flex: 1, minWidth: 0 },
    targetPill: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 238, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 7 },
    targetPillDot: { width: 5, height: 5, borderRadius: 3 },
    targetPillTitle: { flexShrink: 1, minWidth: 0, fontSize: 14.5, fontWeight: "700" },
    targetPillMeta: { fontSize: 13, fontFamily: MONO_FONT, fontWeight: "800" },
    targetPillDisabled: { opacity: 0.58 },

    workspace: { width: "100%", gap: 16 },
    workspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: 20 },
    matrixColumn: { flex: 55, minWidth: 0 },
    podColumn: { flex: 45, minWidth: 0 },
    sectionHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10, marginBottom: 10 },
    sectionKicker: { color: theme.accentHover, fontSize: 9, fontWeight: "800", letterSpacing: 1, fontFamily: MONO_FONT },
    sectionTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginTop: 2 },
    sectionMetaPill: { borderRadius: 999, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, paddingHorizontal: 8, paddingVertical: 4 },
    sectionMeta: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "700", fontFamily: MONO_FONT },

    matrixGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    matrixGridStack: { gap: 8 },
    typeCardWrap: { flexBasis: "48.5%", flexGrow: 1, minWidth: 0 },
    typeCard: { position: "relative", overflow: "hidden", borderRadius: 14, borderWidth: 1, padding: 14, gap: 9, height: "100%", ...webCard },
    typePreviewArea: { gap: 9 },
    typeCardHover: { transform: [{ translateY: -3 }], ...webOnly({ boxShadow: hoverShadow }) },
    typeTop: { flexDirection: "row", alignItems: "center", gap: 8 },
    typeIconBox: { width: 34, height: 34, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    typeTopCopy: { flex: 1, minWidth: 0, gap: 1 },
    typeName: { fontSize: 18, fontWeight: "800" },
    typeAgent: { fontSize: 13, fontWeight: "700", fontFamily: MONO_FONT },
    typeEta: { color: theme.textSecondary, fontSize: 12, fontFamily: MONO_FONT },
    microFormula: { borderRadius: 7, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, padding: 9, gap: 3 },
    microFormulaText: { fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT },
    microFormulaHint: { fontSize: 13 },
    microNodes: { flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "wrap" },
    microNodeWrap: { flexDirection: "row", alignItems: "center", gap: 3, minWidth: 0, flexShrink: 1 },
    microNode: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
    microNodeText: { fontSize: 13, fontWeight: "700" },
    microArrow: { fontSize: 11 },
    microCode: { borderRadius: 7, backgroundColor: theme.code.bg, borderWidth: 1, borderColor: theme.code.border, padding: 9, gap: 3 },
    microCodeComment: { color: theme.code.comment, fontSize: 12, fontFamily: MONO_FONT },
    microCodeLine: { color: theme.code.text, fontSize: 13.5, fontFamily: MONO_FONT },
    microCodeKeyword: { color: theme.code.keyword, fontWeight: "800" },
    microOptions: { flexDirection: "row", gap: 5 },
    microOption: { flex: 1, minWidth: 0, borderRadius: 5, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
    microOptionText: { fontSize: 13, fontWeight: "700" },
    microCards: { flexDirection: "row", gap: 5 },
    microCard: { flex: 1, minWidth: 0, borderRadius: 6, borderWidth: 1, padding: 7 },
    microCardText: { fontSize: 13, fontWeight: "700" },
    typePreviewText: { fontSize: 15, lineHeight: 23 },
    typeTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    typeTag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
    typeTagText: { fontSize: 13, fontWeight: "600" },
    typeBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, borderTopWidth: 1, paddingTop: 9, marginTop: "auto" },
    typeStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    typeStatus: { fontSize: 12, fontWeight: "700", flexShrink: 1, minWidth: 0 },
    synthButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderRadius: 7, paddingHorizontal: 12, paddingVertical: 9, flexShrink: 0 },
    synthButtonText: { fontSize: 14.5, fontWeight: "800" },
    synthButtonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
    synthButtonDisabled: { opacity: 0.55 },
    progressTrack: { height: 3, borderRadius: 99, backgroundColor: theme.bgElevated, overflow: "hidden" },
    progressFill: { width: "46%", height: "100%", borderRadius: 99 },
    matrixFootnote: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, marginTop: 9 },
    matrixFootnoteText: { flex: 1, fontSize: 14, lineHeight: 21 },

    pod: { borderRadius: 18, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgGlass, padding: 14, gap: 11, ...webCard, ...webOnly({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }) },
    podHead: { gap: 8 },
    podHeadTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    podKicker: { color: theme.agent, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    podTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "800", letterSpacing: -0.3 },
    podLivePill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
    podLiveDot: { width: 5, height: 5, borderRadius: 3 },
    podLiveText: { fontSize: 10.5, fontWeight: "800", fontFamily: MONO_FONT },
    podHeaderActions: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    reviewToggle: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
    reviewToggleText: { fontSize: 12, fontWeight: "700" },
    reviewToggleGlyph: { fontSize: 11, fontWeight: "800" },
    reviewDrawer: { gap: 9, borderTopWidth: 1, borderTopColor: theme.borderDivider, paddingTop: 10, marginTop: 2 },
    podTab: { borderRadius: 6, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, paddingHorizontal: 8, paddingVertical: 4 },
    podTabText: { color: theme.textSecondary, fontSize: 9.5, fontWeight: "700" },
    podBody: { gap: 9 },
    podTypeHead: { flexDirection: "row", alignItems: "center", gap: 7 },
    podTypeIcon: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    podTypeCopy: { flex: 1, minWidth: 0, gap: 1 },
    podTypeTitle: { fontSize: 17, fontWeight: "800" },
    podTypeMeta: { fontSize: 13, fontFamily: MONO_FONT, flexShrink: 1 },
    podTargetPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
    podTargetPillText: { fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT },
    podBasis: { borderRadius: 9, borderWidth: 1, padding: 8, gap: 5 },
    podBasisTitle: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.4 },
    podBasisTags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    podBasisTag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
    podBasisTagText: { fontSize: 13, fontWeight: "600" },
    podActions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    podPrimary: { flexGrow: 1, minHeight: 46, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 9 },
    podPrimaryText: { fontSize: 15, fontWeight: "800" },
    podPrimaryArrow: { fontSize: 13, fontWeight: "800" },
    podSecondary: { minHeight: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
    podSecondaryText: { color: theme.textSecondary, fontSize: 12.5, fontWeight: "700" },

    sampleCard: { borderRadius: 12, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgSurface, padding: 10, gap: 8, ...webCard },
    sampleTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" },
    sampleKickerPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
    sampleKickerText: { fontSize: 7.5, fontWeight: "800", fontFamily: MONO_FONT },
    sampleNodeName: { color: theme.textMuted, fontSize: 8.5, maxWidth: "50%" },
    sampleDoc: { gap: 5 },
    sampleDocTitle: { fontSize: 12, fontWeight: "800" },
    sampleFormula: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5, fontSize: 8.5, fontFamily: MONO_FONT, fontWeight: "700" },
    sampleBodyText: { fontSize: 9.5, lineHeight: 14 },
    sampleExampleRow: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
    sampleExampleIcon: { width: 15, height: 15, borderRadius: 4, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    sampleExampleGlyph: { fontSize: 9, fontWeight: "900" },
    sampleExampleText: { flex: 1, fontSize: 8.5, lineHeight: 13 },
    sampleAxiomRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    sampleAxiom: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
    sampleAxiomText: { fontSize: 7.5, fontWeight: "700" },
    sampleGraph: { gap: 7 },
    sampleNodes: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 3 },
    sampleNodeWrap: { flexDirection: "row", alignItems: "center", gap: 3 },
    sampleNode: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 5, gap: 3 },
    sampleNodeDot: { width: 4, height: 4, borderRadius: 2 },
    sampleNodeText: { fontSize: 8, fontWeight: "700" },
    sampleArrow: { fontSize: 9 },
    sampleGraphCaption: { fontSize: 9, lineHeight: 13 },
    sampleGraphLegend: { flexDirection: "row", gap: 10 },
    sampleLegendText: { fontSize: 7.5, fontWeight: "700" },
    sampleQuiz: { gap: 4 },
    sampleQuizKicker: { fontSize: 7.5, fontWeight: "800", fontFamily: MONO_FONT, letterSpacing: 0.3 },
    sampleQuizQuestion: { fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
    sampleOption: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 4 },
    sampleOptionMark: { width: 12, fontSize: 8, fontWeight: "900", fontFamily: MONO_FONT },
    sampleOptionText: { fontSize: 8.5, flex: 1 },
    sampleOptionTag: { fontSize: 7, fontWeight: "800" },
    sampleCode: { borderRadius: 9, backgroundColor: theme.code.bg, borderWidth: 1, borderColor: theme.code.border, padding: 8, gap: 2, overflow: "hidden" },
    sampleCodeTop: { flexDirection: "row", alignItems: "center", gap: 6, paddingBottom: 4 },
    codeTitle: { color: theme.code.title, fontSize: 7.5, fontFamily: MONO_FONT, flex: 1 },
    codeRun: { color: theme.code.string, fontSize: 7.5, fontWeight: "800", fontFamily: MONO_FONT },
    codeComment: { color: theme.code.comment, fontSize: 7.5, fontFamily: MONO_FONT },
    codeLine: { color: theme.code.text, fontSize: 8, lineHeight: 12, fontFamily: MONO_FONT },
    codeKeyword: { color: theme.code.keyword, fontWeight: "800" },
    codeType: { color: theme.code.string },
    codeFooter: { flexDirection: "row", gap: 4, paddingTop: 3 },
    codeBadge: { color: theme.code.muted, fontSize: 6.5, borderWidth: 1, borderColor: theme.code.border, borderRadius: 3, paddingHorizontal: 4, paddingVertical: 1, fontFamily: MONO_FONT },
    sampleInteractive: { gap: 5 },
    sampleInteractiveTitle: { fontSize: 10, fontWeight: "800" },
    sampleAttrRow: { flexDirection: "row", gap: 4 },
    sampleAttr: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 4 },
    sampleAttrText: { fontSize: 8.5, fontWeight: "700" },
    sampleDropZone: { borderRadius: 7, borderWidth: 1, borderStyle: "dashed", paddingVertical: 7, alignItems: "center" },
    sampleDropText: { fontSize: 8.5, fontWeight: "700" },
    sampleInteractiveHint: { fontSize: 8, fontWeight: "700" },
    sampleCards: { gap: 5 },
    sampleFlashcard: { borderRadius: 8, borderWidth: 1, padding: 7, gap: 3 },
    sampleFlashBack: { opacity: 0.92 },
    sampleFlashKicker: { fontSize: 7, fontWeight: "800", fontFamily: MONO_FONT, letterSpacing: 0.3 },
    sampleFlashTitle: { fontSize: 10, lineHeight: 14, fontWeight: "800" },
    sampleFlashHint: { fontSize: 7.5, fontWeight: "700", textAlign: "right" },
    sampleFlashBackText: { fontSize: 8.5, lineHeight: 13 },
    sampleCurveRow: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 30, paddingHorizontal: 2 },
    sampleCurveBar: { flex: 1, borderRadius: 2 },
    sampleCurveLabel: { fontSize: 7, marginLeft: 3 },
    sampleFooter: { borderTopWidth: 1, borderTopColor: theme.borderDivider, paddingTop: 5 },
    sampleFooterText: { color: theme.textMuted, fontSize: 7.5, lineHeight: 11 },

    demoTrigger: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 10, borderWidth: 1, padding: 8 },
    demoTriggerIcon: { width: 28, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    demoTriggerCopy: { flex: 1, minWidth: 0, gap: 2 },
    demoTriggerTitle: { fontSize: 13, fontWeight: "800" },
    demoTriggerSub: { fontSize: 11.5, lineHeight: 17 },
    demoTriggerCta: { fontSize: 11, fontWeight: "800" },
    pipeline: { gap: 4 },
    stage: { borderRadius: 10, borderWidth: 1, padding: 8, gap: 5 },
    stageTop: { flexDirection: "row", alignItems: "center", gap: 6 },
    stageIcon: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    stageCopy: { flex: 1, minWidth: 0, gap: 1 },
    stageTitle: { fontSize: 13, fontWeight: "800" },
    stageMeta: { fontSize: 12.5, fontFamily: MONO_FONT, fontWeight: "700" },
    stageBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 1 },
    stageBadgeText: { fontSize: 12, fontWeight: "800" },
    stageDesc: { fontSize: 13, lineHeight: 20 },
    stageReason: { borderRadius: 5, borderWidth: 1, padding: 5 },
    stageReasonText: { fontSize: 12.5, lineHeight: 18, fontWeight: "600" },
    stageConnector: { height: 20, alignItems: "center", justifyContent: "center" },
    stageLine: { position: "absolute", width: 1, top: 0, bottom: 0 },
    stageLoop: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: theme.bgSurface },
    stageLoopText: { fontSize: 12, fontWeight: "800" },
    stageConnectorLabel: { fontSize: 12, fontWeight: "800", backgroundColor: theme.bgSurface, paddingHorizontal: 5, borderRadius: 3 },
    qualityGrid: { gap: 3, paddingTop: 2 },
    qualityRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    qualityLabel: { color: theme.textSecondary, width: 60, fontSize: 12 },
    qualityTrack: { flex: 1, height: 4, borderRadius: 99, overflow: "hidden" },
    qualityFill: { height: "100%", borderRadius: 99 },
    qualityValue: { width: 26, textAlign: "right", fontSize: 12, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    qualityFootnote: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
    qualityFootnoteText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
    qualityPending: { borderRadius: 7, borderWidth: 1, paddingVertical: 9, alignItems: "center" },
    qualityPendingText: { fontSize: 12, fontWeight: "600" },
    traceWrap: { marginTop: 2 },

    gallerySection: { gap: 10, paddingTop: 2 },
    galleryHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    galleryTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    galleryTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.3, marginTop: 2 },
    galleryCount: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
    galleryCountText: { fontSize: 12, fontWeight: "800", fontFamily: MONO_FONT },
    galleryTools: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, flexWrap: "wrap", flex: 1, minWidth: 240 },
    searchBox: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, minHeight: 36, flexGrow: 1, maxWidth: 300, minWidth: 170 },
    searchGlyph: { fontSize: 14, fontWeight: "800" },
    searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 4 },
    sortRow: { flexDirection: "row", gap: 3 },
    sortButton: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 5 },
    sortText: { fontSize: 12.5, fontWeight: "700" },
    filterPills: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    filterPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
    filterPillText: { fontSize: 13, fontWeight: "700" },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
    galleryCardWrap: { width: "100%" },
    galleryCard: { position: "relative", overflow: "hidden", borderRadius: 14, borderWidth: 1, padding: 11, gap: 5, height: "100%", ...webCard },
    galleryCardHighlight: { ...webOnly({ boxShadow: `0 0 0 1px ${theme.accentRing}` }) },
    galleryCardHover: { transform: [{ translateY: -3 }], ...webOnly({ boxShadow: hoverShadow }) },
    galleryHighlightRail: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
    galleryTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, flexWrap: "wrap" },
    galleryType: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 3 },
    galleryTypeText: { fontSize: 13, fontWeight: "800" },
    galleryScore: { flexDirection: "row", alignItems: "center", gap: 3, borderRadius: 999, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 1, minWidth: 0 },
    galleryScoreText: { fontSize: 12.5, fontWeight: "800", fontFamily: MONO_FONT },
    galleryStatusBusy: { flexDirection: "row", alignItems: "center", gap: 3 },
    galleryStatusBusyText: { fontSize: 12, fontWeight: "700" },
    galleryCardTitle: { fontSize: 17, lineHeight: 24, fontWeight: "800", color: theme.textPrimary },
    galleryNodeRow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    galleryNodeText: { flexShrink: 1, minWidth: 0, fontSize: 13.5, fontWeight: "600" },
    galleryCurrentPill: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
    galleryCurrentText: { fontSize: 11.5, fontWeight: "800" },
    gallerySummary: { fontSize: 14, lineHeight: 21 },
    galleryReason: { fontSize: 13, fontStyle: "italic" },
    galleryBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, marginTop: 3, borderTopWidth: 1, borderTopColor: theme.borderDivider, paddingTop: 6 },
    galleryTags: { flexDirection: "row", flexWrap: "wrap", gap: 3, flexShrink: 1 },
    gallerySourceTag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 4, paddingVertical: 1 },
    gallerySourceText: { fontSize: 11.5, fontWeight: "700" },
    galleryOpen: { fontSize: 13, fontWeight: "800", flexShrink: 0 },

    starter: { position: "relative", overflow: "hidden", borderRadius: 18, borderWidth: 1, padding: 16, gap: 12, ...webCard },
    starterGlow: { position: "absolute", width: 220, height: 220, borderRadius: 110, right: -60, top: -120 },
    starterHead: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    starterIcon: { width: 38, height: 38, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    starterCopy: { flex: 1, minWidth: 0, gap: 3 },
    starterKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    starterTitle: { fontSize: 22, lineHeight: 29, fontWeight: "800", letterSpacing: -0.3 },
    starterText: { fontSize: 15, lineHeight: 22 },
    starterActions: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    starterAction: { flexBasis: "31%", flexGrow: 1, minWidth: 190, borderRadius: 11, borderWidth: 1, padding: 14, gap: 4, ...webOnly({ transitionProperty: "transform, border-color, box-shadow", transitionDuration: "200ms" }) },
    starterActionHover: { transform: [{ translateY: -3 }], ...webOnly({ boxShadow: hoverShadow }) },
    starterActionIcon: { width: 34, height: 34, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    starterActionTitle: { fontSize: 17, fontWeight: "800" },
    starterActionText: { fontSize: 14.5, lineHeight: 21 },
    starterActionCta: { fontSize: 14, fontWeight: "800", marginTop: 2 },
    emptyFilter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", borderRadius: 10, borderWidth: 1, padding: 12 },
    emptyFilterText: { fontSize: 10 },
    clearButton: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
    clearButtonText: { fontSize: 9, fontWeight: "700" },
  });
}
