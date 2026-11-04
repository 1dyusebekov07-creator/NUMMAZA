// Сквозной тест NUMMAZA с сервером: регистрация и вход через API, синхронизация между двумя устройствами.
// Запуск: NODE_PATH=$(npm root -g) node tests/e2e-server.mjs
import { createRequire } from 'node:module';
import { openDb } from '../server/db.js';
import { createApp } from '../server/app.js';
const { chromium } = createRequire(import.meta.url)('playwright');

let failed = 0; let passed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

const db = await openDb({ pglite: true });
const server = createApp(db, { authLimit: 1000 }).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;
const count = async (sql, p = []) => (await db.query(sql, p)).rows[0].n;

const browser = await chromium.launch();
const errors = [];
async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
  await ctx.addInitScript(() => { window.NZ = { _fakeToday: '2026-11-04' }; });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(name + ' pageerror: ' + e.message));
  // «Failed to load resource» браузер пишет сам на ожидаемые ответы 401/409 и при отключённой сети — это не ошибки приложения
  page.on('console', (m) => { if ((m.type() === 'error' && !/Failed to load resource/.test(m.text())) || (m.type() === 'warning' && /i18n/.test(m.text()))) errors.push(name + ' ' + m.type() + ': ' + m.text()); });
  await page.goto(base);
  return { ctx, page, text: () => page.locator('#app').innerText(), sync: () => page.evaluate(() => window.NZ.sync.run()), state: (f) => page.evaluate(f) };
}
const LOGIN = '+7 701 555 44 33';
const PW = 'nummaza2026';

console.log('1. Регистрация через сервер (телефон A)');
const A = await device('A');
ok((await A.text()).includes('Пароль хранится на сервере'), 'на экране входа сказано, что пароль хранится на сервере');
await A.page.fill('#a-name', 'Айдана');
await A.page.fill('#a-login', LOGIN);
await A.page.fill('#a-pw', PW);
await A.page.check('#a-agree');
await A.page.getByRole('button', { name: 'Создать аккаунт' }).click();
await A.page.waitForSelector('text=Добро пожаловать в NUMMAZA');
ok(await count("SELECT count(*)::int AS n FROM users WHERE login='+77015554433'") === 1, 'пользователь создан в базе сервера');
for (let i = 0; i < 3; i++) { if (i === 1) await A.page.fill('#o-income', '650000'); await A.page.locator('[data-a="onbNext"]').click(); }
await A.page.getByRole('button', { name: 'Попробовать на примере' }).click();
await A.page.waitForSelector('.safe-v');
await A.sync();
const txA = await A.state(() => window.NZ.app.state.txs.length);
const recTx = await count("SELECT count(*)::int AS n FROM records WHERE kind='tx' AND NOT deleted");
ok(recTx === txA && txA > 50, `все операции (${txA}) сохранены на сервере`);
ok(await count("SELECT count(*)::int AS n FROM records WHERE kind='profile' AND (data->>'onboarded')::boolean") === 1, 'профиль и онбординг на сервере');

console.log('2. Ручная трата уходит на сервер');
await A.page.locator('.fab').click();
for (const k of ['4', '2', '0', '0']) await A.page.locator('.keypad [data-v="' + k + '"]').click();
await A.page.locator('#add-where').fill('Кофейня Тест');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
await A.sync();
ok(await count("SELECT count(*)::int AS n FROM records WHERE kind='tx' AND data->>'merchant'='Кофейня Тест'") === 1, 'трата «Кофейня Тест» на сервере');

console.log('3. Вход на втором устройстве (телефон B)');
const B = await device('B');
await B.page.getByRole('button', { name: 'Вход', exact: true }).click();
await B.page.fill('#a-login', '87015554433');
await B.page.fill('#a-pw', PW);
await B.page.getByRole('button', { name: 'Войти' }).click();
await B.page.waitForSelector('.safe-v');
ok(true, 'вход сразу на обзор — онбординг не повторяется');
ok(await B.state(() => window.NZ.app.state.txs.length) === txA + 1, 'на втором устройстве те же операции');
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Кофейня Тест')), 'и ручная трата тоже');
ok(await B.state(() => window.NZ.app.state.profile.income) === 650000, 'доход из профиля пришёл');
const safeA = await A.page.locator('.safe-v').innerText();
const safeB = await B.page.locator('.safe-v').innerText();
ok(safeA === safeB, '«Сегодня можно» совпадает на обоих: ' + safeA.replace(/\s/g, ' '));

console.log('4. Изменение на B → видно на A');
await B.page.goto(base + '#profile');
await B.page.fill('#p-income', '700000');
await B.page.locator('#p-income').dispatchEvent('change');
await B.sync();
await A.sync();
ok(await A.state(() => window.NZ.app.state.profile.income) === 700000, 'новый доход доехал до телефона A');

console.log('5. Без интернета');
await A.ctx.setOffline(true);
await A.page.goto(base + '#home').catch(() => {});
await A.page.evaluate(() => { location.hash = 'home'; });
await A.page.locator('.fab').click();
for (const k of ['9', '9', '9']) await A.page.locator('.keypad [data-v="' + k + '"]').click();
await A.page.locator('#add-where').fill('Офлайн-покупка');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
const r = await A.sync();
ok(r.error === 'offline', 'без сети синхронизация не падает, а ждёт');
await A.page.evaluate(() => { location.hash = 'profile'; });
ok((await A.page.locator('#sync-status').innerText()).includes('Ждут отправки: 1'), 'в профиле видно: 1 изменение ждёт отправки');
await A.ctx.setOffline(false);
await A.sync();
await B.sync();
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Офлайн-покупка')), 'после появления сети трата дошла до телефона B');

console.log('6. «Отменить» тоже синхронизируется');
await A.page.evaluate(() => { location.hash = 'home'; });
await A.page.locator('.fab').click();
await A.page.locator('.keypad [data-v="5"]').click();
await A.page.locator('#add-where').fill('Отменённая');
await A.page.getByRole('button', { name: 'Сохранить' }).click();
await A.sync();
await B.sync();
ok(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Отменённая')), 'трата появилась на B');
await A.page.locator('.toast-in button').click();
await A.sync();
await B.sync();
ok(!(await B.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Отменённая'))), 'после «Отменить» на A она исчезла и на B');

console.log('7. Ошибки входа и регистрации');
const C = await device('C');
await C.page.fill('#a-name', 'Другой');
await C.page.fill('#a-login', LOGIN);
await C.page.fill('#a-pw', PW);
await C.page.check('#a-agree');
await C.page.getByRole('button', { name: 'Создать аккаунт' }).click();
await C.page.waitForSelector('.err-box');
ok((await C.text()).includes('уже зарегистрирован'), 'занятый телефон — понятная ошибка');
await C.page.getByRole('button', { name: 'Вход', exact: true }).click();
await C.page.fill('#a-login', LOGIN);
await C.page.fill('#a-pw', 'wrongpass1');
await C.page.getByRole('button', { name: 'Войти' }).click();
await C.page.waitForSelector('.err-box');
ok((await C.text()).includes('Осталось попыток: 4'), 'неверный пароль — счётчик попыток с сервера');
await C.ctx.setOffline(true);
await C.page.getByRole('button', { name: 'Войти' }).click();
await C.page.waitForFunction(() => document.querySelector('.err-box') && /Нет связи/.test(document.querySelector('.err-box').textContent));
ok(true, 'без интернета — «Нет связи с сервером»');
await C.ctx.setOffline(false);

console.log('8. Выход и истёкшая сессия');
await B.page.evaluate(() => { location.hash = 'profile'; });
await B.page.getByRole('button', { name: 'Выйти' }).click();
await B.page.waitForSelector('text=С возвращением');
ok(await B.state(() => window.NZ.app.state.txs.length === 0 && !localStorage.getItem('nummaza.auth')), 'после выхода данные и токены стёрты с устройства');
ok((await B.page.inputValue('#a-login')) === '+77015554433', 'логин подставлен для быстрого входа');
await db.query('DELETE FROM sessions');
await A.sync();
await A.page.waitForSelector('text=Сессия истекла');
ok(true, 'отозванная сессия → экран входа «Сессия истекла»');

console.log('9. Удаление аккаунта');
await A.page.fill('#a-pw', PW);
await A.page.getByRole('button', { name: 'Войти' }).click();
await A.page.waitForSelector('.safe-v');
ok(await A.state(() => window.NZ.app.state.txs.some((x) => x.merchant === 'Офлайн-покупка')), 'после повторного входа всё на месте');
await A.page.evaluate(() => { location.hash = 'delete'; });
await A.page.fill('#del-w', 'удалить');
await A.page.locator('#del-btn').click();
await A.page.waitForSelector('text=Создайте аккаунт');
ok(await count("SELECT count(*)::int AS n FROM users WHERE login='+77015554433'") === 0, 'аккаунт удалён на сервере');
ok(await count('SELECT count(*)::int AS n FROM records') === 0, 'и все его данные тоже');

console.log('10. PDF-выписка на сайте с сервера (строгая политика безопасности страницы)');
const D = await device('D');
await D.page.fill('#a-name', 'Тест'); await D.page.fill('#a-login', 'pdf@test.kz'); await D.page.fill('#a-pw', PW); await D.page.check('#a-agree');
await D.page.getByRole('button', { name: 'Создать аккаунт' }).click();
for (let i = 0; i < 3; i++) { await D.page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await D.page.fill('#o-income', '400000'); await D.page.locator('[data-a="onbNext"]').click(); }
await D.page.setInputFiles('#file', '/tmp/kaspi_sample.pdf');
await D.page.waitForSelector('.safe-v', { timeout: 20000 });
await D.sync();
ok(await D.state(() => window.NZ.app.state.txs.length) === 88, 'PDF разобран: 88 операций');
ok(await count("SELECT count(*)::int AS n FROM records r JOIN users u ON u.id=r.user_id WHERE u.login='pdf@test.kz' AND r.kind='tx'") === 88, 'и все 88 на сервере');

ok(errors.length === 0, 'нет ошибок в консоли' + (errors.length ? ':\n    ' + errors.join('\n    ') : ''));
await browser.close();
server.close();
await db.close();
console.log('\nИтого: ' + passed + ' прошло, ' + failed + ' упало');
process.exit(failed ? 1 : 0);
