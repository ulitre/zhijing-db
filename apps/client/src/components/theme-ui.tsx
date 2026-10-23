import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { ScreenShell } from "./screen-shell";
import { MiniIcon } from "./mini-icon";
import { ThemeSwitcher } from "./theme-switcher";
import { useHydratedWidth } from "../lib/use-hydrated-width";
import { useTheme, type ThemeTokens } from "../state/theme-context";

export const MONO_FONT = Platform.OS === "web"
  ? "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
  : "monospace";

export function pct(value: number): `${number}%` {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export function webOnly(style: Record<string, unknown>): ViewStyle | null {
  return Platform.OS === "web" ? (style as unknown as ViewStyle) : null;
}

export function cardShadow(theme: ThemeTokens): string {
  if (theme.isDark) {
    return theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.12), 0 16px 40px -20px rgba(0, 0, 0, 0.78)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.045), 0 16px 40px -20px rgba(0, 0, 0, 0.75)";
  }
  return "0 4px 20px -2px rgba(24, 24, 27, 0.04), 0 1px 3px -1px rgba(24, 24, 27, 0.02)";
}

export function hoverShadow(theme: ThemeTokens): string {
  if (theme.isDark) {
    return theme.base === "linear"
      ? "inset 0 1px 0 rgba(216, 180, 254, 0.14), 0 18px 44px -18px rgba(0, 0, 0, 0.86)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 18px 44px -18px rgba(0, 0, 0, 0.85)";
  }
  return "0 8px 28px -4px rgba(24, 24, 27, 0.10), 0 2px 6px -2px rgba(24, 24, 27, 0.04)";
}

function webCard(theme: ThemeTokens): ViewStyle {
  return webOnly({
    boxShadow: cardShadow(theme),
    ...(theme.base === "linear" ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {}),
    transitionProperty: "background-color, border-color, box-shadow, transform",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  }) ?? {};
}

function webSurface(theme: ThemeTokens): ViewStyle {
  return webOnly({
    transitionProperty: "background-color, border-color, box-shadow",
    transitionDuration: "200ms",
    transitionTimingFunction: "ease",
  }) ?? {};
}

/** Theme-aware screen canvas used by every tab page. */
export function ThemedScreen({ children, contentContainerStyle }: PropsWithChildren<{ contentContainerStyle?: StyleProp<ViewStyle> }>) {
  const { theme } = useTheme();
  const width = useHydratedWidth();
  return <ScreenShell
    backgroundColor={theme.bgCanvas}
    contentContainerStyle={[styles.page, width >= 960 && styles.pageDesktop, contentContainerStyle]}
  >{children}</ScreenShell>;
}

export function Card({ children, style, accent = false }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; accent?: boolean }>) {
  const { theme } = useTheme();
  return <View style={[
    styles.card,
    { backgroundColor: theme.bgSurface, borderColor: accent ? theme.accentSoftBorder : theme.borderSubtle },
    webCard(theme),
    accent && { borderLeftWidth: 4, borderLeftColor: theme.accentPrimary },
    style,
  ]}>{children}</View>;
}

export function CardPressable({
  children,
  style,
  accent = false,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityState,
  accessibilityRole = "button",
  disabled = false,
  hoverable = false,
  dimWhenDisabled = true,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  accent?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  accessibilityRole?: "button" | "none";
  disabled?: boolean;
  hoverable?: boolean;
  dimWhenDisabled?: boolean;
}>) {
  const { theme } = useTheme();
  const [hovered, setHovered] = useState(false);
  return <Pressable
    accessibilityRole={accessibilityRole === "none" ? undefined : accessibilityRole}
    accessibilityLabel={accessibilityLabel}
    accessibilityHint={accessibilityHint}
    accessibilityState={{ ...accessibilityState, disabled: disabled || accessibilityState?.disabled }}
    disabled={disabled}
    onPress={onPress}
    onHoverIn={() => hoverable && setHovered(true)}
    onHoverOut={() => hoverable && setHovered(false)}
    style={({ pressed }) => [
      styles.card,
      { backgroundColor: theme.bgSurface, borderColor: accent ? theme.accentSoftBorder : theme.borderSubtle },
      webCard(theme),
      hoverable && webOnly({ cursor: "pointer" }),
      hoverable && hovered && { transform: [{ translateY: -2 }], boxShadow: hoverShadow(theme) },
      accent && { borderLeftWidth: 4, borderLeftColor: theme.accentPrimary },
      disabled && dimWhenDisabled && styles.disabled,
      pressed && styles.pressed,
      style,
    ]}
  >{children}</Pressable>;
}

export function PageHeading({
  title,
  subtitle,
  right,
  showThemeSwitcher = true,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
  showThemeSwitcher?: boolean;
}) {
  const { theme } = useTheme();
  const width = useHydratedWidth();
  const compact = width < 640;
  return <View style={[styles.heading, compact && styles.headingCompact]}>
    <View style={styles.headingCopy}>
      <Text style={[styles.headingTitle, compact && styles.headingTitleCompact, { color: theme.textPrimary }]}>{title}</Text>
      <Text style={[styles.headingSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
    <View style={styles.headingActions}>
      {right}
      {showThemeSwitcher ? <ThemeSwitcher compact={width < 720} /> : null}
    </View>
  </View>;
}

export function SectionHeading({ title, meta }: { title: string; meta?: ReactNode }) {
  const { theme } = useTheme();
  return <View style={styles.sectionHeading}>
    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{title}</Text>
    {meta ? <View style={[styles.sectionMetaPill, { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle }]}>
      {typeof meta === "string" ? <Text style={[styles.sectionMeta, { color: theme.textSecondary }]}>{meta}</Text> : meta}
    </View> : null}
  </View>;
}

export function PageKicker({ children, color }: PropsWithChildren<{ color?: string }>) {
  const { theme } = useTheme();
  return <Text style={[styles.kicker, { color: color ?? theme.accentPrimary }]}>{children}</Text>;
}

export function BulletBar({
  value,
  color,
  height = 8,
  marker = 60,
  accessibilityLabel,
  showMarker = true,
}: {
  value: number;
  color: string;
  height?: number;
  marker?: number;
  accessibilityLabel?: string;
  showMarker?: boolean;
}) {
  const { theme } = useTheme();
  return <View
    accessibilityRole="progressbar"
    accessibilityLabel={accessibilityLabel}
    accessibilityValue={{ min: 0, max: 100, now: value }}
    aria-label={accessibilityLabel}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={value}
    style={[styles.bulletTrack, { height, backgroundColor: theme.bgElevated }, webSurface(theme)]}
  >
    <View style={[styles.bulletFill, { width: pct(value), backgroundColor: color }]} />
    {showMarker ? <View style={[
      styles.bulletMarker,
      { left: pct(marker), backgroundColor: theme.textMuted },
      webOnly({ backgroundColor: "transparent", backgroundImage: `repeating-linear-gradient(180deg, ${theme.textMuted} 0 3px, transparent 3px 5px)` }),
    ]} /> : null}
  </View>;
}

export function PulseDot({ color, size = 7 }: { color: string; size?: number }) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 0.35, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(opacity, { toValue: 1, duration: 1200, useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);
  const box = size + 6;
  return <View style={{ width: box, height: box, alignItems: "center", justifyContent: "center" }}>
    <View style={{ position: "absolute", width: box, height: box, borderRadius: box / 2, backgroundColor: color, opacity: 0.16 }} />
    <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }} />
  </View>;
}

export function EmptyPanel({
  glyph = "◇",
  title,
  detail,
  actionLabel,
  onAction,
}: {
  glyph?: string;
  title: string;
  detail?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return <Card style={styles.emptyCard}>
    <View style={[styles.emptyGlyph, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}>
      <Text style={{ color: theme.accentPrimary, fontSize: 18, fontWeight: "700" }}>{glyph}</Text>
    </View>
    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{title}</Text>
    {detail ? <Text style={[styles.emptyDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    {actionLabel && onAction ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      onPress={onAction}
      style={({ pressed }) => [styles.emptyAction, { backgroundColor: theme.accentPrimary }, pressed && styles.pressed]}
    ><Text style={[styles.emptyActionText, { color: theme.onAccent }]}>{actionLabel}</Text></Pressable> : null}
  </Card>;
}

export function LoadingPanel({ title = "正在加载…", detail }: { title?: string; detail?: string }) {
  const { theme } = useTheme();
  return <Card style={styles.emptyCard}>
    <ActivityIndicator color={theme.accentPrimary} />
    <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>{title}</Text>
    {detail ? <Text style={[styles.emptyDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
  </Card>;
}

export function PersonaBadge({ persona }: { persona: "foundation" | "exam" | "practice" }) {
  const { theme } = useTheme();
  const mapping = {
    foundation: { text: "基", color: theme.agent, bg: theme.agentSoft },
    exam: { text: "考", color: theme.warning, bg: theme.warningSoft },
    practice: { text: "践", color: theme.success, bg: theme.successSoft },
  } as const;
  const item = mapping[persona];
  return <View style={[styles.persona, { backgroundColor: item.bg, borderColor: item.color }]}>
    <Text style={{ color: item.color, fontWeight: "700", fontSize: 15 }}>{item.text}</Text>
  </View>;
}

/** Three-level data semantics: success >= threshold, steady >= 60, warning below. */
export function tierColor(theme: ThemeTokens, value: number, successThreshold = 75) {
  if (value >= successThreshold) return { color: theme.success, soft: theme.successSoft };
  if (value >= 60) return { color: theme.accentPrimary, soft: theme.accentSoft };
  return { color: theme.warning, soft: theme.warningSoft };
}

export function IconChip({ icon, color, background }: { icon: Parameters<typeof MiniIcon>[0]["name"]; color: string; background: string }) {
  return <View style={[styles.iconChip, { backgroundColor: background }]}>
    <MiniIcon name={icon} size={14} color={color} />
  </View>;
}

const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 56, paddingHorizontal: 20, maxWidth: 1180, width: "100%", alignSelf: "center", gap: 16 },
  pageDesktop: { paddingHorizontal: 32 },

  card: { borderWidth: 1, borderRadius: 16, padding: 20 },
  disabled: { opacity: 0.62 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.995 }] },

  heading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingBottom: 4, flexWrap: "wrap" },
  headingCompact: { alignItems: "flex-start", gap: 10 },
  headingCopy: { flexShrink: 1, minWidth: 0 },
  headingTitle: { fontSize: 28, lineHeight: 36, fontWeight: "700", letterSpacing: -0.5 },
  headingTitleCompact: { fontSize: 24, lineHeight: 31 },
  headingSubtitle: { fontSize: 16, lineHeight: 24, marginTop: 6 },
  headingActions: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: "auto" },

  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  sectionMetaPill: { borderWidth: 1, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 4 },
  sectionMeta: { fontSize: 10.5, fontWeight: "600", fontVariant: ["tabular-nums"] },
  kicker: { fontSize: 9.5, fontWeight: "700", letterSpacing: 1.1 },

  bulletTrack: { borderRadius: 999, overflow: "hidden", position: "relative" },
  bulletFill: { height: "100%", borderRadius: 999 },
  bulletMarker: { position: "absolute", top: 0, bottom: 0, width: 1, opacity: 0.8, zIndex: 2 },

  emptyCard: { alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 34, paddingHorizontal: 22 },
  emptyGlyph: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  emptyDetail: { fontSize: 12, lineHeight: 19, textAlign: "center", maxWidth: 460 },
  emptyAction: { marginTop: 5, minHeight: 40, paddingHorizontal: 18, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  emptyActionText: { fontSize: 12, fontWeight: "700" },

  persona: { width: 40, height: 40, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },

  iconChip: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
});
