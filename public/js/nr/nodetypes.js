/* Definição dos nodes do simulador: paleta, aparência, formulário de edição e
 * texto de ajuda (aba "Informação"). Os nomes de propriedades seguem o
 * formato do Node-RED (props, rules, func, wires...). */
(function () {
  "use strict";
  const { h, row, text, number, select, checkbox, textarea, typed, listEditor, uid } = NRKit;

  const TYPES = {};
  const CATEGORIES = [
    ["common", "comum"],
    ["function", "função"],
    ["network", "rede"],
    ["dashboard", "dashboard"],
  ];

  const clean = (s) => (s === undefined || s === null ? "" : String(s));
  const short = (s, n) => (clean(s).length > n ? clean(s).slice(0, n - 1) + "…" : clean(s));

  // ---- helpers de config nodes ----
  const brokers = (ctx) => ctx.nodes.filter((n) => n.type === "mqtt-broker");
  const groups = (ctx) => ctx.nodes.filter((n) => n.type === "ui_group");
  const tabs = (ctx) => ctx.nodes.filter((n) => n.type === "ui_tab");
  const groupLabel = (ctx, g) => {
    const t = tabs(ctx).find((x) => x.id === g.tab);
    return "[" + (t ? t.name : "?") + "] " + g.name;
  };

  function nameRow(n) {
    const input = text(n.name, { placeholder: "nome (opcional)" });
    return { el: row("Nome", input), get: () => ({ name: input.value }) };
  }

  // ------------------------------------------------------------------ inject
  TYPES.inject = {
    cat: "common",
    color: "#a6bbcf",
    inputs: 0,
    outputs: 1,
    icon: "→",
    defaults: () => ({ name: "", props: [{ p: "payload", v: "", vt: "date" }, { p: "topic", v: "", vt: "str" }], repeat: "", crontab: "", once: false, onceDelay: 0.1 }),
    label(n) {
      if (n.name) return n.name;
      const p = (n.props || [])[0];
      if (!p) return "inject";
      if (p.vt === "date") return "timestamp";
      if (p.vt === "str") return p.v ? '"' + short(p.v, 18) + '"' : "texto vazio";
      if (p.vt === "bool") return p.v === "true" ? "verdadeiro" : "falso";
      return short(p.v, 18) || "inject";
    },
    form(n) {
      const nm = nameRow(n);
      const props = listEditor(
        n.props || [],
        (it) => {
          const key = text(it.p, { placeholder: "payload", class: "nr-input nr-prop-key" });
          const val = typed(["str", "num", "bool", "json", "date", "flow", "global"], it.v, it.vt || "str");
          return { el: h("div", { class: "nr-prop-row" }, h("span", { class: "nr-prefix" }, "msg."), key, h("span", { class: "nr-eq" }, "="), val), get: () => Object.assign({ p: key.value.trim() }, val.get()) };
        },
        () => ({ p: "", v: "", vt: "str" }),
        "adicionar propriedade"
      );
      let mode = n.crontab ? "time" : Number(n.repeat) > 0 ? "interval" : "none";
      const modeSel = select([["none", "nenhuma (só manual)"], ["interval", "repetir a cada intervalo"], ["time", "em um horário específico"]], mode);
      const secs = Number(n.repeat) || 0;
      const unitSel = select([["1", "segundos"], ["60", "minutos"], ["3600", "horas"]], secs && secs % 3600 === 0 ? "3600" : secs && secs % 60 === 0 ? "60" : "1");
      const amount = number(secs ? secs / Number(unitSel.value) : 5, { min: 1, class: "nr-input nr-short" });
      const cron = String(n.crontab || "").trim().split(/\s+/);
      const timeInput = h("input", { type: "time", class: "nr-input nr-short", value: cron.length >= 2 && /^\d+$/.test(cron[0]) && /^\d+$/.test(cron[1]) ? cron[1].padStart(2, "0") + ":" + cron[0].padStart(2, "0") : "06:00" });
      const dowInputs = ["D", "S", "T", "Q", "Q", "S", "S"].map((l, i) => {
        const on = !cron[4] || cron[4] === "*" ? true : cron[4].split(",").includes(String(i));
        return checkbox(l, on);
      });
      const intervalBox = h("div", { class: "nr-inline" }, "a cada", amount, unitSel);
      const timeBox = h("div", {}, h("div", { class: "nr-inline" }, "às", timeInput), h("div", { class: "nr-inline nr-dows" }, dowInputs));
      const show = () => {
        intervalBox.style.display = modeSel.value === "interval" ? "" : "none";
        timeBox.style.display = modeSel.value === "time" ? "" : "none";
      };
      modeSel.addEventListener("change", show);
      show();
      const once = checkbox("Injetar uma vez ao iniciar, após", n.once);
      const onceDelay = number(n.onceDelay === undefined ? 0.1 : n.onceDelay, { class: "nr-input nr-short", min: 0 });
      const el = h("div", {}, nm.el, h("div", { class: "nr-section" }, "Mensagem"), props, h("div", { class: "nr-section" }, "Repetição"), row("Repetir", modeSel), intervalBox, timeBox, h("div", { class: "nr-inline" }, once, onceDelay, "segundos"));
      return {
        el,
        collect() {
          let repeat = "";
          let crontab = "";
          if (modeSel.value === "interval") repeat = String(Math.max(1, Number(amount.value) || 1) * Number(unitSel.value));
          if (modeSel.value === "time") {
            const [hh, mm] = (timeInput.value || "06:00").split(":").map(Number);
            const days = dowInputs.map((c, i) => (c.input.checked ? i : null)).filter((x) => x !== null);
            crontab = `${mm} ${hh} * * ${days.length === 7 || days.length === 0 ? "*" : days.join(",")}`;
          }
          return Object.assign(nm.get(), { props: props.get().filter((p) => p.p), repeat, crontab, once: once.input.checked, onceDelay: Number(onceDelay.value) || 0 });
        },
      };
    },
    help: `<p>Envia uma mensagem para o fluxo quando você clica no botão do node (ou automaticamente, se configurar repetição).</p>
<p>Por padrão ele envia <code>msg.payload</code> com o <b>timestamp</b> atual (milissegundos). Você pode trocar por texto, número, booleano ou JSON e adicionar outras propriedades, como <code>msg.topic</code>.</p>
<p><b>Repetição:</b> a cada N segundos/minutos/horas, ou em um horário (ex.: todos os dias às 06:00).</p>`,
  };

  // ------------------------------------------------------------------- debug
  TYPES.debug = {
    cat: "common",
    color: "#87a980",
    inputs: 1,
    outputs: 0,
    icon: "≡",
    defaults: () => ({ name: "", active: true, complete: "payload" }),
    label: (n) => n.name || (n.complete === "true" ? "msg completa" : "msg." + (n.complete || "payload")),
    form(n) {
      const nm = nameRow(n);
      const whole = n.complete === "true" || n.complete === true;
      const modeSel = select([["payload", "msg.payload"], ["true", "msg completa"], ["custom", "msg.…"]], whole ? "true" : n.complete === "payload" || !n.complete ? "payload" : "custom");
      const custom = text(whole || n.complete === "payload" ? "" : n.complete, { placeholder: "topic" });
      const show = () => (custom.style.display = modeSel.value === "custom" ? "" : "none");
      modeSel.addEventListener("change", show);
      show();
      const active = checkbox("Ativo (mostrar mensagens na barra lateral)", n.active !== false);
      return {
        el: h("div", {}, nm.el, row("Saída", h("div", { class: "nr-inline" }, modeSel, custom)), h("div", { class: "nr-form-row" }, active)),
        collect: () => Object.assign(nm.get(), { complete: modeSel.value === "custom" ? custom.value.trim() || "payload" : modeSel.value, active: active.input.checked }),
      };
    },
    help: `<p>Mostra mensagens na aba <b>Debug</b> da barra lateral. É a principal ferramenta para descobrir o que está acontecendo no seu fluxo.</p>
<p>Por padrão exibe <code>msg.payload</code>; também pode exibir a mensagem completa.</p>
<p>O quadradinho à direita do node liga/desliga a exibição.</p>`,
  };

  // ----------------------------------------------------------------- comment
  TYPES.comment = {
    cat: "common",
    color: "#ffffff",
    inputs: 0,
    outputs: 0,
    icon: "…",
    defaults: () => ({ name: "comentário", info: "" }),
    label: (n) => n.name || "comentário",
    form(n) {
      const nm = nameRow(n);
      const info = textarea(n.info, 5);
      return { el: h("div", {}, nm.el, row("Texto", info)), collect: () => Object.assign(nm.get(), { info: info.value }) };
    },
    help: `<p>Um node que não faz nada: serve só para deixar anotações no fluxo.</p>`,
  };

  // ------------------------------------------------------------------ catch
  TYPES.catch = {
    cat: "common",
    color: "#e49191",
    inputs: 0,
    outputs: 1,
    icon: "!",
    defaults: () => ({ name: "", scope: null }),
    label: (n) => n.name || "catch",
    form(n, ctx) {
      const nm = nameRow(n);
      const all = ctx.nodes.filter((x) => x.id !== n.id && TYPES[x.type] && x.type !== "comment" && x.type !== "catch");
      const modeSel = select([["all", "todos os nodes"], ["some", "nodes selecionados"]], n.scope && n.scope.length ? "some" : "all");
      const checks = all.map((x) => {
        const c = checkbox(TYPES[x.type].label(x) + " (" + x.type + ")", (n.scope || []).includes(x.id));
        c.dataset.id = x.id;
        return c;
      });
      const list = h("div", { class: "nr-scope-list" }, checks.length ? checks : h("em", {}, "Nenhum outro node no fluxo"));
      const show = () => (list.style.display = modeSel.value === "some" ? "" : "none");
      modeSel.addEventListener("change", show);
      show();
      return {
        el: h("div", {}, nm.el, row("Capturar erros de", modeSel), list),
        collect: () => Object.assign(nm.get(), { scope: modeSel.value === "some" ? checks.filter((c) => c.input.checked).map((c) => c.dataset.id) : null }),
      };
    },
    help: `<p>Captura erros lançados por outros nodes (por exemplo, um JSON inválido ou um <code>node.error(texto, msg)</code> em uma Function) e envia a mensagem com <code>msg.error</code> para continuar o fluxo.</p>
<p><code>msg.error.message</code> traz o texto do erro e <code>msg.error.source</code> indica qual node falhou.</p>`,
  };

  // ------------------------------------------------------------------ change
  TYPES.change = {
    cat: "function",
    color: "#e2d96e",
    inputs: 1,
    outputs: 1,
    icon: "⇄",
    defaults: () => ({ name: "", rules: [{ t: "set", p: "payload", pt: "msg", to: "", tot: "str" }] }),
    label: (n) => n.name || "change",
    form(n) {
      const nm = nameRow(n);
      const rules = listEditor(
        n.rules || [],
        (r) => {
          const act = select([["set", "Definir"], ["change", "Substituir"], ["delete", "Excluir"], ["move", "Mover"]], r.t || "set");
          const pt = select([["msg", "msg."], ["flow", "flow."], ["global", "global."]], r.pt || "msg", { class: "nr-input nr-typed-type" });
          const p = text(r.p || "payload", { placeholder: "payload" });
          const detail = h("div", { class: "nr-rule-detail" });
          let toTyped, fromSel, fromInput, toStr, moveT, moveP;
          const build = () => {
            detail.innerHTML = "";
            if (act.value === "set") {
              toTyped = typed(["str", "num", "bool", "json", "date", "msg", "flow", "global", "env"], r.to, r.tot || "str");
              detail.appendChild(row("para o valor", toTyped));
            } else if (act.value === "change") {
              fromSel = select([["str", "texto"], ["re", "regex"]], r.fromt || "str", { class: "nr-input nr-typed-type" });
              fromInput = text(r.from || "");
              toStr = text(r.t === "change" ? r.to : "");
              detail.appendChild(row("procurar", h("div", { class: "nr-typed" }, fromSel, fromInput)));
              detail.appendChild(row("substituir por", toStr));
            } else if (act.value === "move") {
              moveT = select([["msg", "msg."], ["flow", "flow."], ["global", "global."]], r.t === "move" ? r.tot || "msg" : "msg", { class: "nr-input nr-typed-type" });
              moveP = text(r.t === "move" ? r.to : "", { placeholder: "novo.caminho" });
              detail.appendChild(row("para", h("div", { class: "nr-typed" }, moveT, moveP)));
            }
          };
          act.addEventListener("change", build);
          build();
          return {
            el: h("div", { class: "nr-rule" }, h("div", { class: "nr-inline" }, act, h("div", { class: "nr-typed" }, pt, p)), detail),
            get() {
              const base = { t: act.value, pt: pt.value, p: p.value.trim() };
              if (act.value === "set") {
                const v = toTyped.get();
                return Object.assign(base, { to: v.v, tot: v.vt });
              }
              if (act.value === "change") return Object.assign(base, { from: fromInput.value, fromt: fromSel.value, to: toStr.value, tot: "str" });
              if (act.value === "move") return Object.assign(base, { to: moveP.value.trim(), tot: moveT.value });
              return base;
            },
          };
        },
        () => ({ t: "set", p: "payload", pt: "msg", to: "", tot: "str" }),
        "adicionar regra"
      );
      return { el: h("div", {}, nm.el, h("div", { class: "nr-section" }, "Regras"), rules), collect: () => Object.assign(nm.get(), { rules: rules.get() }) };
    },
    help: `<p>Altera propriedades da mensagem <b>sem escrever código</b>.</p>
<ul><li><b>Definir</b>: coloca um valor (texto, número, booleano, JSON, outra propriedade…) em <code>msg.payload</code> ou outra propriedade.</li>
<li><b>Substituir</b>: troca um trecho de texto por outro.</li><li><b>Excluir</b>: remove a propriedade.</li><li><b>Mover</b>: muda o valor de uma propriedade para outra.</li></ul>
<p>Também funciona com contexto: <code>flow.</code> e <code>global.</code>.</p>`,
  };

  // ------------------------------------------------------------------ switch
  const OPS = [
    ["eq", "=="], ["neq", "!="], ["lt", "<"], ["lte", "<="], ["gt", ">"], ["gte", ">="], ["btwn", "está entre"], ["cont", "contém"], ["regex", "casa com regex"],
    ["true", "é verdadeiro"], ["false", "é falso"], ["null", "é null"], ["nnull", "não é null"], ["empty", "está vazio"], ["nempty", "não está vazio"], ["istype", "é do tipo"], ["hask", "tem a chave"], ["else", "caso contrário"],
  ];
  TYPES.switch = {
    cat: "function",
    color: "#e2d96e",
    inputs: 1,
    outputs: (n) => Math.max(1, (n.rules || []).length),
    icon: "⑂",
    defaults: () => ({ name: "", property: "payload", propertyType: "msg", rules: [{ t: "eq", v: "", vt: "str" }], checkall: "true" }),
    label: (n) => n.name || "switch",
    form(n) {
      const nm = nameRow(n);
      const pt = select([["msg", "msg."], ["flow", "flow."], ["global", "global."]], n.propertyType || "msg", { class: "nr-input nr-typed-type" });
      const p = text(n.property || "payload");
      const rules = listEditor(
        n.rules || [],
        (r) => {
          const op = select(OPS, r.t || "eq", { class: "nr-input nr-op" });
          const box = h("div", { class: "nr-inline nr-grow" });
          let v1, v2, ty, cs;
          const build = () => {
            box.innerHTML = "";
            const t = op.value;
            if (["eq", "neq", "lt", "lte", "gt", "gte", "cont"].includes(t)) {
              v1 = typed(["str", "num", "msg", "flow", "global"], r.v, r.vt || "str");
              box.appendChild(v1);
            } else if (t === "btwn") {
              v1 = typed(["num", "str", "msg", "flow", "global"], r.v, r.vt || "num");
              v2 = typed(["num", "str", "msg", "flow", "global"], r.v2, r.v2t || "num");
              box.appendChild(v1);
              box.appendChild(h("span", {}, "e"));
              box.appendChild(v2);
            } else if (t === "regex") {
              v1 = text(r.v || "", { placeholder: "^abc" });
              cs = checkbox("ignorar maiúsculas", r.case);
              box.appendChild(v1);
              box.appendChild(cs);
            } else if (t === "istype") {
              ty = select([["string", "texto"], ["number", "número"], ["boolean", "booleano"], ["array", "array"], ["object", "objeto"], ["json", "JSON (texto)"], ["null", "null"], ["undefined", "undefined"]], r.v || "string");
              box.appendChild(ty);
            } else if (t === "hask") {
              v1 = text(r.v || "", { placeholder: "chave" });
              box.appendChild(v1);
            }
          };
          op.addEventListener("change", build);
          build();
          return {
            el: h("div", { class: "nr-rule nr-inline" }, op, box),
            get() {
              const t = op.value;
              if (["eq", "neq", "lt", "lte", "gt", "gte", "cont"].includes(t)) return { t, v: v1.get().v, vt: v1.get().vt };
              if (t === "btwn") return { t, v: v1.get().v, vt: v1.get().vt, v2: v2.get().v, v2t: v2.get().vt };
              if (t === "regex") return { t, v: v1.value, case: cs.input.checked };
              if (t === "istype") return { t, v: ty.value };
              if (t === "hask") return { t, v: v1.value };
              return { t };
            },
          };
        },
        () => ({ t: "eq", v: "", vt: "str" }),
        "adicionar regra"
      );
      const check = select([["true", "verificar todas as regras"], ["false", "parar na primeira que casar"]], String(n.checkall === false ? "false" : n.checkall || "true"));
      return {
        el: h("div", {}, nm.el, row("Propriedade", h("div", { class: "nr-typed" }, pt, p)), h("div", { class: "nr-section" }, "Regras (cada regra é uma saída)"), rules, row("Comportamento", check)),
        collect: () => Object.assign(nm.get(), { propertyType: pt.value, property: p.value.trim() || "payload", rules: rules.get(), checkall: check.value }),
      };
    },
    help: `<p>Direciona a mensagem para <b>caminhos diferentes</b> conforme condições. Cada regra vira uma saída do node.</p>
<p>Ex.: <code>msg.payload.idade &gt;= 18</code> sai pela saída 1; "caso contrário" sai pela saída 2.</p>
<p>Você pode parar na primeira regra que casar ou verificar todas.</p>`,
  };

  // ---------------------------------------------------------------- function
  TYPES.function = {
    cat: "function",
    color: "#fdd0a2",
    inputs: 1,
    outputs: (n) => Math.max(1, Number(n.outputs) || 1),
    icon: "ƒ",
    defaults: () => ({ name: "", func: "return msg;", outputs: 1 }),
    label: (n) => n.name || "function",
    form(n) {
      const nm = nameRow(n);
      const outs = number(n.outputs || 1, { min: 1, max: 8, class: "nr-input nr-short" });
      const code = textarea(n.func || "", 14, true);
      code.classList.add("nr-code");
      code.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const s = code.selectionStart;
          code.setRangeText("  ", s, code.selectionEnd, "end");
          code.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      return {
        el: h(
          "div",
          {},
          nm.el,
          row("Saídas", outs),
          h("div", { class: "nr-section" }, "Código (JavaScript)"),
          code,
          h("div", { class: "nr-hint" }, "Disponível: msg, node, flow, global, context, env, RED.util.cloneMessage. Não há setTimeout/require/fetch no simulador. Retorne msg (ou null para não enviar).")
        ),
        collect: () => Object.assign(nm.get(), { func: code.value, outputs: Math.max(1, Math.min(8, Number(outs.value) || 1)) }),
      };
    },
    help: `<p>Executa JavaScript sobre cada mensagem. Retorne a mensagem para enviá-la ao próximo node.</p>
<pre>msg.payload = msg.payload * 2;
return msg;</pre>
<ul><li><code>return null;</code> → não envia nada.</li><li><code>return [msgA, msgB];</code> → uma mensagem em cada saída (configure o número de saídas).</li>
<li><code>node.warn("texto")</code> / <code>node.error("texto", msg)</code> → aparecem no Debug; o erro pode ser capturado por um node Catch.</li>
<li><code>flow.set("chave", valor)</code> e <code>flow.get("chave")</code> guardam estado entre mensagens (também <code>global</code>).</li></ul>
<p>Atenção: retornar um <b>texto</b> ou <b>número</b> em vez de <code>msg</code> gera erro ("tried to send a message of type string").</p>`,
  };

  // ---------------------------------------------------------------- template
  TYPES.template = {
    cat: "function",
    color: "#f3b567",
    inputs: 1,
    outputs: 1,
    icon: "{ }",
    defaults: () => ({ name: "", field: "payload", fieldType: "msg", syntax: "mustache", template: "Esta é a carga: {{payload}} !", output: "str" }),
    label: (n) => n.name || "template",
    form(n) {
      const nm = nameRow(n);
      const ft = select([["msg", "msg."], ["flow", "flow."], ["global", "global."]], n.fieldType || "msg", { class: "nr-input nr-typed-type" });
      const f = text(n.field || "payload");
      const syn = select([["mustache", "Mustache"], ["plain", "Texto puro"]], n.syntax || "mustache");
      const out = select([["str", "texto"], ["json", "objeto JSON (interpretado)"]], n.output === "json" || n.output === "parsed" ? "json" : "str");
      const tpl = textarea(n.template || "", 8, true);
      return {
        el: h("div", {}, nm.el, row("Propriedade", h("div", { class: "nr-typed" }, ft, f)), row("Sintaxe", syn), row("Saída", out), h("div", { class: "nr-section" }, "Modelo"), tpl, h("div", { class: "nr-hint" }, "Use {{payload}}, {{payload.nome}}, {{topic}}. Com duas chaves, caracteres como < > & ' são convertidos em HTML; use {{{payload}}} para o texto cru.")),
        collect: () => Object.assign(nm.get(), { fieldType: ft.value, field: f.value.trim() || "payload", syntax: syn.value, output: out.value, template: tpl.value }),
      };
    },
    help: `<p>Monta textos dinâmicos usando o modelo <b>Mustache</b>.</p>
<pre>Olá, {{payload.nome}}! Temperatura: {{payload.temperatura}}°C</pre>
<p>O resultado vai para a propriedade escolhida (por padrão <code>msg.payload</code>). Útil para relatórios, mensagens e HTML.</p>`,
  };

  // ------------------------------------------------------------------- delay
  TYPES.delay = {
    cat: "function",
    color: "#e6e0f8",
    inputs: 1,
    outputs: 1,
    icon: "◷",
    defaults: () => ({ name: "", pauseType: "delay", timeout: "5", timeoutUnits: "seconds", rate: "1", nbRateUnits: "1", rateUnits: "second", drop: false }),
    label(n) {
      if (n.name) return n.name;
      if (n.pauseType === "rate") return "limitar " + (n.rate || 1) + "/" + (n.nbRateUnits > 1 ? n.nbRateUnits + " " : "") + ({ second: "s", minute: "min", hour: "h", day: "dia" }[n.rateUnits] || "s");
      return "atraso " + (n.timeout || 5) + ({ milliseconds: " ms", seconds: " s", minutes: " min", hours: " h", days: " d" }[n.timeoutUnits] || " s");
    },
    form(n) {
      const nm = nameRow(n);
      const mode = select([["delay", "Atrasar cada mensagem"], ["rate", "Limitar a taxa de mensagens"]], n.pauseType || "delay");
      const to = number(n.timeout === undefined ? 5 : n.timeout, { min: 0, class: "nr-input nr-short" });
      const tu = select([["milliseconds", "milissegundos"], ["seconds", "segundos"], ["minutes", "minutos"], ["hours", "horas"]], n.timeoutUnits || "seconds");
      const rate = number(n.rate || 1, { min: 1, class: "nr-input nr-short" });
      const nb = number(n.nbRateUnits || 1, { min: 1, class: "nr-input nr-short" });
      const ru = select([["second", "segundo(s)"], ["minute", "minuto(s)"], ["hour", "hora(s)"], ["day", "dia(s)"]], n.rateUnits || "second");
      const drop = checkbox("Descartar as mensagens excedentes", n.drop);
      const delayBox = h("div", { class: "nr-inline" }, "Atraso de", to, tu);
      const rateBox = h("div", {}, h("div", { class: "nr-inline" }, "Taxa:", rate, "msg a cada", nb, ru), drop);
      const show = () => {
        delayBox.style.display = mode.value === "delay" ? "" : "none";
        rateBox.style.display = mode.value === "rate" ? "" : "none";
      };
      mode.addEventListener("change", show);
      show();
      return {
        el: h("div", {}, nm.el, row("Ação", mode), delayBox, rateBox),
        collect: () => Object.assign(nm.get(), { pauseType: mode.value, timeout: to.value, timeoutUnits: tu.value, rate: rate.value, nbRateUnits: nb.value, rateUnits: ru.value, drop: drop.input.checked }),
      };
    },
    help: `<p>Atrasa as mensagens por um tempo fixo ou limita quantas passam por período. Evita sobrecarregar APIs e controla o ritmo de acionamento de equipamentos.</p>`,
  };

  // ----------------------------------------------------------------- trigger
  TYPES.trigger = {
    cat: "function",
    color: "#e6e0f8",
    inputs: 1,
    outputs: 1,
    icon: "◔",
    defaults: () => ({ name: "", op1: "1", op1type: "num", op2: "0", op2type: "num", duration: "250", units: "ms", extend: false, reset: "", bytopic: "all" }),
    label: (n) => n.name || "trigger",
    form(n) {
      const nm = nameRow(n);
      const T1 = ["str", "num", "bool", "json", "date", "pay", "nul"];
      const op1 = typed(T1, n.op1, n.op1type || "num");
      const op2 = typed(T1, n.op2, n.op2type || "num");
      const dur = number(n.duration === undefined ? 250 : n.duration, { min: 0, class: "nr-input nr-short" });
      const units = select([["ms", "milissegundos"], ["s", "segundos"], ["min", "minutos"], ["hr", "horas"]], n.units || "ms");
      const ext = checkbox("Estender o tempo se chegar nova mensagem", n.extend);
      return {
        el: h("div", {}, nm.el, row("Enviar", op1), row("Depois", h("div", { class: "nr-inline" }, "esperar", dur, units)), row("Então enviar", op2), h("div", { class: "nr-form-row" }, ext)),
        collect: () => {
          const a = op1.get();
          const b = op2.get();
          return Object.assign(nm.get(), { op1: a.v, op1type: a.vt, op2: b.v, op2type: b.vt, duration: dur.value, units: units.value, extend: ext.input.checked });
        },
      };
    },
    help: `<p>Cria <b>temporizadores</b>: envia uma mensagem imediatamente (ex.: ligar a bomba) e, depois de um tempo, envia outra (desligar).</p>
<p>Enquanto o tempo corre, novas mensagens são ignoradas, a menos que você marque <b>estender</b> (o tempo recomeça a cada nova mensagem — ótimo para alarmes de "sem atividade").</p>`,
  };

  // -------------------------------------------------------------------- json
  TYPES.json = {
    cat: "function",
    color: "#e2d96e",
    inputs: 1,
    outputs: 1,
    icon: "{}",
    defaults: () => ({ name: "", property: "payload", action: "", pretty: false }),
    label: (n) => n.name || "json",
    form(n) {
      const nm = nameRow(n);
      const act = select([["", "Converter entre texto JSON e objeto"], ["str", "Sempre para texto JSON"], ["obj", "Sempre para objeto"]], n.action || "");
      const prop = text(n.property || "payload");
      const pretty = checkbox("Formatar o JSON (identado)", n.pretty);
      return { el: h("div", {}, nm.el, row("Ação", act), row("Propriedade", h("div", { class: "nr-inline" }, "msg.", prop)), h("div", { class: "nr-form-row" }, pretty)), collect: () => Object.assign(nm.get(), { action: act.value, property: prop.value.trim() || "payload", pretty: pretty.input.checked }) };
    },
    help: `<p>Converte entre <b>texto JSON</b> e <b>objeto JavaScript</b>. Se <code>msg.payload</code> for um texto, vira objeto; se for objeto, vira texto.</p>
<p>Muito usado depois do MQTT In, que entrega a leitura do sensor como texto. JSON inválido gera um erro (capturável com Catch).</p>`,
  };

  // ------------------------------------------------------------ http request
  TYPES["http request"] = {
    cat: "network",
    color: "#e6e0f8",
    inputs: 1,
    outputs: 1,
    icon: "⇅",
    defaults: () => ({ name: "", method: "GET", url: "", ret: "txt", headers: [] }),
    label: (n) => n.name || (n.method || "GET") + " " + short((n.url || "").replace(/^https?:\/\//, ""), 22),
    form(n) {
      const nm = nameRow(n);
      const method = select([["GET", "GET"], ["POST", "POST"], ["PUT", "PUT"], ["PATCH", "PATCH"], ["DELETE", "DELETE"], ["use", "usar msg.method"]], n.method || "GET");
      const url = text(n.url || "", { placeholder: "https://jsonplaceholder.typicode.com/users" });
      const ret = select([["txt", "um texto (UTF-8)"], ["obj", "um objeto JSON interpretado"]], n.ret === "obj" ? "obj" : "txt");
      const hdrs = listEditor(
        n.headers || [],
        (it) => {
          const k = text(it.k, { placeholder: "Content-Type" });
          const v = text(it.v, { placeholder: "application/json" });
          return { el: h("div", { class: "nr-inline" }, k, ":", v), get: () => ({ k: k.value.trim(), v: v.value }) };
        },
        () => ({ k: "", v: "" }),
        "adicionar cabeçalho"
      );
      return {
        el: h("div", {}, nm.el, row("Método", method), row("URL", url, "Se ficar vazia, usa msg.url. Aceita {{payload}} no endereço."), row("Retornar", ret), h("div", { class: "nr-section" }, "Cabeçalhos"), hdrs, h("div", { class: "nr-hint nr-warnbox" }, "Ambiente simulado: só existe a API jsonplaceholder.typicode.com (users, todos, posts) e /falha (erro 500). Outros endereços retornam erro de rede.")),
        collect: () => Object.assign(nm.get(), { method: method.value, url: url.value.trim(), ret: ret.value, headers: hdrs.get().filter((x) => x.k) }),
      };
    },
    valid: () => true,
    help: `<p>Faz uma requisição HTTP a uma API. A resposta chega em <code>msg.payload</code>; o código de status em <code>msg.statusCode</code>.</p>
<p>Configure <b>Retornar: objeto JSON</b> para já receber os dados como objeto.</p>
<p>Em POST/PUT/PATCH, o <code>msg.payload</code> é enviado no corpo da requisição (objetos viram JSON e o cabeçalho <code>Content-Type</code> é ajustado). Códigos 404 ou 500 <b>não</b> geram erro — verifique <code>msg.statusCode</code>.</p>
<p><i>No simulador, a API é fictícia (só jsonplaceholder.typicode.com).</i></p>`,
  };

  // -------------------------------------------------------------------- mqtt
  function brokerSection(n, ctx) {
    const existing = brokers(ctx);
    const opts = existing.map((b) => [b.id, (b.name || b.broker) + " (" + b.broker + ":" + (b.port || 1883) + ")"]).concat([["__new", "➕ Adicionar novo broker…"]]);
    const sel = select(opts, existing.find((b) => b.id === n.broker) ? n.broker : existing.length ? existing[0].id : "__new");
    const host = text("", { placeholder: "test.mosquitto.org" });
    const port = text("", { placeholder: "1883", class: "nr-input nr-short" });
    const fill = () => {
      const b = existing.find((x) => x.id === sel.value);
      host.value = b ? b.broker : "test.mosquitto.org";
      port.value = b ? b.port || "1883" : "1883";
    };
    sel.addEventListener("change", fill);
    fill();
    return {
      el: h("div", {}, row("Servidor", sel), row("Endereço do broker", h("div", { class: "nr-inline" }, host, ":", port))),
      get() {
        const id = sel.value === "__new" ? uid() : sel.value;
        return { id, config: { id, type: "mqtt-broker", name: "", broker: host.value.trim(), port: port.value.trim() || "1883" } };
      },
    };
  }
  TYPES["mqtt in"] = {
    cat: "network",
    color: "#d8bfd8",
    inputs: 0,
    outputs: 1,
    icon: "◉",
    defaults: () => ({ name: "", topic: "", qos: "0", datatype: "auto", broker: "" }),
    label: (n) => n.name || n.topic || "mqtt in",
    form(n, ctx) {
      const nm = nameRow(n);
      const b = brokerSection(n, ctx);
      const topic = text(n.topic, { placeholder: "estufa/sensorDHT" });
      const dt = select([["auto", "detectar automaticamente (texto)"], ["utf8", "um texto"], ["json", "um objeto JSON interpretado"]], n.datatype || "auto");
      return {
        el: h("div", {}, nm.el, b.el, row("Tópico", topic, "Aceita curingas: + (um nível) e # (vários níveis)"), row("Saída", dt)),
        collect() {
          const br = b.get();
          return Object.assign(nm.get(), { topic: topic.value.trim(), datatype: dt.value, broker: br.id, configs: [br.config] });
        },
      };
    },
    help: `<p>Assina um <b>tópico MQTT</b> e envia uma mensagem a cada publicação recebida, com <code>msg.topic</code> e <code>msg.payload</code>.</p>
<p>A leitura de sensores (ESP32, Arduino…) costuma chegar como <b>texto JSON</b>: use a saída "objeto JSON" ou um node JSON em seguida.</p>
<p>No simulador, use a aba <b>MQTT</b> para publicar como se fosse um dispositivo (como no MQTT Explorer) ou ligue o sensor virtual.</p>`,
  };
  TYPES["mqtt out"] = {
    cat: "network",
    color: "#d8bfd8",
    inputs: 1,
    outputs: 0,
    icon: "◉",
    defaults: () => ({ name: "", topic: "", qos: "0", retain: "false", broker: "" }),
    label: (n) => n.name || n.topic || "mqtt out",
    form(n, ctx) {
      const nm = nameRow(n);
      const b = brokerSection(n, ctx);
      const topic = text(n.topic, { placeholder: "estufa/ventilador/comando" });
      return {
        el: h("div", {}, nm.el, b.el, row("Tópico", topic, "Se ficar vazio, usa msg.topic")),
        collect() {
          const br = b.get();
          return Object.assign(nm.get(), { topic: topic.value.trim(), broker: br.id, configs: [br.config] });
        },
      };
    },
    help: `<p>Publica <code>msg.payload</code> em um <b>tópico MQTT</b>. É assim que o Node-RED comanda atuadores (relés, bombas, ventiladores).</p>
<p>Se o tópico do node estiver vazio, usa <code>msg.topic</code>. Veja o resultado na aba <b>MQTT</b>.</p>`,
  };

  // --------------------------------------------------------------- dashboard
  function groupSection(n, ctx) {
    const gs = groups(ctx);
    const opts = gs.map((g) => [g.id, groupLabel(ctx, g)]).concat([["__new", "➕ Criar novo grupo…"]]);
    const sel = select(opts, gs.find((g) => g.id === n.group) ? n.group : gs.length ? gs[0].id : "__new");
    const ts = tabs(ctx);
    const tabSel = select(ts.map((t) => [t.id, t.name]).concat([["__newtab", "➕ Nova aba…"]]), ts.length ? ts[0].id : "__newtab");
    const tabName = text("Aba 1", { placeholder: "nome da aba" });
    const groupName = text("Grupo 1", { placeholder: "nome do grupo" });
    const newBox = h("div", { class: "nr-newgroup" }, row("Aba", tabSel), row("Nome da aba", tabName), row("Nome do grupo", groupName));
    const show = () => {
      newBox.style.display = sel.value === "__new" ? "" : "none";
      tabName.parentElement.parentElement.style.display = tabSel.value === "__newtab" ? "" : "none";
    };
    sel.addEventListener("change", show);
    tabSel.addEventListener("change", show);
    show();
    return {
      el: h("div", {}, row("Grupo", sel), newBox),
      get() {
        if (sel.value !== "__new") return { group: sel.value, configs: [] };
        const configs = [];
        let tabId = tabSel.value;
        if (tabId === "__newtab") {
          tabId = uid();
          configs.push({ id: tabId, type: "ui_tab", name: tabName.value.trim() || "Aba 1" });
        }
        const gid = uid();
        configs.push({ id: gid, type: "ui_group", name: groupName.value.trim() || "Grupo 1", tab: tabId });
        return { group: gid, configs };
      },
    };
  }
  function uiForm(extra) {
    return function (n, ctx) {
      const nm = nameRow(n);
      const g = groupSection(n, ctx);
      const label = text(n.label, { placeholder: "rótulo" });
      const ex = extra ? extra(n) : { el: null, get: () => ({}) };
      return {
        el: h("div", {}, nm.el, g.el, row("Rótulo", label), ex.el),
        collect() {
          const gr = g.get();
          return Object.assign(nm.get(), { label: label.value, group: gr.group, configs: gr.configs }, ex.get());
        },
      };
    };
  }
  const uiValid = (n, nodes) => nodes.some((g) => g.id === n.group && g.type === "ui_group");

  TYPES.ui_slider = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 1,
    outputs: 1,
    icon: "⊸",
    defaults: () => ({ name: "", label: "slider", group: "", min: 0, max: 100, step: 1, passthru: true }),
    label: (n) => n.name || n.label || "slider",
    valid: uiValid,
    form: uiForm((n) => {
      const mn = number(n.min === undefined ? 0 : n.min);
      const mx = number(n.max === undefined ? 100 : n.max);
      const st = number(n.step === undefined ? 1 : n.step, { min: 0.01 });
      return { el: h("div", {}, row("Mínimo", mn), row("Máximo", mx), row("Passo", st)), get: () => ({ min: Number(mn.value), max: Number(mx.value), step: Number(st.value) || 1 }) };
    }),
    help: `<p>Controle deslizante no dashboard. Ao mover, envia o número escolhido em <code>msg.payload</code>.</p><p>Também aceita uma mensagem de entrada para mudar a posição.</p>`,
  };
  TYPES.ui_gauge = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 1,
    outputs: 0,
    icon: "◠",
    defaults: () => ({ name: "", label: "medidor", group: "", min: 0, max: 100, units: "units", gtype: "gage" }),
    label: (n) => n.name || n.label || "gauge",
    valid: uiValid,
    form: uiForm((n) => {
      const mn = number(n.min === undefined ? 0 : n.min);
      const mx = number(n.max === undefined ? 100 : n.max);
      const un = text(n.units || "units");
      const tp = select([["gage", "Medidor"], ["donut", "Rosca"]], n.gtype || "gage");
      return { el: h("div", {}, row("Tipo", tp), row("Unidade", un), row("Mínimo", mn), row("Máximo", mx)), get: () => ({ min: Number(mn.value), max: Number(mx.value), units: un.value, gtype: tp.value }) };
    }),
    help: `<p>Mostra o <b>valor atual</b> de uma medição (temperatura, nível, velocidade). Espera um número em <code>msg.payload</code>.</p>`,
  };
  TYPES.ui_chart = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 1,
    outputs: 0,
    icon: "∿",
    defaults: () => ({ name: "", label: "gráfico", group: "" }),
    label: (n) => n.name || n.label || "chart",
    valid: uiValid,
    form: uiForm(),
    help: `<p>Gráfico de linhas com o <b>histórico</b> dos valores recebidos. Cada <code>msg.topic</code> diferente vira uma série.</p>`,
  };
  TYPES.ui_switch = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 1,
    outputs: 1,
    icon: "◐",
    defaults: () => ({ name: "", label: "chave", group: "", onvalue: "true", onvalueType: "bool", offvalue: "false", offvalueType: "bool", passthru: false }),
    label: (n) => n.name || n.label || "switch",
    valid: uiValid,
    form: uiForm((n) => {
      const on = typed(["bool", "str", "num"], n.onvalue, n.onvalueType || "bool");
      const off = typed(["bool", "str", "num"], n.offvalue, n.offvalueType || "bool");
      return {
        el: h("div", {}, row("Quando ligado", on), row("Quando desligado", off)),
        get: () => ({ onvalue: on.get().v, onvalueType: on.get().vt, offvalue: off.get().v, offvalueType: off.get().vt }),
      };
    }),
    help: `<p>Chave liga/desliga no dashboard. Representa um <b>estado</b>; ao clicar envia o valor de "ligado" ou "desligado".</p>`,
  };
  TYPES.ui_button = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 0,
    outputs: 1,
    icon: "▢",
    defaults: () => ({ name: "", label: "botão", group: "", payload: "", payloadType: "str", topic: "" }),
    label: (n) => n.name || n.label || "button",
    valid: uiValid,
    form: uiForm((n) => {
      const pay = typed(["str", "num", "bool", "json", "date"], n.payload, n.payloadType || "str");
      const topic = text(n.topic);
      return { el: h("div", {}, row("Payload", pay), row("Tópico", topic)), get: () => ({ payload: pay.get().v, payloadType: pay.get().vt, topic: topic.value }) };
    }),
    help: `<p>Botão no dashboard. Ao clicar, <b>inicia uma ação</b>: envia o payload configurado (ex.: <code>"ligar_ventilador"</code>).</p>`,
  };
  TYPES.ui_text = {
    cat: "dashboard",
    color: "#3fadb5",
    inputs: 1,
    outputs: 0,
    icon: "T",
    defaults: () => ({ name: "", label: "texto", group: "", format: "{{msg.payload}}" }),
    label: (n) => n.name || n.label || "text",
    valid: uiValid,
    form: uiForm((n) => {
      const f = text(n.format || "{{msg.payload}}");
      return { el: row("Formato", f), get: () => ({ format: f.value }) };
    }),
    help: `<p>Exibe um texto no dashboard. O formato aceita <code>{{msg.payload}}</code>.</p>`,
  };

  // ---- validação geral ----
  function isValid(n, nodes) {
    const d = TYPES[n.type];
    if (!d) return true;
    if (n.type === "mqtt in") return nodes.some((b) => b.id === n.broker && b.type === "mqtt-broker" && b.broker) && !!n.topic;
    if (n.type === "mqtt out") return nodes.some((b) => b.id === n.broker && b.type === "mqtt-broker" && b.broker);
    if (n.type === "switch") return (n.rules || []).length > 0;
    if (d.valid) return d.valid(n, nodes);
    return true;
  }

  window.NRTypes = { TYPES, CATEGORIES, isValid, groupLabel };
})();
