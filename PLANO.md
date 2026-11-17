# Pitch TML: competitividade do transporte público face ao automóvel

Rascunho de plano, 2026-11-17.

## 0. Escopo revisto: prova de conceito com dados antigos (decisão de 2026-11-17)

O objetivo desta fase é **mostrar que a metodologia funciona**. Se a TML gostar, pedem-se dados novos e corre-se "pra valer". Por isso:

| Componente | Fonte | Observação |
|---|---|---|
| Velocidades do carro | TomTom janeiro 2020, 6 horas (07-10 e 17-20), terça a quinta | Os dados de 2026 **não** serão usados. Ficam arquivados. |
| Grafo do carro | OSM Portugal (Geofabrik, 2026-11-16) | Velocidades TomTom coladas por correspondência geométrica. A rede TomTom tem falhas nas pontes do Tejo. |
| TP | GTFS de 2024 da Mapoteca (Drive da ULisboa) | Ver tabela abaixo. |

GTFS disponíveis em `GTFS_AML` (copiados para `data/raw/gtfs2024/`):

| Operador | Versão | Validade | Conteúdo |
|---|---|---|---|
| Carris Metropolitana | 2024_03 (feed 2024-05-11) | 2024-01-01 a 2024-12-31 | 1 088 rotas, 203 mil viagens, 6.6 M stop_times |
| Carris (Lisboa) | 2024-01-08 | 2024-01-03 a 2024-03-24 | 175 rotas, 25 mil viagens |
| Metro de Lisboa | 2024-01 | calendário até 2099 | 10 linhas, com `frequencies.txt` |
| Fertagus | 2024-01 | calendário até 2030 | 4 rotas, 298 viagens |
| CP | 2024-01 | vazio | só `stops`, sem viagens |
| TCB, Transtejo, Metro Sul do Tejo, Mobi Cascais | só em `_Old`, anos anteriores | não verificado | fora da prova de conceito |

Consequências:
- **Dia de referência comum**: um dia útil de 2024 em que os quatro feeds têm serviço (decidido: quarta-feira 2024-05-15, ver reports/RELATORIO_FASE2.md). É período escolar, tal como janeiro de 2020 no TomTom.
- **Variabilidade temporal real nos dois lados**: o carro varia por hora (TomTom 2020) e o TP varia por hora pela frequência dos serviços no GTFS (tempo de espera) e pelos tempos de percurso por faixa. A discussão sobre "GTFS com pouca variabilidade" passa a ser tratada com o headway por hora.
- **Cobertura parcial da AML** (sem TCB, Transtejo, Metro Sul): o piloto concentra-se em Lisboa, nos corredores da Carris Metropolitana, Metro e Fertagus, e diz isso explicitamente no pitch.
- **Desfasamento de 4 anos** entre TomTom (2020) e GTFS (2024): assumido e declarado como limitação da prova de conceito. A mensagem é "o método funciona", não "estes são os números de hoje".
- O restante deste documento mantém-se como visão para a versão completa (dados novos), exceto as partes que dependem de 2026.

## 1. O que já sabemos sobre os dados

### TomTom Traffic Stats (pasta local)
- 414 984 segmentos de rede, linhas em WGS84, extensão AML (-9.50/38.41 a -8.50/39.06).
- 337 994 segmentos (81%) têm estatísticas; os restantes não têm amostras.
- Campos da rede: `Id`, `Segment Id`, `NewSegId`, `Length` (m), `FRC` (0 autoestrada a 8 acesso), `SpeedLimit`, `StreetName`.
- Campos de velocidade (ficheiro lateral, ligado por `Id`): `AvgTt`, `MedTt`, `AvgSp`, `HvgSp`, `MedSp`, `SdSp`, `NHits`, percentis `P5sp` a `P95sp`.
- **Limitação crítica do conjunto de 2026**: contém um único time set, `0:00-24:00`, todos os dias, de 1 a 31 de julho de 2026. Não há perfil horário nem distinção dia útil / fim de semana. O conjunto de 2020 (secção seguinte) tem perfil horário, mas só nas pontas e em dias úteis intermédios.
- Julho é mês de férias escolares: o trânsito está mais livre do que na média do ano, o que favorece o carro e penaliza o TP na comparação.
- Não há ids de nós nem sentido de circulação explícito: a topologia do grafo tem de ser reconstruída pelos extremos das geometrias. Validar na fase 0.

### TomTom Traffic Stats, janeiro 2020 (pasta de arquivo local, fora do repositório)
- Mesma AML, mesmo produto (Area Analysis), mas **com perfil horário**: seis time sets de 1 hora (07-08, 08-09, 09-10, 17-18, 18-19, 19-20).
- Período: 2020-01-07 a 2020-01-30, só **terça a quinta** (domingo, segunda, sexta e sábado excluídos), ou seja, mês escolar, pré-COVID.
- Rede mais antiga (mapa `eur2020.03`): 385 187 segmentos, 31 239 km (a rede de 2026 tem 414 984 segmentos, 31 350 km).
- Ficheiros por time set com 179 mil (07-08) a 218 mil (18-19) segmentos com dados. Os pontos de dados mais finos estão nas horas de ponta.
- Existem duas versões do mesmo conjunto: a de agosto de 2021 (`Jan2020_0_*`, 6 time sets) e uma anterior de junho de 2021 (`Jan2020_78`, `_89`, `_1718`, `_1819`, só 4 time sets, com um segmento a menos). Usar a de agosto de 2021; as de junho e `originais__*` são redundantes.
- Diferença de documentação: o readme de 2021 diz que os percentis `Pxxsp` são "% das velocidades **acima** deste valor", o de 2026 diz "**abaixo**". Tem de ser esclarecido com a TomTom ou testado nos dados (P5 deve ser menor ou maior que P95?) antes de definir "fluido" e "congestionado".
- **Cruzamento entre as duas redes**: 344 553 `Segment Id` coincidem (83% dos segmentos de 2026, 84% da extensão em km). Isto permite usar o perfil horário de 2020 como forma temporal e os níveis de 2026 como nível absoluto, com a ressalva de que são anos e contextos diferentes (antes da COVID, vs mês de verão de 2026).

### Geoportal TML (OGC API, pygeoapi, CC-BY 4.0, GeoJSON/CSV)
187 coleções. As relevantes:

| Uso no estudo | Coleções |
|---|---|
| Zonas de agregação | `informacao_base_grelha_hexag` (14 624 hexágonos com campo `zona`), `informacao_base_limites_freguesia_aml`, `informacao_base_limite_concelho_aml` |
| Traçado e paragens TP | `gtfs_shapes` (2 387 shapes), `gtfs_stops` (12 702 paragens, com concelho, freguesia, proximidade a escolas, hospitais, etc.), `dados_harmonizados_rede_servicos_cm`, `redes_transporte_publico_passageiros_*` (Carris, TCB, Mobi Cascais, Metro, fluvial, ferroviária) |
| Procura e atratores | `polos_geradores_*` (escolas, saúde, comércio, serviços públicos, turismo), `uso_solo_*` (densidade e tecido habitacional), `dados_harmonizados_bilhetica` (apenas validações agregadas mensais, 132 registos) |
| Contexto automóvel | `transporte_individual_oferta_estacionamento_aml`, `transporte_individual_classificacao_rede_viaria`, `acessibilidade_grid_*` (tempo de carro até saúde e educação, grelha 1 km, só como validação cruzada) |

### GTFS
- O feed da Carris Metropolitana está disponível publicamente (zip de 74 MB em `api.carrismetropolitana.pt/v2/gtfs`).
- Ainda **não verificado**: se existem GTFS equivalentes para Carris Lisboa, Metro, TCB, Mobi Cascais, CP. O geoportal só mostra as redes e paragens desses operadores, não os horários.
- O feed é de hoje (novembro 2026), os dados TomTom são de julho 2026. Convém usar o GTFS em vigor em julho, se houver arquivo.

## 2. Decisões de método a fechar cedo

1. **Unidade de comparação.** Proposta em dois níveis, que respondem a perguntas diferentes:
   - **Nível linha (mesmo percurso)**: para cada viagem GTFS, o tempo TP entre pares de paragens vs o tempo que um carro demoraria ao longo do mesmo traçado (shape map-matched na rede TomTom). Isola o efeito "velocidade comercial do autocarro vs fluxo do carro" e dá o perfil por linha e por troço.
   - **Nível zona (porta a porta)**: matriz origem-destino entre hexágonos (ou freguesias), com TP via r5py/OpenTripPlanner (caminhada, espera, transbordo) e carro via caminho mais curto no grafo TomTom (peso `AvgTt` ou `MedTt`). Dá o perfil territorial e a atratividade real.
2. **Ratio e diferença**: `ratio = T_TP / T_carro`, `diff = T_TP - T_carro` (minutos). Reportar sempre os dois, porque um ratio 3 em 5 minutos é irrelevante e um ratio 1.5 em 60 minutos não.
3. **Classes de ratio**: o texto lista 5 limiares (<1.5, <2, <3, <4, >4), que dão 5 classes, e fala em 6. Proposta de 6: `<1` (TP mais rápido), `1-1.5`, `1.5-2`, `2-3`, `3-4`, `>4`, com paleta divergente fria para quente.
4. **Tempo de carro justo**: somar parâmetros explícitos de acesso e estacionamento (por exemplo 5 a 10 min, a variar por zona com a oferta de estacionamento), em vez de comparar só o tempo "ao volante". Mostrar a análise de sensibilidade.
5. **Tempo de TP justo**: no nível zona, incluir espera (metade do headway) e caminhada. É aqui que a **frequência** do GTFS introduz variabilidade horária mesmo com tempos de percurso estáveis.
6. **Variabilidade do carro**: três fontes combináveis.
   - **Horária (2020)**: seis horas de ponta, terça a quinta, mês escolar. É o único dado com perfil temporal que temos hoje.
   - **Estatística (ambos os anos)**: três cenários por segmento, fluidez (percentis altos de velocidade), típico (`MedSp`) e congestionado (percentis baixos). Cada ratio passa a ser uma faixa. Atenção à definição dos percentis (ver acima).
   - **Entre anos**: comparar 2020 e 2026 nos segmentos comuns mostra a evolução da velocidade (e do trânsito) em 6 anos, resultado interessante por si só para o pitch.
7. **Sobreposição temporal TP/carro**: o GTFS tem de ser escolhido para corresponder ao período TomTom usado. Para janeiro de 2020 é preciso GTFS de então (Carris Metropolitana só arrancou em 2023, antes eram operadores diferentes: provavelmente não há GTFS unificado desse período). Portanto, **o ratio absoluto TP/carro deve usar 2026 (nível), e o perfil horário de 2020 serve para modelar a forma temporal** (fator de congestionamento por hora e FRC).

## 3. Pedidos de dados a fazer (baratos e de grande impacto)

- **Novos jobs TomTom com vários time sets, em 2026** (os de 2020 já cobrem 07-10 e 17-20 só em dias úteis): ponta da manhã (07-10), entre-picos (10-16), ponta da tarde (17-20), noite, para dia útil e fim de semana. Substitui o fator de 2020 por medição atual e permite validá-lo.
- **Um segundo mês fora das férias** (outubro ou novembro de 2026) para evitar o viés de julho. É o pedido mais valioso se só puder pedir um.
- **GTFS-RT ou arquivo de posições/atrasos** da Carris Metropolitana, se a TML puder ceder. Com isso o tempo TP deixa de ser o programado e passa a ser o realizado, que é o argumento mais forte do pitch.
- **Validações por paragem e por hora** (a coleção pública só traz totais mensais), para ponderar linhas e zonas por procura.

## 4. Fases

### Fase 0: Preparação e validação (a base de tudo)
- Criar ambiente Python (`geopandas`, `pandas`, `duckdb`, `pyarrow`, `igraph` ou `pandana`, `r5py` com Java, `gtfs-kit`, `matplotlib`, `maplibre` ou `folium`). Hoje só há `ogrinfo` instalado.
- Converter os dados TomTom de 2026 (330 MB) e de 2020 (seis time sets, cerca de 660 MB de DBF) para Parquet, ligando `Id`. Documentar cobertura por FRC e concelho.
- Ligar 2020 e 2026 por `Segment Id` (84% em extensão) e medir a estabilidade: correlação das velocidades nos segmentos comuns, e identificar onde a rede mudou.
- Resolver a definição dos percentis (acima/abaixo) com um teste simples nos dados.
- Descarregar e cachear as coleções do geoportal (hexágonos, freguesias, concelhos, gtfs_stops, gtfs_shapes, polos geradores) e o GTFS completo.
- Reconstruir a topologia da rede TomTom e testar conectividade e sentido de circulação. Se falhar, plano B: grafo OSM (Geofabrik Portugal) com velocidades TomTom coladas por map-matching.
- **Entregável**: relatório de qualidade de dados, 1 página, com a decisão sobre o plano B.

### Fase 1: Tempo de carro
- Grafo ponderado por `AvgTt` / `MedTt` e variantes por percentil (fluido, típico, congestionado).
- Roteamento ponto a ponto, validado contra um conjunto pequeno de pares conhecidos (por exemplo contra o `acessibilidade_grid_*` e algumas medições manuais).
- **Entregável**: função `t_carro(origem, destino, cenário)`.

### Fase 2: Tempo de TP
- Tempo programado entre pares de paragens por viagem GTFS (nível linha).
- Matriz porta a porta entre centróides de hexágonos com r5py (nível zona), com partida em janelas definidas (por exemplo dia útil 08:00, 12:00, 18:00).
- **Entregável**: tabelas `tp_linha_troço` e `tp_od_hexagono`.

### Fase 3: Métricas de competitividade
- Ratio e diferença por troço de linha, por linha e por par O-D.
- Agregação: por linha ao longo do tempo (se houver time sets), por hexágono, freguesia e concelho.
- Ponderação opcional por oferta (viagens por dia) e atratores (polos geradores).
- **Entregável**: tabelas finais em Parquet e GeoPackage.

### Fase 4: Produtos visuais
- **Dispersão ratio vs diferença** (um ponto por linha ou par O-D), com quadrantes e colorido pelas classes de ratio. Variante: tempo carro vs tempo TP com retas de ratio 1, 1.5, 2, 3, 4.
- **Barras coloridas por classe de ratio** (percentagem de troços, de viagens ou de km em cada classe), por linha, e perfil de competitividade da linha ao longo do dia/ano quando houver dados.
- **Mapas temáticos por zona** (hexágono e freguesia): ratio e diferença absoluta.
- **Mapas de linhas** com espessura (oferta ou procura) e cor (ratio do troço), mostrando onde a linha é competitiva ou não.
- **Entregável**: figuras exportadas e um mapa web interativo.

### Fase 5: Conclusões e pitch
- Ranking de zonas prioritárias (ratio alto, muita população ou atratores, pouca oferta).
- Ranking de linhas: alto desempenho (benchmark) e problemáticas (candidatas a corredor BUS, prioridade semafórica, reajuste de percurso).
- Estimativa do potencial de captação: ganho em minutos se o ratio descer uma classe.
- Narrativa para a TML: o que o estudo permite hoje, o que permitiria com GTFS-RT e novos time sets, e proposta de colaboração contínua (observatório de competitividade).
- **Entregável**: deck de 10 a 15 slides, mais apêndice metodológico.

## 5. Riscos principais

| Risco | Mitigação |
|---|---|
| 2026 só tem um time set; 2020 só tem pontas, em terça a quinta, e é de antes da COVID | Fator horário de 2020 sobre o nível de 2026, cenários por percentil, pedir novos jobs |
| Percentis documentados de forma contraditória entre os readmes | Teste nos dados na fase 0 e confirmação com TomTom |
| Julho enviesa o carro para tempos melhores | Segundo mês; apresentar como limite inferior do ratio |
| Rede TomTom sem topologia limpa | Fase 0 decide; plano B OSM |
| Apenas Carris Metropolitana confirmada em GTFS | Começar pelo piloto numa área e operador; escalar depois |
| Ratios extremos em O-D muito curtas (poucos minutos) | Filtros de distância mínima e uso conjunto de ratio e diferença |
| GTFS tem pouca variabilidade | Variabilidade vem do lado do carro, da frequência (espera) e, idealmente, do tempo real |

## 6. Sugestão de piloto

Para o pitch, convém demonstrar antes de escalar: uma ou duas linhas Carris Metropolitana de grande procura, mais a área de 3 a 4 concelhos que servem. Isso permite ter todos os 4 tipos de produto visual prontos cedo, com a metodologia validada, e depois replicar para toda a AML.

## 7. Perguntas em aberto para o André

1. Quer pilotar numa área e operador, ou ir direto à AML inteira?
2. Há possibilidade real de pedir novos jobs TomTom (time sets e outro mês)?
3. Há acesso a GTFS de outros operadores e a algum dado em tempo real ou de bilhética?
4. As 6 classes de ratio propostas (com `<1`) estão bem?
5. A comparação deve incluir tempos de acesso e estacionamento do carro, ou apenas condução?
