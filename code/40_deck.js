// Deck do pitch TML: node code/40_deck.js  (usa pptxgenjs; ver NODE_PATH em reports/README do deck)
const path = require("path");
const pptxgen = require("pptxgenjs");
const SKILL = process.env.PPTX_SKILL_DIR;
const { applyTheme } = require(path.join(SKILL, "scripts/apply_theme.js"));

const ROOT = path.resolve(__dirname, "..");
const FIG = path.join(ROOT, "reports/figuras");
const OUT = path.join(ROOT, "reports/TML_pitch_competitividade_TP.pptx");

const THEME = {
  name: "TML competitividade TP",
  headFontFace: "Cambria",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "14213D", lt1: "FFFFFF", dk2: "0F2747", lt2: "F3F6FA",
    accent1: "256ABF", accent2: "D9483B", accent3: "86B6EF", accent4: "F0A58B", accent5: "ECD9B8", accent6: "8F1D1D",
    hlink: "256ABF", folHlink: "8F1D1D",
  },
};

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "Competitividade do transporte público face ao carro";
pres.subject = "Prova de conceito para a TML";
const C = pres.SchemeColor;

// paleta das classes de razão (igual a code/viz.py)
const CLS = ["256ABF", "86B6EF", "ECD9B8", "F0A58B", "D9483B", "8F1D1D"];
const CLS_LAB = ["< 1", "1 a 1,5", "1,5 a 2", "2 a 3", "3 a 4", "> 4"];
const GREY = "52514E";
const TINT = "F3F6FA";
const TINT_WARM = "FBEFEA";
const TINT_BLUE = "E6F0FB";
const NAVY = "0F2747";

const FOOT = "Prova de conceito: TomTom jan/2020, GTFS 2024, OSM 2026";

pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 1.9, w: 9.8, h: 2.1, fontSize: 40, bold: true, color: C.background1, valign: "bottom", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.25, w: 9.8, h: 1.1, fontSize: 20, color: C.accent3, valign: "top", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: "FFFFFF" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.52, w: 12.33, h: 0.75, fontSize: 26, bold: true, color: C.text2, valign: "top", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: 0.5, y: 7.1, w: 9, h: 0.28, fontSize: 10, color: "6B7280", margin: 0 } } },
  ],
  slideNumber: { x: 12.2, y: 7.1, w: 0.63, h: 0.28, fontSize: 10, color: "6B7280", align: "right", margin: 0 },
});
pres.defineSlideMaster({
  title: "CLOSING_DARK",
  background: { color: NAVY },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.52, w: 12.33, h: 0.75, fontSize: 26, bold: true, color: C.background1, valign: "top", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.2, y: 7.1, w: 0.63, h: 0.28, fontSize: 10, color: "9CB4D8", align: "right", margin: 0 },
});

const sizes = {
  "fig1_dispersao_ratio_diferenca.png": [2125, 884],
  "fig2_classes_por_hora.png": [2635, 816],
  "fig3_perfil_linhas.png": [2635, 850],
  "fig4_barras_classes_linhas.png": [1785, 1088],
  "mapa1_zonas_ratio_diferenca.png": [2380, 1258],
  "mapa2_zonas_grupos.png": [1462, 1360],
  "mapa3_linhas_AML.png": [2550, 1292],
  "mapa4_linhas_Lisboa.png": [2550, 1258],
};

let section = "";
const sections = {};
function sec(name) { section = name; pres.addSection({ title: name }); }

function content(eyebrow, title, notes, master = "CONTENT") {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  s.addText(eyebrow.toUpperCase(), { x: 0.5, y: 0.22, w: 9, h: 0.26, fontSize: 11, bold: true, color: master === "CONTENT" ? C.accent1 : C.accent3, charSpacing: 2, margin: 0, isTextBox: true, objectName: "Eyebrow" });
  s.addText(title, { placeholder: "title" });
  s.addNotes(notes);
  return s;
}

function card(s, x, y, w, h, fill = TINT, name = "Cartao") {
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.08, objectName: name });
}

// bloco com rotulo + marcadores
function block(s, { x, y, w, h, label, color = C.accent1, items, fs = 14, fill = TINT, gap = 4 }) {
  card(s, x, y, w, h, fill, "Bloco " + label);
  s.addText(label.toUpperCase(), { x: x + 0.18, y: y + 0.1, w: w - 0.36, h: 0.28, fontSize: 12, bold: true, color, charSpacing: 1.5, margin: 0, isTextBox: true, objectName: "Rotulo " + label });
  const runs = items.map((t, i) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < items.length - 1, paraSpaceAfter: gap } }));
  s.addText(runs, { x: x + 0.18, y: y + 0.42, w: w - 0.36, h: h - 0.5, fontSize: fs, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: "Texto " + label });
}

function img(s, file, x, y, maxW, maxH, align = "left") {
  const [pw, ph] = sizes[file];
  const r = pw / ph;
  let w = maxW, h = w / r;
  if (h > maxH) { h = maxH; w = h * r; }
  const xx = align === "center" ? x + (maxW - w) / 2 : x;
  s.addImage({ path: path.join(FIG, file), x: xx, y, w, h, altText: file.replace(/_/g, " ").replace(".png", ""), objectName: file });
  return { x: xx, y, w, h };
}

function stat(s, { x, y, w, h = 1.3, value, label, color = C.accent1, fill = TINT, vs = 40, ls = 14 }) {
  card(s, x, y, w, h, fill, "Estatistica " + label.slice(0, 20));
  s.addText(value, { x: x + 0.15, y: y + 0.08, w: w - 0.3, h: h * 0.5, fontSize: vs, bold: true, fontFace: "Cambria", color, margin: 0, valign: "middle", isTextBox: true, objectName: "Valor" });
  s.addText(label, { x: x + 0.15, y: y + h * 0.55, w: w - 0.3, h: h * 0.42, fontSize: ls, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Legenda valor" });
}

function chartDefaults(extra = {}) {
  return Object.assign({
    catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", legendFontFace: "+mn-lt", titleFontFace: "+mn-lt",
    catAxisLabelColor: GREY, valAxisLabelColor: GREY, dataLabelColor: "14213D",
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 12, dataLabelFontSize: 12, legendFontSize: 12, titleFontSize: 14, titleColor: "14213D",
    valGridLine: { color: "E4E3DF", size: 0.75 }, catGridLine: { style: "none" },
    catAxisLineShow: false, valAxisLineShow: false,
  }, extra);
}

// ------------------------------------------------------------------ 1. Titulo
pres.addSection({ title: "Abertura" });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Abertura" });
  s.addText("Quão competitivo é o transporte público face ao carro?", { placeholder: "title" });
  s.addText("Prova de conceito para a Área Metropolitana de Lisboa: razão e diferença de tempos, da linha ao território", { placeholder: "body" });
  CLS.forEach((c, i) => s.addShape(pres.ShapeType.rect, { x: 0.8 + i * 0.62, y: 5.9, w: 0.56, h: 0.3, fill: { color: c }, line: { color: c, width: 0 }, objectName: "Classe " + CLS_LAB[i] }));
  s.addText("Razão TP / carro: do frio (TP competitivo) ao quente (TP muito mais lento)", { x: 0.8, y: 6.3, w: 8, h: 0.3, fontSize: 12, color: "9CB4D8", margin: 0, isTextBox: true, objectName: "Legenda classes" });
  s.addText("Projeto ULISBOA_TML | novembro de 2026", { x: 0.8, y: 0.7, w: 8, h: 0.3, fontSize: 12, color: "9CB4D8", margin: 0, isTextBox: true, objectName: "Data" });
  s.addNotes("Abertura. A pergunta que guia tudo é simples: para quem viaja, quanto pior (ou melhor) é o transporte público face ao carro, e onde. Vamos propor duas medidas, mostrar uma prova de conceito já calculada com dados de 2020 e 2024, explicar como ler cada gráfico e mapa, e terminar com o que isto permite fazer no planeamento e na informação ao cliente. A faixa de seis cores será usada em todo o deck, do frio (TP competitivo) ao quente (TP muito mais lento).");
}

// ------------------------------------------------------------------ 2. Proposta
sec("A proposta");
{
  const s = content("A proposta", "Propomos medir o TP contra o carro em duas medidas simples",
    "A ideia central. Para a mesma origem, o mesmo destino e a mesma hora, calculamos o tempo de viagem por transporte público (A) e por carro (B). Dessas duas medidas saem duas métricas: a razão A/B, que diz quantas vezes o TP demora mais, e a diferença A-B, que diz quantos minutos a mais custa a viagem. A razão compara o desempenho de forma relativa, a diferença dá o custo em minutos para o passageiro. O exemplo à direita mostra porque precisamos das duas: a mesma razão pode esconder custos muito diferentes.");
  // entradas A e B
  card(s, 0.5, 1.75, 3.7, 1.9, TINT_BLUE, "Caixa A");
  s.addText("A", { x: 0.7, y: 1.85, w: 0.7, h: 0.7, fontSize: 44, bold: true, fontFace: "Cambria", color: C.accent1, margin: 0, isTextBox: true, objectName: "Letra A" });
  s.addText("Tempo de viagem por TP", { x: 0.7, y: 2.6, w: 3.4, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Titulo A" });
  s.addText("caminhada, espera, viagem e transbordos, com os horários do GTFS", { x: 0.7, y: 3.0, w: 3.4, h: 0.55, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto A" });
  card(s, 0.5, 3.95, 3.7, 1.9, TINT_WARM, "Caixa B");
  s.addText("B", { x: 0.7, y: 4.05, w: 0.7, h: 0.7, fontSize: 44, bold: true, fontFace: "Cambria", color: C.accent2, margin: 0, isTextBox: true, objectName: "Letra B" });
  s.addText("Tempo de viagem por carro", { x: 0.7, y: 4.8, w: 3.4, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Titulo B" });
  s.addText("caminho mais rápido, com a velocidade real de cada hora (TomTom)", { x: 0.7, y: 5.2, w: 3.4, h: 0.55, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto B" });
  // setas
  s.addShape(pres.ShapeType.rightArrow, { x: 4.4, y: 3.3, w: 0.7, h: 0.5, fill: { color: C.text2 }, line: { color: C.text2, width: 0 }, objectName: "Seta" });
  // resultados
  card(s, 5.3, 1.75, 3.9, 1.9, C.text2, "Metrica 1");
  s.addText("1", { x: 5.5, y: 1.85, w: 0.7, h: 0.7, fontSize: 44, bold: true, fontFace: "Cambria", color: C.accent3, margin: 0, isTextBox: true, objectName: "Num 1" });
  s.addText("Razão A / B", { x: 5.5, y: 2.6, w: 3.5, h: 0.4, fontSize: 20, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: "Titulo 1" });
  s.addText("quantas vezes o TP demora mais que o carro", { x: 5.5, y: 3.0, w: 3.5, h: 0.55, fontSize: 14, color: "DCE6F5", margin: 0, valign: "top", isTextBox: true, objectName: "Texto 1" });
  card(s, 5.3, 3.95, 3.9, 1.9, C.text2, "Metrica 2");
  s.addText("2", { x: 5.5, y: 4.05, w: 0.7, h: 0.7, fontSize: 44, bold: true, fontFace: "Cambria", color: C.accent3, margin: 0, isTextBox: true, objectName: "Num 2" });
  s.addText("Diferença A - B", { x: 5.5, y: 4.8, w: 3.5, h: 0.4, fontSize: 20, bold: true, color: C.background1, margin: 0, isTextBox: true, objectName: "Titulo 2" });
  s.addText("quantos minutos a mais custa a viagem por TP", { x: 5.5, y: 5.2, w: 3.5, h: 0.55, fontSize: 14, color: "DCE6F5", margin: 0, valign: "top", isTextBox: true, objectName: "Texto 2" });
  // exemplo
  block(s, { x: 9.5, y: 1.75, w: 3.33, h: 4.1, label: "Porque as duas", color: C.accent1, fs: 14, items: [
    "Carro 10 min, TP 20 min: razão 2, diferença de 10 min.",
    "Carro 40 min, TP 80 min: razão 2, diferença de 40 min.",
    "Mesma razão, custo muito diferente para quem viaja.",
  ] });
  s.addText("Cada par origem-destino e cada hora de ponta dá um ponto; juntando pontos obtemos perfis por linha e por zona.", { x: 0.5, y: 6.15, w: 12.33, h: 0.6, fontSize: 16, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Rodape proposta" });
}

// ------------------------------------------------------------------ 3. Linha ao territorio
{
  const s = content("A proposta", "Da linha ao território: três perguntas, seis produtos, um ganho claro",
    "Aqui está o arco do pitch. À esquerda, as três perguntas de gestão a que o método responde: que linhas funcionam melhor e quais precisam de atenção, que zonas precisam de mais atenção, e onde há mais espaço para melhorar e atrair clientes. No centro, os produtos: dispersão, barras por classe, perfis de linhas, mapas de zonas e mapas de linhas. À direita, o que a TML ganha: um indicador comparável entre linhas e zonas, priorização com base na população afetada e um método reprodutível com os dados que já existem, atualizável quando houver dados novos.");
  const cw = 3.95, gap = 0.24, y = 1.65, h = 4.95;
  block(s, { x: 0.5, y, w: cw, h, label: "Três perguntas", color: C.accent1, fs: 15, gap: 10, items: [
    "Que linhas têm melhor desempenho e quais precisam de atenção?",
    "Que zonas precisam de maior atenção?",
    "Onde há mais espaço para melhorar e atrair clientes?",
  ] });
  block(s, { x: 0.5 + cw + gap, y, w: cw, h, label: "Seis produtos", color: C.text2, fs: 15, gap: 10, items: [
    "Dispersão da razão contra a diferença",
    "Barras por seis classes de razão",
    "Perfil de competitividade das linhas ao longo do dia",
    "Perfil territorial por zona",
    "Mapas temáticos de zonas",
    "Mapas de linhas: espessura e cor por troço",
  ] });
  block(s, { x: 0.5 + 2 * (cw + gap), y, w: cw, h, label: "O que a TML ganha", color: C.accent6, fs: 15, gap: 10, items: [
    "Um indicador comparável entre linhas, zonas e horas",
    "Prioridades ponderadas pela população que sofre a diferença",
    "Método reprodutível com GTFS e geoportal, repetível com dados novos",
  ] });
}

// ------------------------------------------------------------------ 4. Inovacao: duas escalas
sec("Contribuição e inovação");
{
  const s = content("Contribuição e inovação", "Medimos por troço de linha e porta a porta, e a diferença é a mensagem",
    "Primeira contribuição: duas escalas na mesma metodologia. Por troço de cerca de 1 km, comparamos o tempo programado do autocarro, metro ou comboio com o tempo de carro entre as mesmas paragens. A razão mediana é 1,41 nos autocarros e 0,44 a 0,45 no metro e na Fertagus. Porta a porta, entre zonas, incluímos caminhada, espera e transbordos, e a razão mediana sobe para 3,5. O veículo compete, o sistema como experiência do passageiro não. Esta distinção é o que permite dizer onde atuar: na velocidade do veículo ou na cobertura e frequência.");
  card(s, 0.5, 1.65, 5.9, 3.3, TINT_BLUE, "Troco");
  s.addText("Por troço de linha (cerca de 1 km)", { x: 0.75, y: 1.8, w: 5.4, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Titulo troco" });
  s.addText("1,41", { x: 0.75, y: 2.3, w: 2.6, h: 0.9, fontSize: 54, bold: true, fontFace: "Cambria", color: C.accent1, margin: 0, isTextBox: true, objectName: "Valor troco" });
  s.addText("razão mediana dos autocarros; 0,44 a 0,45 no metro e na Fertagus", { x: 3.45, y: 2.4, w: 2.8, h: 0.8, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Legenda troco" });
  s.addText("Compara o tempo programado do TP com o do carro entre as mesmas paragens. Isola a velocidade do veículo.", { x: 0.75, y: 3.5, w: 5.4, h: 1.2, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto troco" });
  card(s, 6.93, 1.65, 5.9, 3.3, TINT_WARM, "Porta a porta");
  s.addText("Porta a porta (entre zonas)", { x: 7.18, y: 1.8, w: 5.4, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Titulo p2p" });
  s.addText("3,5", { x: 7.18, y: 2.3, w: 2.6, h: 0.9, fontSize: 54, bold: true, fontFace: "Cambria", color: C.accent2, margin: 0, isTextBox: true, objectName: "Valor p2p" });
  s.addText("razão mediana dos pares origem-destino, de manhã (08h às 09h)", { x: 9.88, y: 2.4, w: 2.8, h: 0.8, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Legenda p2p" });
  s.addText("Inclui caminhada, espera e transbordos. Mede a experiência do passageiro e a cobertura da rede.", { x: 7.18, y: 3.5, w: 5.4, h: 1.2, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto p2p" });
  s.addText("O veículo compete; o sistema, ainda não. O que separa 1,4 de 3,5 é cobertura, frequência e transbordos.", { x: 0.5, y: 5.3, w: 12.33, h: 0.9, fontSize: 20, bold: true, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Mensagem escalas" });
}

// ------------------------------------------------------------------ 5. Inovacao: variabilidade do carro
{
  const s = content("Contribuição e inovação", "O carro varia com a hora e com a congestão, e isso dá variabilidade ao estudo",
    "Segunda contribuição: usar velocidades TomTom por hora para dar variabilidade ao lado do carro. À esquerda, a velocidade média da rede cai de 46 km/h às 7h para 39,7 km/h na ponta da tarde. Atenção ao efeito de composição, sobretudo às 7h, porque há menos veículos sonda; por isso usamos fatores comparados nos mesmos segmentos. À direita, a razão mediana dos troços de autocarro muda de 2,11 com carro fluido para 1,13 com carro congestionado. A congestão é mais importante do que a hora para a competitividade do autocarro, e o GTFS estático sozinho não a captaria.");
  s.addChart(pres.charts.BAR, [{ name: "Velocidade média da rede (km/h)", labels: ["07-08", "08-09", "09-10", "17-18", "18-19", "19-20"], values: [46.1, 43.6, 43.1, 40.4, 39.7, 41.3] }],
    chartDefaults({ x: 0.5, y: 1.6, w: 6.0, h: 4.3, barDir: "col", chartColors: ["256ABF"], showTitle: true, title: "Velocidade média da rede por hora (km/h)", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 55, valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 50 }));
  s.addChart(pres.charts.BAR, [{ name: "Razão mediana dos troços de autocarro", labels: ["Carro fluido", "Carro médio", "Carro congestionado"], values: [2.11, 1.41, 1.13] }],
    chartDefaults({ x: 6.83, y: 1.6, w: 6.0, h: 4.3, barDir: "col", chartColors: ["D9483B"], showTitle: true, title: "Razão mediana dos troços de autocarro, por cenário do carro", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.00", showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 2.6, valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 50 }));
  s.addText("Fluido: percentil 85 das velocidades; médio: média harmónica; congestionado: percentil 15. Hora 07-08 com menos veículos sonda (efeito de composição).", { x: 0.5, y: 6.15, w: 12.33, h: 0.6, fontSize: 12, color: GREY, margin: 0, valign: "top", isTextBox: true, objectName: "Nota cenarios" });
}

// ------------------------------------------------------------------ 6. Inovacao: quadrantes
{
  const s = content("Contribuição e inovação", "A razão e a diferença dizem coisas diferentes: lê-se pelos quadrantes",
    "Terceira contribuição: usar as duas métricas em conjunto. Cada par origem-destino, ou cada linha, tem uma razão e uma diferença. No quadrante inferior esquerdo estão os casos competitivos. Em baixo à direita, a razão é alta mas a diferença é pequena: viagens curtas, onde o TP perde em proporção mas pouco em minutos. Em cima à esquerda, a razão é moderada mas a viagem é longa e a diferença é grande: muitos minutos perdidos. Em cima à direita está a prioridade: pior nas duas medidas. Os limiares são ilustrativos e devem ser definidos com a TML.");
  const gx = 1.4, gy = 1.75, cw = 3.5, ch = 2.0, g = 0.08;
  // quadrantes: linha superior = diferença grande
  const Q = [
    { c: 0, r: 0, fill: "FBE3DC", t: "Viagem longa, razão moderada", d: "muitos minutos perdidos, mesmo com razão contida" },
    { c: 1, r: 0, fill: "F3B7A9", t: "Prioridade", d: "pior nas duas medidas: razão e minutos" },
    { c: 0, r: 1, fill: "CFE2F9", t: "Competitivo", d: "razão baixa e poucos minutos de diferença" },
    { c: 1, r: 1, fill: "ECD9B8", t: "Viagem curta, razão alta", d: "perde em proporção, mas pouco em minutos" },
  ];
  Q.forEach((q) => {
    const x = gx + q.c * (cw + g), y = gy + q.r * (ch + g);
    s.addShape(pres.ShapeType.roundRect, { x, y, w: cw, h: ch, fill: { color: q.fill }, line: { color: q.fill, width: 0 }, rectRadius: 0.08, objectName: "Quadrante " + q.t });
    s.addText(q.t, { x: x + 0.2, y: y + 0.2, w: cw - 0.4, h: 0.4, fontSize: 18, bold: true, color: C.text1, margin: 0, isTextBox: true, objectName: "Titulo quadrante" });
    s.addText(q.d, { x: x + 0.2, y: y + 0.7, w: cw - 0.4, h: 1.0, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto quadrante" });
  });
  // eixos
  s.addText("Razão A/B: baixa", { x: gx, y: gy + 2 * ch + g + 0.12, w: cw, h: 0.3, fontSize: 12, color: GREY, align: "center", margin: 0, isTextBox: true, objectName: "Eixo x baixa" });
  s.addText("Razão A/B: alta", { x: gx + cw + g, y: gy + 2 * ch + g + 0.12, w: cw, h: 0.3, fontSize: 12, color: GREY, align: "center", margin: 0, isTextBox: true, objectName: "Eixo x alta" });
  s.addText("Diferença grande", { x: 0.25, y: gy, w: 1.1, h: ch, fontSize: 12, color: GREY, align: "right", valign: "middle", margin: 0, isTextBox: true, objectName: "Eixo y grande" });
  s.addText("Diferença pequena", { x: 0.25, y: gy + ch + g, w: 1.1, h: ch, fontSize: 12, color: GREY, align: "right", valign: "middle", margin: 0, isTextBox: true, objectName: "Eixo y pequena" });
  block(s, { x: 9.2, y: 1.75, w: 3.63, h: 4.1, label: "Como usar", color: C.accent1, fs: 14, items: [
    "Cada ponto é um par origem-destino ou uma linha.",
    "A cor segue as seis classes de razão.",
    "O tamanho pode ser a população de quem sofre a diferença.",
    "Limiares ilustrativos, a fixar com a TML.",
  ] });
}

// ------------------------------------------------------------------ 7. GTFS estatico vs tempo real
{
  const s = content("Contribuição e inovação", "O GTFS estático dá pouca variabilidade; o tempo real mudaria o estudo",
    "Ponto de discussão que o próprio estudo levanta. O GTFS é um horário programado, por isso o tempo de TP muda pouco ao longo do dia: a variação vem da frequência, ou seja, da espera. Mesmo assim vimos que a amplitude da razão por linha ao longo das horas tem mediana 0,28 e percentil 90 de 0,62, e que por par origem-destino a amplitude mediana é 1,14, sobretudo por espera e alcançabilidade. As velocidades TomTom acrescentam variabilidade ao lado do carro. Com GTFS em tempo real passaríamos a medir atrasos, regularidade e perda de ligações, e a razão tornar-se-ia um indicador de operação e não só de planeamento.");
  const cw = 3.95, gap = 0.24, y = 1.65, h = 4.95;
  block(s, { x: 0.5, y, w: cw, h, label: "Hoje: GTFS programado", color: C.accent1, fs: 14, gap: 8, items: [
    "Tempo de TP quase constante ao longo do dia.",
    "A variação vem da frequência e da espera.",
    "Amplitude mediana da razão por linha: 0,28 (percentil 90: 0,62).",
    "Amplitude mediana por par origem-destino: 1,14.",
  ] });
  block(s, { x: 0.5 + cw + gap, y, w: cw, h, label: "Acrescenta o TomTom", color: C.accent2, fs: 14, gap: 8, items: [
    "Velocidade do carro por hora de ponta.",
    "Reproduz a assimetria pendular: norte de manhã, sul à tarde.",
    "Cenários fluido, médio e congestionado para o mesmo troço.",
    "Autocarro: razão 2,11 com carro fluido e 1,13 com carro congestionado.",
  ] });
  block(s, { x: 0.5 + 2 * (cw + gap), y, w: cw, h, label: "Com GTFS em tempo real", color: C.accent6, fs: 14, gap: 8, items: [
    "Atrasos e regularidade entram no tempo de TP.",
    "A razão passa a medir a operação, não só o horário.",
    "Deteção de troços e horas em que o TP perde ligações.",
    "Pedido de dados: arquivo de feeds em tempo real.",
  ] });
}

// ------------------------------------------------------------------ 8. Pipeline
sec("Método e cálculos preliminares");
{
  const s = content("Método e cálculos preliminares", "Do dado bruto ao produto: quatro etapas reprodutíveis",
    "O método em quatro etapas. Primeiro, os dados: velocidades TomTom de janeiro de 2020, o grafo viário do OpenStreetMap, os GTFS de 2024 e as camadas do geoportal da TML, com hexágonos, freguesias e população. Segundo, os tempos: um grafo de carro com velocidades por hora e o cálculo do tempo de TP com o r5py, porta a porta e por troço. Terceiro, as métricas: razão, diferença e seis classes. Quarto, as agregações por linha e por zona e os produtos gráficos. Tudo está em scripts reprodutíveis, que podem ser repetidos com dados novos.");
  const cols = [
    { x: 0.5, w: 2.9, t: "1. Dados", items: ["TomTom jan/2020: velocidade por hora", "OSM 2026: rede viária da AML", "GTFS 2024: Carris Metropolitana, Carris, Metro, Fertagus", "Geoportal TML: hexágonos, zonas, população"], fill: TINT },
    { x: 3.75, w: 2.9, t: "2. Tempos", items: ["Carro: grafo OSM com velocidade TomTom por hora", "TP: r5py (R5), porta a porta, com caminhada e espera", "TP por troço de cerca de 1 km, tempo programado"], fill: TINT_BLUE },
    { x: 7.0, w: 2.9, t: "3. Métricas", items: ["Razão A/B", "Diferença A-B em minutos", "Seis classes de razão", "Filtros de qualidade e sensibilidade"], fill: TINT_WARM },
    { x: 10.25, w: 2.58, t: "4. Produtos", items: ["Perfil por linha", "Perfil por zona, com população", "Gráficos e mapas"], fill: "E4EBF5" },
  ];
  cols.forEach((c) => block(s, { x: c.x, y: 1.7, w: c.w, h: 4.4, label: c.t, color: C.text2, fs: 14, gap: 8, fill: c.fill, items: c.items }));
  [3.4, 6.65, 9.9].forEach((x) => s.addShape(pres.ShapeType.rightArrow, { x: x + 0.01, y: 3.65, w: 0.33, h: 0.4, fill: { color: C.accent1 }, line: { color: C.accent1, width: 0 }, objectName: "Seta etapa" }));
  s.addText("Scripts em code/ (Python, DuckDB, r5py); cada etapa grava tabelas em Parquet e relatório de controlo de qualidade.", { x: 0.5, y: 6.3, w: 12.33, h: 0.5, fontSize: 14, color: GREY, margin: 0, valign: "top", isTextBox: true, objectName: "Nota pipeline" });
}

// ------------------------------------------------------------------ 9. Dados
{
  const s = content("Método e cálculos preliminares", "A prova de conceito junta dados abertos e dados da TML",
    "Os dados usados na prova de conceito. O TomTom é de janeiro de 2020, terça a quinta, com seis horas de ponta; é o que existe no momento, e o pitch assume-o. O OSM é de novembro de 2026 e dá o grafo de carro e de caminhada. Os GTFS são de 2024: Carris Metropolitana, Carris, Metro de Lisboa e Fertagus, com dia de referência quarta-feira 15 de maio de 2024. A população vem das freguesias, Censos 2021, distribuída pelos hexágonos. Faltam no GTFS de 2024 a CP, TCB, Transtejo, Soflusa, Metro Sul e Mobi Cascais, o que sobrestima a razão nesses corredores. Declaramos isto desde o início.");
  const H = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: "0F2747" }, fontSize: 14, valign: "middle" } });
  const cell = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 14, valign: "middle", color: "14213D" }, o) });
  const rows = [
    [H("Fonte"), H("O que contém"), H("Papel no cálculo")],
    [cell("TomTom, jan/2020", { bold: true }), cell("385 187 segmentos, 31 239 km; terça a quinta, 7 a 30 de janeiro; 6 horas de ponta"), cell("Velocidade do carro por hora")],
    [cell("OpenStreetMap, 2026", { bold: true }), cell("Vias da AML: 373 925 arestas dirigidas no grafo de carro"), cell("Rede de carro e de caminhada")],
    [cell("GTFS, 2024", { bold: true }), cell("Carris Metropolitana, Carris, Metro de Lisboa, Fertagus; dia de referência: quarta, 15 de maio de 2024"), cell("Tempo de TP")],
    [cell("Geoportal TML", { bold: true }), cell("14 624 hexágonos, 383 zonas, 118 freguesias com população dos Censos 2021"), cell("Zonas e população")],
    [cell("Em falta no GTFS 2024", { bold: true, color: "8F1D1D" }), cell("CP, TCB, Transtejo, Soflusa, Metro Sul do Tejo, Mobi Cascais", { color: "8F1D1D" }), cell("Razão sobrestimada nesses corredores", { color: "8F1D1D" })],
  ];
  s.addTable(rows, { x: 0.5, y: 1.7, w: 12.33, colW: [2.6, 6.63, 3.1], rowH: [0.45, 0.78, 0.65, 0.9, 0.78, 0.65], border: { type: "solid", pt: 0.75, color: "E4E3DF" }, fill: { color: "FFFFFF" }, margin: [0.05, 0.12, 0.05, 0.12], objectName: "Tabela dados" });
}

// ------------------------------------------------------------------ 10. Grafo do carro + validacao
{
  const s = content("Método e cálculos preliminares", "O grafo do carro reproduz o padrão pendular sem calibração",
    "O grafo de carro foi construído a partir do OSM, com 373 925 arestas dirigidas, e o maior componente fortemente conexo tem 97,8% dos nós, ao contrário da rede TomTom, que só dava 66% e partia o Tejo em dois. A cada aresta associámos a velocidade TomTom por correspondência geométrica: 77,3% das arestas têm segmento TomTom. A validação qualitativa mais forte é o padrão pendular: de Seixal para Baixa-Chiado demora mais de manhã, e no sentido contrário demora mais à tarde, sem nenhuma calibração. Não temos verdade terreno independente; a validação é de plausibilidade.");
  stat(s, { x: 0.5, y: 1.65, w: 3.6, h: 1.35, value: "373 925", label: "arestas dirigidas no grafo OSM" });
  stat(s, { x: 0.5, y: 3.15, w: 3.6, h: 1.35, value: "97,8%", label: "dos nós na maior componente conexa (TomTom: 66%)" });
  stat(s, { x: 0.5, y: 4.65, w: 3.6, h: 1.35, value: "77,3%", label: "das arestas com velocidade TomTom medida" });
  s.addChart(pres.charts.LINE, [
    { name: "Seixal para Baixa-Chiado", labels: ["07-08", "08-09", "17-18", "18-19", "19-20"], values: [40.3, 42.1, 32.2, 30.7, 28.1] },
    { name: "Baixa-Chiado para Seixal", labels: ["07-08", "08-09", "17-18", "18-19", "19-20"], values: [24.9, 26.8, 39.9, 44.9, 36.5] },
  ], chartDefaults({ x: 4.4, y: 1.6, w: 8.43, h: 4.5, chartColors: ["256ABF", "D9483B"], lineSize: 3, lineDataSymbolSize: 9, showLegend: true, legendPos: "b", showTitle: true, title: "Tempo de carro (minutos) por hora de partida", showValue: true, dataLabelPosition: "t", dataLabelFormatCode: "0", valAxisMinVal: 15, valAxisMaxVal: 50, valAxisLabelFormatCode: "0" }));
  s.addText("Cenário médio. Sem verdade terreno independente: validação de plausibilidade e de padrão temporal.", { x: 4.4, y: 6.2, w: 8.43, h: 0.5, fontSize: 12, color: GREY, margin: 0, valign: "top", isTextBox: true, objectName: "Nota validacao" });
}

// ------------------------------------------------------------------ 11. TP e troços e populacao
{
  const s = content("Método e cálculos preliminares", "O tempo de TP é calculado porta a porta e por troço, e ponderado por população",
    "Como calculamos o lado do TP. Porta a porta, usamos o r5py, uma interface do motor R5, com TP mais caminhada até 25 minutos, janelas de partida de uma hora por cada hora de ponta e percentis 25, 50 e 75, até 180 minutos. São 383 zonas e 146 306 pares por hora. Por troço, cortamos cada padrão de viagem em troços de pelo menos 1 km, e comparamos o tempo programado com o carro paragem a paragem, com um filtro de qualidade que retira 8,9% das linhas. Por fim, a população de cada freguesia é distribuída pelos hexágonos de forma dasimétrica, pelo comprimento de vias residenciais, para não atribuir população à água.");
  const cw = 3.95, gap = 0.24, y = 1.65, h = 4.95;
  block(s, { x: 0.5, y, w: cw, h, label: "Porta a porta (r5py)", color: C.accent1, fs: 14, gap: 8, items: [
    "TP e caminhada até 25 min, com espera e transbordos.",
    "Janela de partida de 1 h por hora de ponta; mediana e percentis 25 e 75.",
    "Limite de 180 min; 383 zonas, 146 306 pares por hora.",
    "Cobertura: 59,6% dos pares alcançáveis em 180 min.",
  ] });
  block(s, { x: 0.5 + cw + gap, y, w: cw, h, label: "Por troço de linha", color: C.accent2, fs: 14, gap: 8, items: [
    "Cada padrão de viagem cortado em troços de pelo menos 1 km.",
    "TP: tempo programado; carro: caminho mais rápido paragem a paragem.",
    "Filtro de qualidade (desvio, distância à rede, comprimento): retira 8,9%.",
    "59 492 linhas troço x hora, 53 mil validadas.",
  ] });
  block(s, { x: 0.5 + 2 * (cw + gap), y, w: cw, h, label: "População dasimétrica", color: C.accent6, fs: 14, gap: 8, items: [
    "População das freguesias (Censos 2021) distribuída pelos hexágonos.",
    "Peso: comprimento de vias residenciais do OSM.",
    "Total apurado: 2 870 208, igual ao das freguesias.",
    "Usada para ponderar medianas e priorizar zonas.",
  ] });
}

// ------------------------------------------------------------------ 12. Calculos preliminares
{
  const s = content("Método e cálculos preliminares", "Por troço o TP compete, porta a porta perde, e o acesso ao carro pesa",
    "Os cálculos preliminares em resumo. Por troço, a razão mediana é 1,41 e baixa para 1,13 com o carro congestionado. Porta a porta, a razão mediana é 3,5, e só 59,6% dos pares são alcançáveis de TP em 180 minutos. O gráfico à direita é uma sensibilidade: se somarmos 5, 10 ou 15 minutos de acesso e estacionamento ao tempo de carro, o que é realista no centro das cidades, a razão mediana desce de 3,5 para 3,0, 2,6 e 2,3, e a fração de pares com razão abaixo de 2 sobe de 5% para 11%, 20% e 32%. Este parâmetro é a alavanca principal do resultado e deve ser apresentado como parâmetro.");
  stat(s, { x: 0.5, y: 1.65, w: 3.0, h: 1.4, value: "1,41", label: "razão mediana por troço (autocarros)" });
  stat(s, { x: 3.7, y: 1.65, w: 3.0, h: 1.4, value: "1,13", label: "mesma razão com carro congestionado", color: C.accent1 });
  stat(s, { x: 0.5, y: 3.25, w: 3.0, h: 1.4, value: "3,5", label: "razão mediana porta a porta", color: C.accent2, fill: TINT_WARM });
  stat(s, { x: 3.7, y: 3.25, w: 3.0, h: 1.4, value: "59,6%", label: "dos pares alcançáveis de TP em 180 min", color: C.accent2, fill: TINT_WARM });
  s.addText("Troços: autocarros da Carris Metropolitana e da Carris. Porta a porta: 08h às 09h, pares com carro de pelo menos 5 min.", { x: 0.5, y: 4.85, w: 6.2, h: 0.8, fontSize: 12, color: GREY, margin: 0, valign: "top", isTextBox: true, objectName: "Nota calculos" });
  s.addChart(pres.charts.BAR, [{ name: "Razão mediana porta a porta", labels: ["Sem acesso", "+5 min", "+10 min", "+15 min"], values: [3.5, 3.0, 2.6, 2.3] }],
    chartDefaults({ x: 7.0, y: 1.6, w: 5.83, h: 4.3, barDir: "col", chartColors: ["256ABF"], showTitle: true, title: "Razão mediana com acesso e estacionamento do carro", showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showLegend: false, valAxisMinVal: 0, valAxisMaxVal: 4.2, valAxisHidden: true, valGridLine: { style: "none" }, barGapWidthPct: 50 }));
  s.addText("Pares com razão abaixo de 2: 5% sem acesso, 11%, 20% e 32% com +5, +10 e +15 min.", { x: 7.0, y: 6.0, w: 5.83, h: 0.6, fontSize: 14, bold: true, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Nota sensibilidade" });
}

// ------------------------------------------------------------------ 13. Visao geral dos produtos
sec("Como ler os produtos");
{
  const s = content("Como ler os produtos", "Seis classes de razão e oito produtos gráficos",
    "Antes de entrar em cada produto, a legenda comum. As seis classes de razão vão do frio ao quente: abaixo de 1, de 1 a 1,5, de 1,5 a 2, de 2 a 3, de 3 a 4 e acima de 4. A classe abaixo de 1 foi acrescentada aos cinco limiares da proposta inicial para dar as seis classes. Cores frias significam TP competitivo, cores quentes significam TP muito mais lento que o carro. A tabela mostra os oito produtos, a pergunta a que cada um responde e a sua escala. Nos próximos oito slides, cada produto tem três painéis: como ler, o que concluir e cuidado.");
  CLS.forEach((c, i) => {
    s.addShape(pres.ShapeType.rect, { x: 0.5 + i * 2.05, y: 1.62, w: 2.0, h: 0.38, fill: { color: c }, line: { color: c, width: 0 }, objectName: "Classe " + CLS_LAB[i] });
    s.addText(CLS_LAB[i], { x: 0.5 + i * 2.05, y: 1.62, w: 2.0, h: 0.38, fontSize: 14, bold: true, color: i <= 0 || i >= 4 ? "FFFFFF" : "14213D", align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: "Rotulo classe" });
  });
  s.addText("TP competitivo", { x: 0.5, y: 2.05, w: 3, h: 0.28, fontSize: 12, color: GREY, margin: 0, isTextBox: true, objectName: "Extremo frio" });
  s.addText("TP muito mais lento que o carro", { x: 9.33, y: 2.05, w: 3.5, h: 0.28, fontSize: 12, color: GREY, align: "right", margin: 0, isTextBox: true, objectName: "Extremo quente" });
  const H = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: "0F2747" }, fontSize: 13, valign: "middle" } });
  const c = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 13, valign: "middle", color: "14213D" }, o) });
  const rows = [
    [H("Produto"), H("Responde a"), H("Escala")],
    [c("1. Dispersão razão x diferença", { bold: true }), c("Como se relacionam as duas medidas?"), c("Pares de zonas")],
    [c("2. Barras por classe e hora", { bold: true }), c("Que fração fica em cada classe, e como muda com a hora e o carro?"), c("Pares e troços")],
    [c("3. Perfil horário das linhas", { bold: true }), c("Como varia a competitividade de cada linha ao longo do dia?"), c("Linha")],
    [c("4. Barras por classe, por linha", { bold: true }), c("Onde dentro de cada linha ganha ou perde?"), c("Linha")],
    [c("5. Mapa de zonas: razão e diferença", { bold: true }), c("Que territórios sofrem mais?"), c("Zona")],
    [c("6. Mapa de grupos de prioridade", { bold: true }), c("Onde agir primeiro?"), c("Zona")],
    [c("7. Mapa de linhas na AML", { bold: true }), c("Que troços competem e quais não?"), c("Troço de linha")],
    [c("8. Mapa de linhas em Lisboa", { bold: true }), c("O mesmo, no detalhe da cidade."), c("Troço de linha")],
  ];
  s.addTable(rows, { x: 0.5, y: 2.5, w: 12.33, colW: [4.2, 6.1, 2.03], rowH: 0.46, border: { type: "solid", pt: 0.75, color: "E4E3DF" }, fill: { color: "FFFFFF" }, margin: [0.03, 0.12, 0.03, 0.12], objectName: "Tabela produtos" });
}

// -------- helpers para slides de produto
function productB(num, title, file, notes, lerItems, concItems, cuidItems, extra) {
  const s = content(`Como ler os produtos | ${num} de 8`, title, notes);
  const maxH = 3.3;
  const pos = img(s, file, 0.5, 1.38, 12.33, maxH, "center");
  if (extra) extra(s, pos);
  const y = 4.85, h = 2.15;
  block(s, { x: 0.5, y, w: 3.6, h, label: "Como ler", color: C.accent1, items: lerItems, fs: 14, gap: 3 });
  block(s, { x: 4.3, y, w: 4.9, h, label: "O que concluir", color: C.text2, items: concItems, fs: 14, gap: 3 });
  block(s, { x: 9.4, y, w: 3.43, h, label: "Cuidado", color: C.accent6, items: cuidItems, fs: 14, gap: 3, fill: TINT_WARM });
  return s;
}
function productA(num, title, file, notes, lerItems, concItems, cuidItems, { figW, figH, panelW }) {
  const s = content(`Como ler os produtos | ${num} de 8`, title, notes);
  const pos = img(s, file, 0.5, 1.45, figW, figH);
  const px = 0.5 + figW + 0.3, pw = 12.83 - px;
  // painel direito: ler + concluir; cuidado por baixo da figura
  block(s, { x: px, y: 1.45, w: pw, h: 2.15, label: "Como ler", color: C.accent1, items: lerItems, fs: 14, gap: 3 });
  block(s, { x: px, y: 3.75, w: pw, h: 3.2, label: "O que concluir", color: C.text2, items: concItems, fs: 14, gap: 3 });
  const cy = pos.y + pos.h + 0.2;
  block(s, { x: 0.5, y: cy, w: figW, h: 6.95 - cy, label: "Cuidado", color: C.accent6, items: cuidItems, fs: 14, gap: 3, fill: TINT_WARM });
  return s;
}

// ------------------------------------------------------------------ 14. fig1
productB(1, "Razão e diferença sobem juntas, mas dizem coisas diferentes", "fig1_dispersao_ratio_diferenca.png",
  "Primeiro produto: a dispersão. Cada ponto é um par origem-destino de zonas, numa quarta-feira às 8h. À esquerda, o eixo horizontal é a razão, em escala logarítmica, o vertical é a diferença em minutos e a cor é a classe de razão. À direita, o tempo de carro contra o tempo de TP, com retas de razão 1, 2, 3 e 4. O que concluir: quase nenhum par fica abaixo de razão 1, a nuvem sobe com a razão, e para uma mesma razão a diferença varia muito com a duração da viagem. Cuidado: o teto da nuvem é o limite de 180 minutos do cálculo, não uma propriedade do sistema.",
  ["Cada ponto é um par origem-destino.", "Cor: classe de razão. Quanto mais à direita, mais lento o TP.", "Quanto mais acima, mais minutos perdidos."],
  ["Quase nenhum par abaixo de 1: só 0,7% entre 1 e 1,5.", "36% dos pares acima de 4 e 34% entre 3 e 4.", "Mesma razão, custos diferentes: a diferença depende da duração da viagem."],
  ["O teto da nuvem (180 min) é o limite do cálculo; pares sem TP em 180 min não aparecem."],
  (s, pos) => {
    stat(s, { x: 0.5, y: 1.55, w: 1.9, h: 1.5, value: "88 444", label: "pares de zonas, 08h-09h", vs: 24, ls: 12 });
    stat(s, { x: 10.93, y: 1.55, w: 1.9, h: 1.5, value: "36%", label: "dos pares com razão acima de 4", vs: 28, ls: 12, color: C.accent6, fill: TINT_WARM });
  });

// ------------------------------------------------------------------ 15. fig2
productB(2, "Porta a porta o TP raramente compete; por troço, compete", "fig2_classes_por_hora.png",
  "Segundo produto: barras por classe de razão, por hora de ponta. Em A, porta a porta, a % dos pares por classe; em B, a % da distância dos troços de autocarro; em C, a mesma coisa em três cenários de carro. A leitura: porta a porta, entre 61% e 82% dos pares ficam acima de razão 3 conforme a hora; por troço, 19% da distância tem razão abaixo de 1 de manhã e 25% à tarde, e com o carro congestionado esses valores sobem para 39% e 46%. Cuidado: A conta pares, B e C pesam pela distância, por isso não se comparam diretamente os valores.",
  ["Cada barra soma 100% numa hora de ponta.", "Cores frias: TP competitivo; quentes: TP lento.", "C compara carro fluido, médio e congestionado."],
  ["Porta a porta, 61% a 82% dos pares ficam acima de 3.", "Por troço, 19% (manhã) a 25% (tarde) da distância está abaixo de 1.", "Com carro congestionado, 39% (manhã) e 46% (tarde)."],
  ["A mede pares; B e C medem distância. Não comparar os valores diretamente."]);

// ------------------------------------------------------------------ 16. fig3
productB(3, "As linhas têm perfis horários distintos de competitividade", "fig3_perfil_linhas.png",
  "Terceiro produto: o perfil de competitividade das linhas ao longo do dia. Cada linha é uma série de seis pontos, as seis horas de ponta; o eixo vertical é a razão agregada da linha, e quanto mais baixo, mais competitiva. Em A, os autocarros mais competitivos, com razão entre 0,8 e 1,15, mínimo na ponta da tarde, porque o carro piora. Em B, os menos competitivos, com razão entre 1,7 e 2,7 e muita oscilação, o que evidencia dependência da congestão. Em C, metro e Fertagus, com razão entre 0,33 e 0,52. Cuidado: os eixos verticais são diferentes em cada painel.",
  ["Cada linha é uma série de seis horas de ponta.", "Eixo vertical: razão da linha. Mais baixo é melhor.", "A: mais competitivas; B: menos; C: metro e Fertagus."],
  ["Autocarros de referência: razão entre 0,8 e 1,15, melhor às 18h.", "Menos competitivos: 1,7 a 2,7, com oscilações fortes.", "Metro e Fertagus: 0,33 a 0,52, quase sem variação."],
  ["Eixos verticais diferentes por painel: não comparar alturas. Só linhas com 8 km ou mais."]);

// ------------------------------------------------------------------ 17. fig4
productA(4, "A razão agregada esconde onde cada linha ganha ou perde", "fig4_barras_classes_linhas.png",
  "Quarto produto: o perfil de cada linha por classe de razão. Cada barra é uma linha, e os segmentos mostram a fração da distância em cada classe; à direita está a razão agregada. As seis de cima são as mais competitivas, com 46% a 70% da distância na classe abaixo de 1. As seis de baixo são as menos competitivas, com quase nada abaixo de 1 e a classe de 2 a 3 a dominar, por exemplo 61% na linha 1211 e 58% na 3515. Duas linhas com a mesma razão agregada podem ter problemas muito diferentes: a 4403 tem 31% da distância acima de 3, concentrados em poucos troços. Cuidado: só linhas com 8 km ou mais e duas viagens por hora.",
  ["Uma barra por linha; segmentos: % da distância por classe.", "À direita, a razão agregada da linha.", "Em cima, as 6 mais competitivas; em baixo, as 6 menos."],
  ["As de referência têm 46% a 70% da distância abaixo de 1.", "As lentas têm a classe 2 a 3 a dominar (61% na 1211, 58% na 3515).", "A 4403 tem 31% da distância acima de 3: problema concentrado."],
  ["Só linhas com 8 km ou mais e pelo menos 2 viagens por hora; média das 6 horas."],
  { figW: 7.0, figH: 4.5, panelW: 5.0 });

// ------------------------------------------------------------------ 18. mapa1
productA(5, "Fora do centro de Lisboa, quase toda a AML tem razão acima de 3", "mapa1_zonas_ratio_diferenca.png",
  "Quinto produto: o perfil territorial. Em cada mapa, cada zona de origem é colorida pela mediana da razão (A) e da diferença em minutos (B), ponderada pela população das zonas de destino. As zonas tracejadas não têm TP alcançável em 180 minutos. O que concluir: só o centro de Lisboa e partes do arco Seixal-Almada-Setúbal descem para as classes mais frias, e a diferença abaixo de 55 minutos concentra-se no centro de Lisboa. Por concelho, os piores são Cascais com 5,6, Palmela 4,9 e Mafra 4,6. Cuidado: zonas rurais grandes têm um ponto único, e a ausência da CP e de outros operadores sobrestima a razão em Sintra, Cascais e Amadora.",
  ["Cor: razão mediana a partir de cada zona de origem (A) e diferença em minutos (B).", "Tracejado: sem TP alcançável em 180 min."],
  ["Só o centro de Lisboa e partes do arco Seixal-Almada baixam para classes mais frias.", "Diferença abaixo de 55 min quase só no centro de Lisboa.", "Concelhos com pior razão: Cascais 5,6, Palmela 4,9, Mafra 4,6."],
  ["Zonas rurais grandes têm um ponto único. Sem CP, a razão em Sintra, Cascais e Amadora está sobrestimada."],
  { figW: 8.2, figH: 4.5, panelW: 4.1 });

// ------------------------------------------------------------------ 19. mapa2
productA(6, "Seis grupos de zonas orientam onde agir primeiro", "mapa2_zonas_grupos.png",
  "Sexto produto: os grupos de prioridade. Dentro das zonas populosas, isto é, com população acima da mediana de 5 873 habitantes, separamos tercis da razão. O tercil mais alto é a prioridade alta: 55 zonas, 728 mil habitantes, razão 4,3 e diferença de 90 minutos. O tercil mais baixo é a oportunidade rápida: 58 zonas, 648 mil habitantes, razão 3,2, sobretudo no centro de Lisboa e no arco Seixal, Almada e Setúbal. Há ainda 62 zonas com cobertura limitada ou sem TP alcançável. Os números no mapa são as oito zonas populosas com maior desvantagem. Cuidado: os grupos são relativos, definidos por tercis, e a prioridade alta em Sintra, Cascais e Amadora é em parte efeito dos dados em falta.",
  ["Cada zona num de seis grupos, definidos por população e razão.", "Tercis da razão entre as zonas populosas (mais de 5 873 habitantes).", "Números: 8 zonas com maior desvantagem (população x diferença)."],
  ["Prioridade alta: 55 zonas, 728 mil habitantes, razão 4,3, diferença 90 min.", "Oportunidade rápida: 58 zonas, 648 mil, razão 3,2, no centro de Lisboa e no arco Seixal-Almada-Setúbal.", "62 zonas com cobertura limitada ou sem TP alcançável (285 mil)."],
  ["Grupos relativos (tercis). A prioridade alta em Sintra, Cascais e Amadora reflete em parte os dados em falta da CP."],
  { figW: 5.9, figH: 5.5, panelW: 6.3 });

// ------------------------------------------------------------------ 20. mapa3
productA(7, "Os troços competitivos seguem os eixos rápidos", "mapa3_linhas_AML.png",
  "Sétimo produto: o mapa de linhas na AML. Cada troço de cerca de 1 km é colorido pela razão entre o tempo programado do TP e o tempo de carro entre as mesmas paragens, e a espessura é a frequência, em viagens por hora. À esquerda a manhã das 8h às 9h, à direita a tarde das 18h às 19h. O que concluir: os troços a azul, mais competitivos, seguem eixos rápidos como a A8, o IC e as pontes; os vermelhos concentram-se na malha urbana densa de Lisboa e das margens. Da manhã para a tarde mais troços passam para classes mais frias, porque o carro piora. Cuidado: o mapa mostra tempos programados, sem CP, TCB nem fluvial.",
  ["Cor: razão do troço (cerca de 1 km). Espessura: viagens por hora.", "A: manhã, 8h às 9h. B: tarde, 18h às 19h."],
  ["Azul: eixos rápidos (A8, IC, pontes), onde o TP já compete.", "Vermelho: malha urbana densa de Lisboa e das margens.", "Da manhã para a tarde mais troços passam para classes frias."],
  ["Tempos programados, sem CP, TCB nem fluvial. Autocarro, metro e comboio no mesmo mapa."],
  { figW: 8.2, figH: 4.5, panelW: 4.1 });

// ------------------------------------------------------------------ 21. mapa4
productA(8, "Em Lisboa, os troços grossos e quentes pedem corredor", "mapa4_linhas_Lisboa.png",
  "Oitavo produto: o mesmo mapa ampliado em Lisboa. O truque de leitura é combinar cor e espessura. Um troço grosso e azul é muita oferta com bom desempenho: é o que deve ser protegido. Um troço fino e quente é pouca oferta com mau desempenho, provavelmente menos prioritário. Um troço grosso e quente é muita oferta e muita lentidão: é onde um corredor bus, prioridade semafórica ou revisão de paragens rendem mais. A travessia do Tejo pela ponte aparece a azul. Cuidado: o carro vai pelo caminho mais rápido, não pelo traçado do autocarro, e cerca de 9% dos troços foram descartados no controlo de qualidade.",
  ["Cor e espessura juntas: razão do troço e viagens por hora.", "Comparar manhã (A) e tarde (B) no mesmo troço."],
  ["Grosso e azul: muita oferta e bom desempenho, a proteger.", "Grosso e quente: muita oferta e lentidão, o melhor candidato a corredor ou prioridade semafórica.", "Fino e quente: menos prioritário."],
  ["O carro segue o caminho mais rápido, não o traçado do autocarro; 9% dos troços descartados."],
  { figW: 8.2, figH: 4.5, panelW: 4.1 });

// ------------------------------------------------------------------ 22. Resultados: zonas
sec("Resultados");
{
  const s = content("Resultados", "55 zonas populosas, 728 mil habitantes, merecem atenção primeiro",
    "Primeiro resultado-síntese: que zonas precisam de maior atenção. A tabela agrupa as 383 zonas. A prioridade alta tem 55 zonas e 728 mil habitantes, razão 4,3 e diferença mediana de 90 minutos. Por concelho, Sintra tem 248 mil habitantes em zonas deste grupo, Cascais 150 mil, Amadora 78 mil, Vila Franca de Xira 54 mil e Oeiras 49 mil. O aviso essencial: Sintra, Cascais, Amadora, Oeiras e Vila Franca de Xira são corredores da CP, que não está no GTFS de 2024, por isso esta lista é provisória. A conclusão robusta do pitch é o método; a lista só vira conclusão operacional com os dados completos.");
  const H = (t, a = "left") => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: "0F2747" }, fontSize: 13, valign: "middle", align: a } });
  const c = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 13, valign: "middle", color: "14213D" }, o) });
  const r = (t, o = {}) => c(t, Object.assign({ align: "right" }, o));
  const rows = [
    [H("Grupo de zonas"), H("Zonas", "right"), H("População", "right"), H("Razão", "right"), H("Diferença", "right")],
    [c("Prioridade alta (populosa)", { bold: true, color: "8F1D1D" }), r("55"), r("728 mil"), r("4,3"), r("90 min")],
    [c("Intermédia (populosa)"), r("59"), r("711 mil"), r("3,7"), r("70 min")],
    [c("Oportunidade rápida (populosa)", { bold: true, color: "256ABF" }), r("58"), r("648 mil"), r("3,2"), r("63 min")],
    [c("Estrutural (pouca população)"), r("147"), r("498 mil"), r("3,8"), r("82 min")],
    [c("Cobertura limitada (< 30%)"), r("31"), r("118 mil"), r("5,4"), r("121 min")],
    [c("Sem TP alcançável em 180 min"), r("31"), r("167 mil"), r("n.d."), r("n.d.")],
  ];
  s.addTable(rows, { x: 0.5, y: 1.65, w: 7.6, colW: [3.2, 0.9, 1.3, 1.0, 1.2], rowH: 0.5, border: { type: "solid", pt: 0.75, color: "E4E3DF" }, fill: { color: "FFFFFF" }, margin: [0.03, 0.1, 0.03, 0.1], objectName: "Tabela grupos" });
  s.addChart(pres.charts.BAR, [{ name: "População em zonas de prioridade alta (milhares)", labels: ["Sintra", "Cascais", "Amadora", "Vila Franca de Xira", "Oeiras"], values: [248, 150, 78, 54, 49] }],
    chartDefaults({ x: 8.4, y: 1.55, w: 4.43, h: 3.7, barDir: "bar", chartColors: ["D9483B"], showTitle: true, title: "Prioridade alta por concelho (milhares de habitantes)", titleFontSize: 13, showValue: true, dataLabelPosition: "outEnd", showLegend: false, valAxisHidden: true, valGridLine: { style: "none" }, catAxisOrientation: "maxMin", barGapWidthPct: 40, valAxisMinVal: 0, valAxisMaxVal: 300 }));
  card(s, 0.5, 5.4, 12.33, 1.35, TINT_WARM, "Aviso CP");
  s.addText([
    { text: "Aviso: ", options: { bold: true, color: C.accent6 } },
    { text: "Sintra, Cascais, Amadora, Oeiras e Vila Franca de Xira são corredores da CP, ausente do GTFS 2024. A lista é provisória; o que a prova de conceito demonstra é o método.", options: { color: C.text1 } },
  ], { x: 0.7, y: 5.5, w: 11.9, h: 1.15, fontSize: 16, margin: 0, valign: "middle", isTextBox: true, objectName: "Texto aviso" });
}

// ------------------------------------------------------------------ 23. concelhos
{
  const s = content("Resultados", "Cascais, Palmela e Mafra têm a pior razão média por concelho",
    "Segundo resultado: a razão média por concelho, ponderada pela população das zonas. Os piores são Cascais com 5,6, Palmela com 4,9, Mafra com 4,6, Alcochete e Sintra com 4,4 e Vila Franca de Xira com 4,3. Os melhores são Sesimbra e Seixal com 3,2, Lisboa com 3,3 e Almada com 3,4. As barras seguem a mesma paleta de classes: vermelho para a classe de 3 a 4 e vermelho escuro para acima de 4. Atenção: Cascais, Oeiras, Sintra, Amadora e Vila Franca de Xira estão sobrestimados por falta da CP, e o Barreiro por falta de TCB e fluvial.");
  const m = [["Cascais", 5.59], ["Palmela", 4.94], ["Mafra", 4.60], ["Alcochete", 4.44], ["Sintra", 4.43], ["Vila Franca de Xira", 4.26], ["Montijo", 4.01], ["Amadora", 4.03], ["Oeiras", 3.96], ["Loures", 3.92], ["Moita", 3.69], ["Odivelas", 3.68], ["Setúbal", 3.55], ["Barreiro", 3.51], ["Almada", 3.37], ["Lisboa", 3.31], ["Seixal", 3.20], ["Sesimbra", 3.19]].sort((a, b) => b[1] - a[1]);
  s.addChart(pres.charts.BAR, [{ name: "Razão média por concelho", labels: m.map((x) => x[0]), values: m.map((x) => x[1]) }],
    chartDefaults({ x: 0.5, y: 1.5, w: 7.6, h: 5.4, barDir: "bar", chartColors: m.map((x) => (x[1] >= 4 ? "8F1D1D" : "D9483B")), showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showLegend: false, valAxisHidden: true, valGridLine: { style: "none" }, catAxisOrientation: "maxMin", barGapWidthPct: 35, valAxisMinVal: 0, valAxisMaxVal: 6.5, catAxisLabelFontSize: 12 }));
  block(s, { x: 8.4, y: 1.55, w: 4.43, h: 2.7, label: "O que concluir", color: C.text2, fs: 14, gap: 4, items: [
    "Pior razão: Cascais 5,6, Palmela 4,9, Mafra 4,6.",
    "Melhor razão: Sesimbra e Seixal 3,2, Lisboa 3,3, Almada 3,4.",
    "Razão ponderada pela população das zonas.",
  ] });
  block(s, { x: 8.4, y: 4.4, w: 4.43, h: 2.45, label: "Cuidado", color: C.accent6, fs: 14, gap: 4, fill: TINT_WARM, items: [
    "Sem CP: Cascais, Oeiras, Sintra, Amadora e V. F. de Xira sobrestimados.",
    "Sem TCB e fluvial: Barreiro sobrestimado.",
  ] });
}

// ------------------------------------------------------------------ 24. Espaco de melhoria
{
  const s = content("Resultados", "O maior espaço para melhorar está nas zonas onde o TP já está perto do carro",
    "Terceiro resultado: onde há mais espaço para melhorar e atrair clientes. As 58 zonas de oportunidade rápida, com 648 mil habitantes e razão mediana 3,2, concentram-se no centro de Lisboa e no arco Seixal, Almada e Setúbal. Um ganho de frequência ou de velocidade comercial pode levar muitas viagens para a classe seguinte, e 26% dos pares estão entre razão 2 e 3. Com 10 minutos de acesso e estacionamento no carro, a razão mediana desce de 3,5 para 2,6 e os pares abaixo de 2 sobem de 5% para 20%; no centro de Lisboa, o TP já está no limiar de competir. Já as zonas com razão igual ou acima de 4, cerca de 1,08 milhões de habitantes, precisam de mudança estrutural.");
  stat(s, { x: 0.5, y: 1.65, w: 3.0, h: 1.9, value: "58", label: "zonas de oportunidade rápida: 648 mil habitantes, razão 3,2", color: C.accent1, fill: TINT_BLUE, vs: 44 });
  stat(s, { x: 3.7, y: 1.65, w: 3.0, h: 1.9, value: "26%", label: "dos pares porta a porta com razão entre 2 e 3", color: C.accent1, fill: TINT_BLUE, vs: 44 });
  stat(s, { x: 6.9, y: 1.65, w: 3.0, h: 1.9, value: "5% a 20%", label: "pares com razão abaixo de 2 se o carro somar 10 min de acesso", color: C.accent1, fill: TINT_BLUE, vs: 30 });
  stat(s, { x: 10.1, y: 1.65, w: 2.73, h: 1.9, value: "1,08 M", label: "habitantes em zonas com razão igual ou acima de 4", color: C.accent6, fill: TINT_WARM, vs: 34 });
  block(s, { x: 0.5, y: 3.8, w: 6.06, h: 3.0, label: "Onde", color: C.text2, fs: 14, gap: 6, items: [
    "Centro de Lisboa (zonas com razão 2,5 a 2,9, alcançam quase 90% da população da AML em 180 min).",
    "Arco Seixal, Almada e Setúbal (por exemplo, zona 346 em Seixal, razão 2,8).",
  ] });
  block(s, { x: 6.77, y: 3.8, w: 6.06, h: 3.0, label: "Que alavancas", color: C.accent1, fs: 14, gap: 6, items: [
    "Frequência e velocidade comercial levam pares da classe 2-3 para abaixo de 2.",
    "Estacionamento difícil aproxima o TP do carro: parametrizar por zona.",
    "Zonas com razão igual ou acima de 4 pedem cobertura e frequência, não ajustes.",
  ] });
}

// ------------------------------------------------------------------ 25. Linhas
{
  const s = content("Resultados", "Há linhas de referência, linhas a rever e linhas a reforçar",
    "Quarto resultado: as linhas. Entre as 914 linhas com pelo menos 3 km, definimos três grupos. As 11 linhas de referência têm razão abaixo de 1 e pelo menos duas viagens por hora, por exemplo a 4701 Oriente a Vale da Amoreira Expresso, com 0,70. As 17 linhas lentas e frequentes têm razão de 1,8 ou mais e pelo menos três viagens por hora, por exemplo a 3101 Amora com 2,46 e a 1211 Belas a Agualva-Cacém com 2,38: são os melhores candidatos a corredor bus, prioridade semafórica e revisão de paragens. As 27 linhas rápidas mas pouco frequentes são candidatas a reforço de frequência, porque o que falha é a espera. O metro e a Fertagus têm razão por troço de 0,3 a 0,6.");
  const cw = 3.95, gap = 0.24, y = 1.65, h = 4.95;
  block(s, { x: 0.5, y, w: cw, h, label: "11 linhas de referência", color: C.accent1, fs: 14, gap: 6, fill: TINT_BLUE, items: [
    "Razão abaixo de 1 e pelo menos 2 viagens por hora.",
    "4701 Oriente a Vale da Amoreira (0,70); 1107 Algés a Queluz (0,77); 2327 Póvoa de Santa Iria (0,90).",
    "Usam eixos rápidos e têm paragens espaçadas: proteger e replicar.",
  ] });
  block(s, { x: 0.5 + cw + gap, y, w: cw, h, label: "17 lentas e frequentes", color: C.accent6, fs: 14, gap: 6, fill: TINT_WARM, items: [
    "Razão de 1,8 ou mais e pelo menos 3 viagens por hora.",
    "3101 Amora (2,46); 1211 Belas a Agualva-Cacém (2,38); 49B Carris (2,11).",
    "Candidatas a corredor bus, prioridade semafórica e revisão de paragens.",
  ] });
  block(s, { x: 0.5 + 2 * (cw + gap), y, w: cw, h, label: "27 rápidas, pouco frequentes", color: C.text2, fs: 14, gap: 6, items: [
    "Razão abaixo de 1, menos de 2 viagens por hora.",
    "O tempo de percurso já compete; o que falha é a espera.",
    "Candidatas a reforço de frequência.",
  ] });
}

// ------------------------------------------------------------------ 26. Limitacoes
sec("Transparência");
{
  const s = content("Transparência", "Declaramos as limitações desde o início: é uma prova de conceito",
    "Limitações, sem rodeios. Faltam CP, TCB, Transtejo, Soflusa, Metro Sul e Mobi Cascais no GTFS de 2024, o que sobrestima a razão em Cascais, Sintra, Amadora, Oeiras, Vila Franca de Xira e Barreiro. O TomTom é de janeiro de 2020, antes da COVID. Cada zona usa um só ponto representativo, o que distorce zonas rurais grandes. A população é uma estimativa dasimétrica. Os grupos usam tercis da própria amostra e por isso são relativos. Os tempos de TP são programados, sem atrasos, e o carro não inclui acesso e estacionamento por defeito. Não há verdade terreno independente.");
  const items = [
    ["Operadores em falta", "CP, TCB, Transtejo, Soflusa, Metro Sul e Mobi Cascais: razão sobrestimada nesses corredores."],
    ["Dados de datas diferentes", "TomTom jan/2020 (terça a quinta), GTFS 2024, OSM 2026."],
    ["Ponto único por zona", "Zonas grandes e rurais (até 228 km2) distorcem pares curtos."],
    ["População estimada", "Dasimétrica a partir das freguesias (Censos 2021)."],
    ["Grupos relativos", "Tercis da própria amostra, não limiares absolutos."],
    ["Tempos programados", "Sem atrasos; carro sem acesso e estacionamento por defeito; sem verdade terreno."],
  ];
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * (3.95 + 0.24), y = 1.65 + row * 2.6;
    card(s, x, y, 3.95, 2.45, i === 0 ? TINT_WARM : TINT, "Limitacao " + (i + 1));
    s.addText(it[0], { x: x + 0.2, y: y + 0.15, w: 3.55, h: 0.4, fontSize: 18, bold: true, color: i === 0 ? C.accent6 : C.text2, margin: 0, isTextBox: true, objectName: "Titulo limitacao" });
    s.addText(it[1], { x: x + 0.2, y: y + 0.65, w: 3.55, h: 1.65, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto limitacao" });
  });
}

// ------------------------------------------------------------------ 27. Estudo completo e pedido de dados
{
  const s = content("Transparência", "Um estudo completo precisa de dados novos, e é isso que pedimos",
    "O que muda entre a prova de conceito e o estudo completo, e o que pedimos à TML. Os dados do carro passam de TomTom de janeiro de 2020 para TomTom atual com vários time sets, num mês fora das férias. O TP passa dos quatro operadores do GTFS de 2024 para todos os operadores, com arquivo de feeds e, quando possível, GTFS em tempo real. O dia de referência passa a vários dias e meses. Com isto, os grupos e as listas passam a conclusões operacionais, e podemos incluir acesso e estacionamento do carro por zona. Se a TML gostar da prova de conceito, pedimos os dados novos e corremos o estudo a sério.");
  const H = (t) => ({ text: t, options: { bold: true, color: "FFFFFF", fill: { color: "0F2747" }, fontSize: 14, valign: "middle" } });
  const c = (t, o = {}) => ({ text: t, options: Object.assign({ fontSize: 14, valign: "middle", color: "14213D" }, o) });
  const rows = [
    [H("Dimensão"), H("Prova de conceito"), H("Estudo completo")],
    [c("Carro", { bold: true }), c("TomTom jan/2020, 6 horas de ponta"), c("TomTom atual, vários time sets, mês fora de férias")],
    [c("Transporte público", { bold: true }), c("GTFS 2024: Carris Metropolitana, Carris, Metro, Fertagus"), c("Todos os operadores (CP, TCB, fluvial, Metro Sul, Mobi Cascais) e arquivo de feeds")],
    [c("Tempo real", { bold: true }), c("Horários programados"), c("GTFS em tempo real: atrasos e regularidade")],
    [c("Dia de referência", { bold: true }), c("Quarta-feira, 15 de maio de 2024"), c("Vários dias úteis e meses")],
    [c("Acesso do carro", { bold: true }), c("Parâmetro de sensibilidade (+5, +10, +15 min)"), c("Acesso e estacionamento por zona")],
    [c("Resultado", { bold: true }), c("Método demonstrado; listas provisórias"), c("Listas e prioridades operacionais")],
  ];
  s.addTable(rows, { x: 0.5, y: 1.65, w: 12.33, colW: [2.4, 4.8, 5.13], rowH: [0.45, 0.65, 0.85, 0.6, 0.6, 0.65, 0.65], border: { type: "solid", pt: 0.75, color: "E4E3DF" }, fill: { color: "FFFFFF" }, margin: [0.05, 0.12, 0.05, 0.12], objectName: "Tabela estudo completo" });
}

// ------------------------------------------------------------------ 28. Aplicabilidades: planeamento
sec("Aplicabilidades");
{
  const s = content("Aplicabilidades", "No planeamento, a razão e a diferença orientam onde investir",
    "Primeiro bloco de aplicabilidades: o planeamento dos sistemas. Corredores bus e prioridade semafórica nos troços grossos e quentes; revisão de paragens e traçados nas linhas lentas; reforço de frequência onde o tempo de percurso compete mas a espera falha; desenho de rede e de interfaces de transbordo, porque a diferença porta a porta é dominada por espera e transbordos; monitorização de indicadores ao longo do tempo; avaliação ex-ante de medidas, simulando uma mudança e vendo a razão e a diferença; priorização do investimento por população afetada; e ligação à política de estacionamento, porque o acesso do carro desloca a razão. Estas aplicações são possíveis porque o método devolve números comparáveis por linha, zona e hora.");
  const items = [
    ["Corredores e prioridade", "Corredores bus e prioridade semafórica nos troços de muita oferta e razão alta."],
    ["Paragens e traçados", "Rever paragens e traçados das linhas lentas e frequentes."],
    ["Frequência", "Reforçar onde o tempo de percurso compete mas a espera falha."],
    ["Rede e interfaces", "Desenhar rede e transbordos: a diferença porta a porta vem da espera e dos transbordos."],
    ["Monitorização", "Acompanhar razão e diferença por linha e por zona como indicadores ao longo do tempo."],
    ["Avaliação ex-ante", "Simular uma medida e ver quantos pares mudam de classe."],
    ["Investimento por população", "Priorizar zonas por população x diferença, não só por razão."],
    ["Política de estacionamento", "Ligar à oferta de estacionamento: +10 min no carro baixa a razão de 3,5 para 2,6."],
  ];
  items.forEach((it, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const w = 2.93, x = 0.5 + col * (w + 0.2), y = 1.65 + row * 2.6;
    card(s, x, y, w, 2.45, i % 2 === 0 ? TINT : TINT_BLUE, "Aplicacao " + (i + 1));
    s.addText(String(i + 1), { x: x + 0.18, y: y + 0.12, w: 0.5, h: 0.45, fontSize: 24, bold: true, fontFace: "Cambria", color: C.accent1, margin: 0, isTextBox: true, objectName: "Numero" });
    s.addText(it[0], { x: x + 0.7, y: y + 0.12, w: w - 0.85, h: 0.5, fontSize: 15, bold: true, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Titulo aplicacao" });
    s.addText(it[1], { x: x + 0.18, y: y + 0.75, w: w - 0.36, h: 1.6, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto aplicacao" });
  });
}

// ------------------------------------------------------------------ 29. Aplicabilidades: informacao ao cliente
{
  const s = content("Aplicabilidades", "Ao cliente, o mesmo indicador pode dizer quanto o TP compete hoje",
    "Segundo bloco: informação ao cliente. O mesmo indicador que orienta o planeamento pode ser mostrado ao passageiro. Um indicador de competitividade por linha ou por par origem-destino, publicável na app. Um comparador porta a porta TP contra carro, com tempos e custo de tempo. Mensagens de tempo ganho, por exemplo, nesta hora o autocarro compete ou ganha ao carro neste percurso. Com GTFS em tempo real, a informação passa a refletir o dia concreto. E para comunicação de campanhas e atração de novos clientes, os pares e as horas em que o TP já compete são os melhores argumentos, porque são verdadeiros.");
  const items = [
    ["Indicador na app", "Competitividade por linha e por par origem-destino, em linguagem simples."],
    ["Comparador porta a porta", "TP contra carro para o percurso do passageiro, na hora em que vai viajar."],
    ["Mensagens de tempo ganho", "Quando o TP compete ou ganha ao carro, dizê-lo com o valor em minutos."],
    ["Informação em tempo real", "Com GTFS em tempo real, a comparação reflete atrasos e congestão do dia."],
    ["Campanhas e novos clientes", "Mostrar os pares e as horas em que o TP já compete; atrair quem hoje usa o carro."],
    ["Transparência", "Publicar o método e as limitações reforça a confiança no indicador."],
  ];
  items.forEach((it, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = 0.5 + col * (3.95 + 0.24), y = 1.65 + row * 2.6;
    card(s, x, y, 3.95, 2.45, i % 2 === 0 ? TINT_BLUE : TINT, "Cliente " + (i + 1));
    s.addText(it[0], { x: x + 0.2, y: y + 0.15, w: 3.55, h: 0.4, fontSize: 18, bold: true, color: C.text2, margin: 0, isTextBox: true, objectName: "Titulo cliente" });
    s.addText(it[1], { x: x + 0.2, y: y + 0.65, w: 3.55, h: 1.65, fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: "Texto cliente" });
  });
}

// ------------------------------------------------------------------ 30. Proximos passos e mapa interativo
{
  const s = content("Próximos passos", "Próximos passos e mapa interativo para explorar os resultados",
    "Fecho. Há um mapa web interativo, na pasta site, para publicar em GitHub Pages, com filtros por concelho, grupo, hora e classe de razão, com seleção por áreas e por linhas, e com gráficos que respondem à seleção. O gráfico de dispersão cruza a razão entre tempos com a diferença absoluta, e o tamanho de cada ponto é a população da zona, para ver quem sofre mais com cada condição. Os próximos passos: se a TML gostar, pedir TomTom atual, GTFS de todos os operadores e arquivo de feeds, correr o estudo completo, e definir com a TML os limiares das classes e dos indicadores para a app.", "CLOSING_DARK");
  const cw = 5.95;
  card(s, 0.5, 1.65, cw, 5.0, "163A66", "Proximos passos");
  s.addText("PRÓXIMOS PASSOS", { x: 0.75, y: 1.8, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: C.accent3, charSpacing: 1.5, margin: 0, isTextBox: true, objectName: "Rotulo passos" });
  s.addText([
    "Validar com a TML os limiares e os indicadores a publicar.",
    "Pedir TomTom atual, GTFS de todos os operadores e arquivo de feeds.",
    "Repetir o estudo com dados completos e vários dias.",
    "Parametrizar acesso e estacionamento do carro por zona.",
    "Ligar a GTFS em tempo real quando existir.",
  ].map((t, i, a) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < a.length - 1, paraSpaceAfter: 8 } })), { x: 0.75, y: 2.2, w: 5.45, h: 4.3, fontSize: 16, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "Lista passos" });
  card(s, 6.88, 1.65, cw, 5.0, "163A66", "Mapa interativo");
  s.addText("MAPA INTERATIVO", { x: 7.13, y: 1.8, w: 5.4, h: 0.3, fontSize: 12, bold: true, color: C.accent3, charSpacing: 1.5, margin: 0, isTextBox: true, objectName: "Rotulo mapa" });
  s.addText([
    "Mapa web na pasta site/, a publicar em GitHub Pages.",
    "Filtros por concelho, grupo, hora e classe de razão.",
    "Seleção por áreas e por linhas, com gráficos que respondem à seleção.",
    "Dispersão razão x diferença, com o tamanho do ponto dado pela população da zona.",
  ].map((t, i, a) => ({ text: t, options: { bullet: { indent: 14 }, breakLine: i < a.length - 1, paraSpaceAfter: 8 } })), { x: 7.13, y: 2.2, w: 5.45, h: 4.3, fontSize: 16, color: C.background1, valign: "top", margin: 0, isTextBox: true, objectName: "Lista mapa" });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("ok", OUT);
})();
