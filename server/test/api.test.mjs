// Тесты API NUMMAZA: node --test test/   (база PGlite в памяти, настоящий HTTP)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../db.js';
import { createApp } from '../app.js';

let db, server, base;
before(async () => {
  // TEST_DATABASE_URL — прогнать на настоящем PostgreSQL (база должна быть пустой)
  db = await openDb(process.env.TEST_DATABASE_URL ? { url: process.env.TEST_DATABASE_URL } : { pglite: true });
  server = createApp(db, { allowedOrigins: ['https://nummaza.example'], authLimit: 1000 }).listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { server.close(); await db.close(); });

async function call(method, path, body, token, headers = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null, headers: res.headers };
}
const register = (login, password = 'nummaza2026', name = 'Айдана') => call('POST', '/api/auth/register', { name, login, password });

test('здоровье и 404', async () => {
  assert.equal((await call('GET', '/api/health')).status, 200);
  assert.equal((await call('GET', '/api/nope')).status, 404);
});

test('регистрация: проверка полей', async () => {
  const r = await call('POST', '/api/auth/register', { name: '', login: '123', password: 'short' });
  assert.equal(r.status, 400);
  assert.deepEqual(Object.keys(r.body.fields).sort(), ['login', 'name', 'password']);
  const r2 = await call('POST', '/api/auth/register', { name: 'А', login: 'a@b.kz', password: 'onlyletters' });
  assert.equal(r2.status, 400);
  assert.ok(r2.body.fields.password);
});

test('регистрация, нормализация телефона и занятый логин', async () => {
  const r = await register('8 700 111 22 33');
  assert.equal(r.status, 201);
  assert.equal(r.body.user.login, '+77001112233');
  assert.ok(r.body.accessToken && r.body.refreshToken);
  const again = await register('+7 (700) 111-22-33');
  assert.equal(again.status, 409);
  assert.equal(again.body.error, 'login_taken');
});

test('пароль хранится не открытым текстом', async () => {
  await register('hash@test.kz', 'secretpass1');
  const { rows } = await db.query("SELECT pass_hash FROM users WHERE login='hash@test.kz'");
  assert.match(rows[0].pass_hash, /^scrypt\$/);
  assert.ok(!rows[0].pass_hash.includes('secretpass1'));
  const t = await db.query('SELECT access_hash FROM sessions LIMIT 1');
  assert.equal(t.rows[0].access_hash.length, 64); // только SHA-256 токена
});

test('вход, неверный пароль, блокировка после 5 ошибок', async () => {
  await register('lock@test.kz');
  const ok = await call('POST', '/api/auth/login', { login: 'LOCK@test.kz', password: 'nummaza2026' });
  assert.equal(ok.status, 200);
  for (let i = 1; i <= 4; i++) {
    const r = await call('POST', '/api/auth/login', { login: 'lock@test.kz', password: 'wrongpass1' });
    assert.equal(r.status, 401);
    assert.equal(r.body.attemptsLeft, 5 - i);
  }
  const fifth = await call('POST', '/api/auth/login', { login: 'lock@test.kz', password: 'wrongpass1' });
  assert.equal(fifth.status, 423);
  const blocked = await call('POST', '/api/auth/login', { login: 'lock@test.kz', password: 'nummaza2026' });
  assert.equal(blocked.status, 423, 'даже верный пароль не пускает во время блокировки');
  const unknown = await call('POST', '/api/auth/login', { login: 'nobody@test.kz', password: 'nummaza2026' });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.body.attemptsLeft, undefined);
});

test('токены: 401 без токена, ротация refresh, выход', async () => {
  const r = await register('tok@test.kz');
  assert.equal((await call('GET', '/api/me')).status, 401);
  assert.equal((await call('GET', '/api/me', undefined, 'garbage')).status, 401);
  const me = await call('GET', '/api/me', undefined, r.body.accessToken);
  assert.equal(me.body.user.name, 'Айдана');
  const ref = await call('POST', '/api/auth/refresh', { refreshToken: r.body.refreshToken });
  assert.equal(ref.status, 200);
  assert.equal((await call('POST', '/api/auth/refresh', { refreshToken: r.body.refreshToken })).status, 401, 'старый refresh больше не работает');
  assert.equal((await call('GET', '/api/me', undefined, r.body.accessToken)).status, 401, 'старый access больше не работает');
  assert.equal((await call('GET', '/api/me', undefined, ref.body.accessToken)).status, 200);
  assert.equal((await call('POST', '/api/auth/logout', {}, ref.body.accessToken)).status, 200);
  assert.equal((await call('GET', '/api/me', undefined, ref.body.accessToken)).status, 401);
  assert.equal((await call('POST', '/api/auth/refresh', { refreshToken: ref.body.refreshToken })).status, 401);
});

test('синхронизация: отправка, получение, второе устройство, курсор', async () => {
  const a = (await register('sync@test.kz')).body.accessToken;
  const b = (await call('POST', '/api/auth/login', { login: 'sync@test.kz', password: 'nummaza2026' })).body.accessToken;
  const tx = { kind: 'tx', id: 't1', data: { date: '2026-11-04', amount: -3500, cat: 'cafe' }, updatedAt: 1000 };
  const r1 = await call('POST', '/api/sync', { cursor: 0, changes: [tx] }, a);
  assert.equal(r1.status, 200);
  assert.equal(r1.body.applied, 1);
  const r2 = await call('POST', '/api/sync', { cursor: 0, changes: [] }, b);
  assert.equal(r2.body.changes.length, 1);
  assert.deepEqual(r2.body.changes[0].data, tx.data);
  const r3 = await call('POST', '/api/sync', { cursor: r2.body.cursor, changes: [] }, b);
  assert.equal(r3.body.changes.length, 0, 'после курсора ничего нового');
});

test('синхронизация: «последняя запись побеждает» и удаление', async () => {
  const a = (await register('lww@test.kz')).body.accessToken;
  await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'goal', id: 'g', data: { saved: 100 }, updatedAt: 2000 }] }, a);
  const old = await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'goal', id: 'g', data: { saved: 1 }, updatedAt: 1500 }] }, a);
  assert.equal(old.body.applied, 0, 'более старое изменение не перезаписывает новое');
  assert.equal(old.body.changes.find((c) => c.id === 'g').data.saved, 100);
  const del = await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'goal', id: 'g', deleted: true, updatedAt: 3000 }] }, a);
  const g = del.body.changes.find((c) => c.id === 'g');
  assert.equal(g.deleted, true);
});

test('синхронизация: данные одного пользователя не видны другому, проверка входа', async () => {
  const a = (await register('iso1@test.kz')).body.accessToken;
  const b = (await register('iso2@test.kz')).body.accessToken;
  await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'tx', id: 'secret', data: { amount: -1 }, updatedAt: 1 }] }, a);
  const rb = await call('POST', '/api/sync', { cursor: 0, changes: [] }, b);
  assert.equal(rb.body.changes.length, 0);
  assert.equal((await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'hack', id: 'x', data: {}, updatedAt: 1 }] }, a)).status, 400);
  assert.equal((await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'tx', id: 'x', data: { s: 'x'.repeat(30000) }, updatedAt: 1 }] }, a)).status, 400);
  assert.equal((await call('POST', '/api/sync', { cursor: 0, changes: [] })).status, 401);
});

test('удаление аккаунта стирает данные и сессии', async () => {
  const a = (await register('del@test.kz')).body.accessToken;
  await call('POST', '/api/sync', { cursor: 0, changes: [{ kind: 'tx', id: 't', data: { amount: -5 }, updatedAt: 1 }] }, a);
  assert.equal((await call('DELETE', '/api/me', undefined, a)).status, 200);
  assert.equal((await call('GET', '/api/me', undefined, a)).status, 401);
  const { rows } = await db.query("SELECT count(*)::int AS n FROM users WHERE login='del@test.kz'");
  assert.equal(rows[0].n, 0);
  assert.equal((await register('del@test.kz')).status, 201, 'логин снова свободен');
});

test('CORS: свой сайт и Android (origin null) — да, чужой — нет', async () => {
  const pre = (origin) => fetch(base + '/api/auth/login', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' } });
  assert.equal((await pre('https://nummaza.example')).headers.get('access-control-allow-origin'), 'https://nummaza.example');
  assert.equal((await pre('null')).headers.get('access-control-allow-origin'), 'null');
  assert.equal((await pre('https://evil.example')).headers.get('access-control-allow-origin'), null);
});

test('ошибочный JSON и ограничение частоты', async () => {
  const bad = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
  const app2 = createApp(db, { authLimit: 3 }).listen(0);
  const b2 = `http://127.0.0.1:${app2.address().port}`;
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await fetch(b2 + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status);
  app2.close();
  assert.deepEqual(codes.slice(-2), [429, 429]);
});

test('веб-приложение раздаётся с адресом API = этот же сайт', async () => {
  const html = await fetch(base + '/');
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-security-policy'), /default-src 'self'/);
  const cfg = await (await fetch(base + '/js/config.js')).text();
  assert.match(cfg, /API_URL = location\.origin/);
});
