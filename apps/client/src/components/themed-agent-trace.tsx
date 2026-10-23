import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AgentTraceItem } from "../lib/api";
import { Card, MONO_FONT, PulseDot } from "./theme-ui";
import { useTheme } from "../state/theme-context";

const AGENT_ICONS: Record<string, string> = {
  Orchestrator: "⚡",
  ProfileAgent: "👤",
  DiagnosisAgent: "🩺",
  PathAgent: "🗺️",
  DocumentAgent: "📄",
  DiagramAgent: "📊",
  QuizAgent: "📝",
  SQLLabAgent: "💻",
  ReadingAgent: "📖",
  ReviewAgent: "🛡️",
  TutorAgent: "🤖",
  EvaluationAgent: "📈",
};

/** Theme-aware version of the agent trace, used by the in-scope resources tab. */
export function ThemedAgentTraceTimeline({
  trace = [],
  title = "12 智能体协同执行沙盘",
  defaultExpanded = true,
}: {
  trace: AgentTraceItem[];
  title?: string;
  defaultExpanded?: boolean;
}) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!trace || trace.length === 0) return null;

  const hasRejection = trace.some((item) => item.status === "rejected");
  const totalElapsed = trace.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);

  return <Card style={styles.card}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}，共 ${trace.length} 步`}
      accessibilityHint={expanded ? "收起执行轨迹" : "展开执行轨迹"}
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((prev) => !prev)}
      style={styles.headerRow}
    >
      <View style={styles.headerLeft}>
        <View style={[styles.livePill, { backgroundColor: theme.successSoft, borderColor: `${theme.success}44` }]}>
          <PulseDot color={theme.success} size={6} />
          <Text style={[styles.liveText, { color: theme.success }]}>LIVE</Text>
        </View>
        <Text style={[styles.title, { color: theme.textPrimary }]}>{title}</Text>
        {hasRejection ? <View style={[styles.rejectBadge, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}>
          <Text style={[styles.rejectBadgeText, { color: theme.warning }]}>触发打回重构</Text>
        </View> : null}
      </View>
      <View style={styles.headerRight}>
        <Text style={[styles.elapsedText, { color: theme.textMuted }]}>{totalElapsed}ms · {trace.length} 步</Text>
        <Text style={[styles.toggleGlyph, { color: theme.accentPrimary }]}>{expanded ? "⌃" : "⌄"}</Text>
      </View>
    </Pressable>

    {expanded ? <View style={[styles.timelineContainer, { borderTopColor: theme.borderDivider }]}>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>从前置画像诊断到内容质检打回重试，全流程确定性协同可溯：</Text>
      <View style={styles.stepList}>
        {trace.map((item, index) => {
          const isRejected = item.status === "rejected";
          const isApproved = item.status === "approved";
          const icon = AGENT_ICONS[item.agent] ?? "✦";
          const nodeColor = isRejected ? theme.warning : isApproved ? theme.success : theme.accentPrimary;
          const nodeBg = isRejected ? theme.warningSoft : isApproved ? theme.successSoft : theme.accentSoft;
          return <View key={index} style={styles.stepRow}>
            <View style={styles.trackCol}>
              <View style={[styles.nodeCircle, { backgroundColor: nodeBg, borderColor: `${nodeColor}88` }]}>
                <Text style={styles.nodeIcon}>{icon}</Text>
              </View>
              {index < trace.length - 1 ? <View style={[styles.trackLine, { backgroundColor: theme.borderDivider }]} /> : null}
            </View>
            <View style={styles.stepContent}>
              <View style={styles.stepHeader}>
                <View style={styles.agentTagRow}>
                  <Text style={[styles.agentName, { color: theme.textPrimary }]}>{item.agent}</Text>
                  <View style={[styles.statusTag, {
                    backgroundColor: isRejected ? theme.warningSoft : isApproved ? theme.successSoft : theme.accentSoft,
                    borderColor: `${nodeColor}44`,
                  }]}>
                    <Text style={[styles.statusTagText, { color: nodeColor }]}>
                      {isRejected ? "打回重构" : isApproved ? "审核通过" : "执行完毕"}
                    </Text>
                  </View>
                  {item.score !== undefined ? <Text style={[styles.scoreText, { color: item.score < 75 ? theme.warning : theme.success }]}>{item.score}分</Text> : null}
                </View>
                <Text style={[styles.stepElapsed, { color: theme.textMuted }]}>{item.elapsedMs}ms</Text>
              </View>
              <Text style={[styles.actionText, { color: theme.textSecondary }]}>{item.action}</Text>
              {item.feedback ? <View style={[styles.feedbackBox, {
                backgroundColor: isRejected ? theme.warningSoft : theme.bgElevated,
                borderColor: isRejected ? `${theme.warning}44` : theme.borderDivider,
              }]}>
                <Text style={[styles.feedbackPrefix, { color: isRejected ? theme.warning : theme.textMuted }]}>{isRejected ? "⚠️ 质检整改原因：" : "💬 说明："}</Text>
                <Text style={[styles.feedbackText, { color: theme.textSecondary }]}>{item.feedback}</Text>
              </View> : null}
            </View>
          </View>;
        })}
      </View>
    </View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: 18 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", flex: 1 },
  livePill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  liveText: { fontSize: 8.5, fontWeight: "700", letterSpacing: 0.8, fontFamily: MONO_FONT },
  title: { fontSize: 14, fontWeight: "700" },
  rejectBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  rejectBadgeText: { fontSize: 9, fontWeight: "700" },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  elapsedText: { fontSize: 9.5, fontWeight: "600", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
  toggleGlyph: { fontSize: 14, fontWeight: "700" },
  timelineContainer: { marginTop: 12, borderTopWidth: 1, paddingTop: 11 },
  subtitle: { fontSize: 10.5, lineHeight: 16, marginBottom: 12 },
  stepList: { gap: 2 },
  stepRow: { flexDirection: "row", gap: 10 },
  trackCol: { alignItems: "center", width: 26 },
  nodeCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5, alignItems: "center", justifyContent: "center", zIndex: 2 },
  nodeIcon: { fontSize: 11 },
  trackLine: { flex: 1, width: 2, minHeight: 28, marginVertical: 2, borderRadius: 1 },
  stepContent: { flex: 1, paddingBottom: 14 },
  stepHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  agentTagRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 },
  agentName: { fontSize: 12, fontWeight: "700" },
  statusTag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, borderWidth: 1 },
  statusTagText: { fontSize: 8, fontWeight: "700" },
  scoreText: { fontSize: 10, fontWeight: "700", fontVariant: ["tabular-nums"] },
  stepElapsed: { fontSize: 9, fontVariant: ["tabular-nums"] },
  actionText: { fontSize: 11, marginTop: 3, lineHeight: 17 },
  feedbackBox: { marginTop: 6, padding: 8, borderRadius: 8, borderWidth: 1 },
  feedbackPrefix: { fontSize: 9, fontWeight: "700", marginBottom: 2 },
  feedbackText: { fontSize: 10, lineHeight: 16 },
});
