// src/storage.js
// Upload dos vídeos das aulas para o Supabase Storage.
//
// Antes os vídeos eram salvos em public/uploads/videos no disco local. No
// Vercel isso não funciona (sistema de arquivos somente leitura / efêmero),
// então os arquivos agora vão para um bucket do Supabase Storage e o painel
// de administração passa a guardar só a URL pública (veja
// src/data/video-store.js).

const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
// Precisa ser a service_role key (não a anon key): o upload é feito pelo
// servidor, depois de já checarmos que quem está pedindo é um admin
// autenticado, então o backend precisa de permissão total no bucket.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_VIDEOS_BUCKET || "videos";

let supabase = null;
function getClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (veja .env.example) para habilitar upload de vídeos."
    );
  }
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabase;
}

// Envia o buffer do vídeo para o bucket e devolve a URL pública.
// `lessonId` é usado no nome do arquivo só para facilitar auditoria manual
// no painel do Supabase; o nome final é sempre único (timestamp + random).
async function enviarVideo({ lessonId, buffer, mimetype, extensao }) {
  const client = getClient();
  const nomeUnico = `${lessonId}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extensao}`;

  const { error } = await client.storage.from(BUCKET).upload(nomeUnico, buffer, {
    contentType: mimetype || "video/mp4",
    upsert: false,
  });

  if (error) {
    throw new Error(`Falha ao enviar vídeo para o Supabase Storage: ${error.message}`);
  }

  const { data } = client.storage.from(BUCKET).getPublicUrl(nomeUnico);
  return { url: data.publicUrl, path: nomeUnico };
}

// Remove um vídeo antigo do bucket a partir da sua URL pública, para não
// acumular lixo quando o admin substitui ou apaga um upload. Falhas aqui
// são só logadas (não devem quebrar a operação principal).
async function removerVideoPorUrl(url) {
  if (!url) return;
  try {
    const client = getClient();
    const partes = url.split(`/object/public/${BUCKET}/`);
    const caminho = partes[1];
    if (!caminho) return;
    const { error } = await client.storage.from(BUCKET).remove([decodeURIComponent(caminho)]);
    if (error) {
      console.error("[storage] Falha ao remover vídeo antigo:", error.message);
    }
  } catch (err) {
    console.error("[storage] Falha ao remover vídeo antigo:", err.message);
  }
}

module.exports = { enviarVideo, removerVideoPorUrl, BUCKET };
