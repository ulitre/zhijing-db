import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const failures = [];

function requireFile(relativePath) {
  if (!existsSync(resolve(root, relativePath))) failures.push(`缺少文件：${relativePath}`);
}

for (const file of [
  "vercel.json",
  "api/index.ts",
  "apps/client/app.json",
  "apps/client/eas.json",
  "apps/client/vercel.json",
  "docs/06-部署与交付.md",
  "docs/07-最终交付验收表.md",
]) requireFile(file);

const appConfig = JSON.parse(readFileSync(resolve(root, "apps/client/app.json"), "utf8"));
if (appConfig.expo?.android?.package !== "com.zhijing.db") {
  failures.push("Android applicationId 必须为 com.zhijing.db");
}

const easConfig = JSON.parse(readFileSync(resolve(root, "apps/client/eas.json"), "utf8"));
const preview = easConfig.build?.preview;
if (preview?.android?.buildType !== "apk" || preview?.distribution !== "internal") {
  failures.push("EAS preview 必须生成可直接安装的 internal APK");
}

const apiUrl = preview?.env?.EXPO_PUBLIC_API_URL;
if (typeof apiUrl !== "string" || !apiUrl.startsWith("https://") || apiUrl.includes("replace-with")) {
  failures.push("发布前需把 apps/client/eas.json 中的 EXPO_PUBLIC_API_URL 改为真实 HTTPS API 地址");
}

const webBundleDir = resolve(root, "apps/client/dist/_expo/static/js/web");
if (!existsSync(webBundleDir)) {
  failures.push("缺少 Web 导出包，请先执行 pnpm --filter client build");
} else {
  const bundleFiles = readdirSync(webBundleDir, { recursive: true }).filter((file) => file.endsWith(".js"));
  const bundleText = bundleFiles.map((file) => readFileSync(resolve(webBundleDir, file), "utf8")).join("\n");
  if (typeof apiUrl === "string" && !bundleText.includes(apiUrl)) failures.push("Web 导出包未包含生产 API 地址，需清除 Expo 缓存后重新导出");
  if (/http:\/\/(?:localhost|127\.0\.0\.1):\d+/.test(bundleText)) failures.push("Web 导出包仍包含本机 API 地址");
}

if (failures.length) {
  console.error("\n交付配置尚未就绪：");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("交付配置检查通过：Web、API 与 Android APK 配置均已就绪。");
