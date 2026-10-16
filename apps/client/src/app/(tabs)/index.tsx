import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AgentStreamerBadge, GlassCard, MasteryProgressBar, PageHeader, PersonaBadge, SectionTitle, palette } from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { useApp } from "../../state/app-context";

const pipeline = ["Orchestrator", "ProfileAgent", "DiagnosisAgent", "PathAgent", "ResourceAgent", "ReviewAgent"];
const dimensions = [
  { label: "先修基础", value: 48 }, { label: "知识掌握", value: 56 },
  { label: "目标清晰", value: 86 }, { label: "节奏匹配", value: 72 },
  { label: "错误识别", value: 68 }, { label: "资源偏好", value: 82 },
  { label: "练习独立", value: 61 }, { label: "进步趋势", value: 74 },
];

export default function HomeScreen() {
  const { currentUser, path } = useApp();
  const [showProfile, setShowProfile] = useState(false);
  if (!currentUser || !path[0]) return null;
  const active = path[0];
  const tier = active.mastery >= 80 ? "已掌握" : active.mastery >= 60 ? "持续巩固" : "建议补救";

  return <ScreenShell>
    <PageHeader title={`你好，${currentUser.displayName}`} subtitle="今天从最关键的知识断点继续，路径会随表现自动调整。" right={<PersonaBadge persona={currentUser.persona} />} />

    <GlassCard accent>
      <View style={styles.pipelineHeading}><SectionTitle meta="6 / 12 AGENTS">智能体协同流水线</SectionTitle><AgentStreamerBadge label="Orchestrator" status="调度中" /></View>
      <Text style={styles.pipelineNote}>从画像与诊断证据，推进到资源生成和质量复核</Text>
      <View style={styles.pipelineTrack}>{pipeline.map((agent, index) => <View key={agent} style={styles.pipelineItem}>
        <View style={[styles.pipelineNode, index < 3 && styles.pipelineNodeDone, index === 3 && styles.pipelineNodeActive]}><Text style={[styles.pipelineGlyph, index < 3 && styles.pipelineGlyphDone]}>{index < 3 ? "✓" : index === 3 ? "✦" : "◇"}</Text></View>
        <Text style={[styles.pipelineLabel, index === 3 && styles.pipelineLabelActive]}>{agent.replace("Agent", "")}</Text>
        {index < pipeline.length - 1 ? <Text style={styles.pipelineArrow}>›</Text> : null}
      </View>)}</View>
      <Text style={styles.pipelineFoot}>当前节点：PathAgent · 其余智能体按任务状态接续运行</Text>
    </GlassCard>

    <GlassCard accent>
      <View style={styles.todayHeader}><View style={styles.todayCopy}><Text style={styles.kicker}>TODAY · 推荐突破</Text><Text style={styles.hero}>{active.title}</Text></View><Text style={styles.todayIcon}>✦</Text></View>
      <Text style={styles.body}>{active.reason}</Text>
      <View style={styles.progressRow}><Text style={styles.muted}>诊断掌握度 · {tier}</Text><Text style={styles.value}>{active.mastery}%</Text></View>
      <MasteryProgressBar value={active.mastery} />
    </GlassCard>

    <View style={styles.metrics}>
      <GlassCard><Text style={styles.metricValue}>45</Text><Text style={styles.metricLabel}>课程知识节点</Text><Text style={styles.metricHint}>全课程拓扑</Text></GlassCard>
      <GlassCard><Text style={[styles.metricValue, { color: palette.danger }]}>3</Text><Text style={styles.metricLabel}>待补知识断点</Text><Text style={styles.metricHint}>建议优先处理</Text></GlassCard>
    </View>

    <GlassCard>
      <View style={styles.profileHead}><View style={styles.profileCopy}><SectionTitle meta="当前学习者">学习身份与画像</SectionTitle><Text style={styles.profileName}>{currentUser.displayName}</Text></View><PersonaBadge persona={currentUser.persona} /></View>
      <Text style={styles.goal}>主要目标：{currentUser.goal}</Text>
      <View style={styles.personaChoices}>{(["foundation", "exam", "practice"] as const).map((persona) => <View key={persona} style={[styles.personaChip, currentUser.persona === persona && styles.personaChipActive]}><Text style={[styles.personaChipText, currentUser.persona === persona && styles.personaChipTextActive]}>{persona === "foundation" ? "基础补齐" : persona === "exam" ? "应试巩固" : "实践进阶"}{currentUser.persona === persona ? " · 当前" : ""}</Text></View>)}</View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: showProfile }} onPress={() => setShowProfile((value) => !value)} style={({ pressed }) => [styles.profileToggle, pressed && styles.pressed]}>
        <Text style={styles.profileToggleText}>{showProfile ? "收起八维画像" : "查看八维画像"}</Text><Text style={styles.profileToggleGlyph}>{showProfile ? "⌃" : "⌄"}</Text>
      </Pressable>
      {showProfile ? <View style={styles.dimensionGrid}>{dimensions.map((item) => <View key={item.label} style={styles.dimensionItem}><View style={styles.dimensionLabelRow}><Text style={styles.dimensionLabel}>{item.label}</Text><Text style={styles.dimensionValue}>{item.value}</Text></View><MasteryProgressBar value={item.value} /></View>)}</View> : null}
      <Text style={styles.note}>画像由对话、诊断题和学习行为共同更新。</Text>
    </GlassCard>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  pipelineHeading: { gap: 12 }, pipelineNote: { color: palette.secondaryText, fontSize: 12, lineHeight: 18, marginBottom: 15 },
  pipelineTrack: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  pipelineItem: { flex: 1, alignItems: "center", position: "relative" },
  pipelineNode: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(148, 163, 184, 0.12)", borderWidth: 1, borderColor: palette.line },
  pipelineNodeDone: { backgroundColor: "rgba(16, 185, 129, 0.14)", borderColor: "rgba(16, 185, 129, 0.4)" }, pipelineNodeActive: { backgroundColor: "rgba(99, 102, 241, 0.25)", borderColor: palette.purple },
  pipelineGlyph: { color: palette.muted, fontSize: 12, fontWeight: "900" }, pipelineGlyphDone: { color: palette.success },
  pipelineLabel: { color: palette.secondaryText, fontSize: 8, textAlign: "center", marginTop: 6 }, pipelineLabelActive: { color: "#C7D2FE", fontWeight: "900" },
  pipelineArrow: { position: "absolute", right: -5, top: 5, color: palette.violet, fontSize: 18, fontWeight: "700" }, pipelineFoot: { color: "#C7D2FE", fontSize: 10, marginTop: 13 },
  todayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, todayCopy: { flex: 1 }, kicker: { color: "#93C5FD", fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  hero: { color: palette.ink, fontSize: 22, fontWeight: "900", marginTop: 7 }, todayIcon: { color: "#A5B4FC", fontSize: 27, marginLeft: 12 },
  body: { color: palette.secondaryText, lineHeight: 21, marginTop: 7 }, progressRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 18, marginBottom: 8 },
  muted: { color: palette.muted, fontSize: 12 }, value: { color: "#A5B4FC", fontWeight: "900" },
  metrics: { flexDirection: "row", gap: 12 }, metricValue: { color: palette.blue, fontSize: 27, fontWeight: "900" }, metricLabel: { color: palette.ink, fontSize: 11, fontWeight: "800", marginTop: 3 }, metricHint: { color: palette.secondaryText, fontSize: 9, marginTop: 6 },
  profileHead: { flexDirection: "row", alignItems: "center" }, profileCopy: { flex: 1 }, profileName: { color: palette.ink, fontSize: 18, fontWeight: "900", marginTop: 2 }, goal: { color: "#CBD5E1", fontSize: 12, lineHeight: 19, marginTop: 7 },
  personaChoices: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 }, personaChip: { borderWidth: 1, borderColor: palette.line, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(15, 23, 42, 0.7)" }, personaChipActive: { borderColor: "rgba(99, 102, 241, 0.65)", backgroundColor: "rgba(99, 102, 241, 0.18)" }, personaChipText: { color: palette.secondaryText, fontSize: 10, fontWeight: "700" }, personaChipTextActive: { color: "#C7D2FE" },
  profileToggle: { minHeight: 42, marginTop: 12, paddingHorizontal: 12, borderRadius: 13, borderWidth: 1, borderColor: palette.line, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(2, 6, 23, 0.72)" }, pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] }, profileToggleText: { color: "#C7D2FE", fontSize: 12, fontWeight: "800" }, profileToggleGlyph: { color: "#C7D2FE", fontSize: 18 },
  dimensionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 15 }, dimensionItem: { width: "47%", gap: 7 }, dimensionLabelRow: { flexDirection: "row", justifyContent: "space-between", gap: 4 }, dimensionLabel: { color: palette.secondaryText, fontSize: 10 }, dimensionValue: { color: palette.ink, fontSize: 10, fontWeight: "900" }, note: { color: palette.secondaryText, fontSize: 10, lineHeight: 16, marginTop: 13 },
});
