import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import app from "../apps/api/dist/src/app.js";

const root = resolve(import.meta.dirname, "..");

console.log("=== 知径 DB Web 端与全栈端到端功能测试 ===\n");

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    console.log(`  ✓ ${message}`);
    passedCount++;
  } else {
    console.error(`  ✗ ${message}`);
    throw new Error(`测试未通过: ${message}`);
  }
}

async function runTests() {
  // 1. 验证 Web 导出静态文件
  console.log("【1/5】验证 Web 生产构建与静态资源...");
  const distDir = resolve(root, "apps/client/dist");
  assert(existsSync(distDir), "apps/client/dist 构建目录存在");
  assert(existsSync(resolve(distDir, "index.html")), "apps/client/dist/index.html 首页入口存在");
  
  const jsDir = resolve(distDir, "_expo/static/js/web");
  assert(existsSync(jsDir), "Web 打包产物 JS 目录存在");
  const jsFiles = readdirSync(jsDir);
  assert(jsFiles.length > 0, `发现 ${jsFiles.length} 个 Web bundle JS 文件`);

  // 2. 验证 API 健康检查探针
  console.log("\n【2/5】验证 API 探针与服务健康状态...");
  const healthRes = await app.request("/health");
  assert(healthRes.status === 200, "GET /health 响应状态 200 OK");
  const healthData = await healthRes.json();
  assert(healthData.status === "ok", "健康检查状态为 ok");
  assert(healthData.checks.sqlSandbox === "sql.js-worker", "SQL 沙箱就绪 (sql.js-worker)");
  assert(healthData.checks.agents === 12, "12 大智能体就绪 (12 agents)");
  assert(healthData.checks.sqlExercises >= 210, `分级 SQL 题库就绪 (${healthData.checks.sqlExercises} 道)`);

  // 3. 验证登录与学情画像
  console.log("\n【3/5】验证 Web 端登录与画像接口...");
  const loginRes = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "foundation", password: "demo1234" }),
  });
  assert(loginRes.status === 200, "POST /api/auth/login 登录成功");
  const loginData = await loginRes.json();
  assert(loginData.user.id === "demo-foundation", "返回基础薄弱型学生画像 demo-foundation");

  const dashRes = await app.request(`/api/dashboard/${loginData.user.id}`);
  assert(dashRes.status === 200, "GET /api/dashboard/:userId 仪表盘获取成功");
  const dashData = await dashRes.json();
  assert(dashData.path.length >= 3, `智能路径规划返回 ${dashData.path.length} 个断点步骤`);

  // 4. 验证 12 智能体沙盘与 ReviewAgent 打回闭环
  console.log("\n【4/5】验证 12 智能体协同沙盘与 ReviewAgent 质检打回闭环...");
  const resourceRes = await app.request("/api/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "demo-foundation",
      nodeId: "keys-integrity",
      type: "document",
      forceReviewReject: true, // 触发演示条件边打回
    }),
  });
  assert(resourceRes.status === 200, "POST /api/resources 生成请求成功");
  const resourceData = await resourceRes.json();
  assert(resourceData.resource.status === "approved", "最终生成资源审核状态为 approved");
  assert(resourceData.agentTrace.length >= 6, `生成全链路轨迹记录 ${resourceData.agentTrace.length} 个 Agent 节点`);
  
  const hasRejection = resourceData.agentTrace.some((item) => item.status === "rejected" && item.score === 65);
  assert(hasRejection, "成功捕获 ReviewAgent 初审打回重写节点（评分 65 分）");
  const hasApproved = resourceData.agentTrace.some((item) => item.status === "approved" && item.score >= 90);
  assert(hasApproved, "成功捕获 ReviewAgent 复审合格节点（终审评分 >=90 分）");

  // 5. 验证 8 表数据沙箱与 BKT 贝叶斯掌握度演进
  console.log("\n【5/5】验证 8 表数据沙箱执行与 BKT 掌握度跃升...");
  const sqlRunRes = await app.request("/api/sql/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "demo-foundation",
      mode: "query",
      sql: "SELECT s.major, c.title, COUNT(*) AS cnt FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id GROUP BY s.major, c.title ORDER BY cnt DESC",
    }),
  });
  assert(sqlRunRes.status === 200, "POST /api/sql/run 沙箱跨表关联查询成功");
  const sqlRunData = await sqlRunRes.json();
  assert(sqlRunData.rowCount > 0, `沙箱返回真实关联数据 ${sqlRunData.rowCount} 行`);

  const evalRes = await app.request("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "demo-foundation",
      nodeId: "sql-select",
      correct: true,
      sql: "SELECT * FROM student;",
    }),
  });
  assert(evalRes.status === 200, "POST /api/evaluate BKT 掌握度评测成功");
  const evalData = await evalRes.json();
  assert(evalData.evaluation.delta > 0, `BKT 掌握度成功跃升 +${evalData.evaluation.delta}%`);

  const historyRes = await app.request("/api/mastery/history/demo-foundation");
  assert(historyRes.status === 200, "GET /api/mastery/history/:userId 掌握度历史查询成功");
  const historyData = await historyRes.json();
  assert(historyData.history.length >= 7, `获取 7 天历史演进点共 ${historyData.history.length} 个`);
  assert(historyData.retention.length > 0, `获取遗忘曲线复习提醒共 ${historyData.retention.length} 个知识点`);

  console.log(`\n🎉 全部测试通过！共通过 ${passedCount}/${totalCount} 项端到端检查。\n`);
}

runTests().catch((err) => {
  console.error("端到端测试失败:", err);
  process.exit(1);
});
