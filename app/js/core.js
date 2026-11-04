/* NUMMAZA — ядро: категории, хранилище, даты, расчёты бюджета.
   Без зависимостей. Всё доступно через window.NZ. */
(function () {
  'use strict';
  const NZ = (window.NZ = window.NZ || {});

  /* ---------- Категории ---------- */
  // color — для диаграмм и полосок (читаются на светлом и тёмном фоне)
  NZ.CATS = {
    groceries:    { kind: 'exp', color: '#1F8577' },
    cafe:         { kind: 'exp', color: '#E8A317' },
    transport:    { kind: 'exp', color: '#4C7BD9' },
    shopping:     { kind: 'exp', color: '#8B6BD6' },
    home:         { kind: 'exp', color: '#5E8C99' },
    health:       { kind: 'exp', color: '#D9668B' },
    subs:         { kind: 'exp', color: '#E07A3F' },
    installments: { kind: 'exp', color: '#A07850' },
    transfers:    { kind: 'exp', color: '#2FA3B5' },
    gifts:        { kind: 'exp', color: '#8AA33B' },
    other:        { kind: 'exp', color: '#8A939E' },
    salary:       { kind: 'inc', color: '#1F8577' },
    transfer_in:  { kind: 'inc', color: '#2FA3B5' },
    side:         { kind: 'inc', color: '#4C7BD9' },
    refund:       { kind: 'inc', color: '#8B6BD6' },
    cashback:     { kind: 'inc', color: '#E8A317' },
    other_in:     { kind: 'inc', color: '#8A939E' }
  };
  NZ.EXP_CATS = Object.keys(NZ.CATS).filter((k) => NZ.CATS[k].kind === 'exp');
  NZ.INC_CATS = Object.keys(NZ.CATS).filter((k) => NZ.CATS[k].kind === 'inc');
  // Категории, которые пользователь выбирает вручную (без «переводов» и «рассрочек» — их распознаёт выписка)
  NZ.MANUAL_EXP = ['groceries', 'cafe', 'transport', 'shopping', 'home', 'health', 'gifts', 'other'];
  NZ.MANUAL_INC = ['salary', 'transfer_in', 'side', 'refund', 'cashback', 'other_in'];

  // Правила распознавания магазинов: [регулярное выражение, категория]
  NZ.MERCHANT_RULES = [
    [/magnum|small\b|смолл|galmart|metro\s*cash|анвар|anvar|ramstore|toimart|arbuz|interfood|astykzhan|супермаркет|продукт|minimarket|минимаркет/i, 'groceries'],
    [/glovo|wolt|yandex\s*(eda|еда)|яндекс\s*еда|chocofood|starbucks|coffee|кофе|kfc|burger|mcdonald|dodo|пицц|pizza|кафе|cafe|ресторан|restaurant|bahandi|salam\s*bro|del\s*papa|lanzhou|sushi|суши|донер|doner|шаурм/i, 'cafe'],
    [/yandex\.?\s*go|яндекс\s*(go|такси)|indrive|onay|avtobys|автобус|bolt|uber|такси|taxi|азс|qazaq\s*oil|helios|sinooil|kmg|gazprom|парковк|parking|метро\b/i, 'transport'],
    [/kaspi\s*(магазин|shop|maga)|wildberries|ozon|technodom|sulpak|mechta|zara|lc\s*waikiki|lamoda|alser|dns|flip\.kz|marwin|meloman|ikea|leroy|decathlon|h&m|adidas|nike/i, 'shopping'],
    [/alseco|алсеко|ерц|astana[\s-]*energo|almaty[\s-]*energo|алматыэнерго|казахтелеком|kazakhtelecom|beeline|kcell|activ|tele2|altel|коммун|ivc|ивц|су\s*арнасы|водоканал|газ\b|qazaqgaz|аренд|rent/i, 'home'],
    [/аптек|apteka|europharma|биосфер|biosfera|клиник|clinic|invitro|инвитро|олимп|med\b|медцентр|стоматолог|dental/i, 'health'],
    [/netflix|spotify|apple\.com|itunes|google\s*(play|one)|youtube|yandex\s*plus|яндекс\s*плюс|кинопоиск|kinopoisk|ivi\b|megogo|chatgpt|openai|icloud|subscription|подписк/i, 'subs'],
    [/kaspi\s*red|рассрочк|кредит|погашение|loan|halyk\s*кредит/i, 'installments'],
    [/цвет|flowers|подар|gift/i, 'gifts']
  ];

  NZ.merchantKey = function (s) {
    return String(s || '').toLowerCase().replace(/[^a-zа-яёәғқңөұүһі0-9]+/gi, ' ').trim().split(' ').slice(0, 3).join(' ');
  };

  /* ---------- Даты ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  NZ.iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  NZ.parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  NZ.addDays = (s, n) => { const d = NZ.parseISO(s); d.setDate(d.getDate() + n); return NZ.iso(d); };
  NZ.daysBetween = (a, b) => Math.round((NZ.parseISO(b) - NZ.parseISO(a)) / 86400000);
  NZ.today = () => NZ._fakeToday || NZ.iso(new Date());
  NZ.ym = (s) => s.slice(0, 7);
  NZ.addMonths = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return d.getFullYear() + '-' + pad(d.getMonth() + 1); };
  NZ.daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
  NZ.weekdayMon0 = (s) => (NZ.parseISO(s).getDay() + 6) % 7; // 0 = понедельник

  // Период бюджета: от последнего дня зарплаты (включительно) до следующего (не включая)
  NZ.period = function (today, payday) {
    const pd = Math.min(Math.max(1, payday | 0 || 1), 28);
    const t = NZ.parseISO(today);
    let start = new Date(t.getFullYear(), t.getMonth(), pd);
    if (start > t) start = new Date(t.getFullYear(), t.getMonth() - 1, pd);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, pd);
    return { start: NZ.iso(start), end: NZ.iso(end), days: NZ.daysBetween(NZ.iso(start), NZ.iso(end)), daysLeft: NZ.daysBetween(today, NZ.iso(end)) };
  };

  /* ---------- Хранилище ---------- */
  const KEY = 'nummaza.v1';
  NZ.defaultState = function () {
    return {
      v: 1,
      account: null, // { name, login, salt, hash, createdAt }
      session: false,
      auth: { fails: 0, lockedUntil: 0 },
      profile: { lang: null, theme: 'system', income: 0, payday: 5, carry: 'next', onboarded: false, onbStep: 0, notif: { limit: true, pay: true, week: true, tips: true } },
      txs: [],
      imports: [],
      envelopes: {},
      goals: [],
      rules: {},
      chat: [],
      draft: null,
      dismissed: {},
      demo: false
    };
  };
  NZ.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return NZ.defaultState();
      const s = JSON.parse(raw);
      const d = NZ.defaultState();
      return Object.assign(d, s, { profile: Object.assign(d.profile, s.profile || {}), auth: Object.assign(d.auth, s.auth || {}) });
    } catch (e) { return NZ.defaultState(); }
  };
  NZ.save = function (s) { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; } };
  NZ.wipe = function () { try { localStorage.removeItem(KEY); } catch (e) { /* хранилище недоступно */ } };
  NZ.uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

  NZ.hash = async function (salt, pw) {
    const data = new TextEncoder().encode(salt + ':' + pw);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Резерв для окружений без SubtleCrypto (старые WebView по file://)
    let h = 2166136261;
    for (const b of data) { h ^= b; h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  };

  /* ---------- Выборки операций ---------- */
  NZ.isSpend = (t) => t.amount < 0 && !t.own;
  NZ.inRange = (t, a, b) => t.date >= a && t.date < b;
  NZ.sum = (arr, f) => arr.reduce((s, x) => s + (f ? f(x) : x), 0);
  NZ.spendIn = (txs, a, b) => txs.filter((t) => NZ.isSpend(t) && NZ.inRange(t, a, b));
  NZ.byCat = function (txs) {
    const m = {};
    txs.forEach((t) => { m[t.cat] = (m[t.cat] || 0) - t.amount; });
    return m;
  };

  /* ---------- Регулярные платежи ---------- */
  // Магазин считается регулярным, если платёж был минимум в 2 из последних 3 месяцев и суммы отличаются не больше чем на 20%
  NZ.recurring = function (txs, today) {
    const from = NZ.addMonths(NZ.ym(today), -3) + '-01';
    const groups = {};
    txs.filter((t) => NZ.isSpend(t) && t.date >= from && t.date < today && ['subs', 'home', 'installments'].includes(t.cat)).forEach((t) => {
      const k = NZ.merchantKey(t.merchant || t.raw);
      (groups[k] = groups[k] || []).push(t);
    });
    const out = [];
    Object.keys(groups).forEach((k) => {
      const g = groups[k];
      const months = new Set(g.map((t) => NZ.ym(t.date)));
      if (months.size < 2) return;
      const amts = g.map((t) => -t.amount);
      const avg = NZ.sum(amts) / amts.length;
      if (amts.some((a) => Math.abs(a - avg) / avg > 0.2)) return;
      const days = g.map((t) => +t.date.slice(8)).sort((a, b) => a - b);
      out.push({ key: k, merchant: g[g.length - 1].merchant, cat: g[0].cat, amount: Math.round(avg / months.size * (g.length / months.size > 1.5 ? 1 : 1)), perMonth: Math.round(NZ.sum(amts) / months.size), day: days[Math.floor(days.length / 2)], last: g.map((t) => t.date).sort().pop() });
    });
    return out;
  };

  // Обязательные платежи, которые ещё будут до конца периода
  NZ.upcoming = function (state, today) {
    const p = NZ.period(today, state.profile.payday);
    const rec = NZ.recurring(state.txs, today);
    const list = [];
    rec.forEach((r) => {
      // Дата платежа в текущем периоде
      const ymNow = NZ.ym(today);
      const candidates = [ymNow, NZ.addMonths(ymNow, 1)].map((ym) => ym + '-' + String(Math.min(r.day, NZ.daysInMonth(ym))).padStart(2, '0'));
      const due = candidates.find((d) => d >= today && d < p.end);
      if (!due) return;
      const paidThisPeriod = state.txs.some((t) => NZ.isSpend(t) && t.date >= p.start && NZ.merchantKey(t.merchant || t.raw) === r.key);
      if (paidThisPeriod && due.slice(0, 7) === NZ.ym(today) && r.last >= p.start) return;
      list.push({ merchant: r.merchant, cat: r.cat, amount: r.perMonth, date: due });
    });
    return list.sort((a, b) => (a.date < b.date ? -1 : 1));
  };

  /* ---------- Цели ---------- */
  NZ.goalContributedIn = (g, a, b) => NZ.sum((g.history || []).filter((h) => h.date >= a && h.date < b), (h) => h.amount);
  NZ.goalStatus = function (g, today) {
    if (g.saved >= g.target) return { status: 'done', pct: 100, needMonthly: 0, monthsLeft: 0 };
    const created = g.createdAt || today;
    const total = Math.max(1, NZ.daysBetween(created, g.deadline));
    const passed = Math.min(total, Math.max(0, NZ.daysBetween(created, today)));
    const planned = g.startSaved + (g.target - g.startSaved) * (passed / total);
    const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
    const monthsLeft = Math.max(1, Math.ceil(NZ.daysBetween(today, g.deadline) / 30.4));
    const needMonthly = Math.ceil((g.target - g.saved) / monthsLeft / 1000) * 1000;
    const diff = (g.saved - planned) / g.target;
    const status = diff > 0.05 ? 'ahead' : diff < -0.05 ? 'behind' : 'on';
    return { status, pct, needMonthly, monthsLeft };
  };

  /* ---------- «Сегодня можно потратить» ---------- */
  NZ.safeToday = function (state, today) {
    const pr = state.profile;
    const p = NZ.period(today, pr.payday);
    const income = pr.income || 0;
    const up = NZ.upcoming(state, today);
    const upcoming = NZ.sum(up, (u) => u.amount);
    const savings = NZ.sum(state.goals.filter((g) => g.saved < g.target), (g) => Math.max(g.monthly || 0, NZ.goalContributedIn(g, p.start, p.end)));
    const spentBefore = NZ.sum(NZ.spendIn(state.txs, p.start, today), (t) => -t.amount);
    const spentToday = NZ.sum(NZ.spendIn(state.txs, today, NZ.addDays(today, 1)), (t) => -t.amount);
    const daysLeft = Math.max(1, p.daysLeft);
    const pool = income - upcoming - savings - spentBefore;
    const perDay = pool / daysLeft;
    const value = Math.floor((perDay - spentToday) / 10) * 10;
    const leftTotal = pool - spentToday;
    const base = (income - savings - NZ.sum(NZ.recurring(state.txs, today), (r) => r.perMonth)) / p.days;
    return {
      value: Math.max(0, value), raw: value, perDay, pool, leftTotal, income, upcoming, upcomingList: up, savings,
      spentBefore, spentToday, daysLeft, period: p, base: Math.max(1, base),
      overspend: value < 0 ? -value : 0, perDayCut: value < 0 && daysLeft > 1 ? Math.ceil(-value / (daysLeft - 1) / 10) * 10 : 0
    };
  };

  /* ---------- Конверты ---------- */
  NZ.suggestLimits = function (state, today) {
    const from = NZ.addMonths(NZ.ym(today), -2) + '-01';
    const spends = state.txs.filter((t) => NZ.isSpend(t) && t.date >= from && t.date < today);
    // Сколько месяцев реально покрывают данные (а не сколько календарных месяцев задето)
    const first = spends.reduce((m, t) => (t.date < m ? t.date : m), today);
    const months = Math.max(1, NZ.daysBetween(first, today) / 30.4);
    const bc = NZ.byCat(spends);
    const out = {};
    const income = state.profile.income || 0;
    const reserve = NZ.sum(state.goals, (g) => g.monthly || 0);
    Object.keys(bc).forEach((c) => { if (!['transfers', 'installments'].includes(c)) out[c] = Math.ceil(bc[c] / months / 5000) * 5000; });
    if (!Object.keys(out).length && income) {
      const share = { groceries: 0.22, cafe: 0.08, transport: 0.07, shopping: 0.1, home: 0.1, health: 0.04, subs: 0.02, other: 0.05 };
      Object.keys(share).forEach((c) => { out[c] = Math.round((income * share[c]) / 5000) * 5000; });
    }
    // Не даём сумме лимитов выйти за доход минус накопления
    const cap = Math.max(0, income - reserve);
    let total = NZ.sum(Object.values(out));
    if (income && total > cap) {
      const k = cap / total;
      Object.keys(out).forEach((c) => { out[c] = Math.floor((out[c] * k) / 1000) * 1000; });
    }
    return out;
  };
  NZ.envelopes = function (state, today) {
    const p = NZ.period(today, state.profile.payday);
    const spent = NZ.byCat(NZ.spendIn(state.txs, p.start, NZ.addDays(today, 1)));
    return Object.keys(state.envelopes).map((c) => {
      const lim = state.envelopes[c] || 0;
      const s = spent[c] || 0;
      const ratio = lim ? s / lim : (s ? 2 : 0);
      return { cat: c, limit: lim, spent: s, left: lim - s, ratio, state: ratio >= 1 ? 'over' : ratio >= 0.8 ? 'almost' : 'ok' };
    }).sort((a, b) => b.limit - a.limit);
  };

  /* ---------- Календарь ---------- */
  NZ.dayLevel = function (amount, base) {
    if (!amount) return -1;
    const r = amount / base;
    return r < 0.5 ? 0 : r < 0.75 ? 1 : r < 1 ? 2 : r < 1.3 ? 3 : 4;
  };

  /* ---------- Итоги месяца ---------- */
  NZ.monthStats = function (state, ym) {
    const a = ym + '-01';
    const b = NZ.addMonths(ym, 1) + '-01';
    const sp = NZ.spendIn(state.txs, a, b);
    const total = NZ.sum(sp, (t) => -t.amount);
    const pa = NZ.addMonths(ym, -1) + '-01';
    const prevTotal = NZ.sum(NZ.spendIn(state.txs, pa, a), (t) => -t.amount);
    const bc = NZ.byCat(sp);
    const top = Object.keys(bc).map((c) => ({ cat: c, sum: bc[c] })).sort((x, y) => y.sum - x.sum).slice(0, 3);
    const days = {};
    sp.forEach((t) => { days[t.date] = (days[t.date] || 0) - t.amount; });
    const dayList = Object.keys(days).map((d) => ({ date: d, sum: days[d] }));
    const best = dayList.slice().sort((x, y) => x.sum - y.sum)[0] || null;
    const cafe = sp.filter((t) => t.cat === 'cafe');
    const saved = NZ.sum(state.goals, (g) => NZ.goalContributedIn(g, a, b));
    const base = state.profile.income ? state.profile.income / NZ.daysInMonth(ym) : 0;
    const daysInLimit = base ? NZ.daysInMonth(ym) - dayList.filter((d) => d.sum > base).length : null;
    return { ym, count: sp.length, total, prevTotal, change: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null, top, best, cafeCount: cafe.length, cafeSum: NZ.sum(cafe, (t) => -t.amount), saved, daysInLimit, days: NZ.daysInMonth(ym) };
  };

  /* ---------- Советы ---------- */
  NZ.tips = function (state, today) {
    const tips = [];
    const p = NZ.period(today, state.profile.payday);
    const prevStart = NZ.addDays(p.start, -p.days);
    const cur = NZ.spendIn(state.txs, p.start, NZ.addDays(today, 1));
    const prev = NZ.spendIn(state.txs, prevStart, p.start);
    const elapsed = Math.max(1, NZ.daysBetween(p.start, today) + 1);
    // 1. Кафе и доставка выросли
    const cafeNow = cur.filter((t) => t.cat === 'cafe');
    const cafePrev = NZ.sum(prev.filter((t) => t.cat === 'cafe'), (t) => -t.amount);
    const cafeNowSum = NZ.sum(cafeNow, (t) => -t.amount);
    const cafeProjected = (cafeNowSum / elapsed) * p.days;
    if (cafeNow.length >= 4 && cafePrev && cafeProjected > cafePrev * 1.1) {
      const avg = cafeNowSum / cafeNow.length;
      tips.push({ id: 'cafe', kind: 'cafe', n: cafeNow.length, pct: Math.round((cafeProjected / cafePrev - 1) * 100), save: Math.round((avg * 8) / 1000) * 1000, action: 'envelopes' });
    } else if (cafeNow.length >= 6) {
      const avg = cafeNowSum / cafeNow.length;
      tips.push({ id: 'cafe', kind: 'cafe2', n: cafeNow.length, save: Math.round((avg * 8) / 1000) * 1000, action: 'envelopes' });
    }
    // 2. Подписки
    const subs = NZ.recurring(state.txs, today).filter((r) => r.cat === 'subs');
    if (subs.length) tips.push({ id: 'subs', kind: 'subs', n: subs.length, sum: NZ.sum(subs, (s) => s.perMonth), save: Math.min(...subs.map((s) => s.perMonth)), action: 'numa:subs' });
    // 3. Ближайшие рассрочки
    const inst = NZ.upcoming(state, today).filter((u) => u.cat === 'installments');
    if (inst.length) tips.push({ id: 'inst', kind: 'inst', sum: NZ.sum(inst, (u) => u.amount), date: inst[0].date, save: 0, action: 'home' });
    // 4. Дорогой день недели
    const wd = [0, 0, 0, 0, 0, 0, 0];
    const wdN = [0, 0, 0, 0, 0, 0, 0];
    const from = NZ.addDays(today, -56);
    const days = {};
    state.txs.filter((t) => NZ.isSpend(t) && t.date >= from && t.date < today && t.cat !== 'home' && t.cat !== 'installments').forEach((t) => { days[t.date] = (days[t.date] || 0) - t.amount; });
    Object.keys(days).forEach((d) => { const w = NZ.weekdayMon0(d); wd[w] += days[d]; wdN[w]++; });
    const avgAll = NZ.sum(wd) / Math.max(1, NZ.sum(wdN));
    let maxW = -1; let maxV = 0;
    wd.forEach((v, i) => { const a = wdN[i] ? v / wdN[i] : 0; if (a > maxV) { maxV = a; maxW = i; } });
    if (maxW >= 0 && NZ.sum(wdN) >= 14 && maxV > avgAll * 1.4) tips.push({ id: 'wd', kind: 'weekday', day: maxW, pct: Math.round((maxV / avgAll - 1) * 100), save: Math.round(((maxV - avgAll) * 4) / 1000) * 1000, action: 'numa:weekday' });
    // 5. Перерасход конверта
    const env = NZ.envelopes(state, today);
    const over = env.filter((e) => e.state === 'over').sort((a, b) => a.left - b.left)[0];
    const donor = env.filter((e) => e.left > 0).sort((a, b) => b.left - a.left)[0];
    if (over && donor) tips.push({ id: 'env', kind: 'env', cat: over.cat, by: -over.left, from: donor.cat, amount: Math.min(donor.left, Math.ceil(-over.left / 1000) * 1000), save: 0, action: 'move' });
    return tips.filter((t) => !state.dismissed[t.id + ':' + p.start]);
  };

  /* ---------- Пример данных ---------- */
  NZ.demoTxs = function (today) {
    // Детерминированный генератор, чтобы пример выглядел одинаково
    let seed = 42;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const out = [];
    const start = NZ.addDays(today, -75);
    const add = (date, amount, raw, op) => out.push({ date, amount, raw, op });
    for (let i = 0; i <= 75; i++) {
      const d = NZ.addDays(start, i);
      if (d > today) break;
      const w = NZ.weekdayMon0(d);
      const dom = +d.slice(8);
      if (rnd() < 0.55) add(d, -Math.round(3000 + rnd() * 12000), rnd() < 0.6 ? 'MAGNUM CASH&CARRY ALMATY' : 'SMALL ТОО', 'Покупка');
      if (rnd() < (w >= 4 ? 0.75 : 0.25)) add(d, -Math.round(3500 + rnd() * 4500), rnd() < 0.55 ? 'GLOVO*KZ' : 'WOLT KAZAKHSTAN', 'Покупка');
      if (rnd() < (w === 4 ? 0.9 : 0.35)) add(d, -Math.round(1200 + rnd() * 2400), 'YANDEX.GO', 'Покупка');
      if (rnd() < 0.18) add(d, -Math.round(6000 + rnd() * 30000), 'Kaspi Магазин', 'Покупка');
      if (rnd() < 0.08) add(d, -Math.round(2000 + rnd() * 6000), 'Аптека Европа', 'Покупка');
      if (rnd() < 0.1) add(d, -Math.round(5000 + rnd() * 15000), 'Айгерим Б.', 'Перевод');
      if (dom === 5) add(d, 650000, 'ТОО Компания — заработная плата', 'Пополнение');
      if (dom === 6) add(d, 50000, 'С Kaspi Депозита', 'Пополнение');
      if (dom === 10) add(d, -23250, 'Kaspi Red, рассрочка Sulpak', 'Покупка');
      if (dom === 12) add(d, -2990, 'NETFLIX.COM', 'Покупка');
      if (dom === 14) add(d, -1990, 'YANDEX PLUS', 'Покупка');
      if (dom === 20) add(d, -38000, 'Alseco Коммунальные услуги', 'Покупка');
      if (dom === 21) add(d, -5990, 'Beeline Казахстан', 'Покупка');
    }
    return out;
  };
})();
