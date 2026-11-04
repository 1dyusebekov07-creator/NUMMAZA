/* NUMMAZA — запросы к серверу: регистрация, вход, токены, синхронизация.
   Токены хранятся отдельно от данных (localStorage 'nummaza.auth'). */
(function () {
  'use strict';
  const NZ = window.NZ;
  const KEY = 'nummaza.auth';

  class ApiError extends Error {
    constructor(code, status, data) { super(code); this.code = code; this.status = status; this.data = data || {}; }
  }

  let auth = null;
  try { auth = JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { auth = null; }
  function store(a) {
    auth = a;
    try { if (a) localStorage.setItem(KEY, JSON.stringify(a)); else localStorage.removeItem(KEY); } catch (e) { /* хранилище недоступно */ }
  }

  async function raw(path, opts) {
    const o = opts || {};
    const headers = {};
    if (o.body !== undefined) headers['Content-Type'] = 'application/json';
    if (o.token) headers.Authorization = 'Bearer ' + o.token;
    let res;
    try {
      res = await fetch(String(NZ.API_URL).replace(/\/$/, '') + '/api' + path, { method: o.method || 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
    } catch (e) {
      throw new ApiError('offline', 0);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) throw new ApiError((data && data.error) || 'server_error', res.status, data);
    return data;
  }

  let refreshing = null;
  async function refresh() {
    if (!auth || !auth.refreshToken) throw new ApiError('session_expired', 401);
    try {
      const t = await raw('/auth/refresh', { method: 'POST', body: { refreshToken: auth.refreshToken } });
      store(Object.assign({}, auth, t));
    } catch (e) {
      if (e.code === 'offline') throw e;
      store(null);
      throw new ApiError('session_expired', 401);
    }
  }
  // Запрос с токеном; если access-токен истёк — один раз обновляем и повторяем
  async function authed(path, opts) {
    if (!auth) throw new ApiError('session_expired', 401);
    try {
      return await raw(path, Object.assign({}, opts, { token: auth.accessToken }));
    } catch (e) {
      if (e.status !== 401) throw e;
      refreshing = refreshing || refresh().finally(() => { refreshing = null; });
      await refreshing;
      return raw(path, Object.assign({}, opts, { token: auth.accessToken }));
    }
  }

  NZ.api = {
    ApiError,
    enabled: () => !!NZ.API_URL,
    hasSession: () => !!(auth && auth.refreshToken),
    user: () => (auth ? auth.user : null),
    async register(name, login, password) {
      const r = await raw('/auth/register', { method: 'POST', body: { name, login, password } });
      store(r);
      return r.user;
    },
    async login(login, password) {
      const r = await raw('/auth/login', { method: 'POST', body: { login, password } });
      store(r);
      return r.user;
    },
    async logout() {
      try { await authed('/auth/logout', { method: 'POST', body: {} }); } catch (e) { /* без сети сессия истечёт сама */ }
      store(null);
    },
    forget() { store(null); },
    async deleteAccount() {
      await authed('/me', { method: 'DELETE' });
      store(null);
    },
    sync(body) { return authed('/sync', { method: 'POST', body }); }
  };
})();
