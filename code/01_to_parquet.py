"""Fase 0, passo 1: converte os dados TomTom (2026 e 2020) para Parquet.

Saidas em data/parquet:
  net2026.parquet, net2020.parquet   rede (GeoParquet, WGS84)
  speed2026_allday.parquet           estatisticas de julho 2026, 0-24h
  speed2020_long.parquet             estatisticas de janeiro 2020, 6 horas (coluna `slot`)
"""
import re
import sys
from pathlib import Path

import geopandas as gpd
import pandas as pd
import pyogrio

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "parquet"
OUT.mkdir(parents=True, exist_ok=True)

SRC26 = ROOT / "jobs_10194945_results_Speed_Profiles_-_AML.shapefile"
SRC20 = Path("/Users/andresoareslopes/Documents/90_Arquivo/gulbenkian_resumo/dados/tomtom_1_copia")


def read_net(path: Path) -> gpd.GeoDataFrame:
    g = pyogrio.read_dataframe(path, encoding="utf-8")
    g = g.rename(columns={"Segment Id": "segment_id", "NewSegId": "new_seg_id",
                          "Length": "length_m", "FRC": "frc",
                          "SpeedLimit": "speed_limit", "StreetName": "street"})
    g["Id"] = g["Id"].astype("int64")
    g["frc"] = g["frc"].astype("int8")
    return g.rename(columns={"Id": "id"})


def read_side(path: Path) -> pd.DataFrame:
    d = pyogrio.read_dataframe(path, read_geometry=False)
    # prefixos BS_ (2026) e CS2_ (2020): tudo antes do primeiro "_"
    d.columns = [c.split("_", 1)[1] if "_" in c else c for c in d.columns]
    d = d.rename(columns={"Id": "id", "NHits": "hits", "Hits": "hits"})
    d.columns = [c.lower() if c != "id" else c for c in d.columns]
    d["id"] = d["id"].astype("int64")
    return d


def main() -> None:
    print("rede 2026 ...", flush=True)
    n26 = read_net(SRC26 / "network.shp")
    n26.to_parquet(OUT / "net2026.parquet")
    print(" ", len(n26), "segmentos")

    print("rede 2020 ...", flush=True)
    n20 = read_net(SRC20 / "network.shp")
    n20.to_parquet(OUT / "net2020.parquet")
    print(" ", len(n20), "segmentos")

    print("velocidades 2026 ...", flush=True)
    s26 = read_side(SRC26 / "1 de julho_0_0_00-24_00_0.dbf")
    s26.to_parquet(OUT / "speed2026_allday.parquet")
    print(" ", len(s26), "linhas com dados")

    print("velocidades 2020 ...", flush=True)
    parts = []
    for f in sorted(SRC20.glob("Jan2020_0_*_*.dbf")):
        m = re.match(r"Jan2020_0_(\d+)_00-(\d+)_00_\d+\.dbf", f.name)
        slot = f"{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        d = read_side(f)
        d["slot"] = slot
        parts.append(d)
        print(" ", f.name, slot, len(d), flush=True)
    s20 = pd.concat(parts, ignore_index=True)
    s20.to_parquet(OUT / "speed2020_long.parquet")
    print("total 2020:", len(s20))


if __name__ == "__main__":
    sys.exit(main())
