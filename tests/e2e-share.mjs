// Приём выписки через «Поделиться» (Android): мост NummazaNative подменяется в браузере.
// Запуск: NODE_PATH=$(npm root -g) node tests/e2e-share.mjs  (нужен /tmp/kaspi_sample.pdf — tests/make_sample_pdf.py)
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const url = new URL('../app/index.html', import.meta.url).href;
const b64 = readFileSync('/tmp/kaspi_sample.pdf').toString('base64');
let fail = 0; const ok = (c, n) => { console.log(c ? '  ✓' : '  ✗', n); if (!c) fail++; };
const browser = await chromium.launch();
const errors = [];
async function dev(payload) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.addInitScript((p) => {
    window.NZ = { _fakeToday: '2026-11-04' };
    let q = p; window.NummazaNative = { takeSharedFile() { const r = q; q = null; return r; }, share() {}, _push(x) { q = x; } };
  }, payload);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /i18n/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  return page;
}
const json = JSON.stringify({ name: 'gold_statement.pdf', type: 'application/pdf', data: b64 });

console.log('1. Поделились до регистрации');
let p = await dev(json);
await p.waitForSelector('#shared-note');
ok((await p.locator('#shared-note').innerText()).includes('gold_statement.pdf'), 'на экране входа: файл получен');
await p.fill('#a-name', 'Айдана'); await p.fill('#a-login', 'a@b.kz'); await p.fill('#a-pw', 'nummaza2026'); await p.check('#a-agree');
await p.getByRole('button', { name: 'Создать аккаунт' }).click();
await p.waitForSelector('.safe-v', { timeout: 20000 });
ok(await p.evaluate(() => NZ.app.state.txs.length) === 88, 'после регистрации выписка сразу разобрана: 88 операций');
ok(await p.evaluate(() => NZ.app.state.imports[0].name) === 'gold_statement.pdf', 'имя файла сохранено');

console.log('2. Приложение открыто — поделились ещё раз (onNewIntent)');
await p.evaluate((j) => { window.NummazaNative._push(j); NZ.app.pullShared(); }, json);
await p.waitForFunction(() => location.hash === '#statements' && !NZ.app.ui.importing && document.body.innerText.includes('Уже были загружены'), null, { timeout: 20000 });
ok(true, 'открылись «Выписки», повтор распознан как дубликаты');

console.log('3. Ошибка: файл слишком большой');
await p.evaluate(() => { location.hash = 'home'; });
await p.evaluate(() => { window.NummazaNative._push('{"error":"size"}'); NZ.app.pullShared(); });
await p.waitForFunction(() => location.hash === '#statements' && document.body.innerText.includes('больше 10 МБ'));
ok(true, 'понятная ошибка про размер');

console.log('4. В браузере без моста ничего не ломается');
const ctx = await browser.newContext(); const w = await ctx.newPage(); w.on('pageerror', (e) => errors.push(e.message));
await w.goto(url); await w.waitForSelector('#a-login'); ok(!(await w.locator('#shared-note').count()), 'без Android-моста подсказки нет');
ok(errors.length === 0, 'нет ошибок в консоли ' + errors.join(' | '));
await browser.close(); process.exit(fail ? 1 : 0);
