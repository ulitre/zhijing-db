#!/usr/bin/env node
/**
 * 切换 apps/client/.env 中的 EXPO_PUBLIC_API_URL。
 *
 *   pnpm env:local   本地调试：备份生产 .env 后写入 http://localhost:8787
 *   pnpm env:prod    交付构建：从备份原子恢复生产地址（无备份时按生产地址重写）
 *
 * 设计要点：
 * - 备份文件 apps/client/.env.prod.bak 被 .gitignore 忽略，不进入仓库。
 * - 每次写入先写同目录临时文件再 rename，避免进程中断留下半个 .env。
 * - 找不到 / 写不进 EXPO_PUBLIC_API_URL 时直接非零退出，杜绝静默失败。
 */
import { copyFileSync, existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const clientDir = resolve(root, "apps/client");
const envFile = resolve(clientDir, ".env");
const exampleFile = resolve(clientDir, ".env.example");
const backupFile = resolve(clientDir, ".env.prod.bak");

const DEFAULT_PROD_URL = "https://zhijing-db-api-production.up.railway.app";
const DEFAULT_LOCAL_URL = "http://localhost:8787";

const command = process.argv[2];
if (command !== "local" && command !== "prod") {
  console.error("用法: node scripts/env-switch.mjs <local|prod>");
  process.exit(2);
}

const targetUrl = command === "local"
  ? process.env.LOCAL_API_URL || DEFAULT_LOCAL_URL
  : process.env.PROD_API_URL || DEFAULT_PROD_URL;

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readEnv() {
  if (existsSync(envFile)) return readFileSync(envFile, "utf8");
  if (existsSync(exampleFile)) return readFileSync(exampleFile, "utf8");
  return `EXPO_PUBLIC_API_URL=${DEFAULT_LOCAL_URL}\n`;
}

function withApiUrl(content, url) {
  const line = `EXPO_PUBLIC_API_URL=${url}`;
  const pattern = /^EXPO_PUBLIC_API_URL=.*$/m;
  if (pattern.test(content)) return content.replace(pattern, line);
  // 没有该键时追加，而不是静默跳过。
  return `${content.replace(/\s*$/, "")}\n${line}\n`;
}

function atomicWrite(content) {
  const tempFile = `${envFile}.tmp-${process.pid}`;
  writeFileSync(tempFile, content, "utf8");
  try {
    renameSync(tempFile, envFile);
  } catch {
    // 极少数 Windows 文件系统不允许 rename 覆盖；退化为覆盖写并清理临时文件。
    copyFileSync(tempFile, envFile);
    unlinkSync(tempFile);
  }
}

function activeUrl(content) {
  const match = content.match(/^EXPO_PUBLIC_API_URL=(.*)$/m);
  return match ? match[1].trim() : null;
}

let content;
let restoredFromBackup = false;

if (command === "local") {
  const current = readEnv();
  const currentUrl = activeUrl(current);
  // 只在当前仍是生产地址时备份，避免把 localhost 备份成“生产”版本。
  if (currentUrl && !/localhost|127\.0\.0\.1/.test(currentUrl) && !existsSync(backupFile)) {
    copyFileSync(envFile, backupFile);
  }
  const source = existsSync(backupFile) ? readFileSync(backupFile, "utf8") : current;
  content = withApiUrl(source, targetUrl);
} else {
  if (existsSync(backupFile)) {
    // 备份就是切换前的生产 .env，原样恢复；仅在显式传入 PROD_API_URL 时覆盖。
    content = readFileSync(backupFile, "utf8");
    if (process.env.PROD_API_URL) content = withApiUrl(content, targetUrl);
    restoredFromBackup = true;
  } else {
    content = withApiUrl(readEnv(), targetUrl);
  }
}

const url = activeUrl(content);
if (url !== targetUrl) fail(`写入后 EXPO_PUBLIC_API_URL 为 ${url ?? "(缺失)"}，期望 ${targetUrl}`);
if (command === "prod" && /localhost|127\.0\.0\.1/.test(url)) fail("生产环境地址不能指向本机");
if (command === "local" && !/localhost|127\.0\.0\.1/.test(url)) fail("本地环境地址必须指向 localhost");

atomicWrite(content);
if (command === "prod" && existsSync(backupFile)) unlinkSync(backupFile);

console.log(`✓ apps/client/.env → ${url}`);
if (command === "local") {
  console.log(`  备份：${existsSync(backupFile) ? "apps/client/.env.prod.bak" : "无（当前原本就是本地地址）"}`);
} else if (restoredFromBackup) {
  console.log("  已从 apps/client/.env.prod.bak 恢复并删除备份");
}
