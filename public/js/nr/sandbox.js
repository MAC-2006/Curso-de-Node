/* Executa o código dos nodes Function no NAVEGADOR dentro de um Web Worker.
 * O worker roda fora da thread da página, então um `while(true){}` do aluno
 * não trava o editor: se passar de 1,5 s o worker é encerrado e o simulador
 * mostra "A função demorou demais". (O juiz do servidor usa QuickJS.) */
(function () {
  "use strict";

  const workerSource = `
    self.onmessage = function (e) {
      var d = e.data, out;
      try {
        var body = d.script.replace(/__result;\\s*$/, 'return __result;');
        out = (new Function('__INPUT', body))(d.input);
      } catch (err) {
        out = JSON.stringify({ error: (err && err.name ? err.name + ': ' : '') + (err && err.message ? err.message : String(err)), logs: [] });
      }
      self.postMessage(out);
    };
  `;

  let worker = null;

  function getWorker() {
    if (!worker) {
      const blob = new Blob([workerSource], { type: "application/javascript" });
      worker = new Worker(URL.createObjectURL(blob));
    }
    return worker;
  }

  function runFunction(req) {
    return new Promise((resolve) => {
      let w;
      try {
        w = getWorker();
      } catch (e) {
        resolve({ error: "Seu navegador não permitiu executar o código da função (Web Worker indisponível).", logs: [] });
        return;
      }
      const timer = setTimeout(() => {
        w.terminate();
        worker = null;
        resolve({ error: "A função demorou demais (possível loop infinito).", logs: [] });
      }, 1500);
      w.onmessage = (e) => {
        clearTimeout(timer);
        try {
          resolve(JSON.parse(e.data));
        } catch (err) {
          resolve({ error: "Resposta inválida da função.", logs: [] });
        }
      };
      w.onerror = (e) => {
        clearTimeout(timer);
        resolve({ error: e.message || "Erro ao executar a função.", logs: [] });
      };
      const input = JSON.stringify({
        msg: req.msg,
        node: req.node,
        flow: req.flow,
        global: req.global,
        nodeCtx: req.nodeCtx,
        env: req.env || {},
      });
      w.postMessage({ input, script: NRSim.buildFunctionScript(req.code) });
    });
  }

  window.NRSandbox = { runFunction };
})();
