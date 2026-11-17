# Relatório da Fase 1: tempo de carro (OSM + TomTom 2020)

2026-11-17. Scripts `code/10_build_osm_graph.py`, `11_match_tomtom.py`, `12_validate_car.py`, `13_fig_car_profiles.py`, módulo `code/carnet.py`. Saídas em `data/processed/`.

## Resultado

Existe agora uma função `CarNet.od_minutes(origens, destinos, slot, scenario)` que devolve tempos de carro em minutos para qualquer hora de ponta de 2020 (07-08, 08-09, 09-10, 17-18, 18-19, 19-20) e três cenários: médio (`avg`, velocidade média harmónica), congestionado (`cong`, percentil 15 de velocidade) e fluido (`free`, percentil 85).

## O grafo

- Extraído do OSM de Portugal de 2026-11-16, caixa da AML, vias rodoviárias (de `motorway` a `living_street`, mais `service` sem estacionamentos nem acessos privados).
- 135 952 vias, **373 925 arestas dirigidas**, 173 439 nós, 38 311 km dirigidos. Sentido único, rotundas e autoestradas tratados.
- **O maior componente fortemente conexo tem 97.8% dos nós** (a rede TomTom só dava 66%). As travessias do Tejo funcionam nos dois sentidos.
- O OSM é de 2026 e o TomTom de 2020, por isso há ruas novas no grafo sem histórico de velocidade (ver abaixo).

## Correspondência com o TomTom 2020

Cada aresta OSM foi associada ao segmento TomTom mais próximo com o mesmo sentido (amostras a 25, 50 e 75% da aresta, raio de 25 m, diferença de rumo menor que 50 graus, voto maioritário).

- **77.3% das arestas OSM têm segmento TomTom.** A distância mediana de correspondência é 1.6 m e o percentil 90 é 6.7 m.
- Das autoestradas sem correspondência, as 328 arestas restantes ficam fora da extensão TomTom (A8 para norte, A2 para sul).
- Origem da velocidade, em % do comprimento da rede OSM, hora 08-09:

| Origem | % |
|---|---|
| TomTom direto nessa hora | 37.3 |
| Escalado a partir de outras horas do mesmo segmento | 9.7 |
| Fator de classe (mediana de v / velocidade de referência) | 53.1 |

- Fração com TomTom direto por classe: autoestrada 74%, trunk 84%, primary 67%, secondary 72%, tertiary 59%, residential 32%, unclassified 11%, service 17%.
- Interpretação: nos eixos principais as velocidades são medidas. Nas ruas locais são sobretudo estimadas por classe, porque o TomTom de 2020 só tem dados em 18% a 27% dos km da classe FRC 7 por hora. Os percursos longos passam pelos eixos principais, por isso o efeito nos tempos totais é pequeno, mas o ratio em viagens muito curtas e locais é menos fiável.
- Os percentis (fluido e congestionado) quando faltam são aproximados por 125% e 75% da velocidade média.
- Os fatores de classe por hora estão em `reports/class_factors.csv`.

## Validação

Dez pares de teste, cenário médio. Alguns resultados (minutos):

| Par | 07-08 | 08-09 | 17-18 | 18-19 | 19-20 |
|---|---|---|---|---|---|
| Seixal > Baixa-Chiado | 40.3 | 42.1 | 32.2 | 30.7 | 28.1 |
| Baixa-Chiado > Seixal | 24.9 | 26.8 | 39.9 | 44.9 | 36.5 |
| Almada > Saldanha | 20.8 | 24.1 | 18.1 | 19.0 | 16.6 |
| Saldanha > Almada | 17.3 | 20.1 | 28.9 | 33.4 | 27.7 |
| Cascais > Sete Rios | 31.3 | 40.6 | 30.2 | 30.8 | 28.3 |
| Setúbal > Entrecampos | 39.3 | 46.8 | 43.9 | 45.2 | 41.1 |

- **O modelo reproduz a assimetria pendular**: para norte de manhã e para sul à tarde, nos dois sentidos de cada par, sem nenhuma calibração. É a validação qualitativa mais forte.
- O cenário congestionado dá 30% a 60% mais do que o fluido (Cascais a Sete Rios, 08-09: 23 min fluido, 41 médio, 53 congestionado).
- A matriz de tempos entre os centroides das 118 freguesias (118 por 118) calcula-se em 2.5 s, sem pares inalcançáveis, com mediana de 35 min e máximo de 88 min.
- Figura: `reports/fig_car_profiles.png`.
- Não há verdade terreno independente (por exemplo tempos reais de GPS ou Google). A validação é de plausibilidade e de padrão temporal.

## Limitações a declarar no pitch

1. O perfil horário vem de janeiro de 2020, terça a quinta, antes da COVID.
2. Em ruas locais as velocidades são estimadas por classe, não medidas.
3. Não há semáforos, viragens nem sentidos proibidos de viragem. A parte do tempo perdida em cruzamentos está só implícita nas velocidades TomTom medidas.
4. Não inclui tempo de acesso e estacionamento do carro (a parametrizar na fase de métricas).
5. Os nós ficam no maior SCC por snap ao nó mais próximo (distância típica até 100 m).

## Próximo passo: Fase 2, tempo de TP

- Preparar o GTFS de 2024 (Carris Metropolitana, Carris Lisboa, Metro, Fertagus) para o dia de referência (quarta-feira 2024-01-17) e juntá-lo ao OSM para o r5py.
- Calcular, em duas escalas: por troço de linha (tempo de percurso programado) e porta a porta entre freguesias ou hexágonos (com caminhada e espera).
- Depois: Fase 3, ratio e diferença, juntando com o carro desta fase.
