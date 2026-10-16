import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassCard, MasteryProgressBar, PageHeader, palette } from "../../components/design-system";
import { ScreenShell } from "../../components/screen-shell";
import { useApp } from "../../state/app-context";

function masteryLabel(value: number) {
  if (value >= 80) return { label: "已掌握", color: palette.success, glyph: "✓" };
  if (value >= 60) return { label: "巩固中", color: palette.warning, glyph: "◇" };
  return { label: "知识断点", color: palette.danger, glyph: "!" };
}

export default function PathScreen() {
  const { path, currentUser } = useApp();
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  if (!currentUser) return null;
  return <ScreenShell>
    <PageHeader title="个性化学习路径" subtitle={`依据${currentUser.displayName}的掌握度和知识依赖动态规划`} />
    <GlassCard accent>
      <Text style={styles.caption}>45 NODES · KNOWLEDGE TOPOLOGY</Text>
      <Text style={styles.chain}>诊断证据 → 知识断点 → 突破节点 → 学习资源</Text>
      <Text style={styles.small}>每张节点卡展示诊断依据、掌握度和推荐资源；完成后继续解锁下一段学习闭环。</Text>
      <View style={styles.legend}><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.danger }]} /><Text style={styles.legendText}>补救 &lt;60%</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.warning }]} /><Text style={styles.legendText}>巩固 60–79%</Text></View><View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: palette.success }]} /><Text style={styles.legendText}>掌握 ≥80%</Text></View></View>
    </GlassCard>

    {path.map((step, index) => {
      const state = masteryLabel(step.mastery);
      const isRecommended = step.status === "active" || index === 0;
      const previous = path[index - 1];
      const isFocused = focusedNode === step.id;
      return <View key={step.id} style={styles.stepWrap}>
        {index < path.length - 1 ? <View style={styles.connector} /> : null}
        <View style={[styles.marker, { borderColor: `${state.color}80`, backgroundColor: `${state.color}24` }]}><Text style={[styles.markerText, { color: state.color }]}>{index + 1}</Text></View>
        <GlassCard accent={isFocused || isRecommended} onPress={() => setFocusedNode(isFocused ? null : step.id)} accessibilityLabel={`查看${step.title}节点`}>
          <View style={styles.cardTop}><View style={styles.stateRow}><Text style={[styles.stateGlyph, { color: state.color }]}>{state.glyph}</Text><Text style={[styles.stateLabel, { color: state.color }]}>{state.label}</Text></View>
            {isRecommended ? <View style={styles.recommendBadge}><Text style={styles.recommendGlyph}>✦</Text><Text style={styles.recommendText}>建议立即突破</Text></View> : null}
          </View>
          <Text style={styles.nodeTitle}>{step.title}</Text>
          <Text style={styles.evidence}>{step.evidence}</Text>
          <View style={styles.masteryHead}><Text style={styles.muted}>诊断掌握度</Text><Text style={[styles.masteryValue, { color: state.color }]}>{step.mastery}%</Text></View>
          <MasteryProgressBar value={step.mastery} />
          <View style={styles.dependency}><Text style={styles.dependencyGlyph}>↳</Text><Text style={styles.dependencyText}>前置依赖：{previous?.title ?? "课程基础与先修诊断"}</Text></View>
          <View style={styles.cardDivider} />
          <View style={styles.resourceRow}><View style={styles.resourceCopy}><Text style={styles.resourceCaption}>推荐学习资源</Text><Text style={styles.resourceText}>{step.resource} · {step.reason}</Text></View><Text style={styles.openGlyph}>{isFocused ? "⌃" : "›"}</Text></View>
        </GlassCard>
      </View>;
    })}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  caption: { color: "#93C5FD", fontWeight: "900", fontSize: 10, letterSpacing: 1.1 },
  chain: { color: palette.ink, fontSize: 16, fontWeight: "900", marginTop: 8, lineHeight: 24 },
  small: { color: palette.muted, fontSize: 11, lineHeight: 18, marginTop: 7 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 13, marginTop: 14 }, legendItem: { flexDirection: "row", alignItems: "center", gap: 5 }, legendDot: { width: 7, height: 7, borderRadius: 4 }, legendText: { color: palette.muted, fontSize: 9 },
  stepWrap: { paddingLeft: 42, position: "relative" }, connector: { position: "absolute", left: 17, top: 38, bottom: -18, width: 1, backgroundColor: "rgba(99, 102, 241, 0.36)" },
  marker: { position: "absolute", left: 0, top: 18, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1 }, markerText: { fontWeight: "900", fontSize: 12 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, stateRow: { flexDirection: "row", alignItems: "center", gap: 6 }, stateGlyph: { fontWeight: "900", fontSize: 13 }, stateLabel: { fontWeight: "900", fontSize: 10 },
  recommendBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 99, borderWidth: 1, borderColor: "rgba(99, 102, 241, 0.52)", backgroundColor: "rgba(99, 102, 241, 0.16)", boxShadow: "0px 0px 8px rgba(99, 102, 241, 0.38)", elevation: 3 }, recommendGlyph: { color: "#C7D2FE", fontSize: 10 }, recommendText: { color: "#C7D2FE", fontSize: 9, fontWeight: "900" },
  nodeTitle: { color: palette.ink, fontSize: 17, fontWeight: "900", marginTop: 12 }, evidence: { color: palette.muted, lineHeight: 18, fontSize: 11, marginTop: 6 },
  masteryHead: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, marginBottom: 7 }, muted: { color: palette.muted, fontSize: 10 }, masteryValue: { fontSize: 11, fontWeight: "900" },
  dependency: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 13, padding: 9, borderRadius: 11, backgroundColor: "rgba(2, 6, 23, 0.56)", borderWidth: 1, borderColor: palette.line }, dependencyGlyph: { color: "#A5B4FC", fontSize: 13, fontWeight: "900" }, dependencyText: { color: "#C7D2FE", fontSize: 10, fontWeight: "700", flex: 1 },
  cardDivider: { height: 1, backgroundColor: palette.line, marginTop: 13, marginBottom: 11 }, resourceRow: { flexDirection: "row", alignItems: "center" }, resourceCopy: { flex: 1 }, resourceCaption: { color: palette.muted, fontSize: 9, fontWeight: "800" }, resourceText: { color: "#CBD5E1", fontSize: 10, lineHeight: 16, marginTop: 4 }, openGlyph: { color: "#A5B4FC", fontSize: 20, marginLeft: 8 },
});
