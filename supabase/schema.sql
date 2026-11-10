-- supabase/schema.sql
-- Opcional: você pode rodar este script uma vez no SQL Editor do Supabase
-- para criar as tabelas antecipadamente. Não é obrigatório — a própria
-- aplicação cria essas mesmas tabelas automaticamente (com
-- "CREATE TABLE IF NOT EXISTS") na primeira requisição, veja src/db.js.
-- Rodar aqui só adianta o processo e evita a pequena latência extra da
-- primeira chamada em produção.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress (
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id    TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS quiz_results (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id  TEXT NOT NULL,
  option_index INTEGER,
  correct    INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guarda a URL dos vídeos enviados via upload pelo painel de administração
-- (o arquivo em si fica no Supabase Storage, aqui só a URL pública).
CREATE TABLE IF NOT EXISTS video_overrides (
  lesson_id  TEXT PRIMARY KEY,
  video_url  TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Desafios práticos (simulador de Node-RED em modo prova)
CREATE TABLE IF NOT EXISTS challenge_attempts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id  TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'em_andamento',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deadline_at   TIMESTAMPTZ NOT NULL,
  finished_at   TIMESTAMPTZ,
  violations    INTEGER NOT NULL DEFAULT 0,
  verifications INTEGER NOT NULL DEFAULT 0,
  last_ping_at  TIMESTAMPTZ,
  draft         JSONB,
  score         INTEGER,
  suspeito      BOOLEAN NOT NULL DEFAULT FALSE
);
CREATE TABLE IF NOT EXISTS challenge_events (
  id         SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES challenge_attempts(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  detail     TEXT,
  weight     INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS challenge_submissions (
  id         SERIAL PRIMARY KEY,
  attempt_id INTEGER NOT NULL REFERENCES challenge_attempts(id) ON DELETE CASCADE,
  flow       JSONB,
  results    JSONB,
  passed     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attempts_user ON challenge_attempts(user_id, challenge_id);
CREATE INDEX IF NOT EXISTS idx_events_attempt ON challenge_events(attempt_id);

CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_results(user_id);

-- Observação sobre RLS (Row Level Security):
-- A aplicação acessa o Postgres diretamente via DATABASE_URL (não pela API
-- REST/anon key do Supabase), então RLS não entra no caminho dessas
-- consultas e não precisa ser configurado para o backend funcionar. Se um
-- dia você acessar essas tabelas pela API do Supabase (supabase-js com a
-- anon key, por exemplo direto do navegador), aí sim ative RLS e crie
-- políticas antes de fazer isso.
