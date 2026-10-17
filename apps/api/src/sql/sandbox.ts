import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import path from "node:path";

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

// 验收矩阵与外部调用方使用复数表名 `students`，而建表用的是单数 `student`。
// 保留一个只读别名，让两种写法都能查到同一份数据，避免演示时出现 no such table。
export const campusSchema = `
CREATE TABLE student (id INTEGER PRIMARY KEY, name TEXT NOT NULL, major TEXT NOT NULL, grade INTEGER NOT NULL, gpa REAL NOT NULL);
CREATE VIEW students AS SELECT * FROM student;
CREATE TABLE course (id INTEGER PRIMARY KEY, title TEXT NOT NULL, credits INTEGER NOT NULL, department TEXT NOT NULL);
CREATE TABLE teacher (id INTEGER PRIMARY KEY, name TEXT NOT NULL, title TEXT NOT NULL, department TEXT NOT NULL);
CREATE TABLE enrollment (student_id INTEGER, course_id INTEGER, teacher_id INTEGER, score INTEGER, term TEXT NOT NULL, PRIMARY KEY(student_id, course_id), FOREIGN KEY(student_id) REFERENCES student(id), FOREIGN KEY(course_id) REFERENCES course(id), FOREIGN KEY(teacher_id) REFERENCES teacher(id));
CREATE TABLE category (id INTEGER PRIMARY KEY, name TEXT NOT NULL, parent_id INTEGER);
CREATE TABLE product (id INTEGER PRIMARY KEY, name TEXT NOT NULL, category_id INTEGER NOT NULL, price REAL NOT NULL, stock INTEGER NOT NULL, FOREIGN KEY(category_id) REFERENCES category(id));
CREATE TABLE orders (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, order_date TEXT NOT NULL, total_amount REAL NOT NULL, status TEXT NOT NULL, FOREIGN KEY(student_id) REFERENCES student(id));
CREATE TABLE order_item (id INTEGER PRIMARY KEY, order_id INTEGER NOT NULL, product_id INTEGER NOT NULL, quantity INTEGER NOT NULL, unit_price REAL NOT NULL, FOREIGN KEY(order_id) REFERENCES orders(id), FOREIGN KEY(product_id) REFERENCES product(id));

INSERT INTO student VALUES 
  (1, '林晓', '计算机科学', 2023, 3.82),
  (2, '周辰', '人工智能', 2023, 3.91),
  (3, '陈雨', '软件工程', 2022, 3.45),
  (4, '赵明', '计算机科学', 2022, 3.65),
  (5, '孙俪', '数据科学', 2024, 3.78),
  (6, '李博', '人工智能', 2024, 3.52);

INSERT INTO course VALUES 
  (101, '数据库原理', 4, '计算机学院'),
  (102, '人工智能导论', 3, '人工智能学院'),
  (103, '软件工程', 3, '软件学院'),
  (104, '算法与数据结构', 4, '计算机学院'),
  (105, '分布式系统', 3, '计算机学院');

INSERT INTO teacher VALUES
  (1, '张教授', '教授', '计算机学院'),
  (2, '王副教授', '副教授', '人工智能学院'),
  (3, '李讲师', '讲师', '软件学院'),
  (4, '刘教授', '教授', '计算机学院');

INSERT INTO enrollment VALUES 
  (1, 101, 1, 88, '2024-秋季'),
  (1, 102, 2, 91, '2024-秋季'),
  (1, 104, 4, 85, '2025-春季'),
  (2, 101, 1, 84, '2024-秋季'),
  (2, 102, 2, 93, '2024-秋季'),
  (2, 105, 4, 89, '2025-春季'),
  (3, 101, 1, 79, '2024-秋季'),
  (3, 103, 3, 95, '2024-秋季'),
  (4, 101, 1, 92, '2024-秋季'),
  (4, 104, 4, 76, '2025-春季'),
  (5, 101, 1, 88, '2024-秋季'),
  (6, 102, 2, 82, '2024-秋季');

INSERT INTO category VALUES
  (1, '数码文具', NULL),
  (2, '教材书籍', NULL),
  (3, '云服务算力卡', 1),
  (4, '考研复习资料', 2);

INSERT INTO product VALUES
  (1, '《数据库系统概念》第7版', 2, 89.0, 50),
  (2, '《深入理解计算机系统》', 2, 128.0, 30),
  (3, 'GPU云训练时长卡(100小时)', 3, 199.0, 100),
  (4, '机械键盘(静音红轴)', 1, 299.0, 20),
  (5, '4K高清显示器连接线', 1, 39.0, 80),
  (6, '《软件体系结构与设计》', 2, 65.0, 45),
  (7, '408计算机统考历年真题解析', 4, 58.0, 60),
  (8, '无线人体工学鼠标', 1, 149.0, 35);

INSERT INTO orders VALUES
  (1001, 1, '2025-03-01 10:30:00', 288.0, 'completed'),
  (1002, 2, '2025-03-02 14:15:00', 199.0, 'completed'),
  (1003, 1, '2025-03-05 09:20:00', 338.0, 'completed'),
  (1004, 3, '2025-03-06 16:40:00', 89.0, 'completed'),
  (1005, 4, '2025-03-10 11:05:00', 207.0, 'completed'),
  (1006, 5, '2025-03-12 18:00:00', 58.0, 'pending');

INSERT INTO order_item VALUES
  (1, 1001, 1, 1, 89.0),
  (2, 1001, 3, 1, 199.0),
  (3, 1002, 3, 1, 199.0),
  (4, 1003, 4, 1, 299.0),
  (5, 1003, 5, 1, 39.0),
  (6, 1004, 1, 1, 89.0),
  (7, 1005, 7, 1, 58.0),
  (8, 1005, 8, 1, 149.0),
  (9, 1006, 7, 1, 58.0),
  (10, 1003, 1, 1, 89.0);
`;

// Resolve sql.js from this module's own location so the worker never depends on the
// process cwd. An eval'd worker inherits cwd-based resolution, which fails whenever the
// server is started from outside apps/api (e.g. `node apps/api/dist/src/server.js`).
const requireFromHere = createRequire(import.meta.url);
const sqlJsEntry = requireFromHere.resolve("sql.js");
const sqlJsDistDir = path.dirname(sqlJsEntry);

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const initSqlJs = require(workerData.sqlJsEntry);
(async () => {
  const SQL = await initSqlJs({ locateFile: file => workerData.sqlJsDistDir + '/' + file });
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
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { sql: safeSql, sqlJsEntry, sqlJsDistDir },
    });
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
