import { StyleSheet, Text, View } from "react-native";
import type { MasteryHistoryPoint } from "../lib/api";
import { GlassCard, palette } from "./design-system";

export type RetentionItem = {
  nodeId: string;
  nodeTitle: string;
  currentMastery: number;
  retentionScore: number;
  daysSinceLastPractice: number;
  needsReview: boolean;
};

export function MasteryChart({
  points = [],
  retention = [],
  overallMastery = 72,
}: {
  points: MasteryHistoryPoint[];
  retention?: RetentionItem[];
  overallMastery?: number;
}) {
  if (points.length === 0) {
    return (
      <GlassCard>
        <Text style={styles.emptyText}>暂无历史掌握度数据，完成一次 SQL 沙箱实践即可开启评估记录。</Text>
      </GlassCard>
    );
  }

  const recentPoints = points.slice(-7);

  return (
    <GlassCard accent>
      <View style={styles.chartHeader}>
        <View>
          <Text style={styles.kicker}>BKT ADAPTIVE MASTERY · 7-DAY EVOLUTION</Text>
          <Text style={styles.title}>掌握度演进折线图</Text>
        </View>
        <View style={styles.masteryPill}>
          <Text style={styles.masteryPillLabel}>当前综合</Text>
          <Text style={styles.masteryPillValue}>{overallMastery}%</Text>
        </View>
      </View>

      <Text style={styles.subtitle}>
        基于 Bayesian Knowledge Tracing 实时更新，准确反映知识概念迁移与固化轨迹：
      </Text>

      {/* Visual Chart Bars & Trend Points */}
      <View style={styles.chartArea}>
        <View style={styles.gridLines}>
          <View style={styles.gridLine}><Text style={styles.gridLabel}>100%</Text></View>
          <View style={styles.gridLine}><Text style={styles.gridLabel}>75%</Text></View>
          <View style={styles.gridLine}><Text style={styles.gridLabel}>50%</Text></View>
          <View style={styles.gridLine}><Text style={styles.gridLabel}>25%</Text></View>
        </View>

        <View style={styles.barsContainer}>
          {recentPoints.map((item, index) => {
            const heightPercent = Math.max(10, Math.min(100, item.mastery));
            const isLatest = index === recentPoints.length - 1;

            return (
              <View key={index} style={styles.barCol}>
                {item.delta > 0 && (
                  <Text style={[styles.deltaText, isLatest && styles.deltaTextLatest]}>
                    +{item.delta}
                  </Text>
                )}
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${heightPercent}%` },
                      isLatest && styles.barFillLatest,
                    ]}
                  >
                    <View style={styles.barDot} />
                  </View>
                </View>
                <Text style={[styles.valLabel, isLatest && styles.valLabelLatest]}>
                  {item.mastery}%
                </Text>
                <Text style={styles.dateLabel}>{item.date}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Ebbinghaus Retention Warning List */}
      {retention.length > 0 && (
        <View style={styles.retentionSection}>
          <View style={styles.retentionHead}>
            <Text style={styles.retentionTitle}>🧠 艾宾浩斯记忆遗忘曲线预警</Text>
            <Text style={styles.retentionHint}>结合上次练习时间差 Δt 计算留存率</Text>
          </View>
          <View style={styles.retentionGrid}>
            {retention.slice(0, 4).map((item) => (
              <View
                key={item.nodeId}
                style={[
                  styles.retentionCard,
                  item.needsReview && styles.retentionCardWarning,
                ]}
              >
                <View style={styles.retentionCardTop}>
                  <Text style={styles.retentionNodeTitle} numberOfLines={1}>
                    {item.nodeTitle}
                  </Text>
                  {item.needsReview && (
                    <View style={styles.needsReviewPill}>
                      <Text style={styles.needsReviewText}>今日需复习</Text>
                    </View>
                  )}
                </View>
                <View style={styles.retentionStats}>
                  <Text style={styles.retentionStat}>
                    掌握: <Text style={styles.statBold}>{item.currentMastery}%</Text>
                  </Text>
                  <Text style={styles.retentionStat}>
                    留存预估:{" "}
                    <Text
                      style={[
                        styles.statBold,
                        item.needsReview ? styles.retentionLow : styles.retentionGood,
                      ]}
                    >
                      {item.retentionScore}%
                    </Text>
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  chartHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  kicker: {
    color: "#93C5FD",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: palette.ink,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 2,
  },
  masteryPill: {
    alignItems: "flex-end",
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  masteryPillLabel: {
    color: "#93C5FD",
    fontSize: 8,
    fontWeight: "700",
  },
  masteryPillValue: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  subtitle: {
    color: palette.secondaryText,
    fontSize: 11,
    lineHeight: 17,
    marginBottom: 16,
  },
  chartArea: {
    height: 180,
    position: "relative",
    justifyContent: "flex-end",
    marginBottom: 14,
  },
  gridLines: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 30,
    justifyContent: "space-between",
  },
  gridLine: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
    flexDirection: "row",
    alignItems: "center",
  },
  gridLabel: {
    color: "rgba(148, 163, 184, 0.4)",
    fontSize: 8,
    width: 28,
  },
  barsContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingLeft: 24,
    height: 170,
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    height: "100%",
    justifyContent: "flex-end",
    gap: 4,
  },
  deltaText: {
    color: "#34D399",
    fontSize: 9,
    fontWeight: "900",
  },
  deltaTextLatest: {
    color: "#10B981",
    fontSize: 10,
  },
  barTrack: {
    width: 14,
    height: 110,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderRadius: 7,
    justifyContent: "flex-end",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  barFill: {
    width: "100%",
    backgroundColor: "rgba(99, 102, 241, 0.75)",
    borderRadius: 7,
    position: "relative",
  },
  barFillLatest: {
    backgroundColor: "#2563EB",
    borderWidth: 1,
    borderColor: "#60A5FA",
  },
  barDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
    alignSelf: "center",
    marginTop: 3,
  },
  valLabel: {
    color: "#CBD5E1",
    fontSize: 9,
    fontWeight: "800",
  },
  valLabelLatest: {
    color: "#93C5FD",
    fontWeight: "900",
  },
  dateLabel: {
    color: palette.muted,
    fontSize: 9,
  },
  retentionSection: {
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: 12,
    marginTop: 6,
  },
  retentionHead: {
    marginBottom: 8,
  },
  retentionTitle: {
    color: palette.ink,
    fontSize: 12,
    fontWeight: "900",
  },
  retentionHint: {
    color: palette.secondaryText,
    fontSize: 9,
    marginTop: 2,
  },
  retentionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  retentionCard: {
    width: "48%",
    backgroundColor: "rgba(15, 23, 42, 0.5)",
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: palette.line,
  },
  retentionCardWarning: {
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(120, 53, 15, 0.15)",
  },
  retentionCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  retentionNodeTitle: {
    color: palette.ink,
    fontSize: 10,
    fontWeight: "800",
    flex: 1,
  },
  needsReviewPill: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  needsReviewText: {
    color: "#FCD34D",
    fontSize: 8,
    fontWeight: "800",
  },
  retentionStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  retentionStat: {
    color: palette.muted,
    fontSize: 9,
  },
  statBold: {
    fontWeight: "900",
    color: palette.ink,
  },
  retentionLow: {
    color: "#FBBF24",
  },
  retentionGood: {
    color: "#34D399",
  },
  emptyText: {
    color: palette.muted,
    fontSize: 12,
    textAlign: "center",
    padding: 16,
  },
});
