/* Dados e calculos do mapa interativo (sem dependencias). Tudo corre no navegador a partir de site/data/*.js */
(function () {
  const T = window.TML;
  const SLOT_LABELS = ["7h", "8h", "9h", "17h", "18h", "19h"];
  const CLS_EDGES = [1, 1.5, 2, 3, 4];
  const CLS_COLORS = ["#256abf", "#86b6ef", "#ecd9b8", "#f0a58b", "#d9483b", "#8f1d1d"];
  const CLS_LABELS = ["< 1", "1 a 1.5", "1.5 a 2", "2 a 3", "3 a 4", "> 4"];
  const SEQ_BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"];

  function cls(r) {
    if (!(r === r)) return -1;
    let k = 0;
    while (k < 5 && r >= CLS_EDGES[k]) k++;
    return k;
  }
  function dec(s, C) {
    const b = atob(s), n = b.length, u = new Uint8Array(n);
    for (let i = 0; i < n; i++) u[i] = b.charCodeAt(i);
    return C === Uint8Array ? u : new C(u.buffer);
  }

  // ------------------------------------------------------------------ zonas
  const feats = T.zones.features;
  const Z = feats.length;
  const zones = feats.map((f, i) => ({ i, id: f.properties.z, mun: f.properties.m, pop: f.properties.p, area: f.properties.a, grp: f.properties.g, c: f.properties.c }));
  const W = Float64Array.from(zones, z => Math.max(z.pop, 1));
  const OD = T.od.data.map(s => ({ car: dec(s.car, Uint16Array), tp: dec(s.tp, Uint16Array), fc: dec(s.fc, Uint8Array), ff: dec(s.ff, Uint8Array) }));
  const NS = OD.length;

  const NB = 6000;
  const hR = new Float64Array(NB), hD = new Float64Array(NB);
  const R_MAX = 60, D_LO = -100, D_HI = 300;
  const rStep = R_MAX / NB, dStep = (D_HI - D_LO) / NB;
  function hmed(h, total, lo, step) {
    if (total <= 0) return NaN;
    const half = total / 2;
    let c = 0;
    for (let k = 0; k < h.length; k++) {
      c += h[k];
      if (c >= half) return lo + (k + 0.5) * step;
    }
    return NaN;
  }
  const bR = r => Math.min(NB - 1, Math.max(0, (r / rStep) | 0));
  const bD = d => Math.min(NB - 1, Math.max(0, ((d - D_LO) / dStep) | 0));

  function carTime(s, ix, scen, pen) {
    const c0 = s.car[ix] / 10;
    if (c0 < 5) return -1;
    const c = scen === 0 ? c0 : scen === 1 ? (c0 * s.fc[ix]) / 100 : (c0 * s.ff[ix]) / 100;
    return c + pen;
  }

  // metricas por zona (mediana ponderada pela populacao da outra ponta), media das horas escolhidas
  function zoneMetrics(slots, scen, pen, role) {
    const out = { ratio: new Float64Array(Z).fill(NaN), diff: new Float64Array(Z).fill(NaN), reach: new Float64Array(Z).fill(NaN) };
    const acc = { ratio: new Float64Array(Z), diff: new Float64Array(Z), reach: new Float64Array(Z), nr: new Float64Array(Z), nd: new Float64Array(Z), nreach: new Float64Array(Z) };
    for (const si of slots) {
      const s = OD[si];
      for (let f = 0; f < Z; f++) {
        hR.fill(0); hD.fill(0);
        let wTot = 0, wReach = 0;
        for (let o = 0; o < Z; o++) {
          if (o === f) continue;
          const ix = role === "from" ? f * Z + o : o * Z + f;
          const c = carTime(s, ix, scen, pen);
          if (c < 0) continue;
          const w = W[o];
          wTot += w;
          const t = s.tp[ix];
          if (t === 65535) continue;
          const tm = t / 10;
          wReach += w;
          hR[bR(tm / c)] += w;
          hD[bD(tm - c)] += w;
        }
        if (wTot > 0) { acc.reach[f] += wReach / wTot; acc.nreach[f]++; }
        if (wReach > 0) {
          acc.ratio[f] += hmed(hR, wReach, 0, rStep); acc.nr[f]++;
          acc.diff[f] += hmed(hD, wReach, D_LO, dStep); acc.nd[f]++;
        }
      }
    }
    for (let f = 0; f < Z; f++) {
      if (acc.nr[f]) out.ratio[f] = acc.ratio[f] / acc.nr[f];
      if (acc.nd[f]) out.diff[f] = acc.diff[f] / acc.nd[f];
      if (acc.nreach[f]) out.reach[f] = acc.reach[f] / acc.nreach[f];
    }
    return out;
  }

  // estatistica agrupada para um conjunto de zonas focais (pares ponderados por pop_f * pop_o), por hora
  function pooled(focal, scen, pen, role) {
    const res = [];
    const mask = focal;  // Uint8Array(Z) ou null (todas)
    for (let si = 0; si < NS; si++) {
      const s = OD[si];
      hR.fill(0); hD.fill(0);
      let wTot = 0, wReach = 0;
      const sh = [0, 0, 0, 0, 0, 0];
      for (let f = 0; f < Z; f++) {
        if (mask && !mask[f]) continue;
        const wf = W[f];
        for (let o = 0; o < Z; o++) {
          if (o === f) continue;
          const ix = role === "from" ? f * Z + o : o * Z + f;
          const c = carTime(s, ix, scen, pen);
          if (c < 0) continue;
          const w = wf * W[o];
          wTot += w;
          const t = s.tp[ix];
          if (t === 65535) continue;
          const tm = t / 10, r = tm / c;
          wReach += w;
          hR[bR(r)] += w;
          hD[bD(tm - c)] += w;
          sh[cls(r)] += w;
        }
      }
      res.push({
        ratio: hmed(hR, wReach, 0, rStep), diff: hmed(hD, wReach, D_LO, dStep),
        reach: wTot ? wReach / wTot : NaN, shares: sh.map(v => (wReach ? v / wReach : 0)),
      });
    }
    return res;
  }
  function pickSlots(res, slots) {
    const m = f => { let a = 0, n = 0; for (const si of slots) { const v = f(res[si]); if (v === v) { a += v; n++; } } return n ? a / n : NaN; };
    return {
      ratio: m(r => r.ratio), diff: m(r => r.diff), reach: m(r => r.reach),
      shares: [0, 1, 2, 3, 4, 5].map(k => m(r => r.shares[k])),
    };
  }

  // "outra ponta": para um conjunto focal, tempos medios (ponderados pela pop focal) de cada zona do outro lado
  function otherEnd(focalIdx, slots, scen, pen, role) {
    const res = [];
    for (let o = 0; o < Z; o++) {
      let sc = 0, st = 0, sw = 0, swr = 0, n = 0;
      for (const si of slots) {
        const s = OD[si];
        let a = 0, b = 0, wa = 0, wb = 0;
        for (const f of focalIdx) {
          if (f === o) continue;
          const ix = role === "from" ? f * Z + o : o * Z + f;
          const c = carTime(s, ix, scen, pen);
          if (c < 0) continue;
          wa += W[f];
          const t = s.tp[ix];
          if (t === 65535) continue;
          a += W[f] * c; b += W[f] * (t / 10); wb += W[f];
        }
        if (wa > 0) { sw += wa; swr += wb; if (wb > 0) { sc += a / wb; st += b / wb; n++; } }
      }
      if (!n || swr / sw < 0.5) continue;
      const car = sc / n, tp = st / n;
      res.push({ o, car, tp, ratio: tp / car, diff: tp - car });
    }
    return res;
  }

  // ------------------------------------------------------------------ linhas
  const L = T.lines;
  const E = L.E, C = L.C;
  const eCi = dec(L.e_ci, Uint16Array), eRi = dec(L.e_ri, Uint16Array), eKm = dec(L.e_km, Uint16Array).map(v => v);
  const tr = dec(L.trips, Uint8Array), tpA = dec(L.tp, Uint16Array), caA = dec(L.ca, Uint16Array), ccA = dec(L.cc, Uint16Array), cfA = dec(L.cf, Uint16Array);
  const carArr = [caA, ccA, cfA];
  const routes = L.routes;
  const eKmKm = Float32Array.from(eKm, v => v / 100);
  const corByRoute = routes.map(() => []);
  const entByCor = Array.from({ length: C }, () => []);
  const entByRoute = routes.map(() => []);
  for (let e = 0; e < E; e++) { entByCor[eCi[e]].push(e); entByRoute[eRi[e]].push(e); }
  for (let r = 0; r < routes.length; r++) corByRoute[r] = [...new Set(entByRoute[r].map(e => eCi[e]))];
  const corBounds = L.cor.map(c => {
    let a = 1e9, b = 1e9, x = -1e9, y = -1e9;
    for (const [lo, la] of c.g) { a = Math.min(a, lo); x = Math.max(x, lo); b = Math.min(b, la); y = Math.max(y, la); }
    return [a, b, x, y];
  });

  // valores por entrada para a hora (0..5 ou -1 = media) e cenario; mascara por operador e frequencia
  function entryVals(slot, scen) {
    const t = new Float32Array(E), tp = new Float32Array(E), car = new Float32Array(E);
    const cA = carArr[scen];
    if (slot >= 0) {
      const o = slot * E;
      for (let e = 0; e < E; e++) { t[e] = tr[o + e]; tp[e] = tpA[o + e]; car[e] = cA[o + e]; }
    } else {
      for (let e = 0; e < E; e++) {
        let st = 0, a = 0, b = 0, n = 0;
        for (let s = 0; s < 6; s++) {
          const k = s * E + e, w = tr[k];
          if (w > 0) { st += w; a += w * tpA[k]; b += w * cA[k]; n++; }
        }
        if (st > 0) { t[e] = st / n; tp[e] = a / st; car[e] = b / st; }
      }
    }
    return { t, tp, car };
  }
  // observacao de um conjunto de troços numa hora (0..5): razao agregada, diferenca acumulada (min), viagens/h por km
  function slotAgg(entries, slot, scen) {
    const cA = carArr[scen];
    let a = 0, b = 0, tk = 0, km = 0, d = 0, n = 0;
    for (const e of entries) {
      const k = slot * E + e, w = tr[k];
      if (w > 0) { a += w * tpA[k]; b += w * cA[k]; tk += w * eKmKm[e]; km += eKmKm[e]; d += (tpA[k] - cA[k]) / 60; n++; }
    }
    return { ratio: b ? a / b : NaN, diff: d, trips: km ? tk / km : NaN, km, n };
  }
  function lineProfile(entries, scen, mask) {
    const cA = carArr[scen], out = [];
    for (let s = 0; s < 6; s++) {
      let a = 0, b = 0;
      for (const e of entries) {
        if (!mask[e]) continue;
        const k = s * E + e, w = tr[k];
        if (w > 0) { a += w * tpA[k]; b += w * cA[k]; }
      }
      out.push(b > 0 ? a / b : NaN);
    }
    return out;
  }

  window.TMLD = {
    SLOT_LABELS, CLS_EDGES, CLS_COLORS, CLS_LABELS, SEQ_BLUE, cls,
    Z, NS, zones, W, zoneMetrics, pooled, pickSlots, otherEnd,
    E, C, routes, eCi, eRi, eKmKm, entByCor, entByRoute, corByRoute, corBounds, tr, entryVals, lineProfile, slotAgg,
    corGeom: L.cor, feedNames: L.feed_names, feedKeys: L.feeds,
  };
})();
