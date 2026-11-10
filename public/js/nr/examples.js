/* Fluxos de exemplo para o Laboratório livre (menu ☰). */
(function () {
  const broker = { id: "ex-broker", type: "mqtt-broker", name: "", broker: "test.mosquitto.org", port: "1883" };
  window.NRExamples = [
    {
      titulo: "Primeiro fluxo (Inject → Change → Debug)",
      flow: [
        { id: "a1", type: "inject", name: "", props: [{ p: "payload", v: "", vt: "date" }], repeat: "", crontab: "", once: false, onceDelay: 0.1, x: 140, y: 100, wires: [["a2"]] },
        { id: "a2", type: "change", name: "", rules: [{ t: "set", p: "payload", pt: "msg", to: "Bem vindo ao curso", tot: "str" }], x: 340, y: 100, wires: [["a3"]] },
        { id: "a3", type: "debug", name: "", active: true, complete: "payload", x: 540, y: 100, wires: [] },
      ],
    },
    {
      titulo: "JSON + Switch + Function (maior de idade)",
      flow: [
        { id: "b1", type: "inject", name: "Carlos, 20", props: [{ p: "payload", v: '{"nome":"Carlos","idade":20}', vt: "json" }], repeat: "", crontab: "", once: false, onceDelay: 0.1, x: 140, y: 100, wires: [["b2"]] },
        { id: "b2", type: "switch", name: "", property: "payload.idade", propertyType: "msg", rules: [{ t: "gte", v: "18", vt: "num" }, { t: "lt", v: "18", vt: "num" }], checkall: "true", x: 330, y: 100, wires: [["b3"], ["b4"]] },
        { id: "b3", type: "function", name: "maior", func: 'msg.payload = msg.payload.nome + " é maior de idade";\nreturn msg;', outputs: 1, x: 520, y: 70, wires: [["b5"]] },
        { id: "b4", type: "function", name: "menor", func: 'msg.payload = msg.payload.nome + " é menor de idade";\nreturn msg;', outputs: 1, x: 520, y: 130, wires: [["b5"]] },
        { id: "b5", type: "debug", name: "", active: true, complete: "payload", x: 700, y: 100, wires: [] },
      ],
    },
    {
      titulo: "API: HTTP Request (usuários)",
      flow: [
        { id: "c1", type: "inject", name: "", props: [{ p: "payload", v: "", vt: "date" }], repeat: "", crontab: "", once: false, onceDelay: 0.1, x: 140, y: 100, wires: [["c2"]] },
        { id: "c2", type: "http request", name: "", method: "GET", url: "https://jsonplaceholder.typicode.com/users", ret: "obj", headers: [], x: 360, y: 100, wires: [["c3"]] },
        { id: "c3", type: "debug", name: "primeiro e-mail", active: true, complete: "payload[0].email", x: 600, y: 100, wires: [] },
      ],
    },
    {
      titulo: "Dashboard: Slider → Gauge + Chart",
      flow: [
        { id: "d0", type: "ui_tab", name: "Controle da Fábrica" },
        { id: "d00", type: "ui_group", name: "Painel Térmico", tab: "d0" },
        { id: "d1", type: "ui_slider", name: "", label: "Temperatura", group: "d00", min: 0, max: 100, step: 1, passthru: true, x: 160, y: 100, wires: [["d2", "d3"]] },
        { id: "d2", type: "ui_gauge", name: "", label: "Forno", group: "d00", min: 0, max: 100, units: "°C", gtype: "gage", x: 400, y: 70, wires: [] },
        { id: "d3", type: "ui_chart", name: "", label: "Histórico", group: "d00", x: 400, y: 130, wires: [] },
      ],
    },
    {
      titulo: "Projeto final: estufa automatizada (MQTT)",
      flow: [
        broker,
        { id: "e0", type: "ui_tab", name: "Estufa" },
        { id: "e00", type: "ui_group", name: "Clima", tab: "e0" },
        { id: "e1", type: "mqtt in", name: "", topic: "estufa/sensorDHT", qos: "0", datatype: "auto", broker: "ex-broker", x: 150, y: 120, wires: [["e2"]] },
        { id: "e2", type: "json", name: "", property: "payload", action: "", pretty: false, x: 320, y: 120, wires: [["e3"]] },
        { id: "e3", type: "function", name: "temperatura", func: "msg.payload = msg.payload.temperatura;\nreturn msg;", outputs: 1, x: 500, y: 120, wires: [["e4", "e5"]] },
        { id: "e4", type: "ui_gauge", name: "", label: "Temperatura", group: "e00", min: 0, max: 50, units: "°C", gtype: "gage", x: 700, y: 90, wires: [] },
        { id: "e5", type: "switch", name: "", property: "payload", propertyType: "msg", rules: [{ t: "gt", v: "35", vt: "num" }, { t: "lte", v: "35", vt: "num" }], checkall: "true", x: 700, y: 170, wires: [["e6"], ["e7"]] },
        { id: "e6", type: "change", name: "ligar", rules: [{ t: "set", p: "payload", pt: "msg", to: "ligar_ventilador", tot: "str" }], x: 880, y: 150, wires: [["e8"]] },
        { id: "e7", type: "change", name: "desligar", rules: [{ t: "set", p: "payload", pt: "msg", to: "desligar_ventilador", tot: "str" }], x: 880, y: 200, wires: [["e8"]] },
        { id: "e8", type: "mqtt out", name: "", topic: "estufa/ventilador/comando", qos: "0", retain: "false", broker: "ex-broker", x: 1080, y: 175, wires: [] },
      ],
    },
  ];
})();
