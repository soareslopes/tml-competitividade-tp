"""Fase 2: prepara os GTFS de 2024 para o r5py e para a analise de troços.

- remove tabelas so com cabecalho e ficheiros nao padrao
- DIA DE REFERENCIA: quarta-feira 2024-05-15. O feed da CM so tem servico na area 4 (Alcochete, Montijo,
  Moita, Palmela, Setubal) entre 2024-05-01 e 2024-06-30, mas o da Carris Lisboa so vale ate 2024-03-24.
  Para ter a AML completa, o calendario da Carris Lisboa e estendido ate 2024-06-30 (assuncao da prova de
  conceito: mesma oferta de dia util de inverno em maio).
Saidas: data/processed/gtfs_clean/<feed>.zip e data/processed/gtfs_clean/<feed>/ (ficheiros)
"""
import shutil
import zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
SRC=ROOT/"data/raw/gtfs2024"; DST=ROOT/"data/processed/gtfs_clean"; DST.mkdir(parents=True,exist_ok=True)
STD={"agency","stops","routes","trips","stop_times","calendar","calendar_dates","shapes","frequencies","feed_info","transfers"}
for d in ["cm_2024_03","carris_lisboa_2024_01","metro_lisboa_2024_01","fertagus_2024_01"]:
    out=DST/f"{d}.zip"; folder=DST/d
    if folder.exists(): shutil.rmtree(folder)
    folder.mkdir()
    kept=[]; dropped=[]
    with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
        for f in sorted((SRC/d).glob("*.txt")):
            if f.stem not in STD: dropped.append(f.name+"(nao padrao)"); continue
            with open(f,"rb") as fh:
                fh.readline(); has_rows=bool(fh.readline().strip())
            if not has_rows: dropped.append(f.name+"(vazio)"); continue
            if d.startswith("carris_lisboa") and f.name=="calendar.txt":
                txt=f.read_text().replace("20240324","20240630")
                (folder/f.name).write_text(txt); z.writestr(f.name,txt); kept.append(f.name+"(end_date estendido)")
            else:
                shutil.copy(f,folder/f.name); z.write(f,f.name); kept.append(f.name)
    print(d,"mantidos:",kept,"| removidos:",dropped)
