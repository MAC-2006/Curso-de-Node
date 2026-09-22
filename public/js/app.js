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
  admin: {
    abaAtual: "alunos", // alunos | videos
    dados: null,
    videos: null,
    carregando: false,
  },
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
    await irParaDashboard();
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
  state.rotaAtual = "aula";
  state.aulaAtualId = lessonId;
  state.carregandoAula = true;
  render();
  const dados = await api(`/api/curriculo/aula/${encodeURIComponent(lessonId)}`);
  state.aulaAtual = dados;
  state.carregandoAula = false;
  render();
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
      "nav",
      { class: "sidebar-nav" },
      state.curriculo.map((modulo) => {
        const infoModulo = porModuloMap.get(modulo.id);
        const pctModulo = infoModulo ? infoModulo.percentual : 0;
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
                class: `nav-item ${ativa ? "active" : ""} ${feita ? "done" : ""}`,
                onclick: () => abrirAula(aula.id),
              },
              el("span", { class: "check" }, feita ? "✓" : ""),
              el("span", {}, aula.title)
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
        state.curriculo.map((modulo) =>
          el(
            "div",
            { class: "module-card" },
            el("h3", {}, modulo.title),
            el("p", {}, `${modulo.lessons.length} aula(s)`),
            el(
              "button",
              {
                class: "btn btn-secondary",
                style: "width:auto;margin-top:10px;padding:8px 14px;font-size:13px;",
                onclick: () => abrirAula(modulo.lessons[0].id),
              },
              "Começar"
            )
          )
        )
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

  const quizState = { respondido: false, selecionado: null, correta: null, correctIndex: null };

  const conteudo = el(
    "main",
    { class: "main" },
    el(
      "div",
      { class: "card" },
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
      el(
        "div",
        { class: "lesson-actions" },
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
          : null
      )
    )
  );

  return conteudo;
}

function renderQuiz(aula) {
  const box = el(
    "div",
    { class: "quiz-box" },
    el("div", { class: "eyebrow" }, "Fixação"),
    el("p", { style: "font-weight:600;margin-bottom:12px;" }, aula.quiz.question)
  );

  const feedbackEl = el("div", {});
  box.appendChild(feedbackEl);

  aula.quiz.options.forEach((opcao, indice) => {
    const botao = el(
      "button",
      {
        type: "button",
        class: "quiz-option",
        onclick: async () => {
          try {
            const resultado = await api(`/api/progresso/${encodeURIComponent(aula.id)}/quiz`, {
              method: "POST",
              body: { optionIndex: indice },
            });

            const todosBotoes = box.querySelectorAll(".quiz-option");
            todosBotoes.forEach((b) => (b.disabled = true));

            botao.classList.add(resultado.correto ? "correct" : "wrong");
            if (!resultado.correto) {
              todosBotoes[resultado.correctIndex]?.classList.add("correct");
            }

            feedbackEl.className = `quiz-feedback ${resultado.correto ? "correct" : "wrong"}`;
            feedbackEl.textContent = resultado.correto
              ? "Certinho! Resposta correta."
              : "Não foi dessa vez — a alternativa correta está destacada.";

            await atualizarProgresso();
          } catch (e) {
            feedbackEl.className = "quiz-feedback wrong";
            feedbackEl.textContent = e.message;
          }
        },
      },
      opcao
    );
    box.appendChild(botao);
  });

  return box;
}

async function atualizarProgresso() {
  const progresso = await api("/api/progresso");
  state.progresso = progresso;
}

function renderVideo(video) {
  if (video.videoUrl) {
    return el(
      "div",
      { class: "video-block" },
      el("video", { src: video.videoUrl, controls: "true" })
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
                el("td", {}, formatarData(aluno.ultimaAtividade)),
                el("td", {}, formatarData(aluno.criadoEm))
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

  app.className = "app-shell";
  app.appendChild(sidebar());
  // Administradores só enxergam o painel de administração, nunca o curso.
  if (state.usuario.isAdmin) {
    app.appendChild(telaAdmin());
  } else if (state.rotaAtual === "aula") {
    app.appendChild(telaAula());
  } else {
    app.appendChild(telaDashboard());
  }
}

iniciar();
