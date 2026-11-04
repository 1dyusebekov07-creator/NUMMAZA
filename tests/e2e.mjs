// Сквозной тест NUMMAZA в настоящем браузере (Playwright + Chromium).
// Запуск: node tests/e2e.mjs [путь к index.html] [папка для скриншотов]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import path from 'node:path';
import fs from 'node:fs';

const root = path.resolve(process.argv[2] || new URL('../app/index.html', import.meta.url).pathname);
const shots = process.argv[3] || '/tmp/nz-shots';
fs.mkdirSync(shots, { recursive: true });
const PDF = '/tmp/kaspi_sample.pdf';
const CSV = '/tmp/sample.csv';
const url = 'file://' + root;

let failed = 0; let passed = 0;
const ok = (cond, name) => { if (cond) { passed++; console.log('  ✓', name); } else { failed++; console.log('  ✗', name); } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'ru-RU' });
await ctx.addInitScript(() => { window.NZ = { _fakeToday: '2026-11-04' }; });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /i18n/.test(m.text()))) errors.push(m.type() + ': ' + m.text()); });
const text = () => page.locator('#app').innerText();
const shot = (n) => page.screenshot({ path: path.join(shots, n + '.png') });

console.log('1. Регистрация');
await page.goto(url);
ok(await page.getByRole('heading', { name: 'Создайте аккаунт' }).isVisible(), 'по умолчанию открыта регистрация');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
ok((await text()).includes('Введите имя') && (await text()).includes('Отметьте согласие'), 'ошибки пустой формы показаны');
await page.fill('#a-name', 'Айдана');
await page.fill('#a-login', '8 700 123 45 67');
await page.fill('#a-pw', 'nummaza2026');
await page.check('#a-agree');
await shot('01-signup');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
await page.waitForSelector('text=Добро пожаловать в NUMMAZA');
ok(true, 'аккаунт создан, открыт онбординг');

console.log('2. Онбординг');
await page.getByRole('button', { name: /Қазақша/ }).click();
ok((await text()).includes('NUMMAZA-ға қош келдіңіз'), 'язык переключается на казахский сразу');
await page.getByRole('button', { name: /Русский/ }).click();
await page.getByRole('button', { name: 'Ночная' }).click();
ok((await page.getAttribute('html', 'data-app-theme')) === 'dark', 'ночная тема включилась');
await shot('02-onb-dark');
await page.getByRole('button', { name: 'Дневная' }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.getByRole('button', { name: 'Далее' }).click();
ok((await text()).includes('Укажите доход больше 0'), 'без дохода дальше не пускает');
await page.fill('#o-income', '650000');
ok((await page.locator('#o-est').innerText()).includes('18'), 'дневной лимит пересчитывается на лету');
await page.getByRole('button', { name: '5', exact: true }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.getByRole('button', { name: /Подушка безопасности/ }).click();
await page.getByRole('button', { name: 'Далее' }).click();
await page.waitForSelector('text=Загрузите выписку Kaspi');
await page.setInputFiles('#file', PDF);
await page.waitForSelector('text=Сегодня можно потратить', { timeout: 15000 });
ok(true, 'PDF-выписка загружена в онбординге, открыт обзор');
await page.waitForTimeout(400);
await shot('03-home');

console.log('3. Обзор');
const st = await page.evaluate(() => { const s = window.NZ.app.state; return { n: s.txs.length, own: s.txs.filter((x) => x.own).length, sal: s.txs.filter((x) => x.cat === 'salary').length, cafe: s.txs.filter((x) => x.cat === 'cafe').length, env: Object.keys(s.envelopes).length, goals: s.goals.length }; });
ok(st.n === 88, 'распознаны все 88 операций из PDF (' + st.n + ')');
ok(st.own === 2 && st.sal === 2, 'переводы с депозита — не доход, зарплата распознана');
ok(st.cafe > 10, 'Glovo попал в «Кафе и доставка»');
ok(st.env > 3, 'лимиты конвертов предложены автоматически');
ok(st.goals === 1, 'цель из онбординга создана');
const safe = await page.locator('.safe-v').innerText();
ok(/\d/.test(safe) && safe.includes('₸'), '«Сегодня можно» посчитано: ' + safe.replace(/\s/g, ' '));
await page.locator('.safe-btn').click();
ok(await page.locator('.formula').isVisible(), 'формула раскрывается по нажатию');
await page.locator('.day:not([disabled])').first().click();
ok((await page.locator('.day[aria-pressed="true"]').count()) === 1, 'день календаря выбирается');
await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
ok((await text()).includes('октябрь'), 'календарь листается на прошлый месяц');
ok((await page.locator('.tip').count()) >= 1, 'советы Numa показаны: ' + (await page.locator('.tip').count()));
ok(await page.locator('.fab').isVisible(), 'кнопка «+» есть на обзоре');

console.log('4. Добавление операции и отмена');
await page.locator('.fab').click();
for (const k of ['3', '5', '0', '0']) await page.locator('.keypad [data-v="' + k + '"]').click();
ok((await page.locator('.amount output').innerText()).includes('3'), 'сумма набирается на клавиатуре');
ok(/останется|минус/.test(await page.locator('.amount .small').innerText()), 'подсказка по конверту считается вживую');
await page.locator('[data-a="addCat"][data-v="cafe"]').click();
await shot('04-add');
await page.getByRole('button', { name: 'Сохранить' }).click();
await page.waitForSelector('.toast-in');
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 89, 'трата сохранена');
await page.locator('.toast-in button').click();
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 88, '«Отменить» в тосте возвращает как было');
await page.locator('.fab').click();
await page.locator('.keypad [data-v="7"]').click();
await page.keyboard.press('Escape');
await page.locator('.fab').click();
ok((await page.locator('.amount output').innerText()).includes('7'), 'черновик восстанавливается после закрытия');
await page.keyboard.press('Escape');
await page.evaluate(() => { const s = window.NZ.app.state; s.draft = null; });

console.log('5. Выписки: дубликаты и CSV');
await page.goto(url + '#statements');
await page.setInputFiles('#file', PDF);
await page.waitForSelector('text=Уже были загружены', { timeout: 15000 });
ok(true, 'повторная выписка — дубликаты пропущены');
await page.setInputFiles('#file', CSV);
await page.waitForFunction(() => window.NZ.app.state.txs.some((x) => /starbucks/i.test(x.raw)), null, { timeout: 15000 });
const csv = await page.evaluate(() => window.NZ.app.state.txs.filter((x) => /starbucks|wildberries/i.test(x.raw)).map((x) => x.cat).join(','));
ok(csv === 'cafe,refund', 'CSV разобран, категории верные (' + csv + ')');
const badFile = { name: 'photo.png', mimeType: 'image/png', buffer: Buffer.from('x') };
await page.setInputFiles('#file', badFile);
ok((await text()).includes('Это не PDF и не CSV'), 'не тот файл — понятная ошибка');
await shot('05-statements');

console.log('6. Исправление категории');
await page.goto(url + '#ops');
await page.getByRole('button', { name: 'проверьте', exact: true }).click();
const reviewN = await page.locator('.li-btn').count();
ok(reviewN >= 1, 'фильтр «проверьте» находит сомнительные операции: ' + reviewN);
await page.locator('.li-btn').first().click();
await page.locator('[data-a="setCat"][data-v="shopping"]').click();
ok((await page.locator('.toast-in').innerText()).includes('Запомнила'), 'категория исправлена и запомнена как правило');
ok(await page.evaluate(() => Object.keys(window.NZ.app.state.rules).length) === 1, 'правило сохранено');

console.log('7. Конверты');
await page.goto(url + '#envelopes');
ok((await page.locator('.env').count()) >= 3, 'конверты показаны');
await page.locator('.env').first().click();
await page.fill('#env-lim', '99000000');
await page.getByRole('button', { name: 'Сохранить' }).click();
ok((await page.locator('.sheet').innerText()).includes('не может быть больше дохода'), 'лимит выше дохода не даёт сохранить');
await page.fill('#env-lim', '150000');
await page.getByRole('button', { name: 'Сохранить' }).click();
ok((await page.locator('.toast-in').innerText()).includes('Лимиты обновлены'), 'лимит сохранён');
await page.getByRole('button', { name: 'Перерасход', exact: true }).click();
await shot('06-envelopes');

console.log('8. Numa');
await page.goto(url + '#numa');
for (let i = 0; i < 6; i++) {
  await page.locator('[data-a="ask"]').nth(i).click();
  await page.waitForFunction((n) => document.querySelectorAll('.msg-n:not(.thinking)').length >= n, i + 1);
}
const answers = await page.locator('.msg-n:not(.thinking)').allInnerTexts();
ok(answers.length === 6 && answers.every((a) => a.length > 20), 'Numa ответила на все 6 готовых вопросов');
ok(answers[0].includes('доход') && answers[0].includes('₸'), 'ответ о бюджете с суммами');
ok(/Подписк|подписк/.test(answers[4]) && answers[4].includes('2'), 'нашла подписку Netflix');
ok(answers[5].includes('не инвестиционный совет'), 'про депозиты — с оговоркой');
await page.fill('#q', 'сколько я трачу на такси?');
await page.press('#q', 'Enter');
await page.waitForFunction(() => document.querySelectorAll('.msg-n:not(.thinking)').length >= 7);
ok((await page.locator('.msg-n:not(.thinking)').last().innerText()).includes('Транспорт'), 'свободный вопрос про такси понят');
await page.locator('.basis summary').last().click();
ok((await page.locator('.basis').last().innerText()).includes('на устройстве'), '«На чём основан ответ» раскрывается');
await shot('07-numa');

console.log('9. Цели');
await page.goto(url + '#goals');
await page.getByRole('button', { name: '+ Цель' }).click();
await page.getByRole('button', { name: 'Создать цель' }).click();
ok((await page.locator('.sheet').innerText()).includes('Введите название'), 'пустую цель создать нельзя');
await page.fill('#g-name', 'Ноутбук');
await page.fill('#g-target', '100000');
await page.locator('#g-target').dispatchEvent('input');
ok((await page.locator('#g-hint').innerText()).includes('в месяц'), 'подсказка по взносу считается');
await page.getByRole('button', { name: 'Создать цель' }).click();
await page.locator('.goal').filter({ hasText: 'Ноутбук' }).getByRole('button', { name: 'Пополнить' }).click();
await page.fill('#ga-amt', '60000');
await page.locator('.sheet').getByRole('button', { name: 'Пополнить' }).click();
ok((await page.locator('.toast-in').innerText()).includes('50% пути'), 'отметка 50% пути');
await page.locator('.goal').filter({ hasText: 'Ноутбук' }).getByRole('button', { name: 'Пополнить' }).click();
await page.fill('#ga-amt', '40000');
await page.locator('.sheet').getByRole('button', { name: 'Пополнить' }).click();
ok(await page.getByRole('heading', { name: 'Цель достигнута!' }).isVisible(), 'экран-поздравление на 100%');
await shot('08-goal-done');
await page.keyboard.press('Escape');

console.log('10. Итоги месяца');
await page.goto(url + '#recap');
ok((await text()).toLowerCase().includes('итоги месяца') && (await text()).toLowerCase().includes('октябрь'), 'итоги за октябрь открыты');
for (let i = 0; i < 4; i++) await page.locator('.tap-r').click();
ok((await text()).includes('Поставить цель на месяц'), 'последняя карточка с действием');
await shot('09-recap');

console.log('11. Профиль, язык, тема, данные');
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="en"]').click();
ok((await page.locator('.tabbar').innerText()).includes('Overview'), 'интерфейс на английском');
await page.locator('[data-a="lang"][data-v="kk"]').click();
ok((await page.locator('.tabbar').innerText()).includes('Шолу'), 'интерфейс на казахском');
for (const r of ['home', 'envelopes', 'numa', 'goals', 'statements', 'ops', 'recap']) { await page.goto(url + '#' + r); await page.waitForTimeout(80); }
await page.goto(url + '#home');
await shot('10-home-kk');
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="en"]').click();
for (const r of ['home', 'envelopes', 'numa', 'goals', 'statements', 'ops', 'recap']) { await page.goto(url + '#' + r); await page.waitForTimeout(80); }
await page.goto(url + '#profile');
await page.locator('[data-a="lang"][data-v="ru"]').click();
await page.locator('[data-a="theme"][data-v="dark"]').click();
await page.goto(url + '#home');
await shot('11-home-dark');
await page.goto(url + '#profile');
await page.fill('#p-income', '700000');
await page.locator('#p-income').dispatchEvent('change');
ok((await page.locator('.toast-in').innerText()).includes('Лимит обновлён'), 'смена дохода пересчитывает лимит');
await page.locator('[data-a="notif"][data-v="tips"]').click();
await page.goto(url + '#home');
ok((await page.locator('.tip').count()) === 0, 'советы отключаются в профиле');

console.log('12. Выход и вход');
await page.goto(url + '#profile');
await page.getByRole('button', { name: 'Выйти' }).click();
await page.fill('#a-login', '+77001234567');
await page.fill('#a-pw', 'wrongpass1');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForSelector('.err-box');
ok((await text()).includes('Осталось попыток: 4'), 'неверный пароль — понятная ошибка с попытками');
await page.fill('#a-login', '87001234567');
await page.fill('#a-pw', 'nummaza2026');
await page.getByRole('button', { name: 'Войти' }).click();
await page.waitForSelector('.safe-v');
ok(true, 'вход по паролю работает, данные на месте');

console.log('13. Компьютер');
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto(url + '#home');
await page.waitForTimeout(200);
ok(await page.locator('.tabbar .brand').isVisible(), 'на широком экране — боковое меню');
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
ok(!overflow, 'нет горизонтальной прокрутки');
await shot('12-desktop-dark');
await page.setViewportSize({ width: 390, height: 844 });

console.log('14. Удаление аккаунта');
await page.goto(url + '#delete');
ok(await page.locator('#del-btn').isDisabled(), 'кнопка неактивна без слова-подтверждения');
await page.fill('#del-w', 'удалить');
ok(!(await page.locator('#del-btn').isDisabled()), 'после ввода слова — активна');
await page.locator('#del-btn').click();
await page.waitForSelector('text=Создайте аккаунт');
ok(await page.evaluate(() => localStorage.getItem('nummaza.v1') === null || JSON.parse(localStorage.getItem('nummaza.v1')).account === null), 'все данные удалены');

console.log('15. Пример данных без файла');
await page.fill('#a-name', 'Тест'); await page.fill('#a-login', 'test@example.com'); await page.fill('#a-pw', 'abcd1234'); await page.check('#a-agree');
await page.getByRole('button', { name: 'Создать аккаунт' }).click();
for (let i = 0; i < 3; i++) { await page.waitForSelector('[data-a="onbNext"]'); if (i === 1) await page.fill('#o-income', '400000'); await page.locator('[data-a="onbNext"]').click(); }
await page.getByRole('button', { name: 'Попробовать на примере' }).click();
await page.waitForSelector('.safe-v');
ok((await text()).includes('пример данных'), 'пример данных загружен и помечен');
await page.getByRole('button', { name: 'Удалить пример' }).click();
ok(await page.evaluate(() => window.NZ.app.state.txs.length) === 0, 'пример удаляется одной кнопкой');

const missing = await page.evaluate(() => window.NZ.missing);
ok(missing.length === 0, 'нет непереведённых строк' + (missing.length ? ': ' + missing.join(', ') : ''));
ok(errors.length === 0, 'нет ошибок в консоли' + (errors.length ? ':\n    ' + errors.join('\n    ') : ''));
await browser.close();
console.log('\nИтого: ' + passed + ' прошло, ' + failed + ' упало');
process.exit(failed ? 1 : 0);
