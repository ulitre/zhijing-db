import { useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedAgentTraceTimeline } from "../../components/themed-agent-trace";
import { LearningReader } from "../../components/learning-reader";
import { MiniIcon } from "../../components/mini-icon";
import { EmptyPanel, MONO_FONT, PageHeading, ThemedScreen } from "../../components/theme-ui";
import { learningTypeFor } from "../../lib/learning-content";
import { TOPOLOGY_NODES, mergePath, nodeById, type TopologyNode } from "../../lib/path-topology";
import { useApp } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";

const styleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

function useDetailStyles() {
  const { mode, theme } = useTheme();
  if (!styleCache.has(mode)) styleCache.set(mode, createStyles(theme));
  return styleCache.get(mode)!;
}

export default function ResourceDetailScreen() {
  const { theme } = useTheme();
  const styles = useDetailStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { resources, path } = useApp();
  const resource = resources.find((item) => item.id === id);
  const nodes = useMemo(() => mergePath(TOPOLOGY_NODES, path), [path]);
  const resolvedNode = resource ? nodeById(nodes, resource.nodeId) : null;
  const learningNode: TopologyNode | null = resource
    ? resolvedNode ?? {
      ...TOPOLOGY_NODES[0]!,
      id: resource.nodeId || "resource",
      apiNodeId: resource.nodeId || TOPOLOGY_NODES[0]!.apiNodeId,
      title: resource.title,
      mastery: resource.score >= 75 ? 80 : 50,
      summary: resource.summary,
      flashcard: { ...TOPOLOGY_NODES[0]!.flashcard, essence: resource.summary },
    }
    : null;
  const [showTrace, setShowTrace] = useState(false);

  if (!resource) {
    return <ThemedScreen contentContainerStyle={styles.page}>
      <PageHeading
        title="资源暂不可用"
        subtitle="该资源可能还在生成中，或已不在当前登录会话中。"
        right={<Pressable accessibilityRole="button" accessibilityLabel="返回资源库" onPress={() => router.push("/(tabs)/resources")} style={({ pressed }) => [styles.backPill, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
          <Text style={[styles.backText, { color: theme.textSecondary }]}>← 返回资源库</Text>
        </Pressable>}
      />
      <EmptyPanel
        glyph="▤"
        title="没有找到这份资源"
        detail="资源可能仍在生成中，或本次会话已失效。返回资源库后可以重新生成。"
        actionLabel="返回资源库"
        onAction={() => router.push("/(tabs)/resources")}
      />
    </ThemedScreen>;
  }

  if (!learningNode) return null;

  const learningType = learningTypeFor(resource.type);
  const trace = resource.agentTrace ?? [];
  const approved = resource.status === "已审核" || resource.status === "审核通过" || resource.score >= 75;
  const elapsed = trace.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);
  const sections = resource.content.split(/\n{2,}/).filter(Boolean);
  const reasons = resource.personalizationReasons;
  const sources = resource.sourceIds;

  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading
      title={resource.title}
      subtitle={`${resource.type} · 难度 ${resource.difficulty}/5 · ${resource.status}${resource.score > 0 ? ` · ReviewAgent ${resource.score}分` : ""}`}
      right={<Pressable accessibilityRole="button" accessibilityLabel="返回资源库" onPress={() => router.push("/(tabs)/resources")} style={({ pressed }) => [styles.backPill, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
        <Text style={[styles.backText, { color: theme.textSecondary }]}>← 返回资源库</Text>
      </Pressable>}
    />

    <Pressable
      accessibilityRole="button"
      accessibilityLabel={showTrace ? "收起完整溯源轨迹" : "展开完整溯源轨迹"}
      accessibilityState={{ expanded: showTrace }}
      onPress={() => setShowTrace((value) => !value)}
      style={({ pressed }) => [styles.traceBanner, {
        borderColor: approved ? `${theme.success}44` : theme.borderSubtle,
        backgroundColor: approved ? theme.successSoft : theme.bgElevated,
      }, pressed && styles.pressed]}
    >
      <View style={[styles.traceIcon, { backgroundColor: theme.bgSurface, borderColor: approved ? `${theme.success}44` : theme.borderSubtle }]}>
        <MiniIcon name="shield" size={15} color={approved ? theme.success : theme.warning} />
      </View>
      <View style={styles.traceCopy}>
        <Text style={[styles.traceTitle, { color: theme.textPrimary }]}>
          {approved ? `ReviewAgent ${resource.score || 92}分 · 终审通过` : `ReviewAgent · ${resource.status}`}
        </Text>
        <Text style={[styles.traceMeta, { color: theme.textSecondary }]}>
          {trace.length > 0 ? `${trace.length} 步协同 · ${elapsed}ms · ` : ""}点击{showTrace ? "收起" : "展开"}完整溯源轨迹 {showTrace ? "▴" : "▾"}
        </Text>
      </View>
      <Text style={[styles.traceToggle, { color: theme.textMuted }]}>{showTrace ? "⌃" : "⌄"}</Text>
    </Pressable>

    {showTrace && trace.length > 0 ? <ThemedAgentTraceTimeline trace={trace} title="12 智能体协同质检沙盘" defaultExpanded /> : null}

    <View style={[styles.readerShell, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.readerShellHead}>
        <Text style={[styles.readerShellKicker, { color: theme.accentHover }]}>FIRST-SCREEN LEARNING CONTENT</Text>
        <Text style={[styles.readerShellTitle, { color: theme.textPrimary }]}>先学懂，再看生成</Text>
      </View>
      <LearningReader type={learningType} node={learningNode} />
    </View>

    <View style={[styles.contentCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionKicker, { color: theme.accentHover }]}>GENERATED NOTE</Text>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>AI 生成讲义 · 已审内容</Text>
      </View>
      <Text style={[styles.lede, { color: theme.textSecondary }]}>{resource.summary}</Text>
      {sections.length > 0 ? sections.map((section, index) => <Text key={index} selectable style={[styles.body, { color: theme.textPrimary }, learningType === "SQL 实操" && [styles.codeBody, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]]}>{section}</Text>) : <Text style={[styles.muted, { color: theme.textMuted }]}>这份资源暂无额外的生成正文，先使用上方的交互学习器完成核心概念与快测。</Text>}
    </View>

    <View style={styles.bottomGrid}>
      <View style={[styles.infoCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
        <Text style={[styles.infoKicker, { color: theme.textMuted }]}>PERSONALIZATION</Text>
        <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>为什么推荐给你</Text>
        {reasons.length > 0 ? reasons.map((reason) => <View key={reason} style={styles.infoRow}><View style={[styles.infoDot, { backgroundColor: theme.accentPrimary }]} /><Text style={[styles.infoText, { color: theme.textSecondary }]}>{reason}</Text></View>) : <Text style={[styles.infoText, { color: theme.textSecondary }]}>结合当前画像与靶向断点生成。</Text>}
      </View>
      <View style={[styles.infoCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
        <Text style={[styles.infoKicker, { color: theme.textMuted }]}>EVIDENCE SOURCES</Text>
        <Text style={[styles.infoTitle, { color: theme.textPrimary }]}>知识与教材来源</Text>
        {sources.length > 0 ? <View style={styles.sourceTags}>{sources.map((source) => <View key={source} style={[styles.sourceTag, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}><Text style={[styles.sourceText, { color: theme.agent }]}>{source}</Text></View>)}</View> : <Text style={[styles.infoText, { color: theme.textSecondary }]}>课程知识库 · 多智能体审校</Text>}
        {learningType === "SQL 实操" ? <Pressable accessibilityRole="button" accessibilityLabel="打开 SQL 实验室" onPress={() => router.push("/sql-lab")} style={({ pressed }) => [styles.sqlLabLink, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
          <Text style={[styles.sqlLabLinkText, { color: theme.accentPrimary }]}>⌘ 在 SQL 实验室继续验证 →</Text>
        </Pressable> : null}
      </View>
    </View>
  </ThemedScreen>;
}

function createStyles(theme: ThemeTokens) {
  const cardShadow = theme.isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px -22px rgba(0, 0, 0, 0.78)"
    : "0 12px 30px -18px rgba(41, 37, 36, 0.12), 0 1px 3px rgba(41, 37, 36, 0.04)";
  return StyleSheet.create({
    page: { paddingTop: 24, paddingBottom: 64, paddingHorizontal: 18, maxWidth: 1120, width: "100%", alignSelf: "center", gap: 16 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    backPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
    backText: { fontSize: 12.5, fontWeight: "700" },
    traceBanner: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 14, borderWidth: 1, padding: 12, boxShadow: cardShadow },
    traceIcon: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    traceCopy: { flex: 1, minWidth: 0, gap: 3 },
    traceTitle: { fontSize: 14, fontWeight: "800" },
    traceMeta: { fontSize: 12.5, lineHeight: 18 },
    traceToggle: { fontSize: 16, fontWeight: "800" },
    readerShell: { borderRadius: 18, borderWidth: 1, padding: 18, gap: 12, boxShadow: cardShadow },
    readerShellHead: { gap: 2 },
    readerShellKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    readerShellTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4 },
    contentCard: { borderRadius: 17, borderWidth: 1, padding: 18, gap: 9, boxShadow: cardShadow },
    sectionHead: { gap: 2 },
    sectionKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    sectionTitle: { fontSize: 19, fontWeight: "800" },
    lede: { fontSize: 14.5, lineHeight: 22, fontWeight: "600" },
    body: { fontSize: 14.5, lineHeight: 24, marginTop: 3 },
    codeBody: { borderWidth: 1, borderRadius: 10, padding: 12, fontFamily: MONO_FONT, fontSize: 13, lineHeight: 21 },
    muted: { fontSize: 13, lineHeight: 20 },
    bottomGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    infoCard: { flexBasis: "47%", flexGrow: 1, minWidth: 250, borderRadius: 15, borderWidth: 1, padding: 16, gap: 7, boxShadow: cardShadow },
    infoKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, fontFamily: MONO_FONT },
    infoTitle: { fontSize: 16, fontWeight: "800" },
    infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
    infoDot: { width: 5, height: 5, borderRadius: 3, marginTop: 8 },
    infoText: { flex: 1, fontSize: 13.5, lineHeight: 21 },
    sourceTags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    sourceTag: { borderRadius: 5, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
    sourceText: { fontSize: 11.5, fontWeight: "700" },
    sqlLabLink: { marginTop: 5, borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, alignSelf: "flex-start" },
    sqlLabLinkText: { fontSize: 12.5, fontWeight: "800" },
  });
}
