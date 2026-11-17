#!/bin/bash
# Gera reports/TML_pitch_competitividade_TP.pptx. Requer: pptxgenjs (npm) e a skill pptx (apply_theme.js).
# Uso: NODE_PATH=<dir com node_modules/pptxgenjs> PPTX_SKILL_DIR=<dir da skill pptx> bash code/40_build_deck.sh
set -e
cd "$(dirname "$0")/.."
node code/40_deck.js
python3 code/40_fix_pptx.py reports/TML_pitch_competitividade_TP.pptx
