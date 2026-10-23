import { Modal, Pressable, Text, View } from "react-native";
import type { EvaluationResult } from "../lib/api";
import { MONO_FONT } from "./theme-ui";
import { useTheme } from "../state/theme-context";

/** BKT derivation modal — theme-aware, no fixed blue-black surface. */
export function BktEvaluationModal({
  result,
  visible,
  onClose,
}: {
  result: EvaluationResult | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  if (!result) return null;

  const isPositive = result.delta >= 0;
  const deltaColor = isPositive ? theme.success : theme.warning;
  const deltaSoft = isPositive ? theme.successSoft : theme.warningSoft;

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20, backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.66)" : "rgba(41, 37, 36, 0.28)" }}>
      <View style={{
        width: "100%",
        maxWidth: 440,
        backgroundColor: theme.bgSurface,
        borderRadius: 22,
        padding: 22,
        borderWidth: 1,
        borderColor: theme.borderSubtle,
        gap: 14,
      }}>
        <View style={{ alignItems: "center", gap: 6 }}>
          <View style={{ backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder, borderWidth: 1, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 3 }}>
            <Text style={{ color: theme.accentPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.2 }}>EVALUATION AGENT · BKT CALCULATION</Text>
          </View>
          <Text style={{ color: theme.textPrimary, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{result.conceptTitle}</Text>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.bgElevated, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.borderDivider }}>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: theme.textMuted, fontSize: 9 }}>练习前掌握度</Text>
            <Text style={{ color: theme.textSecondary, fontSize: 22, fontWeight: "900", fontFamily: MONO_FONT }}>{result.prevMastery}%</Text>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: theme.textMuted, fontSize: 16, fontWeight: "900" }}>➔</Text>
            <View style={{ borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, backgroundColor: deltaSoft, borderColor: `${deltaColor}55` }}>
              <Text style={{ color: deltaColor, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT }}>{isPositive ? `+${result.delta}%` : `${result.delta}%`}</Text>
            </View>
          </View>
          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ color: theme.textMuted, fontSize: 9 }}>BKT 计算后掌握度</Text>
            <Text style={{ color: theme.accentPrimary, fontSize: 26, fontWeight: "900", fontFamily: MONO_FONT }}>{result.newMastery}%</Text>
          </View>
        </View>

        {result.bkt ? <View style={{ backgroundColor: theme.bgElevated, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.borderDivider, gap: 8 }}>
          <Text style={{ color: theme.textSecondary, fontSize: 10, fontWeight: "800" }}>贝叶斯知识追踪 (BKT) 公式推导：</Text>
          <Text style={{ color: theme.accentPrimary, fontFamily: MONO_FONT, fontSize: 9 }}>P(L_t) = P(L_{"{t-1}"}|obs) + (1 - P(L_{"{t-1}"}|obs)) · P(T)</Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            {[
              { name: "先验 P(L_{t-1})", value: `${result.bkt.prior}%` },
              { name: "观测后验 P(L|obs)", value: `${result.bkt.posterior}%` },
              { name: "知识转移率 P(T)", value: `${result.bkt.transit}%` },
            ].map((param) => <View key={param.name} style={{ alignItems: "center", gap: 2 }}>
              <Text style={{ color: theme.textMuted, fontSize: 8 }}>{param.name}</Text>
              <Text style={{ color: theme.textPrimary, fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT }}>{param.value}</Text>
            </View>)}
          </View>
        </View> : null}

        <Text style={{ color: theme.textSecondary, fontSize: 12, lineHeight: 19, textAlign: "center" }}>{result.feedback}</Text>

        {result.unlockedBadges && result.unlockedBadges.length > 0 ? <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, justifyContent: "center" }}>
          <Text style={{ color: theme.warning, fontSize: 10, fontWeight: "800" }}>🏅 点亮成就：</Text>
          {result.unlockedBadges.map((badgeName: string) => <View key={badgeName} style={{ backgroundColor: theme.warningSoft, borderColor: `${theme.warning}55`, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ color: theme.warning, fontSize: 10, fontWeight: "800" }}>{badgeName}</Text>
          </View>)}
        </View> : null}

        <Pressable accessibilityRole="button" accessibilityLabel="确定并返回练习" onPress={onClose} style={({ pressed }) => [{ backgroundColor: theme.accentPrimary, borderRadius: 14, paddingVertical: 12, alignItems: "center" }, pressed && { opacity: 0.85 }]}>
          <Text style={{ color: theme.onAccent, fontSize: 12, fontWeight: "900" }}>确定并返回练习</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}
