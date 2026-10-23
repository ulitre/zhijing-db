import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { Achievement } from "@zhijing/shared";
import { Card, MONO_FONT, webOnly } from "./theme-ui";
import { useTheme } from "../state/theme-context";
import { DEFAULT_ACHIEVEMENTS } from "./achievement-badges";

/** Theme-aware achievement wall used by the learner-profile tab. */
export function ThemedAchievementWall({
  unlockedBadges = [],
  onBadgePress,
}: {
  unlockedBadges?: string[];
  onBadgePress?: (badge: Achievement) => void;
}) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState<string | null>(null);
  const allBadges = DEFAULT_ACHIEVEMENTS.map((badge) => ({
    ...badge,
    unlocked: badge.unlocked || unlockedBadges.includes(badge.title) || unlockedBadges.includes(badge.id),
  }));
  const unlockedCount = allBadges.filter((badge) => badge.unlocked).length;

  return <Card>
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        <Text style={[styles.kicker, { color: theme.warning }]}>ACHIEVEMENT HONORS</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>成就激励勋章墙</Text>
      </View>
      <View style={[styles.countPill, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}>
        <Text style={[styles.countText, { color: theme.warning }]}>{unlockedCount} / {allBadges.length} 解锁</Text>
      </View>
    </View>
    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>完成 SQL 沙箱实操、触发 BKT 模型跃迁与经历多智能体质检均可点亮勋章：</Text>

    <View style={styles.badgeGrid}>
      {allBadges.map((badge) => {
        const hoveredBadge = badge.unlocked && hovered === badge.id;
        return <Pressable
          key={badge.id}
          accessibilityRole="button"
          accessibilityLabel={`${badge.title}，${badge.unlocked ? "已解锁" : "未解锁"}`}
          accessibilityState={{ disabled: !badge.unlocked }}
          onPress={() => { if (badge.unlocked) onBadgePress?.(badge); }}
          onHoverIn={() => setHovered(badge.id)}
          onHoverOut={() => setHovered((current) => current === badge.id ? null : current)}
          style={({ pressed }) => [
            styles.badgeCard,
            {
              backgroundColor: badge.unlocked ? theme.bgElevated : "transparent",
              borderColor: badge.unlocked ? `${theme.warning}44` : theme.borderDivider,
              opacity: badge.unlocked ? 1 : 0.48,
            },
            badge.unlocked && webOnly({ cursor: "pointer" }),
            hoveredBadge && { transform: [{ translateY: -2 }], borderColor: `${theme.warning}88` },
            badge.unlocked && pressed && styles.pressed,
            webOnly({ transitionProperty: "transform, border-color, background-color", transitionDuration: "200ms" }),
          ]}
        >
          <Text style={[styles.badgeIcon, !badge.unlocked && styles.iconLocked]}>{badge.icon}</Text>
          <Text style={[styles.badgeTitle, { color: badge.unlocked ? theme.textPrimary : theme.textMuted }]} numberOfLines={1}>{badge.title}</Text>
          <Text style={[styles.badgeCategory, { color: theme.textMuted }]}>{badge.category}</Text>
        </Pressable>;
      })}
    </View>
  </Card>;
}

export function ThemedBadgeCelebrationModal({
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
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={[styles.modalOverlay, { backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.72)" : "rgba(41, 37, 36, 0.3)" }]}>
      <View style={[styles.modalCard, { backgroundColor: theme.bgSurface, borderColor: `${theme.warning}66` }, webOnly({ boxShadow: "0 24px 80px -24px rgba(0, 0, 0, 0.7)" })]}>
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
  </Modal>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  headerCopy: { flexShrink: 1 },
  kicker: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2, fontFamily: MONO_FONT },
  title: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  countPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countText: { fontSize: 9.5, fontWeight: "700", fontVariant: ["tabular-nums"] },
  subtitle: { fontSize: 10.5, lineHeight: 16, marginBottom: 12, marginTop: 2 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  badgeCard: { flexBasis: "23%", flexGrow: 1, minWidth: 70, alignItems: "center", padding: 8, borderRadius: 12, borderWidth: 1 },
  badgeIcon: { fontSize: 22, marginBottom: 4 },
  iconLocked: { opacity: 0.4 },
  badgeTitle: { fontSize: 9, fontWeight: "700", textAlign: "center" },
  badgeCategory: { fontSize: 7.5, marginTop: 2 },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },

  modalOverlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 380, borderRadius: 22, padding: 24, borderWidth: 1.5, alignItems: "center" },
  celebrationKicker: { fontSize: 10, fontWeight: "700", letterSpacing: 1.4, marginBottom: 16, textAlign: "center" },
  modalIconBox: { width: 72, height: 72, borderRadius: 36, borderWidth: 2, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  modalIcon: { fontSize: 36 },
  modalTitle: { fontSize: 20, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  modalCategory: { fontSize: 11, fontWeight: "700", marginBottom: 12 },
  modalDesc: { fontSize: 12, lineHeight: 19, textAlign: "center", marginBottom: 20 },
  modalButton: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, width: "100%", alignItems: "center" },
  modalButtonText: { fontSize: 13, fontWeight: "700" },
});
