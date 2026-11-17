/* Mapa interativo: zonas e linhas, filtros, selecao por clique/area/grafico e graficos ligados */
(function () {
  const D = window.TMLD, C = window.TMLC, T = window.TML;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = (v, d = 1) => (v === v && isFinite(v) ? v.toFixed(d).replace(".", ",") : "n.d.");
  const int = v => (v === v ? Math.round(v).toLocaleString("pt-PT") : "n.d.");
  const pc = (v, d = 0) => (v === v ? (v * 100).toFixed(d).replace(".", ",") + "%" : "n.d.");
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  const GRP_LABELS = ["Oportunidade rápida", "Intermédia", "Prioridade alta", "Estrutural (pouca população)", "Cobertura limitada", "Sem TP alcançável", "Sem população"];
  const GRP_COLORS = ["#256abf", "#ecd9b8", "#d9483b", "#d9d7d0", "#b9a89a", "#4a1010", "#efeeea"];
  const ND = { k: "nd", l: "Sem TP alcançável (180 min)", c: "#e4e3df" }, NP = { k: "np", l: "Sem população", c: "#efeeea" };
  const FEED_COL = ["#2a78d6", "#eb6834", "#1baf7a", "#8e5ad6"];

  const S = {
    mode: "zones", slot: 1, scen: 0, pen: 0, role: "from", metric: "ratio", mun: "", popMin: 0, hidden: new Set(),
    zop: 0.85, selZ: new Set(), hiZ: new Set(), zsc: null, tool: "click",
    feeds: new Set([0, 1, 2, 3]), minTrips: 0, sel: null, lscMode: "route", sortKey: null, sortDir: -1,
  };
  const slotsList = () => (S.slot === "all" ? [0, 1, 2, 3, 4, 5] : [S.slot]);
  const slotIdx = () => (S.slot === "all" ? -1 : S.slot);

  // ================================================================== mapa
  const zones = D.zones, Z = D.Z;
  const dark = matchMedia("(prefers-color-scheme: dark)").matches && document.documentElement.dataset.theme !== "light";
  const map = L.map("map", { zoomControl: true, zoomAnimation: false, minZoom: 8, maxZoom: 15, zoomSnap: 0.5, attributionControl: true });
  // mapas de base: tres estilos vetoriais gratuitos do OpenFreeMap (OpenMapTiles + OpenStreetMap), via MapLibre GL.
  // Se o WebGL falhar, recorre ao OSM raster dessaturado.
  const OFM = "https://tiles.openfreemap.org/styles/";
  const BASES = { clean: OFM + "positron", color: OFM + "bright", full: OFM + "liberty" };
  const ATTR = "&copy; <a href='https://openfreemap.org'>OpenFreeMap</a> &copy; <a href='https://openmaptiles.org/'>OpenMapTiles</a> dados de <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a>";
  map.createPane("muns"); map.getPane("muns").style.zIndex = 430; map.getPane("muns").style.pointerEvents = "none";
  let baseLayer = null, baseKey = null;
  function setBase(k) {
    if (!BASES[k]) k = "clean";
    if (baseLayer) { map.removeLayer(baseLayer); baseLayer = null; }
    try {
      baseLayer = L.maplibreGL({ style: BASES[k], attributionControl: false }).addTo(map);
      baseLayer.getMaplibreMap().on("error", e => { if (e && e.error && /style|WebGL/i.test(String(e.error.message))) fallbackBase(); });
    } catch (err) { fallbackBase(); }
    baseKey = k;
    map.attributionControl.removeAttribution(ATTR); map.attributionControl.addAttribution(ATTR);
    try { localStorage.setItem("tml-base", k); } catch (e) { /* sem armazenamento */ }
  }
  function fallbackBase() {
    if (baseLayer) map.removeLayer(baseLayer);
    baseLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 15, className: "basemap", attribution: "&copy; OpenStreetMap" }).addTo(map);
  }

  const zl = [];
  const zoneLayer = L.geoJSON(T.zones, {
    style: () => ({ weight: 0.5, color: css("--surface"), fillOpacity: 0.8 }),
    onEachFeature: (f, l) => {
      const i = f.properties.z - 1; zl[i] = l;
      l.on("click", e => { if (S.tool === "click") { L.DomEvent.stopPropagation(e); toggleZone(i, e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey); } });
      l.bindTooltip(() => zoneTip(i), { sticky: true, direction: "top", opacity: 1 });
    },
  }).addTo(map);
  const munLayer = L.geoJSON(T.muns, { pane: "muns", interactive: false, style: { fill: false, color: css("--ink2"), weight: 1, opacity: 0.55 } }).addTo(map);
  map.fitBounds(zoneLayer.getBounds(), { padding: [10, 10] });
  const homeBounds = zoneLayer.getBounds();
  let savedBase = "clean";
  try { savedBase = localStorage.getItem("tml-base") || "clean"; } catch (e) { /* sem armazenamento */ }
  setBase(savedBase);
  $("#fBase").value = BASES[savedBase] ? savedBase : "clean";
  $("#fBase").addEventListener("change", e => setBase(e.target.value));
  $("#fZop").addEventListener("input", e => { S.zop = +e.target.value / 100; if (S.mode === "zones" && typeof ZM !== "undefined" && ZM) zl.forEach((l, i) => l.setStyle(zoneStyle(i))); });

  // ---- camada de linhas em canvas proprio (ordem de desenho e larguras controladas)
  const LinesLayer = L.Layer.extend({
    onAdd(m) {
      this._map = m; this._c = L.DomUtil.create("canvas", "tml-lines"); this._c.style.position = "absolute"; this._c.style.pointerEvents = "none";
      m.getPane("overlayPane").appendChild(this._c); m.on("moveend resize zoomend", this._reset, this); this._reset();
    },
    onRemove(m) { L.DomUtil.remove(this._c); m.off("moveend resize zoomend", this._reset, this); },
    _reset() {
      const m = this._map, s = m.getSize(), pad = 0.5, dpr = window.devicePixelRatio || 1;
      this._pad = pad; this._size = s;
      const tl = m.containerPointToLayerPoint([-s.x * pad, -s.y * pad]);
      L.DomUtil.setPosition(this._c, tl);
      this._c.width = s.x * (1 + 2 * pad) * dpr; this._c.height = s.y * (1 + 2 * pad) * dpr;
      this._c.style.width = s.x * (1 + 2 * pad) + "px"; this._c.style.height = s.y * (1 + 2 * pad) + "px";
      this._dpr = dpr; this._tl = tl;
      const G = D.corGeom, P = new Array(G.length);
      for (let i = 0; i < G.length; i++) {
        const g = G[i].g, a = new Float32Array(g.length * 2);
        for (let k = 0; k < g.length; k++) { const p = m.latLngToLayerPoint([g[k][1], g[k][0]]); a[2 * k] = p.x - tl.x; a[2 * k + 1] = p.y - tl.y; }
        P[i] = a;
      }
      this._P = P; this.redraw();
    },
    redraw() {
      if (!this._P || !this.st) return;
      const g = this._c.getContext("2d"), st = this.st, P = this._P, z = this._map.getZoom();
      g.setTransform(this._dpr, 0, 0, this._dpr, 0, 0); g.clearRect(0, 0, this._c.width, this._c.height);
      g.lineCap = "round"; g.lineJoin = "round";
      const zf = Math.max(0.6, Math.min(2.2, 0.45 + 0.17 * (z - 8.5)));
      const path = a => { g.beginPath(); g.moveTo(a[0], a[1]); for (let k = 2; k < a.length; k += 2) g.lineTo(a[k], a[k + 1]); };
      if (st.hiAny) {
        g.strokeStyle = css("--ink"); g.globalAlpha = 0.9;
        for (const i of st.order) if (st.hi[i]) { g.lineWidth = st.wid[i] * zf + 3.5; path(P[i]); g.stroke(); }
      }
      for (const i of st.order) {
        g.globalAlpha = st.alpha[i]; g.strokeStyle = st.col[i]; g.lineWidth = st.wid[i] * zf; path(P[i]); g.stroke();
      }
      g.globalAlpha = 1; this._zf = zf;
    },
    hit(cp) {
      if (!this._P || !this.st) return -1;
      const st = this.st, x = cp.x + this._size.x * this._pad, y = cp.y + this._size.y * this._pad;
      let best = -1, bd = 1e9;
      for (const i of st.order) {
        const a = this._P[i], tol = Math.max(5, (st.wid[i] * (this._zf || 1)) / 2 + 3);
        for (let k = 0; k < a.length - 2; k += 2) {
          const ax = a[k], ay = a[k + 1], bx = a[k + 2], by = a[k + 3];
          if ((x < Math.min(ax, bx) - tol) || (x > Math.max(ax, bx) + tol) || (y < Math.min(ay, by) - tol) || (y > Math.max(ay, by) + tol)) continue;
          const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
          let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
          const d = Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
          if (d < tol && d <= bd) { bd = d; best = i; }
        }
      }
      return best;
    },
  });
  const linesLayer = new LinesLayer();

  // ================================================================== zonas: metricas, classes, estilo
  let ZM = null, REF = {}, ZP = null;
  const DIFF_E = [40, 55, 70, 85, 100, 115], REACH_E = [0.3, 0.5, 0.7, 0.85, 0.95], POP_E = [2000, 5000, 10000, 20000, 40000];
  const bin = (v, e) => { let k = 0; while (k < e.length && v >= e[k]) k++; return k; };
  const METRICS = {
    ratio: { title: "Razão TP / carro", items: D.CLS_LABELS.map((l, k) => ({ k, l, c: D.CLS_COLORS[k] })).concat([ND, NP]), val: i => ZM.ratio[i], cls: i => { const r = ZM.ratio[i]; return zones[i].pop < 100 ? "np" : r === r ? D.cls(r) : "nd"; } },
    diff: { title: "Diferença TP - carro (min)", items: ["< 40", "40 a 55", "55 a 70", "70 a 85", "85 a 100", "100 a 115", "> 115"].map((l, k) => ({ k, l, c: D.SEQ_BLUE[k] })).concat([ND, NP]), val: i => ZM.diff[i], cls: i => { const r = ZM.diff[i]; return zones[i].pop < 100 ? "np" : r === r ? bin(r, DIFF_E) : "nd"; } },
    reach: { title: "População alcançável por TP em 180 min", items: ["< 30%", "30 a 50%", "50 a 70%", "70 a 85%", "85 a 95%", "> 95%"].map((l, k) => ({ k, l, c: D.SEQ_BLUE[k + 1] })).concat([NP]), val: i => ZM.reach[i], cls: i => (zones[i].pop < 100 ? "np" : bin(ZM.reach[i], REACH_E)) },
    pop: { title: "População da zona (estimada)", items: ["< 2 mil", "2 a 5 mil", "5 a 10 mil", "10 a 20 mil", "20 a 40 mil", "> 40 mil"].map((l, k) => ({ k, l, c: D.SEQ_BLUE[k + 1] })), val: i => zones[i].pop, cls: i => bin(zones[i].pop, POP_E) },
    grp: { title: "Grupo de prioridade (cenário base)", items: GRP_LABELS.map((l, k) => ({ k, l, c: GRP_COLORS[k] })), val: i => zones[i].grp, cls: i => zones[i].grp },
  };
  const colorOf = (m, k) => METRICS[m].items.find(it => it.k === k).c;
  const passZ = i => (!S.mun || zones[i].mun === S.mun) && zones[i].pop >= S.popMin && !S.hidden.has(METRICS[S.metric].cls(i));
  function zoneStyle(i) {
    const m = S.metric, k = METRICS[m].cls(i), ok = passZ(i), sel = S.selZ.has(i), hi = S.hiZ.has(i), any = S.selZ.size > 0;
    return {
      fillColor: colorOf(m, k), fillOpacity: !ok ? 0.06 : any && !sel ? S.zop * 0.53 : S.zop,
      color: sel ? css("--ink") : hi ? css("--accent") : css("--surface"), weight: sel ? 2.6 : hi ? 2.4 : 0.5, opacity: ok ? 1 : 0.3, dashArray: hi && !sel ? "4 3" : null,
    };
  }
  function zoneTip(i) {
    const z = zones[i];
    return `<b>Zona ${z.id} · ${esc(z.mun)}</b><br>Habitantes (estim.): ${int(z.pop)}<br>Razão: <b>${num(ZM.ratio[i])}</b> · Diferença: <b>${num(ZM.diff[i], 0)} min</b><br>TP alcança ${pc(ZM.reach[i])} da população<br><span style="color:var(--muted)">${S.role === "from" ? "viagens que saem desta zona" : "viagens que chegam a esta zona"}</span>`;
  }
  function recomputeZones() {
    ZM = D.zoneMetrics(slotsList(), S.scen, S.pen, S.role);
    ZP = null;
  }
  function refAll() {
    const key = `${S.scen}|${S.pen}|${S.role}`;
    if (!REF[key]) REF[key] = D.pooled(null, S.scen, S.pen, S.role);
    return REF[key];
  }

  // ================================================================== zonas: selecao
  function toggleZone(i, add) {
    if (!passZ(i)) return;
    if (add) { S.selZ.has(i) ? S.selZ.delete(i) : S.selZ.add(i); }
    else if (S.selZ.size === 1 && S.selZ.has(i)) S.selZ.clear();
    else S.selZ = new Set([i]);
    S.hiZ.clear(); update({ map: true });
  }
  const focalZones = () => { const sel = [...S.selZ].filter(passZ); if (sel.length) return sel; const a = []; for (let i = 0; i < Z; i++) if (passZ(i)) a.push(i); return a; };

  // ================================================================== linhas: vista
  let LV = null;
  function computeLines() { LV = buildView(S.feeds, S.minTrips); }
  let ZV = null, zvKey = "";
  function zView() { const k = slotIdx() + "|" + S.scen; if (k !== zvKey) { ZV = buildView(new Set([0, 1, 2, 3]), 0); zvKey = k; } return ZV; }
  function buildView(feeds, minTrips) {
    const v = D.entryVals(slotIdx(), S.scen), E = D.E, mask = new Uint8Array(E);
    for (let e = 0; e < E; e++) mask[e] = v.t[e] > 0 && feeds.has(D.routes[D.eRi[e]].f) && v.t[e] >= minTrips ? 1 : 0;
    const C = D.C, cT = new Float32Array(C), cA = new Float64Array(C), cB = new Float64Array(C), cE = new Uint8Array(C);
    for (let e = 0; e < E; e++) if (mask[e]) { const c = D.eCi[e]; cT[c] += v.t[e]; cA[c] += v.t[e] * v.tp[e]; cB[c] += v.t[e] * v.car[e]; cE[c] = 1; }
    const cR = new Float32Array(C), cD = new Float32Array(C);
    for (let c = 0; c < C; c++) if (cE[c]) { cR[c] = cA[c] / cB[c]; cD[c] = (cA[c] - cB[c]) / cT[c] / 60; }
    return { v, mask, cT, cR, cD, cE };
  }
  function selEntries() {
    const s = S.sel; if (!s) return null;
    const out = [];
    if (s.kind === "routes") { for (const r of s.routes) for (const e of D.entByRoute[r]) if (LV.mask[e]) out.push(e); }
    else for (const c of s.cors) for (const e of D.entByCor[c]) if (LV.mask[e]) out.push(e);
    return out;
  }
  function selEntriesRaw() {
    const s = S.sel; if (!s) return null;
    const out = [];
    if (s.kind === "routes") { for (const r of s.routes) out.push(...D.entByRoute[r]); }
    else for (const c of s.cors) out.push(...D.entByCor[c]);
    return out;
  }
  const ONES = new Uint8Array(D.E).fill(1);
  const allEntries = () => { const a = []; for (let e = 0; e < D.E; e++) if (LV.mask[e]) a.push(e); return a; };
  function aggEntries(es) {
    const v = LV.v; let a = 0, b = 0, t = 0, tk = 0, km = 0; const cs = new Set(), sh = [0, 0, 0, 0, 0, 0]; let shT = 0;
    for (const e of es) {
      const w = v.t[e], k = D.eKmKm[e];
      a += w * v.tp[e]; b += w * v.car[e]; t += w; tk += w * k; km += k; cs.add(D.eCi[e]);
      const r = v.tp[e] / v.car[e], c = D.cls(r); sh[c] += w * k; shT += w * k;
    }
    return { ratio: b ? a / b : NaN, diff: t ? (a - b) / t / 60 : NaN, trips: km ? tk / km : NaN, km, cors: cs.size, shares: sh.map(x => (shT ? x / shT : 0)) };
  }
  function styleLines() {
    const Cn = D.C, col = new Array(Cn), wid = new Float32Array(Cn), alpha = new Float32Array(Cn), hi = new Uint8Array(Cn), order = [];
    const es = selEntries(); let hiAny = false;
    if (es) { for (const e of es) hi[D.eCi[e]] = 1; hiAny = true; }
    for (let c = 0; c < Cn; c++) {
      if (!LV.cE[c]) continue;
      const k = D.cls(LV.cR[c]); if (S.hidden.has(k)) continue;
      col[c] = D.CLS_COLORS[k]; wid[c] = 1.2 + 0.8 * Math.sqrt(Math.min(LV.cT[c], 12)); alpha[c] = hiAny ? (hi[c] ? 1 : 0.16) : 0.95;
      order.push(c);
    }
    order.sort((a, b) => (hi[a] - hi[b]) || (D.cls(LV.cR[a]) - D.cls(LV.cR[b])));
    linesLayer.st = { col, wid, alpha, hi, hiAny, order };
    linesLayer.redraw();
  }
  function groupByRoute(es, v) {
    const g = new Map();
    for (const e of es) {
      const r = D.eRi[e]; let o = g.get(r); if (!o) { o = { a: 0, b: 0, tk: 0, km: 0, d: 0, t: 0 }; g.set(r, o); }
      const w = v.t[e]; o.a += w * v.tp[e]; o.b += w * v.car[e]; o.t += w; o.tk += w * D.eKmKm[e]; o.km += D.eKmKm[e]; o.d += (v.tp[e] - v.car[e]) / 60;
    }
    return g;
  }
  // corredores que atravessam uma zona (vertices e pontos medios dentro do poligono); calculado so para a zona escolhida
  const zPoly = T.zones.features.map(f => {
    const g = f.geometry, polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates, bb = [1e9, 1e9, -1e9, -1e9];
    for (const rings of polys) for (const [x, y] of rings[0]) { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); }
    return { polys, bb };
  });
  function pip(x, y, rings) {
    let inside = false;
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  const zcCache = new Map();
  function zoneCors(zi) {
    let s = zcCache.get(zi); if (s) return s;
    s = new Set(); const z = zPoly[zi], b = z.bb;
    const inZ = (x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3] && z.polys.some(rings => pip(x, y, rings));
    for (let c = 0; c < D.C; c++) {
      const cb = D.corBounds[c]; if (cb[2] < b[0] || cb[0] > b[2] || cb[3] < b[1] || cb[1] > b[3]) continue;
      const g = D.corGeom[c].g;
      for (let k = 0; k < g.length; k++) {
        if (inZ(g[k][0], g[k][1]) || (k && inZ((g[k][0] + g[k - 1][0]) / 2, (g[k][1] + g[k - 1][1]) / 2))) { s.add(c); break; }
      }
    }
    zcCache.set(zi, s); return s;
  }
  // linhas que servem as zonas selecionadas: observacao = troços da linha dentro das zonas (hora e cenario atuais)
  function zoneLines() {
    const V = zView(), cors = new Set();
    for (const z of S.selZ) for (const c of zoneCors(z)) cors.add(c);
    const es = []; for (const c of cors) for (const e of D.entByCor[c]) if (V.mask[e]) es.push(e);
    const loc = groupByRoute(es, V.v), out = [];
    for (const [r, o] of loc) {
      const wh = groupByRoute(D.entByRoute[r].filter(e => V.mask[e]), V.v).get(r);
      out.push({ r, ratio: o.a / o.b, diff: o.d, trips: o.tk / o.km, km: o.km, whole: wh ? wh.a / wh.b : NaN });
    }
    return out;
  }
  function routesAt(c) { return [...new Set(D.entByCor[c].filter(e => LV.mask[e]).map(e => D.eRi[e]))]; }
  const rLabel = r => `${D.feedNames[D.routes[r].f]} · ${D.routes[r].n}`;

  // interacao com a camada de linhas
  let lt = L.tooltip({ direction: "top", offset: [0, -6], opacity: 1 }), ltOn = false, raf = 0;
  map.on("mousemove", e => {
    if (S.mode !== "lines" || S.tool !== "click" || raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const c = linesLayer.hit(e.containerPoint);
      if (c < 0) { if (ltOn) { map.closeTooltip(lt); ltOn = false; } map.getContainer().style.cursor = ""; return; }
      const rs = routesAt(c), first = rs.slice(0, 4).map(r => `${esc(D.routes[r].n)}`).join("<br>");
      lt.setLatLng(e.latlng).setContent(`<b>Razão ${num(LV.cR[c])}</b> · diferença ${num(LV.cD[c])} min<br>${num(LV.cT[c], 0)} viagens/h (todas as linhas do troço)<br><span style="color:var(--muted)">${rs.length} linha(s):</span><br>${first}${rs.length > 4 ? "<br>..." : ""}`);
      if (!ltOn) { lt.addTo(map); ltOn = true; }
      map.getContainer().style.cursor = "pointer";
    });
  });
  map.on("click", e => {
    if (S.mode !== "lines" || S.tool !== "click") return;
    const c = linesLayer.hit(e.containerPoint), add = e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey;
    if (rect && !add) { map.removeLayer(rect); rect = null; }
    if (c < 0) { if (!add) { S.sel = null; update({ map: true }); } return; }
    const rs = routesAt(c), prev = S.sel && S.sel.kind === "routes" && add ? S.sel.routes : new Set();
    S.sel = { kind: "routes", routes: new Set([...prev, ...rs]) };
    update({ map: true });
  });

  // ---- ferramenta de area
  let drag = null, rect = null;
  map.on("mousedown", e => {
    if (S.tool !== "box" || e.originalEvent.button !== 0) return;
    drag = e.latlng; map.dragging.disable();
    if (rect) map.removeLayer(rect);
    rect = L.rectangle([drag, drag], { color: css("--accent"), weight: 1.5, fillOpacity: 0.1, interactive: false }).addTo(map);
  });
  map.on("mousemove", e => { if (drag) rect.setBounds(L.latLngBounds(drag, e.latlng)); });
  map.on("mouseup", e => {
    if (!drag) return;
    const b = L.latLngBounds(drag, e.latlng), add = e.originalEvent.shiftKey || e.originalEvent.ctrlKey || e.originalEvent.metaKey;
    drag = null; map.dragging.enable();
    if (Math.abs(b.getNorth() - b.getSouth()) < 1e-5 && Math.abs(b.getEast() - b.getWest()) < 1e-5) { map.removeLayer(rect); rect = null; return; }
    if (S.mode === "zones") {
      map.removeLayer(rect); rect = null;
      const sel = add ? new Set(S.selZ) : new Set();
      zones.forEach((z, i) => { if (b.contains([z.c[1], z.c[0]]) && passZ(i)) sel.add(i); });
      S.selZ = sel; S.hiZ.clear();
    } else {
      const w = b.getWest(), s = b.getSouth(), ea = b.getEast(), n = b.getNorth(), cors = new Set(add && S.sel && S.sel.kind === "area" ? S.sel.cors : []);
      for (let c = 0; c < D.C; c++) {
        if (!LV.cE[c]) continue;
        const bb = D.corBounds[c];
        if (bb[2] < w || bb[0] > ea || bb[3] < s || bb[1] > n) continue;
        if (D.corGeom[c].g.some(p => p[0] >= w && p[0] <= ea && p[1] >= s && p[1] <= n)) cors.add(c);
      }
      S.sel = cors.size ? { kind: "area", cors, rect: b } : null;
      if (!cors.size && rect) { map.removeLayer(rect); rect = null; }
    }
    update({ map: true });
  });
  let selRect = null;

  // ================================================================== legenda
  function renderLegend() {
    const lg = $("#legend");
    let items, title;
    if (S.mode === "zones") { const M = METRICS[S.metric]; title = M.title; items = M.items; }
    else { title = "Razão TP / carro do troço"; items = D.CLS_LABELS.map((l, k) => ({ k, l, c: D.CLS_COLORS[k] })); }
    lg.innerHTML = `<h4>${title}</h4>` + items.map(it => `<div class="it ${S.hidden.has(it.k) ? "off" : ""}" data-k="${it.k}"><i style="background:${it.c}"></i>${it.l}</div>`).join("") +
      (S.mode === "lines" ? `<div class="hint">Espessura: viagens por hora no troço (1 a 12).</div>` : "") + `<div class="hint">Clique numa classe para a ocultar.</div>`;
    lg.querySelectorAll(".it").forEach(el => el.onclick = () => {
      const k = isNaN(+el.dataset.k) ? el.dataset.k : +el.dataset.k;
      S.hidden.has(k) ? S.hidden.delete(k) : S.hidden.add(k);
      update({ map: true });
    });
  }

  // ================================================================== painel
  let panel = {}, scat = null;
  function buildPanel() {
    const z = S.mode === "zones";
    $("#panel").innerHTML = `
      <div class="selhead"><b id="selTitle"></b><span class="sp"><button class="ghost" id="csvBtn" title="Descarregar a tabela da seleção">CSV</button></span></div>
      <div class="kpis" id="kpis"></div>
      <div class="card"><h3>Razão × diferença de tempo</h3>
        <p class="sub" id="scSub"></p>
        <div class="seg" id="scSeg"></div>
        <div class="scwrap" id="scEl"></div>
        <div class="sizeleg" id="sizeLeg"></div>
      </div>
      <div class="card"><h3>Distribuição por classe de razão</h3><p class="sub" id="barSub"></p><div id="barEl"></div><p class="sub" style="margin-top:4px">Barra: seleção. Traço preto: ${z ? "toda a AML" : "toda a rede com os filtros atuais"}.</p></div>
      <div class="card"><h3>Perfil ao longo do dia</h3><p class="sub">Razão por hora de partida (manhã e tarde). Linha tracejada: ${z ? "toda a AML" : "rede com os filtros atuais"}.</p><div class="prof" id="profEl"></div><div class="sizeleg" id="profLeg"></div></div>
      <div class="card"><h3 id="tblTitle"></h3><p class="sub" id="tblSub"></p><div class="tblwrap" id="tblEl"></div></div>
      <p class="note">Prova de conceito: TomTom jan/2020, GTFS 2024 e OSM 2026. Sem CP, TCB, fluvial, Metro Sul e Mobi Cascais. Os valores absolutos dependem dos pressupostos do carro e do TP programado.</p>`;
    scat = new C.Scatter($("#scEl"), {});
    $("#csvBtn").onclick = downloadCsv;
  }
  const kpi = (v, l) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`;
  const seg = (opts, cur, cb, id) => {
    const el = $(id); el.innerHTML = opts.map(([k, l]) => `<button data-k="${k}" class="${k === cur ? "on" : ""}">${l}</button>`).join("");
    el.querySelectorAll("button").forEach(b => b.onclick = () => cb(b.dataset.k));
  };
  function sizeLegend(label, vals, scatter, fmtv) {
    return `${label}: ` + vals.map(v => { const r = scatter.rad(v); return `<svg width="${2 * r + 2}" height="${2 * r + 2}"><circle cx="${r + 1}" cy="${r + 1}" r="${r}" fill="none" stroke="${css("--ink2")}"/></svg> ${fmtv(v)}`; }).join(" ");
  }

  function updateZonesPanel() {
    const focal = focalZones(), nSel = S.selZ.size, role = S.role;
    const mask = new Uint8Array(Z); focal.forEach(i => (mask[i] = 1));
    const filtered = focal.length < Z;
    const pr = filtered ? D.pooled(mask, S.scen, S.pen, role) : refAll(), refr = refAll();
    const P = D.pickSlots(pr, slotsList()), R = D.pickSlots(refr, slotsList());
    const pop = focal.reduce((a, i) => a + zones[i].pop, 0);
    $("#selTitle").textContent = nSel ? `${nSel} zona(s) selecionada(s) · ${int(pop)} hab.` : (S.mun || S.popMin ? `${focal.length} zonas filtradas · ${int(pop)} hab.` : `Toda a AML · ${int(pop)} hab.`);
    $("#kpis").innerHTML = kpi(num(P.ratio), "razão mediana" + (R.ratio === R.ratio ? ` (AML ${num(R.ratio)})` : "")) + kpi(num(P.diff, 0) + " min", `diferença mediana (AML ${num(R.diff, 0)})`) +
      kpi(pc(P.reach), "da população alcançável por TP em 180 min") + kpi(pc(P.shares[0] + P.shares[1] + P.shares[2]), "das viagens alcançáveis com razão < 2");
    // dispersao: sem selecao = uma zona por ponto; com selecao = observacoes da selecao (linhas que a servem, destinos)
    if (!nSel) S.zsc = null;
    const mode = nSel ? S.zsc || "lines" : "main", sub = $("#scSub");
    seg(nSel ? [["lines", "Linhas da zona"], ["other", role === "from" ? "Destinos" : "Origens"], ["main", "Todas as zonas"]] : [["main", "Todas as zonas"]], mode, k => { S.zsc = k; updateZonesPanel(); }, "#scSeg");
    let pts, lineRows = null;
    const cfg = { xlab: "Razão TP / carro", ylab: "Diferença TP - carro (min)", rmin: 2.5, rmax: 17, vmax: 60000 };
    if (mode === "main") {
      sub.innerHTML = `Cada ponto é uma zona (${role === "from" ? "viagens que saem dela" : "viagens que chegam a ela"}). <b>Área = população</b>: quanto maior o círculo, mais gente sofre aquela condição. Arraste para selecionar, shift para somar.`;
      pts = [];
      for (let i = 0; i < Z; i++) {
        if (!passZ(i) || !(ZM.ratio[i] === ZM.ratio[i])) continue;
        pts.push({ id: i, x: ZM.ratio[i], y: ZM.diff[i], v: zones[i].pop, c: D.CLS_COLORS[D.cls(ZM.ratio[i])], sel: S.selZ.has(i), tip: `<b>Zona ${zones[i].id} · ${esc(zones[i].mun)}</b><br>${int(zones[i].pop)} hab.<br>Razão ${num(ZM.ratio[i])} · dif. ${num(ZM.diff[i], 0)} min` });
      }
      cfg.onSelect = (ids, add) => { const s = add ? new Set(S.selZ) : new Set(); ids.forEach(i => s.add(i)); S.selZ = s; S.hiZ.clear(); if (s.size) S.zsc = "main"; update({ map: true }); };
    } else if (mode === "other") {
      sub.innerHTML = `Cada ponto é uma zona ${role === "from" ? "de destino" : "de origem"} das viagens da seleção (tempos médios ponderados pela população). Arraste para destacar no mapa.`;
      const oe = D.otherEnd(focal, slotsList(), S.scen, S.pen, role);
      pts = oe.filter(p => passZ(p.o)).map(p => ({ id: p.o, x: p.ratio, y: p.diff, v: zones[p.o].pop, c: D.CLS_COLORS[D.cls(p.ratio)], sel: S.hiZ.has(p.o), tip: `<b>Zona ${zones[p.o].id} · ${esc(zones[p.o].mun)}</b><br>TP ${num(p.tp, 0)} min · carro ${num(p.car, 0)} min<br>Razão ${num(p.ratio)} · dif. ${num(p.diff, 0)} min` }));
      cfg.onSelect = (ids, add) => { const s = add ? new Set(S.hiZ) : new Set(); ids.forEach(i => s.add(i)); S.hiZ = s; update({ map: true }); };
    } else {
      lineRows = zoneLines();
      sub.innerHTML = `Cada ponto é uma <b>linha que serve ${nSel > 1 ? "as zonas selecionadas" : "a zona selecionada"}</b>, como a vivem os moradores (hora e carro dos filtros). Mede só os troços da linha dentro da zona; a linha inteira aparece no balão. <b>Área = viagens por hora</b>.`;
      pts = lineRows.map(o => ({ id: o.r, x: o.ratio, y: o.diff, v: o.trips, c: D.CLS_COLORS[D.cls(o.ratio)], tip: `<b>${esc(D.routes[o.r].n)}</b><br>${esc(D.feedNames[D.routes[o.r].f])}<br>Na zona: razão ${num(o.ratio, 2)} · dif. ${num(o.diff, 0)} min · ${num(o.trips, 1)} viag./h<br>Linha inteira: razão ${num(o.whole, 2)}` }));
      Object.assign(cfg, { ylab: "Diferença acumulada nos troços da zona (min)", rmin: 3, rmax: 14, vmax: 12, empty: "Nenhuma linha com serviço nesta zona, hora e filtros." });
    }
    scat.set(pts, cfg);
    $("#sizeLeg").innerHTML = mode === "lines" ? sizeLegend("Tamanho = viagens/h", [1, 4, 12], scat, v => num(v, 0)) : sizeLegend("Tamanho = população", [2000, 10000, 40000], scat, v => int(v));
    // barras
    $("#barSub").textContent = "Parte das viagens alcançáveis em cada classe (ponderada por população de origem e destino).";
    C.bars($("#barEl"), P.shares, R.shares);
    // perfil
    const series = [{ name: "Seleção", vals: pr.map(r => r.ratio), color: css("--accent"), w: 2.4 }];
    if (filtered) series.unshift({ name: "AML", vals: refr.map(r => r.ratio), color: css("--ink2"), dash: true, w: 1.5 });
    C.profile($("#profEl"), series);
    $("#profLeg").innerHTML = `<span><i class="dot" style="background:${css("--accent")}"></i>${nSel ? "Seleção" : filtered ? "Área filtrada" : "AML"}</span>${filtered ? `<span style="margin-left:12px"><i class="dot" style="background:${css("--ink2")}"></i>AML</span>` : ""}`;
    // tabela
    if (mode === "lines") {
      $("#tblTitle").textContent = "Linhas que servem a zona";
      $("#tblSub").textContent = "Razão e viagens/h medidas nos troços dentro da zona. Clique numa linha para a ver no modo Linhas; clique no cabeçalho para ordenar.";
      const lrows = lineRows.map(o => ({ r: o.r, name: D.routes[o.r].n, op: D.feedNames[D.routes[o.r].f], km: o.km, ratio: o.ratio, trips: o.trips, whole: o.whole }));
      renderTable(lrows, [["name", "Linha"], ["op", "Operador"], ["km", "km na zona"], ["ratio", "Razão"], ["trips", "Viag./h"]], "ratio",
        { km: v => num(v, 1), ratio: v => num(v, 2), trips: v => num(v, 1) },
        r => { S.sel = { kind: "routes", routes: new Set([r.r]) }; setMode("lines"); fitRoute(r.r); }, 200);
      panel.rows = lrows;
      return;
    }
    $("#tblTitle").textContent = nSel ? "Zonas selecionadas" : "Zonas a priorizar";
    $("#tblSub").textContent = "Ordenado por habitantes × diferença de tempo (quem mais perde). Clique numa linha para selecionar a zona; clique no cabeçalho para ordenar.";
    const rows = focal.filter(i => ZM.ratio[i] === ZM.ratio[i]).map(i => ({ i, name: `Zona ${zones[i].id} · ${zones[i].mun}`, pop: zones[i].pop, ratio: ZM.ratio[i], diff: ZM.diff[i], reach: ZM.reach[i], pd: zones[i].pop * ZM.diff[i] }));
    renderTable(rows, [["name", "Zona"], ["pop", "Hab."], ["ratio", "Razão"], ["diff", "Dif. (min)"], ["reach", "Alcance"]], "pd",
      { pop: v => int(v), ratio: v => num(v), diff: v => num(v, 0), reach: v => pc(v) },
      r => { S.selZ = new Set([r.i]); S.hiZ.clear(); update({ map: true }); const b = zl[r.i].getBounds(); map.fitBounds(b.pad(2), { maxZoom: 12 }); }, 60);
    panel.rows = rows;
  }

  function updateLinesPanel() {
    const es = selEntries(), nSel = es ? es.length : 0, all = allEntries(), use = es || all, A = aggEntries(use), Rf = aggEntries(all);
    const nr = es ? new Set(es.map(e => D.eRi[e])).size : new Set(all.map(e => D.eRi[e])).size;
    $("#selTitle").textContent = es && !es.length ? "Sem serviço nesta hora (mude a hora ou os filtros)" : es ? `${nr} linha(s) · ${A.cors} troços na seleção` : `Toda a rede filtrada · ${nr} linhas, ${A.cors} troços`;
    $("#kpis").innerHTML = kpi(num(A.ratio, 2), "razão agregada" + (es ? ` (rede ${num(Rf.ratio, 2)})` : "")) + kpi(num(A.diff) + " min", `diferença média por troço (rede ${num(Rf.diff)})`) +
      kpi(num(A.trips, 1), "viagens/h (média por km de linha)") + kpi(num(A.km, 0) + " km", "extensão de troços (soma por linha)");
    const sub = $("#scSub"), sel = S.sel, lm = S.lscMode, v = LV.v;
    seg([["route", "Linhas"], ["cor", "Troços"]], lm, k => { S.lscMode = k; updateLinesPanel(); }, "#scSeg");
    const cl = x => D.CLS_COLORS[D.cls(x)];
    const cfg = { xlab: "Razão TP / carro", rmin: 2, rmax: 13, vmax: 12, empty: "Sem observações para esta seleção, hora e filtros." };
    const rTip = (r, x) => `<b>${esc(D.routes[r].n)}</b><br>${esc(D.feedNames[D.routes[r].f])}<br>${x}`;
    let pts = [];
    const pickRoutes = (ids, add) => { const c = new Set(add && sel && sel.kind === "routes" ? sel.routes : []); ids.forEach(i => c.add(i)); S.sel = c.size ? { kind: "routes", routes: c } : null; if (rect) { map.removeLayer(rect); rect = null; } update({ map: true }); };
    if (lm === "route" && sel && sel.kind === "routes") {
      sub.innerHTML = `Cada ponto é uma <b>hora de partida</b> da(s) linha(s) selecionada(s): como a linha se comporta ao longo do dia (aqui a hora dos filtros não se aplica). <b>Área = viagens por hora</b>. Arraste para ficar só com algumas linhas.`;
      for (const r of sel.routes) for (let s = 0; s < 6; s++) {
        const a = D.slotAgg(D.entByRoute[r], s, S.scen); if (!a.n) continue;
        pts.push({ id: r * 8 + s, x: a.ratio, y: a.diff, v: a.trips, c: cl(a.ratio), lab: D.SLOT_LABELS[s], tip: rTip(r, `${D.SLOT_LABELS[s]}: razão ${num(a.ratio, 2)} · dif. ${num(a.diff, 0)} min · ${num(a.trips, 1)} viag./h`) });
      }
      Object.assign(cfg, { ylab: "Diferença acumulada na linha (min)", labels: true, onSelect: ids => { const rs = new Set(ids.map(i => Math.floor(i / 8))); if (rs.size) { S.sel = { kind: "routes", routes: rs }; update({ map: true }); } } });
    } else if (lm === "route" && sel) {
      sub.innerHTML = `Cada ponto é uma linha, medida só nos troços <b>dentro da área selecionada</b> (hora dos filtros). <b>Área = viagens por hora</b>.`;
      for (const [r, o] of groupByRoute(selEntries(), v)) pts.push({ id: r, x: o.a / o.b, y: o.d, v: o.tk / o.km, c: cl(o.a / o.b), tip: rTip(r, `Na área: razão ${num(o.a / o.b, 2)} · dif. ${num(o.d, 0)} min · ${num(o.tk / o.km, 1)} viag./h`) });
      cfg.ylab = "Diferença acumulada nos troços da área (min)";
    } else if (lm === "route") {
      sub.innerHTML = `Cada ponto é uma linha (um sentido). Eixo vertical: diferença de tempo acumulada ao longo do percurso (min). <b>Área = viagens por hora</b>. Arraste para selecionar linhas.`;
      for (const [r, o] of groupByRoute(allEntries(), v)) {
        if (o.km < 1.5) continue;
        const ratio = o.a / o.b; if (S.hidden.has(D.cls(ratio))) continue;
        pts.push({ id: r, x: ratio, y: o.d, v: o.tk / o.km, c: cl(ratio), tip: rTip(r, `Razão ${num(ratio, 2)} · dif. ${num(o.d, 0)} min · ${num(o.tk / o.km, 1)} viag./h`) });
      }
      Object.assign(cfg, { ylab: "Diferença acumulada na linha (min)", onSelect: pickRoutes });
    } else if (sel && sel.kind === "routes") {
      sub.innerHTML = `Cada ponto é um <b>troço da(s) linha(s) selecionada(s)</b> (cerca de 1 km, hora dos filtros), medido só para essa linha. <b>Área = viagens por hora</b>.`;
      for (const e of selEntries()) { const r = v.tp[e] / v.car[e]; pts.push({ id: e, x: r, y: (v.tp[e] - v.car[e]) / 60, v: v.t[e], c: cl(r), tip: rTip(D.eRi[e], `Troço de ${num(D.eKmKm[e], 1)} km: razão ${num(r, 2)} · dif. ${num((v.tp[e] - v.car[e]) / 60, 1)} min · ${num(v.t[e], 0)} viag./h`) }); }
      cfg.ylab = "Diferença TP - carro no troço (min)";
    } else if (sel) {
      sub.innerHTML = `Cada ponto é um <b>troço dentro da área selecionada</b> (todas as linhas somadas, hora dos filtros). <b>Área = viagens por hora</b>.`;
      for (const c of sel.cors) if (LV.cE[c]) pts.push({ id: c, x: LV.cR[c], y: LV.cD[c], v: LV.cT[c], c: cl(LV.cR[c]), tip: `<b>Razão ${num(LV.cR[c])}</b> · dif. ${num(LV.cD[c])} min<br>${num(LV.cT[c], 0)} viag./h` });
      cfg.ylab = "Diferença TP - carro no troço (min)";
    } else {
      sub.innerHTML = `Cada ponto é um troço de cerca de 1 km (tempo programado do TP contra o carro entre as mesmas paragens). <b>Área = viagens por hora</b>. Arraste para selecionar troços no mapa.`;
      for (let c = 0; c < D.C; c++) {
        if (!LV.cE[c] || S.hidden.has(D.cls(LV.cR[c]))) continue;
        pts.push({ id: c, x: LV.cR[c], y: LV.cD[c], v: LV.cT[c], c: cl(LV.cR[c]), tip: `<b>Razão ${num(LV.cR[c])}</b> · dif. ${num(LV.cD[c])} min<br>${num(LV.cT[c], 0)} viag./h<br>${esc(D.routes[routesAt(c)[0]].n)}${routesAt(c).length > 1 ? ` (+${routesAt(c).length - 1})` : ""}` });
      }
      Object.assign(cfg, { ylab: "Diferença TP - carro no troço (min)", onSelect: (ids, add) => { const c = new Set(add && S.sel && S.sel.kind === "area" ? S.sel.cors : []); ids.forEach(i => c.add(i)); S.sel = c.size ? { kind: "area", cors: c } : null; if (rect) { map.removeLayer(rect); rect = null; } update({ map: true }); } });
    }
    scat.set(pts, cfg);
    $("#sizeLeg").innerHTML = sizeLegend("Tamanho = viagens/h", [1, 4, 12], scat, v => num(v, 0));
    $("#barSub").textContent = "Parte dos quilómetros-viagem em cada classe de razão (ponderada pela frequência).";
    C.bars($("#barEl"), A.shares, es ? Rf.shares : null);
    const raw = selEntriesRaw();
    const series = [{ name: "Seleção", vals: raw ? D.lineProfile(raw, S.scen, ONES) : D.lineProfile(use, S.scen, LV.mask), color: css("--accent"), w: 2.4 }];
    if (es) series.unshift({ name: "Rede", vals: D.lineProfile(all, S.scen, LV.mask), color: css("--ink2"), dash: true, w: 1.5 });
    C.profile($("#profEl"), series);
    $("#profLeg").innerHTML = `<span><i class="dot" style="background:${css("--accent")}"></i>${es ? "Seleção" : "Rede"}</span>${es ? `<span style="margin-left:12px"><i class="dot" style="background:${css("--ink2")}"></i>Rede</span>` : ""}`;
    $("#tblTitle").textContent = es ? "Linhas na seleção" : "Linhas da rede";
    $("#tblSub").textContent = "Razão calculada sobre os troços na seleção. Clique numa linha para a isolar no mapa; clique no cabeçalho para ordenar.";
    const gr = new Map();
    for (const e of use) {
      const r = D.eRi[e]; let o = gr.get(r); if (!o) { o = { a: 0, b: 0, tk: 0, km: 0 }; gr.set(r, o); }
      const w = v.t[e]; o.a += w * v.tp[e]; o.b += w * v.car[e]; o.tk += w * D.eKmKm[e]; o.km += D.eKmKm[e];
    }
    const rows = [...gr].filter(([, o]) => o.km >= 1).map(([r, o]) => ({ r, name: D.routes[r].n, op: D.feedNames[D.routes[r].f], km: o.km, ratio: o.a / o.b, trips: o.tk / o.km, grp: (D.routes[r].g || "").replace(/\(.*?\)/g, "").trim() }));
    renderTable(rows, [["name", "Linha"], ["op", "Operador"], ["km", "km"], ["ratio", "Razão"], ["trips", "Viag./h"]], "ratio",
      { km: v => num(v, 1), ratio: v => num(v, 2), trips: v => num(v, 1) },
      r => { S.sel = { kind: "routes", routes: new Set([r.r]) }; update({ map: true }); fitRoute(r.r); }, 200);
    panel.rows = rows;
  }
  function fitRoute(r) {
    const b = L.latLngBounds([]);
    for (const c of D.corByRoute[r]) { const bb = D.corBounds[c]; b.extend([bb[1], bb[0]]); b.extend([bb[3], bb[2]]); }
    if (b.isValid()) map.fitBounds(b.pad(0.15), { maxZoom: 13 });
  }

  function renderTable(rows, cols, defKey, fmts, onRow, limit) {
    const key = S.sortKey && cols.some(c => c[0] === S.sortKey) ? S.sortKey : defKey, dir = S.sortKey ? S.sortDir : -1;
    rows = rows.slice().sort((a, b) => (typeof a[key] === "string" ? a[key].localeCompare(b[key]) : a[key] - b[key]) * dir);
    const el = $("#tblEl");
    el.innerHTML = `<table><thead><tr>${cols.map(([k, l]) => `<th data-k="${k}">${l}${k === key ? (dir < 0 ? " ▾" : " ▴") : ""}</th>`).join("")}</tr></thead><tbody>` +
      rows.slice(0, limit).map((r, n) => `<tr class="row" data-n="${n}">${cols.map(([k], j) => `<td title="${j === 0 ? esc(r[k]) : ""}">${j === 0 && r.ratio !== undefined ? `<i class="dot" style="background:${D.CLS_COLORS[D.cls(r.ratio)]}"></i>` : ""}${fmts[k] ? fmts[k](r[k]) : esc(r[k])}</td>`).join("")}</tr>`).join("") +
      `</tbody></table>` + (rows.length > limit ? `<p class="note" style="padding:0 6px">A mostrar ${limit} de ${rows.length}. Ordene ou filtre para ver outras.</p>` : "");
    panel.sorted = rows;
    el.querySelectorAll("th").forEach(th => th.onclick = () => { const k = th.dataset.k; S.sortDir = S.sortKey === k ? -S.sortDir : (k === "name" || k === "op" ? 1 : -1); S.sortKey = k; renderTable(rows, cols, defKey, fmts, onRow, limit); });
    el.querySelectorAll("tr.row").forEach(tr => tr.onclick = () => onRow(rows[+tr.dataset.n]));
  }
  function downloadCsv() {
    const rows = panel.sorted || panel.rows || [];
    if (!rows.length) return;
    const keys = Object.keys(rows[0]).filter(k => !["i", "r", "pd"].includes(k));
    const csv = [keys.join(";")].concat(rows.map(r => keys.map(k => (typeof r[k] === "number" ? String(Math.round(r[k] * 1000) / 1000).replace(".", ",") : `"${String(r[k]).replace(/"/g, '""')}"`)).join(";"))).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `tml_${S.mode}_selecao.csv`; a.click();
  }

  // ================================================================== atualizacao
  let busyT = 0;
  function update(o) {
    o = o || {};
    if (o.recompute) {
      $("#busy").hidden = false;
      clearTimeout(busyT);
      busyT = setTimeout(() => { if (S.mode === "zones") recomputeZones(); else computeLines(); finish(); $("#busy").hidden = true; }, 20);
    } else finish();
    function finish() {
      if (S.mode === "zones") {
        zl.forEach((l, i) => l.setStyle(zoneStyle(i)));
        if (!ZM) return;
        updateZonesPanel();
      } else {
        if (!LV) return;
        styleLines(); updateLinesPanel();
      }
      renderLegend();
    }
  }

  function setMode(m) {
    S.mode = m; S.hidden.clear(); S.sortKey = null; S.hiZ.clear();
    document.querySelectorAll(".tabs button").forEach(b => { b.classList.toggle("on", b.dataset.mode === m); b.setAttribute("aria-selected", b.dataset.mode === m); });
    document.querySelector(".zonesOnly").hidden = m !== "zones";
    document.querySelector(".linesOnly").hidden = m !== "lines";
    if (rect) { map.removeLayer(rect); rect = null; }
    if (m === "zones") { map.removeLayer(linesLayer); if (!map.hasLayer(zoneLayer)) zoneLayer.addTo(map); munLayer.bringToFront && 0; map.getContainer().style.cursor = ""; if (ltOn) { map.closeTooltip(lt); ltOn = false; } }
    else { map.removeLayer(zoneLayer); linesLayer.addTo(map); if (!LV) computeLines(); }
    buildPanel();
    update({ recompute: true });
  }

  // ================================================================== filtros
  function bind() {
    const slot = $("#fSlot"), scen = $("#fScen"), pen = $("#fPen"), role = $("#fRole"), metric = $("#fMetric"), mun = $("#fMun"), pop = $("#fPop"), freq = $("#fFreq"), line = $("#fLine");
    const muns = [...new Set(zones.map(z => z.mun))].sort((a, b) => a.localeCompare(b));
    mun.innerHTML += muns.map(m => `<option>${esc(m)}</option>`).join("");
    $("#fOps").innerHTML = D.feedNames.map((n, k) => `<label><input type="checkbox" data-f="${k}" checked><i class="dot" style="background:${FEED_COL[k]}"></i>${n}</label>`).join("");
    $("#lineList").innerHTML = [...new Set(D.routes.map((r, i) => rLabel(i)))].sort().map(l => `<option value="${esc(l)}">`).join("");
    const ch = (el, f, ev) => el.addEventListener(ev || "change", f);
    ch(slot, () => { S.slot = slot.value === "all" ? "all" : +slot.value; update({ recompute: true }); });
    ch(scen, () => { S.scen = +scen.value; update({ recompute: true }); });
    ch(pen, () => { S.pen = +pen.value; $("#fPenV").textContent = S.pen + " min"; update({ recompute: true }); }, "input");
    ch(role, () => { S.role = role.value; S.zsc = null; update({ recompute: true }); });
    ch(metric, () => { S.metric = metric.value; S.hidden.clear(); update({ map: true }); });
    ch(mun, () => {
      S.mun = mun.value; S.selZ = new Set([...S.selZ].filter(passZ)); update({ map: true });
      const ls = zones.map((z, i) => i).filter(i => (!S.mun || zones[i].mun === S.mun));
      const b = L.latLngBounds([]); ls.forEach(i => b.extend(zl[i].getBounds()));
      map.fitBounds(S.mun ? b.pad(0.05) : homeBounds, { padding: [10, 10] });
    });
    ch(pop, () => { S.popMin = +pop.value; S.selZ = new Set([...S.selZ].filter(passZ)); update({ map: true }); });
    ch(freq, () => { S.minTrips = +freq.value; $("#fFreqV").textContent = S.minTrips + " viagens/h"; update({ recompute: true }); }, "input");
    document.querySelectorAll("#fOps input").forEach(cb => cb.addEventListener("change", () => { +cb.dataset.f; cb.checked ? S.feeds.add(+cb.dataset.f) : S.feeds.delete(+cb.dataset.f); update({ recompute: true }); }));
    ch(line, () => {
      const v = line.value.trim(); if (!v) return;
      const rs = D.routes.map((r, i) => i).filter(i => rLabel(i) === v);
      if (rs.length) { S.sel = { kind: "routes", routes: new Set(rs) }; update({ map: true }); fitRoute(rs[0]); }
    });
    document.querySelectorAll(".tools button[data-tool]").forEach(b => b.addEventListener("click", () => {
      S.tool = b.dataset.tool; document.querySelectorAll(".tools button[data-tool]").forEach(x => x.classList.toggle("on", x === b));
      map.getContainer().style.cursor = S.tool === "box" ? "crosshair" : "";
    }));
    $("#clearBtn").onclick = () => { S.selZ.clear(); S.hiZ.clear(); S.sel = null; if (rect) { map.removeLayer(rect); rect = null; } update({ map: true }); };
    $("#resetBtn").onclick = () => {
      Object.assign(S, { slot: 1, scen: 0, pen: 0, role: "from", metric: "ratio", mun: "", popMin: 0, zsc: null, lscMode: "route", minTrips: 0, sel: null });
      S.selZ.clear(); S.hiZ.clear(); S.hidden.clear(); S.feeds = new Set([0, 1, 2, 3]);
      slot.value = "1"; scen.value = "0"; pen.value = "0"; $("#fPenV").textContent = "0 min"; role.value = "from"; metric.value = "ratio"; mun.value = ""; pop.value = "0"; freq.value = "0"; $("#fFreqV").textContent = "0 viagens/h"; line.value = "";
      document.querySelectorAll("#fOps input").forEach(c => (c.checked = true));
      if (rect) { map.removeLayer(rect); rect = null; }
      map.fitBounds(homeBounds, { padding: [10, 10] }); update({ recompute: true });
    };
    document.querySelectorAll(".tabs button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    $("#helpBtn").onclick = () => { $("#helpBody").innerHTML = HELP; $("#help").showModal(); };
    window.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#help").open) $("#clearBtn").click(); });
  }

  const HELP = `
    <h2>Como ler este mapa</h2>
    <p>Compara, para a Área Metropolitana de Lisboa, o tempo de viagem em <b>transporte público (TP)</b> com o tempo de <b>carro</b>. Duas medidas: a <b>razão</b> TP / carro (1 = empate, 3 = o TP demora o triplo) e a <b>diferença</b> TP menos carro, em minutos.</p>
    <h3>Zonas (porta a porta)</h3>
    <ul>
      <li>Tempo de TP: caminhada, espera, viagem e transbordos (horário GTFS, simulado com r5py). Tempo de carro: grafo OSM com velocidades TomTom por hora.</li>
      <li>O valor de cada zona é a <b>mediana</b> sobre todos os destinos (ou origens), ponderada pela população do outro lado.</li>
      <li><b>Acesso e estacionamento</b> soma minutos ao carro (procurar lugar, caminhar do parque). Com 10 min, a razão mediana da AML desce de cerca de 3,5 para 2,6.</li>
      <li><b>Dispersão</b>: cada círculo é uma zona e a área é a população. Círculos grandes à direita e acima são onde mais gente perde mais tempo. Arraste para selecionar zonas e vê-las no mapa.</li>
      <li><b>Destinos da seleção</b>: para as zonas escolhidas, mostra para onde o TP compete e para onde não compete.</li>
    </ul>
    <h3>Linhas (por troço)</h3>
    <ul>
      <li>Cada linha é dividida em troços de cerca de 1 km. Compara-se o tempo programado do TP entre duas paragens com o tempo de carro pelo caminho mais curto entre as mesmas paragens. Troços com desvio ou encaixe duvidoso no grafo são excluídos (cerca de 9%).</li>
      <li>Cor = classe de razão (azul: TP mais rápido ou equivalente; vermelho: muito mais lento). Espessura = viagens por hora.</li>
      <li>Clique num troço para selecionar as linhas que o servem; use <b>Área</b> para selecionar todos os troços numa zona do mapa; ou procure uma linha pelo nome.</li>
    </ul>
    <h3>Fontes</h3>
    <ul>
      <li>Zonas, freguesias, população (Censos 2021) e GTFS: geoportal da TML (Transportes Metropolitanos de Lisboa).</li>
      <li>Velocidades do carro: TomTom Traffic Stats (janeiro de 2020), associadas à rede viária do OpenStreetMap (&copy; contribuidores do OpenStreetMap, ODbL).</li>
      <li>Projeto independente de investigação, sem afiliação oficial com a TML ou a TomTom.</li>
    </ul>
    <h3>Limitações (prova de conceito)</h3>
    <ul>
      <li>Dados: TomTom de janeiro de 2020, GTFS de 2024 (dia útil de referência, 15/05/2024), OSM de 2026.</li>
      <li>Faltam CP, TCB, Transtejo/Soflusa, Metro Sul do Tejo e Mobi Cascais. As razões sobem artificialmente em Cascais, Sintra, Amadora, Oeiras, Vila Franca de Xira e Barreiro.</li>
      <li>Cada zona usa um ponto representativo; a população é uma estimativa dasimétrica a partir dos Censos 2021 por freguesia.</li>
      <li>Os grupos de prioridade usam tercis da própria amostra (relativos, não absolutos).</li>
      <li>Os tempos de TP são os programados: não incluem atrasos nem variação em tempo real.</li>
    </ul>`;

  // ================================================================== arranque
  bind();
  setMode("zones");
})();
