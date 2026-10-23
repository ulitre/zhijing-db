import type { TopologyNode } from "./path-topology";

export type LearningType = "讲解文档" | "知识图解" | "分层练习" | "SQL 实操" | "交互图解" | "复习卡片";

export type LearningQuiz = {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  tag: string;
};

export type FlashcardDeckItem = {
  kind: string;
  front: string;
  back: string;
  hint: string;
};

export type SqlLesson = {
  title: string;
  sql: string;
  note: string;
};

const LEARNING_TYPES: readonly LearningType[] = ["讲解文档", "知识图解", "分层练习", "SQL 实操", "交互图解", "复习卡片"];

export function isLearningType(value: string): value is LearningType {
  return LEARNING_TYPES.includes(value as LearningType);
}

export function learningTypeFor(value: string): LearningType {
  return isLearningType(value) ? value : "讲解文档";
}

/** Real course knowledge, written as exam-ready facts rather than title templates. */
const NODE_FACTS: Record<string, readonly string[]> = {
  "course-basics": [
    "数据库是长期存储在计算机内、有组织、可共享的数据集合；DBMS 负责定义、操纵、控制与恢复。",
    "数据是原始事实，信息是经过解释并具有语义的数据；数据库强调结构化、共享与受控冗余。",
    "模式是相对稳定的结构，实例是某一时刻的数据快照；三级模式与两级映像支撑数据独立性。",
  ],
  relations: [
    "关系对应一张二维表，是笛卡尔积 D1×D2×…×Dn 的有限子集；任意两行元组绝不能完全相同。",
    "元组对应一行记录，属性对应一列；域是属性的取值范围，例如成绩域通常约束为 0~100。",
    "第一范式（1NF）的底线：每个属性分量必须是不可再分的原子值，不能在一个格子里存逗号分隔的多个课程号。",
  ],
  "keys-integrity": [
    "超键 ⊃ 候选键 ⊃ 主键：候选键是能唯一标识元组的最小属性集，主键是从候选键中选定的一个。",
    "实体完整性：主属性绝不能为 NULL；否则主键无法唯一标识元组。",
    "参照完整性：外键要么为 NULL，要么等于被参照表中已存在的主键值。CREATE TABLE enrollment (sid CHAR(8), cid CHAR(8), FOREIGN KEY (sid) REFERENCES student(sid)); 插入不存在的 sid='9999' 会触发 FOREIGN KEY constraint failed。",
  ],
  "entity-relationship": [
    "实体是客观存在并可相互区分的事物，属性描述实体，联系描述实体之间的关联。",
    "联系的基数有一对一、一对多和多对多；参与约束分为全部参与和部分参与。",
    "弱实体依赖强实体存在，用部分键加所属强实体的主键共同标识。",
  ],
  "relational-algebra": [
    "选择 σ 按条件筛选行，投影 π 选取列（集合语义下去重），更名 ρ 修改关系或属性名。",
    "连接是笛卡尔积再按条件筛选；自然连接在公共属性上做等值匹配并去掉重复列。",
    "并、交、差要求两个关系同目且对应属性域兼容，否则运算没有定义。",
  ],
  "select-project": [
    "选择从行维度过滤，投影从列维度保留；纯关系代数的投影结果按集合处理，会去重。",
    "SQL SELECT 默认保留重复行，需要 DISTINCT 才去重，这与关系代数的集合语义不同。",
    "投影后再连接可能丢失连接键，必须保留后续连接所需的属性。",
  ],
  "join-cartesian": [
    "笛卡尔积 R×S 的基数是 |R|×|S|，目是两边属性个数之和。",
    "θ 连接 = σ_condition(R×S)；等值连接保留公共属性，自然连接去掉重复的公共属性列。",
    "缺失连接条件会产生爆炸式结果；外连接保留未匹配行，并用 NULL 补齐另一侧。",
  ],
  "set-operations": [
    "并、交、差要求两个关系同目，且对应列来自兼容的域。",
    "SQL UNION 去重，UNION ALL 保留重复；集合语义与多重集语义不同会影响行数。",
    "差运算可表达“在 A 中但不在 B 中”的查询，如未选任何课程的学生。",
  ],
  "integrity-constraints": [
    "域完整性限制列的类型与取值范围；实体完整性要求主键非空且唯一。",
    "参照完整性要求外键为 NULL 或引用已存在的主键；违反时数据库拒绝写入。",
    "约束可声明在列级或表级；复杂跨行业务规则可能需要触发器或应用层事务补偿。",
  ],
  "schema-design": [
    "数据库设计通常经过概念模型、逻辑模型和物理模型三个阶段，关注点从语义逐步落到存储。",
    "ER 图转关系模式时，1:N 联系通常在多端加入外键，M:N 联系需要独立的关系表。",
    "模式设计要同时考虑范式、真实查询路径和约束维护成本，不能只追求理论最简。",
  ],
  "sql-select": [
    "SELECT 的逻辑执行顺序：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。",
    "SELECT 列表决定输出列，DISTINCT 对结果行去重，列别名在 SELECT 之后才能被 WHERE 引用。",
    "NULL 与任何值做普通比较都返回 UNKNOWN，判断空值必须使用 IS NULL / IS NOT NULL。",
  ],
  "sql-where": [
    "WHERE 在分组之前逐行过滤，聚合函数不能直接写在 WHERE 中。",
    "SQL 采用三值逻辑：TRUE、FALSE、UNKNOWN；只有条件为 TRUE 的行才进入结果集。",
    "NOT IN 的子查询若包含 NULL，可能整体返回 UNKNOWN；可排除 NULL 或改用 NOT EXISTS。",
  ],
  "sql-sort": [
    "ORDER BY 支持多列排序，NULL 的排序位置由具体数据库实现决定。",
    "LIMIT/OFFSET 分页若没有唯一且稳定的排序键，可能重复或漏行。",
    "ORDER BY 在 SELECT 之后逻辑执行，因此可以使用 SELECT 中定义的列别名。",
  ],
  "sql-aggregate": [
    "COUNT(*) 统计行数，COUNT(col) 忽略 NULL，COUNT(DISTINCT col) 对非空值去重计数。",
    "GROUP BY 分组后每组输出一行，HAVING 在分组后过滤组，WHERE 在分组前过滤行。",
    "标准 SQL 要求 SELECT 中的非聚合列出现在 GROUP BY 中，否则语义不确定。",
  ],
  "sql-multi-join": [
    "INNER JOIN 只保留匹配行，LEFT JOIN 保留左表全部行并用 NULL 补齐右表。",
    "ON 描述连接条件，WHERE 在连接后过滤；在外连接中误把右表条件写进 WHERE 可能退化成内连接。",
    "连接结果的行数取决于匹配基数，多对多连接可能放大结果集。",
  ],
  "sql-subquery": [
    "标量子查询返回单行单列，IN/ANY/ALL 子查询可返回多行值。",
    "非相关子查询可以独立求值一次；相关子查询在语义上按外层行重复求值。",
    "EXISTS 只判断是否存在匹配行，通常在相关空值和半连接场景更安全。",
  ],
  "sql-correlated": [
    "相关子查询引用外层查询的列，逻辑上对外层每一行执行一次。",
    "EXISTS/NOT EXISTS 表达半连接语义，适合“有/没有关联记录”的判断。",
    "关联条件写错会导致结果放大；应结合 EXPLAIN 的行数估算检查。",
  ],
  "sql-set": [
    "UNION 对结果去重，UNION ALL 保留所有行；INTERSECT/EXCEPT 分别求交与差。",
    "集合运算要求列数相同、类型兼容；结果列名通常取第一个查询的列名。",
    "ORDER BY 只能出现在整个集合运算的末尾，不能夹在中间。",
  ],
  "sql-window": [
    "窗口函数不会折叠分组，OVER(PARTITION BY ... ORDER BY ...) 定义每行的计算窗口。",
    "ROW_NUMBER 生成唯一序号，RANK 遇并列跳号，DENSE_RANK 遇并列不跳号。",
    "窗口函数在 SELECT 阶段计算，不能直接出现在 WHERE 中，需要借助子查询或 CTE。",
  ],
  "sql-view-cte": [
    "视图是保存的查询定义，默认不物化；访问视图时会展开查询或由优化器内联。",
    "CTE 为语句提供命名结果集，递归 CTE 需要 WITH RECURSIVE；作用域通常限于当前语句。",
    "窗口函数在保留明细行的同时完成组内排名、累计与移动计算，例如 RANK() OVER (PARTITION BY course_id ORDER BY score DESC)。",
  ],
  "sql-injection": [
    "SQL 注入源于把用户输入当作 SQL 结构的一部分拼接执行。",
    "参数化查询/预编译把数据与语法分离，是阻断注入的首要手段。",
    "最小权限、输入校验和错误信息脱敏属于纵深防御，但不能替代参数化。",
  ],
  "sql-execution-order": [
    "逻辑执行顺序为 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。",
    "WHERE 在分组前过滤，不能引用 SELECT 别名；HAVING 在分组后过滤，可以使用聚合。",
    "物理执行计划可能重排连接与扫描顺序，但查询语义仍遵循逻辑顺序。",
  ],
  "fd-basics": [
    "函数依赖 X→Y 表示在关系实例中，X 的取值唯一决定 Y 的取值。",
    "Armstrong 公理包括自反、增广、传递；它们可推导出属性闭包。",
    "平凡依赖满足 Y⊆X；完全依赖、部分依赖与传递依赖是范式判定的基础。",
  ],
  "closure-keys": [
    "属性闭包 X+ 是从 X 出发，由函数依赖能推导出的全部属性集合。",
    "若 X+ 覆盖全部属性，X 是超键；再检查最小性，才是候选键。",
    "求候选键可从不出现在任何函数依赖右部的属性入手，再逐步扩展闭包。",
  ],
  "nf-1-2": [
    "1NF 要求每个属性值都是原子值，不能把多个值塞进一个字段或单元格。",
    "2NF 在 1NF 基础上消除非主属性对候选键的部分依赖。",
    "组合键关系中，非主属性只依赖键的一部分，即违反 2NF。",
  ],
  "nf-3bc": [
    "3NF：每个非主属性都不传递依赖于候选键，即不存在非主属性决定非主属性的链。",
    "BCNF：每个非平凡函数依赖的决定因素都必须是超键，比 3NF 更严格。",
    "R(A,B,C) 中 A→B、B→C：B→C 使 C 传递依赖 A，R 违反 3NF；可分解为 R1(A,B)、R2(B,C)。",
  ],
  "redundancy-fd": [
    "冗余来自同一事实在多行重复存储，通常由不良函数依赖导致。",
    "插入异常：缺少主体信息时无法插入事实；删除异常：删除主体时丢失事实；更新异常：多行漏改造成不一致。",
    "规范化的目标是通过分解减少异常，同时保持连接可恢复与依赖可维护。",
  ],
  "lossless-decomposition": [
    "无损连接分解要求分解后的关系自然连接后能够恢复原关系，既不丢行也不多行。",
    "二分解 R1、R2 的无损判定常用条件：R1∩R2 → R1 或 R1∩R2 → R2 成立。",
    "无损连接与保持依赖是两个独立性质，需要分别验证。",
  ],
  "dependency-preserve": [
    "保持依赖要求原函数依赖集合中的每个依赖都能由分解后各关系的投影依赖推导出来。",
    "分解可能无损但丢失依赖，导致更新约束难以在单个关系内检查。",
    "3NF 合成法可以同时实现无损连接和保持依赖；BCNF 分解不保证保持依赖。",
  ],
  "nf-4": [
    "多值依赖 X→→Y 表示 X 决定一组 Y 值，而 Y 与其余属性 Z 相互独立。",
    "4NF 要求每个非平凡多值依赖的决定因素都是超键。",
    "多值依赖不能用函数依赖替代判断，必须单独检查。",
  ],
  "sql-normalization": [
    "规范化减少冗余与更新异常，反规范化用受控冗余换取查询性能。",
    "规范化程度要结合读写比例、一致性与查询模式，不能机械追求高范式。",
    "反规范化后必须有同步机制和回归测试，否则会产生数据漂移。",
  ],
  denormalization: [
    "反规范化通过冗余列或汇总表减少连接和聚合，降低读路径成本。",
    "代价是写入放大、同步复杂和一致性风险。",
    "只有在 EXPLAIN 与真实负载证明瓶颈后，才考虑反规范化。",
  ],
  "schema-evolution": [
    "模式演进要兼容旧数据与旧客户端，常用 expand-contract：先扩新结构，再迁移，最后收缩旧结构。",
    "新增可空列或新表通常向后兼容；删除列、改类型和重命名风险更高。",
    "迁移需要可回滚、可观测，并为历史数据准备回填与校验步骤。",
  ],
  "data-modeling": [
    "概念模型关注实体、联系和约束，逻辑模型落到关系模式与键，物理模型再考虑存储与索引。",
    "M:N 联系需要独立关系表；1:N 可在多端加入外键。",
    "模型必须能支持关键查询路径，同时表达主键、外键和业务约束。",
  ],
  btree: [
    "B+ 树的内部节点只保存键和指针，数据都放在叶子节点，因此扇出高、树高小。",
    "叶子节点按键有序并通过链表连接，适合等值查询、范围查询和排序。",
    "索引会增加写放大与存储成本，索引数量需要与写负载权衡。",
  ],
  "index-design": [
    "复合索引遵循最左前缀：(a,b) 可服务 a 或 a+b 的查询，不能服务仅 b 的查询。",
    "覆盖索引包含查询需要的全部列，可以避免回表；SELECT * 往往会破坏覆盖。",
    "选择性高的列更适合作为索引前缀；低基数布尔列单独建索引收益通常有限。",
  ],
  optimizer: [
    "EXPLAIN 中的 type、key、rows 比单一 cost 数字更能说明访问路径和数据量。",
    "优化器依赖统计信息；统计过期或数据分布倾斜会导致错误计划。",
    "索引、SQL 改写、统计更新和连接顺序都是优化手段，需要以执行计划验证。",
  ],
  "slow-query": [
    "先定位慢在扫描、连接、排序还是回表，再决定优化方向。",
    "避免 SELECT *、在索引列上套函数、隐式类型转换和错误的 JOIN 条件。",
    "用真实参数和数据分布复现慢查询，空表测试没有意义。",
  ],
  "join-algorithms": [
    "嵌套循环连接适合外表小或内表有索引的场景，代价约为外表行数乘内表访问成本。",
    "哈希连接适合等值大表连接；排序合并连接适合已有顺序或可排序的输入。",
    "连接算法选择取决于基数、内存、索引和统计信息，不能只看 SQL 写法。",
  ],
  "tx-acid": [
    "原子性：事务中的操作要么全部成功，要么全部回滚；一致性：事务前后满足完整性约束。",
    "隔离性：并发事务互不干扰；持久性：事务提交后即使系统故障也不会丢失。",
    "ACID 是事务的基本边界；隔离级别是在并发正确性与吞吐之间做出的取舍。",
  ],
  isolation: [
    "脏读读取未提交数据；不可重复读是同一行两次读取结果不同；幻读是同一范围两次查询行数变化。",
    "隔离级别从 READ UNCOMMITTED、READ COMMITTED、REPEATABLE READ 到 SERIALIZABLE 逐步增强。",
    "更高隔离通常意味着更多锁、冲突或重试，吞吐会下降。",
  ],
  "lock-mvcc": [
    "两阶段锁协议：增长阶段加锁，收缩阶段释放；严格 2PL 可保证可串行化。",
    "MVCC 通过版本链或快照让读操作不阻塞写操作，但写写冲突仍需控制。",
    "快照隔离可能产生写偏斜，需要串行化或额外约束来消除异常。",
  ],
  deadlock: [
    "死锁是多个事务互相等待对方持有的锁，形成等待环。",
    "检测通常构造等待图，发现环后回滚代价较小的事务作为牺牲者。",
    "固定加锁顺序、缩短事务、合理索引和降低锁粒度可以降低死锁概率。",
  ],
  recovery: [
    "WAL 先写日志再写数据页，保证事务的原子性与持久性。",
    "UNDO 回滚未提交事务，REDO 重做已提交但尚未落盘的事务。",
    "检查点缩短恢复扫描范围；介质故障恢复依赖备份与归档日志。",
  ],
  "distributed-tx": [
    "两阶段提交 2PC：准备阶段协调者询问参与者，提交阶段统一提交或回滚。",
    "2PC 存在阻塞和协调者单点问题；长事务常用 Saga 或补偿事务替代。",
    "分布式一致性需要在 CAP、可用性与业务补偿之间权衡，不能只追求强一致。",
  ],
};

/**
 * One real, exam-ready sentence per node. This is the sentence shown as
 * 「一句话本质」 in the path inspector and the teaching reader — never a
 * generic study-method template.
 */
const NODE_ESSENCE: Record<string, string> = {
  "course-basics": "数据库是有组织、可共享、受完整性约束的数据集合；DBMS 统一负责定义、操纵、控制与恢复。",
  relations: "关系是笛卡尔积的有限子集（二维表），元组是行记录，属性是列，域是取值范围；满足 1NF 要求所有属性分量不可再分。",
  "keys-integrity": "超键 ⊃ 候选键 ⊃ 主键：候选键是能唯一标识元组的最小属性集，主键从中选定，外键负责参照完整性。",
  "entity-relationship": "ER 模型用实体、属性与联系描述现实世界；1:N 在多端加外键，M:N 必须拆成独立关系表。",
  "relational-algebra": "关系代数是 SQL 的数学基础：σ 选行、π 选列、ρ 改名，连接 = 笛卡尔积 + 条件筛选。",
  "select-project": "选择按行过滤、投影按列保留；关系代数投影是集合语义会去重，SQL 需 DISTINCT 才去重。",
  "join-cartesian": "R×S 的基数是 |R|×|S|；θ 连接 = σ(R×S)，自然连接去重公共列，漏写连接条件会爆炸成笛卡尔积。",
  "set-operations": "并、交、差要求两关系同目且对应域兼容；SQL 中 UNION 去重、UNION ALL 保留重复。",
  "integrity-constraints": "完整性约束分域、实体与参照三类：值域合法、主键非空唯一、外键只能引用已存在的主键。",
  "schema-design": "数据库设计从概念模型到逻辑模型再到物理模型；模型要同时满足范式、查询路径与约束维护成本。",
  "sql-select": "SELECT 逻辑顺序是 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT，NULL 比较返回 UNKNOWN。",
  "sql-where": "WHERE 在分组前逐行过滤，条件为 TRUE 才保留；NULL 参与的比较是 UNKNOWN，必须用 IS NULL 判断。",
  "sql-sort": "ORDER BY 在 SELECT 之后执行，可分页排序；没有唯一稳定排序键时 LIMIT/OFFSET 可能重复或漏行。",
  "sql-aggregate": "GROUP BY 把行折叠成组，COUNT(*) 计行、COUNT(col) 忽略 NULL；HAVING 在分组后过滤组。",
  "sql-multi-join": "INNER JOIN 只留匹配行，LEFT JOIN 保留左表全部行；ON 写连接条件，WHERE 在连接后过滤。",
  "sql-subquery": "子查询按返回形态分标量、IN/ANY/ALL 与 EXISTS；相关子查询引用外层列，语义上逐行求值。",
  "sql-correlated": "相关子查询对外层每一行执行一次；EXISTS/NOT EXISTS 表达半连接，避免 NOT IN 遇到 NULL 的陷阱。",
  "sql-set": "UNION 去重、UNION ALL 保留重复，INTERSECT/EXCEPT 求交与差；列数、类型必须兼容，ORDER BY 只能放末尾。",
  "sql-window": "窗口函数在保留明细行的同时做分区排名与累计；窗口在 SELECT 阶段计算，不能直接写进 WHERE。",
  "sql-view-cte": "视图是保存的查询定义，默认不物化；CTE 是语句级命名结果集，递归 CTE 需要 WITH RECURSIVE。",
  "sql-injection": "SQL 注入是把用户输入当作 SQL 结构拼接执行；参数化查询把数据与语法分离，是首要防线。",
  "sql-execution-order": "逻辑执行顺序 FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT 决定了别名与聚合的可用位置。",
  "fd-basics": "函数依赖 X→Y 表示 X 的取值唯一决定 Y；Armstrong 自反、增广、传递公理可推导全部闭包。",
  "closure-keys": "属性闭包 X+ 是从 X 出发能推出的全部属性；X+ 覆盖全属性即超键，再验证最小性才是候选键。",
  "nf-1-2": "1NF 要求属性原子化；2NF 在此基础上消除非主属性对候选键的部分依赖。",
  "nf-3bc": "3NF 消除非主属性对候选键的传递依赖；BCNF 进一步要求每个非平凡依赖的决定因素都是超键。",
  "redundancy-fd": "同一事实在多行重复即冗余，会在插入、删除、更新时变成异常；规范化用分解消除这些异常。",
  "lossless-decomposition": "无损分解要求自然连接后能精确恢复原关系；二分解可用 R1∩R2→R1 或 R1∩R2→R2 判定。",
  "dependency-preserve": "保持依赖要求原依赖集合都能由分解后各关系的投影依赖推导；3NF 合成可同时无损且保持依赖。",
  "nf-4": "多值依赖 X→→Y 表示 X 决定一组 Y 值，Y 与其余属性独立；4NF 要求非平凡 MVD 的决定因素是超键。",
  "sql-normalization": "规范化减少冗余与更新异常，反规范化用受控冗余换读性能；先用 EXPLAIN 证明瓶颈再动手。",
  denormalization: "反规范化通过冗余列或汇总表降低读路径成本，代价是写放大、同步复杂与一致性风险。",
  "schema-evolution": "模式演进优先用 expand-contract：先扩新结构，再迁移回填，最后收缩旧结构，保证可回滚。",
  "data-modeling": "建模先识别实体、联系与约束，再映射为关系模式；M:N 拆关联表，1:N 在多端加外键。",
  btree: "B+ 树只在叶子存数据、内部节点存键与指针，扇出高树高小；叶子有序链表天然支持范围查询与排序。",
  "index-design": "复合索引遵循最左前缀 (a,b) 服务 a 或 a+b；覆盖索引包含查询全部列，避免回表。",
  optimizer: "EXPLAIN 先看 type、key、rows 再谈 cost；统计信息过期会导致选错访问路径与连接顺序。",
  "slow-query": "先定位慢在扫描、连接、排序还是回表，再决定加索引、改写 SQL 或更新统计信息。",
  "join-algorithms": "嵌套循环适合外表小或内表有索引，哈希连接适合等值大表，排序合并适合已有顺序的输入。",
  "tx-acid": "ACID 是事务四条边界：原子性全成或全回滚、一致性守约束、隔离性并发不互扰、持久性提交不丢。",
  isolation: "隔离级别在正确性与吞吐间取舍：脏读、不可重复读、幻读分别被 READ COMMITTED / REPEATABLE READ / SERIALIZABLE 消除。",
  "lock-mvcc": "两阶段锁保证可串行化；MVCC 用版本链让读不阻塞写，但写写冲突与写偏斜仍需处理。",
  deadlock: "死锁是事务互相等待成环；数据库构造等待图检测环，并回滚代价较小的事务作为牺牲者。",
  recovery: "WAL 先写日志再写数据页；UNDO 回滚未提交事务，REDO 重做已提交未落盘事务，检查点缩短恢复时间。",
  "distributed-tx": "2PC 用准备与提交两阶段保证原子提交，但存在阻塞与协调者单点；长事务常用 Saga 补偿替代。",
};

const NODE_QUIZ: Record<string, LearningQuiz> = {
  relations: {
    question: "一张学生表有 5 列、120 行数据，该关系的目（Degree）与基数（Cardinality）分别是？",
    options: ["目为 5，基数为 120", "目为 120，基数为 5", "目与基数都等于 600", "关系中允许存在两行完全相同的元组"],
    correct: 0,
    explanation: "目是属性（列）个数，基数是元组（行）个数；关系是笛卡尔积的子集，任意两行不能完全相同。",
    tag: "关系模型",
  },
  "keys-integrity": {
    question: "向 enrollment 表插入一个 student 表中不存在的 sid='9999'，通常会触发什么？",
    options: ["外键约束失败（FOREIGN KEY constraint failed）", "自动创建新学生", "主键重复但插入成功", "外键自动转为 NULL"],
    correct: 0,
    explanation: "外键参照完整性要求外键值存在于被参照表中；除非外键允许 NULL，否则不存在的主键值会被拒绝。",
    tag: "参照完整性",
  },
  "sql-select": {
    question: "哪条查询能正确筛选 GPA 非空且不低于 3.6 的学生，并按 GPA 倒序？",
    options: [
      "SELECT name, gpa FROM student WHERE gpa IS NOT NULL AND gpa >= 3.6 ORDER BY gpa DESC",
      "SELECT name, gpa FROM student WHERE gpa = NULL AND gpa >= 3.6 ORDER BY gpa",
      "SELECT name, gpa FROM student WHERE gpa >= 3.6 ORDER BY gpa HAVING gpa IS NULL",
      "SELECT name, gpa FROM student ORDER BY gpa WHERE gpa IS NULL",
    ],
    correct: 0,
    explanation: "NULL 必须使用 IS NULL/IS NOT NULL；WHERE 在 ORDER BY 之前过滤，合法 SQL 中 WHERE 也不能放在 ORDER BY 之后。",
    tag: "SELECT / NULL",
  },
  "nf-3bc": {
    question: "R(A,B,C)，A→B、B→C，R 至少违反哪个范式？",
    options: ["1NF", "2NF", "3NF", "BCNF"],
    correct: 2,
    explanation: "B→C 使非主属性 C 传递依赖候选键 A，因此 R 违反 3NF；分解为 R1(A,B)、R2(B,C)。",
    tag: "规范化",
  },
  "sql-view-cte": {
    question: "关于视图与 CTE，哪项描述正确？",
    options: [
      "视图保存查询定义，默认不物化；CTE 提供语句级命名结果集",
      "视图必须每次手动刷新数据副本",
      "CTE 只能用于 UPDATE，不能用于 SELECT",
      "窗口函数会折叠分组，只返回每组一行",
    ],
    correct: 0,
    explanation: "视图默认是查询定义而非物化副本；CTE 是语句内的命名结果，窗口函数保留明细行。",
    tag: "视图 / CTE",
  },
  "tx-acid": {
    question: "事务提交后即使系统故障也不丢失，体现 ACID 的哪一特性？",
    options: ["原子性", "一致性", "隔离性", "持久性"],
    correct: 3,
    explanation: "持久性由日志与恢复机制保证，提交结果在故障后仍能恢复。",
    tag: "事务 / ACID",
  },
  btree: {
    question: "B+ 树索引最适合下列哪类查询？",
    options: ["按索引列做范围查询与排序", "对每一行都做全表随机扫描", "只查询非索引列且没有覆盖索引", "对索引列使用函数后再等值比较"],
    correct: 0,
    explanation: "B+ 树叶子节点有序且链表相连，范围查询和排序可以直接利用索引顺序。",
    tag: "B+ 树",
  },
  "index-design": {
    question: "复合索引 (dept, age) 无法有效服务哪类条件？",
    options: ["WHERE dept = ?", "WHERE dept = ? AND age > ?", "WHERE age > ?", "WHERE dept = ? ORDER BY age"],
    correct: 2,
    explanation: "复合索引遵循最左前缀；缺少最左列 dept 时，无法利用该索引的有序前缀。",
    tag: "复合索引",
  },
};

const CHAPTER_QUIZ: Record<string, LearningQuiz> = {
  relations: {
    question: "关系代数中对投影 π 的描述，哪项正确？",
    options: ["选择列并按集合语义去重", "只筛选行，不改变列", "把两张表做笛卡尔积", "只保留重复行"],
    correct: 0,
    explanation: "投影选取指定属性；在纯关系代数的集合语义下，重复元组会被消除。",
    tag: "关系代数",
  },
  sql: {
    question: "WHERE 与 HAVING 的核心区别是什么？",
    options: ["WHERE 在分组前过滤行，HAVING 在分组后过滤组", "两者完全等价，可以随意互换", "HAVING 只能过滤单行", "WHERE 只能和 ORDER BY 一起使用"],
    correct: 0,
    explanation: "WHERE 在 GROUP BY 之前过滤行，HAVING 在分组后对组条件过滤，且可以使用聚合。",
    tag: "SQL 执行顺序",
  },
  design: {
    question: "3NF 与 BCNF 的关键区别是什么？",
    options: ["BCNF 要求每个非平凡 FD 的决定因素都是超键，比 3NF 更严格", "3NF 允许部分依赖，BCNF 不允许主键", "两者都只检查多值依赖", "BCNF 一定保持所有函数依赖"],
    correct: 0,
    explanation: "3NF 消除非主属性对候选键的传递依赖；BCNF 进一步要求所有决定因素都是超键。",
    tag: "范式",
  },
  storage: {
    question: "MVCC 的主要收益是什么？",
    options: ["读操作基于快照，通常不阻塞写操作", "完全消除所有死锁", "自动为所有列创建索引", "让事务不再需要日志"],
    correct: 0,
    explanation: "MVCC 通过多版本/快照提供一致性读取，减少读写冲突；写写冲突和写偏斜仍需处理。",
    tag: "并发控制",
  },
};


const NODE_CARD_FRONTS: Record<string, readonly string[]> = {
  relations: ["关系和元组如何对应二维表？", "1NF 的原子性底线是什么？", "目（Degree）与基数（Cardinality）如何计算？"],
  "keys-integrity": ["超键、候选键、主键如何包含？", "为什么主属性不能为 NULL？", "外键如何拦截孤儿记录？"],
  "sql-select": ["SELECT 的逻辑执行顺序是什么？", "为什么 gpa = NULL 查不到数据？", "一条筛选非空 GPA 的查询怎么写？"],
  "nf-3bc": ["3NF 消除哪类依赖？", "BCNF 对决定因素有什么要求？", "A→B、B→C 为什么违反 3NF？"],
  "sql-view-cte": ["视图和 CTE 的本质区别是什么？", "窗口函数为什么保留明细行？", "CTE 如何计算课程平均分？"],
  "tx-acid": ["ACID 四条边界分别是什么？", "哪个特性保证提交后不丢失？", "隔离级别如何对应并发异常？"],
  btree: ["B+ 树为什么适合范围查询？", "叶子链表在索引中起什么作用？", "索引会带来哪些写放大代价？"],
  "index-design": ["复合索引的最左前缀如何工作？", "覆盖索引如何避免回表？", "什么情况下单列索引收益很低？"],
  "sql-aggregate": ["COUNT(*) 与 COUNT(col) 有何区别？", "WHERE 与 HAVING 的执行阶段如何分界？", "分组查询的非聚合列为何必须出现在 GROUP BY？"],
  "sql-multi-join": ["INNER JOIN 与 LEFT JOIN 的结果边界是什么？", "ON 与 WHERE 在外连接中为何不能随意互换？", "多对多连接为什么会放大行数？"],
  "redundancy-fd": ["冗余会引发哪三类异常？", "插入异常与删除异常的区别是什么？", "规范化分解如何减少异常？"],
};

const NODE_EXAMPLES: Record<string, string> = {
  "course-basics": "校园选课库把 student、course、enrollment 拆成三张表：课程信息只存一份，选课只记录谁选了什么。",
  relations: "student(sid, name, gpa) 5 列 120 行：目=5、基数=120；任意两行元组不能完全相同。",
  "keys-integrity": "student(sid, id_card, name)：sid 与 id_card 都是候选键，选 sid 为主键；enrollment.sid 是引用 student.sid 的外键。",
  "entity-relationship": "学生与课程是多对多联系，ER 图用菱形连接，转关系模式时得到 enrollment(sid, cid, score)。",
  "relational-algebra": "σ_{gpa≥3.6}(student) 筛出高绩点学生，再 π_{name, gpa} 只保留两列并去重。",
  "select-project": "π_{name}(student) 只保留姓名列；若两人同名，关系代数结果只出现一行，SQL 需加 DISTINCT。",
  "join-cartesian": "student(120 行) × enrollment(600 行) = 72000 行；漏写 ON 条件时查询会从 600 行膨胀到 7 万行。",
  "set-operations": "选修 C01 的学生集合 UNION 选修 C02 的学生集合得到选修任一课程的学生；INTERSECT 得到两门都选的人。",
  "integrity-constraints": "CREATE TABLE enrollment (..., FOREIGN KEY (sid) REFERENCES student(sid))；插入不存在的 sid='9999' 被直接拒绝。",
  "schema-design": "校园库按概念模型画出学生—选课—课程，再映射为 student、course、enrollment 三张表并补全主外键。",
  "sql-select": "SELECT name, gpa FROM student WHERE gpa IS NOT NULL AND gpa >= 3.6 ORDER BY gpa DESC LIMIT 5;",
  "sql-where": "WHERE score >= 85 只保留 85 分以上的行；WHERE score = NULL 永远返回空集，应改写为 score IS NULL。",
  "sql-sort": "ORDER BY score DESC, sid ASC LIMIT 10 OFFSET 20；加上唯一键 sid 后分页结果才稳定。",
  "sql-aggregate": "SELECT course_id, COUNT(*) AS n, AVG(score) FROM enrollment GROUP BY course_id HAVING COUNT(*) >= 30;",
  "sql-multi-join": "enrollment JOIN student JOIN course 把选课链路拼齐；右表条件写在 WHERE 会把 LEFT JOIN 退化成 INNER JOIN。",
  "sql-subquery": "WHERE score > (SELECT AVG(score) FROM enrollment) 用标量子查询先算出全局平均分。",
  "sql-correlated": "WHERE e.score > (SELECT AVG(e2.score) FROM enrollment e2 WHERE e2.course_id = e.course_id) 按每门课求平均。",
  "sql-set": "SELECT name FROM student WHERE major='CS' UNION SELECT name FROM student WHERE major='AI' ORDER BY name;",
  "sql-window": "RANK() OVER (PARTITION BY course_id ORDER BY score DESC) 给每门课内的成绩排名，同时保留全部明细行。",
  "sql-view-cte": "WITH course_avg AS (SELECT course_id, AVG(score) avg_score FROM enrollment GROUP BY course_id) SELECT c.title, ca.avg_score FROM course_avg ca JOIN course c ON c.id = ca.course_id;",
  "sql-injection": "' OR '1'='1 拼进 WHERE name = '{input}' 后条件恒真，整表被读出；改用参数占位符后输入只被当作值处理。",
  "sql-execution-order": "SELECT 中定义的别名 avg_score 可用于 ORDER BY，但不能直接写在 WHERE；HAVING 才能引用聚合结果。",
  "fd-basics": "R(sid, name, dept) 中 sid→name、sid→dept；由自反与传递可知 sid→{name, dept}。",
  "closure-keys": "R(A,B,C,D)，A→B、B→C、C→D：A+ = ABCD，A 是候选键；AB 虽能决定全属性但不是最小集。",
  "nf-1-2": "enrollment(sid, cid, score) 主键 (sid,cid)；若把 student_name 放进该表，它只依赖 sid，违反 2NF。",
  "nf-3bc": "R(A,B,C)，A→B、B→C：B→C 使 C 传递依赖候选键 A，违反 3NF；分解为 R1(A,B)、R2(B,C)。",
  "redundancy-fd": "把 dept_name、dean_name 写进每条学生记录：换系主任要改多行，删掉最后一名学生则丢失系信息。",
  "lossless-decomposition": "R(A,B,C) 分解为 R1(A,B)、R2(A,C)，公共属性 A 是 R1 的键，因此自然连接可无损恢复。",
  "dependency-preserve": "R(A,B,C) 上 A→B、B→C 分解为 R1(A,B)、R2(B,C)，两个投影依赖覆盖原依赖集，保持依赖。",
  "nf-4": "course_teacher_textbook(course, teacher, textbook) 中 course→→teacher、course→→textbook，应拆成两张表才满足 4NF。",
  "sql-normalization": "订单表冗余 user_name 后读路径少一次 JOIN，但必须用触发器或应用事务保证与用户表同步。",
  denormalization: "报表库把月度销售额预聚合到 summary 表，查询从秒级降到毫秒级，代价是每次写入都要刷新汇总。",
  "schema-evolution": "给大表先新增可空列 email 并双写；回填历史数据并校验后，再删除旧的 contact 字段。",
  "data-modeling": "把“学生选修课程并获得成绩”建成 enrollment(sid, cid, score)，主键 (sid,cid)，两个外键分别引用 student 与 course。",
  btree: "enrollment(course_id, score) 上的 B+ 树索引可同时服务 WHERE course_id = 101 与 ORDER BY score DESC。",
  "index-design": "索引 (major, gpa) 可服务 WHERE major=? AND gpa>=?；只查 gpa 时缺乏最左列，索引用不上。",
  optimizer: "EXPLAIN 显示 type=ALL、key=NULL、rows=1.2M：应优先补 WHERE/JOIN 列索引，而不是盲调缓冲池。",
  "slow-query": "把 WHERE DATE(created_at) = '2026-10-01' 改写为 created_at >= '2026-10-01' AND created_at < '2026-10-02' 才能命中索引。",
  "join-algorithms": "大表等值连接走 hash join；外表只有几十行且内表有索引时，嵌套循环反而更便宜。",
  "tx-acid": "A 向 B 转账 100：扣款与入账在同一事务提交，任一步失败整体 ROLLBACK，提交后宕机也不丢。",
  isolation: "REPEATABLE READ 下同一事务两次读同一行结果一致；SERIALIZABLE 用间隙锁消除幻读。",
  "lock-mvcc": "InnoDB 快照读走 MVCC 读版本链不加锁；SELECT ... FOR UPDATE 才是当前读并加行锁。",
  deadlock: "事务 T1 锁 A 等 B、T2 锁 B 等 A 形成等待环；数据库回滚其中代价较小者并报 deadlock detected。",
  recovery: "UPDATE 提交前先写 redo/undo 日志；崩溃恢复时 REDO 已提交事务、UNDO 未提交事务。",
  "distributed-tx": "跨库转账用 2PC：协调者先让两个库 prepare，全部就绪后再 commit；协调者宕机会阻塞参与者。",
};

const NODE_PITFALLS: Record<string, string> = {
  "course-basics": "把数据库当成“一个存表的地方”，忽略约束与事务，后续范式、索引与并发问题都会反复出现。",
  relations: "在一个单元格里存“C01,C02,C03”违反 1NF 原子性，后续查询、索引与约束都会失效。",
  "keys-integrity": "只检查主键唯一而忽略外键引用，会插入不存在的学生选课记录，形成孤儿记录。",
  "entity-relationship": "把 M:N 联系硬塞进一张表，同一选课事实重复存储，违反范式并产生更新异常。",
  "relational-algebra": "忘记投影的集合语义会去重，误以为 π 等价于 SELECT 选列。",
  "select-project": "投影时丢掉后续连接需要的键，导致连接条件无从写起。",
  "join-cartesian": "漏写 ON 条件产生笛卡尔积，行数按 |R|×|S| 爆炸；外连接把右表条件写进 WHERE 会退化成内连接。",
  "set-operations": "对目不同或域不兼容的两个关系做并运算，SQL 会直接报列数或类型不匹配。",
  "integrity-constraints": "外键列允许 NULL 时参照完整性会放行 NULL；业务上的“必填”还需要 NOT NULL 兜底。",
  "schema-design": "只按范式机械拆表而不看查询路径，最终需要大量 JOIN，读性能反而下降。",
  "sql-select": "用 gpa = NULL 判断空值永远不成立（NULL 比较返回 UNKNOWN）；SELECT 别名也不能出现在 WHERE。",
  "sql-where": "NOT IN 的子查询含 NULL 时整体可能返回 UNKNOWN，导致查不到任何行。",
  "sql-sort": "分页只按非唯一列排序，翻页时可能出现重复行或漏行。",
  "sql-aggregate": "把非聚合列放进 SELECT 却不写进 GROUP BY，标准 SQL 会报错或返回不确定值。",
  "sql-multi-join": "多对多连接会放大结果集，统计人数时必须 COUNT(DISTINCT sid)。",
  "sql-subquery": "标量子查询返回多行会直接报错；IN 子查询含 NULL 时 NOT IN 语义容易踩坑。",
  "sql-correlated": "关联条件写错会导致结果放大，应结合 EXPLAIN 的 rows 估算核对。",
  "sql-set": "UNION 会自动去重并排序，开销高于 UNION ALL；不需要去重时误用 UNION 会拖慢查询。",
  "sql-window": "把窗口函数直接写进 WHERE 会报错，需要先用子查询或 CTE 算出窗口列再过滤。",
  "sql-view-cte": "把视图误认为物化表，更新基表后期待视图有独立副本；CTE 也可能被优化器内联。",
  "sql-injection": "用字符串拼接用户输入，即使做了转义也可能被编码绕过；参数化才是根本解法。",
  "sql-execution-order": "在 WHERE 中引用 SELECT 别名会报错，因为 WHERE 先于 SELECT 执行。",
  "fd-basics": "只看单属性依赖，忽略组合属性决定关系，导致闭包推导不完整。",
  "closure-keys": "只试单属性或双属性组合，忽略三属性候选键；把超键直接当成候选键。",
  "nf-1-2": "组合键关系中非主属性只依赖键的一部分，却仍按 2NF 处理，冗余无法消除。",
  "nf-3bc": "只背 3NF/BCNF 定义而不会用属性闭包找候选键，遇到综合题无法判断决定因素。",
  "redundancy-fd": "把冗余只当成“占空间”，忽略插入、删除、更新异常与数据不一致。",
  "lossless-decomposition": "只验证无损而忽略保持依赖，分解后约束无法在单表内检查。",
  "dependency-preserve": "BCNF 分解可能丢失依赖，需要用 3NF 合成法或额外断言补回。",
  "nf-4": "用函数依赖代替多值依赖做判断，导致 4NF 违规被漏检。",
  "sql-normalization": "未测量就反规范化，或反规范化后没有同步机制，造成数据漂移。",
  denormalization: "冗余列没有触发器或事务保证同步，读到的汇总值会与明细不一致。",
  "schema-evolution": "直接 ALTER 大表改列类型或加非空默认值，可能长时间锁表并阻塞线上写入。",
  "data-modeling": "只画实体不写基数与参与约束，转关系模式时会漏掉 M:N 关联表。",
  btree: "给低选择性列单独建索引，或用函数包裹索引列，导致索引无法命中。",
  "index-design": "复合索引把低选择性列放最左，或查询只用到第二列，索引整体失效。",
  optimizer: "只看 cost 数字不看 type/key/rows，或统计信息过期导致计划与实际数据分布不符。",
  "slow-query": "在索引列上套函数、隐式类型转换或 SELECT *，都会让索引失效或增加回表。",
  "join-algorithms": "在等值大表连接上强行走嵌套循环，或在没有索引的内表上做 NLJ，代价会随行数爆炸。",
  "tx-acid": "把隔离性理解成完全串行；隔离级别允许不同并发异常，需要在正确性与吞吐间取舍。",
  isolation: "认为 REPEATABLE READ 能消除幻读；标准下幻读需 SERIALIZABLE，MySQL 的间隙锁只是实现补偿。",
  "lock-mvcc": "以为 MVCC 完全不加锁；写写冲突、当前读与唯一键检查仍然需要锁。",
  deadlock: "以为死锁只靠超时解决；固定加锁顺序与缩短事务才是降低概率的根本手段。",
  recovery: "以为提交就一定落盘；没有 fsync 的日志在断电时仍可能丢失已提交事务。",
  "distributed-tx": "把 2PC 当成高可用方案；协调者宕机会长时间阻塞，必须配合超时、补偿与幂等。",
};

export function factsForNode(node: TopologyNode): readonly string[] {
  return NODE_FACTS[node.id] ?? [
    summaryForNode(node),
    exampleForNode(node),
    pitfallForNode(node),
  ];
}

export function essenceForNode(node: TopologyNode): string {
  return NODE_ESSENCE[node.id] ?? NODE_FACTS[node.id]?.[0] ?? node.flashcard.essence;
}

export function summaryForNode(node: TopologyNode): string {
  return NODE_FACTS[node.id]?.[0] ?? NODE_ESSENCE[node.id] ?? node.summary;
}

export function definitionForNode(node: TopologyNode): string {
  return NODE_FACTS[node.id]?.[0] ?? NODE_ESSENCE[node.id] ?? node.summary;
}

/** The real three-column teaching block: definition → verified example → counterexample. */
export function conceptColumnsForNode(node: TopologyNode): { definition: string; example: string; pitfall: string } {
  return {
    definition: definitionForNode(node),
    example: exampleForNode(node),
    pitfall: pitfallForNode(node),
  };
}

export function quizForNode(node: TopologyNode): LearningQuiz {
  return NODE_QUIZ[node.id] ?? CHAPTER_QUIZ[node.chapterKey] ?? {
    question: `「${node.title}」在${node.chapterLabel}中的核心判定依据是什么？`,
    options: ["依据具体关系模式、约束或执行计划判断", "只背术语名称", "跳过约束检查", "只看示例结果的第一行"],
    correct: 0,
    explanation: `判断${node.title}必须落到真实模式、约束或执行行为上，并用一个反例检查边界。`,
    tag: node.chapterLabel,
  };
}

export function flashcardsForNode(node: TopologyNode): FlashcardDeckItem[] {
  const facts = factsForNode(node);
  const quiz = quizForNode(node);
  const labels = ["核心结论", "关键边界", "实战要点"];
  const fronts = NODE_CARD_FRONTS[node.id];
  return [
    ...facts.slice(0, 3).map((fact, index) => ({
      kind: labels[index]!,
      front: fronts?.[index] ?? labels[index]!,
      back: fact,
      hint: "先复述事实，再用一个反例检查边界",
    })),
    {
      kind: "随堂快测",
      front: quiz.question,
      back: `✓ ${quiz.options[quiz.correct]}\n${quiz.explanation}`,
      hint: "先作答，再看解释",
    },
  ];
}

export function quizzesForNode(node: TopologyNode): LearningQuiz[] {
  return [quizForNode(node)];
}

export function takeawaysForNode(node: TopologyNode): string[] {
  return [...factsForNode(node).slice(0, 3)];
}

export function exampleForNode(node: TopologyNode): string {
  return NODE_EXAMPLES[node.id] ?? node.flashcard.example;
}

export function pitfallForNode(node: TopologyNode): string {
  return NODE_PITFALLS[node.id] ?? node.flashcard.pitfall;
}

const FOREIGN_KEY_SQL = [
  "CREATE TABLE student (",
  "  sid CHAR(8) PRIMARY KEY,",
  "  name VARCHAR(20) NOT NULL",
  ");",
  "",
  "CREATE TABLE enrollment (",
  "  sid CHAR(8),",
  "  cid CHAR(8),",
  "  FOREIGN KEY (sid) REFERENCES student(sid)",
  ");",
  "",
  "-- student 表中不存在 9999",
  "INSERT INTO enrollment (sid, cid) VALUES ('9999', 'C01');",
  "-- 结果: FOREIGN KEY constraint failed",
].join("\n");

export function sqlExampleForTutor(node: TopologyNode, question: string): string {
  if (node.id === "keys-integrity" || /外键|孤儿|FOREIGN/i.test(question)) return FOREIGN_KEY_SQL;
  if (node.chapterKey === "design" || /3NF|BCNF|范式|闭包/i.test(question)) {
    return [
      "-- 反例：把系名/系主任与学生的每个选课事实混在一起",
      "CREATE TABLE student_bad (",
      "  sid CHAR(8), cid CHAR(8), dept_name VARCHAR(30), dean_name VARCHAR(20),",
      "  PRIMARY KEY (sid, cid)",
      ");",
      "",
      "-- 规范化拆分：学生、系、选课各自表达自己的事实",
      "CREATE TABLE student (sid CHAR(8) PRIMARY KEY, dept_id CHAR(4));",
      "CREATE TABLE department (dept_id CHAR(4) PRIMARY KEY, dept_name VARCHAR(30), dean_name VARCHAR(20));",
      "CREATE TABLE enrollment (sid CHAR(8), cid CHAR(8), PRIMARY KEY (sid, cid));",
    ].join("\n");
  }
  if (node.id === "tx-acid" || /事务|ACID|隔离|锁/i.test(question)) {
    return [
      "BEGIN;",
      "UPDATE account SET balance = balance - 100 WHERE id = 'A';",
      "UPDATE account SET balance = balance + 100 WHERE id = 'B';",
      "COMMIT;",
      "-- 任一步失败则 ROLLBACK，保证原子性",
    ].join("\n");
  }
  return sqlLessonForNode(node).sql;
}

export function sqlLessonForNode(node: TopologyNode): SqlLesson {
  const defaultSql = [
    "SELECT s.name, s.major, e.score",
    "FROM enrollment e",
    "JOIN student s ON s.id = e.student_id",
    "WHERE e.score IS NOT NULL",
    "ORDER BY e.score DESC",
    "LIMIT 8",
  ].join("\n");
  const joinsSql = [
    "SELECT s.name, c.title, t.name AS teacher, e.score",
    "FROM enrollment e",
    "JOIN student s ON s.id = e.student_id",
    "JOIN course c ON c.id = e.course_id",
    "JOIN teacher t ON t.id = e.teacher_id",
    "ORDER BY e.score DESC",
    "LIMIT 8",
  ].join("\n");
  const byId: Record<string, SqlLesson> = {
    "sql-select": { title: "SELECT / WHERE / ORDER BY / NULL", sql: defaultSql, note: "观察 WHERE 如何先过滤、ORDER BY 如何排序；NULL 不参与普通大小比较。" },
    "sql-where": { title: "WHERE 过滤与 NULL 语义", sql: defaultSql, note: "把 WHERE 换成 e.score >= 85 或 e.score IS NULL，观察结果集如何变化。" },
    "sql-sort": { title: "排序、分页与稳定顺序", sql: defaultSql, note: "ORDER BY 可叠加多个字段；LIMIT 与 OFFSET 控制分页。" },
    "sql-aggregate": {
      title: "分组聚合：GROUP BY + HAVING",
      sql: ["SELECT c.title, COUNT(*) AS enrollments, ROUND(AVG(e.score), 1) AS avg_score", "FROM enrollment e", "JOIN course c ON c.id = e.course_id", "GROUP BY c.title", "ORDER BY avg_score DESC"].join("\n"),
      note: "WHERE 在分组前过滤，HAVING 在分组后过滤；这是 SQL 执行顺序的核心分界。",
    },
    "sql-multi-join": { title: "多表连接：把选课链路拼完整", sql: joinsSql, note: "连接顺序与连接条件决定结果集基数；用 ON 明确关系，不要依赖隐式笛卡尔积。" },
    "sql-subquery": {
      title: "子查询：高于平均分的选课",
      sql: ["SELECT s.name, e.score", "FROM enrollment e", "JOIN student s ON s.id = e.student_id", "WHERE e.score > (SELECT AVG(score) FROM enrollment)", "ORDER BY e.score DESC", "LIMIT 8"].join("\n"),
      note: "标量子查询返回单值；先算出基准，再在外层过滤。",
    },
    "sql-correlated": {
      title: "相关子查询：逐行引用外层",
      sql: ["SELECT s.name, e.score", "FROM enrollment e", "JOIN student s ON s.id = e.student_id", "WHERE e.score > (SELECT AVG(e2.score) FROM enrollment e2 WHERE e2.course_id = e.course_id)", "ORDER BY e.score DESC", "LIMIT 8"].join("\n"),
      note: "子查询引用外层 e.course_id，因此按每门课程计算平均分。",
    },
    "sql-set": { title: "集合运算：UNION 去重合并", sql: ["SELECT name FROM student WHERE major = '计算机科学'", "UNION", "SELECT name FROM student WHERE major = '人工智能'", "ORDER BY name"].join("\n"), note: "UNION 去重，UNION ALL 保留重复；两边列数和类型必须兼容。" },
    "sql-window": {
      title: "窗口函数：课程内排名",
      sql: ["SELECT s.name, e.course_id, e.score,", "  RANK() OVER (PARTITION BY e.course_id ORDER BY e.score DESC) AS rank_in_course", "FROM enrollment e", "JOIN student s ON s.id = e.student_id", "ORDER BY e.course_id, rank_in_course", "LIMIT 12"].join("\n"),
      note: "窗口函数保留每一行，不折叠分组；PARTITION BY 定义窗口边界。",
    },
    "sql-view-cte": {
      title: "CTE：先把中间结果说清楚",
      sql: ["WITH course_avg AS (", "  SELECT course_id, AVG(score) AS avg_score", "  FROM enrollment GROUP BY course_id", ")", "SELECT c.title, ROUND(ca.avg_score, 1) AS avg_score", "FROM course_avg ca", "JOIN course c ON c.id = ca.course_id", "ORDER BY avg_score DESC"].join("\n"),
      note: "CTE 让复杂查询分步可读；它不会自动物化，优化器仍可内联。",
    },
    "sql-injection": { title: "注入示例：字符串拼接的风险", sql: "SELECT id, name, major FROM student WHERE name = '林晓' OR '1' = '1' ORDER BY id", note: "这不是安全的查询写法；真实应用必须使用参数化查询阻断注入。" },
    "sql-execution-order": { title: "执行顺序：GROUP BY 与 HAVING", sql: ["SELECT c.department, COUNT(*) AS course_count", "FROM course c", "GROUP BY c.department", "HAVING COUNT(*) >= 1", "ORDER BY course_count DESC"].join("\n"), note: "逻辑顺序：FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT。" },
    "index-design": { title: "索引选择性：专业 + GPA 过滤", sql: ["SELECT name, major, gpa", "FROM student", "WHERE major = '计算机科学' AND gpa >= 3.6", "ORDER BY gpa DESC", "LIMIT 8"].join("\n"), note: "复合索引 (major, gpa) 可服务这个过滤与排序；只查 gpa 时用不上最左前缀。" },
    optimizer: { title: "EXPLAIN 前的真实查询", sql: ["SELECT name, major, gpa", "FROM student", "WHERE gpa >= 3.6", "ORDER BY gpa DESC", "LIMIT 8"].join("\n"), note: "先运行查询，再用 EXPLAIN QUERY PLAN 查看扫描方式、索引与排序代价。" },
    "tx-acid": { title: "事务读写观察：成绩与学期", sql: ["SELECT s.name, e.course_id, e.score, e.term", "FROM enrollment e", "JOIN student s ON s.id = e.student_id", "ORDER BY e.term, e.course_id", "LIMIT 10"].join("\n"), note: "事务把一组读写绑定为原子边界；提交后结果必须持久，失败则整体回滚。" },
    isolation: { title: "并发读观察：同一课程的成绩快照", sql: "SELECT course_id, student_id, score FROM enrollment ORDER BY course_id, score DESC LIMIT 10", note: "隔离级别决定并发读写时看到哪个快照，以及是否出现不可重复读或幻读。" },
    "lock-mvcc": { title: "多版本读取的观察视角", sql: "SELECT student_id, course_id, score FROM enrollment ORDER BY course_id, score DESC LIMIT 10", note: "MVCC 让读操作看到一致性快照，减少读写阻塞；写冲突仍需锁或冲突检测。" },
    deadlock: { title: "锁顺序与冲突观察", sql: "SELECT student_id, course_id, score FROM enrollment ORDER BY student_id, course_id LIMIT 10", note: "固定加锁顺序可以降低死锁概率；检测到环后数据库会回滚其中一个事务。" },
  };
  const lesson = byId[node.id];
  if (lesson) return lesson;
  if (node.chapterKey === "design") return { title: "规范化数据观察", sql: ["SELECT major, COUNT(*) AS student_count", "FROM student", "GROUP BY major", "ORDER BY student_count DESC"].join("\n"), note: "同一专业对应多名学生；非键属性的重复就是冗余信号。" };
  if (node.chapterKey === "storage") return { title: "存储与查询观察", sql: ["SELECT name, major, gpa", "FROM student", "WHERE gpa >= 3.5", "ORDER BY gpa DESC", "LIMIT 8"].join("\n"), note: "结果来自 8 表校园沙箱，可直接执行；修改字段后点击运行即可验证。" };
  return { title: "关系模型真实数据", sql: "SELECT id, name, major FROM student ORDER BY id LIMIT 8", note: "用真实行与列观察关系、元组、属性、域的对应关系。" };
}
