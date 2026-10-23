import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ViewProps, type ViewStyle } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { MiniIcon } from "../../components/mini-icon";
import { Reveal, revealData, revealDelay, useScrollReveal } from "../../components/scroll-reveal";
import { ThemeSwitcher } from "../../components/theme-switcher";
import { EmptyPanel, LoadingPanel, ThemedScreen } from "../../components/theme-ui";
import { useHydratedWidth } from "../../lib/use-hydrated-width";
import { conceptColumnsForNode, essenceForNode, exampleForNode, factsForNode, pitfallForNode, quizForNode, summaryForNode } from "../../lib/learning-content";
import {
  TOPOLOGY_NODES,
  countsOf,
  downstreamCount,
  filterNodes,
  focusChain,
  mergePath,
  nodeById,
  stateOf,
  type NodeStateKey,
  type TopologyNode,
} from "../../lib/path-topology";
import { useApp } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";

type FilterKey = "all" | NodeStateKey;
type PathGroupKey = "relations" | "sql" | "design" | "index" | "tx";
type Tone = { color: string; soft: string; border: string };

const PATH_GROUPS: readonly { key: PathGroupKey; label: string; caption: string }[] = [
  { key: "relations", label: "关系模型", caption: "表、键与完整性" },
  { key: "sql", label: "SQL 核心", caption: "查询、连接与聚合" },
  { key: "design", label: "规范化设计", caption: "依赖、分解与异常" },
  { key: "index", label: "索引与调优", caption: "存储、索引与计划" },
  { key: "tx", label: "事务并发", caption: "事务、隔离与恢复" },
];

function groupForNode(node: TopologyNode): PathGroupKey {
  if (node.chapterKey !== "storage") return node.chapterKey as PathGroupKey;
  return ["btree", "index-design", "optimizer", "slow-query", "join-algorithms"].includes(node.id) ? "index" : "tx";
}

const FILTERS: readonly { key: FilterKey; label: string; short: string }[] = [
  { key: "all", label: "全部节点", short: "全部" },
  { key: "remedial", label: "补救 <60%", short: "补救" },
  { key: "steady", label: "巩固 60–79%", short: "巩固" },
  { key: "mastered", label: "掌握 ≥80%", short: "掌握" },
];

const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

function webOnly(style: Record<string, unknown>): ViewStyle | null {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : null;
}

function webProps(style: Record<string, unknown>): ViewStyle {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : {};
}

function pct(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

const motion = StyleSheet.create({
  shimmer: webAnimation({ animationKeyframes: "shimmer", animationDuration: "3.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  pulseRing: webAnimation({ animationKeyframes: "pulseRing", animationDuration: "1.8s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
  panelIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" }),
  timelineFlow: webAnimation({ animationKeyframes: "timelineFlow", animationDuration: "2.4s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  flowDot: webAnimation({ animationKeyframes: "flowDot", animationDuration: "2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  boostGrow: webAnimation({ animationKeyframes: "boostGrow", animationDuration: "650ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", transformOrigin: "left center" }),
  priorityBreath: webAnimation({ animationKeyframes: "priorityBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
});

function toneFor(theme: ThemeTokens, key: NodeStateKey): Tone {
  if (key === "mastered") return { color: theme.success, soft: theme.successSoft, border: `${theme.success}55` };
  if (key === "steady") return { color: theme.accentPrimary, soft: theme.accentSoft, border: theme.accentSoftBorder };
  return { color: theme.warning, soft: theme.warningSoft, border: `${theme.warning}55` };
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
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== "function") return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduced(value); })
      .catch(() => {});
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
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reducedMotion]);
  return reducedMotion ? target : value;
}

function useRevealFlag(reducedMotion: boolean) {
  const [visible, setVisible] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);
  return reducedMotion || visible;
}

function KpiStat({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  const styles = usePathStyles();
  return <View style={styles.kpiStat}>
    <View style={styles.kpiLabelRow}>
      <View style={[styles.kpiDot, { backgroundColor: color }]} />
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
    <View style={styles.kpiValueRow}>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiUnit}>{unit}</Text>
    </View>
  </View>;
}

function DagNode({ node, nodes, selected, dim, onSelect }: { node: TopologyNode; nodes: readonly TopologyNode[]; selected: boolean; dim: boolean; onSelect: () => void }) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const state = stateOf(node.mastery);
  const tone = toneFor(theme, state.key);
  const blocked = downstreamCount(nodes, node.id);
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${node.title}，掌握度 ${node.mastery}%`}
    accessibilityState={{ selected }}
    onPress={onSelect}
    style={({ pressed }) => [
      styles.dagNode,
      { borderColor: selected ? theme.accentPrimary : tone.border, backgroundColor: selected ? theme.accentSoft : theme.bgSurface },
      selected && webOnly({ boxShadow: `0 0 0 1px ${theme.accentRing}, 0 8px 20px ${theme.accentGlow}` }),
      dim && styles.dagNodeDim,
      pressed && styles.dagNodePressed,
      webOnly({ cursor: "pointer", transitionProperty: "transform, border-color, background-color, box-shadow", transitionDuration: "180ms" }),
    ]}
  >
    <View style={styles.dagNodeTop}>
      <View style={styles.dagStatusWrap}>
        {state.key === "remedial" ? <View pointerEvents="none" style={[styles.dagPulse, motion.pulseRing, { borderColor: tone.color }]} /> : null}
        <View style={[styles.dagStatusDot, { backgroundColor: tone.color }]} />
      </View>
      <Text style={[styles.dagStatusText, { color: tone.color }]} numberOfLines={1}>{state.label}</Text>
      <Text style={[styles.dagNodeMastery, { color: tone.color }]}>{node.mastery}%</Text>
    </View>
    <Text style={styles.dagNodeTitle} numberOfLines={2}>{node.title}</Text>
    <View style={styles.dagNodeFoot}>
      {state.key === "remedial"
        ? <Text style={[styles.dagBlocked, { color: theme.warning }]} numberOfLines={1}>! 阻塞后续 {blocked}</Text>
        : <Text style={[styles.dagStatusText, { color: tone.color }]} numberOfLines={1}>{state.key === "mastered" ? "✓ 已通关" : `距精通 ${80 - node.mastery}%`}</Text>}
      <Text style={styles.dagNodeMinutes}>⏱ {node.minutes}m</Text>
    </View>
  </Pressable>;
}

function DagConnector({ from, to }: { from: TopologyNode; to: TopologyNode }) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const blocked = from.mastery < 60;
  return <View style={styles.dagConnector}>
    <View style={[styles.dagConnectorLine, { backgroundColor: blocked ? theme.warning : theme.borderSubtle }]} />
    {blocked
      ? <View style={[styles.dagConnectorWarning, motion.priorityBreath, { backgroundColor: theme.warning }]} />
      : <View style={[styles.dagConnectorDot, motion.flowDot, { backgroundColor: theme.accentPrimary }]} />}
    <Text style={[styles.dagArrow, { color: blocked ? theme.warning : theme.textMuted }]}>→</Text>
  </View>;
}

function TopologyCommandBar({
  nodes,
  counts,
  animated,
  filter,
  onFilter,
  selectedId,
  onSelect,
  reducedMotion,
  barLoaded,
}: {
  nodes: readonly TopologyNode[];
  counts: ReturnType<typeof countsOf>;
  animated: { all: number; remedial: number; steady: number; mastered: number };
  filter: FilterKey;
  onFilter: (filter: FilterKey) => void;
  selectedId: string;
  onSelect: (id: string) => void;
  reducedMotion: boolean;
  barLoaded: boolean;
}) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const chain = focusChain(nodes, selectedId);
  const dagRef = useRef<ScrollView | null>(null);
  const selectedIndex = chain.findIndex((node) => node.id === selectedId);
  const segments = [
    { key: "remedial", value: counts.remedial, color: theme.warning },
    { key: "steady", value: counts.steady, color: theme.accentPrimary },
    { key: "mastered", value: counts.mastered, color: theme.success },
  ] as const;

  useEffect(() => {
    if (selectedIndex < 0) return;
    const frame = requestAnimationFrame(() => {
      dagRef.current?.scrollTo({ x: Math.max(0, selectedIndex * 200 - 12), animated: !reducedMotion });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId, selectedIndex, chain.length, reducedMotion]);

  return <View style={styles.commandBar}>
    <View style={styles.commandTop}>
      <View style={styles.commandCopy}>
        <Text style={styles.commandKicker}>TOPOLOGY COMMAND · LIVE MASTERY</Text>
        <Text style={styles.commandTitle}>全景知识拓扑控制台</Text>
      </View>
      <View style={styles.commandMetaPill}>
        <Text style={styles.commandMeta}>{nodes.length} NODES · {nodes.filter((node) => node.pathNode).length} 当前路径</Text>
      </View>
    </View>

    <View style={styles.kpiRow}>
      <KpiStat label="总知识节点" value={animated.all} unit="节点" color={theme.textPrimary} />
      <KpiStat label="待补断点" value={animated.remedial} unit="节点" color={theme.warning} />
      <KpiStat label="巩固中" value={animated.steady} unit="节点" color={theme.accentPrimary} />
      <KpiStat label="已掌握" value={animated.mastered} unit="节点" color={theme.success} />
    </View>

    <View style={styles.segmentWrap}>
      <View style={[styles.segmentTrack, webOnly({ transformOrigin: "left center", transitionProperty: "transform", transitionDuration: "900ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }), { transform: [{ scaleX: barLoaded || reducedMotion ? 1 : 0 }] }]}>
        {segments.map((segment) => <View key={segment.key} style={[styles.segment, { flex: Math.max(0.01, segment.value), backgroundColor: segment.color }]} />)}
      </View>
      <View style={styles.segmentLegend}>
        {segments.map((segment) => <View key={segment.key} style={styles.segmentLegendItem}>
          <View style={[styles.segmentLegendDot, { backgroundColor: segment.color }]} />
          <Text style={styles.segmentLegendText}>{segment.key === "remedial" ? "待补" : segment.key === "steady" ? "巩固" : "掌握"} {counts[segment.key]}</Text>
        </View>)}
      </View>
    </View>

    <View style={styles.filterRow}>
      {FILTERS.map((item) => {
        const active = filter === item.key;
        const tone = item.key === "remedial" ? theme.warning : item.key === "mastered" ? theme.success : theme.accentPrimary;
        return <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityLabel={`${item.label}，${counts[item.key]} 个节点`}
          accessibilityState={{ selected: active }}
          aria-selected={active}
          onPress={() => onFilter(item.key)}
          style={({ pressed }) => [
            styles.filterPill,
            { borderColor: active ? tone : theme.borderSubtle, backgroundColor: active ? (item.key === "remedial" ? theme.warningSoft : item.key === "mastered" ? theme.successSoft : theme.accentSoft) : theme.bgSurface },
            active && webOnly({ boxShadow: `0 0 0 1px ${tone}22, 0 6px 16px ${tone}12` }),
            pressed && styles.filterPressed,
            webOnly({ cursor: "pointer", transitionProperty: "background-color, border-color, box-shadow", transitionDuration: "180ms" }),
          ]}
        >
          <View style={[styles.filterDot, { backgroundColor: tone }]} />
          <Text style={[styles.filterLabel, { color: active ? tone : theme.textSecondary }]}>{item.label}</Text>
          <View style={[styles.filterCount, { backgroundColor: active ? theme.bgSurface : theme.bgElevated }]}>
            <Text style={[styles.filterCountText, { color: active ? tone : theme.textMuted }]}>{counts[item.key]}</Text>
          </View>
        </Pressable>;
      })}
    </View>

    <View style={styles.dagPanel}>
      <View style={styles.dagHead}>
        <View style={styles.dagHeadCopy}>
          <Text style={styles.dagTitle}>可视化知识依赖拓扑</Text>
          <Text style={styles.dagHint}>当前链路 {chain.length} 节 · 横向滑动 · 点击节点联动路径与深度检视</Text>
        </View>
        <View style={styles.dagLegend}>
          <View style={[styles.dagLegendDot, { backgroundColor: theme.warning }]} /><Text style={styles.dagLegendText}>断点</Text>
          <View style={[styles.dagLegendDot, { backgroundColor: theme.accentPrimary }]} /><Text style={styles.dagLegendText}>巩固</Text>
          <View style={[styles.dagLegendDot, { backgroundColor: theme.success }]} /><Text style={styles.dagLegendText}>掌握</Text>
        </View>
      </View>
      <ScrollView ref={dagRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dagScrollContent}>
        <View style={styles.dagChain}>
          {chain.map((node, index) => {
            const state = stateOf(node.mastery);
            return <View key={node.id} style={styles.dagChainItem}>
              <DagNode
                node={node}
                nodes={nodes}
                selected={node.id === selectedId}
                dim={filter !== "all" && state.key !== filter}
                onSelect={() => onSelect(node.id)}
              />
              {index < chain.length - 1 && chain[index + 1] ? <DagConnector from={node} to={chain[index + 1]!} /> : null}
            </View>;
          })}
        </View>
      </ScrollView>
    </View>
  </View>;
}

function MilestoneRow({
  node,
  nodes,
  order,
  isLast,
  selected,
  reducedMotion,
  generatingId,
  onSelect,
  onResource,
  onTutor,
  onQuickNote,
  scrollRequest,
}: {
  node: TopologyNode;
  nodes: readonly TopologyNode[];
  order: number;
  isLast: boolean;
  selected: boolean;
  reducedMotion: boolean;
  generatingId: string | null;
  onSelect: () => void;
  onResource: () => void;
  onTutor: () => void;
  onQuickNote: () => void;
  scrollRequest: number;
}) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const { ref, visible } = useScrollReveal(reducedMotion);
  const [hovered, setHovered] = useState(false);
  const state = stateOf(node.mastery);
  const tone = toneFor(theme, state.key);
  const prev = nodeById(nodes, node.prereqs[0] ?? null);
  const next = nodeById(nodes, node.next[0] ?? null);
  const prevLabel = prev?.title ?? (node.prereqs.length === 0 ? "无 · 根节点" : "课程基础");
  const gap = node.mastery < 60 ? 60 - node.mastery : node.mastery < 80 ? 80 - node.mastery : 0;
  const busy = generatingId === node.id;

  useEffect(() => {
    if (!selected || scrollRequest <= 0 || Platform.OS !== "web") return;
    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(`path-node-${node.id}`);
      if (!element) return;
      const rect = element.getBoundingClientRect();
      if (rect.top >= 72 && rect.bottom <= window.innerHeight - 76) return;
      element.scrollIntoView({ block: "center", behavior: reducedMotion ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selected, scrollRequest, node.id, reducedMotion]);

  return <View
    ref={ref}
    nativeID={`path-node-${node.id}`}
    {...(revealData(visible) as ViewProps)}
    style={[styles.milestoneRow, revealDelay(Math.min(order - 1, 8), reducedMotion)]}
  >
    <View style={[styles.statusRing, { borderColor: `${tone.color}88`, backgroundColor: tone.soft }]}>
      <Text style={[styles.statusRingValue, { color: tone.color }]}>{node.mastery}%</Text>
      <Text style={[styles.statusRingGlyph, { color: tone.color }]}>{state.glyph}</Text>
    </View>
    {!isLast ? <View style={[styles.compactConnector, { backgroundColor: `${tone.color}22` }]}>
      {node.mastery >= 80 ? <View style={[styles.compactConnectorFlow, motion.timelineFlow, webOnly({ backgroundImage: `linear-gradient(180deg, transparent 0%, ${theme.success} 48%, transparent 100%)`, backgroundSize: "100% 42%", backgroundRepeat: "no-repeat" })]} /> : null}
      {node.mastery < 60 ? <View style={[styles.compactConnectorWarning, motion.priorityBreath, { backgroundColor: theme.warning }]} /> : null}
    </View> : null}

    <View style={[
      styles.compactCard,
      { borderColor: selected ? theme.accentPrimary : theme.borderSubtle, backgroundColor: selected ? theme.bgSurface : theme.bgSurface },
      selected && styles.compactCardSelected,
      hovered && styles.compactCardHover,
      webOnly({ transitionProperty: "transform, border-color, box-shadow", transitionDuration: "180ms" }),
    ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${node.title}，掌握度 ${node.mastery}%，${state.label}`}
        accessibilityState={{ selected }}
        onPress={onSelect}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        style={({ pressed }) => [styles.compactMain, pressed && styles.compactMainPressed, webOnly({ cursor: "pointer" })]}
      >
        <View style={styles.compactTitleRow}>
          <Text style={[styles.compactTitle, { color: theme.textPrimary }]} numberOfLines={2}>{node.title}</Text>
          {node.pathNode ? <View style={[styles.compactPathTag, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.compactPathText, { color: theme.accentPrimary }]}>{node.pathStatus === "active" ? "推荐" : "路径"}</Text></View> : null}
          <View style={[styles.compactGapPill, { backgroundColor: tone.soft, borderColor: tone.border }]}><Text style={[styles.compactGapText, { color: tone.color }]}>{node.mastery >= 80 ? "已精通" : node.mastery < 60 ? `差 ${gap}%` : `距精通 ${gap}%`}</Text></View>
        </View>
        <View style={styles.compactMetaRow}>
          <Text style={[styles.compactState, { color: tone.color }]}>{state.glyph} {state.label}</Text>
          <Text style={styles.compactMinutes}>⏱ {node.minutes}m</Text>
          <Text style={styles.compactRelation} numberOfLines={1}>前置 {prevLabel} → 解锁 {next?.title ?? "课程完结"}</Text>
        </View>
        <View style={styles.compactBarTrack}>
          <View style={[styles.compactBarFill, { width: pct(visible ? node.mastery : 0), backgroundColor: tone.color }, webOnly({ transitionProperty: "width", transitionDuration: "750ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" })]} />
          <View style={[styles.compactMarker, { left: pct(60) }]} />
          <View style={[styles.compactMarker, { left: pct(80) }]} />
        </View>
      </Pressable>
      <View style={styles.compactActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={`速记${node.title}的核心概念`} onPress={onQuickNote} style={({ pressed }) => [styles.compactAction, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.compactActionPressed]}>
          <MiniIcon name="book" size={13} color={theme.accentPrimary} />
          <Text style={[styles.compactActionText, { color: theme.accentPrimary }]}>速记</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`生成${node.title}的靶向资源`} disabled={Boolean(generatingId)} onPress={onResource} style={({ pressed }) => [styles.compactAction, styles.compactActionPrimary, { borderColor: theme.accentPrimary, backgroundColor: theme.accentPrimary }, pressed && styles.compactActionPressed, Boolean(generatingId) && styles.compactActionDisabled]}>
          {busy ? <ActivityIndicator size="small" color={theme.onAccent} /> : <MiniIcon name="spark" size={13} color={theme.onAccent} />}
          <Text style={[styles.compactActionText, { color: theme.onAccent }]}>生成</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`就${node.title}向 AI 导师提问`} onPress={onTutor} style={({ pressed }) => [styles.compactAction, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.compactActionPressed]}>
          <MiniIcon name="spark" size={13} color={theme.accentPrimary} />
          <Text style={[styles.compactActionText, { color: theme.accentPrimary }]}>提问</Text>
        </Pressable>
      </View>
    </View>
  </View>;
}

function NormalizationVisual({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const steps = [
    { key: "1NF", title: "原子性", caption: "每列不可再分" },
    { key: "2NF", title: "消除部分依赖", caption: "非主属性依赖整个键" },
    { key: "3NF", title: "消除传递依赖", caption: "非主属性不依赖非键" },
    { key: "BCNF", title: "决定因素含候选码", caption: "每个决定因素都是超键" },
  ];
  const active = node.id === "nf-1-2" ? 1 : node.id === "nf-3bc" ? 3 : 2;
  return <View style={styles.normalizationRow}>
    {steps.map((step, index) => <View key={step.key} style={styles.normStepWrap}>
      <View style={[
        styles.normStep,
        { borderColor: index <= active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: index === active ? theme.accentSoft : theme.bgElevated },
        index === active && webOnly({ boxShadow: `0 0 0 1px ${theme.accentRing}` }),
      ]}>
        <Text style={[styles.normStepKey, { color: index <= active ? theme.accentPrimary : theme.textMuted }]}>{step.key}</Text>
        <Text style={[styles.normStepTitle, { color: index <= active ? theme.textPrimary : theme.textSecondary }]} numberOfLines={2}>{step.title}</Text>
        <Text style={styles.normStepCaption} numberOfLines={3}>{step.caption}</Text>
      </View>
      {index < steps.length - 1 ? <Text style={[styles.normArrow, { color: theme.textMuted }]}>→</Text> : null}
    </View>)}
  </View>;
}

function KeysVisual() {
  const { theme } = useTheme();
  const styles = usePathStyles();
  return <View style={styles.keysVisual}>
    <View style={[styles.keyLayer, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }]}>
      <Text style={[styles.keyLayerTitle, { color: theme.accentPrimary }]}>超键</Text>
      <Text style={styles.keyLayerText}>能唯一标识元组的属性集</Text>
      <View style={[styles.keyLayerInner, { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgSurface }]}>
        <Text style={[styles.keyLayerTitle, { color: theme.accentPrimary }]}>候选键</Text>
        <Text style={styles.keyLayerText}>最小超键，可能有多个</Text>
        <View style={[styles.keyLayerInner, { borderColor: theme.successSoft, backgroundColor: theme.successSoft }]}>
          <Text style={[styles.keyLayerTitle, { color: theme.success }]}>主键</Text>
          <Text style={styles.keyLayerText}>从候选键中选定的一个</Text>
        </View>
      </View>
    </View>
    <View style={[styles.fkChip, { borderColor: theme.warningSoft, backgroundColor: theme.warningSoft }]}>
      <Text style={[styles.fkText, { color: theme.warning }]}>外键 · 引用另一个关系的候选键，维护参照完整性</Text>
    </View>
  </View>;
}

function AnomaliesVisual() {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const items = [
    { title: "插入异常", text: "新系还没有学生时，无法单独插入系信息。" },
    { title: "删除异常", text: "删除最后一名学生，系名与系主任信息一并丢失。" },
    { title: "更新异常", text: "更换系主任需要更新多行，漏改会造成数据不一致。" },
  ];
  return <View style={styles.anomaliesGrid}>
    {items.map((item) => <View key={item.title} style={[styles.anomalyCard, { borderColor: theme.warningSoft, backgroundColor: theme.warningSoft }]}>
      <Text style={[styles.anomalyTitle, { color: theme.warning }]}>{item.title}</Text>
      <Text style={styles.anomalyText}>{item.text}</Text>
    </View>)}
  </View>;
}

function ConceptFlowVisual({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const width = useHydratedWidth();
  const narrow = width > 0 && width < 720;
  const { definition, example, pitfall } = conceptColumnsForNode(node);
  const columns = [
    { key: "definition", title: "核心定义", text: definition, color: theme.accentPrimary, soft: theme.accentSoft, border: theme.accentSoftBorder },
    { key: "example", title: "真实正例", text: example, color: theme.success, soft: theme.successSoft, border: `${theme.success}55` },
    { key: "pitfall", title: "典型反例", text: pitfall, color: theme.warning, soft: theme.warningSoft, border: `${theme.warning}55` },
  ] as const;
  return <View style={[styles.conceptFlow, narrow && styles.conceptFlowStack]}>
    {columns.map((column, index) => <View key={column.key} style={[styles.conceptStepWrap, narrow && styles.conceptStepWrapStack]}>
      <View style={[styles.conceptCard, { borderColor: column.border, backgroundColor: column.soft }]}>
        <Text style={[styles.conceptTitle, { color: column.color }]}>{column.title}</Text>
        <Text style={styles.conceptText}>{column.text}</Text>
      </View>
      {index < columns.length - 1 ? <Text style={[styles.conceptArrow, narrow && styles.conceptArrowStack, { color: theme.textMuted }]}>{narrow ? "↓" : "→"}</Text> : null}
    </View>)}
  </View>;
}

function FlashcardVisual({ node }: { node: TopologyNode }) {
  if (node.flashcard.visual === "normalization") return <NormalizationVisual node={node} />;
  if (node.flashcard.visual === "keys") return <KeysVisual />;
  if (node.flashcard.visual === "anomalies") return <AnomaliesVisual />;
  return <ConceptFlowVisual node={node} />;
}

function MemoryPod({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const [tab, setTab] = useState<"concept" | "pitfall" | "quiz">("concept");
  const [choice, setChoice] = useState<number | null>(null);
  const quiz = quizForNode(node);
  const correct = choice === quiz.correct;
  const visibleOptions = ["概念图解", "典型错例", "随堂1题自测"] as const;
  const tabs: { key: typeof tab; label: string }[] = [
    { key: "concept", label: visibleOptions[0] },
    { key: "pitfall", label: visibleOptions[1] },
    { key: "quiz", label: visibleOptions[2] },
  ];

  return <View style={styles.module}>
    <View style={styles.moduleHead}>
      <View style={[styles.moduleIcon, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
        <MiniIcon name="book" size={15} color={theme.accentPrimary} />
      </View>
      <View style={styles.moduleHeadCopy}>
        <Text style={styles.moduleKicker} numberOfLines={1}>MEMORY POD</Text>
        <Text style={styles.moduleTitle}>节点速记卡</Text>
      </View>
      <Text style={styles.moduleMeta}>30 秒速记</Text>
    </View>

    <View style={styles.tabs}>
      {tabs.map((item) => {
        const active = tab === item.key;
        return <Pressable
          key={item.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          aria-selected={active}
          onPress={() => setTab(item.key)}
          style={({ pressed }) => [styles.tab, active && { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }, pressed && styles.tabPressed]}
        >
          <Text style={[styles.tabText, active && { color: theme.accentPrimary }]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>

    <View key={tab} style={[styles.tabBody, motion.panelIn]}>
      {tab === "concept" ? <>
        <View style={[styles.essenceCard, { borderLeftColor: theme.accentPrimary, backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.essenceKicker, { color: theme.accentPrimary }]}>一句话本质</Text>
          <Text style={styles.essenceText}>{essenceForNode(node)}</Text>
        </View>
        <FlashcardVisual node={node} />
        <View style={styles.analogyRow}>
          <MiniIcon name="spark" size={14} color={theme.accentPrimary} />
          <View style={styles.analogyCopy}>
            <Text style={[styles.analogyKicker, { color: theme.accentPrimary }]}>关键边界</Text>
            <Text style={styles.analogyText}>{factsForNode(node)[1]}</Text>
          </View>
        </View>
      </> : null}

      {tab === "pitfall" ? <>
        <View style={[styles.pitfallCard, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }]}>
          <Text style={[styles.pitfallTitle, { color: theme.warning }]}>常见误区</Text>
          <Text style={styles.pitfallText}>{pitfallForNode(node)}</Text>
        </View>
        <View style={[styles.exampleCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
          <Text style={[styles.exampleTitle, { color: theme.textMuted }]}>对比例子</Text>
          <Text style={styles.exampleText}>{exampleForNode(node)}</Text>
        </View>
      </> : null}

      {tab === "quiz" ? <>
        <Text style={styles.quizQuestion}>{quiz.question}</Text>
        <View style={styles.quizOptions}>
          {quiz.options.map((option, index) => {
            const chosen = choice === index;
            const isCorrect = index === quiz.correct;
            const state = choice === null ? "default" : isCorrect ? "correct" : chosen ? "wrong" : "muted";
            return <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{ selected: chosen }}
              onPress={() => setChoice(index)}
              style={({ pressed }) => [
                styles.quizOption,
                { borderColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.borderSubtle, backgroundColor: state === "correct" ? theme.successSoft : state === "wrong" ? theme.warningSoft : theme.bgSurface },
                selectedStyle(styles, chosen),
                pressed && styles.quizOptionPressed,
              ]}
            >
              <Text style={[styles.quizMark, { color: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.textMuted }]}>{state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + index)}</Text>
              <Text style={styles.quizOptionText}>{option}</Text>
            </Pressable>;
          })}
        </View>
        {choice !== null ? <Text style={[styles.quizExplanation, { color: correct ? theme.success : theme.warning }]}>{correct ? "✓ " : "✕ "}{quiz.explanation}</Text> : null}
        {correct ? <View style={[styles.boostCard, motion.panelIn, { borderColor: `${theme.success}44`, backgroundColor: theme.successSoft }]}>
          <View style={styles.boostHead}>
            <Text style={[styles.boostKicker, { color: theme.success }]}>掌握度预测预览</Text>
            <Text style={[styles.boostValue, { color: theme.success }]}>+5%</Text>
          </View>
          <View style={styles.boostTrack}>
            <View style={[styles.boostBase, { width: pct(node.mastery), backgroundColor: theme.accentPrimary }]} />
            <View style={[styles.boostExtra, motion.boostGrow, { left: pct(node.mastery), width: pct(Math.min(5, 100 - node.mastery)), backgroundColor: theme.success }]} />
          </View>
          <Text style={styles.boostText}>{node.mastery}% → {Math.min(100, node.mastery + 5)}% · 仅预测，不写入画像</Text>
        </View> : null}
      </> : null}
    </View>
  </View>;
}

function selectedStyle(styles: ReturnType<typeof createStyles>, chosen: boolean) {
  return chosen ? styles.quizOptionChosen : undefined;
}

function NodeInspector({
  node,
  nodes,
  generatingId,
  existingResourceId,
  onResource,
  onTutor,
  onSqlLab,
  onClose,
}: {
  node: TopologyNode;
  nodes: readonly TopologyNode[];
  generatingId: string | null;
  existingResourceId: string | null;
  onResource: () => void;
  onTutor: () => void;
  onSqlLab: () => void;
  onClose?: () => void;
}) {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const state = stateOf(node.mastery);
  const tone = toneFor(theme, state.key);
  const blocked = downstreamCount(nodes, node.id);
  const prereqs = node.prereqs.map((id) => nodeById(nodes, id)).filter((item): item is TopologyNode => Boolean(item));
  const busy = generatingId === node.id;
  const gap = node.mastery < 60 ? 60 - node.mastery : node.mastery < 80 ? 80 - node.mastery : 0;

  return <View style={styles.inspectorCard}>
    <View style={styles.inspectorHeader}>
      <View style={[styles.inspectorKickerRow]}>
        <Text style={styles.inspectorKicker}>NODE INSPECTOR · {node.chapterLabel.toUpperCase()}</Text>
        <View style={[styles.stateBadge, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Text style={[styles.stateGlyph, { color: tone.color }]}>{state.glyph}</Text>
          <Text style={[styles.stateLabel, { color: tone.color }]}>{state.label}</Text>
        </View>
        {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="收起节点检视" onPress={onClose} style={styles.inspectorClose}><Text style={styles.inspectorCloseText}>✕</Text></Pressable> : null}
      </View>
      <Text style={styles.inspectorTitle}>{node.title}</Text>
      <Text style={styles.inspectorSummary}>{summaryForNode(node)}</Text>
      <View style={styles.inspectorMasteryRow}>
        <Text style={[styles.inspectorMastery, { color: tone.color }]}>{node.mastery}%</Text>
        <View style={styles.inspectorMasteryMeta}>
          <Text style={styles.inspectorMasteryLabel}>BKT MASTERY</Text>
          <Text style={[styles.inspectorMasteryStatus, { color: tone.color }]}>{node.mastery >= 80 ? "已掌握" : node.mastery < 60 ? `距 60% 基准 +${gap}%` : `距 80% 精通 +${gap}%`}</Text>
        </View>
        <View style={[styles.inspectorGap, { backgroundColor: tone.soft, borderColor: tone.border }]}>
          <Text style={[styles.inspectorGapText, { color: tone.color }]}>{state.range}</Text>
        </View>
      </View>
    </View>

    <View key={node.id} style={[styles.inspectorBody, motion.panelIn]}>
      <MemoryPod node={node} />

      <View style={styles.module}>
        <View style={styles.moduleHead}>
          <View style={[styles.moduleIcon, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}>
            <MiniIcon name="radar" size={15} color={theme.agent} />
          </View>
          <View style={styles.moduleHeadCopy}>
            <Text style={styles.moduleKicker}>DIAGNOSTIC EVIDENCE</Text>
            <Text style={styles.moduleTitle}>为什么先学这个节点</Text>
          </View>
        </View>
        <View style={styles.evidenceList}>
          {node.evidenceLines.slice(0, 3).map((line) => <View key={line} style={styles.evidenceRow}>
            <View style={[styles.evidenceGlyph, { backgroundColor: node.mastery < 60 ? theme.warningSoft : theme.successSoft }]}>
              <Text style={[styles.evidenceGlyphText, { color: node.mastery < 60 ? theme.warning : theme.success }]}>{node.mastery < 60 ? "!" : "✓"}</Text>
            </View>
            <Text style={styles.evidenceText}>{line}</Text>
          </View>)}
        </View>
        <View style={styles.prereqList}>
          {prereqs.length > 0 ? prereqs.slice(0, 2).map((item) => {
            const itemState = stateOf(item.mastery);
            const itemTone = toneFor(theme, itemState.key);
            return <View key={item.id} style={styles.prereqRow}>
              <Text style={styles.prereqLabel} numberOfLines={1}>{item.title}</Text>
              <View style={styles.prereqTrack}><View style={[styles.prereqFill, { width: pct(item.mastery), backgroundColor: itemTone.color }]} /></View>
              <Text style={[styles.prereqValue, { color: itemTone.color }]}>{item.mastery}%</Text>
            </View>;
          }) : <Text style={styles.emptyPrereq}>课程基础 · 已具备根节点</Text>}
        </View>
        <View style={[styles.unlockCard, { borderColor: node.mastery < 60 ? `${theme.warning}44` : `${theme.success}33`, backgroundColor: node.mastery < 60 ? theme.warningSoft : theme.successSoft }]}>
          <Text style={[styles.unlockValue, { color: node.mastery < 60 ? theme.warning : theme.success }]}>{blocked}</Text>
          <Text style={styles.unlockText}>{node.mastery < 60 ? "个下游节点正在等待此断点解除" : "个下游节点已可继续推进"}</Text>
        </View>
      </View>

      <View style={styles.module}>
        <View style={styles.moduleHead}>
          <View style={[styles.moduleIcon, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
            <MiniIcon name="bolt" size={15} color={theme.accentPrimary} />
          </View>
          <View style={styles.moduleHeadCopy}>
            <Text style={styles.moduleKicker}>ACTION LAUNCHPAD</Text>
            <Text style={styles.moduleTitle}>把这个节点真正学会</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={existingResourceId ? "查看推荐资源" : "生成推荐资源"}
          disabled={Boolean(generatingId)}
          onPress={onResource}
          style={({ pressed }) => [styles.primaryAction, { backgroundColor: theme.accentPrimary }, pressed && styles.actionPressed, Boolean(generatingId) && styles.actionDisabled]}
        >
          <View pointerEvents="none" style={[styles.primaryActionShimmer, motion.shimmer, webOnly({ backgroundImage: "linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)" })]} />
          {busy ? <ActivityIndicator size="small" color={theme.onAccent} /> : <MiniIcon name="spark" size={14} color={theme.onAccent} />}
          <Text style={[styles.primaryActionText, { color: theme.onAccent }]}>{busy ? "正在生成靶向资源…" : existingResourceId ? `查看推荐资源 · ${node.resourceType}` : `生成推荐资源 · ${node.resourceType}`}</Text>
          <Text style={[styles.primaryActionArrow, { color: theme.onAccent }]}>→</Text>
        </Pressable>
        <View style={styles.secondaryActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="向 TutorAgent 提问" onPress={onTutor} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }, pressed && styles.actionPressed]}>
            <MiniIcon name="spark" size={13} color={theme.accentPrimary} />
            <Text style={styles.secondaryActionText}>带着此节点问 TutorAgent</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="进入 SQL 实验室" onPress={onSqlLab} style={({ pressed }) => [styles.secondaryAction, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }, pressed && styles.actionPressed]}>
            <MiniIcon name="terminal" size={13} color={theme.success} />
            <Text style={styles.secondaryActionText}>进入 SQL 实验室验证</Text>
          </Pressable>
        </View>
      </View>
    </View>
  </View>;
}

export default function PathScreen() {
  const { theme } = useTheme();
  const styles = usePathStyles();
  const { currentUser, path, resources, addGeneratedResource } = useApp();
  const { nodeId: routeNodeIdParam } = useLocalSearchParams<{ nodeId?: string }>();
  const routeNodeId = typeof routeNodeIdParam === "string" && routeNodeIdParam.trim() ? routeNodeIdParam.trim() : null;
  const width = useHydratedWidth();
  const reducedMotion = useReducedMotion();
  const isDesktop = width >= 960;
  const nodes = useMemo(() => mergePath(TOPOLOGY_NODES, path), [path]);
  const counts = useMemo(() => countsOf(nodes), [nodes]);
  const pathFocus = useMemo(() => nodes.filter((node) => node.pathNode).sort((left, right) => (left.pathIndex ?? 99) - (right.pathIndex ?? 99)), [nodes]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [pathMode, setPathMode] = useState<"focus" | "all">("focus");
  const [activeGroup, setActiveGroup] = useState<PathGroupKey>(() => groupForNode(pathFocus[0] ?? TOPOLOGY_NODES[0]!));
  const [selectedId, setSelectedId] = useState<string>(() => routeNodeId ?? pathFocus[0]?.id ?? TOPOLOGY_NODES[0]!.id);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [scrollRequest, setScrollRequest] = useState(0);
  const barLoaded = useRevealFlag(reducedMotion);
  const animated = {
    all: useCountUp(counts.all, reducedMotion),
    remedial: useCountUp(counts.remedial, reducedMotion),
    steady: useCountUp(counts.steady, reducedMotion),
    mastered: useCountUp(counts.mastered, reducedMotion),
  };
  // A direct /path deep link mounts before the session finishes hydrating. Keep
  // the path's active node as the default until the learner makes a selection.
  const currentSelectedId = selectionTouched ? selectedId : (routeNodeId ?? pathFocus[0]?.id ?? selectedId);
  const selected = nodeById(nodes, currentSelectedId) ?? nodes[0] ?? null;
  const statusFiltered = useMemo(() => filterNodes(nodes, filter), [nodes, filter]);
  const modeFiltered = useMemo(() => statusFiltered.filter((node) => pathMode === "all" || node.mastery < 80), [statusFiltered, pathMode]);
  const groupCounts = useMemo(() => {
    const values = new Map<PathGroupKey, number>();
    for (const node of modeFiltered) {
      const key = groupForNode(node);
      values.set(key, (values.get(key) ?? 0) + 1);
    }
    return values;
  }, [modeFiltered]);
  const visibleNodes = useMemo(() => pathMode === "all" ? modeFiltered : modeFiltered.filter((node) => groupForNode(node) === activeGroup), [modeFiltered, activeGroup, pathMode]);
  const orderById = useMemo(() => new Map(visibleNodes.map((node, index) => [node.id, index + 1])), [visibleNodes]);
  const activeGroupMeta = pathMode === "all"
    ? { key: "all" as const, label: "全部节点", caption: "按掌握度与章节筛选" }
    : PATH_GROUPS.find((group) => group.key === activeGroup) ?? PATH_GROUPS[0]!;
  const focusCount = counts.remedial + counts.steady;
  const existingResource = selected ? resources.find((resource) => resource.nodeId === selected.apiNodeId && resource.status !== "生成中") ?? null : null;

  const applyFilter = useCallback((nextFilter: FilterKey) => {
    setFilter(nextFilter);
    const matches = filterNodes(nodes, nextFilter);
    const resolvedId = nodeById(nodes, currentSelectedId)?.id ?? currentSelectedId;
    if (matches.length > 0) {
      const chosenId = matches.some((node) => node.id === resolvedId) ? resolvedId : matches[0]!.id;
      setSelectedId(chosenId);
      const chosenNode = nodeById(nodes, chosenId);
      if (chosenNode) setActiveGroup(groupForNode(chosenNode));
    }
    setSelectionTouched(true);
  }, [nodes, currentSelectedId]);

  const selectNode = useCallback((id: string) => {
    setSelectedId(id);
    setSelectionTouched(true);
    const node = nodeById(nodes, id);
    if (node) setActiveGroup(groupForNode(node));
    if (!isDesktop) setMobileOpen(true);
  }, [isDesktop, nodes]);

  const selectFromTopology = useCallback((id: string) => {
    setSelectedId(id);
    setSelectionTouched(true);
    const node = nodeById(nodes, id);
    if (node) setActiveGroup(groupForNode(node));
    if (!isDesktop) setMobileOpen(true);
    if (isDesktop) setScrollRequest((value) => value + 1);
  }, [isDesktop, nodes]);

  const selectGroup = useCallback((key: PathGroupKey) => {
    setActiveGroup(key);
    const first = filterNodes(nodes, filter).find((node) => groupForNode(node) === key && (pathMode === "all" || node.mastery < 80));
    if (first) {
      setSelectedId(first.id);
      setSelectionTouched(true);
    }
  }, [nodes, filter, pathMode]);

  const changePathMode = useCallback((mode: "focus" | "all") => {
    setPathMode(mode);
    if (mode === "focus" && selected) {
      const selectedGroup = groupForNode(selected);
      setActiveGroup(selectedGroup);
      if (selected.mastery >= 80) {
        const first = filterNodes(nodes, filter).find((node) => groupForNode(node) === selectedGroup && node.mastery < 80);
        if (first) {
          setSelectedId(first.id);
          setSelectionTouched(true);
        }
      }
    }
  }, [nodes, filter, selected]);

  const openResource = useCallback(async (node: TopologyNode) => {
    const existing = resources.find((resource) => resource.nodeId === node.apiNodeId && resource.status !== "生成中");
    if (!existing) {
      if (generatingId) return;
      setGeneratingId(node.id);
      try {
        await addGeneratedResource(node.resourceType, { nodeId: node.apiNodeId });
      } finally {
        setGeneratingId(null);
      }
    }
    // Both "view" and "generate" land in the synthesis workbench so the
    // resource rail, target node and ReviewAgent context stay in one place.
    router.push({ pathname: "/(tabs)/resources", params: { nodeId: node.id } } as never);
  }, [addGeneratedResource, generatingId, resources]);

  const askTutor = useCallback((node: TopologyNode) => {
    router.push({
      pathname: "/(tabs)/tutor",
      params: {
        node: node.title,
        prompt: `请结合「${node.title}」解释其核心概念，并给出一个典型错例。`,
      },
    } as never);
  }, []);

  const goSqlLab = useCallback(() => router.push("/sql-lab"), []);

  useEffect(() => {
    if (!routeNodeId) return;
    const frame = requestAnimationFrame(() => {
      setSelectedId(routeNodeId);
      setSelectionTouched(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [routeNodeId]);

  useEffect(() => {
    if (!isDesktop || !mobileOpen) return;
    const frame = requestAnimationFrame(() => setMobileOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [isDesktop, mobileOpen]);

  useEffect(() => {
    if (selectionTouched || !pathFocus[0]) return;
    const frame = requestAnimationFrame(() => setActiveGroup(groupForNode(pathFocus[0]!)));
    return () => cancelAnimationFrame(frame);
  }, [pathFocus, selectionTouched]);

  if (!currentUser) {
    return <ThemedScreen>
      <LoadingPanel title="正在加载学习路径…" detail="正在结合掌握度与知识依赖规划节点。" />
    </ThemedScreen>;
  }
  if (path.length === 0 || !selected) {
    return <ThemedScreen>
      <EmptyPanel
        glyph="◇"
        title="还没有可展示的路径节点"
        detail="完成一次诊断后，系统会根据答题证据生成推荐路径。"
        actionLabel="开始诊断"
        onAction={() => router.push("/diagnostic")}
      />
    </ThemedScreen>;
  }

  return <ThemedScreen contentContainerStyle={[styles.page, isDesktop && styles.pageWide]}>
    <Reveal reducedMotion={reducedMotion} index={0}>
      <View style={styles.pageHead}>
        <View style={styles.pageHeadCopy}>
          <Text style={styles.eyebrow}>INTERACTIVE KNOWLEDGE TOPOLOGY</Text>
          <Text style={styles.pageTitle}>个性化学习路径</Text>
          <Text style={styles.pageSubtitle}>交互式知识拓扑沙盘 · 双栏深度检视与 30 秒速记工作台</Text>
        </View>
        <View style={styles.pageHeadActions}>
          <View style={styles.pathPill}>
            <Text style={styles.pathPillText}>{path.length} 个当前路径节点 · {counts.all} 节点全图</Text>
          </View>
          <ThemeSwitcher compact={width > 0 && width < 720} />
        </View>
      </View>
    </Reveal>

    <Reveal reducedMotion={reducedMotion} index={0}>
      <TopologyCommandBar
        nodes={nodes}
        counts={counts}
        animated={animated}
        filter={filter}
        onFilter={applyFilter}
        selectedId={selected.id}
        onSelect={selectFromTopology}
        reducedMotion={reducedMotion}
        barLoaded={barLoaded}
      />
    </Reveal>

    {!isDesktop ? <Modal visible={mobileOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setMobileOpen(false)}>
      <View style={styles.modalBackdrop}>
        <Pressable accessibilityRole="button" accessibilityLabel="关闭节点检视" onPress={() => setMobileOpen(false)} style={styles.modalDismiss} />
        <View style={styles.mobileSheet}>
          <View style={styles.sheetGrabber} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
            <NodeInspector
              node={selected}
              nodes={nodes}
              generatingId={generatingId}
              existingResourceId={existingResource?.id ?? null}
              onResource={() => void openResource(selected)}
              onTutor={() => askTutor(selected)}
              onSqlLab={goSqlLab}
              onClose={() => setMobileOpen(false)}
            />
          </ScrollView>
        </View>
      </View>
    </Modal> : null}

    <View style={[styles.workspace, isDesktop && styles.workspaceWide]}>
      <View style={styles.listColumn}>
        <View style={styles.listControls}>
          <View style={styles.pathModeRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pathMode === "focus" }}
              onPress={() => changePathMode("focus")}
              style={({ pressed }) => [styles.pathModeButton, pathMode === "focus" && styles.pathModeButtonActive, pressed && styles.pressed]}
            >
              <Text style={[styles.pathModeText, pathMode === "focus" && { color: theme.accentPrimary }]}>⚡ 仅看当前待突破路径 ({focusCount})</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: pathMode === "all" }}
              onPress={() => changePathMode("all")}
              style={({ pressed }) => [styles.pathModeButton, pathMode === "all" && styles.pathModeButtonActive, pressed && styles.pressed]}
            >
              <Text style={[styles.pathModeText, pathMode === "all" && { color: theme.accentPrimary }]}>展开全部章节 ({counts.all})</Text>
            </Pressable>
          </View>
          {pathMode === "focus" ? <View accessibilityRole="tablist" accessibilityLabel="路径章节" style={styles.groupTabs}>
            {PATH_GROUPS.map((group) => {
              const active = group.key === activeGroup;
              return <Pressable
                key={group.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                aria-selected={active}
                onPress={() => selectGroup(group.key)}
                style={({ pressed }) => [styles.groupTab, active && styles.groupTabActive, pressed && styles.pressed]}
              >
                <Text style={[styles.groupTabText, active && { color: theme.accentPrimary }]}>{group.label}</Text>
                <Text style={[styles.groupTabCount, active && { color: theme.accentPrimary }]}>{groupCounts.get(group.key) ?? 0}</Text>
              </Pressable>;
            })}
          </View> : <Text style={styles.allModeHint}>全部章节已展开；切回「仅看当前待突破路径」可按章节筛选。</Text>}
        </View>

        <View style={styles.chapterHeader}>
          <View style={styles.chapterHeaderLeft}>
            <View style={[styles.chapterHeaderDot, { backgroundColor: theme.accentPrimary }]} />
            <Text style={styles.chapterLabel}>{activeGroupMeta.label}</Text>
            <Text style={styles.chapterCaption}>{activeGroupMeta.caption}</Text>
          </View>
          <Text style={styles.chapterCount}>{visibleNodes.length} 节点</Text>
        </View>

        {visibleNodes.length === 0 ? <View style={[styles.listEmpty, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
          <Text style={styles.listEmptyText}>{pathMode === "focus" ? "当前章节的节点都已掌握，或没有匹配筛选项。" : "当前筛选下没有节点。"}</Text>
          <Pressable accessibilityRole="button" onPress={() => changePathMode("all")} style={({ pressed }) => [styles.listEmptyButton, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
            <Text style={[styles.listEmptyButtonText, { color: theme.accentPrimary }]}>展开全部章节</Text>
          </Pressable>
        </View> : visibleNodes.map((node, index) => {
          const order = orderById.get(node.id) ?? index + 1;
          return <MilestoneRow
            key={node.id}
            node={node}
            nodes={nodes}
            order={order}
            isLast={index === visibleNodes.length - 1}
            selected={node.id === selected.id}
            reducedMotion={reducedMotion}
            generatingId={generatingId}
            onSelect={() => selectNode(node.id)}
            onResource={() => void openResource(node)}
            onTutor={() => askTutor(node)}
            onQuickNote={() => selectNode(node.id)}
            scrollRequest={scrollRequest}
          />;
        })}
      </View>

      {isDesktop ? <View style={styles.inspectorColumn}>
        <Reveal reducedMotion={reducedMotion} index={1} style={styles.inspectorPanel}>
          <NodeInspector
            node={selected}
            nodes={nodes}
            generatingId={generatingId}
            existingResourceId={existingResource?.id ?? null}
            onResource={() => void openResource(selected)}
            onTutor={() => askTutor(selected)}
            onSqlLab={goSqlLab}
          />
        </Reveal>
      </View> : null}
    </View>
  </ThemedScreen>;
}

const pathStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

function usePathStyles() {
  const { mode, theme } = useTheme();
  return useMemo(() => {
    const cached = pathStyleCache.get(mode);
    if (cached) return cached;
    const created = createStyles(theme);
    pathStyleCache.set(mode, created);
    return created;
  }, [mode, theme]);
}

function createStyles(theme: ThemeTokens) {
  const cardShadow = theme.isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px -20px rgba(0, 0, 0, 0.75)"
    : "0 12px 32px -8px rgba(41, 37, 36, 0.06), 0 2px 6px rgba(41, 37, 36, 0.04)";
  const hoverShadow = theme.isDark
    ? `inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 18px 44px -18px ${theme.accentShadow}`
    : `0 14px 32px -14px ${theme.accentShadow}, 0 2px 6px rgba(41, 37, 36, 0.04)`;
  const webCard = webProps({ boxShadow: cardShadow, transitionProperty: "background-color, border-color, box-shadow, transform", transitionDuration: "200ms", transitionTimingFunction: "ease" });

  return StyleSheet.create({
    page: { paddingTop: 26, paddingBottom: 60, paddingHorizontal: 18, maxWidth: 1240, width: "100%", alignSelf: "center", gap: 18 },
    pageWide: { paddingHorizontal: 28, paddingTop: 30 },
    pageHead: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 18, flexWrap: "wrap" },
    pageHeadCopy: { flexShrink: 1, minWidth: 240, gap: 4 },
    pageHeadActions: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", gap: 8, marginLeft: "auto" },
    eyebrow: { color: theme.accentPrimary, fontSize: 10.5, fontWeight: "700", letterSpacing: 1.5, fontFamily: MONO_FONT },
    pageTitle: { color: theme.textPrimary, fontSize: 30, lineHeight: 38, fontWeight: "800", letterSpacing: -0.9 },
    pageSubtitle: { color: theme.textSecondary, fontSize: 15.5, lineHeight: 23 },
    pathPill: { borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    pathPillText: { color: theme.textSecondary, fontSize: 13, fontWeight: "700", fontFamily: MONO_FONT },

    commandBar: { borderRadius: 20, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgGlass, padding: 18, gap: 14, ...webCard, ...webProps({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }) },
    commandTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
    commandCopy: { gap: 3 },
    commandKicker: { color: theme.accentPrimary, fontSize: 9.5, fontWeight: "700", letterSpacing: 1.2, fontFamily: MONO_FONT },
    commandTitle: { color: theme.textPrimary, fontSize: 20, fontWeight: "800", letterSpacing: -0.4 },
    commandMetaPill: { borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    commandMeta: { color: theme.textMuted, fontSize: 13.5, fontWeight: "700", fontFamily: MONO_FONT, letterSpacing: 0.3 },
    kpiRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kpiStat: { flex: 1, minWidth: 118, borderRadius: 12, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgSurface, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    kpiLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    kpiDot: { width: 6, height: 6, borderRadius: 3 },
    kpiLabel: { color: theme.textMuted, fontSize: 13, fontWeight: "700" },
    kpiValueRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
    kpiValue: { fontSize: 24, lineHeight: 28, fontWeight: "800", fontFamily: MONO_FONT, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
    kpiUnit: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },

    segmentWrap: { gap: 7 },
    segmentTrack: { height: 10, flexDirection: "row", gap: 2, borderRadius: 999, overflow: "hidden", backgroundColor: theme.bgElevated },
    segment: { height: "100%", minWidth: 2 },
    segmentLegend: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    segmentLegendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
    segmentLegendDot: { width: 6, height: 6, borderRadius: 3 },
    segmentLegendText: { color: theme.textSecondary, fontSize: 13, fontWeight: "600", fontVariant: ["tabular-nums"] },

    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    filterPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
    filterDot: { width: 7, height: 7, borderRadius: 4 },
    filterLabel: { fontSize: 14, fontWeight: "700" },
    filterCount: { borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
    filterCountText: { fontSize: 12, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    filterPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },

    dagPanel: { borderRadius: 14, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, padding: 12, gap: 10, overflow: "hidden" },
    dagHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" },
    dagHeadCopy: { gap: 2 },
    dagTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: "800" },
    dagHint: { color: theme.textMuted, fontSize: 13.5, lineHeight: 20 },
    dagLegend: { flexDirection: "row", alignItems: "center", gap: 6 },
    dagLegendDot: { width: 5, height: 5, borderRadius: 3 },
    dagLegendText: { color: theme.textMuted, fontSize: 12, fontWeight: "600" },
    dagScrollContent: { paddingVertical: 2 },
    dagChain: { flexDirection: "row", alignItems: "stretch" },
    dagChainItem: { flexDirection: "row", alignItems: "stretch" },
    dagNode: { width: 168, minHeight: 112, borderRadius: 12, borderWidth: 1, padding: 10, gap: 4, justifyContent: "space-between" },
    dagNodeSelected: { borderColor: theme.accentPrimary },
    dagNodeDim: { opacity: 0.4 },
    dagNodePressed: { transform: [{ scale: 0.985 }] },
    dagNodeTop: { flexDirection: "row", alignItems: "center", gap: 5 },
    dagStatusWrap: { width: 10, height: 10, alignItems: "center", justifyContent: "center" },
    dagStatusDot: { width: 6, height: 6, borderRadius: 3 },
    dagPulse: { position: "absolute", width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
    dagStatusText: { flexShrink: 1, fontSize: 11.5, fontWeight: "800", letterSpacing: 0.2, fontFamily: MONO_FONT },
    dagNodeMastery: { marginLeft: "auto", fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    dagNodeTitle: { color: theme.textPrimary, fontSize: 14.5, lineHeight: 20, fontWeight: "700" },
    dagNodeFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
    dagBlocked: { flexShrink: 1, fontSize: 11.5, fontWeight: "800", fontFamily: MONO_FONT },
    dagNodeMinutes: { color: theme.textMuted, fontSize: 11.5, fontFamily: MONO_FONT },
    dagConnector: { width: 32, alignItems: "center", justifyContent: "center" },
    dagConnectorLine: { position: "absolute", left: 4, right: 4, height: 1, top: "50%" },
    dagConnectorDot: { position: "absolute", left: 3, top: "50%", marginTop: -2, width: 4, height: 4, borderRadius: 2 },
    dagConnectorWarning: { position: "absolute", top: "50%", marginTop: -3, width: 6, height: 6, borderRadius: 3 },
    dagArrow: { fontSize: 13, fontWeight: "700", marginLeft: 16 },

    workspace: { width: "100%", gap: 16 },
    workspaceWide: { flexDirection: "row", alignItems: "stretch", gap: 24 },
    listColumn: { flex: 55, minWidth: 0 },
    inspectorColumn: { flex: 45, minWidth: 0 },
    inspectorPanel: { width: "100%", ...webProps({ position: "sticky", top: 24, alignSelf: "flex-start", zIndex: 2 }) },
    modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.62)" : "rgba(41, 37, 36, 0.28)" },
    modalDismiss: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
    mobileSheet: { maxHeight: "92%", borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderBottomWidth: 0, borderColor: theme.borderSubtle, backgroundColor: theme.bgCanvas, paddingTop: 8, paddingHorizontal: 12, paddingBottom: 18, ...webProps({ boxShadow: "0 -20px 50px -20px rgba(0, 0, 0, 0.45)" }) },
    sheetGrabber: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: theme.borderSubtle, marginBottom: 8 },
    sheetContent: { gap: 10, paddingBottom: 10 },

    chapterGroup: { gap: 10, marginBottom: 18 },
    chapterHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 4, marginTop: 4 },
    chapterHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1, minWidth: 0 },
    chapterHeaderDot: { width: 6, height: 6, borderRadius: 3 },
    chapterLabel: { color: theme.textPrimary, fontSize: 17, fontWeight: "800" },
    chapterCaption: { color: theme.textMuted, fontSize: 13.5, flexShrink: 1 },
    chapterCount: { color: theme.textMuted, fontSize: 12.5, fontFamily: MONO_FONT, fontWeight: "700" },

    listControls: { gap: 7, marginBottom: 8 },
    pathModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    pathModeButton: { borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6 },
    pathModeButtonActive: { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    pathModeText: { color: theme.textSecondary, fontSize: 14, fontWeight: "700" },
    groupTabs: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
    groupTab: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 5 },
    groupTabActive: { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft },
    groupTabText: { color: theme.textSecondary, fontSize: 13.5, fontWeight: "700" },
    groupTabCount: { color: theme.textMuted, fontSize: 11.5, fontWeight: "800", fontFamily: MONO_FONT },
    allModeHint: { color: theme.textMuted, fontSize: 12.5, lineHeight: 19 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    listEmpty: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" },
    listEmptyText: { color: theme.textSecondary, fontSize: 13.5, flex: 1, minWidth: 160 },
    listEmptyButton: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 5 },
    listEmptyButtonText: { fontSize: 8.5, fontWeight: "800" },

    milestoneRow: { position: "relative", paddingLeft: 58, marginBottom: 7, minHeight: 84 },
    milestoneRowDim: { opacity: 0.55 },
    statusRing: { position: "absolute", left: 0, top: 9, width: 46, height: 46, borderRadius: 23, borderWidth: 2, alignItems: "center", justifyContent: "center", zIndex: 2 },
    statusRingValue: { fontSize: 12.5, lineHeight: 15, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    statusRingGlyph: { fontSize: 9, lineHeight: 11, fontWeight: "900" },
    compactConnector: { position: "absolute", left: 22, top: 55, bottom: -8, width: 2, borderRadius: 2, overflow: "hidden" },
    compactConnectorFlow: { position: "absolute", top: 0, left: 0, right: 0, width: 2, height: "70%", borderRadius: 2 },
    compactConnectorWarning: { position: "absolute", left: -2, top: "40%", width: 6, height: 6, borderRadius: 3 },
    compactCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, backgroundColor: theme.bgSurface, padding: 12, gap: 10, ...webCard },
    compactCardSelected: { borderLeftWidth: 3, ...webProps({ boxShadow: `0 0 0 1px ${theme.accentRing}, 0 10px 22px -18px ${theme.accentShadow}` }) },
    compactCardHover: { transform: [{ translateY: -2 }], ...webProps({ boxShadow: hoverShadow }) },
    compactMain: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 1 },
    compactMainPressed: { opacity: 0.82 },
    compactTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", minWidth: 0 },
    compactTitle: { flexGrow: 1, flexShrink: 1, flexBasis: 150, minWidth: 0, color: theme.textPrimary, fontSize: 18, lineHeight: 25, fontWeight: "800", letterSpacing: -0.2 },
    compactPathTag: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
    compactPathText: { fontSize: 12, fontWeight: "800" },
    compactGapPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, flexShrink: 0 },
    compactGapText: { fontSize: 12.5, fontWeight: "800", fontFamily: MONO_FONT },
    compactMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    compactState: { fontSize: 14, fontWeight: "800" },
    compactMinutes: { color: theme.textMuted, fontSize: 14, fontFamily: MONO_FONT },
    compactRelation: { flexShrink: 1, color: theme.textMuted, fontSize: 14, lineHeight: 20 },
    compactBarTrack: { height: 5, borderRadius: 999, backgroundColor: theme.bgElevated, overflow: "hidden", position: "relative", marginTop: 1 },
    compactBarFill: { height: "100%", borderRadius: 999 },
    compactMarker: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: theme.textMuted, opacity: 0.7, zIndex: 2 },
    compactActions: { width: 92, gap: 6, justifyContent: "center", flexShrink: 0 },
    compactAction: { width: "100%", minHeight: 32, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 8 },
    compactActionPrimary: { borderWidth: 1 },
    compactActionPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] },
    compactActionDisabled: { opacity: 0.55 },
    compactActionText: { fontSize: 13.5, fontWeight: "800" },

    sequence: { position: "absolute", left: 0, top: 14, width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", zIndex: 2 },
    sequenceText: { fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    connector: { position: "absolute", left: 14, top: 44, bottom: -10, width: 2, borderRadius: 2, overflow: "hidden" },
    connectorFlow: { position: "absolute", top: 0, left: 0, right: 0, width: 2, height: "70%", borderRadius: 2 },
    connectorWarning: { position: "absolute", left: -2, top: "40%", width: 6, height: 6, borderRadius: 3 },
    card: { position: "relative", borderRadius: 16, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 14, gap: 10, ...webCard },
    cardWithRail: { paddingRight: 132, minHeight: 164 },
    cardSelected: { borderColor: theme.accentPrimary, borderLeftWidth: 4, ...webProps({ boxShadow: `0 0 0 1px ${theme.accentRing}, 0 12px 28px -18px ${theme.accentShadow}` }) },
    cardHover: { transform: [{ translateY: -2 }], borderColor: theme.accentSoftBorder, ...webProps({ boxShadow: hoverShadow }) },
    cardPressed: { transform: [{ scale: 0.995 }] },
    cardTop: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    stateBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
    stateGlyph: { fontSize: 10, fontWeight: "900" },
    stateLabel: { fontSize: 9, fontWeight: "800" },
    chapterTag: { borderRadius: 5, backgroundColor: theme.bgElevated, paddingHorizontal: 6, paddingVertical: 2 },
    chapterTagText: { color: theme.textMuted, fontSize: 8.5, fontWeight: "700" },
    minutes: { color: theme.textMuted, fontSize: 9, fontFamily: MONO_FONT },
    pathTag: { marginLeft: "auto", borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
    pathTagText: { fontSize: 8.5, fontWeight: "800" },
    titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
    nodeTitle: { flex: 1, minWidth: 0, color: theme.textPrimary, fontSize: 19, lineHeight: 25, fontWeight: "800", letterSpacing: -0.3 },
    masteryBlock: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
    masteryValue: { fontSize: 26, lineHeight: 30, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: -0.8, fontVariant: ["tabular-nums"] },
    gapPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
    gapText: { fontSize: 8.5, fontWeight: "800", fontFamily: MONO_FONT },
    masteryBarWrap: { gap: 4 },
    barTrack: { height: 8, borderRadius: 999, backgroundColor: theme.bgElevated, overflow: "hidden", position: "relative" },
    barFill: { height: "100%", borderRadius: 999 },
    barMarker: { position: "absolute", top: 0, bottom: 0, width: 1, opacity: 0.8, zIndex: 2 },
    barLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 },
    barLabelText: { color: theme.textMuted, fontSize: 8, fontFamily: MONO_FONT },
    topologyRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" },
    topologyChip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, paddingHorizontal: 6, paddingVertical: 3, maxWidth: "46%" },
    topologyChipLabel: { color: theme.textMuted, fontSize: 8, fontWeight: "700", flexShrink: 0 },
    topologyChipValue: { color: theme.textSecondary, fontSize: 8.5, fontWeight: "700", flexShrink: 1 },
    topologyArrow: { color: theme.textMuted, fontSize: 10, fontWeight: "800" },
    actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    quickRail: { position: "absolute", top: 12, right: 12, bottom: 12, width: 108, justifyContent: "center", gap: 6, borderLeftWidth: 1, borderLeftColor: theme.borderDivider, paddingLeft: 8 },
    action: { flexGrow: 1, minHeight: 32, borderRadius: 8, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    actionPrimary: { borderWidth: 1, borderColor: theme.accentHover },
    actionGhost: { borderWidth: 1 },
    actionPressed: { opacity: 0.82, transform: [{ scale: 0.985 }] },
    actionDisabled: { opacity: 0.58 },
    actionText: { color: theme.textPrimary, fontSize: 9.5, fontWeight: "800" },

    inspectorCard: { borderRadius: 20, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, padding: 18, gap: 14, ...webCard },
    inspectorHeader: { gap: 8 },
    inspectorKickerRow: { flexDirection: "row", alignItems: "center", gap: 7, flexWrap: "wrap" },
    inspectorKicker: { flexShrink: 1, color: theme.accentPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    inspectorClose: { marginLeft: "auto", width: 28, height: 28, borderRadius: 9, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, alignItems: "center", justifyContent: "center" },
    inspectorCloseText: { color: theme.textMuted, fontSize: 12, fontWeight: "800" },
    inspectorTitle: { color: theme.textPrimary, fontSize: 24, lineHeight: 31, fontWeight: "800", letterSpacing: -0.6 },
    inspectorSummary: { color: theme.textSecondary, fontSize: 16, lineHeight: 24 },
    inspectorMasteryRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
    inspectorMastery: { fontSize: 36, lineHeight: 40, fontWeight: "900", fontFamily: MONO_FONT, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
    inspectorMasteryMeta: { flex: 1, minWidth: 0, gap: 2 },
    inspectorMasteryLabel: { color: theme.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 0.6, fontFamily: MONO_FONT },
    inspectorMasteryStatus: { fontSize: 14, fontWeight: "700" },
    inspectorGap: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
    inspectorGapText: { fontSize: 12, fontWeight: "800", fontFamily: MONO_FONT },
    inspectorBody: { gap: 12 },

    module: { borderRadius: 14, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgElevated, padding: 14, gap: 10 },
    moduleHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    moduleIcon: { width: 30, height: 30, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    moduleIconText: { fontSize: 13 },
    moduleHeadCopy: { flex: 1, minWidth: 0 },
    moduleKicker: { color: theme.textMuted, fontSize: 10.5, fontWeight: "800", letterSpacing: 0.7, fontFamily: MONO_FONT },
    moduleTitle: { color: theme.textPrimary, fontSize: 17, fontWeight: "800" },
    moduleMeta: { color: theme.textMuted, fontSize: 13, fontFamily: MONO_FONT },
    tabs: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    tab: { borderRadius: 7, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface, paddingHorizontal: 12, paddingVertical: 8 },
    tabPressed: { opacity: 0.82 },
    tabText: { color: theme.textSecondary, fontSize: 14, fontWeight: "800" },
    tabBody: { gap: 9 },
    essenceCard: { borderLeftWidth: 3, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9, gap: 4 },
    essenceKicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    essenceText: { color: theme.textPrimary, fontSize: 16, lineHeight: 25, fontWeight: "600" },
    analogyRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 9, borderWidth: 1, borderColor: theme.borderDivider, backgroundColor: theme.bgSurface, padding: 10 },
    analogyCopy: { flex: 1, minWidth: 0, gap: 3 },
    analogyKicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    analogyText: { color: theme.textSecondary, fontSize: 15, lineHeight: 23 },

    normalizationRow: { flexDirection: "row", alignItems: "stretch", gap: 2 },
    normStepWrap: { flex: 1, flexDirection: "row", alignItems: "stretch", gap: 2, minWidth: 0 },
    normStep: { flex: 1, minWidth: 0, borderRadius: 9, borderWidth: 1, padding: 5, gap: 2 },
    normStepKey: { fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    normStepTitle: { fontSize: 12, lineHeight: 16, fontWeight: "800" },
    normStepCaption: { color: theme.textMuted, fontSize: 11, lineHeight: 16 },
    normArrow: { alignSelf: "center", fontSize: 10, fontWeight: "800" },
    keysVisual: { gap: 8 },
    keyLayer: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 3 },
    keyLayerInner: { borderRadius: 8, borderWidth: 1, padding: 9, gap: 3, marginTop: 5 },
    keyLayerTitle: { fontSize: 13, fontWeight: "900" },
    keyLayerText: { color: theme.textSecondary, fontSize: 13, lineHeight: 19 },
    fkChip: { borderRadius: 8, borderWidth: 1, padding: 9 },
    fkText: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
    anomaliesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    anomalyCard: { flexBasis: "30%", flexGrow: 1, minWidth: 118, borderRadius: 9, borderWidth: 1, padding: 9, gap: 4 },
    anomalyTitle: { fontSize: 13, fontWeight: "900" },
    anomalyText: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 },
    genericFlow: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
    genericStepWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexGrow: 1 },
    genericStep: { flex: 1, minWidth: 72, borderRadius: 8, borderWidth: 1, padding: 7, gap: 2 },
    genericStepTitle: { fontSize: 13, fontWeight: "800" },
    genericStepText: { color: theme.textMuted, fontSize: 12.5, lineHeight: 18 },
    genericArrow: { fontSize: 11, fontWeight: "800" },
    conceptFlow: { flexDirection: "row", alignItems: "stretch", flexWrap: "wrap", gap: 6 },
    conceptFlowStack: { flexDirection: "column", alignItems: "stretch" },
    conceptStepWrap: { flexGrow: 1, flexBasis: 140, minWidth: 0, flexDirection: "row", alignItems: "stretch", gap: 4 },
    conceptStepWrapStack: { flexGrow: 0, flexBasis: "auto", width: "100%", flexDirection: "column", alignItems: "stretch" },
    conceptCard: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, padding: 10, gap: 5 },
    conceptTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    conceptText: { color: theme.textPrimary, fontSize: 14.5, lineHeight: 22 },
    conceptArrow: { alignSelf: "center", fontSize: 12, fontWeight: "800" },
    conceptArrowStack: { alignSelf: "center" },

    pitfallCard: { borderRadius: 10, borderWidth: 1, padding: 9, gap: 3 },
    pitfallTitle: { fontSize: 13, fontWeight: "900" },
    pitfallText: { color: theme.textSecondary, fontSize: 15, lineHeight: 23 },
    exampleCard: { borderRadius: 10, borderWidth: 1, padding: 9, gap: 3 },
    exampleTitle: { fontSize: 12, fontWeight: "800", letterSpacing: 0.4 },
    exampleText: { color: theme.textPrimary, fontSize: 15, lineHeight: 23 },
    quizQuestion: { color: theme.textPrimary, fontSize: 16, lineHeight: 24, fontWeight: "700" },
    quizOptions: { gap: 6 },
    quizOption: { flexDirection: "row", alignItems: "center", gap: 7, minHeight: 44, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 10 },
    quizOptionChosen: { borderWidth: 2 },
    quizOptionPressed: { opacity: 0.84 },
    quizMark: { width: 20, flexShrink: 0, fontSize: 13, fontWeight: "900", fontFamily: MONO_FONT },
    quizOptionText: { flex: 1, minWidth: 0, color: theme.textPrimary, fontSize: 15, lineHeight: 22 },
    quizExplanation: { fontSize: 14, lineHeight: 21, fontWeight: "600" },
    boostCard: { borderRadius: 10, borderWidth: 1, padding: 9, gap: 5 },
    boostHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    boostKicker: { fontSize: 12, fontWeight: "900", letterSpacing: 0.3 },
    boostValue: { fontSize: 16, fontWeight: "900", fontFamily: MONO_FONT },
    boostTrack: { height: 8, borderRadius: 999, backgroundColor: theme.bgSurface, overflow: "hidden", position: "relative" },
    boostBase: { height: "100%", borderRadius: 999 },
    boostExtra: { position: "absolute", top: 0, bottom: 0, borderRadius: 999, opacity: 0.7 },
    boostText: { color: theme.textSecondary, fontSize: 12.5, lineHeight: 18, fontFamily: MONO_FONT },

    evidenceList: { gap: 7 },
    evidenceRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    evidenceGlyph: { width: 22, height: 22, borderRadius: 6, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    evidenceGlyphText: { fontSize: 11, fontWeight: "900" },
    evidenceText: { flex: 1, minWidth: 0, color: theme.textSecondary, fontSize: 15, lineHeight: 24 },
    prereqList: { gap: 7, marginTop: 3 },
    prereqRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    prereqLabel: { width: 96, flexShrink: 0, color: theme.textSecondary, fontSize: 13, fontWeight: "600" },
    prereqTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: theme.bgSubtleHover, overflow: "hidden" },
    prereqFill: { height: "100%", borderRadius: 999 },
    prereqValue: { width: 42, textAlign: "right", fontSize: 13, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    emptyPrereq: { color: theme.textMuted, fontSize: 13 },
    unlockCard: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 9, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, marginTop: 3 },
    unlockValue: { fontSize: 26, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    unlockText: { flex: 1, color: theme.textSecondary, fontSize: 14, lineHeight: 21 },

    primaryAction: { position: "relative", overflow: "hidden", minHeight: 54, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, ...webProps({ boxShadow: `0 8px 20px -10px ${theme.accentShadow}` }) },
    primaryActionShimmer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "40%" },
    primaryActionText: { flexShrink: 1, minWidth: 0, fontSize: 16, fontWeight: "800" },
    primaryActionArrow: { fontSize: 16, fontWeight: "800" },
    secondaryActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    secondaryAction: { flexGrow: 1, minHeight: 46, borderRadius: 8, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 10 },
    secondaryActionText: { color: theme.textPrimary, fontSize: 15, fontWeight: "700" },
  });
}
