// src/data/video-store.js
// Guarda a URL dos vídeos enviados via upload pelo painel de administração.
//
// Antes isso era um arquivo JSON local (data/video-overrides.json). Como a
// Vercel roda o servidor em funções serverless com sistema de arquivos
// somente leitura (fora de /tmp, que é efêmero e não é compartilhado entre
// instâncias), passamos a guardar isso na tabela "video_overrides" do
// Postgres (Supabase). O arquivo de vídeo em si fica no Supabase Storage
// (veja src/routes/admin.js) — aqui só guardamos a URL pública dele.

const db = require("../db");

// Retorna a URL do vídeo enviado para essa aula, ou null se ainda não
// houver upload registrado para ela.
async function obterUrl(lessonId) {
  const { rows } = await db.query(
    "SELECT video_url FROM video_overrides WHERE lesson_id = $1",
    [lessonId]
  );
  return rows[0]?.video_url || null;
}

// Retorna um mapa { lessonId: videoUrl } com todos os overrides, para evitar
// uma consulta por aula quando for listar vários vídeos de uma vez.
async function obterTodos() {
  const { rows } = await db.query("SELECT lesson_id, video_url FROM video_overrides");
  const mapa = {};
  for (const linha of rows) {
    mapa[linha.lesson_id] = linha.video_url;
  }
  return mapa;
}

async function definirUrl(lessonId, url) {
  await db.query(
    `INSERT INTO video_overrides (lesson_id, video_url, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (lesson_id) DO UPDATE SET video_url = EXCLUDED.video_url, updated_at = now()`,
    [lessonId, url]
  );
}

async function removerUrl(lessonId) {
  await db.query("DELETE FROM video_overrides WHERE lesson_id = $1", [lessonId]);
}

module.exports = { obterUrl, obterTodos, definirUrl, removerUrl };
