import type { PropsWithChildren, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type AccessibilityState, type GestureResponderEvent } from "react-native";
import { useTheme, THEMES } from "../state/theme-context";
import { MONO_FONT } from "./theme-ui";

/**
 * Legacy static palette retained for data-only consumers. Every visual
 * component below resolves its colours from useTheme(), so this map never
 * leaks a dark surface into a light route.
 */
export const palette = {
  background: THEMES["claude-light"].bgCanvas,
  backgroundSecondary: THEMES["claude-light"].bgElevated,
  ink: THEMES["claude-light"].textPrimary,
  muted: THEMES["claude-light"].textSecondary,
  secondaryText: THEMES["claude-light"].textSecondary,
  blue: THEMES["claude-light"].agent,
  purple: THEMES["claude-light"].accentPrimary,
  violet: THEMES["claude-light"].accentPrimary,
  lavender: THEMES["claude-light"].accentSoft,
  surface: THEMES["claude-light"].bgSurface,
  line: THEMES["claude-light"].borderSubtle,
  success: THEMES["claude-light"].success,
  warning: THEMES["claude-light"].warning,
  danger: THEMES["claude-light"].warning,
} as const;

export function BrandHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  const { theme } = useTheme();
  return <View>
    <Text style={[styles.eyebrow, { color: theme.accentPrimary }]}>{eyebrow}</Text>
    <Text style={[styles.brandTitle, { color: theme.textPrimary }]}>{title}</Text>
    <Text style={[styles.brandSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
  </View>;
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  const { theme } = useTheme();
  return <View style={styles.pageHeader}>
    <View style={styles.headerCopy}>
      <Text style={[styles.pageTitle, { color: theme.textPrimary }]}>{title}</Text>
      <Text style={[styles.pageSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
    </View>
    {right}
  </View>;
}

type GlassCardProps = PropsWithChildren<{
  accent?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityState?: AccessibilityState;
  disabled?: boolean;
}>;

export function GlassCard({ children, accent = false, onPress, accessibilityLabel, accessibilityHint, accessibilityState, disabled = false }: GlassCardProps) {
  const { theme } = useTheme();
  const surface = {
    backgroundColor: theme.bgSurface,
    borderColor: accent ? theme.accentSoftBorder : theme.borderSubtle,
  };
  const content = <View style={[styles.cardInner, surface, accent && { borderLeftWidth: 3, borderLeftColor: theme.accentPrimary }]}>{children}</View>;
  if (onPress) {
    return <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ ...accessibilityState, disabled: disabled || accessibilityState?.disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.card, surface, pressed && !disabled && styles.cardPressed, disabled && styles.cardDisabled]}
    >{content}</Pressable>;
  }
  return <View style={[styles.card, surface]}>{content}</View>;
}

export function AgentStreamerBadge({ label = "Agent Stream", status = "运行中" }: { label?: string; status?: string }) {
  const { theme } = useTheme();
  return <View style={[styles.agentBadge, { borderColor: theme.accentSoftBorder, backgroundColor: theme.accentSoft }]}>
    <View style={[styles.agentDotHalo, { backgroundColor: theme.accentHalo }]}><View style={[styles.agentDot, { backgroundColor: theme.accentPrimary }]} /></View>
    <Text style={[styles.agentLabel, { color: theme.textPrimary }]}>{label}</Text>
    <Text style={[styles.agentStatus, { color: theme.accentPrimary }]}>{status}</Text>
  </View>;
}

export function SectionTitle({ children, meta }: PropsWithChildren<{ meta?: string }>) {
  const { theme } = useTheme();
  return <View style={styles.sectionRow}>
    <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>{children}</Text>
    {meta ? <Text style={[styles.sectionMeta, { color: theme.accentPrimary }]}>{meta}</Text> : null}
  </View>;
}

export function LoadingState({
  title = "正在加载…",
  detail,
  compact = false,
}: {
  title?: string;
  detail?: string;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  return <View
    accessibilityRole="progressbar"
    accessibilityLabel={detail ? `${title}，${detail}` : title}
    style={[styles.stateBox, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }, compact && styles.stateBoxCompact]}
  >
    <ActivityIndicator color={theme.accentPrimary} />
    <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>{title}</Text>
    {detail ? <Text style={[styles.stateDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
  </View>;
}

export function EmptyState({
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
  return <View style={[styles.stateBox, { borderColor: theme.borderSubtle, backgroundColor: theme.bgElevated }]}>
    <View style={[styles.stateGlyphBox, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoftBorder }]}><Text style={[styles.stateGlyph, { color: theme.accentPrimary }]}>{glyph}</Text></View>
    <Text style={[styles.stateTitle, { color: theme.textPrimary }]}>{title}</Text>
    {detail ? <Text style={[styles.stateDetail, { color: theme.textSecondary }]}>{detail}</Text> : null}
    {actionLabel && onAction ? <Pressable
      accessibilityRole="button"
      accessibilityLabel={actionLabel}
      onPress={onAction}
      style={({ pressed }) => [styles.stateAction, { backgroundColor: theme.accentPrimary }, pressed && styles.cardPressed]}
    ><Text style={[styles.stateActionText, { color: theme.onAccent }]}>{actionLabel}</Text></Pressable> : null}
  </View>;
}

export function PersonaBadge({ persona }: { persona: "foundation" | "exam" | "practice" }) {
  const { theme } = useTheme();
  const mapping = {
    foundation: { text: "基", color: theme.agent, bg: theme.agentSoft },
    exam: { text: "考", color: theme.warning, bg: theme.warningSoft },
    practice: { text: "践", color: theme.success, bg: theme.successSoft },
  } as const;
  const item = mapping[persona];
  return <View style={[styles.badge, { backgroundColor: item.bg, borderColor: `${item.color}44`, borderWidth: 1 }]}><Text style={{ color: item.color, fontWeight: "900" }}>{item.text}</Text></View>;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return <ProgressTrack value={value} color={color ?? masteryColor(value)} />;
}

export function MasteryProgressBar({ value }: { value: number }) {
  return <ProgressTrack value={value} color={masteryColor(value)} />;
}

function ProgressTrack({ value, color }: { value: number; color: string }) {
  const { theme } = useTheme();
  const normalized = Math.max(0, Math.min(100, value));
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: normalized }} style={[styles.progressTrack, { backgroundColor: theme.bgSubtleHover }]}>
    <View style={[styles.progressGlow, { width: `${normalized}%`, backgroundColor: color }]} />
  </View>;
}

function masteryColor(value: number) {
  if (value >= 80) return palette.success;
  if (value >= 60) return palette.warning;
  return palette.danger;
}

const styles = StyleSheet.create({
  eyebrow: { fontSize: 11, letterSpacing: 2.1, fontWeight: "900", marginBottom: 9, fontFamily: MONO_FONT },
  brandTitle: { fontSize: 46, letterSpacing: -2, fontWeight: "900" },
  brandSubtitle: { fontSize: 16, lineHeight: 25, marginTop: 10, maxWidth: 560 },
  pageHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  headerCopy: { flex: 1 },
  pageTitle: { fontSize: 27, fontWeight: "900", letterSpacing: -0.7 },
  pageSubtitle: { fontSize: 13, marginTop: 5, lineHeight: 19 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  cardDisabled: { opacity: 0.72 },
  cardInner: { padding: 18, borderWidth: 1, borderRadius: 19 },
  agentBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1 },
  agentDotHalo: { width: 10, height: 10, borderRadius: 5, alignItems: "center", justifyContent: "center" },
  agentDot: { width: 5, height: 5, borderRadius: 3 },
  agentLabel: { fontSize: 11, fontWeight: "800" },
  agentStatus: { fontSize: 10, fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  sectionTitle: { fontWeight: "900", fontSize: 17, flexShrink: 1 },
  sectionMeta: { fontWeight: "800", fontSize: 12 },
  stateBox: { alignItems: "center", justifyContent: "center", gap: 9, paddingVertical: 30, paddingHorizontal: 20, borderRadius: 18, borderWidth: 1, borderStyle: "dashed" },
  stateBoxCompact: { paddingVertical: 18 },
  stateGlyphBox: { width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  stateGlyph: { fontSize: 18, fontWeight: "900" },
  stateTitle: { fontSize: 14, fontWeight: "900", textAlign: "center" },
  stateDetail: { fontSize: 11, lineHeight: 18, textAlign: "center", maxWidth: 420 },
  stateAction: { marginTop: 5, minHeight: 40, paddingHorizontal: 18, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stateActionText: { fontSize: 11, fontWeight: "900" },
  badge: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 7, borderRadius: 99, overflow: "hidden" },
  progressGlow: { height: "100%", borderRadius: 99, overflow: "hidden" },
});
