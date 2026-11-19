# Mapa interativo: TP face ao carro (AML)

Página estática (HTML, CSS e JavaScript), sem servidor nem base de dados. Todos os cálculos
(medianas por zona, estatísticas da seleção, perfis horários) são feitos no navegador a partir
dos ficheiros em `data/`.

## Ver localmente

```bash
cd site
python3 -m http.server 8000
# abrir http://localhost:8000
```

Também funciona abrindo `index.html` diretamente (os dados são ficheiros `.js`, não `fetch`),
mas o mapa de base só carrega com internet.

## Publicar no GitHub Pages

Automático: `.github/workflows/pages.yml` publica `site/` a cada push em `main` (Settings > Pages > Source: GitHub Actions).
O ficheiro `.nojekyll` já está incluído. O tamanho total ronda 12 MB (cerca de 4 MB comprimido).

## Estrutura

| Ficheiro | Conteúdo |
|---|---|
| `index.html`, `app.css` | página, filtros e estilos (claro e escuro) |
| `js/data.js` | descodificação dos dados e cálculos (rácio, diferença, medianas ponderadas, linhas/carreiras) |
| `js/charts.js` | dispersão (canvas, seleção por retângulo), barras por classe, perfil horário |
| `js/app.js` | mapa Leaflet, camada de linhas/carreiras em canvas, filtros e seleção ligada aos gráficos |
| `data/zones.js`, `muns.js` | 383 zonas e concelhos (WGS84, simplificados) |
| `data/od.js` | matriz origem-destino 383x383 por hora (carro, cenários, TP), em binário base64 |
| `data/lines.js` | troços de linha/carreira (geometria e tempos por hora) |
| `lib/` | Leaflet 1.9.4, MapLibre GL 4.7.1 e a ponte Leaflet-MapLibre (mapas de base vetoriais) |

Os dados são gerados por `code/50_export_site.py` a partir de `data/processed/` (correr com o
ambiente `.venv` do projeto).

## Como usar

- **Zonas**: cor por rácio, diferença, população alcançável ou grupos de prioridade.
  Clique numa zona (shift para somar), use **Área** para um retângulo, ou arraste no gráfico de
  dispersão. O gráfico mostra uma zona por ponto, com a área proporcional à população.
- **Linhas/Carreiras**: cor por rácio do troço, espessura por viagens/hora. Clique num troço para selecionar
  as linhas/carreiras que o servem, use **Área**, arraste no gráfico, ou procure a linha/carreira pelo nome.
- **Gráfico de dispersão** (rácio no eixo horizontal, diferença de tempo no vertical, área = população ou viagens/h):
  sem seleção mostra uma zona (modo Zonas) ou uma linha/carreira (modo Linhas/Carreiras) por ponto. Com seleção mostra as
  observações da seleção: numa zona, uma linha/carreira por ponto (as que a servem, medidas nos troços dentro da zona),
  ou os destinos/origens; numa linha/carreira, uma hora de partida por ponto (modo Linhas/Carreiras) ou um troço por ponto (modo Troços).
- Filtros: hora, velocidade do carro (média, congestionado, fluido), acesso e estacionamento do
  carro (minutos somados ao carro), perspetiva (sai ou chega), concelho, população mínima,
  operadores e frequência mínima.
- Clicar numa classe da legenda oculta essa classe no mapa e nos gráficos. Clicar fora das zonas (no mar), `Esc` ou o botão
  **Toda a AML** limpa a seleção (o botão também volta à vista geral).
- **Grupos de prioridade** (opção em "Mapa mostra"; a matriz aparece no lugar da legenda): gravidade pelo rácio (1,5 e 2; sem TP conta como alta) por exposição pela população (5 e 15 mil); clicar numa célula seleciona as suas zonas.
- **Tempo máximo de TP** (zonas, por defeito 45 min): só contam como alcançáveis os destinos a que o TP chega nesse tempo.
- **Escala de cores do rácio:** azul (abaixo de 1), verde claro (1 a 1,5), bege, salmão, vermelho e vermelho escuro.
- **Zoom no gráfico de dispersão:** roda do rato (em torno do cursor), botões Selecionar, Zoom (retângulo) e Mover; duplo clique ou Repor volta à escala inicial.

## Limitações

Prova de conceito com TomTom de janeiro de 2020, GTFS de 2024 e OSM de 2026. Sem CP, TCB, fluvial,
Metro Sul e Mobi Cascais. Ver o botão "Como ler" na página.
Mapas de base (seletor no canto do mapa, a escolha fica guardada no navegador): **Limpo** (Positron, sem cores),
**Colorido** (Bright, poucas cores) e **Carregado** (Liberty, mais detalhe e rótulos). São estilos vetoriais gratuitos e sem chave
do OpenFreeMap (OpenMapTiles, dados do OpenStreetMap). O deslizador "Zonas" ajusta a opacidade do preenchimento para ver o mapa
por baixo. Se o WebGL não estiver disponível, o mapa recorre ao OpenStreetMap raster.
