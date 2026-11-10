/* NUMMAZA — интерфейс. Одна страница, маршруты через #hash, данные в localStorage. */
(function () {
  'use strict';
  const NZ = window.NZ;
  const t = (...a) => NZ.t(...a);
  const M = (n, o) => NZ.money(n, o);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const today = () => NZ.today();

  let S = NZ.load();
  const SERVER = () => !!(NZ.api && NZ.api.enabled());
  // На сервере аккаунт без токена = нужно войти заново
  if (SERVER() && S.account && S.account.server && !NZ.api.hasSession()) S.session = false;
  if (NZ.syncResetBase) NZ.syncResetBase(S);
  const ui = {
    route: 'home', sheet: null, sheetData: null, toast: null, showFormula: false, calYm: null, selDay: null,
    envFilter: 'all', authMode: null, pwShow: false, authErr: {}, importing: null, importResult: null, importErr: null,
    thinking: false, recapIdx: 0, hideSums: true, add: null, opsQuery: '', opsReview: false, onbErr: null, returnFocus: null
  };

  /* ---------- Иконки (контурные SVG) ---------- */
  const IC = {
    home: 'M3 11l9-7 9 7v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z',
    env: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM3 7l9 6 9-6',
    numa: 'M12 3l1.8 4.6L18 9.5l-4.2 1.9L12 16l-1.8-4.6L6 9.5l4.2-1.9z',
    goal: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8a4 4 0 100 8 4 4 0 000-8z',
    upload: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 002 2h12a2 2 0 002-2v-4',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    back: 'M15 6l-6 6 6 6',
    chev: 'M9 6l6 6-6 6',
    moon: 'M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z',
    sun: 'M12 7a5 5 0 100 10 5 5 0 000-10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
    file: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6',
    send: 'M5 12h14M13 6l6 6-6 6',
    share: 'M12 3v13M7 8l5-5 5 5M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6',
    check: 'M5 12l5 5 9-10',
    trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
    wifi: 'M2 2l20 20M8.5 16.5a5 5 0 017 0M5 13a10 10 0 015.2-2.8M19 13a10 10 0 00-2.3-1.7M12 20h.01'
  };
  const icon = (n, s) => '<svg width="' + (s || 20) + '" height="' + (s || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + IC[n] + '"></path></svg>';
  const logo = (s) => '<svg width="' + s + '" height="' + s + '" viewBox="0 0 36 36" aria-hidden="true"><rect width="36" height="36" rx="10" fill="#0B6E64"></rect><path d="M10 26V10l16 16V10" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  /* ---------- Язык и тема ---------- */
  function applyPrefs() {
    NZ.lang = S.profile.lang || NZ.detectLang();
    document.documentElement.lang = NZ.lang;
    const th = S.profile.theme;
    if (th === 'light' || th === 'dark') document.documentElement.setAttribute('data-app-theme', th);
    else document.documentElement.removeAttribute('data-app-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark() ? '#0F1514' : '#F4F5F7');
  }
  const isDark = () => S.profile.theme === 'dark' || (S.profile.theme !== 'light' && ((document.documentElement.getAttribute('data-theme') === 'dark') || (!document.documentElement.getAttribute('data-theme') && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)));
  const langSwitch = () => '<div class="seg seg-sm" role="group" aria-label="' + esc(t('c.lang')) + '">' + [['RU', 'ru'], ['ҚАЗ', 'kk'], ['EN', 'en']].map(([l, k]) => '<button type="button" data-a="lang" data-v="' + k + '" aria-pressed="' + (NZ.lang === k) + '">' + l + '</button>').join('') + '</div>';
  const themeBtn = () => '<button type="button" class="icon-btn" data-a="themeToggle" aria-label="' + esc(isDark() ? t('c.toLight') : t('c.toDark')) + '">' + icon(isDark() ? 'sun' : 'moon') + '</button>';

  /* ---------- Сохранение, тост с отменой ---------- */
  let shared = null; // файл из «Поделиться» (см. pullShared)
  function commit() { NZ.save(S); render(); }
  let toastTimer = null;
  function toast(msg, undoFn) {
    ui.toast = { msg, undo: undoFn || null };
    clearTimeout(toastTimer);
    renderToast();
    toastTimer = setTimeout(() => { ui.toast = null; renderToast(); }, 5000);
  }
  function renderToast() {
    const el = document.getElementById('toast');
    if (!el) return;
    el.innerHTML = ui.toast ? '<div class="toast-in"><span>' + esc(ui.toast.msg) + '</span>' + (ui.toast.undo ? '<button type="button" data-a="undo">' + esc(t('c.undo')) + '</button>' : '') + '</div>' : '';
  }
  // Снимок состояния для отмены
  const snapshot = () => JSON.stringify(S);
  const restore = (snap) => () => { S = JSON.parse(snap); NZ.save(S); applyPrefs(); render(); };

  /* ---------- Маршруты ---------- */
  const ROUTES = ['home', 'envelopes', 'numa', 'statements', 'goals', 'profile', 'recap', 'delete', 'ops'];
  function readRoute() { const h = (location.hash || '').replace('#', ''); ui.route = ROUTES.includes(h) ? h : 'home'; }
  function go(r) { if (location.hash !== '#' + r) location.hash = r; else { ui.route = r; render(); } }

  /* ---------- Главный рендер ---------- */
  // Защита от повторного входа: замена innerHTML снимает фокус с поля, и его событие change может вызвать render() внутри render()
  let rendering = false; let pending = false;
  function render() {
    if (rendering) { pending = true; return; }
    rendering = true;
    try { renderNow(); } finally { rendering = false; }
    if (pending) { pending = false; render(); }
  }
  function renderNow() {
    applyPrefs();
    const app = document.getElementById('app');
    let html;
    if (!S.account || !S.session) html = viewAuth();
    else if (!S.profile.onboarded) html = viewOnboarding();
    else if (ui.route === 'recap') html = viewRecap();
    else if (ui.route === 'delete') html = viewDelete();
    else html = shell();
    app.innerHTML = (navigator.onLine === false ? '<div class="offline" role="status">' + icon('wifi', 16) + esc(t('c.offline')) + '</div>' : '') + html;
    renderSheet();
    renderToast();
    if (shared && S.account && S.session && !ui.importing) setTimeout(useShared, 0);
    if (ui.route === 'numa') { const log = document.getElementById('chatlog'); if (log) log.scrollTop = log.scrollHeight; }
  }

  function shell() {
    const tabs = [['home', 'home'], ['envelopes', 'env'], ['numa', 'numa'], ['goals', 'goal'], ['statements', 'upload']];
    const nav = '<nav class="tabbar" aria-label="' + esc(t('c.menu')) + '">' + '<a class="brand" href="#home">' + logo(30) + '<span>nummaza</span></a>' + tabs.map(([r, i]) => '<a href="#' + r + '" ' + (ui.route === r ? 'aria-current="page"' : '') + '>' + icon(i, 22) + '<span>' + esc(t('nav.' + r)) + '</span></a>').join('') + '<a class="side-only" href="#profile" ' + (ui.route === 'profile' ? 'aria-current="page"' : '') + '>' + '<span class="ava ava-sm" aria-hidden="true">' + esc((S.account.name || '?')[0].toUpperCase()) + '</span><span>' + esc(t('nav.profile')) + '</span></a></nav>';
    const fab = ['home', 'envelopes', 'goals'].includes(ui.route) ? '<button type="button" class="fab" data-a="openAdd" aria-label="' + esc(t('nav.add')) + '">' + icon('plus', 26) + '</button>' : '';
    const views = { home: viewHome, envelopes: viewEnvelopes, numa: viewNuma, statements: viewStatements, goals: viewGoals, profile: viewProfile, ops: viewOps };
    return '<div class="layout">' + nav + '<main class="main" id="main">' + views[ui.route]() + '</main>' + fab + '</div>';
  }

  /* ================= ВХОД / РЕГИСТРАЦИЯ ================= */
  function viewAuth() {
    const mode = ui.authMode || (S.account ? 'in' : 'up');
    const e = ui.authErr;
    const err = (k) => (e[k] ? '<span class="err" id="err-' + k + '">' + esc(e[k]) + '</span>' : '');
    const locked = !SERVER() && S.auth.lockedUntil > Date.now();
    const busy = ui.authBusy;
    return '<div class="solo"><div class="solo-in">' +
      '<div class="row-between"><div class="brand-row">' + logo(32) + '<b>nummaza</b></div><div class="row-gap">' + langSwitch() + themeBtn() + '</div></div>' +
      '<div class="stack-6 mt-16"><h1 class="h1">' + esc(mode === 'in' ? t('auth.titleIn') : t('auth.titleUp')) + '</h1><p class="muted">' + esc(t('auth.tagline')) + '</p></div>' +
      (shared ? '<p class="note" id="shared-note">' + icon('file', 18) + '<span>' + esc(t('st.shared', shared.name)) + '</span></p>' : '') +
      '<div class="seg seg-full" role="group" aria-label="' + esc(t('auth.mode')) + '"><button type="button" data-a="authMode" data-v="in" aria-pressed="' + (mode === 'in') + '">' + esc(t('auth.signIn')) + '</button><button type="button" data-a="authMode" data-v="up" aria-pressed="' + (mode === 'up') + '">' + esc(t('auth.signUp')) + '</button></div>' +
      '<form class="stack-14" data-form="auth" novalidate>' +
      (mode === 'up' ? '<label class="field"><span>' + esc(t('auth.name')) + '</span><input id="a-name" name="name" autocomplete="given-name" placeholder="' + esc(t('auth.namePh')) + '" value="' + esc(ui.authName || '') + '" aria-invalid="' + !!e.name + '">' + err('name') + '</label>' : '') +
      '<label class="field"><span>' + esc(t('auth.login')) + '</span><input id="a-login" name="login" autocomplete="username" inputmode="email" placeholder="' + esc(t('auth.loginPh')) + '" value="' + esc(ui.authLogin || '') + '" aria-invalid="' + !!e.login + '">' + err('login') + '</label>' +
      '<div class="field"><div class="row-between"><label for="a-pw">' + esc(t('auth.password')) + '</label>' + (mode === 'in' ? '<button type="button" class="link" data-a="forgot">' + esc(t('auth.forgot')) + '</button>' : '') + '</div><div class="pw"><input id="a-pw" name="pw" type="' + (ui.pwShow ? 'text' : 'password') + '" autocomplete="' + (mode === 'in' ? 'current-password' : 'new-password') + '" placeholder="••••••••" aria-invalid="' + !!e.pw + '"><button type="button" class="icon-btn" data-a="pwToggle" aria-pressed="' + ui.pwShow + '" aria-label="' + esc(ui.pwShow ? t('auth.hide') : t('auth.show')) + '">' + icon('eye') + '</button></div>' + (mode === 'up' && !e.pw ? '<span class="hint">' + esc(t('auth.pwHint')) + '</span>' : '') + err('pw') + '</div>' +
      (mode === 'up' ? '<label class="check"><input type="checkbox" id="a-agree" name="agree"><span>' + esc(t('auth.agree')) + '</span></label>' + err('agree') : '') +
      (e.form ? '<p class="err-box" role="alert">' + esc(e.form) + '</p>' : '') +
      '<button class="btn btn-primary btn-lg" type="submit" ' + ((locked && mode === 'in') || busy ? 'disabled' : '') + '>' + esc(busy ? (mode === 'in' ? t('auth.busyIn') : t('auth.busyUp')) : (mode === 'in' ? t('auth.ctaIn') : t('auth.ctaUp'))) + '</button></form>' +
      '<p class="note">' + icon('lock', 18) + '<span>' + esc(SERVER() ? t('auth.noteServer') : t('auth.note')) + '</span></p></div></div>';
  }
  const normLogin = (s) => {
    const v = String(s || '').trim().toLowerCase();
    if (/^\S+@\S+\.\S+$/.test(v)) return v;
    let d = v.replace(/\D/g, '');
    if (d.length === 11 && d[0] === '8') d = '7' + d.slice(1);
    if (d.length === 10) d = '7' + d;
    return d.length === 11 && d[0] === '7' ? '+' + d : null;
  };
  // Регистрация и вход через сервер (app/js/api.js). Данные затем синхронизируются (app/js/sync.js).
  async function serverAuth(mode, name, login, pw) {
    ui.authBusy = true; ui.authErr = {}; render();
    let user;
    try {
      user = mode === 'up' ? await NZ.api.register(name, login, pw) : await NZ.api.login(login, pw);
    } catch (err) {
      ui.authBusy = false;
      const c = err.code;
      const f = (err.data && err.data.fields) || {};
      if (c === 'validation') ui.authErr = { name: f.name ? t('auth.errName') : undefined, login: f.login ? t('auth.errLogin') : undefined, pw: f.password ? t('auth.errPw') : undefined };
      else if (c === 'login_taken') ui.authErr = { form: t('auth.errTaken') };
      else if (c === 'bad_credentials') ui.authErr = { form: err.data.attemptsLeft ? t('auth.errWrong', err.data.attemptsLeft) : t('auth.errBad') };
      else if (c === 'locked') ui.authErr = { form: t('auth.errLocked', err.data.minutes || 15) };
      else if (c === 'offline') ui.authErr = { form: t('auth.errOffline') };
      else if (c === 'rate_limited') ui.authErr = { form: t('auth.errRate') };
      else ui.authErr = { form: t('auth.errServer') };
      render(); focusFirstError(); return;
    }
    // Другой человек на этом устройстве — начинаем с чистого состояния (язык и тема остаются)
    const sameUser = !!(S.account && S.account.server && S.account.userId === user.id);
    // Вход: данные берём с сервера. Регистрация: введённое на устройстве до неё сохраняем и отправляем.
    const reset = mode === 'in' ? !sameUser : !!(S.account && S.account.server && !sameUser);
    if (reset) {
      const keep = { lang: S.profile.lang || NZ.lang, theme: S.profile.theme };
      S = NZ.defaultState();
      S.profile.lang = keep.lang; S.profile.theme = keep.theme;
    }
    if (!S.profile.lang) S.profile.lang = NZ.lang;
    S.account = { name: user.name, login: user.login, userId: user.id, server: true };
    S.session = true;
    S.sync = S.sync && sameUser ? S.sync : { cursor: 0, outbox: [], lastAt: 0, error: null, clock: 0 };
    if (mode === 'up') NZ.syncEnqueueAll(S); // профиль и всё введённое до регистрации — на сервер
    else NZ.syncResetBase(S);
    NZ.save(S);
    ui.authErr = {}; ui.authName = ''; ui.authLogin = ''; ui.authBusy = false;
    ui.route = 'home';
    if (location.hash !== '#home') history.replaceState(null, '', '#home');
    await NZ.sync.run(); // при входе забираем данные с сервера
    render();
  }
  async function submitAuth(form) {
    const mode = ui.authMode || (S.account ? 'in' : 'up');
    const name = form.name ? form.name.value.trim() : '';
    const login = normLogin(form.login.value);
    const pw = form.pw.value;
    ui.authName = name; ui.authLogin = form.login.value;
    const e = {};
    if (mode === 'up') {
      if (!name) e.name = t('auth.errName');
      if (!login) e.login = t('auth.errLogin');
      if (pw.length < 8 || !/[a-zа-яәғқңөұүһі]/i.test(pw) || !/\d/.test(pw)) e.pw = t('auth.errPw');
      if (!form.agree.checked) e.agree = t('auth.errAgree');
      if (!SERVER() && !Object.keys(e).length && S.account) e.form = t('auth.errExists');
      ui.authErr = e;
      if (Object.keys(e).length) { render(); focusFirstError(); return; }
      if (SERVER()) return serverAuth('up', name, login, pw);
      const salt = NZ.uid();
      S.account = { name, login, salt, hash: await NZ.hash(salt, pw), createdAt: today() };
      S.session = true;
      if (!S.profile.lang) S.profile.lang = NZ.lang;
      ui.authErr = {}; ui.authName = ''; ui.authLogin = '';
      commit();
      return;
    }
    if (SERVER()) {
      if (!login) { ui.authErr = { login: t('auth.errLogin') }; render(); focusFirstError(); return; }
      return serverAuth('in', '', login, pw);
    }
    if (S.auth.lockedUntil > Date.now()) { ui.authErr = { form: t('auth.errLocked', Math.ceil((S.auth.lockedUntil - Date.now()) / 60000)) }; render(); return; }
    if (!S.account) { ui.authErr = { form: t('auth.errNoAccount') }; render(); return; }
    if (!login) { ui.authErr = { login: t('auth.errLogin') }; render(); focusFirstError(); return; }
    const ok = login === S.account.login && (await NZ.hash(S.account.salt, pw)) === S.account.hash;
    if (!ok) {
      S.auth.fails = (S.auth.fails || 0) + 1;
      if (S.auth.fails >= 5) { S.auth.lockedUntil = Date.now() + 15 * 60000; S.auth.fails = 0; ui.authErr = { form: t('auth.errLocked', 15) }; }
      else ui.authErr = { form: t('auth.errWrong', 5 - S.auth.fails) };
      NZ.save(S); render(); return;
    }
    S.auth = { fails: 0, lockedUntil: 0 }; S.session = true; ui.authErr = {}; ui.authLogin = '';
    ui.route = 'home';
    if (location.hash !== '#home') history.replaceState(null, '', '#home');
    commit();
  }
  function focusFirstError() { const el = document.querySelector('[aria-invalid="true"]'); if (el) el.focus(); }

  /* ================= ОНБОРДИНГ ================= */
  function viewOnboarding() {
    const step = S.profile.onbStep || 0;
    const bars = [0, 1, 2, 3].map((i) => '<span class="' + (i <= step ? 'on' : '') + '"></span>').join('');
    let body = '';
    if (step === 0) {
      body = '<h2 class="h3">' + esc(t('c.lang')) + '</h2><div class="stack-10">' + [['Русский', 'RU', 'ru'], ['Қазақша', 'ҚАЗ', 'kk'], ['English', 'EN', 'en']].map(([n, c, k]) => '<button type="button" class="choice" data-a="lang" data-v="' + k + '" aria-pressed="' + (NZ.lang === k) + '"><span>' + n + '</span><span class="muted">' + c + '</span></button>').join('') + '</div>' +
        '<h2 class="h3 mt-16">' + esc(t('c.theme')) + '</h2><div class="grid-3">' + ['light', 'dark', 'system'].map((k) => '<button type="button" class="choice choice-col" data-a="theme" data-v="' + k + '" aria-pressed="' + (S.profile.theme === k) + '"><span class="prev prev-' + k + '" aria-hidden="true"><i></i><b></b></span>' + esc(t('c.' + k)) + '</button>').join('') + '</div>';
    } else if (step === 1) {
      const inc = S.profile.income || '';
      body = '<label class="field"><span>' + esc(t('onb.incomeL')) + '</span><input id="o-income" class="input-xl" inputmode="numeric" autocomplete="off" data-in="income" value="' + (inc ? esc(String(inc).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) : '') + '" placeholder="650 000" aria-invalid="' + !!ui.onbErr + '">' + (ui.onbErr ? '<span class="err">' + esc(ui.onbErr) + '</span>' : '') + '</label>' +
        '<fieldset class="field"><legend>' + esc(t('onb.paydayL')) + '</legend><div class="chips-6">' + [1, 5, 10, 15, 20, 25].map((d) => '<button type="button" class="chip-btn" data-a="payday" data-v="' + d + '" aria-pressed="' + (S.profile.payday === d) + '">' + d + '</button>').join('') + '</div><span class="hint">' + esc(t('onb.payHint', S.profile.payday)) + '</span></fieldset>' +
        '<div class="ok-box"><span>' + esc(t('onb.estL')) + '</span><b id="o-est">' + (inc ? '≈ ' + M(Math.floor((inc * 0.85) / 30 / 100) * 100) : '—') + '</b></div>';
    } else if (step === 2) {
      const gi = ui.onbGoal == null ? 0 : ui.onbGoal;
      const defT = [Math.max(300000, (S.profile.income || 300000) * 3), 350000, 480000];
      body = '<div class="stack-10">' + t('onb.goals').map(([n, d], i) => '<button type="button" class="choice choice-left" data-a="onbGoal" data-v="' + i + '" aria-pressed="' + (gi === i) + '"><b>' + esc(n) + '</b><span class="muted">' + esc(d) + '</span></button>').join('') + '</div>' +
        (gi !== 3 ? '<div class="grid-2"><label class="field"><span>' + esc(t('onb.goalAmt')) + '</span><input id="o-gamt" inputmode="numeric" value="' + esc(String(ui.onbGoalAmt || defT[gi])) + '"></label><label class="field"><span>' + esc(t('onb.goalMonths')) + '</span><input id="o-gm" inputmode="numeric" value="' + esc(String(ui.onbGoalMonths || 12)) + '"></label></div>' : '');
    } else {
      body = importBlock(true) + '<button type="button" class="link center" data-a="onbSkip">' + esc(t('onb.skip')) + '</button>';
    }
    const titles = [[t('onb.t0'), t('onb.s0')], [t('onb.t1'), t('onb.s1')], [t('onb.t2'), t('onb.s2')], [t('onb.t3'), t('onb.s3')]][step];
    return '<div class="solo"><div class="solo-in">' +
      '<div class="row-between">' + (step ? '<button type="button" class="link" data-a="onbBack">' + icon('back', 18) + esc(t('c.back')) + '</button>' : '<div class="brand-row">' + logo(28) + '<b>nummaza</b></div>') + '<span class="muted small">' + esc(t('onb.step', step + 1)) + '</span></div>' +
      '<div class="progress" role="progressbar" aria-valuemin="1" aria-valuemax="4" aria-valuenow="' + (step + 1) + '" aria-label="' + esc(t('onb.step', step + 1)) + '">' + bars + '</div>' +
      '<div class="stack-6 mt-16"><h1 class="h1">' + esc(titles[0]) + '</h1><p class="muted">' + esc(titles[1]) + '</p></div>' +
      '<div class="stack-14">' + body + '</div>' +
      (step < 3 ? '<button type="button" class="btn btn-primary btn-lg mt-auto" data-a="onbNext">' + esc(t('c.next')) + '</button>' : '') +
      '</div></div>';
  }
  function onbNext() {
    const step = S.profile.onbStep || 0;
    if (step === 1) {
      const v = parseInt((document.getElementById('o-income').value || '').replace(/\D/g, ''), 10) || 0;
      if (v <= 0) { ui.onbErr = t('onb.errIncome'); render(); document.getElementById('o-income').focus(); return; }
      ui.onbErr = null; S.profile.income = v;
    }
    if (step === 2) {
      const gi = ui.onbGoal == null ? 0 : ui.onbGoal;
      S.goals = S.goals.filter((g) => !g.fromOnb);
      if (gi !== 3) {
        const target = parseInt((document.getElementById('o-gamt').value || '').replace(/\D/g, ''), 10) || 0;
        const months = Math.min(120, Math.max(1, parseInt((document.getElementById('o-gm').value || '').replace(/\D/g, ''), 10) || 12));
        if (target > 0) S.goals.push(newGoal(t('onb.goals')[gi][0], target, 0, months, true));
      }
    }
    S.profile.onbStep = step + 1;
    commit();
  }
  function newGoal(name, target, saved, months, fromOnb) {
    const d = NZ.parseISO(today()); d.setMonth(d.getMonth() + months);
    return { id: NZ.uid(), name, target, saved, startSaved: saved, monthly: Math.ceil((target - saved) / months / 1000) * 1000, deadline: NZ.iso(d), createdAt: today(), history: [], milestones: [], fromOnb: !!fromOnb };
  }
  function finishOnb() { S.profile.onboarded = true; S.profile.onbStep = 0; if (!Object.keys(S.envelopes).length && S.txs.length) S.envelopes = NZ.suggestLimits(S, today()); location.hash = 'home'; ui.route = 'home'; commit(); }

  /* ================= ОБЗОР ================= */
  function viewHome() {
    const td = today();
    const s = NZ.safeToday(S, td);
    const name = S.account.name;
    const parts = [];
    parts.push('<header class="page-head"><div><p class="muted">' + esc(t('home.hello', name)) + '</p><h1 class="h2">' + esc(NZ.fmtDate(td, true)) + '</h1></div><div class="row-gap">' + themeBtn() + '<a class="ava" href="#profile" aria-label="' + esc(t('nav.profile')) + '">' + esc(name[0].toUpperCase()) + '</a></div></header>');
    if (S.demo) parts.push('<div class="banner"><span>' + esc(t('home.demo')) + '</span><button type="button" class="link" data-a="rmDemo">' + esc(t('home.demoRm')) + '</button></div>');
    const prevYm = NZ.addMonths(NZ.ym(td), -1);
    const ms = NZ.monthStats(S, prevYm);
    if (ms.count >= 10 && !S.dismissed['recap:' + prevYm]) parts.push('<div class="banner banner-teal"><span>' + esc(t('home.recap', NZ.monthName(prevYm))) + '</span><span class="row-gap"><a class="btn btn-sm btn-on-teal" href="#recap" data-a="openRecap" data-v="' + prevYm + '">' + esc(t('home.recapOpen')) + '</a><button type="button" class="icon-btn icon-btn-sm" data-a="dismiss" data-v="recap:' + prevYm + '" aria-label="' + esc(t('c.close')) + '">' + icon('close', 16) + '</button></span></div>');

    const noData = !S.txs.length;
    // Карточка «Сегодня можно»
    const formula = ui.showFormula ? '<dl class="formula">' +
      frow(t('home.fIncome'), M(s.income)) + frow('− ' + t('home.fUpcoming'), M(s.upcoming)) + frow('− ' + t('home.fSavings'), M(s.savings)) + frow('− ' + t('home.fSpent'), M(s.spentBefore)) +
      frow('÷ ' + t('home.fDays'), String(s.daysLeft)) + frow('= ' + t('home.fPerDay'), M(Math.max(0, s.perDay))) + frow('− ' + t('home.fToday'), M(s.spentToday)) + '</dl>' : '';
    parts.push('<section class="safe" aria-labelledby="safe-h"><button type="button" class="safe-btn" data-a="formula" aria-expanded="' + ui.showFormula + '"><span id="safe-h" class="safe-l">' + esc(t('home.safe')) + '</span><span class="safe-v" data-count="' + s.value + '">' + M(s.value) + '</span><span class="safe-s">' + esc(S.profile.income ? t('home.daysLeft', t('c.days', s.daysLeft), M(Math.max(0, s.leftTotal))) : t('home.noIncome')) + '</span>' +
      (s.raw < 0 ? '<span class="safe-over">' + esc(t('home.overspend', M(-s.raw), t('c.days', Math.max(1, s.daysLeft - 1)), M(s.perDayCut))) + '</span>' : '') +
      '<span class="safe-how">' + esc(t('home.how')) + ' ' + icon('chev', 14) + '</span></button>' + formula +
      '<div class="safe-mini"><div><span>' + esc(t('home.spent')) + '</span><b>' + M(NZ.sum(NZ.spendIn(S.txs, s.period.start, NZ.addDays(td, 1)), (x) => -x.amount)) + '</b></div><div><span>' + esc(t('home.toGoals')) + '</span><b>' + M(s.savings) + '</b></div></div></section>');

    parts.push('<a class="ask" href="#numa">' + icon('numa') + '<span>' + esc(t('home.ask')) + '</span></a>');

    if (noData) {
      parts.push('<section class="card empty"><h2 class="h3">' + esc(t('home.emptyT')) + '</h2><p class="muted">' + esc(t('home.emptyS')) + '</p><div class="row-gap wrap"><a class="btn btn-primary" href="#statements">' + icon('upload', 18) + esc(t('home.loadSt')) + '</a><button type="button" class="btn" data-a="openAdd">' + icon('plus', 18) + esc(t('home.addFirst')) + '</button></div></section>');
    }

    const grid = [];
    if (!noData) grid.push(calendarCard(s));
    if (S.profile.notif.pay) grid.push('<section class="card" aria-labelledby="up-h"><h2 id="up-h" class="h3">' + esc(t('home.upH')) + '</h2>' + (s.upcomingList.length ? '<ul class="list">' + s.upcomingList.map((u) => '<li class="li"><span class="dot" style="background:' + NZ.CATS[u.cat].color + '"></span><span class="grow"><b>' + esc(u.merchant) + '</b><span class="muted small">' + esc(NZ.fmtDate(u.date)) + ' · ' + esc(t('cat.' + u.cat)) + '</span></span><b>' + M(-u.amount) + '</b></li>').join('') + '</ul>' : '<p class="muted">' + esc(t('home.upNone')) + '</p>') + '</section>');
    const tips = S.profile.notif.tips ? NZ.tips(S, td) : [];
    if (tips.length) grid.push('<section class="span-2" aria-labelledby="tips-h"><h2 id="tips-h" class="h3">' + esc(t('home.tipsH')) + '</h2><div class="tips">' + tips.map(tipCard).join('') + '</div></section>');
    grid.push(goalsStrip());
    if (!noData) grid.push(recentCard());
    parts.push('<div class="home-grid">' + grid.join('') + '</div>');
    return parts.join('');
  }
  const frow = (a, b) => '<div><dt>' + esc(a) + '</dt><dd>' + esc(b) + '</dd></div>';

  function calendarCard(s) {
    const td = today();
    const ym = ui.calYm || NZ.ym(td);
    const n = NZ.daysInMonth(ym);
    const first = ym + '-01';
    const lead = NZ.weekdayMon0(first);
    const days = {};
    NZ.spendIn(S.txs, first, NZ.addMonths(ym, 1) + '-01').forEach((x) => { days[x.date] = (days[x.date] || 0) - x.amount; });
    const sel = ui.selDay && NZ.ym(ui.selDay) === ym ? ui.selDay : (NZ.ym(td) === ym ? td : first);
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span></span>';
    for (let d = 1; d <= n; d++) {
      const iso = ym + '-' + String(d).padStart(2, '0');
      const fut = iso > td;
      const lvl = NZ.dayLevel(days[iso] || 0, s.base);
      const lab = NZ.fmtDate(iso) + ', ' + (fut ? t('home.future') : days[iso] ? M(days[iso]) + ', ' + (lvl >= 3 ? t('home.over') : t('home.within')) : t('home.none'));
      cells += '<button type="button" class="day l' + lvl + (iso === td ? ' is-today' : '') + '" data-a="day" data-v="' + iso + '" aria-pressed="' + (iso === sel) + '" aria-label="' + esc(lab) + '" ' + (fut ? 'disabled' : '') + '>' + d + '</button>';
    }
    const daySum = days[sel] || 0;
    const over = NZ.dayLevel(daySum, s.base) >= 3;
    const ops = S.txs.filter((x) => x.date === sel && NZ.isSpend(x)).sort((a, b) => a.amount - b.amount).slice(0, 4);
    const canNext = ym < NZ.ym(td);
    return '<section class="card" aria-labelledby="cal-h"><div class="row-between"><h2 id="cal-h" class="h3">' + esc(t('home.cal')) + '</h2><div class="row-gap"><button type="button" class="icon-btn icon-btn-sm" data-a="calMove" data-v="-1" aria-label="' + esc(t('home.calPrev')) + '">' + icon('back', 16) + '</button><span class="small cap">' + esc(NZ.monthName(ym)) + '</span><button type="button" class="icon-btn icon-btn-sm" data-a="calMove" data-v="1" aria-label="' + esc(t('home.calNext')) + '" ' + (canNext ? '' : 'disabled') + '>' + icon('chev', 16) + '</button></div></div>' +
      '<div class="cal-head" aria-hidden="true">' + t('wd').map((w) => '<span>' + w + '</span>').join('') + '</div><div class="cal">' + cells + '</div>' +
      '<div class="legend" aria-hidden="true"><span class="small muted">0</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span class="small muted">' + esc(t('home.over')) + '</span></div>' +
      '<div class="day-panel"><div class="row-between"><div><span class="muted small">' + esc(NZ.fmtDate(sel, true)) + '</span><b class="h3 block">' + M(daySum) + '</b></div>' + (daySum ? '<span class="pill ' + (over ? 'pill-warn' : 'pill-ok') + '">' + esc(over ? t('home.over') : t('home.within')) + '</span>' : '') + '</div>' +
      (ops.length ? '<ul class="list">' + ops.map(txRow).join('') + '</ul>' : '') + '</div></section>';
  }
  function txRow(x) {
    return '<li><button type="button" class="li li-btn" data-a="openTx" data-v="' + x.id + '"><span class="dot" style="background:' + NZ.CATS[x.cat].color + '"></span><span class="grow"><b>' + esc(x.merchant) + '</b><span class="muted small">' + esc(t('cat.' + x.cat)) + (x.own ? ' · ' + esc(t('st.notSpend')) : '') + (x.confidence < 0.7 && !x.own ? ' · <span class="warn-t">' + esc(t('st.check')) + '</span>' : '') + '</span></span><b class="' + (x.amount > 0 ? 'pos' : '') + '">' + M(x.amount, { sign: true }) + '</b></button></li>';
  }
  function tipCard(tp) {
    const C = (c) => t('cat.' + c);
    let title = ''; let body = '';
    if (tp.kind === 'cafe') { title = t('tip.cafe', tp.n, tp.pct); body = t('tip.cafeB', M(tp.save)); }
    if (tp.kind === 'cafe2') { title = t('tip.cafe2', tp.n); body = t('tip.cafeB', M(tp.save)); }
    if (tp.kind === 'subs') { title = t('tip.subs', tp.n, M(tp.sum)); body = t('tip.subsB'); }
    if (tp.kind === 'inst') { title = t('tip.inst', M(tp.sum), NZ.fmtDate(tp.date)); body = t('tip.instB'); }
    if (tp.kind === 'weekday') { title = t('tip.weekday', t('wdPlural')[tp.day], tp.pct); body = t('tip.weekdayB'); }
    if (tp.kind === 'env') { title = t('tip.env', C(tp.cat), M(tp.by)); body = t('tip.envB', M(tp.amount), C(tp.from)); }
    const actKey = tp.action.indexOf('numa:') === 0 ? tp.action.slice(5) : tp.action;
    return '<article class="tip"><h3 class="h4">' + esc(title) + '</h3><p class="muted small">' + esc(body) + '</p><div class="tip-foot"><span class="small muted">' + esc(t('home.saveL')) + '</span><b class="teal">' + (tp.save ? '≈ ' + M(tp.save) : esc(t('tip.noSave'))) + '</b></div><div class="row-gap"><button type="button" class="btn btn-sm btn-primary" data-a="tipAct" data-v="' + tp.id + '">' + esc(t('tip.act.' + actKey)) + '</button><button type="button" class="link small" data-a="tipHide" data-v="' + tp.id + '">' + esc(t('tip.hide')) + '</button></div></article>';
  }
  function goalsStrip() {
    const gs = S.goals.filter((g) => g.saved < g.target);
    return '<section class="card" aria-labelledby="g-h"><div class="row-between"><h2 id="g-h" class="h3">' + esc(t('home.goalsH')) + '</h2><a href="#goals" class="link">' + esc(t('home.allGoals')) + '</a></div>' +
      (gs.length ? '<ul class="list">' + gs.slice(0, 3).map((g) => { const st = NZ.goalStatus(g, today()); return '<li class="goal-mini"><div class="row-between"><b>' + esc(g.name) + '</b><span class="small muted">' + st.pct + '%</span></div><div class="bar"><i style="width:' + st.pct + '%"></i></div><span class="small muted">' + M(g.saved) + ' / ' + M(g.target) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted">' + esc(t('goal.emptyS')) + '</p><a class="btn btn-sm" href="#goals">' + esc(t('goal.add')) + '</a>') + '</section>';
  }
  function recentCard() {
    const list = S.txs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, 6);
    return '<section class="card" aria-labelledby="r-h"><div class="row-between"><h2 id="r-h" class="h3">' + esc(t('home.recentH')) + '</h2><a href="#ops" class="link">' + esc(t('st.allOps')) + '</a></div><ul class="list">' + list.map(txRow).join('') + '</ul></section>';
  }

  /* ================= КОНВЕРТЫ ================= */
  function viewEnvelopes() {
    const td = today();
    const env = NZ.envelopes(S, td);
    const inc = S.profile.income || 0;
    const reserve = NZ.sum(S.goals.filter((g) => g.saved < g.target), (g) => g.monthly || 0);
    const alloc = NZ.sum(env, (e) => e.limit);
    const head = '<header class="page-head"><h1 class="h2">' + esc(t('env.title')) + '</h1><button type="button" class="btn btn-sm" data-a="envAdd">' + esc(t('env.addCat')) + '</button></header>';
    if (!env.length) return head + '<section class="card empty"><h2 class="h3">' + esc(t('env.emptyT')) + '</h2><p class="muted">' + esc(t('env.emptyS')) + '</p><div class="row-gap wrap"><button type="button" class="btn btn-primary" data-a="envSuggest">' + esc(t('env.suggest')) + '</button><button type="button" class="btn" data-a="envAdd">' + esc(t('env.manual')) + '</button></div></section>';
    const seg = env.map((e) => '<i style="flex:' + e.limit + ';background:' + NZ.CATS[e.cat].color + '"></i>').join('') + (reserve ? '<i style="flex:' + reserve + ';background:var(--accent)"></i>' : '');
    const f = ui.envFilter;
    const shown = env.filter((e) => f === 'all' || (f === 'over' ? e.state === 'over' : e.state !== 'over'));
    const tip = NZ.tips(Object.assign({}, S, { dismissed: {} }), td).find((x) => x.kind === 'env');
    return head + '<section class="card"><div class="row-between"><span class="muted">' + esc(t('env.allocated')) + '</span><span class="muted small">' + esc(inc ? t('env.ofIncome', M(inc)) : '') + '</span></div><b class="h2 block">' + M(alloc + reserve) + '</b><div class="segbar" aria-hidden="true">' + seg + '</div>' + (reserve ? '<span class="small teal">' + esc(t('env.auto', M(reserve))) + '</span>' : '') + '</section>' +
      '<div class="seg" role="group">' + ['all', 'over', 'ok'].map((k) => '<button type="button" data-a="envFilter" data-v="' + k + '" aria-pressed="' + (f === k) + '">' + esc(t('env.' + k)) + '</button>').join('') + '</div>' +
      '<ul class="env-list">' + shown.map((e) => '<li><button type="button" class="env" data-a="envOpen" data-v="' + e.cat + '"><span class="env-ic" style="background:' + NZ.CATS[e.cat].color + '" aria-hidden="true">' + esc(t('cat.' + e.cat)[0]) + '</span><span class="grow"><b>' + esc(t('cat.' + e.cat)) + '</b><span class="small muted">' + esc(t('env.meta', M(e.spent), M(e.limit))) + (e.state === 'almost' ? ' · ' + esc(t('env.almost')) : '') + '</span></span><b class="' + (e.state === 'over' ? 'warn-t' : 'teal') + '">' + esc(e.state === 'over' ? t('env.overBy', M(-e.left)) : t('env.left', M(e.left))) + '</b><span class="bar ' + (e.state === 'over' ? 'bar-warn' : '') + '"><i style="width:' + Math.min(100, Math.round(e.ratio * 100)) + '%"></i></span></button></li>').join('') + '</ul>' +
      (tip ? '<section class="card card-ink"><span class="small teal-l">' + esc(t('env.suggestH')) + '</span><p>' + esc(t('env.move', M(tip.amount), t('cat.' + tip.from), t('cat.' + tip.cat))) + '</p><button type="button" class="btn btn-light btn-sm" data-a="envMove" data-from="' + tip.from + '" data-to="' + tip.cat + '" data-v="' + tip.amount + '">' + esc(t('env.moveBtn')) + '</button></section>' : '');
  }

  /* ================= NUMA ================= */
  function viewNuma() {
    const msgs = S.chat.length ? S.chat : [{ role: 'numa', ans: { lead: t('numa.hello'), facts: [], next: '' } }];
    return '<div class="chat"><header class="page-head"><div class="row-gap"><span class="numa-ava" aria-hidden="true">' + icon('numa') + '</span><div><h1 class="h3">Numa</h1><span class="small muted">' + esc(t('numa.knows', t('c.ops', S.txs.length))) + '</span></div></div>' + (S.chat.length ? '<button type="button" class="link small" data-a="clearChat">' + esc(t('numa.clear')) + '</button>' : '') + '</header>' +
      '<div class="chat-log" id="chatlog" aria-live="polite">' + msgs.map((m, i) => m.role === 'user' ? '<div class="msg msg-u">' + esc(m.text) + '</div>' : ansHtml(m.ans, i)).join('') + (ui.thinking ? '<div class="msg msg-n thinking">' + esc(t('numa.thinking')) + '</div>' : '') + '</div>' +
      '<div class="chips" role="group" aria-label="' + esc(t('numa.try')) + '">' + t('numa.chips').map((c, i) => '<button type="button" class="chip-btn" data-a="ask" data-v="' + i + '">' + esc(c) + '</button>').join('') + '</div>' +
      '<form class="chat-form" data-form="chat"><label for="q" class="sr">' + esc(t('numa.ph')) + '</label><input id="q" name="q" autocomplete="off" placeholder="' + esc(t('numa.ph')) + '"><button class="icon-btn icon-btn-primary" type="submit" aria-label="' + esc(t('numa.send')) + '">' + icon('send') + '</button></form></div>';
  }
  function ansHtml(a, i) {
    if (!a) return '';
    return '<div class="msg msg-n"><p>' + esc(a.lead) + '</p>' + (a.facts && a.facts.length ? '<ul class="facts">' + a.facts.map((f) => '<li><span>' + esc(f.label) + '</span>' + (f.value ? '<b class="' + (f.warn ? 'warn-t' : '') + '">' + esc(f.value) + '</b>' : '') + '</li>').join('') + '</ul>' : '') + (a.next ? '<p class="muted">' + esc(a.next) + '</p>' : '') +
      (a.action && !a.done ? '<button type="button" class="btn btn-primary btn-sm" data-a="numaAct" data-v="' + i + '">' + esc(a.action.label) + '</button>' : '') +
      (a.basis ? '<details class="basis"><summary>' + esc(t('numa.basis')) + '</summary><p class="small muted">' + esc(t('numa.basisT', t('c.ops', a.basis.n), NZ.fmtDate(a.basis.from), NZ.fmtDate(a.basis.to))) + '</p></details>' : '') + '</div>';
  }
  function ask(text) {
    if (!text.trim()) return;
    S.chat.push({ role: 'user', text });
    ui.thinking = true; commit();
    setTimeout(() => {
      ui.thinking = false;
      S.chat.push({ role: 'numa', ans: NZ.numaAnswer(S, text, today()) });
      S.chat = S.chat.slice(-60);
      commit();
      const q = document.getElementById('q'); if (q) q.focus();
    }, 350);
  }

  /* ================= ВЫПИСКИ ================= */
  function importBlock(onb) {
    if (ui.importing) {
      const k = ui.importing.step;
      return '<section class="card" aria-live="polite"><ol class="steps">' + t('st.steps').map((s, i) => '<li class="' + (i < k ? 'done' : i === k ? 'now' : '') + '"><span class="tick" aria-hidden="true">' + (i < k ? icon('check', 14) : '') + '</span>' + esc(s) + '</li>').join('') + '</ol><button type="button" class="btn btn-sm" data-a="importCancel">' + esc(t('st.cancel')) + '</button></section>';
    }
    let out = '';
    if (ui.importErr) out += '<p class="err-box" role="alert">' + esc(ui.importErr) + '</p>';
    if (ui.importResult && !onb) {
      const r = ui.importResult;
      out += '<section class="card"><div class="row-gap">' + icon('file', 22) + '<div class="grow"><b>' + esc(r.name) + '</b><span class="small muted block">' + esc((r.bank || '') + ' · ' + NZ.fmtDate(r.from) + ' — ' + NZ.fmtDate(r.to)) + '</span></div><span class="teal small"><b>' + esc(t('c.done')) + '</b></span></div><div class="grid-3 mt-12">' +
        [r.count, r.cats, r.rec].map((v, i) => '<div class="stat"><b>' + v + '</b><span class="small muted">' + esc(t('st.stats')[i]) + '</span></div>').join('') + '</div>' +
        (r.dups ? '<p class="small muted">' + esc(t('st.dups', r.dups)) + '</p>' : '') +
        (r.review ? '<div class="row-between banner"><span>' + esc(t('st.review', r.review)) + '</span><a class="btn btn-sm" href="#ops" data-a="reviewOps">' + esc(t('st.reviewBtn')) + '</a></div>' : '') + '</section>';
    }
    out += '<section class="card stack-14"><h2 class="h3">' + esc(t('st.howH')) + '</h2><ol class="how">' + t('st.how').map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<label class="drop" for="file">' + icon('upload', 30) + '<b>' + esc(t('st.choose')) + '</b><span class="small muted">' + esc(t('st.formats')) + '</span><input id="file" type="file" accept=".pdf,.csv,application/pdf,text/csv" data-ch="file"></label>' +
      '<button type="button" class="btn" data-a="loadDemo">' + esc(onb ? t('onb.demo') : t('st.demo')) + '</button>' +
      '<p class="note">' + icon('lock', 18) + '<span>' + esc(t('st.privacy')) + '</span></p></section>';
    return out;
  }
  function viewStatements() {
    const hist = S.imports.slice().reverse();
    const last = S.imports.length ? S.imports[S.imports.length - 1] : null;
    const lastTx = last ? S.txs.filter((x) => x.importId === last.id).sort((a, b) => a.confidence - b.confidence).slice(0, 8) : [];
    return '<header class="page-head"><h1 class="h2">' + esc(t('st.title')) + '</h1></header>' + importBlock(false) +
      (lastTx.length ? '<section class="card"><h2 class="h3">' + esc(t('st.txH')) + '</h2><p class="small muted">' + esc(t('st.fix')) + '</p><ul class="list">' + lastTx.map(txRow).join('') + '</ul><a class="link" href="#ops">' + esc(t('st.allOps')) + '</a></section>' : '') +
      (hist.length ? '<section class="card"><h2 class="h3">' + esc(t('st.hist')) + '</h2><ul class="list">' + hist.map((h) => '<li class="li">' + icon('file') + '<span class="grow"><b>' + esc(h.name) + '</b><span class="small muted">' + esc(t('c.ops', h.count) + ' · ' + NZ.fmtDate(h.from) + ' — ' + NZ.fmtDate(h.to)) + '</span></span><button type="button" class="btn btn-sm" data-a="rmImport" data-v="' + h.id + '">' + esc(t('st.rm')) + '</button></li>').join('') + '</ul></section>' : '');
  }
  async function handleFile(file) {
    ui.importErr = null; ui.importResult = null;
    if (!file) return;
    const name = file.name || 'statement';
    const isPdf = /\.pdf$/i.test(name) || file.type === 'application/pdf';
    const isCsv = /\.csv$/i.test(name) || /csv|text\/plain/.test(file.type || '');
    if (!isPdf && !isCsv) { ui.importErr = t('st.errType'); render(); return; }
    if (file.size > 10 * 1024 * 1024) { ui.importErr = t('st.errSize'); render(); return; }
    const token = {}; ui.importing = { step: 0, token }; render();
    const tick = (k) => new Promise((r) => setTimeout(() => { if (ui.importing && ui.importing.token === token) { ui.importing.step = k; render(); } r(); }, 280));
    try {
      let parsed;
      if (isPdf) {
        const buf = await file.arrayBuffer();
        let lines;
        try { lines = await NZ.pdfLines(new Uint8Array(buf)); } catch (e) {
          ui.importing = null; ui.importErr = e && /password/i.test(e.name + e.message) ? t('st.errPw') : t('st.errRead'); render(); return;
        }
        parsed = NZ.parseLines(lines, S.rules);
      } else parsed = NZ.parseCsv(await file.text(), S.rules);
      await tick(1); await tick(2); await tick(3);
      if (!ui.importing || ui.importing.token !== token) return; // отменили
      finishImport(parsed, name);
      await tick(4);
    } catch (e) { console.error(e); ui.importing = null; ui.importErr = t('st.errRead'); render(); }
  }
  // Файл, которым поделились из другого приложения (Kaspi → «Поделиться» → NUMMAZA).
  // Android-часть кладёт его в мост NummazaNative; если пользователь ещё не вошёл — ждём входа.
  function pullShared() {
    const N = window.NummazaNative;
    if (!N || typeof N.takeSharedFile !== 'function') return;
    let j = null;
    try { j = JSON.parse(N.takeSharedFile() || 'null'); } catch (e) { j = null; }
    if (!j) return;
    if (j.error || !j.data) {
      ui.importErr = t(j.error === 'size' ? 'st.errSize' : 'st.errRead');
      if (S.account && S.session && S.profile.onboarded) go('statements'); else render();
      return;
    }
    const bin = atob(j.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    shared = new File([bytes], j.name || 'statement.pdf', { type: j.type || '' });
    if (S.account && S.session) useShared(); else render();
  }
  function useShared() {
    if (!shared || !S.account || !S.session || ui.importing) return;
    const f = shared; shared = null;
    ui.sheet = null;
    if (S.profile.onboarded) go('statements');
    handleFile(f);
  }
  function finishImport(parsed, name, demo) {
    ui.importing = null;
    if (!parsed.txs.length) { ui.importErr = t('st.errEmpty'); render(); return; }
    const before = snapshot();
    const id = NZ.uid();
    const { added, dups } = NZ.mergeTxs(S.txs, parsed.txs);
    added.forEach((x) => { x.importId = id; });
    S.txs = S.txs.concat(added);
    const dates = parsed.txs.map((x) => x.date).sort();
    if (added.length) S.imports.push({ id, name, bank: parsed.bank || 'Kaspi', count: added.length, from: dates[0], to: dates[dates.length - 1], at: today(), demo: !!demo });
    if (demo) S.demo = true;
    if (!Object.keys(S.envelopes).length) S.envelopes = NZ.suggestLimits(S, today());
    ui.importResult = { name, bank: parsed.bank || 'Kaspi', from: dates[0], to: dates[dates.length - 1], count: added.length, dups, cats: new Set(added.filter(NZ.isSpend).map((x) => x.cat)).size, rec: NZ.recurring(S.txs, today()).length, review: added.filter((x) => x.confidence < 0.7 && !x.own).length };
    if (!S.profile.onboarded) { finishOnb(); toast(t('st.resH')); return; }
    NZ.save(S); render(); toast(t('st.resH'), restore(before));
  }
  function loadDemo() {
    const td = today();
    const rows = NZ.demoTxs(td).map((r) => NZ.makeTx(r.date, r.amount, r.raw, r.op === 'Покупка' ? 'buy' : r.op === 'Перевод' ? 'transfer' : 'topup', 'statement', S.rules));
    if (!S.profile.income) S.profile.income = 650000;
    S.profile.payday = S.profile.payday || 5;
    if (!S.goals.length) {
      const g = newGoal(t('onb.goals')[0][0], 1950000, 780000, 18);
      g.history = [{ date: NZ.addDays(td, -20), amount: 60000 }];
      S.goals.push(g);
    }
    finishImport({ bank: 'Kaspi', txs: rows }, 'kaspi_gold_' + t('c.example') + '.pdf', true);
  }

  /* ================= ВСЕ ОПЕРАЦИИ ================= */
  function viewOps() {
    const q = ui.opsQuery.toLowerCase();
    let list = S.txs.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    if (ui.opsReview) list = list.filter((x) => x.confidence < 0.7 && !x.own);
    if (q) list = list.filter((x) => (x.merchant + ' ' + x.raw + ' ' + t('cat.' + x.cat)).toLowerCase().includes(q));
    const groups = {};
    list.slice(0, 300).forEach((x) => { (groups[x.date] = groups[x.date] || []).push(x); });
    return '<header class="page-head"><h1 class="h2">' + esc(t('st.allOps')) + '</h1></header>' +
      '<div class="row-gap wrap"><label class="search grow"><span class="sr">' + esc(t('st.search')) + '</span>' + icon('search', 18) + '<input id="ops-q" type="search" data-in="opsq" value="' + esc(ui.opsQuery) + '" placeholder="' + esc(t('st.search')) + '"></label><button type="button" class="chip-btn" data-a="opsReview" aria-pressed="' + ui.opsReview + '">' + esc(t('st.check')) + '</button></div>' +
      '<div id="ops-list">' + opsList(groups) + '</div>';
  }
  function opsList(groups) {
    const keys = Object.keys(groups);
    if (!keys.length) return '<p class="muted">' + esc(t('st.none')) + '</p>';
    return keys.map((d) => '<section class="card"><h2 class="small muted cap">' + esc(NZ.fmtDate(d, true)) + '</h2><ul class="list">' + groups[d].map(txRow).join('') + '</ul></section>').join('');
  }

  /* ================= ЦЕЛИ ================= */
  function viewGoals() {
    const td = today();
    const active = S.goals.filter((g) => g.saved < g.target);
    const done = S.goals.filter((g) => g.saved >= g.target);
    const total = NZ.sum(S.goals, (g) => g.saved);
    const monthly = NZ.sum(active, (g) => g.monthly || 0);
    const head = '<header class="page-head"><h1 class="h2">' + esc(t('goal.title')) + '</h1><button type="button" class="btn btn-primary btn-sm" data-a="goalNew">' + esc(t('goal.add')) + '</button></header>';
    if (!S.goals.length) return head + '<section class="card empty"><h2 class="h3">' + esc(t('goal.emptyT')) + '</h2><p class="muted">' + esc(t('goal.emptyS')) + '</p><button type="button" class="btn btn-primary" data-a="goalNew">' + esc(t('goal.newT')) + '</button></section>';
    return head + '<section class="card card-ink"><span class="small teal-l">' + esc(t('goal.total')) + '</span><b class="h1">' + M(total) + '</b>' + (monthly ? '<span class="small">' + esc(t('goal.auto', M(monthly))) + '</span>' : '') + '</section>' +
      '<div class="goal-grid">' + active.map((g) => {
        const st = NZ.goalStatus(g, td);
        const stC = st.status === 'behind' ? 'pill-warn' : 'pill-ok';
        const extra = st.status === 'behind' ? '<p class="small muted">' + esc(t('goal.twoWays', M(st.needMonthly), t('c.months', Math.max(1, Math.ceil(((g.target - g.saved) / Math.max(1, g.monthly || 1)) - st.monthsLeft))))) + '</p>' : '';
        return '<article class="card goal"><div class="jar" role="img" aria-label="' + esc(g.name + ': ' + st.pct + '%') + '"><i style="height:' + st.pct + '%"></i></div><div class="grow stack-6"><div class="row-between"><h2 class="h4">' + esc(g.name) + '</h2><span class="pill ' + stC + '">' + esc(t('goal.' + st.status)) + '</span></div><span>' + M(g.saved) + ' / ' + M(g.target) + '</span><span class="small muted">' + esc(t('goal.need', M(st.needMonthly)) + ' · ' + NZ.fmtDate(g.deadline) + ' ' + g.deadline.slice(0, 4)) + '</span>' + extra + '<div class="row-gap"><button type="button" class="btn btn-primary btn-sm" data-a="goalAdd" data-v="' + g.id + '">' + esc(t('goal.contribute')) + '</button><button type="button" class="btn btn-sm" data-a="goalEdit" data-v="' + g.id + '">' + esc(t('c.edit')) + '</button></div></div></article>';
      }).join('') + '</div>' +
      (done.length ? '<details class="card"><summary class="h4">' + esc(t('goal.archive')) + ' · ' + done.length + '</summary><ul class="list">' + done.map((g) => '<li class="li"><span class="grow"><b>' + esc(g.name) + '</b></span><b>' + M(g.saved) + '</b></li>').join('') + '</ul></details>' : '');
  }
  function contribute(g, amount) {
    const before = snapshot();
    const prevPct = Math.floor((g.saved / g.target) * 100);
    g.saved += amount;
    g.history = (g.history || []).concat([{ date: today(), amount }]);
    const pct = Math.floor((g.saved / g.target) * 100);
    NZ.save(S);
    if (g.saved >= g.target) { openSheet('celebrate', { id: g.id }); render(); return; }
    const ms = [25, 50, 75].filter((m) => prevPct < m && pct >= m).pop();
    render();
    toast(ms ? t('goal.milestone', ms) + ' · ' + t('goal.contributed', M(amount), g.name) : t('goal.contributed', M(amount), g.name), restore(before));
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* нет вибрации */ }
  }

  /* ================= ПРОФИЛЬ ================= */
  function viewProfile() {
    const a = S.account;
    const masked = a.login.indexOf('@') > 0 ? a.login.replace(/^(.).*(@.*)$/, '$1•••$2') : a.login.replace(/^(\+7\d)\d{5}(\d{4})$/, '$1•• ••• $2');
    const sw = (k) => '<button type="button" role="switch" class="switch" aria-checked="' + !!S.profile.notif[k] + '" aria-labelledby="sw-' + k + '" data-a="notif" data-v="' + k + '"><i></i></button>';
    const rules = Object.keys(S.rules);
    return '<header class="page-head"><h1 class="h2">' + esc(t('prof.title')) + '</h1></header>' +
      '<section class="card row-gap"><span class="ava ava-lg" aria-hidden="true">' + esc(a.name[0].toUpperCase()) + '</span><div class="grow"><b>' + esc(a.name) + '</b><span class="small muted block">' + esc(masked) + '</span></div></section>' +
      '<section class="card stack-14"><h2 class="cap small muted">' + esc(t('prof.appearance')) + '</h2><div class="field"><span>' + esc(t('c.lang')) + '</span>' + langSwitch().replace('seg-sm', 'seg-full') + '</div><div class="field"><span>' + esc(t('c.theme')) + '</span><div class="seg seg-full" role="group" aria-label="' + esc(t('c.theme')) + '">' + ['light', 'dark', 'system'].map((k) => '<button type="button" data-a="theme" data-v="' + k + '" aria-pressed="' + (S.profile.theme === k) + '">' + esc(t('c.' + k)) + '</button>').join('') + '</div></div></section>' +
      '<section class="card stack-14"><h2 class="cap small muted">' + esc(t('prof.budget')) + '</h2><label class="field"><span>' + esc(t('prof.income')) + '</span><input id="p-income" inputmode="numeric" data-ch="income" value="' + esc(String(S.profile.income || '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) + '"></label><label class="field"><span>' + esc(t('prof.payday')) + '</span><select id="p-payday" data-ch="payday">' + Array.from({ length: 28 }, (_, i) => '<option value="' + (i + 1) + '" ' + (S.profile.payday === i + 1 ? 'selected' : '') + '>' + (i + 1) + '</option>').join('') + '</select></label></section>' +
      (SERVER() && S.sync ? syncCard() : '') +
      '<section class="card stack-14"><h2 class="cap small muted">' + esc(t('prof.notif')) + '</h2><div class="row-between"><span id="sw-pay">' + esc(t('prof.nPay')) + '</span>' + sw('pay') + '</div><div class="row-between"><span id="sw-tips">' + esc(t('prof.nTips')) + '</span>' + sw('tips') + '</div><p class="small muted">' + esc(t('prof.notifNote')) + '</p></section>' +
      '<section class="card stack-10"><h2 class="cap small muted">' + esc(t('prof.data')) + '</h2><a class="li li-link" href="#ops"><span class="grow">' + esc(t('st.allOps')) + '</span>' + icon('chev', 16) + '</a><a class="li li-link" href="#statements"><span class="grow">' + esc(t('st.hist')) + '</span>' + icon('chev', 16) + '</a>' +
      '<details><summary class="li li-link">' + esc(t('prof.rules')) + ' · ' + rules.length + '</summary>' + (rules.length ? '<ul class="list">' + rules.map((k) => '<li class="li"><span class="grow">' + esc(k) + ' → ' + esc(t('cat.' + S.rules[k])) + '</span><button type="button" class="icon-btn icon-btn-sm" data-a="ruleDel" data-v="' + esc(k) + '" aria-label="' + esc(t('prof.ruleDel')) + '">' + icon('trash', 16) + '</button></li>').join('') + '</ul>' : '<p class="small muted">' + esc(t('prof.rulesNone')) + '</p>') + '</details>' +
      '<button type="button" class="li li-link" data-a="clearChat"><span class="grow">' + esc(t('prof.clearChat')) + '</span></button></section>' +
      '<button type="button" class="btn btn-lg btn-danger-t" data-a="logout">' + esc(t('prof.logout')) + '</button><a class="link center" href="#delete">' + esc(t('prof.delAcc')) + '</a><p class="small muted center">' + esc(t('prof.version')) + '</p>';
  }
  function syncCard() {
    const sy = S.sync;
    const hhmm = (ms) => { const d = new Date(ms); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const lines = [];
    if (navigator.onLine === false) lines.push(t('prof.syncOffline'));
    else if (sy.error) lines.push(t('prof.syncErr'));
    lines.push(sy.lastAt ? t('prof.syncOk', hhmm(sy.lastAt)) : t('prof.syncNever'));
    if (sy.outbox.length) lines.push(t('prof.syncPending', sy.outbox.length));
    return '<section class="card stack-10" aria-labelledby="sync-h"><h2 id="sync-h" class="cap small muted">' + esc(t('prof.sync')) + '</h2><p class="small" id="sync-status" role="status">' + lines.map(esc).join('<br>') + '</p><button type="button" class="btn btn-sm" data-a="syncNow">' + esc(t('prof.syncNow')) + '</button></section>';
  }
  function viewDelete() {
    const w = t('del.word');
    return '<div class="solo"><div class="solo-in"><a class="link" href="#profile">' + icon('back', 18) + esc(t('c.back')) + '</a><h1 class="h1">' + esc(t('del.title')) + '</h1><p>' + esc(t('del.text')) + '</p><form class="stack-14" data-form="delete"><label class="field"><span>' + esc(t('del.label', w)) + '</span><input id="del-w" autocomplete="off" data-in="delw"></label><button class="btn btn-lg btn-danger" type="submit" id="del-btn" disabled>' + esc(t('del.btn')) + '</button></form></div></div>';
  }

  /* ================= ИТОГИ МЕСЯЦА ================= */
  function viewRecap() {
    const ym = ui.recapYm || NZ.addMonths(NZ.ym(today()), -1);
    const st = NZ.monthStats(S, ym);
    const mn = NZ.monthName(ym);
    const close = '<a class="icon-btn" href="#home" aria-label="' + esc(t('c.close')) + '">' + icon('close') + '</a>';
    if (st.count < 10) return '<div class="recap r0"><div class="recap-top"><b>nummaza</b>' + close + '</div><div class="recap-body"><p class="recap-sub">' + esc(t('recap.noData')) + '</p><a class="btn btn-light" href="#statements">' + esc(t('home.loadSt')) + '</a></div></div>';
    const H = (x) => (ui.hideSums ? '•••' : M(x));
    const cards = [
      [t('recap.kicker'), mn, t('recap.sub')],
      [t('recap.spent'), H(st.total), st.change === null ? '' : st.change > 2 ? t('recap.more', st.change) : st.change < -2 ? t('recap.less', -st.change) : t('recap.same')],
      [t('recap.habit'), t('recap.habitBig', st.cafeCount), t('recap.habitSub', H(st.cafeSum))],
      [t('recap.best'), st.best ? NZ.fmtDate(st.best.date) : '—', st.best ? t('recap.bestSub', H(st.best.sum), st.daysInLimit, st.days) : ''],
      [t('recap.saved'), st.saved ? '+' + H(st.saved) : '0', st.saved ? t('recap.savedSub') : t('recap.savedNone')]
    ];
    const i = Math.min(ui.recapIdx, cards.length - 1);
    const c = cards[i];
    const bars = i === 1 ? '<ul class="recap-bars">' + st.top.map((x) => '<li><span>' + esc(t('cat.' + x.cat)) + '</span><b>' + H(x.sum) + '</b><i style="width:' + Math.round((x.sum / st.top[0].sum) * 100) + '%"></i></li>').join('') + '</ul>' : '';
    return '<div class="recap r' + i + '"><div class="recap-segs" aria-hidden="true">' + cards.map((_, k) => '<span class="' + (k <= i ? 'on' : '') + '"></span>').join('') + '</div>' +
      '<div class="recap-top"><b>nummaza · ' + esc(mn) + '</b>' + close + '</div>' +
      '<section class="recap-body" aria-live="polite" aria-label="' + esc(t('recap.card', i + 1, cards.length)) + '"><span class="recap-k">' + esc(c[0]) + '</span><h1 class="recap-big">' + esc(c[1]) + '</h1><p class="recap-sub">' + esc(c[2]) + '</p>' + bars + '</section>' +
      '<button type="button" class="tap tap-l" data-a="recapPrev" aria-label="' + esc(t('recap.prev')) + '"></button><button type="button" class="tap tap-r" data-a="recapNext" aria-label="' + esc(t('recap.nextC')) + '"></button>' +
      '<div class="recap-foot">' + (i === cards.length - 1 ? '<a class="btn btn-light btn-lg" href="#goals">' + esc(t('recap.goalNext')) + '</a>' : '') +
      '<label class="check check-light"><input type="checkbox" data-ch="hideSums" ' + (ui.hideSums ? 'checked' : '') + '><span>' + esc(t('recap.hide')) + '</span></label>' +
      '<div class="row-gap"><button type="button" class="btn btn-outline-light grow" data-a="recapShare">' + icon('share', 18) + esc(t('recap.share')) + '</button><button type="button" class="icon-btn icon-btn-light" data-a="recapNext" aria-label="' + esc(t('recap.nextC')) + '">' + icon('send') + '</button></div></div></div>';
  }

  /* ================= ЛИСТЫ (диалоги снизу) ================= */
  function openSheet(name, data) { ui.returnFocus = document.activeElement; ui.sheet = name; ui.sheetData = data || {}; renderSheet(); }
  function closeSheet() {
    if (ui.sheet === 'add' && ui.add && ui.add.amount) S.draft = Object.assign({}, ui.add, { ts: Date.now() }), NZ.save(S);
    ui.sheet = null; ui.sheetData = null; renderSheet();
    if (ui.returnFocus && document.body.contains(ui.returnFocus)) ui.returnFocus.focus();
  }
  let sheetBusy = false;
  function renderSheet() {
    if (sheetBusy) return;
    sheetBusy = true;
    try { renderSheetNow(); } finally { sheetBusy = false; }
  }
  function renderSheetNow() {
    const el = document.getElementById('sheet');
    if (!el) return;
    if (!ui.sheet) { el.innerHTML = ''; document.body.classList.remove('has-sheet'); return; }
    const views = { add: sheetAdd, tx: sheetTx, env: sheetEnv, envAdd: sheetEnvAdd, goal: sheetGoal, goalAdd: sheetGoalAdd, celebrate: sheetCelebrate, forgot: sheetForgot, confirm: sheetConfirm };
    const [title, body] = views[ui.sheet]();
    el.innerHTML = '<div class="scrim" data-a="closeSheet"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-h"><div class="sheet-head"><h2 id="sheet-h" class="h3">' + esc(title) + '</h2><button type="button" class="icon-btn" data-a="closeSheet" aria-label="' + esc(t('c.close')) + '">' + icon('close') + '</button></div><div class="sheet-body">' + body + '</div></div>';
    document.body.classList.add('has-sheet');
    const f = el.querySelector('[data-autofocus]') || el.querySelector('.sheet button, .sheet input');
    if (f && !el.contains(document.activeElement)) f.focus();
  }

  // --- Новая операция
  function openAdd() {
    const d = S.draft && Date.now() - S.draft.ts < 10 * 60000 ? S.draft : null;
    const lastCat = (S.txs.filter((x) => x.source === 'manual' && x.amount < 0).slice(-1)[0] || {}).cat;
    ui.add = d ? Object.assign({}, d) : { type: 'exp', amount: '', cat: lastCat && NZ.MANUAL_EXP.includes(lastCat) ? lastCat : 'groceries', method: 0, date: today(), merchant: '' };
    S.draft = null; NZ.save(S);
    openSheet('add');
    if (d) toast(t('add.draft'));
  }
  function sheetAdd() {
    const a = ui.add;
    const n = parseInt(a.amount || '0', 10);
    const cats = a.type === 'exp' ? NZ.MANUAL_EXP : NZ.MANUAL_INC;
    let hint = '';
    if (a.type === 'inc') hint = t('add.incHint');
    else if (S.envelopes[a.cat] != null) {
      const e = NZ.envelopes(S, today()).find((x) => x.cat === a.cat);
      const left = (e ? e.left : 0) - n;
      hint = left >= 0 ? t('add.left', t('cat.' + a.cat), M(left)) : '<span class="warn-t">' + esc(t('add.over', t('cat.' + a.cat), M(-left))) + '</span>';
    } else hint = t('add.noEnv');
    if (hint.indexOf('<span') !== 0) hint = esc(hint);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
    return [t('add.title'), '<div class="seg seg-full" role="group">' + ['exp', 'inc'].map((k) => '<button type="button" data-a="addType" data-v="' + k + '" aria-pressed="' + (a.type === k) + '">' + esc(t('add.' + k)) + '</button>').join('') + '</div>' +
      '<div class="amount"><output aria-live="polite" aria-label="' + esc(t('add.amount')) + '" class="' + (a.type === 'inc' ? 'teal' : '') + '">' + (a.type === 'exp' ? '−' : '+') + M(n) + '</output><span class="small">' + hint + '</span></div>' +
      '<div class="cats" role="group">' + cats.map((c) => '<button type="button" class="cat" data-a="addCat" data-v="' + c + '" aria-pressed="' + (a.cat === c) + '"><i style="background:' + NZ.CATS[c].color + '" aria-hidden="true">' + esc(t('cat.' + c)[0]) + '</i><span>' + esc(t('cat.' + c)) + '</span></button>').join('') + '</div>' +
      '<div class="row-gap wrap">' + t('add.methods').map((m, i) => '<button type="button" class="chip-btn" data-a="addMethod" data-v="' + i + '" aria-pressed="' + (a.method === i) + '">' + esc(m) + '</button>').join('') + '</div>' +
      '<div class="grid-2"><label class="field"><span>' + esc(t('add.date')) + '</span><input type="date" id="add-date" data-ch="addDate" value="' + a.date + '" max="' + today() + '" min="' + NZ.addDays(today(), -90) + '"></label><label class="field"><span>' + esc(t('add.where')) + '</span><input id="add-where" data-in="addWhere" value="' + esc(a.merchant) + '" placeholder="' + esc(t('add.wherePh')) + '"></label></div>' +
      '<div class="keypad">' + keys.map((k) => '<button type="button" data-a="key" data-v="' + k + '" ' + (k === 'del' ? 'aria-label="' + esc(t('add.erase')) + '"' : '') + '>' + (k === 'del' ? '←' : k) + '</button>').join('') + '</div>' +
      '<button type="button" class="btn btn-primary btn-lg" data-a="addSave" ' + (n > 0 ? '' : 'disabled') + '>' + esc(t('c.save')) + '</button>'];
  }
  function addSave() {
    const a = ui.add;
    const n = parseInt(a.amount || '0', 10);
    if (!n) return;
    const before = snapshot();
    const amount = a.type === 'exp' ? -n : n;
    const merchant = a.merchant.trim() || t('cat.' + a.cat);
    S.txs.push({ id: NZ.uid(), date: a.date, amount, raw: merchant, op: 'manual', cat: a.cat, own: false, merchant, confidence: 1, source: 'manual', method: t('add.methods')[a.method] });
    ui.add = null; ui.sheet = null; S.draft = null;
    NZ.save(S); render();
    toast(t('c.saved'), restore(before));
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) { /* нет вибрации */ }
  }

  // --- Операция: категория / удаление
  function sheetTx() {
    const x = S.txs.find((y) => y.id === ui.sheetData.id);
    if (!x) return [t('catS.title'), ''];
    const cats = x.amount < 0 ? NZ.EXP_CATS : NZ.INC_CATS;
    return [t('catS.title'), '<div class="li"><span class="grow"><b>' + esc(x.merchant) + '</b><span class="small muted block">' + esc(NZ.fmtDate(x.date) + ' · ' + x.raw) + '</span></span><b>' + M(x.amount, { sign: true }) + '</b></div>' +
      '<div class="cats" role="group">' + cats.map((c) => '<button type="button" class="cat" data-a="setCat" data-v="' + c + '" aria-pressed="' + (x.cat === c) + '"><i style="background:' + NZ.CATS[c].color + '" aria-hidden="true">' + esc(t('cat.' + c)[0]) + '</i><span>' + esc(t('cat.' + c)) + '</span></button>').join('') + '</div>' +
      (x.source !== 'manual' ? '<label class="check"><input type="checkbox" id="tx-always" ' + (ui.sheetData.always === false ? '' : 'checked') + ' data-ch="txAlways"><span>' + esc(t('catS.always', x.merchant)) + '</span></label>' : '') +
      '<button type="button" class="btn btn-danger-t" data-a="delTx">' + icon('trash', 18) + esc(t('catS.delTx')) + '</button>'];
  }

  // --- Конверт
  function sheetEnv() {
    const c = ui.sheetData.cat;
    const td = today();
    const p = NZ.period(td, S.profile.payday);
    const ops = NZ.spendIn(S.txs, p.start, NZ.addDays(td, 1)).filter((x) => x.cat === c).sort((a, b) => (a.date < b.date ? 1 : -1));
    const from = NZ.addMonths(NZ.ym(td), -2) + '-01';
    const hist = NZ.spendIn(S.txs, from, p.start).filter((x) => x.cat === c);
    const months = Math.max(1, new Set(hist.map((x) => NZ.ym(x.date))).size);
    const avg = NZ.sum(hist, (x) => -x.amount) / months;
    const err = ui.sheetData.err;
    return [t('cat.' + c), '<form class="stack-14" data-form="env"><label class="field"><span>' + esc(t('env.limitL')) + '</span><input id="env-lim" inputmode="numeric" data-autofocus value="' + esc(String(S.envelopes[c] || '').replace(/\B(?=(\d{3})+(?!\d))/g, ' ')) + '" aria-invalid="' + !!err + '">' + (avg ? '<span class="hint">' + esc(t('env.limitHint', M(Math.round(avg / 100) * 100))) + '</span>' : '') + (err ? '<span class="err">' + esc(err) + '</span>' : '') + '</label><button class="btn btn-primary" type="submit">' + esc(t('c.save')) + '</button></form>' +
      '<h3 class="h4 mt-16">' + esc(t('env.ops')) + '</h3>' + (ops.length ? '<ul class="list">' + ops.slice(0, 20).map(txRow).join('') + '</ul>' : '<p class="muted small">' + esc(t('env.noOps')) + '</p>') +
      '<button type="button" class="btn btn-danger-t" data-a="envRemove" data-v="' + c + '">' + esc(t('env.remove')) + '</button>'];
  }
  function sheetEnvAdd() {
    const free = NZ.EXP_CATS.filter((c) => S.envelopes[c] == null);
    return [t('env.addCat'), '<div class="cats" role="group">' + free.map((c) => '<button type="button" class="cat" data-a="envPick" data-v="' + c + '"><i style="background:' + NZ.CATS[c].color + '" aria-hidden="true">' + esc(t('cat.' + c)[0]) + '</i><span>' + esc(t('cat.' + c)) + '</span></button>').join('') + '</div>' + (Object.keys(S.envelopes).length ? '' : '<button type="button" class="btn btn-primary" data-a="envSuggest">' + esc(t('env.suggest')) + '</button>')];
  }
  function maxLimitFor(cat) {
    const inc = S.profile.income || 0;
    if (!inc) return Infinity;
    const reserve = NZ.sum(S.goals.filter((g) => g.saved < g.target), (g) => g.monthly || 0);
    const others = NZ.sum(Object.keys(S.envelopes).filter((c) => c !== cat), (c) => S.envelopes[c]);
    return Math.max(0, inc - reserve - others);
  }

  // --- Цели
  function sheetGoal() {
    const g = ui.sheetData.id ? S.goals.find((x) => x.id === ui.sheetData.id) : null;
    const e = ui.sheetData.err || {};
    const dl = g ? g.deadline.slice(0, 7) : NZ.addMonths(NZ.ym(today()), 12);
    return [g ? t('goal.editT') : t('goal.newT'), '<form class="stack-14" data-form="goal"><label class="field"><span>' + esc(t('goal.name')) + '</span><input id="g-name" data-autofocus value="' + esc(g ? g.name : '') + '" placeholder="' + esc(t('goal.namePh')) + '" aria-invalid="' + !!e.name + '">' + (e.name ? '<span class="err">' + esc(e.name) + '</span>' : '') + '</label>' +
      '<div class="grid-2"><label class="field"><span>' + esc(t('goal.target')) + '</span><input id="g-target" inputmode="numeric" data-in="goalCalc" value="' + esc(g ? g.target : '') + '" aria-invalid="' + !!e.target + '">' + (e.target ? '<span class="err">' + esc(e.target) + '</span>' : '') + '</label><label class="field"><span>' + esc(t('goal.saved')) + '</span><input id="g-saved" inputmode="numeric" data-in="goalCalc" value="' + esc(g ? g.saved : '0') + '"></label></div>' +
      '<div class="grid-2"><label class="field"><span>' + esc(t('goal.deadline')) + '</span><input id="g-dl" type="month" data-ch="goalCalc" min="' + NZ.addMonths(NZ.ym(today()), 1) + '" value="' + dl + '"></label><label class="field"><span>' + esc(t('goal.monthly')) + '</span><input id="g-monthly" inputmode="numeric" value="' + esc(g ? g.monthly : '') + '"><span class="hint" id="g-hint"></span></label></div>' +
      '<button class="btn btn-primary btn-lg" type="submit">' + esc(g ? t('c.save') : t('goal.create')) + '</button>' + (g ? '<button type="button" class="btn btn-danger-t" data-a="goalDel" data-v="' + g.id + '">' + esc(t('goal.del')) + '</button>' : '') + '</form>'];
  }
  function goalCalcHint() {
    const v = (id) => parseInt((document.getElementById(id) || {}).value ? document.getElementById(id).value.replace(/\D/g, '') : '0', 10) || 0;
    const dl = (document.getElementById('g-dl') || {}).value;
    const h = document.getElementById('g-hint');
    if (!h || !dl) return;
    const months = Math.max(1, (+dl.slice(0, 4) - +today().slice(0, 4)) * 12 + (+dl.slice(5, 7) - +today().slice(5, 7)));
    const need = Math.ceil(Math.max(0, v('g-target') - v('g-saved')) / months / 1000) * 1000;
    h.textContent = need ? t('goal.monthlyHint', M(need)) : '';
    const m = document.getElementById('g-monthly');
    if (m && !m.dataset.touched) m.value = need || '';
  }
  function sheetGoalAdd() {
    const g = S.goals.find((x) => x.id === ui.sheetData.id);
    const st = NZ.goalStatus(g, today());
    const sugg = [st.needMonthly, 10000, 50000].filter((v, i, a) => v > 0 && a.indexOf(v) === i);
    return [g.name, '<form class="stack-14" data-form="goalAdd"><label class="field"><span>' + esc(t('goal.amount')) + '</span><input id="ga-amt" inputmode="numeric" data-autofocus value="' + (st.needMonthly || '') + '"></label><div class="row-gap wrap">' + sugg.map((v) => '<button type="button" class="chip-btn" data-a="gaSet" data-v="' + v + '">' + M(v) + '</button>').join('') + '</div><button class="btn btn-primary btn-lg" type="submit">' + esc(t('goal.contribute')) + '</button></form>'];
  }
  function sheetCelebrate() {
    const g = S.goals.find((x) => x.id === ui.sheetData.id);
    return [t('goal.celebT'), '<div class="celebrate"><div class="jar jar-xl" aria-hidden="true"><i style="height:100%"></i></div><p class="h3 center">' + esc(t('goal.celebS', g.name, M(g.saved))) + '</p><button type="button" class="btn btn-primary btn-lg" data-a="goalNew">' + esc(t('goal.celebNew')) + '</button></div>'];
  }
  function sheetForgot() {
    if (SERVER()) return [t('auth.forgotTitle'), '<p>' + esc(t('auth.forgotServer')) + '</p>'];
    return [t('auth.forgotTitle'), '<p>' + esc(t('auth.forgotText')) + '</p><button type="button" class="btn btn-danger" data-a="resetAll">' + esc(t('auth.forgotReset')) + '</button>'];
  }
  function sheetConfirm() {
    const d = ui.sheetData;
    return [d.title, '<p>' + esc(d.text) + '</p><div class="row-gap"><button type="button" class="btn grow" data-a="closeSheet">' + esc(t('c.cancel')) + '</button><button type="button" class="btn btn-danger grow" data-a="confirmYes" data-autofocus>' + esc(d.yes) + '</button></div>'];
  }

  /* ================= ДЕЙСТВИЯ ================= */
  const A = {
    lang(el) { S.profile.lang = el.dataset.v; NZ.lang = el.dataset.v; commit(); },
    theme(el) { S.profile.theme = el.dataset.v; commit(); },
    themeToggle() { S.profile.theme = isDark() ? 'light' : 'dark'; commit(); },
    authMode(el) { ui.authMode = el.dataset.v; ui.authErr = {}; render(); },
    pwToggle() { const v = document.getElementById('a-pw').value; ui.pwShow = !ui.pwShow; render(); const p = document.getElementById('a-pw'); p.value = v; p.focus(); },
    forgot() { openSheet('forgot'); },
    resetAll() { NZ.wipe(); S = NZ.defaultState(); ui.sheet = null; ui.authMode = 'up'; location.hash = ''; render(); toast(t('auth.resetDone')); },
    onbNext, onbBack() { S.profile.onbStep = Math.max(0, (S.profile.onbStep || 0) - 1); commit(); },
    onbSkip() { finishOnb(); },
    onbGoal(el) { const amt = document.getElementById('o-gamt'); const mo = document.getElementById('o-gm'); ui.onbGoalMonths = mo ? mo.value : ui.onbGoalMonths; ui.onbGoal = +el.dataset.v; ui.onbGoalAmt = null; render(); },
    payday(el) { const inp = document.getElementById('o-income'); if (inp) S.profile.income = parseInt(inp.value.replace(/\D/g, ''), 10) || S.profile.income; S.profile.payday = +el.dataset.v; commit(); },
    formula() { ui.showFormula = !ui.showFormula; render(); },
    calMove(el) { const base = ui.calYm || NZ.ym(today()); const nx = NZ.addMonths(base, +el.dataset.v); if (nx <= NZ.ym(today())) { ui.calYm = nx; ui.selDay = null; render(); } },
    day(el) { ui.selDay = el.dataset.v; render(); const b = document.querySelector('[data-a="day"][data-v="' + el.dataset.v + '"]'); if (b) b.focus(); },
    dismiss(el) { S.dismissed[el.dataset.v] = 1; commit(); },
    openRecap(el) { ui.recapYm = el.dataset.v; ui.recapIdx = 0; },
    rmDemo() {
      const before = snapshot();
      const ids = S.imports.filter((i) => i.demo).map((i) => i.id);
      S.txs = S.txs.filter((x) => ids.indexOf(x.importId) < 0);
      S.imports = S.imports.filter((i) => !i.demo);
      S.demo = false; S.chat = []; ui.importResult = null;
      if (!S.txs.length) S.envelopes = {};
      NZ.save(S); render(); toast(t('st.rmDone'), restore(before));
    },
    tipAct(el) {
      const tp = NZ.tips(S, today()).find((x) => x.id === el.dataset.v);
      if (!tp) return;
      if (tp.action === 'move') return A.envMove({ dataset: { from: tp.from, to: tp.cat, v: tp.amount } });
      if (tp.action.indexOf('numa:') === 0) { go('numa'); ask(tp.action === 'numa:subs' ? t('numa.chips')[4] : t('numa.chips')[1]); return; }
      if (tp.action === 'home') return A.tipHide(el);
      go(tp.action);
    },
    tipHide(el) { const p = NZ.period(today(), S.profile.payday); const before = snapshot(); S.dismissed[el.dataset.v + ':' + p.start] = 1; NZ.save(S); render(); toast(t('tip.hide'), restore(before)); },
    openTx(el) { openSheet('tx', { id: el.dataset.v }); },
    setCat(el) {
      const x = S.txs.find((y) => y.id === ui.sheetData.id); if (!x) return;
      const before = snapshot();
      const cat = el.dataset.v;
      const always = ui.sheetData.always !== false && x.source !== 'manual';
      x.cat = cat; x.confidence = 1;
      let msg = t('catS.changed');
      if (always) {
        const k = NZ.merchantKey(x.raw);
        S.rules[k] = cat;
        S.txs.forEach((y) => { if (!y.own && NZ.merchantKey(y.raw) === k && Math.sign(y.amount) === Math.sign(x.amount)) { y.cat = cat; y.confidence = 1; } });
        msg = t('catS.remembered', x.merchant, t('cat.' + cat));
      }
      ui.sheet = null; NZ.save(S); render(); toast(msg, restore(before));
    },
    delTx() { const before = snapshot(); S.txs = S.txs.filter((y) => y.id !== ui.sheetData.id); ui.sheet = null; NZ.save(S); render(); toast(t('catS.delDone'), restore(before)); },
    closeSheet,
    undo() { const f = ui.toast && ui.toast.undo; ui.toast = null; renderToast(); if (f) f(); },
    openAdd,
    addType(el) { ui.add.type = el.dataset.v; ui.add.cat = el.dataset.v === 'exp' ? 'groceries' : 'salary'; renderSheet(); },
    addCat(el) { ui.add.cat = el.dataset.v; renderSheet(); },
    addMethod(el) { ui.add.method = +el.dataset.v; renderSheet(); },
    key(el) {
      const k = el.dataset.v; let v = ui.add.amount || '';
      if (k === 'del') v = v.slice(0, -1); else { v = (v + k).replace(/^0+/, ''); if (v.length > 9) return; }
      ui.add.amount = v; renderSheet();
      const b = document.querySelector('.keypad [data-v="' + k + '"]'); if (b) b.focus();
      if (navigator.vibrate) try { navigator.vibrate(5); } catch (e) { /* нет вибрации */ }
    },
    addSave,
    envFilter(el) { ui.envFilter = el.dataset.v; render(); },
    envOpen(el) { openSheet('env', { cat: el.dataset.v }); },
    envAdd() { openSheet('envAdd'); },
    envPick(el) { S.envelopes[el.dataset.v] = 0; NZ.save(S); ui.sheet = null; render(); openSheet('env', { cat: el.dataset.v }); },
    envSuggest() { const before = snapshot(); S.envelopes = NZ.suggestLimits(S, today()); ui.sheet = null; NZ.save(S); render(); toast(t('env.set'), restore(before)); },
    envRemove(el) { const before = snapshot(); delete S.envelopes[el.dataset.v]; ui.sheet = null; NZ.save(S); render(); toast(t('env.set'), restore(before)); },
    envMove(el) { const before = snapshot(); const v = +el.dataset.v; S.envelopes[el.dataset.from] = Math.max(0, (S.envelopes[el.dataset.from] || 0) - v); S.envelopes[el.dataset.to] = (S.envelopes[el.dataset.to] || 0) + v; NZ.save(S); render(); toast(t('env.moved', M(v)), restore(before)); },
    ask(el) { ask(t('numa.chips')[+el.dataset.v]); },
    numaAct(el) {
      const m = S.chat[+el.dataset.v]; const a = m && m.ans && m.ans.action; if (!a) return;
      if (a.kind === 'go') return go(a.to);
      if (a.kind === 'toGoal') { const g = S.goals.find((x) => x.id === a.goal); if (!g) return; m.ans.done = true; contribute(g, a.amount); }
    },
    clearChat() { const before = snapshot(); S.chat = []; NZ.save(S); render(); toast(t('prof.chatCleared'), restore(before)); },
    loadDemo,
    importCancel() { ui.importing = null; render(); },
    reviewOps() { ui.opsReview = true; },
    opsReview() { ui.opsReview = !ui.opsReview; render(); },
    rmImport(el) {
      const imp = S.imports.find((i) => i.id === el.dataset.v);
      openSheet('confirm', { title: imp.name, text: t('st.rmConfirm', t('c.ops', imp.count)), yes: t('st.rm'), fn: () => { S.txs = S.txs.filter((x) => x.importId !== imp.id); S.imports = S.imports.filter((i) => i.id !== imp.id); if (!S.imports.length) S.demo = false; ui.importResult = null; NZ.save(S); toast(t('st.rmDone')); } });
    },
    confirmYes() { const fn = ui.sheetData.fn; ui.sheet = null; if (fn) fn(); render(); },
    goalNew() { ui.sheet = null; openSheet('goal', {}); goalCalcHint(); },
    goalEdit(el) { openSheet('goal', { id: el.dataset.v }); },
    goalAdd(el) { openSheet('goalAdd', { id: el.dataset.v }); },
    gaSet(el) { document.getElementById('ga-amt').value = el.dataset.v; },
    goalDel(el) {
      const g = S.goals.find((x) => x.id === el.dataset.v);
      const doDel = () => { const before = snapshot(); S.goals = S.goals.filter((x) => x.id !== g.id); NZ.save(S); render(); toast(t('goal.delDone'), restore(before)); };
      if (g.saved > 0) openSheet('confirm', { title: g.name, text: t('goal.delConfirm', M(g.saved)), yes: t('goal.del'), fn: doDel });
      else { ui.sheet = null; doDel(); }
    },
    notif(el) { S.profile.notif[el.dataset.v] = !S.profile.notif[el.dataset.v]; commit(); },
    ruleDel(el) { const before = snapshot(); delete S.rules[el.dataset.v]; NZ.save(S); render(); toast(t('catS.changed'), restore(before)); },
    async logout(el) {
      if (!SERVER() || !S.account || !S.account.server) { S.session = false; ui.authMode = 'in'; commit(); return; }
      if (S.sync && S.sync.outbox.length && !(el && el.dataset && el.dataset.force)) {
        await NZ.sync.run();
        if (S.sync.outbox.length) {
          openSheet('confirm', { title: t('prof.logout'), text: t('prof.logoutPending', S.sync.outbox.length), yes: t('prof.logoutAnyway'), fn: () => A.logout({ dataset: { force: '1' } }) });
          return;
        }
      }
      const login = S.account.login;
      await NZ.api.logout();
      const keep = { lang: S.profile.lang, theme: S.profile.theme };
      S = NZ.defaultState(); S.profile.lang = keep.lang; S.profile.theme = keep.theme;
      NZ.syncResetBase(S);
      ui.authMode = 'in'; ui.authLogin = login; ui.authErr = {}; ui.sheet = null;
      commit();
    },
    syncNow() { NZ.sync.run().then(() => render()); },
    recapPrev() { ui.recapIdx = Math.max(0, ui.recapIdx - 1); render(); },
    recapNext() { ui.recapIdx = Math.min(4, ui.recapIdx + 1); render(); },
    recapShare() {
      const ym = ui.recapYm || NZ.addMonths(NZ.ym(today()), -1);
      const st = NZ.monthStats(S, ym);
      const txt = t('recap.shareText', NZ.monthName(ym), ui.hideSums ? '•••' : M(st.total), t('recap.habitBig', st.cafeCount)) + ' — nummaza';
      if (window.NummazaNative && window.NummazaNative.share) { window.NummazaNative.share(txt); return; }
      if (navigator.share) { navigator.share({ text: txt }).catch(() => {}); return; }
      const done = () => toast(t('recap.copied'));
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => toast(txt));
      else toast(txt);
    }
  };

  /* ================= СОБЫТИЯ ================= */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el || el.disabled) return;
    const fn = A[el.dataset.a];
    if (!fn) return;
    if (el.tagName === 'A' && !['openRecap', 'reviewOps'].includes(el.dataset.a)) e.preventDefault();
    fn(el, e);
  });
  document.addEventListener('submit', async (e) => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    const k = f.dataset.form;
    if (k === 'auth') return submitAuth(f);
    if (k === 'chat') { const q = f.q.value; f.q.value = ''; return ask(q); }
    if (k === 'delete') {
      if (document.getElementById('del-w').value.trim().toUpperCase() !== t('del.word')) return;
      if (SERVER() && S.account && S.account.server) {
        try { await NZ.api.deleteAccount(); } catch (err) {
          if (err.code !== 'session_expired') { toast(err.code === 'offline' ? t('del.offline') : t('auth.errServer')); return; }
        }
      }
      NZ.wipe(); S = NZ.defaultState(); ui.authMode = 'up'; ui.authErr = {}; location.hash = ''; ui.route = 'home'; render(); toast(t('del.done')); return;
    }
    if (k === 'env') {
      const c = ui.sheetData.cat;
      const v = parseInt(document.getElementById('env-lim').value.replace(/\D/g, ''), 10) || 0;
      const max = maxLimitFor(c);
      if (v > max) { ui.sheetData.err = t('env.maxErr', M(max)); renderSheet(); document.getElementById('env-lim').focus(); return; }
      const before = snapshot(); S.envelopes[c] = v; ui.sheet = null; NZ.save(S); render(); toast(t('env.set'), restore(before)); return;
    }
    if (k === 'goal') {
      const num = (id) => parseInt((document.getElementById(id).value || '').replace(/\D/g, ''), 10) || 0;
      const name = document.getElementById('g-name').value.trim();
      const target = num('g-target'); const saved = num('g-saved'); const monthly = num('g-monthly');
      const dl = document.getElementById('g-dl').value || NZ.addMonths(NZ.ym(today()), 12);
      const err = {};
      if (!name) err.name = t('goal.errName');
      if (!target) err.target = t('goal.errTarget');
      if (Object.keys(err).length) { ui.sheetData.err = err; renderSheet(); return; }
      const before = snapshot();
      const deadline = dl + '-' + String(Math.min(28, +today().slice(8))).padStart(2, '0');
      let g = ui.sheetData.id ? S.goals.find((x) => x.id === ui.sheetData.id) : null;
      if (g) Object.assign(g, { name, target, saved, monthly, deadline });
      else { g = newGoal(name, target, saved, 12); Object.assign(g, { deadline, monthly: monthly || g.monthly }); S.goals.push(g); }
      ui.sheet = null; NZ.save(S); render(); toast(t('c.saved'), restore(before)); return;
    }
    if (k === 'goalAdd') {
      const v = parseInt(document.getElementById('ga-amt').value.replace(/\D/g, ''), 10) || 0;
      const g = S.goals.find((x) => x.id === ui.sheetData.id);
      if (!v || !g) return;
      ui.sheet = null; renderSheet(); contribute(g, v);
    }
  });
  document.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.in;
    if (!k) return;
    if (k === 'income') {
      const v = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0;
      const est = document.getElementById('o-est');
      if (est) est.textContent = v ? '≈ ' + M(Math.floor((v * 0.85) / 30 / 100) * 100) : '—';
    }
    if (k === 'addWhere') ui.add.merchant = e.target.value;
    if (k === 'opsq') { ui.opsQuery = e.target.value; const box = document.getElementById('ops-list'); if (box) { const tmp = document.createElement('div'); tmp.innerHTML = viewOps(); box.innerHTML = tmp.querySelector('#ops-list').innerHTML; } }
    if (k === 'delw') { const b = document.getElementById('del-btn'); if (b) b.disabled = e.target.value.trim().toUpperCase() !== t('del.word'); }
    if (k === 'goalCalc') goalCalcHint();
    if (e.target.id === 'g-monthly') e.target.dataset.touched = '1';
  });
  document.addEventListener('change', (e) => {
    const k = e.target.dataset && e.target.dataset.ch;
    if (!k) return;
    if (k === 'file') { const f = e.target.files && e.target.files[0]; e.target.value = ''; handleFile(f); }
    if (k === 'income') {
      const before = snapshot();
      S.profile.income = parseInt(e.target.value.replace(/\D/g, ''), 10) || 0; NZ.save(S); render();
      toast(t('prof.updated', M(NZ.safeToday(S, today()).value)), restore(before));
    }
    if (k === 'payday') { const before = snapshot(); S.profile.payday = +e.target.value; NZ.save(S); render(); toast(t('prof.updated', M(NZ.safeToday(S, today()).value)), restore(before)); }
    if (k === 'addDate') ui.add.date = e.target.value || today();
    if (k === 'txAlways') ui.sheetData.always = e.target.checked;
    if (k === 'hideSums') { ui.hideSums = e.target.checked; render(); }
    if (k === 'goalCalc') goalCalcHint();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.sheet) { e.preventDefault(); closeSheet(); }
    if (ui.route === 'recap' && S.session && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !ui.sheet) { (e.key === 'ArrowRight' ? A.recapNext : A.recapPrev)(); }
  });
  window.addEventListener('hashchange', () => { readRoute(); ui.sheet = null; if (!S.session || !S.account) return; render(); const m = document.getElementById('main'); if (m) { m.scrollTop = 0; window.scrollTo(0, 0); } });
  window.addEventListener('online', render);
  window.addEventListener('offline', render);
  if (window.matchMedia) { try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', render); } catch (e) { /* старый браузер */ } }

  // Перетаскивание файла выписки на вебе
  document.addEventListener('dragover', (e) => { if (ui.route === 'statements' || !S.profile.onboarded) e.preventDefault(); });
  document.addEventListener('drop', (e) => { if (ui.route === 'statements' || !S.profile.onboarded) { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files[0]; if (f) handleFile(f); } });

  // pdf.js: воркер подключён обычным скриптом (window.pdfjsWorker), поэтому pdf.js работает в основном потоке —
  // так надёжно и в Android WebView по file://, и в браузере.

  NZ.app = {
    get state() { return S; }, render, ui, A, pullShared,
    onSessionExpired() { ui.authMode = 'in'; ui.authLogin = S.account ? S.account.login : ''; ui.authErr = { form: t('auth.expired') }; render(); }
  };
  if (SERVER() && S.session && S.sync) setTimeout(() => NZ.sync.run(), 300);
  readRoute();
  render();
  pullShared();
})();
