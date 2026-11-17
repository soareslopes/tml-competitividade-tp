"""Teste: fechar buracos de topologia por snap de nos 'sumidouro/fonte' a nos vizinhos dentro de R metros."""
from pathlib import Path
import geopandas as gpd, igraph as ig, numpy as np
from scipy.spatial import cKDTree
ROOT = Path(__file__).resolve().parent.parent
net = gpd.read_parquet(ROOT/"data/parquet/net2026.parquet")
c=net.geometry.apply(lambda g:(g.coords[0],g.coords[-1]))
A=np.array([x[0] for x in c]); B=np.array([x[1] for x in c])
key=lambda xy:(np.round(xy[:,0]*1e6)).astype("int64")*10_000_000_000+(np.round(xy[:,1]*1e6)).astype("int64")
nodes,inv=np.unique(np.concatenate([key(A),key(B)]),return_inverse=True)
u,v=inv[:len(net)].copy(),inv[len(net):].copy()
coords=np.zeros((len(nodes),2)); coords[u]=A; coords[v]=B
m=np.array([111000*np.cos(np.radians(38.7)),111000])
indeg=np.bincount(v,minlength=len(nodes)); outdeg=np.bincount(u,minlength=len(nodes))
def share(u,v,n):
    g=ig.Graph(n=n,edges=list(zip(u.tolist(),v.tolist())),directed=True)
    s=sorted(g.connected_components(mode="strong").sizes(),reverse=True); return s[0]/n, s[:3]
print("base:",share(u,v,len(nodes)))
bad=np.where((indeg==0)|(outdeg==0))[0]; print("nos fonte/sumidouro:",len(bad))
tree=cKDTree(coords*m)
for R in (2,5,10,25,50):
    uu,vv=u.copy(),v.copy(); parent=np.arange(len(nodes))
    d,j=tree.query(coords[bad]*m,k=6,distance_upper_bound=R)
    nm=0
    for b,dd,jj in zip(bad,d,j):
        for dist,k in zip(dd,jj):
            if np.isfinite(dist) and k!=b and (indeg[k]>0 and outdeg[k]>0 or True):
                parent[b]=k; nm+=1; break
    uu=parent[uu]; vv=parent[vv]
    print(f"R={R:3d} m: nos snapados {nm:5d} ->",share(uu,vv,len(nodes)))
