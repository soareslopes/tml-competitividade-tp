"""Estilo e paleta partilhados pelas figuras (metodo dataviz: tokens, cores por funcao, superficie clara)."""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.patches import Patch

SURFACE = "#fcfcfb"
INK = "#0b0b0b"
INK2 = "#52514e"
GRID = "#e4e3df"
NEUTRAL = "#d9d7d0"

# classes de ratio TP/carro: frio (TP competitivo) -> quente (TP muito mais lento). Divergente azul-vermelho
# com ponto medio neutro quente; 2 degraus frios e 4 quentes porque quase nenhum par fica abaixo de 1.
CLASS_EDGES = [0, 1, 1.5, 2, 3, 4, np.inf]
CLASS_LABELS = ["< 1", "1 a 1.5", "1.5 a 2", "2 a 3", "3 a 4", "> 4"]
CLASS_COLORS = ["#256abf", "#86b6ef", "#ecd9b8", "#f0a58b", "#d9483b", "#8f1d1d"]
# categorico (ordem fixa do palette de referencia)
CAT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300"]
# sequencial azul (passos 100 a 700)
SEQ_BLUE = ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"]


def classify(r):
    r = np.asarray(r, dtype=float)
    return np.digitize(r, CLASS_EDGES[1:-1], right=False)  # 0..5


def class_legend(ax, title="Razão TP / carro", loc="best", ncol=1, **kw):
    handles = [Patch(facecolor=c, edgecolor=SURFACE, label=l) for c, l in zip(CLASS_COLORS, CLASS_LABELS)]
    leg = ax.legend(handles=handles, title=title, loc=loc, ncol=ncol, frameon=False, fontsize=8.5, title_fontsize=9, **kw)
    for t in leg.get_texts():
        t.set_color(INK2)
    leg.get_title().set_color(INK2)
    return leg


def style(fig=None):
    plt.rcParams.update({
        "figure.facecolor": SURFACE, "axes.facecolor": SURFACE, "savefig.facecolor": SURFACE,
        "text.color": INK, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
        "axes.edgecolor": GRID, "axes.spines.top": False, "axes.spines.right": False,
        "axes.grid": True, "grid.color": GRID, "grid.linewidth": 0.7, "axes.axisbelow": True,
        "font.size": 9.5, "axes.titlesize": 11, "axes.titleweight": "bold", "axes.titlecolor": INK,
        "font.family": "sans-serif", "legend.frameon": False,
    })


style()
