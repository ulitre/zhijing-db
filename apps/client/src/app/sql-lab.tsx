import { useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { GlassCard, palette } from "../components/design-system";
import { executeSql } from "../lib/api";
import { useApp } from "../state/app-context";

const starterSql = `SELECT s.name AS student_name, c.title AS course_title, e.score
FROM enrollment e
JOIN student s ON s.id = e.student_id
JOIN course c ON c.id = e.course_id
WHERE e.score >= 85
ORDER BY e.score DESC`;
const presets = [
  { label: "三表联查", sql: starterSql },
  { label: "选课统计", sql: `SELECT c.title AS course_title, COUNT(e.student_id) AS student_count, AVG(e.score) AS average_score\nFROM enrollment e\nJOIN course c ON c.id = e.course_id\nGROUP BY c.id, c.title\nORDER BY student_count DESC` },
];

type Result = { columns: string[]; rows: unknown[][]; rowCount: number; elapsedMs: number; sandbox: string };

export default function SqlLabScreen() {
  const { currentUser } = useApp();
  const [sql, setSql] = useState(starterSql);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  if (!currentUser) return null;
  const securityBlocked = /ATTACH\s+DATABASE|\bPRAGMA\b|extension|multiple statements|多语句|安全拦截|禁止执行/i.test(error);

  const run = async () => {
    setRunning(true); setError("");
    try { setResult(await executeSql({ userId: currentUser.id, mode: "query", sql })); }
    catch (reason) { setResult(null); setError(reason instanceof Error ? reason.message : "执行失败"); }
    finally { setRunning(false); }
  };

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><Text style={styles.back}>‹ 返回资源库</Text></Pressable>
    <Text style={styles.eyebrow}>SQLLAB AGENT · ISOLATED WORKER</Text><Text style={styles.title}>校园选课 SQL 实验室</Text><Text style={styles.subtitle}>在隔离的临时数据库中验证查询，结果仅用于当前学习会话。</Text>
    <GlassCard accent>
      <Text style={styles.label}>练习：查询 85 分及以上的学生、课程与成绩</Text>
      <View style={[styles.editorFrame, editorFocused && styles.editorFocused]}>
        <View style={styles.editorStatus}><View style={styles.liveDot} /><Text style={styles.editorStatusText}>sql.js-worker 隔离沙箱  |  2秒超时  |  最多200行</Text></View>
        <TextInput value={sql} onChangeText={setSql} multiline autoCapitalize="none" autoCorrect={false} spellCheck={false} onFocus={() => setEditorFocused(true)} onBlur={() => setEditorFocused(false)} selectionColor="#93C5FD" style={styles.editor} accessibilityLabel="SQL 查询编辑器" />
      </View>
      <View style={styles.presetRow}>{presets.map((preset) => <Pressable key={preset.label} onPress={() => { setSql(preset.sql); setError(""); }} style={({ pressed }) => [styles.preset, pressed && styles.pressed]}><Text style={styles.presetGlyph}>⌘</Text><Text style={styles.presetText}>{preset.label}</Text></Pressable>)}</View>
      <Pressable disabled={running} onPress={() => void run()} style={({ pressed }) => [styles.run, pressed && !running && styles.runPressed, running && styles.runDisabled]}>{running ? <><ActivityIndicator color="white" /><Text style={styles.runText}>正在隔离执行…</Text></> : <Text style={styles.runText}>▶  在安全沙箱中执行</Text>}</Pressable>
    </GlassCard>

    {error ? <View style={[styles.alertCard, securityBlocked ? styles.securityCard : styles.errorCard]}>
      <View style={styles.alertHead}><Text style={styles.alertGlyph}>{securityBlocked ? "⛨" : "!"}</Text><Text style={styles.alertTitle}>{securityBlocked ? "安全规则已拦截" : "查询未能完成"}</Text></View>
      <Text style={styles.alertBody}>{securityBlocked ? `此语句触发隔离沙箱安全策略：${error}` : error}</Text>
      <Text style={styles.alertHint}>允许单条只读查询；ATTACH、PRAGMA、扩展加载与多语句会被拒绝。</Text>
    </View> : null}

    {result ? <GlassCard>
      <View style={styles.resultHead}><View><Text style={styles.resultTitle}>查询结果</Text><Text style={styles.resultSub}>执行完成 · {result.sandbox}</Text></View><View style={styles.resultBadges}><Text style={styles.countBadge}>{result.rowCount} 行</Text><Text style={styles.timeBadge}>{result.elapsedMs} ms</Text></View></View>
      <ScrollView horizontal showsHorizontalScrollIndicator persistentScrollbar contentContainerStyle={styles.tableScroll}>
        <View><View style={styles.row}>{result.columns.map((column) => <Text key={column} style={[styles.cell, styles.headerCell]}>{column}</Text>)}</View>
          {result.rows.map((row, index) => <View key={index} style={[styles.row, index % 2 === 1 && styles.stripedRow]}>{row.map((cell, cellIndex) => <Text key={cellIndex} style={styles.cell}>{String(cell)}</Text>)}</View>)}
        </View>
      </ScrollView>
    </GlassCard> : null}
    <View style={styles.securityNote}><Text style={styles.lockGlyph}>⛨</Text><Text style={styles.note}>实验库与业务数据库完全隔离。每次执行使用全新内存数据库，超时自动终止。</Text></View>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background }, page: { width: "100%", maxWidth: 800, alignSelf: "center", padding: 22, paddingTop: 28, paddingBottom: 40, gap: 15 },
  backButton: { alignSelf: "flex-start", paddingVertical: 7, paddingRight: 12 }, back: { color: "#A5B4FC", fontWeight: "800" }, pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  eyebrow: { color: "#93C5FD", fontWeight: "900", fontSize: 10, letterSpacing: 1.3 }, title: { color: palette.ink, fontWeight: "900", fontSize: 27 }, subtitle: { color: palette.muted, lineHeight: 21, fontSize: 12 }, label: { color: "#E2E8F0", fontWeight: "800", marginBottom: 12, fontSize: 12 },
  editorFrame: { borderRadius: 15, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.24)", backgroundColor: "rgba(2, 6, 23, 0.94)", overflow: "hidden" }, editorFocused: { borderColor: "rgba(59, 130, 246, 0.72)", boxShadow: "0px 0px 12px rgba(59, 130, 246, 0.22)", elevation: 3 }, editorStatus: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: palette.line, backgroundColor: "rgba(15, 23, 42, 0.9)" }, liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.success }, editorStatusText: { color: "#94A3B8", fontSize: 9, fontWeight: "700" },
  editor: { minHeight: 190, padding: 14, color: "#BFDBFE", fontFamily: "monospace", fontSize: 12, lineHeight: 21, textAlignVertical: "top" }, presetRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 11 }, preset: { minHeight: 34, paddingHorizontal: 11, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.36)", backgroundColor: "rgba(49, 46, 129, 0.2)" }, presetGlyph: { color: "#A5B4FC", fontSize: 11 }, presetText: { color: "#C7D2FE", fontSize: 10, fontWeight: "800" },
  run: { marginTop: 13, minHeight: 48, borderRadius: 13, backgroundColor: "#2563EB", flexDirection: "row", gap: 9, alignItems: "center", justifyContent: "center", boxShadow: "0px 3px 9px rgba(59, 130, 246, 0.25)", elevation: 3 }, runPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] }, runDisabled: { opacity: 0.7 }, runText: { color: "white", fontWeight: "900", fontSize: 12 },
  alertCard: { borderRadius: 17, padding: 15, borderWidth: 1, backgroundColor: "rgba(69, 10, 10, 0.5)" }, securityCard: { borderColor: "rgba(239, 68, 68, 0.78)", boxShadow: "0px 0px 14px rgba(239, 68, 68, 0.3)", elevation: 5 }, errorCard: { borderColor: "rgba(245, 158, 11, 0.48)" }, alertHead: { flexDirection: "row", alignItems: "center", gap: 8 }, alertGlyph: { color: palette.danger, fontWeight: "900", fontSize: 18 }, alertTitle: { color: "#FCA5A5", fontSize: 13, fontWeight: "900" }, alertBody: { color: "#FECACA", lineHeight: 20, fontSize: 11, marginTop: 8 }, alertHint: { color: "#FDA4AF", lineHeight: 17, fontSize: 9, marginTop: 7 },
  resultHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13, gap: 9 }, resultTitle: { color: palette.ink, fontWeight: "900", fontSize: 14 }, resultSub: { color: palette.muted, fontSize: 9, marginTop: 4 }, resultBadges: { flexDirection: "row", gap: 6 }, countBadge: { color: "#BFDBFE", backgroundColor: "rgba(37, 99, 235, 0.2)", borderColor: "rgba(59, 130, 246, 0.35)", borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, fontSize: 9, fontWeight: "900" }, timeBadge: { color: "#A7F3D0", backgroundColor: "rgba(16, 185, 129, 0.12)", borderColor: "rgba(16, 185, 129, 0.3)", borderWidth: 1, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, fontSize: 9, fontWeight: "900" }, tableScroll: { paddingBottom: 2 }, row: { flexDirection: "row" }, stripedRow: { backgroundColor: "rgba(148, 163, 184, 0.06)" }, cell: { minWidth: 145, padding: 10, borderBottomWidth: 1, borderColor: "rgba(255, 255, 255, 0.07)", color: "#CBD5E1", fontSize: 10, fontFamily: "monospace" }, headerCell: { backgroundColor: "rgba(99, 102, 241, 0.18)", color: "#C7D2FE", fontWeight: "900", borderBottomColor: "rgba(99, 102, 241, 0.4)" },
  securityNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingHorizontal: 4 }, lockGlyph: { color: palette.success, fontSize: 13 }, note: { flex: 1, color: palette.muted, fontSize: 10, lineHeight: 17 },
});
