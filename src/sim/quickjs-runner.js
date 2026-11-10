// src/sim/quickjs-runner.js
// Executa o código dos nodes "Function" dos alunos dentro do QuickJS (um
// interpretador JavaScript compilado para WebAssembly). Diferente do módulo
// `vm` do Node, o QuickJS NÃO compartilha objetos nem memória com o servidor:
// o código do aluno não enxerga `process`, `require`, arquivos, rede, nem
// variáveis de ambiente. Cada chamada ganha um runtime novo, com limite de
// tempo e de memória.
const { newQuickJSWASMModuleFromVariant, shouldInterruptAfterDeadline } = require("quickjs-emscripten");
// Variante "singlefile": o WebAssembly vem embutido no próprio JS, então funciona
// em funções serverless (Vercel) sem depender de achar um arquivo .wasm no disco.
const variante = require("@jitl/quickjs-singlefile-cjs-release-sync");
const NRSim = require("../../public/js/nr/engine.js");

const LIMITE_MS = 1000;
const LIMITE_MEMORIA = 24 * 1024 * 1024;

let quickjsPromise = null;
const carregar = () => (quickjsPromise = quickjsPromise || newQuickJSWASMModuleFromVariant(variante));

async function runFunction(req) {
  const QuickJS = await carregar();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(LIMITE_MEMORIA);
  runtime.setMaxStackSize(512 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + LIMITE_MS));
  const vm = runtime.newContext();
  try {
    const entrada = JSON.stringify({
      msg: req.msg,
      node: req.node,
      flow: req.flow,
      global: req.global,
      nodeCtx: req.nodeCtx,
      env: req.env || {},
    });
    const h = vm.newString(entrada);
    vm.setProp(vm.global, "__INPUT", h);
    h.dispose();

    const resultado = vm.evalCode(NRSim.buildFunctionScript(req.code), "function-node.js");
    if (resultado.error) {
      const err = vm.dump(resultado.error);
      resultado.error.dispose();
      const msg = err && err.message ? `${err.name ? err.name + ": " : ""}${err.message}` : String(err);
      return { error: /interrupted/i.test(msg) ? "A função demorou demais (possível loop infinito)." : msg, logs: [] };
    }
    const texto = vm.dump(resultado.value);
    resultado.value.dispose();
    return JSON.parse(texto);
  } catch (e) {
    return { error: "Falha ao executar a função: " + (e && e.message ? e.message : String(e)), logs: [] };
  } finally {
    try {
      vm.dispose();
      runtime.dispose();
    } catch (e) {
      /* já liberado */
    }
  }
}

module.exports = { runFunction };
