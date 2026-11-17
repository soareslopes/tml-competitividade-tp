"""Fase 2, passo 4b: tempo de carro parada a parada para cada troço (3 cenarios x 6 horas) e metricas.

Entrada : data/processed/seg_tp.parquet
Saida   : data/processed/seg_tp_car.parquet  (uma linha por troço x hora, com ratio e diferenca)
"""
import multiprocessing as mp
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from carnet import SLOTS, CarNet

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data/processed"
SCEN = ["avg", "cong", "free"]

net = None
SO = SD = None


def work(args):
    slot, sc = args
    g = net.g
    if slot == "LEN":  # comprimento do caminho (cenario medio, 08-09), para controlo de desvio
        wl = net.weights("08-09", "avg").tolist()
        res = np.full(len(SO), np.nan)
        for i, (a, b) in enumerate(zip(SO, SD)):
            if a == b:
                res[i] = 0.0
                continue
            path = g.get_shortest_path(int(a), int(b), weights=wl, output="epath")
            res[i] = net.length[path].sum() if path else np.nan
        return slot, sc, res
    w = net.weights(slot, sc).tolist()
    res = np.empty(len(SO))
    for i, (a, b) in enumerate(zip(SO, SD)):
        res[i] = g.distances(source=int(a), target=int(b), weights=w, mode="out")[0][0]
    return slot, sc, res


def main() -> None:
    global net, SO, SD
    t0 = time.time()
    seg = pd.read_parquet(OUT / "seg_tp.parquet")
    net = CarNet()
    pairs = seg[["feed", "stop_from", "stop_to", "x_from", "y_from", "x_to", "y_to"]].drop_duplicates(["feed", "stop_from", "stop_to"]).reset_index(drop=True)
    so, dso = net.snap(pairs[["x_from", "y_from"]].to_numpy())
    sd, dsd = net.snap(pairs[["x_to", "y_to"]].to_numpy())
    pairs["snap_from_m"], pairs["snap_to_m"] = dso, dsd
    SO, SD = so, sd
    print(f"pares: {len(pairs)} | snap mediano {np.median(np.r_[dso, dsd]):.0f} m, p95 {np.quantile(np.r_[dso, dsd], .95):.0f} m | {time.time()-t0:.0f}s", flush=True)

    # teste de velocidade
    tt = time.time(); w = net.weights("08-09", "avg").tolist()
    for a, b in list(zip(SO, SD))[:100]:
        net.g.distances(source=int(a), target=int(b), weights=w, mode="out")
    print(f"100 caminhos em {time.time()-tt:.2f}s -> estimativa total {(time.time()-tt)/100*len(SO)*18/6:.0f}s com 6 processos", flush=True)

    jobs = [("LEN", "avg")] + [(s, sc) for s in SLOTS for sc in SCEN]
    ctx = mp.get_context("fork")
    with ctx.Pool(6) as pool:
        results = pool.map(work, jobs)
    for slot, sc, res in results:
        if slot == "LEN":
            pairs["path_len_m"] = res
        else:
            pairs[f"car_{sc}_{slot}"] = res
    print(f"caminhos calculados | {time.time()-t0:.0f}s", flush=True)

    long = []
    for slot in SLOTS:
        p = pairs[["feed", "stop_from", "stop_to", "snap_from_m", "snap_to_m", "path_len_m"]].copy()
        p["slot"] = slot
        for sc in SCEN:
            p[f"car_{sc}_s"] = pairs[f"car_{sc}_{slot}"]
        long.append(p)
    car = pd.concat(long, ignore_index=True)
    out = seg.merge(car, on=["feed", "stop_from", "stop_to", "slot"], how="left")
    out["detour"] = out.path_len_m / out.chord_m
    # estimativa de carro fiavel: sem desvios absurdos, sem snap longe, sem troço colado ao mesmo no
    out["car_ok"] = (out.detour.between(0.6, 2.2)) & (out.snap_from_m < 150) & (out.snap_to_m < 150) & (out.chord_m >= 400) & (out.car_avg_s >= 60)
    out["ratio"] = out.tp_s / out.car_avg_s
    out["diff_s"] = out.tp_s - out.car_avg_s
    out["ratio_cong"] = out.tp_s / out.car_cong_s   # carro congestionado (TP mais competitivo)
    out["ratio_free"] = out.tp_s / out.car_free_s   # carro fluido
    out["speed_tp_kmh"] = out.chord_m / out.tp_s * 3.6
    out["speed_car_kmh"] = out.chord_m / out.car_avg_s * 3.6
    out.to_parquet(OUT / "seg_tp_car.parquet")
    o = out.replace([np.inf, -np.inf], np.nan).dropna(subset=["ratio"])
    print(f"linhas: {len(out)} | com ratio: {len(o)} | car_ok: {int(out.car_ok.sum())} ({out.car_ok.mean():.1%})")
    o = o[o.car_ok]
    print("ratio por feed (mediana, p10, p90):")
    print(o.groupby("feed").ratio.quantile([.1, .5, .9]).unstack().round(2).to_string())
    print("ratio por hora (mediana):")
    print(o.groupby("slot").ratio.median().round(2).to_string())
    print(f"total {time.time()-t0:.0f}s")


if __name__ == "__main__":
    sys.exit(main())
