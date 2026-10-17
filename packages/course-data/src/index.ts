import type { KnowledgeNode, KnowledgeSource } from "@zhijing/shared";

export const knowledgeSources: KnowledgeSource[] = [
  {
    id: "bc-dbdesign",
    title: "Database Design – 2nd Edition",
    organization: "BCcampus",
    url: "https://opentextbc.ca/dbdesign01/",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    retrievedAt: "2026-10-01",
  },
  {
    id: "pg-docs",
    title: "PostgreSQL Documentation",
    organization: "PostgreSQL Global Development Group",
    url: "https://www.postgresql.org/docs/current/",
    license: "PostgreSQL License",
    licenseUrl: "https://www.postgresql.org/about/licence/",
    retrievedAt: "2026-10-01",
  },
  {
    id: "sqlite-docs",
    title: "SQLite Documentation",
    organization: "SQLite",
    url: "https://www.sqlite.org/docs.html",
    license: "Public Domain",
    licenseUrl: "https://www.sqlite.org/copyright.html",
    retrievedAt: "2026-10-01",
  },
];

type NodeSeed = [string, string, string, number, string[], string[]];

const seeds: NodeSeed[] = [
  ["db-foundations", "数据库、数据与 DBMS", "区分数据、信息、数据库与数据库管理系统", 1, [], ["数据库", "DBMS"]],
  ["dbms-functions", "DBMS 功能与系统架构", "解释 DBMS 的存储、查询、事务与安全职责", 1, ["db-foundations"], ["DBMS", "架构"]],
  ["three-schema", "三级模式与数据独立性", "说明外模式、模式、内模式及两级独立性", 2, ["db-foundations"], ["三级模式", "数据独立性"]],
  ["data-models", "数据模型与数据库生命周期", "比较概念、逻辑和物理模型", 2, ["db-foundations"], ["数据模型", "生命周期"]],
  ["relations", "关系、元组、属性与域", "准确使用关系模型的基本术语", 1, ["three-schema", "data-models"], ["关系", "元组", "属性"]],
  ["keys-integrity", "键与关系完整性", "识别超键、候选键、主键、外键和完整性约束", 2, ["relations"], ["主键", "外键", "完整性"]],
  ["algebra-basic", "选择、投影与更名", "使用一元关系代数运算表达查询", 2, ["relations"], ["选择", "投影"]],
  ["algebra-set", "并、差与笛卡尔积", "判断集合运算的相容性并组合关系", 2, ["relations"], ["并", "差", "笛卡尔积"]],
  ["algebra-join", "连接、除法与复合表达式", "使用连接和除法解决多关系查询", 3, ["algebra-basic", "algebra-set"], ["连接", "除法"]],
  ["sql-ddl", "SQL 分类、数据类型与 DDL", "创建、修改和删除受约束的表结构", 2, ["keys-integrity"], ["SQL", "DDL"]],
  ["sql-constraints", "SQL 约束", "正确声明主键、外键、唯一、非空与检查约束", 2, ["sql-ddl"], ["约束", "CHECK"]],
  ["sql-dml", "INSERT、UPDATE 与 DELETE", "安全地修改关系数据并理解影响范围", 2, ["sql-ddl"], ["DML", "INSERT", "UPDATE"]],
  ["sql-select", "SELECT、过滤、排序与 NULL", "编写基础查询并正确处理空值逻辑", 2, ["sql-ddl"], ["SELECT", "NULL"]],
  ["sql-aggregate", "聚合、GROUP BY 与 HAVING", "完成分组统计并区分过滤阶段", 3, ["sql-select"], ["聚合", "GROUP BY"]],
  ["sql-joins", "连接、子查询与集合查询", "选择合适的多表查询方式", 3, ["sql-select", "algebra-join"], ["JOIN", "子查询"]],
  ["sql-advanced", "视图、CTE 与窗口函数", "使用高级 SQL 改善查询表达与复用", 4, ["sql-joins", "sql-aggregate"], ["视图", "CTE", "窗口函数"]],
  ["design-requirements", "需求发现与业务规则", "把自然语言业务规则转化为数据需求", 2, ["data-models"], ["需求", "业务规则"]],
  ["er-entities", "实体、属性与标识符", "从业务场景识别实体、属性和标识符", 2, ["design-requirements"], ["ER", "实体"]],
  ["er-relationships", "联系、基数与参与约束", "绘制并解释实体之间的联系", 3, ["er-entities"], ["联系", "基数"]],
  ["er-advanced", "弱实体、多值属性与特化", "处理复杂概念模型中的结构选择", 4, ["er-relationships"], ["弱实体", "特化"]],
  ["er-mapping", "ER 到关系模式的转换", "把概念模型系统转换为关系模式并复核", 3, ["er-relationships", "keys-integrity"], ["模式转换", "ER"]],
  ["fd-anomalies", "冗余、异常与函数依赖", "从更新异常识别不良模式及依赖关系", 3, ["keys-integrity", "er-mapping"], ["函数依赖", "异常"]],
  ["closure-keys", "属性闭包与候选键", "使用属性闭包求解候选键", 4, ["fd-anomalies"], ["闭包", "候选键"]],
  ["nf-12", "第一范式与第二范式", "识别部分依赖并完成 2NF 分解", 3, ["fd-anomalies"], ["1NF", "2NF"]],
  ["nf-3bc", "第三范式与 BCNF", "识别传递依赖并比较 3NF 与 BCNF", 4, ["closure-keys", "nf-12"], ["3NF", "BCNF"]],
  ["decomposition", "无损连接与依赖保持", "评价分解的正确性与工程权衡", 5, ["nf-3bc"], ["无损连接", "依赖保持"]],
  ["tx-acid", "事务、状态与 ACID", "解释事务边界、状态和 ACID 属性", 2, ["sql-dml"], ["事务", "ACID"]],
  ["serializability", "调度与可串行化", "判断冲突等价及冲突可串行化", 5, ["tx-acid"], ["调度", "可串行化"]],
  ["recoverability", "可恢复性与级联回滚", "区分可恢复、无级联和严格调度", 4, ["tx-acid"], ["可恢复性", "级联回滚"]],
  ["isolation", "并发异常与隔离级别", "识别脏读、不可重复读与幻读", 3, ["tx-acid"], ["隔离级别", "并发异常"]],
  ["locking", "锁、两阶段锁与死锁", "使用锁协议分析并发与死锁", 4, ["isolation"], ["锁", "2PL", "死锁"]],
  ["mvcc", "MVCC、快照与乐观并发", "解释多版本并发控制的读取视图", 5, ["isolation"], ["MVCC", "快照"]],
  ["failure-types", "故障类型与恢复目标", "分类事务、系统和介质故障", 2, ["tx-acid"], ["故障", "恢复"]],
  ["wal-checkpoint", "日志、WAL 与检查点", "说明先写日志规则和检查点作用", 4, ["failure-types"], ["WAL", "检查点"]],
  ["undo-redo", "UNDO、REDO 与崩溃恢复", "根据日志判断撤销和重做动作", 5, ["wal-checkpoint", "recoverability"], ["UNDO", "REDO"]],
  ["backup", "备份、恢复与时间点恢复", "选择逻辑、物理备份及恢复策略", 3, ["failure-types"], ["备份", "PITR"]],
  ["storage", "页、记录与存储组织", "解释数据库的基本物理存储单位", 3, ["dbms-functions"], ["页", "记录"]],
  ["index-basic", "B 树与哈希索引", "比较索引结构适用的查询模式", 3, ["storage", "sql-select"], ["B树", "B+树", "B-树", "哈希索引", "索引"]],
  ["index-design", "复合、覆盖与唯一索引", "根据查询模式设计并评价索引", 4, ["index-basic"], ["复合索引", "覆盖索引"]],
  ["query-plan", "查询算子与执行计划", "阅读常见算子和计划树", 4, ["sql-joins", "storage"], ["执行计划", "算子"]],
  ["optimizer", "代价、统计信息与 EXPLAIN", "用 EXPLAIN 分析并改进查询", 5, ["query-plan", "index-design"], ["优化器", "EXPLAIN"]],
  ["auth-roles", "认证、角色与权限", "设计最小权限角色和授权方案", 3, ["dbms-functions", "sql-ddl"], ["角色", "权限"]],
  ["least-privilege", "最小权限、视图与行级安全", "用视图和策略限制数据访问", 4, ["auth-roles", "sql-advanced"], ["最小权限", "RLS"]],
  ["integrity-triggers", "声明式约束与触发器", "判断何时使用约束或触发器", 3, ["sql-constraints"], ["触发器", "完整性"]],
  ["security-ops", "SQL 注入、审计、加密与隐私", "构建数据库应用的纵深安全控制", 3, ["auth-roles", "backup"], ["SQL注入", "审计", "隐私"]],
];

const moduleForIndex = (index: number): string => {
  if (index < 4) return "M1 数据库基础";
  if (index < 9) return "M2 关系模型与关系代数";
  if (index < 16) return "M3 SQL";
  if (index < 21) return "M4 概念与逻辑设计";
  if (index < 26) return "M5 函数依赖与规范化";
  if (index < 32) return "M6 事务与并发";
  if (index < 36) return "M7 数据库恢复";
  if (index < 41) return "M8 存储、索引与优化";
  return "M9 安全与完整性";
};

export const knowledgeNodes: KnowledgeNode[] = seeds.map(
  ([id, title, objective, difficulty, prerequisites, keywords], index) => ({
    id,
    module: moduleForIndex(index),
    title,
    objective,
    difficulty,
    prerequisites,
    keywords,
    sourceIds: index >= 26 ? ["pg-docs", "sqlite-docs"] : ["bc-dbdesign", "pg-docs"],
  }),
);

export const flagshipCase = {
  id: "campus-course-selection",
  title: "校园选课系统数据库设计与优化",
  description: "围绕学生、课程、教师、开课班与选课记录，贯穿 ER 建模、规范化、SQL、事务、索引与权限。",
  entities: ["student", "course", "teacher", "section", "enrollment"],
};

export * from "./exercises.js";

export const getKnowledgeNode = (id: string) => knowledgeNodes.find((node) => node.id === id);
