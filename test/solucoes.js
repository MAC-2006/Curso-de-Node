// Soluções de referência dos desafios: usadas nos testes para garantir que o
// juiz APROVA um fluxo correto e REPROVA um fluxo vazio/errado.
const N = (id, type, cfg, wires, x, y) => Object.assign({ id, type, name: "", x: x || 300, y: y || 160, wires: wires || [] }, cfg);
const com = (starter, ligacoes, extras) => {
  const base = JSON.parse(JSON.stringify(starter));
  for (const n of base) if (ligacoes[n.id]) n.wires = ligacoes[n.id];
  return base.concat(extras);
};
const set = (to, tot, p, pt) => ({ t: "set", p: p || "payload", pt: pt || "msg", to, tot: tot || "str" });

const S = (id) => require("../src/data/challenges").porId.get(id).fluxoInicial;
const bk = { id: "broker", type: "mqtt-broker", name: "", broker: "test.mosquitto.org", port: "1883" };
const inj = (id, v, vt, extra) => N(id, "inject", Object.assign({ props: [{ p: "payload", v, vt }], repeat: "", crontab: "", once: false, onceDelay: 0.1 }, extra), [], 160, 100);

module.exports = {
  "primeiro-fluxo": [inj("i", "", "date", {}), N("c", "change", { rules: [set("Bem vindo ao curso")] }), N("d", "debug", { active: true, complete: "payload" })].map((n, i, a) => (i < 2 ? Object.assign(n, { wires: [[a[i + 1].id]] }) : n)),
  "msg-payload-objeto": com(S("msg-payload-objeto"), { entrada: [["f"]] }, [N("f", "function", { func: 'msg.payload = { temperatura: 24, unidade: "°C" };\nreturn msg;', outputs: 1 }, [["saida"]])]),
  "change-status": com(S("change-status"), { entrada: [["c"]] }, [N("c", "change", { rules: [set("processo iniciado"), set("status", "str", "topic")] }, [["saida"]])]),
  "switch-template": com(S("switch-template"), { entrada: [["sw"]] }, [
    N("sw", "switch", { property: "payload.temperatura", propertyType: "msg", rules: [{ t: "gte", v: "30", vt: "num" }, { t: "lt", v: "30", vt: "num" }], checkall: "true" }, [["t1"], ["t2"]]),
    N("t1", "template", { field: "payload", fieldType: "msg", syntax: "mustache", output: "str", template: "ALERTA: {{payload.nome}} registrou {{payload.temperatura}}°C - temperatura alta" }, [["saida"]]),
    N("t2", "template", { field: "payload", fieldType: "msg", syntax: "mustache", output: "str", template: "OK: {{payload.nome}} registrou {{payload.temperatura}}°C - temperatura normal" }, [["saida"]]),
  ]),
  "json-idade": com(S("json-idade"), { entrada: [["f"]] }, [N("f", "function", { func: 'const n = msg.payload.nome;\nmsg.payload = Number(msg.payload.idade) >= 18 ? n + " é maior de idade" : n + " é menor de idade";\nreturn msg;', outputs: 1 }, [["saida"]])]),
  "validacao-temperatura": com(S("validacao-temperatura"), { entrada: [["f"]] }, [N("f", "function", { func: 'const t = Number(msg.payload.temperatura);\nif (Number.isNaN(t)) { node.error("Temperatura inválida", msg); return null; }\nmsg.payload = { temperatura: t, valido: true };\nreturn msg;', outputs: 1 }, [["saida"]])]),
  "http-get-usuarios": com(S("http-get-usuarios"), { entrada: [["h"]] }, [N("h", "http request", { method: "GET", url: "https://jsonplaceholder.typicode.com/users", ret: "obj", headers: [] }, [["c"]]), N("c", "change", { rules: [set("payload[0].email", "msg")] }, [["saida"]])]),
  "http-post": com(S("http-post"), { entrada: [["h"]] }, [N("h", "http request", { method: "POST", url: "https://jsonplaceholder.typicode.com/todos", ret: "obj", headers: [{ k: "Content-Type", v: "application/json" }] }, [["saida"]])]),
  "http-erros": com(S("http-erros"), { entrada: [["h"]] }, [
    N("h", "http request", { method: "GET", url: "", ret: "obj", headers: [] }, [["f"]]),
    N("f", "function", { func: 'const ok = msg.statusCode >= 200 && msg.statusCode < 300;\nmsg.payload = ok ? { ok: true, dados: msg.payload } : { ok: false, erro: "API indisponível" };\nreturn msg;', outputs: 1 }, [["saida"]]),
  ]),
  "agendamento-5s": [inj("i", "", "date", { repeat: "5" }), N("d", "debug", { active: true, complete: "payload" })].map((n, i, a) => (i === 0 ? Object.assign(n, { wires: [["d"]] }) : n)),
  "trigger-alarme": com(S("trigger-alarme"), { entrada: [["t"]] }, [N("t", "trigger", { op1: "", op1type: "pay", op2: "Alarme: porta deixada aberta", op2type: "str", duration: "30", units: "s", extend: true, bytopic: "all" }, [["saida"]])]),
  "contexto-maximo": com(S("contexto-maximo"), { entrada: [["f"]] }, [N("f", "function", { func: 'let max = flow.get("maximo");\nif (max === undefined || msg.payload > max) max = msg.payload;\nflow.set("maximo", max);\nmsg.payload = max;\nreturn msg;', outputs: 1 }, [["saida"]])]),
  "dashboard-termico": [
    { id: "tb", type: "ui_tab", name: "Controle da Fábrica" }, { id: "gp", type: "ui_group", name: "Painel Térmico", tab: "tb" },
    N("sl", "ui_slider", { label: "Temp", group: "gp", min: 0, max: 100, step: 1 }, [["ga", "ch"]]),
    N("ga", "ui_gauge", { label: "Forno", group: "gp", min: 0, max: 100, units: "°C" }), N("ch", "ui_chart", { label: "Hist", group: "gp" }),
    N("bt", "ui_button", { label: "Ventilador", group: "gp", payload: "ligar_ventilador", payloadType: "str" }, [["dbg"]]), N("dbg", "debug", { active: true, complete: "payload" }),
  ],
  "mqtt-sensor-gauge": [
    bk, { id: "tb", type: "ui_tab", name: "Estufa" }, { id: "gp", type: "ui_group", name: "Clima", tab: "tb" },
    N("m", "mqtt in", { topic: "estufa/sensorDHT", qos: "0", datatype: "auto", broker: "broker" }, [["j"]]), N("j", "json", { property: "payload", action: "" }, [["f"]]),
    N("f", "function", { func: "msg.payload = msg.payload.temperatura;\nreturn msg;", outputs: 1 }, [["ga"]]), N("ga", "ui_gauge", { label: "T", group: "gp", min: 0, max: 50, units: "°C" }),
  ],
  "mqtt-ventilador": com(S("mqtt-ventilador"), { entrada: [["sw"]] }, [
    N("sw", "switch", { property: "payload.temperatura", propertyType: "msg", rules: [{ t: "gt", v: "35", vt: "num" }], checkall: "true" }, [["c"]]),
    N("c", "change", { rules: [set("ligar_ventilador")] }, [["o"]]), N("o", "mqtt out", { topic: "estufa/ventilador/comando", qos: "0", retain: "false", broker: "broker" }),
  ]),
  "projeto-final-estufa": [
    bk, { id: "tb", type: "ui_tab", name: "Estufa" }, { id: "gp", type: "ui_group", name: "Clima", tab: "tb" },
    N("m", "mqtt in", { topic: "estufa/sensorDHT", qos: "0", datatype: "auto", broker: "broker" }, [["j"]]), N("j", "json", { property: "payload", action: "" }, [["f"]]),
    N("f", "function", { func: "msg.payload = msg.payload.temperatura;\nreturn msg;", outputs: 1 }, [["ga", "sw"]]), N("ga", "ui_gauge", { label: "T", group: "gp", min: 0, max: 50, units: "°C" }),
    N("sw", "switch", { property: "payload", propertyType: "msg", rules: [{ t: "gt", v: "35", vt: "num" }, { t: "lte", v: "35", vt: "num" }], checkall: "true" }, [["c1"], ["c2"]]),
    N("c1", "change", { rules: [set("ligar_ventilador")] }, [["o"]]), N("c2", "change", { rules: [set("desligar_ventilador")] }, [["o"]]),
    N("o", "mqtt out", { topic: "estufa/ventilador/comando", qos: "0", retain: "false", broker: "broker" }),
  ],
};
