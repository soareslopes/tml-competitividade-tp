# Relatório da Fase 2: tempo de TP e primeiras métricas

2026-11-17. Scripts `code/20_*` a `code/28_*`. Saídas em `data/processed/`.

## O que foi produzido

Dois conjuntos de resultados, que respondem a perguntas diferentes:

| Nível | Pergunta | Tabela |
|---|---|---|
| **Troço de linha** (cerca de 1 km) | Em cada troço, o autocarro ou comboio é mais rápido que um carro a ir da mesma paragem à seguinte? | `seg_tp_car.parquet` (59 492 linhas troço x hora), `line_profile.parquet`, `reports/line_ranking.csv` |
| **Porta a porta entre zonas** | Quanto demora ir de uma zona a outra de TP (caminhada, espera, transbordos) face ao carro? | `od_ratio.parquet` (146 306 pares x 6 horas), matrizes `tp_matrix_*.parquet` |

## Dia de referência: quarta-feira 2024-05-15

A escolha inicial (2024-01-17) foi trocada depois de uma verificação: no feed da Carris Metropolitana, a **área 4 (Alcochete, Montijo, Moita, Palmela, Setúbal) só tem serviço de 2024-05-01 a 2024-06-30**, e a área 3 vai até 2024-06-30. Com janeiro, a península de Setúbal ficava sem TP. O feed da Carris (Lisboa) só vale até 2024-03-24, por isso o calendário foi **estendido até 2024-06-30** (assunção da prova de conceito: mesma oferta de dia útil). Metro e Fertagus têm calendário válido. Maio é período escolar, coerente com janeiro de 2020 do TomTom. A alteração está em `code/24_clean_gtfs.py` e é a única mudança feita aos dados de TP.

## Método

- **OSM extraído** da AML (278 985 vias, 21 MB) para o r5py. O r5py (R5 7.5.1, Java 27) corre com o OSM e os 4 GTFS limpos. O R5 trata a ausência de `calendar_dates` como erro; usei `allow_errors=True`.
- **Zonas**: 383 zonas TML (agregação dos 14 624 hexágonos de 0.22 km²), com ponto representativo (hexágono mais próximo do centroide).
- **TP porta a porta**: `TravelTimeMatrix` do r5py, TP mais caminhada (até 25 min), janela de partida de 1 hora por cada hora de ponta (mediana, e percentis 25 e 75), limite de 180 min.
- **Carro**: grafo OSM + TomTom 2020 (Fase 1), mesmas zonas e horas, cenário médio (e fluido e congestionado).
- **Troços**: cada padrão de viagem do GTFS cortado em troços de pelo menos 1 km. Tempo de TP é o programado (mediana das viagens da hora); tempo de carro é o caminho mais rápido de paragem a paragem.
- **Controlo de qualidade do carro por troço**: o caminho de carro só entra se o comprimento estiver entre 0.6 e 2.2 vezes o troço, as paragens estiverem a menos de 150 m da rede e o troço tiver pelo menos 400 m. Isto retira 8.9% das linhas (53 mil de 59 mil ficam). Foi necessário porque o snap simples à rede dava desvios absurdos (por exemplo 31 min para 1.1 km). Também passei a **não fazer snap a nós de autoestrada ou via rápida**.

## Resultados provisórios

### A. Troços de linha (autocarros: Carris Metropolitana e Carris)

- Velocidade mediana do TP programado 18 km/h, do carro 26 km/h (sobre distância em linha entre paragens).
- **Ratio mediano 1.41** (p10 0.84, p90 2.22). Em 18.5% da distância o autocarro é mais rápido que o carro (ratio abaixo de 1), em 37% fica entre 1 e 1.5, em 28% entre 1.5 e 2, em 14% entre 2 e 3, e só 2% passa de 3.
- Metro e Fertagus: ratio mediano de 0.44 a 0.45 (cerca de duas vezes mais rápidos que o carro nos troços).
- Variação horária (mediana do ratio): 1.50 (07-08), 1.42, 1.45, 1.35, **1.31 (18-19)**, 1.42. O ratio baixa na ponta da tarde porque o carro piora.
- **Cenários do carro** (autocarros): com carro fluido o ratio mediano é 2.11, com carro médio 1.41, com carro congestionado 1.13. O argumento do estudo é que o ratio varia mais com a congestão do que com a hora.
- Variação do ratio por linha ao longo das horas (máximo menos mínimo): mediana 0.28, percentil 90 0.62.
- Linhas mais competitivas (exemplos): `4701` Oriente-Vale da Amoreira Expresso (0.70), `1107` Algés-Queluz via Queijas (0.77), `2741` Ericeira-Lisboa via A8 (0.77). Menos competitivas: circulares e linhas escolares curtas (`4303` Palmela Circular 3.28, `4461`/`4462` Azeitão, `3037` Quintinha). Ranking completo em `reports/line_ranking.csv` (914 linhas com 3 km ou mais).

### B. Porta a porta entre zonas (08-09)

- 59.6% dos pares são alcançáveis de TP em 180 min (50% a 64%, conforme a hora).
- **Ratio mediano 3.5** (p10 2.3, p90 5.4). Distribuição por classe: 0.7% entre 1 e 1.5, 4% entre 1.5 e 2, 26% entre 2 e 3, 34% entre 3 e 4, 36% acima de 4. Praticamente nenhum par abaixo de 1.
- Diferença mediana de 72 a 81 min conforme a hora.
- Lisboa-Lisboa: ratio mediano 2.7 (carro 15.5 min, TP 40 min). O ratio é parecido em todas as faixas de distância (3.4 a 3.7).
- **Por concelho de origem** (ratio mediano): Seixal 2.9, Sesimbra 2.9, Almada 3.0, Barreiro 3.2, Setúbal 3.3, Lisboa 3.4, Odivelas 3.5, Palmela 3.6, Loures 3.7, Oeiras 3.8, Amadora 4.0, Sintra 4.0, Vila Franca de Xira 4.0, **Cascais 4.5**.
- **Sensibilidade ao acesso do carro**: somando 5, 10 ou 15 min de acesso e estacionamento ao tempo de carro, o ratio mediano passa de 3.5 para 3.0, 2.6 e 2.3, e a fração de pares abaixo de 2 sobe de 5% para 11%, 20% e 32%. Esta é a alavanca principal do resultado e deve ser apresentada como parâmetro.
- **Variabilidade horária por par**: nos 73 656 pares alcançáveis em todas as horas, a amplitude do ratio entre a melhor e a pior hora tem mediana 1.14 e percentil 90 2.04. Vem sobretudo das variações de espera e de alcançabilidade do TP, o que confirma que a frequência do GTFS introduz variabilidade real.

### Leitura

1. **No troço, o autocarro é competitivo** (ratio 1.4, bem abaixo disso nas autoestradas e corredores e em carros congestionados). 
2. **Porta a porta, o TP perde** (ratio 3.5), porque a diferença está na caminhada, espera e transbordos, não na velocidade do veículo. Este contraste é a mensagem do pitch: o que prejudica a competitividade é a cobertura e a frequência, não o veículo.
3. O espaço de melhoria está nos pares com ratio entre 2 e 3 (26%), que um aumento de frequência ou um corredor dedicado levaria abaixo de 2.

## Limitações a declarar

1. **Operadores em falta no GTFS 2024**: CP (a linha de Cascais, Sintra e Azambuja, o ficheiro está vazio), TCB (Barreiro), Transtejo e Soflusa (fluvial), Metro Sul do Tejo, Mobi Cascais. **O ratio porta a porta está sobrestimado onde esses modos pesam**: Cascais (4.5 é o pior concelho, com a linha de Cascais em falta), Oeiras, Sintra, Vila Franca de Xira (CP), Barreiro e Seixal. Mantém-se como prova de conceito, mas os mapas desses concelhos têm de levar um aviso.
2. Os feeds não são do mesmo dia: Carris Metropolitana 2024-05, Carris Lisboa calendário estendido de janeiro, Metro e Fertagus de janeiro de 2024. TomTom é de janeiro de 2020 e o OSM de 2026.
3. O tempo de TP por troço é o **programado**, sem atrasos. O r5py também usa horários programados.
4. Troços de linha: o carro vai pelo caminho mais rápido, não pelo traçado do autocarro, e há 9% de troços descartados.
5. Pontos representativos por zona: zonas grandes e rurais (até 228 km²) têm um ponto só, o que distorce pares curtos. O snap do carro tem mediana 59 m, máximo 2.9 km nalgumas zonas costeiras e rurais.
6. O carro não inclui tempo de acesso e estacionamento por defeito (parâmetro na sensibilidade).
7. Sem verdade terreno para o TP (não comparei com planeadores externos).

## Próximo passo: Fase 3 e 4

- Agregar por zona de origem e de destino (ratio e diferença), por linha ao longo das horas (perfil), e juntar a população das freguesias para ponderar.
- Gráficos de dispersão, barras por classe de ratio e mapas temáticos, conforme a proposta inicial.
- Opcional: correr a sensibilidade de acesso do carro por zona (por exemplo, mais estacionamento no centro de Lisboa).
