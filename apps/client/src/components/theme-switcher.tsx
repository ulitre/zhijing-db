import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { TONE_OPTIONS, useTheme, type BaseTone } from "../state/theme-context";

function webOnly(style: Record<string, unknown>) {
  return Platform.OS === "web" ? (style as Record<string, unknown>) : null;
}

function SunMoonIcon({ dark, color, size = 14 }: { dark: boolean; color: string; size?: number }) {
  if (Platform.OS !== "web") {
    return <Text style={{ color, fontSize: size - 1, lineHeight: size + 2 }}>{dark ? "☀" : "☾"}</Text>;
  }
  const common = { width: size, height: size, viewBox: "0 0 16 16", fill: "none", "aria-hidden": true } as const;
  if (dark) {
    return <svg {...common}>
      <circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.4" />
      <path d="M8 1.2v1.7M8 13.1v1.7M1.2 8h1.7M13.1 8h1.7M3.2 3.2l1.2 1.2M11.6 11.6l1.2 1.2M12.8 3.2l-1.2 1.2M4.4 11.6l-1.2 1.2" stroke={color} strokeWidth="1.25" strokeLinecap="round" />
    </svg>;
  }
  return <svg {...common}><path d="M10.8 2.2a5.9 5.9 0 1 0 3 11 6.6 6.6 0 0 1-3-11Z" fill={color} /></svg>;
}

/**
 * Compound visual-style switcher: three tone radios on the left and a sun/moon
 * light-dark switch on the right. Tone changes preserve the current brightness.
 *
 * `compact` keeps the same controls (dots only) for narrow top bars and mobile.
 */
export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, baseTheme, isDark, setBaseTheme, toggleDark } = useTheme();
  const [hovered, setHovered] = useState<BaseTone | null>(null);
  const [modeHovered, setModeHovered] = useState(false);

  return <View
    testID="theme-switcher"
    style={[
      styles.group,
      compact && styles.groupCompact,
      { backgroundColor: theme.bgElevated, borderColor: theme.borderSubtle },
    ]}
  >
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="基础色调"
      aria-label="基础色调"
      testID="theme-tone-group"
      style={styles.toneGroup}
    >
      {TONE_OPTIONS.map((option) => {
        const selected = option.base === baseTheme;
        const hoveredOption = !selected && hovered === option.base;
        return <Pressable
          key={option.base}
          testID={`theme-option-${option.base}`}
          accessibilityRole="radio"
          accessibilityLabel={`${option.label}色调`}
          accessibilityHint={option.hint ? `${option.hint}主题色系` : undefined}
          accessibilityState={{ checked: selected }}
          aria-checked={selected}
          onPress={() => setBaseTheme(option.base)}
          onHoverIn={() => setHovered(option.base)}
          onHoverOut={() => setHovered((current) => current === option.base ? null : current)}
          style={({ pressed }) => [
            styles.option,
            compact && styles.optionCompact,
            { borderColor: "transparent" },
            selected && { backgroundColor: theme.segmentActiveBg, borderColor: theme.isDark ? theme.borderSubtle : "transparent" },
            hoveredOption && { backgroundColor: theme.bgSubtleHover },
            selected && webOnly({ boxShadow: theme.isDark ? "0 1px 2px rgba(0, 0, 0, 0.35)" : "0 1px 2px rgba(24, 24, 27, 0.08)" }),
            pressed && styles.pressed,
            webOnly({ cursor: "pointer", transitionProperty: "background-color, border-color, color", transitionDuration: "200ms", transitionTimingFunction: "ease" }),
          ]}
        >
          <View style={[
            styles.dot,
            compact && styles.dotCompact,
            { backgroundColor: option.swatch },
            option.swatchGradient ? webOnly({ backgroundImage: option.swatchGradient, backgroundColor: "transparent" }) : null,
          ]} />
          {compact ? null : <Text style={[
            styles.label,
            { color: selected || hoveredOption ? theme.textPrimary : theme.textSecondary },
            selected && styles.labelActive,
          ]}>{option.label}</Text>}
        </Pressable>;
      })}
    </View>

    <View style={[styles.divider, compact && { marginHorizontal: 2 }, { backgroundColor: theme.borderSubtle }]} />

    <Pressable
      testID="theme-mode-toggle"
      accessibilityRole="switch"
      accessibilityLabel="深色模式"
      accessibilityHint={isDark ? "切换到浅色模式" : "切换到深色模式"}
      accessibilityState={{ checked: isDark }}
      aria-checked={isDark}
      onPress={toggleDark}
      style={({ pressed }) => [
        styles.modeButton,
        compact && styles.modeButtonCompact,
        isDark && { backgroundColor: theme.accentSoft },
        !isDark && modeHovered && { backgroundColor: theme.bgSubtleHover },
        pressed && styles.pressed,
        webOnly({ cursor: "pointer", transitionProperty: "background-color, color", transitionDuration: "200ms", transitionTimingFunction: "ease" }),
      ]}
      onHoverIn={() => { setModeHovered(true); setHovered(null); }}
      onHoverOut={() => setModeHovered(false)}
    >
      <SunMoonIcon dark={isDark} color={isDark ? theme.accentPrimary : theme.textSecondary} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  group: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    padding: 3,
    borderRadius: 999,
    borderWidth: 1,
    flexShrink: 0,
  },
  groupCompact: { padding: 2, gap: 1 },
  toneGroup: { flexDirection: "row", alignItems: "center", gap: 2 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    minHeight: 28,
  },
  optionCompact: { paddingHorizontal: 6, paddingVertical: 4, minHeight: 24, minWidth: 22 },
  pressed: { opacity: 0.82 },
  divider: { width: 1, height: 18, marginHorizontal: 4, opacity: 0.9 },
  modeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  modeButtonCompact: { width: 24, height: 24, borderRadius: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  dotCompact: { width: 9, height: 9, borderRadius: 4.5 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "500", letterSpacing: 0.1 },
  labelActive: { fontWeight: "600" },
});
