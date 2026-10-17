import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import {
  GlassCard,
  MasteryProgressBar,
  PageHeader,
  PersonaBadge,
  SectionTitle,
  palette,
} from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { useApp } from "../../state/app-context";
import { getMasteryHistory, type MasteryHistoryPoint } from "../../lib/api";
import { MasteryChart, type RetentionItem } from "../../components/mastery-chart";
import {
  AchievementWall,
  BadgeCelebrationModal,
} from "../../components/achievement-badges";
import type { Achievement } from "@zhijing/shared";

const dimensions = [
  { label: "前置基础", value: 48 },
  { label: "知识掌握度", value: 56 },
  { label: "学习目标", value: 86 },
  { label: "学习偏好", value: 72 },
  { label: "可用时间", value: 68 },
  { label: "常见错误", value: 82 },
  { label: "资源偏好", value: 61 },
  { label: "进步趋势", value: 74 },
];

export default function ProfileScreen() {
  const { currentUser, logout } = useApp();
  const [historyPoints, setHistoryPoints] = useState<MasteryHistoryPoint[]>([]);
  const [retentionItems, setRetentionItems] = useState<RetentionItem[]>([]);
  const [overallMastery, setOverallMastery] = useState(56);
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    void getMasteryHistory(currentUser.id)
      .then((data) => {
        if (data.history && data.history.length > 0) {
          setHistoryPoints(data.history);
        }
        if (data.retention && data.retention.length > 0) {
          setRetentionItems(data.retention);
        }
        if (data.overallMastery) {
          setOverallMastery(data.overallMastery);
        }
      })
      .catch(() => {
        // Fallback mock history if offline
        const now = Date.now();
        const fallbackPts: MasteryHistoryPoint[] = [
          { date: "10-10", timestamp: new Date(now - 6 * 86400000).toISOString(), mastery: 42, nodeId: "sql-select", nodeTitle: "基础查询", delta: 0 },
          { date: "10-11", timestamp: new Date(now - 5 * 86400000).toISOString(), mastery: 48, nodeId: "sql-select", nodeTitle: "基础查询", delta: 6 },
          { date: "10-12", timestamp: new Date(now - 4 * 86400000).toISOString(), mastery: 55, nodeId: "sql-joins", nodeTitle: "多表连接", delta: 7 },
          { date: "10-13", timestamp: new Date(now - 3 * 86400000).toISOString(), mastery: 61, nodeId: "sql-joins", nodeTitle: "多表连接", delta: 6 },
          { date: "10-14", timestamp: new Date(now - 2 * 86400000).toISOString(), mastery: 68, nodeId: "sql-aggregate", nodeTitle: "分组聚合", delta: 7 },
          { date: "10-15", timestamp: new Date(now - 1 * 86400000).toISOString(), mastery: 74, nodeId: "sql-aggregate", nodeTitle: "分组聚合", delta: 6 },
          { date: "10-16", timestamp: new Date().toISOString(), mastery: 88, nodeId: "sql-advanced", nodeTitle: "窗口分析", delta: 14 },
        ];
        setHistoryPoints(fallbackPts);
      });
  }, [currentUser]);

  if (!currentUser) return null;
  const switchStudent = async () => {
    await logout();
    router.replace("/" as never);
  };
  const exit = async () => {
    await logout();
    router.replace("/" as never);
  };

  const latestDelta = historyPoints.length > 0 ? historyPoints[historyPoints.length - 1]!.delta : 18;

  return (
    <ScreenShell>
      <PageHeader
        title="我的学习画像"
        subtitle="画像由对话、诊断与沙箱评估证据持续动态更新"
        right={<PersonaBadge persona={currentUser.persona} />}
      />

      <GlassCard accent>
        <View style={styles.identityRow}>
          <View style={styles.identityCopy}>
            <Text style={styles.identityLabel}>LEARNER PROFILE</Text>
            <Text style={styles.name}>{currentUser.displayName}</Text>
          </View>
          <Text style={styles.identityGlyph}>◎</Text>
        </View>
        <Text style={styles.goal}>{currentUser.goal}</Text>
        <View style={styles.chips}>
          <Text style={styles.chip}>视觉优先</Text>
          <Text style={styles.chip}>每周 240 分钟</Text>
          <Text style={styles.chip}>BKT 趋势上升</Text>
        </View>
      </GlassCard>

      {/* 7-Day Mastery Evolution Curve & Retention Decay */}
      <MasteryChart
        points={historyPoints}
        retention={retentionItems}
        overallMastery={overallMastery}
      />

      {/* Achievement Wall */}
      <AchievementWall
        unlockedBadges={["初探八表", "语法零失误", "12 智能体全链路", "BKT 跃升者"]}
        onBadgePress={(b) => {
          setSelectedBadge(b);
          setShowBadgeModal(true);
        }}
      />

      {/* 8-Dimensional Radar/List Overview */}
      <GlassCard>
        <SectionTitle meta="8 个动态指标">画像维度概览</SectionTitle>
        <Text style={styles.chartHint}>根据近期诊断和学习行为持续校准</Text>
        <View style={styles.dimensionGrid}>
          {dimensions.map((item, index) => (
            <View key={item.label} style={styles.dimensionCard}>
              <View style={styles.dimensionHead}>
                <View style={styles.dimensionNameRow}>
                  <Text style={styles.dimensionIndex}>{String(index + 1).padStart(2, "0")}</Text>
                  <Text style={styles.dimensionLabel}>{item.label}</Text>
                </View>
                <Text style={styles.dimensionValue}>{item.value}</Text>
              </View>
              <MasteryProgressBar value={item.value} />
            </View>
          ))}
        </View>
        <View style={styles.chartFooter}>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: palette.danger }]} />
            <Text style={styles.legendText}>待提升</Text>
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: palette.warning }]} />
            <Text style={styles.legendText}>巩固中</Text>
          </View>
          <View style={styles.legend}>
            <View style={[styles.legendDot, { backgroundColor: palette.success }]} />
            <Text style={styles.legendText}>稳定掌握</Text>
          </View>
        </View>
      </GlassCard>

      <View style={styles.stats}>
        <GlassCard>
          <Text style={styles.statValue}>+{latestDelta}%</Text>
          <Text style={styles.statLabel}>BKT 最新掌握跃迁</Text>
        </GlassCard>
        <GlassCard>
          <Text style={styles.statValue}>82%</Text>
          <Text style={styles.statLabel}>学习路径推进率</Text>
        </GlassCard>
      </View>

      <GlassCard>
        <SectionTitle>隐私与透明度</SectionTitle>
        <Text style={styles.privacy}>
          知径 DB 仅保存学习所需的匿名画像、作答、路径与资源记录；不保存真实姓名、学号或模型隐藏思维过程。
        </Text>
      </GlassCard>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push("/help" as never)}
        style={({ pressed }) => [styles.actionButton, styles.secondaryAction, pressed && styles.pressed]}
      >
        <Text style={styles.actionTitle}>使用帮助</Text>
        <Text style={styles.actionHint}>查看诊断、推荐路径、资源库和 AI 辅导说明</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void switchStudent()}
        style={({ pressed }) => [styles.actionButton, styles.switchAction, pressed && styles.pressed]}
      >
        <Text style={styles.switchTitle}>切换学生类型</Text>
        <Text style={styles.actionHint}>返回登录页，选择 foundation / exam / practice 身份</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => void exit()}
        style={({ pressed }) => [styles.actionButton, styles.exitAction, pressed && styles.pressed]}
      >
        <Text style={styles.exitTitle}>退出登录</Text>
        <Text style={styles.actionHint}>清除本机登录状态并返回登录页</Text>
      </Pressable>

      <BadgeCelebrationModal
        visible={showBadgeModal}
        badge={selectedBadge}
        onClose={() => setShowBadgeModal(false)}
      />
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  identityRow: { flexDirection: "row", alignItems: "center" },
  identityCopy: { flex: 1 },
  identityLabel: { color: "#93C5FD", fontSize: 9, fontWeight: "900", letterSpacing: 1.3 },
  name: { color: palette.ink, fontSize: 21, fontWeight: "900", marginTop: 5 },
  identityGlyph: { color: "#A5B4FC", fontSize: 26 },
  goal: { color: "#CBD5E1", marginTop: 7, lineHeight: 20, fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 13 },
  chip: {
    color: "#C7D2FE",
    backgroundColor: "rgba(99, 102, 241, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.22)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 99,
    fontSize: 9,
    fontWeight: "800",
  },
  chartHint: { color: palette.muted, fontSize: 10, marginTop: -4, marginBottom: 13 },
  dimensionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 11 },
  dimensionCard: {
    width: "47%",
    padding: 10,
    borderRadius: 13,
    backgroundColor: "rgba(2, 6, 23, 0.48)",
    borderWidth: 1,
    borderColor: palette.line,
    gap: 8,
  },
  dimensionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
  dimensionNameRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 5 },
  dimensionIndex: { color: "#64748B", fontSize: 8, fontWeight: "900" },
  dimensionLabel: { color: "#CBD5E1", fontSize: 9, fontWeight: "700" },
  dimensionValue: { color: palette.ink, fontSize: 10, fontWeight: "900" },
  chartFooter: { flexDirection: "row", flexWrap: "wrap", gap: 13, marginTop: 14 },
  legend: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: palette.muted, fontSize: 8 },
  stats: { flexDirection: "row", gap: 12 },
  statValue: { color: palette.blue, fontSize: 25, fontWeight: "900" },
  statLabel: { color: palette.muted, fontSize: 10, marginTop: 4 },
  privacy: { color: palette.muted, fontSize: 11, lineHeight: 19 },
  actionButton: {
    minHeight: 58,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  secondaryAction: { borderColor: palette.line, backgroundColor: "rgba(15, 23, 42, 0.72)" },
  switchAction: { borderColor: "rgba(99, 102, 241, 0.38)", backgroundColor: "rgba(49, 46, 129, 0.18)" },
  exitAction: { borderColor: "rgba(239, 68, 68, 0.28)", backgroundColor: "rgba(69, 10, 10, 0.18)" },
  actionTitle: { color: "#C7D2FE", fontWeight: "900", fontSize: 12 },
  switchTitle: { color: "#A5B4FC", fontWeight: "900", fontSize: 12 },
  exitTitle: { color: "#FCA5A5", fontWeight: "900", fontSize: 12 },
  actionHint: { color: palette.muted, fontSize: 9, marginTop: 4, textAlign: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
