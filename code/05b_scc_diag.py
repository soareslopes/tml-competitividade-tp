"""Diagnostico: porque o maior SCC so tem 66% dos nos? Quais ligacoes cruzam os dois grandes SCC?"""
from pathlib import Path
import geopandas as gpd, igraph as ig, numpy as np, pandas as pd
ROOT = Path(__file__).resolve().parent.parent
net = gpd.read_parquet(ROOT/"data/parquet/net2026.parquet")
def ends(g):
    c=g.coords; return c[0],c[-1]
e=net.geometry.apply(ends); A=np.array([x[0] for x in e]); B=np.array([x[1] for x in e])
key=lambda xy:(np.round(xy[:,0]*1e6)).astype("int64")*10_000_000_000+(np.round(xy[:,1]*1e6)).astype("int64")
nodes,inv=np.unique(np.concatenate([key(A),key(B)]),return_inverse=True)
u,v=inv[:len(net)],inv[len(net):]
g=ig.Graph(n=len(nodes),edges=list(zip(u.tolist(),v.tolist())),directed=True)
scc=g.connected_components(mode="strong"); mem=np.array(scc.membership)
order=np.argsort(scc.sizes())[::-1]; c1,c2=int(order[0]),int(order[1])
coords=np.zeros((len(nodes),2)); coords[u]=A; coords[v]=B
for c in (c1,c2):
    m=mem==c; print(f"SCC {c}: {m.sum()} nos, lon medio {coords[m,0].mean():.3f}, lat medio {coords[m,1].mean():.3f}, lat min {coords[m,1].min():.3f} max {coords[m,1].max():.3f}")
net["u_c"]=mem[u]; net["v_c"]=mem[v]
x12=net[(net.u_c==c1)&(net.v_c==c2)]; x21=net[(net.u_c==c2)&(net.v_c==c1)]
print("arestas c1->c2:",len(x12)," c2->c1:",len(x21))
cols=["street","frc","length_m"]
print("c1->c2:\n",x12[cols].head(15).to_string()); print("c2->c1:\n",x21[cols].head(15).to_string())
# outros SCCs pequenos: quantos nos e km ficam fora do maior
small=(mem!=c1)&(mem!=c2); print("nos fora dos 2 maiores SCC:",small.sum())
out=net[(net.u_c.isin([c1,c2])==False)|(net.v_c.isin([c1,c2])==False)]
print("arestas tocando SCCs pequenos:",len(out),"km:",round(out.length_m.sum()/1000))

print("\n--- arestas dos SCC pequenos, por rua (top 25 por km)")
o=out.copy(); o["km"]=o.length_m/1000
print(o.groupby("street",dropna=False).agg(n=("km","size"),km=("km","sum"),frc=("frc","min")).sort_values("km",ascending=False).head(25).round(2).to_string())
br=net[net.street.fillna("").str.contains("Ponte|A2$|A12$|Vasco|25 de Abril|Tejo",regex=True)]
print("\n--- ruas com Ponte/A2/A12 e seus SCC (u_c,v_c) contagem")
print(br.groupby(["street","u_c","v_c"]).size().sort_values(ascending=False).head(25).to_string())
