import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, type PropsWithChildren } from "react";
import { Platform } from "react-native";

export type BaseTone = "claude" | "gemini" | "linear";
export type ThemeMode =
  | "claude-light"
  | "claude-dark"
  | "gemini-light"
  | "gemini-dark"
  | "linear-light"
  | "linear-dark";

/**
 * One palette for every terminal, SQL editor and code preview in the product.
 * Light modes render a warm sand-ivory "macOS studio" window; dark modes keep
 * the original warm charcoal. Nothing here may fall back to a blue-black block.
 */
export type CodeTokens = {
  bg: string;
  headerBg: string;
  border: string;
  headerBorder: string;
  text: string;
  strong: string;
  muted: string;
  keyword: string;
  string: string;
  comment: string;
  caret: string;
  title: string;
  shadow: string;
  subtleBg: string;
  inputBg: string;
};

export type ThemeTokens = {
  mode: ThemeMode;
  base: BaseTone;
  isDark: boolean;
  label: string;
  shortLabel: string;
  swatch: string;

  code: CodeTokens;

  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  bgSubtleHover: string;
  bgGlass: string;

  borderSubtle: string;
  borderDivider: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  accentPrimary: string;
  accentHover: string;
  accentSoft: string;
  accentSoftBorder: string;
  accentGlow: string;
  accentHalo: string;
  accentRing: string;
  accentShadow: string;
  accentGradientFrom: string;
  /** Secondary brand hue used for gradient stops and twin highlights. */
  accentSecondary: string;
  /** Full CSS gradient used by hero titles, CTAs and active accent rails. */
  accentGradient: string;
  onAccent: string;

  agent: string;
  agentSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;

  pendingRing: string;
  pendingLine: string;
  radarBoard: string;
  radarFill: string;

  segmentActiveBg: string;
};

const LIGHT_SEMANTIC = {
  agent: "#2563EB",
  agentSoft: "#EFF6FF",
  // 0F9E90 keeps relative luminance above 0.25 so long progress fills and
  // status surfaces never read as dark blocks on the warm canvas.
  success: "#0F9E90",
  successSoft: "#F0FDFA",
  warning: "#D97706",
  warningSoft: "#FFFBEB",
} as const;

/** Brighter semantic hues keep the dark surfaces legible without losing the warning logic. */
const DARK_SEMANTIC = {
  agent: "#60A5FA",
  agentSoft: "rgba(96, 165, 250, 0.14)",
  success: "#14B8A6",
  successSoft: "rgba(20, 184, 166, 0.14)",
  warning: "#F59E0B",
  warningSoft: "rgba(245, 158, 11, 0.14)",
} as const;

/** Warm sand-ivory studio window used by every light terminal / SQL surface. */
const LIGHT_CODE: CodeTokens = {
  bg: "#F6F2EA",
  headerBg: "#EFEAE1",
  border: "#E5DEC9",
  headerBorder: "#E2D9CC",
  text: "#1C1917",
  strong: "#1C1917",
  muted: "#78716C",
  keyword: "#C85A32",
  string: "#0F766E",
  comment: "#78716C",
  caret: "#C85A32",
  title: "#57534E",
  shadow: "0 16px 32px -18px rgba(41, 37, 36, 0.16), 0 2px 6px rgba(41, 37, 36, 0.04)",
  subtleBg: "#FBF8F2",
  inputBg: "#F7F3EB",
};

const DARK_CODE: CodeTokens = {
  bg: "#1C1917",
  headerBg: "#26211E",
  border: "#332E2A",
  headerBorder: "#332E2A",
  text: "#E7E5E4",
  strong: "#FAF7F2",
  muted: "#A8A29E",
  keyword: "#E88C6F",
  string: "#2DD4BF",
  comment: "#78716C",
  caret: "#2DD4BF",
  title: "rgba(250, 247, 242, 0.55)",
  shadow: "0 20px 40px -15px rgba(0, 0, 0, 0.5)",
  subtleBg: "rgba(250, 247, 242, 0.04)",
  inputBg: "#1C1917",
};

export const THEMES = {
  "claude-light": {
    mode: "claude-light",
    base: "claude",
    isDark: false,
    label: "暖阳纸张",
    shortLabel: "暖阳",
    swatch: "#D97757",
    code: LIGHT_CODE,
    bgCanvas: "#FAF8F5",
    bgSurface: "#FFFFFF",
    bgElevated: "#F3F0EA",
    bgSubtleHover: "#EFECE6",
    bgGlass: "rgba(250, 248, 245, 0.94)",
    borderSubtle: "#E6E2D8",
    borderDivider: "#EDEAE2",
    textPrimary: "#18181B",
    textSecondary: "#52525B",
    textMuted: "#8E8B82",
    accentPrimary: "#D97757",
    accentHover: "#C46445",
    accentSoft: "#FDF3EF",
    accentSoftBorder: "#F4DED5",
    accentGlow: "rgba(217, 119, 87, 0.09)",
    accentHalo: "rgba(217, 119, 87, 0.14)",
    accentRing: "rgba(217, 119, 87, 0.22)",
    accentShadow: "rgba(217, 119, 87, 0.25)",
    accentGradientFrom: "#E58D6E",
    accentSecondary: "#0D9488",
    accentGradient: "linear-gradient(135deg, #E58D6E 0%, #D97757 52%, #C46445 100%)",
    onAccent: "#FFFFFF",
    ...LIGHT_SEMANTIC,
    pendingRing: "#D6D2C4",
    pendingLine: "#DCD8CE",
    radarBoard: "#FCFBF9",
    radarFill: "rgba(217, 119, 87, 0.20)",
    segmentActiveBg: "#FFFFFF",
  },
  "claude-dark": {
    mode: "claude-dark",
    base: "claude",
    isDark: true,
    label: "暖阳纸张",
    shortLabel: "暖阳",
    swatch: "#D97757",
    code: DARK_CODE,
    bgCanvas: "#121214",
    bgSurface: "#1A1A1E",
    bgElevated: "#26262B",
    bgSubtleHover: "#2E2E36",
    bgGlass: "rgba(18, 18, 20, 0.9)",
    borderSubtle: "#2E2E36",
    borderDivider: "#27272E",
    textPrimary: "#F4F4F5",
    textSecondary: "#A1A1AA",
    textMuted: "#71717A",
    accentPrimary: "#E07A5F",
    accentHover: "#EC8A70",
    accentSoft: "rgba(224, 122, 95, 0.15)",
    accentSoftBorder: "rgba(224, 122, 95, 0.28)",
    accentGlow: "rgba(224, 122, 95, 0.12)",
    accentHalo: "rgba(224, 122, 95, 0.2)",
    accentRing: "rgba(224, 122, 95, 0.3)",
    accentShadow: "rgba(224, 122, 95, 0.32)",
    accentGradientFrom: "#E88C6F",
    accentSecondary: "#2DD4BF",
    accentGradient: "linear-gradient(135deg, #E88C6F 0%, #E07A5F 55%, #C46445 100%)",
    onAccent: "#18181B",
    ...DARK_SEMANTIC,
    pendingRing: "#3A3A42",
    pendingLine: "#34343C",
    radarBoard: "#161619",
    radarFill: "rgba(224, 122, 95, 0.22)",
    segmentActiveBg: "#303038",
  },
  "gemini-light": {
    mode: "gemini-light",
    base: "gemini",
    isDark: false,
    label: "晴空日光",
    shortLabel: "晴空",
    swatch: "#0284C7",
    code: LIGHT_CODE,
    bgCanvas: "#F1F7FD",
    bgSurface: "#FFFFFF",
    bgElevated: "#E8F1FA",
    bgSubtleHover: "#DCEAF6",
    bgGlass: "rgba(241, 247, 253, 0.94)",
    borderSubtle: "#D3E2F0",
    borderDivider: "#E2ECF6",
    textPrimary: "#0B1F33",
    textSecondary: "#3D5A73",
    textMuted: "#5E7488",
    accentPrimary: "#0284C7",
    accentHover: "#0369A1",
    accentSoft: "#E0F2FE",
    accentSoftBorder: "#BAE6FD",
    accentGlow: "rgba(2, 132, 199, 0.09)",
    accentHalo: "rgba(2, 132, 199, 0.15)",
    accentRing: "rgba(2, 132, 199, 0.24)",
    accentShadow: "rgba(2, 132, 199, 0.24)",
    accentGradientFrom: "#38BDF8",
    accentSecondary: "#0369A1",
    accentGradient: "linear-gradient(135deg, #38BDF8 0%, #0284C7 52%, #075985 100%)",
    onAccent: "#FFFFFF",
    ...LIGHT_SEMANTIC,
    agent: "#0369A1",
    agentSoft: "#E0F2FE",
    pendingRing: "#C6DAEA",
    pendingLine: "#D3E3F1",
    radarBoard: "#FAFDFF",
    radarFill: "rgba(2, 132, 199, 0.18)",
    segmentActiveBg: "#FFFFFF",
  },
  "gemini-dark": {
    mode: "gemini-dark",
    base: "gemini",
    isDark: true,
    label: "晴空日光",
    shortLabel: "晴空",
    swatch: "#0EA5E9",
    code: DARK_CODE,
    bgCanvas: "#07141F",
    bgSurface: "#0D2030",
    bgElevated: "#153044",
    bgSubtleHover: "#1B3B53",
    bgGlass: "rgba(7, 20, 31, 0.9)",
    borderSubtle: "#21445D",
    borderDivider: "#19364B",
    textPrimary: "#F0F9FF",
    textSecondary: "#A5C8DE",
    textMuted: "#6F93A8",
    accentPrimary: "#0EA5E9",
    accentHover: "#38BDF8",
    accentSoft: "rgba(14, 165, 233, 0.16)",
    accentSoftBorder: "rgba(14, 165, 233, 0.32)",
    accentGlow: "rgba(14, 165, 233, 0.14)",
    accentHalo: "rgba(14, 165, 233, 0.2)",
    accentRing: "rgba(14, 165, 233, 0.3)",
    accentShadow: "rgba(14, 165, 233, 0.3)",
    accentGradientFrom: "#7DD3FC",
    accentSecondary: "#38BDF8",
    accentGradient: "linear-gradient(135deg, #38BDF8 0%, #0EA5E9 52%, #0284C7 100%)",
    onAccent: "#07141F",
    ...DARK_SEMANTIC,
    agent: "#38BDF8",
    agentSoft: "rgba(56, 189, 248, 0.16)",
    pendingRing: "#2A4C63",
    pendingLine: "#24455C",
    radarBoard: "#0A1B29",
    radarFill: "rgba(14, 165, 233, 0.22)",
    segmentActiveBg: "#1A3A50",
  },
  "linear-light": {
    mode: "linear-light",
    base: "linear",
    isDark: false,
    label: "紫霞 · 落日",
    shortLabel: "紫霞",
    swatch: "#7C3AED",
    code: LIGHT_CODE,
    bgCanvas: "#F7F4FB",
    bgSurface: "rgba(255, 255, 255, 0.88)",
    bgElevated: "#F0EAF8",
    bgSubtleHover: "#E9E0F5",
    bgGlass: "rgba(255, 255, 255, 0.82)",
    borderSubtle: "#E2D6F3",
    borderDivider: "#EDE5F7",
    textPrimary: "#1E1035",
    textSecondary: "#53436B",
    textMuted: "#84749E",
    accentPrimary: "#7C3AED",
    accentHover: "#6D28D9",
    accentSoft: "#F3E8FF",
    accentSoftBorder: "#E9D5FF",
    accentGlow: "rgba(139, 92, 246, 0.10)",
    accentHalo: "rgba(139, 92, 246, 0.16)",
    accentRing: "rgba(124, 58, 237, 0.26)",
    accentShadow: "rgba(124, 58, 237, 0.28)",
    accentGradientFrom: "#C026D3",
    accentSecondary: "#DB2777",
    accentGradient: "linear-gradient(135deg, #7C3AED 0%, #C026D3 52%, #EA580C 100%)",
    onAccent: "#FFFFFF",
    ...LIGHT_SEMANTIC,
    agent: "#8B5CF6",
    agentSoft: "#F3E8FF",
    pendingRing: "#D9C8EE",
    pendingLine: "#E2D6F3",
    radarBoard: "#FBF8FF",
    radarFill: "rgba(124, 58, 237, 0.20)",
    segmentActiveBg: "#FFFFFF",
  },
  "linear-dark": {
    mode: "linear-dark",
    base: "linear",
    isDark: true,
    label: "紫霞 · 星辰",
    shortLabel: "紫霞",
    swatch: "#A855F7",
    code: DARK_CODE,
    bgCanvas: "#0D0914",
    bgSurface: "#161024",
    bgElevated: "#221836",
    bgSubtleHover: "#2A1D42",
    bgGlass: "rgba(13, 9, 20, 0.9)",
    borderSubtle: "#32244D",
    borderDivider: "#271B3C",
    textPrimary: "#FAF5FF",
    textSecondary: "#C4B5FD",
    textMuted: "#7E6E99",
    accentPrimary: "#A855F7",
    accentHover: "#C084FC",
    accentSoft: "rgba(168, 85, 247, 0.18)",
    accentSoftBorder: "rgba(168, 85, 247, 0.34)",
    accentGlow: "rgba(168, 85, 247, 0.14)",
    accentHalo: "rgba(168, 85, 247, 0.22)",
    accentRing: "rgba(168, 85, 247, 0.34)",
    accentShadow: "rgba(168, 85, 247, 0.36)",
    accentGradientFrom: "#DB2777",
    accentSecondary: "#DB2777",
    accentGradient: "linear-gradient(135deg, #9333EA 0%, #DB2777 55%, #F97316 100%)",
    onAccent: "#FFFFFF",
    ...DARK_SEMANTIC,
    agent: "#C4B5FD",
    agentSoft: "rgba(196, 181, 253, 0.16)",
    pendingRing: "#3B2A57",
    pendingLine: "#332447",
    radarBoard: "#120C1D",
    radarFill: "rgba(168, 85, 247, 0.24)",
    segmentActiveBg: "#2B1B44",
  },
} as const satisfies Record<ThemeMode, ThemeTokens>;

export const TONE_OPTIONS = (["claude", "gemini", "linear"] as const).map((base) => ({
  base,
  label: THEMES[`${base}-light`].shortLabel,
  swatch: THEMES[`${base}-light`].swatch,
  swatchGradient: base === "linear" ? THEMES["linear-light"].accentGradient : null,
  hint: base === "linear" ? "落日紫霞 / 星辰紫夜" : null,
}));

const V2_KEY = "zhijing.theme.v2";
const V1_KEY = "zhijing.theme.v1";
const DEFAULT_MODE: ThemeMode = "claude-light";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "claude-light" || value === "claude-dark"
    || value === "gemini-light" || value === "gemini-dark"
    || value === "linear-light" || value === "linear-dark";
}

function legacyToMode(value: string | null): ThemeMode | null {
  return value === "claude" || value === "gemini" || value === "linear" ? `${value}-light` : null;
}

function modeFor(base: BaseTone, dark: boolean): ThemeMode {
  return `${base}-${dark ? "dark" : "light"}` as ThemeMode;
}

/** Synchronous read for the web first render: no light/dark flash on reload. */
function readStoredModeSync(): ThemeMode | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  try {
    const saved = window.localStorage.getItem(V2_KEY);
    if (isThemeMode(saved)) return saved;
    return legacyToMode(window.localStorage.getItem(V1_KEY));
  } catch {
    return null;
  }
}

async function readStoredModeAsync(): Promise<ThemeMode | null> {
  try {
    const saved = await AsyncStorage.getItem(V2_KEY);
    if (isThemeMode(saved)) return saved;
    return legacyToMode(await AsyncStorage.getItem(V1_KEY));
  } catch {
    return null;
  }
}

async function persistMode(mode: ThemeMode): Promise<void> {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    try { window.localStorage.setItem(V2_KEY, mode); } catch { /* storage unavailable */ }
    return;
  }
  try { await AsyncStorage.setItem(V2_KEY, mode); } catch { /* storage unavailable */ }
}

type ThemeContextValue = {
  mode: ThemeMode;
  theme: ThemeTokens;
  baseTheme: BaseTone;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  setBaseTheme: (base: BaseTone) => void;
  setDark: (dark: boolean) => void;
  toggleDark: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE);
  const [hydrated, setHydrated] = useState(false);
  const theme = THEMES[mode] as ThemeTokens;

  // Restore the saved tone before the first paint on web; the server-rendered
  // tree uses the default mode so hydration is stable, then this layout effect
  // swaps to the stored theme without a visible flash.
  useIsomorphicLayoutEffect(() => {
    if (Platform.OS !== "web") return;
    const saved = readStoredModeSync();
    if (saved) setMode(saved);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let cancelled = false;
    void (async () => {
      const saved = await readStoredModeAsync();
      if (!cancelled) {
        if (saved) setMode(saved);
        setHydrated(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void persistMode(mode);
  }, [mode, hydrated]);

  const setBaseTheme = useCallback((base: BaseTone) => {
    setMode((current) => modeFor(base, current.endsWith("-dark")));
  }, []);

  const setDark = useCallback((dark: boolean) => {
    setMode((current) => modeFor(current.slice(0, current.indexOf("-")) as BaseTone, dark));
  }, []);

  const toggleDark = useCallback(() => {
    setMode((current) => modeFor(current.slice(0, current.indexOf("-")) as BaseTone, !current.endsWith("-dark")));
  }, []);

  // Keep the global web tokens in sync for CSS surfaces (focus ring and shell accents).
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.theme = theme.mode;
    root.style.colorScheme = theme.isDark ? "dark" : "light";
    const style = root.style;
    style.setProperty("--bg-canvas", theme.bgCanvas);
    style.setProperty("--bg-surface", theme.bgSurface);
    style.setProperty("--bg-elevated", theme.bgElevated);
    style.setProperty("--bg-subtle-hover", theme.bgSubtleHover);
    style.setProperty("--bg-glass", theme.bgGlass);
    style.setProperty("--border-subtle", theme.borderSubtle);
    style.setProperty("--border-divider", theme.borderDivider);
    style.setProperty("--text-primary", theme.textPrimary);
    style.setProperty("--text-secondary", theme.textSecondary);
    style.setProperty("--text-muted", theme.textMuted);
    style.setProperty("--accent-primary", theme.accentPrimary);
    style.setProperty("--accent-hover", theme.accentHover);
    style.setProperty("--accent-soft", theme.accentSoft);
    style.setProperty("--accent-soft-border", theme.accentSoftBorder);
    style.setProperty("--accent-glow", theme.accentGlow);
    style.setProperty("--accent-halo", theme.accentHalo);
    style.setProperty("--accent-ring", theme.accentRing);
    style.setProperty("--accent-shadow", theme.accentShadow);
    style.setProperty("--accent-gradient-from", theme.accentGradientFrom);
    style.setProperty("--accent-secondary", theme.accentSecondary);
    style.setProperty("--accent-gradient", theme.accentGradient);
    style.setProperty("--color-agent", theme.agent);
    style.setProperty("--color-success", theme.success);
    style.setProperty("--color-warning", theme.warning);
    style.setProperty("--code-bg", theme.code.bg);
    style.setProperty("--code-header-bg", theme.code.headerBg);
    style.setProperty("--code-border", theme.code.border);
    style.setProperty("--code-text", theme.code.text);
    style.setProperty("--code-strong", theme.code.strong);
    style.setProperty("--code-muted", theme.code.muted);
    style.setProperty("--code-keyword", theme.code.keyword);
    style.setProperty("--code-string", theme.code.string);
    style.setProperty("--code-caret", theme.code.caret);
    style.setProperty("--code-shadow", theme.code.shadow);
    style.setProperty("--border-focus", theme.accentPrimary);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    for (const meta of metas) meta.setAttribute("content", theme.bgCanvas);
  }, [theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    theme,
    baseTheme: theme.base,
    isDark: theme.isDark,
    setMode,
    setBaseTheme,
    setDark,
    toggleDark,
  }), [mode, theme, setBaseTheme, setDark, toggleDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside a ThemeProvider");
  return context;
}
