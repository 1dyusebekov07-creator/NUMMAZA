/* NUMMAZA — ассистент Numa.
   Работает на устройстве: распознаёт намерение вопроса (RU/ҚАЗ/EN) и считает ответ по данным пользователя.
   Каждый ответ: вывод → до 3 фактов → что делать дальше → одна кнопка действия + основание. */
(function () {
  'use strict';
  const NZ = window.NZ;
  const t = (...a) => NZ.t(...a);
  const M = (n) => NZ.money(n);

  const INTENTS = [
    ['deposit', /депозит|вклад|салым|deposit|куда\s*(положить|хранить)|қайда\s*салу|where.*(keep|put).*sav/i],
    ['subs', /подписк|жазылым|subscript|netflix|spotify|регулярн|тұрақты/i],
    ['goals', /цел[ьиейя]|мақсат|goal|накоп|копить|жина|save\s*for/i],
    ['today', /сегодня|бүгін|today|можно\s*потрат|safe\s*to\s*spend|лимит\s*на\s*день|күндік/i],
    ['over', /переплач|эконом|сэконом|лишн|артық|үнем|overspend|overpay|save\s*money|cut|где.*(трачу|уход)|қайда.*кет/i],
    ['weekday', /день\s*недели|дни\s*недели|когда\s*я|пятниц|выходн|апта\s*күн|қай\s*күн|weekday|which\s*day|weekend/i],
    ['income', /доход|зарплат|табыс|жалақ|income|salary|payday/i],
    ['overview', /бюджет|как\s*(я|мой|мои|дела)|итог|месяц|қалай|қорытынды|budget|how\s*(am|is|are)|overview|month/i]
  ];

  // Категория из вопроса: «сколько на такси», «таксиге», «groceries»
  const CAT_WORDS = {
    groceries: /продукт|магнум|magnum|азық|groceri|food\s*shop|супермаркет/i,
    cafe: /кафе|доставк|глово|glovo|wolt|ресторан|жеткізу|cafe|café|delivery|restaurant|еда|тамақ/i,
    transport: /такси|транспорт|yandex\s*go|көлік|taxi|transport|бензин|азс|автобус/i,
    shopping: /покупк|шопинг|одежд|kaspi\s*магазин|сатып\s*ал|shopping|clothes/i,
    home: /коммунал|дом|связь|интернет|телефон|үй|байланыс|utilit|rent|phone/i,
    health: /здоров|аптек|врач|денсаулық|дәріхана|health|pharmacy|doctor/i,
    subs: /подписк|жазылым|subscript/i,
    installments: /рассрочк|кредит|kaspi\s*red|бөліп\s*төле|instal|loan/i,
    transfers: /перевод|аударым|transfer/i,
    gifts: /подар|сыйлық|gift/i
  };

  NZ.numaAnswer = function (state, text, today) {
    const q = String(text || '').trim();
    const spends = state.txs.filter(NZ.isSpend);
    const p = NZ.period(today, state.profile.payday);
    const basis = { n: 0, from: p.start, to: today };
    if (!state.txs.length && !/депозит|вклад|салым|deposit|доход|табыс|income/i.test(q)) return { lead: t('numa.noData'), facts: [], next: '', action: { kind: 'go', to: 'statements', label: t('home.loadSt') } };

    // Сначала — вопрос о конкретной категории
    let intent = null;
    let catAsked = null;
    if (/сколько|қанша|how\s*much|трачу|жұмсаймын|spend\s*on/i.test(q)) {
      for (const c of Object.keys(CAT_WORDS)) if (CAT_WORDS[c].test(q)) { catAsked = c; break; }
    }
    if (catAsked && catAsked !== 'subs') intent = 'cat';
    if (!intent) { const f = INTENTS.find((i) => i[1].test(q)); intent = f ? f[0] : null; }
    if (!intent) {
      for (const c of Object.keys(CAT_WORDS)) if (CAT_WORDS[c].test(q)) { catAsked = c; intent = c === 'subs' ? 'subs' : 'cat'; break; }
    }

    const cur = NZ.spendIn(state.txs, p.start, NZ.addDays(today, 1));
    basis.n = cur.length;
    const s = NZ.safeToday(state, today);

    switch (intent) {
      case 'overview': {
        const spent = NZ.sum(cur, (x) => -x.amount);
        const bc = NZ.byCat(cur);
        const top = Object.keys(bc).sort((a, b) => bc[b] - bc[a])[0];
        const elapsed = Math.max(1, NZ.daysBetween(p.start, today) + 1);
        const forecast = (state.profile.income || 0) - s.savings - (spent / elapsed) * p.days;
        const envOver = NZ.envelopes(state, today).filter((e) => e.state === 'over').length;
        const free = Math.max(0, s.leftTotal);
        const facts = [];
        if (top) facts.push({ label: t('ans.fTop'), value: t('cat.' + top) + ' · ' + M(bc[top]) });
        facts.push({ label: t('ans.fSpent'), value: M(spent) });
        facts.push({ label: t('ans.fPace'), value: M(forecast), warn: forecast < 0 });
        const firstGoal = state.goals.find((g) => g.saved < g.target);
        const extra = Math.floor((free * 0.3) / 5000) * 5000;
        return { lead: t('ans.overview', M(state.profile.income || 0), M(spent), M(free)), facts, next: t('ans.overviewNext', M(Math.max(0, forecast)), envOver), action: firstGoal && extra >= 5000 && forecast > extra ? { kind: 'toGoal', goal: firstGoal.id, amount: extra, label: t('act.toGoal', M(extra)) } : { kind: 'go', to: 'envelopes', label: t('act.envelopes') }, basis };
      }
      case 'over': {
        const tips = NZ.tips(state, today).filter((x) => x.save > 0);
        const items = [];
        tips.forEach((x) => {
          if (x.kind === 'cafe' || x.kind === 'cafe2') items.push({ label: t('cat.cafe'), value: '≈ ' + M(x.save) });
          if (x.kind === 'subs') items.push({ label: t('cat.subs'), value: M(x.save) });
          if (x.kind === 'weekday') items.push({ label: NZ.t('wdFull')[x.day], value: '≈ ' + M(x.save) });
        });
        // Такси на короткие поездки
        const taxi = cur.filter((x) => x.cat === 'transport' && -x.amount < 2000);
        if (taxi.length >= 5) items.push({ label: t('cat.transport'), value: '≈ ' + M(Math.round(NZ.sum(taxi, (x) => -x.amount) * 0.3 / 1000) * 1000) });
        if (!items.length) return { lead: t('ans.overNone'), facts: [], next: '', action: { kind: 'go', to: 'goals', label: t('act.goals') }, basis };
        const total = items.reduce((a, i) => a + (parseInt(String(i.value).replace(/\D/g, ''), 10) || 0), 0);
        return { lead: t('ans.over'), facts: items.slice(0, 3), next: t('ans.overNext', M(total)), action: { kind: 'go', to: 'envelopes', label: t('act.envelopes') }, basis };
      }
      case 'today': {
        const lead = s.raw >= 0 ? t('ans.today', M(s.value)) : t('ans.todayOver', M(-s.raw));
        return { lead, facts: [{ label: t('home.fToday'), value: M(s.spentToday) }, { label: t('home.fUpcoming'), value: M(s.upcoming) }, { label: t('home.fPerDay'), value: M(Math.max(0, s.perDay)) }], next: t('ans.todayNext', t('c.days', s.daysLeft), M(Math.max(0, s.leftTotal))), action: null, basis };
      }
      case 'cat': {
        const c = catAsked;
        const list = cur.filter((x) => x.cat === c);
        const prevStart = NZ.addDays(p.start, -p.days);
        const prev = NZ.sum(NZ.spendIn(state.txs, prevStart, p.start).filter((x) => x.cat === c), (x) => -x.amount);
        const sum = NZ.sum(list, (x) => -x.amount);
        const m = {};
        list.forEach((x) => { m[x.merchant] = (m[x.merchant] || 0) + 1; });
        const topM = Object.keys(m).sort((a, b) => m[b] - m[a]).slice(0, 2);
        const facts = topM.map((name) => ({ label: t('ans.catTop'), value: name + ' × ' + m[name] }));
        const env = state.envelopes[c];
        if (env) facts.push({ label: t('env.limitL'), value: M(env) });
        return { lead: t('ans.cat', t('cat.' + c), M(sum), t('c.ops', list.length)), facts, next: prev ? t('ans.catNext', M(prev)) : '', action: { kind: 'go', to: 'envelopes', label: t('act.envelopes') }, basis };
      }
      case 'subs': {
        const rec = NZ.recurring(state.txs, today).filter((r) => r.cat === 'subs');
        if (!rec.length) return { lead: t('ans.subsNone'), facts: [], next: '', action: null, basis };
        const total = NZ.sum(rec, (r) => r.perMonth);
        return { lead: t('ans.subs', rec.length, M(total)), facts: rec.slice(0, 3).map((r) => ({ label: r.merchant, value: M(r.perMonth) })), next: t('ans.subsNext'), action: null, basis };
      }
      case 'goals': {
        const goals = state.goals.filter((g) => g.saved < g.target);
        if (!goals.length) return { lead: t('ans.goalsNone'), facts: [], next: '', action: { kind: 'go', to: 'goals', label: t('act.newGoal') }, basis };
        const st = goals.map((g) => ({ g, s: NZ.goalStatus(g, today) }));
        const behind = st.find((x) => x.s.status === 'behind');
        return { lead: t('ans.goals', goals.length), facts: st.slice(0, 3).map((x) => ({ label: x.g.name, value: x.s.pct + '% · ' + t('goal.' + x.s.status), warn: x.s.status === 'behind' })), next: behind ? t('ans.goalNext', behind.g.name, M(behind.s.needMonthly)) : '', action: { kind: 'go', to: 'goals', label: t('act.goals') }, basis };
      }
      case 'deposit':
        return { lead: t('ans.deposit'), facts: NZ.t('ans.depositF').map((x) => ({ label: x, value: '' })), next: t('numa.notAdvice'), action: { kind: 'go', to: 'goals', label: t('act.goals') }, basis: null };
      case 'weekday': {
        const tip = NZ.tips(Object.assign({}, state, { dismissed: {} }), today).find((x) => x.kind === 'weekday');
        if (!tip) return { lead: t('ans.weekdayNone'), facts: [], next: '', action: null, basis };
        return { lead: t('ans.weekday', NZ.t('wdFull')[tip.day], tip.pct), facts: [{ label: t('home.saveL'), value: '≈ ' + M(tip.save) }], next: t('ans.weekdayNext'), action: null, basis };
      }
      case 'income':
        return { lead: t('ans.income', M(state.profile.income || 0), state.profile.payday), facts: [], next: t('ans.incomeNext'), action: { kind: 'go', to: 'profile', label: t('act.profile') }, basis: null };
      default:
        return { lead: t('numa.fallback'), facts: [], next: '', action: null, basis: null };
    }
  };
})();
