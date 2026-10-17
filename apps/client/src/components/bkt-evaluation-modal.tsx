import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { EvaluationResult } from "../lib/api";
import { palette } from "./design-system";

export function BktEvaluationModal({
  result,
  visible,
  onClose,
}: {
  result: EvaluationResult | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!result) return null;

  const isPositive = result.delta >= 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.agentTag}>
              <Text style={styles.agentTagText}>EVALUATION AGENT · BKT CALCULATION</Text>
            </View>
            <Text style={styles.title}>{result.conceptTitle}</Text>
          </View>

          {/* Mastery Leap Visual */}
          <View style={styles.leapBox}>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>练习前掌握度</Text>
              <Text style={styles.scorePrev}>{result.prevMastery}%</Text>
            </View>
            <View style={styles.arrowCol}>
              <Text style={styles.arrowGlyph}>➔</Text>
              <View
                style={[
                  styles.deltaPill,
                  isPositive ? styles.deltaPillPositive : styles.deltaPillNegative,
                ]}
              >
                <Text
                  style={[
                    styles.deltaText,
                    isPositive ? styles.deltaTextPositive : styles.deltaTextNegative,
                  ]}
                >
                  {isPositive ? `+${result.delta}%` : `${result.delta}%`}
                </Text>
              </View>
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.scoreLabel}>BKT 计算后掌握度</Text>
              <Text style={styles.scoreNew}>{result.newMastery}%</Text>
            </View>
          </View>

          {/* BKT Math Breakdown */}
          {result.bkt && (
            <View style={styles.bktMathBox}>
              <Text style={styles.mathTitle}>贝叶斯知识追踪 (BKT) 公式推导：</Text>
              <Text style={styles.formulaText}>
                P(L_t) = P(L_{"{t-1}"}|obs) + (1 - P(L_{"{t-1}"}|obs)) · P(T)
              </Text>
              <View style={styles.paramRow}>
                <View style={styles.paramItem}>
                  <Text style={styles.paramName}>先验 P(L_{"{t-1}"})</Text>
                  <Text style={styles.paramVal}>{result.bkt.prior}%</Text>
                </View>
                <View style={styles.paramItem}>
                  <Text style={styles.paramName}>观测后验 P(L|obs)</Text>
                  <Text style={styles.paramVal}>{result.bkt.posterior}%</Text>
                </View>
                <View style={styles.paramItem}>
                  <Text style={styles.paramName}>知识转移率 P(T)</Text>
                  <Text style={styles.paramVal}>{result.bkt.transit}%</Text>
                </View>
              </View>
            </View>
          )}

          {/* Feedback message */}
          <Text style={styles.feedback}>{result.feedback}</Text>

          {/* Unlocked badges pill */}
          {result.unlockedBadges && result.unlockedBadges.length > 0 && (
            <View style={styles.badgesRewardRow}>
              <Text style={styles.badgeRewardLabel}>🏅 点亮成就：</Text>
              {result.unlockedBadges.map((badgeName: string) => (
                <View key={badgeName} style={styles.unlockedBadgePill}>
                  <Text style={styles.unlockedBadgeText}>{badgeName}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Action button */}
          <Pressable onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>确定并返回练习</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.88)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0B1329",
    borderRadius: 22,
    padding: 22,
    borderWidth: 1.5,
    borderColor: "rgba(59, 130, 246, 0.5)",
    boxShadow: "0px 0px 24px rgba(59, 130, 246, 0.25)",
  },
  header: {
    alignItems: "center",
    marginBottom: 16,
  },
  agentTag: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderColor: "rgba(59, 130, 246, 0.4)",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 10,
    paddingVertical: 3,
    marginBottom: 6,
  },
  agentTagText: {
    color: "#93C5FD",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  leapBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 14,
  },
  scoreCol: {
    alignItems: "center",
  },
  scoreLabel: {
    color: palette.muted,
    fontSize: 9,
    marginBottom: 4,
  },
  scorePrev: {
    color: "#94A3B8",
    fontSize: 22,
    fontWeight: "900",
  },
  arrowCol: {
    alignItems: "center",
    gap: 4,
  },
  arrowGlyph: {
    color: "#60A5FA",
    fontSize: 16,
    fontWeight: "900",
  },
  deltaPill: {
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
  },
  deltaPillPositive: {
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderColor: "rgba(16, 185, 129, 0.5)",
  },
  deltaPillNegative: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  deltaText: {
    fontSize: 11,
    fontWeight: "900",
  },
  deltaTextPositive: { color: "#34D399" },
  deltaTextNegative: { color: "#F87171" },
  scoreNew: {
    color: "#60A5FA",
    fontSize: 26,
    fontWeight: "900",
  },
  bktMathBox: {
    backgroundColor: "rgba(2, 6, 23, 0.6)",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: palette.line,
    marginBottom: 12,
  },
  mathTitle: {
    color: "#CBD5E1",
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 3,
  },
  formulaText: {
    color: "#A5B4FC",
    fontFamily: "monospace",
    fontSize: 9,
    marginBottom: 8,
  },
  paramRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paramItem: {
    alignItems: "center",
  },
  paramName: {
    color: palette.muted,
    fontSize: 8,
  },
  paramVal: {
    color: palette.ink,
    fontSize: 11,
    fontWeight: "900",
    marginTop: 2,
  },
  feedback: {
    color: "#CBD5E1",
    fontSize: 11,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 12,
  },
  badgesRewardRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: 16,
  },
  badgeRewardLabel: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "800",
  },
  unlockedBadgePill: {
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    borderColor: "rgba(245, 158, 11, 0.5)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  unlockedBadgeText: {
    color: "#FDE68A",
    fontSize: 10,
    fontWeight: "800",
  },
  button: {
    backgroundColor: "#2563EB",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    boxShadow: "0px 2px 8px rgba(37, 99, 235, 0.35)",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
