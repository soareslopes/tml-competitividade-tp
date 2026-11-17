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
mas o mapa de base OpenStreetMap só carrega com internet.

## Publicar no GitHub Pages

Automático: `.github/workflows/pages.yml` publica `site/` a cada push em `main` (Settings > Pages > Source: GitHub Actions).
O ficheiro `.nojekyll` já está incluído. O tamanho total ronda 12 MB (cerca de 4 MB comprimido).

## Estrutura

| Ficheiro | Conteúdo |
|---|---|
| `index.html`, `app.css` | página, filtros e estilos (claro e escuro) |
| `js/data.js` | descodificação dos dados e cálculos (razão, diferença, medianas ponderadas, linhas) |
| `js/charts.js` | dispersão (canvas, seleção por retângulo), barras por classe, perfil horário |
| `js/app.js` | mapa Leaflet, camada de linhas em canvas, filtros e seleção ligada aos gráficos |
| `data/zones.js`, `muns.js` | 383 zonas e concelhos (WGS84, simplificados) |
| `data/od.js` | matriz origem-destino 383x383 por hora (carro, cenários, TP), em binário base64 |
| `data/lines.js` | troços de linha (geometria e tempos por hora) |
| `lib/` | Leaflet 1.9.4 |

Os dados são gerados por `code/50_export_site.py` a partir de `data/processed/` (correr com o
ambiente `.venv` do projeto).

## Como usar

- **Zonas**: cor por razão, diferença, população alcançável, população ou grupo de prioridade.
  Clique numa zona (shift para somar), use **Área** para um retângulo, ou arraste no gráfico de
  dispersão. O gráfico mostra uma zona por ponto, com a área proporcional à população.
- **Linhas**: cor por razão do troço, espessura por viagens/hora. Clique num troço para selecionar
  as linhas que o servem, use **Área**, arraste no gráfico, ou procure a linha pelo nome.
- Filtros: hora, velocidade do carro (média, congestionado, fluido), acesso e estacionamento do
  carro (minutos somados ao carro), perspetiva (sai ou chega), concelho, população mínima,
  operadores e frequência mínima.
- Clicar numa classe da legenda oculta essa classe no mapa e nos gráficos. `Esc` limpa a seleção.

## Limitações

Prova de conceito com TomTom de janeiro de 2020, GTFS de 2024 e OSM de 2026. Sem CP, TCB, fluvial,
Metro Sul e Mobi Cascais. Ver o botão "Como ler" na página.
Mapa de base: OpenStreetMap (uso moderado conforme a política de tiles; para tráfego elevado
trocar por um fornecedor com chave).
