"""Fase 1, passo 2: associa a cada aresta OSM um segmento TomTom 2020 (mesmo sentido, proximo)
e constroi velocidades por aresta e por hora.

Saida: data/processed/edge_speeds.parquet
  edge_id, tt_id, n_votes, mean_dist_m, e para cada hora s em SLOTS:
    v_avg_s, v_p15_s, v_p85_s (km/h), src_s (0 = TomTom direto, 1 = escalado de outras horas, 2 = fator de classe)
"""
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely import STRtree

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data/parquet"
PR = ROOT / "data/processed"
SLOTS = ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"]
SEARCH_M = 25.0
MAX_ANGLE = 50.0


def bearing(lines, pos, delta=3.0):
    L = shapely.length(lines)
    a = shapely.line_interpolate_point(lines, np.clip(pos - delta, 0, L))
    b = shapely.line_interpolate_point(lines, np.clip(pos + delta, 0, L))
    dx = shapely.get_x(b) - shapely.get_x(a)
    dy = shapely.get_y(b) - shapely.get_y(a)
    return np.degrees(np.arctan2(dx, dy)) % 360


def main() -> None:
    t0 = time.time()
    edges = gpd.read_parquet(PR / "osm_edges.parquet")
    tt = gpd.read_parquet(P / "net2020.parquet").to_crs(3763)
    tt = tt.reset_index(drop=True)
    print(f"OSM arestas {len(edges)} | TomTom segmentos {len(tt)}", flush=True)

    # pontos de amostra: 25/50/75% (so 50% para arestas curtas)
    geoms = edges.geometry.values
    L = shapely.length(geoms)
    ei, fr = [], []
    for f in (0.25, 0.5, 0.75):
        mask = (L > 40) if f != 0.5 else np.ones(len(L), bool)
        idx = np.where(mask)[0]
        ei.append(idx); fr.append(np.full(len(idx), f))
    ei = np.concatenate(ei); fr = np.concatenate(fr)
    pos_o = fr * L[ei]
    pts = shapely.line_interpolate_point(geoms[ei], pos_o)
    b_osm = bearing(geoms[ei], pos_o)
    print(f"pontos de amostra: {len(pts)}", flush=True)

    tree = STRtree(tt.geometry.values)
    pi, gi = tree.query(pts, predicate="dwithin", distance=SEARCH_M)
    print(f"pares ponto-segmento candidatos: {len(pi)} | {time.time()-t0:.0f}s", flush=True)

    tg = tt.geometry.values[gi]
    d = shapely.distance(pts[pi], tg)
    pos_t = shapely.line_locate_point(tg, pts[pi])
    b_tt = bearing(tg, pos_t)
    dang = np.abs((b_osm[pi] - b_tt + 180) % 360 - 180)
    ok = dang < MAX_ANGLE
    cand = pd.DataFrame({"edge_id": edges.edge_id.values[ei[pi[ok]]], "tt_row": gi[ok], "d": d[ok]})
    # prefer, por ponto, o segmento mais proximo: ficamos com 1 voto por ponto
    cand["pt"] = pi[ok]
    cand = cand.sort_values(["pt", "d"]).drop_duplicates("pt")
    agg = cand.groupby(["edge_id", "tt_row"]).agg(n_votes=("d", "size"), mean_dist_m=("d", "mean")).reset_index()
    agg = agg.sort_values(["edge_id", "n_votes", "mean_dist_m"], ascending=[True, False, True]).drop_duplicates("edge_id")
    agg["tt_id"] = tt["id"].values[agg.tt_row.values]
    agg["tt_len"] = tt["length_m"].values[agg.tt_row.values]
    print(f"arestas OSM com correspondencia TomTom: {len(agg)} ({len(agg)/len(edges):.1%}) | {time.time()-t0:.0f}s", flush=True)

    # velocidades TomTom por hora
    sp = pd.read_parquet(P / "speed2020_long.parquet")
    sp["v_avg"] = np.nan
    base = agg[["edge_id", "tt_id", "tt_len", "n_votes", "mean_dist_m"]].copy()
    out = edges[["edge_id", "highway", "length_m", "ff_kmh"]].merge(base, on="edge_id", how="left")
    for s in SLOTS:
        x = sp[sp.slot == s].set_index("id")
        v = (out.tt_len / x["avgtt"].reindex(out.tt_id).to_numpy() * 3.6)
        # AvgTt esta em segundos para o segmento inteiro; speed harmonica = length/time
        out[f"v_avg_{s}"] = v.clip(3, 130)
        out[f"v_p15_{s}"] = x["p15sp"].reindex(out.tt_id).to_numpy()
        out[f"v_p85_{s}"] = x["p85sp"].reindex(out.tt_id).to_numpy()
        out[f"src_{s}"] = np.where(out[f"v_avg_{s}"].notna(), 0, -1).astype("int8")
    # limpar zeros espurios nos percentis
    for s in SLOTS:
        for c in ("p15", "p85"):
            col = f"v_{c}_{s}"
            out[col] = out[col].where(out[col] > 0).clip(3, 130)

    # fatores de classe por hora: mediana de v_avg / ff_kmh nas arestas com dado TomTom
    grp = out.highway.str.replace("_link", "", regex=False)
    out["cls"] = grp
    fac = {}
    for s in SLOTS:
        r = (out[f"v_avg_{s}"] / out["ff_kmh"])
        fac[s] = r.groupby(out["cls"]).median()
    fac = pd.DataFrame(fac)
    fac.to_csv(ROOT / "reports/class_factors.csv")
    print("fatores por classe (mediana v_avg/ff):\n", fac.round(2).to_string(), flush=True)

    # preenchimento: 1 = escalar a partir de outras horas, 2 = fator de classe
    F = np.column_stack([out["cls"].map(fac[s]).to_numpy() for s in SLOTS])  # n x 6
    V = np.column_stack([out[f"v_avg_{s}"].to_numpy() for s in SLOTS])
    have = ~np.isnan(V)
    with np.errstate(invalid="ignore", divide="ignore"):
        scale = np.nanmean(np.where(have, V / np.where(F > 0, F, np.nan), np.nan), axis=1)  # implied free-flow-like level
    fill1 = scale[:, None] * F
    fill2 = out.ff_kmh.to_numpy()[:, None] * F
    fill2 = np.where(np.isnan(fill2), out.ff_kmh.to_numpy()[:, None] * 0.7, fill2)
    for j, s in enumerate(SLOTS):
        miss = ~have[:, j]
        use1 = miss & ~np.isnan(fill1[:, j])
        use2 = miss & ~use1
        V[:, j] = np.where(use1, fill1[:, j], np.where(use2, fill2[:, j], V[:, j]))
        out[f"src_{s}"] = np.where(use1, 1, np.where(use2, 2, 0)).astype("int8")
        out[f"v_avg_{s}"] = np.clip(V[:, j], 3, 130).astype("float32")
        # percentis em falta: aproximar a partir de v_avg (+-)
        out[f"v_p15_{s}"] = out[f"v_p15_{s}"].fillna(out[f"v_avg_{s}"] * 0.75).astype("float32")
        out[f"v_p85_{s}"] = out[f"v_p85_{s}"].fillna(out[f"v_avg_{s}"] * 1.25).astype("float32")

    keep = ["edge_id", "tt_id", "n_votes", "mean_dist_m"] + [f"{p}_{s}" for s in SLOTS for p in ("v_avg", "v_p15", "v_p85", "src")]
    out[keep].to_parquet(PR / "edge_speeds.parquet")

    # resumo
    tot = out.length_m.sum()
    print("\nfracao do comprimento OSM por origem da velocidade, hora 08-09:")
    print((out.groupby("src_08-09").length_m.sum() / tot).round(3).to_string())
    print("\nfracao por classe com correspondencia TomTom direta:")
    print(out.assign(m=out["src_08-09"] == 0).groupby("cls").apply(lambda g: round(g.loc[g.m, "length_m"].sum() / g.length_m.sum(), 3)).to_string())
    print(f"\nconcluido em {time.time()-t0:.0f}s")


if __name__ == "__main__":
    sys.exit(main())
