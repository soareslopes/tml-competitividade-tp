"""Grafo de carro (OSM + velocidades TomTom 2020 por hora).

Uso:
    from carnet import CarNet
    net = CarNet()
    t = net.od_minutes(origens_xy, destinos_xy, slot="08-09", scenario="avg")

Coordenadas em EPSG:3763 (metros). Cenarios: "avg" (velocidade media harmonica),
"cong" (percentil 15 de velocidade, congestionado), "free" (percentil 85, fluido).
"""
from pathlib import Path

import geopandas as gpd
import igraph as ig
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
SLOTS = ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"]
COL = {"avg": "v_avg", "cong": "v_p15", "free": "v_p85"}


class CarNet:
    def __init__(self) -> None:
        e = gpd.read_parquet(PR / "osm_edges.parquet", columns=["edge_id", "u", "v", "length_m", "highway", "name", "geometry"])
        self.edges = e
        self.speeds = pd.read_parquet(PR / "edge_speeds.parquet")
        assert (self.speeds.edge_id.values == e.edge_id.values).all()
        nodes = pd.read_parquet(PR / "osm_nodes.parquet")
        self.nodes = nodes
        n = len(nodes)
        self.g = ig.Graph(n=n, edges=list(zip(e.u.tolist(), e.v.tolist())), directed=True)
        scc = self.g.connected_components(mode="strong")
        self.scc_share = max(scc.sizes()) / n
        in_big = np.array(scc.membership) == int(np.argmax(scc.sizes()))
        self.in_big = in_big
        self.big_idx = np.where(in_big)[0]
        self.tree = cKDTree(nodes[["x", "y"]].to_numpy()[self.big_idx])
        # nos "locais": extremos de arestas que nao sao autoestrada/via rapida (para snap de paragens e zonas)
        loc = e[~e.highway.str.contains("motorway|trunk")]
        loc_nodes = np.intersect1d(np.unique(np.r_[loc.u.to_numpy(), loc.v.to_numpy()]), self.big_idx)
        self.loc_idx = loc_nodes
        self.tree_loc = cKDTree(nodes[["x", "y"]].to_numpy()[loc_nodes])
        self.length = e.length_m.to_numpy()

    def weights(self, slot: str, scenario: str = "avg") -> np.ndarray:
        v = self.speeds[f"{COL[scenario]}_{slot}"].to_numpy()
        return self.length / (v / 3.6)  # segundos

    def snap(self, xy: np.ndarray, local: bool = True):
        """Nó mais próximo no maior SCC. Por defeito ignora nós exclusivos de autoestrada/via rápida."""
        if local:
            d, i = self.tree_loc.query(xy)
            return self.loc_idx[i], d
        d, i = self.tree.query(xy)
        return self.big_idx[i], d

    def od_minutes(self, o_xy: np.ndarray, d_xy: np.ndarray, slot: str = "08-09", scenario: str = "avg") -> np.ndarray:
        """Matriz de tempos (minutos) origem x destino, snapando ao maior componente fortemente conexo."""
        w = self.weights(slot, scenario)
        so, _ = self.snap(o_xy)
        sd, _ = self.snap(d_xy)
        M = self.g.distances(source=so.tolist(), target=sd.tolist(), weights=w.tolist(), mode="out")
        return np.array(M) / 60.0

    def route(self, o_xy, d_xy, slot="08-09", scenario="avg"):
        w = self.weights(slot, scenario)
        so, dso = self.snap(np.atleast_2d(o_xy)); sd, dsd = self.snap(np.atleast_2d(d_xy))
        path = self.g.get_shortest_paths(int(so[0]), to=int(sd[0]), weights=w.tolist(), output="epath")[0]
        return path, float(w[path].sum() / 60), float(self.length[path].sum() / 1000), float(dso[0]), float(dsd[0])
