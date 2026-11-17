"""Fase 2, passo 3: matriz TP porta a porta entre zonas (r5py), por hora, dia de referencia 2024-05-15.

Uso: python 23_r5_matrix.py [slot ...]    (por defeito todas as 6 horas)
Saida: data/processed/tp_matrix_{slot}.parquet  (from_id, to_id, tt_p25, tt_p50, tt_p75, minutos)
"""
import datetime
import sys
import time
from pathlib import Path

sys.argv += ["--max-memory", "16G"]  # r5py le isto antes de iniciar a JVM

import geopandas as gpd
import pandas as pd
import r5py

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
GC = ROOT / "data/processed/gtfs_clean"
DAY = datetime.date(2024, 5, 15)
SLOTS = {"07-08": 7, "08-09": 8, "09-10": 9, "17-18": 17, "18-19": 18, "19-20": 19}

slots = [a for a in sys.argv[1:] if a in SLOTS] or list(SLOTS)
t0 = time.time()
tn = r5py.TransportNetwork(
    ROOT / "data/raw/osm/aml_highways.osm.pbf",
    [GC / "cm_2024_03.zip", GC / "carris_lisboa_2024_01.zip", GC / "metro_lisboa_2024_01.zip", GC / "fertagus_2024_01.zip"],
    allow_errors=True,  # R5 trata "sem calendar_dates" como erro benigno
)
print(f"rede de transporte construida em {time.time()-t0:.0f}s", flush=True)

zp = gpd.read_parquet(PR / "zone_points.parquet")
pts = zp[["zona", "geometry"]].rename(columns={"zona": "id"})
pts["id"] = pts["id"].astype(int)

for s in slots:
    t1 = time.time()
    dep = datetime.datetime.combine(DAY, datetime.time(SLOTS[s], 0))
    ttm = r5py.TravelTimeMatrix(
        tn,
        origins=pts,
        destinations=pts,
        departure=dep,
        departure_time_window=datetime.timedelta(hours=1),
        percentiles=[25, 50, 75],
        transport_modes=[r5py.TransportMode.TRANSIT, r5py.TransportMode.WALK],
        max_time=datetime.timedelta(minutes=180),
        max_time_walking=datetime.timedelta(minutes=25),
        snap_to_network=True,
    )
    ttm.to_parquet(PR / f"tp_matrix_{s}.parquet")
    ok = ttm["travel_time_p50"].notna().mean()
    print(f"{s}: {len(ttm)} pares, {ok:.1%} alcancaveis, mediana {ttm['travel_time_p50'].median():.0f} min | {time.time()-t1:.0f}s", flush=True)
print(f"total {time.time()-t0:.0f}s")
