"""Teste de reparo: ligar cada no sumidouro (outdeg 0) ao no fonte (indeg 0) mais proximo, ate 150 m."""
from pathlib import Path
import geopandas as gpd, igraph as ig, numpy as np
from scipy.spatial import cKDTree
ROOT = Path(__file__).resolve().parent.parent
net = gpd.read_parquet(ROOT/"data/parquet/net2026.parquet")
c=net.geometry.apply(lambda g:(g.coords[0],g.coords[-1]))
A=np.array([x[0] for x in c]); B=np.array([x[1] for x in c])
key=lambda xy:(np.round(xy[:,0]*1e6)).astype("int64")*10_000_000_000+(np.round(xy[:,1]*1e6)).astype("int64")
nodes,inv=np.unique(np.concatenate([key(A),key(B)]),return_inverse=True)
u,v=inv[:len(net)],inv[len(net):]
coords=np.zeros((len(nodes),2)); coords[u]=A; coords[v]=B
m=np.array([111000*np.cos(np.radians(38.7)),111000])
indeg=np.bincount(v,minlength=len(nodes)); outdeg=np.bincount(u,minlength=len(nodes))
sinks=np.where(outdeg==0)[0]; srcs=np.where(indeg==0)[0]
print("sumidouros:",len(sinks),"fontes:",len(srcs))
def share(U,V):
    g=ig.Graph(n=len(nodes),edges=list(zip(U.tolist(),V.tolist())),directed=True)
    s=sorted(g.connected_components(mode="strong").sizes(),reverse=True); return round(s[0]/len(nodes),4),s[:4]
print("base:",share(u,v))
tree=cKDTree(coords[srcs]*m)
for R in (50,150,500):
    add=[]
    d,j=tree.query(coords[sinks]*m,distance_upper_bound=R)
    for sk,dd,jj in zip(sinks,d,j):
        if np.isfinite(dd): add.append((sk,srcs[jj],dd))
    U=np.concatenate([u,[a for a,_,_ in add]]); V=np.concatenate([v,[b for _,b,_ in add]])
    print(f"R={R}: {len(add)} pontes sumidouro->fonte ->",share(U,V))
# sumidouros sem fonte proxima: onde estao?
d,j=tree.query(coords[sinks]*m)
for sk,dd in zip(sinks,d):
    if dd>150:
        e=np.where(v==sk)[0]; print("  sumidouro isolado",coords[sk].round(4),"dist fonte mais proxima",round(dd),"m |",set(net.street[e].fillna("-")))
