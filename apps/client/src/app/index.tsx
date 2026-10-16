import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { BrandHeader, GlassCard } from "../components/design-system";
import { useApp } from "../state/app-context";

export default function LoginScreen() {
  const { currentUser, demoUsers, login, loading, ready } = useApp(); const [username, setUsername] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const submitting = useRef(false);
  useEffect(() => { if (!ready || currentUser) return; void AsyncStorage.getItem("zhijing.onboarding.v1").then((seen) => { if (!seen) router.replace("/onboarding" as never); }); }, [ready, currentUser]);
  useEffect(() => { if (ready && currentUser) router.replace("/(tabs)"); }, [ready, currentUser]);
  const submit = async (presetUsername = username.trim(), presetPassword = password) => {
    if (!ready || loading || submitting.current) return;
    submitting.current = true;
    setError("");
    try {
      await login(presetUsername.trim(), presetPassword);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "登录失败，请检查账号密码";
      setError(message === "The operation was aborted" || message.includes("AbortError") ? "登录请求超时，请检查网络后重试" : message);
    } finally {
      submitting.current = false;
    }
  };
  const loginAsDemo = (demoUsername: string) => {
    setUsername(demoUsername);
    setPassword("demo1234");
    void submit(demoUsername, "demo1234");
  };
  const loginDisabled = loading || !ready;
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.page}>
    <BrandHeader eyebrow="MULTI-AGENT LEARNING" title="知径 DB" subtitle="登录后获得基于诊断证据的数据库学习路径。" />
    <View style={styles.heroStats}><Text style={styles.heroStat}>12 个智能体</Text><Text style={styles.dot}>•</Text><Text style={styles.heroStat}>45 个知识节点</Text><Text style={styles.dot}>•</Text><Text style={styles.heroStat}>6 类资源</Text></View>
    <GlassCard><Text style={styles.cardTitle}>账号登录</Text><Text style={styles.cardSubtitle}>使用演示账号体验个性化学习空间</Text>
      <Text style={styles.label}>快速体验</Text>
      <View style={styles.demoAccounts}>{demoUsers.map((user) => <Pressable key={user.id} accessibilityRole="button" accessibilityLabel={`使用${user.username}演示账号登录`} accessibilityState={{ disabled: loginDisabled }} disabled={loginDisabled} onPress={() => loginAsDemo(user.username)} style={({ pressed }) => [styles.demoAccount, pressed && !loginDisabled && styles.demoAccountPressed, loginDisabled && styles.disabled]}><Text style={styles.demoAccountTitle}>{user.persona === "foundation" ? "基础补齐" : user.persona === "exam" ? "应试巩固" : "实践进阶"}</Text><Text style={styles.demoAccountUsername}>{user.username}</Text></Pressable>)}</View>
      <Text style={styles.label}>用户名</Text><TextInput accessibilityLabel="用户名" autoCapitalize="none" value={username} onChangeText={setUsername} placeholder="foundation / exam / practice" style={styles.input} />
      <Text style={styles.label}>密码</Text><TextInput accessibilityLabel="密码" autoCapitalize="none" secureTextEntry value={password} onChangeText={setPassword} placeholder="请输入密码（演示账号统一为 demo1234）" style={styles.input} onSubmitEditing={() => void submit()} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: loginDisabled, busy: loading }} onPress={() => void submit()} style={({ pressed }) => [styles.primaryButton, pressed && !loginDisabled && styles.primaryButtonPressed, loginDisabled && styles.disabled]} disabled={loginDisabled}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>登录并进入学习空间</Text>}</Pressable>
      <Text style={styles.disclaimer}>演示密码：demo1234 · 首次登录后可在“我的”中退出</Text>
    </GlassCard>
    <Pressable onPress={() => router.push("/help" as never)} style={styles.help}><Text style={styles.helpText}>使用帮助</Text></Pressable>
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#020617" }, page: { flexGrow: 1, padding: 24, paddingTop: 52, gap: 22, maxWidth: 760, width: "100%", alignSelf: "center" },
  heroStats: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }, heroStat: { color: "#CBD5E1", fontSize: 13, fontWeight: "700" }, dot: { color: "#8B5CF6" },
  cardTitle: { color: "#F8FAFC", fontSize: 22, fontWeight: "800" }, cardSubtitle: { color: "#CBD5E1", marginTop: 6, marginBottom: 18, lineHeight: 21 },
  label: { color: "#E2E8F0", fontWeight: "800", fontSize: 12, marginTop: 10, marginBottom: 6 },
  demoAccounts: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, demoAccount: { flexGrow: 1, minWidth: 96, paddingHorizontal: 11, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.42)", borderRadius: 14, alignItems: "center", backgroundColor: "rgba(49, 46, 129, 0.28)" }, demoAccountPressed: { opacity: 0.82, transform: [{ scale: 0.97 }] }, demoAccountTitle: { color: "#F8FAFC", fontWeight: "800", fontSize: 12 }, demoAccountUsername: { color: "#C7D2FE", fontSize: 10, marginTop: 3 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.36)", borderRadius: 13, paddingHorizontal: 13, color: "#F8FAFC", backgroundColor: "rgba(2, 6, 23, 0.78)" },
  primaryButton: { marginTop: 18, minHeight: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "#4F46E5" }, primaryButtonPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] }, disabled: { opacity: 0.6 }, primaryButtonText: { color: "#FFFFFF", fontWeight: "800", fontSize: 15 },
  disclaimer: { color: "#CBD5E1", fontSize: 11, textAlign: "center", marginTop: 12 }, error: { color: "#FDA4AF", marginTop: 9, fontWeight: "700" }, help: { padding: 12, alignItems: "center" }, helpText: { color: "#E2E8F0", fontWeight: "800" },
});
