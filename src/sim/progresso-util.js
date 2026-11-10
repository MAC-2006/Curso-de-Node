// Fonte única da verdade sobre "aula concluída":
// uma aula só conta como concluída se (a) está em `progress` (quiz acertado ou
// marcada) E (b) quando ela tem um desafio prático, o aluno foi APROVADO nele.
const db = require("../db");
const { porAula } = require("../data/challenges");

async function aulasConcluidas(userId) {
  const { rows: prog } = await db.query("SELECT lesson_id, completed_at FROM progress WHERE user_id = $1", [userId]);
  const { rows: apr } = await db.query("SELECT DISTINCT challenge_id FROM challenge_attempts WHERE user_id = $1 AND status = 'aprovado'", [userId]);
  const ok = new Set(apr.map((r) => r.challenge_id));
  return prog.filter((p) => {
    const d = porAula.get(p.lesson_id);
    return !d || ok.has(d.id);
  });
}

module.exports = { aulasConcluidas };
