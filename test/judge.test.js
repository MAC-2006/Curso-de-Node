// Testa o juiz: soluções de referência devem passar; fluxo vazio/inicial deve falhar.
const { desafios } = require("../src/data/challenges");
const { julgar } = require("../src/sim/judge");
const solucoes = require("./solucoes");

(async () => {
  let falhas = 0;
  for (const d of desafios) {
    const sol = solucoes[d.id];
    if (!sol) { console.log("SEM SOLUÇÃO", d.id); falhas++; continue; }
    // 3 sementes diferentes: a solução correta deve passar em todas
    for (const semente of [1, 77, 12345]) {
      const r = await julgar(d, sol, semente);
      if (!r.passou) {
        falhas++;
        console.log("✗ solução reprovada:", d.id, semente, JSON.stringify(r.requisitos.filter((x) => !x.ok)));
      }
    }
    const vazio = await julgar(d, d.fluxoInicial, 5);
    if (vazio.passou) {
      falhas++;
      console.log("✗ fluxo inicial (sem solução) foi APROVADO:", d.id);
    }
    console.log("ok  ", d.id);
  }
  console.log(falhas ? `\n${falhas} falha(s)` : "\nTodos os desafios: solução aprova, fluxo vazio reprova.");
  process.exit(falhas ? 1 : 0);
})();
