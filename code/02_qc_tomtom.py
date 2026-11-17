"""Fase 0, passo 2: controlo de qualidade dos dados TomTom.

Testes:
  A. Direcao dos percentis (P5 < P95 ou o contrario?)
  B. Coerencia interna (MedSp vs P50sp, AvgTt vs Length/HvgSp)
  C. Cobertura por FRC (2026 e 2020)
  D. Perfil horario de 2020 por FRC
  E. Ligacao 2020-2026 por Segment Id e comparacao de velocidades
"""
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
P = ROOT / "data" / "parquet"
con = duckdb.connect()
con.execute(f"create view n26 as select * exclude geometry from '{P}/net2026.parquet'")
con.execute(f"create view n20 as select * exclude geometry from '{P}/net2020.parquet'")
con.execute(f"create view s26 as select * from '{P}/speed2026_allday.parquet'")
con.execute(f"create view s20 as select * from '{P}/speed2020_long.parquet'")


def show(title, sql):
    print(f"\n=== {title}")
    print(con.execute(sql).df().to_string(index=False))


show("A. Percentis: fracao de linhas com P5 < P95 (2026)",
     "select round(avg((p5sp < p95sp)::int),4) p5_menor_p95, round(avg((p5sp > p95sp)::int),4) p5_maior_p95, "
     "round(avg((p5sp = p95sp)::int),4) iguais, count(*) n from s26")
show("A. Percentis: fracao de linhas com P5 < P95 (2020)",
     "select round(avg((p5sp < p95sp)::int),4) p5_menor_p95, round(avg((p5sp > p95sp)::int),4) p5_maior_p95, "
     "round(avg((p5sp = p95sp)::int),4) iguais, count(*) n from s20")
show("A. Medias dos percentis (2026) e de MedSp, AvgSp",
     "select round(avg(p5sp),1) p5, round(avg(p25sp),1) p25, round(avg(p50sp),1) p50, round(avg(p75sp),1) p75, "
     "round(avg(p95sp),1) p95, round(avg(medsp),1) medsp, round(avg(avgsp),1) avgsp from s26")
show("A. Medias dos percentis (2020)",
     "select round(avg(p5sp),1) p5, round(avg(p25sp),1) p25, round(avg(p50sp),1) p50, round(avg(p75sp),1) p75, "
     "round(avg(p95sp),1) p95, round(avg(medsp),1) medsp, round(avg(avgsp),1) avgsp from s20")

show("B. Coerencia: |MedSp - P50sp| mediana e AvgTt vs Length/HvgSp (2026)",
     "select round(median(abs(s.medsp - s.p50sp)),2) med_abs_medsp_p50, "
     "round(median(s.avgtt / (n.length_m / (s.hvgsp/3.6))),3) razao_avgtt_len_hvgsp, "
     "round(median(s.avgtt / (n.length_m / (s.avgsp/3.6))),3) razao_avgtt_len_avgsp "
     "from s26 s join n26 n using(id) where s.hvgsp > 0 and s.avgsp > 0")

show("C. Cobertura por FRC (2026)",
     "select n.frc, count(*) segmentos, round(sum(n.length_m)/1000) km, "
     "count(s.id) com_dados, round(100*count(s.id)/count(*),1) pct_seg, "
     "round(100*sum(case when s.id is not null then n.length_m end)/sum(n.length_m),1) pct_km, "
     "round(median(s.hits)) hits_med "
     "from n26 n left join s26 s using(id) group by 1 order by 1")
show("C. Cobertura por FRC e hora (2020, % de km da rede 2020 com dados)",
     "select n.frc, count(*) segmentos, round(sum(n.length_m)/1000) km, "
     + ", ".join(f"round(100*sum(n.length_m) filter (where n.id in (select id from s20 where slot='{t}'))/sum(n.length_m),0) \"{t}\"" for t in ["07-08","08-09","09-10","17-18","18-19","19-20"]) +
     " from n20 n group by 1 order by 1")

show("D. Perfil horario 2020: velocidade media ponderada por comprimento, por FRC",
     "select n.frc, "
     + ", ".join(f"round(sum(case when s.slot='{t}' then s.avgsp*n.length_m end)/sum(case when s.slot='{t}' then n.length_m end),1) \"{t}\"" for t in ["07-08","08-09","09-10","17-18","18-19","19-20"]) +
     " from s20 s join n20 n using(id) group by 1 order by 1")
show("D. Perfil horario 2020: toda a rede",
     "select s.slot, round(sum(s.avgsp*n.length_m)/sum(n.length_m),1) vel_media_pond, "
     "round(sum(n.length_m)/1000) km_com_dados, round(median(s.hits)) hits_med "
     "from s20 s join n20 n using(id) group by 1 order by 1")

con.execute("create view link as select a.segment_id, a.id id26, b.id id20, a.frc, a.length_m, a.street from n26 a join n20 b using(segment_id)")
show("E. Ligacao 2020-2026",
     "select count(*) segmentos_comuns, round(sum(length_m)/1000) km_comuns from link")
show("E. Velocidade 2026 (julho, 24h) vs 2020 (ponta 08-09 e 17-18), segmentos comuns, por FRC",
     "select l.frc, count(*) n, round(avg(a.medsp),1) v26_24h, round(avg(b.medsp),1) v20_0809, round(avg(c.medsp),1) v20_1718 "
     "from link l join s26 a on a.id=l.id26 join s20 b on b.id=l.id20 and b.slot='08-09' "
     "join s20 c on c.id=l.id20 and c.slot='17-18' group by 1 order by 1")
show("E. Correlacao entre MedSp 2026 e MedSp 2020 (08-09), segmentos comuns",
     "select round(corr(a.medsp,b.medsp),3) corr, count(*) n "
     "from link l join s26 a on a.id=l.id26 join s20 b on b.id=l.id20 and b.slot='08-09'")
show("E. Segmentos de 2026 sem correspondente em 2020, por FRC (km)",
     "select n.frc, count(*) seg, round(sum(n.length_m)/1000) km from n26 n "
     "where n.segment_id not in (select segment_id from n20) group by 1 order by 1")
