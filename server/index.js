// Запуск сервера NUMMAZA.
//   DATABASE_URL     — PostgreSQL (прод). Без неё нужен PGLITE=1 (разработка) — база в памяти
//                      или PGLITE_DIR=путь — база в папке.
//   PORT             — порт (по умолчанию 8080)
//   ALLOWED_ORIGINS  — сайты, которым можно обращаться к API, через запятую (свой домен уже разрешён)
//   ALLOW_FILE_ORIGIN — 0, чтобы запретить запросы из Android-приложения (origin null)
import { openDb } from './db.js';
import { createApp } from './app.js';

const url = process.env.DATABASE_URL;
if (!url && !process.env.PGLITE && !process.env.PGLITE_DIR) {
  console.error('Задайте DATABASE_URL (PostgreSQL) или PGLITE=1 для разработки.');
  process.exit(1);
}
const db = await openDb(url ? { url } : { pglite: process.env.PGLITE_DIR || true });
const app = createApp(db, {
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  allowFileOrigin: process.env.ALLOW_FILE_ORIGIN !== '0'
});
const port = Number(process.env.PORT) || 8080;
const server = app.listen(port, () => console.log(`NUMMAZA: http://localhost:${port} (база: ${url ? 'PostgreSQL' : 'PGlite'})`));

const stop = async () => { server.close(); await db.close(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
