// src/routes/progresso.js
const express = require("express");
const db = require("../db");
const curriculum = require("../data/curriculum");
const { exigirAutenticacao } = require("../middleware/auth");

const router = express.Router();
router.use(exigirAutenticacao); // todas as rotas aqui exigem login
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

// GET /api/progresso -> lista de aulas concluídas + estatísticas
router.get("/", async (req, res, next) => {
  try {
    const { rows: concluidas } = await db.query(
      "SELECT lesson_id, completed_at FROM progress WHERE user_id = $1",
      [req.usuario.id]
    );

    const { rows: quizRows } = await db.query(
      "SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS acertos FROM quiz_results WHERE user_id = $1",
      [req.usuario.id]
    );
    const quizStats = quizRows[0];

    const idsConcluidos = new Set(concluidas.map((c) => c.lesson_id));
    const total = todasAsAulas().length;

    // Percentual por módulo, para a barra lateral mostrar o avanço em cada
    // etapa do curso, além do percentual geral.
    const porModulo = curriculum.map((modulo) => {
      const totalModulo = modulo.lessons.length;
      const concluidasModulo = modulo.lessons.filter((l) => idsConcluidos.has(l.id)).length;
      return {
        moduloId: modulo.id,
        concluidas: concluidasModulo,
        total: totalModulo,
        percentual: totalModulo ? Math.round((concluidasModulo / totalModulo) * 100) : 0,
      };
    });

    const quizTotal = Number(quizStats.total) || 0;
    const quizAcertos = Number(quizStats.acertos) || 0;

    res.json({
      concluidas: concluidas.map((c) => c.lesson_id),
      detalhes: concluidas,
      total,
      percentual: total ? Math.round((concluidas.length / total) * 100) : 0,
      porModulo,
      quiz: {
        total: quizTotal,
        acertos: quizAcertos,
        percentual: quizTotal ? Math.round((quizAcertos / quizTotal) * 100) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/progresso/:lessonId/concluir -> marca uma aula como concluída
router.post("/:lessonId/concluir", async (req, res, next) => {
  try {
    const aulaValida = todasAsAulas().some((a) => a.id === req.params.lessonId);
    if (!aulaValida) {
      return res.status(404).json({ erro: "Aula não encontrada." });
    }

    await db.query(
      "INSERT INTO progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [req.usuario.id, req.params.lessonId]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/progresso/:lessonId/quiz -> envia resposta do quiz e recebe correção
router.post("/:lessonId/quiz", async (req, res, next) => {
  try {
    const { optionIndex } = req.body || {};

    const aula = todasAsAulas().find((a) => a.id === req.params.lessonId);
    if (!aula || !aula.quiz) {
      return res.status(404).json({ erro: "Quiz não encontrado para esta aula." });
    }

    if (typeof optionIndex !== "number") {
      return res.status(400).json({ erro: "Selecione uma alternativa." });
    }

    const correto = optionIndex === aula.quiz.correctIndex;

    await db.query(
      "INSERT INTO quiz_results (user_id, lesson_id, correct) VALUES ($1, $2, $3)",
      [req.usuario.id, req.params.lessonId, correto ? 1 : 0]
    );

    if (correto) {
      await db.query(
        "INSERT INTO progress (user_id, lesson_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [req.usuario.id, req.params.lessonId]
      );
    }

    res.json({ correto, correctIndex: aula.quiz.correctIndex });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
