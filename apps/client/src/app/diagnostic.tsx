import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { GlassCard, ProgressBar, palette } from "../components/design-system";
import { useApp } from "../state/app-context";

const questionBank = [
  { nodeId: "relations", levels: ["学生表的一行通常称为什么？", "关系模型中，元组和属性分别对应什么？", "一个关系的度和基数分别如何计算？"], answers: [["元组", "属性", "关系"], ["行与列", "列与行", "表名与数据"], ["属性数与元组数", "元组数与属性数", "主键数与外键数"]], correct: [0, 0, 0] },
  { nodeId: "keys-integrity", levels: ["主键从哪类键中选出？", "一个关系可以有几个候选键？", "若候选键有多个，如何定义主键？"], answers: [["候选键", "外键", "任意属性"], ["可以有多个", "只能有一个", "必须为零个"], ["从候选键中选定一个", "把所有候选键合并", "将外键设为主键"]], correct: [0, 0, 0] },
  { nodeId: "sql-select", levels: ["筛选成绩不低于 80 的行通常用什么子句？", "SQL 如何筛选成绩不低于 80 且姓名以林开头的学生？", "为什么 `score = NULL` 不能正确筛选缺失成绩？"], answers: [["WHERE", "ORDER BY", "GROUP BY"], ["WHERE score >= 80 AND name LIKE '林%'", "HAVING score >= 80", "ORDER BY score >= 80"], ["NULL 表示未知，应使用 IS NULL 判断", "NULL 永远等于 0", "数据库不允许比较成绩"]], correct: [0, 0, 0] },
  { nodeId: "sql-joins", levels: ["两张表按共同键组合通常用什么操作？", "学生、选课、课程三表联查应按什么关系连接？", "如何避免多表 JOIN 产生意外重复行？"], answers: [["JOIN", "DROP", "UPDATE"], ["学生ID、课程ID分别连接选课表", "只按姓名连接", "不写连接条件"], ["检查连接键和基数，再验证结果", "给结果加 DISTINCT 就足够", "忽略重复行"]], correct: [0, 0, 0] },
  { nodeId: "tx-acid", levels: ["事务的原子性意味着什么？", "转账中扣款成功而入账失败时，原子性要求什么？", "原子性与一致性的关注点有什么区别？"], answers: [["操作全做或全不做", "每次只能改一行", "数据必须加密"], ["回滚扣款，保持整体操作完整", "继续扣款", "等下次查询再处理"], ["原子性关注操作整体提交或回滚；一致性关注约束成立", "两者都只表示性能", "一致性只关心权限"]], correct: [0, 0, 0] },
] as const;

type Answer = { nodeId: string; correctness: number; usedHint: boolean; confidence: number };

export default function DiagnosticScreen() {
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
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <Text style={styles.eyebrow}>DIAGNOSIS AGENT · {step + 1}/{questionBank.length} · 难度 {level + 1}/3</Text>
    <Text style={styles.title}>先聊几句，再为你规划</Text>
    <Text style={styles.subtitle}>你好，{currentUser?.displayName}。这不是考试，我会根据回答动态调整后续问题和学习路径。</Text>
    <ProgressBar value={((step + 1) / questionBank.length) * 100} />
    <View style={styles.chatRow}><View style={styles.avatar}><Text style={styles.avatarText}>D</Text></View><GlassCard accent><Text style={styles.agent}>DiagnosisAgent</Text><Text style={styles.question}>{question}</Text></GlassCard></View>
    <View style={styles.choices}>{bank.answers[level]!.map((choice, index) => <Pressable disabled={loading} key={choice} onPress={() => void choose(index)} style={styles.choice}><Text style={styles.choiceText}>{choice}</Text><Text style={styles.arrow}>›</Text></Pressable>)}</View>
    {loading ? <View style={styles.loading}><ActivityIndicator color={palette.purple} /><Text style={styles.loadingText}>正在更新八维画像和动态路径…</Text></View> : null}
    <Text style={styles.note}>回答仅用于本次演示画像 · 可在“我的”页面查看变化</Text>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.background }, page: { flexGrow: 1, width: "100%", maxWidth: 720, alignSelf: "center", padding: 24, paddingTop: 52, gap: 18 }, eyebrow: { color: palette.purple, fontWeight: "900", fontSize: 11, letterSpacing: 1.2 }, title: { color: palette.ink, fontWeight: "900", fontSize: 28 }, subtitle: { color: palette.muted, lineHeight: 22 }, chatRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 18 }, avatar: { width: 38, height: 38, borderRadius: 14, backgroundColor: palette.purple, alignItems: "center", justifyContent: "center" }, avatarText: { color: "white", fontWeight: "900" }, agent: { color: palette.purple, fontWeight: "900", fontSize: 11 }, question: { color: palette.ink, fontSize: 19, lineHeight: 28, fontWeight: "800", marginTop: 8 }, choices: { gap: 10 }, choice: { flexDirection: "row", alignItems: "center", minHeight: 58, backgroundColor: "#0B1329", borderWidth: 1, borderColor: "#334155", borderRadius: 17, paddingHorizontal: 17 }, choiceText: { color: palette.ink, fontWeight: "700", flex: 1 }, arrow: { color: palette.purple, fontSize: 24 }, loading: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" }, loadingText: { color: palette.muted, fontSize: 12 }, note: { color: palette.muted, fontSize: 11, textAlign: "center", marginTop: "auto" } });

function levelFromAnswer(answer: Answer) { return answer.correctness >= 100 ? 2 : 1; }
