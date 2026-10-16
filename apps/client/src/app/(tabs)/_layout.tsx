import { Tabs } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, type ColorValue } from "react-native";
const Icon = ({ symbol, color }: { symbol: string; color: ColorValue }) => <Text style={{ color, fontSize: 19 }}>{symbol}</Text>;
export default function TabsLayout() { return <><StatusBar style="light" /><Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "#020617" }, tabBarActiveTintColor: "#A5B4FC", tabBarInactiveTintColor: "#CBD5E1", tabBarStyle: { height: 68, paddingTop: 8, paddingBottom: 8, borderTopColor: "rgba(255, 255, 255, 0.08)", backgroundColor: "#020617" }, tabBarLabelStyle: { fontSize: 11, fontWeight: "700" } }}>
  <Tabs.Screen name="index" options={{ title: "首页", tabBarIcon: ({ color }) => <Icon symbol="⌂" color={color} /> }} />
  <Tabs.Screen name="path" options={{ title: "学习路径", tabBarIcon: ({ color }) => <Icon symbol="◇" color={color} /> }} />
  <Tabs.Screen name="resources" options={{ title: "资源库", tabBarIcon: ({ color }) => <Icon symbol="▤" color={color} /> }} />
  <Tabs.Screen name="tutor" options={{ title: "AI 辅导", tabBarIcon: ({ color }) => <Icon symbol="✦" color={color} /> }} />
  <Tabs.Screen name="profile" options={{ title: "我的", tabBarIcon: ({ color }) => <Icon symbol="◎" color={color} /> }} />
</Tabs></>; }
