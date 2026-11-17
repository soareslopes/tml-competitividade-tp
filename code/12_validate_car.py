"""Fase 1, passo 3: validacao do grafo de carro."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from pyproj import Transformer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from carnet import SLOTS, CarNet

net = CarNet()
print(f"nos {len(net.nodes)} | arestas {len(net.edges)} | maior SCC: {net.scc_share:.1%} dos nos")
tr = Transformer.from_crs(4326, 3763, always_xy=True)
def xy(lat, lon):
    return np.array(tr.transform(lon, lat))

tests = {
    "Praca do Comercio > Oriente": ((38.7076, -9.1365), (38.7678, -9.0993)),
    "Cascais > Sete Rios": ((38.6979, -9.4215), (38.7421, -9.1672)),
    "Almada (Cova da Piedade) > Saldanha": ((38.6670, -9.1685), (38.7340, -9.1450)),
    "Saldanha > Almada (Cova da Piedade)": ((38.7340, -9.1450), (38.6670, -9.1685)),
    "Sintra > Amadora": ((38.7973, -9.3881), (38.7536, -9.2302)),
    "Setubal > Entrecampos": ((38.5244, -8.8882), (38.7450, -9.1480)),
    "Entrecampos > Setubal": ((38.7450, -9.1480), (38.5244, -8.8882)),
    "Loures > Cais do Sodre": ((38.8310, -9.1680), (38.7060, -9.1440)),
    "Seixal > Baixa-Chiado": ((38.6400, -9.1020), (38.7105, -9.1394)),
    "Odivelas > Campo Grande": ((38.7926, -9.1823), (38.7600, -9.1575)),
}
rows = []
for name, (o, d) in tests.items():
    for slot in SLOTS:
        path, t, km, so, sd = net.route(xy(*o), xy(*d), slot, "avg")
        rows.append(dict(par=name, slot=slot, min=round(t, 1), km=round(km, 1), snap_o=round(so), snap_d=round(sd)))
df = pd.DataFrame(rows)
piv = df.pivot(index="par", columns="slot", values="min").reindex(list(tests))
print("\nTempo de carro (min), cenario medio, por hora:")
print(piv.to_string())
print("\nKm e snap (m):")
print(df[df.slot == "08-09"][["par", "km", "snap_o", "snap_d"]].to_string(index=False))

print("\nCenarios (08-09): fluido / medio / congestionado (min)")
rows = []
for name, (o, d) in tests.items():
    r = {"par": name}
    for sc in ("free", "avg", "cong"):
        _, t, _, _, _ = net.route(xy(*o), xy(*d), "08-09", sc)
        r[sc] = round(t, 1)
    rows.append(r)
print(pd.DataFrame(rows).to_string(index=False))

# matriz 118 freguesias: tempo e velocidade de arranque
import geopandas as gpd
fr = gpd.read_file(Path(__file__).resolve().parent.parent / "data/raw/geoportal/informacao_base_limites_freguesia_aml.geojson").to_crs(3763)
c = np.c_[fr.centroid.x, fr.centroid.y]
import time
t0 = time.time()
M = net.od_minutes(c, c, "08-09", "avg")
print(f"\nmatriz freguesias {M.shape} em {time.time()-t0:.1f}s | inf: {int(np.isinf(M).sum())} | mediana {np.median(M[np.isfinite(M) & (M>0)]):.0f} min | max {M[np.isfinite(M)].max():.0f} min")
