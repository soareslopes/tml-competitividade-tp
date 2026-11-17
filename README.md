# TML: competitividade do transporte público face ao carro (AML)

Prova de conceito para a TML (Transportes Metropolitanos de Lisboa): para cada zona e para cada
linha, compara o tempo de viagem em transporte público (TP) com o de carro, pela **razão** TP / carro
e pela **diferença** TP menos carro (minutos).

Dados da prova de conceito: TomTom (janeiro de 2020), GTFS 2024 e OSM. Sem CP, TCB, fluvial,
Metro Sul e Mobi Cascais. Ver `reports/` para as limitações.

## Conteúdo

| Pasta ou ficheiro | O que é |
|---|---|
| `PLANO.md` | plano do projeto, escopo e fases |
| `code/` | pipeline numerado: `01-06` qualidade dos dados, `10-13` grafo do carro, `20-28` TP e razões, `30-32` agregações, figuras e mapas, `50` exportação do mapa web |
| `reports/` | relatórios por fase (`RELATORIO_FASE*.md`), tabelas CSV e figuras em `reports/figuras/` |
| `site/` | mapa interativo estático (ver `site/README.md`), pronto para GitHub Pages |

## Dados (não incluídos no repositório)

A pasta `data/` e os ficheiros TomTom (`jobs_*`) ficam fora do git por tamanho e licença.
Estrutura esperada: `data/raw/` (OSM, GTFS, geoportal TML, TomTom), `data/parquet/`, `data/processed/`.
Os scripts `code/NN_*.py` regeneram `parquet` e `processed` a partir de `raw`, por ordem numérica.

## Ambiente

Python 3.13 com pandas, geopandas, pyarrow, duckdb, igraph, scipy, shapely, pyogrio, osmium,
matplotlib e r5py (precisa de Java). Criar com `python3 -m venv .venv`.
