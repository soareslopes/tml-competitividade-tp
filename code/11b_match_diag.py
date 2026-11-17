import geopandas as gpd, numpy as np, pandas as pd, shapely
from shapely import STRtree
ROOT="."
E=gpd.read_parquet("data/processed/osm_edges.parquet"); S=pd.read_parquet("data/processed/edge_speeds.parquet")
tt=gpd.read_parquet("data/parquet/net2020.parquet").to_crs(3763).reset_index(drop=True)
m=E.merge(S[["edge_id","tt_id","n_votes","mean_dist_m"]],on="edge_id")
mw=m[m.highway=="motorway"]
un=mw[mw.tt_id.isna()]
print("motorway edges:",len(mw),"sem match:",len(un),"| comprimento mediano sem match:",round(un.length_m.median()),"vs com match:",round(mw[mw.tt_id.notna()].length_m.median()))
tree=STRtree(tt.geometry.values)
mid=shapely.line_interpolate_point(un.geometry.values, 0.5*un.length_m.values)
j=tree.nearest(mid); d=shapely.distance(mid, tt.geometry.values[j])
print("distancia ao TomTom mais proximo (qualquer sentido): quantis",np.quantile(d,[.1,.5,.75,.9,.99]).round(1))
print("share com d<25 m:",(d<25).mean().round(3))
# nome / ref de exemplos
print(un[["name","ref","length_m"]].head(12).to_string())
# match global por classe (arestas)
m["has"]=m.tt_id.notna()
print(m.groupby("highway").has.mean().round(3).to_string())
# distribuicao distancias de match
print("mean_dist_m quantis (matched):",m.mean_dist_m.quantile([.5,.9,.99]).round(1).tolist())
