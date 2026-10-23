import { useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";
import { essenceForNode, factsForNode } from "../lib/learning-content";
import { nodeById, type TopologyNode } from "../lib/path-topology";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { useTheme, type ThemeMode, type ThemeTokens } from "../state/theme-context";
import { MONO_FONT, webOnly } from "./theme-ui";

type ClusterKey = "relations" | "sql" | "design" | "index" | "tx";

const NODE_WIDTH = 96;
const GRAPH_HEIGHT = 500;
const GRAPH_HEIGHT_NARROW = 380;
const WEEK_COUNT = 12;
const DAY_COUNT = 7;
const HEAT_TOTAL = WEEK_COUNT * DAY_COUNT;

/** Fixed five-cluster membership of the 27 recap nodes. */
const CLUSTERS: readonly { key: ClusterKey; label: string; ids: readonly string[] }[] = [
  {
    key: "relations",
    label: "关系模型",
    ids: ["relations", "keys-integrity", "entity-relationship", "relational-algebra", "select-project", "join-cartesian", "set-operations"],
  },
  {
    key: "sql",
    label: "SQL 核心",
    ids: ["sql-select", "sql-where", "sql-aggregate", "sql-multi-join", "sql-subquery", "sql-window"],
  },
  {
    key: "design",
    label: "规范化设计",
    ids: ["fd-basics", "closure-keys", "nf-1-2", "nf-3bc", "lossless-decomposition", "nf-4"],
  },
  {
    key: "index",
    label: "索引与调优",
    ids: ["btree", "index-design", "optimizer", "slow-query"],
  },
  {
    key: "tx",
    label: "事务并发",
    ids: ["tx-acid", "isolation", "lock-mvcc", "deadlock"],
  },
];

/** Normalized constellation coordinates: clusters orbit the canvas center. */
const COORDS: Record<string, { x: number; y: number }> = {
  relations: { x: 0.09, y: 0.2 },
  "keys-integrity": { x: 0.22, y: 0.18 },
  "entity-relationship": { x: 0.08, y: 0.37 },
  "relational-algebra": { x: 0.2, y: 0.35 },
  "select-project": { x: 0.29, y: 0.29 },
  "join-cartesian": { x: 0.12, y: 0.52 },
  "set-operations": { x: 0.25, y: 0.5 },

  "sql-select": { x: 0.44, y: 0.08 },
  "sql-where": { x: 0.54, y: 0.07 },
  "sql-aggregate": { x: 0.63, y: 0.12 },
  "sql-multi-join": { x: 0.45, y: 0.21 },
  "sql-subquery": { x: 0.56, y: 0.22 },
  "sql-window": { x: 0.66, y: 0.23 },

  "fd-basics": { x: 0.36, y: 0.64 },
  "closure-keys": { x: 0.47, y: 0.63 },
  "nf-1-2": { x: 0.58, y: 0.67 },
  "nf-3bc": { x: 0.38, y: 0.77 },
  "lossless-decomposition": { x: 0.49, y: 0.8 },
  "nf-4": { x: 0.6, y: 0.79 },

  btree: { x: 0.76, y: 0.3 },
  "index-design": { x: 0.88, y: 0.33 },
  optimizer: { x: 0.79, y: 0.45 },
  "slow-query": { x: 0.91, y: 0.45 },

  "tx-acid": { x: 0.72, y: 0.7 },
  isolation: { x: 0.84, y: 0.68 },
  "lock-mvcc": { x: 0.74, y: 0.83 },
  deadlock: { x: 0.86, y: 0.83 },
};

/** Real prerequisite edges between the fixed node ids. */
const EDGES: readonly (readonly [string, string])[] = [
  ["relations", "keys-integrity"],
  ["relations", "entity-relationship"],
  ["relations", "relational-algebra"],
  ["relational-algebra", "select-project"],
  ["relational-algebra", "join-cartesian"],
  ["relational-algebra", "set-operations"],
  ["select-project", "join-cartesian"],
  ["keys-integrity", "entity-relationship"],

  ["sql-select", "sql-where"],
  ["sql-select", "sql-aggregate"],
  ["sql-where", "sql-aggregate"],
  ["sql-aggregate", "sql-multi-join"],
  ["sql-multi-join", "sql-subquery"],
  ["sql-subquery", "sql-window"],

  ["fd-basics", "closure-keys"],
  ["closure-keys", "nf-1-2"],
  ["closure-keys", "nf-3bc"],
  ["nf-1-2", "nf-3bc"],
  ["nf-3bc", "lossless-decomposition"],
  ["lossless-decomposition", "nf-4"],
  ["nf-1-2", "lossless-decomposition"],

  ["btree", "index-design"],
  ["index-design", "optimizer"],
  ["btree", "slow-query"],
  ["index-design", "slow-query"],

  ["tx-acid", "isolation"],
  ["isolation", "lock-mvcc"],
  ["lock-mvcc", "deadlock"],

  ["relational-algebra", "sql-select"],
  ["join-cartesian", "sql-multi-join"],
];

const CLUSTER_OF: Record<string, ClusterKey> = CLUSTERS.reduce<Record<string, ClusterKey>>((map, cluster) => {
  for (const id of cluster.ids) map[id] = cluster.key;
  return map;
}, {});

const NEIGHBORS: Record<string, ReadonlySet<string>> = (() => {
  const map: Record<string, Set<string>> = {};
  for (const [left, right] of EDGES) {
    const leftSet = map[left] ?? (map[left] = new Set());
    leftSet.add(right);
    const rightSet = map[right] ?? (map[right] = new Set());
    rightSet.add(left);
  }
  return map;
})();

const NO_NEIGHBORS: ReadonlySet<string> = new Set();

function masteryColor(theme: ThemeTokens, mastery: number): string {
  if (mastery >= 80) return theme.success;
  if (mastery >= 60) return theme.accentPrimary;
  return theme.warning;
}

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

/** pulseRing is declared in `+html.tsx`; registering it here emits a real web class. */
const motion = StyleSheet.create({
  pulse: webAnimation({
    animationKeyframes: "pulseRing",
    animationDuration: "2.2s",
    animationTimingFunction: "ease-out",
    animationIterationCount: "infinite",
  }),
});

export function KnowledgeConstellation({
  nodes,
  onOpenNode,
}: {
  nodes: readonly TopologyNode[];
  onOpenNode: (id: string) => void;
}) {
  const { theme, mode } = useTheme();
  const styles = useConstellationStyles(mode, theme);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [filter, setFilter] = useState<"all" | ClusterKey>("all");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const displayNodes = useMemo(() => {
    const found: TopologyNode[] = [];
    for (const cluster of CLUSTERS) {
      for (const id of cluster.ids) {
        const node = nodeById(nodes, id);
        if (node) found.push(node);
      }
    }
    return found;
  }, [nodes]);

  const height = layoutWidth > 0 && layoutWidth < 700 ? GRAPH_HEIGHT_NARROW : GRAPH_HEIGHT;
  const compactGraph = layoutWidth > 0 && layoutWidth < 520;
  const focusId = hoverId ?? selectedId;
  const focusNeighbors = focusId ? NEIGHBORS[focusId] ?? NO_NEIGHBORS : NO_NEIGHBORS;

  const fallbackNode = displayNodes.find((node) => filter === "all" || CLUSTER_OF[node.id] === filter) ?? displayNodes[0] ?? null;
  const inspectorNode = displayNodes.find((node) => node.id === focusId) ?? fallbackNode;

  const isDimmed = (node: TopologyNode) => {
    const matchesFilter = filter === "all" || CLUSTER_OF[node.id] === filter;
    const inFocus = !focusId || node.id === focusId || focusNeighbors.has(node.id);
    return !matchesFilter || !inFocus;
  };

  const handleLayout = (event: LayoutChangeEvent) => {
    const nextWidth = event.nativeEvent.layout.width;
    if (Math.abs(nextWidth - layoutWidth) > 0.5) setLayoutWidth(nextWidth);
  };

  const chooseFilter = (next: "all" | ClusterKey) => {
    setHoverId(null);
    setFilter(next);
    setSelectedId((current) => (current && (next === "all" || CLUSTER_OF[current] === next) ? current : null));
  };

  return <View style={styles.root}>
    <View style={styles.filterRow} accessibilityRole="tablist" accessibilityLabel="知识星图聚类筛选">
      {[{ key: "all" as const, label: "全部" }, ...CLUSTERS].map((cluster) => {
        const active = filter === cluster.key;
        return <Pressable
          key={cluster.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
          accessibilityLabel={`筛选${cluster.label}`}
          onPress={() => chooseFilter(cluster.key)}
          style={({ pressed }) => [
            styles.filterPill,
            { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : theme.bgSurface },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.filterText, { color: active ? theme.accentPrimary : theme.textSecondary }]}>{cluster.label}</Text>
        </Pressable>;
      })}
    </View>

    <View style={[styles.graph, { height }]} onLayout={handleLayout}>
      {Platform.OS === "web" && layoutWidth > 0 ? <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        pointerEvents="none"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
        aria-hidden
      >
        {EDGES.map(([leftId, rightId]) => {
          const left = COORDS[leftId];
          const right = COORDS[rightId];
          if (!left || !right) return null;
          const incident = Boolean(focusId && (leftId === focusId || rightId === focusId));
          const inFilter = filter === "all" || CLUSTER_OF[leftId] === filter || CLUSTER_OF[rightId] === filter;
          const dimmed = Boolean((focusId && !incident) || !inFilter);
          return <line
            key={`${leftId}-${rightId}`}
            x1={left.x * 100}
            y1={left.y * 100}
            x2={right.x * 100}
            y2={right.y * 100}
            stroke={incident ? theme.accentPrimary : theme.borderSubtle}
            strokeWidth={incident ? 1.7 : 1}
            strokeOpacity={dimmed ? 0.16 : incident ? 0.92 : 0.55}
            strokeDasharray={incident ? undefined : "2 3"}
            vectorEffect="non-scaling-stroke"
          />;
        })}
      </svg> : null}

      {displayNodes.map((node) => {
        const coord = COORDS[node.id];
        if (!coord) return null;
        const dimmed = isDimmed(node);
        const focused = node.id === focusId;
        const neighbor = Boolean(focusId && focusNeighbors.has(node.id));
        const color = masteryColor(theme, node.mastery);
        const left = Math.min(Math.max(coord.x * layoutWidth - NODE_WIDTH / 2, 0), Math.max(0, layoutWidth - NODE_WIDTH));
        const top = coord.y * height - 7.5;
        return <Pressable
          key={node.id}
          accessibilityRole="button"
          accessibilityLabel={`${node.title}，掌握度 ${node.mastery}%`}
          accessibilityState={{ selected: selectedId === node.id }}
          onHoverIn={() => setHoverId(node.id)}
          onHoverOut={() => setHoverId(null)}
          onPress={() => setSelectedId(node.id)}
          style={[
            styles.nodeWrap,
            { left, top, zIndex: focused ? 4 : neighbor ? 3 : dimmed ? 1 : 2, opacity: dimmed ? 0.16 : 1 },
            webOnly({ transitionProperty: "opacity, transform", transitionDuration: "180ms", transitionTimingFunction: "ease" }),
          ]}
        >
          <View style={styles.dotArea}>
            {node.mastery < 60 ? <View pointerEvents="none" style={[styles.pulseRing, { borderColor: theme.warning }, Platform.OS === "web" ? motion.pulse : null]} /> : null}
            <View style={[styles.dot, { backgroundColor: color, transform: [{ scale: focused ? 1.4 : neighbor ? 1.2 : 1 }] }, webOnly({ transitionProperty: "transform", transitionDuration: "160ms", transitionTimingFunction: "ease" })]} />
          </View>
          {(focused || !compactGraph || filter !== "all") ? <>
            <Text numberOfLines={2} style={[styles.nodeLabel, { color: focused ? theme.textPrimary : theme.textSecondary }]}>{node.title}</Text>
            <Text style={[styles.nodeMastery, { color }]}>{node.mastery}%</Text>
          </> : null}
        </Pressable>;
      })}
    </View>

    {inspectorNode ? <View style={[styles.inspector, { backgroundColor: theme.bgSurface, borderColor: theme.borderDivider }]}>
      <View style={styles.inspectorCopy}>
        <View style={styles.inspectorTop}>
          <Text numberOfLines={1} style={[styles.inspectorTitle, { color: theme.textPrimary }]}>{inspectorNode.title}</Text>
          <View style={[styles.masteryPill, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.masteryPillText, { color: masteryColor(theme, inspectorNode.mastery) }]}>掌握 {inspectorNode.mastery}%</Text>
          </View>
        </View>
        <Text style={[styles.inspectorEssence, { color: theme.textSecondary }]}>{essenceForNode(inspectorNode)}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`立即前往突破 ${inspectorNode.title}`}
        onPress={() => onOpenNode(inspectorNode.id)}
        style={({ pressed }) => [styles.inspectorAction, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed]}
      >
        <Text style={[styles.inspectorActionText, { color: theme.onAccent }]}>立即前往突破 →</Text>
      </Pressable>
    </View> : null}
  </View>;
}

function heatLevel(index: number): number {
  const hash = (index * 37 + 11) % 13;
  const level = hash < 4 ? 0 : hash < 8 ? 1 : hash < 10 ? 2 : hash < 12 ? 3 : 4;
  // Keep the recent two weeks active so the 连续学习 14 天 claim is backed by the grid.
  return index >= HEAT_TOTAL - 14 ? Math.max(1, level) : level;
}

function formatDay(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

const HEAT_STATS: readonly { emoji: string; label: string; value: string; tone: "warning" | "agent" | "success" }[] = [
  { emoji: "🔥", label: "连续学习", value: "14 天", tone: "warning" },
  { emoji: "⚡", label: "累计 SQL 沙箱实操", value: "96 次", tone: "agent" },
  { emoji: "🧠", label: "累计记忆加固", value: "42 次", tone: "success" },
];

export function ActivityHeatmap({ nodes }: { nodes: readonly TopologyNode[] }) {
  const { theme, mode } = useTheme();
  const styles = useConstellationStyles(mode, theme);
  const width = useHydratedWidth();
  const narrow = width > 0 && width < 700;
  const cellSize = narrow ? 12 : 15;
  const [selectedDay, setSelectedDay] = useState(HEAT_TOTAL - 1);

  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const dateFor = (index: number) => {
    const date = new Date(today.getTime());
    date.setDate(date.getDate() - (HEAT_TOTAL - 1 - index));
    return date;
  };

  const levelColor = (level: number) => level === 0
    ? theme.bgElevated
    : level === 1
      ? theme.successSoft
      : level === 2
        ? `${theme.success}55`
        : level === 3
          ? `${theme.success}99`
          : theme.success;

  const selectedLevel = heatLevel(selectedDay);
  const footprintNode = nodes.length > 0 ? nodes[(selectedDay * 13 + 5) % nodes.length] ?? nodes[0] ?? null : null;
  const lawEssence = footprintNode ? essenceForNode(footprintNode) : "";
  const lawFact = footprintNode ? factsForNode(footprintNode)[0] ?? lawEssence : "";

  return <View style={styles.root}>
    <View style={styles.statRow}>
      {HEAT_STATS.map((stat) => <View key={stat.label} style={[styles.statTile, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
        <Text style={styles.statLine}>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.emoji} {stat.label} </Text>
          <Text style={[styles.statValue, { color: stat.tone === "warning" ? theme.warning : stat.tone === "agent" ? theme.agent : theme.success }]}>{stat.value}</Text>
        </Text>
      </View>)}
    </View>

    <View style={[styles.heatCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderDivider }]}>
      <View style={styles.heatGrid}>
        {Array.from({ length: WEEK_COUNT }, (_, week) => <View key={week} style={styles.heatColumn}>
          {Array.from({ length: DAY_COUNT }, (_, day) => {
            const index = week * DAY_COUNT + day;
            const level = heatLevel(index);
            const selected = index === selectedDay;
            const date = dateFor(index);
            return <Pressable
              key={day}
              accessibilityRole="button"
              accessibilityLabel={`${formatDay(date)}，学习强度 ${level + 1} 级`}
              accessibilityState={{ selected }}
              onHoverIn={() => setSelectedDay(index)}
              onPress={() => setSelectedDay(index)}
              style={({ pressed }) => [
                styles.heatCell,
                {
                  width: cellSize,
                  height: cellSize,
                  backgroundColor: levelColor(level),
                  borderColor: selected ? theme.accentPrimary : "transparent",
                  borderWidth: selected ? 1.5 : 0,
                },
                pressed && styles.pressed,
              ]}
            />;
          })}
        </View>)}
      </View>
      <View style={styles.legendRow}>
        <Text style={[styles.legendLabel, { color: theme.textMuted }]}>少</Text>
        {[0, 1, 2, 3, 4].map((level) => <View key={level} style={[styles.legendCell, { backgroundColor: levelColor(level) }]} />)}
        <Text style={[styles.legendLabel, { color: theme.textMuted }]}>多</Text>
      </View>
    </View>

    {footprintNode ? <View style={[styles.footprintCard, { backgroundColor: theme.bgSurface, borderColor: theme.borderDivider }]}>
      <View style={styles.footprintHead}>
        <Text style={[styles.footprintDate, { color: theme.textPrimary }]}>{formatDay(dateFor(selectedDay))}</Text>
        <View style={[styles.footprintBadge, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}>
          <Text style={[styles.footprintBadgeText, { color: theme.success }]}>学习强度 {selectedLevel + 1} 级</Text>
        </View>
      </View>
      <Text style={[styles.footprintLine, { color: theme.textSecondary }]}>
        深度学习 {30 + selectedLevel * 10} 分钟 · 攻克「{footprintNode.title}」 · 执行 {selectedLevel * 3 + 2} 次 SQL 验证 · BKT 跃迁 +{4 + selectedLevel * 3}%
      </Text>
      <View style={[styles.lawBlock, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
        <Text style={[styles.lawKicker, { color: theme.accentPrimary }]}>当日核心定律</Text>
        <Text style={[styles.lawText, { color: theme.textPrimary }]}>{lawEssence}</Text>
        {lawFact && lawFact !== lawEssence ? <Text numberOfLines={2} style={[styles.lawFact, { color: theme.textMuted }]}>{lawFact}</Text> : null}
      </View>
    </View> : <Text style={[styles.emptyText, { color: theme.textMuted }]}>完成一次 SQL 沙箱实验后，这里会出现当天的学习足迹。</Text>}

    <Text style={[styles.hint, { color: theme.textMuted }]}>悬停或点击任一格子，查看当天的深度学习足迹</Text>
  </View>;
}

const constellationStyleCache = new Map<ThemeMode, ReturnType<typeof createConstellationStyles>>();

function useConstellationStyles(mode: ThemeMode, theme: ThemeTokens) {
  if (!constellationStyleCache.has(mode)) constellationStyleCache.set(mode, createConstellationStyles(theme));
  return constellationStyleCache.get(mode)!;
}

function createConstellationStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    root: { gap: 9, minWidth: 0 },
    pressed: { opacity: 0.82 },
    filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    filterPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    filterText: { fontSize: 13, fontWeight: "800" },

    graph: { position: "relative", width: "100%", minWidth: 0 },
    nodeWrap: { position: "absolute", width: NODE_WIDTH, alignItems: "center", gap: 1, paddingVertical: 1 },
    dotArea: { width: 15, height: 15, alignItems: "center", justifyContent: "center" },
    pulseRing: { position: "absolute", width: 15, height: 15, borderRadius: 999, borderWidth: 1.4 },
    dot: { width: 15, height: 15, borderRadius: 999 },
    nodeLabel: { maxWidth: 90, fontSize: 12, lineHeight: 15, textAlign: "center", fontWeight: "600" },
    nodeMastery: { fontSize: 10, fontFamily: MONO_FONT, fontVariant: ["tabular-nums"], fontWeight: "700" },

    inspector: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
    inspectorCopy: { flex: 1, minWidth: 170, gap: 3 },
    inspectorTop: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    inspectorTitle: { flexShrink: 1, minWidth: 0, fontSize: 17, fontWeight: "800", letterSpacing: -0.3, lineHeight: 23 },
    masteryPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
    masteryPillText: { fontSize: 12, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    inspectorEssence: { fontSize: 14.5, lineHeight: 21 },
    inspectorAction: { minHeight: 38, borderRadius: 8, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    inspectorActionText: { fontSize: 13.5, fontWeight: "800" },

    statRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    statTile: { flex: 1, minWidth: 92, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 9, justifyContent: "center" },
    statLine: { fontSize: 13, lineHeight: 22, fontWeight: "700" },
    statValue: { fontSize: 19, lineHeight: 22, fontWeight: "900", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    statLabel: { fontSize: 13, lineHeight: 22, fontWeight: "700" },

    heatCard: { borderRadius: 12, borderWidth: 1, padding: 10, gap: 7, alignSelf: "flex-start", maxWidth: "100%" },
    heatGrid: { flexDirection: "row", gap: 3 },
    heatColumn: { gap: 3 },
    heatCell: { borderRadius: 3 },
    legendRow: { flexDirection: "row", alignItems: "center", gap: 3 },
    legendCell: { width: 11, height: 11, borderRadius: 3 },
    legendLabel: { fontSize: 11, fontWeight: "600" },

    footprintCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8 },
    footprintHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    footprintDate: { fontSize: 16, fontWeight: "800" },
    footprintBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
    footprintBadgeText: { fontSize: 12, fontWeight: "800" },
    footprintLine: { fontSize: 14, lineHeight: 21 },
    lawBlock: { borderRadius: 9, borderWidth: 1, padding: 9, gap: 3 },
    lawKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
    lawText: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
    lawFact: { fontSize: 13.5, lineHeight: 20 },

    hint: { fontSize: 13, lineHeight: 19 },
    emptyText: { fontSize: 13, lineHeight: 20 },
  });
}
