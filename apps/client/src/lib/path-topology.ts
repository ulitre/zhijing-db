import type { PathItem } from "../state/app-context";

export type NodeStateKey = "remedial" | "steady" | "mastered";

export type Flashcard = {
  essence: string;
  visual: "normalization" | "keys" | "anomalies" | "generic";
  analogy: string;
  pitfall: string;
  example: string;
  quiz: { question: string; options: readonly string[]; correct: number; explanation: string };
};

export type TopologyNode = {
  id: string;
  /** Canonical course-data knowledge-node id used by the real resource API. */
  apiNodeId: string;
  title: string;
  chapterKey: ChapterKey;
  chapterLabel: string;
  mastery: number;
  minutes: number;
  resourceType: string;
  prereqs: string[];
  next: string[];
  summary: string;
  flashcard: Flashcard;
  evidenceLines: string[];
  pathNode?: boolean;
  pathStatus?: string;
  pathIndex?: number;
  realId?: string;
  reason?: string;
};

export type ChapterKey = "relations" | "sql" | "design" | "storage";

export const CHAPTERS: readonly { key: ChapterKey; label: string; caption: string }[] = [
  { key: "relations", label: "关系模型", caption: "表、键与完整性" },
  { key: "sql", label: "SQL 核心", caption: "查询、连接与聚合" },
  { key: "design", label: "范式与设计", caption: "依赖、分解与异常" },
  { key: "storage", label: "索引与事务", caption: "执行、并发与恢复" },
];

export const CHAPTER_LABELS: Record<ChapterKey, string> = {
  relations: "关系模型",
  sql: "SQL 核心",
  design: "范式与设计",
  storage: "索引与事务",
};

type Seed = { id: string; title: string; chapterKey: ChapterKey; mastery: number; minutes: number; resourceType: string };

const SEEDS: readonly Seed[] = [
  { id: "course-basics", title: "课程基础", chapterKey: "relations", mastery: 92, minutes: 8, resourceType: "讲解文档" },
  { id: "relations", title: "关系、元组、属性与域", chapterKey: "relations", mastery: 48, minutes: 12, resourceType: "知识图解" },
  { id: "keys-integrity", title: "键与关系完整性", chapterKey: "relations", mastery: 76, minutes: 14, resourceType: "讲解文档" },
  { id: "entity-relationship", title: "实体-联系模型", chapterKey: "relations", mastery: 84, minutes: 11, resourceType: "交互图解" },
  { id: "relational-algebra", title: "关系代数基础", chapterKey: "relations", mastery: 86, minutes: 13, resourceType: "分层练习" },
  { id: "select-project", title: "选择与投影", chapterKey: "relations", mastery: 88, minutes: 9, resourceType: "分层练习" },
  { id: "join-cartesian", title: "连接与笛卡尔积", chapterKey: "relations", mastery: 57, minutes: 15, resourceType: "交互图解" },
  { id: "set-operations", title: "并、交、差运算", chapterKey: "relations", mastery: 82, minutes: 10, resourceType: "分层练习" },
  { id: "integrity-constraints", title: "完整性约束", chapterKey: "relations", mastery: 72, minutes: 12, resourceType: "讲解文档" },
  { id: "schema-design", title: "关系模式设计", chapterKey: "relations", mastery: 66, minutes: 16, resourceType: "知识图解" },

  { id: "sql-select", title: "SELECT 与联表查询", chapterKey: "sql", mastery: 74, minutes: 12, resourceType: "SQL 实操" },
  { id: "sql-where", title: "WHERE 过滤", chapterKey: "sql", mastery: 90, minutes: 8, resourceType: "分层练习" },
  { id: "sql-sort", title: "排序与分页", chapterKey: "sql", mastery: 84, minutes: 9, resourceType: "分层练习" },
  { id: "sql-aggregate", title: "聚合与分组", chapterKey: "sql", mastery: 83, minutes: 12, resourceType: "SQL 实操" },
  { id: "sql-multi-join", title: "多表 JOIN", chapterKey: "sql", mastery: 64, minutes: 16, resourceType: "SQL 实操" },
  { id: "sql-subquery", title: "子查询嵌套", chapterKey: "sql", mastery: 49, minutes: 18, resourceType: "SQL 实操" },
  { id: "sql-correlated", title: "相关子查询", chapterKey: "sql", mastery: 44, minutes: 18, resourceType: "SQL 实操" },
  { id: "sql-set", title: "UNION 与集合运算", chapterKey: "sql", mastery: 85, minutes: 10, resourceType: "分层练习" },
  { id: "sql-window", title: "窗口函数", chapterKey: "sql", mastery: 38, minutes: 20, resourceType: "讲解文档" },
  { id: "sql-view-cte", title: "视图与 CTE", chapterKey: "sql", mastery: 68, minutes: 13, resourceType: "讲解文档" },
  { id: "sql-injection", title: "SQL 注入与安全", chapterKey: "sql", mastery: 88, minutes: 14, resourceType: "交互图解" },
  { id: "sql-execution-order", title: "查询执行顺序", chapterKey: "sql", mastery: 71, minutes: 11, resourceType: "知识图解" },

  { id: "fd-basics", title: "函数依赖基础", chapterKey: "design", mastery: 66, minutes: 12, resourceType: "知识图解" },
  { id: "closure-keys", title: "属性闭包与候选键", chapterKey: "design", mastery: 52, minutes: 16, resourceType: "分层练习" },
  { id: "nf-1-2", title: "1NF 与 2NF", chapterKey: "design", mastery: 82, minutes: 12, resourceType: "讲解文档" },
  { id: "nf-3bc", title: "第三范式与 BCNF", chapterKey: "design", mastery: 46, minutes: 18, resourceType: "分层练习" },
  { id: "redundancy-fd", title: "冗余、异常与函数依赖", chapterKey: "design", mastery: 58, minutes: 15, resourceType: "交互图解" },
  { id: "lossless-decomposition", title: "无损分解", chapterKey: "design", mastery: 64, minutes: 17, resourceType: "分层练习" },
  { id: "dependency-preserve", title: "保持依赖", chapterKey: "design", mastery: 61, minutes: 16, resourceType: "知识图解" },
  { id: "nf-4", title: "多值依赖与 4NF", chapterKey: "design", mastery: 39, minutes: 20, resourceType: "讲解文档" },
  { id: "sql-normalization", title: "SQL 范式调优", chapterKey: "design", mastery: 68, minutes: 14, resourceType: "SQL 实操" },
  { id: "denormalization", title: "反规范化权衡", chapterKey: "design", mastery: 81, minutes: 15, resourceType: "交互图解" },
  { id: "schema-evolution", title: "表结构演进", chapterKey: "design", mastery: 43, minutes: 17, resourceType: "讲解文档" },
  { id: "data-modeling", title: "数据建模实战", chapterKey: "design", mastery: 70, minutes: 19, resourceType: "交互图解" },

  { id: "btree", title: "B+ 树索引基础", chapterKey: "storage", mastery: 86, minutes: 12, resourceType: "知识图解" },
  { id: "index-design", title: "复合与覆盖索引", chapterKey: "storage", mastery: 48, minutes: 18, resourceType: "SQL 实操" },
  { id: "optimizer", title: "执行计划与 EXPLAIN", chapterKey: "storage", mastery: 42, minutes: 20, resourceType: "SQL 实操" },
  { id: "slow-query", title: "慢查询分析", chapterKey: "storage", mastery: 67, minutes: 16, resourceType: "SQL 实操" },
  { id: "join-algorithms", title: "连接算法", chapterKey: "storage", mastery: 73, minutes: 15, resourceType: "知识图解" },
  { id: "tx-acid", title: "事务与 ACID", chapterKey: "storage", mastery: 72, minutes: 13, resourceType: "复习卡片" },
  { id: "isolation", title: "并发异常与隔离级别", chapterKey: "storage", mastery: 68, minutes: 17, resourceType: "交互图解" },
  { id: "lock-mvcc", title: "锁与 MVCC", chapterKey: "storage", mastery: 41, minutes: 18, resourceType: "讲解文档" },
  { id: "deadlock", title: "死锁检测", chapterKey: "storage", mastery: 44, minutes: 15, resourceType: "交互图解" },
  { id: "recovery", title: "日志与恢复", chapterKey: "storage", mastery: 65, minutes: 16, resourceType: "讲解文档" },
  { id: "distributed-tx", title: "分布式事务", chapterKey: "storage", mastery: 36, minutes: 22, resourceType: "讲解文档" },
];

const LINK_OVERRIDES: Record<string, { prereqs?: string[]; next?: string[] }> = {
  "course-basics": { prereqs: [], next: ["relations", "nf-3bc"] },
  "nf-3bc": { prereqs: ["course-basics"], next: ["keys-integrity", "redundancy-fd"] },
  "keys-integrity": { next: ["redundancy-fd"] },
  "redundancy-fd": { next: ["sql-normalization"] },
  "closure-keys": { prereqs: ["fd-basics"] },
  "index-design": { prereqs: ["btree"] },
  "optimizer": { prereqs: ["btree", "index-design"] },
  "isolation": { prereqs: ["tx-acid"] },
  "sql-multi-join": { prereqs: ["sql-select", "join-cartesian"] },
  "sql-correlated": { prereqs: ["sql-subquery"] },
};

/**
 * The visual topology is intentionally finer-grained than the course graph.
 * Every visual node must map to a real course-data node because
 * `POST /api/resources` rejects ids that do not exist in the curriculum.
 */
const API_NODE_BY_TOPOLOGY: Record<string, string> = {
  "course-basics": "db-foundations",
  relations: "relations",
  "keys-integrity": "keys-integrity",
  "entity-relationship": "er-entities",
  "relational-algebra": "algebra-basic",
  "select-project": "algebra-basic",
  "join-cartesian": "algebra-join",
  "set-operations": "algebra-set",
  "integrity-constraints": "sql-constraints",
  "schema-design": "er-mapping",
  "sql-select": "sql-select",
  "sql-where": "sql-select",
  "sql-sort": "sql-select",
  "sql-aggregate": "sql-aggregate",
  "sql-multi-join": "sql-joins",
  "sql-subquery": "sql-joins",
  "sql-correlated": "sql-joins",
  "sql-set": "sql-joins",
  "sql-window": "sql-advanced",
  "sql-view-cte": "sql-advanced",
  "sql-injection": "security-ops",
  "sql-execution-order": "query-plan",
  "fd-basics": "fd-anomalies",
  "closure-keys": "closure-keys",
  "nf-1-2": "nf-12",
  "nf-3bc": "nf-3bc",
  "redundancy-fd": "fd-anomalies",
  "lossless-decomposition": "decomposition",
  "dependency-preserve": "decomposition",
  "nf-4": "decomposition",
  "sql-normalization": "nf-3bc",
  denormalization: "decomposition",
  "schema-evolution": "data-models",
  "data-modeling": "er-mapping",
  btree: "index-basic",
  "index-design": "index-design",
  optimizer: "optimizer",
  "slow-query": "optimizer",
  "join-algorithms": "query-plan",
  "tx-acid": "tx-acid",
  isolation: "isolation",
  "lock-mvcc": "mvcc",
  deadlock: "locking",
  recovery: "undo-redo",
  "distributed-tx": "serializability",
};

const KEY_SUMMARIES: Record<string, string> = {
  "course-basics": "数据库 = 结构化数据 + 完整性约束 + 可查询的语义模型。",
  relations: "表是关系，行是元组，列是属性，域定义列的取值范围。",
  "keys-integrity": "超键包含候选键，候选键包含主键；外键维护参照完整性。",
  "closure-keys": "用属性闭包从函数依赖推导候选键，避免漏键或错键。",
  "nf-3bc": "范式逐级消除部分依赖、传递依赖与决定因素异常。",
  "redundancy-fd": "函数依赖造成冗余，冗余在增删改时变成异常。",
  "sql-normalization": "范式减少异常，反规范化换性能；先用 EXPLAIN 证明瓶颈。",
  "sql-select": "先确定结果列，再用 JOIN 与 WHERE 组合出目标关系。",
  "index-design": "复合索引遵循最左前缀，覆盖索引避免回表。",
  optimizer: "先看访问类型与扫描行数，再决定索引、改写或统计信息。",
  "tx-acid": "ACID 是事务的四条边界：原子、一致、隔离、持久。",
  isolation: "隔离级别是在并发正确性与吞吐之间做的取舍。",
};

const KEY_FLASHCARDS: Record<string, Flashcard> = {
  "course-basics": {
    essence: "数据库 = 结构化数据 + 完整性约束 + 可查询的语义模型。",
    visual: "generic",
    analogy: "把数据库想成一座图书馆：书架是表，索引是目录，约束是借阅规则。",
    pitfall: "只关注 SQL 写法，忽略数据模型与约束，后续范式与索引会反复踩坑。",
    example: "同一门课程被多个学生选修：课程信息只存一份，选课关系只记录“谁选了什么”。",
    quiz: { question: "在关系数据库中，一张二维表最准确的称呼是？", options: ["关系", "元组", "属性", "域"], correct: 0, explanation: "表对应关系；一行是元组，一列是属性，列的取值范围是域。" },
  },
  "keys-integrity": {
    essence: "超键 ⊃ 候选键 ⊃ 主键；外键把关系之间的引用变成可验证的约束。",
    visual: "keys",
    analogy: "候选键是能唯一点名的学号或身份证号；主键是学校最终选用的那一个。",
    pitfall: "把候选键当成主键，或忘记外键的参照完整性，导致孤儿记录。",
    example: "student(sid, id_card, name)：sid 与 id_card 都能唯一标识学生，二者都是候选键；选 sid 为主键。",
    quiz: { question: "候选键与主键的关系是？", options: ["候选键可以有多个，主键从中选一个", "主键可以有多个，候选键只能有一个", "二者完全等价", "外键一定是主键"], correct: 0, explanation: "候选键是能唯一标识元组的最小属性集，主键是从候选键中选定的一个。" },
  },
  "closure-keys": {
    essence: "候选键 = 能推出全部属性、且自身最小的属性集；用闭包逐步“滚雪球”。",
    visual: "keys",
    analogy: "把函数依赖想成多米诺骨牌：从已知属性出发，推倒它能决定的属性，直到覆盖全部属性。",
    pitfall: "只试单属性或双属性组合，忽略三属性候选键，或把超键误判为候选键。",
    example: "R(A,B,C,D)，A→B、B→C、C→D：{A}+ = ABCD，因此 A 是候选键；AB 是超键但不是候选键。",
    quiz: { question: "若 {A}+ 覆盖关系 R 的全部属性，则 A 至少是？", options: ["候选键（还需验证最小性）", "外键", "主属性", "非主属性"], correct: 0, explanation: "闭包覆盖全属性说明 A 是超键；若 A 的任一真子集闭包不能覆盖全属性，A 才是候选键。" },
  },
  "nf-3bc": {
    essence: "1NF 原子性 → 2NF 消除部分依赖 → 3NF 消除传递依赖 → BCNF 每个决定因素都包含候选码。",
    visual: "normalization",
    analogy: "像整理衣柜：先保证每件衣服独立（1NF），再按类别分层（2NF），最后消除跨层依赖（3NF/BCNF）。",
    pitfall: "只背 3NF/BCNF 定义，不会用属性闭包判断候选键与决定因素。",
    example: "R(A,B,C)，A→B、B→C：B→C 是传递依赖，R 不满足 3NF；分解为 R1(A,B)、R2(B,C)。",
    quiz: { question: "关系 R(A,B,C) 中 A→B、B→C，R 至少违反哪个范式？", options: ["1NF", "2NF", "3NF"], correct: 2, explanation: "B→C 使非主属性 C 传递依赖于候选键 A，违反 3NF。" },
  },
  "redundancy-fd": {
    essence: "函数依赖造成冗余；冗余在插入、删除、更新时转化为异常。",
    visual: "anomalies",
    analogy: "同一个事实被抄在多行：改一处忘另一处，就会产生互相矛盾的数据。",
    pitfall: "把冗余只当成“占空间”，忽略它会导致更新异常与数据不一致。",
    example: "把系名与系主任写进每条学生记录：换系主任时要更新多行，漏改即更新异常；删除最后一名学生则丢失系信息。",
    quiz: { question: "下列哪项不是冗余带来的典型异常？", options: ["插入异常", "删除异常", "更新异常", "查询结果排序错误"], correct: 3, explanation: "排序错误属于查询语义或排序规则问题，不是函数依赖冗余导致的三类更新异常。" },
  },
  "sql-normalization": {
    essence: "范式减少异常，反规范化换性能；先用执行计划证明瓶颈，再做受控冗余。",
    visual: "anomalies",
    analogy: "规范化像把账本拆成规范的分册；反规范化像为高频报表加一张汇总页，必须接受同步成本。",
    pitfall: "未测量就反规范化，或反规范化后没有同步机制，造成数据漂移。",
    example: "订单列表需要用户名：可在订单表冗余 user_name，但必须由触发器或应用层保证与用户表同步。",
    quiz: { question: "决定是否反规范化前，最应该先做什么？", options: ["用 EXPLAIN 与真实数据证明瓶颈", "直接删除外键", "把所有表合并", "只增加字段不测试"], correct: 0, explanation: "反规范化是以一致性成本换性能，应先有可验证的性能证据。" },
  },
  "tx-acid": {
    essence: "ACID 是事务的四条边界：原子、一致、隔离、持久。",
    visual: "generic",
    analogy: "转账像一次不可分割的搬砖：要么两边都完成，要么一块都不动。",
    pitfall: "把隔离性等同于“完全串行”，忽略隔离级别带来的并发异常。",
    example: "A 向 B 转账 100：扣款与入账要么同时提交，要么同时回滚；提交后即使宕机也不能丢。",
    quiz: { question: "事务提交后即使系统故障也不丢失，体现哪一特性？", options: ["原子性", "一致性", "隔离性", "持久性"], correct: 3, explanation: "持久性由日志与恢复机制保证，提交结果在故障后仍然存在。" },
  },
  "index-design": {
    essence: "复合索引遵循最左前缀；覆盖索引用索引列直接满足查询，避免回表。",
    visual: "generic",
    analogy: "复合索引像按“姓+名”排序的电话簿：只查名字无法利用排序，先查姓才行。",
    pitfall: "为每个列建单列索引，或把选择性低的列放在复合索引最左侧。",
    example: "索引 (dept, age)：WHERE dept=? AND age>? 可命中；只写 WHERE age>? 无法使用该索引的最左前缀。",
    quiz: { question: "复合索引 (dept, age) 下，哪类查询无法有效利用索引？", options: ["WHERE dept = ?", "WHERE dept = ? AND age > ?", "WHERE age > ?"], correct: 2, explanation: "缺少最左列 dept，无法使用该复合索引的有序前缀。" },
  },
  optimizer: {
    essence: "EXPLAIN 先看访问类型与扫描行数，再决定索引、改写或统计信息。",
    visual: "generic",
    analogy: "执行计划像导航路线：先看走的是高速还是小路，再决定是否换路线。",
    pitfall: "只看 cost 数字，不看 type、key、rows 与实际数据分布。",
    example: "EXPLAIN 显示 type=ALL、rows=1.2M、key=NULL：优先考虑补充 WHERE/JOIN 列索引，而不是盲目调大缓冲池。",
    quiz: { question: "EXPLAIN 中看到 type=ALL、key=NULL，最可能的含义是？", options: ["全表扫描且未使用索引", "使用了覆盖索引", "只扫描一行", "查询被缓存"], correct: 0, explanation: "type=ALL 表示全表扫描，key=NULL 表示没有使用索引。" },
  },
};

const KEY_EVIDENCE: Record<string, string[]> = {
  "course-basics": ["先修诊断：数据库基本概念正确率 92%", "已作为多条路径的根前置节点"],
  relations: ["最近 3 次作答：关系术语正确率 48%", "前置课程基础已达标，可立即突破"],
  "keys-integrity": ["历史作答：候选键/主键判定错误率 35%", "外键参照完整性题曾出现孤儿记录"],
  "closure-keys": ["错题聚类：三属性候选键遗漏 2 次", "属性闭包推导步骤不完整"],
  "nf-3bc": ["历史作答：BCNF 判定错误率 54%", "传递依赖与决定因素概念混淆", "突破后可解锁 6 个下游节点"],
  "redundancy-fd": ["错题聚类：插入/删除异常混淆 62%", "函数依赖冗余题缺少反例分析"],
  "sql-normalization": ["路径证据：范式与性能权衡题正确率 68%", "已具备范式基础，适合进入调优实战"],
  "sql-select": ["初始画像：SQL 查询掌握度 44%", "多表联查结果集基数估算偏差"],
  "index-design": ["错题聚类：最左前缀失效场景 48%", "覆盖索引与回表概念尚未稳定"],
  optimizer: ["慢查询样本：type=ALL · rows 1.2M · key=NULL", "执行计划解读正确率 42%"],
  "tx-acid": ["历史作答：ACID 四特性匹配正确率 58%", "持久性与隔离性概念易混"],
  isolation: ["错题聚类：不可重复读与幻读混淆", "隔离级别与并发异常映射不完整"],
};

function genericFlashcard(seed: Seed): Flashcard {
  const chapter = CHAPTER_LABELS[seed.chapterKey];
  return {
    essence: `「${seed.title}」是${chapter}中的关键节点，需要同时说清它的定义边界、约束条件与在真实查询中的作用。`,
    visual: "generic",
    analogy: `把「${seed.title}」放进 student、course、enrollment 三张表或一条真实 SQL 中检查：它解决什么问题，又依赖哪些完整性约束？`,
    pitfall: `在${chapter}中混淆「${seed.title}」与相邻概念的边界，忽略主键、外键、NULL 或执行顺序。`,
    example: `用 student、course、enrollment 构造一个满足「${seed.title}」约束的正例与一个违反约束的反例，并解释差异。`,
    quiz: {
      question: `判断对「${seed.title}」的理解是否可靠，最有效的方式是？`,
      options: ["落到具体关系模式，用反例与执行计划验证", "只背术语定义", "跳过约束检查", "只看示例结果的第一行"],
      correct: 0,
      explanation: `「${seed.title}」的结论必须能在真实模式、约束或执行行为中复现，反例能暴露边界条件中的错误。`,
    },
  };
}

function buildNodes(): TopologyNode[] {
  const perChapter = CHAPTERS.map((chapter) => SEEDS.filter((seed) => seed.chapterKey === chapter.key));
  const chapterIndex = new Map<ChapterKey, number>(CHAPTERS.map((chapter, index) => [chapter.key, index]));
  return SEEDS.map((seed) => {
    const chapter = chapterIndex.get(seed.chapterKey) ?? 0;
    const siblings = perChapter[chapter] ?? [];
    const pos = siblings.findIndex((item) => item.id === seed.id);
    const previousChapter = chapter > 0 ? perChapter[chapter - 1] : null;
    const defaultPrereq = pos > 0 ? [siblings[pos - 1]!.id] : previousChapter ? [previousChapter[previousChapter.length - 1]!.id] : [];
    const defaultNext = pos >= 0 && pos < siblings.length - 1 ? [siblings[pos + 1]!.id] : [];
    const override = LINK_OVERRIDES[seed.id];
    const evidenceLines = KEY_EVIDENCE[seed.id] ?? [
      `最近作答：该节点掌握度 ${seed.mastery}%`,
      seed.mastery < 60 ? "存在前置断点，建议先补齐依赖" : "已具备继续推进的基础",
    ];
    return {
      ...seed,
      apiNodeId: API_NODE_BY_TOPOLOGY[seed.id] ?? seed.id,
      chapterLabel: CHAPTER_LABELS[seed.chapterKey],
      prereqs: override?.prereqs ?? defaultPrereq,
      next: override?.next ?? defaultNext,
      summary: KEY_SUMMARIES[seed.id] ?? `「${seed.title}」属于${CHAPTER_LABELS[seed.chapterKey]}，重点掌握其定义、约束与在真实查询中的执行代价。`,
      flashcard: KEY_FLASHCARDS[seed.id] ?? genericFlashcard(seed),
      evidenceLines,
    };
  });
}

export const TOPOLOGY_NODES: readonly TopologyNode[] = buildNodes();

export function mergePath(nodes: readonly TopologyNode[], path: readonly PathItem[]): TopologyNode[] {
  const assigned = new Map<string, { item: PathItem; index: number }>();
  const used = new Set<string>();
  path.forEach((item, index) => {
    const candidates = nodes.filter((node) => !used.has(node.id));
    const match = candidates.find((node) => node.id === item.nodeId)
      ?? candidates.find((node) => node.title === item.title)
      ?? candidates.find((node) => node.apiNodeId === item.nodeId);
    if (!match) return;
    used.add(match.id);
    assigned.set(match.id, { item, index });
  });
  return nodes.map((node) => {
    const match = assigned.get(node.id);
    if (!match) return node;
    const { item, index } = match;
    return {
      ...node,
      title: item.title,
      mastery: item.mastery,
      resourceType: item.resource,
      reason: item.reason,
      pathNode: true,
      pathStatus: item.status,
      pathIndex: index,
      realId: item.id,
      evidenceLines: item.evidence.split("；").filter(Boolean),
    };
  });
}

export function stateOf(mastery: number): { key: NodeStateKey; label: string; glyph: string; range: string } {
  if (mastery >= 80) return { key: "mastered", label: "已掌握", glyph: "✓", range: "≥80%" };
  if (mastery >= 60) return { key: "steady", label: "巩固提升", glyph: "◇", range: "60–79%" };
  return { key: "remedial", label: "优先突破断点", glyph: "!", range: "<60%" };
}

export function countsOf(nodes: readonly TopologyNode[]) {
  const counts = { all: nodes.length, remedial: 0, steady: 0, mastered: 0 };
  for (const node of nodes) counts[stateOf(node.mastery).key] += 1;
  return counts;
}

export function filterNodes(nodes: readonly TopologyNode[], filter: "all" | NodeStateKey): TopologyNode[] {
  if (filter === "all") return [...nodes];
  return nodes.filter((node) => stateOf(node.mastery).key === filter);
}

export function focusChain(nodes: readonly TopologyNode[], selectedId: string): TopologyNode[] {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const selected = map.get(selectedId);
  if (!selected) return [];
  const upstream: TopologyNode[] = [];
  let cursor = selected;
  for (let depth = 0; depth < 2; depth += 1) {
    const parent = cursor.prereqs.map((id) => map.get(id)).find((item): item is TopologyNode => Boolean(item) && !upstream.some((node) => node.id === item!.id));
    if (!parent) break;
    upstream.unshift(parent);
    cursor = parent;
  }
  const downstream: TopologyNode[] = [];
  const queue = [...selected.next];
  while (queue.length > 0 && downstream.length < 3) {
    const id = queue.shift();
    if (!id) continue;
    const node = map.get(id);
    if (!node || node.id === selected.id || downstream.some((item) => item.id === node.id)) continue;
    downstream.push(node);
    queue.push(...node.next);
  }
  return [...upstream, selected, ...downstream].slice(-6);
}

export function downstreamCount(nodes: readonly TopologyNode[], id: string): number {
  const map = new Map(nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const queue = [...(map.get(id)?.next ?? [])];
  while (queue.length > 0) {
    const nextId = queue.shift();
    if (!nextId || seen.has(nextId)) continue;
    seen.add(nextId);
    queue.push(...(map.get(nextId)?.next ?? []));
  }
  return seen.size;
}

export function nodeById(nodes: readonly TopologyNode[], id: string | null): TopologyNode | null {
  if (!id) return null;
  return nodes.find((node) => node.id === id || node.apiNodeId === id) ?? null;
}
