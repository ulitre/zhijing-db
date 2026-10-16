import { router } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { GlassCard, PageHeader, palette } from "../components/design-system";
import { ScreenShell } from "../components/screen-shell";

const items = [["诊断", "选择最符合当前掌握情况的答案。题目会根据连续答对或答错的情况切换知识点和难度。"], ["学习路径", "每个节点依次说明诊断证据、当前掌握度、推荐节点与资源类型。"], ["资源库", "生成资源后点开卡片查看完整内容。练习含答案解析，知识图展示结构，SQL 实验展示代码与操作说明。"], ["AI 辅导", "TutorAgent 会检索课程知识卡后回答，并附来源；超时会用检索到的课程事实给出简短解释。"], ["账号", "演示账号为 foundation、exam 或 practice，密码统一为 demo1234；在“我的”中退出后会清除本机登录状态。"]];
export default function HelpScreen() { return <ScreenShell><PageHeader title="使用帮助" subtitle="知径 DB 学习流程与账号说明" />{items.map(([title, content]) => <GlassCard key={title}><Text style={styles.title}>{title}</Text><Text style={styles.body}>{content}</Text></GlassCard>)}<Pressable onPress={() => router.back()} style={styles.button}><Text style={styles.buttonText}>返回</Text></Pressable></ScreenShell>; }
const styles = StyleSheet.create({ title: { color: palette.ink, fontSize: 16, fontWeight: "900" }, body: { color: palette.muted, fontSize: 12, lineHeight: 20, marginTop: 7 }, button: { borderRadius: 14, backgroundColor: palette.purple, padding: 14, alignItems: "center" }, buttonText: { color: "white", fontWeight: "900" } });
