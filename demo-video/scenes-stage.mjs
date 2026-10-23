import { launch, newContext, newPage, record } from './recorder.mjs';
import path from 'node:path';

const browser = await launch();
const context = await newContext(browser);
const page = await newPage(context);
const base = 'file:///' + path.resolve('stage/index.html').replace(/\\/g, '/');

const plans = [
  ['S01-intro', 'intro', 11800],
  ['S02-pain', 'pain', 13500],
  ['S11-outro', 'outro', 9600],
];

const out = [];
for (const [name, scene, ms] of plans) {
  await page.goto(`${base}?scene=${scene}`);
  await page.waitForTimeout(250);
  console.log(`== ${name} ==`);
  out.push(await record(page, name, async () => { await page.waitForTimeout(ms); }, { tail: 150 }));
}
await browser.close();
console.log(JSON.stringify(out, null, 2));
