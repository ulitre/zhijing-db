import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { AgentTraceTimeline } from "../../components/agent-trace-timeline";
import { GlassCard, PageHeader, SectionTitle, palette } from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { useApp } from "../../state/app-context";

const types = ["讲解文档", "知识图解", "分层练习", "SQL 实操", "交互图解", "复习卡片"];
const typeStyle: Record<string, { color: string; tint: string; glyph: string }> = {
  "讲解文档": { color: "#60A5FA", tint: "rgba(37, 99, 235, 0.14)", glyph: "▤" },
  "知识图解": { color: "#A78BFA", tint: "rgba(124, 58, 237, 0.16)", glyph: "◇" },
  "分层练习": { color: "#FBBF24", tint: "rgba(217, 119, 6, 0.14)", glyph: "✎" },
  "SQL 实操": { color: "#34D399", tint: "rgba(5, 150, 105, 0.14)", glyph: "⌘" },
  "交互图解": { color: "#22D3EE", tint: "rgba(8, 145, 178, 0.14)", glyph: "✦" },
  "复习卡片": { color: "#FB7185", tint: "rgba(225, 29, 72, 0.14)", glyph: "▣" },
};

export default function ResourcesScreen() {
  const { resources, latestTrace, addGeneratedResource } = useApp();
  const [pulse] = useState(() => new Animated.Value(0.55));
  const generating = resources.some((resource) => resource.status === "生成中");
  useEffect(() => {
    if (!generating) { pulse.setValue(0.55); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.55, duration: 750, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [generating, pulse]);

  return <ScreenShell><PageHeader title="个性化资源库" subtitle="每份资源都记录画像依据、知识来源与审核结果" />
    <GlassCard accent>
      <SectionTitle meta="按需生成">六类资源</SectionTitle>
      <View style={styles.typeGrid}>{types.map((type) => {
        const visual = typeStyle[type];
        const isGenerating = resources.some((resource) => resource.type === type && resource.status === "生成中");
        return <Pressable key={type} accessibilityRole="button" accessibilityLabel={`生成${type}`} onPress={() => void addGeneratedResource(type)} style={({ pressed }) => [styles.typeButton, { borderColor: `${visual.color}66`, backgroundColor: visual.tint }, pressed && styles.pressed]}>
          <Text style={[styles.typeIcon, { color: visual.color }]}>{visual.glyph}</Text><Text style={[styles.typeText, { color: visual.color }]}>{type}</Text>
          {isGenerating ? <Animated.View style={[styles.generatingLabel, { opacity: pulse }]}><ActivityIndicator size="small" color={visual.color} /><Text style={[styles.generatingText, { color: visual.color }]}>生成中</Text></Animated.View> : null}
        </Pressable>;
      })}</View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="评委演示：模拟初审打回重构"
        onPress={() => void addGeneratedResource("讲解文档", { forceReviewReject: true })}
        style={({ pressed }) => [styles.rejectDemoButton, pressed && styles.pressed]}
      >
        <View style={styles.rejectDemoLeft}>
          <Text style={styles.rejectDemoIcon}>🛡️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rejectDemoTitle}>评委演示：模拟初审质检打回重构</Text>
            <Text style={styles.rejectDemoSubtitle}>触发 ReviewAgent 条件边循环 (初审65分打回 ➔ 二次重构 ➔ 94分终审通过)</Text>
          </View>
        </View>
        <Text style={styles.rejectDemoBadge}>触发循环 ›</Text>
      </Pressable>

      <Pressable onPress={() => router.push("/sql-lab")} style={({ pressed }) => [styles.labButton, pressed && styles.pressed]}>
        <Text style={styles.labButtonText}>⌘  打开可执行 SQL 实验室 →</Text>
      </Pressable>
    </GlassCard>

    {latestTrace && latestTrace.length > 0 && (
      <View style={{ marginTop: 12 }}>
        <AgentTraceTimeline
          trace={latestTrace}
          title="最新生成 · 12 智能体协同沙盘"
          defaultExpanded={true}
        />
      </View>
    )}

    <SectionTitle meta={`${resources.length} 份`}>最近资源</SectionTitle>
    {resources.length === 0 ? <Text style={styles.empty}>暂无已生成资源。选择上方资源类型，系统会结合当前学生画像生成。</Text> : resources.map((resource) => {
      const visual = typeStyle[resource.type] ?? { color: palette.blue, tint: "rgba(37, 99, 235, 0.12)", glyph: "✦" };
      const isApproved = resource.status === "已审核" || resource.status === "审核通过";
      const isGenerating = resource.status === "生成中";
      const traceSteps = resource.agentTrace?.length ?? 0;
      return <Pressable key={resource.id} accessibilityRole={resource.content ? "button" : undefined} onPress={() => resource.content && router.push({ pathname: "/resource/[id]", params: { id: resource.id } } as never)} style={({ pressed }) => [styles.resourcePressable, pressed && resource.content && styles.pressed]}>
        <GlassCard><View style={styles.topRow}><View style={[styles.typeBadge, { borderColor: `${visual.color}55`, backgroundColor: visual.tint }]}><Text style={{ color: visual.color, fontSize: 10 }}>{visual.glyph}</Text><Text style={[styles.typeLabel, { color: visual.color }]}>{resource.type}</Text></View><Text style={styles.score}>{resource.score > 0 ? `Review ${resource.score}` : isGenerating ? "处理中" : "未评分"}</Text></View>
          <Text style={styles.title}>{resource.title}</Text><Text style={styles.summary}>{resource.summary}</Text>
          <View style={styles.reviewStamp}><Text style={[styles.reviewGlyph, !isApproved && styles.reviewPending]}>{isApproved ? "✓" : isGenerating ? "◌" : resource.status === "已降级" ? "!" : "◇"}</Text><Text style={[styles.reviewText, isApproved && styles.reviewApproved]}>{isApproved ? "审核通过：已校验教材出处与难度" : isGenerating ? "ReviewAgent 正在审核资源" : resource.status === "已降级" ? "服务暂不可用：已回退" : `ReviewAgent · ${resource.status}`}</Text></View>
          <View style={styles.bottomRow}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.status, { color: isApproved ? palette.success : isGenerating ? palette.warning : palette.muted }]}>{resource.status}</Text>
              {traceSteps > 0 && <Text style={styles.traceTag}>⚡ {traceSteps}步沙盘</Text>}
            </View>
            <Text style={styles.citation}>{resource.content ? "点开查看协同沙盘与内容 ›" : isGenerating ? "等待生成" : "暂无内容"}</Text>
          </View>
        </GlassCard>
      </Pressable>;
    })}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, typeButton: { width: "31%", minWidth: 96, minHeight: 88, alignItems: "center", justifyContent: "center", padding: 10, borderRadius: 15, borderWidth: 1 }, typeIcon: { fontSize: 18 }, typeText: { fontWeight: "900", fontSize: 10, marginTop: 6, textAlign: "center" }, generatingLabel: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }, generatingText: { fontSize: 8, fontWeight: "800" }, pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  rejectDemoButton: { marginTop: 12, borderRadius: 13, backgroundColor: "rgba(239, 68, 68, 0.12)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.35)", padding: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rejectDemoLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, marginRight: 8 },
  rejectDemoIcon: { fontSize: 18 },
  rejectDemoTitle: { color: "#FCA5A5", fontSize: 11, fontWeight: "900" },
  rejectDemoSubtitle: { color: "#E2E8F0", fontSize: 9, marginTop: 2, lineHeight: 13 },
  rejectDemoBadge: { color: "#F87171", fontSize: 10, fontWeight: "900" },
  labButton: { marginTop: 10, borderRadius: 13, backgroundColor: "rgba(37, 99, 235, 0.2)", borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.38)", padding: 14, alignItems: "center" }, labButtonText: { color: "#BFDBFE", fontWeight: "900", fontSize: 11 }, empty: { color: palette.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  resourcePressable: { borderRadius: 22 }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, typeBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, borderWidth: 1 }, typeLabel: { fontSize: 10, fontWeight: "900" }, score: { color: "#A5B4FC", fontSize: 9, fontWeight: "800" }, title: { color: palette.ink, fontSize: 15, fontWeight: "900", marginTop: 10 }, summary: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 5 },
  reviewStamp: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 12, paddingHorizontal: 9, paddingVertical: 8, borderRadius: 11, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.22)", backgroundColor: "rgba(16, 185, 129, 0.08)" }, reviewGlyph: { color: palette.success, fontWeight: "900", fontSize: 11 }, reviewPending: { color: palette.warning }, reviewText: { flex: 1, color: "#A7F3D0", fontSize: 9, fontWeight: "800" }, reviewApproved: { color: "#6EE7B7" }, bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 11 }, status: { fontSize: 9, fontWeight: "800" }, traceTag: { color: "#38BDF8", fontSize: 9, fontWeight: "800", backgroundColor: "rgba(56, 189, 248, 0.12)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 0.5, borderColor: "rgba(56, 189, 248, 0.3)" }, citation: { color: palette.muted, fontSize: 9 },
});
