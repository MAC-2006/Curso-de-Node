/* Pequena biblioteca de DOM/formulários usada pelo editor do simulador. */
(function () {
  "use strict";

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === false || v === null || v === undefined) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === "value") el.value = v;
        else if (k === "checked") el.checked = !!v;
        else if (k === "disabled") el.disabled = !!v;
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  const SVG_NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, ...kids) {
    const el = document.createElementNS(SVG_NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v !== false && v !== null && v !== undefined) el.setAttribute(k, v);
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      el.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
    }
    return el;
  }

  let uidN = 0;
  const uid = () => (Date.now().toString(16).slice(-5) + (uidN++).toString(16).padStart(2, "0") + Math.random().toString(16).slice(2, 6)).slice(0, 12);

  function row(label, control, hint) {
    return h("div", { class: "nr-form-row" }, h("label", {}, label), h("div", { class: "nr-form-control" }, control, hint ? h("div", { class: "nr-hint" }, hint) : null));
  }

  function text(value, attrs) {
    return h("input", Object.assign({ type: "text", class: "nr-input", value: value === undefined || value === null ? "" : value, autocomplete: "off", spellcheck: "false" }, attrs || {}));
  }
  function number(value, attrs) {
    return h("input", Object.assign({ type: "number", class: "nr-input", value: value === undefined || value === null ? "" : value, step: "any" }, attrs || {}));
  }
  function select(options, value, attrs) {
    const el = h("select", Object.assign({ class: "nr-input" }, attrs || {}));
    for (const o of options) {
      const opt = Array.isArray(o) ? { v: o[0], l: o[1] } : { v: o, l: o };
      const node = h("option", { value: opt.v }, opt.l);
      if (String(opt.v) === String(value)) node.selected = true;
      el.appendChild(node);
    }
    return el;
  }
  function checkbox(label, checked) {
    const input = h("input", { type: "checkbox", checked: !!checked });
    const wrap = h("label", { class: "nr-check" }, input, h("span", {}, label));
    wrap.input = input;
    return wrap;
  }
  function textarea(value, rows, mono) {
    return h("textarea", { class: "nr-input" + (mono ? " nr-mono" : ""), rows: rows || 4, spellcheck: "false", autocomplete: "off", value: value || "" });
  }

  const TYPE_LABELS = {
    str: "texto",
    num: "número",
    bool: "booleano",
    json: "JSON",
    date: "timestamp",
    msg: "msg.",
    flow: "flow.",
    global: "global.",
    env: "env",
    pay: "payload original",
    nul: "nada",
  };

  // Campo "tipado" do Node-RED: [tipo ▾] [valor]
  function typed(types, value, type, attrs) {
    const sel = h("select", { class: "nr-input nr-typed-type" }, types.map((t) => h("option", { value: t }, TYPE_LABELS[t] || t)));
    sel.value = types.includes(type) ? type : types[0];
    const input = h("input", { type: "text", class: "nr-input nr-typed-val", autocomplete: "off", spellcheck: "false", value: value === undefined || value === null ? "" : String(value) });
    if (attrs && attrs.placeholder) input.placeholder = attrs.placeholder;
    const boolSel = h("select", { class: "nr-input nr-typed-val" }, h("option", { value: "true" }, "verdadeiro"), h("option", { value: "false" }, "falso"));
    boolSel.value = String(value) === "true" ? "true" : "false";
    const wrap = h("div", { class: "nr-typed" }, sel, input, boolSel);
    const refresh = () => {
      const t = sel.value;
      const noValue = t === "date" || t === "pay" || t === "nul";
      input.style.display = t === "bool" || noValue ? "none" : "";
      boolSel.style.display = t === "bool" ? "" : "none";
      if (t === "json") input.placeholder = '{"chave": "valor"}';
      else if (t === "msg") input.placeholder = "payload";
      else if (t === "flow" || t === "global") input.placeholder = "nome";
      else input.placeholder = (attrs && attrs.placeholder) || "";
    };
    sel.addEventListener("change", refresh);
    refresh();
    wrap.get = () => {
      const t = sel.value;
      let v = t === "bool" ? boolSel.value : input.value;
      if (t === "date" || t === "pay" || t === "nul") v = "";
      return { v, vt: t };
    };
    return wrap;
  }

  // Lista editável de linhas (usada em Change, Switch, headers, etc.)
  function listEditor(items, makeRow, makeNew, addLabel) {
    const box = h("div", { class: "nr-list" });
    const rows = [];
    function add(item) {
      const r = makeRow(item);
      const wrap = h("div", { class: "nr-list-item" }, r.el, h("button", { type: "button", class: "nr-icon-btn", title: "Remover", onclick: () => { const i = rows.indexOf(entry); rows.splice(i, 1); wrap.remove(); } }, "×"));
      const entry = { r, wrap };
      rows.push(entry);
      box.appendChild(wrap);
    }
    items.forEach(add);
    const addBtn = h("button", { type: "button", class: "nr-btn nr-btn-small", onclick: () => add(makeNew()) }, "+ " + (addLabel || "adicionar"));
    const root = h("div", {}, box, addBtn);
    root.get = () => rows.map((e) => e.r.get());
    return root;
  }

  function toast(host, message, kind) {
    const t = h("div", { class: "nr-toast " + (kind || "") }, message);
    host.appendChild(t);
    setTimeout(() => t.classList.add("show"), 10);
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 300);
    }, 3200);
  }

  window.NRKit = { h, s, uid, row, text, number, select, checkbox, textarea, typed, listEditor, toast, TYPE_LABELS };
})();
