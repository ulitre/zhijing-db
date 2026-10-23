import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Achievement } from "@zhijing/shared";
import { Card, MONO_FONT } from "./theme-ui";
import { useTheme } from "../state/theme-context";

export const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  {
    id: "badge-eight-tables",
    title: "初探八表",
    icon: "🏛️",
    description: "首次在 8 表教务与校园电商混合沙箱中执行查询",
    category: "沙箱探索",
    unlocked: true,
    unlockedAt: "刚刚",
  },
  {
    id: "badge-zero-error",
    title: "语法零失误",
    icon: "⚡",
    description: "编写合规单条只读 SQL 并由 Worker 沙箱在 100ms 内成功执行",
    category: "查询执行",
    unlocked: true,
    unlockedAt: "今天",
  },
  {
    id: "badge-multi-join",
    title: "多表联结专家",
    icon: "🌐",
    description: "成功完成 3 表以上复杂 JOIN 查询，准确映射外键联系",
    category: "进阶语法",
    unlocked: false,
  },
  {
    id: "badge-subquery",
    title: "征服子查询",
    icon: "🔍",
    description: "完成嵌套标量或关联子查询练习，理清内外层执行时序",
    category: "进阶语法",
    unlocked: false,
  },
  {
    id: "badge-window-func",
    title: "窗口函数探秘者",
    icon: "🪟",
    description: "运用 OVER (PARTITION BY ... ORDER BY ...) 解决组内排名与累计问题",
    category: "高级分析",
    unlocked: false,
  },
  {
    id: "badge-bkt-leap",
    title: "BKT 跃升者",
    icon: "📈",
    description: "单次练习作答由 EvaluationAgent 评估产生掌握度跳跃 (+20% 以上)",
    category: "认知成长",
    unlocked: false,
  },
  {
    id: "badge-normal-form",
    title: "规范化卫士",
    icon: "🛡️",
    description: "通过函数依赖与属性闭包诊断，精准识别 3NF 与 BCNF",
    category: "理论推导",
    unlocked: false,
  },
  {
    id: "badge-twelve-agents",
    title: "12 智能体全链路",
    icon: "🏆",
    description: "完整体验 Orchestrator 到 ReviewAgent 条件边打回重试与终审放行",
    category: "协同通关",
    unlocked: true,
    unlockedAt: "已点亮",
  },
];

export function AchievementWall({
  unlockedBadges = [],
  onBadgePress,
}: {
  unlockedBadges?: string[];
  onBadgePress?: (badge: Achievement) => void;
}) {
  const { theme } = useTheme();
  const allBadges = DEFAULT_ACHIEVEMENTS.map((b) => ({
    ...b,
    unlocked: b.unlocked || unlockedBadges.includes(b.title) || unlockedBadges.includes(b.id),
  }));

  const unlockedCount = allBadges.filter((b) => b.unlocked).length;

  return (
    <Card>
      <View style={styles.header}>
        <View>
          <Text style={[styles.kicker, { color: theme.warning }]}>ACHIEVEMENT HONORS</Text>
          <Text style={[styles.title, { color: theme.textPrimary }]}>成就激励勋章墙</Text>
        </View>
        <View style={[styles.countPill, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}>
          <Text style={[styles.countText, { color: theme.warning }]}>
            {unlockedCount} / {allBadges.length} 解锁
          </Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        完成 SQL 沙箱实操、触发 BKT 模型跃迁与经历多智能体质检均可点亮勋章：
      </Text>

      <View style={styles.badgeGrid}>
        {allBadges.map((badge) => {
          return (
            <Pressable
              key={badge.id}
              accessibilityRole="button"
              accessibilityLabel={`${badge.title}，${badge.unlocked ? "已解锁" : "未解锁"}`}
              accessibilityState={{ disabled: !badge.unlocked }}
              onPress={() => { if (badge.unlocked) onBadgePress?.(badge); }}
              style={({ pressed }) => [
                styles.badgeCard,
                {
                  backgroundColor: badge.unlocked ? theme.bgElevated : "transparent",
                  borderColor: badge.unlocked ? `${theme.warning}44` : theme.borderDivider,
                  opacity: badge.unlocked ? 1 : 0.5,
                },
                badge.unlocked && pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.badgeIcon, !badge.unlocked && styles.iconLocked]}>
                {badge.icon}
              </Text>
              <Text
                style={[styles.badgeTitle, { color: badge.unlocked ? theme.textPrimary : theme.textMuted }]}
                numberOfLines={1}
              >
                {badge.title}
              </Text>
              <Text style={[styles.badgeCategory, { color: theme.textMuted }]}>{badge.category}</Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

export function BadgeCelebrationModal({
  badge,
  visible,
  onClose,
}: {
  badge: Achievement | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  if (!badge || !badge.unlocked) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(41, 37, 36, 0.3)" }]}>
        <View style={[styles.modalCard, { backgroundColor: theme.bgSurface, borderColor: `${theme.warning}66` }]}>
          <Text style={[styles.celebrationKicker, { color: theme.warning }]}>🎉 NEW ACHIEVEMENT UNLOCKED</Text>
          <View style={[styles.modalIconBox, { backgroundColor: theme.warningSoft, borderColor: theme.warning }]}>
            <Text style={styles.modalIcon}>{badge.icon}</Text>
          </View>
          <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>{badge.title}</Text>
          <Text style={[styles.modalCategory, { color: theme.warning }]}>{badge.category} · 荣誉成就</Text>
          <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>{badge.description}</Text>

          <Pressable accessibilityRole="button" accessibilityLabel="收下徽章，继续学习" onPress={onClose} style={({ pressed }) => [styles.modalButton, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed]}>
            <Text style={[styles.modalButtonText, { color: theme.onAccent }]}>收下徽章，继续学习</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  kicker: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    fontFamily: MONO_FONT,
  },
  title: {
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  countPill: {
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    fontSize: 9,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  subtitle: {
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 12,
    marginTop: 4,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  badgeCard: {
    width: "23%",
    minWidth: 70,
    alignItems: "center",
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  badgeIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  iconLocked: {
    opacity: 0.4,
  },
  badgeTitle: {
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  badgeCategory: {
    fontSize: 7,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    alignItems: "center",
  },
  celebrationKicker: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  modalCategory: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalDesc: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "900",
  },
});
