"""Fase 4a: graficos (dispersao, barras por classe, perfil horario de linhas)."""
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from viz import (CAT, CLASS_COLORS, CLASS_LABELS, GRID, INK, INK2, SURFACE, class_legend, classify)

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
FIG = ROOT / "reports/figuras"
FIG.mkdir(parents=True, exist_ok=True)
SLOTS = ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"]
NOTE = "Prova de conceito: TomTom jan/2020, GTFS 2024 (Carris Metropolitana, Carris, Metro, Fertagus), OSM 2026."

od = pd.read_parquet(PR / "od_ratio.parquet")
v = od[od.tp_reachable & (od.car_avg_min >= 5)].copy()
v["cls"] = classify(v.ratio)

# ---------------------------------------------------------------- Fig 1: dispersao ratio x diferenca
a = v[v.slot == "08-09"]
fig, axs = plt.subplots(1, 2, figsize=(12.5, 5.2))
ax = axs[0]
rng = np.random.default_rng(1)
idx = rng.permutation(len(a))
ax.scatter(a.ratio.values[idx], a.diff_min.values[idx], c=[CLASS_COLORS[i] for i in a.cls.values[idx]], s=4, alpha=0.5, linewidths=0, rasterized=True)
ax.set_xscale("log")
ax.set_xlim(1.0, 16)
ax.set_xticks([1, 1.5, 2, 3, 4, 6, 10]); ax.set_xticklabels(["1", "1.5", "2", "3", "4", "6", "10"])
for x in (1.5, 2, 3, 4):
    ax.axvline(x, color=GRID, lw=0.9, zorder=0)
ax.set_xlabel("Razão TP / carro (escala logarítmica)")
ax.set_ylabel("Diferença TP − carro (minutos)")
ax.set_title("A. Razão vs diferença absoluta", loc="left")
class_legend(ax, loc="upper left")
ax = axs[1]
ax.scatter(a.car_avg_min.values[idx], a.tp_p50.values[idx], c=[CLASS_COLORS[i] for i in a.cls.values[idx]], s=4, alpha=0.5, linewidths=0, rasterized=True)
xx = np.array([0, 100])
for k in (1, 2, 3, 4):
    ax.plot(xx, xx * k, color=INK, lw=1.0, ls=(0, (4, 3)), zorder=3)
    xl, yl = (97, 97 * k) if 97 * k <= 172 else (172 / k, 172)
    ax.text(xl, yl, f"{k}×", color=INK, fontsize=9, ha="right", va="bottom", zorder=4,
            bbox=dict(boxstyle="round,pad=0.15", fc=SURFACE, ec="none", alpha=0.9))
ax.set_xlim(0, 100); ax.set_ylim(0, 180)
ax.set_xlabel("Tempo de carro (min)")
ax.set_ylabel("Tempo de TP porta a porta (min)")
ax.set_title("B. Tempo de carro vs tempo de TP", loc="left")
fig.suptitle(f"Pares de zonas, quarta-feira 08-09h (n = {len(a):,}); cada ponto é um par origem-destino", x=0.01, ha="left", fontsize=10, color=INK2, y=0.995)
fig.text(0.01, 0.005, NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.02, 1, 0.97))
fig.savefig(FIG / "fig1_dispersao_ratio_diferenca.png", dpi=170)
plt.close(fig)

# ---------------------------------------------------------------- Fig 2: barras por classe, por hora
seg = pd.read_parquet(PR / "seg_tp_car.parquet")
seg = seg[seg.car_ok & seg.ratio.notna()].copy()
seg["cls"] = classify(seg.ratio)
bus = seg[seg.feed.isin(["cm", "carris"])]
rail = seg[seg.feed.isin(["metro", "fertagus"])]

def shares(df, w=None):
    if w is None:
        t = df.groupby(["slot", "cls"]).size().unstack(fill_value=0)
    else:
        t = df.groupby(["slot", "cls"])[w].sum().unstack(fill_value=0)
    t = t.reindex(columns=range(6), fill_value=0).reindex(SLOTS)
    return t.div(t.sum(axis=1), axis=0)

def stacked(ax, sh, title, labels=None):
    y = np.arange(len(sh))[::-1]
    left = np.zeros(len(sh))
    for k in range(6):
        w = sh[k].values
        ax.barh(y, w, left=left, color=CLASS_COLORS[k], edgecolor=SURFACE, linewidth=1.5, height=0.72)
        for yi, li, wi in zip(y, left, w):
            if wi >= 0.06:
                ax.text(li + wi / 2, yi, f"{wi*100:.0f}%", ha="center", va="center", fontsize=8,
                        color="white" if k in (0, 4, 5) else INK)
        left += w
    labs = labels or [f"{s[:2]}h-{s[3:]}h" for s in SLOTS]
    ax.set_yticks(y); ax.set_yticklabels(labs)
    ax.set_xlim(0, 1); ax.set_xticks([0, .25, .5, .75, 1]); ax.set_xticklabels(["0", "25%", "50%", "75%", "100%"])
    ax.grid(False); ax.spines["left"].set_visible(False)
    ax.set_title(title, loc="left")

def scen_shares(df):
    rows, labs = [], []
    for slot, nm in (("08-09", "08h-09h"), ("18-19", "18h-19h")):
        d = df[df.slot == slot]
        for col, lab in (("ratio_free", "carro fluido"), ("ratio", "carro médio"), ("ratio_cong", "carro congestionado")):
            c = classify(d[col].values)
            t = pd.Series(d.chord_m.values).groupby(c).sum().reindex(range(6), fill_value=0)
            rows.append(t / t.sum()); labs.append(f"{nm}, {lab}")
    return pd.DataFrame(rows).reset_index(drop=True), labs

fig, axs = plt.subplots(1, 3, figsize=(15.5, 4.8), gridspec_kw={"width_ratios": [1, 1, 1]})
stacked(axs[0], shares(v), "A. Porta a porta, entre zonas\n(% dos pares origem-destino)")
stacked(axs[1], shares(bus, "chord_m"), "B. Troços de autocarro\n(% da distância)")
sc, labs = scen_shares(bus)
stacked(axs[2], sc, "C. Autocarros, 3 cenários de carro\n(% da distância)", labels=labs)
class_legend(axs[1], loc="upper center", bbox_to_anchor=(0.5, -0.12), ncol=6)
fig.suptitle("Distribuição da razão TP / carro por hora de ponta (quarta-feira)", x=0.01, ha="left", fontsize=12, fontweight="bold")
fig.text(0.01, 0.005, "Cenário de carro: fluido = percentil 85 das velocidades, médio = média harmónica, congestionado = percentil 15.\n" + NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.05, 1, 0.94))
fig.savefig(FIG / "fig2_classes_por_hora.png", dpi=170)
plt.close(fig)

# ---------------------------------------------------------------- Fig 3: perfil horario de linhas
lm = pd.read_parquet(PR / "line_metrics.parquet")
lp = pd.read_parquet(PR / "line_profile.parquet")
b = lm[lm.feed.isin(["cm", "carris"]) & (lm.km >= 8) & (lm.trips_h >= 2) & (lm.horas == 6)]
best = b.nsmallest(6, "ratio")
worst = b.nlargest(6, "ratio")
rail_l = lm[lm.feed.isin(["metro", "fertagus"])].sort_values("ratio").head(6)

def label(r):
    n = r.route_name
    n = n.replace(" | Circular", " (circ.)")
    return (n[:34] + "…") if len(n) > 35 else n

fig, axs = plt.subplots(1, 3, figsize=(15.5, 5), sharey=False)
for ax, sel, title, ylim in [(axs[0], best, "A. Autocarros mais competitivos\n(≥ 8 km, ≥ 2 viagens/hora)", (0.4, 1.4)),
                              (axs[1], worst, "B. Autocarros menos competitivos\n(≥ 8 km, ≥ 2 viagens/hora)", (1.4, 2.8)),
                              (axs[2], rail_l, "C. Metro e Fertagus", (0.2, 0.9))]:
    for i, r in enumerate(sel.itertuples()):
        d = lp[(lp.feed == r.feed) & (lp.route_id == r.route_id)].set_index("slot").reindex(SLOTS)
        ax.plot(range(6), d.ratio_w.values, color=CAT[i], lw=2, marker="o", ms=5, markeredgecolor=SURFACE, markeredgewidth=1.5,
                label=label(r))
    ax.set_xticks(range(6)); ax.set_xticklabels([f"{s[:2]}h" for s in SLOTS])
    ax.axvline(2.5, color=GRID, lw=1)
    lo, hi = ax.get_ylim(); ax.set_ylim(max(0, lo - 0.05), hi + 0.05)
    ax.set_title(title, loc="left")
    ax.set_ylabel("Razão TP / carro (agregada na linha)" if ax is axs[0] else "")
    ax.legend(fontsize=7.8, loc="upper center", bbox_to_anchor=(0.5, -0.1), ncol=1)
fig.suptitle("Perfil de competitividade das linhas ao longo das horas de ponta (razão agregada dos troços, ponderada pelo tempo)", x=0.01, ha="left", fontsize=11, fontweight="bold")
fig.text(0.01, 0.005, NOTE + " Pontas da manhã (7h a 10h) e da tarde (17h a 20h).", fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.03, 1, 0.94))
fig.savefig(FIG / "fig3_perfil_linhas.png", dpi=170)
plt.close(fig)

# ---------------------------------------------------------------- Fig 4: barras por classe, por linha
bus_all = bus.copy()
g = bus_all.groupby(["feed", "route_id", "cls"]).chord_m.sum().unstack(fill_value=0).reindex(columns=range(6), fill_value=0)
g = g.div(g.sum(axis=1), axis=0)
sel = pd.concat([best.assign(grp="competitivas"), worst.assign(grp="menos competitivas")])
rows = []
for r in sel.itertuples():
    rows.append((label(r), g.loc[(r.feed, r.route_id)].values, r.grp, r.ratio, r.trips_h))
fig, ax = plt.subplots(figsize=(10.5, 6.4))
y = np.arange(len(rows))[::-1]
for yi, (nm, sh, grp, ratio, th) in zip(y, rows):
    left = 0
    for k in range(6):
        ax.barh(yi, sh[k], left=left, color=CLASS_COLORS[k], edgecolor=SURFACE, linewidth=1.5, height=0.72)
        if sh[k] >= 0.08:
            ax.text(left + sh[k] / 2, yi, f"{sh[k]*100:.0f}%", ha="center", va="center", fontsize=7.5, color="white" if k in (0, 4, 5) else INK)
        left += sh[k]
    ax.text(1.01, yi, f"{ratio:.2f}", va="center", fontsize=8.5, color=INK2)
ax.set_yticks(y); ax.set_yticklabels([r[0] for r in rows], fontsize=8.5)
ax.set_xlim(0, 1.06); ax.set_xticks([0, .25, .5, .75, 1]); ax.set_xticklabels(["0", "25%", "50%", "75%", "100%"])
ax.axhline(5.5, color=INK2, lw=0.8)
ax.text(-0.005, 11.9, "Mais competitivas", fontsize=9, color=INK2, ha="right", va="center", transform=ax.get_yaxis_transform()) if False else None
ax.grid(False); ax.spines["left"].set_visible(False)
ax.text(1.01, len(rows) - 0.35, "razão\nagregada", fontsize=8, color=INK2, va="bottom", ha="left")
ax.set_title("Troços de cada linha por classe de razão TP / carro\n(% da distância, média das 6 horas de ponta)", loc="left", fontsize=10.5, pad=24)
class_legend(ax, loc="upper center", bbox_to_anchor=(0.5, -0.06), ncol=6, title=None)
fig.text(0.01, 0.005, "Em cima: 6 linhas mais competitivas. Em baixo: 6 menos competitivas (≥ 8 km, ≥ 2 viagens/h).\n" + NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.05, 1, 1))
fig.savefig(FIG / "fig4_barras_classes_linhas.png", dpi=170)
plt.close(fig)
print("figuras:", sorted(p.name for p in FIG.glob("fig*.png")))
