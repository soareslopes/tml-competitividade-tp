"""Fase 3: agregacoes por zona (perfil territorial) e por linha (perfil de competitividade).

Saidas: data/processed/zone_metrics.parquet, reports/zone_ranking.csv, data/processed/line_metrics.parquet
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
G = ROOT / "data/raw/geoportal"
SLOTS = ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"]
CLASSES = [0, 1, 1.5, 2, 3, 4, np.inf]
LABELS = ["<1", "1-1.5", "1.5-2", "2-3", "3-4", ">4"]
MIN_CAR = 5.0  # minutos: abaixo disto o ratio e instavel
CENSOR = 180.0  # limite do r5py


def wmedian(x, w):
    o = np.argsort(x)
    x, w = np.asarray(x)[o], np.asarray(w)[o]
    c = np.cumsum(w)
    return x[np.searchsorted(c, 0.5 * c[-1])]


# ---------------- populacao por zona (dasimetrica: freguesia -> hexagono pelo comprimento de vias residenciais) ----------------
zones = gpd.read_parquet(PR / "zones.parquet").to_crs(3763)
hx = gpd.read_parquet(PR / "hex.parquet")[["hexag", "zona", "geometry"]]
fr = gpd.read_file(G / "informacao_base_limites_freguesia_aml.geojson").to_crs(3763)[["dicofre", "freguesia", "municipio", "n_individu", "geometry"]]
edges = gpd.read_parquet(PR / "osm_edges.parquet", columns=["highway", "length_m", "geometry"])
res = edges[edges.highway.isin(["residential", "living_street", "unclassified", "tertiary", "service"])].copy()
res["geometry"] = shapely_mid = res.geometry.interpolate(0.5, normalized=True)
hx_len = gpd.sjoin(res, hx[["hexag", "geometry"]], how="inner", predicate="within").groupby("hexag").length_m.sum()
hxc = hx.copy(); hxc["geometry"] = hx.geometry.centroid
hxc = gpd.sjoin(hxc, fr[["dicofre", "n_individu", "geometry"]], how="left", predicate="within").drop(columns="index_right")
hxc["len"] = hxc.hexag.map(hx_len).fillna(0.0)
hxc["tot"] = hxc.groupby("dicofre").len.transform("sum")
nh = hxc.groupby("dicofre").hexag.transform("size")
hxc["pop"] = np.where(hxc.dicofre.isna(), 0.0, np.where(hxc.tot > 0, hxc.n_individu * hxc.len / hxc.tot.replace(0, np.nan), hxc.n_individu / nh))
zpop = hxc.groupby("zona")["pop"].sum().rename("pop")
zones = zones.merge(zpop, on="zona", how="left")
zones["pop"] = zones["pop"].fillna(0)
hxc[["hexag", "zona", "pop"]].to_parquet(PR / "hex_pop.parquet")
print(f"populacao apurada: {zones['pop'].sum():,.0f} de {fr.n_individu.sum():,.0f} (Censos 2021, freguesias da AML)")

# ---------------- metricas por zona de origem ----------------
od = pd.read_parquet(PR / "od_ratio.parquet")
od = od.merge(zones[["zona", "pop"]].rename(columns={"zona": "to_id", "pop": "pop_to"}), on="to_id", how="left")
od = od[od.car_avg_min >= MIN_CAR].copy()
od["tp_cens"] = od.tp_p50.fillna(CENSOR)
od["ratio_cens"] = od.tp_cens / od.car_avg_min

rows = []
for (s, z), g in od.groupby(["slot", "from_id"]):
    r = g[g.tp_reachable]
    w_all = g.pop_to.clip(lower=1)
    row = dict(slot=s, zona=z, n_dest=len(g),
               reach_pop=(g.tp_reachable * w_all).sum() / w_all.sum(), reach_n=g.tp_reachable.mean())
    if len(r):
        wr = r.pop_to.clip(lower=1)
        row.update(ratio_w=wmedian(r.ratio.values, wr.values), diff_w=wmedian(r.diff_min.values, wr.values),
                   tp_w=wmedian(r.tp_p50.values, wr.values), car_w=wmedian(r.car_avg_min.values, wr.values),
                   ratio_cens=wmedian(g.ratio_cens.values, w_all.values))
        shares = pd.cut(r.ratio, CLASSES, labels=LABELS, right=False).value_counts(normalize=True)
        for k in LABELS:
            row[f"sh_{k}"] = shares.get(k, 0.0)
    rows.append(row)
zm = pd.DataFrame(rows)
zm = zm.merge(zones[["zona", "municipio", "area_km2", "pop"]], on="zona", how="left")
zm.to_parquet(PR / "zone_metrics.parquet")

# resumo (media das 6 horas) + classificacao
z = zm.groupby("zona").agg(municipio=("municipio", "first"), pop=("pop", "first"), area_km2=("area_km2", "first"),
                           reach_pop=("reach_pop", "mean"), ratio_w=("ratio_w", "mean"), diff_w=("diff_w", "mean"),
                           ratio_cens=("ratio_cens", "mean"), tp_w=("tp_w", "mean"), car_w=("car_w", "mean"),
                           ratio_amp=("ratio_w", lambda s: s.max() - s.min())).reset_index()
z["dens"] = z["pop"] / z.area_km2
z["delta_pessoa_min"] = z["pop"] * z.diff_w           # pessoa-minutos de desvantagem por viagem tipica
pop_med = z.loc[z["pop"] > 0, "pop"].median()
big_ratio = z.loc[(z["pop"] >= pop_med) & z.ratio_w.notna(), "ratio_w"]
q33, q67 = big_ratio.quantile([1 / 3, 2 / 3])
print(f"limiares (zonas populosas): ratio p33 = {q33:.2f}, p67 = {q67:.2f}; populacao mediana por zona = {pop_med:,.0f}")
def cls(r):
    if r["pop"] < 100:
        return "sem populacao"
    if np.isnan(r.ratio_w):
        return "sem TP alcancavel"
    if r.reach_pop < 0.3:
        return "cobertura limitada"
    if r["pop"] >= pop_med:
        if r.ratio_w <= q33:
            return "oportunidade rapida (populosa)"
        if r.ratio_w >= q67:
            return "prioridade alta (populosa)"
        return "intermedia (populosa)"
    return "estrutural (pouca procura)"
z["grupo"] = z.apply(cls, axis=1)
z.to_parquet(PR / "zone_summary.parquet")
z.sort_values("delta_pessoa_min", ascending=False).to_csv(ROOT / "reports/zone_ranking.csv", index=False)

print("\nZonas por grupo (n, populacao):")
print(z.groupby("grupo").agg(n=("zona", "size"), pop=("pop", "sum")).round(0).to_string())
cols = ["zona", "municipio", "pop", "ratio_w", "diff_w", "reach_pop", "grupo"]
print("\nTop 12 zonas por pessoa-minutos de desvantagem:")
print(z.sort_values("delta_pessoa_min", ascending=False).head(12)[cols].round(2).to_string(index=False))
print("\nTop 10 oportunidades rapidas (populosas, ratio mais baixo):")
print(z[z.grupo.str.startswith("oportunidade")].nsmallest(10, "ratio_w")[cols].round(2).to_string(index=False))
print("\nPor concelho (media ponderada pela populacao da zona): ratio, alcancabilidade, pop")
mm = z[z["pop"] > 0].groupby("municipio").apply(lambda g: pd.Series(dict(
    ratio=np.average(g.ratio_w.fillna(g.ratio_w.median()), weights=g["pop"]),
    diff_min=np.average(g.diff_w.fillna(g.diff_w.median()), weights=g["pop"]),
    reach=np.average(g.reach_pop, weights=g["pop"]), pop=g["pop"].sum())), include_groups=False)
print(mm.sort_values("ratio").round(2).to_string())
mm.to_csv(ROOT / "reports/municipality_summary.csv")

# ---------------- linhas ----------------
lp = pd.read_parquet(PR / "line_profile.parquet")
lm = lp.groupby(["feed", "route_id", "route_name"]).agg(
    km=("km", "mean"), ratio=("ratio_w", "mean"), ratio_min=("ratio_w", "min"), ratio_max=("ratio_w", "max"),
    trips_h=("trips_h", "mean"), diff_min_per_km=("diff_min_per_km", "mean"), horas=("slot", "nunique")).reset_index()
lm = lm[lm.km >= 3]
lm["amp"] = lm.ratio_max - lm.ratio_min
lm["grupo"] = np.select(
    [(lm.ratio < 1.0) & (lm.trips_h >= 2), (lm.ratio < 1.0), (lm.ratio >= 1.8) & (lm.trips_h >= 3), (lm.ratio >= 1.8)],
    ["referencia (rapida e frequente)", "rapida, pouco frequente", "lenta e frequente (atencao)", "lenta"],
    default="intermedia")
lm.to_parquet(PR / "line_metrics.parquet")
b = lm[lm.feed.isin(["cm", "carris"])]
print("\nLinhas de autocarro por grupo:")
print(b.grupo.value_counts().to_string())
print("\nLinhas lentas e frequentes (maior ratio):")
print(b[b.grupo.str.startswith("lenta e")].nlargest(10, "ratio")[["feed", "route_name", "km", "ratio", "trips_h"]].round(2).to_string(index=False))
