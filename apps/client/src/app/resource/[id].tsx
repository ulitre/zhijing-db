import { useEffect, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { GlassCard, PageHeader, palette } from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { getCourse } from "../../lib/api";
import { useApp } from "../../state/app-context";

export default function ResourceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const { resources } = useApp(); const resource = resources.find((item) => item.id === id); const sourceIds = resource?.sourceIds.join("|") ?? ""; const [sourceNames, setSourceNames] = useState<string[]>([]);
  useEffect(() => { const ids = sourceIds ? sourceIds.split("|") : []; if (ids.length) void getCourse().then((course) => setSourceNames(ids.map((sourceId) => course.sources.find((source) => source.id === sourceId)?.title ?? sourceId))).catch(() => setSourceNames(ids)); }, [resource?.id, sourceIds]);
  if (!resource) return <ScreenShell><PageHeader title="资源暂不可用" subtitle="该资源可能还在生成，或已不在当前登录会话中。" /><Pressable onPress={() => router.back()}><Text style={styles.link}>返回资源库</Text></Pressable></ScreenShell>;
  const sections = resource.content.split(/\n{2,}/).filter(Boolean);
  const approved = resource.status === "已审核" || resource.status === "审核通过";
  return <ScreenShell><PageHeader title={resource.title} subtitle={`${resource.type} · 难度 ${resource.difficulty}/5 · ${resource.status}`} />
    <GlassCard accent><View style={styles.reviewStamp}><Text style={styles.reviewGlyph}>{approved ? "✓" : "◇"}</Text><Text style={styles.reviewText}>{approved ? "ReviewAgent 审核通过：已校验教材出处与难度" : `ReviewAgent · ${resource.status}`}</Text></View><Text style={styles.heading}>资源摘要</Text><Text style={styles.body}>{resource.summary}</Text><Text style={styles.heading}>完整内容</Text>{sections.map((section, index) => <Text key={index} selectable style={[styles.body, resource.type === "SQL 实操" && styles.code]}>{section}</Text>)}</GlassCard>
    {resource.type === "分层练习" ? <GlassCard><Text style={styles.heading}>练习与解析</Text><Text style={styles.body}>先独立作答，再对照资源正文中的题目、答案和解析核对概念。若正文未提供答案，点击“向 TutorAgent 提问”请求逐题讲解。</Text></GlassCard> : null}
    {resource.type === "SQL 实操" ? <Pressable onPress={() => router.push("/sql-lab")} style={styles.button}><Text style={styles.buttonText}>打开 SQL 实验室执行 ›</Text></Pressable> : null}
    <GlassCard><Text style={styles.heading}>个性化依据</Text>{resource.personalizationReasons.map((reason) => <Text key={reason} style={styles.body}>• {reason}</Text>)}<Text style={styles.heading}>课程来源</Text>{sourceNames.map((name) => <Text key={name} style={styles.body}>{name}</Text>)}</GlassCard>
    <Pressable onPress={() => router.push("/(tabs)/tutor")} style={styles.help}><Text style={styles.link}>向 TutorAgent 提问 ›</Text></Pressable>
  </ScreenShell>;
}
const styles = StyleSheet.create({ reviewStamp: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: "rgba(16, 185, 129, 0.24)", backgroundColor: "rgba(16, 185, 129, 0.08)", marginBottom: 10 }, reviewGlyph: { color: palette.success, fontWeight: "900" }, reviewText: { color: "#A7F3D0", fontWeight: "800", fontSize: 10, flex: 1 }, heading: { color: palette.ink, fontWeight: "900", fontSize: 14, marginTop: 9, marginBottom: 6 }, body: { color: "#CBD5E1", fontSize: 12, lineHeight: 22, marginBottom: 8 }, code: { color: "#BFDBFE", backgroundColor: "rgba(2, 6, 23, 0.72)", padding: 12, borderRadius: 10, fontFamily: "monospace", borderWidth: 1, borderColor: palette.line }, button: { alignItems: "center", borderRadius: 14, padding: 14, backgroundColor: "#4F46E5" }, buttonText: { color: "white", fontWeight: "900" }, help: { alignItems: "center", padding: 10 }, link: { color: "#A5B4FC", fontWeight: "900" } });
