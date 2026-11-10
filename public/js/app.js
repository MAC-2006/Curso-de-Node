// public/js/app.js
// Front-end simples (sem framework/build step) que consome a API do
// servidor Express. Autenticação é feita via cookie httpOnly, então o
// próprio navegador envia o cookie em cada requisição automaticamente.

const app = document.getElementById("app");

const state = {
  usuario: null,
  curriculo: null,
  progresso: null,
  rotaAtual: "carregando", // carregando | login | registro | dashboard | aula | admin
  aulaAtualId: null,
  carregandoAula: false,
  videosAssistidos: new Set(),
  admin: {
    abaAtual: "alunos", // alunos | videos
    dados: null,
    videos: null,
    carregando: false,
  },
  quizTentativas: new Set(),
};

async function api(caminho, options = {}) {
  const resposta = await fetch(caminho, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {
    dados = null;
  }

  if (!resposta.ok) {
    if (resposta.status === 401 && state.rotaAtual !== "login" && state.rotaAtual !== "registro") {
      state.usuario = null;
      state.rotaAtual = "login";
      render();
    }
    const mensagem = (dados && dados.erro) || "Ocorreu um erro. Tente novamente.";
    throw new Error(mensagem);
  }
  return dados;
}

// Envio de arquivos (multipart/form-data) — usado no upload de vídeos.
// Não define Content-Type manualmente: o navegador precisa gerar o
// boundary do multipart sozinho.
async function apiUpload(caminho, formData) {
  const resposta = await fetch(caminho, { method: "POST", body: formData });

  let dados = null;
  try {
    dados = await resposta.json();
  } catch (e) {
    dados = null;
  }

  if (!resposta.ok) {
    const mensagem = (dados && dados.erro) || "Ocorreu um erro ao enviar o vídeo.";
    throw new Error(mensagem);
  }
  return dados;
}

function el(tag, attrs = {}, ...filhos) {
  const node = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs)) {
    if (chave === "class") node.className = valor;
    else if (chave.startsWith("on") && typeof valor === "function") {
      node.addEventListener(chave.slice(2).toLowerCase(), valor);
    } else if (chave === "html") {
      node.innerHTML = valor;
    } else if (valor !== false && valor !== null && valor !== undefined) {
      node.setAttribute(chave, valor);
    }
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    node.appendChild(typeof filho === "string" ? document.createTextNode(filho) : filho);
  }
  return node;
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

// ---------- inicialização ----------

async function iniciar() {
  try {
    const dados = await api("/api/auth/me");
    state.usuario = dados.usuario;
    await entrarNaArea();
  } catch (e) {
    state.rotaAtual = "login";
    render();
  }
}

// Administradores só têm acesso ao painel de administração — nunca veem
// o curso em si, então vão direto para lá em vez do dashboard de aluno.
async function entrarNaArea() {
  if (state.usuario.isAdmin) {
    await irParaAdmin();
  } else {
    carregarVideosAssistidos();
    await irParaDashboard();
  }
}

function chaveVideosAssistidos() {
  return `curso-node-red-videos-${state.usuario?.id || "anonimo"}`;
}

function carregarVideosAssistidos() {
  try {
    const dados = JSON.parse(localStorage.getItem(chaveVideosAssistidos()) || "[]");
    state.videosAssistidos = new Set(Array.isArray(dados) ? dados : []);
  } catch (err) {
    state.videosAssistidos = new Set();
  }
}

function marcarVideoAssistido(lessonId) {
  state.videosAssistidos.add(lessonId);
  localStorage.setItem(chaveVideosAssistidos(), JSON.stringify([...state.videosAssistidos]));

  if (state.aulaAtual?.aula?.id !== lessonId) return;
  const aulaAtual = state.aulaAtual.aula;
  const proximoBotao = document.querySelector(".lesson-next-btn");
  if (proximoBotao) {
    proximoBotao.disabled = !aulaPodeAvancar(aulaAtual);
    proximoBotao.title = "";
  }
  if (aulaPodeAvancar(state.aulaAtual.aula)) {
    document.querySelectorAll(".module-lock-message").forEach((elemento) => elemento.remove());
  }
}

async function carregarDadosLogados() {
  const [curriculo, progresso] = await Promise.all([
    api("/api/curriculo"),
    api("/api/progresso"),
  ]);
  state.curriculo = curriculo.modulos;
  state.progresso = progresso;
}

async function irParaDashboard() {
  state.rotaAtual = "carregando";
  render();
  await carregarDadosLogados();
  state.rotaAtual = "dashboard";
  state.aulaAtualId = null;
  render();
}

async function abrirAula(lessonId) {
  const moduloIndex = state.curriculo.findIndex((modulo) =>
    modulo.lessons.some((aula) => aula.id === lessonId)
  );
  const moduloDestino = state.curriculo[moduloIndex];
  const aulaDestinoIndex = moduloDestino?.lessons.findIndex((aula) => aula.id === lessonId) ?? -1;

  if (state.rotaAtual === "aula" && state.aulaAtualId) {
    const moduloAtualIndex = state.curriculo.findIndex((modulo) =>
      modulo.lessons.some((aula) => aula.id === state.aulaAtualId)
    );
    const moduloAtual = state.curriculo[moduloAtualIndex];
    const aulaAtual = moduloAtual?.lessons.find((aula) => aula.id === state.aulaAtualId);
    const aulaAtualIndex = moduloAtual?.lessons.findIndex((aula) => aula.id === state.aulaAtualId) ?? -1;
    const avancandoNaMesmaEtapa = moduloIndex === moduloAtualIndex && aulaDestinoIndex > aulaAtualIndex;

    if (avancandoNaMesmaEtapa && !aulaPodeAvancar(aulaAtual)) {
      window.alert("Responda corretamente ao quiz desta aula para continuar.");
      return;
    }
  }

  if (moduloIndex > 0 && !moduloPodeSerAcessado(moduloIndex)) {
    window.alert("Responda todos os quizzes dos módulos anteriores para continuar.");
    return;
  }

  state.rotaAtual = "aula";
  state.aulaAtualId = lessonId;
  state.carregandoAula = true;
  render();
  const dados = await api(`/api/curriculo/aula/${encodeURIComponent(lessonId)}`);
  state.aulaAtual = dados;
  state.carregandoAula = false;
  render();
}

function respostaDoQuiz(lessonId) {
  return (state.progresso?.quizRespostas || []).find(
    (resposta) => resposta.lessonId === lessonId
  );
}

function moduloTemQuizzesPendentes(modulo) {
  return modulo.lessons.some((aula) => !aulaPodeAvancar(aula));
}

function moduloPodeSerAcessado(indiceModulo) {
  return state.curriculo.slice(0, indiceModulo).every(
    (modulo) => !moduloTemQuizzesPendentes(modulo)
  );
}

function navegarParaModulo(indiceModulo) {
  if (indiceModulo < 0 || indiceModulo >= state.curriculo.length) return;
  if (!moduloPodeSerAcessado(indiceModulo)) {
    window.alert("Responda todos os quizzes dos módulos anteriores para continuar.");
    return;
  }
  abrirAula(state.curriculo[indiceModulo].lessons[0].id);
}

function desafioDaAula(lessonId) {
  return (state.progresso?.desafios || []).find((d) => d.lessonId === lessonId) || null;
}

function aulaPodeAvancar(aula) {
  const quizOk = !aula.quiz || respostaDoQuiz(aula.id)?.correto === true;
  const videoOk = !aula.video?.videoUrl || state.videosAssistidos.has(aula.id);
  const desafio = desafioDaAula(aula.id);
  const desafioOk = !desafio || desafio.aprovado;
  return quizOk && videoOk && desafioOk;
}

// ---------- desafio prático (simulador em modo prova) e laboratório livre ----------

let nrInstancia = null;

function destruirNr() {
  if (nrInstancia) {
    nrInstancia.destroy();
    nrInstancia = null;
  }
}

function abrirDesafio(desafioId) {
  destruirNr();
  state.rotaAtual = "desafio";
  state.desafioAtualId = desafioId;
  render();
}

function abrirLaboratorio() {
  destruirNr();
  state.rotaAtual = "laboratorio";
  render();
}

function telaNr() {
  const host = el("div", { class: "nr-host" });
  setTimeout(() => {
    if (state.rotaAtual === "desafio") {
      nrInstancia = NRExam.iniciarProva({
        api,
        desafioId: state.desafioAtualId,
        host,
        onSair: async () => {
          destruirNr();
          await atualizarProgresso();
          const aulaId = state.aulaAtualId;
          if (aulaId) await abrirAula(aulaId);
          else await irParaDashboard();
        },
      });
    } else {
      nrInstancia = NRExam.laboratorio({
        host,
        chave: `nr-lab-${state.usuario?.id || "anonimo"}`,
        onSair: async () => {
          destruirNr();
          await irParaDashboard();
        },
      });
    }
  }, 0);
  return host;
}

function cartaoDesafio(aula) {
  const d = desafioDaAula(aula.id);
  if (!d) return null;
  return el(
    "div",
    { class: `challenge-card ${d.aprovado ? "done" : ""}` },
    el("div", { class: "eyebrow" }, d.aprovado ? "Desafio prático · aprovado ✓" : "Desafio prático · obrigatório"),
    el("h3", {}, d.titulo),
    el(
      "p",
      {},
      d.aprovado
        ? "Você foi aprovado neste desafio. Pode refazer o conteúdo no Laboratório livre quando quiser."
        : "Para concluir esta aula, monte o fluxo no simulador de Node-RED. É uma prova de código: tela cheia, sem colar e sem sair da página."
    ),
    el(
      "div",
      { class: "lesson-actions" },
      d.aprovado ? null : el("button", { class: "btn btn-primary", onclick: () => abrirDesafio(d.id) }, "Iniciar desafio"),
      el("button", { class: "btn btn-secondary", onclick: () => abrirLaboratorio() }, "Treinar no Laboratório livre")
    )
  );
}

function embaralharOpcoesQuiz(opcoes) {
  const resultado = opcoes.map((texto, indiceOriginal) => ({ texto, indiceOriginal }));
  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const destino = Math.floor(Math.random() * (indice + 1));
    [resultado[indice], resultado[destino]] = [resultado[destino], resultado[indice]];
  }
  return resultado;
}

function navegarParaAula(lessonId) {
  if (!lessonId) return;
  abrirAula(lessonId);
}

// ---------- área de administração ----------

async function irParaAdmin() {
  state.rotaAtual = "admin";
  render();
  await carregarDadosAdmin();
  render();
}

async function carregarDadosAdmin() {
  state.admin.carregando = true;
  try {
    const [alunos, videos] = await Promise.all([
      api("/api/admin/alunos"),
      api("/api/admin/videos"),
    ]);
    state.admin.dados = alunos;
    state.admin.videos = videos;
  } catch (e) {
    state.admin.erro = e.message;
  } finally {
    state.admin.carregando = false;
  }
}

// ---------- telas de autenticação ----------

function telaAuth(modo, erro) {
  const ehLogin = modo === "login";

  const wrapper = el(
    "div",
    { class: "auth-screen" },
    el(
      "div",
      { class: "auth-card" },
      el(
        "div",
        { class: "auth-brand" },
        el("div", { class: "logo-dot" }, "</>"),
        el("span", {}, "Curso de Node")
      ),
      el("h1", {}, ehLogin ? "Entrar na plataforma" : "Criar sua conta"),
      el(
        "p",
        { class: "subtitle" },
        ehLogin
          ? "Acesse com seu e-mail e senha para continuar o curso."
          : "Leva menos de um minuto para começar."
      ),
      erro ? el("div", { class: "form-error" }, erro) : null,
      el(
        "form",
        {
          onsubmit: async (evento) => {
            evento.preventDefault();
            const formData = new FormData(evento.target);
            const payload = Object.fromEntries(formData.entries());
            try {
              const dados = await api(ehLogin ? "/api/auth/login" : "/api/auth/register", {
                method: "POST",
                body: payload,
              });
              state.usuario = dados.usuario;
              await entrarNaArea();
            } catch (e) {
              state.rotaAtual = modo;
              render(e.message);
            }
          },
        },
        !ehLogin
          ? el(
              "div",
              { class: "field" },
              el("label", { for: "name" }, "Nome completo"),
              el("input", { id: "name", name: "name", type: "text", required: "true", autocomplete: "name" })
            )
          : null,
        el(
          "div",
          { class: "field" },
          el("label", { for: "email" }, "E-mail"),
          el("input", { id: "email", name: "email", type: "email", required: "true", autocomplete: "email" })
        ),
        el(
          "div",
          { class: "field" },
          el("label", { for: "password" }, "Senha"),
          el("input", {
            id: "password",
            name: "password",
            type: "password",
            required: "true",
            minlength: ehLogin ? undefined : "6",
            autocomplete: ehLogin ? "current-password" : "new-password",
          })
        ),
        el("button", { class: "btn btn-primary", type: "submit" }, ehLogin ? "Entrar" : "Criar conta")
      ),
      el(
        "div",
        { class: "auth-switch" },
        ehLogin ? "Ainda não tem conta? " : "Já tem conta? ",
        el(
          "button",
          {
            type: "button",
            onclick: () => {
              state.rotaAtual = ehLogin ? "registro" : "login";
              render();
            },
          },
          ehLogin ? "Cadastre-se" : "Entrar"
        )
      )
    )
  );

  return wrapper;
}

// ---------- área logada: sidebar ----------

function sidebar() {
  // Administradores não têm acesso ao curso, então recebem uma sidebar
  // enxuta com apenas a aba de administração — nada de módulos/aulas.
  if (state.usuario.isAdmin) return sidebarAdmin();
  return sidebarAluno();
}

function sidebarAdmin() {
  return el(
    "aside",
    { class: "sidebar" },
    el(
      "div",
      { class: "sidebar-brand" },
      el("div", { class: "logo-dot" }, "</>"),
      el(
        "div",
        {},
        el("strong", {}, "Curso de Node"),
        el("small", {}, "Painel de administração")
      )
    ),
    el(
      "nav",
      { class: "sidebar-nav" },
      el(
        "button",
        {
          class: "nav-item admin-item active",
          onclick: () => irParaAdmin(),
        },
        el("span", { class: "check" }, "★"),
        el("span", {}, "Administração")
      )
    ),
    el(
      "div",
      { class: "sidebar-footer" },
      el(
        "div",
        {},
        el("div", { class: "user-name" }, state.usuario.name),
        el("div", { class: "user-email" }, state.usuario.email)
      ),
      el(
        "button",
        {
          class: "logout-btn",
          onclick: async () => {
            await api("/api/auth/logout", { method: "POST" });
            state.usuario = null;
            state.rotaAtual = "login";
            render();
          },
        },
        "Sair"
      )
    )
  );
}

function sidebarAluno() {
  const totalAulas = state.curriculo.reduce((soma, m) => soma + m.lessons.length, 0);
  const concluidasSet = new Set(state.progresso.concluidas);
  const pct = state.progresso.percentual;
  const porModuloMap = new Map(
    (state.progresso.porModulo || []).map((m) => [m.moduloId, m])
  );

  return el(
    "aside",
    { class: "sidebar" },
    el(
      "div",
      { class: "sidebar-brand" },
      el("div", { class: "logo-dot" }, "</>"),
      el(
        "div",
        {},
        el("strong", {}, "Curso de Node"),
        el("small", {}, "Plataforma de estudos")
      )
    ),
    el(
      "div",
      { class: "sidebar-progress" },
      el("div", { class: "pct" }, `${concluidasSet.size}/${totalAulas} aulas · ${pct}%`),
      el("div", { class: "bar-track" }, el("div", { class: "bar-fill", style: `width:${pct}%` }))
    ),
    el(
      "div",
      { class: "sidebar-lab" },
      el("button", { class: "nav-item lab-item", onclick: () => abrirLaboratorio() }, el("span", { class: "check" }, "⬡"), el("span", {}, "Laboratório Node-RED"))
    ),
    el(
      "nav",
      { class: "sidebar-nav" },
      state.curriculo.map((modulo, indiceModulo) => {
        const infoModulo = porModuloMap.get(modulo.id);
        const pctModulo = infoModulo ? infoModulo.percentual : 0;
        const bloqueado = indiceModulo > 0 && !moduloPodeSerAcessado(indiceModulo);
        return el(
          "div",
          { class: "sidebar-module" },
          el(
            "div",
            { class: "sidebar-module-header" },
            el(
              "div",
              { class: "sidebar-module-title" },
              el("span", {}, modulo.title),
              el("span", { class: "mod-pct" }, `${pctModulo}%`)
            ),
            el(
              "div",
              { class: "sidebar-module-bar" },
              el("div", {
                class: `fill ${pctModulo === 100 ? "complete" : ""}`,
                style: `width:${pctModulo}%`,
              })
            )
          ),
          modulo.lessons.map((aula) => {
            const ativa = state.rotaAtual === "aula" && state.aulaAtualId === aula.id;
            const feita = concluidasSet.has(aula.id);
            return el(
              "button",
              {
                class: `nav-item ${ativa ? "active" : ""} ${feita ? "done" : ""} ${bloqueado ? "locked" : ""}`,
                disabled: bloqueado,
                onclick: () => abrirAula(aula.id),
              },
              el("span", { class: "check" }, feita ? "✓" : ""),
              el("span", {}, aula.title),
              desafioDaAula(aula.id) ? el("span", { class: "lesson-lab-tag", title: "Tem desafio prático" }, "🧪") : null
            );
          })
        );
      })
    ),
    el(
      "div",
      { class: "sidebar-footer" },
      el(
        "div",
        {},
        el("div", { class: "user-name" }, state.usuario.name),
        el("div", { class: "user-email" }, state.usuario.email)
      ),
      el(
        "button",
        {
          class: "logout-btn",
          onclick: async () => {
            await api("/api/auth/logout", { method: "POST" });
            state.usuario = null;
            state.rotaAtual = "login";
            render();
          },
        },
        "Sair"
      )
    )
  );
}

// ---------- dashboard ----------

function telaDashboard() {
  const totalAulas = state.curriculo.reduce((soma, m) => soma + m.lessons.length, 0);
  const quiz = state.progresso.quiz || { total: 0, acertos: 0, percentual: null };

  return el(
    "main",
    { class: "main" },
    el(
      "div",
      { class: "card" },
      el("div", { class: "eyebrow" }, "Bem-vindo(a)"),
      el("h1", { class: "dashboard-title" }, `Olá, ${state.usuario.name.split(" ")[0]}`),
      el(
        "p",
        { style: "color:var(--muted)" },
        "Escolha uma aula na barra lateral para continuar seus estudos."
      ),
      el(
        "button",
        {
          class: "btn btn-secondary dashboard-certificate-btn",
          disabled: state.progresso.percentual !== 100,
          title: state.progresso.percentual === 100
            ? "Visualizar certificado"
            : "Conclua 100% do curso para liberar o certificado",
          onclick: () => {
            if (state.progresso.percentual === 100) {
              state.rotaAtual = "conclusao";
              render();
            }
          },
        },
        state.progresso.percentual === 100
          ? "Visualizar certificado"
          : "Certificado bloqueado (0%–99%)"
      ),
      el(
        "div",
        { class: "stat-grid" },
        el(
          "div",
          { class: "stat-card" },
          el("div", { class: "stat-value" }, `${state.progresso.percentual}%`),
          el("div", { class: "stat-label" }, "Progresso geral do curso")
        ),
        el(
          "div",
          { class: "stat-card" },
          el("div", { class: "stat-value" }, `${state.progresso.concluidas.length}/${totalAulas}`),
          el("div", { class: "stat-label" }, "Aulas concluídas")
        ),
        el(
          "div",
          { class: "stat-card" },
          el(
            "div",
            { class: "stat-value" },
            quiz.percentual === null ? "—" : `${quiz.percentual}%`
          ),
          el("div", { class: "stat-label" }, `Acerto em quizzes (${quiz.acertos}/${quiz.total})`)
        )
      ),
      el(
        "div",
        { class: "module-grid" },
        state.curriculo.map((modulo) => {
          const concluidasNoModulo = modulo.lessons.filter((aula) =>
            state.progresso.concluidas.includes(aula.id)
          ).length;
          const moduloConcluido = concluidasNoModulo === modulo.lessons.length;
          const moduloIniciado = concluidasNoModulo > 0;
          const statusModulo = moduloConcluido
            ? "Concluído"
            : moduloIniciado
              ? "Em andamento"
              : "Não iniciado";

          return el(
            "div",
            { class: `module-card ${moduloConcluido ? "completed" : ""}` },
            el("h3", {}, modulo.title),
            el("p", {}, `${concluidasNoModulo}/${modulo.lessons.length} aula(s) concluída(s)`),
            el("span", { class: `module-status ${moduloConcluido ? "completed" : ""}` }, statusModulo),
            el(
              "button",
              {
                class: "btn btn-secondary",
                style: "width:auto;margin-top:10px;padding:8px 14px;font-size:13px;",
                onclick: () => abrirAula(modulo.lessons[0].id),
              },
              moduloConcluido ? "Revisar módulo" : moduloIniciado ? "Continuar" : "Começar"
            )
          );
        })
      )
    )
  );
}

// ---------- aula + quiz ----------

function telaAula() {
  if (state.carregandoAula || !state.aulaAtual) {
    return el("main", { class: "main" }, el("div", { class: "loading" }, "Carregando aula..."));
  }

  const { aula, moduloTitle } = state.aulaAtual;
  const jaConcluida = state.progresso.concluidas.includes(aula.id);
  const indiceModulo = state.curriculo.findIndex((modulo) => modulo.id === state.aulaAtual.moduloId);
  const moduloAtual = state.curriculo[indiceModulo];
  const indiceAula = moduloAtual.lessons.findIndex((item) => item.id === aula.id);
  const aulaAnterior = indiceAula > 0
    ? moduloAtual.lessons[indiceAula - 1]
    : indiceModulo > 0
      ? state.curriculo[indiceModulo - 1].lessons.at(-1)
      : null;
  const ultimaAulaDoModulo = indiceAula === moduloAtual.lessons.length - 1;
  const proximaAula = !ultimaAulaDoModulo
    ? moduloAtual.lessons[indiceAula + 1]
    : indiceModulo < state.curriculo.length - 1
      ? state.curriculo[indiceModulo + 1].lessons[0]
      : null;
  const vaiParaProximoModulo = ultimaAulaDoModulo && indiceModulo < state.curriculo.length - 1;
  const podeAvancar = Boolean(proximaAula) && aulaPodeAvancar(aula);
  const ultimaAulaDoCurso = !proximaAula;
  const cursoConcluido = state.progresso.percentual === 100;
  const mensagemBloqueio = aula.video?.videoUrl && !state.videosAssistidos.has(aula.id)
    ? "Assista a pelo menos 80% do vídeo para avançar."
    : aula.quiz && respostaDoQuiz(aula.id)?.correto !== true
      ? "Responda corretamente ao quiz para avançar."
      : desafioDaAula(aula.id) && !desafioDaAula(aula.id).aprovado
        ? "Seja aprovado no desafio prático para avançar."
        : "Conclua esta aula para avançar.";

  const quizState = { respondido: false, selecionado: null, correta: null, correctIndex: null };

  const conteudo = el(
    "main",
    { class: "main" },
    el(
      "div",
      { class: "card" },
      el(
        "div",
        { class: "lesson-topbar" },
        el(
          "a",
          {
            class: "lesson-home-link",
            href: "#",
            onclick: (evento) => {
              evento.preventDefault();
              irParaDashboard();
            },
          },
          "← VOLTAR AO INÍCIO"
        )
      ),
      el("div", { class: "eyebrow" }, moduloTitle),
      el("h1", { class: "lesson-title" }, aula.title),
      aula.video ? renderVideo(aula.video) : null,
      el(
        "div",
        { class: "lesson-content" },
        aula.content.map((paragrafo) => el("p", {}, paragrafo))
      ),
      aula.example ? el("pre", { class: "code-block" }, el("code", {}, aula.example)) : null,
      aula.quiz ? renderQuiz(aula) : null,
      cartaoDesafio(aula),
      el(
        "div",
        { class: "lesson-actions lesson-navigation" },
        el(
          "button",
          {
            class: "btn btn-secondary",
            disabled: !aulaAnterior,
            onclick: () => navegarParaAula(aulaAnterior?.id),
          },
          "← Aula anterior"
        ),
        proximaAula
          ? el(
              "button",
              {
                class: "btn btn-primary lesson-next-btn",
                disabled: !podeAvancar,
                title: !podeAvancar ? mensagemBloqueio : "",
                onclick: () => podeAvancar && navegarParaAula(proximaAula.id),
              },
              vaiParaProximoModulo ? "Próximo módulo →" : "Próxima aula →"
            )
          : null,
        proximaAula && !podeAvancar
          ? el("small", { class: "module-lock-message" }, mensagemBloqueio)
          : null,
        !aula.quiz
          ? el(
              "button",
              {
                class: "btn btn-primary",
                onclick: async () => {
                  await api(`/api/progresso/${encodeURIComponent(aula.id)}/concluir`, { method: "POST" });
                  await atualizarProgresso();
                  render();
                },
              },
              jaConcluida ? "Aula concluída ✓" : "Marcar como concluída"
            )
          : null,
        ultimaAulaDoCurso
          ? el(
              "button",
              {
                class: "btn btn-primary finish-course-btn",
                disabled: !cursoConcluido,
                title: cursoConcluido ? "Finalizar curso" : "Complete todas as aulas para liberar",
                onclick: () => {
                  if (cursoConcluido) {
                    state.rotaAtual = "conclusao";
                    render();
                  }
                },
              },
              cursoConcluido ? "Finalizar curso" : "Complete 100% para finalizar"
            )
          : null
      )
    )
  );

  return conteudo;
}

function renderQuiz(aula) {
  const respostaAnterior = respostaDoQuiz(aula.id);
  const modoTentativa = state.quizTentativas.has(aula.id);
  const jaRespondeu = Boolean(respostaAnterior) && !modoTentativa;
  const opcoesEmbaralhadas = embaralharOpcoesQuiz(aula.quiz.options);
  const box = el(
    "div",
    { class: "quiz-box" },
    el("div", { class: "eyebrow" }, "Fixação"),
    el("p", { style: "font-weight:600;margin-bottom:12px;" }, aula.quiz.question)
  );

  const feedbackEl = el("div", {});
  box.appendChild(feedbackEl);

  opcoesEmbaralhadas.forEach(({ texto, indiceOriginal }) => {
    const botao = el(
      "button",
      {
        type: "button",
        class: `quiz-option ${
          jaRespondeu && respostaAnterior.optionIndex === indiceOriginal
            ? respostaAnterior.correto
              ? "correct"
              : "wrong"
            : ""
        }`,
        disabled: jaRespondeu,
        onclick: async () => {
          try {
            const resultado = await api(`/api/progresso/${encodeURIComponent(aula.id)}/quiz`, {
              method: "POST",
              body: { optionIndex: indiceOriginal },
            });

            const todosBotoes = box.querySelectorAll(".quiz-option");
            todosBotoes.forEach((b) => (b.disabled = true));

            botao.classList.add(resultado.correto ? "correct" : "wrong");

            feedbackEl.className = `quiz-feedback ${resultado.correto ? "correct" : "wrong"}`;
            feedbackEl.textContent = resultado.correto
              ? "Certinho! Resposta correta."
              : "Não foi dessa vez. Tente novamente.";

            await atualizarProgresso();
            state.quizTentativas.delete(aula.id);
            render();
          } catch (e) {
            feedbackEl.className = "quiz-feedback wrong";
            feedbackEl.textContent = e.message;
          }
        },
      },
      texto
    );
    box.appendChild(botao);
  });

  if (jaRespondeu) {
    feedbackEl.className = `quiz-feedback ${respostaAnterior.correto ? "correct" : "wrong"}`;
    feedbackEl.textContent = respostaAnterior.optionIndex === null
      ? "Você já respondeu este quiz."
      : respostaAnterior.correto
        ? "Você respondeu: alternativa correta."
        : "Você respondeu: alternativa incorreta. Tente novamente.";

    if (!respostaAnterior.correto) {
      box.appendChild(
        el(
          "button",
          {
            type: "button",
            class: "btn btn-secondary quiz-retry",
            onclick: () => {
              state.quizTentativas.add(aula.id);
              render();
            },
          },
          "Tentar novamente"
        )
      );
    }
  }

  return box;
}

async function atualizarProgresso() {
  const progresso = await api("/api/progresso");
  state.progresso = progresso;
}

function renderVideo(video) {
  if (video.videoUrl) {
    const lessonId = state.aulaAtual.aula.id;
    const player = el("video", { src: video.videoUrl, controls: "true" });
    const atualizarProgressoVideo = () => {
      if (player.duration && player.currentTime / player.duration >= 0.8) {
        marcarVideoAssistido(lessonId);
      }
    };
    player.addEventListener("timeupdate", atualizarProgressoVideo);
    player.addEventListener("ended", () => marcarVideoAssistido(lessonId));
    return el(
      "div",
      { class: "video-block" },
      player
    );
  }
  return el(
    "div",
    { class: "video-block" },
    el(
      "div",
      { class: "video-placeholder" },
      el("div", { class: "video-icon" }, "▶"),
      el("strong", {}, video.titulo || "Vídeo em produção"),
      el(
        "small",
        {},
        video.duracaoSugerida
          ? `Em breve nesta aula · duração prevista: ${video.duracaoSugerida}`
          : "Estamos gravando essa videoaula — em breve disponível aqui."
      )
    )
  );
}

// ---------- painel de administração ----------

function telaAdmin() {
  if (state.admin.carregando || !state.admin.dados) {
    return el("main", { class: "main" }, el("div", { class: "loading" }, "Carregando painel de administração..."));
  }

  return el(
    "main",
    { class: "main" },
    el(
      "div",
      { class: "card" },
      el("div", { class: "eyebrow" }, "Administração"),
      el("h1", { class: "dashboard-title" }, "Painel de alunos"),
      el(
        "p",
        { style: "color:var(--muted)" },
        "Acompanhe o progresso de todos os alunos e o que falta gravar para o curso."
      ),
      el(
        "div",
        { class: "admin-tabs" },
        el(
          "button",
          {
            class: `admin-tab ${state.admin.abaAtual === "alunos" ? "active" : ""}`,
            onclick: () => {
              state.admin.abaAtual = "alunos";
              render();
            },
          },
          "Alunos"
        ),
        el(
          "button",
          {
            class: `admin-tab ${state.admin.abaAtual === "videos" ? "active" : ""}`,
            onclick: () => {
              state.admin.abaAtual = "videos";
              render();
            },
          },
          `Vídeos a gravar (${state.admin.videos ? state.admin.videos.pendentes : 0})`
        )
      ),
      state.admin.abaAtual === "alunos" ? painelAlunos() : painelVideos()
    )
  );
}

function pillPercentual(pct) {
  const classe = pct >= 70 ? "ok" : pct >= 30 ? "mid" : "low";
  return el("span", { class: `pill ${classe}` }, `${pct}%`);
}

function painelAlunos() {
  const { resumo, alunos } = state.admin.dados;

  return el(
    "div",
    {},
    el(
      "div",
      { class: "stat-grid" },
      el(
        "div",
        { class: "stat-card" },
        el("div", { class: "stat-value" }, String(resumo.totalAlunos)),
        el("div", { class: "stat-label" }, "Alunos cadastrados")
      ),
      el(
        "div",
        { class: "stat-card" },
        el("div", { class: "stat-value" }, `${resumo.mediaPercentual}%`),
        el("div", { class: "stat-label" }, "Progresso médio da turma")
      ),
      el(
        "div",
        { class: "stat-card" },
        el("div", { class: "stat-value" }, String(resumo.alunosConcluiram)),
        el("div", { class: "stat-label" }, "Concluíram o curso (100%)")
      ),
      el(
        "div",
        { class: "stat-card" },
        el("div", { class: "stat-value" }, String(resumo.alunosSemAtividade)),
        el("div", { class: "stat-label" }, "Ainda não começaram")
      )
    ),
    alunos.length === 0
      ? el("p", { style: "color:var(--muted);margin-top:16px;" }, "Nenhum aluno cadastrado ainda.")
      : el(
          "div",
          { class: "admin-table-wrap" },
          el(
          "table",
          { class: "admin-table" },
          el(
            "thead",
            {},
            el(
              "tr",
              {},
              el("th", {}, "Aluno"),
              el("th", {}, "E-mail"),
              el("th", {}, "Progresso"),
              el("th", {}, "Aulas"),
              el("th", {}, "Quiz"),
              el("th", {}, "Desafios"),
              el("th", {}, "Alertas"),
              el("th", {}, "Última atividade"),
              el("th", {}, "Cadastro")
            )
          ),
          el(
            "tbody",
            {},
            alunos.map((aluno) =>
              el(
                "tr",
                {},
                el("td", {}, aluno.name),
                el("td", {}, aluno.email),
                el("td", {}, pillPercentual(aluno.percentual)),
                el("td", {}, `${aluno.aulasConcluidas}/${aluno.totalAulas}`),
                el(
                  "td",
                  {},
                  aluno.quizPercentual === null ? "—" : `${aluno.quizPercentual}% (${aluno.quizAcertos}/${aluno.quizTotal})`
                ),
                el("td", {}, `${aluno.desafiosAprovados}/${aluno.totalDesafios}`),
                el(
                  "td",
                  {},
                  aluno.violacoes || aluno.tentativasAnuladas || aluno.tentativasSuspeitas
                    ? el("span", { class: "pill low", title: "Violações registradas / tentativas anuladas / suspeitas de colagem" }, `${aluno.violacoes} viol. · ${aluno.tentativasAnuladas} anul. · ${aluno.tentativasSuspeitas} susp.`)
                    : "—"
                ),
                el("td", {}, formatarData(aluno.ultimaAtividade)),
                el("td", {}, formatarData(aluno.criadoEm))
              )
            )
          )
          )
          )
  );
}

function painelVideos() {
  const dados = state.admin.videos;
  if (!dados || dados.slots.length === 0) {
    return el("p", { style: "color:var(--muted);margin-top:16px;" }, "Nenhum ponto de vídeo cadastrado no currículo.");
  }

  const pendentes = dados.slots.filter((s) => !s.gravado);
  const gravados = dados.slots.filter((s) => s.gravado);

  return el(
    "div",
    { style: "margin-top:16px;" },
    el(
      "p",
      { style: "color:var(--muted);font-size:13px;margin-bottom:16px;" },
      `${dados.gravados} gravado(s) · ${dados.pendentes} pendente(s) de gravação. Faça o upload direto em cada card — assim que o vídeo subir, ele some daqui.`
    ),
    pendentes.length === 0
      ? el("div", { class: "video-empty-ok" }, "Tudo em dia! Nenhum vídeo pendente de gravação.")
      : pendentes.map((slot) => cardVideoPendente(slot)),
    gravados.length > 0
      ? el(
          "div",
          { class: "video-gravados-section" },
          el("h4", {}, `Já gravados (${gravados.length})`),
          gravados.map((slot) => cardVideoGravado(slot))
        )
      : null
  );
}

function cardVideoPendente(slot) {
  const inputId = `upload-${slot.lessonId}`;

  const item = el(
    "div",
    { class: "video-checklist-item" },
    el(
      "div",
      { class: "vc-head" },
      el("h4", {}, slot.tituloVideo),
      el("span", { class: "pill mid" }, "Pendente")
    ),
    el(
      "div",
      { class: "vc-meta" },
      `${slot.moduloTitle} · aula "${slot.lessonTitle}"${
        slot.duracaoSugerida ? ` · duração sugerida: ${slot.duracaoSugerida}` : ""
      }`
    ),
    el(
      "ol",
      {},
      slot.roteiro.map((passo) => el("li", {}, passo))
    ),
    el(
      "button",
      { type: "button", class: "admin-download-btn", onclick: () => baixarRoteiro(slot) },
      "Baixar roteiro"
    ),
    el(
      "div",
      { class: "vc-upload" },
      el("input", {
        type: "file",
        id: inputId,
        accept: "video/*",
        class: "hidden",
        onchange: (evento) => {
          const arquivo = evento.target.files[0];
          if (arquivo) enviarVideo(slot.lessonId, arquivo, item);
        },
      }),
      el("label", { for: inputId, class: "btn btn-secondary upload-btn" }, "⬆ Fazer upload do vídeo"),
      el("span", { class: "upload-status" }, "")
    )
  );

  return item;
}

function cardVideoGravado(slot) {
  const inputId = `upload-${slot.lessonId}`;

  const item = el(
    "div",
    { class: "video-gravado-row" },
    el(
      "div",
      { class: "vg-info" },
      el("span", { class: "pill ok" }, "Gravado"),
      el("strong", {}, slot.tituloVideo),
      el("small", {}, `${slot.moduloTitle} · "${slot.lessonTitle}"`)
    ),
    el(
      "div",
      { class: "vc-upload", style: "border-top:0;margin-top:0;padding-top:0;" },
      el("button", { type: "button", class: "admin-download-btn", onclick: () => baixarRoteiro(slot) }, "Baixar roteiro"),
      slot.videoUrl
        ? el("button", { type: "button", class: "admin-download-btn", onclick: () => baixarVideo(slot) }, "Baixar vídeo")
        : null,
      slot.videoUrl ? el("a", { href: slot.videoUrl, target: "_blank", class: "video-link" }, "Ver vídeo") : null,
      el("input", {
        type: "file",
        id: inputId,
        accept: "video/*",
        class: "hidden",
        onchange: (evento) => {
          const arquivo = evento.target.files[0];
          if (arquivo) enviarVideo(slot.lessonId, arquivo, item);
        },
      }),
      el("label", { for: inputId, class: "upload-replace-link" }, "Substituir"),
      el("span", { class: "upload-status" }, "")
    )
  );

  return item;
}

// Envia o vídeo selecionado; o card mostra o estado de "Enviando..." e,
// ao concluir, os dados do admin são recarregados — o card pendente some
// da lista (ou, se era uma substituição, o link é atualizado).
function baixarVideo(slot) {
  const link = document.createElement("a");
  link.href = slot.videoUrl;
  link.download = `${slot.lessonId}.mp4`;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function baixarRoteiro(slot) {
  const conteudo = [
    slot.tituloVideo,
    `${slot.moduloTitle} · aula "${slot.lessonTitle}"`,
    slot.duracaoSugerida ? `Duração alvo: ${slot.duracaoSugerida}` : "",
    "",
    ...slot.roteiro.map((passo, indice) => `${indice + 1}. ${passo}`),
  ].filter(Boolean).join("\n");
  const arquivo = new Blob([conteudo], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slot.lessonId}-roteiro.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function enviarVideo(lessonId, arquivo, itemEl) {
  const botaoLabel = itemEl.querySelector(".upload-btn, .upload-replace-link");
  const inputArquivo = itemEl.querySelector("input[type=file]");
  const statusEl = itemEl.querySelector(".upload-status");
  const textoOriginal = botaoLabel ? botaoLabel.textContent : "";

  if (botaoLabel) {
    botaoLabel.textContent = "Enviando...";
    botaoLabel.classList.add("disabled");
  }
  if (inputArquivo) inputArquivo.disabled = true;
  if (statusEl) {
    statusEl.textContent = "";
    statusEl.className = "upload-status";
  }

  try {
    const formData = new FormData();
    formData.append("video", arquivo);
    await apiUpload(`/api/admin/videos/${encodeURIComponent(lessonId)}/upload`, formData);
    await carregarDadosAdmin();
    render();
  } catch (e) {
    if (botaoLabel) {
      botaoLabel.textContent = textoOriginal;
      botaoLabel.classList.remove("disabled");
    }
    if (inputArquivo) inputArquivo.disabled = false;
    if (statusEl) {
      statusEl.textContent = e.message;
      statusEl.className = "upload-status error";
    }
  }
}

function formatarData(valor) {
  if (!valor) return "—";
  const data = new Date(valor.replace(" ", "T") + "Z");
  if (Number.isNaN(data.getTime())) return valor;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function escaparSvg(valor) {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function gerarCertificadoSvg() {
  const nome = escaparSvg(state.usuario.name);
  const data = new Date().toLocaleDateString("pt-BR");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
  <rect width="1200" height="850" fill="#f8fbfc"/>
  <rect x="35" y="35" width="1130" height="780" rx="24" fill="#ffffff" stroke="#0d9db1" stroke-width="5"/>
  <rect x="58" y="58" width="1084" height="734" rx="16" fill="none" stroke="#e4b84a" stroke-width="2"/>
  <text x="600" y="170" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" letter-spacing="5" fill="#0d9db1">CERTIFICADO DE CONCLUSÃO</text>
  <text x="600" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#657285">Certificamos que</text>
  <text x="600" y="350" text-anchor="middle" font-family="Georgia, serif" font-size="56" font-weight="bold" fill="#182230">${nome}</text>
  <text x="600" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" fill="#657285">concluiu o curso</text>
  <text x="600" y="500" text-anchor="middle" font-family="Arial, sans-serif" font-size="38" font-weight="bold" fill="#182230">Node-RED: Automação de Processos e IoT</text>
  <line x1="430" y1="650" x2="770" y2="650" stroke="#182230" stroke-width="1"/>
  <text x="600" y="685" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#657285">Curso concluído em ${data}</text>
  <text x="600" y="745" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" fill="#0d9db1">Plataforma de estudos Node-RED</text>
</svg>`;
}

async function baixarCertificado() {
  const resposta = await fetch("/api/progresso/certificado");
  if (!resposta.ok) {
    let dados = null;
    try {
      dados = await resposta.json();
    } catch (err) {
      // Mantém uma mensagem padrão caso a resposta não seja JSON.
    }
    throw new Error(dados?.erro || "Não foi possível gerar o certificado.");
  }

  const arquivo = await resposta.blob();
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");
  link.href = url;
  link.download = "certificado-node-red.pdf";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function telaConclusao() {
  const confetes = Array.from({ length: 70 }, (_, indice) =>
    el("span", {
      class: "confetti-piece",
      style: `--confetti-left:${(indice * 37) % 100}%;--confetti-duration:${4 + (indice % 5) * 0.7}s;--confetti-delay:-${(indice % 12) * 0.45}s;--confetti-color:hsl(${(indice * 47) % 360},75%,55%);--confetti-rotation:${indice * 31}deg;--confetti-drift:${(indice % 7) * 14 - 42}px;`,
    })
  );

  return el(
    "main",
    { class: "main conclusion-page" },
    el("div", { class: "confetti-bg" }, confetes),
    el(
      "div",
      { class: "conclusion-content" },
      el("div", { class: "eyebrow" }, "Curso concluído"),
      el("h1", { class: "dashboard-title" }, "Parabéns, curso concluído!"),
      el("p", { class: "conclusion-message" }, `Excelente trabalho, ${state.usuario.name.split(" ")[0]}! Você completou todas as aulas do curso de Node-RED.`),
      el(
        "div",
        { class: "certificate-preview" },
        el("div", { class: "certificate-ribbon" }, "CERTIFICADO"),
        el("div", { class: "certificate-label" }, "CERTIFICADO DE CONCLUSÃO"),
        el("p", {}, "Certificamos que"),
        el("h2", {}, state.usuario.name),
        el("p", {}, "concluiu o curso"),
        el("strong", {}, "Node-RED: Automação de Processos e IoT"),
        el("small", {}, `Concluído em ${new Date().toLocaleDateString("pt-BR")}`)
      ),
      el(
        "div",
        { class: "conclusion-actions" },
        el("button", { class: "btn btn-primary", onclick: baixarCertificado }, "Baixar certificado"),
        el("button", { class: "btn btn-secondary", onclick: () => irParaDashboard() }, "Voltar ao painel")
      )
    )
  );
}

// ---------- render principal ----------

function render(erroAuth) {
  app.innerHTML = "";

  if (state.rotaAtual === "carregando") {
    app.className = "app-shell";
    app.appendChild(el("div", { class: "loading", style: "margin:auto;" }, "Carregando..."));
    return;
  }

  if (state.rotaAtual === "login" || state.rotaAtual === "registro") {
    app.className = "";
    app.appendChild(telaAuth(state.rotaAtual, erroAuth));
    return;
  }

  if (!state.usuario.isAdmin && (state.rotaAtual === "desafio" || state.rotaAtual === "laboratorio")) {
    app.className = "";
    app.appendChild(telaNr());
    return;
  }

  app.className = "app-shell";
  app.appendChild(sidebar());
  // Administradores só enxergam o painel de administração, nunca o curso.
  if (state.usuario.isAdmin) {
    app.appendChild(telaAdmin());
  } else if (state.rotaAtual === "conclusao") {
    app.appendChild(telaConclusao());
  } else if (state.rotaAtual === "aula") {
    app.appendChild(telaAula());
  } else {
    app.appendChild(telaDashboard());
  }
}

iniciar();
