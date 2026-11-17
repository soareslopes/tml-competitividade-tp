"""Fase 2, passo 4a: troços de linha e tempos de TP programados (GTFS 2024, dia 2024-01-17).

Para cada padrao de viagem (route, direcao, sequencia de paragens) corta-se em troços de >= 1 km
(distancia em linha reta acumulada entre paragens) e calcula-se, por hora de ponta, o tempo programado
mediano do troco e o numero de viagens por hora (frequencia).

Saida: data/processed/seg_tp.parquet
"""
import sys
import time
from pathlib import Path

import zlib

import duckdb
import geopandas as gpd
import numpy as np
import pandas as pd
from pyproj import Transformer
from shapely.geometry import LineString

ROOT = Path(__file__).resolve().parent.parent
X = ROOT / "data/processed/gtfs_clean"
OUT = ROOT / "data/processed"
DAY = "20240515"
DOW = "wednesday"
MIN_SEG_M = 1000.0
SLOT_OF_HOUR = {7: "07-08", 8: "08-09", 9: "09-10", 17: "17-18", 18: "18-19", 19: "19-20"}
FEEDS = {"cm": "cm_2024_03", "carris": "carris_lisboa_2024_01", "metro": "metro_lisboa_2024_01", "fertagus": "fertagus_2024_01"}
tr = Transformer.from_crs(4326, 3763, always_xy=True)
con = duckdb.connect()


def rd(d, f):
    return f"read_csv_auto('{X / d / (f + '.txt')}', sample_size=-1, all_varchar=true)"


def secs(col):
    return f"(split_part({col},':',1)::int*3600 + split_part({col},':',2)::int*60 + split_part({col},':',3)::int)"


def load_feed(key: str, d: str) -> pd.DataFrame:
    p = X / d
    cal = f"select service_id from {rd(d,'calendar')} where {DOW}='1' and start_date<='{DAY}' and end_date>='{DAY}'" if (p / "calendar.txt").exists() else "select null::varchar service_id where false"
    cd_exists = (p / "calendar_dates.txt").exists()
    cd = f"select service_id, exception_type from {rd(d,'calendar_dates')} where date='{DAY}'" if cd_exists else "select null::varchar service_id, null::varchar exception_type where false"
    q = f"""
    with base as ({cal}), cd as ({cd}),
    active as (select service_id from base where service_id not in (select service_id from cd where exception_type='2')
               union select service_id from cd where exception_type='1'),
    tr as (select t.trip_id, t.route_id, coalesce(t.direction_id,'0') direction_id, t.shape_id from {rd(d,'trips')} t join active a using(service_id))
    select tr.trip_id, tr.route_id, tr.direction_id, tr.shape_id, st.stop_id, st.stop_sequence::int seq,
           {secs('st.arrival_time')} arr, {secs('st.departure_time')} dep
    from {rd(d,'stop_times')} st join tr using(trip_id)
    where st.arrival_time is not null and st.arrival_time <> ''
    order by tr.trip_id, seq"""
    df = con.execute(q).df()
    df["feed"] = key
    # frequencias (Metro): expandir viagens
    if (p / "frequencies.txt").exists():
        fq = con.execute(f"select trip_id, {secs('start_time')} s, {secs('end_time')} e, headway_secs::int h from {rd(d,'frequencies')}").df()
        if len(fq):
            parts = []
            base_first = df.groupby("trip_id").arr.transform("min")
            df["arr0"] = df.arr - base_first; df["dep0"] = df.dep - base_first
            for r in fq.itertuples():
                g = df[df.trip_id == r.trip_id]
                if g.empty:
                    continue
                for k, t0 in enumerate(range(r.s, r.e, r.h)):
                    gg = g.copy()
                    gg["trip_id"] = f"{r.trip_id}#f{r.s}_{k}"
                    gg["arr"] = gg.arr0 + t0; gg["dep"] = gg.dep0 + t0
                    parts.append(gg)
            # viagens sem frequencias mantem-se
            df = pd.concat([df[~df.trip_id.isin(fq.trip_id)]] + parts, ignore_index=True)
            df = df.drop(columns=["arr0", "dep0"], errors="ignore")
    return df


def load_shapes(feed_key: str, d: str, ids: set) -> dict:
    """Devolve {shape_id: LineString em EPSG:3763} para os shape_ids pedidos."""
    if not ids or not (X / d / "shapes.txt").exists():
        return {}
    df = con.execute(f"""select shape_id, shape_pt_lat::double lat, shape_pt_lon::double lon, shape_pt_sequence::int sq
                         from {rd(d,'shapes')} where shape_id in (select unnest(?::varchar[])) order by shape_id, sq""", [list(ids)]).df()
    out = {}
    for sid, g in df.groupby("shape_id", sort=False):
        x, y = tr.transform(g.lon.to_numpy(), g.lat.to_numpy())
        if len(g) >= 2:
            out[sid] = LineString(list(zip(x, y)))
    return out


def main() -> None:
    t0 = time.time()
    frames, stops = [], []
    for k, d in FEEDS.items():
        df = load_feed(k, d)
        print(f"{k}: {df.trip_id.nunique()} viagens ativas, {len(df)} stop_times | {time.time()-t0:.0f}s", flush=True)
        frames.append(df)
        s = con.execute(f"select stop_id, stop_lat::double lat, stop_lon::double lon from {rd(d,'stops')}").df()
        s["feed"] = k
        stops.append(s)
    st = pd.concat(frames, ignore_index=True)
    sp = pd.concat(stops, ignore_index=True)
    x, y = tr.transform(sp.lon.to_numpy(), sp.lat.to_numpy())
    sp["x"], sp["y"] = x, y
    st = st.merge(sp[["feed", "stop_id", "x", "y"]], on=["feed", "stop_id"], how="left")
    st = st.dropna(subset=["x"]).sort_values(["feed", "trip_id", "seq"]).reset_index(drop=True)

    # padrao = (feed, route, direcao, sequencia de paragens)
    seqkey = st.groupby(["feed", "trip_id"]).stop_id.transform(lambda s: zlib.crc32("|".join(s).encode()))  # determinista
    st["pattern"] = st.feed + "|" + st.route_id + "|" + st.direction_id + "|" + seqkey.astype(str)
    print(f"padroes: {st.pattern.nunique()} | {time.time()-t0:.0f}s", flush=True)

    # troços por padrao, a partir da primeira viagem de cada padrao
    first_trip = st.drop_duplicates("pattern")[["pattern", "trip_id"]]
    ref = st.merge(first_trip, on=["pattern", "trip_id"])
    seg_rows, seg_geoms = [], []
    for pat, g in ref.groupby("pattern", sort=False):
        xs, ys = g.x.to_numpy(), g.y.to_numpy()
        step = np.r_[0, np.hypot(np.diff(xs), np.diff(ys))]
        cum = np.cumsum(step)
        start_i, idx_breaks = 0, []
        for i in range(1, len(g)):
            if cum[i] - cum[start_i] >= MIN_SEG_M:
                idx_breaks.append((start_i, i)); start_i = i
        if start_i < len(g) - 1:
            if idx_breaks and cum[-1] - cum[start_i] < 0.5 * MIN_SEG_M:  # resto curto: funde com o ultimo
                a, _ = idx_breaks.pop(); idx_breaks.append((a, len(g) - 1))
            else:
                idx_breaks.append((start_i, len(g) - 1))
        for n, (a, b) in enumerate(idx_breaks):
            seg_rows.append((pat, n, a, b, g.stop_id.iloc[a], g.stop_id.iloc[b], float(cum[b] - cum[a])))
            seg_geoms.append(LineString(list(zip(xs[a:b + 1], ys[a:b + 1]))))
    seg = pd.DataFrame(seg_rows, columns=["pattern", "seg", "i_from", "i_to", "stop_from", "stop_to", "chord_m"])
    # geometria dos troços: fatia do shape entre as duas paragens (fallback: polilinha de paragens)
    from shapely.ops import substring
    pat_shape = first_trip.merge(st[["pattern", "trip_id", "shape_id", "feed"]].drop_duplicates(["pattern", "trip_id"]), on=["pattern", "trip_id"])
    shapes = {}
    for k, d in FEEDS.items():
        ids = set(pat_shape[pat_shape.feed == k].shape_id.dropna().unique())
        shapes[k] = load_shapes(k, d, ids)
        print(f"shapes {k}: {len(shapes[k])}/{len(ids)}", flush=True)
    sh_of = dict(zip(pat_shape.pattern, zip(pat_shape.feed, pat_shape.shape_id)))
    sp_xy = sp.set_index(["feed", "stop_id"])[["x", "y"]]
    from shapely.geometry import Point
    geoms, n_shape = [], 0
    for r, chord_geom in zip(seg.itertuples(), seg_geoms):
        fk, sid = sh_of.get(r.pattern, (None, None))
        line = shapes.get(fk, {}).get(sid)
        g = chord_geom
        if line is not None:
            pa = Point(*sp_xy.loc[(fk, r.stop_from)]); pb = Point(*sp_xy.loc[(fk, r.stop_to)])
            d1, d2 = line.project(pa), line.project(pb)
            if d2 > d1 and (d2 - d1) <= 4 * max(r.chord_m, 300):
                sub = substring(line, d1, d2)
                if sub.geom_type == "LineString" and sub.length > 0:
                    g = sub; n_shape += 1
        geoms.append(g)
    print(f"troços com geometria de shape: {n_shape}/{len(seg)}", flush=True)
    gpd.GeoDataFrame(seg[["pattern", "seg"]].copy(), geometry=geoms, crs=3763).to_parquet(OUT / "seg_geom.parquet")
    print(f"troços: {len(seg)} | {time.time()-t0:.0f}s", flush=True)

    # tempos por viagem em cada troço
    st["pos"] = st.groupby(["feed", "trip_id"]).cumcount()
    j = st[["pattern", "trip_id", "pos", "arr", "dep"]]
    a = seg.merge(j, left_on=["pattern", "i_from"], right_on=["pattern", "pos"])[["pattern", "seg", "trip_id", "dep"]].rename(columns={"dep": "t_start"})
    b = seg.merge(j, left_on=["pattern", "i_to"], right_on=["pattern", "pos"])[["pattern", "seg", "trip_id", "arr"]].rename(columns={"arr": "t_end"})
    tt = a.merge(b, on=["pattern", "seg", "trip_id"])
    tt["tp_s"] = tt.t_end - tt.t_start
    tt["hour"] = (tt.t_start // 3600).astype(int)
    tt = tt[tt.hour.isin(SLOT_OF_HOUR) & (tt.tp_s > 0)]
    tt["slot"] = tt.hour.map(SLOT_OF_HOUR)
    agg = tt.groupby(["pattern", "seg", "slot"]).agg(n_trips=("trip_id", "nunique"), tp_s=("tp_s", "median"),
                                                     tp_s_min=("tp_s", "min"), tp_s_max=("tp_s", "max")).reset_index()
    out = agg.merge(seg, on=["pattern", "seg"])
    out[["feed", "route_id", "direction_id", "pat_hash"]] = out.pattern.str.split("|", expand=True)
    # coordenadas das paragens para ligar ao grafo
    sp_i = sp.set_index(["feed", "stop_id"])
    for c in ("from", "to"):
        idx = pd.MultiIndex.from_arrays([out.feed, out[f"stop_{c}"]])
        out[f"x_{c}"] = sp_i.x.reindex(idx).to_numpy(); out[f"y_{c}"] = sp_i.y.reindex(idx).to_numpy()
    out.to_parquet(OUT / "seg_tp.parquet")
    pairs = out[["feed", "stop_from", "stop_to"]].drop_duplicates()
    print(f"linhas segmento x hora: {len(out)} | pares de paragens unicos: {len(pairs)}")
    print(out.groupby("feed").agg(rotas=("route_id", "nunique"), padroes=("pattern", "nunique"), segmentos=("seg", "size")).to_string())
    print("tp_s mediano:", out.tp_s.median(), "| chord_m mediana:", out.chord_m.median().round(0), "| viagens/hora mediana:", out.n_trips.median())


if __name__ == "__main__":
    sys.exit(main())
