import { useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { router } from "expo-router";
import { ScreenShell } from "../../components/screen-shell";
import { MiniIcon } from "../../components/mini-icon";
import { ThemeSwitcher } from "../../components/theme-switcher";
import { Reveal, useScrollReveal } from "../../components/scroll-reveal";
import { useHydratedWidth } from "../../lib/use-hydrated-width";
import { useApp } from "../../state/app-context";
import { useTheme, type ThemeMode, type ThemeTokens } from "../../state/theme-context";

const pipeline = ["Orchestrator", "ProfileAgent", "DiagnosisAgent", "PathAgent", "ResourceAgent", "ReviewAgent"];
const ACTIVE_STAGE = 3;
const PIPELINE_STATUS = [
  { label: "调度完成", latency: "12ms" },
  { label: "画像同步", latency: "15ms" },
  { label: "断点推理", latency: "28ms" },
  { label: "路径编排中", latency: "14ms" },
  { label: "待调度", latency: "—" },
  { label: "待质检", latency: "—" },
] as const;
const dimensions = [
  { label: "先修基础", value: 48 }, { label: "知识掌握", value: 56 },
  { label: "目标清晰", value: 86 }, { label: "节奏匹配", value: 72 },
  { label: "错误识别", value: 68 }, { label: "资源偏好", value: 82 },
  { label: "练习独立", value: 61 }, { label: "进步趋势", value: 74 },
];

/** Right-hand bullet rows follow the semantic narrative: strengths, steady growth, then shortfalls. */
const bulletOrder = ["目标清晰", "资源偏好", "进步趋势", "节奏匹配", "错误识别", "练习独立", "先修基础", "知识掌握"];
/** Clockwise radar order requested by the product spec. */
const radarOrder = ["先修基础", "知识掌握", "目标清晰", "节奏匹配", "进步趋势", "练习独立", "资源偏好", "错误识别"];

const PERSONA_LABELS = {
  foundation: "基础补齐",
  exam: "应试巩固",
  practice: "实践进阶",
} as const;

const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

type Tier = "success" | "steady" | "warning";

function tierOf(value: number): Tier {
  if (value >= 75) return "success";
  if (value >= 60) return "steady";
  return "warning";
}

/** Success and warning remain semantic across themes; the steady tier follows the active accent. */
function tierMeta(tier: Tier, theme: ThemeTokens) {
  if (tier === "success") return { color: theme.success, soft: theme.successSoft, label: "优势" };
  if (tier === "warning") return { color: theme.warning, soft: theme.warningSoft, label: "待补" };
  return { color: theme.accentPrimary, soft: theme.accentSoft, label: "稳健" };
}

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>): ViewStyle | null {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : null;
}

/** Non-null web-only style spread helper for StyleSheet.create. */
function webProps(style: Record<string, unknown>): ViewStyle {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : {};
}

/** Guarantees a template-literal percentage type for React Native styles. */
function pct(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

const motion = StyleSheet.create({
  priorityBreath: webAnimation({ animationKeyframes: "priorityBreath", animationDuration: "3.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  nodePulse: webAnimation({ animationKeyframes: "pulseRing", animationDuration: "1.8s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
  dataFlow: webAnimation({ animationKeyframes: "dataFlowBg", animationDuration: "2.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  shimmer: webAnimation({ animationKeyframes: "shimmer", animationDuration: "3.2s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  panelIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "320ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" }),
  tooltipIn: webAnimation({ animationKeyframes: "panelIn", animationDuration: "220ms", animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)", animationFillMode: "backwards" }),
});

function useReducedMotion() {
  // Start false on both server and client so hydration is stable, then apply
  // the media query on the next frame (and keep listening for changes).
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web" && typeof window !== "undefined") {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => setReduced(query.matches);
      const frame = requestAnimationFrame(apply);
      query.addEventListener?.("change", apply);
      return () => {
        cancelAnimationFrame(frame);
        query.removeEventListener?.("change", apply);
      };
    }
    if (typeof AccessibilityInfo.isReduceMotionEnabled !== "function") return;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (active) setReduced(value); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return reduced;
}

function useCountUp(target: number, reducedMotion: boolean, duration = 800) {
  const [value, setValue] = useState(reducedMotion ? target : 0);
  useEffect(() => {
    if (reducedMotion) return;
    let frame = 0;
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, reducedMotion]);
  return reducedMotion ? target : value;
}

function useRevealFlag(reducedMotion: boolean) {
  const [visible, setVisible] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [reducedMotion]);
  return reducedMotion || visible;
}

function PulseDot({ color, size = 7, halo }: { color: string; size?: number; halo?: string }) {
  const styles = useHomeStyles();
  const reduced = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity, reduced]);
  const box = size + 6;
  return <View style={[styles.pulseHalo, { width: box, height: box, borderRadius: box / 2, backgroundColor: halo ?? `${color}1F` }]}>
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
  </View>;
}

/** SVG donut: the numeric value is also rendered beside it, so the ring is a visual accent. */
function DonutRing({ value, size = 52, stroke = 5, reducedMotion = false }: { value: number; size?: number; stroke?: number; reducedMotion?: boolean }) {
  const { theme } = useTheme();
  const drawn = useRevealFlag(reducedMotion);
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, value)) / 100) * circumference;
  if (Platform.OS !== "web") {
    return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: stroke, borderColor: theme.accentPrimary, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size - stroke * 2, height: size - stroke * 2, borderRadius: size, backgroundColor: theme.bgSurface }} />
    </View>;
  }
  return <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`整体掌握度 ${value}%`}>
    <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={theme.borderSubtle} strokeWidth={stroke} style={{ transition: "stroke 200ms ease" }} />
    <circle
      cx={size / 2} cy={size / 2} r={radius} fill="none"
      stroke={theme.accentPrimary} strokeWidth={stroke} strokeLinecap="round"
      strokeDasharray={`${circumference} ${circumference}`}
      transform={`rotate(-90 ${size / 2} ${size / 2})`}
      style={{
        strokeDashoffset: drawn ? circumference - dash : circumference,
        transition: reducedMotion ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.16, 1, 0.3, 1), stroke 200ms ease",
        filter: `drop-shadow(0 0 3px ${theme.accentShadow})`,
      }}
    />
  </svg>;
}

type Dim = { label: string; value: number };

const RADAR = { width: 320, height: 292, cx: 160, cy: 141, radius: 82 };

function radarPoint(index: number, ratio: number, radius = RADAR.radius): readonly [number, number] {
  const angle = ((-90 + index * 45) * Math.PI) / 180;
  return [RADAR.cx + Math.cos(angle) * radius * ratio, RADAR.cy + Math.sin(angle) * radius * ratio];
}

function RadarChart({ items, revealed, hoveredLabel, onHoverLabel }: {
  items: readonly Dim[];
  revealed: boolean;
  hoveredLabel: string | null;
  onHoverLabel: (label: string | null) => void;
}) {
  const { theme } = useTheme();
  const styles = useHomeStyles();
  const pointsAt = (ratio: number) => items.map((_, index) => radarPoint(index, ratio).join(",")).join(" ");
  const dataPoints = items.map((item, index) => radarPoint(index, item.value / 100));

  if (Platform.OS !== "web") {
    return <View style={styles.radarFallback}>
      {items.map((item) => {
        const tier = tierMeta(tierOf(item.value), theme);
        return <View key={item.label} style={[styles.radarFallbackItem, hoveredLabel === item.label && { backgroundColor: tier.soft, borderRadius: 6 }]}>
          <View style={[styles.radarFallbackDot, { backgroundColor: tier.color }]} />
          <Text style={styles.radarFallbackLabel}>{item.label}</Text>
          <Text style={[styles.radarFallbackValue, { color: tier.color }]}>{item.value}</Text>
        </View>;
      })}
    </View>;
  }

  return <svg
    viewBox={`0 0 ${RADAR.width} ${RADAR.height}`}
    role="img"
    aria-label={`八维能力雷达图：${items.map((item) => `${item.label} ${item.value}`).join("，")}`}
    style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
  >
    {[0.25, 0.5, 0.75, 1].map((ratio) => <polygon
      key={ratio}
      points={pointsAt(ratio)}
      fill={ratio === 1 ? theme.accentGlow : "none"}
      stroke={theme.borderSubtle}
      strokeWidth={ratio === 1 ? 1.2 : 1}
      style={{ transition: "fill 200ms ease, stroke 200ms ease" }}
    />)}
    {items.map((item, index) => {
      const [x, y] = radarPoint(index, 1);
      return <line key={`axis-${item.label}`} x1={RADAR.cx} y1={RADAR.cy} x2={x} y2={y} stroke={theme.borderDivider} strokeWidth="1" style={{ transition: "stroke 200ms ease" }} />;
    })}

    <g style={{
      transformOrigin: `${RADAR.cx}px ${RADAR.cy}px`,
      transformBox: "view-box",
      transform: revealed ? "scale(1)" : "scale(0)",
      opacity: revealed ? 1 : 0,
      transition: "transform 0.85s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.45s ease",
    }}>
      <polygon
        points={dataPoints.map((point) => point.join(",")).join(" ")}
        fill={theme.radarFill}
        stroke={theme.accentPrimary}
        strokeWidth="2.2"
        strokeLinejoin="round"
        style={{ transition: "fill 200ms ease, stroke 200ms ease" }}
      />
      {dataPoints.map(([x, y], index) => {
        const item = items[index];
        if (!item) return null;
        const tier = tierMeta(tierOf(item.value), theme);
        const hovered = hoveredLabel === item.label;
        return <g
          key={`dot-${item.label}`}
          onMouseEnter={() => onHoverLabel(item.label)}
          onMouseLeave={() => onHoverLabel(null)}
          style={{
            cursor: "pointer",
            transformOrigin: `${x}px ${y}px`,
            transformBox: "view-box",
            transform: revealed ? "scale(1)" : "scale(0.2)",
            opacity: revealed ? 1 : 0,
            transition: "transform 420ms cubic-bezier(0.16, 1, 0.3, 1), opacity 420ms ease",
            transitionDelay: `${260 + index * 60}ms`,
          }}
        >
          {hovered ? <circle cx={x} cy={y} r="9" fill={tier.color} opacity="0.16" /> : null}
          <circle cx={x} cy={y} r={hovered ? 5 : 3.5} fill={tier.color} stroke={theme.bgSurface} strokeWidth="1.5" style={{ transition: "r 160ms ease, fill 200ms ease, stroke 200ms ease" }} />
        </g>;
      })}
    </g>

    {items.map((item, index) => {
      const [x, y] = radarPoint(index, 1, RADAR.radius + 19);
      const cos = Math.cos(((-90 + index * 45) * Math.PI) / 180);
      const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
      const tier = tierMeta(tierOf(item.value), theme);
      const hovered = hoveredLabel === item.label;
      return <g
        key={`label-${item.label}`}
        style={{
          opacity: revealed ? 1 : 0,
          transition: "opacity 420ms ease",
          transitionDelay: `${320 + index * 50}ms`,
        }}
      >
        <text
          x={x}
          y={y - 4}
          textAnchor={anchor}
          fontSize={hovered ? 12 : 11}
          fontWeight={hovered ? "700" : "500"}
          fill={hovered ? tier.color : theme.textSecondary}
          fontFamily="Inter, -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif"
          onMouseEnter={() => onHoverLabel(item.label)}
          onMouseLeave={() => onHoverLabel(null)}
          style={{
            fontVariantNumeric: "tabular-nums",
            cursor: "pointer",
            transition: "fill 180ms ease, font-size 180ms ease",
            filter: hovered ? `drop-shadow(0 0 4px ${tier.color}66)` : "none",
          }}
        >
          <tspan x={x}>{item.label}</tspan>
          <tspan x={x} dy="12" fontSize="10" fontWeight="700" fill={tier.color}>{item.value}</tspan>
        </text>
      </g>;
    })}
  </svg>;
}

/** Bullet bar with a dashed 60% pass line. */
function DimensionBar({ label, value, twoColumn, revealed, index, hovered, onHoverIn, onHoverOut }: {
  label: string;
  value: number;
  twoColumn: boolean;
  revealed: boolean;
  index: number;
  hovered: boolean;
  onHoverIn: () => void;
  onHoverOut: () => void;
}) {
  const { theme } = useTheme();
  const styles = useHomeStyles();
  const tier = tierMeta(tierOf(value), theme);
  return <Pressable
    accessible
    focusable={false}
    accessibilityLabel={`${label} ${value} 分`}
    onHoverIn={onHoverIn}
    onHoverOut={onHoverOut}
    style={[styles.dimRow, twoColumn ? styles.dimRowTwoColumn : styles.dimRowFull, hovered && styles.dimRowHover]}
  >
    <Text style={[styles.dimLabel, hovered && { color: theme.textPrimary }]} numberOfLines={1}>{label}</Text>
    <View style={styles.dimTrackWrap}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={`${label} ${value} 分`}
        accessibilityValue={{ min: 0, max: 100, now: value }}
        aria-label={`${label} ${value} 分`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        style={styles.dimTrack}
      >
        <View style={[
          styles.dimFill,
          { width: pct(revealed ? value : 0), backgroundColor: tier.color },
          webOnly({
            transitionProperty: "width",
            transitionDuration: "900ms",
            transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
            transitionDelay: `${index * 60}ms`,
          }),
        ]} />
        <View style={[styles.dimBenchmark, webOnly({ backgroundImage: `repeating-linear-gradient(180deg, ${theme.textMuted} 0 3px, transparent 3px 5px)`, backgroundColor: "transparent" })]} />
      </View>
    </View>
    <View style={styles.dimValueWrap}>
      <Text style={[styles.dimValue, hovered && { color: tier.color }]}>{value}</Text>
      {tierOf(value) !== "steady" ? <Text style={[styles.microTag, { color: tier.color, backgroundColor: tier.soft }]}>{tier.label}</Text> : null}
    </View>
  </Pressable>;
}

function Panel({ children, style, hoverStyle }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; hoverStyle?: StyleProp<ViewStyle> }>) {
  const styles = useHomeStyles();
  const [hovered, setHovered] = useState(false);
  if (!hoverStyle) return <View style={[styles.panel, style]}>{children}</View>;
  return <Pressable
    focusable={false}
    onHoverIn={() => setHovered(true)}
    onHoverOut={() => setHovered(false)}
    style={[styles.panel, style, hovered && hoverStyle]}
  >{children}</Pressable>;
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const styles = useHomeStyles();
  const { currentUser, path } = useApp();
  const [ctaHovered, setCtaHovered] = useState(false);
  const [activeStage, setActiveStage] = useState(ACTIVE_STAGE);
  const [hoveredStage, setHoveredStage] = useState<number | null>(null);
  const [hoveredDimension, setHoveredDimension] = useState<string | null>(null);
  const width = useHydratedWidth();
  const reducedMotion = useReducedMotion();
  const isDesktop = width >= 960;
  const isCompact = width < 560;
  const isNarrow = width < 380;
  const isTwoUp = width >= 360;
  const kpiLayout = isDesktop ? styles.kpiDesktop : isTwoUp ? styles.kpiMedium : styles.kpiCompact;

  const pendingCount = path.filter((step) => step.mastery < 60).length;
  const unlockedNodes = Math.max(0, 45 - pendingCount);
  const overallMastery = Math.round(dimensions.reduce((total, item) => total + item.value, 0) / dimensions.length);
  const nodesCount = useCountUp(45, reducedMotion);
  const pendingAnim = useCountUp(pendingCount, reducedMotion);
  const unlockedAnim = useCountUp(unlockedNodes, reducedMotion);
  const masteryAnim = useCountUp(overallMastery, reducedMotion);
  const heroLoaded = useRevealFlag(reducedMotion);
  const { ref: profileRevealRef, visible: profileRevealVisible } = useScrollReveal(reducedMotion);

  if (!currentUser) {
    return <ScreenShell backgroundColor={theme.bgCanvas} contentContainerStyle={styles.statePage}>
      <View style={styles.stateCard}>
        <ActivityIndicator color={theme.accentPrimary} />
        <Text style={styles.stateTitle}>正在加载学习画像…</Text>
        <Text style={styles.stateDetail}>稍后将展示今日推荐、掌握度与智能体流水线。</Text>
      </View>
    </ScreenShell>;
  }
  const active = path[0];
  if (!active) {
    return <ScreenShell backgroundColor={theme.bgCanvas} contentContainerStyle={styles.statePage}>
      <View style={styles.emptyHeader}>
        <Text style={styles.title}>首页</Text>
        <Text style={styles.subtitle}>个性化学习空间</Text>
      </View>
      <View style={styles.stateCard}>
        <View style={styles.stateGlyph}><MiniIcon name="spark" size={18} color={theme.accentPrimary} /></View>
        <Text style={styles.stateTitle}>学习路径正在生成</Text>
        <Text style={styles.stateDetail}>完成一次诊断后，系统会结合掌握度与知识依赖生成今日推荐。</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="开始诊断"
          onPress={() => router.push("/diagnostic")}
          style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}
        >
          <Text style={styles.stateActionText}>开始诊断</Text>
        </Pressable>
      </View>
    </ScreenShell>;
  }

  const roleLabel = PERSONA_LABELS[currentUser.persona];
  const evidenceDetail = active.evidence.split("；").filter(Boolean).at(-1) ?? active.evidence;
  const orderedDimensions = bulletOrder
    .map((label) => dimensions.find((item) => item.label === label))
    .filter((item): item is Dim => Boolean(item));
  const orderedRadar = radarOrder
    .map((label) => dimensions.find((item) => item.label === label))
    .filter((item): item is Dim => Boolean(item));

  return <ScreenShell
    backgroundColor={theme.bgCanvas}
    contentContainerStyle={[styles.page, isDesktop && styles.pageDesktop, isCompact && styles.pageCompact, isNarrow && styles.pageNarrow]}
  >
    {/* Layer 1 · Warm greeting, theme switcher, and a four-card Bento KPI grid */}
    <Reveal reducedMotion={reducedMotion} index={0}>
    <View style={styles.header}>
      <View style={[styles.headerTop, width < 768 && styles.headerTopStack]}>
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, !isDesktop && styles.titleCompact]}>你好，{currentUser.displayName}</Text>
            <View style={styles.enginePill}>
              <Text style={styles.engineGlyph}>✨</Text>
              <Text style={styles.engineText}>学习引擎已就绪</Text>
            </View>
          </View>
        </View>
        <ThemeSwitcher compact={width > 0 && width < 720} />
      </View>
      <Text style={styles.subtitle}>今天从最关键的知识断点继续，路径会随表现自动调整。</Text>
    </View>
    </Reveal>

    <View style={styles.kpiGrid}>
      <Reveal reducedMotion={reducedMotion} index={0} style={kpiLayout}>
        <View style={[styles.kpiCard, styles.kpiCardFull, isCompact && isTwoUp && styles.kpiTight]}>
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>当前画像模式</Text>
            <MiniIcon name="target" size={15} color={theme.accentPrimary} />
          </View>
          <Text style={[styles.kpiValue, styles.kpiValueText]}>{roleLabel}</Text>
          <View style={styles.kpiStatusRow}>
            <PulseDot color={theme.success} size={7} halo={theme.successSoft} />
            <Text style={styles.kpiStatusText}>画像实时同步</Text>
          </View>
        </View>
      </Reveal>

      <Reveal reducedMotion={reducedMotion} index={1} style={kpiLayout}>
        <View style={[styles.kpiCard, styles.kpiCardFull, isCompact && isTwoUp && styles.kpiTight]}>
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>课程知识节点</Text>
            <MiniIcon name="layers" size={15} color={theme.textMuted} />
          </View>
          <Text style={styles.kpiValue}>{nodesCount}</Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={`已解锁 ${unlockedNodes} / 45`}
            accessibilityValue={{ min: 0, max: 45, now: unlockedNodes }}
            aria-label={`已解锁 ${unlockedNodes} / 45`}
            aria-valuemin={0}
            aria-valuemax={45}
            aria-valuenow={unlockedNodes}
            style={styles.kpiTrack}
          >
            <View style={[styles.kpiTrackFill, { width: pct((unlockedAnim / 45) * 100), backgroundColor: theme.success }, webOnly({ transitionProperty: "width", transitionDuration: "800ms", transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" })]} />
          </View>
          <Text style={styles.kpiSub}>已解锁 {unlockedAnim} / 45</Text>
        </View>
      </Reveal>

      <Reveal reducedMotion={reducedMotion} index={2} style={kpiLayout}>
        <View style={[styles.kpiCard, styles.kpiCardAlert, styles.kpiCardFull, isCompact && isTwoUp && styles.kpiTight]}>
          <View pointerEvents="none" style={[styles.alertRail, motion.priorityBreath, { backgroundColor: theme.warning }]} />
          <View style={styles.kpiTop}>
            <Text style={styles.kpiLabel}>待补知识断点</Text>
            {pendingCount > 0
              ? <View style={[styles.riskPill, motion.priorityBreath]}><Text style={styles.riskPillText}>高优</Text></View>
              : <View style={[styles.riskPill, { backgroundColor: theme.successSoft }]}><Text style={[styles.riskPillText, { color: theme.success }]}>稳固</Text></View>}
          </View>
          <Text style={[styles.kpiValue, pendingCount > 0 && { color: theme.warning }]}>{pendingAnim}</Text>
          <View style={styles.kpiStatusRow}>
            <MiniIcon name={pendingCount > 0 ? "alert" : "check"} size={13} color={pendingCount > 0 ? theme.warning : theme.success} />
            <Text style={[styles.kpiStatusText, pendingCount > 0 && { color: theme.warning }]}>
              {pendingCount > 0 ? "建议优先处理" : "当前路径已稳固"}
            </Text>
          </View>
        </View>
      </Reveal>

      <Reveal reducedMotion={reducedMotion} index={3} style={kpiLayout}>
        <View style={[styles.kpiCard, styles.kpiCardFull, isCompact && isTwoUp && styles.kpiTight]}>
          <View style={styles.kpiDonutRow}>
            <View style={styles.kpiDonutCopy}>
              <Text style={styles.kpiLabel}>整体掌握度</Text>
              <Text style={styles.kpiValue}>{masteryAnim}%</Text>
              <Text style={styles.kpiSub}>八维画像均值</Text>
            </View>
            <DonutRing value={overallMastery} size={isCompact ? 48 : 54} stroke={5} reducedMotion={reducedMotion} />
          </View>
        </View>
      </Reveal>
    </View>

    <Reveal reducedMotion={reducedMotion} index={2}>
    <Panel style={[styles.pipelineCard, isCompact && styles.pipelineCardCompact, isNarrow && styles.pipelineCardNarrow]}>
      <View style={[styles.pipelineHead, isCompact && styles.pipelineHeadCompact]}>
        <View style={styles.pipelineTitleRow}>
          <Text style={styles.sectionTitle}>智能体协同流水线</Text>
          <View style={styles.orchestratorPill}>
            <PulseDot color={theme.agent} size={6} halo={theme.agentSoft} />
            <Text style={styles.orchestratorText}>Orchestrator 调度中</Text>
          </View>
        </View>
        <View style={styles.agentsPill}>
          <Text style={styles.agentsText}>6 / 12 AGENTS</Text>
        </View>
      </View>

      <View style={styles.railWrap}>
        <View style={[styles.railDone, { left: pct(100 / (2 * pipeline.length)), width: pct((activeStage * 100) / pipeline.length) }]}>
          <View
            pointerEvents="none"
            style={[
              styles.railFlow,
              motion.dataFlow,
              webOnly({
                backgroundImage: `linear-gradient(90deg, transparent 0%, ${theme.accentGradientFrom} 42%, #FFFFFF 50%, ${theme.accentPrimary} 58%, transparent 100%)`,
                backgroundSize: "32% 100%",
                backgroundRepeat: "no-repeat",
              }),
            ]}
          />
        </View>
        <View style={[
          styles.railPending,
          { left: pct(((activeStage + 0.5) * 100) / pipeline.length), width: pct(((pipeline.length - 1 - activeStage) * 100) / pipeline.length) },
          webOnly({ height: 2, backgroundColor: "transparent", backgroundImage: `repeating-linear-gradient(90deg, ${theme.pendingLine} 0 6px, transparent 6px 10px)` }),
        ]} />
        <View style={styles.stepRow}>
          {pipeline.map((agent, index) => {
            const done = index < activeStage;
            const activeStep = index === activeStage;
            const status = PIPELINE_STATUS[index]!;
            return <Pressable
              key={agent}
              accessibilityRole="button"
              accessibilityLabel={`${agent.replace("Agent", "")}，${status.label}`}
              accessibilityState={{ selected: activeStep }}
              focusable
              onHoverIn={() => setHoveredStage(index)}
              onHoverOut={() => setHoveredStage((current) => current === index ? null : current)}
              onPress={() => setActiveStage(index)}
              style={styles.step}
            >
              {hoveredStage === index ? <View pointerEvents="none" style={[styles.nodeTooltip, motion.tooltipIn, { backgroundColor: theme.bgSurface, borderColor: theme.borderSubtle }]}>
                <Text style={styles.nodeTooltipTitle} numberOfLines={1}>{agent.replace("Agent", "")} · {status.label}</Text>
                <Text style={styles.nodeTooltipMeta}>{status.latency} · {done ? "已完成" : activeStep ? "调度中" : "待调度"}</Text>
              </View> : null}
              <View style={styles.dotWrap}>
                {activeStep ? <View pointerEvents="none" style={[styles.activePulseRing, motion.nodePulse, { borderColor: theme.accentRing }]} /> : null}
                {activeStep ? <View style={[styles.activeHalo, { pointerEvents: "none" }]} /> : null}
                <View style={[
                  styles.stepDot,
                  done && styles.stepDotDone,
                  activeStep && styles.stepDotActive,
                  !done && !activeStep && styles.stepDotPending,
                  activeStep && webOnly({ boxShadow: `0 0 0 4px ${theme.bgSurface}, 0 0 0 8px ${theme.accentRing}` }),
                ]}>
                  {done ? <Text style={styles.stepCheck}>✓</Text> : activeStep ? <View style={styles.stepCore} /> : null}
                </View>
              </View>
              <View style={[styles.stepLabelWrap, activeStep && styles.stepLabelActiveWrap]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.stepLabel,
                    isCompact && styles.stepLabelCompact,
                    isNarrow && styles.stepLabelNarrow,
                    done && styles.stepLabelDone,
                    activeStep && styles.stepLabelActive,
                    !done && !activeStep && styles.stepLabelPending,
                  ]}
                >{agent.replace("Agent", "")}</Text>
              </View>
            </Pressable>;
          })}
        </View>
      </View>

      <View style={styles.pipelineFoot}>
        <MiniIcon name="terminal" size={13} color={theme.textMuted} />
        <View key={activeStage} style={[styles.pipelineFootCopy, motion.panelIn]}>
          <Text style={styles.pipelineFootText} numberOfLines={1}>当前节点：{pipeline[activeStage]} · 其余智能体按任务状态接续运行</Text>
        </View>
      </View>
    </Panel>
    </Reveal>

    {/* Layer 3 · Hero recommendation with bullet progress and a 60% reference marker */}
    <Reveal reducedMotion={reducedMotion} index={3}>
    <Panel style={styles.heroCard} hoverStyle={styles.heroCardHover}>
      <View style={[styles.heroGlow, webOnly({ backgroundImage: `radial-gradient(circle at top right, ${theme.accentGlow}, transparent 62%)` }), { pointerEvents: "none" }]} />
      <View style={[styles.heroTop, isCompact && styles.heroTopCompact]}>
        <View style={styles.heroCopy}>
          <View style={styles.kicker}>
            <MiniIcon name="bolt" size={13} color={theme.accentPrimary} />
            <Text style={styles.kickerText}>今日推荐突破</Text>
          </View>
          <Text style={styles.heroTitle}>{active.title}</Text>

          <View style={styles.masteryBlock}>
            <View style={styles.masteryHead}>
              <Text style={styles.masteryLabel}>掌握度</Text>
              <Text style={styles.masteryValue}>{active.mastery}%</Text>
            </View>
            <View style={styles.bulletZone}>
              <View style={styles.benchLabel}><Text style={styles.benchLabelText}>达标基准 60%</Text></View>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel={`掌握度 ${active.mastery}%`}
                accessibilityValue={{ min: 0, max: 100, now: active.mastery }}
                aria-label={`掌握度 ${active.mastery}%`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={active.mastery}
                style={styles.bulletTrack}
              >
                <View style={[
                  styles.bulletFill,
                  { width: pct(heroLoaded ? active.mastery : 0) },
                  webOnly({
                    backgroundImage: `linear-gradient(90deg, ${theme.accentGradientFrom} 0%, ${theme.accentPrimary} 100%)`,
                    transitionProperty: "width",
                    transitionDuration: "900ms",
                    transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
                  }),
                ]} />
                <View style={styles.bulletMarker} />
              </View>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="进入专项突破"
          onPress={() => router.push("/(tabs)/path")}
          onHoverIn={() => setCtaHovered(true)}
          onHoverOut={() => setCtaHovered(false)}
          style={({ pressed }) => [
            styles.primaryCta,
            isCompact && styles.primaryCtaCompact,
            ctaHovered && styles.primaryCtaHovered,
            pressed && styles.primaryCtaPressed,
            webOnly({ cursor: "pointer", transitionProperty: "background-color, transform, box-shadow", transitionDuration: "160ms" }),
          ]}
        >
          <View
            pointerEvents="none"
            style={[
              styles.primaryCtaShimmer,
              motion.shimmer,
              webOnly({ backgroundImage: "linear-gradient(100deg, transparent 30%, rgba(255, 255, 255, 0.4) 50%, transparent 70%)" }),
            ]}
          />
          <Text style={styles.primaryCtaText}>进入专项突破</Text>
          <Text style={[styles.primaryCtaArrow, ctaHovered && styles.primaryCtaArrowHovered]}>→</Text>
        </Pressable>
      </View>

      <View style={[styles.heroMeta, isCompact && styles.heroMetaCompact]}>
        <View style={styles.metaItem}>
          <MiniIcon name="radar" size={14} color={theme.accentPrimary} />
          <Text style={styles.metaText}><Text style={styles.metaLabel}>诊断依据：</Text><Text style={styles.metaValue}>{evidenceDetail}</Text></Text>
        </View>
        <View style={styles.metaItem}>
          <MiniIcon name="layers" size={14} color={theme.accentPrimary} />
          <Text style={styles.metaText}><Text style={styles.metaLabel}>推荐形式：</Text><Text style={styles.metaValue}>{active.resource}</Text></Text>
        </View>
        <View style={styles.metaItem}>
          <MiniIcon name="clock" size={14} color={theme.accentPrimary} />
          <Text style={styles.metaText}><Text style={styles.metaLabel}>预计耗时：</Text><Text style={styles.metaValue}>约 15 分钟</Text></Text>
        </View>
      </View>
    </Panel>
    </Reveal>

    {/* Layer 4 · Learner identity: radar + semantic bullet bars */}
    <Reveal reducedMotion={reducedMotion} index={4}>
    <Panel style={styles.profileCard}>
      <View style={[styles.profileHead, isCompact && styles.profileHeadCompact]}>
        <View style={styles.profileHeadCopy}>
          <Text style={styles.profileTitle}>学习身份与画像</Text>
          <Text style={styles.profileGoal}>主要目标：{currentUser.goal}</Text>
        </View>
        <View
          accessibilityRole="radiogroup"
          aria-label="学习身份模式"
          style={[styles.segmented, isCompact && styles.segmentedCompact]}
        >
          {(["foundation", "exam", "practice"] as const).map((key) => {
            const selected = currentUser.persona === key;
            return <View
              key={key}
              accessible
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              aria-checked={selected}
              style={[styles.segment, isCompact && styles.segmentCompact, selected && styles.segmentActive]}
            >
              <Text style={[styles.segmentText, selected && styles.segmentTextActive]}>{PERSONA_LABELS[key]}</Text>
            </View>;
          })}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={[styles.profileBody, !isDesktop && styles.profileBodyCompact]}>
        <View ref={profileRevealRef} style={[styles.radarPanel, !isDesktop && styles.radarPanelCompact]}>
          <View style={styles.radarHead}>
            <Text style={styles.radarTitle}>八维能力雷达</Text>
            <Text style={styles.radarMeta}>RADAR · 8 DIMENSIONS</Text>
          </View>
          <View style={styles.radarCanvas}>
            <RadarChart items={orderedRadar} revealed={profileRevealVisible} hoveredLabel={hoveredDimension} onHoverLabel={setHoveredDimension} />
          </View>
          <View style={styles.radarLegend}>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.success }]} /><Text style={styles.legendText}>优势项 (&gt;=75)</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.accentPrimary }]} /><Text style={styles.legendText}>稳健项 (60-74)</Text></View>
            <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: theme.warning }]} /><Text style={styles.legendText}>待补短板 (&lt;60)</Text></View>
          </View>
        </View>

        <View style={[styles.dimensionPanel, !isDesktop && styles.dimensionPanelCompact]}>
          <View style={styles.dimensionPanelHead}>
            <Text style={styles.dimensionPanelTitle}>能力分解</Text>
            <Text style={styles.dimensionPanelMeta}>虚线 = 60 分达标基准</Text>
          </View>
          <View style={styles.dimensionGrid}>
            {orderedDimensions.map((item, index) => <DimensionBar
              key={item.label}
              label={item.label}
              value={item.value}
              twoColumn={isDesktop}
              revealed={profileRevealVisible}
              index={index}
              hovered={hoveredDimension === item.label}
              onHoverIn={() => setHoveredDimension(item.label)}
              onHoverOut={() => setHoveredDimension((current) => current === item.label ? null : current)}
            />)}
          </View>
        </View>
      </View>

      <View style={styles.profileFooter}>
        <MiniIcon name="spark" size={12} color={theme.textMuted} />
        <Text style={styles.profileNote}>画像由对话、诊断题和学习行为共同更新。</Text>
      </View>
    </Panel>
    </Reveal>
  </ScreenShell>;
}

const homeStyleCache = new Map<ThemeMode, ReturnType<typeof createStyles>>();

/** One compiled style sheet per theme, shared by every component on the dashboard. */
function useHomeStyles() {
  const { mode, theme } = useTheme();
  return useMemo(() => {
    const cached = homeStyleCache.get(mode);
    if (cached) return cached;
    const created = createStyles(theme);
    homeStyleCache.set(mode, created);
    return created;
  }, [mode, theme]);
}

function createStyles(theme: ThemeTokens) {
  const cardShadow = theme.isDark
    ? theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.12), 0 16px 40px -20px rgba(0, 0, 0, 0.78)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px -20px rgba(0, 0, 0, 0.75)"
    : "0 4px 20px -2px rgba(24, 24, 27, 0.04), 0 1px 3px -1px rgba(24, 24, 27, 0.02)";
  const webCard = Platform.OS === "web"
    ? ({
      boxShadow: cardShadow,
      ...(theme.base === "linear" ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {}),
      transitionProperty: "background-color, border-color, box-shadow",
      transitionDuration: "200ms",
      transitionTimingFunction: "ease",
    } as ViewStyle)
    : {};
  const webTransition = Platform.OS === "web"
    ? ({ transitionProperty: "background-color, border-color", transitionDuration: "200ms", transitionTimingFunction: "ease" } as ViewStyle)
    : {};

  return StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 20, maxWidth: 1180, width: "100%", alignSelf: "center", gap: 18 },
  pageDesktop: { paddingHorizontal: 32 },
  pageCompact: { paddingTop: 28, paddingHorizontal: 14 },
  pageNarrow: { paddingHorizontal: 10 },

  // Greeting
  header: { paddingBottom: 4 },
  headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 },
  headerTopStack: { flexDirection: "column", alignItems: "flex-start", gap: 12 },
  titleBlock: { flexShrink: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12 },
  title: { color: theme.textPrimary, fontSize: 30, lineHeight: 38, fontWeight: "700", letterSpacing: -0.6 },
  titleCompact: { fontSize: 25, lineHeight: 33 },
  enginePill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentSoftBorder },
  engineGlyph: { fontSize: 11 },
  engineText: { color: theme.accentPrimary, fontSize: 11, fontWeight: "600" },
  subtitle: { color: theme.textSecondary, fontSize: 14, lineHeight: 21, marginTop: 9 },

  // Bento KPI grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  kpiCard: {
    backgroundColor: theme.bgSurface,
    borderWidth: 1,
    borderColor: theme.borderSubtle,
    borderRadius: 14,
    padding: 18,
    minHeight: 140,
    justifyContent: "space-between",
    ...webCard,
  },
  kpiDesktop: { flexBasis: 0, flexGrow: 1, minWidth: 0 },
  kpiMedium: { flexBasis: "47%", flexGrow: 1, minWidth: 0 },
  kpiCompact: { flexBasis: "100%", flexGrow: 0, minHeight: 128 },
  kpiTight: { padding: 16 },
  kpiCardFull: { width: "100%" },
  kpiCardAlert: { position: "relative", overflow: "hidden", borderLeftWidth: 3, borderLeftColor: theme.warning },
  alertRail: { position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 3, zIndex: 2 },
  kpiTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 20 },
  kpiLabel: { color: theme.textMuted, fontSize: 11.5, fontWeight: "600", letterSpacing: 0.2 },
  kpiValue: { color: theme.textPrimary, fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.5, marginTop: 8, fontVariant: ["tabular-nums"] },
  kpiValueText: { fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  kpiSub: { color: theme.textMuted, fontSize: 11, lineHeight: 16, marginTop: 5, fontVariant: ["tabular-nums"] },
  kpiStatusRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  kpiStatusText: { color: theme.textSecondary, fontSize: 11, lineHeight: 16 },
  kpiTrack: { height: 6, borderRadius: 999, backgroundColor: theme.bgElevated, overflow: "hidden", marginTop: 10, ...webTransition },
  kpiTrackFill: { height: "100%", borderRadius: 999 },
  kpiDonutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  kpiDonutCopy: { flexShrink: 1, minWidth: 0 },
  riskPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: theme.warningSoft },
  riskPillText: { color: theme.warning, fontSize: 10, fontWeight: "700" },
  pulseHalo: { alignItems: "center", justifyContent: "center" },

  // Shared card
  panel: { backgroundColor: theme.bgSurface, borderWidth: 1, borderColor: theme.borderSubtle, borderRadius: 16, padding: 22, overflow: "hidden", ...webCard },
  divider: { height: 1, backgroundColor: theme.borderDivider, marginVertical: 18 },

  // Pipeline
  pipelineCard: { paddingHorizontal: 24, paddingVertical: 20 },
  pipelineCardCompact: { paddingHorizontal: 16 },
  pipelineCardNarrow: { paddingHorizontal: 12 },
  pipelineHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  pipelineHeadCompact: { flexWrap: "wrap", alignItems: "flex-start", rowGap: 10 },
  pipelineTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, flexShrink: 1 },
  sectionTitle: { color: theme.textPrimary, fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  orchestratorPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.agentSoft },
  orchestratorText: { color: theme.agent, fontSize: 10.5, fontWeight: "600" },
  agentsPill: { backgroundColor: theme.bgElevated, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: theme.borderDivider },
  agentsText: { color: theme.textSecondary, fontFamily: MONO_FONT, fontSize: 12, fontWeight: "600", letterSpacing: 0.7, fontVariant: ["tabular-nums"] },
  railWrap: { position: "relative", marginTop: 24 },
  railDone: { position: "absolute", top: 13.5, height: 2.5, borderRadius: 999, backgroundColor: theme.accentPrimary, overflow: "hidden" },
  railFlow: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  railPending: { position: "absolute", top: 13.5, height: 2, borderRadius: 999, backgroundColor: theme.pendingLine },
  stepRow: { flexDirection: "row", alignItems: "flex-start", zIndex: 1 },
  step: { position: "relative", zIndex: 1, flex: 1, minWidth: 0, alignItems: "center" },
  dotWrap: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  activeHalo: { position: "absolute", width: 38, height: 38, borderRadius: 19, backgroundColor: theme.accentHalo },
  activePulseRing: { position: "absolute", width: 30, height: 30, borderRadius: 15, borderWidth: 1.5 },
  stepDot: { alignItems: "center", justifyContent: "center" },
  stepDotDone: { width: 22, height: 22, borderRadius: 11, backgroundColor: theme.accentPrimary },
  stepDotActive: { width: 26, height: 26, borderRadius: 13, backgroundColor: theme.accentPrimary },
  stepDotPending: { width: 20, height: 20, borderRadius: 10, backgroundColor: theme.bgCanvas, borderWidth: 2, borderColor: theme.pendingRing },
  stepCheck: { color: theme.onAccent, fontSize: 11, lineHeight: 13, fontWeight: "700" },
  stepCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#FFFFFF" },
  stepLabelWrap: { marginTop: 8, maxWidth: "100%", paddingHorizontal: 2, borderRadius: 999 },
  stepLabelActiveWrap: { backgroundColor: theme.accentSoft, paddingHorizontal: 8, paddingVertical: 2 },
  stepLabel: { color: theme.textSecondary, fontSize: 10.5, lineHeight: 15, fontWeight: "500", textAlign: "center" },
  stepLabelCompact: { fontSize: 8, lineHeight: 12, letterSpacing: -0.3 },
  stepLabelNarrow: { fontSize: 7.2, letterSpacing: -0.25 },
  stepLabelDone: { color: theme.textPrimary, fontWeight: "500" },
  stepLabelActive: { color: theme.accentPrimary, fontWeight: "700" },
  stepLabelPending: { color: theme.textMuted },
  pipelineFoot: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 18, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: theme.bgElevated, ...webTransition },
  pipelineFootCopy: { flex: 1, minWidth: 0 },
  pipelineFootText: { flexShrink: 1, color: theme.textSecondary, fontSize: 12.5, lineHeight: 18 },
  nodeTooltip: { position: "absolute", top: -48, left: "50%", marginLeft: -64, width: 128, borderRadius: 9, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, gap: 2, zIndex: 20, ...webProps({ boxShadow: "0 8px 20px rgba(0, 0, 0, 0.12)" }) },
  nodeTooltipTitle: { color: theme.textPrimary, fontSize: 10, fontWeight: "700", lineHeight: 14 },
  nodeTooltipMeta: { color: theme.textMuted, fontSize: 8.5, lineHeight: 12, fontFamily: MONO_FONT },

  // Hero
  heroCard: { padding: 24, borderLeftWidth: 4, borderLeftColor: theme.accentPrimary, position: "relative", backgroundColor: theme.bgGlass, ...webProps({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", backgroundImage: theme.isDark ? "linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent 22%)" : "linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 22%)", transitionProperty: "transform, box-shadow, border-color, background-color", transitionDuration: "220ms" }) },
  heroCardHover: { transform: [{ translateY: -3 }], borderColor: theme.accentSoftBorder, ...webProps({ boxShadow: `0 18px 44px -22px ${theme.accentShadow}, 0 2px 8px rgba(0, 0, 0, 0.04)` }) },
  heroGlow: { position: "absolute", top: -40, right: -20, width: 320, height: 220, backgroundColor: theme.accentGlow, borderRadius: 160 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 32 },
  heroTopCompact: { flexDirection: "column", alignItems: "stretch", gap: 20 },
  heroCopy: { flex: 1, minWidth: 0 },
  kicker: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: theme.accentSoft },
  kickerText: { color: theme.accentPrimary, fontSize: 11, fontWeight: "600", letterSpacing: 0.2 },
  heroTitle: { color: theme.textPrimary, fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.5, marginTop: 12 },
  masteryBlock: { marginTop: 22, maxWidth: 620 },
  masteryHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  masteryLabel: { color: theme.textMuted, fontSize: 11.5, fontWeight: "600" },
  masteryValue: { color: theme.accentPrimary, fontSize: 18, fontWeight: "700", fontVariant: ["tabular-nums"] },
  bulletZone: { position: "relative", marginTop: 10, paddingTop: 20 },
  benchLabel: { position: "absolute", top: 0, left: pct(60), marginLeft: -40, width: 80, alignItems: "center" },
  benchLabelText: { color: theme.textMuted, fontSize: 10, fontWeight: "600", fontVariant: ["tabular-nums"] },
  bulletTrack: { height: 10, borderRadius: 999, backgroundColor: theme.bgElevated, position: "relative", ...webTransition },
  bulletFill: { height: "100%", borderRadius: 999, backgroundColor: theme.accentPrimary },
  bulletMarker: { position: "absolute", top: -3, bottom: -3, left: pct(60), width: 2, marginLeft: -1, backgroundColor: theme.textSecondary, zIndex: 2 },
  primaryCta: {
    minHeight: 46,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: theme.accentPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "center",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
    ...(Platform.OS === "web" ? { boxShadow: `0 4px 12px ${theme.accentShadow}` } : {}),
  },
  primaryCtaShimmer: { position: "absolute", top: 0, bottom: 0, left: 0, width: "40%" },
  primaryCtaCompact: { alignSelf: "stretch" },
  primaryCtaHovered: { backgroundColor: theme.accentHover, transform: [{ translateY: -1 }] },
  primaryCtaPressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  primaryCtaText: { color: theme.onAccent, fontSize: 13, fontWeight: "700" },
  primaryCtaArrow: { color: theme.onAccent, fontSize: 15, fontWeight: "700" },
  primaryCtaArrowHovered: { transform: [{ translateX: 4 }] },
  heroMeta: { flexDirection: "row", alignItems: "stretch", gap: 16, marginTop: 22, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.bgElevated, ...webTransition },
  heroMetaCompact: { flexDirection: "column", gap: 10 },
  metaItem: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  metaText: { flexShrink: 1, color: theme.textSecondary, fontSize: 12, lineHeight: 18, fontVariant: ["tabular-nums"] },
  metaLabel: { color: theme.textMuted },
  metaValue: { color: theme.textPrimary, fontWeight: "600" },

  // Profile
  profileCard: { padding: 24 },
  profileHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 20 },
  profileHeadCompact: { flexDirection: "column", alignItems: "stretch", gap: 14 },
  profileHeadCopy: { flexShrink: 1 },
  profileTitle: { color: theme.textPrimary, fontSize: 18, fontWeight: "700", letterSpacing: -0.3 },
  profileGoal: { color: theme.textSecondary, fontSize: 13, lineHeight: 19, marginTop: 5 },
  segmented: { flexDirection: "row", padding: 4, borderRadius: 10, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated, flexShrink: 0, ...webTransition },
  segmentedCompact: { alignSelf: "stretch" },
  segment: { minHeight: 30, paddingHorizontal: 14, borderRadius: 7, borderWidth: 1, borderColor: "transparent", alignItems: "center", justifyContent: "center" },
  segmentCompact: { flex: 1, paddingHorizontal: 6 },
  segmentActive: {
    backgroundColor: theme.segmentActiveBg,
    borderColor: theme.isDark ? theme.borderSubtle : "transparent",
    ...(Platform.OS === "web" ? { boxShadow: theme.isDark ? "0 1px 2px rgba(0, 0, 0, 0.4)" : "0 1px 2px rgba(24, 24, 27, 0.06)" } : {}),
    ...webTransition,
  },
  segmentText: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "500" },
  segmentTextActive: { color: theme.textPrimary, fontWeight: "600" },
  profileBody: { flexDirection: "row", alignItems: "stretch", gap: 22 },
  profileBodyCompact: { flexDirection: "column" },
  radarPanel: { flex: 38, minWidth: 0, backgroundColor: theme.radarBoard, borderWidth: 1, borderColor: theme.borderDivider, borderRadius: 12, padding: 16, ...webTransition },
  radarPanelCompact: { flexGrow: 0, flexShrink: 0, flexBasis: "auto", width: "100%" },
  radarHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 },
  radarTitle: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "600" },
  radarMeta: { color: theme.textMuted, fontSize: 9, fontFamily: MONO_FONT, letterSpacing: 0.8 },
  radarCanvas: { width: "100%", maxWidth: 320, alignSelf: "center" },
  radarFallback: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingVertical: 18 },
  radarFallbackItem: { width: "47%", flexDirection: "row", alignItems: "center", gap: 6 },
  radarFallbackDot: { width: 7, height: 7, borderRadius: 4 },
  radarFallbackLabel: { flex: 1, color: theme.textSecondary, fontSize: 11 },
  radarFallbackValue: { fontSize: 12, fontWeight: "700", fontVariant: ["tabular-nums"] },
  radarLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { color: theme.textMuted, fontSize: 9.5 },
  dimensionPanel: { flex: 62, minWidth: 0, justifyContent: "center" },
  dimensionPanelCompact: { flexGrow: 0, flexShrink: 0, flexBasis: "auto" },
  dimensionPanelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  dimensionPanelTitle: { color: theme.textSecondary, fontSize: 11.5, fontWeight: "600" },
  dimensionPanelMeta: { color: theme.textMuted, fontSize: 9.5 },
  dimensionGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: 18 },
  dimRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: theme.borderDivider },
  dimRowFull: { flexBasis: "100%" },
  dimRowTwoColumn: { flexBasis: "47%", flexGrow: 1, minWidth: 0 },
  dimRowHover: { backgroundColor: theme.accentSoft, borderBottomColor: theme.accentSoftBorder, borderRadius: 8, ...webProps({ boxShadow: `0 0 0 1px ${theme.accentRing}, 0 6px 16px -10px ${theme.accentShadow}` }) },
  dimLabel: { width: 60, flexShrink: 0, color: theme.textSecondary, fontSize: 12 },
  dimTrackWrap: { flex: 1, minWidth: 0, justifyContent: "center" },
  dimTrack: { height: 8, borderRadius: 999, backgroundColor: theme.bgElevated, overflow: "hidden", position: "relative", ...webTransition },
  dimFill: { height: "100%", borderRadius: 999 },
  dimBenchmark: { position: "absolute", top: 0, bottom: 0, left: pct(60), width: 1, backgroundColor: theme.textMuted, opacity: 0.65, zIndex: 2 },
  dimValueWrap: { width: 62, flexShrink: 0, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 },
  dimValue: { color: theme.textPrimary, fontSize: 12.5, fontWeight: "700", textAlign: "right", fontVariant: ["tabular-nums"] },
  microTag: { paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, fontSize: 9, fontWeight: "700", overflow: "hidden" },
  profileFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: theme.borderDivider },
  profileNote: { color: theme.textMuted, fontSize: 12, lineHeight: 18 },

  // Loading / empty states
  statePage: { paddingTop: 40, paddingBottom: 60, paddingHorizontal: 20, maxWidth: 1180, width: "100%", alignSelf: "center", gap: 18 },
  emptyHeader: { gap: 4 },
  stateCard: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 44, paddingHorizontal: 24, borderRadius: 16, borderWidth: 1, borderColor: theme.borderSubtle, backgroundColor: theme.bgSurface },
  stateGlyph: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentSoft, borderWidth: 1, borderColor: theme.accentSoftBorder },
  stateTitle: { color: theme.textPrimary, fontSize: 14, fontWeight: "700", textAlign: "center" },
  stateDetail: { color: theme.textSecondary, fontSize: 12, lineHeight: 19, textAlign: "center", maxWidth: 440 },
  stateAction: { marginTop: 6, minHeight: 40, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: theme.accentPrimary },
  stateActionText: { color: theme.onAccent, fontSize: 12, fontWeight: "700" },
  pressed: { opacity: 0.86 },
  });
}
