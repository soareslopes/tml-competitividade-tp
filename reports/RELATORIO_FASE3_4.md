# Relatório das Fases 3 e 4: agregações, gráficos e mapas

2026-11-17. Scripts `code/30_aggregate.py`, `31_figures.py`, `32_maps.py` (estilo em `code/viz.py`). Figuras em `reports/figuras/`, tabelas em `reports/*.csv` e `data/processed/`.

## O que foi feito

- **Perfil territorial** por zona de origem (383 zonas TML): razão e diferença TP/carro, alcançabilidade, ponderadas pela população dos destinos. A população por zona foi estimada de forma dasimétrica: população de cada freguesia (Censos 2021) distribuída pelos hexágonos em proporção ao comprimento de vias residenciais do OSM (evita atribuir população à água). Total apurado 2 870 208, igual ao das freguesias.
- **Perfil das linhas** por hora (razão agregada dos troços) e por classe de razão.
- **Gráficos e mapas** com as seis classes de razão pedidas, de frio a quente: abaixo de 1, 1 a 1.5, 1.5 a 2, 2 a 3, 3 a 4, acima de 4. A classe "abaixo de 1" foi acrescentada à lista inicial de cinco limiares para dar as seis classes.
- Geometria dos troços de linha fatiada a partir dos shapes do GTFS (97% dos troços). Os mapas de linhas seguem a rede viária real.

## Figuras

| Ficheiro | Mostra |
|---|---|
| [fig1_dispersao_ratio_diferenca.png](figuras/fig1_dispersao_ratio_diferenca.png) | Dispersão entre a razão (1) e a diferença absoluta (2), um ponto por par de zonas, cor por classe. Ao lado, tempo de carro vs tempo de TP com retas de 1x a 4x. |
| [fig2_classes_por_hora.png](figuras/fig2_classes_por_hora.png) | Barras por classe de razão, por hora: porta a porta, troços de autocarro e troços de autocarro nos três cenários de carro. |
| [fig3_perfil_linhas.png](figuras/fig3_perfil_linhas.png) | Perfil horário da razão: autocarros mais competitivos, menos competitivos, e metro e Fertagus. |
| [fig4_barras_classes_linhas.png](figuras/fig4_barras_classes_linhas.png) | Barras por classe para 6 linhas competitivas e 6 menos competitivas. |
| [mapa1_zonas_ratio_diferenca.png](figuras/mapa1_zonas_ratio_diferenca.png) | Mapa temático por zona: razão e diferença em minutos. |
| [mapa2_zonas_grupos.png](figuras/mapa2_zonas_grupos.png) | Zonas por grupo de prioridade. |
| [mapa3_linhas_AML.png](figuras/mapa3_linhas_AML.png) | Linhas na AML, cor pela razão do troço, espessura pela frequência, manhã e tarde. |
| [mapa4_linhas_Lisboa.png](figuras/mapa4_linhas_Lisboa.png) | O mesmo, ampliado em Lisboa. |

## Conclusões

### 1. Que zonas precisam de maior atenção

Agrupei as zonas populosas (população acima da mediana das zonas, 5 873) pelos tercis da razão. Resultado (população estimada):

| Grupo | Zonas | População | Razão mediana | Diferença mediana |
|---|---|---|---|---|
| Prioridade alta (populosa, razão no tercil mais alto) | 55 | 728 mil | 4.3 | 90 min |
| Intermédia (populosa) | 59 | 711 mil | 3.7 | 70 min |
| Oportunidade rápida (populosa, razão no tercil mais baixo) | 58 | 648 mil | 3.2 | 63 min |
| Estrutural (pouca população) | 147 | 498 mil | 3.8 | 82 min |
| Cobertura limitada (TP alcança menos de 30% da população) | 31 | 118 mil | 5.4 | 121 min |
| Sem TP alcançável em 180 min | 31 | 167 mil | n.d. | n.d. |

- **Prioridade alta**, por concelho: Sintra (248 mil habitantes em zonas deste grupo), Cascais (150 mil), Amadora (78 mil), Vila Franca de Xira (54 mil), Oeiras (49 mil). Zonas individuais com maior desvantagem (população vezes diferença): 214, 196, 195 e 211 (Sintra), 12, 17 e 2 (Cascais), 236 (Amadora), 296 e 299 (Barreiro), 373 (Setúbal), 273 (Almada), 220 (Vila Franca de Xira). Tabela completa em `reports/zone_ranking.csv`.
- **Concelhos com pior razão** (média ponderada pela população): Cascais 5.6, Palmela 4.9, Mafra 4.6, Alcochete 4.4, Sintra 4.4, Vila Franca de Xira 4.3. Os melhores: Sesimbra 3.2, Seixal 3.2, Lisboa 3.3, Almada 3.4. Tabela em `reports/municipality_summary.csv`.
- **Aviso essencial**: Sintra, Cascais, Amadora, Oeiras e Vila Franca de Xira são os corredores da CP (linhas de Sintra, Cascais e Azambuja), que **não existem no GTFS de 2024 disponível**. Boa parte do "prioridade alta" nestes concelhos é um efeito de dados em falta, não um diagnóstico final. O mesmo vale para o Barreiro (TCB e ferry) e a Moita. A conclusão robusta para o pitch é o método, e a lista só passa a conclusão operacional com os dados completos.

### 2. Onde há maior espaço para melhoria e para atrair clientes

- **58 zonas, 648 mil habitantes, razão mediana 3.2 (diferença 63 min)**: são as zonas populosas onde o TP já está mais perto do carro. Concentram-se no centro de Lisboa (zonas 24, 23, 39, 62, 41, 40, com razão 2.5 a 2.9, alcançam quase 90% da população da AML em 180 min) e no arco Seixal, Almada, Setúbal (por exemplo, zona 346 em Seixal, razão 2.8). Um ganho de frequência ou de velocidade comercial pode levar muitas viagens para a classe seguinte.
- **Sensibilidade do carro**: com 10 min de acesso e estacionamento no carro, o ratio mediano cai de 3.5 para 2.6 e os pares abaixo de 2 sobem de 5% para 20%. Em zonas com estacionamento difícil (centro de Lisboa), o TP já está na prática no limiar de competir.
- Cerca de 886 mil habitantes vivem em zonas com razão entre 2 e 3.5 e 1.08 milhão em zonas com razão igual ou acima de 4 (de 2.87 milhões no total). Estas últimas precisam de mudança estrutural (cobertura, frequência), não de ajustes.
- **Lacunas de cobertura**: 31 zonas (167 mil habitantes) sem TP alcançável em 3 horas e 31 zonas (118 mil) com cobertura limitada, sobretudo na península de Setúbal (Palmela, Setúbal, Sesimbra), Montijo e Alcochete, e em Mafra. Parte vem do ponto representativo único de zonas muito grandes e rurais.

### 3. Que linhas têm maior desempenho e quais precisam de atenção

Por troço, o autocarro é em geral competitivo (razão mediana 1.41, e 1.13 com carro congestionado). Entre as 914 linhas com pelo menos 3 km:

- **Referência (razão abaixo de 1 e pelo menos 2 viagens por hora): 11 linhas**, por exemplo 4701 Lisboa (Oriente) a Vale da Amoreira Expresso (0.70, 4.5 viagens/h), 1107 Algés a Queluz via Queijas (0.77), 2327 Póvoa de Santa Iria via Vialonga (0.90), 2790 F. Casa (Lgo) a Areeiro (0.91) e Alverca a Areeiro (0.98), 2764 Bucelas a Lisboa (0.94), 753 Carris Centro Sul a Praça José Fontana (0.96, 6.3 viagens/h). Têm em comum o uso de eixos rápidos (A8, IC, autoestradas) e paragens espaçadas.
- **Lentas e frequentes (razão 1.8 ou mais e pelo menos 3 viagens por hora): 17 linhas.** Pior razão: 3101 Amora a Foros de Amora (2.46, 4.2 viagens/h), 1211 Belas a Agualva-Cacém (2.38), 49B Carris (2.11), 2716 Cidade Nova a Lisboa via IC22 (2.04), 1703 Amadora a Pontinha (2.03), 4403 Ferro Engomar a Setúbal (2.03). Incluem linhas urbanas muito usadas de Lisboa (793, 28E, 702), onde a razão ronda 1.8 a 1.9. São os melhores candidatos a corredor bus, prioridade semafórica e revisão de paragens.
- **Rápidas mas pouco frequentes: 27 linhas.** Candidatas a reforço de frequência (o tempo de percurso já compete, o que falha é a espera).
- **Metro e Fertagus** têm razão por troço de 0.3 a 0.6, ou seja, duas a três vezes mais rápidos que o carro. A variabilidade horária é baixa (amplitude de 0.06 a 0.23).
- **Variabilidade ao longo do dia**: a razão da maioria das linhas varia pouco (mediana da amplitude entre melhor e pior hora: 0.28), mas 11% das linhas variam mais de 0.6. Nos autocarros de maior desempenho a razão cai na ponta da tarde (carro mais lento), e nos menos competitivos oscila bastante, o que evidencia a dependência do congestionamento.

## O que o pitch pode dizer

1. **O veículo é competitivo, o sistema não**: por troço a razão mediana é 1.4 (metro e comboio 0.4), mas porta a porta é 3.5. A diferença está em caminhada, espera e transbordos.
2. **A congestão é a alavanca**: com carro congestionado, os autocarros passam de razão 1.41 para 1.13, e 39 a 46% da distância fica abaixo de 1 (contra 19 a 25% com carro médio).
3. **Já há onde atuar**: 58 zonas e 648 mil habitantes com razão 3.2, e 17 linhas frequentes com razão acima de 1.8.
4. **O que um estudo completo acrescentaria**: GTFS de todos os operadores (CP, TCB, fluvial, Metro Sul, Mobi Cascais), TomTom atual com vários time sets, e tempo real. É o argumento para pedir os dados.

## Limitações

1. A prova de conceito mistura TomTom de janeiro de 2020, GTFS de 2024 (com calendário da Carris estendido para maio) e OSM de 2026.
2. Faltam CP, TCB, Transtejo, Soflusa, Metro Sul e Mobi Cascais, o que sobrestima a razão em Cascais, Sintra, Amadora, Oeiras, Vila Franca de Xira e Barreiro.
3. Cada zona usa um só ponto representativo (hexágono mais próximo do centroide). Em zonas muito grandes e rurais pode estar longe das paragens e dar "sem TP alcançável".
4. A população é uma estimativa dasimétrica a partir de freguesias.
5. A ponderação por procura de linhas usa a frequência como proxy: não há validações por linha.
6. Os grupos usam tercis da própria amostra, não limiares absolutos. A mensagem é relativa (onde está pior ou melhor), e os valores absolutos dependem dos pressupostos do carro (sem tempo de acesso e estacionamento).
7. Os tempos de TP são programados; a eventual variação em tempo real não está medida.

## Próximos passos possíveis

- Mapa interativo único (HTML) com camadas de zonas e linhas, para apresentar ao vivo.
- Deck do pitch (10 a 15 slides) com estas figuras.
- Parâmetro de acesso e estacionamento do carro por zona (por exemplo, a partir da oferta de estacionamento do geoportal), para refinar a sensibilidade.
- Repetir com GTFS completo e TomTom atual quando a TML ceder os dados.
