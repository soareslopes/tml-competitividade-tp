/* Graficos leves (canvas/SVG) sem dependencias: dispersao com selecao por retangulo, barras por classe, perfil horario */
(function () {
  const D = window.TMLD;
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  function niceTicks(lo, hi, n) {
    const span = hi - lo, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag, step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v / step) * step);
    return out;
  }
  const fmt = v => (Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1)).replace(".", ",");

  // ------------------------------------------------------------------ dispersao
  class Scatter {
    constructor(el, opts) {
      this.el = el; this.opts = opts || {}; this.pts = []; this.brush = null;
      this.cv = document.createElement("canvas");
      this.tip = document.createElement("div"); this.tip.className = "tip"; this.tip.hidden = true;
      el.append(this.cv, this.tip);
      this.m = { l: 44, r: 10, t: 8, b: 34 };
      const ev = (n, f) => this.cv.addEventListener(n, f);
      ev("mousedown", e => this.down(e));
      ev("mousemove", e => this.move(e));
      window.addEventListener("mouseup", e => this.up(e));
      ev("mouseleave", () => { this.tip.hidden = true; });
      new ResizeObserver(() => this.draw()).observe(el);
    }
    set(pts, cfg) { this.pts = pts; this.cfg = cfg; this.layout(); this.draw(); }
    layout() {
      const p = this.pts, c = this.cfg;
      let xmax = 4, ymin = 0, ymax = 10, vmax = 1;
      for (const q of p) { if (q.x > xmax) xmax = q.x; if (q.y < ymin) ymin = q.y; if (q.y > ymax) ymax = q.y; if (q.v > vmax) vmax = q.v; }
      this.xd = [0, Math.min(12, Math.ceil(xmax * 1.06 * 2) / 2)];
      const pad = (ymax - ymin) * 0.06;
      this.yd = [ymin < 0 ? ymin - pad : 0, ymax + pad];
      if (c.ydom) this.yd = c.ydom;
      this.vmax = c.vmax || vmax;
    }
    rad(v) { const o = this.cfg; return o.rmin + (o.rmax - o.rmin) * Math.sqrt(Math.max(0, v) / this.vmax); }
    sx(x) { return this.m.l + ((Math.min(x, this.xd[1]) - this.xd[0]) / (this.xd[1] - this.xd[0])) * this.pw; }
    sy(y) { return this.m.t + (1 - (Math.max(this.yd[0], Math.min(y, this.yd[1])) - this.yd[0]) / (this.yd[1] - this.yd[0])) * this.ph; }
    draw() {
      const el = this.el, w = el.clientWidth, h = el.clientHeight;
      if (!w || !h || !this.cfg) return;
      const dpr = window.devicePixelRatio || 1;
      this.cv.width = w * dpr; this.cv.height = h * dpr; this.cv.style.width = w + "px"; this.cv.style.height = h + "px";
      const g = this.cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.pw = w - this.m.l - this.m.r; this.ph = h - this.m.t - this.m.b;
      const ink2 = css("--ink2"), grid = css("--grid"), surface = css("--surface"), ink = css("--ink");
      g.clearRect(0, 0, w, h);
      // faixas de classe de razao (so quando o eixo x e a razao)
      const edges = [0, ...D.CLS_EDGES, 1e9];
      for (let k = 0; k < 6; k++) {
        const a = this.sx(Math.max(edges[k], this.xd[0])), b = this.sx(Math.min(edges[k + 1], this.xd[1]));
        if (b > a) { g.globalAlpha = 0.1; g.fillStyle = D.CLS_COLORS[k]; g.fillRect(a, this.m.t, b - a, this.ph); g.globalAlpha = 1; }
      }
      // grelha e eixos
      g.font = "10px system-ui, sans-serif"; g.fillStyle = ink2; g.strokeStyle = grid; g.lineWidth = 1;
      g.textAlign = "center"; g.textBaseline = "top";
      for (const v of niceTicks(this.xd[0], this.xd[1], 6)) {
        const x = Math.round(this.sx(v)) + 0.5;
        g.beginPath(); g.moveTo(x, this.m.t); g.lineTo(x, this.m.t + this.ph); g.stroke();
        g.fillText(fmt(v), x, this.m.t + this.ph + 4);
      }
      g.textAlign = "right"; g.textBaseline = "middle";
      for (const v of niceTicks(this.yd[0], this.yd[1], 5)) {
        const y = Math.round(this.sy(v)) + 0.5;
        g.beginPath(); g.moveTo(this.m.l, y); g.lineTo(this.m.l + this.pw, y); g.stroke();
        g.fillText(fmt(v), this.m.l - 5, y);
      }
      if (this.yd[0] < 0) {
        const y = Math.round(this.sy(0)) + 0.5;
        g.strokeStyle = ink2; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(this.m.l, y); g.lineTo(this.m.l + this.pw, y); g.stroke(); g.setLineDash([]);
      }
      g.fillStyle = ink2; g.textAlign = "center"; g.textBaseline = "bottom";
      g.fillText(this.cfg.xlab, this.m.l + this.pw / 2, h - 1);
      g.save(); g.translate(10, this.m.t + this.ph / 2); g.rotate(-Math.PI / 2); g.textBaseline = "top"; g.fillText(this.cfg.ylab, 0, -2); g.restore();
      // pontos: grandes primeiro (os pequenos ficam por cima)
      const anySel = this.pts.some(q => q.sel);
      const order = this.pts.map((q, i) => i).sort((a, b) => this.pts[b].v - this.pts[a].v);
      this.pos = [];
      for (const i of order) {
        const q = this.pts[i], x = this.sx(q.x), y = this.sy(q.y), r = this.rad(q.v);
        this.pos.push({ i, x, y, r });
        g.globalAlpha = anySel && !q.sel ? 0.22 : 0.78;
        g.fillStyle = q.c; g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
        g.globalAlpha = 1;
        g.lineWidth = q.sel ? 2 : 1; g.strokeStyle = q.sel ? ink : surface; g.stroke();
      }
      if (this.brush) {
        const b = this.brush, x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1), ww = Math.abs(b.x1 - b.x0), hh = Math.abs(b.y1 - b.y0);
        g.fillStyle = css("--accent"); g.globalAlpha = 0.12; g.fillRect(x, y, ww, hh); g.globalAlpha = 1;
        g.strokeStyle = css("--accent"); g.lineWidth = 1.5; g.strokeRect(x, y, ww, hh);
      }
    }
    xy(e) { const r = this.cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
    inPlot(x, y) { return x >= this.m.l && x <= this.m.l + this.pw && y >= this.m.t && y <= this.m.t + this.ph; }
    nearest(x, y) {
      let best = null, bd = 1e9;
      for (let k = this.pos.length - 1; k >= 0; k--) {
        const p = this.pos[k], d = Math.hypot(p.x - x, p.y - y);
        if (d <= p.r + 3 && d < bd) { bd = d; best = p; }
      }
      return best;
    }
    down(e) { const [x, y] = this.xy(e); if (this.inPlot(x, y)) this.brush = { x0: x, y0: y, x1: x, y1: y, shift: e.shiftKey || e.ctrlKey || e.metaKey }; }
    move(e) {
      const [x, y] = this.xy(e);
      if (this.brush) { this.brush.x1 = Math.max(this.m.l, Math.min(x, this.m.l + this.pw)); this.brush.y1 = Math.max(this.m.t, Math.min(y, this.m.t + this.ph)); this.tip.hidden = true; this.draw(); return; }
      const n = this.pos && this.nearest(x, y);
      if (n) {
        this.tip.hidden = false; this.tip.innerHTML = this.pts[n.i].tip;
        const w = this.el.clientWidth;
        this.tip.style.left = Math.min(w - 190, Math.max(0, n.x + 10)) + "px"; this.tip.style.top = Math.max(0, n.y - 8 - this.tip.offsetHeight) + "px";
        this.cv.style.cursor = "pointer";
      } else { this.tip.hidden = true; this.cv.style.cursor = "crosshair"; }
    }
    up(e) {
      const b = this.brush;
      if (!b) return;
      this.brush = null;
      const add = b.shift || e.shiftKey || e.ctrlKey || e.metaKey;
      let ids;
      if (Math.abs(b.x1 - b.x0) < 4 && Math.abs(b.y1 - b.y0) < 4) {
        const n = this.nearest(b.x0, b.y0);
        ids = n ? [this.pts[n.i].id] : [];
        if (!n && !add) { this.draw(); this.cfg.onSelect && this.cfg.onSelect([], false); return; }
      } else {
        const x0 = Math.min(b.x0, b.x1), x1 = Math.max(b.x0, b.x1), y0 = Math.min(b.y0, b.y1), y1 = Math.max(b.y0, b.y1);
        ids = this.pos.filter(p => p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1).map(p => this.pts[p.i].id);
      }
      this.draw();
      this.cfg.onSelect && this.cfg.onSelect(ids, add);
    }
  }

  // ------------------------------------------------------------------ barras por classe
  function bars(el, sel, ref, opts) {
    opts = opts || {};
    const w = el.clientWidth || 360, rowH = 22, h = 6 * rowH + 6, lw = 52, rw = 44, bw = w - lw - rw;
    const ink = css("--ink"), ink2 = css("--ink2"), surface = css("--surface");
    const mx = Math.max(0.05, ...sel, ...(ref || []));
    const scale = bw / Math.min(1, mx * 1.08);
    let s = `<svg width="${w}" height="${h}" role="img" aria-label="${opts.aria || "Distribuição por classe de razão"}">`;
    for (let k = 0; k < 6; k++) {
      const y = k * rowH + 3, v = sel[k] || 0, bwid = Math.max(v > 0 ? 2 : 0, v * scale);
      s += `<text x="${lw - 8}" y="${y + 12}" text-anchor="end" font-size="11" fill="${ink2}">${D.CLS_LABELS[k]}</text>`;
      s += `<rect x="${lw}" y="${y + 1}" width="${bw}" height="14" rx="3" fill="${css("--grid")}" opacity=".5"/>`;
      s += `<rect x="${lw}" y="${y + 1}" width="${bwid}" height="14" rx="3" fill="${D.CLS_COLORS[k]}"><title>${D.CLS_LABELS[k]}: ${(v * 100).toFixed(1).replace(".", ",")}%</title></rect>`;
      if (ref) { const rx = lw + ref[k] * scale; s += `<line x1="${rx}" x2="${rx}" y1="${y - 1}" y2="${y + 17}" stroke="${ink}" stroke-width="2" stroke-linecap="round"><title>Toda a rede: ${(ref[k] * 100).toFixed(1).replace(".", ",")}%</title></line>`; }
      s += `<text x="${w - rw + 6}" y="${y + 12}" font-size="11" font-weight="600" fill="${ink}">${(v * 100).toFixed(v < 0.1 ? 1 : 0).replace(".", ",")}%</text>`;
    }
    el.innerHTML = s + "</svg>";
  }

  // ------------------------------------------------------------------ perfil horario
  function profile(el, series, opts) {
    opts = opts || {};
    const w = el.clientWidth || 360, h = el.clientHeight || 170, m = { l: 36, r: 12, t: 14, b: 24 };
    const ink = css("--ink"), ink2 = css("--ink2"), grid = css("--grid"), surface = css("--surface");
    const xs = [0, 1, 2, 4, 5, 6], X = i => m.l + (xs[i] / 6) * (w - m.l - m.r);
    const all = series.flatMap(s => s.vals).filter(v => v === v);
    if (!all.length) { el.innerHTML = `<div class="empty">Sem dados para esta seleção.</div>`; return; }
    let lo = Math.min(...all), hi = Math.max(...all);
    const pad = Math.max(0.15, (hi - lo) * 0.2);
    lo = Math.max(0, lo - pad); hi = hi + pad;
    const Y = v => m.t + (1 - (v - lo) / (hi - lo)) * (h - m.t - m.b);
    let s = `<svg width="${w}" height="${h}" role="img" aria-label="Perfil horário da razão">`;
    for (const v of niceTicks(lo, hi, 4)) s += `<line x1="${m.l}" x2="${w - m.r}" y1="${Y(v)}" y2="${Y(v)}" stroke="${grid}"/><text x="${m.l - 5}" y="${Y(v) + 3}" text-anchor="end" font-size="10" fill="${ink2}">${fmt(v)}</text>`;
    s += `<rect x="${X(2) + 6}" y="${m.t}" width="${X(3) - X(2) - 12}" height="${h - m.t - m.b}" fill="${grid}" opacity=".35"/>`;
    for (let i = 0; i < 6; i++) s += `<text x="${X(i)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="${ink2}">${D.SLOT_LABELS[i]}</text>`;
    for (const sr of series) {
      const pts = sr.vals.map((v, i) => (v === v ? [X(i), Y(v), v, i] : null));
      for (const seg of [pts.slice(0, 3), pts.slice(3)]) {
        const ok = seg.filter(Boolean);
        if (ok.length > 1) s += `<polyline fill="none" stroke="${sr.color}" stroke-width="${sr.w || 2}" ${sr.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linecap="round" stroke-linejoin="round" points="${ok.map(p => p[0] + "," + p[1]).join(" ")}"/>`;
      }
      if (!sr.dash) for (const p of pts) if (p) s += `<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${sr.color}" stroke="${surface}" stroke-width="2"><title>${sr.name}, ${D.SLOT_LABELS[p[3]]}: ${fmt(p[2])}</title></circle>`;
    }
    el.innerHTML = s + "</svg>";
  }

  window.TMLC = { Scatter, bars, profile, fmt, niceTicks };
})();
