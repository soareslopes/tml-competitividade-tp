"""Fase 2, passo 1: extrato OSM da AML (so ways com highway, para o r5py).

Entrada : data/raw/osm/portugal-261116.osm.pbf
Saida   : data/raw/osm/aml_highways.osm.pbf
"""
import sys
import time
from pathlib import Path

import osmium

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data/raw/osm/portugal-261116.osm.pbf"
DST = ROOT / "data/raw/osm/aml_highways.osm.pbf"
BBOX = (-9.60, 38.30, -8.35, 39.20)  # lon_min, lat_min, lon_max, lat_max


def main() -> None:
    t0 = time.time()
    if DST.exists():
        DST.unlink()
    # passo 1: ways com highway que tocam a bbox -> ids dos nos
    keep_nodes: set[int] = set()
    keep_ways: set[int] = set()
    fp = osmium.FileProcessor(SRC).with_locations().with_filter(osmium.filter.KeyFilter("highway"))
    for o in fp:
        if not o.is_way():
            continue
        inside = False
        for nd in o.nodes:
            loc = nd.location
            if loc.valid() and BBOX[0] <= loc.lon <= BBOX[2] and BBOX[1] <= loc.lat <= BBOX[3]:
                inside = True
                break
        if inside:
            keep_ways.add(o.id)
            keep_nodes.update(nd.ref for nd in o.nodes)
    print(f"ways: {len(keep_ways)} | nos: {len(keep_nodes)} | {time.time()-t0:.0f}s", flush=True)

    # passo 2: escrever nos e ways (ordem nos -> ways)
    with osmium.SimpleWriter(str(DST)) as w:
        for o in osmium.FileProcessor(SRC, osmium.osm.NODE):
            if o.id in keep_nodes:
                w.add_node(o)
        for o in osmium.FileProcessor(SRC, osmium.osm.WAY):
            if o.id in keep_ways:
                w.add_way(o)
    print(f"escrito {DST.name}: {DST.stat().st_size/1e6:.0f} MB | {time.time()-t0:.0f}s")


if __name__ == "__main__":
    sys.exit(main())
