// src/db.js
// Camada de acesso ao banco de dados (PostgreSQL, hospedado no Supabase).
// A conexão usa a variável de ambiente DATABASE_URL (veja .env.example e
// README.md -> "Publicar no Supabase e na Vercel").
//
// Em ambiente serverless (Vercel), cada instância da função reaproveita a
// mesma conexão entre invocações, então mantemos o Pool em escopo de
// módulo e criamos as tabelas apenas uma vez por instância (init()).

const { Pool } = require("pg");
const bcrypt = require("bcryptjs");

if (!process.env.DATABASE_URL) {
  console.error(
    "\n[ERRO] Configure a variável de ambiente DATABASE_URL (string de conexão do Supabase) antes de iniciar o servidor. Veja .env.example.\n"
  );
}

// Um Postgres rodando na própria máquina (ex: "localhost"/"127.0.0.1") em
// geral não tem SSL habilitado; o Supabase sempre exige. Detectamos pelo
// host em vez de NODE_ENV porque em desenvolvimento você normalmente já
// aponta para o Supabase remoto (só um Postgres local de verdade não usa SSL).
const usaBancoLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || "");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // O Supabase exige SSL; em ambientes serverless não temos o certificado
  // raiz configurado localmente, então desativamos a verificação estrita
  // (a conexão continua criptografada, só não valida a cadeia do certificado).
  ssl: usaBancoLocal ? false : { rejectUnauthorized: false },
  // Em serverless cada instância deve abrir poucas conexões (idealmente
  // use a "Connection pooling" (porta 6543/pgbouncer) do Supabase como
  // DATABASE_URL em produção). Localmente, um pool maior é ok.
  max: process.env.VERCEL ? 1 : 10,
});

pool.on("error", (err) => {
  console.error("[db] Erro inesperado no pool de conexões:", err);
});

const query = (text, params) => pool.query(text, params);

// E-mail e senha padrão do painel de administração (podem ser trocados
// depois, veja README.md -> "Conta de administração").
const ADMIN_EMAIL = "admin@gmail.com";
const ADMIN_SENHA_PADRAO = "@dministrador";

async function criarTabelas() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS progress (
      user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id    TEXT NOT NULL,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, lesson_id)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS quiz_results (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      lesson_id  TEXT NOT NULL,
      correct    INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Substitui o antigo arquivo local data/video-overrides.json: no Vercel o
  // sistema de arquivos é somente leitura (fora de /tmp, que é efêmero), então
  // as URLs dos vídeos enviados pelo painel de administração agora vivem aqui.
  await query(`
    CREATE TABLE IF NOT EXISTS video_overrides (
      lesson_id  TEXT PRIMARY KEY,
      video_url  TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await query(`CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_quiz_user ON quiz_results(user_id);`);
}

// Garante que a conta de administração sempre exista.
async function garantirContaAdmin() {
  const { rows } = await query("SELECT id FROM users WHERE email = $1", [ADMIN_EMAIL]);
  const existente = rows[0];

  if (existente) {
    // Garante que a conta continue marcada como administradora mesmo que
    // o banco tenha sido criado antes da coluna is_admin existir.
    await query("UPDATE users SET is_admin = TRUE WHERE id = $1", [existente.id]);
    return;
  }

  const hash = await bcrypt.hash(ADMIN_SENHA_PADRAO, 12);
  await query(
    "INSERT INTO users (name, email, password_hash, is_admin) VALUES ($1, $2, $3, TRUE)",
    ["Administração", ADMIN_EMAIL, hash]
  );

  console.log(`[admin] Conta de administração criada: ${ADMIN_EMAIL}`);
}

// init() cria as tabelas e garante a conta admin. É seguro chamar em toda
// requisição: a promise é cacheada, então o trabalho só roda de fato uma
// vez por instância do servidor (ou por instância de função na Vercel).
let initPromise = null;
function init() {
  if (!initPromise) {
    initPromise = criarTabelas()
      .then(garantirContaAdmin)
      .catch((err) => {
        // Se a inicialização falhar, permite tentar de novo na próxima
        // requisição em vez de deixar o servidor travado num erro antigo.
        initPromise = null;
        throw err;
      });
  }
  return initPromise;
}

module.exports = { pool, query, init, garantirContaAdmin, ADMIN_EMAIL };
