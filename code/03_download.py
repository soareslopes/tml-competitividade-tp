"""Fase 0, passo 3: descarrega camadas do geoportal TML (OGC API) e o GTFS da Carris Metropolitana.

Saidas em data/raw/geoportal/*.geojson e data/raw/gtfs/cm_gtfs.zip
"""
import json
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://geoportal.tmlmobilidade.pt/ogc-api/collections"
GTFS_URL = "https://api.carrismetropolitana.pt/v2/gtfs"
COLLECTIONS = [
    "informacao_base_grelha_hexag",
    "informacao_base_limite_concelho_aml",
    "informacao_base_limites_freguesia_aml",
    "gtfs_stops",
    "gtfs_shapes",
]
PAGE = 2000


def fetch_collection(cid: str, out: Path) -> None:
    feats, start, matched = [], 0, None
    while True:
        r = requests.get(f"{BASE}/{cid}/items", params={"f": "json", "limit": PAGE, "offset": start}, timeout=180)
        r.raise_for_status()
        d = r.json()
        matched = d.get("numberMatched", matched)
        got = d.get("features", [])
        feats += got
        start += len(got)
        print(f"  {cid}: {len(feats)}/{matched}", flush=True)
        if not got or (matched is not None and len(feats) >= matched):
            break
        time.sleep(0.3)
    out.write_text(json.dumps({"type": "FeatureCollection", "features": feats}))


def main() -> None:
    gdir = ROOT / "data" / "raw" / "geoportal"
    gdir.mkdir(parents=True, exist_ok=True)
    for cid in COLLECTIONS:
        out = gdir / f"{cid}.geojson"
        if out.exists():
            print("ja existe:", out.name)
            continue
        fetch_collection(cid, out)

    ddir = ROOT / "data" / "raw" / "gtfs"
    ddir.mkdir(parents=True, exist_ok=True)
    z = ddir / "cm_gtfs.zip"
    if not z.exists():
        print("GTFS ...", flush=True)
        with requests.get(GTFS_URL, stream=True, timeout=600) as r:
            r.raise_for_status()
            with open(z, "wb") as f:
                for chunk in r.iter_content(1 << 20):
                    f.write(chunk)
    print("GTFS:", z.stat().st_size / 1e6, "MB")


if __name__ == "__main__":
    sys.exit(main())
