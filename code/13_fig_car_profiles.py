"""Figura de validacao: tempo de carro por hora para pares de teste (sentido de ponta)."""
import sys
from pathlib import Path
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, numpy as np
from pyproj import Transformer
sys.path.insert(0, str(Path(__file__).resolve().parent))
from carnet import SLOTS, CarNet
net=CarNet(); tr=Transformer.from_crs(4326,3763,always_xy=True)
xy=lambda lat,lon: np.array(tr.transform(lon,lat))
pairs={"Seixal > Baixa-Chiado":((38.6400,-9.1020),(38.7105,-9.1394)),
       "Baixa-Chiado > Seixal":((38.7105,-9.1394),(38.6400,-9.1020)),
       "Almada > Saldanha":((38.6670,-9.1685),(38.7340,-9.1450)),
       "Saldanha > Almada":((38.7340,-9.1450),(38.6670,-9.1685)),
       "Cascais > Sete Rios":((38.6979,-9.4215),(38.7421,-9.1672))}
fig,ax=plt.subplots(figsize=(8,4.5))
for k,(o,d) in pairs.items():
    t=[net.route(xy(*o),xy(*d),s,"avg")[1] for s in SLOTS]
    ax.plot(range(6),t,marker="o",label=k)
ax.set_xticks(range(6)); ax.set_xticklabels(SLOTS); ax.set_ylabel("tempo de carro (min)")
ax.set_title("Prova de conceito: tempo de carro por hora (OSM + TomTom jan/2020)")
ax.axvline(2.5,color="grey",lw=.8,ls=":"); ax.grid(alpha=.3); ax.legend(fontsize=8,frameon=False)
fig.tight_layout(); fig.savefig("reports/fig_car_profiles.png",dpi=150)
