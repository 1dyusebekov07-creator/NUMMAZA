/* NUMMAZA — синхронизация с сервером.
   При каждом сохранении состояние сравнивается с прошлым: изменённые и удалённые записи
   попадают в очередь S.sync.outbox. Очередь отправляется на сервер (через 2 с после изменения,
   при запуске, при появлении интернета, раз в минуту), в ответ приходят изменения с других устройств.
   Конфликты решаются правилом «последняя запись (по времени изменения) побеждает».
   Переписка с Numa и черновики не синхронизируются. */
(function () {
  'use strict';
  const NZ = window.NZ;

  // Состояние → записи для синхронизации: ключ "вид:id" → данные
  function records(s) {
    const m = new Map();
    s.txs.forEach((x) => m.set('tx:' + x.id, x));
    s.goals.forEach((x) => m.set('goal:' + x.id, x));
    s.imports.forEach((x) => m.set('import:' + x.id, x));
    Object.keys(s.envelopes).forEach((c) => m.set('envelope:' + c, { limit: s.envelopes[c] }));
    Object.keys(s.rules).forEach((k) => m.set('rule:' + k, { cat: s.rules[k] }));
    const p = s.profile;
    m.set('profile:main', { lang: p.lang, theme: p.theme, income: p.income, payday: p.payday, notif: p.notif, onboarded: p.onboarded, dismissed: s.dismissed, demo: !!s.demo });
    return m;
  }
  const hashes = (s) => { const h = new Map(); records(s).forEach((v, k) => h.set(k, JSON.stringify(v))); return h; };
  const split = (k) => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; };

  let base = null; // снимок записей на момент последнего сохранения

  NZ.syncResetBase = function (s) { base = s && s.sync ? hashes(s) : null; };

  function enqueue(s, key, data, deleted) {
    const [kind, id] = split(key);
    const item = { kind, id, updatedAt: Math.max(Date.now(), (s.sync.clock || 0) + 1), deleted: !!deleted };
    s.sync.clock = item.updatedAt;
    if (!deleted) item.data = JSON.parse(JSON.stringify(data));
    s.sync.outbox = s.sync.outbox.filter((o) => !(o.kind === kind && o.id === id));
    s.sync.outbox.push(item);
  }

  // Вызывается из NZ.save(): находит изменения и кладёт их в очередь
  NZ.syncTrack = function (s) {
    if (!s.sync || !s.account || !s.account.server) { base = null; return; }
    const now = hashes(s);
    if (!base) { base = now; return; }
    const rec = records(s);
    let n = 0;
    now.forEach((h, k) => { if (base.get(k) !== h) { enqueue(s, k, rec.get(k), false); n++; } });
    base.forEach((h, k) => { if (!now.has(k)) { enqueue(s, k, null, true); n++; } });
    base = now;
    if (n) schedule(2000);
  };

  // Всё текущее — в очередь (после регистрации с уже введёнными данными)
  NZ.syncEnqueueAll = function (s) {
    records(s).forEach((v, k) => enqueue(s, k, v, false));
    base = hashes(s);
  };

  // Применить изменения с сервера; возвращает, сколько записей реально изменилось
  function apply(s, changes) {
    let changed = 0;
    changes.forEach((c) => {
      const key = c.kind + ':' + c.id;
      const mine = s.sync.outbox.find((o) => o.kind === c.kind && o.id === c.id);
      if (mine && mine.updatedAt > c.updatedAt) return; // наше изменение новее — оно уйдёт на сервер
      if (mine && mine.updatedAt <= c.updatedAt) s.sync.outbox = s.sync.outbox.filter((o) => o !== mine);
      const before = base ? base.get(key) : undefined;
      const after = c.deleted ? undefined : JSON.stringify(c.data);
      if (before === after) return;
      changed++;
      const list = { tx: 'txs', goal: 'goals', import: 'imports' }[c.kind];
      if (list) {
        const i = s[list].findIndex((x) => x.id === c.id);
        if (c.deleted) { if (i >= 0) s[list].splice(i, 1); }
        else { const v = Object.assign({}, c.data, { id: c.id }); if (i >= 0) s[list][i] = v; else s[list].push(v); }
      } else if (c.kind === 'envelope') {
        if (c.deleted) delete s.envelopes[c.id]; else s.envelopes[c.id] = c.data.limit;
      } else if (c.kind === 'rule') {
        if (c.deleted) delete s.rules[c.id]; else s.rules[c.id] = c.data.cat;
      } else if (c.kind === 'profile' && !c.deleted) {
        const d = c.data;
        ['lang', 'theme', 'income', 'payday', 'notif', 'onboarded'].forEach((f) => { if (d[f] !== undefined) s.profile[f] = d[f]; });
        s.dismissed = d.dismissed || {};
        s.demo = !!d.demo;
      }
    });
    if (changed) s.txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return changed;
  }

  let running = false; let again = false; let timer = null;
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(run, ms); }

  // Перерисовка без потери ввода: если человек печатает, ждём, пока он выйдет из поля
  function safeRender() {
    const a = document.activeElement;
    if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) { a.addEventListener('blur', () => setTimeout(() => NZ.app.render(), 0), { once: true }); return; }
    NZ.app.render();
  }

  async function run() {
    const s0 = NZ.app && NZ.app.state;
    if (!s0 || !s0.sync || !s0.session || !NZ.api || !NZ.api.enabled() || !NZ.api.hasSession()) return { skipped: true };
    if (running) { again = true; return { busy: true }; }
    running = true;
    let total = 0;
    try {
      let more = true;
      while (more) {
        const s = NZ.app.state;
        const sent = s.sync.outbox.slice(0, 500);
        const r = await NZ.api.sync({ cursor: s.sync.cursor || 0, changes: sent });
        const cur = NZ.app.state; // за время запроса состояние могло смениться (например, «Отменить»)
        if (!cur.sync) return { skipped: true };
        cur.sync.outbox = cur.sync.outbox.filter((o) => !sent.some((x) => x.kind === o.kind && x.id === o.id && x.updatedAt === o.updatedAt));
        total += apply(cur, r.changes);
        cur.sync.cursor = r.cursor;
        cur.sync.lastAt = Date.now();
        cur.sync.error = null;
        NZ.syncResetBase(cur);
        NZ.save(cur);
        more = r.more || cur.sync.outbox.length > 0 && sent.length === 500;
      }
      safeRender();
      return { ok: true, changed: total };
    } catch (e) {
      const cur = NZ.app.state;
      if (e.code === 'session_expired') {
        cur.session = false;
        NZ.save(cur);
        if (NZ.app.onSessionExpired) NZ.app.onSessionExpired();
      } else if (cur.sync) {
        cur.sync.error = e.code || 'error';
        NZ.save(cur);
        if (NZ.app.ui.route === 'profile') safeRender();
      }
      return { error: e.code };
    } finally {
      running = false;
      if (again) { again = false; schedule(300); }
    }
  }

  NZ.sync = { run, schedule };
  window.addEventListener('online', () => schedule(500));
  setInterval(() => { if (navigator.onLine !== false) run(); }, 60000);
})();
