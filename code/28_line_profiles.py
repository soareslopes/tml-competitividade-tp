"""Fase 2, passo 6: perfil de competitividade por linha (agregacao dos troços, ponderada por distancia).

Filtro: car_ok (desvio do caminho de carro entre 0.6 e 2.2 vezes o troço, snap < 150 m, troço >= 400 m, carro >= 60 s).
Saida: data/processed/line_profile.parquet (feed, route_id, route_name, slot, km, ratio_w, diff_min_per_km, n_seg, trips_per_h)
       reports/line_ranking.csv
"""
from pathlib import Path

import duckdb
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
X = ROOT / "data/raw/gtfs2024"
FEEDS = {"cm": "cm_2024_03", "carris": "carris_lisboa_2024_01", "metro": "metro_lisboa_2024_01", "fertagus": "fertagus_2024_01"}

d = pd.read_parquet(PR / "seg_tp_car.parquet")
d = d.replace([np.inf, -np.inf], np.nan).dropna(subset=["ratio"])
n0 = len(d)
d = d[d.car_ok].copy()
print(f"linhas segmento x hora apos filtros: {len(d)} de {n0}")

con = duckdb.connect()
names = []
for k, f in FEEDS.items():
    r = con.execute(f"select route_id, coalesce(route_short_name, '') sn, coalesce(route_long_name, '') ln from read_csv_auto('{X/f/'routes.txt'}', sample_size=-1, all_varchar=true)").df()
    r["feed"] = k
    names.append(r)
names = pd.concat(names)
names["route_name"] = (names.sn + " " + names.ln).str.strip()

d["km"] = d.chord_m / 1000
d["tp_h"] = d.tp_s / 3600
d["car_h"] = d.car_avg_s / 3600
g = d.groupby(["feed", "route_id", "slot"]).agg(
    km=("km", "sum"), tp_h=("tp_h", "sum"), car_h=("car_h", "sum"), n_seg=("seg", "size"),
    trips_h=("n_trips", "median")).reset_index()
g["ratio_w"] = g.tp_h / g.car_h                          # razao agregada de tempos (ponderada por tempo de carro)
g["diff_min_per_km"] = (g.tp_h - g.car_h) * 60 / g.km
g = g.merge(names[["feed", "route_id", "route_name"]], on=["feed", "route_id"], how="left")
g.to_parquet(PR / "line_profile.parquet")

# ranking por linha (media das horas; so linhas com >= 3 km nas horas de ponta)
r = g.groupby(["feed", "route_id", "route_name"]).agg(
    km=("km", "mean"), ratio=("ratio_w", "mean"), ratio_min=("ratio_w", "min"), ratio_max=("ratio_w", "max"),
    diff_min_per_km=("diff_min_per_km", "mean"), trips_h=("trips_h", "mean"), horas=("slot", "nunique")).reset_index()
r = r[r.km >= 3]
r.sort_values("ratio").to_csv(ROOT / "reports/line_ranking.csv", index=False)
print(f"\nlinhas com >= 3 km: {len(r)} (por operador: {r.groupby('feed').size().to_dict()})")
print("\nMais competitivas (menor ratio), autocarros:")
print(r[r.feed.isin(["cm", "carris"])].nsmallest(8, "ratio")[["feed", "route_id", "route_name", "km", "ratio", "trips_h"]].round(2).to_string(index=False))
print("\nMenos competitivas (maior ratio):")
print(r[r.feed.isin(["cm", "carris"])].nlargest(8, "ratio")[["feed", "route_id", "route_name", "km", "ratio", "trips_h"]].round(2).to_string(index=False))
print("\nMetro e Fertagus:")
print(r[r.feed.isin(["metro", "fertagus"])][["feed", "route_name", "km", "ratio", "ratio_min", "ratio_max"]].round(2).to_string(index=False))
print("\nVariacao horaria do ratio por linha (max - min), quantis:", r.assign(v=r.ratio_max - r.ratio_min).v.quantile([.5, .9, .99]).round(2).tolist())
