import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { MasteryHistoryPoint } from "../lib/api";
import { Card, EmptyPanel, LoadingPanel, MONO_FONT, webOnly } from "./theme-ui";
import { useTheme } from "../state/theme-context";

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
  loading = false,
}: {
  points: MasteryHistoryPoint[];
  retention?: RetentionItem[];
  overallMastery?: number;
  loading?: boolean;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const compact = width < 720;
  const retentionBasis = width < 560 ? "100%" : width < 900 ? "47%" : "22%";

  if (loading) {
    return <LoadingPanel title="正在加载掌握度趋势…" detail="正在计算 BKT 掌握度与记忆留存曲线。" />;
  }
  if (points.length === 0) {
    return <EmptyPanel
      glyph="📈"
      title="暂无历史掌握度数据"
      detail="完成一次 SQL 沙箱实践即可开启 BKT 演进与遗忘曲线记录。"
    />;
  }

  const recentPoints = points.slice(-7);

  return <Card accent style={styles.card}>
    <View style={[styles.chartHeader, compact && styles.chartHeaderCompact]}>
      <View style={styles.chartHeadCopy}>
        <Text style={[styles.kicker, { color: theme.accentPrimary }]}>BKT ADAPTIVE MASTERY · 7-DAY EVOLUTION</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>掌握度演进趋势</Text>
      </View>
      <View style={[styles.masteryPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
        <Text style={[styles.masteryPillLabel, { color: theme.accentPrimary }]}>当前综合</Text>
        <Text style={[styles.masteryPillValue, { color: theme.accentPrimary }]}>{overallMastery}%</Text>
      </View>
    </View>

    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
      基于 Bayesian Knowledge Tracing 实时更新，准确反映知识概念迁移与固化轨迹：
    </Text>

    <View style={styles.chartArea}>
      <View style={styles.gridLines}>
        {["100%", "75%", "50%", "25%"].map((label) => <View key={label} style={[styles.gridLine, { borderBottomColor: theme.borderDivider }]}>
          <Text style={[styles.gridLabel, { color: theme.textMuted }]}>{label}</Text>
        </View>)}
      </View>

      <View style={styles.barsContainer}>
        {recentPoints.map((item, index) => {
          const heightPercent = Math.max(10, Math.min(100, item.mastery));
          const isLatest = index === recentPoints.length - 1;
          return <View
            key={`${item.date}-${index}`}
            accessible
            accessibilityLabel={`${item.date} 掌握度 ${item.mastery}%，变化 ${item.delta >= 0 ? `+${item.delta}` : item.delta} 个百分点`}
            style={styles.barCol}
          >
            {item.delta > 0 ? <Text style={[styles.deltaText, { color: isLatest ? theme.accentPrimary : theme.success }]}>+{item.delta}</Text> : <Text style={styles.deltaSpacer} />}
            <View style={[styles.barTrack, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
              <View style={[
                styles.barFill,
                { height: `${heightPercent}%` as `${number}%`, backgroundColor: theme.accentPrimary },
                webOnly({ backgroundImage: `linear-gradient(180deg, ${theme.accentPrimary} 0%, ${theme.accentGradientFrom} 100%)` }),
                isLatest && { borderWidth: 1, borderColor: theme.accentHover },
              ]}>
                <View style={[styles.barDot, { backgroundColor: theme.onAccent }]} />
              </View>
            </View>
            <Text style={[styles.valLabel, { color: isLatest ? theme.accentPrimary : theme.textSecondary }]}>{item.mastery}%</Text>
            <Text style={[styles.dateLabel, { color: theme.textMuted }]}>{item.date}</Text>
          </View>;
        })}
      </View>
    </View>

    {retention.length > 0 ? <View style={[styles.retentionSection, { borderTopColor: theme.borderDivider }]}>
      <View style={styles.retentionHead}>
        <Text style={[styles.retentionTitle, { color: theme.textPrimary }]}>🧠 艾宾浩斯记忆遗忘曲线预警</Text>
        <Text style={[styles.retentionHint, { color: theme.textSecondary }]}>结合上次练习时间差 Δt 计算留存率</Text>
      </View>
      <View style={styles.retentionGrid}>
        {retention.slice(0, 4).map((item) => <View
          key={item.nodeId}
          style={[
            styles.retentionCard,
            {
              backgroundColor: item.needsReview ? theme.warningSoft : theme.bgElevated,
              borderColor: item.needsReview ? `${theme.warning}55` : theme.borderSubtle,
              flexBasis: retentionBasis,
            },
            item.needsReview && { borderLeftWidth: 3, borderLeftColor: theme.warning },
          ]}
        >
          <View style={styles.retentionCardTop}>
            <Text style={[styles.retentionNodeTitle, { color: theme.textPrimary }]} numberOfLines={1}>{item.nodeTitle}</Text>
            {item.needsReview ? <View style={[styles.needsReviewPill, { backgroundColor: theme.bgSurface, borderColor: `${theme.warning}44` }]}>
              <Text style={[styles.needsReviewText, { color: theme.warning }]}>今日需复习</Text>
            </View> : null}
          </View>
          <View style={styles.retentionStats}>
            <Text style={[styles.retentionStat, { color: theme.textMuted }]}>掌握: <Text style={[styles.statBold, { color: theme.textPrimary }]}>{item.currentMastery}%</Text></Text>
            <Text style={[styles.retentionStat, { color: theme.textMuted }]}>留存预估: <Text style={[styles.statBold, { color: item.needsReview ? theme.warning : theme.success }]}>{item.retentionScore}%</Text></Text>
          </View>
        </View>)}
      </View>
    </View> : null}
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: 20 },
  chartHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6 },
  chartHeaderCompact: { alignItems: "flex-start" },
  chartHeadCopy: { flexShrink: 1, minWidth: 0 },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.1 },
  title: { fontSize: 16, fontWeight: "700", marginTop: 3 },
  masteryPill: { alignItems: "flex-end", borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
  masteryPillLabel: { fontSize: 8, fontWeight: "600" },
  masteryPillValue: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] },
  subtitle: { fontSize: 11, lineHeight: 17, marginBottom: 16 },

  chartArea: { height: 180, position: "relative", justifyContent: "flex-end", marginBottom: 14 },
  gridLines: { position: "absolute", top: 0, left: 0, right: 0, bottom: 30, justifyContent: "space-between" },
  gridLine: { borderBottomWidth: 1, flexDirection: "row", alignItems: "center" },
  gridLabel: { fontSize: 8, width: 28, fontVariant: ["tabular-nums"] },
  barsContainer: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingLeft: 24, height: 170 },
  barCol: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 4, minWidth: 0 },
  deltaText: { fontSize: 9, fontWeight: "700", fontVariant: ["tabular-nums"] },
  deltaSpacer: { height: 11 },
  barTrack: { width: 15, height: 110, borderRadius: 7, justifyContent: "flex-end", overflow: "hidden", borderWidth: 1 },
  barFill: { width: "100%", borderRadius: 7, position: "relative" },
  barDot: { width: 6, height: 6, borderRadius: 3, alignSelf: "center", marginTop: 3, opacity: 0.85 },
  valLabel: { fontSize: 9, fontWeight: "700", fontVariant: ["tabular-nums"] },
  dateLabel: { fontSize: 9, fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },

  retentionSection: { borderTopWidth: 1, paddingTop: 12, marginTop: 6 },
  retentionHead: { marginBottom: 9 },
  retentionTitle: { fontSize: 12.5, fontWeight: "700" },
  retentionHint: { fontSize: 9.5, marginTop: 2 },
  retentionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  retentionCard: { flexGrow: 1, minWidth: 0, borderRadius: 10, padding: 9, borderWidth: 1 },
  retentionCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 5, marginBottom: 5 },
  retentionNodeTitle: { flex: 1, fontSize: 10, fontWeight: "700" },
  needsReviewPill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 6, borderWidth: 1, flexShrink: 0 },
  needsReviewText: { fontSize: 8, fontWeight: "700" },
  retentionStats: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
  retentionStat: { fontSize: 9, fontVariant: ["tabular-nums"] },
  statBold: { fontWeight: "700" },
});
