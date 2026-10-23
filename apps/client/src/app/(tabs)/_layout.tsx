import { useEffect, useState } from "react";
import { Tabs, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHydratedWidth } from "../../lib/use-hydrated-width";
import { useTheme } from "../../state/theme-context";

const TAB_META: Record<string, { label: string; glyph: string }> = {
  index: { label: "首页", glyph: "⌂" },
  path: { label: "学习路径", glyph: "◇" },
  resources: { label: "资源库", glyph: "▤" },
  tutor: { label: "AI 辅导", glyph: "✦" },
  profile: { label: "我的", glyph: "◎" },
};

type TabBarProps = NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]> extends (props: infer P) => unknown ? P : never;

/** Pass web-only CSS properties through React Native Web without weakening native styles. */
function webOnly(style: Record<string, unknown>) {
  return Platform.OS === "web" ? (style as Record<string, unknown>) : null;
}

/**
 * Clean glass navigation bar. The home tab owns the warm-paper redesign, so the
 * bar turns light there and picks up the active theme's surface/accent tokens.
 */
function GlassTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const width = useHydratedWidth();
  const { theme } = useTheme();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const compact = width < 600;

  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  if (keyboardOpen) return null;

  const colors = { active: theme.accentPrimary, inactive: theme.textSecondary, activeBg: theme.accentSoft, font: theme.textPrimary, hover: theme.bgElevated };

  return <View
    accessibilityRole="tablist"
    style={[
      styles.bar,
      { backgroundColor: theme.bgGlass, borderTopColor: theme.borderSubtle },
      { paddingBottom: Math.max(insets.bottom, 6) },
      webOnly({
        boxShadow: theme.isDark ? "0 -8px 28px rgba(0, 0, 0, 0.45)" : "0 -4px 20px rgba(24, 24, 27, 0.03)",
        transitionProperty: "background-color, border-color, box-shadow",
        transitionDuration: "200ms",
        transitionTimingFunction: "ease",
      }),
      webOnly({ backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)" }),
    ]}
  >
    <View style={styles.barInner}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const meta = TAB_META[route.name];
        const label = options?.title ?? meta?.label ?? route.name;
        const glyph = meta?.glyph ?? "•";
        const onPress = () => {
          setHoveredKey(null);
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return <Pressable
          key={route.key}
          accessibilityRole="tab"
          accessibilityLabel={options?.tabBarAccessibilityLabel ?? (typeof label === "string" ? label : route.name)}
          accessibilityState={{ selected: focused }}
          aria-selected={focused}
          onPress={onPress}
          onHoverIn={() => setHoveredKey(route.key)}
          onHoverOut={() => setHoveredKey((current) => current === route.key ? null : current)}
          style={({ pressed }) => [styles.item, pressed && styles.itemPressed, webOnly({ cursor: "pointer" })]}
        >
          <View style={[
            styles.itemPill,
            compact && styles.itemPillCompact,
            focused && { backgroundColor: colors.activeBg },
            !focused && hoveredKey === route.key && { backgroundColor: colors.hover },
            webOnly({ transitionProperty: "background-color", transitionDuration: "200ms", transitionTimingFunction: "ease" }),
          ]}>
            <Text style={[styles.glyph, { color: focused ? colors.active : hoveredKey === route.key ? colors.font : colors.inactive }]}>{glyph}</Text>
            <Text style={[styles.label, { color: focused ? colors.active : hoveredKey === route.key ? colors.font : colors.inactive }, focused && { fontWeight: "600" }]}>{label}</Text>
          </View>
        </Pressable>;
      })}
    </View>
  </View>;
}

function TabsNavigator() {
  const pathname = usePathname();
  const { isDark, theme } = useTheme();
  const onTab = ["/", "/path", "/resources", "/tutor", "/profile"].includes(pathname);
  const canvas = Platform.OS === "web" ? "var(--bg-canvas)" : theme.bgCanvas;
  return <>
    <StatusBar style={onTab && !isDark ? "dark" : "light"} />
    <Tabs
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: canvas },
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: "#60A5FA",
        tabBarInactiveTintColor: "#94A3B8",
      }}
    >
      <Tabs.Screen name="index" options={{ title: "首页", tabBarAccessibilityLabel: "首页" }} />
      <Tabs.Screen name="path" options={{ title: "学习路径", tabBarAccessibilityLabel: "学习路径" }} />
      <Tabs.Screen name="resources" options={{ title: "资源库", tabBarAccessibilityLabel: "资源库" }} />
      <Tabs.Screen name="tutor" options={{ title: "AI 辅导", tabBarAccessibilityLabel: "AI 辅导" }} />
      <Tabs.Screen name="profile" options={{ title: "我的", tabBarAccessibilityLabel: "我的" }} />
    </Tabs>
  </>;
}

export default function TabsLayout() {
  return <TabsNavigator />;
}

const styles = StyleSheet.create({
  bar: {
    paddingTop: 6,
    paddingHorizontal: 10,
    borderTopWidth: 1,
  },
  barInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", gap: 4, minHeight: 48, width: "100%", maxWidth: 1180, alignSelf: "center" },
  item: { flex: 1, alignItems: "center", justifyContent: "center", minWidth: 0 },
  itemPressed: { opacity: 0.82 },
  itemPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 999,
    minWidth: 0,
  },
  itemPillCompact: { flexDirection: "column", gap: 1, paddingHorizontal: 8, paddingVertical: 4 },
  glyph: { fontSize: 17, lineHeight: 20 },
  label: { fontSize: 11, lineHeight: 15, fontWeight: "500" },
});
