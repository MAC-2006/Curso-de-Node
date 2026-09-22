// src/routes/admin.js
// Rotas exclusivas da administração: visão geral de todos os alunos,
// detalhe de progresso individual e checklist de vídeos a produzir.
const path = require("path");
const express = require("express");
const multer = require("multer");
const db = require("../db");
const curriculum = require("../data/curriculum");
const videoStore = require("../data/video-store");
const storage = require("../storage");
const { exigirAutenticacao, exigirAdmin } = require("../middleware/auth");

const router = express.Router();

// ---------- upload de vídeos (multer + Supabase Storage) ----------
// Antes os vídeos eram gravados em disco (public/uploads/videos). No Vercel
// o sistema de arquivos das funções é somente leitura, então usamos
// memoryStorage aqui: o arquivo fica em memória só durante a requisição e é
// enviado direto para o Supabase Storage (veja src/storage.js).

const EXTENSOES_PERMITIDAS = new Set([".mp4", ".webm", ".mov", ".mkv", ".m4v"]);

const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB (veja também o limite do seu plano Vercel/Supabase)
  fileFilter: (req, file, cb) => {
    const extensao = path.extname(file.originalname).toLowerCase();
    if (!EXTENSOES_PERMITIDAS.has(extensao)) {
      return cb(new Error("Formato de vídeo não suportado. Use mp4, webm, mov, mkv ou m4v."));
    }
    cb(null, true);
  },
});

// Toda rota aqui exige estar logado E ser administrador
router.use(exigirAutenticacao, exigirAdmin);
router.use(async (req, res, next) => {
  try {
    await db.init();
    next();
  } catch (err) {
    next(err);
  }
});

function todasAsAulas() {
  return curriculum.flatMap((m) => m.lessons.map((l) => ({ ...l, moduloId: m.id })));
}

const TOTAL_AULAS = todasAsAulas().length;

// GET /api/admin/alunos -> lista todos os alunos (não-admin) com estatísticas
router.get("/alunos", async (req, res, next) => {
  try {
    const { rows: alunos } = await db.query(
      `SELECT id, name, email, created_at
         FROM users
        WHERE is_admin = FALSE
        ORDER BY created_at DESC`
    );

    const linhas = await Promise.all(
      alunos.map(async (aluno) => {
        const { rows: progressoRows } = await db.query(
          "SELECT COUNT(*) AS total, MAX(completed_at) AS ultima FROM progress WHERE user_id = $1",
          [aluno.id]
        );
        const { rows: quizRows } = await db.query(
          "SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS acertos FROM quiz_results WHERE user_id = $1",
          [aluno.id]
        );
        const progresso = progressoRows[0];
        const quiz = quizRows[0];
        const aulasConcluidas = Number(progresso.total) || 0;
        const quizTotal = Number(quiz.total) || 0;
        const quizAcertos = Number(quiz.acertos) || 0;

        return {
          id: aluno.id,
          name: aluno.name,
          email: aluno.email,
          criadoEm: aluno.created_at,
          ultimaAtividade: progresso.ultima || null,
          aulasConcluidas,
          totalAulas: TOTAL_AULAS,
          percentual: TOTAL_AULAS ? Math.round((aulasConcluidas / TOTAL_AULAS) * 100) : 0,
          quizTotal,
          quizAcertos,
          quizPercentual: quizTotal ? Math.round((quizAcertos / quizTotal) * 100) : null,
        };
      })
    );

    const totalAlunos = linhas.length;
    const mediaPercentual = totalAlunos
      ? Math.round(linhas.reduce((soma, a) => soma + a.percentual, 0) / totalAlunos)
      : 0;
    const alunosConcluiram = linhas.filter((a) => a.percentual === 100).length;
    const alunosSemAtividade = linhas.filter((a) => a.aulasConcluidas === 0).length;

    res.json({
      resumo: {
        totalAlunos,
        totalAulas: TOTAL_AULAS,
        mediaPercentual,
        alunosConcluiram,
        alunosSemAtividade,
      },
      alunos: linhas,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/alunos/:id -> detalhe de um aluno específico
router.get("/alunos/:id", async (req, res, next) => {
  try {
    const { rows: alunoRows } = await db.query(
      "SELECT id, name, email, created_at, is_admin FROM users WHERE id = $1",
      [req.params.id]
    );
    const aluno = alunoRows[0];

    if (!aluno || aluno.is_admin) {
      return res.status(404).json({ erro: "Aluno não encontrado." });
    }

    const { rows: concluidas } = await db.query(
      "SELECT lesson_id, completed_at FROM progress WHERE user_id = $1 ORDER BY completed_at DESC",
      [aluno.id]
    );

    const { rows: quizzes } = await db.query(
      "SELECT lesson_id, correct, created_at FROM quiz_results WHERE user_id = $1 ORDER BY created_at DESC",
      [aluno.id]
    );

    const idsConcluidos = new Set(concluidas.map((c) => c.lesson_id));

    // Progresso detalhado por módulo, para o painel mostrar onde o aluno está
    const porModulo = curriculum.map((modulo) => {
      const totalModulo = modulo.lessons.length;
      const concluidasModulo = modulo.lessons.filter((l) => idsConcluidos.has(l.id)).length;
      return {
        moduloId: modulo.id,
        titulo: modulo.title,
        concluidas: concluidasModulo,
        total: totalModulo,
        percentual: totalModulo ? Math.round((concluidasModulo / totalModulo) * 100) : 0,
      };
    });

    res.json({
      aluno: {
        id: aluno.id,
        name: aluno.name,
        email: aluno.email,
        criadoEm: aluno.created_at,
      },
      totalAulas: TOTAL_AULAS,
      aulasConcluidas: concluidas.length,
      percentual: TOTAL_AULAS ? Math.round((concluidas.length / TOTAL_AULAS) * 100) : 0,
      porModulo,
      concluidas,
      quizzes,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/admin/videos -> checklist de produção: onde entram vídeos e o
// roteiro sugerido para cada um (uso interno da equipe, não vai para o aluno)
router.get("/videos", async (req, res, next) => {
  try {
    const overrides = await videoStore.obterTodos();
    const slots = [];

    curriculum.forEach((modulo) => {
      modulo.lessons.forEach((aula) => {
        if (aula.video) {
          // A URL enviada por upload (se houver) tem prioridade sobre a
          // que estiver hardcoded no currículo.
          const videoUrl = overrides[aula.id] || aula.video.videoUrl || null;
          slots.push({
            moduloId: modulo.id,
            moduloTitle: modulo.title,
            lessonId: aula.id,
            lessonTitle: aula.title,
            tituloVideo: aula.video.titulo,
            duracaoSugerida: aula.video.duracaoSugerida || null,
            roteiro: aula.video.roteiro || [],
            gravado: !!videoUrl,
            videoUrl,
          });
        }
      });
    });

    res.json({
      total: slots.length,
      gravados: slots.filter((s) => s.gravado).length,
      pendentes: slots.filter((s) => !s.gravado).length,
      slots,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/admin/videos/:lessonId/upload -> envia (ou substitui) o
// arquivo de vídeo de um ponto do currículo. Campo do form-data: "video".
router.post("/videos/:lessonId/upload", (req, res, next) => {
  const { lessonId } = req.params;
  const aula = todasAsAulas().find((l) => l.id === lessonId);

  if (!aula || !aula.video) {
    return res.status(404).json({ erro: "Esse ponto de vídeo não existe no currículo." });
  }

  uploadVideo.single("video")(req, res, async (err) => {
    if (err) {
      const mensagem =
        err.code === "LIMIT_FILE_SIZE"
          ? "O arquivo é muito grande (limite de 2GB)."
          : err.message || "Falha ao enviar o vídeo.";
      return res.status(400).json({ erro: mensagem });
    }
    if (!req.file) {
      return res.status(400).json({ erro: "Nenhum arquivo de vídeo foi enviado." });
    }

    try {
      // Se já existia um vídeo enviado antes para essa aula, guarda a URL
      // antiga para remover do bucket depois que o novo upload for concluído.
      const urlAnterior = await videoStore.obterUrl(lessonId);

      const extensao = path.extname(req.file.originalname).toLowerCase() || ".mp4";
      const { url: novaUrl } = await storage.enviarVideo({
        lessonId,
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        extensao,
      });

      await videoStore.definirUrl(lessonId, novaUrl);

      if (urlAnterior) {
        await storage.removerVideoPorUrl(urlAnterior);
      }

      res.status(201).json({ videoUrl: novaUrl });
    } catch (uploadErr) {
      next(uploadErr);
    }
  });
});

// DELETE /api/admin/videos/:lessonId/upload -> remove um upload feito por
// engano, voltando a aula para o estado "pendente de gravação".
router.delete("/videos/:lessonId/upload", async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const urlAtual = await videoStore.obterUrl(lessonId);

    if (!urlAtual) {
      return res.status(404).json({ erro: "Não há upload registrado para essa aula." });
    }

    await storage.removerVideoPorUrl(urlAtual);
    await videoStore.removerUrl(lessonId);

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
