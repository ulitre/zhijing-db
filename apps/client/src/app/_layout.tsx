import { DarkTheme, Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { Platform, StyleSheet, View } from "react-native";
import { BootScreen } from "../components/boot-screen";
import { AppProvider, useApp } from "../state/app-context";
import { ThemeProvider, useTheme } from "../state/theme-context";

export default function RootLayout() {
  return <ThemeProvider>
    <AppProvider><RootNavigator /></AppProvider>
  </ThemeProvider>;
}

function RootNavigator() {
  const { currentUser, ready } = useApp();
  const { theme } = useTheme();
  // The pre-paint script in +html.tsx resolves these variables before hydration,
  // so the server shell, boot overlay and tab canvas agree on the very first frame.
  const canvas = Platform.OS === "web" ? "var(--bg-canvas)" : theme.bgCanvas;
  const navigationTheme = {
    ...DarkTheme,
    colors: { ...DarkTheme.colors, background: canvas },
  };

  return <NavigationThemeProvider value={navigationTheme}>
    <Head>
      <title>知径 DB · 多智能体个性化数据库学习</title>
      <meta name="description" content="知径 DB：面向《数据库原理》的多智能体个性化学习系统。" />
      <meta name="theme-color" content={theme.bgCanvas} />
    </Head>
    <StatusBar style={theme.isDark ? "light" : "dark"} />
    <View style={[styles.root, { backgroundColor: canvas }]}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: canvas } }}>
        <Stack.Protected guard={!currentUser}>
          <Stack.Screen name="index" />
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={Boolean(currentUser) || !ready}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="diagnostic" />
          <Stack.Screen name="resource/[id]" />
          <Stack.Screen name="sql-lab" />
        </Stack.Protected>
        <Stack.Screen name="help" />
      </Stack>
      {!ready ? <View style={[styles.bootOverlay, { backgroundColor: canvas }]}><BootScreen /></View> : null}
    </View>
  </NavigationThemeProvider>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bootOverlay: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 10 },
});
