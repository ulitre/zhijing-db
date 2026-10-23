import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { imageioFfmpeg } from './ffmpeg.mjs';

export const FFMPEG = imageioFfmpeg();
export const W = 1920;
export const H = 1080;
export const FPS = 30;

export async function launch() {
  return chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--force-device-scale-factor=1', '--hide-scrollbars', '--disable-lcd-text'],
  });
}

export async function newContext(browser, { session = true, theme = 'claude-light' } = {}) {
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
    locale: 'zh-CN',
    colorScheme: 'light',
  });
  await context.addInitScript(({ hasSession, themeName }) => {
    localStorage.setItem('zhijing.onboarding.v1', '1');
    localStorage.setItem('zhijing.theme.v2', themeName);
    if (hasSession) {
      localStorage.setItem('zhijing.session.v2', JSON.stringify({
        token: 'local-demo', userId: 'demo-foundation', expiresAt: Date.now() + 86400000,
      }));
    } else {
      localStorage.removeItem('zhijing.session.v2');
    }
    const install = () => {
      if (document.getElementById('__demo_cursor')) return;
      const style = document.createElement('style');
      style.textContent = `
        #__demo_cursor{position:fixed;left:-40px;top:-40px;width:22px;height:22px;z-index:2147483647;pointer-events:none;will-change:transform;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));}
        #__demo_cursor svg{display:block}
        .__demo_ripple{position:fixed;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;border:2px solid rgba(217,119,87,.95);background:rgba(217,119,87,.25);z-index:2147483646;pointer-events:none;animation:__demo_pulse .55s ease-out forwards}
        @keyframes __demo_pulse{0%{transform:scale(.6);opacity:.9}100%{transform:scale(3.2);opacity:0}}
      `;
      document.head.appendChild(style);
      const cursor = document.createElement('div');
      cursor.id = '__demo_cursor';
      cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2.5l15.2 9.2-6.6 1.3-3.2 6.3L4 2.5z" fill="#fff" stroke="#1f1f1f" stroke-width="1.4" stroke-linejoin="round"/></svg>';
      document.body.appendChild(cursor);
      let last = { x: -40, y: -40 };
      const move = (e) => {
        last = { x: e.clientX, y: e.clientY };
        cursor.style.transform = `translate(${last.x}px, ${last.y}px)`;
      };
      document.addEventListener('mousemove', move, true);
      document.addEventListener('mousedown', (e) => {
        const r = document.createElement('span');
        r.className = '__demo_ripple';
        r.style.left = e.clientX + 'px';
        r.style.top = e.clientY + 'px';
        document.body.appendChild(r);
        setTimeout(() => r.remove(), 650);
      }, true);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
  }, { hasSession: session, themeName: theme });
  return context;
}

export async function newPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return page;
}

export async function goto(page, route, settle = 2200) {
  await page.goto(`http://localhost:8082${route}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(settle);
}

export async function record(page, name, run, { tail = 900, outDir = 'clips' } = {}) {
  const dir = path.join('frames', name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Page.enable');
  const frames = [];
  let index = 0;
  let closed = false;
  cdp.on('Page.screencastFrame', (f) => {
    if (closed) return;
    const file = path.join(dir, `${String(index++).padStart(5, '0')}.jpg`);
    fs.writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: Date.now() });
    cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 94, everyNthFrame: 1, maxWidth: W, maxHeight: H,
  });

  const started = Date.now();
  try {
    await run();
  } finally {
    await page.waitForTimeout(tail);
    closed = true;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
  }
  const ended = Date.now();
  if (frames.length < 2) throw new Error(`scene ${name}: only ${frames.length} frames`);

  const listPath = path.join(dir, 'frames.txt');
  const lines = [];
  for (let i = 0; i < frames.length; i++) {
    const next = frames[i + 1]?.ts ?? ended;
    const dur = Math.max(1 / 60, (next - frames[i].ts) / 1000);
    lines.push(`file '${path.resolve(frames[i].file).replace(/'/g, "'\\''")}'`);
    lines.push(`duration ${dur.toFixed(4)}`);
  }
  lines.push(`file '${path.resolve(frames[frames.length - 1].file).replace(/'/g, "'\\''")}'`);
  fs.writeFileSync(listPath, lines.join('\n'), 'utf8');

  const mp4 = path.join(outDir, `${name}.mp4`);
  const args = [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', `fps=${FPS},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
    '-movflags', '+faststart', mp4,
  ];
  const res = spawnSync(FFMPEG, args, { encoding: 'utf8' });
  if (res.status !== 0) throw new Error(res.stderr || 'ffmpeg failed');
  const meta = probeDuration(mp4);
  console.log(`${name}: ${frames.length} frames, ${meta.toFixed(2)}s -> ${mp4}`);
  return { name, mp4, duration: meta, started, ended, frames: frames.length };
}

export function probeDuration(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file], { encoding: 'utf8' });
  const m = (r.stderr || '').match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) return 0;
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

export async function moveTo(page, x, y, steps = 22) {
  await page.mouse.move(x, y, { steps });
  await page.waitForTimeout(180);
}

export async function clickLocator(page, locator, { settle = 700, steps = 24 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) throw new Error('element has no box');
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await moveTo(page, x, y, steps);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
  await page.waitForTimeout(settle);
}

export async function hoverLocator(page, locator, { settle = 700 } = {}) {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  const box = await locator.boundingBox();
  if (!box) return;
  await moveTo(page, box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(settle);
}

export async function typeSlowly(page, locator, text, delay = 80) {
  await locator.click();
  await page.waitForTimeout(250);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await page.waitForTimeout(delay);
  }
}

export async function wheel(page, dy, { steps = 12, pause = 90 } = {}) {
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(pause);
}
