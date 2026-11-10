// src/sim/judge.js
// O "juiz": recebe o fluxo que o aluno montou, higieniza, executa com o MESMO
// motor do simulador (relógio virtual, então 30 s de simulação levam
// milissegundos) e roda os testes OCULTOS do desafio.
const NRSim = require("../../public/js/nr/engine.js");
const { runFunction: runQuickJS } = require("./quickjs-runner");

const TIPOS_PERMITIDOS = new Set([
  "inject", "debug", "change", "switch", "function", "template", "delay", "trigger", "json", "catch", "comment",
  "http request", "mqtt in", "mqtt out", "mqtt-broker",
  "ui_tab", "ui_group", "ui_slider", "ui_gauge", "ui_chart", "ui_switch", "ui_button", "ui_text",
]);
const MAX_NODES = 80;
const MAX_BYTES = 200 * 1024;
const MAX_CODIGO = 8000;

// PRNG determinístico (mulberry32) — valores de teste diferentes a cada verificação
function criarRng(semente) {
  let a = semente >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    dec: (min, max) => Math.round((min + next() * (max - min)) * 10) / 10,
  };
}

function igual(a, b) {
  return JSON.stringify(ordenar(a)) === JSON.stringify(ordenar(b));
}
function ordenar(v) {
  if (Array.isArray(v)) return v.map(ordenar);
  if (v && typeof v === "object") {
    const o = {};
    Object.keys(v).sort().forEach((k) => (o[k] = ordenar(v[k])));
    return o;
  }
  return v;
}
const mostrar = (v) => {
  const s = v === undefined ? "undefined" : JSON.stringify(v);
  return s.length > 140 ? s.slice(0, 137) + "…" : s;
};

// Higieniza o fluxo enviado: tipos válidos, tamanhos, e RESTAURA os nodes
// travados (🔒) do desafio caso o aluno tenha mexido neles.
function higienizar(fluxo, inicial) {
  if (!Array.isArray(fluxo)) throw new Error("Fluxo inválido.");
  if (fluxo.length > MAX_NODES) throw new Error("Fluxo grande demais.");
  if (JSON.stringify(fluxo).length > MAX_BYTES) throw new Error("Fluxo grande demais.");
  const ids = new Set();
  const limpo = [];
  for (const n of fluxo) {
    if (!n || typeof n !== "object" || typeof n.id !== "string" || !TIPOS_PERMITIDOS.has(n.type)) continue;
    if (ids.has(n.id)) continue;
    ids.add(n.id);
    const c = JSON.parse(JSON.stringify(n));
    delete c.locked;
    delete c.role;
    if (typeof c.func === "string" && c.func.length > MAX_CODIGO) throw new Error("Código grande demais em um node Function.");
    if (c.wires !== undefined) {
      if (!Array.isArray(c.wires)) c.wires = [];
      c.wires = c.wires.slice(0, 9).map((w) => (Array.isArray(w) ? w.filter((x) => typeof x === "string") : []));
    }
    limpo.push(c);
  }
  // restaura nodes travados
  for (const base of inicial || []) {
    if (!base.locked) continue;
    const i = limpo.findIndex((n) => n.id === base.id);
    const orig = JSON.parse(JSON.stringify(base));
    if (i === -1) limpo.push(Object.assign(orig, { wires: base.wires || [] }));
    else {
      const wires = limpo[i].wires;
      const x = limpo[i].x;
      const y = limpo[i].y;
      limpo[i] = Object.assign(orig, { wires: wires !== undefined ? wires : orig.wires, x: x !== undefined ? x : orig.x, y: y !== undefined ? y : orig.y });
    }
  }
  // reaplica papéis (role) a partir do desafio
  for (const base of inicial || []) {
    if (!base.role) continue;
    const n = limpo.find((x) => x.id === base.id);
    if (n) n.role = base.role;
  }
  return limpo;
}

class Sessao {
  constructor(h) {
    this.h = h;
    this.sim = NRSim.create({
      flow: JSON.parse(JSON.stringify(h.fluxo)),
      clock: "virtual",
      maxSteps: 20000,
      runFunction: h._runFunction,
    });
  }
  async iniciar() {
    this.sim.start();
    await this.sim.settle();
    return this;
  }
  _alvos(alvo) {
    const h = this.h;
    const porPapel = h.fluxo.filter((n) => n.role === alvo);
    if (porPapel.length) return porPapel.map((n) => n.id);
    const porId = h.fluxo.filter((n) => n.id === alvo);
    if (porId.length) return porId.map((n) => n.id);
    return h.fluxo.filter((n) => n.type === alvo).map((n) => n.id);
  }
  async disparar(alvo, sobrescrever) {
    for (const id of this._alvos(alvo)) this.sim.fire(id, sobrescrever);
    await this.sim.settle();
  }
  async avancar(ms) {
    await this.sim.advance(ms);
  }
  async publicar(topico, payload) {
    this.sim.mqttPublish(topico, payload);
    await this.sim.settle();
  }
  async ui(id, valor) {
    this.sim.uiInput(id, valor);
    await this.sim.settle();
  }
  // valores recebidos por um (ou todos) debug
  saida(alvo) {
    const ids = alvo ? new Set(this._alvos(alvo)) : null;
    return this.sim.state.debug.filter((d) => d.level === "info" && d.nodeId && (!ids || ids.has(d.nodeId))).map((d) => d.value);
  }
  avisos() {
    return this.sim.state.debug.filter((d) => d.level === "warn");
  }
  erros() {
    return this.sim.state.errors;
  }
  mqttSaida() {
    return this.sim.state.mqttLog.filter((e) => e.source !== "dispositivo externo").map((e) => ({ topico: e.topic, payload: e.payload }));
  }
  http() {
    return this.sim.state.httpLog;
  }
  ui_estado(id) {
    return this.sim.state.ui[id];
  }
  fim() {
    this.sim.stop();
  }
}

class Harness {
  constructor(fluxo, opcoes) {
    this.fluxo = fluxo;
    this.rng = opcoes.rng;
    const limite = { chamadas: 0, ms: 0 };
    this._runFunction = async (req) => {
      limite.chamadas++;
      if (limite.chamadas > 400 || limite.ms > 6000) return { error: "Tempo total de execução excedido pelo fluxo.", logs: [] };
      const t0 = Date.now();
      const r = await runQuickJS(req);
      limite.ms += Date.now() - t0;
      return r;
    };
  }
  get r() {
    return this.rng;
  }
  async sessao() {
    return new Sessao(this).iniciar();
  }
  tipo(t) {
    return this.fluxo.filter((n) => n.type === t);
  }
  tem(t) {
    return this.tipo(t).length > 0;
  }
  papel(p) {
    return this.fluxo.find((n) => n.role === p);
  }
  // existe fio (direto ou indireto) de a até b?
  caminho(aId, bId) {
    const mapa = new Map(this.fluxo.map((n) => [n.id, n]));
    const visto = new Set([aId]);
    const fila = [aId];
    while (fila.length) {
      const n = mapa.get(fila.shift());
      if (!n) continue;
      for (const saida of n.wires || []) {
        for (const t of saida || []) {
          if (t === bId) return true;
          if (!visto.has(t)) {
            visto.add(t);
            fila.push(t);
          }
        }
      }
    }
    return false;
  }
  // existe caminho de algum node do tipo A até algum do tipo B?
  caminhoTipos(a, b) {
    return this.tipo(a).some((x) => this.tipo(b).some((y) => this.caminho(x.id, y.id)));
  }
  // caminho A -> (M) -> B passando por um node do tipo M
  caminhoVia(a, m, b) {
    return this.tipo(a).some((x) => this.tipo(m).some((y) => this.tipo(b).some((z) => this.caminho(x.id, y.id) && this.caminho(y.id, z.id))));
  }
  // quantas saídas distintas do switch estão ligadas a algo
  saidasLigadas(n) {
    return (n.wires || []).filter((w) => w && w.length).length;
  }
}

// Executa o desafio. Retorna { passou, requisitos: [{id, texto, ok, detalhe}] }
async function julgar(desafio, fluxoAluno, semente) {
  const fluxo = higienizar(fluxoAluno, desafio.fluxoInicial);
  const h = new Harness(fluxo, { rng: criarRng(semente) });
  const res = {};
  for (const r of desafio.requisitos) res[r.id] = { ok: false, detalhe: "Não atendido." };
  const api = {
    ok(id, cond, detalhe) {
      res[id] = { ok: !!cond, detalhe: cond ? "" : detalhe || "Não atendido." };
    },
    // compara valor recebido x esperado
    eq(id, recebido, esperado, entrada) {
      const ok = igual(recebido, esperado);
      res[id] = { ok, detalhe: ok ? "" : `${entrada !== undefined ? "Entrada: " + mostrar(entrada) + " → " : ""}esperado ${mostrar(esperado)}, recebido ${mostrar(recebido)}` };
    },
    falha(id, detalhe) {
      res[id] = { ok: false, detalhe };
    },
    igual,
    mostrar,
  };
  let erroInterno = null;
  try {
    await Promise.race([
      desafio.avaliar(h, api),
      new Promise((_, rej) => setTimeout(() => rej(new Error("O fluxo demorou demais para ser avaliado.")), 12000)),
    ]);
  } catch (e) {
    erroInterno = e && e.message ? e.message : String(e);
  }
  const requisitos = desafio.requisitos.map((r) => ({ id: r.id, texto: r.texto, ok: res[r.id].ok, detalhe: res[r.id].ok ? "" : res[r.id].detalhe }));
  if (erroInterno) {
    const primeiro = requisitos.find((r) => !r.ok);
    if (primeiro) primeiro.detalhe = erroInterno;
  }
  return { passou: requisitos.every((r) => r.ok), requisitos, fluxo };
}

module.exports = { julgar, higienizar, criarRng, igual, TIPOS_PERMITIDOS };
