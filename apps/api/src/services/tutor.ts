import { knowledgeNodes, knowledgeSources } from "@zhijing/course-data";
import { createModelProvider, type ModelProvider } from "./model.js";

const provider = createModelProvider();
const genericTerms = new Set(["数据库", "database", "dbms", "sql", "数据", "系统"]);
const englishAliases: Record<string, string[]> = {
  relations: ["relation", "tuple", "attribute", "domain"],
  "keys-integrity": ["candidate key", "primary key", "foreign key", "superkey", "referential integrity"],
  "closure-keys": ["attribute closure", "candidate key"],
  "sql-select": ["select query", "where clause", "order by", "null value"],
  "sql-aggregate": ["group by", "having clause", "aggregate function"],
  "sql-joins": ["inner join", "left join", "right join", "outer join", "subquery"],
  "fd-anomalies": ["functional dependency", "update anomaly"],
  "nf-12": ["first normal form", "second normal form", "1nf", "2nf"],
  "nf-3bc": ["third normal form", "boyce codd normal form", "3nf", "bcnf"],
  "tx-acid": ["database transaction", "acid properties", "atomicity", "consistency", "isolation", "durability"],
  isolation: ["isolation level", "dirty read", "nonrepeatable read", "phantom read"],
  "index-basic": ["b tree index", "btree index", "hash index"],
  "index-design": ["composite index", "covering index", "unique index"],
  optimizer: ["query optimizer", "explain plan"],
  "security-ops": ["sql injection", "database audit", "database encryption"],
};

function normalizeQuestion(question: string) {
  return question.toLowerCase().replace(/事物(?=(?:的)?(?:四大|特性|性质|acid|原子性|一致性|隔离性|持久性))/g, "事务");
}

function includesTerm(question: string, term: string) {
  const normalizedTerm = term.toLowerCase();
  if (!/^[a-z0-9 ]+$/.test(normalizedTerm)) return question.includes(normalizedTerm);
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, "i").test(question);
}

export function retrieveTutorEvidence(question: string, nodeId?: string) {
  const normalized = normalizeQuestion(question);
  const ranked = knowledgeNodes.map((node) => {
    const specific = [...node.keywords, ...node.title.split(/[、，与和：\s]+/), ...(englishAliases[node.id] ?? [])]
      .filter((term) => term.length > 1 && !genericTerms.has(term.toLowerCase()));
    const matches = [...new Set(specific.filter((term) => includesTerm(normalized, term)))];
    const explicitNode = nodeId === node.id;
    const score = (explicitNode ? 8 : 0) + matches.reduce((sum, term) => sum + Math.min(term.length, 6), 0);
    return { node, score, matches };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score);

  // A lone generic node hint can focus a course question, but cannot turn an unrelated
  // question into a course question. Require a course term alongside that hint.
  if (ranked[0] && ranked[0].score <= 8 && ranked[0].matches.length === 0) return [];
  return ranked.slice(0, 3);
}

export async function answerTutor(question: string, nodeId?: string, model: ModelProvider = provider) {
  const evidence = retrieveTutorEvidence(question, nodeId);
  if (!evidence.length) return {
    answer: "这个问题没有匹配到《数据库原理》课程知识。请补充数据库、SQL、事务、规范化、索引或安全相关的具体概念。",
    citations: [], refused: true, mode: "refused" as const,
  };
  const top = evidence[0]!;
  const sources = [...new Set(evidence.flatMap(({ node }) => node.sourceIds))]
    .map((id) => knowledgeSources.find((source) => source.id === id)).filter((source) => source !== undefined);
  const fallback = top.node.id === "tx-acid"
    ? "事务的 ACID 四大特性是：原子性表示操作全部成功或全部回滚；一致性表示事务前后完整性约束成立；隔离性表示并发事务不会看到彼此不应见的中间状态；持久性表示提交结果在故障后仍能恢复。自检：转账扣款成功但入账失败时，哪项特性要求回滚？"
    : `你问的是“${top.node.title}”。${top.node.objective}。可以用校园选课系统核对：先找出相关表和约束，再说明这个概念如何解决设计或查询问题。自检：你能用一个选课场景举例说明吗？`;
  const prompt = `学生问题：${question}\n\n检索到的课程知识证据（只能基于这些事实回答）：\n${evidence.map(({ node, matches }) => `- ${node.title}：${node.objective}（匹配词：${matches.join("、") || "当前学习节点"}）`).join("\n")}\n\n来源：${sources.map((source) => `${source.title}，${source.url}`).join("；")}\n请直接解释学生问题，并给一个简短的自检问题。`;
  let answer = fallback;
  try { answer = await (model.generateTutor?.(prompt, fallback) ?? Promise.resolve(fallback)); }
  catch (error) { console.warn("Tutor model failed; using retrieved course evidence", error); }
  return { answer, citations: sources.map(({ id, title, url }) => ({ id, title, url })), refused: false, mode: answer === fallback ? "fallback" : model.mode };
}
