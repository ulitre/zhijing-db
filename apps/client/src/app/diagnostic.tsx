import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View, StyleSheet } from "react-native";
import { router } from "expo-router";
import { BulletBar, PageHeading, ThemedScreen, webOnly } from "../components/theme-ui";
import { useApp } from "../state/app-context";
import { useTheme } from "../state/theme-context";

const questionBank = [
  { nodeId: "relations", levels: ["学生表的一行通常称为什么？", "关系模型中，元组和属性分别对应什么？", "一个关系的度和基数分别如何计算？"], answers: [["元组", "属性", "关系"], ["行与列", "列与行", "表名与数据"], ["属性数与元组数", "元组数与属性数", "主键数与外键数"]], correct: [0, 0, 0] },
  { nodeId: "keys-integrity", levels: ["主键从哪类键中选出？", "一个关系可以有几个候选键？", "若候选键有多个，如何定义主键？"], answers: [["候选键", "外键", "任意属性"], ["可以有多个", "只能有一个", "必须为零个"], ["从候选键中选定一个", "把所有候选键合并", "将外键设为主键"]], correct: [0, 0, 0] },
  { nodeId: "sql-select", levels: ["筛选成绩不低于 80 的行通常用什么子句？", "SQL 如何筛选成绩不低于 80 且姓名以林开头的学生？", "为什么 `score = NULL` 不能正确筛选缺失成绩？"], answers: [["WHERE", "ORDER BY", "GROUP BY"], ["WHERE score >= 80 AND name LIKE '林%'", "HAVING score >= 80", "ORDER BY score >= 80"], ["NULL 表示未知，应使用 IS NULL 判断", "NULL 永远等于 0", "数据库不允许比较成绩"]], correct: [0, 0, 0] },
  { nodeId: "sql-joins", levels: ["两张表按共同键组合通常用什么操作？", "学生、选课、课程三表联查应按什么关系连接？", "如何避免多表 JOIN 产生意外重复行？"], answers: [["JOIN", "DROP", "UPDATE"], ["学生ID、课程ID分别连接选课表", "只按姓名连接", "不写连接条件"], ["检查连接键和基数，再验证结果", "给结果加 DISTINCT 就足够", "忽略重复行"]], correct: [0, 0, 0] },
  { nodeId: "tx-acid", levels: ["事务的原子性意味着什么？", "转账中扣款成功而入账失败时，原子性要求什么？", "原子性与一致性的关注点有什么区别？"], answers: [["操作全做或全不做", "每次只能改一行", "数据必须加密"], ["回滚扣款，保持整体操作完整", "继续扣款", "等下次查询再处理"], ["原子性关注操作整体提交或回滚；一致性关注约束成立", "两者都只表示性能", "一致性只关心权限"]], correct: [0, 0, 0] },
] as const;

type Answer = { nodeId: string; correctness: number; usedHint: boolean; confidence: number };

export default function DiagnosticScreen() {
  const { theme } = useTheme();
  const { currentUser, completeDiagnostic, loading } = useApp();
  const [step, setStep] = useState(0); const [answers, setAnswers] = useState<Answer[]>([]);
  const bank = questionBank[step]!; const previous = answers[answers.length - 1]; const level = previous ? previous.correctness >= 85 ? levelFromAnswer(previous) : previous.correctness < 50 ? 0 : 1 : 0; const question = bank.levels[level]!;
  const choose = async (index: number) => {
    const correct = index === bank.correct[level]; const score = correct ? (level === 2 ? 100 : level === 1 ? 85 : 70) : 20;
    const next = [...answers, { nodeId: bank.nodeId, correctness: score, usedHint: false, confidence: correct ? 85 : 45 }];
    setAnswers(next);
    if (step < questionBank.length - 1) setStep((value) => value + 1);
    else { await completeDiagnostic(next); router.replace("/(tabs)"); }
  };
  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading title="先聊几句，再为你规划" subtitle={`你好，${currentUser?.displayName ?? "同学"}。这不是考试，我会根据回答动态调整后续问题和学习路径。`} />
    <View style={styles.progressRow}>
      <Text style={[styles.eyebrow, { color: theme.accentPrimary }]}>DIAGNOSIS AGENT · {step + 1}/{questionBank.length} · 难度 {level + 1}/3</Text>
      <Text style={[styles.progressHint, { color: theme.textMuted }]}>自适应难度校准</Text>
    </View>
    <BulletBar value={((step + 1) / questionBank.length) * 100} color={theme.accentPrimary} marker={0} showMarker={false} accessibilityLabel={`诊断进度 ${step + 1}/${questionBank.length}`} />
    <View accessibilityRole="progressbar" accessibilityLabel="诊断步骤" aria-valuemin={1} aria-valuemax={questionBank.length} aria-valuenow={step + 1} style={styles.stepDots}>
      {questionBank.map((item, index) => <View
        key={item.nodeId}
        style={[
          styles.stepDot,
          { backgroundColor: index <= step ? theme.accentPrimary : theme.pendingLine },
          index === step && styles.stepDotActive,
          index < step && { opacity: 0.55 },
        ]}
      />)}
    </View>

    <View key={`step-${step}`} style={webOnly({ animationKeyframes: "fadeInUp", animationDuration: "420ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards" })}>
      <View style={styles.chatRow}>
        <View style={[styles.avatar, { backgroundColor: theme.accentPrimary }]}><Text style={[styles.avatarText, { color: theme.onAccent }]}>D</Text></View>
        <View style={[styles.questionCard, { backgroundColor: theme.bgSurface, borderColor: theme.accentSoftBorder }, webOnly({ boxShadow: cardShadowFor(theme) })]}>
          <Text style={[styles.agent, { color: theme.accentPrimary }]}>DiagnosisAgent</Text>
          <Text style={[styles.question, { color: theme.textPrimary }]}>{question}</Text>
        </View>
      </View>

      <View style={styles.choices}>{bank.answers[level]!.map((choice, index) => <Pressable
        disabled={loading}
        key={choice}
        accessibilityRole="button"
        accessibilityLabel={`选项 ${index + 1}：${choice}`}
        accessibilityState={{ disabled: loading }}
        onPress={() => void choose(index)}
        style={({ pressed }) => [
          styles.choice,
          { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle },
          webOnly({ boxShadow: cardShadowFor(theme) }),
          webOnly({ cursor: "pointer", transitionProperty: "border-color, background-color, transform, box-shadow", transitionDuration: "180ms" }),
          pressed && !loading && styles.choicePressed,
          pressed && !loading && { borderColor: theme.accentPrimary, backgroundColor: theme.accentSoft },
          loading && styles.choiceDisabled,
        ]}
      ><Text style={[styles.choiceText, { color: theme.textPrimary }]}>{choice}</Text><Text style={[styles.arrow, { color: theme.accentPrimary }]}>›</Text></Pressable>)}</View>
    </View>

    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.accentPrimary} /><Text style={[styles.loadingText, { color: theme.textSecondary }]}>正在更新八维画像和动态路径…</Text></View> : null}
    <Text style={[styles.note, { color: theme.textMuted }]}>回答仅用于本次演示画像 · 可在“我的”页面查看变化</Text>
  </ThemedScreen>;
}

function cardShadowFor(theme: ReturnType<typeof useTheme>["theme"]) {
  return theme.isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px -22px rgba(0, 0, 0, 0.78)"
    : "0 14px 34px -20px rgba(41, 37, 36, 0.18), 0 1px 3px rgba(41, 37, 36, 0.04)";
}

const styles = StyleSheet.create({
  page: { maxWidth: 780, paddingTop: 48, gap: 18 },
  progressRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 4 },
  eyebrow: { fontWeight: "900", fontSize: 12.5, letterSpacing: 1, fontFamily: "monospace" },
  progressHint: { fontSize: 13.5 },
  chatRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 10 },
  avatar: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontWeight: "900", fontSize: 16 },
  questionCard: { flex: 1, minWidth: 0, borderRadius: 18, borderWidth: 1, borderLeftWidth: 3, padding: 20 },
  agent: { fontWeight: "900", fontSize: 12.5 },
  question: { fontSize: 21, lineHeight: 30, fontWeight: "800", marginTop: 8 },
  stepDots: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: -4 },
  stepDot: { flex: 1, height: 4, borderRadius: 99, maxWidth: 48, opacity: 1 },
  stepDotActive: { maxWidth: 84 },
  choices: { gap: 12, marginTop: 12 },
  choice: { flexDirection: "row", alignItems: "center", minHeight: 64, borderWidth: 1, borderRadius: 18, paddingHorizontal: 20 },
  choicePressed: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  choiceDisabled: { opacity: 0.6 },
  choiceText: { fontWeight: "700", flex: 1, fontSize: 16.5, lineHeight: 24 },
  arrow: { fontSize: 26 },
  loading: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  loadingText: { fontSize: 13.5 },
  note: { fontSize: 12.5, textAlign: "center", marginTop: 24 },
});

function levelFromAnswer(answer: Answer) { return answer.correctness >= 100 ? 2 : 1; }
