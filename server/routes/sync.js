// Синхронизация данных между устройствами.
// Устройство отправляет свои изменения и курсор; сервер применяет их по правилу
// «последняя запись (по updatedAt) побеждает» и возвращает всё, что изменилось после курсора.
import express from 'express';
import { requireAuth } from './auth.js';

export const KINDS = new Set(['tx', 'goal', 'import', 'envelope', 'rule', 'profile']);
const MAX_CHANGES = 1000;
const MAX_RECORD_BYTES = 20 * 1024;
const PAGE = 2000;

function validChange(c) {
  if (!c || typeof c !== 'object') return false;
  if (!KINDS.has(c.kind)) return false;
  if (typeof c.id !== 'string' || !c.id || c.id.length > 100) return false;
  if (!Number.isSafeInteger(c.updatedAt) || c.updatedAt <= 0) return false;
  if (!c.deleted && (c.data === null || typeof c.data !== 'object')) return false;
  if (!c.deleted && JSON.stringify(c.data).length > MAX_RECORD_BYTES) return false;
  return true;
}

export function syncRouter(db) {
  const r = express.Router();
  r.post('/sync', requireAuth(db), async (req, res) => {
    const { cursor = 0, changes = [] } = req.body || {};
    if (!Number.isSafeInteger(Number(cursor)) || !Array.isArray(changes) || changes.length > MAX_CHANGES) return res.status(400).json({ error: 'validation' });
    const bad = changes.findIndex((c) => !validChange(c));
    if (bad >= 0) return res.status(400).json({ error: 'validation', index: bad });

    let applied = 0;
    for (const c of changes) {
      const { rows } = await db.query(
        `INSERT INTO records(user_id, kind, rec_id, data, updated_at, deleted)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (user_id, kind, rec_id) DO UPDATE
           SET data=EXCLUDED.data, updated_at=EXCLUDED.updated_at, deleted=EXCLUDED.deleted, seq=nextval('records_seq')
           WHERE records.updated_at < EXCLUDED.updated_at
         RETURNING seq`,
        [req.userId, c.kind, c.id, c.deleted ? null : c.data, c.updatedAt, !!c.deleted]
      );
      if (rows.length) applied++;
    }

    const { rows } = await db.query(
      'SELECT kind, rec_id, data, updated_at, deleted, seq FROM records WHERE user_id=$1 AND seq > $2 ORDER BY seq LIMIT $3',
      [req.userId, Number(cursor), PAGE + 1]
    );
    const more = rows.length > PAGE;
    const page = more ? rows.slice(0, PAGE) : rows;
    res.json({
      applied,
      cursor: page.length ? Number(page[page.length - 1].seq) : Number(cursor),
      more,
      changes: page.map((x) => ({ kind: x.kind, id: x.rec_id, data: x.data, updatedAt: Number(x.updated_at), deleted: x.deleted }))
    });
  });
  return r;
}
