#!/bin/bash
# Renderiza o deck para PNG via PowerPoint (macOS; o PDF so e gravado dentro do contentor sandbox do PowerPoint).
# O AppleScript do PowerPoint e instavel: tenta ate 4 vezes. Uso: bash code/41_render_deck.sh <pasta_saida>
OUT="$1"; mkdir -p "$OUT"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
C="$HOME/Library/Containers/com.microsoft.Powerpoint/Data/tmpr"; mkdir -p "$C"
for t in 1 2 3 4; do
  rm -f "$C/deck.pdf"
  osascript -e 'tell application "Microsoft PowerPoint" to close every presentation saving no' >/dev/null 2>&1
  sleep 3
  osascript >/dev/null 2>&1 <<EOF
tell application "Microsoft PowerPoint"
  open POSIX file "$ROOT/reports/TML_pitch_competitividade_TP.pptx"
  delay 8
  save presentation 1 in POSIX file "$C/deck.pdf" as save as PDF
end tell
EOF
  sleep 3
  [ -s "$C/deck.pdf" ] && break
  echo "tentativa $t falhou"
done
osascript -e 'tell application "Microsoft PowerPoint" to close every presentation saving no' >/dev/null 2>&1
cp "$C/deck.pdf" "$OUT/deck.pdf" || exit 1
rm -f "$OUT"/s-*.png
pdftoppm -png -r 80 "$OUT/deck.pdf" "$OUT/s"
ls "$OUT"/s-*.png | wc -l
