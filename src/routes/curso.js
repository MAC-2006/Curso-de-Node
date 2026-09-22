// src/routes/curso.js
const express = require("express");
const curriculum = require("../data/curriculum");
const videoStore = require("../data/video-store");
const db = require("../db");

const router = express.Router();

// Versão "resumida" (sem conteúdo completo das aulas) para montar o menu
function resumoCurriculo() {
  return curriculum.map((modulo) => ({
    id: modulo.id,
    title: modulo.title,
    lessons: modulo.lessons.map((aula) => ({ id: aula.id, title: aula.title })),
  }));
}

router.get("/", (req, res) => {
  res.json({ modulos: resumoCurriculo() });
});

router.get("/aula/:lessonId", async (req, res, next) => {
  try {
    await db.init();

    for (const modulo of curriculum) {
      const aula = modulo.lessons.find((l) => l.id === req.params.lessonId);
      if (aula) {
        // não envia a resposta correta do quiz para o cliente
        const { quiz, video, ...aulaSemGabarito } = aula;
        const quizSemGabarito = quiz ? { question: quiz.question, options: quiz.options } : null;
        // o roteiro/tutorial do vídeo é material interno da produção,
        // então o aluno só recebe título, duração e o link (quando existir).
        // A URL pode vir tanto do currículo (código) quanto de um upload
        // feito pelo admin no painel — o upload tem prioridade.
        const videoParaAluno = video
          ? {
              titulo: video.titulo,
              duracaoSugerida: video.duracaoSugerida || null,
              videoUrl: (await videoStore.obterUrl(aula.id)) || video.videoUrl || null,
            }
          : null;
        return res.json({
          moduloId: modulo.id,
          moduloTitle: modulo.title,
          aula: { ...aulaSemGabarito, quiz: quizSemGabarito, video: videoParaAluno },
        });
      }
    }
    res.status(404).json({ erro: "Aula não encontrada." });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
