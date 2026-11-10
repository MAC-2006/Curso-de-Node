// src/routes/progresso.js
const express = require("express");
const PDFDocument = require("pdfkit");
const db = require("../db");
const curriculum = require("../data/curriculum");
const { exigirAutenticacao } = require("../middleware/auth");
const { aulasConcluidas } = require("../sim/progresso-util");
const { desafios } = require("../data/challenges");

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

// GET /api/progresso/certificado -> baixa o certificado em PDF
router.get("/certificado", async (req, res, next) => {
  try {
    const concluidasCert = (await aulasConcluidas(req.usuario.id)).length;

    if (concluidasCert < todasAsAulas().length) {
      return res.status(403).json({ erro: "Complete todas as aulas para liberar o certificado." });
    }

    const data = new Date().toLocaleDateString("pt-BR");
    const documento = new PDFDocument({ size: "A4", margin: 48 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="certificado-node-red.pdf"');

    documento.pipe(res);
    documento.lineWidth(3).strokeColor("#0d9db1").roundedRect(36, 36, 523, 770, 14).stroke();
    documento.lineWidth(1).strokeColor("#e4b84a").roundedRect(50, 50, 495, 742, 9).stroke();

    documento.fillColor("#0d9db1").font("Helvetica-Bold").fontSize(18)
      .text("CERTIFICADO DE CONCLUSÃO", 70, 150, { align: "center", width: 455, characterSpacing: 2 });
    documento.fillColor("#657285").font("Helvetica").fontSize(15)
      .text("Certificamos que", 70, 225, { align: "center", width: 455 });
    documento.fillColor("#182230").font("Helvetica-Bold").fontSize(29)
      .text(req.usuario.name, 70, 285, { align: "center", width: 455 });
    documento.fillColor("#657285").font("Helvetica").fontSize(15)
      .text("concluiu o curso", 70, 365, { align: "center", width: 455 });
    documento.fillColor("#182230").font("Helvetica-Bold").fontSize(21)
      .text("Node-RED: Automação de Processos e IoT", 70, 420, { align: "center", width: 455 });
    documento.strokeColor("#182230").lineWidth(1).moveTo(190, 570).lineTo(410, 570).stroke();
    documento.fillColor("#657285").font("Helvetica").fontSize(12)
      .text(`Curso concluído em ${data}`, 70, 590, { align: "center", width: 455 });
    documento.fillColor("#0d9db1").fontSize(11)
      .text("Plataforma de estudos Node-RED", 70, 665, { align: "center", width: 455 });
    documento.end();
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
    // uma aula com desafio prático só conta quando o aluno passou no desafio
    const concluidas = await aulasConcluidas(req.usuario.id);
    const { rows: aprovRows } = await db.query(
      "SELECT DISTINCT challenge_id FROM challenge_attempts WHERE user_id = $1 AND status = 'aprovado'",
      [req.usuario.id]
    );
    const aprovados = new Set(aprovRows.map((r) => r.challenge_id));

    const { rows: quizRows } = await db.query(
      "SELECT COUNT(*) AS total, COALESCE(SUM(correct), 0) AS acertos FROM quiz_results WHERE user_id = $1",
      [req.usuario.id]
    );
    const { rows: quizRespostas } = await db.query(
      `SELECT DISTINCT ON (lesson_id) lesson_id, option_index, correct
         FROM quiz_results
        WHERE user_id = $1
        ORDER BY lesson_id, created_at DESC, id DESC`,
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
      desafios: desafios.map((d) => ({ id: d.id, lessonId: d.lessonId, titulo: d.titulo, aprovado: aprovados.has(d.id) })),
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
      quizRespostas: quizRespostas.map((resposta) => ({
        lessonId: resposta.lesson_id,
        optionIndex: resposta.option_index === null ? null : Number(resposta.option_index),
        correto: Boolean(resposta.correct),
      })),
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
      "INSERT INTO quiz_results (user_id, lesson_id, option_index, correct) VALUES ($1, $2, $3, $4)",
      [req.usuario.id, req.params.lessonId, optionIndex, correto ? 1 : 0]
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
