import { useEffect, useState } from "react";
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { GlassCard, PageHeader, palette } from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { askTutor, type TutorResponse } from "../../lib/api";
import { useApp } from "../../state/app-context";

const localAnswer: TutorResponse = {
  answer: "候选键是能够唯一标识元组的最小属性集，可能有多个；主键是从候选键中选定的一个。以校园选课系统为例，学生表可以同时拥有学号和内部编号两个候选键，但系统会选择其中一个作为主键。",
  citations: [{ id: "local-database-design", title: "BCcampus Database Design · PostgreSQL Constraints" }],
  refused: false,
};

function localTutorFallback(question: string): TutorResponse {
  const normalized = question.replace(/事物(?=(?:的)?(?:四大|特性|性质|acid|原子性|一致性|隔离性|持久性))/gi, "事务");
  if (/(事务|acid|原子性|一致性|隔离性|持久性)/i.test(normalized)) return {
    answer: "事务的四大特性称为 ACID：原子性表示操作全部成功或全部回滚；一致性表示事务前后满足完整性约束；隔离性表示并发事务互不干扰；持久性表示提交结果不会因故障丢失。",
    citations: [{ id: "local-postgresql-transactions", title: "PostgreSQL Documentation · Transactions" }],
    refused: false,
  };
  const inScope = /(数据库|sql|候选键|主键|外键|关系|事务|索引|范式|查询|表|join)/i.test(normalized);
  return inScope
    ? localAnswer
    : { answer: "这个问题超出了《数据库原理》课程知识库范围。请围绕 SQL、数据库设计、事务、索引或安全继续提问。", citations: [], refused: true };
}

export default function TutorScreen() {
  const { currentUser } = useApp();
  const [question, setQuestion] = useState("");
  const [lastQuestion, setLastQuestion] = useState("");
  const [response, setResponse] = useState<TutorResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [loadingPulse] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    if (!loading) { loadingPulse.setValue(0.55); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(loadingPulse, { toValue: 1, duration: 750, useNativeDriver: true }),
      Animated.timing(loadingPulse, { toValue: 0.55, duration: 750, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [loading, loadingPulse]);
  if (!currentUser) return null;

  const ask = async () => {
    const value = question.trim(); if (!value || loading) return;
    setLastQuestion(value); setQuestion(""); setLoading(true); setError(""); setResponse(null);
    try { setResponse(await askTutor({ userId: currentUser.id, question: value })); }
    catch (reason) { setResponse(localTutorFallback(value)); setError(reason instanceof Error ? "当前使用本地课程知识库回答" : "已切换到本地课程知识库"); }
    finally { setLoading(false); }
  };

  const correctedQuestion = /事物(?=(?:的)?(?:四大|特性|性质|acid|原子性|一致性|隔离性|持久性))/i.test(lastQuestion);

  return <ScreenShell><PageHeader title="AI 辅导" subtitle="只回答《数据库原理》范围，并提供可追踪知识来源" />
    <GlassCard accent><Text style={styles.label}>当前学习节点</Text><Text style={styles.node}>键与关系完整性</Text><Text style={styles.hint}>试着问：“候选键和主键到底有什么区别？”</Text></GlassCard>

    {lastQuestion ? <View style={styles.userMessageWrap}>
      {correctedQuestion ? <View style={styles.correctionTag}><Text style={styles.correctionGlyph}>↺</Text><Text style={styles.correctionText}>概念纠偏：这里的“事物”应为“事务” · ACID</Text></View> : null}
      <View style={styles.userBubble}><View style={styles.userBubbleHighlight} /><Text style={styles.userText}>{lastQuestion}</Text></View>
    </View> : null}

    {response ? <View style={[styles.bubble, response.refused ? styles.refusedBubble : styles.aiBubble]}>
      <View style={styles.aiHeader}><View style={styles.aiMark}><Text style={styles.aiMarkText}>{response.refused ? "!" : "✦"}</Text></View><Text style={styles.aiTitle}>{response.refused ? "范围审核" : "TutorAgent · 循证回答"}</Text></View>
      {response.refused ? <View style={styles.scopeTag}><Text style={styles.scopeGlyph}>◇</Text><Text style={styles.scopeText}>超出《数据库原理》课程范围</Text></View> : null}
      <Text style={styles.aiText}>{response.answer}</Text>
      {response.citations.length ? <View style={styles.citationBox}><Text style={styles.citationTitle}>教材与知识来源</Text><View style={styles.citationBadges}>{response.citations.map((citation) => <View key={citation.id} style={styles.citationBadge}><Text style={styles.citationGlyph}>⌕</Text><Text style={styles.citation}>{citation.title}</Text></View>)}</View></View> : null}
    </View> : loading ? <Animated.View style={[styles.loadingCard, { opacity: loadingPulse }]}><ActivityIndicator color={palette.blue} /><View style={styles.loadingCopy}><Text style={styles.loadingTitle}>TutorAgent 正在检索</Text><Text style={styles.empty}>匹配课程知识卡并整理引用依据…</Text></View></Animated.View> : !lastQuestion ? <GlassCard><Text style={styles.emptyTitle}>基于证据的即时辅导</Text><Text style={styles.empty}>系统会先检索课程知识卡，再生成解释；超出课程范围时明确拒答。</Text></GlassCard> : null}
    {error ? <Text style={styles.fallback}>{error}</Text> : null}

    <View style={[styles.composer, inputFocused && styles.composerFocused]}>
      <TextInput value={question} onChangeText={(text) => { setQuestion(text); setError(""); }} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} placeholder="输入数据库原理问题…" placeholderTextColor="#64748B" selectionColor="#93C5FD" style={styles.input} multiline accessibilityLabel="向 AI 导师提问" />
      <Pressable accessibilityRole="button" accessibilityLabel="发送问题" disabled={loading || !question.trim()} onPress={() => void ask()} style={({ pressed }) => [styles.send, (loading || !question.trim()) && styles.sendDisabled, pressed && !loading && styles.sendPressed]}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.sendText}>发送</Text>}</Pressable>
    </View>
    <Text style={styles.disclaimer}>AI 生成内容仅供学习参考 · 重要结论请核对引用来源</Text>
  </ScreenShell>;
}

const styles = StyleSheet.create({
  label: { color: "#A5B4FC", fontSize: 10, fontWeight: "900", letterSpacing: 0.8 }, node: { color: palette.ink, fontSize: 19, fontWeight: "900", marginTop: 6 }, hint: { color: palette.muted, fontSize: 11, marginTop: 7 },
  userMessageWrap: { alignSelf: "flex-end", maxWidth: "94%", alignItems: "flex-end", gap: 7 }, correctionTag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.42)", backgroundColor: "rgba(120, 53, 15, 0.22)", borderRadius: 99, paddingHorizontal: 10, paddingVertical: 6 }, correctionGlyph: { color: "#FBBF24", fontSize: 11, fontWeight: "900" }, correctionText: { color: "#FCD34D", fontSize: 9, fontWeight: "800" },
  userBubble: { overflow: "hidden", alignSelf: "flex-end", maxWidth: "100%", paddingHorizontal: 15, paddingVertical: 12, borderRadius: 19, borderTopRightRadius: 6, borderWidth: 1, borderColor: "rgba(165, 180, 252, 0.34)", backgroundColor: "#1e1b4b", boxShadow: "0px 3px 12px rgba(99, 102, 241, 0.17)", elevation: 2 }, userBubbleHighlight: { position: "absolute", top: 0, left: 0, right: 0, height: 2, backgroundColor: "rgba(199, 210, 254, 0.38)" }, userText: { color: "#F8FAFC", fontWeight: "700", fontSize: 13, lineHeight: 21 },
  bubble: { alignSelf: "flex-start", maxWidth: "96%", padding: 15, borderRadius: 19, borderTopLeftRadius: 6 }, aiBubble: { backgroundColor: "rgba(15, 23, 42, 0.82)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.1)" }, refusedBubble: { backgroundColor: "rgba(69, 10, 10, 0.34)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.34)" }, aiHeader: { flexDirection: "row", alignItems: "center", gap: 8 }, aiMark: { width: 23, height: 23, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99, 102, 241, 0.2)" }, aiMarkText: { color: "#C7D2FE", fontSize: 11, fontWeight: "900" }, aiTitle: { color: "#C7D2FE", fontWeight: "900", fontSize: 10 },
  scopeTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, marginTop: 11, backgroundColor: "rgba(239, 68, 68, 0.12)", borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.25)" }, scopeGlyph: { color: "#FCA5A5", fontSize: 10 }, scopeText: { color: "#FECACA", fontSize: 9, fontWeight: "800" }, aiText: { color: "#E2E8F0", lineHeight: 24, fontSize: 13, marginTop: 11 },
  citationBox: { marginTop: 14, paddingTop: 11, borderTopWidth: 1, borderTopColor: palette.line }, citationTitle: { color: palette.muted, fontSize: 9, fontWeight: "900", marginBottom: 8 }, citationBadges: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, citationBadge: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.3)", backgroundColor: "rgba(30, 58, 138, 0.2)" }, citationGlyph: { color: "#93C5FD", fontSize: 10 }, citation: { color: "#BFDBFE", fontSize: 9, fontWeight: "700" },
  loadingCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 15, borderRadius: 18, backgroundColor: palette.surface, borderWidth: 1, borderColor: "rgba(59, 130, 246, 0.24)" }, loadingCopy: { flex: 1 }, loadingTitle: { color: "#BFDBFE", fontSize: 11, fontWeight: "900" }, emptyTitle: { color: palette.ink, fontSize: 15, fontWeight: "900" }, empty: { color: palette.muted, lineHeight: 19, fontSize: 11, marginTop: 5 }, fallback: { color: palette.muted, fontSize: 10, textAlign: "center" },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, backgroundColor: "rgba(15, 23, 42, 0.84)", borderRadius: 19, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.12)", padding: 8 }, composerFocused: { borderColor: "rgba(59, 130, 246, 0.6)", boxShadow: "0px 0px 12px rgba(59, 130, 246, 0.16)", elevation: 3 }, input: { flex: 1, minHeight: 44, maxHeight: 110, color: palette.ink, paddingHorizontal: 10, paddingVertical: 10, fontSize: 12, lineHeight: 19 }, send: { backgroundColor: "#4F46E5", borderRadius: 13, minHeight: 44, minWidth: 54, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", boxShadow: "0px 3px 7px rgba(99, 102, 241, 0.24)" }, sendDisabled: { opacity: 0.52 }, sendPressed: { opacity: 0.82, transform: [{ scale: 0.96 }] }, sendText: { color: "#FFFFFF", fontWeight: "900", fontSize: 11 }, disclaimer: { color: palette.muted, fontSize: 9, textAlign: "center" },
});
