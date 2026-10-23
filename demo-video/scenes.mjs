import { launch, newContext, newPage, goto, record, clickLocator, hoverLocator, typeSlowly, moveTo, wheel } from './recorder.mjs';

const VIS = { visible: true };

async function S03(browser) {
  const context = await newContext(browser, { session: false });
  const page = await newPage(context);
  await goto(page, '/', 2600);
  const info = await record(page, 'S03-login', async () => {
    await moveTo(page, 780, 300);
    await page.waitForTimeout(900);
    await moveTo(page, 450, 380);
    await page.waitForTimeout(700);
    await moveTo(page, 620, 380);
    await page.waitForTimeout(700);
    await moveTo(page, 790, 380);
    await page.waitForTimeout(700);
    await clickLocator(page, page.getByText('基础补齐', { exact: true }).filter(VIS).first(), { settle: 900 });
    await moveTo(page, 1260, 760);
    await page.waitForTimeout(1400);
    await moveTo(page, 1260, 695);
    await page.waitForTimeout(900);
    await clickLocator(page, page.getByRole('button', { name: /登录并进入学习空间/ }), { settle: 3200 });
    await page.getByText('你好，基础薄弱型学生').filter(VIS).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(2800);
  }, { tail: 1400 });
  await context.close();
  return info;
}

async function S04(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/', 2600);
  const info = await record(page, 'S04-dashboard', async () => {
    await moveTo(page, 500, 190);
    await page.waitForTimeout(800);
    await moveTo(page, 500, 270);
    await page.waitForTimeout(900);
    await moveTo(page, 870, 270);
    await page.waitForTimeout(800);
    await hoverLocator(page, page.getByRole('button', { name: /Orchestrator，/ }).first(), { settle: 700 });
    await hoverLocator(page, page.getByRole('button', { name: /Profile，/ }).first(), { settle: 700 });
    await hoverLocator(page, page.getByRole('button', { name: /Diagnosis，/ }).first(), { settle: 800 });
    await hoverLocator(page, page.getByRole('button', { name: /Resource，/ }).first(), { settle: 800 });
    await hoverLocator(page, page.getByRole('button', { name: /Review，/ }).first(), { settle: 800 });
    await moveTo(page, 1280, 640);
    await page.waitForTimeout(1000);
    await wheel(page, 430, { pause: 550 });
    await page.waitForTimeout(1000);
    await moveTo(page, 610, 760);
    await page.waitForTimeout(1300);
    await moveTo(page, 1190, 780);
    await page.waitForTimeout(1200);
    await moveTo(page, 780, 690);
    await page.waitForTimeout(1100);
    await wheel(page, -420, { pause: 600 });
    await page.waitForTimeout(1100);
    await moveTo(page, 1400, 620);
    await page.waitForTimeout(1400);
  }, { tail: 1000 });
  await context.close();
  return info;
}

async function S05(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/path', 2600);
  const info = await record(page, 'S05-path', async () => {
    await moveTo(page, 560, 190);
    await page.waitForTimeout(900);
    await moveTo(page, 980, 190);
    await page.waitForTimeout(900);
    await hoverLocator(page, page.getByRole('button', { name: /键与关系完整性，掌握度 35%，优先突破断点/ }).first(), { settle: 900 }).catch(() => {});
    const node = page.getByRole('button', { name: /关系、元组、属性与域，掌握度 48%，优先突破断点/ }).filter(VIS).first();
    await hoverLocator(page, node, { settle: 1300 });
    await clickLocator(page, node, { settle: 1500 });
    await moveTo(page, 1420, 420);
    await page.waitForTimeout(1300);
    await wheel(page, 340, { pause: 550 });
    await page.waitForTimeout(1100);
    await moveTo(page, 1430, 700);
    await page.waitForTimeout(1300);
    await moveTo(page, 1180, 700);
    await page.waitForTimeout(1100);
    await wheel(page, -340, { pause: 550 });
    await page.waitForTimeout(1100);
    await moveTo(page, 1410, 520);
    await page.waitForTimeout(1300);
  }, { tail: 1000 });
  await context.close();
  return info;
}

async function S06(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/resources', 2600);
  const info = await record(page, 'S06-resources', async () => {
    await moveTo(page, 700, 260);
    await page.waitForTimeout(1000);
    const cards = [
      /预览讲解文档/, /预览知识图解/, /预览分层练习/, /预览SQL 实操/, /预览交互图解/, /预览复习卡片/,
    ];
    for (const re of cards) {
      await hoverLocator(page, page.getByRole('button', { name: re }).filter(VIS).first(), { settle: 520 });
    }
    await moveTo(page, 760, 220);
    await page.waitForTimeout(1500);
    await clickLocator(page, page.getByRole('button', { name: '展开智审轨迹抽屉' }).filter(VIS).first(), { settle: 1000 });
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 500);
      const el = els.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
      if (el) el.scrollTop = 640;
    });
    await page.waitForTimeout(1400);
    await clickLocator(page, page.getByRole('button', { name: /评委演示：触发初审打回与自愈重构循环/ }).filter(VIS).first(), { settle: 1200 });
    await page.getByText('终审放行').filter(VIS).first().waitFor({ timeout: 40000 }).catch(() => {});
    await page.waitForTimeout(1600);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 500);
      const el = els.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
      if (el) el.scrollTop = 900;
    });
    await page.waitForTimeout(1400);
    await moveTo(page, 1270, 780);
    await page.waitForTimeout(1600);
    await moveTo(page, 1270, 900);
    await page.waitForTimeout(1800);
  }, { tail: 1000 });
  await context.close();
  return info;
}

async function S07(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/tutor', 2600);
  const info = await record(page, 'S07-tutor', async () => {
    await moveTo(page, 700, 250);
    await page.waitForTimeout(900);
    await clickLocator(page, page.getByRole('button', { name: /预设提问：候选键、主键、超键到底怎么一眼区分/ }).filter(VIS).first(), { settle: 1200 });
    await page.getByRole('button', { name: /展开或收起 RAG/ }).filter(VIS).first().waitFor({ timeout: 20000 }).catch(() => {});
    let lastLen = -1;
    let stable = 0;
    for (let i = 0; i < 50; i++) {
      const len = await page.evaluate(() => document.body.innerText.length);
      if (len === lastLen) stable += 1; else { stable = 0; lastLen = len; }
      if (stable >= 3) break;
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);
    const rag = page.getByRole('button', { name: /展开或收起 RAG/ }).filter(VIS).last();
    await clickLocator(page, rag, { settle: 1200 }).catch(() => {});
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 300 && el.clientHeight < 900);
      for (const el of els) el.scrollTop = 0;
    });
    await page.waitForTimeout(1800);
    await moveTo(page, 760, 430);
    await page.waitForTimeout(1400);
    await moveTo(page, 980, 360);
    await page.waitForTimeout(1200);
    const box = page.getByRole('textbox', { name: '向 AI 导师提问' }).filter(VIS).first();
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 60);
      for (const el of els) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(700);
    await box.fill('今天天气怎么样？');
    await page.waitForTimeout(700);
    await clickLocator(page, page.getByRole('button', { name: '发送问题' }).filter(VIS).first(), { settle: 1500 });
    await page.getByText('范围审核 · TutorAgent').filter(VIS).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1800);
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((el) => el.scrollHeight > el.clientHeight + 8 && el.clientHeight > 60);
      for (const el of els) el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(1600);
    await moveTo(page, 760, 420);
    await page.waitForTimeout(1200);
  }, { tail: 1200 });
  await context.close();
  return info;
}

async function S08(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/sql-lab', 2600);
  const info = await record(page, 'S08-sqllab', async () => {
    await moveTo(page, 430, 250);
    await page.waitForTimeout(700);
    await clickLocator(page, page.getByRole('button', { name: '多表JOIN', exact: true }).filter(VIS).first(), { settle: 900 });
    await clickLocator(page, page.getByRole('button', { name: /选择题库：学生选课成绩三表联查/ }).filter(VIS).first(), { settle: 1200 });
    await clickLocator(page, page.getByRole('button', { name: '填入标准参考 SQL' }).filter(VIS).first(), { settle: 1200 });
    await clickLocator(page, page.getByRole('button', { name: /在安全沙箱中执行 SQL 并触发 BKT 评估/ }).filter(VIS).first(), { settle: 1800 });
    await page.getByText('EXPLAIN PLAN').filter(VIS).first().waitFor({ timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1600);
    await moveTo(page, 1450, 760);
    await page.waitForTimeout(1000);
    const bkt = page.getByRole('button', { name: '查看 BKT 评估细节' }).filter(VIS).first();
    await clickLocator(page, bkt, { settle: 1500 }).catch(() => {});
    await page.waitForTimeout(1400);
    await moveTo(page, 960, 560);
    await page.waitForTimeout(1300);
    await clickLocator(page, page.getByText('确定并返回练习').filter(VIS).first(), { settle: 1200 }).catch(() => {});
    await clickLocator(page, page.getByText('收下徽章，继续学习').filter(VIS).first(), { settle: 1200 }).catch(() => {});
    await page.waitForTimeout(1200);
  }, { tail: 1200 });
  await context.close();
  return info;
}

async function S09(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/profile', 2600);
  const info = await record(page, 'S09-profile', async () => {
    await moveTo(page, 500, 240);
    await page.waitForTimeout(900);
    await moveTo(page, 520, 600);
    await page.waitForTimeout(1000);
    await moveTo(page, 700, 650);
    await page.waitForTimeout(1000);
    await wheel(page, 420, { pause: 500 });
    await page.waitForTimeout(1100);
    await moveTo(page, 780, 560);
    await page.waitForTimeout(1100);
    await moveTo(page, 1160, 860);
    await page.waitForTimeout(1200);
    await wheel(page, 430, { pause: 500 });
    await page.waitForTimeout(1200);
    await moveTo(page, 800, 700);
    await page.waitForTimeout(1300);
  }, { tail: 900 });
  await context.close();
  return info;
}

async function S10(browser) {
  const context = await newContext(browser);
  const page = await newPage(context);
  await goto(page, '/help', 2400);
  const info = await record(page, 'S10-architecture', async () => {
    await page.evaluate(() => {
      const els = [...document.querySelectorAll('*')].filter((e) => e.scrollHeight > e.clientHeight + 200 && e.clientHeight > 500);
      const el = els.sort((a, b) => (b.scrollHeight - b.clientHeight) - (a.scrollHeight - a.clientHeight))[0];
      if (el) el.scrollTop = 700;
    });
    await page.waitForTimeout(1500);
    await moveTo(page, 1640, 28);
    await page.waitForTimeout(600);
    await clickLocator(page, page.getByTestId('theme-option-linear').filter(VIS).first(), { settle: 1200 });
    await clickLocator(page, page.getByTestId('theme-mode-toggle').filter(VIS).first(), { settle: 2000 });
    await moveTo(page, 900, 520, 24);
    await page.waitForTimeout(1500);
    await moveTo(page, 660, 700, 20);
    await page.waitForTimeout(1400);
    await moveTo(page, 1220, 700, 20);
    await page.waitForTimeout(1400);
  }, { tail: 1000 });
  await context.close();
  return info;
}

const ALL = { S03, S04, S05, S06, S07, S08, S09, S10 };

const pick = process.argv[2];
const browser = await launch();
const names = pick ? pick.split(',') : Object.keys(ALL);
const results = [];
for (const name of names) {
  const fn = ALL[name];
  if (!fn) throw new Error(`unknown scene ${name}`);
  console.log(`\n== recording ${name} ==`);
  results.push(await fn(browser));
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
