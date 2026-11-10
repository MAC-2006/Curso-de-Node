/* Editor visual do simulador de Node-RED (canvas SVG, paleta, fios, edição,
 * deploy). Usa o motor NRSim para executar os fluxos de verdade. */
(function () {
  "use strict";
  const { h, s, uid, toast } = NRKit;
  const { TYPES, CATEGORIES, isValid } = NRTypes;
  const clone = NRSim.deepClone;

  const CONFIG_TYPES = new Set(["ui_tab", "ui_group", "mqtt-broker"]);
  const GRID = 10;

  function mount(container, options) {
    options = options || {};
    const exam = options.mode === "prova";
    let nodes = clone(options.flow || []);
    nodes.forEach((n) => {
      if (!n.id) n.id = uid();
    });

    let selection = new Set();
    let selWire = null; // { src, out, dst }
    let sim = null;
    let statusMap = {};
    let deployedJSON = nodes.length ? null : "[]";
    let deployedMap = {};
    let speed = 1;
    let history = [JSON.stringify(nodes)];
    let future = [];
    let dragging = false;
    let renderPending = false;
    let destroyed = false;
    let changeTimer = null;
    let lastDown = { id: null, t: 0 };

    const def = (n) => TYPES[n.type];
    const isVisNode = (n) => !!TYPES[n.type] && !CONFIG_TYPES.has(n.type);
    const visNodes = () => nodes.filter(isVisNode);
    const outCount = (n) => {
      const o = def(n).outputs;
      return typeof o === "function" ? o(n) : o;
    };
    const byId = (id) => nodes.find((n) => n.id === id);

    // ------------------------------------------------------------ estrutura DOM
    const root = h("div", { class: "nr-root" + (exam ? " nr-exam" : ""), tabindex: "0" });
    const toastHost = h("div", { class: "nr-toasts" });
    const headerSlot = h("div", { class: "nr-header-slot" });
    const speedSel = h("select", { class: "nr-speed", title: "Velocidade do tempo simulado", onchange: () => { speed = Number(speedSel.value); if (sim) sim.clock.setSpeed(speed); } }, [1, 5, 20, 60].map((v) => h("option", { value: v }, v + "×")));
    const deployBtn = h("button", { type: "button", class: "nr-deploy", onclick: () => deploy() }, "Deploy");
    const menuBtn = exam ? null : h("button", { type: "button", class: "nr-btn nr-btn-ghost", onclick: (e) => openMenu(e.currentTarget) }, "☰ Menu");
    const header = h(
      "header",
      { class: "nr-header" },
      h("div", { class: "nr-logo" }, h("span", { class: "nr-logo-mark" }, "⬡"), h("strong", {}, "Node-RED"), h("small", {}, "simulador")),
      headerSlot,
      h("div", { class: "nr-header-right" }, h("label", { class: "nr-speed-label" }, "tempo", speedSel), menuBtn, deployBtn)
    );

    // paleta
    const palette = h("aside", { class: "nr-palette" });
    const palSearch = h("input", { class: "nr-input", placeholder: "filtrar nodes", oninput: () => buildPalette() });
    const palList = h("div", { class: "nr-pal-list" });
    palette.appendChild(h("div", { class: "nr-pal-head" }, palSearch));
    palette.appendChild(palList);

    function paletteLabel(type) {
      const d = TYPES[type];
      return d.cat === "dashboard" ? type.replace("ui_", "") : type;
    }
    function buildPalette() {
      palList.innerHTML = "";
      const q = palSearch.value.trim().toLowerCase();
      CATEGORIES.forEach(([cat, label]) => {
        const types = Object.keys(TYPES).filter((t) => TYPES[t].cat === cat && (!options.paleta || options.paleta.includes(t)) && (!q || paletteLabel(t).toLowerCase().includes(q)));
        if (!types.length) return;
        const det = h("details", { class: "nr-pal-cat", open: true }, h("summary", {}, label));
        types.forEach((t) => {
          const d = TYPES[t];
          const item = h("div", { class: "nr-pal-node", "data-type": t, title: "Arraste para a área de trabalho (ou dê duplo clique)" }, h("span", { class: "nr-pal-icon", style: { background: d.color } }, d.icon), h("span", { class: "nr-pal-label" }, paletteLabel(t)));
          item.addEventListener("pointerdown", (e) => startPaletteDrag(e, t));
          item.addEventListener("dblclick", () => {
            const r = wrap.getBoundingClientRect();
            const k = visNodes().length;
            addNode(t, wrap.scrollLeft + 160 + (k % 4) * 30, wrap.scrollTop + 60 + (k % 9) * 50);
          });
          det.appendChild(item);
        });
        palList.appendChild(det);
      });
    }

    // canvas
    const wrap = h("div", { class: "nr-canvas-wrap" });
    const svg = s("svg", { class: "nr-canvas", width: 2400, height: 1600 });
    const gWires = s("g", { class: "nr-wires" });
    const gNodes = s("g", { class: "nr-nodes" });
    const gTemp = s("g", { class: "nr-temp" });
    svg.appendChild(gWires);
    svg.appendChild(gNodes);
    svg.appendChild(gTemp);
    wrap.appendChild(svg);
    const workspace = h("main", { class: "nr-workspace" }, h("div", { class: "nr-tabs" }, h("div", { class: "nr-tab" }, "Fluxo 1")), wrap);

    // barra lateral
    const sb = NRSidebar.create({
      exam,
      challenge: options.desafio || null,
      getNodes: () => nodes,
      getSim: () => sim,
      selectNode: (id) => {
        selection = new Set([id]);
        selWire = null;
        render();
        sb.setSelection(byId(id));
        const g = geom(byId(id));
        if (g) wrap.scrollTo({ left: Math.max(0, g.x - wrap.clientWidth / 2), top: Math.max(0, g.y - wrap.clientHeight / 2), behavior: "smooth" });
      },
      toast: (m, k) => toast(toastHost, m, k),
      addConfig: (c) => {
        nodes.push(c);
        commit();
        render();
      },
      updateConfig: (id, ch) => {
        const c = byId(id);
        if (c) Object.assign(c, ch);
        commit();
        render();
      },
      removeConfig: (id) => {
        const inUse = nodes.filter((n) => n.group === id || n.tab === id);
        nodes = nodes.filter((n) => n.id !== id);
        // desfaz referências (grupos da aba removida e nodes do grupo removido)
        nodes.forEach((n) => {
          if (n.group === id) n.group = "";
        });
        const orphanGroups = nodes.filter((n) => n.type === "ui_group" && !byId(n.tab));
        nodes = nodes.filter((n) => !orphanGroups.includes(n));
        nodes.forEach((n) => {
          if (orphanGroups.some((g) => g.id === n.group)) n.group = "";
        });
        void inUse;
        commit();
        render();
      },
    });

    root.appendChild(header);
    root.appendChild(h("div", { class: "nr-body" }, palette, workspace, sb.el));
    root.appendChild(toastHost);
    container.appendChild(root);
    buildPalette();

    // ------------------------------------------------------------ geometria
    function geom(n) {
      if (!n || !def(n)) return null;
      const label = def(n).label(n) || "";
      const outs = outCount(n);
      const w = Math.max(100, Math.ceil(label.length * 7.4) + 56);
      const hgt = Math.max(30, outs * 18 + 12);
      return { x: n.x || 0, y: n.y || 0, w, h: hgt, outs };
    }
    const portY = (g, i) => g.y + (i - (g.outs - 1) / 2) * 18;

    function wirePath(x1, y1, x2, y2) {
      const dx = Math.max(35, Math.abs(x2 - x1) * 0.5);
      return `M ${x1} ${y1} C ${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
    }

    // ------------------------------------------------------------ renderização
    function scheduleRender() {
      if (renderPending || dragging) return;
      renderPending = true;
      requestAnimationFrame(() => {
        renderPending = false;
        if (!destroyed) render();
      });
    }
    function currentJSON() {
      return JSON.stringify(nodes);
    }
    function refreshDeployState() {
      deployBtn.disabled = deployedJSON === currentJSON();
    }

    function render() {
      gNodes.innerHTML = "";
      gWires.innerHTML = "";
      const vis = visNodes();
      const map = {};
      vis.forEach((n) => (map[n.id] = n));
      let maxX = 1200;
      let maxY = 700;
      vis.forEach((n) => {
        drawNode(n);
        const g = geom(n);
        maxX = Math.max(maxX, g.x + g.w + 200);
        maxY = Math.max(maxY, g.y + g.h + 200);
      });
      vis.forEach((n) => {
        (n.wires || []).forEach((targets, i) =>
          (targets || []).forEach((tid) => {
            if (map[tid]) drawWire(n, i, map[tid]);
          })
        );
      });
      svg.setAttribute("width", Math.max(wrap.clientWidth, maxX));
      svg.setAttribute("height", Math.max(wrap.clientHeight, maxY));
      refreshDeployState();
    }

    function drawWire(src, out, dst) {
      const a = geom(src);
      const b = geom(dst);
      const d = wirePath(a.x + a.w / 2, portY(a, out), b.x - b.w / 2, b.y);
      const sel = selWire && selWire.src === src.id && selWire.out === out && selWire.dst === dst.id;
      const g = s("g", { class: "nr-wire" + (sel ? " selected" : ""), "data-src": src.id, "data-out": out, "data-dst": dst.id });
      g.appendChild(s("path", { d, class: "nr-wire-hit", "data-role": "wire" }));
      g.appendChild(s("path", { d, class: "nr-wire-line" }));
      gWires.appendChild(g);
    }

    function drawNode(n) {
      const d = def(n);
      const g = geom(n);
      const invalid = !isValid(n, nodes);
      const changed = deployedMap[n.id] !== JSON.stringify(n);
      const cls = "nr-node" + (selection.has(n.id) ? " selected" : "") + (invalid ? " invalid" : "") + (n.locked ? " locked" : "") + (n.type === "comment" ? " comment" : "");
      const grp = s("g", { class: cls, "data-id": n.id, transform: `translate(${g.x - g.w / 2},${g.y - g.h / 2})` });
      grp.appendChild(s("rect", { class: "nr-node-body", "data-role": "node", width: g.w, height: g.h, rx: 5, fill: d.color }));
      if (n.type !== "comment") {
        grp.appendChild(s("path", { class: "nr-node-iconbg", "data-role": "node", d: `M5 0 H30 V${g.h} H5 A5 5 0 0 1 0 ${g.h - 5} V5 A5 5 0 0 1 5 0 Z` }));
        grp.appendChild(s("text", { class: "nr-icon", "data-role": "node", x: 15, y: g.h / 2 + 5, "text-anchor": "middle" }, d.icon));
      }
      grp.appendChild(s("text", { class: "nr-label", "data-role": "node", x: n.type === "comment" ? 8 : 38, y: g.h / 2 + 5 }, d.label(n)));
      if (d.inputs > 0) grp.appendChild(s("rect", { class: "nr-port nr-port-in", "data-role": "in-port", x: -5, y: g.h / 2 - 5, width: 10, height: 10, rx: 2 }));
      for (let i = 0; i < g.outs && !(d.outputs === 0); i++) {
        grp.appendChild(s("rect", { class: "nr-port nr-port-out", "data-role": "out-port", "data-out": i, x: g.w - 5, y: portY(g, i) - g.y + g.h / 2 - 5, width: 10, height: 10, rx: 2 }));
      }
      if (n.type === "inject") {
        const b = s("g", { class: "nr-side-btn", "data-role": "inject-btn", transform: `translate(-24,${g.h / 2 - 10})` }, s("rect", { width: 20, height: 20, rx: 3, "data-role": "inject-btn" }), s("rect", { x: 6, y: 6, width: 8, height: 8, rx: 1, class: "nr-btn-dot", "data-role": "inject-btn" }));
        grp.appendChild(b);
      }
      if (n.type === "debug") {
        const b = s("g", { class: "nr-side-btn", "data-role": "debug-btn", transform: `translate(${g.w + 4},${g.h / 2 - 10})` }, s("rect", { width: 20, height: 20, rx: 3, "data-role": "debug-btn" }), s("circle", { cx: 10, cy: 10, r: 4, class: "nr-debug-dot" + (n.active === false ? " off" : ""), "data-role": "debug-btn" }));
        grp.appendChild(b);
      }
      const st = statusMap[n.id];
      if (st) {
        const col = { green: "#2e9d4f", red: "#d9402f", blue: "#2f7fd1", yellow: "#d9a21f", grey: "#888" }[st.fill] || "#888";
        grp.appendChild(s("circle", { cx: 6, cy: g.h + 9, r: 4, fill: st.shape === "ring" ? "#fff" : col, stroke: col, "stroke-width": 1.5 }));
        grp.appendChild(s("text", { class: "nr-status", x: 14, y: g.h + 13 }, st.text || ""));
      }
      if (invalid) grp.appendChild(s("text", { class: "nr-invalid-mark", x: g.w - 8, y: 3 }, "▲"));
      else if (changed) grp.appendChild(s("circle", { class: "nr-changed", cx: g.w - 4, cy: 0, r: 4 }));
      if (n.locked) grp.appendChild(s("text", { class: "nr-lock", x: g.w - 14, y: g.h - 4 }, "🔒"));
      gNodes.appendChild(grp);
    }

    // ------------------------------------------------------------ histórico
    function commit() {
      const j = currentJSON();
      if (j !== history[history.length - 1]) {
        history.push(j);
        if (history.length > 60) history.shift();
        future = [];
      }
      refreshDeployState();
      if (options.onChange) {
        clearTimeout(changeTimer);
        changeTimer = setTimeout(() => options.onChange(clone(nodes)), 700);
      }
      sb.layoutChanged();
    }
    function restore(json) {
      nodes = JSON.parse(json);
      selection = new Set();
      selWire = null;
      render();
      if (options.onChange) options.onChange(clone(nodes));
      sb.layoutChanged();
    }
    function undo() {
      if (history.length < 2) return;
      future.push(history.pop());
      restore(history[history.length - 1]);
    }
    function redo() {
      if (!future.length) return;
      const j = future.pop();
      history.push(j);
      restore(j);
    }

    // ------------------------------------------------------------ edição básica
    function fixWires(n) {
      const c = outCount(n);
      const w = (n.wires || []).slice(0, c);
      while (w.length < c) w.push([]);
      n.wires = w;
    }
    function addNode(type, x, y) {
      const d = TYPES[type];
      if (!d) return null;
      const n = Object.assign({ id: uid(), type, x: Math.round(x / GRID) * GRID, y: Math.round(y / GRID) * GRID, z: "flow1" }, d.defaults());
      fixWires(n);
      nodes.push(n);
      selection = new Set([n.id]);
      selWire = null;
      commit();
      render();
      sb.setSelection(n);
      return n;
    }
    function removeNode(id) {
      const n = byId(id);
      if (!n || n.locked) return false;
      nodes = nodes.filter((x) => x.id !== id);
      nodes.forEach((x) => {
        if (x.wires) x.wires = x.wires.map((w) => (w || []).filter((t) => t !== id));
      });
      return true;
    }
    function deleteSelection() {
      let blocked = false;
      if (selWire) {
        const src = byId(selWire.src);
        if (src && src.wires[selWire.out]) src.wires[selWire.out] = src.wires[selWire.out].filter((t) => t !== selWire.dst);
        selWire = null;
      }
      for (const id of selection) if (!removeNode(id)) blocked = true;
      selection = new Set();
      if (blocked) toast(toastHost, "Nodes do desafio (com 🔒) não podem ser excluídos.", "warn");
      commit();
      render();
      sb.setSelection(null);
    }
    function connect(srcId, out, dstId) {
      const src = byId(srcId);
      const dst = byId(dstId);
      if (!src || !dst || srcId === dstId || def(dst).inputs < 1) return false;
      fixWires(src);
      if (out >= src.wires.length) return false;
      if (src.wires[out].includes(dstId)) return false;
      src.wires[out].push(dstId);
      return true;
    }

    // ------------------------------------------------------------ ponteiro
    function pt(e) {
      const r = svg.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function targetInfo(e) {
      const el = e.target.closest ? e.target.closest("[data-role]") : null;
      if (!el) return {};
      const role = el.getAttribute("data-role");
      const nodeEl = el.closest(".nr-node");
      const wireEl = el.closest(".nr-wire");
      return {
        role,
        id: nodeEl ? nodeEl.getAttribute("data-id") : null,
        out: el.getAttribute("data-out") !== null ? Number(el.getAttribute("data-out")) : null,
        wire: wireEl ? { src: wireEl.getAttribute("data-src"), out: Number(wireEl.getAttribute("data-out")), dst: wireEl.getAttribute("data-dst") } : null,
      };
    }

    svg.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      root.focus({ preventScroll: true });
      const t = targetInfo(e);
      const p0 = pt(e);

      if (t.role === "inject-btn") {
        if (!sim) toast(toastHost, "Faça o Deploy antes de injetar.", "warn");
        else if (!sim.fire(t.id)) toast(toastHost, "Este node ainda não foi implantado — clique em Deploy.", "warn");
        return;
      }
      if (t.role === "debug-btn") {
        const n = byId(t.id);
        n.active = n.active === false;
        if (sim && sim.nodes[n.id]) sim.nodes[n.id].cfg.active = n.active;
        deployedMap[n.id] = JSON.stringify(n);
        render();
        return;
      }
      if (t.role === "out-port") {
        startWireDrag(e, t.id, t.out);
        return;
      }
      if (t.role === "wire") {
        selection = new Set();
        selWire = t.wire;
        render();
        sb.setSelection(null);
        return;
      }
      if (t.role === "node" || t.role === "in-port") {
        const n = byId(t.id);
        const nowT = Date.now();
        if (lastDown.id === t.id && nowT - lastDown.t < 400 && !e.shiftKey) {
          lastDown = { id: null, t: 0 };
          openEditor(n);
          return;
        }
        lastDown = { id: t.id, t: nowT };
        if (e.shiftKey) {
          if (selection.has(t.id)) selection.delete(t.id);
          else selection.add(t.id);
        } else if (!selection.has(t.id)) selection = new Set([t.id]);
        selWire = null;
        render();
        sb.setSelection(selection.size === 1 ? n : null);
        startMove(e, p0);
        return;
      }
      // fundo: seleção por retângulo
      if (!e.shiftKey) selection = new Set();
      selWire = null;
      render();
      sb.setSelection(null);
      startRubber(e, p0);
    });

    function startMove(e, p0) {
      const starts = {};
      selection.forEach((id) => {
        const n = byId(id);
        starts[id] = { x: n.x, y: n.y };
      });
      let moved = false;
      dragging = true;
      const move = (ev) => {
        const p = pt(ev);
        const dx = p.x - p0.x;
        const dy = p.y - p0.y;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        selection.forEach((id) => {
          const n = byId(id);
          n.x = Math.max(60, Math.round((starts[id].x + dx) / GRID) * GRID);
          n.y = Math.max(20, Math.round((starts[id].y + dy) / GRID) * GRID);
        });
        dragging = false;
        render();
        dragging = true;
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        dragging = false;
        if (moved) {
          commit();
          render();
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    function startWireDrag(e, srcId, out) {
      const src = byId(srcId);
      const a = geom(src);
      const sx = a.x + a.w / 2;
      const sy = portY(a, out);
      dragging = true;
      const path = s("path", { class: "nr-wire-temp", d: wirePath(sx, sy, sx, sy) });
      gTemp.appendChild(path);
      const move = (ev) => {
        const p = pt(ev);
        path.setAttribute("d", wirePath(sx, sy, p.x, p.y));
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gTemp.innerHTML = "";
        dragging = false;
        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        const nodeEl = el && el.closest ? el.closest(".nr-node") : null;
        if (nodeEl) {
          const ok = connect(srcId, out, nodeEl.getAttribute("data-id"));
          if (ok) commit();
        }
        render();
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    function startRubber(e, p0) {
      const rect = s("rect", { class: "nr-rubber", x: p0.x, y: p0.y, width: 0, height: 0 });
      gTemp.appendChild(rect);
      dragging = true;
      const move = (ev) => {
        const p = pt(ev);
        rect.setAttribute("x", Math.min(p.x, p0.x));
        rect.setAttribute("y", Math.min(p.y, p0.y));
        rect.setAttribute("width", Math.abs(p.x - p0.x));
        rect.setAttribute("height", Math.abs(p.y - p0.y));
      };
      const up = (ev) => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        gTemp.innerHTML = "";
        dragging = false;
        const p = pt(ev);
        const x0 = Math.min(p.x, p0.x), x1 = Math.max(p.x, p0.x), y0 = Math.min(p.y, p0.y), y1 = Math.max(p.y, p0.y);
        if (x1 - x0 > 4 || y1 - y0 > 4) {
          visNodes().forEach((n) => {
            if (n.x >= x0 && n.x <= x1 && n.y >= y0 && n.y <= y1) selection.add(n.id);
          });
          render();
          sb.setSelection(selection.size === 1 ? byId([...selection][0]) : null);
        }
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }

    // (o duplo clique é detectado no pointerdown, pois o canvas é redesenhado a cada clique)

    // arrastar da paleta
    function startPaletteDrag(e, type) {
      if (e.button !== 0) return;
      e.preventDefault();
      const d = TYPES[type];
      const ghost = h("div", { class: "nr-ghost", style: { background: d.color } }, d.icon + " " + paletteLabel(type));
      document.body.appendChild(ghost);
      const place = (ev) => {
        ghost.style.left = ev.clientX + 6 + "px";
        ghost.style.top = ev.clientY + 6 + "px";
      };
      place(e);
      const up = (ev) => {
        window.removeEventListener("pointermove", place);
        window.removeEventListener("pointerup", up);
        ghost.remove();
        const r = wrap.getBoundingClientRect();
        if (ev.clientX > r.left && ev.clientX < r.right && ev.clientY > r.top && ev.clientY < r.bottom) {
          const p = pt(ev);
          addNode(type, p.x, p.y);
        }
      };
      window.addEventListener("pointermove", place);
      window.addEventListener("pointerup", up);
    }

    // teclado
    const onKey = (e) => {
      if (destroyed) return;
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (root.querySelector(".nr-tray")) return;
      if (!root.contains(document.activeElement) && document.activeElement !== document.body) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selection.size || selWire) {
          e.preventDefault();
          deleteSelection();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        selection = new Set(visNodes().map((n) => n.id));
        render();
      } else if (e.key === "Escape") {
        selection = new Set();
        selWire = null;
        render();
      }
    };
    document.addEventListener("keydown", onKey);

    // ------------------------------------------------------------ edição (bandeja)
    function closeTray() {
      const t = root.querySelector(".nr-tray-overlay");
      if (t) t.remove();
    }
    function openEditor(n) {
      if (!n) return;
      closeTray();
      const d = def(n);
      const overlay = h("div", { class: "nr-tray-overlay" });
      const tray = h("div", { class: "nr-tray" });
      const body = h("div", { class: "nr-tray-body" });
      let built = null;
      const title = h("div", { class: "nr-tray-title" }, "Editar node " + n.type);
      const footer = h("div", { class: "nr-tray-footer" });
      if (n.locked) {
        body.appendChild(h("div", { class: "nr-hint nr-warnbox" }, "🔒 Este node faz parte do desafio e não pode ser editado ou excluído. Conecte-o aos seus nodes."));
        body.appendChild(h("div", { class: "nr-help", html: d.help || "" }));
        footer.appendChild(h("button", { type: "button", class: "nr-btn", onclick: closeTray }, "Fechar"));
      } else {
        built = d.form(n, { nodes });
        body.appendChild(built.el);
        body.appendChild(h("details", { class: "nr-tray-help" }, h("summary", {}, "Ajuda"), h("div", { class: "nr-help", html: d.help || "" })));
        footer.appendChild(h("button", { type: "button", class: "nr-btn nr-btn-danger", onclick: () => { closeTray(); selection = new Set([n.id]); deleteSelection(); } }, "Excluir"));
        footer.appendChild(h("span", { class: "nr-grow" }));
        footer.appendChild(h("button", { type: "button", class: "nr-btn", onclick: closeTray }, "Cancelar"));
        footer.appendChild(
          h("button", { type: "button", class: "nr-btn nr-btn-primary", onclick: () => {
            const ch = built.collect();
            const cfgs = ch.configs || [];
            delete ch.configs;
            Object.assign(n, ch);
            cfgs.forEach((c) => {
              const ex = byId(c.id);
              if (ex) Object.assign(ex, c);
              else nodes.push(c);
            });
            fixWires(n);
            closeTray();
            commit();
            render();
            sb.setSelection(n);
          } }, "Concluído")
        );
      }
      tray.appendChild(title);
      tray.appendChild(body);
      tray.appendChild(footer);
      overlay.appendChild(tray);
      overlay.addEventListener("pointerdown", (e) => {
        if (e.target === overlay) closeTray();
      });
      root.appendChild(overlay);
      const first = body.querySelector("input,textarea,select");
      if (first && !n.locked) first.focus({ preventScroll: true });
    }

    // ------------------------------------------------------------ deploy
    function stopSim() {
      if (sim) sim.stop();
      sim = null;
    }
    function deploy(silent) {
      stopSim();
      statusMap = {};
      const flow = clone(nodes);
      sim = NRSim.create({
        flow,
        clock: "real",
        runFunction: NRSandbox.runFunction,
        on: {
          debug: (e) => sb.onDebug(e),
          status: (id, st) => {
            statusMap[id] = st;
            scheduleRender();
          },
          ui: (id, st) => sb.onUi(id, st),
          mqtt: (e) => sb.onMqtt(e),
        },
      });
      sim.clock.setSpeed(speed);
      sim.start();
      deployedJSON = currentJSON();
      deployedMap = {};
      nodes.forEach((n) => (deployedMap[n.id] = JSON.stringify(n)));
      const bad = visNodes().filter((n) => !isValid(n, nodes)).length;
      if (!silent) toast(toastHost, bad ? `Deploy realizado, mas ${bad} node(s) com configuração incompleta (▲).` : "Deploy realizado com sucesso.", bad ? "warn" : "ok");
      render();
      sb.onDeploy();
      if (options.onDeploy) options.onDeploy(clone(nodes));
    }

    // ------------------------------------------------------------ menu (modo livre)
    function modal(title, content, actions) {
      const overlay = h("div", { class: "nr-tray-overlay nr-center" });
      const box = h("div", { class: "nr-modal" }, h("div", { class: "nr-tray-title" }, title), h("div", { class: "nr-tray-body" }, content), h("div", { class: "nr-tray-footer" }, actions(() => overlay.remove())));
      overlay.appendChild(box);
      overlay.addEventListener("pointerdown", (e) => {
        if (e.target === overlay) overlay.remove();
      });
      root.appendChild(overlay);
    }
    function loadFlow(flow) {
      nodes = clone(flow);
      nodes.forEach((n) => {
        if (!n.id) n.id = uid();
        if (TYPES[n.type]) fixWires(n);
      });
      selection = new Set();
      selWire = null;
      commit();
      render();
      sb.setSelection(null);
    }
    function openMenu(anchor) {
      const old = root.querySelector(".nr-menu");
      if (old) {
        old.remove();
        return;
      }
      const menu = h("div", { class: "nr-menu" });
      const item = (label, fn) => menu.appendChild(h("button", { type: "button", onclick: () => { menu.remove(); fn(); } }, label));
      (window.NRExamples || []).forEach((ex) => item("Exemplo: " + ex.titulo, () => loadFlow(ex.flow)));
      menu.appendChild(h("hr"));
      item("Importar fluxo (JSON)…", () => {
        const ta = h("textarea", { class: "nr-input nr-mono", rows: 12, placeholder: "Cole aqui o JSON do fluxo" });
        modal("Importar fluxo", ta, (close) => [
          h("button", { type: "button", class: "nr-btn", onclick: close }, "Cancelar"),
          h("button", { type: "button", class: "nr-btn nr-btn-primary", onclick: () => {
            try {
              const j = JSON.parse(ta.value);
              if (!Array.isArray(j)) throw new Error("O JSON precisa ser uma lista de nodes.");
              loadFlow(j.filter((x) => x && typeof x === "object" && x.type && x.type !== "tab"));
              close();
            } catch (e) {
              toast(toastHost, "JSON inválido: " + e.message, "error");
            }
          } }, "Importar"),
        ]);
      });
      item("Exportar fluxo (JSON)…", () => {
        const ta = h("textarea", { class: "nr-input nr-mono", rows: 14, readonly: true });
        ta.value = JSON.stringify(nodes, null, 2);
        modal("Exportar fluxo", ta, (close) => [h("button", { type: "button", class: "nr-btn nr-btn-primary", onclick: close }, "Fechar")]);
        ta.select();
      });
      item("Limpar tudo", () => {
        if (window.confirm("Remover todos os nodes do fluxo?")) loadFlow([]);
      });
      anchor.parentElement.appendChild(menu);
      const closer = (e) => {
        if (!menu.contains(e.target) && e.target !== anchor) {
          menu.remove();
          document.removeEventListener("pointerdown", closer);
        }
      };
      setTimeout(() => document.addEventListener("pointerdown", closer), 0);
    }

    render();
    if (nodes.length === 0) deploy(true);
    else if (options.autoDeploy) deploy(true);

    return {
      el: root,
      slots: { header: headerSlot },
      getFlow: () => clone(nodes),
      setFlow: loadFlow,
      deploy,
      showResults: (r) => sb.showResults(r),
      toast: (m, k) => toast(toastHost, m, k),
      destroy() {
        destroyed = true;
        document.removeEventListener("keydown", onKey);
        clearTimeout(changeTimer);
        stopSim();
        sb.destroy();
        root.remove();
      },
    };
  }

  window.NREditor = { mount };
})();
