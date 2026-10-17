import type { SqlExercise } from "@zhijing/shared";

export const coreExercises: SqlExercise[] = [
  // 1. 基础单表查询 (Level 1)
  {
    id: "ex-01-select-all-students",
    title: "查询计算机科学专业所有学生",
    difficulty: 1,
    category: "基础查询",
    description: "从 student 表中筛选出专业为'计算机科学'的学生姓名和GPA，按GPA降序排列。",
    schemaHint: "student(id, name, major, grade, gpa)",
    skeletonSql: "SELECT name, gpa\nFROM student\nWHERE major = '___'\nORDER BY ___ DESC",
    standardSql: "SELECT name, gpa FROM student WHERE major = '计算机科学' ORDER BY gpa DESC",
    targetNodeId: "sql-select",
  },
  {
    id: "ex-02-high-credit-courses",
    title: "筛选高学分核心课程",
    difficulty: 1,
    category: "基础查询",
    description: "查询 course 表中学分大于等于4分的所有课程名称与开设学院。",
    schemaHint: "course(id, title, credits, department)",
    skeletonSql: "SELECT title, department\nFROM course\nWHERE credits >= ___",
    standardSql: "SELECT title, department FROM course WHERE credits >= 4",
    targetNodeId: "sql-select",
  },
  {
    id: "ex-03-professors-list",
    title: "检索学院正教授名单",
    difficulty: 1,
    category: "基础查询",
    description: "查询 teacher 表中职称包含'教授'且院系为'计算机学院'的教师姓名。",
    schemaHint: "teacher(id, name, title, department)",
    skeletonSql: "SELECT name, title\nFROM teacher\nWHERE department = '计算机学院' AND title LIKE '%___%'",
    standardSql: "SELECT name, title FROM teacher WHERE department = '计算机学院' AND title LIKE '%教授%'",
    targetNodeId: "sql-select",
  },
  {
    id: "ex-04-products-under-budget",
    title: "查找百元以内数码与教材",
    difficulty: 1,
    category: "基础查询",
    description: "在 product 表中查询单价小于100元且库存大于30的商品名称、价格与库存。",
    schemaHint: "product(id, name, category_id, price, stock)",
    skeletonSql: "SELECT name, price, stock\nFROM product\nWHERE price < 100 AND stock > ___",
    standardSql: "SELECT name, price, stock FROM product WHERE price < 100 AND stock > 30",
    targetNodeId: "sql-select",
  },

  // 2. 多表连接 (Level 2~3)
  {
    id: "ex-05-student-course-join",
    title: "学生选课成绩三表联查",
    difficulty: 2,
    category: "多表JOIN",
    description: "联结 student、enrollment 和 course 三张表，查询选修了'数据库原理'的学生姓名和具体分数。",
    schemaHint: "student(id, name) JOIN enrollment(student_id, course_id, score) JOIN course(id, title)",
    skeletonSql: "SELECT s.name, c.title, e.score\nFROM enrollment e\nJOIN student s ON s.id = e.___\nJOIN course c ON c.id = e.___\nWHERE c.title = '数据库原理'\nORDER BY e.score DESC",
    standardSql: "SELECT s.name, c.title, e.score FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id WHERE c.title = '数据库原理' ORDER BY e.score DESC",
    targetNodeId: "sql-joins",
  },
  {
    id: "ex-06-teacher-course-join",
    title: "授课教师与选课学生名录",
    difficulty: 2,
    category: "多表JOIN",
    description: "查询由'张教授'指导的所有选课记录，输出学生姓名、课程名及成绩。",
    schemaHint: "teacher(id, name) JOIN enrollment(teacher_id, student_id, course_id) JOIN student, course",
    skeletonSql: "SELECT s.name AS student_name, c.title AS course_title, t.name AS teacher_name, e.score\nFROM enrollment e\nJOIN teacher t ON t.id = e.___\nJOIN student s ON s.id = e.student_id\nJOIN course c ON c.id = e.course_id\nWHERE t.name = '张教授'",
    standardSql: "SELECT s.name AS student_name, c.title AS course_title, t.name AS teacher_name, e.score FROM enrollment e JOIN teacher t ON t.id = e.teacher_id JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id WHERE t.name = '张教授'",
    targetNodeId: "sql-joins",
  },
  {
    id: "ex-07-order-product-join",
    title: "商城订单与商品详情穿透",
    difficulty: 2,
    category: "多表JOIN",
    description: "查询订单 1001 的明细，输出购买学生姓名、购买商品名、购买数量与小计金额(quantity * unit_price)。",
    schemaHint: "orders(id, student_id) JOIN order_item(order_id, product_id, quantity, unit_price) JOIN product(id, name) JOIN student(id, name)",
    skeletonSql: "SELECT s.name, p.name AS product_name, oi.quantity, (oi.quantity * oi.unit_price) AS subtotal\nFROM orders o\nJOIN student s ON s.id = o.student_id\nJOIN order_item oi ON oi.order_id = o.id\nJOIN product p ON p.id = oi.product_id\nWHERE o.id = 1001",
    standardSql: "SELECT s.name, p.name AS product_name, oi.quantity, (oi.quantity * oi.unit_price) AS subtotal FROM orders o JOIN student s ON s.id = o.student_id JOIN order_item oi ON oi.order_id = o.id JOIN product p ON p.id = oi.product_id WHERE o.id = 1001",
    targetNodeId: "sql-joins",
  },
  {
    id: "ex-08-four-table-student-orders",
    title: "四表跨域：学生选课与图书购买",
    difficulty: 3,
    category: "多表JOIN",
    description: "查询购买了'教材书籍'类别商品的学生姓名、所买图书名称及其在'数据库原理'课程中的成绩。",
    schemaHint: "student s -> orders o -> order_item oi -> product p -> category cat; enrollment e -> course c",
    skeletonSql: "SELECT DISTINCT s.name AS student_name, p.name AS book_name, e.score AS db_score\nFROM student s\nJOIN orders o ON o.student_id = s.id\nJOIN order_item oi ON oi.order_id = o.id\nJOIN product p ON p.id = oi.product_id\nJOIN category cat ON cat.id = p.category_id\nJOIN enrollment e ON e.student_id = s.id AND e.course_id = 101\nWHERE cat.name = '教材书籍'",
    standardSql: "SELECT DISTINCT s.name AS student_name, p.name AS book_name, e.score AS db_score FROM student s JOIN orders o ON o.student_id = s.id JOIN order_item oi ON oi.order_id = o.id JOIN product p ON p.id = oi.product_id JOIN category cat ON cat.id = p.category_id JOIN enrollment e ON e.student_id = s.id AND e.course_id = 101 WHERE cat.name = '教材书籍'",
    targetNodeId: "sql-joins",
  },

  // 3. 分组与聚合 (Level 2~3)
  {
    id: "ex-09-course-avg-score",
    title: "各课程平均成绩与选课人次",
    difficulty: 2,
    category: "分组聚合",
    description: "统计每门课程的选课人数、最高分与平均分（保留1位小数），按平均分降序排列。",
    schemaHint: "enrollment(course_id, score) JOIN course(id, title)",
    skeletonSql: "SELECT c.title, COUNT(e.student_id) AS student_count, MAX(e.score) AS max_score, ROUND(AVG(e.score), 1) AS avg_score\nFROM course c\nJOIN enrollment e ON e.course_id = c.id\nGROUP BY c.id, ___\nORDER BY avg_score DESC",
    standardSql: "SELECT c.title, COUNT(e.student_id) AS student_count, MAX(e.score) AS max_score, ROUND(AVG(e.score), 1) AS avg_score FROM course c JOIN enrollment e ON e.course_id = c.id GROUP BY c.id, c.title ORDER BY avg_score DESC",
    targetNodeId: "sql-aggregate",
  },
  {
    id: "ex-10-major-spending-having",
    title: "各专业消费总额与高频过滤",
    difficulty: 3,
    category: "分组聚合",
    description: "统计各个专业的学生商城消费总额，且只显示累计消费超过200元的专业。",
    schemaHint: "student(id, major) JOIN orders(student_id, total_amount)",
    skeletonSql: "SELECT s.major, SUM(o.total_amount) AS total_spent\nFROM student s\nJOIN orders o ON o.student_id = s.id\nGROUP BY s.___\nHAVING SUM(o.total_amount) > ___",
    standardSql: "SELECT s.major, SUM(o.total_amount) AS total_spent FROM student s JOIN orders o ON o.student_id = s.id GROUP BY s.major HAVING SUM(o.total_amount) > 200",
    targetNodeId: "sql-aggregate",
  },
  {
    id: "ex-11-teacher-teaching-load",
    title: "教师指导人次与均分评估",
    difficulty: 3,
    category: "分组聚合",
    description: "统计每位教师指导的学生总人次以及所带学生的平均成绩，按指导人数降序排列。",
    schemaHint: "teacher(id, name, department) JOIN enrollment(teacher_id, score)",
    skeletonSql: "SELECT t.name, t.department, COUNT(e.student_id) AS student_count, ROUND(AVG(e.score), 1) AS avg_score\nFROM teacher t\nJOIN enrollment e ON e.teacher_id = t.id\nGROUP BY t.id, t.name, t.department\nORDER BY student_count DESC",
    standardSql: "SELECT t.name, t.department, COUNT(e.student_id) AS student_count, ROUND(AVG(e.score), 1) AS avg_score FROM teacher t JOIN enrollment e ON e.teacher_id = t.id GROUP BY t.id, t.name, t.department ORDER BY student_count DESC",
    targetNodeId: "sql-aggregate",
  },

  // 4. 子查询 (Level 3~4)
  {
    id: "ex-12-above-avg-students",
    title: "找出高于数据库原理均分的尖子生",
    difficulty: 3,
    category: "子查询",
    description: "使用子查询计算'数据库原理'课程的平均成绩，并查询所有得分高于该平均分的学生姓名与具体分数。",
    schemaHint: "enrollment(student_id, course_id, score), course(id, title)",
    skeletonSql: "SELECT s.name, e.score\nFROM enrollment e\nJOIN student s ON s.id = e.student_id\nWHERE e.course_id = 101 AND e.score > (\n  SELECT AVG(score) FROM enrollment WHERE course_id = 101\n)",
    standardSql: "SELECT s.name, e.score FROM enrollment e JOIN student s ON s.id = e.student_id WHERE e.course_id = 101 AND e.score > (SELECT AVG(score) FROM enrollment WHERE course_id = 101)",
    targetNodeId: "sql-joins",
  },
  {
    id: "ex-13-buyers-without-ai-course",
    title: "购买了AI算力卡但未选修AI导论",
    difficulty: 4,
    category: "子查询",
    description: "找出在商城购买过'GPU云训练时长卡(100小时)'，但尚未选修'人工智能导论' (course_id=102) 的学生姓名。",
    schemaHint: "orders -> order_item -> product; NOT EXISTS enrollment",
    skeletonSql: "SELECT s.name\nFROM student s\nWHERE s.id IN (\n  SELECT o.student_id FROM orders o\n  JOIN order_item oi ON oi.order_id = o.id\n  JOIN product p ON p.id = oi.product_id\n  WHERE p.name LIKE '%GPU%'\n)\nAND NOT EXISTS (\n  SELECT 1 FROM enrollment e WHERE e.student_id = s.id AND e.course_id = 102\n)",
    standardSql: "SELECT s.name FROM student s WHERE s.id IN (SELECT o.student_id FROM orders o JOIN order_item oi ON oi.order_id = o.id JOIN product p ON p.id = oi.product_id WHERE p.name LIKE '%GPU%') AND NOT EXISTS (SELECT 1 FROM enrollment e WHERE e.student_id = s.id AND e.course_id = 102)",
    targetNodeId: "sql-joins",
  },

  // 5. 窗口函数与高级分析 (Level 4~5)
  {
    id: "ex-14-window-rank-course",
    title: "窗口函数：各课程内成绩排名 (DENSE_RANK)",
    difficulty: 4,
    category: "窗口函数",
    description: "使用 DENSE_RANK() 窗口函数，按课程分组 (PARTITION BY) 对所有学生的成绩进行组内降序排名。",
    schemaHint: "enrollment(student_id, course_id, score) JOIN student, course",
    skeletonSql: "SELECT c.title AS course_title, s.name AS student_name, e.score,\n  DENSE_RANK() OVER (PARTITION BY e.___ ORDER BY e.score DESC) AS rank_in_course\nFROM enrollment e\nJOIN student s ON s.id = e.student_id\nJOIN course c ON c.id = e.course_id\nORDER BY c.id, rank_in_course",
    standardSql: "SELECT c.title AS course_title, s.name AS student_name, e.score, DENSE_RANK() OVER (PARTITION BY e.course_id ORDER BY e.score DESC) AS rank_in_course FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id ORDER BY c.id, rank_in_course",
    targetNodeId: "sql-advanced",
  },
  {
    id: "ex-15-window-order-cumulative",
    title: "累计消费演进：窗口滚动求和",
    difficulty: 4,
    category: "窗口函数",
    description: "使用 SUM(total_amount) OVER (PARTITION BY ... ORDER BY order_date) 观察学生按日期的累计消费金额变化。",
    schemaHint: "orders(student_id, order_date, total_amount) JOIN student",
    skeletonSql: "SELECT s.name, o.id AS order_id, o.order_date, o.total_amount,\n  SUM(o.total_amount) OVER (PARTITION BY o.student_id ORDER BY o.order_date) AS running_total\nFROM orders o\nJOIN student s ON s.id = o.student_id\nORDER BY s.id, o.order_date",
    standardSql: "SELECT s.name, o.id AS order_id, o.order_date, o.total_amount, SUM(o.total_amount) OVER (PARTITION BY o.student_id ORDER BY o.order_date) AS running_total FROM orders o JOIN student s ON s.id = o.student_id ORDER BY s.id, o.order_date",
    targetNodeId: "sql-advanced",
  },
  {
    id: "ex-16-window-top-student-per-course",
    title: "ROW_NUMBER 提取每门课程榜首",
    difficulty: 5,
    category: "窗口函数",
    description: "借助 CTE 和 ROW_NUMBER() 窗口函数，精准提取每门课程考试成绩第一名的学生与分数。",
    schemaHint: "WITH ranked AS (SELECT ..., ROW_NUMBER() OVER (...) as rn) SELECT ... WHERE rn = 1",
    skeletonSql: "WITH ranked_scores AS (\n  SELECT c.title AS course_title, s.name AS student_name, e.score,\n    ROW_NUMBER() OVER (PARTITION BY e.course_id ORDER BY e.score DESC) AS rn\n  FROM enrollment e\n  JOIN student s ON s.id = e.student_id\n  JOIN course c ON c.id = e.course_id\n)\nSELECT course_title, student_name, score\nFROM ranked_scores\nWHERE rn = 1",
    standardSql: "WITH ranked_scores AS (SELECT c.title AS course_title, s.name AS student_name, e.score, ROW_NUMBER() OVER (PARTITION BY e.course_id ORDER BY e.score DESC) AS rn FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id) SELECT course_title, student_name, score FROM ranked_scores WHERE rn = 1",
    targetNodeId: "sql-advanced",
  },
  // 6. 更多八表实战精选题 (17~35)
  {
    id: "ex-17-multi-table-full-audit",
    title: "八表链路穿透：从教师到学生消费全链路审计",
    difficulty: 5,
    category: "多表JOIN",
    description: "查询由张教授指导、选修数据库原理、且在商城购买过图书的学生清单与所购书籍。",
    schemaHint: "teacher -> enrollment -> student -> orders -> order_item -> product -> category",
    skeletonSql: "SELECT DISTINCT s.name AS student_name, p.name AS book_name, e.score\nFROM teacher t\nJOIN enrollment e ON e.teacher_id = t.id\nJOIN student s ON s.id = e.student_id\nJOIN orders o ON o.student_id = s.id\nJOIN order_item oi ON oi.order_id = o.id\nJOIN product p ON p.id = oi.product_id\nWHERE t.name = '张教授' AND e.course_id = 101\nORDER BY e.score DESC",
    standardSql: "SELECT DISTINCT s.name AS student_name, p.name AS book_name, e.score FROM teacher t JOIN enrollment e ON e.teacher_id = t.id JOIN student s ON s.id = e.student_id JOIN orders o ON o.student_id = s.id JOIN order_item oi ON oi.order_id = o.id JOIN product p ON p.id = oi.product_id WHERE t.name = '张教授' AND e.course_id = 101 ORDER BY e.score DESC",
    targetNodeId: "sql-joins",
  },
  {
    id: "ex-18-stock-alert-products",
    title: "低库存数码商品补货预警",
    difficulty: 2,
    category: "基础查询",
    description: "查询 product 表中属于数码文具分类（category_id = 1）且库存低于30的商品。",
    schemaHint: "product(name, category_id, stock, price)",
    skeletonSql: "SELECT name, price, stock\nFROM product\nWHERE category_id = 1 AND stock < 30",
    standardSql: "SELECT name, price, stock FROM product WHERE category_id = 1 AND stock < 30",
    targetNodeId: "sql-select",
  },
  {
    id: "ex-19-order-status-summary",
    title: "订单状态分布统计",
    difficulty: 2,
    category: "分组聚合",
    description: "统计各状态（completed / pending）的订单数量与成交总金额。",
    schemaHint: "orders(status, total_amount)",
    skeletonSql: "SELECT status, COUNT(*) AS order_count, SUM(total_amount) AS total_sum\nFROM orders\nGROUP BY status",
    standardSql: "SELECT status, COUNT(*) AS order_count, SUM(total_amount) AS total_sum FROM orders GROUP BY status",
    targetNodeId: "sql-aggregate",
  },
  {
    id: "ex-20-credit-accumulated-students",
    title: "学生已获总学分统计（成绩及格>=60）",
    difficulty: 3,
    category: "分组聚合",
    description: "统计每位学生通过考试（成绩>=60）所获得的累积总学分，按学分降序排列。",
    schemaHint: "student s JOIN enrollment e ON s.id = e.student_id JOIN course c ON c.id = e.course_id",
    skeletonSql: "SELECT s.name, SUM(c.credits) AS total_credits\nFROM student s\nJOIN enrollment e ON e.student_id = s.id\nJOIN course c ON c.id = e.course_id\nWHERE e.score >= 60\nGROUP BY s.id, s.name\nORDER BY total_credits DESC",
    standardSql: "SELECT s.name, SUM(c.credits) AS total_credits FROM student s JOIN enrollment e ON e.student_id = s.id JOIN course c ON c.id = e.course_id WHERE e.score >= 60 GROUP BY s.id, s.name ORDER BY total_credits DESC",
    targetNodeId: "sql-aggregate",
  },
];

// Procedural generator to create a 200+ comprehensive SQL exercise dataset
export function generateFullExerciseDataset(): SqlExercise[] {
  const result: SqlExercise[] = [...coreExercises];
  const departments = ["计算机学院", "人工智能学院", "软件学院", "数据科学学院"];
  const courses = [
    { id: 101, name: "数据库原理", node: "sql-select" },
    { id: 102, name: "人工智能导论", node: "sql-joins" },
    { id: 103, name: "软件工程", node: "sql-aggregate" },
    { id: 104, name: "算法与数据结构", node: "sql-advanced" },
    { id: 105, name: "分布式系统", node: "sql-advanced" },
  ];
  const thresholds = [60, 70, 75, 80, 85, 90];
  const orderSorts = ["ASC", "DESC"];

  let count = coreExercises.length;
  // Generate variations up to 210 exercises
  while (result.length < 210) {
    count++;
    const course = courses[count % courses.length]!;
    const dept = departments[count % departments.length]!;
    const threshold = thresholds[count % thresholds.length]!;
    const sort = orderSorts[count % orderSorts.length]!;
    const mod = count % 4;

    if (mod === 0) {
      result.push({
        id: `ex-gen-${count}`,
        title: `专题研习 #${count}：${dept}学生${course.name}成绩分析(阈值${threshold})`,
        difficulty: (count % 4) + 1,
        category: "多表JOIN",
        description: `从选课表中筛选出修读${course.name}且成绩在${threshold}分以上的${dept}学生姓名与学分。`,
        schemaHint: "student(id, name, major) JOIN enrollment e JOIN course c",
        skeletonSql: `SELECT s.name, e.score, c.credits FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id WHERE c.id = ${course.id} AND e.score >= ${threshold} ORDER BY e.score ${sort}`,
        standardSql: `SELECT s.name, e.score, c.credits FROM enrollment e JOIN student s ON s.id = e.student_id JOIN course c ON c.id = e.course_id WHERE c.id = ${course.id} AND e.score >= ${threshold} ORDER BY e.score ${sort}`,
        targetNodeId: course.node,
      });
    } else if (mod === 1) {
      result.push({
        id: `ex-gen-${count}`,
        title: `商城洞察 #${count}：按类别统计单价高于${threshold}元的商品`,
        difficulty: (count % 3) + 1,
        category: "分组聚合",
        description: `查询各商品分类下单价大于等于${threshold}元的商品数量及平均价格。`,
        schemaHint: "product p JOIN category c ON c.id = p.category_id",
        skeletonSql: `SELECT c.name, COUNT(*) AS cnt, AVG(p.price) AS avg_price FROM product p JOIN category c ON c.id = p.category_id WHERE p.price >= ${threshold} GROUP BY c.id, c.name`,
        standardSql: `SELECT c.name, COUNT(*) AS cnt, AVG(p.price) AS avg_price FROM product p JOIN category c ON c.id = p.category_id WHERE p.price >= ${threshold} GROUP BY c.id, c.name`,
        targetNodeId: "sql-aggregate",
      });
    } else if (mod === 2) {
      result.push({
        id: `ex-gen-${count}`,
        title: `子查询挑战 #${count}：高于${course.name}平均成绩的选课记录`,
        difficulty: (count % 3) + 2,
        category: "子查询",
        description: `找出${course.name}中成绩超过所有修读该课程学生平均成绩的选课详情。`,
        schemaHint: "enrollment WHERE course_id = ... AND score > (SELECT AVG(score)...)",
        skeletonSql: `SELECT student_id, score FROM enrollment WHERE course_id = ${course.id} AND score > (SELECT AVG(score) FROM enrollment WHERE course_id = ${course.id})`,
        standardSql: `SELECT student_id, score FROM enrollment WHERE course_id = ${course.id} AND score > (SELECT AVG(score) FROM enrollment WHERE course_id = ${course.id})`,
        targetNodeId: "sql-joins",
      });
    } else {
      result.push({
        id: `ex-gen-${count}`,
        title: `窗口进阶 #${count}：${course.name}的成绩名次分段与前置`,
        difficulty: (count % 2) + 3,
        category: "窗口函数",
        description: `运用窗口函数 RANK() OVER (ORDER BY score DESC) 评估${course.name}的成绩梯队。`,
        schemaHint: "SELECT student_id, score, RANK() OVER (ORDER BY score DESC) FROM enrollment WHERE course_id = ...",
        skeletonSql: `SELECT student_id, score, RANK() OVER (ORDER BY score DESC) AS pos FROM enrollment WHERE course_id = ${course.id}`,
        standardSql: `SELECT student_id, score, RANK() OVER (ORDER BY score DESC) AS pos FROM enrollment WHERE course_id = ${course.id}`,
        targetNodeId: "sql-advanced",
      });
    }
  }

  return result;
}

export const allExercises: SqlExercise[] = generateFullExerciseDataset();
