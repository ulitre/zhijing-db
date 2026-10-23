import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextStyle } from "react-native";
import { MiniIcon } from "../../components/mini-icon";
import { Reveal } from "../../components/scroll-reveal";
import { LoadingPanel, MONO_FONT, PageHeading, ThemedScreen, webOnly } from "../../components/theme-ui";
import { askTutor, type TutorResponse } from "../../lib/api";
import { exampleForNode, flashcardsForNode, pitfallForNode, quizzesForNode, sqlExampleForTutor } from "../../lib/learning-content";
import { TOPOLOGY_NODES, mergePath, nodeById, type TopologyNode } from "../../lib/path-topology";
import { useApp } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";
import { useHydratedWidth } from "../../lib/use-hydrated-width";

type TutorMode = "evidence" | "socratic" | "sql";
type Turn = { id: string; question: string; response: TutorResponse; mode: TutorMode; nodeTitle: string; nodeId: string; usedFallback: boolean; thinkingSeconds: number };
type PendingQuery = { id: string; question: string; nodeTitle: string; nodeId: string; mode: TutorMode };
type Note = { id: string; text: string; nodeTitle: string };
type ArtifactTab = "cards" | "takeaways";

/** Text-flavoured web style helper: animation props are valid on text nodes too. */
function textWebOnly(style: Record<string, unknown>): TextStyle | null {
  return Platform.OS === "web" ? (style as unknown as TextStyle) : null;
}

const MODES: readonly { key: TutorMode; label: string; desc: string }[] = [
  { key: "evidence", label: "✦ 循证精讲", desc: "结构化定义 · 正反例 · 公式" },
  { key: "socratic", label: "🧭 苏格拉底启发", desc: "递进追问 · 自己发现错误" },
  { key: "sql", label: "🔧 SQL 诊错调优", desc: "语法 · 执行计划 · 慢查询" },
];

const CONTEXT_IDS = ["keys-integrity", "nf-3bc", "sql-select", "tx-acid"];

const MODE_PREFIX: Record<TutorMode, string> = {
  evidence: "请用循证精讲风格回答：先给一句话核心结论，再分层给出定义、正反例与教材依据。问题：",
  socratic: "请用苏格拉底式启发回答：不要直接给结论，先用 2-3 个递进追问引导我发现错误原因，最后再总结。问题：",
  sql: "请从 SQL 语法、执行顺序、常见报错与优化角度拆解，尽量给出可运行 SQL。问题：",
};

const SOURCE_LABELS = ["KG-03 · 关系模型核心卡", "KG-07 · 完整性约束", "KG-12 · 易错反例库", "KG-21 · 随堂自测"];

const localAnswer: TutorResponse = {
  answer: "候选键是能够唯一标识元组的最小属性集，可能有多个；主键是从候选键中选定的一个。以校园选课系统为例，学生表可以同时拥有学号和内部编号两个候选键，但系统会选择其中一个作为主键。",
  citations: [{ id: "local-database-design", title: "BCcampus Database Design · PostgreSQL Constraints" }],
  refused: false,
};

const mentionsTransactionTypo = (question: string) => /事物/.test(question) && /(acid|事务|四大|特性|性质|原子性|一致性|隔离性|持久性)/i.test(question);

function localTutorFallback(question: string): TutorResponse {
  const normalized = mentionsTransactionTypo(question) ? question.replace(/事物/g, "事务") : question;
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

function questionPackFor(node: TopologyNode): { category: string; question: string }[] {
  if (node.id === "keys-integrity") return [
    { category: "概念辨析", question: "候选键、主键、超键到底怎么一眼区分？" },
    { category: "避坑反例", question: "为什么外键可以为 NULL？参照完整性到底怎么判断？" },
    { category: "SQL实操", question: "用一个 SQL 例子展示外键约束如何拦截孤儿记录。" },
    { category: "高频考题", question: "候选键与主键的选择题常见陷阱有哪些？" },
  ];
  if (node.id === "nf-3bc") return [
    { category: "概念辨析", question: "3NF 与 BCNF 的决定因素边界到底差在哪里？" },
    { category: "避坑反例", question: "为什么 B→C 会让 R(A,B,C) 违反 3NF？" },
    { category: "SQL实操", question: "怎样用选课表数据证明一处传递依赖？" },
    { category: "高频考题", question: "给出一个 3NF 但不是 BCNF 的经典反例。" },
  ];
  if (node.id === "sql-select" || /SELECT|WHERE|NULL/i.test(node.title)) return [
    { category: "概念辨析", question: "为什么 WHERE score = NULL 查不到任何数据？" },
    { category: "避坑反例", question: "ORDER BY 分页为什么可能重复或漏行？" },
    { category: "SQL实操", question: "写一条含 IS NOT NULL 与 ORDER BY 的完整查询。" },
    { category: "高频考题", question: "SQL 的逻辑执行顺序里 WHERE 和 HAVING 谁先？" },
  ];
  if (node.id === "tx-acid") return [
    { category: "概念辨析", question: "ACID 四个特性分别解决什么问题？" },
    { category: "避坑反例", question: "隔离性等同于完全串行吗？" },
    { category: "SQL实操", question: "用一个转账例子说明原子性与持久性。" },
    { category: "高频考题", question: "不可重复读与幻读的边界如何区分？" },
  ];
  return [
    { category: "概念辨析", question: `「${node.title}」的核心定义与适用边界是什么？` },
    { category: "避坑反例", question: `「${node.title}」最容易踩的坑是什么？` },
    { category: "SQL实操", question: `用一个数据库例子展示「${node.title}」如何影响查询。` },
    { category: "高频考题", question: `关于「${node.title}」，最值得掌握的高频结论是什么？` },
  ];
}

function firstSentence(text: string) {
  const value = text.replace(/^你问的是[^。！？!?]*[。！？!?]\s*/, "").replace(/\s+/g, " ").trim();
  const match = value.match(/^(.{8,120}?[。！？!?])/);
  return match?.[1] ?? value.slice(0, 120);
}

/** Fast-complete mode for reduced-motion users and headless tests. */
function useFastStream() {
  const [reduced, setReduced] = useState(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const listener = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener?.("change", listener);
    return () => query.removeEventListener?.("change", listener);
  }, []);
  const forced = typeof globalThis !== "undefined"
    && Boolean((globalThis as { __ZHIJING_FAST_STREAM__?: boolean }).__ZHIJING_FAST_STREAM__);
  return reduced || forced;
}

/**
 * Streams several text segments in order, exactly like the Claude client: a
 * variable 18–25ms cadence that emits 2–4 characters per tick. Progress is
 * derived from a tick clock so the render path stays pure.
 */
function useTypewriterSequence(texts: string[], enabled: boolean) {
  const key = texts.join("\u0000");
  const session = `${key}\u0001${enabled ? "1" : "0"}`;
  const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
  const maxTicks = Math.ceil(totalChars / 2) + 2;
  const [clock, setClock] = useState({ session, tick: 0 });
  const tick = clock.session === session ? clock.tick : 0;

  useEffect(() => {
    if (!enabled) return;
    let local = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const pump = () => {
      local += 1;
      setClock({ session, tick: local });
      if (local >= maxTicks) return;
      timer = setTimeout(pump, 18 + (local % 8));
    };
    timer = setTimeout(pump, 18);
    return () => { if (timer) clearTimeout(timer); };
  }, [session, enabled, maxTicks]);

  const progress = useMemo(() => {
    if (!enabled) return texts.map((text) => text.length);
    let emitted = 0;
    for (let step = 1; step <= tick; step += 1) emitted += 2 + (step % 3);
    let consumed = 0;
    return texts.map((text) => {
      const visible = Math.max(0, Math.min(text.length, emitted - consumed));
      consumed += text.length;
      return visible;
    });
  }, [texts, enabled, tick]);

  const activeIndex = texts.findIndex((text, index) => progress[index]! < text.length);
  const active = enabled && activeIndex >= 0 ? activeIndex : null;
  const complete = !enabled || active === null;
  return { progress, active, complete };
}

const THINKING_STEPS = [
  "🔍 正在向量检索《数据库原理》知识库...",
  "✓ 命中 2 张权威知识卡 (KG-03, KG-07)",
  "🛡️ ReviewGuard 事实边界核验中...",
];

/** Claude-style thinking capsule: three steps, live pulse, millisecond clock. */
function ThinkingPod({ step, fast }: { step: number; fast: boolean }) {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (fast) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 60);
    return () => clearInterval(timer);
  }, [fast]);

  return <View testID="tutor-thinking" style={[styles.thinkingPod, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }]}>
    <View style={styles.thinkingPodHead}>
      <View style={[styles.thinkingHalo, { borderColor: theme.accentRing }, webOnly({ animationKeyframes: "priorityBreath", animationDuration: "1.6s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" })]}>
        <Text style={[styles.thinkingStar, { color: theme.accentPrimary }, textWebOnly({ animationKeyframes: "thinkingSpin", animationDuration: "4.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" })]}>✦</Text>
      </View>
      <View style={styles.thinkingPodCopy}>
        <Text style={[styles.thinkingPodTitle, { color: theme.textPrimary }]}>Claude Thinking</Text>
        <Text style={[styles.thinkingPodMeta, { color: theme.textMuted }]}>TutorAgent · 多步 RAG · ReviewGuard</Text>
      </View>
      <Text style={[styles.thinkingClock, { color: theme.accentPrimary }]}>{(elapsed / 1000).toFixed(1)}s</Text>
      <View style={styles.thinkingDots}>{[0, 1, 2].map((index) => <View key={index} style={[styles.thinkingDotPulse, { backgroundColor: theme.accentPrimary }, webOnly({ animationKeyframes: "bootDotBlink", animationDuration: "1.1s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: `${index * 0.16}s` })]} />)}</View>
    </View>
    <View style={styles.thinkingStepList}>
      {THINKING_STEPS.map((line, index) => {
        if (index > step) return null;
        const live = index === step;
        return <View key={line} style={[styles.thinkingStepRow, webOnly({ animationKeyframes: "thinkingStepIn", animationDuration: "260ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" })]}>
          <View style={[styles.thinkingStepMark, { backgroundColor: live ? theme.accentPrimary : theme.success }, live ? null : { opacity: 0.75 }]} />
          <Text style={[styles.thinkingStepLabel, { color: live ? theme.textPrimary : theme.textSecondary }]}>{line}</Text>
          {live ? <Text style={[styles.thinkingStepLive, { color: theme.accentPrimary }]}>•••</Text> : null}
        </View>;
      })}
    </View>
  </View>;
}

/** Collapsed green verification bar with an expandable reasoning chain. */
function ThinkingSummary({ citations, refused, seconds }: { citations: TutorResponse["citations"]; refused: boolean; seconds: number }) {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  const [open, setOpen] = useState(false);
  const sourceCount = Math.max(1, citations.length);
  return <View style={[styles.thinkingBox, { borderColor: refused ? `${theme.warning}44` : `${theme.success}33`, backgroundColor: refused ? theme.warningSoft : theme.successSoft }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="展开或收起 RAG 思考链" accessibilityState={{ expanded: open }} onPress={() => setOpen((value) => !value)} style={({ pressed }) => [styles.thinkingHead, pressed && styles.pressed]}>
      <View style={[styles.thinkingDot, { backgroundColor: refused ? theme.warning : theme.success }]} />
      <Text style={[styles.thinkingTitle, { color: refused ? theme.warning : theme.success }]}>RAG 思考完毕</Text>
      <Text style={[styles.thinkingMeta, { color: theme.textSecondary }]}>命中 {sourceCount} 张知识卡 · 耗时 {seconds.toFixed(1)}s</Text>
      <Text style={[styles.thinkingToggle, { color: theme.textSecondary }]}>{open ? "收起思考链 ⌃" : "思考链 ⌄"}</Text>
    </Pressable>
    {open ? <View style={styles.thinkingBody}>
      {THINKING_STEPS.map((line, index) => <View key={line} style={styles.thinkingStep}>
        <Text style={[styles.thinkingIndex, { color: index === 2 ? theme.success : theme.accentPrimary }]}>{String(index + 1).padStart(2, "0")}</Text>
        <Text style={[styles.thinkingStepText, { color: theme.textSecondary }]}>{line}</Text>
      </View>)}
      {citations.length > 0 ? <View style={styles.thinkingSources}>{citations.map((citation) => <Text key={citation.id} style={[styles.thinkingSourceText, { color: theme.agent }]}>📚 {citation.title}</Text>)}</View> : null}
    </View> : null}
  </View>;
}

function UserBubble({ question }: { question: string }) {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  return <View style={styles.userTurn}>
    {mentionsTransactionTypo(question) ? <View style={[styles.correction, { backgroundColor: theme.warningSoft, borderColor: `${theme.warning}44` }]}><Text style={[styles.correctionText, { color: theme.warning }]}>↺ 概念纠偏：“事物”应为“事务” · ACID</Text></View> : null}
    <View style={[styles.userBubble, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }, webOnly({ animationKeyframes: "answerBubbleIn", animationDuration: "320ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" })]}>
      <Text style={[styles.userText, { color: theme.textPrimary }]}>{question}</Text>
    </View>
  </View>;
}

function AssistantMessage({
  turn,
  node,
  stream,
  fast,
  saved,
  onSave,
  onQuiz,
  onFollowUp,
  onCitation,
  onStreamComplete,
}: {
  turn: Turn;
  node: TopologyNode;
  stream: boolean;
  fast: boolean;
  saved: boolean;
  onSave: () => void;
  onQuiz: () => void;
  onFollowUp: (question: string) => void;
  onCitation: (index: number) => void;
  onStreamComplete: () => void;
}) {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  const response = turn.response;
  const cleanAnswer = response.answer.replace(/^你问的是[^。！？!?]*[。！？!?]\s*/, "");
  const pack = questionPackFor(node).slice(0, 2);
  const sqlExample = sqlExampleForTutor(node, turn.question);
  const positive = exampleForNode(node);
  const negative = pitfallForNode(node);
  const takeaway = response.refused ? "问题超出课程知识库范围，TutorAgent 已停止推断。" : flashcardsForNode(node)[0]!.back;
  const [skipped, setSkipped] = useState(false);
  const streaming = stream && !response.refused && !fast && !skipped;
  const segments = useMemo(() => [takeaway, cleanAnswer], [takeaway, cleanAnswer]);
  const { progress, active, complete } = useTypewriterSequence(segments, streaming);
  const startedStreaming = useRef(stream && !response.refused && !fast);
  const notified = useRef(false);

  useEffect(() => {
    if (!startedStreaming.current || !complete || notified.current) return;
    notified.current = true;
    onStreamComplete();
  }, [complete, onStreamComplete]);

  const cursor = (visible: boolean) => visible
    ? <Text style={[styles.streamCursor, { color: theme.accentPrimary }, textWebOnly({ animationKeyframes: "caretBlink", animationDuration: "1s", animationTimingFunction: "steps(1)", animationIterationCount: "infinite" })]}>▍</Text>
    : null;
  const moduleReveal = (delay: number) => webOnly({ animationKeyframes: "moduleReveal", animationDuration: "420ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards", animationDelay: `${delay}ms` });

  return <View testID="tutor-assistant-message" style={styles.assistantRow}>
    <View style={[styles.assistantAvatar, { backgroundColor: response.refused ? theme.warningSoft : theme.accentSoft, borderColor: response.refused ? `${theme.warning}44` : theme.accentSoftBorder }]}>
      <Text style={[styles.assistantAvatarText, { color: response.refused ? theme.warning : theme.accentPrimary }]}>{response.refused ? "!" : "✦"}</Text>
    </View>
    <View style={[styles.assistantBody, { borderColor: response.refused ? `${theme.warning}44` : theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
      <View style={styles.answerHead}>
        <View style={styles.answerHeadCopy}>
          <Text style={[styles.answerTitle, { color: theme.textPrimary }]}>{response.refused ? "范围审核 · TutorAgent" : "TutorAgent"}</Text>
          <Text style={[styles.answerMeta, { color: theme.textMuted }]}>{MODES.find((mode) => mode.key === turn.mode)?.label.replace(/^.. /, "")} · 聚焦 {turn.nodeTitle}</Text>
        </View>
        {response.citations.length > 0 ? <View style={[styles.citationCount, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }]}><Text style={[styles.citationCountText, { color: theme.agent }]}>{response.citations.length} 张知识卡</Text></View> : null}
      </View>

      <ThinkingSummary citations={response.citations} refused={response.refused} seconds={turn.thinkingSeconds} />

      {response.refused ? <View style={[styles.refusalBox, { borderColor: `${theme.warning}44`, backgroundColor: theme.warningSoft }]}>
        <Text style={[styles.refusalTitle, { color: theme.warning }]}>◇ 超出《数据库原理》课程范围</Text>
        <Text style={[styles.refusalText, { color: theme.textSecondary }]}>{response.answer}</Text>
      </View> : <>
        {streaming ? <Pressable testID="tutor-skip" accessibilityRole="button" accessibilityLabel="跳过打字直接展开" onPress={() => setSkipped(true)} style={({ pressed }) => [styles.skipStream, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
          <Text style={[styles.skipStreamText, { color: theme.textSecondary }]}>⚡ 跳过打字直接展开</Text>
        </Pressable> : null}

        <View style={[styles.takeawayBox, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }]}>
          <Text style={[styles.takeawayKicker, { color: theme.accentPrimary }]}>💡 一句话核心定式</Text>
          <Text style={[styles.takeawayText, { color: theme.textPrimary }]}>{segments[0]!.slice(0, progress[0])}{cursor(active === 0)}</Text>
        </View>

        <View style={styles.deepBlock}>
          <Text style={[styles.deepKicker, { color: theme.textMuted }]}>📖 深度拆解</Text>
          <Text style={[styles.deepText, { color: theme.textPrimary }]}>{segments[1]!.slice(0, progress[1])}{cursor(active === 1)}</Text>
        </View>

        {complete ? <>
          <View testID="tutor-card-sql" style={[styles.exampleBlock, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }, moduleReveal(0)]}>
            <Text style={[styles.exampleKicker, { color: theme.textMuted }]}>⌘ 可验证 SQL 实例</Text>
            <View style={[styles.codeBlock, { borderWidth: 1, borderColor: theme.code.border, backgroundColor: theme.code.bg }, webOnly({ boxShadow: theme.isDark ? theme.code.shadow : `0 10px 24px -18px ${theme.code.strong}33` })]}>
              <View style={[styles.codeTop, { backgroundColor: theme.code.headerBg, borderBottomWidth: 1, borderBottomColor: theme.code.headerBorder }]}>
                <View style={styles.codeDots}><View style={[styles.codeDot, { backgroundColor: "#FF5F56" }]} /><View style={[styles.codeDot, { backgroundColor: "#FFBD2E" }]} /><View style={[styles.codeDot, { backgroundColor: "#27C93F" }]} /></View>
                <Text style={[styles.codeTitle, { color: theme.code.title }]}>tutor_evidence.sql</Text>
              </View>
              <Text selectable style={[styles.codeText, { color: theme.code.text, backgroundColor: theme.code.bg }]}>{sqlExample}</Text>
            </View>
          </View>

          <View style={[styles.exampleGrid, styles.comparisonRow, moduleReveal(120)]}>
            <View style={[styles.exampleCell, { backgroundColor: theme.bgSurface, borderColor: theme.borderDivider }]}><Text style={[styles.exampleCellTitle, { color: theme.success }]}>✓ 正例对照</Text><Text style={[styles.exampleCellText, { color: theme.textSecondary }]}>{positive}</Text></View>
            <View style={[styles.exampleCell, { backgroundColor: theme.bgSurface, borderColor: theme.borderDivider }]}><Text style={[styles.exampleCellTitle, { color: theme.warning }]}>✕ 反例对照</Text><Text style={[styles.exampleCellText, { color: theme.textSecondary }]}>{negative}</Text></View>
          </View>

          {response.citations.length > 0 ? <View style={[styles.sourceSection, moduleReveal(240)]}>
            <Text style={[styles.sourceKicker, { color: theme.textMuted }]}>🔖 知识来源</Text>
            <View style={styles.sourceRow}>{response.citations.map((citation, index) => <Pressable key={citation.id} accessibilityRole="button" accessibilityLabel={`查看知识来源：${citation.title}`} onPress={() => onCitation(index)} style={({ pressed }) => [styles.sourcePill, { backgroundColor: theme.agentSoft, borderColor: `${theme.agent}33` }, pressed && styles.pressed]}>
              <Text style={[styles.sourceGlyph, { color: theme.agent }]}>📚</Text><Text style={[styles.sourceText, { color: theme.agent }]} numberOfLines={1}>{citation.title}</Text><Text style={[styles.sourceArrow, { color: theme.agent }]}>→</Text>
            </Pressable>)}</View>
          </View> : null}

          <View style={[styles.followUpBlock, moduleReveal(360)]}>
            <Text style={[styles.followUpKicker, { color: theme.textMuted }]}>继续追问</Text>
            <View style={styles.followUpRow}>{pack.map((item) => <Pressable key={item.question} accessibilityRole="button" accessibilityLabel={`追问：${item.question}`} onPress={() => onFollowUp(item.question)} style={({ pressed }) => [styles.followUpPill, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
              <Text style={[styles.followUpText, { color: theme.textSecondary }]} numberOfLines={2}>{item.question}</Text>
            </Pressable>)}</View>
          </View>

          <View style={[styles.answerActions, { borderTopColor: theme.borderDivider }, moduleReveal(480)]}>
            <Pressable accessibilityRole="button" accessibilityLabel="已看懂，记入本轮收获笔记" onPress={onSave} style={({ pressed }) => [styles.actionButton, { backgroundColor: saved ? theme.successSoft : theme.bgElevated, borderColor: saved ? `${theme.success}44` : theme.borderSubtle }, pressed && styles.pressed]}>
              <Text style={[styles.actionText, { color: saved ? theme.success : theme.textSecondary }]}>{saved ? "✓ 已记入本轮收获" : "✓ 已看懂，记入笔记"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="考我一道同型小题" onPress={onQuiz} style={({ pressed }) => [styles.actionButton, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }, pressed && styles.pressed]}>
              <Text style={[styles.actionText, { color: theme.accentPrimary }]}>🎯 考我同型小题</Text>
            </Pressable>
          </View>
        </> : null}
      </>}
    </View>
  </View>;
}

function KnowledgePod({
  node,
  tab,
  setTab,
  highlightedCard,
  onAsk,
  onClose,
  notes,
  quizSeed,
}: {
  node: TopologyNode;
  tab: ArtifactTab;
  setTab: (tab: ArtifactTab) => void;
  highlightedCard: number | null;
  onAsk: (question: string) => void;
  onClose?: () => void;
  notes: Note[];
  quizSeed: number;
}) {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  const deck = flashcardsForNode(node).slice(0, 3);
  const preset = flashcardsForNode(node).slice(0, 3).map((card) => card.back);
  const quiz = quizzesForNode(node)[0]!;
  const [choice, setChoice] = useState<number | null>(null);
  const correct = choice === quiz.correct;

  return <View style={[styles.pod, { borderColor: theme.borderSubtle, backgroundColor: theme.bgGlass }, webOnly({ backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" })]}>
    <View style={styles.podHead}>
      <View style={styles.podHeadCopy}>
        <Text style={[styles.podKicker, { color: theme.accentHover }]}>KNOWLEDGE ARTIFACTS</Text>
        <Text style={[styles.podTitle, { color: theme.textPrimary }]}>课程原典 & 本轮收获</Text>
      </View>
      {onClose ? <Pressable accessibilityRole="button" accessibilityLabel="收起知识卡抽屉" onPress={onClose} style={styles.podClose}><Text style={[styles.podCloseText, { color: theme.textMuted }]}>✕</Text></Pressable> : null}
    </View>
    <View accessibilityRole="tablist" accessibilityLabel="知识舱视图" style={styles.podTabs}>
      {([{ key: "cards" as const, label: "📚 节点知识原典" }, { key: "takeaways" as const, label: "📌 本轮收获" }]).map((item) => <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: tab === item.key }} aria-selected={tab === item.key} onPress={() => setTab(item.key)} style={({ pressed }) => [styles.podTab, { backgroundColor: tab === item.key ? theme.accentSoft : theme.bgSurface, borderColor: tab === item.key ? theme.accentSoftBorder : theme.borderSubtle }, pressed && styles.pressed]}>
        <Text style={[styles.podTabText, { color: tab === item.key ? theme.accentPrimary : theme.textSecondary }]}>{item.label}</Text>
      </Pressable>)}
    </View>

    {tab === "cards" ? <View key={`cards-${node.id}`} style={[styles.podBody, webOnly({ animationKeyframes: "panelIn", animationDuration: "300ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" })]}>
      <View style={[styles.podNodeLine, { borderColor: theme.borderDivider, backgroundColor: theme.bgElevated }]}>
        <MiniIcon name="link" size={12} color={theme.accentPrimary} />
        <Text style={[styles.podNodeLineText, { color: theme.textSecondary }]} numberOfLines={1}>{node.title} · {node.mastery}% 掌握</Text>
      </View>
      {deck.map((card, index) => {
        const highlighted = highlightedCard === index;
        return <View key={card.kind} style={[styles.knowledgeCard, { borderColor: highlighted ? theme.accentPrimary : theme.borderSubtle, backgroundColor: highlighted ? theme.accentSoft : theme.bgSurface }, highlighted && styles.knowledgeCardHighlight]}>
          <View style={styles.knowledgeCardTop}>
            <Text style={[styles.knowledgeCardKind, { color: highlighted ? theme.accentPrimary : theme.textMuted }]}>{card.kind}</Text>
            <Text style={[styles.knowledgeCardSource, { color: theme.textMuted }]}>{SOURCE_LABELS[index] ?? "KG · 课程知识卡"}</Text>
          </View>
          <Text style={[styles.knowledgeCardFront, { color: theme.textPrimary }]}>{card.front}</Text>
          <Text style={[styles.knowledgeCardBody, { color: theme.textSecondary }]}>{card.back}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={`针对${card.kind}向导师追问`} onPress={() => onAsk(`请针对「${node.title}」的${card.kind}进一步解释，并给出一个反例。`)} style={({ pressed }) => [styles.cardAsk, { borderColor: theme.accentSoftBorder, backgroundColor: theme.bgSurface }, pressed && styles.pressed]}>
            <Text style={[styles.cardAskText, { color: theme.accentPrimary }]}>针对此卡向导师追问 →</Text>
          </Pressable>
        </View>;
      })}
    </View> : <View key={`notes-${node.id}-${quizSeed}`} style={styles.podBody}>
      <View style={styles.notesHead}>
        <Text style={[styles.notesTitle, { color: theme.textPrimary }]}>必背核心结论清单</Text>
        <Text style={[styles.notesCount, { color: theme.accentPrimary }]}>+{notes.length} 本轮</Text>
      </View>
      {[...preset.map((text, index) => ({ id: `preset-${index}`, text, nodeTitle: node.title })), ...notes].map((note, index) => <View key={note.id} style={styles.noteRow}>
        <View style={[styles.noteIndex, { backgroundColor: index < preset.length ? theme.accentSoft : theme.successSoft, borderColor: index < preset.length ? theme.accentSoftBorder : `${theme.success}33` }]}><Text style={[styles.noteIndexText, { color: index < preset.length ? theme.accentPrimary : theme.success }]}>{String(index + 1).padStart(2, "0")}</Text></View>
        <View style={styles.noteCopy}><Text style={[styles.noteText, { color: theme.textSecondary }]}>{note.text}</Text><Text style={[styles.noteSource, { color: theme.textMuted }]}>{note.nodeTitle}{index >= preset.length ? " · 本轮问答" : " · 黄金定律"}</Text></View>
      </View>)}
      <View style={[styles.quizCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
        <View style={styles.quizHead}><Text style={[styles.quizKicker, { color: theme.accentPrimary }]}>15 秒随堂闭环</Text><Text style={[styles.quizProgress, { color: theme.textMuted }]}>1 题</Text></View>
        <Text style={[styles.quizQuestion, { color: theme.textPrimary }]}>{quiz.question}</Text>
        <View style={styles.quizOptions}>{quiz.options.map((option, index) => {
          const isCorrect = index === quiz.correct;
          const isChosen = choice === index;
          const state = choice === null ? "idle" : isCorrect ? "correct" : isChosen ? "wrong" : "muted";
          return <Pressable key={option} accessibilityRole="button" accessibilityLabel={`选项 ${String.fromCharCode(65 + index)}：${option}`} accessibilityState={{ selected: isChosen }} onPress={() => setChoice(index)} disabled={choice !== null} style={({ pressed }) => [styles.quizOption, { borderColor: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.borderSubtle, backgroundColor: state === "correct" ? theme.successSoft : state === "wrong" ? theme.warningSoft : theme.bgElevated }, pressed && styles.pressed]}>
            <Text style={[styles.quizMark, { color: state === "correct" ? theme.success : state === "wrong" ? theme.warning : theme.textMuted }]}>{state === "correct" ? "✓" : state === "wrong" ? "✕" : String.fromCharCode(65 + index)}</Text><Text style={[styles.quizOptionText, { color: theme.textPrimary }]}>{option}</Text>
          </Pressable>;
        })}</View>
        {choice !== null ? <Text style={[styles.quizExplanation, { color: correct ? theme.success : theme.warning }]}>{correct ? "✓ " : "✕ "}{quiz.explanation}</Text> : null}
      </View>
    </View>}
  </View>;
}

const tutorStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();
function useTutorStyles() {
  const { mode, theme } = useTheme();
  if (!tutorStyleCache.has(mode)) tutorStyleCache.set(mode, createStyles(theme));
  return tutorStyleCache.get(mode)!;
}

export default function TutorScreen() {
  const { theme } = useTheme();
  const styles = useTutorStyles();
  const { currentUser, path } = useApp();
  const { node: routeNode, prompt } = useLocalSearchParams<{ node?: string; prompt?: string }>();
  const width = useHydratedWidth();
  const isDesktop = width >= 960;
  const nodes = useMemo(() => mergePath(TOPOLOGY_NODES, path), [path]);
  const initialNode = useMemo(() => {
    const value = typeof routeNode === "string" ? routeNode.trim() : "";
    return nodes.find((item) => item.id === value || item.apiNodeId === value || item.title === value)
      ?? nodes.find((item) => item.id === "keys-integrity")
      ?? nodes[0]!;
  }, [nodes, routeNode]);
  const [contextId, setContextId] = useState(initialNode.id);
  const contextNode = nodeById(nodes, contextId) ?? initialNode;
  const [mode, setMode] = useState<TutorMode>("evidence");
  const activeMode = MODES.find((item) => item.key === mode) ?? MODES[0]!;
  const [nodePickerOpen, setNodePickerOpen] = useState(false);
  const [artifactTab, setArtifactTab] = useState<ArtifactTab>("cards");
  const [highlightedCard, setHighlightedCard] = useState<number | null>(null);
  const [mobileKnowledgeOpen, setMobileKnowledgeOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState(typeof prompt === "string" ? prompt : "");
  const [pending, setPending] = useState<PendingQuery | null>(null);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [revealedTurns, setRevealedTurns] = useState<Set<string>>(() => new Set());
  const [thinkStep, setThinkStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [savedTurns, setSavedTurns] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<Note[]>([]);
  const [quizSeed, setQuizSeed] = useState(0);
  const fast = useFastStream();
  const turnCounter = useRef(0);
  const askTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const threadRef = useRef<ScrollView | null>(null);
  const contextOptions = useMemo(() => {
    const ids = [...new Set([...CONTEXT_IDS, contextNode.id])];
    return ids.map((id) => nodeById(nodes, id)).filter((item): item is TopologyNode => Boolean(item)).slice(0, 5);
  }, [contextNode.id, nodes]);

  useEffect(() => () => askTimers.current.forEach(clearTimeout), []);

  // Scroll only inside the conversation viewport. The outer document must
  // never move when a turn lands or while the answer is streaming.
  const pinThreadToEnd = useCallback((animated: boolean) => {
    // Web: resolve the scrollable DOM node directly. React Native Web exposes
    // ScrollView methods through the ref, but direct element access is what
    // keeps the caret pinned frame-by-frame while text streams in.
    if (Platform.OS === "web" && typeof document !== "undefined") {
      const el = document.getElementById("tutor-thread");
      if (el) {
        if (animated && typeof el.scrollTo === "function") el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
        else el.scrollTop = el.scrollHeight;
        return;
      }
    }
    const target = threadRef.current as unknown as {
      getScrollableNode?: () => HTMLElement | null;
      scrollToEnd?: (options?: { animated?: boolean }) => void;
    } | null;
    const scroller = target?.getScrollableNode?.();
    if (scroller && typeof scroller.scrollHeight === "number") {
      if (animated && typeof scroller.scrollTo === "function") scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
      else scroller.scrollTop = scroller.scrollHeight;
      return;
    }
    target?.scrollToEnd?.({ animated });
  }, []);

  const newestStreaming = activeTurnId !== null && !revealedTurns.has(activeTurnId);

  // Keep the caret in view while the answer types itself out, without ever
  // touching the outer document scroll position.
  useEffect(() => {
    if (fast || (!pending && !newestStreaming)) return;
    const timer = setInterval(() => pinThreadToEnd(false), 200);
    return () => clearInterval(timer);
  }, [fast, newestStreaming, pending, pinThreadToEnd]);

  useEffect(() => {
    const timer = setTimeout(() => pinThreadToEnd(true), 90);
    return () => clearTimeout(timer);
  }, [pending?.id, turns.length, pinThreadToEnd]);

  // The structured cards fade in after the text settles; re-anchor a few times
  // so the action bar always ends up visible inside the viewport.
  useEffect(() => {
    if (newestStreaming) return;
    const timers = [80, 220, 480, 880].map((delay) => setTimeout(() => pinThreadToEnd(false), delay));
    return () => timers.forEach(clearTimeout);
  }, [newestStreaming, pinThreadToEnd, revealedTurns]);

  if (!currentUser) {
    return <ThemedScreen contentContainerStyle={styles.page}>
      <PageHeading title="AI 辅导" subtitle="只回答《数据库原理》范围，并提供可追踪知识来源" />
      <LoadingPanel title="正在加载 TutorAgent…" detail="正在同步课程知识卡与学习画像。" />
    </ThemedScreen>;
  }

  const ask = async (override?: string) => {
    const value = (override ?? question).trim();
    if (!value || loading) return;
    setQuestion("");
    turnCounter.current += 1;
    const id = `turn-${Date.now()}-${turnCounter.current}`;
    const startedAt = Date.now();
    const startNode = contextNode;
    const startMode = mode;
    setPending({ id, question: value, nodeTitle: startNode.title, nodeId: startNode.id, mode: startMode });
    setActiveTurnId(null);
    setThinkStep(0);
    setLoading(true);
    setError("");

    askTimers.current.forEach(clearTimeout);
    askTimers.current = [
      setTimeout(() => setThinkStep(1), fast ? 40 : 210),
      setTimeout(() => setThinkStep(2), fast ? 80 : 430),
    ];
    // The thinking capsule always gets a beat of screen time before the answer,
    // even when the local fallback returns instantly.
    const minimumThinking = new Promise<void>((resolve) => {
      askTimers.current.push(setTimeout(resolve, fast ? 0 : 660));
    });

    try {
      const [result] = await Promise.all([
        askTutor({ userId: currentUser.id, question: `${MODE_PREFIX[startMode]}${value}`, nodeId: startNode.apiNodeId })
          .then((response) => ({ response, usedFallback: false }))
          .catch((reason: unknown) => {
            setError(reason instanceof Error ? "当前使用本地课程知识库回答" : "已切换到本地课程知识库");
            return { response: localTutorFallback(value), usedFallback: true };
          }),
        minimumThinking,
      ]);
      const seconds = Math.max(0.6, (Date.now() - startedAt) / 1000);
      const turn: Turn = {
        id,
        question: value,
        response: result.response,
        mode: startMode,
        nodeTitle: startNode.title,
        nodeId: startNode.id,
        usedFallback: result.usedFallback,
        thinkingSeconds: seconds,
      };
      setTurns((items) => [...items, turn]);
      setActiveTurnId(id);
      setNotes((items) => [...items, { id: `note-${turn.id}`, text: firstSentence(turn.response.answer), nodeTitle: startNode.title }]);
    } finally {
      askTimers.current.forEach(clearTimeout);
      askTimers.current = [];
      setLoading(false);
      setPending(null);
    }
  };

  const saveTurn = (turn: Turn) => {
    setSavedTurns((current) => {
      const next = new Set(current);
      next.add(turn.id);
      return next;
    });
    setArtifactTab("takeaways");
  };
  const focusCitation = (index: number) => {
    setArtifactTab("cards");
    setHighlightedCard(index % flashcardsForNode(contextNode).length);
    if (!isDesktop) setMobileKnowledgeOpen(true);
  };
  const switchContext = (id: string) => {
    setContextId(id);
    setHighlightedCard(null);
    if (!isDesktop) setMobileKnowledgeOpen(false);
  };
  const openQuiz = () => {
    setArtifactTab("takeaways");
    setQuizSeed((value) => value + 1);
    if (!isDesktop) setMobileKnowledgeOpen(true);
  };

  const knowledgePod = <KnowledgePod node={contextNode} tab={artifactTab} setTab={setArtifactTab} highlightedCard={highlightedCard} onAsk={(value) => void ask(value)} onClose={isDesktop ? undefined : () => setMobileKnowledgeOpen(false)} notes={notes} quizSeed={quizSeed} />;
  const hasConversation = turns.length > 0 || Boolean(pending);

  return <ThemedScreen contentContainerStyle={styles.page}>
    <PageHeading title="AI 辅导" subtitle="Claude 级循证导师 · 课程知识卡原典 · 可沉淀的本轮收获" />

    {!isDesktop && mobileKnowledgeOpen ? <Reveal index={0} style={styles.mobilePodWrap}>{knowledgePod}</Reveal> : null}

    <View style={[styles.workspace, isDesktop && styles.workspaceWide]}>
      <View style={[styles.chatShell, isDesktop ? styles.chatShellWide : styles.chatShellNarrow, { borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface }]}>
        {/* Compact current-node context strip — top of the fixed chat viewport. */}
        <View style={[styles.contextStrip, { borderBottomColor: theme.borderDivider, backgroundColor: theme.bgGlass }]}>
          <View style={styles.contextStripRow}>
            <View style={[styles.contextMark, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><MiniIcon name="target" size={14} color={theme.accentPrimary} /></View>
            <View style={styles.contextStripCopy}>
              <Text style={[styles.contextKicker, { color: theme.accentHover }]}>CURRENT FOCUS</Text>
              <Text style={[styles.contextTitle, { color: theme.textPrimary }]} numberOfLines={1}>{contextNode.title}</Text>
            </View>
            <View style={[styles.masteryPill, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.masteryPillText, { color: theme.accentPrimary }]}>{contextNode.mastery}% 掌握</Text></View>
            {!isDesktop ? <Pressable accessibilityRole="button" accessibilityLabel="展开课程知识卡抽屉" onPress={() => setMobileKnowledgeOpen((value) => !value)} style={({ pressed }) => [styles.mobilePodButton, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
              <Text style={[styles.mobilePodText, { color: theme.accentPrimary }]}>📚 {mobileKnowledgeOpen ? "⌃" : "⌄"}</Text>
            </Pressable> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroller} contentContainerStyle={styles.quickRow}>
            {questionPackFor(contextNode).map((item) => <Pressable key={item.question} accessibilityRole="button" accessibilityLabel={`快捷提问：${item.question}`} onPress={() => void ask(item.question)} style={({ pressed }) => [styles.quickPill, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
              <Text style={[styles.quickCategory, { color: theme.accentPrimary }]}>{item.category}</Text>
              <Text style={[styles.quickText, { color: theme.textSecondary }]} numberOfLines={1}>{item.question}</Text>
            </Pressable>)}
          </ScrollView>
        </View>

        {/* Independent, smoothly scrolling message viewport. */}
        <ScrollView
          ref={threadRef}
          nativeID="tutor-thread"
          testID="tutor-thread"
          style={styles.thread}
          contentContainerStyle={styles.threadContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => pinThreadToEnd(false)}
          keyboardShouldPersistTaps="handled"
        >
          {!hasConversation ? <View style={styles.welcomeCard}>
            <View style={styles.welcomeHead}>
              <View style={[styles.welcomeIcon, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.welcomeGlyph, { color: theme.accentPrimary }]}>✦</Text></View>
              <View style={styles.welcomeCopy}>
                <Text style={[styles.welcomeKicker, { color: theme.accentHover }]}>START A GROUNDED CONVERSATION</Text>
                <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>从「{contextNode.title}」开始，问一个真正想懂的问题</Text>
                <Text style={[styles.welcomeText, { color: theme.textSecondary }]}>无需从空白开始。下面 4 个问题都绑定当前节点，点击即可看到 RAG 检索与结构化回答。</Text>
              </View>
            </View>
            <View style={styles.questionGrid}>
              {questionPackFor(contextNode).map((item, index) => <Reveal key={item.question} index={index + 1} reducedMotion={false} style={styles.questionWrap}>
                <Pressable accessibilityRole="button" accessibilityLabel={`预设提问：${item.question}`} onPress={() => void ask(item.question)} style={({ pressed }) => [styles.questionCard, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, pressed && styles.pressed]}>
                  <View style={styles.questionTop}><View style={[styles.questionCategory, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.questionCategoryText, { color: theme.accentPrimary }]}>[{item.category}]</Text></View><Text style={[styles.questionArrow, { color: theme.textMuted }]}>↗</Text></View>
                  <Text style={[styles.questionText, { color: theme.textPrimary }]}>{item.question}</Text>
                  <Text style={[styles.questionHint, { color: theme.textMuted }]}>绑定 {contextNode.title} · 点击提问</Text>
                </Pressable>
              </Reveal>)}
            </View>
          </View> : null}

          {turns.map((turn) => <View key={turn.id} style={styles.turn}>
            <UserBubble question={turn.question} />
            <AssistantMessage
              turn={turn}
              node={nodeById(nodes, turn.nodeId) ?? contextNode}
              stream={turn.id === activeTurnId && !revealedTurns.has(turn.id)}
              fast={fast}
              saved={savedTurns.has(turn.id)}
              onSave={() => saveTurn(turn)}
              onQuiz={openQuiz}
              onFollowUp={(value) => void ask(value)}
              onCitation={focusCitation}
              onStreamComplete={() => setRevealedTurns((current) => {
                if (current.has(turn.id)) return current;
                const next = new Set(current);
                next.add(turn.id);
                return next;
              })}
            />
          </View>)}

          {pending ? <View style={styles.turn}>
            <UserBubble question={pending.question} />
            <View style={styles.assistantRow}>
              <View style={[styles.assistantAvatar, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.assistantAvatarText, { color: theme.accentPrimary }]}>✦</Text></View>
              <View style={styles.assistantBodyPlain}>
                <ThinkingPod step={thinkStep} fast={fast} />
              </View>
            </View>
          </View> : null}

          {error ? <Text style={[styles.errorNote, { color: theme.warning }]}>{error}</Text> : null}
        </ScrollView>

        {/* Composer locked to the bottom of the chat viewport. */}
        <View testID="tutor-composer" style={[styles.composer, { backgroundColor: theme.bgSurface, borderColor: inputFocused ? theme.accentPrimary : theme.borderSubtle }]}>
          {nodePickerOpen ? <View style={[styles.nodePickerPanel, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
            <Text style={[styles.nodePickerTitle, { color: theme.textMuted }]}>切换当前学习节点</Text>
            <View style={styles.nodePickerRow}>
              {contextOptions.map((item) => {
                const active = item.id === contextNode.id;
                return <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active} accessibilityLabel={`切换到节点：${item.title}`} onPress={() => { switchContext(item.id); setNodePickerOpen(false); }} style={({ pressed }) => [styles.contextPill, { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : theme.bgSurface }, pressed && styles.pressed]}>
                  <View style={[styles.contextPillDot, { backgroundColor: active ? theme.accentPrimary : theme.textMuted }]} />
                  <Text style={[styles.contextPillText, { color: active ? theme.textPrimary : theme.textSecondary }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.contextPillMeta, { color: active ? theme.accentPrimary : theme.textMuted }]}>{item.mastery}%</Text>
                </Pressable>;
              })}
            </View>
          </View> : null}
          <TextInput value={question} onChangeText={(value) => { setQuestion(value); setError(""); }} onFocus={() => setInputFocused(true)} onBlur={() => setInputFocused(false)} placeholder={`以「${activeMode.label}」模式追问「${contextNode.title}」…`} placeholderTextColor={theme.textMuted} selectionColor={theme.accentPrimary} style={[styles.input, { color: theme.textPrimary }]} multiline accessibilityLabel="向 AI 导师提问" />
          <View style={styles.composerToolbar}>
            <View style={styles.composerLeft}>
              <View accessibilityRole="tablist" accessibilityLabel="导师模式" style={styles.modeRow}>
                {MODES.map((item) => {
                  const active = mode === item.key;
                  return <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active} accessibilityLabel={`导师模式：${item.label}`} onPress={() => setMode(item.key)} style={({ pressed }) => [styles.modePill, { borderColor: active ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: active ? theme.accentSoft : "transparent" }, pressed && styles.pressed]}>
                    <Text style={[styles.modePillText, { color: active ? theme.accentPrimary : theme.textSecondary }]}>{item.label}</Text>
                  </Pressable>;
                })}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={`选择当前学习节点，当前为 ${contextNode.title}`} accessibilityState={{ expanded: nodePickerOpen }} onPress={() => setNodePickerOpen((value) => !value)} style={({ pressed }) => [styles.nodePill, { borderColor: nodePickerOpen ? theme.accentSoftBorder : theme.borderSubtle, backgroundColor: theme.accentSoft }, pressed && styles.pressed]}>
                <Text style={[styles.nodePillText, { color: theme.accentPrimary }]} numberOfLines={1}>🎯 {contextNode.title} ▾</Text>
              </Pressable>
            </View>
            <View style={styles.composerRight}>
              <View style={styles.ragStatus}>
                <View style={[styles.ragDot, { backgroundColor: theme.success }]} />
                <Text style={[styles.ragStatusText, { color: theme.textMuted }]} numberOfLines={1}>RAG 循证开启</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="发送问题" accessibilityState={{ disabled: loading || !question.trim(), busy: loading }} disabled={loading || !question.trim()} onPress={() => void ask()} style={({ pressed }) => [styles.send, { backgroundColor: theme.accentPrimary }, (loading || !question.trim()) && styles.sendDisabled, pressed && !loading && styles.pressed]}>
                {loading ? <ActivityIndicator color={theme.onAccent} /> : <Text style={[styles.sendText, { color: theme.onAccent }]}>发送 ↑</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      {isDesktop ? <Reveal index={1} style={styles.knowledgeColumn}>{knowledgePod}</Reveal> : null}
    </View>
    <Text style={[styles.disclaimer, { color: theme.textMuted }]}>AI 生成内容仅供学习参考 · 结论请核对知识卡与引用来源</Text>
  </ThemedScreen>;
}

function createStyles(theme: ThemeTokens) {
  return StyleSheet.create({
    page: { maxWidth: 1320, paddingTop: 24, paddingBottom: 48, paddingHorizontal: 18, gap: 14, width: "100%", alignSelf: "center" },
    pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },

    // Chat viewport shell
    chatShell: { flex: 1, minWidth: 0, flexDirection: "column", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
    chatShellWide: webOnly({ height: "calc(100vh - 240px)", minHeight: 620 }) ?? { minHeight: 620 },
    chatShellNarrow: webOnly({ height: "calc(100vh - 250px)", minHeight: 480 }) ?? { minHeight: 480 },

    contextStrip: { paddingHorizontal: 14, paddingTop: 11, paddingBottom: 9, gap: 8, borderBottomWidth: 1, minWidth: 0, maxWidth: "100%" },
    contextStripRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    contextMark: { width: 27, height: 27, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    contextStripCopy: { flex: 1, minWidth: 0, gap: 0 },
    contextKicker: { fontSize: 9, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    contextTitle: { fontSize: 16, fontWeight: "800", letterSpacing: -0.2, lineHeight: 21 },
    masteryPill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
    masteryPillText: { fontSize: 11.5, fontWeight: "800", fontFamily: MONO_FONT },
    mobilePodButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, flexShrink: 0 },
    mobilePodText: { fontSize: 12, fontWeight: "800" },
    quickRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 4 },
    quickScroller: { width: "100%", minWidth: 0, flexGrow: 0 },
    quickPill: { width: 236, flexShrink: 0, borderRadius: 10, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, gap: 1 },
    quickCategory: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
    quickText: { fontSize: 12.5, lineHeight: 17 },

    thread: { flex: 1, minHeight: 0 },
    threadContent: { paddingHorizontal: 14, paddingVertical: 14, gap: 14 },
    turn: { gap: 12, width: "100%" },

    welcomeCard: { borderRadius: 14, borderWidth: 1, borderColor: "transparent", padding: 2, gap: 12 },
    welcomeHead: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
    welcomeIcon: { width: 38, height: 38, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    welcomeGlyph: { fontSize: 17, fontWeight: "900" },
    welcomeCopy: { flex: 1, minWidth: 0, gap: 3 },
    welcomeKicker: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.8, fontFamily: MONO_FONT },
    welcomeTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.4, lineHeight: 27 },
    welcomeText: { fontSize: 14, lineHeight: 21 },
    questionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    questionWrap: { flexBasis: "48%", flexGrow: 1, minWidth: 170 },
    questionCard: { borderRadius: 11, borderWidth: 1, padding: 12, gap: 7, height: "100%" },
    questionTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
    questionCategory: { borderRadius: 4, borderWidth: 1, paddingHorizontal: 5, paddingVertical: 2 },
    questionCategoryText: { fontSize: 10.5, fontWeight: "800" },
    questionArrow: { fontSize: 13 },
    questionText: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
    questionHint: { fontSize: 11, marginTop: "auto" },

    userTurn: { alignSelf: "flex-end", maxWidth: "88%", alignItems: "flex-end", gap: 5 },
    correction: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
    correctionText: { fontSize: 12, fontWeight: "700" },
    userBubble: { borderRadius: 16, borderTopRightRadius: 5, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11, maxWidth: "100%" },
    userText: { fontSize: 15, lineHeight: 23, fontWeight: "600" },

    assistantRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, width: "100%" },
    assistantAvatar: { width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 },
    assistantAvatarText: { fontSize: 12, fontWeight: "900" },
    assistantBody: { flex: 1, minWidth: 0, borderRadius: 16, borderTopLeftRadius: 5, borderWidth: 1, padding: 13, gap: 10 },
    assistantBodyPlain: { flex: 1, minWidth: 0 },

    thinkingPod: { borderRadius: 13, borderWidth: 1, padding: 13, gap: 9, overflow: "hidden" },
    thinkingPodHead: { flexDirection: "row", alignItems: "center", gap: 9 },
    thinkingHalo: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    thinkingStar: { fontSize: 13, fontWeight: "900" },
    thinkingPodCopy: { flex: 1, minWidth: 0, gap: 0 },
    thinkingPodTitle: { fontSize: 13.5, fontWeight: "800" },
    thinkingPodMeta: { fontSize: 10.5, fontFamily: MONO_FONT },
    thinkingClock: { fontSize: 11.5, fontWeight: "800", fontFamily: MONO_FONT, fontVariant: ["tabular-nums"] },
    thinkingDots: { flexDirection: "row", alignItems: "center", gap: 4 },
    thinkingDotPulse: { width: 5, height: 5, borderRadius: 3 },
    thinkingStepList: { gap: 7 },
    thinkingStepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    thinkingStepMark: { width: 5, height: 5, borderRadius: 3, marginTop: 6, flexShrink: 0 },
    thinkingStepLabel: { flex: 1, fontSize: 12.5, lineHeight: 19, fontFamily: MONO_FONT },
    thinkingStepLive: { fontSize: 10, letterSpacing: 1, fontWeight: "900" },

    skipStream: { alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 5 },
    skipStreamText: { fontSize: 11.5, fontWeight: "700" },
    streamCursor: { fontSize: 15, fontWeight: "900" },
    errorNote: { fontSize: 12, textAlign: "center" },

    answerHead: { flexDirection: "row", alignItems: "center", gap: 7 },
    answerHeadCopy: { flex: 1, minWidth: 0, gap: 0 },
    answerTitle: { fontSize: 13.5, fontWeight: "800" },
    answerMeta: { fontSize: 11, fontFamily: MONO_FONT },
    citationCount: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
    citationCountText: { fontSize: 11, fontWeight: "800" },
    thinkingBox: { borderRadius: 9, borderWidth: 1, padding: 9 },
    thinkingHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    thinkingDot: { width: 5, height: 5, borderRadius: 3 },
    thinkingTitle: { fontSize: 11.5, fontWeight: "800" },
    thinkingMeta: { flex: 1, fontSize: 10.5 },
    thinkingToggle: { fontSize: 12, fontWeight: "800" },
    thinkingBody: { gap: 6, marginTop: 8 },
    thinkingStep: { flexDirection: "row", alignItems: "flex-start", gap: 5 },
    thinkingIndex: { width: 20, fontSize: 10, fontWeight: "800", fontFamily: MONO_FONT },
    thinkingStepText: { flex: 1, fontSize: 11.5, lineHeight: 17 },
    thinkingSources: { gap: 3, marginTop: 3, paddingLeft: 26 },
    thinkingSourceText: { fontSize: 10.5 },
    takeawayBox: { borderRadius: 11, borderWidth: 1, padding: 13, gap: 5 },
    takeawayKicker: { fontSize: 11.5, fontWeight: "800" },
    takeawayText: { fontSize: 18, lineHeight: 27, fontWeight: "800" },
    deepBlock: { gap: 4 },
    deepKicker: { fontSize: 11.5, fontWeight: "800" },
    deepText: { fontSize: 15, lineHeight: 25 },
    exampleBlock: { borderRadius: 10, borderWidth: 1, padding: 11, gap: 8 },
    exampleKicker: { fontSize: 11.5, fontWeight: "800" },
    exampleGrid: { flexDirection: "row", gap: 7, flexWrap: "wrap" },
    comparisonRow: { alignItems: "stretch" },
    exampleCell: { flexBasis: "47%", flexGrow: 1, minWidth: 170, borderRadius: 8, borderWidth: 1, padding: 10, gap: 4 },
    exampleCellTitle: { fontSize: 11.5, fontWeight: "800" },
    exampleCellText: { fontSize: 14, lineHeight: 22 },
    codeBlock: { borderRadius: 10, overflow: "hidden" },
    codeTop: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 7 },
    codeDots: { flexDirection: "row", gap: 3 },
    codeDot: { width: 5, height: 5, borderRadius: 3 },
    codeTitle: { fontSize: 10, fontFamily: MONO_FONT },
    codeText: { fontSize: 13.5, lineHeight: 21, padding: 12, fontFamily: MONO_FONT },
    sourceSection: { gap: 4 },
    sourceKicker: { fontSize: 11.5, fontWeight: "800" },
    sourceRow: { flexDirection: "row", flexWrap: "wrap", gap: 5 },
    sourcePill: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
    sourceGlyph: { fontSize: 11 },
    sourceText: { flexShrink: 1, fontSize: 13, fontWeight: "700" },
    sourceArrow: { fontSize: 11 },
    followUpBlock: { gap: 4 },
    followUpKicker: { fontSize: 11.5, fontWeight: "800" },
    followUpRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    followUpPill: { maxWidth: "100%", borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
    followUpText: { fontSize: 13, lineHeight: 19 },
    answerActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, borderTopWidth: 1, paddingTop: 10 },
    actionButton: { borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
    actionText: { fontSize: 13, fontWeight: "700" },
    refusalBox: { borderRadius: 9, borderWidth: 1, padding: 9, gap: 3 },
    refusalTitle: { fontSize: 12.5, fontWeight: "800" },
    refusalText: { fontSize: 14, lineHeight: 22 },

    composer: { borderTopWidth: 1, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 8, gap: 6 },
    input: { minHeight: 46, maxHeight: 110, paddingHorizontal: 6, paddingVertical: 6, fontSize: 15, lineHeight: 22 },
    composerToolbar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6 },
    composerLeft: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, flexShrink: 1, minWidth: 0 },
    composerRight: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, flexShrink: 1, minWidth: 0, marginLeft: "auto" },
    modeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, flexShrink: 1, minWidth: 0 },
    modePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5, flexShrink: 0 },
    modePillText: { fontSize: 12.5, fontWeight: "800" },
    nodePill: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0, maxWidth: "100%", borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 5 },
    nodePillText: { flexShrink: 1, fontSize: 12.5, fontWeight: "800" },
    ragStatus: { flexDirection: "row", alignItems: "center", gap: 5, flexShrink: 1, minWidth: 0 },
    ragDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
    ragStatusText: { fontSize: 11, flexShrink: 1 },
    nodePickerPanel: { borderRadius: 13, borderWidth: 1, padding: 9, gap: 6 },
    nodePickerTitle: { fontSize: 11.5, fontWeight: "800", letterSpacing: 0.5, fontFamily: MONO_FONT },
    nodePickerRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    contextPill: { flexDirection: "row", alignItems: "center", gap: 5, maxWidth: 300, borderRadius: 8, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
    contextPillDot: { width: 6, height: 6, borderRadius: 3 },
    contextPillText: { flexShrink: 1, fontSize: 13.5, fontWeight: "700" },
    contextPillMeta: { fontSize: 12.5, fontFamily: MONO_FONT, fontWeight: "800" },
    send: { minHeight: 38, borderRadius: 999, paddingHorizontal: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    sendDisabled: { opacity: 0.5 },
    sendText: { fontSize: 14, fontWeight: "800" },

    workspace: { width: "100%", gap: 14 },
    workspaceWide: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
    knowledgeColumn: { width: 400, flexShrink: 0, minWidth: 0, ...webOnly({ alignSelf: "flex-start", position: "sticky", top: 16, maxHeight: "calc(100vh - 240px)", overflowY: "auto" }) },
    mobilePodWrap: { width: "100%" },
    disclaimer: { fontSize: 11, textAlign: "center" },

    pod: { width: "100%", borderRadius: 18, borderWidth: 1, padding: 15, gap: 11 },
    podHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    podHeadCopy: { flex: 1, minWidth: 0, gap: 1 },
    podKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7, fontFamily: MONO_FONT },
    podTitle: { fontSize: 19, fontWeight: "800", lineHeight: 26 },
    podClose: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: theme.borderSubtle, alignItems: "center", justifyContent: "center" },
    podCloseText: { fontSize: 13, fontWeight: "800" },
    podTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    podTab: { borderRadius: 7, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
    podTabText: { fontSize: 13, fontWeight: "700" },
    podBody: { gap: 10 },
    podNodeLine: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 7 },
    podNodeLineText: { flex: 1, fontSize: 11.5, fontFamily: MONO_FONT },
    knowledgeCard: { borderRadius: 11, borderWidth: 1, padding: 12, gap: 7 },
    knowledgeCardHighlight: { ...webOnly({ boxShadow: `0 0 0 1px ${theme.accentRing}` }) },
    knowledgeCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 5 },
    knowledgeCardKind: { fontSize: 12.5, fontWeight: "800" },
    knowledgeCardSource: { fontSize: 11, fontFamily: MONO_FONT },
    knowledgeCardFront: { fontSize: 16, fontWeight: "800", lineHeight: 23 },
    knowledgeCardBody: { fontSize: 14, lineHeight: 22 },
    cardAsk: { alignSelf: "flex-start", borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6 },
    cardAskText: { fontSize: 13, fontWeight: "800" },
    notesHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
    notesTitle: { fontSize: 15, fontWeight: "800" },
    notesCount: { fontSize: 11.5, fontWeight: "800", fontFamily: MONO_FONT },
    noteRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    noteIndex: { width: 28, height: 28, borderRadius: 7, borderWidth: 1, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    noteIndexText: { fontSize: 11, fontWeight: "900", fontFamily: MONO_FONT },
    noteCopy: { flex: 1, gap: 3 },
    noteText: { fontSize: 14, lineHeight: 22 },
    noteSource: { fontSize: 11.5, fontFamily: MONO_FONT },
    quizCard: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 8, marginTop: 4 },
    quizHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    quizKicker: { fontSize: 12.5, fontWeight: "800" },
    quizProgress: { fontSize: 11.5, fontFamily: MONO_FONT },
    quizQuestion: { fontSize: 16, lineHeight: 24, fontWeight: "700" },
    quizOptions: { gap: 6 },
    quizOption: { flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 7, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 8 },
    quizMark: { width: 18, fontSize: 12, fontWeight: "900", fontFamily: MONO_FONT },
    quizOptionText: { flex: 1, fontSize: 14, lineHeight: 21 },
    quizExplanation: { fontSize: 13.5, lineHeight: 20, fontWeight: "600" },
  });
}
