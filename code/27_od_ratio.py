"""Fase 2, passo 5: tempo de carro zona-zona (6 horas x 3 cenarios) e ratio/diferenca porta a porta.

Entrada : data/processed/zone_points.parquet, tp_matrix_{slot}.parquet, grafo de carro
Saida   : data/processed/od_ratio.parquet  (from_id, to_id, slot, car_*, tp_*, ratio, diff_min, dist_km)
"""
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from carnet import SLOTS, CarNet

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
SCEN = ["avg", "cong", "free"]

t0 = time.time()
zp = gpd.read_parquet(PR / "zone_points.parquet").sort_values("zona").reset_index(drop=True)
zones = pd.read_parquet(PR / "zones.parquet", columns=["zona", "municipio", "area_km2"])
ids = zp.zona.astype(int).to_numpy()
xy = zp[["x", "y"]].to_numpy()
net = CarNet()
n = len(ids)
fi, ti = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
base = pd.DataFrame({"from_id": ids[fi.ravel()], "to_id": ids[ti.ravel()]})
dist = np.hypot(xy[fi.ravel(), 0] - xy[ti.ravel(), 0], xy[fi.ravel(), 1] - xy[ti.ravel(), 1]) / 1000
base["dist_km"] = dist
_, snap_d = net.snap(xy)
print(f"zonas {n} | snap carro mediano {np.median(snap_d):.0f} m, max {snap_d.max():.0f} m", flush=True)

parts = []
for s in SLOTS:
    d = base.copy()
    d["slot"] = s
    for sc in SCEN:
        M = net.od_minutes(xy, xy, s, sc)
        d[f"car_{sc}_min"] = M.ravel()
    tp = pd.read_parquet(PR / f"tp_matrix_{s}.parquet").rename(
        columns={"travel_time_p25": "tp_p25", "travel_time_p50": "tp_p50", "travel_time_p75": "tp_p75"})
    d = d.merge(tp[["from_id", "to_id", "tp_p25", "tp_p50", "tp_p75"]], on=["from_id", "to_id"], how="left")
    parts.append(d)
    print(f"{s} | {time.time()-t0:.0f}s", flush=True)
od = pd.concat(parts, ignore_index=True)
od = od[od.from_id != od.to_id].copy()
od["ratio"] = od.tp_p50 / od.car_avg_min
od["diff_min"] = od.tp_p50 - od.car_avg_min
od["tp_reachable"] = od.tp_p50.notna()
od = od.merge(zones.rename(columns={"zona": "from_id", "municipio": "mun_from", "area_km2": "area_from"}), on="from_id", how="left")
od = od.merge(zones[["zona", "municipio"]].rename(columns={"zona": "to_id", "municipio": "mun_to"}), on="to_id", how="left")
od.to_parquet(PR / "od_ratio.parquet")

v = od[od.tp_reachable & (od.car_avg_min >= 5)]
print(f"\npares (origem != destino, por hora): {len(od)//len(SLOTS)} | TP alcancavel: {od.tp_reachable.mean():.1%}")
print("ratio TP/carro nos pares alcancaveis com carro >= 5 min, por hora (p10, mediana, p90):")
print(v.groupby("slot").ratio.quantile([.1, .5, .9]).unstack().round(2).to_string())
bins = [0, 1, 1.5, 2, 3, 4, 1e9]; lab = ["<1", "1-1.5", "1.5-2", "2-3", "3-4", ">4"]
print("distribuicao por classe (hora 08-09, % de pares alcancaveis):")
print(pd.cut(v[v.slot == "08-09"].ratio, bins, labels=lab, right=False).value_counts(normalize=True).reindex(lab).round(3).to_string())
print("diferenca mediana (min):", v.groupby("slot").diff_min.median().round(1).to_dict())
print(f"total {time.time()-t0:.0f}s")
