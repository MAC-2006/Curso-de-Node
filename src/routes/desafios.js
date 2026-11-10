// src/routes/desafios.js
// API dos desafios práticos (simulador de Node-RED em "modo prova").
//
// Regras de integridade aplicadas NO SERVIDOR (o navegador só colabora):
//  - o relógio da prova é do servidor (deadline_at) — não dá para "pausar";
//  - eventos suspeitos (sair da aba/tela cheia, tentar colar...) são
//    registrados; ao atingir MAX_VIOLACOES a tentativa é ANULADA;
//  - o aluno envia o fluxo; o JUIZ roda no servidor, com testes ocultos e
//    valores sorteados a cada verificação, e o código do aluno roda em QuickJS
//    (sandbox) — nunca no processo do servidor;
//  - a aprovação só é gravada pelo servidor.
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { exigirAutenticacao } = require("../middleware/auth");
const { porId, desafios, publico } = require("../data/challenges");
const { julgar } = require("../sim/judge");

const MAX_VIOLACOES = 3; // ao atingir, a tentativa é anulada
const MAX_VERIFICACOES = 8; // correções por tentativa
const COOLDOWN_ANULADA_S = 120; // espera para tentar de novo após anulação
const SEM_SINAL_S = 45; // sem batimento por mais que isso = saiu da prova
const MAX_RASCUNHO = 150 * 1024;

// peso de cada tipo de evento no contador de violações
const PESO = {
  saiu_da_aba: 1,
  saiu_tela_cheia: 1,
  perdeu_foco: 1,
  tentou_colar: 1,
  texto_inserido_suspeito: 1,
  sem_sinal: 1,
  // registrados, mas sem pontuar:
  tentou_copiar: 0,
  tentou_atalho: 0,
  voltou: 0,
  retomou: 0,
  suspeita_colagem: 0,
  iniciou: 0,
};

const router = express.Router();
router.use(exigirAutenticacao);
router.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    next(err);
  }
});

const limiteVerificar = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  keyGenerator: (req) => `u${req.usuario.id}`,
  validate: { keyGeneratorIpFallback: false },
  message: { erro: "Muitas verificações em pouco tempo. Aguarde um instante." },
});

// ------------------------------------------------------------------ helpers
async function carregarTentativa(req, res) {
  const id = Number(req.params.tid);
  if (!Number.isInteger(id)) {
    res.status(404).json({ erro: "Tentativa não encontrada." });
    return null;
  }
  const { rows } = await db.query("SELECT * FROM challenge_attempts WHERE id = $1 AND user_id = $2", [id, req.usuario.id]);
  const t = rows[0];
  if (!t) {
    res.status(404).json({ erro: "Tentativa não encontrada." });
    return null;
  }
  // expira se o prazo passou
  if (t.status === "em_andamento" && new Date(t.deadline_at) < new Date()) {
    await db.query("UPDATE challenge_attempts SET status = 'expirado', finished_at = now() WHERE id = $1", [t.id]);
    t.status = "expirado";
  }
  return t;
}

const segundosRestantes = (t) => Math.max(0, Math.round((new Date(t.deadline_at) - Date.now()) / 1000));
const resumo = (t) => ({
  id: t.id,
  status: t.status,
  violacoes: t.violations,
  maxViolacoes: MAX_VIOLACOES,
  verificacoesRestantes: Math.max(0, MAX_VERIFICACOES - t.verifications),
  segundosRestantes: t.status === "em_andamento" ? segundosRestantes(t) : 0,
});

async function registrarEvento(t, tipo, detalhe) {
  const peso = PESO[tipo] || 0;
  // ignora duplicata do mesmo tipo em menos de 2 s (ex.: blur + visibilitychange juntos)
  if (peso > 0) {
    const { rows } = await db.query(
      "SELECT 1 FROM challenge_events WHERE attempt_id = $1 AND type = $2 AND weight > 0 AND created_at > now() - interval '2 seconds' LIMIT 1",
      [t.id, tipo]
    );
    if (rows.length) return t;
  }
  await db.query("INSERT INTO challenge_events (attempt_id, type, detail, weight) VALUES ($1, $2, $3, $4)", [t.id, tipo, String(detalhe || "").slice(0, 300), peso]);
  if (peso > 0 && t.status === "em_andamento") {
    const { rows } = await db.query("UPDATE challenge_attempts SET violations = violations + $2 WHERE id = $1 RETURNING violations", [t.id, peso]);
    t.violations = rows[0].violations;
    if (t.violations >= MAX_VIOLACOES) {
      await db.query("UPDATE challenge_attempts SET status = 'anulado', finished_at = now() WHERE id = $1", [t.id]);
      t.status = "anulado";
    }
  }
  return t;
}

async function aprovados(userId) {
  const { rows } = await db.query("SELECT DISTINCT challenge_id FROM challenge_attempts WHERE user_id = $1 AND status = 'aprovado'", [userId]);
  return new Set(rows.map((r) => r.challenge_id));
}

// ------------------------------------------------------------------- rotas
// GET /api/desafios -> situação de cada desafio para o aluno
router.get("/", async (req, res, next) => {
  try {
    const ok = await aprovados(req.usuario.id);
    const { rows: ativas } = await db.query("SELECT id, challenge_id, deadline_at FROM challenge_attempts WHERE user_id = $1 AND status = 'em_andamento' AND deadline_at > now()", [req.usuario.id]);
    const { rows: anuladas } = await db.query(
      "SELECT challenge_id, MAX(finished_at) AS quando FROM challenge_attempts WHERE user_id = $1 AND status = 'anulado' GROUP BY challenge_id",
      [req.usuario.id]
    );
    res.json({
      desafios: desafios.map((d) => {
        const ativa = ativas.find((a) => a.challenge_id === d.id);
        const an = anuladas.find((a) => a.challenge_id === d.id);
        const espera = an ? Math.max(0, COOLDOWN_ANULADA_S - Math.round((Date.now() - new Date(an.quando)) / 1000)) : 0;
        return { id: d.id, lessonId: d.lessonId, titulo: d.titulo, tempoMin: d.tempoMin, aprovado: ok.has(d.id), emAndamento: !!ativa, esperaSegundos: espera };
      }),
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/desafios/:id/iniciar -> cria (ou retoma) a tentativa
router.post("/:id/iniciar", async (req, res, next) => {
  try {
    const d = porId.get(req.params.id);
    if (!d) return res.status(404).json({ erro: "Desafio não encontrado." });
    if ((await aprovados(req.usuario.id)).has(d.id)) return res.status(409).json({ erro: "Você já foi aprovado neste desafio." });

    let { rows } = await db.query("SELECT * FROM challenge_attempts WHERE user_id = $1 AND challenge_id = $2 AND status = 'em_andamento' ORDER BY id DESC LIMIT 1", [req.usuario.id, d.id]);
    let t = rows[0];
    if (t && new Date(t.deadline_at) < new Date()) {
      await db.query("UPDATE challenge_attempts SET status = 'expirado', finished_at = now() WHERE id = $1", [t.id]);
      t = null;
    }

    if (t) {
      // retomada (recarregou a página / voltou depois de fechar)
      const gap = t.last_ping_at ? (Date.now() - new Date(t.last_ping_at)) / 1000 : 0;
      t = await registrarEvento(t, gap > SEM_SINAL_S ? "sem_sinal" : "retomou", `ausente por ${Math.round(gap)}s`);
      if (t.status === "anulado") return res.status(423).json({ erro: "Tentativa anulada por violações das regras da prova.", tentativa: resumo(t) });
    } else {
      const { rows: an } = await db.query(
        "SELECT finished_at FROM challenge_attempts WHERE user_id = $1 AND challenge_id = $2 AND status = 'anulado' ORDER BY finished_at DESC LIMIT 1",
        [req.usuario.id, d.id]
      );
      if (an[0]) {
        const espera = COOLDOWN_ANULADA_S - Math.round((Date.now() - new Date(an[0].finished_at)) / 1000);
        if (espera > 0) return res.status(429).json({ erro: `Sua última tentativa foi anulada. Aguarde ${espera}s para tentar novamente.`, esperaSegundos: espera });
      }
      const ins = await db.query(
        "INSERT INTO challenge_attempts (user_id, challenge_id, deadline_at, last_ping_at) VALUES ($1, $2, now() + ($3 || ' minutes')::interval, now()) RETURNING *",
        [req.usuario.id, d.id, String(d.tempoMin)]
      );
      t = ins.rows[0];
      await db.query("INSERT INTO challenge_events (attempt_id, type, detail, weight) VALUES ($1, 'iniciou', '', 0)", [t.id]);
    }
    await db.query("UPDATE challenge_attempts SET last_ping_at = now() WHERE id = $1", [t.id]);

    res.json({
      tentativa: resumo(t),
      desafio: publico(d),
      fluxo: t.draft || d.fluxoInicial,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/desafios/tentativas/:tid/evento
router.post("/tentativas/:tid/evento", async (req, res, next) => {
  try {
    let t = await carregarTentativa(req, res);
    if (!t) return;
    const tipo = String((req.body || {}).tipo || "");
    if (!(tipo in PESO)) return res.status(400).json({ erro: "Evento inválido." });
    if (t.status === "em_andamento") t = await registrarEvento(t, tipo, (req.body || {}).detalhe);
    res.json(resumo(t));
  } catch (err) {
    next(err);
  }
});

// POST /api/desafios/tentativas/:tid/ping  (batimento + rascunho do fluxo)
router.post("/tentativas/:tid/ping", async (req, res, next) => {
  try {
    let t = await carregarTentativa(req, res);
    if (!t) return;
    if (t.status === "em_andamento") {
      const gap = t.last_ping_at ? (Date.now() - new Date(t.last_ping_at)) / 1000 : 0;
      if (gap > SEM_SINAL_S) t = await registrarEvento(t, "sem_sinal", `sem sinal por ${Math.round(gap)}s`);
      if (t.status === "em_andamento") {
        const fluxo = (req.body || {}).fluxo;
        if (Array.isArray(fluxo) && JSON.stringify(fluxo).length <= MAX_RASCUNHO) {
          await db.query("UPDATE challenge_attempts SET last_ping_at = now(), draft = $2::jsonb WHERE id = $1", [t.id, JSON.stringify(fluxo)]);
        } else await db.query("UPDATE challenge_attempts SET last_ping_at = now() WHERE id = $1", [t.id]);
      }
    }
    res.json(resumo(t));
  } catch (err) {
    next(err);
  }
});

// POST /api/desafios/tentativas/:tid/verificar  -> roda o juiz
router.post("/tentativas/:tid/verificar", limiteVerificar, async (req, res, next) => {
  try {
    const t = await carregarTentativa(req, res);
    if (!t) return;
    if (t.status !== "em_andamento") return res.status(409).json({ erro: "Esta tentativa não está mais ativa.", tentativa: resumo(t) });
    if (t.verifications >= MAX_VERIFICACOES) return res.status(409).json({ erro: "Você atingiu o limite de correções desta tentativa.", tentativa: resumo(t) });

    const d = porId.get(t.challenge_id);
    const { fluxo, telemetria } = req.body || {};
    if (!Array.isArray(fluxo)) return res.status(400).json({ erro: "Fluxo inválido." });

    let resultado;
    try {
      resultado = await julgar(d, fluxo, crypto.randomInt(1, 2 ** 31 - 1));
    } catch (e) {
      return res.status(400).json({ erro: e.message || "Não foi possível avaliar o fluxo." });
    }

    // heurística: muito texto no fluxo e poucas teclas digitadas = suspeita de colagem
    const chars = resultado.fluxo.reduce((s, n) => s + (n.func || "").length + (n.template || "").length, 0);
    const teclas = Number((telemetria || {}).teclas) || 0;
    let suspeito = false;
    if (chars > 80 && teclas < chars * 0.5) {
      suspeito = true;
      await registrarEvento(t, "suspeita_colagem", `texto no fluxo: ${chars} caracteres; teclas digitadas: ${teclas}`);
    }

    const acertos = resultado.requisitos.filter((r) => r.ok).length;
    const novoStatus = resultado.passou ? "aprovado" : t.verifications + 1 >= MAX_VERIFICACOES ? "reprovado" : "em_andamento";
    await db.query(
      `UPDATE challenge_attempts
          SET verifications = verifications + 1, status = $2, score = $3, draft = $4::jsonb,
              suspeito = suspeito OR $5, finished_at = CASE WHEN $2 = 'em_andamento' THEN NULL ELSE now() END
        WHERE id = $1`,
      [t.id, novoStatus, Math.round((acertos / resultado.requisitos.length) * 100), JSON.stringify(fluxo), suspeito]
    );
    await db.query("INSERT INTO challenge_submissions (attempt_id, flow, results, passed) VALUES ($1, $2::jsonb, $3::jsonb, $4)", [
      t.id,
      JSON.stringify(fluxo),
      JSON.stringify(resultado.requisitos),
      resultado.passou,
    ]);

    t.verifications += 1;
    t.status = novoStatus;
    res.json({ passou: resultado.passou, requisitos: resultado.requisitos, tentativa: resumo(t) });
  } catch (err) {
    next(err);
  }
});

// POST /api/desafios/tentativas/:tid/desistir
router.post("/tentativas/:tid/desistir", async (req, res, next) => {
  try {
    const t = await carregarTentativa(req, res);
    if (!t) return;
    if (t.status === "em_andamento") await db.query("UPDATE challenge_attempts SET status = 'desistiu', finished_at = now() WHERE id = $1", [t.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.config = { MAX_VIOLACOES, MAX_VERIFICACOES, COOLDOWN_ANULADA_S, SEM_SINAL_S };
