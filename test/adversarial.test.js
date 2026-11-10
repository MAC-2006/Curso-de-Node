// Tentativas de burlar o juiz: nenhuma pode ser aprovada.
const { porId } = require("../src/data/challenges");
const { julgar } = require("../src/sim/judge");
const sol = require("./solucoes");
let falhas = 0;
const esperaReprovar = async (nome, id, fluxo) => {
  const t = Date.now();
  const r = await julgar(porId.get(id), fluxo, 9);
  const ok = !r.passou;
  if (!ok) falhas++;
  console.log(ok ? "ok  " : "✗   ", nome, `(${Date.now() - t} ms)`);
};
(async () => {
  const ini = porId.get("json-idade").fluxoInicial;
  // 1) resposta "chumbada" (sempre devolve o texto do exemplo)
  await esperaReprovar("resposta fixa", "json-idade", [
    ...JSON.parse(JSON.stringify(ini)).map((n) => (n.id === "entrada" ? { ...n, wires: [["f"]] } : n)),
    { id: "f", type: "function", func: 'msg.payload = "Carlos é maior de idade"; return msg;', outputs: 1, wires: [["saida"]] },
  ]);
  // 2) apagar/alterar o node travado de entrada
  await esperaReprovar("node travado adulterado", "json-idade", [
    { id: "entrada", type: "inject", props: [{ p: "payload", v: "x", vt: "str" }], wires: [["saida"]] },
    { id: "saida", type: "debug", active: false, complete: "payload", wires: [] },
  ]);
  // 3) loop infinito em Function (não pode travar o servidor)
  await esperaReprovar("while(true)", "json-idade", [
    ...JSON.parse(JSON.stringify(ini)).map((n) => (n.id === "entrada" ? { ...n, wires: [["f"]] } : n)),
    { id: "f", type: "function", func: "while(true){}", outputs: 1, wires: [["saida"]] },
  ]);
  // 4) tentar acessar o servidor pela Function
  await esperaReprovar("process/require", "json-idade", [
    ...JSON.parse(JSON.stringify(ini)).map((n) => (n.id === "entrada" ? { ...n, wires: [["f"]] } : n)),
    { id: "f", type: "function", func: 'msg.payload = require("fs").readFileSync("/etc/passwd","utf8"); return msg;', outputs: 1, wires: [["saida"]] },
  ]);
  // 5) laço infinito de mensagens
  await esperaReprovar("laço de mensagens", "json-idade", [
    ...JSON.parse(JSON.stringify(ini)).map((n) => (n.id === "entrada" ? { ...n, wires: [["a"]] } : n)),
    { id: "a", type: "change", rules: [], wires: [["b"]] }, { id: "b", type: "change", rules: [], wires: [["a"]] },
  ]);
  // 6) lixo
  await esperaReprovar("tipos inválidos", "json-idade", [{ id: "x", type: "exec", wires: [] }]);
  // 7) fluxo enorme
  let erro = null;
  try { await julgar(porId.get("json-idade"), Array.from({ length: 500 }, (_, i) => ({ id: "n" + i, type: "debug", wires: [] })), 1); } catch (e) { erro = e.message; }
  console.log(erro ? "ok   fluxo enorme recusado" : "✗ fluxo enorme aceito"); if (!erro) falhas++;
  process.exit(falhas ? 1 : 0);
})();
