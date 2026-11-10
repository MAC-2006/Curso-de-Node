/* Modo prova do simulador + Laboratório livre.
 *
 * Modo prova (estilo plataformas de teste de código):
 *  - exige tela cheia;
 *  - bloqueia colar (teclado, menu de contexto, arrastar texto, inserção
 *    suspeita), copiar/recortar e atalhos de inspeção;
 *  - detecta saída da aba/janela/tela cheia e registra no servidor;
 *    3 violações = tentativa anulada;
 *  - relógio e correção são do SERVIDOR (o navegador apenas exibe).
 *
 * Importante: nenhuma proteção em navegador é 100% à prova de burla — por isso a
 * decisão final (prazo, anulação, aprovação) fica no servidor, que também
 * confere sinais (batimentos, telemetria de digitação). */
(function () {
  "use strict";
  const { h } = NRKit;

  const MOTIVOS = {
    saiu_da_aba: "Você saiu da aba da prova.",
    perdeu_foco: "A janela da prova perdeu o foco.",
    saiu_tela_cheia: "Você saiu da tela cheia.",
    tentou_colar: "Colar não é permitido durante a prova.",
    texto_inserido_suspeito: "Foi detectada a inserção de um trecho grande de texto de uma só vez.",
    sem_sinal: "A prova ficou sem comunicação com o servidor por muito tempo.",
  };

  function fmtTempo(s) {
    s = Math.max(0, Math.round(s));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  function tela(conteudo) {
    return h("div", { class: "nr-screen" }, h("div", { class: "nr-screen-card" }, conteudo));
  }

  const fsOk = () => !!(document.documentElement.requestFullscreen);
  const emTelaCheia = () => !!document.fullscreenElement;
  async function entrarTelaCheia() {
    try {
      if (fsOk() && !emTelaCheia()) await document.documentElement.requestFullscreen();
    } catch (e) {
      /* o navegador pode negar; a violação será registrada se ele ficar fora */
    }
  }
  function sairTelaCheia() {
    try {
      if (emTelaCheia()) document.exitFullscreen();
    } catch (e) {
      /* ignora */
    }
  }

  // =====================================================================
  function iniciarProva(opts) {
    const { api, desafioId, host, onSair, onAprovado } = opts;
    host.innerHTML = "";
    let editor = null;
    let tentativa = null;
    let desafio = null;
    let ativo = false; // guardas ligadas
    let encerrada = false;
    let teclas = 0;
    let ultimaSaida = 0;
    let restante = 0;
    let timerId = null;
    let pingId = null;
    let fluxoSujo = false;
    let overlay = null;
    let verificando = false;
    const chips = {};

    // ---------------------------------------------------------- tela inicial
    function telaInicio(mensagemErro) {
      host.innerHTML = "";
      const btn = h("button", { class: "nr-big", type: "button" }, "Iniciar prova em tela cheia");
      const erro = h("p", { class: "nr-bad" }, mensagemErro || "");
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Preparando…";
        // pede a tela cheia no mesmo gesto do clique (exigência dos navegadores)
        const fs = entrarTelaCheia();
        try {
          const r = await api(`/api/desafios/${encodeURIComponent(desafioId)}/iniciar`, { method: "POST" });
          await fs;
          tentativa = r.tentativa;
          desafio = r.desafio;
          montar(r.fluxo || []);
        } catch (e) {
          sairTelaCheia();
          telaInicio(e.message);
        }
      });
      host.appendChild(
        tela([
          h("h2", {}, "🧪 Desafio prático"),
          h("p", {}, "Este desafio é obrigatório para concluir a aula. Ele funciona como uma prova de código:"),
          h("ul", {}, [
            h("li", {}, "A prova abre em ", h("b", {}, "tela cheia"), " e tem tempo limite controlado pelo servidor."),
            h("li", {}, h("b", {}, "Não é possível colar"), " nada (teclado, mouse ou arrastar). Digite tudo."),
            h("li", {}, h("b", {}, "Não saia da página"), ": trocar de aba/janela ou sair da tela cheia conta como violação."),
            h("li", {}, `Com ${3} violações a tentativa é `, h("b", {}, "anulada"), " (e há uma pequena espera para tentar de novo)."),
            h("li", {}, "Você pode pedir a correção até 8 vezes. Os testes são ocultos e usam valores diferentes a cada correção."),
            h("li", {}, "Se recarregar a página, você retoma de onde parou (o tempo continua correndo)."),
          ]),
          h("p", { class: "nr-muted" }, "Treine antes no Laboratório livre, no menu lateral do curso — lá pode colar, importar e testar à vontade."),
          erro,
          h("div", { class: "nr-actions" }, btn, h("button", { class: "nr-big secondary", type: "button", onclick: () => onSair && onSair() }, "Voltar")),
        ])
      );
    }

    // ------------------------------------------------------------ montagem
    function montar(fluxo) {
      host.innerHTML = "";
      const slot = h("div", { class: "nr-exam-bar" });
      chips.tempo = h("span", { class: "nr-chip" }, "⏱ --:--");
      chips.viol = h("span", { class: "nr-chip" }, "");
      chips.verif = h("span", { class: "nr-chip" }, "");
      const enviar = h("button", { type: "button", class: "nr-verify", onclick: () => verificar() }, "Enviar para correção");
      chips.enviar = enviar;
      slot.append(h("strong", {}, desafio.titulo), chips.tempo, chips.viol, chips.verif, enviar);
      const wrapper = h("div", { class: "nr-fullscreen" });
      host.appendChild(wrapper);
      editor = NREditor.mount(wrapper, {
        mode: "prova",
        flow: fluxo,
        desafio,
        paleta: desafio.paleta,
        onChange: () => (fluxoSujo = true),
      });
      editor.slots.header.appendChild(slot);
      restante = tentativa.segundosRestantes;
      atualizarChips();
      ligarGuardas();
      timerId = setInterval(tique, 1000);
      pingId = setInterval(ping, 15000);
      history.pushState({ nrProva: true }, "");
    }

    function atualizarChips() {
      if (!chips.tempo) return;
      chips.tempo.textContent = "⏱ " + fmtTempo(restante);
      chips.tempo.className = "nr-chip" + (restante < 120 ? " danger" : restante < 300 ? " warn" : "");
      chips.viol.textContent = `⚠ Violações ${tentativa.violacoes}/${tentativa.maxViolacoes}`;
      chips.viol.className = "nr-chip" + (tentativa.violacoes >= tentativa.maxViolacoes - 1 ? " danger" : tentativa.violacoes ? " warn" : "");
      chips.verif.textContent = `Correções restantes: ${tentativa.verificacoesRestantes}`;
    }
    function tique() {
      if (encerrada) return;
      restante -= 1;
      atualizarChips();
      if (restante <= 0) ping();
    }
    function aplicarResumo(r) {
      if (!r) return;
      tentativa = r;
      restante = r.segundosRestantes;
      atualizarChips();
      if (r.status === "anulado") encerrar("anulado");
      else if (r.status === "expirado") encerrar("expirado");
      else if (r.status === "reprovado") encerrar("reprovado");
    }

    // ----------------------------------------------------- servidor: eventos
    async function evento(tipo, detalhe) {
      if (encerrada) return;
      try {
        const r = await api(`/api/desafios/tentativas/${tentativa.id}/evento`, { method: "POST", body: { tipo, detalhe } });
        aplicarResumo(r);
      } catch (e) {
        /* sem rede: o servidor detecta pelo batimento */
      }
    }
    async function ping() {
      if (encerrada || !tentativa) return;
      try {
        const body = fluxoSujo && editor ? { fluxo: editor.getFlow() } : {};
        const r = await api(`/api/desafios/tentativas/${tentativa.id}/ping`, { method: "POST", body });
        fluxoSujo = false;
        aplicarResumo(r);
      } catch (e) {
        /* tenta de novo no próximo ciclo */
      }
    }

    // -------------------------------------------------------------- violação
    function violacao(tipo, detalhe) {
      if (!ativo || encerrada) return;
      const agora = Date.now();
      const ehSaida = tipo === "saiu_da_aba" || tipo === "perdeu_foco" || tipo === "saiu_tela_cheia";
      if (ehSaida) {
        if (agora - ultimaSaida < 1500) return;
        ultimaSaida = agora;
      }
      evento(tipo, detalhe);
      mostrarAviso(tipo);
    }
    function mostrarAviso(tipo) {
      if (encerrada) return;
      const leve = tipo === "tentou_colar" || tipo === "texto_inserido_suspeito";
      if (overlay) overlay.remove();
      const btn = h("button", { type: "button", onclick: async () => { await entrarTelaCheia(); overlay && overlay.remove(); overlay = null; if (editor) editor.el.focus(); } }, "Voltar à prova");
      overlay = h("div", { class: "nr-violation" }, h("div", {}, h("h2", {}, "⚠ Atenção: violação registrada"), h("p", {}, MOTIVOS[tipo] || "Ação não permitida durante a prova."), h("p", {}, "Cada violação é registrada e enviada ao servidor. Com 3, a tentativa é anulada."), btn));
      document.body.appendChild(overlay);
      if (leve) setTimeout(() => btn.focus(), 50);
    }

    // ---------------------------------------------------------------- guardas
    const guardas = [];
    function on(alvo, tipo, fn, opcoes) {
      alvo.addEventListener(tipo, fn, opcoes);
      guardas.push(() => alvo.removeEventListener(tipo, fn, opcoes));
    }
    function ligarGuardas() {
      ativo = true;
      const bloquear = (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
      };
      on(document, "paste", (e) => { bloquear(e); violacao("tentou_colar", "evento paste"); }, true);
      on(document, "copy", (e) => { bloquear(e); evento("tentou_copiar", ""); }, true);
      on(document, "cut", (e) => { bloquear(e); evento("tentou_copiar", "cut"); }, true);
      on(document, "contextmenu", (e) => bloquear(e), true);
      on(document, "dragstart", (e) => bloquear(e), true);
      on(document, "dragover", (e) => bloquear(e), true);
      on(document, "drop", (e) => { bloquear(e); violacao("tentou_colar", "drop"); }, true);
      on(document, "beforeinput", (e) => {
        const t = e.inputType || "";
        if (/^insertFromPaste|^insertFromDrop|^insertFromYank|^insertReplacementText/.test(t)) {
          bloquear(e);
          violacao("tentou_colar", t);
        } else if ((t === "insertText" || t === "insertCompositionText") && e.data && e.data.length > 20) {
          bloquear(e);
          violacao("texto_inserido_suspeito", `${e.data.length} caracteres de uma vez`);
        }
      }, true);
      on(document, "keydown", (e) => {
        const k = (e.key || "").toLowerCase();
        const mod = e.ctrlKey || e.metaKey;
        if ((mod && k === "v") || (e.shiftKey && k === "insert")) {
          bloquear(e);
          violacao("tentou_colar", "atalho");
          return;
        }
        if (mod && (k === "c" || k === "x")) {
          bloquear(e);
          evento("tentou_copiar", "atalho");
          return;
        }
        if (k === "f12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && ["u", "s", "p"].includes(k))) {
          bloquear(e);
          evento("tentou_atalho", e.key);
          return;
        }
        // telemetria: caracteres realmente digitados
        if (!mod && !e.altKey && (k.length === 1 || k === "enter" || k === "tab")) teclas += 1;
      }, true);
      on(document, "visibilitychange", () => {
        if (document.hidden) violacao("saiu_da_aba", "visibilitychange");
      });
      on(window, "blur", () => {
        setTimeout(() => {
          if (!document.hidden && !document.hasFocus()) violacao("perdeu_foco", "blur");
        }, 250);
      });
      on(document, "fullscreenchange", () => {
        if (!emTelaCheia() && fsOk()) violacao("saiu_tela_cheia", "fullscreenchange");
      });
      on(window, "popstate", () => {
        history.pushState({ nrProva: true }, "");
        evento("tentou_atalho", "botão voltar");
      });
      on(window, "beforeunload", (e) => {
        e.preventDefault();
        e.returnValue = "";
      });
    }
    function desligarGuardas() {
      ativo = false;
      guardas.splice(0).forEach((f) => f());
    }

    // -------------------------------------------------------------- correção
    async function verificar() {
      if (verificando || encerrada) return;
      verificando = true;
      chips.enviar.disabled = true;
      chips.enviar.textContent = "Corrigindo…";
      try {
        const r = await api(`/api/desafios/tentativas/${tentativa.id}/verificar`, { method: "POST", body: { fluxo: editor.getFlow(), telemetria: { teclas } } });
        editor.showResults(r);
        aplicarResumo(r.tentativa);
        if (r.passou) encerrar("aprovado", r);
        else editor.toast(`Ainda não passou (${r.requisitos.filter((x) => x.ok).length}/${r.requisitos.length} requisitos). Veja os detalhes na aba Info.`, "warn");
      } catch (e) {
        if (editor) editor.toast(e.message, "error");
      } finally {
        verificando = false;
        if (chips.enviar) {
          chips.enviar.disabled = false;
          chips.enviar.textContent = "Enviar para correção";
        }
      }
    }

    // ------------------------------------------------------------ encerramento
    function encerrar(motivo, resultado) {
      if (encerrada) return;
      encerrada = true;
      clearInterval(timerId);
      clearInterval(pingId);
      desligarGuardas();
      if (overlay) overlay.remove();
      sairTelaCheia();
      const voltar = () => {
        if (editor) editor.destroy();
        host.innerHTML = "";
        onSair && onSair(motivo === "aprovado");
      };
      let conteudo;
      if (motivo === "aprovado") {
        conteudo = [h("h2", { class: "nr-ok" }, "✅ Aprovado!"), h("p", {}, "Todos os requisitos foram atendidos. A aula agora pode ser concluída."), h("ul", {}, (resultado.requisitos || []).map((r) => h("li", { class: "nr-ok" }, "✓ " + r.texto))), h("div", { class: "nr-actions" }, h("button", { class: "nr-big", type: "button", onclick: () => { onAprovado && onAprovado(); voltar(); } }, "Voltar à aula"))];
      } else if (motivo === "anulado") {
        conteudo = [h("h2", { class: "nr-bad" }, "⛔ Tentativa anulada"), h("p", {}, "Foram registradas violações demais (saída da página, tela cheia ou tentativa de colar). Você pode tentar novamente depois de uma curta espera."), h("div", { class: "nr-actions" }, h("button", { class: "nr-big", type: "button", onclick: voltar }, "Voltar ao curso"))];
      } else if (motivo === "expirado") {
        conteudo = [h("h2", { class: "nr-bad" }, "⏰ Tempo esgotado"), h("p", {}, "O tempo da prova acabou. Você pode iniciar uma nova tentativa."), h("div", { class: "nr-actions" }, h("button", { class: "nr-big", type: "button", onclick: voltar }, "Voltar ao curso"))];
      } else {
        conteudo = [h("h2", { class: "nr-bad" }, "Tentativa encerrada"), h("p", {}, "Você usou todas as correções desta tentativa sem atender a todos os requisitos. Revise a aula, treine no Laboratório e tente novamente."), h("div", { class: "nr-actions" }, h("button", { class: "nr-big", type: "button", onclick: voltar }, "Voltar ao curso"))];
      }
      document.body.appendChild(Object.assign(tela(conteudo), { id: "nr-final" }));
      const f = document.getElementById("nr-final");
      f.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => f.remove()));
    }

    telaInicio();
    return {
      destroy() {
        desligarGuardas();
        clearInterval(timerId);
        clearInterval(pingId);
        if (editor) editor.destroy();
        if (overlay) overlay.remove();
        const f = document.getElementById("nr-final");
        if (f) f.remove();
        host.innerHTML = "";
      },
    };
  }

  // =====================================================================
  function laboratorio(opts) {
    const { host, onSair, chave } = opts;
    host.innerHTML = "";
    let salvo = [];
    try {
      salvo = JSON.parse(localStorage.getItem(chave) || "[]");
    } catch (e) {
      salvo = [];
    }
    const wrapper = h("div", { class: "nr-fullscreen" });
    host.appendChild(wrapper);
    const editor = NREditor.mount(wrapper, {
      mode: "livre",
      flow: Array.isArray(salvo) ? salvo : [],
      onChange: (f) => {
        try {
          localStorage.setItem(chave, JSON.stringify(f));
        } catch (e) {
          /* sem armazenamento: tudo bem */
        }
      },
    });
    editor.slots.header.appendChild(h("div", { class: "nr-exam-bar" }, h("button", { type: "button", class: "nr-btn nr-btn-ghost", onclick: () => { editor.destroy(); host.innerHTML = ""; onSair && onSair(); } }, "← Voltar ao curso"), h("span", { class: "nr-chip" }, "Laboratório livre · sem nota")));
    return {
      destroy() {
        editor.destroy();
        host.innerHTML = "";
      },
    };
  }

  window.NRExam = { iniciarProva, laboratorio };
})();
