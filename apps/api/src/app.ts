import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { zValidator } from "@hono/zod-validator";
import { DiagnosticSubmissionSchema, LoginRequestSchema, ResourceRequestSchema, SqlRunRequestSchema, TutorRequestSchema } from "@zhijing/shared";
import { knowledgeNodes, knowledgeSources } from "@zhijing/course-data";
import { AGENTS, demoUsers, planLearningPath, updateMastery } from "@zhijing/agents";
import { persistResource } from "./db/index.js";
import { runResourceWorkflow } from "./services/workflow.js";
import { runSqlSandbox } from "./sql/sandbox.js";
import { answerTutor } from "./services/tutor.js";

const app = new Hono();
const resourceCache = new Map<string, Awaited<ReturnType<typeof runResourceWorkflow>>["resource"]>();
app.use("*", logger());
app.use("*", cors({ origin: (origin) => origin || process.env.APP_ORIGIN || "http://localhost:8081", allowHeaders: ["Content-Type", "Authorization", "X-Admin-Secret"], allowMethods: ["GET", "POST", "OPTIONS"] }));

app.get("/", (c) => c.json({ name: "知径 DB API", version: "0.2.0", mode: process.env.DEEPSEEK_API_KEY ? "deepseek" : "deterministic-mock" }));
app.get("/health", (c) => c.json({ status: "ok", checks: { api: "ok", database: process.env.DATABASE_URL ? "configured" : "in-memory", model: process.env.DEEPSEEK_API_KEY ? "configured" : "mock", sqlSandbox: "sql.js-worker", courseNodes: knowledgeNodes.length, agents: AGENTS.length }, timestamp: new Date().toISOString() }));
app.get("/api/demo-users", (c) => c.json(demoUsers.map(({ id, username, displayName, persona }) => ({ id, username, displayName, persona }))));
app.post("/api/auth/login", zValidator("json", LoginRequestSchema), (c) => { const { username, password } = c.req.valid("json"); const user = demoUsers.find((candidate) => candidate.username === username); if (!user || password !== "demo1234") return c.json({ error: "账号或密码错误" }, 401); return c.json({ token: `demo-token-${user.id}`, user, expiresIn: 14_400 }); });
app.get("/api/course", (c) => c.json({ title: "数据库原理", modules: [...new Set(knowledgeNodes.map((node) => node.module))], nodes: knowledgeNodes, sources: knowledgeSources }));

app.get("/api/dashboard/:userId", (c) => {
  const user = demoUsers.find((candidate) => candidate.id === c.req.param("userId"));
  if (!user) return c.json({ error: "用户不存在" }, 404);
  const resources = [...resourceCache.values()].filter((resource) => resource.userId === user.id); const values = Object.values(user.profile.knowledgeMastery);
  return c.json({ user, path: planLearningPath(user.profile), resources, metrics: { overallMastery: Math.round(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)), completedSteps: 2, weeklyMinutes: user.profile.weeklyMinutes, trend: user.profile.progressTrend } });
});

app.post("/api/diagnostics", zValidator("json", DiagnosticSubmissionSchema), (c) => {
  const { userId, answers } = c.req.valid("json"); const user = demoUsers.find((candidate) => candidate.id === userId); if (!user) return c.json({ error: "用户不存在" }, 404);
  for (const answer of answers) { const old = user.profile.knowledgeMastery[answer.nodeId] ?? user.profile.prerequisiteFoundation; user.profile.knowledgeMastery[answer.nodeId] = updateMastery(old, { correctness: answer.correctness, hintIndependence: answer.usedHint ? 35 : 100, responseQuality: answer.correctness, confidenceCalibration: 100 - Math.abs(answer.correctness - answer.confidence) }); }
  return c.json({ profile: user.profile, path: planLearningPath(user.profile) });
});

app.post("/api/resources", zValidator("json", ResourceRequestSchema), async (c) => {
  const input = c.req.valid("json"); const user = demoUsers.find((candidate) => candidate.id === input.userId); if (!user) return c.json({ error: "用户不存在" }, 404); if (!knowledgeNodes.some((node) => node.id === input.nodeId)) return c.json({ error: "知识点不存在" }, 404);
  const cacheKey = `${input.userId}:${input.nodeId}:${input.type}`; const runId = crypto.randomUUID(); const cached = resourceCache.get(cacheKey); if (cached) return c.json({ resource: { ...cached, cached: true }, events: [], runId, cacheHit: true });
  const result = await runResourceWorkflow({ runId, user, nodeId: input.nodeId, type: input.type }); resourceCache.set(cacheKey, result.resource); await persistResource(result.resource).catch((error) => console.warn("Resource persistence failed", error)); return c.json({ ...result, runId, cacheHit: false });
});
app.get("/api/resources/:userId", (c) => c.json([...resourceCache.values()].filter((resource) => resource.userId === c.req.param("userId"))));

app.post("/api/tutor", zValidator("json", TutorRequestSchema), async (c) => c.json(await answerTutor(c.req.valid("json").question, c.req.valid("json").nodeId)));
app.post("/api/sql/run", zValidator("json", SqlRunRequestSchema), async (c) => { const { sql, mode } = c.req.valid("json"); try { return c.json(await runSqlSandbox(sql, mode)); } catch (error) { return c.json({ error: error instanceof Error ? error.message : "SQL 执行失败" }, 400); } });

app.get("/api/admin/overview", (c) => { if (!process.env.ADMIN_SECRET || c.req.header("X-Admin-Secret") !== process.env.ADMIN_SECRET) return c.json({ error: "无权访问" }, 403); return c.json({ health: "ok", users: demoUsers.length, cachedResources: resourceCache.size, courseNodes: knowledgeNodes.length, model: process.env.DEEPSEEK_API_KEY ? process.env.DEEPSEEK_MODEL : "deterministic-mock", estimatedSpendCny: 0 }); });
app.post("/api/admin/reset", (c) => { if (!process.env.ADMIN_SECRET || c.req.header("X-Admin-Secret") !== process.env.ADMIN_SECRET) return c.json({ error: "无权访问" }, 403); resourceCache.clear(); return c.json({ ok: true, resetAt: new Date().toISOString() }); });
app.onError((error, c) => { console.error(error); return c.json({ error: "服务暂时不可用，请稍后重试" }, 500); });
export default app;
