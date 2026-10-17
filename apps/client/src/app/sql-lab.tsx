import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import { GlassCard, palette } from "../components/design-system";
import {
  evaluateSql,
  executeSql,
  getExercises,
  type EvaluationResult,
  type SqlExercise,
} from "../lib/api";
import { useApp } from "../state/app-context";
import { BktEvaluationModal } from "../components/bkt-evaluation-modal";
import { BadgeCelebrationModal, DEFAULT_ACHIEVEMENTS } from "../components/achievement-badges";
import type { Achievement } from "@zhijing/shared";

const defaultExercise: SqlExercise = {
  id: "ex-default",
  title: "三表联查：查询 85 分及以上学生与课程",
  difficulty: 2,
  category: "多表JOIN",
  description: "联结 student、enrollment 和 course 表，查询 85 分及以上的学生姓名、课程名与分数。",
  schemaHint: "student(id, name) JOIN enrollment(student_id, course_id, score) JOIN course(id, title)",
  skeletonSql: `SELECT s.name AS student_name, c.title AS course_title, e.score
FROM enrollment e
JOIN student s ON s.id = e.student_id
JOIN course c ON c.id = e.course_id
WHERE e.score >= 85
ORDER BY e.score DESC`,
  standardSql: `SELECT s.name AS student_name, c.title AS course_title, e.score
FROM enrollment e
JOIN student s ON s.id = e.student_id
JOIN course c ON c.id = e.course_id
WHERE e.score >= 85
ORDER BY e.score DESC`,
  targetNodeId: "sql-joins",
};

type Result = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  elapsedMs: number;
  sandbox: string;
};

const TABLE_SCHEMAS = [
  { name: "student", desc: "学生信息", cols: "id (PK), name, major, grade, gpa" },
  { name: "course", desc: "课程列表", cols: "id (PK), title, credits, department" },
  { name: "teacher", desc: "授课师资", cols: "id (PK), name, title, department" },
  { name: "enrollment", desc: "选课成绩", cols: "student_id (FK), course_id (FK), teacher_id (FK), score, term" },
  { name: "category", desc: "商品类别", cols: "id (PK), name, parent_id" },
  { name: "product", desc: "校园商品", cols: "id (PK), name, category_id (FK), price, stock" },
  { name: "orders", desc: "商城订单", cols: "id (PK), student_id (FK), order_date, total_amount, status" },
  { name: "order_item", desc: "订单明细", cols: "id (PK), order_id (FK), product_id (FK), quantity, unit_price" },
];

export default function SqlLabScreen() {
  const { currentUser } = useApp();
  const [exercises, setExercises] = useState<SqlExercise[]>([defaultExercise]);
  const [selectedExercise, setSelectedExercise] = useState<SqlExercise>(defaultExercise);
  const [selectedCategory, setSelectedCategory] = useState<string>("全部");
  const [sql, setSql] = useState(defaultExercise.skeletonSql);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [showSchemaHint, setShowSchemaHint] = useState(false);

  // Evaluation & Badge Modals
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<Achievement | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  useEffect(() => {
    void getExercises()
      .then((res) => {
        if (res.exercises && res.exercises.length > 0) {
          setExercises(res.exercises);
          setSelectedExercise(res.exercises[0]!);
          setSql(res.exercises[0]!.skeletonSql);
        }
      })
      .catch(() => {
        // Fallback to default exercises
      });
  }, []);

  if (!currentUser) return null;

  const securityBlocked =
    /ATTACH\s+DATABASE|\bPRAGMA\b|extension|multiple statements|多语句|安全拦截|禁止执行/i.test(
      error,
    );

  const categories = ["全部", "基础查询", "多表JOIN", "分组聚合", "子查询", "窗口函数"];

  const filteredExercises =
    selectedCategory === "全部"
      ? exercises.slice(0, 8)
      : exercises.filter((e) => e.category === selectedCategory).slice(0, 8);

  const handleSelectExercise = (ex: SqlExercise) => {
    setSelectedExercise(ex);
    setSql(ex.skeletonSql);
    setError("");
    setResult(null);
  };

  const run = async () => {
    setRunning(true);
    setError("");
    setResult(null);

    try {
      const res = await executeSql({ userId: currentUser.id, mode: "query", sql });
      setResult(res);

      // Trigger EvaluationAgent BKT calculation
      setEvaluating(true);
      try {
        const evalRes = await evaluateSql({
          userId: currentUser.id,
          nodeId: selectedExercise.targetNodeId || "sql-joins",
          correct: res.rowCount > 0,
          sql,
        });

        setEvalResult(evalRes.evaluation);
        setShowEvalModal(true);

        // Check if any badge is unlocked
        if (evalRes.evaluation.unlockedBadges && evalRes.evaluation.unlockedBadges.length > 0) {
          const badgeName = evalRes.evaluation.unlockedBadges[0];
          const matchedBadge = DEFAULT_ACHIEVEMENTS.find((b) => b.title === badgeName);
          if (matchedBadge) {
            setUnlockedBadge(matchedBadge);
          }
        }
      } catch (evalErr) {
        console.warn("Evaluation failed", evalErr);
      } finally {
        setEvaluating(false);
      }
    } catch (reason) {
      setResult(null);
      setError(reason instanceof Error ? reason.message : "执行失败");
    } finally {
      setRunning(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        {/* Navigation */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Text style={styles.back}>‹ 返回资源库</Text>
        </Pressable>

        {/* Title */}
        <View style={styles.pageTitleBlock}>
          <Text style={styles.eyebrow}>
            SQLLAB AGENT · 8 表高仿真数据沙箱 · BKT 实时评估
          </Text>
          <Text style={styles.title}>校园选课与商城 SQL 实验室</Text>
          <Text style={styles.subtitle}>
            支持教务与电商 8 表关联、嵌套子查询与窗口函数，每次执行由 EvaluationAgent 实时更新掌握度。
          </Text>
        </View>

        {/* Category & Exercise Selector */}
        <GlassCard accent>
          <View style={styles.selectorHeader}>
            <Text style={styles.sectionLabel}>题库精选 (200+ 题库支持)</Text>
            <Pressable
              onPress={() => setShowSchemaHint((v) => !v)}
              style={styles.schemaHintButton}
            >
              <Text style={styles.schemaHintText}>
                {showSchemaHint ? "收起 8 表结构" : "📖 查看 8 表结构提示"}
              </Text>
            </Pressable>
          </View>

          {/* 8-Table Schema Hint Drawer */}
          {showSchemaHint && (
            <View style={styles.schemaDrawer}>
              <Text style={styles.schemaDrawerTitle}>🏛️ 沙箱内 8 张预置业务数据表：</Text>
              <View style={styles.schemaGrid}>
                {TABLE_SCHEMAS.map((tbl) => (
                  <View key={tbl.name} style={styles.schemaCard}>
                    <Text style={styles.schemaTableName}>{tbl.name} ({tbl.desc})</Text>
                    <Text style={styles.schemaCols}>{tbl.cols}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Category Tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categories.map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  selectedCategory === cat && styles.categoryPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Exercises list */}
          <View style={styles.exerciseList}>
            {filteredExercises.map((ex) => (
              <Pressable
                key={ex.id}
                onPress={() => handleSelectExercise(ex)}
                style={[
                  styles.exerciseCard,
                  selectedExercise.id === ex.id && styles.exerciseCardSelected,
                ]}
              >
                <View style={styles.exerciseHead}>
                  <Text style={styles.exerciseTitle} numberOfLines={1}>
                    {ex.title}
                  </Text>
                  <Text style={styles.diffBadge}>难度 {ex.difficulty}/5</Text>
                </View>
                <Text style={styles.exerciseDesc} numberOfLines={2}>
                  {ex.description}
                </Text>
              </Pressable>
            ))}
          </View>
        </GlassCard>

        {/* SQL Editor Frame */}
        <GlassCard accent>
          <View style={styles.editorHead}>
            <View>
              <Text style={styles.activeTitle}>{selectedExercise.title}</Text>
              <Text style={styles.activeHint}>提示：{selectedExercise.schemaHint}</Text>
            </View>
            <Pressable
              onPress={() => setSql(selectedExercise.skeletonSql)}
              style={styles.skeletonButton}
            >
              <Text style={styles.skeletonButtonText}>填空骨架</Text>
            </Pressable>
          </View>

          <View style={[styles.editorFrame, editorFocused && styles.editorFocused]}>
            <View style={styles.editorStatus}>
              <View style={styles.liveDot} />
              <Text style={styles.editorStatusText}>
                sql.js-worker 隔离沙箱 | 2秒超时 | 最多200行 | 8表支持
              </Text>
            </View>
            <TextInput
              value={sql}
              onChangeText={setSql}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              onFocus={() => setEditorFocused(true)}
              onBlur={() => setEditorFocused(false)}
              selectionColor="#93C5FD"
              style={styles.editor}
              accessibilityLabel="SQL 查询编辑器"
            />
          </View>

          <Pressable
            disabled={running || evaluating}
            onPress={() => void run()}
            style={({ pressed }) => [
              styles.run,
              pressed && !running && styles.runPressed,
              (running || evaluating) && styles.runDisabled,
            ]}
          >
            {running || evaluating ? (
              <>
                <ActivityIndicator color="white" />
                <Text style={styles.runText}>
                  {running ? "正在隔离执行…" : "EvaluationAgent 正在评测…"}
                </Text>
              </>
            ) : (
              <Text style={styles.runText}>▶ 在安全沙箱中执行 & 触发 BKT 评估</Text>
            )}
          </Pressable>
        </GlassCard>

        {/* Error Alert */}
        {error ? (
          <View
            style={[
              styles.alertCard,
              securityBlocked ? styles.securityCard : styles.errorCard,
            ]}
          >
            <View style={styles.alertHead}>
              <Text style={styles.alertGlyph}>{securityBlocked ? "⛨" : "!"}</Text>
              <Text style={styles.alertTitle}>
                {securityBlocked ? "安全规则已拦截" : "查询未能完成"}
              </Text>
            </View>
            <Text style={styles.alertBody}>
              {securityBlocked ? `此语句触发隔离沙箱安全策略：${error}` : error}
            </Text>
            <Text style={styles.alertHint}>
              允许单条只读查询；ATTACH、PRAGMA、扩展加载与多语句会被拒绝。
            </Text>
          </View>
        ) : null}

        {/* Query Results Table */}
        {result ? (
          <GlassCard>
            <View style={styles.resultHead}>
              <View>
                <Text style={styles.resultTitle}>查询结果集</Text>
                <Text style={styles.resultSub}>执行完成 · {result.sandbox}</Text>
              </View>
              <View style={styles.resultBadges}>
                <Text style={styles.countBadge}>{result.rowCount} 行</Text>
                <Text style={styles.timeBadge}>{result.elapsedMs} ms</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator
              contentContainerStyle={styles.tableScroll}
            >
              <View>
                <View style={styles.row}>
                  {result.columns.map((column) => (
                    <Text key={column} style={[styles.cell, styles.headerCell]}>
                      {column}
                    </Text>
                  ))}
                </View>
                {result.rows.map((row, index) => (
                  <View
                    key={index}
                    style={[styles.row, index % 2 === 1 && styles.stripedRow]}
                  >
                    {row.map((cell, cellIndex) => (
                      <Text key={cellIndex} style={styles.cell}>
                        {String(cell)}
                      </Text>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </GlassCard>
        ) : null}

        {/* Security Footer Note */}
        <View style={styles.securityNote}>
          <Text style={styles.lockGlyph}>⛨</Text>
          <Text style={styles.note}>
            实验库与业务数据库完全隔离。每次执行使用全新内存数据库，超时自动终止。
          </Text>
        </View>

        {/* Evaluation Modal */}
        <BktEvaluationModal
          visible={showEvalModal}
          result={evalResult}
          onClose={() => {
            setShowEvalModal(false);
            if (unlockedBadge) {
              setShowBadgeModal(true);
            }
          }}
        />

        {/* Badge Celebration Modal */}
        <BadgeCelebrationModal
          visible={showBadgeModal}
          badge={unlockedBadge}
          onClose={() => setShowBadgeModal(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.background },
  page: {
    width: "100%",
    maxWidth: 820,
    alignSelf: "center",
    padding: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 15,
  },
  backButton: { alignSelf: "flex-start", paddingVertical: 6, paddingRight: 12 },
  back: { color: "#A5B4FC", fontWeight: "800", fontSize: 13 },
  pressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
  pageTitleBlock: { gap: 4 },
  eyebrow: { color: "#93C5FD", fontWeight: "900", fontSize: 10, letterSpacing: 1.3 },
  title: { color: palette.ink, fontWeight: "900", fontSize: 25 },
  subtitle: { color: palette.muted, lineHeight: 20, fontSize: 12 },

  selectorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionLabel: { color: "#E2E8F0", fontSize: 12, fontWeight: "900" },
  schemaHintButton: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    borderColor: "rgba(99, 102, 241, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  schemaHintText: { color: "#C7D2FE", fontSize: 10, fontWeight: "800" },

  schemaDrawer: {
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.line,
  },
  schemaDrawerTitle: { color: "#93C5FD", fontSize: 10, fontWeight: "900", marginBottom: 6 },
  schemaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  schemaCard: {
    width: "48%",
    backgroundColor: "rgba(2, 6, 23, 0.5)",
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.line,
  },
  schemaTableName: { color: "#CBD5E1", fontSize: 9, fontWeight: "900" },
  schemaCols: { color: "#94A3B8", fontSize: 8, marginTop: 2 },

  categoryRow: { flexDirection: "row", gap: 6, marginBottom: 10 },
  categoryPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    borderWidth: 1,
    borderColor: palette.line,
  },
  categoryPillActive: {
    backgroundColor: "rgba(37, 99, 235, 0.3)",
    borderColor: "#3B82F6",
  },
  categoryText: { color: palette.muted, fontSize: 10, fontWeight: "700" },
  categoryTextActive: { color: "#93C5FD", fontWeight: "900" },

  exerciseList: { gap: 6 },
  exerciseCard: {
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.line,
  },
  exerciseCardSelected: {
    borderColor: "rgba(99, 102, 241, 0.8)",
    backgroundColor: "rgba(49, 46, 129, 0.25)",
  },
  exerciseHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  exerciseTitle: { color: palette.ink, fontSize: 11, fontWeight: "900", flex: 1 },
  diffBadge: { color: "#FBBF24", fontSize: 9, fontWeight: "800" },
  exerciseDesc: { color: palette.muted, fontSize: 9, marginTop: 4, lineHeight: 14 },

  editorHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  activeTitle: { color: palette.ink, fontSize: 13, fontWeight: "900" },
  activeHint: { color: palette.secondaryText, fontSize: 9, marginTop: 2 },
  skeletonButton: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  skeletonButtonText: { color: "#6EE7B7", fontSize: 10, fontWeight: "800" },

  editorFrame: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.24)",
    backgroundColor: "rgba(2, 6, 23, 0.94)",
    overflow: "hidden",
  },
  editorFocused: {
    borderColor: "rgba(59, 130, 246, 0.72)",
    boxShadow: "0px 0px 12px rgba(59, 130, 246, 0.22)",
    elevation: 3,
  },
  editorStatus: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: palette.success },
  editorStatusText: { color: "#94A3B8", fontSize: 9, fontWeight: "700" },
  editor: {
    minHeight: 180,
    padding: 14,
    color: "#BFDBFE",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 20,
    textAlignVertical: "top",
  },

  run: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    flexDirection: "row",
    gap: 9,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0px 3px 9px rgba(59, 130, 246, 0.25)",
    elevation: 3,
  },
  runPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  runDisabled: { opacity: 0.7 },
  runText: { color: "white", fontWeight: "900", fontSize: 12 },

  alertCard: { borderRadius: 16, padding: 14, borderWidth: 1, backgroundColor: "rgba(69, 10, 10, 0.5)" },
  securityCard: { borderColor: "rgba(239, 68, 68, 0.78)" },
  errorCard: { borderColor: "rgba(245, 158, 11, 0.48)" },
  alertHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  alertGlyph: { color: palette.danger, fontWeight: "900", fontSize: 16 },
  alertTitle: { color: "#FCA5A5", fontSize: 12, fontWeight: "900" },
  alertBody: { color: "#FECACA", lineHeight: 18, fontSize: 11, marginTop: 6 },
  alertHint: { color: "#FDA4AF", lineHeight: 16, fontSize: 9, marginTop: 6 },

  resultHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  resultTitle: { color: palette.ink, fontWeight: "900", fontSize: 14 },
  resultSub: { color: palette.muted, fontSize: 9, marginTop: 2 },
  resultBadges: { flexDirection: "row", gap: 6 },
  countBadge: {
    color: "#BFDBFE",
    backgroundColor: "rgba(37, 99, 235, 0.2)",
    borderColor: "rgba(59, 130, 246, 0.35)",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },
  timeBadge: {
    color: "#A7F3D0",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderWidth: 1,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 9,
    fontWeight: "900",
  },
  tableScroll: { paddingBottom: 2 },
  row: { flexDirection: "row" },
  stripedRow: { backgroundColor: "rgba(148, 163, 184, 0.06)" },
  cell: {
    minWidth: 130,
    padding: 9,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.07)",
    color: "#CBD5E1",
    fontSize: 10,
    fontFamily: "monospace",
  },
  headerCell: {
    backgroundColor: "rgba(99, 102, 241, 0.18)",
    color: "#C7D2FE",
    fontWeight: "900",
    borderBottomColor: "rgba(99, 102, 241, 0.4)",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingHorizontal: 4,
  },
  lockGlyph: { color: palette.success, fontSize: 13 },
  note: { flex: 1, color: palette.muted, fontSize: 10, lineHeight: 16 },
});
