import { Worker } from "node:worker_threads";

const forbiddenSql = /\b(attach|detach|pragma|vacuum|load_extension|begin|commit|rollback)\b/i;
const querySql = /^\s*(select|with\b[\s\S]+select|explain\s+query\s+plan\s+select)\b/i;
const experimentSql = /^\s*(select|with|explain|create\s+table|insert|update|delete)\b/i;

export function validateSql(sql: string, mode: "query" | "experiment"): string {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (trimmed.includes(";")) throw new Error("每次只能执行一个 SQL 语句");
  if (forbiddenSql.test(trimmed)) throw new Error("该语句在教学沙箱中被禁止");
  if (!(mode === "query" ? querySql : experimentSql).test(trimmed)) {
    throw new Error(`当前 ${mode} 模式不允许该语句`);
  }
  return trimmed;
}

export type SqlResult = {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  elapsedMs: number;
  sandbox: "sql.js-worker";
};

const campusSchema = `CREATE TABLE student (id INTEGER PRIMARY KEY, name TEXT NOT NULL, major TEXT NOT NULL);
CREATE TABLE course (id INTEGER PRIMARY KEY, title TEXT NOT NULL, credits INTEGER NOT NULL);
CREATE TABLE enrollment (student_id INTEGER, course_id INTEGER, score INTEGER, PRIMARY KEY(student_id, course_id), FOREIGN KEY(student_id) REFERENCES student(id), FOREIGN KEY(course_id) REFERENCES course(id));
INSERT INTO student VALUES (1,'林晓','计算机科学'),(2,'周辰','人工智能'),(3,'陈雨','软件工程');
INSERT INTO course VALUES (101,'数据库原理',4),(102,'人工智能导论',3),(103,'软件工程',3);
INSERT INTO enrollment VALUES (1,101,88),(1,102,91),(2,101,84),(2,102,93),(3,101,79);`;

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const initSqlJs = require('sql.js');
(async () => {
  const SQL = await initSqlJs({ locateFile: file => require.resolve('sql.js/dist/' + file) });
  const db = new SQL.Database();
  db.run(${JSON.stringify(campusSchema)});
  const started = Date.now();
  const results = db.exec(workerData.sql, { maxRows: 200 });
  const first = results[0] || { columns: [], values: [] };
  parentPort.postMessage({ columns: first.columns, rows: first.values, rowCount: first.values.length,
    elapsedMs: Date.now() - started, sandbox: 'sql.js-worker' });
  db.close();
})().catch(error => parentPort.postMessage({ error: error.message }));
`;

export async function runSqlSandbox(sql: string, mode: "query" | "experiment", timeoutMs = 2_000): Promise<SqlResult> {
  const safeSql = validateSql(sql, mode);
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, { eval: true, workerData: { sql: safeSql } });
    const timeout = setTimeout(() => {
      void worker.terminate();
      reject(new Error("SQL 执行超过 2 秒，已终止"));
    }, timeoutMs);
    worker.once("message", (message: SqlResult | { error: string }) => {
      clearTimeout(timeout);
      void worker.terminate();
      if ("error" in message) reject(new Error(message.error));
      else resolve(message);
    });
    worker.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}
