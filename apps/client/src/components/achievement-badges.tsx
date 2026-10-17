import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Achievement } from "@zhijing/shared";
import { GlassCard, palette } from "./design-system";

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
  const allBadges = DEFAULT_ACHIEVEMENTS.map((b) => ({
    ...b,
    unlocked: b.unlocked || unlockedBadges.includes(b.title) || unlockedBadges.includes(b.id),
  }));

  const unlockedCount = allBadges.filter((b) => b.unlocked).length;

  return (
    <GlassCard>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>ACHIEVEMENT HONORS</Text>
          <Text style={styles.title}>成就激励勋章墙</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>
            {unlockedCount} / {allBadges.length} 解锁
          </Text>
        </View>
      </View>
      <Text style={styles.subtitle}>
        完成 SQL 沙箱实操、触发 BKT 模型跃迁与经历多智能体质检均可点亮勋章：
      </Text>

      <View style={styles.badgeGrid}>
        {allBadges.map((badge) => {
          return (
            <Pressable
              key={badge.id}
              accessibilityRole="button"
              onPress={() => onBadgePress?.(badge)}
              style={({ pressed }) => [
                styles.badgeCard,
                badge.unlocked ? styles.badgeUnlocked : styles.badgeLocked,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.badgeIcon, !badge.unlocked && styles.iconLocked]}>
                {badge.icon}
              </Text>
              <Text
                style={[styles.badgeTitle, !badge.unlocked && styles.titleLocked]}
                numberOfLines={1}
              >
                {badge.title}
              </Text>
              <Text style={styles.badgeCategory}>{badge.category}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
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
  if (!badge) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.celebrationKicker}>🎉 NEW ACHIEVEMENT UNLOCKED</Text>
          <View style={styles.modalIconBox}>
            <Text style={styles.modalIcon}>{badge.icon}</Text>
          </View>
          <Text style={styles.modalTitle}>{badge.title}</Text>
          <Text style={styles.modalCategory}>{badge.category} · 荣誉成就</Text>
          <Text style={styles.modalDesc}>{badge.description}</Text>

          <Pressable onPress={onClose} style={styles.modalButton}>
            <Text style={styles.modalButtonText}>收下徽章，继续学习</Text>
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
    color: "#FBBF24",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: palette.ink,
    fontSize: 15,
    fontWeight: "900",
    marginTop: 2,
  },
  countPill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "rgba(245, 158, 11, 0.4)",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countText: {
    color: "#FCD34D",
    fontSize: 9,
    fontWeight: "900",
  },
  subtitle: {
    color: palette.secondaryText,
    fontSize: 10,
    lineHeight: 16,
    marginBottom: 12,
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
  badgeUnlocked: {
    backgroundColor: "rgba(30, 41, 59, 0.7)",
    borderColor: "rgba(245, 158, 11, 0.4)",
  },
  badgeLocked: {
    backgroundColor: "rgba(15, 23, 42, 0.3)",
    borderColor: "rgba(255, 255, 255, 0.05)",
    opacity: 0.5,
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
    color: palette.ink,
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
  },
  titleLocked: {
    color: palette.muted,
  },
  badgeCategory: {
    color: palette.muted,
    fontSize: 7,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#0F172A",
    borderRadius: 24,
    padding: 24,
    borderWidth: 1.5,
    borderColor: "rgba(245, 158, 11, 0.6)",
    alignItems: "center",
  },
  celebrationKicker: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 16,
  },
  modalIconBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(245, 158, 11, 0.18)",
    borderWidth: 2,
    borderColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  modalIcon: {
    fontSize: 36,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 4,
  },
  modalCategory: {
    color: "#FCD34D",
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 12,
  },
  modalDesc: {
    color: "#CBD5E1",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: "100%",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
});
