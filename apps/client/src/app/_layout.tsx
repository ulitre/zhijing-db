import { DarkTheme, Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider, useApp } from "../state/app-context";

const appTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: "#020617" },
};

export default function RootLayout() {
  return <AppProvider><RootNavigator /></AppProvider>;
}

function RootNavigator() {
  const { currentUser } = useApp();
  return <ThemeProvider value={appTheme}><StatusBar style="light" /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#020617" } }}>
    <Stack.Protected guard={!currentUser}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
    </Stack.Protected>
    <Stack.Protected guard={Boolean(currentUser)}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="diagnostic" />
      <Stack.Screen name="resource/[id]" />
      <Stack.Screen name="sql-lab" />
    </Stack.Protected>
    <Stack.Screen name="help" />
  </Stack></ThemeProvider>;
}
