"""Fase 0, passo 4: inspecao do GTFS e das camadas do geoportal."""
import zipfile
from pathlib import Path

import duckdb
import geopandas as gpd

ROOT = Path(__file__).resolve().parent.parent
Z = ROOT / "data" / "raw" / "gtfs" / "cm_gtfs.zip"
X = ROOT / "data" / "raw" / "gtfs" / "cm"
G = ROOT / "data" / "raw" / "geoportal"

if not X.exists():
    X.mkdir(parents=True)
    with zipfile.ZipFile(Z) as zf:
        zf.extractall(X)

print("ficheiros GTFS:")
for f in sorted(X.iterdir()):
    print(f"  {f.name:25s} {f.stat().st_size/1e6:8.2f} MB")

con = duckdb.connect()
def t(name):
    return f"read_csv_auto('{X}/{name}.txt', all_varchar=false, sample_size=-1)"
def show(title, sql):
    print(f"\n=== {title}")
    print(con.execute(sql).df().to_string(index=False))

for name in ["feed_info", "agency"]:
    if (X / f"{name}.txt").exists():
        show(name, f"select * from {t(name)} limit 5")
show("calendar_dates: intervalo e n", f"select min(date) dmin, max(date) dmax, count(*) n from {t('calendar_dates')}")
if (X / "calendar.txt").exists():
    show("calendar", f"select min(start_date) smin, max(end_date) emax, count(*) n from {t('calendar')}")
show("contagens", f"select (select count(*) from {t('routes')}) routes, (select count(*) from {t('trips')}) trips, "
     f"(select count(*) from {t('stops')}) stops, (select count(*) from {t('stop_times')}) stop_times")
show("colunas stop_times", f"select * from {t('stop_times')} limit 3")
show("colunas trips", f"select * from {t('trips')} limit 3")
show("colunas routes", f"select * from {t('routes')} limit 5")
show("route_type", f"select route_type, count(*) n from {t('routes')} group by 1")
show("viagens por dia (primeiros 10 dias com servico)",
     f"select date, count(distinct service_id) services from {t('calendar_dates')} where exception_type=1 group by 1 order by 1 limit 10")

print("\n=== camadas do geoportal")
for f in sorted(G.glob("*.geojson")):
    g = gpd.read_file(f)
    print(f"\n{f.name}: {len(g)} feicoes, crs={g.crs}, geom={g.geom_type.unique()}")
    print("  colunas:", [c for c in g.columns if c != "geometry"][:14])
    if "hexag" in f.name:
        print("  zona unica:", g["zona"].nunique(), "| exemplo:", g[["hexag", "zona"]].head(3).values.tolist())
    if "concelho" in f.name or "freguesia" in f.name:
        print(g.drop(columns="geometry").head(3).to_string(index=False))
