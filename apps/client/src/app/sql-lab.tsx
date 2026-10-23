import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { BadgeCelebrationModal, DEFAULT_ACHIEVEMENTS } from "../components/achievement-badges";
import { BktEvaluationModal } from "../components/bkt-evaluation-modal";
import { MiniIcon } from "../components/mini-icon";
import { LoadingPanel, MONO_FONT, PageHeading, ThemedScreen } from "../components/theme-ui";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { evaluateSql, executeSql, getExercises, type EvaluationResult, type SqlExercise } from "../lib/api";
import { useApp } from "../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../state/theme-context";
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
  { name: "orders", desc: "商城订单", cols: "id (PK), student_id, order_date, total_amount, status" },
  { name: "order_item", desc: "订单明细", cols: "id (PK), order_id (FK), product_id (FK), quantity, unit_price" },
];

const CATEGORIES = ["全部", "基础查询", "多表JOIN", "分组聚合", "子查询", "窗口函数"];

function standardSqlFor(exercise: SqlExercise) {
  return exercise.standardSql?.trim() ? exercise.standardSql : exercise.skeletonSql;
}

function challengeSqlFor(exercise: SqlExercise) {
  return exercise.skeletonSql?.trim() ? exercise.skeletonSql : standardSqlFor(exercise);
}

const styleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

function useSqlStyles() {
  const { mode, theme } = useTheme();
  if (!styleCache.has(mode)) styleCache.set(mode, createStyles(theme));
  return styleCache.get(mode)!;
}

export default function SqlLabScreen() {
  const { theme } = useTheme();
  const styles = useSqlStyles();
  const { currentUser } = useApp();
  const width = useHydratedWidth();
  const isWide = width >= 980;
  const [exercises, setExercises] = useState<SqlExercise[]>([defaultExercise]);
  const [selectedExercise, setSelectedExercise] = useState<SqlExercise>(defaultExercise);
  const [selectedCategory, setSelectedCategory] = useState("全部");
  const [sql, setSql] = useState(standardSqlFor(defaultExercise));
  const [challengeMode, setChallengeMode] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [explainResult, setExplainResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [editorFocused, setEditorFocused] = useState(false);
  const [showSchemaHint, setShowSchemaHint] = useState(false);
  const [exercisesLoading, setExercisesLoading] = useState(true);
  const [evalResult, setEvalResult] = useState<EvaluationResult | null>(null);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [unlockedBadge, setUnlockedBadge] = useState<Achievement | null>(null);
  const [showBadgeModal, setShowBadgeModal] = useState(false);

  useEffect(() => {
    void getExercises()
      .then((res) => {
        if (res.exercises && res.exercises.length > 0) {
          const first = res.exercises[0]!;
          setExercises(res.exercises);
          setSelectedExercise(first);
          setSql(standardSqlFor(first));
        }
      })
      .catch(() => {
        // The curated default exercise remains available when the API is unavailable.
      })
      .finally(() => setExercisesLoading(false));
  }, []);

  if (!currentUser) {
    return <ThemedScreen contentContainerStyle={styles.page}>
      <PageHeading title="SQL 实验室" subtitle="校园选课与商城 8 表数据沙箱" />
      <LoadingPanel title="正在加载 SQL 实验室…" detail="正在准备题库与隔离沙箱。" />
    </ThemedScreen>;
  }

  const filteredExercises = (selectedCategory === "全部"
    ? exercises.slice(0, 8)
    : exercises.filter((exercise) => exercise.category === selectedCategory).slice(0, 8));
  const visibleExercises = isWide ? filteredExercises : filteredExercises.slice(0, 6);
  const hasPlaceholder = /_{3,}/.test(sql);
  const securityBlocked = /ATTACH\s+DATABASE|\bPRAGMA\b|extension|multiple statements|多语句|安全拦截|禁止执行/i.test(error);
  const runDisabled = running || evaluating || sql.trim().length === 0;

  const handleSelectExercise = (exercise: SqlExercise) => {
    setSelectedExercise(exercise);
    setSql(standardSqlFor(exercise));
    setChallengeMode(false);
    setError("");
    setResult(null);
    setExplainResult(null);
    setEvalResult(null);
  };
  const fillStandard = () => {
    setSql(standardSqlFor(selectedExercise));
    setChallengeMode(false);
    setError("");
  };
  const toggleChallenge = () => {
    if (challengeMode) {
      fillStandard();
      return;
    }
    setSql(challengeSqlFor(selectedExercise));
    setChallengeMode(true);
    setError("");
    setResult(null);
  };
  const resetSql = () => {
    setSql(standardSqlFor(selectedExercise));
    setChallengeMode(false);
    setError("");
    setResult(null);
    setExplainResult(null);
  };

  const run = async () => {
    if (running || evaluating) return;
    const value = sql.trim();
    if (!value) return;
    if (hasPlaceholder) {
      setError("💡 请先将代码中的 ___ 替换为正确的字段/条件，或点击右上角「填入标准参考 SQL」直接运行查看结果！");
      setResult(null);
      setExplainResult(null);
      return;
    }
    setRunning(true);
    setError("");
    setResult(null);
    setExplainResult(null);
    try {
      const queryResult = await executeSql({ userId: currentUser.id, mode: "query", sql: value });
      setResult(queryResult);
      if (/^\s*select/i.test(value)) {
        void executeSql({ userId: currentUser.id, mode: "query", sql: `EXPLAIN QUERY PLAN ${value}` })
          .then(setExplainResult)
          .catch(() => setExplainResult(null));
      }
      setEvaluating(true);
      try {
        const evaluation = await evaluateSql({
          userId: currentUser.id,
          nodeId: selectedExercise.targetNodeId || "sql-joins",
          correct: queryResult.rowCount > 0,
          sql: value,
        });
        setEvalResult(evaluation.evaluation);
        if (evaluation.evaluation.unlockedBadges?.length) {
          const badge = DEFAULT_ACHIEVEMENTS.find((item) => item.title === evaluation.evaluation.unlockedBadges[0]);
          if (badge) setUnlockedBadge(badge);
        }
      } catch {
        // BKT evaluation is non-blocking; the query result stays usable.
      } finally {
        setEvaluating(false);
      }
    } catch (reason) {
      setResult(null);
      setExplainResult(null);
      setError(reason instanceof Error ? reason.message : "执行失败");
    } finally {
      setRunning(false);
    }
  };

  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading
      title="SQL 实验室"
      subtitle="LeetCode 式左右分栏 · 真实 8 表沙箱 · 执行结果与 BKT 实时反馈"
      right={<Pressable accessibilityRole="button" accessibilityLabel="返回资源库" onPress={() => router.push("/(tabs)/resources")} style={({ pressed }) => [styles.backPill, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
        <Text style={[styles.backText, { color: theme.textSecondary }]}>← 返回资源库</Text>
      </Pressable>}
    />

    <View style={[styles.workspace, isWide && styles.workspaceWide]}>
      <View style={styles.leftPanel}>
        <View style={[styles.panel, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
          <View style={styles.panelHead}>
            <View>
              <Text style={[styles.panelKicker, { color: theme.accentHover }]}>PROBLEM BANK · 200+</Text>
              <Text style={[styles.panelTitle, { color: theme.textPrimary }]}>题库与表结构</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showSchemaHint ? "收起 8 表结构" : "查看 8 表结构"}
              accessibilityState={{ expanded: showSchemaHint }}
              onPress={() => setShowSchemaHint((value) => !value)}
              style={({ pressed }) => [styles.schemaButton, { borderColor: showSchemaHint ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: showSchemaHint ? theme.accentSoft : theme.bgElevated }, pressed && styles.pressed]}
            >
              <Text style={[styles.schemaButtonText, { color: showSchemaHint ? theme.accentPrimary : theme.textSecondary }]}>8 表 Schema {showSchemaHint ? "▴" : "▾"}</Text>
            </Pressable>
          </View>

          {showSchemaHint ? <View style={[styles.schemaDrawer, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }]}>
            <View style={styles.schemaGrid}>
              {TABLE_SCHEMAS.map((table) => <View key={table.name} style={[styles.schemaCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
                <Text style={[styles.schemaName, { color: theme.accentPrimary }]}>{table.name}</Text>
                <Text style={[styles.schemaCols, { color: theme.textSecondary }]}>{table.cols}</Text>
              </View>)}
            </View>
          </View> : null}

          <View style={styles.categoryWrap}>
            {CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return <Pressable key={category} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => setSelectedCategory(category)} style={({ pressed }) => [styles.categoryPill, { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : theme.bgElevated }, pressed && styles.pressed]}>
                <Text style={[styles.categoryText, { color: active ? theme.accentPrimary : theme.textSecondary }]}>{category}</Text>
              </Pressable>;
            })}
          </View>

          {exercisesLoading ? <View style={styles.loadingRow}><ActivityIndicator size="small" color={theme.accentPrimary} /><Text style={[styles.loadingText, { color: theme.textSecondary }]}>正在同步题库…</Text></View> : <View style={styles.exerciseList}>
            {visibleExercises.map((exercise) => {
              const active = exercise.id === selectedExercise.id;
              return <Pressable
                key={exercise.id}
                accessibilityRole="button"
                accessibilityLabel={`选择题库：${exercise.title}，难度 ${exercise.difficulty}/5`}
                accessibilityState={{ selected: active }}
                onPress={() => handleSelectExercise(exercise)}
                style={({ pressed }) => [styles.exerciseCard, { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : theme.bgElevated }, pressed && styles.pressed]}
              >
                <View style={styles.exerciseHead}>
                  <Text style={[styles.exerciseTitle, { color: active ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>{exercise.title}</Text>
                  <Text style={[styles.difficulty, { color: active ? theme.accentPrimary : theme.textMuted }]}>L{exercise.difficulty}</Text>
                </View>
                <Text style={[styles.exerciseDesc, { color: active ? theme.textSecondary : theme.textMuted }]} numberOfLines={1}>{exercise.category} · {exercise.description}</Text>
              </Pressable>;
            })}
          </View>}

          <View style={[styles.requirement, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }]}>
            <Text style={[styles.requirementKicker, { color: theme.textMuted }]}>CURRENT EXERCISE</Text>
            <Text style={[styles.requirementTitle, { color: theme.textPrimary }]}>{selectedExercise.title}</Text>
            <Text style={[styles.requirementDesc, { color: theme.textSecondary }]}>{selectedExercise.description}</Text>
            <View style={styles.requirementMeta}>
              <View style={[styles.targetBadge, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.targetBadgeText, { color: theme.accentPrimary }]}>节点 {selectedExercise.targetNodeId || "sql-joins"}</Text></View>
              <Text style={[styles.schemaHint, { color: theme.textMuted }]} numberOfLines={2}>{selectedExercise.schemaHint}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.rightPanel}>
        <View style={[styles.editorWindow, { borderColor: theme.code.border }, editorFocused && { borderColor: theme.accentPrimary }]}>
          <View style={styles.editorTop}>
            <View style={styles.traffic}><View style={[styles.trafficDot, { backgroundColor: "#FF5F56" }]} /><View style={[styles.trafficDot, { backgroundColor: "#FFBD2E" }]} /><View style={[styles.trafficDot, { backgroundColor: "#27C93F" }]} /></View>
            <Text style={styles.editorTitle}>sql_editor.zsh — read-only sandbox</Text>
            <Text style={styles.editorMeta}>8 tables · 2s timeout</Text>
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
            selectionColor={theme.accentPrimary}
            accessibilityLabel="SQL 查询编辑器"
            style={styles.editorInput}
          />
        </View>

        <View style={styles.toolRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="填入标准参考 SQL" onPress={fillStandard} style={({ pressed }) => [styles.toolButton, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
            <Text style={[styles.toolText, { color: theme.accentPrimary }]}>✨ 填入标准参考 SQL</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={challengeMode ? "退出填空挑战模式" : "切换填空挑战模式"} onPress={toggleChallenge} style={({ pressed }) => [styles.toolButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
            <Text style={[styles.toolText, { color: theme.textSecondary }]}>{challengeMode ? "🧩 退出填空挑战" : "🧩 切换填空挑战"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="重置代码" onPress={resetSql} style={({ pressed }) => [styles.toolButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
            <Text style={[styles.toolText, { color: theme.textSecondary }]}>↺ 重置代码</Text>
          </Pressable>
        </View>

        {hasPlaceholder ? <View style={[styles.placeholderWarning, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }]}>
          <Text style={[styles.placeholderTitle, { color: theme.warning }]}>💡 还有 ___ 占位符</Text>
          <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>先替换为正确的字段/条件；或点击「填入标准参考 SQL」直接运行查看结果。</Text>
        </View> : null}

        <Pressable
          disabled={runDisabled}
          accessibilityRole="button"
          accessibilityLabel="在安全沙箱中执行 SQL 并触发 BKT 评估"
          accessibilityState={{ disabled: runDisabled, busy: running || evaluating }}
          onPress={() => void run()}
          style={({ pressed }) => [styles.runButton, { backgroundColor: theme.accentPrimary }, pressed && !runDisabled && styles.pressed, runDisabled && styles.disabled]}
        >
          {running || evaluating ? <ActivityIndicator size="small" color={theme.onAccent} /> : <Text style={[styles.runGlyph, { color: theme.onAccent }]}>▶</Text>}
          <Text style={[styles.runText, { color: theme.onAccent }]}>{running ? "正在隔离执行…" : evaluating ? "EvaluationAgent 正在评估…" : "在安全沙箱中执行 & 触发 BKT 评估"}</Text>
        </Pressable>

        {error ? <View style={[styles.errorCard, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }]}>
          <View style={styles.errorHead}><MiniIcon name="alert" size={13} color={theme.warning} /><Text style={[styles.errorTitle, { color: theme.warning }]}>{securityBlocked ? "安全规则已拦截" : "执行提示"}</Text></View>
          <Text style={[styles.errorBody, { color: theme.textSecondary }]}>{error}</Text>
          <Text style={[styles.errorHint, { color: theme.textMuted }]}>允许单条只读查询；ATTACH、PRAGMA、扩展加载与多语句会被拒绝。</Text>
        </View> : null}

        <View style={styles.outputRow}>
          <View style={[styles.outputCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
            <View style={styles.outputHead}>
              <Text style={[styles.outputTitle, { color: theme.textPrimary }]}>查询结果</Text>
              <Text style={[styles.outputMeta, { color: theme.success }]}>{result ? `${result.rowCount} 行 · ${result.elapsedMs} ms` : "等待执行"}</Text>
            </View>
            {result ? result.rows.length === 0 ? <Text style={[styles.emptyResult, { color: theme.textMuted }]}>查询成功，但没有返回数据。尝试放宽 WHERE 条件。</Text> : <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
              <View>
                <View style={[styles.tableRow, { backgroundColor: theme.bgElevated }]}>
                  <Text style={[styles.rowNumber, styles.headerCell, { color: theme.textMuted }]}>#</Text>
                  {result.columns.map((column) => <Text key={column} style={[styles.tableCell, styles.headerCell, { color: theme.textSecondary }]}>{column}</Text>)}
                </View>
                {result.rows.slice(0, 12).map((row, rowIndex) => <View key={rowIndex} style={[styles.tableRow, rowIndex % 2 === 1 && { backgroundColor: theme.bgElevated }]}>
                  <Text style={[styles.rowNumber, { color: theme.textMuted }]}>{rowIndex + 1}</Text>
                  {row.map((cell, cellIndex) => <Text key={cellIndex} style={[styles.tableCell, { color: theme.textPrimary }]}>{String(cell)}</Text>)}
                </View>)}
              </View>
            </ScrollView> : <View style={styles.emptyResultBox}><MiniIcon name="terminal" size={15} color={theme.textMuted} /><Text style={[styles.emptyResult, { color: theme.textMuted }]}>填写并执行一条完整 SQL，右侧会渲染真实结果表。</Text></View>}
          </View>

          <View style={[styles.outputCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
            <View style={styles.outputHead}>
              <Text style={[styles.outputTitle, { color: theme.textPrimary }]}>EXPLAIN PLAN</Text>
              <Text style={[styles.outputMeta, { color: theme.textMuted }]}>{explainResult ? `${explainResult.rows.length} 步` : "执行查询后生成"}</Text>
            </View>
            {explainResult ? <View style={styles.explainList}>
              {explainResult.rows.slice(0, 6).map((row, index) => <View key={index} style={[styles.explainRow, { borderColor: theme.borderDivider }]}>
                <Text style={[styles.explainIndex, { color: theme.accentPrimary }]}>{String(row[0] ?? index + 1)}</Text>
                <Text style={[styles.explainText, { color: theme.textSecondary }]} numberOfLines={2}>{String(row[row.length - 1] ?? row.join(" · "))}</Text>
              </View>)}
            </View> : <Text style={[styles.emptyResult, { color: theme.textMuted }]}>对 SELECT 查询自动运行 EXPLAIN QUERY PLAN。</Text>}
          </View>
        </View>

        {evalResult ? <View style={[styles.bktCard, { borderColor: `${theme.success}33`, backgroundColor: theme.successSoft }]}>
          <View style={styles.bktTop}>
            <View><Text style={[styles.bktKicker, { color: theme.success }]}>EVALUATIONAGENT · BKT</Text><Text style={[styles.bktTitle, { color: theme.textPrimary }]}>{evalResult.conceptTitle}</Text></View>
            <Text style={[styles.bktDelta, { color: evalResult.delta >= 0 ? theme.success : theme.warning }]}>{evalResult.delta >= 0 ? "+" : ""}{evalResult.delta}%</Text>
          </View>
          <View style={styles.bktTrack}><View style={[styles.bktFill, { width: `${Math.max(0, Math.min(100, evalResult.newMastery))}%`, backgroundColor: theme.success }]} /></View>
          <View style={styles.bktFoot}>
            <Text style={[styles.bktMeta, { color: theme.textSecondary }]}>掌握度 {evalResult.prevMastery}% → {evalResult.newMastery}%</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="查看 BKT 评估细节" onPress={() => setShowEvalModal(true)} style={({ pressed }) => [styles.bktLink, { borderColor: `${theme.success}44`, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
              <Text style={[styles.bktLinkText, { color: theme.success }]}>查看评估细节 →</Text>
            </Pressable>
          </View>
        </View> : null}

        <View style={[styles.securityNote, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }]}>
          <MiniIcon name="shield" size={12} color={theme.textMuted} />
          <Text style={[styles.securityText, { color: theme.textMuted }]}>实验库与业务数据库完全隔离；每次执行使用全新内存数据库，超时自动终止。</Text>
        </View>
      </View>
    </View>

    <BktEvaluationModal visible={showEvalModal} result={evalResult} onClose={() => { setShowEvalModal(false); if (unlockedBadge) setShowBadgeModal(true); }} />
    <BadgeCelebrationModal visible={showBadgeModal} badge={unlockedBadge} onClose={() => setShowBadgeModal(false)} />
  </ThemedScreen>;
}

function createStyles(theme: ThemeTokens) {
  const windowShadow = theme.isDark
    ? theme.code.shadow
    : "0 18px 36px -22px rgba(41, 37, 36, 0.22), 0 2px 6px rgba(41, 37, 36, 0.04)";
  const cardShadow = theme.isDark
    ? "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 16px 40px -22px rgba(0, 0, 0, 0.78)"
    : "0 10px 28px -16px rgba(41, 37, 36, 0.10), 0 1px 3px rgba(41, 37, 36, 0.04)";
  return StyleSheet.create({
    page: { paddingTop: 24, paddingBottom: 64, paddingHorizontal: 18, maxWidth: 1360, width: "100%", alignSelf: "center", gap: 16 },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    disabled: { opacity: 0.55 },
    backPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 },
    backText: { fontSize: 12.5, fontWeight: "700" },
    workspace: { width: "100%", gap: 14, flexDirection: "column" },
    workspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: 18 },
    leftPanel: { flex: 38, minWidth: 0 },
    rightPanel: { flex: 62, minWidth: 0, gap: 11 },
    panel: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 11, boxShadow: cardShadow },
    panelHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    panelKicker: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    panelTitle: { fontSize: 22, fontWeight: "800", letterSpacing: -0.4, marginTop: 2 },
    schemaButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
    schemaButtonText: { fontSize: 12.5, fontWeight: "800" },
    schemaDrawer: { borderRadius: 10, borderWidth: 1, padding: 9 },
    schemaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    schemaCard: { flexBasis: "47%", flexGrow: 1, minWidth: 150, borderRadius: 7, borderWidth: 1, padding: 8, gap: 3 },
    schemaName: { fontSize: 12.5, fontWeight: "800", fontFamily: MONO_FONT },
    schemaCols: { fontSize: 11, lineHeight: 16, fontFamily: MONO_FONT },
    categoryWrap: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    categoryPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
    categoryText: { fontSize: 13, fontWeight: "700" },
    exerciseList: { gap: 6 },
    exerciseCard: { borderRadius: 9, borderWidth: 1, padding: 10, gap: 3 },
    exerciseHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    exerciseTitle: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: "800" },
    difficulty: { fontSize: 11.5, fontFamily: MONO_FONT, fontWeight: "800" },
    exerciseDesc: { fontSize: 12, lineHeight: 17 },
    loadingRow: { flexDirection: "row", alignItems: "center", gap: 7, padding: 12 },
    loadingText: { fontSize: 13 },
    requirement: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 5 },
    requirementKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    requirementTitle: { fontSize: 16, fontWeight: "800" },
    requirementDesc: { fontSize: 13, lineHeight: 19 },
    requirementMeta: { gap: 5, marginTop: 3 },
    targetBadge: { alignSelf: "flex-start", borderRadius: 5, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
    targetBadgeText: { fontSize: 11, fontWeight: "800", fontFamily: MONO_FONT },
    schemaHint: { fontSize: 11.5, lineHeight: 16, fontFamily: MONO_FONT },

    // Warm parchment studio window: identical chrome in every light theme.
    editorWindow: { borderRadius: 14, borderWidth: 1, backgroundColor: theme.code.bg, overflow: "hidden", boxShadow: windowShadow },
    editorTop: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: theme.code.headerBg, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder },
    traffic: { flexDirection: "row", gap: 5 },
    trafficDot: { width: 8, height: 8, borderRadius: 4 },
    editorTitle: { color: theme.code.title, fontSize: 11.5, fontFamily: MONO_FONT, flex: 1 },
    editorMeta: { color: theme.code.muted, fontSize: 10.5, fontFamily: MONO_FONT },
    editorInput: { minHeight: 190, color: theme.code.text, backgroundColor: theme.code.inputBg, paddingHorizontal: 14, paddingVertical: 12, fontSize: 13.5, lineHeight: 22, fontFamily: MONO_FONT, textAlignVertical: "top" },
    toolRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
    toolButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 8 },
    toolText: { fontSize: 13, fontWeight: "700" },
    placeholderWarning: { borderRadius: 9, borderWidth: 1, padding: 10, gap: 3 },
    placeholderTitle: { fontSize: 13, fontWeight: "800" },
    placeholderText: { fontSize: 13, lineHeight: 19 },
    runButton: { minHeight: 47, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 14 },
    runGlyph: { fontSize: 13 },
    runText: { fontSize: 14, fontWeight: "800" },
    errorCard: { borderRadius: 10, borderWidth: 1, padding: 11, gap: 4 },
    errorHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    errorTitle: { fontSize: 13, fontWeight: "800" },
    errorBody: { fontSize: 13, lineHeight: 19 },
    errorHint: { fontSize: 12, lineHeight: 17 },
    outputRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    outputCard: { flexBasis: "48%", flexGrow: 1, minWidth: 240, borderRadius: 12, borderWidth: 1, padding: 11, gap: 7 },
    outputHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    outputTitle: { fontSize: 14, fontWeight: "800" },
    outputMeta: { fontSize: 11.5, fontFamily: MONO_FONT, fontWeight: "700" },
    tableScroll: { paddingBottom: 2 },
    tableRow: { flexDirection: "row", alignItems: "center", minHeight: 26 },
    rowNumber: { width: 24, fontSize: 11, fontFamily: MONO_FONT, paddingHorizontal: 3 },
    tableCell: { minWidth: 84, fontSize: 12, fontFamily: MONO_FONT, paddingHorizontal: 7, paddingVertical: 5 },
    headerCell: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
    emptyResultBox: { minHeight: 84, alignItems: "center", justifyContent: "center", gap: 5 },
    emptyResult: { fontSize: 12.5, lineHeight: 19 },
    explainList: { gap: 4 },
    explainRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderBottomWidth: 1, paddingVertical: 5 },
    explainIndex: { width: 18, fontSize: 11, fontWeight: "800", fontFamily: MONO_FONT },
    explainText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: MONO_FONT },
    bktCard: { borderRadius: 11, borderWidth: 1, padding: 11, gap: 6 },
    bktTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    bktKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.4, fontFamily: MONO_FONT },
    bktTitle: { fontSize: 15, fontWeight: "800", marginTop: 1 },
    bktDelta: { fontSize: 20, fontWeight: "900", fontFamily: MONO_FONT },
    bktTrack: { height: 7, borderRadius: 99, backgroundColor: theme.bgSurface, overflow: "hidden" },
    bktFill: { height: "100%", borderRadius: 99 },
    bktFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    bktMeta: { fontSize: 12, fontFamily: MONO_FONT },
    bktLink: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
    bktLinkText: { fontSize: 12, fontWeight: "800" },
    securityNote: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 9, borderWidth: 1, padding: 9 },
    securityText: { flex: 1, fontSize: 12, lineHeight: 17 },
  });
}
