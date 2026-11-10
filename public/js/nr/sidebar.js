/* Barra lateral do editor: Info, Debug, Dashboard (layout + painel), MQTT e Contexto. */
(function () {
  "use strict";
  const { h, s, uid } = NRKit;
  const { TYPES } = NRTypes;

  const pad = (n) => String(n).padStart(2, "0");
  const fmtTime = (t) => {
    const d = new Date(t);
    return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
  };

  function typeDesc(v) {
    if (v === null) return "null";
    if (v === undefined) return "undefined";
    if (typeof v === "string") return "string[" + v.length + "]";
    if (Array.isArray(v)) return "array[" + v.length + "]";
    if (typeof v === "object") return "Object";
    return typeof v;
  }

  function tree(v, key, depth) {
    if (v !== null && typeof v === "object") {
      const keys = Object.keys(v);
      const d = h("details", { class: "nr-tree", open: depth < 1 });
      d.appendChild(h("summary", {}, key !== null ? h("span", { class: "nr-k" }, key + ": ") : null, Array.isArray(v) ? "array[" + keys.length + "]" : "Object"));
      keys.forEach((k) => d.appendChild(tree(v[k], Array.isArray(v) ? "[" + k + "]" : k, depth + 1)));
      return d;
    }
    const cls = typeof v === "string" ? "nr-v-str" : typeof v === "number" ? "nr-v-num" : "nr-v-other";
    return h("div", { class: "nr-tree-leaf" }, key !== null ? h("span", { class: "nr-k" }, key + ": ") : null, h("span", { class: cls }, typeof v === "string" ? JSON.stringify(v) : String(v)));
  }

  function valueEl(v) {
    if (v !== null && typeof v === "object") return h("div", { class: "nr-dbg-value" }, tree(v, null, 0));
    if (typeof v === "string") return h("div", { class: "nr-dbg-value nr-v-str nr-pre" }, v);
    return h("div", { class: "nr-dbg-value " + (typeof v === "number" ? "nr-v-num" : "nr-v-other") }, String(v));
  }

  // ---------------------------------------------------------------- gauge / chart
  function polar(cx, cy, r, ang) {
    return [cx + r * Math.cos(ang), cy - r * Math.sin(ang)];
  }
  function arcPath(cx, cy, r, a0, a1) {
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    const large = Math.abs(a0 - a1) > Math.PI ? 1 : 0;
    return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`;
  }
  function gaugeSvg(ui) {
    const min = Number(ui.min), max = Number(ui.max);
    const v = ui.value === null || ui.value === undefined ? min : ui.value;
    const f = Math.max(0, Math.min(1, max === min ? 0 : (v - min) / (max - min)));
    const color = f < 0.5 ? "#2e9d4f" : f < 0.8 ? "#e8a323" : "#d9402f";
    const a1 = Math.PI - f * Math.PI;
    const svg = s("svg", { viewBox: "0 0 160 100", class: "nr-gauge" }, s("path", { d: arcPath(80, 82, 60, Math.PI, 0), fill: "none", stroke: "#e4e7eb", "stroke-width": 14, "stroke-linecap": "round" }));
    if (f > 0) svg.appendChild(s("path", { d: arcPath(80, 82, 60, Math.PI, a1), fill: "none", stroke: color, "stroke-width": 14, "stroke-linecap": "round" }));
    svg.appendChild(s("text", { x: 80, y: 78, "text-anchor": "middle", class: "nr-gauge-val" }, ui.value === null ? "–" : String(Math.round(v * 100) / 100)));
    svg.appendChild(s("text", { x: 80, y: 94, "text-anchor": "middle", class: "nr-gauge-units" }, ui.units || ""));
    svg.appendChild(s("text", { x: 14, y: 98, "text-anchor": "middle", class: "nr-gauge-lim" }, String(min)));
    svg.appendChild(s("text", { x: 146, y: 98, "text-anchor": "middle", class: "nr-gauge-lim" }, String(max)));
    return svg;
  }
  const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"];
  function chartSvg(ui) {
    const W = 280, H = 120, pl = 30, pr = 6, pt = 6, pb = 16;
    const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "nr-chart" });
    const all = Object.values(ui.series || {}).flat();
    if (!all.length) {
      svg.appendChild(s("text", { x: W / 2, y: H / 2, "text-anchor": "middle", class: "nr-gauge-units" }, "sem dados"));
      return svg;
    }
    let ymin = Math.min(...all.map((p) => p.y));
    let ymax = Math.max(...all.map((p) => p.y));
    if (ymin === ymax) {
      ymin -= 1;
      ymax += 1;
    }
    const tmin = Math.min(...all.map((p) => p.t));
    const tmax = Math.max(...all.map((p) => p.t), tmin + 1000);
    const X = (t) => pl + ((t - tmin) / (tmax - tmin)) * (W - pl - pr);
    const Y = (y) => pt + (1 - (y - ymin) / (ymax - ymin)) * (H - pt - pb);
    svg.appendChild(s("line", { x1: pl, y1: H - pb, x2: W - pr, y2: H - pb, stroke: "#c9ced6" }));
    svg.appendChild(s("line", { x1: pl, y1: pt, x2: pl, y2: H - pb, stroke: "#c9ced6" }));
    svg.appendChild(s("text", { x: pl - 3, y: pt + 8, "text-anchor": "end", class: "nr-gauge-lim" }, String(Math.round(ymax * 10) / 10)));
    svg.appendChild(s("text", { x: pl - 3, y: H - pb, "text-anchor": "end", class: "nr-gauge-lim" }, String(Math.round(ymin * 10) / 10)));
    Object.keys(ui.series).forEach((name, i) => {
      const pts = ui.series[name].map((p) => X(p.t).toFixed(1) + "," + Y(p.y).toFixed(1)).join(" ");
      svg.appendChild(s("polyline", { points: pts, fill: "none", stroke: COLORS[i % COLORS.length], "stroke-width": 2 }));
    });
    return svg;
  }

  // ===================================================================== create
  function create(api) {
    const exam = api.exam;
    const root = h("aside", { class: "nr-sidebar" });
    const tabsBar = h("div", { class: "nr-side-tabs" });
    const panes = {};
    const tabBtns = {};
    let active = "info";

    function addTab(id, label) {
      const pane = h("div", { class: "nr-side-pane" + (id === "info" ? " active" : "") });
      const btn = h("button", { type: "button", class: "nr-side-tab" + (id === "info" ? " active" : ""), onclick: () => show(id) }, label, h("span", { class: "nr-badge hidden" }));
      panes[id] = pane;
      tabBtns[id] = btn;
      tabsBar.appendChild(btn);
      root.appendChild(pane);
    }
    function show(id) {
      active = id;
      Object.keys(panes).forEach((k) => {
        panes[k].classList.toggle("active", k === id);
        tabBtns[k].classList.toggle("active", k === id);
      });
      const b = tabBtns[id].querySelector(".nr-badge");
      b.classList.add("hidden");
      b.textContent = "";
      b._n = 0;
      if (id === "context") refreshContext();
      if (id === "dashboard") renderDashboard();
    }
    function bump(id) {
      if (active === id) return;
      const b = tabBtns[id].querySelector(".nr-badge");
      b._n = (b._n || 0) + 1;
      b.textContent = b._n > 99 ? "99+" : b._n;
      b.classList.remove("hidden");
    }

    root.appendChild(tabsBar);
    addTab("info", "Info");
    addTab("debug", "Debug");
    addTab("dashboard", "Dashboard");
    addTab("mqtt", "MQTT");
    addTab("context", "Contexto");

    // ------------------------------------------------------------------- INFO
    const infoChallenge = h("div", { class: "nr-info-challenge" });
    const infoHelp = h("div", { class: "nr-help" });
    panes.info.appendChild(infoChallenge);
    panes.info.appendChild(infoHelp);
    let resultState = null;

    function renderChallenge() {
      infoChallenge.innerHTML = "";
      const d = api.challenge;
      if (!d) return;
      infoChallenge.appendChild(h("h3", {}, d.titulo));
      String(d.enunciado || "")
        .split(/\n\n+/)
        .forEach((p) => infoChallenge.appendChild(h("p", {}, p)));
      infoChallenge.appendChild(h("h4", {}, "Requisitos"));
      const ul = h("ul", { class: "nr-req" });
      (d.requisitos || []).forEach((r) => {
        const res = resultState && resultState.requisitos && resultState.requisitos.find((x) => x.id === r.id);
        const cls = res ? (res.ok ? "ok" : "fail") : "";
        ul.appendChild(h("li", { class: cls }, h("span", { class: "nr-req-mark" }, res ? (res.ok ? "✓" : "✗") : "○"), h("div", {}, h("div", {}, r.texto), res && !res.ok && res.detalhe ? h("div", { class: "nr-req-detail" }, res.detalhe) : null)));
      });
      infoChallenge.appendChild(ul);
      if (d.dicas && d.dicas.length) {
        infoChallenge.appendChild(h("details", { class: "nr-hints" }, h("summary", {}, "Dicas"), h("ul", {}, d.dicas.map((x) => h("li", {}, x)))));
      }
      infoChallenge.appendChild(h("div", { class: "nr-info-rules" }, "⚠ Modo prova: colar e sair desta tela são bloqueados e registrados."));
    }
    function setSelection(node) {
      infoHelp.innerHTML = "";
      if (!node) {
        if (!exam) infoHelp.innerHTML = '<h3>Bem-vindo ao simulador</h3><p>Arraste nodes da paleta (à esquerda) para a área de trabalho, ligue-os puxando o fio de uma saída até uma entrada, dê <b>duplo clique</b> para configurar e clique em <b>Deploy</b>.</p><p>Clique no quadrado à esquerda do node <b>inject</b> para disparar o fluxo e veja o resultado na aba <b>Debug</b>.</p><p>Selecione um node para ver a ajuda dele aqui.</p>';
        return;
      }
      const d = TYPES[node.type];
      if (!d) return;
      infoHelp.appendChild(h("h3", {}, node.type));
      infoHelp.appendChild(h("div", { html: d.help || "" }));
    }

    // ------------------------------------------------------------------ DEBUG
    const dbgBar = h(
      "div",
      { class: "nr-pane-bar" },
      h("button", { type: "button", class: "nr-btn nr-btn-small", onclick: () => (dbgList.innerHTML = "") }, "Limpar"),
      h("span", { class: "nr-muted" }, "mensagens dos nodes debug")
    );
    const dbgList = h("div", { class: "nr-dbg-list" });
    panes.debug.appendChild(dbgBar);
    panes.debug.appendChild(dbgList);

    function onDebug(e) {
      const stick = dbgList.scrollTop + dbgList.clientHeight >= dbgList.scrollHeight - 30;
      const div = h("div", { class: "nr-dbg " + e.level });
      div.appendChild(h("div", { class: "nr-dbg-head" }, h("span", { class: "nr-dbg-time" }, fmtTime(e.time)), e.nodeId ? h("a", { class: "nr-dbg-node", href: "#", onclick: (ev) => { ev.preventDefault(); api.selectNode(e.nodeId); } }, e.name || "") : null));
      if (e.level === "info" && e.property) {
        div.appendChild(h("div", { class: "nr-dbg-prop" }, e.property + " : " + typeDesc(e.value)));
        div.appendChild(valueEl(e.value));
      } else div.appendChild(h("div", { class: "nr-dbg-text" }, (e.level === "error" ? "" : "") + String(e.text !== undefined ? e.text : e.value)));
      dbgList.appendChild(div);
      while (dbgList.children.length > 300) dbgList.firstChild.remove();
      if (stick) dbgList.scrollTop = dbgList.scrollHeight;
      bump("debug");
    }

    // -------------------------------------------------------------- DASHBOARD
    const dashSub = h("div", { class: "nr-subtabs" });
    const dashLayout = h("div", { class: "nr-dash-layout" });
    const dashPanel = h("div", { class: "nr-dash-panel hidden" });
    let dashMode = "layout";
    const subBtn = (id, label) => h("button", { type: "button", class: "nr-subtab" + (id === dashMode ? " active" : ""), onclick: () => { dashMode = id; renderDashboard(); } }, label);
    panes.dashboard.appendChild(dashSub);
    panes.dashboard.appendChild(dashLayout);
    panes.dashboard.appendChild(dashPanel);

    let selTab = null;
    function renderDashboard() {
      dashSub.innerHTML = "";
      dashSub.appendChild(subBtn("layout", "Layout"));
      dashSub.appendChild(subBtn("panel", "Painel (/ui)"));
      dashLayout.classList.toggle("hidden", dashMode !== "layout");
      dashPanel.classList.toggle("hidden", dashMode !== "panel");
      if (dashMode === "layout") renderLayout();
      else renderPanel();
    }

    function renderLayout() {
      const nodes = api.getNodes();
      const tabs = nodes.filter((n) => n.type === "ui_tab");
      const groups = nodes.filter((n) => n.type === "ui_group");
      dashLayout.innerHTML = "";
      dashLayout.appendChild(h("p", { class: "nr-muted" }, "O dashboard é organizado em Abas (páginas) e Grupos (blocos dentro da aba). Todo node de dashboard precisa estar em um grupo."));
      const newTab = h("input", { class: "nr-input", placeholder: "Nome da nova aba" });
      dashLayout.appendChild(h("div", { class: "nr-inline" }, newTab, h("button", { type: "button", class: "nr-btn nr-btn-small", onclick: () => { const name = newTab.value.trim(); if (!name) return; api.addConfig({ id: uid(), type: "ui_tab", name }); renderLayout(); } }, "+ Aba")));
      if (!tabs.length) dashLayout.appendChild(h("p", { class: "nr-muted" }, "Nenhuma aba criada ainda."));
      tabs.forEach((t) => {
        const card = h("div", { class: "nr-tab-card" });
        const nameIn = h("input", { class: "nr-input", value: t.name });
        nameIn.addEventListener("change", () => api.updateConfig(t.id, { name: nameIn.value.trim() || t.name }));
        card.appendChild(h("div", { class: "nr-inline" }, h("strong", {}, "Aba"), nameIn, h("button", { type: "button", class: "nr-icon-btn", title: "Excluir aba", onclick: () => { api.removeConfig(t.id); renderLayout(); } }, "×")));
        groups.filter((g) => g.tab === t.id).forEach((g) => {
          const gi = h("input", { class: "nr-input", value: g.name });
          gi.addEventListener("change", () => api.updateConfig(g.id, { name: gi.value.trim() || g.name }));
          card.appendChild(h("div", { class: "nr-inline nr-group-row" }, "▸ Grupo", gi, h("button", { type: "button", class: "nr-icon-btn", title: "Excluir grupo", onclick: () => { api.removeConfig(g.id); renderLayout(); } }, "×")));
        });
        const ng = h("input", { class: "nr-input", placeholder: "Novo grupo nesta aba" });
        card.appendChild(h("div", { class: "nr-inline" }, ng, h("button", { type: "button", class: "nr-btn nr-btn-small", onclick: () => { const name = ng.value.trim(); if (!name) return; api.addConfig({ id: uid(), type: "ui_group", name, tab: t.id }); renderLayout(); } }, "+ Grupo")));
        dashLayout.appendChild(card);
      });
      dashLayout.appendChild(h("p", { class: "nr-muted" }, "Depois de criar, abra o node (duplo clique) e escolha o Grupo."));
    }

    let panelPending = false;
    function schedulePanel() {
      if (panelPending) return;
      panelPending = true;
      requestAnimationFrame(() => {
        panelPending = false;
        if (dashMode === "panel") renderPanel();
      });
    }
    let panelTab = null;
    function renderPanel() {
      const sim = api.getSim();
      dashPanel.innerHTML = "";
      if (!sim) {
        dashPanel.appendChild(h("p", { class: "nr-muted" }, "Faça o Deploy para ver o dashboard funcionando (equivale a abrir http://127.0.0.1:1880/ui)."));
        return;
      }
      // não recria o painel enquanto o usuário arrasta um slider
      const nodes = api.getNodes();
      const tabs = nodes.filter((n) => n.type === "ui_tab" && sim.configs[n.id]);
      if (!tabs.length) {
        dashPanel.appendChild(h("p", { class: "nr-muted" }, "Nenhuma aba no dashboard ainda. Crie uma aba e um grupo em Layout."));
        return;
      }
      if (!panelTab || !tabs.find((t) => t.id === panelTab)) panelTab = tabs[0].id;
      const strip = h("div", { class: "nr-ui-tabs" }, tabs.map((t) => h("button", { type: "button", class: "nr-ui-tab" + (t.id === panelTab ? " active" : ""), onclick: () => { panelTab = t.id; renderPanel(); } }, t.name)));
      dashPanel.appendChild(strip);
      const groups = nodes.filter((g) => g.type === "ui_group" && g.tab === panelTab);
      if (!groups.length) dashPanel.appendChild(h("p", { class: "nr-muted" }, "Esta aba ainda não tem grupos."));
      groups.forEach((g) => {
        const card = h("div", { class: "nr-ui-group" }, h("div", { class: "nr-ui-group-title" }, g.name));
        const widgets = Object.values(sim.state.ui).filter((u) => u.group === g.id);
        if (!widgets.length) card.appendChild(h("div", { class: "nr-muted" }, "(vazio)"));
        widgets.forEach((u) => card.appendChild(widget(sim, u)));
        dashPanel.appendChild(card);
      });
    }

    function widget(sim, u) {
      const wrap = h("div", { class: "nr-widget nr-widget-" + u.type });
      const label = h("div", { class: "nr-widget-label" }, u.label || "");
      if (u.type === "ui_slider") {
        const val = h("span", { class: "nr-widget-val" }, String(u.value));
        const input = h("input", { type: "range", min: u.min, max: u.max, step: u.step, value: u.value });
        input.addEventListener("input", () => (val.textContent = input.value));
        input.addEventListener("change", () => sim.uiInput(u.id, Number(input.value)));
        wrap.appendChild(h("div", { class: "nr-widget-row" }, label, val));
        wrap.appendChild(input);
      } else if (u.type === "ui_gauge") {
        wrap.appendChild(label);
        wrap.appendChild(gaugeSvg(u));
      } else if (u.type === "ui_chart") {
        wrap.appendChild(label);
        wrap.appendChild(chartSvg(u));
      } else if (u.type === "ui_switch") {
        const input = h("input", { type: "checkbox", checked: !!u.value });
        input.addEventListener("change", () => sim.uiInput(u.id, input.checked));
        wrap.appendChild(h("label", { class: "nr-widget-row nr-switch" }, label, h("span", { class: "nr-toggle" }, input, h("span", { class: "nr-toggle-track" }))));
      } else if (u.type === "ui_button") {
        wrap.appendChild(h("button", { type: "button", class: "nr-ui-button", onclick: () => sim.uiInput(u.id) }, u.label || "botão"));
      } else if (u.type === "ui_text") {
        wrap.appendChild(h("div", { class: "nr-widget-row" }, label, h("span", { class: "nr-widget-val" }, String(u.value === null ? "" : u.value))));
      }
      return wrap;
    }
    function onUi() {
      if (dashMode === "panel" && active === "dashboard") {
        // evita recriar o painel no meio do arraste de um slider
        if (dashPanel.querySelector("input:active")) return;
        schedulePanel();
      }
    }

    // --------------------------------------------------------------------- MQTT
    const mqttForm = h("div", { class: "nr-mqtt-form" });
    const mqttLog = h("div", { class: "nr-mqtt-log" });
    panes.mqtt.appendChild(mqttForm);
    panes.mqtt.appendChild(h("div", { class: "nr-section" }, "Mensagens no broker"));
    panes.mqtt.appendChild(mqttLog);
    let sensorTimer = null;
    let sensorValue = 29;
    const brokerSel = h("select", { class: "nr-input" });
    const topicIn = h("input", { class: "nr-input", value: "estufa/sensorDHT", spellcheck: "false" });
    const payloadIn = h("textarea", { class: "nr-input nr-mono", rows: 3, spellcheck: "false" }, '{"temperatura": 30, "umidade": 60}');
    const sensorTopic = h("input", { class: "nr-input", value: "estufa/sensorDHT", spellcheck: "false" });
    const sensorEvery = h("input", { class: "nr-input nr-short", type: "number", min: 1, value: 3 });
    const sensorChk = h("input", { type: "checkbox" });

    function refreshBrokers() {
      const keys = new Set(["test.mosquitto.org:1883"]);
      api.getNodes().filter((n) => n.type === "mqtt-broker" && n.broker).forEach((b) => keys.add(b.broker + ":" + (b.port || 1883)));
      const cur = brokerSel.value;
      brokerSel.innerHTML = "";
      keys.forEach((k) => brokerSel.appendChild(h("option", { value: k }, k)));
      if (cur && keys.has(cur)) brokerSel.value = cur;
    }
    function publish(topic, payload) {
      const sim = api.getSim();
      if (!sim) {
        api.toast("Faça o Deploy antes de publicar mensagens.", "warn");
        return false;
      }
      sim.mqttPublish(topic, payload, brokerSel.value);
      return true;
    }
    function stopSensor() {
      if (sensorTimer) clearInterval(sensorTimer);
      sensorTimer = null;
      sensorChk.checked = false;
    }
    function startSensor() {
      if (sensorTimer) clearInterval(sensorTimer);
      const sim = api.getSim();
      if (!sim) {
        api.toast("Faça o Deploy antes de ligar o sensor.", "warn");
        sensorChk.checked = false;
        return;
      }
      const ms = Math.max(1, Number(sensorEvery.value) || 3) * 1000;
      sensorTimer = setInterval(() => {
        sensorValue = Math.max(22, Math.min(42, sensorValue + (Math.random() - 0.42) * 3));
        const body = JSON.stringify({ temperatura: Math.round(sensorValue * 10) / 10, umidade: Math.round(45 + Math.random() * 30) });
        const s2 = api.getSim();
        if (s2) s2.mqttPublish(sensorTopic.value.trim(), body, brokerSel.value);
      }, ms);
    }
    sensorChk.addEventListener("change", () => (sensorChk.checked ? startSensor() : stopSensor()));
    mqttForm.appendChild(h("p", { class: "nr-muted" }, "Simula um dispositivo (ESP32/Arduino) e um cliente MQTT Explorer. Publique mensagens para o seu fluxo e veja o que ele publica de volta."));
    mqttForm.appendChild(h("div", { class: "nr-form-row" }, h("label", {}, "Broker"), brokerSel));
    mqttForm.appendChild(h("div", { class: "nr-form-row" }, h("label", {}, "Tópico"), topicIn));
    mqttForm.appendChild(h("div", { class: "nr-form-row" }, h("label", {}, "Mensagem"), payloadIn));
    mqttForm.appendChild(h("button", { type: "button", class: "nr-btn nr-btn-primary", onclick: () => publish(topicIn.value.trim(), payloadIn.value) }, "Publicar"));
    mqttForm.appendChild(h("div", { class: "nr-section" }, "Sensor virtual"));
    mqttForm.appendChild(h("div", { class: "nr-inline" }, h("label", { class: "nr-check" }, sensorChk, h("span", {}, "ligar")), "a cada", sensorEvery, "s em", sensorTopic));
    refreshBrokers();

    function onMqtt(e) {
      const div = h("div", { class: "nr-mqtt-msg" }, h("div", { class: "nr-mqtt-head" }, h("span", { class: "nr-dbg-time" }, fmtTime(e.time)), h("span", { class: "nr-mqtt-src" }, e.source), h("span", { class: "nr-muted" }, e.broker)), h("div", { class: "nr-mqtt-topic" }, e.topic), h("div", { class: "nr-mqtt-payload" }, e.payload));
      const stick = mqttLog.scrollTop + mqttLog.clientHeight >= mqttLog.scrollHeight - 30;
      mqttLog.appendChild(div);
      while (mqttLog.children.length > 200) mqttLog.firstChild.remove();
      if (stick) mqttLog.scrollTop = mqttLog.scrollHeight;
      bump("mqtt");
    }

    // ----------------------------------------------------------------- CONTEXT
    const ctxBox = h("div", { class: "nr-context" });
    panes.context.appendChild(h("div", { class: "nr-pane-bar" }, h("button", { type: "button", class: "nr-btn nr-btn-small", onclick: () => refreshContext() }, "Atualizar"), h("span", { class: "nr-muted" }, "valores guardados com flow.set / global.set")));
    panes.context.appendChild(ctxBox);
    function refreshContext() {
      const sim = api.getSim();
      ctxBox.innerHTML = "";
      if (!sim) {
        ctxBox.appendChild(h("p", { class: "nr-muted" }, "Faça o Deploy para ver o contexto."));
        return;
      }
      ctxBox.appendChild(h("h4", {}, "Fluxo (flow)"));
      ctxBox.appendChild(Object.keys(sim.state.flowCtx).length ? tree(sim.state.flowCtx, null, 0) : h("p", { class: "nr-muted" }, "(vazio)"));
      ctxBox.appendChild(h("h4", {}, "Global"));
      ctxBox.appendChild(Object.keys(sim.state.globalCtx).length ? tree(sim.state.globalCtx, null, 0) : h("p", { class: "nr-muted" }, "(vazio)"));
    }
    const ctxTimer = setInterval(() => {
      if (active === "context") refreshContext();
    }, 1500);

    renderChallenge();
    setSelection(null);

    return {
      el: root,
      show,
      onDebug,
      onUi,
      onMqtt,
      setSelection,
      showResults(r) {
        resultState = r;
        renderChallenge();
        show("info");
      },
      onDeploy() {
        refreshBrokers();
        if (active === "dashboard") renderDashboard();
        if (active === "context") refreshContext();
      },
      layoutChanged() {
        if (active === "dashboard") renderDashboard();
      },
      clearDebug() {
        dbgList.innerHTML = "";
      },
      destroy() {
        clearInterval(ctxTimer);
        stopSensor();
      },
    };
  }

  window.NRSidebar = { create };
})();
