import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { executeSql } from "../lib/api";
import {
  conceptColumnsForNode,
  definitionForNode,
  exampleForNode,
  factsForNode,
  flashcardsForNode,
  pitfallForNode,
  quizzesForNode,
  sqlLessonForNode,
  summaryForNode,
  type LearningType,
} from "../lib/learning-content";
import { TOPOLOGY_NODES, nodeById, type TopologyNode } from "../lib/path-topology";
import { useApp } from "../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../state/theme-context";
import { MiniIcon } from "./mini-icon";
import { MONO_FONT, webOnly } from "./theme-ui";

type SqlResult = Awaited<ReturnType<typeof executeSql>>;

function FlashcardReader({ node, compact }: { node: TopologyNode; compact: boolean }) {
  const { theme } = useTheme();
  const styles = useReaderStyles();
  const deck = flashcardsForNode(node);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [remembered, setRemembered] = useState<Set<number>>(() => new Set());
  const item = deck[index]!;
  const isRemembered = remembered.has(index);

  const move = (nextIndex: number) => {
    setIndex((nextIndex + deck.length) % deck.length);
    setFlipped(false);
  };
  const remember = () => {
    setRemembered((current) => {
      const next = new Set(current);
      next.add(index);
      return next;
    });
    if (index < deck.length - 1) move(index + 1);
  };

  return <View style={styles.reader}>
    <View style={styles.readerHead}>
      <View>
        <Text style={styles.readerKicker}>3D FLASHCARDS · ACTIVE RECALL</Text>
        <Text style={styles.readerTitle}>正反面记忆闪卡</Text>
      </View>
      <View style={[styles.readerPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
        <Text style={[styles.readerPillText, { color: theme.accentPrimary }]}>Card {index + 1} / {deck.length}</Text>
      </View>
    </View>

    <View style={[styles.flashStage, { height: compact ? 270 : 305 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={flipped ? "翻转闪卡，查看正面问题" : "翻转闪卡，查看背面答案"}
        onPress={() => setFlipped((value) => !value)}
        style={({ pressed }) => [
          styles.flashCard,
          { borderColor: flipped ? theme.successSoft : theme.accentSoftBorder, backgroundColor: flipped ? theme.successSoft : theme.accentSoft },
          { transform: [{ perspective: 900 }, { rotateY: flipped ? "180deg" : "0deg" }] },
          webOnly({ transformStyle: "preserve-3d", transitionProperty: "transform", transitionDuration: "560ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }),
          pressed && styles.pressed,
        ]}
      >
        <View style={[styles.flashFace, webOnly({ backfaceVisibility: "hidden" })]}>
          <View style={styles.flashFaceTop}>
            <Text style={[styles.flashKind, { color: theme.accentPrimary }]}>{item.kind}</Text>
            <Text style={styles.flashHint}>点击卡片翻面 ↻</Text>
          </View>
          <Text style={[styles.flashFrontText, { color: theme.textPrimary }]}>{item.front}</Text>
          <Text style={[styles.flashFooterHint, { color: theme.textSecondary }]}>{item.hint}</Text>
        </View>
        <View style={[styles.flashFace, styles.flashBackFace, { backgroundColor: theme.successSoft }, webOnly({ backfaceVisibility: "hidden", transform: [{ rotateY: "180deg" }] })]}>
          <View style={styles.flashFaceTop}>
            <Text style={[styles.flashKind, { color: theme.success }]}>{item.kind} · 核对答案</Text>
            <Text style={styles.flashHint}>点击返回正面 ↺</Text>
          </View>
          <Text style={[styles.flashBackText, { color: theme.textPrimary }]}>{item.back}</Text>
          <View style={styles.flashBackFooter}>
            <MiniIcon name="check" size={13} color={theme.success} />
            <Text style={[styles.flashBackFooterText, { color: theme.success }]}>用自己的话复述一遍，再进入下一张</Text>
          </View>
        </View>
      </Pressable>
    </View>

    <View style={styles.flashControls}>
      <Pressable accessibilityRole="button" accessibilityLabel="上一张闪卡" onPress={() => move(index - 1)} style={({ pressed }) => [styles.smallButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
        <Text style={[styles.smallButtonText, { color: theme.textSecondary }]}>← 上一张</Text>
      </Pressable>
      <View style={[styles.rememberPill, { backgroundColor: isRemembered ? theme.successSoft : theme.bgElevated, borderColor: isRemembered ? `${theme.success}44` : theme.borderSubtle }]}>
        <Text style={[styles.rememberText, { color: isRemembered ? theme.success : theme.textMuted }]}>已记住 {remembered.size} / {deck.length}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="下一张闪卡" onPress={() => move(index + 1)} style={({ pressed }) => [styles.smallButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
        <Text style={[styles.smallButtonText, { color: theme.textSecondary }]}>下一张 →</Text>
      </Pressable>
    </View>
    <View style={styles.flashRatingRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="再记一次这张闪卡" onPress={() => setFlipped(false)} style={({ pressed }) => [styles.ratingButton, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
        <Text style={[styles.ratingButtonText, { color: theme.textSecondary }]}>↺ 再记一次</Text>
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="已记住这张闪卡" onPress={remember} style={({ pressed }) => [styles.ratingButton, styles.ratingButtonPrimary, { backgroundColor: theme.success, borderColor: theme.success }, pressed && styles.pressed]}>
        <Text style={[styles.ratingButtonText, { color: theme.isDark ? "#06201C" : "#FFFFFF" }]}>已记住 ✓</Text>
      </Pressable>
    </View>
  </View>;
}

function QuizReader({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useReaderStyles();
  const quizzes = quizzesForNode(node);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const quiz = quizzes[index]!;
  const answered = choice !== null;
  const correct = choice === quiz.correct;

  const choose = (optionIndex: number) => {
    if (answered) return;
    setChoice(optionIndex);
    if (optionIndex === quiz.correct) setCorrectCount((count) => count + 1);
  };
  const next = () => {
    setChoice(null);
    setIndex((value) => (value + 1) % quizzes.length);
  };

  return <View style={styles.reader}>
    <View style={styles.readerHead}>
      <View>
        <Text style={styles.readerKicker}>ADAPTIVE QUIZ · INSTANT FEEDBACK</Text>
        <Text style={styles.readerTitle}>当场作答 · 即时判分</Text>
      </View>
      <View style={[styles.readerPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
        <Text style={[styles.readerPillText, { color: theme.accentPrimary }]}>Q {index + 1} / {quizzes.length} · 正确 {correctCount}</Text>
      </View>
    </View>

    <View style={[styles.quizCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.quizTop}>
        <View style={[styles.quizTag, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
          <Text style={[styles.quizTagText, { color: theme.accentPrimary }]}>{quiz.tag}</Text>
        </View>
        <Text style={styles.quizNode} numberOfLines={1}>{node.title}</Text>
      </View>
      <Text style={[styles.quizQuestion, { color: theme.textPrimary }]}>{quiz.question}</Text>
      <View style={styles.quizOptions}>
        {quiz.options.map((option, optionIndex) => {
          const isCorrect = optionIndex === quiz.correct;
          const isChosen = choice === optionIndex;
          const state = !answered ? "default" : isCorrect ? "correct" : isChosen ? "wrong" : "muted";
          return <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityLabel={`选项 ${String.fromCharCode(65 + optionIndex)}：${option}`}
            accessibilityState={{ selected: isChosen }}
            onPress={() => choose(optionIndex)}
            disabled={answered}
            style={({ pressed }) => [
              styles.quizOption,
              {
                borderColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.borderSubtle,
                backgroundColor: state === "correct" ? theme.successSoft : state === "wrong" ? theme.warningSoft : theme.bgSurface,
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.quizOptionMark, {
              backgroundColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.bgElevated,
              borderColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.borderSubtle,
            }]}>
              <Text style={[styles.quizOptionMarkText, { color: state === "correct" || state === "wrong" ? (theme.isDark ? "#071018" : "#FFFFFF") : theme.textSecondary }]}>{state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + optionIndex)}</Text>
            </View>
            <Text style={[styles.quizOptionText, { color: theme.textPrimary }]}>{option}</Text>
          </Pressable>;
        })}
      </View>
      {answered ? <View style={[styles.quizFeedback, { backgroundColor: correct ? theme.successSoft : theme.warningSoft, borderColor: correct ? `${theme.success}44` : `${theme.warning}44` }]}>
        <Text style={[styles.quizFeedbackTitle, { color: correct ? theme.success : theme.warning }]}>{correct ? "✓ 回答正确" : "✕ 再想一步"}</Text>
        <Text style={[styles.quizFeedbackText, { color: theme.textSecondary }]}>{quiz.explanation}</Text>
      </View> : null}
      <View style={styles.quizFooter}>
        <Text style={[styles.quizProgress, { color: theme.textMuted }]}>{answered ? "已判分 · 可继续下一题" : "选择一个选项，立即查看错因解析"}</Text>
        {answered ? <Pressable accessibilityRole="button" accessibilityLabel="下一道题" onPress={next} style={({ pressed }) => [styles.quizNext, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed]}>
          <Text style={[styles.quizNextText, { color: theme.onAccent }]}>下一题 →</Text>
        </Pressable> : null}
      </View>
    </View>
    <Text style={[styles.quizHint, { color: theme.textSecondary }]}>答错不是扣分，而是定位断点：先找出错误选项对应的概念混淆，再回到闪卡核对。</Text>
  </View>;
}

function DocumentReader({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useReaderStyles();
  const cards = [
    { step: "01", title: "核心定义", body: definitionForNode(node), extra: summaryForNode(node) },
    { step: "02", title: "真实正例 / 典型反例", body: exampleForNode(node), extra: pitfallForNode(node), warn: true },
    { step: "03", title: "高频易错", body: pitfallForNode(node), extra: factsForNode(node)[1] ?? summaryForNode(node) },
  ];
  return <View style={styles.reader}>
    <View style={styles.readerHead}>
      <View>
        <Text style={styles.readerKicker}>STRUCTURED NOTE · TEACHABLE CARD</Text>
        <Text style={styles.readerTitle}>三段式精讲</Text>
      </View>
      <View style={[styles.readerPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.readerPillText, { color: theme.accentPrimary }]}>READ · 3 MIN</Text></View>
    </View>
    {cards.map((card) => <View key={card.step} style={[styles.docCard, { borderColor: card.warn ? `${theme.warning}33` : theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.docCardHead}>
        <View style={[styles.docStep, { backgroundColor: card.warn ? theme.warningSoft : theme.accentSoft, borderColor: card.warn ? `${theme.warning}44` : theme.accentSoftBorder }]}>
          <Text style={[styles.docStepText, { color: card.warn ? theme.warning : theme.accentPrimary }]}>{card.step}</Text>
        </View>
        <Text style={[styles.docTitle, { color: theme.textPrimary }]}>{card.title}</Text>
      </View>
      <Text style={[styles.docBody, { color: theme.textSecondary }]}>{card.body}</Text>
      <View style={[styles.docExtra, { backgroundColor: card.warn ? theme.warningSoft : theme.bgElevated, borderColor: card.warn ? `${theme.warning}33` : theme.borderDivider }]}>
        <Text style={[styles.docExtraText, { color: card.warn ? theme.warning : theme.textSecondary }]}>{card.extra}</Text>
      </View>
    </View>)}
  </View>;
}

function DiagramReader({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useReaderStyles();
  const [step, setStep] = useState(1);
  const { definition, example, pitfall } = conceptColumnsForNode(node);
  const titlesOf = (ids: string[]) => ids.map((id) => nodeById(TOPOLOGY_NODES, id)?.title ?? id).join(" · ");
  const steps = [
    { title: "核心定义", label: node.title, body: definition, color: theme.accentPrimary },
    { title: "真实正例", label: "可验证的正例", body: example, color: theme.success },
    { title: "典型反例", label: "必须避开的反例", body: pitfall, color: theme.warning },
  ];
  return <View style={styles.reader}>
    <View style={styles.readerHead}>
      <View>
        <Text style={styles.readerKicker}>CONCEPT MAP · STEP REASONER</Text>
        <Text style={styles.readerTitle}>概念依赖与推演</Text>
      </View>
      <View style={[styles.readerPill, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}><Text style={[styles.readerPillText, { color: theme.agent }]}>STEP {step + 1} / 3</Text></View>
    </View>
    <View style={styles.graphRow}>
      {steps.map((item, index) => <View key={item.title} style={styles.graphStepWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`查看推演步骤：${item.title}`}
          onPress={() => setStep(index)}
          style={({ pressed }) => [styles.graphStep, {
            borderColor: step === index ? `${item.color}66` : theme.borderSubtle,
            backgroundColor: step === index ? (index === 2 ? theme.successSoft : theme.accentSoft) : theme.bgSurface,
          }, pressed && styles.pressed]}
        >
          <View style={[styles.graphDot, { backgroundColor: item.color }]} />
          <Text style={[styles.graphStepLabel, { color: step === index ? item.color : theme.textMuted }]}>{index + 1}</Text>
          <Text style={[styles.graphStepTitle, { color: step === index ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>{item.title}</Text>
        </Pressable>
        {index < steps.length - 1 ? <Text style={[styles.graphArrow, { color: theme.textMuted }]}>→</Text> : null}
      </View>)}
    </View>
    <View style={[styles.graphDetail, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <Text style={[styles.graphDetailLabel, { color: steps[step]!.color }]}>{steps[step]!.title}</Text>
      <Text style={[styles.graphDetailTitle, { color: theme.textPrimary }]}>{steps[step]!.label}</Text>
      <Text style={[styles.graphDetailBody, { color: theme.textSecondary }]}>{steps[step]!.body}</Text>
      <View style={styles.graphControls}>
        <Text style={[styles.graphHint, { color: theme.textMuted }]}>点击上方节点切换推演步骤</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="推演下一步" onPress={() => setStep((value) => (value + 1) % steps.length)} style={({ pressed }) => [styles.graphNext, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
          <Text style={[styles.graphNextText, { color: theme.accentPrimary }]}>推演下一步 →</Text>
        </Pressable>
      </View>
    </View>
    <View style={[styles.graphTopology, { backgroundColor: theme.bgElevated, borderColor: theme.borderDivider }]}>
      <View style={[styles.graphTopoChip, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
        <Text style={[styles.graphTopoKey, { color: theme.textMuted }]}>先修</Text>
        <Text style={[styles.graphTopoText, { color: theme.textSecondary }]} numberOfLines={2}>{node.prereqs.length > 0 ? titlesOf(node.prereqs) : "根节点"}</Text>
      </View>
      <Text style={[styles.graphTopoArrow, { color: theme.textMuted }]}>→</Text>
      <View style={[styles.graphTopoChip, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
        <Text style={[styles.graphTopoKey, { color: theme.accentPrimary }]}>当前</Text>
        <Text style={[styles.graphTopoText, { color: theme.textPrimary }]} numberOfLines={2}>{node.title}</Text>
      </View>
      <Text style={[styles.graphTopoArrow, { color: theme.textMuted }]}>→</Text>
      <View style={[styles.graphTopoChip, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
        <Text style={[styles.graphTopoKey, { color: theme.textMuted }]}>解锁</Text>
        <Text style={[styles.graphTopoText, { color: theme.textSecondary }]} numberOfLines={2}>{node.next.length > 0 ? titlesOf(node.next) : "课程终点"}</Text>
      </View>
    </View>
  </View>;
}

function SqlReader({ node }: { node: TopologyNode }) {
  const { theme } = useTheme();
  const styles = useReaderStyles();
  const { currentUser } = useApp();
  const lesson = sqlLessonForNode(node);
  const [result, setResult] = useState<SqlResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!currentUser || loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await executeSql({ userId: currentUser.id, mode: "query", sql: lesson.sql }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "查询执行失败");
    } finally {
      setLoading(false);
    }
  };

  return <View style={styles.reader}>
    <View style={styles.readerHead}>
      <View>
        <Text style={styles.readerKicker}>RUNNABLE SQL · LIVE RESULT</Text>
        <Text style={styles.readerTitle}>{lesson.title}</Text>
      </View>
      <View style={[styles.readerPill, { backgroundColor: theme.successSoft, borderColor: `${theme.success}33` }]}><Text style={[styles.readerPillText, { color: theme.success }]}>8 表沙箱</Text></View>
    </View>
    <View style={styles.sqlWindow}>
      <View style={styles.sqlWindowTop}>
        <View style={styles.traffic}><View style={[styles.trafficDot, { backgroundColor: "#FF5F56" }]} /><View style={[styles.trafficDot, { backgroundColor: "#FFBD2E" }]} /><View style={[styles.trafficDot, { backgroundColor: "#27C93F" }]} /></View>
        <Text style={styles.sqlWindowTitle}>lesson.sql</Text>
        <Text style={styles.sqlWindowMeta}>read-only</Text>
      </View>
      <Text selectable style={styles.sqlCode}>{lesson.sql}</Text>
      <View style={styles.sqlWindowFoot}>
        <Text style={styles.sqlSafe}>✓ 无占位符 · 完整可执行</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="运行当前 SQL 示例" disabled={loading || !currentUser} onPress={() => void run()} style={({ pressed }) => [styles.sqlRun, { backgroundColor: theme.success }, pressed && styles.pressed, (loading || !currentUser) && styles.disabled]}>
          {loading ? <ActivityIndicator size="small" color={theme.isDark ? "#06201C" : "#FFFFFF"} /> : <Text style={styles.sqlRunGlyph}>▶</Text>}
          <Text style={[styles.sqlRunText, { color: theme.isDark ? "#06201C" : "#FFFFFF" }]}>{loading ? "执行中…" : "运行 SQL"}</Text>
        </Pressable>
      </View>
    </View>
    <Text style={[styles.sqlNote, { color: theme.textSecondary }]}>{lesson.note}</Text>
    {error ? <View style={[styles.sqlError, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}><Text style={[styles.sqlErrorText, { color: theme.warning }]}>! {error}</Text></View> : null}
    {result ? <View style={[styles.resultCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.resultTop}><Text style={[styles.resultTitle, { color: theme.textPrimary }]}>执行结果</Text><Text style={[styles.resultMeta, { color: theme.success }]}>{result.rowCount} 行 · {result.elapsedMs} ms</Text></View>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.tableScroll}>
        <View>
          <View style={[styles.tableRow, { backgroundColor: theme.bgElevated }]}>
            <Text style={[styles.rowNumber, styles.headerText, { color: theme.textMuted }]}>#</Text>
            {result.columns.map((column) => <Text key={column} style={[styles.tableCell, styles.headerText, { color: theme.textSecondary }]}>{column}</Text>)}
          </View>
          {result.rows.map((row, rowIndex) => <View key={rowIndex} style={[styles.tableRow, rowIndex % 2 === 1 && { backgroundColor: theme.bgElevated }]}>
            <Text style={[styles.rowNumber, { color: theme.textMuted }]}>{rowIndex + 1}</Text>
            {row.map((cell, cellIndex) => <Text key={cellIndex} style={[styles.tableCell, { color: theme.textPrimary }]}>{String(cell)}</Text>)}
          </View>)}
        </View>
      </ScrollView>
    </View> : null}
  </View>;
}

export function LearningReader({ type, node, compact = false }: { type: LearningType; node: TopologyNode; compact?: boolean }) {
  if (type === "复习卡片") return <FlashcardReader node={node} compact={compact} />;
  if (type === "分层练习") return <QuizReader node={node} />;
  if (type === "SQL 实操") return <SqlReader node={node} />;
  if (type === "知识图解" || type === "交互图解") return <DiagramReader node={node} />;
  return <DocumentReader node={node} />;
}

const readerStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

function useReaderStyles() {
  const { mode, theme } = useTheme();
  if (!readerStyleCache.has(mode)) readerStyleCache.set(mode, createStyles(theme));
  return readerStyleCache.get(mode)!;
}

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    reader: { gap: 10 },
    readerHead: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    readerKicker: { color: theme.accentHover, fontSize: 11, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    readerTitle: { color: theme.textPrimary, fontSize: 22, fontWeight: "800", marginTop: 1 },
    readerPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 },
    readerPillText: { fontSize: 12.5, fontWeight: "800", fontFamily: MONO_FONT },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    disabled: { opacity: 0.55 },

    flashStage: { position: "relative" },
    flashCard: { flex: 1, borderRadius: 14, borderWidth: 1, ...webOnly({ boxShadow: "0 18px 32px -22px rgba(0,0,0,0.18)" }) },
    flashFace: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, padding: 16, justifyContent: "space-between" },
    flashBackFace: { borderRadius: 13 },
    flashFaceTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    flashKind: { fontSize: 13, fontWeight: "800", letterSpacing: 0.4 },
    flashHint: { color: theme.textMuted, fontSize: 12 },
    flashFrontText: { fontSize: 20, lineHeight: 30, fontWeight: "800", letterSpacing: -0.3 },
    flashFooterHint: { fontSize: 12, lineHeight: 18 },
    flashBackText: { fontSize: 17, lineHeight: 26, fontWeight: "600" },
    flashBackFooter: { flexDirection: "row", alignItems: "center", gap: 5 },
    flashBackFooterText: { flexShrink: 1, fontSize: 12, fontWeight: "700" },
    flashControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    smallButton: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
    smallButtonText: { fontSize: 13, fontWeight: "700" },
    rememberPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3 },
    rememberText: { fontSize: 12, fontWeight: "700", fontFamily: MONO_FONT },
    flashRatingRow: { flexDirection: "row", gap: 6 },
    ratingButton: { flex: 1, minHeight: 44, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    ratingButtonPrimary: { borderWidth: 1 },
    ratingButtonText: { fontSize: 14, fontWeight: "800" },

    quizCard: { borderRadius: 13, borderWidth: 1, padding: 12, gap: 9 },
    quizTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    quizTag: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
    quizTagText: { fontSize: 12, fontWeight: "800" },
    quizNode: { color: theme.textMuted, fontSize: 12, maxWidth: "55%" },
    quizQuestion: { fontSize: 17, lineHeight: 25, fontWeight: "800" },
    quizOptions: { gap: 5 },
    quizOption: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 8, borderWidth: 1, padding: 10 },
    quizOptionMark: { width: 30, height: 30, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    quizOptionMarkText: { fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    quizOptionText: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 22 },
    quizFeedback: { borderRadius: 8, borderWidth: 1, padding: 8, gap: 3 },
    quizFeedbackTitle: { fontSize: 13, fontWeight: "800" },
    quizFeedbackText: { fontSize: 14.5, lineHeight: 22 },
    quizFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    quizProgress: { flex: 1, fontSize: 12 },
    quizNext: { borderRadius: 7, paddingHorizontal: 9, paddingVertical: 5 },
    quizNextText: { fontSize: 14, fontWeight: "800" },
    quizHint: { fontSize: 12.5, lineHeight: 19 },

    docCard: { borderRadius: 12, borderWidth: 1, padding: 11, gap: 7 },
    docCardHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    docStep: { width: 32, height: 32, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    docStepText: { fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    docTitle: { fontSize: 16, fontWeight: "800" },
    docBody: { fontSize: 15.5, lineHeight: 24 },
    docExtra: { borderRadius: 7, borderWidth: 1, padding: 7 },
    docExtraText: { fontSize: 14, lineHeight: 21, fontWeight: "600" },

    graphRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 },
    graphStepWrap: { flexDirection: "row", alignItems: "center", flexGrow: 1, minWidth: 105 },
    graphStep: { flex: 1, minWidth: 92, borderRadius: 9, borderWidth: 1, padding: 7, gap: 2 },
    graphDot: { width: 5, height: 5, borderRadius: 3 },
    graphStepLabel: { fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    graphStepTitle: { fontSize: 14, fontWeight: "700" },
    graphArrow: { fontSize: 11 },
    graphDetail: { borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
    graphDetailLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
    graphDetailTitle: { fontSize: 18, fontWeight: "800" },
    graphDetailBody: { fontSize: 15, lineHeight: 23 },
    graphControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 3 },
    graphHint: { flex: 1, minWidth: 0, fontSize: 12 },
    graphNext: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
    graphNextText: { fontSize: 13.5, fontWeight: "800" },
    graphTopology: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, borderRadius: 10, borderWidth: 1, padding: 8 },
    graphTopoChip: { flexGrow: 1, flexBasis: 92, minWidth: 0, borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5, gap: 1 },
    graphTopoKey: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.3 },
    graphTopoText: { fontSize: 12.5, fontWeight: "700" },
    graphTopoArrow: { fontSize: 13, fontWeight: "800" },

    sqlWindow: { borderRadius: 12, overflow: "hidden", backgroundColor: theme.code.bg, borderWidth: 1, borderColor: theme.code.border },
    sqlWindowTop: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: theme.code.headerBg, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder },
    traffic: { flexDirection: "row", gap: 4 },
    trafficDot: { width: 6, height: 6, borderRadius: 3 },
    sqlWindowTitle: { color: theme.code.title, fontSize: 11, fontFamily: MONO_FONT, flex: 1 },
    sqlWindowMeta: { color: theme.code.muted, fontSize: 10.5, fontFamily: MONO_FONT },
    sqlCode: { color: theme.code.text, fontSize: 13.5, lineHeight: 21, padding: 11, fontFamily: MONO_FONT },
    sqlWindowFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10, paddingBottom: 9 },
    sqlSafe: { color: theme.code.string, fontSize: 11, fontFamily: MONO_FONT },
    sqlRun: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 6, minHeight: 38 },
    sqlRunGlyph: { color: "#FFFFFF", fontSize: 9 },
    sqlRunText: { fontSize: 13.5, fontWeight: "800" },
    sqlNote: { fontSize: 14, lineHeight: 22 },
    sqlError: { borderRadius: 8, borderWidth: 1, padding: 8 },
    sqlErrorText: { fontSize: 13.5, lineHeight: 20, fontWeight: "600" },
    resultCard: { borderRadius: 10, borderWidth: 1, padding: 9, gap: 6 },
    resultTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    resultTitle: { fontSize: 14, fontWeight: "800" },
    resultMeta: { fontSize: 12, fontFamily: MONO_FONT, fontWeight: "700" },
    tableScroll: { paddingBottom: 2 },
    tableRow: { flexDirection: "row", alignItems: "center", minHeight: 24 },
    rowNumber: { width: 24, fontSize: 11, fontFamily: MONO_FONT, paddingHorizontal: 4 },
    tableCell: { minWidth: 84, fontSize: 12.5, fontFamily: MONO_FONT, paddingHorizontal: 7, paddingVertical: 4 },
    headerText: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  });
}
