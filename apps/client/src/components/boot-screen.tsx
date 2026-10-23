import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useTheme, type ThemeTokens } from "../state/theme-context";

const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

type WebStyle = ViewStyle & TextStyle;

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>): WebStyle | null {
  return Platform.OS === "web" ? (style as unknown as WebStyle) : null;
}

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;
const webTextAnimation = (style: Record<string, unknown>) => style as unknown as TextStyle;

/**
 * Web animations are registered through StyleSheet.create so react-native-web
 * compiles animationKeyframes into a class rule.
 */
const motion = StyleSheet.create({
  entrance0: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "620ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "0ms" }),
  entrance1: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "620ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "90ms" }),
  entrance2: webAnimation({ animationKeyframes: "fadeInUp", animationDuration: "620ms", animationTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)", animationFillMode: "backwards", animationDelay: "170ms" }),
  glow: webAnimation({ animationKeyframes: "bootGlowBreath", animationDuration: "4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  sweep: webAnimation({ animationKeyframes: "bootSweep", animationDuration: "1.6s", animationTimingFunction: "cubic-bezier(0.65, 0, 0.35, 1)", animationIterationCount: "infinite" }),
  blink: webAnimation({ animationKeyframes: "bootDotBlink", animationDuration: "1.8s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  halo: webAnimation({ animationKeyframes: "bootHalo", animationDuration: "2.4s", animationTimingFunction: "ease-out", animationIterationCount: "infinite" }),
  sheen: webTextAnimation({ animationKeyframes: "bootTextSheen", animationDuration: "4.4s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  wake0: webAnimation({ animationKeyframes: "bootWake", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0s" }),
  wake1: webAnimation({ animationKeyframes: "bootWake", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.18s" }),
  wake2: webAnimation({ animationKeyframes: "bootWake", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.36s" }),
  wake3: webAnimation({ animationKeyframes: "bootWake", animationDuration: "2.4s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0.54s" }),
});

const WAKE = [motion.wake0, motion.wake1, motion.wake2, motion.wake3];

/**
 * Every colour used by the boot screen. On web the values are CSS custom properties,
 * so the server-rendered HTML is theme-agnostic: an inline pre-paint script in
 * `+html.tsx` sets `data-theme` before the first frame and hydration never mismatches.
 */
type BootPalette = {
  canvas: string;
  surface: string;
  elevated: string;
  border: string;
  hairline: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  accentSoftBorder: string;
  accentGlow: string;
  accentHalo: string;
  accentRing: string;
  accentShadow: string;
  success: string;
};

const WEB_PALETTE: BootPalette = {
  canvas: "var(--bg-canvas)",
  surface: "var(--bg-surface)",
  elevated: "var(--bg-elevated)",
  border: "var(--border-subtle)",
  hairline: "var(--boot-hairline)",
  textPrimary: "var(--text-primary)",
  textSecondary: "var(--text-secondary)",
  accent: "var(--accent-primary)",
  accentSoft: "var(--accent-soft)",
  accentSoftBorder: "var(--accent-soft-border)",
  accentGlow: "var(--accent-glow)",
  accentHalo: "var(--accent-halo)",
  accentRing: "var(--accent-ring)",
  accentShadow: "var(--accent-shadow)",
  success: "var(--color-success)",
};

function paletteFor(theme: ThemeTokens): BootPalette {
  if (Platform.OS === "web") return WEB_PALETTE;
  return {
    canvas: theme.bgCanvas,
    surface: theme.bgSurface,
    elevated: theme.bgElevated,
    border: theme.borderSubtle,
    hairline: theme.isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(24, 24, 27, 0.12)",
    textPrimary: theme.textPrimary,
    textSecondary: theme.textSecondary,
    accent: theme.accentPrimary,
    accentSoft: theme.accentSoft,
    accentSoftBorder: theme.accentSoftBorder,
    accentGlow: theme.accentGlow,
    accentHalo: theme.accentHalo,
    accentRing: theme.accentRing,
    accentShadow: theme.accentShadow,
    success: theme.success,
  };
}

const AGENTS = [
  { label: "PROFILE", tone: "accent" },
  { label: "BKT_MODEL", tone: "success" },
  { label: "PATH_GRAPH", tone: "accent" },
  { label: "READY", tone: "success" },
] as const;

const RING_SIZES = [300, 440, 590] as const;
const HEX_CORE = "M60 40 L77.32 50 L77.32 70 L60 80 L42.68 70 L42.68 50 Z";
const CORE_SPARK = "M60 49 L62.6 57.4 L71 60 L62.6 62.6 L60 71 L57.4 62.6 L49 60 L57.4 57.4 Z";
const SATELLITES = [
  { x: 60, y: 14, r: 2.4, tone: "accent" },
  { x: 106, y: 60, r: 2.7, tone: "success" },
  { x: 60, y: 106, r: 2.2, tone: "accent" },
  { x: 14, y: 60, r: 2, tone: "accent" },
] as const;

function useSpin(duration: number, reverse = false) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);
  return progress.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? ["0deg", "-360deg"] : ["0deg", "360deg"],
  });
}

function usePulse(duration: number, from = 0.96, to = 1.06) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const half = duration / 2;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(progress, { toValue: 1, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(progress, { toValue: 0, duration: half, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [duration, progress]);
  return progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] });
}

function useWake(index: number) {
  const [value] = useState(() => new Animated.Value(0.32));
  useEffect(() => {
    const stagger = index * 190;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(stagger),
      Animated.timing(value, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(620),
      Animated.timing(value, { toValue: 0.32, duration: 430, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(Math.max(0, 2400 - stagger - 300 - 620 - 430)),
    ]));
    animation.start();
    return () => animation.stop();
  }, [index, value]);
  return value;
}

/** 88px multi-agent orbital emblem: web gets crisp SVG, native gets an Animated fallback. */
function OrbitalEmblem({ palette }: { palette: BootPalette }) {
  return <View nativeID="boot-emblem" style={styles.emblemWrap}>
    <View
      pointerEvents="none"
      style={[
        styles.emblemHalo,
        { backgroundColor: Platform.OS === "web" ? "transparent" : palette.accentGlow },
        webOnly({ backgroundImage: "radial-gradient(circle, var(--accent-glow) 0%, transparent 68%)" }),
      ]}
    />
    {Platform.OS === "web" ? <SvgEmblem palette={palette} /> : <NativeEmblem palette={palette} />}
  </View>;
}

function SvgEmblem({ palette }: { palette: BootPalette }) {
  const spin = { transformOrigin: "60px 60px", transformBox: "view-box" as const };
  return <svg width={116} height={116} viewBox="0 0 120 120" aria-hidden="true" style={{ overflow: "visible" }}>
    <defs>
      <linearGradient id="bootCometGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor={palette.accent} stopOpacity="0" />
        <stop offset="55%" stopColor={palette.accent} stopOpacity="0.65" />
        <stop offset="100%" stopColor={palette.accent} stopOpacity="1" />
      </linearGradient>
      <radialGradient id="bootCoreHalo">
        <stop offset="0%" stopColor={palette.accentHalo} />
        <stop offset="62%" stopColor={palette.accentGlow} />
        <stop offset="100%" stopColor={palette.accentGlow} stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Outer star track + comet tail */}
    <circle cx="60" cy="60" r="46" fill="none" stroke={palette.hairline} strokeWidth="1" strokeDasharray="2 5" opacity="1" />
    <g style={{ ...spin, animation: "bootOrbitSpin 3s linear infinite" }}>
      <circle cx="60" cy="60" r="46" fill="none" stroke="url(#bootCometGrad)" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="58 231" />
      {SATELLITES.map((satellite, index) => {
        const color = satellite.tone === "success" ? palette.success : palette.accent;
        return <g key={index} style={{ animation: "bootDotBlink 2.6s ease-in-out infinite", animationDelay: `${-index * 0.35}s` }}>
          <circle cx={satellite.x} cy={satellite.y} r={satellite.r + 4.5} fill={color} opacity="0.12" />
          <circle cx={satellite.x} cy={satellite.y} r={satellite.r + 2.2} fill="none" stroke={color} strokeWidth="0.8" opacity="0.4" />
          <circle cx={satellite.x} cy={satellite.y} r={satellite.r} fill={color} />
        </g>;
      })}
    </g>

    {/* Counter-rotating instrument ring */}
    <g style={{ ...spin, animation: "bootOrbitSpinReverse 5s linear infinite" }}>
      <circle cx="60" cy="60" r="30" fill="none" stroke={palette.hairline} strokeWidth="1" strokeDasharray="1 4" opacity="0.9" />
      <circle cx="60" cy="60" r="30" fill="none" stroke={palette.accent} strokeWidth="2.2" strokeLinecap="round" strokeDasharray="10 179" opacity="0.38" />
    </g>

    {/* Ritual pulse ring */}
    <g style={{ ...spin, animation: "bootHalo 2.8s ease-out infinite" }}>
      <circle cx="60" cy="60" r="23" fill="none" stroke={palette.accentRing} strokeWidth="1" />
    </g>

    {/* Knowledge core */}
    <g style={{ ...spin, animation: "bootCorePulse 2s ease-in-out infinite" }}>
      <circle cx="60" cy="60" r="28" fill="url(#bootCoreHalo)" />
      <path
        d={HEX_CORE}
        fill={palette.surface}
        stroke={palette.accent}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 5px var(--accent-shadow))" }}
      />
      <path d={CORE_SPARK} fill={palette.accent} />
    </g>
  </svg>;
}

function NativeEmblem({ palette }: { palette: BootPalette }) {
  const orbit = useSpin(3000);
  const inner = useSpin(5000, true);
  const pulse = usePulse(2000);
  return <>
    <Animated.View style={[styles.nativeOrbit, { borderColor: palette.hairline, transform: [{ rotate: orbit }] }]}>
      <View style={[styles.satellite, styles.satelliteTop, { backgroundColor: palette.accent }]} />
      <View style={[styles.satellite, styles.satelliteRight, { backgroundColor: palette.success }]} />
      <View style={[styles.satellite, styles.satelliteBottom, { backgroundColor: palette.accent }]} />
      <View style={[styles.satellite, styles.satelliteLeft, { backgroundColor: palette.accent }]} />
    </Animated.View>
    <Animated.View style={[styles.nativeInner, { borderColor: palette.hairline, borderTopColor: palette.accent, transform: [{ rotate: inner }] }]} />
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <View style={[styles.nativeCoreHalo, { backgroundColor: palette.accentGlow }]} />
      <View style={[styles.nativeCore, { backgroundColor: palette.surface, borderColor: palette.accent, shadowColor: palette.accent }]}>
        <Text style={[styles.nativeCoreGlyph, { color: palette.accent, transform: [{ rotate: "-45deg" }] }]}>✦</Text>
      </View>
    </Animated.View>
  </>;
}

function AgentPill({ index, label, color, compact, palette }: {
  index: number;
  label: string;
  color: string;
  compact: boolean;
  palette: BootPalette;
}) {
  if (Platform.OS !== "web") return <NativeAgentPill index={index} label={label} color={color} compact={compact} palette={palette} />;
  return <View style={styles.agent}>
    <View style={[styles.agentDot, { backgroundColor: color }, WAKE[index]]} />
    <Text style={[styles.agentLabel, { color: palette.textSecondary }, compact && styles.agentLabelCompact]}>{label}</Text>
  </View>;
}

function NativeAgentPill({ index, label, color, compact, palette }: {
  index: number;
  label: string;
  color: string;
  compact: boolean;
  palette: BootPalette;
}) {
  const wake = useWake(index);
  return <View style={styles.agent}>
    <Animated.View style={[
      styles.agentDot,
      {
        backgroundColor: color,
        opacity: wake,
        transform: [{ scale: wake.interpolate({ inputRange: [0.32, 1], outputRange: [0.82, 1.14] }) }],
      },
    ]} />
    <Text style={[styles.agentLabel, { color: palette.textSecondary }, compact && styles.agentLabelCompact]}>{label}</Text>
  </View>;
}

function ProgressTrack({ palette }: { palette: BootPalette }) {
  return <View
    accessibilityRole="progressbar"
    accessibilityLabel="正在恢复学习画像"
    style={[styles.track, { backgroundColor: palette.elevated, borderColor: palette.border }]}
  >
    {Platform.OS === "web"
      ? <View style={[
        styles.sweepFill,
        motion.sweep,
        { backgroundImage: "linear-gradient(90deg, transparent 0%, var(--accent-primary) 42%, var(--accent-gradient-from) 74%, rgba(255, 255, 255, 0.92) 100%)" },
      ]} />
      : <NativeSweep color={palette.accent} />}
  </View>;
}

function NativeSweep({ color }: { color: string }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(progress, {
      toValue: 1,
      duration: 1600,
      easing: Easing.bezier(0.65, 0, 0.35, 1),
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [progress]);
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-140, 340] });
  return <Animated.View style={[styles.sweepFill, styles.nativeSweepFill, { backgroundColor: color, transform: [{ translateX }] }]} />;
}

function TelemetryDock({ palette, compact }: { palette: BootPalette; compact: boolean }) {
  return <View nativeID="boot-telemetry" style={[
    styles.dock,
    { backgroundColor: palette.surface, borderColor: palette.border },
    webOnly({ boxShadow: "0 22px 48px -30px var(--accent-shadow)" }),
  ]}>
    <View style={styles.dockHead}>
      <Text style={[styles.dockKicker, { color: palette.textSecondary }]}>AGENT PIPELINE</Text>
      <View style={styles.liveWrap}>
        <View style={[styles.liveDot, { backgroundColor: palette.success }, motion.blink]} />
        <Text style={[styles.liveText, { color: palette.success }]}>LIVE</Text>
      </View>
    </View>
    <ProgressTrack palette={palette} />
    <View nativeID="boot-agents" style={styles.agentRow}>
      {AGENTS.map((agent, index) => <AgentPill
        key={agent.label}
        index={index}
        label={agent.label}
        color={agent.tone === "success" ? palette.success : palette.accent}
        compact={compact}
        palette={palette}
      />)}
    </View>
  </View>;
}

function NativeGlow({ palette }: { palette: BootPalette }) {
  const breath = usePulse(4000, 0.95, 1.08);
  const opacity = breath.interpolate({ inputRange: [0.95, 1.08], outputRange: [0.72, 1] });
  return <Animated.View style={[
    styles.glow,
    { backgroundColor: palette.accentGlow, opacity, transform: [{ scale: breath }] },
  ]}>
    <View style={[styles.glowInner, { backgroundColor: palette.accentHalo }]} />
  </Animated.View>;
}

function BootBackdrop({ palette }: { palette: BootPalette }) {
  return <View pointerEvents="none" style={[styles.backdrop, { backgroundColor: palette.canvas }]}>
    <View style={[
      styles.grid,
      webOnly({
        backgroundImage: "linear-gradient(var(--boot-hairline) 1px, transparent 1px), linear-gradient(90deg, var(--boot-hairline) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(circle at 50% 44%, #000 0%, rgba(0, 0, 0, 0.4) 46%, transparent 70%)",
        WebkitMaskImage: "radial-gradient(circle at 50% 44%, #000 0%, rgba(0, 0, 0, 0.4) 46%, transparent 70%)",
      }),
    ]} />
    {RING_SIZES.map((size, index) => <View
      key={size}
      style={[
        styles.orbitRing,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          borderRadius: size / 2,
          borderColor: palette.hairline,
          opacity: index === 1 ? 1 : index === 0 ? 0.9 : 0.6,
        },
      ]}
    />)}
    {Platform.OS === "web"
      ? <View style={[
        styles.glow,
        motion.glow,
        { backgroundColor: "transparent" },
        webOnly({ backgroundImage: "radial-gradient(circle at 50% 50%, var(--accent-halo) 0%, var(--accent-glow) 44%, transparent 72%)" }),
      ]} />
      : <NativeGlow palette={palette} />}
  </View>;
}

/**
 * Brand boot screen. The three lines below are contract-stable for waiting states:
 * `MULTI-AGENT LEARNING`, `知径 DB` and the recovery status message.
 */
export function BootScreen({
  eyebrow = "MULTI-AGENT LEARNING",
  title = "知径 DB",
  message = "正在恢复学习画像与个性化路径…",
}: {
  eyebrow?: string;
  title?: string;
  message?: string;
}) {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  // Window width is 0 during static rendering. Keep the web branch stable across
  // SSR + hydration and let the CSS media query in +html.tsx squeeze the labels.
  const compact = Platform.OS !== "web" && width < 390;
  const palette = paletteFor(theme);

  const titleMarkIndex = title.lastIndexOf("DB");
  const hasTitleMark = title.trim().endsWith("DB") && titleMarkIndex >= 0;
  const titleLead = hasTitleMark ? title.slice(0, titleMarkIndex) : title;

  return <View nativeID="boot-screen" style={[styles.root, { backgroundColor: palette.canvas }]}>
    <BootBackdrop palette={palette} />
    <View style={styles.content}>
      <View style={motion.entrance0}>
        <OrbitalEmblem palette={palette} />
      </View>

      <View style={[styles.lockup, motion.entrance1]}>
        <View style={[styles.pill, { backgroundColor: palette.accentSoft, borderColor: palette.accentSoftBorder }]}>
          <View style={styles.pillDotBox}>
            <View style={[styles.pillDotHalo, { backgroundColor: palette.accentRing }, motion.halo]} />
            <View style={[styles.pillDot, { backgroundColor: palette.accent }, motion.blink]} />
          </View>
          <Text style={[styles.pillText, { color: palette.accent }]}>{eyebrow}</Text>
        </View>

        <Text style={[styles.title, { color: palette.textPrimary }]}>
          {hasTitleMark ? <>
            {titleLead}
            <Text style={[
              styles.titleMark,
              { color: palette.accent },
              webOnly({
                backgroundImage: "var(--accent-gradient)",
                backgroundClip: "text",
                color: "transparent",
              }),
            ]}>DB</Text>
          </> : title}
        </Text>

        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.subtitle,
            { color: palette.textSecondary },
            webOnly({
              backgroundImage: "linear-gradient(100deg, var(--text-secondary) 0%, var(--text-secondary) 34%, var(--accent-hover) 48%, var(--text-primary) 54%, var(--text-secondary) 68%, var(--text-secondary) 100%)",
              backgroundSize: "240% 100%",
              backgroundClip: "text",
              color: "transparent",
            }),
            motion.sheen,
          ]}
        >{message}</Text>
      </View>

      <View style={[styles.dockWrap, motion.entrance2]}>
        <TelemetryDock palette={palette} compact={compact} />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
    overflow: "hidden",
  },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  grid: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, opacity: 0.75 },
  glow: {
    position: "absolute",
    left: "50%",
    top: "46%",
    width: 480,
    height: 480,
    marginLeft: -240,
    marginTop: -240,
    borderRadius: 240,
  },
  glowInner: {
    position: "absolute",
    left: 80,
    top: 80,
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.55,
  },
  orbitRing: {
    position: "absolute",
    left: "50%",
    top: "46%",
    borderWidth: 1,
    borderStyle: "dashed",
  },

  content: { width: "100%", maxWidth: 380, alignItems: "center", gap: 22 },
  dockWrap: { width: "100%", alignItems: "center" },
  emblemWrap: { width: 128, height: 128, alignItems: "center", justifyContent: "center" },
  emblemHalo: { position: "absolute", width: 190, height: 190, borderRadius: 95 },

  nativeOrbit: {
    position: "absolute",
    top: 18,
    left: 18,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  nativeInner: {
    position: "absolute",
    top: 34,
    left: 34,
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
  },
  satellite: { position: "absolute", width: 6, height: 6, borderRadius: 3 },
  satelliteTop: { top: -3.5, left: 42.5 },
  satelliteRight: { top: 42.5, right: -3.5 },
  satelliteBottom: { bottom: -3.5, left: 42.5 },
  satelliteLeft: { top: 42.5, left: -3.5 },
  nativeCoreHalo: { position: "absolute", width: 64, height: 64, borderRadius: 32, top: -11, left: -11, opacity: 0.75 },
  nativeCore: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  nativeCoreGlyph: { fontSize: 17, fontWeight: "700", lineHeight: 20 },

  lockup: { width: "100%", alignItems: "center" },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillDotBox: { width: 12, height: 12, alignItems: "center", justifyContent: "center" },
  pillDotHalo: { position: "absolute", width: 12, height: 12, borderRadius: 6 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 1.7, lineHeight: 14 },

  title: {
    fontSize: 38,
    lineHeight: 47,
    fontWeight: "800",
    letterSpacing: -1.2,
    textAlign: "center",
    marginTop: 15,
  },
  titleMark: { fontFamily: MONO_FONT, fontSize: 32, fontWeight: "700", letterSpacing: 0.6 },

  subtitle: {
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 7,
    maxWidth: 330,
  },

  dock: {
    width: "100%",
    maxWidth: 348,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    gap: 11,
    alignSelf: "center",
  },
  dockHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dockKicker: { fontFamily: MONO_FONT, fontSize: 9, fontWeight: "700", letterSpacing: 1.6, lineHeight: 12 },
  liveWrap: { flexDirection: "row", alignItems: "center", gap: 5 },
  liveDot: { width: 5, height: 5, borderRadius: 2.5 },
  liveText: { fontFamily: MONO_FONT, fontSize: 9, fontWeight: "700", letterSpacing: 1.1, lineHeight: 12 },

  track: {
    height: 6,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  sweepFill: { width: "38%", height: "100%", borderRadius: 999 },
  nativeSweepFill: { opacity: 0.92 },

  agentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 },
  agent: { flexDirection: "row", alignItems: "center", gap: 5 },
  agentDot: { width: 6, height: 6, borderRadius: 3 },
  agentLabel: { fontFamily: MONO_FONT, fontSize: 11, fontWeight: "600", letterSpacing: 0.2, lineHeight: 14 },
  agentLabelCompact: { fontSize: 9.5, letterSpacing: 0, lineHeight: 12 },
});
