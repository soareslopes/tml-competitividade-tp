"""Inspecao dos GTFS de 2024 (Mapoteca): validade temporal, tamanhos, sobreposicao."""
from pathlib import Path
import duckdb
ROOT = Path(__file__).resolve().parent.parent
X = ROOT/"data/raw/gtfs2024"
con = duckdb.connect()
def rd(d,f): return f"read_csv_auto('{X/d/f}.txt', sample_size=-1)"
def q(sql): return con.execute(sql).df().to_string(index=False)
for d in ["cm_2024_03","carris_lisboa_2024_01","metro_lisboa_2024_01","fertagus_2024_01","cp_2024_01"]:
    print(f"\n######## {d}")
    p=X/d
    print("ficheiros:",sorted(f.name for f in p.glob("*.txt")))
    print(q(f"select * from {rd(d,'agency')}"))
    if (p/"feed_info.txt").exists(): print(q(f"select * from {rd(d,'feed_info')}"))
    if (p/"calendar.txt").exists(): print("calendar:\n",q(f"select min(start_date) s, max(end_date) e, count(*) n from {rd(d,'calendar')}"))
    if (p/"calendar_dates.txt").exists(): print("calendar_dates:\n",q(f"select min(date) s, max(date) e, count(*) n from {rd(d,'calendar_dates')}"))
    if (p/"trips.txt").exists():
        print(q(f"select (select count(*) from {rd(d,'routes')}) routes,(select count(*) from {rd(d,'trips')}) trips,(select count(*) from {rd(d,'stops')}) stops,(select count(*) from {rd(d,'stop_times')}) stop_times"))
        print(q(f"select route_type,count(*) n from {rd(d,'routes')} group by 1"))
        print("shapes em trips:",q(f"select count(shape_id) com_shape, count(*) n from {rd(d,'trips')}") if True else "")
    if (p/"stop_times.txt").exists() and not (p/"trips.txt").exists():
        print("stop_times:",q(f"select count(*) n from {rd(d,'stop_times')}"))
print("\n--- CM: dates/periods")
print(q(f"select * from {rd('cm_2024_03','periods')}"))
print(q(f"select min(date) s,max(date) e,count(*) n, count(distinct date) nd from {rd('cm_2024_03','dates')}") if (X/'cm_2024_03/dates.txt').exists() else "")
print(q(f"select * from {rd('cm_2024_03','dates')} limit 3"))
print(q(f"select * from {rd('cm_2024_03','stop_times')} limit 3"))
print(q(f"select * from {rd('cm_2024_03','trips')} limit 2"))
