// src/data/challenges.js
// Desafios práticos do simulador de Node-RED. Cada desafio tem:
//  - parte PÚBLICA (enviada ao aluno): título, enunciado, requisitos, dicas,
//    paleta de nodes permitida, fluxo inicial (com nodes travados 🔒);
//  - parte OCULTA (só no servidor): a função `avaliar`, que roda testes com
//    valores sorteados a cada verificação (impossível "chumbar" a resposta).
//
// Para criar um desafio novo, copie um existente e ajuste. `lessonId` liga o
// desafio a uma aula (o aluno só conclui a aula quando passa no desafio).

const entrada = (props, extra) =>
  Object.assign(
    { id: "entrada", type: "inject", name: "Entrada", props, repeat: "", crontab: "", once: false, onceDelay: 0.1, x: 160, y: 160, wires: [[]], locked: true, role: "entrada" },
    extra || {}
  );
const saida = (extra) =>
  Object.assign({ id: "saida", type: "debug", name: "Saída", active: true, complete: "payload", x: 620, y: 160, wires: [], locked: true, role: "saida" }, extra || {});
const broker = () => ({ id: "broker", type: "mqtt-broker", name: "", broker: "test.mosquitto.org", port: "1883", locked: true });

const NOMES = ["Carlos", "Ana", "Marina", "João", "Beatriz", "Rafael", "Lúcia", "Pedro"];
const URL_API = "https://jsonplaceholder.typicode.com";

const desafios = [
  // ------------------------------------------------------------------ 1
  {
    id: "primeiro-fluxo",
    lessonId: "editor-primeiro-fluxo",
    titulo: "Seu primeiro fluxo",
    tempoMin: 15,
    enunciado:
      "Monte o primeiro fluxo do curso: um Inject dispara uma mensagem, um Change troca o conteúdo e o Debug mostra o resultado.\n\nO Change deve definir msg.payload como o texto: Bem vindo ao curso\n\nLembre-se de clicar em Deploy antes de testar clicando no Inject.",
    requisitos: [
      { id: "r1", texto: "Um node Inject está ligado (direta ou indiretamente) a um node Debug" },
      { id: "r2", texto: "Existe um node Change entre o Inject e o Debug" },
      { id: "r3", texto: 'Ao injetar, o Debug recebe o texto "Bem vindo ao curso"' },
    ],
    dicas: ["Arraste os nodes da paleta e puxe o fio da saída (direita) de um node até a entrada (esquerda) do próximo.", "No Change, use a regra Definir → msg.payload → texto."],
    paleta: ["inject", "debug", "change", "comment"],
    fluxoInicial: [],
    async avaliar(h, a) {
      a.ok("r1", h.caminhoTipos("inject", "debug"), "Ligue um Inject a um Debug com um fio.");
      a.ok("r2", h.caminhoVia("inject", "change", "debug"), "Coloque um node Change no caminho entre o Inject e o Debug.");
      const S = await h.sessao();
      await S.disparar("inject");
      await S.avancar(500);
      const out = S.saida();
      a.ok("r3", out.includes("Bem vindo ao curso"), `O Debug recebeu ${a.mostrar(out)}; esperado "Bem vindo ao curso".`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 2
  {
    id: "msg-payload-objeto",
    lessonId: "mensagens-msg-payload",
    titulo: "Montando um objeto em msg.payload",
    tempoMin: 15,
    enunciado:
      'O Inject (🔒) e o Debug (🔒) já estão no fluxo. Coloque entre eles um node Function que faça msg.payload virar um objeto com a temperatura 24 e a unidade "°C":\n\n{ temperatura: 24, unidade: "°C" }\n\nNão esqueça de retornar a mensagem.',
    requisitos: [
      { id: "r1", texto: "O fluxo usa um node Function" },
      { id: "r2", texto: 'O Debug recebe o objeto { temperatura: 24, unidade: "°C" }' },
      { id: "r3", texto: "Cada clique no Inject gera exatamente uma mensagem na saída" },
    ],
    dicas: ["msg.payload = { temperatura: 24, unidade: \"°C\" };\nreturn msg;"],
    paleta: ["function", "change", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "", vt: "date" }]), saida()],
    async avaliar(h, a) {
      a.ok("r1", h.tem("function"), "Adicione um node Function.");
      const S = await h.sessao();
      await S.disparar("entrada");
      await S.avancar(500);
      const out = S.saida("saida");
      a.eq("r2", out[0], { temperatura: 24, unidade: "°C" });
      a.ok("r3", out.length === 1, `A saída recebeu ${out.length} mensagem(ns).`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 3
  {
    id: "change-status",
    lessonId: "inject-debug-change",
    titulo: "Alterando a mensagem com Change",
    tempoMin: 15,
    enunciado:
      'O Inject (🔒) envia o texto "início do processo". Use um node Change para:\n\n1) definir msg.payload como "processo iniciado";\n2) definir msg.topic como "status".\n\nO Debug (🔒) mostra a mensagem completa.',
    requisitos: [
      { id: "r1", texto: "O fluxo usa um node Change" },
      { id: "r2", texto: 'msg.payload chega como "processo iniciado"' },
      { id: "r3", texto: 'msg.topic chega como "status"' },
    ],
    dicas: ["Um único Change pode ter várias regras: clique em + adicionar regra."],
    paleta: ["change", "function", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "início do processo", vt: "str" }]), saida({ complete: "true", name: "Mensagem completa" })],
    async avaliar(h, a) {
      a.ok("r1", h.tem("change"), "Adicione um node Change.");
      const S = await h.sessao();
      await S.disparar("entrada");
      await S.avancar(500);
      const m = S.saida("saida")[0] || {};
      a.eq("r2", m.payload, "processo iniciado");
      a.eq("r3", m.topic, "status");
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 4
  {
    id: "switch-template",
    lessonId: "switch-template-function",
    titulo: "Switch + Template: relatório de temperatura",
    tempoMin: 20,
    enunciado:
      'A Entrada (🔒) envia um objeto como { nome: "Ana", temperatura: 31 }.\n\nUse um Switch para separar temperaturas altas (30 ou mais) das normais e um Template (Mustache) para montar o texto:\n\n• alta:   ALERTA: Ana registrou 31°C - temperatura alta\n• normal: OK: Ana registrou 22°C - temperatura normal\n\nO texto final deve ir para msg.payload e chegar à Saída (🔒).',
    requisitos: [
      { id: "r1", texto: "Um Switch com pelo menos 2 saídas ligadas separa os casos" },
      { id: "r2", texto: "O fluxo usa um node Template" },
      { id: "r3", texto: "Temperatura alta (≥ 30) gera o texto ALERTA: …" },
      { id: "r4", texto: "Temperatura normal (< 30) gera o texto OK: …" },
    ],
    dicas: ["No Template: ALERTA: {{payload.nome}} registrou {{payload.temperatura}}°C - temperatura alta", "Duas saídas do Switch → dois Templates (ou Change + Template)."],
    paleta: ["switch", "template", "change", "function", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: '{"nome":"Ana","temperatura":31}', vt: "json" }]), saida()],
    async avaliar(h, a) {
      a.ok("r1", h.tipo("switch").some((n) => h.saidasLigadas(n) >= 2), "Use um Switch e ligue pelo menos duas saídas dele.");
      a.ok("r2", h.tem("template"), "Adicione um node Template.");
      const R = h.r;
      const caso = async (nome, t) => {
        const S = await h.sessao();
        await S.disparar("entrada", { payload: { nome, temperatura: t } });
        await S.avancar(500);
        const out = S.saida("saida");
        S.fim();
        return out;
      };
      let ok3 = true, ok4 = true;
      for (const t of [30, R.int(31, 50)]) {
        const nome = R.pick(NOMES);
        const out = await caso(nome, t);
        const esp = `ALERTA: ${nome} registrou ${t}°C - temperatura alta`;
        if (!(out.length === 1 && out[0] === esp)) {
          a.eq("r3", out[0], esp, { nome, temperatura: t });
          ok3 = false;
          break;
        }
      }
      if (ok3) a.ok("r3", true);
      for (const t of [29, R.int(5, 28)]) {
        const nome = R.pick(NOMES);
        const out = await caso(nome, t);
        const esp = `OK: ${nome} registrou ${t}°C - temperatura normal`;
        if (!(out.length === 1 && out[0] === esp)) {
          a.eq("r4", out[0], esp, { nome, temperatura: t });
          ok4 = false;
          break;
        }
      }
      if (ok4) a.ok("r4", true);
    },
  },

  // ------------------------------------------------------------------ 5
  {
    id: "json-idade",
    lessonId: "transformando-json-function",
    titulo: "Transformando JSON com Function",
    tempoMin: 20,
    enunciado:
      'A Entrada (🔒) envia { nome: "Carlos", idade: 20 }.\n\nA Saída (🔒) deve receber um texto:\n• idade 18 ou mais → "Carlos é maior de idade"\n• idade menor que 18 → "Carlos é menor de idade"\n\nUse Switch e/ou Function como preferir.',
    requisitos: [
      { id: "r1", texto: 'Maior de idade (idade ≥ 18): "<nome> é maior de idade"' },
      { id: "r2", texto: 'Menor de idade (idade < 18): "<nome> é menor de idade"' },
      { id: "r3", texto: "Cada entrada gera exatamente uma mensagem na saída" },
    ],
    dicas: ["const nome = msg.payload.nome; const idade = Number(msg.payload.idade);"],
    paleta: ["function", "switch", "change", "template", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: '{"nome":"Carlos","idade":20}', vt: "json" }]), saida()],
    async avaliar(h, a) {
      const R = h.r;
      let unica = true;
      const rodar = async (id, casos, texto) => {
        for (const [nome, idade] of casos) {
          const S = await h.sessao();
          await S.disparar("entrada", { payload: { nome, idade } });
          await S.avancar(500);
          const out = S.saida("saida");
          S.fim();
          if (out.length !== 1) unica = false;
          const esp = `${nome} ${texto}`;
          if (out[0] !== esp) return a.eq(id, out[0], esp, { nome, idade });
        }
        a.ok(id, true);
      };
      await rodar("r1", [[R.pick(NOMES), 18], [R.pick(NOMES), R.int(19, 70)]], "é maior de idade");
      await rodar("r2", [[R.pick(NOMES), 17], [R.pick(NOMES), R.int(1, 16)]], "é menor de idade");
      a.ok("r3", unica, "Alguma entrada gerou zero ou mais de uma mensagem na saída.");
    },
  },

  // ------------------------------------------------------------------ 6
  {
    id: "validacao-temperatura",
    lessonId: "validacao-preparacao-dados",
    titulo: "Validando dados antes de enviar",
    tempoMin: 20,
    enunciado:
      'A Entrada (🔒) envia { temperatura: "25" } (a temperatura chega como TEXTO).\n\n• Se for um número válido: envie para a Saída { temperatura: 25, valido: true } (temperatura já como número).\n• Se não for um número (ex.: "abc"): NADA deve chegar à Saída e o erro deve ser registrado (node.error).',
    requisitos: [
      { id: "r1", texto: "Temperatura válida chega como { temperatura: <número>, valido: true }" },
      { id: "r2", texto: "Temperatura inválida não chega à Saída" },
      { id: "r3", texto: "Temperatura inválida registra um erro (node.error)" },
    ],
    dicas: ["Number.isNaN(Number(valor))", 'node.error("Temperatura inválida", msg); return null;'],
    paleta: ["function", "switch", "change", "catch", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: '{"temperatura":"25"}', vt: "json" }]), saida()],
    async avaliar(h, a) {
      const R = h.r;
      const validos = [String(R.dec(10, 40)), R.int(1, 50), "0"];
      let okValido = true;
      for (const v of validos) {
        const S = await h.sessao();
        await S.disparar("entrada", { payload: { temperatura: v } });
        await S.avancar(500);
        const out = S.saida("saida");
        S.fim();
        const esp = { temperatura: Number(v), valido: true };
        if (!(out.length === 1 && a.igual(out[0], esp))) {
          a.eq("r1", out[0], esp, { temperatura: v });
          okValido = false;
          break;
        }
      }
      if (okValido) a.ok("r1", true);
      let semSaida = true;
      let comErro = true;
      for (const v of ["abc", "N/A", undefined]) {
        const S = await h.sessao();
        await S.disparar("entrada", { payload: v === undefined ? {} : { temperatura: v } });
        await S.avancar(500);
        if (S.saida("saida").length) semSaida = false;
        if (!S.erros().length) comErro = false;
        S.fim();
      }
      a.ok("r2", semSaida, "Com temperatura inválida (ex.: \"abc\") algo chegou à Saída.");
      a.ok("r3", comErro, "Nenhum erro foi registrado. Use node.error(\"texto\", msg) na Function.");
    },
  },

  // ------------------------------------------------------------------ 7
  {
    id: "http-get-usuarios",
    lessonId: "http-request-get",
    titulo: "Consumindo uma API com HTTP Request",
    tempoMin: 20,
    enunciado:
      "Ao receber a Entrada (🔒), faça uma requisição GET para:\n\nhttps://jsonplaceholder.typicode.com/users\n\nConfigure o retorno como objeto JSON e envie para a Saída (🔒) apenas o e-mail do PRIMEIRO usuário da lista (payload[0].email).\n\n(No simulador a API é fictícia, mas devolve os mesmos dados da aula.)",
    requisitos: [
      { id: "r1", texto: "Faz GET em https://jsonplaceholder.typicode.com/users" },
      { id: "r2", texto: "O HTTP Request retorna um objeto JSON interpretado" },
      { id: "r3", texto: "A Saída recebe o e-mail do primeiro usuário" },
    ],
    dicas: ["Inject → HTTP Request → Change/Function → Debug", "No Change: Definir msg.payload para o valor msg.payload[0].email"],
    paleta: ["http request", "change", "function", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "", vt: "date" }]), saida()],
    async avaliar(h, a) {
      const S = await h.sessao();
      await S.disparar("entrada");
      await S.avancar(3000);
      const reqs = S.http();
      a.ok("r1", reqs.some((r) => r.method === "GET" && /^https:\/\/jsonplaceholder\.typicode\.com\/users\/?$/.test(r.url)), "Nenhuma requisição GET para /users foi feita. Confira o método e a URL.");
      a.ok("r2", h.tipo("http request").some((n) => n.ret === "obj"), 'No HTTP Request, em "Retornar", escolha "um objeto JSON interpretado".');
      const out = S.saida("saida");
      a.eq("r3", out[0], "Sincere@april.biz");
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 8
  {
    id: "http-post",
    lessonId: "enviando-dados-api",
    titulo: "Enviando dados para uma API (POST)",
    tempoMin: 20,
    enunciado:
      'A Entrada (🔒) envia um objeto como { title: "Leitura do sensor", completed: false }.\n\nEnvie esse objeto por POST (JSON) para:\n\nhttps://jsonplaceholder.typicode.com/todos\n\nA API responde 201 com o objeto criado e um id. A Saída (🔒) deve receber o objeto da resposta (retorno como objeto JSON).',
    requisitos: [
      { id: "r1", texto: "Faz POST em https://jsonplaceholder.typicode.com/todos" },
      { id: "r2", texto: "Envia o objeto da Entrada como JSON no corpo da requisição" },
      { id: "r3", texto: "A Saída recebe o objeto criado (com id 101 e o mesmo título)" },
    ],
    dicas: ["HTTP Request: Método POST. O msg.payload (objeto) é enviado como corpo.", "Cabeçalho Content-Type: application/json."],
    paleta: ["http request", "change", "function", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: '{"title":"Leitura do sensor","completed":false}', vt: "json" }]), saida()],
    async avaliar(h, a) {
      const R = h.r;
      const titulo = "Leitura do sensor " + R.int(10, 999);
      const S = await h.sessao();
      await S.disparar("entrada", { payload: { title: titulo, completed: false } });
      await S.avancar(3000);
      const reqs = S.http();
      const post = reqs.find((r) => r.method === "POST");
      a.ok("r1", post && /^https:\/\/jsonplaceholder\.typicode\.com\/todos\/?$/.test(post.url), "Nenhum POST para /todos foi feito. Confira o método e a URL.");
      let corpo = null;
      try {
        corpo = post && post.body ? JSON.parse(post.body) : null;
      } catch (e) {
        corpo = null;
      }
      a.ok("r2", corpo && corpo.title === titulo && /json/i.test(post.headers["content-type"] || ""), "O corpo enviado deve ser JSON com o título recebido (e Content-Type application/json).");
      const out = S.saida("saida")[0];
      a.ok("r3", out && typeof out === "object" && out.id === 101 && out.title === titulo, `A Saída recebeu ${a.mostrar(out)}; esperado o objeto criado com id 101 e title "${titulo}". Use retorno "objeto JSON interpretado".`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 9
  {
    id: "http-erros",
    lessonId: "tratando-respostas-api",
    titulo: "Tratando respostas e erros de API",
    tempoMin: 25,
    enunciado:
      'A Entrada (🔒) traz o endereço em msg.url (deixe a URL do HTTP Request vazia para ele usar msg.url).\n\nDepois da resposta, envie à Saída (🔒):\n• status 2xx → { ok: true, dados: <resposta> }\n• qualquer outro status (404, 500…) → { ok: false, erro: "API indisponível" }\n\nUse retorno "objeto JSON interpretado" e msg.statusCode.',
    requisitos: [
      { id: "r1", texto: "Sucesso (200): { ok: true, dados: <objeto da API> }" },
      { id: "r2", texto: 'Erro 500: { ok: false, erro: "API indisponível" }' },
      { id: "r3", texto: 'Não encontrado (404): { ok: false, erro: "API indisponível" }' },
      { id: "r4", texto: "Cada entrada gera exatamente uma mensagem na saída" },
    ],
    dicas: ["const ok = msg.statusCode >= 200 && msg.statusCode < 300;", "Seu HTTP Request deve aceitar o msg.url: deixe o campo URL em branco."],
    paleta: ["http request", "function", "switch", "change", "catch", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "", vt: "date" }, { p: "url", v: URL_API + "/todos/1", vt: "str" }]), saida()],
    async avaliar(h, a) {
      let unica = true;
      const caso = async (id, url, esperado) => {
        const S = await h.sessao();
        await S.disparar("entrada", { url });
        await S.avancar(3000);
        const out = S.saida("saida");
        S.fim();
        if (out.length !== 1) unica = false;
        a.eq(id, out[0], esperado, { url: url.replace(URL_API, "") });
      };
      const n = h.r.int(1, 5);
      const todo = { userId: 1, id: n, title: null, completed: null };
      const real = require("../../public/js/nr/engine.js").defaultHttpMock({ method: "GET", url: `${URL_API}/todos/${n}`, headers: {} });
      void todo;
      await caso("r1", `${URL_API}/todos/${n}`, { ok: true, dados: JSON.parse(real.body) });
      await caso("r2", `${URL_API}/falha`, { ok: false, erro: "API indisponível" });
      await caso("r3", `${URL_API}/todos/${h.r.int(900, 9999)}`, { ok: false, erro: "API indisponível" });
      a.ok("r4", unica, "Alguma entrada gerou zero ou mais de uma mensagem na saída.");
    },
  },

  // ------------------------------------------------------------------ 10
  {
    id: "agendamento-5s",
    lessonId: "inject-agendamentos-cron",
    titulo: "Agendamento com Inject",
    tempoMin: 15,
    enunciado:
      "Configure um fluxo que dispare sozinho, a cada 5 segundos, uma mensagem para um Debug (sem precisar clicar).\n\nO juiz avança o relógio simulado em 31 segundos e conta quantas mensagens chegaram.",
    requisitos: [
      { id: "r1", texto: "Existe um Inject configurado para repetir a cada 5 segundos" },
      { id: "r2", texto: "Esse Inject está ligado a um Debug" },
      { id: "r3", texto: "Em 31 segundos o Debug recebe 6 ou 7 mensagens" },
    ],
    dicas: ["No Inject: Repetir → repetir a cada intervalo → 5 segundos."],
    paleta: ["inject", "debug", "change", "delay", "comment"],
    fluxoInicial: [],
    async avaliar(h, a) {
      a.ok("r1", h.tipo("inject").some((n) => Number(n.repeat) === 5), "Configure o Inject para repetir a cada 5 segundos.");
      a.ok("r2", h.tipo("inject").some((n) => Number(n.repeat) === 5 && h.tipo("debug").some((d) => h.caminho(n.id, d.id))), "Ligue o Inject (repetição de 5 s) a um Debug.");
      const S = await h.sessao();
      await S.avancar(31000);
      const n = S.saida().length;
      a.ok("r3", n === 6 || n === 7, `Em 31 s o Debug recebeu ${n} mensagem(ns); esperado 6 ou 7.`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 11
  {
    id: "trigger-alarme",
    lessonId: "delay-trigger",
    titulo: "Alarme com Trigger",
    tempoMin: 25,
    enunciado:
      'A Entrada (🔒) envia o texto "Porta aberta".\n\nA Saída (🔒) deve receber:\n1) imediatamente: "Porta aberta";\n2) se nenhuma nova mensagem chegar em 30 segundos: "Alarme: porta deixada aberta".\n\nSe chegar outra mensagem antes de 30 s, a contagem recomeça (estenda o tempo).',
    requisitos: [
      { id: "r1", texto: 'A mensagem "Porta aberta" sai imediatamente' },
      { id: "r2", texto: 'Após 30 s sem novas mensagens sai "Alarme: porta deixada aberta"' },
      { id: "r3", texto: "O alarme não dispara antes de 30 s" },
      { id: "r4", texto: "Uma nova mensagem antes de 30 s reinicia a contagem (estender)" },
    ],
    dicas: ["Trigger: enviar o payload original; esperar 30 s; então enviar texto. Marque 'estender o tempo'."],
    paleta: ["trigger", "delay", "change", "function", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "Porta aberta", vt: "str" }]), saida()],
    async avaliar(h, a) {
      const ALARME = "Alarme: porta deixada aberta";
      let S = await h.sessao();
      await S.disparar("entrada");
      await S.avancar(10);
      a.eq("r1", S.saida("saida"), ["Porta aberta"]);
      await S.avancar(29000);
      const antes = S.saida("saida").slice();
      a.eq("r3", antes, ["Porta aberta"]);
      await S.avancar(2000);
      a.eq("r2", S.saida("saida"), ["Porta aberta", ALARME]);
      S.fim();
      // extensão: msg em t=0 e t=20s; em t=45s ainda não há alarme; em t=51s há.
      S = await h.sessao();
      await S.disparar("entrada");
      await S.avancar(20000);
      await S.disparar("entrada");
      await S.avancar(25000);
      const aos45 = S.saida("saida").slice();
      await S.avancar(6000);
      const aos51 = S.saida("saida").slice();
      const okExt = a.igual(aos45, ["Porta aberta"]) && a.igual(aos51, ["Porta aberta", ALARME]);
      a.ok("r4", okExt, "Com mensagens em 0 s e 20 s, o alarme deveria sair só em 50 s. Marque \"estender o tempo se chegar nova mensagem\" no Trigger.");
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 12
  {
    id: "contexto-maximo",
    lessonId: "context-flow-global",
    titulo: "Memória com Context",
    tempoMin: 20,
    enunciado:
      "A Entrada (🔒) envia números. A cada número recebido, a Saída (🔒) deve mostrar o MAIOR valor já recebido até aquele momento.\n\nExemplo: entradas 10, 25, 7, 30 → saídas 10, 25, 25, 30.\n\nGuarde o máximo em flow ou global context.",
    requisitos: [
      { id: "r1", texto: "O fluxo guarda o estado com flow.set/get ou global.set/get (Function)" },
      { id: "r2", texto: "A saída mostra sempre o maior valor recebido até o momento" },
    ],
    dicas: ["let max = flow.get(\"maximo\"); if (max === undefined || msg.payload > max) max = msg.payload; flow.set(\"maximo\", max);"],
    paleta: ["function", "change", "switch", "debug", "inject", "comment"],
    fluxoInicial: [entrada([{ p: "payload", v: "10", vt: "num" }]), saida()],
    async avaliar(h, a) {
      a.ok("r1", h.tipo("function").some((n) => /\b(flow|global|context)\s*\.\s*(get|set)\b/.test(n.func || "")), "Use flow.get / flow.set (ou global) em um node Function.");
      const seq = Array.from({ length: 6 }, () => h.r.int(1, 90));
      seq[3] = Math.min(seq[3], seq[2] - 1 > 0 ? seq[2] - 1 : 1);
      const esp = [];
      let max = -Infinity;
      for (const v of seq) {
        max = Math.max(max, v);
        esp.push(max);
      }
      const S = await h.sessao();
      for (const v of seq) {
        await S.disparar("entrada", { payload: v });
        await S.avancar(100);
      }
      a.eq("r2", S.saida("saida"), esp, seq);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 13
  {
    id: "dashboard-termico",
    lessonId: "gauge-chart-switch-button",
    titulo: "Dashboard: Slider, Gauge, Chart e Button",
    tempoMin: 30,
    enunciado:
      'Monte um dashboard:\n\n1) Crie a aba "Controle da Fábrica" e o grupo "Painel Térmico" (aba Dashboard → Layout).\n2) Coloque no grupo: um Slider, um Gauge e um Chart.\n3) Ligue o Slider ao Gauge e ao Chart. O Gauge deve cobrir a mesma faixa (mínimo e máximo) do Slider.\n4) Coloque um Button no grupo que envie o texto ligar_ventilador para um Debug.\n\nDepois do Deploy, confira em Dashboard → Painel (/ui).',
    requisitos: [
      { id: "r1", texto: 'Existem a aba "Controle da Fábrica" e o grupo "Painel Térmico" nela' },
      { id: "r2", texto: "Slider, Gauge e Chart estão no grupo Painel Térmico" },
      { id: "r3", texto: "Ao mover o Slider, o Gauge mostra o mesmo valor" },
      { id: "r4", texto: "Ao mover o Slider, o Chart registra o valor" },
      { id: "r5", texto: "A faixa (mín./máx.) do Gauge cobre a do Slider" },
      { id: "r6", texto: 'Clicar no Button envia "ligar_ventilador" ao Debug' },
    ],
    dicas: ["Para criar a aba e o grupo, use a aba Dashboard → Layout da barra lateral.", "Button: Payload = texto ligar_ventilador."],
    paleta: ["ui_slider", "ui_gauge", "ui_chart", "ui_button", "ui_switch", "ui_text", "debug", "change", "comment"],
    fluxoInicial: [],
    async avaliar(h, a) {
      const norm = (s) => String(s || "").trim().toLowerCase();
      const tab = h.tipo("ui_tab").find((t) => norm(t.name) === "controle da fábrica");
      const grp = tab && h.tipo("ui_group").find((g) => g.tab === tab.id && norm(g.name) === "painel térmico");
      a.ok("r1", !!grp, 'Crie a aba "Controle da Fábrica" com o grupo "Painel Térmico".');
      if (!grp) return;
      const slider = h.tipo("ui_slider").find((n) => n.group === grp.id);
      const gauge = h.tipo("ui_gauge").find((n) => n.group === grp.id);
      const chart = h.tipo("ui_chart").find((n) => n.group === grp.id);
      a.ok("r2", slider && gauge && chart, "Falta um Slider, um Gauge ou um Chart escolhendo o grupo Painel Térmico.");
      if (slider && gauge && chart) {
        const min = Number(slider.min), max = Number(slider.max);
        a.ok("r5", Number(gauge.min) <= min && Number(gauge.max) >= max, `O Slider vai de ${min} a ${max}; o Gauge precisa cobrir essa faixa (atual: ${gauge.min} a ${gauge.max}).`);
        if (max > min) {
          const v = h.r.int(min + 1, max);
          const S = await h.sessao();
          await S.ui(slider.id, v);
          await S.avancar(100);
          const g = S.ui_estado(gauge.id);
          const c = S.ui_estado(chart.id);
          const serie = c ? Object.values(c.series).flat() : [];
          a.ok("r3", g && g.value === v, `Slider em ${v}, mas o Gauge mostra ${g ? g.value : "—"}. Ligue o Slider ao Gauge.`);
          a.ok("r4", serie.length > 0 && serie[serie.length - 1].y === v, "O Chart não recebeu o valor do Slider. Ligue o Slider ao Chart.");
          S.fim();
        } else a.falha("r3", "O Slider precisa ter máximo maior que o mínimo.");
      }
      const botao = h.tipo("ui_button").find((n) => n.group === grp.id);
      if (!botao) a.falha("r6", "Adicione um Button no grupo Painel Térmico.");
      else {
        const S = await h.sessao();
        await S.ui(botao.id);
        await S.avancar(100);
        const out = S.saida();
        a.ok("r6", out.includes("ligar_ventilador"), `O Debug recebeu ${a.mostrar(out)}; esperado "ligar_ventilador". Configure o payload do Button e ligue-o a um Debug.`);
        S.fim();
      }
    },
  },

  // ------------------------------------------------------------------ 14
  {
    id: "mqtt-sensor-gauge",
    lessonId: "mqtt-in-json-function",
    titulo: "Recebendo um sensor via MQTT",
    tempoMin: 25,
    enunciado:
      'Um ESP32 publica no broker test.mosquitto.org, tópico estufa/sensorDHT, mensagens de texto como:\n\n{"temperatura": 31.5, "umidade": 60}\n\nReceba a mensagem com MQTT In, converta o JSON, extraia a temperatura e mostre-a em um Gauge do dashboard (crie uma aba e um grupo).\n\nUse a aba MQTT da barra lateral para simular o sensor.',
    requisitos: [
      { id: "r1", texto: "MQTT In assina estufa/sensorDHT em test.mosquitto.org:1883" },
      { id: "r2", texto: "O Gauge mostra a temperatura recebida" },
      { id: "r3", texto: "Uma nova leitura atualiza o Gauge" },
    ],
    dicas: ["MQTT In → JSON → Function (msg.payload = msg.payload.temperatura) → Gauge", "Ou configure a saída do MQTT In como 'objeto JSON'."],
    paleta: ["mqtt in", "json", "function", "change", "ui_gauge", "ui_text", "ui_chart", "debug", "comment"],
    fluxoInicial: [],
    async avaliar(h, a) {
      const brokers = h.tipo("mqtt-broker");
      const ok1 = h.tipo("mqtt in").some((n) => n.topic === "estufa/sensorDHT" && brokers.some((b) => b.id === n.broker && String(b.broker).trim() === "test.mosquitto.org" && String(b.port || 1883) === "1883"));
      a.ok("r1", ok1, "Configure o MQTT In com o broker test.mosquitto.org (porta 1883) e o tópico estufa/sensorDHT.");
      const gauge = h.tipo("ui_gauge")[0];
      if (!gauge) return a.falha("r2", "Adicione um Gauge (e escolha um grupo do dashboard).");
      const S = await h.sessao();
      const t1 = h.r.dec(20, 34);
      await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t1, umidade: h.r.int(40, 80) }));
      await S.avancar(200);
      const g1 = S.ui_estado(gauge.id);
      a.ok("r2", g1 && g1.value === t1, `Publicada temperatura ${t1}, mas o Gauge mostra ${g1 ? g1.value : "—"}. Confira o grupo do Gauge e o caminho até ele.`);
      const t2 = h.r.dec(36, 45);
      await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t2, umidade: 55 }));
      await S.avancar(200);
      const g2 = S.ui_estado(gauge.id);
      a.ok("r3", g2 && g2.value === t2, `Nova leitura ${t2}, Gauge em ${g2 ? g2.value : "—"}.`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 15
  {
    id: "mqtt-ventilador",
    lessonId: "mqtt-out-atuacao",
    titulo: "Controlando o ventilador com MQTT Out",
    tempoMin: 25,
    enunciado:
      'O MQTT In (🔒) já recebe o sensor (estufa/sensorDHT) como objeto JSON, ex.: { temperatura: 36, umidade: 50 }.\n\nQuando a temperatura for MAIOR QUE 35, publique o texto ligar_ventilador no tópico estufa/ventilador/comando usando um MQTT Out. Com 35 ou menos, não publique nada.',
    requisitos: [
      { id: "r1", texto: "O fluxo usa um node MQTT Out" },
      { id: "r2", texto: 'Temperatura > 35 publica "ligar_ventilador"' },
      { id: "r3", texto: "O comando é publicado no tópico estufa/ventilador/comando" },
      { id: "r4", texto: "Temperatura ≤ 35 (inclusive exatamente 35) não publica nada" },
    ],
    dicas: ["MQTT In → Switch (payload.temperatura > 35) → Change (payload = ligar_ventilador) → MQTT Out", "O MQTT Out precisa usar o mesmo broker (selecione-o na lista)."],
    paleta: ["switch", "function", "change", "mqtt out", "debug", "comment"],
    fluxoInicial: [broker(), { id: "entrada", type: "mqtt in", name: "Sensor", topic: "estufa/sensorDHT", qos: "0", datatype: "json", broker: "broker", x: 160, y: 160, wires: [[]], locked: true, role: "entrada" }],
    async avaliar(h, a) {
      a.ok("r1", h.tem("mqtt out"), "Adicione um node MQTT Out.");
      const R = h.r;
      const S = await h.sessao();
      const baixas = [R.int(18, 34), 35, R.int(10, 30)];
      for (const t of baixas) {
        await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t, umidade: 50 }));
        await S.avancar(200);
      }
      a.ok("r4", S.mqttSaida().length === 0, `Com temperaturas ${baixas.join(", ")} (≤ 35) o fluxo publicou ${a.mostrar(S.mqttSaida())}; não deveria publicar nada.`);
      const altas = [36, R.int(37, 48)];
      for (const t of altas) {
        await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t, umidade: 50 }));
        await S.avancar(200);
      }
      const pubs = S.mqttSaida();
      a.ok("r2", pubs.length === 2 && pubs.every((p) => p.payload === "ligar_ventilador"), `Com ${altas.join(" e ")} esperava 2 publicações "ligar_ventilador"; recebi ${a.mostrar(pubs.map((p) => p.payload))}.`);
      a.ok("r3", pubs.length > 0 && pubs.every((p) => p.topico === "estufa/ventilador/comando"), `Tópico publicado: ${a.mostrar(pubs.map((p) => p.topico))}; esperado estufa/ventilador/comando.`);
      S.fim();
    },
  },

  // ------------------------------------------------------------------ 16
  {
    id: "projeto-final-estufa",
    lessonId: "projeto-final-estufa",
    titulo: "Projeto final: estufa automatizada",
    tempoMin: 40,
    enunciado:
      'Construa a estufa completa (o broker 🔒 test.mosquitto.org já está configurado):\n\n1) Receba o sensor em estufa/sensorDHT (texto JSON: {"temperatura": 31.5, "umidade": 60}).\n2) Mostre a temperatura em um Gauge do dashboard.\n3) Temperatura > 35 → publique ligar_ventilador em estufa/ventilador/comando.\n4) Temperatura ≤ 35 → publique desligar_ventilador no mesmo tópico.\n5) Se chegar uma mensagem que NÃO é JSON (ex.: "sensor falhou"), ela não pode gerar comando nem derrubar o fluxo: a próxima leitura válida deve funcionar normalmente.',
    requisitos: [
      { id: "r1", texto: "MQTT In assina estufa/sensorDHT" },
      { id: "r2", texto: "O Gauge mostra a temperatura recebida" },
      { id: "r3", texto: "Temperatura > 35 publica ligar_ventilador em estufa/ventilador/comando" },
      { id: "r4", texto: "Temperatura ≤ 35 publica desligar_ventilador em estufa/ventilador/comando" },
      { id: "r5", texto: "Mensagem inválida não gera comando e o fluxo continua funcionando" },
    ],
    dicas: ["MQTT In → JSON → Function → Gauge e → Switch → (Change) → MQTT Out", "Cada leitura deve gerar exatamente um comando."],
    paleta: ["mqtt in", "mqtt out", "json", "function", "change", "switch", "catch", "ui_gauge", "ui_chart", "ui_text", "debug", "comment"],
    fluxoInicial: [broker()],
    async avaliar(h, a) {
      a.ok("r1", h.tipo("mqtt in").some((n) => n.topic === "estufa/sensorDHT" && h.tipo("mqtt-broker").some((b) => b.id === n.broker)), "Configure um MQTT In no tópico estufa/sensorDHT usando o broker.");
      const R = h.r;
      const T = "estufa/ventilador/comando";
      const gauge = h.tipo("ui_gauge")[0];
      let S = await h.sessao();
      const t = R.dec(20, 34);
      await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t, umidade: 50 }));
      await S.avancar(200);
      const g = gauge && S.ui_estado(gauge.id);
      a.ok("r2", !!g && g.value === t, gauge ? `Publicada ${t}; Gauge mostra ${g ? g.value : "—"}.` : "Adicione um Gauge (com grupo).");
      const pubBaixa = S.mqttSaida();
      a.ok("r4", pubBaixa.length === 1 && pubBaixa[0].topico === T && pubBaixa[0].payload === "desligar_ventilador", `Com ${t}°C esperava 1 publicação "desligar_ventilador" em ${T}; recebi ${a.mostrar(pubBaixa)}.`);
      S.fim();
      S = await h.sessao();
      const alta = R.dec(36, 45);
      await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: alta, umidade: 50 }));
      await S.avancar(200);
      const pubAlta = S.mqttSaida();
      a.ok("r3", pubAlta.length === 1 && pubAlta[0].topico === T && pubAlta[0].payload === "ligar_ventilador", `Com ${alta}°C esperava 1 publicação "ligar_ventilador" em ${T}; recebi ${a.mostrar(pubAlta)}.`);
      S.fim();
      S = await h.sessao();
      await S.publicar("estufa/sensorDHT", "sensor falhou");
      await S.avancar(200);
      const semComando = S.mqttSaida().length === 0;
      const t2 = R.dec(36, 45);
      await S.publicar("estufa/sensorDHT", JSON.stringify({ temperatura: t2, umidade: 50 }));
      await S.avancar(200);
      const depois = S.mqttSaida();
      a.ok("r5", semComando && depois.length === 1 && depois[0].payload === "ligar_ventilador", semComando ? `Depois da mensagem inválida, uma leitura ${t2}°C deveria gerar 1 comando; recebi ${a.mostrar(depois)}.` : "A mensagem inválida gerou um comando; ela deveria ser ignorada.");
      S.fim();
    },
  },
];

const porId = new Map(desafios.map((d) => [d.id, d]));
const porAula = new Map(desafios.map((d) => [d.lessonId, d]));

// Versão pública (sem a função de teste)
function publico(d) {
  return {
    id: d.id,
    lessonId: d.lessonId,
    titulo: d.titulo,
    enunciado: d.enunciado,
    requisitos: d.requisitos.map((r) => ({ id: r.id, texto: r.texto })),
    dicas: d.dicas || [],
    tempoMin: d.tempoMin,
    paleta: d.paleta || null,
  };
}

module.exports = { desafios, porId, porAula, publico };
