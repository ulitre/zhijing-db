import type { PropsWithChildren } from "react";
import { SafeAreaView, ScrollView, StyleSheet } from "react-native";
import { palette } from "./design-system";
export function ScreenShell({ children }: PropsWithChildren) { return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content}>{children}</ScrollView></SafeAreaView>; }
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: palette.background }, content: { padding: 20, paddingTop: 34, paddingBottom: 100, gap: 16, maxWidth: 900, width: "100%", alignSelf: "center" } });
