import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Reveal } from "../components/scroll-reveal";
import { PageHeading, ThemedScreen, webOnly } from "../components/theme-ui";
import { useTheme } from "../state/theme-context";

const steps = [["01", "先做一次诊断", "题目会根据你的回答自适应调整难度，定位需要巩固的知识点。"], ["02", "查看推荐路径", "路径展示诊断证据、掌握度、推荐节点和适合你的资源类型。"], ["03", "学习并验证", "在资源详情阅读解析、知识图或 SQL 实验，也可向 TutorAgent 提问。"]];

function cardShadow(isDark: boolean) {
  return isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px -22px rgba(0, 0, 0, 0.78)"
    : "0 14px 34px -22px rgba(41, 37, 36, 0.16), 0 1px 3px rgba(41, 37, 36, 0.04)";
}

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const finish = async () => { await AsyncStorage.setItem("zhijing.onboarding.v1", "done"); router.replace("/"); };
  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading title="三步形成个性化学习闭环" subtitle="让诊断证据连接到下一步可执行的学习任务。" />
    <View style={styles.kickerRow}>
      <Text style={[styles.kicker, { color: theme.accentPrimary }]}>GET STARTED · 3 STEPS</Text>
      <Text style={[styles.kickerMeta, { color: theme.textMuted }]}>约 2 分钟 · 可随时跳过</Text>
    </View>
    {steps.map(([number, title, detail], index) => <Reveal key={number} index={index} reducedMotion={false}>
      <View style={[styles.card, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }, webOnly({ boxShadow: cardShadow(theme.isDark) })]}>
        <View style={[styles.stepBadge, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.number, { color: theme.accentPrimary }]}>{number}</Text></View>
        <View style={styles.copy}>
          <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>{title}</Text>
          <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>
        </View>
      </View>
    </Reveal>)}
    <Pressable accessibilityRole="button" accessibilityLabel="开始使用知径 DB" onPress={() => void finish()} style={({ pressed }) => [styles.button, { backgroundColor: theme.accentPrimary }, webOnly({ backgroundImage: theme.accentGradient, boxShadow: `0 16px 32px -16px ${theme.accentShadow}` }), pressed && styles.pressed]}>
      <Text style={[styles.buttonText, { color: theme.onAccent }]}>开始使用 →</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="跳过引导，稍后在帮助中查看" onPress={() => void finish()} style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
      <Text style={[styles.skipText, { color: theme.textSecondary }]}>跳过，稍后从“使用帮助”查看</Text>
    </Pressable>
  </ThemedScreen>;
}

const styles = StyleSheet.create({
  page: { maxWidth: 780, paddingTop: 64, paddingBottom: 64, justifyContent: "center", gap: 16 },
  kickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 6 },
  kicker: { fontSize: 11, fontWeight: "900", letterSpacing: 1.1, fontFamily: "monospace" },
  kickerMeta: { fontSize: 12.5 },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 16, borderRadius: 18, borderWidth: 1, padding: 20 },
  stepBadge: { width: 44, height: 44, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  number: { fontSize: 16, fontWeight: "900", fontFamily: "monospace" },
  copy: { flex: 1, minWidth: 0 },
  cardTitle: { fontWeight: "900", fontSize: 18 },
  detail: { lineHeight: 23, marginTop: 6, fontSize: 15 },
  button: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 16, marginTop: 8 },
  buttonText: { fontWeight: "900", fontSize: 16 },
  skip: { alignItems: "center", padding: 12 },
  skipText: { fontSize: 13.5, fontWeight: "700" },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
