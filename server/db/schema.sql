-- NUMMAZA: схема базы данных (PostgreSQL 13+). Выполняется при каждом старте, поэтому всё через IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  login         text NOT NULL UNIQUE,          -- +77001234567 или email в нижнем регистре
  name          text NOT NULL,
  pass_hash     text NOT NULL,                 -- scrypt$N$r$p$соль$хеш
  created_at    timestamptz NOT NULL DEFAULT now(),
  failed_logins integer NOT NULL DEFAULT 0,
  locked_until  timestamptz
);

-- Сессия = пара токенов. В базе только SHA-256 токенов, сами токены знает лишь устройство.
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_hash     text NOT NULL UNIQUE,
  access_expires  timestamptz NOT NULL,
  refresh_hash    text NOT NULL UNIQUE,
  refresh_expires timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  revoked_at      timestamptz,
  user_agent      text
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);

-- Синхронизируемые записи пользователя: операции, цели, выписки, конверты, правила, профиль.
-- seq растёт при каждом изменении — по нему устройство забирает «всё новое после курсора».
CREATE SEQUENCE IF NOT EXISTS records_seq;
CREATE TABLE IF NOT EXISTS records (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  rec_id     text NOT NULL,
  data       jsonb,
  updated_at bigint NOT NULL,                  -- время изменения на устройстве, мс (правило «последняя запись побеждает»)
  deleted    boolean NOT NULL DEFAULT false,
  seq        bigint NOT NULL DEFAULT nextval('records_seq'),
  PRIMARY KEY (user_id, kind, rec_id)
);
CREATE INDEX IF NOT EXISTS records_user_seq_idx ON records(user_id, seq);
