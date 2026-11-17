"""Fase 2: quantas viagens de cada feed estao ativas no dia de referencia?"""
from pathlib import Path
import duckdb, sys
ROOT=Path(__file__).resolve().parent.parent; X=ROOT/"data/raw/gtfs2024"
day=sys.argv[1] if len(sys.argv)>1 else "20240117"
dow="wednesday"
con=duckdb.connect()
def rd(d,f): return f"read_csv_auto('{X/d/f}.txt', sample_size=-1, all_varchar=true)"
for d in ["cm_2024_03","carris_lisboa_2024_01","metro_lisboa_2024_01","fertagus_2024_01"]:
    p=X/d
    q=f"""
    with base as (
      select service_id from {rd(d,'calendar')}
      where {dow}='1' and start_date<='{day}' and end_date>='{day}'
    ) """ if (p/"calendar.txt").exists() else "with base as (select null::varchar service_id where false) "
    q+=f""", cd as (select service_id, exception_type from {rd(d,'calendar_dates')} where date='{day}')
    , active as (
      select service_id from base where service_id not in (select service_id from cd where exception_type='2')
      union select service_id from cd where exception_type='1'
    )
    select (select count(*) from active) services,
           (select count(*) from {rd(d,'trips')} t join active a using(service_id)) trips"""
    print(d, day, con.execute(q).fetchall())
