/* ============================================================================
 * NRSim — motor de simulação do Node-RED
 *
 * Arquivo compartilhado: roda no NAVEGADOR (editor do aluno) e no SERVIDOR
 * (juiz que corrige os desafios). Por isso não depende de DOM nem de Node.
 *
 * O que simula (comportamento igual ao Node-RED 3.x para o que o curso ensina):
 *   inject, debug, change, switch, function, template (mustache), delay,
 *   trigger, json, catch, comment, http request (API simulada),
 *   mqtt in / mqtt out (broker simulado) e o Dashboard
 *   (slider, gauge, chart, switch, button, text).
 *
 * Tempo: relógio "real" (com aceleração opcional) ou "virtual" (usado pelo juiz,
 * que avança 30 s de simulação em milissegundos).
 *
 * A execução do código dos nodes Function é delegada a `opts.runFunction`, pois
 * cada ambiente isola o JavaScript do aluno de um jeito (Web Worker / QuickJS).
 * ========================================================================== */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.NRSim = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------------ utils
  const isObj = (v) => v !== null && typeof v === "object";

  function deepClone(v) {
    if (Array.isArray(v)) return v.map(deepClone);
    if (v instanceof Date) return new Date(v.getTime());
    if (isObj(v)) {
      const o = {};
      for (const k of Object.keys(v)) o[k] = deepClone(v[k]);
      return o;
    }
    return v;
  }

  // "payload[0].a['b']" -> ["payload", 0, "a", "b"]
  function parsePath(p) {
    const out = [];
    const re = /([^.\[\]]+)|\[(\d+)\]|\["([^"]*)"\]|\['([^']*)'\]/g;
    let m;
    while ((m = re.exec(String(p)))) {
      if (m[1] !== undefined) out.push(m[1]);
      else if (m[2] !== undefined) out.push(Number(m[2]));
      else out.push(m[3] !== undefined ? m[3] : m[4]);
    }
    return out;
  }
  function getByPath(obj, path) {
    const parts = parsePath(path);
    let cur = obj;
    for (const k of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[k];
    }
    return cur;
  }
  function setByPath(obj, path, value) {
    const parts = parsePath(path);
    if (!parts.length) return;
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (!isObj(cur[k])) cur[k] = typeof parts[i + 1] === "number" ? [] : {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
  }
  function deleteByPath(obj, path) {
    const parts = parsePath(path);
    if (!parts.length) return;
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      cur = cur && cur[parts[i]];
      if (!isObj(cur)) return;
    }
    const last = parts[parts.length - 1];
    if (Array.isArray(cur) && typeof last === "number") cur.splice(last, 1);
    else delete cur[last];
  }

  let idCounter = 0;
  const msgId = () => (Date.now().toString(16) + (idCounter++).toString(16) + Math.random().toString(16).slice(2, 6)).slice(-16);

  function safeStringify(v) {
    try {
      if (typeof v === "string") return v;
      return JSON.stringify(v);
    } catch (e) {
      return String(v);
    }
  }

  // ---------------------------------------------------------------- mustache
  const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;" };
  const escapeHtml = (s) => String(s).replace(/[&<>"'`=\/]/g, (c) => ESC[c]);

  function mustacheTokens(tpl) {
    const re = /\{\{\{\s*([^}]+?)\s*\}\}\}|\{\{\s*([#^\/&!]?)\s*([^}]*?)\s*\}\}/g;
    const root = { type: "root", children: [] };
    const stack = [root];
    let last = 0;
    let m;
    while ((m = re.exec(tpl))) {
      const top = stack[stack.length - 1];
      if (m.index > last) top.children.push({ type: "text", value: tpl.slice(last, m.index) });
      last = re.lastIndex;
      if (m[1] !== undefined) top.children.push({ type: "raw", name: m[1] });
      else {
        const sigil = m[2];
        const name = m[3];
        if (sigil === "#" || sigil === "^") {
          const sec = { type: sigil === "#" ? "section" : "inverted", name, children: [] };
          top.children.push(sec);
          stack.push(sec);
        } else if (sigil === "/") {
          if (stack.length > 1) stack.pop();
        } else if (sigil === "&") top.children.push({ type: "raw", name });
        else if (sigil === "!") {
          /* comentário */
        } else top.children.push({ type: "var", name });
      }
    }
    if (last < tpl.length) stack[stack.length - 1].children.push({ type: "text", value: tpl.slice(last) });
    return root;
  }
  function mustacheLookup(stack, name) {
    if (name === ".") return stack[stack.length - 1];
    const parts = name.split(".");
    const first = parts[0];
    for (let i = stack.length - 1; i >= 0; i--) {
      const ctx = stack[i];
      if (isObj(ctx) && first in ctx) {
        let v = ctx[first];
        for (let j = 1; j < parts.length; j++) {
          if (v === null || v === undefined) return undefined;
          v = v[parts[j]];
        }
        return v;
      }
    }
    return undefined;
  }
  function mustacheRender(node, stack) {
    let out = "";
    for (const c of node.children) {
      if (c.type === "text") out += c.value;
      else if (c.type === "var") {
        const v = mustacheLookup(stack, c.name);
        out += v === null || v === undefined ? "" : escapeHtml(v);
      } else if (c.type === "raw") {
        const v = mustacheLookup(stack, c.name);
        out += v === null || v === undefined ? "" : String(v);
      } else if (c.type === "section") {
        const v = mustacheLookup(stack, c.name);
        if (Array.isArray(v)) v.forEach((item) => (out += mustacheRender(c, stack.concat([item]))));
        else if (v) out += mustacheRender(c, stack.concat([v]));
      } else if (c.type === "inverted") {
        const v = mustacheLookup(stack, c.name);
        if (!v || (Array.isArray(v) && v.length === 0)) out += mustacheRender(c, stack);
      }
    }
    return out;
  }
  function renderMustache(tpl, ctx) {
    return mustacheRender(mustacheTokens(String(tpl)), [ctx]);
  }

  // ------------------------------------------------------- sandbox da Function
  // Script executado dentro do sandbox (QuickJS no servidor, Worker no navegador).
  // Recebe `__INPUT` (string JSON) e devolve uma string JSON.
  function buildFunctionScript(code) {
    return (
      "var self=undefined,fetch=undefined,XMLHttpRequest=undefined,importScripts=undefined,postMessage=undefined,WebSocket=undefined,indexedDB=undefined,localStorage=undefined,document=undefined,window=undefined;\n" +
      "var __IN = JSON.parse(__INPUT);\n" +
      "var __logs = [], __sent = [], __status = null, __result;\n" +
      "var __str = function(v){ if (typeof v === 'string') return v; try { return JSON.stringify(v); } catch(e) { return String(v); } };\n" +
      "var __parts = function(k){ return String(k).replace(/\\[(\\d+)\\]/g, '.$1').split('.'); };\n" +
      "var __get = function(s, k){ var p = __parts(k), c = s; for (var i=0;i<p.length;i++){ if (c===null||c===undefined) return undefined; c = c[p[i]]; } return c; };\n" +
      "var __set = function(s, k, v){ var p = __parts(k), c = s; for (var i=0;i<p.length-1;i++){ if (c[p[i]]===null||typeof c[p[i]]!=='object') c[p[i]] = isNaN(Number(p[i+1])) ? {} : []; c = c[p[i]]; } if (v===undefined) delete c[p[p.length-1]]; else c[p[p.length-1]] = v; };\n" +
      "var __mk = function(s){ return { get: function(k){ if (Array.isArray(k)) return k.map(function(x){ return __get(s,x); }); return __get(s,k); }, set: function(k,v){ if (Array.isArray(k)) { k.forEach(function(x,i){ __set(s,x,Array.isArray(v)?v[i]:undefined); }); } else { __set(s,k,v); } }, keys: function(){ return Object.keys(s); } }; };\n" +
      "var flow = __mk(__IN.flow), global = __mk(__IN.global), context = __mk(__IN.nodeCtx);\n" +
      "context.flow = flow; context.global = global;\n" +
      "var env = { get: function(n){ return __IN.env ? __IN.env[n] : undefined; } };\n" +
      "var RED = { util: { cloneMessage: function(m){ return JSON.parse(JSON.stringify(m)); }, generateId: function(){ return Math.random().toString(16).slice(2,10); } } };\n" +
      "var node = {\n" +
      "  id: __IN.node.id, name: __IN.node.name,\n" +
      "  log: function(m){ __logs.push({level:'log', text:__str(m)}); },\n" +
      "  warn: function(m){ __logs.push({level:'warn', text:__str(m)}); },\n" +
      "  error: function(m, msg){ var e = {level:'error', text:__str(m)}; if (msg && typeof msg === 'object') e.msg = msg; __logs.push(e); },\n" +
      "  debug: function(m){ __logs.push({level:'debug', text:__str(m)}); },\n" +
      "  trace: function(m){ __logs.push({level:'trace', text:__str(m)}); },\n" +
      "  send: function(m){ __sent.push(m); },\n" +
      "  done: function(){}, on: function(){}, status: function(s){ __status = s; }\n" +
      "};\n" +
      "var console = { log: function(){ __logs.push({level:'log', text:Array.prototype.map.call(arguments, __str).join(' ')}); }, warn: function(){ __logs.push({level:'warn', text:Array.prototype.map.call(arguments, __str).join(' ')}); }, error: function(){ __logs.push({level:'warn', text:Array.prototype.map.call(arguments, __str).join(' ')}); }, info: function(){ __logs.push({level:'log', text:Array.prototype.map.call(arguments, __str).join(' ')}); } };\n" +
      "var __noTimer = function(){ throw new Error('setTimeout/setInterval não são suportados no simulador. Use o node Delay ou Trigger para esperar.'); };\n" +
      "var setTimeout = __noTimer, setInterval = __noTimer, setImmediate = __noTimer;\n" +
      "var msg = __IN.msg;\n" +
      "try {\n" +
      "  var __ret = (function(){\n" +
      code +
      "\n  })();\n" +
      "  __result = JSON.stringify({ ret: __ret === undefined ? null : __ret, sent: __sent, logs: __logs, flow: __IN.flow, global: __IN.global, nodeCtx: __IN.nodeCtx, status: __status });\n" +
      "} catch (e) {\n" +
      "  __result = JSON.stringify({ error: (e && e.name ? e.name + ': ' : '') + (e && e.message !== undefined ? e.message : String(e)), logs: __logs });\n" +
      "}\n" +
      "__result;"
    );
  }

  // ------------------------------------------------------------------- relógios
  function virtualClock(start) {
    let time = start || Date.parse("2026-01-05T12:00:00Z");
    let seq = 0;
    let timers = [];
    return {
      virtual: true,
      now: () => time,
      parts: (ts) => {
        const d = new Date(ts);
        return { min: d.getUTCMinutes(), hour: d.getUTCHours(), dow: d.getUTCDay() };
      },
      setTimeout(fn, ms) {
        const t = { id: ++seq, at: time + Math.max(0, ms), seq, fn };
        timers.push(t);
        return t.id;
      },
      clearTimeout(id) {
        timers = timers.filter((t) => t.id !== id);
      },
      // devolve o próximo timer até `limit` (ou null)
      next(limit) {
        let best = null;
        for (const t of timers) if (t.at <= limit && (!best || t.at < best.at || (t.at === best.at && t.seq < best.seq))) best = t;
        if (!best) return null;
        timers = timers.filter((t) => t !== best);
        time = Math.max(time, best.at);
        return best;
      },
      setTime(t) {
        time = t;
      },
      clear() {
        timers = [];
      },
    };
  }

  function realClock() {
    const started = Date.now();
    let anchorReal = started;
    let anchorSim = started;
    let speed = 1;
    const ids = new Set();
    const api = {
      virtual: false,
      get speed() {
        return speed;
      },
      setSpeed(s) {
        anchorSim = api.now();
        anchorReal = Date.now();
        speed = s || 1;
      },
      now: () => anchorSim + (Date.now() - anchorReal) * speed,
      parts: (ts) => {
        const d = new Date(ts);
        return { min: d.getMinutes(), hour: d.getHours(), dow: d.getDay() };
      },
      setTimeout(fn, ms) {
        const id = setTimeout(() => {
          ids.delete(id);
          fn();
        }, Math.max(0, ms) / speed);
        ids.add(id);
        return id;
      },
      clearTimeout(id) {
        ids.delete(id);
        clearTimeout(id);
      },
      clear() {
        ids.forEach((i) => clearTimeout(i));
        ids.clear();
      },
    };
    return api;
  }

  // ----------------------------------------------------------- API simulada (HTTP)
  const USERS = [
    { id: 1, name: "Leanne Graham", username: "Bret", email: "Sincere@april.biz", address: { street: "Kulas Light", suite: "Apt. 556", city: "Gwenborough", zipcode: "92998-3874", geo: { lat: "-37.3159", lng: "81.1496" } }, phone: "1-770-736-8031 x56442", website: "hildegard.org", company: { name: "Romaguera-Crona", catchPhrase: "Multi-layered client-server neural-net", bs: "harness real-time e-markets" } },
    { id: 2, name: "Ervin Howell", username: "Antonette", email: "Shanna@melissa.tv", address: { street: "Victor Plains", suite: "Suite 879", city: "Wisokyburgh", zipcode: "90566-7771", geo: { lat: "-43.9509", lng: "-34.4618" } }, phone: "010-692-6593 x09125", website: "anastasia.net", company: { name: "Deckow-Crist", catchPhrase: "Proactive didactic contingency", bs: "synergize scalable supply-chains" } },
    { id: 3, name: "Clementine Bauch", username: "Samantha", email: "Nathan@yesenia.net", address: { street: "Douglas Extension", suite: "Suite 847", city: "McKenziehaven", zipcode: "59590-4157", geo: { lat: "-68.6102", lng: "-47.0653" } }, phone: "1-463-123-4447", website: "ramiro.info", company: { name: "Romaguera-Jacobson", catchPhrase: "Face to face bifurcated interface", bs: "e-enable strategic applications" } },
    { id: 4, name: "Patricia Lebsack", username: "Karianne", email: "Julianne.OConner@kory.org", address: { street: "Hoeger Mall", suite: "Apt. 692", city: "South Elvis", zipcode: "53919-4257", geo: { lat: "29.4572", lng: "-164.2990" } }, phone: "493-170-9623 x156", website: "kale.biz", company: { name: "Robel-Corkery", catchPhrase: "Multi-tiered zero tolerance productivity", bs: "transition cutting-edge web services" } },
    { id: 5, name: "Chelsey Dietrich", username: "Kamren", email: "Lucio_Hettinger@annie.ca", address: { street: "Skiles Walks", suite: "Suite 351", city: "Roscoeview", zipcode: "33263", geo: { lat: "-31.8129", lng: "62.5342" } }, phone: "(254)954-1289", website: "demarco.info", company: { name: "Keebler LLC", catchPhrase: "User-centric fault-tolerant solution", bs: "revolutionize end-to-end systems" } },
  ];
  const TODOS = [
    { userId: 1, id: 1, title: "delectus aut autem", completed: false },
    { userId: 1, id: 2, title: "quis ut nam facilis et officia qui", completed: false },
    { userId: 1, id: 3, title: "fugiat veniam minus", completed: false },
    { userId: 1, id: 4, title: "et porro tempora", completed: true },
    { userId: 1, id: 5, title: "laboriosam mollitia et enim quasi adipisci quia provident illum", completed: false },
  ];
  const POSTS = [
    { userId: 1, id: 1, title: "sunt aut facere repellat provident occaecati excepturi optio reprehenderit", body: "quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto" },
    { userId: 1, id: 2, title: "qui est esse", body: "est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla" },
    { userId: 1, id: 3, title: "ea molestias quasi exercitationem repellat qui ipsa sit aut", body: "et iusto sed quo iure\nvoluptatem occaecati omnis eligendi aut ad\nvoluptatem doloribus vel accusantium quis pariatur\nmolestiae porro eius odio et labore et velit aut" },
  ];

  const MOCK_HOST = "jsonplaceholder.typicode.com";

  function defaultHttpMock(req) {
    // Retorna { status, headers, body } ou lança { code, message } para falha de rede.
    let u;
    try {
      u = new URL(req.url);
    } catch (e) {
      const err = new Error("Invalid URL");
      err.code = "ERR_INVALID_URL";
      throw err;
    }
    if (u.hostname !== MOCK_HOST) {
      const err = new Error("getaddrinfo ENOTFOUND " + u.hostname + " (simulador: apenas " + MOCK_HOST + " está disponível)");
      err.code = "ENOTFOUND";
      throw err;
    }
    const json = (status, body) => ({ status, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(body) });
    const path = u.pathname.replace(/\/+$/, "") || "/";
    const m = req.method.toUpperCase();
    const parts = path.split("/").filter(Boolean);
    const coll = { users: USERS, todos: TODOS, posts: POSTS }[parts[0]];

    if (path === "/falha") return json(500, { erro: "Erro interno simulado" });
    if (!coll) return json(404, {});

    let reqBody = null;
    const ct = String((req.headers && (req.headers["content-type"] || req.headers["Content-Type"])) || "");
    if (req.body !== undefined && req.body !== null && /application\/json/i.test(ct)) {
      try {
        reqBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      } catch (e) {
        reqBody = null;
      }
    }

    if (parts.length === 1) {
      if (m === "GET") return json(200, coll);
      if (m === "POST") return json(201, Object.assign({}, isObj(reqBody) ? reqBody : {}, { id: 101 }));
      return json(404, {});
    }
    const id = Number(parts[1]);
    const item = coll.find((x) => x.id === id);
    if (parts.length === 2) {
      if (m === "GET") return item ? json(200, item) : json(404, {});
      if (m === "PUT" || m === "PATCH") return json(200, Object.assign({}, m === "PATCH" && item ? item : {}, isObj(reqBody) ? reqBody : {}, { id: id }));
      if (m === "DELETE") return json(200, {});
    }
    return json(404, {});
  }

  // ------------------------------------------------------------- MQTT (simulado)
  function topicMatches(pattern, topic) {
    if (pattern === "#") return true;
    const p = pattern.split("/");
    const t = topic.split("/");
    for (let i = 0; i < p.length; i++) {
      if (p[i] === "#") return true;
      if (i >= t.length) return false;
      if (p[i] !== "+" && p[i] !== t[i]) return false;
    }
    return p.length === t.length;
  }

  // ===================================================================== ENGINE
  function create(opts) {
    opts = opts || {};
    const clock = opts.clock === "virtual" ? virtualClock(opts.startTime) : realClock();
    const on = opts.on || {};
    const envVars = opts.env || {};
    const httpMock = opts.httpMock || defaultHttpMock;
    const runFunction = opts.runFunction;

    const flowNodes = (opts.flow || []).filter((n) => n && typeof n === "object");
    const state = {
      debug: [],
      errors: [],
      status: {},
      ui: {},
      mqttLog: [],
      httpLog: [],
      flowCtx: {},
      globalCtx: {},
      deployedAt: null,
    };
    const nodes = {}; // id -> runtime node
    const configs = {}; // id -> config node (ui_tab, ui_group, mqtt-broker)
    const subs = []; // { key, pattern, node }
    let queue = [];
    let running = false;
    let stopped = true;

    const emit = (name, ...args) => {
      try {
        if (on[name]) on[name](...args);
      } catch (e) {
        /* listeners não podem derrubar o motor */
      }
    };

    // ---- fila de execução (determinística) ----
    function enqueue(task) {
      if (stopped) return;
      queue.push(task);
      if (!clock.virtual) Promise.resolve().then(drain);
    }
    let stepsTotal = 0;
    let winStart = 0;
    let winCount = 0;
    function loopGuard() {
      // Proteção contra laços infinitos de mensagens (A -> B -> A ...)
      stepsTotal++;
      if (clock.virtual) return stepsTotal > (opts.maxSteps || 50000);
      const nowR = Date.now();
      if (nowR - winStart > 1000) {
        winStart = nowR;
        winCount = 0;
      }
      return ++winCount > 5000;
    }
    async function drain() {
      if (running) return;
      running = true;
      try {
        while (queue.length && !stopped) {
          if (loopGuard()) {
            queue = [];
            addError(null, "Laço infinito de mensagens detectado: o fluxo foi interrompido. Verifique se algum fio faz a mensagem voltar para o início.");
            break;
          }
          const t = queue.shift();
          try {
            await t();
          } catch (e) {
            addError(null, e && e.message ? e.message : String(e));
          }
          if (!clock.virtual && winCount % 200 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      } finally {
        running = false;
      }
    }
    async function settle() {
      // espera a fila esvaziar (modo virtual)
      let guard = 0;
      while ((queue.length || running) && guard++ < 100000) {
        await drain();
        if (running) await Promise.resolve();
      }
    }

    // ---- registro / mensagens ----
    function addDebug(entry) {
      entry.time = clock.now();
      entry.id = state.debug.length + 1;
      state.debug.push(entry);
      if (state.debug.length > 2000) state.debug.shift();
      emit("debug", entry);
    }
    function addError(node, text, msg) {
      const entry = {
        level: "error",
        nodeId: node ? node.id : null,
        name: node ? node.name || node.type : "",
        type: node ? node.type : "",
        text: String(text),
        value: String(text),
        property: "",
      };
      state.errors.push(Object.assign({ time: clock.now() }, entry));
      addDebug(entry);
      if (node && msg && isObj(msg)) triggerCatch(node, msg, String(text));
    }
    function triggerCatch(src, msg, text) {
      for (const n of Object.values(nodes)) {
        if (n.type !== "catch") continue;
        const scope = n.cfg.scope;
        if (Array.isArray(scope) && scope.length && !scope.includes(src.id)) continue;
        if (n.id === src.id) continue;
        const m = deepClone(msg);
        m.error = { message: text, source: { id: src.id, type: src.type, name: src.name || "" } };
        m._msgid = m._msgid || msgId();
        sendTo(n, [[m]]);
      }
    }
    function setStatus(node, s) {
      state.status[node.id] = s || null;
      emit("status", node.id, s || null);
    }

    function sendTo(node, outputs) {
      // outputs: array (um item por saída) de arrays de mensagens
      outputs.forEach((msgs, i) => {
        if (!msgs) return;
        const targets = (node.wires[i] || []).filter((id) => nodes[id]);
        for (const m of msgs) {
          if (m === null || m === undefined) continue;
          for (const tid of targets) {
            const copy = deepClone(m);
            if (!copy._msgid) copy._msgid = msgId();
            enqueue(() => receive(nodes[tid], copy));
          }
        }
      });
    }
    function send1(node, msg, out) {
      const arr = [];
      arr[out || 0] = [msg];
      sendTo(node, arr);
    }
    async function receive(node, msg) {
      const b = behaviors[node.type];
      if (!b || !b.input) return;
      await b.input(node, msg);
    }

    // ---- valores tipados ----
    function evalTyped(vt, v, msg) {
      switch (vt) {
        case "str":
          return v === undefined || v === null ? "" : String(v);
        case "num":
          return Number(v);
        case "bool":
          return v === true || v === "true";
        case "json":
          try {
            return JSON.parse(v);
          } catch (e) {
            throw new Error("JSON inválido: " + e.message);
          }
        case "msg":
          return getByPath(msg, v);
        case "flow":
          return getByPath(state.flowCtx, v);
        case "global":
          return getByPath(state.globalCtx, v);
        case "date":
          return clock.now();
        case "env":
          return envVars[v];
        case "jsonata":
          throw new Error("Expressões JSONata não são suportadas no simulador. Use um node Function.");
        default:
          return v;
      }
    }
    function readProp(type, path, msg) {
      if (type === "flow") return getByPath(state.flowCtx, path);
      if (type === "global") return getByPath(state.globalCtx, path);
      return getByPath(msg, path);
    }
    function writeProp(type, path, value, msg) {
      if (type === "flow") setByPath(state.flowCtx, path, value);
      else if (type === "global") setByPath(state.globalCtx, path, value);
      else setByPath(msg, path, value);
    }

    function durationMs(value, unit) {
      const v = Number(value) || 0;
      switch (unit) {
        case "ms":
        case "milliseconds":
          return v;
        case "s":
        case "seconds":
          return v * 1000;
        case "min":
        case "minutes":
          return v * 60000;
        case "hr":
        case "hours":
          return v * 3600000;
        case "days":
          return v * 86400000;
        default:
          return v * 1000;
      }
    }

    // ======================================================== comportamento dos nodes
    const behaviors = {};

    // ---- inject ----
    function buildInjectMsg(node, overrides) {
      const msg = { _msgid: msgId() };
      const props = node.cfg.props && node.cfg.props.length ? node.cfg.props : [{ p: "payload", v: "", vt: "date" }];
      for (const pr of props) {
        if (!pr.p) continue;
        try {
          setByPath(msg, pr.p, evalTyped(pr.vt || "str", pr.v, msg));
        } catch (e) {
          addError(node, e.message);
        }
      }
      if (overrides) for (const k of Object.keys(overrides)) msg[k] = overrides[k];
      return msg;
    }
    function nextCron(cron, from) {
      // formato: "M H * * D" (D = * ou lista 0-6)
      const f = String(cron).trim().split(/\s+/);
      if (f.length < 5) return null;
      const want = (field, v) => field === "*" || field.split(",").some((x) => Number(x) === v);
      let t = Math.floor(from / 60000) * 60000 + 60000;
      for (let i = 0; i < 8 * 24 * 60; i++, t += 60000) {
        const p = clock.parts(t);
        if (want(f[0], p.min) && want(f[1], p.hour) && want(f[4], p.dow)) return t;
      }
      return null;
    }
    behaviors.inject = {
      init(node) {
        const c = node.cfg;
        node.fire = (overrides) => {
          if (stopped) return;
          const m = buildInjectMsg(node, overrides);
          send1(node, m);
        };
        if (c.once) {
          const delay = (c.onceDelay === undefined || c.onceDelay === "" ? 0.1 : Number(c.onceDelay)) * 1000;
          node.timers.push(clock.setTimeout(() => {
            node.fire();
            startRepeat();
          }, delay));
        } else startRepeat();
        function startRepeat() {
          const secs = Number(c.repeat);
          if (c.crontab) {
            const arm = (from) => {
              const at = nextCron(c.crontab, from);
              if (at === null) return;
              node.timers.push(clock.setTimeout(() => {
                node.fire();
                arm(at);
              }, at - clock.now()));
            };
            arm(clock.now());
          } else if (secs > 0) {
            let next = clock.now() + secs * 1000;
            const tick = () => {
              node.fire();
              next += secs * 1000;
              node.timers.push(clock.setTimeout(tick, next - clock.now()));
            };
            node.timers.push(clock.setTimeout(tick, secs * 1000));
          }
        }
      },
    };

    // ---- debug ----
    behaviors.debug = {
      input(node, msg) {
        if (node.cfg.active === false) return;
        const whole = node.cfg.complete === "true" || node.cfg.complete === true;
        const path = whole ? "" : node.cfg.complete || "payload";
        addDebug({
          level: "info",
          nodeId: node.id,
          name: node.name || "debug " + node.id.slice(0, 4),
          property: whole ? "msg" : "msg." + path,
          value: deepClone(whole ? msg : getByPath(msg, path)),
          topic: msg.topic,
        });
      },
    };

    // ---- comment ----
    behaviors.comment = {};

    // ---- change ----
    behaviors.change = {
      input(node, msg) {
        const rules = node.cfg.rules || [];
        try {
          for (const r of rules) {
            const pt = r.pt || "msg";
            if (r.t === "set") {
              writeProp(pt, r.p, evalTyped(r.tot || "str", r.to, msg), msg);
            } else if (r.t === "delete") {
              if (pt === "flow") deleteByPath(state.flowCtx, r.p);
              else if (pt === "global") deleteByPath(state.globalCtx, r.p);
              else deleteByPath(msg, r.p);
            } else if (r.t === "move") {
              const v = readProp(pt, r.p, msg);
              const tt = r.tot || "msg";
              if (!(tt === pt && r.to === r.p)) {
                if (pt === "flow") deleteByPath(state.flowCtx, r.p);
                else if (pt === "global") deleteByPath(state.globalCtx, r.p);
                else deleteByPath(msg, r.p);
                writeProp(tt, r.to, v, msg);
              }
            } else if (r.t === "change") {
              const cur = readProp(pt, r.p, msg);
              if (typeof cur === "string") {
                const from = r.fromt === "re" ? new RegExp(r.from, "g") : null;
                const to = evalTyped(r.tot || "str", r.to, msg);
                const out = from ? cur.replace(from, String(to)) : cur.split(String(r.from)).join(String(to));
                writeProp(pt, r.p, out, msg);
              } else if (r.fromt === "num" && cur === Number(r.from)) writeProp(pt, r.p, evalTyped(r.tot || "str", r.to, msg), msg);
              else if (r.fromt === "bool" && cur === (r.from === "true")) writeProp(pt, r.p, evalTyped(r.tot || "str", r.to, msg), msg);
            }
          }
        } catch (e) {
          addError(node, e.message, msg);
          return;
        }
        send1(node, msg);
      },
    };

    // ---- switch ----
    function switchTest(rule, a, msg) {
      let v1 = rule.v;
      let v2 = rule.v2;
      const resolve = (v, t) => {
        if (t === "num") return Number(v);
        if (t === "msg" || t === "flow" || t === "global") return evalTyped(t, v, msg);
        if (t === "bool") return v === true || v === "true";
        if (t === "json") return JSON.parse(v);
        if (t === "jsonata") throw new Error("Expressões JSONata não são suportadas no simulador.");
        return v;
      };
      const t = rule.t;
      if (["eq", "neq", "lt", "lte", "gt", "gte", "btwn", "cont"].includes(t)) {
        v1 = resolve(v1, rule.vt || "str");
        if (t === "btwn") v2 = resolve(v2, rule.v2t || rule.vt || "str");
      }
      switch (t) {
        case "eq":
          return a == v1; // eslint-disable-line eqeqeq
        case "neq":
          return a != v1; // eslint-disable-line eqeqeq
        case "lt":
          return a < v1;
        case "lte":
          return a <= v1;
        case "gt":
          return a > v1;
        case "gte":
          return a >= v1;
        case "btwn": {
          const lo = v1 <= v2 ? v1 : v2;
          const hi = v1 <= v2 ? v2 : v1;
          return a >= lo && a <= hi;
        }
        case "cont":
          return String(safeStringify(a)).indexOf(String(v1)) !== -1;
        case "regex":
          try {
            return new RegExp(rule.v, rule.case ? "i" : "").test(String(a));
          } catch (e) {
            return false;
          }
        case "true":
          return a === true;
        case "false":
          return a === false;
        case "null":
          return a === null;
        case "nnull":
          return a !== null && a !== undefined;
        case "empty":
          return (typeof a === "string" || Array.isArray(a)) ? a.length === 0 : isObj(a) ? Object.keys(a).length === 0 : false;
        case "nempty":
          return (typeof a === "string" || Array.isArray(a)) ? a.length > 0 : isObj(a) ? Object.keys(a).length > 0 : false;
        case "istype": {
          const ty = rule.v;
          if (ty === "array") return Array.isArray(a);
          if (ty === "null") return a === null;
          if (ty === "json") return typeof a === "string" && (() => { try { JSON.parse(a); return true; } catch (e) { return false; } })();
          if (ty === "object") return isObj(a) && !Array.isArray(a);
          return typeof a === ty;
        }
        case "hask":
          return isObj(a) && Object.prototype.hasOwnProperty.call(a, String(rule.v));
        default:
          return false;
      }
    }
    behaviors.switch = {
      input(node, msg) {
        const c = node.cfg;
        const rules = c.rules || [];
        const a = readProp(c.propertyType || "msg", c.property || "payload", msg);
        const outs = rules.map(() => null);
        let matchedAny = false;
        try {
          for (let i = 0; i < rules.length; i++) {
            const r = rules[i];
            let ok;
            if (r.t === "else") ok = !matchedAny;
            else ok = switchTest(r, a, msg);
            if (ok) {
              matchedAny = true;
              outs[i] = [msg];
              if (c.checkall === "false" || c.checkall === false) break;
            }
          }
        } catch (e) {
          addError(node, e.message, msg);
          return;
        }
        sendTo(node, outs);
      },
    };

    // ---- function ----
    behaviors.function = {
      async input(node, msg) {
        if (!runFunction) {
          addError(node, "Este ambiente não executa nodes Function.", msg);
          return;
        }
        const res = await runFunction({
          code: node.cfg.func || "",
          msg: deepClone(msg),
          node: { id: node.id, name: node.name || "" },
          flow: state.flowCtx,
          global: state.globalCtx,
          nodeCtx: node.ctx,
          env: envVars,
        });
        if (stopped) return;
        for (const l of res.logs || []) {
          if (l.level === "error") addError(node, l.text, l.msg ? l.msg : undefined);
          else
            addDebug({ level: l.level === "warn" ? "warn" : "info", nodeId: node.id, name: node.name || "function", property: "", value: l.text, text: l.text });
        }
        if (res.error) {
          addError(node, res.error, msg);
          return;
        }
        // atualiza contextos (mantém a referência dos objetos)
        const replace = (target, src) => {
          for (const k of Object.keys(target)) delete target[k];
          Object.assign(target, src || {});
        };
        replace(state.flowCtx, res.flow);
        replace(state.globalCtx, res.global);
        replace(node.ctx, res.nodeCtx);
        if (res.status !== undefined && res.status !== null) setStatus(node, typeof res.status === "string" ? { text: res.status } : res.status);

        const nOut = Math.max(1, Number(node.cfg.outputs) || 1);
        const outs = [];
        for (let i = 0; i < nOut; i++) outs.push([]);
        let bad = null;
        const put = (i, m) => {
          if (m === null || m === undefined) return;
          if (!isObj(m) || Array.isArray(m)) {
            bad = bad || "Function tried to send a message of type " + (Array.isArray(m) ? "array" : typeof m);
            return;
          }
          if (i < nOut) outs[i].push(m);
        };
        // node.send(...) primeiro, depois o return
        for (const s of res.sent || []) {
          if (Array.isArray(s)) s.forEach((r, i) => (Array.isArray(r) ? r.forEach((m) => put(i, m)) : put(i, r)));
          else put(0, s);
        }
        const ret = res.ret;
        if (ret !== null && ret !== undefined) {
          if (Array.isArray(ret)) ret.forEach((r, i) => (Array.isArray(r) ? r.forEach((m) => put(i, m)) : put(i, r)));
          else put(0, ret);
        }
        if (bad) {
          addError(node, bad, msg);
          return;
        }
        sendTo(node, outs);
      },
    };

    // ---- template ----
    behaviors.template = {
      input(node, msg) {
        const c = node.cfg;
        const ctx = Object.assign({}, msg, { flow: state.flowCtx, global: state.globalCtx });
        let out;
        if (c.syntax === "plain") out = String(c.template || "");
        else out = renderMustache(c.template || "", ctx);
        if (c.output === "json" || c.output === "parsed") {
          try {
            out = JSON.parse(out);
          } catch (e) {
            addError(node, "SyntaxError: " + e.message, msg);
            return;
          }
        }
        writeProp(c.fieldType || "msg", c.field || "payload", out, msg);
        send1(node, msg);
      },
    };

    // ---- json ----
    behaviors.json = {
      input(node, msg) {
        const c = node.cfg;
        const prop = c.property || "payload";
        const val = getByPath(msg, prop);
        if (val === undefined) {
          send1(node, msg);
          return;
        }
        try {
          if (typeof val === "string" && c.action !== "str") {
            setByPath(msg, prop, JSON.parse(val));
          } else if (isObj(val) && c.action !== "obj") {
            setByPath(msg, prop, c.pretty ? JSON.stringify(val, null, 4) : JSON.stringify(val));
          } else if (typeof val !== "string" && !isObj(val)) {
            addError(node, "dropped: " + typeof val, msg);
            return;
          }
        } catch (e) {
          addError(node, e.name + ": " + e.message + " (" + String(val).slice(0, 40) + ")", msg);
          return;
        }
        send1(node, msg);
      },
    };

    // ---- catch ----
    behaviors.catch = {
      input(node, msg) {
        send1(node, msg);
      },
    };

    // ---- delay ----
    behaviors.delay = {
      init(node) {
        node.queue = [];
        node.lastSent = -Infinity;
        node.rateTimer = null;
      },
      input(node, msg) {
        const c = node.cfg;
        if (c.pauseType === "rate") {
          const unit = { second: 1000, minute: 60000, hour: 3600000, day: 86400000 }[c.rateUnits || "second"] || 1000;
          const interval = (unit * (Number(c.nbRateUnits) || 1)) / (Number(c.rate) || 1);
          const nowT = clock.now();
          if (node.queue.length === 0 && nowT - node.lastSent >= interval) {
            node.lastSent = nowT;
            send1(node, msg);
            return;
          }
          if (c.drop) return;
          node.queue.push(msg);
          setStatus(node, { fill: "blue", shape: "dot", text: String(node.queue.length) });
          if (node.rateTimer === null) {
            const pump = () => {
              node.rateTimer = null;
              const m = node.queue.shift();
              if (m) {
                node.lastSent = clock.now();
                send1(node, m);
              }
              setStatus(node, node.queue.length ? { fill: "blue", shape: "dot", text: String(node.queue.length) } : null);
              if (node.queue.length) {
                node.rateTimer = clock.setTimeout(pump, interval);
                node.timers.push(node.rateTimer);
              }
            };
            const wait = Math.max(0, node.lastSent + interval - clock.now());
            node.rateTimer = clock.setTimeout(pump, wait);
            node.timers.push(node.rateTimer);
          }
          return;
        }
        const ms = durationMs(c.timeout === undefined || c.timeout === "" ? 5 : c.timeout, c.timeoutUnits || "seconds");
        node.pending = (node.pending || 0) + 1;
        setStatus(node, { fill: "blue", shape: "dot", text: String(node.pending) });
        node.timers.push(clock.setTimeout(() => {
          node.pending -= 1;
          setStatus(node, node.pending ? { fill: "blue", shape: "dot", text: String(node.pending) } : null);
          send1(node, msg);
        }, ms));
      },
    };

    // ---- trigger ----
    behaviors.trigger = {
      init(node) {
        node.topics = {};
      },
      input(node, msg) {
        const c = node.cfg;
        const topic = c.bytopic === "topic" ? msg.topic || "_none" : "_all";
        const st = node.topics[topic] || (node.topics[topic] = { timer: null, msg: null });
        const op1type = c.op1type || "str";
        const op2type = c.op2type || "str";
        const mk = (type, v, base) => {
          if (type === "nul") return null;
          const m = deepClone(base);
          if (type === "pay") return m;
          try {
            m.payload = evalTyped(type, v, base);
          } catch (e) {
            addError(node, e.message, base);
            return null;
          }
          return m;
        };
        if (c.reset && msg.reset !== undefined) {
          if (st.timer !== null) clock.clearTimeout(st.timer);
          st.timer = null;
          setStatus(node, null);
          return;
        }
        const duration = durationMs(c.duration === undefined || c.duration === "" ? 250 : c.duration, c.units || "ms");
        const arm = () => {
          st.timer = clock.setTimeout(() => {
            st.timer = null;
            setStatus(node, null);
            const m2 = mk(op2type, c.op2 === undefined ? "0" : c.op2, st.msg || msg);
            if (m2) send1(node, m2);
          }, duration);
          node.timers.push(st.timer);
          setStatus(node, { fill: "blue", shape: "dot", text: "..." });
        };
        if (st.timer === null) {
          st.msg = deepClone(msg);
          const m1 = mk(op1type, c.op1 === undefined ? "1" : c.op1, msg);
          if (m1) send1(node, m1);
          if (op2type !== "nul" && duration > 0) arm();
        } else if (c.extend && op2type !== "nul") {
          clock.clearTimeout(st.timer);
          if (op2type === "pay") st.msg = deepClone(msg);
          arm();
        }
      },
    };

    // ---- http request ----
    behaviors["http request"] = {
      async input(node, msg) {
        const c = node.cfg;
        let url = c.url || msg.url;
        if (c.url && /\{\{/.test(c.url)) url = renderMustache(c.url, msg);
        if (!url) {
          addError(node, "No url specified", msg);
          return;
        }
        if (!/^https?:\/\//i.test(url)) url = "http://" + url;
        const method = String(c.method === "use" || !c.method ? msg.method || "GET" : c.method).toUpperCase();
        const headers = {};
        for (const h of c.headers || []) if (h && h.k) headers[String(h.k).toLowerCase()] = String(h.v);
        if (isObj(msg.headers)) for (const k of Object.keys(msg.headers)) headers[String(k).toLowerCase()] = String(msg.headers[k]);
        let body;
        if (method !== "GET" && method !== "HEAD" && msg.payload !== undefined) {
          if (isObj(msg.payload)) {
            body = JSON.stringify(msg.payload);
            if (!headers["content-type"]) headers["content-type"] = "application/json";
          } else body = String(msg.payload);
        }
        state.httpLog.push({ time: clock.now(), method, url, headers: deepClone(headers), body });
        // A resposta chega depois de um atraso simulado. A fila NÃO fica bloqueada
        // esperando (o Node-RED também é assíncrono): a continuação entra na fila
        // quando o timer disparar.
        setStatus(node, { fill: "blue", shape: "dot", text: "requesting" });
        let resp = null;
        let netErr = null;
        try {
          resp = httpMock({ method, url, headers, body });
        } catch (e) {
          netErr = e;
        }
        node.timers.push(
          clock.setTimeout(() => {
            enqueue(() => {
              if (netErr) {
                addError(node, netErr.message || String(netErr), msg);
                setStatus(node, { fill: "red", shape: "ring", text: netErr.code || "erro" });
                return;
              }
              let payload = resp.body;
              if (c.ret === "obj") {
                try {
                  payload = JSON.parse(resp.body);
                } catch (e) {
                  addDebug({ level: "warn", nodeId: node.id, name: node.name || "http request", property: "", value: "Resposta não é um JSON válido", text: "Resposta não é um JSON válido" });
                }
              }
              msg.payload = payload;
              msg.statusCode = resp.status;
              msg.headers = resp.headers;
              msg.responseUrl = url;
              setStatus(node, null);
              send1(node, msg);
            });
          }, netErr ? 100 : 150)
        );
      },
    };

    // ---- MQTT ----
    function brokerOf(node) {
      const b = configs[node.cfg.broker];
      if (!b || b.type !== "mqtt-broker") return null;
      const host = String(b.broker || "").trim();
      if (!host) return null;
      return { host, port: String(b.port || 1883), key: host + ":" + (b.port || 1883) };
    }
    function mqttPublish(key, topic, payload, source) {
      const text = typeof payload === "string" ? payload : safeStringify(payload);
      const entry = { time: clock.now(), broker: key, topic: String(topic), payload: text, source: source || "externo" };
      state.mqttLog.push(entry);
      if (state.mqttLog.length > 500) state.mqttLog.shift();
      emit("mqtt", entry);
      for (const s of subs) {
        if (s.key !== key || !topicMatches(s.pattern, String(topic))) continue;
        const node = s.node;
        let p = text;
        const dt = node.cfg.datatype || "auto";
        if (dt === "json") {
          try {
            p = JSON.parse(text);
          } catch (e) {
            const n = node;
            enqueue(() => addError(n, "SyntaxError: " + e.message, { topic, payload: text }));
            continue;
          }
        }
        const m = { _msgid: msgId(), topic: String(topic), payload: p, qos: 0, retain: false };
        enqueue(() => send1(node, m));
      }
    }
    behaviors["mqtt in"] = {
      init(node) {
        const b = brokerOf(node);
        if (!b) {
          setStatus(node, { fill: "red", shape: "ring", text: "sem broker" });
          return;
        }
        if (!node.cfg.topic) {
          setStatus(node, { fill: "red", shape: "ring", text: "sem tópico" });
          return;
        }
        subs.push({ key: b.key, pattern: String(node.cfg.topic), node });
        setStatus(node, { fill: "green", shape: "dot", text: "connected" });
      },
    };
    behaviors["mqtt out"] = {
      init(node) {
        const b = brokerOf(node);
        setStatus(node, b ? { fill: "green", shape: "dot", text: "connected" } : { fill: "red", shape: "ring", text: "sem broker" });
      },
      input(node, msg) {
        const b = brokerOf(node);
        if (!b) {
          addError(node, "Broker MQTT não configurado", msg);
          return;
        }
        const topic = node.cfg.topic || msg.topic;
        if (!topic) {
          addError(node, "mqtt out: nenhum tópico (configure o tópico ou use msg.topic)", msg);
          return;
        }
        if (msg.payload === undefined || msg.payload === null) return;
        mqttPublish(b.key, topic, msg.payload, node.name || "mqtt out");
      },
    };

    // ---- Dashboard ----
    function uiGroupOk(node) {
      const g = configs[node.cfg.group];
      return g && g.type === "ui_group" && configs[g.tab] && configs[g.tab].type === "ui_tab";
    }
    function uiPublish(node) {
      emit("ui", node.id, state.ui[node.id]);
    }
    function uiInit(node, extra) {
      if (!uiGroupOk(node)) {
        setStatus(node, { fill: "red", shape: "ring", text: "grupo não definido" });
        node.noGroup = true;
        return false;
      }
      state.ui[node.id] = Object.assign({ id: node.id, type: node.type, group: node.cfg.group, label: node.cfg.label || node.cfg.name || "", value: null }, extra || {});
      return true;
    }
    behaviors.ui_slider = {
      init(node) {
        const min = Number(node.cfg.min === undefined ? 0 : node.cfg.min);
        uiInit(node, { min, max: Number(node.cfg.max === undefined ? 10 : node.cfg.max), step: Number(node.cfg.step || 1), value: min });
      },
      input(node, msg) {
        if (node.noGroup) return;
        const v = Number(msg.payload);
        if (!Number.isNaN(v)) {
          state.ui[node.id].value = v;
          uiPublish(node);
          if (node.cfg.passthru) send1(node, msg);
        }
      },
    };
    behaviors.ui_gauge = {
      init(node) {
        uiInit(node, { min: Number(node.cfg.min === undefined ? 0 : node.cfg.min), max: Number(node.cfg.max === undefined ? 10 : node.cfg.max), units: node.cfg.units || "units", gtype: node.cfg.gtype || "gage" });
      },
      input(node, msg) {
        if (node.noGroup) return;
        const v = Number(msg.payload);
        if (typeof msg.payload === "boolean" || msg.payload === "" || Number.isNaN(v)) return;
        state.ui[node.id].value = v;
        uiPublish(node);
      },
    };
    behaviors.ui_chart = {
      init(node) {
        uiInit(node, { series: {}, ymin: node.cfg.ymin, ymax: node.cfg.ymax });
      },
      input(node, msg) {
        if (node.noGroup) return;
        const v = Number(msg.payload);
        if (typeof msg.payload === "boolean" || msg.payload === "" || Number.isNaN(v)) return;
        const s = String(msg.topic || node.cfg.label || "série 1");
        const ui = state.ui[node.id];
        (ui.series[s] = ui.series[s] || []).push({ t: clock.now(), y: v });
        if (ui.series[s].length > 300) ui.series[s].shift();
        ui.value = v;
        uiPublish(node);
      },
    };
    behaviors.ui_text = {
      init(node) {
        uiInit(node, { value: "" });
      },
      input(node, msg) {
        if (node.noGroup) return;
        const fmt = node.cfg.format || "{{msg.payload}}";
        state.ui[node.id].value = renderMustache(fmt, { msg });
        uiPublish(node);
      },
    };
    behaviors.ui_switch = {
      init(node) {
        uiInit(node, { value: false });
      },
      input(node, msg) {
        if (node.noGroup) return;
        const on = evalTyped(node.cfg.onvalueType || "bool", node.cfg.onvalue === undefined ? "true" : node.cfg.onvalue, msg);
        state.ui[node.id].value = msg.payload === on || msg.payload === true;
        uiPublish(node);
        if (node.cfg.passthru) send1(node, msg);
      },
    };
    behaviors.ui_button = {
      init(node) {
        uiInit(node, {});
      },
    };

    // ======================================================== ciclo de vida
    function start() {
      stopped = false;
      state.deployedAt = clock.now();
      for (const n of flowNodes) {
        if (!n.id) continue;
        if (n.type === "ui_tab" || n.type === "ui_group" || n.type === "mqtt-broker") configs[n.id] = n;
      }
      for (const n of flowNodes) {
        if (!n.id || n.type === "tab" || configs[n.id] || n.d) continue;
        nodes[n.id] = {
          id: n.id,
          type: n.type,
          cfg: n,
          name: n.name || "",
          wires: n.wires || [],
          ctx: {},
          timers: [],
        };
      }
      for (const node of Object.values(nodes)) {
        const b = behaviors[node.type];
        try {
          if (b && b.init) b.init(node);
        } catch (e) {
          addError(node, e.message);
        }
      }
      if (!clock.virtual) Promise.resolve().then(drain);
    }
    function stop() {
      stopped = true;
      queue = [];
      for (const n of Object.values(nodes)) (n.timers || []).forEach((t) => clock.clearTimeout(t));
      clock.clear();
      subs.length = 0;
    }

    // ---- ações externas ----
    function fire(nodeId, overrides) {
      const n = nodes[nodeId];
      if (!n || n.type !== "inject" || !n.fire) return false;
      n.fire(overrides);
      return true;
    }
    function uiInput(nodeId, value) {
      const n = nodes[nodeId];
      if (!n || n.noGroup) return false;
      const ui = state.ui[nodeId];
      if (!ui) return false;
      let payload;
      if (n.type === "ui_slider") {
        payload = Number(value);
        ui.value = payload;
      } else if (n.type === "ui_switch") {
        const on = !!value;
        ui.value = on;
        payload = evalTyped(on ? n.cfg.onvalueType || "bool" : n.cfg.offvalueType || "bool", on ? (n.cfg.onvalue === undefined ? "true" : n.cfg.onvalue) : n.cfg.offvalue === undefined ? "false" : n.cfg.offvalue, {});
      } else if (n.type === "ui_button") {
        try {
          payload = evalTyped(n.cfg.payloadType || "str", n.cfg.payload === undefined ? "" : n.cfg.payload, {});
        } catch (e) {
          addError(n, e.message);
          return false;
        }
      } else return false;
      const m = { _msgid: msgId(), payload };
      const topic = n.cfg.topic;
      if (topic) m.topic = topic;
      emit("ui", nodeId, ui);
      send1(n, m);
      return true;
    }
    function publishExternal(topic, payload, brokerKey) {
      // sem broker informado: publica em todos os brokers usados pelo fluxo
      const keys = new Set();
      if (brokerKey) keys.add(brokerKey);
      else {
        for (const n of Object.values(nodes)) {
          if (n.type === "mqtt in" || n.type === "mqtt out") {
            const b = brokerOf(n);
            if (b) keys.add(b.key);
          }
        }
        if (!keys.size) keys.add("test.mosquitto.org:1883");
      }
      keys.forEach((k) => mqttPublish(k, topic, payload, "dispositivo externo"));
    }

    async function advance(ms) {
      if (!clock.virtual) throw new Error("advance() só existe no relógio virtual");
      const target = clock.now() + ms;
      await settle();
      for (;;) {
        const t = clock.next(target);
        if (!t) break;
        t.fn();
        await settle();
      }
      clock.setTime(target);
      await settle();
    }

    return {
      state,
      nodes,
      configs,
      clock,
      start,
      stop,
      fire,
      uiInput,
      mqttPublish: publishExternal,
      advance,
      settle,
      drain,
      now: () => clock.now(),
    };
  }

  return {
    create,
    buildFunctionScript,
    renderMustache,
    getByPath,
    setByPath,
    deepClone,
    topicMatches,
    defaultHttpMock,
    MOCK_HOST,
  };
});
