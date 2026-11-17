"""Fase 2, passo 2: zonas de analise (383 zonas TML, agregadas dos hexagonos) e ponto representativo.

Saidas: data/processed/zones.parquet  (zona, n_hex, area_km2, concelho, geometria 4326 dissolvida)
        data/processed/zone_points.parquet (zona, ponto representativo = hexagono mais proximo do centroide, 4326 e 3763)
        data/processed/hex.parquet (hexag, zona, geometria)
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
G = ROOT / "data/raw/geoportal"
OUT = ROOT / "data/processed"

hx = gpd.read_file(G / "informacao_base_grelha_hexag.geojson").to_crs(3763)[["hexag", "zona", "geometry"]]
hx["zona"] = hx["zona"].astype(int)
conc = gpd.read_file(G / "informacao_base_limite_concelho_aml.geojson").to_crs(3763)[["municipio", "geometry"]]

hx["centroid"] = hx.geometry.centroid
cent = hx.set_geometry("centroid")[["hexag", "zona", "centroid"]]
cent = gpd.sjoin(cent, conc, how="left", predicate="within").drop(columns="index_right")
hx["municipio"] = cent["municipio"].to_numpy()
hx.drop(columns="centroid").to_parquet(OUT / "hex.parquet")

zones = hx.dissolve(by="zona", aggfunc={"hexag": "size", "municipio": lambda s: s.mode().iloc[0] if s.notna().any() else None})
zones = zones.rename(columns={"hexag": "n_hex"}).reset_index()
zones["area_km2"] = zones.area / 1e6
zones.to_crs(4326).to_parquet(OUT / "zones.parquet")

# ponto representativo: centroide do hexagono mais proximo do centroide da zona (garante estar dentro da zona)
rows = []
hc = hx.copy(); hc["geometry"] = hc.geometry.centroid
for zid, g in hc.groupby("zona"):
    zc = zones.loc[zones.zona == zid, "geometry"].iloc[0].centroid
    d = g.geometry.distance(zc)
    r = g.loc[d.idxmin()]
    rows.append(dict(zona=zid, hexag=r.hexag, geometry=r.geometry))
zp = gpd.GeoDataFrame(rows, crs=3763)
zp["x"] = zp.geometry.x; zp["y"] = zp.geometry.y
zp.to_crs(4326).assign(lon=lambda d: d.geometry.x, lat=lambda d: d.geometry.y).to_parquet(OUT / "zone_points.parquet")
print(f"zonas: {len(zones)} | hexagonos: {len(hx)} | sem concelho: {int(hx.municipio.isna().sum())}")
print(zones.groupby("municipio").agg(zonas=("zona", "size"), area_km2=("area_km2", "sum")).round(0).sort_values("area_km2", ascending=False).to_string())
