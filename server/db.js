// Подключение к базе: PostgreSQL по DATABASE_URL, либо PGlite (Postgres в памяти/в папке) для разработки и тестов.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(here, 'db', 'schema.sql'), 'utf8');

/**
 * @param {{ url?: string, pglite?: boolean|string }} opts
 *   url    — строка подключения PostgreSQL (прод)
 *   pglite — true: база в памяти; строка: папка для файлов базы (разработка)
 * @returns {Promise<{ query: (text: string, params?: any[]) => Promise<{rows: any[]}>, close: () => Promise<void> }>}
 */
export async function openDb(opts = {}) {
  let db;
  if (opts.url) {
    const pg = (await import('pg')).default;
    const ssl = /sslmode=disable/.test(opts.url) || /@(localhost|127\.0\.0\.1|db)[:/]/.test(opts.url) ? false : { rejectUnauthorized: false };
    const pool = new pg.Pool({ connectionString: opts.url, ssl, max: 10 });
    db = { query: (text, params) => pool.query(text, params), close: () => pool.end() };
  } else {
    const { PGlite } = await import('@electric-sql/pglite');
    const lite = typeof opts.pglite === 'string' ? new PGlite(opts.pglite) : new PGlite();
    db = { query: (text, params) => lite.query(text, params), close: () => lite.close() };
  }
  // Схема: выполняем по одному выражению (PGlite не принимает несколько выражений с параметрами)
  for (const stmt of SCHEMA.split(/;\s*\n/).map((s) => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
    await db.query(stmt);
  }
  return db;
}
