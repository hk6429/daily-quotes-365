// Playwright WebKit iPhone 13 煙霧測試。用法：BASE=http://localhost:3000 node test/smoke.mjs
import { webkit, devices } from 'playwright';
const BASE = process.env.BASE || 'http://localhost:3000';
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'] });
const page = await ctx.newPage();
const fails = [];
const check = (name, ok) => { console.log((ok ? 'ok  ' : 'FAIL') + ' ' + name); if (!ok) fails.push(name); };

await page.goto(BASE + '/?d=999');
await page.waitForSelector('.line');
check('?d=999 falls back to today and renders', (await page.locator('.line').count()) === 5);
check('title rendered', (await page.locator('#titleZh').textContent()).trim().length > 0);
check('5 play buttons', (await page.locator('.line .play').count()) === 5);
check('text hidden by default', (await page.locator('.line.hide-en').count()) === 5);
await page.click('#showEn');
check('show english reveals', (await page.locator('.line.hide-en').count()) === 0);
check('zh still hidden', (await page.locator('.line.hide-zh').count()) === 5);
await page.click('#showZh');
check('show zh reveals', (await page.locator('.line.hide-zh').count()) === 0);
await page.click('#playAll');
await page.waitForTimeout(300);
check('playAll shows stop', (await page.locator('#playAll').textContent()).includes('停止'));
await page.click('#playAll');
await page.waitForTimeout(300);
check('second click stops', (await page.locator('#playAll').textContent()).includes('聽全部'));
await page.click('#doneBtn');
check('done button marks', (await page.locator('#doneBtn').textContent()).includes('已完成'));
check('stats show 1 day', (await page.locator('#stats').textContent()).includes('已練 1 天'));
await page.goto(BASE + '/?d=42');
await page.waitForSelector('.line');
check('?d=42 label', (await page.locator('#dayLabel').textContent()).includes('第 42 天'));
await page.goto(BASE + '/archive.html');
await page.waitForSelector('.grid a');
check('archive lists 365', (await page.locator('.grid a').count()) === 365);
await browser.close();
if (fails.length) { console.error('FAILED:', fails); process.exit(1); }
console.log('smoke ok');
