import type { PropsWithChildren, ReactElement } from "react";
import { Platform, SafeAreaView, ScrollView, StyleSheet, type RefreshControlProps, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../state/theme-context";

export function ScreenShell({
  children,
  contentContainerStyle,
  refreshControl,
  scrollEnabled = true,
  padded = true,
  backgroundColor,
}: PropsWithChildren<{
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  scrollEnabled?: boolean;
  padded?: boolean;
  backgroundColor?: string;
}>) {
  const { theme } = useTheme();
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: backgroundColor ?? theme.bgCanvas }]}>
      <ScrollView
        contentContainerStyle={[styles.content, !padded && styles.contentUnpadded, contentContainerStyle]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        scrollEnabled={scrollEnabled}
        refreshControl={refreshControl}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    ...(Platform.OS === "web"
      ? ({ transitionProperty: "background-color", transitionDuration: "200ms", transitionTimingFunction: "ease" } as ViewStyle)
      : {}),
  },
  content: { padding: 20, paddingTop: 34, paddingBottom: 100, gap: 16, maxWidth: 900, width: "100%", alignSelf: "center" },
  contentUnpadded: { padding: 0, paddingTop: 0, paddingBottom: 0 },
});
