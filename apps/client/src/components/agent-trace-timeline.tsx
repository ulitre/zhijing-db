import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { AgentTraceItem } from "../lib/api";
import { GlassCard, palette } from "./design-system";

export function AgentTraceTimeline({
  trace = [],
  title = "12 智能体协同执行沙盘",
  defaultExpanded = true,
}: {
  trace: AgentTraceItem[];
  title?: string;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!trace || trace.length === 0) return null;

  const hasRejection = trace.some((item) => item.status === "rejected");
  const totalElapsed = trace.reduce((sum, item) => sum + (item.elapsedMs || 0), 0);

  const agentIcons: Record<string, string> = {
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

  return (
    <GlassCard accent>
      <Pressable
        accessibilityRole="button"
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.headerRow}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.badgePulse}>● LIVE</Text>
          <Text style={styles.title}>{title}</Text>
          {hasRejection && (
            <View style={styles.rejectBadge}>
              <Text style={styles.rejectBadgeText}>触发打回重构</Text>
            </View>
          )}
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.elapsedText}>{totalElapsed}ms · {trace.length} 步</Text>
          <Text style={styles.toggleGlyph}>{expanded ? "⌃" : "⌄"}</Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.timelineContainer}>
          <Text style={styles.subtitle}>
            从前置画像诊断到内容质检打回重试，全流程确定性协同可溯：
          </Text>

          <View style={styles.stepList}>
            {trace.map((item, index) => {
              const isRejected = item.status === "rejected";
              const isApproved = item.status === "approved";
              const icon = agentIcons[item.agent] ?? "✦";

              return (
                <View key={index} style={styles.stepRow}>
                  {/* Timeline track connector */}
                  <View style={styles.trackCol}>
                    <View
                      style={[
                        styles.nodeCircle,
                        isRejected && styles.nodeCircleRejected,
                        isApproved && styles.nodeCircleApproved,
                      ]}
                    >
                      <Text style={styles.nodeIcon}>{icon}</Text>
                    </View>
                    {index < trace.length - 1 && <View style={styles.trackLine} />}
                  </View>

                  {/* Step content */}
                  <View style={styles.stepContent}>
                    <View style={styles.stepHeader}>
                      <View style={styles.agentTagRow}>
                        <Text style={styles.agentName}>{item.agent}</Text>
                        <View
                          style={[
                            styles.statusTag,
                            isRejected
                              ? styles.statusTagRejected
                              : isApproved
                              ? styles.statusTagApproved
                              : styles.statusTagDefault,
                          ]}
                        >
                          <Text
                            style={[
                              styles.statusTagText,
                              isRejected
                                ? styles.statusTextRejected
                                : isApproved
                                ? styles.statusTextApproved
                                : styles.statusTextDefault,
                            ]}
                          >
                            {isRejected ? "打回重构" : isApproved ? "审核通过" : "执行完毕"}
                          </Text>
                        </View>
                        {item.score !== undefined && (
                          <Text
                            style={[
                              styles.scoreText,
                              item.score < 75 ? styles.scoreLow : styles.scoreHigh,
                            ]}
                          >
                            {item.score}分
                          </Text>
                        )}
                      </View>
                      <Text style={styles.stepElapsed}>{item.elapsedMs}ms</Text>
                    </View>

                    <Text style={styles.actionText}>{item.action}</Text>

                    {item.feedback && (
                      <View
                        style={[
                          styles.feedbackBox,
                          isRejected ? styles.feedbackBoxRejected : styles.feedbackBoxDefault,
                        ]}
                      >
                        <Text style={styles.feedbackPrefix}>
                          {isRejected ? "⚠️ 质检整改原因：" : "💬 说明："}
                        </Text>
                        <Text style={styles.feedbackText}>{item.feedback}</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  badgePulse: {
    color: "#10B981",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  rejectBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.6)",
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 99,
  },
  rejectBadgeText: {
    color: "#FCA5A5",
    fontSize: 9,
    fontWeight: "800",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  elapsedText: {
    color: palette.muted,
    fontSize: 10,
    fontWeight: "700",
  },
  toggleGlyph: {
    color: "#A5B4FC",
    fontSize: 14,
    fontWeight: "900",
  },
  timelineContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 10,
  },
  subtitle: {
    color: palette.secondaryText,
    fontSize: 10,
    marginBottom: 12,
    lineHeight: 16,
  },
  stepList: {
    gap: 2,
  },
  stepRow: {
    flexDirection: "row",
    gap: 10,
  },
  trackCol: {
    alignItems: "center",
    width: 26,
  },
  nodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(30, 41, 59, 0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(99, 102, 241, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  nodeCircleRejected: {
    borderColor: "rgba(239, 68, 68, 0.8)",
    backgroundColor: "rgba(69, 10, 10, 0.8)",
  },
  nodeCircleApproved: {
    borderColor: "rgba(16, 185, 129, 0.8)",
    backgroundColor: "rgba(6, 78, 59, 0.8)",
  },
  nodeIcon: {
    fontSize: 11,
  },
  trackLine: {
    flex: 1,
    width: 2,
    minHeight: 28,
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    marginVertical: 2,
  },
  stepContent: {
    flex: 1,
    paddingBottom: 14,
  },
  stepHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  agentTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  agentName: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusTagDefault: {
    backgroundColor: "rgba(59, 130, 246, 0.12)",
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  statusTagRejected: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  statusTagApproved: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: "900",
  },
  statusTextDefault: { color: "#93C5FD" },
  statusTextRejected: { color: "#FCA5A5" },
  statusTextApproved: { color: "#6EE7B7" },
  scoreText: {
    fontSize: 10,
    fontWeight: "900",
  },
  scoreLow: {
    color: "#F87171",
  },
  scoreHigh: {
    color: "#34D399",
  },
  stepElapsed: {
    color: palette.muted,
    fontSize: 9,
  },
  actionText: {
    color: "#CBD5E1",
    fontSize: 11,
    marginTop: 3,
    lineHeight: 17,
  },
  feedbackBox: {
    marginTop: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  feedbackBoxDefault: {
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderColor: palette.line,
  },
  feedbackBoxRejected: {
    backgroundColor: "rgba(69, 10, 10, 0.35)",
    borderColor: "rgba(239, 68, 68, 0.35)",
  },
  feedbackPrefix: {
    color: "#FCA5A5",
    fontSize: 9,
    fontWeight: "800",
    marginBottom: 2,
  },
  feedbackText: {
    color: "#E2E8F0",
    fontSize: 10,
    lineHeight: 16,
  },
});
