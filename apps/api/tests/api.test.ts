import { describe, expect, it } from "vitest";
import app from "../src/app.js";
import { answerTutor } from "../src/services/tutor.js";

describe("API", () => {
  it("reports the complete course and agent inventory", async () => {
    const response = await app.request("/health");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.checks.courseNodes).toBe(45);
    expect(body.checks.agents).toBe(12);
  });

  it("rejects unsafe SQL", async () => {
    const response = await app.request("/api/sql/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-foundation", mode: "query", sql: "ATTACH DATABASE 'x' AS evil" }),
    });
    expect(response.status).toBe(400);
  });

  it("executes a real query in an isolated sql.js worker", async () => {
    const response = await app.request("/api/sql/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "demo-practice", mode: "query", sql: "SELECT s.name, c.title FROM enrollment e JOIN student s ON s.id=e.student_id JOIN course c ON c.id=e.course_id ORDER BY s.id LIMIT 2" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.sandbox).toBe("sql.js-worker");
    expect(body.rows).toHaveLength(2);
  });

  it("runs the LangGraph resource workflow", async () => {
    const response = await app.request("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-foundation", nodeId: "keys-integrity", type: "diagram" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.resource.status).toBe("approved");
    expect(body.events.at(-1)?.agent).toBe("ReviewAgent");
    expect(body.events).toHaveLength(6);
  });

  it("always includes complete answers and explanations in quiz resources", async () => {
    const response = await app.request("/api/resources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "demo-exam", nodeId: "nf-3bc", type: "quiz" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.resource.content).toContain("参考答案与逐题解析");
    expect(body.resource.content).toContain("候选键为 AB 与 BC");
  });

  it("answers course questions with citations and refuses out-of-scope questions", async () => {
    const courseResponse = await app.request("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-foundation", nodeId: "keys-integrity", question: "候选键和主键有什么区别？" }),
    });
    const courseBody = await courseResponse.json();
    expect(courseResponse.status).toBe(200);
    expect(courseBody.refused).toBe(false);
    expect(courseBody.citations.length).toBeGreaterThan(0);

    const outsideResponse = await app.request("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-foundation", question: "请告诉我今天的天气" }),
    });
    const outsideBody = await outsideResponse.json();
    expect(outsideResponse.status).toBe(200);
    expect(outsideBody.refused).toBe(true);
    expect(outsideBody.citations).toHaveLength(0);
  });

  it("retrieves English database terminology without a node hint", async () => {
    const response = await app.request("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-practice", question: "What is a candidate key?" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.refused).toBe(false);
    expect(body.citations.length).toBeGreaterThan(0);
  });

  it("does not match English course terms inside unrelated words", async () => {
    const response = await app.request("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-practice", question: "Where can I buy a primary school keychain?" }),
    });
    const body = await response.json();
    expect(body.refused).toBe(true);
    expect(body.citations).toHaveLength(0);
  });

  it("corrects a common transaction typo", async () => {
    const response = await app.request("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demo-foundation", question: "事物的四大特性是什么？" }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.refused).toBe(false);
    expect(body.answer).toContain("原子性");
    expect(body.answer).toContain("持久性");
  });

  it("does not classify incidental wording or a node hint as course evidence", async () => {
    const response = await app.request("/api/tutor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: "demo-foundation", nodeId: "tx-acid", question: "今天的事物理财产品收益怎么样？" }) });
    const body = await response.json();
    expect(body.refused).toBe(true);
    expect(body.citations).toHaveLength(0);
  });

  it("degrades to retrieved course evidence when the model times out", async () => {
    const timedOutModel = { mode: "deepseek" as const, generate: async (_prompt: string, fallback: { content: string; summary: string }) => fallback, generateTutor: async () => { throw new Error("AbortError: timed out"); } };
    const result = await answerTutor("候选键和主键有什么区别？", "keys-integrity", timedOutModel);
    expect(result.refused).toBe(false);
    expect(result.answer).toContain("候选键");
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.mode).toBe("fallback");
  });

  it("serves 200+ SQL exercises with guided skeletons", async () => {
    const response = await app.request("/api/sql/exercises");
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.total).toBeGreaterThanOrEqual(200);
    expect(body.coreCount).toBeGreaterThanOrEqual(20);
    expect(body.exercises[0]).toHaveProperty("skeletonSql");
    expect(body.exercises[0]).toHaveProperty("schemaHint");
  });

  it("demonstrates ReviewAgent conditional reject -> rewrite -> pass loop in agentTrace", async () => {
    const response = await app.request("/api/resources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "demo-foundation",
        nodeId: "sql-joins",
        type: "sql-lab",
        forceReviewReject: true,
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.agentTrace.length).toBeGreaterThanOrEqual(7);

    const reviewSteps = body.agentTrace.filter((t: { agent: string }) => t.agent === "ReviewAgent");
    expect(reviewSteps.length).toBe(2);
    expect(reviewSteps[0].status).toBe("rejected");
    expect(reviewSteps[0].score).toBe(65);
    expect(reviewSteps[1].status).toBe("approved");
    expect(reviewSteps[1].score).toBe(94);
  });

  it("runs EvaluationAgent BKT calculation and updates mastery with badge rewards", async () => {
    const response = await app.request("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: "demo-practice",
        nodeId: "sql-joins",
        correct: true,
        sql: "SELECT * FROM enrollment e JOIN student s ON s.id = e.student_id",
      }),
    });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.evaluation.delta).toBeGreaterThan(0);
    expect(body.evaluation.bkt.posterior).toBeGreaterThan(body.evaluation.bkt.prior);
    expect(body.evaluation.unlockedBadges).toContain("初探八表");
    expect(body.history.length).toBeGreaterThanOrEqual(7);
  });

  it("queries 7-day mastery trajectory and retention status within 50ms", async () => {
    const started = Date.now();
    const response = await app.request("/api/mastery/history/demo-foundation");
    const elapsed = Date.now() - started;
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.history.length).toBeGreaterThanOrEqual(7);
    expect(body.retention.length).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(100);
  });
});
