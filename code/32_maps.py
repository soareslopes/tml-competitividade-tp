"""Fase 4b: mapas tematicos por zona e mapas de linhas (cor = classe de razao, espessura = frequencia)."""
import sys
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from matplotlib.collections import LineCollection
from matplotlib.colors import BoundaryNorm, ListedColormap
from matplotlib.lines import Line2D
from matplotlib.patches import Patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from viz import (CLASS_COLORS, CLASS_EDGES, CLASS_LABELS, GRID, INK, INK2, NEUTRAL, SEQ_BLUE, SURFACE, class_legend, classify)

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
FIG = ROOT / "reports/figuras"
G = ROOT / "data/raw/geoportal"
NOTE = "Prova de conceito: TomTom jan/2020, GTFS 2024, OSM 2026. Sem CP, TCB, fluvial, Metro Sul e Mobi Cascais."
HATCH = "////"

zones = gpd.read_parquet(PR / "zones.parquet").to_crs(3763)
zs = pd.read_parquet(PR / "zone_summary.parquet")
zones = zones.merge(zs.drop(columns=["municipio", "area_km2"]), on="zona", how="left")
conc = gpd.read_file(G / "informacao_base_limite_concelho_aml.geojson").to_crs(3763)
minx, miny, maxx, maxy = conc.total_bounds


def base(ax, bounds=None):
    conc.plot(ax=ax, color="#f1f0ec", edgecolor="none", zorder=0)
    ax.set_aspect("equal"); ax.axis("off")
    b = bounds or (minx - 2000, miny - 2000, maxx + 2000, maxy + 2000)
    ax.set_xlim(b[0], b[2]); ax.set_ylim(b[1], b[3])


def finish(ax):
    conc.boundary.plot(ax=ax, color=INK2, linewidth=0.5, zorder=5)


# --------------------------------------------------------------- Mapa 1: zonas, razao e diferenca
fig, axs = plt.subplots(1, 2, figsize=(14, 7.4))
ax = axs[0]
base(ax)
ok = zones[zones.ratio_w.notna() & (zones["pop"] >= 100)]
no_tp = zones[zones.ratio_w.isna() & (zones["pop"] >= 100)]
zones[zones["pop"] < 100].plot(ax=axs[0], color="#e9e8e3", edgecolor="none", zorder=1)
for i, c in enumerate(CLASS_COLORS):
    sub = ok[classify(ok.ratio_w.values) == i]
    if len(sub):
        sub.plot(ax=ax, color=c, edgecolor=SURFACE, linewidth=0.4, zorder=2)
if len(no_tp):
    no_tp.plot(ax=ax, facecolor="#e4e3df", edgecolor=INK2, hatch=HATCH, linewidth=0.3, zorder=2)
finish(ax)
ax.set_title("A. Razão TP / carro (mediana a partir de cada zona de origem)", loc="left", fontsize=10.5, fontweight="bold")
h = [Patch(facecolor=c, edgecolor=SURFACE, label=l) for c, l in zip(CLASS_COLORS, CLASS_LABELS)]
h.append(Patch(facecolor="#e4e3df", edgecolor=INK2, hatch=HATCH, label="sem TP alcançável (180 min)"))
ax.legend(handles=h, title="Razão TP / carro", loc="upper right", frameon=False, fontsize=8.5, title_fontsize=9)

ax = axs[1]
base(ax)
dedges = [40, 55, 70, 85, 100, 115]
cmap = ListedColormap(SEQ_BLUE)
norm = BoundaryNorm(dedges, cmap.N, extend="both")
zones[zones["pop"] < 100].plot(ax=ax, color="#e9e8e3", edgecolor="none", zorder=1)
ok.plot(ax=ax, column="diff_w", cmap=cmap, norm=norm, edgecolor=SURFACE, linewidth=0.4, zorder=2)
if len(no_tp):
    no_tp.plot(ax=ax, facecolor="#e4e3df", edgecolor=INK2, hatch=HATCH, linewidth=0.3, zorder=2)
finish(ax)
ax.set_title("B. Diferença TP − carro (minutos, mediana por zona de origem)", loc="left", fontsize=10.5, fontweight="bold")
labs = [f"< {dedges[0]}"] + [f"{dedges[i]} a {dedges[i+1]}" for i in range(len(dedges) - 1)] + [f"> {dedges[-1]}"]
h = [Patch(facecolor=c, edgecolor=SURFACE, label=l + " min") for c, l in zip(SEQ_BLUE, labs)]
ax.legend(handles=h, title="Diferença", loc="upper right", frameon=False, fontsize=8.5, title_fontsize=9)
fig.suptitle("Perfil territorial: quão pior é o TP face ao carro, a partir de cada zona (média das 6 horas de ponta)", x=0.01, ha="left", fontsize=12, fontweight="bold")
fig.text(0.01, 0.01, "Mediana ponderada pela população das zonas de destino, pares com carro ≥ 5 min. " + NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.03, 1, 0.95))
fig.savefig(FIG / "mapa1_zonas_ratio_diferenca.png", dpi=170)
plt.close(fig)

# --------------------------------------------------------------- Mapa 2: grupos de prioridade
GROUPS = [("oportunidade rapida (populosa)", "#256abf", "Oportunidade rápida (populosa, razão mais baixa)"),
          ("intermedia (populosa)", "#ecd9b8", "Intermédia (populosa)"),
          ("prioridade alta (populosa)", "#d9483b", "Prioridade alta (populosa, razão mais alta)"),
          ("estrutural (pouca procura)", "#d9d7d0", "Estrutural (pouca população)"),
          ("cobertura limitada", "#b9a89a", "Cobertura limitada (TP alcança < 30% da população)"),
          ("sem TP alcancavel", "#4a1010", "Sem TP alcançável em 180 min")]
fig, ax = plt.subplots(figsize=(8.6, 8))
base(ax)
zones[zones["pop"] < 100].plot(ax=ax, color="#e9e8e3", edgecolor="none", zorder=1)
for key, col, lab in GROUPS:
    sub = zones[zones.grupo == key]
    if len(sub):
        sub.plot(ax=ax, color=col, edgecolor=SURFACE, linewidth=0.4, zorder=2)
finish(ax)
ax.legend(handles=[Patch(facecolor=c, edgecolor=SURFACE, label=l) for _, c, l in GROUPS], loc="upper right", frameon=True, facecolor=SURFACE, edgecolor="none", framealpha=0.93, fontsize=8.5)
ax.set_title("Zonas que precisam de maior atenção", loc="left", fontsize=12, fontweight="bold")
top = zones[zones.grupo == "prioridade alta (populosa)"].nlargest(8, "delta_pessoa_min")
for r in top.itertuples():
    p = r.geometry.representative_point()
    ax.annotate(f"{r.zona}", (p.x, p.y), fontsize=7, color="white", ha="center", va="center", zorder=7, fontweight="bold")
fig.text(0.01, 0.005, "Números: 8 zonas populosas com maior desvantagem (população × diferença).\n" + NOTE, fontsize=7, color=INK2)
fig.tight_layout(rect=(0, 0.05, 1, 1))
fig.savefig(FIG / "mapa2_zonas_grupos.png", dpi=170)
plt.close(fig)

# --------------------------------------------------------------- Mapa 3 e 4: linhas
seg = pd.read_parquet(PR / "seg_tp_car.parquet")
geo = gpd.read_parquet(PR / "seg_geom.parquet")
seg = seg[seg.car_ok & seg.ratio.notna()].copy()
seg["w_tp"] = seg.tp_s * seg.n_trips
seg["w_car"] = seg.car_avg_s * seg.n_trips

def corridors(slot):
    d = seg[seg.slot == slot]
    g = d.groupby(["feed", "stop_from", "stop_to"]).agg(trips=("n_trips", "sum"), w_tp=("w_tp", "sum"), w_car=("w_car", "sum"),
                                                          pattern=("pattern", "first"), seg=("seg", "first")).reset_index()
    g["ratio"] = g.w_tp / g.w_car
    g = g.merge(geo, on=["pattern", "seg"])
    return gpd.GeoDataFrame(g, geometry="geometry", crs=3763)

def width(trips):
    return 0.35 + 0.55 * np.sqrt(np.clip(trips, 0, 12))   # 0.35 a ~2.4 pt

def draw_lines(ax, g, bounds=None, lw_scale=1.0):
    base(ax, bounds)
    g = g.assign(cls=classify(g.ratio.values)).sort_values("cls")  # mais lentos por cima
    for k in range(6):
        s = g[g.cls == k]
        if len(s):
            lc = LineCollection([np.asarray(geom.coords) for geom in s.geometry], colors=CLASS_COLORS[k],
                                linewidths=width(s.trips.values) * lw_scale, capstyle="round", zorder=3 + k, alpha=0.95)
            ax.add_collection(lc)
    conc.boundary.plot(ax=ax, color="#bdbbb3", linewidth=0.5, zorder=2)

def line_legend(ax, loc="lower left"):
    h = [Patch(facecolor=c, edgecolor=SURFACE, label=l) for c, l in zip(CLASS_COLORS, CLASS_LABELS)]
    h += [Line2D([0], [0], color=INK2, lw=width(t), label=f"{t} viagens/hora") for t in (1, 4, 12)]
    ax.legend(handles=h, loc=loc, frameon=False, fontsize=8, title="Cor: razão TP / carro\nEspessura: frequência", title_fontsize=8.5)

fig, axs = plt.subplots(1, 2, figsize=(15, 7.6))
for ax, slot, t in zip(axs, ("08-09", "18-19"), ("A. Manhã, 8h às 9h", "B. Tarde, 18h às 19h")):
    draw_lines(ax, corridors(slot))
    ax.set_title(t, loc="left", fontsize=10.5, fontweight="bold")
line_legend(axs[0])
fig.suptitle("Troços de linha: onde o TP é mais ou menos competitivo face ao carro (autocarro, metro e comboio, quarta-feira)", x=0.01, ha="left", fontsize=12, fontweight="bold")
fig.text(0.01, 0.01, "Razão = tempo programado do TP / tempo de carro entre as mesmas paragens, por troço de cerca de 1 km. " + NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.03, 1, 0.95))
fig.savefig(FIG / "mapa3_linhas_AML.png", dpi=170)
plt.close(fig)

lis = conc[conc.municipio == "Lisboa"].total_bounds
bnd = (lis[0] - 3500, lis[1] - 3000, lis[2] + 3500, lis[3] + 3000)
fig, axs = plt.subplots(1, 2, figsize=(15, 7.4))
for ax, slot, t in zip(axs, ("08-09", "18-19"), ("A. Manhã, 8h às 9h", "B. Tarde, 18h às 19h")):
    draw_lines(ax, corridors(slot), bounds=bnd, lw_scale=1.15)
    ax.set_title(t, loc="left", fontsize=10.5, fontweight="bold")
line_legend(axs[0], loc="lower right")
fig.suptitle("Lisboa e arredores: competitividade dos troços de linha", x=0.01, ha="left", fontsize=12, fontweight="bold")
fig.text(0.01, 0.01, NOTE, fontsize=7.5, color=INK2)
fig.tight_layout(rect=(0, 0.03, 1, 0.95))
fig.savefig(FIG / "mapa4_linhas_Lisboa.png", dpi=170)
plt.close(fig)
print(sorted(p.name for p in FIG.glob("mapa*.png")))
