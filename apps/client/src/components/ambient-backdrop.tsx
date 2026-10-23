import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { useTheme, type ThemeTokens } from "../state/theme-context";

type WebStyle = ViewStyle;

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>): WebStyle | null {
  return Platform.OS === "web" ? (style as unknown as WebStyle) : null;
}

const webAnimation = (style: Record<string, unknown>) => style as unknown as ViewStyle;

/**
 * The orbit keyframes live in `+html.tsx` (shared with the boot screen). Registering
 * them through StyleSheet.create lets react-native-web emit real class rules.
 */
const motion = StyleSheet.create({
  spin: webAnimation({ animationKeyframes: "bootOrbitSpin", animationDuration: "46s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  spinSlow: webAnimation({ animationKeyframes: "bootOrbitSpin", animationDuration: "72s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  spinReverse: webAnimation({ animationKeyframes: "bootOrbitSpinReverse", animationDuration: "58s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
  satellite: webAnimation({ animationKeyframes: "bootDotBlink", animationDuration: "3.6s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }),
  star0: webAnimation({ animationKeyframes: "starTwinkle", animationDuration: "4.2s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "0s" }),
  star1: webAnimation({ animationKeyframes: "starTwinkle", animationDuration: "5.1s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-1.3s" }),
  star2: webAnimation({ animationKeyframes: "starTwinkle", animationDuration: "6s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-2.4s" }),
  star3: webAnimation({ animationKeyframes: "starTwinkle", animationDuration: "4.6s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDelay: "-3.2s" }),
  auroraA: webAnimation({ animationKeyframes: "auroraDriftA", animationDuration: "13s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDirection: "alternate" }),
  auroraB: webAnimation({ animationKeyframes: "auroraDriftB", animationDuration: "16s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite", animationDirection: "alternate", animationDelay: "-4s" }),
  scan: webAnimation({ animationKeyframes: "gridScan", animationDuration: "11s", animationTimingFunction: "linear", animationIterationCount: "infinite" }),
});

type Satellite = { angle: number; color: string; size: number };

function OrbitalRing({
  size,
  borderColor,
  satellites,
  motionStyle,
  reducedMotion,
}: {
  size: number;
  borderColor: string;
  satellites: readonly Satellite[];
  motionStyle: ViewStyle | null;
  reducedMotion: boolean;
}) {
  return <View
    style={{
      position: "absolute",
      left: "50%",
      top: "50%",
      width: size,
      height: size,
      marginLeft: -size / 2,
      marginTop: -size / 2,
      borderRadius: size / 2,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor,
    }}
  >
    <View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }, !reducedMotion ? motionStyle : null]}>
      {satellites.map((satellite, index) => <View
        key={`${satellite.angle}-${index}`}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          transform: [{ rotate: `${satellite.angle}deg` }],
        }}
      >
        <View style={{
          position: "absolute",
          left: "50%",
          top: -satellite.size,
          marginLeft: -satellite.size,
          width: satellite.size * 2,
          height: satellite.size * 2,
          borderRadius: satellite.size,
          backgroundColor: satellite.color,
          opacity: 0.16,
        }} />
        <View style={{
          position: "absolute",
          left: "50%",
          top: -(satellite.size / 2),
          marginLeft: -(satellite.size / 2),
          width: satellite.size,
          height: satellite.size,
          borderRadius: satellite.size / 2,
          backgroundColor: satellite.color,
        }} />
      </View>)}
    </View>
  </View>;
}

const STAR_MOTIONS = [motion.star0, motion.star1, motion.star2, motion.star3];

/** Fixed constellation for the 紫霞 dark mode — deterministic, so SSR stays stable. */
const STARS = [
  { left: "8%", top: "14%", size: 2 },
  { left: "18%", top: "32%", size: 1.5 },
  { left: "27%", top: "9%", size: 2.4 },
  { left: "38%", top: "22%", size: 1.6 },
  { left: "47%", top: "12%", size: 2 },
  { left: "58%", top: "30%", size: 1.5 },
  { left: "67%", top: "8%", size: 2.2 },
  { left: "78%", top: "19%", size: 1.7 },
  { left: "88%", top: "35%", size: 2 },
  { left: "12%", top: "58%", size: 1.4 },
  { left: "23%", top: "72%", size: 2 },
  { left: "35%", top: "62%", size: 1.5 },
  { left: "52%", top: "78%", size: 1.8 },
  { left: "64%", top: "66%", size: 1.4 },
  { left: "75%", top: "82%", size: 2.2 },
  { left: "86%", top: "70%", size: 1.6 },
  { left: "92%", top: "48%", size: 1.4 },
  { left: "5%", top: "84%", size: 1.8 },
] as const;

function glowFor(theme: ThemeTokens, tone: "accent" | "success") {
  if (theme.base === "gemini") {
    return tone === "accent"
      ? theme.accentGlow
      : theme.isDark ? "rgba(56, 189, 248, 0.10)" : "rgba(56, 189, 248, 0.08)";
  }
  if (tone === "success") {
    return theme.isDark ? "rgba(45, 212, 191, 0.08)" : "rgba(13, 148, 136, 0.08)";
  }
  return theme.isDark ? "rgba(224, 122, 95, 0.12)" : "rgba(217, 119, 87, 0.12)";
}

/**
 * Shared warm-editorial backdrop used by the login and guide pages.
 *
 * It reproduces the boot screen's orbital radar (three dashed concentric tracks with
 * slowly orbiting terracotta/teal satellites), adds a warm aurora wash, a low-contrast
 * blueprint grid and a soft scanning beam. Everything is driven by the active theme.
 */
export function AmbientBackdrop({
  variant = "hero",
  reducedMotion = false,
}: {
  variant?: "hero" | "corner" | "band";
  reducedMotion?: boolean;
}) {
  const { theme } = useTheme();
  const width = useHydratedWidth();
  const [nativeSpin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (Platform.OS === "web" || reducedMotion) return;
    const animation = Animated.loop(Animated.timing(nativeSpin, {
      toValue: 1,
      duration: 64000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [nativeSpin, reducedMotion]);

  const unit = Math.min(Math.max(width, 380), 1180);
  const ringScale = variant === "corner" ? 0.82 : variant === "band" ? 0.94 : 1;
  const rings = [0.36, 0.58, 0.82].map((ratio) => Math.round(unit * ratio * ringScale));
  const anchor = variant === "corner"
    ? { left: "82%", top: "-4%" } as const
    : variant === "band"
      ? { left: "50%", top: "34%" } as const
      : { left: "46%", top: "20%" } as const;

  const twilight = theme.base === "linear";
  const icy = theme.base === "gemini";
  const hairline = twilight
    ? theme.isDark ? "rgba(196, 181, 253, 0.12)" : "rgba(124, 58, 237, 0.16)"
    : icy
      ? theme.isDark ? "rgba(125, 211, 252, 0.12)" : "rgba(2, 132, 199, 0.16)"
      : theme.isDark ? "rgba(255, 255, 255, 0.09)" : "rgba(120, 113, 108, 0.17)";
  const accentHairline = twilight
    ? theme.isDark ? "rgba(217, 70, 239, 0.30)" : "rgba(219, 39, 119, 0.24)"
    : icy
      ? theme.isDark ? "rgba(56, 189, 248, 0.30)" : "rgba(2, 132, 199, 0.24)"
      : theme.isDark ? "rgba(224, 122, 95, 0.28)" : "rgba(217, 119, 87, 0.24)";
  const gridLine = twilight
    ? theme.isDark ? "rgba(196, 181, 253, 0.04)" : "rgba(124, 58, 237, 0.055)"
    : icy
      ? theme.isDark ? "rgba(125, 211, 252, 0.04)" : "rgba(2, 132, 199, 0.055)"
      : theme.isDark ? "rgba(255, 255, 255, 0.035)" : "rgba(120, 113, 108, 0.06)";
  const scanTint = twilight
    ? theme.isDark ? "rgba(168, 85, 247, 0.12)" : "rgba(217, 70, 239, 0.08)"
    : icy
      ? theme.isDark ? "rgba(56, 189, 248, 0.12)" : "rgba(2, 132, 199, 0.09)"
      : theme.isDark ? "rgba(224, 122, 95, 0.10)" : "rgba(217, 119, 87, 0.10)";
  const accent = theme.accentPrimary;
  const secondary = twilight || icy ? theme.accentSecondary : theme.success;
  const tertiary = twilight ? "#F97316" : theme.success;
  const auroraLeftSolid = twilight
    ? theme.isDark ? "rgba(139, 92, 246, 0.16)" : "rgba(139, 92, 246, 0.12)"
    : glowFor(theme, "accent");
  const auroraRightSolid = twilight
    ? theme.isDark ? "rgba(217, 70, 239, 0.10)" : "rgba(244, 63, 94, 0.08)"
    : glowFor(theme, "success");
  const auroraLeftGradient = twilight
    ? theme.isDark
      ? "radial-gradient(circle, rgba(139, 92, 246, 0.16) 0%, rgba(217, 70, 239, 0.06) 48%, transparent 72%)"
      : "radial-gradient(circle, rgba(139, 92, 246, 0.12) 0%, rgba(217, 70, 239, 0.05) 45%, transparent 70%)"
    : `radial-gradient(circle at center, ${glowFor(theme, "accent")} 0%, transparent 68%)`;
  const auroraRightGradient = twilight
    ? theme.isDark
      ? "radial-gradient(circle, rgba(217, 70, 239, 0.10) 0%, rgba(249, 115, 22, 0.04) 48%, transparent 72%)"
      : "radial-gradient(circle, rgba(244, 63, 94, 0.08) 0%, rgba(249, 115, 22, 0.05) 45%, transparent 70%)"
    : `radial-gradient(circle at center, ${glowFor(theme, "success")} 0%, transparent 68%)`;

  const nativeRotate = nativeSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const webSpin = reducedMotion ? null : motion.spin;
  const webSpinReverse = reducedMotion ? null : motion.spinReverse;
  const webSpinSlow = reducedMotion ? null : motion.spinSlow;

  return <View pointerEvents="none" style={[styles.root, { backgroundColor: theme.bgCanvas }]}>
    <View style={[
      styles.grid,
      webOnly({
        backgroundImage: `linear-gradient(${gridLine} 1px, transparent 1px), linear-gradient(90deg, ${gridLine} 1px, transparent 1px)`,
        backgroundSize: "46px 46px",
        maskImage: "radial-gradient(140% 100% at 48% 8%, #000 0%, rgba(0, 0, 0, 0.45) 52%, transparent 82%)",
        WebkitMaskImage: "radial-gradient(140% 100% at 48% 8%, #000 0%, rgba(0, 0, 0, 0.45) 52%, transparent 82%)",
      }),
    ]} />
    <View style={[
      styles.scan,
      motion.scan,
      webOnly({ backgroundImage: `linear-gradient(180deg, transparent, ${scanTint}, transparent)` }),
    ]} />

    <View style={[
      styles.aurora,
      styles.auroraLeft,
      motion.auroraA,
      { backgroundColor: auroraLeftSolid },
      webOnly({
        backgroundImage: auroraLeftGradient,
        backgroundColor: "transparent",
        filter: "blur(46px)",
      }),
    ]} />
    <View style={[
      styles.aurora,
      styles.auroraRight,
      motion.auroraB,
      { backgroundColor: auroraRightSolid },
      webOnly({
        backgroundImage: auroraRightGradient,
        backgroundColor: "transparent",
        filter: "blur(52px)",
      }),
    ]} />

    {twilight && theme.isDark && Platform.OS === "web" ? <View style={styles.starField}>
      {STARS.map((star, index) => <View
        key={`${star.left}-${star.top}`}
        style={[
          styles.star,
          {
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: theme.textSecondary,
          },
          STAR_MOTIONS[index % STAR_MOTIONS.length],
        ]}
      />)}
    </View> : null}

    <View
      style={[
        styles.orbitAnchor,
        {
          left: anchor.left,
          top: anchor.top,
          transform: Platform.OS === "web" || reducedMotion ? undefined : [{ rotate: nativeRotate }],
        },
      ]}
    >
      <View style={[styles.orbitGlow, { backgroundColor: theme.accentGlow }]} />
      <OrbitalRing size={rings[0]!} borderColor={accentHairline} reducedMotion={reducedMotion} motionStyle={webSpinSlow} satellites={[]} />
      <OrbitalRing size={rings[1]!} borderColor={hairline} reducedMotion={reducedMotion} motionStyle={webSpinReverse} satellites={[
        { angle: 32, color: secondary, size: 4.5 },
        { angle: 212, color: accent, size: 3.6 },
      ]} />
      <OrbitalRing size={rings[2]!} borderColor={hairline} reducedMotion={reducedMotion} motionStyle={webSpin} satellites={[
        { angle: 12, color: accent, size: 4.4 },
        { angle: 108, color: secondary, size: 3.4 },
        { angle: 196, color: tertiary, size: 3.8 },
        { angle: 294, color: secondary, size: 4.2 },
      ]} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: "hidden",
  },
  grid: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.9,
  },
  scan: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 220,
  },
  aurora: {
    position: "absolute",
    width: 620,
    height: 620,
    borderRadius: 310,
  },
  auroraLeft: { top: -240, left: -220 },
  auroraRight: { right: -230, bottom: -250 },
  starField: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  star: {
    position: "absolute",
  },
  orbitAnchor: {
    position: "absolute",
  },
  orbitGlow: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 420,
    height: 420,
    marginLeft: -210,
    marginTop: -210,
    borderRadius: 210,
    opacity: 0.6,
  },
});
