# Relatório de qualidade de dados, Fase 0

2026-11-17. Scripts em `code/`, saídas brutas em `reports/qc_*.txt`.

## Resumo

| Tema | Veredito |
|---|---|
| TomTom 2026 (julho, 24h) | Cobertura excelente (100% dos km até FRC 6, 66% em FRC 7). Sem perfil horário. |
| TomTom 2020 (janeiro, 6 horas de ponta) | Boa cobertura até FRC 5; FRC 7 só 18-27% por hora. Perfil horário utilizável. |
| Ligação 2020-2026 | 83% dos segmentos de 2026 (84% dos km) existem em 2020 por `Segment Id`; correlação das velocidades 0.89. |
| Percentis | `Pxx` é "xx% das velocidades estão **abaixo**". O readme de 2021 está invertido. |
| Tempo de viagem | Usar `AvgTt` ou `MedTt`. `AvgTt = Length / HvgSp` exatamente. Não usar `Length / AvgSp` (subestima o tempo em 22%). |
| Rede TomTom como grafo de carro | **Não utilizável tal como está**: faltam troços nas travessias do Tejo. Recomendo plano B (OSM). |
| GTFS Carris Metropolitana | Utilizável (946 linhas, 307 mil viagens), mas é de novembro de 2026. |
| Camadas do geoportal | Hexágonos, freguesias (com população do Censos 2021) e concelhos, utilizáveis. |

## 1. TomTom 2026

- 414 984 segmentos, 31 350 km. 337 994 (81%) com estatísticas.
- Cobertura por classe funcional (FRC, % dos km com dados): 100% em FRC 0 a 5, 99.4% em FRC 6, **65.7% em FRC 7** (vias locais, 21 718 km, o maior bloco da rede). Nos 18.6% de arestas sem dado é preciso fallback (comprimento / limite de velocidade) ou excluí-las dos cálculos de carro local.
- A coluna `NHits` é normalizada (mediana abaixo de 0.5), não é uma contagem de amostras. Serve para comparar segmentos entre si, não para dar significância.
- Velocidades médias por segmento nos dados comuns: autoestradas cerca de 101 km/h, vias locais (FRC 7) cerca de 24 km/h.

## 2. TomTom 2020

- 385 187 segmentos, 31 239 km, terça a quinta de 7 a 30 de janeiro de 2020, seis horas: 07-08, 08-09, 09-10, 17-18, 18-19, 19-20.
- Cobertura (% dos km com dados): 100% em FRC 0, 2, 3; 87-95% em FRC 4; 92-96% em FRC 5; 72-85% em FRC 6; **18-27% em FRC 7**. A hora 07-08 tem sempre menos segmentos com dados (menos veículos sonda).
- **A rede de 2020 não tem FRC 1**. A classificação funcional mudou entre mapas (2026: 1 923 segmentos FRC 1; 2020: 0). As comparações por FRC entre anos têm de tratar isto.
- Perfil horário da rede inteira (velocidade média ponderada por comprimento, km/h):

| Hora | 07-08 | 08-09 | 09-10 | 17-18 | 18-19 | 19-20 |
|---|---|---|---|---|---|---|
| Toda a rede | 46.1 | 43.6 | 43.1 | 40.4 | **39.7** | 41.3 |
| FRC 0 (autoestrada) | 113.4 | 115.3 | 114.8 | 110.3 | 107.8 | 110.3 |
| FRC 4 | 51.2 | 50.3 | 50.1 | 47.2 | 46.2 | 48.4 |
| FRC 7 | 31.2 | 30.5 | 29.5 | 28.1 | 27.9 | 28.5 |

  Cuidado: como o conjunto de segmentos com dados muda de hora para hora (sobretudo 07-08), parte da variação da rede inteira é efeito de composição. Para fatores horários fiáveis comparar sempre nos mesmos segmentos, por FRC.
- A amplitude horária é modesta (cerca de 10% entre a melhor e a pior hora na rede inteira, 5% em autoestradas). Isto é relevante: o ratio TP/carro dependerá muito mais do traçado e da frequência do TP do que da hora do carro.

## 3. Ligação 2020 e 2026

- 344 553 `Segment Id` comuns (83% dos segmentos, 26 273 km, 84% da rede de 2026).
- Sem correspondente em 2020: 3 579 km de FRC 7, mais 563 km de FRC 4 e 473 km de FRC 6 (vias novas ou re-segmentadas).
- Correlação entre `MedSp` 2026 (24h, julho) e `MedSp` 2020 (08-09): **0.885** (n = 181 503).
- Médias nos segmentos comuns, `MedSp` (km/h): FRC 7 passa de 25.7 (2020, 08-09) para 24.4 (2026, 24h). Atenção: 2026 é média das 24h de todos os dias (inclui a noite, mais fluida), 2020 é hora de ponta de dias úteis. Uma velocidade 2026 à par da de 2020 já apontaria para mais congestionamento em 2026, mas não é uma comparação como-com-como e não deve ir para o pitch sem os novos time sets.

## 4. Definição dos percentis

Em ambos os anos P5 < P95 em 100% das linhas com dados (as restantes têm P5 = P95 por arredondamento a inteiros). Média de P5 = 15.3 km/h e de P95 = 44.8 km/h em 2026. Logo `Pxx` é a velocidade abaixo da qual estão xx% das medições. O readme de 2021 diz o contrário, mas é erro de texto.

Para os cenários de carro:
- **Fluido**: P85 a P95 de velocidade.
- **Típico**: `MedSp`.
- **Congestionado**: P5 a P25 de velocidade.

Os percentis estão em inteiros, o que dá empates em segmentos curtos e lentos.

## 5. Rede TomTom como grafo de roteamento

- 200 636 nós, 414 984 arestas dirigidas. 81% das arestas têm aresta inversa (ruas de dois sentidos aparecem como duas arestas; há sentido único real nos restantes).
- 99.9% dos nós formam uma só componente fraca, mas **a maior componente fortemente conexa tem só 66% dos nós** (a segunda tem 34%): o grafo parte-se em duas metades, **norte e sul do Tejo**, sem nenhuma aresta direta entre elas.
- Diagnóstico: de Lisboa chega-se a Almada, **de Almada não se chega a Lisboa**. A Ponte 25 de Abril tem 19 segmentos para norte e 8 para sul; a cadeia para norte termina num nó sumidouro a cerca de 1 km do fim (38.681 N), sem qualquer fonte próxima. Faltam segmentos da ponte em sentido norte. A Ponte Vasco da Gama tem 72 segmentos para norte e 67 para sul, mas também aparece em componentes pequenos. Há 19 nós sumidouro e 19 nós fonte em toda a rede (também A1, A8/Autoestrada do Oeste e Marateca-Santarém).
- Reparar por proximidade não resolve (testado de 2 a 500 m): os troços em falta não são pequenos desvios de coordenadas.
- Rotas de teste dentro da mesma margem dão tempos plausíveis (Praça do Comércio a Oriente, 17 min, 9.1 km; Cascais a Sete Rios, 27 min; Sintra a Amadora, 28 min). Rotas entre margens saem erradas (Setúbal a Entrecampos: "15 min", porque o nó mais próximo no maior componente fica a 33 km da origem).

**Consequência**: a rede TomTom serve como fonte de velocidades por segmento, não como grafo de roteamento sem reparação. Recomendo o plano B: grafo OSM de Portugal (necessário de qualquer forma para o r5py) com as velocidades TomTom coladas por correspondência geométrica das arestas.

## 6. GTFS Carris Metropolitana

- Feed de 2026-11-13 a 2027-06-30 (versão `20261113-0400-04`), 4 operadores (áreas 41 a 44), 946 rotas (todas autocarro, `route_type 3`), 306 978 viagens, 9 955 081 `stop_times`, `shape_dist_traveled` presente, 12 798 paragens. Só `calendar_dates` (sem `calendar.txt`).
- Não cobre julho de 2026 nem janeiro de 2020. Para o nível do ratio usar o GTFS atual contra TomTom 2026, assumindo que a oferta não muda muito. A confirmar: arquivo de feeds anteriores.
- Continua por confirmar se existe GTFS equivalente para Carris Lisboa, Metro, TCB, Mobi Cascais, CP, Transtejo.

## 7. Camadas do geoportal descarregadas

| Camada | Feições | Notas |
|---|---|---|
| `informacao_base_grelha_hexag` | 14 624 | campos `hexag`, `zona` (383 valores distintos) |
| `informacao_base_limite_concelho_aml` | 18 | `dico`, `municipio`, `area_ha` |
| `informacao_base_limites_freguesia_aml` | 118 | inclui contagens populacionais (`n_individu` etc., Censos 2021) e de edifícios |
| `gtfs_stops` | 12 702 | com concelho, freguesia, infraestrutura da paragem |
| `gtfs_shapes` | 2 387 | LineString |

As freguesias trazem população, o que dá ponderação por procura para o perfil territorial sem depender da bilhética.

## 8. Decisões a tomar

1. **Plano B para o grafo de carro (OSM + velocidades TomTom)**. Implica descarregar o extrato de Portugal da Geofabrik (cerca de 300 MB). Proposta: sim, é também a base do r5py.
2. **Confirmar com a TML** se existem GTFS de outros operadores e arquivo de feeds de 2026.
3. **Pedir novos jobs TomTom** (2026, vários time sets, mês fora das férias), conforme o PLANO.md.

## Ficheiros produzidos

- `data/parquet/`: `net2026`, `net2020` (GeoParquet), `speed2026_allday`, `speed2020_long`.
- `data/raw/geoportal/`, `data/raw/gtfs/cm_gtfs.zip` e `cm/` (extraído).
- `code/01_to_parquet.py` a `05e_repair_test.py`.
- `.venv/` (Python 3.12, uv).
