"""Direcao das travessias do Tejo: pontes tem as duas direcoes na rede?"""
from pathlib import Path
import geopandas as gpd, igraph as ig, numpy as np
ROOT = Path(__file__).resolve().parent.parent
net = gpd.read_parquet(ROOT/"data/parquet/net2026.parquet")
c=net.geometry.apply(lambda g:(g.coords[0],g.coords[-1]))
A=np.array([x[0] for x in c]); B=np.array([x[1] for x in c])
net["lat0"]=A[:,1]; net["lat1"]=B[:,1]
key=lambda xy:(np.round(xy[:,0]*1e6)).astype("int64")*10_000_000_000+(np.round(xy[:,1]*1e6)).astype("int64")
nodes,inv=np.unique(np.concatenate([key(A),key(B)]),return_inverse=True)
u,v=inv[:len(net)],inv[len(net):]
g=ig.Graph(n=len(nodes),edges=list(zip(u.tolist(),v.tolist())),directed=True)
coords=np.zeros((len(nodes),2)); coords[u]=A; coords[v]=B
# sentidos em cada ponte (mojibake: procurar por substring simples)
for nm in ["Ponte Vasco da Gama","Ponte 25 de Abril"]:
    s=net[net.street.fillna("")==nm]
    ns=(s.lat1>s.lat0).sum(); sn=(s.lat1<s.lat0).sum()
    print(f"{nm}: {len(s)} segmentos | para norte {ns} | para sul {sn} | km {s.length_m.sum()/1000:.1f}")
# alcancabilidade Lisboa -> Almada e inverso
def nearest(lat,lon):
    return int(np.argmin((coords[:,1]-lat)**2+((coords[:,0]-lon)*0.78)**2))
lis=nearest(38.7223,-9.1393); alm=nearest(38.6790,-9.1569)
fwd=set(g.subcomponent(lis,mode="out")); bwd=set(g.subcomponent(alm,mode="out"))
print("de Lisboa alcanca Almada:",alm in fwd,"| de Almada alcanca Lisboa:",lis in bwd)
print("nos alcancaveis a partir de Lisboa:",len(fwd),"| a partir de Almada:",len(bwd))

R=np.array(sorted(bwd)); inR=np.zeros(len(nodes),bool); inR[R]=True
# arestas dentro de R a norte do Tejo na zona de Lisboa
net["u_in"]=inR[u]; net["v_in"]=inR[v]
sel=net[net.u_in & net.v_in & (net.lat0>38.70) & (net.lat0<38.80)]
nb=sel.copy(); nb["lon0"]=A[sel.index,0]
nb=nb[(nb.lon0>-9.25)&(nb.lon0<-9.0)]
print("\narestas de R na zona lat 38.70-38.80, lon -9.25..-9.0:",len(nb))
print(nb.groupby("street").agg(n=("frc","size"),km=("length_m",lambda x:x.sum()/1000)).sort_values("km",ascending=False).head(15).round(2).to_string())
# extremo norte da Ponte 25 de Abril (nos de R com maior lat entre arestas da ponte)
for nm in ["Ponte 25 de Abril","Ponte Vasco da Gama"]:
    s=net[(net.street==nm)]
    print(nm,"- arestas em R:",int((s.u_in&s.v_in).sum()),"de",len(s),"| lat max das arestas em R:",round(max(s[s.u_in].lat0.max(),0),4))

print("\n--- fim da cadeia norte na Ponte 25 de Abril")
s=net[(net.street=="Ponte 25 de Abril")&net.u_in&net.v_in].sort_values("lat1",ascending=False).head(1)
i=s.index[0]; endn=v[i]
print("aresta",i,"lat0->lat1",s.lat0.iloc[0],s.lat1.iloc[0],"frc",s.frc.iloc[0],"len",s.length_m.iloc[0])
out_e=np.where(u==endn)[0]; in_e=np.where(v==endn)[0]
print("no final:",coords[endn],"| arestas que saem:",len(out_e),"| entram:",len(in_e))
for e in out_e: print("  sai:",e,net.street[e],net.frc[e],round(net.length_m[e],1),"-> no em R?",inR[v[e]])
for e in in_e: print("  entra:",e,net.street[e],net.frc[e],round(net.length_m[e],1))
# nos proximos (<30 m) ao no final
d=np.sqrt(((coords[:,0]-coords[endn,0])*0.78*111000)**2+((coords[:,1]-coords[endn,1])*111000)**2)
near=np.where((d<40)&(np.arange(len(nodes))!=endn))[0]
print("nos a menos de 40 m:",len(near))
for nn in near[:12]:
    print("  no",nn,round(d[nn],1),"m | in",int((v==nn).sum()),"out",int((u==nn).sum()),"| em R:",inR[nn],"| ruas:",set(net.street[np.where((u==nn)|(v==nn))[0]].fillna("-")))
