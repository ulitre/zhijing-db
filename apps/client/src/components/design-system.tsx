import { useEffect, useState, type PropsWithChildren, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type GestureResponderEvent } from "react-native";

export const palette = {
  background: "#020617",
  backgroundSecondary: "#0b1329",
  ink: "#F8FAFC",
  muted: "#CBD5E1",
  secondaryText: "#CBD5E1",
  blue: "#3b82f6",
  purple: "#6366f1",
  violet: "#818cf8",
  lavender: "#1E1B4B",
  surface: "rgba(10, 15, 30, 0.88)",
  line: "rgba(255, 255, 255, 0.08)",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

export function BrandHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <View><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.brandTitle}>{title}</Text><Text style={styles.brandSubtitle}>{subtitle}</Text></View>;
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle: string; right?: ReactNode }) {
  return <View style={styles.pageHeader}><View style={styles.headerCopy}><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>{right}</View>;
}

type GlassCardProps = PropsWithChildren<{
  accent?: boolean;
  onPress?: (event: GestureResponderEvent) => void;
  accessibilityLabel?: string;
}>;

export function GlassCard({ children, accent = false, onPress, accessibilityLabel }: GlassCardProps) {
  const content = <View style={[styles.cardInner, accent && styles.cardInnerAccent]}>{children}</View>;
  if (onPress) {
    return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, accent && styles.cardAccent, pressed && styles.cardPressed]}>{content}</Pressable>;
  }
  return <View style={[styles.card, accent && styles.cardAccent]}>{content}</View>;
}

export function AgentStreamerBadge({ label = "Agent Stream", status = "运行中" }: { label?: string; status?: string }) {
  const [opacity] = useState(() => new Animated.Value(0.45));
  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0.45, duration: 900, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <View style={styles.agentBadge}>
    <View style={styles.agentDotHalo}><Animated.View style={[styles.agentDot, { opacity }]} /></View>
    <Text style={styles.agentLabel}>{label}</Text>
    <Text style={styles.agentStatus}>{status}</Text>
  </View>;
}

export function SectionTitle({ children, meta }: PropsWithChildren<{ meta?: string }>) {
  return <View style={styles.sectionRow}><Text style={styles.sectionTitle}>{children}</Text>{meta ? <Text style={styles.sectionMeta}>{meta}</Text> : null}</View>;
}

export function PersonaBadge({ persona }: { persona: "foundation" | "exam" | "practice" }) {
  const mapping = { foundation: { text: "基", color: palette.blue, bg: "#172554" }, exam: { text: "考", color: palette.warning, bg: "#451A03" }, practice: { text: "践", color: palette.success, bg: "#022C22" } } as const;
  const item = mapping[persona];
  return <View style={[styles.badge, { backgroundColor: item.bg }]}><Text style={{ color: item.color, fontWeight: "900" }}>{item.text}</Text></View>;
}

export function ProgressBar({ value, color }: { value: number; color?: string }) {
  return <ProgressTrack value={value} color={color ?? masteryColor(value)} />;
}

export function MasteryProgressBar({ value }: { value: number }) {
  return <ProgressTrack value={value} color={masteryColor(value)} />;
}

function ProgressTrack({ value, color }: { value: number; color: string }) {
  const normalized = Math.max(0, Math.min(100, value));
  return <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: normalized }} style={styles.progressTrack}>
    <View style={[styles.progressGlow, { width: `${normalized}%`, backgroundColor: color, boxShadow: `0px 0px 7px ${color}` }]}>
      <View style={styles.progressShine} />
    </View>
  </View>;
}

function masteryColor(value: number) {
  if (value >= 80) return palette.success;
  if (value >= 60) return palette.warning;
  return palette.danger;
}

const styles = StyleSheet.create({
  eyebrow: { color: palette.blue, fontSize: 11, letterSpacing: 2.1, fontWeight: "900", marginBottom: 9 },
  brandTitle: { color: "#FFFFFF", fontSize: 46, letterSpacing: -2, fontWeight: "900" },
  brandSubtitle: { color: "#CBD5E1", fontSize: 16, lineHeight: 25, marginTop: 10, maxWidth: 560 },
  pageHeader: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  headerCopy: { flex: 1 },
  pageTitle: { color: palette.ink, fontSize: 27, fontWeight: "900", letterSpacing: -0.7 },
  pageSubtitle: { color: palette.muted, fontSize: 13, marginTop: 5, lineHeight: 19 },
  card: { borderRadius: 22, padding: 1, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.14)", backgroundColor: "rgba(2, 6, 23, 0.96)", boxShadow: "0px 5px 18px rgba(59, 130, 246, 0.12)", elevation: 3 },
  cardAccent: { borderColor: "rgba(99, 102, 241, 0.48)", boxShadow: "0px 5px 18px rgba(99, 102, 241, 0.2)" },
  cardPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  cardInner: { flex: 1, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  cardInnerAccent: { backgroundColor: "rgba(20, 24, 52, 0.94)", borderColor: "rgba(99, 102, 241, 0.2)" },
  agentBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 99, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.5)", backgroundColor: "rgba(49, 46, 129, 0.24)" },
  agentDotHalo: { width: 10, height: 10, borderRadius: 5, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(129, 140, 248, 0.18)" },
  agentDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#A5B4FC" },
  agentLabel: { color: "#C7D2FE", fontSize: 11, fontWeight: "800" },
  agentStatus: { color: "#A5B4FC", fontSize: 10, fontWeight: "700" },
  sectionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: palette.ink, fontWeight: "900", fontSize: 17 },
  sectionMeta: { color: "#A5B4FC", fontWeight: "800", fontSize: 12 },
  badge: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  progressTrack: { height: 7, borderRadius: 99, backgroundColor: "rgba(148, 163, 184, 0.2)", overflow: "hidden" },
  progressGlow: { height: "100%", borderRadius: 99, overflow: "hidden", elevation: 3 },
  progressShine: { height: 2, marginHorizontal: 2, borderRadius: 99, backgroundColor: "rgba(255, 255, 255, 0.42)" },
});
