"""Fase 0, passo 5: a rede TomTom 2026 serve de grafo de roteamento?

Testes: sentido de circulacao, conectividade (SCC), roteamento de teste.
"""
from pathlib import Path

import geopandas as gpd
import igraph as ig
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data" / "parquet"

net = gpd.read_parquet(P / "net2026.parquet")
sp = pd.read_parquet(P / "speed2026_allday.parquet")[["id", "avgtt", "medtt", "hvgsp"]]
net = net.merge(sp, on="id", how="left")
print("segmentos:", len(net), "| com tempo:", net["avgtt"].notna().sum())

# extremos (ordem dos vertices = sentido de digitalizacao)
def ends(geom):
    c = geom.coords
    return c[0], c[-1]
e = net.geometry.apply(ends)
A = np.array([x[0] for x in e]); B = np.array([x[1] for x in e])
key = lambda xy: (np.round(xy[:, 0] * 1e6)).astype("int64") * 10_000_000_000 + (np.round(xy[:, 1] * 1e6)).astype("int64")
ka, kb = key(A), key(B)
nodes, inv = np.unique(np.concatenate([ka, kb]), return_inverse=True)
u, v = inv[: len(net)], inv[len(net):]
print("nos:", len(nodes), "| arestas:", len(net))

# sentido: existe aresta inversa?
pairs = set(zip(u.tolist(), v.tolist()))
rev = np.array([(b, a) in pairs for a, b in zip(u, v)])
print(f"arestas com inversa (B->A existe): {rev.mean():.1%}")
print("loops (u==v):", int((u == v).sum()))

# tempos: AvgTt onde existe, senao comprimento / velocidade-limite, com piso
fb = net["length_m"] / (net["speed_limit"].clip(lower=10) / 3.6)
w = net["avgtt"].fillna(fb)
print("fracao de arestas com tempo de fallback:", round(float(net["avgtt"].isna().mean()), 3))

g_dir = ig.Graph(n=len(nodes), edges=list(zip(u.tolist(), v.tolist())), directed=True)
g_dir.es["w"] = w.tolist()
for mode in ["weak", "strong"]:
    comp = g_dir.connected_components(mode=mode)
    sizes = sorted(comp.sizes(), reverse=True)
    print(f"componentes ({mode}): {len(sizes)} | maior: {sizes[0]} nos ({sizes[0]/len(nodes):.1%}) | 2o: {sizes[1] if len(sizes)>1 else 0}")

# roteamento de teste no maior SCC
scc = g_dir.connected_components(mode="strong")
big = int(np.argmax(scc.sizes()))
in_big = np.array(scc.membership) == big
coords = np.zeros((len(nodes), 2))
coords[u] = A; coords[v] = B
tree = cKDTree(coords[in_big]); idx_big = np.where(in_big)[0]

def snap(lat, lon):
    d, i = tree.query([lon, lat])
    return int(idx_big[i]), d * 111000

tests = {
    "Praca do Comercio -> Oriente": ((38.7076, -9.1365), (38.7678, -9.0993)),
    "Cascais centro -> Lisboa Sete Rios": ((38.6979, -9.4215), (38.7421, -9.1672)),
    "Almada Cova da Piedade -> Lisboa Saldanha": ((38.6670, -9.1685), (38.7340, -9.1450)),
    "Sintra -> Amadora": ((38.7973, -9.3881), (38.7536, -9.2302)),
    "Setubal -> Lisboa Entrecampos": ((38.5244, -8.8882), (38.7450, -9.1480)),
}
print("\nrotas de teste (tempo, distancia):")
for name, (o, d) in tests.items():
    so, do_ = snap(*o), snap(*d)
    path = g_dir.get_shortest_paths(so[0], to=do_[0], weights="w", output="epath")[0]
    t = w.to_numpy()[path].sum() / 60
    dist = net["length_m"].to_numpy()[path].sum() / 1000
    print(f"  {name}: {t:5.1f} min, {dist:5.1f} km, vel media {dist/(t/60):4.0f} km/h (snap {so[1]:.0f} m, {do_[1]:.0f} m)")
