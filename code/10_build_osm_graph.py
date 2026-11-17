"""Fase 1, passo 1: extrai a rede viaria rodoviaria da AML do OSM e constroi arestas dirigidas.

Entrada : data/raw/osm/portugal-261116.osm.pbf
Saidas  : data/processed/osm_edges.parquet  (GeoParquet, EPSG:3763, uma linha por aresta dirigida)
          data/processed/osm_nodes.parquet  (node_idx, osm_id, x, y em EPSG:3763, lon, lat)
"""
import re
import sys
import time
from pathlib import Path

import geopandas as gpd
import numpy as np
import osmium
import pandas as pd
from pyproj import Transformer
from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parent.parent
PBF = ROOT / "data/raw/osm/portugal-261116.osm.pbf"
OUT = ROOT / "data/processed"
OUT.mkdir(parents=True, exist_ok=True)

BBOX = (-9.55, 38.35, -8.40, 39.15)  # lon_min, lat_min, lon_max, lat_max (cobre a AML com folga)

DRIVABLE = {
    "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link",
    "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified",
    "residential", "living_street", "road", "service",
}
SKIP_SERVICE = {"parking_aisle", "driveway", "emergency_access", "drive-through"}
# velocidade de fluxo livre por defeito quando nao ha maxspeed (km/h)
DEFAULT_KMH = {
    "motorway": 120, "motorway_link": 60, "trunk": 100, "trunk_link": 60, "primary": 80,
    "primary_link": 50, "secondary": 60, "secondary_link": 40, "tertiary": 50,
    "tertiary_link": 40, "unclassified": 40, "residential": 30, "living_street": 20,
    "road": 30, "service": 20,
}
HIGHWAY_RANK = {h: i for i, h in enumerate(
    ["motorway", "trunk", "primary", "secondary", "tertiary", "unclassified", "residential",
     "living_street", "road", "service"])}


def parse_maxspeed(v: str | None) -> float:
    if not v:
        return np.nan
    m = re.match(r"^\s*(\d+)\s*(km/h|kmh)?\s*$", v)
    if m:
        return float(m.group(1))
    return {"PT:urban": 50.0, "PT:rural": 90.0, "PT:motorway": 120.0}.get(v, np.nan)


def main() -> None:
    t0 = time.time()
    ways = []  # (way_id, highway, name, ref, maxspeed, oneway_code, tunnel, bridge, [(ref, lon, lat), ...])
    fp = osmium.FileProcessor(PBF).with_locations().with_filter(osmium.filter.KeyFilter("highway"))
    n_seen = 0
    for o in fp:
        if not o.is_way():
            continue
        n_seen += 1
        tags = o.tags
        hw = tags.get("highway")
        if hw not in DRIVABLE:
            continue
        if hw == "service" and tags.get("service") in SKIP_SERVICE:
            continue
        if tags.get("area") == "yes":
            continue
        if tags.get("motor_vehicle") in ("no", "private") or tags.get("access") in ("no", "private"):
            if tags.get("motor_vehicle") not in ("yes", "designated", "destination"):
                continue
        pts = []
        for nd in o.nodes:
            loc = nd.location
            if loc.valid():
                pts.append((nd.ref, loc.lon, loc.lat))
        if len(pts) < 2:
            continue
        lons = [p[1] for p in pts]; lats = [p[2] for p in pts]
        if max(lons) < BBOX[0] or min(lons) > BBOX[2] or max(lats) < BBOX[1] or min(lats) > BBOX[3]:
            continue
        ow = tags.get("oneway")
        if ow in ("yes", "1", "true"):
            oc = 1
        elif ow in ("-1", "reverse"):
            oc = -1
        elif tags.get("junction") in ("roundabout", "circular"):
            oc = 1
        elif hw in ("motorway", "motorway_link") and ow != "no":
            oc = 1
        else:
            oc = 0
        ways.append((o.id, hw, tags.get("name"), tags.get("ref"), parse_maxspeed(tags.get("maxspeed")), oc,
                     tags.get("tunnel") in ("yes", "building_passage"), tags.get("bridge") == "yes", pts))
    print(f"ways lidas com highway: {n_seen} | rodoviarias na bbox: {len(ways)} | {time.time()-t0:.0f}s", flush=True)

    # nos de juncao: aparecem em >=2 ways (ou 2 vezes na mesma) ou sao extremos
    from collections import Counter
    cnt = Counter()
    for w in ways:
        for r, _, _ in w[8]:
            cnt[r] += 1
        cnt[w[8][0][0]] += 1; cnt[w[8][-1][0]] += 1
    junction = {r for r, c in cnt.items() if c >= 2}

    # transformar todas as coordenadas de uma vez
    refs = {}
    for w in ways:
        for r, lon, lat in w[8]:
            refs[r] = (lon, lat)
    ref_list = list(refs.keys())
    ll = np.array([refs[r] for r in ref_list])
    tr = Transformer.from_crs(4326, 3763, always_xy=True)
    xs, ys = tr.transform(ll[:, 0], ll[:, 1])
    xy = {r: (x, y) for r, x, y in zip(ref_list, xs, ys)}

    rows = []
    for (wid, hw, name, ref, ms, oc, tun, brg, pts) in ways:
        seg_start = 0
        for i in range(1, len(pts)):
            if pts[i][0] in junction or i == len(pts) - 1:
                seg = pts[seg_start:i + 1]
                seg_start = i
                if len(seg) < 2 or seg[0][0] == seg[-1][0] and len(seg) == 2:
                    continue
                coords = [xy[r] for r, _, _ in seg]
                geom = LineString(coords)
                if geom.length < 0.5:
                    continue
                u, v = seg[0][0], seg[-1][0]
                base = dict(way_id=wid, highway=hw, name=name, ref=ref, maxspeed=ms, tunnel=tun, bridge=brg)
                if oc in (0, 1):
                    rows.append({**base, "u_osm": u, "v_osm": v, "oneway": oc == 1, "geometry": geom})
                if oc in (0, -1):
                    rows.append({**base, "u_osm": v, "v_osm": u, "oneway": oc == -1, "geometry": LineString(coords[::-1])})
    edges = gpd.GeoDataFrame(rows, crs=3763)
    print(f"arestas dirigidas: {len(edges)} | {time.time()-t0:.0f}s", flush=True)

    # indices de no contiguos
    all_nodes = pd.unique(np.concatenate([edges.u_osm.to_numpy(), edges.v_osm.to_numpy()]))
    nidx = {r: i for i, r in enumerate(all_nodes)}
    edges["u"] = edges.u_osm.map(nidx).astype("int32")
    edges["v"] = edges.v_osm.map(nidx).astype("int32")
    edges["length_m"] = edges.geometry.length
    edges["ff_kmh"] = edges.maxspeed.fillna(edges.highway.map(DEFAULT_KMH)).astype("float32")
    edges["hw_rank"] = edges.highway.str.replace("_link", "", regex=False).map(HIGHWAY_RANK).astype("int8")
    edges.insert(0, "edge_id", np.arange(len(edges), dtype="int32"))
    edges.drop(columns=["u_osm", "v_osm"]).to_parquet(OUT / "osm_edges.parquet")

    nodes = pd.DataFrame({"node_idx": np.arange(len(all_nodes), dtype="int32"), "osm_id": all_nodes})
    nodes["x"] = [xy[r][0] for r in all_nodes]; nodes["y"] = [xy[r][1] for r in all_nodes]
    nodes["lon"] = [refs[r][0] for r in all_nodes]; nodes["lat"] = [refs[r][1] for r in all_nodes]
    nodes.to_parquet(OUT / "osm_nodes.parquet")
    print(f"nos: {len(nodes)} | km dirigidos: {edges.length_m.sum()/1000:.0f} | total {time.time()-t0:.0f}s")
    print(edges.groupby("highway").agg(n=("edge_id", "size"), km=("length_m", lambda x: round(x.sum() / 1000))).sort_values("km", ascending=False).to_string())


if __name__ == "__main__":
    sys.exit(main())
