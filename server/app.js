// Express-приложение NUMMAZA: API под /api и само веб-приложение под /.
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { syncRouter } from './routes/sync.js';
import { rateLimit } from './security.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const APP_DIR = process.env.APP_DIR || path.resolve(here, '..', 'app');

/**
 * @param {*} db  — из openDb()
 * @param {{ allowedOrigins?: string[], allowFileOrigin?: boolean, serveApp?: boolean, authLimit?: number }} opts
 */
export function createApp(db, opts = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // за прокси Render / Caddy, чтобы req.ip был адресом клиента

  // Заголовки безопасности
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' });
    next();
  });

  // CORS только для API. APK открывает приложение с file://, его origin — "null".
  // Авторизация через заголовок Authorization, cookie не используются.
  const allowed = new Set(opts.allowedOrigins || []);
  app.use('/api', (req, res, next) => {
    const origin = req.get('origin');
    if (origin && (allowed.has(origin) || (origin === 'null' && opts.allowFileOrigin !== false))) {
      res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Max-Age': '600', Vary: 'Origin' });
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api/auth', rateLimit({ limit: opts.authLimit || 20, windowMs: 60_000 }));
  app.use('/api', rateLimit({ limit: 300, windowMs: 60_000 }));

  app.get('/api/health', async (req, res) => {
    await db.query('SELECT 1');
    res.json({ ok: true });
  });
  app.use('/api', authRouter(db));
  app.use('/api', syncRouter(db));
  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

  // Веб-приложение: адрес API = этот же сайт
  if (opts.serveApp !== false) {
    app.get('/js/config.js', (req, res) => {
      res.type('application/javascript').set('Cache-Control', 'no-store').send('window.NZ = window.NZ || {};\nNZ.API_URL = location.origin;\n');
    });
    app.use((req, res, next) => {
      res.set('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
      next();
    });
    app.use(express.static(APP_DIR, { maxAge: '1h' }));
  }

  // Ошибки: в ответ — без подробностей, в лог — полностью
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
    console.error(err);
    res.status(500).json({ error: 'server_error' });
  });
  return app;
}
