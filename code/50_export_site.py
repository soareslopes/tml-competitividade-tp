"""Exporta os dados do mapa interativo para site/data/*.js (carregaveis por <script>, funcionam em file:// e em GitHub Pages).

Saidas:
  site/data/zones.js  : poligonos das 383 zonas (WGS84, simplificados), concelhos, propriedades estaticas
  site/data/od.js     : matriz O-D 383x383 por hora (tempos de carro, factores dos cenarios, tempo de TP), Uint16/Uint8 em base64
  site/data/lines.js  : corredores (geometria), troços por linha (entradas) por hora, lista de linhas
"""
import base64
import json
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely

ROOT = Path(__file__).resolve().parent.parent
PR = ROOT / "data/processed"
OUT = ROOT / "site/data"
OUT.mkdir(parents=True, exist_ok=True)
SLOTS = ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"]


def b64(a, dt):
    return base64.b64encode(np.ascontiguousarray(a.astype(dt)).tobytes()).decode()


def to_wgs(gs, tol):
    g = gs.to_crs(3763).simplify(tol, preserve_topology=True).to_crs(4326)
    return shapely.set_precision(g.values, 1e-5)


def write_js(name, var, obj):
    p = OUT / name
    p.write_text(f"window.TML=window.TML||{{}};TML.{var}=" + json.dumps(obj, separators=(",", ":"), ensure_ascii=False) + ";\n", encoding="utf-8")
    print(f"{name}: {p.stat().st_size / 1e6:.2f} MB")


# ---------------------------------------------------------------- zonas
zones = gpd.read_parquet(PR / "zones.parquet").sort_values("zona").reset_index(drop=True)
zs = pd.read_parquet(PR / "zone_summary.parquet").set_index("zona")
assert list(zones.zona) == list(range(1, 384)), "ids de zona esperados 1..383"
zones["geometry"] = to_wgs(zones.set_geometry("geometry"), 25)
zones["municipio"] = zones.municipio.fillna("Sem concelho (água)")
cen = zones.geometry.representative_point()
GR = ["oportunidade rapida (populosa)", "intermedia (populosa)", "prioridade alta (populosa)", "estrutural (pouca procura)",
      "cobertura limitada", "sem TP alcancavel", "sem populacao"]
feats = []
for r, c in zip(zones.itertuples(), cen):
    s = zs.loc[r.zona]
    feats.append({"type": "Feature", "geometry": shapely.geometry.mapping(r.geometry),
                  "properties": {"z": int(r.zona), "m": r.municipio, "p": int(round(s["pop"])), "a": round(float(r.area_km2), 1),
                                 "g": GR.index(s.grupo), "c": [round(c.x, 5), round(c.y, 5)]}})
conc = gpd.read_file(ROOT / "data/raw/geoportal/informacao_base_limite_concelho_aml.geojson")
conc["geometry"] = to_wgs(conc, 60)
cf = [{"type": "Feature", "geometry": shapely.geometry.mapping(r.geometry), "properties": {"m": r.municipio}} for r in conc.itertuples()]
write_js("zones.js", "zones", {"type": "FeatureCollection", "features": feats, "groups": GR})
write_js("muns.js", "muns", {"type": "FeatureCollection", "features": cf})

# ---------------------------------------------------------------- matriz OD
od = pd.read_parquet(PR / "od_ratio.parquet")
Z = 383
od["i"] = od.from_id - 1
od["j"] = od.to_id - 1
od["ix"] = od.i * Z + od.j
pop = np.array([f["properties"]["p"] for f in feats])
slots_out = []
raw = 0
for s in SLOTS:
    d = od[od.slot == s]
    assert len(d) == Z * (Z - 1)
    car = np.zeros(Z * Z); tp = np.full(Z * Z, 65535.0); fc = np.zeros(Z * Z); ff = np.zeros(Z * Z)
    car[d.ix] = np.round(d.car_avg_min.values * 10)
    t = d.tp_p50.values
    tp[d.ix] = np.where(np.isnan(t), 65535, np.round(np.nan_to_num(t) * 10))
    fc[d.ix] = np.clip(np.round(d.car_cong_min.values / d.car_avg_min.values * 100), 0, 255)
    ff[d.ix] = np.clip(np.round(d.car_free_min.values / d.car_avg_min.values * 100), 0, 255)
    slots_out.append({"s": s, "car": b64(car, "<u2"), "tp": b64(tp, "<u2"), "fc": b64(fc, "u1"), "ff": b64(ff, "u1")})
    raw += Z * Z * 6
write_js("od.js", "od", {"n": Z, "slots": SLOTS, "data": slots_out})

# ---------------------------------------------------------------- linhas
seg = pd.read_parquet(PR / "seg_tp_car.parquet")
seg = seg[seg.car_ok & seg.ratio.notna()].copy()
geo = gpd.read_parquet(PR / "seg_geom.parquet")
lm = pd.read_parquet(PR / "line_metrics.parquet")
lp = pd.read_parquet(PR / "line_profile.parquet")
names = lp.drop_duplicates(["feed", "route_id"]).set_index(["feed", "route_id"]).route_name

seg["w"] = seg.n_trips
for c in ("tp_s", "car_avg_s", "car_cong_s", "car_free_s"):
    seg["w_" + c] = seg[c] * seg.w
key = ["feed", "route_id", "stop_from", "stop_to", "slot"]
e = seg.groupby(key).agg(trips=("w", "sum"), w_tp=("w_tp_s", "sum"), w_ca=("w_car_avg_s", "sum"), w_cc=("w_car_cong_s", "sum"),
                         w_cf=("w_car_free_s", "sum"), km=("chord_m", "mean"), pattern=("pattern", "first"), seg=("seg", "first")).reset_index()
for a, b in (("tp", "w_tp"), ("ca", "w_ca"), ("cc", "w_cc"), ("cf", "w_cf")):
    e[a] = e[b] / e.trips
ek = e.groupby(["feed", "route_id", "stop_from", "stop_to"]).agg(km=("km", "mean"), pattern=("pattern", "first"), seg=("seg", "first")).reset_index()
ek["eid"] = np.arange(len(ek))
# corredor = (feed, stop_from, stop_to); geometria a partir de (pattern, seg)
ek = ek.merge(geo, on=["pattern", "seg"], how="left")
ek["cid"] = ek.groupby(["feed", "stop_from", "stop_to"]).ngroup()
cor = ek.drop_duplicates("cid").sort_values("cid")
cor = cor[cor.geometry.notna()]
valid = set(cor.cid)
ek = ek[ek.cid.isin(valid)].reset_index(drop=True)
ek["eid"] = np.arange(len(ek))
cg = gpd.GeoDataFrame(cor[["cid"]], geometry=cor.geometry.values, crs=3763)
cg["geometry"] = to_wgs(cg, 6)
cmap = {c: i for i, c in enumerate(cg.cid)}
ek["ci"] = ek.cid.map(cmap)
routes = ek[["feed", "route_id"]].drop_duplicates().reset_index(drop=True)
routes["ri"] = np.arange(len(routes))
routes["name"] = [names.get((f, r), r) for f, r in zip(routes.feed, routes.route_id)]
rm = lm.set_index(["feed", "route_id"])
routes["grupo"] = [rm.grupo.get((f, r), "") for f, r in zip(routes.feed, routes.route_id)]
routes["km"] = [round(float(rm.km.get((f, r), np.nan)), 1) if (f, r) in rm.index else None for f, r in zip(routes.feed, routes.route_id)]
ek = ek.merge(routes[["feed", "route_id", "ri"]], on=["feed", "route_id"])
ek = ek.sort_values("eid").reset_index(drop=True)
ex = ek.set_index(["feed", "route_id", "stop_from", "stop_to"]).eid
e["eid"] = [ex.get(k, -1) for k in zip(e.feed, e.route_id, e.stop_from, e.stop_to)]
e = e[e.eid >= 0]
E = len(ek)
A = {k: np.zeros((6, E)) for k in ("trips", "tp", "ca", "cc", "cf")}
for si, s in enumerate(SLOTS):
    d = e[e.slot == s]
    for k in A:
        A[k][si, d.eid.values] = d[k].values
FEEDS = {"carris": "Carris (Lisboa)", "cm": "Carris Metropolitana", "metro": "Metro de Lisboa", "fertagus": "Fertagus"}
lines = {
    "slots": SLOTS, "E": E, "C": len(cg),
    "feeds": list(FEEDS), "feed_names": list(FEEDS.values()),
    "routes": [{"f": list(FEEDS).index(r.feed), "id": r.route_id, "n": r.name, "g": r.grupo, "km": r.km} for r in routes.itertuples()],
    "cor": [{"g": [[round(x, 5), round(y, 5)] for x, y in shapely.get_coordinates(g)]} for g in cg.geometry],
    "e_ci": b64(ek.ci.values, "<u2"), "e_ri": b64(ek.ri.values, "<u2"), "e_km": b64(np.round(ek.km.values / 10), "<u2"),
    "trips": b64(A["trips"], "u1"), "tp": b64(A["tp"], "<u2"), "ca": b64(A["ca"], "<u2"), "cc": b64(A["cc"], "<u2"), "cf": b64(A["cf"], "<u2"),
}
assert A["trips"].max() < 255 and A["tp"].max() < 65535 and A["cc"].max() < 65535, (A["trips"].max(), A["tp"].max(), A["cc"].max())
write_js("lines.js", "lines", lines)
print("entradas", E, "corredores", len(cg), "linhas", len(routes))
