/**
 * Zero-dependency web verification harness.
 *
 *   node scripts/verify-web.mjs            # audit colours + tutor choreography
 *   node scripts/verify-web.mjs --shots    # also write screenshots for every route
 *
 * It serves apps/client/dist, injects an error trap into HTML responses, and
 * drives headless Chrome with --virtual-time-budget. Three in-memory pages do
 * the work:
 *   /__seed.html?to=/route   seeds a demo session + light theme, then redirects
 *   /__audit.html            walks every route and asserts no dark blocks
 *   /__tutor.html            asserts the three-stage streaming choreography
 */
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "apps/client/dist");
const shotsDir = resolve(root, ".verify/shots");
const chromePath = process.env.CHROME_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const port = Number(process.env.VERIFY_PORT ?? 8099);
const wantShots = process.argv.includes("--shots");
const SHOT_ROUTES = ["/", "/help", "/(tabs)", "/(tabs)/path", "/(tabs)/resources", "/(tabs)/tutor", "/(tabs)/profile", "/sql-lab", "/diagnostic", "/onboarding", "/select-user", "/resource/demo"];
const AUDIT_ROUTES = ["/", "/help", "/(tabs)", "/(tabs)/path", "/(tabs)/resources", "/(tabs)/tutor", "/(tabs)/profile", "/sql-lab", "/diagnostic", "/onboarding", "/select-user", "/resource/demo", "/tutor", "/path", "/resources", "/profile"];
const AUTH_ROUTES = ["/help", "/(tabs)", "/(tabs)/path", "/(tabs)/resources", "/(tabs)/tutor", "/(tabs)/profile", "/sql-lab", "/diagnostic", "/resource/demo", "/tutor", "/path", "/resources", "/profile"];

if (!existsSync(resolve(dist, "index.html"))) {
  console.error("dist is missing. Run: pnpm --filter client build");
  process.exit(1);
}
if (!existsSync(chromePath)) {
  console.error(`Chrome not found at ${chromePath}. Set CHROME_PATH.`);
  process.exit(1);
}

const ERROR_TRAP = `<style>
/* Headless screenshots: IntersectionObserver does not tick under virtual time,
   so force the scroll-reveal resting state instead of capturing blank sections. */
[data-reveal="pending"], .scroll-reveal { opacity: 1 !important; transform: none !important; }
</style><script>
window.__errs = [];
window.addEventListener("error", function (event) {
  window.__errs.push("error: " + String((event && (event.message || event.error)) || "unknown"));
});
window.addEventListener("unhandledrejection", function (event) {
  var reason = event && event.reason;
  window.__errs.push("rejection: " + String((reason && reason.message) || reason || "unknown"));
});
var __consoleError = console.error;
console.error = function () {
  window.__errs.push("console.error: " + Array.prototype.map.call(arguments, String).join(" "));
  __consoleError.apply(console, arguments);
};
</script>`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

function seedPage(to, auth) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>seed</title></head><body>
<script>
try {
  const themeMode = new URLSearchParams(location.search).get("theme") || "claude-light";
  localStorage.setItem("zhijing.theme.v2", themeMode);
  localStorage.setItem("zhijing.onboarding.v1", "done");
  if (${auth ? "true" : "false"}) {
    localStorage.setItem("zhijing.session.v2", JSON.stringify({ token: "local-demo", userId: "demo-foundation", expiresAt: Date.now() + 86400000 }));
  } else {
    localStorage.removeItem("zhijing.session.v2");
  }
} catch (error) {}
location.replace(${JSON.stringify(to)});
</script></body></html>`;
}

const auditPage = `<!doctype html><html><head><meta charset="utf-8"><title>audit</title>
<style>html,body{margin:0}iframe{border:0}textarea{position:fixed;left:-9999px}</style></head><body>
<iframe id="frame" width="1440" height="900"></iframe>
<textarea id="out">RUNNING</textarea>
<script>
const ROUTES = ${JSON.stringify(AUDIT_ROUTES)};
const AUTH_ROUTES = ["/help", "/(tabs)", "/(tabs)/path", "/(tabs)/resources", "/(tabs)/tutor", "/(tabs)/profile", "/sql-lab", "/diagnostic", "/resource/demo", "/tutor", "/path", "/resources", "/profile"];
const out = document.getElementById("out");
const frame = document.getElementById("frame");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

function parseColor(value) {
  const match = String(value).match(/rgba?\\(([^)]+)\\)/);
  if (!match) return null;
  const parts = match[1].split(",").map((part) => Number(part.trim()));
  return { r: parts[0] || 0, g: parts[1] || 0, b: parts[2] || 0, a: parts.length > 3 ? parts[3] : 1 };
}

function luminance(color) {
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function collect(win, doc, seen) {
  const offenders = [];
  for (const el of doc.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 60 || rect.height <= 60) continue;
    const style = win.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) < 0.25) continue;
    const bg = parseColor(style.backgroundColor);
    if (!bg || bg.a < 0.6) continue;
    const lum = luminance(bg);
    if (lum >= 60) continue;
    const key = el.tagName + "|" + (el.getAttribute("class") || "").slice(0, 50) + "|" + style.backgroundColor;
    if (seen.has(key)) continue;
    seen.add(key);
    offenders.push({ tag: el.tagName, cls: String(el.getAttribute("class") || "").slice(0, 60), bg: style.backgroundColor, w: Math.round(rect.width), h: Math.round(rect.height), lum: Math.round(lum) });
  }
  return offenders;
}

async function auditRoute(route, width) {
  const auth = AUTH_ROUTES.indexOf(route) >= 0;
  frame.width = width;
  frame.height = width < 600 ? 900 : 900;
  await new Promise((done) => {
    let settled = false;
    const finish = () => { if (!settled) { settled = true; setTimeout(done, 1200); } };
    frame.onload = finish;
    frame.src = "/__seed.html?to=" + encodeURIComponent(route) + "&auth=" + (auth ? 1 : 0) + "&w=" + width;
    setTimeout(finish, 5000);
  });
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const seen = new Set();
  const offenders = [];
  let overflowX = 0;
  const scrollables = [];
  try {
    for (const el of doc.querySelectorAll("body *")) {
      const style = win.getComputedStyle(el);
      if ((style.overflowY === "auto" || style.overflowY === "scroll") && el.scrollHeight > el.clientHeight + 40) scrollables.push(el);
    }
  } catch (error) {}
  const containers = [doc.scrollingElement, ...scrollables].filter(Boolean);
  for (const container of containers) {
    let max = 0;
    try { max = Math.max(0, container.scrollHeight - container.clientHeight); } catch (error) {}
    for (let y = 0; y <= Math.min(max, 6400); y += 560) {
      try { container.scrollTop = y; } catch (error) {}
      await wait(360);
      offenders.push(...collect(win, doc, seen));
      try {
        const over = doc.documentElement.scrollWidth - win.innerWidth;
        if (over > overflowX) overflowX = over;
      } catch (error) {}
    }
    try { container.scrollTop = 0; } catch (error) {}
  }
  await wait(200);
  let errs = [];
  try { errs = (win.__errs || []).slice(0, 6); } catch (error) {}
  let widest = null;
  let wide = [];
  let chain = [];
  try {
    const target = [...doc.querySelectorAll('[dir="auto"]')].find((el) => {
      const text = String(el.textContent || "").trim();
      return text === "AI 辅导" || text === "个性化资源库";
    });
    if (target) {
      let node = target;
      for (let depth = 0; node && depth < 14; depth += 1) {
        const rect = node.getBoundingClientRect();
        chain.push({ depth, tag: node.tagName, left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width), padding: win.getComputedStyle(node).paddingLeft });
        node = node.parentElement;
      }
    }
  } catch (error) {}
  try {
    for (const el of doc.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (!widest || rect.right > widest.right) {
        widest = { right: Math.round(rect.right), width: Math.round(rect.width), tag: el.tagName, testid: el.getAttribute("data-testid"), cls: String(el.getAttribute("class") || "").slice(0, 40), text: String(el.textContent || "").replace(/\s+/g, " ").slice(0, 40) };
      }
      if (rect.right > win.innerWidth + 2 && rect.width > 40 && wide.length < 10) {
        wide.push({ right: Math.round(rect.right), width: Math.round(rect.width), tag: el.tagName, testid: el.getAttribute("data-testid"), text: String(el.textContent || "").replace(/\s+/g, " ").slice(0, 32) });
      }
    }
  } catch (error) {}
  let heading = "";
  try {
    const first = doc.querySelector("body [dir='auto']");
    heading = first ? String(first.textContent || "").slice(0, 40) : "";
  } catch (error) {}
  return {
    route,
    width,
    heading,
    overflowX,
    chain,
    bodyWidth: Math.round(doc.body.getBoundingClientRect().width),
    innerWidth: win.innerWidth,
    widest,
    wide,
    scrollHeight: containers.length,
    offenderCount: offenders.length,
    offenders: offenders.slice(0, 8),
    errors: errs,
  };
}

(async () => {
  const results = [];
  try {
    for (const route of ROUTES) {
      out.textContent = "RUNNING " + route;
      results.push(await auditRoute(route, 1440));
    }
    for (const route of ["/", "/(tabs)", "/(tabs)/tutor", "/(tabs)/resources", "/sql-lab", "/diagnostic", "/onboarding"]) {
      out.textContent = "RUNNING mobile " + route;
      results.push(await auditRoute(route, 430));
    }
    out.textContent = JSON.stringify(results);
  } catch (error) {
    out.textContent = JSON.stringify({ failure: String(error && error.stack || error), completed: results });
  }
})();
</script></body></html>`;

const tutorPage = `<!doctype html><html><head><meta charset="utf-8"><title>tutor</title>
<style>html,body{margin:0}iframe{border:0}textarea{position:fixed;left:-9999px}</style></head><body>
<iframe id="frame" width="1440" height="900"></iframe>
<textarea id="out">RUNNING</textarea>
<script>
const out = document.getElementById("out");
const frame = document.getElementById("frame");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

(async () => {
  try {
    localStorage.setItem("zhijing.theme.v2", "claude-light");
    localStorage.setItem("zhijing.session.v2", JSON.stringify({ token: "local-demo", userId: "demo-foundation", expiresAt: Date.now() + 86400000 }));
  } catch (error) {}
  await new Promise((done) => {
    frame.onload = () => setTimeout(done, 1600);
    frame.src = "/tutor";
  });
  const win = frame.contentWindow;
  const doc = frame.contentDocument;
  const report = { clicked: false, sawThinking: false, sawCaret: false, sawSqlCard: false, sawSkip: false, steps: [], scrollYStart: 0, scrollYMax: 0, scrollDrift: 0, threadScrollTop: 0, thinkingMs: 0, errors: [], text: "" };
  const findAsk = () => doc.querySelector('[aria-label^="快捷提问"], [aria-label^="预设提问"]');
  const ask = findAsk();
  if (!ask) {
    report.errors.push("no preset question button found");
    out.textContent = JSON.stringify(report);
    return;
  }
  report.clicked = true;
  ask.click();
  report.scrollYStart = win.scrollY;
  const startedAt = Date.now();
  let firstThinkingAt = 0;
  for (let step = 0; step < 90; step += 1) {
    await wait(100);
    const thinking = doc.querySelector('[data-testid="tutor-thinking"]');
    const assistant = doc.querySelector('[data-testid="tutor-assistant-message"]');
    const bodyText = assistant ? String(assistant.textContent || "") : "";
    if (thinking && !report.sawThinking) { report.sawThinking = true; firstThinkingAt = Date.now(); }
    if (bodyText.indexOf("▍") >= 0) report.sawCaret = true;
    if (doc.querySelector('[data-testid="tutor-card-sql"]')) report.sawSqlCard = true;
    if (doc.querySelector('[data-testid="tutor-skip"]')) report.sawSkip = true;
    if (thinking) {
      const text = String(thinking.textContent || "");
      if (text.indexOf("🔍") >= 0 && report.steps.indexOf("search") < 0) report.steps.push("search");
      if (text.indexOf("命中 2 张权威知识卡") >= 0 && report.steps.indexOf("hit") < 0) report.steps.push("hit");
      if (text.indexOf("ReviewGuard") >= 0 && report.steps.indexOf("guard") < 0) report.steps.push("guard");
    }
    const drift = Math.abs(win.scrollY - report.scrollYStart);
    if (drift > report.scrollDrift) report.scrollDrift = drift;
    if (win.scrollY > report.scrollYMax) report.scrollYMax = win.scrollY;
    const thread = doc.querySelector('[data-testid="tutor-thread"]');
    if (thread) {
      const nodes = [thread, ...thread.querySelectorAll("*")];
      for (const node of nodes) {
        if (typeof node.scrollTop === "number" && node.scrollTop > report.threadScrollTop) report.threadScrollTop = Math.round(node.scrollTop);
      }
    }
    if (report.sawCaret && report.sawSqlCard) break;
  }
  report.thinkingMs = firstThinkingAt ? firstThinkingAt - startedAt : 0;
  // Let the staggered card reveal settle before measuring the final anchor.
  await wait(1000);
  for (const node of [doc.querySelector('[data-testid="tutor-thread"]'), ...(doc.querySelector('[data-testid="tutor-thread"]')?.querySelectorAll("*") || [])]) {
    if (node && typeof node.scrollTop === "number" && node.scrollTop > report.threadScrollTop) report.threadScrollTop = Math.round(node.scrollTop);
  }
  try {
    report.scrollers = [...doc.querySelectorAll("*")]
      .filter((el) => el.scrollHeight > el.clientHeight + 20)
      .map((el) => ({ tag: el.tagName, testid: el.getAttribute("data-testid"), top: Math.round(el.scrollTop), sh: el.scrollHeight, ch: el.clientHeight }))
      .slice(0, 6);
  } catch (error) { report.scrollers = []; }
  const assistant = doc.querySelector('[data-testid="tutor-assistant-message"]');
  report.text = assistant ? String(assistant.textContent || "").slice(0, 200) : "";
  report.errors = (win.__errs || []).slice(0, 6);
  out.textContent = JSON.stringify(report);
})();
</script></body></html>`;

const tutorShotPage = `<!doctype html><html><head><meta charset="utf-8"><title>tutor-shot</title>
<style>html,body{margin:0;height:100%}iframe{border:0;display:block;width:100vw;height:100vh}</style></head><body>
<iframe id="frame" src="/tutor"></iframe>
<script>
try {
  localStorage.setItem("zhijing.theme.v2", "claude-light");
  localStorage.setItem("zhijing.session.v2", JSON.stringify({ token: "local-demo", userId: "demo-foundation", expiresAt: Date.now() + 86400000 }));
} catch (error) {}
const frame = document.getElementById("frame");
const wait = (ms) => new Promise((done) => setTimeout(done, ms));
(async () => {
  await wait(1800);
  const doc = frame.contentDocument;
  const ask = doc && doc.querySelector('[aria-label^="快捷提问"], [aria-label^="预设提问"]');
  if (ask) ask.click();
})();
</script></body></html>`;

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type ?? "text/plain; charset=utf-8", "Cache-Control": "no-store" });
  res.end(body);
}

function fileFor(pathname) {
  const clean = decodeURIComponent(pathname.split("?")[0]);
  const candidates = [
    clean === "/" ? "/index.html" : clean,
    clean === "/" ? null : `${clean}.html`,
    clean === "/" ? null : join(clean, "index.html"),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const target = normalize(join(dist, candidate));
    if (!target.startsWith(dist)) continue;
    if (existsSync(target) && statSync(target).isFile()) return target;
  }
  return null;
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === "/__seed.html") {
    const to = url.searchParams.get("to") || "/";
    const auth = url.searchParams.get("auth") === "1";
    send(res, 200, seedPage(to, auth), "text/html; charset=utf-8");
    return;
  }
  if (url.pathname === "/__audit.html") { send(res, 200, auditPage, "text/html; charset=utf-8"); return; }
  if (url.pathname === "/__tutor.html") { send(res, 200, tutorPage, "text/html; charset=utf-8"); return; }
  if (url.pathname === "/__tutor-shot.html") { send(res, 200, tutorShotPage, "text/html; charset=utf-8"); return; }

  const file = fileFor(url.pathname);
  if (!file) { send(res, 404, "not found"); return; }
  const ext = extname(file).toLowerCase();
  let body = readFileSync(file);
  if (ext === ".html") {
    body = Buffer.from(String(body).replace(/<head[^>]*>/i, (tag) => `${tag}${ERROR_TRAP}`), "utf8");
  }
  res.writeHead(200, { "Content-Type": MIME[ext] ?? "application/octet-stream", "Cache-Control": "no-store" });
  res.end(body);
});

function runChrome(url, budget, size, screenshot) {
  return new Promise((done, fail) => {
    const profile = resolve(root, `.verify/chrome-${process.pid}-${Math.random().toString(36).slice(2, 8)}`);
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      "--disable-extensions",
      "--hide-scrollbars",
      `--user-data-dir=${profile}`,
      `--window-size=${size}`,
      `--virtual-time-budget=${budget}`,
      "--run-all-compositor-stages-before-draw",
    ];
    if (screenshot) args.push(`--screenshot=${screenshot}`);
    else args.push("--dump-dom");
    args.push(url);
    const child = spawn(chromePath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", fail);
    child.on("close", () => done({ stdout, stderr }));
  });
}

function textareaValue(html) {
  const match = html.match(/<textarea id="out">([\s\S]*?)<\/textarea>/);
  return match ? match[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") : null;
}

async function main() {
  mkdirSync(resolve(root, ".verify"), { recursive: true });
  await new Promise((done) => server.listen(port, "127.0.0.1", done));
  console.log(`serving ${dist} on http://127.0.0.1:${port}`);

  const auditRun = await runChrome(`http://127.0.0.1:${port}/__audit.html`, 240000, "1480,1000");
  const auditRaw = textareaValue(auditRun.stdout);
  if (!auditRaw || auditRaw === "RUNNING") {
    console.error("audit harness did not finish.\n", auditRaw, auditRun.stderr.slice(-2000));
    server.close();
    process.exit(1);
  }
  const audit = JSON.parse(auditRaw);
  const bad = audit.filter((item) => item.offenderCount > 0 || item.errors.length > 0 || item.overflowX > 2);
  console.log(`\n=== Colour / layout audit (${audit.length} page-loads) ===`);
  for (const item of audit) {
    const flag = item.offenderCount > 0 || item.errors.length > 0 || item.overflowX > 2 ? "FAIL" : "ok  ";
    console.log(`${flag} ${String(item.width).padStart(4)}px ${item.route.padEnd(22)} heading="${item.heading}" dark=${item.offenderCount} overflowX=${item.overflowX} widest=${item.widest ? `${item.widest.right}px ${item.widest.tag}${item.widest.testid ? `#${item.widest.testid}` : ""}` : "?"}`);
    for (const offender of item.offenders) console.log(`       ↳ ${offender.tag} ${offender.bg} ${offender.w}x${offender.h} lum=${offender.lum} ${offender.cls}`);
    for (const error of item.errors) console.log(`       ↳ error: ${error}`);
    if (item.width === 430) for (const w of item.wide.slice(0, 4)) console.log(`       ↳ wide ${w.right}px/${w.width}px ${w.tag} "${w.text}"`);
    if (item.width === 430) for (const c of item.chain) console.log(`       ↳ chain d${c.depth} ${c.tag} L${c.left} R${c.right} W${c.width} pad${c.padding}`);
  }
  writeFileSync(resolve(root, ".verify/audit.json"), JSON.stringify(audit, null, 2));

  const tutorRun = await runChrome(`http://127.0.0.1:${port}/__tutor.html`, 120000, "1480,1000");
  const tutorRaw = textareaValue(tutorRun.stdout);
  if (!tutorRaw || tutorRaw === "RUNNING") {
    console.error("tutor harness did not finish.\n", tutorRaw, tutorRun.stderr.slice(-2000));
    server.close();
    process.exit(1);
  }
  const tutor = JSON.parse(tutorRaw);
  writeFileSync(resolve(root, ".verify/tutor.json"), JSON.stringify(tutor, null, 2));
  console.log("\n=== Tutor choreography ===");
  console.log(JSON.stringify({ ...tutor, text: tutor.text.slice(0, 120) }, null, 2));

  const tutorPass = tutor.clicked && tutor.sawThinking && tutor.sawCaret && tutor.sawSqlCard
    && tutor.scrollDrift <= 2 && tutor.threadScrollTop > 40 && tutor.steps.length >= 2 && tutor.errors.length === 0;

  if (wantShots) {
    mkdirSync(shotsDir, { recursive: true });
    console.log("\n=== Screenshots ===");
    for (const route of SHOT_ROUTES) {
      const auth = AUTH_ROUTES.indexOf(route) >= 0 ? 1 : 0;
      const slug = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "root";
      for (const [size, suffix] of [["1440,900", "desktop"], ["430,900", "mobile"]]) {
        const file = resolve(shotsDir, `${slug}-${suffix}.png`);
        await runChrome(`http://127.0.0.1:${port}/__seed.html?to=${encodeURIComponent(route)}&auth=${auth}`, 20000, size, file);
        console.log(`  ${file}`);
      }
    }
  }

  server.close();
  if (bad.length > 0 || !tutorPass) {
    console.error(`\nFAILED: ${bad.length} page issue(s); tutorPass=${tutorPass}`);
    process.exit(1);
  }
  console.log("\nAll web checks passed.");
}

if (process.argv.includes("--serve")) {
  mkdirSync(resolve(root, ".verify"), { recursive: true });
  server.listen(port, "127.0.0.1", () => console.log(`serving ${dist} on http://127.0.0.1:${port}`));
} else {
  main().catch((error) => {
    console.error(error);
    server.close();
    process.exit(1);
  });
}
